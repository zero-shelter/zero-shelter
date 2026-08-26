/**
 * The two claims a user has to take on trust before running this at all: that
 * it does not phone anywhere, and that it does not write to their repository
 * unless asked.
 *
 * Both are true today. Neither is the kind of thing that stays true by itself —
 * one `fetch` for an advisory description, one cache file "for speed", and the
 * README becomes a lie about the thing people chose it for.
 */

import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every .ts under src/, since that is what becomes the published dist/. */
async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return entry.name.endsWith(".ts") ? [path] : [];
    }),
  );
  return files.flat();
}

describe("no network of our own", () => {
  it("imports nothing that can open a socket", async () => {
    const files = await sourceFiles(join(root, "src"));
    expect(files.length).toBeGreaterThan(5);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      // Comments talk about networks constantly; code must not.
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

      expect(code, `${file} imports a network module`).not.toMatch(
        /from ["']node:(http|https|net|dgram|tls|dns)["']/,
      );
      expect(code, `${file} calls fetch`).not.toMatch(/\bfetch\s*\(/);
      expect(code, `${file} constructs a request`).not.toMatch(/new (XMLHttpRequest|WebSocket)\b/);
    }
  });

  it("ships a report that pulls nothing in", async () => {
    const { renderHtml } = await import("../src/html.js");
    const { judge } = await import("../src/judge.js");
    const { emptyBaseline } = await import("../src/baseline.js");

    const page = renderHtml(judge([], { baseline: emptyBaseline() }), { language: "en" });

    // A single remote font or stylesheet would make the page fail to render
    // the way it looks here, on the machine of someone who opened it offline.
    expect(page).not.toMatch(/<link[^>]+href=|<script[^>]+src=|@import|url\(\s*https?:/);
  });
});

describe("no writing unless asked", () => {
  it("leaves the project exactly as it found it", async () => {
    const project = await mkdtemp(join(tmpdir(), "zs-writes-"));
    await writeFile(
      join(project, "package.json"),
      JSON.stringify({ name: "w", version: "1.0.0", dependencies: { lodash: "4.17.11" } }),
    );
    // npm is a .cmd shim on Windows and execFile cannot invoke it without a
    // shell — the same reason scan.ts and the QA script pass this flag. The
    // project goes through `cwd` rather than `--prefix` so no temp path has to
    // survive a Windows command line.
    await run("npm", ["install", "--package-lock-only", "--no-audit", "--no-fund", "--ignore-scripts"], {
      cwd: project,
      shell: process.platform === "win32",
    });

    const before = (await readdir(project)).sort();

    const bin = join(root, "dist", "bin.js");
    const quiet = async (args: string[]) =>
      run("node", [bin, ...args], { cwd: project }).catch(() => undefined);

    await quiet(["judge"]);
    await quiet(["judge", "--format", "html"]);
    await quiet(["judge", "--format", "sarif"]);

    // --record and --update-baseline are the two that may write, and neither
    // was passed.
    expect((await readdir(project)).sort()).toEqual(before);
  }, 120_000);
});

describe("the invariants the README calls unbreakable", () => {
  it("scores with integers only", async () => {
    const { readFileSync } = await import("node:fs");
    const { parseNpmAudit } = await import("../src/ingest/npm-audit.js");
    const { judge } = await import("../src/judge.js");
    const { emptyBaseline } = await import("../src/baseline.js");
    const { WEIGHTS } = await import("../src/triage.js");

    const findings = parseNpmAudit(
      readFileSync(join(root, "bench/captures/nodegoat/npm-audit.json"), "utf8"),
    );
    const result = judge(findings, { baseline: emptyBaseline() });

    expect(result.fixNow.length).toBeGreaterThan(50);
    for (const entry of result.fixNow) {
      // A float here would round differently by platform, and every number we
      // publish would be true only on the machine that produced it.
      expect(Number.isInteger(entry.score), `score ${entry.score} is not an integer`).toBe(true);
      for (const reason of entry.reasons) {
        expect(Number.isInteger(reason.points)).toBe(true);
      }
    }

    for (const points of [...Object.values(WEIGHTS.severity), WEIGHTS.directDependency]) {
      expect(Number.isInteger(points)).toBe(true);
    }
  });

  it("delivers the verdict as 'no longer reported', never as 'fixed'", async () => {
    const { LANGUAGES } = await import("../src/messages.js");

    for (const [language, catalogue] of Object.entries(LANGUAGES)) {
      const sentences = Object.values(catalogue)
        .filter((value): value is string => typeof value === "string")
        .join(" ");

      // The word may appear while drawing the distinction — "a finding leaves
      // this list when it is fixed, when it is accepted, or when the scanner
      // did not run" — but never as a count of what happened.
      const verdict = /\d+\s+\S*\s*(fixed|고쳐|해결됨)/.test(sentences);
      expect(verdict, `${language} counts findings as fixed`).toBe(false);

      expect(sentences).toMatch(/no longer reported|더 이상 보고되지 않/);
    }
  });
});
