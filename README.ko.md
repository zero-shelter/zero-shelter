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

깨끗한 실행에서는 프로젝트에 실제로 있는 artifact만 사용해 의존성 판정의 경계도
알립니다. 그 영역을 스캔하거나 깨끗하다고 판정하지 않습니다. 예를 들어 secret은
항상 이 도구 밖에 있고, Dockerfile·workflow·infrastructure는 해당 파일이 있을 때만
언급합니다.
선택적인 범위 확인을 끝내지 못하면 JSON의 `unscanned.complete`가 `false`가 되고
사람용 문장에도 표시합니다. 이때 `false`나 `0`은 artifact가 없다는 증거가 아닙니다.

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

pnpm 프로젝트도 그대로 됩니다. `pnpm-lock.yaml`이 있으면 `pnpm audit`을 대신
실행합니다. npm 6의 옛 리포트 형태도 읽습니다. 이 형식은 수정 버전을 하나가
아니라 범위로 담습니다. 안정 버전이 포함되는 하한으로 단독 표기된 경우에만 그
버전을 패키지 매니저 명령까지 전달합니다. 배타적·프리릴리스·복합 범위는 안전하게
선택할 수 있을 때까지 명령을 만들지 않고, `<0.0.0>`은 계속 "공개된 수정 버전
없음"으로 처리합니다.

yarn은 `osv-scanner` 없이는 두 번째 소스도 첫 번째 소스도 없습니다 — `npm audit`이
`yarn.lock`을 못 읽고, yarn v1은 NDJSON이라 이 도구가 파싱하지 않습니다.
`osv-scanner`가 `yarn.lock`을 직접 읽으니, yarn에서는 그것이 유일한 소스입니다.

## CI에서

```yaml
- run: npx zero-shelter judge --format sarif --output zero-shelter.sarif
  continue-on-error: true

- uses: github/codeql-action/upload-sarif@6f5948dfacef28e207b48d0905cf90c03365536d # v3.37.9
  with:
    sarif_file: zero-shelter.sarif
```

결과가 Security 탭에 올라가고 PR에 주석으로 붙습니다. 각 알림에는 **무엇을 해야
하는지**가 같이 적힙니다. 직접 의존성이면 `npm i lodash@4.18.1`, 간접 의존성이면 그걸
강제하는 `overrides` 항목입니다. 지문이 기기와 실행에 걸쳐 안정적이라, GitHub이 이미
본 알림을 매 빌드마다 다시 여는 대신 알아봅니다.

advisory가 CVSS vector를 제공하면 각 SARIF 결과는 그 값을
`properties.cvssVector`에 그대로 보존합니다. scanner 출력에는 vector만 있고 숫자
score는 없으므로 GitHub의 숫자형 `security-severity`는 대략적인 severity band
fallback으로 유지합니다. zero-shelter가 부동소수점 연산으로 score를 만들지는 않습니다.
SARIF에는 이 파일을 쓴 zero-shelter 패키지 버전도 표시하고, scanner가 제공한 경우
scanner 버전도 보존합니다.

advisory source가 심각도 구간을 표시하지 않는 경우도 있습니다. 이때 zero-shelter는
호환성을 위해 `info` 값을 유지하고 JSON에 `severityKnown: false`를 추가하며, 사람이
보는 터미널에는 `unknown`, HTML에는 "소스가 심각도를 표시하지 않음"이라고 씁니다.
이 항목에는 심각도 구간 점수를 주지 않습니다. SARIF에서도 숫자형
`security_severity` fallback을 만들지 않습니다.

여기엔 짚어 둘 만한 아이러니가 있습니다. 이 프로젝트는 서로 다른 도구의 SARIF를
그걸 받는 도구들이 맞대지 못하기 때문에 존재합니다. 그런 우리가 SARIF를 내보내는
건 모순이 아닙니다. 받는 쪽이 가져가는 것은 맞대는 데 실패할 원시 실행 네 개가 아니라
**이미 판정이 끝난 하나**입니다.


