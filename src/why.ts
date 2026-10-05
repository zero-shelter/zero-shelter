/** Explain how an installed package enters the project, using only lockfile facts. */

import type { ScaFinding } from "./finding.js";
import { accepts, compare } from "./version-range.js";
import { blockedBy, type InstalledPackage, type InstalledVersions } from "./lockfile.js";

export interface WhyPath {
  readonly nodes: readonly InstalledPackage[];
  readonly ranges: readonly string[];
}

export interface WhyFinding {
  readonly advisory: string;
  readonly fixedIn?: string;
  readonly severity: ScaFinding["severity"];
}

export interface WhyBlocker {
  readonly by: string;
  readonly range: string;
}

export interface WhyResult {
  readonly packageName: string;
  readonly versions: readonly string[];
  readonly paths: readonly WhyPath[];
  readonly findings: readonly WhyFinding[];
  readonly lowestDirect?: { readonly packageName: string; readonly version: string };
  readonly blockers: readonly WhyBlocker[];
}

/** Build a deterministic path explanation from npm's resolved package graph. */
export function explainDependency(
  packageName: string,
  installed: InstalledVersions,
  findings: readonly ScaFinding[] = [],
): WhyResult {
  const locations = installed.locations ?? new Map<string, InstalledPackage>();
  const matches = [...locations.entries()]
    .filter(([, packageInfo]) => packageInfo.name === packageName)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

  const paths: WhyPath[] = [];
  const graph = installed.graph ?? new Map();
  const directEdges = graph.get("") ?? [];
  const roots = [...directEdges].sort((a, b) => compareText(a.to, b.to));

  for (const root of roots) {
    const packageInfo = locations.get(root.to);
    if (packageInfo === undefined) continue;
    walk(root.to, [packageInfo], [root.range], new Set([root.to]), paths, graph, locations, packageName);
  }

  const relevant = findings
    .filter((finding) => finding.packageName === packageName)
    .map((finding) => ({
      advisory: finding.advisoryId,
      ...(finding.fixedIn === undefined ? {} : { fixedIn: finding.fixedIn }),
      severity: finding.severity,
    }))
    .sort((a, b) => (a.advisory < b.advisory ? -1 : a.advisory > b.advisory ? 1 : 0));

  const fixed = relevant.find((finding) => finding.fixedIn !== undefined)?.fixedIn;
  const candidates =
    fixed === undefined
      ? []
      : paths
          .filter((path) => path.nodes.length > 1 && accepts(path.ranges[path.ranges.length - 1] ?? "", fixed))
          .map((path) => ({ packageName: path.nodes[0]!.name, version: path.nodes[0]!.version }));
  const lowestDirect = candidates.sort((a, b) => compare(a.version, b.version))[0];
  const blockers =
    fixed === undefined || lowestDirect !== undefined
      ? []
      : blockedBy(packageName, fixed, installed).map(({ by, range }) => ({ by, range }));

  return {
    packageName,
    versions: [...new Set(matches.map(([, packageInfo]) => packageInfo.version))].sort(compare),
    paths,
    findings: relevant,
    ...(lowestDirect === undefined ? {} : { lowestDirect }),
    blockers,
  };
}

function walk(
  path: string,
  nodes: InstalledPackage[],
  ranges: string[],
  seen: Set<string>,
  output: WhyPath[],
  graph: ReadonlyMap<string, readonly { readonly name: string; readonly range: string; readonly to: string }[]>,
  locations: ReadonlyMap<string, InstalledPackage>,
  target: string,
): void {
  const current = nodes[nodes.length - 1]!;
  if (current.name === target) {
    output.push({ nodes: [...nodes], ranges: [...ranges] });
    return;
  }

  const edges = [...(graph.get(path) ?? [])].sort((a, b) => compareText(a.to, b.to));
  for (const edge of edges) {
    if (seen.has(edge.to)) continue;
    const packageInfo = locations.get(edge.to);
    if (packageInfo === undefined) continue;
    seen.add(edge.to);
    nodes.push(packageInfo);
    ranges.push(edge.range);
    walk(edge.to, nodes, ranges, seen, output, graph, locations, target);
    ranges.pop();
    nodes.pop();
    seen.delete(edge.to);
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function renderWhy(result: WhyResult): string {
  const lines = [`${result.packageName} ${result.versions.join(", ") || "not installed"}`];
  for (const finding of result.findings) {
    lines.push(
      `  ${finding.severity} ${finding.advisory}` +
        (finding.fixedIn === undefined ? "" : ` — fixed in ${finding.fixedIn}`),
    );
  }
  if (result.paths.length === 0) {
    lines.push("  no dependency path from a direct dependency was found");
  } else {
    lines.push("", ...result.paths.map((path) => `  ${path.nodes.map((node) => `${node.name} ${node.version}`).join(" → ")}`));
  }
  if (result.lowestDirect !== undefined) {
    lines.push(
      "",
      `  lowest direct version already in the lockfile that accepts the fixed version: ` +
        `${result.lowestDirect.packageName} ${result.lowestDirect.version}`,
    );
  } else if (result.findings.some((finding) => finding.fixedIn !== undefined)) {
    lines.push("", "  no direct dependency path in this lockfile is known to accept the fixed version");
    for (const blocker of result.blockers.slice(0, 5)) {
      lines.push(`    ${blocker.by} requires ${result.packageName} ${blocker.range}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function renderWhyJson(result: WhyResult): string {
  return `${JSON.stringify(
    {
      package: result.packageName,
      versions: result.versions,
      paths: result.paths.map((path) => ({
        packages: path.nodes.map((node) => ({ name: node.name, version: node.version })),
        ranges: path.ranges,
      })),
      findings: result.findings,
      ...(result.lowestDirect === undefined ? {} : { lowestDirect: result.lowestDirect }),
      blockers: result.blockers,
    },
    null,
    2,
  )}\n`;
}
