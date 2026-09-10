# What is frozen

From 0.0.7 onward, exit codes and the top-level shape of `--format json` are stable until a major version change. Human-readable wording, ranking weights, and HTML may change in patch releases; do not parse terminal output.

## Exit codes

| Code | Meaning | Frozen |
|---|---|---|
| `0` | Judged, and nothing outstanding that was not already accepted | yes |
| `1` | Judged, and there is at least one finding to act on | yes |
| `2` | Could not judge: nothing scanned, bad input, unusable baseline, usage error | yes |

Exit `1` means findings were reported. Exit `2` means the tool could not complete a judgement. Avoid `zero-shelter judge || true` in a CI gate: it also hides scanner and input failures.

New failure modes get `2`. We will not add a fourth code without a major
version, and we will not move a condition between `1` and `2`.

## `--format json`

These top-level keys are frozen. They will keep their names and their types:

| Key | Type | Meaning |
|---|---|---|
| `summary` | object | Counts, described below |
| `fixNow` | array | Findings to act on, worst first, truncated by `--top` |
| `upgrades` | array | Commands that reach every copy in the tree |
| `transitiveFixes` | array | Findings that need `overrides` instead |
| `noLongerReported` | array | Previously accepted, absent this run |
| `skipped` | array of string | Scanners that did not produce a report |
| `missingSources` | array of string | Scanners recorded in the baseline that did not contribute this run |
| `workspaceRoot` | boolean | Whether install commands would land in the wrong package.json |

`summary` keeps `raw`, `merged`, `fixNow`, `shown`, `accepted` and
`noLongerReported`, all integers.

Each entry in `fixNow` keeps `fingerprint`, `score`, `severity`, `ecosystem`,
`package`, `advisory`, `title`, `vulnerableRange`, `direct`, `tools` and
`possibleDuplicates`.

`fixedIn` is **frozen if present**. It is absent when no source named a version
that fixes the finding, which is common — 32 of 82 on the juice-shop captures.
Treat its absence as "no fix version reported"; it does not establish whether an upstream fix exists.

**`warning` is frozen if present.** It is absent on a clean run. When it is
there it is a string, and it means the whole judgement is qualified: the
baseline was written for a different fingerprint schema, so every finding is
being reported as new until it is re-recorded. Treat its absence as "no
qualification" and never as "key missing, ignore".

`missingSources` is the separate, additive qualification for a scanner set that
changed: it lists sources recorded in the baseline that did not contribute this
time, including runs where alias rematching kept accepted findings suppressed.
It is empty when source provenance is unavailable or every recorded source ran.

Treat a non-empty `missingSources` list as a limitation of the comparison with the baseline.

### What additive means

New keys may appear in a patch release. New fields may appear inside `fixNow`
entries. Parsers should ignore unrecognized fields.

What will not happen without a major version: a frozen key disappearing, changing
type, or keeping its name while changing meaning. Schema checks alone cannot detect a change in meaning.

### Not frozen

`--format sarif` follows the SARIF 2.1.0 schema, which is the contract there.
`tool.driver.version` and `tool.driver.semanticVersion` identify the
zero-shelter package that wrote the file. A result may also carry
`properties.toolVersions`, an array of `{ tool, version }` objects for scanner
versions the source supplied; missing versions stay absent rather than guessed.
`partialFingerprints.zeroShelter` is stable across machines but not across
changes to which scanners run — see #86. The JSON output intentionally keeps
its action-oriented `tools` names and does not add provenance versions there.

The baseline file format is not frozen. `judge` validates the format it reads and reports incompatible or unusable data.

## How this is enforced

`test/contract.test.ts` asserts the table above against real output rather than
against a copy of the table. It checks two things separately:

- every always-present key exists with the stated type
- `warning`, when a run produces one, is a string

A change that breaks either fails CI. If you are making that change
deliberately, update the test and follow the major-version requirement.

## If you need something frozen that is not

Open an issue describing the interface and the integration that depends on it.
