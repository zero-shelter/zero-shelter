/**
 * The ratchet.
 *
 * A repository with history lights up on the first run. Demanding all of it be
 * fixed is the same as being ignored, so the first run records what is already
 * there and afterwards only new findings are surfaced.
 */

import { SCHEMA_VERSION } from "./fingerprint.js";
import { stableStringify } from "./normalize.js";
import type { RankedFinding } from "./triage.js";

export const BASELINE_PATH = ".zero-shelter/baseline.json";

export interface Baseline {
  readonly schemaVersion: string;
  /** Sorted fingerprints. Readable on purpose — reviewers should be able to diff it. */
  readonly accepted: readonly string[];
}

export interface AppliedBaseline {
  readonly fresh: RankedFinding[];
  readonly suppressed: RankedFinding[];
  /**
   * Set when the baseline could not be honoured. The caller must show this:
   * silently ignoring a stale baseline turns every known finding into a new
   * one, which looks like a sudden regression nobody caused.
   */
  readonly warning?: string;
}

export function emptyBaseline(): Baseline {
  return { schemaVersion: SCHEMA_VERSION, accepted: [] };
}

export function parseBaseline(raw: string): Baseline {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${BASELINE_PATH} is not a JSON object`);
  }

  const record = parsed as Record<string, unknown>;
  const schemaVersion = record["schemaVersion"];
  const accepted = record["accepted"];

  if (typeof schemaVersion !== "string") {
    throw new Error(`${BASELINE_PATH} has no schemaVersion`);
  }
  if (!Array.isArray(accepted) || accepted.some((v) => typeof v !== "string")) {
    throw new Error(`${BASELINE_PATH} accepted must be an array of strings`);
  }

  return { schemaVersion, accepted: [...(accepted as string[])].sort() };
}

export function serializeBaseline(baseline: Baseline): string {
  return `${stableStringify({
    schemaVersion: baseline.schemaVersion,
    accepted: [...baseline.accepted].sort(),
  })}\n`;
}

export function baselineFrom(findings: readonly RankedFinding[]): Baseline {
  return {
    schemaVersion: SCHEMA_VERSION,
    accepted: [...new Set(findings.map((f) => f.finding.fingerprint))].sort(),
  };
}

/**
 * Split findings into new and already-accepted.
 *
 * A schema version mismatch means every fingerprint was computed by a different
 * recipe, so the recorded ones cannot match anything. Rather than suppress
 * nothing and let the reader assume the ratchet worked, we report the whole set
 * as new **and say why**.
 */
export function applyBaseline(
  findings: readonly RankedFinding[],
  baseline: Baseline,
): AppliedBaseline {
  if (baseline.schemaVersion !== SCHEMA_VERSION) {
    return {
      fresh: [...findings],
      suppressed: [],
      warning:
        `${BASELINE_PATH} was written for schema ${baseline.schemaVersion}, ` +
        `but fingerprints are now schema ${SCHEMA_VERSION}. Every finding is ` +
        `reported as new until you re-record it with --update-baseline.`,
    };
  }

  const accepted = new Set(baseline.accepted);
  const fresh: RankedFinding[] = [];
  const suppressed: RankedFinding[] = [];

  for (const finding of findings) {
    (accepted.has(finding.finding.fingerprint) ? suppressed : fresh).push(finding);
  }

  return { fresh, suppressed };
}
