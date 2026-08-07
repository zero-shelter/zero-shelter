#!/usr/bin/env node
// Entry point only. main() lives in cli.ts so tests can call it without a
// module that runs on import.
import { main } from "./cli.js";

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
    process.exitCode = 2;
  },
);
