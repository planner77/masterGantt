# Issue #552 — WBS 표시 분리와 Milestone 표시 전환

## Issue Work Packet

- issue: https://github.com/planner77/masterGantt/issues/552, Epic #548 MT4. 최신 OPEN/comments0. 과거 등록-only 본문은 최신 사용자의 구현·PR CI 시작 요청으로 대체한다.
- lifecycle_phase: ANALYSIS → PLAN → VERSION_DECIDED → BRANCH_READY → IMPLEMENTING → LOCAL_VALIDATED → DOCUMENTATION_SYNC → PRE_QA → PR_CI_STARTED.
- live main: 08ac7749efc4544dfc125853d9e58ef3a9d56b21 / 0.102.1.
- baseline/parent: #551 PR #560 head fb6e5a634b3fcd70d62d4e8404a42cefe0ab6ce9 / tree 581837e6840c5438387a1054bc3d1745a2924399 / 0.105.0.
- predecessor CI: https://github.com/planner77/masterGantt/actions/runs/37821023371 / #2217.1 / pull_request / attempt1 / exact head 등록2026-10-09 03:01:42KST. 등록 조회1회, 결과 모니터링0.
- dependencies: #549 PR557/head4bc4c31d9c5f46d90a83cbe4de878a52a2f2529b, #550 PR559/head31345da9346dfbdc1ac02e4e7ca567edafec775f, #551 PR560/headfb6e5a634b3fcd70d62d4e8404a42cefe0ab6ce9. 각 준비 코드/문서/LFF와 독립 PRE_QA는 확보했으며 공식 원격 결과/main 통합은 NOT TESTED.
- branch/worktree: feat/issue-552-milestone-visibility / /home/planner/Dev/masterGantt-worktrees/issue-552, stacked PR base feat/issue-551-milestone-timeline-lane.
- intake: remote issue552 branch0/해당 head PR0. Refs 검색 도구가 Issue를 반환한 것은 PR 근거가 아니며 infra가 실제 PR 중복을 확인한다.
- version_decision: Manager MINOR 0.105.0→0.106.0, 기본 표시/필터·탐색 계약 전환. package/rootlock/CHANGELOG 단일 writer Manager.
- release_required=true / release_authorized=false. 승인 endpoint 각 구현/docs/원격 PR/exact-head CI 등록뿐. 결과 모니터링·merge/main/GHCR/tag/release/Issue close/branch cleanup은 비범위.

## scope / AC / main 활성화 경계

#550 관리 진입과 #551 lane를 함께 준비한 stacked candidate에서 기본 ON 표시 설정·M native 행 제외·세 quickview 교체를 구현한다. main의 실제 활성화나 전체 선행 CI PASS로 보고하지 않는다. 이슈의 main 통합/최종 활성화 gate는 향후 승인된 병합·공식 회귀 뒤에 별도로 판정한다.

canonical 전체 Task/Link/ID/parent/siblingOrder/date/progress/Membership/Gate/rollup/export를 보존한다. 기존 ProjectGantt는 full tasks/links와 별도 visibleTaskIds를 받는다. 새 WBS 표시 projection은 Summary/Task만 표시하고 현재 scope/조건과 AND한다. Grid와 Chart를 같은 공개 filter/queue로 바꾸며 CSS 숨김/원본 subset 저장/가짜 endpoint를 금지한다. 숨은 M endpoint Link는 표시하지 않되 canonical 관계·관계 Editor·일반 Task→Task 동작을 보존한다.

전체/Task/Milestone 세 버튼을 독립 `Milestone 표시` 토글로 교체한다. readonly 사용 가능, default ON, 프로젝트별 schema `{version:1,showMilestones:boolean}`과 #549 정규화·storage 오류 fallback 사용. TaskFilterState.types/필터 active count/scope/peer/초기화와 표시 설정은 분리한다. 일시 override와 명시 toggle의 단일 authority를 유지하고 #551 개발 preview OR가 실제 설정을 덮지 않도록 제거/정규화한다. 새 URL/storage types 스키마를 발명하지 않는다.

고급 유형 UI는 Summary/Task만 제공한다. 실제 기존 types는 React memory와 scope map이며 URL/storage에 없다는 #549 조사와 현재 코드를 대조한다. all/Task/mixed는 비유형 조건을 유지하며 M만 제외한다. M-only는 원래 조건을 보존하고 기존 Dashboard 보기/유형 조건 해제의 명시 compatibility 경로를 제공한다. 빈 WBS를 전체 Task로 조용히 넓히지 않는다. effective M 소속 필터는 full snapshot 계산·현재 WBS scope·다른 조건 AND이며 M 자체 행을 포함하지 않는다. Timeline 모집단은 프로젝트 전체 M으로 독립이다. 일반 Task match/직접 Summary/context Summary와 Timeline 전체/viewport 수를 구별한다.

