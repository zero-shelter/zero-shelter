import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

import { baselineFrom, emptyBaseline } from "../src/baseline.js";
import { renderHtml } from "../src/html.js";
import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { judge } from "../src/judge.js";
import { renderHuman } from "../src/report.js";

const findings = parseNpmAudit(readFileSync(
  fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url)), "utf8",
));

describe("report status and actions", () => {
  it("distinguishes an empty completed scan from missing scanner reports", () => {
    for (const language of ["en", "ko"] as const) {
      const scanned = renderHtml(judge([], {
        baseline: emptyBaseline(), sources: ["npm-audit"],
      }), { language });
      const missing = renderHtml(judge([], {
        baseline: emptyBaseline(), sources: [], skipped: ["npm audit skipped: no lockfile"],
      }), { language });
      expect(scanned).toContain(language === "en" ? "No new findings." : "새로 보고된 항목이 없습니다.");
      expect(missing).toContain(language === "en" ? "this is not a pass" : "판정하지 못했습니다");
      expect(scanned).not.toContain(language === "en" ? "No scanner produced a report" : "보고서를 낸 스캐너가 없습니다");
    }
  });

  it("shows scanner and baseline warnings before counts and action choices", () => {
    const result = judge(findings, {
      baseline: emptyBaseline(), sources: ["npm-audit"], skipped: ["osv-scanner: not installed"],
    });
    const page = renderHtml({
      ...result, applied: { ...result.applied, warning: "Baseline version is unsupported" },
    }, { language: "en" });
    const counts = page.indexOf('<div class="counts">');
    for (const warning of ["Sources: npm-audit", "osv-scanner: not installed", "Baseline version is unsupported"]) {
      expect(page.indexOf(warning)).toBeGreaterThan(-1);
      expect(page.indexOf(warning)).toBeLessThan(counts);
    }
    expect(counts).toBeLessThan(page.indexOf('<h2>Run commands</h2>'));
    expect(page.indexOf('<h2>Ask an agent</h2>')).toBeLessThan(page.indexOf('<section class="ledger">'));
  });

  it("keeps missing baseline scanner warnings above the summary", () => {
    const first = judge(findings, { baseline: emptyBaseline() });
    const result = judge([], {
      baseline: baselineFrom(first.fixNow, ["npm-audit", "osv-scanner"]),
      sources: ["npm-audit"],
    });
    const page = renderHtml(result, { language: "en" });
    const warning = "osv-scanner contributed when the baseline was recorded";
    expect(page.indexOf(warning)).toBeGreaterThan(-1);
    expect(page.indexOf(warning)).toBeLessThan(page.indexOf('<div class="counts">'));
    expect(page.split(warning)).toHaveLength(2);
  });

  it("keeps sources visible when every finding was already accepted", () => {
    const first = judge(findings, { baseline: emptyBaseline() });
    const accepted = judge(findings, {
      baseline: baselineFrom(first.fixNow), sources: ["npm-audit"],
    });
    const page = renderHtml(accepted, { language: "en" });
    expect(page).toContain("Sources: npm-audit");
    expect(page).toContain("No new findings.");
    expect(page).toContain("Already accepted");
  });

  it("does not describe a missing fix version as an immediately available repair", () => {
    const withoutVersions = findings.map(({ fixedIn: _omitted, ...finding }) => finding);
    const result = judge(withoutVersions, { baseline: emptyBaseline(), baselineExists: false });
    const text = renderHuman(result, false);
    const page = renderHtml(result, { language: "en" });
    expect(text).toContain("findings to review:");
    expect(text).not.toContain("fix these");
    expect(text).toContain("review findings before accepting risk");
    expect(page).toContain("No fix version was reported for:");
    expect(page).toContain("No direct upgrade command is available from this report.");
    expect(page).not.toContain("These have no published fix");
  });

  it("reports reduced list size without classifying omitted findings as noise", () => {
    const result = judge(findings, { baseline: emptyBaseline(), top: 1 });
    const text = renderHuman(result, false);
    expect(text).toContain("fewer listed");
    expect(text).not.toContain("less noise");
    expect(text).toContain(`${result.applied.fresh.length} to review`);
  });
});


describe("copy fallback", () => {
  it("selects the command text when a count separates it from the copy button", () => {
    const page = renderHtml(judge(findings, { baseline: emptyBaseline() }), { language: "en" });
    const script = /<script>([\s\S]*?)<\/script>/.exec(page)![1]!;
    const command = { textContent: "npm i semver@5.7.2" };
    const count = { textContent: "clears 2" };
    let click: (() => void) | undefined;
    let selected: unknown;
    const button = {
      textContent: "Copy",
      getAttribute: (name: string) => name === "data-copy" ? command.textContent : "Selected",
      addEventListener: (_name: string, callback: () => void) => { click = callback; },
      previousElementSibling: count,
      parentElement: { querySelector: () => command },
    };
    runInNewContext(script, {
      document: {
        querySelectorAll: () => [button],
        createElement: () => ({ style: {}, setAttribute() {}, select() {} }),
        body: { appendChild() {}, removeChild() {} },
        execCommand: () => false,
        createRange: () => ({ selectNodeContents: (node: unknown) => { selected = node; } }),
      },
      navigator: {},
      window: { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) },
    });
    expect(click).toBeDefined();
    click!();
    expect(selected).toBe(command);
    expect(selected).not.toBe(count);
    expect(button.textContent).toBe("Selected");
  });
});
