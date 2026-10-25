# Issue #800 — 6관점 Geometry 회귀 / Work Packet

## Issue Work Packet

- repository: `planner77/masterGantt`
- issue: [#800](https://github.com/planner77/masterGantt/issues/800)
- lifecycle_phase: IMPLEMENTED_LOCAL_SOURCE / PR_CI_START_PENDING
- requested_scope: source/issues/docs review → plan → minimal implementation/docs → unresolved review threads/conflict review → Ready PR Full CI start; **no CI monitoring/merge/Main/GHCR/Finalizer/Issue closure**
- baseline/main: `f431806329dd3af492e1eb6ce67bb73c1262d61e` (2026-10-25 KST, `0.133.2`)
- branch: `feat/issue-800-geometry-regression`
- candidate_version: `0.133.2` (test/docs only; no application/lock version bump)
- change_boundary: `tests/e2e/helpers/ui-geometry.ts`, existing `tests/e2e/issue-730-view-composer.spec.ts`, opt-in `tests/manual/issue-800-compare-geometry.mjs`, #800 coverage docs and applicable guides. `src/`, contracts, DB, workflows, dependencies unchanged.
- design_delta: B (existing DESIGN.md Workspace-first/KPI reference verification only; `DESIGN.md` unchanged)
- risk_level: HIGH (shared E2E geometry observer; longer existing test)
- qa_required: true; qa_method: OWNER_MANAGED; independent_qa: N/A (Owner-managed)
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
- #800: test code and compare command authored, **actual local Chromium E2E/manual compare/typecheck/lint NOT TESTED in this connector-only run**. New Head Full CI not yet executed at authoring time; final status requires actual PR run ID, checks and Owner decision.
- Rollback: revert #800 helper additions, #730 instrumentation, standalone read-only comparator, #800 docs; previous suite/behavior unchanged.

## Gate

PRE-QA: static source diff and expected test fixtures/contracts reviewed by implementation author; not an independent QA sign-off. Full PR CI Required Quality/E2E8/Docker, default-main Trusted QA/Owner decision, review threads0, strict latest main and test-merge validation remain mandatory prior to merge. No release or GHCR dispatch authorized.
