/**
 * Does a dependency range accept a given version?
 *
 * Asked for one reason: `npm i pkg@7` only replaces the copies whose dependents
 * will take a 7. A package that asked for `^6.0.2` keeps its own copy, and any
 * finding on that copy survives a command we promised would clear it.
 *
 * ponytail: not a semver implementation, and not a resolver. It answers
 * containment for the range forms lockfiles actually hold — measured across the
 * bench captures, caret/tilde/exact/`*` are 97.5% of 2,678 ranges and the
 * comparator, partial and union forms below take it to 99.9%. Prereleases are
 * compared as the release they precede, which is wrong in general and right for
 * every case here. Anything unparsed answers "does not accept", so the caller
 * declines to promise rather than promising wrongly.
 */

const ANY = new Set(["", "*", "x", "X", "latest"]);

/** True when `version` falls inside `range`. Unparsed ranges answer false. */
export function accepts(range: string, version: string): boolean {
  const trimmed = range.trim();
  if (ANY.has(trimmed)) return true;
  return trimmed.split("||").some((clause) => clauseHolds(clause.trim(), version));
}

/**
 * The lowest version the range names at all.
 *
 * Used to tell "this dependent is stuck below the fix" from "this dependent
 * already wants something newer" — only the first keeps a vulnerable copy.
 */
export function lowestMentioned(range: string): string | undefined {
  const numbers = range.match(/\d+(?:\.\d+)*/g);
  if (numbers === null) return undefined;
  return numbers.reduce((lowest, candidate) => (compare(candidate, lowest) < 0 ? candidate : lowest));
}

/** -1, 0 or 1, comparing major/minor/patch only. */
export function compare(a: string, b: string): number {
  const left = numbers(a);
  const right = numbers(b);
  for (let i = 0; i < 3; i += 1) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

function clauseHolds(clause: string, version: string): boolean {
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(clause);
  if (hyphen !== null) {
    return compare(version, hyphen[1] ?? "") >= 0 && compare(version, hyphen[2] ?? "") <= 0;
  }

  const tokens = clause
    .replace(/([<>]=?|=)\s+/g, "$1")
    .split(/\s+/)
    .filter((token) => token !== "");
  if (tokens.length === 0) return true;
  return tokens.every((token) => tokenHolds(token, version));
}

function tokenHolds(token: string, version: string): boolean {
  if (ANY.has(token)) return true;

  const match = /^(>=|<=|>|<|=|\^|~)?v?(.*)$/.exec(token);
  const operator = match?.[1] ?? "";
  const target = match?.[2] ?? "";
  if (ANY.has(target)) return true;
  // A tag, a git url, or an `npm:other-package@…` alias. Not a version we can order.
  if (!/^\d/.test(target)) return false;

  switch (operator) {
    case ">=":
      return compare(version, target) >= 0;
    case ">":
      return compare(version, target) > 0;
    case "<=":
      return compare(version, target) <= 0;
    case "<":
      return compare(version, target) < 0;
    case "^":
      return within(version, target, caretCeiling(target));
    case "~":
      return within(version, target, bump(target, numbers(target).length > 1 ? 1 : 0));
    default:
      return matchesPartial(target, version);
  }
}

/** `1.2.3` is one version; `1.2` and `8.x` are every patch or minor under them. */
function matchesPartial(spec: string, version: string): boolean {
  const parts = spec.split(/[-+]/)[0]?.split(".") ?? [];
  const fixed = parts.findIndex((part) => !/^\d+$/.test(part));
  const precision = fixed === -1 ? parts.length : fixed;
  if (precision === 0) return true;
  if (precision >= 3) return compare(version, spec) === 0;
  return within(version, spec, bump(spec, precision - 1));
}

function within(version: string, floor: string, ceiling: string): boolean {
  return compare(version, floor) >= 0 && compare(version, ceiling) < 0;
}

/** `^6.0.2` allows 6.x, but `^0.2.3` only allows 0.2.x and `^0.0.3` only 0.0.3. */
function caretCeiling(target: string): string {
  const [major = 0, minor = 0] = numbers(target);
  if (major !== 0) return bump(target, 0);
  return bump(target, minor === 0 ? 2 : 1);
}

/** Increment one position and zero everything after it. */
function bump(version: string, index: number): string {
  const parts = numbers(version);
  return [0, 1, 2].map((i) => (i < index ? (parts[i] ?? 0) : i === index ? (parts[i] ?? 0) + 1 : 0)).join(".");
}

function numbers(version: string): number[] {
  return (version.split(/[-+]/)[0] ?? "").split(".").map((part) => {
    const parsed = Number.parseInt(part, 10);
    return Number.isInteger(parsed) ? parsed : 0;
  });
}
