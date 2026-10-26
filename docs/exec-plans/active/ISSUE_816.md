# Issue #816 — Gantt Grid 행·Task 막대 높이 축소 Work Packet

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
- lifecycle_phase: REWORK / FULL_PR_CI_RESTART_PENDING (original #3314.1 E2E FAIL; new Head required checks NOT TESTED)
- baseline/main: `cd010d6bcff26f10ad00c42cdf3528b851519938` (2026-10-26 KST, `0.135.1`)
- branch: `feat/issue-816-gantt-row-density`
- current_version: `0.135.1`; candidate_version: `0.135.2` PATCH (new version only; no tag/GHCR promotion)
- requested_scope: repository docs/SVAR official API and related issues → analysis/plan/implementation/tests/doc sync → open review/conflicts → **ready Full PR CI start**; CI monitoring, merge, Main, GHCR/Finalizer, Issue closure OUT OF SCOPE.
- risk_level: HIGH
- risk_reason: changing SVAR Grid/Chart native geometry impacts virtual scrolling, selection, focus, task editing, drag/resize/dependency and touch targets.
- qa_method: OWNER_MANAGED; qa_required: true
- independent_qa: NOT TESTED; manager_decision: NOT TESTED; MERGE_READY: BLOCKED
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
- AC3: #637 exact ID grid↔bar center ≤1px, 390/768/1024/1440/1920×Day/Week, independent Grid Y scroll0, 80+ virtual IDs, negative injection and restored receipt; #375 fullscreen/gantt identity; cross mode structure/filter existing tests. Execution **NOT TESTED**.
- AC4: 44px coarse row and label actual `tap`/checkbox checked/no write, original multi-select, drag/resize/tooltip/link/inline editor/focus/readonly suites KEEP_UNIQUE. Native coarse device and 125% OS zoom **NOT TESTED**.
- AC5: #375 Summary body/root/progress, #142 dates x/width, #345 empty summary, #552 native Milestone row OFF, task/domain/API/Export/canonical and viewport state unchanged; existing checks never deleted.
- AC6: existing Playwright coverage expanded across 390/768/1024/1440/1600/1920, two scales, readonly/edit, fullscreen, 80+ rows, JSON metrics & screenshot; exact compare before/after, remote Required Quality/E2E8/Docker/Trusted QA/Owner, actual touchscreen **NOT TESTED** until source evidence.
- AC7: Work Packet, PROJECT_UX, TEST_PLAN, CHANGELOG, active PLAN and package/lock 0.135.2; Design Delta C and N/A(reason) items below, source/status mapped to tests. 

## TEST_LIFECYCLE_REVIEW (#711)

- Search of existing assertion/title/file before changes: `project-summary-bar-visual.spec.ts` (#375 Summary shape/hit/readonly/Week/fullscreen), `projection-row-alignment.spec.ts` (#637 Grid-only scroll, 80+ virtual rows, required center, natural negative and settled recovery), `project-multi-task-copy-paste.spec.ts` (checkbox/selection, URL, keyboard/Shift), `project-chart-vertical-dnd.spec.ts`, `project-gantt-fullscreen.spec.ts`, `project-gantt-inline-name.spec.ts`, `project-gantt-scale.spec.ts`, `project-task-hover-tooltip.spec.ts`, `project-gantt-density.spec.ts`, `project-empty-summary.spec.ts`.
- EXTEND `project-summary-bar-visual.spec.ts` and `projection-row-alignment.spec.ts`; ADD **one coarse touch case** inside first spec; KEEP_UNIQUE other source/risk boundaries. PARTIAL_OVERLAP center checks (Summary pseudo/normal virtual rows are independent). CONSOLIDATE_CANDIDATE/RETIRE_CANDIDATE: none. Existing assertions/skip/timeout/retry/test names and shard groups unchanged. Original #637 historical failures not reclassified.
- Test execution: remote connector-based source editing/static pattern+manifest consistency only. Same-source local Node TypeScript/Vitest/Playwright/Next/HTTP/SQLite/Docker and screenshot not executed: **LOCAL NOT TESTED**. PR Full run exact Head is the next independent validation, NOT TESTED before its result.
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

- PR Ready create → Full CI auto-start. Current Head TypeScript/Vitest/Chromium/SQLite/actual UI screenshots not executed locally. Existing #375/#637 test expansions require native Core 2.7.3 actual metric confirmation; if 34px row/27px task or CSS label geometry differ, correct on same PR without weakening 0.55..0.70 and ±1px constraints. 390px overflow, fullscreen/read-only/snapshot/virtual 80+ and touch 44px must pass.
- Code review: newly created PR initially has no review threads; any later must be resolved based on code and exact Head before merge. Verify latest main and mergeability. CI start is not CI success, Trusted/Owner QA or release authorization.
- Rollback: revert issue feature branch patch/0.135.2 candidate, label override, tests and docs. No schema migration or stored data rewrite. No release/tag/merged branch changes under this directive.
