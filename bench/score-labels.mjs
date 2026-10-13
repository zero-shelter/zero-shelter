#!/usr/bin/env node
/**
 * Compare two independently completed human label sheets. Report agreement,
 * Cohen's kappa, decisions on agreed rows, and disagreements for recorded review.
 * This script does not generate labels.
 * Usage: node bench/score-labels.mjs
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const benchDir = dirname(fileURLToPath(import.meta.url));
const labelDir = join(benchDir, "labels");

/** Read <sheet>.<login>.tsv files, excluding unfilled templates. */
async function sheetsFor(sheet) {
  const files = (await readdir(labelDir)).filter(
    (f) => f.startsWith(`${sheet}.`) && f.endsWith(".tsv") && !f.includes(".template."),
  );
  return Promise.all(
    files.map(async (file) => ({
      labeller: file.slice(sheet.length + 1, -4),
      rows: parse(await readFile(join(labelDir, file), "utf8")),
    })),
  );
}

/** Comment lines are instructions to the labeller, not data. */
function parse(text) {
  const lines = text.split("\n").filter((l) => l.trim() !== "" && !l.startsWith("#"));
  const header = lines.shift()?.split("\t") ?? [];
  const labelAt = header.indexOf("label");
  if (labelAt === -1) throw new Error("sheet has no label column");

  const rows = new Map();
  for (const line of lines) {
    const cells = line.split("\t");
    // Match on immutable input cells so row reordering does not pair different inputs.
    const key = cells.slice(0, labelAt).join("\t");
    const label = (cells[labelAt] ?? "").trim().toLowerCase();
    if (label !== "") rows.set(key, label);
  }
  return rows;
}

/** Cohen's kappa adjusts observed agreement for label-frequency agreement. */
function kappa(a, b, shared) {
  const labels = [...new Set([...shared].flatMap((k) => [a.get(k), b.get(k)]))];
  const n = shared.length;
  if (n === 0) return { kappa: null, agreed: 0, n: 0 };

  const agreed = shared.filter((k) => a.get(k) === b.get(k)).length;
  const observed = agreed / n;

  let expected = 0;
  for (const label of labels) {
    const pa = shared.filter((k) => a.get(k) === label).length / n;
    const pb = shared.filter((k) => b.get(k) === label).length / n;
    expected += pa * pb;
  }

  // A single label throughout gives a zero denominator; return null.
  const value = expected === 1 ? null : (observed - expected) / (1 - expected);
  return { kappa: value, agreed, n, observed };
}

const SHEETS = {
  joins: {
    question: "did these reports describe one advisory?",
    // We joined them. So "same" means we were right.
    weRight: "same",
    wrongMeans: "a false join: distinct advisories combined",
  },
  holds: {
    question: "should these two have been joined?",
    // We did NOT join them. So "different" means we were right.
    weRight: "different",
    wrongMeans: "a retained duplicate: one advisory shown twice",
  },
};

let anything = false;

for (const [sheet, spec] of Object.entries(SHEETS)) {
  const sheets = await sheetsFor(sheet);

  if (sheets.length === 0) {
    console.log(`\n## ${sheet}\n\nNo labels yet. Fill bench/labels/${sheet}.template.tsv — see bench/README.md.`);
    continue;
  }
  anything = true;

  console.log(`\n## ${sheet} — ${spec.question}\n`);

  if (sheets.length === 1) {
    // Require two labellers before scoring, per the benchmark protocol.
    const [only] = sheets;
    console.log(
      `Only **${only.labeller}** has labelled this (${only.rows.size} rows). ` +
        "A second, independent labeller is required before any figure is reported — " +
        "see the independent-labelling protocol in bench/README.md.",
    );
    continue;
  }

  const [a, b] = sheets;
  const shared = [...a.rows.keys()].filter((k) => b.rows.has(k));
  const { kappa: k, agreed, n, observed } = kappa(a.rows, b.rows, shared);

  console.log(`Labellers: **${a.labeller}** and **${b.labeller}**`);
  console.log(`Both labelled: ${n} rows (${a.rows.size} and ${b.rows.size} filled in)\n`);
  console.log(`- raw agreement: ${agreed}/${n}${n > 0 ? ` (${Math.round(observed * 100)}%)` : ""}`);
  console.log(
    `- Cohen's kappa: ${k === null ? "undefined — one label used throughout" : k.toFixed(2)}`,
  );

  if (k !== null && k < 0.6) {
    console.log(
      "\n> Agreement is too low to build a figure on. Reconcile the sheet before " +
        "quoting any number from it — see the disagreements below.",
    );
  }

  const settled = shared.filter((key) => a.rows.get(key) === b.rows.get(key));
  const correct = settled.filter((key) => a.rows.get(key) === spec.weRight).length;
  const unsure = settled.filter((key) => a.rows.get(key) === "unsure").length;
  const graded = settled.length - unsure;

  console.log(
    `\nOn the ${graded} rows both agreed on and neither marked unsure: ` +
      `**${correct} of ${graded}** matched the tool decision` +
      (graded > 0 ? ` (${Math.round((correct / graded) * 100)}%)` : ""),
  );
  console.log(`Each of the other ${graded - correct} is ${spec.wrongMeans}.`);

  const disputed = shared.filter((key) => a.rows.get(key) !== b.rows.get(key));
  if (disputed.length > 0) {
    console.log(`\n### Disagreements (${disputed.length})\n`);
    for (const key of disputed) {
      const columns = key.split("\t");
      console.log(
        `- ${columns.slice(0, 3).join(" · ")} — ${a.labeller}: **${a.rows.get(key)}**, ` +
          `${b.labeller}: **${b.rows.get(key)}**`,
      );
    }
    console.log(
      "\nResolve these in a recorded session and commit the outcome. " +
        "Keep the disputed labels and the decision rationale.",
    );
  }
}

if (!anything) {
  console.log(
    "\nNothing to score. Generate the sheets with `node bench/make-decision-sheets.mjs`, " +
      "then two people fill copies of them independently.",
  );
}
