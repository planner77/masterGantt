# Issue #616 — Logistics Target/member F2 Work Packet

## Baseline / objective
- Parent #613, contract F0 #614 (PR #625), dependency F1 #615 (PR #627/#628 merged).
- Source baseline main `6eaec3331fcbc720ab42106789a505c5ee5eefb4`, app `0.106.0`, migration `0025`.
- Branch `feat/issue-616-logistics-targets`, candidate app `0.107.0`, migration `0026_logistics_targets.sql`.
- Scope: Target/member typed persistence and API, reuse existing Project Equipment/System, inline Project-local creation, Project Copy member ID remap; F3 WBS bindings and KPI are not added.
- Risk HIGH; qa_method OWNER_MANAGED; qa_required true; manager_decision NOT TESTED; release_required true; release_authorized false. No merge/main/GHCR/cleanup/Issue closure requested.

## DOCUMENTATION_SYNC
- `DESIGN.md`: N/A(No product UI layout or shared design language changed; test readiness ordering only)
- `docs/TEST_PLAN.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/IMPORT_EXPORT.md`: N/A(Existing schedule-only JSON Target unsupported guard and full import/export contract unchanged)
- `docs/IMPORT_SCHEMA.md`: N/A(Version 1.1 import schema and full backup boundary unchanged; Template graph has separate contract)
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: UPDATED
- `docs/exec-plans/active/ISSUE_616.md`: UPDATED
- `docs/PROJECT_UX.md`: N/A(Project creation behavior remains unchanged; existing hydrated form test now synchronizes before input)
- `AGENTS.md`: N/A(Existing Issue lifecycle and QA preflight policy inherited from main, unchanged by this PR)
- `docs/QA_REVIEW_POLICY.md`: N/A(Existing OWNER_MANAGED and required checks unchanged)

| Artifact | Status | Reason |
|---|---|---|
| AGENTS.md / DESIGN.md / UI_UX_GUIDELINES | N/A | Existing lifecycle and design requirements followed; no interactive UI or new adopted global UI principle |
| docs/LOGISTICS_TARGETS.md | UPDATED | F2 actual vs future F3 contract and copy/Template boundaries |
| docs/API.md / docs/DB_SCHEMA.md | UPDATED | Endpoints, SQL schema and FK/triggers |
| docs/REQUIREMENTS.md / docs/ARCHITECTURE.md / docs/SECURITY.md | UPDATED | Domain, module responsibilities, session/Origin/CAS |
| docs/TEST_PLAN.md / docs/CI_CD.md / docs/REMOTE_VALIDATION.md | UPDATED | Mandatory test gates and known untested environments |
| docs/exec-plans/active/PLAN.md / TARGET_RESOURCE_ROLLOUT.md | UPDATED | F2 execution status and explicit incomplete capability |
| CHANGELOG.md / package.json / package-lock.json | UPDATED | Candidate application 0.107.0 and changes |
| Resource KPI/Excel/Task editor/docs | N/A | Target WBS bindings, roll-up and UI are separate #617 onward |
| Template/JSON code contracts | UPDATED | Fail-closed on unsupported graph to prevent silent loss; full format not yet implemented |

## AC_TEST_COVERAGE
- AC1: Project Target identity, process/WorkArea and shared MCS AMR10 plus AMR5 fixture in tests/server/templates/logistics-template-graph.test.ts, candidate Quality PASS on prior Head, new Head NOT TESTED.
- AC2: Typed member FK, empty/cross-project/wrong process rejection in logistics-targets.test.ts plus migration 0026, new Head NOT TESTED.
- AC3: Target association never edits original equipment/System controls, resource roles or quantities; original copy/template integration and Unit, new Head NOT TESTED.
- AC4: Project revision/stale session and Origin/cross-project/atomic rollback verified by Target services and seeded fixtures; full HTTP concurrency negative tests still NOT TESTED.
- AC5: Shared member usage and in-use deletion safety, hard-delete 409 and controls identity, with integration test, new Head NOT TESTED.
- AC6: Migration 0026, Project Copy and Template v2 remap, global occurrence validation, legacy Template backward compatibility and single MCS across Targets, new Head NOT TESTED.
- AC7: Bounded list/usage API and typed docs, API/DB/security/TEST_PLAN/CHANGELOG sync and E2E project link stable input regression, new Head NOT TESTED.

| ID | Code / fixture | Evidence and gaps |
|---|---|---|
| AC1 Target identity, process/WorkArea and project_common | DDL 0026, LogisticsTargetService location; process negative integration **NOT TESTED** |
| AC2 typed member Equipment(unit/fleet)/System and reused shared MCS | member FK + constraints, logistics-targets.test.ts reusable System case; complete Quantity/fleet fixture **NOT TESTED** |
| AC3 existing/inline create and no silent controls mutation | service inline/acquire, duplicate-label confirmation; HTTP/rollback integration **NOT TESTED** |
| AC4 usage, inactive and deletion/rename | service usage and read warnings, FK; cross-target and stale cases authored; WBS references **N/A until #617** |
| AC5 Project Copy and Template compatibility | copyLogisticsTargets, Template conflict guard, schedule-stage JSON conflict guard; full versioned Template preservation **NOT IMPLEMENTED** |
| AC6 owner/project auth + Origin + strong revision | handlers, service IMMEDIATE transaction; comprehensive negative HTTP **NOT TESTED** |
| AC7 Docs and migration/restart | synchronized docs and version, 0026 ledger file; fresh/upgrade/restart/CI **NOT TESTED** |