`0.0.x` 도구에 빌드를 걸기 전에 [`docs/STABILITY.md`](./docs/STABILITY.md)를
보세요. 어떤 표면이 얼어 있고 무엇이 패치 릴리스에서 바뀔 수 있는지 적혀 있습니다.
버전 숫자는 기능이 움직인다는 뜻이지 exit code가 움직인다는 뜻이 아닙니다.

## 코딩 에이전트에서

코딩 에이전트는 매 세션을 이 프로젝트가 뭐가 깨져 있는지 모르는 채로 시작합니다.
그래서 이미 미해결 advisory가 있는 의존성을 아무렇지 않게 추가합니다.
`zero-shelter hook`은 사람이 받는 그 짧은 목록을 에이전트에게 넘깁니다.
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
`security_severity`에는 직접 계산한 CVSS 점수 대신 심각도 구간별 값을 사용합니다.
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

`zero-shelter why <package>`는 로컬 npm lockfile을 읽어 직접 의존성에서 해당
패키지의 설치된 각 사본까지 이어지는 모든 경로를 보여줍니다. 스캐너 출력이
있으면 고정 버전 정보도 함께 표시합니다. 오프라인에서 반복 가능한 결과가
필요하면 `--input`을 한 번 이상 넘기고, 생략하면 `judge`와 같은 기존
스캐너를 수집하며 기존 scanner subprocess/network 경계를 그대로 따릅니다.
패키지를 설치하거나 별도의 registry 조회를 추가하지 않으며, lockfile로
확인할 수 있는 버전만 출력합니다.

`--explain`은 부여된 점수와 그 근거가 된 가중치 표를 전부 출력합니다. 랭킹을
**믿는 대신 따질 수 있게** 하려는 것입니다.

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

Node 20 이상.

## 기여

기여를 환영합니다. 설계에 대한 반대도 포함해서요.

리뷰 규칙 하나는 미리 밝혀 둘 만큼 특이합니다.

> 리뷰어는 이 변경을 깨뜨릴 입력을 댈 수 있어야 합니다. 대지 못하면 승인하지 않습니다.

코멘트를 몇 개 달았는지는 세지 않습니다. 에이전트는 3분에 400줄을 쓸 수 있고 사람은
거기 맞추려고 400줄을 3분에 승인합니다. 그 지점에서 코드와 테스트가 같은 오해를
공유하게 되고 아무도 알아채지 못합니다.

[CONTRIBUTING.md](./CONTRIBUTING.md)를 보세요.

기능 명세와 QA 근거는 [명세 템플릿](./docs/feature-spec-template.ko.md)과
[QA 체크리스트](./docs/qa-checklist.ko.md)를 사용합니다. 저장소에는 기능·버그·보안 제어
기여를 위한 GitHub Issue와 PR 템플릿도 있습니다.


시작할 곳을 찾는다면 [`good first issue`](https://github.com/zero-shelter/zero-shelter/labels/good%20first%20issue)를
보세요. 파일과 줄을 지목하고, 결함을 재현하는 명령을 담고, 타이핑이 아니라 판단이
필요한 부분이 어디인지 적어 둡니다.

써 보고 쓸모가 있었다면 star가 다른 사람이 찾는 데 도움이 됩니다. 쓸모가 없었다면
왜 그런지 적은 이슈가 더 값어치 있습니다.

[![Star history](https://api.star-history.com/svg?repos=zero-shelter/zero-shelter&type=Date)](https://star-history.com/#zero-shelter/zero-shelter&Date)

리포트에는 소스별 기여도도 표시됩니다. 한 스캐너만 보고한 finding은 심각도별
건수와 함께, 여러 소스가 보고한 finding은 별도로 셉니다. 이는 실행 결과에
대한 사실이며 점수나 스캐너 추천이 아닙니다.

## 라이선스

[Apache-2.0](./LICENSE)
