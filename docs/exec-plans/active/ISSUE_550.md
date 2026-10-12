# Issue #550 — Milestone 독립 관리 진입

## Issue Work Packet

- issue: [#550](https://github.com/planner77/masterGantt/issues/550), Epic #548/MT2. 실제 OPEN/comments0, 해당 branch 없음, 검색에서 #550 PR URL 없음. 등록-only 과거 문구는 최신 사용자의 #549~#553 구현 요청으로 대체한다.
- phase: ANALYSIS → PLAN → VERSION_DECIDED → BRANCH_READY → IMPLEMENTING → LOCAL_VALIDATED → DOCUMENTATION_SYNC → PRE_QA → PR_CI_STARTED.
- predecessor: #549 [PR #557](https://github.com/planner77/masterGantt/pull/557), exact head `4bc4c31d9c5f46d90a83cbe4de878a52a2f2529b`, tree `86fa7b5865a745568098acb863b5aca863dd68b6`, app0.103.0. CI Run37795569338/2210.1 등록 확인, 결과 미조회/NOT TESTED.
- live main: `08ac7749efc4544dfc125853d9e58ef3a9d56b21` /0.102.1. #549는 미병합이므로 그 exact head를 baseline으로 쓰고 PR base는 `feat/issue-549-milestone-timeline-foundation`이다. main 통합 완료로 과대 표시하지 않는다.
- branch/worktree: `feat/issue-550-milestone-management`, `/home/planner/Dev/masterGantt-worktrees/issue-550`. infra가 선행 exact head에서 fresh branch를 만든다.
- version: Manager MINOR0.103.0→0.104.0. 행과 무관한 프로젝트 수준 생성·관리 명령 진입이 사용자 기능으로 추가된다. package/rootlock/CHANGELOG Manager 소유.
- release_required=true / release_authorized=false. 승인 범위는 PR CI 등록까지만; CI 결과 모니터링/merge/main/GHCR/version tag/Issue 종료/cleanup은 비범위다.

## 요구사항·범위

기존 Milestone Dashboard 안에 공통 canonical 날짜 정렬의 평면 목록과 명시적 `Milestone 추가`를 제공한다. 같은 canonical taskId로 기존 Editor(상세/소속)/관계/Copy ID/허용된 복사·삭제·완료·재개 등 command gateway를 재사용한다. root 생성 placement를 명시하고 선택 Summary/scope를 암묵 부모로 삼지 않는다. duration0/type milestone와 기존 validation/Origin/session/revision authority를 유지한다. 날짜순은 Dependency나 siblingOrder mutation이 아니다.

전체 E(M)/P(M), manual ready=null, 완료불일치/완료 잠금/상속과override, Task→Task/M→M 신규 및 legacy mixed 조회/허용 수정·삭제를 유지한다. 현재 WBS/날짜 viewport에 없는 endpoint도 canonical 전체에서 resolve한다. 이름/날짜 중복, M-only, 검색결과0/전체0/범위밖0을 구별한다. 기존 보고 검색·날짜·상태·범위·freshness/KPI를 보존한다.

단순 조회는 mutation/revision 증가 없이 같은 Gantt instance·scroll/tree/scale/columns/fullscreen을 보존한다. dirty/pending/stale/401/412/network/응답 역전과 성공 canonical revision 반영, 실제 호출목록의 focus 복원/삭제시 안전fallback을 검증한다. `해당 날짜에서 보기`와 exact 소속 작업 탐색을 구별하고 현재 정상 경로를 유지한다. 아직 없는 새 lane을 완료로 표시하지 않는다.

비범위: 현재 Milestone native행/quickviews 제거(#552), 새 Timeline(#551), 새 Editor/Dashboard/Membership/Ready 엔진, DB migration/새 API 계약/권한 확대, PRO/비공개store/remount/강제DOMscroll, 다중 M 복사 신규지원, Resource KPI 재구현, #495/#497/#556의 별도전면개선.

## 소유권·위임

- Manager: Packet/PLAN/package/rootlock/CHANGELOG, 단계·버전·placement/interface 조정·DOCUMENTATION_SYNC·공식 Issue 댓글/인계.
- ui_ux: read-only 화면/interaction/keyboard/focus/390~1920 설계와 최종 증거 비교. DESIGN/공통UX/현행Dashboard/Editor/#549 계약을 확인해 frontend에 handoff. 코드·문서 쓰기/공식댓글/재귀위임 없음.
- frontend primary: `src/features/projects/project-readonly-view.tsx`, `src/features/milestones/**`의 기존Dashboard/table/model/hook와 필요한 관리 helper/CSS, 기존 Editor/command 진입의 최소 코드, 직접 관련 Unit/새 `tests/e2e/milestone-management.spec.ts`/선별 합성PNGJSON; 변경이 필요한 기존 UI E2E는 근거를 먼저 Manager에게 반환. 서버/routes/repository/domain/version/Packet/PLAN은 쓰지 않는다. Workspace 공용 파일의 유일 writer다. 기존 다른 작업을 되돌리지 않는다.
- frontend documentation_owner: MILESTONE_TIMELINE/PROJECT_UX/TASK_EDITOR/TASK_RELATIONS/REQUIREMENTS/TEST_PLAN/MILESTONE_STAGE_GATES의 실제 기능 영향. API/SECURITY guard 불변은 N/A 검토, 계약 변화가 필요하면 Manager에 반환. DESIGN/AGENTS/DB/Scheduling은 의미 불변시 N/A.
- backend: 기존 보호 gateway/완료/Assignment/Copy/Link guard read-only 검토와 실제 SQLite/HTTP 테스트 소유. `tests/e2e/milestone-management-persistence.spec.ts` 및 필요한 독립 새 테스트 helper만 쓰고 기존 sharedfixture/config/UI/docs를 동시에 수정하지 않는다. isolatedApplication의 restart/reopen 증거를 실제 실행한다. 앱 source 변경 필요시 Manager가 소유권 재조정한다.
- qa_docs: DOCUMENTATION_SYNC 후 exact staged tree를 read-only 독립 PRE_QA. 구현자 자체PASS를 최종수락으로 바꾸지 않음.
- infra: branch/dependency 준비, ManagerGO뒤 API exact tree/commit/branch→PR→CI등록metadata만. 제품/문서/version쓰기/CI결과조회금지.
- issue_comment_writer=manager / agent issue_comment_allowed_types=NONE. 실제 동시한도6, 같은파일쓰기/재귀위임금지. 선행549/기존작업원본보존.

## Source of Truth·검증·문서

작업 전 AGENTS/ISSUE_LIFECYCLE/AGENT_PROMPTS/DESIGN/UI_UX_GUIDELINES/MILESTONE_TIMELINE/PROJECT_UX/TASK_EDITOR/TASK_RELATIONS/MILESTONE_STAGE_GATES/API/SECURITY/TEST_PLAN/PLAN과 relevant architecture/DB/scheduling/remoteCI/CI_CD/GITHUB_OPERATIONS를 읽는다. #461/#463/#462/#495/#518/#519/#528의 실제 통합과 #549 model/adapter를 확인한다. Next installed guides를 코드 작성 전에 읽는다. 관련 skill은 해당 역할이 알리고 읽으며 DESIGN token을 재사용한다.

Local Fast Feedback: 변경 Unit, typecheck/변경lint, 관리 UI5폭+readonly/edit/keyboard/focus/Escape/내부scroll/긴이름/많은행/dirty/pending/stale/401/412/응답역전의 targeted Chromium, 실제 SQLite HTTP 생성→편집→소속/관계→재조회·restart 영속성. mock UI 증거와 realHTTP/SQLite 증거를 구별한다. 전체Vitest/전체Playwright/cleanDocker 반복 없음; 공식 quality/e2e/docker는 각새exacthead PR Actions로 위임하고 결과모니터없이NOT TESTED다.

새 관리 명령 inventory와 제공/readonly/권한/완료잠금/미지원 경계를 문서에 남긴다. 코드·계약 변경 뒤 문서 영향분석·required docs 갱신 또는 항목별N/A→Manager DOCUMENTATION_SYNC PASS→ui_ux비교+독립QA→infraGO. 실험command/exit/sourcehash/최초FAIL/REWORK/선별화면·JSON을 보존하되 secrets/password/token/Task실제본문/runtimeDB/log/trace/.next는Git에 넣지 않는다.

선행549 Week월header 의미 FAIL(원인·기존baselineNOT TESTED)은 #551 활성화전gate이며 #550은 좌표lane를 활성화하지 않는다. 390 기존Gantt minWidth720 한계와 관리Dashboard 실제 responsive는 구분한다. 실제환경screenreader/실기기/WindowsExcel/운영검증은 증거없으면NOT TESTED다.

## 다음 인계

ui_ux설계+backend서버계약 검토→Manager placement/commandinterface확정→frontend구현/문서+backend독립persistence→LOCAL_VALIDATED→DOCUMENTATION_SYNC→PRE_QA→원격PR/CI등록. #550endpoint 이후 #551으로 순차 진행하고 #550 CI결과는 조회하지 않는다.

## 착수 서버 계약과 Manager placement 결정

backend read-only inventory PASS: root Milestone 생성은 기존 POST /tasks의 `name,type:'milestone',start,duration:0,progress:0`과 지원되는 `parentExternalId:null`을 사용하고 `parentTaskId`는 생략한다. `parentTaskId:null`은 optional UUID strict schema가 거절하므로 전송하지 않는다. root siblingOrder는 기존 nextSiblingSortOrder append, 기존 Task parent/siblingOrder는 변경하지 않는다. 선택 Summary/scope를 생성 부모로 해석하지 않는다. 현재 createNativeTask의 일반 Task duration1 override를 재사용하지 않고 기존 saveTask 보호 gateway를 공유하는 명시적 M wrapper를 frontend가 소유한다.

POST/PATCH/소속/관계는 기존 session·Origin·If-Match와 transaction revision 재검증, 전체 Stage mutation/completed guard를 유지한다. readonly401/Origin403/missingIfMatch428/stale412 atomic 거절을 실제 HTTP로 확인한다. 신규 mixed Link는 HTTP에서 지원하지 않으며 거절을 확인하고, 기존 legacy mixed 조회·허용 수정/삭제는 실제 SQLite 기존 service 테스트를 별도 targeted 재실행해 증거를 구별한다. 서버가 viewRootTaskId를 입력으로 받는다는 새 계약은 없다.

## UI/UX 설계·공통 interface 확정

ui_ux read-only 설계 handoff PASS, 실제 UI 증거 NOT TESTED다. 기존 표의 1052px 예산(identity 최소260+fixed792)과 조회144px 열 안에서 관리 메뉴를 제공하고 새 열/KPI 재설계를 추가하지 않는다. 좁은 폭은 table owner의 가로 scroll과 toolbar reflow로 접근성을 보존한다. 이름/상세와 소속은 기존 Editor task/memberships 탭, 관계는 기존 Editor/Relation 경로를 사용한다. Copy ID·허용 복사/삭제·해당 날짜 보기·소속 작업 보기를 canonical taskId/실제 trigger의 공통 command callback으로 제공한다. 완료/재개는 기존 Editor의 명시 상태 저장이다.

Manager는 작은 Workspace 생성 name/date form+프로젝트 최상위 설명과 같은 saveTask POST gateway의 명시 M bridge를 승인했다. 이는 별도 Task Editor/임시 native행이 아니다. 성공 Editor는 canonical mutation 응답의 정확 created taskId로 열고 이름이나 마지막 배열 행을 추측하지 않는다. menu/dialog는 상호 배타다. 닫기 focus는 연결된 visible/non-inert 원 trigger, 없으면 원 Dashboard의 보이는 검색/추가/목록 heading 순으로 복원하고 숨은 Gantt fallback을 사용하지 않는다. actual interface가 기존 guard/API 의미를 변경해야 하면 Manager에게 반환한다.

## 중간 검증·기존 Copy capability 보존

strict Task contract17개 및 기존 legacy mixed 실제 SQLite service 선택1개 Local PASS, 나머지31개는 실행미선택이다. 새 realHTTP/SQLite persistence 최초 실행은 내부 taskId의 화면표시 oracle가 현행 externalId UI 계약과 달라 FAIL했고 원본을 보존했다. 외부ID 표시+정확 PATCH taskId를 검증한2차 실행은1PASS/16.5초(전체28초)/exit0, 실제 프로세스 재시작 후 full canonical snapshot 일치까지 도달했다. 최종 code/test/doc 동결과 실행 source hash는 후속 계약을 따른다.

backend는 완료된 0-member 수동 Milestone도 explicit source/모든 incident Link가0이고 destination·권한·budget 등 기존 guard를 통과하면 단일 Copy가 가능함을 확인했다. completed blanket 거절을 새 메뉴에 추가하지 않는다. 기존 fullE/P/explicit/incident 경계·역매핑 및 previewMembershipCopy/server authority를 사용하고, 삭제·소속·관계 구조의 완료 잠금은 유지한다. 직접 manual0 Copy 실제 HTTP 증거를 추가 검증한다. 이는 기존 허용 capability 보존이며 새로운 다중 Milestone 복사가 아니다.

## 독립 UI 비교 REWORK와 재동결

frontend Unit 신규4+기존 milestone-dashboard-model/task-editor-view-model66=70PASS, synthetic UI13/13PASS31.9초, backend actualHTTP/SQLite2/2PASS42.5초(행동17.515+5.064초)·skip/flaky0을 sourcehash별로 보존했다. backend strict17/legacy선택1은 frontend의70파일과 겹치지 않아 총고유Unit88개이며 공식전체회귀와 구별한다. 실제 단일manualCompletedCopy 성공과 partialCompletedCopy ack에도409, empty→M-only/readonly 관리 및restartfullcanonical 보존에 도달했다.

UIfixture 최초9FAIL Gate누락, 이후3PASS6FAIL 비근무일,4PASS6FAIL unsupported weekendDays=[],4PASS6FAIL 중복siblingOrder를 기록했다. 지원calendar[6,0]·근무일·고유root순서·보고gate로 정정하고 기존 hierarchy/calendar/Membership validator를 fixture에 적용했으며 제품 engine/guard는 바꾸지 않았다. 이후10/10과13/13(31.7), 실제ownedkeyboardscroll/late-report완료oracle 보강13/13(31.9)의 단계를 구별한다. 원본trace/log/sourcehash는 /tmp,선별합성PNGJSON만Git에 포함한다. 공유report경합으로잘못연결된backendHTML복사본은 해당임시복사본만제거했고 원본stdout/exit/hash는유효하다. 최종역할별report/output을 분리한다.

ui_ux 독립비교 REWORK2건: 표header/body·siblingcell/actioncontainment·문서overflow·toolbar/focusowner geometry5폭실측과, managementRow/Task외부소멸시dialog자동unmount의disconnectedtriggerfallback. Manager는 frontend소유 table/dashboard의onFocusUnavailable→기존WorkspacevisibleDashboardfallback bridge와boundedcleanup/stale managementId expire를 승인했다. 새로운genericDialog/권한엔진을 만들지 않는다. 대상이돌아와도폐기된관리modal을자동재개하지 않는다. 관련2case+geometryoracle을최종동일source로검증하고기존13/2PASS는이전source증거로보존한다. DOCUMENTATION_SYNC/PRE_QA는REWORK해소와최종문서/소스동결후진행한다.

## 화면 밖 fallback의 추가 실증 보완과 LFF 재사용 결정

ui_ux 두 REWORK 해소15/15PASS36.4초와backend2/2PASS43.3초(16source manifest)을 보존했다. Manager가 expired-canonical-delete PNG를 실제 확인하니 fallback의 activeElement 복원과 viewport 물리 가시성이 구별되어야 했다. 기존 helper의 preventScroll:true는 안전한 검색이 화면 밖에 남게 할 수 있다. frontend는 Dashboard target을 native focus()로 복원하고 expired2case에 rect+3pxring viewportcontainment/중심hit/현재stickyheaderocclusion을 추가한다. 강제DOMscroll·Chart/Core scroll mutation은 사용하지 않는다.

같은 helper가 Editor닫기/Copy ID/삭제/생성취소에도 쓰이므로최종targeted 관리UI15case전체를새source로재실행한다. backend 실제2/43.3초결과는 HTTP/auth/DB/domain/생성payload/실제spec불변이고 Workspace focus() 한함수의page표시복원만바뀌므로scope기반으로재사용한다. 이전Workspacehash와현재diff를명시하고새source에서실제서버test를실행했다고보고하지않는다. 공식PRhead gate는영향과무관하게새exacthead에서quality/e2e/docker를요구하며지금은미등록/NOT TESTED다.

## 최종 LOCAL_VALIDATED와 문서 영향 판정 준비

nativefocus 보완 뒤 동일제품source의최종targeted UI15/15PASS36.2초/exit0, manifest7항목전후hash일치다. Workspace SHA-256 `71949d287c2cf0460de74eedcba81553bf54cccc3bbec5c2136d76d23b2683af`, 실제spec `c4ac0e17eda2601ad8a185b6ce0cf405dca31d236b6545be02921bef2b5834b2`와 최종PNG/JSON을 대조한다. ui_ux 기존REWORK2건과추가viewportfocus재비교PASS/blocker0를 확인했다. 5폭 header/bodyedges0px·문서폭=viewport·cell/action/toolbarcontainment/ownerkeyboardscroll, 대상소멸2경로의nativefocus viewport가시성·중심hit/occlusion0·oldrow복귀자동modal0을 검증했다. outline3px+offset3px의전체외곽은6px이며3px를전체예산으로축소해보고하지않는다. fallback2case의실측viewport는1280×720이고5폭관측과구별한다.

실제HTTP/SQLite2/2PASS43.3초/exit0·skipped/flaky0(16manifest)은이전Workspace `b49ce846e4588113c24ddd9ec6cf33bb8f69c9cb015e51959a1112edaff87458`에서실행했다. 이후소스diff는 focusMilestoneDashboard의nativefocus한줄뿐이고server/API/DB/domain/생성payload/실제spec은불변이다. Manager의scope기반LFF재사용결정에따라이결과를유지하고새Workspace에서realrun했다고표시하지않는다. 실제생성→편집→소속/Dependency/fullE/P/완료/조건부Copy/atomic거절→프로세스restart전체canonical보존, empty→M-only/readonly에증거가있으며production운영persistence는NOT TESTED다. Unit고유88(신규4+frontend기존66+strict17+legacy선택1)은실행파일이겹치지않는다.

required docs/작성자: frontend의MILESTONE_TIMELINE/PROJECT_UX/TASK_EDITOR/TASK_RELATIONS/REQUIREMENTS/TEST_PLAN/MILESTONE_STAGE_GATES와Manager의Packet/PLAN/CHANGELOG/package/rootlock을갱신한다. DESIGN/AGENTS/ARCHITECTURE는기존파란Light/systemfont/token과단일Workspace/Editor/gateway경계를재사용해공통정책변경없으므로N/A. API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/IMPORT_SCHEMA/VBA_EXPORT/EXPORT/DEPLOYMENT/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS는schema/route/authorization/revision/engine/import/export/deployment/workflow의변경이없어N/A다. 새관리inventory·rootplacement·동일ID·readonly/완료Copy/초안/보고stale/focus/실제server와mock증거/최초FAIL/재사용한계를실제diff와대조한다. generatedNext파일복원과최종typecheck/lint/version/Markdown/diff확인후Manager가DOCUMENTATION_SYNC PASS를기록하고독립PRE_QA로넘긴다.

게시준비metadata 재조회2026-10-09 00:46:45 KST: live main08ac와remote549head4bc4불변,원격550중복branch/PR없음,version/rootlock0.104.0일치. 원격CI결과조회는0회다. exactstagedtree/manifest동결은로컬commit대신rootstage/write-tree→infra APIexact게시흐름으로진행한다.


## DOCUMENTATION_SYNC 완료 및 QA_READY 동결

2026-10-09 Manager 검토: required docs 7개 실제 diff와 항목별 N/A 근거, 로컬 실행 source/마지막 focus 변경의 서버 증거 재사용 경계, 최초 FAIL·Week 헤더 후속 gate를 확인했다. frontend typecheck/lint/Markdown/47파일 manifest PASS, Manager version check와 Markdown 링크 155개·diff check PASS다. next-env.d.ts/tsconfig.json은 parent baseline과 diff 0이며 runtime 산출물을 포함하지 않는다. DOCUMENTATION_SYNC PASS, 다음 단계는 독립 PRE_QA다. 원격 quality/e2e/docker/QA_FINAL/Manager ACCEPT는 NOT TESTED다.


## 독립 PRE_QA의 소멸·복원 경쟁 조건 REWORK

qa_docs 정적 실행순서 비교에서 대상 소멸 후 같은 ID가 폐기 RAF 전에 돌아오면 cleanup이 폐기를 취소하여 stale managementId로 메뉴가 자동 재개될 가능성을 발견했다. 기존 expired 2case는 fallback frame 후 복원만 검증하여 이 순서의 실제 실행은 NOT TESTED다. Manager가 stage-table의 취소 불가한 대상 무효화와 안전 focus 복원을 분리하고 결정적인 before-RAF 복원·명시 재열기 검증을 frontend에 배정했다. DOCUMENTATION_SYNC/PRE_QA는 stale, publication NO GO이며 최초 정적 불일치와 기존 증거를 보존한다. API/domain/server/생성 payload는 범위 밖이고 관련 focus·메뉴 상태의 최소 테스트를 새 source에서 수행한다.


추가 정적 REWORK: 삭제 확인 중 외부 canonical 삭제/보고 row 소멸로 trigger가 disconnected 된 뒤 취소/Escape하면 pendingTaskDelete는 닫히지만 Dashboard fallback을 호출하지 않는 경로를 확인했다. frontend의 기존 Workspace 소유권 안에서 관리 문맥의 닫기 bridge와 actual visible focus·mutation0 검증을 추가한다. generic WorkspaceDialog와 Gantt/서버 권한은 변경하지 않는다. 최초 후보는 runtime FAIL이 아니라 정적 경로 판정이며 실제 재현 결과는 후속 증거에 기록한다. React 공식 지원의 현재 컴포넌트 조건부 render-state 조정으로 관리 대상 ID를 즉시 폐기하고 focus 예약만 RAF로 분리하는 접근을 승인했다. 테스트 전용 RAF 보류로 소멸 commit→동일 ID 복원→사용자 명령 없이 메뉴 재개 없음 및 명시 재열기 순서를 확정한다.


## 추가 REWORK 실행 증거와 재검증

기존 source에 결정적인 before-RAF 테스트를 추가하여 소멸 modal/row commit→동일 canonical ID 복원→자동 메뉴 재개를 2case 실제 FAIL로 재현했다. 원본 `/tmp/issue550-frontend-preqa-first.log`/exit/source manifest/trace를 보존했다. own-component 조건부 render-state로 선택 ID를 즉시 폐기하고 focus만 취소 가능한 RAF에 남겼다. Workspace 삭제 확인 취소/Escape는 기존 Dashboard의 실제 trigger·visible fallback bridge로 복귀한다. genericDialog·Gantt·server/API/domain 변경은 없다.

동일 최종 제품 source의 targeted Chromium은 기존15+before-RAF same/otherID2+disconnected delete cancel/Escape2 =19/19 PASS, exit0,44.5초다. 명시 재열기 후 stale focus가 새 dialog를 탈취하지 않고 단순 조회 mutation0·같은Gantt instance·6px outline 전체 외곽의 viewport 가시성/중심hit/occlusion0을 확인했다. 관련 PNG/JSON과 source SHA를 같은 실행으로 갱신했다. Unit88의 변경 영역 알고리즘은 불변이며 재사용한다. 실제HTTP/SQLite2/43.3초 재사용은 더 이상 nativefocus 한줄만의 조건이 아니다. Workspace의 표시 focus와 삭제 취소 bridge·stage-table 메뉴 selection 폐기의 UI-only diff, 생성payload/transport/server/auth/domain/실제persistence spec 불변을 전문 backend와 Manager가 재검토하며 해당 실행 source를 분리한다. generated파일 복원·최종문서/manifest·독립UIUX·delta QA를 마친 후 publicationGO 여부를 판단한다.


전문 backend read-only 재사용 영향검토 PASS: 실제43.3초 manifest16개 중 Workspace·stage-table·frontend UI spec3개 변경, 나머지13개 동일이다. 현재 Workspace SHA `26d977512c28bc880e4073a2d84a260110e9ba192c4c4df047d4eec3e1810af2`, stage-table `6cfc9f0b1627ee808ff364f83198ff57e001506702777fb1ca8f067f283214fe`, UI spec `296eba3a4da5fb698ca80726a1d8196a9c4d63db6bdfb52689a027fc101e41b8`이다. 생성/saveTask/confirmDelete/transport와 API/server/domain·실제persistence spec `7e11e39f1d079000c5aed85a7e4e5850d6be6374315918f2ecc5de0b06faafc8`은 불변이다. Manager가 이UI-only영향에 한정하여 실제SQLite/restart/보호 거절 및 관련Unit 증거 재사용을 승인했다. 최신source의새realrun이나최신UI동작PASS로확대하지않는다. 독립ui_ux는19PASS/44.5초·7source+4신규JSONdrift0·same/other명시재열기초점·취소/Escape visiblefallback6px외곽/mutation0/같은instance를비교해추가delta PASS/blocker0을반환했다. 최초old2FAIL/exit1을보존한다.


## REWORK 후 DOCUMENTATION_SYNC PASS / QA_READY

frontend 최종55파일 동결 manifest SHA-256 `9938792fe390ff094330af065e7b72ad261ce06369a6795148b039a005b7620c`와 제품·spec·선별40증거를 확인했다. required7개 문서는최초550변경을포함하며추가REWORK영향5개문서를갱신했고TASK_RELATIONS/MILESTONE_STAGE_GATES는추가관계/Gate변경없어기존550문단유지N/A다. 최종19PASS44.5초/exit0, typecheck/lint/Markdown155/diff PASS 및 Next생성파일parent불변을확인했다. actualHTTP/SQLite원본manifest16개·currentUI3파일변경/13불변·구체적재사용조건과최초race2FAIL·19PASS를분리했다. 독립UX delta와backend재사용영향PASS, Manager DOCUMENTATION_SYNC 재판정PASS다. 이전DOCSYNC와QA_FAIL을지우지않으며다음exactstagedtree독립deltaPRE_QA로넘긴다. quality/e2e/docker/QA_FINAL/Manager ACCEPT는NOT TESTED다.


## 2026-10-10 main 통합 및 Review 보완

최신 #549 main `cf1bb035f19ac18423c7f643fbda3a89dcd73a7f`에 맞춰 #550용 0.105.0 후보로 조정한다. Codex P2: 412 conflict 후 새 POST 차단, 관리 표만 480px cap 적용. 최신 Milestone 용어 및 E2E·문서를 동기화한다. #2216.1 성공은 이전 head에 한정하고 새 exact-head CI 및 독립 QA_FINAL/Manager ACCEPT는 미검증. release_required=true, release_authorized=false.

## 2026-10-10 PR CI #2368.1 FAIL → 용어·E2E delta REWORK

PR #559 head `bf47b25b2970df4025a318459c04c2e20a1a86cb`의 Actions [#2368.1](https://github.com/planner77/masterGantt/actions/runs/38032386192)은 quality/docker PASS이나 Chromium shard2(9 FAIL)·shard5(1 FAIL)로 전체 FAIL. 독립 UI 명칭 계약은 이미 `DESIGN.md`/#495의 `Milestone`이다. 최신 main 통합에서 상세 aria-label이 `단계 상세`로 남고 빈 결과 문구가 `Milestone가`, #550 UI spec은 오래된 `단계 검색` 선택자를 사용한 것을 정확한 run/job/log와 현재 source로 확인했다.

관리 표 상세 aria-label/메뉴 `Milestone 상세`, zero-result `Milestone이 없습니다`, #550 spec `Milestone 검색`으로 수렴시킨다. existing #463/#518/E2E HTTP/SQLite 기대 이름을 완화하지 않고 readonly 상세 명령이 활성인지를 추가 검증한다. `PROJECT_UX`, `MILESTONE_TIMELINE`, `TEST_PLAN`, 이 Packet/PLAN/CHANGELOG를 동기화한다. `DESIGN.md`, `AGENTS.md`, API/DB/SECURITY/SCHEDULING은 원칙·계약 변경 N/A. 버전 0.105.0 유지, release_required=true/release_authorized=false. 새 exact-head CI 전/시작 시 새 quality/e2e/docker·QA_FINAL·Manager ACCEPT는 NOT TESTED; 병합/main/GHCR/Issue 종료는 비범위.

## 2026-10-10 PR CI #2373.1 — QA Final 계약 보완

기존 PR #559 head `406d0e2e1b1794f5cefc4472a0443843dd9df210`의 [CI #2373.1](https://github.com/planner77/masterGantt/actions/runs/38034499185)에서 **quality PASS / Chromium E2E 6개 shard 및 aggregate PASS / docker PASS**이며 전체 run은 `QA Final — Automated`의 BLOCKED로 failure다. 첫 차단 사유는 `Primary Issue title/Refs 정확히 일치해야 합니다`: PR 제목에 `Issue #550` 문구가 없고 기존 본문에 `Refs #550`만 있었기 때문이다.

현행 main #580 검증기는 PR 본문의 `risk_level`/`qa_method`, 열린 review thread=0, Issue의 AC1... 식별자, Work Packet의 `DOCUMENTATION_SYNC`/`AC_TEST_COVERAGE` 명시 매핑을 순서대로 요구한다. 기존 #550 수용 기준 11개는 원문과 체크 상태를 보존하여 AC1~AC11 식별자를 부여한다. 완료된 Codex P2 2건은 구현 증거와 이전 PR CI 검증 결과를 답글로 기록한 뒤 review thread를 해결한다.

위험도 HIGH / qa_required=true / qa_method=AGENT. 버전 `0.105.0`은 사용자 기능 MINOR 증분이며 `package.json`과 `package-lock.json`은 원격 보호 대상이다. 검증기의 보호 파일 차단은 **의도적 fail-closed**이므로 이 두 파일을 삭제하거나 위험도/자동 QA 정책을 축소하여 우회하지 않는다. 독립 QA와 Manager ACCEPT, trusted 정책의 승인/진화는 별도 경계이며 이 단위에서는 공식 quality/e2e/docker를 유지한 새 PR CI 시작까지만 수행한다.

## DOCUMENTATION_SYNC

- `DESIGN.md`: N/A(Design Delta B: 기존 precise feedback·SVAR-native·focus/상태 보존 계약 구체화, 신규 전역 시각 원칙 없음)
- `docs/TEST_PLAN.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_550.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/SCHEDULING_ENGINE.md`: N/A(순수 일정/Gate/Calendar 계산 변경 없음)
- `docs/MILESTONE_TIMELINE.md`: N/A(최신 main의 canonical/Timeline 표시 계약과 기존 #550 문서 보존)
- `docs/REQUIREMENTS.md`: N/A(기존 #550 요구 및 최신 #615 main 원본 보존, 신규 업무 계약 없음)
- `docs/TASK_RELATIONS.md`: N/A(관계 편집/Dependency 계약 변경 없음)
- `docs/MILESTONE_STAGE_GATES.md`: N/A(Membership/Ready/완료 엔진 변경 없음)
- `AGENTS.md`: N/A(최신 main의 Lifecycle·QA·역할 원칙 준수)
- `docs/API.md`: N/A(새 endpoint/DTO/인증 계약 없음, #615 main 원본 보존)
- `docs/DB_SCHEMA.md`: N/A(이번 변경의 신규 migration 없음, #615 migration0025/main 원본 보존)
- `docs/SECURITY.md`: N/A(인증/Origin/revision/runtime 로그 정책 불변, test-only 안전 진단은 TEST_PLAN/REMOTE_VALIDATION에 기록)
- `docs/QA_REVIEW_POLICY.md`: N/A(현행 HIGH/OWNER_MANAGED·필수 CI/Trusted/Owner 승인 조건 유지)
- `docs/CI_CD.md`: N/A(최신 main PR #628 원본 채택, 이번 CI/Finalizer 정책 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(최신 main 원본 채택, GitHub 운영 권한·정책 불변)
- `docs/GENERIC_RELEASE_FINALIZER.md`: N/A(최신 main PR #628 원본 채택, 이전 PR #626의 중복 구현을 대체)

## AC_TEST_COVERAGE

- AC1: `tests/e2e/milestone-management.spec.ts`의 목록/생성/관리 명령 및 `milestone-management-persistence.spec.ts`의 실제 Editor·소속·관계·완료 경로
- AC2: `milestone-management.spec.ts`의 Dashboard 독립 조회·scope 불변과 `milestone-management-persistence.spec.ts`의 Milestone-only/빈 프로젝트 검증
- AC3: `tests/features/milestones/milestone-management-model.test.ts`의 root placement payload 및 `milestone-management.spec.ts`의 POST parent/sibling 불변
- AC4: `tests/features/milestones/milestone-management-model.test.ts`와 `milestone-management.spec.ts`의 같은 이름·같은 날짜 taskId 선택과 생성 ID 차집합
- AC5: `milestone-management-persistence.spec.ts`에서 기존 Task Editor와 POST/PATCH/관계/소속 API 동일 경로 검증, 새 Membership 저장소 없음
- AC6: `milestone-management-persistence.spec.ts`의 full Gate·manual event·완료잠금·legacy mixed 및 `tests/features/milestones/milestone-management-model.test.ts`의 불변 모델
- AC7: `milestone-management.spec.ts`의 dirty/pending/readonly/stale/401/412/network·응답 역전, 생성 성공 canonical revision 동기화 검증
- AC8: `milestone-management-persistence.spec.ts`의 실제 Next HTTP/native SQLite 생성→수정→소속·관계→reload·restart 영속성 검증
- AC9: `milestone-management.spec.ts`의 390/768/1024/1440/1920px 행/표 geometry·긴 명칭·keyboard/focus/Escape·내부 scroll 검증
- AC10: `milestone-dashboard-state.spec.ts`와 `project-workspace-tabs-518.spec.ts`의 Dashboard 기존 KPI/검색 및 Gantt 인스턴스/상태 보존
- AC11: `milestone-management.spec.ts`, `milestone-dashboard-state.spec.ts`와 `project-workspace-tabs-518.spec.ts`에서 기존 Grid 행·유형 quick-view·탭 보존 검증

※ 위 매핑은 테스트 위치와 기존 수행 범위를 가리키며, 전체 검증/운영환경/독립 QA를 자동 PASS로 확정하지 않는다. #2373.1 required 3개 aggregate PASS는 이전 exact head의 증거이고 새 head 재검증은 별개다.

## 2026-10-10 PR CI #2376.1 — 보호된 버전 원장과 AGENT QA 정책 차단

[PR #559 CI #2376.1](https://github.com/planner77/masterGantt/actions/runs/38036518629), head `f00835e8806c4c2dd73833a21d249890f62a2f7a`: Quality/TypeScript/Lint/Vitest/Build **PASS**, Chromium E2E 6개 shard와 required aggregate **PASS**, Docker smoke/required aggregate **PASS**. 전체 workflow 결과만 FAIL. `QA Final — Automated` job `114171633994`의 정확한 사유는 `QA 검증기/Workflow/보안 정책의 변경·rename 감지: package-lock.json, package.json — 독립 검토 및 Manager 승인 필요`다.

현재 base/main의 `scripts/qa_final_automated.py`는 `CI_EXECUTION_EXACT`에 두 버전 파일을 포함하며, `protected_paths()` 결과가 비어 있지 않으면 `qa_method=AGENT`에도 자동 QA를 BLOCKED로 처리한다. 이는 정상적인 HIGH/버전 증분 0.105.0에 대한 **유효한 승인 차단**이며 세 required 기능 검증 실패와 혼동하지 않는다. package/root lock의 버전을 되돌리거나 validator/Workflow/Ruleset을 임의 완화하지 않는다.

후속 정책 설계: [Issue #595](https://github.com/planner77/masterGantt/issues/595). #593의 Trusted provenance 보완과 중복하지 않고, 별도 독립 Reviewer의 exact-head QA와 Manager 승인 없이 protected PR의 자동 PASS나 병합을 허용하지 않는 설계를 요청했다. #550은 HIGH, `qa_required=true`, `qa_method=AGENT`, `release_required=true`, `release_authorized=false` 유지. 새 문서-only 커밋은 기존 기능 코드를 수정하지 않지만 **새 Head의 CI 결과는 별도 증거**다. 자동 QA는 #595 정책/승인 경로가 변경되지 않는 한 계속 BLOCKED 예상; 결과를 QA_FINAL PASS로 기재하지 않는다.

## 2026-10-10 — #595 최종 main 반영 후 PR #559 재정렬

- 근거: [Issue #595](https://github.com/planner77/masterGantt/issues/595) CLOSED, [PR #597](https://github.com/planner77/masterGantt/pull/597) 병합 merge SHA `26e72bbed046a6ad6721e1c3c19bda71ce42e570`, [Main CI #2401.1](https://github.com/planner77/masterGantt/actions/runs/38047530320) SUCCESS, 임시 GHCR validation/Finalizer PASS. 기능 릴리스가 아닌 기존 보호 QA 승인 및 CI Job Attempt 원장 개선을 `main` 신뢰 기준으로 수용한다.
- 이전 #550 PR Head `7f14d94cf830ef7fc70d2c902ce4597e84c62844`에서 기준 `main`보다 4커밋 뒤처져 `CHANGELOG.md`, `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`에서 내용 충돌 발생. 61개 변경 파일의 나머지 변경은 충돌하지 않으며 제품 기능·canonical Task/Gate·Readonly/Revision guard·API/DB·E2E 테스트·package/rootlock `0.105.0`은 유지한다. 3개 문서는 양쪽 #595 정책 이력과 #550 요구·검증 이력을 통합한다.
- `risk_level=HIGH`, `qa_method=AGENT`, `qa_required=true`, `release_required=true`, `release_authorized=false` 유지. 정상 version increment인 `package.json`·`package-lock.json`은 #595에서도 protected로 분류한다. 새 `main`의 검증기는 독립 인간 Reviewer의 정확한 Head `APPROVED` 및 `QA_FINAL: PASS`, 필요한 세 Required CI 성공 및 repository owner의 정확한 Head/base/Run/Attempt Manager 수용 영수증이 확인되기 전에는 자동 QA를 **BLOCKED**로 유지한다. QA 정책 우회/버전 파일 제거·허위 자동 PASS는 금지한다.
- 새 exact Head PR CI의 Quality/E2E6/Docker 및 `QA Final — Automated`는 실제 workflow 확인 전 `NOT TESTED`. 기존 [CI #2382.1](https://github.com/planner77/masterGantt/actions/runs/38038568609)의 Required 3종 PASS는 이전 Head의 역사적 증거일 뿐 새 Head 결과로 재사용하지 않는다. 관련 실제 독립 QA/Manager ACCEPT 또한 원격 증거 전 `NOT TESTED`.
- `DOCUMENTATION_SYNC`: `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`, `CHANGELOG.md`, 본 `ISSUE_550.md`를 신규 main에 정렬·갱신한다. `AGENTS.md`, `docs/QA_REVIEW_POLICY.md` 및 #595 검증기 코드는 최신 main에서 보존, 이번 PR에서 변경하지 않음 `N/A(기존 승인 정책 준수)`. `DESIGN.md`와 API/DB/Calendar/Scheduler/보안/배포 계약은 기존 #550 Work Packet 영향 분석대로 유지. #593 Trusted provenance 통합은 별도 PR 범위이며 임의 포함하지 않는다.
- 진행 범위: main 정렬·충돌 해결·새 PR CI **시작까지만**. 독립 QA 완료·Manager 승인·PR 병합·Main CI·정식 GHCR 게시·Issue 종료는 요청 범위에서 제외한다.

## 2026-10-10 — PR CI #2404.1 FAIL (test merge 불일치) 및 #589 병합 정렬

- 원본: [PR #559 CI #2404.1](https://github.com/planner77/masterGantt/actions/runs/38049115763), HEAD `de9eb8286ad237f47e1c3fef0767afcbacc410f4`, Quality/정책/TypeScript/Lint/Vitest/Build **PASS**, Chromium E2E 6/6 및 aggregate **PASS**, Docker smoke 및 aggregate **PASS**. 전체 run `failure`의 유일한 실패 Job은 `QA Final — Automated` `114208535287`이며 로그 `mergeability 또는 test merge 불일치` → BLOCKED. 이는 이전 protected-file 독립 QA 미확보 사유와 구분한다.
- 최신 main `31372f967159b2f993116c73f0adc228eb1ea0ff`은 기존 merge-base `26e72bbed046a6ad6721e1c3c19bda71ce42e570` 대비 #589에서 문서 3개(`DESIGN.md`, `docs/exec-plans/active/ISSUE_589.md`, `docs/exec-plans/active/PLAN.md`)만 수정했다. #589 전역 UI/UX Skill Design Delta와 계획/Work Packet을 모두 보존하고, 기존 #550 제품 구현·테스트·버전 `0.105.0`과 #595 QA 검증기 변경은 불변으로 2-parent merge한다. 공통 PLAN의 #589 섹션을 기존 #550/#595 기록 앞에 추가하되 그 나머지 동일 내용을 변경하지 않는다.
- `DOCUMENTATION_SYNC`: `docs/exec-plans/active/ISSUE_550.md` 및 `docs/exec-plans/active/PLAN.md` **UPDATED**(CI 실패 증거·재정렬·QA 잔여조건); `DESIGN.md`/ `ISSUE_589.md`는 main 최신 파일 **동일 blob 유지**(이번 Issue의 신규 디자인 원칙 없음); `AGENTS.md`, QA/CI/REQUIREMENTS/TEST_PLAN/API/DB/SECURITY/스케줄러/제품 파일은 계약·코드 불변으로 **N/A**. 기존 AC1~AC11 테스트 매핑은 그대로 적용된다.
- 최종 HEAD의 CI/QA는 이전 run과 별도 검증한다. 이 변경은 제품 코드 수정이 아니라 merge와 문서 정합이다. 로컬 테스트/실제 운영 검증을 새로 실행했다고 주장하지 않는다. 독립 인간 리뷰 + QA_FINAL PASS, 정확한 HEAD/base/run/attempt Manager ACCEPT가 없으면 protected version input 때문에 자동 QA가 BLOCKED여도 우회하지 않는다. `release_required=true/release_authorized=false`; 새 PR CI 시작 이후 merge/main/GHCR/tag/Issue 종료 금지.

## 2026-10-11 — CI #2414.1 원인 및 Owner-managed 최신 main 정렬

- [PR #559 CI #2414.1](https://github.com/planner77/masterGantt/actions/runs/38051399462), 이전 Head `cb360903dfac443547e9e16e1091273eca669400`: Quality/typecheck/lint/Vitest/build, Chromium E2E 6개 shard/aggregate, Docker smoke/aggregate 모두 PASS. `QA Final — Automated` job `114213762765`만 `AGENT 보호 파일: 현재 Head에 대한 독립 인간 QA_FINAL: PASS 리뷰 필요`로 BLOCKED/FAIL. 이전 상태를 SUCCESS로 소급하지 않는다.
- Main 기준 `31372f967159b2f993116c73f0adc228eb1ea0ff`→`e41696430a78045998e35edad7cab5bb901a097e` 41커밋/27경로. 직접 겹친 것은 TEST_PLAN/PLAN 2개. 25개 비중복 경로의 신규 main Blob SHA를 그대로 유지하고 TEST_PLAN의 #598 정책 및 #582 CI 표시/Finalizer 회귀, PLAN의 #598 절과 본 #550 이력을 병합한다. 기존 Milestone UI/E2E/SQLite/버전 `0.105.0`, canonical/Revision/권한 Guard는 불변.
- 최신 main #598 Owner-managed QA를 채택: `risk_level=HIGH`, `qa_required=true`, `qa_method=OWNER_MANAGED`, `independent_qa=N/A(Owner-managed, 미실시)`, `manager_decision=NOT TESTED`. 과거 AGENT 필수 리뷰 기록은 당시 정책 이력으로 보존하되 현 PR의 선택 QA 경로가 아니며, 자동 QA PASS/신뢰된 main 검증 결과와 Owner의 명시 병합 승인을 혼동하지 않는다. `release_required=true/release_authorized=false` 불변.
- `DOCUMENTATION_SYNC`: `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`, 본 Work Packet UPDATED; main의 AGENTS/QA_REVIEW_POLICY/CI_CD/GITHUB_OPERATIONS/Workflow/scripts/#582/#598 정책·검증 코드는 그대로 사용; DESIGN/API/DB/SECURITY/SCHEDULING/UI/기존 E2E 구현은 의미 변경 N/A. AC1~AC11 테스트 매핑 보존.
- 이번 정렬은 로컬 기능 재실행을 수행하지 않았으므로 Unit/Chromium/SQLite의 기존 수치를 새 Head의 로컬 PASS로 재명명하지 않는다. 새 Head Full PR CI는 시작까지만 확인하며 결과/independent QA/Owner ACCEPT/병합/Main CI/GHCR/tag/Issue 종료는 수행하지 않는다.

## Issue #550 — 2026-10-11 23:45 KST 최신 main 정렬·충돌 해소

- 대상 [PR #559](https://github.com/planner77/masterGantt/pull/559) 기존 Head `ab539c9cf03938754bbe2a74032b43a99ba9ca8e`, 기준 main `cbc73740236f3b3e177e2ed3196a0d02a292c741`. main 대비 150개 커밋 후행 및 직접 중복 변경 파일 9개(CHANGELOG, MILESTONE_TIMELINE, PROJECT_UX, TASK_EDITOR, TEST_PLAN, PLAN, package.json/lock, project-readonly-view.tsx)를 확인했다. main의 변경 파일 85개 중 비중복 76개는 동일 Git Blob을 유지하고, #550 고유 기능/증거 파일 52개도 보존한다.
- Workspace **세 가지 동일 위치 충돌 수동 해결**: (1) `saveTask`의 #572 `deferredSuccess` 옵션과 #550 `onCanonicalSuccess` callback을 함께 보존해 Milestone root 생성 POST에서 새 callback을 8번째 인자로 전달한다. (2) 저장 성공 시 #572의 `confirmed` identity/revision/name 반환과 조건부 알림을 유지하면서 생성 성공 callback을 정확한 canonical snapshot에 한 번 호출한다. (3) Editor 닫기에서 #571의 `finishTaskEditor(false)` 명시 Task reveal은 focus를 강제로 되돌리지 않고 일반 닫기는 #550의 보이는 Dashboard trigger/fallback을 사용한다. 최근 Gantt viewport coordinator와 #550 Dashboard 관리/초안·revision guard는 모두 유지한다.
- 공통 문서는 양쪽의 헤더·본문 추가를 보존했다. Changelog에는 기존 `0.104.4` 및 #550 신규 MINOR `0.105.0` 기록을 함께 유지한다. package/lock은 #550 의도된 `0.105.0`(main의 `0.104.4` 이후 MINOR)을 선택하고 의존성 변경 없이 기존 manifest 동기화를 유지한다. Milestone 원본·명시 상태/소속·관계/readonly/412 계약 불변.
- `DOCUMENTATION_SYNC`: 본 Work Packet, PLAN, TEST_PLAN **UPDATED**(정렬·충돌 근거·검증 계획). MILESTONE_TIMELINE/PROJECT_UX/TASK_EDITOR/CHANGELOG는 양쪽 변경 문단을 보존해 병합. `AGENTS.md`/기타 QA/CI/docs 및 #570·#571·#572 실행코드는 main Blob 그대로 사용. DESIGN/API/DB/SECURITY/SCHEDULING은 새 계약 변경 없음 N/A.
- 이번 커밋의 정적 문자열/중복 코드 경계 확인은 수행했지만, 새로운 Head의 TypeScript/Unit/Chromium E2E/SQLite/Docker, 실기기·운영 테스트는 아직 NOT TESTED. 실제 결과는 새 exact-Head PR CI로 검증해야 한다. `qa_method=OWNER_MANAGED`, `risk_level=HIGH`, `qa_required=true`, `release_required=true/release_authorized=false`; 독립 QA 선택 미실시와 Owner 승인 부재를 자동 PASS로 간주하지 않는다. 이번 사용자 요청은 재정렬/충돌 해결까지만, 병합/Main CI/정식 GHCR/tag/Issue 종료 금지.

## Issue #550 — Main CI #2515.1 #525 Resource→Gantt peer 복원 경합 보완 (2026-10-12)

- 기준 병합 SHA `40747252c389f2a4d1203a2262a4caa49c90728d`, [Main CI #2515.1](https://github.com/planner77/masterGantt/actions/runs/38170382648), Chromium shard2 job `114561630041`: **71 PASS/1 FAIL**. 실패 `tests/e2e/project-resource-workload-status.spec.ts:132`의 `summaryToggle` `toHaveClass(/wxi-menu-right/)` 호출은 대상 Summary native row가 보이지 않아 5초 timeout. 다른 E2E 5샤드/Quality/Docker는 PASS이며 전체 Main CI와 GHCR publish는 FAIL/SKIPPED.
- 실제 [실패 Playwright report·trace](https://github.com/planner77/masterGantt/actions/runs/38170382648/artifacts/11714103415)에서 일정 탭 복귀 직후 최초 Core/native position `left=1581,top=96`가 동일해도 `data-gantt-viewport-coordinator`는 아직 `kind=PEER_RETURN,phase=WAIT_GEOMETRY`였다. 다음 테스트가 `.wx-gantt.scrollTop=0`을 수행하는 동안 복원 의도가 완료되어 실패 snapshot에서 `top=96`, `phase=SETTLED,outcome=SETTLED`와 Summary row 비표시를 확인했다. 좌표 동등성은 비동기 복원 완료 영수증이 아니다.
- 테스트 보완: 동일 test `#525`에서 복귀 원본 `before` 좌표/instance/Week 검증 이후 coordinator의 **실제** `PEER_RETURN:SETTLED/SETTLED` 상태를 bounded `expect.poll`로 확인한 다음 좌표를 다시 strict 확인하고 기존 scrollTop0→Summary collapsed·하위 미표시→scrollTop96·원장 equality를 그대로 수행한다. 고정 sleep/기다림 시간 증가/skip/retry/기대치 완화는 하지 않는다. 제품 코드, viewport writer·API/auth/SQLite·CI 검증기 및 Ruleset 변경 없음.
- `DOCUMENTATION_SYNC`: `tests/e2e/project-resource-workload-status.spec.ts` UPDATED, `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`, `docs/exec-plans/active/ISSUE_550.md` UPDATED. `DESIGN.md`, `AGENTS.md`, `docs/REQUIREMENTS.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/SECURITY.md`, `docs/SCHEDULING_ENGINE.md`, `docs/PROJECT_UX.md`, `docs/REMOTE_VALIDATION.md`는 업무·도메인·운영 계약 불변으로 N/A. 원래 AC1~AC11의 테스트 매핑은 유지하고 #525 추가 교차 회귀를 덧붙인다.
- `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`; 버전 `0.105.0` 변경 없음(이 변경은 회귀 테스트 실행 순서 안정화만). 기존 사용자 GHCR 정식 게시 승인 marker (Issue #550, `v0.105.0`)는 유지하지만 실패한 Main SHA를 release 성공 근거로 사용할 수 없다. #550 Issue는 미완료 Main/GHCR를 이유로 OPEN으로 재개했다. 후속 동일 이슈 corrective PR의 exact-Head Quality/E2E6/Docker, Trusted QA, Manager 승인, 병합 후 **새 immutable SHA Main CI**가 SUCCESS여야 릴리스 진행 가능. PR CI/운영/정식 GHCR PASS는 실제 실행 전 NOT TESTED.

## Issue #550 — PR #626 CI #2517.1 #571 Editor locate 포커스 검증 보완 (2026-10-12)

- 원본 [PR CI #2517.1](https://github.com/planner77/masterGantt/actions/runs/38172515105) / head `a876772004394e006b15be852145f14e9b19a13b`은 전체 FAILURE. Main #2515.1의 원래 실패가 포함된 Chromium shard2는 **72/72 PASS**, Quality/Vitest/Build/Docker 및 E2E shard1/2/3/5/6 PASS. Chromium **shard4 106 PASS/1 FAIL/1 SKIP**의 `tests/e2e/viewport-coordinator.spec.ts:30` `toBeFocused()`가 실패; E2E aggregate와 자동 QA도 FAIL. 두 실패는 별개의 수용조건이며 하나의 PASS가 나머지를 대체하지 않는다.
- [shard4 Playwright trace](https://github.com/planner77/masterGantt/actions/runs/38172515105/artifacts/11714409132)는 Editor 소속 작업의 `일정에서 보기` 이후 `TASK_REVEAL` 코디네이터가 `WAIT_GEOMETRY → APPLYING → SETTLING → SETTLED`를 거쳐 Core/native 스크롤 위치가 `0/117`로 일치했음을 보여준다. 그러나 실제 대상 Grid 행의 focus는 확인되지 않음. `core.top < 300` 조건은 아직 SETTLING 중에도 성립하므로 포커스 완료의 근거가 아니다. 정확한 DOM 포커스 소실 시점을 단일 trace만으로 단정하지 않는다.
- 앱 조치: `project-readonly-view.tsx` 명시 Task reveal SETTLED callback에 **최대 12개 requestAnimationFrame**의 bounded DOM focus handoff를 추가한다. 일시적인 SVAR 가상화 행 교체 뒤에는 현재 visible Grid 행을 다시 찾아 focus를 전달하고, 3연속 프레임/최소7번째 프레임에서 identity를 확인한다. Controller/API instance·canonical revision/projection·Core/native 위치 정합, hidden/inert, 새 modal/Editor, 사용자 제3 control focus를 검사하여 intent가 낡으면 abort한다. scroll writer/다른 기능·아티팩트 권한 확대·무기한 retry 없음.
- 테스트 조치: `viewport-coordinator.spec.ts` 기존 실제 `toBeFocused()` 및 Core/native±1px·후속 metadata strict equality를 그대로 두고 `TASK_REVEAL:SETTLED/SETTLED`를 bounded poll로 확인한다. 추가로 8RAF 뒤에도 **동일 실제 Grid row가 focused**인지 다시 검사한다. expectation/timeouts/shard/skip/retry 약화 없음. 기존 #525 복귀 SETTLED 검증도 유지.
- **Main 정렬:** 보완 PR #626 base `40747252c389f2a4d1203a2262a4caa49c90728d`, 최신 main `9f17dbb2ad6814d952aef4fb1b6eaea721fb6794`(#614 Target domain/fixture) 추가 4 commits. Main의 #614 CODE/문서와 TEST_PLAN 후미 증거, PLAN의 #614 신규 Work Packet 절을 그대로 보존한다. 이 변경은 #550 추가 요구/Target runtime 확대가 아니다.
- **DOCUMENTATION_SYNC:** `src/features/projects/project-readonly-view.tsx`, `tests/e2e/viewport-coordinator.spec.ts`, `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`, `docs/exec-plans/active/ISSUE_550.md`, `CHANGELOG.md` UPDATED. `DESIGN.md`, AGENTS/CI_CD, API/DB/SECURITY/SCHEDULING, 리소스 도메인 문서/fixture는 계약 변화 없거나 Main 최신 그대로여서 N/A. 기존 #550 AC1~11 테스트 원장과 실패 원본 보존.
- Version `0.105.0` 및 package/lock은 기존 릴리스 후보로 유지하고 `CHANGELOG.md`에는 이번 focus 보완을 기록(새 tag/정식 GHCR 아직 게시된 증거 없음). HIGH, `qa_method=OWNER_MANAGED`, 3 Required Quality/E2E/Docker·Trusted QA/Owner 승인 유지. Issue #550의 정식 v0.105.0 승인 marker는 별도 권위이며 corrective PR 자체는 추가 버전 bump 없음. 새 Head PR CI·Trusted QA·Main CI/임시 GHCR/정식 Release는 성공 전 **NOT TESTED**, 이번 사용자 요청은 새 PR CI 시작까지만. 결과 확인/병합은 별도 Gate.

## Issue #550 / PR #626 — PR CI #2519.1 회귀와 P1 Release 승계 보완 (2026-10-12)

- 기준 Head `9f4656006648cc6c49c617699bd73feb7f109aa7`, [PR CI #2519.1](https://github.com/planner77/masterGantt/actions/runs/38177366596): Quality/TypeScript/Lint/Vitest/Build, Docker, Chromium E2E shard 1/2/3/4/6 PASS. Shard 5의 `tests/e2e/task-editor-form-density.spec.ts:279` #570 보호 블록 계측 1건 FAIL (97 PASS). E2E 집계·QA Final FAIL은 원본 상태로 보존한다.
- [Playwright 실패 trace](https://github.com/planner77/masterGantt/actions/runs/38177366596/artifacts/11717290669)에서 metadata `PASSIVE_RESTORE`는 `SETTLING` 단계인데 테스트가 좌표 일치를 완료로 오인하고 `chart.scrollLeft=0`을 주입했다. `data-gantt-peer-native-repairs` 1→2와 이후 `PASSIVE_RESTORE:SETTLED`는 보였지만 `data-gantt-peer-scroll-guard-blocks` 증가 기록은 없었다.
- 보완 테스트는 실제 `PASSIVE_RESTORE`의 `SETTLED`/`outcome=SETTLED` 영수증과 Core/native left=120을 Playwright 기본 bounded poll로 확인한 뒤 **동일한** 비사용자 native zero를 주입한다. 기존 `blocks > before`, 실제 Core/native 120 복원, 사용자의 wheel 좌우 이동, 검색 결과0·PATCH2·Gantt instance 불변 조건을 한 건도 삭제·완화하지 않는다. Workflows/test timeout/retry/skip 변경 N/A.
- Codex P1 Review [PR #626](https://github.com/planner77/masterGantt/pull/626): 실패 Main #2515.1의 최초 #550 merge가 `0.104.4 → 0.105.0`을 도입했고, 새로운 corrective는 manifest `0.105.0 → 0.105.0`이다. 기존 Generic Finalizer에서 실패 SHA supersede 시 release-required를 원장 없이 소거하는 것은 승인된 정식 GHCR 게시를 누락하고 Issue를 닫을 위험이다.
- `scripts/auto_release_finalizer.py`: immutable first-parent 버전과 미완료 Release origin을 `inherited_release_previous_version`으로 분리하고, 동일 Issue+정확한 Main CI 성공+동등 검증+동일 최종 버전 corrective에 상속한다. 상속된 effective item의 exact tag/Release evidence 재판정 후 기존 Owner 승인 `expected_version=0.105.0` 없이는 tag/registry mutation 금지. 임시 candidate/cleanup, 버전 충돌·tag immutability fail-closed 유지.
- `scripts/verify-issue-lifecycle.py`: #550 원본 실패와 같은-version Green correction, release `not-started`, cleanup debt, docs-only correction 차단, 달라진 version no-bump 차단, 새로운 version bump authority 분리 시나리오 추가. 기존 #586/#344 supersede tests 유지. 실제 Runtime/CI/GHCR/Owner Final 인증은 새 Head 결과 전 NOT TESTED.
- DOCUMENTATION_SYNC: `tests/e2e/task-editor-form-density.spec.ts`, `scripts/auto_release_finalizer.py`, `scripts/verify-issue-lifecycle.py`, `docs/GENERIC_RELEASE_FINALIZER.md`, `docs/CI_CD.md`, `CHANGELOG.md`, 본 TEST_PLAN/PLAN/ISSUE_550 UPDATED. AGENTS/DESIGN/API/DB/SECURITY/SCHEDULING/Project UX/CI workflow는 기능·설계 계약 불변으로 N/A.
- 위험: HIGH, QA OWNER_MANAGED. PR #626 자체의 제품 version 변경 없음(`0.105.0` 유지)이 원래 Issue #550 정식 v0.105.0 Release 의무의 N/A 근거가 아니다. 원본 사용자 Owner 승인 marker는 [Issue #550](https://github.com/planner77/masterGantt/issues/550#issuecomment-6113115242)에 보존한다. 새 PR CI Quality/E2E/Docker/QA/Trusted, Main CI와 formal GHCR는 아직 NOT TESTED이며 병합·발행/Issue close는 범위 밖.

## 2026-10-12 — PR #626 CI #2522.1 문서 영향 추적 보완

[PR CI #2522.1](https://github.com/planner77/masterGantt/actions/runs/38179746368) exact Head `b871c381ead864dc0a699526f965fd08f2e8c4ec`는 Quality/Vitest/Build, Chromium E2E 6/6, Docker 모두 SUCCESS이나 QA Final — Automated에서 `문서 영향 기록 없음: docs/GITHUB_OPERATIONS.md`로 BLOCKED/FAIL이었다. 제품 회귀·검증기 버그로 판정하거나 기존 FAIL을 성공으로 변경하지 않는다.
스크립트 보호 변경의 QA_DOCS 6개 및 UI 변경의 DESIGN impact Union을 재확인했다. `docs/CI_CD.md`와 `docs/TEST_PLAN.md`는 기존 PR 코드에서 UPDATED 상태였고, `docs/GITHUB_OPERATIONS.md` 및 `docs/REMOTE_VALIDATION.md`에 release debt 승계 운영·원격 검증 Gate를 실제 기록한 뒤 본 Work Packet의 정형 `## DOCUMENTATION_SYNC`에 세 운영 문서 UPDATED 항목을 추가했다. AGENTS/QA_REVIEW_POLICY/DESIGN N/A는 기존 운영 원칙 자체가 바뀌지 않았기 때문에 항목별 기존 근거를 유지한다.
원래 Issue #550의 Owner 승인 범위 `v0.105.0`, 실패한 원본 Main #2515.1, 동일 버전 non-docs corrective의 정식 GHCR 미게시 의무를 보존한다. 최종 정확 Head의 새 PR CI/Trusted·Owner 승인·병합/Main CI/GHCR/tag/Issue 종료는 새 원격 근거 전 NOT TESTED. 보호 Gate 삭제·더 느슨한 QA 조건·기능 코드 변경 없이 문서 및 감사 원장만 갱신한다.


## 2026-10-12 — 공유 분석 후속·CI #2524.1 기능/E2E 경계

### 원본과 최신 main 정렬

- [공유 분석1](https://chatgpt.com/s/t_6acc206bffc88191943b2f6ff78b6113)과 [분석2](https://chatgpt.com/s/t_6acc20b3d84c8191b95862bbcfea3ae7)의 본문을 확인했다. 주요 조치는 좌표·Coordinator·DOM focus 완료의 분리와 연결 오류의 cleanup 전 진단이다. #629 QA preflight 등 비기능 CI 정책은 사용자 별도 작업이다.
- [PR #626 CI #2524.1](https://github.com/planner77/masterGantt/actions/runs/38181808391), Head `ddb4fe246e06bea6f6a9b5a3b193594566450cc8`: Quality/Docker PASS, E2E shard2 job `114595815902` #461 실제 SQLite Editor GET의 ECONNRESET1FAIL/71PASS, 나머지5샤드 PASS. [실패 report](https://github.com/planner77/masterGantt/actions/runs/38181808391/artifacts/11717859352). 프로세스 종료·OOM 근인 UNKNOWN. 직전 #2522 대비5문서만 바뀐 점은 기능 회귀 단정의 근거가 아니다.
- 격리 worktree `/tmp/mastergantt-issue-550-fix`, 로컬 `fix/issue-550-analysis-followup`은 기존 PR #626 Head에서 시작한다. main `c8949da48e7465db45d871887c3f55f9fb6dc743` 병합 `e2c03fac58a77f1228be4205b78cccc3d0eb7374`는 CHANGELOG/PLAN 양쪽 이력을 보존한다. 이어 main `6eaec3331fcbc720ab42106789a505c5ee5eefb4` 병합 `f0b89d699e569f0e8761f7134bf1ebd63c699d2b`로 PR #628을 상속한다. REMOTE/TEST 양쪽 이력을 보존하고 Finalizer 두 스크립트 및 CI_CD/GENERIC_RELEASE_FINALIZER/GITHUB_OPERATIONS는 최신 main exact blob을 채택한다.
- #615 모델/API/migration0025와 manifest/lock0.106.0를 보존한다. 이전 PR #626의 `inherited_release_previous_version` 구현은 main의 `inherited_release_base_version`/`release_base_version` 및 stricter 승계 규칙으로 대체한다. 과거 원장을 삭제하지 않으며 현재 PR이 v0.105.0의 기존 승인을 다른 버전으로 확대하지 않는다. release 의무 해결/권한은 별도 사용자 작업이며 새 CI 시작은 그 승인·완료가 아니다.

### 분리 소유권·구현 계약

- Manager: 통합/문서/DOCUMENTATION_SYNC/Issue 공식 댓글. frontend `gantt550`: view/controller/최소 Gantt 등록 seam/focus helper·관련 Unit/strict viewport E2E. backend `domain_audit`: isolated fixture/진단 helper·Unit/#461 spec. ui_ux `ux_contract`: read-only 설계·공식 SVAR 비교. qa_docs `f0_pre_qa`: 독립 read-only 사전 검토. infra `publish_pr`: 동결 후 기존 PR branch 게시·CI 시작 확인만. 동시 파일 writer/재귀 위임 없음.
- UI 검토에서 기존12RAF 인계가 SETTLED 후 동일 좌표 사용자 입력·새 intent와 짧게 열리는 modal 이후 focus를 가져올 수 있는 gap을 확인했다. 정확한 Coordinator intent/gesture/context stamp 및 local locate generation으로 권한을 제한하고 새 modal은 대기 대신 영구 취소한다. Grid viewport 가시성을 확인하며 좌표 SETTLED와 별도 focus 결과를 구분한다. 일반 Editor 닫기/Dashboard fallback을 유지한다. 좌표 미완료 시 focus SUPERSEDED는 인계 미시작이며 원래 좌표 실패/timeout 영수증을 대체하지 않는다.
- 공식 SVAR `select-task`/`scroll-chart`와 설치 Core2.7.3 types를 비교한다. 설치 `select-task.focus`는 `grid|chart`이며 온라인의 `subGrid`는 PRO 범위다. 공개 API가 가상화 DOM focus 안정 완료를 보장한다고 가정하지 않는다. 실제 demo 조작은 NOT TESTED, 제품 Chromium 실행과 구분한다. Design Delta B, DESIGN.md N/A.
- fixture는 bounded allowlist stdout/stderr 구조화 기록과 PID/generation/exit/signal/expected shutdown, test-side 호출·기존 서버 완료 requestId, 실패 직전1회 readiness 및 가능한 numeric 자원을 수집한다. 서버 request-start·raw Next stderr/stack·headers/cookies/body/query/env/DB는 수집하지 않는다. 종료137만으로 OOM 단정 금지. 진단은 원래 transport 오류를 보존하며 business retry0이다.
- 기존 #525/#570 strict SETTLED 후 조작·실제 좌표/tree/instance/selection/guard/wheel/검색 검증과 #571 실제 Grid focus+후속8RAF를 유지한다. 제한 시간·retry·skip·CI shard/required checks·runtime 권한 변경 없음.

### 검증 상태와 종료점

정확한 lockfile `npm ci --no-audit --no-fund` PASS. 최초 shared node_modules symlink/Next16.3.4의 baseline setup3FAIL은 환경 오류로 보존하고 원격 ECONNRESET 재현으로 세지 않는다. 새 lockfile Next16.3.8 조건의 scoped Unit/Chromium과 독립 PRE_QA 결과는 아래 실행 원장에 기록한다. HIGH / qa_required=true / qa_method=OWNER_MANAGED. 새 exact-head PR CI Quality/E2E/Docker·Trusted·Owner ACCEPT는 NOT TESTED이며 요청 종료점은 기존 PR #626의 full CI 시작까지다. 병합·Main/GHCR·tag/release·브랜치 정리·Issue 종료는 수행하지 않는다.

### 후속 Local Fast Feedback 실행 원장

- frontend 최종 동일 소스: 관련 Unit6파일133/133 PASS, `npm run typecheck` PASS, 변경 ESLint0error/기존 project-gantt hook warning3. 관련 Chromium3spec 최종23/23 PASS(1.3분), 핵심6case×repeat3=18/18 PASS(1.1분). 반복 검증 후 transient-modal E2E의 인과성 assertion만 강화했고 최종23건에는 해당 강화분을 포함했다. 중간5PASS·22PASS와 합산해 고유 테스트 수를 부풀리지 않는다.
- 최종 helper Git blob `bddcee5340b542834c6ad381fd1d56b827fb3b24`, viewport E2E `6e3947bafbe1e76cdfa0f8f31b28d73dd082ae1e`. source/helper는09:04 KST, 최종 E2E는09:07 KST에 동결했다. 로컬 `/tmp/issue550-frontend/result.json`·full23-report·repeat18-report의 manifest/실행 원본으로 연결한다. 로컬 임시 config/build/캡처는 Git에 포함하지 않고 generated next-env/tsconfig와 기존 tracked 캡처를 원복했다.
- ui_ux 최종 read-only 설계 비교: transient modal MutationObserver/cleanup으로 이전 REWORK 해소, exact stamp/local generation/Task ID/행 가시성·별도 focus 결과/일반 닫기 보존 계약 일치. viewport 교차는 전체 focus ring 비가림 검증과 다르며 이를 새 PASS로 확대하지 않는다.
- qa_docs 독립 frontend 직접 Unit2suite92/92 PASS 및 정적 검토 material blocker0. 이92건은 구현자133건과 겹치며 합산하지 않는다. backend·최종 문서·staged tree의 통합 PRE_QA는 뒤에 별도로 기록한다.

- 실제 SQLite #461은 Manager 환경에서 변경 전 fixture3/3 PASS(1.0분), 최종 변경 fixture3/3 PASS(1.0분), workers1/retries0으로 실행했다. 두 실행 모두 final frontend·Next16.3.8·lockfile0.106.0 조건이다. baseline은 변경 전 fixture/spec 복사본의 repositoryRoot만 worktree로 고정했다. `/tmp/issue550-sqlite-evidence/result.json`에 명령·조건을 보존하며 수정 후 geometry만 별도로 보존했다. 두 번의1.0분 표시로 성능 개선을 주장하지 않는다. ECONNRESET 미재현이며 원격 근인 UNKNOWN 유지.
- subagent 환경은 exact dependency 후에도 loopback EPERM setup3FAIL/BLOCKED였다. 승인 대기 상태를 중단하고 Manager 실행으로 인계했다. 최초 shared dependency symlink/16.3.4 setup3FAIL과 이 EPERM은 원격 연결 오류 재현이 아니다. Manager 일반 실행에서는 loopback·실제 Next/native SQLite 검증이 가능했다.
- backend 진단 Unit7/7·typecheck·scoped ESLint PASS. real child 검증의 최초80ms 타이머를 stdout/stdin handshake로 바꾼 뒤 독립 실행에서6PASS/1FAIL(5000ms timeout) 및 해당1건 재실행FAIL이 발생했고, 동일 소스 Manager Unit7PASS와 구분해 REWORK했다. 독립 최소 probe는 해당 실행 환경에서 실제 exit7을 관측해도 stdout data0회인 차이를 보였으나 정확한 원인은 UNKNOWN이다.
- 최종 Unit은 전용IPC ready→자원 관측→stop→stopping ACK→exit7/close로 제어하고 early error/close·안전한 실패 phase를 관측한다. 기존5000ms를 늘리지 않았다. 구현자 수정 후2회 Unit7PASS·typecheck/lint PASS 및 Manager 최종 Unit7PASS(09:14:42). 최종 Unit SHA-256 `96d7213c17dd214355595f96227d8010d7c08a73e6af0a201aa1989b7090e36f`. 이 수정은 Unit만 바꾸므로 fixture/helper/spec의 실제 SQLite3PASS는 유효하며 초기 독립 FAIL을 지우지 않는다.

- qa_docs 최종IPC Unit7/7 직접 PASS(09:14:40,166ms). frontend직접92Unit과 최종보고서 full23/repeat18의 expected/실패/flaky/skip 수를 독립 확인했다. 이전 stdout/stdin 실패는 삭제하지 않는다. 통합 PRE_QA와 exact staged tree 판정은 Issue STATUS 및 PR 본문에 기록하며 QA_FINAL/Owner ACCEPT와 구분한다.
