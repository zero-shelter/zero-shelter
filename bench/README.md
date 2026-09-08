# Benchmark

This benchmark measures judgement results on external projects pinned to commits. Synthetic fixtures remain useful for regression tests; the captures here provide examples from other dependency trees.

## Captured report counts (no human labels yet)

Column label corrected 2026-09-09: `raw - merged` includes merges within a single
source. The recorded counts are unchanged.

Captured 2026-08-07 with npm 11.4.2 and osv-scanner 2.5.0, frozen under
`captures/`:

| repo | pinned | raw reports | after judge | reduction | reports combined (raw - merged) |
|---|---|---|---|---|---|
| juice-shop | `a520e158cb65` | 155 | 82 | 47% | 73 |
| NodeGoat | `c5cb68a7084e` | 360 | 173 | 52% | 187 |
| dvna | `9ba473add536` | 106 | 51 | 52% | 55 |
| hackathon-starter | `4ee09b39f109` | 24 | 11 | 54% | 13 |

Reproduce with `npm run build && node bench/evaluate.mjs`. Reads only the
committed captures — no network, no scanners.

The same command also prints an actionability table: findings with a named fix
version, direct upgrade commands, and transitive advice for npm audit alone
versus both sources. Those counts describe what this repository can recommend
from the captures; they are not precision or a claim that every finding is
worth fixing.

## Labelling: what a human is actually asked to do

The per-finding sheets (`<repo>.template.tsv`, 645 rows) ask whether each raw scanner finding is worth fixing. Separate decision sheets focus on zero-shelter's merge decisions:

| Sheet | Rows | Question | Error being measured |
|---|---|---|---|
| `holds.template.tsv` | 57, every held pair | Should these two have been joined? | An unnecessary duplicate remains |
| `joins.template.tsv` | 71, sampled from 308 joins | Did these reports describe one advisory? | A false join hides an advisory |

The decision sheets contain 128 rows for each of two independent labellers. `holds` covers every pair that lacked a shared identifier. `joins` is a sample; results from it must retain that sampling limitation.

```bash
node bench/make-decision-sheets.mjs     # regenerate the templates
node bench/score-labels.mjs             # after two people have filled them
```

### Label requirements

- Two people label independently. The scorer does not report a figure from one sheet.
- The scorer prints Cohen's kappa to account for chance agreement. Below 0.6 it flags the result and withholds the supported figure.
- Disagreements are printed and resolved in a recorded discussion.
- Models must not fill in labels.
- Commit labels before any ranking change they justify, preserving that order in Git history.

### Limits of the counts

These captures show how often the two scanners' reports can be combined using shared advisory identifiers. They do not establish whether the remaining findings are worth fixing. Precision and the dropped-finding rate require human ground truth, which is not available yet.

Each `meta.json` records two capture limitations: juice-shop and dvna had no lockfile at the pinned commit, so one was generated against the registry at capture time; all counts depend on the advisory databases available on that date.

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

Human labels are required for evaluating the tool's decisions. Model-generated labels are not accepted as ground truth.

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

The ranking code predates these labels. Blind sheets and independent labellers limit evaluation bias; the weights were not tuned against labeled data. After labels are committed, any weight change must cite them.

## Planned evaluation after labeling

- **precision of "fix these N"** — how many of the top findings are `real`
- **dropped-finding rate** — `real`-labelled findings that the judge suppressed
  or merged away. Target: zero.
- **false merges** — rows labelled as distinct that the judge joined
- a comparison against the baseline: sorting raw output by severity.
  If we only match it, that is what gets published.
