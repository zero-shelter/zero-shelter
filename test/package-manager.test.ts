/**
 * Advice in the wrong dialect does nothing and says nothing.
 *
 * pnpm ignores a top-level `overrides` key outright — no error, no effect. A
 * user pastes what we printed, re-runs, sees the finding still there, and the
 * only available conclusion is that the tool lied. Six of eight measured
 * repositories had no direct commands at all, so for those projects this block
 * is the entire remedy.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  canPromiseClears,
  detectPackageManager,
  installCommand,
  overrideBlock,
  overrideSnippet,
} from "../src/package-manager.js";

const projectWith = (file: string, contents: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "zs-pm-"));
  writeFileSync(join(dir, file), contents);
  return dir;
};

describe("detection", () => {
  it("reads pnpm off its lockfile", () => {
    expect(detectPackageManager(projectWith("pnpm-lock.yaml", "lockfileVersion: '9.0'\n"))).toBe(
      "pnpm",
    );
  });

  it("tells berry from classic, because they disagree about the key", () => {
    expect(detectPackageManager(projectWith("yarn.lock", "__metadata:\n  version: 8\n"))).toBe(
      "yarn",
    );
    expect(detectPackageManager(projectWith("yarn.lock", "# yarn lockfile v1\n\n"))).toBe(
      "yarn-classic",
    );
  });

  it("falls back to npm when there is nothing to read", () => {
    expect(detectPackageManager(mkdtempSync(join(tmpdir(), "zs-pm-")))).toBe("npm");
  });
});

describe("what to run", () => {
  it.each([
    ["npm", "npm i tar@7.5.22"],
    ["pnpm", "pnpm add tar@7.5.22"],
    ["yarn", "yarn add tar@7.5.22"],
    ["yarn-classic", "yarn add tar@7.5.22"],
  ] as const)("%s", (manager, expected) => {
    expect(installCommand(manager, "tar", "7.5.22")).toBe(expected);
  });
});

describe("where a forced version goes", () => {
  it("nests pnpm's key, which is why a pasted npm block does nothing", () => {
    expect(overrideSnippet("pnpm", "tar", "7.5.22")).toBe(
      '"pnpm": { "overrides": { "tar": "7.5.22" } }',
    );
  });

  it("uses resolutions for both yarn generations", () => {
    expect(overrideSnippet("yarn", "tar", "7.5.22")).toBe('"resolutions": { "tar": "7.5.22" }');
    expect(overrideSnippet("yarn-classic", "tar", "7.5.22")).toBe(
      '"resolutions": { "tar": "7.5.22" }',
    );
  });

  it("keeps the block form in the same dialect", () => {
    const block = overrideBlock("pnpm", [
      ["tar", "7.5.22"],
      ["axios", "1.20.0"],
    ]);
    expect(block).toContain('"pnpm": {');
    expect(block).toContain('"overrides": {');
    expect(block).toContain('"axios": "1.20.0"');
  });
});

/**
 * The 0.0.7 promise rests on reading dependents' required ranges out of
 * package-lock.json. There is no reader for the other two, so the check answers
 * yes by default and the guarantee is quietly off.
 */
describe("when clears can be promised at all", () => {
  it("only where there is a lockfile we can read", () => {
    expect(canPromiseClears("npm")).toBe(true);
    expect(canPromiseClears("pnpm")).toBe(false);
    expect(canPromiseClears("yarn")).toBe(false);
    expect(canPromiseClears("yarn-classic")).toBe(false);
  });
});
