# 기여 가이드

[English](./CONTRIBUTING.md)

스캐너 입력, 판정 로직, 출력 연동, 에이전트 제어, 테스트, 벤치마크, 문서에 기여할 때 따르는 안내입니다.

## 기여 절차

모든 변경은 다음 흐름을 따릅니다.

```text
Issue → 명세 → 구현 → QA → PR → 리뷰 → 병합
```

작성자가 아닌 사람이 읽어도 동작·검증 근거·보안 영향·문서를 이해할 수 있어야 기여가 완료됩니다.

## 빠른 시작

```bash
git clone https://github.com/zero-shelter/zero-shelter.git
cd zero-shelter
npm ci
npm test
npm run typecheck
npm run build
```

Node.js 20 이상이 필요합니다. 별도의 데이터베이스, 서비스, API 키나 실행 중 LLM 호출은 필요하지 않습니다.

## Issue부터 시작하기

1. 문제를 설명하는 Issue를 열거나 기존 Issue를 연결합니다.
2. 최소 범위와 변경 유형을 정합니다.
3. [`docs/feature-spec-template.ko.md`](./docs/feature-spec-template.ko.md)를 복사해 `docs/specs/<issue>-<slug>.md`를 만듭니다.
4. 입력·출력·제외 범위·영향 계층·QA·개인정보 영향을 기록합니다.
5. Issue와 PR에서 명세를 연결합니다.

작은 문서·테스트 수정은 PR 템플릿만 사용해도 되지만, 기능과 보안 제어 변경은 명세가 필요합니다.

## 첫 기여 시작하기

처음 기여한다면 큰 리팩터링보다 범위가 분명한 Issue부터 시작합니다.

