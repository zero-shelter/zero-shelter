/**
 * Severity is assigned when an advisory is written and never moves again.
 *
 * So it can say a finding is critical and cannot say anyone has had eight years
 * to act on it. On the juice-shop captures a 2,878-day-old critical sits beside
 * a 19-day-old one and the two are indistinguishable — which is how a team ends
 * up with `npm audit || true` in CI and stops reading any of it.
 *
 * Both figures here come from the advisory. Neither enters the score: that is
 * integer arithmetic over rules the reader can argue with, and a CVSS number is
 * float arithmetic over a vector we did not compute.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { emptyBaseline } from "../src/baseline.js";
import { parseOsv } from "../src/ingest/osv.js";
import { judge } from "../src/judge.js";
import { mergeFindings } from "../src/merge.js";
import { renderExplain, renderHuman } from "../src/report.js";

// The frozen capture rather than the hand-made fixture: this is about fields
// real scanner output carries, and a stub that omits them would let the test
// pass while proving nothing.
const raw = readFileSync(
  fileURLToPath(new URL("../bench/captures/juice-shop/osv-scanner.json", import.meta.url)),
  "utf8",
);
const findings = parseOsv(raw);

describe("what the source already told us", () => {
  it("keeps the publication date instead of discarding it", () => {
    expect(findings.some((finding) => finding.published !== undefined)).toBe(true);
  });

  it("keeps the CVSS vector verbatim, without turning it into a number", () => {
    const withVector = findings.find((finding) => finding.cvssVector !== undefined);
    expect(withVector?.cvssVector).toMatch(/^CVSS:/);
  });
});

describe("merging two sources", () => {
  it("takes the earliest date, since the question is how long this has been known", () => {
    const early = { ...findings[0]!, published: "2020-01-01T00:00:00Z" };
    const late = { ...findings[0]!, published: "2026-01-01T00:00:00Z" };

    expect(mergeFindings([late, early])[0]?.published).toBe("2020-01-01T00:00:00Z");
    // Order of arrival must not change the answer.
    expect(mergeFindings([early, late])[0]?.published).toBe("2020-01-01T00:00:00Z");
  });

  it("leaves the field off when no source said, rather than inventing a blank", () => {
    const { published, cvssVector, ...bare } = findings[0]!;
    expect(published === undefined && cvssVector === undefined).toBe(false);

    const merged = mergeFindings([bare])[0];
    expect(merged).toHaveProperty("packageName");
    expect(merged?.published).toBeUndefined();
    expect(merged?.cvssVector).toBeUndefined();
  });
});

describe("age on screen", () => {
  const render = (today?: string): string =>
    renderHuman(
      judge(findings, { baseline: emptyBaseline(), ...(today === undefined ? {} : { today }) }),
      false,
    );

  it("counts whole days, so the figure is the same on every machine", () => {
    expect(render("2026-08-28")).toMatch(/\d+d/);
  });

  it("says nothing when the caller gave no date to measure against", () => {
    expect(render()).not.toMatch(/\s\d+d\s/);
  });

  it("does not print a negative age for an advisory published later", () => {
    const future = findings.map((finding) => ({ ...finding, published: "2030-01-01T00:00:00Z" }));
    expect(renderHuman(judge(future, { baseline: emptyBaseline(), today: "2026-08-28" }), false))
      .not.toMatch(/-\d+d/);
  });
});

describe("explain", () => {
  it("shows the vector and says whose number it is", () => {
    const explained = renderExplain(
      judge(findings, { baseline: emptyBaseline(), today: "2026-08-28" }),
    );

    expect(explained).toMatch(/CVSS:.*from the advisory, not our score/);
  });

  it("keeps the weights table as the only thing the score comes from", () => {
    const explained = renderExplain(judge(findings, { baseline: emptyBaseline() }));
    expect(explained).toContain("every point above comes from this table");
    expect(explained).not.toMatch(/CVSS[^\n]*points/);
  });
});
