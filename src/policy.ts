/** Project-level filters for recurring, reviewable reporting policy. */

import { readFile } from "node:fs/promises";

import type { RankedFinding } from "./triage.js";
import { severityRank, type Severity } from "./finding.js";
import { scopeOf, type InstalledVersions, type Scope } from "./lockfile.js";

export const POLICY_PATH = ".zero-shelter/policy.json";

export interface Policy {
  readonly version: 1;
  readonly minimumSeverity?: Severity;
  readonly ignoreScopes: readonly Exclude<Scope, "mixed">[];
}

export interface AppliedPolicy {
  readonly config: Policy;
  readonly visible: readonly RankedFinding[];
  readonly filtered: readonly RankedFinding[];
}

const SEVERITIES: readonly Severity[] = ["critical", "high", "moderate", "low", "info"];

export async function loadPolicy(path: string): Promise<Policy | undefined> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error(`cannot read ${path}: ${(error as Error).message}`);
  }
  try {
    return parsePolicy(raw, path);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${path} is not valid JSON: ${error.message}`);
    throw error;
  }
}

export function parsePolicy(raw: string, path = POLICY_PATH): Policy {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path} must be a JSON object`);
  }
  const record = parsed as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "version" && key !== "minimumSeverity" && key !== "ignoreScopes") {
      throw new Error(`${path} has unknown key "${key}"`);
    }
  }
  if (record["version"] !== 1) throw new Error(`${path}.version must be 1`);

  let minimumSeverity: Severity | undefined;
  if (record["minimumSeverity"] !== undefined) {
    if (!SEVERITIES.includes(record["minimumSeverity"] as Severity)) {
      throw new Error(`${path}.minimumSeverity must be critical, high, moderate, low or info`);
    }
    minimumSeverity = record["minimumSeverity"] as Severity;
  }

  const ignoreScopesValue = record["ignoreScopes"];
  if (ignoreScopesValue !== undefined && !Array.isArray(ignoreScopesValue)) {
    throw new Error(`${path}.ignoreScopes must be an array of dev or prod`);
  }
  const ignoreScopes = (ignoreScopesValue ?? []).map((scope, index): Exclude<Scope, "mixed"> => {
    if (scope !== "dev" && scope !== "prod") {
      throw new Error(`${path}.ignoreScopes[${index}] must be dev or prod`);
    }
    return scope;
  });

  return {
    version: 1,
    ...(minimumSeverity === undefined ? {} : { minimumSeverity }),
    ignoreScopes: [...new Set(ignoreScopes)],
  };
}

export function applyPolicy(
  findings: readonly RankedFinding[],
  policy: Policy | undefined,
  installed?: InstalledVersions,
): AppliedPolicy | undefined {
  if (policy === undefined) return undefined;
  const filtered: RankedFinding[] = [];
  const visible: RankedFinding[] = [];
  const minimum = policy.minimumSeverity === undefined ? undefined : severityRank(policy.minimumSeverity);

  for (const finding of findings) {
    const belowMinimum = minimum !== undefined && severityRank(finding.finding.severity) > minimum;
    const scope = scopeOf(finding.finding.packageName, installed);
    const ignoredScope = policy.ignoreScopes.includes(scope as Exclude<Scope, "mixed">);
    if (belowMinimum || ignoredScope) filtered.push(finding);
    else visible.push(finding);
  }
  return { config: policy, visible, filtered };
}
