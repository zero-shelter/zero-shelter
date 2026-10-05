# Feature specification: per-source finding attribution

## Issue and lifecycle metadata

- Issue: [#142](https://github.com/zero-shelter/zero-shelter/issues/142)
- Target layer: merge, report, HTML
- Related PR: pending

## Problem

The report lists which scanners ran but does not show which findings each source uniquely contributed or which findings were corroborated. A maintainer cannot evaluate the value of a second source from their own run.

## Goal

Partition every merged finding into source-unique or multi-source buckets. Show unique counts with severity breakdowns and the corroborated count in terminal, JSON, and HTML output. The buckets must sum to `summary.merged` and must not imply that a unique finding is false or that a source is better.

## Scope

### Included

- Pure attribution over existing `MergedFinding.tools`.
- Unique buckets per tool, a corroborated bucket, and severity counts for each.
- Additive JSON `attribution` object.
- Compact terminal context and an HTML section near scanner status.
- Findings with duplicate tool names are deduplicated; a finding with no tool is attributed to `unknown`.

### Explicitly excluded

- Ranking, weights, scores, or recommendations about scanners.
- New scanner execution, parsing, or provenance collection.
- Changing `summary.merged` or baseline behavior.

## Interface

| Direction | Contract |
|---|---|
| Input | Existing merged findings and their `tools` arrays. |
| Output | `attribution.total`, `corroborated`, `corroboratedSeverity`, and sorted `unique` buckets with severity counts. |
| Errors/exit code | None beyond existing judge behavior; attribution is derived in memory. |
| Compatibility | Additive JSON only; existing text and HTML gain context when findings exist. |

## Architecture

- Layer(s) changed: new `src/attribution.ts`, `src/judge.ts`, `src/report.ts`, `src/html.ts`, `src/messages.ts`.
- Files expected to change: those modules, `test/attribution.test.ts`, and this spec/translation.
- Shared contracts touched: additive `JudgeResult.attribution` and JSON key; scores and fingerprints unchanged.
- Possible conflicts: future changes to source provenance must continue to populate `MergedFinding.tools`.

## Security and privacy

- Protected data: scanner names and severity counts already present in the run.
- Data flow and trust boundary: pure in-memory regrouping; no new reads or subprocesses.
- Logging and retention: output only; no files written.
- Network/LLM/telemetry behavior: none.
- Failure mode: deterministic output; no new failure path.
- User opt-in/opt-out: attribution appears with normal reports; it does not alter verdicts.

## QA acceptance criteria

| Scenario | Expected result | Evidence |
|---|---|---|
| Normal input | Unique and corroborated counts sum to merged findings | `test/attribution.test.ts` |
| Invalid input | Existing malformed scanner behavior is unchanged | existing ingest tests |
| Empty input | No attribution section and zero total | existing empty-report tests |
| Boundary/large input | Duplicate tool names do not inflate counts; three sources remain deterministic | unit tests |
| Existing behavior | Ranking, baseline, SARIF, and hook outputs remain valid | full suite and QA |
| Security/privacy abuse case | No filesystem/network behavior is introduced | `test/promises.test.ts` |

## Agent notes

Attribution is a fact about this run, not a confidence score. Agreement between current sources is not independent evidence; keep the wording neutral.

## Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Compute before baseline application | Count only outstanding findings | The Issue requires the buckets to sum to `summary.merged`, including accepted entries |
| Treat zero tools as `unknown` | Drop the finding from attribution | Dropping would make totals fail to reconcile; missing provenance must stay visible |
| Use “multiple sources” wording | “more than one source” | Avoids colliding with the existing single-source status phrase used by agent QA |
