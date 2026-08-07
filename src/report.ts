/**
 * Rendering. Three views of one dataset — never three datasets.
 */

import type { AppliedBaseline } from "./baseline.js";
import type { RankedFinding } from "./triage.js";
import { WEIGHTS } from "./triage.js";

export interface JudgeResult {
  readonly raw: number;
  readonly merged: number;
  readonly applied: AppliedBaseline;
  readonly fixNow: readonly RankedFinding[];
  readonly skipped: readonly string[];
  /** False on a first run, which changes what advice is worth giving. */
  readonly baselineExists: boolean;
}

const COLOR = {
  reset: "[0m",
  dim: "[2m",
  bold: "[1m",
  red: "[31m",
  yellow: "[33m",
  green: "[32m",
} as const;

/**
 * Colour is opt-out via NO_COLOR and off when not writing to a terminal, so
 * piping into a file or a CI log never produces escape soup.
 */
export function colorEnabled(env: NodeJS.ProcessEnv, isTTY: boolean): boolean {
  if (env["NO_COLOR"] !== undefined && env["NO_COLOR"] !== "") return false;
  if (env["FORCE_COLOR"] !== undefined && env["FORCE_COLOR"] !== "") return true;
  return isTTY;
}

export function renderHuman(result: JudgeResult, color: boolean): string {
  const paint = (text: string, code: string): string =>
    color ? `${code}${text}${COLOR.reset}` : text;

  const lines: string[] = [];

  for (const note of result.skipped) {
    lines.push(paint(`  ${note}`, COLOR.dim));
  }
  if (result.skipped.length > 0) lines.push("");

  if (result.applied.warning !== undefined) {
    lines.push(paint(`⚠ ${result.applied.warning}`, COLOR.yellow), "");
  }

  const { fixNow } = result;

  if (fixNow.length === 0) {
    lines.push(paint("✓ nothing new to fix", COLOR.green));
    lines.push(summary(result, paint));
    return lines.join("\n");
  }

  lines.push(paint(`fix these ${fixNow.length} now`, COLOR.bold), "");

  const rows = fixNow.map((entry) => ({
    severity: entry.finding.severity,
    name: `${entry.finding.packageName}`,
    advisory: entry.finding.advisoryId,
    fix: entry.finding.fixedIn ?? "—",
    score: String(entry.score),
  }));

  const width = (key: keyof (typeof rows)[number]): number =>
    Math.max(...rows.map((row) => row[key].length));

  for (const row of rows) {
    const severityColor =
      row.severity === "critical" || row.severity === "high"
        ? COLOR.red
        : row.severity === "moderate"
          ? COLOR.yellow
          : COLOR.dim;

    lines.push(
      [
        "  " + paint(row.severity.padEnd(width("severity")), severityColor),
        row.name.padEnd(width("name")),
        paint(row.advisory.padEnd(width("advisory")), COLOR.dim),
        `→ ${row.fix.padEnd(width("fix"))}`,
        paint(row.score.padStart(width("score")), COLOR.dim),
      ].join("  "),
    );
  }

  lines.push("", summary(result, paint));

  // A first run on an existing project reports its whole backlog and reduces
  // nothing, which reads like the tool failing. Say what it is actually for.
  if (!result.baselineExists) {
    lines.push(
      paint(
        "  first run — record these as accepted with --update-baseline, " +
          "then only new findings are reported",
        COLOR.dim,
      ),
    );
  }

  const unjoined = fixNow.filter((entry) => entry.finding.relatedTo.length > 0);
  if (unjoined.length > 0) {
    lines.push(
      paint(
        `  ${unjoined.length} finding(s) may duplicate another for the same package; ` +
          `they share no advisory id, so they are listed separately. --explain shows which.`,
        COLOR.dim,
      ),
    );
  }

  return lines.join("\n");
}

function summary(
  result: JudgeResult,
  paint: (text: string, code: string) => string,
): string {
  const { raw, merged, applied, fixNow } = result;
  const removed = raw - fixNow.length;
  // Integer percentage: a float here would print differently across locales.
  const percent = raw === 0 ? 0 : Math.round((removed * 100) / raw);

  return paint(
    `  ${raw} reported → ${merged} after merge → ${fixNow.length} to fix` +
      (raw === 0 ? "" : `  (${percent}% less noise)`) +
      (applied.suppressed.length > 0
        ? `, ${applied.suppressed.length} already accepted`
        : ""),
    COLOR.dim,
  );
}

export function renderExplain(result: JudgeResult): string {
  const lines: string[] = [];

  for (const entry of result.fixNow) {
    const { finding } = entry;
    lines.push(`${finding.packageName}  ${finding.advisoryId}  score ${entry.score}`);
    lines.push(`  ${finding.title}`);

    for (const reason of entry.reasons) {
      lines.push(`  ${String(reason.points).padStart(5)}  ${reason.label}`);
    }

    lines.push(`  ${"".padStart(5)}  range ${finding.vulnerableRange}`);

    if (finding.aliases.length > 1) {
      lines.push(`  ${"".padStart(5)}  also known as ${finding.aliases.join(", ")}`);
    }

    if (finding.members.length > 1) {
      lines.push(
        `  ${"".padStart(5)}  merged ${finding.members.length} reports on a shared advisory id`,
      );
    }

    if (finding.relatedTo.length > 0) {
      lines.push(
        `  ${"".padStart(5)}  not merged with ${finding.relatedTo.join(", ")} ` +
          `— same package, no shared advisory id`,
      );
    }

    lines.push("");
  }

  lines.push(`weights: ${JSON.stringify(WEIGHTS)}`);
  return lines.join("\n");
}

/**
 * The machine-readable view, deliberately trimmed.
 *
 * An agent reading this pays for every token, so member findings and full alias
 * chains stay out. `--explain` is where the full picture lives.
 */
export function renderJson(result: JudgeResult): string {
  return `${JSON.stringify(
    {
      summary: {
        raw: result.raw,
        merged: result.merged,
        fixNow: result.fixNow.length,
        accepted: result.applied.suppressed.length,
      },
      warning: result.applied.warning,
      skipped: result.skipped,
      fixNow: result.fixNow.map((entry) => ({
        fingerprint: entry.finding.fingerprint,
        score: entry.score,
        severity: entry.finding.severity,
        ecosystem: entry.finding.ecosystem,
        package: entry.finding.packageName,
        advisory: entry.finding.advisoryId,
        title: entry.finding.title,
        vulnerableRange: entry.finding.vulnerableRange,
        fixedIn: entry.finding.fixedIn,
        direct: !entry.finding.transitive,
        tools: entry.finding.tools,
        possibleDuplicates: entry.finding.relatedTo,
      })),
    },
    null,
    2,
  )}\n`;
}
