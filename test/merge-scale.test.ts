/**
 * Guard indexed sibling detection against semantic changes and quadratic
 * runtime. The timing bound allows headroom for busy CI runners.
 */

import { describe, expect, it } from "vitest";

import { mergeFindings } from "../src/merge.js";
import type { ScaFinding } from "../src/finding.js";

const finding = (packageName: string, advisoryId: string, range = "<1.0.0"): ScaFinding =>
  ({
    kind: "SCA",
    fingerprint: `${packageName}-${advisoryId}`,
    severity: "high",
    title: "Something",
    ecosystem: "npm",
    packageName,
    vulnerableRange: range,
    fixAvailable: false,
    advisoryId,
    aliases: [advisoryId],
    transitive: false,
    sources: [{ tool: "npm-audit", ruleId: advisoryId }],
  }) as unknown as ScaFinding;

describe("suspected siblings", () => {
  it("pairs findings that share a package and range but no identifier", () => {
    const merged = mergeFindings([
      finding("lodash", "CVE-2024-1"),
      finding("lodash", "CVE-2024-2"),
      finding("minimist", "CVE-2024-3"),
    ]);

    const lodash = merged.filter((entry) => entry.packageName === "lodash");
    expect(lodash[0]!.relatedTo).toEqual([lodash[1]!.fingerprint]);
    expect(lodash[1]!.relatedTo).toEqual([lodash[0]!.fingerprint]);

    const minimist = merged.find((entry) => entry.packageName === "minimist");
    expect(minimist!.relatedTo).toEqual([]);
  });

  it("does not pair different ranges of the same package", () => {
    const merged = mergeFindings([
      finding("lodash", "CVE-2024-1", "<1.0.0"),
      finding("lodash", "CVE-2024-2", "<2.0.0"),
    ]);

    expect(merged.every((entry) => entry.relatedTo.length === 0)).toBe(true);
  });

  it("never lists a finding as its own sibling", () => {
    const merged = mergeFindings([finding("lodash", "CVE-2024-1")]);

    expect(merged[0]!.relatedTo).toEqual([]);
  });

  it("stays fast enough to be usable on a large tree", () => {
    const many: ScaFinding[] = [];
    for (let i = 0; i < 8000; i += 1) {
      many.push(finding(`pkg-${i % 500}`, `CVE-2024-${i}`));
    }

    const started = Date.now();
    const merged = mergeFindings(many);
    const elapsed = Date.now() - started;

    expect(merged).toHaveLength(8000);
    // Quadratic scanning took ~1s for this shape; the index is ~30ms. Anything
    // under a second means the index is still there.
    expect(elapsed).toBeLessThan(1000);
  });
});
