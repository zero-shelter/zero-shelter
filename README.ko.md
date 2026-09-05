# zero-shelter

[English](./README.md) · [한국어](./README.ko.md)

의존성 스캐너의 출력을 **지금 고칠 것 몇 개**로 줄여 주는 도구입니다. 나머지는
더 이상 말하지 않습니다.

로컬에서 돕니다. 실행 중 LLM 없음, 자체 네트워크 호출 없음, 텔레메트리 없음.

> **상태: 초기.** [`zero-shelter`](https://www.npmjs.com/package/zero-shelter)
> 프리뷰가 나가 있습니다. 파이프라인은 처음부터 끝까지 동작하고 CI가
> Linux·macOS·Windows에서 이를 검증합니다. 패키징된 tarball을 설치해 돌려보는 것과
> 이 저장소 자신에게 도구를 돌리는 것까지 포함해서요. 0.1.0 전까지 인터페이스는
> 바뀔 수 있습니다.

## 문제

실제 프로젝트에 스캐너를 돌리면 경고가 수백 개 나옵니다. 오늘 손댈 가치가 있는
건 다섯 개쯤입니다. 그 다섯 개를 찾는 데 드는 주의력이 고치는 것보다 커서, 얼마
지나면 아무도 리포트를 열지 않습니다.

찾아 주는 도구는 부족하지 않습니다. 없는 건 **그중 무엇이 지금 중요한지 정하는
부분**입니다.

## 무엇을 하는가

```console
$ npx zero-shelter judge
  osv-scanner skipped: not on PATH (optional — install it for cross-source deduplication)

fix these 5 now

  critical  minimist   GHSA-XVCH-5GV4-984H  → —  125
  critical  lodash     GHSA-JF85-CPCP-J695  → —  125
  high      minimatch  GHSA-3PPC-4F35-3M26  → —  100
  high      minimatch  GHSA-7R86-CG39-JMMJ  → —  100
  high      lodash     GHSA-35JH-R3H4-6JHM  → —   95

  npm i minimist@1.2.8   clears 2

  13 reported → 13 after merge → 5 to fix  (62% less noise)
  first run — record these as accepted with --update-baseline, then only new findings are reported
```

이미 있는 것들을 기록해 두면, 그다음부터는 **새로 생긴 것만** 듣게 됩니다.

```console
$ npx zero-shelter judge --update-baseline
recorded 13 finding(s) as accepted in .zero-shelter/baseline.json

$ npx zero-shelter judge
✓ nothing new to fix
  13 reported → 13 after merge → 0 to fix (100% less noise), 13 already accepted
```

새 항목이 있으면 종료 코드가 `1`입니다. CI가 물려받은 백로그가 아니라 **이번
변경이 들여온 회귀**에서 실패합니다.

고치면 고쳤다고 말해 줍니다.

```console
$ npm i minimist@1.2.8
$ npx zero-shelter judge
✓ nothing new to fix
  7 reported → 7 after merge → 0 to fix (100% less noise), 7 already accepted
  ✓ 2 accepted finding(s) no longer reported — re-record with --update-baseline to drop them
```

"고쳐졌다"가 아니라 **"더 이상 보고되지 않는다"**입니다. 그걸 찾아낸 스캐너가 이번에
안 돌았을 때도 항목은 사라지니까요. baseline에 어떤 스캐너가 기여했는지 기록해 둡니다.
그중 하나가 이번에 안 돌았으면 어느 것인지 말해 줍니다. 전부 다시 돌았으면 없는
의심을 지어내지 않습니다.

## 설치

두 개를 설치합니다. 두 번째는 선택이 아닙니다.

```console
$ npm i -g zero-shelter          # 또는 npx zero-shelter judge
$ brew install osv-scanner       # 또는 google/osv-scanner 릴리스
```

`npm audit`은 항상 돕니다. lockfile이 있는 프로젝트엔 npm이 이미 있으니까요. 그런데
그건 소스 하나입니다. **이 도구가 하는 일이 소스를 맞추는 것이라, 소스가 하나면
맞출 것이 없습니다** — 순위와 baseline은 그대로 얻지만 건수는 들어간 그대로 나옵니다.

차이가 미묘하지 않습니다. uptime-kuma 실측:

```console
npm audit 단독       71건 보고 → 71건 조치   (0% 감소)
osv-scanner 추가    142건 보고 → 71건 조치  (50% 감소)
```

두 숫자 다 사실입니다. 두 번째 스캐너가 새 문제 71개를 찾은 게 아니라, 같은 것을
첫 번째가 쓰지 않은 식별자로 다시 말한 것이고 그걸 맞추는 게 이 도구의 일입니다.

`osv-scanner` 없이 돌려도 동작하고, 그 사실을 말합니다. 다만 도구의 작은 쪽 절반입니다.

pnpm 프로젝트도 그대로 됩니다. `pnpm-lock.yaml`이 있으면 `pnpm audit`을 대신
실행합니다. npm 6의 옛 리포트 형태도 읽습니다.

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

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "npx zero-shelter hook" }] }
    ]
  }
}
```

프롬프트를 막지 않고 실패하지도 않습니다. 어떤 오류에서도 조용히 exit 0입니다.
요청하지도 않은 보안 리포트로 남의 작업 세션을 끊느니 차라리 아무 말도 안 하는
게 낫습니다. [docs/AGENT-HOOK.md](./docs/AGENT-HOOK.md)를 보세요.

## 여기서 무슨 일이 있었나

```console
$ npx zero-shelter judge --record     # .zero-shelter/history.jsonl에 한 줄 덧붙임
$ npx zero-shelter history
  2026-08-20T09:14:02.118Z    9 outstanding  +9
  2026-08-21T11:02:55.700Z    7 outstanding  -2
  2026-08-22T08:31:10.042Z   10 outstanding  +3
