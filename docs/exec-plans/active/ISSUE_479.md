# Issue #479 — Project visibility and private read authorization

- Issue: https://github.com/planner77/masterGantt/issues/479
- Base/main inspected: `b45885812301d14b9f673841e9944b27b2642323` (2026-10-24 KST)
- Branch: `feat/issue-479-project-visibility`
- Phase: ANALYSIS → PLAN → IMPLEMENTATION → PR CI (remote outcome NOT TESTED)
- Risk: HIGH (Security/DB/SSR/API+Export); qa_method: OWNER_MANAGED; qa_required: true
- release_required: true; release_authorized: false; version proposal 0.132.0 MINOR
- DESIGN.md: N/A, local privacy controls implement existing density/focus/status design rules. AGENTS.md: N/A, ownership and Source of Truth unchanged.

## Design
`ProjectVisibility="public"|"private"`. Existing projects default public (migration 0031), public list summaries discoverable per D02. Private project details, Task, dependencies, resource/logistics/KPI, Excel/JSON read/export and SSR metadata require exact current Project edit Cookie. Existing password successful authentication produces edit session, not separate readonly session. Server middleware checks every `/api/projects/{publicId}/*` path (GET/read-only POST/export) before handler; canonical service has independent visibility read gate. Edit-session create/current/revoke use existing auth and throttling. SSR HTML/private title locked and generic until auth. Copy keeps source visibility and separate password; Template instantiation accepts explicit visibility, defaults public. PATCH visibility uses same session, exact Origin, strong If-Match and revision+1 without password/auth_version rotation.

## DOCUMENTATION_SYNC
- `DESIGN.md`: N/A(기존 compact status, WorkspaceDialog focus/Escape, semantic state 설계 원칙을 그대로 재사용하므로 새 공통 디자인 규칙은 추가하지 않는다)
- `docs/TEST_PLAN.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/DECISIONS.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/CI_CD.md`: N/A(이번 교정은 PR Work Packet의 문서 매핑만 정정하며 GitHub Actions workflow, Job, Required Check 정책은 변경하지 않는다)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 PR trace, branch, reviewer thread 및 GitHub 권한과 병합 절차를 변경하지 않는다)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 HIGH Owner-managed QA와 Trusted base Preflight 및 release authorization 검증 규칙을 그대로 따른다)
- `CHANGELOG.md`: UPDATED
- `AGENTS.md`: N/A(기존 Source of Truth 및 backend/frontend/QA/Owner 역할과 정책에 변경이 없다)

## AC_TEST_COVERAGE
- AC1: ProjectVisibility enum + migration0031 기존 공개값/CHECK 검증: 새 SQLite/unit 사례 추가, restart/rollback remote NOT TESTED.
- AC2: 생성/Template visibility 및 Copy private 유지: 실제 Service/폼 연결, private Copy·Template integration CI NOT TESTED.
- AC3: Settings visibility 변경 session/Origin/If-Match/revision+1 및 KDF/auth_version 무변경: unit 추가, negative HTTP CI NOT TESTED.
- AC4: 공개 Project Link / private 목록 Badge·Password dialog·Cancel/오류·focus·내비게이션 차단: Playwright 추가, widths/keyboard CI NOT TESTED.
- AC5: Private direct URL/SSR HTML/title/GET no-leak: Server authorized snapshot과 generic lock, browser/HTTP CI NOT TESTED.
- AC6: Project-scoped GET/query/export, percent-encoding bypass: server decode canonicalization와 Central API Gate, unit·E2E negative 추가, CI NOT TESTED.
- AC7: wrong/expired/revoked/foreign session, public readonly, private authorized Export·Import/Mutation trusted snapshot: unit/E2E JSON 포함; 전체 integration CI NOT TESTED.
- AC8: 접근성/390-1920 px responsive·문서/운영 회귀 및 exact-Head Quality/E2E8/Docker/Trusted/Owner: 문서 동기화 완료, 실제 CI·QA는 NOT TESTED.

