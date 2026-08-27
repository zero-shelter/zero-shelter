import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { emptyBaseline, baselineFrom } from "../src/baseline.js";
import { judge } from "../src/judge.js";
import { fromPackages } from "../src/lockfile.js";
import { renderSarif } from "../src/sarif.js";

const raw = readFileSync(
  fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url)),
  "utf8",
);
const result = judge(parseNpmAudit(raw), { baseline: emptyBaseline() });
const sarif = JSON.parse(renderSarif(result));

describe("renderSarif", () => {
  it("declares the version consumers check for", () => {
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.$schema).toContain("sarif-2.1.0");
  });

  it("emits one run with one rule per reported finding", () => {
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe("zero-shelter");
    expect(sarif.runs[0].tool.driver.rules).toHaveLength(result.fixNow.length);
    expect(sarif.runs[0].results).toHaveLength(result.fixNow.length);
  });

  it("points every result at the rule it came from", () => {
    const ruleIds = sarif.runs[0].tool.driver.rules.map((r: { id: string }) => r.id);
    for (const [index, entry] of sarif.runs[0].results.entries()) {
      expect(entry.ruleId).toBe(ruleIds[index]);
      expect(entry.ruleIndex).toBe(index);
    }
  });

  /**
   * SARIF has four levels. Anything else makes the file invalid, and an invalid
   * file is rejected on upload with an error that says nothing useful.
   */
  it("uses only levels SARIF defines", () => {
    for (const entry of sarif.runs[0].results) {
      expect(["error", "warning", "note", "none"]).toContain(entry.level);
    }
  });

  it("maps our severities onto those levels the way a reader would expect", () => {
    const byRule = new Map(
      sarif.runs[0].results.map((r: { ruleId: string; level: string }) => [
        r.ruleId,
        r.level,
      ]),
    );

    for (const entry of result.fixNow) {
      const expected =
        entry.finding.severity === "critical" || entry.finding.severity === "high"
          ? "error"
          : "warning";
      expect(byRule.get(entry.finding.advisoryId)).toBe(expected);
    }
  });

  /**
   * GitHub decides whether an alert is one it has seen before from this value.
   * If it moved between runs, every run would look like a fresh set of alerts.
   */
  it("carries our fingerprint so alerts survive across runs", () => {
    for (const [index, entry] of sarif.runs[0].results.entries()) {
      expect(entry.partialFingerprints.zeroShelter).toBe(
        result.fixNow[index]?.finding.fingerprint,
      );
    }
  });

  it("keeps the score and its reasons, which SARIF has nowhere else to put", () => {
    for (const [index, entry] of sarif.runs[0].results.entries()) {
      expect(entry.properties.score).toBe(result.fixNow[index]?.score);
      expect(entry.properties.reasons).toHaveLength(
        result.fixNow[index]?.reasons.length ?? 0,
      );
    }
  });

  it("links each advisory to somewhere the reader can go", () => {
    for (const rule of sarif.runs[0].tool.driver.rules) {
      expect(rule.helpUri).toMatch(/^https:\/\//);
    }
  });

  it("contains nothing derived from a clock, so a rerun is byte-identical", () => {
    expect(renderSarif(result)).toBe(renderSarif(result));
    expect(JSON.stringify(sarif)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("produces a valid empty run when there is nothing to report", () => {
    const clean = judge(parseNpmAudit(raw), {
      baseline: baselineFrom(result.fixNow),
    });
    const empty = JSON.parse(renderSarif(clean));

    expect(empty.runs[0].results).toEqual([]);
    expect(empty.version).toBe("2.1.0");
  });
});

describe("what to do about it", () => {
  const build = (findings: readonly Parameters<typeof judge>[0][number][]) =>
    JSON.parse(renderSarif(judge(findings, { baseline: emptyBaseline() })));

  it("puts the command in the alert a direct dependency produces", () => {
    const sarif = build(parseNpmAudit(raw));
    const withCommand = sarif.runs[0].results.filter((result: { message: { text: string } }) =>
      result.message.text.includes("npm i "),
    );

    // A Security tab is one click from prose about the advisory and nowhere
    // near the line that resolves it.
    expect(withCommand.length).toBeGreaterThan(0);
    expect(withCommand[0].properties.remedy).toMatch(/^npm i /);
  });

  it("does not tell anyone to npm i a transitive package", () => {
    const sarif = build(parseNpmAudit(raw));

    for (const result of sarif.runs[0].results) {
      const remedy: string | undefined = result.properties.remedy;
      if (remedy?.startsWith("npm i ")) {
        expect(result.properties.reasons.join(" ")).toContain("direct dependency");
      }
    }
  });

  /**
   * A Security tab alert is the last place to print a command that does
   * nothing: the alert stays open, and the next person re-runs it.
   */
  it("sends a direct dependency the tree pins to overrides, not to npm i", () => {
    const findings = parseNpmAudit(raw);
    const direct = findings.find((f) => !f.transitive && f.fixedIn !== undefined);
    if (direct === undefined) return;

    const pinned = judge(findings, {
      baseline: emptyBaseline(),
      installed: fromPackages({
        [`node_modules/${direct.packageName}`]: { version: "0.0.1" },
        "node_modules/someone-else": { dependencies: { [direct.packageName]: "^0.0.1" } },
      }),
    });
    const alert = JSON.parse(renderSarif(pinned)).runs[0].results.find(
      (r: { ruleId: string }) => r.ruleId === direct.advisoryId,
    );

    expect(alert.properties.remedy).toContain("overrides");
    expect(alert.properties.remedy).not.toContain("npm i ");
  });

  it("stays quiet when there is no published fix", () => {
    const unfixable = parseNpmAudit(raw).filter(
      (finding) => finding.fixedIn === undefined && !finding.fixAvailable,
    );
    if (unfixable.length === 0) return;

    const sarif = build(unfixable);
    for (const result of sarif.runs[0].results) {
      expect(result.properties.remedy).toBeUndefined();
    }
  });
});
