# QA Checklist

Use this checklist in the feature spec and pull request. Remove items that genuinely do not apply and explain why.

## Automated validation

- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] New behavior has regression tests
- [ ] Determinism/input-order behavior is covered where relevant
- [ ] Fixed fingerprint/hash expectations are updated deliberately, not regenerated blindly

## Behavioral validation

| Case | Checked | Evidence/link |
|---|---|---|
| Normal input | [ ] | |
| Invalid input | [ ] | |
| Empty input | [ ] | |
| Boundary or large input | [ ] | |
| Missing optional dependency | [ ] | |
| Scanner non-zero with findings | [ ] | |
| Existing baseline | [ ] | |
| New finding and exit code | [ ] | |

## Security and privacy

- [ ] No runtime LLM call was added
- [ ] No undocumented network request or telemetry was added
- [ ] No secret or personal data is written to logs, fixtures, captures, or reports
- [ ] Redaction/hash behavior is tested where applicable
- [ ] Trust boundary and data flow are documented
- [ ] Failure behavior is explicitly fail-open, fail-closed, or warning
- [ ] Abuse or adversarial inputs were considered

## Compatibility and user experience

- [ ] CLI options and exit codes remain compatible or the breaking change is documented
- [ ] Text, JSON, SARIF, or hook output remains schema-compatible or is versioned/documented
- [ ] README and relevant docs are updated
- [ ] English canonical documentation is updated
- [ ] Korean translation is updated or the gap is stated
- [ ] Example command was run from a clean checkout or package build

## Evidence

Summarize what was run, what was manually checked, and what remains unverified:
