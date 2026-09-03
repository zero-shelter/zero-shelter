/**
 * Walk the paths we tell agents to walk.
 *
 * The install QA covers a human at a terminal. This covers the other four
 * surfaces — the prompt hook, the five skills, the copy-paste prompts embedded
 * in the html report, and the plugin manifest — because those are the ones
 * nobody notices breaking. An agent does not complain that the advice was in
 * the wrong dialect; it pastes it, gets no error, and reports success.
 *
 *   node scripts/qa-agent.mjs [--keep]
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BIN = join(ROOT, "dist", "bin.js");
const CAPTURE = join(ROOT, "bench", "captures", "juice-shop");
const NPM_REPORT = join(CAPTURE, "npm-audit.json");
const OSV_REPORT = join(CAPTURE, "osv-scanner.json");

const keep = process.argv.includes("--keep");
const results = [];

async function check(name, detail, body) {
  try {
    const note = await body();
    results.push({ ok: true, name, note: note ?? detail });
  } catch (error) {
    results.push({ ok: false, name, note: error.message });
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

/** Exit code carries the answer, so a non-zero exit is data rather than a crash. */
async function cli(cwd, args, stdin) {
  const pending = run("node", [BIN, ...args], { cwd, maxBuffer: 32 * 1024 * 1024 });
  // Every path here is fed by --input or by a payload, so nothing should be
  // waiting on a terminal. Closing stdin either way keeps a hang from looking
  // like a slow test.
  pending.child.stdin?.end(stdin ?? "");
  try {
    const { stdout, stderr } = await pending;
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

/** A project whose lockfile decides which package manager we detect. */
async function project(manager) {
  const dir = await mkdtemp(join(tmpdir(), `zs-agent-${manager}-`));
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: "sim", version: "1.0.0" }));

  const lockfiles = {
    npm: ["package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: {} })],
    pnpm: ["pnpm-lock.yaml", "lockfileVersion: '9.0'\n"],
    yarn: ["yarn.lock", "__metadata:\n  version: 8\n"],
    "yarn-classic": ["yarn.lock", "# yarn lockfile v1\n\n"],
  };
  const [file, contents] = lockfiles[manager];
  await writeFile(join(dir, file), contents);
  return dir;
}

const INPUTS = ["--input", NPM_REPORT, "--input", OSV_REPORT];

/**
 * Only what a reader would actually type.
 *
 * Prose mentions the tool by name constantly — "wire zero-shelter into a
 * project's CI" is not an instruction to run `zero-shelter into`. Fenced shell
 * blocks are the part a skill promises will work.
 */
