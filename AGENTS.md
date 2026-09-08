# Notes for coding agents

Use these instructions when running zero-shelter in a project. Repository contribution rules follow below.

## Running it

```bash
npx --yes zero-shelter judge --json
```

Use the exit code to distinguish findings from a failed inspection:

| Code | Meaning | What to do |
|---|---|---|
| 0 | Scanned, nothing new | Report that result and stop |
| 1 | New findings | Review the findings and available actions |
| 2 | Could not judge | Report the reason; never describe this as clean |

## Remediation commands

Use the JSON `upgrades` commands, which are grouped by package and compared using version rules. Do not derive commands from `fixedIn`: string comparison, for example, puts `4.17.21` above `4.18.1` and can select an insufficient version.

`transitiveFixes` requires a different approach. Installing an indirect dependency at the top level can leave the vulnerable copy in place. Propose the project's package-manager-specific override or resolution and explain that forcing a version may break the parent dependency. Do not apply it without the user's decision. The [install notes](./README.md#install) explain package-manager selection.

## Verify the result

Re-run zero-shelter to verify remediation. `npm audit` does not apply or reconcile the zero-shelter baseline, so its result cannot replace this check.

Say **no longer reported** unless a re-run confirms remediation. A finding may also disappear because it was accepted into the baseline or its scanner did not run.

## Preserve the judgement

Keep the reported order, scores, and merge decisions. `--explain` prints the weights; if a ranking looks wrong, identify the finding and explain the concern for review.

The `(dev)` scope label and age column are context, not scoring inputs. Do not reorder production and development dependencies or older and newer findings unless the printed weights require it.

`possibleDuplicates` are unresolved suspected duplicates. Do not merge them without the identifier evidence required by the tool.

## Decisions reserved for the user

- `--update-baseline` accepts risk. Never use it to silence output or finish a task.
- Package-manager-specific override or resolution entries.
- Removing a dependency or pinning an older version.

The tool does not determine whether a vulnerable code path is reachable in this project. State that limitation when asked.

## Repository contribution rules

[한국어](./AGENTS.ko.md)

These are the repository-local rules for coding agents. The human contributor
still owns the scope, correctness, and final review.

### Before editing

- Read [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`GOVERNANCE.md`](./GOVERNANCE.md),
  [`SECURITY.md`](./SECURITY.md), and the linked Issue or spec.
- Check the working tree and preserve changes that are already present.
- Edit only what the linked Issue or spec requires. Do not add unrelated
  refactors, formatting passes, dependency updates, or cleanup.

### Protected boundaries

Changes to judgement contracts (`src/triage.ts`, `src/merge.ts`,
`src/fingerprint.ts`, `src/baseline.ts`) or public boundaries (`src/cli.ts`,
`src/report.ts`, `src/sarif.ts`, `src/hook.ts`, `package.json`, `.github/`,
`skills/`) need explicit scope and the review required by the governance rules.

Do not change ranking weights, fingerprints, baseline semantics, exit codes,
output schemas, or hook behavior just to make a test or report look better.

### Do not guess across boundaries

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

### Validation

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

### Public writing

Follow the [writing guidance](./CONTRIBUTING.md#writing-documentation-and-public-records). Describe verified behavior and its limits. Preserve technical evidence, chronology, and attribution when editing records. Distinguish automated checks and agent review from human approval; never present agent review as a human decision.
