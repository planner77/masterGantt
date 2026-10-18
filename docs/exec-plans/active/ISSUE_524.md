# Issue #524 — Resource KPI 조회 API와 동일 snapshot

## Issue Work Packet

- Issue: [#524](https://github.com/planner77/masterGantt/issues/524), Epic [#522](https://github.com/planner77/masterGantt/issues/522).
- Lifecycle: IMPLEMENTATION → DOCUMENTATION_SYNC → PRE_QA → 원격 PR / CI 시작. CI 결과 모니터링·병합·main/GHCR·tag·cleanup·Issue 종료는 이번 요청 범위 밖이다.
- 착수 최신 main: `f3373386d084bad5973b88180cd04ee9778e4fd6`. 직접 선행 branch `feat/issue-523-resource-kpi`, exact head `f8a51503745cd5f3f1f3c9986f6b7577d83ce93a`를 기반으로 stacked branch `feat/issue-524-resource-dashboard-api`를 생성한다. PR base는 `feat/issue-523-resource-kpi`다.
- Version: `0.96.0` → MINOR `0.97.0`. 하위 호환 신규 기능이며 package/lockfile/CHANGELOG를 동기화한다.
- `release_required=true`, `release_authorized=false`; 정식 게시 승인은 없고 PR 단계까지만 요청되었다.
- 목표·AC: Issue 원문 전체와 [Resource KPI 계약](../../RESOURCE_KPI_DASHBOARD.md)을 따른다. 선행 구현과 동일 raw 계산·scope·distinct ID·snapshot/null 의미를 유지한다.
- Non-scope: UI·기간 capacity·cross-project·migration·실적·금액.
- #495/#518 및 공유 Workspace 변경은 착수 시 최신 main/관련 PR을 재확인하고 현재 구현을 되돌리지 않는다.

## 소유권과 검증

- 주 담당: backend. 소유 파일: src/contracts/resource-dashboard.ts, src/server/resources/resource-dashboard* 및 신규 route/tests. 순차 실행하고 같은 파일을 동시에 수정하지 않는다.
- Manager: version/package/CHANGELOG/이 계획/active PLAN·Issue 댓글. ui_ux: read-only 설계/비교, qa_docs: DOCUMENTATION_SYNC 후 독립 사전 QA, infra: 원격 commit/tree 게시·PR·CI 등록.
- Issue 댓글 writer는 Manager; Sub-Agent 허용 유형 NONE. 재귀 Agent 생성·merge/release/close 금지.
- Local Fast Feedback: 변경 관련 Domain/SQLite/HTTP/UI tests, typecheck·changed-file lint. UI는 실제 Chromium geometry 390/768/1024/1440/1920px·keyboard/focus/Gantt instance 보존을 확인한다.
- Required docs: RESOURCE_KPI_DASHBOARD/API/ARCHITECTURE/REQUIREMENTS/SECURITY/TEST_PLAN, active PLAN/이 계획/CHANGELOG. DB schema·Calendar 원장·AGENTS/DESIGN 공통 원칙 불변이면 항목별 N/A를 실제 diff와 함께 기록한다. API/public query 변경은 API/SECURITY를 동기화한다.
- 공식 quality/e2e/docker·최종 QA·Manager ACCEPT는 NOT TESTED이며 CI 등록 확인 뒤 다음 Issue로 진행한다.
- Environment-specific Windows Excel/실기기·운영 배포/최종 수동 UX는 이번 PASS로 주장하지 않는다.

## 실행 기록

구현과 required 6문서 동기화를 완료했다. 최종 관련 Vitest 10파일188개 PASS(2026-10-08 00:17:16 KST,2.18s), 실제 격리 Next/SQLite/Chromium API E2E1개 PASS(test10.9s/전체21.1s)다. typecheck·changed14파일 ESLint·Markdown143·diff--check PASS를 확인했고 독립 사전 QA를 거쳐 frozen tree와 실제 remote tree의 동일성을 확인한다. quality/e2e/docker 원격 결과는 NOT TESTED다.

초기 실패를 보존한다. typecheck3건과 route security inventory 예상2개 누락을 수정했다. E2E는 외부 node_modules symlink의 Turbopack 거부, 기존12자 상한을 넘은 신규 password fixture, 신규 응답 nosniff 누락으로 각각 실패했다. 실제 dependency copy·유효 fixture·신규 GET 성공/오류 no-store/nosniff 적용 후 같은 관련 범위를 재검증했다. product/global header 정책을 임의 변경하지 않았다.

실제 SQLite benchmark는 Task1011/Assignment1005/Group8/365일/유효근무260일 최종 기준24.4ms,응답112429bytes다(이전 실제 실행25.19ms/112374bytes도 보존). Local3000ms budget 안이며 일반 하드웨어 성능 보장으로 확대하지 않는다. full snapshot/WBS/group/cell 예산 거부 fixture도 실제 실행했다.

## API 설계 결정

- 신규 `GET /api/projects/{publicId}/resource-dashboard`와 `/resource-dashboard/details`를 사용한다. compact summary/cell selector를 반환하고 동일 정규화 filter+snapshotId로 bounded detail을 재검증한다. 데이터 변경은 409 stale로 재조회하며 새 상세를 이전 KPI와 혼합하지 않는다.
- snapshot metadata는 Project/Catalog revision 및 Calendar fingerprint를 포함하고 같은 SQLite read transaction과 한 번 고정한 clock을 사용한다. mode는 projection만 바꾸며 snapshot/Grand Total을 바꾸지 않는다.
- `search`는 같은 Assignment에서 Resource 이름/code·해당 개인의 Project-connected Group 이름/code 또는 Task 이름/externalId/WBS path를 검색하며 A에 적용한다. `taskSearch`와 status는 T0/A의 Task 조건이다. 개인 검색이 적용될 수 없는 T0 진단은 별도 metadata로 명시한다.
- 배열은 unique/sort; scalar 중복·unknown query·다른 Project/stale/unconnected ID는 400으로 거부한다.
- 설계 상한: full Project Task5000/Assignment8000/Link20000/Calendar date20000, Catalog membership16000, 조회366일, 축별ID200/총ID400, 개인별Group32/Group 반복행16000, 비교cell5000, WBS 누적path entries50000/path chars20000, report2097152bytes(2MiB), detail page100/offset8000. 최종 구현의 한도·benchmark·오류는 RESOURCE_KPI_DASHBOARD/API 계약과 대조한다. 기간 또는 필터 축소로 해결할 수 있는 상한과 full snapshot 한도를 혼동하지 않는다.

cell budget는 Domain subtotal 생성 전, full snapshot·Catalog membership·WBS 경로 budget도 대량 materialization 전에 검사한다. Resource/Group 행의 assignmentRange는 전체 선택 Assignment 기준 서버 min/max이며 frontend가 페이지 상세에서 다시 산출하지 않는다.

## 후속 UI 호환성 결정

`resourceActivity`와 `groupActivity`는 all/active/inactive(default all)로 별도 서버 필터를 제공한다. 개인 active와 Group 활성 소속은 A 전용이며 T0·full Ready·Calendar 전체 Group 소속을 바꾸지 않는다. Group ID와 Group 활성 조건은 같은 Group membership에 교집합으로 적용한다. 빈 eligible Resource 집합은 실제0건이며 []를 전체로 해석하는 기존 ID filter로 위장하지 않는다. UI는 개인 활성 상태/그룹 활성 소속으로 의미를 구분한다.

기존 Stage→Resource exact assignmentIds drill은 #525에서 legacy renderer로 보존하며 새 Dashboard 기본 조회만 신규 API를 사용한다. #528의 상호 navigation 통합 전까지 이 경계를 기능이 완료된 것처럼 제거하지 않는다.

기존 Group 검색은 해당 Assignment 개인의 실제 Group 소속 이름/code만 검색 텍스트로 주입해 보존한다. 검색은 A 전용이며 전역 미배정 멤버·다른 Project로 범위를 넓히지 않는다. 이 계약 확정 이후의 추가 범위 확장은 독립 QA의 REWORK 근거가 있을 때만 수행한다.