숨은 native M selection과 explicit M clipboard roots를 정리하며 일반 Task 선택과 Summary-root clipboard/full subtree 의미는 유지한다. marker identity는 native selection/clipboard와 분리한다. 기존 실제 #399 단일 Summary scope를 유지하고 #497 OPEN/미구현 복합 scope를 신규 구현하지 않는다. 열려 있던 root가 M으로 변한 실제 경로는 deleted/not-found·암묵 전체 확대 대신 M 안내/복귀를 제공한다. 삭제/오래된 ID는 canonical ID로 검증하고 이름으로 대체하지 않는다.

날짜 보기 명령은 canonical M date와 단일 adapter/기존 axis 확장·user intent queue를 사용하며 hidden native row select를 금지한다. OFF면 저장 OFF를 유지한 일시 표시와 원래 보기 복귀를 제공한다. 같은 marker/cluster 또는 안전한 전체 목록 진입으로 해당 ID를 식별하며 390px의 실제 물리 Chart 접근도 검증한다. #528 정확한 full member ID/조건/scope/복귀와 #514 일반 Task reveal/context-menu 예외를 보존한다.

Summary Delete/Copy/Cut/Move 등의 영향·잠금은 full canonical subtree를 기준으로 하고 hidden M 수/영향을 필요한 확인 UI에 표시한다. 취소/401/412/실패 원자성과 completed-membership/incident Link/Assignment guard를 유지한다. 조회/toggle만으로 mutation/revision 증가/불필요 Project GET/remount/부수 저장을 만들지 않는다.

## ownership / roles

- Manager: Packet/PLAN/package/rootlock/CHANGELOG, interface·scope·version·gate, 공식 Issue 진행 기록.
- infra: exact parent branch/worktree, 최종 QA GO 뒤 blob/tree/commit/ref/public fetch/byte equality/stacked PR/CI START 등록. 제품/docs/version 쓰기·CI 결과조회 금지.
- ui_ux: read-only DESIGN/가이드/Issue 기반 단일 toggle·compatibility·empty/scope/date navigation·focus/5폭 설계와 최종 실제 증거 비교.
- frontend primary: Workspace/Gantt/filter/adapter/visibility/selection/clipboard/command bridge·기존 Dashboard의 실제 명령 진입·순수 Timeline helpers 및 직접 관련 Unit/E2E/fixture/선별 합성 PNGJSON. 공유 UI와 tests의 유일 writer다. 관련 테스트 inventory를 만들고 기존 quick-view/stage-grid/scope/reveal/copy/drill 및 #549/#551 기술 suite를 새 계약에 대응시킨다. skip/삭제/무mutation·조건·guard assertion 약화로 CI를 맞추지 않는다.
- frontend documentation_owner: REQUIREMENTS/PROJECT_UX/MILESTONE_TIMELINE/UI_UX_GUIDELINES/TASK_EDITOR/TASK_RELATIONS/MILESTONE_STAGE_GATES/TEST_PLAN. ARCHITECTURE/PRO_FEATURE_MATRIX는 실제 adapter/표시 authority 변경을 대조하여 필요 갱신. DESIGN/AGENTS/API/DB/SCHEDULING/SECURITY/Import/Export/CI/deploy는 항목별 영향/N/A 반환.
- backend: full canonical subtree/command/Copy와 서버 guard·authorization/revision·Summary-only scope 경계 자문 완료 후, `tests/e2e/milestone-visibility-persistence.spec.ts`만 단독 작성·실행한다. 기존 isolated-application fixture를 재사용하며 실제 UI Summary root Copy와 HTTP/SQLite no-loss·guard를 집중 검증한다. 제품/공유 fixture/다른 test/docs/Git/GitHub 쓰기는 없다. 원본 실행은 `/tmp/issue552-backend-http-*`, 선별 합성 evidence는 `output/playwright/issue-552/backend-http/`이며 실행 전후 source 지문을 대조한다. frontend는 이 spec/evidence를 수정하지 않고 backend 결과를 지정 문서에 반영한다.
- scheduler: 필요시 read-only Summary rollup/전체 Gate·membership/date·숨은 endpoint 계약 자문. domain algorithm 변경은 비범위이며 필요 발견 시 Manager 반환.
- qa_docs: DOCSYNC PASS 이후 exact staged tree 독립 PRE_QA. readonly 구현자 보고/로컬/원격 상태를 구별한다.
- 모든 Agent는 혼자 작업하지 않으며 타인의 편집을 수정·되돌리지 않는다. 파일 동시 writer와 재귀 위임 금지, 실제 최대 동시6. source/API/domain/shared-interface 확대가 필요하면 Manager에게 먼저 반환한다.
- issue_comment_writer=manager, agent issue_comment_allowed_types=NONE. 공식 PLAN/STATUS/EXCEPTION은 Manager가 작성한다.

