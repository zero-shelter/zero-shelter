/**
 * English and Korean HTML report strings. Messages requires complete
 * catalogues at compile time. Terminal output remains English.
 */

import type { Severity } from "./finding.js";
import type { Reason } from "./triage.js";

export interface Messages {
  readonly documentTitle: string;
  readonly heading: string;
  readonly subheading: string;

  readonly themeLabel: string;

  readonly summaryReported: string;
  readonly summaryMerged: string;
  readonly summaryOutstanding: string;
  readonly summaryAccepted: string;
  readonly summaryShown: string;
  readonly sourcesUsed: string;
  readonly sourcesNone: string;
  readonly sourcesUnknown: string;

  readonly actNow: string;
  readonly actNowHow: string;
  /**
   * Instruction for managers whose upgrade counts cannot be verified.
   */
  readonly actNowHowNoCounts: (manager: string) => string;
  readonly promptsHeading: string;
  readonly promptsHow: string;
  readonly promptFix: (commands: string) => string;
  readonly promptFixWorkspace: (commands: string) => string;
  /**
   * Package-manager-specific override key, including pnpm nesting.
   */
  readonly promptOverrides: (packages: string, field: string) => string;
  readonly promptUnfixable: (packages: string) => string;
  readonly promptUnfixableMore: (packages: string, hidden: number) => string;
  readonly glossary: string;
  readonly glossaryTerms: readonly (readonly [string, string])[];
  readonly actNowEmpty: string;
  readonly clears: (count: number) => string;
  readonly copy: string;
  readonly copied: string;
  readonly selected: string;
  readonly workspaceCaveat: string;

  readonly transitive: (findings: number, packages: number) => string;
  readonly transitiveHow: string;
  readonly transitiveRisk: string;

  readonly ledger: string;
  readonly ledgerHow: string;
  readonly colSeverity: string;
  readonly colPackage: string;
  readonly colAdvisory: string;
  readonly colFixedIn: string;
  readonly colScore: string;
  readonly colSources: string;
  readonly noFix: string;
  readonly direct: string;
  readonly indirect: string;
  readonly whyThisScore: string;
  readonly range: string;
  readonly alsoKnownAs: string;
  readonly maybeDuplicate: string;
  readonly disagreedFix: (versions: string, chosen: string) => string;
  readonly reasonText: (reason: Reason) => string;
  readonly weights: string;
  readonly weightSeverity: (severity: Severity) => string;
  readonly weightDirect: string;
  readonly weightFixAvailable: string;
  readonly weightCorroborated: string;
  readonly weightUnjoinedSibling: string;

  readonly accepted: string;
  readonly acceptedBody: (count: number) => string;
  readonly resolved: string;
  readonly resolvedBody: (count: number) => string;
  readonly resolvedDoubt: (sources: string) => string;

  readonly nothingOutstanding: string;
  readonly nothingScanned: string;

  readonly history: string;
  readonly historyOutstanding: string;
  readonly historyAppeared: string;
  readonly historyGone: string;
  readonly historyNote: string;
  readonly historyOlder: (hidden: number, total: number) => string;

  readonly reproduce: string;
  readonly reproduceBody: string;
  readonly deterministic: string;
  readonly severityRank: string;
}

