# Milestone Timeline — Adapter 연동 경계

현재 main에는 #549~#553의 표시 분리 stack이 병합되지 않았다. 이 문서는 #569의 좌표/기하 adapter 설계 경계만 기록하며 기존 Milestone 행·필터·조회·권한 계약을 바꾸지 않는다. #549/PR stack의 전체 표시 모델은 해당 exact source와 함께 별도 통합해야 한다.

[Adapter ADR](GANTT_ADAPTER_ADR.md)에 따라 같은 Chart의 controlled origin/unit/cellWidth와 native scroll owner를 기준으로 날짜 좌표를 검증한다. Timeline에 독립 scroll authority를 만들지 않는다. 지원 범위는 균일한 단일 scale 행의 Day/Week이며 실제 tick 폭이 설정과 다른 짧은 축은 거부한다. 날짜 anchor와 native bar/tick ≤1 CSSpx 및 Grid가 보이는 경우의 행/bar y정렬을 실제 Chromium에서 확인한다.

hidden/inert/zero-size에서는 측정·복원하지 않는다. 390px의 native capacity 부족은 NO_SCROLL_CAPACITY로 분리하고 기존 목록/Editor 조회 경로를 유지한다. 잘못된 오늘 날짜 보정이나 자동 전체 범위 확대를 하지 않는다. PoC의 Chart 공간 확대 후 회복과 구체적인 제품 fallback UI는 별개이며 후자는 #551 통합 gate에서 확정한다.

Milestone-only/empty는 canonical의 서로 다른 상태이며 Task identity·Summary rollup·Membership/Dependency를 변경하지 않는다. #569 PoC의 M-only 모형은 #551의 전체 lane 사용성 PASS를 대신하지 않는다. 비교 #551 회귀는 PR #562의 고정 source로 별도 기록한다. 전체 폭의 반복 확장 지원은 확인되지 않았으므로 adapter의 제품 도입은 DEFER다.
