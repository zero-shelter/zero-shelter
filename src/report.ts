/**
 * Text, JSON and explanation views of the same judgement.
 */

import type { AppliedBaseline } from "./baseline.js";
import { transitiveFixes, upgradeActions, type TransitiveFix } from "./actions.js";
import { blockedBy, scopeOf, type InstalledVersions } from "./lockfile.js";
import {
  canPromiseClears,
  overrideSnippet,
  type PackageManager,
} from "./package-manager.js";
import type { RankedFinding } from "./triage.js";
import { WEIGHTS } from "./triage.js";
import { messagesFor } from "./messages.js";

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
   * Scanners that produced a readable report, including empty reports.
   * Keep run metadata independent of outstanding findings.
   */
  readonly sources?: readonly string[];
  /**
   * Package manager used for upgrade commands and override syntax.
   */
  readonly packageManager?: PackageManager;
  /** The date the caller judged on, for saying how old an advisory is. */
  readonly today?: string;
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
 * NO_COLOR disables colour; FORCE_COLOR enables it. Otherwise follow TTY status.
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
    lines.push(paint("✓ no new findings", COLOR.green));
    lines.push(summary(result, paint));
    lines.push(...resolvedLines(result, paint));
    lines.push(...ratchetLines(result, paint));
    return lines.join("\n");
  }

  lines.push(
    paint(
      result.fixNow.length < result.applied.fresh.length
        ? `findings to review: ${result.applied.fresh.length} (top ${fixNow.length} shown)`
        : `findings to review: ${fixNow.length}`,
      COLOR.bold,
    ),
    "",
  );

  const rows = fixNow.map((entry) => ({
    severity: entry.finding.severity,
    // Mark development-only findings; the scope does not affect ranking.
    name:
      scopeOf(entry.finding.packageName, result.installed) === "dev"
        ? `${entry.finding.packageName} (dev)`
        : entry.finding.packageName,
    advisory: entry.finding.advisoryId,
    fix: entry.finding.fixedIn ?? "—",
    score: String(entry.score),
    age: ageOf(entry.finding.published, result.today),
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
        paint(row.age.padEnd(width("age")), COLOR.dim),
      ].join("  "),
    );
  }

  // Compute project totals and remediation from all findings, not the --top slice.
  const outstanding = result.applied.fresh;
  const manager = result.packageManager ?? "npm";
  // Only npm lockfiles support verified upgrade counts.
  const promises = canPromiseClears(manager);
  const actions = upgradeActions(outstanding, result.installed, manager);
  if (actions.length > 0) {
    lines.push("");
    for (const action of actions.slice(0, 3)) {
      lines.push(
        `  ${paint(action.command, COLOR.bold)}` +
          paint(
            action.clears === 1 || !promises ? "" : `   clears ${action.clears}`,
            COLOR.dim,
          ),
      );
    }
    if (!promises) {
      lines.push(
        paint(
          `    counts are not shown for ${manager}: verifying an upgrade reaches every copy ` +
            "needs a lockfile reader this tool only has for npm",
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
        `    package.json ${overrideSnippet(manager, indirect[0]!.packageName, indirect[0]!.upgradeTo)}` +
          " forces one, at the risk of breaking whatever pinned it",
        COLOR.dim,
      ),
    );
  }

  lines.push("", summary(result, paint));

  lines.push(...resolvedLines(result, paint));
  lines.push(...ratchetLines(result, paint));

  // Explain that baseline acceptance requires a risk decision.
  if (!result.baselineExists) {
    lines.push(
      paint(
        "  first run: review findings before accepting risk with --update-baseline",
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
 * Whole days since the advisory publication date. Empty without valid
 * publication and comparison dates, or for future dates. Context only.
 */
function ageOf(published?: string, today?: string): string {
  if (published === undefined || today === undefined) return "";
  const from = Date.parse(published);
  const to = Date.parse(today);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return "";
  return `${Math.floor((to - from) / 86_400_000)}d`;
}

/**
 * Count production and development findings using lockfile scope metadata.
 * Omit the split without a readable lockfile; it does not change ranking.
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
 * Report alias rematches and expired acceptances so baseline behavior is visible.
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
    // Display install-script metadata separately from vulnerability findings.
    const names = [...installScripts].sort();
    const shown = names.slice(0, 3).join(", ");
    const rest = names.length > 3 ? ` and ${names.length - 3} more` : "";
    lines.push(
      paint(
        `  ${names.length} package(s) run a script on install: ${shown}${rest}`,
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
 * Name parent packages whose version ranges block a direct upgrade.
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
 * Report accepted findings absent from this run, with a caveat when baseline
 * scanners did not run. Absence alone does not establish a fix.
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
        "review before --update-baseline; it also accepts all current findings",
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
  // Use all outstanding findings so --top cannot change the percentage.
  const removed = raw - outstanding;
  // Integer percentage: a float here would print differently across locales.
  const percent = raw === 0 ? 0 : Math.round((removed * 100) / raw);

  // Explain the absence of cross-source reconciliation for a single scanner.
  const lonely = result.sources !== undefined && result.sources.length === 1;

  return paint(
    `  ${raw} reported → ${merged} after merge → ${outstanding} to review` +
      scopeSplit(result) +
      (raw === 0
        ? ""
        : `  (${percent}% fewer listed${lonely ? " — one source; no cross-scanner comparison" : ""})`) +
      (fixNow.length < outstanding ? `, showing ${fixNow.length}` : "") +
      (applied.suppressed.length > 0
        ? `, ${applied.suppressed.length} already accepted`
        : ""),
    COLOR.dim,
  );
}

export function renderExplain(result: JudgeResult): string {
  const lines: string[] = [];
  const t = messagesFor("en");

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
      lines.push(`  ${String(reason.points).padStart(5)}  ${t.reasonText(reason)}`);
    }

    lines.push(`  ${"".padStart(5)}  range ${finding.vulnerableRange}`);

    // Publication dates and CVSS vectors are context, not ranking inputs.
    const published = finding.published;
    if (published !== undefined) {
      const age = ageOf(published, result.today);
      lines.push(
        `  ${"".padStart(5)}  published ${published.slice(0, 10)}` +
          (age === "" ? "" : ` — open ${age}`),
      );
    }
    if (finding.cvssVector !== undefined) {
      lines.push(`  ${"".padStart(5)}  ${finding.cvssVector} (from the advisory, not our score)`);
    }

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
 * List the exported ranking weights with their labels.
 */
function weightsTable(): string[] {
  const t = messagesFor("en");
  const rows: [string, number][] = [
    ...Object.entries(WEIGHTS.severity).map(
      ([name, points]) => [t.weightSeverity(name as keyof typeof WEIGHTS.severity), points] as [
        string,
        number,
      ],
    ),
    [t.weightDirect, WEIGHTS.directDependency],
    [t.weightFixAvailable, WEIGHTS.fixAvailable],
    [t.weightCorroborated, WEIGHTS.corroboratedPerExtraTool],
    [t.weightUnjoinedSibling, WEIGHTS.hasUnjoinedSibling],
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
 * Compact JSON view. Full members and alias chains are available in --explain.
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
      missingSources: result.applied.missingSources,
      // The commands, so a caller does not have to re-derive them from the
      // findings and get the version comparison subtly wrong.
      workspaceRoot: result.workspaceRoot === true,
      // Use manager-specific commands and omit unverifiable clears counts.
      upgrades: upgradeActions(
        result.applied.fresh,
        result.installed,
        result.packageManager ?? "npm",
      ).map((action) =>
        canPromiseClears(result.packageManager ?? "npm")
          ? action
          : { packageName: action.packageName, upgradeTo: action.upgradeTo, command: action.command },
      ),
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
