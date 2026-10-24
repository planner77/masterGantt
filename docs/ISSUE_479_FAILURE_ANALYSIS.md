# Issue #479 — PR CI 누적 실패 원장

| ID | 출처/Attempt/Head | 직접 원인 | 분석·조치 | 새 CI 검증 |
| --- | --- | --- | --- | --- |
| F-000 | PR 최초 실행 전 | 실패 확인되지 않음 | 기능·보안·DB·UI 설계와 단위 테스트 추가. 원격 Build/TypeScript/Vitest/Chromium/Docker는 NOT TESTED | PR 생성 후 시작. 사용자 요청대로 모니터링 없음 |

향후 실패(취소 포함)를 누적 보존: Run ID, Attempt, exact PR HEAD/base/test merge, 직접/파생 Job, 로그 근거, 관련 review, 패치, 새 실행 여부. 실패·미실행을 PASS로 분류하지 않고, 원인 교정 없이 단순 반복하지 않는다. Required Quality/E2E8/Docker, Trusted QA, Owner Gate, Main/GHCR/Finalizer는 불변.

## F-001 — PR #794 Full CI #3223.1: Trace/QA metadata direct failure (2026-10-24 KST)

- **Source**: [PR Full CI #3223.1](https://github.com/planner77/masterGantt/actions/runs/40065447737), Run ID `40065447737`, Attempt `1`, `pull_request`, HEAD `908844f763873688fe6ef86ef03bc4995602b0ab`, Base `b45885812301d14b9f673841e9944b27b2642323`, test-merge `307ecbc884a23a4b902611d7ead62b2b27d82ae0`. Full CI **FAILURE** (not a product test failure).
- **Direct failure 1**: Job `120787619032` 변경 경로 판정 → `python3 scripts/verify-ci-run-trace.py` step `CI 실행 추적 메타데이터 검증` returns exit 1: `PR 본문에는 canonical 'Refs #<Primary Issue>'가 정확히 1개 필요합니다: []`. Previous PR body had only `Closes #479`, not the required single standalone `Refs #479`.
- **Direct failure 2**: Job `120787618608` QA Final 신뢰 경계 확인 → trusted main `scripts/qa_final_automated.py::pr_field` exit 1 `QA 경로 BLOCKED: PR 본문 qa_method의 명시값 필요`. Previous prose `qa_method=OWNER_MANAGED` was not a standalone metadata declaration. Mandatory `risk_level` also lacked explicit syntax and was fixed proactively.
- **Derived failures**: PR Fast Gate job `120787676369` CHANGES_RESULT=failure/PREFLIGHT_RESULT=skipped; Required Quality `120787712792`, E2E `120787712817`, Docker `120787712926` aggregate FAILURE. Actual TypeScript, lint, Vitest, policy, Next build, Chromium8 E2E, Docker smoke: **SKIPPED / NOT TESTED**. Source artifact `ci-pr-source-40065447737-1` (artifact ID `12549132507`) was uploaded but cannot turn failed checks green.
- **Metadata correction**: PR #794 body now declares precisely one `Refs #479`, plus separate `risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `release_required: true`, `release_authorized: false` (no trusted CI validator change). A metadata-only `edited` run, if any, must **not** substitute for exact-HEAD Full CI.
- **Independent P1 reviews (not CI direct failures)**: [discussion r4366096194](https://github.com/planner77/masterGantt/pull/794#discussion_r4366096194) reported encoded Project UUID bypass (`URL.pathname` retains `%32` while Next route decodes); [discussion r4366096195](https://github.com/planner77/masterGantt/pull/794#discussion_r4366096195) reported private Export/Import/mutation failures from reusing user-facing read authorization in trusted internal `getReadonlySnapshot`.
- **Code remediation**: canonical decode with strict UUID and malformed 404 before any project lookup; user-facing `getAuthorizedReadonlySnapshot` + explicit handler/SSR read grant; retain `getReadonlySnapshot` **trusted internal only**, where global project-scoped API request gate has authenticated the caller, preserving JSON/Excel/SVG exports, import commit and post-mutation snapshot semantics. No silent bypass of external API/SSR/private access.
- **New tests**: pure percent-encoded UUID/null malformed policy negative; handler private locked401 + response no Project name; ProjectService authorized vs trusted internal snapshot and session expiry/revocation; Playwright percent-encoded logistics GET 401 and authorized private JSON export200. Original auth/Origin/If-Match/SQLite regression tests remain. No tests locally/CI re-executed yet: **NOT TESTED** until next exact-HEAD Full run.
- **Next**: resolve both review threads after verifying changes; verify latest main merge-base/behind=0; push corrected HEAD, observe **only run creation**, no monitoring of results per Owner instruction. No merge/Main/GHCR/finalization/issue close.


## F-002 — PR #794 Run #3228.1 QA Preflight contract failure (2026-10-24)

- **Source**: [Full CI #3228.1](https://github.com/planner77/masterGantt/actions/runs/40066638067); Run ID `40066638067`, Attempt `1`, HEAD `6302cea6f6e3908002ded33e0bd68862d61a769f`, base `b45885812301d14b9f673841e9944b27b2642323`, test-merge `fd4476835a8c7d2d7840bf9859453daf0d197321`, conclusion FAILURE.
- **Confirmed progress**: 변경 경로 판정 Job `120791177233` SUCCESS, QA Final 신뢰 경계 Job `120791177099` SUCCESS. F-001의 `Refs #479`, `risk_level: HIGH` and `qa_method: OWNER_MANAGED` validation passed.
- **Direct failure**: QA Preflight Job `120791227651` step `원본 base SHA의 QA Preflight 실행` exit 1, FAIL3/DEFERRED5: `PRIMARY_ISSUE` title must contain exactly one `Issue #N` (original PR title used only `(#479)`); `QA_REQUIRED` missing standalone `qa_required: true`; `PATH_POLICY` is derived from missing required QA declaration.
- **Follow-on latent structural issue**: The original Issue #479 body used unchecked bullet ACs but did not contain `AC1` machine labels. Trusted main `scripts/qa_preflight.py` will require Issue AC identifiers plus Work Packet `## DOCUMENTATION_SYNC` in exact `- \`path\`: UPDATED|N/A(reason)` form and `## AC_TEST_COVERAGE` mapping `- ACn: ...`. Those did not execute in F-002 because PRIMARY_ISSUE failed; audited and corrected before next run, not falsely described as new observed CI failures.
- **Derived, not implementation evidence**: PR fast gate `120791272355`, Required Quality `120791306593`, Chromium E2E aggregate `120791306597`, Docker aggregate `120791306669`, Automated QA Final `120791329189` FAIL as downstream; TypeScript/Vitest/Lint/Policy/Next build/Chromium8/Docker smoke SKIPPED / NOT TESTED.
- **Correction**: PR title changed to single canonical `Issue #479 · 프로젝트 공개범위 및 비공개 Password 상세 접근제어`; body includes one `Refs #479` and explicit `risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `qa_required: true`, `release_required: true`, `release_authorized: false`. Issue #479 keeps original AC clauses and adds AC1..AC8 aliases; Work Packet gains exact DOCUMENTATION_SYNC (DESIGN.md N/A reason, required API/DB_SCHEMA/TEST_PLAN UPDATED) and AC1..AC8 test coverage bullets. Required/Owner gates unchanged. No prior Full failure converted to PASS.
- **Next**: exact new PR HEAD Full CI via branch push; run start only, no monitoring/merge/Main/GHCR/Finalizer in this instruction.


## F-003 — PR #794 Full #3230.1 missing Remote Validation DOC_SYNC (2026-10-24 KST)

- **원본 출처**: [CI #3230.1](https://github.com/planner77/masterGantt/actions/runs/40066936539), workflow `CI` / event `pull_request`; Run ID `40066936539`, attempt `1`, HEAD `b566d19a68ce803217194bfb57575901a322a954`, main base `b45885812301d14b9f673841e9944b27b2642323`, test-merge `ba1734f03b378641474d7b62538e81e6f1824722`. 2026-10-24 05:36:51–05:38:07 UTC, completed `FAILURE`.
- **직접 실패**: Job `120792120489` (`QA Preflight — 정책·문서 사전 검사`), step `원본 base SHA의 QA Preflight 실행 (read-only)` exit1. `PRIMARY_ISSUE`, `RISK_LEVEL`, `QA_METHOD`, `QA_REQUIRED`, `RELEASE_REQUIRED`, `RELEASE_AUTHORIZED`, `PATH_POLICY`, `ISSUE_AC` all **PASS**. Exactly one `DOCUMENTATION_SYNC` FAIL: `문서 영향 기록 없음: docs/REMOTE_VALIDATION.md`. Trust base `scripts/qa_final_automated.py::docs_required` unions `QA_DOCS` when protected `docs/SECURITY.md` is touched.
- **파생 실패**: Fast Gate `120792186091`; Required Quality `120792231680`, E2E `120792231768`, Docker `120792231664` aggregates; QA Final Automated `120792250805` required-quality fail. Actual Policy, TypeScript, Lint, Vitest, Next build, Chromium 8/8 execution, Docker smoke all `SKIPPED / NOT TESTED`. `QA Final 신뢰 경계 확인` Job `120792064181` and `변경 경로 판정` Job `120792064273` **SUCCESS**, Shadow advisory not an authority. Artifacts: `ci-pr-source-40066936539-1` ID `12549392564`, `qa-preflight-40066936539-1` ID `12549309473`, `qa-final-automated-40066936539-1` ID `12549387709`.
- **분류**: `POLICY_CI / DOCUMENTATION_SYNC`, 새 필수 문서 합집합 누락. F-001 `Refs/qa_method`와 F-002 `Issue #/qa_required/AC` 동일 원인은 **재발하지 않음**. 경합/제품/fixture/E2E는 실제 실행되지 않아 원인 단정 불가.
- **보완**: 동일 Issue Work Packet의 `## DOCUMENTATION_SYNC`에 `docs/REMOTE_VALIDATION.md: UPDATED`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`: `N/A(reason)`를 정확히 선언한다. `docs/REMOTE_VALIDATION.md`에 비공개 Project의 SSR/HTTP/encoded-UUID 및 인증 후 JSON/Excel/SVG Export·Import/수정과 backward-compatible SQLite restart 관찰 계획을 명시한다. `QA_DOCS` 6개 전부, `DESIGN.md` 및 API/DB/TEST_PLAN 합집합을 하나의 표로 정적으로 검증한다. 본 원인은 CI/QA 검증기 결함이 아니므로 기존 base policy, source code, test assertion, 8 shard, Required3를 변경하지 않는다.
- **변경 후 검증**: candidate Head의 Work Packet 구조·문서 목록·Issue AC1..AC8·PR metadata 및 main 비교를 확인, 실제 Next/Vitest/TypeScript/E2E/Docker는 새 PR Full CI가 실행되기 전 `NOT TESTED`. 다음 오류가 발생하면 F-004로 이 원장에 추가, 과거 실패/Skipped 보존.

### 전체 실패 매트릭스 — F-001~F-003

| ID / Run.Attempt | 직접 실패 계약 및 최초 메시지 | 원인/교정 | 최신 Head에서 확인 가능한 범위 |
| --- | --- | --- | --- |
| F-001 / `40065447737.1` | `verify-ci-run-trace.py` canonical Refs[]; trusted QA `qa_method` 누락 | PR body `Refs #479`, `risk_level`, `qa_method` 명시 | #3228/#3230 해당 사전 단계 PASS; 실제 구현 테스트 아직 미실행 |
| F-002 / `40066638067.1` | QA Preflight `PRIMARY_ISSUE`, `QA_REQUIRED`, 파생 `PATH_POLICY` | PR title `Issue #479`, `qa_required: true`, Issue AC1..AC8 및 Work Packet 두 섹션 | #3230에서 Primary/QA/Issue AC PASS |
| F-003 / `40066936539.1` | QA Preflight `DOCUMENTATION_SYNC`: `docs/REMOTE_VALIDATION.md` 누락 | protected security 문서 때문에 QA_DOCS 합집합이 필요한데 매핑 일부 누락 → 모든 요구 문서 전수 재점검·보완 | 새 PR Head CI `NOT TESTED` |

**직접 실패 테스트 파일 합집합:** 이번 세 Run 모두 PR 메타데이터/Preflight 구조 실패로 중단되어 **실제 제품 단위/E2E 테스트 직접 실패 파일 0개(모두 NOT RUN)**. 영향 회귀 후보는 `tests/server/projects/project-visibility.test.ts`, `project-contract-security.test.ts`, `project-handlers.test.ts`, `project-service.test.ts`, `tests/e2e/project-visibility.spec.ts`, 기존 프로젝트 Password/Export/Import/Copy/Template/DB migration 회귀다. 해당 목록은 검증 후보이며 PASS 아님.

**다음 Gate:** 새 SHA의 Full PR CI + Trusted QA + Owner HIGH 위험 수용 전 Merge/GHCR/Release/Finalizer/Issue 종료 차단, 사용자의 요청은 새 CI 시작 후 모니터링 없음.
