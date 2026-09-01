# 기능 명세: 확장 가능한 스캐너와 공개 가능한 보안 자세

## Issue와 lifecycle metadata

- Issue: [#125](https://github.com/zero-shelter/zero-shelter/issues/125)
- 대상 layer: ingest, judgment, package
- 관련 PR:

이 문서는 roadmap 명세다. 공유 결정과 순서를 고정하며, 각 조각은 구현 전에
`docs/specs/<issue>-<slug>.md`에 자기 명세를 따로 갖는다.

## 문제

세 가지 한계이고, 모두 현재 소스에서 확인할 수 있다.

**스캐너 집합이 소스 코드다.** `src/scan.ts`는 본문에서 `npm audit`, `pnpm audit`,
`osv-scanner`를 이름으로 부르고, 같은 함수 안의 `existsSync` 호출로 무엇을 실행할지
정한다. 네 번째 스캐너를 지원하려면 우리 파일과 우리 테스트를 고치고 우리 릴리스를
내보내야 한다. 저장소 밖의 누구도 스캐너를 추가할 수 없고, 안에 있는 사람도 빠르게는
못 한다.

**판정은 이미 생태계 중립인데 아무도 그걸 쓰지 않는다.** `finding.ts:44`의
`ecosystem`은 제약 없는 문자열이고, `ingest/osv.ts:56`은 osv-scanner가 보고하는 값을
그대로 통과시킨다. PyPI·Go·crates.io 판정이 normalize, merge, triage, baseline을
훼손 없이 지난다. 벽은 수집과 조치 양쪽 끝에 있다 — `lockfile.ts`와
`package-manager.ts`는 npm 세계만 안다 — 가운데가 아니다.

**프로젝트는 자기가 무엇을 중요하게 여기는지 말할 수 없고, 지금 어떤 상태인지도 말할
수 없다.** 어떤 형태의 설정도 없다. `grep -rn "config\|policy" src/*.ts`는 아무것도
반환하지 않는다. 모든 프로젝트가 같은 `WEIGHTS`와 같은 리포트를 받고, 읽는 사람이
터미널을 닫으면 다른 사람이 확인할 수 있는 것은 아무것도 남지 않는다.

## 목표

### 우리 허락 없이 누구나 스캐너를 추가할 수 있다

스캐너는 명령, 그 스캐너가 관련 있음을 뜻하는 파일들, 그리고 내보내는 전송 형식을
적은 JSON manifest가 된다. manifest는 두 곳에서 로드된다. 패키지에 실린 `adapters/`
디렉터리, 그리고 읽는 사람 자신의 저장소에 있는 `.zero-shelter/adapters/`. 앞쪽이
기여 경로이고, 뒤쪽은 우리 릴리스 주기를 기다리지 않아도 된다는 뜻이다.

성공의 척도는 기여의 크기다. `trivy`를 추가하는 일이 manifest 하나와 캡처한 fixture
하나와 테스트 하나여야 한다 — `src/scan.ts`를 한 번도 읽지 않은 사람이 리뷰할 수
있어야 한다.

### 문서를 읽는 대신 대화해서, 누구나 자기 프로젝트의 기준을 말할 수 있다

정책 파일은 보고할 최소 심각도, 제외할 scope, 심각도 대역별 기한을 기록한다.
agent가 setup 중에 질문하며 이 파일을 쓰고, `judge`는 읽기만 한다. 파일은 커밋되므로
pull request에서 리뷰되고 그 이력이 diff로 남는다.

이것이 "스케줄과 심각도로 관리한다"의 정직한 형태다. 심각도가 기한이 되고, 기한은
넘길 수 있으며, 넘겼다는 것은 리포트가 말할 수 있는 사실이다.

### 누구나 자기 위치를 공개할 수 있고, 누구나 그 주장을 검증할 수 있다

자세 점수 — 정수, 내보낸 테이블 하나, 모든 항목에 이름 — 는 프로젝트가 자기 Pages에서
서빙하는 뱃지 파일이 되고, 선택적으로 leaderboard 항목이 된다. 그 항목의 주장은
명시된 커밋에서 우리 CI가 다시 계산해 받아들이기 전에 검증한다.

성공은 그 숫자를 두고 논쟁할 수 있다는 것이다. 동의하지 않는 사람이 점수가 아니라
테이블의 한 줄을 가리킬 수 있어야 한다.

## 범위

### 포함

1. adapter manifest와 loader, 그리고 입력 형식으로서의 SARIF
2. 정책 파일: 최소 심각도, scope 제외, 심각도별 기한
3. 자세 점수: 정수 규칙 테이블, `--explain`, `--as-of`
4. `zero-shelter badge`: shields.io endpoint 파일
5. GitHub Pages 위의 leaderboard: pull request로 등록, 재계산으로 검증

### 명시적 제외

- **프로젝트별 weights.** `WEIGHTS`는 얼린다. 정책이 이걸 바꿀 수 있으면 두 프로젝트의
  점수는 비교 불가가 되고 조각 3·4·5가 전부 무의미해진다.
- **정책 파일의 개별 finding 제외.** 그건 baseline이 하는 일이고, baseline은 이미
  이유·담당·만료를 갖는다. 억제 수단이 둘이면 뭔가 빠졌을 때 볼 곳이 둘이 된다.
- **호스팅 서비스.** Pages는 저장소에서 빌드한 정적 파일을 서빙한다. 운영할 것도,
  보유할 계정도, 남의 데이터를 보관할 일도 없다.
- **leaderboard의 비공개 저장소.** 체크아웃할 수 없는 트리의 점수는 재계산할 수 없다.
  비공개 저장소는 뱃지를 쓴다. 뱃지는 비교 주장을 하지 않으므로 검증이 필요 없다.
- **도달 가능성.** `AGENTS.md`와 같다. 취약한 코드 경로에 실제로 도달하는지는 여기
  어느 것도 모른다.

## 인터페이스

### adapter manifest

```json
{
  "id": "trivy",
  "detect": ["package-lock.json", "go.mod", "requirements.txt"],
  "command": "trivy",
  "args": ["fs", "--format", "sarif", "--quiet", "."],
  "format": "sarif",
  "versionArgs": ["--version"],
  "install": "brew install trivy, 또는 https://github.com/aquasecurity/trivy/releases"
}
```

`format`은 `osv`, `sarif`, `npm-audit` 중 하나다. `install`은 명령이 없을 때 보여주는
문장이며, `scan.ts`가 osv-scanner에 이미 쓰는 방식을 따른다. 문제만 말하지 않고
빠져나갈 길을 알려준다.

내장 manifest가 먼저 로드되고 그다음 `.zero-shelter/adapters/`가 로드된다. 같은 `id`를
가진 사용자 manifest는 내장 것을 대체한다. 포크하지 않고 다른 플래그를 고정하는
방법이다.

### 정책 파일 — `.zero-shelter/policy.json`

```json
{
  "version": 1,
  "minimumSeverity": "moderate",
  "ignoreScopes": ["dev"],
  "deadlines": { "critical": 7, "high": 30, "moderate": 90, "low": 365 }
}
```

기한은 advisory의 `published` 날짜로부터의 일수다. `ScaFinding`이 이미 소스에서
그대로 갖고 있는 값이다. `published`가 없는 finding에는 기한이 없다. 우리가 날짜를
대신 만들어 넣지 않는다.

`ignoreScopes`는 `lockfile.ts`의 `scopes`를 읽는다. `mixed`는 절대 무시하지 않는다.
여기서는 dev 의존성이면서 우리가 배포하는 무언가의 production 의존성인 패키지는
production 의존성이다.

### 자세 점수

`zero-shelter score`는 총점과 모든 항목을 출력한다. `--explain`은 테이블을 출력한다.
`--as-of YYYY-MM-DD`는 만료와 기한 항목을 측정할 기준 날짜를 고정하며, 기본값은
UTC 기준 오늘이다.

초안 테이블이며, 여기서 확정하지 않고 점수 Issue에서 논쟁한다.

| 항목 | 점수 | 적용 대상 |
|---|---|---|
| `sourceBeyondFirst` | +25 | 첫 번째 이후 기여한 스캐너마다, 최대 2개까지 계산 |
| `baselineRecorded` | +10 | baseline이 존재함 |
| `baselineSchemaCurrent` | +5 | 현재 fingerprint schema로 쓰였음 |
| `acceptanceUndocumented` | −3 | `reason`·`acceptedBy`·`expires` 중 하나라도 빠진 수용마다 |
| `acceptanceExpired` | −10 | 주어진 날짜 기준 `expires`가 지난 수용마다 |
| `fixableOutstanding` | −15 / −10 / −4 / −1 / 0 | 명시된 fix가 있는 미해결 finding마다, 심각도별 |
| `overdue` | −8 | 정책 기한을 넘긴 미해결 finding마다 |

두 가지 성질은 의도한 것이다. **예외를 문서화하면 점수를 얻지 못하고, 문서화하지
않으면 잃는다.** 무엇을 왜 수용했는지 적는 것은 기본이지 성취가 아니며, 이걸 가점으로
두면 수용 건수당 돈을 주는 셈이 된다. **취약점이 없다는 사실에는 점수를 주지 않는다.**
명령 하나로 해결되는 미해결 finding에만 감점한다. 그래야 물려받은 큰 backlog를
처리해 나가는 프로젝트가 의존성이 없는 프로젝트보다 영구히 낮은 순위에 갇히지 않는다.

점수는 음수일 수 있다. 그것도 정보이며, 0으로 올려 주는 것은 `PRODUCT.md`가 금지하는
치장이다.

### 뱃지

`zero-shelter badge`는 shields.io endpoint 형태를 쓴다.

```json
{ "schemaVersion": 1, "label": "zero-shelter", "message": "65 · 3 sources", "color": "green" }
```

색은 같은 내보낸 테이블 안의 정수 임계값에서 나온다. 우리는 파일을 쓰고, 읽는 사람이
커밋하고, Pages가 서빙하고, shields.io가 그들에게서 가져간다. 이 도구에서 나가는
요청은 없다.

### leaderboard

항목은 pull request로 추가하는 `entries/<owner>-<repo>.json`이며, 공개 저장소와 커밋
SHA와 주장하는 점수를 적는다. CI가 그 커밋을 체크아웃해 다시 계산하고, 숫자가 다르면
pull request를 실패시킨다.

## 아키텍처

| 조각 | 변경 예상 파일 | 건드리는 공유 계약 |
|---|---|---|
| adapters | `src/scan.ts`, 신규 `src/adapters.ts`, 신규 `src/ingest/sarif.ts`, 신규 `adapters/*.json` | `Collected`, `skipped` 문구 |
| 정책 | 신규 `src/policy.ts`, `src/judge.ts`, `src/report.ts`, 신규 `skills/policy/` | `JudgeResult`에 정책 파생 필드 추가 |
| 점수 | 신규 `src/posture.ts`, `src/cli.ts`, `src/report.ts` | `--format json`, `docs/STABILITY.md` |
| 뱃지 | `src/cli.ts`, 신규 `src/badge.ts` | 새 출력 형식 |
| leaderboard | 신규 `site/`, `.github/workflows/` | `src/` 안에는 없음 |

점수는 `Collected.contributed`, baseline, 순위 매겨진 findings, 정책을 읽는다. 그중
어디에도 없는 것은 계산하지 않으며, 그래서 설명 가능한 상태로 남는다.

### 조각 1의 위험, 있는 그대로

SARIF는 findings 컨테이너이지 의존성 취약점 스키마가 아니다. rule id, level,
message를 담지만 패키지 이름·취약 버전 범위·수정된 버전을 표준화된 자리에 담지
않는다. SARIF를 내보내는 도구들은 그것들을 자기가 정한 이름으로 `properties`에 넣거나
message 산문 안에 넣는다.

따라서 "SARIF 리더 하나면 SARIF를 내보내는 모든 스캐너가 열린다"는 사실이 아니라
가설이며, 가장 먼저 검증할 대상이다. 실패하면 manifest는 여전히 가치가 있다 —
하드코딩된 명령과 탐지 로직을 없앤다 — 하지만 스캐너마다 작은 parser가 필요해지고,
기여는 더 이상 순수한 데이터가 아니게 된다.

조사(survey)가 나중에 쓰는 문서가 아니라 선행 조건인 이유다.

## 보안과 프라이버시

| 질문 | 답 |
|---|---|
| 보호 대상 데이터 | 새로 없음. findings는 이미 공개된 advisory 데이터다. |
| 신뢰 경계 | adapter manifest는 실행할 명령을 지정한다. 구조상 임의 명령 실행이다. |
| 네트워크 | 변함없음. 우리 쪽 호출은 없다. manifest를 받아오지 않는다. 뱃지 파일은 쓰기만 하고 업로드하지 않는다. |
| LLM | 저작 시점에만. 정책 skill이 파일을 쓰고 `judge`가 읽는다. 판정 중에 모델이 도는 일은 없다. |
| 실패 모드 | 읽을 수 없는 manifest나 정책은 fail-closed. 이유를 말하며 exit 2. 깨끗한 실행처럼 보이는 조용한 skip은 없다. |
| opt-in | 사용자 adapter와 정책 파일은 존재함으로써 opt-in된다. 없으면 오늘과 같은 동작이다. |

manifest의 실행 위험은 `package.json`의 `scripts`와 같은 수준이다. 자기 저장소의
파일이고 자기 리뷰 아래 있다. 그 수준에 붙들어 두는 규칙은 둘이다. manifest를
네트워크에서 가져오지 않으며, 매 실행이 어떤 adapter가 기여했는지 출력한다. manifest가
보이지 않는 채로 실행되는 일은 없다.

leaderboard 검증은 제3자 저장소를 체크아웃한다. **그들의 의존성을 절대 설치하지
않는다.** `npm audit`은 lockfile을 읽고 `osv-scanner`는 파일을 읽으므로, 검증은 읽기
전용이며 점수를 매기는 코드를 실행하지 않는다.

## QA 승인 기준

| 시나리오 | 기대 결과 | 증거 |
|---|---|---|
| 정상 입력 | 설치된 스캐너의 manifest가 실행되고 findings가 merge된다 | fixture + parser 테스트 |
| 잘못된 입력 | 깨진 manifest나 정책은 파일과 필드를 지목하며 exit 2 | 실패 유형별 unit 테스트 |
| 빈 입력 | manifest도 정책도 없으면 오늘과 정확히 같게 동작 | 기존 스위트 무변경 |
| 경계값 | 소스 0개일 때의 점수, 만료일 당일의 수용 | table-driven 테스트 |
| 기존 동작 | 정책 파일이 없으면 `judge` 출력 무변경 | contract 테스트 |
| 보안·프라이버시 남용 | 존재하지 않는 명령을 지정한 manifest는 note와 함께 skip되며, 다른 경로에서 이름을 해석하는 shell로 실행되지 않는다 | `capture` 경로 테스트 |
| 결정성 | 같은 커밋과 같은 `--as-of`는 Ubuntu·macOS·Windows에서 같은 점수 | fingerprint와 마찬가지로 CI matrix |

## Agent 참고

점수는 사용자를 대신해 최적화할 대상이 아니다. `--update-baseline`으로 점수를 올리는
것은 이 설계가 막으려는 바로 그 실패 모드이고, `AGENTS.md`는 이미 그 명령을 작업을
끝내는 방법으로 쓰는 것을 금지한다. 점수가 낮아 보이면 어떤 항목이 점수를 깎았는지
이름을 대라.

JSON에서 점수를 다시 유도하지 마라. 점수는 `--explain`이 출력하는 내보낸 테이블에서
나온다. 순위와 같은 이유다.

## 결정 로그

| 결정 | 검토한 대안 | 이유 |
|---|---|---|
| adapter는 선언적 데이터 | 코드 plugin API | plugin은 우리 프로세스 안에서 돌고 로드하려면 런타임 의존성이 필요하다. `osv.ts`는 실제 파싱이 얼마나 많은지도 보여준다. 그걸 표현할 만큼 강력한 manifest는 언어가 되어 버린다. |
| 사용자 manifest 허용 | 내장 전용 | 내장 전용이면 새 스캐너마다 우리 릴리스를 기다린다. 신뢰 수준은 `package.json` scripts와 같고, 숨기지 않고 명시한다. |
| 정책은 `WEIGHTS`를 못 바꾼다 | 프로젝트별 weights | 비교 가능한 점수가 뱃지와 leaderboard의 전제 전부다. |
| 정책에 개별 finding 제외 없음 | 정책 안의 제외 목록 | baseline이 이미 finding 단위로 억제하며, 정책에는 없을 이유와 만료를 갖고 있다. |
| 점수는 취약점이 아니라 위생을 센다 | 미해결 findings 개수 | 개수는 전부 수용하면 최대가 되고, 그것은 우리가 조용하게 만들려고 절대 쓰지 말라고 하는 그 명령이다. |
| 문서화 안 된 수용은 감점, 문서화된 수용은 가점 없음 | 문서화에 보상 | 문서화된 수용에 값을 주면 수용 건수에 값을 주게 된다. |
| 기한은 `published`부터 | 최초 관측 시점부터 | `published`는 소스에서 온 사실이고 이미 갖고 있다. 최초 관측은 항상 있지는 않은 history가 필요하고, 늦게 도입할수록 유리해진다. |
| 점수는 음수 가능 | 0에서 하한 | `PRODUCT.md`는 숫자를 기분 좋게 만드는 치장을 금지한다. |
| leaderboard 항목은 pull request | 제출 endpoint | endpoint는 네트워크 호출이고 운영할 서비스이며 리뷰가 없다. pull request는 그 셋 다 아니고, 그 자체가 기여다. |
| 검증은 점수를 다시 유도한다 | 주장을 믿는다 | 이 도구는 결정적이다. 다시 실행하는 것이 가능한 가장 싼 검증이고, 불변식이 이미 그 비용을 치르고 있다. |
