import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { parseOsv } from "../src/ingest/osv.js";
import { mergeFindings } from "../src/merge.js";
import { rank } from "../src/triage.js";
import { judge } from "../src/judge.js";
import {
  applyBaseline,
  baselineFrom,
  emptyBaseline,
  parseBaseline,
  serializeBaseline,
} from "../src/baseline.js";
import { renderExplain, renderHuman, renderJson } from "../src/report.js";
import type { ScaFinding } from "../src/finding.js";

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const npmFindings = parseNpmAudit(read("npm-audit.json"));
const osvFindings = parseOsv(read("osv-scanner.json"), "1.9.0");
const both = [...npmFindings, ...osvFindings];

describe("parseOsv", () => {
  it("matches the recorded shape", () => {
    expect(osvFindings).toMatchSnapshot();
  });

  /**
   * osv-scanner reports a package once per lockfile it appears in. A monorepo
   * would otherwise look like cross-scanner duplication when it is really one
   * tool listing the same thing twice.
   */
  it("collapses the same advisory reported from several lockfiles", () => {
    expect(osvFindings.filter((f) => f.packageName === "semver")).toHaveLength(1);
  });

  it("prefers the CVE when the advisory carries both names", () => {
    const semver = osvFindings.find((f) => f.packageName === "semver");
    expect(semver?.advisoryId).toBe("CVE-2022-25883");
    expect(semver?.aliases).toEqual(["CVE-2022-25883", "GHSA-C2QF-RXJJ-QQGW"]);
  });

  it("renders OSV event ranges into something a human can read", () => {
    expect(osvFindings.find((f) => f.packageName === "semver")?.vulnerableRange).toBe(
      "< 5.7.2",
    );
    expect(osvFindings.find((f) => f.packageName === "lodash")?.vulnerableRange).toBe(
      ">= 4.0.0 < 4.17.12",
    );
  });

  it("falls back to the installed version when the advisory has no usable range", () => {
    const raw = JSON.parse(read("osv-scanner.json"));
    raw.results = [raw.results[1]];
    expect(parseOsv(JSON.stringify(raw))[0]?.vulnerableRange).toBe("= 5.7.1");
  });

  it("is stable across runs and input order", () => {
    expect(parseOsv(read("osv-scanner.json"), "1.9.0")).toEqual(osvFindings);
  });
});

describe("mergeFindings", () => {
  /**
   * The whole point. npm audit knows this as a GHSA, osv-scanner knows it as
   * both a GHSA and a CVE. They join on the GHSA.
   */
  it("joins two tools reporting one advisory under different primary ids", () => {
    const merged = mergeFindings(both).filter((f) => f.packageName === "minimist");
    expect(merged).toHaveLength(1);
    expect(merged[0]?.tools).toEqual(["npm-audit", "osv-scanner"]);
    expect(merged[0]?.advisoryId).toBe("CVE-2021-44906");
  });

  it("does not join different packages", () => {
    const packages = mergeFindings(both).map((f) => f.packageName);
    expect(new Set(packages).size).toBe(packages.length);
  });

  /**
   * Two npm audit advisories for semver — one linked to GitHub, one to NVD.
   * They are the same vulnerability but share no identifier, so the join
   * cannot see it. We surface the suspicion instead of guessing.
   */
  it("flags same-package findings it could not join instead of merging them", () => {
    const merged = mergeFindings(npmFindings).filter((f) => f.packageName === "semver");
    expect(merged).toHaveLength(2);
    expect(merged[0]?.relatedTo).toContain(merged[1]?.fingerprint);
    expect(merged[1]?.relatedTo).toContain(merged[0]?.fingerprint);
  });

  it("does not depend on the order findings arrive in", () => {
    const forward = mergeFindings(both);
    const reverse = mergeFindings([...both].reverse());
    expect(reverse.map((f) => f.fingerprint)).toEqual(forward.map((f) => f.fingerprint));
    expect(reverse.map((f) => f.tools)).toEqual(forward.map((f) => f.tools));
  });

  it("takes the worst severity across members", () => {
    const merged = mergeFindings(both).find((f) => f.packageName === "minimist");
    expect(merged?.severity).toBe("critical");
  });

  it("treats a package as direct when any source says so", () => {
    const merged = mergeFindings(both).find((f) => f.packageName === "semver");
    expect(merged?.transitive).toBe(false);
  });

  /**
   * Naming one of two disagreeing fixes would tell the reader to install a
   * version that does not fix the branch they are on.
   */
  it("withholds fixedIn when sources disagree", () => {
    const conflicting: ScaFinding[] = [
      base({ fixedIn: "1.0.0", sources: [{ tool: "a", ruleId: "CVE-2024-1" }] }),
      base({ fixedIn: "2.0.0", sources: [{ tool: "b", ruleId: "CVE-2024-1" }] }),
    ];
    expect(mergeFindings(conflicting)[0]?.fixedIn).toBeUndefined();
  });

  it("keeps both ranges when sources describe them differently", () => {
    const differing: ScaFinding[] = [
      base({ vulnerableRange: "<1.0.0", sources: [{ tool: "a", ruleId: "CVE-2024-1" }] }),
      base({ vulnerableRange: "< 1.0.0", sources: [{ tool: "b", ruleId: "CVE-2024-1" }] }),
    ];
    expect(mergeFindings(differing)[0]?.vulnerableRange).toBe("< 1.0.0 | <1.0.0");
  });

  it("joins a chain of findings linked through intermediate aliases", () => {
    const chain: ScaFinding[] = [
      base({ aliases: ["CVE-2024-1", "GHSA-aaaa-bbbb-cccc"], sources: [{ tool: "a", ruleId: "x" }] }),
      base({ aliases: ["GHSA-aaaa-bbbb-cccc", "OSV-1"], sources: [{ tool: "b", ruleId: "y" }] }),
      base({ aliases: ["OSV-1"], sources: [{ tool: "c", ruleId: "z" }] }),
    ];
    const merged = mergeFindings(chain);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.tools).toEqual(["a", "b", "c"]);
  });

  it("does not join across packages even if an advisory id is shared", () => {
    const shared: ScaFinding[] = [
      base({ packageName: "one", sources: [{ tool: "a", ruleId: "x" }] }),
      base({ packageName: "two", sources: [{ tool: "b", ruleId: "y" }] }),
    ];
    expect(mergeFindings(shared)).toHaveLength(2);
  });
});

