# Security and Privacy

[English](./SECURITY.md)

zero-shelter는 dependency Finding을 판정하고 Agent에 짧은 context를 전달할 수 있습니다. 사용자가 명시적으로 외부 연동을 선택하지 않는 한 프로젝트 데이터가 로컬에 남는 trust boundary를 지켜야 합니다.

## 반드시 지키는 기본값

- 실행 중 LLM 호출 금지
- telemetry와 문서화되지 않은 network 요청 금지
- 프로젝트 파일·prompt·Finding·secret·개인정보를 기본값으로 외부 전송하지 않음
- secret 원문을 log·fixture·benchmark capture·report에 기록하지 않음
- 개인정보는 가능한 이른 지점에서 최소화·redaction·hash
- fail-open/fail-closed를 명시
- 사용자 동작과 data-flow를 문서화

scanner 자체에는 network 동작이 있을 수 있습니다. 그 경계를 정확히 설명하고 프로젝트가 숨은 traffic을 추가하지 않도록 합니다.

## 취약점 신고

공개되지 않은 취약점을 public Issue나 PR로 올리지 않습니다. [조직 보안 정책](https://github.com/zero-shelter/.github/blob/main/SECURITY.md)을 따르고 재현 방법·영향 버전/commit·영향도·안전한 연락 경로를 비공개로 전달합니다.

## 보안 제어 기여

개인정보·secret·prompt·권한·subprocess·network·보안 정책을 바꾸는 PR은 다음을 포함한 명세가 필요합니다.

| 필수 항목 | 질문 |
|---|---|
| 보호 데이터 | 무엇이 민감한가? |
| Trust boundary | 어떤 process/service가 볼 수 있는가? |
| Data-flow | 어디서 생성·변환·저장·출력되는가? |
| 보존 | 어디에 얼마나 오래 남는가? |
| 실패 모드 | block·warning·fail-open 중 무엇인가? |
| 악용 사례 | 어떤 악성 입력을 테스트했는가? |
| 사용자 제어 | 기본값과 opt-in/out은 무엇인가? |

공격 입력 테스트와 reviewer 근거도 PR에 포함합니다.

## 공개 기여의 안전

실제 secret·개인정보·내부 URL·고객 데이터·미공개 취약점 상세를 commit하지 않습니다. synthetic fixture와 redacted example을 사용합니다. 민감정보를 발견하면 복사해 Issue에 올리지 말고 비공개 보안 경로로 알립니다.

## 현재 범위

현재 v1은 dependency scanning·판정·baseline ratchet·SARIF 출력·비차단 agent hook을 제공합니다. 완전한 SAST·secret scanning·prompt intent detection·privacy compliance 자체를 보장하지는 않습니다.

향후 제어 기능은 명시적 명세·threat model·테스트·Owner 승인을 거쳐 추가합니다.
