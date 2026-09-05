/**
 * A package the project asked for by name is a direct dependency.
 *
 * `osv-scanner` and pnpm's older report shape both decline to say whether a
 * finding is direct, and both decline to a source that knows. On yarn, on
 * pnpm, and in every ecosystem that is not npm, no such source runs — so the
 * placeholder became the answer, `upgradeActions` withheld every command, and
 * a project with one declared dependency was told to force it with
 * `resolutions`. See #186.
 *
 * Driven through the parsers and one real directory, because the whole point
 * is what happens when the manifest is and is not readable.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { parseOsv } from "../src/ingest/osv.js";
import { declaredDependencies } from "../src/scan.js";

const roots: string[] = [];

function project(manifest: string | undefined): string {
  const dir = mkdtempSync(join(tmpdir(), "zs-declared-"));
  roots.push(dir);
  if (manifest !== undefined) writeFileSync(join(dir, "package.json"), manifest);
  return dir;
}

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

const OSV = JSON.stringify({
  results: [
    {
      packages: [
        {
          package: { name: "lodash", version: "4.17.11", ecosystem: "npm" },
          vulnerabilities: [
            {
              id: "GHSA-jf85-cpcp-j695",
              aliases: ["CVE-2019-10744"],
              summary: "Prototype Pollution",
              database_specific: { severity: "CRITICAL" },
            },
          ],
        },
      ],
    },
  ],
});

/** pnpm and npm 6 emit this shape, and it carries no isDirect. */
const ADVISORIES = JSON.stringify({
  advisories: {
    "1065": {
      module_name: "lodash",
      severity: "critical",
      title: "Prototype Pollution",
      vulnerable_versions: "<4.17.12",
      patched_versions: ">=4.17.12",
      cves: ["CVE-2019-10744"],
    },
  },
});

describe("declaredDependencies", () => {
  it("reads the three fields that install something", () => {
    const dir = project(
      JSON.stringify({
        dependencies: { lodash: "4.17.11" },
        devDependencies: { vitest: "^4" },
        optionalDependencies: { fsevents: "*" },
      }),
    );

    expect(declaredDependencies(dir)).toEqual(new Set(["lodash", "vitest", "fsevents"]));
  });

  /**
   * A peer is a statement about what someone else installs. Counting it would
   * offer an upgrade command for a package this project never pulls in.
   */
  it("leaves peerDependencies out", () => {
    const dir = project(JSON.stringify({ peerDependencies: { react: "^18" } }));

    expect(declaredDependencies(dir)).toEqual(new Set());
  });

  it.each([
    ["no manifest at all", undefined],
    ["a manifest that is not JSON", "{ not json"],
    ["a manifest that is not an object", "[]"],
  ])("is undefined for %s, so nothing downstream changes", (_label, manifest) => {
    expect(declaredDependencies(project(manifest))).toBeUndefined();
  });
});

describe("a source that cannot tell, given a manifest", () => {
  it("calls a declared package direct — osv-scanner", () => {
    const [finding] = parseOsv(OSV, undefined, new Set(["lodash"]));

    expect(finding?.transitive).toBe(false);
  });

  it("calls a declared package direct — the older advisories shape", () => {
    const [finding] = parseNpmAudit(ADVISORIES, new Set(["lodash"]));

    expect(finding?.transitive).toBe(false);
  });

  it.each([
    ["osv-scanner", () => parseOsv(OSV, undefined, new Set(["something-else"]))],
    ["the older advisories shape", () => parseNpmAudit(ADVISORIES, new Set(["something-else"]))],
  ])("keeps a package the manifest does not name transitive — %s", (_label, parse) => {
    expect(parse()[0]?.transitive).toBe(true);
  });

  /**
   * Where we cannot read the manifest the old answer is still the best one,
   * and every existing caller relies on it.
   */
  it.each([
    ["osv-scanner", () => parseOsv(OSV)],
    ["the older advisories shape", () => parseNpmAudit(ADVISORIES)],
  ])("stays transitive with no manifest to consult — %s", (_label, parse) => {
    expect(parse()[0]?.transitive).toBe(true);
  });
});

/**
 * The modern shape carries `isDirect` and is the source the other two were
 * deferring to. It must keep winning on its own terms.
 */
describe("a source that can tell", () => {
  const modern = (isDirect: boolean): string =>
    JSON.stringify({
      vulnerabilities: {
        lodash: {
          name: "lodash",
          severity: "critical",
          isDirect,
          via: [
            {
              source: 1065,
              title: "Prototype Pollution",
              url: "https://github.com/advisories/GHSA-jf85-cpcp-j695",
              severity: "critical",
              range: "<4.17.12",
            },
          ],
          range: "<4.17.12",
          fixAvailable: true,
        },
      },
    });

  it("is believed over the manifest when it says transitive", () => {
    const [finding] = parseNpmAudit(modern(false), new Set(["lodash"]));

    expect(finding?.transitive).toBe(true);
  });

  it("is believed when it says direct and the manifest is unreadable", () => {
    const [finding] = parseNpmAudit(modern(true));

    expect(finding?.transitive).toBe(false);
  });
});
