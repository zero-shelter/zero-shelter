---
description: Review proposed baseline acceptances and maintain existing decisions with the project owner. Use when someone asks about the baseline, wants to silence findings, has a build failing on old findings, or asks what has already been accepted. Korean requests look like 베이스라인 정리해줘, 이건 일단 넘어가자, 예전 취약점 때문에 빌드가 깨져.
---

# Review accepted findings

A baseline records the project owner's decision to accept findings. Your role
is to explain the choices and apply the user's decision.

## Review before accepting

```bash
npx --yes zero-shelter judge --json
```

Report current findings, available `upgrades`, `transitiveFixes`, and missing
source warnings. Offer `/zero-shelter:fix` for supported upgrades. Ask the user
to assess reachability when it matters; this tool cannot establish it.

Only after the user authorizes acceptance:

```bash
npx --yes zero-shelter judge --update-baseline
```

This command records the current findings, including all newly outstanding
ones. It does not provide a per-finding selection flag. Show the complete set
before the user decides; do not present the command as a single-item acceptance.

## Store the decision

Commit `.zero-shelter/baseline.json` if CI should use it. Without a baseline,
CI compares against an empty accepted set. A baseline is optional; a project
may choose to keep all findings outstanding.

Entries are sorted and identify a package and advisory. Optional `reason`,
`acceptedBy` and `expires` fields document the decision. Do not infer an author
or rationale. Git history identifies a commit author; it does not prove who
accepted a risk when `acceptedBy` is absent.

Expiry dates use `YYYY-MM-DD`. An acceptance expires on that date and the
finding returns to the outstanding set. A new expiry is a new risk decision.
Before rewriting, preserve existing metadata and inspect the diff for loss;
[#247](https://github.com/zero-shelter/zero-shelter/issues/247) tracks metadata
and expiry loss when an entry matched through advisory aliases is rewritten.

## Maintain an existing baseline

After a fix, re-run `judge` and review accepted findings no longer reported.
Check that every earlier contributing scanner ran. “No longer reported” alone
does not prove remediation.

Rewriting can remove obsolete entries, but also accepts newly outstanding
findings. Explain both effects and get the user's decision before running
`--update-baseline`. Do not renew dates or recreate decision metadata merely
to clear the report.

A schema mismatch means the old baseline cannot be compared as usual.
Report the warning and review migration or re-recording with the user; it is
not evidence that all current findings are new regressions.

## CI and reporting

When CI reports old findings, show them and distinguish proposed fixes from
possible acceptances. A missing baseline is one possible cause, not proof that
the project has no security problem.

- Never use `--update-baseline` to finish a task or make a build pass.
- Never add automatic baseline updates to CI; that would accept new findings.
- Say “no longer reported” unless a comparable re-run confirms remediation.
- Keep human acceptance, agent assistance and automated test results distinct.
