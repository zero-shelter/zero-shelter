# 기능 명세: 명시적 `--no-color` CLI 옵션

## Issue와 lifecycle metadata

- Issue: #65
- 대상 layer: CLI와 text rendering 경계
- 관련 PR: 추가 예정

## 문제

현재 `NO_COLOR` 환경변수로 ANSI 출력을 끌 수는 있지만, 환경이나 wrapper가
`FORCE_COLOR`를 켠 경우 사용자가 명시적으로 색상을 끌 방법이 없습니다.
터미널 출력을 복사하거나 읽을 때 불편할 수 있습니다.

## 목표

기존 환경변수 동작과 machine-readable output은 유지하면서 사용자가 ANSI 색상을
명시적으로 끌 수 있게 합니다.

## 범위

### 포함

- `judge`에 `--no-color` boolean 옵션 추가
- human text output에서 `FORCE_COLOR`보다 우선 적용
- 옵션 문서화와 테스트 추가

### 명시적 제외

- ranking, finding, output layout, exit code, hook output 변경
- 색상을 켜는 CLI flag 추가
- 이미 색상이 없는 JSON, SARIF, file output 변경

## Interface

| 실행 | 결과 | Exit code |
|---|---|---:|
| `zero-shelter judge --no-color` | Human text에 ANSI escape code 없음 | 기존 judge code |
| `FORCE_COLOR=1 zero-shelter judge --no-color` | `--no-color`가 우선 | 기존 judge code |
| `zero-shelter judge --format json --no-color` | JSON 불변 | 기존 judge code |
| `zero-shelter judge --help` | `--no-color` 표시 | `0` |

## 아키텍처

- `src/cli.ts`: flag를 parsing하고 기존 color decision 지점에 적용
- `test/no-color.test.ts`: override, 기존 동작, help 문구 검증
- `README.md`, `README.ko.md`: 옵션 문서화
- `src/report.ts`, `colorEnabled`: 변경하지 않음. 기본 색상 동작은 기존 환경변수 정책을 유지

## 보안과 개인정보

- 새로운 data, subprocess, network, LLM, telemetry 동작 없음
- 표시 방식만 변경

## QA 승인 기준

| 시나리오 | 기대 결과 | 근거 |
|---|---|---|
| flag 없이 `FORCE_COLOR=1` | 기존 색상 출력 유지 | unit test |
| `FORCE_COLOR=1 --no-color` | ANSI escape code 없음 | unit test |
| `--help` | 옵션을 찾을 수 있음 | unit test + README |
| JSON/SARIF/file output | 기존 machine-readable 동작 유지 | 기존 suite + code path 검토 |

## Agent 참고사항

color policy를 judgement나 ranking code로 옮기지 않습니다. 이 기능에서 `NO_COLOR`,
`FORCE_COLOR`, machine-readable output, report layout을 변경하지 않습니다.

## 결정 기록

| 결정 | 대안 | 이유 |
|---|---|---|
| 명시적 CLI opt-out | `NO_COLOR`만 사용하도록 안내 | wrapper가 `FORCE_COLOR`를 켠 상황에서도 동작해야 함 |