describe("rank", () => {
  it("scores with integers only", () => {
    for (const entry of rank(mergeFindings(both))) {
      expect(Number.isInteger(entry.score)).toBe(true);
      for (const reason of entry.reasons) expect(Number.isInteger(reason.points)).toBe(true);
    }
  });

  it("reasons sum to the score", () => {
    for (const entry of rank(mergeFindings(both))) {
      const sum = entry.reasons.reduce((total, r) => total + r.points, 0);
      expect(sum).toBe(entry.score);
    }
  });

  it("is deterministic regardless of input order", () => {
    const forward = rank(mergeFindings(both)).map((e) => e.finding.fingerprint);
    const reverse = rank(mergeFindings([...both].reverse())).map((e) => e.finding.fingerprint);
    expect(reverse).toEqual(forward);
  });

  it("puts a critical direct dependency with a known fix on top", () => {
    expect(rank(mergeFindings(both))[0]?.finding.packageName).toBe("minimist");
  });
});

describe("baseline", () => {
  it("suppresses what was accepted and keeps what is new", () => {
    const ranked = rank(mergeFindings(both));
    const baseline = baselineFrom(ranked.slice(0, 2));
    const applied = applyBaseline(ranked, baseline);

    expect(applied.suppressed).toHaveLength(2);
    expect(applied.fresh).toHaveLength(ranked.length - 2);
    expect(applied.warning).toBeUndefined();
  });

  /**
   * A stale baseline suppresses nothing, which looks identical to a sudden
   * regression. It has to say so out loud.
   */
  it("reports everything as new and warns when the schema moved", () => {
    const ranked = rank(mergeFindings(both));
    const applied = applyBaseline(ranked, { schemaVersion: "0", accepted: ["whatever"] });

    expect(applied.fresh).toHaveLength(ranked.length);
    expect(applied.warning).toMatch(/schema/);
  });

  it("survives a serialize/parse round trip", () => {
    const baseline = baselineFrom(rank(mergeFindings(both)));
    expect(parseBaseline(serializeBaseline(baseline))).toEqual(baseline);
  });

  it("rejects a malformed baseline rather than silently ignoring it", () => {
    expect(() => parseBaseline("{}")).toThrow(/schemaVersion/);
    expect(() => parseBaseline('{"schemaVersion":"1","accepted":[1]}')).toThrow(/strings/);
    expect(() => parseBaseline("[]")).toThrow(/JSON object/);
  });
});

