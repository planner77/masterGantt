# Issue #553 Work Packet
## ISSUE / REQUEST
repository: planner77/masterGantt
issue: #553 (Epic #548 MT5)
latest body: https://github.com/planner77/masterGantt/issues/553
lifecycle_phase: PLAN → BRANCH → IMPLEMENTATION → LOCAL_FAST_FEEDBACK → DOCUMENTATION_SYNC → PRE_QA → PR_CI_STARTED
사용자의 최신 지시가 Issue 등록만이라는 옛 본문의 실행 경계를 대체한다. #549→#553 순차; #552 PR561/head fed88f5e00e104a35cca44c342005bfe8fd04f4e/run37839172928 등록 완료 후 착수.
종료 범위: 구현/관련 문서/로컬 빠른 검증/독립 PRE_QA/원격 branch+PR+exact-head CI 등록. CI 결과 모니터링 금지.
## BASELINE
main: 3b9aea97aa885c5ecbf430f39b72ba722bbcf408 (0.102.1), #558/#487 CI-only APT retry; predecessor stack에 merge/cherry-pick하지 않는다.
parent: fed88f5e00e104a35cca44c342005bfe8fd04f4e
base: feat/issue-552-milestone-visibility
branch: feat/issue-553-milestone-interchange-regression
worktree: /home/planner/Dev/masterGantt-worktrees/issue-553
existing remote branch/PR/comments: 0 at intake; local branch preparation PASS. CI result NOT TESTED.
version: 0.106.0 → PATCH 0.106.1, 기존 export 의미의 안내 보완/통합 회귀; 새 renderer/기능 계약 없음. Manager 단일 소유.
release_required: true (제품 안내 변경 + version bump), release_authorized: false (PR CI까지 승인). tag/GHCR/merge/Issue close/cleanup 미실행.
## REQUIREMENT / ACCEPTANCE
1. 고정 canonical fixture: nested S/T, M-only S/empty S; direct/inherited/override membership, manual empty M, Ready/Blocked/completion mismatch+lock; same/near/long M; T-only/M-only/internalFS/SS/FF/SF signedlag supportedpaths; legacy mixed export/reimport rejection; resource/group/role/logistics outside scope.
2. 표시/탭/필터/marker 조회 save0, revision/task/link/membership/effective hierarchy/summary/full gate/resource/logistics invariant; 명시 편집만 canonical mutation.
3. JSON1.1 fullscope independent livehidden/filter/OFF; newproject UUID+FK remap vs semantic equality; unsupportedlegacy atomic reject; Resource/Logistics exclusion currentpolicy; projectcopy/template/subtree/multirootcopy/cut fullcanonical/locks/external policy/rollback. actual HTTP/nativeSQLite/process restart.
4. Excel canonicalTasks/Gantt/Membership/fullgate/effort/report F vs E/P/catalogrevision/null0partial/M/M preserve; includeDependencies=false membership retained; #529 opt-in/default/logistics unchanged. SVG/PNG existingfullWBS/dateclip/failclosed/securitylimits cleanup. 간결한 dialog안내: 화면의 Milestone 표시와 별개로 원본 일정 데이터를 출력하며 현재 Gantt 레이아웃과 다를 수 있음.
5. 연결흐름: marker/cluster→sameEditor mutation; memberfilter/OFF/reset/scope/peer; Dashboarddate/members→return; Resource/Group/M→exactIDs+scope/page+return; legacydeep/scope/stale/empty; hiddenMcopy/delete/move/401/412/cancel preserve; OFF/search/collapse export canonicalcompare.
6. 390/768/1024/1440/1920 Day/Week/actualgeometry keyboard focus/instance/scroll/tree/columns/scales/currentintent. 기존 #551/#552 exact-source 증거는 영향 분석 후 제한재사용, 새 통합 위험은 직접 실행. no class-only oracle.
7. 작성자 분리 read-only QA, AC↔test↔docs↔exact PR/run NOT TESTED trace table linked Epic (close 금지), guide new location/toggle/membership/relations/exportlimits.
## OWNERSHIP
Manager: package.json/package-lock.json/CHANGELOG/docs/exec-plans/active/PLAN.md/ISSUE_553.md/docs/MILESTONE_TIMELINE_TRACEABILITY.md + official Issue/Epic STATUS (no close).
backend primary: new tests/integration/milestone-timeline-interchange*.test.ts, backend-owned new fixture/helper under tests/fixtures/issue-553 and new tests/e2e/milestone-timeline-interchange-http.spec.ts. Existing backend export/service changes ONLY concrete defect, report before common contract change.
backend docs: docs/IMPORT_EXPORT.md, docs/EXCEL_EXPORT.md, docs/IMAGE_EXPORT.md, docs/MILESTONE_STAGE_GATES.md. Own HTTP server execution; browser server/testing runs sequential with frontend, coordinate Manager.
frontend: export dialog product implementation and directly related UI tests tests/e2e/milestone-timeline-interchange-ui.spec.ts, selected synthetic output/playwright/issue-553/frontend; actual user's guide existing location inspect.
frontend docs: docs/MILESTONE_TIMELINE.md, docs/PROJECT_UX.md, docs/REQUIREMENTS.md, docs/TASK_EDITOR.md, docs/TASK_RELATIONS.md, docs/TEST_PLAN.md + existing/new scoped user guide. Backend supplies TEST_PLAN evidence, frontend writes.
infra: branch/worktree preparation now; exact staged manifest publication only after separate Manager GO.
ui_ux: bounded read-only design/implementation review if structural change; small export notice frontend can use DESIGN/UI guide; final independent UI review if needed.
qa_docs: DOCUMENTATION_SYNC after PASS, read-only independent PRE_QA, no source/doc/index mutations.
Read docs AGENTS/LIFECYCLE/AGENT_PROMPTS/DESIGN/UI_UX all Issue-listed contracts + installed Next docs before code. Agents not alone, preserve other edits; no recursive delegation.
## VALIDATION / BOUNDARIES
Minimal affected unit/integration + actual HTTP/restart + focused actualCore UI cases. Full local Vitest/Playwright/Docker forbidden unless evidence justifies. FirstFAIL preserve, no skip/assertion/tolerance/securitygate weakening.
No .github workflow/server/API/schema/domainpolicy/new timeline exporter/realDB/secrets/logs/traces commits. Syntheticselected PNG/JSON only. Next auto next-env/tsconfig exactparent restoration once servers teardown; Agent ownership explicit before restore, tsc thereafter.
Docs DESIGN/AGENTS/API/DB/SECURITY/SCHEDULING/CI/REMOTE/GITHUB/DEPLOYMENT each N/A rationale if contractunchanged.
quality/e2e/docker/QA_FINAL/ACCEPT main/release/environment NOT TESTED, never inferred from local.
## ISSUE_LOG / HANDOFF
issue_comment_writer: manager
issue_comment_allowed_types: NONE for agents
Return Result Contract including actual files/hashes/commands/time/results/sourcefreeze/reuseimpact/firstFAIL/docsNAs/remainingrisks/issue_log_type+summary+decision_required.
No local commits, remote PR/CI agent-specific GO only.


