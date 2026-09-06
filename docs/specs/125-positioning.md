# Feature specification: what this project is for, and the order it gets there

## Issue and lifecycle metadata

- Issue: [#125](https://github.com/zero-shelter/zero-shelter/issues/125)
- Target layer: docs, package, judgment
- Related spec: [`125-adoption-roadmap.md`](./125-adoption-roadmap.md), which fixes the work order and records the rejected designs. This one fixes the position and the horizons around it.

A positioning spec. It does not schedule implementation — each piece carries its
own spec before it is built. It exists because the roadmap answered *what to
build next* without ever answering *what this is*, and because a measurement
taken while writing it contradicted the sentence the project leads with.

Every number below was produced offline from committed fixtures and can be
re-derived; the command is given where it is not obvious.

## The position

zero-shelter is a local judgement layer over dependency-scanner output. It takes
what `npm audit`, `pnpm audit` and `osv-scanner` found, reconciles reports that
describe the same advisory, produces one short ranked list, prints the
arithmetic that produced the order, and **states the boundary of its own
claim** — what it examined, what it did not, and what it declined to count.

It is for the person who has to answer for a repository to somebody else: a
reviewer, a customer questionnaire, an on-call handover, a maintainer six months
later.

The sentence it should be able to say on every run, in the terminal and in
`--format json`:

> Two sources examined your npm dependencies. Nothing here looked at your
> Dockerfile, your workflows or your git history. Here are the five things to do
> and every point that ranked them. Here is the one count it refused to give
> you, and why. Here is what a scanner that fed your baseline stopped reporting,
> so "disappeared" is not read as "fixed".

A vendor cannot say it because every clause subtracts from the number they sell.
`PRODUCT.md` states the structural reason we can: *"Everything here is a
judgement layer, not a scanner."*

**The record is grafted in, not dropped.** A judgement whose limits are written
down and a decision whose owner and expiry are written down are the same asset
at two moments. The baseline is the durable form. It is unbuilt: `grep -rn --
"--accept\|--reason\|--expires" src/` returns nothing, and `baselineFrom` only
carries those fields forward from an entry a human wrote by hand. **The write
path is the largest single build in Horizon 1.**

## Why it holds

**It is structurally unavailable to anyone who sells a number.**
[`125-adoption-roadmap.md`](./125-adoption-roadmap.md) is a published record of
this project measuring its own attractive ideas to death. The posture score
scored −29 as shipped, +3 after `--update-baseline`, +15 after documenting those
acceptances, and +15 after fixing every vulnerability — accepting everything and
fixing everything landed on the same number. On NodeGoat the swing was +2,635
for writing three strings against +15 for fixing a critical. Installing the
second scanner, the behaviour the product exists to encourage, cost −590 on
juice-shop. A company whose product is that number cannot reprint that page.

**The verdict is re-derivable off the machine that produced it.** Five
invariants, `WEIGHTS` frozen and printed by `--explain`, and CI asserting fixed
fingerprints on Linux, macOS and Windows. Traceability is what we can offer;
comparability is what nobody can, because the input is
`(tree × scanner set × advisory DB state × clock)` and three of those four are
not in the commit.

**The admissions are asymmetric.** Naming an unexamined domain costs us nothing
and costs a vendor a renewal.

**What would break it.** Somebody shipping a reconciler with the same refusals
and a larger corpus. The corpus is the part that cannot be bought — see
Horizon 2 — and it is currently empty.

## What the measurement changed

While writing this, the third column nobody had run was run. Every published
comparison is **npm audit alone** against **npm audit + osv-scanner**. The
missing column is **osv-scanner alone**. Findings carrying a fixed version:

| repo | npm audit alone | osv-scanner alone | both |
|---|---|---|---|
| nodegoat | 7 / 177 — 4% | **109 / 173 — 63%** | 109 / 173 — 63% |
| juice-shop | 15 / 73 — 21% | **49 / 82 — 60%** | 50 / 82 — 61% |
| dvna | 20 / 51 — 39% | **38 / 51 — 75%** | 40 / 51 — 78% |
| hackathon-starter | 0 / 11 — 0% | **4 / 11 — 36%** | 4 / 11 — 36% |

Adding npm audit to osv-scanner moves coverage by 0 to 3 points. And npm audit
contributed **zero findings that osv-scanner did not also report**, on all four
captures. The `155 → 82` row reduction is real arithmetic, and the 82 is exactly
what osv-scanner alone produces.

What reconciliation measurably did: on nodegoat, osv-scanner's alias sets joined
**four** groups of npm findings that npm alone kept apart — 177 merged alone,
173 with both.

**This does not invalidate the position; it corrects an attribution.**
`PRODUCT.md`'s *"the second source is the premise, not an optional extra"* is
misattributed — the transformation is osv-scanner's advisory data, not the join.
Tracked in [#216](https://github.com/zero-shelter/zero-shelter/issues/216).
Reconciliation is demoted from premise to one mechanism among several, and the
position does not depend on it: ranking, the boundary statement, the refusals
and the record are all independent of how many scanners ran.

It also raises the value of [#126](https://github.com/zero-shelter/zero-shelter/issues/126).
Two tools drawing on overlapping databases is the worst case for reconciliation.
A pair with genuinely disjoint sources may look completely different, and the
survey is what tells us.

## What is missing

Ordered by what blocks what. **Blocking** means the position cannot be stated
honestly until it is done.

| | gap | why | issue | size |
|---|---|---|---|---|
| B1 | The README opens with a console block the tool cannot produce | Four independent contradictions on the first thing anyone reads, in a repository whose every other claim re-derives | [#213](https://github.com/zero-shelter/zero-shelter/issues/213) | hours |
| B2 | The headline numbers come from a repository the benchmark does not pin | uptime-kuma is not in `bench/repos.json`; nothing here can re-derive the front page | [#149](https://github.com/zero-shelter/zero-shelter/issues/149) | hours |
| B3 | The second-source claim is misattributed | Above | [#216](https://github.com/zero-shelter/zero-shelter/issues/216) | hours |
| B4 | No threat model for running on a tree the operator did not author | The scanned repository's `.npmrc` redirects the subprocess we spawn, and can interpolate an auth token into it. "No network calls of our own" is accurate and narrower than it reads | [#217](https://github.com/zero-shelter/zero-shelter/issues/217) | hours |
| B5 | The tool cannot say what it did not look at | The position's central sentence is unimplemented | [#168](https://github.com/zero-shelter/zero-shelter/issues/168) | days |
| B6 | Machine-readable output does not carry the refusals the terminal carries | An agent reporting "clean" inherits the gap | [#205](https://github.com/zero-shelter/zero-shelter/issues/205), [#208](https://github.com/zero-shelter/zero-shelter/issues/208), [#122](https://github.com/zero-shelter/zero-shelter/issues/122) | days |
| B7 | Nothing writes a decision. `--accept`, `--reason`, `--expires` do not exist | The record half of the position is a file format with no writer | none — file it | weeks |

Improvements, not blockers:

| | gap | issue |
|---|---|---|
| I1 | 92 issues, 3 authors, all owners. No outsider has ever filed one | [#215](https://github.com/zero-shelter/zero-shelter/issues/215) |
| I2 | Every external pull request waits on a human to start CI; measured 7m to 16h11m | [#214](https://github.com/zero-shelter/zero-shelter/issues/214) |
| I3 | Not importable. No `main`, `exports` or `types` — `require.resolve` fails | none — file it |
| I4 | No `action.yml`. CI is a primary use case and there is no Action, only a copy-paste snippet | none — file it |
| I5 | The labelled corpus is 790 lines of `*.template.tsv` with zero rows filled | [#22](https://github.com/zero-shelter/zero-shelter/issues/22) |
| I6 | `require_code_owner_reviews` is on with no `CODEOWNERS` on `main`, so it matches nothing | [#202](https://github.com/zero-shelter/zero-shelter/pull/202) |
| I7 | The non-npm defect axis | [#188](https://github.com/zero-shelter/zero-shelter/issues/188), [#204](https://github.com/zero-shelter/zero-shelter/issues/204), [#137](https://github.com/zero-shelter/zero-shelter/issues/137), [#139](https://github.com/zero-shelter/zero-shelter/issues/139) |

## How contributions get received

**What the record actually says.** Six external contributors, all via pull
request. Two of the six came from labelled issues — [#162](https://github.com/zero-shelter/zero-shelter/pull/162)
fixed #159, [#177](https://github.com/zero-shelter/zero-shelter/pull/177) fixed
#165 — so the labelled-work funnel converts. Three of six touched non-doc files.
And the domain table in `skills/setup/SKILL.md`, which this project treats as a
core asset, **was written by an outside contributor**.

The funnel that has never produced anything is issue reporting: zero of 92.

**What changes.**

- The intake door opens (#215). The forms stay — they are part of why the issues
  here are good — and a fifth low-friction form is added for the person who
  cannot classify their own problem.
- The CI approval gate gets written down (#214), in `CONTRIBUTING.md` and above
  the pull request template's thirty checkboxes rather than inside them.
- The labelled corpus (#22) opens as a contribution track. Filling a judgement
  row needs no repository knowledge, and it is the asset the position rests on.
- The scanner survey (#126) stays open as stated: one row, done carefully with
  real pasted output, is a complete contribution.

**What stays.** One approving review with admins included, the seven required
checks, and the spec requirement waived for small changes as it already is in
practice.

**What the owners must not delegate.** The invariants. What gets rejected and
why. Anything that changes the fingerprint recipe or `WEIGHTS`. The decision to
publish. Every one of those is a promise this project has made in writing, and
a promise cannot be reviewed by the person making it for the first time.

## How it expands

**Horizon 0 — find out whether anyone outside has run it.** The whole plan below
is triggered by outsider behaviour, and there is no evidence any stranger has
ever run this tool on a repository the team has not seen. There is no telemetry
by design, so adoption is unmeasurable by construction. Horizon 0 is accepting
that and choosing proxies: issues opened by outsiders, forks that diverge,
questions that describe a tree we did not choose.

*Trigger:* one such signal.
*Stop and reconsider if:* ninety days after the intake door opens, there is
still nothing. Then the door was not the constraint and the reader hypothesis in
#125 is what is wrong.

**Horizon 1 — make the claim true where it is currently false.** B1 through B7.
Add `exports` and `types` (I3) and `action.yml` (I4) now rather than later:
both are cheap today and become breaking changes once anyone depends on the
current shape. Release 0.0.10 and 0.0.11.

*Trigger to Horizon 2:* the first issue opened by someone who is not an owner.
*Stop and reconsider if:* B7's write path turns out to need a schema change to
the baseline. Then it is a format decision and freezing the format comes first.

**Horizon 2 — make the claim true on trees we do not run.** The non-npm axis
(I7), then `#156`'s lockfile readers, then `#163` so the boundary line names
what *this* tree implies. Open #22 as a contribution track. Behind that, the
survey (#126, #166), then #128, then #129.

*Trigger to Horizon 3:* an adapter manifest merged that no owner wrote, with its
own fixture and test.
*Stop and reconsider if:* fewer than two surveyed scanners put package name
**and** fixed version somewhere machine-readable in SARIF — then #128 is N
parsers rather than one reader, and the adapter horizon is abandoned rather than
attempted. **Also stop if #22's holds come back mostly labelled *same*:** that
is a correctness debt in the join, and it outranks expansion.

**Horizon 3 — the verdict becomes a document other systems read.** #138,
OpenVEX out, with two absolute refusals: never infer a justification, never emit
a statement with no human author. Then #172, narrowed to `osv-scanner.toml`,
with the list of fields that did not survive as the load-bearing part. #194 for
provenance.

*Alongside it, not after:* a Maintainer promotion path. `GOVERNANCE.md` defines
the rank and nobody holds it. Three part-time approvers is the bottleneck the
moment the intake door works, and widening the entrance without widening the
exit produces a queue rather than a community.

*Stop and reconsider if:* the VEX consumers we would emit for do not read the
fields we care about. Emitting a document nobody reads is worse than not
emitting one.

## What this is not

Restated so it does not get proposed again. The measurements are in
[`125-adoption-roadmap.md`](./125-adoption-roadmap.md) under *Rejected designs*.

- **A posture score as a single number.** Accepting everything and fixing
  everything scored the same.
- **A badge carrying that score.** Same arithmetic, wider blast radius.
- **A public leaderboard.** Ranks the willingness to run `--update-baseline`.
- **A coverage percentage.** Maximised by narrowing what you look at.
- **Per-project weights.** `--explain` prints the table; a table the reader can
  edit is one the printed explanation no longer describes.
- **A second suppression mechanism outside the baseline.** Two places to look
  when something is missing. Note that
  [#130](https://github.com/zero-shelter/zero-shelter/issues/130) and
  [#131](https://github.com/zero-shelter/zero-shelter/issues/131) propose
  `minimumSeverity` and `ignoreScopes` in a policy file, which is this
  mechanism under another name. They are open and unreconciled with this rule;
  that contradiction is the point of naming it here.
- **Inferring a VEX justification.** A false non-exploitability assertion in a
  document other people act on.
- **Reachability.** Nothing here knows whether the vulnerable code runs.

Any new proposal must survive the standing test: **what does it look like when
someone optimises for it instead of for security?**

Three tickets currently contradict this section by existing:
[#133](https://github.com/zero-shelter/zero-shelter/issues/133),
[#134](https://github.com/zero-shelter/zero-shelter/issues/134) and
[#135](https://github.com/zero-shelter/zero-shelter/issues/135) are open with
live scope checklists for the posture score, the badge and the leaderboard. They
carry `wontfix` as of 2026-09-06. Either close them with the measurement in the
closing comment, or say in the body that they are a record rather than a plan.

## Decisions this team owes itself

Not questions for anyone else. Each is a fork where the project goes somewhere
different depending on the answer, and none has one.

1. **Does #216 change the pitch, or does #126 change #216?** If a scanner pair
   with disjoint databases shows large unique contributions on both sides,
   reconciliation is the premise after all and this corpus was the wrong pair to
   measure it on. Filling one survey row is cheaper than rewriting the front
   page twice.
2. **Is the reader in #125 real?** They were reasoned about, not observed.
   Everything downstream rests on that description and it has never been checked
   against a person.
3. **Is "ease" the right target at all?**
   ([#212](https://github.com/zero-shelter/zero-shelter/issues/212))
   `PRODUCT.md` names alarm design and cheerful emptiness as failure modes.
   There may be a third — a tool that successfully reassures someone who should
   not be reassured — and there is no test for it.
4. **Does the boundary line appear on every run or only a clean one?**
   (#168) A line that is always there is a line nobody reads; a line that
   appears only on success reaches the reader on the day it matters least.

## Decision log

- 2026-09-06 — Position chosen. Five theses were drafted and scored by three
  reviewers on different criteria: defensibility ranked the decision-record
  position first, evidence and contributor-funnel both ranked the
  boundary-statement position first. Taken as written above, with the record
  grafted in as Horizon 1's largest build, because the boundary evidence exists
  in the code today and the record's does not.
- 2026-09-06 — The osv-scanner-alone column was run for the first time and
  contradicted the second-source attribution. Recorded above and in #216 rather
  than quietly rewriting `PRODUCT.md`.
- 2026-09-06 — Horizon 0 added after noticing that every trigger in the plan
  depends on outsider behaviour that has never been observed.
