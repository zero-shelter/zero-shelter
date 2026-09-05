/**
 * Which audit runs is decided by the lockfile in front of us.
 *
 * The gap this closes: our README claimed to read pnpm reports, and it does —
 * but only through `--input`. A pnpm project running `zero-shelter judge` got
 * `npm audit`, which fails with ENOLOCK without a package-lock.json, and the
 * whole run ended in "nothing was scanned".
 */

import { readFileSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { collect, type Capture, type CaptureOutcome } from "../src/scan.js";

// The real thing pnpm emits, already committed as a fixture — a hand-written
// stand-in would only prove the parser reads what I imagined it reads.
const ADVISORIES = readFileSync(
  fileURLToPath(new URL("./fixtures/pnpm-audit.json", import.meta.url)),
  "utf8",
);

const ENOLOCK = JSON.stringify({
  error: { code: "ENOLOCK", summary: "This command requires an existing lockfile." },
});

/** A stubbed answer: a string is a report, undefined is a scanner that is not installed. */
const answer = (stdout: string | undefined): CaptureOutcome =>
  stdout === undefined ? { ok: false, why: "absent" } : { ok: true, stdout };

/** Records which commands were attempted, so we can assert on the choice. */
const spy = (responses: Record<string, string | undefined>) => {
  const called: string[] = [];
  const capture: Capture = async (command) => {
    called.push(command);
    return answer(responses[command]);
  };
  return { called, capture };
};

const projectWith = async (lockfile: string) => {
  const dir = await mkdtemp(join(tmpdir(), "zs-lockfile-"));
  await writeFile(join(dir, lockfile), "");
  return dir;
};

describe("choosing an audit", () => {
  it("runs pnpm audit in a pnpm project", async () => {
    const cwd = await projectWith("pnpm-lock.yaml");
    const { called, capture } = spy({ pnpm: ADVISORIES });

    const result = await collect({ cwd, capture });

    expect(called).toContain("pnpm");
    expect(called).not.toContain("npm");
    expect(result.contributed).toContain("pnpm audit");
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("runs npm audit everywhere else", async () => {
    const cwd = await projectWith("package-lock.json");
    const { called, capture } = spy({ npm: ADVISORIES });

    const result = await collect({ cwd, capture });

    expect(called).toContain("npm");
    expect(called).not.toContain("pnpm");
    expect(result.contributed).toContain("npm audit");
  });

  it("says pnpm is missing rather than blaming npm", async () => {
    const cwd = await projectWith("pnpm-lock.yaml");
    const { capture } = spy({});

    const result = await collect({ cwd, capture });

    expect(result.contributed).toEqual([]);
    expect(result.skipped.join(" ")).toContain("pnpm is not on PATH");
  });

  it("tells a yarn project what to do instead of going quiet", async () => {
    const cwd = await projectWith("yarn.lock");
    const { capture } = spy({ npm: ENOLOCK });

    const result = await collect({ cwd, capture });

    // yarn v1 writes NDJSON, which nothing here reads. Ending in "nothing was
    // scanned" with no hint is the outcome this replaces.
    const said = result.skipped.join(" ");
    expect(said).toContain("yarn.lock found");
    expect(said).toContain("npm i --package-lock-only");
  });

  it("stays quiet about yarn when a source did report", async () => {
    const cwd = await projectWith("yarn.lock");
    await writeFile(join(cwd, "package-lock.json"), "");
    const { capture } = spy({ npm: ADVISORIES });

    const result = await collect({ cwd, capture });

    expect(result.skipped.join(" ")).not.toContain("yarn.lock found");
  });

  it("stays quiet about yarn when osv-scanner read the project", async () => {
    // osv-scanner reads yarn.lock. The note used to be decided before it ran,
    // so it printed underneath a successful scan telling the reader we could
    // not read their project.
    const cwd = await projectWith("yarn.lock");
    const osvReport = readFileSync(
      fileURLToPath(new URL("./fixtures/osv-scanner.json", import.meta.url)),
      "utf8",
    );
    const { capture } = spy({ npm: ENOLOCK, "osv-scanner": osvReport });

    const result = await collect({ cwd, capture });

    expect(result.contributed).toContain("osv-scanner");
    expect(result.skipped.join(" ")).not.toContain("yarn.lock found");
  });

  it("points a stuck yarn project at the tool that would read it", async () => {
    const cwd = await projectWith("yarn.lock");
    const { capture } = spy({ npm: ENOLOCK });

    const result = await collect({ cwd, capture });

    expect(result.skipped.join(" ")).toContain("osv-scanner reads yarn.lock");
  });
});
