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
- `tests/e2e/milestone-timeline-lane.spec.ts`: UPDATED
- `docs/ADR_674_GANTT_DIAGNOSTIC_INIT_EXCEPTION.md`: UPDATED
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

## GSC 1.0.0-candidate 준수·예외·U5 작성권 인계

- 현재 적용 표준 **GSC 1.0.0-candidate / REVIEW_PENDING**, 읽은 문서 commit `e195780227a504536d0d9f7f27924f24267f8caf`: `AGENTS.md`, `docs/GANTT_STATE_CONSISTENCY.md`, `docs/GANTT_STATE_CONFORMANCE.md`, `docs/GANTT_ADAPTER_ADR.md`, `docs/GANTT_SYNC_TRACE.md`, `docs/exec-plans/active/GANTT_STATE_REMEDIATION.md`, #551 Work Packet. GSC-01~12 중 관련 01/02/03/04/05/06/07/08/09/10/11/12 모두 영향 검토; **정규화 대상은 data/viewport가 아닌 dev-only native API identity 표시**.
- **파일 소유권 예외:** U5 #667 / 기존 #552 PR #561이 본래 `project-gantt.tsx` 단독 작성자. 본 #674는 #659 병합 Main #2712의 조기 복구를 위해 production observer나 data writer를 변경하지 않는 `installMilestoneProbe` 내부 dev-only 1개 호출로 한정. [ADR-674](../../ADR_674_GANTT_DIAGNOSTIC_INIT_EXCEPTION.md)에 목적/배제한 대안/규범·버전/Manager 한정 승인/리스크/수명/롤백/인계를 기록했다. 승인 범위는 dev diagnostic-only이며 원래 U5 제품 wiring·Owner QA·릴리스 승계를 허가하지 않는다.
- **상태·쓰기 소유권 매핑:** native `initialize(api)`가 실제 `svar-api-*` ID를 생성하고 기존 `apiReference`에 보존한다. Dev-only connected frame의 `data-project-gantt-api-instance`는 이 ID를 표시하는 관측 속성; 서버 canonical/revision, native Core data/tree/links, React projection 목표, viewport scroll/axis, focus/Task/Milestone mutation writer는 변경 없음. 이 속성의 일치가 **native data/geometry settle PASS를 의미하지 않는다**(GSC-08/09).
- **누적 SC 지도:** SC-07(API identity 갱신) unit exact/stale 검증, SC-12(Day/Week/resize/fullscreen geometry) 및 SC-14(1,000+2,000/mount/5초) 기존 #551 E2E 직접 검증. SC-08(milestone-only/empty) 및 SC-11(peer return) 기존 E2E 포함. SC-01~06/09/10/13은 변경 대상 아니라도 전체 PR/Main E2E 정상 실행 시 보호 회귀를 확인하며 개별 새 증거 없으면 NOT TESTED. U1 machine-readable SC harness 및 U5 통합 전체 SC-01~14는 별도 #663~#667/#573/#574 담당, 이 PR로 완료했다고 주장하지 않는다.
- **중복 source/병렬 충돌 방지:** #667 issue OPEN(계획 단계), #552 PR #561은 기존 기능 브랜치 OPEN. #674의 patch와 ADR을 #667 담당자에게 전달하고 U5 제품 연결 시 정확한 main SHA 기준으로 재정렬·3-way reconcile, 같은 source의 동시 쓰기를 금지한다. 이후 U5가 dev 직접 stamp를 대체할 수 있으며 실제로 대체했을 경우 단위·E2E 보존 확인 후 ADR 종료.
- **검증:** 새 Head exact PR required Quality/E2E 6/6/Docker, QA Final/Trusted, review unresolved0 및 새 Main E2E shard4의 동일 5s oracle 결과는 실제 CI 전에 **NOT TESTED**. 원본 #2712 PASS로 소급 변경, U5 전체 SC 채택, 테스트 timeout 증가/skip/retry, 릴리스 게시 승인 모두 불가.

## CI #2720.1 actual trace — first locator evaluation starved by 3,000-row render

- [PR CI #2720.1](https://github.com/planner77/masterGantt/actions/runs/38479618648) Head `9113da5b623fcbb580a31f77f09f9151a6507f22`: Preflight/Policy/TypeScript/Lint/Vitest/Build/Docker/Quality aggregate PASS; **same Chromium Shard4 #551 5-second timeout** after 35 PASS, 1 FAIL; PR test-level `--max-failures=1` prevented running remaining shard tests and other shards were cancelled. **Initial DOM synchronous API ID stamp alone is insufficient**; this historical CI cannot prove the bug fixed.
- [Shard4 saved Playwright Trace artifact](https://github.com/planner77/masterGantt/actions/runs/38479618648/artifacts/11857063158): `expect.poll` started at Playwright monotonic ~319004ms. **First** `frame.evaluate` began ~319005ms; no successful evaluation returned before 5-second expiration ~324004ms. Locator diagnostic at ~323889ms **already shows** `data-project-gantt-api-instance="svar-api-1"` on a connected visible `project-gantt-frame`, 3000 matched Tasks loaded. Thus the original expectation timed out without establishing probe mismatch; a browser main-thread/locator-evaluation scheduling delay dominates. This does not assert the test's other Core/geometry checks passed.
- **Two-stage bounded readiness:** before the unchanged exact 5-second `probe.instance===frame.dataset.projectGanttApiInstance && typeof read==="function"` predicate, first require the real `frame` **visible** with Playwright's standard bounded `expect(frame).toBeVisible()` (default expect timeout, no sleeps/retries/skip). Navigation→actual Gantt frame mount and already-mounted frame→correct API probe are distinct lifecycle stages. The 5-second identity predicate, 1000+2000 fixture and all native geometry/scroll/mutation assertions remain unchanged. This is a test harness stage-order improvement, not a claim that initial navigation resolves within the probe's original 5 seconds.
- **SC/GSC & ownership:** GSC-08 observation readiness vs mount, GSC-09 identity, GSC-11 non-weakening, SC-14 large mount/identity split. [ADR-674](../../ADR_674_GANTT_DIAGNOSTIC_INIT_EXCEPTION.md) and #667 handoff updated to include existing `milestone-timeline-lane.spec.ts` test readiness sequencing, no product Coordinator/writer change. Source `project-gantt.tsx` helper remains exact, and unit `tests/gantt-api-identity.test.ts` now checks order plus preservation of original 5-second predicate. **New exact-head remote full CI is NOT TESTED before execution.**
