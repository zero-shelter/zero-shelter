# Install and first-run experience

Owner: @PresentJay. This is the spec and QA bar for one area — getting the tool
onto a machine and through its first run — so the other two areas can be worked
on without guessing where the seams are.

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
| No install | `npx zero-shelter judge` | works — the preview package is published as `zero-shelter@0.0.7` |
| Dev dependency | `npm i -D zero-shelter` then `npx zero-shelter judge` | works — uses the published package |
| From source | `git clone … && npm ci && npm run build && npm run judge` | works |

Node 20 or later. No runtime dependencies. After a build, the `0.0.7` package is
110.7 kB packed across 79 files (`npm pack --dry-run`).

## What the first run must never do

**Report success when it checked nothing.** It used to:

```console
$ cd /tmp/empty-dir && npx zero-shelter judge     # before
✓ nothing new to fix          # exit 0
```

There is no lockfile there, so nothing was scanned, and both the sentence and
the exit code said the opposite. In CI that is worse than a crash: the pipeline
goes green on a project the tool never looked at, and nobody investigates a
passing build. Now:

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
"Scanned and found nothing" stays exit 0 — that distinction is the whole point.

## QA checklist

The bar for this area. The ten rows below are the user-facing first-run cases;
`npm run qa` executes fourteen checks in total.

| # | Case | Expected | Now |
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
| 10 | Second run after `--update-baseline` | `✓ nothing new to fix`, exit 0 — the honest one | ✅ |

## Running it

```bash
npm run qa
```

Packs the package, installs the tarball into a throwaway project, and runs the
checks against that — not against the working copy. The distinction is the
point: this exact check caught a merge that deleted a shipped feature while
every test and all three CI matrices stayed green, because the tests for the
deleted code were deleted along with it.

Agent-facing surfaces have a separate gate:

```bash
npm run qa:agent
```

It checks the hook, five skills, copy-paste prompts in the HTML report, the
plugin manifest, package-manager dialects, and the quiet failure paths. It
currently runs eighteen checks.

## Definition of done — 2026-08-25 24:00

All green from `npm run qa` (fourteen checks, two of them added after the QA itself found gaps: a workspace root, and a run with both scanners present), and the result posted as a QA report in
Discussions. A published version now exists, so the same checks should also be
repeated against `npx --yes zero-shelter@latest` for each release — packing
locally proves the tree is sound, not that the registry serves the same bytes.

Exit codes, which CI depends on and therefore cannot change casually:

| Code | Meaning |
|---|---|
| 0 | Nothing new to fix |
| 1 | New findings to fix |
| 2 | Could not judge — bad flags, unreadable input, nothing to scan |

## Not in this area, on purpose

- An `init` command that writes CI workflow and hook config. Convenience, not
  correctness; it can wait until after the deadline.
- Publishing under an npm organisation. Ownership, not install experience.
- Any change to what gets ranked or how it is worded.
