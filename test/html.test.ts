/**
 * The report is one static file someone opens, so the failures worth guarding
 * are the ones a browser will not tell you about: a package name that escapes
 * into markup, a page that only works with JavaScript, a clock that makes two
 * identical judgements produce two different files.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { emptyBaseline, baselineFrom } from "../src/baseline.js";
import { judge } from "../src/judge.js";
import { parseNpmAudit } from "../src/ingest/npm-audit.js";
import { renderHtml } from "../src/html.js";
import type { ScaFinding } from "../src/finding.js";

const findings = parseNpmAudit(
  readFileSync(fileURLToPath(new URL("./fixtures/npm-audit.json", import.meta.url)), "utf8"),
);
const result = judge(findings, { baseline: emptyBaseline() });
const page = renderHtml(result, { language: "en" });

describe("the html report", () => {
  it("is a complete document with its styles inside it", () => {
    expect(page.startsWith("<!doctype html>")).toBe(true);
    expect(page).toContain("<style>");
    // One file, opened from disk, possibly on a machine with no network.
    expect(page).not.toMatch(/<link[^>]+href=/);
    expect(page).not.toMatch(/<script[^>]+src=/);
  });

  it("leads with the command rather than the diagnosis", () => {
    const actionIndex = page.indexOf("npm i ");
    const ledgerIndex = page.indexOf('class="ledger"');

    expect(actionIndex).toBeGreaterThan(-1);
    expect(actionIndex).toBeLessThan(ledgerIndex);
  });

  it("says everything without JavaScript", () => {
    const withoutScript = page.replace(/<script[\s\S]*?<\/script>/g, "");

    expect(withoutScript).toContain("npm i ");
    expect(withoutScript).toContain(result.fixNow[0]!.finding.advisoryId);
    // Severity survives too: the meter is markup, and the word is next to it.
    expect(withoutScript).toContain(result.fixNow[0]!.finding.severity);
  });

  it("does not encode severity in colour alone", () => {
    // Rank as filled blocks, the word beside it, and a label for a screen
    // reader. Someone who cannot tell amber from grey loses nothing.
    expect(page).toMatch(/aria-label="Rank \d\/5"/);
    expect(page).toContain('class="sev-word"');
  });

  it("renders the same bytes for the same judgement", () => {
    expect(renderHtml(result, { language: "en" })).toBe(page);
    // No clock unless one is handed in.
    expect(page).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("includes a stamp only when given one", () => {
    // The CSS rule for it is always there; the element is not.
    expect(page).not.toContain('<p class="stamp">');
    expect(renderHtml(result, { language: "en", stamp: "nightly build" })).toContain(
      "nightly build",
    );
  });

  it("translates without leaving English behind", () => {
    const korean = renderHtml(result, { language: "ko" });

    expect(korean).toContain('<html lang="ko">');
    expect(korean).toContain("이걸 실행하세요");
    // Identifiers stay as the scanners wrote them; only the chrome translates.
    expect(korean).toContain(result.fixNow[0]!.finding.advisoryId);
    expect(korean).not.toContain("Run this");
  });

  it("escapes what other people wrote", () => {
    const hostile = {
      ...findings[0]!,
      packageName: '</code><script>alert(1)</script>',
      title: 'Title with "quotes" & <b>markup</b>',
    } as ScaFinding;

    const rendered = renderHtml(judge([hostile], { baseline: emptyBaseline() }), {
      language: "en",
    });

    // A security tool that renders a scanner's strings raw has a scripting
    // hole in its own report.
    expect(rendered).not.toContain("<script>alert(1)</script>");
    expect(rendered).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(rendered).toContain("&quot;quotes&quot; &amp; &lt;b&gt;markup&lt;/b&gt;");
  });

  it("names duplicate siblings that are shown in the ledger", () => {
    expect(page).toContain(
      "May duplicate: <code>GHSA-C2QF-RXJJ-QQGW (fixed in 5.7.2)</code>",
    );
    expect(page).toContain("May duplicate: <code>CVE-2022-25883 (fixed in 5.7.2)</code>");
    expect(page).not.toContain("May duplicate: <code>0b15264267dde1bf</code>");
    expect(page).not.toContain("May duplicate: <code>49ea30e3fc8de394</code>");
  });

  it("keeps a duplicate fingerprint when the sibling is not shown", () => {
    const duplicate = result.fixNow.find((entry) => entry.finding.relatedTo.length > 0)!;
    const topOnly = renderHtml({ ...result, fixNow: [duplicate] }, { language: "en" });

    expect(topOnly).toContain(`May duplicate: <code>${duplicate.finding.relatedTo[0]}</code>`);
  });

  it("stays quiet when there is nothing outstanding", () => {
    const accepted = judge(findings, { baseline: baselineFrom(result.fixNow) });
    const rendered = renderHtml(accepted, { language: "en" });

    expect(rendered).toContain("Nothing new to fix.");
    expect(rendered).not.toContain("npm i ");
    // No celebration, no empty table headers.
    expect(rendered).not.toContain('class="ledger"');
  });

  it("does not call an unscanned project clean", () => {
    const nothing = judge([], {
      baseline: emptyBaseline(),
      skipped: ["npm audit skipped: no lockfile"],
    });

    expect(renderHtml(nothing, { language: "en" })).toContain("this is not a pass");
  });

  it("carries the weights so the ranking can be argued with", () => {
    expect(page).toContain("severity: critical");
    expect(page).toContain("direct dependency");
  });
});

describe("recorded runs in the report", () => {
  const entry = (at: string, outstanding: string[]) => ({
    entry: { v: "1", at, sources: ["npm-audit"], raw: 1, merged: 1, accepted: 0, outstanding },
    appeared: [] as string[],
    gone: [] as string[],
  });

  it("appears only once there is something to compare", () => {
    // One data point is a decoration, not a trend.
    const single = renderHtml(result, {
      language: "en",
      history: [entry("2026-08-01T00:00:00.000Z", ["a"])],
    });
    expect(single).not.toContain('class="history"');

    const pair = renderHtml(result, {
      language: "en",
      history: [entry("2026-08-01T00:00:00.000Z", ["a"]), entry("2026-08-02T00:00:00.000Z", [])],
    });
    expect(pair).toContain('class="history"');
    expect(pair).toContain("2026-08-02");
  });

  it("takes its dates from the data, never from a clock", () => {
    const history = [
      entry("2026-08-01T00:00:00.000Z", ["a"]),
      entry("2026-08-02T00:00:00.000Z", []),
    ];

    expect(renderHtml(result, { language: "en", history })).toBe(
      renderHtml(result, { language: "en", history }),
    );
  });
});

describe("finding the action", () => {
  it("explains what the commands do, not just what they are", () => {
    expect(page).toContain("Each line upgrades one package");
  });

  it("offers prompts that end by re-judging", () => {
    // An agent told only to upgrade reports the upgrade. One told to re-judge
    // reports what the tool says, which is the only claim worth making.
    expect(page).toContain("Or hand it to an agent");
    expect(page).toContain("npx zero-shelter judge` again");
    expect(page).toContain("Do not run --update-baseline");
    expect(page).toContain("do not report success from npm audit");
  });

  it("makes every prompt and command copyable", () => {
    const copyable = [...page.matchAll(/data-copy="/g)].length;
    const commands = [...page.matchAll(/npm i \S+@/g)].length;

    expect(copyable).toBeGreaterThan(0);
    expect(commands).toBeGreaterThan(0);
  });

  it("says what the numbers mean without shouting it", () => {
    // Folded away: a first reader needs it, a fiftieth reader does not.
    expect(page).toContain("What the numbers mean");
    expect(page).toContain("Not the same as fixed");
    expect(page).toMatch(/<details class="glossary">/);
  });

  it("asks about reachability for findings with no fix, and claims nothing", () => {
    // Strip the fix rather than setting it to undefined: the finding type
    // distinguishes "absent" from "present and undefined".
    const withoutFixes = findings.map(({ fixedIn: _dropped, ...rest }) => ({
      ...rest,
      fixAvailable: false,
    })) as ScaFinding[];
    const unfixable = renderHtml(judge(withoutFixes, { baseline: emptyBaseline() }), {
      language: "en",
    });

    expect(unfixable).toContain("no published fix");
    expect(unfixable).toContain("say plainly when you cannot tell");
  });
});

describe("nothing is dropped quietly", () => {
  const run = (count: number) =>
    judge(
      Array.from({ length: count }, (_, i) => ({
        kind: "SCA",
        fingerprint: `fp${i}`,
        severity: "high",
        title: "t",
        ecosystem: "npm",
        packageName: `pkg-${i}`,
        vulnerableRange: "<1",
        fixAvailable: false,
        advisoryId: `GHSA-${i}`,
        aliases: [`GHSA-${i}`],
        transitive: false,
        sources: [{ tool: "npm-audit", ruleId: `GHSA-${i}` }],
      })) as never,
      { baseline: emptyBaseline() },
    );

  it("says how many packages the prompt did not name", () => {
    const many = renderHtml(run(30), { language: "en" });

    expect(many).toContain("more listed in the report");
    // And says nothing about hidden packages when none are hidden.
    expect(renderHtml(run(3), { language: "en" })).not.toContain("more listed in the report");
  });

  it("says how many recorded runs are older than the ones shown", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      entry: {
        v: "1",
        at: `2026-08-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
        sources: ["npm-audit"],
        raw: 1,
        merged: 1,
        accepted: 0,
        outstanding: ["a"],
      },
      appeared: [] as string[],
      gone: [] as string[],
    }));

    const page20 = renderHtml(result, { language: "en", history });
    expect(page20).toContain("Showing the last 12 of 20 recorded runs");

    const page5 = renderHtml(result, { language: "en", history: history.slice(0, 5) });
    expect(page5).not.toContain("recorded runs;");
  });
});
