# Issue #816 — Gantt Grid 행·Task 막대 높이 축소 Work Packet

## REWORK #4 — Full #3318.1 Task 삭제 우클릭 실패 (2026-10-26)

- 재개 기준: 기존 PR #817 / Head `e69cd78c530f3d3ec148f74484e540a2aa236e97`, main/base `cd010d6bcff26f10ad00c42cdf3528b851519938`, test merge `2dc65601e46a0273872b6245399554c42c8d0a30`. [Full #3318.1](https://github.com/planner77/masterGantt/actions/runs/40311630203)의 Quality/Docker PASS, Shard5 `121535073428` 직접 FAIL, E2E/QA 파생 FAIL; 다른7 shard CANCELLED의 내부 로그는 infra가 대조한다.
- 신규 F816-005: `project-task-delete-context.spec.ts` normal recovery의 Delete D Chart bar 우클릭에서 Summary 하위 `.wx-progress-marker`가 pointer를 가로막아 본래90초 제한에 도달했다. 원인 분류는 재현 전 UNKNOWN이며 기존 hover 원인과 같다고 단정하지 않는다. 기존 F816-001~004의 판정·반례·미실행을 보존한다.
- 소유권: root Manager=요구·계획/버전·누적 원장/관련 문서·최종 commit/push/CI 시작; infra=원본 전체 이력·실패/취소 로그·provenance read-only; frontend=`project-task-delete-context.spec.ts` 원본 재현·`gantt-scale-toolbar.css`의 Project-local native progress marker 배치 및 기존 Summary/progress 회귀 확장; ui_ux=설치 Core marker/접근성·geometry 설계 read-only 검토; qa_docs=DOC_SYNC 이후 별도 read-only 사전검토. 동일 파일 동시 쓰기 금지, Sub-Agent GitHub 댓글/commit/push 권한 없음.
- TEST_LIFECYCLE_REVIEW: 기존 삭제 normal/stale/unavailable/401/412/network·subtree/readonly/선택 사례와 Summary/hover/projection hit 경계를 검색한다. 누적 실제 실패4개 spec 합집합(기존3개 + delete-context)과 직접·인접·음성 소비자를 같은 동결 source에서 순차 검증한다. 실제 right-click/확정 삭제 보존·canonical/revision·unknown 잠금/명시 복구·같은 instance/scroll/tree/scale 및34/44px·Summary0.55~0.70·Y±1px 단언은 유지한다. skip/retry/timeout/CI8-shard/Required3 정책 변경 금지.
- 버전0.135.2 후보 유지, HIGH/OWNER_MANAGED/qa_required=true, release_required=true/release_authorized=false. 로컬/새 Head 원격·Trusted/Owner는 실행 전 NOT TESTED. 사용자 범위는 **새 Ready Full PR CI 시작 확인까지**이며 CI 모니터링/merge/Main/GHCR/Finalizer/Issue close는 제외한다. 원장·DOC_SYNC는 구현·실행 후 실제 결과로 확정한다.

### REWORK #4 구현·문서 영향 및 검증 인계

