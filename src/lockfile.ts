/**
 * Read installed versions and parent dependency ranges from npm lockfiles.
 * A direct dependency name does not establish that an upgrade reaches every
 * vulnerable copy; parent ranges can retain older versions.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { accepts, compare, lowestMentioned } from "./version-range.js";

/** One package's declared need for another. */
export interface Requirement {
  /** The dependent, as its lockfile path — `node_modules/cacache`. */
  readonly by: string;
  readonly range: string;
}

export interface InstalledVersions {
  /** Package name to every version present in the tree. */
  readonly versions: ReadonlyMap<string, ReadonlySet<string>>;
  /** Package name to the ranges other packages require, never the project's own. */
  readonly required: ReadonlyMap<string, readonly Requirement[]>;
  /**
   * Production/development scope from the lockfile dev flag. Display context
   * only; it does not change ranking.
   */
  readonly scopes: ReadonlyMap<string, Scope>;
  /**
   * Packages marked as running an install script. This metadata is separate
   * from vulnerability findings.
   */
  readonly installScripts: ReadonlySet<string>;
}

/**
 * `mixed` is real, not a fallback. A package can be a dev dependency of the
 * root and a production dependency of something the root ships.
 */
export type Scope = "prod" | "dev" | "mixed";

const MARKER = "node_modules/";
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

export interface LockEntry {
  readonly version?: string;
  readonly dev?: boolean;
  readonly hasInstallScript?: boolean;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
}

/** `undefined` when there is no lockfile to read — callers fall back to name-level advice. */
export function readInstalledVersions(cwd: string): InstalledVersions | undefined {
  const path = join(cwd, "package-lock.json");
  if (!existsSync(path)) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // Without readable lockfile metadata, callers use name-level upgrade advice.
    return undefined;
  }

  const packages = (parsed as { packages?: Record<string, LockEntry> }).packages;
  // Reject non-object package maps, including null, without throwing.
  if (typeof packages !== "object" || packages === null || Array.isArray(packages)) {
    return undefined;
  }
  return fromPackages(packages);
}

/** The `packages` map of a v2/v3 lockfile, without the reading. */
export function fromPackages(packages: Record<string, LockEntry>): InstalledVersions {
  const versions = new Map<string, Set<string>>();
  const required = new Map<string, Requirement[]>();
  const scopes = new Map<string, Scope>();
  const installScripts = new Set<string>();

  for (const [key, entry] of Object.entries(packages)) {
    const at = key.lastIndexOf(MARKER);
    if (at !== -1 && typeof entry?.version === "string") {
      const name = key.slice(at + MARKER.length);
      if (name !== "") {
        const seen = versions.get(name);
        if (seen === undefined) versions.set(name, new Set([entry.version]));
        else seen.add(entry.version);

        // The same name can sit at several paths with different answers, so
        // this widens rather than overwrites.
        const here: Scope = entry.dev === true ? "dev" : "prod";
        const before = scopes.get(name);
        scopes.set(name, before === undefined || before === here ? here : "mixed");

        if (entry.hasInstallScript === true) installScripts.add(name);
      }
    }

    // Only installed dependencies can pin a version out of reach. The root is
    // `""` and a workspace package is `packages/app` — both are package.json
    // files in this project, editable by the person reading the report, and
    // `npm i -w app` is exactly what the workspace caveat tells them to run.
    if (!key.includes(MARKER)) continue;
    for (const field of DEPENDENCY_FIELDS) {
      for (const [name, range] of Object.entries(entry?.[field] ?? {})) {
        if (typeof range !== "string") continue;
        const list = required.get(name);
        if (list === undefined) required.set(name, [{ by: key, range }]);
        else list.push({ by: key, range });
      }
    }
  }

  return { versions, required, scopes, installScripts };
}

/**
 * Package scope, or unknown without lockfile metadata.
 */
export function scopeOf(
  packageName: string,
  installed?: InstalledVersions,
): Scope | "unknown" {
  return installed?.scopes.get(packageName) ?? "unknown";
}

/**
 * The dependents that would keep an old copy if we ran `npm i pkg@fixedIn`.
 *
 * Two ways a copy survives the command, and both read off the lockfile:
 * the tree already holds more than one version, or some other package requires
 * a range that stops below the fix. `tar` is the second kind — one copy
 * installed, four dependents on `^6`, and a fix at 7.5.22 that none of them
 * will take. A dependent asking for something *newer* than the fix is not a
 * blocker; its copy was never the vulnerable one.
 */
export function blockedBy(
  packageName: string,
  fixedIn: string | undefined,
  installed?: InstalledVersions,
): readonly Requirement[] {
  if (installed === undefined) return [];

  const present = installed.versions.get(packageName);
  if (present !== undefined && present.size > 1) {
    return [{ by: "the tree", range: [...present].join(", ") }];
  }

  if (fixedIn === undefined) return [];
  return (installed.required.get(packageName) ?? []).filter(({ range }) => {
    if (accepts(range, fixedIn)) return false;
    const lowest = lowestMentioned(range);
    return lowest === undefined || compare(lowest, fixedIn) <= 0;
  });
}

/** True when one `npm i pkg@fixedIn` reaches every copy in the tree. */
export function reachesEveryCopy(
  packageName: string,
  fixedIn: string | undefined,
  installed?: InstalledVersions,
): boolean {
  return blockedBy(packageName, fixedIn, installed).length === 0;
}
