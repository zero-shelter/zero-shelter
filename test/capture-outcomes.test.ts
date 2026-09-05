/**
 * Absent, failed and timed out are three different facts.
 *
 * They used to be two messages. A scanner killed at the 120-second bound
 * reported "produced no report", and on Windows any failure without stdout
 * reported "not on PATH" — sending someone to install a tool they already
 * had. The run then proceeded with one source and exited 0. See #152.
 *
 * Driven through `classify` rather than real subprocesses. Two earlier
 * versions of this file used `sh -c` and then scripts run through
 * `process.execPath`, and both passed on macOS and Linux while failing on
 * Windows — because `capture` sets `shell: true` there, which is the whole
 * reason the branch under test exists. A platform-specific branch that can
 * only be tested on that platform is a branch nobody tests.
 *
 * The failure shapes below were measured from `execFile`, not invented.
 */
import { describe, expect, it } from "vitest";

import { capture, classify } from "../src/scan.js";

const UNIX = false;
const WINDOWS = true;
const TIMEOUT = 120_000;

describe("a command that is not installed", () => {
  it("is absent when the platform says ENOENT", () => {
    const outcome = classify({ code: "ENOENT", stdout: "" }, TIMEOUT, UNIX);

    expect(outcome).toEqual({ ok: false, why: "absent" });
  });

  /**
   * With `shell: true` a missing command comes back as an exit code instead.
   * cmd.exe answers 9009; PowerShell exits 1 and says so on stderr.
   */
  it.each([
    [{ code: 9009, stdout: "" }],
    [{ code: 1, stdout: "", stderr: "'osv-scanner' is not recognized as an internal or external command" }],
    [{ code: 1, stdout: "", stderr: "CommandNotFoundException" }],
  ])("is absent on Windows when the shell says it is not a command (%o)", (failure) => {
    const outcome = classify(failure, TIMEOUT, WINDOWS);

    expect(outcome).toEqual({ ok: false, why: "absent" });
  });

  it("is not absent on Unix for the same exit code, where 9009 means nothing", () => {
    const outcome = classify({ code: 9009, stdout: "" }, TIMEOUT, UNIX);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.why).toBe("failed");
  });
});

describe("a command we killed", () => {
  it("says it timed out, and says whose bound it was", () => {
    const outcome = classify({ code: null, killed: true, signal: "SIGTERM", stdout: "" }, TIMEOUT, UNIX);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.why).toBe("timeout");
      expect(outcome.detail).toContain("120s");
    }
  });

  /**
   * Output already produced is not a report. A scanner cut off mid-write
   * yields a truncated document, and parsing it would turn our own timeout
   * into "output unreadable" — blaming the tool for something we did.
   */
  it("stays a timeout even when it had started writing", () => {
    const outcome = classify(
      { code: null, killed: true, signal: "SIGTERM", stdout: '{"partial":' },
      TIMEOUT,
      UNIX,
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.why).toBe("timeout");
  });

  it("is a timeout before it is a Windows absence", () => {
    // A killed process on Windows must not be read as a missing command just
    // because the shell wrote something we half-recognise.
    const outcome = classify(
      { code: null, killed: true, signal: "SIGTERM", stdout: "", stderr: "is not recognized" },
      TIMEOUT,
      WINDOWS,
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.why).toBe("timeout");
  });
});

describe("a command that failed", () => {
  /**
   * The normal case for a scanner: findings exist, so it exits non-zero and
   * still wrote a report. That is success and must stay success.
   */
  it("is success when it exited non-zero with output", () => {
    const outcome = classify({ code: 3, killed: false, signal: null, stdout: '{"ok":1}' }, TIMEOUT, UNIX);

    expect(outcome).toEqual({ ok: true, stdout: '{"ok":1}' });
  });

  it("is a failure, not an absence, when it exited non-zero with nothing", () => {
    const outcome = classify({ code: 3, killed: false, signal: null, stdout: "" }, TIMEOUT, UNIX);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.why).toBe("failed");
      expect(outcome.detail).toContain("3");
    }
  });

  it("names the signal when one ended it", () => {
    const outcome = classify({ code: null, killed: false, signal: "SIGKILL", stdout: "" }, TIMEOUT, UNIX);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.why).toBe("failed");
      expect(outcome.detail).toContain("SIGKILL");
    }
  });

  it("says so plainly when there is neither a code nor a signal", () => {
    const outcome = classify({ stdout: "" }, TIMEOUT, UNIX);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.detail).toContain("no exit code");
  });
});

/**
 * One live case, because `classify` only matters if `capture` reaches it with
 * the shapes above — and a missing command is the one failure that behaves the
 * same on every platform.
 */
describe("through the real subprocess", () => {
  it("reports a command that does not exist as absent", async () => {
    const outcome = await capture("definitely-not-a-real-command-xyz", [], { cwd: process.cwd() });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.why).toBe("absent");
  });
});
