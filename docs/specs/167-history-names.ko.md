# 기능 사양: 실행 사이에 추가·이탈한 finding 이름 표시

영문 정본: [167-history-names.md](./167-history-names.md)

새로 기록하는 history 행에 outstanding finding의 fingerprint·패키지·권고·severity를 저장하고, `history`의 text와 JSON에서 추가·이탈 항목의 이름을 보여 줍니다. 예전 행에는 이름이 없으므로 현재 실행에서 추측하지 않고 이름을 알 수 없다고 명시합니다. fingerprint 비교와 judge 출력은 바꾸지 않습니다.
