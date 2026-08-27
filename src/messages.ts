/**
 * Strings for the HTML report.
 *
 * The terminal stays English: its output is advisory identifiers, package names
 * and exit codes, and a translated CLI would only add a place for the two to
 * disagree. The HTML report is different — it is opened by people who did not
 * run the command, in several countries, and reading it is the whole point.
 *
 * Catalogues are complete by construction: `Messages` is a type, so a missing
 * key fails the build rather than rendering an English string into a Korean
 * page.
 */

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

  readonly actNow: string;
  readonly actNowHow: string;
  readonly promptsHeading: string;
  readonly promptsHow: string;
  readonly promptFix: (commands: string) => string;
  readonly promptFixWorkspace: (commands: string) => string;
  /**
   * `field` is the manager's own spelling — "overrides", "resolutions", or
   * pnpm's nested form. Passed in rather than written into the catalogue: a
   * translator should not have to know that pnpm ignores a top-level key.
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
  subheading: "What to fix now, and what was left out on purpose.",

  themeLabel: "Dark",

  summaryReported: "reported",
  summaryMerged: "after merge",
  summaryOutstanding: "outstanding",
  summaryAccepted: "already accepted",
  summaryShown: "shown here",
  sourcesUsed: "Sources",
  sourcesNone: "No scanner produced a report.",

  actNow: "Run this",
  actNowHow:
    "Each line upgrades one package and clears the findings counted beside it. Run them in this order; the first clears the most.",
  promptsHeading: "Or hand it to an agent",
  promptsHow: "Copy one of these into a coding agent. Each ends by re-judging, so the claim gets checked rather than assumed.",
  promptFix: (commands) =>
    `Upgrade these dependencies and confirm the result: ${commands}. Then run \`npx zero-shelter judge\` again and tell me what it says. Do not run --update-baseline, and do not report success from npm audit — it does not know this project's baseline.`,
  promptFixWorkspace: (commands) =>
    `This is a workspace root. Upgrade these dependencies in whichever workspace declares them, with npm i -w <workspace>: ${commands}. Find the declaring package.json first rather than guessing, then run \`npx zero-shelter judge\` again and tell me what it says. Do not run --update-baseline.`,
  promptOverrides: (packages, field) =>
    `These packages have a published fix but arrive through another dependency: ${packages}. Show me what a package.json ${field} entry would look like for them, and say which parent package pinned each old version and what could break. Do not apply it yet.`,
  promptUnfixable: (packages) =>
    `These have no published fix: ${packages}. For each, check whether the vulnerable code path is reachable from this project's own code, and say plainly when you cannot tell.`,
  promptUnfixableMore: (packages, hidden) =>
    `These have no published fix: ${packages}, and ${hidden} more listed in the report. For each, check whether the vulnerable code path is reachable from this project's own code, and say plainly when you cannot tell.`,
  glossary: "What the numbers mean",
  glossaryTerms: [
    ["reported", "Findings the scanners handed over, before anything was reconciled."],
    ["after merge", "What is left once findings that describe the same vulnerability under different names are joined."],
    ["outstanding", "Merged findings that are not recorded in the baseline. This is the number that matters."],
    ["already accepted", "Recorded in .zero-shelter/baseline.json and deliberately not listed. Accepting is a decision about risk, not a way to make output quiet."],
    ["no longer reported", "Accepted findings that produced nothing this run. Not the same as fixed: a finding also disappears when the scanner that found it did not run."],
    ["severity", "Five blocks for critical, one for info. The blocks carry the rank so it survives without colour."],
    ["direct / indirect", "Direct means this project declares the package. Indirect means it arrives through something else, and `npm i` will not fix it."],
    ["score", "Our ranking, not a CVSS number. Every point comes from the weights table under the ledger, and you can argue with a row."],
  ],
  actNowEmpty: "No published fix applies to a direct dependency yet.",
  clears: (count) => `clears ${count}`,
  copy: "Copy",
  copied: "Copied",
  selected: "Selected — press ctrl-C",
  workspaceCaveat:
    "Workspace root: add -w <workspace> so the version lands in the package that declares it. Hoisting hides which one from the scanners.",

  transitive: (findings, packages) =>
    `${findings} finding(s) in ${packages} package(s) have a published fix but arrive through another dependency.`,
  transitiveHow: "Forcing them looks like this:",
  transitiveRisk: "This overrides what a parent package pinned, which can break it.",

  ledger: "Every finding",
  ledgerHow:
    "Worst first. Open a row to see how its score was reached, which identifiers it was merged from, and what it might duplicate.",
  colSeverity: "Severity",
  colPackage: "Package",
  colAdvisory: "Advisory",
  colFixedIn: "Fixed in",
  colScore: "Score",
  colSources: "Reported by",
  noFix: "none published",
  direct: "direct",
  indirect: "indirect",
  whyThisScore: "Why this score",
  range: "Affected range",
  alsoKnownAs: "Also known as",
  maybeDuplicate: "May duplicate",
  disagreedFix: (versions, chosen) =>
    `Sources named different fixes (${versions}). ${chosen} satisfies all of them.`,

  accepted: "Already accepted",
  acceptedBody: (count) =>
    `${count} finding(s) are recorded in the baseline and deliberately not listed above.`,
  resolved: "No longer reported",
  resolvedBody: (count) =>
    `${count} accepted finding(s) produced nothing this run. Re-record with --update-baseline to drop them.`,
  resolvedDoubt: (sources) =>
    `${sources} contributed when the baseline was recorded and did not run this time, so some of those may simply not have been looked for.`,

  nothingOutstanding: "Nothing new to fix.",
  nothingScanned:
    "Nothing was scanned, so this is not a pass. The notes above say what stopped each source.",

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
  subheading: "지금 고칠 것과, 의도적으로 빼 둔 것.",

  themeLabel: "어둡게",

  summaryReported: "원시 보고",
  summaryMerged: "병합 후",
  summaryOutstanding: "미해결",
  summaryAccepted: "이미 수용",
  summaryShown: "여기 표시",
  sourcesUsed: "사용된 소스",
  sourcesNone: "리포트를 낸 스캐너가 없습니다.",

  actNow: "이걸 실행하세요",
  actNowHow:
    "각 줄은 패키지 하나를 올리고, 옆에 적힌 수만큼 항목이 사라집니다. 위에서부터 실행하세요. 첫 줄이 가장 많이 해결합니다.",
  promptsHeading: "에이전트에게 시키려면",
  promptsHow: "코딩 에이전트에 그대로 붙여 넣으세요. 전부 마지막에 재판정으로 끝나므로, 됐다고 가정하지 않고 확인합니다.",
  promptFix: (commands) =>
    `다음 의존성을 올리고 결과를 확인해줘: ${commands}. 그다음 \`npx zero-shelter judge\`를 다시 실행해서 뭐라고 나오는지 알려줘. --update-baseline은 실행하지 말고, npm audit 결과로 성공을 보고하지 마 — 그건 이 프로젝트의 baseline을 모른다.`,
  promptFixWorkspace: (commands) =>
    `여기는 워크스페이스 루트야. 이 의존성들을 선언한 워크스페이스에서 npm i -w <workspace>로 올려줘: ${commands}. 어느 package.json이 선언했는지 먼저 찾고 추측하지 마. 그다음 \`npx zero-shelter judge\`를 다시 실행해서 뭐라고 나오는지 알려줘. --update-baseline은 실행하지 마.`,
  promptOverrides: (packages, field) =>
    `이 패키지들은 수정 버전이 있지만 다른 의존성을 통해 들어와: ${packages}. package.json ${field} 항목이 어떻게 되는지 보여주고 각각 어느 상위 패키지가 옛 버전을 고정했는지와 뭐가 깨질 수 있는지 말해줘. 아직 적용하지는 마.`,
  promptUnfixable: (packages) =>
    `이건 공개된 수정 버전이 없어: ${packages}. 각각 그 취약한 코드 경로가 이 프로젝트 코드에서 실제로 도달 가능한지 확인하고 판단할 수 없으면 없다고 분명히 말해줘.`,
  promptUnfixableMore: (packages, hidden) =>
    `이건 공개된 수정 버전이 없어: ${packages}, 그리고 리포트에 ${hidden}개 더 있어. 각각 그 취약한 코드 경로가 이 프로젝트 코드에서 실제로 도달 가능한지 확인하고, 판단할 수 없으면 없다고 분명히 말해줘.`,
  glossary: "숫자가 뜻하는 것",
  glossaryTerms: [
    ["원시 보고", "스캐너가 넘긴 그대로의 항목 수. 아직 아무것도 맞대지 않은 상태입니다."],
    ["병합 후", "같은 취약점을 다른 이름으로 부르던 것들을 이은 뒤 남은 수."],
    ["미해결", "baseline에 기록되지 않은 병합 후 항목. 이게 실제로 중요한 숫자입니다."],
    ["이미 수용", ".zero-shelter/baseline.json에 기록되어 목록에서 빠진 것. 수용은 위험에 대한 판단이지 출력을 조용하게 만드는 방법이 아닙니다."],
    ["더 이상 보고되지 않음", "수용했던 항목이 이번 실행에서 안 나온 것. 고쳐진 것과 같지 않습니다. 그걸 찾아낸 스캐너가 안 돌았을 때도 사라집니다."],
    ["심각도", "critical은 블록 다섯, info는 하나. 색이 없어도 순위가 남도록 블록 개수로 등급을 표시합니다."],
    ["직접 / 간접", "직접은 이 프로젝트가 선언한 패키지입니다. 간접은 다른 패키지를 타고 들어오고 `npm i`로는 안 고쳐집니다."],
    ["점수", "CVSS가 아니라 우리 랭킹입니다. 모든 점수는 원장 아래 가중치 표에서 나오고 행 단위로 따질 수 있습니다."],
  ],
  actNowEmpty: "직접 의존성에 적용되는 공개된 수정 버전이 아직 없습니다.",
  clears: (count) => `${count}건 해결`,
  copy: "복사",
  copied: "복사됨",
  selected: "선택됨 — ctrl-C를 누르세요",
  workspaceCaveat:
    "워크스페이스 루트입니다. 취약 범위를 선언한 패키지에 버전이 들어가도록 -w <workspace>를 붙이세요. hoisting 때문에 어느 워크스페이스인지는 스캐너가 알려주지 못합니다.",

  transitive: (findings, packages) =>
    `${findings}건(${packages}개 패키지)은 수정 버전이 있지만 다른 의존성을 통해 들어옵니다.`,
  transitiveHow: "강제하려면 이렇게 합니다:",
  transitiveRisk: "상위 패키지가 고정한 버전을 덮어쓰므로 그쪽이 깨질 수 있습니다.",

  ledger: "전체 판정 내역",
  ledgerHow:
    "심각한 것부터. 행을 펼치면 그 점수가 어떻게 나왔는지, 어떤 식별자들이 합쳐진 것인지, 무엇과 중복일 수 있는지 나옵니다.",
  colSeverity: "심각도",
  colPackage: "패키지",
  colAdvisory: "권고",
  colFixedIn: "수정 버전",
  colScore: "점수",
  colSources: "보고한 소스",
  noFix: "없음",
  direct: "직접",
  indirect: "간접",
  whyThisScore: "이 점수의 근거",
  range: "영향 범위",
  alsoKnownAs: "다른 식별자",
  maybeDuplicate: "중복 가능성",
  disagreedFix: (versions, chosen) =>
    `소스마다 다른 수정 버전을 말했습니다(${versions}). ${chosen}이 전부를 충족합니다.`,

  accepted: "이미 수용한 것",
  acceptedBody: (count) => `${count}건이 baseline에 기록되어 위 목록에서 의도적으로 빠졌습니다.`,
  resolved: "더 이상 보고되지 않음",
  resolvedBody: (count) =>
    `수용했던 ${count}건이 이번 실행에서 나오지 않았습니다. --update-baseline로 다시 기록하면 목록에서 빠집니다.`,
  resolvedDoubt: (sources) =>
    `baseline을 기록할 때 기여했던 ${sources}이(가) 이번엔 실행되지 않았습니다. 그중 일부는 고쳐진 게 아니라 아무도 찾아보지 않은 것일 수 있습니다.`,

  nothingOutstanding: "새로 고칠 것이 없습니다.",
  nothingScanned:
    "아무것도 스캔하지 못했으므로 통과가 아닙니다. 각 소스가 왜 멈췄는지는 위 메모에 있습니다.",

  history: "기록된 실행",
  historyOutstanding: "미해결",
  historyAppeared: "새로 나타남",
  historyGone: "더 이상 보고되지 않음",
  historyOlder: (hidden, total) =>
    `기록된 ${total}회 중 최근 12회입니다. 나머지 ${hidden}회는 .zero-shelter/history.jsonl에 있습니다.`,
  historyNote:
    "--record로 요청한 실행만 기록됩니다. 항목이 이 목록에서 빠지는 경우는 셋입니다 — 고쳤거나, baseline에 수용했거나, 그걸 찾아낸 스캐너가 이번엔 돌지 않았거나.",

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
