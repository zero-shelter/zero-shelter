# Contributing

[한국어](./CONTRIBUTING.ko.md)

This guide covers contributions to scanner inputs, judgement logic, output integrations, agent controls, tests, benchmarks, and documentation.

## Contribution process

Every change follows:

```text
Issue → spec → implementation → QA → pull request → review → merge
```

Describe the behavior, validation evidence, security impact, and documentation for a reviewer who did not write the change.

## Quick start

```bash
git clone https://github.com/zero-shelter/zero-shelter.git
cd zero-shelter
npm ci
npm test
npm run typecheck
npm run build
```

Node.js 20 or later is required. No database, service, API key, or runtime LLM is required.

## Start with an Issue

Before implementation:

1. Open or reference an Issue describing the problem.
2. Choose the smallest useful scope and change type.
3. Copy [`docs/feature-spec-template.md`](./docs/feature-spec-template.md) to `docs/specs/<issue>-<slug>.md`.
4. Record inputs, outputs, non-goals, affected layers, QA cases, and privacy impact.
5. Link the spec from the Issue and pull request.

Small documentation or test fixes may use the PR template directly. Features and security controls need a spec.

## Your first contribution

If you are new to the repository, start with a focused Issue rather than a
large refactor:

1. Browse [good first issues](https://github.com/zero-shelter/zero-shelter/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
   or [help wanted issues](https://github.com/zero-shelter/zero-shelter/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22).
2. Comment with the behavior you intend to change and wait for clarification
   when the scope or ownership is unclear.
3. Create one focused branch, make the smallest useful change, and add a
   fixture or regression test when behavior changes.
4. Run the checks in the [QA checklist](./docs/qa-checklist.md). For beta-facing changes, also
   follow the [Beta QA Guide](./docs/qa/README.md). Then open a PR using the template and include
   the evidence.

For fork PRs, GitHub may wait for a Maintainer to approve the first workflow run. If checks remain pending, leave a comment on the PR. Workflow approval allows CI to run; it is separate from approval of the change.

An agent may help with any of these steps, but the human contributor owns the
scope, correctness, and review of every changed file. Repository-local agent
rules are in [`AGENTS.md`](./AGENTS.md).

## Labels and assignees

GitHub metadata is the source of truth for workflow state:

| Metadata | Rule |
|---|---|
| `status:*` | Keep exactly one lifecycle label: `proposed`, `accepted`, `in-progress`, `blocked`, or `ready-for-review`. |
| `type:*` | Classify the change: `feature`, `bug`, `security-control`, `docs`, or `benchmark`. |
| `area:*` | Identify the affected area such as `ingest`, `judgment`, `agent`, `package`, or `docs`. |
| Assignee | Identify the current human Owner of the Issue or PR. |
| GitHub state | Use open/closed/merged for completion; do not add a redundant `status: done`. |

Contributors should mention the expected labels and assignee in the Issue. Maintainers apply or correct them when triaging. A status transition should remove the previous `status:*` label before adding the next one.

## Change types

| Type | Examples | Required evidence |
|---|---|---|
| Scanner/input | report shape, scanner adapter | fixture and parser tests |
| Judgement | merge, ranking, baseline | deterministic and adversarial tests |
| Output/integration | JSON, SARIF, CI, agent hook | consumer example and compatibility notes |
| Security control | privacy, redaction, policy | threat model and data-flow review |
| Benchmark | capture, label, evaluation | reproducible protocol and limitations |
| Documentation | README, guide, translation | fact and link verification |

## Feature specification

The spec is the contract between the contributor, reviewers, maintainers, and coding agents. It must cover the problem, included/excluded scope, interface, affected layer/files, compatibility, normal/invalid/empty/boundary cases, data flow, privacy impact, and decisions.

An agent may draft a spec, but the human contributor owns its accuracy and approves it before implementation.

## Definition of done

- Implementation matches the linked spec.
- Tests cover the new behavior and failure modes.
- `npm test`, `npm run typecheck`, and `npm run build` pass.
- User-visible behavior has manual QA evidence.
- Documentation and examples are updated.
- Security and privacy checks are complete.
- Affected files, interfaces, conflicts, and breaking changes are stated.
- A human Owner reviewed every changed file, including agent-assisted edits.
- No unrelated changes remain in the diff.

Use [`docs/qa-checklist.md`](./docs/qa-checklist.md) and the PR template.

## Security and privacy

Read [`SECURITY.md`](./SECURITY.md) before changing security behavior. Unless an Owner-approved design decision says otherwise:

- no runtime LLM calls;
- no project data, prompts, findings, or secrets sent to third parties by default;
- no secret values in logs, fixtures, benchmark captures, or reports;
- no undocumented network request or telemetry;
- security controls state fail-open/fail-closed behavior;
- privacy-sensitive behavior has adversarial tests.

Never put real secrets, personal data, internal URLs, or undisclosed vulnerabilities in public Issues, PRs, fixtures, or captures.

## Branches, commits, and PRs

Use one logical change per branch and PR:

```text
feat/<issue>-<slug> | fix/<issue>-<slug> | security/<issue>-<slug>
docs/<issue>-<slug> | test/<issue>-<slug>
```

GitHub calls them pull requests; the same rules apply on a platform that calls them merge requests.

Use English commit messages in the organization format:

```text
<type>(<scope>): <short summary>

Refs #123
```

Use `Fixes #123` only when the merged change should close the Issue. Keep the PR focused.

## Review

A reviewer must describe an input that breaks the change before approving it.

Try a failing input, inspect the changed boundary, and state what was checked. Security-control changes also require review of data flow, logs, subprocesses, permissions, and failure behavior.

At least one Maintainer must approve a merge. Owner approval is additionally required for public API breaking changes, deterministic/fingerprint invariants, new network/LLM/telemetry/data-retention behavior, npm release, and repository-wide governance changes.

## Validation commands

| Command | Purpose |
|---|---|
| `npm test` | test suite |
| `npm run typecheck` | TypeScript check |
| `npm run build` | build `dist/` |
| `npm run third-party` | regenerate notices |
| `npm pack --dry-run` | inspect package contents |
| `npm run qa:agent` | exercise the hook, five skills, HTML prompts, and plugin manifest |

## Language and related policies

English is canonical. Korean translations should link to the English source and be updated with behavior changes.

Skill bodies (`skills/*/SKILL.md`) stay English. Put Korean request phrases in the frontmatter `description` so agents can match requests in Korean and respond in the user's language:

```yaml
description: ... Korean requests look like: 의존성 취약점 점검해줘, 보안 스캔 돌려줘.
```

- [`GOVERNANCE.md`](./GOVERNANCE.md) — Owner and Maintainer responsibilities
- [`SECURITY.md`](./SECURITY.md) — vulnerability reporting and privacy rules
- [`docs/STABILITY.md`](./docs/STABILITY.md) — the interfaces a change may not break quietly
- [`docs/feature-spec-template.md`](./docs/feature-spec-template.md)
- [`docs/qa-checklist.md`](./docs/qa-checklist.md)

For vulnerability reports, follow the [organization security policy](https://github.com/zero-shelter/.github/blob/main/SECURITY.md).

## Adding a language

To add an HTML report language:

1. Add a catalogue to `src/messages.ts`. The `Messages` type checks for missing keys.
2. Add the language code to `LANGUAGES` and the `--lang` usage line in `src/cli.ts`. A test checks that `--help` lists each supported language.
3. For a right-to-left language, add its code to `RIGHT_TO_LEFT` in `src/html.ts`. The layout uses logical CSS properties.

Keep terminal output and code blocks untranslated. Preserve package names, advisory identifiers, and commands. Numbers use plain integers so the same report can be compared across machines without locale-dependent formatting.

## Writing documentation and public records

Describe the problem and observable behavior first. State the conditions and source of measurements, and separate current behavior from proposals. Keep commands, reproduction steps, technical evidence, authorship, and decision history when editing older text.

Report automated checks, agent review, and human approval separately. Do not claim a check or approval that did not occur. Remove unused template prompts before posting, and explain when a required check does not apply. Avoid repeated summaries, unsupported claims about users, and emphasis that adds no information. Korean translations should preserve the meaning in natural Korean rather than copy English sentence structure.
