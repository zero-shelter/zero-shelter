import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { baselineFrom, emptyBaseline, type AcceptedFinding } from "../src/baseline.js";
import { main } from "../src/cli.js";
import { HISTORY_PATH } from "../src/history.js";
import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { judge } from "../src/judge.js";

const input = readFileSync(fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url)), "utf8");
const baseline = baselineFrom(judge(parseNpmAudit(input), { baseline: emptyBaseline() }).fixNow);
const first: AcceptedFinding = {
  ...baseline.accepted.find((entry) => entry.package === "minimist")!,
  reason: "synthetic first risk decision",
  acceptedBy: "synthetic-reviewer-one",
  expires: "2999-01-01",
  recordedAt: "2000-01-01",
};
const changed = {
  reason: "synthetic second risk decision",
  acceptedBy: "synthetic-reviewer-two",
  expires: "2999-02-02",
  recordedAt: "2000-02-02",
};
const fields = ["reason", "acceptedBy", "expires", "recordedAt"] as const;
const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((cwd) => rm(cwd, { recursive: true, force: true })));
});

async function project(accepted: readonly AcceptedFinding[], report = input) {
  const cwd = await mkdtemp(join(tmpdir(), "zs-baseline-conflicts-"));
  temporary.push(cwd);
  const files = ["decisions/baseline.json", "audit.json", "judgment.json", HISTORY_PATH];
  await Promise.all(files.map((file) => mkdir(dirname(join(cwd, file)), { recursive: true })));
  await Promise.all([
    writeFile(join(cwd, files[0]!), `${JSON.stringify({ ...baseline, accepted }, null, 2)}\n`),
    writeFile(join(cwd, files[1]!), report),
    writeFile(join(cwd, files[2]!), "previous report\n"),
    writeFile(join(cwd, HISTORY_PATH), `${JSON.stringify({
      v: baseline.schemaVersion, at: "2000-01-01T00:00:00Z", sources: [],
      raw: 0, merged: 0, accepted: 0, outstanding: [],
    })}\n`),
  ]);
  const bytes = () => Promise.all(files.map((file) => readFile(join(cwd, file))));
  return { cwd, bytes, args: ["--cwd", cwd, "--input", "audit.json", "--baseline", files[0]!] };
}

async function run(args: readonly string[]) {
  const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const error = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    return {
      code: await main(args),
      output: output.mock.calls.map(([chunk]) => String(chunk)).join(""),
      error: error.mock.calls.map(([chunk]) => String(chunk)).join(""),
    };
  } finally {
    output.mockRestore();
    error.mockRestore();
  }
}

function expectConflict(result: Awaited<ReturnType<typeof run>>, conflicting: readonly string[]) {
  expect(result.code).toBe(2);
  expect(result.output).toBe("");
  expect(result.error).toContain("decisions/baseline.json");
  expect(result.error).toContain(`conflicting baseline decisions for ${first.fingerprint}`);
  for (const field of conflicting) expect(result.error).toContain(field);
  for (const value of [...fields.map((field) => first[field]!), ...Object.values(changed)]) {
    expect(result.error).not.toContain(value);
  }
}

describe("contradictory baseline decisions through the public CLI", () => {
  it.each(fields)("rejects conflicting %s in either order before stdout, report or history writes", async (field) => {
    const second = { ...first, [field]: changed[field] };
    for (const accepted of [[first, second], [second, first]]) {
      const { args, bytes } = await project(accepted);
      const before = await bytes();
      const stdout = await run(["judge", ...args, "--json", "--record"]);
      expectConflict(stdout, [field]);
      expect(await bytes()).toEqual(before);

      const saved = await run(["judge", ...args, "--json", "--output", "judgment.json", "--record"]);
      expectConflict(saved, [field]);
      expect(await bytes()).toEqual(before);
    }
  });

  it("rejects every conflicting field even when a readable report contains no findings", async () => {
    const second = { ...first, ...changed };
    for (const accepted of [[first, second], [second, first]]) {
      const { args, bytes } = await project(accepted, JSON.stringify({ vulnerabilities: {} }));
      const before = await bytes();
      expectConflict(await run(["judge", ...args, "--json", "--record"]), fields);
      expect(await bytes()).toEqual(before);
    }
  });

  it("still judges equal duplicate decisions and writes a valid report and history", async () => {
    const { cwd, args } = await project([first, { ...first }]);
    const result = await run(["judge", ...args, "--json"]);
    expect(result.code).toBe(1);
    expect(result.error).toBe("");
    const judgment = JSON.parse(result.output);
    expect(judgment.summary.accepted).toBeGreaterThan(0);
    expect(judgment.fixNow.length).toBeGreaterThan(0);

    const saved = await run(["judge", ...args, "--json", "--output", "judgment.json", "--record"]);
    expect(saved).toEqual({ code: 1, output: "", error: "" });
    expect(JSON.parse(await readFile(join(cwd, "judgment.json"), "utf8"))).toEqual(judgment);
    const history = (await readFile(join(cwd, HISTORY_PATH), "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    expect(history).toHaveLength(2);
    expect(history[1].accepted).toBe(judgment.summary.accepted);
    expect(history[1].outstanding.length).toBe(judgment.fixNow.length);
  });

  it("keeps hook errors silent with exit 0 in either conflicting order", async () => {
    const second = { ...first, ...changed };
    for (const accepted of [[first, second], [second, first]]) {
      const { args, bytes } = await project(accepted);
      const before = await bytes();
      expect(await run(["hook", ...args])).toEqual({ code: 0, output: "", error: "" });
      expect(await bytes()).toEqual(before);
    }
  });

  it("still emits hook context for a valid baseline with outstanding findings", async () => {
    const { args, bytes } = await project([first, { ...first }]);
    const before = await bytes();
    const result = await run(["hook", ...args]);
    expect(result.code).toBe(0);
    expect(result.error).toBe("");
    expect(JSON.parse(result.output).hookSpecificOutput.additionalContext).toContain("unaddressed dependency");
    expect(await bytes()).toEqual(before);
  });
});
