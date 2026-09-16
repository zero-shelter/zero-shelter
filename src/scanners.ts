import { lstatSync, readdirSync, statSync, type Dirent } from "node:fs";
import { isAbsolute, join } from "node:path";

export const SCANNERS_SCHEMA_VERSION = 1 as const;

export type Applicability = "detected" | "not-detected" | "always";
export type Availability = "available" | "missing" | "unknown";

export interface ScannerDomain {
  readonly id: string;
  readonly label: string;
  readonly applicability: Applicability;
  readonly evidence: readonly string[];
  readonly tasks: readonly string[];
}

export interface ScannerTool {
  readonly id: string;
  readonly availability: Availability;
}

export interface ScannerRecommendation {
  readonly tool: string;
  readonly tasks: readonly string[];
  readonly license: string;
  readonly installUrl: string;
  readonly installCommand?: string;
}

export interface ScannerInventory {
  readonly schemaVersion: typeof SCANNERS_SCHEMA_VERSION;
  readonly complete: boolean;
  readonly inspection: "not-run";
  readonly domains: readonly ScannerDomain[];
  readonly tools: readonly ScannerTool[];
  readonly recommendations: readonly ScannerRecommendation[];
  readonly warnings: readonly string[];
}

export interface ScannerOptions {
  /** Injected PATH/platform make filesystem discovery deterministic in tests. */
  readonly path?: string;
  readonly platform?: NodeJS.Platform;
  readonly maxDepth?: number;
  readonly maxEntries?: number;
}

interface DomainDefinition {
  readonly id: string;
  readonly label: string;
  readonly tasks: readonly string[];
  readonly always?: boolean;
  readonly matches: (path: string, name: string, isDirectory: boolean) => boolean;
}

interface CatalogueEntry {
  readonly id: string;
  readonly license: string;
  readonly installUrl: string;
  readonly installCommand?: string;
}

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "vendor",
  ".venv",
  "venv",
  "dist",
  "build",
  "coverage",
  ".next",
  ".cache",
  ".context",
  ".zero-shelter",
]);

const MAX_DEPTH = 8;
const MAX_ENTRIES = 20_000;

