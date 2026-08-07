import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { normalizeAliases, pickAdvisoryId } from "../src/finding.js";

const fixture = readFileSync(
  fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url)),
  "utf8",
);

const findings = parseNpmAudit(fixture);

describe("parseNpmAudit", () => {
  it("matches the recorded shape", () => {
    expect(findings).toMatchSnapshot();
  });

  it("is stable across runs", () => {
    expect(parseNpmAudit(fixture)).toEqual(findings);
  });

  it("does not depend on key order in the input", () => {
    const report = JSON.parse(fixture);
    const reversed = {
      ...report,
      vulnerabilities: Object.fromEntries(
        Object.entries(report.vulnerabilities).reverse(),
      ),
    };
    expect(parseNpmAudit(JSON.stringify(reversed))).toEqual(findings);
  });
});

describe("propagated vulnerabilities", () => {
  /**
   * mkdirp is listed as vulnerable only because it depends on minimist, and
   * its `via` is the string "minimist" rather than an advisory. Reporting it
   * separately would file one advisory under two packages — the duplication
   * this tool exists to remove.
   */
  it("reports the package the advisory belongs to, not the ones it reached", () => {
    const packages = findings.map((f) => f.packageName);
    expect(packages).toContain("minimist");
    expect(packages).not.toContain("mkdirp");
  });

  it("keeps one finding per advisory when a package has several", () => {
    const semver = findings.filter((f) => f.packageName === "semver");
    expect(semver).toHaveLength(2);
    expect(new Set(semver.map((f) => f.advisoryId)).size).toBe(2);
  });
});

describe("aliases", () => {
  it("recovers the GHSA id from the advisory url", () => {
    const minimist = findings.find((f) => f.packageName === "minimist");
    expect(minimist?.aliases).toContain("GHSA-XVCH-5GV4-984H");
  });

  it("recovers a CVE when the url points at NVD instead", () => {
    const cve = findings.find((f) => f.aliases.includes("CVE-2022-25883"));
    expect(cve?.advisoryId).toBe("CVE-2022-25883");
  });

  it("keeps npm's own advisory number so nothing is lost", () => {
    const minimist = findings.find((f) => f.packageName === "minimist");
    expect(minimist?.aliases).toContain("NPM-1096466");
  });
});

describe("fixedIn", () => {
  it("reports the fix when it is for this package", () => {
    const minimist = findings.find((f) => f.packageName === "minimist");
    expect(minimist?.fixedIn).toBe("0.2.4");
  });

  /**
   * tough-cookie's `fixAvailable` names `request` — npm is saying to upgrade
   * the parent. Copying that version onto tough-cookie would tell the reader
   * to install a version of tough-cookie that does not exist.
   */
  it("omits the fix when npm names a different package", () => {
    const toughCookie = findings.find((f) => f.packageName === "tough-cookie");
    expect(toughCookie?.fixedIn).toBeUndefined();
  });
});

describe("severity and directness", () => {
  it("prefers the advisory's severity over the package's rollup", () => {
    const cve = findings.find((f) => f.advisoryId === "CVE-2022-25883");
    expect(cve?.severity).toBe("high");
  });

  it("marks packages nothing depends on directly as transitive", () => {
    expect(findings.find((f) => f.packageName === "minimist")?.transitive).toBe(true);
    expect(findings.find((f) => f.packageName === "semver")?.transitive).toBe(false);
  });
});

describe("unsupported input", () => {
  // Previously this shape was rejected as "npm 6, unsupported". It is now read,
  // so a clean project reports nothing rather than failing.
  it("accepts an empty advisories report as a clean project", () => {
    expect(parseNpmAudit('{"advisories":{}}')).toEqual([]);
  });

  it("rejects output that is neither known shape", () => {
    expect(() => parseNpmAudit("{}")).toThrow(/vulnerabilities/);
  });

  it("rejects a non-object report", () => {
    expect(() => parseNpmAudit("[]")).toThrow(/not a JSON object/);
  });
});

