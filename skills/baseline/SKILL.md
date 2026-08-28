---
description: Decide what to accept into the baseline and what to fix, and keep the accepted list honest over time. Use when someone asks about the baseline, wants to silence findings, has a build failing on old findings, or asks what has already been accepted. Korean requests look like 베이스라인 정리해줘, 이건 일단 넘어가자, 예전 취약점 때문에 빌드가 깨져.
---

# The accepted list

Accepting a finding means it stops being reported. That is a decision about
risk, and it belongs to whoever owns the project. Your job is to make the
decision informed, never to make it for them.

## When someone wants the noise gone

Show what would be accepted first:

```bash
npx --yes zero-shelter judge
```

Then ask which of these they mean. Two questions separate a reasonable accept
from a bad one:

- **Is there a published fix?** If `fixedIn` is set and the package is direct,
  the upgrade is usually cheaper than the conversation about accepting it. Offer
  `/zero-shelter:fix` before offering the baseline.
- **Is this reachable here?** Nothing in this tool knows that. If they have
  looked and it is not reachable, accepting is a defensible call and worth
  writing down.

Only then:

```bash
npx --yes zero-shelter judge --update-baseline
```

It records everything currently outstanding. There is no way to accept one
finding and leave another, which is deliberate: a per-finding allowlist becomes
a place where things go to be forgotten.

## Commit it

`.zero-shelter/baseline.json` belongs in the repository. Without it, CI has
nothing to compare against and reports the whole backlog on every run, which is
how the check gets switched off.

One accepted finding per line, sorted, each naming its package and advisory —
so a pull request that changes it shows exactly what was accepted and by whom.
Say that when someone asks why it is not in `.gitignore`.

An entry may also carry `reason`, `acceptedBy` and `expires`, written by hand.
An expiry brings the finding back into the report on that date, which is what
keeps an accepted list from being a place things go to be forgotten. Dates are
`YYYY-MM-DD`; anything else is rejected rather than silently never expiring.

## Keeping it honest

Two things rot an accepted list.

**Entries for findings nobody produces any more.** After a fix, a run says how
many accepted findings are no longer reported. Re-record to drop them:

```bash
npx --yes zero-shelter judge --update-baseline
```

Do this after fixes land, not before: re-recording while findings are
outstanding accepts them.

**A baseline written by a different fingerprint recipe.** When the schema
changes the run says so, and every finding is reported as new until it is
re-recorded. That warning means the comparison is not possible, not that
something regressed.

## What to say, and what not to

- "No longer reported", not "fixed", unless a re-run confirms it and every
  scanner that contributed before ran again.
- Never run `--update-baseline` to end a task, to make a build green, or
  because the list is long. If you find yourself reaching for it to finish
  something, that is the moment to say the list is long and ask.
- Never add it to a CI job. A baseline that re-records itself accepts every new
  finding automatically, which removes the only thing the job does.

## When the build is failing on old findings

That is a project without a baseline, not a project with a problem. Show the
findings, agree on which to fix now, fix those, and record the rest. The point
of the ratchet is that tomorrow's build fails on what tomorrow's change
introduced.
