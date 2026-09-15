/**
 * Record accepted findings and compare later scans against them.
 *
 * Acceptances include aliases so the same advisory can still match when the
 * scanner set changes. The readable record also preserves the risk decision.
 * Creating or updating it requires an explicit user choice.
 */

import { SCHEMA_VERSION } from "./fingerprint.js";
import type { InstalledVersions } from "./lockfile.js";
import type { RankedFinding } from "./triage.js";

export const BASELINE_PATH = ".zero-shelter/baseline.json";

/**
 * An accepted finding. Aliases support rematching within ecosystem/package
 * when the merged fingerprint changes.
 */
export interface AcceptedFinding {
  readonly fingerprint: string;
  readonly ecosystem: string;
  readonly package: string;
  readonly advisory: string;
  /** Every id naming this advisory. What a rematch is decided on. */
  readonly aliases: readonly string[];
  readonly severity: string;
  /**
   * Installed versions at acceptance time, sorted. Context only: matching uses
   * fingerprints and shared aliases. Absent without a readable lockfile.
   */
  readonly versions?: readonly string[];
  /** Never read from a clock while judging — supplied by the caller. */
  readonly recordedAt?: string;
  readonly reason?: string;
  readonly acceptedBy?: string;
  /** Date after which this returns to the report. */
  readonly expires?: string;
}

export interface Baseline {
  readonly schemaVersion: string;
  /** Sorted by fingerprint. Readable on purpose — reviewers should be able to diff it. */
  readonly accepted: readonly AcceptedFinding[];
  /**
   * Which scanners produced a report when this was recorded.
   *
   * Without it, a finding that disappears because a scanner stopped running is
   * indistinguishable from one that disappeared because someone fixed it.
   * Optional: baselines written before this existed simply do not know, and are
   * treated as such rather than assumed complete.
   */
  readonly sources?: readonly string[];
}