## validation / documentation / handoff

### 설계·domain 자문 확정

ui_ux/backend/scheduler의 읽기 전용 자문을 반영했다. 표시 authority는 프로젝트 preference와 날짜 확인용 temporary override 두 값으로 제한한다. 저장 실패는 현재 메모리 선택을 유지하고 한 번 알린다. 390px에서 공개 날짜 이동과 native focus만으로 실제 marker/cluster를 식별할 수 없으면, 기존 전체 목록의 해당 canonical ID 강조를 명시 fallback으로 사용한다. Task/Dashboard 조건을 암묵적으로 초기화하지 않는다.

필터의 logistics context는 전체 canonical을 유지한다. native 선택의 부분 제거 `[T,M]→[T]`도 공개 action으로 실제 Core 선택과 대조한다. Summary clipboard root는 숨은 M을 포함한 전체 subtree 의미다. Assignment 잠금은 기존 Copy 제한이며 Delete/Move 전체로 확대하지 않는다. Summary→M은 기존 서버에서 거부하는 conversion이므로 외부 canonical type drift의 복구 사례로만 다룬다. domain algorithm/API/DB 변경 없이 이 표시 전환을 구현한다.

작업 전 AGENTS/ISSUE_LIFECYCLE/AGENT_PROMPTS/DESIGN와 위 required docs, API/DB/ARCHITECTURE/SECURITY/SCHEDULING/REMOTE_VALIDATION/CI_CD/GITHUB_OPERATIONS/active PLAN을 읽는다. 실제 Issue552 최신 본문 /tmp/mastergantt-issue-552-current.md, #548/#497/#530 최신 reference-552 및 #196/#83/#399/#462/#514/#518/#528의 기존 reference/current 계약을 확인한다. Next code 전 설치 node_modules/next/dist/docs 관련 guide를 읽는다. UI skill을 읽고 사용 사실을 알린다. Core2.7.3/store2.7.2·Next16.3.8 유지, 공개 API 우선/geometry version 결합 그대로다.

직접 관련 Unit/typecheck/changed lint와 실제 targeted Chromium을 사용한다. 합성 actualCore와 실제 HTTP/SQLite·환경을 구별한다. no-loss/guard는 기존 실제 API test/원자성 evidence와 대응시켜 새 UI command payload의 전체 대상·서버 locked 응답을 검증한다. 전체 로컬 Vitest/Playwright/Docker 반복은 기본 금지이며 실제 변경/실패 근거가 있을 때만 필요한 범위로 넓힌다.

새 공개 표시 전환의 controlled projection은 canonical queue 이후 full source/API/current filter/scope/scale/view 조건을 검증하여 재적용한다. #551 queue 완료 후 current version/queue identity·await 요청 coalesce·hidden/zero-size·cleanup과 최신 사용자 scroll 우선순위를 보존한다. 원본 first FAIL/sourcehash를 유지하고 phase별 증거를 분리한다.

#551에서 인계된 Grid 열 표시/숨김과 5폭 document scrollWidth overflow 직접 assertion을 actual enabled lane에서 추가한다. 390/768/1024/1440/1920px×Day/Week, readonly/editing·dirty/pending/stale401412, all/Task/mixed/M-only·membership ON/OFF4조합·storage 오류/Project 전환·scope/peer/return·hidden selection/clipboard·Summary hidden M 영향/잠금·M-only/Task0/관계·동적축·Grid/chart-only dev 기술 범위/fullscreen·긴 이름/많은 M·keyboard/focus/Escape/같은 instance·좌표/row/viewport를 실제 assertions로 검증한다. full drag/Dependency/clipboard 전체 회귀와 production/실물 device/screen reader/Windows 환경·현재시각173년축 성능은 계획과 실제 검증 여부를 따로 기록한다.

