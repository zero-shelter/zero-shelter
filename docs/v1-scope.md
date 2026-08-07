# v1 scope

What v1 does, what it deliberately leaves out, and why the line is drawn there.

## The pain we are removing

Run the scanners and you get hundreds of warnings. Perhaps five deserve
attention today, and identifying those five costs more than fixing them. So the
report stops being opened.

There is no shortage of things that find problems. What is missing is the part
that decides.

## What v1 does

```
npm audit --json         ─┐
                          ├─→ normalize ─→ merge ─→ rank ─→ ratchet ─→ "fix these N"
osv-scanner (if present) ─┘
```

One command, `npx zero-shelter judge`, behaving the same locally and in CI.

## What v1 does not do

No SAST, no secret scanning, no prompt-time hooks, no natural-language rule
packs. Those are sequenced later rather than dropped, for the reason below.

---

## Why dependencies first

The original framing was "ingest output from several scanners and merge it."
Checking which pairs actually overlap showed that most of the combinations we
had in mind have nothing to merge.

| Pair | Overlaps? |
|---|---|
| semgrep (SAST) + npm audit (SCA) | No. They look for different things and never report the same finding. |
| semgrep + gitleaks | No, same reason. |
| **npm audit + osv-scanner** | **Yes. The same advisory under GHSA, CVE and OSV names.** |
| gitleaks + trufflehog | Yes. The same secret found by both. |
| semgrep + opengrep | Technically, but opengrep is a semgrep fork, so the outputs are near-identical and deduplicating them proves nothing. |

Duplication happens **within a layer**, when two tools cover the same ground. In
practice that means dependencies and secrets. Very few teams run two SAST
engines.

So v1 starts where the overlap provably exists. Once the judgment works there and
we have numbers to show it, the layers widen. Doing it in the other order
produces something that says "merged" while in fact placing results side by side.

`npm audit` earns its place for a second reason: if a project has a lockfile it
has npm. Zero setup, so the first run never fails for want of a dependency.

## Why we invoke scanners instead of only reading their output

Reading only from files means `npx zero-shelter` does nothing on its own. The
first run is the only one most people give a tool, and one that produces nothing
does not get a second.

Running everything is not an option either. **semgrep cannot be installed from
npm** — it ships via PyPI and prebuilt binaries. An npm tool that asks you to
install Python has already lost the setup it was supposed to save.

So:

- `npm audit` always runs. No preconditions.
- Anything else runs **if it is on `PATH`**, and is skipped silently otherwise.
- Pre-existing output can be supplied with `--input`, which is what CI usually
  wants.

Nothing is ever a prerequisite.

## Why CI and pull requests come first

That is where the noise costs the most, and the only context where the ratchet
has an unambiguous meaning. "Only what this change introduced" is vague locally
and precise on a pull request.

## Why the ratchet ships in v1

The difference between a tool people try and a tool people keep is whether there
is a reason to run it a second time.

A legacy repository produces hundreds of findings on the first run. Demanding
all of them be fixed is equivalent to being ignored. "Do not let it get worse
from today" is the achievable version, and it requires that yesterday's
dismissals stay dismissed.

Without it, the second run is identical to the first, which is merely annoying.
So it is not a later feature. It is part of what makes v1 a product.

## Constraints this places on the implementation

From the invariants in the [README](../README.md#design-invariants), the ones
that bite hardest in v1:

- **Integer arithmetic only in ranking.** Platform-dependent rounding would make
  the ordering host-specific, and every published number with it.
- **Everything fingerprinted goes through `src/normalize.ts`.** No exceptions.
- **No network calls of our own.** `npm audit` contacts the registry; that is npm
  doing its job. We describe our guarantee precisely — that *we* add no traffic —
  rather than claiming to be offline in a way we are not.

## What we will say about accuracy

If the benchmark shows our ranking is about as accurate as sorting by severity,
we publish that.

What we are claiming is not better precision. It is a large reduction in noise at
comparable precision, which is both easier to defend and closer to what actually
helps. Claiming precision we cannot demonstrate invites exactly the check that
disproves it.

## Order of expansion

After v1 works end to end:

1. **Secrets** (gitleaks + trufflehog) — the second layer where overlap is real.
2. **SAST ingest** (SARIF) — here the goal is one ordered list rather than
   deduplication, since the overlap is thin.
3. **Developer-intent rules and prompt-time hooks.**

Each step begins only after the previous one has been measured on the benchmark.
