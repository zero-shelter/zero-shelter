# Changelog

Entries describe behavior and measurements at each release. Later fixes may supersede these descriptions; use the README for current instructions.

## 0.0.10

[Korean release notes](./docs/releases/0.0.10.ko.md)

Correction, 2026-09-09: the emitted field is `security_severity`; an earlier version of these notes spelled it with a hyphen. The output itself is unchanged.

### Judgement evidence
 History now shows the
raw report count and the count after merging alongside outstanding findings.
It explains that `accepted` counts baseline entries matched by that run, so a
falling accepted count is not mistaken for a shrinking baseline. Both text and
JSON expose the stored counts (#232).

SARIF results preserve the advisory's exact CVSS vector when present, in
`properties.cvssVector`. The numeric `security_severity` remains the existing
coarse severity-band fallback; zero-shelter does not calculate a CVSS score from
the vector (#226). HTML duplicate references show advisory names when the
sibling is displayed, with the fingerprint retained when it is absent (#211).

### Baseline sources
 `--update-baseline`
prints skipped-scanner notes before its confirmation and names the sources
recorded in the file. A supported one-scanner run still succeeds; it no longer
writes the permanent record without disclosing the missing scanner (#227).

### Package-manager advice
 Declared packages are now
recognized as direct dependencies when the scanner does not supply that fact,
including the older npm/pnpm shape and OSV. Direct upgrade commands can then
appear when a source also supplies a fixed version (#195). A yarn project is
no longer told to create an npm lockfile (#201). The HTML report withholds both
unverified `clears N` badges and the paragraph promising those counts outside
npm (#229). Agent skills use the report's commands and manager-specific forced
versions, with a QA check to catch guidance drifting back to npm-only remedies
(#234).

The older pnpm/npm 6 advisories shape now supplies a fixed version for a
standalone inclusive stable lower bound such as `>=1.2.3`. Exclusive,
prerelease and compound ranges intentionally do not produce an install target
(#233). Korean HTML score reasons and the weights table are translated while
English terminal and SARIF reason strings are preserved (#240).

### History and version handling

Correction, 2026-09-09: the earlier text overstated this as loss of every later
record. The fix protects the record appended after an incomplete line.

After an interrupted history write, the next appended record is separated from
the incomplete line so it remains readable (#199). Unknown
baseline entry keys are named as warnings, including misspellings such as
`expiress`; judging continues for forward compatibility (#200). Prerelease
versions are ordered against one another, including numeric identifiers beyond
JavaScript's safe integer range, and a leading `v` no longer makes a release
compare below older versions (#170). An osv-scanner exit indicating no package
sources is distinguished from a scanner failure (#190).

### Contribution and install checks

The contributor
guides and PR templates explain when fork CI is waiting for maintainer approval
(#220). The CI example pins osv-scanner and verifies its checksum (#221).
Installation QA bounds its subprocesses, gives the CLI headroom above scanner
timeouts, and reports why a failing check could not judge; CI jobs also have
explicit time limits (#160). The README points contributors at focused first
issues (#164). CODEOWNERS requests owner reviews, with approvals and required
CI enforced through branch protection (#202). Contributor architecture guidance
now includes manifest context in both acquisition paths (#238). A dedicated
Node 20 job tests the declared support floor using a checksum-pinned runtime
(#241).

### Compatibility and limits
 Existing judge exit codes, fingerprint recipes,
ranking weights and baseline acceptance semantics are unchanged. The history
JSON fields and optional SARIF vector are additive; human-readable output has
changed. A finding is still described as *no longer reported*, not necessarily
fixed. Package, lockfile and plugin versions agree on 0.0.10 (#203).

Unsupported older-shape patched ranges still omit an actionable fixed version.
The Korean HTML duplicate suffix still
has the English `fixed in` wording tracked by #218. This release does not add a
new scanner, and does not include the proposed `scanners` command (#163).

### Contributors
 These are merged contributions since v0.0.9;
review and discussion are also appreciated.

| Contributor | Contributions |
|---|---|
| [@Akimbo92i](https://github.com/Akimbo92i) | [Duplicate advisory names #211](https://github.com/zero-shelter/zero-shelter/pull/211) |
| [@be-student](https://github.com/be-student) | [SARIF CVSS evidence #226](https://github.com/zero-shelter/zero-shelter/pull/226), [baseline sources #227](https://github.com/zero-shelter/zero-shelter/pull/227) |
| [@chrisriv10](https://github.com/chrisriv10) | [Fork CI guidance #220](https://github.com/zero-shelter/zero-shelter/pull/220) |
| [@kshivam4781](https://github.com/kshivam4781) | [Verified scanner download #221](https://github.com/zero-shelter/zero-shelter/pull/221), [HTML count boundary #229](https://github.com/zero-shelter/zero-shelter/pull/229) |
| [@msnodeve](https://github.com/msnodeve) | [History counts #232](https://github.com/zero-shelter/zero-shelter/pull/232), [manager-neutral skills #234](https://github.com/zero-shelter/zero-shelter/pull/234), [pnpm fixes #233](https://github.com/zero-shelter/zero-shelter/pull/233), [architecture guidance #238](https://github.com/zero-shelter/zero-shelter/pull/238), [Korean score reasons #240](https://github.com/zero-shelter/zero-shelter/pull/240), [Node 20 CI #241](https://github.com/zero-shelter/zero-shelter/pull/241) |
| [@PresentJay](https://github.com/PresentJay) | [QA bounds #160](https://github.com/zero-shelter/zero-shelter/pull/160), [contributor entry point #164](https://github.com/zero-shelter/zero-shelter/pull/164), [version ordering #170](https://github.com/zero-shelter/zero-shelter/pull/170), [scanner outcome #190](https://github.com/zero-shelter/zero-shelter/pull/190), [direct dependencies #195](https://github.com/zero-shelter/zero-shelter/pull/195), [history writes #199](https://github.com/zero-shelter/zero-shelter/pull/199), [baseline warnings #200](https://github.com/zero-shelter/zero-shelter/pull/200), [yarn guidance #201](https://github.com/zero-shelter/zero-shelter/pull/201), [review routing #202](https://github.com/zero-shelter/zero-shelter/pull/202), [release preparation #203](https://github.com/zero-shelter/zero-shelter/pull/203) |

## 0.0.9

Contributions from five people outside the team added manager-specific transitive advice (#143), corrected its rendering (#155), pinned CI example actions and tested those pins (#157), explained the first-run scope and scanner choices by domain and license (#177), and aligned one flag across all three option lists with a regression test (#162).

Scanner diagnostics now distinguish an absent executable, a timeout, and a failed execution. Previously the 120-second scanner timeout reported “produced no report.” On Windows, failures without output could be reported as “not on PATH” even when the tool was installed. Only an absent executable now receives install advice; a run with another successful source can still exit `0`.

Equivalent ranges such as OSV's `< 0.2.4` and npm's `<0.2.4` are normalized. Previously these appeared as conflicting ranges and prevented suspected-duplicate matching. The pinned captures showed this on all findings in three projects: 173 on NodeGoat, 51 on dvna, and 11 on hackathon-starter.

Baseline expiry validation now checks real calendar dates, including leap years. Previously `9999-99-99` matched the date pattern and could remain accepted indefinitely.

Baselines record installed versions in addition to `vulnerableRange` and `fixedIn`, preserving context needed for later inspection and PURLs. Acceptance remains independent of installed version: moving between vulnerable versions does not itself resurface an accepted finding.

The plugin manifest version is checked against the package version. The committed baseline uses LF to avoid whole-file line-ending diffs on Windows. `docs/STABILITY.md` is linked from the README, CONTRIBUTING, and CI skill; the contract test now checks the remaining frozen key. A CI comment with a nonexistent issue reference now links #154 and includes the measurement.

## 0.0.8

Baseline matching now survives a change in scanner sources by checking an exact fingerprint first, then shared advisory aliases within the same package. In the measured case, accepting 73 npm findings and adding OSV previously produced 79 new findings and 70 “no longer reported” entries. The single-source and combined runs had 73 and 82 fingerprints respectively, with only 3 shared. Alias matching reduced the new count to the 9 findings reported only by OSV, and the output states when alias matching was used.

Each baseline acceptance now includes package, advisory, and severity, with optional handwritten `reason`, `acceptedBy`, and `expires`. Expired acceptances return to the report. Entries are sorted and stored one per line for readable diffs.

Terminal, HTML, SARIF, JSON, agent prompts, and hook output use package-manager-specific forced-version syntax: npm `overrides`, `pnpm.overrides`, or yarn `resolutions`. Six of the eight measured repositories had no direct upgrade commands and depended on this guidance. `clears N` is withheld for pnpm and yarn because the range reader only supports `package-lock.json`.

Findings carry development/production scope from the lockfile's `dev` flag, and the summary shows the split. `hasInstallScript` also identifies packages with install-time code; the uptime-kuma measurement contained 13. Both are contextual labels and do not affect ranking.

Advisory `published` values and CVSS vectors are preserved and displayed without affecting scores. The captures contained publication dates on 453 findings and vectors on 424 of those 453; zero-shelter does not calculate a CVSS score from a vector.

Scanner provenance is recorded from the run instead of inferred from outstanding findings, so a run whose findings are all accepted still records its sources. Single-source output explains why cross-source reduction is zero.

`docs/STABILITY.md` documents the exit codes and top-level JSON shape frozen below 1.0, with contract tests against rendered output.

`zero-shelter hook --input` supports saved reports for offline checks. The hook also receives package-manager context, withholds unverified remediation counts, and recognizes expired baseline acceptances.

A `--record` write failure is reported on stderr while preserving the completed judgement's exit code. It no longer changes a successful judgement into “could not judge.”

The onboarding skill at this release recommended a second scanner and corrected its installation check: membership in `skipped` indicates a missing source, not successful execution.

## 0.0.7

Upgrade commands now check whether every dependent range accepts the proposed version. In the measured uptime-kuma case, `tar@~6.2.1` was direct, so the report suggested `npm i tar@7.5.22` with `clears 12`. However, `cacache`, `node-gyp`, `@louislam/sqlite3`, and `@mapbox/node-pre-gyp` required `tar@^6`; npm retained separate vulnerable copies, and the finding count stayed at 71.

Reading dependent ranges reduced the commands from ten to three. Those commands removed the eleven findings indicated by their counts, taking 71 to 60 with 66 lockfile lines changed. The recorded comparison with `npm audit fix --force` changed 3,489 lines and left eight findings. These measurements describe that dependency tree and capture, not a general guarantee.

When a command cannot reach all copies, the report names the blocking packages and provides override guidance. The hook and SARIF now use the same check; they had continued suggesting the tar command after the human report stopped doing so.

## 0.0.6

Truncated output states how many entries were omitted and where to find them. This covers the last twelve recorded runs, eight packages in the no-fix prompt, and five hook commands. Previously those limits could leave the reader unaware of the rest, such as eight shown packages out of 324 or five commands out of nine.

Text contrast for muted labels and column headers changed from 3.11 to 4.56 against the background, exceeding the 4.5 WCAG AA threshold used by the report. A test checks all eight color pairs.

Copy buttons fall back from the clipboard API to `execCommand`, then to text selection with an explanation. This supports reports opened from local files when the clipboard API is unavailable or denied.

The HTML layout uses logical CSS properties and sets direction from the language. The contribution guide describes how to add a language in English and Korean.

Tests now check that zero-shelter itself opens no sockets, writes no project files unless requested, uses integer ranking arithmetic, and does not describe the verdict as a count of findings fixed. Documentation was corrected to state that secret hashing is outside v1's capabilities.

## 0.0.5

The HTML action section explains commands and generates three finding-specific prompts: upgrade direct dependencies, propose forced versions for indirect dependencies, and investigate reachability where no fix version is reported. Each prompt requires re-running judgement. Commands and prompts have copy buttons, and a collapsible glossary explains report counts and baseline terms. Workspace prompts direct the agent to the manifest that declares the dependency.

`/zero-shelter:baseline` gathers the user's acceptance reason and decision. It prohibits using acceptance to finish a task or make a build pass without a risk decision.

English and Korean report wording was revised. Review restored a precision limitation omitted by one draft and corrected excessive punctuation removal in another. These were editorial checks, not evidence of ranking accuracy.

## 0.0.4

`judge --format html --output report.html` writes a self-contained report with commands, findings, score reasons, and the weights table. It supports light and dark themes and Korean with `--lang ko`, without a build step or external network resources. The report does not add a composite risk score or other judgement data in presentation.

`judge --record` appends run records to `.zero-shelter/history.jsonl`. `zero-shelter history` reports findings that appeared or stopped being reported. Records retain fingerprints to distinguish changes that leave total counts unchanged. Nothing is recorded unless requested, and stored history stays local.

`/zero-shelter:fix` uses the CLI's action list and re-runs judgement, including for transitive dependencies that a direct install cannot reach. At this release, `/zero-shelter:ci` guided baseline setup before installing a CI gate. Both skills were revised after an observed agent used `npm audit` to verify remediation and skipped the CI skill.

## 0.0.3

Different fix versions from npm audit and OSV no longer suppress all upgrade advice. The merge selects the highest reported version, and `--explain` shows the disagreement.

Upgrade commands are grouped by package. The release's output example was:

```text
npm i lodash@4.18.1   clears 7
35 finding(s) in 11 package(s) have a published fix but arrive through another
dependency — package.json "overrides" forces one, at the risk of breaking
whatever pinned it
```

Transitive packages receive separate advice because adding them at the top level may leave the vulnerable copy under a parent. Workspace output warns that the command needs a `-w` target; hoisting does not identify the declaring workspace.

`--top` limits displayed rows without changing project totals, reduction, or actions. Previously `--top 3` on a project with 82 outstanding findings announced “3 to fix (98% less noise).”

The lockfile selects the audit command, adding pnpm support. Yarn lockfiles use OSV; when it is unavailable, the report explains the limitation.

Suspected-duplicate detection uses a grouping pass instead of comparing every pair. The recorded timings were one second reduced to 30 ms for 7,500 findings, and 151 ms for 37,400 findings. These are measurements from that change, not performance guarantees for other machines.

Releases use GitHub Actions with OIDC trusted publishing and provenance linking each tarball to its source commit and build run, without a stored npm publishing token.

The hook includes commands and honors `--baseline`; SARIF includes remediation guidance. `--explain` shows the weights table and names possible duplicates by advisory. Unusable baselines, unwritable output paths, and zero-shelter SARIF supplied to `--input` receive explicit errors.

## 0.0.2

A run with no readable scanner report exits `2`. Previously a directory without a lockfile could print `✓ nothing new to fix` and exit `0` after npm audit failed. The error now includes npm's lockfile explanation instead of a parser error. A successful scan with no findings still exits `0`.

Unsupported Node versions now receive the required and running versions with exit `2`; Node 18 previously produced a stack trace. `--version` and `version` identify the installed package.

The Claude Code plugin introduced `setup` and `explain` via `/plugin marketplace add zero-shelter/zero-shelter`. They guide the first scan, CI and hook setup, and report interpretation, while preserving the CLI's ranking and unresolved duplicates.

Yarn v1 was removed from the claimed input formats. The parser accepts the `advisories` shape from pnpm and npm 6, but not yarn v1 NDJSON.

## 0.0.1

First preview. `judge` runs npm audit and OSV, combines shared advisories, ranks findings, and compares them with the recorded baseline. It provides text, JSON, and SARIF output. `hook` supplies current findings to a coding agent.
