/**
 * The shape every ingester produces and everything downstream consumes.
 *
 * It is deliberately small. Scanner output carries a lot that only matters to
 * the scanner that produced it, and anything we keep here has to survive being
 * merged with a finding from a different tool that described the same problem
 * in different words.
 */

/**
 * What kind of thing was found. Fingerprint recipes differ per class, so this
 * is not cosmetic — a single recipe across classes is wrong for all of them.
 */
export type FindingClass = "SCA";

/** How badly we want the reader to care, before our own ranking runs. */
export type Severity = "critical" | "high" | "moderate" | "low" | "info";

/** Where a finding came from, kept so `--explain` can name its sources. */
export interface Source {
  /** Tool name as the tool calls itself, e.g. `npm-audit`. */
  readonly tool: string;
  /** Tool version, when it can be determined. Reproducibility depends on it. */
  readonly toolVersion?: string;
  /** The tool's own identifier for this finding, for tracing back. */
  readonly ruleId: string;
}

/** A dependency vulnerability. */
export interface ScaFinding {
  readonly kind: "SCA";
  /**
   * Identity **as this source reported it**.
   *
   * Two scanners describing the same vulnerability will usually produce
   * different values here, because they file it under different advisory ids —
   * npm audit knows a GHSA, osv-scanner knows the CVE as well. Reconciling
   * that is the merge step's job, and it recomputes this afterwards.
   */
  readonly fingerprint: string;
  readonly severity: Severity;
  readonly title: string;

  readonly ecosystem: string;
  readonly packageName: string;
  /** Version range the advisory applies to, verbatim from the source. */
  readonly vulnerableRange: string;
  /**
   * Whether any fix exists at all.
   *
   * Distinct from {@link fixedIn} on purpose. npm audit answers this with a
   * bare `true` far more often than it names a version — it means "an upgrade
   * path exists", sometimes only by bumping a parent package. Collapsing the
   * two would rank every one of those as unfixable.
   */
  readonly fixAvailable: boolean;
  /** First version that is not affected, when the source states one. */
  readonly fixedIn?: string;

  /**
   * The advisory id this finding is filed under.
   * Chosen by {@link pickAdvisoryId}, not by the scanner.
   */
  readonly advisoryId: string;
  /**
   * Every id that names this same advisory, including {@link advisoryId}.
   * Sorted, deduplicated.
   *
   * Merging depends entirely on this: two scanners reporting the same
   * vulnerability usually agree on nothing except one shared alias.
   */
  readonly aliases: readonly string[];

  /** True when nothing in the project depends on this package directly. */
  readonly transitive: boolean;

  /**
   * When the advisory was published, verbatim from the source.
   *
   * Severity is assigned when an advisory is written and never moves again, so
   * it is the only urgency signal we carry and it says nothing about whether
   * anyone has had a year to act. This is a fact from the source rather than a
   * number of ours, which is the only form that survives the standard
   * PRODUCT.md sets for anything that ranks.
   */
  readonly published?: string;
  /**
   * The CVSS vector as the source wrote it. Carried, never computed.
   *
   * Turning a vector into a score is float arithmetic, and scoring here is
   * integer-only so the same input ranks the same on every machine. So this is
   * shown beside the finding and stays out of the score.
   */
  readonly cvssVector?: string;

  readonly sources: readonly Source[];
}

export type Finding = ScaFinding;

const SEVERITY_ORDER: readonly Severity[] = [
  "critical",
  "high",
  "moderate",
  "low",
  "info",
];

/** Rank of a severity, lower being more severe. Useful for sorting. */
export function severityRank(severity: Severity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

/**
 * Pick the id a finding is filed under.
 *
 * The rule matters more than which prefix wins: two scanners must land on the
 * same choice from the same alias set, or identical vulnerabilities end up
 * under different ids and never merge.
 *
 * CVE first because it is the identifier both npm audit and osv-scanner are
 * most likely to carry, then GHSA, then OSV, then anything else. Within a
 * prefix, the lexicographically smallest id wins so the choice is total.
 */
export function pickAdvisoryId(aliases: readonly string[]): string {
  if (aliases.length === 0) {
    throw new Error("pickAdvisoryId requires at least one alias");
  }

  const ranked = [...aliases].sort((a, b) => {
    const byPrefix = aliasPrefixRank(a) - aliasPrefixRank(b);
    return byPrefix !== 0 ? byPrefix : compare(a, b);
  });

  // ponytail: sort-and-take-first beats a manual min loop; the list is tiny.
  return ranked[0]!;
}

function aliasPrefixRank(alias: string): number {
  if (alias.startsWith("CVE-")) return 0;
  if (alias.startsWith("GHSA-")) return 1;
  if (alias.startsWith("OSV-")) return 2;
  return 3;
}

/**
 * Canonicalize an alias set: upper-case, deduplicated, sorted.
 *
 * Case matters more than it looks. npm audit's advisory URLs spell GHSA ids in
 * lower case while osv-scanner emits them upper case, and the merge step joins
 * on exact string equality — so without a single normalization point the two
 * tools report the same advisory and never recognise each other.
 *
 * Every advisory namespace we handle (CVE, GHSA, OSV, PYSEC, RUSTSEC, GO) is
 * upper-case by convention, so folding case cannot collide two distinct ids.
 */
export function normalizeAliases(aliases: Iterable<string>): string[] {
  return [...new Set([...aliases].map((alias) => alias.trim().toUpperCase()))]
    .filter((alias) => alias.length > 0)
    .sort(compare);
}

/**
 * Compare by code unit rather than locale. `Array.prototype.sort` without a
 * comparator already does this, but `localeCompare` does not, and a
 * locale-dependent order would make fingerprints depend on the host.
 */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
