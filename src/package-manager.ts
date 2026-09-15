/**
 * Select package-manager commands and override syntax from lockfiles.
 * pnpm uses nested overrides; Yarn uses resolutions.
 */
import { closeSync, existsSync, openSync, readSync } from "node:fs";
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
 * Read the lockfile header to distinguish Yarn Berry from Classic.
 */
function yarnGeneration(path: string): PackageManager {
  // Read only the header to bound memory use on large lockfiles.
  const buffer = Buffer.alloc(HEAD_BYTES);
  let read = 0;
  let handle;
  try {
    handle = openSync(path, "r");
    read = readSync(handle, buffer, 0, HEAD_BYTES, 0);
  } catch {
    return "yarn-classic";
  } finally {
    if (handle !== undefined) closeSync(handle);
  }
  return buffer.toString("utf8", 0, read).includes("__metadata:") ? "yarn" : "yarn-classic";
}

/** Enough for the marker, which berry writes in the first few lines. */
const HEAD_BYTES = 2048;

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
 * The name of the key, for use inside a sentence.
 *
 * pnpm nests its key under `pnpm`, which is the detail that makes a pasted npm
 * block do nothing at all rather than fail loudly. Written in dotted form here
 * because the literal nesting reads badly mid-prose — `overrideSnippet` is what
 * produces something to paste.
 */
export function overridesField(manager: PackageManager): string {
  switch (manager) {
    case "pnpm":
      return `"pnpm.overrides"`;
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
 * Only npm has the lockfile range reader needed to verify upgrade counts.
 * pnpm and Yarn omit counts because reachesEveryCopy defaults to true for them.
 */
export function canPromiseClears(manager: PackageManager): boolean {
  return manager === "npm";
}
