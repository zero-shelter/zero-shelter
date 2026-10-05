import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { main } from "../src/cli.js";
import { explainDependency, renderWhy } from "../src/why.js";
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
