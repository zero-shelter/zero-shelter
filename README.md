# zero-shelter

[English](./README.md) · [한국어](./README.ko.md)

zero-shelter reads dependency vulnerability reports, combines findings with
shared advisory identifiers, and lists supported upgrade commands in priority
order. It also compares runs against findings you have accepted into a baseline.
Use the results directly or give the same commands and evidence to a coding agent.

The [npm package](https://www.npmjs.com/package/zero-shelter) is a preview.
See the [compatibility contract](./docs/STABILITY.md) before depending on its
exit codes or output formats. [Product](./PRODUCT.md) · [Roadmap](./docs/ROADMAP.md)

## First run

Requires Node.js 20 or later and a supported project lockfile:

```bash
npx zero-shelter judge
```

The report lists outstanding findings, the scores used to order them, direct
upgrade commands where available, and separate advice for indirect dependencies.
A finding can remain outstanding when the input supplies no fixed version.

For a reproducible example, run this in a checkout of this repository:

```bash
npm ci
npm run build
node dist/bin.js judge --input test/fixtures/npm-audit.json --json
```

The fixture produces the following `summary` (excerpt from the JSON output)
and exits `1`. It is test data, not a scan of the checkout's dependencies:

```json
{
  "raw": 4,
  "merged": 4,
  "fixNow": 4,
  "shown": 4,
  "accepted": 0,
  "noLongerReported": 0
}
```

| Exit code | Meaning |
|---|---|
| `0` | A judgement was produced with no new findings. Accepted findings may remain. |
| `1` | New findings need review. |
| `2` | A judgement could not be produced. Read the error; do not treat this as a pass. |

On a clean run, the report also states the dependency-only boundary using only
artifacts present in the project. It does not scan or judge those domains: for
example, secrets are always outside this tool, while Dockerfiles, workflows,
and infrastructure are mentioned only when the corresponding files exist.
If an optional scope check cannot complete, JSON sets `unscanned.complete` to
`false` and the human line says so; `false` or `0` then is not evidence that an
artifact is absent.

## Install

Run through `npx`, or install the CLI with `npm i -g zero-shelter`.
The lockfile selects the package manager and live scanner inputs:

| Lockfile | Built-in audit | OSV-Scanner |
|---|---|---|
| `package-lock.json` | `npm audit` | Optional additional source |
| `pnpm-lock.yaml` | `pnpm audit` | Optional additional source |
| `yarn.lock` | Not collected by this tool | Required for live collection |

To add OSV-Scanner, use `brew install osv-scanner` or a binary from the
[official releases](https://github.com/google/osv-scanner/releases).
Check the report's contributing and skipped sources after installing it.
A supported single-source run provides ranking, baseline comparison and
remediation advice. Multiple sources can add findings or fixed versions and
allow reconciliation where identifiers overlap.

`--input` reads stored npm/pnpm audit or OSV JSON reports without invoking
scanners. It does not read SARIF or yarn v1's NDJSON output. Older npm audit
reports can provide a patched range; a stable inclusive lower bound can become
an upgrade target. Exclusive, prerelease and compound ranges remain without a
command when a safe target cannot be selected. `<0.0.0>` means no published fix.

Judgement runs locally with no runtime LLM, telemetry or network requests of
its own. Invoked scanners may use the network and repository configuration.
Local execution is not a sandbox; see [Security and privacy](./SECURITY.md).

## Use the results

### Directly

Read the terminal report or save a self-contained HTML report:

```bash
npx zero-shelter judge --format html --output report.html
npx zero-shelter judge --format html --lang ko --output report.ko.html
```

Open the file in a browser. It includes commands, copyable agent prompts,
findings and their scores, baseline comparisons, and a glossary. It works
offline without a server. `--stamp "..."` adds an optional footer line.

Use the generated commands for direct upgrades. Indirect dependencies need
the package manager's override or resolution mechanism; forcing a version can
break the parent package that requested the old one. Review that tradeoff before
applying the report's advice. On pnpm and yarn, the report withholds remediation
counts it cannot verify. Workspace commands may need a workspace target.

After an upgrade, run `zero-shelter judge` again and run the project's tests
and build. Compare contributing sources as well as findings.

### With a coding agent

The HTML report includes prompts based on the same remediation advice. The
Claude Code plugin also provides these workflows:

```
/plugin marketplace add zero-shelter/zero-shelter
/plugin install zero-shelter@zero-shelter
```

| Skill | Purpose |
|---|---|
| `/zero-shelter:setup` | Run the first scan and explain scanner coverage. |
| `/zero-shelter:explain` | Interpret findings and the printed ranking. |
| `/zero-shelter:fix` | Apply agreed upgrades and re-run the judgement. |
| `/zero-shelter:baseline` | Review acceptance decisions and baseline maintenance. |
| `/zero-shelter:ci` | Add a CI check and optional report upload. |

The agent must use the generated commands and ranking, preserve unresolved
possible duplicates, and ask the user to decide whether to accept findings or
force indirect dependency versions. Installing the plugin does not authorize
those risk decisions.

pnpm projects work the same way: a `pnpm-lock.yaml` makes it run `pnpm audit`
instead. npm 6's older report shape is read too. That shape carries a patched
range rather than one version; when it names a stable version as an inclusive
lower bound, zero-shelter passes that version through to the package-manager
command. Exclusive, prerelease, and compound ranges remain without a command
until they can be selected safely; `<0.0.0>` remains "no published fix".

yarn has no second source without `osv-scanner` and no first source either —
`npm audit` cannot read `yarn.lock`, and yarn v1 writes NDJSON, which this tool
does not parse. `osv-scanner` reads `yarn.lock` directly, so for yarn it is the
only source there is.

## In CI

```yaml
- run: npx zero-shelter judge --format sarif --output zero-shelter.sarif
  continue-on-error: true

- uses: github/codeql-action/upload-sarif@6f5948dfacef28e207b48d0905cf90c03365536d # v3.37.9
  with:
    sarif_file: zero-shelter.sarif
```

Findings land in the Security tab and annotate the pull request, each one
carrying what to do about it — `npm i lodash@4.18.1` for a direct dependency,
or the `overrides` entry that forces a transitive one. Fingerprints are stable
across machines and runs, so GitHub recognises an alert it has already seen
instead of reopening it every build.

When an advisory supplies a CVSS vector, each SARIF result preserves it exactly
as `properties.cvssVector`. GitHub's numeric `security-severity` remains a
coarse severity-band fallback because the scanner output supplies vectors but
no numeric score; zero-shelter does not derive one with floating-point math.
SARIF also identifies the zero-shelter package version and preserves scanner
versions when a source provides them.

Some advisory sources do not state a severity band. In that case zero-shelter
keeps the compatibility value `info`, adds `severityKnown: false` to JSON, and
shows `unknown` in the terminal and “severity not stated by source” in HTML. It
gives that finding no severity-band ranking points. SARIF omits the numeric
`security_severity` fallback for it instead of inventing a score.

There is an irony here worth naming: this project exists because SARIF from
different tools cannot be reconciled by the tools that consume it. Emitting
SARIF is not a contradiction — downstream receives one already-judged run
instead of four raw ones it will fail to merge.

Before you gate a build on a `0.0.x` tool, [`docs/STABILITY.md`](./docs/STABILITY.md)
says which surfaces are frozen and which can change in a patch. The version
number says the feature set is moving; it does not say the exit codes are.

## In your coding agent

A coding agent starts every session blind to what is already broken here, and
will add a dependency this project has an unfixed advisory for. `zero-shelter
hook` hands it the same short list you get.
For context on each prompt, configure `zero-shelter hook` in
`.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "npx zero-shelter hook" }] }
    ]
  }
}
```

The hook provides dependency findings to the agent. It is non-blocking: errors
produce no context and exit `0`. See the [hook guide](./docs/AGENT-HOOK.md) for
setup and failure behavior.

### In CI

```bash
npx zero-shelter judge
```

A script step can use the exit codes above. For GitHub Security results, use
[the complete GitHub Actions example](./examples/github-action.yml). It uploads
SARIF even when findings are present, then preserves the failed judgement as
the job result. It requires `security-events: write` permission.

SARIF uses stable fingerprints. When supplied by an advisory, `cvssVector` is
preserved; `security_severity` uses a severity-band fallback, not a calculated
CVSS score. The output also includes package and available scanner versions.

## Baseline and history

A baseline records findings that the project owner has reviewed and accepted.
It is optional. Without one, every current finding is outstanding.

Only after reviewing the findings and deciding to accept them:

```bash
npx zero-shelter judge --update-baseline
```

This records the current findings in `.zero-shelter/baseline.json`; it does not
remediate them. Commit a baseline if CI should use it. Entries may include a
reason, owner and expiry. Rewriting the baseline also accepts newly outstanding
findings, so do not automate this command or use it merely to clear a report.
See [known baseline limitations](./PRODUCT.md#current-capabilities).

Subsequent runs compare against those decisions. “No longer reported” can mean
that a finding was remediated or that its scanner did not run. Missing baseline
sources qualify the comparison in text and in JSON's `missingSources`.
A zero exit code does not establish that the project is free of vulnerabilities.

History is opt-in:

```bash
npx zero-shelter judge --record
npx zero-shelter history
npx zero-shelter history --json --last 10
```

Each recorded run appends counts and fingerprints to
`.zero-shelter/history.jsonl`. History distinguishes added and removed
outstanding findings; removal can also reflect acceptance or a missing source.
The `accepted` count is the number of baseline entries matched by that run,
not the total number stored. HTML includes history when enough runs exist.

## Limits and measurement

The tool handles dependency findings. It does not inspect all source code,
secrets, infrastructure or workflows, or determine whether a vulnerable code
path is reachable in this project.

Findings merge only when advisory identifiers overlap. `possibleDuplicates`
remain separate and unresolved. See
[Discussion #25](https://github.com/zero-shelter/zero-shelter/discussions/25)
for the reconciliation tradeoffs.

The benchmark uses frozen scanner outputs from four external projects pinned
by commit:

| Project | Raw reports | After merging | Reduction |
|---|---:|---:|---:|
| juice-shop | 155 | 82 | 47% |
| NodeGoat | 360 | 173 | 52% |
| dvna | 106 | 51 | 52% |
| hackathon-starter | 24 | 11 | 54% |

`npm run build && node bench/evaluate.mjs` reproduces these counts offline.
They measure report volume for these captures, not ranking precision, security
improvement or a typical result for another project. Human-labelled evaluation
is planned; no precision result is claimed. See the
[benchmark protocol and limitations](./bench/README.md).

<a id="design-invariants"></a>

Ranking uses integer weights, and fingerprint inputs use shared normalization.
The CI matrix tests on Ubuntu, macOS and Windows. The weights are available with
`--explain`; [stability guarantees](./docs/STABILITY.md) define the public contracts.

## Options

```
--input <file>        read scanner output instead of running scanners (repeatable)
--format <fmt>        text (default) | json | sarif | html
--lang <code>         language for the HTML report: en (default) | ko
--stamp <text>        optional line in the HTML footer
--json                shorthand for --format json
--output <file>       write to a file instead of stdout
--explain             show how each score was reached
--top <n>             print at most n rows (the counts and advice stay about
                      the whole project)
--record              append this run to .zero-shelter/history.jsonl
--update-baseline     record current findings as accepted
--baseline <file>     baseline location (default .zero-shelter/baseline.json)
--cwd <dir>           project directory
--no-color            disable ANSI colors in text output
--version             print the installed package version
--help                print this help
```

`--no-color` affects human-readable text only and overrides `FORCE_COLOR`.
The existing `NO_COLOR` environment variable remains supported.

`zero-shelter version` is an equivalent command for scripts and users who prefer subcommands.

`zero-shelter history [--json] [--last <n>]` shows the recorded changes between
runs. Nothing is recorded unless `judge --record` is requested.

`zero-shelter why <package>` reads the local npm lockfile and prints every path
from a direct dependency to each installed copy of that package. It also shows
fixed-version context from scanner output when available. Pass `--input` one or
more times for an offline, repeatable report; without it, the existing scanners
are collected like `judge` and keep their existing subprocess/network boundary.
The command never installs packages or adds a registry lookup of its own, and it
reports only versions the lockfile can establish.

`--explain` prints every point awarded and the weights table it came from, so
the ranking can be argued with rather than trusted.

## Troubleshooting

| Message or condition | Next step |
|---|---|
| No scanner produced a report | Check for a supported lockfile and read the skipped-source reasons. Generate a lockfile with the project's package manager if needed. |
| `yarn.lock` could not be read | Install OSV-Scanner for live collection. |
| Node version error | Use Node.js 20 or later. |
| OSV-Scanner is not on PATH | Check installation and PATH. npm/pnpm audit can still provide a single-source judgement. |
| SARIF passed to `--input` | Supply npm/pnpm audit or OSV JSON; SARIF is an output format. |
| Baseline is not valid JSON | Inspect the file and restore a valid copy from version control. Do not discard acceptance records or re-accept findings without review. |

## Documentation and contributing

- [Product](./PRODUCT.md) and [roadmap](./docs/ROADMAP.md)
- [Architecture](./docs/architecture.md) and [v1 scope](./docs/v1-scope.md)
- [Agent guidance](./AGENTS.md) and [hook setup](./docs/AGENT-HOOK.md)
- [Contributing](./CONTRIBUTING.md), [governance](./GOVERNANCE.md), and [security policy](./SECURITY.md)
- [Feature spec template](./docs/feature-spec-template.md), [QA checklist](./docs/qa-checklist.md), and [Beta QA Guide](./docs/qa/README.md)
- [Third-party notices](./THIRD_PARTY.md) ([한국어](./THIRD_PARTY.ko.md))

Start with a focused [issue](https://github.com/zero-shelter/zero-shelter/issues).
Changes require the review and validation described in the contribution guide,
including human review of agent-assisted changes. English is canonical; report
translation differences as documentation bugs.

For local development:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run third-party   # regenerate notices when dependencies change
npm run qa            # inspect and install a packaged tarball in a temporary project
npm run qa:agent      # verify the hook, skills, HTML prompts and plugin manifest
```

Node 20 or later.

## Contributing

Contributions are welcome, including disagreement with the design.

One review rule is unusual enough to state up front:

> **A reviewer who cannot describe an input that breaks the change does not
> approve it.**

Not comment count. An agent can write four hundred lines in three minutes, and a
human will approve four hundred lines in three minutes to match — at which point
the code and its tests share the same misunderstanding and nobody notices.

See [CONTRIBUTING.md](./CONTRIBUTING.md).

Feature specifications and QA evidence use the [spec template](./docs/feature-spec-template.md),
[QA checklist](./docs/qa-checklist.md), and [Beta QA Guide](./docs/qa/README.md). The repository
also provides GitHub issue and pull request templates for feature, bug, and security-control
contributions.

Looking for somewhere to start? [`good first issue`](https://github.com/zero-shelter/zero-shelter/labels/good%20first%20issue)
names the file and the line, gives a command that reproduces the defect, and says
which part needs a judgement rather than typing.

If it turned out useful, a star helps other people find it. If it did not, an
issue saying why is worth more.

[![Star history](https://api.star-history.com/svg?repos=zero-shelter/zero-shelter&type=Date)](https://star-history.com/#zero-shelter/zero-shelter&Date)

The report also includes source attribution: findings unique to one scanner are
listed with severity counts, while findings reported by multiple sources are
counted separately. These are run facts, not a score or a recommendation about
which scanner is correct.

## License

[Apache-2.0](./LICENSE)
