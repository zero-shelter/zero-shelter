/**
 * Collecting scanner output.
 *
 * `npm audit` always runs, because a project with a lockfile already has npm
 * and demanding an install before the first result is how a tool loses its only
 * chance. Everything else is used when it happens to be present and skipped
 * with a note when it is not.
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ScaFinding } from "./finding.js";
import { parseNpmAudit } from "./ingest/npm-audit.js";
import { parseOsv } from "./ingest/osv.js";

const run = promisify(execFile);

/**
 * Whether this directory is the root of a workspace.
 *
 * It changes what the upgrade commands mean: `npm i x@1` run here adds a root
 * dependency, while the package that declares the vulnerable range keeps
 * declaring it. Hoisting means the audit output cannot tell us which workspace
 * that is — every path comes back as `node_modules/x` — so the report says the
 * command needs a `-w` rather than guessing which one.
 */
export function isWorkspaceRoot(cwd: string): boolean {
  if (existsSync(join(cwd, "pnpm-workspace.yaml"))) return true;

  try {
    const manifest: unknown = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    if (typeof manifest !== "object" || manifest === null) return false;
    const { workspaces } = manifest as { workspaces?: unknown };
    return Array.isArray(workspaces) ? workspaces.length > 0 : workspaces !== undefined;
  } catch {
    return false;
  }
}

export interface Collected {
  readonly findings: ScaFinding[];
  /** Human-readable notes about sources that did not contribute. */
  readonly skipped: string[];
  /**
   * Tools that produced a report we could read.
   *
   * Empty means nothing was scanned — which is not the same as finding
   * nothing, and the caller has to be able to tell those apart.
   */
  readonly contributed: string[];
}

/**
 * Runs a command and resolves to its stdout, or `undefined` when the command
 * does not exist.
 *
 * Injectable so the failure modes — absent tool, non-zero exit, empty output —
 * can be driven in tests without installing scanners or depending on what a CI
 * image happens to have. These paths are the ones most likely to differ between
 * platforms and least likely to be exercised by accident.
 */
export type Capture = (
  command: string,
  args: readonly string[],
  options: ScanOptions,
) => Promise<CaptureOutcome>;

/**
 * Absent, timed out and failed are three different facts about a scanner, and
 * they were two messages.
 *
 * A scanner killed at our own bound reported "produced no report", which reads
 * as the scanner's fault. On Windows any failure without stdout reported "not
 * on PATH", which sent someone to install a tool they already had. Both then
 * left the run with one source and an exit code of 0.
 */
export type CaptureOutcome =
  | { readonly ok: true; readonly stdout: string }
  | {
      readonly ok: false;
      readonly why: "absent" | "timeout" | "failed";
      readonly detail?: string;
      /**
       * The exit code, when the process got far enough to have one.
       *
       * Carried rather than interpreted: what a code means is the scanner's
       * business, not ours. osv-scanner reserves 128 for "no package sources
       * found", and only `runOsvScanner` knows that.
       */
      readonly exitCode?: number;
    };

export interface ScanOptions {
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly capture?: Capture;
}

const DEFAULT_TIMEOUT_MS = 120_000;
// Scanner output on a large monorepo is big; the default 1MB buffer truncates
// it into a JSON parse error that looks like a parser bug.
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

export async function collect(options: ScanOptions): Promise<Collected> {
  const findings: ScaFinding[] = [];
  const skipped: string[] = [];
  const contributed: string[] = [];

  // Which audit to run is decided by the lockfile in front of us. `npm audit`
  // needs a package-lock.json and fails with ENOLOCK in a pnpm project, which
  // used to leave a pnpm user with "nothing was scanned" and a tool that claims
  // in its README to read their reports.
  const audit = existsSync(join(options.cwd, "pnpm-lock.yaml"))
    ? await runPnpmAudit(options)
    : await runNpmAudit(options);
  if (audit.ok) {
    // A scanner that produced output we cannot read is worth saying out loud.
    // Swallowing it would silently drop a whole source and still look like a
    // clean run.
    try {
      findings.push(...parseNpmAudit(audit.stdout));
      contributed.push(audit.tool ?? "npm audit");
    } catch (error) {
      skipped.push(`${audit.tool ?? "npm audit"} output unreadable: ${(error as Error).message}`);
    }
  } else {
    skipped.push(`${audit.tool ?? "npm audit"} skipped: ${audit.reason}`);
  }

  const osv = await runOsvScanner(options);
  if (osv.ok) {
    try {
      findings.push(...parseOsv(osv.stdout, osv.version));
      contributed.push("osv-scanner");
    } catch (error) {
      skipped.push(`osv-scanner output unreadable: ${(error as Error).message}`);
    }
  } else {
    skipped.push(`osv-scanner skipped: ${osv.reason}`);
  }

  // Decided after both scanners have run, not before: osv-scanner reads
  // yarn.lock perfectly well, and this note used to print underneath a
  // successful scan telling the reader we could not read their project.
  if (contributed.length === 0 && existsSync(join(options.cwd, "yarn.lock"))) {
    skipped.push(
      "yarn.lock found and nothing could read it. yarn v1 writes NDJSON, which " +
        "this tool does not parse. osv-scanner reads yarn.lock, so installing it " +
        "is the shortest way out. Or generate a package-lock.json with " +
        "`npm i --package-lock-only`",
    );
  }

  return { findings, skipped, contributed };
}

