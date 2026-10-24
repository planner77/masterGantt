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

## AC_TEST_COVERAGE
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
