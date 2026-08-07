import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  BASELINE_PATH,
  baselineFrom,
  emptyBaseline,
  parseBaseline,
  serializeBaseline,
} from "./baseline.js";
import { judge } from "./judge.js";
import { parseNpmAudit } from "./ingest/npm-audit.js";
import { parseOsv } from "./ingest/osv.js";
import { collect } from "./scan.js";
import { colorEnabled, renderExplain, renderHuman, renderJson } from "./report.js";
import type { ScaFinding } from "./finding.js";

const USAGE = `zero-shelter judge — decide which dependency findings to fix now

  npx zero-shelter judge [options]

  --input <file>        read scanner output instead of running scanners.
                        Repeatable. Format is detected from the contents.
  --json                machine-readable output
  --explain             show how each score was reached
  --top <n>             report at most n findings
  --update-baseline     record the current findings as accepted and exit 0
  --baseline <file>     baseline location (default ${BASELINE_PATH})
  --cwd <dir>           project directory (default .)
  --help

Exit code is 1 when there is anything new to fix, so CI fails on regressions
rather than on the backlog it inherited.
`;

export async function main(argv: readonly string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        input: { type: "string", multiple: true },
        json: { type: "boolean" },
        explain: { type: "boolean" },
        top: { type: "string" },
        "update-baseline": { type: "boolean" },
        baseline: { type: "string" },
        cwd: { type: "string" },
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

  const command = positionals[0] ?? "judge";
  if (command !== "judge") {
    process.stderr.write(`unknown command: ${command}\n\n${USAGE}`);
    return 2;
  }

  const top = parseTop(values.top);
  if (top instanceof Error) {
    process.stderr.write(`${top.message}\n`);
    return 2;
  }

  const cwd = resolve(values.cwd ?? ".");
  const baselinePath = resolve(cwd, values.baseline ?? BASELINE_PATH);

  let findings: ScaFinding[];
  let skipped: string[];

  try {
    if (values.input !== undefined && values.input.length > 0) {
      findings = [];
      skipped = [];
      for (const file of values.input) {
        findings.push(...(await readInput(resolve(cwd, file))));
      }
    } else {
      const collected = await collect({ cwd });
      findings = collected.findings;
      skipped = collected.skipped;
    }
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 2;
  }

  let baseline;
  let baselineExists = true;
  try {
    const loaded = await loadBaseline(baselinePath);
    baseline = loaded.baseline;
    baselineExists = loaded.exists;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 2;
  }

  const result = judge(findings, {
    baseline,
    baselineExists,
    skipped,
    ...(top === undefined ? {} : { top }),
  });

  if (values["update-baseline"] === true) {
    // Record everything currently present, not just what survived the ratchet,
    // so re-running immediately afterwards reports nothing new.
    const all = judge(findings, { baseline: emptyBaseline() });
    await mkdir(dirname(baselinePath), { recursive: true });
    await writeFile(baselinePath, serializeBaseline(baselineFrom(all.fixNow)), "utf8");
    process.stdout.write(
      `recorded ${all.fixNow.length} finding(s) as accepted in ${values.baseline ?? BASELINE_PATH}\n`,
    );
    return 0;
  }

  if (values.json === true) {
    process.stdout.write(renderJson(result));
  } else {
    process.stdout.write(
      `${renderHuman(result, colorEnabled(process.env, process.stdout.isTTY === true))}\n`,
    );
    if (values.explain === true) {
      process.stdout.write(`\n${renderExplain(result)}\n`);
    }
  }

  return result.fixNow.length > 0 ? 1 : 0;
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
async function readInput(path: string): Promise<ScaFinding[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new Error(`cannot read ${path}`);
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
  if ("vulnerabilities" in record || "advisories" in record) return parseNpmAudit(raw);
  if ("results" in record) return parseOsv(raw);

  throw new Error(
    `${path}: unrecognised report. Expected npm audit (vulnerabilities) or osv-scanner (results).`,
  );
}

async function loadBaseline(path: string) {
  try {
    return { baseline: parseBaseline(await readFile(path, "utf8")), exists: true };
  } catch (error) {
    // A missing baseline is the normal first run, not a failure. A malformed
    // one is a failure: silently treating it as empty would report the whole
    // backlog as new and look like a regression nobody caused.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { baseline: emptyBaseline(), exists: false };
    }
    throw error;
  }
}

