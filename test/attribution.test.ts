import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { attribute } from "../src/attribution.js";
import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { parseOsv } from "../src/ingest/osv.js";
import { judge } from "../src/judge.js";
import { emptyBaseline } from "../src/baseline.js";
import { renderHuman, renderJson } from "../src/report.js";
import { renderHtml } from "../src/html.js";
import { mergeFindings } from "../src/merge.js";

const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

describe("source attribution", () => {
  it("partitions merged findings into unique and corroborated buckets", () => {
    const npm = parseNpmAudit(fixture("npm-audit.json"));
    const osv = parseOsv(fixture("osv-scanner.json"));
    const result = attribute(mergeFindings([...npm, ...osv]));
    const unique = result.unique.reduce((sum, bucket) => sum + bucket.unique, 0);

    expect(unique + result.corroborated).toBe(result.total);
    expect(result.total).toBeGreaterThan(0);
    expect(result.unique.every((bucket) => bucket.unique > 0)).toBe(true);
  });

  it("exposes the same attribution in text, JSON and HTML", () => {
    const result = judge(parseNpmAudit(fixture("npm-audit.json")), {
      baseline: emptyBaseline(),
      sources: ["npm-audit"],
    });
    const text = renderHuman(result, false);
    const json = JSON.parse(renderJson(result)) as { attribution: { total: number; unique: unknown[] } };
    const html = renderHtml(result, { language: "en" });

    expect(text).toContain("source attribution");
    expect(json.attribution.total).toBe(result.merged);
    expect(json.attribution.unique.length).toBe(1);
    expect(html).toContain("Source attribution");
    expect(html).toContain("npm-audit only");
  });
});
