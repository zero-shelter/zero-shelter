/**
 * Ingest `osv-scanner --format json`.
 *
 * The reason this source matters is not that it finds more than npm audit. It
 * is that it publishes `aliases` — the GHSA, CVE and OSV names for one
 * advisory, in one list. npm audit gives a single identifier per finding, so
 * without osv-scanner there is frequently nothing for the merge step to join on.
 */

import { fingerprint } from "../fingerprint.js";
import {
  type ScaFinding,
  type Severity,
  normalizeAliases,
  pickAdvisoryId,
} from "../finding.js";
import { normalizeText, normalizeRange } from "../normalize.js";

const TOOL = "osv-scanner";

export function parseOsv(
  raw: string,
  toolVersion?: string,
  declared?: ReadonlySet<string>,
): ScaFinding[] {
  const report: unknown = JSON.parse(raw);
  if (!isRecord(report)) throw new Error("osv-scanner output is not a JSON object");

  const results = report["results"];
  if (!Array.isArray(results)) {
    throw new Error("osv-scanner output has no `results` array");
  }

  const findings: ScaFinding[] = [];

  for (const result of results) {
    if (!isRecord(result)) continue;
    const packages = result["packages"];
    if (!Array.isArray(packages)) continue;

    for (const pkg of packages) {
      if (!isRecord(pkg)) continue;
      findings.push(...findingsForPackage(pkg, toolVersion, declared));
    }
  }

  return dedupeByFingerprint(findings).sort((a, b) =>
    a.fingerprint < b.fingerprint ? -1 : 1,
  );
}

/**
 * Whether the manifest asks for this package by name.
 *
 * The comment below is still right that this source cannot tell. What changed
 * is that it used to defer to a source that knows, and on yarn, pnpm and every
 * non-npm ecosystem no such source runs — so the placeholder became the answer
 * and a declared dependency was described as arriving through another one.
 * `declared` is `package.json` answering the only part of the question it can.
 * Undefined where there is no readable manifest, which is the old behaviour.
 */
function isTransitive(
  packageName: string,
  declared: ReadonlySet<string> | undefined,
): boolean {
  return declared === undefined ? true : !declared.has(packageName);
}

function findingsForPackage(
  pkg: Record<string, unknown>,
  toolVersion: string | undefined,
  declared: ReadonlySet<string> | undefined,
): ScaFinding[] {
  const meta = isRecord(pkg["package"]) ? pkg["package"] : {};
  const packageName = asString(meta["name"]);
  if (packageName === undefined) return [];

  const ecosystem = (asString(meta["ecosystem"]) ?? "npm").toLowerCase();
  const installedVersion = asString(meta["version"]);

  const vulnerabilities = pkg["vulnerabilities"];
  if (!Array.isArray(vulnerabilities)) return [];

  const findings: ScaFinding[] = [];

  for (const vuln of vulnerabilities) {
    if (!isRecord(vuln)) continue;

    const id = asString(vuln["id"]);
    if (id === undefined) continue;

    const aliases = normalizeAliases([id, ...stringsOf(vuln["aliases"])]);
    const advisoryId = pickAdvisoryId(aliases);

    const fixed = fixedVersionOf(vuln, packageName);
    const published = asString(vuln["published"]);
    const cvssVector = cvssOf(vuln);

    const finding: ScaFinding = {
      kind: "SCA",
      fingerprint: fingerprint([ecosystem, packageName, advisoryId]),
      severity: severityOf(vuln),
      title: normalizeText(
        asString(vuln["summary"]) ?? `Vulnerability in ${packageName}`,
      ),
      ecosystem,
      packageName: normalizeText(packageName),
      vulnerableRange: rangeOf(vuln, packageName, installedVersion),
      advisoryId,
      aliases,
      // osv-scanner reports what it finds in the lockfile without saying
      // whether the manifest asks for it directly. Claiming to know would be
      // worse than deferring to a source that does — see isTransitive for what
      // happens when no such source runs.
      transitive: isTransitive(normalizeText(packageName), declared),
      fixAvailable: fixed !== undefined,
      sources: toolVersion === undefined
        ? [{ tool: TOOL, ruleId: id }]
        : [{ tool: TOOL, toolVersion, ruleId: id }],
      ...(published === undefined ? {} : { published }),
      ...(cvssVector === undefined ? {} : { cvssVector }),
    };

    findings.push(fixed === undefined ? finding : { ...finding, fixedIn: fixed });
  }

  return findings;
}

/**
 * The version range this advisory applies to.
 *
 * OSV models ranges as a list of events (`introduced`, `fixed`) per affected
 * package, which is more precise than the single string npm audit gives us. We
 * render it back to a comparable string rather than keeping two shapes, since
 * the only consumer is a human reading a report.
 */
