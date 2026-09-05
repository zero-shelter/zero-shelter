/**
 * Absent, failed and timed out are three different facts.
 *
 * They used to be two messages. A scanner killed at the 120-second bound
 * reported "produced no report", and on Windows any failure without stdout
 * reported "not on PATH" — sending someone to install a tool they already
 * had. The run then proceeded with one source and exited 0. See #152.
 */
import { describe, expect, it } from "vitest";

import { capture } from "../src/scan.js";

const cwd = process.cwd();

describe("a command that is not installed", () => {
  it("is absent", async () => {
    const outcome = await capture("definitely-not-a-real-command-xyz", [], { cwd });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.why).toBe("absent");
  });
});

describe("a command we killed", () => {
  it("says it timed out rather than that it produced nothing", async () => {
    const outcome = await capture("sleep", ["10"], { cwd, timeoutMs: 2000 });

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
    const outcome = await capture("sh", ["-c", "echo partial; sleep 10"], {
      cwd,
      timeoutMs: 400,
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
    const outcome = await capture("sh", ["-c", "echo out; exit 3"], { cwd });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.stdout).toContain("out");
  });

  it("is a failure, not an absence, when it exited non-zero with nothing", async () => {
    const outcome = await capture("sh", ["-c", "exit 3"], { cwd });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.why).toBe("failed");
  });

  it("is a failure when a signal ended it", async () => {
    const outcome = await capture("sh", ["-c", "kill -9 $$"], { cwd });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.why).toBe("failed");
  });
});

describe("a command that worked", () => {
  it("is success", async () => {
    const outcome = await capture("sh", ["-c", "echo hello"], { cwd });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.stdout.trim()).toBe("hello");
  });
});
