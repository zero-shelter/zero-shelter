## Summary

## Related Issue

Closes #

## GitHub metadata

- [ ] Linked Issue has exactly one `status:*` label
- [ ] `type:*` and relevant `area:*` labels are applied
- [ ] An Owner is assigned to the Issue or PR
- [ ] A human Owner reviewed every changed file, including agent-assisted edits
- [ ] Any protected-area change is covered by the linked Issue/spec and required review

## Scope

- What is included:
- What is explicitly not included:

## Specification

Link to `docs/specs/<issue>-<slug>.md` or explain why this small change does not need one.

Korean template: [PULL_REQUEST_TEMPLATE.ko.md](./PULL_REQUEST_TEMPLATE.ko.md)

## Validation

Use [`docs/qa-checklist.md`](../docs/qa-checklist.md).

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Normal behavior
- [ ] Invalid/empty/boundary behavior
- [ ] Existing behavior/regression

Validation evidence:

## Security and privacy

- [ ] No runtime LLM call added
- [ ] No undocumented network request or telemetry added
- [ ] No secret or personal data added to logs, fixtures, captures, or reports
- [ ] Data flow and trust boundary documented if relevant
- [ ] Failure mode documented if relevant
- [ ] Security-control changes include threat model and abuse-case tests

## Compatibility and documentation

- [ ] CLI/API/output compatibility checked
- [ ] English canonical docs updated
- [ ] Korean translation updated or gap stated
- [ ] Examples updated

## Review notes

- Input that could break this change:
- Files/interfaces that may conflict with other work:
- Known limitations or follow-up work:
