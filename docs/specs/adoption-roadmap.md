# Feature specification: dependency paths, acceptance review and scanner adapters

[한국어](./adoption-roadmap.ko.md) · [Current roadmap](../ROADMAP.md)

This is the historical design for [#125](https://github.com/zero-shelter/zero-shelter/issues/125),
reviewed in [#127](https://github.com/zero-shelter/zero-shelter/pull/127). It records
proposed interfaces and rejected designs for the ingest, judgement and package
layers. Current delivery order and status belong to the roadmap; examples here
are proposals, not commands available in the released CLI.

Each feature needs its own reviewed spec before implementation. The review
rejected a composite posture score, a score badge and a public leaderboard.
The calculations and reasons remain in [Rejected designs](#rejected-designs).

Editorial correction, 2026-09-09: the earlier first-run description understated
single-source capabilities, the architecture summary incorrectly said no parser
was needed, and the privacy table described all finding data as public. These
claims are corrected below. Historical measurements are retained as recorded;
they were not re-measured for this edit.

## Problem and goals

The earlier product description emphasized reconciliation, which needs multiple
sources, without explaining that one supported source already supplies ranking,
remediation advice and baseline comparison. The proposed `why` command would add
dependency paths and explain the limits of the available version evidence.

Baseline entries can carry `reason`, `acceptedBy` and `expires` (#104).
At the time of this proposal, expired entries returned to the outstanding set,
but there was no advance expiry report. A review queue would show upcoming
expiries, owners and entries without an expiry so maintainers could revisit
those decisions before their deadlines.

Scanner selection was implemented directly in `src/scan.ts`. The proposed
adapter manifests would move command and input-format configuration into data.
Existing OSV ingestion carried other ecosystems, but collection and remediation
still had ecosystem-specific limits. A manifest alone could only add a scanner
when an existing parser could read its evidence.

The proposal also considered machine-readable acceptance export through OpenVEX.
That would require human-authored assertions; existing acceptance prose does not
establish whether a vulnerable path is reachable.

## Scope and work items

Included: dependency path explanation; valid expiry dates and advance review;
per-source attribution; adapter manifests and SARIF input; policy severity,
scope and deadlines; OpenVEX export; and a badge of documented-exception counts.

Excluded: a composite posture score, public leaderboard, per-project weights,
per-finding policy exclusions, inferred VEX justifications and reachability
analysis. `WEIGHTS` remains fixed. Per-finding acceptance stays in the baseline
so decisions do not split across suppression mechanisms.

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


The review also recorded independent judgement issues:
[#137](https://github.com/zero-shelter/zero-shelter/issues/137), where unbanded
advisories receive `info`, and
[#139](https://github.com/zero-shelter/zero-shelter/issues/139), where
`corroboratedPerExtraTool` can place a confirmed malicious package below a
ReDoS reported by multiple sources.

The original order started with #140 and #136 because they had no prerequisites
and expiry validation was needed by #141. That order is historical. #136 has
since shipped; use the current roadmap for sequencing. Scanner-specific adapter
issues were to follow #129 so contributors could start the work before it was
labelled `good first issue` (the concern in #91).

## Proposed interfaces

### `why`

Illustrative output, with synthetic advisory and dependency relationships:

```console
$ zero-shelter why tar
tar 6.2.0 — GHSA-xxxx, fixed in 7.5.22

  express 4.18.2 → send 0.18.0 → tar ^6
  cacache 17.1.4 → tar ^6

  4 dependents require ^6. The lockfile does not identify
  a direct-dependency upgrade that resolves this range.
```

`src/lockfile.ts` supplied `required: Map<string, Requirement[]>`, with
`Requirement` defined by `{ by, range }` and `by` identifying the dependent's
lockfile path. `blockedBy()` identified dependents retaining an old copy;
`version-range.ts` supplied `accepts()`, `lowestMentioned()` and `compare()`.

The lockfile records installed versions and requested ranges, not all published
versions of each parent. Name a candidate only when that evidence supports it.
Otherwise identify the blocking range and explain that a lowest direct upgrade
cannot be determined from this lockfile.

### Expiry report

Illustrative output:

```console
12 acceptances expire in the next 30 days
   8  alice      earliest 2026-09-14
   3  bob
   1  unassigned

 4 acceptances have no expiry at all
```

List entries without expiry separately. The original prerequisite #136 fixed
the shape-only `ISO_DATE` check (`/^\d{4}-\d{2}-\d{2}$/`): it accepted
`9999-99-99`, while `hasExpired` used lexical comparison. Such a date would
never enter the expiry window. Preserve that invalid-date regression case.

### Per-source attribution

Illustrative output:

```console
osv-scanner is the only source for 14 of 82 findings
   3 critical · 5 high · 6 moderate
npm audit is the only source for 2
66 are reported by both
```

Group `MergedFinding.tools` and test that the counts sum to `summary.merged`.
A single-source finding may reflect unique coverage or an incorrect report;
the attribution output cannot distinguish those explanations.

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

Proposed `format` values are `osv`, `sarif` and `npm-audit`. `install` supplies
installation guidance when collection cannot run. Load built-in manifests,
then `.zero-shelter/adapters/`. Sort by `id` before execution and normalize
ecosystem casing through `src/normalize.ts`.

### Policy file

```json
{
  "version": 1,
  "minimumSeverity": "moderate",
  "ignoreScopes": ["dev"],
  "deadlines": { "critical": 7, "high": 30, "moderate": 90, "low": 365 }
}
```

`ignoreScopes` uses lockfile scopes. Do not ignore `mixed`: it includes a
production dependency path even if another path is development-only.

Deadlines are days from an advisory's `published` date. In the reviewed
implementation only `src/ingest/osv.ts` set that field, so projects without
OSV input had no date evidence for deadlines. Report that gap; do not treat it
as compliance or use it in a cross-project score.

### OpenVEX export

| Baseline field | Proposed OpenVEX mapping |
|---|---|
| `reason` | Human-supplied structured justification plus supporting prose; free text cannot determine an enum value. |
| `acceptedBy` | Required `author`, subject to the export spec's authorship rules. |
| `expires` | No corresponding field in the reviewed OpenVEX model. |

The review considered these `not_affected` justifications:
`component_not_present`, `vulnerable_code_not_present`,
`vulnerable_code_not_in_execute_path`,
`vulnerable_code_cannot_be_controlled_by_adversary`, and
`inline_mitigations_already_exist`. Re-check the authoritative
[OpenVEX specification](https://github.com/openvex/spec/blob/main/OPENVEX-SPEC.md)
before implementation; the mapping here is a proposal.

The related OSV-Scanner request for expiry/export interoperability is
[#19](https://github.com/google/osv-scanner/issues/19), opened 2022-11-27.
The review compared OSV-Scanner's `ignoreUntil` with baseline ownership and
expiry. It proposed additive `--format openvex`, preserving existing formats.
Do not infer a justification from acceptance alone, or substitute the tool's
name for a required human author.

### Scoped badge

Illustrative badge:

```
zero-shelter | deps · exceptions: 12 documented, 3 not · 2026-09-02
```

The proposal reports documented and undocumented exception counts with the
`deps` scope and generation date. At the time of the proposal `FindingClass`
had one member (#99); a general security label or a coverage fraction would
overstate its scope.

Proposed `zero-shelter badge` output contains only `schemaVersion`, `label`,
`message` and `color`, rejecting other shields.io endpoint fields. It is a
maintainer self-report that can be edited manually, not an independent audit.
The original proposal excluded scheduled regeneration from recommended setup;
the committed date makes staleness visible.

## Architecture

| Piece | Files expected to change | Shared contracts touched |
|---|---|---|
| `why` | new `src/why.ts`, `src/cli.ts` | new subcommand beside `hook` and `history` |
| Expiry | `src/baseline.ts`, `src/history.ts`, `src/report.ts` | originally classified as none frozen; re-check current stability contracts before implementation |
| Attribution | `src/report.ts`, `src/html.ts` | additive JSON key |
| Adapters | `src/scan.ts`, new `src/adapters.ts`, new `src/ingest/sarif.ts`, new `adapters/*.json` | `Collected`, `skipped` wording |
| Policy | new `src/policy.ts`, `src/judge.ts`, new `skills/policy/` | additive `JudgeResult` fields |
| OpenVEX | new `src/openvex.ts`, `src/cli.ts` | new `--format` value |
| Badge | new `src/badge.ts`, `src/cli.ts` | new output format |


These features reuse judgement and lockfile data. SARIF input still requires
a parser and validation of scanner-specific fields. The proposal does not add
runtime network calls or fields to `ScaFinding`; individual specs must verify
whether their inputs fit that boundary.

### Determinism

In the reviewed merge implementation, `group[0]` supplied `ecosystem` and
`packageName`, and `first.ecosystem` contributed to the merged fingerprint.
Adapter execution order could therefore affect identity. Sort manifests by
`id` instead of relying on filesystem enumeration.

OSV ingestion lowercased ecosystems and npm audit used `"npm"`. A SARIF adapter
emitting `"NPM"` could prevent matching. Use shared normalization and test
shuffled adapter order for identical fingerprints on supported platforms.

### SARIF limits

SARIF carries rule identifiers, levels and messages, but dependency names,
vulnerable ranges and fixed versions are not consistently available in standard
locations. Scanners may put them in custom properties or prose. Survey #126
must establish which evidence can be read before a generic adapter is promised.
If a scanner needs a dedicated parser, a manifest can still describe its
command and detection rules.

## Security and privacy

| Area | Proposed requirement |
|---|---|
| Protected data | Advisory identifiers may be public, but package inventory, local paths and acceptance metadata can be project-sensitive. Review them in each feature's data flow. |
| Trust boundary | An adapter manifest selects a command to execute. Treat it as executable repository configuration. |
| Network | Do not fetch manifests or upload badge files. Invoked scanners retain their own documented network behavior. |
| LLM | A user-requested policy skill may author a file; `judge` reads the file without runtime LLM calls. |
| Failure | Unreadable manifests or policy exit 2 with a reason. Missing sources must be visible; a partial judgement can still exit 0 or 1. |
| Opt-in | User adapters and policy apply when their files are present. Without them, preserve existing behavior. |

Reviewing your repository's manifests does not make execution in a third-party
tree safe. The original leaderboard would have checked out those trees and run
the tool in CI, exposing credentials to repository-controlled commands.

Do not run the tool against an untrusted tree in an environment holding
credentials. Even without adapters, a local `.npmrc` can direct `npm audit`
to an attacker-controlled registry and reference an environment token.
Symlinked lockfiles or baselines can expose host files. Avoiding dependency
installation does not provide a sandbox.

OpenVEX statements make assertions others may use in security decisions.
Require the human author and justification specified by the export design.

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

`why` reads and explains a path; it does not install a version. A candidate
needs the user's evaluation. Renewing an expiry is a new acceptance decision;
never extend dates to empty the review queue.

Do not interpret a single-source finding as a likely false positive. #139
records confirmed malicious packages reported by only one source.

## Rejected designs

The following preserves the earlier review's calculations and objections.
The counts describe that proposed design and its recorded fixtures, not the
current product or newly executed benchmarks.

### Composite posture score (#133)

The draft used an integer rule table similar to `WEIGHTS`, printed with
`--explain`, to score maintenance practices. It failed in these cases:

| Case | Recorded result | Consequence |
|---|---|---|
| Four-finding fixture | Initial −29; after acceptance +3; after documenting acceptance +15; after fixing all findings +15 | Acceptance and remediation could produce the same score. |
| NodeGoat acceptance | +2,635 for filling decision strings, versus +15 for fixing a critical finding | Documentation dominated remediation. |
| Project size | Positive terms capped at +65; a 900-dependency project began around −3,900 | Unbounded finding counts dominated bounded process terms. |
| Additional OSV input | juice-shop −590, NodeGoat −1,451, dvna −351 | Additional evidence could lower the score. |
| Installed scanner change | Identical fixtures differed by 19 points and finding composition | The score was not determined by the commit alone. |
| Expiry deletion | Expired acceptance −10; missing expiry −3 | Removing the date gained 7 points. |

`fixableOutstanding` and `overdue` counted outstanding findings, which acceptance
removed. While `|acceptanceUndocumented| < |fixableOutstanding|`, acceptance
could improve the score without remediation; increasing the documentation
penalty instead reduced the design to a finding-count measure.

`sourceBeyondFirst` awarded +25 per additional scanner and charged up to −15
per fixable finding unique to it. The review recorded a 1.1-finding break-even
for its combined terms. Only three of seven terms were commit-determined;
others depended on PATH, advisory data or the clock. `published` came only
from OSV input, so the `overdue` penalty could not apply to npm-only input.

`acceptanceUndocumented` checked three strings for non-emptiness; bulk-filling
340 entries passed that condition. At low/info severity, ignoring a finding
could cost less than documenting it. Switching adapter format from OSV to
SARIF could remove `fixedIn` and `published` evidence, making the corresponding
penalties unavailable without falsifying fields.

The replacement proposal was separate measures: sources, outstanding findings
by severity, documented/undocumented acceptances and overdue decisions. Compare
only the same repository under the same declared source set, and refuse a trend
when that set changes. `history.jsonl` and `missingSources` provide relevant data.

Another recorded alternative was median days to remediation over a trailing
window, printing sample size and suppressing values below `n=5`. A repository
with no applicable advisories would show `no data`. This remained a proposal;
its data requirements and treatment of acceptance require separate validation.

### Public leaderboard (#135)

The draft accepted pull requests naming a public repository and commit SHA,
then re-ran the score in CI. It was rejected for four reasons:

- A score depended on the tree, scanner set, live advisory data and clock.
  A commit alone could not reproduce it. Pinning advisory data would require
  additional storage or network behavior beyond the proposal.
- Running repository-controlled manifests in CI exposed credentials. Disabling
  them for verification changed the scanner set being verified.
- Empty scan targets could repeatedly produce maximum scores while real
  projects changed as advisory data changed. Reproducibility did not validate
  the meaning of a score.
- A submitter could register another person's repository. Requiring a committed
  `.zero-shelter/leaderboard.json` could establish repository consent, but did
  not resolve the other problems.

The review also cited SecurityScorecard's move from public scorecards to Trust
Centers and OpenSSF Scorecard's warning about aggregate scores and changing
heuristics. Those comparisons supplied context; the rejection depends on the
reproduction and execution problems above, not on assumptions about those
organizations' motives or current products.

A separate suggestion was to list packages that block downstream remediation,
with related pull requests. It was not part of this implementation proposal.

### Cross-domain coverage score

The draft counted inspection of dependencies, secrets, containers, IaC, SAST
and CI/CD. With only one `FindingClass`, a fraction would remain `1/1` and say
little about broader coverage. #99 required finding-class semantics first.

Secrets also need different remedies and privacy handling: rotation rather
than a version upgrade, no routine acceptance of a live credential, and no raw
secret value in a committed fingerprint. The scoped badge therefore retained
`deps` and omitted a coverage fraction.

### Score badge and summed per-scanner scores

A badge file could contain any manually entered number. The draft provided no
independent verification for it. The reduced badge would state scope, counts
and date as a self-report. Summing per-scanner scores retained the aggregate
score's defects; per-scanner facts remained useful in #142.

## Decision log

| Decision | Alternative | Reason |
|---|---|---|
| Originally start with `why` | Lead with reconciliation | Add dependency-path evidence to the existing single-source features. Current order is in the roadmap. |
| Advance expiry report | Badge or leaderboard for repeat use | Reuse recorded decisions to identify upcoming review work. |
| Deadlines from `published` | First observation | Existing source evidence avoids requiring history; missing OSV dates remain an explicit limitation. |
| Declarative adapters | In-process code plugins | Separate command configuration from parser implementation and avoid a new runtime plugin loader. |
| Sort by `id`, normalize ecosystems | Filesystem order | Keep merged identity independent of execution order and casing. |
| OpenVEX export | Custom justification vocabulary | Use an existing format subject to a reviewed, human-authored mapping. |
| Do not infer VEX justification | Reachability heuristics | No reachability evidence is available. |
| Badge scope and date | Single score | Bound the claim to the inspected domain and recorded time. |
| Keep `WEIGHTS` fixed | Per-project weights | Preserve the shared ranking and explanation contract. |
| Retain rejected designs | Delete earlier proposals | Keep failure cases and calculations available for later review. |
