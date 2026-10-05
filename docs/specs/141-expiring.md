# Feature specification: upcoming acceptance expirations

## Issue and lifecycle metadata

- Issue: [#141](https://github.com/zero-shelter/zero-shelter/issues/141)
- Target layer: baseline, CLI
- Related PR: pending

## Problem

Accepted findings carry owners and expiry dates, but the CLI only mentions an expiry after it has returned to the fresh report. Maintainers need a review queue before a documented exception reaches its deadline.

## Goal

`zero-shelter history --expiring` reads the local baseline and reports accepted entries that expire within a UTC window. It groups upcoming entries by `acceptedBy`, shows entries already expired and entries with no expiry separately, and provides JSON for scheduled jobs. It never renews or edits the baseline.

## Scope

### Included

- `history --expiring`, with `--days <n>` defaulting to 30.
- The reference date is today's UTC `YYYY-MM-DD`, matching `judge`.
- Text and `--json` output, including the reference date and end date.
- Already expired entries and unbounded entries shown in separate sections.
- Missing baseline is an explicit empty state; malformed baseline remains exit 2.

### Explicitly excluded

- Renewing or editing expiry dates.
- Notifications, cron, or network calls.
- Changing normal `history` output when `--expiring` is absent.
- Policy deadlines based on advisory publication dates (#131).

## Interface

| Direction | Contract |
|---|---|
| Input | `zero-shelter history --expiring [--days <positive integer>] [--baseline <file>] [--json]` |
| Output | Text groups upcoming entries by owner; JSON has `asOf`, `days`, `until`, `expiring`, `expired`, `unbounded`, and `baselineExists`. |
| Errors/exit code | Invalid days or malformed baseline exits 2. Missing baseline prints a review hint and exits 0. |
| Compatibility | Existing `history` text/JSON remains byte-compatible without `--expiring`. |

## Architecture

- Layer(s) changed: `src/baseline.ts`, `src/cli.ts`, README documentation.
- Files expected to change: those modules, `test/expiring.test.ts`, and this spec/translation.
- Shared contracts touched: new pure baseline query only; existing baseline matching and expiry semantics are unchanged.
- Possible conflicts: #130 policy files and #167 history names must consume this query without duplicating date arithmetic.

## Security and privacy

- Protected data: `acceptedBy`, package, advisory, and expiry already committed in the local baseline.
- Data flow and trust boundary: read one local file and render it; no subprocess is needed.
- Logging and retention: stdout only; no file is written.
- Network/LLM/telemetry behavior: none.
- Failure mode: malformed input fails closed with the baseline path; missing baseline is a normal empty state with an actionable hint.
- User opt-in/opt-out: explicit `--expiring` opt-in; normal history is unchanged.

## QA acceptance criteria

| Scenario | Expected result | Evidence |
|---|---|---|
| Normal input | Entries within the inclusive window are grouped by owner | `test/expiring.test.ts` |
| Invalid input | Non-positive/non-integer days and malformed dates fail with a useful message | unit/CLI tests |
| Empty input | Missing baseline and no matching entries are stated once without fake success | unit/CLI tests |
| Boundary/large input | Today, exactly-until, already-expired, and no-expiry entries are partitioned correctly | table-driven tests |
| Existing behavior | Plain `history` output is unchanged | existing history tests |
| Security/privacy abuse case | No writes or network imports are added | `test/promises.test.ts` |

## Agent notes

Use UTC calendar arithmetic, not local time or string addition. `expires` is already validated as a real `YYYY-MM-DD` date by #136. Keep output deterministic by sorting owners and entries by expiry, package, advisory, and fingerprint.

## Decision log

| Decision | Alternatives considered | Reason |
|---|---|---|
| Put the query behind `history --expiring` | Add a section to every `judge` report | It is a work queue a maintainer asks for explicitly; quiet normal runs stay quiet |
| Show expired and unbounded separately | Fold both into “expiring” | They require different actions and combining them hides the distinction |
| Missing baseline is exit 0 with a hint | Treat it as a command error | A project before its first baseline is a valid state; scheduled use should not look like a scanner failure |
