# What is frozen

This project is below 1.0. That version number says the feature set is still
moving; it does not say the interfaces a pipeline depends on are.

Two surfaces are frozen from 0.0.7 onward and will not change without a major
version: **exit codes** and the **top-level shape of `--format json`**. If you
are deciding whether to put this in a gate that fails builds, those are the two
things you are betting on, so they are the two things stated here.

Everything else — the human-readable report, the wording of any line, the
weights, the HTML — can change in a patch release. Do not parse the terminal
output.

## Exit codes

| Code | Meaning | Frozen |
|---|---|---|
| `0` | Judged, and nothing outstanding that was not already accepted | yes |
| `1` | Judged, and there is at least one finding to act on | yes |
| `2` | Could not judge: nothing scanned, bad input, unusable baseline, usage error | yes |

The distinction that matters in CI is `1` against `2`. A `1` is a real answer —
findings exist. A `2` means the tool never reached an answer, and it exists so
that a project nobody scanned cannot go green:

> Nothing was scanned. Reporting "nothing new to fix" here would be a lie with a
> zero exit code attached, and in CI it turns a project the tool never looked at
> green — worse than crashing, because nobody investigates a passing build.
>
> — `src/cli.ts`

So `zero-shelter judge || true` is not a safe way to make a pipeline pass. It
also swallows the case where the scanners failed to run.

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
| `workspaceRoot` | boolean | Whether install commands would land in the wrong package.json |

`summary` keeps `raw`, `merged`, `fixNow`, `shown`, `accepted` and
`noLongerReported`, all integers.

Each entry in `fixNow` keeps `fingerprint`, `score`, `severity`, `ecosystem`,
`package`, `advisory`, `title`, `vulnerableRange`, `direct`, `tools` and
`possibleDuplicates`.

`fixedIn` is **frozen if present**. It is absent when no source named a version
that fixes the finding, which is common — 32 of 82 on the juice-shop captures.
Treat its absence as "no published fix", never as a key you can rely on.

**`warning` is frozen if present.** It is absent on a clean run. When it is
there it is a string, and it means the whole judgement is qualified: the
baseline was written for a different fingerprint schema, so every finding is
being reported as new until it is re-recorded. Treat its absence as "no
qualification" and never as "key missing, ignore".

Lesser qualifications do not currently reach JSON at all. When a scanner that
fed the baseline did not run this time, the terminal says so and the JSON does
not — if you are gating on this output, that is a gap you should know about
rather than a guarantee.

### What additive means

New keys may appear in a patch release. New fields may appear inside `fixNow`
entries. Consume this with a parser that ignores what it does not recognise,
and a minor upgrade will never break you.

What will not happen without a major version: a frozen key disappearing, changing
type, or keeping its name while changing meaning. That last one is the failure
we care most about, because it is the one a schema check does not catch.

### Not frozen

`--format sarif` follows the SARIF 2.1.0 schema, which is the contract there.
Note that `partialFingerprints.zeroShelter` is stable across machines but not
across changes to which scanners run — see #86.

The baseline file format is not frozen. It is ours, it is going to change, and
`judge` reads whatever version it finds.

## How this is enforced

`test/contract.test.ts` asserts the table above against real output rather than
against a copy of the table. It checks two things separately:

- every always-present key exists with the stated type
- `warning`, when a run produces one, is a string

A change that breaks either fails CI. If you are making that change
deliberately, the test is where you say so, and the major version is the price.

## If you need something frozen that is not

Open an issue. Interfaces get frozen by being depended on and said out loud, not
by waiting for 1.0.
