---
description: Run the first dependency judgement and configure requested zero-shelter integrations. Use when someone asks to check dependency vulnerabilities, review scanner reports, or install zero-shelter. Korean requests look like: 의존성 취약점 점검해줘, 보안 스캔 돌려줘, zero-shelter 설치.
---

# First run

Run the dependency judgement and read its exit code:

```bash
npx --yes zero-shelter judge
```

| Exit | Meaning | Response |
|---|---|---|
| 0 | Scanned, no new findings | Report the result and any accepted findings or missing sources. |
| 1 | New findings | Review them with `/zero-shelter:explain`. |
| 2 | Could not judge | Report the reason. Do not call this clean or passing. |

Requires Node.js 20 or later. If no scanner can read the project, check for a
supported lockfile and explain how to generate one with its package manager.
Do not create or replace a lockfile without authorization.

The scan covers dependency vulnerabilities. Dockerfiles, Terraform/IaC,
Actions workflows, secrets and first-party source are outside this judgement.

## Scanner inputs

The lockfile selects npm audit, pnpm audit or yarn. npm/pnpm audit can provide a
supported single-source judgement. yarn requires OSV-Scanner for live collection
because this tool does not read yarn v1's NDJSON. Stored supported JSON reports
can be passed with `--input`.

Offer OSV-Scanner for additional dependency evidence when appropriate:

```bash
brew install osv-scanner
go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest
```

Choose an installation method that works on the host, or use
[the official releases](https://github.com/google/osv-scanner/releases).
Do not install both methods. Follow the user's authorization for installation.

After installation, re-run `judge`, preserve its exit code, and inspect the
source and skipped-source notes. `one source, nothing to reconcile` means only
one source contributed. An installation success message does not confirm that
the scanner ran.

Do not search the JSON for the string `osv-scanner` as a success test:
`skipped` also names missing scanners. A reduction of 0% does not establish the
number of sources; sources may contribute disjoint findings.

One supported source provides ranking, baseline comparison and available
remedies. Multiple sources can add findings or fixed versions and reconcile
shared identifiers. Do not turn source count, reduction percentage or scanner
installation into a claim about project safety. The [benchmark](../../bench/README.md)
uses pinned captures and does not predict every project's result.

## Other inspection needs

Inspect the project tree when suggesting checks beyond dependencies. Confirm
actual file types and do not follow unexpected symlinks or treat a filename as
proof of coverage. Existing tool configuration is not proof a scan ran.

| Project content | Inspection to discuss | Example tools |
|---|---|---|
| Dockerfile or container configuration | Containers | [Trivy](https://github.com/aquasecurity/trivy) |
| Terraform files | Infrastructure as code | [Trivy](https://github.com/aquasecurity/trivy), [Checkov](https://github.com/bridgecrewio/checkov) |
| GitHub Actions workflows | CI configuration | [zizmor](https://github.com/zizmorcore/zizmor) |
| First-party source | Static analysis | [Opengrep](https://github.com/opengrep/opengrep) |
| Repository history | Exposed credentials | [Gitleaks](https://github.com/gitleaks/gitleaks), [TruffleHog](https://github.com/trufflesecurity/trufflehog) |

These are separate tools, not inputs to zero-shelter. Check their supported
languages, licenses and execution requirements before recommending an
installation. Do not install them or run new scans as an implicit setup step.

## Baseline decisions

A baseline is optional. Show the findings and available fixes before discussing
acceptance. Use `/zero-shelter:baseline` when the user wants to review that choice.
Only run this after the user has authorized accepting the current findings:

```bash
npx --yes zero-shelter judge --update-baseline
```

It records current findings as accepted, including newly outstanding findings.
It does not fix them. Rewriting to prune old entries is also an acceptance
operation; show what else would be accepted and get the user's decision.
Never use it to finish setup or silence a failing check.

## Reports and history

```bash
npx --yes zero-shelter judge --format html --output zero-shelter.html
npx --yes zero-shelter judge --format html --lang ko --output zero-shelter.ko.html
```

The self-contained report can be opened offline. It includes direct commands,
agent prompts, findings, ranking explanations and baseline comparisons.

For repeated runs, offer history recording:

```bash
npx --yes zero-shelter judge --record
npx --yes zero-shelter history
```

`--record` writes `.zero-shelter/history.jsonl`; use it only when requested or
already configured. HTML includes history when at least two runs exist.

After a dependency change, re-run `judge`. Preserve missing-source caveats and
say “no longer reported” unless the re-run supports a remediation claim.

## Integrations

When requested, use `/zero-shelter:ci` and the
[complete workflow](../../examples/github-action.yml) for CI setup. Preserve the
pinned action revisions and final exit-code check.

For coding agent context, follow the [hook guide](../../docs/AGENT-HOOK.md).
`zero-shelter hook` is non-blocking: on errors it emits no context and exits 0.
It provides evidence; it does not guarantee the agent will avoid a vulnerability.

## Required boundaries

- Preserve the CLI's findings and order. Do not re-rank, filter, or merge
  possible duplicates in the response.
- Use the report's `upgrades` and separate `transitiveFixes`; do not derive
  install commands from version strings.
- Baseline acceptance and forced indirect dependency versions require the
  user's decision. Explain the risk before applying either.
- Do not describe exit 2, a missing source or an unexamined domain as passing.
