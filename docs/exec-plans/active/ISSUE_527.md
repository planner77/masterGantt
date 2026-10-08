# Issue #527 — 주·월 Resource Plan과 Capacity·과투입

## Issue Work Packet

- Issue: [#527](https://github.com/planner77/masterGantt/issues/527), Epic [#522](https://github.com/planner77/masterGantt/issues/522).
- Lifecycle: IMPLEMENTATION → DOCUMENTATION_SYNC → PRE_QA → 원격 PR / CI 시작. CI 결과 모니터링·병합·main/GHCR·tag·cleanup·Issue 종료는 이번 요청 범위 밖이다.
- 착수 최신 main: `370b809447cc10d7afde1ae5a34685d220c3433b`. 직접 선행 branch `feat/issue-526-resource-milestone-rollup`, exact head `1c518612395c45254ecbd018742e594ac88c3229`를 기반으로 stacked branch `feat/issue-527-resource-plan`를 생성한다. PR base는 `feat/issue-526-resource-milestone-rollup`다.
- Version: `0.99.0` → MINOR `0.100.0`. 하위 호환 신규 기능이며 package/lockfile/CHANGELOG를 동기화한다.
- `release_required=true`, `release_authorized=false`; 정식 게시 승인은 없고 PR 단계까지만 요청되었다.
- 목표·AC: Issue 원문 전체와 [Resource KPI 계약](../../RESOURCE_KPI_DASHBOARD.md)을 따른다. 선행 구현과 동일 raw 계산·scope·distinct ID·snapshot/null 의미를 유지한다.
- Non-scope: FTE/시간 Calendar·전사 가용량·실적·자동 일정조정/배정·금액.
- #495/#518 및 공유 Workspace 변경은 착수 시 최신 main/관련 PR을 재확인하고 현재 구현을 되돌리지 않는다.

## 소유권과 검증

- 주 담당: scheduler/backend/frontend 순차 소유. 소유 파일: pure resource-plan Domain/tests → report API 확장/tests → 기간 matrix UI/tests. 순차 실행하고 같은 파일을 동시에 수정하지 않는다.
- Manager: version/package/CHANGELOG/이 계획/active PLAN·Issue 댓글. ui_ux: read-only 설계/비교, qa_docs: DOCUMENTATION_SYNC 후 독립 사전 QA, infra: 원격 commit/tree 게시·PR·CI 등록.
- Issue 댓글 writer는 Manager; Sub-Agent 허용 유형 NONE. 재귀 Agent 생성·merge/release/close 금지.
- Local Fast Feedback: 변경 관련 Domain/SQLite/HTTP/UI tests, typecheck·changed-file lint. UI는 실제 Chromium geometry 390/768/1024/1440/1920px·keyboard/focus/Gantt instance 보존을 확인한다.
- Required docs: RESOURCE_KPI_DASHBOARD/SCHEDULING_ENGINE/API/ARCHITECTURE/PROJECT_UX/ISSUE_56_RESOURCE_WORKLOAD/REQUIREMENTS/TEST_PLAN, active PLAN/이 계획/CHANGELOG. DB schema·Calendar 원장·AGENTS/DESIGN 공통 원칙 불변이면 항목별 N/A를 실제 diff와 함께 기록한다. API/public query 변경은 API/SECURITY를 동기화한다.
- 공식 quality/e2e/docker·최종 QA·Manager ACCEPT는 NOT TESTED이며 CI 등록 확인 뒤 다음 Issue로 진행한다.
- Environment-specific Windows Excel/실기기·운영 배포/최종 수동 UX는 이번 PASS로 주장하지 않는다.

## 확정 Domain·API·소유권

Capacity R는 현재 Project 일반 Task의 개인 Assignment 이력에서 Resource/Group/Global Role/등급/activity 조건만 적용한 고유 개인이다. 기간·Task/WBS/status/Milestone/taskSearch/통합 검색은 R을 줄이지 않는다. 전역 미배정 Group 멤버는 제외하고 기간 밖 이력의 개인은 0부하 행으로 유지한다. fullProject 집합은 같은 R과 실효 Assignment 기간에서 Task 차원 조건을 제거하며 모든 Group Calendar를 보존한다. 선택 집합은 기존 필터 계약을 따른다.

근무일 1일 = Capacity 1 M/D, Project < Group < Resource Calendar를 재사용한다. allocation null은 비근무일만 교차해도 미설정 Assignment로 포함한다. 기간별 알려진 M/D만 가산하며 전체 nullable 상태와 unknown Assignment 수는 전체 ID 집합에서 재판정한다. Capacity 0·모두 미설정·부분합·대상 없음·알려진 0을 구별한다. Grand resource-day는 고유 집합, Group 초과는 개인별 초과 합이며 Group 가중 Peak와 개인 최대 Peak를 구별한다. 원시 합계 반올림 없이 초과 판정에만 상대 tolerance를 적용한다.

주 ISO week-year와 월 calendar month를 조회 범위로 clip한다. 2199-12-31의 ISO 2200-W01은 metadata이며 지원 범위 밖 date-only 입력을 허용하지 않는다. 명시 M/M 환산값을 사용한다. 기간별 셀은 동일 Capacity에 selected/project 지표 쌍과 Milestone 기여를 연결하며 단계별 반복 Capacity는 비가산이다.

- scheduler: `src/domain/resources/resource-plan.ts`, `resource-plan-periods.ts`, 관련 신규 Domain tests/fixture와 `SCHEDULING_ENGINE`, `RESOURCE_KPI_DASHBOARD`의 Domain 계약. 기존 `resource-kpi.ts`는 별도 승인 없이 수정하지 않는다.
- backend: engine freeze 이후 `src/contracts/resource-dashboard.ts`, dashboard query/service/handlers와 신규 readonly route, security inventory, 관련 server/native HTTP tests. 문서는 API/ARCHITECTURE/SECURITY/REQUIREMENTS/TEST_PLAN/RESOURCE_KPI_DASHBOARD이며 scheduler 문서 소유권 반환 후 갱신한다.
- frontend: backend DTO freeze 이후 resources UI/model/hook/CSS와 관련 Unit/mock/native Chromium tests. PROJECT_UX/ISSUE_56_RESOURCE_WORKLOAD/RESOURCE_KPI_DASHBOARD/REQUIREMENTS/TEST_PLAN은 backend 문서 소유권 반환 후 갱신한다. Workspace props 변경은 최소 상태 보존 범위다.
- ui_ux: read-only 기간 matrix·일별 근거/Assignment 상세 interaction 설계와 5폭 실제 증거 비교. qa_docs: 최종 DOCUMENTATION_SYNC 후 read-only 독립 PRE_QA.
- 순수 Domain exports: `buildResourcePlanPeriods`, `calculateResourcePlan`, `getResourcePlanDailyPage`, `getResourcePlanDayAssignments`. Input은 기존 Calendar/Resource/Assignment 타입과 명시 R·selected/full 집합·환산 기준·예산을 받는다. HTTP/SQLite/환경·필터 해석은 backend 경계다.
- report `granularity=week|month` opt-in, 생략 시 기존 계산 경로 유지. granularity/page/mode는 projection이며 snapshot identity에 포함하지 않는다. 실제 normalized 기간/filters/asOf/M/M policy는 identity에 포함한다.
- 일별 numeric 근거와 별도 Assignment 기여 페이지는 selected/project scope를 echo하고 전체 DTO snapshot과 일치해야 한다. 잘못된 ID400, stale409, 예산422, private/no-store/nosniff를 유지한다.
- 예산 후보 resource-day 200000, assignment-day 1000000, matrix 5000, 범위366일, page100, 응답2MiB를 실제 benchmark와 함께 확정한다. 기간/Resource 무단 절삭 금지.
- 필수 fixture: 5일50%=2.5, ISO year/윤년/부분 기간, 하루150%+다음0의 평균75/Peak150, M1=80+M2=60의 selected80/project140, Group 평균75/개인150, multi-Group/Role Grand distinct, null 주말 월 경계의 whole unknown distinct, working override, 0 Capacity·미설정·부분합·0부하·비활성/미분류.

## 실행 기록

구현·관련 Local Fast Feedback·DOCUMENTATION_SYNC·독립 사전 QA 진행 중이다. 원격 게시는 사전 검토 이후이며 source tree 동일성·실제 remote head를 확인한다.

### 착수 및 선행 상태

#526 PR #534의 exact head `1c518612395c45254ecbd018742e594ac88c3229`, CI [37676430071 / 2099.1](https://github.com/planner77/masterGantt/actions/runs/37676430071) 등록을 확인했다. 공식 결과는 조회하지 않았다. 최신 main `370b809447cc10d7afde1ae5a34685d220c3433b`은 외부 PR #531 merge와 추가 fix `37a16a55193a35b4d1dd608b14aae7a8317c84d3`를 포함한다. 이 추가 fix를 충돌 없이 미커밋 적용했고 원본/적용 patch-id `e26788ada81b39c48432083462d471459e364047`이 일치한다. #526 및 기존 작업 branch는 변경하지 않았다. Next/@next/env 선언·lock·installed 16.3.8 일치, node_modules는 물리 복사했다. #527 기존 branch/PR는 조회 시 없었으며 Issue open/comments0이었다. #495/#518의 공유 UI 변경은 현재 baseline에 없으므로 기존 navigation을 유지한다.

### UI/상세 설계 확정

기존 보기 선택에 Resource Plan을 통합하고 주/월 하나의 matrix만 표시한다. 행은 Group→Resource→Milestone 또는 Resource→Milestone, 최대50개 visible flattened rows와4개 기간+전체 열로 window를 제공한다. identity는 desktop280px 기준, 좁은 화면144px를 geometry 검증 조건으로 적용한다. 이름2줄과 전체 accessible label, sticky identity/header 및 내부 scroll을 검증한다. 기간 전체를 계산하되 표시 창만 이동한다.

Group 셀은 날짜별 요약 → 해당날짜 개인 numeric 근거 페이지 → 개인·날짜 Assignment 기여로 탐색한다. Group 평균으로 개인 초과를 숨기지 않는다. 순수 `getResourcePlanDayResources` 또는 동일 기능 helper를 추가하며 개인Capacity/known/unknown/excess와0부하R을 page100 이내로 제공한다. 알려진 부하와 미설정/부분합을 함께 표시하고 정상·가용을 확정하지 않는다. Milestone 행은 개인 Capacity 참고·단계간 비가산, Project 전체 경고는 parent Resource의 전체 참고로 표시한다.

### Backend projection 계약

신규 readonly GET은 `/resource-dashboard/plan/daily`, `/resource-dashboard/plan/day-resources`, `/resource-dashboard/plan/day-assignments`다. daily는 snapshot/granularity/periodId와 row/demandScope/page를 받으며 `periodId=all`은 전체 조회 기간이다. day-resources는 날짜와 Group/전체 row, day-assignments는 날짜와 Resource 및 optional Milestone을 받는다. 두 날짜 상세 모두 parent granularity/periodId가 필수이며 날짜가 해당 period(all 포함)에 속하는지 검증한다. 공통 echo에 Project/Catalog/Calendar revision, 실제 filters/range/asOf/M/M 값과 출처, granularity/selector/demandScope/page를 포함한다. 숫자 근거의 R metadata는 A-filtered 기존 report 행에서 복원하지 않고 Project 연결 catalog의 Capacity R를 안전하게 enrich한다. Calendar용 전체 membership과 표시 Group 조건을 분리한다.

Milestone 행은 selected=해당 단계 기여, project=동일 개인의 Project 전체 참고이며 `projectReferenceOnly`와 Resource 참고 row를 명시한다. 참고값·전체 경고의 원인은 Resource/project selector로 조회한다. resourceMilestone/project 상세는 해당 Milestone에 제한된 Project 기여이므로 전체 참고와 구별한다.

### 순수 계산 인계

scheduler 구현·담당 DOCUMENTATION_SYNC PASS, source freeze. 관련 Unit4파일56개(신규28+기존 KPI28) PASS, 2026-10-08 04:57:16 KST/406ms. typecheck·owned6파일 lint0·Markdown146·담당8파일 whitespace PASS. 초기 typecheck fixture readonly 배열 오류1은 복사로 수정했고 Unit 실패는 없었다. 정확한actual5 허용/limit4거부 및 큰 resource-day200202/assignment-day1000100/matrix 초과 회귀를 보존한다. 40R/5G/2700A/365일/month12 benchmark는 engine166.983622ms/JSON1627142bytes이며 API나 실제 화면 증거와 구별한다. 순수 source6파일은 동결하고 RESOURCE_KPI_DASHBOARD 문서 소유권은 backend로 인계한다. Backend DTO/3경로 및 실제 HTTP 검증은 진행 중이다.

### 순수 Domain 독립 검토

qa_docs read-only 순수 Domain 검토 PASS/blocker0, 전체PRE_QA는 아니다. 신규3파일+기존 KPI1파일 고유56tests를 독립실행해 PASS, 2026-10-08 05:03:40 KST/394ms/exit0/chunk0aa42f. 동결 source/test6파일 hash가 검토전후 일치했다. backendWIP typecheck·HTTP/UI·전체DOCSYNC/PRE_QA/공식CI는 NOT TESTED다. 같은순수source/의존성일 때 이번관련독립test를 최종QA에서 재사용할 수 있으나 최종DTO/diff/docs는 다시검토한다.

### 확정 interface 이후 분리 구현

backend가 DTO/query interface를 동결한 뒤 소스 파일 소유권을 분리해 frontend 구현을 병렬 승인했다. `src/contracts/resource-dashboard.ts` SHA256 `a07140a658a53bdf9eedad4034dd5f865e5618dd038f8c3be799823f1ed9cbee`, query SHA256 `ee3816068ae6720d8ebd898e7692932ea8bc70b02962493ea8335dae40a0c39f`이며 typecheck PASS. 최초11개 narrowing type 오류는 보완했고 실행 이력은 보존한다. Backend service/routes/server tests/docs는 계속 backend 소유, UI/model/hook/CSS/Unit와 `resource-plan-ui.spec.ts`/`resource-plan-dashboard.spec.ts`는 frontend 소유다. 공통 문서는 backend 완료 후 frontend에 순차 반환한다. 공유 E2E DB/webserver는 backend nativeAPI 완료 후 frontend 브라우저 실행 순서로 직렬화한다. DTO/query shape 변경은 Manager 조정 대상이다.

### 검토 REWORK

Manager/ui_ux의 WIP 검토에서 Plan conditional mount 및 granularity만으로 기존526 tree/matrix statekey가 바뀌는 문제를 확인해 mounted hidden/inert 또는 상태 lift·projection 구분과 회귀를 지시했다. 표 visible50 예산은 total/context 행을 포함하며 상세 retry/pager focus·마지막기간 sticky geometry도 검증한다.

추가 Domain REWORK는 full Calendar Group membership과 표시 Group projection을 분리한다. 기존에는 모든 Group series/cells를 만든 후 backend에서 걸러 비표시 Group으로 불필요하게 예산을 초과할 수 있었다. optional `projectionGroupIds`(undefined=all, 명시[]=그룹series없음)를 순수 Input에 추가해 출력 Group/budget만 제한하고 Calendar는 전체 membership을 유지한다. scheduler는 engine/tests/SCHED만, backend는 service Input shaping/RESOURCE 문서를 소유한다. 해당 순수source freeze/이전독립56 PASS는 변경source에 stale이며 새로운 freeze 이후 관련검증을 다시 수행한다. DTO/query interface shape는 불변이다.

### REWORK·실제 API 검증 인계

Group projection REWORK 관련4파일58Unit PASS(신규30+KPI28), 2026-10-08 05:17:03 KST/1.05s. 독립qa_docs 재검토4파일58Unit PASS, 05:19:07 KST/543ms/chunkb3fc8b. source/test6hash검토전후일치, engineSHA256 `1fd3fe5ba02a8e9f9d48d10e99d605808e640cff41692e4d668116dbaff1bf3f`. 이전56은변경source최종근거에서제외한다.

backend 관련5파일107Unit PASS, 05:18:54 KST/4.40s. 실SQLite+in-process HTTP handler 최종측정369.575127ms/1811056bytes, 앞선308.749935 관측은이력이며실Next네트워크성능증거로표현하지않는다. 별도Next16.3.8+SQLite 실제Chromium API2cases(기존18.2s/신규Plan24.3s/전체1.2분) 첫실행PASS, next-env/tsconfigHEAD복원및runtime반환. Frontend가실제UI브라우저를이어가고공통문서는backend최종검증후순차인계한다.

### Backend 독립 검토 및 test-only REWORK

독립 qa_docs 관련5파일107Unit PASS(2026-10-08 05:29:53 KST/1.93s/chunkaa9560), source/test11 및 backend 전용API/ARCHITECTURE/SECURITY3문서 hash 검토전후 일치. SQLite+in-process HTTP handler 독립 benchmark는200.612517ms/1811056bytes이며 별도 Next network benchmark가 아니다. 외부Project Milestone·현재Project 일반Task의 Milestone selector를 400으로 거부하는 독립 probe도 확인했다.

두 selector 조건을 기존 회귀case에 추가하는 test-only REWORK 이후 담당 focused1PASS/28skip(05:31:03/469ms), 독립 focused1PASS/28skip(05:31:51/543ms/chunk986184). production10파일 및 전용문서는 불변이다. 일반107실행과 변경case1의 검증을 재사용하며 마지막 source에서 단일107개를 재실행했다고 표시하지 않는다. 기존case를 확장했으므로 고유case수는107이다. 변경test SHA256 `21e6016f58e0f9ddfff279473e6a0398365d11f07f5afc613e49fae635a80e52`. 최종 backend17파일 manifest SHA256 `ba6c7c2faa379f080db38150d5bc794b69297c389df3b316b24f269f9107ac50`.

Backend 담당 DOCUMENTATION_SYNC를 마치고 PROJECT_UX/ISSUE_56_RESOURCE_WORKLOAD/RESOURCE_KPI_DASHBOARD/REQUIREMENTS/TEST_PLAN5문서 소유권을 frontend로 반환했다. 실제 UI browser·해당 문서 동기화와 최종 PRE_QA는 진행 중이다.

### UI·문서 최종 동결 / QA_READY

frontend19파일 source/documentation freeze SHA256 `89da2a4c6bb96e3a23095dd889a4ab65d647187eaa7efa68b3f90be3f13dd4bb`. 관련UI3파일15Unit PASS, 최종mock5/nativeUI1 고유6case PASS(45.7s). 변경 없는 기존526 mock5 PASS를 별도 재사용하며 backend nativeAPI2와 구별한다. 관련고유browser합은13(mock신규5+nativeUI1+기존526 5+nativeAPI2)이며 반복실행/geometry관측을 더하지 않는다. 설치Next/@next/env16.3.8에서 실행했고 next-env/tsconfig는 HEAD byte로 복원했다. typecheck·담당TS lint0warnings·Markdown146·diffcheck PASS.

20geometry(주/월×Group/Resource×5폭), 390px4조합의 실제owner양축 scroll180/100 후 stickyidentity/header bbox·corner 및 nativeTab outline을 검증했다. ring6px left165/right337이 visible163..378 내부이고 header/owner 아래 가려지지 않는다. 최대50행은전체/context 포함, 마지막기간 창144px identity를 유지한다. screenshot390/1440은실제표본문증거이며 `docs/evidence/issue-527/geometry.json`과함께보존한다.

rawselected summary의 assignment/unset/state/partial/knownMd/plannedMd/plannedMm은 null 동일·상대오차1e-8로 검사하고 모든series의 기간known합을 확인한다. Capacity R와AresourceCount는같다고요구하지않는다. 주8R/4G/14R-M/54기간1458cells·1448858bytes, 월24R/12G/46R-M/13기간1079cells·1198312bytes는실제enginefixture의 `{data}` UTF-8크기며각5000cells/2MiB이내다.

최초UI실패는로그/TEST_PLAN에보존했다: strictlocator/공휴일oracle, loadingpagerBODYfocus, canonical재조회metricoracle, R0region접근성, Core초기scroll경합, 실제Tabcell이sticky뒤에가려지는문제. 실제UI는stableDOM/region/scrollpadding·margin으로보완하고영향검증을다시수행했다. 추가전체로컬회귀는반복하지않는다.

DOCUMENTATION_SYNC: SCHEDULING_ENGINE/API/ARCHITECTURE/SECURITY/RESOURCE_KPI_DASHBOARD/PROJECT_UX/ISSUE_56_RESOURCE_WORKLOAD/REQUIREMENTS/TEST_PLAN와이Packet/PLAN/CHANGELOG를동기화했다. DB_SCHEMA/migration·IMPORT_SCHEMA/Excel·AGENTS/DESIGN공통token·CI_CD/REMOTE_VALIDATION/workflow/Docker는계약과파일변경이없어N/A다. pure/domain·backend독립관련test는source동일범위에서재사용하며최종UI/docs/tree는독립qa_docs가새로검토한다. 공식CI/QA_FINAL/ACCEPT·main/GHCR·환경별최종수동검증은NOT TESTED다.
