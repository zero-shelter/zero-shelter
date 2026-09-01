/**
 * Small things that were quietly wrong, from the same audit.
 *
 * Each is cheap on its own. What they share is a shape: something answered
 * confidently while being unable to see the case that mattered.
 */
import { describe, expect, it } from "vitest";

import { applyBaseline, parseBaseline } from "../src/baseline.js";
import { SCHEMA_VERSION } from "../src/fingerprint.js";

const accepted = (fingerprint: string) => ({
  fingerprint,
  ecosystem: "npm",
  package: "tar",
  advisory: "CVE-1",
  aliases: ["CVE-1"],
  severity: "high",
});

describe("a baseline listing the same fingerprint twice", () => {
  it("counts it once", () => {
    const twice = { schemaVersion: SCHEMA_VERSION, accepted: [accepted("dup"), accepted("dup")] };
    // The count is a frozen JSON key as well as a line on screen, so a
    // duplicated file was reporting an integer nobody could reconcile.
    expect(applyBaseline([], twice).noLongerReported).toEqual(["dup"]);
  });
});

/**
 * The rematch rests entirely on aliases. Losing them quietly turns the rescue
 * off without saying so — while `sources`, which decides much less, has always
 * thrown on the same mistake.
 */
describe("aliases that are not an array of strings", () => {
  const withAliases = (aliases: unknown): string =>
    JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      accepted: [{ fingerprint: "fp-1", aliases }],
    });

  it("is rejected rather than flattened to nothing", () => {
    expect(() => parseBaseline(withAliases("CVE-1"))).toThrow(/aliases/);
    expect(() => parseBaseline(withAliases([1, 2]))).toThrow(/aliases/);
  });

  it("names the acceptance and says what they are for", () => {
    expect(() => parseBaseline(withAliases(7))).toThrow(/fp-1/);
    expect(() => parseBaseline(withAliases(7))).toThrow(/scanner set/);
  });

  it("still accepts a v1 record, which has none", () => {
    const v1 = JSON.stringify({ schemaVersion: SCHEMA_VERSION, accepted: ["fp-1"] });
    expect(parseBaseline(v1).accepted[0]?.aliases).toEqual([]);
  });
});
