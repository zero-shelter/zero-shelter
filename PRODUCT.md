# Product

[한국어](./PRODUCT.ko.md) · [Roadmap](./docs/ROADMAP.md)

zero-shelter turns dependency scanner reports into a ranked review list,
upgrade commands where supported, and a record of accepted findings. Developers
can act on the report directly or pass its commands and evidence to a coding agent.

## Users and workflow

The product is intended for developers responsible for a repository's dependency
security, including those without a dedicated security team. Maintainers use
the same evidence to review proposed dependency changes.

The workflow is to collect supported scanner reports, review the findings and
available remedies, apply an agreed change, then compare the next run. A
baseline records decisions to accept findings; history records changes between
runs. Neither substitutes for checking that the application still works.

The [README](./README.md) covers installation, direct use, AI integration and CI.

## Current capabilities

- Read supported npm/pnpm audit and OSV reports, merge shared identifiers, and
  rank findings using the weights printed by `--explain`.
- Provide direct upgrade commands and separate indirect dependency advice where
  supported. Package-manager, workspace and ecosystem limits apply.
- Record accepted findings and compare later runs. Entries support decision
  metadata and expiry. [#247](https://github.com/zero-shelter/zero-shelter/issues/247)
  records a known issue: rewriting an acceptance matched through an advisory
  alias can lose its metadata and expiry.
- Produce terminal, JSON, HTML and SARIF reports, and optionally record history.
  The [current-state table](./docs/ROADMAP.md#current-state) separates the npm
  release from changes merged later.

One supported source provides ranking, available remediation advice and
baseline comparison. Additional sources may contribute findings or fixed
versions, corroborate findings, and allow reconciliation of overlapping
identifiers. The [benchmark](./bench/README.md) measures these effects on pinned
captures; it does not establish ranking precision or a preferred scanner set
for every project.

## Limits

The current judgement domain is dependency vulnerabilities. The tool does not
provide complete SAST, secret, container, infrastructure or workflow inspection,
or determine whether a vulnerable path is reachable. It cannot infer a VEX
justification or decide whether the user should accept a risk.

A shorter report, an accepted baseline or an installed scanner does not prove
that a project is safe. “No longer reported” must retain any qualification about
missing sources. There are no measured adoption, time-to-action or retention
results yet; proposed usability work is in the [roadmap](./docs/ROADMAP.md).

Judgement is local, with no runtime LLM or telemetry. Invoked scanners may use
the network and repository configuration. See [Security](./SECURITY.md) for the
trust boundary and [#217](https://github.com/zero-shelter/zero-shelter/issues/217)
for the related documentation work.

## Presentation

Show what ran, which findings need review, the supported actions, and the reason
for each action. Keep warnings visible. Direct commands and agent prompts must
use the same remediation advice. Renderers must preserve the judgement's order
and unresolved possible duplicates.

Use concrete descriptions and reproducible examples. Distinguish completed
checks, estimates and missing evidence. Do not add a composite security score,
alarm decoration or celebration effects. Use severity labels as well as color,
keyboard controls, readable contrast, reduced-motion support and layouts that
accommodate translations.

Human-readable wording can change within the [compatibility contract](./docs/STABILITY.md).
Ranking, fingerprints, baseline semantics and security boundaries follow the
review requirements in [Governance](./GOVERNANCE.md).

## Product decisions

The Owner is responsible for positioning and roadmap order. Maintainers manage
issue triage and release readiness. GitHub issues track status and assignees;
[the roadmap](./docs/ROADMAP.md) records delivery order, and individual specs
define interfaces.

The project does not adopt a composite posture score or public project
leaderboard. The [historical design](./docs/specs/adoption-roadmap.md#rejected-designs)
records the reasons. The scoped badge proposal
[#134](https://github.com/zero-shelter/zero-shelter/issues/134) remains deferred
and is distinct from those rejected designs. [#249](https://github.com/zero-shelter/zero-shelter/issues/249)
records the product and roadmap review.