export interface AppliedBaseline {
  readonly fresh: RankedFinding[];
  readonly suppressed: RankedFinding[];
  /**
   * Accepted findings that nothing reported this time.
   *
   * Deliberately not called "fixed" on its own: a finding also disappears when
   * the scanner that found it did not run. `missingSources` says whether that
   * doubt applies to this particular run.
   */
  readonly noLongerReported: string[];
  /**
   * Scanners that contributed when the baseline was recorded and did not this
   * time — the reason `noLongerReported` might not mean what it looks like.
   * Empty when every recorded source ran again, or when the baseline predates
   * source recording and there is nothing to compare.
   */
  readonly missingSources: string[];
  /**
   * Accepted findings matched through shared aliases after their fingerprint
   * changed, for example when another scanner contributed identifiers.
   */
  readonly rematched: RankedFinding[];
  /** Acceptances whose `expires` has passed. Back in `fresh`, and named. */
  readonly expired: RankedFinding[];
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

const asStrings = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((v) => typeof v === "string") ? [...value] : undefined;

const optional = (record: Record<string, unknown>, key: string): { [k: string]: string } =>
  typeof record[key] === "string" ? { [key]: record[key] } : {};

/**
 * Malformed installed-version metadata is omitted because it is context,
 * not part of the acceptance match or expiry decision.
 */
function versionsOf(value: unknown): { versions?: readonly string[] } {
  if (!Array.isArray(value)) return {};
  const versions = value.filter((entry): entry is string => typeof entry === "string");
  return versions.length === 0 ? {} : { versions: [...new Set(versions)].sort() };
}

/**
 * Use the supplied file path in errors, including for custom baseline paths.
 */
/** A note about the file that is worth saying and is not a reason to stop. */
export type BaselineNote = (note: string) => void;

/**
 * Known acceptance keys. Keep this list aligned with AcceptedFinding so
 * unknown-key warnings identify ignored input.
 */
const KNOWN_KEYS: ReadonlySet<string> = new Set([
  "fingerprint",
  "ecosystem",
  "package",
  "advisory",
  "aliases",
  "severity",
  "versions",
  "recordedAt",
  "reason",
  "acceptedBy",
  "expires",
]);

export function parseBaseline(
  raw: string,
  at: string = BASELINE_PATH,
  onNote?: BaselineNote,
): Baseline {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${at} is not a JSON object`);
  }

  const record = parsed as Record<string, unknown>;
  const schemaVersion = record["schemaVersion"];
  const accepted = record["accepted"];
  const sources = record["sources"];

  if (typeof schemaVersion !== "string") {
    throw new Error(`${at} has no schemaVersion`);
  }
  if (!Array.isArray(accepted)) {
    throw new Error(`${at} accepted must be an array`);
  }
  if (sources !== undefined && asStrings(sources) === undefined) {
    throw new Error(`${at} sources must be an array of strings`);
  }

  return {
    schemaVersion,
    accepted: parseAccepted(accepted, at, onNote),
    ...(sources === undefined ? {} : { sources: asStrings(sources)!.sort() }),
  };
}

/**
 * Reads both shapes.
 *
 * The older file is a list of fingerprints and nothing else. It was written by
 * the same fingerprint recipe, so those still match exactly — what it cannot do
 * is survive a change of scanners, because there are no aliases to fall back
 * on. It keeps working at the level it always did rather than being rejected.
 */
function parseAccepted(
  entries: readonly unknown[],
  at: string,
  onNote?: BaselineNote,
): AcceptedFinding[] {
  const parsed = entries.map((entry): AcceptedFinding => {
    if (typeof entry === "string") {
      return { fingerprint: entry, ecosystem: "", package: "", advisory: "", aliases: [], severity: "" };
    }
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`${at} accepted must hold fingerprints or accepted findings`);
    }

    const record = entry as Record<string, unknown>;
    const fingerprint = record["fingerprint"];
    if (typeof fingerprint !== "string") {
      throw new Error(`${at} has an accepted entry with no fingerprint`);
    }

    // Warn on unknown keys without rejecting forward-compatible baseline files.
    // See #192.
    for (const key of Object.keys(record)) {
      if (KNOWN_KEYS.has(key)) continue;
      onNote?.(
        `${at}: ${fingerprint} carries "${key}", which nothing reads. ` +
          `Keys this tool acts on: ${[...KNOWN_KEYS].join(", ")}.`,
      );
    }

    return {
      fingerprint,
      ecosystem: typeof record["ecosystem"] === "string" ? record["ecosystem"] : "",
      package: typeof record["package"] === "string" ? record["package"] : "",
      advisory: typeof record["advisory"] === "string" ? record["advisory"] : "",
      aliases: aliasesOf(record["aliases"], fingerprint, at),
      severity: typeof record["severity"] === "string" ? record["severity"] : "",
      ...versionsOf(record["versions"]),
      ...optional(record, "recordedAt"),
      ...optional(record, "reason"),
      ...optional(record, "acceptedBy"),
      ...expiry(record["expires"], fingerprint, at),
    };
  });

  return parsed.sort((a, b) => (a.fingerprint < b.fingerprint ? -1 : 1));
}

/**
 * Absent aliases are valid for a legacy record. Reject a malformed alias
 * list because silently dropping it would disable rematching.
 */
function aliasesOf(value: unknown, fingerprint: string, at: string): string[] {
  if (value === undefined) return [];
  const aliases = asStrings(value);
  if (aliases === undefined) {
    throw new Error(
      `${at}: ${fingerprint} has aliases that are not an array of strings. ` +
        "They are what matches an acceptance after the scanner set changes.",
    );
  }
  return aliases.sort();
}

/**
 * Reject malformed expiry dates: ignoring one could accept a finding
 * indefinitely despite the recorded deadline.
 */
function expiry(value: unknown, fingerprint: string, at: string): { expires?: string } {
  if (typeof value !== "string") return {};
  if (!isRealDate(value)) {
    throw new Error(
      `${at}: ${fingerprint} has expires "${value}", which is not a real YYYY-MM-DD date. ` +
        "An expiry that cannot be compared would silently never expire.",
    );
  }
  return { expires: value };
}

/**
 * A date that exists, not merely one shaped like a date.
 *
 * `ISO_DATE` alone accepts `9999-99-99`, which is exactly the mistyped date
 * that sorts high — it passes the shape check, sorts above every real date,
 * and so never expires. `2026-02-31` is the quieter version: `Date` accepts
 * it and rolls it forward to March, so a loose parse would silently move the
 * deadline three days.
 *
 * The round trip is what catches both. A date that survives parsing and
 * re-serialising unchanged is one the calendar has.
 */
function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/**
 * One accepted finding per line, sorted to keep diffs readable.
 */
export function serializeBaseline(baseline: Baseline): string {
  const accepted = [...baseline.accepted]
    .sort((a, b) => (a.fingerprint < b.fingerprint ? -1 : 1))
    .map((entry) => `    ${JSON.stringify(ordered(entry))}`)
    .join(",\n");

  const head = `  "schemaVersion": ${JSON.stringify(baseline.schemaVersion)}`;
  const tail =
    baseline.sources === undefined
      ? ""
      : `,\n  "sources": ${JSON.stringify([...baseline.sources].sort())}`;

  return `{\n${head},\n  "accepted": [\n${accepted}\n  ]${tail}\n}\n`;
}

/** Fixed key order so a re-record produces a byte-identical file. */
function versionsAt(
  packageName: string,
  installed: InstalledVersions | undefined,
  before: AcceptedFinding | undefined,
): { versions?: readonly string[] } {
  const present = installed?.versions.get(packageName);
  if (present !== undefined && present.size > 0) return { versions: [...present].sort() };
  return before?.versions === undefined ? {} : { versions: before.versions };
}

function ordered(entry: AcceptedFinding): Record<string, unknown> {
  const out: Record<string, unknown> = {
    fingerprint: entry.fingerprint,
    ecosystem: entry.ecosystem,
    package: entry.package,
    advisory: entry.advisory,
    aliases: [...entry.aliases].sort(),
    severity: entry.severity,
  };
  if (entry.versions !== undefined) out["versions"] = [...entry.versions];
  for (const key of ["recordedAt", "reason", "acceptedBy", "expires"] as const) {
    if (entry[key] !== undefined) out[key] = entry[key];
  }
  return out;
}

/**
 * Preserve reason, acceptedBy, expires and recordedAt from previous
 * acceptances when rebuilding the baseline. See the metadata preservation tests.
 */
export function baselineFrom(
  findings: readonly RankedFinding[],
  sources?: readonly string[],
  recordedAt?: string,
  previous?: Baseline,
  installed?: InstalledVersions,
): Baseline {
  const kept = new Map((previous?.accepted ?? []).map((entry) => [entry.fingerprint, entry]));

  const byFingerprint = new Map<string, AcceptedFinding>();
  for (const { finding } of findings) {
    if (byFingerprint.has(finding.fingerprint)) continue;
    const before = kept.get(finding.fingerprint);
    byFingerprint.set(finding.fingerprint, {
      fingerprint: finding.fingerprint,
      ecosystem: finding.ecosystem,
      package: finding.packageName,
      advisory: finding.advisoryId,
      aliases: [...finding.aliases].sort(),
      severity: finding.severity,
      // What this run can see wins; otherwise keep what an earlier one saw.
      // A run without a lockfile must not erase a version already recorded.
      ...versionsAt(finding.packageName, installed, before),
      ...(before?.recordedAt === undefined
        ? recordedAt === undefined
          ? {}
          : { recordedAt }
        : { recordedAt: before.recordedAt }),
      ...(before?.reason === undefined ? {} : { reason: before.reason }),
      ...(before?.acceptedBy === undefined ? {} : { acceptedBy: before.acceptedBy }),
      ...(before?.expires === undefined ? {} : { expires: before.expires }),
    });
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    accepted: [...byFingerprint.values()].sort((a, b) => (a.fingerprint < b.fingerprint ? -1 : 1)),
    ...(sources === undefined ? {} : { sources: [...new Set(sources)].sort() }),
  };
}

/**
 * Split findings into new and already-accepted.
 *
 * A schema version mismatch means every fingerprint was computed by a different
 * recipe, so the recorded ones cannot match anything. Rather than suppress
 * nothing and let the reader assume the ratchet worked, we report the whole set
 * as new **and say why**.
 *
 * `today` is passed in rather than read here. Judging must not depend on when
 * it ran, or the same input stops producing the same output.
 */
export function applyBaseline(
  findings: readonly RankedFinding[],
  baseline: Baseline,
  sources?: readonly string[],
  today?: string,
): AppliedBaseline {
  if (baseline.schemaVersion !== SCHEMA_VERSION) {
    return {
      fresh: [...findings],
      suppressed: [],
      // Every fingerprint was computed by a different recipe, so "missing"
      // here would mean "renamed", not "gone".
      noLongerReported: [],
      missingSources: [],
      rematched: [],
      expired: [],
      warning:
        `${BASELINE_PATH} was written for schema ${baseline.schemaVersion}, ` +
        `but fingerprints are now schema ${SCHEMA_VERSION}. Every finding is ` +
        `reported as new until you re-record it with --update-baseline.`,
    };
  }

  const byFingerprint = new Map(baseline.accepted.map((entry) => [entry.fingerprint, entry]));
  const byAlias = aliasIndex(baseline.accepted);

  const fresh: RankedFinding[] = [];
  const suppressed: RankedFinding[] = [];
  const rematched: RankedFinding[] = [];
  const expired: RankedFinding[] = [];
  const matched = new Set<string>();

  for (const entry of findings) {
    const exact = byFingerprint.get(entry.finding.fingerprint);
    const covering = coveringAcceptances(entry, exact, byAlias);

    if (covering.length === 0) {
      fresh.push(entry);
      continue;
    }

    // Every acceptance this finding answers for, not only the one that matched.
    for (const accepted of covering) matched.add(accepted.fingerprint);

    if (covering.every((accepted) => hasExpired(accepted, today))) {
      fresh.push(entry);
      expired.push(entry);
      continue;
    }

    suppressed.push(entry);
    if (exact === undefined) rematched.push(entry);
  }

  // Deduplicated: a file with the same fingerprint twice counted it twice, and
  // that number is a frozen JSON key as well as a line on screen.
  const noLongerReported = [
    ...new Set(
      baseline.accepted
        .filter((entry) => !matched.has(entry.fingerprint))
        .map((entry) => entry.fingerprint),
    ),
  ].sort();

  // Compare previously recorded sources with this run, even when alias
  // rematching keeps all accepted findings present.
  const ran = new Set(sources ?? []);
  const missingSources =
    baseline.sources === undefined || sources === undefined
      ? []
      : baseline.sources.filter((tool) => !ran.has(tool));

  return { fresh, suppressed, noLongerReported, missingSources, rematched, expired };
}

/**
 * Accepted findings reachable by alias, keyed by `ecosystem/package/alias`.
 *
 * Scoping to the package is what keeps this from collapsing distinct advisories
 * into one another: two different vulnerabilities in the same package share no
 * alias, so a hit means the sources agreed on an identifier.
 */
function aliasIndex(accepted: readonly AcceptedFinding[]): Map<string, AcceptedFinding[]> {
  const index = new Map<string, AcceptedFinding[]>();
  for (const entry of accepted) {
    for (const alias of entry.aliases) {
      // Keep every acceptance sharing an alias so all can match a merged finding.
      const at = key(entry.ecosystem, entry.package, alias);
      const found = index.get(at);
      if (found === undefined) index.set(at, [entry]);
      else found.push(entry);
    }
  }
  return index;
}

/**
 * All baseline entries represented by a finding. A merge can combine multiple
 * accepted records; each must match so none is incorrectly marked absent.
 */
function coveringAcceptances(
  entry: RankedFinding,
  exact: AcceptedFinding | undefined,
  byAlias: Map<string, AcceptedFinding[]>,
): AcceptedFinding[] {
  const { ecosystem, packageName, aliases } = entry.finding;
  const found = new Map<string, AcceptedFinding>();

  if (exact !== undefined) found.set(exact.fingerprint, exact);
  for (const alias of aliases) {
    for (const hit of byAlias.get(key(ecosystem, packageName, alias)) ?? []) {
      found.set(hit.fingerprint, hit);
    }
  }

  return [...found.values()];
}

/** NUL separates, because it cannot occur in a package name or an advisory id. */
function key(ecosystem: string, packageName: string, alias: string): string {
  return `${ecosystem}\0${packageName}\0${alias}`;
}

/**
 * ISO dates compare lexicographically. Without a caller-supplied date, no
 * acceptance expires.
 */
function hasExpired(entry: AcceptedFinding, today?: string): boolean {
  if (entry.expires === undefined || today === undefined) return false;
  // Use the same ISO-date validation as parseBaseline before comparing dates.
  return isRealDate(entry.expires) && entry.expires < today;
}

/** Date only. A time would make the comparison depend on a zone we do not have. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
