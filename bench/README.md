# Benchmark

Measures the judge against repositories we did not write. A benchmark over
fixtures the tool's own authors made proves nothing, so every target here is an
external project pinned to a commit.

## Current numbers (no labels yet — volume only)

Captured 2026-08-07 with npm 11.4.2 and osv-scanner 2.5.0, frozen under
`captures/`:

| repo | pinned | raw reports | after judge | reduction | cross-source joins |
|---|---|---|---|---|---|
| juice-shop | `a520e158cb65` | 155 | 82 | 47% | 73 |
| NodeGoat | `c5cb68a7084e` | 360 | 173 | 52% | 187 |
| dvna | `9ba473add536` | 106 | 51 | 52% | 55 |
| hackathon-starter | `4ee09b39f109` | 24 | 11 | 54% | 13 |

Reproduce with `npm run build && node bench/evaluate.mjs`. Reads only the
committed captures — no network, no scanners.

## Labelling: what a human is actually asked to do

The per-finding sheets (`<repo>.template.tsv`, 645 rows) ask whether each raw
finding is worth fixing. That is a question about the scanners — they produced
the list, and a labeller working through 645 of them is grading npm audit and
osv-scanner rather than this tool. Two people doing it is 1,290 judgements, and
it will not get done.

This tool makes two decisions of its own, and those are the ones a benchmark can
grade:

| sheet | rows | what it asks | getting it wrong means |
|---|---|---|---|
| `holds.template.tsv` | 57, every one | should these two have been joined? | caution cost a duplicate |
| `joins.template.tsv` | 71, sampled from 308 | did these reports describe one advisory? | a false join hid an advisory |

128 rows. Two people can finish that.

`holds` is the census and the more interesting sheet: every row is a pair we
declined to join because they share no identifier, which is the most argued line
in the design. A labeller saying "those were obviously the same" is telling us
the caution costs more than it saves.

`joins` is sampled, because 308 is not a census anyone finishes. The sheet says
so, and any figure drawn from it carries that caveat.

```bash
node bench/make-decision-sheets.mjs     # regenerate the templates
node bench/score-labels.mjs             # after two people have filled them
```

### The rules that make this worth anything

- **Two people, independently.** One person's reading is not ground truth, and
  the scorer refuses to report a figure from a single sheet.
- **Cohen's kappa is printed.** Raw agreement flatters: if most rows are
  obviously one answer, two people agreeing 90% of the time have told you
  nothing. Below 0.6 the scorer says so and declines to stand behind the number.
- **Disagreements are printed, not averaged away.** A row two careful readers
  read differently is the most interesting row on the sheet, and how it was
  settled belongs in the repository.
- **No model fills a label in.** An answer key produced by the tool being graded
  is not an answer key, and it is the first thing anyone reading this will check.
- **Labels commit before any ranking change they would justify.** The order has
  to survive in the git history.

### What these numbers do and do not say

They say the two sources describe the same advisories under different names
about half the time, and the judge reconciles that. **They do not say the
remaining findings are the right ones.** Precision and the dropped-finding rate
require ground truth, which does not exist yet — see below. Until it does, the
honest claim is *fewer items*, not *the right items*.

Two capture caveats, recorded in each `meta.json` rather than smoothed over:
juice-shop and dvna had no lockfile at the pinned commit, so one was generated
at capture time against the live registry; and every number above depends on
the advisory databases as of the capture date.

## Layout

```
bench/
├── repos.json              pinned targets and why each was chosen
├── capture.mjs             one-time freeze (the only step that goes online)
├── evaluate.mjs            captures → the table above
├── make-label-sheets.mjs   captures → blind labelling sheets
├── captures/<repo>/        frozen scanner output + meta.json
└── labels/                 human ground truth (see protocol)
```

## Labelling protocol (human-only)

This is the part that cannot be automated, by design. Proving the tool works
against ground truth a model generated is circular — and this project runs no
LLM precisely so that its behaviour is checkable. We do not get to break that
rule for our own benchmark.

1. **Two labellers, independently.** Copy `labels/<repo>.template.tsv` to
   `labels/<repo>.<github-login>.tsv` and fill the `label` column:
   `real` (worth fixing in this repo), `noise` (not actionable here), or
   `dup` (same issue as another row — name its fingerprint in `notes`).
2. **Blind.** The sheets are generated from raw per-source findings in
   fingerprint order and contain nothing of the judge's merging or ranking.
   Do not run `zero-shelter judge` on the targets, and do not read the other
   labeller's file, until both are committed.
3. **Commit from your own account.** The git history is the evidence that two
   people labelled independently.
4. **Disagreements** are settled in a recorded discussion and the consensus
   goes to `labels/<repo>.final.tsv`, alongside Cohen's κ for the two sheets.
   Low κ is a finding in itself: it means "real" was underspecified, and the
   definition gets tightened before the consensus pass.

One honest limitation to state rather than hide: the ranking code existed
before these labels. The blindness of the sheets and the independence of the
labellers is the mitigation, and weights were not tuned against any labelled
data — there was none. After labels land, any weight change must cite them.

## With labels, `evaluate.mjs` gains

- **precision of "fix these N"** — how many of the top findings are `real`
- **dropped-finding rate** — `real`-labelled findings that the judge suppressed
  or merged away. Target: zero. This is the number that matters most, because a
  deduplicator that eats a real vulnerability is worse than no deduplicator.
- **false merges** — rows labelled as distinct that the judge joined
- a comparison against the obvious baseline: sorting raw output by severity.
  If we only match it, that is what gets published.
