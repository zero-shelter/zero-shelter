/**
 * Exercise stored scanner reports through the public CLI input, baseline
 * and output paths without live scanners.
 */

import { readFileSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { main, renderSkippedNotes } from "../src/cli.js";

const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

async function reports() {
  const cwd = await mkdtemp(join(tmpdir(), "zs-inputs-"));
  await Promise.all([
    writeFile(join(cwd, "npm-audit.json"), fixture("npm-audit.json")),
    writeFile(join(cwd, "osv-scanner.json"), fixture("osv-scanner.json")),
  ]);
  return { cwd, npm: "npm-audit.json", osv: "osv-scanner.json" };
}

async function run(args: readonly string[]) {
  const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  try {
    const code = await main(args);
    return { code, output: write.mock.calls.map(([chunk]) => String(chunk)).join("") };
  } finally {
    write.mockRestore();
  }
}

describe("stored scanner reports", () => {
  it("merges real reports and keeps the judgment independent of input order", async () => {
    const { cwd, npm, osv } = await reports();
    const common = ["judge", "--cwd", cwd, "--format", "json"];

    const forward = await run([...common, "--input", npm, "--input", osv]);
    const reverse = await run([...common, "--input", osv, "--input", npm]);

    expect(forward.code).toBe(1);
    expect(reverse.code).toBe(1);

    const first = JSON.parse(forward.output);
    expect(reverse.output).toBe(forward.output);
    expect(JSON.parse(reverse.output)).toEqual(first);
    expect(first.summary.raw).toBeGreaterThan(first.summary.merged);
    expect(first.fixNow.some((finding: { tools: string[] }) => finding.tools.length > 1)).toBe(true);
  });

  it("records the same stored reports as a baseline and then reports no new work", async () => {
    const { cwd, npm, osv } = await reports();
    const base = ["judge", "--cwd", cwd, "--input", npm, "--input", osv, "--baseline", "baseline.json"];

    const recorded = await run([...base, "--update-baseline"]);
    const rerun = await run([...base, "--format", "json"]);

    expect(recorded.code).toBe(0);
    expect(recorded.output).toContain("recorded");
    expect(recorded.output).toContain("from npm-audit, osv-scanner");
    expect(recorded.output.trim().split("\n")).toHaveLength(1);
    expect(rerun.code).toBe(0);

    const judgment = JSON.parse(rerun.output);
    expect(judgment.summary.fixNow).toBe(0);
    expect(judgment.summary.accepted).toBeGreaterThan(0);
    expect(judgment.fixNow).toEqual([]);
  });

  it("puts skipped scanner notes before a baseline confirmation", () => {
    expect(renderSkippedNotes(["osv-scanner skipped: not on PATH"])).toBe(
      "  osv-scanner skipped: not on PATH\n\n",
    );
    expect(renderSkippedNotes([])).toBe("");
  });

  it("writes a valid SARIF report from stored scanner inputs", async () => {
    const { cwd, npm, osv } = await reports();
    const output = "reports/judgment.sarif";

    const result = await run([
      "judge",
      "--cwd",
      cwd,
      "--input",
      npm,
      "--input",
      osv,
      "--format",
      "sarif",
      "--output",
      output,
    ]);

    expect(result.code).toBe(1);
    expect(result.output).toBe("");

    const sarif = JSON.parse(await readFile(join(cwd, output), "utf8"));
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].results.length).toBeGreaterThan(0);
  });
});
