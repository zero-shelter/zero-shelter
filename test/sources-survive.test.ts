/**
 * Retain scanner run metadata when all reported findings are accepted.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { emptyBaseline, baselineFrom } from "../src/baseline.js";
import { entryFrom } from "../src/history.js";
import { judge } from "../src/judge.js";
import { renderHuman } from "../src/report.js";

const raw = readFileSync(
  fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url)),
  "utf8",
);
const findings = parseNpmAudit(raw);
const BOTH = ["npm-audit", "osv-scanner"];

describe("a run where everything was already accepted", () => {
  const first = judge(findings, { baseline: emptyBaseline(), sources: BOTH });
  const quiet = judge(findings, {
    baseline: baselineFrom(first.fixNow, BOTH),
    sources: BOTH,
  });

  it("has nothing left to report", () => {
    expect(quiet.applied.fresh).toHaveLength(0);
  });

  it("still records both scanners", () => {
    expect(entryFrom(quiet, "2026-01-01T00:00:00.000Z").sources).toEqual(BOTH);
  });
});

describe("the summary line", () => {
  const render = (sources: string[]): string =>
    renderHuman(judge(findings, { baseline: emptyBaseline(), sources }), false);

  it("identifies a run without cross-scanner comparison", () => {
    expect(render(["npm-audit"])).toContain("one source; no cross-scanner comparison");
  });

  it("still merges repeated reports from the same scanner", () => {
    const repeated = judge([...findings, ...findings], {
      baseline: emptyBaseline(), sources: ["npm-audit"],
    });
    expect(repeated.merged).toBeLessThan(repeated.raw);
    const text = renderHuman(repeated, false);
    expect(text).toContain("one source; no cross-scanner comparison");
    expect(text).not.toContain("nothing to reconcile");
  });

  it("stays quiet about it when two did", () => {
    expect(render(BOTH)).not.toContain("one source");
  });

  it("says nothing either way when the caller did not tell us", () => {
    const blind = renderHuman(judge(findings, { baseline: emptyBaseline() }), false);
    expect(blind).not.toContain("one source");
  });
});
