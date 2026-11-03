---
description: Apply agreed upgrades from zero-shelter and verify the result, including review of indirect dependencies a top-level install may not update. Use when someone wants dependency findings fixed, asks to resolve vulnerabilities, or says to do what the report says. Korean requests look like: 의존성 취약점 고쳐줘, 취약점 해결해줘, 리포트대로 조치해줘.
---

# Apply supported upgrades

```bash
npx --yes zero-shelter judge --json
```

Read the exit code. Exit 2 means a judgement could not be produced; resolve
that failure before claiming a result.

## 1. Read `upgrades`

The report groups commands by package and compares versions. Use those commands
instead of deriving a target from `fixedIn`. String comparison, for example,
places `4.17.21` above `4.18.1` and can choose the wrong release.

## 2. Explain and agree on the change

State the affected packages, the report's expected findings addressed, and
whether each version change is major, minor or patch. Preserve any withheld
count or workspace qualification. Get agreement before applying the commands;
existing explicit authorization applies.

## 3. Review `transitiveFixes` separately

Indirect dependencies arrive through another package. Adding them at the top
level may leave the vulnerable copy in place.

Use the package manager's forced-version form shown by the report. It may break
the parent package that required the old version. Explain that risk and obtain
the user's decision before applying it. A general request to fix findings does
not authorize silently forcing indirect dependency versions.

## 4. Verify the result

```bash
npx --yes zero-shelter judge
```

Verify with `zero-shelter judge`, not with `npm audit`: the latter does not
compare this tool's baseline or reconcile its other scanner inputs. Report
what the re-run shows and whether its contributing sources are comparable.
Then run the project's relevant tests and build to check compatibility.

If the project already records history, include the re-run:

```bash
npx --yes zero-shelter judge --record
```

Say “no longer reported” unless the re-run confirms remediation and all earlier
contributing scanners ran. A finding can also disappear through baseline
acceptance or missing scanner input.

## Findings without a supported command

Explain which findings have no reported fixed version or insufficient evidence for a
command. Continue with independently supported actions. Do not remove a
package, pin an older version or accept findings without the user's decision.
Before proposing removal, inspect its uses; before proposing a downgrade,
check other known advisories and compatibility.

Do not hand-edit dependency versions in place of running the package manager:
the lockfile is scanner input. Never use `--update-baseline` to complete a fix,
and never report success solely because a planned command was executed.
