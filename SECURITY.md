# Security and Privacy

[한국어](./SECURITY.ko.md)

zero-shelter judges dependency findings and can pass a short context to an agent. Contributions must preserve the trust boundary: project data stays local unless a user explicitly chooses an external integration.

## Non-negotiable defaults

- no runtime LLM calls;
- no telemetry or undocumented network request;
- no project data, prompts, findings, secrets, or personal data sent to third parties by default;
- no secret values in logs, fixtures, benchmark captures, or reports;
- minimize, redact, or hash privacy-sensitive data at the earliest safe point;
- document fail-open/fail-closed behavior;
- document user-visible behavior and data flow.

The scanners invoked by the project may have their own network behavior. The project must describe that boundary and must not add hidden traffic of its own.

## Reporting a vulnerability

Do not open a public Issue or PR for an undisclosed vulnerability. Follow the [organization security policy](https://github.com/zero-shelter/.github/blob/main/SECURITY.md). Include reproduction steps, affected versions/commits, impact, and a safe contact path.

## Security-control contributions

A change to privacy, secret handling, prompt handling, permissions, subprocesses, network behavior, or security policy must link a spec containing:

| Required item | Question |
|---|---|
| Protected data | What could be sensitive? |
| Trust boundary | Which process or service can see it? |
| Data flow | Where is it created, transformed, stored, and emitted? |
| Retention | How long does it remain and where? |
| Failure mode | Does it block, warn, or fail open? |
| Abuse cases | What malicious input or misuse was tested? |
| User control | What is the default and how does the user opt in/out? |

Include adversarial tests and reviewer evidence.

## Public contribution safety

Never commit real secrets, personal data, internal URLs, customer data, or undisclosed vulnerability details. Use synthetic fixtures and redacted examples. If sensitive data is found in the repository or history, stop and use the private security path.

## Scope boundary

Current v1 provides dependency scanning, judgement, baseline ratcheting, SARIF output, and a non-blocking agent hook. It does not claim complete SAST, secret scanning, prompt intent detection, or privacy compliance by itself.

Future controls require an explicit spec, threat model, tests, and Owner approval.
