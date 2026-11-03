/**
 * Preserve user-authored acceptance metadata when rebuilding a baseline.
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

describe("re-recording alias-rematched decisions", () => {
  const decision = {
    reason: "fixture risk decision",
    acceptedBy: "fixture-reviewer",
    expires: "2026-09-09",
    recordedAt: "2026-01-15",
  };
  const current = rank(mergeFindings([finding("CVE-1", ["CVE-1", "GHSA-SHARED"])]));
  const original = baselineFrom(ranked("CVE-1"));
  const accepted = { ...original.accepted[0]!, fingerprint: "fp-previous", ...decision };
  const previous = (entries: readonly AcceptedFinding[]) => ({ ...original, accepted: entries });

  it("preserves the decision and its expiry after a scanner adds aliases", () => {
    expect(current[0]?.finding.fingerprint).not.toBe(accepted.fingerprint);
    const before = previous([accepted]);
    const rewritten = baselineFrom(current, ["npm-audit", "osv-scanner"], "2026-09-10", before);

    expect(rewritten.accepted[0]).toMatchObject(decision);
    expect(applyBaseline(current, before, undefined, "2026-09-10").expired).toHaveLength(1);
    expect(applyBaseline(current, rewritten, undefined, "2026-09-10").expired).toHaveLength(1);
    expect(parseBaseline(serializeBaseline(rewritten))).toEqual(rewritten);
  });

  it("copies one merged decision to each split finding", () => {
    const split = ranked("CVE-1", "GHSA-SHARED");
    const merged = { ...baselineFrom(current).accepted[0]!, ...decision };
    const rewritten = baselineFrom(split, undefined, "2026-09-10", previous([merged]));

    expect(rewritten.accepted).toHaveLength(2);
    for (const entry of rewritten.accepted) expect(entry).toMatchObject(decision);
    expect(applyBaseline(split, rewritten, undefined, "2026-09-10").expired).toHaveLength(2);
  });

  it("merges identical decisions independently of their input order", () => {
    const second = { ...accepted, fingerprint: "fp-second", aliases: ["GHSA-SHARED"] };
    const forward = baselineFrom(current, undefined, "2026-09-10", previous([accepted, second]));
    const reverse = baselineFrom(current, undefined, "2026-09-10", previous([second, accepted]));

    expect(forward.accepted[0]).toMatchObject(decision);
    expect(serializeBaseline(reverse)).toBe(serializeBaseline(forward));
  });

  it.each(["reason", "acceptedBy", "expires", "recordedAt"] as const)(
    "rejects conflicting %s in original records, including duplicate fingerprints",
    (field) => {
      const changed = {
        ...accepted,
        [field]: field === "expires" ? "2026-12-31" : field === "recordedAt" ? "2026-01-16" : "different fixture value",
      };
      for (const fingerprint of [accepted.fingerprint, current[0]!.finding.fingerprint, "fp-second"]) {
        const second = { ...changed, fingerprint, aliases: ["GHSA-SHARED"] };
        for (const entries of [[accepted, second], [second, accepted]]) {
          expect(() => baselineFrom(current, undefined, "2026-09-10", previous(entries))).toThrow(
            new RegExp(field),
          );
        }
      }
    },
  );

  it.each(["reason", "acceptedBy", "expires", "recordedAt"] as const)(
    "distinguishes a missing %s before applying any date fallback",
    (field) => {
      const { [field]: omitted, ...missing } = accepted;
      const second = { ...missing, fingerprint: "fp-second", aliases: ["GHSA-SHARED"] };
      expect(omitted).toBeDefined();
      expect(() => baselineFrom(current, undefined, decision.recordedAt, previous([accepted, second]))).toThrow(
        new RegExp(field),
      );
    },
  );

  it.each(["reason", "acceptedBy"] as const)("distinguishes missing and empty %s", (field) => {
    const { [field]: omitted, ...missing } = accepted;
    const empty = { ...missing, fingerprint: "fp-second", aliases: ["GHSA-SHARED"], [field]: "" };
    expect(omitted).toBeDefined();
    expect(() => baselineFrom(current, undefined, "2026-09-10", previous([missing, empty]))).toThrow(
      new RegExp(field),
    );
  });

  it("fills a missing recordedAt only after compatible decisions have been compared", () => {
    const { recordedAt: omitted, ...missingDate } = accepted;
    const second = { ...missingDate, fingerprint: "fp-second", aliases: ["GHSA-SHARED"] };
    expect(omitted).toBeDefined();
    const rewritten = baselineFrom(current, undefined, "2026-09-10", previous([missingDate, second]));
    expect(rewritten.accepted[0]).toMatchObject({ ...decision, recordedAt: "2026-09-10" });
    expect(baselineFrom(current, undefined, undefined, previous([missingDate])).accepted[0]?.recordedAt).toBeUndefined();
  });

  it.each(["package", "ecosystem", "schema"] as const)("does not widen the %s boundary", (boundary) => {
    const before = previous([{
      ...accepted,
      ...(boundary === "package" ? { package: "another-package" } : {}),
      ...(boundary === "ecosystem" ? { ecosystem: "another-ecosystem" } : {}),
    }]);
    const rewritten = baselineFrom(current, undefined, "2026-09-10", {
      ...before,
      ...(boundary === "schema" ? { schemaVersion: "old-schema" } : {}),
    });
    expect(rewritten.accepted[0]?.reason).toBeUndefined();
    expect(rewritten.accepted[0]?.expires).toBeUndefined();
    expect(rewritten.accepted[0]?.recordedAt).toBe("2026-09-10");
  });

  it("retains legacy exact-match metadata across schema mismatch", () => {
    const rewritten = baselineFrom(ranked("CVE-1"), undefined, "2026-09-10", {
      ...previous([{ ...accepted, fingerprint: ranked("CVE-1")[0]!.finding.fingerprint }]),
      schemaVersion: "old-schema",
    });
    expect(rewritten.accepted[0]).toMatchObject(decision);
  });

  it("does not follow aliases transitively through earlier records", () => {
    const first = { ...accepted, aliases: ["CVE-1", "GHSA-BRIDGE"] };
    const second = {
      ...accepted,
      fingerprint: "fp-second",
      aliases: ["GHSA-BRIDGE", "CVE-OTHER"],
      reason: "unrelated fixture decision",
    };
    expect(baselineFrom(current, undefined, "2026-09-10", previous([first, second])).accepted[0]).toMatchObject(decision);
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