## Risks / TODO before merge
- This is an implementation candidate for remote CI, not a claim of all AC PASS.
- Dedicated versioned Template/JSON full referential export remains outside this PR; current path fails visibly rather than silently losing graph. If #616 requires complete Template roundtrip, follow-up changes are required before acceptance.
- No GitHub Actions/Trusted QA/Manager approval evidence exists until exact-head workflow. Inaccessible repo runtime on tool host prevents local npm typecheck, Vitest, E2E, Docker; do not assert PASS.
- Verify DB triggers on migration and Project Copy, stale body session after await, composite FK and SQLite foreign_key_check, copy rollback/retry on real CI.
- Track reviewers and act on CI failures on separate user instruction, not automatic merge.

## AC6 Template v2 미구현 보완 — 2026-10-12

- code: `src/server/templates/logistics-template-graph-core.ts`, `src/contracts/project-templates.ts`, Template create/instantiate/handler; Process mappings+Targets/members typed versioned graph 저장, new local IDs 복원, global occurrence/WorkArea triple revalidate. Shared MCS single System instance.
- tests: `tests/server/templates/logistics-template-graph.test.ts` real SQLite fixture (TargetA AMR10+ACS A+MCS1 / TargetB AMR5+ACS B+MCS1 / common Target; schema2 snapshot, 15대, 동일 MCS, original distinct, invalid/duplicate/cross-area rollback, legacy compat). DB migration/route inventory test expectations corrected.
- DB: migration26 deferred anchor-member composite FK for nonempty Target at COMMIT and member reparent movement; 4 review points (inactive full-path, duplicate PATCH code409, hard-delete in-use409, process change member replacement).
- Docs: API/DB_SCHEMA/REQUIREMENTS/ARCHITECTURE/SECURITY/LOGISTICS_TARGETS/TEST_PLAN/CI_CD/REMOTE_VALIDATION/root CHANGELOG/active PLAN/rollout synced. DESIGN and UX N/A (no UI), Resource KPI and Task binding N/A (#617+).
- Previous Run #2534.1 FAIL is preserved, new exact-head Quality/E2E/Docker and QA are NOT TESTED until Actions. release_required=true/release_authorized=false; no merge/GHCR authorized.

## PR #631 · #2545.1 Shard6 trace 원인·정정 — 2026-10-12

- [Full PR CI #2545.1](https://github.com/planner77/masterGantt/actions/runs/38192860417), Head `08fe3dd9d62b2fa02dc48308a4b4c731507ebcc7`: Quality/Vitest/Build/TypeScript/Lint PASS, Docker aggregate PASS, Chromium shard1~5 PASS, **shard6 88 PASS/1 FAIL/1 Skip**. `tests/e2e/project-links-persistence.spec.ts:36`에서 두 번째 Project `submitProjectAndExpectCreated`가 POST 응답을 30s 대기한 뒤 타임아웃. 자동 QA는 test-merge/mergeability BLOCKED. 별개의 두 미완료 gate로 추적.
- [Playwright shard6 trace](https://github.com/planner77/masterGantt/actions/runs/38192860417/artifacts/11722526125)의 액션·DOM 비교: 첫 Project `POST /api/projects` 201 정상. 두 번째 `page.goto('/projects/new')` 직후 이름 `fill()` 호출은 성공했지만 **fill after snapshot에서 이름이 이미 빈 값**; 추후 비밀번호/소유자 입력, 제출 클릭 시 `aria-invalid=true`, "프로젝트 이름을 입력해 주세요". 두 번째 POST request 기록 없음. HTTP 서버 응답 시간초과·요청 실패가 아니라 클라이언트 controlled input 초기화/SSR→hydration 전환 경합. 서버 종료/OOM 등은 근거 없음.
- 원인 차단: `createProject` 호출에서 기존 `waitForProjectMasterCatalogReady`를 **`fill(name)` 전**에 수행. 선택 셀렉트는 SSR 초기 `loading`에는 없고 useEffect fetch가 `ready`가 된 뒤에 렌더링되므로, 화면 표시뿐 아니라 클라이언트 입력 핸들러 준비를 확인한다. `expect(projectName).toHaveValue(name)`을 제출 직전에 추가한다. 기존 성공 결과·권한/clipboard/새 탭/새 세션 assertions 유지, timeout·retry·skip·request replay 완화 없음.
- DESIGN.md / UI_UX_GUIDELINES / docs/PROJECT_UX.md / API / DB_SCHEMA / SECURITY / AGENTS.md **N/A**: 제품 폼 UI·서버·보안 계약은 변경하지 않음. `tests/e2e/project-links-persistence.spec.ts`, docs/TEST_PLAN.md, docs/REMOTE_VALIDATION.md, active PLAN, root CHANGELOG / 본 Work Packet은 UPDATED. F2 Template v2·Target migration·ID 회귀 테스트 보존.
- 새 main의 변경은 `#629` trusted QA preflight/QA policy, `#550` 관련 E2E 증거와 병행 중이며 정렬시 main blob과 양쪽 문서 추가를 전부 보존한다. 새 exact-head PR CI 실행 전 Quality/E2E/Docker/QA/Trusted는 **NOT TESTED**; release_authorized=false, Owner merge/main/GHCR/Issue close 미승인.

