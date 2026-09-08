# 서드파티 구성요소

[English](./THIRD_PARTY.md) · [한국어](./THIRD_PARTY.ko.md)

직접 의존성을 `package-lock.json`에 기록된 버전과 함께 표시합니다.
`npm run third-party`로 재생성하며, 파일이 생성 결과와 다르면 CI가 실패합니다.

간접 의존성과 GitHub Actions는 포함하지 않습니다.

| 번호 | 라이브러리명 | 버전 | 라이선스 | 공식 저장소 URL | 사용 목적 및 주요 기능 |
|---|---|---|---|---|---|
| 1 | @types/node | 22.20.1 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | 개발·빌드 도구 |
| 2 | typescript | 5.9.3 | Apache-2.0 | https://github.com/microsoft/TypeScript | 개발·빌드 도구 |
| 3 | vitest | 4.1.11 | MIT | https://github.com/vitest-dev/vitest | 개발·빌드 도구 |

## 외부 실행 도구

별도 프로세스로 호출합니다. 아래 도구의 코드는 이 패키지에 포함되지 않습니다.

| 도구 | 사용 조건 | 사용 방식 |
|---|---|---|
| npm CLI (`npm audit`) | npm / Yarn 프로젝트 | `npm audit --json`으로 실행하고 출력만 읽습니다. |
| pnpm CLI (`pnpm audit`) | pnpm 프로젝트 | pnpm 락파일을 확인하면 `pnpm audit --json`으로 실행합니다. |
| [osv-scanner](https://github.com/google/osv-scanner) | `PATH`에 설치된 경우 | 없으면 건너뛴 이유를 표시합니다. |

이 프로젝트 자체는 Apache-2.0으로 배포됩니다. `LICENSE`를 보세요.
