# 현재 실행 계획

현행 단일 단계·역할/완료 조건은 [Issue Lifecycle](../../ISSUE_LIFECYCLE.md)이다. 모든 위험도에서 로컬 검증 후 main 직접 fast-forward Push·승인된 수동 GHCR·수동 종료를 사용하며 PR·원격 CI·Trusted QA·자동 Finalizer를 실행하지 않는다.

## #906 / #908 통합 구현

[통합 Work Packet](ISSUE_906_908.md)을 따른다. 현행 정책·템플릿/Agent 지침과 기존 로컬 실행기·source admission을 통합한다. 실제 구현/테스트·최초 실패·Push/GHCR·미게시/미배포·Owner 결정은 Packet과 단일 실패 원장에 기록한다. 과거 main/PR 성공을 새 source PASS로 사용하지 않는다.

## 선행과 병행

- #907: append-only 원장·교차 Regression Index 전체 규격/검증; 현행 [최소 검색 인덱스](../../REGRESSION_INDEX.md)와 구분한다.
- #909: 인증된 로컬 Build-once→수동 GHCR→exact digest smoke·정상 이미지 보존.
- #911: 첫 direct Push 이전 Owner 관리자 live Ruleset/Actions 전환·자동 Run 0건 실증. 문서 변경만으로 완료되지 않는다.
- #912: 일관 백업·새 격리 volume 복원·호환 DB+image·off-host 실증. 데이터 위험 배포의 사전조건.

기존 open PR과 제품 변경은 Owner가 개별 채택/재작업/미채택을 판단하며 일괄 종료·무검증 병합하지 않는다. 이전 실행 계획 전체와 당시 승인 범위/미검증은 [보존 기록](../../history/owner-ci-retired-20261110/ACTIVE_PLAN.md)에 있다. 이전 Work Packet의 PR/CI 단계는 그 당시 기록이며 신규 재개는 현행 Lifecycle로 새 범위를 정한다.
