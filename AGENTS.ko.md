# 에이전트 기여 규칙

[English](./AGENTS.md)

이 문서는 coding agent를 위한 저장소 로컬 규칙입니다. 작업 범위·정확성·최종 검토의 책임은 여전히 사람 기여자에게 있습니다.

## 수정하기 전에

- [`CONTRIBUTING.ko.md`](./CONTRIBUTING.ko.md), [`GOVERNANCE.ko.md`](./GOVERNANCE.ko.md),
  [`SECURITY.ko.md`](./SECURITY.ko.md)와 연결된 Issue 또는 명세를 읽습니다.
- 작업 트리를 확인하고 이미 존재하는 변경을 보존합니다.
- 연결된 Issue나 명세에 필요한 내용만 수정합니다. 무관한 리팩터링·포맷팅·의존성 업데이트·정리는 추가하지 않습니다.

## 보호되는 경계

판정 계약(`src/triage.ts`, `src/merge.ts`, `src/fingerprint.ts`,
`src/baseline.ts`)이나 공개 경계(`src/cli.ts`, `src/report.ts`,
`src/sarif.ts`, `src/hook.ts`, `package.json`, `.github/`, `skills/`)를
바꾸려면 명시적인 범위와 거버넌스에서 정한 리뷰가 필요합니다.

테스트나 리포트를 보기 좋게 만들기 위해 ranking 가중치, fingerprint,
baseline 의미, exit code, output schema, hook 동작을 바꾸지 않습니다.

## 경계를 넘을 때 임의로 결정하지 않기

다음 상황에서는 멈추고 사람에게 확인합니다.

- Issue나 명세 범위를 벗어나거나 shared contract를 변경할 때
- runtime dependency, network/LLM/telemetry, release/publish 동작을 추가할 때
- secret이나 개인정보를 다룰 때
- 다른 기여자의 변경과 충돌하거나 담당자가 불분명할 때

Issue에서 명시하지 않았다면 `npm audit fix` 실행, lockfile 업데이트,
`--update-baseline` 사용, snapshot·fixture·capture·benchmark label 재생성을
하지 않습니다. 다른 기여자의 변경을 편하게 만들기 위해 reset·clean·덮어쓰기를 하지 않습니다.

실제 secret·개인정보·내부 URL·미공개 취약점 내용을 commit하지 않습니다.

## 검증

코드나 동작을 바꾼 경우 다음을 실행합니다.

```bash
npm test
npm run typecheck
npm run build
```

문서만 바꾼 경우에는 `git diff --check`를 실행하고 변경된 링크와 사용자에게
보이는 설명을 확인합니다.

package나 설치 동작을 바꾼 경우, 해당 script가 있으면 `npm run qa`도 실행합니다.
CLI나 package 변경이면 `npm pack --dry-run`과 배포 package smoke test도 확인합니다.

사람 기여자는 모든 변경 파일을 검토하고, 확인하지 못한 내용을 보고합니다.
사용자에게 보이는 동작이 바뀌면 영어 정본 문서와 한국어 번역도 함께 갱신합니다.
