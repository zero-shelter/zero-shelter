# zero-shelter

[English](./README.md) · [한국어](./README.ko.md)

Turns dependency scanner output into a short, deterministic list of what to fix
now — and stops telling you about the rest.

Local-first. No LLM at runtime, no network calls of its own, no telemetry.

> **Status: early.** [`zero-shelter`](https://www.npmjs.com/package/zero-shelter)
> is published as a preview. The pipeline runs end to end, and CI covers it on
> Linux, macOS and Windows — including installing the packaged tarball and
> running the tool on this repository itself. The interface may still change
> before 0.1.0.

## The problem

Run the scanners on a real project and you get hundreds of warnings. Maybe five
are worth doing something about today. Finding those five costs more attention
than fixing them, so after a while nobody opens the report.

There is no shortage of tools that find things. What is missing is the part that
decides which of them matter right now.

## What it does

```console
$ npx zero-shelter judge

fix these 5 now

  critical  minimist   GHSA-XVCH-5GV4-984H  → —  125
  critical  lodash     GHSA-JF85-CPCP-J695  → —  125
  high      minimatch  GHSA-3PPC-4F35-3M26  → —  100
  high      minimatch  GHSA-7R86-CG39-JMMJ  → —  100
  high      lodash     GHSA-35JH-R3H4-6JHM  → —   95

  npm i minimist@1.2.8   clears 2

  13 reported → 13 after merge → 5 to fix  (62% less noise)
  first run — record these as accepted with --update-baseline, then only new findings are reported
```

Record what is already there, and from then on you only hear about what is new:

```console
$ npx zero-shelter judge --update-baseline
recorded 13 finding(s) as accepted in .zero-shelter/baseline.json

$ npx zero-shelter judge
✓ nothing new to fix
  13 reported → 13 after merge → 0 to fix (100% less noise), 13 already accepted
```

Exit code is `1` when anything is new, so CI fails on the regression this change
introduced rather than on the backlog it inherited.

Fix something and it says so:

```console
$ npm i minimist@1.2.8
$ npx zero-shelter judge
✓ nothing new to fix
  7 reported → 7 after merge → 0 to fix (100% less noise), 7 already accepted
  ✓ 2 accepted finding(s) no longer reported — re-record with --update-baseline to drop them
```

"No longer reported" rather than "fixed", because a finding also disappears
when the scanner that found it did not run. The baseline records which scanners
contributed, so when one of them is missing this run, the line says which —
and when they all ran again, it does not manufacture doubt.

## Install

Two things, and the second one is not optional.

```console
$ npm i -g zero-shelter          # or npx zero-shelter judge
$ brew install osv-scanner       # or a release from google/osv-scanner
```

`npm audit` always runs, because a project with a lockfile already has npm. It
is one source. **This tool reconciles sources, so with one of them there is
nothing to reconcile** — you get ranking and a baseline, and the count comes out
the same as it went in.

The difference is not subtle. On uptime-kuma:

```console
npm audit alone      71 reported → 71 to fix   (0% less noise)
plus osv-scanner    142 reported → 71 to fix  (50% less noise)
```

Both numbers are real. The second scanner does not find 71 new problems — it
describes the same ones again, under identifiers the first one did not use, and
reconciling that is the job.

A run without `osv-scanner` still works and says so rather than failing. It is
just the smaller half of the tool.

pnpm projects work the same way: a `pnpm-lock.yaml` makes it run `pnpm audit`
instead. npm 6's older report shape is read too.

yarn has no second source without `osv-scanner` and no first source either —
`npm audit` cannot read `yarn.lock`, and yarn v1 writes NDJSON, which this tool
does not parse. `osv-scanner` reads `yarn.lock` directly, so for yarn it is the
only source there is.

## In CI

```yaml
- run: npx zero-shelter judge --format sarif --output zero-shelter.sarif
  continue-on-error: true

- uses: github/codeql-action/upload-sarif@6f5948dfacef28e207b48d0905cf90c03365536d # v3.37.9
  with:
    sarif_file: zero-shelter.sarif
```

Findings land in the Security tab and annotate the pull request, each one
carrying what to do about it — `npm i lodash@4.18.1` for a direct dependency,
or the `overrides` entry that forces a transitive one. Fingerprints are stable
across machines and runs, so GitHub recognises an alert it has already seen
instead of reopening it every build.

There is an irony here worth naming: this project exists because SARIF from
different tools cannot be reconciled by the tools that consume it. Emitting
SARIF is not a contradiction — downstream receives one already-judged run
instead of four raw ones it will fail to merge.

Before you gate a build on a `0.0.x` tool, [`docs/STABILITY.md`](./docs/STABILITY.md)
says which surfaces are frozen and which can change in a patch. The version
number says the feature set is moving; it does not say the exit codes are.

## In your coding agent

A coding agent starts every session blind to what is already broken here, and
will add a dependency this project has an unfixed advisory for. `zero-shelter
hook` hands it the same short list you get.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "npx zero-shelter hook" }] }
    ]
  }
}
```

It never blocks a prompt and never fails — on any error it stays quiet and exits
0, because interrupting someone's session over a report they did not ask for is
worse than saying nothing. See [docs/AGENT-HOOK.md](./docs/AGENT-HOOK.md).

## What has happened here

```console
$ npx zero-shelter judge --record     # appends one line to .zero-shelter/history.jsonl
$ npx zero-shelter history
  2026-08-20T09:14:02.118Z    9 outstanding  +9
  2026-08-21T11:02:55.700Z    7 outstanding  -2
  2026-08-22T08:31:10.042Z   10 outstanding  +3
