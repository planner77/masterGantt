# Issue #616 — Logistics Target/member F2 Work Packet

## Baseline / objective
- Parent #613, contract F0 #614 (PR #625), dependency F1 #615 (PR #627/#628 merged).
- Source baseline main `6eaec3331fcbc720ab42106789a505c5ee5eefb4`, app `0.106.0`, migration `0025`.
- Branch `feat/issue-616-logistics-targets`, candidate app `0.107.0`, migration `0026_logistics_targets.sql`.
- Scope: Target/member typed persistence and API, reuse existing Project Equipment/System, inline Project-local creation, Project Copy member ID remap; F3 WBS bindings and KPI are not added.
- Risk HIGH; qa_method OWNER_MANAGED; qa_required true; manager_decision NOT TESTED; release_required true; release_authorized false. No merge/main/GHCR/cleanup/Issue closure requested.

## DOCUMENTATION_SYNC
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
