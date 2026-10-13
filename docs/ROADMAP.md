# Product roadmap

[한국어](./ROADMAP.ko.md) · [Product](../PRODUCT.md)

Snapshot: 2026-09-08. Released: v0.0.10. Evaluated main:
`b6908306acde9bd6c8d9c9154ce506802c82ecea`. This proposal is for
Owner review under [#249](https://github.com/zero-shelter/zero-shelter/issues/249),
not a promise of dates or an assertion that open features have shipped.

## Intended workflow

The planned workflow should help a developer answer these questions:

1. What should this project check, and what remains unknown?
2. Which action is supported by the current evidence, and why?
3. Did the next comparable run stop reporting it, or was it accepted/skipped?
4. Which previous decisions need attention now?

The current product supports question 2 for dependency reports. Project-specific
setup and a decision review queue remain incomplete. Run comparison exists, but
#247 and #248 identify defects in decision metadata and source provenance. The
order below addresses those defects before expanding scanner inputs.

## Current state

| Capability | v0.0.10 release | Later main / work in progress | Gap to the goal |
|---|---|---|---|
| Dependency judgement | Supported npm/pnpm audit and OSV ingestion, reconciliation, deterministic ranking, direct/transitive advice | No new scanner integration since release | Lockfile support #156; ecosystem-aware remedies #188; unknown severity #137 and corroboration ordering #139 require decisions |
| First-run setup and scope | Static setup skill; dependency-focused judge | #163 spec merged in #237, command **not implemented**. #246 implements #168 but changes requested on artifact/symlink detection | Project-specific suggestions; honest clean-run boundary without false artifacts |
| Source comparability | Terminal source notes; run history counts | #245 adds JSON missingSources; #244 adds SARIF package/scanner versions; #239 qualifies benchmark prose | Empty stored reports lose source identity (#248); per-project attribution #142 |
| Decisions over time | Baseline metadata, alias matching, expiry, history | #247 reproduces metadata/expiry loss on rematch rewrite | Preserve decisions first; expiry queue #141, named deltas #167, ongoing next steps #193 |
| Explain the actionable path | Upgrade commands where supported; --explain weights | No `why` subcommand | #140 requires path/version evidence and explicit manager limits |
| Extensibility | Scanner collection wired in source; SARIF output | No generic adapter manifests or SARIF input | Survey #126/#166, then #128/#129; non-dependency finding contracts #99 |
| Validation | Release and reviewed main passed their recorded test and install checks | No measured time-to-action, comprehension or retention study | Proposed usability checks below; human-labelled benchmark #22 |

Treat release, merged implementation and approved specification as distinct
states. Close a feature tracker only when its implementation scope is delivered.
The checks above cover tested behavior; they do not establish project safety.

## Ordered delivery

GitHub `roadmap: now`, `roadmap: next`, and `roadmap: later` labels express
sequence. They do not replace lifecycle labels, assign an implementer, reserve a
release date or approve a contract change. Keep exactly one lifecycle label.
Unassigned work needs a contributor claim before implementation; existing owners
keep their assignments. A design-dependent bug is not a good first issue merely
because its patch might be short.

### Now: source and decision reliability, first-run guidance

**Outcome:** a developer can distinguish checked dependencies from unexamined
domains and follow project-specific setup advice without losing existing risk
decisions.

- Repair acceptance metadata/expiry on rematch rewrite (#247) and stored-report
  source identity (#248). Both affect the reliability of comparisons.
- Resolve scanner/network trust wording (#217). Review unknown severity (#137)
  and corroboration ordering (#139) before changing judgement rules; do not
  silently retune scores while implementing onboarding.
- Finish the opt-in `scanners` command against the reviewed #163 spec. This is
  the proposed next feature release.
- Complete #168/#246 after artifact-type and symlink regressions are covered.
- Address focused output defects #198/#218 and align product documents in #249/#250. The public writing and report
  presentation review is tracked separately in #251.

**Release gate:** provisionally target **0.1.0** for #163 + #168 after #247/#248
and the relevant #217 boundary are resolved. Require reviewed specs, bilingual
examples, supported-platform and packed-command QA, no invented coverage claim,
and an initial consented usability check. If feature readiness slips, a smaller
patch can carry independently reviewed fixes; no date or automatic publish is
promised. #137/#139 may ship independently only after their invariant decisions;
open limitations must be explicit rather than hidden by the release label.

### Next: reviewing earlier decisions

**Outcome:** the maintained decision record becomes a review queue.

- #141 expiry-ahead report depends on #247's preservation semantics.
- #167 names changed findings; #193 provides ongoing next steps from existing
  facts, without interpreting every disappearance as remediation.
- #140 dependency path/`why` starts with an explicit supported lockfile scope;
  #156 expands manager evidence rather than inventing unsupported install advice.
- #142 shows the marginal information supplied by each source on this project.
- #130 policy can follow a reviewed contract. #131/#132 depend on that policy
  and reliable decision data; they remain later work until those prerequisites.
- Contributor/document clarity: #188, #149, #216, #213, #215, #214, #146 and #212.
  These are not all release blockers. #214's fork-CI documentation was delivered
  in #220; the repository-policy decision remains separate.

**Gate:** maintainers can trace queue entries to the original decision, owner,
reason, expiry and comparable source evidence; unsupported ecosystems say what
is missing. The pilot must exercise a return visit, not only a first installation.

### Later: additional inputs

- #126/#166 surveys establish inputs; #128 SARIF input and #129 adapter manifests
  require explicit command execution and trust-boundary design.
- #99 establishes finding-class semantics before non-dependency ingestion.
- #138 OpenVEX needs human-authored assertions; #171/#172 import/synchronization
  must preserve decision ownership and reconcile conflicting suppressions.
- #131/#132 policy deadlines and guided policy creation follow #130.
- #109 KEV requires a separate data freshness/network decision.
- #134 remains a deferred scoped badge proposal. It is **not** marked wontfix.
- #32 wording review and #22 human benchmark labelling remain tracked separately.

Excluded: posture score #133 and public leaderboard #135. The historical
roadmap records the reasons for rejecting both.

## What changed from the previous roadmap

The [#125 design](./specs/adoption-roadmap.md) remains the record of interface
ideas and rejected designs. Its instruction to start with #140/#136 is historical:
#136 shipped, while #247/#248 expose current reliability gaps and #163 provides
the chosen next feature. This document owns current order. Existing detailed
specs continue to own interfaces; conflicting proposals require an explicit
Owner decision before code changes.

PR #250 replaces the unmerged positioning proposal #219. It keeps current
product capabilities in PRODUCT and delivery order here, and corrects #219’s
classification of the deferred badge #134 as rejected work. #251 updates the
wording and public presentation without changing those product decisions.

## Maintenance and acceptance

At each release, update the released/main/spec/PR matrix from tags and merged
code, and verify the next feature's dependencies. On issue triage, remove stale
lifecycle labels, keep assignees accurate, and close only delivered scope or a
recorded rejection. Priority does not mean somebody is implementing it.

Before merging this strategy update: Owner review of the target
user, now/next/later order and proposed usability checks; maintainer check of links
and delivery claims. Before implementation: the linked issue/spec and the usual
source/test/security review. Runtime telemetry, new execution behavior, baseline
invariants and publication are never approved merely by appearing on this page.

## Proposed usability checks

These checks are proposals for future evaluation, not completed user research.
Collect observations with consent, without adding product telemetry or runtime
network behavior.

| Question | Proposed evidence |
|---|---|
| Can a first-time user find a next step? | Five maintainer sessions; at least four identify a supported action or concrete evidence gap without coaching within five minutes. Record failures and sample size. |
| Is advice supported? | Fixtures and package smoke tests cover commands, unsupported targets and remediation-count limits. |
| Does the user understand the scope? | In the same sessions, at least four distinguish dependency judgement from whole-project security and tool presence from an executed scan. |
| Are decisions preserved? | Regression tests preserve identity, author, rationale and expiry; missing sources qualify comparisons. |
| Does a return visit help? | An expiry/changed-findings pilot produces a queue whose entries maintainers can trace and explain. |

Do not claim retention or time-to-action improvements before measurement.
Finding counts, stars and baseline acceptance alone do not establish success.
