# zero-shelter

[English](./README.md) · [한국어](./README.ko.md)

Turns dependency scanner output into a short, deterministic list of what to fix
now — and stops telling you about the rest.

Local-first. No LLM at runtime, no network calls of its own, no telemetry.

> **Status: early.** [`zero-shelter@0.0.1`](https://www.npmjs.com/package/zero-shelter)
> is a preview release — the pipeline runs end to end and is covered by 97 tests
> on Linux, macOS and Windows. The interface may still change before 0.1.0.

## The problem

Run the scanners on a real project and you get hundreds of warnings. Maybe five
are worth doing something about today. Finding those five costs more attention
than fixing them, so after a while nobody opens the report.

There is no shortage of tools that find things. What is missing is the part that
decides which of them matter right now.

## What it does

```console
$ npx zero-shelter judge
  osv-scanner skipped: not on PATH (optional — install it for cross-source deduplication)

fix these 5 now

  critical  minimist   GHSA-XVCH-5GV4-984H  → —  125
  critical  lodash     GHSA-JF85-CPCP-J695  → —  125
  high      minimatch  GHSA-3PPC-4F35-3M26  → —  100
  high      minimatch  GHSA-7R86-CG39-JMMJ  → —  100
  high      lodash     GHSA-35JH-R3H4-6JHM  → —   95

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

## Install

Nothing to install. `npx zero-shelter judge` runs it.

`npm audit` always runs, because a project with a lockfile already has npm.
`osv-scanner` is used when it is on `PATH` and skipped quietly when it is not —
you are never told to go install something before you can see output. Installing
it is worth doing though: it is what lets two sources be reconciled, which is
where most of the deduplication comes from.

pnpm and npm 6 report formats are read too.

## In CI

```yaml
- run: npx zero-shelter judge --format sarif --output zero-shelter.sarif
  continue-on-error: true

- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: zero-shelter.sarif
```

Findings land in the Security tab and annotate the pull request. Fingerprints
are stable across machines and runs, so GitHub recognises an alert it has
already seen instead of reopening it every build.

There is an irony here worth naming: this project exists because SARIF from
different tools cannot be reconciled by the tools that consume it. Emitting
SARIF is not a contradiction — downstream receives one already-judged run
instead of four raw ones it will fail to merge.

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

## Options

```
--input <file>        read scanner output instead of running scanners (repeatable)
--format <fmt>        text (default) | json | sarif
--output <file>       write to a file instead of stdout
--explain             show how each score was reached
--top <n>             report at most n findings
--update-baseline     record current findings as accepted
--baseline <file>     baseline location (default .zero-shelter/baseline.json)
--cwd <dir>           project directory
--no-color             disable ANSI colors in text output
--version             print the installed package version
```

`--no-color` affects human-readable text only and overrides `FORCE_COLOR`.
The existing `NO_COLOR` environment variable remains supported.

`zero-shelter version` is an equivalent command for scripts and users who prefer subcommands.

`--explain` prints every point awarded and the weights table it came from, so
the ranking can be argued with rather than trusted.

## Design invariants

These do not change. A patch that breaks one is rejected on that basis alone.

| Invariant | Why |
|---|---|
| No LLM at runtime | The same input must produce the same output, on every machine. And your code stays on your machine. |
| No network calls of our own | Results must be reproducible offline. Scanners we shell out to are their own business, and we say that plainly rather than claiming more than we do. |
| Integer arithmetic only in scoring | Floating point rounds differently across platforms. A ranking that shifts by host makes every number we publish true only on the machine that produced it. |
| Secrets hashed at parse time, originals discarded | A security tool that leaks what it finds has no reason to exist. |
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
- [Agent hook](./docs/AGENT-HOOK.md) — setup, and what it deliberately will not do
- [Benchmark](./bench/README.md) — pinned targets, frozen captures, labelling protocol
- [Contributing](./CONTRIBUTING.md) — contributor workflow, specs, QA, and PR rules
- [Governance](./GOVERNANCE.md) — Owner/Maintainer decisions and release boundaries
- [Security and privacy](./SECURITY.md) — reporting and security-control requirements

Korean: [README.ko.md](./README.ko.md), [THIRD_PARTY.ko.md](./THIRD_PARTY.ko.md).
English is the canonical version; a translation that lags is a bug worth
reporting.

## Development

```bash
npm ci
npm test
npm run typecheck
npm run third-party   # regenerate THIRD_PARTY.md
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

Feature specifications and QA evidence use the [spec template](./docs/feature-spec-template.md)
and [QA checklist](./docs/qa-checklist.md). The repository also provides GitHub issue and
pull request templates for feature, bug, and security-control contributions.

## License

[Apache-2.0](./LICENSE)
