# Issue #574 — Marker-OFF V1~V8 통합 검증

Related Issue: https://github.com/planner77/masterGantt/issues/574
Primary Issue: https://github.com/planner77/masterGantt/issues/507

사용자 요청으로 #507과 하나의 PR에서 수행한다. 기준 main `8d6d3ba7a47e6df08c509baad6eedcc2adee1407`, application `0.138.4`, Core `2.7.3`. 역할·분석/설계·AC_TEST_COVERAGE·DOCUMENTATION_SYNC·실행과 남은 범위의 단일 원본은 [#507 Work Packet](ISSUE_507.md), 실패의 단일 원본은 [#507 누적 원장](../../ISSUE_507_FAILURE_ANALYSIS.md)이다.

#852/#860 배포를 V1~V8 전체 수용으로 확대하지 않는다. #573/#693 marker ON은 비차단이며 새 marker/Coordinator/Export 기능을 중복 구현하지 않는다. 기존 원본 assertion을 유지하고 clipboard·filter0/최신 선택 등 증거 공백만 보강한다. 실제 source별 실행과 미검증 조합은 Gantt 정합·Milestone 추적·WBS 교차 수용표에 연결한다. Full PR CI/Trusted QA/Owner·Manager의 최종 수용은 별도 NOT TESTED다.
