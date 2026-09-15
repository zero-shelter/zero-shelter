/**
 * Render a self-contained HTML report with inline styles and optional copy
 * controls. No network requests, runtime dependencies, or clock reads.
 */

import {
  type TransitiveFix,
  type UpgradeAction,
  transitiveFixes,
  upgradeActions,
} from "./actions.js";
import {
  canPromiseClears,
  overrideBlock,
  overridesField,
  type PackageManager,
} from "./package-manager.js";
import type { JudgeResult } from "./report.js";
import { WEIGHTS, type Reason } from "./triage.js";
import { type Language, messagesFor } from "./messages.js";
import type { MergedFinding } from "./merge.js";
import type { Change } from "./history.js";

export interface HtmlOptions {
  readonly language: Language;
  /**
   * Recorded runs, oldest first. Displayed when at least two runs are available.
   */
  readonly history?: readonly Change[];
  /** Printed verbatim in the footer. Omitted entirely when absent. */
  readonly stamp?: string;
  /** The command that produced this page, for the reproduce section. */
  readonly command?: string;
}

/**
 * Languages written right to left.
 *
 * None ship yet. The set exists so that adding a catalogue is the only work a
 * translator has to do: the layout uses logical properties throughout, so it
 * mirrors on its own once `dir` is set.
 */
const RIGHT_TO_LEFT = new Set(["ar", "fa", "he", "ur"]);

/** Severity as a count of filled blocks, so rank survives without colour. */
const SEVERITY_RANK: Record<string, number> = {
  critical: 5,
  high: 4,
  moderate: 3,
  low: 2,
  info: 1,
};

