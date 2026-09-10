#!/usr/bin/env node
/**
 * Measure report counts and the reduction after merging committed captures.
 * These measurements do not establish precision or the absence of false merges;
 * those require independently labelled data.
 * Run npm run build first. This script does not invoke scanners or the network.
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
    auditOnly,
    both: result,
    raw: result.summary.raw,
    merged: result.summary.merged,
    // Count the reduction in report entries, including merges within one source.
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

console.log("| repo | pinned | raw reports | after judge | reduction | reports combined (raw - merged) | corroborated by 2 tools | flagged possible dupes |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  console.log(
    `| ${r.name} | \`${r.sha}\` | ${r.raw} | ${r.merged} | ${r.reductionPct}% | ${r.crossJoins} | ${r.corroborated} | ${r.flagged} |`,
  );
}

const actionability = (result) => ({
  fixed: result.fixNow.filter((finding) => finding.fixedIn !== undefined).length,
  total: result.fixNow.length,
  direct: result.upgrades.length,
  transitive: result.transitiveFixes.length,
});

console.log(
  "\nMeasured without labels: volume only. Precision and dropped-finding rate " +
    "require bench/labels/ (two humans, independent) and are absent until then.",
);

console.log("\n| repo | fixed versions: npm audit → both | direct commands: npm audit → both | transitive advice: npm audit → both |");
console.log("|---|---:|---:|---:|");
for (const r of rows) {
  const one = actionability(r.auditOnly);
  const both = actionability(r.both);
  console.log(
    `| ${r.name} | ${one.fixed}/${one.total} → ${both.fixed}/${both.total} | ${one.direct} → ${both.direct} | ${one.transitive} → ${both.transitive} |`,
  );
}