## 착수 후 정적 회귀 inventory와 파일 소유권 확장

독립 QA 자문에서 #552 이전 Milestone native 행/Add/F2와 구 count 라벨에 의존한 기존 E2E를 확인했다. 실행 FAIL과 구분되는 정적 회귀 위험이며 새 spec 추가만으로 보호하지 않는다. frontend는 아래 기존8spec의 해당 보호 대상을 현재 UI 경로로 이관하고 직접 관련 case를 실행한다. 원래 UI를 test hook으로 부활시키거나 skip/assertion 약화로 우회하지 않는다.

- milestone-stage-exchange.spec.ts: M Editor 진입과 교환/Copy/Template 보호.
- milestone-stage-editor.spec.ts: M Editor·소속·완료 잠금.
- project-search-filter.spec.ts: M WBS 제외와 일반 작업/direct/context Summary count 의미.
- project-gantt-stability.spec.ts: 숨긴 M child-command와 기존 서버 parent 제한의 대응.
- project-gantt-inline-name.spec.ts: 일반 Task/Summary inline 유지, M rename은 같은 Editor/canonical snapshot으로 이관.
- project-notifications.spec.ts: 현재 생성/저장 경로의 toast/error/race 보호.
- project-context-toolbar-responsive.spec.ts: 새 count 라벨·실제5폭 toolbar geometry.
- project-filter-toolbar-consistency.spec.ts: 새 count 의미·Task 조건 일관성.

테스트 파일은 tests/e2e 아래이며 위8개는 frontend 단일 소유다. 기존 전체 로컬 suite를 수행하지 않고 변경 case와 보호 대상별 대응 증거를 TEST_PLAN/추적표에 연결한다. source/helper 변화 영향은 별도로 검토한다.

추가 fixture type 교차 확인 뒤 최종 이관 대상은 기존10spec이다. project-gantt-inline-start-date.spec.ts의 M 날짜 inline 보호는 실제 같은 Editor 날짜 변경으로, project-task-hover-tooltip.spec.ts의 M native bar 보호는 Timeline marker의 실제 정보·날짜·접근성으로 대응한다. 일반 Task inline/hover 검증은 유지한다. raw UUID만으로 후보였던 project-settings-layout-490/task-editor-form-density는 별도 fixture의 일반 Task라 대상에서 제외했다. 공통 tests/e2e/helpers/milestone-ui.ts는 frontend 단일 소유다. M child Add 비노출은 현재 UI no-command와 기존 server parent 제한 Unit에 연결하며 알림의 표시·오류·race 보호는 일반 root 생성422 생산 경로로 대응한다.

