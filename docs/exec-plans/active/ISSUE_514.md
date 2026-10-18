# Issue #514 — Grid 선택의 Task 시작 일정 reveal 복원

## Issue Work Packet

- repository: planner77/masterGantt, [Issue #514](https://github.com/planner77/masterGantt/issues/514), 접수 시 OPEN/comments0; PLAN·STATUS·EXCEPTION은 Issue 댓글에 기록한다.
- lifecycle_phase: ANALYSIS/DIAGNOSIS → DESIGN → IMPLEMENTING → LOCAL_VALIDATED → DOCUMENTATION_SYNC → PRE_QA → 원격 게시/PR_CI_STARTED.
- 요청 종료점: 관련 문서 포함 구현·원격 branch/PR·exact-head CI 실행 등록 확인. CI 결과 모니터링·병합·main/GHCR·tag/release·Issue 종료·branch cleanup은 범위 밖이다.
- 현재 baseline_main/head: `f94c22b00cac57bab409ca57e744b0530d2d35e5`, tree `a7893dbd8f4c2432e611624689266b67702e8182`, application `0.101.1`. 최초 baseline `3fa543b10e98d59e50f63f3f53613affe720b648`의 원본/실행은 historical 자료로 보존한다.
- working_branch: `fix/issue-514-grid-start-reveal`, worktree `/home/planner/Dev/masterGantt-worktrees/issue-514-current`. 초기 tree clean, 기존 동일 branch/PR 없음. PR base는 main이다.
- 현재 version_decision: PATCH `0.101.1 → 0.101.2`. 외부 main 버전 충돌로 최초 후보 `0.101.1`을 대체한다. 기존 탐색 동작의 하위 호환 회귀 수정이다. Manager가 package/lock/CHANGELOG를 소유한다.
- release_required=true, release_authorized=false. 사용자는 PR CI 시작까지 요청했으며 정식 릴리스 승인 근거는 없다.
- 기존 #529 구현·branch/worktree/PR과 원래 작업 tree의 untracked 자료는 보존한다.

## 요구사항과 수용 기준

Grid의 실제 좌클릭으로 Task가 선택되면 Task start가 Chart 밖에 있을 때 좌/우로 수평 reveal한다. 이미 보이는 start에는 불필요한 큰 이동을 만들지 않으며 null start에는 임의 날짜를 적용하지 않는다. Task end/오늘/이전 Task가 기준이 되면 안 된다.

| AC | 검증 계약 |
| --- | --- |
| 일반 클릭·선택·시작 날짜 | native Grid pointer 선택, Task ID/start, 이전 가시 범위, public/native scroll 및 start의 실제 viewport 포함을 확인한다. |
| 과거/미래·이미 보임·null | 좌/우 이동을 각각 재현하고 visible/no-start는 무이동을 별도로 검증한다. |
| Day/Week·normal/fullscreen·readonly/editable·root/nested | 해당 조합과 실제 설치 Core에서 검증한다. 단순 selected class만으로 PASS하지 않는다. |
| Context Menu | 미선택 행 우클릭의 show:false와 메뉴 위치 보존·실제 scroll 닫힘 계약을 유지하며 좌클릭 전후 조합을 검증한다. |
| modifier/keyboard | Ctrl/Meta·Shift range와 keyboard의 기존 선택 의미를 유지한다. canonical/selection mirror의 복원을 사용자 gesture와 구별한다. |
| 상태·변경 없음 | API/DOM instance·tree·columns/grid width·scale/fullscreen 유지, mutation/revision/canonical reload/page reload/remount 없음. |
| Timeline/queue | #367 동적 확장 및 canonical/peer/fullscreen restore가 reveal을 뒤늦게 덮지 않는지 실제 event trace로 검증한다. |

비범위는 새 navigation/mini-map/go-to-date·scale 정책·schedule/domain/API/DB/auth 변경·SVAR 버전 변경·PRO·무조건 고정 pixel 정렬이다. 공개 API를 우선하며 remount/강제 DOM scroll/repeated scrollIntoView로 가리지 않는다.

## 소유권과 위임 계약

- Manager: Packet/PLAN/version/package/lock/CHANGELOG, 범위·설계·phase·원격 handoff·Issue 댓글.
- infra: 최신 baseline/중복 확인과 branch 준비; Manager gate 후 exact tree 원격 게시·PR 생성·CI 등록 확인. 구현 파일·version·release를 독자 변경하지 않는다.
- frontend: primary implementation. 초기 before 진단과 `project-gantt.tsx`의 필요한 selection integration·직접 helper·관련 Unit/E2E·개발/test 전용 evidence. 제품 동작 변경은 원인/최소안 반환 후 Manager 승인으로 진행한다. PROJECT_UX/TEST_PLAN 문서 작성, 공통 UI_UX 변경은 Manager의 필요성 판단 뒤 맡는다.
- ui_ux: DESIGN·공통/화면 UX·AC·최소 interaction 설계와 실제 구현/evidence 비교, read-only.
- researcher: 공식 SVAR select-task/scroll-chart·설치 Core 타입·공식 demo/API 차이 조사, read-only. 문서/API 확인과 실제 browser 조작은 구별한다.
- qa_docs: DOCUMENTATION_SYNC 뒤 AC/code/test/docs/security·실제 로컬 증거의 독립 PRE_QA, read-only.
- shared_interfaces: 기존 공개 selection/scroll API; 새 DTO/domain/server 계약은 추가하지 않는다. 파일 충돌/범위 변경은 Manager에게 반환한다.
- issue_comment_writer=manager, Sub-Agent issue_comment_allowed_types=NONE. Agent는 재귀 위임/commit/push/PR/CI 결과 조회/merge/release/close를 독자 실행하지 않는다. 동시 동일 파일 쓰기 금지.

## Source of Truth와 관련 Issue

DESIGN, AGENTS, UI_UX_GUIDELINES, PROJECT_UX, TEST_PLAN, ISSUE_LIFECYCLE, AGENT_PROMPTS, REMOTE_VALIDATION, GITHUB_OPERATIONS, CI_CD와 도메인/API/DB/security 원칙을 따른다. #464는 CLOSED이며 Context Menu 전용 show:false·일반 클릭/keyboard reveal 계약을 보존한다. #367(CLOSED)은 dynamic timeline, #155(CLOSED)는 fullscreen/상태 보존, #507(OPEN)은 vertical flicker를 다룬다. #507 전체 성능/렌더링 개선을 #514로 확대하지 않는다.

Next/@next/env `16.3.8`, SVAR React Gantt Core `2.7.3`의 선언/lock/실제 설치 일치를 확인했고 node_modules는 물리 복사했다. 코드 작성 전 설치 `node_modules/next/dist/docs/` 관련 guide를 읽는다. DESIGN의 기존 파란 Light/system font·semantic tokens·작업 면적·SVAR 공개 interaction을 유지한다. UI/UX Pro Max는 targeted interaction/focus 보조로만 사용하며 repository 계약을 우선한다.

## 검증·문서 Gate와 다음 담당

before/after 진단에는 Task ID/start·pre visible range/public/native position·select-task payload(show/eventSource)·scroll/resize trace·같은 instance·실행 source SHA/시각을 남긴다. 최초 FAIL과 REWORK를 보존하며 synthetic fixture의 선택 JSON/PNG만 Git에 포함한다. 비밀값/Task 본문/runtime DB/log/.next/download/trace는 게시하지 않는다.

Local Fast Feedback은 관련 Unit/E2E·typecheck/변경 lint·version/Markdown/diff에 한정한다. 전체 회귀는 PR Actions에 전달한다. 공식 quality/e2e/docker·QA_FINAL/Manager ACCEPT는 NOT TESTED이며 PR 생성 후 등록 metadata만 제한 조회하고 결과를 모니터링하지 않는다.

required_docs: PROJECT_UX, TEST_PLAN, CHANGELOG, PLAN, 이 Packet. UI_UX_GUIDELINES는 반복 적용 가치가 있는 새 공통 selection/reveal 경계가 도출될 때만 보강하며 중복이면 N/A 근거를 기록한다. REQUIREMENTS/API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/ARCHITECTURE/DESIGN/AGENTS/CI_CD/REMOTE_VALIDATION/deployment는 실제 diff/계약 변경 여부로 N/A를 판단한다. 문서 작성 뒤 DOCUMENTATION_SYNC PASS 전에는 PRE_QA로 넘기지 않는다.

최종 수동 UX·운영 환경은 별도 NOT TESTED다. 모든 Result Contract는 실제 파일/실행/source hash·PASS/FAIL/BLOCKED/NOT TESTED·초기 오류·문서 영향·다음 담당을 반환한다. root cause 확정 뒤 Manager가 IMPLEMENTING을 승인한다.

## 실행 기록

BRANCH_READY PASS: 최신 main/clean tree·중복 없음·Next/SVAR 설치 일치·별도 worktree 준비. Frontend의 실제 before 재현과 ui_ux/researcher의 read-only 설계/공개 API 대조를 진행한다. 코드 수정·원격 게시·공식 CI는 아직 NOT TESTED다.

## 공개 API와 interaction 설계 확인

researcher는 2026-10-08 공식 [select-task](https://docs.svar.dev/react/gantt/api/actions/select-task/), [scroll-chart](https://docs.svar.dev/react/gantt/api/actions/scroll-chart/), [getState](https://docs.svar.dev/react/gantt/api/methods/getstate/), [resize-chart](https://docs.svar.dev/react/gantt/api/actions/resize-chart/)와 설치 공개 타입을 대조했다. show 생략/default true 및 true/y는 수직, xy는 양축, false는 스크롤 없음이다. 설치 타입의 x/eventSource는 최신 문서 표에 없으며 문서가 exact Task start 정렬이나 layout settle를 보장하지 않는다. [Base demo](https://docs.svar.dev/react/gantt/samples/#/base/willow)와 [Context menu demo](https://docs.svar.dev/react/gantt/samples/#/context-menu/willow)는 URL 참조이며 실제 demo 조작 PASS는 아니다.

ui_ux source 설계 비교는 PASS지만 실제 root cause/조작은 NOT TESTED다. 일반 클릭은 native 선택을 통과시키고 app-owned gesture는 show:true, context 전용은 show:false라 false 확대를 원인으로 단정하지 않는다. 실제 일반 Grid intent에 한정한 공개 xy를 우선 검증하며 modifier/checkbox/Space/keyboard·canonical 복원의 공통 기본값을 일괄 변경하지 않는다. 긴 bar 일부가 보이는 것과 canonical start 가시성을 구별한다. 늦은 queue가 새 선택/사용자 입력을 덮지 않게 하며 Core xy만으로 start를 보이지 못하는 실제 증거가 있을 때만 제한된 공개 scroll 보완을 판단한다.

UI/UX Pro Max의 targeted `focus not obscured --domain ux`는 Web의 focus 가시성 지침에 적합한 결과를 확인했다. 선택과 keyboard focus는 구별하고 Grid/Chart 가용 영역과 기존 접근성을 유지하며 공통 시각 재설계로 확대하지 않는다. 설치 Core 실제 before 결과를 받은 뒤 IMPLEMENTING을 확정한다.

## 최초 실제 before 결과

frontend의 짧은 readonly root Task·기간 셀/작업명 실제 클릭 before1은 PASS2.2초(`/tmp/frontend514-before2.log`)였다. native select-task가 실제 show:xy를 보냈고 future public/native0→19830 및 past20802→0으로 양방향 이동하며 start가 가시 영역에 포함됐다. 공식 default true와 실제 native Grid payload를 구별해야 하며 이 증거로 default true/Context Menu false를 회귀 원인으로 확정할 수 없다. 첫 실행의 공유 fixture 3행 가정과 2행 입력 불일치 TypeError는 fixture FAIL로 보존한다.

긴 Task의 일부 bar만 보이는 상태·canonical null start·Week/editable·레이아웃/동적 Timeline 및 복원 queue의 경계를 추가 진단한다. root cause 재현 전에 제품 selection 기본값을 변경하지 않는다. 개발용 event buffer가 후행 resize 때문에 선택 payload를 잃지 않도록 필요한 bounded trace만 보강할 수 있다. 새로운 실제 before 결과를 설계에 반영한 뒤 최소 구현을 승인한다.

## before 진단의 첫 계약 위반

짧은 readonly root/긴 작업 start 밖/editable 작업명 클릭은 고유 3case PASS였고 각각 native xy·public/native/start 노출을 확인했다. `/tmp/frontend514-before5.log`의 Week/fullscreen nested start 이동0→5005도 정상이다. 이어 canonical start=null Summary 클릭에서 renderer anchor에 native xy가 적용되어 public/native5005→0으로 임의 날짜 이동하는 AC FAIL을 재현했다. 이 null-start 위반을 날짜가 있는 일반 Task 전체의 reveal 실패 원인으로 확대하지 않는다.

frontend는 pending peer 복귀 후 실제 일반 Grid 클릭의 지연 restore 경쟁을 추가 관측하고 최소안을 반환한다. 문서/API 확인이나 정상 조합 PASS로 미검증 경계를 대신하지 않는다. 제품 selection behavior 변경은 아직 없으며 최초 fixture 오류 및 실제 FAIL을 실행/source/evidence와 함께 보존한다.

## root cause 확정과 IMPLEMENTING 승인

`/tmp/frontend514-before7.log`의 실제 dated Task before는 FAIL2.3초다. Milestone→Gantt 복귀의 pending RAF에서 Grid 기간 셀 pointer 클릭이 native xy로 public/native120→19830·startVisible=true를 만들었지만 pending300ms 뒤 이전120 복원으로 startVisible=false가 됐다. 같은 API instance/sync generation이며 선택 뒤 old requested120 trace가 두 번 있다. 원인은 native Core 선택이 아니라 Gantt Core peer restore와 readonly DOM peer restore의 두 큐가 새로운 사용자 입력을 취소조건으로 보지 않는 경계다. controlled RAF로 경쟁을 분리했으며 일반 자연 클릭의 정상 before와 구별한다. synthetic raw 근거는 `output/playwright/issue-514/before-peer/pending-peer.json`이다.

Manager는 IMPLEMENTING을 승인했다. frontend 소유권을 `src/features/projects/project-readonly-view.tsx`의 기존 DOM peer effect/필요한 capture metadata에 한정해 확장한다. Gantt 기존 peer effect와 DOM 효과 양쪽에 pointer/wheel/keydown 취소·listener/RAF cleanup, callback 직전 현재 source/snapshot/instance/sync/visible/continuity/scale/column/grid guard를 적용한다. native xy와 modifier/keyboard/default mirror는 유지한다. #529의 다른 Timeline 보완을 가져오거나 whole Gantt를 재설계하지 않는다. 실제 추가 결함이 있으면 다시 Manager에게 반환한다.

canonical start=null·show:xy에만 public select-task intercept에서 y로 제한하는 별도 최소 guard도 승인했다. 선택/focus/수직 reveal은 유지하고 context false·canonical/owned false·modifier true 및 dated xy는 변경하지 않는다. anchor/오늘/이전 날짜로 null을 보충하지 않는다.

after는 pointer 선택 직후뿐 아니라 pending 완료 뒤에도 dated Task start가 보이는지, wheel의 public/native 관측값이 각각 유지되는지, 빠른 새 선택을 오래된 복원이 덮지 않는지를 직접 확인한다. marker-null만으로 PASS하지 않는다. 입력이 없는 정상 peer 복원 및 기존 Context Menu/selection/fullscreen/Timeline 상태의 영향 회귀도 검증한다. PROJECT_UX/TEST_PLAN과 반복 가치가 있는 UI_UX 공통 selection/복원 취소 계약만 동기화한다. 기존 #529 구현은 그대로 보존한다.

## 문서 영향 분석

PROJECT_UX는 실제 일반 클릭·null start·복귀 큐/새 입력 우선순위와 기존 context 예외를, TEST_PLAN은 before/after·조합·입력/무입력 control·실제 start 가시성·source hash·실패 이력을 반영한다. UI_UX_GUIDELINES는 일반 reveal과 renderer anchor 및 대기 복원 취소의 반복 가능한 경계만 간결하게 보강한다. CHANGELOG/PLAN/이 Packet은 Manager가 제품 변경·진행·증거 범위를 기록한다. 작성 완료 뒤 실제 diff와 아래 N/A를 재확인해 DOCUMENTATION_SYNC를 판정한다.

| 문서 | N/A 근거 |
| --- | --- |
| REQUIREMENTS | 기존 Grid/Chart 탐색·상태 보존 UX의 회귀 수정이며 신규 제품 기능/범위는 추가하지 않는다. 상세 기존 동작과 수정 경계는 PROJECT_UX에 기록한다. |
| API / DB_SCHEMA | HTTP/DTO/schema/migration/persistence 계약을 변경하지 않는다. SVAR 공개 action 사용은 서버 API 변경이 아니다. |
| SCHEDULING_ENGINE | Task start/end·Calendar·Dependency·도메인 계산은 유지한다. 표시용 renderer anchor를 canonical 일정으로 해석하지 않는다. |
| SECURITY | 권한/session/Origin/revision/readonly server 계약은 불변이다. 진단은 기존 development-only 경계에 Task ID/날짜·action/viewport만 제한 기록하고 비밀/본문·운영 로그를 추가하지 않는다. |
| ARCHITECTURE | 기존 React workspace/Core integration의 event/restore 경계만 수정하며 server/domain/repository 구조는 유지한다. |
| DESIGN / AGENTS | 기존 Light/system font·semantic token·workspace와 지침/역할 정책은 유지한다. CSS/공통 visual system을 변경하지 않는다. |
| CI_CD / REMOTE_VALIDATION / GITHUB_OPERATIONS | 기존 required gate·workflow·권한·원격 검증 및 trace 규칙을 유지한다. version/이번 증거는 CHANGELOG와 Packet에 기록한다. |
| DEPLOYMENT / REPOSITORY_STRUCTURE / IMPORT_SCHEMA / EXCEL_EXPORT / VBA_EXPORT | 배포 경로/volume·저장소 구조·Import/Export/Excel/VBA/DRM 계약은 변경하지 않는다. |

현재 ownership에 따른 계획이며 최종 소스 동결의 실제 변경 범위가 달라지면 N/A도 재평가한다.

## 최신 main 정렬과 기존 자료 보존

게시 준비에서 외부 #518/PR #544 main 병합을 확인했다. 현재 baseline `f94c22b00cac57bab409ca57e744b0530d2d35e5`는 상위 Milestone 탭·activeView/ResourceNavigationState·Workspace 복원 구조를 변경하며 application0.101.1이다. Gantt source는 최초 baseline과 동일하지만 readonly와 문서/테스트 교차 변경은 그대로 덮을 수 없다. Manager는 기존 branch를 `fix/issue-514-grid-start-reveal-baseline`으로 안전하게 보존하고 current worktree에 같은 최종 branch를 최신 main에서 생성하도록 승인했다. 원래 root/529 source와 작업 자료는 변경하지 않았다.

기존 freeze `/tmp/issue-514-frontend-old-baseline-freeze.json`, 제품2파일 patch 및 spec 사본을 보존했다. 이전 unique after13과 8matrix case의 16config PASS·Unit18/lint는 최초 baseline의 영향 근거이며 최신 Workspace PASS로 재사용하지 않는다. 이전 typecheck는 실행 중 빈 로그를 PASS로 잘못 보고했으나 완료 로그에서 fixture 타입 오류 FAIL로 정정했다. 원본 freeze/로그를 덮지 않고 현재 명시 타입 수정 후 재검증한다. Week visible 재클릭10px의 native 조정을 exact-zero로 기대한 oracle FAIL과 좁은 폭 pointer FAIL은 별도 이력이다. 390px에서 Chart x498–733은 viewport 밖인 내부 작업면이며 document overflow0이었다. pointerdown/up의 row 위치 변화로 selection event가 발생하지 않은 폭 fixture를 native reveal PASS로 표시하지 않는다.

현재 version 후보는 PATCH0.101.2다. frontend는 변하지 않은 Gantt #514 보완과 새 spec을 가져오되 readonly 복원은 #518 activeView/top-level Milestone 구조에 적응한다. scheduleView/이전 nested tab을 재도입하거나 외부 UI/문서를 되돌리지 않는다. 필요한 current native matrix·입력 취소·무입력 positive와 관련 회귀를 다시 실행한 뒤 최신 문서 gate/독립 검토/원격 게시로 진행한다. 최초 FAIL/sourcehash/selected synthetic evidence와 current 실행은 분리한다.

## 현재 통합 검증과 좁은 폭 경계

최신 #518 baseline의 신규 고유16case와 기존 직접 관련4case는 실제 Chromium/설치 Core에서 PASS다. matrix8case는 Day/Week·normal/fullscreen·readonly/editable 각 root+nested의 16설정을 포함한다. native 양방향/긴 작업 start·null·pending 선택/실제 wheel/최신 선택·filter source 무효화·Context Menu/수식키/Space/Escape를 확인했다. 신규 및 기존4case 모두 mock Project API와 실제 설치 Core를 사용하는 browser 검증이다. 실제 SQLite/API persistence·운영 환경 PASS나 원격 공식 회귀 PASS가 아니다.

390/768/1024/1440/1920px의 과거/미래10관측은 지원되는 splitter/fullscreen 조작 후 Core 논리 viewport의 start 노출을 확인한다. 390px의 미래 start는 page x662로 화면 밖이며 기존 widget minWidth720 작업면의 제한이다. 768/1024/1440/1920px는 page에도 포함되지만 390/768은 좁은 작업면 smoke로 구분한다. 사용자 outer pan은 NOT TESTED이며 자동 page reveal PASS를 주장하지 않는다. 기존 최소폭/CSS/전체 Gantt 배치 재설계는 이 Issue 비범위로 유지한다. 이전 폭 fixture의 pointerdown/up 위치 이동·선택 event 미발생을 PASS로 바꾸지 않는다.

현재 Unit2파일18case PASS157ms 및 lint0error/기존4warning이다. 현재 최초 typecheck의 fixture 타입 확장 오류를 ProjectTaskDto[] 명시로 수정한 뒤 재실행 PASS이며 제품 source는 동일하다. 최초 FAIL·oracle/fixture REWORK·타입 검증 보고 정정과 마지막 source/spec SHA는 선택 증거 README/manifest로 보존한다. 최종 DOCUMENTATION_SYNC·독립 PRE_QA·게시 동등성 판정은 파일 동결 후 기록한다.

## DOCUMENTATION_SYNC

Manager는 현재 제품2파일·spec과 PROJECT_UX/TEST_PLAN/UI_UX_GUIDELINES/CHANGELOG/PLAN/Packet의 실제 diff를 대조했다. 서버/도메인/보안/DB·배포·workflow 계약과 CSS/최소폭은 변경하지 않아 위 N/A 표를 유지한다. Core queue의 canonical sync 세대는 실제 ref를 사용한다. DOM 경로는 production에서 snapshot/reset generation/instance/input/geometry를 검증하며 추가 syncGeneration 비교는 기존 개발 전용 진단 값일 때 적용된다. 이를 production 새 authorization 또는 동기화 API로 사용하지 않는다.

관련 문서 동기화와 local Markdown150파일·version0.101.2·diff 검사 PASS다. Manager의 최종 `npm run typecheck`도 실제 session85743 종료exit0 PASS를 확인했으며 실행 중 빈 로그로 판정하지 않았다. 제품 source 동결/선별 execution manifest가 완료된 exact staged tree에서 독립 UI 설계 비교/PRE_QA를 진행한다. 독립 PRE_QA PASS는 quality/e2e/docker·QA_FINAL/Manager ACCEPT의 대체가 아니다.
