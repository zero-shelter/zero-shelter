/**
 * The single normalization gate.
 *
 * Everything that ends up in a fingerprint MUST pass through here first.
 * If two machines disagree about what a string is, they will disagree about
 * every fingerprint downstream — and a fingerprint that changes across
 * machines silently breaks dedup, baselines, and every number we report.
 */

/** Strip BOM, normalize to NFC, and collapse CRLF/CR to LF. */
export function normalizeText(input: string): string {
  return input
    .replace(/^﻿/, "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n");
}

/**
 * One spelling for a version range.
 *
 * `ingest/osv.ts` builds `< 0.2.4` from OSV's event list; npm writes `<0.2.4`
 * and we take it verbatim. Same range, two strings, one of them ours — and
 * `siblingKey` in merge.ts includes the range, so two findings describing an
 * identical range never matched as suspected duplicates. That is precisely
 * the case `possibleDuplicates` exists for.
 *
 * Syntactic, deliberately. This closes the gap after a comparison operator
 * and nothing else: it does not know that `>=1.0.0 <2.0.0` and `1.0.0 - 2.0.0`
 * describe the same versions, and deciding that needs a resolver we do not
 * have. `src/version-range.ts` is where that question lives.
 */
export function normalizeRange(input: string): string {
  // The space between two clauses is meaningful and stays. Only the one
  // between an operator and the version it applies to is noise.
  return normalizeText(input).replace(/([<>]=?|=|~|\^)[ \t]+/g, "$1");
}

/**
 * Normalize a file path to a repo-relative POSIX path.
 *
 * Scanners report paths in whatever the host OS uses, and some prefix them
 * with `./`, `file://`, or an absolute build path. All of those describe the
 * same file, so they must collapse to one string.
 */
export function normalizePath(input: string): string {
  let p = normalizeText(input).trim();

  if (p.startsWith("file://")) p = p.slice("file://".length);

  p = p.replace(/\\/g, "/");
  // ponytail: drive letters only appear on Windows scanner output; a regex
  // beats pulling in a path library for one case.
  p = p.replace(/^[A-Za-z]:\//, "/");
  p = p.replace(/\/{2,}/g, "/");

  while (p.startsWith("./")) p = p.slice(2);
  if (p.startsWith("/")) p = p.slice(1);

  return p;
}

/**
 * Deterministic JSON. `JSON.stringify` preserves insertion order, so two
 * objects with the same content but different key order serialize differently.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value === null || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    sorted[key] = sortDeep(source[key]);
  }
  return sorted;
}
