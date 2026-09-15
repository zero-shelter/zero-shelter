/**
 * Root upgrade advice must identify the workspace requirement. Hoisted
 * scanner paths alone do not identify which workspace declares the dependency.
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { isWorkspaceRoot } from "../src/scan.js";

const projectWith = async (files: Record<string, string>) => {
  const dir = await mkdtemp(join(tmpdir(), "zs-workspace-"));
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(dir, name), contents);
  }
  return dir;
};

describe("workspace detection", () => {
  it("recognises npm and yarn workspaces", async () => {
    const dir = await projectWith({
      "package.json": JSON.stringify({ name: "root", workspaces: ["packages/*"] }),
    });

    expect(isWorkspaceRoot(dir)).toBe(true);
  });

  it("recognises the object form", async () => {
    const dir = await projectWith({
      "package.json": JSON.stringify({ name: "root", workspaces: { packages: ["a"] } }),
    });

    expect(isWorkspaceRoot(dir)).toBe(true);
  });

  it("recognises a pnpm workspace", async () => {
    const dir = await projectWith({
      "package.json": JSON.stringify({ name: "root" }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    });

    expect(isWorkspaceRoot(dir)).toBe(true);
  });

  it("leaves an ordinary project alone", async () => {
    const dir = await projectWith({
      "package.json": JSON.stringify({ name: "app", dependencies: { lodash: "4.17.11" } }),
    });

    // The caveat is only true in a workspace. Printing it everywhere would
    // train people to skip the line.
    expect(isWorkspaceRoot(dir)).toBe(false);
  });

  it("does not throw on a directory with no manifest at all", async () => {
    const dir = await projectWith({});

    expect(isWorkspaceRoot(dir)).toBe(false);
  });

  it("does not throw on a manifest that is not JSON", async () => {
    const dir = await projectWith({ "package.json": "{ this is not json" });

    expect(isWorkspaceRoot(dir)).toBe(false);
  });
});
