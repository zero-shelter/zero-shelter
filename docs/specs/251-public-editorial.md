# Public documentation and report presentation

[한국어](./251-public-editorial.ko.md)

- Issue: [#251](https://github.com/zero-shelter/zero-shelter/issues/251)
- Design authority: the user-approved implementation plan for the public editorial review.
- Related work: README/product/roadmap in [#250](https://github.com/zero-shelter/zero-shelter/pull/250); contributor guidance and product presentation in separate PRs.

## Problem and goal

Public documentation, report explanations, and project records contain repeated emphasis, unsupported claims, and lengthy process summaries. Some Korean text follows English sentence structure or mixes terminology unnecessarily. A developer should be able to understand the tool's inputs, outputs, limitations, and contribution process from these materials.

Review the complete public surface in English and Korean. Keep direct use and AI integration as primary workflows. Do not hide AI contributions or invent human review, measurements, or user experience.

## Changes

- Inventory the current main branch, published version, open and closed issues/PRs, comments and reviews, Discussions, releases, organization profile, Wiki, npm presentation, and linked media. Retrieve every page of public records. Record each item's location, problem, evidence, proposed edit, and outcome: changed, reviewed and retained, or awaiting permission/publication.
- Order the README around the product, a reproducible run, direct and AI use, result interpretation, limits, and further reading. Preserve #250's filename correction. Keep current capabilities in product documentation and proposals in the roadmap; the previously discussed catchphrase is not an approved decision.
- Preserve contribution, specification, QA, review, approval, security, and privacy requirements. Consolidate repeated explanations, shorten templates, and distinguish automated validation, agent review, and human approval. Add brief writing guidance to CONTRIBUTING and AGENTS.
- Review technical guides, comments, test names, and historical writing without changing technical evidence, legal text, generated notices, or benchmark labels. Generated presentation text may be corrected through its generator in a separately verified change. Benchmark script descriptions, printed column headings, and instruction comments in existing label templates may be edited to describe the calculation accurately. Captures, label fields and data rows stay unchanged; do not regenerate them.
- Group CLI help by first run, saved output, baseline/history, and AI integration. Distinguish scan status, new findings, available actions, and warnings; do not imply every finding has an executable fix.
- Order HTML as scanner status and warnings, summary, direct/AI action paths, findings, then baseline/history/reproduction details. Both action paths use the same computed remediation. Keep important warnings visible; allow auxiliary scoring and glossary detail to collapse.
- Preserve tables, system fonts, offline use, copying, disclosure controls, and themes. Prompts state the task, constraints, and re-verification; baseline acceptance and forced transitive versions remain user decisions.

## Interfaces and limits

Human-readable wording and HTML layout may change. Commands, options, exit codes, JSON/SARIF schemas, ranking, fingerprints, baseline acceptance and comparison, and hook behavior remain unchanged. No runtime dependencies, telemetry, network behavior, or release automation are added. Protected files receive the existing governance review.

Do not introduce unrelated refactoring or a new writing-score gate. Do not regenerate fixtures, snapshots, captures, or labels merely to pass checks. Preserve other contributors' work and coordinate changes overlapping #246 before editing shared behavior.

## Public history and data handling

Back up original text, IDs, and URLs in access-restricted local working records before external edits. Re-fetch each record before updating it; if it changed, review the new content before proceeding. Preserve technical evidence, chronology, authorship, reviews, and decisions. Keep historical proposals and results in their original time frame; mark factual corrections with their date.

Edit only records authored by the authorized account. Prepare review drafts for text owned by others. Do not change approval states, timestamps, Git history, tags, or published package files. Do not add public backup copies or editorial progress comments. npm changes that need publication wait for a normal release.

These edits use existing local files and authorized GitHub surfaces; product data flow is unchanged. Do not copy secrets or personal data into public records. Record missing surfaces, unavailable permissions, author-review drafts, and publication dependencies rather than claiming they were updated.

## Validation and acceptance

| Area | Required evidence |
|---|---|
| Documentation | `git diff --check`; changed links and claims checked; English/Korean meaning compared; obligations, attribution and historical evidence preserved |
| Code/presentation | `npm test`, `npm run typecheck`, `npm run build`; install QA, `npm pack --dry-run`, and packaged CLI smoke checks for CLI/package changes |
| Agent guidance | `npm run qa:agent` for prompts, skills, and related surfaces |
| Scan states | First run, no new findings, accepted-only, missing sources, nothing scanned, unavailable fixes, direct/transitive dependencies, workspaces and supported package managers |
| HTML | English/Korean, light/dark, narrow screens, long names, many findings, keyboard use, copy success/failure, disclosure controls, visible warnings, offline operation |
| Contracts | Identical input preserves machine output, ordering, judgement, and exit code |
| Public records | Complete inventory and private originals; updated text checked after writing; other authors' drafts and publication waits identified |

Finally follow the organization-to-install-to-report, contribution-to-issue-to-PR, and release-to-historical-discussion paths. Every inventory item must have an outcome. Distinguish implemented changes from review or publication waits. Repository inspection can verify these changes; it cannot establish that every visitor will perceive the writing as human-authored.

## Decisions

The approved plan permits editing historical prose while preserving its evidence and authorship. It retains all current procedures, direct and AI use, and report contracts. Full branding changes, automated AI-text scoring, Git-history rewriting, and an editorial-only npm release are excluded.