## 기존 증거 재사용의 실제 source 비교

Manager 착수 비교에서 #552 최종 source125 중 현재 변화는 src/features/projects/project-excel-export-button.tsx의 안내1개다. core/geometry/Timeline은 해당 #552 fresh44case 보호 범위에서만 제한 재사용한다. #551 source10 중6개는 이미 #552에서 바뀌었으므로 #551을 현재 unchanged-source PASS로 안내하지 않는다. 새 common dialog 안내·새 통합 흐름·이관한 기존 test는 fresh 실행하며 이전 standalone PASS를 실행하지 않은 MT5 actual restart/export 의미로 확대하지 않는다.

## 계약별 문서 영향 분석 (구현 종료 후 재확인)

- 필수 갱신: backend IMPORT_EXPORT/EXCEL_EXPORT/IMAGE_EXPORT/MILESTONE_STAGE_GATES, frontend REQUIREMENTS/PROJECT_UX/MILESTONE_TIMELINE/TASK_EDITOR/TASK_RELATIONS/TEST_PLAN/새 MILESTONE_USER_GUIDE/README 링크, Manager CHANGELOG/PLAN/본 Packet/MILESTONE_TIMELINE_TRACEABILITY.
- DESIGN/AGENTS N/A: 공통 visual language·역할·gate를 변경하지 않고 기존 muted 문단/대화상자를 재사용한다.
- API/DB_SCHEMA/IMPORT_SCHEMA N/A: route·입력/응답·Origin/If-Match·JSON1.1 schema·migration·영속 필드가 동일하며 신규 파일은 테스트 fixture/spec다.
- SCHEDULING_ENGINE/SECURITY N/A: 알고리즘·전체 Gate·완료/Assignment 잠금·인증/session/revision/rollback 정책을 변경하지 않는다. 화면 설정을 서버 권한 근거로 사용하지 않는다.
- ARCHITECTURE/PRO_FEATURE_MATRIX N/A: export renderer/Route-Service-Repository 경계·Core 설치버전 adapter·지원 기능 범위가 동일하다.
- CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/DEPLOYMENT/REPOSITORY_STRUCTURE N/A: application PATCH는 현행 version 정책 적용이며 workflow·Docker·runtime·경로·registry 권한/운영 계약은 변경하지 않는다. 기존 branch/PR CI만 등록하고 결과 모니터링을 하지 않는다.
- VBA_EXPORT N/A: Excel/VBA producer 매핑을 변경하지 않으며 실제 Windows/DRM는 별도 NOT TESTED.

이 N/A는 해당 계약 문서의 수정 필요가 없다는 영향 판정이며 CI·환경 검증 PASS를 뜻하지 않는다. source/test 변경으로 계약 영향이 생기면 재분석한다.

## 구현 결과와 DOCUMENTATION_SYNC 인계

제품 변경은 기존 export 대화상자의 원본 일정/layout 차이 안내 문단1개이며 renderer/API/schema/권한/domain은 유지한다. 신규 integration13·실제 HTTP/restart3·UI 고유37(새10+기존27)·기존 parent 제한 Unit6의 로컬 증거와 최초 실패·source 제한 재사용을 TEST_PLAN/추적표/선별 execution-contract에 연결했다. 최종 typecheck·변경 lint·version·문서 링크·diff check를 확인한다.

위 필수 문서를 갱신하고 계약별 N/A 근거를 재확인하여 DOCUMENTATION_SYNC PASS로 read-only PRE_QA에 전달한다. 실제 독립 PRE_QA/Manager GO/원격 PR와 exact head CI 등록은 Issue STATUS에 기록한다. 결과 모니터링0이며 quality/e2e/docker/QA_FINAL/ACCEPT는 NOT TESTED로 유지한다. Next 설정은 frontend가 중간과 최종 서버 종료 시 복원했으며 각각 뒤의 실제 typecheck를 구분한다.

## 2026-10-09 PR CI 실패 보완 기록

- 최초 PR CI: https://github.com/planner77/masterGantt/actions/runs/37847151509 (`b4bc7e8`), E2E shard 2–6 FAIL, quality/build/docker PASS.
- 원인: #552 Milestone 표시 구조가 native WBS 행/막대/혼합 link를 분리했으나 레거시 E2E는 종전 native locator로 접근. 일부 viewport는 Milestone 제외 후 scroll 높이가 줄어든 환경에서 고정 픽셀을 전제.
- 보완: 일반 Task 사이 관계와 fullscreen 테스트 진입, canonical Milestone 데이터/대시보드 검증, 물리적으로 scroll 가능한 ordinary WBS fixture, 계층 메뉴의 Convert 시점 조정. E2E skip·timeout 완화는 적용하지 않음.
- 새 exact-head 공식 검증과 QA는 결과 확인 전까지 NOT TESTED. merge/main/GHCR/release/Issue 종료 미승인.

