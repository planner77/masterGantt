# Issue #674 — #659 Main CI #2712 Milestone 대형 Fixture 진단 식별자 초기화 경합

## Baseline / Source of truth
- Issue: https://github.com/planner77/masterGantt/issues/674
- Failure origin: [#659 PR #660](https://github.com/planner77/masterGantt/pull/660) merged SHA `3b21fe6e17ccc8abcdc9dc634c0a73b82dfa78bb`, [Main CI #2712.1](https://github.com/planner77/masterGantt/actions/runs/38470067933) completed/**failure**. Immutable failure artifact is preserved, not retroactively marked SUCCESS.
- Failing Chromium shard 4: `tests/e2e/milestone-timeline-lane.spec.ts:173` #551 1,000 Task + 2,000 Milestone fixture. Exact predicate `frame.dataset.projectGanttApiInstance === frame.__masterganttMilestoneTimeline.instance` plus callable `read` did not become true within 5,000ms. Other 5 shards and TypeScript/ESLint/Vitest/Build/Docker PASS.
- Initial branch `fix/issue-674-main-e2e-api-identity` from main `e195780227a504536d0d9f7f27924f24267f8caf` (version `0.108.0`). New run/head/base are NOT TESTED before GitHub execution.
- [Later Main CI #2718.1](https://github.com/planner77/masterGantt/actions/runs/38473289913) completed/SUCCESS but the E2E implementation shard was **SKIPPED** by path routing; it does not constitute this #551 3,000-row regression passing.

## Cause / Scope
- `ProjectGantt.initialize(api)` publishes `__masterganttMilestoneTimeline` immediately via `installMilestoneProbe`, and then calls `setApiInstanceId(initializedId)`. React's `data-project-gantt-api-instance={apiInstanceId ?? undefined}` is populated on a later state commit; the expensive projection of the 3,000-row fixture can delay that commit. This confirmed **source-order gap** is corrected. Exact CPU scheduling/root cause of the prior 5-second timeout remains a hypothesis without the original trace's full timeline.
- A pure `stampInitializedGanttApiIdentity` publishes **only** the precise init callback ID to the connected frame before the development-only probe. It is invoked only after checking `NODE_ENV !== production` and `frame.isConnected`; React subsequently reconciles to the same value.
- No polling/sleep/timeout increase, retry/skip/Fixture reduction, semantically earlier fake `read()`, production probe, duplicate Gantt API, explicit Core private store mutation or change to canonical Task/Milestone data. Existing 5s predicate, 1,000+2,000 fixture, layout/scroll/fullscreen/resize/zero-mutation assertions remain byte-identical.

## DOCUMENTATION_SYNC
- `src/features/gantt/project-gantt.tsx`: UPDATED
- `src/features/gantt/gantt-api-identity.ts`: UPDATED
- `tests/gantt-api-identity.test.ts`: UPDATED
- `tests/e2e/milestone-timeline-lane.spec.ts`: N/A(기존 5초 실제 브라우저 기준과 대형 Fixture 유지)
- `docs/MILESTONE_TIMELINE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_674.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `AGENTS.md`: N/A(기존 코딩 에이전트 업무 절차와 승인 규칙 변경 없음)
- `DESIGN.md`: N/A(공통 화면 디자인과 UX 기능 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(레이아웃과 상호작용 변경 없음)
- `docs/PROJECT_UX.md`: N/A(프로젝트 작업공간 화면 계약 변경 없음)
- `docs/ARCHITECTURE.md`: N/A(제품 아키텍처 및 Core adapter 공개 계약 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A(고위험 QA 및 Owner 승인 정책 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(GitHub CI 권한 및 수명주기 절차 불변)
- `docs/API.md`: N/A(HTTP 공개 API 라우트와 데이터 계약 불변)
- `docs/DB_SCHEMA.md`: N/A(SQLite 테이블과 마이그레이션 불변)
- `docs/SECURITY.md`: N/A(인증 세션과 보안 정책 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(Milestone 일정 연산과 날짜 계산 불변)
- `package.json`: N/A(현재 정식 제품 SemVer 0.108.0 불변)
- `package-lock.json`: N/A(제품 종속성 및 lockfile 불변)

## AC_TEST_COVERAGE
- AC1: `tests/gantt-api-identity.test.ts` publishes an exact initialized ID to a connected frame without a React update and follows the same `initialize(api)` callpath as the milestone probe; original E2E oracle retains exact identity requirement. Full running integration NOT TESTED before CI.
- AC2: the existing `tests/e2e/milestone-timeline-lane.spec.ts` 3,000-item #551 case, unchanged native 5-second readiness, Chart/Grid peer scroll/resize/fullscreen and geometry; new PR and Main E2E shard outputs required. NOT TESTED before remote CI.
- AC3: Vitest unit assertions: exact ID, second init replaces stale value and disconnected frame unchanged. GitHub CI TypeScript/ESLint/Vitest required; NOT TESTED before remote CI.
- AC4: updated docs and no-code-change rationale as mapped in DOCUMENTATION_SYNC; product version and release owner policies unchanged.
- AC5: fresh PR exact HEAD with Quality/E2E six shards/Docker/QA Final, unresolved review threads zero, mergeable clean; user explicitly requested merge/Main CI after verified PR. Official new Main push SHA needs its own full E2E evidence. New exact Main CI to be started only after merge.
- AC6: inspect existing `.github/workflows/ci.yml` PR fail-fast true/`--max-failures=1`, Main fail-fast false, `if:always()` aggregates, Trusted QA/GHCR/Finalizer guards. Workflow and policy source files not edited.

## Risk / QA / Release
risk_level: HIGH
qa_method: OWNER_MANAGED
qa_required: true
manager_decision: NOT TESTED
release_required: false
release_authorized: false

- Owner requested: correct Main CI failure and start a fresh Main CI. Safe chain is corrective PR exact-head CI, review threads and source main alignment, merge with canonical one-line subject and new Main CI push. A rerun of #2712 on the *old immutable SHA* is diagnostic recovery, not validation of the new patch. If CI is still running, do not bypass its result or claim merge readiness.
