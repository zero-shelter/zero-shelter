import { describe, expect, it } from "vitest";

import { emptyBaseline } from "../src/baseline.js";
import type { ScaFinding } from "../src/finding.js";
import { renderHtml } from "../src/html.js";
import { parseOsv } from "../src/ingest/osv.js";
import { judge } from "../src/judge.js";
import { mergeFindings } from "../src/merge.js";
import { renderHuman, renderJson } from "../src/report.js";
import { renderSarif } from "../src/sarif.js";

const unknownRaw = JSON.stringify({
  results: [
    {
      packages: [
        {
          package: { name: "example", version: "1.0.0", ecosystem: "npm" },
          vulnerabilities: [
            {
              id: "OSV-EXAMPLE-1",
              summary: "Example advisory without a severity band",
              affected: [{ package: { name: "example" }, ranges: [{ events: [{ introduced: "0" }] }] }],
            },
          ],
        },
      ],
    },
  ],
});

const unknown = parseOsv(unknownRaw)[0]!;

describe("unknown source severity", () => {
  it("preserves the compatibility value while marking an unstated band", () => {
    expect(unknown.severity).toBe("info");
    expect(unknown.severityKnown).toBe(false);

    const explicitInfo = parseOsv(
      unknownRaw.replace(
        '"summary":"Example advisory without a severity band"',
        '"summary":"Example advisory with info","database_specific":{"severity":"INFO"}',
      ),
    )[0]!;
    expect(explicitInfo.severity).toBe("info");
    expect(explicitInfo.severityKnown).toBeUndefined();
  });

  it("does not let an unknown band receive info severity points", () => {
    const known: ScaFinding = {
      ...unknown,
      fingerprint: "known",
      advisoryId: "OSV-EXAMPLE-2",
      aliases: ["OSV-EXAMPLE-2"],
      severityKnown: true,
    };
    const result = judge([unknown, known], { baseline: emptyBaseline() });
    const unknownEntry = result.fixNow.find((entry) =>
      entry.finding.members.every((member) => member.severityKnown === false),
    );
    const knownEntry = result.fixNow.find((entry) =>
      entry.finding.members.some((member) => member.severityKnown !== false),
    );

    expect(unknownEntry?.reasons.find((reason) => reason.kind === "severity")?.points).toBe(0);
    expect(knownEntry?.reasons.find((reason) => reason.kind === "severity")?.points).toBe(5);
  });

  it("keeps the band known when one merged source states it", () => {
    const known: ScaFinding = { ...unknown, severity: "high", severityKnown: true };
    const merged = mergeFindings([unknown, known]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.severity).toBe("high");
    expect(merged[0]?.members.every((member) => member.severityKnown === false)).toBe(false);
  });

  it("explains the unknown state in terminal, JSON and HTML views", () => {
    const result = judge([unknown], { baseline: emptyBaseline() });
    expect(renderHuman(result, false)).toContain("unknown");
    const json = JSON.parse(renderJson(result));
    expect(json.fixNow[0].severity).toBe("info");
    expect(json.fixNow[0].severityKnown).toBe(false);
    expect(renderHtml(result, { language: "en" })).toContain("severity not stated by source");
  });

  it("does not invent a SARIF security severity", () => {
    const result = judge([unknown], { baseline: emptyBaseline() });
    const sarif = JSON.parse(renderSarif(result));
    const rule = sarif.runs[0].tool.driver.rules[0];
    expect(rule.properties.severityKnown).toBe(false);
    expect(rule.properties).not.toHaveProperty("security_severity");
  });
});
