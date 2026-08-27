/**
 * Rendering. Three views of one dataset — never three datasets.
 */

import type { AppliedBaseline } from "./baseline.js";
import { transitiveFixes, upgradeActions, type TransitiveFix } from "./actions.js";
import { blockedBy, scopeOf, type InstalledVersions } from "./lockfile.js";
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
  /** Set when the install commands would land in the wrong package.json. */
  readonly workspaceRoot?: boolean;
  /** Versions the lockfile actually holds — decides whether `npm i` can reach them. */
  readonly installed?: InstalledVersions;
  /**
   * Scanners that produced a readable report this run.
   *
   * The caller works this out on both the scan path and the `--input` path, and
   * until now it reached `applyBaseline` and stopped there. Everything
   * downstream that needs to say which tools were present — the history record,
   * the summary line, SARIF — had to guess it back from the findings, which
   * answers "none" on a run where every finding was already accepted.
   */
  readonly sources?: readonly string[];
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
    lines.push(...resolvedLines(result, paint));
    lines.push(...ratchetLines(result, paint));
    return lines.join("\n");
  }

  lines.push(
    paint(
      result.fixNow.length < result.applied.fresh.length
        ? `fix these ${result.applied.fresh.length} now — top ${fixNow.length} shown`
        : `fix these ${fixNow.length} now`,
      COLOR.bold,
    ),
    "",
  );

  const rows = fixNow.map((entry) => ({
    severity: entry.finding.severity,
    // Only the exception is marked. Labelling every row is the same as
    // labelling none — the eye stops seeing it.
    name:
      scopeOf(entry.finding.packageName, result.installed) === "dev"
        ? `${entry.finding.packageName} (dev)`
        : entry.finding.packageName,
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

  // Everything below describes the project, not the page. --top decides how
  // many rows are printed; letting it decide these too turns a display limit
  // into a claim about the codebase.
  const outstanding = result.applied.fresh;
  const actions = upgradeActions(outstanding, result.installed);
  if (actions.length > 0) {
    lines.push("");
    for (const action of actions.slice(0, 3)) {
      lines.push(
        `  ${paint(action.command, COLOR.bold)}` +
          paint(
            action.clears === 1 ? "" : `   clears ${action.clears}`,
            COLOR.dim,
          ),
      );
    }
    if (actions.length > 3) {
      lines.push(paint(`  …and ${actions.length - 3} more package(s)`, COLOR.dim));
    }

    if (result.workspaceRoot === true) {
      lines.push(
        paint(
          "    this is a workspace root — add -w <workspace> so the version lands in the " +
            "package that declares it (hoisting hides which one from the scanners)",
          COLOR.dim,
        ),
      );
    }
  }

  const indirect = transitiveFixes(outstanding, result.installed);
  if (indirect.length > 0) {
    const total = indirect.reduce((sum, entry) => sum + entry.clears, 0);
    if (actions.length === 0) lines.push("");
    lines.push(
      paint(
        `  ${total} finding(s) in ${indirect.length} package(s) have a published fix but ` +
          "arrive through another dependency",
        COLOR.dim,
      ),
    );

    const reason = whyNotDirect(indirect[0]!, result.installed);
    if (reason !== undefined) lines.push(paint(`    ${reason}`, COLOR.dim));

    lines.push(
      paint(
        `    package.json "overrides": { "${indirect[0]!.packageName}": "${indirect[0]!.upgradeTo}" }` +
          " forces one, at the risk of breaking whatever pinned it",
        COLOR.dim,
      ),
    );
  }

  lines.push("", summary(result, paint));

  lines.push(...resolvedLines(result, paint));
  lines.push(...ratchetLines(result, paint));

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

  const unjoined = outstanding.filter((entry) => entry.finding.relatedTo.length > 0);
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

/**
 * How much of the pile actually ships.
 *
 * The complaint this answers: a high in a test runner and a high in something
 * serving requests arrive with the same score, side by side, and the reader has
 * to sort that out by hand every time — which is the attention this tool claims
 * to give back.
 *
 * It splits the denominator and leaves the score alone. A weight would be a
 * claim about relative risk we cannot currently defend with a measurement, and
 * an invented composite is the thing PRODUCT.md names as the anti-reference.
 * Silent without a lockfile, because then we did not look.
 */
function scopeSplit(result: JudgeResult): string {
  if (result.installed === undefined) return "";

  let production = 0;
  let devOnly = 0;
  for (const entry of result.applied.fresh) {
    if (scopeOf(entry.finding.packageName, result.installed) === "dev") devOnly += 1;
    else production += 1;
  }

  if (devOnly === 0) return "";
  return ` (${production} reach production, ${devOnly} dev only)`;
}

/**
 * What the baseline did that the reader did not ask for.
 *
 * A finding recognised under a fingerprint other than the recorded one has been
 * rescued by a rule nobody can see, and an unseen rescue is the same kind of
 * problem as an unseen loss — it is how a tool ends up trusted for the wrong
 * reason. So it is counted out loud, with the cause, which is almost always
 * that the set of scanners changed.
 */
function ratchetLines(
  result: JudgeResult,
  paint: (text: string, code: string) => string,
): string[] {
  const lines: string[] = [];
  const { rematched, expired } = result.applied;

  if (rematched.length > 0) {
    lines.push(
      paint(
        `  ${rematched.length} accepted finding(s) came back under a different fingerprint ` +
          "and were matched by advisory id — usually a change in which scanners ran",
        COLOR.dim,
      ),
    );
  }

  const installScripts = result.installed?.installScripts;
  if (installScripts !== undefined && installScripts.size > 0) {
    // Inventory, not an alarm. Native modules need install scripts, so a
    // number here is normal and a red banner over `core-js` would only teach
    // people to stop reading. What is worth knowing is that the set exists,
    // how big it is, and who is in it.
    const names = [...installScripts].sort();
    const shown = names.slice(0, 3).join(", ");
    const rest = names.length > 3 ? ` and ${names.length - 3} more` : "";
    lines.push(
      paint(
        `  ${names.length} package(s) run a script on install — code that executes ` +
          `before any test does: ${shown}${rest}`,
        COLOR.dim,
      ),
    );
  }

  if (expired.length > 0) {
    lines.push(
      paint(
        `  ${expired.length} acceptance(s) have expired and are reported again`,
        COLOR.yellow,
      ),
    );
  }

  return lines;
}

/**
 * Why the obvious command is not on the list.
 *
 * "Use overrides instead" is advice the reader has to take on faith. The
 * lockfile knows which packages pin the old version, and naming them is the
 * difference between being told to trust the tool and being able to check it.
 */
function whyNotDirect(fix: TransitiveFix, installed?: InstalledVersions): string | undefined {
  const blockers = blockedBy(fix.packageName, fix.upgradeTo, installed);
  const first = blockers[0];
  if (first === undefined) return undefined;

  if (first.by === "the tree") {
    return `the tree already holds ${fix.packageName} ${first.range} — one npm i moves only one of them`;
  }

  const names = [...new Set(blockers.map(({ by }) => by.split("node_modules/").pop() ?? by))];
  const shown = names.slice(0, 3).join(", ");
  const rest = names.length > 3 ? ` and ${names.length - 3} more` : "";
  return (
    `${shown}${rest} require an older ${fix.packageName} ` +
    `— npm i ${fix.packageName}@${fix.upgradeTo} leaves their copies in place`
  );
}

/**
 * Credit for work that was actually done, and the caveat that comes with it.
 *
 * Someone who upgrades a package and re-runs this deserves to see that it
 * worked; without it the only feedback is a number quietly getting smaller.
 * But a finding also disappears when the scanner that found it did not run this
 * time, and from here those look identical — so this says what it can defend
 * ("no longer reported") and names the doubt when there is one.
 */
function resolvedLines(
  result: JudgeResult,
  paint: (text: string, code: string) => string,
): string[] {
  const gone = result.applied.noLongerReported.length;
  if (gone === 0) return [];

  const lines = [
    paint(
      `  ✓ ${gone} accepted finding(s) no longer reported — ` +
        "re-record with --update-baseline to drop them",
      COLOR.green,
    ),
  ];

  const { missingSources } = result.applied;
  if (missingSources.length > 0) {
    lines.push(
      paint(
        `    (${missingSources.join(", ")} contributed when the baseline was ` +
          "recorded and did not run this time, so some of those may simply not " +
          "have been looked for)",
        COLOR.dim,
      ),
    );
  }

  return lines;
}

function summary(
  result: JudgeResult,
  paint: (text: string, code: string) => string,
): string {
  const { raw, merged, applied, fixNow } = result;
  const outstanding = applied.fresh.length;
  // Measured against everything still outstanding. Using the truncated list
  // here would let --top 3 announce a 98% reduction on a project with 82
  // findings left, which is the tool congratulating itself for looking away.
  const removed = raw - outstanding;
  // Integer percentage: a float here would print differently across locales.
  const percent = raw === 0 ? 0 : Math.round((removed * 100) / raw);

  // With one source there is nothing to reconcile, so the reduction is zero and
  // the screen looks like a tool that did nothing. Every yarn project lands
  // here — npm audit cannot read yarn.lock, so osv-scanner runs alone. Saying
  // why is not an apology: one scanner is a valid way to run this, and the
  // ranking and the baseline still work.
  const lonely = result.sources !== undefined && result.sources.length === 1;

  return paint(
    `  ${raw} reported → ${merged} after merge → ${outstanding} to fix` +
      scopeSplit(result) +
      (raw === 0
        ? ""
        : `  (${percent}% less noise${lonely ? " — one source, nothing to reconcile" : ""})`) +
      (fixNow.length < outstanding ? `, showing ${fixNow.length}` : "") +
      (applied.suppressed.length > 0
        ? `, ${applied.suppressed.length} already accepted`
        : ""),
    COLOR.dim,
  );
}

export function renderExplain(result: JudgeResult): string {
  const lines: string[] = [];

  // Fingerprints identify a finding but say nothing about it. When a possible
  // duplicate is named, the reader needs to know which advisory to go compare.
  const byFingerprint = new Map(
    result.fixNow.map((entry) => [entry.finding.fingerprint, entry.finding]),
  );

  for (const entry of result.fixNow) {
    const { finding } = entry;
    lines.push(`${finding.packageName}  ${finding.advisoryId}  score ${entry.score}`);
    lines.push(`  ${finding.title}`);

    for (const reason of entry.reasons) {
      lines.push(`  ${String(reason.points).padStart(5)}  ${reason.label}`);
    }

    lines.push(`  ${"".padStart(5)}  range ${finding.vulnerableRange}`);

    if (finding.fixVersionsClaimed !== undefined) {
      lines.push(
        `  ${"".padStart(5)}  sources named different fixes ` +
          `(${finding.fixVersionsClaimed.join(", ")}); ${finding.fixedIn} satisfies all of them`,
      );
    }

    if (finding.aliases.length > 1) {
      lines.push(`  ${"".padStart(5)}  also known as ${finding.aliases.join(", ")}`);
    }

    if (finding.members.length > 1) {
      lines.push(
        `  ${"".padStart(5)}  merged ${finding.members.length} reports on a shared advisory id`,
      );
    }

    if (finding.relatedTo.length > 0) {
      const named = finding.relatedTo.map((fingerprint) => {
        const other = byFingerprint.get(fingerprint);
        return other === undefined
          ? fingerprint
          : `${other.advisoryId}${other.fixedIn === undefined ? "" : ` (fixed in ${other.fixedIn})`}`;
      });

      lines.push(
        `  ${"".padStart(5)}  not merged with ${named.join(", ")} ` +
          "— same package, no shared advisory id",
      );
      lines.push(
        `  ${"".padStart(5)}  check whether those describe the same issue: if they do, ` +
          "one upgrade closes them together and this list is longer than the work",
      );
    }

    lines.push("");
  }

  lines.push(...weightsTable());
  return lines.join("\n");
}

/**
 * The weights, readable.
 *
 * This section exists so the ranking can be argued with, and a one-line JSON
 * dump is not something anyone argues with — they skip it. Flattened to
 * `label  points` so a disagreement can point at a row.
 */
function weightsTable(): string[] {
  const rows: [string, number][] = [
    ...Object.entries(WEIGHTS.severity).map(
      ([name, points]) => [`severity: ${name}`, points] as [string, number],
    ),
    ["direct dependency", WEIGHTS.directDependency],
    ["fix available", WEIGHTS.fixAvailable],
    ["each extra tool that agrees", WEIGHTS.corroboratedPerExtraTool],
    ["has an unjoined sibling", WEIGHTS.hasUnjoinedSibling],
  ];

  const width = Math.max(...rows.map(([label]) => label.length));

  return [
    "weights — every point above comes from this table",
    ...rows.map(([label, points]) => `  ${label.padEnd(width)}  ${String(points).padStart(4)}`),
    "",
    "Disagree with a row rather than with the order: change the number and every",
    "run changes with it, which is the only way the ranking stays checkable.",
  ];
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
        fixNow: result.applied.fresh.length,
        shown: result.fixNow.length,
        accepted: result.applied.suppressed.length,
        noLongerReported: result.applied.noLongerReported.length,
      },
      noLongerReported: result.applied.noLongerReported,
      warning: result.applied.warning,
      skipped: result.skipped,
      // The commands, so a caller does not have to re-derive them from the
      // findings and get the version comparison subtly wrong.
      workspaceRoot: result.workspaceRoot === true,
      upgrades: upgradeActions(result.applied.fresh, result.installed),
      transitiveFixes: transitiveFixes(result.applied.fresh, result.installed),
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
