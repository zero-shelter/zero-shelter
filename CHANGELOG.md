# Changelog

## 0.0.7

**`clears 12` cleared nothing.** uptime-kuma has `tar@~6.2.1` in its
package.json, so npm audit calls tar direct and we printed `npm i tar@7.5.22
clears 12`. Running it changed 71 findings to 71. `cacache`, `node-gyp`,
`@louislam/sqlite3` and `@mapbox/node-pre-gyp` each require `tar@^6`, no `^6`
range accepts a 7, and npm gave them their own copy of the old version. The
count of copies in the lockfile does not catch this, because the copies only
split apart once the upgrade runs.

The lockfile does say who requires what, so we read it. A command is only
offered when every dependent's range accepts the fix; the rest move to the
`overrides` path they always needed. On uptime-kuma that is ten commands down to
three, and those three now clear exactly the eleven they promise — 71 to 60, in
66 lockfile lines. `npm audit fix --force` moves 3,489 and leaves eight behind.

**And it says why.** "Use overrides instead" was advice you had to take on
faith. The report now names the packages holding the old version, so the reason
is something you can check rather than trust.

**The agent hook and SARIF were still handing them out.** The report had
stopped, but the hook never read the lockfile and SARIF's remedy had nothing to
check against, so both kept printing `npm i tar@7.5.22   # clears 12`. These are
the two worst places for it: an agent runs what it is given, and a Security tab
alert stays open after the command that was supposed to close it. Both go
through the same check now.

## 0.0.6

**Nothing is dropped quietly.** The report showed the last twelve recorded runs
out of however many exist, the prompt for findings with no published fix named
eight packages out of however many there were, and the agent hook listed five
commands out of nine. An agent handed 8 of 324 works through eight and reports
the job done. All three now say the number they did not show and where the rest
are, and stay quiet when nothing is hidden.

**The contrast we promised.** PRODUCT.md says text meets WCAG AA; the faint ink
behind labels and column headers sat at 3.11 against paper, where 4.5 is the
bar. It is 4.56 now, and a test measures all eight pairs rather than trusting
the claim.

**Copying works where the report is opened.** The button assumed a clipboard
API, which browsers refuse or omit for pages opened from disk — the report's
whole purpose. It falls back to execCommand, and then to selecting the text and
saying so.

**Ready for a language neither of us speaks.** The layout used physical CSS
properties, so a right-to-left translation would have arrived with its numbers
and indents on the wrong side. It uses logical properties now, direction
follows the language, and CONTRIBUTING says the three steps for adding a
catalogue in both languages.

**Claims that had no check now have one:** that the tool opens no sockets, that
a run writes nothing to the repository unless asked, that scoring is integer
arithmetic, and that the verdict is never a count of things "fixed". One claim
was corrected instead — the invariant about hashing secrets describes a
capability v1 does not have, and now says so.

## 0.0.5

**The report says what to do about it.** The command block explains what a line
does before listing any, so "clears 7" reads as a consequence. Under it, three
prompts generated from the actual findings — upgrade the direct ones, show what
an `overrides` entry would look like for the transitive ones, check reachability
for the ones with no published fix — each ending by re-judging, because an agent
told only to upgrade reports the upgrade rather than the result. Every command
and prompt has a copy button. A folded glossary says what reported, after merge,
outstanding, accepted and the rest actually mean.

In a workspace the generated prompt sends the agent to find the package.json
that declared the range, because pasting the plain command at the root installs
into the root.

**A skill for the baseline.** Accepting a finding is the decision this tool is
most likely to be misused for. `/zero-shelter:baseline` asks the two questions
that separate a reasonable accept from a lazy one, and says plainly that
recording is never a way to end a task or green a build.

**Plainer sentences, in both languages.** Two English messages were three
clauses strung together with dashes. The Korean went through a detector and two
reviewers: a comma after a connective ending appeared 24 times, 3.7x what
Korean prose does, and one contrastive frame carried 13 of the document's
turns. Both are down, and the five contrasts that survived are the ones where
the contrast is the claim.

The reviews caught two failures in opposite directions — a rewrite that quietly
dropped the precision disclaimer this project has promised never to drop, and
one that removed every comma a person would also have written. Both corrected.

## 0.0.4

**A page to look at.** `judge --format html --output report.html` writes one
self-contained file: the commands to run first, then every finding with the
score that put it there and the weights table underneath, so a reader who
disagrees with the order can point at a row. No network, no build step, light
and dark both switchable without JavaScript, and Korean with `--lang ko`.

Deliberately not a dashboard. No donut charts, no composite risk score — both
would be inventions of the presentation layer, and inventing there would undo
the property this tool sells.

