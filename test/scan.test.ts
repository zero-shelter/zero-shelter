import { describe, expect, it } from "vitest";
import { type Capture, collect } from "../src/scan.js";

/**
 * These are the paths a green CI run does not cover.
 *
 * The tests elsewhere read fixtures, so nothing in them ever spawns a process:
 * a missing scanner, a non-zero exit, an empty report and unparseable output
 * are the four ways collection goes wrong in the field and the four things
 * nobody would notice breaking. Injecting the subprocess call is what makes
 * them reachable without depending on which binaries a machine happens to have.
 */

const NPM_AUDIT = JSON.stringify({
  vulnerabilities: {
    minimist: {
      name: "minimist",
      severity: "critical",
      isDirect: true,
      via: [
        {
          source: 1,
          title: "Prototype Pollution",
          url: "https://github.com/advisories/GHSA-xvch-5gv4-984h",
          severity: "critical",
          range: "<0.2.4",
        },
      ],
      range: "<0.2.4",
      fixAvailable: true,
    },
  },
});

const OSV = JSON.stringify({
  results: [
    {
      packages: [
        {
          package: { name: "minimist", version: "0.0.8", ecosystem: "npm" },
          vulnerabilities: [
            {
              id: "GHSA-xvch-5gv4-984h",
              aliases: ["CVE-2021-44906"],
              summary: "Prototype Pollution",
              database_specific: { severity: "CRITICAL" },
            },
          ],
        },
      ],
    },
  ],
});

/** Build a capture that answers per command, defaulting to "not installed". */
function fake(responses: Record<string, string | undefined>): Capture {
  return async (command) => responses[command];
}

describe("collect", () => {
  it("uses every scanner that answered", async () => {
    const { findings, skipped } = await collect({
      cwd: ".",
      capture: fake({ npm: NPM_AUDIT, "osv-scanner": OSV }),
    });

    expect(findings.map((f) => f.sources[0]?.tool).sort()).toEqual([
      "npm-audit",
      "osv-scanner",
    ]);
    expect(skipped).toEqual([]);
  });

  /**
   * The promise the README makes: an absent optional scanner is a note, not a
   * failure, and the run still produces results.
   */
  it("carries on when an optional scanner is not installed", async () => {
    const { findings, skipped } = await collect({
      cwd: ".",
      capture: fake({ npm: NPM_AUDIT }),
    });

    expect(findings).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toMatch(/osv-scanner skipped: not on PATH/);
  });

  it("says so rather than crashing when npm itself is missing", async () => {
    const { findings, skipped } = await collect({ cwd: ".", capture: fake({}) });

    expect(findings).toEqual([]);
    expect(skipped).toEqual([
      "npm audit skipped: npm is not available",
      expect.stringMatching(/osv-scanner skipped/),
    ]);
  });

  it("treats an empty report as no report", async () => {
    const { skipped } = await collect({
      cwd: ".",
      capture: fake({ npm: "   ", "osv-scanner": "" }),
    });

    expect(skipped[0]).toMatch(/npm produced no report/);
    expect(skipped[1]).toMatch(/produced no report/);
  });

  /**
   * A scanner that emits something unreadable must not take the run down with
   * it, and must not pass silently either — losing an entire source while still
   * printing a clean report is the worst of both.
   */
  it("reports unreadable output instead of failing or hiding it", async () => {
    const { findings, skipped } = await collect({
      cwd: ".",
      capture: fake({ npm: NPM_AUDIT, "osv-scanner": "{ not json" }),
    });

    expect(findings).toHaveLength(1);
    expect(skipped.some((s) => /osv-scanner output unreadable/.test(s))).toBe(true);
  });

  it("keeps going when npm is the one that is unreadable", async () => {
    const { findings, skipped } = await collect({
      cwd: ".",
      capture: fake({ npm: '{"nothing":true}', "osv-scanner": OSV }),
    });

    expect(findings).toHaveLength(1);
    expect(skipped.some((s) => /npm audit output unreadable/.test(s))).toBe(true);
  });

  it("records the scanner version so a run can be reproduced", async () => {
    const capture: Capture = async (command, args) => {
      if (command === "npm") return NPM_AUDIT;
      if (args.includes("--version")) return "osv-scanner version 1.9.2\n";
      return OSV;
    };

    const { findings } = await collect({ cwd: ".", capture });
    const osv = findings.find((f) => f.sources[0]?.tool === "osv-scanner");
    expect(osv?.sources[0]?.toolVersion).toBe("1.9.2");
  });

  it("omits the version rather than inventing one when it cannot be read", async () => {
    const capture: Capture = async (command, args) => {
      if (command === "npm") return NPM_AUDIT;
      if (args.includes("--version")) return "unhelpful banner";
      return OSV;
    };

    const { findings } = await collect({ cwd: ".", capture });
    const osv = findings.find((f) => f.sources[0]?.tool === "osv-scanner");
    expect(osv?.sources[0]?.toolVersion).toBeUndefined();
  });

  it("asks osv-scanner about the directory it was pointed at", async () => {
    const seen: string[][] = [];
    const capture: Capture = async (command, args) => {
      seen.push([command, ...args]);
      return command === "npm" ? NPM_AUDIT : OSV;
    };

    await collect({ cwd: "/some/project", capture });
    expect(seen.some((call) => call.includes("/some/project"))).toBe(true);
  });
});
