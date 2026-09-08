# Feature specification: preserve CVSS provenance in SARIF

[한국어](./123-sarif-cvss-provenance.ko.md). This document records the design for the linked issue.

## Issue and lifecycle metadata

- Issue: #123
- Target layer: SARIF output integration
- Related PR: #226

## Problem

SARIF alerts expose a numeric `security_severity` derived from zero-shelter's
severity word while discarding the exact CVSS vector already carried from the
advisory. The code comment also incorrectly says no vector is available.

All four frozen OSV captures contain 453 vulnerability occurrences and 481
severity entries. Every severity entry contains a CVSS vector, none contains a
numeric score, and 424 vulnerability occurrences expose at least one vector.

## Goal

Preserve the advisory's exact CVSS vector in SARIF when available and describe
the numeric severity band honestly as a deterministic fallback.

## Scope

### Included

- Copy `finding.cvssVector` to SARIF result `properties.cvssVector` verbatim.
- Omit the property when the source supplied no vector.
- Keep the existing numeric severity-band mapping as a fallback.
- Document the compatibility behavior in both README languages.

### Explicitly excluded

- Computing a numeric CVSS score from a vector.
- Changing ranking, SARIF levels, fingerprints, or alert identity.
- Changing scanner ingestion or the finding contract.

## Interface

| Direction | Contract |
|---|---|
| Input | Optional `RankedFinding.finding.cvssVector` already normalized by ingestion |
| Output | Exact string at SARIF result `properties.cvssVector` when present |
| Errors/exit code | No new errors or exit-code changes |
| Compatibility | Additive optional SARIF property; existing fields and fallback band remain |

## Architecture

- Layer changed: SARIF rendering boundary.
- Files changed: `src/sarif.ts`, `test/sarif.test.ts`, README translations, and this spec.
- Shared contract touched: additive SARIF result property only.
- Possible conflicts: future numeric CVSS pass-through should replace the fallback only when a source supplies that number.

## Security and privacy

- Protected or sensitive data: none; the vector already comes from a public advisory.
- Data flow and trust boundary: parsed advisory finding to local SARIF output.
- Logging and retention: unchanged.
- Network/LLM/telemetry behavior: none.
- Failure mode: omit the optional property when unavailable.
- User opt-in/opt-out: selected by the existing `--format sarif` option.

## QA acceptance criteria

| Scenario | Expected result | Evidence |
|---|---|---|
| Finding with a vector | Exact source vector in result properties | SARIF unit test using a frozen OSV capture |
| Finding without a vector | Property is absent | SARIF unit test |
| Empty result | Existing valid empty run | Existing SARIF test |
| Many findings | Each result uses its own finding's vector | Mapping by existing ordered result construction |
| Existing behavior | Band, levels, fingerprints, and scoring remain unchanged | Existing suite |
| Malicious text | Value remains JSON-escaped by `JSON.stringify` | Existing serialization boundary |

## Agent notes

Do not compute CVSS scores here. Preserve source evidence verbatim and keep the
deterministic integer ranking independent from CVSS floating-point arithmetic.

## Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Add the vector to result properties | Rule properties; compute a numeric score | A vector varies with the finding and the captures provide no source numeric score |
| Retain the severity band | Remove `security_severity` | Preserves current GitHub alert rendering and compatibility while labeling the fallback honestly |
