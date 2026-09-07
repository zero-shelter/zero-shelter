# Feature specification: project-specific scanner guidance

[한국어](./163-scanner-guidance.ko.md)

## Issue and lifecycle metadata

- Issue: [#163](https://github.com/zero-shelter/zero-shelter/issues/163)
- Target layer: local project discovery, CLI output, setup skill
- Related roadmap: [#125](https://github.com/zero-shelter/zero-shelter/issues/125), [adoption roadmap](./125-adoption-roadmap.md)
- Related PR: linked from #163; GitHub owns lifecycle status and assignment.

This is a proposed implementation contract for Owner review. The feature is a
candidate for the next feature release, provisionally 0.1.0, and does not block
0.0.10. This document does not introduce a command or approve implementation.

## Problem

A first-time user needs advice based on the project in front of them. The setup
skill already contains a static domain/tool table, but the CLI does not inventory
project signals or tool availability. A dependency judgement cannot establish
that secrets, container configuration, infrastructure or workflows were checked.

The example in #163 uses “covered” beside installed tools. Presence on PATH
cannot support that claim, particularly when this command deliberately runs no
scanner. The output must distinguish applicability, availability and execution.

## Goal

`zero-shelter scanners` explains which checks the visible project signals suggest,
which relevant tools can be found, and where to install missing tools. A user
can read the same facts in JSON. Every result explicitly says no scan was run.

## Scope

### Included

- An opt-in `scanners` subcommand with text and `--format json` output.
- Bounded discovery of recognized filenames and directories, with relative evidence paths.
- A built-in, reviewed recommendation catalogue with tool/task mappings, license
  identifiers, platform-aware installation guidance and upstream references.
- Metadata-only PATH lookup; no executable is invoked, even for `--version`.
- A setup-skill example consuming this command and preserving the request for
  user agreement before installing or running a recommended tool.
- English terminal wording and matching English/Korean documentation, following
  the existing rule that terminal output itself is not translated.

### Explicitly excluded

- Running/installing scanners, package managers, shell commands or network requests.
- Parsing project source, secret values, git history, scanner findings or policy files.
- Importing SARIF, adding adapters, changing ranking, baseline or history storage.
- A new line in default `judge` or hook output; #168/#193 remain separate decisions.
- Scores, percentages, safety verdicts, or a claim that installing a tool completed a check.
- Persisted discovery data, telemetry, custom catalogue execution or automatic updates.

## Interface

| Direction | Contract |
|---|---|
| Input | `zero-shelter scanners [--cwd <directory>] [--format text\|json]`; default cwd and text |
| Output | Applicability evidence, tool availability, deduplicated recommendations and an explicit no-scan statement |
| Errors/exit code | 0: inventory complete, including missing tools or an empty directory; 2: invalid arguments, inaccessible root or incomplete discovery; never 1 for a missing tool |
| Compatibility | New subcommand only; existing judge/hook/history output, exit codes and schemas remain unchanged |

An illustrative text excerpt, not output from a shipped command:

```text
No scanners were run. Tool availability is not evidence of inspection.

Suggested checks
  container configuration  Dockerfile
  CI workflows             .github/workflows/build.yml
  secrets in files         applicable to every project

Tools available
  trivy                    container/IaC configuration and file-secret checks

Tools to consider
  zizmor (MIT)             GitHub Actions security checks
                           https://docs.zizmor.sh/installation/

No matching project signals found: Python, Go, Rust
```

Use “no matching signals found”, not “not applicable”, when a negative result
comes only from bounded filename discovery. A source file is evidence of a
language, not evidence that a particular rule set can analyze it.

Illustrative JSON excerpt (the full result includes every supported domain;
add fields only through review while this spec is a draft):

```json
{
  "schemaVersion": 1,
  "complete": true,
  "inspection": "not-run",
  "domains": [
    { "id": "container-config", "applicability": "detected", "evidence": ["Dockerfile"] },
    { "id": "secrets-files", "applicability": "always", "evidence": [] }
  ],
  "tools": [
    { "id": "trivy", "availability": "available" }
  ],
  "recommendations": [],
  "warnings": []
}
```

Domain applicability is `detected`, `not-detected`, or `always`. Tool
availability is `available`, `missing`, or `unknown`; it never means compatible,
configured or executed. `inspection` is always `not-run`. Recommendation entries
have `tool`, `tasks`, `license`, `installUrl`, and optional platform-specific
`installCommand`. The URLs/commands come only from the built-in catalogue.

Include every supported domain, even when not detected. Sort domains/tools by
stable ID, evidence by code-point order and recommendations by the fixed
catalogue order. JSON uses `JSON.stringify`; text escapes control characters.
Do not output absolute project paths, resolved executable paths or PATH values.

## Discovery boundaries

| Signal | Suggested task; limits |
|---|---|
| package.json / package-lock.json / npm-shrinkwrap.json / pnpm-lock.yaml / yarn.lock | JavaScript dependencies; record evidence without promising a compatible lockfile or conflating detection with current judge support |
| requirements*.txt / pyproject.toml / poetry.lock / uv.lock | Python dependencies |
| go.mod / go.sum | Go dependencies |
| Cargo.toml / Cargo.lock | Rust dependencies |
| pom.xml / build.gradle / build.gradle.kts | JVM dependencies |
| Dockerfile / Dockerfile.* / Containerfile / Containerfile.* | Container configuration; does not inspect a built image |
| *.tf / *.tf.json | Terraform configuration; arbitrary YAML is not assumed to be Kubernetes or IaC |
| .github/workflows/*.yml or *.yaml | GitHub Actions workflow security |
| *.js / *.jsx / *.ts / *.tsx / *.py / *.go / *.rs / *.java / *.c / *.h / *.cpp | First-party source review; language/rule support must be checked before suggesting execution |
| Every project; .git entry additionally present | File-secret review always; git-history review only as a separate suggested task when a .git file/directory is observed |

Traverse directory entries without reading file contents or following project
symlinks. Exclude `.git`, `node_modules`, `vendor`, `.venv`, `venv`, `dist`,
`build`, `coverage`, `.next`, `.cache`, `.context` and `.zero-shelter` directories.
Observe the root `.git` entry before excluding traversal; do not open gitdir
pointer files. State exclusions in help so generated or ignored trees cannot
silently become a claim of exhaustive discovery. Do not execute git or parse
.gitignore to enumerate files.

Proposed limits: depth 8 below the selected root and 20,000 directory entries,
visited in sorted order. If a non-excluded subtree cannot be inspected or a
limit is hit, emit a bounded warning, set `complete: false` and exit 2 with the
partial inventory. Absence of a signal is not conclusive in that result.
A symlink skipped by the documented policy does not alone make discovery fail.

PATH lookup respects the host platform: executable files on POSIX and a fixed
case-insensitive `.exe`/`.cmd`/`.bat` search on Windows. Ignore empty or relative
PATH entries. A normal system executable symlink may be resolved for metadata
checks, without executing it. Unreadable candidate paths yield `unknown` and a
warning; do not label the tool missing on incomplete evidence. The inventory
can still be complete while a tool's availability is explicitly unknown.

## Recommendation catalogue

These are proposals grounded in #163 and the existing setup skill. Implementation
must recheck the linked upstream installation/license sources and pin the review
reference in the catalogue tests; there is no runtime lookup.

| Tool | Task scope used here | Project license / reference |
|---|---|---|
| npm / pnpm audit | Existing JS dependency path selected from project evidence; no extra install if available | Existing package-manager installation; reuse documented project guidance |
| [OSV-Scanner](https://github.com/google/osv-scanner) | Dependency analysis for supported manifest/lockfile formats | Apache-2.0; upstream README/install guidance |
| [Trivy](https://github.com/aquasecurity/trivy) | Container and Terraform configuration, file-secret checks | Apache-2.0; upstream installation and scanner documentation |
| [Gitleaks](https://github.com/gitleaks/gitleaks) | File-secret and, separately, git-history checks | MIT; upstream README/install guidance |
| [zizmor](https://docs.zizmor.sh/installation/) | GitHub Actions security checks | MIT; [project](https://github.com/zizmorcore/zizmor) |
| [Opengrep](https://github.com/opengrep/opengrep) | First-party source analysis where language/rules are supported | LGPL-2.1; rule-set terms require separate attribution |

The license field identifies the upstream tool project, not a legal assessment
or a blanket license for external rules/services. Do not copy source code or
scanner rules into this package.

Deduplicate by tool ID and list the task set beside a single installation
suggestion. Prefer a suitable already-available tool. When container/IaC
configuration suggests Trivy, its file-secret task avoids a second file-secret
installation suggestion. Do not let that suppress a distinct git-history task.
Do not recommend both npm and pnpm audit for the same project merely because
both binaries exist; reuse the project's manager selection and show conflicting
lockfile evidence. Tool capabilities do not imply zero-shelter can ingest their
outputs. Avoid a general optimization engine or a “minimum tools” guarantee.

On 2026-09-07 the Gitleaks README stated that new features are no longer being
merged and future releases are security patches. The earlier issue's blanket
“actively maintained” description is therefore insufficient for selecting a
long-term default. Owner review must confirm retaining Gitleaks for this bounded
task or choose an alternative with evidence before implementation. Do not change
the current shipped setup skill's recommendation as part of this spec PR.

Installation lines may use verified Homebrew commands on supported hosts; other
hosts get upstream installation links when no validated command exists. Never
recommend a guessed command or automatically download a binary.

## Architecture

- Expected new modules: `src/scanners.ts` for bounded discovery/catalogue and a
  focused renderer; module split finalized during implementation review.
- Expected edits: `src/cli.ts` (routing/help only), README in both languages,
  `skills/setup/SKILL.md`, focused discovery/CLI tests and `scripts/qa-agent.mjs`.
- Public boundaries: new subcommand/JSON contract and setup skill need explicit
  Maintainer review. The local discovery/data-flow design needs Owner review.
- Keep `collect`, `judge`, fingerprint generation, baseline and ranking untouched.
- Possible conflicts: #129 collection adapters, #168 clean-run wording and #193
  follow-up guidance. Those features cannot quietly expand this inventory command.

## Security and privacy

- Protected data: source and secret contents, git history, absolute paths and environment values.
- Data flow: local directory metadata and relevant PATH metadata -> in-memory
  inventory -> stdout. Only relative evidence paths are emitted; those can still
  reveal project structure, so users control sharing of the output.
- Retention: no files written, no history/baseline updates, no background task.
- Network/LLM/telemetry: none; no child process or tool version probe.
- Failure mode: explicit incomplete inventory with exit 2 for discovery errors;
  missing tools are advice with exit 0; uncertain availability remains unknown.
- User control: opt-in subcommand; setup skill asks before tool installation or
  execution. Inventory output is never proof a scan completed.
- Abuse: filenames with terminal escapes, oversized trees, symlink loops,
  malicious binaries, permission failures and misleading project signals.

## QA acceptance criteria

| Scenario | Expected result | Required evidence |
|---|---|---|
| npm project + Dockerfile + Actions | Signals named, tasks explained, no scanned/covered claim | Synthetic CLI text/JSON test |
| Trivy present with container/IaC | One Trivy suggestion at most, file-secret task grouped, history task separate | Catalogue tests with synthetic PATH |
| Empty directory | No detected ecosystems, file-secret advice, exit 0, inspection not-run | CLI test |
| Invalid cwd/format/argument | Useful error, exit 2; no child process | CLI tests |
| Old/absent/multiple lockfiles | Report evidence and manager choice without claiming parseability | Discovery cases |
| Large tree, depth limit, unreadable subtree | Bounded output, complete false, exit 2; deterministic partial traversal | Boundary tests |
| Symlink loop or link outside root | No traversal/content read beyond root | Filesystem tests |
| Fake binaries that would create a marker | Availability may be shown; marker never created | No-subprocess adversarial test |
| Secret-like file contents / .git history | Contents are never read or emitted | Instrumented reads and synthetic fixtures |
| Control characters in filenames | Escaped text, valid JSON, no terminal escape injection | Renderer test |
| Windows PATH / POSIX executable bits | Correct host-specific available/missing/unknown states | Cross-platform CI |
| Existing commands | Existing contract tests pass unchanged | npm test, typecheck, build |
| Published command and skill | Packed CLI accepts examples; skill never equates installed with scanned | qa, qa:agent, npm pack --dry-run |

Update both README languages and the CLI/help examples. Preserve Korean trigger
phrases in skill frontmatter; skill bodies remain English. No fixture or snapshot
regeneration is authorized merely by adding this spec.

## Agent notes

Do not implement before the Owner reviews the choices below. Each implementation
PR must link #163 and this spec, report normal/invalid/empty/boundary and abuse
case evidence, and announce any required contract change before editing it.

## Decision log

| Proposed decision | Alternatives | Reason / review gate |
|---|---|---|
| Opt-in subcommand first | Always append advice to judge | Preserves quiet runs and scopes #163 independently of #168/#193 |
| Separate applicability, availability and not-run | Covered/uncovered based on PATH | Installation is not inspection; Owner must approve the wording/JSON contract |
| Metadata-only bounded discovery | Read source/git history or invoke tools | Makes privacy and execution boundaries testable; Owner reviews traversal limits |
| Group suggestions by task/tool | One install per domain; generalized set cover | Fewer repeated installs without erasing different scan modes |
| Review upstream defaults before coding | Reuse the old issue table unchanged | Gitleaks maintenance status changed; catalogue choice remains a review question |
| Separate feature release | Hold 0.0.10 for implementation | Ship already-tested fixes while the new contract receives review |
