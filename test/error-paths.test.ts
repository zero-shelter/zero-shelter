/**
 * Check actionable errors for unsupported input and unwritable output.
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { main } from "../src/cli.js";

const stderr: string[] = [];
const original = process.stderr.write.bind(process.stderr);

const capture = () => {
  stderr.length = 0;
  process.stderr.write = ((chunk: string) => {
    stderr.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
};

afterEach(() => {
  process.stderr.write = original;
});

const said = () => stderr.join("");

describe("mistakes worth answering well", () => {
  it("recognises its own SARIF being handed back to it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "zs-errors-"));
    const path = join(dir, "report.sarif");
    await writeFile(path, JSON.stringify({ version: "2.1.0", runs: [{ results: [] }] }));

    capture();
    const code = await main(["judge", "--input", path]);

    expect(code).toBe(2);
    expect(said()).toContain("is SARIF, which is what this tool writes rather than reads");
    // And it says what to pass instead, rather than only what was wrong.
    expect(said()).toContain("npm audit --json");
  });

  it("still says 'unrecognised' for JSON that is neither", async () => {
    const dir = await mkdtemp(join(tmpdir(), "zs-errors-"));
    const path = join(dir, "something.json");
    await writeFile(path, JSON.stringify({ hello: "world" }));

    capture();
    const code = await main(["judge", "--input", path]);

    expect(code).toBe(2);
    expect(said()).toContain("unrecognised report");
  });

  it("explains a write it could not do", async () => {
    const dir = await mkdtemp(join(tmpdir(), "zs-errors-"));
    const input = join(dir, "audit.json");
    await writeFile(input, JSON.stringify({ vulnerabilities: {} }));

    capture();
    const code = await main([
      "judge",
      "--input",
      input,
      "--output",
      // A file cannot be a directory, so mkdir of the parent fails.
      join(input, "nested", "out.json"),
    ]);

    expect(code).toBe(2);
    expect(said()).toContain("cannot write");
    // The failure is a path problem, not a crash — no stack trace, no "Error:".
    expect(said()).not.toContain("at async");
  });
});