describe("judge", () => {
  const result = judge(both, { baseline: emptyBaseline(), skipped: ["osv-scanner skipped"] });

  it("reports fewer findings than it was given", () => {
    expect(result.merged).toBeLessThan(result.raw);
  });

  it("honours --top without changing the counts it reports", () => {
    const capped = judge(both, { baseline: emptyBaseline(), top: 2 });
    expect(capped.fixNow).toHaveLength(2);
    expect(capped.raw).toBe(result.raw);
    expect(capped.merged).toBe(result.merged);
  });

  it("re-running after recording the baseline finds nothing new", () => {
    const baseline = baselineFrom(result.fixNow);
    expect(judge(both, { baseline }).fixNow).toHaveLength(0);
  });
});

describe("report", () => {
  const result = judge(both, { baseline: emptyBaseline(), skipped: ["osv-scanner skipped: not on PATH"] });

  it("renders a table without escape codes when colour is off", () => {
    const text = renderHuman(result, false);
    expect(text).not.toMatch(/\[/);
    expect(text).toContain("fix these");
    expect(text).toContain("less noise");
  });

  it("emits colour only when asked", () => {
    expect(renderHuman(result, true)).toMatch(/\[/);
  });

  it("says so plainly when nothing is new", () => {
    const clean = judge(both, { baseline: baselineFrom(result.fixNow) });
    expect(renderHuman(clean, false)).toContain("nothing new to fix");
  });

  it("shows the skipped scanners rather than hiding them", () => {
    expect(renderHuman(result, false)).toContain("osv-scanner skipped");
  });

  /**
   * A first run reduces nothing and prints "0% less noise", which reads as the
   * tool not working. It has to say what the first run is for.
   */
  it("tells a first-time user what to do instead of reporting 0% reduction", () => {
    const first = judge(both, { baseline: emptyBaseline(), baselineExists: false });
    expect(renderHuman(first, false)).toContain("--update-baseline");
    expect(renderHuman(result, false)).not.toContain("--update-baseline");
  });

  it("explains every point it awarded", () => {
    const explain = renderExplain(result);
    for (const entry of result.fixNow) {
      expect(explain).toContain(entry.finding.advisoryId);
      for (const reason of entry.reasons) expect(explain).toContain(reason.label);
    }
  });

  /**
   * With osv-scanner present the two semver findings do join, so this needs
   * the npm-audit-only view — which is exactly the situation the note exists
   * for: one tool, two advisories, no shared identifier.
   */
  it("names what it declined to merge", () => {
    const alone = judge(npmFindings, { baseline: emptyBaseline() });
    expect(renderExplain(alone)).toContain("no shared advisory id");
    expect(renderHuman(alone, false)).toContain("may duplicate another");
  });

  /**
   * The clearest demonstration of what this tool is for: npm audit alone
   * reports semver twice under identifiers that cannot be matched, and adding
   * a second scanner supplies the alias that joins them.
   */
  it("collapses a duplicate once a second scanner supplies the missing alias", () => {
    const alone = judge(npmFindings, { baseline: emptyBaseline() });
    const together = judge(both, { baseline: emptyBaseline() });

    expect(alone.fixNow.filter((e) => e.finding.packageName === "semver")).toHaveLength(2);
    expect(together.fixNow.filter((e) => e.finding.packageName === "semver")).toHaveLength(1);
  });

  it("produces JSON carrying the same counts as the table", () => {
    const json = JSON.parse(renderJson(result));
    expect(json.summary.raw).toBe(result.raw);
    expect(json.summary.merged).toBe(result.merged);
    expect(json.summary.fixNow).toBe(result.fixNow.length);
    expect(json.fixNow).toHaveLength(result.fixNow.length);
  });

  it("keeps the JSON free of the member findings, which agents pay for", () => {
    expect(renderJson(result)).not.toContain('"members"');
  });
});

function base(overrides: Partial<ScaFinding> = {}): ScaFinding {
  return {
    kind: "SCA",
    fingerprint: "test",
    severity: "high",
    title: "test",
    ecosystem: "npm",
    packageName: "pkg",
    vulnerableRange: "<1.0.0",
    fixAvailable: false,
    advisoryId: "CVE-2024-1",
    aliases: ["CVE-2024-1"],
    transitive: true,
    sources: [{ tool: "test", ruleId: "CVE-2024-1" }],
    ...overrides,
  };
}
