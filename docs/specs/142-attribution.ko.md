# 기능 사양: 소스별 finding 기여

영문 정본: [142-attribution.md](./142-attribution.md)

기존 `MergedFinding.tools`를 이용해 각 finding을 단일 소스 기여와 여러 소스 보고로 나눕니다. severity별 건수를 함께 터미널·JSON·HTML에 표시하고, 총합은 병합된 finding 수와 일치해야 합니다. 이는 스캐너의 우열이나 점수가 아니며 기존 판정·baseline 동작은 바꾸지 않습니다.
