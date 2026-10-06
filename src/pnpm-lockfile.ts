/**
 * The small, stable subset of pnpm lockfiles needed for dependency context.
 *
 * This is intentionally a line reader rather than a general YAML parser. The
 * package has no runtime dependencies, and pnpm's lockfile is generated YAML:
 * the sections and indentation used here are the parts that carry versions,
 * dependency edges, and importer scope. Unknown YAML or lockfile versions are
 * rejected so a new pnpm format cannot silently produce a confident report.
 */

import { readFileSync } from "node:fs";

import type { InstalledVersions, Requirement, Scope } from "./lockfile.js";

interface Entry {
  readonly key: string;
  readonly values: ReadonlyMap<string, string>;
  readonly maps: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

interface PnpmRecord {
  readonly name: string;
  readonly version: string;
  readonly dev: boolean;
  readonly installScript: boolean;
  readonly dependencies: ReadonlyMap<string, string>;
}

interface RootDeps {
  readonly production: readonly [string, string][];
  readonly development: readonly [string, string][];
}

export function readPnpmLockfile(path: string): InstalledVersions | undefined {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return undefined;
  }

  const version = lockfileVersion(raw);
  if (version === undefined || ![5, 6, 9].includes(version)) return undefined;

  const packages = entriesIn(raw, "packages");
  const snapshots = entriesIn(raw, "snapshots");
  const records = new Map<string, PnpmRecord>();

  for (const entry of [...packages, ...snapshots]) {
    const parsed = packageRecord(entry, version >= 9 && snapshots.includes(entry));
    if (parsed === undefined) continue;
    const key = `${parsed.name}@${parsed.version}`;
    const previous = records.get(key);
    records.set(key, previous === undefined ? parsed : mergeRecord(previous, parsed));
  }


  if (records.size === 0) return undefined;

  const roots = rootDependencies(raw);
  const versions = new Map<string, Set<string>>();
  const required = new Map<string, Requirement[]>();
  const scopes = new Map<string, Scope>();
  const installScripts = new Set<string>();

  for (const record of records.values()) {
    const installed = versions.get(record.name);
    if (installed === undefined) versions.set(record.name, new Set([record.version]));
    else installed.add(record.version);
    if (record.installScript) installScripts.add(record.name);

    for (const [name, range] of record.dependencies) {
      const list = required.get(name);
      const requirement = { by: `node_modules/${record.name}`, range };
      if (list === undefined) required.set(name, [requirement]);
      else list.push(requirement);
    }
  }

  assignScopes(roots, records, scopes);
  return { versions, required, scopes, installScripts };
}

function lockfileVersion(raw: string): number | undefined {
  const line = raw.split(/\r?\n/).find((item) => item.startsWith("lockfileVersion:"));
  if (line === undefined) return undefined;
  const value = line.slice("lockfileVersion:".length).trim().replace(/^['"]|['"]$/g, "");
  const major = Number(value.split(".")[0]);
  return Number.isInteger(major) ? major : undefined;
}

function packageRecord(entry: Entry, snapshot: boolean): PnpmRecord | undefined {
  const identity = packageIdentity(entry.key);
  if (identity === undefined) return undefined;
  const dependencies = new Map<string, string>();
  for (const [name, value] of entry.maps.get("dependencies") ?? []) dependencies.set(name, value);
  for (const [name, value] of entry.maps.get("optionalDependencies") ?? []) dependencies.set(name, value);
  for (const [name, value] of entry.maps.get("peerDependencies") ?? []) dependencies.set(name, value);

  return {
    name: identity.name,
    version: identity.version,
    // v5/v6 carry dev on package entries. v9 records scope through importers;
    // snapshot `dev` is not a stable field and is deliberately ignored.
    dev: !snapshot && entry.values.get("dev") === "true",
    installScript: !snapshot && entry.values.get("hasInstallScript") === "true",
    dependencies,
  };
}

function mergeRecord(left: PnpmRecord, right: PnpmRecord): PnpmRecord {
  return {
    ...left,
    dev: left.dev && right.dev,
    installScript: left.installScript || right.installScript,
    dependencies: new Map([...left.dependencies, ...right.dependencies]),
  };
}

function packageIdentity(key: string): { name: string; version: string } | undefined {
  let value = unquote(key).replace(/\([^)]*\)$/, "");
  if (value.startsWith("/")) {
    value = value.slice(1);
    const slash = value.lastIndexOf("/");
    if (slash > 0 && slash < value.length - 1 && /^\d/.test(value.slice(slash + 1))) {
      return { name: value.slice(0, slash), version: value.slice(slash + 1) };
    }
  }

  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return undefined;
  return { name: value.slice(0, at), version: value.slice(at + 1) };
}

function rootDependencies(raw: string): RootDeps {
  const importers = entriesIn(raw, "importers");
  const roots: RootDeps = { production: [], development: [] };
  const production = roots.production as [string, string][];
  const development = roots.development as [string, string][];

  if (importers.length > 0) {
    for (const importer of importers) {
      for (const [name, value] of importer.maps.get("dependencies") ?? []) production.push([name, value]);
      for (const [name, value] of importer.maps.get("optionalDependencies") ?? []) production.push([name, value]);
      for (const [name, value] of importer.maps.get("devDependencies") ?? []) development.push([name, value]);
    }
    return roots;
  }

  // pnpm 5.4 stores the root dependency maps at top level.
  for (const section of ["dependencies", "optionalDependencies"]) {
    const map = rootMap(raw, section);
    for (const pair of map) production.push(pair);
  }
  for (const pair of rootMap(raw, "devDependencies")) development.push(pair);
  return roots;
}

function assignScopes(
  roots: RootDeps,
  records: ReadonlyMap<string, PnpmRecord>,
  scopes: Map<string, Scope>,
): void {
  const index = new Map<string, string>();
  for (const [key, record] of records) index.set(`${record.name}@${record.version}`, key);

  const walk = (pairs: readonly [string, string][], scope: "prod" | "dev"): void => {
    const queue = pairs.map(([name, value]) => ({ name, value, scope }));
    const seen = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      const version = versionOf(current.value);
      if (version === undefined) continue;
      const key = index.get(`${current.name}@${version}`);
      if (key === undefined) continue;
      const visit = `${key}:${current.scope}`;
      if (seen.has(visit)) continue;
      seen.add(visit);
      const before = scopes.get(current.name);
      scopes.set(current.name, before === undefined || before === current.scope ? current.scope : "mixed");
      const record = records.get(key)!;
      for (const [name, value] of record.dependencies) queue.push({ name, value, scope: current.scope });
    }
  };

  walk(roots.production, "prod");
  walk(roots.development, "dev");
}

