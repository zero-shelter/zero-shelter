# 기능 명세: 첫 실행에서 줄 것, 그리고 돌아올 이유

## Issue와 lifecycle metadata

- Issue: [#125](https://github.com/zero-shelter/zero-shelter/issues/125)
- 대상 layer: ingest, judgment, package
- 관련 PR: [#127](https://github.com/zero-shelter/zero-shelter/pull/127)

roadmap 명세다. 순서와 공유 결정을 고정하며, 각 조각은 구현 전에
`docs/specs/<issue>-<slug>.md`에 자기 명세를 갖는다.

**이 문서는 리뷰 후 다시 쓰였다.** 초안은 자세 점수, 그 점수를 담은 뱃지, 공개
leaderboard를 제안했다. 아홉 번의 독립 리뷰 — 그중 넷은 `bench/captures/`와
`test/fixtures/`에 도구를 실제로 돌렸다 — 가 설계가 성립하지 않는다고 판정했다.
기각된 작업과 그것을 죽인 반론은 삭제하지 않고 [기각된 설계](#기각된-설계)에
남긴다. 밖에서 보면 매력적인 아이디어들이고, 실패하는 이유는 재보기 전에는 보이지
않기 때문이다.

## 문제

세 가지 한계이고, 모두 소스에서 확인할 수 있다.

**첫 실행에서 줄 것이 없다.** `PRODUCT.md`가 결과를 그대로 쓴다. *"소스가 하나면
화해시킬 것이 없다. 감소는 0이고 가치는 순위뿐이다."* 화해가 이 제품인데, 읽는
사람이 우리 말만 믿고 두 번째 스캐너를 깔기 전까지는 보이지 않는다. 깔때기가
아무것도 보여주기 전에 `brew install osv-scanner`를 요구한다.

**유일하게 쌓이는 자산이 한 번도 값을 치르지 않는다.** 수용마다 `reason`,
`acceptedBy`, `expires`가 붙는다(#104). 1년을 쓰면 이름과 날짜가 달린 결정 기록이
읽는 사람의 저장소 안에 생긴다. 그런데 기한이 이미 지나기 전에는 아무것도 그걸
꺼내 보이지 않는다. `applyBaseline`의 `expired` 설명이 *"`fresh`로 되돌아오고,
이름이 붙는다"*이다. 사후에만 말하는 파일은 무덤이다.

**스캐너 집합이 소스 코드다.** `src/scan.ts`가 본문에서 `npm audit`, `pnpm audit`,
`osv-scanner`를 부르고 `existsSync`로 고른다. 저장소 밖의 누구도 네 번째를 추가할
수 없고, 안에 있는 사람도 빠르게는 못 한다. 그동안 `finding.ts:44`의 `ecosystem`은
자유 문자열이고 `ingest/osv.ts:56`은 PyPI·Go·crates.io 판정을 파이프라인 전체로
훼손 없이 통과시킨다. 벽은 수집과 조치 양 끝에 있지 가운데가 아니다.

## 목표

**읽는 사람이 이미 가진 스캐너로 첫 실행에서 답을 받는다.** *"fix가 존재한다"*와
*"나에게 fix가 존재한다"*를 가르는 질문 — 내 어떤 직접 의존성이 이걸 끌고 오고, 그
의존성의 어느 버전부터 advisory가 해소되는가 — 는 끊임없이 묻히는데 어떤 도구도
제대로 답하지 않는다. `npm audit`은 `fixAvailable: true`라고 하고 멈춘다.
`npm ls`는 트리를 그리고 버전은 모른다. 우리는 lockfile에서, 오프라인으로, 스캐너
하나로 답할 수 있다.

**baseline이 무덤이 아니라 작업 큐가 된다.** 같은 데이터를 한 단계 앞에서 —
*30일 안에 수용 12건 만료, 그중 8건이 alice 것* — 보여주면 다음 달에 다시 돌릴
이유가 생기고, 쌓인 파일이 그저 존재하는 게 아니라 값을 갖게 되고, 메인테이너가
떠나도 살아남는다. `acceptedBy`가 각 결정의 주인을 말하고, 리포트가 이제 주인이
없어진 것들을 말한다.

**스캐너 추가에 우리 허락이 필요 없어진다.** 스캐너는 명령과 전송 형식을 적은 JSON
manifest가 되고, 패키지나 읽는 사람 자신의 저장소에서 로드된다. 척도는 기여의
크기다. `trivy` 추가가 manifest 하나, fixture 하나, 테스트 하나여야 하고,
`src/scan.ts`를 한 번도 안 읽은 사람이 리뷰할 수 있어야 한다.

**판정을 우리가 쓰지 않은 것들이 읽을 수 있게 된다.** SARIF는 이미 내보낸다.
downstream이 원본 넷 대신 판정된 하나를 받게 하려고. baseline도 같은 대우를 받을
자격이 있고, 그 형식은 이미 존재한다 — 조각 6.

## 범위

### 포함

1. `zero-shelter why <package>` — 의존성 경로와 그걸 해소하는 버전 (#140)
2. `expires`의 실제 날짜 검증 (#136), 그 위의 만료 리포트 (#141)
3. 소스별 귀속: 각 스캐너만 보는 것 (#142)
4. adapter manifest와 입력 형식으로서의 SARIF (#126, #128, #129)
5. 정책 파일: 최소 심각도, scope 제외, 기한 (#130, #131, #132)
6. OpenVEX로 내보내는 baseline (#138)
7. 점수가 아니라 문서화된 예외 개수를 말하는 뱃지 (#134, 축소)

### 명시적 제외

- **단일 숫자로서의 자세 점수.** [기각된 설계](#기각된-설계) 참조.
- **공개 leaderboard.** 같음.
- **프로젝트별 weights.** `WEIGHTS`는 얼린다. 이번엔 이유가 다르다. 점수를 비교
  가능하게 하려는 게 아니라 — 점수가 없다 — `--explain`이 그 테이블을 출력하기
  때문이다. 읽는 사람이 고칠 수 있는 테이블은 출력된 설명이 더 이상 기술하지 않는
  테이블이다.
- **정책 파일의 개별 finding 제외.** 그건 baseline이고, 이유·담당·만료를 이미
  갖는다. 억제 수단이 둘이면 뭔가 빠졌을 때 볼 곳이 둘이 된다.
- **VEX justification 추론.** 사람이 쓴 justification을 직렬화할 수는 있다. 유도하면
  다른 사람이 그걸 근거로 행동하는 문서에 거짓 비악용성 주장을 넣는 것이다.
- **도달 가능성.** 변함없음. 취약한 코드 경로가 실제로 도는지는 여기 어느 것도
  모른다.

## 작업 항목

| # | 조각 | 선행 |
|---|---|---|
| [#140](https://github.com/zero-shelter/zero-shelter/issues/140) | `why <package>`: 경로, 그리고 해소하는 버전 | — |
| [#136](https://github.com/zero-shelter/zero-shelter/issues/136) | `9999-99-99`가 날짜 검증을 통과하고 만료되지 않음 | — |
| [#141](https://github.com/zero-shelter/zero-shelter/issues/141) | 만료 리포트: 작업 큐로서의 baseline | #136 |
| [#142](https://github.com/zero-shelter/zero-shelter/issues/142) | 각 스캐너만 보는 것 | — |
| [#126](https://github.com/zero-shelter/zero-shelter/issues/126) | 조사: 어떤 스캐너가 OSV나 SARIF를 내보내는가 | — |
| [#128](https://github.com/zero-shelter/zero-shelter/issues/128) | SARIF를 입력으로 읽기 | #126 |
| [#129](https://github.com/zero-shelter/zero-shelter/issues/129) | adapter manifest | #128 |
| [#130](https://github.com/zero-shelter/zero-shelter/issues/130) | 정책 파일 | — |
| [#131](https://github.com/zero-shelter/zero-shelter/issues/131) | 심각도별 기한 | #130 |
| [#132](https://github.com/zero-shelter/zero-shelter/issues/132) | `skills/policy` | #130, #131 |
| [#138](https://github.com/zero-shelter/zero-shelter/issues/138) | OpenVEX로서의 baseline | — |
| [#134](https://github.com/zero-shelter/zero-shelter/issues/134) | 문서화된 예외 개수로 축소한 뱃지 | #141 |

리뷰 중 발견된 수정 사항으로, 위 어느 것과도 독립적이다.
[#137](https://github.com/zero-shelter/zero-shelter/issues/137) (분류하지 못한
advisory가 `info`로 랭크되고, yarn 프로젝트에서는 그게 전부다),
[#139](https://github.com/zero-shelter/zero-shelter/issues/139)
(`corroboratedPerExtraTool`가 확인된 악성 패키지를 미러링된 ReDoS 아래로 정렬한다).

**#140과 #136부터 시작한다.** 둘 다 선행이 없고, #140은 처음 온 사람에게 뭔가를 주는
유일한 조각이며, #136은 배포된 결함이라 #141이 그대로 물려받게 된다.

스캐너별 adapter Issue는 #129가 들어온 뒤에 만든다. 아무도 시작할 수 없는 일에
`good first issue`를 붙이는 것이 #91이 지적한 결함이다.

## 인터페이스

### `why`

```console
$ zero-shelter why tar
tar 6.2.0 — GHSA-xxxx, 7.5.22에서 수정됨

  express 4.18.2 → send 0.18.0 → tar ^6
  cacache 17.1.4 → tar ^6

  4개 의존자가 ^6을 요구합니다. 설치 가능한 어떤 express 버전으로도
  해소되지 않습니다. 그 범위는 당신 것이 아니라 그들 것입니다.
```

lockfile에서 답한다. `src/lockfile.ts`가 이미 `required: Map<string,
Requirement[]>`를 만들고 `Requirement`는 `{ by, range }`이며 `by`는 의존자의
lockfile 경로다 — 순회에 필요한 간선 목록이다. `blockedBy()`는 어떤 의존자가 옛
사본을 유지하는지 이미 계산하고, `version-range.ts`에 `accepts()`,
`lowestMentioned()`, `compare()`가 있다.

출력에 명시할 한계: lockfile은 의존자가 요구한 범위를 기록하지 받아들일 수 있는 모든
버전을 기록하지 않는다. "이걸 해소하는 최저 직접 버전"은 트리에 이미 있는 어떤
버전이 만족할 때만 답할 수 있고, 아니면 막는 쪽을 지목하고 멈춘다. **둘 중 무엇을
했는지 말하는 것**이 유용함과 오도의 차이다.

### 만료 리포트

```console
30일 안에 수용 12건 만료
   8  alice      가장 이른 것 2026-09-14
   3  bob
   1  담당 없음

 만료가 아예 없는 수용 4건
```

기한 없는 수용은 따로 나열한다. 만료되는 게 아니라 다른 문제이고, 둘을 합치면 그게
숨는다.

#136에 막혀 있다. `ISO_DATE`가 `/^\d{4}-\d{2}-\d{2}$/`라 `9999-99-99`를 통과시키고
`hasExpired`는 사전순 비교라, 절대 만료되지 않는 날짜를 가진 수용이 이 리포트에
영원히 안 나타난다. **가장 봐야 할 항목이 정확히 빠지는 항목이다.**

### 소스별 귀속

```console
osv-scanner만 보는 판정 82건 중 14건
   critical 3 · high 5 · moderate 6
npm audit만 보는 판정 2건
둘 다 보고한 것 66건
```

이미 있는 `MergedFinding.tools`에 대한 group-by다. 합계가 `summary.merged`와 정확히
같아야 하고, 믿지 말고 테스트가 단언해야 한다.

**유일하다는 게 더 낫다는 뜻은 아니다.** 어떤 소스가 혼자 보고하는 이유는 그것만
알기 때문일 수도, 틀렸기 때문일 수도 있다. 어느 판정이 단일 소스인지는 알 수 있고
둘 중 무엇인지는 알 수 없으며, 문구가 그걸 암시해서는 안 된다.

### adapter manifest

```json
{
  "id": "trivy",
  "detect": ["package-lock.json", "go.mod"],
  "command": "trivy",
  "args": ["fs", "--format", "sarif", "--quiet", "."],
  "format": "sarif",
  "versionArgs": ["--version"],
  "install": "brew install trivy, 또는 https://github.com/aquasecurity/trivy/releases"
}
```

`format`은 `osv`, `sarif`, `npm-audit` 중 하나다. `install`은 `scan.ts`가 이미 쓰는
방식을 따른다. 문제만 말하지 않고 빠져나갈 길을 알려준다.

내장 manifest가 먼저, 그다음 `.zero-shelter/adapters/`. **manifest는 실행 전에 `id`로
정렬**하고 ecosystem은 `src/normalize.ts`를 거쳐 대소문자를 접는다 — 둘 다 정돈이
아니라 하중을 받는 이유는 [보안](#보안과-프라이버시)과 #129에 있다.

### 정책 파일

```json
{
  "version": 1,
  "minimumSeverity": "moderate",
  "ignoreScopes": ["dev"],
  "deadlines": { "critical": 7, "high": 30, "moderate": 90, "low": 365 }
}
```

`ignoreScopes`는 `lockfile.ts`의 `scopes`를 읽는다. `mixed`는 절대 무시할 수 없다.
여기서 dev 의존성이면서 우리가 배포하는 무언가의 production 의존성인 패키지는
production 의존성이고, `lockfile.ts`는 그걸 추측이 아니라 계산한다.

기한은 advisory의 `published`부터의 일수다. **`published`는 `src/ingest/osv.ts`에서만
설정된다.** osv-scanner가 없는 프로젝트는 기한이 아예 없다. 이건 이 기능의 실제
구멍이고, 나중에 발견되는 대신 여기 적어 둔다. 그리고 기한이 점수가 아니라 리포트인
이유 중 하나다.

### OpenVEX로서의 baseline

우리 `AcceptedFinding`은 VEX에 없는 필드 하나를 가진 자체제작 VEX다.

| 우리 | OpenVEX |
|---|---|
| `reason` (자유 텍스트) | `justification` — 5값 기계판독 enum, 그리고 선택적 산문 |
| `acceptedBy` (자유 텍스트) | `author` — 필수 |
| `expires` | 없음 |

enum — `component_not_present`, `vulnerable_code_not_present`,
`vulnerable_code_not_in_execute_path`,
`vulnerable_code_cannot_be_controlled_by_adversary`,
`inline_mitigations_already_exist` — 이 리뷰가 "필요하다"고 결론 내렸고 우리가 막
설계하려던 그 닫힌 어휘다. 2022년부터 존재했고, 다들 이미 읽는 그것이다.

한편 `osv-scanner.toml`은 만료(`ignoreUntil`)가 있고 VEX 출력이 없다.
[issue #19](https://github.com/google/osv-scanner/issues/19)가 2022-11-27부터 열려
있다. npm 계열 어느 도구도 파일 안에 담당자를 기록하지 않는다.

그래서 만료와 담당자를 갖고 OpenVEX로 나가는 baseline은 우리가 이미 연동하는 두 도구
사이의 빈칸에 있다. 추가적 변경이다. 새 `--format openvex`, 기존 형식 무변경.

*위 열거값들은 리뷰 중에 읽은 것이다. 만들기 전에 `OPENVEX-SPEC.md`로 다시 확인할
것 — 권위는 그 명세이지 이 문서가 아니다.*

### 축소된 뱃지

```
zero-shelter | deps · exceptions: 12 documented, 3 not · 2026-09-02
```

점수가 아니다. 트리의 순수 함수인 개수 셋, 그리고 초안이 빠뜨렸고 선택 사항이 아닌
것 둘.

**라벨이 범위를 진다.** 자격증명이 유출된 저장소에 `zero-shelter`라고만 적힌 초록
뱃지는 이 도구가 한 번도 보지 않은 영역에 대한 보증이다. `FindingClass`는 멤버가
하나다(#99). 두 번째가 생기기 전까지 라벨은 `deps`라고 쓴다.

**뱃지가 날짜를 진다.** 파일은 손으로 커밋되므로 기본이 낡은 상태이고, 낡음이 정직한
상태다. 권장 설정에 예약 재생성 workflow를 넣지 말 것. 커밋 없이 움직이는 숫자는
메인테이너가 답할 수 없는 숫자다.

`zero-shelter badge`는 `schemaVersion`, `label`, `message`, `color`만 내보내고
shields.io endpoint 스키마의 나머지 필드를 거부한다. 문서는 뱃지가 **감사가 아니라
자기보고**임을 분명히 말해야 한다. 누구나 손으로 쓸 수 있고, 알면서 취약한 패키지
위의 영구 초록 뱃지는 우리가 나눠주는 신뢰 세탁 도구다.

## 아키텍처

| 조각 | 변경 예상 파일 | 건드리는 공유 계약 |
|---|---|---|
| `why` | 신규 `src/why.ts`, `src/cli.ts` | `hook`·`history` 옆 새 subcommand |
| 만료 | `src/baseline.ts`, `src/history.ts`, `src/report.ts` | 얼린 것 없음 |
| 귀속 | `src/report.ts`, `src/html.ts` | 추가 JSON 키 |
| adapters | `src/scan.ts`, 신규 `src/adapters.ts`, 신규 `src/ingest/sarif.ts`, 신규 `adapters/*.json` | `Collected`, `skipped` 문구 |
| 정책 | 신규 `src/policy.ts`, `src/judge.ts`, 신규 `skills/policy/` | `JudgeResult` 추가 필드 |
| OpenVEX | 신규 `src/openvex.ts`, `src/cli.ts` | 새 `--format` 값 |
| 뱃지 | 신규 `src/badge.ts`, `src/cli.ts` | 새 출력 형식 |

모든 조각이 파이프라인이 이미 만든 데이터를 읽는다. 여기에 parser도, `ScaFinding`의
새 필드도, 네트워크 호출도 없다.

### #129가 들여오는 결정성 위험

`src/merge.ts:166`은 `ecosystem`과 `packageName`을 `group[0]` — 가장 먼저 도착한
finding — 에서 가져오고, 163행은 `first.ecosystem`을 병합 fingerprint에 넣는다. 그룹
순서는 입력 순서이고, 그건 adapter 실행 순서가 된다.

결과가 둘이고, 둘 다 막기는 싸고 나중에 고치기는 비싸다.

- `.zero-shelter/adapters/`를 `readdir`로 읽고 정렬하지 않으면 실행 순서가 파일시스템
  의존이 되고 APFS·ext4·NTFS는 서로 다르다. **`id`로 정렬한다.**
- `ingest/osv.ts`는 ecosystem을 소문자로 만들고 `ingest/npm-audit.ts`는 `"npm"`을
  박아 넣는다. 우연히 일치할 뿐이다. `"NPM"`을 내보내는 SARIF adapter가 생기면
  `groupByAlias`가 다른 패키지로 취급한다 — 같은 취약점이 두 번 보고되고 영원히 병합
  안 된다. **`normalize.ts`를 거쳐 대소문자를 접는다.** README 불변식이 fingerprint에
  들어가는 모든 것에 대해 이미 요구하는 것이다.

adapter 순서를 섞고 fingerprint가 같은지 단언하는 테스트가 loader의 첫 커밋에 들어가야
한다.

### adapter 작업의 위험, 있는 그대로

SARIF는 findings 컨테이너이지 의존성 취약점 스키마가 아니다. rule id, level, message는
담지만 패키지 이름·취약 버전 범위·수정된 버전을 표준화된 자리에 담지 않는다. 도구들은
자기가 정한 이름으로 `properties`에 넣거나 message 산문에 넣는다.

따라서 "SARIF 리더 하나면 SARIF를 내보내는 모든 스캐너가 열린다"는 가설이다. 실패하면
manifest는 여전히 가치가 있다 — 하드코딩된 명령과 탐지 로직을 없앤다 — 하지만 스캐너마다
작은 parser가 필요해지고 기여가 순수한 데이터가 아니게 된다. #126이 나중에 쓰는 문서가
아니라 선행 조건인 이유다.

## 보안과 프라이버시

| 질문 | 답 |
|---|---|
| 보호 대상 데이터 | 새로 없음. findings는 공개된 advisory 데이터다. |
| 신뢰 경계 | adapter manifest는 실행할 명령을 지정한다. 구조상 임의 명령 실행이다. |
| 네트워크 | 우리 것 없음. manifest를 받아오지 않는다. 뱃지 파일은 쓰기만 하고 올리지 않는다. |
| LLM | 저작 시점에만. 정책 skill이 파일을 쓰고 `judge`가 읽는다. |
| 실패 모드 | 읽을 수 없는 manifest나 정책은 fail-closed, 이유와 함께 exit 2. 기대보다 소스가 적은 실행도 exit 0으로 깨끗해 보이므로, 조용한 skip이 위험한 방향이다. |
| opt-in | 사용자 adapter와 정책 파일은 존재함으로써 opt-in된다. 없으면 오늘과 같다. |

manifest의 실행 위험은 `package.json`의 `scripts`와 같은 수준이다. 자기 저장소의
파일이고 자기 리뷰 아래 있다. 그 수준에 붙들어 두는 규칙은 둘이다. manifest를
네트워크에서 가져오지 않으며, 매 실행이 어떤 adapter가 기여했는지 출력해서 보이지 않는
채로 실행되는 일이 없게 한다.

**그 정당화는 파일이 당신 것이라는 데 전적으로 의존한다.** 이 명세의 초안은 같은 문장을
써 놓고, CI가 제3자 저장소를 체크아웃해 그 안에서 채점기를 돌리는 leaderboard를
제안했다. 그 순간 manifest는 남의 것이 되고, 논증은 우리 토큰을 쥔 원격 코드 실행으로
무너진다. **두 진술이 한 문서 안에 마흔 줄 간격으로 있었고 아무도 연결하지 않았다.**

여기서 나오는 규칙이고, 나중에 만드는 무엇에든 적용된다. **자격증명을 쥔 환경에서, 당신이
작성하지 않은 트리에 이 도구를 절대 돌리지 말 것.** adapter가 전혀 없어도 실행에 닿는
경로가 둘이다. `registry=https://evil/`과 `_authToken=${NODE_AUTH_TOKEN}`이 든 저장소
로컬 `.npmrc`는 우리 자신의 `npm audit --json`이 환경변수를 유출하게 만들고, 심볼릭
링크된 `package-lock.json`이나 `baseline.json`은 호스트 파일을 읽는다. **"의존성을
설치하지 않는다"는 sandbox가 아니다.**

VEX 문서(#138)는 다른 사람이 그걸 근거로 행동하는, 악용 가능성에 대한 공개 주장이다.
`author` 필드가 명세에서 필수인 이유가 그것이다. 사람 저자가 없는 statement는 도구
이름으로 채워 넣지 않고 거부한다.

## QA 승인 기준

| 시나리오 | 기대 결과 | 증거 |
|---|---|---|
| 정상 입력 | `why`가 전이 finding의 경로를 출력하고, 만료 리포트가 창 안의 수용을 나열 | fixture 테스트 |
| 잘못된 입력 | 깨진 manifest·정책·날짜는 파일과 필드를 지목하며 exit 2 | 실패 유형별 unit 테스트 |
| 빈 입력 | manifest도 정책도 baseline도 없으면 오늘과 정확히 같게 동작 | 기존 스위트 무변경 |
| 경계값 | 주어진 날짜에 만료되는 수용, 두 경로로 두 버전이 있는 패키지, 의존성 그래프의 순환 | table-driven 테스트 |
| 기존 동작 | 정책 파일이 없으면 `judge` 출력 무변경 | `test/contract.test.ts` |
| 보안·프라이버시 남용 | 없는 명령을 지정한 manifest는 note와 함께 skip되며, 다른 것을 찾아내는 shell로 해석되지 않는다 | `capture` 경로 테스트 |
| 결정성 | adapter 순서를 섞어도 fingerprint 동일, Ubuntu·macOS·Windows에서 스위트 통과 | fingerprint와 마찬가지로 CI matrix |

## Agent 참고

`why`는 읽기다. 경로와 버전을 출력하지 아무것도 설치하지 않으며, 명명한 버전은 사람이
평가할 후보이지 실행할 명령이 아니다.

만료 리포트는 작업 큐이지 비워야 할 할 일 목록이 아니다. 만료 연장은 새로운 위험
판단이고 `AGENTS.md`는 이미 수용을 사람 쪽에 둔다. **리포트를 비우려고 만료를 연장하는
agent는 일의 반대를 한 것이다.**

"한 스캐너에만 있음"을 "아마 오탐"으로 취급하지 말 것. #139가 반대 경우를 기록한다.
한 소스만 볼 수 있는 판정에는 확인된 악성 패키지가 포함되고, 다른 소스는 그걸 아예 갖고
있지 않다.

## 기각된 설계

삭제하지 않고 기록한다. 각각 이 명세의 초안이 제안했고, 밖에서 보면 매력적이며, 누군가
재보기 전에는 보이지 않는 이유로 실패했다. 다시 제안하는 사람은 반론에 먼저 답해야 한다.

### 단일 정수로서의 자세 점수 — #133

제안: `WEIGHTS` 모양의 정수 규칙 테이블, `--explain`이 한 줄씩 출력, 취약점이 아니라
위생을 셈.

**자기가 선언한 원칙과 모순됐다.** 가장 큰 두 항목 — `fixableOutstanding`과 `overdue` —
가 *미해결* findings에 대한 개수였고, 그건 정확히 `--update-baseline`이 비우는 집합이다.
4-finding fixture 실측: 있는 그대로 **−29**, `--update-baseline` 후 **+3**, 그 수용들을
문서화한 후 **+15**, **모든 취약점을 고친 후 +15**. 전부 고친 것과 전부 수용한 것이 같은
숫자에 닿았다. NodeGoat에서는 문자열 세 개를 쓰는 데 **+2,635**, critical 하나를 고치는
데 **+15**였다.

관계는 취향이 아니라 검증 가능하다. `|acceptanceUndocumented|`가
`|fixableOutstanding|`보다 작은 한 억제가 항상 이득이고, 그렇지 않을 때까지 올리면 설계가
거부한 순수 취약점 개수가 된다. **일관된 배정이 존재하지 않는다.**

**형태가 프로젝트 크기로 순위를 매겼다.** 가점은 +65에서 멈추고, 의존성 900개
프로젝트의 첫날 바닥은 약 −3,900이었다. 가점은 유계 프로세스 사실이고 감점은 findings
개수에 비례하며 그건 의존성 개수에 비례한다. finding 다섯 개를 넘으면 그 숫자는 대체로
*당신이 얼마나 큰가*였다.

**대표 항목이 제품이 장려하려는 바로 그 행동을 처벌했다.** `sourceBeyondFirst`는 추가
스캐너당 +25를 한 번 주고, 그 스캐너가 유일하게 드러낸 fixable finding마다 최대 −15를
물렸다. 손익분기가 1.1건이다. 그리고 `published`가 `ingest/osv.ts`에서만 오므로
`overdue`는 osv-scanner 없이는 발화조차 못 했다 — 설치하면 juice-shop −590,
NodeGoat −1,451, dvna −351이었다.

**입력이 커밋의 속성이 아니다.** 일곱 항목 중 셋만 커밋으로 결정됐고, 나머지는 기계의
`PATH`, 그날 advisory 데이터베이스의 상태, 또는 시계를 읽었다. 설치된 스캐너만 다른
동일 fixture 실측: 19점 차이, 그리고 finding 집합의 구성 자체가 바뀌었다.

**항목들이 하나씩 무력화됐다.** `acceptanceUndocumented`는 세 필드의 비어있지 않음만
확인해서 `jq` 한 번이면 340건을 찍는다. `acceptanceExpired`(−10)와 만료가 아예 없는
수용(−3)은 **날짜를 지우는 데 7점을 지불**했다. `low`와 `info`에서는 문서화보다 무시가
쌌다. 그리고 SARIF는 `fixedIn`도 `published`도 표준 자리에 안 담으므로 — 이 명세의 위험
섹션이 직접 쓴 문장이다 — 모든 adapter의 `format`을 `osv`에서 `sarif`로 바꾸면 두 감점
항목이 구조적으로 도달 불가가 됐고, 위조가 없어서 리뷰어가 지적할 것도 없었다.

**살아남는 것**은 스칼라가 아니라 벡터다 — 소스, 심각도별 미해결, 문서화된 수용과 안 된
수용, 기한 초과 — 그리고 **같은 저장소의 이전 실행과, 같은 선언된 스캐너 집합에서만**
비교하며, 그 집합이 바뀌면 추세를 내보내기를 거부한다. `history.jsonl`이 이미 `at`,
`sources`, `outstanding`을 갖고 `applyBaseline`이 정확히 이 이유로 `missingSources`를
계산한다.

두 리뷰가 독립적으로 같은 대안을 제안했다. 단일 숫자가 언젠가 필요하다면
**추적 기간 내 수정까지의 중앙 일수**, `n`을 함께 출력하고 `n=5` 미만이면 억제. 외연적이
아니라 내포적이고, 물려받은 backlog가 침몰시키지 않으며, `--update-baseline`이 움직이지
못하고, 해당 advisory가 없는 저장소는 만점이 아니라 `no data`를 받는다 — 빈 저장소
챔피언을 죽이는 유일한 구성이다.

### 공개 leaderboard — #135

제안: 공개 저장소와 커밋 SHA를 적은 pull request로 등록, CI가 점수를 재유도해 주장을
검증.

**커밋의 점수는 커밋의 속성이 아니다.** 입력이 `트리 × 스캐너 집합 × advisory DB 상태 ×
시계`이고 그중 셋이 커밋 안에 없다. advisory 데이터베이스 하나만으로 끝난다. `npm
audit`은 레지스트리를 실시간 조회하고 osv-scanner는 자기 데이터를 갱신하므로, 얼어붙은
커밋에 일주일 간격으로 두 번 돌리면 서로 다른 advisory를 본다. 고정할 스냅샷 식별자가
없고, 고정하려면 advisory 데이터베이스를 번들하거나 가져와야 한다 — 다른 제품이거나,
깨진 불변식이다.

**검증이 원격 코드 실행이었을 것이다.** [보안](#보안과-프라이버시)에서 다뤘다. 수정과
기능이 서로 배타적이다. 검증은 사용자 manifest를 꺼야 하는데, 그러면 주장자가 쓴 것과
다른 스캐너 집합을 채점한다.

**재유도는 가짜를 받아들이고 정직한 항목을 떨어뜨린다.** 빈 디렉터리를 겨눈 진짜 스캐너
manifest 두 개를 가진 5분짜리 빈 저장소는 최댓값을 영원히 재현하고, 진짜 프로젝트의
숫자는 생태계가 움직여서 주장과 재계산 사이에 달라진다. **결정성 필터이고, 결정적인 건
부정행위자뿐이다.**

**낯선 사람이 남의 저장소를 등록하는 걸 아무것도 막지 않았다.** 타당한 수정이 있다 —
체크아웃한 커밋에 그 저장소를 지목하는 `.zero-shelter/leaderboard.json`이 있을 때만 항목이
유효하게 해서, 동의를 점수와 같은 방식으로 재유도 가능하게 만드는 것. 위 세 반론은 구제하지
못한다.

**유일한 선례는 그걸 만든 회사가 접었다.** SecurityScorecard는 공개 scorecard를 운영하다가
*"더 통제 가능한 공유 옵션"*이라며 Trust Center로 대체했다 — 변호사와 영업 동기를 가진
회사가 *대상에 대한 점수 발행*에서 *대상이 자기 점수를 발행하게 하는 것*으로 옮긴 것이다.
그리고 OpenSSF는 백만 개 넘는 저장소를 주간으로 공개 데이터셋에 넣어두고 `ORDER BY` 하나면
될 순위를 만들지 않는다. README가 이유를 적어놨다. *"특히 종합 점수는 저장소가 어떤 개별
행동을 하고 있는지 아무것도 말해주지 않는다 … 이 점수들은 우리가 새 휴리스틱을 추가하면
바뀐다."* 마지막 절만으로도 SHA 시점 검증은 무너진다.

**`--explain`은 그 숫자를 만들어낸 기계 위에서 논쟁 가능하게 만든다. leaderboard는 그
기계 밖에서 참이라고 주장한다. 추적 가능성은 비교 가능성이 아니다.**

살릴 만한 아이디어는 역방향이다. **프로젝트가 아니라 병목을 순위 매겨라** — 가장 많은 하위
저장소를 막고 있는 방치된 패키지들, 그리고 열린 pull request. 우리가 이미 모으는 데이터에서
나오고, 메인테이너는 아무도 줄 세워지지 않으며, 압력이 고칠 수 있는 곳을 향한다. 원하는
사람이 있으면 별도 Issue로.

### 보안 영역 전반의 커버리지 축

제안: 의존성·시크릿·컨테이너·IaC·SAST·CI/CD 중 저장소가 무엇을 들여다봤는지 채점. 안 본
영역은 깨끗한 게 아니라 모르는 것이라는 근거로. 그 근거는 옳고, exit code 2가 이미 서 있는
논증과 같다.

아직 못 낸다. `FindingClass`는 멤버가 정확히 하나이고, #99는 그 seam을 늦게, 그리고 시크릿부터
열지 말라고 주장한다. 이유가 순서가 아니라 안전에 관한 것이다. 시크릿의 조치는 회전이고 우리
조치 표면 전부가 버전 범프를 가정하며, 살아있는 자격증명을 baseline에 수용하는 것은 알려진
CVE를 수용하는 것보다 훨씬 나쁜 기본값이고, 시크릿이 담긴 fingerprint는 커밋되는 파일에
자격증명을 쓴다.

클래스가 하나면 분모가 1이고 어떤 커버리지 수치든 영원히 `1/1`로 읽힌다. 두 번째 클래스가
생기기 전까지 뱃지는 `deps`라고 쓰고 분수를 출력하지 않는다.

### 점수를 담은 뱃지, 그리고 스캐너별 점수 합산

초안의 뱃지는 무결성이 없었다. `echo`로 아무 숫자나 파일에 쓰면 되고, 설계는 거의 아무도 안
읽는 leaderboard에 검증 예산을 다 쓰고 모두가 보는 산출물을 검증 없이 뒀다. 검증이 필요 없는
주장을 하는 것으로만 살아남고, 위의 축소된 형태가 그것이다.

스캐너별 점수를 합산하는 것은 단일 점수와 같은 방식으로 실패한다 — 합산이 깨지는 지점이다.
스캐너별 *사실*은 유용하고 #142로 남긴다.

## 결정 로그

| 결정 | 검토한 대안 | 이유 |
|---|---|---|
| 파이프라인이 아니라 `why`로 시작 | 화해로 시작 | 화해는 뭔가 보여주려면 스캐너가 둘 필요하다. `why`는 가진 것으로 첫 실행에 답한다. |
| 만료 리포트가 유지 장치 | 뱃지, leaderboard | baseline은 이미 읽는 사람의 저장소에서 쌓이는 것이었다. 값을 치른 적이 없었을 뿐이다. |
| 기한은 `published`부터 | 최초 관측부터 | `published`는 소스에서 온 사실이고 이미 갖고 있다. 최초 관측은 항상 있지 않은 history가 필요하다. 구멍과 함께 기록한다. `published`는 osv-scanner에서만 오므로 그것 없는 프로젝트는 기한이 없다. 리포트에서는 감수할 수 있고 점수에서는 실격이다. |
| adapter는 선언적 데이터 | 코드 plugin API | plugin은 우리 프로세스에서 돌고 로드하려면 런타임 의존성이 필요하다. `osv.ts`는 실제 파싱이 얼마나 많은지 보여준다 — 그걸 표현할 만큼 강력한 manifest는 언어가 된다. |
| manifest는 `id`로 정렬, ecosystem은 대소문자 접기 | `readdir`가 주는 대로 | 병합 fingerprint가 `group[0].ecosystem`을 읽는다. 정렬 안 된 실행은 그걸 파일시스템 의존으로 만든다. |
| enum을 설계하는 대신 OpenVEX를 내보냄 | 자체 justification enum | 리뷰가 닫힌 어휘가 필요하다고 결론 냈다. 하나가 존재하고, 세 가지로 표준화돼 있고, downstream이 전부 이미 읽는다. |
| VEX justification은 절대 추론하지 않음 | 도달성 휴리스틱에서 유도 | VEX statement는 남이 근거로 행동하는 주장이고, 우리에겐 도달성 데이터가 없다. |
| 뱃지가 범위와 날짜를 짐 | `zero-shelter \| 65` | 자격증명이 유출된 저장소 위의 초록 뱃지는 우리가 본 적 없는 영역에 대해 뭔가를 주장한다. |
| `WEIGHTS`는 얼림 | 프로젝트별 weights | `--explain`이 그 테이블을 출력한다. 읽는 사람이 고칠 수 있는 테이블은 설명이 더 이상 기술하지 않는 테이블이다. |
| 기각된 설계를 전부 기록 | 삭제 | 하나하나가 밖에서 보면 매력적이고 재보기 전에는 안 보이는 이유로 실패한다. 지우면 다시 제안될 것이 보장된다. |
