/**
 * Provide dependency findings as non-blocking agent context.
 * Errors produce no context and the CLI hook exits 0.
 */

import { upgradeActions } from "./actions.js";
import { canPromiseClears } from "./package-manager.js";
import type { JudgeResult } from "./report.js";

/**
 * Maximum findings included in hook context.
 */
const LIMIT = 5;

/**
 * Agent context, or undefined when no findings need to be reported.
 */
export function hookContext(result: JudgeResult): string | undefined {
  const findings = result.fixNow.slice(0, LIMIT);
  if (findings.length === 0) return undefined;

  const lines = findings.map((entry) => {
    const { severity, packageName, advisoryId, fixedIn } = entry.finding;
    const fix = fixedIn === undefined ? "no fix published" : `fixed in ${fixedIn}`;
    return `- ${severity} ${packageName} (${advisoryId}, ${fix})`;
  });

  const more =
    result.fixNow.length > LIMIT ? ` (${result.fixNow.length - LIMIT} more not shown)` : "";

  // Use precomputed, package-manager-specific upgrade commands.
  const manager = result.packageManager ?? "npm";
  const everyCommand = upgradeActions(result.fixNow, result.installed, manager);
  // Only npm lockfile ranges support verified upgrade counts.
  const promises = canPromiseClears(manager);
  const commands = everyCommand.slice(0, LIMIT);
  const remedy =
    commands.length === 0
      ? []
      : [
          everyCommand.length > LIMIT
            ? `Fixable now (${everyCommand.length - LIMIT} more command(s) not shown):`
            : "Fixable now:",
          // Prefix commands with $ to distinguish them from finding bullets.
          ...commands.map(
            (action) =>
              `$ ${action.command}` +
              (action.clears === 1 || !promises ? "" : `   # clears ${action.clears}`),
          ),
          // At a workspace root the command needs the declaring workspace.
          ...(result.workspaceRoot === true
            ? [
                "This is a workspace root. Add -w <workspace> so the version lands in the " +
                  "package that declares it; find that package.json rather than guessing.",
              ]
            : []),
        ];

  return [
    `zero-shelter: this project has ${result.fixNow.length} unaddressed dependency ` +
      `finding(s)${more}. Highest priority first:`,
    ...lines,
    ...remedy,
    "Do not introduce versions that reintroduce these. Run `npx zero-shelter judge --explain` for the reasoning behind the order.",
  ].join("\n");
}

/** The shape agents read back. Only the fields we actually emit. */
export function hookOutput(context: string): string {
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: context,
    },
  })}\n`;
}

/**
 * The working directory to judge.
 *
 * Claude Code sends the session's cwd in the payload, which is more accurate
 * than ours — the hook process is not necessarily started in the project the
 * agent is editing. Anything unparseable falls back rather than failing.
 */
export function cwdFromPayload(raw: string, fallback: string): string {
  try {
    const payload: unknown = JSON.parse(raw);
    if (typeof payload === "object" && payload !== null && "cwd" in payload) {
      const { cwd } = payload as { cwd?: unknown };
      if (typeof cwd === "string" && cwd !== "") return cwd;
    }
  } catch {
    // Fall back to the process directory when the payload is malformed.
  }
  return fallback;
}

export async function readStdin(stream: AsyncIterable<Buffer | string>): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of stream) chunks.push(String(chunk));
  return chunks.join("");
}
