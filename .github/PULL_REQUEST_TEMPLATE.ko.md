## 요약

## 관련 Issue

Closes #

## GitHub metadata

- [ ] 연결된 Issue에 `status:*` label이 정확히 하나 있음
- [ ] `type:*`와 관련 `area:*` label이 적용됨
- [ ] Issue 또는 PR에 사람 Owner가 지정됨
- [ ] Agent가 도운 변경을 포함해 사람이 모든 변경 파일을 검토함
- [ ] 보호 영역 변경은 연결된 Issue/명세와 필요한 리뷰를 갖춤

## 범위

- 포함:
- 명시적 제외:

## 명세

`docs/specs/<issue>-<slug>.md` 링크를 적거나, 작은 변경이라 명세가 필요 없는 이유를 적습니다.

## 검증

[`docs/qa-checklist.ko.md`](../docs/qa-checklist.ko.md)를 사용합니다.

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] 정상 동작
- [ ] 오류·빈 입력·경계 동작
- [ ] 기존 동작·회귀

검증 근거:

## 보안과 개인정보

- [ ] 실행 중 LLM 호출을 추가하지 않음
- [ ] 문서화되지 않은 network·telemetry를 추가하지 않음
- [ ] secret·개인정보를 log·fixture·capture·report에 추가하지 않음
- [ ] 필요한 경우 data-flow와 trust boundary를 문서화함
- [ ] 필요한 경우 실패 모드를 문서화함
- [ ] 보안 제어 변경에 threat model·악용 사례 테스트가 있음

## 호환성과 문서

- [ ] CLI/API/output 호환성 확인
- [ ] 영어 정본 문서 갱신
- [ ] 한국어 번역 갱신 또는 차이 명시
- [ ] 예시 갱신

## 리뷰 참고

- 이 변경을 깨뜨릴 수 있는 입력:
- 다른 작업과 충돌할 수 있는 파일/interface:
- 알려진 한계 또는 후속 작업:
