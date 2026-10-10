# Issue #549 — Milestone Timeline 공통 계약과 Core 연동 기반

## Issue Work Packet

- repository/issue: planner77/masterGantt, [#549](https://github.com/planner77/masterGantt/issues/549), Epic [#548](https://github.com/planner77/masterGantt/issues/548). 접수 시 OPEN/comments0. 요구사항 원문과 댓글을 확인했다.
- lifecycle_phase: ANALYSIS → PLAN → VERSION_DECIDED → BRANCH_READY → IMPLEMENTING → LOCAL_VALIDATED → DOCUMENTATION_SYNC → PRE_QA → PR_CI_STARTED.
- 요청 종료점: #549부터 #553까지 순차 구현·문서 갱신·원격 branch/PR·exact-head CI 등록 확인. 각 Issue의 CI 결과 모니터링 없이 다음 Issue로 진행한다. merge·main/GHCR·release/tag·Issue 종료/branch cleanup은 범위 밖이다. 최신 사용자의 명시 구현 요청은 Issue 등록 시점의 과거 등록-only 경계를 대체한다.
- main/baseline/head: `dca2f7821f277ef31ee3dbcbdc1e51ad257209f0`, tree `8b11ce8915a4b82031324174913386092840cdc4`, application `0.102.1`. 실제 최신 main을 fetch하고 중복 branch/PR 없음과 clean tree를 확인했다.
- branch/worktree: `feat/issue-549-milestone-timeline-foundation`, `/home/planner/Dev/masterGantt-worktrees/issue-549`, PR base main. 현재 최종 commit/PR/CI는 아직 없다.
- version_decision: MINOR `0.102.1 → 0.103.0`. 후속 사용자 기능이 공유할 새로운 표시 projection/adapter를 추가하는 하위 호환 기능 기반이다. Manager가 package/lock/CHANGELOG를 소유한다.
- release_required=true / release_authorized=false. PR CI 시작까지만 요청했으며 정식 게시 승인 근거는 없다.
- dependency strategy: 후속 #550 → #551 → #552 → #553은 각 선행 exact 구현 head의 stacked branch/PR로 진행한다. 미병합 기능을 main에 있다고 가정하지 않고 선행 branch와 main SHA를 별도 기록한다. 실제 base 변경/외부 main drift는 Manager가 통합 영향과 버전을 다시 판단한다.

## Scope와 Gate

canonical 원본, WBS 표시 집합, 프로젝트 전체 Milestone 날짜순 모집단, 별도 표시 환경설정, Milestone 조회 선택/가시 member 강조를 분리한 단일 순수 모델을 구현한다. Summary context와 실제 일반 Task 매칭 수를 구별하고 full hierarchy의 기존 Membership/Gate projector와 전체 subtree 구조 command/export 의미를 유지한다. 새로운 도메인 상태/Ready/공수 엔진은 추가하지 않는다.

설치 Core 2.7.3의 공개 filter/scroll/state와 기존 날짜 helper를 사용하는 단일 앱 adapter를 구현·실험한다. 행 숨김 후 Grid/Chart 정렬, canonical Link 보존·숨은 endpoint 표시, 날짜 좌표와 역방향 reveal·Day/Week/DST/월말/연말/윤일, scroll/resize/열/Grid폭/fullscreen/동적 축/상위 탭 복귀와 Milestone-only 날짜축을 실제 fixture에서 검증한다. 공개 API 부족/실제 FAIL이면 대안과 제한을 기록하고 기술 gate가 없는 행 제거를 노출하지 않는다.

#549 자체는 운영의 Milestone 행·빠른 보기·작업 필터를 제거/대체하지 않는다. #550의 관리 진입과 #551의 lane을 완성했다고 보고하지 않으며 #552에서 준비 완료 후 표시 전환을 활성화한다. PRO markers/비공개 store mutation/remount/강제 DOM scroll/새 패키지/DB migration/일괄 reparent/새 Export renderer는 비범위다.

## 파일 소유권·위임

- Manager: Work Packet/PLAN/package/lock/CHANGELOG, 단계·버전·공통 interface·최종 문서 gate·Issue 공식 댓글.
- frontend: primary integration, `src/features/gantt/milestone-timeline-adapter.ts`, 필요한 Gantt development-only 기술 probe/fixture, 관련 E2E/adapter Unit 및 선별 evidence; `docs/MILESTONE_TIMELINE.md`, DESIGN/AGENTS 최소 참조·REQUIREMENTS/PROJECT_UX/MILESTONE_STAGE_GATES/UI_UX_GUIDELINES/TEST_PLAN/PRO_FEATURE_MATRIX의 실제 영향 문서. 기존 제품 기능을 전환하지 않는다. Next installed guides를 코드 작성 전에 읽는다.
- scheduler: `src/features/milestones/milestone-timeline-model.ts`, `tests/domain/milestone-timeline-model.test.ts`, `tests/fixtures/milestone-timeline.ts`의 순수 projection/정렬/설정 정규화 및 입력 불변·scope 밖 상속/full Gate/no-loss 테스트. 기존 계산 엔진과 filter/subtree helper를 재사용하며 공유 export signature는 구현 전 Manager/frontend에게 반환한다. source/domain/API 계약 변경 필요는 Manager에게 요청한다.
- ui_ux/researcher: 설계/current 코드 경로·공식 공개 API·설치 버전 대조 및 실제 증거 비교, read-only.
- backend: 필요 시 기존 canonical/full Gate/command/no-loss 경계의 read-only domain 검토. 구현·migration은 별도 승인 없이 하지 않는다.
- qa_docs: DOCUMENTATION_SYNC 뒤 exact tree의 독립 AC/code/test/docs/security 검토, read-only.
- infra: branch/node_modules 준비 및 Manager GO 뒤 원격 동등 게시/PR/CI 등록 확인. 제품/version/문서 수정·원격 결과 모니터링·merge/release/close는 하지 않는다.
- issue_comment_writer=manager / 모든 Sub-Agent issue_comment_allowed_types=NONE. agent 재귀 위임·소유권 밖 쓰기·동일 파일 병렬 쓰기 금지. 기존 root의 untracked463 및 #514/#529 작업 원본을 보존한다.

## Source of Truth·호환 영향

AGENTS/DESIGN/ISSUE_LIFECYCLE/AGENT_PROMPTS/UI_UX_GUIDELINES/PROJECT_UX/MILESTONE_STAGE_GATES/TASK_EDITOR/TASK_RELATIONS/TEST_PLAN/PLAN과 REQUIREMENTS/ARCHITECTURE/API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/PRO_FEATURE_MATRIX/REMOTE_VALIDATION/CI_CD/GITHUB_OPERATIONS를 따른다. #196/#399/#460~#464/#495/#497/#514/#518/#519/#528/#529/#530의 실제 최신 통합을 확인한다. 등록 당시 main599b824/app0.102.0과 현재 main을 구별한다.

새 MILESTONE_TIMELINE에 current→target→compatibility, 실제 types/storage/URL/scope 경로, defaultON 프로젝트별 browser preference schema/fallback, filter와toggle 독립, Milestone-only/empty/outside/null/manual/완료불일치·hidden subtree 영향·export 원본 의미·후속 interface·기술 gate를 고정한다. 존재하지 않는 저장/복합 scope 경로를 가정하지 않는다. N/A는 최종 실제 diff의 계약별 근거로 기록한다. DESIGN의 기존 파란 Light/system font·semantic tokens·작업 면적을 재사용한다.

## 검증·다음 단계

Local Fast Feedback은 모델/adapter 및 직접 관련 Unit·작은 실제 Chromium Core 실험·typecheck/변경 lint·version/Markdown/diff를 사용한다. full regression/Docker는 PR Actions에 위임한다. 신규 listener/probe는 bounded 개발/test 환경이며 Task 본문/비밀값/실제DB/runtime log/trace/.next를 Git에 저장하지 않는다. selected synthetic JSON/PNG와 실행/source hash·시간·최초 FAIL/REWORK/실행 exit를 기록한다.

문서 영향 분석과 required docs 반영/N/A를 마친 뒤 DOCUMENTATION_SYNC → ui_ux 비교/독립 PRE_QA → infra 원격 게시로 넘긴다. 공식 quality/e2e/docker 및 QA_FINAL/Manager ACCEPT는 NOT TESTED이며 CI 등록 metadata만 bounded exact-head 조회한다. 실제 demo 조작·실기기/screen reader/Windows Excel·운영 환경은 실행 증거가 없으면 별도 NOT TESTED다.

## 분석 결과와 구현 결정

현재 #196/#399/#460~#464/#514/#518/#519/#528/#529는 CLOSED이며 #495/#497/#530은 OPEN이다. 상태를 구현 증거로 대신하지 않고 최신 main의 코드 경로를 확인한다. types/quick-view는 React 메모리와 scope Map에 있으며 URL/localStorage 영속 저장 경로는 없다. URL은 단일 Summary rootTask를 보존하고 #497 복합 범위/Milestone root 신규 지원은 확인되지 않았다. revision 전파용 localStorage를 필터 저장소로 간주하지 않는다.

Manager는 새 preference/defaultON과 기존 types를 독립 적용하기로 했다. Task-only를 표시 OFF에 자동 이식하지 않으며 mixed에서 Milestone type만 제외하고 다른 조건을 유지한다. Milestone-only는 원조건을 보존하는 호환 상태와 Dashboard 진입/명시 조건 해제를 반환하며 자동 전체 작업으로 확대하지 않는다. 저장 OFF의 날짜 보기 명령은 저장값을 변경하지 않는 일시 표시이고 원래 보기 복귀 시 해제한다. 명시 토글은 일시 override를 종료하고 preference를 변경하는 후속 UI 계약이다.

backend read-only 검토는 full tasks/links의 기존 projectStageGates를 재사용하는 no-loss 경계를 확인했다. Summary 일정/진척 roll-up과 서버 Origin/session/revision·완료/Assignment/Copy 제외/외부 Link 잠금은 기존 authority다. subtree 영향 helper는 canonical 자손과 숨은 Milestone 설명을 반환하며 서버 command authorization을 대체하지 않는다. scope는 client 조회/command guard이며 서버가 viewRootTaskId를 받는다고 문서화하지 않는다.

공식 filter/getState/scroll API 및 설치 Core2.7.3/gantt-store2.7.2 타입 확인은 PASS지만 행 정렬·hidden link·zero-axis·임의 날짜 좌표의 실제 browser 보장은 별도 기술 gate다. react-gantt 타입은 getDiffer를 재export하지만 해당 runtime export는 없다. Manager는 이미 설치/lock에 있는 gantt-store root의 공개 getDiffer와 기존 localDateFromDateOnly 및 getState의 발행 typed derived scale 정보 조합을 제한된 단일 adapter로 허용했다. 새 dependency/버전/deep import/비공개 store 쓰기/복제는 추가하지 않는다. 해당 package는 내부 상태 관리 package로 설명되며 이 대안을 문서상 안정 widget geometry 보장으로 과대 표시하지 않는다. Day/Week step1·day lengthUnit만 검사하고 unsupported/invalid/zero-size는 fail-closed로 처리한다. 실제 DOM 날짜 anchor/역 reveal·DST 등 1px 기준과 일치하는지 검증해 기술 gate와 한계를 기록한다. date-scroll DST 오류 관측이 있으면 원본 FAIL을 남기고 같은 adapter의 검증된 contentX + public left reveal 대안을 사용한다.

ui_ux 초기 설계 비교 PASS다. 최종 구현·증거 비교와 독립 PRE_QA는 아래 단계 기록을 따른다. 후속 lane48px·최대88px·OFF0은 측정 후보이며 MT1에서 lane 제품을 구현했다고 보고하지 않는다. UI/UX Pro Max의 targeted focus visibility 지침은 Web focus 가시성 보조로 적용하며 DESIGN/제품 token을 교체하지 않는다.

## 최초 빠른 검증과 Core 기술 REWORK

모델 신규24+관련 기존32=56Unit 및 변경 lint PASS다. 최초 모델 fixture 부모 누락 FAIL을 보완하고 원본 로그를 보존했다. 통합 typecheck 최초 adapter 선택적 타입/probe 오류를 보완한 뒤 exit0을 확인했으며 최종 동결 시 다시 검증한다.

최초 실제 Chromium은9case 중1PASS/8FAIL이다. 5폭 행 관측은 공개 filter 직후7행에서 Day→Week props 전환 뒤10행으로 복원되는 실제 Core/app 연동 경계다. 외부로 직접 호출한 native filter가 scale props 재적용까지 자동 보존된다고 가정할 수 없다. M-only/empty의 기존 Dashboard fixture 일반Task 전제 TypeError와 fullscreen 종료 accessible label 오류는 별도 fixture/oracle FAIL이며 원본을 보존한다. 날짜 helper reveal1PASS만으로 전체 기술 gate를 통과하지 않는다.

Manager는 개발 전용 기술 probe의 명시 요청 ID ref와 scaleMode 전환에 한정해 기존 canonicalSyncQueue 뒤 공개 filter를 재적용하는 최소 continuity 보완을 승인했다. 현재 source/key/api/generation/request/visibility/scale 검증·cleanup을 적용하고 source 변경/null reset은 요청을 폐기한다. production 기존 필터는 바꾸지 않는다. 이후 기술 PASS도 controlled display projection을 재적용한 조건에 한정하며 #552의 실제 visibleTaskIds/공통 queue integration이 별도로 필요하다. native 자체의 미보장 계약을 성공으로 바꿔 쓰지 않는다.

## 최종 LOCAL_VALIDATED와 DOCUMENTATION_SYNC

동결 모델 신규24+기존32=56, adapter 신규5+기존11=16으로 서로 다른 Unit72개 PASS다. 실제 Chromium synthetic canonical/설치 Core 기술 실험9/9 PASS(exit0,30.2초), typecheck exit0, 변경 lint error0/기존 warning4, Markdown/diff PASS다. 최종 adapter SHA-256 `8f3dc6a6587def3f8fac6e5c585f0f2f944df04732dc13b9d4b4f5886f641798`, ProjectGantt `86b885a40a6d017488eec9de0457bfaabcd86e0505643cb4b3e88bca4bd7ab8d`, E2E `ae608ffe280a0f0e9667a1e918523c85b61074d8b725f267e847238b1a42c2fb`를 선별 JSON의 sourceHashes와 대조한다. 최초 수정 source hash는 NOT CAPTURED이며 baseline SHA로 대체하지 않는다.

native 날짜 reveal은 NY Day -1px/Week -39px, calendar helper+public left는0px였다. 원인을 DST 하나로 단정하지 않는다. M-only right end는 기존 #367 monotonic 축 정책에서 2026-10-24→2026-10-25로 관측되었고 start 유지/축 비축소/날짜 insideRange+reveal visible/canonical 불변/mutation0 조건을 검증했다. 최초1PASS8FAIL과 후속8PASS1FAIL을 숨기지 않고 원본 요약/선별 화면과 별도 /tmp trace를 보존한다.

독립 UI 검토의 추가 관측: Week 화면에서 T-year Jan1,2027 위 month label July2026, DST March10 위 November가 보인다. Day 화면은 일치한다. 원인과 이전 baseline 재현은 NOT TESTED다. native Task anchor±1px 일치는 날짜 header 전체 의미 정합 PASS가 아니다. 현재 행·빠른 보기를 유지하는 MT1 기반 범위는 진행하되, #551 lane 활성화 전 날짜 anchor와 표시 header의 의미 정합을 별도 기술 gate로 해결·검증한다. 390px은 기존 minWidth720 작업면 밖 Chart라는 제한이 있고 lane48/88px·전체 narrow 가시성·후속 keyboard/storage는 미검증이다.

문서 작성자는 frontend(기능/UX/architecture), Manager(Packet/PLAN/version/CHANGELOG)다. required docs: MILESTONE_TIMELINE 신규, DESIGN/AGENTS 최소 참조, ARCHITECTURE/REQUIREMENTS/PROJECT_UX/MILESTONE_STAGE_GATES/UI_UX_GUIDELINES/TEST_PLAN/PRO_FEATURE_MATRIX 및 본 Packet/PLAN/CHANGELOG. API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/IMPORT_SCHEMA/VBA_EXPORT/EXPORT/DEPLOYMENT/CI_CD/REMOTE_VALIDATION은 route/schema/auth/revision/engine/import/export/deployment/workflow 계약이 변하지 않아 N/A다. 단일 adapter의 설치 타입/helper 결합과 controlled filter 재적용, 후속 미활성 경계를 설명한다. 문서 REWORK 이후 Manager가 전체 diff와 참조/버전 검증을 확인한 시점에 DOCUMENTATION_SYNC PASS로 판정하고 exact staged tree의 독립 PRE_QA로 넘긴다. 공식 quality/e2e/docker, QA_FINAL/Manager ACCEPT는 NOT TESTED다.

## 최신 main 통합과 QA 준비

게시 직전 main drift `dca2f7821f277ef31ee3dbcbdc1e51ad257209f0 → 08ac7749efc4544dfc125853d9e58ef3a9d56b21`(PR #488/#487)을 확인했다. branch를 fast-forward하고 공용 Playwright setup/CI timeout·관련 정적 검증/기존 E2E 및 문서를 모두 보존했다. TEST_PLAN/PLAN의 양쪽 추가 문단을 통합했다. 제품 source/domain/API/version 변경은 없고 최종 기술 실험 source hashes도 불변이므로 해당 Local Fast Feedback은 재사용한다. 실험 baseline은 이전 dca2 SHA, 최종 게시 parent는08ac SHA로 구별한다. version은0.103.0 유지한다. 기존 runtime 산출물은 게시하지 않는다.

DOCUMENTATION_SYNC: PASS. frontend Week header 관측 FAIL/원인 baseline NOT TESTED 문서 REWORK를 확인했고 required docs/N/A와 version/Markdown/diff 검증을 완료했다. 최종 exact staged tree를 독립 PRE_QA 대상으로 전달한다. PR CI 결과/최종 ACCEPT는 NOT TESTED다.

## 2026-10-10 최신 main 재정렬·재검증 인계

- 이전 PR #557 head `2ac846da822f8b67abea01ef9d1f535b1a8a54dc`의 [CI #2230.1](https://github.com/planner77/masterGantt/actions/runs/37848532318)은 quality/e2e/docker 모두 PASS다. 최초 #2210.1 Chromium #514 wheel 실패는 이후 정확한 DOM 이동 관측 보완으로 해소했다. 과거 head의 PASS를 새 head의 PASS로 표시하지 않는다.
- 2026-10-10 기준 main `f1ac9fef186a635d08b51c878376925567653736`, application `0.103.1`; 선행 기준 `3457d1fac8e50c43beafa7d662fbaf692e72127c` 대비 93커밋 진척으로 PR 충돌 상태를 확인했다. 신규 공통 기반에는 version `0.104.0`(MINOR)을 사용하며 package/lock/CHANGELOG를 함께 갱신한다. 기존 `0.103.0`은 이미 #538의 main 릴리스이므로 재사용할 수 없다.
- 기존 #549 원본(공통 순수 모델, Core version-bound adapter, unit/synthetic Chromium, canonical 보존)과 이전 #514 E2E 보완을 보존한다. 충돌 범위는 문서·source/manifest로 제한하며 #530 peer viewport 정합, #568 진단 추적, #569 PoC/ADR, 위험도 기반 QA 문서를 최신 main 기준으로 유지한다. Milestone display 전환은 MT4 #552까지 하지 않는다.
- [MILESTONE_TIMELINE](../../MILESTONE_TIMELINE.md)에는 #549 current→target 계약과 #569 PoC의 native scroll 단일 소유, 좁은 폭 NO_SCROLL_CAPACITY, 제품 도입 DEFER를 분리 기록한다. #549 dev-only 기술 probe의 9 PASS는 #569/#551 통합 제품 검증이나 Week header 의미 PASS를 의미하지 않는다.
- DOCUMENTATION_SYNC은 해당 source/문서/버전 통합 내용을 포함하며 API·SQLite DB schema·Security·Scheduling Engine·Export 동작·GitHub workflow 의미 변경은 N/A다. 단일 에이전트 순차 검토이며 독립 QA의 새 head 검증은 NOT TESTED. 새 PR CI 결과는 actual run/head를 별도 확인해야 한다.
- 관련 후속 PR #559/#560/#561/#562는 stacked 선행 관계와 버전 재정렬이 별도로 필요하다. 이번 승인 범위는 **새 exact-head PR CI 시작 확인**까지다. merge/main CI/GHCR/tag/Release/Issue 종료는 하지 않는다; `release_required=true / release_authorized=false`.

## 2026-10-10 PR CI #2348.1 회귀 수정

- Run [#2348.1](https://github.com/planner77/masterGantt/actions/runs/38000871776), exact head `f636d3073c8153726be8b06d3e798d83a4752845`: Chromium shard2 `tests/e2e/milestone-timeline-core.spec.ts:171` FAIL(기대 축 width >37404, 실제 37404). 같은 shard 86 PASS/1 FAIL/1 SKIP, shards 1/3/4/5/6와 Quality/Docker는 PASS. E2E aggregate FAIL. 원본 log·trace artifact ID `11649692848` 보존.
- #530 peer viewport의 프로그램식 scroll guard는 대시보드에서 일정 복귀 직후 동일 identity 동안 다른 `scroll-chart(left)`를 차단할 수 있다. 이 시험은 실제 사용자 입력 없이 dev-only probe의 `scroll()`을 호출했으므로 extension precondition인 public left 변화가 발생하지 않았을 가능성이 높다. 실측 trace까지 원인 확정한 것은 아님.
- 테스트는 실제 Chart 내부 `page.mouse.wheel(31,0)`로 새 user intent를 발생시켜 이전 guard를 해제한 뒤 synthetic right-edge를 사용한다. 축 확장은 고정 5 RAF가 아니라 bounded poll로 검증하며 `nextTimelineScaleWidth`의 오른쪽 임계/축 실제 증가 assertion을 제거하지 않는다. 확대 뒤 동일 Core instance, filtered Task IDs, Link, canonical IDs, 요청 없음(POST/PATCH=0)을 검사한다. 이 수정은 본래 제품의 복원 보호를 약화하거나 bypass하지 않는다.
- Product `0.104.0` 유지, 최신 main `f1ac9fef186a635d08b51c878376925567653736`. E2E 테스트와 설명 문서만 변경, API/DB/auth/engine/export/CI/GHCR 계약은 N/A. Local Playwright 재현/독립 QA_FINAL 및 새로운 exact-head 원격 checks는 실제 실행 전 NOT TESTED. 요청 종료점은 새 PR CI 등록이다.

## 2026-10-10 Main CI #2359.1 재현 기반 보완 — 휠/Core 이벤트 순서

- Issue #549 PR #557 merge `45a248f723e11133a4bd4c73ca14bb69b3071cbe`의 [Main CI #2359.1](https://github.com/planner77/masterGantt/actions/runs/38006587229) (run38006587229) completed/failure. Chromium shard2 job114076706278: 86 PASS, 1 FAIL, 1 SKIP. Quality/다른 E2E5 shard/Docker PASS, E2E aggregate FAIL, Main 임시 GHCR publish SKIPPED.
- [원본 Playwright trace artifact 11651782948](https://github.com/planner77/masterGantt/actions/runs/38006587229/artifacts/11651782948)의 실제 `data-gantt-public-scroll-events`: 복귀 Core/native `left=26640`, probe의 `scroll-chart(requestedLeft=36960)` **다음에** 앞선 휠의 `scroll-chart(requestedLeft=26671)`가 늦게 발생. 최종 좌표는 우측 임계에 미달, `width=37404` 불변. 이는 단순 Core resize 지연이 아니라 **wheel 이벤트의 browser/Core 반영 완료 전 programmatic right-edge 이동을 요청한 경쟁**이다.
- 원인 분리: #530 복원 guard 해제에는 trusted wheel 사용이 필요하지만 `await page.mouse.wheel()` 완료는 Core와 native scrollLeft 반영 완료를 보장하지 않는다. 기존 Main 테스트는 두 호출을 연속 실행하여 늦은 wheel이 마지막에 덮었다. 실패 본문과 Trace가 실제 위 이벤트 역전을 증명한다.
- 테스트만 최소 수정: trusted wheel 직후 **Core left 증가 및 native Chart left와의 ±1px 정합을 유한 Playwright poll로 직접 확인**하고 기존 5 RAF settle 뒤, 최신 관측 scale width/chart width를 사용해 right-edge 이동. #367 **실제 width 증가** assertion은 그대로 유지하고 동일 instance·filtered rows·Link/canonical IDs·mutation0 assertion도 유지. 10초 bounded poll에서 해결되지 않으면 FAIL; retry/skip/timeout 증대나 #530 guard/제품 로직/CI required checks 완화는 하지 않는다.
- 본 후속 PR은 이미 `0.104.0`이 main에 merge된 상태의 **test/docs-only corrective change**이며 package/lock/version 변경 없음. 실패 Main과 동일 Issue의 인접 corrective merge를 Generic Finalizer가 lifecycle version span으로 평가해야 하고, 정식 릴리스는 미승인(`release_authorized=false`). 성공한 main/GHCR candidate 또는 정식 v0.104.0 릴리스 증거는 아직 없다. 원 실패 기록은 보존한다.
- Reviewer 정책: 다중 화면 스크롤 경쟁이므로 HIGH/`qa_required=true`; 이번 corrective Head에서 독립 QA_FINAL PASS가 필요하며 PR CI도 다시 통과해야 한다. API/DB/권한/엔진/Export/운영 코드는 N/A. 실행 방식: 단일 에이전트 순차 구현; 독립 Reviewer 실행은 실제 지원 여부에 따라 별도 기록. 사용자 요청 경계: 새 Main CI 시작, 정식 tag/GHCR promotion/Issue close는 미승인.

## 2026-10-10 corrective PR #590 CI metadata trace 보완

- 신규 PR #590의 최초 [CI #2361.1](https://github.com/planner77/masterGantt/actions/runs/38008693672)은 `verify-ci-run-trace.py`가 제목의 단독 `#549`를 Primary Issue 표현으로 인식하지 못해 변경 경로 판정에서 즉시 FAIL. 이 실행의 Quality/E2E/Docker 구현 Job은 SKIPPED이며, Main CI 회귀 재실행 증거가 아니다.
- Title regex는 `Issue #549` 또는 `(#549)`를 허용하므로 제목을 `test: Main CI 휠 이벤트 순서 경합 보완 (#549)`로 수정했다. 제목만 수정하는 `pull_request.edited`의 metadata-only CI는 과거 동일 Head 전체 실패로 fail-closed될 수 있으므로, 원 실패·정정 기록을 Work Packet에 동기화하는 추가 commit을 통해 새 **push 기반 전체 PR CI**를 요청한다.
- 기존 test code의 trusted wheel → Core/native 동기 관측 → right-edge command 순서는 불변. app `0.104.0`, #530/#367 제품 로직·required checks·timeout 불변. 새 PR CI 및 독립 QA는 실제 증거 전 NOT TESTED.
