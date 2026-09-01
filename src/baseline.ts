/**
 * The ratchet.
 *
 * A repository with history lights up on the first run. Demanding all of it be
 * fixed is the same as being ignored, so the first run records what is already
 * there and afterwards only new findings are surfaced.
 *
 * The record is a list of accepted findings rather than a list of hashes, for
 * two reasons that arrived from opposite directions. A fingerprint is derived
 * after merge, so it changes when the set of scanners changes — and the README
 * tells people to add a second scanner, which used to hand them a red build and
 * a green tick claiming their findings were resolved. And a file of hex strings
 * cannot be reviewed by the person who has to defend the acceptances later.
 * Both wanted the same field, so both were done at once.
 */

import { SCHEMA_VERSION } from "./fingerprint.js";
import type { RankedFinding } from "./triage.js";

export const BASELINE_PATH = ".zero-shelter/baseline.json";

/**
 * One accepted finding, as it is written down.
 *
 * `aliases` is the load-bearing field. Everything else is either the key
 * (`fingerprint`), scope for the fallback match (`ecosystem`, `package`), or
 * for the human reading the file.
 */
export interface AcceptedFinding {
  readonly fingerprint: string;
  readonly ecosystem: string;
  readonly package: string;
  readonly advisory: string;
  /** Every id naming this advisory. What a rematch is decided on. */
  readonly aliases: readonly string[];
  readonly severity: string;
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
   * Accepted findings recognised under a fingerprint other than the recorded
   * one, almost always because the scanner set changed.
   *
   * Surfaced rather than done quietly. A ratchet that rescues findings by a
   * rule nobody can see is the same kind of problem as one that loses them.
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
 * `at` is the file this actually came from.
 *
 * The messages named the default location, so a project passing
 * `--baseline somewhere/else.json` was told to go and fix a file it does not
 * use. Defaulted rather than required, because most callers are the default.
 */
export function parseBaseline(raw: string, at: string = BASELINE_PATH): Baseline {
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
    accepted: parseAccepted(accepted, at),
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
function parseAccepted(entries: readonly unknown[], at: string): AcceptedFinding[] {
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

    return {
      fingerprint,
      ecosystem: typeof record["ecosystem"] === "string" ? record["ecosystem"] : "",
      package: typeof record["package"] === "string" ? record["package"] : "",
      advisory: typeof record["advisory"] === "string" ? record["advisory"] : "",
      aliases: aliasesOf(record["aliases"], fingerprint, at),
      severity: typeof record["severity"] === "string" ? record["severity"] : "",
      ...optional(record, "recordedAt"),
      ...optional(record, "reason"),
      ...optional(record, "acceptedBy"),
      ...expiry(record["expires"], fingerprint, at),
    };
  });

  return parsed.sort((a, b) => (a.fingerprint < b.fingerprint ? -1 : 1));
}

/**
 * The rematch rests entirely on these, so losing them quietly turns the rescue
 * off without saying so — while `sources`, which decides much less, throws on
 * the same mistake. Absent is fine and means a v1 record; the wrong shape is
 * not.
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
 * An expiry we cannot compare is worse than none: it decides a gate.
 *
 * Rejected rather than ignored, because the failure is silent in the dangerous
 * direction — a mistyped date that sorts high never expires, and the finding
 * stays accepted forever while the file looks like it has a deadline on it.
 */
function expiry(value: unknown, fingerprint: string, at: string): { expires?: string } {
  if (typeof value !== "string") return {};
  if (!ISO_DATE.test(value)) {
    throw new Error(
      `${at}: ${fingerprint} has expires "${value}", which is not a YYYY-MM-DD date. ` +
        "An expiry that cannot be compared would silently never expire.",
    );
  }
  return { expires: value };
}

/**
 * One accepted finding per line, sorted.
 *
 * This file is committed and reviewed. A diff that moves one line when one
 * acceptance changes is the difference between a reviewable record and a wall
 * of hex nobody reads.
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
function ordered(entry: AcceptedFinding): Record<string, unknown> {
  const out: Record<string, unknown> = {
    fingerprint: entry.fingerprint,
    ecosystem: entry.ecosystem,
    package: entry.package,
    advisory: entry.advisory,
    aliases: [...entry.aliases].sort(),
    severity: entry.severity,
  };
  for (const key of ["recordedAt", "reason", "acceptedBy", "expires"] as const) {
    if (entry[key] !== undefined) out[key] = entry[key];
  }
  return out;
}

/**
 * `previous` is what is already on disk, and dropping it is data loss.
 *
 * `reason`, `acceptedBy` and `expires` are written by a person — that is the
 * whole point of them — and the skills prescribe `--update-baseline` as the way
 * to prune a baseline after a fix lands. Rebuilding the file from findings
 * alone destroyed the audit trail on every prune, silently, using the command
 * we told people to run.
 *
 * `recordedAt` is carried too. When this acceptance was first made is a fact
 * about a decision, not about the last time someone tidied the file.
 */
export function baselineFrom(
  findings: readonly RankedFinding[],
  sources?: readonly string[],
  recordedAt?: string,
  previous?: Baseline,
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

  // Only a source that contributed then and not now casts doubt. A scanner
  // that was absent both times explains nothing, and warning about it would
  // teach people to skip the line that matters.
  const ran = new Set(sources ?? []);
  const missingSources =
    baseline.sources === undefined || sources === undefined || noLongerReported.length === 0
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
      // A list, not a value. Two acceptances in one package can share an alias
      // — that is how the sources said they were related in the first place —
      // and overwriting means the one that lost is never matched again and
      // gets announced as resolved while it is still being reported.
      const at = key(entry.ecosystem, entry.package, alias);
      const found = index.get(at);
      if (found === undefined) index.set(at, [entry]);
      else found.push(entry);
    }
  }
  return index;
}

/**
 * Every accepted record this finding stands in for.
 *
 * Usually one. It is more when a merge collapsed several: npm audit files
 * `semver` under two advisory ids it cannot tell apart, and a single
 * osv-scanner alias is enough to reveal they were always one advisory. After
 * that merge there is one finding where the baseline holds two acceptances, and
 * both are answered for. Marking only the first leaves the other looking
 * resolved, which is the green tick this change exists to stop printing.
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
 * Lexicographic comparison, which is why these are ISO dates.
 *
 * Without a date to compare against we cannot know, and an acceptance that
 * quietly stops expiring is worse than one that never expired — so no `today`
 * means nothing expires and the caller decides whether to supply one.
 */
function hasExpired(entry: AcceptedFinding, today?: string): boolean {
  if (entry.expires === undefined || today === undefined) return false;
  // Compared as text, which only works on a real ISO date. `2027-1-1` sorts
  // after `2027-01-01` and `26-12-31` sorts before everything, so a typo
  // silently becomes either "never expires" or "expired already" — and the
  // first of those quietly turns a gate green. Anything else does not expire,
  // and parseBaseline has already said so out loud.
  return ISO_DATE.test(entry.expires) && entry.expires < today;
}

/** Date only. A time would make the comparison depend on a zone we do not have. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
