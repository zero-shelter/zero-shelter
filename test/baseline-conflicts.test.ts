import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  applyBaseline, baselineFrom, parseBaseline, type AcceptedFinding, type Baseline,
} from "../src/baseline.js";
import { SCHEMA_VERSION } from "../src/fingerprint.js";
import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { judge } from "../src/judge.js";
import { mergeFindings } from "../src/merge.js";
import { rank } from "../src/triage.js";

const findings = parseNpmAudit(readFileSync(
  fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url)), "utf8",
));
const ranked = rank(mergeFindings(findings));
const original = baselineFrom(ranked, ["npm-audit"], "2026-01-01");
const acceptance: AcceptedFinding = {
  ...original.accepted[0]!,
  reason: "synthetic reason A",
  acceptedBy: "synthetic owner A",
  expires: "2026-12-31",
};
const today = "2026-06-01";
const fields = ["reason", "acceptedBy", "expires", "recordedAt"] as const;
const changed = {
  reason: "synthetic reason B",
  acceptedBy: "synthetic owner B",
  expires: "2026-01-02",
  recordedAt: "2026-02-01",
};
const withRecords = (accepted: readonly AcceptedFinding[]): Baseline => ({ ...original, accepted });

describe("contradictory duplicate baseline decisions", () => {
  for (const field of fields) {
    for (const difference of ["different", "missing"] as const) {
      it(`rejects ${difference} ${field} in both orders at parsing and direct judgement`, () => {
        const other = { ...acceptance, [field]: changed[field] };
        if (difference === "missing") delete other[field];
        for (const records of [[acceptance, other], [other, acceptance]]) {
          const baseline = withRecords(records);
          const raw = JSON.stringify(baseline);
          const expected = `conflicting baseline decisions for ${acceptance.fingerprint}: ${field}`;
          expect(() => parseBaseline(raw, "custom-baseline.json")).toThrow(expected);
          expect(() => parseBaseline(raw, "custom-baseline.json")).toThrow("custom-baseline.json");
          expect(() => applyBaseline(ranked, baseline, ["npm-audit"], today)).toThrow(expected);
          expect(() => judge(findings, { baseline, today })).toThrow(expected);
          expect(JSON.stringify(baseline)).toBe(raw);
        }
      });
    }
  }

  it("refuses conflicting records even when nothing currently matches", () => {
    const baseline = withRecords([acceptance, { ...acceptance, expires: "2026-01-02" }]);
    expect(() => applyBaseline([], baseline)).toThrow("conflicting baseline decisions");
    expect(() => judge([], { baseline })).toThrow("conflicting baseline decisions");
    expect(() => parseBaseline(JSON.stringify(baseline))).toThrow("conflicting baseline decisions");
  });

  it("checks nonadjacent duplicates and reports field names without decision values", () => {
    const baseline = withRecords([
      acceptance,
      { ...acceptance, fingerprint: "unrelated", reason: "other decision" },
      { ...acceptance, ...changed },
    ]);
    for (const read of [() => parseBaseline(JSON.stringify(baseline)), () => judge([], { baseline })]) {
      let message = "";
      try {
        read();
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain("reason, acceptedBy, expires, recordedAt");
      for (const field of fields) {
        expect(message).not.toContain(acceptance[field]);
        expect(message).not.toContain(changed[field]);
      }
    }
  });

  it("treats an empty reason or owner as present rather than missing", () => {
    for (const field of ["reason", "acceptedBy"] as const) {
      const absent = { ...acceptance };
      delete absent[field];
      const baseline = withRecords([absent, { ...acceptance, [field]: "" }]);
      expect(() => parseBaseline(JSON.stringify(baseline))).toThrow(field);
      expect(() => judge([], { baseline })).toThrow(field);
    }
  });
});

describe("compatible baseline inputs", () => {
  it("keeps equal decision duplicates valid despite different context", () => {
    const duplicate = { ...acceptance, versions: ["9.0.0"], severity: "low" };
    const baseline = withRecords([acceptance, duplicate]);
    const parsed = parseBaseline(JSON.stringify(baseline));
    expect(parsed.accepted).toHaveLength(2);
    expect(applyBaseline(ranked, parsed, ["npm-audit"], today).suppressed).toHaveLength(1);
    expect(judge(findings, { baseline, today }).applied.suppressed).toHaveLength(1);
    expect(applyBaseline([], baseline).noLongerReported).toEqual([acceptance.fingerprint]);
  });

  it("keeps parsing optional non-string metadata as absent", () => {
    const {
      reason: _reason, acceptedBy: _owner, recordedAt: _date, expires: _expires, ...legacy
    } = acceptance;
    const raw = JSON.stringify(withRecords([
      legacy,
      { ...legacy, reason: null, acceptedBy: 7, recordedAt: false, expires: null } as unknown as AcceptedFinding,
    ]));
    const parsed = parseBaseline(raw);
    expect(parsed.accepted).toEqual([legacy, legacy]);
    expect(() => judge(findings, { baseline: parsed, today })).not.toThrow();
  });

  it("still accepts duplicate legacy fingerprint strings", () => {
    const baseline = parseBaseline(JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      accepted: [acceptance.fingerprint, acceptance.fingerprint],
    }));
    expect(applyBaseline(ranked, baseline).suppressed).toHaveLength(1);
  });

  it("leaves conflicting foreign-schema decisions to the existing warning", () => {
    const baseline = {
      ...withRecords([acceptance, { ...acceptance, ...changed }]),
      schemaVersion: "foreign-schema",
    };
    const parsed = parseBaseline(JSON.stringify(baseline));
    const applied = applyBaseline(ranked, parsed, ["npm-audit"], today);
    expect(applied.warning).toContain("foreign-schema");
    expect(applied.fresh).toEqual(ranked);
    expect(applied.suppressed).toEqual([]);
    expect(judge(findings, { baseline, today }).applied).toEqual(applied);
  });

  it("preserves alias matching between different fingerprints with different decisions", () => {
    const baseline = withRecords([
      { ...acceptance, fingerprint: "old-active" },
      { ...acceptance, fingerprint: "old-expired", ...changed },
    ]);
    const parsed = parseBaseline(JSON.stringify(baseline));
    const applied = applyBaseline(ranked, parsed, ["npm-audit"], today);
    expect(applied.suppressed).toHaveLength(1);
    expect(applied.rematched).toEqual(applied.suppressed);
    expect(applied.expired).toEqual([]);
    expect(applied.noLongerReported).toEqual([]);
    expect(judge(findings, { baseline, today }).applied).toEqual(applied);
  });

  it("accepts an empty current-schema baseline", () => {
    const baseline = withRecords([]);
    expect(parseBaseline(JSON.stringify(baseline))).toEqual(baseline);
    expect(judge([], { baseline }).applied.fresh).toEqual([]);
  });
});
