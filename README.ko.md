# zero-shelter

정본: [English](./README.md) · [한국어](./README.ko.md)

zero-shelter는 의존성 취약점 보고서를 읽고, 공통 권고 식별자가 있는 항목을 병합한 뒤
지원되는 업그레이드 명령을 우선순위에 따라 보여줍니다. 수용한 항목을 baseline에
기록하면 이후 실행과 비교할 수 있습니다. 결과를 직접 보고 조치하거나, 같은 명령과
근거를 코딩 에이전트에 전달할 수 있습니다.

[npm 패키지](https://www.npmjs.com/package/zero-shelter)는 프리뷰 버전입니다.
종료 코드나 출력 형식에 의존하기 전에 [호환성 계약](./docs/STABILITY.md)을
확인하세요. [제품 설명](./PRODUCT.ko.md) · [로드맵](./docs/ROADMAP.ko.md)

## 첫 실행

Node.js 20 이상과 지원하는 프로젝트 lockfile이 필요합니다.

```bash
npx zero-shelter judge
```

보고서에는 검토할 항목과 순위의 근거가 되는 점수, 제공 가능한 직접 의존성
업그레이드 명령, 간접 의존성 조치 안내가 나옵니다. 입력에 수정 버전이 없는
항목도 검토 목록에 남을 수 있습니다.

다음 예시는 이 저장소를 체크아웃한 뒤 재현할 수 있습니다.

```bash
npm ci
npm run build
node dist/bin.js judge --input test/fixtures/npm-audit.json --json
```

JSON 출력의 `summary`는 다음과 같으며 종료 코드는 `1`입니다.
체크아웃한 프로젝트의 의존성을 검사한 결과가 아니라 테스트 데이터입니다.

```json
{
  "raw": 4,
  "merged": 4,
  "fixNow": 4,
  "shown": 4,
  "accepted": 0,
  "noLongerReported": 0
}
```

| 종료 코드 | 의미 |
|---|---|
| `0` | 판정을 완료했고 새 항목이 없습니다. 수용한 항목은 남아 있을 수 있습니다. |
| `1` | 새 항목을 검토해야 합니다. |
| `2` | 판정하지 못했습니다. 오류를 확인하고 통과로 처리하지 마세요. |

## 설치

`npx`로 실행하거나 `npm i -g zero-shelter`로 CLI를 설치합니다.
lockfile에 따라 패키지 매니저와 직접 실행할 스캐너를 선택합니다.

| Lockfile | 내장 audit 실행 | OSV-Scanner |
|---|---|---|
| `package-lock.json` | `npm audit` | 선택적으로 추가 |
| `pnpm-lock.yaml` | `pnpm audit` | 선택적으로 추가 |
| `yarn.lock` | 이 도구에서 수집하지 않음 | 직접 검사할 때 필요 |

OSV-Scanner는 `brew install osv-scanner` 또는
[공식 릴리스](https://github.com/google/osv-scanner/releases)의 바이너리로 설치할 수
있습니다. 설치 후 보고서에서 실제로 실행한 소스와 건너뛴 소스를 확인하세요.
지원되는 소스 하나로도 순위, baseline 비교, 조치 안내를 제공합니다.
여러 소스는 추가 항목이나 수정 버전을 제공할 수 있으며 식별자가 겹치는 항목을
병합할 수 있게 합니다.

`--input`은 스캐너를 실행하지 않고 저장된 npm/pnpm audit 또는 OSV JSON을 읽습니다.
SARIF와 yarn v1의 NDJSON은 읽지 않습니다. 오래된 npm audit 보고서가 수정 범위를
제공하면, 그 범위에 포함되는 안정 버전의 하한을 업그레이드 대상으로 쓸 수 있습니다.
하한을 제외하는 범위, 시험판, 복합 범위처럼 안전한 대상을 선택할 수 없는 경우에는
명령을 만들지 않습니다. `<0.0.0>`은 발표된 수정 버전이 없다는 뜻입니다.

판정은 로컬에서 이루어집니다. 실행 중 LLM을 호출하거나 사용 정보를 수집하지 않으며,
도구 자체의 네트워크 요청도 없습니다. 호출한 스캐너는 네트워크와 저장소 설정을
사용할 수 있습니다. 로컬 실행은 샌드박스가 아닙니다.
[보안과 개인정보 보호](./SECURITY.ko.md)를 참고하세요.

## 결과 사용

### 직접 조치하기

터미널 보고서를 읽거나 HTML 파일로 저장합니다.

```bash
npx zero-shelter judge --format html --output report.html
npx zero-shelter judge --format html --lang ko --output report.ko.html
```

브라우저에서 파일을 열면 명령, 복사할 수 있는 에이전트 프롬프트, 발견 항목과 점수,
baseline 비교, 용어 설명을 볼 수 있습니다. 서버 없이 오프라인에서 열 수 있습니다.
`--stamp "..."`로 하단에 문구를 추가할 수 있습니다.

직접 의존성은 보고서가 생성한 명령을 사용합니다. 간접 의존성에는 패키지 매니저의
override 또는 resolution 설정이 필요합니다. 버전을 강제하면 이전 버전을 요구한
상위 패키지가 깨질 수 있으므로 적용 전에 검토하세요. pnpm과 yarn에서는 확인할 수
없는 조치 예상 건수를 표시하지 않습니다. Workspace에서는 명령에 대상을 지정해야
할 수 있습니다.

업그레이드 후 `zero-shelter judge`와 프로젝트의 테스트·빌드를 다시 실행합니다.
발견 항목뿐 아니라 어떤 스캐너가 결과를 제공했는지도 비교하세요.

### 코딩 에이전트와 사용하기

HTML 보고서의 프롬프트는 같은 조치 안내를 바탕으로 만듭니다.
Claude Code 플러그인은 다음 작업도 지원합니다.

```
/plugin marketplace add zero-shelter/zero-shelter
/plugin install zero-shelter@zero-shelter
```

| 스킬 | 용도 |
|---|---|
| `/zero-shelter:setup` | 첫 검사와 스캐너 범위 확인 |
| `/zero-shelter:explain` | 발견 항목과 출력된 순위 해석 |
| `/zero-shelter:fix` | 합의한 업그레이드 적용과 재검사 |
| `/zero-shelter:baseline` | 수용 결정과 baseline 관리 검토 |
| `/zero-shelter:ci` | CI 검사와 보고서 업로드 설정 |

에이전트는 생성된 명령과 순위를 사용하고, 중복 의심 항목을 미결 상태로 유지해야
합니다. 항목 수용과 간접 의존성 버전 강제는 사용자가 결정합니다.
플러그인 설치가 이런 위험 판단까지 승인하는 것은 아닙니다.

매 프롬프트에 검사 결과를 전달하려면 `.claude/settings.json`에
`zero-shelter hook`을 설정합니다.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "npx zero-shelter hook" }] }
    ]
  }
}
```

Hook은 의존성 정보를 에이전트에 전달하며 프롬프트를 차단하지 않습니다.
오류가 나면 정보를 출력하지 않고 `0`으로 종료합니다.
설정과 실패 동작은 [hook 안내](./docs/AGENT-HOOK.md)를 참고하세요.

### CI에서 사용하기

```bash
npx zero-shelter judge
```

스크립트 단계에서 위 종료 코드를 사용할 수 있습니다. GitHub Security에 결과를
올리려면 [전체 GitHub Actions 예제](./examples/github-action.yml)를 사용하세요.
발견 항목이 있어도 SARIF를 업로드한 뒤 판정의 실패 결과를 작업 결과에 반영합니다.
`security-events: write` 권한이 필요합니다.

SARIF는 안정적인 지문을 사용합니다. 권고에 `cvssVector`가 있으면 그대로 보존하고,
`security-severity`에는 직접 계산한 CVSS 점수 대신 심각도 구간별 값을 사용합니다.
패키지 버전과 제공되는 스캐너 버전도 포함합니다.

## Baseline과 실행 이력

Baseline은 프로젝트 담당자가 검토하고 수용한 항목을 기록합니다. 선택 사항이며,
없으면 현재 발견 항목을 모두 검토 대상으로 표시합니다.

목록을 검토하고 수용하기로 결정한 뒤에만 실행합니다.

```bash
npx zero-shelter judge --update-baseline
```

현재 항목을 `.zero-shelter/baseline.json`에 기록하며 취약점을 해결하지는 않습니다.
CI에서 사용하려면 baseline을 커밋합니다. 각 항목에 사유, 담당자, 만료일을 적을 수
있습니다. 다시 기록하면 새 검토 항목도 수용되므로 자동 실행하거나 보고서를
비우려는 목적으로 사용하지 마세요.
[알려진 baseline 한계](./PRODUCT.ko.md#현재-기능)도 확인하세요.

이후 실행은 그 결정과 비교합니다. ‘더 이상 보고되지 않음’은 조치 결과일 수도,
해당 스캐너가 실행되지 않은 결과일 수도 있습니다. Baseline에 기여한 소스가 빠지면
터미널과 JSON의 `missingSources`에 표시합니다.
종료 코드 `0`이 프로젝트에 취약점이 없음을 증명하지는 않습니다.

실행 이력은 요청할 때만 기록합니다.

```bash
npx zero-shelter judge --record
npx zero-shelter history
npx zero-shelter history --json --last 10
```

`.zero-shelter/history.jsonl`에 실행마다 건수와 지문을 추가합니다.
이력은 새로 생기거나 사라진 검토 항목을 구분합니다. 수용되거나 소스가 빠져서
목록에서 사라질 수도 있습니다. `accepted`는 해당 실행에서 일치한 baseline 항목
수이며 저장된 전체 건수가 아닙니다. 실행 기록이 충분하면 HTML에도 이력이 나옵니다.

## 한계와 측정

현재는 의존성 항목을 다룹니다. 모든 소스 코드, 비밀 값, 인프라, 워크플로를 검사하거나
프로젝트에서 취약한 코드 경로가 실행되는지 판단하지 않습니다.

권고 식별자가 겹치는 항목만 병합합니다. `possibleDuplicates`는 중복 의심 상태로
각각 남깁니다. 병합 기준의 장단점은
[Discussion #25](https://github.com/zero-shelter/zero-shelter/discussions/25)에서 다룹니다.

벤치마크는 커밋을 고정한 외부 프로젝트 4개의 저장된 스캐너 출력을 사용합니다.

| 프로젝트 | 원본 보고 건수 | 병합 후 | 감소율 |
|---|---:|---:|---:|
| juice-shop | 155 | 82 | 47% |
| NodeGoat | 360 | 173 | 52% |
| dvna | 106 | 51 | 52% |
| hackathon-starter | 24 | 11 | 54% |

`npm run build && node bench/evaluate.mjs`로 오프라인에서 재현할 수 있습니다.
이 수치는 해당 입력의 보고 건수 변화를 측정합니다. 순위 정확도, 보안 개선,
다른 프로젝트에서의 일반적인 결과를 뜻하지 않습니다. 사람이 라벨을 붙이는 평가는
계획 단계이며 정확도 결과를 주장하지 않습니다.
[벤치마크 방법과 한계](./bench/README.md)를 참고하세요.

<a id="design-invariants"></a>

순위에는 정수 가중치를, 지문 입력에는 공통 정규화 규칙을 사용합니다.
CI는 Ubuntu, macOS, Windows에서 테스트합니다. `--explain`으로 가중치를
확인할 수 있으며 공개 계약은 [안정성 보장](./docs/STABILITY.md)에 설명합니다.

## 옵션

```
--input <file>        스캐너 실행 대신 저장된 출력을 읽음 (반복 가능)
--format <fmt>        text (기본) | json | sarif | html
--lang <code>         HTML 보고서 언어: en (기본) | ko
--stamp <text>        HTML 하단에 넣을 선택 문구
--json                --format json의 축약
--output <file>       stdout 대신 파일로 씀
--explain             각 점수가 어떻게 나왔는지 보여줌
--top <n>             최대 n줄만 출력 (수치와 조치 안내는 프로젝트 전체 기준 유지)
--record              이 실행을 .zero-shelter/history.jsonl에 추가
--update-baseline     현재 항목들을 수용으로 기록
--baseline <file>     baseline 위치 (기본 .zero-shelter/baseline.json)
--cwd <dir>           프로젝트 디렉터리
--no-color            텍스트 출력의 ANSI 색상을 끔
--version             설치된 패키지 버전 출력
--help                도움말 출력
```

`--no-color`는 사람이 읽는 텍스트 출력에만 적용되고 `FORCE_COLOR`보다 우선합니다.
기존 `NO_COLOR` 환경변수도 계속 지원합니다.

`zero-shelter version`도 같은 버전을 출력하는 명령입니다.

`zero-shelter history [--json] [--last <n>]`은 실행 사이에 나타나거나 사라진
발견 항목을 보여줍니다. `judge --record`를 요청한 경우에만 기록됩니다.

`--explain`은 순위를 검토할 수 있도록 점수의 구성과 가중치를 출력합니다.

## 문제 해결

| 메시지 또는 상황 | 확인할 사항 |
|---|---|
| 어떤 스캐너도 보고서를 만들지 못함 | 지원 lockfile과 소스를 건너뛴 이유를 확인합니다. 필요하면 프로젝트의 패키지 매니저로 lockfile을 생성합니다. |
| `yarn.lock`을 읽지 못함 | 직접 검사하려면 OSV-Scanner를 설치합니다. |
| Node 버전 오류 | Node.js 20 이상을 사용합니다. |
| PATH에 OSV-Scanner가 없음 | 설치와 PATH를 확인합니다. npm/pnpm audit 결과만으로 판정할 수도 있습니다. |
| `--input`에 SARIF를 전달함 | npm/pnpm audit 또는 OSV JSON을 사용합니다. SARIF는 출력 형식입니다. |
| Baseline이 올바른 JSON이 아님 | 파일을 살펴보고 버전 관리에서 유효한 사본을 복원합니다. 검토 없이 수용 기록을 삭제하거나 새로 수용하지 마세요. |

## 문서와 기여

- [제품 설명](./PRODUCT.ko.md)과 [로드맵](./docs/ROADMAP.ko.md)
- [아키텍처](./docs/architecture.md)와 [v1 범위](./docs/v1-scope.md)
- [에이전트 지침](./AGENTS.ko.md)과 [hook 설정](./docs/AGENT-HOOK.md)
- [기여 안내](./CONTRIBUTING.ko.md), [운영 규칙](./GOVERNANCE.ko.md), [보안 정책](./SECURITY.ko.md)
- [기능 명세 양식](./docs/feature-spec-template.md), [QA 체크리스트](./docs/qa-checklist.md), [베타 QA 안내](./docs/qa/README.md)
- [서드파티 고지](./THIRD_PARTY.ko.md)

범위가 명확한 [이슈](https://github.com/zero-shelter/zero-shelter/issues)부터 시작하세요.
에이전트의 도움을 받은 변경도 기여 안내에 따른 사람의 리뷰와 검증이 필요합니다.
영문이 정본이며 번역의 차이는 문서 오류로 알려주세요.

로컬 개발 명령은 다음과 같습니다.

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run third-party   # regenerate notices when dependencies change
npm run qa            # inspect and install a packaged tarball in a temporary project
npm run qa:agent      # verify the hook, skills, HTML prompts and plugin manifest
```

## 라이선스

[Apache-2.0](./LICENSE)
