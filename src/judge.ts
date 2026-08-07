/**
 * The pipeline, with no I/O of its own.
 *
 * Keeping this pure is what lets the tests drive the whole path from fixtures
 * without spawning scanners, which is the difference between covering the
 * judgement and covering the subprocess plumbing.
 */

import { type Baseline, applyBaseline } from "./baseline.js";
import { mergeFindings } from "./merge.js";
import type { ScaFinding } from "./finding.js";
import type { JudgeResult } from "./report.js";
import { rank } from "./triage.js";

export interface JudgeOptions {
  readonly baseline: Baseline;
  readonly skipped?: readonly string[];
  readonly baselineExists?: boolean;
  /** Cap on how many findings the report asks anyone to act on at once. */
  readonly top?: number;
}

export function judge(
  findings: readonly ScaFinding[],
  options: JudgeOptions,
): JudgeResult {
  const merged = mergeFindings(findings);
  const ranked = rank(merged);
  const applied = applyBaseline(ranked, options.baseline);

  const top = options.top ?? Number.POSITIVE_INFINITY;

  return {
    raw: findings.length,
    merged: merged.length,
    applied,
    fixNow: applied.fresh.slice(0, top),
    skipped: [...(options.skipped ?? [])],
    baselineExists: options.baselineExists ?? true,
  };
}