const EN: Messages = {
  documentTitle: "zero-shelter judgement",
  heading: "Dependency judgement",
  subheading: "Scanner findings, available updates, and baseline status.",

  themeLabel: "Switch theme",

  summaryReported: "reported",
  summaryMerged: "after merge",
  summaryOutstanding: "outstanding",
  summaryAccepted: "already accepted",
  summaryShown: "shown here",
  sourcesUsed: "Sources",
  sourcesNone: "No scanner produced a report.",
  sourcesUnknown: "Scanner run status was not provided.",

  actNow: "Run commands",
  actNowHow:
    "Each line upgrades one package. Counts estimate how many findings the update addresses. Run the commands, then run zero-shelter judge again to check the result.",
  actNowHowNoCounts: (manager) =>
    `Each line upgrades one package. Counts are not shown for ${manager}; only npm lockfiles are checked for whether the update reaches every installed copy.`,
  promptsHeading: "Ask an agent",
  promptsHow: "Copy a prompt into your coding agent. Updates require another scan; forced versions require your review.",
  promptFix: (commands) =>
    `Upgrade these dependencies and confirm the result: ${commands}. Then run \`npx zero-shelter judge\` again and tell me what it says. Do not run --update-baseline, and do not report success from npm audit; it does not use this project's baseline.`,
  promptFixWorkspace: (commands) =>
    `This is a workspace root. Upgrade these dependencies in whichever workspace declares them, with npm i -w <workspace>: ${commands}. Find the declaring package.json first rather than guessing, then run \`npx zero-shelter judge\` again and tell me what it says. Do not run --update-baseline.`,
  promptOverrides: (packages, field) =>
    `These packages have a published fix but arrive through another dependency: ${packages}. Show me what a package.json ${field} entry would look like for them, and say which parent package pinned each old version and what could break. Do not apply it yet.`,
  promptUnfixable: (packages) =>
    `No fix version was reported for: ${packages}. For each, check whether the vulnerable code path is reachable from this project's own code, and say plainly when you cannot tell.`,
  promptUnfixableMore: (packages, hidden) =>
    `No fix version was reported for: ${packages}, and ${hidden} more listed in the report. For each, check whether the vulnerable code path is reachable from this project's own code, and say plainly when you cannot tell.`,
  glossary: "What the numbers mean",
  glossaryTerms: [
    ["reported", "Findings the scanners handed over, before anything was reconciled."],
    ["after merge", "What is left once findings that describe the same vulnerability under different names are joined."],
    ["outstanding", "Merged findings that are not recorded in the baseline. These are the findings listed for review."],
    ["already accepted", "Recorded in .zero-shelter/baseline.json and deliberately not listed. Accepting is a decision about risk, not a way to make output quiet."],
    ["no longer reported", "Accepted findings that produced nothing this run. Not the same as fixed: a finding also disappears when the scanner that found it did not run."],
    ["severity", "Five blocks for critical, one for info. The blocks carry the rank so it survives without colour."],
    ["direct / indirect", "Direct means this project declares the package. Indirect means another dependency brings it in. Installing it directly may leave the vulnerable copy in place."],
    ["score", "Ranking points from the weights table below the findings. This is separate from CVSS."],
  ],
  actNowEmpty: "No direct upgrade command is available from this report.",
  clears: (count) => `clears ${count}`,
  copy: "Copy",
  copied: "Copied",
  selected: "Selected: press Ctrl+C or ⌘C",
  workspaceCaveat:
    "Workspace root: add -w <workspace> so the version lands in the package that declares it. Hoisting hides which one from the scanners.",

  transitive: (findings, packages) =>
    `${findings} finding(s) in ${packages} package(s) have a published fix but arrive through another dependency.`,
  transitiveHow: "Proposed version overrides (review before applying):",
  transitiveRisk: "This changes the version required by a parent package and can break it. Check compatibility before applying.",

  ledger: "Findings to review",
  ledgerHow:
    "Ordered by score. Open a row for the scoring reasons, merged identifiers, and possible duplicates.",
  colSeverity: "Severity",
  colPackage: "Package",
  colAdvisory: "Advisory",
  colFixedIn: "Fixed in",
  colScore: "Score",
  colSources: "Reported by",
  noFix: "not reported",
  direct: "direct",
  indirect: "indirect",
  whyThisScore: "Why this score",
  range: "Affected range",
  alsoKnownAs: "Also known as",
  maybeDuplicate: "May duplicate",
  disagreedFix: (versions, chosen) =>
    `Sources named different fixes (${versions}). ${chosen} satisfies all of them.`,
  reasonText: englishReason,
  weights: "weights",
  weightSeverity: (severity) => `severity: ${severity}`,
  weightDirect: "direct dependency",
  weightFixAvailable: "fix available",
  weightCorroborated: "each extra tool that agrees",
  weightUnjoinedSibling: "has an unjoined sibling",

  accepted: "Already accepted",
  acceptedBody: (count) =>
    `${count} finding(s) are recorded in the baseline and deliberately not listed above.`,
  resolved: "No longer reported",
  resolvedBody: (count) =>
    `${count} accepted finding(s) were not reported this run. Updating the baseline removes these entries and accepts all current findings; review that risk before using --update-baseline.`,
  resolvedDoubt: (sources) =>
    `${sources} contributed when the baseline was recorded and did not run this time, so some of those may simply not have been looked for.`,

  nothingOutstanding: "No new findings.",
  nothingScanned:
    "No scanner produced a report, so this is not a pass. Check the scanner notes above.",

  history: "Recorded runs",
  historyOutstanding: "outstanding",
  historyAppeared: "appeared",
  historyGone: "no longer reported",
  historyOlder: (hidden, total) =>
    `Showing the last 12 of ${total} recorded runs; ${hidden} older one(s) are in .zero-shelter/history.jsonl.`,
  historyNote:
    "Recorded when the run was asked to (--record). A finding leaves this list when it is fixed, when it is accepted into the baseline, or when the scanner that found it did not run.",

  reproduce: "Reproducing this",
  reproduceBody: "This page was written by:",
  deterministic:
    "The same judgement and the same recorded runs produce a byte-identical page. Nothing here is read from a clock while rendering; the dates above come from the history file.",
  severityRank: "Rank",
};

