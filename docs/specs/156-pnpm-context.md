# Feature specification: pnpm lockfile dependency context

## Issue and lifecycle metadata

- Issue: [#156](https://github.com/zero-shelter/zero-shelter/issues/156)
- Target layer: lockfile context and package-manager advice

## Problem

pnpm projects already receive scanner findings, but the report cannot read
`pnpm-lock.yaml`. It therefore cannot label production/dev scope, identify
dependent edges that block an upgrade, or inventory install scripts, and it
must withhold verified `clears N` counts.

## Goal and scope

Read the generated pnpm lockfile subset needed to populate the existing
`InstalledVersions` contract. Support lockfile major versions 5, 6, and 9;
these cover pnpm 6, 8, 9, and 10 output formats used by the captured fixtures.
Keep Yarn separate and add no runtime dependency.

The reader accepts package and snapshot entries, importer dependency maps,
resolved versions, dependency edges, `dev` and install-script metadata. It
rejects unsupported versions or unreadable structure by returning no lockfile
context, which keeps the existing conservative output.

## Trust boundary

- Only the local `pnpm-lock.yaml` is read.
- No registry, subprocess, network, source, or package manifest lookup is added.
- Unknown YAML is not guessed; lockfile-dependent claims are omitted.
- The public `InstalledVersions` shape is unchanged.

## Fixtures and validation

The fixtures are captured lockfiles from `pnpm/action-setup` releases:

- v5.4: [`v2.2.4/pnpm-lock.yaml`](https://raw.githubusercontent.com/pnpm/action-setup/v2.2.4/pnpm-lock.yaml)
- v6.0: [`v3.0.0/pnpm-lock.yaml`](https://raw.githubusercontent.com/pnpm/action-setup/v3.0.0/pnpm-lock.yaml)
- v9.0: [`v5.0.0/pnpm-lock.yaml`](https://raw.githubusercontent.com/pnpm/action-setup/v5.0.0/pnpm-lock.yaml)

Tests cover all three formats, importer scope, package edges, unsupported
versions, and the existing report/command behavior.
