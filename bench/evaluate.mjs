#!/usr/bin/env node
/**
 * Run the judge over the frozen captures and report what can be measured
 * without ground-truth labels: volume reduction and cross-source joins.
 *
 * What this deliberately does NOT claim: precision, or "no real vulnerability
 * was dropped". Both need human labels (bench/labels/), and until those exist
 * the honest sentence is "fewer items", not "the right items".
 *
 * Reads committed captures only — no network, no scanners. `npm run build`
 * first.
 */

import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const benchDir = dirname(fileURLToPath(import.meta.url));
const bin = join(benchDir, "..", "dist", "bin.js");

if (!existsSync(bin)) {
  console.error("dist/bin.js not found — run `npm run build` first");
  process.exit(2);
}

async function judge(inputs) {
  // No baseline on purpose: the benchmark measures the first-run judgement.
  const args = [
    bin, "judge", "--json",
    ...inputs.flatMap((file) => ["--input", file]),
    "--baseline", "bench-nonexistent-baseline.json",
  ];
  const out = await run("node", args, { maxBuffer: 64 * 1024 * 1024 }).catch((e) => e);
  if (typeof out.stdout !== "string" || out.stdout.trim() === "") {
    throw new Error(`judge produced nothing for ${inputs.join(", ")}: ${out.stderr ?? ""}`);
  }
  return JSON.parse(out.stdout);
}

const rows = [];

for (const name of (await readdir(join(benchDir, "captures"))).sort()) {
  const dir = join(benchDir, "captures", name);
  const audit = join(dir, "npm-audit.json");
  const osv = join(dir, "osv-scanner.json");
  if (!existsSync(audit)) continue;

  const auditOnly = await judge([audit]);
  const both = existsSync(osv) ? await judge([audit, osv]) : undefined;

  const meta = JSON.parse(await readFile(join(dir, "meta.json"), "utf8"));
  const result = both ?? auditOnly;

  rows.push({
    name,
    sha: meta.sha.slice(0, 12),
    raw: result.summary.raw,
    merged: result.summary.merged,
    // How many raw reports disappeared into a cross-checked finding once the
    // second source arrived. This is the part alias-joining actually buys.
    crossJoins: both === undefined ? "-" : String(both.summary.raw - both.summary.merged),
    corroborated:
      both === undefined
        ? "-"
        : String(both.fixNow.filter((f) => f.tools.length > 1).length),
    flagged: result.fixNow.filter((f) => f.possibleDuplicates.length > 0).length,
    reductionPct:
      result.summary.raw === 0
        ? 0
        : Math.round(((result.summary.raw - result.summary.merged) * 100) / result.summary.raw),
  });
}

console.log("| repo | pinned | raw reports | after judge | reduction | cross-source joins | corroborated by 2 tools | flagged possible dupes |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  console.log(
    `| ${r.name} | \`${r.sha}\` | ${r.raw} | ${r.merged} | ${r.reductionPct}% | ${r.crossJoins} | ${r.corroborated} | ${r.flagged} |`,
  );
}

console.log(
  "\nMeasured without labels: volume only. Precision and dropped-finding rate " +
    "require bench/labels/ (two humans, independent) and are absent until then.",
);
