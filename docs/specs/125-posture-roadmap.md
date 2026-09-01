# Feature specification: extensible scanners and a publishable posture

## Issue and lifecycle metadata

- Issue: [#125](https://github.com/zero-shelter/zero-shelter/issues/125)
- Target layer: ingest, judgment, package
- Related PR:

This is a roadmap spec. It fixes the shared decisions and the order; each piece
carries its own spec at `docs/specs/<issue>-<slug>.md` before it is implemented.

## Problem

Three limits, each checkable against the source as it stands.

**The scanner set is source code.** `src/scan.ts` names `npm audit`, `pnpm audit`
and `osv-scanner` in its body, and decides which to run from `existsSync` calls
in the same function. A fourth scanner requires editing our file, our test, and
shipping our release. Nobody outside this repository can add one, and nobody
inside it can add one quickly.

**The judgement is already ecosystem-agnostic and nothing uses it.**
`finding.ts:44` declares `ecosystem` as an unconstrained string, and
`ingest/osv.ts:56` passes through whatever osv-scanner reports. PyPI, Go and
crates.io findings survive normalize, merge, triage and baseline unchanged. The
walls are at collection and at remediation — `lockfile.ts` and
`package-manager.ts` know only the npm world — not in the middle.

**A project cannot state what it cares about, and cannot state how it is doing.**
There is no configuration of any kind; `grep -rn "config\|policy" src/*.ts`
returns nothing. Every project gets the same `WEIGHTS` and the same report, and
when the reader closes the terminal nothing survives that another person could
check.

## Goal

### Anyone can add a scanner without our permission

A scanner becomes a JSON manifest naming a command, the files that imply it is
relevant, and the wire format it emits. Manifests load from two places: the
`adapters/` directory shipped in the package, and `.zero-shelter/adapters/` in
the reader's own repository. The first is the contribution path; the second
means a reader never waits on our release cycle.

The measure of success is the size of a contribution. Adding `trivy` should be a
manifest, a captured fixture and a test — reviewable by someone who has never
read `src/scan.ts`.

### Anyone can state what their project cares about, by talking rather than reading

A policy file records a minimum severity to report, scopes to exclude, and a
deadline per severity band. An agent writes it during setup by asking questions;
`judge` only ever reads it. The file is committed, so it is reviewed in a pull
request and its history is a diff.

This is the honest form of "manage by schedule and severity": severity becomes a
deadline, and a deadline can be missed, which is a fact the report can state.

### Anyone can publish where their project stands, and anyone can check the claim

A posture score — integers, one exported table, every term labelled — becomes a
badge file the project serves from its own Pages, and optionally a leaderboard
entry whose claim our CI re-derives from the named commit before accepting it.

Success is that the number is arguable. A reader who disagrees should be able to
point at a line of the table rather than at the score.

## Scope

### Included

1. Adapter manifests and a loader; SARIF as an input format
2. A policy file: minimum severity, scope exclusion, deadlines per severity
3. A posture score: integer rule table, `--explain`, `--as-of`
4. `zero-shelter badge`: a shields.io endpoint file
5. A leaderboard on GitHub Pages: entries as pull requests, verified by re-derivation

### Explicitly excluded

- **Per-project weights.** `WEIGHTS` stays frozen. If a policy could change it,
  no two scores would be comparable and pieces 3, 4 and 5 would all be
  meaningless.
- **Per-finding suppression in the policy file.** That is what the baseline is
  for, and it already carries a reason, an owner and an expiry. Two suppression
  mechanisms would mean two places to look when something is missing.
- **A hosted service.** Pages serves static files built from the repository.
  Nothing to operate, no account to hold, no data of anyone else's to keep.
- **Private repositories on the leaderboard.** We cannot re-derive a score for a
  tree we cannot check out. They get the badge, which makes no comparative claim
  and so needs no verification.
- **Reachability.** Unchanged from `AGENTS.md`: nothing here knows whether the
  vulnerable code path is reached.

## Interface

### Adapter manifest

```json
{
  "id": "trivy",
  "detect": ["package-lock.json", "go.mod", "requirements.txt"],
  "command": "trivy",
  "args": ["fs", "--format", "sarif", "--quiet", "."],
  "format": "sarif",
  "versionArgs": ["--version"],
  "install": "brew install trivy, or https://github.com/aquasecurity/trivy/releases"
}
```

`format` is one of `osv`, `sarif`, `npm-audit`. `install` is prose shown when the
command is absent, following the wording `scan.ts` already uses for osv-scanner:
naming the way out rather than only the problem.

Built-in manifests load first, then `.zero-shelter/adapters/`. A user manifest
with an existing `id` replaces the built-in one, which is how a reader pins a
different flag without forking.

### Policy file — `.zero-shelter/policy.json`

```json
{
  "version": 1,
  "minimumSeverity": "moderate",
  "ignoreScopes": ["dev"],
  "deadlines": { "critical": 7, "high": 30, "moderate": 90, "low": 365 }
}
```

Deadlines are days from the advisory's `published` date, which `ScaFinding`
already carries verbatim from the source. A finding with no `published` has no
deadline; we do not substitute a date of our own.

`ignoreScopes` reads `lockfile.ts`'s `scopes`. `mixed` is never ignored — a
package that is a dev dependency here and a production dependency of something
we ship is a production dependency.

### Posture score

`zero-shelter score` prints the total and every term. `--explain` prints the
table. `--as-of YYYY-MM-DD` fixes the date expiry and deadline terms are measured
against; it defaults to today in UTC.

Straw table, to be argued in the score Issue rather than settled here:

| Term | Points | Applies |
|---|---|---|
| `sourceBeyondFirst` | +25 | per contributing scanner past the first, at most two counted |
| `baselineRecorded` | +10 | a baseline exists |
| `baselineSchemaCurrent` | +5 | it was written for the current fingerprint schema |
| `acceptanceUndocumented` | −3 | per acceptance missing `reason`, `acceptedBy` or `expires` |
| `acceptanceExpired` | −10 | per acceptance past its `expires`, as of the given date |
| `fixableOutstanding` | −15 / −10 / −4 / −1 / 0 | per outstanding finding with a named fix, by severity |
| `overdue` | −8 | per outstanding finding past its policy deadline |

Two properties are deliberate. **Documenting an exception earns nothing; failing
to document one costs.** Writing down why you accepted something is table stakes,
not an achievement, and scoring it positively would pay people per acceptance.
**Nothing is scored for the absence of vulnerabilities**, only for outstanding
findings a single command would resolve — so a project with a large inherited
backlog it is working through is not permanently ranked below a project with no
dependencies.

The score may be negative. That is information, and rounding it up to zero would
be the flattery `PRODUCT.md` forbids.

### Badge

`zero-shelter badge` writes the shields.io endpoint shape:

```json
{ "schemaVersion": 1, "label": "zero-shelter", "message": "65 · 3 sources", "color": "green" }
```

Colour comes from integer thresholds in the same exported table. We write the
file; the reader commits it and Pages serves it; shields.io fetches it from
them. No request leaves this tool.

### Leaderboard

An entry is `entries/<owner>-<repo>.json` added by pull request, naming a public
repository, a commit SHA, and the score being claimed. CI checks out that commit,
recomputes, and fails the pull request when the numbers differ.

## Architecture

| Piece | Files expected to change | Shared contracts touched |
|---|---|---|
| Adapters | `src/scan.ts`, new `src/adapters.ts`, new `src/ingest/sarif.ts`, new `adapters/*.json` | `Collected`, `skipped` wording |
| Policy | new `src/policy.ts`, `src/judge.ts`, `src/report.ts`, new `skills/policy/` | `JudgeResult` gains policy-derived fields |
| Score | new `src/posture.ts`, `src/cli.ts`, `src/report.ts` | `--format json`, `docs/STABILITY.md` |
| Badge | `src/cli.ts`, new `src/badge.ts` | new output format |
| Leaderboard | new `site/`, `.github/workflows/` | none in `src/` |

The score reads `Collected.contributed`, the baseline, the ranked findings and
the policy. It computes nothing that is not already in one of those, which is
what keeps it explainable.

### The risk in piece 1, stated plainly

SARIF is a findings container, not a dependency-vulnerability schema. It carries
a rule id, a level and a message; it does not carry a package name, a vulnerable
range, or a fixed version in any standard place. Tools that emit SARIF put those
in `properties` under names they chose, or in the message prose.

So "one SARIF reader unlocks every SARIF-emitting scanner" is a hypothesis, not
a fact, and it is the first thing to test. If it fails, the manifest is still
worth having — it removes the hardcoded command and detection logic — but each
scanner needs its own small parser, and the contribution stops being pure data.

This is why the survey is a prerequisite rather than documentation written
afterwards.

## Security and privacy

| Question | Answer |
|---|---|
| Protected data | None new. Findings are already public advisory data. |
| Trust boundary | An adapter manifest names a command to execute. This is arbitrary command execution by construction. |
| Network | Unchanged: none of ours. Manifests are never fetched. The badge file is written, never uploaded. |
| LLM | Authoring-time only. The policy skill writes a file; `judge` reads it. No model runs during a judgement. |
| Failure mode | Fail-closed for an unreadable manifest or policy: exit 2 with the reason, never a silent skip that reads as a clean run. |
| Opt-in | User adapters and the policy file are opt-in by existing. Absent means today's behaviour. |

The manifest's execution risk sits at the same level as `scripts` in
`package.json`: a file in your own repository, under your own review. Two rules
keep it there — manifests are never fetched over the network, and every run
prints which adapters contributed, so a manifest cannot run unseen.

Leaderboard verification checks out third-party repositories. **It must never
install their dependencies.** `npm audit` reads a lockfile and `osv-scanner`
reads files, so verification is read-only and never executes the code it scores.

## QA acceptance criteria

| Scenario | Expected result | Evidence |
|---|---|---|
| Normal input | A manifest for a present scanner runs it and its findings merge | fixture + parser test |
| Invalid input | Malformed manifest or policy exits 2 naming the file and the field | unit test per failure |
| Empty input | No manifests and no policy behave exactly as today | existing suite unchanged |
| Boundary | Score with zero sources, and with an expired acceptance on the expiry date itself | table-driven test |
| Existing behavior | `judge` output unchanged when no policy file exists | contract test |
| Security/privacy abuse | A manifest naming a command that does not exist is skipped with a note, not executed through a shell that resolves it elsewhere | test on the `capture` path |
| Determinism | The same commit and the same `--as-of` produce the same score on Ubuntu, macOS and Windows | CI matrix, as fingerprints already are |

## Agent notes

The score is not a thing to optimise on someone's behalf. Raising it by running
`--update-baseline` is the failure mode the design exists to prevent, and
`AGENTS.md` already forbids that command as a way to finish a task. If a score
looks low, name the term that cost the points.

Do not re-derive the score from the JSON. It comes from an exported table that
`--explain` prints, for the same reason ranking does.

## Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Adapters are declarative data | A code plugin API | A plugin runs inside our process and would need a runtime dependency to load. `osv.ts` also shows how much real parsing there is — a manifest expressive enough to describe it would become a language. |
| Manifests may be user-supplied | Built-in only | Built-in only means every new scanner waits on our release. The trust level is the same as `package.json` scripts, and it is stated rather than hidden. |
| Policy cannot change `WEIGHTS` | Per-project weights | Comparable scores are the whole premise of the badge and the leaderboard. |
| Policy has no per-finding excludes | Exclude lists in the policy | The baseline already suppresses per finding, with a reason and an expiry the policy would not have. |
| Score counts hygiene, not vulnerabilities | Counting outstanding findings | A count is maximised by accepting everything, which is the one command we tell people never to run for quiet. |
| Undocumented acceptances cost points; documented ones earn none | Rewarding documentation | Paying per documented acceptance pays per acceptance. |
| Deadlines run from `published` | From first observation | `published` is a fact from the source and already carried. First observation would need history we do not always have, and would reward late adoption. |
| The score may be negative | Clamping at zero | `PRODUCT.md` forbids decorating a number to make it feel better. |
| Leaderboard entries are pull requests | A submission endpoint | An endpoint is a network call, a service to operate, and no review. A pull request is none of those and is itself a contribution. |
| Verification re-derives the score | Trusting the claim | The tool is deterministic. Re-running is the cheapest possible check and it is the one the invariant already pays for. |