type Attempt =
  | { ok: true; stdout: string; version?: string; tool?: string }
  | { ok: false; reason: string; tool?: string };

/**
 * `npm audit` exits non-zero whenever it finds anything, which is the normal
 * case. Only a missing or unreadable report is a failure.
 */
async function runNpmAudit(options: ScanOptions): Promise<Attempt> {
  const run = options.capture ?? capture;
  const outcome = await run("npm", ["audit", "--json"], options);
  if (!outcome.ok) return { ok: false, reason: whyOf("npm", outcome) };
  const { stdout } = outcome;
  if (stdout.trim() === "") return { ok: false, reason: "npm produced no report" };

  // npm reports its own failures as JSON with an `error` envelope — no
  // lockfile, a private registry it cannot reach, a workspace it cannot
  // resolve. Passing that to the parser turns npm's clear explanation into
  // "output has neither vulnerabilities nor advisories", which sends people
  // looking for a bug in us.
  const explained = npmError(stdout);
  if (explained !== undefined) return { ok: false, reason: explained };

  return { ok: true, stdout };
}

function npmError(stdout: string): string | undefined {
  let report: unknown;
  try {
    report = JSON.parse(stdout);
  } catch {
    return undefined;
  }

  if (typeof report !== "object" || report === null || !("error" in report)) return undefined;

  const { error } = report as { error?: unknown };
  if (typeof error !== "object" || error === null) return undefined;

  const { summary, detail, code } = error as Record<string, unknown>;
  const said = [summary, detail]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (said !== "") return said;
  return typeof code === "string" ? `npm reported ${code}` : "npm reported an error";
}

/**
 * One sentence for a scanner that did not produce a report.
 *
 * "Absent" earns install advice; the other two must not, because telling
 * someone to install a tool they already have is how a real failure gets
 * mistaken for a missing dependency.
 */
function whyOf(tool: string, outcome: { why: "absent" | "timeout" | "failed"; detail?: string }): string {
  if (outcome.why === "absent") return `${tool} is not available`;
  if (outcome.why === "timeout") {
    return `${tool} timed out — ${outcome.detail ?? "no answer in time"}. It is installed and did not finish`;
  }
  return `${tool} failed: ${outcome.detail ?? "no output"}. It is installed and did not produce a report`;
}

/**
 * pnpm reports in the older `advisories` shape, which the npm parser already
 * reads — so this is a different process to spawn, not a different format to
 * support.
 */
async function runPnpmAudit(options: ScanOptions): Promise<Attempt> {
  const run = options.capture ?? capture;
  const outcome = await run("pnpm", ["audit", "--json"], options);

  if (!outcome.ok) {
    return {
      ok: false,
      tool: "pnpm audit",
      reason:
        outcome.why === "absent"
          ? "pnpm-lock.yaml is here but pnpm is not on PATH"
          : whyOf("pnpm", outcome),
    };
  }
  const { stdout } = outcome;
  if (stdout.trim() === "") {
    return { ok: false, tool: "pnpm audit", reason: "pnpm produced no report" };
  }

  const explained = npmError(stdout);
  if (explained !== undefined) return { ok: false, tool: "pnpm audit", reason: explained };

  return { ok: true, stdout, tool: "pnpm audit" };
}

/** osv-scanner's exit code for a tree with no package source in it. */
const NOTHING_TO_SCAN = 128;

