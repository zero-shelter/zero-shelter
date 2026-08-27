/**
 * The interfaces docs/STABILITY.md freezes.
 *
 * A pipeline that fails builds on exit code 1 and parses `--format json` is
 * betting on these two surfaces, and the bet is worth nothing if it lives in a
 * document nobody runs. So this asserts against real output rather than against
 * a second copy of the table.
 *
 * Breaking one of these is allowed. Doing it quietly is not: this test is where
 * you say so, and the major version is the price.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { emptyBaseline } from "../src/baseline.js";
import { SCHEMA_VERSION } from "../src/fingerprint.js";
import { judge } from "../src/judge.js";
import { renderJson } from "../src/report.js";

const raw = readFileSync(
  fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url)),
  "utf8",
);
const findings = parseNpmAudit(raw);
const report = JSON.parse(renderJson(judge(findings, { baseline: emptyBaseline() })));

describe("keys that are always there", () => {
  it.each([
    ["summary", "object"],
    ["fixNow", "array"],
    ["upgrades", "array"],
    ["transitiveFixes", "array"],
    ["noLongerReported", "array"],
    ["skipped", "array"],
    ["workspaceRoot", "boolean"],
  ])("%s is present and is %s", (key, kind) => {
    expect(report).toHaveProperty(key);
    const value = report[key];
    if (kind === "array") expect(Array.isArray(value)).toBe(true);
    else expect(typeof value).toBe(kind);
  });

  it("counts every summary field a caller may divide by", () => {
    for (const key of ["raw", "merged", "fixNow", "shown", "accepted", "noLongerReported"]) {
      expect(Number.isInteger(report.summary[key])).toBe(true);
    }
  });

  it("describes a finding with the fields the table names", () => {
    const entry = report.fixNow[0];
    expect(entry).toBeDefined();
    for (const key of [
      "fingerprint",
      "score",
      "severity",
      "ecosystem",
      "package",
      "advisory",
      "title",
      "vulnerableRange",
      "direct",
      "tools",
    ]) {
      expect(entry).toHaveProperty(key);
    }
    expect(Number.isInteger(entry.score)).toBe(true);
    expect(typeof entry.direct).toBe("boolean");
  });
});

/**
 * Frozen if present, which is a weaker promise and a different test. Absent
 * means "no qualification", never "key missing, ignore" — so the type only has
 * to hold on a run that actually produces one.
 */
describe("warning", () => {
  it("is absent when the judgement is not qualified", () => {
    expect(report.warning).toBeUndefined();
  });

  it("is a string when the baseline was written for older fingerprints", () => {
    const stale = { ...emptyBaseline(), schemaVersion: `not-${SCHEMA_VERSION}` };
    const qualified = JSON.parse(renderJson(judge(findings, { baseline: stale })));

    expect(typeof qualified.warning).toBe("string");
  });
});
