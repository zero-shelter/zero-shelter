# 기능 명세: CLI 버전

정본: [English](./cli-version.md). 이 문서는 연결된 Issue의 설계 기록입니다.

## Issue와 담당자

- Issue/Discussion: [Discussion #41](https://github.com/zero-shelter/zero-shelter/discussions/41)
- 대상 계층: 진입점·CLI
- 관련 PR: 추가 예정

## 문제

현재 설치된 zero-shelter 패키지의 버전을 사용자가 확인할 방법이 없습니다. 따라서 버그 신고·지원 요청·패키지 기본 동작 검사의 재현성이 떨어집니다.

## 목표

스캐너를 실행하거나 프로젝트 baseline을 읽지 않고 현재 설치된 패키지 버전을 확인할 수 있게 합니다.

## 범위

### 포함

- `zero-shelter --version` 지원
- `zero-shelter version` 지원
- 설치된 CLI가 사용하는 패키지 메타데이터에서 버전 읽기
- `zero-shelter <version>`과 줄바꿈 출력
- 종료 코드 `0` 반환
- `judge`, `hook`, `--help`, 알 수 없는 명령 동작 유지
- 단위 테스트와 README 옵션 문서 추가

### 명시적 제외

- 패키지 버전 자체 변경
- npm install·init 동작 변경
- 판정·순위·baseline·hook 출력 변경
- 네트워크·텔레메트리 추가
- 개인정보·프롬프트 제어 추가

## 인터페이스

| 실행 | 출력 | 종료 코드 |
|---|---|---:|
| `zero-shelter --version` | `zero-shelter <package version>` | `0` |
| `zero-shelter version` | `zero-shelter <package version>` | `0` |
| `zero-shelter --help` | 기존 도움말 | `0` |
| `zero-shelter unknown` | 기존 오류와 사용법 | `2` |

패키지 메타데이터를 기준 정보로 사용합니다. 저장소 빌드와 배포 패키지 배치 모두에서 동작해야 합니다.

## 아키텍처

- `src/version.ts`: 패키지 버전 읽기와 형식 담당
- `src/cli.ts`: 인자 인식과 분기 처리 담당
- `test/version.test.ts`: 공개 CLI 동작 검증
- 스캐너·baseline·네트워크·에이전트 계층은 변경하지 않음

## 보안과 개인정보

- 로컬 패키지 메타데이터만 읽음
- 대상 프로젝트를 읽거나 하위 프로세스·프롬프트·네트워크를 사용하지 않음
- 비밀정보·개인정보를 출력하지 않음

## QA 완료 기준

| 시나리오 | 기대 결과 | 근거 |
|---|---|---|
| `--version` | 정확한 패키지 버전과 종료 코드 `0` | 단위 테스트 + 수동 실행 |
| `version` | `--version`과 같은 출력 | 단위 테스트 + 수동 실행 |
| `--help` | 기존 사용법 유지 | 기존/수동 확인 |
| `judge` | 스캐너·baseline 경로 불변 | 기존 테스트 모음 |
| `hook` | 문맥 정보와 종료 코드 `0` 불변 | 기존 hook 테스트 |
| 알 수 없는 명령 | 기존 오류와 종료 코드 `2` | 기존/수동 확인 |
| 빌드 패키지 | `node dist/bin.js --version` 동작 | 빌드 후 기본 동작 검사 |

## 에이전트 참고사항

CLI에 버전 상수를 중복 작성하지 않습니다. 버전 처리를 판정이나 스캐너 계층로 옮기지 않습니다. 버그 신고와 릴리스 기본 동작 검사에 복사될 수 있으므로 출력 형식을 안정적으로 유지합니다.

## 결정 기록

| 결정 | 검토한 대안 | 이유 |
|---|---|---|
| 실행 시 패키지 메타데이터 사용 | TypeScript에 버전 직접 작성 | `package.json` 변경 시 출처 중복 방지 |
| 옵션과 명령 모두 지원 | `--version`만 지원 | 하위 명령을 선호하는 사용자도 쉽게 발견 |
