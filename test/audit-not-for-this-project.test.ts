/**
 * npm's explanation is right for npm and wrong for a yarn project.
 *
 * `npm audit` fails without a `package-lock.json` and says so:
 *
 *   This command requires an existing lockfile. Try creating one first with:
 *   npm i --package-lock-only
 *
 * Correct, and it does not know it is standing in a yarn project — where
 * following it writes a second lockfile beside the first and leaves two that
 * can disagree. We do know, from the lockfile that is present. See #187.
 *
 * Passing npm's text through stays the default: with no lockfile at all, npm is
 * answering the right question and its answer is the right one.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { type Capture, collect } from "../src/scan.js";

const roots: string[] = [];

/** What npm actually writes when it cannot find a lockfile. */
const NPM_NO_LOCKFILE = JSON.stringify({
  error: {
    code: "ENOLOCK",
    summary: "This command requires an existing lockfile.",
    detail: "Try creating one first with: npm i --package-lock-only",
  },
});

const OSV_EMPTY = JSON.stringify({ results: [] });

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "zs-audit-"));
  roots.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const capture: Capture = async (command) =>
  command === "npm" ? { ok: true, stdout: NPM_NO_LOCKFILE } : { ok: true, stdout: OSV_EMPTY };

const auditNote = async (cwd: string): Promise<string> => {
  const { skipped } = await collect({ cwd, capture });
  return skipped.find((note) => note.startsWith("npm audit")) ?? "";
};

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

describe("npm audit cannot run", () => {
  it("does not tell a yarn user to create a package-lock.json", async () => {
    const note = await auditNote(project({ "yarn.lock": "# yarn lockfile v1\n", "package.json": "{}" }));

    expect(note).not.toContain("package-lock-only");
    expect(note).toContain("yarn.lock");
  });

  /**
   * `collect` sends a `pnpm-lock.yaml` project to `pnpm audit` before this
   * branch runs, so pnpm cannot arrive here. Pinned so that changing the
   * routing does not silently make this note wrong.
   */
  it("is not reached at all by a pnpm project", async () => {
    const { skipped } = await collect({
      cwd: project({ "pnpm-lock.yaml": "lockfileVersion: '9.0'\n", "package.json": "{}" }),
      capture,
    });

    expect(skipped.some((note) => note.startsWith("pnpm audit"))).toBe(true);
    expect(skipped.some((note) => note.startsWith("npm audit"))).toBe(false);
  });

  /**
   * The case npm's own advice was written for. Replacing it here would take a
   * correct instruction away from the person it is correct for.
   */
  it("passes npm's advice through when there is no lockfile at all", async () => {
    const note = await auditNote(project({ "package.json": "{}" }));

    expect(note).toContain("package-lock-only");
  });

  it("still says which source did not contribute", async () => {
    const { contributed, skipped } = await collect({
      cwd: project({ "yarn.lock": "# yarn lockfile v1\n", "package.json": "{}" }),
      capture,
    });

    expect(contributed).toEqual(["osv-scanner"]);
    expect(skipped.filter((note) => note.startsWith("npm audit"))).toHaveLength(1);
  });
});
