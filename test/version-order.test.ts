/**
 * Picking the highest published fix.
 *
 * This module decides which version reaches the reader as a command, so a
 * wrong answer here is an upgrade that does not fix what `clears N` says it
 * clears. It had no test of its own until #169, and two cases were wrong.
 */
import { describe, expect, it } from "vitest";

import { highest, isHigher } from "../src/version-order.js";

describe("release numbers", () => {
  it("does not order them as strings", () => {
    // The case the module exists for: 4.17.21 sorts above 4.18.1 as text.
    expect(isHigher("4.18.1", "4.17.21")).toBe(true);
    expect(isHigher("4.17.21", "4.18.1")).toBe(false);
  });

  it("treats a missing segment as zero rather than as unknown", () => {
    expect(isHigher("1.0", "1.0.0")).toBe(false);
    expect(isHigher("1.0.0", "1.0")).toBe(false);
    expect(isHigher("1.0.1", "1.0")).toBe(true);
  });

  it("ignores build metadata, which carries no precedence", () => {
    expect(isHigher("1.0.0+build.2", "1.0.0+build.1")).toBe(false);
    expect(isHigher("1.0.1+build", "1.0.0")).toBe(true);
  });
});

describe("a leading v", () => {
  /**
   * `parseInt("v2")` is NaN, and segments() dropped it — so `v2.0.0` compared
   * as `[0, 0]` and lost to everything.
   */
  it("is a prefix, not a lower major", () => {
    expect(isHigher("v2.0.0", "1.0.0")).toBe(true);
    expect(isHigher("1.0.0", "v2.0.0")).toBe(false);
    expect(isHigher("v2.0.0", "v1.0.0")).toBe(true);
    expect(isHigher("v1.0.0", "2.0.0")).toBe(false);
  });

  it("does not make two spellings of one version differ", () => {
    expect(isHigher("v1.0.0", "1.0.0")).toBe(false);
    expect(isHigher("1.0.0", "v1.0.0")).toBe(false);
  });
});

describe("prereleases", () => {
  it("rank below the release they precede", () => {
    expect(isHigher("2.0.0", "2.0.0-rc.1")).toBe(true);
    expect(isHigher("2.0.0-rc.1", "2.0.0")).toBe(false);
  });

  /**
   * Both sides reduced to the same release numbers, and the tiebreak asked
   * only whether one of them was a prerelease. When both were, it answered
   * "not higher" in each direction and `highest` kept whichever it saw first.
   */
  it("rank against each other", () => {
    expect(isHigher("2.0.0-rc.2", "2.0.0-rc.1")).toBe(true);
    expect(isHigher("2.0.0-rc.1", "2.0.0-rc.2")).toBe(false);
  });

  it("compare numeric identifiers as numbers", () => {
    expect(isHigher("1.0.0-rc.10", "1.0.0-rc.9")).toBe(true);
  });

  it("compare alphanumeric identifiers as text", () => {
    expect(isHigher("1.0.0-beta", "1.0.0-alpha")).toBe(true);
    expect(isHigher("1.0.0-alpha", "1.0.0-beta")).toBe(false);
  });

  it("rank a numeric identifier below an alphanumeric one", () => {
    // semver.org §11: "Numeric identifiers always have lower precedence than
    // non-numeric identifiers."
    expect(isHigher("1.0.0-alpha", "1.0.0-1")).toBe(true);
    expect(isHigher("1.0.0-1", "1.0.0-alpha")).toBe(false);
  });

  /**
   * semver puts no ceiling on a numeric identifier, and `Number` does. Two
   * that differ past 2^53 collapse to the same double, the comparison falls
   * through to "higher", and `isHigher` answers true in both directions —
   * which makes `highest` depend on the order it saw them in. That is the bug
   * this whole module exists to not have.
   */
  it("compare numeric identifiers beyond what a double can hold", () => {
    const low = "1.0.0-9007199254740992";
    const high = "1.0.0-9007199254740993";

    expect(Number("9007199254740992")).toBe(Number("9007199254740993"));

    expect(isHigher(high, low)).toBe(true);
    expect(isHigher(low, high)).toBe(false);
    expect(highest([low, high])).toBe(high);
    expect(highest([high, low])).toBe(high);
  });

  it("treats two identical prereleases as neither higher", () => {
    expect(isHigher("1.0.0-rc.1", "1.0.0-rc.1")).toBe(false);
    expect(isHigher("1.0.0-alpha.beta", "1.0.0-alpha.beta")).toBe(false);
  });

  it("rank a longer identifier list above its own prefix", () => {
    expect(isHigher("1.0.0-alpha.1", "1.0.0-alpha")).toBe(true);
    expect(isHigher("1.0.0-alpha", "1.0.0-alpha.1")).toBe(false);
  });

  it("ignores build metadata on a prerelease", () => {
    expect(isHigher("1.0.0-rc.1+b", "1.0.0-rc.1")).toBe(false);
    expect(isHigher("1.0.0-rc.2+b", "1.0.0-rc.1")).toBe(true);
  });
});

describe("highest", () => {
  it("is undefined for nothing", () => {
    expect(highest([])).toBeUndefined();
  });

  it("does not depend on the order it saw them in", () => {
    expect(highest(["2.0.0-rc.1", "2.0.0-rc.2"])).toBe("2.0.0-rc.2");
    expect(highest(["2.0.0-rc.2", "2.0.0-rc.1"])).toBe("2.0.0-rc.2");
    expect(highest(["v2.0.0", "1.0.0"])).toBe("v2.0.0");
    expect(highest(["1.0.0", "v2.0.0"])).toBe("v2.0.0");
  });

  it("prefers a release to its own prereleases", () => {
    expect(highest(["2.0.0-rc.1", "2.0.0", "2.0.0-rc.2"])).toBe("2.0.0");
  });
});

describe("something we cannot read", () => {
  /**
   * Refusing to rank is the honest answer, and it must be symmetric — a string
   * that is higher in neither direction keeps whatever the caller already had.
   */
  it("is higher than nothing, in either direction", () => {
    expect(isHigher("not-a-version", "1.0.0")).toBe(false);
    expect(isHigher("1.0.0", "not-a-version")).toBe(true);
    expect(isHigher("nonsense", "gibberish")).toBe(false);
    expect(isHigher("gibberish", "nonsense")).toBe(false);
  });
});