- 원본 e69cd78c normal90초 FAIL과 최소 fine hit-ID 회귀 FAIL을 확보했다. opacity0인 이전 Summary의 native26px marker가34px 행의 다음 Task 중심을0.0938px 가로막는 PRODUCT다. 같은 ID Grid/Chart 정렬은 정상이다. 중앙 배치는 Week 자기 Task 이동→progress 분기 위험으로 기각했으며, isolation-only 원본 PASS도 표시/stacking 회귀 미검증으로 채택하지 않았다.
- `gantt-scale-toolbar.css`의 Project Gantt 직계 marker에 비표시 `visibility:hidden`, 기존 bar hover/`wx-progress-in-drag`에서 visible을 적용한다. native top80%/26px/가로 위치·이벤트 처리는 유지한다. 기존 삭제7cases는 보존하고 Summary spec2cases(fine/coarse×Day/Week·실제 center hit·hover 표시·readonly marker0/write0) 및 실제 HTTP/SQLite body 중심 이동(progress0/50/100)·resize·진행률 drag 사례를 확장한다.
- 활성 marker의 인접 행 침범 가능성은 미해결 위험으로 분리하며 원본 숨은 marker 사건 교정과 전체AC4 수용을 혼동하지 않는다. 최초 bounded active probe는 준비POST429로 미도달해 FAIL이 아닌 NOT TESTED였다. 이후 실제 우클릭은 성공했으며 정확 Edit 대상 검증 결과를 최종 원장에 결속한다. 새 소유 서버/DB로 실제 검증하고 rate-limit·skip/retry/timeout/Required3/8-shard는 변경하지 않는다. 원본/실험/최종 실행 수와 source 지문은 [단일 원장](../../ISSUE_816_FAILURE_ANALYSIS.md)에 기록한다.
- DOCUMENTATION_SYNC 영향: 원장·이 Packet·PROJECT_UX·TEST_PLAN·CHANGELOG·active PLAN UPDATED. `DESIGN.md`/`UI_UX_GUIDELINES.md`는 기존 보이지 않는 control의 pointer 간섭 금지와 native 조작성 원칙 적용(Delta C)으로 N/A, `ARCHITECTURE`/GSC/Conformance는 state writer·strictY±1px·U3/instance 계약 불변으로 N/A, API/DB/Scheduling/Import/Export·보안/권한은 데이터/동작 계약 불변으로 N/A, CI_CD/REMOTE_VALIDATION/GitHub/Lifecycle은 기존 게이트·권한·원격 증거 계약 불변으로 N/A, README/AGENTS는 제품 실행법·공통 지침 불변으로 N/A, package/lock은 기존0.135.2 후보 유지로 N/A다.
- 실제 별도 ui_ux가 설치 Core/source·공식 styling/cellHeight와 기존 UX 계약을 읽기 전용 검토했다. 중앙 배치 철회·비표시 marker 최소 보완에 조건부 APPROVE이고 browser PASS/QA_FINAL/Owner ACCEPT는 아니다. 동결 source 실행·별도 qa_docs 사전검토 뒤 root가 원격 상태 재확인/일반push로 새Full 시작 URL·Head를 남긴다. 이후 CI 모니터링·merge/GHCR/Issue close는 수행하지 않는다.

### REWORK #4 최종 실행·판정

- 같은7파일 source 지문에서 누적4spec **31 PASS**(dev23+production5/3분할), 인접 실제 HTTP/SQLite 선택5 **PASS13.8s**, unit40 **PASS318ms**, Build/typecheck/변경test lint0error0warning **PASS**다. 초기cold23실행22PASS1timeout(최초navigation22.123s), shared production8실행5PASS3seed429FAIL, dynamic-import/69좌표 실험·조기standalone 준비 실패는 [원장](../../ISSUE_816_FAILURE_ANALYSIS.md)에 보존하고 최종 고유36E2E+40unit에 중복 합산하지 않는다.
- **F816-006 / PRODUCT / AC4 FAIL:** active Summary hover 뒤 raw mouse로 다음 Week child 중심을 우클릭→Edit 대상이 잘못된 `Stable summary`다. locator.click의 자동스크롤 경로 child PASS는 이 경계의 대체가 아니다. native26px/top80% geometry를 유지한 최소 inactive 보완의 한계로 명시하며 Manager **REWORK**, 전체 기능 QA_FINAL/Owner ACCEPT·병합 **BLOCKED**다. 활성 핸들 설계와 raw 포인터 회귀/해결은 남은 작업이다.
- Pre-PR `fast`/`targeted`는 실제 실행했으나 기존 helper2경로의 자동 소비자 매핑UNKNOWN으로 **BLOCKED/exit1**, 자동18test는 NOT TESTED다. sourceStable=true, working fingerprint `80d7bc86a5708213d2566d89737cf12f7c835aabf823ed4f54892399650bc139`, 보고서2개 및 수동 영향 선정·실행 환경/로그·SHA7은 원장 참조. 정책을 변경하지 않는다.
- dev/production 소유 서버 종료, Next generated config2개 HEAD복원, 자체 output은/tmp보존, 검증 source7지문 동일. root Markdown350파일/diff 검사를 수행하고 별도 qa_docs가 원본/통제/최종 source·실제 로그·문서와 CI 원인 한정 보완/AC4 FAIL 분리를 검토한다. 이는 원격 Required3/Trusted PASS나 Owner 수용이 아니다. root가 미해결review/충돌/remotehead를 재확인한 뒤 일반push로 새Full CI 시작만 확인하며 모니터링은 하지 않는다.