관련 문서 영향 분석/실제 갱신 또는 항목별 N/A → DOCSYNC Manager PASS → ui_ux 비교/qa_docs PRE_QA → infra 최종 exact tree 게시 → 단일 PR/Refs #552 → exact-head CI 등록 → 결과 미조회로 #553 인계. 공식 quality/e2e/docker/QA_FINAL/Manager ACCEPT는 NOT TESTED로 유지한다. source/selected PNGJSON만 Git에 포함하고 Secret/DB/runtime logs/traces/.next 산출물은 제외한다.

## 구현 중 Chromium FAIL / REWORK

첫 actual Chromium 7개는 7 FAIL이었다. scope 복구용 wrapper와 기존 flex 규칙 충돌로 Chart 높이가 줄어드는 실제 layout 결함, 소속 열의 M 이름을 native 행으로 오인한 새 oracle 오류를 구별하여 보완했다. 다음 실행은 2 PASS/5 FAIL(45.1s, source drift0)이며 DOM ID 접두어와 좁은 화면의 메뉴 조작 순서를 바로잡았다. 이어 5 PASS/2 FAIL에서 390·768px의 열 표시 후 실제 Grid 588px/Chart 128px, 날짜 x144px를 진단했다. 390px의 물리 plot은 127px로 160px marker 예산이 부족했다. 이는 좌표 정합 PASS를 실패로 뒤집는 오차가 아니라 표시 공간 부족의 fallback 조건이다.

공간 부족 상태는 별도 fallback oracle로 보존하며, 5폭×Day/Week의 tick·행 동시 검증은 실제 사용자 splitter 드래그로 유효 plot을 확보한 상태에서 수행한다. 원본 FAIL·진단 JSON/PNG/로그와 source 지문은 보존한다. 허용오차·무mutation assertion을 낮추거나 강제 DOM scroll로 통과시키지 않는다. 초기 zero-size와 Grid-only의 WBS projection은 공개 filter와 bounded queue/resize 재적용으로 검증한다. 위 이력은 최종 source의 PASS를 의미하지 않는다.

390·768px의 집중 재실행 2개는 실제 owner wheel/splitter drag 후 PASS(14.9s)였다. 이는 해당 source·조건의 좁은 폭 검증이며 최종 전체 source 묶음의 결과와 구별한다. Manager는 기존 development-only bounded probe에서 canonical ID 최대500개를 검증하여 공개 `select-task`로 legacy native 선택을 주입하고 Core/app 선택을 읽는 기술 실험을 승인했다. private Core 쓰기·서버 mutation·production testhook·새 types URL/storage는 포함하지 않는다. production 경로 검증을 이 기술 실험만으로 대체하지 않는다.

### 집중 회귀와 source 오염 정정

19개 frontend source 지문의 44개 실행은 39 PASS/5 FAIL(2.7분, drift0)이었다. 과거 M-visible/가상 Grid oracle 2개, 실제 geometry 2개, 날짜 fallback focus 1개를 분리했다. Task1000/Milestone2000 peer/splitter에서 Core842px/Chart825px, 같은 instance/scrollTop570을 진단했다. 설치 Layout의 직전 Grid 폭544px을 사용하면 `1390-544-0-4=842`이고 최신560px이면826px으로 실제825px과 기존1px 범위다. splitter80px/5단계의16px 지연과 부합하며 마지막 실제 resize 이벤트·DOM을 같은 시점으로 확인한다. 정상적인 scrollbar17px 차이로 일반화하지 않는다.

actual HTTP run3의 숨은 M 행 실패는 지문 drift와 assertion 중 Fast Refresh가 직접 개입한 STALE 실행이었다. readonly-only 초기화 가설은 공식 설치 source에서 지지되지 않는다. source 동결 후 fresh isolated 앱의 run4는 3/3 PASS(retry0), 405개 source drift0였고 UI Summary Copy의 root `[S]`, 숨은 M1/M2 행0, 전체6개 subtree UUID·Link/Membership remap·revision+1·source/reload 불변을 확인했다. 시간은 2026-10-08T19:25:31.825475Z~19:26:22.305613Z, aggregate SHA256 `fade2e4ff8f92b150a94004275422cbaef4c26efb84075e9040a128b92c8bce9`다. 이는 진단 동결 source이며 이후 geometry 보완의 최신 PASS로 승격하지 않는다.

