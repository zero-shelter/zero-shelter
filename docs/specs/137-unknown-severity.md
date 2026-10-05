# Feature specification: distinguish unknown severity from informational severity

## Issue and lifecycle metadata

- Issue: #137
- Target layer: finding ingestion, ranking, and report boundaries

## Problem

Several advisory feeds omit a severity band. Mapping that absence to `info`
makes an unstated value look like an explicit low-priority assessment and adds
ranking points that the source did not justify.

## Goal

Keep the existing `Severity` union and serialized `severity: "info"` value for
compatibility, while carrying whether the source actually stated a severity.
Unknown severity must receive no severity-band points and must be visible in
human-facing output.

## Scope

### Included

- Add optional `severityKnown: false` when ingestion has no recognized source band.
- Treat a merged finding as known when any merged source states a band.
- Give unknown severity zero severity weight while retaining the existing score table.
- Show an explicit unknown label in terminal and HTML output and an additive JSON field.
- Omit SARIF's numeric `security_severity` fallback for unknown severity and mark
  the rule with `severityKnown: false`.
- Document the behavior in both README languages.

### Explicitly excluded

- Expanding or changing the `Severity` union.
- Inferring a band from CVSS vectors, titles, or prose.
- Re-ranking any other signal, changing fingerprints, baselines, SARIF levels,
  exit codes, or scanner behavior.

## Interface

| Surface | Behavior |
|---|---|
| Finding | Optional `severityKnown`; absent means known for compatibility |
| JSON | `severityKnown: false` only for an unknown source severity |
| Human | `unknown` in the compact terminal table |
| HTML | “severity not stated by source” (localized) |
| SARIF | No `security_severity` when unknown; `severityKnown: false` is present |
| Errors/exit codes | Unchanged |

## QA acceptance criteria

| Scenario | Expected result |
|---|---|
| Source omits severity | `severity: "info"`, `severityKnown: false`, zero severity points |
| Source explicitly says info | Existing info points and no `severityKnown` flag |
| One merged source is known | Merged finding is known and uses the stated worst band |
| Human, JSON, HTML | Unknown state is clear and JSON remains additive |
| SARIF | No fabricated numeric severity for unknown findings |

## Decision log

| Decision | Reason |
|---|---|
| Keep `severity: "info"` | Existing consumers and the frozen severity union remain compatible |
| Use an optional boolean | Known findings produce byte-compatible output; only unknown data adds a field |
| Do not parse CVSS | A vector-to-band conversion would be a new judgment contract |
