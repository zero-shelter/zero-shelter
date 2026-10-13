# Agent hook

`zero-shelter hook` adds the project's current dependency judgement to a coding agent's context. The agent can use that context when considering dependency changes; the hook does not enforce its decisions.

The hook uses the same remediation result as the human report. On npm projects
with a usable `package-lock.json`, it checks whether an upgrade reaches every
installed copy before it includes a `clears N` count. On pnpm and yarn projects
it speaks the detected package manager's command dialect (`pnpm add` or
`yarn add`) and withholds a clears count because those lockfile range readers
are not available.

Illustrative, abbreviated context; the findings and counts depend on the project:

```console
$ echo '{"cwd":"/path/to/project"}' | npx zero-shelter hook
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"zero-shelter: this project has 9 unaddressed dependency finding(s) (4 more not shown). Highest priority first:\n- critical minimist (GHSA-XVCH-5GV4-984H, fixed in 1.2.8)\n…"}}
```

## Claude Code

`.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "npx zero-shelter hook" }] }
    ]
  }
}
```

The hook reads the session's `cwd` from the payload on stdin, so it judges the
project being edited rather than wherever the hook process happened to start.
`--cwd` and `--baseline` override the payload and provide explicit project
and baseline paths.

The context also includes computed commands. For example:

```
- critical minimist (GHSA-XVCH-5GV4-984H, fixed in 1.2.8)
Fixable now:
$ npm i lodash@4.18.1   # clears 7
```

Including the computed commands avoids asking the agent to infer an upgrade from advisory text. Installing a transitive package at the top level may leave the vulnerable copy under its parent dependency.

## Output limits and action wording

The hook passes at most five highest-priority findings and five available
commands. When more exist, it states how many were omitted so the agent does
not mistake a short context for a complete report.

If a direct upgrade cannot reach every installed copy, the hook omits the
misleading install command and names the blocking dependent or range. The
human report and the hook therefore agree on what can be promised and what
needs an `overrides`-style constraint.

## Failure behavior and scope

The hook does not block or rewrite prompts. It supplies additional context through `UserPromptSubmit`.

On errors, including missing scanners or lockfiles, malformed payloads, and unreadable baselines, it returns no context and exits `0`. This keeps a failed inspection from interrupting the editor session. Silence is therefore not proof that a scan completed.

When a successful judgement finds no new findings, the hook also produces no output. Findings accepted in the baseline are omitted from the context.

The hook does not read the prompt, classify request intent, or apply prompt-policy rules.