Manager는 설치 계산식과 실제 측정으로 근거가 있는 지원 display 조건의 폭 불일치에 한정해 공개 `resize-chart` 재발행을 승인했다. 기존 resize/observer·canonical queue와 현재 API/source/view/scale/유효 bbox를 확인하고 설치 식의 현재 effective Grid/scrollSize/resizer로 한 번 보완한다. left/top 강제 변경·private Core 쓰기·library patch·remount·idle polling·허용오차 확대는 없다. Chart-only의 실제 collapsed rail을 대조하며 Grid-only의 WBS projection은 Chart 폭과 독립이다. DataRouter의 파생 state 갱신은1ms timer를 사용해 `await exec`만으로 정착을 보장하지 않으므로 한정된 기존 queue/RAF 완료 후 같은 source 조건을 다시 검증한다. 이후 stale5-step/5폭/Chart-only/대용량과 fresh HTTP를 최신 동결 source에서 재검증한다.

Sol 담당의 반복된 Core 경계 진단을 보강하기 위해 Manager는 `core_race_552` 읽기 전용 조사에 Astra High를 일시 요청했다. 실제 서버/브라우저 실행이나 파일 변경은 없었고 공식 설치 sourcemap·제공 trace를 분석했다. React Gantt map SHA256 `0ab1314e33efedfeff34e83f62cf52f16e14f688a11fc4730a4144fb210aec3d`, Store map `14d87d279631e37ec89c3da70cb7c59c36e0d561209309dd7c0dcd0330e08ed2`이며 정적 조사 PASS와 runtime 원인 판정/독립 QA를 구별한다.

## LOCAL_VALIDATED / DOCUMENTATION_SYNC — Manager 확인

독립 재검토와 최종 metadata 정정: tree `486553c85389165101cfaafc8aae5a7e2bddfd89`에서 ui_ux는 실제PNG/source/current44/run6를 대조해 bounded UI PASS를 반환했다. qa_docs도 제품·로컬 증거·80파일/source125/405·95poolrecord·HTTP10byte equality를 PASS로 대조했으며 현재와 과거를 혼동한 sourceComparisonMeaning 및 TEST_PLAN anchor2건은 마지막 정정 대상으로 남겼다. frontend가 현재 제품1+spec1/fresh44/freshrun6/Unitpure재사용으로 metadata를 정정하고 과거date2계약은 historicalOnly history로 분리했다. 링크는 현재 TEST_PLAN 제목 slug와 일치한다. 제품/tests/LFF 추가 변경0이며 Manager DOCSYNC를 재확인하고 최종80파일 metadata tree의 read-only QA ACK 뒤 동일tree로 게시한다. 공식 quality/e2e/docker/QA_FINAL/Manager ACCEPT는 NOT TESTED다.

재동결 DOCUMENTATION_SYNC PASS: frontend74 allowlist 전부의 hash를 Manager가 확인했다. PROJECT_UX/UI_UX_GUIDELINES/MILESTONE_TIMELINE/TEST_PLAN은 실제 peer 숨김·새 paint oracle·fresh44/run6 근거로 갱신했고 나머지 required6문서는 이번 최소 수정에 추가 계약 영향이 없음을 대조했다. 기존 전체10문서의 #552 변경과 resize3문서 정정도 유지한다. 최신 selected45개4,446,910bytes 및 run6 HTTP10개 원본/복제 equality, source125 mismatch0, parent Next2config exact equality를 확인했다. root6파일을 더한80파일을 재동결해 독립 UI/PRE_QA를 요청한다. 이전51b tree의 실제 시각FAIL을 최신PASS로 숨기지 않는다.

비활성 peer 가림 수정의 최신 Local Fast Feedback: 정상 scope-owner는 visibility를 명시하지 않아 비활성 ancestor의 hidden을 상속하며 invalid scope는 기존 hidden/inert·같은 instance를 유지한다. 최신 UI44/44 PASS(2.6분), source125 aggregate `f320261b0fddc7f0ddee041a4efd31881a778c88209768ab3e6bba542856947d` 실행 전후 drift0다. 390 physical focus 순간의 inactive paint7개는 hidden+양수bbox/aria-hidden/inert를 검증했고 최신 PNG에서 실제 관리 버튼/ring6와 JSON 좌표가 일치한다. actual HTTP run6는 fresh3/3 PASS(57.1초, retry0), UTC20:07:46.813251Z~20:08:42.226880Z, source405 aggregate `2996bddec9a3e598183e8b8d962be2c78ed54d3700dd263bbc24440b89f2d02a` 전후 불변이다. 이전run5/단순focus2 PASS와 실제 paint결함을 구별한다. Unit56은 직접 pure dependency/4Unit파일 불변의 제한 재사용이며 현재 UI44/HTTP3과 중복 고유 수를 합산하지 않는다. Next2config는 양쪽 teardown 뒤 parent exact로 복원했고 이후 lint/typecheck 결과·문서 동결·독립 검토를 각각 확인한다. 이전bug PNG/JSON도 선별 before 증거로 보존한다.

