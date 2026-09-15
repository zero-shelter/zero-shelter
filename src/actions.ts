/**
 * Group findings into package upgrades using the highest reported fixed version.
 */

import type { RankedFinding } from "./triage.js";
import { isHigher } from "./version-order.js";
import { reachesEveryCopy, type InstalledVersions } from "./lockfile.js";
import { installCommand, type PackageManager } from "./package-manager.js";

export interface TransitiveFix {
  readonly packageName: string;
  readonly upgradeTo: string;
  readonly clears: number;
}

export interface UpgradeAction {
  readonly packageName: string;
  /** The highest fixed version among the findings this clears. */
  readonly upgradeTo: string;
  /** How many of the reported findings this one upgrade removes. */
  readonly clears: number;
  readonly command: string;
}

/**
 * Direct dependencies with a reported fixed version.
 *
 * A direct installation can leave vulnerable transitive copies in place. When
 * the npm lockfile shows a parent range blocking the upgrade, the finding is
 * handled by transitiveFixes instead. Other managers omit unverifiable counts.
 */
export function upgradeActions(
  findings: readonly RankedFinding[],
  installed?: InstalledVersions,
  manager: PackageManager = "npm",
): UpgradeAction[] {
  const byPackage = new Map<string, { version: string; clears: number }>();

  for (const { finding } of findings) {
    if (finding.transitive || finding.fixedIn === undefined) continue;
    if (!reachesEveryCopy(finding.packageName, finding.fixedIn, installed)) continue;

    const seen = byPackage.get(finding.packageName);
    if (seen === undefined) {
      byPackage.set(finding.packageName, { version: finding.fixedIn, clears: 1 });
      continue;
    }

    seen.clears += 1;
    if (isHigher(finding.fixedIn, seen.version)) seen.version = finding.fixedIn;
  }

  return [...byPackage.entries()]
    .map(([packageName, { version, clears }]) => ({
      packageName,
      upgradeTo: version,
      clears,
      command: installCommand(manager, packageName, version),
    }))
    .sort((a, b) => b.clears - a.clears || (a.packageName < b.packageName ? -1 : 1));
}

/**
 * Findings with a fixed version that require a parent update or a forced
 * version. Overrides can break the parent package and require user review.
 */
export function transitiveFixes(
  findings: readonly RankedFinding[],
  installed?: InstalledVersions,
): TransitiveFix[] {
  const byPackage = new Map<string, { version: string; clears: number }>();

  for (const { finding } of findings) {
    if (finding.fixedIn === undefined) continue;
    // Direct but unreachable belongs here too — same remedy, same caveat.
    if (!finding.transitive && reachesEveryCopy(finding.packageName, finding.fixedIn, installed)) {
      continue;
    }

    const seen = byPackage.get(finding.packageName);
    if (seen === undefined) {
      byPackage.set(finding.packageName, { version: finding.fixedIn, clears: 1 });
      continue;
    }

    seen.clears += 1;
    if (isHigher(finding.fixedIn, seen.version)) seen.version = finding.fixedIn;
  }

  return [...byPackage.entries()]
    .map(([packageName, { version, clears }]) => ({
      packageName,
      upgradeTo: version,
      clears,
    }))
    .sort((a, b) => b.clears - a.clears || (a.packageName < b.packageName ? -1 : 1));
}
