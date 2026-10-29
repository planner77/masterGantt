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
| F-003 | PR #855 / Full Head 8824d26c | 40891672575 · 1 (#3420.1) | QA Preflight DOCUMENTATION_SYNC missing `docs/REMOTE_VALIDATION.md` record | Fast Gate FAIL; required Quality/E2E/Docker aggregated FAIL; Typecheck/ESLint/Vitest/Next/E2E8/Docker implementations SKIPPED | Work Packet adds verified `N/A(reason)` for unchanged remote validation. Eight required doc paths and AC1–AC7 mappings structurally cross-checked against trusted base. | FIX APPLIED / NEW HEAD CI NOT TESTED |
| F-004 | PR #855 / Full Head f6c3e398 | 40893148989 · 1 (#3423.1) | `QA Final — Automated` BLOCKED: GitHub API 접근 불가 (503), unknown exact endpoint | Changes/Preflight/Fast/Policy/TypeScript/Lint/Vitest/Next build + 8/8 E2E + Docker and all Required3 SUCCESS; full run FAILURE solely QA | Keep protected read-only QA intact, record original API 503; start new exact-HEAD full CI (no bypass). Repeated 503 warrants separate trusted-base reliability investigation. | EXTERNAL API BLOCKED / RETRY PENDING |

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

## F-003 — PR #855 Full #3420.1: trusted QA Preflight 문서 영향 추적 누락

