/**
 * The failure this guards against: a project nobody scanned reporting clean.
 *
 * It is the worst output this tool can produce. A crash gets investigated; a
 * green CI badge on a project the scanners never opened does not.
 */

import { describe, expect, it } from "vitest";

import { collect, type Capture, type CaptureOutcome } from "../src/scan.js";

const NO_LOCKFILE = JSON.stringify({
  error: {
    code: "ENOLOCK",
    summary: "This command requires an existing lockfile.",
    detail: "Try creating one first with: npm i --package-lock-only",
  },
});

const ONE_FINDING = JSON.stringify({
  vulnerabilities: {
    lodash: {
      name: "lodash",
      severity: "high",
      isDirect: true,
      range: "<4.17.21",
      via: [
        {
          source: 1094500,
          name: "lodash",
          title: "Prototype pollution",
          url: "https://github.com/advisories/GHSA-35jh-r3h4-6jhm",
          severity: "high",
          range: "<4.17.21",
        },
      ],
      fixAvailable: { name: "lodash", version: "4.17.21" },
    },
  },
});

/** A stubbed answer: a string is a report, undefined is a scanner that is not installed. */
const answer = (stdout: string | undefined): CaptureOutcome =>
  stdout === undefined ? { ok: false, why: "absent" } : { ok: true, stdout };

const capturing = (npm: string | undefined, osv?: string): Capture =>
  async (command) => answer(command === "npm" ? npm : osv);

describe("when nothing could be scanned", () => {
  it("contributes nothing and repeats npm's own explanation", async () => {
    const result = await collect({ cwd: ".", capture: capturing(NO_LOCKFILE) });

    expect(result.contributed).toEqual([]);
    expect(result.findings).toEqual([]);
    // npm already says what is wrong and how to fix it. Replacing that with our
    // own parser's complaint sends people looking for a bug in us.
    expect(result.skipped.join(" ")).toContain("requires an existing lockfile");
    expect(result.skipped.join(" ")).toContain("npm i --package-lock-only");
  });

  it("says so when npm is not installed at all", async () => {
    const result = await collect({ cwd: ".", capture: capturing(undefined) });

    expect(result.contributed).toEqual([]);
    expect(result.skipped.join(" ")).toContain("npm is not available");
  });

  it("does not confuse an empty report with an unreadable one", async () => {
    const clean = JSON.stringify({ vulnerabilities: {} });
    const result = await collect({ cwd: ".", capture: capturing(clean) });

    // Scanned, found nothing. This is the case that legitimately reports clean,
    // and it must stay distinguishable from the ones above.
    expect(result.contributed).toEqual(["npm audit"]);
    expect(result.findings).toEqual([]);
  });

  it("counts a source that produced findings", async () => {
    const result = await collect({ cwd: ".", capture: capturing(ONE_FINDING) });

    expect(result.contributed).toEqual(["npm audit"]);
    expect(result.findings).toHaveLength(1);
  });
});

describe("a baseline that cannot be read", () => {
  it("names the file rather than leaving the reader to guess", async () => {
    const { mkdtemp, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { main } = await import("../src/cli.js");

    const dir = await mkdtemp(join(tmpdir(), "zs-baseline-"));
    const path = join(dir, "truncated.json");
    // Half a write, which is what an interrupted --update-baseline leaves.
    await writeFile(path, '{"schemaVersion": "1", "accep');

    const errors: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string) => {
      errors.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const code = await main(["judge", "--input", "test/fixtures/npm-audit.json", "--baseline", path]);
      expect(code).toBe(2);
    } finally {
      process.stderr.write = write;
    }

    expect(errors.join("")).toContain(path);
    expect(errors.join("")).toContain("not valid JSON");
  });
});