## REWORK #3 — Full #3317.1 coarse-pointer 선택 실패 (2026-10-26)

- Manager 범위: 기존 PR #817 / Head `b3475c064e1b7ef03e4657d0ec6c0b9207ee2e28`, main/base `cd010d6bcff26f10ad00c42cdf3528b851519938`, 버전 `0.135.2` 유지. 최신 Shard1 `121517917754`의 `project-summary-bar-visual.spec.ts:175` 실제 `label.tap()` 후 checkbox unchecked 원인을 재현·분리하고 실제 44px label 조작과 selection/no-write 계약을 복구한다. Quality/Docker PASS; E2E/QA FAIL; 취소 shard의 추가 오류는 infra가 회수 중이다. 이전 F816-001/002/003 원본·미검증을 보존한다.
- 요구/설계/AC: 34px fine/44px coarse·Summary 비율·Grid/Chart ±1px 불변. label의 여백과 input 실제 탭은 같은 선택 동작을 정확히 1회 수행하고 이웃 행 선택/스크롤/DnD/키보드·Shift/Ctrl/readonly에 영향을 주지 않아야 한다. 기존 tap assertion을 checkbox 직접 click으로 대체하거나 force/skip/retry/timeout 완화하지 않는다. 먼저 원본 최소 E2E FAIL을 확보한 뒤 원인에 맞는 최소 제품/테스트 수정만 허용한다.
- 역할/소유권: root Manager가 계획/문서/최종 commit·push·CI 시작 담당, infra(gpt-6.1-sol/high)는 원격 전체 이력·취소 로그·provenance read-only, frontend(gpt-6.1-sol/medium)는 `src/features/gantt/project-gantt.tsx` 및 직접 관련 E2E/선택 테스트만 수정, qa_docs(gpt-6.1-sol/high)는 구현 완료·DOC_SYNC 후 별도 read-only 검토. 동시 동일 파일 쓰기 금지; Agent에게 GitHub 댓글/commit/push/CI 권한 위임 없음.
- TEST_LIFECYCLE_REVIEW: #375/#816 Summary/touch, copy-selection label/input/keyboard/shift/context, #637 projection, #492 hover 및 readiness unit 기존 경계를 검색하고 EXTEND/KEEP_UNIQUE로 선정. 동결한 후보 source에서 과거 실패 합집합과 직접/간접/음성 소비자를 fail-fast 없이 검증하고 명령/지문/미실행 이유를 원장에 기록한다.
- 위험 HIGH / OWNER_MANAGED / qa_required=true 유지. release_required=true/release_authorized=false, 원격 새 Head Required3/8-shard/Trusted/Owner NOT TESTED. 사용자가 승인한 종료 지점은 **새 PR CI 시작 확인**이며 이후 모니터링/병합/Main/GHCR/Finalizer/Issue close 없음. DOCUMENTATION_SYNC와 원장은 구현 결과 후 갱신한다.

### REWORK #3 구현·검증 및 DOCUMENTATION_SYNC

