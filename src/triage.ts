/**
 * Decide what to fix now.
 *
 * Scoring is integer-only and the weights live in one exported table, because
 * `--explain` reads that table rather than re-describing the logic. A second
 * description of the rules is a second place for them to be wrong.
 */

import type { MergedFinding } from "./merge.js";
import type { Severity } from "./finding.js";

export const WEIGHTS = {
  severity: {
    critical: 100,
    high: 70,
    moderate: 40,
    low: 15,
    info: 5,
  } satisfies Record<Severity, number>,

  /** You can act on a direct dependency today; a transitive one may need a parent bump. */
  directDependency: 20,

  /** A named fix turns "be aware of this" into a task with an end. */
  fixAvailable: 25,

  /** Two tools agreeing is weak evidence that it is not a parsing artefact. */
  corroboratedPerExtraTool: 10,

  /**
   * Something else for this package could not be joined to this finding.
   * Slightly favoured, because a reader looking at the package once can settle
   * both at the same time.
   */
  hasUnjoinedSibling: 5,
} as const;

export type Reason =
  | {
      readonly kind: "severity";
      readonly severity: Severity;
      readonly points: number;
    }
  | {
      readonly kind: "direct";
      readonly points: number;
    }
  | {
      readonly kind: "fixAvailable";
      readonly fixedIn: string | undefined;
      readonly points: number;
    }
  | {
      readonly kind: "corroborated";
      readonly tools: number;
      readonly points: number;
    }
  | {
      readonly kind: "unjoinedSibling";
      readonly count: number;
      readonly points: number;
    };

export interface RankedFinding {
  readonly finding: MergedFinding;
  readonly score: number;
  readonly reasons: readonly Reason[];
}

export function rank(findings: readonly MergedFinding[]): RankedFinding[] {
  return findings
    .map(score)
    .sort(
      (a, b) =>
        b.score - a.score ||
        // Ties broken by fingerprint so the order never depends on input order.
        (a.finding.fingerprint < b.finding.fingerprint ? -1 : 1),
    );
}

function score(finding: MergedFinding): RankedFinding {
  const reasons: Reason[] = [
    {
      kind: "severity",
      severity: finding.severity,
      points: WEIGHTS.severity[finding.severity],
    },
  ];

  if (!finding.transitive) {
    reasons.push({ kind: "direct", points: WEIGHTS.directDependency });
  }

  if (finding.fixAvailable) {
    reasons.push({
      kind: "fixAvailable",
      fixedIn: finding.fixedIn,
      points: WEIGHTS.fixAvailable,
    });
  }

  const extraTools = finding.tools.length - 1;
  if (extraTools > 0) {
    reasons.push({
      kind: "corroborated",
      tools: finding.tools.length,
      points: extraTools * WEIGHTS.corroboratedPerExtraTool,
    });
  }

  if (finding.relatedTo.length > 0) {
    reasons.push({
      kind: "unjoinedSibling",
      count: finding.relatedTo.length,
      points: WEIGHTS.hasUnjoinedSibling,
    });
  }

  return {
    finding,
    score: reasons.reduce((total, reason) => total + reason.points, 0),
    reasons,
  };
}
