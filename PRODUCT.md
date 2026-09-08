# Product

[한국어](./PRODUCT.ko.md) · [Roadmap and delivery evidence](./docs/ROADMAP.md)

## Promise

**Know what to fix. Know what remains unknown.**

zero-shelter turns dependency scanner reports into explainable next actions and
keeps accepted decisions visible over time. It must also say where the evidence
ends. Fewer reports, an accepted baseline, or an installed scanner cannot prove
that a project is safe.

The broader ambition is to help a developer take responsibility for security:
understand what needs checking, choose an action with evidence, verify the next
run, and revisit decisions before they expire. The shipped product currently
addresses dependency findings. Project-specific guidance and a decision work
queue are roadmap work, not capabilities this sentence claims are available.

## Who and what job

The primary user is a developer responsible for a repository's security who
needs a practical next step, including a developer without a dedicated security
team. They may arrive with one scanner, several scanners, or no setup yet.
The first-run experience must help them reach usable evidence without requiring
that they already understand the scanner landscape.

The job is: **help me decide what to do next, explain why, and preserve what I
need to reconsider later.** The same developer returning next week is a core
user, not a separate reporting audience.

Maintainers reviewing a proposed dependency change and agents acting on the
user's behalf are secondary users of the same evidence. An agent consumes the
provided commands; it does not invent rankings or accept risk to quiet output.

## Value we can defend today

- Ingest supported npm/pnpm audit and OSV reports, reconcile identifiers, and
  rank findings with an inspectable weights table.
- Provide direct upgrade commands and separate transitive advice where the
  evidence supports them. Package-manager and ecosystem limits still apply.
- Record accepted findings and compare subsequent runs. Baseline metadata and
  expiry exist, but [#247](https://github.com/zero-shelter/zero-shelter/issues/247)
  shows that rewriting an alias-rematched acceptance can lose its decision data.
- Present evidence in terminal, JSON, HTML and SARIF, and retain run history.
  [The roadmap](./docs/ROADMAP.md#current-state) distinguishes released behavior
  from changes merged after the latest release.

One scanner can already yield ranking, supported remediation advice and a
baseline. A second source can supply additional findings or fixed versions and
can corroborate shared findings. Reconciliation is useful when sources overlap;
it is not the only source of value and does not imply greater precision.
The committed-capture comparison in [the benchmark](./bench/README.md) is
specific to those inputs. It is not evidence that every project needs the same
scanner combination or that every retained finding deserves action.

## Intended outcome and evidence

The outcome is a developer making and revisiting an informed action with less
manual interpretation. We do not currently have measured adoption or
user-outcome results. These are proposed validation gates, not achieved metrics:

| Question | Evidence to collect |
|---|---|
| Can a first-time user find the next step? | Five consented maintainer sessions; at least four identify a supported next action or a concrete evidence gap without coaching within five minutes. Report failures and sample size. |
| Is the action faithful to the evidence? | Fixture and package smoke tests for supported commands; no unsupported install target or claim that all copies are cleared. |
| Does the user understand the limit? | In the same sessions, at least four distinguish dependency judgement from whole-project security, and tool presence from a completed scan. |
| Do decisions survive another run? | Regression tests preserve identity, author, rationale and expiry across supported baseline transitions; missing sources qualify comparisons. |
| Is returning useful? | An expiry/changed-findings pilot produces a traceable review queue; observe whether maintainers can explain each item. No retention claim until measured. |

Collect pilot observations with consent. Do not add product telemetry or runtime
network behavior to obtain these measurements. Lower finding counts, stars and
a clean baseline are not success metrics on their own.

## Boundaries

- Dependency findings are the current judgement domain. No claim of complete
  SAST, secret, container, infrastructure or workflow inspection.
- No proof that a vulnerable path is reachable or unreachable; no inferred VEX
  justification, autonomous acceptance, or automatic deadline renewal.
- No composite posture score or public project leaderboard. Preserve the
  [recorded rejected designs](./docs/specs/adoption-roadmap.md#rejected-designs).
  [#134](https://github.com/zero-shelter/zero-shelter/issues/134), a scoped badge,
  remains a separate deferred proposal, not a rejected score.
- Local judgement, no runtime LLM or telemetry. Invoked scanners may use the
  network and repository configuration; local execution is not a sandbox.
  [#217](https://github.com/zero-shelter/zero-shelter/issues/217) tracks that
  documentation/trust boundary.
- Terminal/HTML wording may evolve; preserve the published
  [compatibility contract](./docs/STABILITY.md). A roadmap is not permission to
  change ranking, fingerprints, baseline semantics or security boundaries.

## Voice and presentation

Exact, quiet, and open to inspection. Lead with the next action and put the
reason beside it. Say **no longer reported**, not fixed, unless verified.
Say what ran and what did not. Do not turn absence of evidence into reassurance.

Terminal, agent JSON, HTML and SARIF are views of one judgement. Renderers do not
re-rank it. Use no alarm decoration, invented gauges, confetti or vendor upsell.
Severity must not depend on color alone; retain keyboard access, readable
contrast, reduced-motion support and layouts that accommodate translations.

## Ownership and change control

The Owner owns positioning and roadmap order; maintainers own issue triage and
release readiness. GitHub issue status and assignees remain the workflow source
of truth. [The current roadmap](./docs/ROADMAP.md) owns sequencing; detailed
specs own interfaces. Issue [#249](https://github.com/zero-shelter/zero-shelter/issues/249)
records this alignment and the review of the replacement for PR #219.
