# Notes for coding agents

Read this if you are an agent working in a repository that uses zero-shelter,
or in this one. The plugin ships skills that say the same things in more
detail; this file is for when it is not installed.

## Running it

```bash
npx --yes zero-shelter judge --json
```

Exit codes are the answer, not decoration:

| Code | Meaning | What to do |
|---|---|---|
| 0 | Scanned, nothing new | Say so and stop |
| 1 | New findings | Work through them |
| 2 | **Could not judge** | Never report this as clean. The message says why — usually a missing lockfile |

## Use `upgrades`, do not rebuild it

The JSON carries `upgrades`: commands, already grouped by package and already
version-compared. Run those.

Deriving your own from `fixedIn` gets it wrong in a way that is easy to miss:
comparing versions as strings puts `4.17.21` above `4.18.1`, which sends someone
to an older release than the one they need.

`transitiveFixes` is a different list on purpose. Those packages arrive through
someone else's dependency, so `npm i` adds a top-level entry nobody asked for
and leaves the vulnerable copy in place. Use the project's package-manager-
specific override or resolution mechanism; the [install notes](./README.md#install)
explain how the lockfile selects that package manager. Forcing a transitive
version can break the parent that pinned the old version — propose it, name the
risk, do not apply it silently.

## Verify with this tool, not with `npm audit`

They answer different questions. `npm audit` does not know the baseline, so it
calls a project clean while accepted findings are still outstanding, and it
reconciles nothing. Quoting its "0 vulnerabilities" as the result of your work
is quoting a different tool.

Say **no longer reported**, not fixed, unless a re-run confirms it: a finding
also disappears when it is accepted into the baseline, and when the scanner that
found it did not run. The CLI hedges for that reason; keep the hedge.

## Do not re-rank, re-score, or re-merge

The order comes from a weights table you can print with `--explain`. It is
reproducible; your reconstruction of it is not. If the ranking looks wrong, say
which finding and why so the weights can be argued with, rather than quietly
sorting the list differently on the way to the screen.

The `(dev)` scope label and the age column are context, not hidden score inputs.
Do not re-rank production packages above development packages, or older findings
above newer ones, unless the printed weights say so.

`possibleDuplicates` means "suspected same, not merged". Report them as
unresolved. Merging on a hunch is how a real vulnerability ends up hidden behind
an unrelated one.

## Things that are the human's decision

- `--update-baseline` — accepting a finding is a judgement about risk. Never run
  it to make output quiet, and never as a way to finish a task.
- Package-manager-specific override or resolution entries, for the reason above.
- Removing a dependency, or pinning to an older version.

## What this tool cannot tell you

Whether the vulnerable code path is reachable in this project. Nothing here
knows that. Say so when asked rather than estimating.

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