재개 후 실제 시각 가림 REWORK: 새 독립 ui_ux/qa_docs는 tree `51b179c480a7778d464c174e0c5bbc7fb5c77386`의390 fallback JSON focus PASS와 PNG를 직접 비교하여 관리 버튼/ring 위치를 Gantt가 가림을 확인했다. inactive schedule의 visibility:hidden을 정상 scope-owner의 inline visibility:visible이 자손에서 덮는 source 경계다. pointer-events:none/absolute peer는 기존 center hit 및 sticky/fixed-only 가림 oracle에서 누락됐다. frontend는 정상 visibility 상속을 유지하고 invalid scope hidden/inert·native instance/geometry를 보존한다. inactive peer 실제 paint visibility/해당 순간 PNG oracle를 추가하며 새 source 동결 후 UI44/fresh HTTP3과 DOCSYNC/독립 검토를 재수행한다. 이전 제품 불변의 제한 재사용과 날짜2 PASS는 이 수정 source의 최신 PASS로 승격하지 않는다. 서버 재시작으로 새 frontend/backend/ui_ux/qa_docs/infra 실행 역할을 만들었으며 과거 검토·원본 실패는 유지한다.

재개 및 좁은 REWORK 완료: 서버 재시작 후 parent/main과 미게시 상태를 다시 확인했다. remote #552 branch/PR은 아직 없으며 main08ac7749efc4544dfc125853d9e58ef3a9d56b21/선행551 headfb6e5a634b3fcd70d62d4e8404a42cefe0ab6ce9는 그대로다. 날짜2case의 최신2/2 PASS(9.2초)·source125 실행 전후 equality와390px 즉시 fallback의 exact-ID/focus 외곽6px containment/center hit/불투명 sticky 가림0/PNG를 확보했다. 제품120과 실제 HTTP405 source는 불변이며 변경은 UI spec1이다. 기존44 중42case·Unit56·HTTP3은 영향별 제한 재사용하고46개 고유case로 합산하지 않는다. resize3문서를 직전 layoutKey 중복차단과 새geometry 요청의 bounded 재측정으로 정정했다. Manager DOCUMENTATION_SYNC를 다시 PASS로 확인했고72개 frontend allowlist와backend spec1/root5를 새tree78파일로 재동결해 독립 UI/PRE_QA delta 검토를 수행한다. 최초 PRE_QA FAIL/REWORK와 기존tree는 보존한다.

독립 검토 후 REWORK: 최초 staged tree `afbdece1b93c5b28dbe812419c5a18cbe953dd57`의 source/설계는 일치했으나390px OFF 날짜 탐색의 Dashboard fallback 순간 physical viewport/ring/center hit/가림 관측·PNG가 빠졌다. exact-ID highlight/activeElement/search 보존은 PASS이고 해당 물리 가시성은 NOT TESTED다. 기능 결함을 확정하지 않는다. frontend는 해당2개 날짜 case와 순간 증거를 보완하며 source120/HTTP405 불변이면 기존44/56/HTTP3을 영향별 제한 재사용한다. resize 문서3곳은 canonical generation당1회라는 의미 대신 직전 동일 layoutKey의 중복 보완 차단/새 geometry 요청의 bounded 재측정으로 정확히 정정한다. DOCUMENTATION_SYNC와 새tree delta 독립 검토를 다시 확인한 뒤 게시한다.

최종 동결 제품·UI source125 전후 불변, 관련 Unit56 PASS(256ms)/Chromium44 PASS(2.6분)/actual HTTP3 PASS(55.0초, retry0)를 확인했다. HTTP405 지문은 후속 lint/typecheck까지 불변이다. UI와 Unit의 로그 mtime/관측 완료 envelope는 native process 종료 순간과 구별한다. 서로 다른 환경/이전 source/기존 guard23 결과를 합산하지 않는다. 전체 변경 lint는 초기 오류6개가 있었던3파일의 React 지원 보완 후 exit0이며 나머지 파일은 불변이다. 기존 hook warning4개는 유지한다. typecheck/version/Markdown157/diff check exit0다.

Manager DOCUMENTATION_SYNC PASS: REQUIREMENTS/PROJECT_UX/MILESTONE_TIMELINE/UI_UX_GUIDELINES/TASK_EDITOR/TASK_RELATIONS/MILESTONE_STAGE_GATES/TEST_PLAN과 실제 adapter 경계 변경의 ARCHITECTURE/PRO_FEATURE_MATRIX를 코드·test·선별 증거와 대조했다. DESIGN은 기존 시각 언어 재사용, API/DB/SECURITY/IMPORT/EXPORT/CI/deploy는 계약 변경0, SCHEDULING_ENGINE은 알고리즘 변경0을 근거로 항목별 N/A다. root version/CHANGELOG/PLAN/Packet도 동기화했다.

