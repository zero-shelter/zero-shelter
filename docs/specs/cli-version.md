# Feature specification: CLI version

[한국어](./cli-version.ko.md). This document records the design for the linked issue.

## Issue and lifecycle metadata

- Issue/Discussion: [Discussion #41](https://github.com/zero-shelter/zero-shelter/discussions/41)
- Target layer: Entry / CLI
- Related PR: to be added

## Problem

A user cannot tell which installed zero-shelter package is running. This makes bug reports, support requests, and package smoke tests harder to reproduce.

## Goal

Expose the installed package version without running a scanner or reading a project baseline.

## Scope

### Included

- support `zero-shelter --version`;
- support `zero-shelter version`;
- read the version from the package metadata used by the installed CLI;
- print `zero-shelter <version>` followed by a newline;
- return exit code `0`;
- keep `judge`, `hook`, `--help`, and unknown-command behavior unchanged;
- add unit coverage and update the user-facing README options.

### Explicitly excluded

- changing the package version;
- changing npm install or init behavior;
- changing judgement, ranking, baseline, or hook output;
- adding network calls or telemetry;
- adding privacy or prompt-control behavior.

## Interface

| Invocation | Output | Exit code |
|---|---|---:|
| `zero-shelter --version` | `zero-shelter <package version>` | `0` |
| `zero-shelter version` | `zero-shelter <package version>` | `0` |
| `zero-shelter --help` | existing help text | `0` |
| `zero-shelter unknown` | existing error and usage | `2` |

The package metadata is the single source of truth. The feature must work from both a repository build and the published package layout.

## Architecture

- `src/version.ts` owns package-version loading and formatting.
- `src/cli.ts` owns argument recognition and dispatch.
- `test/version.test.ts` covers the public CLI behavior.
- No scanner, baseline, network, or agent layer is touched.

## Security and privacy

- The command reads only local package metadata.
- It does not read the target project, run subprocesses, inspect prompts, or make network requests.
- It emits no secret or personal data.

## QA acceptance criteria

| Scenario | Expected result | Evidence |
|---|---|---|
| `--version` | exact package version and exit `0` | unit test + manual CLI run |
| `version` | same output as `--version` | unit test + manual CLI run |
| `--help` | existing usage remains available | existing/manual check |
| `judge` | scanner and baseline path unchanged | existing test suite |
| `hook` | context and exit `0` unchanged | existing hook tests |
| unknown command | existing error and exit `2` | existing/manual check |
| built package layout | `node dist/bin.js --version` works | build smoke test |

## Agent notes

Do not duplicate the version literal in CLI code. Do not move version handling into the judgement or scanner layers. Keep the output stable because it will be copied into bug reports and release smoke tests.

## Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Use package metadata at runtime | hard-code the version in TypeScript | avoid two sources of truth when package.json changes |
| Support both flag and command | only `--version` | discoverability for users who prefer subcommands |
