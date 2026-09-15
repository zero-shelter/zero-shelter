# 기능 명세: 의존성 경로, 수용 기록 검토, 스캐너 어댑터

정본: [English](./adoption-roadmap.md) · [현재 로드맵](../ROADMAP.ko.md)

[#125](https://github.com/zero-shelter/zero-shelter/issues/125)의 과거 설계이며
[#127](https://github.com/zero-shelter/zero-shelter/pull/127)에서 검토했습니다.
입력 수집, 판정, 패키지 영역의 인터페이스 제안과 기각한 설계를 기록합니다.
현재 순서와 구현 상태는 로드맵에서 관리합니다. 이 문서의 예시는 제안이며
배포된 CLI에서 실행할 수 있는 명령이 아닙니다.

각 기능은 구현 전에 별도 명세 검토를 거칩니다. 리뷰에서는 종합 보안 점수,
점수 배지, 공개 순위를 기각했습니다. 계산과 이유는 [기각된 설계](#기각된-설계)에
남깁니다.

2026-09-09 정정: 이전 설명은 단일 소스의 기능을 과소평가했고, 아키텍처 요약에서
파서가 필요 없다고 잘못 썼으며, 개인정보 표에서 발견 항목의 데이터를 모두 공개
정보로 설명했습니다. 아래에서 바로잡았습니다. 과거 측정값은 기록대로 보존했으며
이번 편집에서 다시 측정하지 않았습니다.

## 문제와 목표

이전 제품 설명은 여러 소스가 필요한 병합을 강조하면서, 지원되는 소스 하나로도
순위, 조치 안내, baseline 비교를 제공한다는 점을 충분히 설명하지 않았습니다.
제안한 `why` 명령은 의존성 경로를 추가로 보여주고, 확보한 버전 정보로 어디까지
판단할 수 있는지 설명합니다.

Baseline 항목에는 `reason`, `acceptedBy`, `expires`를 기록할 수 있습니다(#104).
이 제안 당시에는 만료된 항목이 다시 검토 목록에 나타났지만 사전 만료 보고서가
없었습니다. 만료 예정일, 담당자, 만료일이 없는 항목을 보여주면 기한 전에
결정을 다시 검토할 수 있습니다.

스캐너 선택은 `src/scan.ts`에 직접 구현돼 있었습니다. 어댑터 명세 파일을 통해
명령과 입력 형식을 데이터로 설정하는 방안을 제안했습니다. OSV 입력은 다른
생태계도 전달했지만 수집과 조치에는 생태계별 한계가 있었습니다. 명세 파일만으로
스캐너를 추가하려면 기존 파서가 그 근거를 읽을 수 있어야 합니다.

수용 기록을 OpenVEX로 내보내는 방안도 검토했습니다. 이때 사람이 작성한 근거가
필요합니다. 기존 수용 사유만으로 취약한 경로의 실행 여부를 판단할 수는 없습니다.

## 범위와 작업 항목

포함: 의존성 경로 설명, 유효한 만료일과 사전 검토, 소스별 보고 내역,
어댑터 명세 파일과 SARIF 입력, 심각도·범위·기한 정책, OpenVEX 내보내기,
문서화한 예외 건수 배지입니다.

제외: 종합 보안 점수, 공개 순위, 프로젝트별 가중치, 정책에서 개별 항목 제외,
VEX 근거 추론, 도달 가능성 분석입니다. `WEIGHTS`는 고정합니다. 수용 결정이
여러 곳으로 나뉘지 않도록 개별 항목 수용은 baseline에서 관리합니다.

| # | 작업 | 선행 |
|---|---|---|
| [#140](https://github.com/zero-shelter/zero-shelter/issues/140) | `why <package>`: 경로, 그리고 해소하는 버전 | — |
| [#136](https://github.com/zero-shelter/zero-shelter/issues/136) | `9999-99-99`가 날짜 검증을 통과하고 만료되지 않음 | — |
| [#141](https://github.com/zero-shelter/zero-shelter/issues/141) | 만료 리포트: 작업 큐로서의 baseline | #136 |
| [#142](https://github.com/zero-shelter/zero-shelter/issues/142) | 각 스캐너만 보는 것 | — |
| [#126](https://github.com/zero-shelter/zero-shelter/issues/126) | 조사: 어떤 스캐너가 OSV나 SARIF를 내보내는가 | — |
| [#128](https://github.com/zero-shelter/zero-shelter/issues/128) | SARIF를 입력으로 읽기 | #126 |
| [#129](https://github.com/zero-shelter/zero-shelter/issues/129) | 어댑터 명세 파일 | #128 |
| [#130](https://github.com/zero-shelter/zero-shelter/issues/130) | 정책 파일 | — |
| [#131](https://github.com/zero-shelter/zero-shelter/issues/131) | 심각도별 기한 | #130 |
| [#132](https://github.com/zero-shelter/zero-shelter/issues/132) | `skills/policy` | #130, #131 |
| [#138](https://github.com/zero-shelter/zero-shelter/issues/138) | OpenVEX로서의 baseline | — |
| [#134](https://github.com/zero-shelter/zero-shelter/issues/134) | 문서화된 예외 개수로 축소한 배지 | #141 |


리뷰에서는 별도의 판정 문제도 기록했습니다.
[#137](https://github.com/zero-shelter/zero-shelter/issues/137)은 심각도를 분류하지
못한 권고에 `info`가 부여되는 경우를,
[#139](https://github.com/zero-shelter/zero-shelter/issues/139)는
`corroboratedPerExtraTool` 때문에 확인된 악성 패키지가 여러 소스에 보고된
ReDoS보다 낮게 정렬되는 경우를 다룹니다.

원래는 선행 작업이 없고 #141에 만료일 검증이 필요해 #140과 #136부터 진행하려고
했습니다. 이 순서는 과거 기준입니다. #136은 이후 배포됐으며 현재 순서는
로드맵을 따릅니다. 스캐너별 어댑터 이슈는 #129 이후에 만들기로 했습니다.
기여자가 실제로 시작할 수 있을 때 `good first issue`를 붙이려는 결정이었습니다(#91).

## 인터페이스 제안

### `why`

가상의 권고와 의존성 관계를 사용한 출력 예시입니다.

```console
$ zero-shelter why tar
tar 6.2.0 — GHSA-xxxx, fixed in 7.5.22

  express 4.18.2 → send 0.18.0 → tar ^6
  cacache 17.1.4 → tar ^6

  4 dependents require ^6. The lockfile does not identify
  a direct-dependency upgrade that resolves this range.
```

`src/lockfile.ts`에는 `required: Map<string, Requirement[]>`가 있었습니다.
`Requirement`의 `{ by, range }` 중 `by`는 상위 의존성의 lockfile 경로입니다.
`blockedBy()`는 이전 버전을 유지하는 상위 의존성을 찾고,
`version-range.ts`는 `accepts()`, `lowestMentioned()`, `compare()`를 제공했습니다.

Lockfile은 설치된 버전과 요구 범위를 기록하며 상위 패키지의 모든 발표 버전을
담지는 않습니다. 이 근거로 판단할 수 있을 때만 후보를 제시합니다. 그렇지 않으면
제약이 되는 범위와 이 lockfile만으로 최저 직접 업그레이드 버전을 정할 수 없다는
점을 설명합니다.

### 만료 보고서

출력 예시입니다.

```console
12 acceptances expire in the next 30 days
   8  alice      earliest 2026-09-14
   3  bob
   1  unassigned

 4 acceptances have no expiry at all
```

만료일이 없는 항목은 따로 나열합니다. 선행 작업 #136은 형식만 검사하던
`ISO_DATE`(`/^\d{4}-\d{2}-\d{2}$/`)를 수정했습니다. 당시에는 `9999-99-99`가
통과하고 `hasExpired`가 문자열 순서로 비교해 만료 구간에 들어오지 않았습니다.
이 잘못된 날짜를 회귀 검사에 유지합니다.

### 소스별 보고 내역

출력 예시입니다.

```console
osv-scanner is the only source for 14 of 82 findings
   3 critical · 5 high · 6 moderate
npm audit is the only source for 2
66 are reported by both
```

`MergedFinding.tools`로 묶고 합계가 `summary.merged`와 같은지 검사합니다.
단일 소스의 항목은 그 소스만 아는 문제일 수도, 잘못된 보고일 수도 있습니다.
소스 구분만으로 두 경우를 판단할 수는 없습니다.

### 어댑터 명세 파일

```json
{
  "id": "trivy",
  "detect": ["package-lock.json", "go.mod"],
  "command": "trivy",
  "args": ["fs", "--format", "sarif", "--quiet", "."],
  "format": "sarif",
  "versionArgs": ["--version"],
  "install": "brew install trivy, or https://github.com/aquasecurity/trivy/releases"
}
```

제안한 `format` 값은 `osv`, `sarif`, `npm-audit`입니다. `install`은 수집을
실행할 수 없을 때 설치 방법을 제공합니다. 내장 파일 다음에
`.zero-shelter/adapters/`를 읽습니다. 실행 전에 `id`로 정렬하고 생태계 이름은
`src/normalize.ts`로 대소문자를 정규화합니다.

### 정책 파일

```json
{
  "version": 1,
  "minimumSeverity": "moderate",
  "ignoreScopes": ["dev"],
  "deadlines": { "critical": 7, "high": 30, "moderate": 90, "low": 365 }
}
```

`ignoreScopes`는 lockfile의 범위를 사용합니다. `mixed`는 제외하지 않습니다.
개발 전용 경로가 있더라도 프로덕션 의존성 경로를 포함하기 때문입니다.

기한은 권고의 `published`부터 지난 일수입니다. 검토한 구현에서는
`src/ingest/osv.ts`만 이 필드를 설정해 OSV 입력이 없으면 기한을 판단할 날짜가
없었습니다. 이 한계를 표시하고, 기한을 준수한 것으로 취급하거나 프로젝트 간
점수에 사용하지 않습니다.

### OpenVEX 내보내기

| Baseline 필드 | OpenVEX 대응 제안 |
|---|---|
| `reason` | 사람이 제공한 구조화된 근거와 설명. 자유 형식 사유만으로 열거형 값을 정할 수 없습니다. |
| `acceptedBy` | 필수 `author`. 내보내기 명세의 작성자 규칙을 따릅니다. |
| `expires` | 검토한 OpenVEX 모델에는 대응 필드가 없습니다. |

검토한 `not_affected` 근거는 `component_not_present`,
`vulnerable_code_not_present`, `vulnerable_code_not_in_execute_path`,
`vulnerable_code_cannot_be_controlled_by_adversary`,
`inline_mitigations_already_exist`입니다. 구현 전
[OpenVEX 정본 명세](https://github.com/openvex/spec/blob/main/OPENVEX-SPEC.md)를
다시 확인합니다. 여기의 대응표는 제안입니다.

관련 OSV-Scanner 요청 [#19](https://github.com/google/osv-scanner/issues/19)는
2022-11-27에 열렸습니다. 리뷰에서는 OSV-Scanner의 `ignoreUntil`과 baseline의
담당자·만료일을 비교하고 기존 형식을 유지하는 `--format openvex` 추가를
제안했습니다. 수용했다는 사실만으로 근거를 추론하거나 필수 작성자에 도구 이름을
넣지 않습니다.

### 범위를 명시한 배지

배지 예시입니다.

```
zero-shelter | deps · exceptions: 12 documented, 3 not · 2026-09-02
```

문서화한 예외와 문서화하지 않은 예외의 수, `deps` 범위, 생성 날짜를 표시합니다.
제안 당시 `FindingClass`에는 한 종류만 있었습니다(#99). 일반적인 보안 라벨이나
검사 범위 비율은 실제 범위를 과장할 수 있습니다.

제안한 `zero-shelter badge`는 `schemaVersion`, `label`, `message`, `color`만
내보내고 다른 shields.io 필드는 거부합니다. 유지관리자가 직접 수정할 수 있는
자체 보고이며 독립적인 감사가 아닙니다. 원래 제안은 권장 설정에서 예약 재생성을
제외했고, 커밋된 날짜로 정보가 오래됐는지 알 수 있게 했습니다.

## 아키텍처

| 작업 | 변경 예상 파일 | 공유 계약 |
|---|---|---|
| `why` | 새 `src/why.ts`, `src/cli.ts` | 새 하위 명령 |
| 만료 | `src/baseline.ts`, `src/history.ts`, `src/report.ts` | 기존 명세의 ‘고정된 계약 없음’ 분류; 구현 전 현재 안정성 계약 확인 |
| 소스별 내역 | `src/report.ts`, `src/html.ts` | JSON 키 추가 |
| 어댑터 | `src/scan.ts`, 새 `src/adapters.ts`, 새 `src/ingest/sarif.ts`, 새 `adapters/*.json` | `Collected`, `skipped` 문구 |
| 정책 | 새 `src/policy.ts`, `src/judge.ts`, 새 `skills/policy/` | `JudgeResult` 필드 추가 |
| OpenVEX | 새 `src/openvex.ts`, `src/cli.ts` | `--format` 값 추가 |
| 배지 | 새 `src/badge.ts`, `src/cli.ts` | 새 출력 형식 |

판정과 lockfile 데이터를 재사용합니다. SARIF 입력에는 파서와 스캐너별 필드
검증이 필요합니다. 실행 중 네트워크 호출이나 `ScaFinding` 필드는 추가하지 않는
제안이며, 개별 명세에서 필요한 입력이 그 범위에 맞는지 확인해야 합니다.

### 결정성

검토한 병합 구현에서는 `group[0]`이 `ecosystem`과 `packageName`을 제공하고,
`first.ecosystem`이 병합 지문에 들어갔습니다. 어댑터 실행 순서가 식별에 영향을
줄 수 있으므로 파일시스템의 반환 순서에 의존하지 않고 `id`로 정렬합니다.

OSV 입력은 생태계를 소문자로 바꾸고 npm audit는 `"npm"`을 사용했습니다.
SARIF 어댑터가 `"NPM"`을 출력하면 일치하지 않을 수 있습니다. 공통 정규화와
어댑터 순서를 섞는 검사로 지원 플랫폼에서 지문이 같은지 확인합니다.

### SARIF의 한계

SARIF에는 규칙 식별자, 수준, 메시지가 있지만 의존성 이름, 취약 범위, 수정 버전이
항상 표준 위치에 있지는 않습니다. 스캐너가 별도 속성이나 문장에 넣을 수 있습니다.
범용 어댑터를 약속하기 전에 #126 조사로 읽을 수 있는 근거를 확인합니다.
전용 파서가 필요하더라도 명세 파일에서 명령과 탐지 규칙을 설정할 수는 있습니다.

## 보안과 프라이버시

| 영역 | 제안한 요건 |
|---|---|
| 보호할 데이터 | 권고 식별자는 공개 정보일 수 있지만 패키지 목록, 로컬 경로, 수용 정보는 민감한 프로젝트 정보일 수 있습니다. 각 기능의 데이터 흐름에서 검토합니다. |
| 신뢰 경계 | 어댑터 명세 파일은 실행할 명령을 정합니다. 실행 가능한 저장소 설정으로 취급합니다. |
| 네트워크 | 명세 파일을 내려받거나 배지를 업로드하지 않습니다. 호출한 스캐너의 네트워크 동작은 별도로 명시합니다. |
| LLM | 사용자가 요청한 정책 스킬은 파일을 작성할 수 있습니다. `judge`는 실행 중 LLM 호출 없이 그 파일을 읽습니다. |
| 실패 | 읽을 수 없는 명세 파일이나 정책은 이유와 함께 2로 종료합니다. 누락 소스를 표시하며, 일부 결과만 있어도 판정은 0 또는 1로 종료할 수 있습니다. |
| 선택적 사용 | 사용자 어댑터와 정책 파일이 있으면 적용하고, 없으면 기존 동작을 유지합니다. |

자기 저장소의 명세 파일을 검토했다고 타인 저장소에서의 실행까지 안전해지는 것은
아닙니다. 원래 공개 순위 제안은 CI에서 타인의 트리를 체크아웃하고 도구를 실행해
저장소가 지정한 명령에 자격증명을 노출할 수 있었습니다.

자격증명이 있는 환경에서 신뢰하지 않는 트리에 이 도구를 실행하지 않습니다.
어댑터가 없어도 저장소의 `.npmrc`가 `npm audit`을 공격자의 레지스트리로 보내고
환경변수의 토큰을 참조할 수 있습니다. 심볼릭 링크로 연결한 lockfile이나 baseline은
호스트 파일을 노출할 수 있습니다. 의존성을 설치하지 않는다고 샌드박스가 되지는 않습니다.

OpenVEX 문장은 다른 사람의 보안 판단에 사용될 수 있습니다.
내보내기 설계에 따른 사람 작성자와 근거가 필요합니다.

## QA 승인 기준

| 시나리오 | 기대 결과 | 검증 |
|---|---|---|
| 정상 입력 | `why`가 간접 의존성 경로를 출력하고 만료 보고서가 지정 기간의 수용 기록을 표시 | Fixture 테스트 |
| 잘못된 입력 | 잘못된 명세 파일·정책·날짜는 파일과 필드를 명시하며 2로 종료 | 실패 유형별 단위 테스트 |
| 빈 입력 | 어댑터·정책·baseline이 없으면 기존 동작 유지 | 기존 테스트 |
| 경계값 | 지정일에 만료되는 수용, 두 경로에 서로 다른 버전이 있는 패키지, 의존성 순환 처리 | 사례별 테스트 |
| 기존 동작 | 정책 파일이 없으면 `judge` 출력 유지 | `test/contract.test.ts` |
| 보안·개인정보 | 없는 명령은 이유와 함께 건너뛰고 다른 명령을 찾는 셸로 실행하지 않음 | `capture` 경로 테스트 |
| 결정성 | 어댑터 순서를 섞어도 지문이 같고 Ubuntu·macOS·Windows에서 테스트 통과 | CI 플랫폼별 실행 |

## 에이전트 참고

`why`는 경로를 읽고 설명하며 버전을 설치하지 않습니다. 후보는 사용자가 검토합니다.
만료일 연장은 새로운 수용 결정입니다. 검토 목록을 비우려고 날짜를 연장하지 않습니다.

단일 소스 항목을 오탐으로 추정하지 않습니다. #139에는 한 소스만 보고한
확인된 악성 패키지 사례가 있습니다.

## 기각된 설계

이전 리뷰의 계산과 반론을 보존합니다. 수치는 당시 제안과 기록된 테스트 입력에
대한 것이며 현재 제품이나 새로 실행한 벤치마크의 결과가 아닙니다.

### 종합 보안 점수 (#133)

초안은 `WEIGHTS`와 비슷한 정수 규칙 표를 `--explain`으로 출력하고 유지관리
활동에 점수를 부여했습니다. 다음 사례에서 문제가 있었습니다.

| 사례 | 기록된 결과 | 문제 |
|---|---|---|
| 발견 항목 4개의 fixture | 초기 −29, 수용 후 +3, 수용 문서화 후 +15, 모두 수정한 뒤 +15 | 수용과 수정이 같은 점수를 만들 수 있었습니다. |
| NodeGoat 수용 | 결정 문자열을 채우면 +2,635, critical 하나를 고치면 +15 | 문서 작성의 영향이 수정보다 컸습니다. |
| 프로젝트 규모 | 가점은 최대 +65, 의존성 900개 프로젝트의 초기 점수는 약 −3,900 | 상한 없는 발견 건수가 상한 있는 절차 점수를 압도했습니다. |
| OSV 입력 추가 | juice-shop −590, NodeGoat −1,451, dvna −351 | 근거를 추가하면 점수가 낮아질 수 있었습니다. |
| 설치된 스캐너 변경 | 같은 fixture에서 19점 차이와 발견 항목 구성 변화 | 커밋만으로 점수가 정해지지 않았습니다. |
| 만료일 삭제 | 만료된 수용 −10, 만료일 없음 −3 | 날짜 삭제로 7점을 얻었습니다. |

`fixableOutstanding`과 `overdue`는 수용하면 빠지는 검토 항목을 셌습니다.
`|acceptanceUndocumented| < |fixableOutstanding|`이면 수정 없이 수용만으로
점수가 오를 수 있었습니다. 문서화 감점을 올리면 발견 건수 중심의 점수가 됐습니다.

`sourceBeyondFirst`는 추가 스캐너당 +25를 주고 그 스캐너만 보고한 수정 가능 항목에
최대 −15를 부여했습니다. 리뷰는 항목을 합한 손익분기를 1.1건으로 기록했습니다.
7개 항목 중 3개만 커밋으로 결정됐고 나머지는 PATH, 권고 데이터, 시계에
의존했습니다. `published`는 OSV 입력에만 있어 npm 입력만으로는 `overdue`
감점이 적용되지 않았습니다.

`acceptanceUndocumented`는 문자열 3개가 비어 있지 않은지만 검사해 340건을 한 번에
채워도 통과했습니다. low/info에서는 무시하는 비용이 문서화보다 작을 수 있었습니다.
어댑터 형식을 OSV에서 SARIF로 바꾸면 `fixedIn`과 `published` 근거가 없어져
필드를 위조하지 않고도 해당 감점이 적용되지 않을 수 있었습니다.

대안은 소스, 심각도별 검토 항목, 문서화한 수용과 하지 않은 수용, 기한 초과를
각각 표시하는 것이었습니다. 같은 저장소를 같은 소스 집합으로 실행했을 때만
비교하고 소스가 바뀌면 추세를 만들지 않습니다. `history.jsonl`과
`missingSources`가 관련 데이터를 제공합니다.

또 다른 대안은 일정 기간 내 수정까지 걸린 일수의 중앙값입니다. 표본 수를
함께 쓰고 `n=5` 미만이면 값을 표시하지 않으며, 해당 권고가 없으면 `no data`를
표시하는 제안이었습니다. 필요한 데이터와 수용 처리 방식은 별도 검증이 필요합니다.

### 공개 순위 (#135)

공개 저장소와 커밋 SHA를 적은 PR을 받고 CI에서 다시 채점하는 제안이었습니다.
다음 이유로 기각했습니다.

- 점수는 트리, 스캐너 집합, 실시간 권고 데이터, 시계에 의존했습니다.
  커밋만으로 재현할 수 없고 권고 데이터 고정에는 제안 범위를 넘는 저장이나
  네트워크 동작이 필요했습니다.
- CI에서 저장소가 지정한 명령을 실행하면 자격증명이 노출될 수 있었습니다.
  검증 중 명세 파일을 끄면 검증하려던 스캐너 집합이 달라졌습니다.
- 빈 검사 대상은 최고점을 반복해서 만들 수 있지만 실제 프로젝트는 권고 데이터에
  따라 변했습니다. 재현 가능성만으로 점수의 의미를 검증할 수 없었습니다.
- 타인의 저장소를 등록할 수 있었습니다. 커밋된 `.zero-shelter/leaderboard.json`을
  요구하면 저장소의 동의를 확인할 수 있지만 나머지 문제는 해결되지 않았습니다.

리뷰는 SecurityScorecard가 공개 점수에서 Trust Centers로 옮긴 사례와
OpenSSF Scorecard의 종합 점수·변하는 판단 기준에 대한 경고도 참고했습니다.
기각 이유는 위의 재현과 실행 문제이며, 해당 조직의 동기나 현재 제품에 대한
추정에 의존하지 않습니다.

하위 프로젝트의 조치를 막는 패키지와 관련 PR을 나열하자는 별도 의견도 있었습니다.
이 구현 제안에는 포함하지 않았습니다.

### 여러 보안 영역의 검사 범위 점수

의존성, 비밀 값, 컨테이너, IaC, SAST, CI/CD 검사 여부를 세는 초안이었습니다.
`FindingClass`가 하나인 상태에서 비율은 `1/1`에 머물러 전체 범위를 설명하지
못했습니다. #99에서 발견 종류별 의미를 먼저 정해야 했습니다.

비밀 값은 버전 업그레이드가 아닌 교체가 필요하며, 사용 중인 자격증명을 통상적인
baseline 항목으로 수용하거나 원문을 커밋할 지문에 넣어서는 안 됩니다.
따라서 배지는 `deps`를 유지하고 검사 범위 비율을 생략했습니다.

### 점수 배지와 스캐너별 점수 합산

배지 파일에는 임의의 숫자를 쓸 수 있었고 초안에는 독립 검증 수단이 없었습니다.
축소한 배지는 자체 보고로 범위, 건수, 날짜를 표시합니다.
스캐너별 점수 합산도 종합 점수의 결함을 유지하므로, #142에서는 소스별 사실을
표시하기로 했습니다.

## 결정 기록

| 결정 | 대안 | 이유 |
|---|---|---|
| 원래는 `why`부터 시작 | 병합부터 소개 | 기존 단일 소스 기능에 의존성 경로 근거를 추가합니다. 현재 순서는 로드맵을 따릅니다. |
| 사전 만료 보고서 | 재사용을 위한 배지나 공개 순위 | 기록된 결정으로 다가오는 검토 작업을 찾습니다. |
| `published` 기준 기한 | 첫 관측 시점 | 실행 이력 없이 기존 소스 근거를 사용하되 OSV 날짜 누락을 명시합니다. |
| 선언적 어댑터 | 프로세스 내부 코드 플러그인 | 명령 설정과 파서를 분리하고 새 런타임 플러그인 로더를 추가하지 않습니다. |
| `id` 정렬과 생태계 정규화 | 파일시스템 순서 | 실행 순서와 대소문자가 병합 식별에 영향을 주지 않게 합니다. |
| OpenVEX 내보내기 | 자체 근거 용어 | 사람이 작성하고 검토한 대응 규칙으로 기존 형식을 사용합니다. |
| VEX 근거 추론 금지 | 도달성 추정 | 도달 가능성 근거가 없습니다. |
| 배지 범위와 날짜 | 단일 점수 | 검사 영역과 기록 시점으로 주장을 한정합니다. |
| `WEIGHTS` 고정 | 프로젝트별 가중치 | 공통 순위와 설명 계약을 유지합니다. |
| 기각된 설계 보존 | 이전 제안 삭제 | 실패 사례와 계산을 이후 검토에서 참고할 수 있게 합니다. |
