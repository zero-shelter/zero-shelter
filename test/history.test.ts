/**
 * Preserve readable history lines after a partial write and distinguish
 * absent findings from confirmed fixes.
 */

import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "../src/fingerprint.js";
import { changes, entryFrom, parseHistory, serializeEntry, stale } from "../src/history.js";
import { emptyBaseline } from "../src/baseline.js";
import { judge } from "../src/judge.js";
import type { ScaFinding } from "../src/finding.js";

const finding = (advisoryId: string): ScaFinding =>
  ({
    kind: "SCA",
    fingerprint: `fp-${advisoryId}`,
    severity: "high",
    title: "Something",
    ecosystem: "npm",
    packageName: "lodash",
    vulnerableRange: "<4.17.21",
    fixAvailable: false,
    advisoryId,
    aliases: [advisoryId],
    transitive: false,
    sources: [{ tool: "npm-audit", ruleId: advisoryId }],
  }) as unknown as ScaFinding;

const entryAt = (at: string, ids: string[]) =>
  entryFrom(judge(ids.map(finding), { baseline: emptyBaseline() }), at);

// Fingerprints are recomputed during the merge, so the identity a history
// stores is the pipeline's, not the one the raw finding arrived with.
const fingerprintOf = (id: string) => entryAt("2026-01-01T00:00:00.000Z", [id]).outstanding[0]!;

describe("recording a run", () => {
  it("keeps the fingerprints, not just the count", () => {
    // Counts alone cannot tell "two fixed and two appeared" from "nothing
    // happened", which is the whole question a history exists to answer.
    const entry = entryAt("2026-08-01T00:00:00.000Z", ["CVE-1", "CVE-2"]);

    expect(entry.outstanding).toHaveLength(2);
    expect(entry.at).toBe("2026-08-01T00:00:00.000Z");
    expect(entry.v).toBe(SCHEMA_VERSION);
  });

  it("writes one line that round-trips", () => {
    const entry = entryAt("2026-08-01T00:00:00.000Z", ["CVE-1"]);
    const line = serializeEntry(entry);

    expect(line.endsWith("\n")).toBe(true);
    expect(line.trimEnd()).not.toContain("\n");
    expect(parseHistory(line).entries[0]).toEqual(entry);
  });
});

describe("reading a history", () => {
  it("keeps what it can read and counts what it cannot", () => {
    const good = serializeEntry(entryAt("2026-08-01T00:00:00.000Z", ["CVE-1"]));
    const truncated = '{"v":"1","at":"2026-08-02T00:00:00.000Z","raw":3,"merg';

    const { entries, unreadable } = parseHistory(`${good}${truncated}`);

    expect(entries).toHaveLength(1);
    expect(unreadable).toBe(1);
  });

  it("ignores blank lines", () => {
    const line = serializeEntry(entryAt("2026-08-01T00:00:00.000Z", ["CVE-1"]));

    expect(parseHistory(`\n${line}\n\n`).unreadable).toBe(0);
  });

  it("notices entries written under an older fingerprint schema", () => {
    const { entries } = parseHistory(
      `${JSON.stringify({ v: "0", at: "2026-01-01T00:00:00.000Z", sources: [], raw: 1, merged: 1, accepted: 0, outstanding: ["old"] })}\n`,
    );

    // Their fingerprints were computed by a different recipe, so comparing
    // them with today's would invent appearances and disappearances.
    expect(stale(entries)).toBe(1);
  });
});

describe("what changed between runs", () => {
  it("reports the first run as all new", () => {
    const [first] = changes([entryAt("2026-08-01T00:00:00.000Z", ["CVE-1", "CVE-2"])]);

    expect(first!.appeared).toHaveLength(2);
    expect(first!.gone).toEqual([]);
  });

  it("separates what appeared from what stopped being reported", () => {
    const history = [
      entryAt("2026-08-01T00:00:00.000Z", ["CVE-1", "CVE-2"]),
      entryAt("2026-08-02T00:00:00.000Z", ["CVE-2", "CVE-3"]),
    ];

    const [, second] = changes(history);

    expect(second!.appeared).toEqual([fingerprintOf("CVE-3")]);
    expect(second!.gone).toEqual([fingerprintOf("CVE-1")]);
  });

  it("says nothing changed when nothing changed", () => {
    const same = ["CVE-1"];
    const [, second] = changes([
      entryAt("2026-08-01T00:00:00.000Z", same),
      entryAt("2026-08-02T00:00:00.000Z", same),
    ]);

    expect(second!.appeared).toEqual([]);
    expect(second!.gone).toEqual([]);
  });
});
