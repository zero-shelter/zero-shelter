# 기능 명세: SARIF에 CVSS 출처 보존

## Issue와 lifecycle metadata

- Issue: #123
- 대상 layer: SARIF output integration
- 관련 PR: #226

## 문제

SARIF 알림은 zero-shelter의 severity 단어에서 만든 숫자형 `security_severity`를
노출하지만 advisory에서 이미 가져온 정확한 CVSS vector는 버립니다. 코드 주석도
vector가 없다고 잘못 설명합니다.

고정된 OSV capture 네 개에는 vulnerability occurrence 453개와 severity entry
481개가 있습니다. 모든 severity entry에는 CVSS vector가 있고 숫자 score는 없으며,
424개 vulnerability occurrence가 하나 이상의 vector를 제공합니다.

## 목표

advisory의 정확한 CVSS vector가 있으면 SARIF에 보존하고, 숫자형 severity band는
결정론적 fallback이라고 정확히 설명합니다.

## 범위

### 포함

- `finding.cvssVector`를 SARIF result의 `properties.cvssVector`에 그대로 복사
- source가 vector를 주지 않았으면 property 생략
- 기존 숫자형 severity-band mapping을 fallback으로 유지
- 두 README 언어에 호환성 동작 문서화

### 명시적 제외

- vector에서 숫자형 CVSS score 계산
- ranking, SARIF level, fingerprint, alert identity 변경
- scanner ingest나 finding contract 변경

## Interface

| 방향 | 계약 |
|---|---|
| Input | ingestion에서 이미 정규화된 optional `RankedFinding.finding.cvssVector` |
| Output | 값이 있을 때 SARIF result `properties.cvssVector`의 동일한 문자열 |
| Error/exit code | 새로운 error나 exit-code 변경 없음 |
| 호환성 | optional SARIF property 추가; 기존 field와 fallback band 유지 |

## 아키텍처

- 변경 layer: SARIF rendering 경계
- 변경 파일: `src/sarif.ts`, `test/sarif.test.ts`, README 번역, 이 spec
- shared contract: additive SARIF result property만 변경
- 가능한 충돌: 향후 source가 숫자형 CVSS를 제공할 때만 fallback 대체 검토

## 보안과 개인정보

- 보호 또는 민감 data: 없음. vector는 이미 공개 advisory에서 옵니다.
- data flow와 trust boundary: parse된 advisory finding에서 local SARIF output으로 이동
- logging과 retention: 변경 없음
- network/LLM/telemetry: 없음
- failure mode: 값이 없으면 optional property 생략
- opt-in/opt-out: 기존 `--format sarif` 옵션으로 선택

## QA 승인 기준

| 시나리오 | 기대 결과 | 근거 |
|---|---|---|
| vector가 있는 finding | source vector를 result properties에 그대로 보존 | 고정 OSV capture를 쓰는 SARIF unit test |
| vector가 없는 finding | property 생략 | SARIF unit test |
| 빈 result | 기존의 유효한 empty run | 기존 SARIF test |
| 많은 finding | 각 result가 해당 finding의 vector 사용 | 기존 순서형 result 생성 mapping |
| 기존 동작 | band, level, fingerprint, score 불변 | 기존 suite |
| 악의적인 text | `JSON.stringify`가 값을 JSON escape | 기존 serialization 경계 |

## Agent 참고사항

여기서 CVSS score를 계산하지 않습니다. source 근거를 그대로 보존하고 결정론적
integer ranking은 CVSS 부동소수점 연산과 분리합니다.

## 결정 기록

| 결정 | 고려한 대안 | 이유 |
|---|---|---|
| vector를 result properties에 추가 | rule properties; 숫자 score 계산 | vector는 finding별로 달라지고 capture에는 source 숫자 score가 없음 |
| severity band 유지 | `security_severity` 제거 | fallback을 정확히 설명하면서 현재 GitHub alert rendering과 호환성 유지 |