```

Nothing is recorded unless a run is asked to. The file is JSONL: one line per
run, readable with `tail`, diffable in a pull request, and holding the
fingerprints rather than only the counts, because counts cannot tell "two fixed
and two appeared" from "nothing changed".

It says *no longer reported*, never *fixed*. A finding also leaves the list
when it is accepted into the baseline, or when the scanner that found it did
not run.

## A page to look at

```console
$ npx zero-shelter judge --format html --output report.html
```

One file, opened in a browser: the commands to run first with what each one
clears, prompts you can paste into a coding agent, every finding with the score
that put it there, and what was accepted or has stopped being reported. Every
command and prompt has a copy button, and a folded glossary says what each
number means for whoever is reading their first one. No network, no build step, and the same judgement renders
byte-identically, so two reports can be diffed. `--lang ko` for Korean;
`--stamp "..."` if the page needs a date on it.

## As a Claude Code plugin

```
/plugin marketplace add zero-shelter/zero-shelter
/plugin install zero-shelter@zero-shelter
```

Five skills. `/zero-shelter:setup` runs the first scan, `/zero-shelter:explain`
reads a run and says what to fix first, `/zero-shelter:fix` applies the upgrades
and re-judges to confirm they landed, `/zero-shelter:baseline` works out what to
accept and keeps the accepted list honest, and `/zero-shelter:ci` puts the gate
in a pipeline — baseline first, so the build fails on what a change introduced rather
than on the backlog it inherited.

Both are presentation only. The skills are told not to re-rank, filter or add
findings, and to quote `--explain` rather than reason about severity themselves:
the judgement stays in the CLI, where the same input produces the same answer
and you can check it. A model that reorders the list on the way to your screen
would take that away.

## Options

```
--input <file>        read scanner output instead of running scanners (repeatable)
--format <fmt>        text (default) | json | sarif | html
--lang <code>         language for the HTML report: en (default) | ko
--stamp <text>        optional line in the HTML footer
--json                shorthand for --format json
--output <file>       write to a file instead of stdout
--explain             show how each score was reached
--top <n>             print at most n rows (the counts and advice stay about
                      the whole project)
