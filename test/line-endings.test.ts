/**
 * Keep baseline files on LF across Git checkouts to avoid whole-file diffs
 * when recording on Windows. See #153.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { emptyBaseline, parseBaseline, serializeBaseline } from "../src/baseline.js";

const attributes = readFileSync(
  fileURLToPath(new URL("../.gitattributes", import.meta.url)),
  "utf8",
);

describe("what git is told to keep", () => {
  it.each([
    [".zero-shelter/*.json"],
    [".zero-shelter/*.jsonl"],
    ["bench/captures/**/*.json"],
    ["test/fixtures/**/*.json"],
  ])("pins %s to LF", (pattern) => {
    const line = attributes
      .split("\n")
      .find((candidate) => candidate.startsWith(pattern));

    expect(line, `${pattern} is not pinned in .gitattributes`).toBeDefined();
    expect(line).toMatch(/\btext\b/);
    expect(line).toMatch(/\beol=lf\b/);
  });
});

describe("what we write", () => {
  it("has no carriage return in it", () => {
    const serialized = serializeBaseline(emptyBaseline());

    expect(serialized).not.toMatch(/\r/);
    expect(serialized.endsWith("\n")).toBe(true);
  });

  /**
   * Reading is not the risk — `JSON.parse` tolerates CRLF. Writing what we
   * read is: a file that arrives as CRLF and leaves as LF is the whole-file
   * diff this is about.
   */
  it("normalises a file that arrived with CRLF", () => {
    const lf = serializeBaseline(emptyBaseline());
    const crlf = lf.replace(/\n/g, "\r\n");

    expect(parseBaseline(crlf)).toEqual(parseBaseline(lf));
    expect(serializeBaseline(parseBaseline(crlf))).toBe(lf);
  });
});
