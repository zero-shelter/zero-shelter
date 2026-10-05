# 기능 사양: 프로젝트 수준 finding policy

영문 정본: [130-policy.md](./130-policy.md)

`.zero-shelter/policy.json`에서 최소 심각도와 production/dev 범위를 지정해 반복적인
보고 필터를 관리합니다. 필터링한 항목도 raw/merge 수에는 남고 터미널과 JSON에 수와
규칙을 표시합니다. `mixed`는 무시하지 않으며, 없는 파일은 기존 출력 그대로이고,
잘못된 JSON·키·심각도·범위는 경로를 포함한 오류와 종료 코드 2를 냅니다. 점수·가중치·
baseline 의미와 네트워크 동작은 바꾸지 않습니다.
