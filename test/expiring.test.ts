import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { main } from "../src/cli.js";
import { SCHEMA_VERSION } from "../src/fingerprint.js";
import { upcomingExpirations, type Baseline } from "../src/baseline.js";

const entry = (fingerprint: string, expires?: string, acceptedBy?: string) => ({
  fingerprint,
  ecosystem: "npm",
  package: "tar",
  advisory: fingerprint,
  aliases: [fingerprint],
  severity: "high",
  ...(expires === undefined ? {} : { expires }),
  ...(acceptedBy === undefined ? {} : { acceptedBy }),
});

const baseline = (accepted: Baseline["accepted"]): Baseline => ({
  schemaVersion: SCHEMA_VERSION,
  accepted,
});

function dateAt(asOf: string, days: number): string {
  return new Date(Date.parse(`${asOf}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

describe("upcoming acceptance expirations", () => {
  it("partitions the inclusive window, expired and unbounded entries", () => {
    const asOf = "2026-10-06";
    const queue = upcomingExpirations(
      baseline([
        entry("today", asOf, "alice"),
        entry("until", dateAt(asOf, 30), "alice"),
        entry("later", dateAt(asOf, 31), "bob"),
        entry("expired", dateAt(asOf, -1), "bob"),
        entry("unbounded"),
      ]),
      asOf,
      30,
    );

    expect(queue.until).toBe("2026-11-05");
    expect(queue.expiring.map(({ entry: item }) => item.fingerprint)).toEqual(["today", "until"]);
    expect(queue.expired.map((item) => item.fingerprint)).toEqual(["expired"]);
    expect(queue.unbounded.map((item) => item.fingerprint)).toEqual(["unbounded"]);
  });
});

describe("history --expiring", () => {
  it("returns deterministic JSON for a baseline without reading history", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "zs-expiring-"));
    const asOf = new Date().toISOString().slice(0, 10);
    await writeFile(
      join(cwd, "baseline.json"),
      JSON.stringify(baseline([entry("soon", dateAt(asOf, 2), "alice"), entry("none")])),
    );
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const code = await main(["history", "--expiring", "--json", "--cwd", cwd, "--baseline", "baseline.json"]);
      const report = JSON.parse(write.mock.calls.map(([chunk]) => String(chunk)).join(""));
      expect(code).toBe(0);
      expect(report.baselineExists).toBe(true);
      expect(report.expiring[0].entry ?? report.expiring[0]).toMatchObject({ fingerprint: "soon" });
      expect(report.unbounded[0].fingerprint).toBe("none");
    } finally {
      write.mockRestore();
    }
  });

  it("rejects a non-positive window", async () => {
    const error = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      expect(await main(["history", "--expiring", "--days", "0"])).toBe(2);
    } finally {
      error.mockRestore();
    }
  });
});
