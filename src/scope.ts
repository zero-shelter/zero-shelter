/**
 * The local parts of a project that a dependency-only judgement does not read.
 *
 * This is deliberately shallow. A prompt hook must not walk a repository just
 * to write one honest sentence, and the absence of a file cannot prove that a
 * domain is clean. Secrets are therefore always marked as unread; the other
 * signals are reported only when their corresponding root-level artifacts are
 * present.
 */

import { lstatSync, readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";

export interface UnscannedScope {
  /** Secret history has no sentinel file, so it is always outside this tool. */
  readonly secrets: true;
  /** Whether the optional local artifact checks completed without an access error. */
  readonly complete: boolean;
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
  let complete = true;
  let rootEntries: Dirent[] = [];
  let rootRead = false;
  let workflows = 0;
  let infrastructure = false;

  try {
    rootEntries = readdirSync(cwd, { withFileTypes: true });
    rootRead = true;
  } catch (error) {
    if (!isMissing(error)) complete = false;
  }

  if (rootRead) {
    infrastructure = rootEntries.some((entry) => {
      const name = entry.name.toLowerCase();
      return (
        entry.isFile() &&
        (name.endsWith(".tf") || name.endsWith(".tf.json") || INFRASTRUCTURE_FILES.has(name))
      );
    });
  }

  let containers = false;
  try {
    containers = lstatSync(join(cwd, "Dockerfile")).isFile();
  } catch (error) {
    if (!isMissing(error)) complete = false;
  }

  try {
    const github = lstatSync(join(cwd, ".github"));
    if (!github.isSymbolicLink() && github.isDirectory()) {
      const workflowDir = lstatSync(join(cwd, ".github", "workflows"));
      if (!workflowDir.isSymbolicLink() && workflowDir.isDirectory()) {
        workflows = readdirSync(join(cwd, ".github", "workflows"), { withFileTypes: true })
          .filter((entry) => entry.isFile() && /\.(?:yml|yaml)$/i.test(entry.name))
          .length;
      }
    }
  } catch (error) {
    if (!isMissing(error)) complete = false;
  }

  return result();

  function result(): UnscannedScope {
    return {
      secrets: true,
      complete,
      containers,
      workflows,
      infrastructure,
    };
  }
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}
