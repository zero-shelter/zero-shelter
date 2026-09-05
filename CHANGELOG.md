# Changelog

## 0.0.9

**Five people from outside the team fixed something here.** Every contribution
below came from someone who found an issue, read the file, and sent a change:
manager-specific transitive advice (#143), a rendering defect in it (#155), the
action pins in the CI example plus a check that keeps them pinned (#157), the
scope of what a first run actually covers along with which scanner to reach for
per domain and under which licence (#177), and one flag a space out of line in
all three places the option list is written, with a test that now catches the
next one (#162).

**A scanner that crashed is not a scanner that is missing.** Three facts were
two messages, and neither said "timed out". A scanner ended at our own
120-second bound reported "produced no report", which reads as its fault rather
than ours; on Windows, where a missing command surfaces as an exit code instead
of `ENOENT`, any failure without output reported "not on PATH" and answered it
with install instructions for a tool that was already installed. Both then left
the run with one source and an exit code of 0. Absent, timed out and failed are
now distinguishable, and only the first earns install advice.

**One range written two ways is one range.** We built `< 0.2.4` from OSV's
event list and took `<0.2.4` verbatim from npm, then showed both as though the
sources disagreed about which versions were affected. On the pinned captures
that was every finding on three of four projects — 173 of 173 on NodeGoat, 51
of 51 on dvna, 11 of 11 on hackathon-starter. It also meant two findings with an
identical range could not match as suspected duplicates, which is the one thing
`possibleDuplicates` exists to do.

**An acceptance dated `9999-99-99` never expired.** The date check accepted
anything shaped like a date, and a string that sorts above every real one stays
accepted forever while the file looks like it has a deadline on it — which is
the exact failure the check's own comment says it was written to prevent. Real
dates only now, leap years included.

**The baseline records which versions were installed.** Nothing held the
version actually in the tree: `vulnerableRange` is a range and `fixedIn` is the
fix. It is the one piece of context a reader cannot recover later, and the one
a PURL needs. Recorded, not scoped — an acceptance still applies after the tree
moves, so a bump from one vulnerable version to another does not resurface a
decision somebody already made.

**Smaller things that were quietly wrong.** The plugin manifest still said
0.0.1 six releases on, and a check now keeps it in step. The committed baseline
is pinned to LF, so a Windows checkout no longer turns a one-line diff into a
whole file. `docs/STABILITY.md` is now linked from the README, from
`CONTRIBUTING.md` and from the CI skill — it existed since 0.0.8 and nothing a
reader follows pointed at it. The contract test asserts the last frozen key it
was not checking. And a CI comment claiming a gap was tracked, by an issue that
did not exist, now points at #154 and carries the measurement instead.

## 0.0.8

**The ratchet survives a second scanner.** README says the second source is the
premise rather than an optional extra, and following that advice used to turn a
quiet build red: accept 73 findings with npm audit alone, add osv-scanner, and
79 came back as new while 70 were announced as no longer reported. They had not
gone anywhere. A fingerprint is derived after merge and merge output depends on
who contributed, so the recorded key stops existing — 73 fingerprints with one
source, 82 with two, 3 shared. Accepted entries now carry the alias set the two
scanners agreed on, and a finding is matched on the exact fingerprint first and
a shared alias within the same package second. The same measurement now reports
9, and those 9 are real: findings only osv-scanner sees. A rescue by alias is
printed rather than done quietly.

**The baseline can be read by the person who has to defend it.** It was a list
of hex strings. Each acceptance now names its package, advisory and severity,
and may carry `reason`, `acceptedBy` and `expires` written by hand. An expired
acceptance returns to the report, which is what keeps an accepted list from
being a place things go to be forgotten. One entry per line, sorted, so a diff
moves one line.

**Every surface speaks the project's own dialect.** pnpm ignores a top-level
`overrides` key outright and yarn wants `resolutions`, so a pasted npm snippet
did nothing at all rather than failing loudly. Terminal, HTML, SARIF, JSON, the
copy-paste agent prompts and the hook now all write the remedy the way this
project reads it. Six repositories out of eight had no direct commands at all,
which makes that block the only advice those projects ever get.

**`clears N` is withheld where it cannot be checked.** The promise rests on
reading dependents' required ranges out of `package-lock.json`, and there is no
reader for `pnpm-lock.yaml` or `yarn.lock`. The number is left out and the
reason is printed.

**Two things the lockfile knows and no scanner reports.** A high in a test
runner and a high in something serving requests arrived with the same score,
side by side; findings now carry a scope read off the lockfile's own `dev` flag
and the summary splits the denominator. And `hasInstallScript` marks the
packages that execute code before any test runs — 13 of them on uptime-kuma —
which has no CVE and which nothing else surfaces. Both are labels. Neither
touches the score.

**How long a finding has been public.** Severity is assigned when an advisory is
written and never moves again, so it could say a finding was critical and could
not say anyone had eight years to act. `published` and the CVSS vector were
arriving on 453 and 424 of 453 findings and being discarded; they are carried
verbatim now, shown beside the finding, and kept out of the score — a CVSS
number is float arithmetic over a vector we did not compute.

**Which scanners ran is a fact about the run.** It used to be recovered from the
outstanding findings, so a run where everything was accepted recorded that no
scanner had run at all — precisely on the days the scan was healthy. A run with
one source now says why the reduction is zero rather than leaving `(0% less
noise)` to read as a broken tool.

**Interfaces a pipeline can bet on.** `docs/STABILITY.md` states what is frozen
below 1.0 — the exit codes, and the top-level shape of `--format json` — with a
contract test that asserts it against real output rather than restating it.

**`zero-shelter hook --input`.** The surface an agent reads on every prompt was
the only one that could not be exercised offline. It also had not learned the
package manager, was still printing a count it could not verify, and could not
see an expired acceptance that `judge` was failing the build over.

**A history that cannot be written no longer sinks the run.** `--record` was
discarding a finished judgement and returning the code that means "could not
judge". Recording is bookkeeping: the failure is named on stderr and the run
keeps the exit code it earned.

**The onboarding skill stopped calling the second scanner optional**, and the
command it offered for checking that osv-scanner had actually run answered
backwards — `skipped` names the scanner when it is *missing*, so a failed
install counted as success.

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
