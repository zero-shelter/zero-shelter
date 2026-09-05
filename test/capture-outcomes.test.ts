/**
 * Absent, failed and timed out are three different facts.
 *
 * They used to be two messages. A scanner killed at the 120-second bound
 * reported "produced no report", and on Windows any failure without stdout
 * reported "not on PATH" — sending someone to install a tool they already
 * had. The run then proceeded with one source and exited 0. See #152.
 *
 * The subprocesses here are scripts written to a temp directory and run with
 * `process.execPath`, not `sh -c`. `capture` sets `shell: true` on Windows, so
 * anything quoted on the command line is re-parsed by cmd.exe — the first
 * version of this file used `sh -c "echo out; exit 3"` and passed on macOS and
 * Linux while failing on the platform the fix was mostly about.
 */
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { capture } from "../src/scan.js";

const cwd = process.cwd();
let dir: string;

/** A script on disk, so nothing has to survive a shell's quoting rules. */
const script = (name: string) => join(dir, `${name}.mjs`);

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "zs-capture-"));
  await writeFile(script("hello"), 'console.log("hello");\n');
  await writeFile(script("out-then-fail"), 'console.log("out");\nprocess.exit(3);\n');
  await writeFile(script("just-fail"), "process.exit(3);\n");
  await writeFile(script("hang"), "setTimeout(() => {}, 60_000);\n");
  await writeFile(script("say-then-hang"), 'console.log("partial");\nsetTimeout(() => {}, 60_000);\n');
});

describe("a command that is not installed", () => {
  it("is absent", async () => {
    const outcome = await capture("definitely-not-a-real-command-xyz", [], { cwd });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.why).toBe("absent");
  });
});

describe("a command we killed", () => {
  it("says it timed out rather than that it produced nothing", async () => {
    const outcome = await capture(process.execPath, [script("hang")], { cwd, timeoutMs: 2000 });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.why).toBe("timeout");
      // The bound we set, so a reader knows it was ours and can raise it.
      expect(outcome.detail).toContain("2s");
    }
  });

  /**
   * Output already produced is not a report. A scanner cut off mid-write
   * yields a truncated document, and parsing it would turn our own timeout
   * into "output unreadable" — blaming the tool for something we did.
   */
  it("stays a timeout even when it had started writing", async () => {
    const outcome = await capture(process.execPath, [script("say-then-hang")], {
      cwd,
      timeoutMs: 2000,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.why).toBe("timeout");
  });
});

describe("a command that failed", () => {
  /**
   * The normal case for a scanner: findings exist, so it exits non-zero and
   * still wrote a report. That is success and must stay success.
   */
  it("is success when it exited non-zero with output", async () => {
    const outcome = await capture(process.execPath, [script("out-then-fail")], { cwd });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.stdout).toContain("out");
  });

  it("is a failure, not an absence, when it exited non-zero with nothing", async () => {
    const outcome = await capture(process.execPath, [script("just-fail")], { cwd });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.why).toBe("failed");
      expect(outcome.detail).toContain("3");
    }
  });
});

describe("a command that worked", () => {
  it("is success", async () => {
    const outcome = await capture(process.execPath, [script("hello")], { cwd });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.stdout.trim()).toBe("hello");
  });
});