**A history.** `judge --record` appends one line per run to
`.zero-shelter/history.jsonl`, and `zero-shelter history` says what appeared and
what stopped being reported between runs. It keeps fingerprints rather than
counts, because counts cannot tell "two fixed and two appeared" from "nothing
changed". Nothing is recorded unless asked, and the report grows a section once
two runs exist.

It says *no longer reported*, never *fixed*: a finding also leaves the list when
it is accepted into the baseline, and when the scanner that found it did not
run.

**Two more skills.** `/zero-shelter:fix` applies the upgrades and re-judges to
confirm they landed — including the transitive ones `npm i` cannot reach.
`/zero-shelter:ci` puts the gate in a pipeline, baseline first, so the build
fails on what a change introduced rather than on the backlog it inherited. Both
were rewritten after watching an agent verify a fix with `npm audit` and skip
the CI skill entirely.

## 0.0.3

**A second scanner no longer deletes the advice.** npm audit names the version
it would install; osv-scanner names the release that patched the advisory. The
merge saw two answers, called it a disagreement and withheld both — so
installing the second source this project tells everyone to install removed
every upgrade command from the report. It now reports the highest claimed
version, which satisfies all of them, and `--explain` shows that they differed.

**The report says what to run.** Seven findings on one package are one upgrade,
and the report listed them seven times sorted by severity. Now:

```
npm i lodash@4.18.1   clears 7
35 finding(s) in 11 package(s) have a published fix but arrive through another
dependency — package.json "overrides" forces one, at the risk of breaking
whatever pinned it
```

Transitive packages are counted rather than commanded: `npm i` on one adds a
top-level entry and leaves the vulnerable copy alone. In a workspace the report
says the command needs a `-w`, because hoisting hides which workspace declared
the range.

**`--top` is a display limit again.** It was deciding what the report claimed:
`--top 3` on a project with 82 outstanding findings announced "3 to fix (98%
less noise)". The counts, the percentage and the advice are about the project;
`--top` decides how many rows are printed.

**pnpm projects work.** The lockfile decides which audit runs, so a
`pnpm-lock.yaml` no longer ends in "nothing was scanned". yarn works through
osv-scanner, which reads `yarn.lock`; without it, the run says so and points at
the shortest way out.

**Merging got fast.** Sibling detection compared every finding with every other
one: 7,500 findings took a second, and a large tree produces more than that.
One grouping pass instead — 30ms for the same input, 151ms for 37,400.

**Published from CI.** Releases go out through GitHub Actions with OIDC
trusted publishing — no token exists to leak, and every tarball carries
provenance tying it to the commit and the run that built it.

**Smaller things.** `zero-shelter hook` hands agents the commands, not just the
diagnosis, and honours `--baseline`. SARIF alerts carry the remedy into the
Security tab. `--explain` prints the weights as a table to argue with, and
names possible duplicates by advisory instead of by fingerprint. A broken
baseline, an unwritable `--output`, and this tool's own SARIF passed to
`--input` all get answers instead of stack traces or puzzlement.

## 0.0.2

**A project nobody scanned no longer reports clean.** In a directory with no
lockfile, `npm audit` fails, and the run used to continue with zero findings —
printing `✓ nothing new to fix` and exiting 0. In CI that turns a project the
scanners never opened green, which is worse than a crash because a passing
build gets no attention. It now exits 2 and repeats npm's own explanation
(`This command requires an existing lockfile. Try creating one first with: npm
i --package-lock-only`) instead of our parser's complaint about missing keys.
Scanned-and-found-nothing still exits 0.

**An old Node says so.** `engines` only makes npm warn at install time. Running
on Node 18 produced a stack trace pointing into our files, which reads as our
bug; it now names the version needed and the one running, and exits 2.

**`--version` and `version`.** Bug reports can name a version.

**Claude Code plugin.** `/plugin marketplace add zero-shelter/zero-shelter`
installs two skills: `setup` runs the first scan and offers the CI and hook
wiring, `explain` reads a run and says what to fix first. Both are presentation
only — they are instructed not to re-rank, filter, or merge anything the CLI
left flagged, because the judgement has to stay where the same input produces
the same checkable answer.

**Dropped yarn v1** from the report formats we claim to read. We parse the
`advisories` shape pnpm and npm 6 emit; yarn v1 writes NDJSON, which we do not
read.

## 0.0.1

First preview. `judge` runs npm audit and osv-scanner, reconciles what they
both found, ranks it, and reports only what is new since the recorded baseline.
Text, JSON and SARIF output. `hook` hands the current findings to a coding
agent.
