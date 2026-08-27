/**
 * Closing the loop: someone upgrades a package, re-runs, and finds out whether
 * it worked.
 *
 * The trap this guards against is claiming credit for a disappearance we did
 * not cause. A finding also vanishes when the scanner that found it stopped
 * running, and telling someone their vulnerability is gone when nobody looked
 * for it is the same failure as reporting an unscanned project clean.
 */

import { describe, expect, it } from "vitest";

import { applyBaseline, baselineFrom, parseBaseline, serializeBaseline } from "../src/baseline.js";
import { SCHEMA_VERSION } from "../src/fingerprint.js";
import type { RankedFinding } from "../src/triage.js";

const ranked = (fingerprint: string, tool: string): RankedFinding =>
  ({
    finding: {
      fingerprint,
      sources: [{ tool }],
      // A real finding always carries these — merge guarantees it. The stub
      // used to omit them, which quietly made the fixture a worse liar than
      // the type allowed.
      ecosystem: "npm",
      packageName: `pkg-${fingerprint}`,
      advisoryId: `CVE-${fingerprint}`,
      aliases: [`CVE-${fingerprint}`],
      severity: "high",
    },
    score: 100,
    reasons: [],
  }) as unknown as RankedFinding;

const NPM = "npm audit";
const OSV = "osv-scanner";

describe("findings that stopped being reported", () => {
  it("names the ones that are gone", () => {
    const before = [ranked("aaa", NPM), ranked("bbb", NPM)];
    const baseline = baselineFrom(before, [NPM]);

    const after = applyBaseline([ranked("aaa", NPM)], baseline, [NPM]);

    expect(after.noLongerReported).toEqual(["bbb"]);
    expect(after.suppressed).toHaveLength(1);
    expect(after.fresh).toHaveLength(0);
  });

  it("keeps quiet about doubt when every recorded source ran again", () => {
    const baseline = baselineFrom([ranked("aaa", NPM), ranked("bbb", NPM)], [NPM]);

    const after = applyBaseline([ranked("aaa", NPM)], baseline, [NPM]);

    // osv-scanner was absent both times. Warning about it here would be noise,
    // and noise in this line is how the line stops being read.
    expect(after.missingSources).toEqual([]);
  });

  it("names the source whose absence could explain the disappearance", () => {
    const baseline = baselineFrom([ranked("aaa", NPM), ranked("bbb", OSV)], [NPM, OSV]);

    const after = applyBaseline([ranked("aaa", NPM)], baseline, [NPM]);

    expect(after.noLongerReported).toEqual(["bbb"]);
    expect(after.missingSources).toEqual([OSV]);
  });

  it("admits it cannot tell for a baseline recorded before sources existed", () => {
    const old = parseBaseline(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, accepted: ["aaa", "bbb"] }),
    );

    const after = applyBaseline([ranked("aaa", NPM)], old, [NPM]);

    // Nothing to compare against, so no claim either way about the cause.
    expect(after.noLongerReported).toEqual(["bbb"]);
    expect(after.missingSources).toEqual([]);
  });

  it("survives a round trip through the file", () => {
    const baseline = baselineFrom([ranked("aaa", NPM)], [OSV, NPM]);

    expect(parseBaseline(serializeBaseline(baseline)).sources).toEqual([NPM, OSV]);
  });

  it("claims nothing when the fingerprint recipe changed under it", () => {
    // Read from a v1 file, which is the only way a schema this old exists.
    const stale = parseBaseline(
      JSON.stringify({ schemaVersion: "0", accepted: ["aaa"], sources: [NPM] }),
    );

    const after = applyBaseline([ranked("aaa", NPM)], stale, [NPM]);

    // Every fingerprint was computed differently, so "missing" would mean
    // "renamed", not "fixed".
    expect(after.noLongerReported).toEqual([]);
    expect(after.warning).toBeDefined();
  });
});