| AC | Producer/evidence | State |
| --- | --- | --- |
| Schema, migration, default, CHECK invalid values | 0031 + ProjectRepository + project-visibility Vitest | Remote NOT TESTED |
| Create/Template/Copy preserves semantics | Project contracts/service/forms | Integration/Playwright NOT TESTED |
| Metadata transition/edit session/Origin/If-Match/revision+1 | Service, handlers, Settings | Vitest added; full HTTP NOT TESTED |
| Private list, password dialog/cancel/focus, copy & public Link | ProjectList and WorkspaceDialog | 390/768/1024/1440/wide NOT TESTED |
| Direct URL/SSR no title/snapshot without cookie | Page + PrivateProjectUnlock | Server/browser NOT TESTED |
| All project-scoped reads/exports deny wrong/missing/expired/revoked cookie | Global gate and ProjectService | Partial Vitest; every endpoint HTTP inventory NOT TESTED |
| Session one-project-last Cookie, public readonly, rotation | Existing unchanged sessions | Existing regression CI NOT TESTED |
| Unsafe stale snapshot/credential logs | Generic lock and client snapshot clear | Negative browser/log NOT TESTED |

## TEST_LIFECYCLE_REVIEW
SEARCHED: `tests/server/projects/project-contract-security.test.ts`, `project-service.test.ts`, `project-handlers.test.ts`, EditSession/Copy/Template/DB/migration/Playwright authorization. ADD: `tests/server/projects/project-visibility.test.ts` independent visibility strict enum, SQLite CHECK/default, missing/foreign/expired/revoked session, metadata transition. EXTEND: create/list/PATCH, Copy, Template, SSR and project-scoped route authorization; KEEP_UNIQUE: password hashing, Origin, strong revision, SQLite and Playwright security. PARTIAL_OVERLAP with existing unlock-to-edit (reused semantics); CONSOLIDATE_CANDIDATE/RETIRE_CANDIDATE none. No test removed, skipped or approval relaxed.

## Operations
A private-to-public visibility change immediately enables anonymous readonly; public-to-private immediately denies unauthorized project reads while retaining the current valid session. Owner HIGH acceptance and Trusted QA required before merge, main CI/GHCR/release/Finalizer independent. Restore requires paired backup+image; no blind schema rollback. Exact PR Run/Attempt not yet verified.

## PR #794 F-001 remediation and architecture correction (2026-10-24)

