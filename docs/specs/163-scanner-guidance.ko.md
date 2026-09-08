# 기능 명세: 프로젝트에 맞는 스캐너 안내

정본: [English](./163-scanner-guidance.md)

## Issue와 담당자

- Issue: [#163](https://github.com/zero-shelter/zero-shelter/issues/163)
<<<<<<< HEAD
- 대상 계층: 로컬 프로젝트 탐색, CLI 출력, setup 스킬
- 관련 로드맵: [#125](https://github.com/zero-shelter/zero-shelter/issues/125), [도입 로드맵](./125-adoption-roadmap.md)
=======
- 대상 layer: 로컬 프로젝트 탐색, CLI 출력, setup skill
- 관련 roadmap: [#125](https://github.com/zero-shelter/zero-shelter/issues/125), [도입 roadmap](./adoption-roadmap.md)
>>>>>>> docs/product-roadmap-alignment
- 관련 PR: #163에서 연결합니다. 상태와 담당자는 GitHub에서 관리합니다.

Owner 검토를 위한 구현 계약 제안입니다. 다음 기능 릴리스(잠정 0.1.0)의
후보이며 0.0.10의 배포 조건이 아닙니다. 이 문서는 명령을 추가하거나 구현을
승인하지 않습니다.

## 문제

첫 사용자는 자신의 프로젝트에 맞는 안내가 필요합니다. setup 스킬에는
영역별 도구 표가 있지만 CLI는 프로젝트의 단서와 도구 설치 상태를
조사하지 않습니다. 의존성 판정만으로 비밀정보, 컨테이너 설정, 인프라,
워크플로를 검사했다고 말할 수 없습니다.

#163의 예시는 설치된 도구 옆에 “covered”를 표시합니다. PATH에 존재하는
것만으로는 그 주장을 할 수 없습니다. 특히 이 명령은 스캐너를 실행하지
않으므로 적용 단서, 사용 가능 여부, 검사 실행을 구분해야 합니다.

## 목표

`zero-shelter scanners`는 관찰한 프로젝트 단서에 필요한 검사, 찾을 수 있는
관련 도구, 없는 도구의 설치 경로를 설명합니다. JSON에서도 같은 사실을
제공하며, 모든 결과에 이번 명령이 검사를 실행하지 않았음을 명시합니다.

## 범위

### 포함

- 명시적으로 실행하는 `scanners` 하위 명령, 텍스트와 `--format json` 출력
- 알려진 파일·디렉터리 이름을 제한된 범위에서 탐색하고 상대 경로로 근거 표시
- 작업별 도구, 라이선스 식별자, 플랫폼별 설치 안내, 도구 개발사의 근거를 담은 내장 추천 목록
- 메타데이터만 사용하는 PATH 조회; `--version`도 실행하지 않음
- 이 명령을 활용하는 setup 스킬 예시; 추천 도구 설치·실행 전 사용자 동의 유지
- 기존 규칙대로 터미널은 영어, 문서는 영어 정본과 한국어 번역 제공

### 명시적 제외

- 스캐너·패키지 매니저·셸 명령 실행, 설치, 네트워크 요청
- 프로젝트 소스·비밀 값·Git 기록·스캐너 발견 사항·정책 파일 파싱
- SARIF 입력, 어댑터, 순위·baseline·history 저장 방식 변경
- 기본 judge/hook 출력에 안내 추가; #168/#193에서 별도로 결정
- 점수·백분율·안전 판정, 설치만으로 검사를 마쳤다는 주장
- 탐색 결과 저장, 텔레메트리, 사용자 정의 실행 목록, 자동 갱신

## 인터페이스

| 방향 | 계약 |
|---|---|
| 입력 | `zero-shelter scanners [--cwd <directory>] [--format text\|json]`; 기본은 현재 디렉터리와 텍스트 |
| 출력 | 적용 단서, 도구 사용 가능 여부, 중복 제거한 추천, 검사 미실행 문구 |
| 오류·종료 코드 | 0: 조사 완료(없는 도구·빈 디렉터리 포함); 2: 잘못된 인자, 접근할 수 없는 루트, 미완료 탐색; 도구 부재로 1을 반환하지 않음 |
| 호환성 | 새 하위 명령만 추가; 기존 judge/hook/history 출력·종료 코드·스키마 유지 |

아래는 제안 예시이며 출시된 명령의 출력이 아닙니다.

```text
No scanners were run. Tool availability is not evidence of inspection.

Suggested checks
  container configuration  Dockerfile
  CI workflows             .github/workflows/build.yml
  secrets in files         applicable to every project

Tools available
  trivy                    container/IaC configuration and file-secret checks

Tools to consider
  zizmor (MIT)             GitHub Actions security checks
                           https://docs.zizmor.sh/installation/

No matching project signals found: Python, Go, Rust
```

제한된 파일 이름 탐색으로 단서를 찾지 못했으면 “not applicable” 대신
“no matching signals found”라고 합니다. 소스 파일은 언어의 단서이며,
특정 규칙 모음이 그 언어를 분석할 수 있다는 증거가 아닙니다.

제안 JSON의 발췌입니다. 전체 결과에는 지원하는 모든 영역이 포함됩니다.
초안 상태에서도 필드 추가는 검토를 거칩니다.

```json
{
  "schemaVersion": 1,
  "complete": true,
  "inspection": "not-run",
  "domains": [
    { "id": "container-config", "applicability": "detected", "evidence": ["Dockerfile"] },
    { "id": "secrets-files", "applicability": "always", "evidence": [] }
  ],
  "tools": [
    { "id": "trivy", "availability": "available" }
  ],
  "recommendations": [],
  "warnings": []
}
```

영역의 적용 상태는 `detected`, `not-detected`, `always`입니다.
도구의 사용 가능 상태는 `available`, `missing`, `unknown`이며 호환성·설정·실행을
뜻하지 않습니다. `inspection`은 항상 `not-run`입니다. 추천 항목은 `tool`,
`tasks`, `license`, `installUrl`, 선택적 플랫폼별 `installCommand`를 담습니다.
URL과 명령은 내장 목록에서만 가져옵니다.

미탐지 영역도 포함합니다. 영역과 도구는 안정적인 ID 순서, 근거 경로는
코드 포인트 순서, 추천은 고정된 목록 순서로 출력합니다. JSON은
`JSON.stringify`, 텍스트는 제어문자 이스케이프를 사용합니다. 프로젝트 절대 경로,
실행 파일의 실제 경로, PATH 값은 출력하지 않습니다.

## 탐색 경계

| 단서 | 제안할 작업과 한계 |
|---|---|
| package.json / package-lock.json / npm-shrinkwrap.json / pnpm-lock.yaml / yarn.lock | JavaScript 의존성; 판정기의 현재 지원 여부나 잠금 파일 호환성을 약속하지 않음 |
| requirements*.txt / pyproject.toml / poetry.lock / uv.lock | Python 의존성 |
| go.mod / go.sum | Go 의존성 |
| Cargo.toml / Cargo.lock | Rust 의존성 |
| pom.xml / build.gradle / build.gradle.kts | JVM 의존성 |
| Dockerfile / Dockerfile.* / Containerfile / Containerfile.* | 컨테이너 설정; 빌드된 이미지를 검사하는 것이 아님 |
| *.tf / *.tf.json | Terraform 설정; 임의 YAML을 Kubernetes/IaC라고 추정하지 않음 |
| .github/workflows/*.yml 또는 *.yaml | GitHub Actions 보안 |
| *.js / *.jsx / *.ts / *.tsx / *.py / *.go / *.rs / *.java / *.c / *.h / *.cpp | 소스 분석; 실행 추천 전에 언어·규칙 지원을 확인 |
| 모든 프로젝트; 추가로 .git 항목 존재 | 파일 비밀정보 검토는 항상 제안; .git 파일/디렉터리가 관찰되면 Git 기록 검토를 별도 작업으로 제안 |

파일 내용은 읽지 않고 프로젝트 심볼릭 링크를 따라가지 않습니다. `.git`,
`node_modules`, `vendor`, `.venv`, `venv`, `dist`, `build`, `coverage`, `.next`,
`.cache`, `.context`, `.zero-shelter` 디렉터리는 순회에서 제외합니다.
루트의 `.git` 항목은 제외 전에 관찰하되 gitdir 포인터 파일은 열지 않습니다.
도움말에 제외 목록을 명시합니다. git을 실행하거나 .gitignore를 파싱하지 않습니다.

제안 한도는 루트 아래 깊이 8, 디렉터리 항목 20,000개이며 정렬한 순서로
방문합니다. 제외 대상이 아닌 하위 경로를 읽지 못하거나 한도에 도달하면
길이가 제한된 경고와 부분 결과를 출력하고 `complete: false`, 종료 코드 2로
끝냅니다. 이때 단서가 없다는 결과는 확정적이지 않습니다. 문서에 정한 정책에
따라 심볼릭 링크를 건너뛴 것만으로는 실패하지 않습니다.

PATH에서는 POSIX 실행 권한을 확인하고, Windows는 고정된 `.exe`/`.cmd`/`.bat`
확장자를 대소문자 구분 없이 찾습니다. 비어 있거나 상대적인 PATH 항목은
무시합니다. 일반적인 시스템 실행 파일 심볼릭 링크는 메타데이터 확인을 위해
해석할 수 있지만 실행하지 않습니다. 후보 경로의 권한 오류는 `unknown`과
경고로 표시하며 `missing`이라고 하지 않습니다. 도구 상태를 명시적으로
`unknown`으로 표시해도 프로젝트 탐색 자체는 완료될 수 있습니다.

## 추천 목록

#163과 기존 setup 스킬을 바탕으로 한 제안입니다. 구현 전에 도구 개발사의
설치·라이선스 근거를 다시 확인하고 검토한 근거 자료를 목록 테스트에 기록합니다.
실행 중에는 조회하지 않습니다.

| 도구 | 여기서 다룰 작업 | 프로젝트 라이선스 / 근거 |
|---|---|---|
| npm / pnpm audit | 프로젝트 단서로 선택한 기존 JS 의존성 경로; 있으면 추가 설치 불필요 | 기존 패키지 매니저 설치·프로젝트 안내 재사용 |
| [OSV-Scanner](https://github.com/google/osv-scanner) | 지원 매니페스트/잠금 파일 형식의 의존성 검사 | Apache-2.0; 도구 개발사의 README/설치 안내 |
| [Trivy](https://github.com/aquasecurity/trivy) | 컨테이너·Terraform 설정과 파일 비밀정보 | Apache-2.0; 도구 개발사의 설치·스캐너 문서 |
| [Gitleaks](https://github.com/gitleaks/gitleaks) | 파일 비밀정보 및 별도의 Git 기록 검사 | MIT; 도구 개발사의 README/설치 안내 |
| [zizmor](https://docs.zizmor.sh/installation/) | GitHub Actions 보안 검사 | MIT; [프로젝트](https://github.com/zizmorcore/zizmor) |
| [Opengrep](https://github.com/opengrep/opengrep) | 언어·규칙이 지원되는 소스 분석 | LGPL-2.1; 규칙 모음의 조건은 별도 출처 표시 필요 |

라이선스 필드는 도구 프로젝트의 식별자이며 법률 판단이나 외부 규칙/서비스의
포괄적인 라이선스가 아닙니다. 도구 소스나 규칙을 이 패키지에 복사하지 않습니다.

도구 ID로 중복을 제거하고 한 설치 안내 옆에 작업 목록을 표시합니다. 적합한
도구가 이미 있으면 우선합니다. 컨테이너/IaC 때문에 Trivy를 추천한다면 파일
비밀정보용 도구를 추가로 추천하지 않되, Git 기록이라는 별도 작업까지
지우면 안 됩니다. npm과 pnpm이 모두 설치됐다는 이유만으로 같은 프로젝트에
둘 다 추천하지 않습니다. 기존 매니저 선택을 재사용하고 충돌하는 잠금 파일
근거도 보여줍니다. 도구 기능이 zero-shelter의 결과 입력 지원을 뜻하지는 않습니다.
범용 최적화 엔진이나 “최소 도구 수” 보장은 추가하지 않습니다.

2026-09-07에 확인한 Gitleaks README에는 새 기능을 더 이상 병합하지 않고
향후 릴리스는 보안 패치라는 안내가 있었습니다. 기존 이슈의 “활발히 유지보수됨”
설명만으로 장기 기본값을 정하면 안 됩니다. Owner는 구현 전에 제한된 작업에
Gitleaks를 유지할지, 근거를 갖춘 대안을 선택할지 검토해야 합니다. 이 명세
PR에서 현재 출시된 setup 스킬의 추천을 변경하지 않습니다.

검증된 Homebrew 명령은 지원하는 환경에서만 안내합니다. 다른 환경에서 검증된
명령이 없으면 도구 개발사의 설치 링크를 제공합니다. 명령을 추측하거나 실행 파일을
자동 다운로드하지 않습니다.

## 아키텍처

- 예상 새 모듈: 제한된 탐색·목록을 위한 `src/scanners.ts`와 전용 출력 함수.
  파일 분리는 구현 리뷰에서 확정합니다.
- 예상 변경: `src/cli.ts`의 명령 분기·도움말, 두 README, `skills/setup/SKILL.md`,
  탐색·CLI 테스트, `scripts/qa-agent.mjs`.
- 공개 경계: 새 명령·JSON 계약·setup 스킬은 명시적인 Maintainer 검토가 필요하고,
  로컬 탐색과 데이터 흐름 설계는 Owner 검토가 필요합니다.
- `collect`, `judge`, 지문, baseline, 순위는 유지합니다.
- 충돌 가능성: #129 어댑터, #168 clean 출력, #193 다음 단계 안내.
  이 목록 명령의 범위를 조용히 확장하면 안 됩니다.

## 보안과 개인정보

- 보호할 정보: 소스·비밀 값, Git 기록, 절대 경로, 환경 값
- 데이터 흐름: 로컬 디렉터리/PATH 메타데이터 → 메모리 목록 → stdout.
  상대 근거 경로도 프로젝트 구조를 드러낼 수 있으므로 공유는 사용자가 결정합니다.
- 보관: 파일 쓰기, history/baseline 갱신, 백그라운드 작업 없음
- 네트워크/LLM/텔레메트리: 없음; 하위 프로세스와 버전 조회 실행도 없음
- 실패: 탐색 오류는 미완료를 명시하고 종료 2; 없는 도구는 안내와 종료 0;
  불확실한 도구 상태는 `unknown`
- 사용자 제어: 명시적으로 실행하는 명령; setup 스킬은 설치·실행 전에 동의를 구함
- 공격 사례: 터미널 이스케이프 파일명, 큰 트리, 심볼릭 링크 순환, 악성 실행 파일,
  권한 오류, 오해를 부르는 프로젝트 단서

## QA 완료 기준

| 시나리오 | 기대 결과 | 필수 근거 |
|---|---|---|
| npm + Dockerfile + Actions | 단서와 작업을 설명하고 검사 완료를 주장하지 않음 | 합성 CLI 텍스트/JSON 테스트 |
| Trivy 설치 + 컨테이너/IaC | Trivy 추천 최대 하나, 파일 비밀정보 작업 통합, Git 기록 작업 분리 | 합성 PATH 목록 테스트 |
| 빈 디렉터리 | 패키지 생태계 미탐지, 파일 비밀정보 안내, 종료 0, `not-run` | CLI 테스트 |
| 잘못된 cwd/format/인자 | 유용한 오류, 종료 2, 하위 프로세스 없음 | CLI 테스트 |
| 옛/없는/여러 잠금 파일 | 파싱 가능성을 약속하지 않고 단서와 매니저 선택 표시 | 탐색 테스트 |
| 큰 트리·깊이 한도·권한 오류 | 제한된 출력, `complete: false`, 종료 2, 결정적인 부분 탐색 | 경계 테스트 |
| 심볼릭 링크 순환/루트 밖 링크 | 루트 밖 순회·내용 읽기 없음 | 파일 시스템 테스트 |
| 실행하면 표시 파일을 만드는 가짜 실행 파일 | 존재 상태만 표시하고 표시 파일 미생성 | 하위 프로세스 금지 검증 |
| 비밀 값 형태의 내용·.git 기록 | 내용을 읽거나 출력하지 않음 | 읽기 관찰과 합성 테스트 입력 |
| 제어문자 파일명 | 이스케이프 처리한 텍스트와 유효한 JSON, 터미널 이스케이프 삽입 없음 | 출력 함수 테스트 |
| Windows PATH/POSIX 실행 권한 | 플랫폼별 `available`/`missing`/`unknown` | 플랫폼별 CI |
| 기존 명령 | 계약 테스트 변경 없이 통과 | npm test, typecheck, build |
| 배포 패키지·스킬 | 배포 패키지의 CLI 예시 실행, 설치와 검사를 혼동하지 않음 | qa, qa:agent, npm pack --dry-run |

두 README와 CLI·도움말 예시를 갱신합니다. 스킬의 한국어 요청 예시는 frontmatter에
유지하고 본문은 영어로 씁니다. 명세를 추가하는 것만으로 테스트 입력이나 스냅샷
재생성을 승인하지 않습니다.

## 에이전트 참고사항

아래 결정을 Owner가 검토하기 전에 구현하지 않습니다. 각 구현 PR은 #163과
이 명세를 연결하고 정상·오류·빈 입력·경계·공격 사례의 근거를 보고합니다.
추가 계약 변경이 필요하면 편집 전에 알립니다.

## 결정 기록

| 제안 | 고려한 대안 | 이유 / 검토 사항 |
|---|---|---|
| 명시적 하위 명령 우선 | judge에 항상 안내 | 조용한 실행 보존, #168/#193과 분리 |
| 적용 단서·설치·not-run 분리 | PATH로 covered/uncovered 결정 | 설치는 검사가 아님; 문구·JSON 계약 Owner 검토 |
| 메타데이터만 제한적으로 탐색 | 소스·이력 읽기·도구 실행 | 보안 경계를 검증 가능하게 함; 한도 Owner 검토 |
| 작업·도구별 추천 통합 | 영역마다 설치; 범용 집합 덮개 최적화 | 서로 다른 검사 모드를 지우지 않고 중복 설치 줄임 |
| 구현 전 도구 개발사의 기본값 검토 | 옛 이슈 표 그대로 복사 | Gitleaks 유지보수 상태가 달라졌으며 목록 선택은 검토 사항 |
| 별도 기능 릴리스 | 구현까지 0.0.10 보류 | 검증된 개선은 내보내고 새 계약은 리뷰 확보 |
