/**
 * --top limits displayed rows without changing project totals or upgrade advice.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { emptyBaseline } from "../src/baseline.js";
import { judge } from "../src/judge.js";
import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { renderHuman, renderJson } from "../src/report.js";

const findings = parseNpmAudit(
  readFileSync(fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url)), "utf8"),
);

const all = judge(findings, { baseline: emptyBaseline() });
const capped = judge(findings, { baseline: emptyBaseline(), top: 1 });

describe("--top", () => {
  it("does not change how many findings are outstanding", () => {
    expect(capped.applied.fresh.length).toBe(all.applied.fresh.length);
    expect(capped.fixNow.length).toBe(1);
  });

  it("does not change the reduction percentage", () => {
    const percent = (text: string) => /\((\d+)% fewer listed\)/.exec(text)?.[1];

    expect(percent(renderHuman(capped, false))).toBe(percent(renderHuman(all, false)));
  });

  it("says the real number first and the shown number second", () => {
    const text = renderHuman(capped, false);

    expect(text).toContain(`findings to review: ${all.applied.fresh.length} (top 1 shown)`);
    expect(text).toContain("showing 1");
  });

  it("keeps the remediation advice about the whole project", () => {
    const cappedJson = JSON.parse(renderJson(capped));
    const allJson = JSON.parse(renderJson(all));

    // One upgrade below the cutoff is still an upgrade worth naming.
    expect(cappedJson.upgrades).toEqual(allJson.upgrades);
    expect(cappedJson.transitiveFixes).toEqual(allJson.transitiveFixes);
  });

  it("reports both counts in JSON so a consumer cannot confuse them", () => {
    const json = JSON.parse(renderJson(capped));

    expect(json.summary.fixNow).toBe(all.applied.fresh.length);
    expect(json.summary.shown).toBe(1);
    expect(json.fixNow).toHaveLength(1);
  });
});
