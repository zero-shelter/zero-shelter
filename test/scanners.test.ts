import { chmod, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { main } from "../src/cli.js";
import { discoverScanners, renderScannerJson, renderScannerText } from "../src/scanners.js";

const temp = () => mkdtemp(join(tmpdir(), "zs-scanners-"));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("project-specific scanner guidance", () => {
  it("reports domains, relative evidence and grouped recommendations without scanning", async () => {
    const cwd = await temp();
    await mkdir(join(cwd, ".github", "workflows"), { recursive: true });
    await writeFile(join(cwd, "package-lock.json"), "{}");
    await writeFile(join(cwd, "Dockerfile"), "FROM scratch\n# contents are never read");
    await writeFile(join(cwd, ".github", "workflows", "build.yml"), "name: build");
    await writeFile(join(cwd, "main.ts"), "secret-like contents stay unread");

    const result = discoverScanners(cwd, { path: "" });

    expect(result.complete).toBe(true);
    expect(result.inspection).toBe("not-run");
    expect(result.domains.find((domain) => domain.id === "container-config")).toMatchObject({
      applicability: "detected",
      evidence: ["Dockerfile"],
    });
    expect(result.domains.find((domain) => domain.id === "ci-workflows")).toMatchObject({
      applicability: "detected",
      evidence: [".github/workflows/build.yml"],
    });
    expect(result.domains.find((domain) => domain.id === "secrets-files")).toMatchObject({
      applicability: "always",
      evidence: [],
    });
    expect(result.recommendations.find((entry) => entry.tool === "trivy")?.tasks).toContain(
      "file-secret review",
    );
    expect(result.recommendations.find((entry) => entry.tool === "gitleaks")).toBeUndefined();
    expect(renderScannerText(result)).toContain("No scanners were run");
    expect(JSON.parse(renderScannerJson(result))).toEqual(result);
  });

  it("does not follow project symlinks and keeps a missing tool as advice", async () => {
    const cwd = await temp();
    const outside = await temp();
    await writeFile(join(outside, "requirements.txt"), "private contents");
    try {
      await symlink(outside, join(cwd, "linked-project"));
    } catch {
      // Symlink creation is unavailable in a few restricted Windows runners.
      return;
    }

    const result = discoverScanners(cwd, { path: "" });
    expect(result.domains.find((domain) => domain.id === "dependencies-python")?.applicability).toBe(
      "not-detected",
    );
    expect(result.tools.every((tool) => tool.availability !== "available")).toBe(true);
    expect(renderScannerText(result)).toContain("Tools to consider");
  });

  it("returns a bounded partial inventory when the entry limit is reached", async () => {
    const cwd = await temp();
    await Promise.all([writeFile(join(cwd, "package.json"), "{}"), writeFile(join(cwd, "go.mod"), "")]);

    const result = discoverScanners(cwd, { path: "", maxEntries: 1 });
    expect(result.complete).toBe(false);
    expect(result.warnings.some((warning) => warning.includes("directory entries"))).toBe(true);
    expect(renderScannerJson(result)).toContain('"complete": false');
  });

  it("recognises executable metadata without invoking a candidate", async () => {
    const cwd = await temp();
    await writeFile(join(cwd, "package-lock.json"), "{}");
    const bin = await temp();
    const windows = process.platform === "win32";
    const executable = join(bin, windows ? "osv-scanner.exe" : "osv-scanner");
    await writeFile(executable, windows ? "binary placeholder" : "#!/bin/sh\ntouch SHOULD_NOT_EXIST\n");
    if (!windows) await chmod(executable, 0o755);

    const result = discoverScanners(cwd, { path: bin, platform: windows ? "win32" : "linux" });
    expect(result.tools.find((tool) => tool.id === "osv-scanner")?.availability).toBe("available");
  });

  it("is available through the public CLI in text and JSON, with scoped format errors", async () => {
    const cwd = await temp();
    await writeFile(join(cwd, "go.mod"), "module example\n");
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    expect(await main(["scanners", "--cwd", cwd, "--format", "json"])).toBe(0);
    const json = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(JSON.parse(json).inspection).toBe("not-run");

    write.mockClear();
    expect(await main(["scanners", "--cwd", cwd, "--format", "html"])).toBe(2);
    expect(write).not.toHaveBeenCalled();
  });
});
