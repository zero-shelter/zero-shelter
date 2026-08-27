/**
 * Which package manager this project uses, and how it spells a remedy.
 *
 * Every prescription used to be npm syntax. pnpm ignores a top-level
 * `overrides` key outright and yarn wants `resolutions`, so a pnpm user pasted
 * our advice, re-ran, saw the finding still there, and concluded the tool had
 * lied to them. It is not a rare path: measured across eight repositories, six
 * had no direct commands at all, which makes the transitive block the only
 * advice those projects ever get.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "npm" | "pnpm" | "yarn" | "yarn-classic";

const LOCKFILES: readonly (readonly [string, PackageManager])[] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
];

/**
 * Read off the lockfile that is present, not from a question we ask the user.
 *
 * npm is the fallback rather than an answer: a project with no lockfile at all
 * cannot be judged anyway, and if one appears later this is re-read.
 */
export function detectPackageManager(cwd: string): PackageManager {
  for (const [file, manager] of LOCKFILES) {
    const path = join(cwd, file);
    if (!existsSync(path)) continue;
    return manager === "yarn" ? yarnGeneration(path) : manager;
  }
  return "npm";
}

/**
 * berry and classic disagree about the key, so guessing costs a user their fix.
 *
 * Read the head of the file rather than all of it. Lockfiles get very large and
 * the marker is in the first few lines by construction.
 */
function yarnGeneration(path: string): PackageManager {
  let head: string;
  try {
    head = readFileSync(path, "utf8").slice(0, 2048);
  } catch {
    return "yarn-classic";
  }
  return head.includes("__metadata:") ? "yarn" : "yarn-classic";
}

/** What to run to move one package to one version. */
export function installCommand(
  manager: PackageManager,
  packageName: string,
  version: string,
): string {
  const spec = `${packageName}@${version}`;
  switch (manager) {
    case "pnpm":
      return `pnpm add ${spec}`;
    case "yarn":
    case "yarn-classic":
      return `yarn add ${spec}`;
    default:
      return `npm i ${spec}`;
  }
}

/**
 * Where a forced version goes in package.json.
 *
 * pnpm nests its key under `pnpm`, which is the detail that makes a pasted npm
 * block do nothing at all rather than fail loudly.
 */
export function overridesField(manager: PackageManager): string {
  switch (manager) {
    case "pnpm":
      return `"pnpm": { "overrides": …`;
    case "yarn":
    case "yarn-classic":
      return `"resolutions"`;
    default:
      return `"overrides"`;
  }
}

/** One forced version, written the way this project's manager reads it. */
export function overrideSnippet(
  manager: PackageManager,
  packageName: string,
  version: string,
): string {
  const pair = `{ ${JSON.stringify(packageName)}: ${JSON.stringify(version)} }`;
  switch (manager) {
    case "pnpm":
      return `"pnpm": { "overrides": ${pair} }`;
    case "yarn":
    case "yarn-classic":
      return `"resolutions": ${pair}`;
    default:
      return `"overrides": ${pair}`;
  }
}

/** A whole block of them, for the html report and the agent prompts. */
export function overrideBlock(
  manager: PackageManager,
  entries: readonly (readonly [string, string])[],
): string {
  const body = entries
    .map(([name, version]) => `    ${JSON.stringify(name)}: ${JSON.stringify(version)}`)
    .join(",\n");

  switch (manager) {
    case "pnpm":
      return `"pnpm": {\n  "overrides": {\n${body}\n  }\n}`;
    case "yarn":
    case "yarn-classic":
      return `"resolutions": {\n${body}\n}`;
    default:
      return `"overrides": {\n${body}\n}`;
  }
}

/**
 * Whether `clears N` can be honest here.
 *
 * The promise rests on reading dependents' required ranges out of
 * `package-lock.json`. We have no reader for `pnpm-lock.yaml` or `yarn.lock`,
 * so on those projects `reachesEveryCopy` answers yes by default and the
 * guarantee shipped in 0.0.7 is quietly switched off. Saying the number anyway
 * would trade one silent lie for another.
 */
export function canPromiseClears(manager: PackageManager): boolean {
  return manager === "npm";
}
