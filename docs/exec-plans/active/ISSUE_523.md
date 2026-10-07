# Issue #523 — Resource KPI 공통 Domain

## Issue Work Packet

- Issue: [#523](https://github.com/planner77/masterGantt/issues/523), Epic [#522](https://github.com/planner77/masterGantt/issues/522).
- Lifecycle: IMPLEMENTATION → DOCUMENTATION_SYNC → PRE_QA → PR / CI 시작. CI 모니터링·병합·main/GHCR·tag·branch cleanup·Issue 종료는 이번 요청 범위 밖이다.
- Baseline main/head: `f3373386d084bad5973b88180cd04ee9778e4fd6`; branch `feat/issue-523-resource-kpi`.
- Existing PR/remote branch: 착수 시 없음. application `0.95.1` → MINOR `0.96.0` (하위 호환 신규 Domain 기능).
- `release_required=true`, `release_authorized=false`. 정식 게시 승인은 없으며 PR 단계까지만 요청되었다.
- Scope/AC: Issue 원문의 일반 Task 개인 Assignment grain, distinct Task/Resource, raw M/D·M/M, effective Milestone, full canonical Ready, null/partial, 별도 T0 미배정 진단, permutation/중복/Calendar/legacy 회귀 전부.
- Non-scope: UI/API 공개, DB migration, 실적·금액·FTE·기간 capacity, WBS/Membership mutation.
- Dependency: 기존 #261 Resource Calendar와 #460–#464 canonical Membership/Stage helper. 후속 #524는 이 브랜치 기반 stacked PR로 진행한다.

## 소유권과 검증

- Manager: PLAN/CHANGELOG/package version, Issue PLAN/STATUS 댓글과 단계 판단.
- backend: Domain/types/fixtures/tests, pure M/M helper 이동 및 server compatibility re-export, 관련 문서 작성.
- scheduler: 계산 helper/계약 read-only 검토. qa_docs: DOCUMENTATION_SYNC 이후 독립 read-only 사전 검토. infra: commit/push/PR/CI 등록.
- 공유 파일의 동시 쓰기와 재귀 Agent 위임은 금지한다. Issue 댓글 작성자는 Manager이며 Sub-Agent 허용 유형은 NONE이다.
- Local Fast Feedback: 직접 관련 Domain·legacy workload·MD/MM fixture, typecheck/lint. 원격 quality/e2e/docker 결과는 NOT TESTED로 유지하며 CI 등록만 확인한다.
- Required docs: RESOURCE_KPI_DASHBOARD/REQUIREMENTS/ARCHITECTURE/SCHEDULING_ENGINE/ISSUE_56_RESOURCE_WORKLOAD/ISSUE_414_ROLE_WORKLOAD_DASHBOARD/MILESTONE_STAGE_GATES/TEST_PLAN 및 이 계획·active PLAN·CHANGELOG.
- N/A: API/DB_SCHEMA/SECURITY/DESIGN/AGENTS/공통 UI 가이드: 외부 endpoint·schema·권한·화면 계약 변경 없음. 실제 diff에서 영향이 생기면 재평가한다.
- 환경별 Windows Excel/운영 proxy·배포/최종 수동 UX는 비범위이며 이번 PASS로 주장하지 않는다.

## 실행 기록

구현과 DOCUMENTATION_SYNC는 PASS다. backend의 관련 8파일 98테스트는 2026-10-07 23:43:57 KST 최종 fixture 실행 PASS(943ms)이며 실제 native SQLite legacy 1.3333 M/D·19일 기준 0.0702 M/M 정밀도 회귀를 포함한다. 초기 raw float literal 기대값 4 FAIL 및 canonical fixture 보완 뒤 stale 기대값 2 FAIL은 수정 전 이력으로 보존하며 최종 PASS로 숨기지 않는다. scheduler의 Domain source 계산 검토는 PASS이며 source SHA256은 `6c29d9b7a2db7cbf2f463f8a0ccf90dfbaf48e76d26031ddab1a5ae11512b3af`다.

기존 M/M helper는 pure Domain으로 옮기고 server re-export shim으로 기존 caller 계약을 유지한다. actual 신규 API/DB/권한/UI/Calendar 원장 변경이 없어 관련 N/A 근거가 유지된다. pure input timezone은 현재 Project 계약의 Asia/Seoul을 유지한다.

typecheck·변경 파일 ESLint·diff 검사·142파일 Markdown link 검사는 PASS다. 최종 fixture는 실제 DeveloperGrade ADVANCED/INTERMEDIATE와 canonical Summary 파생값을 사용한다.

다음은 동일 source tree의 독립 qa_docs 사전 검토와 원격 게시다. PR CI quality/e2e/docker·최종 QA·Manager ACCEPT는 NOT TESTED다.
