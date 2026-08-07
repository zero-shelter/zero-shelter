/**
 * Collecting scanner output.
 *
 * `npm audit` always runs, because a project with a lockfile already has npm
 * and demanding an install before the first result is how a tool loses its only
 * chance. Everything else is used when it happens to be present and skipped
 * with a note when it is not.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ScaFinding } from "./finding.js";
import { parseNpmAudit } from "./ingest/npm-audit.js";
import { parseOsv } from "./ingest/osv.js";

const run = promisify(execFile);

export interface Collected {
  readonly findings: ScaFinding[];
  /** Human-readable notes about sources that did not contribute. */
  readonly skipped: string[];
}

export interface ScanOptions {
  readonly cwd: string;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
// Scanner output on a large monorepo is big; the default 1MB buffer truncates
// it into a JSON parse error that looks like a parser bug.
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

export async function collect(options: ScanOptions): Promise<Collected> {
  const findings: ScaFinding[] = [];
  const skipped: string[] = [];

  const audit = await runNpmAudit(options);
  if (audit.ok) findings.push(...parseNpmAudit(audit.stdout));
  else skipped.push(`npm audit skipped: ${audit.reason}`);

  const osv = await runOsvScanner(options);
  if (osv.ok) findings.push(...parseOsv(osv.stdout, osv.version));
  else skipped.push(`osv-scanner skipped: ${osv.reason}`);

  return { findings, skipped };
}

type Attempt =
  | { ok: true; stdout: string; version?: string }
  | { ok: false; reason: string };

/**
 * `npm audit` exits non-zero whenever it finds anything, which is the normal
 * case. Only a missing or unreadable report is a failure.
 */
async function runNpmAudit(options: ScanOptions): Promise<Attempt> {
  const stdout = await capture("npm", ["audit", "--json"], options);
  if (stdout === undefined) return { ok: false, reason: "npm is not available" };
  if (stdout.trim() === "") return { ok: false, reason: "npm produced no report" };
  return { ok: true, stdout };
}

async function runOsvScanner(options: ScanOptions): Promise<Attempt> {
  const stdout = await capture(
    "osv-scanner",
    ["--format", "json", "--recursive", options.cwd],
    options,
  );

  if (stdout === undefined) {
    return {
      ok: false,
      reason: "not on PATH (optional — install it for cross-source deduplication)",
    };
  }
  if (stdout.trim() === "") return { ok: false, reason: "produced no report" };

  const version = await capture("osv-scanner", ["--version"], options);
  const parsed = version?.match(/\d+\.\d+\.\d+/)?.[0];

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
async function capture(
  command: string,
  args: readonly string[],
  options: ScanOptions,
): Promise<string | undefined> {
  try {
    const { stdout } = await run(command, [...args], {
      cwd: options.cwd,
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
      // npm and osv-scanner ship as .cmd shims on Windows, which execFile
      // cannot invoke without a shell.
      shell: process.platform === "win32",
    });
    return stdout;
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stdout?: string };

    if (failure.code === "ENOENT") return undefined;
    // A shell reports a missing command through the exit code instead.
    if (process.platform === "win32" && failure.stdout === undefined) return undefined;

    // Findings were reported and the process exited non-zero. That is success.
    return failure.stdout ?? undefined;
  }
}