```

요청한 실행만 기록합니다. 파일은 JSONL이라 `tail`로 읽히고 PR에서 diff가 됩니다.
담기는 건 **지문**입니다. 개수만으로는 "2건 고치고 2건 생김"과 "아무 일도
없음"을 구분할 수 없기 때문입니다.

이 도구는 **"고쳐졌다"가 아니라 "더 이상 보고되지 않음"**이라고 말합니다. baseline에
수용됐을 때도, 그걸 찾아낸 스캐너가 안 돌았을 때도 목록에서 빠지니까요.

## 사람이 보는 리포트

```console
$ npx zero-shelter judge --format html --output report.html
```

브라우저로 여는 파일 하나입니다. 맨 위에 실행할 명령과 각 명령이 해결하는 건수.
그 아래로 코딩 에이전트에 붙여 넣을 프롬프트, 각 항목이 그 자리에 온 점수, 수용했거나
더 이상 보고되지 않는 것까지. 명령과 프롬프트에는 복사 버튼이 붙고, 처음 보는 사람을
위해 각 숫자의 뜻을 접힌 설명으로 달아 뒀습니다. 네트워크도 빌드도 필요 없습니다.
같은 판정은 바이트 단위로 같은 페이지를 만들어서 두 리포트를 diff로 비교할 수 있습니다.
`--lang ko`로 한국어, 날짜가 필요하면 `--stamp "..."`.

## Claude Code 플러그인으로

```
/plugin marketplace add zero-shelter/zero-shelter
/plugin install zero-shelter@zero-shelter
```

스킬 다섯 개입니다. `/zero-shelter:setup`은 첫 스캔, `/zero-shelter:explain`은 결과
해석, `/zero-shelter:fix`는 업그레이드를 적용하고 **재판정으로 확인**까지 합니다.
`/zero-shelter:baseline`은 무엇을 수용할지 판단하고 수용 목록을 정직하게 유지합니다.
`/zero-shelter:ci`는 파이프라인에 게이트를 붙입니다. baseline을 먼저 잡아서, 물려받은
백로그가 아니라 이번 변경이 들여온 것에서 빌드가 실패하도록.

둘 다 **표현만** 합니다. 스킬에게 findings를 재정렬·필터링·추가하지 말라고 지시해
두었습니다. 심각도를 직접 추론하는 대신 `--explain` 출력을 인용하라고도 했습니다.
판정은 CLI에 남아 있어야 같은 입력에 같은 답이 나오고 검증이 가능합니다.
화면에 오는 길에 모델이 순서를 바꾸면 그 성질이 사라집니다.

## 옵션

```
--input <file>        스캐너를 돌리는 대신 저장된 출력을 읽음 (반복 가능)
--format <fmt>        text (기본) | json | sarif | html
--lang <code>         HTML 리포트 언어: en (기본) | ko
--stamp <text>        HTML footer에 넣을 선택 문구
--json                --format json shorthand
--output <file>       stdout 대신 파일로 씀
--explain             각 점수가 어떻게 나왔는지 보여줌
--top <n>             최대 n줄만 출력 (수치와 조치 안내는 프로젝트 전체 기준 유지)
--record              이 실행을 .zero-shelter/history.jsonl에 추가
--update-baseline     현재 항목들을 수용으로 기록
--baseline <file>     baseline 위치 (기본 .zero-shelter/baseline.json)
--cwd <dir>           프로젝트 디렉터리
--no-color            text output의 ANSI 색상을 끔
--version             설치된 package version 출력
--help                도움말 출력
```

`--no-color`는 사람이 읽는 text output에만 적용되고 `FORCE_COLOR`보다 우선합니다.
기존 `NO_COLOR` 환경변수도 계속 지원합니다.

`zero-shelter version`도 같은 version을 출력하는 명령입니다.

`zero-shelter history [--json] [--last <n>]`은 실행 사이에 나타나거나 사라진
Finding을 보여줍니다. `judge --record`를 요청한 경우에만 기록됩니다.

`--explain`은 부여된 점수와 그 근거가 된 가중치 표를 전부 출력합니다. 랭킹을
**믿는 대신 따질 수 있게** 하려는 것입니다.

## 예상과 다른 말이 나올 때

| 이렇게 나오면 | 무슨 일인가 |
|---|---|
| `cannot judge …: no scanner produced a report` | 아무것도 스캔하지 못했고 통과인 척하지 않고 exit 2로 끝냅니다. 보통 lockfile이 없는 경우: `npm i --package-lock-only` |
| `yarn.lock found and nothing could read it` | yarn v1은 NDJSON으로 쓰는데 우리가 파싱하지 않습니다. `osv-scanner`가 `yarn.lock`을 직접 읽으므로 그게 최단 경로입니다 |
| `zero-shelter needs Node 20 or later` | 그 자체가 문제이고 우회하는 플래그는 없습니다 |
| `osv-scanner skipped: not on PATH` | 선택 사항이고 실행은 정상입니다. 다만 중복 제거의 대부분이 거기서 나옵니다 |
| `… is SARIF, which is what this tool writes rather than reads` | `--input`은 스캐너 리포트를 받습니다. 우리 출력은 받지 않습니다 |
| baseline에 대한 `… is not valid JSON` | `--update-baseline`을 중간에 끊으면 파일이 잘린 채 남습니다. 지우고 다시 기록하세요 |
| `first run — record these as accepted` | baseline이 아직 없어서 백로그 전체를 보고 중입니다. `--update-baseline`이 그걸 위한 것입니다 |

## 바뀌지 않는 설계 원칙

이건 안 바뀝니다. 하나라도 깨는 패치는 그 이유만으로 반려됩니다.

| 원칙 | 이유 |
|---|---|
| 실행 중 LLM 없음 | 같은 입력은 모든 기계에서 같은 출력이어야 합니다. 그리고 당신의 코드는 당신의 기계에 남습니다. |
| 자체 네트워크 호출 없음 | 결과는 오프라인에서 재현 가능해야 합니다. 우리가 실행하는 스캐너는 그쪽 사정이고 우리가 하는 것보다 크게 말하지 않고 그대로 적습니다. |
| 점수 계산은 정수만 | 부동소수점은 플랫폼마다 반올림이 다릅니다. 호스트에 따라 랭킹이 흔들리면 우리가 공개하는 모든 수치가 그걸 만든 기계에서만 참이 됩니다. |
| 시크릿은 파싱 시점에 해시, 원본은 폐기 | 시크릿 스캔이 생기면 적용됩니다. v1에는 없고, 필요한 해시는 `src/fingerprint.ts`에 이미 있습니다. 찾은 것을 흘리는 보안 도구는 존재할 이유가 없습니다. |
| 지문 대상은 전부 `src/normalize.ts`를 지남 | 정규화 경로가 둘이면 한 항목에 정체성이 둘이 됩니다. |

CI가 Ubuntu·macOS·Windows에서 테스트를 돌리며 고정된 해시값을 확인합니다. 호스트에
따라 달라지는 지문은 우리 수치를 조용히 기계 종속으로 만드는 대신 빌드를 깨뜨립니다.

## 병합을 멈추는 지점

두 스캐너가 같은 취약점이라고 합의하는 건 식별자를 공유할 때뿐입니다. `npm audit`은
어떤 advisory는 GitHub에, 다른 건 NVD에 연결해서 같은 취약점인데도 별칭 집합이
겹치지 않을 수 있습니다.

우리는 식별자를 공유하는 것만 잇습니다. 나머지는 추측하지 않고 표시만 합니다.
중복을 보여주는 것과 취약점을 숨기는 것 사이에서, 중복이 더 싼 실수입니다.

이건 v1의 답일 뿐입니다.
[Discussion #25](https://github.com/zero-shelter/zero-shelter/discussions/25)에
트레이드오프를 열어 두었고 더 나은 아이디어를 환영합니다.

## 우리가 측정한 것을 정직하게 말하면

커밋으로 고정한 외부 프로젝트 4곳, 스캐너 출력은 `bench/captures/`에 동결해서
누구든 오프라인으로 표를 재현할 수 있습니다.

| 저장소 | 원시 보고 | 판정 후 | 감소 |
|---|---|---|---|
| juice-shop | 155 | 82 | 47% |
| NodeGoat | 360 | 173 | 52% |
| dvna | 106 | 51 | 52% |
| hackathon-starter | 24 | 11 | 54% |

`npm run build && node bench/evaluate.mjs`로 재현됩니다. 네트워크도, 스캐너도
필요 없습니다.

**이건 부피이지 정밀도가 아닙니다.** 두 소스가 같은 advisory를 절반쯤 겹쳐 말하고
라벨이 생기기 전까지 정직하게 말할 수 있는 건 *적게 보여준다*까지입니다. *맞게 보여준다*는 아닙니다.

라벨링은 두 사람이 서로의 답을 보지 않고 독립적으로 하며 일치도를 함께 공개합니다.
모델이 하지 않습니다. 자기 도구가 동작한다는 걸 자기가 만든 정답으로 증명하는 건
순환이고 남이 그렇게 했다면 우리도 안 믿을 겁니다. 프로토콜과 우리가 아는 한계는
[bench/README.md](./bench/README.md)에 있습니다. 랭킹 코드가 라벨보다 먼저
존재한다는 것도 거기 적혀 있습니다.

## 문서

- [아키텍처](./docs/architecture.md) — 레이어, 시퀀스 다이어그램, 어디에 추가하나
- [v1 범위](./docs/v1-scope.md) — 무엇이 들어가고 무엇이 미뤄졌으며 왜인가
- [AGENTS.md](./AGENTS.md) — 이 도구를 쓰는 저장소에서 에이전트가 알아야 할 것
- [에이전트 훅](./docs/AGENT-HOOK.md) — 설정과, 의도적으로 하지 않는 것
- [벤치마크](./bench/README.md) — 고정 대상, 동결 캡처, 라벨링 프로토콜
- [서드파티 구성요소](./THIRD_PARTY.ko.md)
- [기여 가이드](./CONTRIBUTING.ko.md) — 기여 흐름·명세·QA·PR 규칙
- [Governance](./GOVERNANCE.ko.md) — Owner/Maintainer 결정과 release 경계
- [보안·개인정보](./SECURITY.ko.md) — 신고와 보안 제어 기여 기준

영어가 정본입니다. 번역이 뒤처져 있다면 그건 신고할 만한 버그입니다.

## 우리에게 먼저 씁니다

CI가 이 저장소에 `zero-shelter judge`를 돌리고 항목이 하나라도 나오면 빌드를
실패시킵니다. 그 잡을 처음 붙인 날 6건이 나왔고 그중 하나는 테스트 러너의
critical이었습니다. 해법은 도구가 출력한 그 줄이었습니다 — `npm i vitest@4.1.11`.
한 번의 업그레이드로 6건이 전부 사라졌습니다.

여기엔 baseline을 기록해 두지 않았습니다. 우리 빌드를 계속 통과시키려고 우리
도구를 침묵시킬 수는 없습니다. 이 프로젝트는 바로 그 행동에 반대하려고 존재합니다.

## 개발

```bash
npm ci
npm test
npm run typecheck
npm run third-party   # THIRD_PARTY.md·THIRD_PARTY.ko.md 재생성
npm run qa            # 패키징해서 임시 프로젝트에 설치한 뒤 설치 경험 점검
npm run qa:agent      # hook·skill·HTML prompt·plugin manifest 점검
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

## 라이선스

[Apache-2.0](./LICENSE)
