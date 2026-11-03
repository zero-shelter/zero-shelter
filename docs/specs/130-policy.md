# Feature specification: project-level finding policy

## Issue and lifecycle metadata

- Issue: [#130](https://github.com/zero-shelter/zero-shelter/issues/130)
- Target layer: policy loader, judgement, terminal/JSON report

## Goal

Allow a committed `.zero-shelter/policy.json` to filter findings by a minimum
severity and by production/dev scope while keeping the decision visible. The
policy never changes ranking weights or baseline acceptance, and an absent file
keeps today's output byte-for-byte compatible.

```json
{
  "version": 1,
  "minimumSeverity": "moderate",
  "ignoreScopes": ["dev"]
}
```

`mixed` is never ignored. Unknown keys, malformed JSON, unknown severities, and
invalid scopes fail closed with exit code 2 and the policy path.

## Contract

- Filtered findings remain in raw/merged counts and are named in the summary.
- Terminal output states the active filters and the filtered count.
- JSON adds `policy` with the schema, filters, and filtered count.
- Baseline matching and history retain all findings; policy is a reporting view.
- No network, subprocess, score, or weight changes.
