/**
 * Two ways a surface can be quietly wrong about its own completeness.
 *
 * A stale baseline suppresses nothing, so every finding is reported as new.
 * `baseline.ts` says "the caller must show this" directly above the field, and
 * one caller was not showing it — the page listed the whole backlog with no
 * hint that the ratchet had not run, which reads as a regression nobody caused.
 *
 * And `--top` is a display limit. A Security tab that shows three alerts out of
 * eighty-two, with nothing in the file saying so, looks complete and is not.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { emptyBaseline } from "../src/baseline.js";
import { SCHEMA_VERSION } from "../src/fingerprint.js";
import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { judge } from "../src/judge.js";
import { renderHtml } from "../src/html.js";
import { renderJson, renderHuman } from "../src/report.js";
import { renderSarif } from "../src/sarif.js";

const raw = readFileSync(
  fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url)),
  "utf8",
);
const findings = parseNpmAudit(raw);

const stale = judge(findings, {
  baseline: { ...emptyBaseline(), schemaVersion: `not-${SCHEMA_VERSION}` },
});

describe("a baseline that suppressed nothing", () => {
  it("qualifies the judgement at all", () => {
    expect(stale.applied.warning).toBeDefined();
  });

  it.each([
    ["terminal", () => renderHuman(stale, false), /schema/],
    ["html", () => renderHtml(stale, { language: "en" }), /class="warning"/],
    ["json", () => renderJson(stale), /"warning"/],
  ])("reaches %s", (_surface, render, pattern) => {
    expect(render()).toMatch(pattern);
  });

  it("reaches sarif, in the run properties rather than a result level", () => {
    // `level: "warning"` is what a moderate finding renders as, so matching the
    // bare word would pass without the qualification being carried at all.
    const run = JSON.parse(renderSarif(stale)).runs[0];
    expect(typeof run.properties.warning).toBe("string");
  });

  it("says nothing on a run that is not qualified", () => {
    const clean = judge(findings, { baseline: emptyBaseline() });
    expect(renderHtml(clean, { language: "en" })).not.toMatch(/class="warning"/);
    expect(JSON.parse(renderSarif(clean)).runs[0].properties.warning).toBeUndefined();
  });
});

describe("SARIF under --top", () => {
  const truncated = JSON.parse(
    renderSarif(judge(findings, { baseline: emptyBaseline(), top: 2 })),
  ).runs[0];
  const whole = JSON.parse(
    renderSarif(judge(findings, { baseline: emptyBaseline() })),
  ).runs[0];

  it("shows only what was asked for", () => {
    expect(truncated.results).toHaveLength(2);
  });

  it("says how many there really are", () => {
    expect(truncated.properties.outstanding).toBeGreaterThan(2);
    expect(truncated.properties.truncated).toBe(true);
  });

  it("does not claim truncation when nothing was cut", () => {
    expect(whole.properties.truncated).toBe(false);
    expect(whole.properties.outstanding).toBe(whole.results.length);
  });
});
