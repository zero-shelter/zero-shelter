# 기능 사양: 곧 만료되는 수용 항목

영문 정본: [141-expiring.md](./141-expiring.md)

`zero-shelter history --expiring`는 로컬 baseline을 읽어 UTC 기준 기본 30일 안에 만료되는 수용 항목을 담당자별로 보여 줍니다. 이미 만료된 항목과 만료일이 없는 항목은 별도 구역으로 표시하며, baseline을 수정하거나 알림을 보내지 않습니다. 정상 `history` 출력은 플래그가 없으면 그대로 유지합니다.
