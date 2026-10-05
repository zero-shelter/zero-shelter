/** Count which scanner sources uniquely contribute each merged finding. */

import type { Severity } from "./finding.js";
import type { MergedFinding } from "./merge.js";

export interface SeverityCounts {
  readonly critical: number;
  readonly high: number;
  readonly moderate: number;
  readonly low: number;
  readonly info: number;
}

export interface SourceAttribution {
  readonly source: string;
  readonly unique: number;
  readonly severity: SeverityCounts;
}

export interface Attribution {
  readonly total: number;
  readonly corroborated: number;
  readonly corroboratedSeverity: SeverityCounts;
  readonly unique: readonly SourceAttribution[];
}

const SEVERITIES: readonly Severity[] = ["critical", "high", "moderate", "low", "info"];

function emptySeverity(): Record<Severity, number> {
  return { critical: 0, high: 0, moderate: 0, low: 0, info: 0 };
}

/** Partition every merged finding exactly once. */
export function attribute(findings: readonly MergedFinding[]): Attribution {
  const unique = new Map<string, { count: number; severity: Record<Severity, number> }>();
  const corroboratedSeverity = emptySeverity();
  let corroborated = 0;

  for (const finding of findings) {
    const tools = [...new Set(finding.tools)].sort();
    if (tools.length <= 1) {
      const source = tools[0] ?? "unknown";
      const bucket = unique.get(source) ?? { count: 0, severity: emptySeverity() };
      bucket.count += 1;
      bucket.severity[finding.severity] += 1;
      unique.set(source, bucket);
      continue;
    }
    corroborated += 1;
    corroboratedSeverity[finding.severity] += 1;
  }

  return {
    total: findings.length,
    corroborated,
    corroboratedSeverity,
    unique: [...unique.entries()]
      .map(([source, bucket]) => ({ source, unique: bucket.count, severity: bucket.severity }))
      .sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0)),
  };
}

export function severityBreakdown(counts: SeverityCounts): string {
  return SEVERITIES.filter((severity) => counts[severity] > 0)
    .map((severity) => `${counts[severity]} ${severity}`)
    .join(", ");
}
