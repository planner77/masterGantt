# Issue #854 — 공개 Project Issue 등록 및 Task Editor 연결 Work Packet

- Primary Issue: https://github.com/planner77/masterGantt/issues/854
- Parent contracts: #838/#839/#840 (independent Project Issue), #846 (per-Issue credential/soft-delete), #849 (3-state business status), #711 (Test Lifecycle), #697 (change impact), #704 (cumulative failure).
- Base: main `5ba0c275669a3521be120751ab260099df2c40aa` (branch created 2026-10-29).
- Branch: `feat/issue-854-public-issue-create-task-editor`
- `risk_level: HIGH`; `qa_method: OWNER_MANAGED`; `qa_required: true`; `release_required: false`; `release_authorized: false`.
- Current authorization: implementation + review/conflict audit + PR CI start **only**; do not monitor, merge, publish GHCR, run Main CI or close Issue without a separate Owner request. The initial exact-head PR #855 Full #3408.1 and metadata-only #3409.1 failed in the run trace and QA routing **before** TypeScript/Vitest/Playwright/Docker could execute. See cumulative failure ledger; the updated HEAD remains NOT TESTED.

## 1. Problem / expected contract
- Prior POST uses Project edit session and `service.current(authorizedEditSession)`, excluding read-only public visitors. #846's PATCH/DELETE individual password and private read gate stay as is.
- POST now passes the Project read gate. A public read-only caller creates a protected Issue with password+confirmation; a private caller still needs the existing read session. The Issue credential never grants Project/WBS/Resource write. No new migration; existing 0032–0034/checksums remain unchanged.
- Server: `project-issue-handlers-core` distinguishes POST/read authority from credential-management/edit authority. `ProjectIssueService.create(publicId,revision,input,password,readAuthorization)` hashes outside SQLite, checks project visibility/read authorization + revision again inside IMMEDIATE transaction and canonical Task/Resource scope before insert/CAS revision. Origin/CSRF, bounded JSON, If-Match, no-store and request IDs remain.
- Anonymous misuse: in-memory, per-instance global 120/15min and Project 20/15min. No trustworthy client identity at this layer; reject spoofable XFF as rate key. For multi-instance production, shared ingress rate limiting and Owner risk acceptance are prerequisites for a stronger guarantee. Failure `ISSUE_CREATE_RATE_LIMITED` is HTTP 429 + `Retry-After`.
- UI: Issue tab `Issue 등록` no longer requires Project editable. Task Editor '작업 정보' footer offers `Issue 등록` even when Task is read-only. Dirty/pending/stale Task cannot hand off. On clean handoff the native Task dialog closes before Issue dialog opens; the single Issue form starts with current taskId/name. Users can clear ID+text, search another ID, or type label (null ID). General Issue tab starts empty; saving/canceling Task-origin Issue returns to the canonical Task Editor after reload on saved case. No WBS/Task mutation, viewport or Gantt remount.
- **P1 review remediation (#4413142769)**: Task Editor handoff holds the synchronous editor-opening ownership guard **from the first Issue dialog until the successful/canceled return completes**. On Issue POST success, `taskIssueRestoring` remains true throughout the awaited canonical GET; other Task editors, Issue forms, Project navigation and Project unlock are disabled until completion. Original Task editor reopening occurs only after confirmed current task/Project/sequence equality; failure releases guards and shows recovery error without reopening stale drafts. The old flow cleared the request and switched panels before awaiting the GET, allowing a second Task editor to be overwritten.
- If Issue succeeds but canonical reload fails, provide error and do not show a stale Task Editor. Existing #846 credential-recovery method and Issue PATCH/DELETE, #849 status and KPI remain unchanged.

## 2. Change impact / test design
- Files: `src/server/projects/project-issue-handlers-core.ts`, `src/server/projects/project-issue-service-core.ts`, `src/server/security/rate-limit-core.ts`, `src/features/projects/project-issue-workspace.tsx`, `src/features/projects/project-readonly-view.tsx`, `src/features/gantt/project-task-editor.tsx`.
- Tests extended: `tests/server/projects/project-issues.test.ts`, `tests/e2e/project-issues.spec.ts`.
- Additional contract consumers: Project read/authorization handler and repository visibility; Task Editor modal focus/dirty/readonly; Gantt peer tab; SQL original FKs and migration checksum; Project revision concurrent writer.
- Independent test boundaries: positive public unauthenticated POST, negative private read/writes, foreign Task canonical resolution, Origin/If-Match, 429; Browser readonly Task context/prefill/clear/other Task/free text, successful restore, dirty guard. Admin reset/PATCH/DELETE and old Issue status preserved as KEEP_UNIQUE existing coverage. No tests deleted or skipped.

## 3. Validation and risks
- GitHub connector cannot run `npm ci`, SQLite/Vitest, real Chromium or Docker in its environment: **NOT EXECUTED**, not PASS. Remote exact PR HEAD Quality/E2E8/Docker/Trusted QA are pending at PR start. CI monitoring is explicitly excluded.
- `docs/TEST_PLAN.md` existing blob `06af1fe1dcb0995fc675cb601e1656bd04b267c3` has nonempty Git SHA but fetch through connector returns empty content even with bounded range/encoding; **do not overwrite or truncate** it. This Work Packet preserves the detailed current AC mapping; TEST_PLAN safe synchronized append remains a documented blocker for a future tool with verified contents. QA validation cannot mislabel this as synchronized.
- Security residual: no authenticated identity for public anonymous POST; rate limit is per app instance, not distributed. Public write availability versus spam risk needs Owner HIGH acceptance and ingress guard review prior to production rollout.
- DB rollback/migration: new DDL **none**. Old migration checksums & rows immutable.

## TEST_LIFECYCLE_REVIEW
| Coverage boundary | Existing test | Decision | Why |
|---|---|---|---|
| Public POST without edit, private reject, Origin/stale/Task | `tests/server/projects/project-issues.test.ts` | EXTEND | Existing #846 expected unauthorized public POST; policy intentionally changes. |
| Scoped unauthenticated POST rate budget | Same server file | EXTEND | New denial branch 429 with unchanged password limits. |
| readonly Task Editor prefill, clear, alternate/free-text, dirty protection and delayed GET return race | `tests/e2e/project-issues.spec.ts` | EXTEND | Existing Issue Workspace browser source already verifies form, status, resize/keyboard; add cross-screen handoff and deferred canonical read with locked navigation. |
| Project mutation/readonly, original task context menu | `tests/e2e/project-task-editor.spec.ts`, `tests/e2e/helpers/task-context-menu.ts` | KEEP_UNIQUE | Task/WBS writer, native dialog and context menu are independent risks, not replaced. |
| Password reset/soft-delete, status/KPI, SQLite migration | `tests/server/projects/project-issues.test.ts`, `tests/server/db/database.test.ts` | KEEP_UNIQUE | Separate authentication and migration boundaries. |

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `DESIGN.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/exec-plans/active/ISSUE_854.md`: UPDATED
- `docs/ISSUE_854_FAILURE_ANALYSIS.md`: UPDATED
- `docs/TEST_PLAN.md`: N/A(existing blob not readable via connector; original retained, exact AC mapping in this Work Packet; update safely only with verified raw file contents)
- `docs/DB_SCHEMA.md`: N/A(no schema, index or migration change)
- `docs/CI_CD.md`: N/A(no workflows, gate, policy or release changes)
- `docs/QA_REVIEW_POLICY.md`: N/A(Owner-managed QA and trusted gate unchanged)
- `docs/GITHUB_OPERATIONS.md`: N/A(PR lifecycle procedures unchanged)
- `docs/REMOTE_VALIDATION.md`: N/A(existing exact Head/Run/Attempt remote evidence and validation process unchanged; only PR metadata and Product Issue creation are revised)
- `docs/IMPORT_EXPORT.md`: N/A(Issue ledger still separate from project import/export)
- `docs/SCHEDULING_ENGINE.md`: N/A(Task schedule engine unchanged)

## AC_TEST_COVERAGE
- AC1: Public non-edit POST, valid password and persistence in `tests/server/projects/project-issues.test.ts`; E2E readonly Issue button in `tests/e2e/project-issues.spec.ts`. Pending remote evidence.
- AC2: Private read/POST denial; Origin, wrong Task/project scope, strong If-Match 412 and new 429 with Retry-After. API tests extended; pending remote evidence.
- AC3: Existing Issue individual password PATCH/DELETE/legacy reset, 3 statuses/KPI/DB CHECK/FK regression retained. Existing server and E2E tests; pending remote evidence.
- AC4: Task Editor read-only click prefill canonical Task UUID/name, exact persisted ID via Browser `project-issues.spec.ts`; pending remote evidence.
- AC5: Linked Task clear, another Task choose, free text null-ID, general Issue tab empty and no stale prefill; `project-issues.spec.ts`; pending remote evidence.
- AC6: Dirty guard, modal handoff and focus return, deferred canonical GET race (navigation/second editor blocked), revision reload failure protection and Gantt instance unchanged; browser tests, existing Task Editor/Gantt independent specs; pending remote evidence.
- AC7: Docs above, no DDL/migration changes; accumulated failure analysis this packet, required CI/QA pending.

## CI #3420.1 new failure and source verification (2026-10-29)

- [Full #3420.1](https://github.com/planner77/masterGantt/actions/runs/40891672575), **Run ID 40891672575 / Attempt 1**, HEAD `8824d26c4002a527c19b46a10630d8c915a30600`, base `5ba0c275669a3521be120751ab260099df2c40aa`.
- The Changes/trace and trusted QA routing jobs **SUCCESS** (previous #3408/#3409 metadata errors did not recur). QA Preflight job **123510474606** directly failed `DOCUMENTATION_SYNC` because **`docs/REMOTE_VALIDATION.md` was not listed** in this Work Packet. The base validator's `docs_required(paths)` unions six QA source documents whenever `AGENTS.md` or `docs/SECURITY.md` is changed, even when the missing document itself is not modified.
- Corrective change adds an explicit `N/A(reason)` for unchanged `docs/REMOTE_VALIDATION.md` rather than claiming document updates not made. Verified required paths against all 18 changed paths and base validator's `docs_required` contract: exactly eight required documents, with existing seven and new Remote Validation entry. No validation policy/CI gate/test skip was relaxed.
- Downstream PR Fast Gate `123510720791` and required Quality/E2E/Docker aggregates fail due to failed preflight; actual TypeScript, ESLint, Vitest, Next build, Chromium8 and Docker implementation **SKIPPED / NOT RUN**, not regression PASS/FAIL. QA Final `123510968406` derives FAIL from required quality, not another independent application error.
- Codex P1 thread `PRRT_kwDOUUB7Bc6xlJTc` is **resolved**, no new open threads observed as of this audit. `main` compare: ahead=33, behind=0, merge-base exactly base SHA; code merge conflict absent at audit. New HEAD Full CI outcome remains NOT TESTED. [Cumulative analysis](../../ISSUE_854_FAILURE_ANALYSIS.md).

## PR / Review / Conflict / Failure ledger
- PR [#855](https://github.com/planner77/masterGantt/pull/855) initial Head `4c7ef263ef40a5b7a0a2f2e9d0542afad7481f32` after first implementation ledger commit, base `5ba0c275669a3521be120751ab260099df2c40aa`. Full Run [#3408.1](https://github.com/planner77/masterGantt/actions/runs/40885313560), metadata-only Run [#3409.1](https://github.com/planner77/masterGantt/actions/runs/40885338058) FAILED due independent missing canonical `Refs #854` and exact-line PR `qa_method` field; PR body corrected without changing validators, Required aggregates remain historical failures.
- Latest Codex review identified a P1 race in `finishTaskIssueCreate`, [thread](https://github.com/planner77/masterGantt/pull/855#discussion_r4413142769). Fix retains the handoff guard across asynchronous canonical GET, with a browser negative test that delays GET and verifies no newer Task Editor/Project navigation. Review thread reply/resolve and main conflict verification must be recorded in [#854 cumulative failure ledger](../../ISSUE_854_FAILURE_ANALYSIS.md).
- No execution of TypeScript/Vitest/Playwright/Docker has been verified on this new Head. Do not label skip as PASS or merge without owner-directed gate.
