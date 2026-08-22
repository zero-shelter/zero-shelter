# Governance

[English](./GOVERNANCE.md)

이 문서는 zero-shelter의 오픈소스 운영 방식, 의사결정 권한, 리뷰 경계, 충돌 조정, release 책임을 정의합니다.

## 역할

| 역할 | 책임 | 권한 |
|---|---|---|
| Contributor | 제안·구현·테스트·문서 | Issue·PR 생성 |
| Reviewer | 가정과 근거 검증 | 범위 내 수정 요청·승인 |
| Maintainer | 분류·조정·일반 변경 merge | 필수 조건 충족 시 merge |
| Owner | 아키텍처·보안·API·release 보호 | 예약 영역 최종 결정 |

역할은 서열이 아니라 책임을 뜻합니다. 파일별 ownership은 담당 영역과 사람이 합의되기 전까지 `CODEOWNERS`에 임의로 넣지 않습니다.

## 의사결정 경계

| 변경 | 필요한 결정 |
|---|---|
| 문서·테스트·비호환 없는 구현 | CI·리뷰 후 Maintainer 1명 |
| 새 scanner/input·output 연동 | 명세·QA·layer ownership 확인 |
| CLI/package API breaking change | Owner 승인 |
| fingerprint·deterministic scoring·baseline 불변식 | Owner 설계 결정과 회귀 테스트 |
| network·LLM·telemetry·secret·개인정보 | Owner와 보안/개인정보 리뷰 |
| npm publish·version release | Owner가 통제하는 release 결정 |
| repository-wide governance | Owner 승인과 결정 근거 |

여러 경계에 걸치면 더 엄격한 규칙을 적용합니다.

## 기여 lifecycle

```text
Issue → 기능/보안 명세 → 집중 branch → PR → QA 근거 → 리뷰 → merge
```

Issue는 문제 정의, 명세는 동작 계약, PR은 구현과 근거입니다.

## Workflow metadata

변경되는 상태를 spec에 중복 기록하지 않고 GitHub label과 Assignee를 정본으로 사용합니다.

- `status:*`는 `proposed`, `accepted`, `in-progress`, `blocked`, `ready-for-review` 중 하나만 유지
- `type:*`와 `area:*`는 검색과 triage를 위한 분류
- Issue/PR Assignee는 현재 사람 Owner
- 완료는 open/closed/merged로 확인하고 `status: done`은 사용하지 않음

Label 정리는 Maintainer의 책임입니다. 상태를 변경할 때 기존 lifecycle label을 먼저 제거합니다.

## Merge 정책

Maintainer는 범위·영향 layer·CI·QA·보안/개인정보·문서·충돌 상태가 확인된 경우에만 merge합니다. 리뷰어는 깨지는 입력을 설명하거나 시도한 범위와 깨지지 않은 이유를 설명할 수 있어야 합니다.

## 공유 계약과 충돌

Finding field·alias·fingerprint, score·baseline, CLI option·exit code·output schema, hook payload, publish file을 바꾸면 공유합니다. 같은 계약을 두 변경이 건드리면 하나의 interface를 먼저 합의합니다.

## 보안과 release

보안 변경은 [`SECURITY.md`](./SECURITY.md)를 따릅니다. 보호 데이터·trust boundary·data-flow·보존·실패 모드·악용 사례·테스트·사용자 제어를 기록합니다.

npm release는 Owner 또는 명시적으로 위임받은 Maintainer가 수행하는 외부 작업입니다. release 전에 test·typecheck·build·package·CLI/hook smoke test·version·호환성·README·번역이 일치해야 합니다.

## 의견 충돌

결정은 Issue나 PR에 남깁니다. 불변식·public contract·보안 경계·release 정책을 바꾸면 선택지와 근거를 설계 문서로 기록합니다.

관련 문서: [`CONTRIBUTING.ko.md`](./CONTRIBUTING.ko.md), [`SECURITY.ko.md`](./SECURITY.ko.md), [`docs/feature-spec-template.ko.md`](./docs/feature-spec-template.ko.md), [`docs/qa-checklist.ko.md`](./docs/qa-checklist.ko.md)
