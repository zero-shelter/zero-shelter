# Third-party components

[English](./THIRD_PARTY.md) · [한국어](./THIRD_PARTY.ko.md)

Direct dependencies only, with the version resolved in `package-lock.json`.
Regenerate with `npm run third-party`; CI fails if either file drifts.

Transitive dependencies and GitHub Actions are intentionally excluded.

| No. | Package | Version | License | Repository | Purpose |
|---|---|---|---|---|---|
| 1 | @types/node | 22.20.1 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | Development and build tooling |
| 2 | typescript | 5.9.3 | Apache-2.0 | https://github.com/microsoft/TypeScript | Development and build tooling |
| 3 | vitest | 4.1.11 | MIT | https://github.com/vitest-dev/vitest | Development and build tooling |

## External executables

Called as separate processes. None of their code is bundled or vendored here.

| Tool | Used for | How it is used |
|---|---|---|
| npm CLI (`npm audit`) | npm / Yarn projects | Run as `npm audit --json` for npm and Yarn projects; only its output is read. |
| pnpm CLI (`pnpm audit`) | pnpm projects | Run as `pnpm audit --json` when a pnpm lockfile is detected. |
| [osv-scanner](https://github.com/google/osv-scanner) | Installed on `PATH` | Used when found on `PATH`, reported as skipped otherwise. |

This project itself is licensed under Apache-2.0. See `LICENSE`.
