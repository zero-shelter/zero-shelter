---
description: Read zero-shelter's output and explain what to fix first and why, or hand over an html report to look at. Use when someone asks what a zero-shelter run means, why a finding is ranked where it is, which vulnerability to fix first, or what to do about the ones left over. Korean requests look like: 이 결과 해석해줘, 뭐부터 고쳐야 해, 리포트 보여줘.
---

# Reading a run

```bash
npx --yes zero-shelter judge --json
```

Shape:

```json
{
  "summary": { "raw": 7, "merged": 7, "fixNow": 7, "shown": 7, "accepted": 0, "noLongerReported": 0 },
  "skipped": ["osv-scanner skipped: not on PATH (optional …)"],
  "unscanned": { "secrets": true, "containers": false, "workflows": 0, "infrastructure": false },
  "upgrades": [{ "packageName": "lodash", "upgradeTo": "4.18.1", "clears": 7, "command": "<manager command from the report>" }],
  "transitiveFixes": [{ "packageName": "tar", "upgradeTo": "7.5.21", "clears": 2 }],
  "noLongerReported": [],
  "fixNow": [
    {
      "fingerprint": "fff5bce689ef200b",
      "score": 145,
      "severity": "critical",
      "package": "lodash",
      "advisory": "GHSA-JF85-CPCP-J695",
      "title": "Prototype Pollution in lodash",
      "vulnerableRange": "<4.17.12",
      "fixedIn": "4.18.1",
      "direct": true,
      "tools": ["npm-audit"],
      "possibleDuplicates": []
    }
  ]
}
```

| Field | What it actually tells you |
|---|---|
| `summary.raw → merged` | How many reports collapsed into one finding. A big drop means the scanners were describing the same vulnerabilities under different names |
| `summary.accepted` | Recorded in the baseline, deliberately not shown |
| `summary.fixNow` vs `summary.shown` | Everything outstanding, versus how many rows `--top` printed. Quote the first; the second is a page size |
| `score` | Why this is above that. Not a CVSS score, not a risk rating — our ranking, explainable with `--explain` |
| `fixedIn` | Present means there is a version to move to. Absent means awareness only, and it ranks lower for that reason |
| `direct` | A direct dependency is something this project can act on today |
| `tools` | Two entries means two scanners independently reported it |
| `possibleDuplicates` | Suspected same-as, **not merged**. Deliberate: hiding a real vulnerability is worse than showing a duplicate |
| `upgrades` | The commands. Already grouped and version-compared — use these instead of deriving your own from `fixedIn` |
| `workspaceRoot` | The command from `upgrades` here lands in the root package. Tell the user which workspace option their manager requires; nothing can tell you which one, because hoisting is manager-specific |
| `transitiveFixes` | Has a fix, but arrives through another dependency. Do not install it as a top-level dependency; use the manager-specific forced-version action shown by the report, at the risk of breaking the parent |
| `noLongerReported` | Accepted findings nothing reported this run |

## How to present it

Lead with `upgrades` — a command is an action; a paragraph about prototype
pollution is not.

```
the command in `upgrades`     clears 7 of the 9, including both criticals
2 more have a fix but come in through other packages (the report shows the manager-specific forced-version action)
The remaining 3 have no published fix; they are listed so you know they exist.
```

Do not re-derive the commands from `fixedIn`. The CLI already picked the highest
fix per package, and comparing versions as strings puts 4.17.21 above 4.18.1 —
which would send someone to an older release than the one they need.

`--explain` also names the possible duplicates by advisory rather than by
fingerprint, so they can actually be compared. When two of them turn out to
describe the same issue, one upgrade closes both and the list was longer than
the work.

When asked why something is ranked where it is, run:

```bash
npx --yes zero-shelter judge --explain
```

It prints every point awarded and the weights table it came from. Quote that
rather than reasoning about severity yourself — the numbers are reproducible
and your reconstruction is not.

## When looking at it beats being told

```bash
npx --yes zero-shelter judge --format html --output zero-shelter.html
```

Hand that over instead of a long summary when the list is long, when someone
asks what the state is rather than what to do next, or when the answer belongs
to more than one person. `--lang ko` for a Korean page.

## What happened before this run

```bash
npx --yes zero-shelter history
npx --yes zero-shelter history --json --last 10
```

Each line is a recorded run: how many were outstanding, what appeared, what
stopped being reported. Use it to answer "is this getting better", and quote it
rather than characterising a trend from a single run.

Say **no longer reported**, not fixed. A finding also leaves the list when it
is accepted into the baseline, and when the scanner that found it did not run —
the history cannot tell those from a fix, and neither can you from here.

## Boundaries that make this useful

- **Do not re-order, filter, or add findings.** If the ranking looks wrong, say
  which finding and why so the weights can be argued with. Silently fixing it in
  the presentation layer breaks the one property this tool sells: the same input
  produces the same, checkable answer.
- **Do not turn `possibleDuplicates` into merges.** Report them as unresolved.
- **Do not estimate exploitability.** Nothing here knows whether the vulnerable
  path is reachable in this project. Say that when asked.
- **Never call a run clean when it exited 2** — that means nothing was scanned.
  `summary` may look empty and it is not evidence of anything.
- Numbers come from the JSON. If you did not run it, do not describe a run.

## After a fix

Re-run. `noLongerReported` lists accepted findings nothing produced this time,
and the text output says so in a line of its own.

Say "no longer reported", not "fixed", unless the run confirms it: a finding
also disappears when the scanner that found it did not run. When that doubt
applies, the CLI names the missing scanner — repeat that caveat rather than
dropping it, and suggest `--update-baseline` to prune the entries that are
genuinely gone.
