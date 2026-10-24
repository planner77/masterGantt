# Issue #479 — Project visibility and private read authorization

- Issue: https://github.com/planner77/masterGantt/issues/479
- Base/main inspected: `b45885812301d14b9f673841e9944b27b2642323` (2026-10-24 KST)
- Branch: `feat/issue-479-project-visibility`
- Phase: ANALYSIS → PLAN → IMPLEMENTATION → PR CI → REWORK F-007 (prior Full failures recorded; next exact HEAD Full NOT TESTED)
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

## Issue #479 F-004/F-005 — 실제 Type/Lint/Vitest 교정과 source 동결 계약 (2026-10-24)

- Full #3237.1 [40068614374.1](https://github.com/planner77/masterGantt/actions/runs/40068614374): QA Preflight/Policy/TS PASS 이후 `project-readonly-view.tsx` React manual memoization 의존성 오류 1개와 Vitest 19개 직접 실패(기존 schema30 테스트·raw pre0031 fixture·public DTO·가상 HTTP 경로·8샤드 신규 spec 미등록). 이후 Fast Gate/Required3/QA 파생 FAIL, 실제 E2E8/Build/Docker NOT RUN.
- Full #3246.1 [40075527776.1](https://github.com/planner77/masterGantt/actions/runs/40075527776): 보완 Head `764fd8acf00a2a42e7f0b3f079c5f11ad630cb90`; Preflight/Policy/ESLint PASS, Vitest **3266 PASS / 2 FAIL / 3 SKIP**, TypeScript TS2339 1 FAIL; Build/E2E8/Docker NOT RUN. F-004의 원인 대부분 교정되었음을 관측했지만 전체 성공/병합 준비가 아니다.
- **F-005 남은 오류 교정**: 과거 schema의 최소 Target fixture 반환에 실제 `projectProcessId` UUID를 보존하여 기존 inherited source assertion의 타입을 유지; #672 migrated+restarted DB의 migration 31 및 과거 프로젝트 public 기본값 증명; #727 SQLite reset·restart raw data는 기존 모든 열의 동일성을 유지하되 0031의 신규 `visibility` 열만 별도 public 단언. 테스트 Skip, 정적 검사 및 암호/Origin/private gate 완화 없음.
- `TEST_LIFECYCLE_REVIEW`: ADD `tests/fixtures/legacy-project.ts`는 *과거 스키마 직접 SQL 입력을 위한 test-only adapter*이며 production Repository/API/KDF 우회 아님. EXTEND historical migration/restart/failure injection, exact DTO, 8-shard selection, protected private-access; KEEP_UNIQUE 기존 HTTP/SQLite, non-null/CHECK, Origin/EditSession, JSON/Excel/Copy/Template, E2E8. PARTIAL_OVERLAP: version24~30 legacy test only; CONSOLIDATE/RETIRE none. 원본 19개 실패 파일 합집합과 재출현 TS/Vitest 3건의 출처는 [F-004~F-005 원장](../../ISSUE_479_FAILURE_ANALYSIS.md)에 기록.
- **Remote frozen candidate**: 본 수정은 사용자 지시의 새 Full CI 시작용이며 원격 TypeScript/Vitest/Chromium8/Docker/Trusted QA/Owner 결과는 확인 전 모두 NOT TESTED. 운영 SQLite 원본 migration/restart와 권한 없는 Project / SSR / Export / Import 복구는 실제 CI·별도 운영 환경 검증 전 성공 주장 금지. `HIGH/OWNER_MANAGED/qa_required=true/release_authorized=false`, 병합/Main/GHCR/Finalizer/Issue close 제외.

## PR #794 F-006 — 첫 E2E8 shard 실패 및 생성폼 배치 교정 (2026-10-24 KST)

