/**
 * One range, written two ways, by us.
 *
 * `renderRanges` in ingest/osv.ts builds `< 0.2.4` from OSV's event list.
 * npm writes `<0.2.4` and we take it verbatim. So the same advisory arrives
 * as two strings, one of which we produced — and `siblingKey` includes the
 * range, so the two findings never matched as suspected duplicates. See #151.
 */
import { describe, expect, it } from "vitest";

import { mergeFindings } from "../src/merge.js";
import { normalizeRange } from "../src/normalize.js";
import type { ScaFinding } from "../src/finding.js";

describe("normalizeRange", () => {
  it("closes the gap after a comparison operator", () => {
    expect(normalizeRange("< 0.2.4")).toBe("<0.2.4");
    expect(normalizeRange(">= 1.0.0")).toBe(">=1.0.0");
    expect(normalizeRange("= 1.2.3")).toBe("=1.2.3");
  });

  it("keeps the space that separates two clauses", () => {
    expect(normalizeRange(">= 1.0.0 < 2.0.0")).toBe(">=1.0.0 <2.0.0");
    expect(normalizeRange(">=1.0.0 <2.0.0")).toBe(">=1.0.0 <2.0.0");
  });

  it("leaves a hyphen range alone", () => {
    // `1.0.0 - 2.0.0` is a range whose separator is a hyphen, not an operator
    // with a version after it.
    expect(normalizeRange("1.0.0 - 2.0.0")).toBe("1.0.0 - 2.0.0");
  });

  it("is idempotent, since both ingesters call it", () => {
    const once = normalizeRange("< 0.2.4 || >= 1.0.0 < 2.0.0");
    expect(normalizeRange(once)).toBe(once);
  });

  it("does what normalizeText does as well", () => {
    expect(normalizeRange("<0.2.4\r\n")).toBe("<0.2.4\n");
  });
});

const finding = (advisory: string, range: string): ScaFinding =>
  ({
    kind: "SCA",
    fingerprint: `fp-${advisory}`,
    severity: "high",
    title: `something in left-pad`,
    ecosystem: "npm",
    packageName: "left-pad",
    vulnerableRange: range,
    fixAvailable: true,
    advisoryId: advisory,
    // Disjoint on purpose: this is the case the alias join cannot reach, and
    // the one `possibleDuplicates` exists for.
    aliases: [advisory],
    transitive: true,
    sources: [{ tool: advisory.startsWith("CVE") ? "osv-scanner" : "npm-audit", ruleId: advisory }],
  }) as ScaFinding;

describe("two spellings of one range", () => {
  it("are suspected siblings", () => {
    const merged = mergeFindings([
      finding("GHSA-aaaa", "<0.2.4"),
      finding("CVE-2020-1", "< 0.2.4"),
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0]?.relatedTo).toHaveLength(1);
    expect(merged[1]?.relatedTo).toHaveLength(1);
  });

  it("do not read as two sources disagreeing about the range", () => {
    const merged = mergeFindings([
      finding("GHSA-aaaa", "<0.2.4"),
      finding("CVE-2020-1", "< 0.2.4"),
    ]);

    for (const entry of merged) {
      expect(entry.vulnerableRange).toBe("<0.2.4");
      expect(entry.vulnerableRange).not.toContain("|");
    }
  });
});

describe("genuinely different ranges", () => {
  it("are still shown as different, and are not siblings", () => {
    const merged = mergeFindings([
      finding("GHSA-aaaa", "<0.2.4"),
      finding("CVE-2020-1", "<0.3.0"),
    ]);

    expect(merged[0]?.relatedTo).toHaveLength(0);
    expect(merged[1]?.relatedTo).toHaveLength(0);
  });
});
