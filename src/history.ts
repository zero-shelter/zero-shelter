/**
 * Optional append-only JSONL records of scan results.
 *
 * Callers supply timestamps; rendering and judgement do not read a clock.
 */

import { appendFile, open } from "node:fs/promises";

import { SCHEMA_VERSION } from "./fingerprint.js";
import type { JudgeResult } from "./report.js";

export const HISTORY_PATH = ".zero-shelter/history.jsonl";

export interface HistoryEntry {
  readonly v: string;
  /** ISO 8601, supplied by the caller. */
  readonly at: string;
  readonly sources: readonly string[];
  readonly raw: number;
  readonly merged: number;
  readonly accepted: number;
  /**
   * Sorted outstanding fingerprints. Identity allows a comparison to detect
   * changed findings even when the total count is unchanged.
   */
  readonly outstanding: readonly string[];
}

export function entryFrom(result: JudgeResult, at: string): HistoryEntry {
  return {
    v: SCHEMA_VERSION,
    at,
    // Use run metadata because accepted or empty reports still have sources.
    sources:
      result.sources === undefined
        ? [...new Set(result.applied.fresh.flatMap((entry) => entry.finding.tools))].sort()
        : [...result.sources].sort(),
    raw: result.raw,
    merged: result.merged,
    accepted: result.applied.suppressed.length,
    outstanding: result.applied.fresh.map((entry) => entry.finding.fingerprint).sort(),
  };
}

export function serializeEntry(entry: HistoryEntry): string {
  // Key order fixed by hand so two entries with the same content are the same
  // line, which is what makes the file diffable.
  return `${JSON.stringify({
    v: entry.v,
    at: entry.at,
    sources: entry.sources,
    raw: entry.raw,
    merged: entry.merged,
    accepted: entry.accepted,
    outstanding: entry.outstanding,
  })}\n`;
}

/**
 * Read what is readable and say what was not.
 *
 * A truncated last line is the normal result of an interrupted write, and
 * throwing the whole history away over it would lose everything that was
 * recorded correctly.
 */
/**
 * Append one entry, adding a separator if an interrupted write left no final
 * newline. Preserve the partial line so it remains counted as unreadable.
 * Reading and rewriting the whole file would weaken append-only behavior.
 * See #196.
 */
export async function appendEntry(path: string, entry: HistoryEntry): Promise<void> {
  const separator = (await endsMidLine(path)) ? "\n" : "";
  await appendFile(path, separator + serializeEntry(entry), "utf8");
}

const NEWLINE = 0x0a;

/**
 * One byte, whatever the file's size.
 *
 * Reading it whole to look at its last character would grow with the history
 * this is protecting, and it runs on every `--record`.
 */
async function endsMidLine(path: string): Promise<boolean> {
  let handle;
  try {
    handle = await open(path, "r");
    const { size } = await handle.stat();
    if (size === 0) return false;
    const { buffer } = await handle.read(Buffer.alloc(1), 0, 1, size - 1);
    return buffer[0] !== NEWLINE;
  } catch {
    // No file yet, or one we cannot read. The append is about to answer
    // whichever it is, and it reports failures better than a guess here would.
    return false;
  } finally {
    await handle?.close();
  }
}

export function parseHistory(raw: string): { entries: HistoryEntry[]; unreadable: number } {
  const entries: HistoryEntry[] = [];
  let unreadable = 0;

  for (const line of raw.split("\n")) {
    if (line.trim() === "") continue;

    try {
      const parsed: unknown = JSON.parse(line);
      if (isEntry(parsed)) entries.push(parsed);
      else unreadable += 1;
    } catch {
      unreadable += 1;
    }
  }

  return { entries, unreadable };
}

export interface Change {
  readonly entry: HistoryEntry;
  /** Outstanding fingerprints not present in the previous entry. */
  readonly appeared: string[];
  /** Previously outstanding fingerprints that are not any more. */
  readonly gone: string[];
}

/**
 * Consecutive differences, oldest first.
 *
 * "Gone" rather than "fixed": a finding also leaves this list when it is
 * accepted into the baseline, or when the scanner that found it did not run.
 * The word the history uses has to survive all three.
 */
export function changes(entries: readonly HistoryEntry[]): Change[] {
  return entries.map((entry, index) => {
    const previous = index === 0 ? undefined : entries[index - 1];
    if (previous === undefined) {
      return { entry, appeared: [...entry.outstanding], gone: [] };
    }

    const before = new Set(previous.outstanding);
    const after = new Set(entry.outstanding);

    return {
      entry,
      appeared: entry.outstanding.filter((fingerprint) => !before.has(fingerprint)),
      gone: previous.outstanding.filter((fingerprint) => !after.has(fingerprint)),
    };
  });
}

/** Entries whose schema no longer matches; their fingerprints mean nothing now. */
export function stale(entries: readonly HistoryEntry[]): number {
  return entries.filter((entry) => entry.v !== SCHEMA_VERSION).length;
}

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record["v"] === "string" &&
    typeof record["at"] === "string" &&
    typeof record["raw"] === "number" &&
    typeof record["merged"] === "number" &&
    typeof record["accepted"] === "number" &&
    Array.isArray(record["sources"]) &&
    Array.isArray(record["outstanding"]) &&
    (record["outstanding"] as unknown[]).every((item) => typeof item === "string")
  );
}
