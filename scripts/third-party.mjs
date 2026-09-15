#!/usr/bin/env node
/**
 * Generate English and Korean notices from installed direct dependencies,
 * including resolved versions, licenses and repository links.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const manifest = readJson(join(root, "package.json"));
const direct = [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.devDependencies ?? {}),
].sort();

const rows = direct.map((name) => {
  const installed = readJson(join(root, "node_modules", name, "package.json"));
  return {
    name,
    version: installed.version ?? "UNKNOWN",
    license: normalizeLicense(installed.license),
    repository: repositoryUrl(installed.repository),
    runtime: Object.hasOwn(manifest.dependencies ?? {}, name),
  };
});

const table = (purpose) =>
  rows
    .map(
      (r, i) =>
        `| ${i + 1} | ${r.name} | ${r.version} | ${r.license} | ${r.repository} | ${purpose(r)} |`,
    )
    .join("\n");

// Document scanner executables separately from bundled package dependencies.
const EXTERNAL = `## External executables

Called as separate processes. None of their code is bundled or vendored here.

| Tool | Used for | How it is used |
|---|---|---|
| npm CLI (\`npm audit\`) | npm / Yarn projects | Run as \`npm audit --json\` for npm and Yarn projects; only its output is read. |
| pnpm CLI (\`pnpm audit\`) | pnpm projects | Run as \`pnpm audit --json\` when a pnpm lockfile is detected. |
| [osv-scanner](https://github.com/google/osv-scanner) | Installed on \`PATH\` | Used when found on \`PATH\`, reported as skipped otherwise. |
`;

const EXTERNAL_KO = `## 외부 실행 도구

별도 프로세스로 호출합니다. 아래 도구의 코드는 이 패키지에 포함되지 않습니다.

| 도구 | 사용 조건 | 사용 방식 |
|---|---|---|
| npm CLI (\`npm audit\`) | npm / Yarn 프로젝트 | \`npm audit --json\`으로 실행하고 출력만 읽습니다. |
| pnpm CLI (\`pnpm audit\`) | pnpm 프로젝트 | pnpm 락파일을 확인하면 \`pnpm audit --json\`으로 실행합니다. |
| [osv-scanner](https://github.com/google/osv-scanner) | \`PATH\`에 설치된 경우 | 없으면 건너뛴 이유를 표시합니다. |
`;

writeFileSync(
  join(root, "THIRD_PARTY.md"),
  `# Third-party components

[English](./THIRD_PARTY.md) · [한국어](./THIRD_PARTY.ko.md)

Direct dependencies only, with the version resolved in \`package-lock.json\`.
Regenerate with \`npm run third-party\`; CI fails if either file drifts.

Transitive dependencies and GitHub Actions are intentionally excluded.

| No. | Package | Version | License | Repository | Purpose |
|---|---|---|---|---|---|
${table((r) => (r.runtime ? "Runtime dependency" : "Development and build tooling"))}

${EXTERNAL}
This project itself is licensed under Apache-2.0. See \`LICENSE\`.
`,
);

writeFileSync(
  join(root, "THIRD_PARTY.ko.md"),
  `# 서드파티 구성요소

[English](./THIRD_PARTY.md) · [한국어](./THIRD_PARTY.ko.md)

직접 의존성을 \`package-lock.json\`에 기록된 버전과 함께 표시합니다.
\`npm run third-party\`로 재생성하며, 파일이 생성 결과와 다르면 CI가 실패합니다.

간접 의존성과 GitHub Actions는 포함하지 않습니다.

| 번호 | 라이브러리명 | 버전 | 라이선스 | 공식 저장소 URL | 사용 목적 및 주요 기능 |
|---|---|---|---|---|---|
${table((r) => (r.runtime ? "런타임 의존성" : "개발·빌드 도구"))}

${EXTERNAL_KO}
이 프로젝트 자체는 Apache-2.0으로 배포됩니다. \`LICENSE\`를 보세요.
`,
);

console.log(`THIRD_PARTY.md · THIRD_PARTY.ko.md: ${rows.length} direct dependencies`);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizeLicense(license) {
  // Current direct dependencies use SPDX strings; other forms need review.
  if (typeof license === "string") return license;
  return "UNKNOWN — verify manually";
}

function repositoryUrl(repository) {
  const raw = typeof repository === "string" ? repository : repository?.url;
  if (!raw) return "UNKNOWN — verify manually";

  return raw
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^github:(.+)$/, "https://github.com/$1");
}