function rangeOf(
  vuln: Record<string, unknown>,
  packageName: string,
  installedVersion: string | undefined,
): string {
  const affected = vuln["affected"];
  if (Array.isArray(affected)) {
    for (const entry of affected) {
      if (!isRecord(entry)) continue;
      const pkg = isRecord(entry["package"]) ? entry["package"] : {};
      if (asString(pkg["name"]) !== packageName) continue;

      const rendered = renderRanges(entry["ranges"]);
      if (rendered !== undefined) return rendered;
    }
  }

  // Nothing usable in the advisory: say what we actually know, which is the
  // version present, rather than implying a range we did not read.
  return installedVersion === undefined ? "*" : normalizeRange(`= ${installedVersion}`);
}

function renderRanges(ranges: unknown): string | undefined {
  if (!Array.isArray(ranges)) return undefined;

  const parts: string[] = [];

  for (const range of ranges) {
    if (!isRecord(range)) continue;
    const events = range["events"];
    if (!Array.isArray(events)) continue;

    let introduced: string | undefined;
    for (const event of events) {
      if (!isRecord(event)) continue;

      const from = asString(event["introduced"]);
      if (from !== undefined) {
        introduced = from === "0" ? undefined : from;
        continue;
      }

      const fixed = asString(event["fixed"]);
      if (fixed !== undefined) {
        parts.push(introduced === undefined ? `< ${fixed}` : `>= ${introduced} < ${fixed}`);
        introduced = undefined;
      }
    }

    if (introduced !== undefined) parts.push(`>= ${introduced}`);
  }

  return parts.length === 0 ? undefined : normalizeRange(parts.join(" || "));
}

function fixedVersionOf(
  vuln: Record<string, unknown>,
  packageName: string,
): string | undefined {
  const affected = vuln["affected"];
  if (!Array.isArray(affected)) return undefined;

  const fixes: string[] = [];

  for (const entry of affected) {
    if (!isRecord(entry)) continue;
    const pkg = isRecord(entry["package"]) ? entry["package"] : {};
    if (asString(pkg["name"]) !== packageName) continue;

    const ranges = entry["ranges"];
    if (!Array.isArray(ranges)) continue;

    for (const range of ranges) {
      if (!isRecord(range)) continue;
      const events = range["events"];
      if (!Array.isArray(events)) continue;

      for (const event of events) {
        if (!isRecord(event)) continue;
        const fixed = asString(event["fixed"]);
        if (fixed !== undefined) fixes.push(normalizeText(fixed));
      }
    }
  }

  // Several fixed versions means several affected branches. Naming one would
  // be a guess about which branch the reader is on, so we say nothing.
  return fixes.length === 1 ? fixes[0] : undefined;
}

/**
 * Map OSV severity to ours.
 *
 * `database_specific.severity` is the GitHub-style word when present. CVSS
 * vectors are deliberately not parsed here: turning a vector into a band is a
 * judgement call that belongs in one place, and inventing a second one inside a
 * parser is how two sources start disagreeing about the same advisory.
 */
function severityOf(vuln: Record<string, unknown>): Severity {
  const specific = isRecord(vuln["database_specific"]) ? vuln["database_specific"] : {};
  const word = asString(specific["severity"])?.toLowerCase();

  switch (word) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "moderate":
    case "medium":
      return "moderate";
    case "low":
      return "low";
    default:
      return "info";
  }
}

/**
 * osv-scanner reports a package once per lockfile it appears in, so a monorepo
 * yields the same advisory many times. Collapsing here keeps that from looking
 * like cross-scanner duplication later.
 */
function dedupeByFingerprint(findings: readonly ScaFinding[]): ScaFinding[] {
  const seen = new Map<string, ScaFinding>();
  for (const finding of findings) {
    if (!seen.has(finding.fingerprint)) seen.set(finding.fingerprint, finding);
  }
  return [...seen.values()];
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * The CVSS vector, when the advisory carries one.
 *
 * `severity` is a list because an advisory can be scored under more than one
 * revision of CVSS. We take the first rather than trying to rank the revisions
 * against each other, and we take the string exactly as written.
 */
function cvssOf(vuln: Record<string, unknown>): string | undefined {
  const severity = vuln["severity"];
  if (!Array.isArray(severity)) return undefined;
  for (const entry of severity) {
    if (!isRecord(entry)) continue;
    const score = asString(entry["score"]);
    if (score !== undefined && score.startsWith("CVSS:")) return score;
  }
  return undefined;
}
