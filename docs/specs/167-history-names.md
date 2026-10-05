# Feature specification: name findings added and removed between runs

## Issue and lifecycle metadata

- Issue: [#167](https://github.com/zero-shelter/zero-shelter/issues/167)
- Target layer: history, CLI
- Related PR: pending

## Problem

`zero-shelter history` currently stores only fingerprints, so it reports how many findings appeared or left without saying which package or advisory changed. A fingerprint cannot recover the name after the finding disappears.

## Goal

Recorded runs carry a small identity record for each outstanding finding. History text and JSON use those records to name appeared and no-longer-reported findings. Entries written before this change have no records and explicitly say names are unavailable; they are never reconstructed from the current run or described as fixed.

## Scope

### Included

- Additive `outstandingDetails` records containing fingerprint, package, advisory, and severity.
- Persist details when `judge --record` writes a run; keep legacy lines readable.
- Text and JSON names for appeared/gone changes, with an explicit unknown state for legacy rows.
- Deterministic ordering and duplicate-free details.

### Explicitly excluded

- Changing judge output, fingerprints, or what counts as appeared/gone.
- Claiming a finding was fixed.
- Trend scores, rates, or resolving old fingerprints from a new scan.

## Interface

| Direction | Contract |
|---|---|
| Input | Existing `history.jsonl` plus optional `outstandingDetails` on new lines. |
| Output | Additive `appearedFindings` and `goneFindings` in history JSON; text names beside deltas. Legacy rows use `null`/an unavailable sentence. |
| Errors/exit code | Malformed optional details make that line unreadable, following existing history parsing. |
| Compatibility | Old lines round-trip without invented names; existing counts and schema warnings remain. |

## Architecture

- Layer(s) changed: `src/history.ts`, `src/cli.ts`.
- Files expected to change: those modules, `test/history.test.ts`, `test/history-cli.test.ts`, and this spec/translation.
- Shared contracts touched: additive JSONL member and history JSON keys; fingerprint comparison remains unchanged.
- Possible conflicts: #193 next-step guidance reads history existence but not these details.

## Security and privacy

- Protected data: package/advisory names already printed by judge and stored in the local baseline.
- Data flow and trust boundary: local append-only history; no new subprocess or network.
- Logging and retention: details remain in the reader's own `history.jsonl`.
- Network/LLM/telemetry behavior: none.
- Failure mode: malformed lines are skipped and counted as today; names are withheld when absent.
- User opt-in/opt-out: details are written only when `--record` is already requested.

## QA acceptance criteria

| Scenario | Expected result | Evidence |
|---|---|---|
| Normal input | Appeared and gone findings include package/advisory names in text and JSON | history tests |
| Invalid input | Malformed detail arrays make only that line unreadable | parser test |
| Empty input | No deltas means no name section; legacy rows say unavailable only when a delta needs it | CLI tests |
| Boundary/large input | Duplicate details are deterministic; old schema warning still appears | table-driven tests |
| Existing behavior | Counts, exit codes, and judge output stay unchanged | full suite |
| Security/privacy abuse case | No new write path beyond explicit `--record` | existing I/O tests |

## Agent notes

Store enough context to name a gone finding, but do not resolve fingerprints at display time. The fingerprint set remains the source of truth for change detection; details are presentation context.

## Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Store compact context for every outstanding finding | Store only changed findings | Full context makes a later gap honest and keeps the append-only model simple; file size is bounded by the outstanding set |
| Use `null`/an explicit sentence for legacy details | Blank names or current-run lookup | Blank output looks like a bug, and current-run lookup cannot name a finding that left |
| Keep counts alongside names | Replace counts with verbose lists | History remains scannable across many runs while still answering the row a reader opens |