const KO: Messages = {
  documentTitle: "zero-shelter 판정",
  heading: "의존성 판정",
  subheading: "스캐너 보고, 업데이트 방법과 baseline 상태를 확인합니다.",

  themeLabel: "테마 전환",

  summaryReported: "스캐너 보고",
  summaryMerged: "병합 후",
  summaryOutstanding: "검토할 항목",
  summaryAccepted: "수용한 항목",
  summaryShown: "표시한 항목",
  sourcesUsed: "보고서를 낸 스캐너",
  sourcesNone: "보고서를 낸 스캐너가 없습니다.",
  sourcesUnknown: "스캐너 실행 정보가 없습니다.",

  actNow: "명령 실행",
  actNowHow:
    "각 줄은 패키지 하나를 업데이트합니다. 옆의 숫자는 업데이트로 해소될 것으로 예상하는 항목 수입니다. 실행 후 zero-shelter judge로 결과를 확인하세요.",
  actNowHowNoCounts: (manager) =>
    `각 줄은 패키지 하나를 업데이트합니다. 설치된 모든 버전에 업데이트가 적용되는지는 npm 락파일에서만 확인하므로 ${manager}에서는 항목 수를 표시하지 않습니다.`,
  promptsHeading: "AI에 맡기기",
  promptsHow: "코딩 에이전트에 요청문을 붙여 넣으세요. 업데이트 후에는 다시 검사하고, 버전을 강제하려면 먼저 검토합니다.",
  promptFix: (commands) =>
    `다음 의존성을 업데이트하고 결과를 확인해 주세요: ${commands}. 그다음 \`npx zero-shelter judge\`를 다시 실행해 결과를 알려 주세요. --update-baseline은 실행하지 마세요. npm audit은 이 프로젝트의 baseline을 사용하지 않으므로 그 결과만으로 성공을 보고하지 마세요.`,
  promptFixWorkspace: (commands) =>
    `워크스페이스 루트입니다. 다음 의존성을 선언한 package.json을 먼저 찾고 npm i -w <workspace>로 업데이트해 주세요: ${commands}. 그다음 \`npx zero-shelter judge\`를 다시 실행해 결과를 알려 주세요. --update-baseline은 실행하지 마세요.`,
  promptOverrides: (packages, field) =>
    `다음 간접 의존성에는 수정 버전이 있습니다: ${packages}. package.json의 ${field} 설정안을 작성해 주세요. 각 버전을 요구한 상위 패키지와 호환성 위험을 설명하고, 승인 전에는 적용하지 마세요.`,
  promptUnfixable: (packages) =>
    `다음 패키지는 보고서에 수정 버전이 없습니다: ${packages}. 취약한 코드 경로가 프로젝트 코드에서 실행될 수 있는지 확인해 주세요. 판단할 수 없는 경우에는 그 이유를 알려 주세요.`,
  promptUnfixableMore: (packages, hidden) =>
    `다음 패키지와 보고서에 있는 나머지 ${hidden}개는 보고서에 수정 버전이 없습니다: ${packages}. 취약한 코드 경로가 프로젝트 코드에서 실행될 수 있는지 확인해 주세요. 판단할 수 없는 경우에는 그 이유를 알려 주세요.`,
  glossary: "숫자가 뜻하는 것",
  glossaryTerms: [
    ["스캐너 보고", "각 스캐너가 보고한 항목을 병합하기 전의 수입니다."],
    ["병합 후", "식별자가 연결된 동일 취약점 보고를 병합한 뒤 남은 수입니다."],
    ["검토할 항목", "병합한 항목 중 baseline에 수용되지 않아 검토할 항목입니다."],
    ["수용한 항목", ".zero-shelter/baseline.json에 수용한 항목입니다. 수용은 해당 위험을 받아들이는 결정이며, 취약점을 해결하지는 않습니다."],
    ["더 이상 보고되지 않음", "수용했던 항목이 이번 실행에서 보고되지 않았습니다. 해당 스캐너가 실행되지 않았을 때도 보고에서 빠지므로 해결됐다고 단정할 수 없습니다."],
    ["심각도", "critical은 블록 5개, info는 1개로 표시합니다. 색을 구분하지 않아도 등급을 읽을 수 있습니다."],
    ["직접 / 간접", "직접 의존성은 프로젝트가 선언한 패키지입니다. 간접 의존성은 다른 패키지가 설치하며, 직접 설치해도 취약한 버전이 남을 수 있습니다."],
    ["점수", "목록 아래 가중치 표로 계산한 정렬 점수입니다. CVSS와는 별개입니다."],
  ],
  actNowEmpty: "이 보고서에서 제안할 직접 의존성 업데이트 명령이 없습니다.",
  clears: (count) => `${count}건 예상`,
  copy: "복사",
  copied: "복사됨",
  selected: "선택됨: Ctrl+C 또는 ⌘C를 누르세요",
  workspaceCaveat:
    "워크스페이스 루트입니다. 취약 범위를 선언한 패키지에 버전이 들어가도록 -w <workspace>를 붙이세요. hoisting 때문에 어느 워크스페이스인지는 스캐너가 알려주지 못합니다.",

  transitive: (findings, packages) =>
    `${findings}건(${packages}개 패키지)은 수정 버전이 있지만 다른 의존성을 통해 들어옵니다.`,
  transitiveHow: "버전 강제 지정 예시입니다. 적용 전에 검토하세요.",
  transitiveRisk: "상위 패키지가 요구한 버전이 바뀌면 동작하지 않을 수 있습니다. 적용 전에 호환성을 확인하세요.",

  ledger: "검토할 항목",
  ledgerHow:
    "점수가 높은 순서로 표시합니다. 행을 펼치면 점수의 근거, 병합한 식별자와 중복 가능성을 확인할 수 있습니다.",
  colSeverity: "심각도",
  colPackage: "패키지",
  colAdvisory: "권고",
  colFixedIn: "수정 버전",
  colScore: "점수",
  colSources: "보고한 스캐너",
  noFix: "보고 없음",
  direct: "직접",
  indirect: "간접",
  whyThisScore: "이 점수의 근거",
  range: "영향 범위",
  alsoKnownAs: "다른 식별자",
  maybeDuplicate: "중복 가능성",
  disagreedFix: (versions, chosen) =>
    `스캐너가 보고한 수정 버전이 다릅니다(${versions}). ${chosen}이 모두 충족합니다.`,
  reasonText: koreanReason,
  weights: "가중치",
  weightSeverity: (severity) => `심각도: ${koreanSeverity[severity]}`,
  weightDirect: "직접 의존성",
  weightFixAvailable: "수정 버전 있음",
  weightCorroborated: "추가로 일치한 스캐너마다",
  weightUnjoinedSibling: "같은 패키지에 병합하지 않은 항목 있음",

  accepted: "수용한 항목",
  acceptedBody: (count) => `baseline에 수용한 ${count}건은 위 목록에서 제외했습니다.`,
  resolved: "더 이상 보고되지 않음",
  resolvedBody: (count) =>
    `수용했던 ${count}건이 이번 실행에서 보고되지 않았습니다. --update-baseline은 이 항목을 제거하고 현재 보고된 항목을 모두 수용합니다. 실행 전에 위험을 검토하세요.`,
  resolvedDoubt: (sources) =>
    `baseline 기록 당시 사용한 ${sources}이(가) 이번에는 실행되지 않았습니다. 해당 스캐너의 검사가 빠져 보고되지 않은 항목이 있을 수 있습니다.`,

  nothingOutstanding: "새로 보고된 항목이 없습니다.",
  nothingScanned:
    "보고서를 낸 스캐너가 없어 판정하지 못했습니다. 위 안내에서 원인을 확인하세요.",

  history: "기록된 실행",
  historyOutstanding: "검토할 항목",
  historyAppeared: "새로 나타남",
  historyGone: "더 이상 보고되지 않음",
  historyOlder: (hidden, total) =>
    `기록된 ${total}회 중 최근 12회입니다. 나머지 ${hidden}회는 .zero-shelter/history.jsonl에 있습니다.`,
  historyNote:
    "--record로 실행한 경우에만 기록됩니다. 취약점을 해결하거나 baseline에 수용하거나 해당 스캐너가 실행되지 않으면 항목이 목록에서 빠질 수 있습니다.",

  reproduce: "이 페이지 재현하기",
  reproduceBody: "이 페이지를 만든 명령:",
  deterministic:
    "같은 판정과 같은 기록이면 바이트 단위로 같은 페이지가 나옵니다. 렌더링 중에 시계를 읽지 않습니다. 위의 날짜는 기록 파일에서 가져옵니다.",
  severityRank: "순위",
};

