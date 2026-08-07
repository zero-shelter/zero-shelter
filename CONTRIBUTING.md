# Contributing

The [organization-wide guidelines](https://github.com/zero-shelter/.github/blob/main/CONTRIBUTING.md)
apply here. This file covers what is specific to this repository.

## Getting set up

```bash
git clone https://github.com/zero-shelter/zero-shelter.git
cd zero-shelter
npm ci
npm test
```

Node 20 or later. There is nothing else to install — no database, no services,
no API keys. If `npm test` fails on a clean checkout, that is a bug worth an
issue on its own.

## Review

**A reviewer who cannot describe an input that breaks the change does not
approve it.**

This is the one process rule we are strict about, and it exists because of how
this project is built. Much of the code here is drafted with AI assistance, and
the failure mode is specific: the model writes the implementation and the tests
from the same misunderstanding, so the tests confirm the bug instead of catching
it. Counting review comments does not detect that. Trying to construct a failing
input does.

It is fine for the answer to be "I tried and could not break it." That is a real
review. What is not fine is approving without having tried.

Two consequences worth knowing:

- **Small pull requests get reviewed properly.** A four hundred line diff will be
  approved in three minutes by a human matching the pace it was written at.
- **Say where you looked.** "I attacked the alias parsing and the version range
  comparison" tells the author which parts are still unexamined.

## Design invariants

The table in the [README](./README.md#design-invariants) is not aspirational.
If a change breaks one of those, it needs to be a deliberate, discussed change to
the invariant itself — not a quiet exception.

The one people trip over most: **anything that ends up in a fingerprint has to go
through `src/normalize.ts`**. A second normalization path means the same finding
gets two identities, which silently breaks deduplication and baselines at once.

## Tests

- Ingest parsers are covered by snapshots over fixtures taken from real scanner
  output. Synthetic fixtures miss the shapes that actually break parsers.
- Anything touching fingerprints asserts **fixed hash constants**, so a change to
  the recipe has to be made on purpose rather than absorbed by a regenerated
  snapshot.
- Determinism is tested directly: parse twice, shuffle the input key order, and
  expect identical output.

## Language

Code, comments, documentation, issue templates and commit messages are in
English, so that reading and contributing does not require Korean.

The maintainers work in Korean and some issues and pull request discussions are
in Korean today. If you open one in English it will be answered in English. We
would rather have a mixed issue tracker than a closed one.

## Commit messages

Explain why, not what. The diff already shows what changed; what it cannot show
is the alternative you rejected, or the non-obvious constraint that forced the
approach. Six months from now that is the only part anyone needs.

## Reporting a vulnerability

See [SECURITY.md](https://github.com/zero-shelter/.github/blob/main/SECURITY.md).
Please do not open a public issue for a security problem.
