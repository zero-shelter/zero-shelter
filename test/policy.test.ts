import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { emptyBaseline } from "../src/baseline.js";
import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { judge } from "../src/judge.js";
import { parsePolicy } from "../src/policy.js";
import { renderHuman, renderJson } from "../src/report.js";

const raw = readFileSync(fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url)), "utf8");

describe("policy parsing", () => {
  it("accepts the documented schema and deduplicates scopes", () => {
    expect(parsePolicy('{"version":1,"minimumSeverity":"moderate","ignoreScopes":["dev","dev"]}')).toEqual({
      version: 1,
      minimumSeverity: "moderate",
      ignoreScopes: ["dev"],
    });
  });

  it.each([
    ["unknown key", '{"version":1,"nope":true}', "unknown key"],
    ["bad severity", '{"version":1,"minimumSeverity":"urgent"}', "minimumSeverity"],
    ["mixed scope", '{"version":1,"ignoreScopes":["mixed"]}', "ignoreScopes[0]"],
  ])("rejects %s", (_name, input, message) => {
    expect(() => parsePolicy(input)).toThrow(message);
  });
});

describe("policy application", () => {
  it("filters below the threshold while keeping a visible count", () => {
    const result = judge(parseNpmAudit(raw), {
      baseline: emptyBaseline(),
      policy: { version: 1, minimumSeverity: "high", ignoreScopes: [] },
    });
    expect(result.policy?.filtered.length).toBeGreaterThan(0);
    expect(result.fixNow.every((entry) => entry.finding.severity === "critical" || entry.finding.severity === "high")).toBe(true);
    expect(renderHuman(result, false)).toContain("filtered by policy");
    const json = JSON.parse(renderJson(result));
    expect(json.policy.filtered).toBe(result.policy?.filtered.length);
    expect(json.summary.fixNow).toBe(result.policy?.visible.length);
  });

  it("leaves mixed scope visible when dev is ignored", () => {
    const finding = parseNpmAudit(raw).find((entry) => entry.packageName === "minimist")!;
    const installed = {
      versions: new Map([["minimist", new Set(["0.2.4"])]]) as ReadonlyMap<string, ReadonlySet<string>>,
      required: new Map(),
      scopes: new Map([["minimist", "mixed" as const]]),
      installScripts: new Set<string>(),
    };
    const result = judge([finding], {
      baseline: emptyBaseline(),
      installed,
      policy: { version: 1, ignoreScopes: ["dev"] },
    });
    expect(result.policy?.filtered).toHaveLength(0);
    expect(result.fixNow).toHaveLength(1);
  });
});