- frontend는 label pointerdown/mousedown/click만 Grid로 전파하지 않도록 보완했고 native input 활성화/onChange·키보드/Shift·readonly를 보존했다. 원래 coarse tap FAIL 재현 → mousedown 단일 통제 PASS → label 여백 실패 추가 발견 → 최종 중앙/여백/input·readonly/no-write 회귀 PASS. 구체 원인·반례/최초 및 취소 로그·로컬 실행 오류는 [단일 원장 F816-004](../../ISSUE_816_FAILURE_ANALYSIS.md)에 기록한다.
- 동결 source(원장 SHA-2566개)에서 E2E 과거 실패 합집합 **21/21 PASS**, private mount namespace의 새 `/data` 실제 SQLite31 migrations+production standalone 선택 **5/5 PASS**(10.9s), unit **40/40 PASS**, typecheck/Build PASS, ESLint0 errors/기존3 hook warnings, diff check/debug 제거 PASS. 중간18PASS/3trace-FAIL·선택1/4→4/1→1/4·첫production0/5는 환경 준비 오류로 보존하고 최종26 고유 E2E와 합산하지 않는다. 로컬 전체8shard/Docker/실기기·before/after main/Trusted·Owner는 NOT TESTED다.
- TEST_LIFECYCLE_REVIEW: coarse spec EXTEND, 이전 projection/hover와 copy-selection/keyboard/URL/context/readonly/readiness KEEP_UNIQUE, 통합/폐기/skip/timeout/retry 변경0. 직접 CLI는 원본 및 누적 실패 합집합을 정확히 고정하는 bounded 진단이며 Pre-PR/CI 정책 변경 없음.
- DOCUMENTATION_SYNC: 원장·이 Packet·PROJECT_UX·TEST_PLAN·CHANGELOG·active PLAN UPDATED. README(기능/실행법 동일), DESIGN/UI_UX_GUIDELINES(기존 native label/44px 규칙 적용·Delta C), Architecture/API/DB/Scheduling/GSC/CI/REMOTE_VALIDATION/Lifecycle(저장/구조/권한/viewport writer/정책 불변), package/lock(기존0.135.2 후보 유지)는 N/A(reason). 자동 생성된 AGENTS/Next config는 복원, 실제 자격증명·DB·빌드·원시 trace는 커밋 제외.
- 역할 실증: infra=gpt-6.1-sol/high 원격 read-only 조사, frontend=gpt-6.1-sol/medium 제품/test·실제 실행, root Manager=계획/문서/통합·commit/push. 별도 qa_docs(gpt-6.1-sol/high)가 코드/테스트/문서·실행 로그/동결 지문을 read-only 검토해 사전검토 PASS를 반환했다. 문서 freshness P3(phase/최초 NOT TESTED 시점)를 Manager가 교정했고 코드/테스트 blocker는 없었다. 이 사전검토는 QA_FINAL/Owner ACCEPT가 아니다. HIGH/OWNER_MANAGED와 release_authorized=false 유지, 사용자 승인 종료 지점은 새 PR CI 시작이다.

## REWORK #2 — CI #3315.1 반복 Hover FAIL 및 Metadata #3316.1 분리 (2026-10-26)

