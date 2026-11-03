# 기능 사양: pnpm lockfile 의존성 맥락

영문 정본: [156-pnpm-context.md](./156-pnpm-context.md)

pnpm이 생성한 lockfile의 패키지·snapshot·importer 정보를 읽어 기존
`InstalledVersions` 계약에 버전, production/dev 범위, 의존성 연결, 설치 스크립트를
채웁니다. lockfile 5·6·9 형식을 지원하고 Yarn은 포함하지 않습니다. 지원하지 않는
형식이나 읽을 수 없는 파일은 추측하지 않고 lockfile 기반 주장을 보류합니다. 런타임
YAML 의존성, 네트워크, subprocess, 소스·manifest 읽기는 추가하지 않습니다.
