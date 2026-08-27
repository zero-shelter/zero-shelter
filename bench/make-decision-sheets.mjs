#!/usr/bin/env node
/**
 * Sheets for the decisions this tool actually makes.
 *
 * The per-finding sheets ask whether each raw finding is worth fixing. That is
 * a question about the scanners: they produced the list, and a labeller working
 * through 645 of them is grading npm audit and osv-scanner rather than us.
 *
 * We make two decisions of our own, and they are the ones a benchmark should
 * be able to grade:
 *
 *   join   — these two reports are one advisory, so they became one finding.
 *            Getting this wrong is the expensive direction: a false join hides
 *            a real vulnerability behind an unrelated one, and the reader never
 *            learns it was there.
 *
 *   hold   — these two look like the same thing and share no identifier, so
 *            they were left separate and flagged. This is the most argued line
 *            in the design. A labeller saying "those were obviously the same"
 *            is telling us the caution costs more than it saves.
 *
 * There are 62 holds across the four repositories, which is a census two people
 * can finish. Joins are sampled, because 308 is not.
 *
 * Labelling is human-only, for the same reason it always was: an answer key our
 * own tool produced cannot grade our own tool, and it is the first thing anyone
 * reading this will check.
 *
 *   node bench/make-decision-sheets.mjs
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseNpmAudit } from "../dist/ingest/npm-audit.js";
import { parseOsv } from "../dist/ingest/osv.js";
import { mergeFindings } from "../dist/merge.js";

const benchDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(benchDir, "labels");
await mkdir(outDir, { recursive: true });

/**
 * How many joins to ask about per repository.
 *
 * Every one would be better and nobody would finish it. Stated here rather than
 * buried: this is a sample, the sheet says so, and any precision figure drawn
 * from it carries that caveat.
 */
const JOIN_SAMPLE = 20;

const cell = (value) => String(value ?? "").replace(/[\t\n]/g, " ");

/** Deterministic, so regenerating the sheet does not reshuffle the work. */
function sample(items, limit) {
  if (items.length <= limit) return items;
  const step = items.length / limit;
  return Array.from({ length: limit }, (_, i) => items[Math.floor(i * step)]);
}

const joinRows = [];
const holdRows = [];
const counts = [];

for (const name of (await readdir(join(benchDir, "captures"))).sort()) {
  const dir = join(benchDir, "captures", name);
  if (!existsSync(join(dir, "npm-audit.json"))) continue;

  const findings = [...parseNpmAudit(await readFile(join(dir, "npm-audit.json"), "utf8"))];
  if (existsSync(join(dir, "osv-scanner.json"))) {
    findings.push(...parseOsv(await readFile(join(dir, "osv-scanner.json"), "utf8")));
  }

  const merged = mergeFindings(findings);
  const byFingerprint = new Map(merged.map((f) => [f.fingerprint, f]));

  const joins = merged.filter((f) => f.members.length > 1);
  for (const finding of sample(joins, JOIN_SAMPLE)) {
    // What the sources each called it, which is the whole question. The
    // labeller is asked whether these describe one advisory, not whether our
    // merge was clever.
    const reported = [
      ...new Set(finding.members.map((m) => `${m.sources[0]?.tool}:${m.advisoryId}`)),
    ].sort();
    joinRows.push(
      [
        name,
        finding.fingerprint,
        finding.packageName,
        reported.join(" + "),
        finding.members.length,
        cell(finding.title),
        "",
        "",
      ].join("\t"),
    );
  }

  const holds = merged.filter((f) => f.relatedTo.length > 0);
  const seen = new Set();
  for (const finding of holds) {
    for (const other of finding.relatedTo) {
      // One row per pair, not per side. Asking the same question twice with
      // the arguments swapped is how a labeller loses faith in a sheet.
      const key = [finding.fingerprint, other].sort().join(" ");
      if (seen.has(key)) continue;
      seen.add(key);

      const partner = byFingerprint.get(other);
      if (partner === undefined) continue;
      holdRows.push(
        [
          name,
          finding.packageName,
          `${finding.advisoryId}  vs  ${partner.advisoryId}`,
          cell(finding.title),
          cell(partner.title),
          finding.vulnerableRange === partner.vulnerableRange ? "same" : "different",
          "",
          "",
        ].join("\t"),
      );
    }
  }

  counts.push({ name, joins: joins.length, sampled: Math.min(joins.length, JOIN_SAMPLE), holds: holds.length });
}

const joinSheet =
  "# Did these reports describe ONE advisory?\n" +
  "# label: same (one advisory, joining was right) | different (two advisories, joining hid one) | unsure\n" +
  "# A false join is the expensive mistake: the second finding disappears and nobody learns it existed.\n" +
  "# Sampled, not a census — see the sheet count in bench/README.md.\n" +
  "repo\tfingerprint\tpackage\treported_as\tmembers\ttitle\tlabel\tnotes\n" +
  joinRows.join("\n") +
  "\n";

const holdSheet =
  "# These two share no advisory id, so they were NOT joined and were flagged instead.\n" +
  "# label: same (they were one advisory — the caution cost a duplicate) | different (leaving them apart was right) | unsure\n" +
  "# Every hold is here. This is the census, and it is the most argued line in the design.\n" +
  "repo\tpackage\tadvisories\ttitle_a\ttitle_b\trange\tlabel\tnotes\n" +
  holdRows.join("\n") +
  "\n";

await writeFile(join(outDir, "joins.template.tsv"), joinSheet);
await writeFile(join(outDir, "holds.template.tsv"), holdSheet);

for (const { name, joins, sampled, holds } of counts) {
  console.log(`${name.padEnd(20)} joins ${String(joins).padStart(3)} (asking ${sampled})  holds ${holds}`);
}
console.log(`\njoins.template.tsv  ${joinRows.length} rows (sampled from ${counts.reduce((n, c) => n + c.joins, 0)})`);
console.log(`holds.template.tsv  ${holdRows.length} rows (every one)`);
console.log(
  "\nEach labeller: copy to <sheet>.<your-github-login>.tsv, fill the label column,\n" +
    "commit from your own account. Do not look at the other labeller's file, and do\n" +
    "not run `zero-shelter judge` on these repositories while labelling — the sheets\n" +
    "are deliberately free of our verdict so that yours is independent of it.",
);
