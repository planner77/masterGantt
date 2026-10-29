# Issue #854 — 누적 실패·리뷰·충돌 원장

- Issue: https://github.com/planner77/masterGantt/issues/854
- Branch: `feat/issue-854-public-issue-create-task-editor`
- Base at branch creation: `5ba0c275669a3521be120751ab260099df2c40aa`
- Risk: HIGH; QA method: OWNER_MANAGED; Required Quality/Chromium8/Docker and Trusted/Owner gates remain in force.
- User scope: design/implementation/review and conflicts/ledger/new PR CI **start**. PR CI monitoring, Main CI, GHCR, merge, release and closure not authorized.

## F-000 — implementation-stage diagnostic, not a CI failure

- Direct observed remote CI failures: **none at initial handoff**. No Run ID/Attempt is available yet, so CI status must be **NOT TESTED**. Do not classify absent CI as PASS.
- Local execution: checkout/npm/SQLite/Playwright/Docker unavailable through the connected GitHub-only editor; `npm ci`, lint, typecheck, Vitest, Chromium E2E and image smoke were **NOT EXECUTED**.
- Documentation source: `docs/TEST_PLAN.md` ref blob SHA `06af1fe1dcb0995fc675cb601e1656bd04b267c3` returned zero content through both bounded ranges and base64. No destructive rewrite attempted; AC/TEST_LIFECYCLE_REVIEW documented in `docs/exec-plans/active/ISSUE_854.md`. Safe TEST_PLAN append deferred to verified file access.
- Failure risk: public POST increased exposure to anonymous misuse; per-Project + global in-memory limits, Origin/CSRF/size/If-Match and Project read gate are controls, not proof of fleet-wide protection. Shared ingress/Owner approval prior to production remains.
- **Review/thread audit (PR #855, initial Head `d3dea89cabef71a6a7586d1e9e0422aca0aab372`)**: GitHub inline review threads **0**, reviews **0** after PR creation. Thus no unresolved review thread or response to resolve at audit time. This is not an independent QA approval and can change on later review.
- **Conflict/source audit (2026-10-29)**: `compare main...feat/issue-854-public-issue-create-task-editor` returned `status=ahead`, `ahead_by=21`, `behind_by=0`, 18 touched files. Main is an ancestor of the branch at comparison time, so no textual merge conflicts with that base. The PR creation snapshot exposed `mergeable=false`; do not label this as conflict-free GitHub merge gate PASS. Branch policy/CI/review readiness remains **BLOCKED/NOT TESTED** until independently verified after CI, and user forbids monitoring.

## Cumulative table

| Index | PR / Head | Run ID · Attempt | Direct cause | Downstream | Mitigation | Result |
|---|---|---|---|---|---|---|
| F-000 | Initial branch | N/A | No prior CI observed; local tools unavailable | N/A | Test/AC mapping and exact source PR CI launch | NOT TESTED |
| REV-001 | PR #855 / initial Head d3dea89 | N/A | 0 review threads/0 reviews; no unresolved review conversation at check | N/A | New reviews must be revisited on latest Head | CHECKED (not QA PASS) |
| CONFLICT-001 | PR #855 / branch vs main | N/A | compare ahead=21/behind=0; ancestor relationship means no content conflict at comparison | PR mergeable field false/merge gate not ready | Do not merge; await distinct required gates and Owner approval | NO CODE CONFLICT OBSERVED / MERGE BLOCKED |
| F-001 | PR #855 / original Full, base 5ba0c27, test-merge 8fa2eed | 40885313560 · 1 (#3408.1) | Changes / CI trace: canonical `Refs #854` missing (`[]`); trusted QA route: standalone `qa_method` missing | PR Fast, Quality/E2E/Docker aggregates derived FAIL; TypeScript/Vitest/Chromium/Docker implementation SKIPPED / NOT RUN | PR body exact Refs + QA/Risk fields; source validation scripts unchanged | FIX APPLIED / new Full pending |
| F-002 | PR #855 / metadata-only, base 5ba0c27 | 40885338058 · 1 (#3409.1) | Same changes trace and QA route metadata failures; edited PR metadata alone had not fixed required fields | Quality/E2E/Docker required aggregates derived FAIL; implementations SKIPPED | Same corrected PR body; do not conflate with F-001 or downgrade prior failures | FIX APPLIED / new Full pending |
| REV-002 | PR #855 / Codex comment 4413142769 | N/A | P1 delayed canonical GET after Issue POST permits another Task Editor; unconditional old Task restore destroys newer dirty draft | Task Editor unsaved state loss risk, not CI test failure | Persistent opening ownership and restoring busy/ref guard, disable tabs/Issue details/unlock; deferred GET E2E; reply 4413557813; resolved thread PRRT_kwDOUUB7Bc6xlJTc | RESOLVED / remote regression NOT TESTED |
| CONFLICT-002 | PR #855 / latest checked branch before rework-ledger commit | N/A | main branch 5ba0c27 is ancestor; ahead=32, behind=0; one review thread resolved, unresolved=0 | Merge gate cannot be inferred from ancestor comparison alone; original required CI failed | No content merge conflict observed; preserve latest main, future reviews must be checked after new HEAD | NO CONTENT CONFLICT / MERGE NOT AUTHORIZED |

## F-001 & F-002 — 첫 전체 PR / 메타데이터 실행의 독립 직접 실패 (2026-10-29)

- Full CI [#3408.1](https://github.com/planner77/masterGantt/actions/runs/40885313560) (Attempt **1**): Job `변경 경로 판정` ID **123487320364**, step `CI 실행 추적 메타데이터 검증` 직접 FAIL. 원문: `CI 실행 추적 오류: PR 본문에는 canonical 'Refs #<Primary Issue>'가 정확히 1개 필요합니다: []`. Job `QA Final 신뢰 경계 확인` ID **123487320373**에서도 직접 `QA 경로 BLOCKED: PR 본문 qa_method의 명시값 필요`. 검증기/CI 자체 변경 없음.
- Metadata-only CI [#3409.1](https://github.com/planner77/masterGantt/actions/runs/40885338058) (Attempt **1**): Job `변경 경로 판정` ID **123487408590**와 `QA Final 신뢰 경계 확인` ID **123487408843**가 같은 두 원인으로 각각 직접 FAIL. Metadata-only라 전체 구현 시험의 성공/실패 증거가 아니다.
- 두 Run의 필수 집계 Quality/E2E/Docker는 선행 Job 때문에 파생 FAIL. 실제 TypeScript/ESLint/Vitest/Next build/E2E8/Docker build/smoke는 SKIPPED이므로 `CODE_FAIL` 또는 `PASS`가 아니다. Fast 판정 및 Preflight의 skip을 별도 원인으로 중복 세지 않는다.
- 원인: 최초 PR 본문에는 `- #854`와 같은 줄에 여러 정책 필드를 inline backtick으로 적었으나 CI `verify-ci-run-trace.py`는 최상위 `Refs #854` 정확 1행, `qa_final_automated.py.pr_field`는 `qa_method: OWNER_MANAGED`·`risk_level: HIGH` 개별 정확 1행이 필요했다.
- 조치: PR #855 **본문**을 `Refs #854` 한 줄과 `- qa_method: OWNER_MANAGED`, `- risk_level: HIGH`, `- qa_required: true`, `- release_required: false`, `- release_authorized: false`로 정정했다. 검증 스크립트/필수 게이트 완화 없음. 변경 Head에 대한 새로운 Full PASS는 아직 관측되지 않았다.

## REV-002 — Codex P1, Task Editor 지연 재조회 중 새 초안 덮어쓰기

- [원본 리뷰 #4413142769](https://github.com/planner77/masterGantt/pull/855#discussion_r4413142769): `src/features/projects/project-readonly-view.tsx`의 `finishTaskIssueCreate`가 `taskIssueCreateRequest`를 해제하고 `setActiveScreen`을 실행한 뒤 `await reloadCanonicalSnapshot()` 하는 동안, 다른 Task Editor를 열 수 있어 예전 Task Editor가 새 dirty draft를 무확인 교체할 수 있다는 **P1**.
- 범위: Product/UX 보호 계약 #854 AC6·AGENTS.md 및 Task Editor dirty/pending/stale 보존. 최초 두 CI 실패의 직접 원인과는 독립이며, E2E는 아직 미실행이다.
- 교정: Issue 진입 시 기존 `editorOpeningReference`를 유지하고 새 `taskIssueRequestReference`/sequence로 단일 소유권을 지정. 완료/취소 후 재조회 동안 `taskIssueRestoringReference`, `taskIssueRestoring`, busy 상태로 다른 Task Editor 진입·탭·Issue 상세·편집 잠금 해제를 차단한다. 재조회 성공 시 동일 request/Project/Task만 복귀, 실패 시 가드 정리 및 stale editor 미재개. `tests/e2e/project-issues.spec.ts`에 **지연된 canonical GET**을 주입해 pending 잠금/복귀/Task writer 0회/Gantt instance 동일을 검증하는 회귀를 추가(원격 실제 결과 NOT TESTED).
- [회신 #4413557813](https://github.com/planner77/masterGantt/pull/855#discussion_r4413557813) 작성 후 GraphQL 스레드 `PRRT_kwDOUUB7Bc6xlJTc`의 `is_resolved=true`를 확인. 당시 미해결 리뷰 스레드 **0건**. 추후 추가 리뷰/Head 변경 시 재확인 필요.

## CONFLICT-002 — 새 Full CI 직전 소스 정합·미해결 리뷰 감사

- `compare main...feat/issue-854-public-issue-create-task-editor`: **ahead 32 / behind 0**, `base_sha=merge_base=5ba0c275669a3521be120751ab260099df2c40aa`. 기준 main은 현 branch 조상, 소스 충돌 미관측(최종 원장 commit 이전 시점); PR 정책/Required/QA 게이트 성공을 뜻하지 않는다.
- PR title `Issue #854 · PR #855 · 공개 Project Issue 등록 및 Task Editor 연계`, PR 본문 canonical Refs 1건, `qa_method=OWNER_MANAGED` 개별 필드 확인. Codex 스레드 1건 resolved, unresolved 0.
- `docs/TEST_PLAN.md`의 비어 보이는 connector 응답으로 비파괴 보존하며 `docs/exec-plans/active/ISSUE_854.md`의 `DOCUMENTATION_SYNC`에 설명 있는 `N/A(...)`로 선언하고 AC1..AC7/TEST_LIFECYCLE_REVIEW를 보존. 구조 검증 규칙은 변경하지 않았으며 QA 문서 의미 검토는 별도 남아 있다.
- **미실행/제약**: 로컬 npm/Vitest/Chromium/Docker 검증 불가, 수정 Head의 Required CI/QA NOT TESTED. 새로운 PR CI 시작까지만 요청됨; 모니터링·병합·Main·GHCR·Issue 종료 제외.

## Future append policy
Keep every original run/attempt and direct/derived failure, original log and fixes; do not overwrite older failures when the latest CI fails. Review threads and branch conflicts must be checked on exact PR HEAD, and outstanding issues recorded.
