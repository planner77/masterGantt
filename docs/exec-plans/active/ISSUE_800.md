# Issue #800 — 6관점 Geometry 회귀 / Work Packet

## Issue Work Packet

- repository: `planner77/masterGantt`
- issue: [#800](https://github.com/planner77/masterGantt/issues/800)
- lifecycle_phase: MAIN_SYNC / NEW_FULL_PR_CI_START_PENDING
- requested_scope: source/issues/docs review → plan → minimal implementation/docs → unresolved review threads/conflict review → Ready PR Full CI start; **no CI monitoring/merge/Main/GHCR/Finalizer/Issue closure**
- baseline/main: `f431806329dd3af492e1eb6ce67bb73c1262d61e` (2026-10-25 KST, `0.133.2`)
- branch: `feat/issue-800-geometry-regression`
- current_main: `efc40c1864ffc3629f16d6956bf57c3b0889b96d` (#553/PR #562, v0.133.3; prior baseline 0.133.2 preserved)
- candidate_version: `0.133.3` (inherited from main; #800 test/docs-only, no additional version bump)
- change_boundary: `tests/e2e/helpers/ui-geometry.ts`, existing `tests/e2e/issue-730-view-composer.spec.ts`, opt-in `tests/manual/issue-800-compare-geometry.mjs`, #800 coverage docs and applicable guides. `src/`, contracts, DB, workflows, dependencies unchanged.
- design_delta: B (existing DESIGN.md Workspace-first/KPI reference verification only; `DESIGN.md` unchanged)
- risk_level: HIGH (shared E2E geometry observer; longer existing test)
- qa_required: true
- qa_method: OWNER_MANAGED
- independent_qa: N/A (Owner-managed)
- manager_decision: NOT TESTED; MERGE_READY: BLOCKED
- release_required: false; release_authorized: false

## Requirement/AC mapping (PLAN)

| AC | 구현·증거 | 완료 조건 |
| --- | --- | --- |
| AC1 전체 screen inventory | [#800 coverage](../../ISSUE_800_UI_GEOMETRY.md) 각 #797 화면군 → 기존 spec/assertion/issue/coverage mapping | 문서상 매핑 구현, 현재 Head 실행 결과 별개 |
| AC2 KPI baseline+5관점5폭 | 기존 #798 real seeded fixture 안 30 DOM 관측 + 12 viewport PNG / helper assertion / JSON provenance; 수동 #798/#799 before/after 비교 CLI | 새 exact Head remote 브라우저 E2E, 역사 영수증과 현재 비혼합 |
| AC3 상태/long/focus/keyboard | 기존 #717/#719/#730/#732~736/#457 고유 검사, #798 5폭 keyboard/Escape/focus·long name | 미실행 상태와 #517 N/A를 명시 |
| AC4 기능/계산/권한 보존 | 기존 #730 원본 canonical read-back, GET vs 조회 POST 구분·non-mutating, 프로젝트/Gantt/Task Editor/원본별 unique tests | 원격 full8/8+Quality/Docker 및 Trusted/Owner 별도 |
| AC5 Lifecycle/runner | 기존 test **EXTEND**, 0 신규 spec/test, manual comparator는 opt-in. 8-shard/Required3 보존 | CI Runner-minutes 수치는 실제 timing 전 N/T |
| AC6 역사 보존/문서 | #457 원본 불변, #797/#798/#799 source-anchored facts 별도 문서; guide/PROJECT_UX sync | 실제 새 비교 실행 없는 AC2 개선 수치 N/T |

## TEST_LIFECYCLE_REVIEW (#711)

Search files/test title/assertions: `cross-screen-regression.spec.ts` (shell, admin, not-found/demo), `issue-730-view-composer.spec.ts` (5 views, 5 widths, #798 keyboard/filters/readback), `issue-732/733/734/735/736-*.spec.ts` (Gate/공정/설비/System/Resource 원본), `issue-717-*` name-first+IDs, `issue-719-contextual-help.spec.ts`, `logistics-dashboard-request-state.spec.ts`, `project-workspace-ux.spec.ts`, `project-workspace-layout.spec.ts`, `project-resource-memberships-ui.spec.ts`, `resource-plan-dashboard.spec.ts`. Also #457 original coverage, #797 observer, #798/#799 manual collectors. Source assertions/coverage [문서](../../ISSUE_800_UI_GEOMETRY.md) `AC1`.

- **EXTEND** `issue-730-view-composer.spec.ts`'s original `#798 다섯 관점 고급 조건...` test; same isolated fixture/one test; add 25 focused geometry observations + KPI 5, aggregate receipt, 390/1440 PNG. Shared `ui-geometry.ts` helper only.
- **KEEP_UNIQUE** original #457 shell/borders/focus, #717/#719, five #732–736 feature & API, Gantt/Editor/management; functionality/security/concurrency boundaries cannot be replaced by DOM image.
- **PARTIAL_OVERLAP** #457/#797/#798/#799 capture methods with new comparison tool; not substituting those sources.
- **ADD** manual read-only comparator (opt-in script, excluded Playwright discovery).
- **CONSOLIDATE_CANDIDATE / RETIRE_CANDIDATE** none: no verified redundant risk/Owner retirement authorization. Deleted/skipped/relaxed checks=0.

### Cost/Shard & negative cases

Baseline: single existing #798 scenario 5 roots×5 widths, one seed & isolated Next/SQLite server; after: same test + KPI 5 viewport resizes; geometries 30 and viewport screenshot12. No new test file, test name, seed, CI workflow, E2E shard plan, retries/timeouts, Required checks or QA bypass. **Incremental Runner-minutes/CI effect NOT TESTED** until exact attempt. Comparator runs only on supplied evidence (does not connect network or mutate project).

Negative checks: missing row/summary, overlapping toolbar siblings, document horizontal overflow, table owner not scrollable, unexpected viewport, mismatch DOM version; comparator fails on incomplete 30, mismatch actual screenshot pixels, changed fixture hashes, mismatched app/locale/timezone/DPR/browser/collector, mutated fixture, missing provenance, value/spec/filter/totals mismatch, KPI regressions. Cross-source or unexecuted states are not auto-PASS.

## Historical evidence and limitations

- #797 auditor at `8d9dd93a...`/0.132.0 found 3 failed standard dashboard samples and calendar1440 dev HTTP500; sidecar was separate. Preserve original/partial evidence.
- #799 original before/after at specific source/runtime0.133.1: documented 30 pairs, KPI KEEP, 25 dynamic first-data Y improvement; baseline commit HEAD and actual working-tree source CSS fingerprints must not be conflated.
- #800 original Full [#3281.1](https://github.com/planner77/masterGantt/actions/runs/40168112076) **FAILED** at QA Preflight; exact Head `a669546b231b805f723aa0015797473039033cee`, Base `f431806329dd3af492e1eb6ce67bb73c1262d61e`. 원본 원인·파생 Job·미실행 구별은 [단일 누적 실패 원장](../../ISSUE_800_FAILURE_ANALYSIS.md)을 따른다. 보완 HEAD의 local Chromium/manual compare/typecheck/lint 및 새 Full CI는 **NOT TESTED**이며 새 Run/Attempt 완료 전 PASS 불가.
- Rollback: revert #800 helper additions, #730 instrumentation, standalone read-only comparator, #800 docs; previous suite/behavior unchanged.

## AC_TEST_COVERAGE

- AC1: [#797 전체 화면 mapping](../../ISSUE_800_UI_GEOMETRY.md)의 #457/#717/#719/#730~736/Gantt·Admin의 existing/extend/gap/N/A별 원본 spec·assertion·과거 Issue; 이번 HEAD exact-Run 실행은 N/T.
- AC2: [#730 기존 #798 단일 E2E](../../../tests/e2e/issue-730-view-composer.spec.ts)의 5관점5폭 + KPI5폭 = 30관측, visible rows/summary/table/focus/owner overflow guard 및 source+fixture+DOM hash. Before/after 증거는 [read-only 비교기](../../../tests/manual/issue-800-compare-geometry.mjs); 새 source 비교는 N/T.
- AC3: 긴 KO/EN/동일 이름·0/null/부분합은 #717/#799/#732~736, loading/error/stale/readonly/disabled는 #730/#797, keyboard/Tab/Escape/tooltip은 #798/#719/#457 원본을 KEEP_UNIQUE; 모든 상태×폭 및 native125%는 N/T 또는 #517 N/A.
- AC4: #730 canonical project read-back·조회 POST/업무 mutation 구분·Task/Assignment/원본 값·Gantt/Core selection/filter/scroll와 Task Editor/관리 기능 고유 E2E. 해당 HEAD 전체 Run 전 서버/권한 PASS 아님.
- AC5: #711 TEST_LIFECYCLE_REVIEW에 따라 기존 1개 spec/test EXTEND, 새 상시 suite 0, 독립 수동 comparator ADD, Chromium 8-shard/Required3 유지, 실제 비용 증가는 CI timing 전 N/T.
- AC6: #457 역사 불변, [#797 감사](../../UI_AUDIT_2026_10_24.md)/[#799 원본 실측](../../ISSUE_799_DASHBOARD_METRICS.md)과 현재 source 분리; UI/UX Guide·Project UX·TEST_PLAN 기록. 원본 #3281.1 실패와 새 CI 별개.

## DOCUMENTATION_SYNC

- `docs/TEST_PLAN.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/ISSUE_800_UI_GEOMETRY.md`: UPDATED
- `docs/ISSUE_800_FAILURE_ANALYSIS.md`: UPDATED
- `docs/exec-plans/active/ISSUE_800.md`: UPDATED
- `DESIGN.md`: N/A(기존_디자인_원칙만_검증하고_제품_시각_설계_변경_없음)
- `docs/API.md`: N/A(API나_원본_조회_계약_변경_없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite나_스키마_변경_없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정_로직과_계산_변경_없음)

## REWORK / 리뷰·정책 증거

- 원본 PR #805 Full #3281.1: QA Preflight가 본문 3개 필수 선언(독립 한 줄이 아님)과 Work Packet의 `DOCUMENTATION_SYNC` 부재를 FAIL. 그 결과 QA route/PR Fast Gate/Required3 파생 FAIL, 구현 TypeScript·E2E8·Docker 전부 SKIPPED/NOT RUN. 자세한 direct/derived 분류는 [원장](../../ISSUE_800_FAILURE_ANALYSIS.md) F800-R001.
- PR 본문에 정확 독립 `risk_level: HIGH` / `qa_method: OWNER_MANAGED` / `qa_required: true` / `release_required: false` / `release_authorized: false` 각 하나만 선언하고 Work Packet 구조를 base `qa_preflight.py`/`qa_final_automated.docs_gate`와 일치시킴. Required/CI policy 수정하지 않음.
- 미해결 Codex [P1 KPI heading](https://github.com/planner77/masterGantt/pull/805#discussion_r4369868207)·[P2 empty receipt](https://github.com/planner77/masterGantt/pull/805#discussion_r4369868209)를 반영. 기존 KPI 카드보다 아래의 Milestone 제목을 header로 오인하지 않도록 KPI root anchor를 사용하고, 동적 비교는 양쪽 유효한 query receipt 최소1/명세/spec.root/filters/totals/range를 요구. 같은 source Chromium 및 comparator negative 실행은 N/T; 실제 remote Full Run이 필요.
- 이번 재작업은 현행 8-shard/Required3/Trusted/Owner 경계와 기존 테스트 의미를 보존. 미해결 리뷰 응답/resolve, main/base 충돌 재점검 뒤 Ready PR synchronize가 새로운 Full CI를 시작하도록 함. 이전 FAIL을 재실행 PASS로 대체하지 않음.


### #3288 원격 QA Final 차단과 최신 main 정렬 (2026-10-25)

- [Full #3288.1](https://github.com/planner77/masterGantt/actions/runs/40169055755), HEAD `9daa8d722dd1daeff0eb78f712f2b887e4efa9bb`: Quality/Policy/TypeScript/ESLint/Vitest/Next build/E2E shard8/8/Docker Required3 모두 SUCCESS. 그러나 QA Final Job121105760594는 `mergeability 또는 test merge 불일치`로 BLOCKED. 이 결론을 E2E 실패로 기록하거나 사용자 Owner ACCEPT로 간주하지 않는다.
- CI 진행 중 #553/PR #562 병합 후 main이 `efc40c1864ffc3629f16d6956bf57c3b0889b96d` (v0.133.3)으로 변경되었다. 기존 이벤트 Base `f431806`/Test Merge `f6b0dc3`는 최신 main 근거가 아니다. 최신 Main과 원래 HEAD를 부모로 갖는 merge commit으로 정렬하고 `docs/PROJECT_UX.md`의 공통 prepend(#553+#800)를 모두 보존한다. 상세 원본·직접/파생 실패 및 조치는 [누적 실패 원장](../../ISSUE_800_FAILURE_ANALYSIS.md) F800-R004.
- #800의 테스트/제품 코드·과거 수집 수치는 수정 없이 유지; Main의 Milestone·Export, 테스트/shard plan, package/lock v0.133.3을 동기화한다. Review threads 및 최종 mergeability를 재확인하고 **새 정확 HEAD Full PR CI 시작**만 관찰한다. 독립 QA/Owner, 새 E2E·Trusted 결과는 미실행 시 NOT TESTED. 병합/Main/GHCR/Finalizer/Issue 종료 권한 없음.

## Gate

PRE-QA: static source diff and expected test fixtures/contracts reviewed by implementation author; not an independent QA sign-off. Full PR CI Required Quality/E2E8/Docker, default-main Trusted QA/Owner decision, review threads0, strict latest main and test-merge validation remain mandatory prior to merge. No release or GHCR dispatch authorized.
