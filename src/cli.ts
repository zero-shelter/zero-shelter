import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  BASELINE_PATH,
  baselineFrom,
  emptyBaseline,
  type BaselineNote,
  parseBaseline,
  serializeBaseline,
} from "./baseline.js";
import { judge } from "./judge.js";
import type { JudgeResult } from "./report.js";
import { parseNpmAudit } from "./ingest/npm-audit.js";
import { parseOsv } from "./ingest/osv.js";
import { collect, declaredDependencies, isWorkspaceRoot } from "./scan.js";
import { cwdFromPayload, hookContext, hookOutput, readStdin } from "./hook.js";
import { readInstalledVersions } from "./lockfile.js";
import { detectPackageManager } from "./package-manager.js";
import { colorEnabled, renderExplain, renderHuman, renderJson } from "./report.js";
import { renderHtml } from "./html.js";
import { isLanguage } from "./messages.js";
import { renderSarif } from "./sarif.js";
import {
  HISTORY_PATH,
  type Change,
  appendEntry,
  changes,
  entryFrom,
  parseHistory,
  serializeEntry,
  stale,
} from "./history.js";
import type { ScaFinding } from "./finding.js";
import { versionOutput } from "./version.js";
import { unscannedScope } from "./scope.js";

const USAGE = `zero-shelter judge — review dependency scanner findings

First run
  npx zero-shelter judge [options]

  --input <file>        read scanner output instead of running scanners.
                        Repeatable. Format is detected from the contents.
  --cwd <dir>           project directory (default .)
  --top <n>             report at most n findings

Save and inspect results
  --format <fmt>        text (default) | json | sarif | html
  --json                shorthand for --format json
  --output <file>       write to a file instead of stdout
  --lang <code>         language for the html report: en (default) | ko
  --stamp <text>        optional text in the html report
  --explain             show how each score was reached
  --no-color            disable ANSI colors in text output

Baseline and history
  --baseline <file>     baseline location (default ${BASELINE_PATH})
  --update-baseline     accept current findings and exit 0. Review risk first.
  --record              append this run to .zero-shelter/history.jsonl

  npx zero-shelter history [--json] [--last <n>]
  Show findings added or no longer reported between recorded runs.

Agent integration
  npx zero-shelter hook [--input <file>]
  Print findings as agent context for editors with a prompt hook.
  Errors produce no context and exit 0. See docs/AGENT-HOOK.md.

  --version             print the installed package version
  --help                print this help

Judge exit codes: 0 = no new findings; 1 = new findings; 2 = could not judge.
Exit 0 does not mean every vulnerability is resolved.
`;

export const renderSkippedNotes = (skipped: readonly string[]): string =>
  skipped.length === 0 ? "" : skipped.map((note) => `  ${note}\n`).join("") + "\n";

