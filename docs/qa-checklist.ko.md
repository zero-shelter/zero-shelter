# QA 체크리스트

기능 명세와 PR에서 이 체크리스트를 사용합니다. 해당하지 않는 항목은 삭제하지 말고 이유를 적습니다.

## 자동 검증

- [ ] `npm test` 통과
- [ ] `npm run typecheck` 통과
- [ ] `npm run build` 통과
- [ ] 새 동작에 회귀 테스트 추가
- [ ] 필요한 경우 deterministic·입력 순서 동작 검증
- [ ] fingerprint/hash 변경은 무작정 snapshot을 재생성하지 않고 의도적으로 확인

## 동작 검증

| 케이스 | 확인 | 근거/링크 |
|---|---|---|
| 정상 입력 | [ ] | |
| 잘못된 입력 | [ ] | |
| 빈 입력 | [ ] | |
| 경계·대용량 입력 | [ ] | |
| 선택 dependency 없음 | [ ] | |
| Finding이 있는 scanner non-zero | [ ] | |
| 기존 baseline | [ ] | |
| 신규 Finding과 exit code | [ ] | |

## 보안과 개인정보

- [ ] 실행 중 LLM 호출을 추가하지 않음
- [ ] 문서화되지 않은 network·telemetry를 추가하지 않음
- [ ] secret·개인정보를 log·fixture·capture·report에 기록하지 않음
- [ ] 필요한 경우 redaction/hash를 테스트함
- [ ] Trust boundary와 data-flow를 문서화함
- [ ] 실패 동작을 fail-open·fail-closed·warning 중 하나로 명시함
- [ ] 악용·공격 입력을 검토함

## 호환성과 사용자 경험

- [ ] CLI option·exit code 호환성 유지 또는 breaking change 문서화
- [ ] text·JSON·SARIF·hook output 호환성 유지 또는 문서화
- [ ] README와 관련 문서 갱신
- [ ] 영어 정본 문서 갱신
- [ ] 한국어 번역 갱신 또는 차이 명시
- [ ] clean checkout 또는 package build에서 예시 명령 실행

## 근거

실행한 명령, 수동 확인 내용, 아직 확인하지 못한 내용을 적습니다.
