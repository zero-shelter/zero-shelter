#!/usr/bin/env node
/**
 * Grade the judge against what two people said, and say how much they agreed.
 *
 * Two people label the same sheets without seeing each other's answers. This
 * reads both, reports Cohen's kappa so the reader can tell a real agreement
 * from two people guessing the same way, and scores our decisions only on the
 * rows where they actually agreed.
 *
 * The disagreements are not thrown away. They are printed, because a row two
 * careful people read differently is the most interesting row on the sheet and
 * the record of how it was settled belongs in the repository.
 *
 * Nothing here fills a label in. An answer key produced by the tool being
 * graded is not an answer key.
 *
 *   node bench/score-labels.mjs
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const benchDir = dirname(fileURLToPath(import.meta.url));
const labelDir = join(benchDir, "labels");

/**
 * `<sheet>.<login>.tsv`, and never the template.
 *
 * The login is in the filename so the two files are visibly from two people,
 * and the commit history shows they arrived from two accounts.
 */
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
    // Identity is every cell the labeller did not write in. Comparing on a row
    // number instead would silently mispair the two files the moment one of
    // them is sorted or an empty line is removed.
    const key = cells.slice(0, labelAt).join("\t");
    const label = (cells[labelAt] ?? "").trim().toLowerCase();
    if (label !== "") rows.set(key, label);
  }
  return rows;
}

/**
 * Cohen's kappa.
 *
 * Raw agreement flatters: if 90% of rows are obviously one answer, two people
 * agreeing 90% of the time have told you nothing. Kappa subtracts the
 * agreement you would expect from chance given how often each person used each
 * label. Below about 0.6 the labels are not a foundation to put a number on.
 */
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

  // Perfect agreement with one label used throughout: chance explains all of
  // it, and the formula divides by zero. Saying "undefined" is honest; saying
  // 1.0 would be the sheet flattering itself.
  const value = expected === 1 ? null : (observed - expected) / (1 - expected);
  return { kappa: value, agreed, n, observed };
}

const SHEETS = {
  joins: {
    question: "did these reports describe one advisory?",
    // We joined them. So "same" means we were right.
    weRight: "same",
    wrongMeans: "a false join — the second advisory disappeared behind the first",
  },
  holds: {
    question: "should these two have been joined?",
    // We did NOT join them. So "different" means we were right.
    weRight: "different",
    wrongMeans: "caution cost a duplicate — they were one advisory and we showed two",
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
    // Deliberately not scored. One person is a reading, not a benchmark, and
    // printing a precision figure from it would be the circularity this bench
    // exists to avoid wearing a different hat.
    const [only] = sheets;
    console.log(
      `Only **${only.labeller}** has labelled this (${only.rows.size} rows). ` +
        "A second, independent labeller is required before any figure is reported — " +
        "one person's reading is not ground truth.",
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
      `**${correct} of ${graded}** went our way` +
      (graded > 0 ? ` (${Math.round((correct / graded) * 100)}%)` : ""),
  );
  console.log(`Each of the other ${graded - correct} is ${spec.wrongMeans}.`);

  const disputed = shared.filter((key) => a.rows.get(key) !== b.rows.get(key));
  if (disputed.length > 0) {
    console.log(`\n### The ${disputed.length} they read differently\n`);
    for (const key of disputed) {
      const columns = key.split("\t");
      console.log(
        `- ${columns.slice(0, 3).join(" · ")} — ${a.labeller}: **${a.rows.get(key)}**, ` +
          `${b.labeller}: **${b.rows.get(key)}**`,
      );
    }
    console.log(
      "\nSettle these in a recorded session and commit the outcome. The row two " +
        "careful readers disagree about is the one worth writing down.",
    );
  }
}

if (!anything) {
  console.log(
    "\nNothing to score. Generate the sheets with `node bench/make-decision-sheets.mjs`, " +
      "then two people fill copies of them independently.",
  );
}
