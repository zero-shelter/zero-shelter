import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { emptyBaseline } from "../src/baseline.js";
import { main } from "../src/cli.js";
import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { judge } from "../src/judge.js";
import { renderHuman, renderJson } from "../src/report.js";
import { unscannedScope } from "../src/scope.js";

const fixture = fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url));

async function run(args: readonly string[]): Promise<{ code: number; output: string }> {
  const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  try {
    const code = await main(args);
    return { code, output: write.mock.calls.map(([chunk]) => String(chunk)).join("") };
  } finally {
    write.mockRestore();
  }
}

describe("the dependency-only boundary", () => {
  it("always names secrets and stays quiet when no file-keyed domain is present", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "zs-scope-empty-"));

    try {
      expect(unscannedScope(cwd)).toEqual({
        secrets: true,
        complete: true,
        containers: false,
        workflows: 0,
        infrastructure: false,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("counts only shallow artifacts that are actually present", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "zs-scope-artifacts-"));

    try {
      await mkdir(join(cwd, ".github", "workflows"), { recursive: true });
      await writeFile(join(cwd, ".github", "workflows", "ci.yml"), "name: CI\n");
      await writeFile(join(cwd, ".github", "workflows", "release.yml"), "name: Release\n");
      await writeFile(join(cwd, "Dockerfile"), "FROM scratch\n");
      await writeFile(join(cwd, "main.tf"), "resource \"x\" \"y\" {}\n");

      expect(unscannedScope(cwd)).toEqual({
        secrets: true,
        complete: true,
        containers: true,
        workflows: 2,
        infrastructure: true,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("does not treat directories, non-workflow files, or symlinks as project artifacts", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "zs-scope-boundary-"));
    const external = await mkdtemp(join(tmpdir(), "zs-scope-external-"));

    try {
      await mkdir(join(cwd, "Dockerfile"));
      await mkdir(join(cwd, ".github", "workflows"), { recursive: true });
      await writeFile(join(cwd, ".github", "workflows", "README.md"), "not a workflow\n");
      await writeFile(join(cwd, ".github", "workflows", "notes.txt"), "not a workflow\n");
      await writeFile(join(external, "external.yml"), "name: External\n");
      await writeFile(join(cwd, "main.tf"), "resource \"x\" \"y\" {}\n");
      await rm(join(cwd, "main.tf"));
      await symlink(join(external, "external.yml"), join(cwd, "main.tf"));

      expect(unscannedScope(cwd)).toEqual({
        secrets: true,
        complete: true,
        containers: false,
        workflows: 0,
        infrastructure: false,
      });

      await rm(join(cwd, ".github", "workflows"), { recursive: true, force: true });
      await symlink(external, join(cwd, ".github", "workflows"));
      expect(unscannedScope(cwd).workflows).toBe(0);

      await rm(join(cwd, ".github"), { recursive: true, force: true });
      const externalGithub = await mkdtemp(join(tmpdir(), "zs-scope-github-"));
      await mkdir(join(externalGithub, "workflows"));
      await writeFile(join(externalGithub, "workflows", "ci.yml"), "name: CI\n");
      await symlink(externalGithub, join(cwd, ".github"));
      expect(unscannedScope(cwd).workflows).toBe(0);
      await rm(externalGithub, { recursive: true, force: true });
    } finally {
      await rm(cwd, { recursive: true, force: true });
      await rm(external, { recursive: true, force: true });
    }
  });

  it("marks the scope check incomplete when the root cannot be read", async () => {
    const file = join(await mkdtemp(join(tmpdir(), "zs-scope-file-")), "project");
    await writeFile(file, "not a directory\n");

    try {
      expect(unscannedScope(file).complete).toBe(false);
    } finally {
      await rm(file, { force: true });
    }
  });

  it("renders the boundary on a clean run in text and JSON", () => {
    const unscanned = {
      secrets: true as const,
      complete: true,
      containers: true,
      workflows: 2,
      infrastructure: true,
    };
    const clean = judge([], { baseline: emptyBaseline(), unscanned });

    expect(renderHuman(clean, false)).toContain(
      "dependencies only — the Dockerfile, 2 workflow files, infrastructure files and anything to do with secrets went unread",
    );
    expect(JSON.parse(renderJson(clean)).unscanned).toEqual(unscanned);
  });

  it("warns when the optional scope check was incomplete", () => {
    const output = renderHuman(
      judge([], {
        baseline: emptyBaseline(),
        unscanned: {
          secrets: true,
          complete: false,
          containers: false,
          workflows: 0,
          infrastructure: false,
        },
      }),
      false,
    );

    expect(output).toContain("some local artifacts could not be checked");
  });

  it("does not add a boundary line when findings need attention", () => {
    const findings = parseNpmAudit(readFileSync(fixture, "utf8"));
    const output = renderHuman(
      judge(findings, {
        baseline: emptyBaseline(),
        unscanned: {
          secrets: true,
          complete: true,
          containers: true,
          workflows: 1,
          infrastructure: false,
        },
      }),
      false,
    );

    expect(output).not.toContain("went unread");
  });

  it("wires the local signals into the CLI JSON output", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "zs-scope-cli-"));

    try {
      await mkdir(join(cwd, ".github", "workflows"), { recursive: true });
      await writeFile(join(cwd, ".github", "workflows", "ci.yml"), "name: CI\n");
      await writeFile(join(cwd, "Dockerfile"), "FROM scratch\n");

      const result = await run(["judge", "--cwd", cwd, "--input", fixture, "--json"]);
      const report = JSON.parse(result.output);

      expect(result.code).toBe(1);
      expect(report.unscanned).toEqual({
        secrets: true,
        complete: true,
        containers: true,
        workflows: 1,
        infrastructure: false,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