- 원본 [Full #3247.1](https://github.com/planner77/masterGantt/actions/runs/40076270617) / Run ID `40076270617`, Attempt1, HEAD `82b06145689e6fa74cfe331c8fe73e9d46fa325a`, base `b45885812301d14b9f673841e9944b27b2642323`, test-merge `9358d54937f009385ec654040ba9886a8d0e7a85`. TypeScript/ESLint/Vitest/Policy/QA Preflight/Quality aggregate/Next build/Docker Smoke 모두 SUCCESS; 기존 F-004/005 직접 오류 재발은 이 검증 범위에서 관측되지 않음.
- **유일하게 로그로 확인한 직접 실패**는 Chromium `shard 8/8` Job `120820689134`의 `tests/e2e/project-create-layout.spec.ts:145`: 768px Template `sameRow(startDate,password)` 기대 true/실제 false. 45 case PASS 뒤 fail-fast(1)로 이후 57 미실행. 1~7 샤드는 일괄 CANCELLED, 각 로그에서 종료 전 명시적인 별도 failed test는 확인되지 않았으나 그 결과는 PASS가 아니다. Chromium aggregate 및 QA Final 실패는 파생. [누적 원장 F-006](../../ISSUE_479_FAILURE_ANALYSIS.md#f-006--pr-794-full-32471-chromium-8-768px-template-grid-regression).
- 원인: #479가 `CreateFromTemplateForm`에 신규 공개범위 Fieldset을 시작일과 비밀번호 **사이**에 삽입하면서, 12-column desktop(4+3+2+field+3)와 2-column tablet의 Grid 자동 배치가 비밀번호를 다음 행으로 이동시켰음. width=320/390 case와 다른 기검증 필드는 기존 assertion 통과. Product/UI layout 회귀이며 테스트 결함·Runner timeout 또는 서버 인증 실패로 단정하지 않음.
- 교정: `src/features/templates/create-from-template-form.tsx`의 시각/키보드 순서를 name→owner→date→password→visibility→description으로 구성, 공개범위를 full row로 지정해 2/12-column budget 보존; 라디오를 compact, focus 가능한 inline 그룹으로 스타일링. `src/app/globals.css`의 기존 64rem/44rem 경계를 유지. #282 `tests/e2e/project-create-layout.spec.ts`는 기존 768/1024 행 assertion을 그대로 유지하며 7폭에서 공개범위 독립 행·두 라디오·선택 전환·overflow 음성 회귀를 추가. 기존 보안·Project 접근제어/Origin/Session/DB/CI/Shard 배치 변경 없음.
- `TEST_LIFECYCLE_REVIEW`: `EXTEND` 기존 #282 7폭 Chrome E2E에 신규 #479 fieldset 영향·Tab 순서와 가시 반응형 경계 검증, `KEEP_UNIQUE` 별도 `project-visibility.spec.ts`의 private 401/Export/Session, #282 원래 geometry, #479 Vitest/SQLite/TypeScript·QA/Policy/Build/Docker. 새로운 spec/shard 수, skip, assertion 약화, retry/timeout 증가는 0. 본 Work Packet/원장/PROJECT_UX 의미 동기화. 새 정확 HEAD 전체 8/8 Chromium/Trusted QA·Owner는 **NOT TESTED**, HIGH 위험 수용·merge/Main/GHCR/Finalizer 별도 승인.

## PR #794 F-007 — Full #3248.1 Template DTO strict E2E 회귀 및 #792 최신 main 동기화 (2026-10-24 KST)

- 원본: [Full #3248.1](https://github.com/planner77/masterGantt/actions/runs/40081766529), Run ID `40081766529`, attempt1, Head `d599e0377daf1ac918d739f88cc28b01db2c1bf1`, main/base 당시 `b45885812301d14b9f673841e9944b27b2642323`, test-merge `2013c1c1b8b92949902d6c84bfd496b83d1ead72`.
- Preflight·Type/Lint/Vitest·Policy/Build/Docker 및 Quality·Docker Required PASS, **Chromium Shard4** `tests/e2e/template-picker-ux.spec.ts:86` request exact equality FAIL: UI는 `visibility:"public"`을 기본값으로 정확히 전송하지만 #265 구 계약은 name/ownerName/date/password 4개만 기대. E2E8 중 다른 7개 CANCELLED, Shard4는 73 PASS/1 FAIL/1 SKIP/15 NOT RUN; E2E aggregate·QA Final FAIL은 파생. 이전 F-006 768px grid regression과 독립적인 `TEST_CONTRACT` 불일치.
- `EXTEND` #265 기존 `template-picker-ux.spec.ts`: 생성 전 **공개 라디오 기본 선택**을 browser assertion으로 확인하고 기존 전체 strict `toEqual` 필드 4개를 그대로 유지하면서 `visibility:"public"`을 다섯 번째 필수 키로 추가. `KEEP_UNIQUE`: #282 `project-create-layout.spec.ts`의 7폭 geometry·공개/비공개 radio 토글과 #479 private SSR/401/Export, Unit/SQLite/Import/Copy를 보존. `PARTIAL_OVERLAP` 생성 UI지만 다른 계약 경계; 신규 spec ADD/CONSOLIDATE/RETIRE 없음. 서버 DTO·보안 gate·Style/CI/timeout/assertion 강도 변경0.
- **base/main 충돌 인계**: 원본 HEAD에서 latest `main`이 #792 완료 Merge `4048245f8dc90c1f46dd1cc58948a17a4fb7338e`까지 진행하여 branch behind 48, GitHub mergeable=false. 직접 Diff를 base `b45885812301d14b9f673841e9944b27b2642323`에서 삼자 대조해 겹치는 변경 7개(`CHANGELOG.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/PROJECT_UX.md`, `docs/SECURITY.md`, `docs/TEST_PLAN.md`, `tests/server/logistics/task-target-bindings.test.ts`)를 별도 확인한다. 6개 문서는 공통 base 본문 **앞에 #479 / #792 섹션 추가만** 있어 각 세그먼트를 한 번씩 보존해 결합. 공통 테스트는 0031 historical SQLite fix와 #792 scope writer coverage의 **변경 hunk 7+2개가 겹치지 않아** 모두 적용, 실제 source import/기존 assert/전체 appended regression 유지. 나머지 #792-only 파일은 새 main 그대로, #479-only 파일은 기존 branch blob 그대로. 2-parent merge commit에서 branch-first/main-second ancestry를 보존한다. 서명/Schema/QA 보호 완화 없음.
- **문서/테스트 이력**: 기존 `docs/TEST_PLAN.md`의 #479/#792 **모든 원본 섹션**, `docs/PROJECT_UX.md`의 #282/#479/#792, API/DB/SECURITY 정책을 삭제 없이 병합한다. `AGENTS.md`/DESIGN와 Trusted CI 정책은 그대로. 이번 직접 실패·중단·작업 원본은 [누적 원장 F-007](../../ISSUE_479_FAILURE_ANALYSIS.md) 보존.
- **잔여**: 이 connector 런타임에서는 새 tree의 실제 Chromium8·TypeScript·Vitest·Docker/운영 migration/DR을 실행하지 않았다. 병합 candidate의 next Full CI `NOT TESTED`. 사용자 승인 범위는 **새 Full CI 시작 후 모니터링 안 함**, P1 review 이전 두 thread resolved 확인·새 commit의 mergeable/behind 재점검. HIGH/OWNER_MANAGED, release_authorized=false, Owner 위험 수용 전 Main/GHCR/Finalizer/Issue 종료 금지.

## F-008 — #3250.1 scoped Chromium alert and current main release reconciliation

- Source [Full #3250.1](https://github.com/planner77/masterGantt/actions/runs/40086230274): Head `2d5d7d5e1a1c5fe53ab4785682c2f7126039c4b1`; Quality/Type/Lint/Vitest/Policy/Preflight/Build/Docker PASS, Chromium 8 shard `project-visibility.spec.ts` `getByRole('alert')` strict-mode collision with Next route announcer, other six shards CANCELLED, seventh SUCCESS, E2E aggregate/QA FAIL.
- Scoped fix `#private-list-error` semantic role and text assertion; retains error message/cookie clearing, private SSR/401/authenticated Export security. F-001~F-007 unchanged. Work Packet's AC4/AC5/AC6/AC7 regressions stay as explicit mapping, production code/required gate unchanged.
- Latest main #792 Release PR #796 advanced package baseline v0.132.0 and canonical large changelog/test-plan docs; merge them without overriding new main content. Detailed evidence [F-008](../../ISSUE_479_FAILURE_ANALYSIS.md), no change to release_authorized=false/Owner acceptance. New exact-Head Full8 required; merge/Main/GHCR/Finalizer/Issue closure disallowed until separate approval.
