# Feature specification: disclose the dependency-only boundary

## Issue and lifecycle metadata

- Issue: [#168](https://github.com/zero-shelter/zero-shelter/issues/168)
- Target layer: CLI, scope detection, report output
- Related PR: implementation for #168

## Problem

A clean dependency judgement currently looks like a clean security judgement.
That can mislead a reader about secrets, containers, workflows, or
infrastructure that zero-shelter did not inspect.

## Goal

On a clean run, say that the run read dependencies only and name the relevant
local artifacts that went unread. Provide the same facts to JSON consumers.
Never imply that an unscanned domain is clean or that a missing file is dirty.

## Scope

### Included

- Detect a root `Dockerfile`, root Terraform/Compose files, and files directly
  under `.github/workflows`.
- Always mark secrets as unread because a repository may contain them without a
  sentinel file.
- Print one quiet boundary line for clean text runs and add an additive
  `unscanned` object to JSON output.
- Add deterministic tests, a shallow detector, and synchronized documentation.

### Explicitly excluded

- Scanning secrets, containers, workflows, or infrastructure.
- Recursive repository walks, coverage percentages, scores, tool installation
  recommendations, new scanners, or exit-code changes.
- Adding the line to non-clean human output or to the agent hook context.

## Interface

| Direction | Contract |
|---|---|
| Input | Local root-level file signals and the direct entries of `.github/workflows` |
| Output | `unscanned: { secrets: true, containers: boolean, workflows: integer, infrastructure: boolean }` on CLI JSON; one corresponding text line on clean human output |
| Errors/exit code | An unreadable optional path is treated as absent; existing exit codes remain unchanged |
| Compatibility | `unscanned` is additive; existing JSON keys and human output with findings remain unchanged |

## Architecture

- Layer(s) changed: `scope.ts`, `judge.ts`, `cli.ts`, `report.ts`
- Files expected to change: detector, pure result option, text/JSON renderers,
  tests, README/spec/stability documentation
- Shared contracts touched: additive `JudgeOptions`/`JudgeResult` context and
  a new additive JSON key; no ranking, fingerprint, baseline, or exit-code rule
- Possible conflicts: `src/cli.ts`, `src/report.ts`, and `docs/STABILITY.md` are
  public boundaries and require maintainer review

## Security and privacy

- Protected or sensitive data: only artifact names and counts; no file contents
- Data flow and trust boundary: the CLI reads local directory entries and passes
  booleans/counts to pure renderers; nothing leaves the process
- Logging and retention: no new persistence or logging
- Network/LLM/telemetry behavior: none
- Failure mode: fail-open for optional scope disclosure; a detector failure
  cannot fail an otherwise valid dependency judgement
- User opt-in/opt-out: disclosure is automatic on normal CLI runs; no scanner
  is invoked by this feature

## QA acceptance criteria

| Scenario | Expected result | Evidence |
|---|---|---|
| Normal input | Existing artifacts are named in one clean-run line and JSON object | `test/unscanned-boundary.test.ts` |
| Invalid input | An unreadable optional scope path does not change the judgement exit code | detector catch paths and existing CLI tests |
| Empty input | Secrets remain marked unread even when no file-keyed artifacts exist | `test/unscanned-boundary.test.ts` |
| Boundary/large input | Only shallow root/workflow entries are inspected; no recursive walk | detector implementation and artifact-count test |
| Existing behavior | Findings still use the existing output without a boundary line | `test/unscanned-boundary.test.ts` |
| Security/privacy abuse case | No contents are read or emitted, and no network process is started | source review and local-only test setup |

## Agent notes

Use the report's `unscanned` facts as a boundary statement, not as findings.
Keep the sentence quiet and factual. Missing artifacts must not be described as
clean or dirty.

## Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Use the Issue discussion's artifact-subject wording | A fixed list or a "not the …" charge-sheet sentence | A subject-based line is quieter and does not address the reader as if they failed |
| Show it on clean runs only | Show it on every run | The Issue identifies the green tick as the misleading case; always-on context becomes furniture |
| Always include secrets; key file-backed domains to present artifacts | Treat every absent domain as unread, or omit secrets | Secrets have no sentinel file, while naming absent Docker/workflow files would recite a list rather than describe this tree |
