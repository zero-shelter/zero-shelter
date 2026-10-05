# 기계 판독 가능한 의존성 스캐너 조사

영문 정본: [scanner-survey.md](./scanner-survey.md)

2026-10-06 기준 조사입니다. trivy, grype, pip-audit, govulncheck,
cargo-audit, 기존 osv-scanner의 공식 문서를 기준으로 명령, 출력 형식, 필드 위치,
lockfile/manifest 범위와 설치 방법을 기록했습니다. SARIF는 결과를 담는 표준 컨테이너지만
패키지명·취약 범위·수정 버전·별칭·공개일의 의미까지 표준화하지 않습니다. 따라서
어댑터는 각 도구의 native JSON을 우선하고 SARIF는 도구별 매핑이 검토된 뒤 입력으로
받아야 합니다.

필드가 없는 경우도 의도적으로 기록했습니다. 메시지 문장에서 범위나 공개일을 추측하지
않고, #125의 adapter manifest에 `format`을 명시하는 것이 이번 조사 결과입니다.