## PR CI #2246 (2026-10-09) 후속 실패 진단

- Exact-head run https://github.com/planner77/masterGantt/actions/runs/37853503260 (`8734a98`): 단위·타입·Lint·Build·Docker·정책 PASS, Chromium shard 2–6 FAIL.
- Milestone의 retired WBS bar/row·mixed SVG link를 여는 E2E가 다수 잔존했고 새 #552 Dashboard/Task Editor 진입으로 수정했다. 별도 일반 Task Relation Editor 경로로 키보드·삭제·pending·readonly·fullscreen을 검증한다.
- metadata 저장 시 Core가 nonzero scrollLeft를 clamp하는 경로에서 기존 0-only 복원이 동작하지 않아 실제 입력 우선·고정 column/scope 조건하에 정확한 viewport를 복원하도록 조정했다. 필터 변경 시에는 이전 위치를 복원하지 않는 기존 기준을 유지한다.
- PR/new exact-head CI는 반드시 새 commit 대상으로 판단한다. QA_FINAL, Main, GHCR, 환경별 검증은 NOT TESTED.


## PR CI #2250 재보완 / 새 PR CI 등록 (2026-10-09)

- 실패: https://github.com/planner77/masterGantt/actions/runs/37856833368 (head `8bf7057`), E2E 16건(shards 3/4/5/6), quality/Vitest/typecheck/lint/build/Docker 및 shards 1/2 PASS.
- 변경: `7c863cc` readonly 관계 **조회**(mutation 미허용), 두 visible ordinary Link fixture, native blur 단일 PATCH 및 unrelated Task 경로; `0654865` canonical WBS filter 이후 viewport 후처리와 bounded snapshot cleanup; `908685b` peer 복귀 지연 중 wheel 우선 복구. User input > old peer restore, 동일 scope/scale ID 유지 시 viewport 복원, 실제 필터 집합 변경 시 기존 위치 미복원.
- 정합: #552 Milestone native WBS행 비복원, canonical Link/Membership/Project revision 불변, 관찰한 최초 실패 로그 보존. 새로운 API/schema/migration/dependency renderer는 추가하지 않음.
- 실행 근거: 정확한 head의 PR CI https://github.com/planner77/masterGantt/actions/runs/37859412326 (#2254, 최초 head `908685b`)는 등록만 확인한 상태이며 최종 docs sync 새 head 기준으로 다시 실행한다. PASS 추정 금지. QA_FINAL/Manager ACCEPT/Main CI/GHCR/release/Issue 종료 및 환경별 UX: NOT TESTED.

## PR CI #2255.1 실패와 이번 exact-head 재검증 (2026-10-09)

- 실패: https://github.com/planner77/masterGantt/actions/runs/37859565333, head 97c09f4cf4bc2b173d2c9fdd7333da7a90cefdb5. quality/Vitest/typecheck/lint/build/Docker PASS, Chromium shard 2~6 E2E 14건 FAIL.
- #551 5폭 날짜 tick↔native bar 3018~3036px 오차 및 #51 Day/Week 우측 확장: 과거 WBS viewport를 generic resize/date reveal에 재적용하는 경로 제한. 정확한 canonical request에서만 restore하고 명시적 scroll-chart navigation은 기존 snapshot을 무효화한다. 이전에 PASS한 픽셀 1px 기준은 유지한다.
- #529 DOM/native 정수화 ±1px만 peer-viewport-capture 계약 범위로 허용. Core public은 정확히 일치하고 오래된 120px 위치 복귀는 실패로 본다.
- #456 실제 Chart scrollable 범위가 120px 이상인지 보장하기 위해 필터 조건 밖 미래 Milestone fixture를 설정하고 0행 변경 후 public/DOM 원점 복원 판정. #266 390px은 실제 이름 target과 열려 있는 관계 탭 확인. #344 412 후 같은 scrollLeft 수렴, #notifications DOM↔Core baseline 동기화 후 상태 불변.
- #140 Tab에 의한 blur는 Core Editor 입력 해제 전에 revision guarded name-only PATCH를 정확히 한 번 실행하고 Escape/invalid/401 가드를 유지한다.
- 보완 소스 커밋 ff39fb4030a33c22e40d9b821540bbad5a1cd783. 새 exact-head PR CI 통과 여부/QA_FINAL은 NOT TESTED; merge/main/GHCR/release/Issue 종료/브랜치 정리하지 않는다.
