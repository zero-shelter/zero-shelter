/**
 * Measure text contrast in both report themes against WCAG AA requirements.
 */

import { describe, expect, it } from "vitest";

import { renderHtml } from "../src/html.js";
import { judge } from "../src/judge.js";
import { emptyBaseline } from "../src/baseline.js";

/** OKLCH to linear sRGB, then to gamma-encoded sRGB. */
function toRgb(l: number, c: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ] as const;

  const linear = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ];

  return linear.map((v) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055,
  ) as [number, number, number];
}

function relativeLuminance(rgb: readonly number[]): number {
  const [r, g, b] = rgb.map((channel) => {
    const v = Math.min(Math.max(channel, 0), 1);
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: readonly number[], b: readonly number[]): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter! + 0.05) / (darker! + 0.05);
}

/** Pull the declared value of a custom property out of the stylesheet. */
function colour(css: string, scope: RegExp, name: string): [number, number, number] {
  const block = scope.exec(css)?.[0] ?? "";
  const declaration = new RegExp(`${name}:\\s*oklch\\(([\\d.]+)% ([\\d.]+) ([\\d.]+)\\)`).exec(block);

  if (declaration === null) throw new Error(`${name} not found in that block`);
  return toRgb(Number(declaration[1]) / 100, Number(declaration[2]), Number(declaration[3]));
}

const page = renderHtml(judge([], { baseline: emptyBaseline() }), { language: "en" });
const css = /<style>([\s\S]*?)<\/style>/.exec(page)![1]!;

const LIGHT = /:root \{[\s\S]*?\}/;
const DARK = /body:has\(#dark:checked\) \{[\s\S]*?\}/;

describe("text contrast", () => {
  const readable = ["--ink", "--ink-soft", "--ink-faint", "--accent", "--mark"];

  it("meets AA on the light sheet", () => {
    const sheet = colour(css, LIGHT, "--sheet");

    for (const name of readable) {
      const ratio = contrast(colour(css, LIGHT, name), sheet);
      expect(ratio, `${name} on --sheet is ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("meets AA on the dark sheet", () => {
    const sheet = colour(css, DARK, "--sheet");

    for (const name of readable) {
      const ratio = contrast(colour(css, DARK, name), sheet);
      expect(ratio, `${name} on --sheet is ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("meets AA for the command sitting on the accent fill", () => {
    // The one place text is not on the sheet colour.
    for (const scope of [LIGHT, DARK]) {
      const ratio = contrast(colour(css, scope, "--ink"), colour(css, scope, "--accent-soft"));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("copying without a clipboard", () => {
  it("falls back, and then falls back again to selecting the text", () => {
    // The report is usually opened from disk, where the clipboard API is
    // refused or absent depending on the browser. A button that silently does
    // nothing is worse than no button.
    expect(page).toContain("window.isSecureContext");
    expect(page).toContain("execCommand");
    expect(page).toContain("selectNodeContents");
  });

  it("tells the reader when it had to select instead", () => {
    const withFindings = renderHtml(
      judge(
        [
          {
            kind: "SCA",
            fingerprint: "a",
            severity: "high",
            title: "t",
            ecosystem: "npm",
            packageName: "lodash",
            vulnerableRange: "<1",
            fixAvailable: true,
            fixedIn: "4.18.1",
            advisoryId: "GHSA-1",
            aliases: ["GHSA-1"],
            transitive: false,
            sources: [{ tool: "npm-audit", ruleId: "GHSA-1" }],
          },
        ] as never,
        { baseline: emptyBaseline() },
      ),
      { language: "en" },
    );

    expect(withFindings).toContain("data-select=");
    expect(withFindings).toContain("press Ctrl+C");
  });
});
