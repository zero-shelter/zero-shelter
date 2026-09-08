/**
 * `clears N` rests on reading dependents' ranges out of package-lock.json.
 * There is no reader for pnpm-lock.yaml or yarn.lock, so on those managers the
 * count is unverifiable. The terminal and the agent hook already withhold it
 * (see canPromiseClears); the html report did not. See Issue #122.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { emptyBaseline } from "../src/baseline.js";
import { judge } from "../src/judge.js";
import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { renderHtml } from "../src/html.js";

const findings = parseNpmAudit(
  readFileSync(fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url)), "utf8"),
);

// The semver fixture clears two findings, so the count span must be rendered
// for npm and withheld for other managers. A count of one omits the span already.
const pnpmResult = judge(findings, { baseline: emptyBaseline(), packageManager: "pnpm" });
const npmResult = judge(findings, { baseline: emptyBaseline(), packageManager: "npm" });

describe("the html report's clears guard", () => {
  it("does not print a clears count it cannot verify", () => {
    const page = renderHtml(pnpmResult, { language: "en" });

    expect(page).toContain("pnpm add semver@5.7.2");
    expect(page).not.toMatch(/class="clears"/);
    expect(page).not.toContain("clears 2");
  });

  it("does not claim counts are shown when they are not", () => {
    const page = renderHtml(pnpmResult, { language: "en" });

    // The sentence above the command list must not promise what the rows
    // beside it do not deliver.
    expect(page).not.toContain("Counts estimate how many findings the update addresses");
    expect(page).toContain(
      "Counts are not shown for pnpm; only npm lockfiles are checked for whether the update reaches every installed copy.",
    );
  });

  it("still shows the count when the manager can back it", () => {
    const page = renderHtml(npmResult, { language: "en" });

    expect(page).toContain('class="clears"');
    expect(page).toContain("clears 2");
    expect(page).toContain("Counts estimate how many findings the update addresses");
  });

  it("translates the no-counts sentence rather than leaving it in English", () => {
    const page = renderHtml(pnpmResult, { language: "ko" });

    expect(page).not.toContain("Counts are not shown for pnpm");
    expect(page).toContain("pnpm에서는 항목 수를 표시하지 않습니다");
  });
});
