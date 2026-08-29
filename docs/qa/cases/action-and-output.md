# Action and Output Cases

| ID | Priority | Risk | Expected result | Execution | Evidence |
| --- | --- | --- | --- | --- | --- |
| ACTION-01 | P1 | A direct dependency with a known fix has no usable action. | The report presents the matching package upgrade command and fix context. | CI | `test/actions.test.ts`, `test/merged-fix.test.ts` |
| ACTION-02 | P0 | A transitive dependency is suggested as a direct install. | The report does not recommend installing a transitive package and explains the parent-upgrade constraint. | CI | `test/actions.test.ts`, `test/sarif.test.ts` |
| CONTEXT-01 | P1 | A workspace root receives an unsafe root-level install instruction. | Workspace output warns that the command needs the correct workspace target. | CI + Release | `test/workspaces.test.ts`, `scripts/qa-install.mjs` |
| OUTPUT-01 | P1 | Text and JSON disagree about the same judgment. | Counts, displayed limits, findings, and actions remain consistent across text and JSON. | CI | `test/pipeline.test.ts`, `test/top-is-display-only.test.ts` |
| OUTPUT-02 | P1 | SARIF output is invalid or loses decision reasons. | SARIF is valid JSON, uses SARIF levels, and retains remediation context. | CI | `test/sarif.test.ts` |
| OUTPUT-03 | P0 | Scanner-controlled text executes in the HTML report. | HTML escapes scanner-derived strings and remains a self-contained file. | CI | `test/html.test.ts` |
| OUTPUT-04 | P1 | Output file failures are silent or ambiguous. | An unwritable output path returns an error that names the target. | CI | `test/error-paths.test.ts` |
| OUTPUT-05 | P1 | A successful machine-readable output write is corrupt or incomplete. | Stored scanner input writes a valid SARIF file with one run and actionable results. | CI | `test/cli-inputs.test.ts` |
| OUTPUT-06 | P1 | Human-readable output cannot be turned off when a terminal forces color. | `--no-color` overrides `FORCE_COLOR` without changing findings, machine output, or exit code. | CI | `test/no-color.test.ts` |
| HOOK-01 | P2 | The agent hook blocks or fails the editor session. | A hook error is quiet and exits 0; successful output uses the expected context shape. | CI | `test/hook.test.ts` |
