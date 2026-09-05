/**
 * What was installed when the decision was made.
 *
 * The baseline is a record a person reads later to decide whether an old
 * decision still holds. `reason`, `acceptedBy` and `recordedAt` all exist for
 * that reader. Which version we were looking at belongs in the same set, and
 * it is the one piece that cannot be recovered afterwards — the tree has moved
 * on. It is also what a PURL needs, which is what #138 is blocked on.
 *
 * The thing these tests are guarding against is the change nobody asked for:
 * recording a version must not quietly become scoping the acceptance to it.
 */
import { describe, expect, it } from "vitest";

import { applyBaseline, baselineFrom, parseBaseline, serializeBaseline } from "../src/baseline.js";
import { fromPackages } from "../src/lockfile.js";
import type { RankedFinding } from "../src/triage.js";

const ranked = (packageName: string): RankedFinding =>
  ({
    finding: {
      fingerprint: `fp-${packageName}`,
      sources: [{ tool: "npm audit" }],
      ecosystem: "npm",
      packageName,
      advisoryId: `CVE-${packageName}`,
      aliases: [`CVE-${packageName}`],
      severity: "high",
    },
    score: 100,
    reasons: [],
  }) as unknown as RankedFinding;

const tree = (packages: Record<string, string>) =>
  fromPackages(
    Object.fromEntries(
      Object.entries(packages).map(([name, version]) => [`node_modules/${name}`, { version }]),
    ),
  );

describe("recording what was installed", () => {
  it("carries the version the tree held", () => {
    const baseline = baselineFrom([ranked("lodash")], undefined, undefined, undefined, tree({ lodash: "4.17.11" }));

    expect(baseline.accepted[0]?.versions).toEqual(["4.17.11"]);
  });

  /**
   * `InstalledVersions.versions` is a set per package because a tree can hold
   * several copies. Picking one would be a guess presented as a fact.
   */
  it("records every copy when the tree holds more than one", () => {
    const installed = fromPackages({
      "node_modules/tar": { version: "6.2.1" },
      "node_modules/cacache/node_modules/tar": { version: "6.1.0" },
    });

    const baseline = baselineFrom([ranked("tar")], undefined, undefined, undefined, installed);

    expect(baseline.accepted[0]?.versions).toEqual(["6.1.0", "6.2.1"]);
  });

  it("is absent when there is no lockfile to ask", () => {
    const baseline = baselineFrom([ranked("lodash")]);

    expect(baseline.accepted[0]?.versions).toBeUndefined();
    expect("versions" in (baseline.accepted[0] ?? {})).toBe(false);
  });

  it("is absent when the tree does not hold that package", () => {
    const baseline = baselineFrom([ranked("lodash")], undefined, undefined, undefined, tree({ other: "1.0.0" }));

    expect(baseline.accepted[0]?.versions).toBeUndefined();
  });

  it("keeps what a previous baseline recorded when this run cannot see it", () => {
    const before = baselineFrom([ranked("lodash")], undefined, undefined, undefined, tree({ lodash: "4.17.11" }));
    const after = baselineFrom([ranked("lodash")], undefined, undefined, before);

    expect(after.accepted[0]?.versions).toEqual(["4.17.11"]);
  });
});

describe("the file", () => {
  it("round-trips", () => {
    const baseline = baselineFrom([ranked("lodash")], undefined, undefined, undefined, tree({ lodash: "4.17.11" }));

    expect(parseBaseline(serializeBaseline(baseline))).toEqual(baseline);
  });

  it("still writes one entry per line", () => {
    const baseline = baselineFrom(
      [ranked("lodash"), ranked("tar")],
      undefined,
      undefined,
      undefined,
      tree({ lodash: "4.17.11", tar: "6.2.1" }),
    );

    const entries = serializeBaseline(baseline)
      .split("\n")
      .filter((line) => line.trim().startsWith("{\"fingerprint"));

    expect(entries).toHaveLength(2);
  });

  it("ignores a versions field that is not an array of strings", () => {
    const raw = JSON.stringify({
      schemaVersion: "1",
      accepted: [
        {
          fingerprint: "fp-1",
          ecosystem: "npm",
          package: "lodash",
          advisory: "CVE-1",
          aliases: ["CVE-1"],
          severity: "high",
          versions: "4.17.11",
        },
      ],
    });

    expect(parseBaseline(raw).accepted[0]?.versions).toBeUndefined();
  });
});

/**
 * The change nobody asked for.
 *
 * If an acceptance stopped applying when the installed version moved, then
 * upgrading one still-vulnerable version to another would resurface a finding
 * the team already decided about — a considered decision turned into noise on
 * an unrelated bump, which is what the ratchet exists to prevent.
 */
describe("what an acceptance still matches on", () => {
  it("suppresses the same finding after the tree moved", () => {
    const baseline = baselineFrom([ranked("lodash")], undefined, undefined, undefined, tree({ lodash: "4.17.11" }));
    expect(baseline.accepted[0]?.versions).toEqual(["4.17.11"]);

    // Same advisory, same package, a different still-vulnerable version.
    const applied = applyBaseline([ranked("lodash")], baseline, ["npm audit"]);

    expect(applied.fresh).toHaveLength(0);
    expect(applied.suppressed).toHaveLength(1);
  });
});
