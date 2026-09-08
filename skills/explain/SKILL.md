---
description: Interpret zero-shelter's findings, ranking and supported remedies, or produce an HTML report. Use when someone asks what a zero-shelter run means, why a finding is ranked where it is, which vulnerability to fix first, or what to do about the ones left over. Korean requests look like: 이 결과 해석해줘, 뭐부터 고쳐야 해, 리포트 보여줘.
---

# Interpret a judgement

```bash
npx --yes zero-shelter judge --json
```

Read the exit code and source warnings before summarizing findings. Exit 2
means the tool could not judge, even if an output appears empty.

## Fields to use

| Field | Meaning |
|---|---|
| `summary.raw` / `summary.merged` | Input reports and findings after identifier-based merging. A reduction measures volume, not correctness. |
| `summary.accepted` | Baseline entries matched in this run. |
| `summary.fixNow` / `summary.shown` | All outstanding findings versus rows selected by `--top`. Quote the full count as the total. |
| `score` | The tool's ranking score; use `--explain` for its weights. It is not CVSS or proof of exploitability. |
| `fixedIn` | A fixed version reported by a source. A supported command may still be unavailable. |
| `direct` | Whether the package is a direct dependency. Review compatibility before upgrading. |
| `tools` | Sources that reported this finding. Multiple reports do not prove correctness. |
| `possibleDuplicates` | Suspected duplicates kept separate and unresolved. |
| `upgrades` | Grouped, version-compared commands. Use these instead of deriving commands from `fixedIn`. |
| `workspaceRoot` | Advice was produced at a workspace root. Determine the intended workspace and its manager option before executing. |
| `transitiveFixes` | Advice for dependencies brought in by another package. Review the manager-specific forced-version action and parent compatibility. |
| `noLongerReported` | Accepted findings not reported in this run. |
| `missingSources` | Baseline sources that did not contribute to this run; these limit comparison. |
| `skipped` | Scanner inputs that could not contribute, with reasons. |

## Present the result

Start with the run status and source limitations, then summarize `upgrades`,
indirect dependency advice, and findings without a supported remedy. Use actual
counts from the JSON. Preserve count and workspace caveats rather than promising
that every installed copy will be cleared.

Do not derive commands from `fixedIn`. To explain a ranking, run:

```bash
npx --yes zero-shelter judge --explain
```

Use the printed weights and evidence. If the order appears wrong, name the
finding and the reason for questioning the weights; keep the original order.

## HTML and history

```bash
npx --yes zero-shelter judge --format html --output zero-shelter.html
npx --yes zero-shelter judge --format html --lang ko --output zero-shelter.ko.html
```

Provide the report when the user wants to inspect details or share the result.
It contains the same judgement and remediation advice.

```bash
npx --yes zero-shelter history
npx --yes zero-shelter history --json --last 10
```

Use recorded runs for changes over time; do not infer a trend from one run.
Outstanding findings may disappear because they were accepted, their scanner
did not run, or they were remediated. History alone cannot distinguish them all.

## Boundaries

- Do not reorder, filter or add findings, or merge `possibleDuplicates`.
- Do not estimate exploitability or reachability; the tool has no evidence for it.
- Do not call exit 2 a pass or report a run you did not perform.
- After a change, re-run and retain source caveats. Say “no longer reported”
  unless the comparable re-run confirms remediation.
- Baseline pruning uses `--update-baseline`, which also accepts new findings.
  Explain the complete effect and obtain the user's decision before using it.
