import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { main } from "../src/cli.js";
import { SCHEMA_VERSION } from "../src/fingerprint.js";
import { type HistoryEntry, serializeEntry } from "../src/history.js";

const entry = (
  at: string,
  raw: number,
  merged: number,
  accepted: number,
  outstanding: string[],
): HistoryEntry => ({
  v: SCHEMA_VERSION,
  at,
  sources: ["npm audit", "osv-scanner"],
  raw,
  merged,
  accepted,
  outstanding,
});

async function historyFile(entries: HistoryEntry[]): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "zs-history-cli-"));
  const directory = join(cwd, ".zero-shelter");
  await mkdir(directory);
  await writeFile(join(directory, "history.jsonl"), entries.map(serializeEntry).join(""));
  return cwd;
}

async function run(args: readonly string[]): Promise<{ code: number; output: string }> {
  const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  try {
    const code = await main(args);
    return { code, output: write.mock.calls.map(([chunk]) => String(chunk)).join("") };
  } finally {
    write.mockRestore();
  }
}

describe("history output", () => {
  const entries = [
    entry("2026-08-20T09:14:02.118Z", 16, 7, 7, []),
    entry("2026-08-21T11:02:55.700Z", 4, 2, 2, []),
  ];

  it("shows the stored raw and merged counts and explains accepted", async () => {
    const cwd = await historyFile(entries);

    const result = await run(["history", "--cwd", cwd]);

    expect(result.code).toBe(0);
    expect(result.output).toContain("16 reported → 7 after merge →    0 outstanding");
    expect(result.output).toContain("7 accepted (baseline entries matched)");
    expect(result.output).toContain("4 reported → 2 after merge →    0 outstanding");
  });

  it("exposes raw and merged in the machine-readable runs", async () => {
    const cwd = await historyFile(entries);

    const result = await run(["history", "--cwd", cwd, "--json"]);
    const report = JSON.parse(result.output) as {
      runs: Array<{ at: string; raw: number; merged: number; accepted: number }>;
    };

    expect(result.code).toBe(0);
    expect(report.runs).toEqual([
      {
        at: "2026-08-20T09:14:02.118Z",
        raw: 16,
        merged: 7,
        outstanding: 0,
        accepted: 7,
        appeared: 0,
        gone: 0,
        sources: ["npm audit", "osv-scanner"],
      },
      {
        at: "2026-08-21T11:02:55.700Z",
        raw: 4,
        merged: 2,
        outstanding: 0,
        accepted: 2,
        appeared: 0,
        gone: 0,
        sources: ["npm audit", "osv-scanner"],
      },
    ]);
  });
});
