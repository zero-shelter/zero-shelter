---
description: Wire zero-shelter into a project's CI so new dependency findings fail the build, without the inherited backlog failing it from day one. Use when someone asks to add a dependency or security gate to CI, gate pull requests on vulnerabilities, upload SARIF to the Security tab, or set up zero-shelter for a team. Korean requests look like: CI에 보안 게이트 붙여줘, 의존성 취약점 CI 연동, PR에서 취약점 막기.
---

# Putting the judgement in CI

## Why not just `npm audit` in the pipeline

It is the obvious two-word answer, and it is the one that gets switched off.
`npm audit` fails on everything a project has ever accumulated, so the first run
on a real repository is red for reasons nobody introduced today, and within a
fortnight someone adds `|| true`. It also has no memory: it cannot tell a
finding that appeared in this pull request from one that has been there for two
years.

Use it if the project genuinely has no backlog and wants nothing else. Anything
past that — a baseline, a second scanner reconciled with the first, findings in
the Security tab, a report someone can open — is what this is for.

The point is the ratchet: the build fails on what this change introduced, not on
the backlog the project inherited. Skip the baseline and the job is red from day
one, which is how a security check gets switched off in week two.

## Order matters

**1. Record the backlog first.**

```bash
npx --yes zero-shelter judge --update-baseline
```

Show the findings before running it. Anything recorded stops being reported, and
that is a decision about risk, not a setup step. If several look fixable today,
offer `/zero-shelter:fix` first so they are fixed rather than accepted.

**2. Commit `.zero-shelter/baseline.json`.** Without it in the repository, CI has
nothing to compare against and reports the whole backlog on every run.

**3. Then add the workflow.**

## GitHub Actions

The repository ships one at `examples/github-action.yml`. Copy it rather than
writing a new one — it already handles the pieces that are easy to get wrong.
Keep the SHAs when you copy it. Tags are mutable, so a tag can change what the
workflow runs without leaving a diff in the repository. The version comments
make the pins readable when it is time to update them.

```yaml
- run: npx zero-shelter judge --format sarif --output zero-shelter.sarif
  continue-on-error: true

- uses: github/codeql-action/upload-sarif@6f5948dfacef28e207b48d0905cf90c03365536d # v3.37.9
  with:
    sarif_file: zero-shelter.sarif
```

`continue-on-error` is deliberate: the upload step has to run even when the
judgement failed, or the findings never reach the Security tab. The job still
fails afterwards, because the exit code is checked in a later step.

Uploading SARIF needs `permissions: security-events: write`. Without it the
upload fails with a permissions error that reads like an authentication problem.

## Another CI system

The contract is the exit code, and it is the same everywhere. It is frozen —
[`docs/STABILITY.md`](../../docs/STABILITY.md) says so, along with what else is
and is not safe to depend on below 1.0:

| Code | Meaning |
|---|---|
| 0 | Nothing new |
| 1 | New findings — fail the build |
| 2 | Could not judge. **Never treat this as a pass** |

A plain `npx zero-shelter judge` in a script step is a complete integration.

Two things worth adding when the platform allows:

- `--format html --output zero-shelter.html` as a build artifact, so someone can
  look at a failed run instead of reading log output
- `--record`, if the project keeps a history, so the trend survives across runs.
  It writes to `.zero-shelter/history.jsonl`, which means the job needs somewhere
  to put it — an artifact, or a commit on a schedule, not on every PR

## A second source is worth the four lines

`osv-scanner` is what makes cross-source reconciliation possible, and most of
the deduplication comes from it. In CI, pin it and check the download:

```yaml
- run: |
    curl -sSfL -o osv-scanner \
      https://github.com/google/osv-scanner/releases/download/v2.5.0/osv-scanner_linux_amd64
    echo "edcfc41d257db36148f065055655fe3fcfc434b0b423ea67468a84c207524e0c  osv-scanner" | sha256sum -c -
    chmod +x osv-scanner && echo "$PWD" >> "$GITHUB_PATH"
```

Check the checksum for the version you pin; the one above is v2.5.0 linux/amd64.
Pulling an unverified binary into a pipeline that exists to check supply chains
is not a detail to wave through.

## Before saying it is done

Run the job's command locally and read the exit code. A workflow that has never
been run is a guess, and the failure mode people hit is `2` on a project whose
lockfile CI never generated.

## What not to do

- Do not add `--update-baseline` to the CI job. A baseline that re-records
  itself on every run accepts every new finding automatically, which removes the
  only thing this job does.
- Do not silence the job with `continue-on-error` on the judge step itself.
- Do not commit `.zero-shelter/history.jsonl` from a pull-request job; every PR
  would fight over the same file.
