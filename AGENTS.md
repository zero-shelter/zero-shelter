# Agent contribution rules

[한국어](./AGENTS.ko.md)

These are the repository-local rules for coding agents. The human contributor
still owns the scope, correctness, and final review.

## Before editing

- Read [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`GOVERNANCE.md`](./GOVERNANCE.md),
  [`SECURITY.md`](./SECURITY.md), and the linked Issue or spec.
- Check the working tree and preserve changes that are already present.
- Edit only what the linked Issue or spec requires. Do not add unrelated
  refactors, formatting passes, dependency updates, or cleanup.

## Protected boundaries

Changes to judgement contracts (`src/triage.ts`, `src/merge.ts`,
`src/fingerprint.ts`, `src/baseline.ts`) or public boundaries (`src/cli.ts`,
`src/report.ts`, `src/sarif.ts`, `src/hook.ts`, `package.json`, `.github/`,
`skills/`) need explicit scope and the review required by the governance rules.

Do not change ranking weights, fingerprints, baseline semantics, exit codes,
output schemas, or hook behavior just to make a test or report look better.

## Do not guess across boundaries

Pause and ask a human when the work:

- leaves the Issue or spec scope or changes a shared contract;
- adds runtime dependencies, network/LLM/telemetry behavior, or release/publish behavior;
- handles secrets or personal data; or
- conflicts with another contributor's changes or has unclear ownership.

Do not run `npm audit fix`, update a lockfile, use `--update-baseline`, or
regenerate snapshots, fixtures, captures, or benchmark labels unless the Issue
explicitly requires it and the reason is recorded. Never reset, clean, or
overwrite another contributor's changes.

Never commit real secrets, personal data, internal URLs, or undisclosed
vulnerability details.

## Validation

For code or behavior changes, run:

```bash
npm test
npm run typecheck
npm run build
```

For documentation-only changes, run `git diff --check` and verify changed
links and user-facing claims instead.

Run `npm run qa` when that script is available and the change affects package
or install behavior. For package or CLI changes, also inspect
`npm pack --dry-run` and run the published-package smoke path.

Review every changed file as a human contributor and report anything that was
not verified. Update the English canonical documentation and Korean translation
when user-visible behavior changes.
