# 운영 규칙

[English](./GOVERNANCE.md)

이 문서는 zero-shelter의 오픈소스 운영 방식, 의사결정 권한, 리뷰 경계, 충돌 조정, 릴리스 책임을 정의합니다.

## 역할

| 역할 | 책임 | 권한 |
|---|---|---|
| Contributor | 제안·구현·테스트·문서 | Issue·PR 생성 |
| Reviewer | 가정과 근거 검증 | 범위 내 수정 요청·승인 |
| Maintainer | 분류·조정·일반 변경 병합 | 필수 조건 충족 시 병합 |
| Owner | 아키텍처·보안·API·릴리스 보호 | 별도 승인이 필요한 영역 최종 결정 |

역할은 책임과 결정 권한을 정의합니다. `CODEOWNERS`의 파일별 담당자는 담당 영역과 사람에 대한 합의를 거쳐 지정합니다.

## 의사결정 경계

| 변경 | 필요한 결정 |
|---|---|
| 문서·테스트·비호환 없는 구현 | CI·리뷰 후 Maintainer 1명 |
| 새 스캐너 입력·출력 연동 | Maintainer의 명세·QA·계층별 담당자 확인 |
| CLI·패키지 API의 호환성이 깨지는 변경 | Owner 승인 |
| 지문·결정적 점수 계산·baseline 불변식 | Owner 설계 결정과 회귀 테스트 |
| 네트워크·LLM·텔레메트리·비밀정보·개인정보 | Owner와 보안/개인정보 리뷰 |
| npm 배포·버전 릴리스 | Owner가 통제하는 릴리스 결정 |
| 저장소 전체 운영 규칙 | Owner 승인과 결정 근거 |

여러 경계에 걸치면 더 엄격한 규칙을 적용합니다.

## 기여 절차

```text
Issue → 기능/보안 명세 → 작업별 브랜치 → PR → QA 근거 → 리뷰 → 병합
```

Issue는 문제 정의, 명세는 동작 계약, PR은 구현과 근거입니다.

## 작업 상태와 담당자

작업 상태와 담당자는 GitHub 라벨과 Assignee에서 관리하며 명세에 중복 기록하지 않습니다.

- `status:*`는 `proposed`, `accepted`, `in-progress`, `blocked`, `ready-for-review` 중 하나만 유지
- `type:*`와 `area:*`는 검색과 작업 분류에 사용
- Issue/PR Assignee는 현재 사람 Owner
- 완료는 open/closed/merged로 확인하고 `status: done`은 사용하지 않음

라벨 정리는 Maintainer의 책임입니다. 상태를 변경할 때 기존 상태 라벨을 먼저 제거합니다.

## 병합 정책

Maintainer는 범위·영향 계층·CI·QA·보안/개인정보·문서·충돌 상태가 확인된 경우에만 병합합니다. 리뷰어는 승인하기 전에 변경을 깨뜨리는 입력을 설명할 수 있어야 합니다.

자동 검사와 에이전트 검토는 검증 근거이며, 필요한 사람의 승인을 대신하지 않습니다.

## 공유 계약과 충돌

발견 사항의 필드·별칭·지문, 점수·baseline, CLI 옵션·종료 코드·출력 스키마, hook 입력, 배포 파일을 바꾸면 공유합니다. 같은 계약을 두 변경이 건드리면 하나의 인터페이스를 먼저 합의합니다.

## 보안과 릴리스

보안 변경은 [`SECURITY.md`](./SECURITY.md)를 따릅니다. 보호 데이터·신뢰 경계·데이터 흐름·보존·실패 동작·악용 사례·테스트·사용자 제어를 기록합니다.

npm 릴리스는 Owner 또는 명시적으로 위임받은 Maintainer가 수행하는 외부 작업입니다. 릴리스 전에 테스트·타입 검사·빌드·패키지 내용·CLI와 hook 기본 동작 검사·버전·호환성·README·번역이 일치해야 합니다.

## 의견 충돌

결정은 Issue나 PR에 남깁니다. 불변식·공개 계약·보안 경계·릴리스 정책을 바꾸면 구현 전에 선택지와 근거를 짧은 설계 문서로 기록합니다.

관련 문서: [`CONTRIBUTING.ko.md`](./CONTRIBUTING.ko.md), [`SECURITY.ko.md`](./SECURITY.ko.md), [`docs/feature-spec-template.ko.md`](./docs/feature-spec-template.ko.md), [`docs/qa-checklist.ko.md`](./docs/qa-checklist.ko.md)

베타 검증 절차는 [QA 안내](./docs/qa/README.md)에 있습니다.
