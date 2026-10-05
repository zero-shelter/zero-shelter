import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { emptyBaseline, type Baseline } from "../src/baseline.js";
import { suggestNextStep } from "../src/next-step.js";
import { judge } from "../src/judge.js";
import { renderHuman, renderJson } from "../src/report.js";

const completeBaseline = (): Baseline => ({
  ...emptyBaseline(),
  accepted: [
    {
      fingerprint: "fp",
      ecosystem: "npm",
      package: "demo",
      advisory: "CVE-2026-1",
      aliases: [],
      severity: "high",
      reason: "upgrade is scheduled",
      acceptedBy: "security@example.com",
      expires: "2027-01-01",
    },
  ],
});

async function project(): Promise<string> {
  return mkdtemp(join(tmpdir(), "zs-next-step-"));
}

describe("suggestNextStep", () => {
  it("does not duplicate first-run baseline guidance", async () => {
    expect(await suggestNextStep(await project(), emptyBaseline(), false)).toBeUndefined();
  });

  it("prioritizes starting history", async () => {
    const cwd = await project();
    expect(await suggestNextStep(cwd, completeBaseline(), true)).toBe(
      "run zero-shelter judge --record to start tracking changes",
    );
  });

  it("suggests CI after history exists", async () => {
    const cwd = await project();
    await mkdir(join(cwd, ".zero-shelter"));
    await writeFile(join(cwd, ".zero-shelter", "history.jsonl"), "\n");
    expect(await suggestNextStep(cwd, completeBaseline(), true)).toBe(
      "add zero-shelter judge to CI so new findings are checked on every change",
    );
  });

  it("suggests baseline documentation after history and CI", async () => {
    const cwd = await project();
    await mkdir(join(cwd, ".zero-shelter"));
    await writeFile(join(cwd, ".zero-shelter", "history.jsonl"), "{}\n");
    await mkdir(join(cwd, ".github", "workflows"), { recursive: true });
    await writeFile(join(cwd, ".github", "workflows", "security.yml"), "run: npx zero-shelter judge\n");

    const complete = completeBaseline();
    const { reason: _reason, ...withoutReason } = complete.accepted[0]!;
    const incomplete: Baseline = { ...complete, accepted: [withoutReason] };
    expect(await suggestNextStep(cwd, incomplete, true)).toBe(
      "document accepted findings with reason, acceptedBy, and expires",
    );
  });

  it("stays quiet when all three signals are present", async () => {
    const cwd = await project();
    await mkdir(join(cwd, ".zero-shelter"));
    await writeFile(join(cwd, ".zero-shelter", "history.jsonl"), "{}\n");
    await mkdir(join(cwd, ".github", "workflows"), { recursive: true });
    await writeFile(join(cwd, ".github", "workflows", "security.yml"), "run: npx zero-shelter judge\n");
    expect(await suggestNextStep(cwd, completeBaseline(), true)).toBeUndefined();
  });
});

describe("nextStep report contract", () => {
  it("is additive in text and JSON", () => {
    const result = judge([], { baseline: emptyBaseline(), nextStep: "do the next thing" });
    expect(renderHuman(result, false)).toContain("next step: do the next thing");
    expect(JSON.parse(renderJson(result)).nextStep).toBe("do the next thing");
  });
});