function shellLines(markdown) {
  const lines = [];
  let inside = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) {
      inside = /^```(bash|sh|shell|console)?$/.test(line.trim());
      continue;
    }
    if (inside) lines.push(line);
  }
  return lines;
}

// ── the hook, which is the surface an agent actually reads ──────────────────

const contextOf = (stdout) =>
  JSON.parse(stdout).hookSpecificOutput.additionalContext;

await check("hook answers a payload", "context returned", async () => {
  const dir = await project("npm");
  const { code, stdout } = await cli(
    dir,
    ["hook", ...INPUTS],
    JSON.stringify({ cwd: dir }),
  );
  expect(code === 0, `hook must always exit 0, got ${code}`);
  expect(stdout.trim() !== "", "hook produced nothing for a project with findings");
  expect(typeof contextOf(stdout) === "string", "hook output is not the shape the editor reads");
  return "exit 0, additionalContext present";
});

/**
 * Same check without --input, against real scanners. Kept because the flag
 * exists for testability and this is the path that actually runs in an editor.
 */
await check("hook answers a real payload", "context returned", async () => {
  const dir = process.env["ZS_AGENT_REAL_PROJECT"];
  if (dir === undefined) {
    return "skipped — set ZS_AGENT_REAL_PROJECT to a project with findings";
  }
  const { code, stdout } = await cli(dir, ["hook"], JSON.stringify({ cwd: dir }));
  expect(code === 0, `hook must always exit 0, got ${code}`);
  expect(stdout.trim() !== "", "hook produced nothing for a project with findings");
  const payload = JSON.parse(stdout);
  expect(
    typeof payload.hookSpecificOutput?.additionalContext === "string",
    "hook output is not the shape the editor reads",
  );
  return "exit 0, additionalContext present";
});

await check("hook stays silent and calm on a broken project", "exit 0, no output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "zs-agent-empty-"));
  const { code, stdout } = await cli(dir, ["hook"], JSON.stringify({ cwd: dir }));
  expect(code === 0, `a hook that fails a prompt is worse than one that says nothing: exit ${code}`);
  expect(stdout.trim() === "", "hook spoke about a project it could not scan");
  return "exit 0, silent";
});

await check("hook survives junk on stdin", "exit 0", async () => {
  const dir = await project("npm");
  const { code } = await cli(dir, ["hook"], "not json at all");
  expect(code === 0, `exit ${code}`);
  return "exit 0";
});

/**
 * The hook has been left behind by three separate changes now — the package
 * manager dialect, the withheld clears count, and before that the lockfile it
 * was not reading. It is the surface where being wrong costs most: a person
 * would notice `npm i` in a pnpm repository, an agent runs it.
 */
await check("hook speaks the project's dialect", "one dialect per manager", async () => {
  const expected = { npm: "npm i ", pnpm: "pnpm add ", yarn: "yarn add " };

  for (const [manager, command] of Object.entries(expected)) {
    const dir = await project(manager);
    const { stdout } = await cli(dir, ["hook", ...INPUTS], JSON.stringify({ cwd: dir }));
    const context = contextOf(stdout);
    const lines = context.split("\n").filter((line) => line.startsWith("$ "));

    expect(lines.length > 0, `${manager}: the hook offered no commands at all`);
    for (const line of lines) {
      expect(line.startsWith(`$ ${command}`), `${manager} agent was told to run: ${line}`);
    }

    const promises = manager === "npm";
    const counted = lines.some((line) => line.includes("# clears"));
    expect(
      counted === promises,
      promises
        ? "npm stopped counting what it can verify"
        : `${manager} promised an agent a clears count it cannot verify`,
    );
  }
  return "npm i / pnpm add / yarn add, counts only on npm";
});

// ── what the setup skill tells an agent to check ────────────────────────────

/**
 * This check used to enshrine the wrong semantics, which is worse than not
 * having it: it asserted that grepping the JSON for "osv-scanner" returns
 * non-zero when the scanner ran — and it does, but it *also* returns non-zero
 * when the scanner is missing, because `skipped` names it. The gate was green
 * on a happy path that could never see the failing case.
 */
await check(
  "the setup skill's verification command answers both ways",
  "one source detected, two sources detected",
  async () => {
    const dir = await project("npm");
    const PHRASE = "one source";

    const one = (await cli(dir, ["judge", "--input", NPM_REPORT])).stdout;
    expect(one.includes(PHRASE), "a one-source run did not say so, so the skill's check is blind");

    const two = (await cli(dir, ["judge", ...INPUTS])).stdout;
    expect(!two.includes(PHRASE), "a two-source run claimed to have one source");

    // And the trap the skill now warns about, asserted rather than described.
    const json = (await cli(dir, ["judge", "--input", NPM_REPORT, "--json"])).stdout;
    const report = JSON.parse(json);
    expect(Array.isArray(report.fixNow), "--json did not produce the documented shape");

    return "present with one source, absent with two";
  },
);

await check("a one-source run says so where the skill looks", "phrase present", async () => {
  const dir = await project("npm");
  const { stdout } = await cli(dir, ["judge", "--input", NPM_REPORT]);
  expect(
    stdout.includes("one source, nothing to reconcile"),
    "the setup skill tells the agent to look for this phrase and it is not there",
  );
  return "phrase present";
});

await check("nothing scanned is not a pass", "exit 2", async () => {
  const dir = await mkdtemp(join(tmpdir(), "zs-agent-bare-"));
  const { code, stderr } = await cli(dir, ["judge"]);
  expect(code === 2, `a project nobody scanned must not go green: exit ${code}`);
  expect(stderr.includes("not a pass"), "exit 2 without saying why");
  return "exit 2 with an explanation";
});

// ── every surface must give the same advice ─────────────────────────────────

for (const manager of ["npm", "pnpm", "yarn"]) {
  await check(`${manager}: every surface speaks one dialect`, "consistent", async () => {
    const dir = await project(manager);
    const expected = { npm: '"overrides"', pnpm: '"pnpm"', yarn: '"resolutions"' }[manager];
    const wrong = manager === "npm" ? null : '"overrides":';

    const text = (await cli(dir, ["judge", ...INPUTS])).stdout;
    const html = (await cli(dir, ["judge", ...INPUTS, "--format", "html"])).stdout;
    const sarif = (await cli(dir, ["judge", ...INPUTS, "--format", "sarif"])).stdout;

    // Each surface escapes quotes its own way — html as &quot;, SARIF as \"
    // because it is JSON. Checking only the bare spelling makes correct output
    // look like a missing dialect, which is the harness lying rather than the
    // product being wrong.
    const spellings = [
      expected,
      expected.replaceAll('"', "&quot;"),
      expected.replaceAll('"', '\\"'),
    ];
    for (const [surface, output] of [["text", text], ["html", html], ["sarif", sarif]]) {
      expect(
        spellings.some((spelling) => output.includes(spelling)),
        `${surface} does not mention ${expected}`,
      );
    }

    // The html report carries copy-paste prompts for an agent. If those
    // disagree with the snippet beside them, the page contradicts itself and
    // the prompt is the half that gets handed over.
    if (wrong !== null) {
      const prompts = [...html.matchAll(/data-copy="([^"]*)"/g)].map((m) => m[1]);
      expect(prompts.length > 0, "the html report carries no agent prompts to check");
      const stale = prompts.filter((p) => /package\.json &quot;overrides&quot;/.test(p));
      expect(
        stale.length === 0,
        `${stale.length} agent prompt(s) still say package.json "overrides" on a ${manager} project`,
      );
    }

    return `text, html and sarif all say ${expected}`;
  });
}

await check("clears is only promised where it can be checked", "withheld off npm", async () => {
  for (const manager of ["pnpm", "yarn", "yarn-classic"]) {
    const dir = await project(manager);
    const { stdout } = await cli(dir, ["judge", ...INPUTS]);
    expect(!/clears \d/.test(stdout), `${manager} promised a clears count it cannot verify`);
    expect(stdout.includes("counts are not shown"), `${manager} withheld it without saying why`);
  }
  const npmRun = await cli(await project("npm"), ["judge", ...INPUTS]);
  expect(/clears \d/.test(npmRun.stdout), "npm stopped promising counts it can verify");
  return "withheld on pnpm and yarn, kept on npm";
});

/**
 * Recording is bookkeeping. A history file we cannot append to is worth saying
 * out loud and is not worth throwing a finished judgement away over — exit 2
 * means "could not judge", and the judgement was fine.
 */
await check("a history that cannot be written does not sink the run", "verdict survives", async () => {
  const dir = await project("npm");
  // A directory where the file belongs: append fails with EISDIR.
  await mkdir(join(dir, ".zero-shelter", "history.jsonl"), { recursive: true });

  const { code, stdout, stderr } = await cli(dir, ["judge", ...INPUTS, "--record"]);

  expect(code === 1, `the judgement earned exit 1, --record turned it into ${code}`);
  expect(stdout.includes("to fix"), "the report never reached the reader");
  expect(stderr.includes("history.jsonl"), "the write failure was swallowed silently");
  return "exit 1, report printed, failure named on stderr";
});

// ── the loop the fix skill describes ────────────────────────────────────────

await check("accept, then re-run, and it is quiet", "ratchet closes", async () => {
  const dir = await project("npm");
  const accepted = await cli(dir, ["judge", ...INPUTS, "--update-baseline"]);
  expect(accepted.code === 0, `--update-baseline exited ${accepted.code}`);

  const again = await cli(dir, ["judge", ...INPUTS]);
  expect(again.code === 0, `a re-run after accepting everything must exit 0, got ${again.code}`);
  expect(again.stdout.includes("nothing new to fix"), "the loop did not close");
  return "exit 0, nothing new";
});

await check("a scanner joining later does not reopen the backlog", "ratchet holds", async () => {
  const dir = await project("npm");
  await cli(dir, ["judge", "--input", NPM_REPORT, "--update-baseline"]);
  const { stdout } = await cli(dir, ["judge", ...INPUTS]);

  const outstanding = Number(/→ (\d+) to fix/.exec(stdout)?.[1] ?? "-1");
  expect(outstanding >= 0, "could not read the outstanding count");
  expect(outstanding < 20, `adding a scanner reopened ${outstanding} findings`);
  expect(
    !stdout.includes("accepted finding(s) no longer reported"),
    "claimed renamed findings were resolved",
  );
  return `${outstanding} genuinely new, nothing falsely resolved`;
});

// ── the action examples people copy ─────────────────────────────────────────

// The examples are copied into repositories where these actions get access to
// source and security results. A tag can move; a commit SHA cannot.
await check("copy-paste actions are pinned to commits", "all pinned", async () => {
  const { stdout } = await run(
    "git",
    ["ls-files", "-z", "--", "*.md", "examples"],
    { cwd: ROOT },
  );
  const files = stdout.split("\0").filter(Boolean);
  const floating = [];
  let actions = 0;

  const targetFrom = (line) => {
    const match = /^\s*(?:-\s+)?uses\s*:\s*(\S+)/.exec(line);
    return match?.[1].replace(/^(['"])(.*)\1$/, "$2") ?? null;
  };
  const pinned = (target) => /@[0-9a-f]{40}$/i.test(target);

  expect(!pinned("owner/action@v1"), "a version tag passed as a commit pin");
  expect(pinned(`owner/action@${"a".repeat(40)}`), "a full commit SHA was rejected");

  for (const file of files) {
    const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
    for (const [index, line] of lines.entries()) {
      const target = targetFrom(line);
      if (target === null || target.startsWith("./") || target.startsWith("docker://")) continue;

      actions += 1;
      if (!pinned(target)) floating.push(`${file}:${index + 1} (${target})`);
    }
  }

  expect(actions > 0, "no external action references found in docs or examples");
  expect(floating.length === 0, `floating action refs: ${floating.join(", ")}`);
  return `${actions} action refs, all pinned`;
});

// ── the plugin an agent installs ────────────────────────────────────────────

await check("the plugin manifest points at skills that exist", "5 skills", async () => {
  const manifest = JSON.parse(
    await readFile(join(ROOT, ".claude-plugin", "plugin.json"), "utf8"),
  );
  expect(typeof manifest.name === "string", "plugin has no name");

  const { readdirSync } = await import("node:fs");
  const skills = readdirSync(join(ROOT, "skills"));
  expect(skills.length > 0, "plugin ships no skills");

  for (const skill of skills) {
    const body = readFileSync(join(ROOT, "skills", skill, "SKILL.md"), "utf8");
    expect(body.startsWith("---"), `${skill} has no frontmatter`);
    expect(/^description:/m.test(body), `${skill} has no description, so it never triggers`);
  }
  return `${skills.length} skills, all with a description`;
});

await check("no skill teaches a command the CLI does not have", "all reachable", async () => {
  const { readdirSync } = await import("node:fs");
  const help = (await cli(ROOT, ["--help"])).stdout;
  const known = new Set(["judge", "history", "hook", "help", "version"]);

  const seen = new Set();
  for (const skill of readdirSync(join(ROOT, "skills"))) {
    for (const line of shellLines(readFileSync(join(ROOT, "skills", skill, "SKILL.md"), "utf8"))) {
      for (const [, command] of line.matchAll(/zero-shelter ([a-z][a-z-]*)/g)) seen.add(command);
    }
  }

  const unknown = [...seen].filter((command) => !known.has(command));
  expect(unknown.length === 0, `skills reference commands that do not exist: ${unknown.join(", ")}`);
  expect(help.includes("judge"), "--help does not mention judge");
  return `${seen.size} distinct commands, all real`;
});

await check("no skill teaches a flag the CLI rejects", "all accepted", async () => {
  const { readdirSync } = await import("node:fs");
  const help = (await cli(ROOT, ["--help"])).stdout;

  const seen = new Set();
  for (const skill of readdirSync(join(ROOT, "skills"))) {
    for (const line of shellLines(readFileSync(join(ROOT, "skills", skill, "SKILL.md"), "utf8"))) {
      if (!line.includes("zero-shelter")) continue;
      // Strip the npx invocation first: --yes belongs to npx, not to us, and
      // blaming our --help for not listing it is the harness being wrong.
      const ours = line.slice(line.indexOf("zero-shelter"));
      for (const [flag] of ours.matchAll(/--[a-z][a-z-]*/g)) seen.add(flag);
    }
  }

  const unknown = [...seen].filter((flag) => !help.includes(flag));
  expect(unknown.length === 0, `skills use flags --help does not list: ${unknown.join(", ")}`);
  return `${seen.size} distinct flags, all documented`;
});

// ── report ──────────────────────────────────────────────────────────────────

console.log("");
for (const { ok, name, note } of results) {
  console.log(`${ok ? "✅" : "❌"} ${name} — ${note}`);
}
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} passed`);

if (!keep) {
  const { readdirSync } = await import("node:fs");
  for (const entry of readdirSync(tmpdir())) {
    if (entry.startsWith("zs-agent-")) {
      await rm(join(tmpdir(), entry), { recursive: true, force: true });
    }
  }
}

process.exit(passed === results.length ? 0 : 1);
