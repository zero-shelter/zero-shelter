---
description: Add zero-shelter to CI using its judgement exit codes, with optional reports and an explicitly reviewed baseline. Use when someone asks to add a dependency or security gate to CI, gate pull requests on vulnerabilities, upload SARIF to the Security tab, or set up zero-shelter for a team. Korean requests look like: CI에 보안 게이트 붙여줘, 의존성 취약점 CI 연동, PR에서 취약점 막기.
---

# Add a dependency check to CI

## Why not just `npm audit`

`npm audit` supplies dependency vulnerability data. zero-shelter adds baseline
comparison, reconciliation with other supported inputs, ranking and report
formats. Choose the integration according to the project's requirements.

## Review the project first

Run the judgement and inspect its exit code:

```bash
npx --yes zero-shelter judge
```

Ensure CI has a supported lockfile and the scanners intended to contribute.
Without a baseline, all current findings remain outstanding. The project may
choose that behavior. If the user wants to accept existing findings, first show
the list and supported remedies, then use `/zero-shelter:baseline` to obtain and
record the decision. Baseline acceptance is optional and is not a setup step.
Commit an agreed `.zero-shelter/baseline.json` if CI should use it.

## GitHub Actions

Use [the complete workflow](../../examples/github-action.yml). Keep the pinned
action SHAs, permissions and final judgement-status check. Tags are mutable;
pins make workflow revisions visible in version control.

The workflow allows the SARIF upload after an unsuccessful judgement, then
checks the original exit code so the job still fails. Copying only an upload
step with `continue-on-error` would omit that final check. SARIF upload requires
`security-events: write` permission.

## Other CI systems

A script step can run:

```bash
npx zero-shelter judge
```

The [exit-code contract](../../docs/STABILITY.md) is:

| Code | Meaning |
|---|---|
| 0 | A judgement was produced with no new findings. Accepted findings may remain. |
| 1 | New findings; fail the check. |
| 2 | Could not judge; never treat this as a pass. |

A new finding is new relative to the baseline. Advisory data or scanner changes
can also introduce it; do not attribute every new finding to the pull request.

Offer an HTML artifact when useful:

```bash
npx zero-shelter judge --format html --output zero-shelter.html
```

If the project uses `--record`, plan persistence for
`.zero-shelter/history.jsonl` explicitly, such as a retained artifact.
Do not commit shared history from each pull-request job.

## Scanner installation

A supported npm/pnpm audit input can produce a judgement alone. OSV-Scanner
adds another source; yarn requires it for live collection. Use the installation
in the complete workflow, pin the scanner version, verify its published
checksum, and check that it actually contributed. Do not assume additional
scanners always reduce report volume.

## Verify

Run the workflow's command with the same lockfile and intended scanner set.
Check both a successful judgement and the error path when input is unavailable.
For report uploads, verify the upload and the final exit-code check. State which
checks were local and whether the hosted workflow has run.

- Never add `--update-baseline` to CI; it would automatically accept findings.
- Do not swallow the judgement's exit code. A report upload may continue after
  failure only when a later step preserves that failure in the job result.
- Do not present an unexecuted workflow as verified.
