---
description: Run zero-shelter on this project for the first time and wire it in. Use when someone asks to check dependency vulnerabilities, cut down scanner noise, or install zero-shelter. Korean requests look like: 의존성 취약점 점검해줘, 보안 스캔 돌려줘, zero-shelter 설치.
---

# First run

Two things, and the second one is not optional.

```bash
npx --yes zero-shelter judge          # no install needed for this one
```

Read the exit code — it is the answer, not decoration:

| Exit | Meaning | What to do |
|---|---|---|
| 0 | Scanned, nothing new to fix | Say so and stop |
| 1 | New findings | Walk through them (see `/zero-shelter:explain`) |
| 2 | **Could not judge** | Never report this as clean. The message says why — usually no lockfile, so `npm i --package-lock-only` first |

Requires Node 20+. If it prints a Node version message, that is the whole
problem; do not try to work around it.

## The second scanner

This tool reconciles what two scanners each called by a different name. With one
source there is nothing to reconcile, so **install `osv-scanner` before judging
the result of a first run.** Measured on uptime-kuma: npm audit alone reports 71
and leaves 71; add osv-scanner and it is 142 in, 71 out.

```bash
brew install osv-scanner        # macOS / Linuxbrew
go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest
```

Neither works everywhere. If both fail, the releases page has prebuilt binaries,
and that is a better answer than proceeding with one source and explaining a 0%.

**Then check it actually ran**, rather than assuming the install worked:

```bash
npx --yes zero-shelter judge | grep -q "one source" && echo "STILL ONE SOURCE"
```

A run with one source ends its summary with `one source, nothing to reconcile`.
If that phrase is on screen the second scanner is not contributing, whatever
`brew` printed.

Do not grep the JSON for `osv-scanner`. It appears in `skipped` when the
scanner is **missing**, so the count is non-zero in exactly the case the check
is supposed to catch — an earlier version of this skill said to do that and had
it backwards.

Do not describe a one-source run as a normal result. It is a valid way to run
this and the ranking and baseline still work, but the deduplication this tool
exists for is switched off, and a reader who is not told that will conclude the
tool does nothing.

## Recording the backlog

A project that has never run this has a backlog it inherited. Fixing all of it
today is not the goal, and failing CI on it teaches people to switch the gate
off.

```bash
npx --yes zero-shelter judge --update-baseline
```

From then on only new findings are reported and CI fails on the regression this
change introduced. Explain that trade before running it: **anything recorded is
no longer shown**, so run it when the current list has actually been looked at,
not to make output disappear.

## After someone fixes something

Re-run `judge`. Findings that were accepted and are no longer reported get their
own line, so the work that was just done is visible instead of showing up as a
number quietly getting smaller. If a scanner that contributed to the baseline
did not run this time, that line says so — do not upgrade "no longer reported"
into "fixed" when the CLI itself is hedging.

Prune the baseline afterwards with `--update-baseline` so it stops listing
fingerprints nothing produces.

## A page for a human

```bash
npx --yes zero-shelter judge --format html --output zero-shelter.html
```

One self-contained file: the commands first, then every finding with the score
that put it there. Offer it when someone wants to look for themselves, share a
state with a teammate, or read it in Korean (`--lang ko`). It needs no network
and no server; opening the file is enough.

## Keeping a history

```bash
npx --yes zero-shelter judge --record
npx --yes zero-shelter history
```

`--record` appends one line per run to `.zero-shelter/history.jsonl`; nothing is
recorded unless asked. `history` shows what appeared and what stopped being
reported between runs, and the html report grows a section once two runs exist.

Suggest `--record` when a project is going to be judged repeatedly — in CI, or
alongside a baseline. Do not turn it on silently: it writes a file into their
repository, and that is their decision.

## Wiring it in

Offer these; do not add them unasked.

**CI** — append to an existing workflow:

```yaml
- run: npx zero-shelter judge --format sarif --output zero-shelter.sarif
  continue-on-error: true

- uses: github/codeql-action/upload-sarif@6f5948dfacef28e207b48d0905cf90c03365536d # v3.37.9
  with:
    sarif_file: zero-shelter.sarif
```

**Coding agent context** — `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "npx zero-shelter hook" }] }
    ]
  }
}
```

The hook puts the current findings into the session so an agent does not add a
dependency this project already has an unfixed advisory for. It never blocks a
prompt and never fails.

## What this skill must not do

- **Do not re-rank, re-judge, or filter the findings.** The ordering is
  computed by the CLI and is reproducible; anything you add on top is not, and
  the entire point of this tool is that its judgement can be checked.
- **Do not report a 0% reduction as a result.** It means one source ran. Say
  which one is missing and offer to install it.
- Do not run `--update-baseline` without saying what it hides.
- Do not describe a run that exited 2 as passing.