export async function main(argv: readonly string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        input: { type: "string", multiple: true },
        format: { type: "string" },
        lang: { type: "string" },
        stamp: { type: "string" },
        output: { type: "string" },
        json: { type: "boolean" },
        explain: { type: "boolean" },
        top: { type: "string" },
        "update-baseline": { type: "boolean" },
        record: { type: "boolean" },
        last: { type: "string" },
        baseline: { type: "string" },
        cwd: { type: "string" },
        "no-color": { type: "boolean" },
        version: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }

  const { values, positionals } = parsed;

  if (values.help === true || positionals[0] === "help") {
    process.stdout.write(USAGE);
    return 0;
  }

  if (values.version === true || positionals[0] === "version") {
    process.stdout.write(versionOutput());
    return 0;
  }

  const command = positionals[0] ?? "judge";
  if (command === "hook") return await hook(values.cwd, values.baseline, values.input);
  if (command === "history") {
    return await history(resolve(values.cwd ?? "."), values.json === true, values.last);
  }
  if (command !== "judge") {
    process.stderr.write(`unknown command: ${command}\n\n${USAGE}`);
    return 2;
  }

  const top = parseTop(values.top);
  if (top instanceof Error) {
    process.stderr.write(`${top.message}\n`);
    return 2;
  }

  const format = values.format ?? (values.json === true ? "json" : "text");
  if (format !== "text" && format !== "json" && format !== "sarif" && format !== "html") {
    process.stderr.write(`--format expects text, json, sarif or html, got ${format}\n`);
    return 2;
  }

  const language = values.lang ?? "en";
  if (!isLanguage(language)) {
    process.stderr.write(`--lang expects en or ko, got ${language}\n`);
    return 2;
  }

  const cwd = resolve(values.cwd ?? ".");
  const baselinePath = resolve(cwd, values.baseline ?? BASELINE_PATH);

  let findings: ScaFinding[];
  let skipped: string[];
  let sources: string[] | undefined;

  try {
    if (values.input !== undefined && values.input.length > 0) {
      findings = [];
      skipped = [];
      for (const file of values.input) {
        findings.push(...(await readInput(resolve(cwd, file), declaredDependencies(cwd))));
      }
      // With --input the files are the sources, and which tool wrote each one
      // is only knowable from what it contains.
      sources = [
        ...new Set(findings.flatMap((finding) => finding.sources.map((s) => s.tool))),
      ].sort();
    } else {
      const collected = await collect({ cwd });
      findings = collected.findings;
      skipped = collected.skipped;
      sources = collected.contributed;

      // No readable scanner report: exit 2 rather than claiming a clean scan.
      if (collected.contributed.length === 0) {
        process.stderr.write(
          `cannot judge ${cwd}: no scanner produced a report\n` +
            collected.skipped.map((note) => `  ${note}\n`).join("") +
            "nothing was scanned, so this is not a pass\n",
        );
        return 2;
      }
    }
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 2;
  }

  let baseline;
  let baselineExists = true;
  try {
    const loaded = await loadBaseline(baselinePath, (note) => process.stderr.write(`${note}\n`));
    baseline = loaded.baseline;
    baselineExists = loaded.exists;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 2;
  }

  const installed = readInstalledVersions(cwd);
  // Injected rather than read inside the judgement, the same rule history
  // follows: an acceptance that expires today must not make the same input
  // produce a different answer depending on when it ran.
  const today = new Date().toISOString().slice(0, 10);
  const result = judge(findings, {
    today,
    packageManager: detectPackageManager(cwd),
    baseline,
    baselineExists,
    skipped,
    workspaceRoot: isWorkspaceRoot(cwd),
    ...(installed === undefined ? {} : { installed }),
    ...(sources === undefined ? {} : { sources }),
    ...(top === undefined ? {} : { top }),
    unscanned: unscannedScope(cwd),
  });

  if (values["update-baseline"] === true) {
    // Same treatment as --output: a failed write here is a permissions or path
    // problem, and a stack trace is a worse way to learn that.
    // Record everything currently present, not just what survived the ratchet,
    // so re-running immediately afterwards reports nothing new.
    const all = judge(findings, { baseline: emptyBaseline() });
    try {
      await mkdir(dirname(baselinePath), { recursive: true });
      await writeFile(
        baselinePath,
        serializeBaseline(baselineFrom(all.fixNow, sources, today, baseline, installed)),
        "utf8",
      );
    } catch (error) {
      process.stderr.write(`cannot write ${baselinePath}: ${reasonFor(error)}\n`);
      return 2;
    }
    const recordedSources = sources?.join(", ") ?? "unknown sources";
    process.stdout.write(
      renderSkippedNotes(skipped) +
        `recorded ${all.fixNow.length} finding(s) from ${recordedSources} ` +
        `as accepted in ${values.baseline ?? BASELINE_PATH}\n`,
    );
    return 0;
  }

  let rendered: string;
  if (format === "json") {
    rendered = renderJson(result);
  } else if (format === "sarif") {
    rendered = renderSarif(result);
  } else if (format === "html") {
    rendered = renderHtml(result, {
      language,
      ...(await recordedRuns(cwd)),
      ...(values.stamp === undefined ? {} : { stamp: values.stamp }),
      command: `zero-shelter ${argv.join(" ")}`,
    });
  } else {
    // Colour is decided by where this is going. Writing to a file always means
    // no escape codes, whatever the terminal says.
    const color =
      values["no-color"] !== true &&
      values.output === undefined &&
      colorEnabled(process.env, process.stdout.isTTY === true);
    rendered =
      `${renderHuman(result, color)}\n` +
      (values.explain === true ? `\n${renderExplain(result)}\n` : "");
  }

  // A history write failure is a warning; it does not invalidate the judgement.
  const recordFailure = values.record === true ? await record(cwd, result) : undefined;
  if (recordFailure !== undefined) process.stderr.write(`${recordFailure}\n`);

  if (values.output === undefined) {
    process.stdout.write(rendered);
  } else {
    const target = resolve(cwd, values.output);
    try {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, rendered, "utf8");
    } catch (error) {
      process.stderr.write(`cannot write ${target}: ${reasonFor(error)}\n`);
      return 2;
    }
  }

  return result.fixNow.length > 0 ? 1 : 0;
}

