import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { main } from "../src/cli.js";
import { explainDependency, renderWhy, renderWhyJson } from "../src/why.js";
import { fromPackages } from "../src/lockfile.js";
import type { ScaFinding } from "../src/finding.js";

const finding = (fixedIn?: string): ScaFinding =>
  ({
    kind: "SCA",
    fingerprint: "tar-CVE-1",
    severity: "high",
    title: "tar vulnerability",
    ecosystem: "npm",
    packageName: "tar",
    vulnerableRange: "<7.5.22",
    fixAvailable: fixedIn !== undefined,
    ...(fixedIn === undefined ? {} : { fixedIn }),
    advisoryId: "CVE-1",
    aliases: ["CVE-1"],
    transitive: true,
    sources: [{ tool: "npm-audit", ruleId: "CVE-1" }],
  }) as ScaFinding;

const tree = () =>
  fromPackages({
    "": { dependencies: { express: "^4.18.0", safe: "^2.0.0" } },
    "node_modules/express": { version: "4.18.2", dependencies: { send: "^0.18.0" } },
    "node_modules/express/node_modules/send": { version: "0.18.0", dependencies: { tar: "^6.0.0" } },
    "node_modules/safe": { version: "2.0.0", dependencies: { tar: "^7.0.0" } },
    "node_modules/tar": { version: "7.5.22" },
  });

describe("dependency explanation", () => {
  it("walks every installed path and names a blocking range", () => {
    const result = explainDependency("tar", tree(), [finding("7.5.22")]);

    expect(result.versions).toEqual(["7.5.22"]);
    expect(result.paths.map((path) => path.nodes.map((node) => node.name))).toEqual([
      ["express", "send", "tar"],
      ["safe", "tar"],
    ]);
    expect(result.lowestDirect).toEqual({ packageName: "safe", version: "2.0.0" });
    expect(renderWhy(result)).toContain("express 4.18.2 → send 0.18.0 → tar 7.5.22");
  });

  it("terminates when the lockfile graph contains a cycle", () => {
    const cyclic = fromPackages({
      "": { dependencies: { a: "1" } },
      "node_modules/a": { version: "1.0.0", dependencies: { b: "1" } },
      "node_modules/a/node_modules/b": { version: "1.0.0", dependencies: { a: "1" } },
    });

    expect(explainDependency("b", cyclic).paths).toHaveLength(1);
  });

  it("prints one path when root and parent declarations repeat the same edge", () => {
    const installed = fromPackages({
      "": { dependencies: { app: "1" }, devDependencies: { app: "1" } },
      "node_modules/app": {
        version: "1.0.0",
        dependencies: { tar: "^7" },
        peerDependencies: { tar: "^7" },
      },
      "node_modules/tar": { version: "7.5.22" },
    });
    const result = explainDependency("tar", installed, [finding("7.5.22")]);

    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]?.ranges).toEqual(["1", "^7"]);
    expect(JSON.parse(renderWhyJson(result)).paths).toHaveLength(1);
    expect(renderWhy(result).split("app 1.0.0 → tar 7.5.22")).toHaveLength(2);
    expect(result.lowestDirect).toEqual({ packageName: "app", version: "1.0.0" });
  });

  it.each([
    { version: "1.0.0", targetVersion: "7.5.22", range: "*", count: 1 },
    { version: "2.0.0", targetVersion: "7.5.22", range: "*", count: 2 },
    { version: "1.0.0", targetVersion: "7.5.23", range: "*", count: 2 },
    { version: "1.0.0", targetVersion: "7.5.22", range: "^1", count: 2 },
  ])("keeps distinct versions and ranges: $version / $targetVersion / $range", ({ version, targetVersion, range, count }) => {
    const first = "node_modules/app";
    const second = "node_modules/other/node_modules/app";
    const installed = fromPackages({
      "": { dependencies: { app: "*" } },
      [first]: { version: "1.0.0", dependencies: { tar: "*" } },
      [`${first}/node_modules/tar`]: { version: "7.5.22" },
      [second]: { version, dependencies: { tar: "*" } },
      [`${second}/node_modules/tar`]: { version: targetVersion },
    });
    const graph = new Map(installed.graph);
    graph.set("", [
      { name: "app", range: "*", to: first },
      { name: "app", range, to: second },
    ]);

    const result = explainDependency("tar", { ...installed, graph });
    expect(JSON.parse(renderWhyJson(result)).paths).toHaveLength(count);
    const reversedGraph = new Map(graph);
    reversedGraph.set("", [...graph.get("")!].reverse());
    expect(explainDependency("tar", { ...installed, graph: reversedGraph })).toEqual(result);
  });

  it("keeps dependency and peer paths with different requested ranges", () => {
    const installed = fromPackages({
      "": { dependencies: { app: "1" } },
      "node_modules/app": { version: "1.0.0", dependencies: { tar: "^7" }, peerDependencies: { tar: ">=7.5.22" } },
      "node_modules/tar": { version: "7.5.22" },
    });

    expect(explainDependency("tar", installed).paths.map((path) => path.ranges)).toEqual([
      ["1", "^7"],
      ["1", ">=7.5.22"],
    ]);
  });
});

describe("why CLI", () => {
  it("prints a path without running a scanner", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "zs-why-"));
    await writeFile(
      join(cwd, "package-lock.json"),
      JSON.stringify({ packages: { "": { dependencies: { app: "1" } }, "node_modules/app": { version: "1.0.0" } } }),
    );
    await writeFile(join(cwd, "report.json"), JSON.stringify({ auditReportVersion: 2, vulnerabilities: {} }));
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const code = await main(["why", "app", "--cwd", cwd, "--input", "report.json"]);
      expect(code).toBe(0);
      expect(write.mock.calls.map(([chunk]) => String(chunk)).join("")).toContain("app 1.0.0");
    } finally {
      write.mockRestore();
    }
  });

  it("rejects a package that is absent from the lockfile", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "zs-why-"));
    await writeFile(join(cwd, "package-lock.json"), JSON.stringify({ packages: {} }));
    const error = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      expect(await main(["why", "missing", "--cwd", cwd])).toBe(2);
      expect(error.mock.calls.map(([chunk]) => String(chunk)).join("")).toContain("missing");
    } finally {
      error.mockRestore();
    }
  });
});
