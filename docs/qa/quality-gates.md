# Quality Gates

These gates define the minimum evidence required to call a beta build release-ready. They are release criteria, not a claim that the current build has passed every gate.

## Required gates

| ID | Gate | Requirement | Primary evidence |
| --- | --- | --- | --- |
| QG-01 | Determinism | Equivalent inputs produce the same fingerprints, merged findings, rank order, and baseline decision. | `test/determinism.test.ts`, `test/pipeline.test.ts` |
| QG-02 | Safe acquisition | Missing, empty, unreadable, or failed scanner output is never presented as a clean scan. | `test/scan.test.ts`, `test/nothing-scanned.test.ts` |
| QG-03 | Safe merge | A finding is merged only when ecosystem, package, and advisory aliases justify it; a suspected duplicate cannot hide a finding. | `test/pipeline.test.ts`, `test/merge-scale.test.ts` |
| QG-04 | Baseline integrity | Damaged or incompatible baselines fail clearly; an absent source cannot be described as a resolved finding. | `test/pipeline.test.ts`, `test/no-longer-reported.test.ts` |
| QG-05 | Honest output | Text, JSON, SARIF, HTML, and hook output preserve the underlying judgment and state any limitation that matters. | `test/pipeline.test.ts`, `test/sarif.test.ts`, `test/html.test.ts`, `test/hook.test.ts` |
| QG-06 | Safe action | Direct and transitive dependencies receive accurate, non-destructive remediation guidance. | `test/actions.test.ts`, `test/workspaces.test.ts`, `test/merged-fix.test.ts` |
| QG-07 | Regression protection | Every confirmed defect that can be automated has a test that would fail if the defect returns. | Linked test in the case record |
| QG-08 | Human presentation control | `--no-color` overrides `FORCE_COLOR` for human text without changing machine-readable output, findings, scores, or exit codes. | `test/no-color.test.ts` |

## Release policy

A beta candidate is release-ready only when all of the following are true.

- Relevant P0 and P1 cases have been executed for the candidate.
- No unresolved P0 or P1 defect remains.
- Every deferred P2 or P3 item has a rationale and follow-up location.
- The latest QA report names untested scope and known limitations.
- `npm test`, `npm run typecheck`, `npm run build`, and `npm pack --dry-run` pass.
- The packaged-install check, `npm run qa`, passes for a release candidate.
- The agent-facing check, `npm run qa:agent`, passes when the hook, skills, HTML prompts, or plugin manifest are in scope.

## Severity policy

| Priority | Definition | Beta decision |
| --- | --- | --- |
| P0 | Hides a vulnerability, reports an unscanned project as clean, breaks deterministic judgment, exposes sensitive data, or makes the primary command unusable. | Block release and fix immediately. |
| P1 | Gives a common user a materially misleading rank, count, exit code, or remediation instruction. | Fix and re-verify before release. |
| P2 | Has a workaround but reduces trust, usability, or coverage. | Fix when practical; otherwise record the limitation. |
| P3 | Low-impact polish or a deferred improvement. | Record for follow-up. |

## Non-goals

This product reduces duplicate dependency findings and prioritizes remediation. It does not prove exploitability, code reachability, or ranking accuracy. Any claim about accuracy requires independently labeled ground truth as described in [Benchmark](../../bench/README.md), if that benchmark is available for the candidate.
