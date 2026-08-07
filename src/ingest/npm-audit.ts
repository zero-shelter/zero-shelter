/**
 * Ingest `npm audit --json` (report version 2, npm 7 and later).
 *
 * This is the one source we can always read: if a project has a lockfile it
 * has npm, so nothing needs installing before `zero-shelter judge` produces
 * something. Every other scanner is optional on top of it.
 */

import { fingerprint } from "../fingerprint.js";
import {
  type ScaFinding,
  type Severity,
  normalizeAliases,
  pickAdvisoryId,
} from "../finding.js";
import { normalizeText } from "../normalize.js";

const TOOL = "npm-audit";
const ECOSYSTEM = "npm";

const SEVERITIES = new Set<Severity>([
  "critical",
  "high",
  "moderate",
  "low",
  "info",
]);

export function parseNpmAudit(raw: string): ScaFinding[] {
  const report: unknown = JSON.parse(raw);
  const vulnerabilities = readVulnerabilities(report);

  const findings: ScaFinding[] = [];

  for (const packageName of Object.keys(vulnerabilities).sort()) {
    const entry = vulnerabilities[packageName];
    if (!isRecord(entry)) continue;

    for (const advisory of directAdvisoriesOf(entry)) {
      findings.push(toFinding(packageName, entry, advisory));
    }
  }

  // Sorting by fingerprint makes the output independent of key order in the
  // input, which is what lets us snapshot it.
  return findings.sort((a, b) => (a.fingerprint < b.fingerprint ? -1 : 1));
}

/**
 * The advisories actually filed against this package.
 *
 * `via` mixes two things. An object is a real advisory. A string is the name of
 * another vulnerable package that drags this one in — `mkdirp` has
 * `via: ["minimist"]` because the advisory belongs to minimist, not mkdirp.
 *
 * We deliberately do not follow those strings into new findings. Doing so
 * reports one advisory once per package it propagates through, which is a large
 * part of why `npm audit` output feels unusable in the first place. The
 * propagation is still visible: the package that owns the advisory is reported,
 * and its `effects` say what it reached.
 */
function directAdvisoriesOf(entry: Record<string, unknown>): Record<string, unknown>[] {
  const via = entry["via"];
  if (!Array.isArray(via)) return [];
  return via.filter(isRecord);
}

function toFinding(
  packageName: string,
  entry: Record<string, unknown>,
  advisory: Record<string, unknown>,
): ScaFinding {
  const aliases = normalizeAliases(aliasesOf(advisory));
  const advisoryId = pickAdvisoryId(aliases);

  const vulnerableRange = normalizeText(
    asString(advisory["range"]) ?? asString(entry["range"]) ?? "*",
  );

  const finding: ScaFinding = {
    kind: "SCA",
    fingerprint: fingerprint([ECOSYSTEM, packageName, advisoryId]),
    severity: severityOf(advisory, entry),
    title: normalizeText(
      asString(advisory["title"]) ?? `Vulnerability in ${packageName}`,
    ),
    ecosystem: ECOSYSTEM,
    packageName: normalizeText(packageName),
    vulnerableRange,
    advisoryId,
    aliases,
    transitive: entry["isDirect"] !== true,
    fixAvailable: entry["fixAvailable"] !== false && entry["fixAvailable"] !== undefined,
    sources: [{ tool: TOOL, ruleId: advisoryId }],
  };

  const fixedIn = fixedVersionOf(packageName, entry);
  return fixedIn === undefined ? finding : { ...finding, fixedIn };
}

/**
 * Every identifier that names this advisory.
 *
 * npm audit does not hand us a list. It gives an advisory URL, which for the
 * GitHub Advisory Database carries the GHSA id, plus its own numeric `source`.
 * That GHSA is usually the only thing it shares with osv-scanner, so losing it
 * here would make the two sources unmergeable.
 */
function aliasesOf(advisory: Record<string, unknown>): string[] {
  const aliases: string[] = [];

  const url = asString(advisory["url"]);
  if (url !== undefined) {
    const ghsa = /GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}/i.exec(url);
    if (ghsa) aliases.push(ghsa[0]);

    const cve = /CVE-\d{4}-\d{4,}/i.exec(url);
    if (cve) aliases.push(cve[0]);
  }

  // Case folding happens once, in normalizeAliases. Doing it here as well
  // would mean two places to keep in step.
  const source = advisory["source"];
  if (typeof source === "number" && Number.isInteger(source)) {
    aliases.push(`NPM-${source}`);
  }

  if (aliases.length === 0) {
    // Without any identifier there is nothing to merge on, but dropping the
    // finding would hide a real vulnerability. Fall back to the advisory's own
    // wording so it still has a stable identity within this source.
    const title = asString(advisory["title"]) ?? "unknown";
    aliases.push(`NPM-UNKNOWN-${fingerprint([normalizeText(title)])}`);
  }

  return aliases;
}

function severityOf(
  advisory: Record<string, unknown>,
  entry: Record<string, unknown>,
): Severity {
  for (const candidate of [advisory["severity"], entry["severity"]]) {
    if (typeof candidate === "string" && SEVERITIES.has(candidate as Severity)) {
      return candidate as Severity;
    }
  }
  return "info";
}

/**
 * The version to upgrade to, when npm can name one.
 *
 * `fixAvailable` is usually the bare value `true`, meaning a fix exists and
 * `npm audit fix` can reach it. Only the object form names a version, and even
 * then it may name a *parent* package to bump rather than this one. Reporting
 * that version here would tell the reader to install a version of this package
 * that was never published, so we return nothing unless the names match.
 */
function fixedVersionOf(
  packageName: string,
  entry: Record<string, unknown>,
): string | undefined {
  const fix = entry["fixAvailable"];
  if (!isRecord(fix)) return undefined;
  if (asString(fix["name"]) !== packageName) return undefined;

  const version = asString(fix["version"]);
  return version === undefined ? undefined : normalizeText(version);
}

function readVulnerabilities(report: unknown): Record<string, unknown> {
  if (!isRecord(report)) {
    throw new Error("npm audit output is not a JSON object");
  }

  const vulnerabilities = report["vulnerabilities"];
  if (vulnerabilities === undefined) {
    // npm 6 produced `advisories` instead. Saying so beats a confused failure
    // three steps later.
    if (report["advisories"] !== undefined) {
      throw new Error(
        "npm audit report is from npm 6; zero-shelter needs npm 7 or later (auditReportVersion 2)",
      );
    }
    throw new Error("npm audit output has no `vulnerabilities` field");
  }

  if (!isRecord(vulnerabilities)) {
    throw new Error("npm audit `vulnerabilities` is not an object");
  }

  return vulnerabilities;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
