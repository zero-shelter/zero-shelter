/**
 * `clears N` is a promise about what a command does, and it used to count
 * findings the command cannot reach.
 *
 * uptime-kuma depends on `tar@~6.2.1` and `cacache`, `node-gyp` and
 * `@louislam/sqlite3` each require `tar@^6` of their own. The lockfile holds a
 * single copy, so counting copies says the upgrade is safe — but the fix is
 * 7.5.22, no `^6` range will take it, and `npm i tar@7.5.22` left all twelve
 * findings in place. The report had promised twelve.
 */
import { describe, expect, it } from "vitest";

import { transitiveFixes, upgradeActions } from "../src/actions.js";
import { blockedBy, fromPackages, type InstalledVersions } from "../src/lockfile.js";
import { rank } from "../src/triage.js";
import { mergeFindings } from "../src/merge.js";
import type { ScaFinding } from "../src/finding.js";

const finding = (advisoryId: string): ScaFinding =>
  ({
    kind: "SCA",
    fingerprint: `tar-${advisoryId}`,
    severity: "critical",
    title: "node-tar DoS",
    ecosystem: "npm",
    packageName: "tar",
    vulnerableRange: "<7.5.19",
    fixAvailable: true,
    fixedIn: "7.5.22",
    advisoryId,
    aliases: [advisoryId],
    transitive: false,
    sources: [{ tool: "npm-audit", ruleId: advisoryId }],
  }) as unknown as ScaFinding;

const ranked = rank(mergeFindings([finding("CVE-1"), finding("CVE-2")]));

const lockfile = (
  versions: readonly string[],
  required: readonly (readonly [string, string])[] = [],
): InstalledVersions => ({
  versions: new Map([["tar", new Set(versions)]]),
  required: new Map([["tar", required.map(([by, range]) => ({ by, range }))]]),
  scopes: new Map(),
  installScripts: new Set(),
});

describe("an upgrade the tree will not accept", () => {
  it("does not promise to clear what npm i cannot reach", () => {
    expect(upgradeActions(ranked, lockfile(["6.2.1", "7.5.22"]))).toEqual([]);
  });

  it("moves those findings to the overrides path instead of dropping them", () => {
    expect(transitiveFixes(ranked, lockfile(["6.2.1", "7.5.22"]))).toEqual([
      { packageName: "tar", upgradeTo: "7.5.22", clears: 2 },
    ]);
  });

  it("still promises when the tree holds one copy nobody else pins", () => {
    expect(upgradeActions(ranked, lockfile(["6.2.1"]))[0]).toMatchObject({
      packageName: "tar",
      clears: 2,
      command: "npm i tar@7.5.22",
    });
  });

  it("falls back to name-level advice with no lockfile", () => {
    expect(upgradeActions(ranked)[0]).toMatchObject({ clears: 2 });
  });

  it("declines when one copy is installed but a dependent is stuck below the fix", () => {
    const stuck = lockfile(["6.2.1"], [["node_modules/cacache", "^6.0.2"]]);
    expect(upgradeActions(ranked, stuck)).toEqual([]);
    expect(transitiveFixes(ranked, stuck)).toEqual([
      { packageName: "tar", upgradeTo: "7.5.22", clears: 2 },
    ]);
  });

  it("names only the dependents that block it, for the reader to argue with", () => {
    const stuck = lockfile(
      ["6.2.1"],
      [
        ["node_modules/cacache", "^6.0.2"],
        ["node_modules/node-gyp", "^6.1.2"],
        ["node_modules/wait-on", "^7.0.0"], // takes 7.5.22 — not a blocker
      ],
    );
    expect(blockedBy("tar", "7.5.22", stuck)).toEqual([
      { by: "node_modules/cacache", range: "^6.0.2" },
      { by: "node_modules/node-gyp", range: "^6.1.2" },
    ]);
  });

  it("keeps promising when every dependent's range takes the fix", () => {
    // ws: engine.io asks for ~8.21.0, the fix is 8.21.3, they share one copy.
    const fine = lockfile(
      ["8.21.0"],
      [
        ["node_modules/engine.io", "~8.21.0"],
        ["node_modules/isomorphic-ws", "*"],
      ],
    );
    expect(upgradeActions(ranked, fine)[0]).toMatchObject({ clears: 2 });
  });

  it("ignores dependents that already want something newer than the fix", () => {
    const ahead = lockfile(["6.2.1"], [["node_modules/modern", "^9.0.0"]]);
    expect(upgradeActions(ranked, ahead)[0]).toMatchObject({ clears: 2 });
  });

  it("does not count a workspace package as something pinning the version", () => {
    // `packages/app` is a package.json in this project. The reader can edit it,
    // and the report already tells them to add -w. Only node_modules/ paths
    // hold a version out of reach.
    const monorepo = fromPackages({
      "": { dependencies: { tar: "~6.2.1" } },
      "packages/app": { dependencies: { tar: "~6.2.1" } },
      "node_modules/tar": { version: "6.2.1" },
    });
    expect(upgradeActions(ranked, monorepo)[0]).toMatchObject({ clears: 2 });
  });
});
