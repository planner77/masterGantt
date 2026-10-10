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

- `DESIGN.md`: N/A(기존 Milestone 명칭과 화면 공통 디자인 원칙을 그대로 사용하여 신규 시각 정책이 없다)
- `docs/TEST_PLAN.md`: UPDATED
- `docs/SCHEDULING_ENGINE.md`: N/A(동일 canonical Task 및 기존 Gate와 의존성·Calendar 계산을 재사용하고 순수 일정 엔진 변경이 없다)
- `docs/MILESTONE_TIMELINE.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/TASK_RELATIONS.md`: UPDATED
- `docs/MILESTONE_STAGE_GATES.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_550.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `AGENTS.md`: N/A(기존 Issue lifecycle과 QA/보안 경계 및 역할 분담을 변경하지 않아 원칙을 재사용한다)
- `docs/API.md`: N/A(새 HTTP endpoint와 DTO 스키마 없이 기존 저장 gateway 및 보호 요청을 재사용한다)
- `docs/DB_SCHEMA.md`: N/A(신규 migration과 저장소·SQLite 스키마 변경 없이 기존 엔터티를 이용한다)
- `docs/SECURITY.md`: N/A(기존 server-side session/Origin/If-Match/revision guard와 readonly 권한을 유지한다)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 HIGH 보호 파일의 독립 리뷰 요구를 완화하지 않고 그 제한을 적용한다)

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