- **원본 Run**: [PR Full #3420.1](https://github.com/planner77/masterGantt/actions/runs/40891672575), Run ID `40891672575`, **Attempt 1**, PR Head `8824d26c4002a527c19b46a10630d8c915a30600`, base `5ba0c275669a3521be120751ab260099df2c40aa`, test-merge `8339399ca2cb058776e21184af12be08ed09f6da`. 이 Run 이전의 F-001 Full #3408.1/F-002 metadata-only #3409.1은 별개 원본 실패로 보존한다.
- **직접 실패 Job**: `QA Preflight — 정책·문서 사전 검사`, Job ID **123510474606**, Step `원본 base SHA의 QA Preflight 실행 (read-only)`: `FAIL / DOCUMENTATION_SYNC: docs/exec-plans/active/ISSUE_854.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — 문서 영향 기록 없음: docs/REMOTE_VALIDATION.md`. 다른 Preflight 항목 PRIMARY_ISSUE, RISK_LEVEL, QA_METHOD, QA_REQUIRED, RELEASE_REQUIRED/AUTHORIZED, PATH_POLICY, ISSUE_AC는 각각 **PASS**. 따라서 F-001/F-002의 PR title/body·신뢰 QA 경로 오류는 이번 실행에 재발하지 않았다.
- **파생/미실행 구분**: `PR 빠른 검사 판정` Job **123510720791**은 `PREFLIGHT_RESULT=failure`로 FAIL. Quality aggregate **123510898318**, E2E aggregate **123510898503**, Docker aggregate **123510898662**의 FAIL은 파생. `QA Final — Automated` Job **123510968406**은 required quality failure를 확인했으므로 독립 기능 회귀 진단이 아님. **TypeScript/ESLint/Vitest/Next build/Chromium8/Docker 실제 Job은 SKIPPED/NOT RUN**. 어떤 구현 테스트의 결과도 PASS/FAIL로 추정하지 않는다.
- **근본 원인**: 최신 Work Packet의 `DOCUMENTATION_SYNC`는 실행자 작성의 수동 문서 목록을 사용했으며, 신뢰된 base `scripts/qa_final_automated.py::docs_required`의 경로 합집합을 사전 교차 검증하지 않았다. 이슈가 `AGENTS.md` 및 `docs/SECURITY.md`를 수정해 보호된 경로로 분류되므로 `QA_DOCS` 전체(6개)를 포함해야 한다. 기존 일곱 필수 경로는 존재하고 `docs/REMOTE_VALIDATION.md` 한 건이 누락됐다.
- **수정**: `docs/exec-plans/active/ISSUE_854.md`의 DOCUMENTATION_SYNC에 `docs/REMOTE_VALIDATION.md: N/A(existing exact Head/Run/Attempt remote evidence and validation process unchanged; only PR metadata and Product Issue creation are revised)` 추가. 원본 문서를 변경하지 않았으므로 `UPDATED`로 거짓 표시하지 않는다. 신뢰 검증 코드/CI/skip/Required/Ruleset 변경 없음.
- **사전 구조 교차 검사**: 실제 changed paths 18개와 기본 브랜치 `docs_required` 기준 필수 8경로 전부 `UPDATED`(diff 있음) 또는 사유 있는 `N/A(...)`; 원본 Issue #854 AC1..AC7과 Work Packet `AC_TEST_COVERAGE`의 7개 매핑 동일함을 정적으로 대조. 이 검사는 **QA Preflight 실제 PASS가 아니라 예상 입력 계약 검증**이다.
- **리뷰/충돌 재점검**: Codex P1 스레드 `PRRT_kwDOUUB7Bc6xlJTc`는 기존 회신과 함께 `is_resolved=true`, 미해결 스레드 **0**. `main...feat/issue-854-public-issue-create-task-editor` 비교에서 검사 당시 `ahead=34, behind=0`, base/merge-base SHA 둘 다 `5ba0c275...`; 소스 병합 충돌 미관측. 이후 새로운 Run의 QA·Owner·branch strict 검증은 별개로 필요하다.
- **잔여 위험**: 공개 프로젝트 무편집세션 Issue 등록은 남용 방어(단일 프로세스 Rate Limit)·Task Editor 비동기 복귀의 실제 브라우저 재현 및 보안 권한 회귀를 여전히 검증해야 한다. GitHub connector 환경에서 로컬 npm/Vitest/Playwright/Docker 실행은 **NOT EXECUTED**. 사용자 지시대로 새 PR Full CI 시작만 수행하고 결과 모니터링/병합/Main/GHCR/Issue 종료는 금지.

## F-004 — PR #855 Full #3423.1: 필수 구현 검증 전부 통과, QA API 503 BLOCKED (2026-10-29)

- 원본: [PR CI #3423.1](https://github.com/planner77/masterGantt/actions/runs/40893148989), **Run ID 40893148989 / Attempt 1**, HEAD `f6c3e3983d52a4d3fffbb97af03fcfa32be1cb0f`, base `5ba0c275669a3521be120751ab260099df2c40aa`, test merge `3b46cdb1cf74e1ed696368ed526b62a600c2e85d`; initial #3408.1/#3409.1 metadata and #3420.1 documentation Preflight failures preserved as distinct F-001/F-002/F-003.
- 직접 실패: `QA Final — Automated` Job **123540466644**, step **최신 PR 증거·문서·리뷰 확인 (read-only)**, 원문 `자동 QA: BLOCKED`, `사유: GitHub API 접근 불가 (503)`. `scripts/qa_final_automated.py::api` is a **trusted base** read-only helper. It handles HTTPError/URLError/TimeoutError as BLOCKED and exposes status but not the requested API endpoint in the log. The 503 might be transient, but origin, recurrence, request path and global GitHub status are not independently proved. Treat as **INFRA/API_UNAVAILABLE (NOT QA PASS)**; do not misclassify it as app test regression.
- 이미 성공한 독립 검증: 변경 경로 판정 Job **123520514566**, QA Final 신뢰 경계 확인 **123520515245**, QA Preflight **123520725213**, Policy **123520878187**, TypeScript **123520878255**, ESLint **123520879271**, Vitest **123520878181**, PR Next.js Build **123522170359**, Fast Gate **123522011250**, Docker 구현 **123522170316**, **PR Chromium 샤드 1/8–8/8 각 SUCCESS**. Required aggregate Quality **123522928839**, Chromium E2E **123540399552**, Docker smoke **123524549827** 모두 **SUCCESS**. 이후 문서 수정 커밋에 성공 증거를 자동 승계하지 않으며 새 exact-HEAD Full CI가 필요하다.
- 사용자 요청 범위 내 조치: `AGENTS.md`, 실패 원장과 Work Packet 계약을 유지하고 외부 API 503 증거를 본 원장 및 [#854 Work Packet](exec-plans/active/ISSUE_854.md)에 누적. 검증기·CI/Required/QA 코드를 수정하거나 실패 체크를 무시하지 않는다. 새 Full PR CI를 브랜치 문서 커밋으로 실행한다(모니터링 생략). GitHub API 503이 재현되면 일시적 장애 단정 없이 별도 trusted-base 조사/수정 필요.
- 현재 리뷰/충돌 감사: Codex P1 #4413142769 스레드 `PRRT_kwDOUUB7Bc6xlJTc`는 `is_resolved=true`, 새 미해결 스레드 **0**. `compare main...feat/issue-854-public-issue-create-task-editor`는 기록 직전 **ahead=35/behind=0**, base SHA=merge-base SHA=`5ba0c275669a3521be120751ab260099df2c40aa`; source conflict 없음. PR의 최종 merge/QA gate와 HIGH 위험도 Owner 수용은 여전히 별개, 미승인.
- 누적 상태: F-001 PR trace/QA route FORMAT, F-002 metadata-only FORMAT, F-003 DOCUMENTATION_SYNC은 각각 새 Head에서는 재발하지 않았음. F-004는 **별도 단일 QA GitHub API 503**이며 기능 테스트/Required3 PASS와 구분한다. 배포/GHCR/Main/Issue 종료 절대 실행하지 않음.

## Future append policy
Keep every original run/attempt and direct/derived failure, original log and fixes; do not overwrite older failures when the latest CI fails. Review threads and branch conflicts must be checked on exact PR HEAD, and outstanding issues recorded.