/**
 * The part of a filesystem error worth showing.
 *
 * Node's message repeats the syscall and the path we already printed; the code
 * is the part that says what to do about it.
 */
function reasonFor(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code;
  switch (code) {
    case "EACCES":
    case "EPERM":
      return "permission denied";
    case "ENOENT":
      return "a directory in that path does not exist";
    case "ENOSPC":
      return "no space left on device";
    case "EROFS":
      return "read-only filesystem";
    case "EISDIR":
      return "that is a directory";
    case "ENOTDIR":
      return "a component of that path is not a directory";
    default:
      return code ?? (error as Error).message;
  }
}

function parseTop(raw: string | undefined): number | undefined | Error {
  if (raw === undefined) return undefined;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    return new Error(`--top expects a positive integer, got ${raw}`);
  }
  return value;
}

/**
 * Detect the format from the contents rather than the filename.
 *
 * People name these files anything, and guessing from `.json` tells us nothing.
 * Both shapes have an unambiguous top-level key.
 */
async function readInput(
  path: string,
  declared: ReadonlySet<string> | undefined,
): Promise<ScaFinding[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    // Include the filesystem error code to distinguish missing paths, directories
    // and permission failures.
    throw new Error(`cannot read ${path}: ${reasonFor(error)}`);
  }

  let probe: unknown;
  try {
    probe = JSON.parse(raw);
  } catch {
    throw new Error(`${path} is not valid JSON`);
  }

  if (typeof probe !== "object" || probe === null) {
    throw new Error(`${path} is not a scanner report`);
  }

  const record = probe as Record<string, unknown>;
  if ("vulnerabilities" in record || "advisories" in record) return parseNpmAudit(raw, declared);
  if ("results" in record) return parseOsv(raw, undefined, declared);

  // People reach for the file this tool just wrote. Saying "unrecognised" to
  // our own output format is a needlessly puzzling answer to a reasonable move.
  if ("runs" in record && typeof record["version"] === "string") {
    throw new Error(
      `${path} is SARIF, which is what this tool writes rather than reads. ` +
        "Pass the scanner report instead (npm audit --json, osv-scanner --format json).",
    );
  }

  throw new Error(
    `${path}: unrecognised report. Expected npm audit (vulnerabilities) or osv-scanner (results).`,
  );
}

/**
 * Recorded runs for the report, or nothing when none were recorded.
 *
 * Reading this must never be able to fail a judgement: an unreadable history
 * costs the page one section.
 */
async function recordedRuns(cwd: string): Promise<{ history?: Change[] }> {
  try {
    const raw = await readFile(resolve(cwd, HISTORY_PATH), "utf8");
    const { entries } = parseHistory(raw);
    return entries.length === 0 ? {} : { history: changes(entries) };
  } catch {
    return {};
  }
}

/**
 * Append one line describing this run.
 *
 * Returns a message when it could not, rather than throwing: a history that
 * cannot be written is worth saying out loud, but it is not a reason to
 * discard a judgement someone is waiting for.
 */
async function record(cwd: string, result: JudgeResult): Promise<string | undefined> {
  const path = resolve(cwd, HISTORY_PATH);
  try {
    await mkdir(dirname(path), { recursive: true });
    // Timestamp the recorded run here; the history renderer receives the value.
    await appendEntry(path, entryFrom(result, new Date().toISOString()));
    return undefined;
  } catch (error) {
    return `cannot write ${path}: ${reasonFor(error)}`;
  }
}

/**
 * `zero-shelter history` — what happened, in the order it happened.
 */
