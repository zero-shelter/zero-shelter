/**
 * An interrupted write must cost one line, not every line after it.
 *
 * A cancelled workflow or a reclaimed runner leaves `history.jsonl` without a
 * final newline. `--record` appended straight onto that, welding the new entry
 * into the broken one — so the new run was unreadable too, and so was the next,
 * and the next. `history` went on reporting "1 line(s) could not be read"
 * while recording had silently stopped. See #196.
 *
 * Driven through `appendEntry` rather than a spawned CLI. The first version of
 * this file ran `dist/bin.js`, which passed here and failed on all three
 * runners: the `test` job runs `npm ci`, `typecheck` and `test`, and never
 * builds. A test that needs an artifact its own job does not produce is a test
 * that only works on the machine that happened to build.
 */
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { type HistoryEntry, appendEntry, parseHistory } from "../src/history.js";

const roots: string[] = [];

function file(): string {
  const dir = mkdtempSync(join(tmpdir(), "zs-history-"));
  roots.push(dir);
  return join(dir, "history.jsonl");
}

const entry = (at: string): HistoryEntry => ({
  v: "1",
  at,
  sources: ["npm audit"],
  raw: 12,
  merged: 5,
  accepted: 5,
  outstanding: [],
});

/** What a write that stopped part-way through leaves behind. */
const TORN = '{"v":"1","at":"2026-01-01T00:00:00.000Z","sources":["npm audit"],"raw":5,"merg';

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

describe("appendEntry", () => {
  it("writes the first entry into a file that does not exist yet", async () => {
    const path = file();

    await appendEntry(path, entry("2026-01-01T00:00:01.000Z"));

    expect(parseHistory(readFileSync(path, "utf8"))).toEqual({
      entries: [entry("2026-01-01T00:00:01.000Z")],
      unreadable: 0,
    });
  });

  it("keeps a new entry readable when the last write was cut short", async () => {
    const path = file();
    await appendEntry(path, entry("2026-01-01T00:00:01.000Z"));
    appendFileSync(path, TORN);

    await appendEntry(path, entry("2026-01-01T00:00:02.000Z"));

    const { entries, unreadable } = parseHistory(readFileSync(path, "utf8"));
    // The torn line stays torn and stays counted. The run after it does not
    // join it, which is the whole defect.
    expect(unreadable).toBe(1);
    expect(entries.map((e) => e.at)).toEqual([
      "2026-01-01T00:00:01.000Z",
      "2026-01-01T00:00:02.000Z",
    ]);
  });

  it("goes on recording after that, rather than stopping for good", async () => {
    const path = file();
    appendFileSync(path, TORN);

    for (const at of ["...:01", "...:02", "...:03"]) await appendEntry(path, entry(at));

    const { entries, unreadable } = parseHistory(readFileSync(path, "utf8"));
    expect(unreadable).toBe(1);
    expect(entries).toHaveLength(3);
  });

  /**
   * Prefixing a newline unconditionally would also work — `parseHistory` skips
   * blank lines — and would put one between every entry forever, for a case
   * that almost never happens.
   */
  it("adds no blank line to a file that was written cleanly", async () => {
    const path = file();

    for (const at of ["...:01", "...:02", "...:03"]) await appendEntry(path, entry(at));

    expect(readFileSync(path, "utf8")).not.toMatch(/\n\n/);
  });
});
