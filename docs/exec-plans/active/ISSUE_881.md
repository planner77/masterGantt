# Issue #881 — Project workspace 표시 설정 (Owner A안)

- Primary: https://github.com/planner77/masterGantt/issues/881
- Related follow-up (owner-only auth, not prerequisite): https://github.com/planner77/masterGantt/issues/882
- Baseline: main `229604522969133d1ccc6de0477e373252670c86`, 0.142.0, 2026-11-07
- risk_level=HIGH / qa_method=OWNER_MANAGED / qa_required=true / release_required=true / release_authorized=false
- manager_decision=NOT TESTED / MERGE_READY=BLOCKED

## Owner policy / implementation

1. Project-scoped edit session holder may change Issue, dashboard, master tab visibility. Schedule always visible; default all ON. Same Project read gate for GET, server-owned values, no separate Owner-only auth. Owner name is display-only.
2. SQLite migration 0037 adds three checked Boolean-compatible integer columns with DEFAULT 1; old/new rows default ON. Project Copy inherits source. No data deletion or ACL change.
3. Reuse metadata PATCH strong If-Match, Origin, session project binding/recheck inside transaction, revision. Strict three boolean keys; unknown/partial/mistyped rejected. Project DTO always emits canonical workspaceTabs on service path.
4. Project settings fourth tab, separate `workspaceTabs` PATCH without accidental other draft updates; modal busy/cancel and server snapshot update.
5. Shared workspace navigation availability check for primary tabs, deep links, last screen restore, browser back/forward and internal selectScreen. Hidden screens revert to schedule, no new Gantt instance; existing edit/Issue/Task navigation guards persist. Cross-browser visibility follows latest GET/reload, not local preference.

## TEST_LIFECYCLE_REVIEW

Existing contract/security/project-service/project-visibility/project-copy + workspace-navigation + Project Settings E2E searched. **KEEP_UNIQUE** for existing security, concurrency, Gantt and Issue suites; no deletions/skip/timeout adjustment. **ADD** strict three-boolean/migration/session/revision SQLite test (`tests/server/projects/project-workspace-tabs-881.test.ts`) and hidden URL/section navigation test (`tests/features/project-workspace-navigation-881.test.ts`). Existing full CI E2E8/Quality/Docker is required, not locally assumed. Remaining browser validation 390/768/1024/1440/1920, keyboard/ARIA/KO-EN-VI, native125%, real screenreader NOT TESTED pending actual evidence.

## AC_TEST_COVERAGE

- AC1: migration 0037 DEFAULT 1 plus create-service test.
- AC2/AC7: strict Zod validation, Project edit-session + Origin/If-Match/revision existing handler, new SQLite CAS test.
- AC3/AC8: isolated Project writes, copy source flags, DB persistence; reopen/legacy migration and JSON compatibility need browser/CI additional evidence.
- AC4/AC5: shared navigation helper and top tabs; hidden deep link/legacy restore fallback; dirty/pending/focus manual/E2E pending.
- AC6: on/off canonical project state, original business data unchanged; UI reenable, Issue KPI/Task permissions E2E pending.
- AC9: full viewport/accessibility and language checks NOT TESTED.
- AC10: test lifecycle review above; targeted tests added and CI not claimed successful.

## DOCUMENTATION_SYNC

UPDATED: AGENTS.md, DESIGN.md, docs/PROJECT_UX.md, docs/API.md, docs/DB_SCHEMA.md, docs/SECURITY.md, docs/REQUIREMENTS.md, docs/TEST_PLAN.md, CHANGELOG.md, this work packet, docs/ISSUE_881_FAILURE_ANALYSIS.md.
N/A: docs/CI_CD.md (workflow/required checks unchanged), docs/IMPORT_EXPORT.md (no JSON schema change), SVAR adapter docs (no Core modification), UI_UX_GUIDELINES (existing dialog/accessibility contract reused).

## Verification & release boundary

Remote GitHub connector edits only. There is no locally mounted repository or dependency tree; full TypeScript/Vitest/Playwright/Docker local execution NOT TESTED. Work performed is implementation+commit+new PR to begin full CI; requested stop after kickoff. Existing review threads/mergeable state to be read at PR creation, no monitor after. No merge/Main/GHCR/tag/Issue close/Owner release approval.
