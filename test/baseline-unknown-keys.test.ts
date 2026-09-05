/**
 * A key nobody reads is worth saying out loud.
 *
 * #161 closed the door where an acceptance's expiry *value* cannot be compared
 * — `9999-99-99` sorted above every real date and stayed accepted forever while
 * the file looked like it had a deadline on it. The door where the *key* is
 * misspelled was still open, and it costs the same thing: `expiress` parses,
 * validates, sorts, diffs and does nothing.
 *
 * It is a warning rather than a refusal on purpose. `docs/STABILITY.md` says
 * the baseline format is not frozen and that `judge` reads whatever version it
 * finds, so an unknown key is also what a newer zero-shelter's file looks like
 * to an older one. See #192.
 */
import { describe, expect, it } from "vitest";

import { parseBaseline } from "../src/baseline.js";

const entry = (extra: Record<string, unknown>): string =>
  JSON.stringify({
    schemaVersion: "1",
    accepted: [
      {
        fingerprint: "38419faff211212c",
        ecosystem: "npm",
        package: "lodash",
        advisory: "CVE-2025-13465",
        aliases: ["CVE-2025-13465"],
        severity: "moderate",
        ...extra,
      },
    ],
  });

function notesFrom(raw: string): string[] {
  const notes: string[] = [];
  parseBaseline(raw, "baseline.json", (note) => notes.push(note));
  return notes;
}

describe("an accepted entry carrying a key we do not read", () => {
  it("names the key and the entry", () => {
    const [note, ...rest] = notesFrom(entry({ expiress: "2020-01-01" }));

    expect(rest).toEqual([]);
    expect(note).toContain("38419faff211212c");
    expect(note).toContain('"expiress"');
  });

  /**
   * The list is the whole point. A reader who sees `expires` beside their
   * `expiress` does not need the tool to guess what they meant.
   */
  it("lists what it does read, so the intended key is visible beside the typo", () => {
    const [note] = notesFrom(entry({ expiress: "2020-01-01" }));

    for (const key of ["expires", "reason", "acceptedBy", "versions", "recordedAt"]) {
      expect(note).toContain(key);
    }
  });

  it("keeps judging, because a newer baseline looks like this too", () => {
    const baseline = parseBaseline(entry({ somethingFromTheFuture: 1 }), "baseline.json");

    expect(baseline.accepted).toHaveLength(1);
    expect(baseline.accepted[0]?.fingerprint).toBe("38419faff211212c");
  });

  it("says nothing when every key is one we act on", () => {
    expect(
      notesFrom(
        entry({
          versions: ["4.17.11"],
          recordedAt: "2026-09-05",
          reason: "not reachable",
          acceptedBy: "someone",
          expires: "2027-01-01",
        }),
      ),
    ).toEqual([]);
  });

  it("reports every unknown key rather than only the first", () => {
    const notes = notesFrom(entry({ expiress: "2020-01-01", reasons: "x", acceptedby: "y" }));

    expect(notes).toHaveLength(3);
  });

  /**
   * The v1 file is a bare list of fingerprint strings. It has no keys at all
   * and must not start producing notes about that.
   */
  it("says nothing about the older fingerprint-only shape", () => {
    expect(
      notesFrom(JSON.stringify({ schemaVersion: "1", accepted: ["38419faff211212c"] })),
    ).toEqual([]);
  });

  it("still expires an acceptance whose key is spelled right", () => {
    const baseline = parseBaseline(entry({ expires: "2020-01-01" }), "baseline.json");

    expect(baseline.accepted[0]?.expires).toBe("2020-01-01");
  });
});
