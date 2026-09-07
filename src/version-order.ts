/**
 * Ordering published version strings.
 *
 * Shared because two places need the same answer and a second implementation
 * is a second chance to get it backwards: string order puts 4.17.21 above
 * 4.18.1, which points people at an older release than the one they need.
 *
 * ponytail: still not a semver implementation, and the line has moved once.
 * It orders release numbers and prerelease identifiers — the two things that
 * decide which published fix is highest — and knows nothing about ranges.
 * Reach for a real semver parser if ranges ever need solving here;
 * `src/version-range.ts` is where that question already lives.
 *
 * The prerelease rules are semver.org §11 rather than ours. Inventing an
 * ordering for `rc.2` against `rc.1` would be a second opinion about strings
 * the ecosystem already agrees on.
 */

export function isHigher(candidate: string, current: string): boolean {
  const a = release(candidate);
  const b = release(current);

  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left > right;
  }

  // Same release numbers. 2.0.0 outranks 2.0.0-rc.1, and rc.2 outranks rc.1 —
  // the second of those used to be unreachable, so `highest` kept whichever
  // prerelease it happened to see first.
  return comparePrerelease(prereleaseOf(candidate), prereleaseOf(current)) > 0;
}

/** The highest of the given versions, or undefined when there are none. */
export function highest(versions: Iterable<string>): string | undefined {
  let best: string | undefined;
  for (const version of versions) {
    if (best === undefined || isHigher(version, best)) best = version;
  }
  return best;
}

/**
 * Build metadata carries no precedence — semver.org §10 — and a leading `v` is
 * a spelling rather than a number. `parseInt("v2")` is NaN, which used to be
 * filtered out and left `v2.0.0` comparing as `[0, 0]`: below everything.
 *
 * The lookahead matters. Stripping a bare `v` would turn a string like
 * `version-1` into `ersion-1`.
 */
function core(version: string): string {
  const withoutBuild = version.split("+")[0] ?? "";
  return withoutBuild.replace(/^v(?=\d)/, "");
}

function release(version: string): number[] {
  const text = core(version);
  const at = text.indexOf("-");
  return (at === -1 ? text : text.slice(0, at))
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isInteger(part));
}

/** The identifiers after the first `-`, or undefined for a plain release. */
function prereleaseOf(version: string): string | undefined {
  const text = core(version);
  const at = text.indexOf("-");
  return at === -1 ? undefined : text.slice(at + 1);
}

const NUMERIC = /^\d+$/;

/**
 * semver.org §11, for the part that decides which fix is highest.
 *
 * Negative when `a` ranks below `b`, positive when above, zero when neither.
 */
function comparePrerelease(a: string | undefined, b: string | undefined): number {
  if (a === undefined && b === undefined) return 0;
  // "A pre-release version has lower precedence than a normal version."
  if (a === undefined) return 1;
  if (b === undefined) return -1;

  const left = a.split(".");
  const right = b.split(".");

  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = left[i];
    const r = right[i];
    // "A larger set of pre-release fields has a higher precedence than a
    // smaller set, if all of the preceding identifiers are equal."
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    if (l === r) continue;

    const lNumeric = NUMERIC.test(l);
    const rNumeric = NUMERIC.test(r);
    if (lNumeric && rNumeric) {
      // BigInt rather than Number. semver puts no ceiling on a numeric
      // identifier and a double does: 9007199254740992 and ...93 collapse to
      // the same value, the comparison falls through to "higher", and the
      // answer then depends on the order the versions arrived in.
      const left = BigInt(l);
      const right = BigInt(r);
      if (left === right) continue;
      return left < right ? -1 : 1;
    }
    // "Numeric identifiers always have lower precedence than non-numeric."
    if (lNumeric !== rNumeric) return lNumeric ? -1 : 1;
    return l < r ? -1 : 1;
  }

  return 0;
}
