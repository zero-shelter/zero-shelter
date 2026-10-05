# Machine-readable dependency scanner survey

Survey date: 2026-10-06. The commands below are the reproducible invocation
shape; run them in a public checkout containing the named lockfile or manifest.
Versions are obtained with each tool's documented version command. No private
repository output was used.

The design question is whether one adapter can read every scanner's output.
The answer is **no for SARIF alone**: SARIF standardises the result container,
rule id, level, message, and locations, but package name, affected range, fixed
version, aliases, and publication date are tool-specific properties or prose.
Prefer each tool's native JSON where it carries the fields zero-shelter needs;
use SARIF for downstream upload until a per-tool mapping is reviewed.

## Field matrix

Legend: yes means the native machine-readable output names the field; partial
means it can be present but is not a stable requirement; no means the output
does not provide it as a normalized field.

| Scanner | Command and formats | Package/version | Vulnerable range | Fixed version | Aliases | CVSS | Published date | Best input for an adapter |
|---|---|---:|---:|---:|---:|---:|---:|---|
| trivy | `trivy fs --scanners vuln --format json -o trivy.json .`; also `--format sarif`; `trivy version` | yes | no | yes (`FixedVersion`) | partial (IDs/URLs) | partial (`CVSS`) | no stable field | native JSON, with an explicit trivy schema version |
| grype | `grype dir:. -o json`; also `-o sarif`; `grype version` | yes (`matches[].artifact`) | no | yes (`vulnerability.fix.versions`) | partial (`relatedVulnerabilities`) | partial (`cvss`) | no stable field | native JSON; SARIF help text is lossy |
| pip-audit | `pip-audit --format=json`; `pip-audit --version` | yes (`name`, `version`) | no | yes (`vulns[].fix_versions`) | yes (`aliases`) | no | no | native JSON |
| govulncheck | `govulncheck -json ./...`; `govulncheck -format sarif ./...`; `govulncheck -version` | yes (module/version) | no normalized range | yes in finding data (`fixed_version`) | advisory IDs; aliases are source-dependent | no stable band | no | streaming JSON; SARIF for code-scanning integration |
| cargo-audit | `cargo audit --json`; current source also supports `cargo audit --format sarif`; `cargo audit --version` | yes (`package`) | partial (advisory ranges) | yes (`versions.patched`) | yes (`advisory.aliases`) | yes (`advisory.cvss`) | yes (`advisory.date`) | native JSON; verify one report per audited input |
| osv-scanner (reference) | `osv-scanner scan --format json .`; `--format sarif`; `osv-scanner --version` | yes (`results[].packages[].package`) | yes (OSV affected ranges) | yes (OSV fixed events) | yes (`aliases`) | partial (OSV severity/CVSS) | yes (OSV record) | existing OSV reader |

The matrix deliberately records missing fields. A parser must not invent a
range or publication date from a prose message, and a SARIF adapter must not
pretend that `security-severity` is the same thing as a scanner's severity band.

## Reproducible command notes and output fragments

### trivy

The filesystem target scans project lockfiles and manifests. The native JSON
vulnerability object uses names equivalent to:

```json
{
  "VulnerabilityID": "CVE-…",
  "PkgName": "package",
  "InstalledVersion": "1.2.3",
  "FixedVersion": "1.2.4",
  "Severity": "HIGH",
  "PrimaryURL": "https://…"
}
```

SARIF is a supported output format, but the package and remediation details
need a trivy-specific mapping. Install: `brew install trivy` or use the
official release packages. References: [filesystem target](https://trivy.dev/docs/latest/target/filesystem/),
[reporting](https://trivy.dev/docs/latest/configuration/reporting/).

### grype

Grype scans images, filesystems, and SBOMs. Its JSON shape places the useful
identity under `matches[].artifact` and advisory data under
`matches[].vulnerability`:

```json
{
  "vulnerability": {
    "id": "GHSA-…",
    "severity": "Low",
    "fix": {"versions": ["42.3.3"]},
    "relatedVulnerabilities": []
  },
  "artifact": {"name": "postgresql", "version": "42.2.5"}
}
```

The SARIF message/help text can repeat package and fix information, but that is
presentation text rather than a stable schema. Install: `brew install grype`
or use Anchore's release artifacts. References: [Grype project and output
formats](https://github.com/anchore/grype#readme).

### pip-audit

For a requirements file, use `pip-audit -r requirements.txt --format=json`; for
a project lockfile, use `pip-audit --locked .`. A real native JSON fragment is:

```json
{
  "name": "flask",
  "version": "0.5",
  "vulns": [{
    "id": "PYSEC-2019-179",
    "fix_versions": ["1.0"],
    "aliases": ["CVE-2019-1010083", "GHSA-…"],
    "description": "…"
  }]
}
```

There is no normalized affected range, severity, CVSS vector, or publication
date in this output. Install: `python -m pip install pip-audit`. Reference:
[pip-audit documentation and JSON example](https://pypi.org/project/pip-audit/).

### govulncheck

Run it from a Go module with `govulncheck -json ./...`; use `-format sarif` for
SARIF or `-format openvex` for VEX. The JSON stream is an event format: module
and version facts, vulnerability IDs, fixed versions, and call traces arrive
as separate events. That makes it useful for a Go-specific adapter, but not a
drop-in OSV record parser. It also reports reachability from Go code, a claim
that should remain separate from dependency-only findings. Install:
`go install golang.org/x/vuln/cmd/govulncheck@latest`. Reference:
[govulncheck command documentation](https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck).

### cargo-audit

Run `cargo audit --json` in a Rust project with `Cargo.lock`. Current cargo-audit
also exposes `--format sarif`; the source command definition lists terminal,
JSON, and SARIF. Native JSON carries advisory IDs, aliases, dates, CVSS, package
name/version, and patched-version information. The advisory's affected-range
shape is not the same as OSV's event list, so the adapter must preserve it
without flattening it into one guessed range. Install: `cargo install cargo-audit`.
References: [cargo-audit command source](https://github.com/RustSec/rustsec/blob/main/cargo-audit/src/commands/audit.rs),
[configuration/output example](https://github.com/RustSec/rustsec/blob/main/cargo-audit/audit.toml.example).

### osv-scanner reference

The existing adapter uses `osv-scanner scan --format json` and reads the OSV
shape directly. The output names package, version, ecosystem, advisory IDs and
aliases, affected events, fixed versions, and source lockfile. SARIF groups
aliases into rules and puts remediation in help text, which is suitable for
upload but should not replace the native JSON input. Install: see the
[OSV-Scanner installation guide](https://google.github.io/osv-scanner/installation/).

## Decision for #125

1. Keep the manifest's `format` explicit; do not infer a universal SARIF
   dependency schema.
2. Prefer native JSON adapters for pip-audit, grype, trivy, govulncheck, and
   cargo-audit. Each needs a small parser and fixture because the field names
   and semantics differ.
3. Keep SARIF support as an input boundary only after a tool-specific mapping
   declares where package, version, advisory, and remediation fields come from.
4. Carry source-specific absence honestly. Missing range, CVSS, or publication
   data stays missing; it is never reconstructed from a message string.
