# zero-shelter

Turns scanner output into a short, deterministic list of what to fix now.

Local-first. No LLM at runtime, no network calls of its own, no telemetry.

> **Status: early.** The ingest layer is being built. Nothing is published to npm
> yet. See the [v1 milestone](https://github.com/zero-shelter/zero-shelter/milestone/4)
> for what "usable" means and how far off it is.

## The problem

Run the scanners on a real project and you get hundreds of warnings. Maybe five
of them are worth doing something about today. Finding those five costs more
attention than fixing them, so after a while nobody opens the report at all.

There is no shortage of tools that find things. What is missing is the part that
decides which of them matter right now.

`npm audit` is the clearest case. It reports the same advisory once for every
package that transitively pulls in the vulnerable one, and it has no idea which
of those you can actually act on.

## What v1 does

```
npm audit --json        ─┐
                         ├─→ normalize ─→ merge ─→ rank ─→ ratchet ─→ "fix these N"
osv-scanner (if present) ─┘
```

One command, same behaviour locally and in CI:

```bash
npx zero-shelter judge
```

`npm audit` always runs — if a project has a lockfile it has npm, so there is
nothing to install first. Other scanners are used when they happen to be on
`PATH` and skipped quietly when they are not. You are never told to go install
something before you can see output.

The ratchet is the part that makes it survivable on an existing codebase.
A legacy repo will light up with hundreds of findings on the first run, and
telling people to fix all of them is the same as telling them to ignore the
tool. Instead the first run records what is already there, and after that you
only hear about what is new.

Why dependencies before anything else, and why the merge step is harder than it
looks: [`docs/v1-scope.md`](./docs/v1-scope.md).

## Design invariants

These do not change. A patch that breaks one gets rejected on that basis alone.

| Invariant | Why |
|---|---|
| No LLM at runtime | The same input has to produce the same output, every time, on every machine. And your code stays on your machine. |
| No network calls of our own | Results have to be reproducible offline. External scanners we shell out to are their own business, and we say so plainly rather than claiming more than we do. |
| Integer arithmetic only in scoring | Floating point rounds differently across platforms. A ranking that shifts by host makes every number we publish true only on the machine that produced it. |
| Secrets are hashed at parse time, originals discarded | A security tool that leaks the secrets it finds has no reason to exist. |
| Everything fingerprinted goes through `src/normalize.ts` | Two normalization paths means two fingerprints for the same finding. |

CI runs the suite on Ubuntu, macOS and Windows and asserts fixed hash values, so
a host-dependent fingerprint fails the build instead of quietly making our
published numbers machine-specific.

## Honesty about what we measure

We are benchmarking against externally labelled data, and we will publish the
result whether or not it flatters us.

If our ranking turns out to be about as accurate as sorting by severity, that is
what the README will say. The claim we are making is not *better precision* —
it is *far less noise at the same precision*, which is both easier to defend and
more useful in practice.

Labelling is done by two people independently, with inter-rater agreement
reported. It is not done by a model: proving a tool works using ground truth the
tool's own vendor generated is circular, and we would not believe it from anyone
else either.

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

One thing about review is unusual here, so it is worth stating up front:

> **A reviewer who cannot describe an input that breaks the change does not
> approve it.**

Not comment count. An agent can write four hundred lines in three minutes, and a
human will approve four hundred lines in three minutes to match — at which point
the code and its tests share the same misunderstanding and no one notices.
Trying to break something is the only evidence that anyone read it.

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[Apache-2.0](./LICENSE)