--record              append this run to .zero-shelter/history.jsonl
--update-baseline     record current findings as accepted
--baseline <file>     baseline location (default .zero-shelter/baseline.json)
--cwd <dir>           project directory
--no-color            disable ANSI colors in text output
--version             print the installed package version
--help                print this help
```

`--no-color` affects human-readable text only and overrides `FORCE_COLOR`.
The existing `NO_COLOR` environment variable remains supported.

`zero-shelter version` is an equivalent command for scripts and users who prefer subcommands.

`zero-shelter history [--json] [--last <n>]` shows the recorded changes between
runs. Nothing is recorded unless `judge --record` is requested.

`--explain` prints every point awarded and the weights table it came from, so
the ranking can be argued with rather than trusted.

## When it says something you did not expect

| It says | What is happening |
|---|---|
| `cannot judge …: no scanner produced a report` | Nothing was scanned, and this exits 2 rather than pretending to pass. Usually there is no lockfile: `npm i --package-lock-only` |
| `yarn.lock found and nothing could read it` | yarn v1 writes NDJSON, which this does not parse. `osv-scanner` reads `yarn.lock` directly and is the shortest way out |
| `zero-shelter needs Node 20 or later` | That is the whole problem; there is no flag that works around it |
| `osv-scanner skipped: not on PATH` | Optional, and the run still works. Installing it is where most of the deduplication comes from |
| `… is SARIF, which is what this tool writes rather than reads` | `--input` takes scanner reports, not our own output |
| `… is not valid JSON` about a baseline | An interrupted `--update-baseline` leaves a truncated file. Delete it and re-record |
| `first run — record these as accepted` | The whole backlog is being reported because there is no baseline yet. That is what `--update-baseline` is for |

## Design invariants

These do not change. A patch that breaks one is rejected on that basis alone.

| Invariant | Why |
|---|---|
| No LLM at runtime | The same input must produce the same output, on every machine. And your code stays on your machine. |
| No network calls of our own | Results must be reproducible offline. Scanners we shell out to are their own business, and we say that plainly rather than claiming more than we do. |
| Integer arithmetic only in scoring | Floating point rounds differently across platforms. A ranking that shifts by host makes every number we publish true only on the machine that produced it. |
| Secrets hashed at parse time, originals discarded | Applies when secret scanning lands; v1 has none, and the hashing this needs is already in `src/fingerprint.ts`. A security tool that leaks what it finds has no reason to exist. |
| Everything fingerprinted goes through `src/normalize.ts` | Two normalization paths means two identities for one finding. |

CI runs the suite on Ubuntu, macOS and Windows and asserts fixed hash values, so
a host-dependent fingerprint fails the build rather than quietly making our
numbers machine-specific.

## Where merging stops

Two scanners agree on a vulnerability only when they share an identifier.
`npm audit` links one advisory to GitHub and another to NVD, so their alias sets
can be disjoint even for the same vulnerability.

We join what shares an identifier and **flag the rest rather than guessing**.
Between showing a duplicate and hiding a vulnerability, the duplicate is the
cheaper mistake.

This is v1's answer, not a permanent one — the tradeoffs are open in
[Discussion #25](https://github.com/zero-shelter/zero-shelter/discussions/25),
and we would like better ideas.

## Honesty about what we measure

Four external projects, pinned by commit, with the scanner output frozen in
`bench/captures/` so anyone can reproduce the table offline:

| Repo | Raw reports | After judge | Reduction |
|---|---|---|---|
| juice-shop | 155 | 82 | 47% |
| NodeGoat | 360 | 173 | 52% |
| dvna | 106 | 51 | 52% |
| hackathon-starter | 24 | 11 | 54% |

`npm run build && node bench/evaluate.mjs` reproduces it. No network, no
scanners needed.

**This is volume, not precision.** It says the two sources describe the same
advisories about half the time and that we reconcile them. It does not say the
survivors are the right ones — that needs ground truth, which does not exist
yet. Until it does, the honest claim is *fewer items*, not *the right items*.

Labelling will be done by two people independently, blind, with inter-rater
agreement reported. Not by a model: proving a tool works using ground truth its
own authors generated is circular, and we would not believe it from anyone else.
See [bench/README.md](./bench/README.md) for the protocol and the limitations we
know about, including that the ranking predates the labels.

## Documentation

- [Architecture](./docs/architecture.md) — layers, sequence diagram, where to add things
- [v1 scope](./docs/v1-scope.md) — what is in, what is deferred, and why
- [AGENTS.md](./AGENTS.md) — what an agent working in a repository that uses this needs to know
- [Agent hook](./docs/AGENT-HOOK.md) — setup, and what it deliberately will not do
- [Benchmark](./bench/README.md) — pinned targets, frozen captures, labelling protocol
- [Contributing](./CONTRIBUTING.md) — contributor workflow, specs, QA, and PR rules
- [Governance](./GOVERNANCE.md) — Owner/Maintainer decisions and release boundaries
- [Security and privacy](./SECURITY.md) — reporting and security-control requirements

Korean: [README.ko.md](./README.ko.md), [THIRD_PARTY.ko.md](./THIRD_PARTY.ko.md).
English is the canonical version; a translation that lags is a bug worth
reporting.

## We run it on ourselves

CI runs `zero-shelter judge` on this repository and fails the build on a
finding. The first time that job ran it reported six, including a critical in
our test runner, and the fix was the line the tool printed:
`npm i vitest@4.1.11`. One upgrade cleared all six.

Nothing is recorded in a baseline here. Silencing our own tool to keep our own
build green is the behaviour this project exists to argue against.

## Development

```bash
npm ci
npm test
npm run typecheck
npm run third-party   # regenerate THIRD_PARTY.md
npm run qa            # pack, install into a temp project, check the install experience
npm run qa:agent      # check the hook, skills, HTML prompts, and plugin manifest
```

Node 20 or later.

## Contributing

Contributions are welcome, including disagreement with the design.

One review rule is unusual enough to state up front:

> **A reviewer who cannot describe an input that breaks the change does not
> approve it.**

Not comment count. An agent can write four hundred lines in three minutes, and a
human will approve four hundred lines in three minutes to match — at which point
the code and its tests share the same misunderstanding and nobody notices.

See [CONTRIBUTING.md](./CONTRIBUTING.md).

Feature specifications and QA evidence use the [spec template](./docs/feature-spec-template.md),
[QA checklist](./docs/qa-checklist.md), and [Beta QA Guide](./docs/qa/README.md). The repository
also provides GitHub issue and pull request templates for feature, bug, and security-control
contributions.

Looking for somewhere to start? [`good first issue`](https://github.com/zero-shelter/zero-shelter/labels/good%20first%20issue)
names the file and the line, gives a command that reproduces the defect, and says
which part needs a judgement rather than typing.

If it turned out useful, a star helps other people find it. If it did not, an
issue saying why is worth more.

[![Star history](https://api.star-history.com/svg?repos=zero-shelter/zero-shelter&type=Date)](https://star-history.com/#zero-shelter/zero-shelter&Date)

## License

[Apache-2.0](./LICENSE)
