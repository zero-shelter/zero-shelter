# Install and first-run experience

Owner: @PresentJay. This document records the install and first-run scope and its 2026-08-25 QA milestone. The package measurements and output examples below describe the 0.0.7-era checks; use the [README install guide](../README.md#install) for current instructions and [QA policy](./qa/execution-policy.md) for current verification requirements.

## Boundary

| Area | Covers | Not this area |
|---|---|---|
| **Install UX** (this doc) | how it is installed, what the first run does, what it says when it cannot do its job, version and help output, supported Node versions | how good the judgement is, how the report reads once it works |
| Output quality | ranking, wording of findings, what deserves to be in "fix now" | how you got here |
| Contributing | CONTRIBUTING, issue and PR templates, what a newcomer does first | end-user install |

Where they touch: the first-run message when there is nothing to scan is
install UX; the wording of an actual finding is output quality.

## Supported install paths

| Path | Command | Status |
|---|---|---|
| No install | `npx zero-shelter judge` | published as `zero-shelter@0.0.7` at this milestone |
| Dev dependency | `npm i -D zero-shelter` then `npx zero-shelter judge` | works — uses the published package |
| From source | `git clone … && npm ci && npm run build && npm run judge` | works |

Node 20 or later. No runtime dependencies. After a build, the `0.0.7` package is
110.7 kB packed across 79 files (`npm pack --dry-run`).

## A run with nothing scanned must fail

Before the fix, a directory without a lockfile could produce:

```console
$ cd /tmp/empty-dir && npx zero-shelter judge     # before
✓ nothing new to fix          # exit 0
```

No scanner produced a report in this case, but the command returned success. The corrected 0.0.7-era output was:

```console
$ cd /tmp/empty-dir && npx zero-shelter judge     # after
cannot judge /tmp/empty-dir: no scanner produced a report
  npm audit skipped: This command requires an existing lockfile. Try creating one first with: npm i --package-lock-only
  osv-scanner skipped: not on PATH. Most of the deduplication comes from having a second
  source: brew install osv-scanner, or https://github.com/google/osv-scanner/releases
nothing was scanned, so this is not a pass       # exit 2
```

The rule this follows: a source that produced a report we could read counts as
scanned; anything else does not, and zero sources scanned can never be a pass.
A successful scan with no findings stays exit 0.

## QA checklist

The table records the first-run cases at the milestone. `npm run qa` had fourteen checks at that time.

| # | Case | Expected | Recorded result |
|---|---|---|---|
| 1 | No lockfile in the directory | Says a lockfile is required and how to get one. Exit 2 (cannot judge), never 0 | ✅ repeats npm's own explanation, exit 2 |
| 2 | `--version` | Prints the version | ✅ #42 (@msnodeve) |
| 3 | Node older than 20 | Says which version is required and which is running | ✅ checked before anything loads, exit 2 |
| 4 | `osv-scanner` absent | Runs to completion on npm audit alone, one quiet note | ✅ |
| 5 | `--help` | Covers `judge` and `hook`, every flag, exit codes | ✅ |
| 6 | Windows, macOS, Linux | Identical output | ✅ 3-OS CI |
| 7 | Install footprint | No runtime dependencies; the package payload is `dist` plus standard npm metadata and documentation | ✅ 79 files, 110.7 kB |
| 8 | Scanner message accuracy | Names formats we actually parse | ✅ yarn v1 removed |
| 9 | `npx zero-shelter` with no subcommand | Same as `judge` | ✅ |
| 10 | Second run after `--update-baseline` | `✓ nothing new to fix`, exit 0 | ✅ |

## Repeating the checks

```bash
npm run qa
```

This packs the package, installs the tarball in a temporary project, and tests the shipped CLI. It caught a missing shipped feature whose source and tests had both been removed; unit tests alone did not detect that omission.

Agent-facing surfaces have a separate gate:

```bash
npm run qa:agent
```

It checks the hook, five skills, copy-paste prompts in the HTML report, the
plugin manifest, package-manager dialects, and the quiet failure paths. It
had eighteen checks at this milestone.

## Milestone criteria: 2026-08-25 24:00

The milestone required passing all fourteen `npm run qa` checks and posting the result in Discussions. Two checks were added for gaps found during QA: a workspace root and a run with both scanners present. Repeat the checks against `npx --yes zero-shelter@latest` for each release to verify the registry artifact as well as the local package.

Exit codes, which CI depends on and therefore cannot change casually:

| Code | Meaning |
|---|---|
| 0 | Nothing new to fix |
| 1 | New findings to fix |
| 2 | Could not judge — bad flags, unreadable input, nothing to scan |

## Excluded from this area

- An `init` command that writes CI workflow and hook configuration, deferred beyond this milestone.
- Publishing under an npm organization, which requires a separate ownership decision.
- Any change to what gets ranked or how it is worded.