선별 자료는 `output/playwright/issue-552/review-selected/`만 게시한다. 반복 배열/event의 SHA pool은 원본94 record와 역변환 값이 동일하며30개 열 전환 oracle를 유지한다. backend 원본10개와 selected/http10개는 byte equality를 확인했고 복제본 하나만 stage한다. raw 로그/trace/DB/Next 산출물/과거462·551 임시자료는 게시하지 않는다. next-env/tsconfig와 과거 tracked462 산출물은 exact parent로 복원했다. 독립 ui_ux/qa_docs 검토는 다음 단계이며 공식 PR quality/e2e/docker/QA_FINAL/Manager ACCEPT는 NOT TESTED다.

### 게시 전 lint 재작업

공개 resize 보완 source의 targeted Chromium44/44 PASS(2.1분), source125 drift0와 신규14개 캡처 재실행14/14 PASS(55.4초)를 확보했다. 첫44 실행은 잘못된 캡처 환경변수로 신규14개 PNG/JSON이 생성되지 않았지만 실제 assertion은 실행됐다. 별도 캡처 실행과 제품 검사 결과를 구별하며 최초 원본을 보존한다.

최종 changed lint에서 신규6오류(effect의 동기 state 갱신2개/JSX ref 읽기4개)가 드러나 LOCAL_VALIDATED를 재작업한다. frontend는 cached snapshot/SSR default ON/구독 cleanup을 가진 React useSyncExternalStore와 현재 컴포넌트의 조건부 state 조정, 완료 시점의 generation/public left state로 수정한다. 저장 schema/명시 toggle/clipboard full subtree 의미를 유지하며 임의 RAF나 lint suppression으로 우회하지 않는다. 수정 이후 새 source를 동결해 UI와 실제 HTTP/SQLite를 검증한다. 이전44/14 PASS와 diagnostic HTTP run4는 이후 source의 PASS로 사용하지 않는다.

React 보완 후 typecheck/수정3파일 lint exit0(기존4 warning), source125는 2026-10-08T19:39:12.436166Z에 동결했다. 최종 actual HTTP run5는 3/3 PASS, retry0/exit0, UTC19:39:52.064705Z~19:40:45.411409Z이며 source405 aggregate SHA256 `552e6d45fd75b783c85f24f804987f6a9a5bac42ee00c35066a9df40eaec9a8c` 전후 drift0다. package/lock0.106.0과 실제 설치 Next16.3.8/Core2.7.3/store2.7.2도 불변이다. diagnostic run4/기존 guard23과 고유 수를 합산하지 않는다. 최종 UI44, 전체 변경 lint와 teardown 이후 typecheck, DOCSYNC/독립 검토는 각각 별도 반환 계약으로 확인한다.

## 기존 backend guard Local Fast Feedback

2026-10-08T18:21:40Z에 backend가 기존 3파일의 직접 관련 case를 `vitest -t`로 선별 실행했다. exit0, 1.19s, 고유23 PASS이며 35개는 선택 정규식의 비대상이다. 새 skip이나 guard 약화는 없다. Copy/Stage는 실제 native better-sqlite3 in-memory transaction, Delete recovery는 임시 파일 SQLite reopen을 사용한다. Request/Response handler는 in-process이며 이 시점의 새 화면 Next HTTP 연결은 NOT TESTED였다. Password hash helper는 fixture 주입이다.

전체 subtree/internal remap/외부 소속 확인/completed full E·incident endpoint/Assignment Copy 제한/Cut identity/삭제 rollback/401·412·403 원자성을 검증했다. server/domain/contracts/migrations 173파일의 전후 변경0이며 aggregate SHA256은 `f36bd89f609975425123de4e2cf921d43884d70b4baa0edef2cc266cbf13e339`다. 실행 계약은 `/tmp/issue552-backend-guard-execution.json`, 원본 로그는 `/tmp/issue552-backend-guard-run.log`에 보존했다. 기존 또는 이후 동일 case 실행과 고유 수를 중복 합산하지 않는다.

## PR #563 CI trace REWORK — 2026-10-09

