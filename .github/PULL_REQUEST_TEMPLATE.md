<!-- Replace prompts with the details of this change before posting. Keep required checks; explain any that do not apply. Do not mark human review complete based on an automated or agent review. Use Closes only when this PR should close the linked Issue. -->

## Problem and change

Related Issue:
Specification: <!-- Link the spec, or explain why this small change does not need one. -->

Describe the problem, resulting behavior, and included/excluded scope.

<!-- Fork checks may wait for a Maintainer to approve the first workflow run. See CONTRIBUTING.md; comment on the PR if checks remain pending. -->

### Ownership and review

- [ ] Linked Issue has exactly one `status:*` label
- [ ] `type:*` and relevant `area:*` labels are applied
- [ ] An Owner is assigned to the Issue or PR
- [ ] A human Owner reviewed every changed file, including agent-assisted edits
- [ ] Any protected-area change is covered by the linked Issue/spec and required review

## Validation

Use [`docs/qa-checklist.md`](../docs/qa-checklist.md).

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Normal behavior
- [ ] Invalid/empty/boundary behavior
- [ ] Existing behavior/regression

Commands and observed results, manual checks, and unverified work:

## Compatibility and security

- [ ] No runtime LLM call added
- [ ] No undocumented network request or telemetry added
- [ ] No secret or personal data added to logs, fixtures, captures, or reports
- [ ] Data flow and trust boundary documented if relevant
- [ ] Failure mode documented if relevant
- [ ] Security-control changes include threat model and abuse-case tests

### Compatibility and documentation

- [ ] CLI/API/output compatibility checked
- [ ] English canonical docs updated
- [ ] Korean translation updated or gap stated
- [ ] Examples updated

## Review needed

- Input that could break this change:
- Files/interfaces that may conflict with other work:
- Known limitations or follow-up work:

<!-- Korean template: .github/PULL_REQUEST_TEMPLATE.ko.md -->
