# Governance

[한국어](./GOVERNANCE.ko.md)

This document defines how zero-shelter is maintained as an open-source project: decision rights, review boundaries, conflicts, and release responsibility.

## Roles

| Role | Responsibility | Authority |
|---|---|---|
| Contributor | propose, implement, test, document | open Issues and PRs |
| Reviewer | attack assumptions and verify evidence | request changes or approve within scope |
| Maintainer | triage, coordinate, merge normal changes | merge after required checks |
| Owner | protect architecture, security, API, and release policy | accountable for project direction and delegated scope |

Roles describe responsibility, not seniority. Reviews may be performed by the contributor or an authorized agent; a separate teammate approval is not required. `CODEOWNERS` does not automatically request reviews from every team member.

## Decision boundaries

| Change | Required decision |
|---|---|
| Documentation, tests, non-breaking implementation | documented review and required CI |
| New scanner/input or output integration | spec, QA, and affected-layer review |
| CLI/package API breaking change | explicit scope and compatibility decision |
| Fingerprint, deterministic scoring, or baseline invariant | documented design decision plus regression tests |
| Network, LLM, telemetry, secret, or personal-data behavior | explicit scope plus security/privacy review |
| npm publish or version release | explicit user authorization and release checks |
| Repository-wide governance | explicit requested scope and written rationale |

When a change crosses boundaries, satisfy every applicable requirement. Authorization for one change does not extend to new targets, permissions, or data flows.

## Delegated maintenance

The administrator requested removal of mandatory teammate approvals in [#267](https://github.com/zero-shelter/zero-shelter/issues/267). Authorized maintainers and agents may implement and review work within the explicitly requested scope without waiting for another team member. Required validation, security controls, and conflict resolution still apply.

An agent must obtain the user's explicit approval for the specific pull request before merging it. General maintenance or release instructions do not grant merge approval. GitHub retains the pull-request requirement and required CI, with no mandatory reviewer count or team assignment.

## Contribution lifecycle

```text
Issue → feature/security spec → focused branch → PR → QA evidence → review → merge
```

The Issue is the public problem statement, the spec is the behavior contract, and the PR is the implementation plus evidence.

## Workflow metadata

GitHub labels and assignees describe the current workflow without copying mutable state into specs:

- exactly one `status:*` label: `proposed`, `accepted`, `in-progress`, `blocked`, or `ready-for-review`;
- one or more `type:*` and `area:*` labels for discovery and triage;
- the Issue/PR assignee is the current human Owner;
- open/closed/merged is the completion state, so no redundant `status: done` label is used.

Maintainers own label hygiene. When a status changes, remove the old lifecycle label before applying the new one.

## Merge policy

A Maintainer merges only when the scope and affected layer are clear, required CI passes, QA evidence covers relevant failure modes, security/privacy impact is addressed, documentation is updated, and no unresolved review or ownership conflict remains.

A reviewer must be able to describe a failing input or explain what was tried and why no such input was found.

## Shared contracts and conflicts

Contributors must announce changes to shared contracts such as Finding fields/aliases/fingerprints, scores and baseline semantics, CLI options/exit codes/output schemas, hook payloads, and published package files.

If two changes touch the same contract, resolve incompatible interfaces before parallel implementation continues.

## Security and release

Security-sensitive work follows [`SECURITY.md`](./SECURITY.md). It must document protected data, trust boundary, data flow, retention, failure mode, abuse cases, tests, and user controls.

npm releases are deliberate external actions performed within the user's explicit release authorization by a maintainer or delegated agent. Before release, test, typecheck, build, package contents, CLI/hook smoke tests, version, compatibility, README, and translations must agree.

## Disagreement

Record decisions in the Issue or PR. If a choice changes an invariant, public contract, security boundary, or release policy, record alternatives and rationale in a short design note before implementation.

## Related documents

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`SECURITY.md`](./SECURITY.md)
- [`docs/feature-spec-template.md`](./docs/feature-spec-template.md)
- [`docs/qa-checklist.md`](./docs/qa-checklist.md)
- [`docs/qa/README.md`](./docs/qa/README.md)