describe("pickAdvisoryId", () => {
  /**
   * Both scanners have to reach the same answer from the same alias set, or
   * identical vulnerabilities get different ids and never merge.
   */
  it("prefers CVE, then GHSA, then OSV", () => {
    expect(pickAdvisoryId(["GHSA-aaaa-bbbb-cccc", "CVE-2024-0001"])).toBe("CVE-2024-0001");
    expect(pickAdvisoryId(["OSV-2024-1", "GHSA-aaaa-bbbb-cccc"])).toBe("GHSA-aaaa-bbbb-cccc");
    expect(pickAdvisoryId(["NPM-123", "OSV-2024-1"])).toBe("OSV-2024-1");
  });

  it("does not depend on the order the aliases arrive in", () => {
    const aliases = ["NPM-9", "GHSA-aaaa-bbbb-cccc", "CVE-2024-0001"];
    expect(pickAdvisoryId([...aliases].reverse())).toBe(pickAdvisoryId(aliases));
  });

  it("is total when several ids share the winning prefix", () => {
    expect(pickAdvisoryId(["CVE-2024-0002", "CVE-2024-0001"])).toBe("CVE-2024-0001");
  });

  it("refuses an empty alias set rather than inventing an id", () => {
    expect(() => pickAdvisoryId([])).toThrow();
  });
});

describe("normalizeAliases", () => {
  it("deduplicates and orders so equal sets serialize identically", () => {
    expect(normalizeAliases(["B", "A", "B"])).toEqual(["A", "B"]);
  });

  /**
   * npm audit spells GHSA ids lower case inside advisory URLs and osv-scanner
   * emits them upper case. The merge step joins on exact equality, so folding
   * case here is what lets the two tools recognise the same advisory at all.
   */
  it("folds case so sources that disagree on spelling still join", () => {
    expect(normalizeAliases(["ghsa-xvch-5gv4-984h"])).toEqual(["GHSA-XVCH-5GV4-984H"]);
    expect(normalizeAliases(["cve-2021-1", "CVE-2021-1"])).toHaveLength(1);
  });

  it("drops blank entries rather than carrying an alias that joins everything", () => {
    expect(normalizeAliases(["", "  ", "CVE-2021-1"])).toEqual(["CVE-2021-1"]);
  });
});

describe("the advisories shape (pnpm, yarn v1, npm 6)", () => {
  const pnpm = parseNpmAudit(
    readFileSync(
      fileURLToPath(new URL("./fixtures/pnpm-audit.json", import.meta.url)),
      "utf8",
    ),
  );

  /**
   * Rejecting this shape narrowed "we support npm" to "we support npm 7+",
   * which quietly excluded every pnpm user.
   */
  it("is read rather than rejected", () => {
    expect(pnpm).toHaveLength(2);
  });

  /**
   * This format states its CVE and GHSA outright instead of hiding one in a
   * URL, so its findings join more readily than npm 7+ output does.
   */
  it("keeps both identifiers, which makes merging easier not harder", () => {
    const minimist = pnpm.find((f) => f.packageName === "minimist");
    expect(minimist?.aliases).toEqual([
      "CVE-2020-7598",
      "GHSA-VH95-RMGR-6W4M",
      "NPM-1179",
    ]);
    expect(minimist?.advisoryId).toBe("CVE-2020-7598");
  });

  it("reads '<0.0.0' as the way this format spells 'no fix yet'", () => {
    expect(pnpm.find((f) => f.packageName === "lodash")?.fixAvailable).toBe(false);
    expect(pnpm.find((f) => f.packageName === "minimist")?.fixAvailable).toBe(true);
  });

  it("does not claim to know whether a dependency is direct", () => {
    expect(pnpm.every((f) => f.transitive)).toBe(true);
  });

  it("still refuses output that is neither shape", () => {
    expect(() => parseNpmAudit('{"something":1}')).toThrow(/neither/);
  });
});