export function renderHtml(result: JudgeResult, options: HtmlOptions): string {
  const t = messagesFor(options.language);
  const outstanding = result.applied.fresh;
  const manager = result.packageManager ?? "npm";
  const actions = upgradeActions(outstanding, result.installed, manager);
  const indirect = transitiveFixes(outstanding, result.installed);
  // Only npm lockfiles support verified counts; hide both counts and any
  // count-related instructions for other managers.
  const promises = canPromiseClears(manager);

  const body = [
    header(options, t),
    scannerStatus(result, t),
    // Keep stale-baseline warnings visible before the summary.
    result.applied.warning === undefined
      ? ""
      : `<section class="warning"><p>${escape(result.applied.warning)}</p></section>`,
    result.skipped.length > 0 ? notes(result.skipped) : "",
    result.applied.noLongerReported.length > 0 && result.applied.missingSources.length > 0
      ? `<p class="caveat">${escape(t.resolvedDoubt(result.applied.missingSources.join(", ")))}</p>`
      : "",
    summary(result, t),
    outstanding.length === 0
      ? verdict(result, t)
      : [
          '<div class="action-paths">',
          actionBlock(actions, result.workspaceRoot === true, t, promises, manager),
          promptBlock(
            actions,
            indirect,
            [
              ...new Set(
                outstanding
                  .filter((entry) => entry.finding.fixedIn === undefined)
                  .map((entry) => entry.finding.packageName),
              ),
            ],
            result.workspaceRoot === true,
            t,
            manager,
          ),
          "</div>",
          indirect.length > 0 ? transitiveBlock(indirect, t, manager) : "",
          ledger(result, t),
        ].join("\n"),
    closing(result, t),
    options.history === undefined || options.history.length < 2
      ? ""
      : historyBlock(options.history, t),
    footer(options, t),
  ]
    .filter((section) => section !== "")
    .join("\n");

  return [
    "<!doctype html>",
    `<html lang="${options.language}"${RIGHT_TO_LEFT.has(options.language) ? ' dir="rtl"' : ""}>`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escape(t.documentTitle)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    // The theme switch is a checkbox the page reads with :has(), so light and
    // dark are both available without a line of JavaScript deciding anything.
    `<input type="checkbox" id="dark" class="theme-input">`,
    '<main class="sheet">',
    body,
    "</main>",
    SCRIPT,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function header(options: HtmlOptions, t: ReturnType<typeof messagesFor>): string {
  return [
    '<header class="top">',
    '<div class="titles">',
    `<h1>${escape(t.heading)}</h1>`,
    `<p class="sub">${escape(t.subheading)}</p>`,
    "</div>",
    `<label class="theme" for="dark"><span class="dot"></span>${escape(t.themeLabel)}</label>`,
    "</header>",
    options.stamp === undefined ? "" : `<p class="stamp">${escape(options.stamp)}</p>`,
  ].filter((line) => line !== "").join("\n");
}

function scannerStatus(result: JudgeResult, t: ReturnType<typeof messagesFor>): string {
  // Older callers may omit run metadata. Findings can name contributors, but
  // an empty finding list alone cannot establish whether a scanner ran.
  const sources = result.sources ?? [...new Set(
    [...result.applied.fresh, ...result.applied.suppressed]
      .flatMap((entry) => entry.finding.tools),
  )];
  const status = sources.length > 0
    ? `${escape(t.sourcesUsed)}: ${sources.map(escape).join(", ")}`
    : escape(result.sources === undefined ? t.sourcesUnknown : t.sourcesNone);
  return `<p class="scanner-status">${status}</p>`;
}

function summary(result: JudgeResult, t: ReturnType<typeof messagesFor>): string {
  const { raw, merged, applied, fixNow } = result;
  const counts = [
    stat(String(raw), t.summaryReported),
    stat(String(merged), t.summaryMerged),
    stat(String(applied.fresh.length), t.summaryOutstanding, true),
    applied.suppressed.length > 0
      ? stat(String(applied.suppressed.length), t.summaryAccepted)
      : "",
    fixNow.length < applied.fresh.length ? stat(String(fixNow.length), t.summaryShown) : "",
  ].filter((cell) => cell !== "").join("");
  return `<div class="counts">${counts}</div>\n${glossary(t)}`;
}

function stat(value: string, label: string, emphasis = false): string {
  return (
    `<div class="count${emphasis ? " count--lead" : ""}">` +
    `<span class="count-value">${escape(value)}</span>` +
    `<span class="count-label">${escape(label)}</span>` +
    "</div>"
  );
}

function notes(skipped: readonly string[]): string {
  return [
    '<ul class="notes">',
    ...skipped.map((note) => `<li>${escape(note)}</li>`),
    "</ul>",
  ].join("\n");
}

function verdict(result: JudgeResult, t: ReturnType<typeof messagesFor>): string {
  const scanned = (result.sources?.length ?? 0) > 0 || result.raw > 0 || result.applied.suppressed.length > 0;
  return `<p class="verdict">${escape(scanned ? t.nothingOutstanding : t.nothingScanned)}</p>`;
}

function actionBlock(
  actions: readonly { command: string; clears: number }[],
  workspaceRoot: boolean,
  t: ReturnType<typeof messagesFor>,
  promises: boolean,
  manager: PackageManager,
): string {
  if (actions.length === 0) {
    return `<section class="act"><h2>${escape(t.actNow)}</h2><p class="quiet">${escape(t.actNowEmpty)}</p></section>`;
  }

  const rows = actions.map(
    (action, index) =>
      // Emphasize the first command in the existing ordered list.
      `<li class="command${index === 0 ? " command--lead" : ""}">` +
      `<code>${escape(action.command)}</code>` +
      (promises && action.clears > 1
        ? `<span class="clears">${escape(t.clears(action.clears))}</span>`
        : "") +
      `<button class="copy" type="button" data-copy="${escape(action.command)}" data-copied="${escape(t.copied)}" data-select="${escape(t.selected)}">${escape(t.copy)}</button>` +
      "</li>",
  );

  return [
    '<section class="act">',
    `<h2>${escape(t.actNow)}</h2>`,
    `<p class="how">${escape(promises ? t.actNowHow : t.actNowHowNoCounts(manager))}</p>`,
    `<ol class="commands">${rows.join("")}</ol>`,
    workspaceRoot ? `<p class="caveat">${escape(t.workspaceCaveat)}</p>` : "",
    "</section>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Limit package names per prompt and report the number omitted.
 */
const UNFIXABLE_NAMED = 8;

function promptBlock(
  actions: readonly UpgradeAction[],
  indirect: readonly TransitiveFix[],
  unfixable: readonly string[],
  workspaceRoot: boolean,
  t: ReturnType<typeof messagesFor>,
  manager: PackageManager,
): string {
  const prompts: string[] = [];

  if (actions.length > 0) {
    const packages = actions
      .map((action) => `${action.packageName}@${action.upgradeTo}`)
      .join(", ");
    // In a workspace the plain command lands in the root package, so the
    // prompt has to send the agent looking for the package.json that declared
    // the range rather than pasting what the report printed.
    prompts.push(workspaceRoot ? t.promptFixWorkspace(packages) : t.promptFix(packages));
  }
  if (indirect.length > 0) {
    prompts.push(
      t.promptOverrides(
        indirect.map((entry) => `${entry.packageName}@${entry.upgradeTo}`).join(", "),
        overridesField(manager),
      ),
    );
  }
  if (unfixable.length > 0) {
    // Limit prompt length and disclose how many package names were omitted.
    const named = unfixable.slice(0, UNFIXABLE_NAMED);
    const hidden = unfixable.length - named.length;
    prompts.push(
      hidden > 0
        ? t.promptUnfixableMore(named.join(", "), hidden)
        : t.promptUnfixable(named.join(", ")),
    );
  }
  if (prompts.length === 0) return "";

  const items = prompts.map(
    (prompt) =>
      '<li class="prompt">' +
      `<p>${escape(prompt)}</p>` +
      `<button class="copy" type="button" data-copy="${escape(prompt)}" data-copied="${escape(t.copied)}" data-select="${escape(t.selected)}">${escape(t.copy)}</button>` +
      "</li>",
  );

  return [
    '<section class="prompts">',
    `<h2>${escape(t.promptsHeading)}</h2>`,
    `<p class="how">${escape(t.promptsHow)}</p>`,
    `<ul class="prompt-list">${items.join("")}</ul>`,
    "</section>",
  ].join("\n");
}

/**
 * Optional definitions of report terms.
 */
function glossary(t: ReturnType<typeof messagesFor>): string {
  const rows = t.glossaryTerms.map(
    ([term, meaning]) =>
      `<div class="term"><dt>${escape(term)}</dt><dd>${escape(meaning)}</dd></div>`,
  );

  return [
    '<details class="glossary">',
    `<summary>${escape(t.glossary)}</summary>`,
    `<dl>${rows.join("")}</dl>`,
    "</details>",
  ].join("");
}

function transitiveBlock(
  indirect: readonly { packageName: string; upgradeTo: string; clears: number }[],
  t: ReturnType<typeof messagesFor>,
  manager: PackageManager,
): string {
  const total = indirect.reduce((sum, entry) => sum + entry.clears, 0);
  // Render override syntax for the detected package manager.
  const block = overrideBlock(
    manager,
    indirect.map((entry) => [entry.packageName, entry.upgradeTo] as const),
  );

  return [
    '<section class="indirect">',
    `<p>${escape(t.transitive(total, indirect.length))}</p>`,
    `<p class="quiet">${escape(t.transitiveHow)}</p>`,
    `<pre class="snippet"><code>${escape(block)}</code></pre>`,
    `<p class="caveat">${escape(t.transitiveRisk)}</p>`,
    "</section>",
  ].join("\n");
}

function ledger(result: JudgeResult, t: ReturnType<typeof messagesFor>): string {
  let previousPackage = "";
  const byFingerprint = new Map(
    result.fixNow.map((entry) => [entry.finding.fingerprint, entry.finding]),
  );

  const rows = result.fixNow.map((entry) => {
    const f = entry.finding;
    const rank = SEVERITY_RANK[f.severity] ?? 1;
    // A package repeated down the column is one upgrade, not several problems.
    // Dimming the repeat lets the eye group them without a heading.
    const repeated = f.packageName === previousPackage;
    previousPackage = f.packageName;

    const meter =
      `<span class="meter" role="img" aria-label="${escape(`${t.severityRank} ${rank}/5`)}">` +
      Array.from({ length: 5 }, (_, i) => `<i${i < rank ? ' class="on"' : ""}></i>`).join("") +
      "</span>";

    return [
      `<details class="row sev--${escape(f.severity)}">`,
      "<summary>",
      `<span class="c-sev">${meter}<span class="sev-word">${escape(f.severity)}</span></span>`,
      `<span class="c-pkg${repeated ? " repeat" : ""}"><code>${escape(f.packageName)}</code>` +
        `<span class="tag">${escape(f.transitive ? t.indirect : t.direct)}</span></span>`,
      `<span class="c-adv"><code>${escape(f.advisoryId)}</code>` +
        `<span class="title">${escape(f.title)}</span></span>`,
      `<span class="c-fix"><code>${escape(f.fixedIn ?? "—")}</code>` +
        (f.fixedIn === undefined ? `<span class="quiet">${escape(t.noFix)}</span>` : "") +
        "</span>",
      `<span class="c-num">${escape(String(entry.score))}</span>`,
      `<span class="c-src">${f.tools.map((tool) => `<code>${escape(tool)}</code>`).join(" ")}</span>`,
      "</summary>",
      reasons(entry.reasons, f, byFingerprint, t),
      "</details>",
    ].join("");
  });

  return [
    '<section class="ledger">',
    `<h2>${escape(t.ledger)}</h2>`,
    `<p class="how">${escape(t.ledgerHow)}</p>`,
    '<div class="headrow">',
    `<span>${escape(t.colSeverity)}</span>`,
    `<span>${escape(t.colPackage)}</span>`,
    `<span>${escape(t.colAdvisory)}</span>`,
    `<span>${escape(t.colFixedIn)}</span>`,
    `<span class="c-num">${escape(t.colScore)}</span>`,
    `<span>${escape(t.colSources)}</span>`,
    "</div>",
    rows.join(""),
    weights(t),
    "</section>",
  ].join("\n");
}

function reasons(
  entries: readonly Reason[],
  finding: MergedFinding,
  byFingerprint: ReadonlyMap<string, MergedFinding>,
  t: ReturnType<typeof messagesFor>,
): string {
  const lines = entries.map(
    (reason) =>
      `<li><span class="num">${escape(String(reason.points))}</span>${escape(t.reasonText(reason))}</li>`,
  );

  const extras: string[] = [
    `<li><span class="num"></span>${escape(t.range)}: <code>${escape(finding.vulnerableRange)}</code></li>`,
  ];

  if (finding.fixVersionsClaimed !== undefined && finding.fixedIn !== undefined) {
    extras.push(
      `<li><span class="num"></span>${escape(t.disagreedFix(finding.fixVersionsClaimed.join(", "), finding.fixedIn))}</li>`,
    );
  }
  if (finding.aliases.length > 1) {
    extras.push(
      `<li><span class="num"></span>${escape(t.alsoKnownAs)}: ${finding.aliases.map((alias) => `<code>${escape(alias)}</code>`).join(" ")}</li>`,
    );
  }
  if (finding.relatedTo.length > 0) {
    extras.push(
      `<li><span class="num"></span>${escape(t.maybeDuplicate)}: ${finding.relatedTo.map((fingerprint) => `<code>${escape(duplicateName(fingerprint, byFingerprint))}</code>`).join(" ")}</li>`,
    );
  }

  return `<ul class="reasons">${lines.join("")}${extras.join("")}</ul>`;
}

function duplicateName(
  fingerprint: string,
  byFingerprint: ReadonlyMap<string, MergedFinding>,
): string {
  const other = byFingerprint.get(fingerprint);
  if (other === undefined) return fingerprint;

  return `${other.advisoryId}${other.fixedIn === undefined ? "" : ` (fixed in ${other.fixedIn})`}`;
}

/**
 * Expose the ranking weights in an expandable table.
 */
function weights(t: ReturnType<typeof messagesFor>): string {
  const rows = [
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
  ] as [string, number][];

  return [
    '<details class="weights">',
    `<summary>${escape(t.weights)}</summary>`,
    "<ul>",
    ...rows.map(
      ([label, points]) =>
        `<li><span class="num">${escape(String(points))}</span>${escape(label)}</li>`,
    ),
    "</ul>",
    "</details>",
  ].join("");
}

function closing(result: JudgeResult, t: ReturnType<typeof messagesFor>): string {
  const parts: string[] = [];
  const { suppressed, noLongerReported } = result.applied;

  if (suppressed.length > 0) {
    parts.push(
      `<section class="quiet-block"><h2>${escape(t.accepted)}</h2><p>${escape(t.acceptedBody(suppressed.length))}</p></section>`,
    );
  }

  if (noLongerReported.length > 0) {
    parts.push(
      '<section class="quiet-block">' +
        `<h2>${escape(t.resolved)}</h2>` +
        `<p>${escape(t.resolvedBody(noLongerReported.length))}</p>` +
        "</section>",
    );
  }

  return parts.join("\n");
}

/**
 * Show each recorded run with its outstanding count and changes.
 */
const RUNS_SHOWN = 12;

function historyBlock(history: readonly Change[], t: ReturnType<typeof messagesFor>): string {
  const recent = history.slice(-RUNS_SHOWN);
  // Disclose the number of recorded runs outside the displayed window.
  const hidden = history.length - recent.length;
  const peak = Math.max(...recent.map((change) => change.entry.outstanding.length), 1);

  const rows = recent.map((change) => {
    const count = change.entry.outstanding.length;
    const width = Math.round((count / peak) * 100);
    const deltas = [
      change.appeared.length > 0
        ? `<span class="delta up">+${escape(String(change.appeared.length))}</span>`
        : "",
      change.gone.length > 0
        ? `<span class="delta down">−${escape(String(change.gone.length))}</span>`
        : "",
    ].join("");

    return (
      '<li class="run">' +
      `<span class="when"><time datetime="${escape(change.entry.at)}">${escape(change.entry.at.slice(0, 10))}</time></span>` +
      `<span class="bar"><span style="width:${escape(String(width))}%"></span></span>` +
      `<span class="run-count">${escape(String(count))}</span>` +
      `<span class="run-delta">${deltas}</span>` +
      "</li>"
    );
  });

  return [
    '<section class="history">',
    `<h2>${escape(t.history)}</h2>`,
    `<ol class="runs">${rows.join("")}</ol>`,
    hidden > 0
      ? `<p class="quiet small">${escape(t.historyOlder(hidden, history.length))}</p>`
      : "",
    `<p class="quiet small">${escape(t.historyNote)}</p>`,
    "</section>",
  ].join("\n");
}

function footer(options: HtmlOptions, t: ReturnType<typeof messagesFor>): string {
  return [
    '<footer class="bottom">',
    `<h2>${escape(t.reproduce)}</h2>`,
    `<p class="quiet">${escape(t.reproduceBody)}</p>`,
    `<pre class="snippet"><code>${escape(options.command ?? "zero-shelter judge --format html --output report.html")}</code></pre>`,
    `<p class="quiet">${escape(t.deterministic)}</p>`,
    "</footer>",
  ].join("\n");
}

/**
 * Escape untrusted scanner strings in both HTML text and attributes.
 */
function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const STYLE = `
:root {
  color-scheme: light;
  --paper: oklch(98.6% 0.004 85);
  --sheet: oklch(100% 0 0);
  --ink: oklch(24% 0.012 75);
  --ink-soft: oklch(48% 0.012 75);
  --ink-faint: oklch(56.5% 0.010 75);
  --rule: oklch(89% 0.008 75);
  --rule-strong: oklch(72% 0.010 75);
  --accent: oklch(52% 0.126 62);
  --accent-soft: oklch(94% 0.036 70);
  --mark: oklch(38% 0.020 75);
}
body:has(#dark:checked) {
  color-scheme: dark;
  --paper: oklch(17% 0.008 75);
  --sheet: oklch(20.5% 0.009 75);
  --ink: oklch(92% 0.008 80);
  --ink-soft: oklch(74% 0.010 80);
  --ink-faint: oklch(60% 0.010 80);
  --rule: oklch(31% 0.010 75);
  --rule-strong: oklch(45% 0.012 75);
  --accent: oklch(78% 0.122 68);
  --accent-soft: oklch(29% 0.040 68);
  --mark: oklch(80% 0.014 80);
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --paper: oklch(17% 0.008 75);
    --sheet: oklch(20.5% 0.009 75);
    --ink: oklch(92% 0.008 80);
    --ink-soft: oklch(74% 0.010 80);
    --ink-faint: oklch(60% 0.010 80);
    --rule: oklch(31% 0.010 75);
    --rule-strong: oklch(45% 0.012 75);
    --accent: oklch(78% 0.122 68);
    --accent-soft: oklch(29% 0.040 68);
    --mark: oklch(80% 0.014 80);
  }
  body:has(#dark:checked) {
    color-scheme: light;
    --paper: oklch(98.6% 0.004 85);
    --sheet: oklch(100% 0 0);
    --ink: oklch(24% 0.012 75);
    --ink-soft: oklch(48% 0.012 75);
    --ink-faint: oklch(56.5% 0.010 75);
    --rule: oklch(89% 0.008 75);
    --rule-strong: oklch(72% 0.010 75);
    --accent: oklch(52% 0.126 62);
    --accent-soft: oklch(94% 0.036 70);
    --mark: oklch(38% 0.020 75);
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
::selection { background: var(--accent-soft); color: var(--ink); }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Noto Sans KR", sans-serif;
  font-variant-numeric: tabular-nums;
}
code, pre, .num, .count-value { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
.theme-input { position: absolute; opacity: 0; pointer-events: none; }
.sheet {
  max-width: 1080px;
  margin: 0 auto;
  padding: 40px 28px 96px;
  background: var(--sheet);
  border-inline: 1px solid var(--rule);
  min-height: 100vh;
}
@media (max-width: 720px) { .sheet { padding: 28px 18px 64px; border: 0; } }

.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
h1 { margin: 0; font-size: 30px; font-weight: 620; letter-spacing: -0.015em; }
.sub { margin: 6px 0 0; color: var(--ink-soft); max-width: 62ch; }
h2 { font-size: 16px; font-weight: 640; color: var(--ink); margin: 0 0 10px; }

.theme {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  font-size: 12px; color: var(--ink-soft); border: 1px solid var(--rule);
  padding: 6px 11px; border-radius: 999px; white-space: nowrap;
  transition: border-color 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.theme:hover { border-color: var(--rule-strong); }
.theme .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--ink-faint); }
body:has(#dark:checked) .theme .dot { background: var(--accent); }
.theme-input:focus-visible + .sheet .theme { outline: 2px solid var(--accent); outline-offset: 2px; }

.counts { display: flex; flex-wrap: wrap; gap: 30px; margin: 30px 0 0; padding-block: 18px; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.count { display: flex; flex-direction: column; gap: 2px; }
.count-value { font-size: 21px; font-weight: 560; color: var(--ink-soft); }
.count--lead .count-value { font-size: 34px; font-weight: 620; color: var(--ink); letter-spacing: -0.02em; }
.count-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); }

.warning { border: 1px solid var(--accent); padding: 12px 14px; margin: 20px 0 0; }
.scanner-status { color: var(--ink-soft); font-size: 13px; margin: 20px 0 0; }
.warning p { margin: 0; color: var(--ink); font-size: 14px; }
.notes { margin: 18px 0 0; padding: 0; list-style: none; }
.notes li { color: var(--ink-soft); font-size: 13px; padding-inline-start: 16px; position: relative; margin-block: 5px; }
.notes li::before { content: "·"; position: absolute; inset-inline-start: 4px; color: var(--ink-faint); }

.verdict { margin: 34px 0 0; font-size: 19px; max-width: 62ch; }

.how { margin: 0 0 14px; color: var(--ink-soft); font-size: 13px; max-width: 74ch; }
.glossary { margin-top: 14px; }
.glossary dl { margin: 10px 0 0; display: grid; gap: 8px; }
.term { display: grid; grid-template-columns: 152px minmax(0, 1fr); gap: 14px; font-size: 13px; }
.term dt { color: var(--ink); }
.term dd { margin: 0; color: var(--ink-soft); }
@media (max-width: 700px) { .term { grid-template-columns: 1fr; gap: 2px; } }

.action-paths { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; margin-top: 34px; }
.action-paths > section { min-width: 0; }
@media (max-width: 760px) { .action-paths { grid-template-columns: 1fr; gap: 28px; } }
.prompts { max-width: 82ch; }
.prompt-list { list-style: none; margin: 0; padding: 0; }
.prompt { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--rule); }
.prompt p { margin: 0; flex: 1 1 240px; overflow-wrap: anywhere; max-width: 68ch; font-size: 13.5px; color: var(--ink); }
.prompt .copy { flex: none; margin-top: 1px; }

.act { min-width: 0; }
.commands { list-style: none; margin: 0; padding: 0; }
.command { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; padding: 11px 16px 11px 0; border-bottom: 1px solid var(--rule); }
.command code { font-size: 14px; color: var(--ink); overflow-wrap: anywhere; min-width: 0; }
.command--lead { padding-inline: 16px; background: var(--accent-soft); border-bottom-color: transparent; margin-bottom: 4px; }
.command--lead code { font-size: 15px; font-weight: 560; letter-spacing: -0.01em; }
.clears { font-size: 12px; color: var(--ink-soft); }
.command--lead .clears { color: var(--accent); font-weight: 560; }
.copy {
  margin-inline-start: auto; font: inherit; font-size: 12px; color: var(--ink-soft);
  background: transparent; border: 1px solid var(--rule-strong); border-radius: 4px;
  padding: 4px 10px; cursor: pointer;
  transition: color 180ms cubic-bezier(0.22, 1, 0.36, 1), border-color 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.copy:hover { color: var(--ink); border-color: var(--ink-soft); }
.copy:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.caveat { margin: 10px 0 0; font-size: 13px; color: var(--ink-soft); max-width: 74ch; }
.quiet { color: var(--ink-soft); }

.indirect { margin-top: 34px; max-width: 78ch; }
.indirect p { margin: 0 0 8px; }
.snippet { margin: 10px 0 0; padding: 14px 16px; background: var(--paper); border: 1px solid var(--rule); overflow-x: auto; font-size: 13px; line-height: 1.5; }

.ledger { margin-top: 48px; }
.headrow, .row > summary {
  display: grid;
  grid-template-columns: 92px 168px minmax(0, 1fr) 104px 56px 148px;
  gap: 16px;
  align-items: baseline;
}
.headrow { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); padding-bottom: 8px; border-bottom: 1px solid var(--rule-strong); }
.row { border-bottom: 1px solid var(--rule); font-size: 14px; }
.row > summary { padding: 10px 0; cursor: pointer; list-style: none; }
.row > summary::-webkit-details-marker { display: none; }
.row > summary:hover { background: var(--paper); }
.row > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.c-sev { white-space: nowrap; }
.sev-word { display: block; font-size: 12px; color: var(--ink-soft); margin-top: 4px; }
.meter { display: inline-flex; gap: 2px; }
.meter i { display: inline-block; width: 6px; height: 13px; background: var(--rule-strong); }
.meter i.on { background: var(--mark); }
/* Filled blocks and the severity label retain rank without color. */
.sev--critical .meter i.on { background: var(--accent); }
.c-pkg code { font-size: 14px; }
.row > summary > span, .reasons li { min-width: 0; overflow-wrap: anywhere; }
.c-pkg.repeat code { color: var(--ink-faint); }
.tag { display: block; font-size: 11px; color: var(--ink-faint); margin-top: 3px; }
.c-adv code { font-size: 12px; color: var(--ink-soft); }
.title { display: block; margin-top: 3px; }
.c-fix code { font-size: 13px; }
.c-fix .quiet { display: block; font-size: 11px; }
.c-num { text-align: end; font-variant-numeric: tabular-nums; }
.c-src code { font-size: 11px; color: var(--ink-soft); }
.row .reasons { margin: 0 0 14px; padding-inline-start: 108px; }
@media (max-width: 900px) {
  .headrow { display: none; }
  .row > summary { grid-template-columns: 92px minmax(0, 1fr) 56px; row-gap: 6px; }
  .c-pkg { grid-column: 2; grid-row: 1; }
  .c-adv, .c-fix, .c-src { grid-column: 2 / -1; }
  .c-num { grid-column: 3; grid-row: 1; }
  .row .reasons { padding-inline-start: 0; }
}

details summary { cursor: pointer; font-size: 12px; color: var(--ink-faint); padding: 2px 0; }
details summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
details[open] summary { color: var(--ink-soft); }
.reasons, .weights ul { list-style: none; margin: 8px 0 12px; padding: 0; font-size: 13px; }
.reasons li, .weights li { display: flex; flex-wrap: wrap; gap: 12px; padding: 2px 0; color: var(--ink-soft); }
.reasons .num, .weights .num { min-width: 34px; text-align: end; color: var(--ink); }
.weights { margin-top: 18px; }

.history { margin-top: 44px; max-width: 78ch; }
.runs { list-style: none; margin: 0; padding: 0; }
.run { display: grid; grid-template-columns: 92px minmax(0, 1fr) 44px 72px; gap: 14px; align-items: center; padding: 5px 0; font-size: 13px; }
.when { color: var(--ink-faint); font-variant-numeric: tabular-nums; }
.bar { background: var(--paper); height: 14px; border: 1px solid var(--rule); }
.bar > span { display: block; height: 100%; background: var(--mark); }
.run:last-child .bar > span { background: var(--accent); }
.run-count { text-align: end; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.run-delta { display: flex; gap: 8px; font-size: 12px; }
.delta.up { color: var(--ink); }
.delta.down { color: var(--ink-faint); }
.small { font-size: 12px; margin-top: 12px; }

.quiet-block { margin-top: 40px; max-width: 74ch; }
.quiet-block p { margin: 0 0 6px; color: var(--ink-soft); }

.bottom { margin-top: 64px; padding-top: 26px; border-top: 1px solid var(--rule); max-width: 78ch; }
.stamp { margin: 12px 0 0; font-size: 12px; color: var(--ink-faint); }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`.trim();

// Copy from local files using the clipboard API, then execCommand, then
// text selection. Commands remain selectable with JavaScript disabled.
const SCRIPT = `<script>
document.querySelectorAll(".copy").forEach(function (button) {
  button.addEventListener("click", function () {
    var text = button.getAttribute("data-copy");
    var done = function () {
      var label = button.textContent;
      button.textContent = button.getAttribute("data-copied");
      setTimeout(function () { button.textContent = label; }, 1200);
    };

    var legacy = function () {
      var field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      var copied = false;
      try { copied = document.execCommand("copy"); } catch (error) { copied = false; }
      document.body.removeChild(field);
      if (copied) { done(); return; }

      var source = button.parentElement.querySelector("code, p") || button.parentElement;
      var range = document.createRange();
      range.selectNodeContents(source);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = button.getAttribute("data-select");
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, legacy);
    } else {
      legacy();
    }
  });
});
</script>`;
