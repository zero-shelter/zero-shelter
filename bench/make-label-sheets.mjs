#!/usr/bin/env node
/**
 * Generate labelling sheets from raw source findings in fingerprint order,
 * omitting the tool's merge and ranking results. Two people fill separate copies
 * without consulting each other, then record disagreement resolution.
 * Models must not supply labels. See bench/README.md for the protocol.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseNpmAudit } from "../dist/ingest/npm-audit.js";
import { parseOsv } from "../dist/ingest/osv.js";

const benchDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(benchDir, "labels");
await mkdir(outDir, { recursive: true });

for (const name of (await readdir(join(benchDir, "captures"))).sort()) {
  const dir = join(benchDir, "captures", name);
  if (!existsSync(join(dir, "npm-audit.json"))) continue;

  const findings = [
    ...parseNpmAudit(await readFile(join(dir, "npm-audit.json"), "utf8")),
  ];
  if (existsSync(join(dir, "osv-scanner.json"))) {
    findings.push(...parseOsv(await readFile(join(dir, "osv-scanner.json"), "utf8")));
  }

  const rows = findings
    .sort((a, b) => (a.fingerprint < b.fingerprint ? -1 : 1))
    .map(
      (f) =>
        `${f.fingerprint}\t${f.sources[0]?.tool}\t${f.packageName}\t` +
        `${f.advisoryId}\t${f.severity}\t${f.title.replace(/\t/g, " ")}\t\t`,
    );

  const sheet =
    "# Label each row: real (worth fixing here), noise (not actionable in this repo), dup (same issue as another row — name its fingerprint in notes)\n" +
    "fingerprint\tsource\tpackage\tadvisory\tseverity\ttitle\tlabel\tnotes\n" +
    rows.join("\n") +
    "\n";

  await writeFile(join(outDir, `${name}.template.tsv`), sheet);
  console.log(`${name}: ${rows.length} rows`);
}

console.log(
  "\nEach labeller: copy <repo>.template.tsv to <repo>.<your-github-login>.tsv, " +
    "fill the label column, commit from your own account. Do not look at the " +
    "other labeller's file or at `zero-shelter judge` output while labelling.",
);
