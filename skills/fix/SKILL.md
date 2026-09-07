---
description: Apply the upgrades zero-shelter asked for and check they worked, including transitive findings a top-level install cannot reach. Use when someone wants dependency findings fixed, asks to resolve vulnerabilities, or says to do what the report says. Korean requests look like: 의존성 취약점 고쳐줘, 취약점 해결해줘, 리포트대로 조치해줘.
---

# Fixing what the judgement found

Four steps. Do not skip the last one: an upgrade that was not re-judged is a
claim, not a fix.

```bash
npx --yes zero-shelter judge --json
```

## 1. Take the commands from `upgrades`

They are already grouped by package and already version-compared. Run them as
given.

Do not build your own command from `fixedIn`. Comparing versions as strings
puts `4.17.21` above `4.18.1`, which sends someone to an older release than the
one they need, and the CLI has already done that comparison correctly.

## 2. Say what will happen before it happens

For each command: which findings it clears, and whether the jump is a patch,
minor or major. A major upgrade of a test runner is a different conversation
from a patch on a leaf dependency. Get agreement before running anything.

## 3. `transitiveFixes` is not a list of commands

These packages arrive through someone else's dependency. Installing one as a
top-level package adds an entry nobody asked for and leaves the vulnerable copy
exactly where it was.

The mechanism that works is the package manager's forced-version feature, and it
carries a real risk: it can override a version a parent package pinned
deliberately, which can break that parent. Use the manager-specific form shown
by the report, name the risk, and let the person decide. Never add a forced
version as part of "just fixing it".

## 4. Re-run this tool, and quote what it says

```bash
npx --yes zero-shelter judge
```

**Verify with `zero-shelter judge`, not with `npm audit`.** They answer
different questions. `npm audit` does not know the baseline, so it calls a
project clean while accepted findings are still outstanding, and it does not
reconcile a second scanner or rank anything. Reporting its "0 vulnerabilities"
as the result of this work is quoting a different tool's opinion.

Report the line this tool prints, including the count and whether anything is
now no longer reported. If repeated runs feel slow through `npx`, install it
once with `npm i -D zero-shelter` and the loop gets short. If the project keeps a history, record the run so the
change is on the record:

```bash
npx --yes zero-shelter judge --record
```

Then verify the rest of the project still works — the test suite, a build —
because a dependency upgrade that fixes an advisory and breaks the build has
not helped anyone.

## What to call the result

Say **no longer reported**, not fixed, unless the re-run confirms it and every
scanner that contributed before ran again. A finding also disappears when it is
accepted into the baseline, and when the scanner that found it did not run. The
CLI hedges for exactly this reason; do not remove the hedge in your summary.

## When there is nothing to run

Some findings have no published fix. Say so plainly and stop. Do not:

- suggest pinning to an unaffected older version without checking it is not
  affected by something else
- suggest removing the dependency unless you have looked at what uses it
- suggest `--update-baseline` to make the output quiet. Accepting a finding is
  a decision about risk, and it belongs to the person who owns the project

## What never happens here

- Editing manifest versions by hand instead of installing. The lockfile is what
  the scanners read.
- Running `--update-baseline` without being asked, or as a way to finish a task.
- Reporting success from the plan rather than from a re-run.
