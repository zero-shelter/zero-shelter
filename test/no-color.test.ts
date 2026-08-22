import { describe, expect, it, vi } from "vitest";

import { main } from "../src/cli.js";

async function runJudge(args: readonly string[]) {
  const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const previousForceColor = process.env.FORCE_COLOR;
  const previousNoColor = process.env.NO_COLOR;
  process.env.FORCE_COLOR = "1";
  delete process.env.NO_COLOR;

  try {
    const code = await main(["--input", "test/fixtures/npm-audit.json", ...args]);
    const output = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    return { code, output };
  } finally {
    if (previousForceColor === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = previousForceColor;
    if (previousNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = previousNoColor;
    write.mockRestore();
  }
}

describe("--no-color", () => {
  it("overrides FORCE_COLOR for human output", async () => {
    const result = await runJudge(["--no-color"]);

    expect(result.code).toBe(1);
    expect(result.output).not.toContain("\u001b[");
  });

  it("keeps the existing FORCE_COLOR behavior without the flag", async () => {
    const result = await runJudge([]);

    expect(result.code).toBe(1);
    expect(result.output).toContain("\u001b[");
  });

  it("documents the option in help", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      await expect(main(["--help"])).resolves.toBe(0);
      expect(write.mock.calls.map(([chunk]) => String(chunk)).join(""))
        .toContain("--no-color");
    } finally {
      write.mockRestore();
    }
  });
});