async function history(cwd: string, asJson: boolean, last: string | undefined): Promise<number> {
  const path = resolve(cwd, HISTORY_PATH);

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      process.stderr.write(
        `no history at ${path}\n` +
          "Run `zero-shelter judge --record` to start one. Nothing is recorded unless asked.\n",
      );
      return 2;
    }
    process.stderr.write(`cannot read ${path}: ${reasonFor(error)}\n`);
    return 2;
  }

  const { entries, unreadable } = parseHistory(raw);
  if (entries.length === 0) {
    process.stderr.write(`${path} has no readable entries\n`);
    return 2;
  }

  const limit = last === undefined ? entries.length : Number(last);
  if (!Number.isInteger(limit) || limit < 1) {
    process.stderr.write(`--last expects a positive integer, got ${last}\n`);
    return 2;
  }

  const all = changes(entries);
  const shown = all.slice(Math.max(0, all.length - limit));

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        {
          entries: entries.length,
          unreadable,
          staleSchema: stale(entries),
          runs: shown.map((change) => ({
            at: change.entry.at,
            raw: change.entry.raw,
            merged: change.entry.merged,
            outstanding: change.entry.outstanding.length,
            accepted: change.entry.accepted,
            appeared: change.appeared.length,
            gone: change.gone.length,
            sources: change.entry.sources,
          })),
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }

  const lines = shown.map((change) => {
    const deltas = [
      change.appeared.length > 0 ? `+${change.appeared.length}` : "",
      change.gone.length > 0 ? `-${change.gone.length}` : "",
    ]
      .filter((part) => part !== "")
      .join(" ");

    return (
      `  ${change.entry.at}  ` +
      `${change.entry.raw} reported → ${change.entry.merged} after merge → ` +
      `${String(change.entry.outstanding.length).padStart(4)} outstanding  ` +
      `${deltas.padEnd(9)}` +
      `${change.entry.accepted} accepted (baseline entries matched)`
    ).trimEnd();
  });

  process.stdout.write(`${lines.join("\n")}\n`);

  if (unreadable > 0) {
    process.stdout.write(
      `  ${unreadable} line(s) could not be read and were skipped. An interrupted write leaves one.\n`,
    );
  }
  const outdated = stale(entries);
  if (outdated > 0) {
    process.stdout.write(
      `  ${outdated} entry(s) predate the current fingerprint schema; their appeared/gone counts are not comparable.\n`,
    );
  }

  return 0;
}

/**
 * `zero-shelter hook` — hand the current judgement to a coding agent.
 *
 * Wrapped in a catch-everything because this runs inside someone's editor
 * session: see the note in hook.ts. Exit code is always 0.
 */
async function hook(
  cwdFlag: string | undefined,
  baselineFlag: string | undefined,
  inputs: readonly string[] | undefined,
): Promise<number> {
  try {
    const cwd = resolve(
      cwdFlag ?? cwdFromPayload(await readStdin(process.stdin), process.cwd()),
    );

    // Support stored reports for repeatable hook checks without live scanners.
    let findings: ScaFinding[];
    let skipped: string[] = [];
    if (inputs !== undefined && inputs.length > 0) {
      findings = [];
      for (const file of inputs) findings.push(...(await readInput(resolve(cwd, file), declaredDependencies(cwd))));
    } else {
      const collected = await collect({ cwd });
      findings = collected.findings;
      skipped = collected.skipped;
    }
    // A project that keeps its baseline somewhere else was being handed its
    // whole backlog as if none of it had been accepted, every prompt.
    const { baseline, exists } = await loadBaseline(
      resolve(cwd, baselineFlag ?? BASELINE_PATH),
    );
    // Use lockfile facts for hook advice just as for the human report.
    const installed = readInstalledVersions(cwd);
    const context = hookContext(
      judge(findings, {
        baseline,
        baselineExists: exists,
        skipped,
        packageManager: detectPackageManager(cwd),
        workspaceRoot: isWorkspaceRoot(cwd),
        // Use the same expiry date as judge so hook context includes expired findings.
        today: new Date().toISOString().slice(0, 10),
        ...(installed === undefined ? {} : { installed }),
        unscanned: unscannedScope(cwd),
      }),
    );
    if (context !== undefined) process.stdout.write(hookOutput(context));
  } catch {
    // Deliberately silent — see hook.ts.
  }
  return 0;
}

async function loadBaseline(path: string, onNote?: BaselineNote) {
  try {
    return { baseline: parseBaseline(await readFile(path, "utf8"), path, onNote), exists: true };
  } catch (error) {
    // Include the baseline path in parse errors.
    if (error instanceof SyntaxError) {
      throw new Error(`${path} is not valid JSON: ${error.message}`);
    }
    // A missing baseline is a first run; an unreadable baseline is an error.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { baseline: emptyBaseline(), exists: false };
    }
    throw error;
  }
}
