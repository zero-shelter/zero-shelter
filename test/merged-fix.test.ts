/**
 * Preserve the highest reported fix when scanners report different fixed
 * versions for the same advisory.
 */

import { describe, expect, it } from "vitest";

import { mergeFindings } from "../src/merge.js";
import { upgradeActions } from "../src/actions.js";
import { rank } from "../src/triage.js";
import type { ScaFinding } from "../src/finding.js";

const finding = (tool: string, fixedIn: string | undefined): ScaFinding =>
  ({
    kind: "SCA",
    fingerprint: `${tool}-x`,
    severity: "critical",
    title: "Prototype pollution",
    ecosystem: "npm",
    packageName: "lodash",
    vulnerableRange: "<4.17.21",
    fixAvailable: fixedIn !== undefined,
    fixedIn,
    advisoryId: "GHSA-JF85-CPCP-J695",
    aliases: ["GHSA-JF85-CPCP-J695", "CVE-2019-10744"],
    transitive: false,
    sources: [{ tool, ruleId: "GHSA-JF85-CPCP-J695" }],
  }) as unknown as ScaFinding;

describe("a fix version two sources disagree about", () => {
  it("keeps the fix and picks the version that satisfies both", () => {
    const [merged] = mergeFindings([
      finding("npm-audit", "4.18.1"),
      finding("osv-scanner", "4.17.21"),
    ]);

    expect(merged!.fixedIn).toBe("4.18.1");
    expect(merged!.fixVersionsClaimed).toEqual(["4.17.21", "4.18.1"]);
  });

  it("still produces the command", () => {
    const merged = mergeFindings([
      finding("npm-audit", "4.18.1"),
      finding("osv-scanner", "4.17.21"),
    ]);

    expect(upgradeActions(rank(merged))[0]?.command).toBe("npm i lodash@4.18.1");
  });

  it("says nothing about disagreement when there is none", () => {
    const [merged] = mergeFindings([
      finding("npm-audit", "4.18.1"),
      finding("osv-scanner", "4.18.1"),
    ]);

    expect(merged!.fixedIn).toBe("4.18.1");
    expect(merged!.fixVersionsClaimed).toBeUndefined();
  });

  it("reports no fix when neither source knows of one", () => {
    const [merged] = mergeFindings([
      finding("npm-audit", undefined),
      finding("osv-scanner", undefined),
    ]);

    expect(merged!.fixedIn).toBeUndefined();
    expect(merged!.fixAvailable).toBe(false);
  });

  it("takes the one version on offer when only one source knows", () => {
    const [merged] = mergeFindings([
      finding("npm-audit", undefined),
      finding("osv-scanner", "4.17.21"),
    ]);

    expect(merged!.fixedIn).toBe("4.17.21");
    expect(merged!.fixVersionsClaimed).toBeUndefined();
  });
});
