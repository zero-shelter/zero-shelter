/**
 * Render one judged run as SARIF 2.1.0 for code-scanning consumers.
 */

import type { JudgeResult } from "./report.js";
import type { MergedFinding } from "./merge.js";
import type { RankedFinding } from "./triage.js";
import { messagesFor } from "./messages.js";
import { upgradeActions } from "./actions.js";
import { reachesEveryCopy, type InstalledVersions } from "./lockfile.js";
import { overrideSnippet, type PackageManager } from "./package-manager.js";
import { PACKAGE_VERSION } from "./version.js";

const TOOL_URI = "https://github.com/zero-shelter/zero-shelter";
const ENGLISH_MESSAGES = messagesFor("en");

/**
 * SARIF has four levels and no more. `moderate` and `low` both land on
 * `warning` because inventing a fifth would make the file invalid, and
 * flattening severity is exactly why our own score is carried in `properties`.
 */
function levelOf(severity: string): "error" | "warning" | "note" {
  switch (severity) {
    case "critical":
    case "high":
      return "error";
    case "moderate":
    case "low":
      return "warning";
    default:
      return "note";
  }
}

export function renderSarif(result: JudgeResult): string {
  const rules = result.fixNow.map(toRule);
  const manager = result.packageManager ?? "npm";
  const results = result.fixNow.map((entry, index) =>
    toResult(entry, index, result.installed, manager),
  );

  return `${JSON.stringify(
    {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "zero-shelter",
              informationUri: TOOL_URI,
              version: PACKAGE_VERSION,
              semanticVersion: PACKAGE_VERSION,
              rules,
            },
          },
          results,
          // Consumers that re-run the same commit should see the same run.
          // Everything here is derived from the findings, never from a clock.
          properties: {
            raw: result.raw,
            merged: result.merged,
            accepted: result.applied.suppressed.length,
            skipped: result.skipped,
            // Expose the display limit so consumers can distinguish a subset from all findings.
            outstanding: result.applied.fresh.length,
            truncated: result.fixNow.length < result.applied.fresh.length,
            // A stale baseline suppressed nothing, so every finding here is
            // reported as new. Terminal and JSON both say so; this did not.
            ...(result.applied.warning === undefined
              ? {}
              : { warning: result.applied.warning }),
          },
        },
      ],
    },
    null,
    2,
  )}\n`;
}

function toRule(entry: RankedFinding) {
  const { finding } = entry;

  return {
    id: finding.advisoryId,
    name: `${finding.ecosystem}/${finding.packageName}`,
    shortDescription: { text: finding.title },
    fullDescription: {
      text:
        `${finding.packageName} ${finding.vulnerableRange} is affected by ` +
        `${finding.advisoryId}.` +
        (finding.fixedIn === undefined
          ? finding.fixAvailable
            ? " A fix is available."
            : " No fix is available yet."
          : ` Fixed in ${finding.fixedIn}.`),
    },
    helpUri: helpUriFor(finding.advisoryId),
    properties: {
      security_severity: securitySeverity(finding.severity),
      tags: ["security", "dependency", finding.ecosystem],
    },
  };
}

function toResult(
  entry: RankedFinding,
  index: number,
  installed: InstalledVersions | undefined,
  manager: PackageManager,
) {
  const { finding } = entry;
  // Include remediation guidance in alert text.
  const remedy = remedyFor(entry, installed, manager);
  const toolVersions = toolVersionsOf(finding);

  return {
    ruleId: finding.advisoryId,
    ruleIndex: index,
    level: levelOf(finding.severity),
    message: {
      text:
        `${finding.packageName} ${finding.vulnerableRange}: ${finding.title}` +
        (finding.fixedIn === undefined ? "" : ` (fixed in ${finding.fixedIn})`) +
        (remedy === undefined ? "" : ` — ${remedy}`),
    },
    locations: [
      {
        physicalLocation: {
          // Dependency findings have no line to point at. The manifest is the
          // file a reader would actually edit, so that is where it goes.
          artifactLocation: { uri: "package.json" },
          region: { startLine: 1 },
        },
      },
    ],
    // SARIF fingerprints are stable for the same scanner set. Different alias
    // sets after merging can change them; see #86.
    partialFingerprints: { zeroShelter: finding.fingerprint },
    properties: {
      score: entry.score,
      reasons: entry.reasons.map(
        (reason) => `${reason.points} ${ENGLISH_MESSAGES.reasonText(reason)}`,
      ),
      tools: finding.tools,
      ...(toolVersions.length === 0
        ? {}
        : { toolVersions }),
      aliases: finding.aliases,
      possibleDuplicates: finding.relatedTo,
      // Preserve the advisory's evidence without deriving a floating-point
      // score from it. SARIF consumers can interpret the vector themselves.
      ...(finding.cvssVector === undefined ? {} : { cvssVector: finding.cvssVector }),
      ...(remedy === undefined ? {} : { remedy }),
    },
  };
}

/** Preserve scanner versions when a source supplied one, without guessing. */
function toolVersionsOf(finding: MergedFinding): { tool: string; version: string }[] {
  const byTool = new Map<string, Set<string>>();

  for (const member of finding.members) {
    for (const source of member.sources) {
      if (source.toolVersion === undefined) continue;
      const versions = byTool.get(source.tool);
      if (versions === undefined) byTool.set(source.tool, new Set([source.toolVersion]));
      else versions.add(source.toolVersion);
    }
  }

  return [...byTool.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .flatMap(([tool, versions]) => [...versions].sort().map((version) => ({ tool, version })));
}

/**
 * Describe a reported remedy. Do not emit SARIF fixes without an exact
 * manifest artifactChange.
 */
function remedyFor(
  entry: RankedFinding,
  installed: InstalledVersions | undefined,
  manager: PackageManager = "npm",
): string | undefined {
  const { finding } = entry;
  if (finding.fixedIn === undefined) return undefined;

  // Use the override path when parent ranges block a direct upgrade.
  if (finding.transitive || !reachesEveryCopy(finding.packageName, finding.fixedIn, installed)) {
    return (
      `arrives through another dependency; package.json ` +
      `${overrideSnippet(manager, finding.packageName, finding.fixedIn)} ` +
      "forces it, at the risk of breaking whatever pinned it"
    );
  }

  return upgradeActions([entry], installed, manager)[0]?.command;
}

/**
 * GitHub renders this as the severity band on an alert. It expects a numeric
 * CVSS-style value, but the scanner captures publish vectors without numeric
 * scores. Keep this coarse deterministic fallback while carrying the source
 * vector losslessly in each result's properties.
 */
function securitySeverity(severity: string): string {
  switch (severity) {
    case "critical":
      return "9.0";
    case "high":
      return "7.0";
    case "moderate":
      return "5.0";
    case "low":
      return "3.0";
    default:
      return "1.0";
  }
}

function helpUriFor(advisoryId: string): string {
  if (advisoryId.startsWith("GHSA-")) {
    return `https://github.com/advisories/${advisoryId.toLowerCase()}`;
  }
  if (advisoryId.startsWith("CVE-")) {
    return `https://nvd.nist.gov/vuln/detail/${advisoryId}`;
  }
  if (advisoryId.startsWith("OSV-")) {
    return `https://osv.dev/vulnerability/${advisoryId}`;
  }
  return TOOL_URI;
}
