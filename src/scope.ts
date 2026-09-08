/**
 * The local parts of a project that a dependency-only judgement does not read.
 *
 * This is deliberately shallow. A prompt hook must not walk a repository just
 * to write one honest sentence, and the absence of a file cannot prove that a
 * domain is clean. Secrets are therefore always marked as unread; the other
 * signals are reported only when their corresponding root-level artifacts are
 * present.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface UnscannedScope {
  /** Secret history has no sentinel file, so it is always outside this tool. */
  readonly secrets: true;
  /** Whether the project has a root Dockerfile. */
  readonly containers: boolean;
  /** Number of files directly under `.github/workflows`. */
  readonly workflows: number;
  /** Whether root-level Terraform or Compose configuration is present. */
  readonly infrastructure: boolean;
}

const INFRASTRUCTURE_FILES = new Set([
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yml",
  "compose.yaml",
]);

/** Read only a few root-level signals; optional unreadable paths do not fail a run. */
export function unscannedScope(cwd: string): UnscannedScope {
  let workflows = 0;
  let infrastructure = false;

  try {
    workflows = readdirSync(join(cwd, ".github", "workflows"), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .length;
  } catch {
    // No workflow directory, or one the process cannot read. Either way there
    // is no local workflow artifact we can name safely.
  }

  try {
    infrastructure = readdirSync(cwd, { withFileTypes: true }).some(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".tf") || entry.name.endsWith(".tf.json") || INFRASTRUCTURE_FILES.has(entry.name)),
    );
  } catch {
    // Scope disclosure must never turn an otherwise valid judgement into an
    // environment failure.
  }

  return {
    secrets: true,
    containers: existsSync(join(cwd, "Dockerfile")),
    workflows,
    infrastructure,
  };
}