- [누적 원장](../../ISSUE_816_FAILURE_ANALYSIS.md) F816-001/002/003, 인증된 [Full #3315.1](https://github.com/planner77/masterGantt/actions/runs/40301017370) (Head `a2c876a29c8eda35bd60e0a19a2eb7dc08dbf7c7`, testmerge `3633e9661e87c9fe700b16bb1481038ca9932f17`) Quality/Docker PASS, E2E Shard6 #492 Hover 직접 FAIL·Shard2/7 PASS·기타 5 CANCELLED, E2E/QA 파생 FAIL. 별도 [Metadata #3316.1](https://github.com/planner77/masterGantt/actions/runs/40301188286)의 `DEFERRED`는 그 시각 원본 Full 진행 중이라는 비권위 source; 중복 직접 구현 실패 아님.
- 지난 중앙 `scrollIntoView` 보완은 다시 `HOVER_TARGET_NOT_HITTABLE`로 실패하여 폐기. Shard6 실제 report JSON의 Week bar 폭 **19px**·높이27px·좌표 x578/y417.5 및 U3/Core-native 완전 SETTLED를 확인했고 root occluder class는 당시 증거 부족으로 UNKNOWN. 방어적 `elementFromPoint`를 강제로 true 만들지 않고 **좁은 bar 한정 여러 내부 실제 pixel 검증 → 검증된 한 점에서 실제 Playwright hover**로 교정; 넓은 bar/Grid 원래 중심 check, 기존 tooltip/date/focus/scroll/hit assertions 보존. 새 failure artifact에는 좌표별 최상단 tag/class를 담아 진단할 수 있게 함.
- **TEST_LIFECYCLE_REVIEW** #711: existing #492 `project-task-hover-tooltip.spec.ts` EXTEND + 기존 shared `gantt-readiness.ts`/state의 실제 hit point 관측, #375/#637 및 기타 GSC/U3 tests KEEP_UNIQUE. 기존 테스트 삭제·skip·timeout/retry/Readiness state 완화 없고 Core/프로젝트 제품 파일 변경0. F816-001은 #3315 Shard3 CANCELLED로 검증 미도달; original #3314 FAIL을 성공으로 소급하지 않음.
- **검증:** archived original error artifact 실열람(19×27/center blocked), local 합성 headless Chromium 투명 중앙 overlay: center false/좌우 내부 bar true (synthetic, actual source PASS 아님). 이번 앱 Next/real SQLite/Cross-file Chromium 실실행은 NOT TESTED. AGENTS/DESIGN/GANTT_STATE_CONSISTENCY·CONFORMANCE/Adapter ADR/Sync Trace, 원장, Git diff·Codex thread, 관련 테스트 검토. 새 Head Full CI로 실제 판정하고 이후 모니터링하지 않는다.
- **DOCUMENTATION_SYNC:** 위 새 원장+Work Packet 갱신. 기존 PROJECT_UX/TEST_PLAN/CHANGELOG/PLAN의 행34px·Task bar27px·Summary60%·±1px·touch44px 계약 unchanged; API/DB/CI/보안/라이브러리/패키지 불변으로 N/A. risk HIGH/OWNER_MANAGED, qa_required=true, release_required=true/release_authorized=false, Manager ACCEPT·Trusted NOT TESTED, merge/GHCR/Finalizer/Issue close 제외.

## 2026-10-26 REWORK — PR #817 첫 Full CI 및 리뷰

- **원본·누적 실패 원장:** [ISSUE_816_FAILURE_ANALYSIS.md](../../ISSUE_816_FAILURE_ANALYSIS.md), [CI #3314.1 / Run 40284101069](https://github.com/planner77/masterGantt/actions/runs/40284101069), Head `ced5fbf3ef99ba4f3d52bfeed2fc84e87b4e53c4`, base `cd010d6bcff26f10ad00c42cdf3528b851519938`, test-merge `46426d99588d037637bef1d97a27e4efcead09e2`.
- **F816-001 TEST_CONTRACT:** Shard3/8 (Job121444542220) `projection-row-alignment.spec.ts` Day virtual-scroll 고정 target2400 / browser actual2287 (34px row로 native scroll range 감소). 98PASS/1FAIL/1SKIP/42 NOT RUN. `scrollHeight-clientHeight` native max를 측정해 `[300,1200,max,0]`에서 기존 Core/Chart/owner 동등·Grid X120·±1px/virtual membership/negative recovery 계약을 **그대로** 적용한다. Codex P2 review thread #4374759680 대응.
- **F816-002 UNKNOWN(표시/실제 hit 또는 fixture setup):** 최종 Job status는 CANCELLED인 Shard6/8 (Job121444542208)에서도 내부 직접 FAIL 존재. #492 `project-task-hover-tooltip.spec.ts:100` 첫 Chart hover의 유일 blocker `HOVER_TARGET_NOT_HITTABLE`; 63PASS/1FAIL/1SKIP/33 NOT RUN. Occluder/실제 hit-point trace 미보존, source 원인 확정 금지. 실제 bar를 중앙에 **한 번** 놓는 좁은 fixture 준비를 보완하되 기존 `elementFromPoint` hit, 3RAF/U3, Tooltip 실제 내용/close·zero-mutation assertion **유지**. 새 Chromium 판정 전 해결 **NOT TESTED**.
- Required Quality/Docker PASS(원본 Head), E2E aggregate FAIL, QA Automated는 `NEED_E2E=failure` 파생 FAIL. 나머지 Shard1/2/4/5/7/8 모두 CANCELLED(접근 가능한 로그상 추가 assertion FAIL 없음; 개별 PASS 아님). 다른 미실행·취소 케이스를 PASS로 소급 금지.
- **TEST_LIFECYCLE_REVIEW:** #637 기존 E2E **EXTEND** (AC1/AC3 native last-row/strict align), #492 고유 E2E **EXTEND** (AC4 실제 hit 기준 보존), #375 Summary/touch 및 다른 고유 E2E **KEEP_UNIQUE**. 새 test 삭제·skip·timeout/retry/CI Required3/8-shard 조정 없음.
- **DOCUMENTATION_SYNC:** 이 Packet 및 새 단일 원장과 [active PLAN](PLAN.md) UPDATED, 기존 `docs/TEST_PLAN.md`/#816 AC 테스트 목록과 `docs/PROJECT_UX.md`의 Gantt 제품 동작은 그대로 유효해 계약 변경 없음. `AGENTS.md`, `DESIGN.md`, API/DB/Architecture/CI/제품 소스·package/lock: N/A(제품/정책/버전 변경0).
- 로컬/browser/SQLite/실기기 재실행은 이 연결 경로에서 **NOT TESTED**. 원본 Job 로그·review·Git 부모 및 mergeable/source ancestry는 확인. 새 Head Full PR CI로 실제 검증을 시작하고 모니터링하지 않는다. HIGH/OWNER_MANAGED, independent QA·Owner·Merge/GHCR/Finalizer/Issue close 미수행; `release_authorized=false`.

## Issue Work Packet

- repository: `planner77/masterGantt`
- issue: [#816](https://github.com/planner77/masterGantt/issues/816); related #375, #637, #142, #233, #345, #552, #556, #711, #797, #800
- lifecycle_phase: REWORK 4 / FULL_PR_CI_RESTART_PENDING (F816-005 비표시 marker 보완·동결 자동36E2E+40unit PASS; F816-006 raw active pointer PRODUCT/AC4 FAIL, Pre-PR 자동선정 BLOCKED; 새 Head 원격 NOT TESTED)
- baseline/main: `cd010d6bcff26f10ad00c42cdf3528b851519938` (2026-10-26 KST, `0.135.1`)
- branch: `feat/issue-816-gantt-row-density`
- baseline_version: `0.135.1`; current_version: `0.135.2`; candidate_version: `0.135.2` PATCH (new version only; no tag/GHCR promotion)
- requested_scope: repository docs/SVAR official API and related issues → analysis/plan/implementation/tests/doc sync → open review/conflicts → **ready Full PR CI start**; CI monitoring, merge, Main, GHCR/Finalizer, Issue closure OUT OF SCOPE.
- risk_level: HIGH
- risk_reason: changing SVAR Grid/Chart native geometry impacts virtual scrolling, selection, focus, task editing, drag/resize/dependency and touch targets.
- qa_method: OWNER_MANAGED; qa_required: true
- independent_qa: NOT TESTED; manager_decision: REWORK; MERGE_READY: BLOCKED
- manager_reason: 비표시 marker 원본 CI 실패는 보완했지만 별도 raw active pointer F816-006의 AC4 FAIL이 남아 전체 기능 승인/병합 불가
- release_required: true; release_authorized: false

## Source, analysis, design

- Official [SVAR `cellHeight`](https://docs.svar.dev/react/gantt/api/properties/cellheight/) is a public Gantt prop (default38px, official example32px); [Willow demo](https://docs.svar.dev/react/gantt/samples/#/base/willow) and [Appearance/Styling](https://docs.svar.dev/react/gantt/guides/appearance/styling/) are reference. Installed Core `@svar-ui/react-gantt@2.7.3`; no PRO/native DOM fork, new renderer or dependency bump.
- Historic #637 original Grid row38px / ordinary root31px, with 27.5px actual erroneous center offset, is **historical evidence**, not a fresh exact-main observation. Desired fine pointer row34px, expected derived ordinary Task root 25~29px, Summary pseudo visual about60% root. Current main 38px presumed until measured; same-fixture source comparison remains NOT TESTED.
- Grid row34px (38→34 = 10.5% reduction; theoretical visible rows +11.8% for fixed inner height). Coarse pointer uses **44px row** because existing `.project-copy-selection-hitarea` 44px target cannot safely fit in 34px rows. Ordinary label fills cell without min-height38; coarse `min-height:44px` remains. Runtime media change updates same `Gantt` official `cellHeight` prop, no remount.
- Existing #375 Summary CSS `::before{inset:20% 0}` and `.wx-progress-wrapper` preserve Summary visual ~60% of root and full root interaction geometry, even when bar root shortens. No CSS overrides for Task bar height; follow SVAR native geometry, preserving handles/link endpoints, tooltip, progress/focus and x/width rules.
- Chart date grid/Day-Week horizontal spacing/header, exterior viewport, gridWidth480, canonical Task/Milestone membership, dates, dependency, scheduling, API/DB/auth/revision/import-export unchanged. Strict Grid↔Chart Y center ≤1px and native-grid-Y scroll0 not replaced with compensating offsets. The 34px/44px geometry requires actual browser proof, not static inferred PASS.

## Implementation change set

1. `src/features/gantt/project-gantt.tsx`: fine/coarse matchMedia listener with unsubscribe; SVAR `<Gantt cellHeight={ganttCellHeight}>` and noninteractive diagnostic attr `data-gantt-cell-height`; same Gantt DOM identity.
2. `src/features/gantt/gantt-scale-toolbar.css`: project selection label `height:100%;min-height:0` on fine, coarse 44px retained. Existing Summary pseudo/style unchanged.
3. `tests/e2e/project-summary-bar-visual.spec.ts`: **EXTEND** prior #375 ratio, hit/right-click, progress, 390/768/1024/1440/1600/1920, week/fullscreen/readonly; 34px/Task 25~29px and row/bar centers ≤1; JSON receipt. **ADD** coarse-pointer mobile new context, 44px row/label/tap/check/no write.
4. `tests/e2e/projection-row-alignment.spec.ts`: **EXTEND** prior #637 5 widths×Day/Week, strict negative recovery and 80+ virtualization with 34px/25~29px; keep original DOM Y ±1px/scroll/baseline state constraints.
5. `docs/PROJECT_UX.md`, `docs/TEST_PLAN.md`, `CHANGELOG.md`, `docs/exec-plans/active/PLAN.md`, this Packet and package/lock root version updated. CI/policy/type test files and Core version unchanged.

## AC_TEST_COVERAGE

- AC1: 34px Grid row measured in #375/#637 suites, before-vs-after main38px/current-state fixed work area visible count. **Configured 34px; actual before/after NOT TESTED.**
- AC2: #375 normal bar 25..29px, Summary pseudo visual/root 0.55..0.70, centering ≤1px, progress/text hit/x/width status. Native historic31px baseline comparison **NOT TESTED**.
- AC3: #637 exact ID grid↔bar center ≤1px, 390/768/1024/1440/1920×Day/Week, independent Grid Y scroll0, 80+ virtual IDs, negative injection and restored receipt; #375 fullscreen/gantt identity; cross mode structure/filter existing tests. 로컬 projection/Summary/hover 합집합21과 인접 선택5 PASS(원장 참조); 새 Head 원격 전체 회귀는 **NOT TESTED**.
- AC4: 44px coarse row and label actual `tap`/checkbox checked/no write, original multi-select, drag/resize/tooltip/link/inline editor/focus/readonly suites KEEP_UNIQUE. Native coarse device and 125% OS zoom **NOT TESTED**.
- AC5: #375 Summary body/root/progress, #142 dates x/width, #345 empty summary, #552 native Milestone row OFF, task/domain/API/Export/canonical and viewport state unchanged; existing checks never deleted.
- AC6: existing Playwright coverage expanded across 390/768/1024/1440/1600/1920, two scales, readonly/edit, fullscreen, 80+ rows, JSON metrics & screenshot; exact compare before/after, remote Required Quality/E2E8/Docker/Trusted QA/Owner, actual touchscreen **NOT TESTED** until source evidence.
- AC7: Work Packet, PROJECT_UX, TEST_PLAN, CHANGELOG, active PLAN and package/lock 0.135.2; Design Delta C and N/A(reason) items below, source/status mapped to tests. 

## TEST_LIFECYCLE_REVIEW (#711)

- Search of existing assertion/title/file before changes: `project-summary-bar-visual.spec.ts` (#375 Summary shape/hit/readonly/Week/fullscreen), `projection-row-alignment.spec.ts` (#637 Grid-only scroll, 80+ virtual rows, required center, natural negative and settled recovery), `project-multi-task-copy-paste.spec.ts` (checkbox/selection, URL, keyboard/Shift), `project-chart-vertical-dnd.spec.ts`, `project-gantt-fullscreen.spec.ts`, `project-gantt-inline-name.spec.ts`, `project-gantt-scale.spec.ts`, `project-task-hover-tooltip.spec.ts`, `project-gantt-density.spec.ts`, `project-empty-summary.spec.ts`.
- EXTEND `project-summary-bar-visual.spec.ts` and `projection-row-alignment.spec.ts`; ADD **one coarse touch case** inside first spec; KEEP_UNIQUE other source/risk boundaries. PARTIAL_OVERLAP center checks (Summary pseudo/normal virtual rows are independent). CONSOLIDATE_CANDIDATE/RETIRE_CANDIDATE: none. Existing assertions/skip/timeout/retry/test names and shard groups unchanged. Original #637 historical failures not reclassified.
- 최초 구현 시점 Test execution: remote connector-based source editing/static pattern+manifest consistency only로 **LOCAL NOT TESTED**였다. REWORK #3에서 실제 Node TypeScript/Vitest/Playwright/Next/HTTP/SQLite 선별 검증을 실행했으며 최종 결과는 위 절/원장 참조. Docker·전체8-shard·정확 main before/after 및 실기기·native125%는 NOT TESTED. 새 Head PR Full run 결과는 별도 검증이다.
- Before/after baseline requirement: run same fixture on main `cd010d6...` and PR Head, record browser/OS/viewport/pointer/DPR/locale/row and bar/pseudo rects, visible rows, root instance, Y vs X scroll, keyboard + screenshot/hash. Historical 38px/31px serves reference only; actual new bar 25..29px must not be asserted passed until Chromium.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_816.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `src/features/gantt/project-gantt.tsx`: UPDATED
- `src/features/gantt/gantt-scale-toolbar.css`: UPDATED
- `tests/e2e/project-summary-bar-visual.spec.ts`: UPDATED
- `tests/e2e/projection-row-alignment.spec.ts`: UPDATED
- `AGENTS.md`: N/A(existing policy, delegation, owner-manage rules unchanged)
- `DESIGN.md`: N/A(Design Delta C: Gantt-local compact row adaptation; existing shared design rules unchanged)
- `docs/UI_UX_GUIDELINES.md`: N/A(existing accessibility/touch and compact principles; scenario measurements in PROJECT_UX)
- `docs/ARCHITECTURE.md`: N/A(SVAR public prop only, no new architecture/runtime writer)
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(same instance projection rules unchanged)
- `docs/GANTT_STATE_CONFORMANCE.md`: N/A(±1px and strict timeout unchanged)
- `docs/API.md`: N/A(no DTO/request/response/revision change)
- `docs/DB_SCHEMA.md`: N/A(no migration/table/index changes)
- `docs/SCHEDULING_ENGINE.md`: N/A(no calendar/date/dependency calculation change)
- `docs/CI_CD.md`: N/A(existing Required3, shard8, QA workflow)
- `docs/REMOTE_VALIDATION.md`: N/A(existing exact Head source/Run/Attempt verification)
- `docs/ISSUE_LIFECYCLE.md`: N/A(Owner-managed risk gate already defined)

## Gate, measurement risk and rollback

- 기존 Ready PR에 새 Head push → Full CI auto-start. 로컬 TypeScript/Vitest/Chromium/SQLite/Build 선별 검증은 위 REWORK #3의 PASS이고, 실제 main before/after 계측·full regression·실기기 수용은 NOT TESTED다. Existing #375/#637 test expansions require native Core 2.7.3 actual metric confirmation; if 34px row/27px task or CSS label geometry differ, correct on same PR without weakening 0.55..0.70 and ±1px constraints. 390px overflow, fullscreen/read-only/snapshot/virtual 80+ and touch 44px must pass.
- Code review: newly created PR initially has no review threads; any later must be resolved based on code and exact Head before merge. Verify latest main and mergeability. CI start is not CI success, Trusted/Owner QA or release authorization.
- Rollback: revert issue feature branch patch/0.135.2 candidate, label override, tests and docs. No schema migration or stored data rewrite. No release/tag/merged branch changes under this directive.
