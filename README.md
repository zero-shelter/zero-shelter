# zero-shelter

Turns dependency scanner output into a short, deterministic list of what to fix
now — and stops telling you about the rest.

Local-first. No LLM at runtime, no network calls of its own, no telemetry.

> **Status: early.** The pipeline runs end to end and is covered by 92 tests on
> Linux, macOS and Windows. Nothing is published to npm yet.

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

pnpm, yarn v1 and npm 6 report formats are read too.

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
```

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

We benchmark against externally labelled data and publish the result whether or
not it flatters us. If the ranking turns out to be about as accurate as sorting
by severity, that is what this section will say.

The claim is not better precision. It is far less noise at comparable precision.

Labelling is done by two people independently with inter-rater agreement
reported. It is not done by a model: proving a tool works using ground truth its
own authors generated is circular, and we would not believe it from anyone else.

## Documentation

- [Architecture](./docs/architecture.md) — layers, sequence diagram, where to add things
- [v1 scope](./docs/v1-scope.md) — what is in, what is deferred, and why

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

## License

[Apache-2.0](./LICENSE)
