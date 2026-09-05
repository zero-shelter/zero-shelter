/**
 * The docs have fallen behind the tool three times in two days: a test count
 * that drifted twice, a pnpm claim that was only true through --input, and two
 * skills that described a JSON shape the tool had stopped producing.
 *
 * Prose cannot be type-checked, but the surface it describes can be. This
 * checks the one thing that keeps going wrong: a command or flag exists and
 * nothing user-facing mentions it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

const cli = read("src/cli.ts");
const docs = {
  "README.md": read("README.md"),
  "README.ko.md": read("README.ko.md"),
  "skills/setup/SKILL.md": read("skills/setup/SKILL.md"),
  "skills/explain/SKILL.md": read("skills/explain/SKILL.md"),
  "skills/fix/SKILL.md": read("skills/fix/SKILL.md"),
  "skills/ci/SKILL.md": read("skills/ci/SKILL.md"),
  "skills/baseline/SKILL.md": read("skills/baseline/SKILL.md"),
  "AGENTS.md": read("AGENTS.md"),
};

/** Flags a user types. Internal ones are not the reader's problem. */
const FLAGS = [
  "--input",
  "--format",
  "--lang",
  "--stamp",
  "--output",
  "--explain",
  "--top",
  "--record",
  "--update-baseline",
  "--baseline",
  "--cwd",
  "--no-color",
  "--version",
  "--help",
];

const COMMANDS = ["judge", "hook", "history", "version"];

describe("the docs describe the tool that exists", () => {
  it("documents every flag in the usage text", () => {
    // The usage block is what `--help` prints, so a flag missing from it is
    // invisible to anyone who does not read the source.
    const usage = cli.slice(cli.indexOf("const USAGE"), cli.indexOf("export async function main"));

    for (const flag of FLAGS) {
      expect(usage, `${flag} missing from --help`).toContain(flag);
    }
  });

  it("mentions every command somewhere a user will look", () => {
    for (const command of COMMANDS) {
      const mentioned = Object.entries(docs).filter(([, text]) =>
        text.includes(`zero-shelter ${command}`),
      );

      expect(mentioned.length, `no doc mentions "zero-shelter ${command}"`).toBeGreaterThan(0);
    }
  });

  it("keeps the two READMEs describing the same features", () => {
    // A translation that lags is a bug; this catches the loud half of it,
    // where one language gained a section the other never got.
    for (const feature of ["--format html", "--record", "--lang ko", "zero-shelter hook"]) {
      expect(docs["README.md"], `README.md lost ${feature}`).toContain(feature);
      expect(docs["README.ko.md"], `README.ko.md lost ${feature}`).toContain(feature);
    }
  });

  it("keeps the skills current with the output they read", () => {
    // The skills tell an agent what the JSON contains. When that drifts, the
    // agent describes fields that are no longer there.
    for (const field of ["upgrades", "transitiveFixes", "noLongerReported", "summary.shown"]) {
      expect(docs["skills/explain/SKILL.md"], `explain skill lost ${field}`).toContain(field);
    }
  });

  it("keeps every shipped skill described in both READMEs", () => {
    // A skill nobody is told about is a skill nobody invokes.
    for (const skill of ["setup", "explain", "fix", "baseline", "ci"]) {
      expect(docs["README.md"], `README.md never mentions ${skill}`).toContain(
        `zero-shelter:${skill}`,
      );
      expect(docs["README.ko.md"], `README.ko.md never mentions ${skill}`).toContain(
        `zero-shelter:${skill}`,
      );
    }
  });

  it("tells each skill to verify with this tool rather than npm audit", () => {
    // Left to itself an agent reaches for `npm audit`, which does not know the
    // baseline and will call a project clean while accepted findings stand.
    expect(docs["skills/fix/SKILL.md"]).toContain("not with `npm audit`");
    expect(docs["skills/ci/SKILL.md"]).toContain("Why not just `npm audit`");
  });

  it("keeps the agent brief saying the things agents get wrong", () => {
    // Every line here was written because an agent did the opposite in a real
    // session: rebuilt commands from fixedIn, verified with npm audit, or
    // treated a transitive package as installable.
    for (const rule of ["upgrades", "npm audit", "transitiveFixes", "--update-baseline"]) {
      expect(docs["AGENTS.md"], `AGENTS.md lost ${rule}`).toContain(rule);
    }
  });

  it("does not claim formats the CLI would reject", () => {
    const accepted = ["text", "json", "sarif", "html"];
    const claimed = [...docs["README.md"].matchAll(/--format (\w+)/g)].map((match) => match[1]!);

    for (const format of claimed) {
      expect(accepted, `README offers --format ${format}`).toContain(format);
    }
  });

  it("keeps option descriptions aligned across CLI usage and READMEs", () => {
    const extractOptionOffsets = (text: string, pattern: RegExp) => {
      const offsets: { line: string; descIndex: number }[] = [];
      // Split on either ending: a CRLF checkout would otherwise leave \r on
      // every line and shift the column this whole test is measuring.
      for (const line of text.split(/\r?\n/)) {
        const match = pattern.exec(line);
        if (match) {
          const descMatch = /^\s*(\S.*)$/.exec(line.slice(match[0].length));
          if (descMatch && descMatch[1]) {
            offsets.push({ line, descIndex: line.indexOf(descMatch[1]) });
          } else {
            offsets.push({ line, descIndex: -1 });
          }
        }
      }
      return offsets;
    };

    const usage = cli.slice(cli.indexOf("const USAGE"), cli.indexOf("export async function main"));
    const usageOffsets = extractOptionOffsets(usage, /^\s{2}--[a-z-]+(\s+<[^>]+>)?/);
    expect(usageOffsets.length).toBeGreaterThan(0);
    const expectedUsageCol = usageOffsets[0]!.descIndex;
    for (const entry of usageOffsets) {
      expect(entry.descIndex, `misaligned or missing desc in USAGE: "${entry.line}"`).toBe(expectedUsageCol);
    }

    /**
     * Found by the option lines, not by the heading above them.
     *
     * Anchoring on `## Options` missed `README.ko.md`, which heads the section
     * `## 옵션` — and on a CRLF checkout the literal missed both files, so the
     * slice spanned most of the document and picked up the options by
     * accident. That is why this test passed on Windows while checking
     * nothing. Failing loudly beats falling through to a slice of the file.
     */
    const extractReadmeBlock = (name: string, readme: string) => {
      const lines = readme.split(/\r?\n/);
      const first = lines.findIndex((line) => /^--[a-z-]+/.test(line));
      expect(first, `${name} has no option lines at all`).toBeGreaterThan(-1);

      const fence = lines.slice(0, first).lastIndexOf("```");
      expect(fence, `${name} option lines are not inside a code block`).toBeGreaterThan(-1);

      const end = lines.indexOf("```", fence + 1);
      expect(end, `${name} code block is never closed`).toBeGreaterThan(-1);

      return lines.slice(fence + 1, end).join("\n");
    };

    for (const [name, doc] of [["README.md", docs["README.md"]], ["README.ko.md", docs["README.ko.md"]]] as const) {
      const block = extractReadmeBlock(name, doc);
      const offsets = extractOptionOffsets(block, /^--[a-z-]+(\s+<[^>]+>)?/);
      expect(offsets.length).toBeGreaterThan(0);
      const expectedCol = offsets[0]!.descIndex;
      for (const entry of offsets) {
        expect(entry.descIndex, `misaligned or missing desc in ${name}: "${entry.line}"`).toBe(expectedCol);
      }
    }
  });
});

