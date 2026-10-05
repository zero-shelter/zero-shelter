# 기능 명세: 미분류 심각도와 정보 심각도 구분

## Issue와 lifecycle metadata

- Issue: #137
- 대상 layer: finding ingest, ranking, report 경계

## 문제

일부 advisory source는 심각도 구간을 보내지 않습니다. 이 상태를 `info`로만
바꾸면 source가 명시하지 않은 값을 낮은 우선순위 판단처럼 보이게 하고, 근거 없는
ranking 점수까지 더하게 됩니다.

## 목표

기존 `Severity` union과 직렬화된 `severity: "info"` 값은 호환성을 위해 유지하면서,
source가 실제로 심각도를 명시했는지를 함께 전달합니다. 미분류 심각도에는 구간
점수를 주지 않고 사람이 보는 출력에는 그 상태를 표시합니다.

## 범위

### 포함

- source 구간을 인식하지 못하면 optional `severityKnown: false` 추가
- 병합된 source 중 하나라도 구간을 명시하면 병합 finding을 알려진 상태로 처리
- 기존 점수표는 유지하고 미분류 심각도의 구간 가중치만 0점 처리
- 터미널과 HTML에 미분류 표기, JSON에는 additive field 추가
- 미분류 심각도에서는 SARIF 숫자형 `security_severity` fallback을 생략하고
  `severityKnown: false` 표시
- 두 README 언어에 동작 문서화

### 명시적 제외

- `Severity` union 확장 또는 변경
- CVSS vector, 제목, 문장에서 심각도 추론
- 다른 신호의 순위, fingerprint, baseline, SARIF level, exit code, scanner 동작 변경

## Interface

| 표면 | 동작 |
|---|---|
| Finding | optional `severityKnown`; 없으면 기존처럼 알려진 값으로 처리 |
| JSON | 미분류일 때만 `severityKnown: false` 추가 |
| Human | 간결한 터미널 표에 `unknown` 표기 |
| HTML | "소스가 심각도를 표시하지 않음" 표기(언어별 표시) |
| SARIF | 미분류면 `security_severity` 생략하고 `severityKnown: false` 추가 |
| Error/exit code | 변경 없음 |

## QA 승인 기준

| 시나리오 | 기대 결과 |
|---|---|
| source가 심각도 생략 | `severity: "info"`, `severityKnown: false`, 구간 점수 0 |
| source가 info 명시 | 기존 info 점수, `severityKnown` 없음 |
| 병합 source 중 하나가 알려짐 | 알려진 상태로 병합하고 명시된 가장 높은 구간 사용 |
| Human, JSON, HTML | 상태가 분명하고 JSON은 additive |
| SARIF | 미분류 finding에 숫자형 심각도를 만들지 않음 |

## 결정 기록

| 결정 | 이유 |
|---|---|
| `severity: "info"` 유지 | 기존 consumer와 고정된 severity union 호환성 유지 |
| optional boolean 사용 | 알려진 finding은 byte-compatible하고 미분류 데이터만 field 추가 |
| CVSS parse하지 않음 | vector에서 구간을 만드는 것은 새 판단 계약이 됨 |
