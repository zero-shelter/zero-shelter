#!/usr/bin/env node
/**
 * Capture npm audit and OSV output for pinned benchmark repositories.
 * Only manifests and lockfiles are fetched; downstream evaluation uses committed
 * captures. Missing lockfiles are generated against the registry at capture time.
 * No target source tree is cloned. This command uses the network.
 * Usage: node bench/capture.mjs [--osv-bin <path>]
 */

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const benchDir = dirname(fileURLToPath(import.meta.url));

const osvBinFlag = process.argv.indexOf("--osv-bin");
const osvBin = osvBinFlag === -1 ? "osv-scanner" : process.argv[osvBinFlag + 1];

const { repos } = JSON.parse(await readFile(join(benchDir, "repos.json"), "utf8"));

for (const repo of repos) {
  const dir = join(benchDir, "captures", repo.name);
  const work = join(dir, "workdir");
  await mkdir(work, { recursive: true });

  console.log(`\n== ${repo.name} @ ${repo.sha.slice(0, 12)}`);

  const meta = {
    repo: repo.github,
    sha: repo.sha,
    capturedWith: {},
    notes: [],
  };

  for (const file of ["package.json", "package-lock.json"]) {
    const url = `https://raw.githubusercontent.com/${repo.github}/${repo.sha}/${file}`;
    const res = await fetch(url);
    if (res.ok) {
      await writeFile(join(work, file), await res.text());
    } else if (file === "package-lock.json") {
      // Record when the pinned repository lacks a lockfile and current registry
      // resolution is required.
      console.log("   no lockfile at pinned commit — generating");
      meta.notes.push(
        "package-lock.json absent at pinned commit; generated at capture time against the live registry",
      );
      await run("npm", ["install", "--package-lock-only", "--no-audit", "--no-fund", "--ignore-scripts"], {
        cwd: work,
        maxBuffer: 64 * 1024 * 1024,
      });
    } else {
      throw new Error(`${repo.name}: cannot fetch ${file} (${res.status})`);
    }
  }

  const npmVersion = (await run("npm", ["--version"])).stdout.trim();
  meta.capturedWith["npm"] = npmVersion;

  // npm audit exits 1 when it finds anything; that is the expected case.
  const audit = await run("npm", ["audit", "--json"], {
    cwd: work,
    maxBuffer: 64 * 1024 * 1024,
  }).catch((error) => error);
  if (typeof audit.stdout !== "string" || audit.stdout.trim() === "") {
    throw new Error(`${repo.name}: npm audit produced nothing`);
  }
  await writeFile(join(dir, "npm-audit.json"), audit.stdout);
  console.log(`   npm audit  ${Buffer.byteLength(audit.stdout)} bytes`);

  if (existsSync(osvBin) || osvBin === "osv-scanner") {
    try {
      // osv-scanner v2 wants the lockfile named explicitly; pointing it at the
      // directory finds nothing ("No package sources found").
      const osv = await run(
        osvBin,
        ["scan", "source", "-L", join(work, "package-lock.json"), "--format", "json"],
        { maxBuffer: 64 * 1024 * 1024 },
      ).catch((error) => error);

      if (typeof osv.stdout === "string" && osv.stdout.trim() !== "") {
        await writeFile(join(dir, "osv-scanner.json"), osv.stdout);
        const version = (await run(osvBin, ["--version"]).catch(() => ({ stdout: "" })))
          .stdout.match(/\d+\.\d+\.\d+/)?.[0];
        if (version) meta.capturedWith["osv-scanner"] = version;
        console.log(`   osv-scanner  ${Buffer.byteLength(osv.stdout)} bytes`);
      } else {
        meta.notes.push("osv-scanner produced no output; capture is npm-audit only");
      }
    } catch {
      meta.notes.push("osv-scanner unavailable at capture time; capture is npm-audit only");
    }
  }

  await writeFile(join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
}

console.log("\ncaptures written. Commit bench/captures/ to freeze them.");
