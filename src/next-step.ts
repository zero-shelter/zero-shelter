/**
 * Suggest one useful setup step from small, local pieces of project metadata.
 *
 * This is deliberately separate from judgement: it never changes a score or
 * decides whether a finding is accepted. Optional metadata is best effort, so
 * an unreadable file simply removes the suggestion.
 */

import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

import type { Baseline } from "./baseline.js";
import { HISTORY_PATH } from "./history.js";

const WORKFLOW_DIR = ".github/workflows";
const JUDGE_COMMAND = "zero-shelter judge";

/** Return the first useful setup action, or nothing when metadata is complete. */
export async function suggestNextStep(
  cwd: string,
  baseline: Baseline,
  baselineExists: boolean,
): Promise<string | undefined> {
  // The normal first-run line already explains --update-baseline. Repeating it
  // as a second hint would make the first run noisier without adding guidance.
  if (!baselineExists) return undefined;

  const history = await exists(resolve(cwd, HISTORY_PATH));
  if (history === false) {
    return "run zero-shelter judge --record to start tracking changes";
  }

  const workflow = await hasJudgeWorkflow(cwd);
  if (workflow === false) {
    return "add zero-shelter judge to CI so new findings are checked on every change";
  }

  if (hasUndocumentedAcceptance(baseline)) {
    return "document accepted findings with reason, acceptedBy, and expires";
  }

  return undefined;
}

async function exists(path: string): Promise<boolean | undefined> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT" ? false : undefined;
  }
}

/**
 * Read only workflow names and their contents. A permission error is unknown,
 * rather than evidence that CI is absent, so the caller can continue quietly.
 */
async function hasJudgeWorkflow(cwd: string): Promise<boolean | undefined> {
  let entries;
  try {
    entries = await readdir(resolve(cwd, WORKFLOW_DIR), { withFileTypes: true });
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT" ? false : undefined;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile()) continue;
    try {
      if ((await readFile(resolve(cwd, WORKFLOW_DIR, entry.name), "utf8")).includes(JUDGE_COMMAND)) {
        return true;
      }
    } catch {
      // An unreadable workflow cannot prove that CI is absent.
      return undefined;
    }
  }

  return false;
}

function hasUndocumentedAcceptance(baseline: Baseline): boolean {
  return baseline.accepted.some(
    (entry) =>
      entry.reason === undefined || entry.acceptedBy === undefined || entry.expires === undefined,
  );
}
