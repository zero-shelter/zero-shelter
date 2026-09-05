/**
 * The baseline is a record someone has to defend later.
 *
 * `reason`, `acceptedBy` and `expires` are written by a person — that is the
 * only reason those fields exist. And the skills prescribe `--update-baseline`
 * as the way to prune the file once a fix lands, so the command we tell people
 * to run was quietly destroying the audit trail on every prune.
 */
import { describe, expect, it } from "vitest";

import {
  applyBaseline,
  baselineFrom,
  parseBaseline,
  serializeBaseline,
  type AcceptedFinding,
} from "../src/baseline.js";
import { SCHEMA_VERSION } from "../src/fingerprint.js";
import { rank } from "../src/triage.js";
import { mergeFindings } from "../src/merge.js";
import type { ScaFinding } from "../src/finding.js";

const finding = (advisoryId: string, aliases = [advisoryId]): ScaFinding =>
  ({
    kind: "SCA",
    fingerprint: `fp-${advisoryId}`,
    severity: "high",
    title: `something in tar (${advisoryId})`,
    ecosystem: "npm",
    packageName: "tar",
    vulnerableRange: "<7",
    fixAvailable: true,
    fixedIn: "7.0.0",
    advisoryId,
    aliases,
    transitive: false,
    sources: [{ tool: "npm-audit", ruleId: advisoryId }],
  }) as unknown as ScaFinding;

const ranked = (...ids: string[]) => rank(mergeFindings(ids.map((id) => finding(id))));

describe("re-recording a baseline", () => {
  const first = baselineFrom(ranked("CVE-1"), ["npm-audit"], "2026-01-15");
  const annotated: AcceptedFinding[] = first.accepted.map((entry) => ({
    ...entry,
    reason: "reviewed by security",
    acceptedBy: "hadevyi",
    expires: "2026-12-31",
  }));

  const pruned = baselineFrom(ranked("CVE-1"), ["npm-audit"], "2026-08-28", {
    ...first,
    accepted: annotated,
  });

  it("keeps what a person wrote by hand", () => {
    expect(pruned.accepted[0]).toMatchObject({
      reason: "reviewed by security",
      acceptedBy: "hadevyi",
      expires: "2026-12-31",
    });
  });

  it("keeps when the acceptance was made, not when the file was tidied", () => {
    expect(pruned.accepted[0]?.recordedAt).toBe("2026-01-15");
  });

  it("dates a genuinely new acceptance with today", () => {
    const grown = baselineFrom(ranked("CVE-1", "CVE-2"), ["npm-audit"], "2026-08-28", {
      ...first,
      accepted: annotated,
    });
    const fresh = grown.accepted.find((entry) => entry.advisory === "CVE-2");
    expect(fresh?.recordedAt).toBe("2026-08-28");
    expect(fresh?.reason).toBeUndefined();
  });

  it("drops an acceptance for something no longer reported", () => {
    expect(pruned.accepted).toHaveLength(1);
  });
});

/**
 * An expiry decides whether a build goes red. Compared as text, `2027-1-1`
 * sorts after `2027-01-01` and `26-12-31` sorts before everything — so a typo
 * silently becomes "never expires", which turns a gate green.
 */
describe("an expiry we cannot compare", () => {
  const withExpires = (expires: string): string =>
    JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      accepted: [
        {
          fingerprint: "fp-CVE-1",
          ecosystem: "npm",
          package: "tar",
          advisory: "CVE-1",
          aliases: ["CVE-1"],
          severity: "high",
          expires,
        },
      ],
    });

  it("is rejected rather than treated as never expiring", () => {
    expect(() => parseBaseline(withExpires("2027-1-1"))).toThrow(/YYYY-MM-DD/);
    expect(() => parseBaseline(withExpires("next tuesday"))).toThrow(/YYYY-MM-DD/);
    expect(() => parseBaseline(withExpires("2026-12-31T00:00:00Z"))).toThrow(/YYYY-MM-DD/);
  });

  it("names the acceptance, so the file can be fixed", () => {
    expect(() => parseBaseline(withExpires("nope"))).toThrow(/fp-CVE-1/);
  });

  it("accepts a real date", () => {
    expect(parseBaseline(withExpires("2026-12-31")).accepted[0]?.expires).toBe("2026-12-31");
  });

  /**
   * The shape check passes and the date does not exist. `9999-99-99` sorts
   * above every real date, so it is the mistyped-date-that-sorts-high case
   * the rejection was written for, arriving through the check meant to stop
   * it. A generator writing a sentinel produces the same thing.
   */
  it.each([
    ["9999-99-99", "sorts above every real date and would never expire"],
    ["2026-13-01", "month 13"],
    ["2026-00-10", "month 0"],
    ["2026-01-32", "the plausible typo"],
    ["2026-02-31", "rolls forward to March if parsed loosely"],
    ["2026-02-29", "2026 is not a leap year"],
  ])("rejects %s — %s", (value) => {
    expect(() => parseBaseline(withExpires(value))).toThrow(/YYYY-MM-DD/);
  });

  it("accepts a real leap day", () => {
    expect(parseBaseline(withExpires("2024-02-29")).accepted[0]?.expires).toBe("2024-02-29");
  });
});

/**
 * Two acceptances in one package can share an alias — that is how the sources
 * said they were related. Indexing by alias with a single value meant the
 * loser was never matched again and got announced as resolved while it was
 * still being reported.
 */
describe("two acceptances that share an alias", () => {
  it("both stay matched, and neither is called resolved", () => {
    // Only the shared alias links them, which is the case the index used to
    // lose: keyed by alias with a single value, the second acceptance
    // overwrote the first and the first was never reachable again.
    const accept = (fingerprint: string) => ({
      fingerprint,
      ecosystem: "npm",
      package: "tar",
      advisory: fingerprint,
      aliases: ["GHSA-shared"],
      severity: "high",
    });
    const baseline = {
      schemaVersion: SCHEMA_VERSION,
      accepted: [accept("fp-A"), accept("fp-B")],
    };

    const present = [
      {
        // A fingerprint in neither acceptance, so only the alias can reach them.
        finding: { ...finding("CVE-A", ["GHSA-shared"]), fingerprint: "fp-moved" },
        score: 1,
        reasons: [],
      },
    ] as never;

    const applied = applyBaseline(present, baseline);

    expect(applied.suppressed).toHaveLength(1);
    // Both acceptances answered for. With a single-value index only the
    // second survived and the first was announced as resolved.
    expect(applied.noLongerReported).toEqual([]);
  });
});

describe("the file", () => {
  it("survives a round trip with every optional field set", () => {
    const baseline = {
      ...baselineFrom(ranked("CVE-1"), ["npm-audit"], "2026-01-15"),
      accepted: baselineFrom(ranked("CVE-1"), ["npm-audit"], "2026-01-15").accepted.map((e) => ({
        ...e,
        reason: "r",
        acceptedBy: "a",
        expires: "2026-12-31",
      })),
    };
    expect(parseBaseline(serializeBaseline(baseline))).toEqual(baseline);
  });
});
