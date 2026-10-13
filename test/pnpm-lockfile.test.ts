import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { readPnpmLockfile } from "../src/pnpm-lockfile.js";
import { scopeOf } from "../src/lockfile.js";

const fixture = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

describe("pnpm lockfile context", () => {
  it.each([
    ["pnpm-lock-v5.4.yaml", "5.4"],
    ["pnpm-lock-v6.0.yaml", "6.0"],
    ["pnpm-lock-v9.0.yaml", "9.0"],
  ])("reads a real pnpm %s capture", (name) => {
    const tree = readPnpmLockfile(fixture(name));
    expect(tree).toBeDefined();
    expect(tree!.versions.size).toBeGreaterThan(0);
    expect(tree!.required.size).toBeGreaterThan(0);
  });

  it("reads production and development scope from pnpm 6 root maps", () => {
    const tree = readPnpmLockfile(fixture("pnpm-lock-v6.0.yaml"))!;
    expect(scopeOf("@actions/core", tree)).toBe("prod");
    expect(scopeOf("typescript", tree)).toBe("dev");
  });

  it("reads importer dependency metadata from pnpm 9", () => {
    const raw = `lockfileVersion: '9.0'\n\nimporters:\n  .:\n    dependencies:\n      demo:\n        specifier: ^1.0.0\n        version: 1.2.3\n    devDependencies:\n      test-runner:\n        specifier: ^2.0.0\n        version: 2.1.0\n\npackages:\n  demo@1.2.3:\n    resolution: {}\n  test-runner@2.1.0:\n    resolution: {}\n\nsnapshots:\n  demo@1.2.3: {}\n  test-runner@2.1.0: {}\n`;
    const directory = mkdtempSync(join(tmpdir(), "zero-shelter-pnpm-"));
    const path = join(directory, "importer.yaml");
    // The parser is pure with respect to the lockfile path; use the fixture
    // reader contract by writing a temporary capture through Node's standard
    // filesystem only in this focused shape test.
    try {
      writeFileSync(path, raw);
      const tree = readPnpmLockfile(path)!;
      expect(scopeOf("demo", tree)).toBe("prod");
      expect(scopeOf("test-runner", tree)).toBe("dev");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects unsupported versions instead of guessing", () => {
    const directory = mkdtempSync(join(tmpdir(), "zero-shelter-pnpm-"));
    const path = join(directory, "unsupported.yaml");
    try {
      writeFileSync(path, "lockfileVersion: '10.0'\npackages: {}\n");
      expect(readPnpmLockfile(path)).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
