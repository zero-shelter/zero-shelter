# 기능 명세: 의존성 판정의 경계 알리기

## 이슈와 수명주기 정보

- 이슈: [#168](https://github.com/zero-shelter/zero-shelter/issues/168)
- 대상 계층: CLI, 범위 감지, 리포트 출력
- 관련 PR: #168 구현 PR

## 문제

현재 의존성 판정이 깨끗하면 보안 판정 전체가 깨끗한 것처럼 보입니다.
하지만 zero-shelter가 읽지 않은 secret, container, workflow, infrastructure까지
깨끗하다고 오해하게 만들 수 있습니다.

## 목표

깨끗한 실행에서 의존성만 읽었다는 사실과 실제 트리에 있는 미검사 artifact를
알립니다. JSON 사용자에게도 같은 사실을 전달합니다. 미검사 영역을 깨끗하거나
문제 있다고 말하지 않으며, 없는 파일을 억지로 언급하지 않습니다.

## 범위

### 포함

- 루트 `Dockerfile`, 루트 Terraform/Compose 파일, `.github/workflows` 바로 아래
  파일을 감지합니다.
- 별도 sentinel이 없는 secret은 항상 미검사로 표시합니다.
- 깨끗한 text 실행에는 조용한 한 줄을, JSON에는 추가적인 `unscanned` 객체를
  제공합니다.
- 얕은 detector, 결정적 테스트, 영문·한글 문서를 추가합니다.

### 명시적 제외

- secret, container, workflow, infrastructure를 실제로 스캔하지 않습니다.
- 저장소 재귀 순회, coverage/score, 설치 권고, 새 scanner, 종료 코드 변경은
  하지 않습니다.
- 문제가 남은 text 출력이나 agent hook 문맥에는 이 줄을 추가하지 않습니다.

## 인터페이스

| 방향 | 계약 |
|---|---|
| 입력 | 루트 파일 신호와 `.github/workflows` 바로 아래 항목 |
| 출력 | CLI JSON의 `unscanned: { secrets: true, containers: boolean, workflows: integer, infrastructure: boolean }`, 깨끗한 text의 대응 문장 |
| 오류/종료 코드 | 읽을 수 없는 선택 경로는 없는 것으로 보고 기존 종료 코드를 유지합니다 |
| 호환성 | `unscanned`는 추가 필드이며 기존 JSON 키와 finding 출력은 유지합니다 |

## 아키텍처

- 변경 계층: `scope.ts`, `judge.ts`, `cli.ts`, `report.ts`
- 변경 예정 파일: detector, 순수 결과 option, text/JSON renderer, 테스트,
  README/spec/stability 문서
- 공유 계약: 추가적인 `JudgeOptions`/`JudgeResult` 문맥과 JSON 키. ranking,
  fingerprint, baseline, 종료 코드 규칙은 변경하지 않습니다.
- 충돌 가능 영역: `src/cli.ts`, `src/report.ts`, `docs/STABILITY.md`는 공개
  경계이므로 maintainer 리뷰가 필요합니다.

## 보안과 개인정보

- 보호 데이터: 파일 내용이 아닌 artifact 이름과 개수만 다룹니다.
- 데이터 흐름: CLI가 로컬 directory entry만 읽고 boolean/count를 renderer에
  전달합니다. 프로세스 밖으로 나가지 않습니다.
- 저장/로그: 새 persistence나 로그가 없습니다.
- network/LLM/telemetry: 없습니다.
- 실패 모드: 선택적인 범위 공개는 fail-open입니다. detector 실패가 정상적인
  의존성 판정을 실패시키지 않습니다.
- 사용자 제어: 일반 CLI 실행에서 자동 공개하며 scanner는 실행하지 않습니다.

## QA 수용 기준

| 시나리오 | 기대 결과 | 근거 |
|---|---|---|
| 정상 입력 | 실제 artifact가 깨끗한 실행의 한 줄과 JSON 객체에 표시됩니다 | `test/unscanned-boundary.test.ts` |
| 잘못된 입력 | 선택 경로를 읽지 못해도 판정 종료 코드가 변하지 않습니다 | detector catch와 기존 CLI 테스트 |
| 빈 입력 | 파일 기반 artifact가 없어도 secret은 미검사로 표시됩니다 | `test/unscanned-boundary.test.ts` |
| 경계/대규모 | 루트와 workflow 바로 아래만 보고 재귀 순회하지 않습니다 | detector 및 개수 테스트 |
| 기존 동작 | finding이 있으면 기존 출력에 경계 줄을 추가하지 않습니다 | `test/unscanned-boundary.test.ts` |
| 보안/개인정보 악용 사례 | 내용이나 network 프로세스를 읽거나 내보내지 않습니다 | 코드 검토와 로컬 테스트 |

## Agent 참고

`unscanned`는 finding이 아니라 경계 사실입니다. 문장은 조용하고 사실적으로
유지하며, 없는 artifact를 깨끗하거나 더럽다고 표현하지 않습니다.

## 결정 기록

| 결정 | 검토한 대안 | 이유 |
|---|---|---|
| artifact를 주어로 하는 Issue 논의의 C 문안을 사용 | 고정 목록 또는 고발처럼 들리는 문장 | 독자를 탓하지 않고 조용합니다 |
| 깨끗한 실행에서만 표시 | 모든 실행에서 표시 | Issue가 지적한 오해는 green tick이며, 항상 표시하면 배경 소음이 됩니다 |
| secret은 항상, 파일 기반 영역은 실제 artifact가 있을 때만 표시 | 없는 모든 영역 표시 또는 secret 생략 | secret에는 sentinel이 없고 없는 Docker/workflow를 나열하면 이 트리를 설명하지 못합니다 |
