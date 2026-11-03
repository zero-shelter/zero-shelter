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
import { SCHEMA_VERSION } from "../src/fingerprint.js";
import { HISTORY_PATH } from "../src/history.js";

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
  const error = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  try {
    const code = await main(args);
    return {
      code,
      output: write.mock.calls.map(([chunk]) => String(chunk)).join(""),
      error: error.mock.calls.map(([chunk]) => String(chunk)).join(""),
    };
  } finally {
    write.mockRestore();
    error.mockRestore();
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

const emptyInputs = [
  ["npm-empty.json", { auditReportVersion: 2, vulnerabilities: {} }, "npm-audit"],
  ["legacy-empty.json", { advisories: {} }, "npm-audit"],
  ["osv-empty.json", { results: [] }, "osv-scanner"],
] as const;

async function provenanceReports(sources: readonly string[]) {
  const result = await reports();
  for (const [file, report] of emptyInputs) {
    await writeFile(join(result.cwd, file), JSON.stringify(report));
  }
  const baseline = JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    accepted: ["synthetic-previous-finding"],
    sources,
  });
  await writeFile(join(result.cwd, "baseline.json"), baseline);
  return { ...result, baseline };
}

describe("stored report source provenance", () => {
  it.each(emptyInputs)("counts the successfully parsed %s even without findings", async (file, _report, source) => {
    const { cwd, baseline } = await provenanceReports([source]);
    const args = ["judge", "--cwd", cwd, "--input", file, "--baseline", "baseline.json"];

    const recorded = await run([...args, "--json", "--record"]);
    const json = JSON.parse(recorded.output);
    expect(recorded.code).toBe(0);
    expect(json.summary.raw).toBe(0);
    expect(json.missingSources).toEqual([]);
    expect(json.noLongerReported).toEqual(["synthetic-previous-finding"]);

    const text = await run([...args, "--no-color"]);
    expect(text.code).toBe(0);
    expect(text.output).toContain("no new findings");
    expect(text.output).not.toContain("did not run this time");

    const entry = JSON.parse(await readFile(join(cwd, HISTORY_PATH), "utf8"));
    expect(entry.sources).toEqual([source]);
    expect(entry.raw).toBe(0);
    expect(entry.outstanding).toEqual([]);
    const history = await run(["history", "--cwd", cwd, "--json"]);
    expect(JSON.parse(history.output).runs[0].sources).toEqual([source]);
    expect(await readFile(join(cwd, "baseline.json"), "utf8")).toBe(baseline);
  });

  it.each([
    ["osv-empty.json", "npm-audit.json"],
    ["npm-empty.json", "osv-scanner.json"],
    ["legacy-empty.json", "osv-scanner.json"],
  ])("keeps the empty %s source beside nonempty %s", async (empty, nonempty) => {
    const sources = ["npm-audit", "osv-scanner"];
    const { cwd, baseline } = await provenanceReports(sources);
    const result = await run([
      "judge", "--cwd", cwd, "--input", empty, "--input", nonempty,
      "--baseline", "baseline.json", "--json", "--record",
    ]);
    const json = JSON.parse(result.output);
    expect(result.code).toBe(1);
    expect(json.summary.raw).toBeGreaterThan(0);
    expect(json.missingSources).toEqual([]);
    const entry = JSON.parse(await readFile(join(cwd, HISTORY_PATH), "utf8"));
    expect(entry.sources).toEqual(sources);
    expect(await readFile(join(cwd, "baseline.json"), "utf8")).toBe(baseline);
  });

  it("deduplicates contributing sources independently of input order and repeats", async () => {
    const { cwd } = await provenanceReports(["npm-audit", "osv-scanner"]);
    const common = ["judge", "--cwd", cwd, "--baseline", "baseline.json", "--json", "--record"];
    const files = ["osv-empty.json", "npm-audit.json", "npm-audit.json", "npm-empty.json"];
    const inputs = (files: readonly string[]) => files.flatMap((file) => ["--input", file]);
    const forward = await run([...common, ...inputs(files)]);
    const reverse = await run([...common, ...inputs([...files].reverse())]);
    expect(forward.code).toBe(1);
    expect(reverse.code).toBe(1);
    expect(reverse.output).toBe(forward.output);
    expect(JSON.parse(forward.output).missingSources).toEqual([]);
    const rows = (await readFile(join(cwd, HISTORY_PATH), "utf8")).trim().split("\n");
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(JSON.parse(row).sources).toEqual(["npm-audit", "osv-scanner"]);
  });

  it.each([
    ["invalid-json.json", "{", "is not valid JSON"],
    ["invalid-npm.json", '{"vulnerabilities":[]}', "vulnerabilities"],
    ["invalid-legacy.json", '{"advisories":[]}', "has neither"],
    ["invalid-osv.json", '{"results":{}}', "has no `results` array"],
  ])("does not record a partial run when %s follows a valid empty report", async (file, raw, error) => {
    const { cwd, baseline } = await provenanceReports(["npm-audit"]);
    const common = ["judge", "--cwd", cwd, "--input", "npm-empty.json", "--baseline", "baseline.json", "--record"];
    await run([...common, "--json"]);
    const before = await readFile(join(cwd, HISTORY_PATH), "utf8");
    await writeFile(join(cwd, file), raw);

    const result = await run([...common, "--input", file, "--json"]);
    expect(result.code).toBe(2);
    expect(result.output).toBe("");
    expect(result.error).toContain(error);
    expect(await readFile(join(cwd, HISTORY_PATH), "utf8")).toBe(before);
    expect(await readFile(join(cwd, "baseline.json"), "utf8")).toBe(baseline);
  });

  it("keeps why path-only output and quiet hook behavior for stored inputs", async () => {
    const { cwd } = await provenanceReports([]);
    await writeFile(join(cwd, "package-lock.json"), JSON.stringify({ packages: {
      "": { dependencies: { example: "^1.0.0" } },
      "node_modules/example": { version: "1.0.0" },
    } }));
    const why = await run(["why", "example", "--cwd", cwd, "--input", "npm-empty.json", "--json"]);
    expect(why.code).toBe(0);
    expect(JSON.parse(why.output).versions).toEqual(["1.0.0"]);
    expect(JSON.parse(why.output).findings).toEqual([]);

    const hook = await run(["hook", "--cwd", cwd, "--input", "osv-empty.json"]);
    expect(hook.code).toBe(0);
    expect(hook.output).toBe("");
    await writeFile(join(cwd, "bad.json"), '{"results":{}}');
    const badWhy = await run(["why", "example", "--cwd", cwd, "--input", "bad.json"]);
    expect(badWhy.code).toBe(2);
    const badHook = await run(["hook", "--cwd", cwd, "--input", "bad.json"]);
    expect(badHook.code).toBe(0);
    expect(badHook.output).toBe("");
    expect(badHook.error).toBe("");
  });
});