describe("shipping in more than one language", () => {
  it("offers every catalogue it ships", async () => {
    const { LANGUAGES } = await import("../src/messages.js");
    const usage = cli.slice(cli.indexOf("const USAGE"), cli.indexOf("export async function main"));

    for (const code of Object.keys(LANGUAGES)) {
      // A language nobody is told about is a translation nobody can reach.
      expect(usage, `--lang does not list ${code}`).toMatch(new RegExp(`\\b${code}\\b`));
    }
  });

  it("tells a translator what to do", () => {
    const contributing = read("CONTRIBUTING.md");

    expect(contributing).toContain("Adding a language");
    expect(contributing).toContain("RIGHT_TO_LEFT");
    // The two things that must not be translated.
    expect(contributing).toContain("terminal output");
    expect(contributing).toContain("code block");
  });

  it("lays the report out without assuming a direction", async () => {
    const { renderHtml } = await import("../src/html.js");
    const { judge } = await import("../src/judge.js");
    const { emptyBaseline } = await import("../src/baseline.js");

    const css = /<style>([\s\S]*?)<\/style>/.exec(
      renderHtml(judge([], { baseline: emptyBaseline() }), { language: "en" }),
    )![1]!;

    // Physical properties do not mirror, so a right-to-left translation would
    // arrive with its numbers and indents on the wrong side.
    expect(css).not.toMatch(/(margin|padding)-(left|right):/);
    expect(css).not.toMatch(/text-align:\s*(left|right)/);
  });
});