const domains: readonly DomainDefinition[] = [
  {
    id: "ci-workflows",
    label: "CI workflows",
    tasks: ["GitHub Actions security checks"],
    matches: (path, name, isDirectory) =>
      !isDirectory && path.split("/").length >= 3 && path.startsWith(".github/workflows/") && /\.ya?ml$/i.test(name),
  },
  {
    id: "container-config",
    label: "container configuration",
    tasks: ["container configuration"],
    matches: (_path, name, isDirectory) =>
      !isDirectory && /^(?:dockerfile(?:\..*)?|containerfile(?:\..*)?)$/i.test(name),
  },
  {
    id: "dependencies-go",
    label: "Go dependencies",
    tasks: ["Go dependency analysis"],
    matches: (_path, name, isDirectory) => !isDirectory && (name === "go.mod" || name === "go.sum"),
  },
  {
    id: "dependencies-java",
    label: "JVM dependencies",
    tasks: ["JVM dependency analysis"],
    matches: (_path, name, isDirectory) =>
      !isDirectory && /^(?:pom\.xml|build\.gradle(?:\.kts)?)$/i.test(name),
  },
  {
    id: "dependencies-javascript",
    label: "JavaScript dependencies",
    tasks: ["JavaScript dependency analysis"],
    matches: (_path, name, isDirectory) =>
      !isDirectory &&
      /^(?:package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/i.test(name),
  },
  {
    id: "dependencies-python",
    label: "Python dependencies",
    tasks: ["Python dependency analysis"],
    matches: (_path, name, isDirectory) =>
      !isDirectory && /^(?:requirements[^/]*\.txt|pyproject\.toml|poetry\.lock|uv\.lock)$/i.test(name),
  },
  {
    id: "dependencies-rust",
    label: "Rust dependencies",
    tasks: ["Rust dependency analysis"],
    matches: (_path, name, isDirectory) => !isDirectory && /^(?:cargo\.toml|cargo\.lock)$/i.test(name),
  },
  {
    id: "first-party-source",
    label: "first-party source",
    tasks: ["first-party source analysis"],
    matches: (_path, name, isDirectory) =>
      !isDirectory && /\.(?:c|cc|cpp|h|go|java|js|jsx|py|rs|ts|tsx)$/i.test(name),
  },
  {
    id: "infrastructure-terraform",
    label: "Terraform and infrastructure",
    tasks: ["Terraform and infrastructure configuration"],
    matches: (_path, name, isDirectory) =>
      !isDirectory && /^(?:.*\.tf|.*\.tf\.json|docker-compose\.ya?ml|compose\.ya?ml)$/i.test(name),
  },
  {
    id: "secrets-files",
    label: "secrets in files",
    tasks: ["file-secret review"],
    always: true,
    matches: () => false,
  },
  {
    id: "secrets-history",
    label: "secrets in git history",
    tasks: ["git-history secret review"],
    matches: (_path, name, _isDirectory) => name === ".git",
  },
];

const catalogue: readonly CatalogueEntry[] = [
  { id: "gitleaks", license: "MIT", installUrl: "https://github.com/gitleaks/gitleaks" },
  { id: "npm", license: "Node.js", installUrl: "https://nodejs.org/en/download" },
  { id: "opengrep", license: "LGPL-2.1", installUrl: "https://github.com/opengrep/opengrep" },
  { id: "osv-scanner", license: "Apache-2.0", installUrl: "https://github.com/google/osv-scanner" },
  { id: "pnpm", license: "MIT", installUrl: "https://pnpm.io/installation" },
  { id: "trivy", license: "Apache-2.0", installUrl: "https://github.com/aquasecurity/trivy" },
  { id: "zizmor", license: "MIT", installUrl: "https://docs.zizmor.sh/installation/" },
];

const catalogueById = new Map(catalogue.map((entry) => [entry.id, entry]));

/**
 * Inspect names and executable metadata only. No file contents, git history,
 * scanner process or network request is touched by this function.
 */
export function discoverScanners(cwd: string, options: ScannerOptions = {}): ScannerInventory {
  const root = lstatSync(cwd);
  if (!root.isDirectory()) throw new Error(`${cwd} is not a directory`);

  const maxDepth = options.maxDepth ?? MAX_DEPTH;
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;
  const evidence = new Map<string, string[]>();
  for (const domain of domains) evidence.set(domain.id, []);
  const warnings: string[] = [];
  let complete = true;
  let visited = 0;

  const visit = (directory: string, depth: number, prefix: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (!isMissing(error)) fail(`could not inspect ${prefix || "."}: ${errorCode(error)}`);
      return;
    }

    for (const entry of entries.sort((a, b) => compare(a.name, b.name))) {
      visited += 1;
      if (visited > maxEntries) {
        fail(`discovery stopped after ${maxEntries.toLocaleString("en-US")} directory entries`);
        return;
      }

      const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const isDirectory = entry.isDirectory();
      for (const domain of domains) {
        if (domain.matches(relativePath, entry.name, isDirectory)) evidence.get(domain.id)!.push(relativePath);
      }

      if (entry.name === ".git") continue;
      if (!isDirectory || EXCLUDED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
      if (depth >= maxDepth) {
        fail(`depth limit reached below ${relativePath}`);
        continue;
      }

      // Dirent.isDirectory() does not follow symlinks, so this never traverses
      // a project link or a link that points outside the selected root.
      visit(join(directory, entry.name), depth + 1, relativePath);
    }
  };

  visit(cwd, 0, "");

  const domainResults = domains
    .map((definition) => {
      const paths = evidence.get(definition.id)!.sort(compare);
      const applicability: Applicability = definition.always
        ? "always"
        : paths.length > 0
          ? "detected"
          : "not-detected";
      return {
        id: definition.id,
        label: definition.label,
        applicability,
        evidence: paths,
        tasks: definition.tasks,
      } satisfies ScannerDomain;
    })
    .sort((a, b) => compare(a.id, b.id));

  const recommendationTasks = new Map<string, Set<string>>();
  const add = (tool: string, tasks: readonly string[]) => {
    const set = recommendationTasks.get(tool) ?? new Set<string>();
    for (const task of tasks) set.add(task);
    recommendationTasks.set(tool, set);
  };

  const detected = new Set(domainResults.filter((domain) => domain.applicability === "detected").map((d) => d.id));
  if (detected.has("dependencies-javascript")) {
    const jsPaths = evidence.get("dependencies-javascript")!;
    if (jsPaths.some((path) => /(?:package-lock\.json|npm-shrinkwrap\.json|package\.json)$/i.test(path))) add("npm", ["JavaScript dependency analysis"]);
    if (jsPaths.some((path) => /pnpm-lock\.yaml$/i.test(path))) add("pnpm", ["JavaScript dependency analysis"]);
    add("osv-scanner", ["dependency analysis"]);
  }
  if (detected.has("dependencies-python") || detected.has("dependencies-go") || detected.has("dependencies-rust") || detected.has("dependencies-java")) {
    add("osv-scanner", ["dependency analysis"]);
  }
  const containerOrInfra = detected.has("container-config") || detected.has("infrastructure-terraform");
  if (containerOrInfra) add("trivy", ["container/IaC configuration", "file-secret review"]);
  if (detected.has("ci-workflows")) add("zizmor", ["GitHub Actions security checks"]);
  if (detected.has("first-party-source")) add("opengrep", ["first-party source analysis"]);
  if (!containerOrInfra) add("gitleaks", ["file-secret review"]);
  if (detected.has("secrets-history")) add("gitleaks", ["git-history secret review"]);

  const platform = options.platform ?? process.platform;
  const tools = [...recommendationTasks.keys()]
    .sort(compare)
    .map((id) => ({ id, availability: findAvailability(id, options.path ?? process.env.PATH ?? "", platform) } satisfies ScannerTool));

  const recommendations = [...recommendationTasks.keys()]
    .sort(compare)
    .map((id) => {
      const entry = catalogueById.get(id)!;
      const installCommand = brewCommand(id, platform);
      return {
        tool: id,
        tasks: [...recommendationTasks.get(id)!].sort(compare),
        license: entry.license,
        installUrl: entry.installUrl,
        ...(installCommand === undefined ? {} : { installCommand }),
      } satisfies ScannerRecommendation;
    });

  return {
    schemaVersion: SCANNERS_SCHEMA_VERSION,
    complete,
    inspection: "not-run",
    domains: domainResults,
    tools,
    recommendations,
    warnings,
  };

  function fail(message: string): void {
    complete = false;
    if (!warnings.includes(message)) warnings.push(message);
  }
}

export function renderScannerText(inventory: ScannerInventory): string {
  const lines = [
    "No scanners were run. Tool availability is not evidence of inspection.",
    "",
    "Suggested checks",
  ];
  for (const domain of inventory.domains) {
    if (domain.applicability === "always" || domain.applicability === "detected") {
      const evidence = domain.evidence.length === 0 ? "applicable to every project" : domain.evidence.join(", ");
      lines.push(`  ${domain.label.padEnd(28)} ${escapeText(evidence)}`);
    }
  }

  const available = new Set(inventory.tools.filter((tool) => tool.availability === "available").map((tool) => tool.id));
  const missing = new Set(inventory.tools.filter((tool) => tool.availability !== "available").map((tool) => tool.id));
  lines.push("", "Tools available");
  const availableRecommendations = inventory.recommendations.filter((entry) => available.has(entry.tool));
  if (availableRecommendations.length === 0) lines.push("  none detected on PATH");
  for (const recommendation of availableRecommendations) lines.push(...formatRecommendation(recommendation));
  lines.push("", "Tools to consider");
  const missingRecommendations = inventory.recommendations.filter((entry) => missing.has(entry.tool));
  if (missingRecommendations.length === 0) lines.push("  none");
  for (const recommendation of missingRecommendations) lines.push(...formatRecommendation(recommendation));

  const noSignals = inventory.domains
    .filter((domain) => domain.applicability === "not-detected")
    .filter((domain) => domain.id.startsWith("dependencies-") || domain.id === "first-party-source")
    .map((domain) => domain.label);
  if (noSignals.length > 0) lines.push("", `No matching project signals found: ${noSignals.join(", ")}`);
  if (inventory.warnings.length > 0) lines.push("", "Warnings", ...inventory.warnings.map((warning) => `  ${escapeText(warning)}`));
  if (!inventory.complete) lines.push("  inventory incomplete; absence is not evidence that a signal is missing");
  return `${lines.join("\n")}\n`;
}

export function renderScannerJson(inventory: ScannerInventory): string {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

function formatRecommendation(recommendation: ScannerRecommendation): string[] {
  const install = recommendation.installCommand ?? recommendation.installUrl;
  return [
    `  ${recommendation.tool} (${recommendation.license})  ${recommendation.tasks.join(", ")}`,
    `    ${install}`,
  ];
}

function findAvailability(id: string, pathValue: string, platform: NodeJS.Platform): Availability {
  const suffixes = platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  let unreadable = false;
  for (const rawDirectory of pathValue.split(platform === "win32" ? ";" : ":")) {
    if (rawDirectory === "" || !isAbsolute(rawDirectory)) continue;
    for (const suffix of suffixes) {
      const candidate = join(rawDirectory, `${id}${suffix}`);
      try {
        const stats = statSync(candidate);
        if (!stats.isFile()) continue;
        if (platform === "win32" || (stats.mode & 0o111) !== 0) return "available";
      } catch (error) {
        const code = errorCode(error);
        if (code !== "ENOENT" && code !== "ENOTDIR") unreadable = true;
      }
    }
  }
  return unreadable ? "unknown" : "missing";
}

function brewCommand(id: string, platform: NodeJS.Platform): string | undefined {
  if (platform !== "darwin" && platform !== "linux") return undefined;
  const commands: Record<string, string> = {
    gitleaks: "brew install gitleaks",
    opengrep: "brew install opengrep",
    osv: "brew install osv-scanner",
    "osv-scanner": "brew install osv-scanner",
    trivy: "brew install trivy",
    zizmor: "brew install zizmor",
  };
  return commands[id];
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function escapeText(value: string): string {
  return [...value]
    .map((character) => {
      const code = character.codePointAt(0)!;
      return code < 0x20 || code === 0x7f ? `\\u${code.toString(16).padStart(4, "0")}` : character;
    })
    .join("");
}

function isMissing(error: unknown): boolean {
  return errorCode(error) === "ENOENT";
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}
