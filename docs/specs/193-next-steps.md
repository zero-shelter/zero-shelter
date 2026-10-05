# Feature specification: context-sensitive next steps after a run

## Issue and lifecycle metadata

- Issue: [#193](https://github.com/zero-shelter/zero-shelter/issues/193)
- Target layer: CLI, report
- Related PR: pending

## Problem

A first run explains how to record a baseline, but later clean runs repeat the same report without telling a maintainer which useful setup step is still absent. The repository already contains enough local evidence to offer one precise next action.

## Goal

When a baseline exists, add at most one next-step line based on local state: start history recording, add the judge to CI, or document accepted entries. A project that has completed those steps keeps the existing quiet output. No files are edited and no score is introduced.

## Scope

### Included

- Detect `.zero-shelter/history.jsonl` existence, a workflow invoking `zero-shelter judge`, and acceptance metadata completeness.
- Deterministic priority: history recording, CI, then baseline metadata.
- Terminal and JSON output; SARIF and HTML remain unchanged.
- Metadata-only file reads bounded to `.github/workflows` filenames and content needed to detect the command.

### Explicitly excluded

- `init`, automatic CI/config edits, hook installation changes, scores, and notifications.
- Reading source code, git history, secrets, prompts, or scanner findings beyond the current run.

## Interface

| Direction | Contract |
|---|---|
| Input | Existing local paths plus the loaded baseline; no new CLI flags. |
| Output | At most one `nextStep` string in JSON and one terminal line. |
| Errors/exit code | Unreadable optional metadata is ignored; the judgement result remains unchanged. |
| Compatibility | No line is added on a first run or when no suggestion applies. Existing exit codes and finding rows remain unchanged. |

## Architecture

- Layer(s) changed: new `src/next-step.ts`, `src/cli.ts`, `src/judge.ts`, `src/report.ts`.
- Files expected to change: those modules, tests, README translations, and this spec/translation.
- Shared contracts touched: additive `JudgeResult.nextStep` and JSON key.
- Possible conflicts: #140/#141/#142 also extend CLI/report output; rebase before merge.

## Security and privacy

- Protected data: workflow filenames and a boolean command match; baseline metadata already local.
- Data flow and trust boundary: bounded local reads only; no subprocess or network.
- Logging and retention: output only; no files written.
- Network/LLM/telemetry behavior: none.
- Failure mode: fail open to the existing report when optional metadata cannot be read.
- User opt-in/opt-out: guidance is automatic when evidence supports it; no configuration is changed.

## QA acceptance criteria

| Scenario | Expected result | Evidence |
|---|---|---|
| Normal input | Exactly one relevant suggestion appears | unit/CLI tests |
| Invalid input | Missing/unreadable metadata does not fail judgement | I/O tests |
| Empty input | First run keeps its existing baseline guidance without a duplicate next step | regression test |
| Boundary/large input | Multiple workflows and mixed acceptance metadata remain deterministic | table-driven tests |
| Existing behavior | A fully configured project has byte-stable quiet output apart from additive JSON key omission | full suite |
| Security/privacy abuse case | No source, git history, secret contents, or network module is read | I/O test |

## Agent notes

Keep the suggestion one line and factual. The wording must not imply that accepting a finding resolves it. Do not infer hook installation from arbitrary editor files in this PR.

## Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Use a fixed priority order | Print a checklist of every missing item | The Issue asks for one actionable line and quiet output |
| Suppress guidance on first run | Add another setup sentence | The existing first-run baseline message already covers that state |
| Scan workflow metadata only | Search the whole repository | The workflow path is the specific evidence and bounds privacy/file reads |