async function runOsvScanner(options: ScanOptions): Promise<Attempt> {
  const run = options.capture ?? capture;
  const outcome = await run(
    "osv-scanner",
    ["--format", "json", "--recursive", options.cwd],
    options,
  );

  // 128 is osv-scanner's own code for "no package sources found" — an empty
  // lockfile, or a tree holding nothing it can read. It ran and it had nothing
  // to say, which is the fourth outcome after absent, timed out and failed.
  // Reporting it as a failure opened a new project's first run by telling the
  // reader their scanner was broken.
  if (!outcome.ok && outcome.exitCode === NOTHING_TO_SCAN) {
    return { ok: false, reason: "found no package it could scan in this tree" };
  }
  if (!outcome.ok && outcome.why !== "absent") {
    return { ok: false, reason: whyOf("osv-scanner", outcome) };
  }
  if (!outcome.ok) {
    // Cross-source reconciliation is where most of the noise reduction comes
    // from, so "optional" undersells it — but telling someone to go install
    // something without saying how is how a suggestion becomes a chore.
    return {
      ok: false,
      reason:
        "not on PATH. Most of the deduplication comes from having a second " +
        "source: brew install osv-scanner, or " +
        "https://github.com/google/osv-scanner/releases",
    };
  }
  const { stdout } = outcome;
  if (stdout.trim() === "") return { ok: false, reason: "produced no report" };

  const version = await run("osv-scanner", ["--version"], options);
  const parsed = version.ok ? version.stdout.match(/\d+\.\d+\.\d+/)?.[0] : undefined;

  return parsed === undefined
    ? { ok: true, stdout }
    : { ok: true, stdout, version: parsed };
}

/**
 * Run a command and return stdout, or undefined when the tool is absent.
 *
 * A non-zero exit is not treated as absence: scanners report findings that way.
 * Only ENOENT — and on Windows a shell that cannot resolve the name — means the
 * tool is not installed.
 */
export async function capture(
  command: string,
  args: readonly string[],
  options: ScanOptions,
): Promise<CaptureOutcome> {
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const { stdout } = await run(command, [...args], {
      cwd: options.cwd,
      timeout,
      maxBuffer: MAX_OUTPUT_BYTES,
      // npm and osv-scanner ship as .cmd shims on Windows, which execFile
      // cannot invoke without a shell.
      shell: process.platform === "win32",
    });
    return { ok: true, stdout };
  } catch (error) {
    return classify(error as SpawnFailure, timeout, process.platform === "win32");
  }
}

/** What `execFile` rejects with, in the fields that decide the answer. */
export interface SpawnFailure {
  readonly code?: string | number | null | undefined;
  readonly killed?: boolean | undefined;
  readonly signal?: string | null | undefined;
  readonly stdout?: string | undefined;
  readonly stderr?: string | undefined;
}

/**
 * Which of the three answers a failed spawn is.
 *
 * Separated from `capture` so the Windows branch can be exercised anywhere.
 * Driving it through real subprocesses meant the platform it exists for was
 * the one platform it could not be tested on — and the first version of these
 * tests passed on macOS and Linux while failing on Windows.
 */
export function classify(
  failure: SpawnFailure,
  timeoutMs: number,
  windows: boolean,
): CaptureOutcome {
  if (failure.code === "ENOENT") return { ok: false, why: "absent" };

  // `killed` is set when we ended it. Output already written is not a report —
  // a scanner cut off mid-document yields truncated JSON, and parsing it would
  // report our own timeout as the scanner's bad output.
  if (failure.killed === true) {
    return { ok: false, why: "timeout", detail: `no answer within ${timeoutMs / 1000}s` };
  }

  // `shell: true` means a missing command surfaces as an exit code rather than
  // ENOENT. Narrowed to the codes and words that mean exactly that: the old
  // check treated every stdout-less failure as absence, so a crash or a
  // permissions error was reported as "install this".
  if (windows && notRecognised(failure)) return { ok: false, why: "absent" };

  // Findings were reported and the process exited non-zero. That is the normal
  // case for a scanner and it is success.
  const stdout = failure.stdout ?? "";
  if (stdout.trim() !== "") return { ok: true, stdout };

  return {
    ok: false,
    why: "failed",
    detail: describe(failure),
    ...(typeof failure.code === "number" ? { exitCode: failure.code } : {}),
  };
}

/** cmd.exe answers 9009 for a command it cannot find; PowerShell says so. */
function notRecognised(failure: SpawnFailure): boolean {
  if (failure.code === 9009 || failure.code === "9009") return true;
  const said = typeof failure.stderr === "string" ? failure.stderr : "";
  return /not recognized as|CommandNotFoundException|is not recognized/i.test(said);
}

function describe(failure: SpawnFailure): string {
  if (typeof failure.signal === "string" && failure.signal !== "") {
    return `ended by ${failure.signal}`;
  }
  return failure.code === undefined || failure.code === null
    ? "no output and no exit code"
    : `exited ${failure.code} with no output`;
}


