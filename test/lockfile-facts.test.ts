/**
 * Two things the lockfile knows that no scanner reports.
 *
 * Neither is an advisory. Where a package runs decides whether a finding is
 * news, and there is no CVE for "this package executes code when you install
 * it" — which is the one way into a dependency tree that needs no vulnerability
 * at all. Both are one field in a file we already open for `clears`.
 */
import { describe, expect, it } from "vitest";

import { fromPackages, scopeOf } from "../src/lockfile.js";

describe("where a package runs", () => {
  const tree = fromPackages({
    "": { dependencies: { express: "^4" }, devDependencies: { vitest: "^1" } },
    "node_modules/express": { version: "4.0.0" },
    "node_modules/vitest": { version: "1.0.0", dev: true },
    "node_modules/tar": { version: "6.2.1", dev: true },
    "node_modules/express/node_modules/tar": { version: "6.2.1" },
  });

  it("reads production and dev off the lockfile's own flag", () => {
    expect(scopeOf("express", tree)).toBe("prod");
    expect(scopeOf("vitest", tree)).toBe("dev");
  });

  it("calls a package that is both mixed rather than picking a side", () => {
    // tar is a dev dependency at the root and ships inside express.
    expect(scopeOf("tar", tree)).toBe("mixed");
  });

  it("says unknown with no lockfile instead of assuming production", () => {
    // Guessing the more alarming answer is still guessing, and a reader should
    // be able to tell "we looked" from "we could not".
    expect(scopeOf("express")).toBe("unknown");
  });

  it("does not answer for a package that is not there", () => {
    expect(scopeOf("never-installed", tree)).toBe("unknown");
  });
});

describe("packages that run code on install", () => {
  it("collects them by name, not by path", () => {
    // uptime-kuma has 16 such entries and 13 distinct packages — core-js,
    // protobufjs and fsevents each sit at two paths. Counting entries would
    // report a bigger number than there are packages to look at.
    const tree = fromPackages({
      "node_modules/core-js": { version: "3.0.0", hasInstallScript: true },
      "node_modules/a/node_modules/core-js": { version: "3.1.0", hasInstallScript: true },
      "node_modules/sqlite3": { version: "5.0.0", hasInstallScript: true },
      "node_modules/lodash": { version: "4.17.21" },
    });

    expect([...tree.installScripts].sort()).toEqual(["core-js", "sqlite3"]);
  });

  it("is empty when nothing in the tree runs a script", () => {
    const tree = fromPackages({ "node_modules/lodash": { version: "4.17.21" } });
    expect(tree.installScripts.size).toBe(0);
  });
});