function versionOf(value: string): string | undefined {
  const clean = value.replace(/^link:/, "").replace(/\([^)]*\)$/, "");
  if (clean.startsWith("file:") || clean.startsWith("workspace:")) return undefined;
  return clean.includes("@") && clean.startsWith("npm:") ? clean.slice(clean.lastIndexOf("@") + 1) : clean;
}

function entriesIn(raw: string, section: string): Entry[] {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${section}:`);
  if (start < 0) return [];
  const entries: Entry[] = [];

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line !== "" && !line.startsWith(" ")) break;
    const header = /^  (?:(['"])(.*)\1|([^ :#][^:]*)):\s*(.*)$/.exec(line);
    if (header === null) continue;
    const key = header[2] ?? header[3];
    if (key === undefined) continue;
    const values = new Map<string, string>();
    const maps = new Map<string, Map<string, string>>();
    if (header[4] !== undefined && header[4] !== "") values.set("__self", scalar(header[4]));
    let activeMap: string | undefined;
    for (let child = index + 1; child < lines.length; child += 1) {
      const nested = lines[child]!;
      if (nested !== "" && !nested.startsWith(" ")) {
        index = child - 1;
        break;
      }
      const indent = nested.length - nested.trimStart().length;
      if (indent <= 2 && nested.trim() !== "") {
        index = child - 1;
        break;
      }
      const property = /^ {4}([^ :#][^:]*):(?:\s*(.*))?$/.exec(nested);
      if (property !== null) {
        const name = unquote(property[1]!.trim());
        const value = property[2]?.trim() ?? "";
        if (value !== "") values.set(name, scalar(value));
        else {
          activeMap = name;
          maps.set(name, new Map());
        }
        continue;
      }
      if (activeMap !== undefined) {
        const childProperty = /^ {6}([^ :#][^:]*):(?:\s*(.*))?$/.exec(nested);
        if (childProperty !== null) {
          const name = unquote(childProperty[1]!.trim());
          let value = childProperty[2]?.trim() ?? "";
          // v9 importer entries put `version` one level below the dependency.
          if (value === "") {
            for (let look = child + 1; look < lines.length; look += 1) {
              const candidate = lines[look]!;
              if (candidate.trim() === "") continue;
              if ((candidate.length - candidate.trimStart().length) <= 6) break;
              const version = /^ {8}version:\s*(.*)$/.exec(candidate);
              if (version !== null) {
                value = version[1]!.trim();
                break;
              }
            }
          }
          if (value !== "") maps.get(activeMap)!.set(name, scalar(value));
        }
      }
    }
    entries.push({ key, values, maps });
  }
  return entries;
}

function rootMap(raw: string, section: string): [string, string][] {
  return entriesIn(raw, section)
    .map((entry): [string, string] | undefined => {
      const value = entry.values.get("__self") ?? entry.values.get("version");
      return value === undefined ? undefined : [entry.key, value];
    })
    .filter((entry): entry is [string, string] => entry !== undefined);
}

function scalar(value: string): string {
  const trimmed = value.split(" #", 1)[0]!.trim();
  return unquote(trimmed);
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}