- 기존 #552 PR #561의 최초 전체 PR CI run `37839172928`은 quality/build/unit/Docker PASS, Chromium E2E 5/6 shard FAIL이었다. 이를 조사해 WBS에서 숨겨진 Milestone native 행에 의존하는 테스트를 변경하는 별도 보완 PR #563을 생성했다. 기존 기능 제품 소스 변경은 없으며, 이 PR의 UI/E2E/QA 최종 통과는 아직 주장할 수 없다.
- PR #563 run `37848837406` (#2235.1)은 코드·E2E 실행 전 `변경 경로 판정`의 `scripts/verify-ci-run-trace.py`에서 FAIL하였다. PR 본문이 `Refs #552. PR #561...`으로 이어져 정규식 `^\\s*Refs\\s+#\\s*([1-9][0-9]*)\\s*$`에 맞는 독립 행이 없었다. 그 결과 `Refs` 목록이 빈 배열로 판정되어 다른 CI jobs가 SKIPPED / aggregator FAIL 처리되었다. 이를 E2E 재실패로 기록하지 않는다.
- 보완: PR 본문에 **독립 한 행** `Refs #552`만 배치한다. PR 제목 `test(#552): ...`과 branch `fix/issue-552-ci-milestone-e2e`가 동일 Primary Issue #552로 정규화됨을 원본 CI 스크립트와 대조했다.
- `pull_request.edited` 이벤트는 검증된 같은 SHA의 이전 전체 CI 성공 증거를 요구하므로 그 경량 실행으로 승인하지 않는다. 이 복구 기록을 별도 commit으로 추가하여 `synchronize` 이벤트의 전체 PR CI를 시작하고 **새 head SHA / run ID / result**를 구분해 확인한다. 임의 테스트 skip, gate 삭제, `continue-on-error`, 캐시로 성공 판정 우회는 하지 않는다.
- 이 변경은 **PR metadata 및 실패·재실행 추적 문서만** 다룬다. 제품·API·DB·Scheduling·디자인 정책·버전은 변경하지 않는다. 신규 테스트의 실제 CI result는 새 실행 전 **NOT TESTED**이며, #551 선행 stacked base 및 #553 후속 PR 겹치는 E2E 변경은 병합 단계에 별도 정리한다.
- `release_required=true`, `release_authorized=false`. 새 PR CI START까지만 수행하며 merge/main/GHCR/tag/release/Issue close는 요청되지 않았다.

## PR #563 Chromium E2E REWORK — Run #2237.1

- 정확한 PR #563 head `ef4e900f076697a1cb21a2fa9072e1e386b704bf`, run `37849385061` (#2237.1): 변경 경로/typecheck/lint/Vitest/build/policy/Docker PASS, Chromium E2E shard 1/6 PASS 및 shard 2~6 FAIL. 이번 실패는 실제 E2E 회귀이며 이전 PR metadata trace fail과 별개다.
- 오라클 변경: 숨겨진 Milestone native row/bar를 강제로 찾아 클릭하지 않고 Milestone 대시보드 `data-milestone-task-id`에 정확한 ID로 진입한다. 동일 Editor, 관계, clipboard-ID, read-only 및 locked 서버 guard를 검사한다. Task/Task Link의 native context→Relation Editor, fullscreen 유지는 기존 진입 경로로 검증한다.
- 범위 내 11개 회귀 spec/helper 보완: Project Editor/화면 밀도, 단계 대시보드의 실제 스크롤 가능한 일반 WBS fixture, 컨텍스트 메뉴/Copy ID/구조 명령, canonical completed Milestone copy guard, 리소스 drill의 숨은 M 행, column resize 전 derived row/bar 실제 가시성, link management context. 전체 TEST SKIP / assertion 기준 완화 없음.
- 범위 밖 실증 원인: metadata rename 후 native row 일시 소실, Summary/Task canonical mutation 후 scroll/peer viewport 120→100 또는 68→0, 390px lane/768px geometry, 대형 milestone lane resize. 제품 결함이거나 테스트 fixture 공간 부족일 가능성을 구분해야 하므로 기존 강한 assertion을 유지하고 새 remote E2E에서 검증한다. 각 미통과 항목을 PASS로 보고하지 않는다.
- Source/DB/API/scheduling/version 변경 없음. `DESIGN.md`, `AGENTS.md`, `TEST_PLAN.md`의 정책 자체는 변경되지 않아 유지한다. 이 문서는 active Packet의 실패/수정/검증 범위 근거를 추가한다. 실제 local E2E/독립 QA는 이 세션에서 미실행하여 NOT TESTED; GitHub Actions에서 새 head의 공식 gate를 확인한다.
- release_required=true / release_authorized=false; 범위 PR CI START. merge/main/GHCR/tag/release/Issue close는 수행하지 않는다.
