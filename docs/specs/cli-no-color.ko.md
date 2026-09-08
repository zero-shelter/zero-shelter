# 기능 명세: 명시적 `--no-color` CLI 옵션

정본: [English](./cli-no-color.md). 이 문서는 연결된 Issue의 설계 기록입니다.

## Issue와 담당자

- Issue: #65
- 대상 계층: CLI와 텍스트 표시 경계
- 관련 PR: 추가 예정

## 문제

현재 `NO_COLOR` 환경변수로 ANSI 출력을 끌 수는 있지만, 환경이나 래퍼가
`FORCE_COLOR`를 켠 경우 사용자가 명시적으로 색상을 끌 방법이 없습니다.
터미널 출력을 복사하거나 읽을 때 불편할 수 있습니다.

## 목표

기존 환경변수 동작과 기계가 읽는 출력은 유지하면서 사용자가 ANSI 색상을
명시적으로 끌 수 있게 합니다.

## 범위

### 포함

- `judge`에 `--no-color` 불리언 옵션 추가
- 사람이 읽는 텍스트 출력에서 `FORCE_COLOR`보다 우선 적용
- 옵션 문서화와 테스트 추가

### 명시적 제외

- 순위, 발견 사항, 출력 배치, 종료 코드, hook 출력 변경
- 색상을 켜는 CLI 옵션 추가
- 이미 색상이 없는 JSON, SARIF, 파일 출력 변경

## 인터페이스

| 실행 | 결과 | 종료 코드 |
|---|---|---:|
| `zero-shelter judge --no-color` | 사람이 읽는 텍스트에 ANSI 이스케이프 코드 없음 | 기존 judge 종료 코드 |
| `FORCE_COLOR=1 zero-shelter judge --no-color` | `--no-color`가 우선 | 기존 judge 종료 코드 |
| `zero-shelter judge --format json --no-color` | JSON 불변 | 기존 judge 종료 코드 |
| `zero-shelter judge --help` | `--no-color` 표시 | `0` |

## 아키텍처

- `src/cli.ts`: 옵션을 파싱하고 기존 색상 결정 지점에 적용
- `test/no-color.test.ts`: 우선 적용, 기존 동작, 도움말 문구 검증
- `README.md`, `README.ko.md`: 옵션 문서화
- `src/report.ts`, `colorEnabled`: 변경하지 않음. 기본 색상 동작은 기존 환경변수 정책을 유지

## 보안과 개인정보

- 새로운 데이터, 하위 프로세스, 네트워크, LLM, 텔레메트리 동작 없음
- 표시 방식만 변경

## QA 완료 기준

| 시나리오 | 기대 결과 | 근거 |
|---|---|---|
| 옵션 없이 `FORCE_COLOR=1` | 기존 색상 출력 유지 | 단위 테스트 |
| `FORCE_COLOR=1 --no-color` | ANSI 이스케이프 코드 없음 | 단위 테스트 |
| `--help` | 옵션을 찾을 수 있음 | 단위 테스트 + README |
| JSON/SARIF/파일 출력 | 기존 기계가 읽는 동작 유지 | 기존 테스트 모음 + 코드 경로 검토 |

## 에이전트 참고사항

색상 정책을 판정이나 순위 코드로 옮기지 않습니다. 이 기능에서 `NO_COLOR`,
`FORCE_COLOR`, 기계가 읽는 출력, 보고서 배치를 변경하지 않습니다.

## 결정 기록

| 결정 | 대안 | 이유 |
|---|---|---|
| 색상을 끄는 CLI 옵션 | `NO_COLOR`만 사용하도록 안내 | 래퍼가 `FORCE_COLOR`를 켠 상황에서도 동작해야 함 |