export const LANGUAGES = { en: EN, ko: KO } as const;

export type Language = keyof typeof LANGUAGES;

export function isLanguage(value: string): value is Language {
  return Object.hasOwn(LANGUAGES, value);
}

export function messagesFor(language: Language): Messages {
  return LANGUAGES[language];
}

function englishReason(reason: Reason): string {
  switch (reason.kind) {
    case "severity":
      return `severity: ${reason.severity}`;
    case "direct":
      return "direct dependency";
    case "fixAvailable":
      return reason.fixedIn === undefined ? "fix available" : `fix available: ${reason.fixedIn}`;
    case "corroborated":
      return `reported by ${reason.tools} tools`;
    case "unjoinedSibling":
      return `${reason.count} unjoined finding(s) for the same package`;
  }
}

const koreanSeverity: Record<Severity, string> = {
  critical: "치명적",
  high: "높음",
  moderate: "중간",
  low: "낮음",
  info: "정보",
};

function koreanReason(reason: Reason): string {
  switch (reason.kind) {
    case "severity":
      return `심각도: ${koreanSeverity[reason.severity]}`;
    case "direct":
      return "직접 의존성";
    case "fixAvailable":
      return reason.fixedIn === undefined
        ? "수정 버전 있음"
        : `수정 버전 있음: ${reason.fixedIn}`;
    case "corroborated":
      return `${reason.tools}개 스캐너가 보고`;
    case "unjoinedSibling":
      return `같은 패키지에 병합하지 않은 항목 ${reason.count}개`;
  }
}
