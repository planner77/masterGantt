# Issue #526 — Resource·Group Milestone roll-up과 비교표

## Issue Work Packet

- Issue: [#526](https://github.com/planner77/masterGantt/issues/526), Epic [#522](https://github.com/planner77/masterGantt/issues/522).
- Lifecycle: IMPLEMENTATION → DOCUMENTATION_SYNC → PRE_QA → 원격 PR / CI 시작. CI 결과 모니터링·병합·main/GHCR·tag·cleanup·Issue 종료는 이번 요청 범위 밖이다.
- 착수 최신 main: `f3373386d084bad5973b88180cd04ee9778e4fd6`. 직접 선행 branch `feat/issue-525-resource-dashboard-ui`, exact head `c4454ba4085930ba2d6e32c58f1653a32e496aca`를 기반으로 stacked branch `feat/issue-526-resource-milestone-rollup`를 생성한다. PR base는 `feat/issue-525-resource-dashboard-ui`다.
- Version: `0.98.0` → MINOR `0.99.0`. 하위 호환 신규 기능이며 package/lockfile/CHANGELOG를 동기화한다.
- `release_required=true`, `release_authorized=false`; 정식 게시 승인은 없고 PR 단계까지만 요청되었다.
- 목표·AC: Issue 원문 전체와 [Resource KPI 계약](../../RESOURCE_KPI_DASHBOARD.md)을 따른다. 선행 구현과 동일 raw 계산·scope·distinct ID·snapshot/null 의미를 유지한다.
- Non-scope: 기간 capacity·실적·금액·자동 배정·WBS 재구성.
- #495/#518 및 공유 Workspace 변경은 착수 시 최신 main/관련 PR을 재확인하고 현재 구현을 되돌리지 않는다.

## 소유권과 검증

- 순차 담당: backend가 contracts/Domain helper/service/query/handler/route/security inventory/tests와 서버 계약 문서를 먼저 구현·동결한다. 이후 frontend가 Dashboard Milestone tree/matrix·관련 tests와 UI 문서를 구현한다. 동일 파일의 인계 시점을 명시하며 동시에 수정하지 않는다.
- Manager: version/package/CHANGELOG/이 계획/active PLAN·Issue 댓글. ui_ux: read-only 설계/비교, qa_docs: DOCUMENTATION_SYNC 후 독립 사전 QA, infra: 원격 commit/tree 게시·PR·CI 등록.
- Issue 댓글 writer는 Manager; Sub-Agent 허용 유형 NONE. 재귀 Agent 생성·merge/release/close 금지.
- Local Fast Feedback: 변경 관련 Domain/SQLite/HTTP/UI tests, typecheck·changed-file lint. UI는 실제 Chromium geometry 390/768/1024/1440/1920px·keyboard/focus/Gantt instance 보존을 확인한다.
- Required docs: RESOURCE_KPI_DASHBOARD/API/ARCHITECTURE/SECURITY/PROJECT_UX/MILESTONE_STAGE_GATES/REQUIREMENTS/TEST_PLAN, active PLAN/이 계획/CHANGELOG. DB schema·Calendar 원장·AGENTS/DESIGN 공통 원칙 불변이면 항목별 N/A를 실제 diff와 함께 기록한다. API/public query 변경은 API/SECURITY를 동기화한다.
- 공식 quality/e2e/docker·최종 QA·Manager ACCEPT는 NOT TESTED이며 CI 등록 확인 뒤 다음 Issue로 진행한다.
- Environment-specific Windows Excel/실기기·운영 배포/최종 수동 UX는 이번 PASS로 주장하지 않는다.

## 실행 기록

구현·관련 Local Fast Feedback·DOCUMENTATION_SYNC·독립 사전 QA 진행 중이다. 원격 게시는 사전 검토 이후이며 source tree 동일성·실제 remote head를 확인한다.

## Manager 확정 설계

착수는 #525 PR CI 등록 이후. backend→frontend 순차 쓰기, ui_ux/qa_docs read-only.

- Backend prepareSnapshot/select/render + pure Assignment selection/totals helpers; 같은transaction/clock1회/Calendar(full소속)공유, schema/1·legacy entrypoint 호환.
- report reference/excluded summary는 Milestone조건만 제거한 실제 A 집합, excluded는 referenceAssignmentID-selectedAssignmentID. count/progress 숫자차감/전체 referencecells 생성 금지. selector.assignmentScope selected(default)|milestoneReference|milestoneExcluded.
- GET resource-dashboard/group-children 기존filters+snapshotId+groupId+optionalmilestoneTaskId+offset+limit. Project-connected/sameGroup Resource만, default50/max100,offset8000,pagecells5000,2MiB. 상세groupselector optionalresourceId. validfilteredmember=200/0,foreign/wrongGroup=400,changedsnapshot=409. public-read/no-store/nosniff/inventory/tests.
- Frontend 3계층 G→M→R→Task / R→M→Task / G→R→M→Task. children 서버행으로만 표시; same report filter/snapshot 검증·lazy pagination·staleerror controls.
- Group/Resource matrix metric 공수/Task/완료율/지연. canonical예정일+안정ID,미지정마지막+전체열. total은서버행 summary(행·열가시영역합산금지).
- Matrix allrow×allM DOM폭발 방지: 명시 행page/열range 또는실측virtualization,표시row/column개수와전체scope 별도. 예:1000Resources각differentM은실제compactcells3000이어도densematrix1m셀위험. Missingcell은server계약 대상없음·actiondisabled,값0위장금지.
- identitymin264+Milestone144+전체144,내부scrollowner,5geometry/keyboardsfocus/Ganttsameinstance.
- selectedsummary할당진척 vs stages.fullReady/Blocked분리; 부분합/unknown/empty0/nullMM구별.
- API/ARCHITECTURE/SECURITY+RESOURCE_KPI/PROJECT_UX/MILESTONE_STAGE_GATES/REQUIREMENTS/TEST_PLAN requireddocs. Schedulinghelpers추출영향분석; DB/DESIGN/AGENTS원칙불변N/A.
- #527 prepared snapshot재사용, granularity week|month는projection identity제외,기간filter포함.

- Backend 문서 작성: RESOURCE_KPI_DASHBOARD/API/ARCHITECTURE/SECURITY/TEST_PLAN/REQUIREMENTS, Scheduling helper 영향 분석. Frontend 인계 뒤 RESOURCE_KPI_DASHBOARD/PROJECT_UX/MILESTONE_STAGE_GATES/REQUIREMENTS/TEST_PLAN의 UI 부분을 추가한다.

### 서버 인계 — 2026-10-08

Backend SOURCE/DOC FREEZE 및 해당 범위 DOCUMENTATION_SYNC PASS. 관련 Domain/SQLite/HTTP/legacy 12파일211tests PASS(01:35:44 KST,2.26s), 실제Next/SQLite/Chromium API1 PASS(테스트12.8s/전체25.7s), typecheck·변경11파일ESLint·Markdown145파일·diff 검사 PASS. DTO SHA256 `a23720f3ef9c0fd2521bea993391a1307946a9497131668c2452af49fd8485b3`, Domain `7e47ae362aa95c1cbc8f5189bc53b7c143ef77775c49b40255df2aefd17af523`, service `626c4058a30ef4bf2acb569ccdd8032da833c03b116aa7b7d56788ece0426a0a`를 인계한다.

서버는 reference/excluded/milestoneSelection을 항상 반환하되 schema1 optional 타입 호환을 유지한다. children는 normalized filters/range/asOfDate/mdPerMm·출처/Project·Catalog·Calendar revision을 echo한다. Milestone 조건 생략=전체, 명시null=미지정. selector.assignmentScope 기본 selected이며 diagnostic은 selected만 허용한다. Group children selectors는 Group ID와 member resourceId를 보존한다.

초기 helper closure/import 오류37FAIL/31PASS 및 typecheck4오류, fixture 필수값 누락2FAIL/102PASS, Membership SQL column 오류1FAIL/18PASS, URLSearchParams fixture type 오류를 수정한 이력은 TEST_PLAN에 보존한다. 대량 selected100/reference5005/excluded4905 Assignment에서 reference totals-only를 검증했다. 셀 상한은 materialization 전에 검사한다.

Frontend가 UI 및 RESOURCE_KPI_DASHBOARD/PROJECT_UX/MILESTONE_STAGE_GATES/REQUIREMENTS/TEST_PLAN UI 절을 인계받았다. Backend source/계약은 동결하며 변경 필요 시 Manager REWORK를 거친다. UI·독립 전체 PRE_QA·공식 원격 CI는 아직 NOT TESTED다.

### UI 동결·설계 비교 — 2026-10-08

Frontend IMPLEMENTATION/DOCUMENTATION_SYNC 및 ui_ux 설계 비교 PASS. 선언·lock과 일치하는 Next/@next/env16.3.8에서 고유 Chromium7case(mock5/실제SQLite·HTTP UI1/실제API1)를 확인했다. 실제UI1은13.3s/전체25.9s, 실제API1은19.3s다. 관련 frontend Unit2파일8tests PASS(04:29:32 KST,762ms), typecheck·변경7파일ESLint(0warnings)·Markdown145파일·diff PASS다.

실제 UI fixture는2M/2G/2R·공동Task·복수Role·상속Summary/명시override·선택진척100%와전체2/3·Blocked·known/unset부분합·Group∩Resource∩M 상세 및excluded IDs를 검증한다. readonly cookie0/revision불변을 확인했다. populated matrix2모드×5폭=10관측, 세 tree×5폭=15관측,62그룹 페이지·ancestor/mode 복귀의active 펼침≤12·기여 지표별grain·취소409·hidden focus·Gantt native scroll120/96·Week/selection/tree/열/instance 보존을 확인했다.

Frontend16파일 freeze manifest SHA256은 `09b4567e270e3ed85fc9d9108b1e437a47a88a0872103e2d12f43abf1c5c245e`다. UI 필수5문서와PNG2개를 동결했고 Next 생성 설정은HEAD 원본으로 복원했다. ui_ux는파일hash/실행로그/화면증거를 비교했으며 독립browser 재실행은 하지 않았다.

초기7개UI REWORK와긴header/row 작업면 결손을 수정했다.390px header81px/maxrow98px/usable4행을 새근거로 남긴다. partialJSX 오류2FAIL·Gantt identity 테스트인수누락1FAIL·중복문구 strictlocator 실패를 수정한 이력을 보존했다. 복사된node_modules16.3.4와요구16.3.8 불일치를npmci로수정했으며 이전16.3.4 UI5PASS(39.3s)/서버API 실행은과거환경근거로구분한다. 공식CI와같은production audit `npm audit --omit=dev --json`은exit0/취약점0이다. npmci aggregate6high의개발의존성 개별advisory검토는NOT TESTED이며의존성업그레이드는수행하지않았다.

독립focused서버QA6suite109tests PASS(01:37:51 KST,1.86s)와서버sourcehash불변을확인했다. 전체PRE_QA는이최종UI/문서/stagedtree로다시판정하며공식quality/e2e/docker·QA_FINAL/ACCEPT는NOT TESTED다.
