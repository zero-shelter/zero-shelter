/**
 * The ratchet has to survive the advice the README gives.
 *
 * Accept a backlog with npm audit alone, then add osv-scanner because the
 * install docs say the second source is the premise rather than an optional
 * extra. Before this, that produced a red build, 70 findings reborn under new
 * fingerprints, and a green tick claiming they had been resolved.
 *
 * Fingerprints are derived after merge and merge output depends on who
 * contributed, so the recorded key genuinely no longer exists. What does
 * survive is the alias set, which is the thing the two scanners agreed on.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { applyBaseline, baselineFrom, parseBaseline, serializeBaseline } from "../src/baseline.js";
import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { parseOsv } from "../src/ingest/osv.js";
import { mergeFindings } from "../src/merge.js";
import { rank } from "../src/triage.js";

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const npmOnly = rank(mergeFindings(parseNpmAudit(read("npm-audit.json"))));
const bothTools = rank(
  mergeFindings([...parseNpmAudit(read("npm-audit.json")), ...parseOsv(read("osv-scanner.json"))]),
);

describe("adding the second scanner", () => {
  const baseline = baselineFrom(npmOnly, ["npm-audit"]);
  const after = applyBaseline(bothTools, baseline, ["npm-audit", "osv-scanner"]);

  it("changes the fingerprints, which is why this was ever a problem", () => {
    const before = new Set(npmOnly.map((entry) => entry.finding.fingerprint));
    const now = bothTools.map((entry) => entry.finding.fingerprint);
    expect(now.some((fingerprint) => !before.has(fingerprint))).toBe(true);
  });

  it("does not report an accepted finding as new because its key moved", () => {
    const acceptedPackages = new Set(baseline.accepted.map((entry) => entry.package));
    const rebornFromAccepted = after.fresh.filter((entry) =>
      acceptedPackages.has(entry.finding.packageName),
    );

    expect(rebornFromAccepted).toEqual([]);
  });

  it("does not claim the renamed ones were resolved", () => {
    expect(after.noLongerReported).toEqual([]);
  });

  it("says how many it recognised the long way round", () => {
    expect(after.rematched.length).toBeGreaterThan(0);
    expect(after.suppressed).toEqual(expect.arrayContaining(after.rematched));
  });
});

describe("what a rematch will not do", () => {
  it("keeps two advisories on one package apart", () => {
    const [first, second] = bothTools;
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    // Accept only the first, then judge both. The second shares a package with
    // nothing it was accepted under and shares no alias with the first, so it
    // must still be new.
    const accepted = baselineFrom([first!], ["npm-audit"]);
    const applied = applyBaseline(bothTools, accepted, ["npm-audit"]);

    const sameAdvisory = applied.suppressed.filter(
      (entry) => entry.finding.advisoryId === first!.finding.advisoryId,
    );
    expect(applied.suppressed).toEqual(sameAdvisory);
  });

  it("does not reach across packages that happen to share an alias", () => {
    const entry = bothTools[0]!;
    const base = baselineFrom([entry], ["npm-audit"]);

    // Same aliases, different package — and a different fingerprint, or the
    // exact match would answer before the alias path is ever reached.
    const foreign = base.accepted.map((record) => ({
      ...record,
      fingerprint: `${record.fingerprint}-moved`,
      package: "a-package-that-is-not-this-one",
    }));

    const applied = applyBaseline(bothTools, { ...base, accepted: foreign });

    expect(applied.suppressed).toEqual([]);
    expect(applied.rematched).toEqual([]);
  });
});

describe("a baseline written before any of this", () => {
  const v1 = JSON.stringify({
    schemaVersion: baselineFrom(npmOnly).schemaVersion,
    accepted: npmOnly.map((entry) => entry.finding.fingerprint),
    sources: ["npm-audit"],
  });

  it("still suppresses exactly what it always did", () => {
    const applied = applyBaseline(npmOnly, parseBaseline(v1), ["npm-audit"]);
    expect(applied.fresh).toEqual([]);
    expect(applied.suppressed).toHaveLength(npmOnly.length);
  });

  it("cannot rematch, because there are no aliases to match on", () => {
    const applied = applyBaseline(bothTools, parseBaseline(v1), ["npm-audit", "osv-scanner"]);
    expect(applied.rematched).toEqual([]);
  });
});

describe("expiry", () => {
  const withExpiry = (expires: string) => ({
    ...baselineFrom(npmOnly, ["npm-audit"]),
    accepted: baselineFrom(npmOnly, ["npm-audit"]).accepted.map((entry) => ({ ...entry, expires })),
  });

  it("brings a finding back once the date has passed", () => {
    const applied = applyBaseline(npmOnly, withExpiry("2026-01-01"), ["npm-audit"], "2026-08-28");
    expect(applied.fresh).toHaveLength(npmOnly.length);
    expect(applied.expired).toHaveLength(npmOnly.length);
  });

  it("leaves it accepted while the date holds", () => {
    const applied = applyBaseline(npmOnly, withExpiry("2027-01-01"), ["npm-audit"], "2026-08-28");
    expect(applied.fresh).toEqual([]);
    expect(applied.expired).toEqual([]);
  });

  it("expires nothing when the caller gave no date, rather than guessing one", () => {
    const applied = applyBaseline(npmOnly, withExpiry("2000-01-01"), ["npm-audit"]);
    expect(applied.expired).toEqual([]);
  });
});

describe("the file itself", () => {
  it("survives a round trip", () => {
    const baseline = baselineFrom(npmOnly, ["npm-audit"], "2026-08-28");
    expect(parseBaseline(serializeBaseline(baseline))).toEqual(baseline);
  });

  it("puts one acceptance on each line, so a diff moves one line", () => {
    const written = serializeBaseline(baselineFrom(npmOnly, ["npm-audit"]));
    const lines = written.split("\n").filter((line) => line.trim().startsWith('{"fingerprint"'));

    expect(lines).toHaveLength(npmOnly.length);
  });

  it("writes the same bytes twice", () => {
    const baseline = baselineFrom(npmOnly, ["npm-audit"], "2026-08-28");
    expect(serializeBaseline(baseline)).toBe(serializeBaseline(parseBaseline(serializeBaseline(baseline))));
  });
});
