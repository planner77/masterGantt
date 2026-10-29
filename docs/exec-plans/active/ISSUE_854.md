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
- Tests extended: `tests/server/projects/project-issues.test.ts`, `tests/e2e/project-issues.spec.ts`, and (CI #3425.1 newly exposed, **independent/KEEP_UNIQUE**) `tests/e2e/issue-730-view-composer.spec.ts` report/detail receipt race. No existing #730 positive or focus assertion removed.
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
| #730 source Task save/revision/snapshot/detail/focus restore | `tests/e2e/issue-730-view-composer.spec.ts` | EXTEND existing unique regression | Run #3425.1 reports ready while Detail POST with new snapshot is still loading; await exact canonical details HTTP 200 + snapshot ID/task name + ready receipt before asserting unchanged original Task/focus. No test/coverage skip, focus assertion retained. |
| Password reset/soft-delete, status/KPI, SQLite migration | `tests/server/projects/project-issues.test.ts`, `tests/server/db/database.test.ts` | KEEP_UNIQUE | Separate authentication and migration boundaries. |

## DOCUMENTATION_SYNC
현재 적용 범위: #854 Main CI #3431.1 실패를 복구하는 동일 Issue 비문서 보정 PR. 아래 UPDATED는 **이번 PR의 실제 diff**만 가리키며, 원래 #855의 문서 업데이트는 Git history 및 후속 MAIN-854-001 절의 역사로 보존한다.

- `scripts/verify-issue-lifecycle.py`: UPDATED
- `docs/exec-plans/active/ISSUE_854.md`: UPDATED
- `docs/ISSUE_854_FAILURE_ANALYSIS.md`: UPDATED
- `AGENTS.md`: N/A(existing canonical merge title and empty-body rule unchanged; operator must follow it)
- `DESIGN.md`: N/A(no Project Issue or Task Editor UX change in this corrective PR)
- `docs/API.md`: N/A(existing public Issue POST and authorization contract unchanged)
- `docs/SECURITY.md`: N/A(no auth or rate-limit source changes since the tested original PR)
- `docs/ARCHITECTURE.md`: N/A(no application boundary or service change)
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: N/A(no new end-user behavior)
- `docs/PROJECT_UX.md`: N/A(no layout or interaction source changes)
- `docs/TASK_EDITOR.md`: N/A(no editor source changes)
- `docs/TEST_PLAN.md`: N/A(no new app test contract; existing historical policy regression is extended and mapped below)
- `docs/DB_SCHEMA.md`: N/A(no schema migration or index changes)
- `docs/CI_CD.md`: N/A(existing Main trace verification and required gates remain intact)
- `docs/QA_REVIEW_POLICY.md`: N/A(existing Owner-managed and Trusted QA approval gates unchanged)
- `docs/GITHUB_OPERATIONS.md`: N/A(existing one-line empty-body merge payload procedure is reused without edits)
- `docs/REMOTE_VALIDATION.md`: N/A(exact Run Attempt Head Base test merge evidence rules unchanged)
- `docs/IMPORT_EXPORT.md`: N/A(no import or export change)
- `docs/SCHEDULING_ENGINE.md`: N/A(no task scheduling or dependency change)
- `CHANGELOG.md`: N/A(package version and delivered product behavior unchanged)

## AC_TEST_COVERAGE
- AC1: Public non-edit POST, valid password and persistence in `tests/server/projects/project-issues.test.ts`; E2E readonly Issue button in `tests/e2e/project-issues.spec.ts`. Pending remote evidence.
- AC2: Private read/POST denial; Origin, wrong Task/project scope, strong If-Match 412 and new 429 with Retry-After. API tests extended; pending remote evidence.
- AC3: Existing Issue individual password PATCH/DELETE/legacy reset, 3 statuses/KPI/DB CHECK/FK regression retained. Existing server and E2E tests; pending remote evidence.
- AC4: Task Editor read-only click prefill canonical Task UUID/name, exact persisted ID via Browser `project-issues.spec.ts`; pending remote evidence.
- AC5: Linked Task clear, another Task choose, free text null-ID, general Issue tab empty and no stale prefill; `project-issues.spec.ts`; pending remote evidence.
- AC6: Dirty guard, modal handoff and focus return, deferred canonical GET race (navigation/second editor blocked), revision reload failure protection and Gantt instance unchanged; browser tests plus the existing #730 separate report vs detail HTTP async save/focus scenario in `tests/e2e/issue-730-view-composer.spec.ts`, **extended with exact snapshot identity, task-name, detail-ready and focus assertions**, pending new remote HEAD evidence.
- AC7: Docs above, no DDL/migration changes; accumulated failure analysis this packet, required CI/QA pending.

## CI #3420.1 new failure and source verification (2026-10-29)

- [Full #3420.1](https://github.com/planner77/masterGantt/actions/runs/40891672575), **Run ID 40891672575 / Attempt 1**, HEAD `8824d26c4002a527c19b46a10630d8c915a30600`, base `5ba0c275669a3521be120751ab260099df2c40aa`.
- The Changes/trace and trusted QA routing jobs **SUCCESS** (previous #3408/#3409 metadata errors did not recur). QA Preflight job **123510474606** directly failed `DOCUMENTATION_SYNC` because **`docs/REMOTE_VALIDATION.md` was not listed** in this Work Packet. The base validator's `docs_required(paths)` unions six QA source documents whenever `AGENTS.md` or `docs/SECURITY.md` is changed, even when the missing document itself is not modified.
- Corrective change adds an explicit `N/A(reason)` for unchanged `docs/REMOTE_VALIDATION.md` rather than claiming document updates not made. Verified required paths against all 18 changed paths and base validator's `docs_required` contract: exactly eight required documents, with existing seven and new Remote Validation entry. No validation policy/CI gate/test skip was relaxed.
- Downstream PR Fast Gate `123510720791` and required Quality/E2E/Docker aggregates fail due to failed preflight; actual TypeScript, ESLint, Vitest, Next build, Chromium8 and Docker implementation **SKIPPED / NOT RUN**, not regression PASS/FAIL. QA Final `123510968406` derives FAIL from required quality, not another independent application error.
- Codex P1 thread `PRRT_kwDOUUB7Bc6xlJTc` is **resolved**, no new open threads observed as of this audit. `main` compare: ahead=33, behind=0, merge-base exactly base SHA; code merge conflict absent at audit. New HEAD Full CI outcome remains NOT TESTED. [Cumulative analysis](../../ISSUE_854_FAILURE_ANALYSIS.md).

## CI #3423.1 — Required3 전체 SUCCESS, QA Final API 503 외부 오류 (2026-10-29)

- [PR Full #3423.1](https://github.com/planner77/masterGantt/actions/runs/40893148989), **Run ID 40893148989 / Attempt 1**, exact PR HEAD `f6c3e3983d52a4d3fffbb97af03fcfa32be1cb0f`, base `5ba0c275669a3521be120751ab260099df2c40aa`, test merge `3b46cdb1cf74e1ed696368ed526b62a600c2e85d`. Initial metadata+docs contract blockers did not recur: Changes, QA routing, QA Preflight and Fast Gate SUCCESS.
- **Actual implementation verification**: TypeScript, ESLint, Vitest, Next production build, Policy, all **eight Chromium PR E2E shards 1/8–8/8**, and Docker smoke implementation SUCCESS; three required aggregate Jobs **Quality 123522928839**, **E2E 123540399552**, **Docker 123524549827** SUCCESS. These results apply **only to the above exact HEAD**, not to a subsequent ledger/doc commit.
- **Only direct failing Job**: `QA Final — Automated` **123540466644**, step `최신 PR 증거·문서·리뷰 확인 (read-only)` returned **BLOCKED** with `GitHub API 접근 불가 (503)`. The trusted base `scripts/qa_final_automated.py::api` maps HTTP/URL/timeout errors into BLOCKED with HTTP code but does not log the failing endpoint; no evidence of a deterministic application regression or permission denial. API outage vs intermittent infrastructure failure **UNCONFIRMED**. Do not assert 503 is globally transient without source evidence.
- **Remediation scope**: preserve existing authenticated read-only QA and Required3 gates; **do not edit QA validator/CI policy in the same feature PR**, do not mark failed source Run as PASS, and do not bypass the Owner/Trusted QA gate. Record direct HTTP 503 and exact job/run provenance in [cumulative failure ledger](../../ISSUE_854_FAILURE_ANALYSIS.md); generate a new Full PR CI from the documented HEAD and inspect its eventual result separately as instructed by the Owner (no monitoring this turn). If API 503 recurs, follow up on server/API reliability with a separate trusted-base change/recovery process.
- Review audit prior to re-run: Codex P1 thread `PRRT_kwDOUUB7Bc6xlJTc` resolved, no unresolved threads; main 5ba0c27 is an ancestor (`ahead 35, behind 0` at read). No code merge conflicts in the compare; branch protection and CI final success remain separate checks.
- Local executions unavailable in connected GitHub editor; prior remote Required3 success is genuine **for F-004 Head** only. Security residual risks from public Issue creation persist and require HIGH Owner acceptance before merge.

## CI #3425.1 — Shard 5 direct #730 detail-not-ready E2E failure (2026-10-29)

- [PR CI #3425.1](https://github.com/planner77/masterGantt/actions/runs/40938245476), **Run 40938245476 / Attempt 1**, PR HEAD `9ac72f8ade40c057f43a610cdea513dc7215f5ff`, base `5ba0c275669a3521be120751ab260099df2c40aa`, test merge `de6123636ff6ba07bdb249541152705fce45ac0b`.
- **Direct test failure**: E2E shard **5/8**, Job **123676149033**, `tests/e2e/issue-730-view-composer.spec.ts:582`, `#730 실제 원본 Task 저장 후 revision·snapshot 갱신과 선택 관점 보존`. After HTTP PATCH 200, report refresh HTTP 200, `data-ready=true`, snapshot revision/spec/selection checks, the test immediately asserted renamed original Task button within five seconds. Its Playwright failure context shows `상세 확인 중…` and **no Task button yet**. Original trace's refreshed report POST (about 3.57s) was followed by a separate `projection.kind=details` POST for the new snapshot, still in flight at failure. No evidence of a completed failed detail response or wrong canonical task mapping; this was a test synchronization fault under slow detail transport (application regression not independently proven).
- **Prior-run cross-check**: [#3423.1](https://github.com/planner77/masterGantt/actions/runs/40893148989) same E2E file and all eight shards passed; the HEAD delta from `f6c3e398...` to `9ac72f8...` was **only** `docs/ISSUE_854_FAILURE_ANALYSIS.md` and this Work Packet, not runtime/test code. This raises a timing/race diagnosis; deterministic reproducibility remains unproven.
- **Cancel/downstream**: other seven PR E2E shards (1/2/3/4/6/7/8) **CANCELLED** by `--max-failures=1`, not counted as failures or passes. Required E2E Job **123680974997** FAIL derived. Required Quality **123676804206** and Docker **123678065863** both SUCCESS, with Preflight, TypeScript, ESLint, Vitest, Build, Policy also SUCCESS. QA Final **123681022380** FAIL follows `required e2e 미성공`; this early gate means the previous F-004 GitHub API 503 path was **not re-verified**, so absence of a repeated 503 is not proof of API recovery.
- **Fix**: retain the original assertions (task PATCH 200, report revision/snapshot, original selected row/view, renamed original button, focus restored, read-only snapshot/task identity). Before releasing delayed report, subscribe to the new canonical **details** POST response (same Project/equipment, new snapshot ID); require HTTP 200, response Task ID+renamed name, matching report snapshot ID, `data-detail-state=ready` and a positive `data-detail-confirmation-id`. Network completion has a bounded 30-second diagnostics allowance; no skip, retry, test-specific fail-fast bypass, blanket assertion relaxation or CI policy change. This extends the existing #730 unique E2E test, not a duplicate.
- Docs contract: `docs/TEST_PLAN.md` blob remains unreadable via GitHub connector and is preserved intact; this Work Packet's `TEST_LIFECYCLE_REVIEW` and `AC_TEST_COVERAGE` record the additional test; cumulative evidence in [failure ledger](../../ISSUE_854_FAILURE_ANALYSIS.md). New remote HEAD Quality/E2E8/Docker/QA **NOT TESTED** until new CI concludes.

## PR / Review / Conflict / Failure ledger
- PR [#855](https://github.com/planner77/masterGantt/pull/855) initial Head `4c7ef263ef40a5b7a0a2f2e9d0542afad7481f32` after first implementation ledger commit, base `5ba0c275669a3521be120751ab260099df2c40aa`. Full Run [#3408.1](https://github.com/planner77/masterGantt/actions/runs/40885313560), metadata-only Run [#3409.1](https://github.com/planner77/masterGantt/actions/runs/40885338058) FAILED due independent missing canonical `Refs #854` and exact-line PR `qa_method` field; PR body corrected without changing validators, Required aggregates remain historical failures.
- Latest Codex review identified a P1 race in `finishTaskIssueCreate`, [thread](https://github.com/planner77/masterGantt/pull/855#discussion_r4413142769). Fix retains the handoff guard across asynchronous canonical GET, with a browser negative test that delays GET and verifies no newer Task Editor/Project navigation. Review thread reply/resolve and main conflict verification must be recorded in [#854 cumulative failure ledger](../../ISSUE_854_FAILURE_ANALYSIS.md).
- No execution of TypeScript/Vitest/Playwright/Docker has been verified on this new Head. Do not label skip as PASS or merge without owner-directed gate.

## MAIN-854-001 — Merge 메시지 규칙 위반으로 실패한 Main CI 복구 (2026-10-30 KST)

### 불변 원본 및 직접 원인

- 사용자 최신 요청에는 "Issue 809"라고 표기되었으나 #809의 Main #3306.1/#3310.1은 **SUCCESS**, Issue는 CLOSED이다. 직전 병합 대상인 #854 / [PR #855](https://github.com/planner77/masterGantt/pull/855)의 최신 Main Run이 실제 실패했으므로 #809 기록과 코드는 변경하지 않는다.
- 원본 PR #855 정확 Head `865b181bb7cf955ba4d7ee3b476020180123b894`, base `5ba0c275669a3521be120751ab260099df2c40aa`: [Full PR CI #3430.1](https://github.com/planner77/masterGantt/actions/runs/40941906286) Run `40941906286` attempt 1, Quality/E2E8/Docker/QA Automated **SUCCESS**. [Trusted QA #1078.1](https://github.com/planner77/masterGantt/actions/runs/40947547564), Run `40947547564` attempt 1 **SUCCESS**. Codex P1 was answered/resolved, unresolved threads 0, strict base/main aligned; Owner-managed authorization to merge was given. Original failure records F-001–F-005 remain unchanged.
- Merged two-parent commit `b99598bfbd8afd4a47a13744ac9e33617ed283ec`, first parent `5ba0c275669a3521be120751ab260099df2c40aa`, second parent `865b181bb7cf955ba4d7ee3b476020180123b894`. Original title `Issue #854 · PR #855 · 공개 Project Issue 등록 및 Task Editor 연계` has a **36-character summary** rather than the maximum **30** in `scripts/main_ci_run_name.py`; the merge API also received a nonempty **multi-line commit_message** containing `Refs #854` and approval prose. Either flaw independently fails `parse_merge_title`. The prior squash attempt was rejected by the repository and no rewrite of the resulting protected Main history is permitted.
- [Main CI #3431.1](https://github.com/planner77/masterGantt/actions/runs/40949526050), Run `40949526050` attempt 1, `push` main exact SHA above: **FAILURE**. Direct first error in [Changes Job 123713644216](https://github.com/planner77/masterGantt/actions/runs/40949526050/job/123713644216) Step 8 `CI 실행 추적 메타데이터 검증`: `python3 scripts/verify-ci-run-trace.py` exited 1 with `Issue # 접두어는 정확한 단일 행 표준 Merge 제목만 허용합니다`.
- Required Quality Job `123713756617`, Chromium E2E Job `123713756663`, Docker Job `123713756499` **FAILURE are derivatives** of the first Changes job; all actual TypeScript/ESLint/Vitest/Next build/Chromium8/Docker implementation jobs are **SKIPPED/NOT RUN**, GHCR candidate job `123713815288` **SKIPPED**. Shadow advisory success does not compensate. Actual application regression **NOT TESTED**, not proven. Classification: `POLICY_CI / MERGE_METADATA`, caused by the merge API invocation, not by application code or CI validator.
- The `main_ci_recovery.py` path is for missing original push workflows, not this completed failed source. Retrying Run #3431 without a new commit repeats the immutable bad message. Do not loosen parser/Required3, force-push Main, overwrite old Run, forge a GHCR success, or close the Issue without verified Main and Finalizer.

### 제한적 보완·영향 검사

- Latest Main `b99598bfbd8afd4a47a13744ac9e33617ed283ec`에서 `fix/issue-854-main-trace-recovery` 분기, 기존 `scripts/verify-issue-lifecycle.py` 정책 회귀를 **EXTEND**: 실제 #3431 title의 overlong Korean summary 및 원본 multi-line message 두 가지 각각 `parse_merge_title`와 `validate_push` **negative**, 기존 `merge_api_payload`의 1행 short Korean summary + `commit_message=""` + expected HEAD SHA **positive**. 기존 #586/#603/#639/#808/#825의 고유 회귀는 KEEP_UNIQUE. 테스트 삭제/skip/timeout·기존 QA/CI 도구의 검증 로직 변경 없음.
- 동일 Issue 비문서 교정 PR의 Main CI가 독립 SUCCESS로 완료되어야 `scripts/auto_release_finalizer.py::supersede_failed_issue_retries`가 원본 실패 #3431을 역사적 **SUPERSEDED ATTEMPT**로 기록할 수 있다. Docs-only PR은 원본 비문서 작업의 검증 범위를 대체하지 못한다. `package.json` 및 lockfile 버전 `0.138.2` 불변; `release_required=false`, `release_authorized=false`. 새로운 annotated SemVer tag/정식 GHCR 발행 승인이 아니며 임시 Main ci-SHA 후보의 게시·검증은 새 Main Full gates 후 판단한다.
- **TEST_LIFECYCLE_REVIEW:** 기존 정책 하나만 EXTEND; 원래 Project Issue/Task Editor/HTTP/SQLite/Chromium 및 보안/Revision/Rate Limit 검증은 KEEP_UNIQUE. 원래 이슈 AC1–AC7 기능은 [#3430.1](https://github.com/planner77/masterGantt/actions/runs/40941906286)의 검증 source에서 유지되지만 새 corrective Head의 실제 Run/Attempt 결과는 아직 NOT TESTED.
- **AC_TEST_COVERAGE:** AC1–AC6 기존 회귀 경계 유지, 변경된 제품 동작 없음. AC7의 새로운 확인 항목은 원본 실패→신규 정상 one-line payload의 정책 회귀 검증과 이 누적 원장/Work Packet의 provenance이다.
- **DOCUMENTATION_SYNC:** 위 **첫 `## DOCUMENTATION_SYNC`**에 이번 corrective diff의 UPDATED/N/A를 정확히 재선언한다. 지난 #855에서 AGENTS/DESIGN/API/SECURITY/UI 문서가 바뀐 사실은 과거 Git 기록으로 보존하되 이번 diff에서 변경됐다고 허위 표기하지 않는다. `docs/TEST_PLAN.md`은 이번 제품 테스트 변경이 없고 별도 기존 정책 파일만 EXTEND하므로 N/A; 원본 blob을 삭제·초기화하지 않는다.
- **검증 경계:** GitHub 연결에서 실제 Node/Playwright/Docker·보호 Main Git 리라이트 실행 권한 없음. 제품 소스·Migration·CI workflow·required check 이름·QA checker·test assertion 완화 0. 신규 PR은 HIGH/OWNER_MANAGED/qa_required=true, exact Head Full Quality/Chromium8/Docker+default Main Trusted+review0/strict main + Owner의 후속 별도 병합 승인이 필요하다. 이번 요청은 **신규 PR CI 시작까지**; CI 시작을 성공으로 보고하지 않는다.
- **미래 병합 필수 입력:** GitHub가 부여한 실제 PR 번호로 `python3 scripts/main_ci_run_name.py --issue 854 --pr <PR> --summary "프로젝트 Issue Main CI 복구" --as-merge-payload --expected-head-sha <HEAD>` 실행에 상응하는 payload 전체를 사용한다. `merge_method=merge`, `commit_title` 표준 1행, `commit_message=""`, `expected_head_sha` 정확 HEAD. 원래 #3431 실패 기록은 불변이며 새 Main CI/GHCR/Finalizer 검증 전 Issue #854는 OPEN 유지.
