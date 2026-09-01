/**
 * Put the project's current judgement into a coding agent's context, before it
 * writes any code.
 *
 * The agent otherwise starts every session blind: it will happily add a
 * dependency this project already has an unfixed advisory for. This hands it
 * the same short list a human gets from `judge`.
 *
 * Two things this deliberately does NOT do:
 *
 * - It never blocks the prompt. A dependency judge has no business deciding
 *   what someone is allowed to ask, and the platforms cannot rewrite a prompt
 *   anyway — `UserPromptSubmit` only adds context alongside it.
 * - It never fails. A hook that errors interrupts the developer's session over
 *   a security report they did not ask for, which is a worse outcome than
 *   staying quiet. Every failure path here ends in "say nothing, exit 0".
 */

import { upgradeActions } from "./actions.js";
import { canPromiseClears } from "./package-manager.js";
import type { JudgeResult } from "./report.js";

/** How many findings an agent can act on without the context becoming noise. */
const LIMIT = 5;

/**
 * The text handed to the agent, or undefined when there is nothing worth
 * interrupting it with.
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

  // An agent that knows what is broken and not how to fix it will invent a
  // way, and the invented way is usually `npm i package@latest` on something
  // transitive. The commands are already computed; withholding them here just
  // moves the guessing.
  // The manager matters more here than anywhere else. Everything else that
  // prints a command is read by a person who would notice `npm i` in a pnpm
  // repository; an agent runs it, gets a lockfile it did not want, and reports
  // success.
  const manager = result.packageManager ?? "npm";
  const everyCommand = upgradeActions(result.fixNow, result.installed, manager);
  // Same rule the report follows: the count rests on reading dependents'
  // ranges out of package-lock.json, and there is no reader for the others. An
  // agent told "clears 7" will report seven closed.
  const promises = canPromiseClears(manager);
  const commands = everyCommand.slice(0, LIMIT);
  const remedy =
    commands.length === 0
      ? []
      : [
          everyCommand.length > LIMIT
            ? `Fixable now (${everyCommand.length - LIMIT} more command(s) not shown):`
            : "Fixable now:",
          // `$` rather than `-`: the findings above are a bulleted list and
          // these are commands to run. Two identical-looking lists in one
          // context is how an agent ends up "fixing" a finding by pasting its
          // title somewhere.
          ...commands.map(
            (action) =>
              `$ ${action.command}` +
              (action.clears === 1 || !promises ? "" : `   # clears ${action.clears}`),
          ),
          // The terminal and the html report both add this. Without it an
          // agent runs the bare command at the root, adds a dependency the
          // project did not declare, and leaves the workspace that did declare
          // it on the vulnerable range.
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
    // ponytail: a malformed payload is not worth diagnosing here — judging the
    // process cwd is still useful, and the alternative is breaking the session.
  }
  return fallback;
}

export async function readStdin(stream: AsyncIterable<Buffer | string>): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of stream) chunks.push(String(chunk));
  return chunks.join("");
}
