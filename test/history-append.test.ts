/**
 * An interrupted write must cost one line, not every line after it.
 *
 * A cancelled workflow or a reclaimed runner leaves `history.jsonl` without a
 * final newline. `--record` appended straight onto that, welding the new entry
 * into the broken one — so the new run was unreadable too, and so was the next,
 * and the next. `history` went on reporting "1 line(s) could not be read"
 * while recording had silently stopped. See #196.
 *
 * Driven through the CLI rather than a helper, because the defect was in how
 * the file was opened and not in anything a unit could see. `--input` keeps it
 * offline: no scanner runs, so this stays a test about appending.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseHistory } from "../src/history.js";

const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "bin.js");
const TORN = '{"v":"1","at":"2026-01-01T00:00:00.000Z","sources":["npm audit"],"raw":5,"merg';

let project: string;

function run(...args: string[]): void {
  // judge exits 1 when there are findings, which is the normal case here.
  try {
    execFileSync(process.execPath, [cli, ...args], { cwd: project, stdio: "ignore" });
  } catch {
    /* the exit code is not what this file is about */
  }
}

const historyPath = (): string => join(project, ".zero-shelter", "history.jsonl");

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), "zs-history-"));
  writeFileSync(
    join(project, "report.json"),
    JSON.stringify({
      vulnerabilities: {
        lodash: {
          name: "lodash",
          severity: "critical",
          isDirect: true,
          via: [
            {
              source: 1065,
              title: "Prototype Pollution",
              url: "https://github.com/advisories/GHSA-jf85-cpcp-j695",
              severity: "critical",
              range: "<4.17.12",
            },
          ],
          range: "<4.17.12",
          fixAvailable: { name: "lodash", version: "4.17.21" },
        },
      },
    }),
  );
});

afterAll(() => rmSync(project, { recursive: true, force: true }));

describe("--record after an interrupted write", () => {
  it("keeps the entry readable instead of welding it onto the torn line", () => {
    run("judge", "--input", "report.json", "--record");

    const before = parseHistory(readFileSync(historyPath(), "utf8"));
    expect(before.entries).toHaveLength(1);
    expect(before.unreadable).toBe(0);

    appendFileSync(historyPath(), TORN);
    run("judge", "--input", "report.json", "--record");

    const after = parseHistory(readFileSync(historyPath(), "utf8"));

    // The torn line stays broken and stays counted. The run after it does not
    // join it — which is the whole defect.
    expect(after.unreadable).toBe(1);
    expect(after.entries).toHaveLength(2);
  });

  it("keeps recording after that, rather than stopping for good", () => {
    run("judge", "--input", "report.json", "--record");
    run("judge", "--input", "report.json", "--record");

    const after = parseHistory(readFileSync(historyPath(), "utf8"));

    expect(after.unreadable).toBe(1);
    expect(after.entries).toHaveLength(4);
  });

  it("does not add a blank line to a file that was written cleanly", () => {
    const raw = readFileSync(historyPath(), "utf8");

    expect(raw).not.toMatch(/\n\n/);
  });
});
