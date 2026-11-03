# Specification: preserve decisions when rewriting a baseline

[한국어](./247-preserve-baseline-decisions.ko.md)

## Issue and lifecycle metadata

- Issue: [#247](https://github.com/zero-shelter/zero-shelter/issues/247)
- Target layer: baseline writer and its existing CLI write path
- Related PR: linked from the Issue; lifecycle and ownership remain in GitHub metadata.

## Problem

An added scanner can change a merged fingerprint while a shared alias still
identifies the same accepted finding. The reader can honor that decision, but
the writer previously looked up only the exact fingerprint. Re-recording could
then discard the reason, decision maker, expiry, and original record date. An
expired exception could become an acceptance with no expiry.

## Goal

Preserve the original decision through an alias rematch, split, or merge.
Never choose between conflicting prior decisions silently. A conflict must be
reported before the existing baseline file is written.

## Scope

### Included

- Collect original prior records before reducing duplicate fingerprints.
- Keep exact-fingerprint candidates under the existing writer behavior,
  including when the previous schema differs.
- Add alias candidates only when the previous schema is current, ecosystem and
  package match exactly, and an alias directly overlaps the current finding.
  Do not follow chains of aliases between old records.
- Compare the optional `reason`, `acceptedBy`, `expires`, and `recordedAt`
  values strictly across every candidate. A missing value and an empty string
  are distinct. An exact match does not override a conflicting alias candidate.
- Preserve the four values when a candidate exists and all candidates agree.
  Compare missing dates before applying the existing caller-supplied
  `recordedAt` fallback. New findings retain the existing recording behavior.
- Prefer currently installed versions when the lockfile provides them.
  Otherwise retain the sorted, deduplicated union of prior candidates'
  versions. Omit `versions` when neither current nor prior metadata provides it.
  Versions remain context and do not narrow an acceptance match.

### Explicitly excluded

- Changing `applyBaseline`, parsing, ordinary judge matching, schema,
  fingerprints, ranking, scanner behavior, dependencies, or network behavior.
- Automatically resolving conflicting decisions, renewing expiry, accepting
  real project risk, or changing the date rules.
- General atomic file replacement, PR merge, or release publication.

The ordinary judge's input-order dependence for contradictory records with the
same fingerprint remains a separate issue. This writer change does not resolve
that contract or establish that a release is ready.

## Interface

| Direction | Contract |
|---|---|
| Input | Existing `baselineFrom` arguments: ranked findings, optional sources/date, prior baseline, and installed versions |
| Output | Existing baseline schema and key layout; agreed decision metadata and version context are retained |
| Errors/exit code | Conflicting decision fields throw from the writer; the existing CLI write-error path returns `2` without a success confirmation |
| Compatibility | Exact-match preservation, caller date fallback, source ordering, and new-finding behavior remain; ordinary judge behavior is unchanged |

## Architecture

- Layer changed: prior-decision selection and version fallback in `src/baseline.ts`.
- Files expected to change: that module, existing baseline write/version and
  CLI input tests, both README languages, and this spec with its translation.
- Shared contract touched: conflicting decisions become an explicit writer
  error instead of being selected or dropped during re-recording.
- Possible conflicts: future ordinary judge/parser work must be reviewed
  separately; it must not be smuggled into this writer fix.

## Security and privacy

- Protected data: locally authored reasons, decision makers, expiry dates, and
  installed version context.
- Trust boundary/data flow: existing local scanner findings and baseline enter
  the writer; the existing CLI serializes a successful result to the chosen
  local baseline path. No new destination or retained data is introduced.
- Logging: conflict errors identify the finding fingerprint and field names,
  without copying the `reason` or `acceptedBy` values. Fingerprints themselves
  can contain arbitrary input strings, so this is not a general PII-redaction
  guarantee.
- Network/LLM/telemetry: no new behavior.
- Failure mode: fail closed on a semantic conflict before `writeFile` is
  reached. The CLI may already have created the parent directory. Other disk
  errors and interrupted writes are not made atomic by this change.
- User control: `--update-baseline` remains explicit. The user reviews and
  reconciles conflicting records to the intended risk decision before retrying.

## QA acceptance criteria

The existing test files below provide the validation surface; the table states
required results, not a claim that a run has already passed.

| Scenario | Expected result | Evidence |
|---|---|---|
| Normal rematch, split, or merge | Equal prior decision metadata is preserved; an old expiry stays expired after rewriting | `test/baseline-write-path.test.ts` |
| Conflicting or duplicate records | Different values in any of the four fields reject the write regardless of record order; exact matches do not hide conflicts | Existing write-path and CLI input tests |
| Empty or legacy metadata | New findings keep existing defaults; missing dates compare as missing before fallback; absent version context remains absent | Existing write-path and version tests |
| Boundary cases | Other packages/ecosystems and indirect alias chains do not match; schema mismatch does not add alias candidates; current versions win, otherwise the historical union is sorted | Existing write-path and version tests |
| CLI file preservation | A synthetic temporary baseline is byte-identical after a conflict, exit is `2`, and no recorded-success line is emitted | `test/cli-inputs.test.ts` |
| Privacy/error behavior | Distinct synthetic reason/decision-maker values do not appear in the conflict error; fingerprint and conflicting fields are identified | Existing write-path and CLI input tests |
| Existing behavior | Required test/typecheck/build, package QA and installed CLI smoke pass without fixture, snapshot, dependency, or real-baseline changes | Repository validation and PR evidence |

## Agent notes

Do not reuse a candidate list that has already collapsed duplicate fingerprints
before checking conflicts. Include expired records: filtering them out would
erase their expiry on rewrite. Do not turn an explicit `--update-baseline`
request into permission to replace the user's risk decision. Tests may write
only synthetic temporary baselines; do not record this repository's findings
as accepted.

## Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Preserve all four agreed fields | Exact lookup only, or refresh the record date | Scanner composition must not erase or renew a prior decision |
| Refuse strict metadata conflicts | Pick an exact/newest/first record or discard expiry | Choosing a risk decision belongs to the user |
| Keep caller date fallback after comparison | Fill missing dates before comparing | Preserve legacy behavior without hiding differences between prior decisions |
| Current versions first; historical sorted union otherwise | Pick one old version set | Keep available installation context without an input-order choice |
| Limit the fix to the writer | Change ordinary judge/parser contracts at the same time | The user approved this explicit scope; other matching behavior needs a separate decision |
