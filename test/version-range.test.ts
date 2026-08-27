/**
 * The containment rules `clears` rests on.
 *
 * Every case here is a range shape counted in the bench captures, plus the two
 * that decide the tar and ws findings on uptime-kuma.
 */
import { describe, expect, it } from "vitest";

import { accepts, lowestMentioned } from "../src/version-range.js";

describe("accepts", () => {
  it.each([
    ["^6.0.2", "6.2.1", true],
    ["^6.0.2", "7.5.22", false], // the tar case: four dependents, none will take the fix
    ["~8.21.0", "8.21.3", true], // the ws case: the fix lands inside the pinned minor
    ["~8.19.0", "8.21.3", false],
    ["^0.2.3", "0.2.9", true],
    ["^0.2.3", "0.3.0", false], // caret on a 0.x minor is a tilde
    ["^0.0.3", "0.0.4", false],
    ["1.2.3", "1.2.3", true],
    ["1.2.3", "1.2.4", false],
    ["8.x", "8.9.0", true],
    ["8.x", "9.0.0", false],
    ["1.2", "1.2.7", true],
    ["1.2", "1.3.0", false],
    [">= 3.0.0 < 4", "3.4.0", true], // space after the operator, as npm writes it
    [">= 3.0.0 < 4", "4.0.0", false],
    ["2.x || 3.x || 4.x", "3.1.0", true],
    ["2.x || 3.x || 4.x", "5.0.0", false],
    ["1.2.3 - 2.3.4", "2.0.0", true],
    ["1.2.3 - 2.3.4", "2.4.0", false],
    ["*", "9.9.9", true],
    ["latest", "9.9.9", true],
    ["^1.6.1", "1.20.0", true], // 1.20 outranks 1.6 — string order would say no
    ["npm:string-width@^4.2.0", "4.2.0", false], // an alias is another package
    ["github:user/repo#main", "1.0.0", false],
  ])("%s accepts %s → %s", (range, version, expected) => {
    expect(accepts(range, version)).toBe(expected);
  });
});

describe("lowestMentioned", () => {
  it("separates a dependent stuck below the fix from one already ahead", () => {
    expect(lowestMentioned("^6.0.2")).toBe("6.0.2");
    expect(lowestMentioned(">= 3.0.0 < 4")).toBe("3.0.0");
    expect(lowestMentioned("2.x || 3.x || 4.x")).toBe("2");
    expect(lowestMentioned("*")).toBeUndefined();
  });
});
