# v1 scope

v1 collects dependency findings, combines reports with shared advisory identifiers, ranks them, and compares them with an accepted baseline. Current usage is documented in the [README](../README.md); the [product description](../PRODUCT.md) explains the intended users and limits.

## Dependency judgement

```text
scanner reports → normalize → merge → rank → compare with baseline → findings and actions
```

`npx zero-shelter judge` can run supported scanners or read saved reports with `--input`. The lockfile selects the package-manager path. Optional scanners are skipped with an explanation when unavailable; if no scanner produces a readable report, judgement exits with code `2`.

One source provides ranking, remediation guidance, and baseline comparison. Multiple sources can also identify the same advisory under shared GHSA, CVE, or OSV aliases. Fewer report entries after merging do not demonstrate that the remaining findings are actionable or that security has improved. The [benchmark](../bench/README.md) records the measured counts and their limitations.

## Scope and design choices

Dependency findings were the initial focus because npm audit and OSV can report the same advisory using different identifiers. Findings from different analysis domains, such as dependency analysis and source-code analysis, generally require separate interpretation. Combining those reports would need a broader contract than dependency deduplication.

The baseline records findings that a user has chosen to accept. Later judgements distinguish those accepted findings from new ones. Acceptance is a risk decision; it is not remediation and is not required for installation or first use.

The non-blocking agent hook adds dependency judgement context to a coding session. It does not inspect intent, block prompts, or rewrite user input. v1 does not provide SAST, secret scanning, prompt policy, or natural-language rule packs.

## Implementation constraints

- Use integer ranking arithmetic and deterministic ordering.
- Normalize all fingerprint inputs through `src/normalize.ts`.
- Add no network requests of our own. Invoked scanners may contact their registries or advisory services; document that boundary.
- Preserve the [exit-code and JSON contracts](./STABILITY.md).

## Evaluation and future work

Ranking accuracy and dropped-finding rates require independently labeled ground truth. The current benchmark reports volume reduction; it does not establish better precision than sorting scanner output by severity. Publish the comparison even if ranking only matches that baseline.

The original expansion proposal placed secret-scanner reconciliation first, SAST ingestion second, and developer-intent or prompt-policy controls third, with benchmark evidence required before each step. This sequence records the v1 proposal, not a commitment that those features are shipped or approved. New controls require their own specification, security review, and Owner approval.