Original Full Run `40065447737.1` [#3223.1](https://github.com/planner77/masterGantt/actions/runs/40065447737) was stopped by two **PR metadata** direct failures (missing standalone `Refs #479`, `qa_method: OWNER_MANAGED`), **not by failed feature tests**; all Quality/E2E8/Docker implementations SKIPPED, Required3/fast gate failed derivatively. Corrected PR body plus Owner flags. Source, job IDs, immutable history, two P1 security reviews and their bounded fixes: [cumulative ledger](../../ISSUE_479_FAILURE_ANALYSIS.md#f-001--pr-794-full-ci-32231-traceqa-metadata-direct-failure-2026-10-24-kst).

### Trust-boundary refinement
- Public-facing direct API handler and SSR page **only** call `ProjectService.getAuthorizedReadonlySnapshot(id, verifiedRawToken)`, checking visibility and same Project session before constructing any snapshot.
- Existing `getReadonlySnapshot(id)` is a **trusted internal adapter**, not a user-facing public API: import/export services, post-mutation DTO, internal snapshots continue using it after the central `withApiRequestLogging` route guard enforces private read scope.
- Central gateway canonicalizes one decoded Project ID matching Next.js route params, rejects malformed/noncanonical encoding before lookup and does not allow `notFound` from escaped raw UUID to skip private auth.
- New negative regressions: percent-encoded Project identifier bypass, wrong/missing session user-facing canonical401, private export success after valid unlock; unit gate/public/private/revision and retained internal import/export path. HTTP total inventory/full browser/SQLite restart require exact Full CI evidence.

### TEST_LIFECYCLE_REVIEW (F-001)
EXTEND existing `tests/server/projects/project-handlers.test.ts`, `tests/server/projects/project-visibility.test.ts`, `tests/e2e/project-visibility.spec.ts`. KEEP_UNIQUE SQLite/authorization/origin/strong If-Match/import/export/Playwright. New encoded-path and authorized export regression are **ADD** independent security/service-consumer risks; do not remove or weaken prior credential/DB/browser coverage. CI/build/e2e/QA status is **NOT TESTED** for new head, HIGH OWNER_MANAGED Owner explicit risk acceptance remains required.


## PR #794 F-002 — Run #3228.1 QA Preflight early stop (2026-10-24)

[Run #3228.1](https://github.com/planner77/masterGantt/actions/runs/40066638067) HEAD `6302cea6f6e3908002ded33e0bd68862d61a769f`: Trace and trusted QA boundary passed; Preflight directly rejected missing canonical `Issue #479` PR title and standalone `qa_required: true`, so PATH_POLICY failed derivatively. The original Issue #479 acceptance list had no machine-readable AC1.. keys and Work Packet lacked strict DOCUMENTATION_SYNC/AC_TEST_COVERAGE bullet structure; both were normalized without changing security/feature semantics. All actual Quality/E2E/Docker implementations SKIPPED. Detailed immutable source/jobs and corrective action: [F-002](../../ISSUE_479_FAILURE_ANALYSIS.md#f-002--pr-794-run-32281-qa-preflight-contract-failure-2026-10-24).

## PR #794 F-003 — Full #3230.1 DOCUMENTATION_SYNC 교정 (2026-10-24 KST)

- 원본 [Full Run #3230.1](https://github.com/planner77/masterGantt/actions/runs/40066936539), ID `40066936539` Attempt 1, source HEAD `b566d19a68ce803217194bfb57575901a322a954`, base `b45885812301d14b9f673841e9944b27b2642323`, merge `ba1734f03b378641474d7b62538e81e6f1824722`.
- Direct: `QA Preflight` Job `120792120489` — PRIMARY_ISSUE/RISK/QA_METHOD/QA_REQUIRED/PATH_POLICY/ISSUE_AC 모두 PASS, `DOCUMENTATION_SYNC FAIL: docs/REMOTE_VALIDATION.md` 누락.
- Cross-run F-001·F-002 metadata와 Issue AC 매핑은 재발하지 않음. 코드/테스트/실행 정책 오류로 단정하지 않음. Fast Gate·Required3·AutoQA FAIL은 파생, 실제 TypeScript/Lint/Vitest/Build/E2E8/Docker는 SKIPPED. 정확 실패 원장: [F-003](../../ISSUE_479_FAILURE_ANALYSIS.md).
- Trusted main `scripts/qa_final_automated.py::docs_required`의 **protected `docs/SECURITY.md` 변경 → QA_DOCS 6개 전부 영향 합집합** 계약을 전체 다시 검증했다. `docs/REMOTE_VALIDATION.md`에 #479 실제 실증 절차·출처/미검증 보호를 갱신하고 `docs/CI_CD.md`, `docs/QA_REVIEW_POLICY.md`, `docs/GITHUB_OPERATIONS.md`, `AGENTS.md`는 변경하지 않은 이유를 `N/A(reason)`으로 정확히 기록한다. `DESIGN.md`와 `docs/API.md`/`docs/DB_SCHEMA.md`/`docs/TEST_PLAN.md`는 기존 판정 유지.
- `TEST_LIFECYCLE_REVIEW`: 기존 Vitest/Playwright/SQLite/인증/Export/Encoded-path 테스트는 KEEP_UNIQUE, 이번 실패는 정책 메타데이터 계약이므로 제품 테스트/Assertion/Shard/timeout을 변경하지 않음. 새 Head CI 전 실제 실행 결과 NOT TESTED.
