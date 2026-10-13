# Issue #672 — Target F2 AC2~AC7 acceptance/QA follow-up (no new release)

## Baseline / source of truth
- Parent #616 issue https://github.com/planner77/masterGantt/issues/616; fixture/CI evidence https://github.com/planner77/masterGantt/issues/616#issuecomment-6155300627, successor release evidence https://github.com/planner77/masterGantt/issues/616#issuecomment-6155210971.
- #670 v0.108.0 Main #2710.1 and Release #167.1 / Finalizer Resume #32.2 are immutable historical SUCCESS; v0.107.0 revoked/never published, #2621 failures remain FAIL.
- Implementation branch `test/issue-672-target-f2-acceptance`; branch initially from main `3b21fe6e17ccc8abcdc9dc634c0a73b82dfa78bb`. Exact PR Head/base must be read live; do not re-use source CI after changes.
- Application `package.json`/lock remains **0.108.0**, no new annotated Git tag or formal GHCR release. #616 stays OPEN; no Owner F2 ACCEPT is granted by this PR.

## Scope & boundaries
- `tests/server/logistics/logistics-targets-acceptance.test.ts` covers real service/handler/SQLite rather than only test-only #614 F0 oracle; keep #616 original `tests/server/logistics/logistics-targets.test.ts` 4 and `tests/server/templates/logistics-template-graph.test.ts` 3 tests.
- No product route/DTO/DB schema changes unless tests expose a defect. Shared Equipment/System records, controller/coordinator edges, Resource role rows and legacy direct Task links must not be recreated by Target membership changes.
- `LogisticsTargetService.usage().referencedByTaskCount=0` is **an interim unsupported field before #617**, not a measured count: document and do not use to authorize deletion/KPI/whole-subset impact; #617 owns Task–Target bindings.
- `#379` still owns full JSON export/import; versioned Template graph v2 already exists and must not be portrayed as unsupported. Public API and DB are unchanged; docs sync corrects stale descriptions.

## DOCUMENTATION_SYNC
- `AGENTS.md`: N/A(기존 이슈 라이프사이클·검증 및 Owner 승인 원칙 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH OWNER_MANAGED 기준 변경 없음)
- `docs/CI_CD.md`: N/A(필수 CI/릴리스 경계 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(일반 GH 운영/릴리스 정책 변경 없음)
- `docs/GENERIC_RELEASE_FINALIZER.md`: N/A(버전/Finalizer 코드 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(정책 및 workflow 변경 없음)
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_672.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `tests/server/logistics/logistics-targets-acceptance.test.ts`: UPDATED
- `DESIGN.md`: N/A(UI/SVAR/Core/공통 디자인 원칙 불변)
- `docs/UI_UX_GUIDELINES.md`: N/A(UI 변경 없음)
- `docs/PROJECT_UX.md`: N/A(컴포저/Workspace 변경 없음, #618 전용)
- `docs/ARCHITECTURE.md`: N/A(아키텍처 경계 변경 없음)
- `package.json`: N/A(현재 정식 v0.108.0 유지)
- `package-lock.json`: N/A(종속성 그래프/버전 유지)
- `db/migrations/0026_logistics_targets.sql`: N/A(기존 immutability/checksum 원칙 보존)
- `src/server/logistics/logistics-targets-service-core.ts`: N/A(검증 중 실제 defect 확인 이전 무관 수정 금지)
- `src/server/logistics/logistics-targets-handlers-core.ts`: N/A(API·보안 계약 불변)
- `src/contracts/logistics-targets.ts`: N/A(#617 연결 Task 수 및 새 DTO 계약 분리)

## AC_TEST_COVERAGE
- AC1: #616 AC2 — new acceptance `AC1 accepts equipment-only...` / `AC1 rejects wrong occurrence...` tests process/common/WorkArea, type/quantity, inactive/cross-scope/duplicate. Preexisting #616 Template A10/B5+ACS MCS verification.
- AC2: #616 AC3 — new `AC2 and AC4 preserve source...` test captures populated `project_equipment`/`project_logistics_systems`, controller/coordinator edges, actual Equipment owner/System PI role rows across create/update/remove/delete; FK delete rejects in-use MCS.
- AC3: #616 AC4 — new `AC3 rolls back inline...` DB test plus `AC3 enforces Origin/session...` actual HTTP statuses, strict If-Match, malformed JSON/oversize and duplicate/stale request. The two writes serialized by current SQLite service; real multi-process contention is not claimed.
- AC4: #616 AC5 — new `AC2 and AC4...` / `AC4/AC6 provide bounded...` assert multi-Target usage/count and original instance/roles unchanged. WBS–Target Task impact is excluded pending #617; `referencedByTaskCount` is a placeholder, not an authoritative zero.
- AC5: #616 AC6 — new `AC5 upgrades an actual 0025 file DB...` persisted Target restart and schema_migrations/FK; existing `logistics-template-graph.test.ts` and `logistics-targets.test.ts` verify Template/Copy remap, shared MCS and legacy graph. Operational database backup/restore remains NOT TESTED.
- AC6: #616 AC7 — `AC4/AC6 provide bounded...` tests Target list/permission/search/limit/offset/usage HTTP, explicit 400 errors, 404 nonexistent Target. Updated public API/DB/SECURITY requirements.
- AC7: docs and governance — compare actual F2 schema/API vs `API.md`, `DB_SCHEMA.md`, `LOGISTICS_TARGETS.md`, `REQUIREMENTS.md`, `SECURITY.md`, `TEST_PLAN.md`, `REMOTE_VALIDATION.md`, `PLAN.md`, `CHANGELOG.md`; no prospective-only claims.
- AC8: fresh exact PR Head full Quality (Vitest, policy), Chromium E2E 6/6, Docker, default-main Trusted QA and unresolved review 0: **NOT TESTED** before remote workflow finishes.

## Risk / QA / release
risk_level: HIGH
qa_method: OWNER_MANAGED
qa_required: true
manager_decision: NOT TESTED
release_required: false
release_authorized: false

- Current issue request stops at implementation + review threads resolved + PR CI started. **No merge, main CI, tag, GHCR formal publish or #616 Close**.
- CI FULL and Trusted QA PASS do not imply Owner F2 acceptance; if new tests uncover failures, remedy within F2 only and restart exact-head CI. Future #617/618 must be independently implemented and accepted.
