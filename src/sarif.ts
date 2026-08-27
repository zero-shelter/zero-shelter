/**
 * SARIF 2.1.0 output.
 *
 * This is how the judgement reaches somewhere people already look. Uploading
 * the file to GitHub code scanning puts the short list in the Security tab and
 * annotates the pull request, which is where the ratchet was always meant to
 * be read.
 *
 * There is an irony worth naming: this project exists because SARIF from
 * different tools cannot be reconciled by the tools that consume it. Emitting
 * SARIF is not a contradiction — it means downstream receives one already-
 * judged run instead of four raw ones to fail at merging.
 */

import type { JudgeResult } from "./report.js";
import type { RankedFinding } from "./triage.js";
import { upgradeActions } from "./actions.js";
import { reachesEveryCopy, type InstalledVersions } from "./lockfile.js";

const TOOL_URI = "https://github.com/zero-shelter/zero-shelter";

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
  const results = result.fixNow.map((entry, index) => toResult(entry, index, result.installed));

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

function toResult(entry: RankedFinding, index: number, installed?: InstalledVersions) {
  const { finding } = entry;
  // Carried into the alert text on purpose. Someone reading this in a Security
  // tab is one click from a page of prose about the advisory and nowhere near
  // the one line that resolves it.
  const remedy = remedyFor(entry, installed);

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
    // GitHub uses these to decide whether an alert is the same one it saw
    // before. Ours is stable across machines, and across runs that used the
    // same set of scanners — it is derived after merge, and merge output
    // depends on who contributed. Change the set and the alert history breaks:
    // measured on one capture, 73 fingerprints with one source and 82 with two,
    // sharing 3. See issue #86.
    partialFingerprints: { zeroShelter: finding.fingerprint },
    properties: {
      score: entry.score,
      reasons: entry.reasons.map((reason) => `${reason.points} ${reason.label}`),
      tools: finding.tools,
      aliases: finding.aliases,
      possibleDuplicates: finding.relatedTo,
      ...(remedy === undefined ? {} : { remedy }),
    },
  };
}

/**
 * What to do about one finding, in a sentence.
 *
 * Not emitted as a SARIF `fixes` entry: that requires an artifactChange with
 * the exact replacement text, and we would be guessing at how the version is
 * written in a manifest we have not parsed. A wrong patch offered as a fix is
 * worse than a sentence that is right.
 */
function remedyFor(entry: RankedFinding, installed?: InstalledVersions): string | undefined {
  const { finding } = entry;
  if (finding.fixedIn === undefined) return undefined;

  // Direct and unreachable reads the same way here as transitive does: an
  // `npm i` that other packages will not follow leaves the alert open, and a
  // Security tab is the last place to send someone after a command that does
  // nothing.
  if (finding.transitive || !reachesEveryCopy(finding.packageName, finding.fixedIn, installed)) {
    return (
      `arrives through another dependency; ` +
      `package.json "overrides": { "${finding.packageName}": "${finding.fixedIn}" } ` +
      "forces it, at the risk of breaking whatever pinned it"
    );
  }

  return upgradeActions([entry], installed)[0]?.command;
}

/**
 * GitHub renders this as the severity band on an alert. It expects a CVSS-style
 * number, so the mapping is coarse and deliberately conservative — we do not
 * have a CVSS vector and will not invent one.
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
