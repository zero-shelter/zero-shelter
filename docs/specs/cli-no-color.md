# Feature specification: explicit `--no-color` CLI option

## Issue and lifecycle metadata

- Issue: #65
- Target layer: CLI and text rendering boundary
- Related PR: to be added

## Problem

`NO_COLOR` already disables ANSI output, but a user cannot explicitly disable
colors when an environment or wrapper enables `FORCE_COLOR`. This makes copied
terminal output harder to read.

## Goal

Allow a user to disable ANSI colors explicitly without changing the existing
environment-variable behavior or machine-readable output.

## Scope

### Included

- Add a `--no-color` boolean option to `judge`.
- Make it override `FORCE_COLOR` for human text output.
- Document and test the option.

### Explicitly excluded

- Changes to ranking, findings, output layout, exit codes, or hook output.
- A color-on CLI flag.
- Changes to JSON, SARIF, or file output, which are already uncolored.

## Interface

| Invocation | Result | Exit code |
|---|---|---:|
| `zero-shelter judge --no-color` | Human text has no ANSI escape codes | Existing judge code |
| `FORCE_COLOR=1 zero-shelter judge --no-color` | `--no-color` wins | Existing judge code |
| `zero-shelter judge --format json --no-color` | JSON remains unchanged | Existing judge code |
| `zero-shelter judge --help` | Lists `--no-color` | `0` |

## Architecture

- `src/cli.ts`: parse the flag and apply it at the existing color decision point.
- `test/no-color.test.ts`: cover override, existing behavior, and help text.
- `README.md` and `README.ko.md`: document the option.
- `src/report.ts` and `colorEnabled`: unchanged; environment semantics remain the
  single existing source of default color behavior.

## Security and privacy

- No new data, subprocess, network, LLM, or telemetry behavior.
- The flag changes presentation only.

## QA acceptance criteria

| Scenario | Expected result | Evidence |
|---|---|---|
| `FORCE_COLOR=1` without the flag | Existing colored text behavior | unit test |
| `FORCE_COLOR=1 --no-color` | No ANSI escape codes | unit test |
| `--help` | Option is discoverable | unit test + README |
| JSON/SARIF/file output | Existing machine-readable behavior | existing suite + code path review |

## Agent notes

Do not move color policy into judgement or ranking code. Do not change
`NO_COLOR`, `FORCE_COLOR`, machine-readable output, or report layout as part of
this feature.

## Decision log

| Decision | Alternative | Reason |
|---|---|---|
| Explicit CLI opt-out | Require users to set `NO_COLOR` | Works when a wrapper has enabled `FORCE_COLOR` |