1. [good first issue](https://github.com/zero-shelter/zero-shelter/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)나
   [help wanted Issue](https://github.com/zero-shelter/zero-shelter/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)를 찾습니다.
2. 바꾸려는 동작을 댓글로 설명하고, 범위나 담당자가 불분명하면 먼저 확인합니다.
3. 하나의 작업만 담은 브랜치를 만들고 최소 변경을 구현합니다. 동작이 바뀌면 테스트 입력 예시나 회귀 테스트를 추가합니다.
4. [QA 체크리스트](./docs/qa-checklist.ko.md)를 실행합니다. 베타 버전에 영향을 주는 변경은 [베타 QA 안내](./docs/qa/README.md)도 따릅니다. PR 템플릿을 사용해 검증 근거와 함께 PR을 엽니다.

포크 PR은 Maintainer가 첫 워크플로 실행을 승인할 때까지 GitHub가 CI를 보류할 수 있습니다. 검사가 계속 시작되지 않으면 PR에 댓글을 남겨 주세요. 워크플로 실행 승인과 변경 내용에 대한 리뷰 승인은 별개입니다.

에이전트가 이 과정을 도울 수 있지만, 범위·정확성·모든 변경 파일의 최종 검토 책임은 사람 기여자에게 있습니다. 저장소의 에이전트 규칙은 [`AGENTS.ko.md`](./AGENTS.ko.md)에 있습니다.

## 라벨과 담당자

작업 상태와 담당자는 GitHub 라벨과 Assignee에서 관리합니다.

| 항목 | 규칙 |
|---|---|
| `status:*` | `proposed`, `accepted`, `in-progress`, `blocked`, `ready-for-review` 중 하나만 유지 |
| `type:*` | `feature`, `bug`, `security-control`, `docs`, `benchmark` 중 하나로 분류 |
| `area:*` | `ingest`, `judgment`, `agent`, `package`, `docs` 등 영향 영역 표시 |
| Assignee | Issue/PR의 현재 사람 Owner 표시 |
| GitHub state | 완료는 open/closed/merged로 확인하며 `status: done`은 만들지 않음 |

기여자는 Issue에서 예상 라벨과 담당자를 제안하고, 분류할 때 Maintainer가 적용·수정합니다. 상태를 바꿀 때는 이전 `status:*` 라벨을 제거한 뒤 새 라벨을 추가합니다.

## 변경 유형

| 유형 | 예시 | 필수 근거 |
|---|---|---|
| 스캐너/입력 | 보고서 형식·어댑터 | 테스트 입력 예시·파서 테스트 |
| 판정 | 병합·순위·baseline | 동일 입력의 결과 일치·공격 입력 테스트 |
| 출력/연동 | JSON·SARIF·CI·hook | 사용 예시·호환성 |
| 보안 제어 | 개인정보·민감정보 제거·정책 | 위협 모델·데이터 흐름 리뷰 |
| 벤치마크 | 수집 자료·평가 라벨·평가 | 재현 절차·한계 |
| 문서 | README·가이드·번역 | 사실·링크 확인 |

## 기능 명세

명세에는 문제, 포함·제외 범위, 인터페이스, 영향 계층과 파일, 호환성, 정상·오류·빈 입력·경계 조건, 데이터 흐름, 개인정보 영향, 결정 사항을 적습니다. 기여자, 리뷰어, Maintainer와 에이전트가 이 내용을 기준으로 작업합니다.

에이전트가 초안을 작성할 수는 있지만 정확성에 대한 책임과 최종 승인은 사람 기여자에게 있습니다.

## 완료 기준

- 구현이 연결된 명세와 일치함
- 새 동작과 실패 조건을 테스트함
- `npm test`, `npm run typecheck`, `npm run build` 통과
- 사용자 동작은 수동 QA 근거가 있음
- 문서·예시가 갱신됨
- 보안·개인정보 확인 완료
- 영향 파일·인터페이스·충돌·호환성이 깨지는 변경을 기록함
- 에이전트가 수정한 내용을 포함해 사람이 모든 변경 파일을 검토함
- diff에 범위 밖의 변경이 남아 있지 않음

[`docs/qa-checklist.ko.md`](./docs/qa-checklist.ko.md)와 PR 템플릿을 최종 체크리스트로 사용합니다.

## 보안·개인정보

보안 동작을 바꾸기 전에 [`SECURITY.ko.md`](./SECURITY.ko.md)를 읽습니다. Owner가 승인한 별도 설계 결정이 없다면 다음 요건을 지킵니다.

- 실행 중 LLM을 호출하지 않습니다.
- 프로젝트 데이터·프롬프트·발견 사항·비밀정보를 기본값으로 외부에 보내지 않습니다.
- 로그·테스트 입력·벤치마크 수집 자료·보고서에 비밀정보 원문을 남기지 않습니다.
- 문서화되지 않은 네트워크 요청이나 텔레메트리를 추가하지 않습니다.
- 보안 제어는 실패 시 허용하는지(fail-open), 차단하는지(fail-closed) 명시합니다.
- 개인정보를 다루는 동작에는 공격 입력 테스트를 포함합니다.

실제 비밀정보·개인정보·내부 URL·미공개 취약점을 공개 Issue·PR·테스트 입력·수집 자료에 넣지 않습니다.

## 브랜치·커밋·PR

한 브랜치와 PR에는 하나의 논리적 변경만 담습니다.

```text
feat/<issue>-<slug> | fix/<issue>-<slug> | security/<issue>-<slug>
docs/<issue>-<slug> | test/<issue>-<slug>
```

GitHub의 공식 용어는 PR입니다. MR이라고 부르는 플랫폼에서도 같은 규칙을 적용합니다.

커밋은 영어로 작성하고 다음 형식을 사용합니다.

```text
<type>(<scope>): <short summary>

Refs #123
```

병합과 함께 Issue를 닫아야 할 때만 `Fixes #123`을 사용합니다. PR은 정한 작업 범위에 맞춥니다.

## 리뷰

리뷰어는 변경을 깨뜨리는 입력을 설명할 수 있어야 승인합니다.

실패하는 입력을 시도하고 변경된 경계와 확인한 내용을 기록합니다. 보안 제어 변경은 데이터 흐름, 로그, 하위 프로세스, 권한, 실패 동작도 검토합니다.

최소 한 명의 Maintainer 승인이 있어야 병합할 수 있습니다. 공개 API의 호환성이 깨지는 변경, 결정적 판정·지문의 불변식, 새 네트워크·LLM·텔레메트리·데이터 보존 동작, npm 릴리스, 저장소 전체 운영 규칙 변경에는 Owner 승인도 필요합니다.

## 검증 명령

| 명령 | 목적 |
|---|---|
| `npm test` | 테스트 |
| `npm run typecheck` | TypeScript 검사 |
| `npm run build` | `dist/` 빌드 |
| `npm run third-party` | 고지 재생성 |
| `npm pack --dry-run` | 패키지 내용 확인 |
| `npm run qa:agent` | hook·스킬 5개·HTML 프롬프트·플러그인 명세 검증 |

영어가 정책과 기술 문서의 정본이며 한국어 번역은 영어 문서와 연결하고 동작 변경과 함께 갱신합니다.

관련 문서: [`GOVERNANCE.ko.md`](./GOVERNANCE.ko.md), [`SECURITY.ko.md`](./SECURITY.ko.md), [`docs/feature-spec-template.ko.md`](./docs/feature-spec-template.ko.md), [`docs/qa-checklist.ko.md`](./docs/qa-checklist.ko.md)

취약점 신고는 [조직 보안 정책](https://github.com/zero-shelter/.github/blob/main/SECURITY.md)을 따릅니다. 호환성 기준은 [`docs/STABILITY.md`](./docs/STABILITY.md)에 있습니다.

## 언어 추가하기

HTML 보고서 언어를 추가하려면 다음을 수정합니다.

1. `src/messages.ts`에 번역 목록을 추가합니다. `Messages` 타입이 빠진 키를 검사합니다.
2. 언어 코드를 `LANGUAGES`와 `src/cli.ts` 사용법의 `--lang` 줄에 넣습니다. 테스트에서 `--help`가 지원 언어를 모두 표시하는지 확인합니다.
3. 오른쪽에서 왼쪽으로 쓰는 언어라면 `src/html.ts`의 `RIGHT_TO_LEFT`에 코드를 추가합니다. 레이아웃은 CSS 논리 속성을 사용합니다.

터미널 출력과 코드 블록은 번역하지 않습니다. 패키지명, 취약점 식별자, 명령은 그대로 유지합니다. 숫자는 일반 정수로 표시하므로 로케일이 달라도 보고서를 비교할 수 있습니다.

`skills/*/SKILL.md` 본문은 영어를 유지합니다. 한국어 요청과 연결할 수 있도록 frontmatter의 `description`에 한국어 요청 예시를 넣습니다. 에이전트는 사용자가 쓴 언어로 답합니다.

```yaml
description: ... Korean requests look like: 의존성 취약점 점검해줘, 보안 스캔 돌려줘.
```

## 문서와 공개 기록 작성

문제와 관찰할 수 있는 동작을 먼저 설명합니다. 측정값에는 조건과 출처를 적고, 현재 동작과 제안을 구분합니다. 과거 글을 고칠 때는 명령, 재현 방법, 기술 근거, 작성자와 결정 기록을 보존합니다.

자동 검사, 에이전트 검토, 사람의 승인을 구분해서 적습니다. 실행하지 않은 검사나 받지 않은 승인을 완료했다고 쓰지 않습니다. 게시 전 빈 템플릿 안내를 지우고, 필수 검사가 해당하지 않으면 이유를 적습니다. 같은 요약을 반복하거나 근거 없이 사용자 경험을 일반화하지 않습니다. 한국어 번역은 의미를 유지하면서 자연스러운 문장으로 씁니다.
