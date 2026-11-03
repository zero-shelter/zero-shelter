# Specification: reject conflicting decisions in a baseline

[한국어](./276-reject-baseline-conflicts.ko.md)

## Issue and lifecycle metadata

- Issue: [#276](https://github.com/zero-shelter/zero-shelter/issues/276)
- Target layer: baseline parsing and direct judgement
- Dependency: [#275](https://github.com/zero-shelter/zero-shelter/pull/275), the separately approved [writer fix](./247-preserve-baseline-decisions.md)
- Related PR and lifecycle status are linked from the Issue and managed in GitHub metadata.

## Problem

A current-schema baseline can contain two records with the same fingerprint
but conflicting decision metadata. Collapsing them before judging makes record
order choose which decision applies. For example, reversing an expired and an
active acceptance can change whether a finding is reported.

## Goal

Reject contradictory decisions before judging, regardless of record order or
whether any findings are present. Keep the separately approved writer policy
and unrelated baseline compatibility behavior intact.

## Scope

### Included

- For the current schema, group records by exact fingerprint and compare
  `reason`, `acceptedBy`, `expires`, and `recordedAt` before duplicate reduction.
- Reject a difference in any field, including an absent value versus a provided
  string or an empty string. During parsing, compare the values after the
  existing optional-field normalization; do not introduce stricter raw JSON rules.
- Apply the check both in `parseBaseline` and in direct `applyBaseline`/`judge`
  calls, so callers cannot bypass it by constructing a `Baseline` themselves.
- Check the complete baseline even when the current finding list is empty.
- Preserve duplicates whose four decision fields agree, including when package,
  alias, version, severity, or other context differs.
- Identify the fingerprint and conflicting field names without copying the
  decision values into the new conflict diagnostic.

### Explicitly excluded

- Different-fingerprint alias decisions, general context deduplication or
  canonicalization, and broader alias/context determinism guarantees.
- New schema, fingerprint, ranking, output fields, dependencies, network calls,
  or changes to the [writer policy](./247-preserve-baseline-decisions.md).
- Automatic conflict repair, risk acceptance, atomic file replacement, PR merge,
  or release publication.

## Interface

| Direction | Contract |
|---|---|
| Input | Existing raw baseline JSON or typed `Baseline` supplied to direct judgement |
| Output | Existing baseline/judgement shape for valid input; equal-metadata duplicates remain valid |
| Errors/exit code | Current-schema decision conflicts throw during parsing or direct judgement. CLI uses its existing failure exit `2`, with no report on stdout |
| Compatibility | Other-schema warnings, existing field normalization/validation, and different-fingerprint alias matching remain unchanged. Legacy record shapes remain readable subject to the current-schema conflict rule. Existing hook load/judge errors remain silent exit `0` |

There is no opt-out that silently selects one conflicting decision. The user
reviews and reconciles those records to the intended risk decision before
judging or recording again. Old-schema records retain the existing path rather
than gaining this current-schema conflict rule.

## Architecture

- Changed layer: validation in `src/baseline.ts` before records can be reduced
  by fingerprint; direct callers must pass the same validation boundary.
- Expected files: that module, focused baseline and CLI/hook tests, both README
  languages, and this spec with its translation.
- Shared contract: contradictory current-schema decisions become an input
  error instead of an order-dependent acceptance choice.
- Possible conflicts: this PR is stacked on #275 but does not revise its
  metadata preservation, conflict, date fallback, or version fallback policy.

## Security and privacy

- Protected data: user-authored reasons, decision makers, record/expiry dates,
  and local baseline contents.
- Trust boundary/data flow: existing local baseline input enters parsing or a
  direct API, is validated, then reaches the existing judgement pipeline. This
  change introduces no new I/O destination, data retention, network, LLM, or telemetry.
- Threat: contradictory duplicate records could otherwise make input order
  select an expired or active acceptance. Strict comparison rejects that choice.
- Diagnostic limits: the new conflict error names fields but omits raw decision
  values. Fingerprints and file paths are still untrusted strings, and existing
  diagnostics retain their behavior; this is not general redaction.
- Failure mode: ordinary judgement fails closed. CLI returns `2` through its
  existing error handling before report/history/baseline output is written.
  Earlier scanner reads or subprocesses are not claimed to be prevented.
- Hook compatibility: its existing error handling remains non-blocking and
  returns `0` silently when loading or judging fails, without additional context.
- File guarantees: no new file writes or atomicity guarantees are introduced.

## QA acceptance criteria

These are required results for the implementation, not pre-recorded test outcomes.

| Scenario | Expected result | Evidence |
|---|---|---|
| Normal duplicates | Equal four-field metadata is accepted even when other context differs | Focused baseline tests |
| Conflicting input | Each field conflicts in either record order, including missing versus present; parser and direct API reject | Focused baseline tests |
| Empty/legacy input | Empty findings still reject conflicting current-schema records; empty baselines and consistent legacy records remain valid; other-schema behavior is unchanged | Focused baseline tests |
| Boundary/compatibility | Parsed optional normalization is unchanged; different-fingerprint aliases and equal duplicates are not rejected by the new check | Focused baseline tests |
| CLI and files | Conflicts return `2`, stdout is empty, and requested report/history/baseline files are not created or changed | `test/cli-baseline-conflicts.test.ts` |
| Hook | Loading or direct judgement failures retain silent `0` and no context | Focused CLI/hook tests |
| Adversarial diagnostics | Distinct synthetic decision values are absent from the new conflict message; fingerprint and field names identify the conflict | Focused baseline and CLI tests |
| Existing behavior | Required tests/typecheck/build, package QA and installed CLI smoke pass on the exact change | Repository validation and PR evidence |

## Agent notes

Check original records before deduplicating fingerprints. Compare all four
optional values; do not substitute dates or trim strings before this comparison.
Keep parser normalization and old-schema behavior unchanged. Do not claim this
check resolves other context differences or different-fingerprint alias choices.
Use synthetic temporary baselines only; do not accept this repository's risk.

## Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Reject strict four-field conflicts | Choose first/last/latest metadata | Input order must not choose a risk decision |
| Validate parsing and direct APIs | Parser-only rejection | Constructed baselines can reach judgement without parsing |
| Limit validation to the current schema | Reject all schema versions | Preserve existing foreign-schema warnings and behavior |
| Allow equal metadata duplicates | Reject every duplicate or compare every context field | Approval covers decision conflicts, not general context reconciliation |
| Preserve hook error handling | Make hooks block or emit new warnings | The approved reader fix does not change the hook contract |
