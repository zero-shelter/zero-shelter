# 기여 가이드

[English](./CONTRIBUTING.md)

이 문서는 scanner 입력, 판정 로직, 출력 연동, agent control, 테스트, benchmark, 문서에 기여하는 모든 사람을 위한 안내입니다.

## 기여 계약

모든 변경은 다음 흐름을 따릅니다.

```text
Issue → 명세 → 구현 → QA → PR → 리뷰 → merge
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

Node.js 20 이상이 필요하며 database·service·API key·실행 중 LLM은 필요하지 않습니다.

## Issue부터 시작하기

1. 문제를 설명하는 Issue를 열거나 기존 Issue를 연결합니다.
2. 최소 범위와 변경 유형을 정합니다.
3. [`docs/feature-spec-template.ko.md`](./docs/feature-spec-template.ko.md)를 복사해 `docs/specs/<issue>-<slug>.md`를 만듭니다.
4. 입력·출력·제외 범위·영향 layer·QA·개인정보 영향을 기록합니다.
5. Issue와 PR에서 명세를 연결합니다.

작은 문서·테스트 수정은 PR 템플릿만 사용해도 되지만, 기능과 보안 제어 변경은 명세가 필요합니다.

## 첫 기여 시작하기

처음 기여한다면 큰 리팩터링보다 범위가 분명한 Issue부터 시작합니다.

1. [good first issue](https://github.com/zero-shelter/zero-shelter/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)나
   [help wanted Issue](https://github.com/zero-shelter/zero-shelter/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)를 찾습니다.
2. 바꾸려는 동작을 댓글로 설명하고, 범위나 담당자가 불분명하면 먼저 확인합니다.
3. 하나의 작업만 담은 branch를 만들고 최소 변경을 구현합니다. 동작이 바뀌면 fixture나 회귀 테스트를 추가합니다.
4. [QA 체크리스트](./docs/qa-checklist.ko.md)를 실행한 뒤 PR template을 사용해 근거와 함께 PR을 엽니다.

Agent가 이 과정을 도울 수 있지만, 범위·정확성·모든 변경 파일의 최종 검토 책임은 사람 기여자에게 있습니다. 저장소 로컬 agent 규칙은 [`AGENTS.ko.md`](./AGENTS.ko.md)에 있습니다.

## Label과 Assignee

GitHub metadata를 workflow 상태의 정본으로 사용합니다.

| Metadata | 규칙 |
|---|---|
| `status:*` | `proposed`, `accepted`, `in-progress`, `blocked`, `ready-for-review` 중 하나만 유지 |
| `type:*` | `feature`, `bug`, `security-control`, `docs`, `benchmark` 중 하나로 분류 |
| `area:*` | `ingest`, `judgment`, `agent`, `package`, `docs` 등 영향 영역 표시 |
| Assignee | Issue/PR의 현재 사람 Owner 표시 |
| GitHub state | 완료는 open/closed/merged로 확인하며 `status: done`은 만들지 않음 |

기여자는 Issue에서 예상 label과 담당자를 제안하고, triage 시 Maintainer가 적용·수정합니다. 상태를 바꿀 때는 이전 `status:*` label을 제거한 뒤 새 label을 추가합니다.

## 변경 유형

| 유형 | 예시 | 필수 근거 |
|---|---|---|
| Scanner/입력 | report 형식·adapter | fixture·parser 테스트 |
| 판정 | merge·ranking·baseline | deterministic·공격 입력 테스트 |
| 출력/연동 | JSON·SARIF·CI·hook | 사용 예시·호환성 |
| 보안 제어 | 개인정보·redaction·정책 | threat model·data-flow 리뷰 |
| Benchmark | capture·label·평가 | 재현 프로토콜·한계 |
| 문서 | README·가이드·번역 | 사실·링크 확인 |

## 기능 명세

명세는 기여자·리뷰어·maintainer·coding agent 사이의 계약입니다. 문제, 포함/제외 범위, interface, 영향 layer/파일, 호환성, 정상·오류·빈 입력·경계 조건, data-flow, 개인정보 영향, 결정 사항을 포함해야 합니다.

Agent가 초안을 작성할 수는 있지만 정확성에 대한 책임과 최종 승인은 사람 기여자에게 있습니다.

## 완료 기준

- 구현이 연결된 명세와 일치함
- 새 동작과 실패 조건을 테스트함
- `npm test`, `npm run typecheck`, `npm run build` 통과
- 사용자 동작은 수동 QA 근거가 있음
- 문서·예시가 갱신됨
- 보안·개인정보 확인 완료
- 영향 파일·interface·충돌·breaking change를 기록함
- Agent가 수정한 내용을 포함해 사람이 모든 변경 파일을 검토함
- diff에 범위 밖의 변경이 남아 있지 않음

[`docs/qa-checklist.ko.md`](./docs/qa-checklist.ko.md)와 PR template을 최종 체크리스트로 사용합니다.

## 보안·개인정보

[`SECURITY.md`](./SECURITY.md)를 먼저 읽습니다. Owner가 승인한 별도 결정이 없다면 실행 중 LLM·기본 외부 전송·secret 원문 기록·문서화되지 않은 network/telemetry를 추가하지 않습니다. 보안 제어는 fail-open/fail-closed와 공격 입력 테스트를 명시합니다.

실제 secret·개인정보·내부 URL·미공개 취약점을 public Issue·PR·fixture·capture에 넣지 않습니다.

## Branch·commit·PR

한 branch와 PR에는 하나의 논리적 변경만 담습니다.

```text
feat/<issue>-<slug> | fix/<issue>-<slug> | security/<issue>-<slug>
docs/<issue>-<slug> | test/<issue>-<slug>
```

GitHub의 공식 용어는 PR입니다. MR이라고 부르는 플랫폼에서도 같은 규칙을 적용합니다.

commit은 영어로 작성하고 다음 형식을 사용합니다.

```text
<type>(<scope>): <short summary>

Refs #123
```

## 리뷰

**변경을 깨뜨리는 입력을 말하지 못한 리뷰어는 승인하지 않습니다.**

깨지는 입력·변경 경계·보안 영향·실패 동작을 직접 확인합니다. 최소 한 명의 Maintainer가 승인해야 하며, public API breaking change·불변식·새 network/LLM/telemetry/data retention·npm release·governance 변경은 Owner 승인이 추가로 필요합니다.

## 검증 명령

| 명령 | 목적 |
|---|---|
| `npm test` | 테스트 |
| `npm run typecheck` | TypeScript 검사 |
| `npm run build` | `dist/` 빌드 |
| `npm run third-party` | 고지 재생성 |
| `npm pack --dry-run` | package 확인 |

영어가 정책과 기술 문서의 정본이며 한국어 번역은 영어 문서와 연결하고 동작 변경과 함께 갱신합니다.

관련 문서: [`GOVERNANCE.ko.md`](./GOVERNANCE.ko.md), [`SECURITY.ko.md`](./SECURITY.ko.md), [`docs/feature-spec-template.ko.md`](./docs/feature-spec-template.ko.md), [`docs/qa-checklist.ko.md`](./docs/qa-checklist.ko.md)
