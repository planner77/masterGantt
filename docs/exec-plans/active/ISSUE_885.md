# Issue #885 — MDXEditor Markdown Description / Work Packet

- Primary: https://github.com/planner77/masterGantt/issues/885
- References: `AGENTS.md`, `DESIGN.md`, `docs/PROJECT_ISSUES_USER_GUIDE.md`, `docs/TASK_EDITOR.md`, `docs/ISSUE_LIFECYCLE.md`, #846/#849/#854/#869/#866/#881, SVAR React Gantt demos (Task Editor custom boundary), MDXEditor official Getting Started / Error Handling / Diff Source.
- Baseline: main `f3f8b89ef09bab35987b32f4945dac91b6fa223a` (2026-11-07), branch `feat/issue-885-mdxeditor`.
- risk_level=HIGH
- qa_method=OWNER_MANAGED
- qa_required=true
- release_required=true
- release_authorized=false
- manager_decision=NOT TESTED
- MERGE_READY=BLOCKED

## Scope / approach

1. Single `DescriptionField` for Issue + Task/Summary/Milestone. `@mdxeditor/editor@4.3.3` is dynamically imported with `ssr:false`. Toolbar permits rich-text + Source; `markdown` is initial-only, state callback updates draft and never resets editor cursor per keystroke. No images, HTML or JSX plugin. Source mode is available for error recovery.
2. `react-markdown@10.1.0` + `remark-gfm@4.0.1`, HTML skipped, element allowlist, all images blocked and link target http(s) only, `noopener noreferrer`. Server AST validation rejects HTML, MDX, image and unsafe link destinations; source input is persisted, not executable.
3. Additive SQLite migration 0038 with `description_format` default `plain` on both tables. Existing plain content is never automatically parsed/reformatted; explicit plain-to-Markdown conversion requires user click. DTO `descriptionFormat` is backward compatible; Task and Issue canonical readers preserve it. Existing write authorization, Origin, If-Match, rate limits, status, resource/Task bindings and SQLite transaction remain unchanged. Project Task Copy preserves format, JSON 1.1 / Excel refuse lossy export rather than silently discard format.
4. Issue max 4000, Task 10000 Unicode code points, null for blank Task. Plain/Markdown and Source/WYSIWYG are separate states from workflow status; no task/Gantt writer overhaul.
5. Documentation: design Delta B, schema/API/Issue/Task/export instructions, AGENTS and Changelog updated; historical migrations and safety gates untouched.

## TEST_LIFECYCLE_REVIEW

- **KEEP_UNIQUE**: `tests/e2e/project-issues.spec.ts` registration/password/revision/geometry and `tests/e2e/project-task-editor*.spec.ts` Task/Summary persistence, concurrency, focus/readonly. Preserve tests; update only obsolete `textarea` access to Source mode and new format expectation.
- **ADD**: `tests/server/projects/markdown-description-885.test.ts` AST safety positive/negative, checked migration defaults, explicit legacy conversion. No suite retire, no skipped checks or timeout relaxations.
- **PARTIAL_OVERLAP**: #869 scroll & locale/focus; #854 public Issue edit, #846 credential; #881 navigation; duplicate surface assertions kept due independent risk.
- **NOT TESTED** until actual run: npm lock/Next build/typecheck, E2E8 Chromium, Docker, Trusted QA, 390/768/1024/1440/1920px browser/ko/en/vi/keyboard/125% zoom/real screen reader, full SQLite backup+restore, import/export downstream consumers. No inferred PASS.

## AC_TEST_COVERAGE

- AC01: 공통 Editor의 WYSIWYG/Source·서식/Task·Issue 연동: `tests/e2e/project-issues.spec.ts`, `project-task-editor-persistence.spec.ts`; 실제 Rich Text→Source→저장·재편집 Chrome 검증은 새 Full CI까지 NOT TESTED.
- AC02: 구 일반 텍스트의 `plain` 기본값, 특수문자/줄바꿈 보존과 명시적 변환: `tests/server/projects/markdown-description-885.test.ts`, SQLite migration 0038, 기존 Task/Issue 계약 테스트; 전환 후 무손실은 브라우저 검증 필요.
- AC03: 악성 HTML/JSX/이미지/프로토콜·외부 자동 요청 방어: GFM AST + ReactMarkdown allowlist, `markdown-description-885.test.ts`; HTML paste/실제 browser 보안 음성은 NOT TESTED.
- AC04: DTO/SQLite 0038/Project Copy/Task hierarchy/Link·Subtree snapshot + 구 format-누락 호출 및 JSON·Excel 손실 차단: `description-format-projections-885.test.ts`, `task-dependency-edit.test.ts`, 기존 import/export/Copy 테스트; 운영 upgrade NOT TESTED.
- AC05: Issue 4,000 / Task 10,000 Unicode code point·초안·에러: 기존 `project-issues.test.ts`, `task-contract.test.ts`, `project-task-editor-persistence.spec.ts`; Markdown 소스 길이/오류/재시도 전체 회귀는 NOT TESTED.
- AC06: Issue 공개 조회·비밀번호/If-Match·Task edit session·타 프로젝트 격리와 논리 삭제: 원본 `project-issues.test.ts`, `task-handlers.test.ts`, `project-issues.spec.ts` KEEP_UNIQUE; 실제 새 Head Full 검증 필요.
- AC07: #869 sticky 제목/날짜행·본문 scroll와 #854 Task→Issue handoff, 동일 Gantt instance: 기존 `project-issues.spec.ts`, `project-task-editor.spec.ts`/`task-editor-form-density.spec.ts`; 390~1920 px/125% 실제 Browser NOT TESTED.
- AC08: ko/en/vi toolbar/ARIA, Tab/Escape/focus·반응형: `description-translations.ts`, 기존 i18n/E2E #866·#869 테스트; 100/125%·screen reader·locale 전환 중 초안 보존 NOT TESTED.
- AC09: Next dynamic `ssr:false` + 서버에 없는 MDXEditor plugin, lightweight readonly renderer: `src/features/markdown` 정적 계약, 기존 Next build/Chromium/Docker gate; 메모리·커서 성능/SSR 수동 NOT TESTED.
- AC10: #711 중복 suite 사전 검색, KEEP_UNIQUE/EXTEND/ADD, docs/계약 동기화: 이 Work Packet·기존 Vitest/Chromium8/Required3·Trusted/Owner gate 불변. #3556.1 실패 직접 원인/수정 새 PR CI 별도 증거.
## DOCUMENTATION_SYNC

최초 PR #3556.1의 QA Preflight는 본 섹션의 기계 판독 형식 및 AC01~AC10 식별자 미준수로 실패했다. 문서 영향의 원본 내용은 상단 Scope와 각 가이드를 유지하고, 아래 정확한 경로·판정을 별도 선언한다.

- `AGENTS.md`: UPDATED
- `DESIGN.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/IMPORT_EXPORT.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/ISSUE_885.md`: UPDATED
- `docs/ISSUE_885_FAILURE_ANALYSIS.md`: UPDATED
- `docs/TEST_PLAN.md`: N/A(기존 테스트 정책 불변, #885 AC 검증·회귀는 본 Work Packet 관리)
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH Owner Managed 및 Trusted QA 필수 절차 불변)
- `docs/CI_CD.md`: N/A(Full PR Quality E2E8 Docker 필수 검사 불변)
- `docs/GITHUB_OPERATIONS.md`: N/A(PR push CI만 수행, merge/release 절차 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 검증 출처/Run Attempt 규칙 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: UPDATED
- `docs/IMPORT_SCHEMA.md`: N/A(legacy 1.1 구조 동결, Markdown 손실 가능 내보내기는 명시 거절)
- `docs/EXCEL_EXPORT.md`: N/A(기존 Excel 시트 변경 없음, Markdown 본문 내보내기 금지)
- `docs/SECURITY.md`: N/A(기존 인증·Origin·세션·If Match 정책 불변)
- `docs/PROJECT_UX.md`: N/A(Issue와 Task 기존 Workspace 화면 배치 유지)
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/ARCHITECTURE.md`: N/A(도메인 표기 복원이며 서버·네트워크 배포 구조 변경 없음)
- `docs/REQUIREMENTS.md`: N/A(요구사항 Source of Truth는 Issue 885 본문 유지)
## Commands / provenance — 최초 구현 당시

- Work performed by GitHub commits on `feat/issue-885-mdxeditor` against snapshot `f3f8b89`; source edits are commit-provenance, **not** execution evidence.
- 최초 구현 당시에는 local `npm ci` 또는 Vitest/Playwright/browser/production SQLite 실행 환경이 없었다. 이후 F885-006 재개에서는 별도 worktree와 Node/Chromium을 확보해 실제 로컬 검증을 수행하며 결과는 원장의 최종 후보 검증에 기록한다. PR Full CI 시작 이후 모니터링 금지는 계속 적용한다.
- QA pending: review build/types, AST parser, Markdown rich-text/source data preservation, SQL migration upgrade, exact export contract. No false PASS.

## F885-001 — 2026-11-07 최초 Full PR CI 실패 후 교정

- PR #887 원본 Head `d73f64aa3566d374d8a7213736b96b329f508296`, Base `f3f8b89ef09bab35987b32f4945dac91b6fa223a`; [Full Run #3556.1 / 42362045811](https://github.com/planner77/masterGantt/actions/runs/42362045811), test-merge `ce9bdf129e9a41aa010713b9d448e5d724a0c583`.
- 직접 실패: trusted QA Preflight Job `128372373107`의 `DOCUMENTATION_SYNC` 누락 판정. 원인: `UPDATED, explanation` / `N/A; reason`와 AC1 대신 정확한 `UPDATED` / `N/A(reason)`, `AC01`~`AC10` 필요. 권한/위험도/Primary Issue 계약은 PASS. 파생 Fast Gate/Required3/QA Final FAILURE이며 실제 Vitest/TS/ESLint/E2E8/Docker/Next build SKIPPED·NOT TESTED.
- 별개 리뷰 P1 [PR Thread](https://github.com/planner77/masterGantt/pull/887): link-service-core `taskDtos`, task-field-companion-services `enrichTasks`가 링크 변경/하위 Task 삭제 응답의 `descriptionFormat`을 누락. 장기 Markdown 원문을 plain으로 재해석할 가능성. 두 경로에 canonical `descriptionFormat`을 채우고 독립 SQLite 통합 회귀 `description-format-projections-885.test.ts` 추가.
- TEST_LIFECYCLE_REVIEW: **EXTEND** 기존 dependency/delete snapshot 검증의 동일 DB·Revision 경계, **ADD** 위 집중 테스트. 기존 E2E·보안·마이그레이션 음성 **KEEP_UNIQUE**, skip/timeout/경고무시/Required 검증 완화 없음.
- AC_TEST_COVERAGE: AC04(P1 링크/삭제 DTO), AC06(같은 project binding/revision), AC02(기존 본문 표현 유지), AC10(DOC_SYNC 정책 및 추가 테스트); 나머지는 상단 AC01~AC10 연결 유지. 새 PR CI Head 결과 확인 전 NOT TESTED.
- DOCUMENTATION_SYNC: 위 정확한 파일 경로별 기록 참조. `docs/exec-plans/active/ISSUE_885.md`와 `docs/ISSUE_885_FAILURE_ANALYSIS.md` 갱신; CI/QA scripts 및 역사적인 SQLite migration 원문 수정 안 함.
- 이 후속 명령은 **새 HEAD PR Full CI kickoff까지만**, 모니터링/병합/Main/릴리스/Issue 완료 금지.

## F885-002 — #3557.1 lockfile EUSAGE rework

- Exact Run [#3557.1 / 42362952735](https://github.com/planner77/masterGantt/actions/runs/42362952735), attempt1, original Head `b0085ecd95e0402fa39e05bb8e29a4d32e339d46`, Base `f3f8b89ef09bab35987b32f4945dac91b6fa223a`.
- QA Preflight **PASS**, npm ci **FAIL** identically in four Node setup jobs: missing `yjs@13.6.33`, `lib0@0.2.119`, `isomorphic.js@0.2.5`; Quality/E2E8/Docker/QA Final aggregate derived FAIL, implementation checks NOT RUN.
- Recovery change restricted to npm v3 `package-lock.json`: add three authenticated registry URL/SHA512 donor entries for `@lexical/yjs` peer and `yjs→lib0→isomorphic.js`. Keep package.json version/root deps intact. Neither npm audit nor the repository's reproducible npm ci gate is weakened.
- TEST_LIFECYCLE_REVIEW: KEEP_UNIQUE all existing tests, no skip/timeout changes; npm ci as executable lock-graph regression guard. Next Full8 remote CI must provide runtime evidence before any PASS claim.
- AC_TEST_COVERAGE: AC01/AC04/AC09/AC10 require reproducible npm ci and complete downstream Full CI; other AC mappings preserved.
- DOCUMENTATION_SYNC: `docs/exec-plans/active/ISSUE_885.md` and `docs/ISSUE_885_FAILURE_ANALYSIS.md` UPDATED; `package-lock.json` UPDATED. Other contracts/QA/docs N/A unchanged, existing first `## DOCUMENTATION_SYNC` parser section retained verbatim.
- No release authorization; HEAD synchronization triggers a new Full PR CI but no monitoring/merge/Main/release/closure.

## F885-003 — #3558.1 고정 증거를 유지한 0038/MDX 회귀 교정

- Exact prior [Run #3558.1 / 42363953686](https://github.com/planner77/masterGantt/actions/runs/42363953686), attempt1, original HEAD `bbb85a79b67b9d2f305e3bffbe6de96e71017ffe`, base `f3f8b89ef09bab35987b32f4945dac91b6fa223a`.
- Preflight/Policy/npm ci PASS; TSX Syntax/Hooks errors, Vitest 24 FAILED/3723 PASSED/3 SKIPPED. E2E8/Docker/Next actual stages NOT TESTED. Ledger F885-003 lists exact job IDs.
- **TEST_LIFECYCLE_REVIEW:** KEEP_UNIQUE original 308 suites and immutable Gantt capture; EXTEND migration 0038 ledger/checksum and raw row comparisons (new column excluded only from pre-0038 legacy projection; separately check DEFAULT plain), Task Editor format DTO and legacy plain Task writer, newly reviewed MDX dependency package SRI and unapproved injection negative checks. Original captured bytes never rewritten, no skipped tests and no QA gate weakening.
- **AC_TEST_COVERAGE:** AC01,AC09: valid TSX/React lazy state and client-only editor; AC02,AC04: checked SQLite legacy→38 forward migration/default, old Task write identity; AC06: exact Task/Summary format DTO; AC10: historical Gantt source/SRI evidence and Full CI contract retained. Other AC01–AC10 links above remain in force.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_885_FAILURE_ANALYSIS.md` and this Work Packet UPDATED; immutable historical captures and 0038 source schema untouched; exact new `tests/fixtures/gantt-state-consistency/approved-issue-885-mdx-lock.json` for additive 265 packages is independently reviewable. Existing AGENTS/DESIGN/API/DB_SCHEMA/QA/CI policy unchanged (top exact syntax DOC_SYNC remains original).
- **Exit:** push latest change HEAD and start non-draft PR Full CI, then stop without monitoring. No merge/Main/Release/GHCR/close authority.

## F885-004 — 전체 실패 이력 재평가와 마지막 직접 실패 두 건 교정

- 정확한 이전 실행: [#3559.1 / Run 42365288584](https://github.com/planner77/masterGantt/actions/runs/42365288584), attempt1, original Head `47d6f1f820fd5759a07163819b7b3ba05d934fa5`, base `f3f8b89ef09bab35987b32f4945dac91b6fa223a`. npm ci/QA Preflight/TypeScript/ESLint/Policy SUCCESS; Vitest **2 FAILED / 3745 PASSED / 3 SKIPPED**; Quality/E2E8/Docker aggregates FAIL이며 실제 Next/E2E8/Docker 구현은 SKIPPED/NOT TESTED.
- **종합 원인 계보:** #3556(엄격 QA 문서 문법), #3557(lock 그래프), #3558(TSX/Hooks, 과거 0038 schema·DTO·SVAR evidence), #3559(두 번째 CLI migration count 검증, Resource·Task 재오픈 시 *추가 필드* 비교) 순차로 갱신. 진단·경과·원본 failure run/attempt/head/job IDs 및 재발 방지 범위를 [누적 실패 원장 F885-001~004](../../ISSUE_885_FAILURE_ANALYSIS.md)에서 확인; 과거 단계를 새 성공이라고 추정하지 않는다.
- **설계/범위:** 이미 성공한 앱 코드·Next/Zod·Markdown AST·CI/QA policy·이전 고정 스냅샷은 건드리지 않는다. `tests/server/migration-cli.test.ts`: 실제 SQLite CLI 재실행에서 38개·0038 migration name·tasks/project_issues `description_format` checked NOT NULL `'plain'`를 검증. `tests/server/resources/project-resource-memberships.test.ts`: 두 번째 on-disk reopen에서 원본 Task 20필드 전부 exact deep equal하고 신규 1컬럼 `plain`은 별도 assert; 첫 비교/권한·동일 프로젝트·checksum/FK/assignment 기존 테스트 유지.
- **TEST_LIFECYCLE_REVIEW:** KEEP_UNIQUE 308 suites·3,750 tests, EXTEND 2개 기존 파일의 독립 시험 (historical Task rows vs additive 0038, fresh/restarted CLI), 구 부정 케이스·기능 테스트 삭제 0, skip/timeout/retry/QA gate 변경 0. 현재 변경된 코드·문서의 정적 비교는 실제 Full CI PASSED가 아님.
- **AC_TEST_COVERAGE:** AC02/AC04 기존 plain 원문 및 0038 schema + idempotent CLI; AC06 Project resource participation/FK; AC10 반복 실패 원인·검증 증거 독립성. 나머지 AC01..AC10은 상단 기존 mapping과 신규 PR CI/운영 브라우저 증거를 계속 요구한다.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_885_FAILURE_ANALYSIS.md` UPDATED; `docs/exec-plans/active/ISSUE_885.md` UPDATED; `tests/server/migration-cli.test.ts`·`tests/server/resources/project-resource-memberships.test.ts` EXTEND. 기존 첫 `## DOCUMENTATION_SYNC` parser 문법 그대로, API/schema/security/CI/QA 정책 수정 없음.
- **다음 게이트:** 새 HEAD로 PR CI Full 1회 시작하되 결과 모니터링 없음. 통과 여부 미확인; Owner Managed/Trusted QA/merge/Main/Release/GHCR/issue closure 권한 미부여.

## F885-005 — #3560.1 Chromium shard2 구 Description textarea 호환성

- Exact [PR Full #3560.1 / Run 42366243384](https://github.com/planner77/masterGantt/actions/runs/42366243384), attempt1, Head `b7afbb49c41b8909ca59dc1fbd0ddfcd825f7f82`, Base main `f3f8b89ef09bab35987b32f4945dac91b6fa223a`. QA Preflight, npm ci, TS/ESLint/Vitest, Next build, Docker 구현/Required Quality·Docker 모두 PASS. 8-shard E2E 불통과: shard2 Job `128385358230` E2E #550의 구 textarea `getByLabel("Description").fill`가 Markdown `role=group`에 사용돼 12 PASS 후 1 FAIL, 91 NOT RUN, 타 7 shard CANCELLED. E2E required/QA Final FAIL.
- All prior fails F885-001~004 cross-checked against the newest completed Job results; DOC_SYNC/npm lock/TypeScript/lint/Vitest/Build/Docker latest direct gates pass. **Only shard2's first failure is now identified**, not subsequent remaining 7 shards or Owner/trusted evidence.
- **TEST_LIFECYCLE_REVIEW:** `EXTEND` existing `tests/e2e/milestone-management-persistence.spec.ts` #550 (no retire) with `plain` default assertion, explicit switch to Markdown, Source button + CodeMirror fill, exact `descriptionFormat:markdown` PATCH and canonical persisted DTO assertion. `KEEP_UNIQUE` old Task Editor/Issue E2E, 8 Chromium shards and all #550 nested security/restart assertions. No skip/timeout/retry/expected data relaxation.
- **AC_TEST_COVERAGE:** AC01 (shared editor UI/Source), AC02 (legacy original plain conversion opt-in), AC04 (format in Task DTO), AC06 (#550 HTTP+SQLite CAS/security), AC09 (client-only mounted Source), AC10 (test lifecycle plus new authoritative Full8). Other mappings above unchanged.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_885_FAILURE_ANALYSIS.md` and Work Packet UPDATED; E2E #550 EXTEND. Product/DB/API/CI/QA/Immutable SVAR historical capture unchanged; top exact DOC_SYNC section preserved.
- Full CI `synchronize` triggered by updating same open non-draft PR branch HEAD; stop at kickoff. Do not monitor, merge, Main, GHCR, release, finalize or close #885.

## F885-006 — #3561.1 및 누적 실패 합집합 재검증

- 재개 기준 Head `c136213dae525f95697b116b6624ef333320ea70`, main/base `f3f8b89ef09bab35987b32f4945dac91b6fa223a`, test merge `e44091b98876a4d9b901b8a9226cf74c8d0e3fa7`. Full #3556~3561은 모두 attempt1 FAIL이며 보조 Fast #301~306은 SKIPPED다. 실패 계보·전체 20개 실패 테스트 파일과 취소 shard14개 감사는 [정규 원장 F885-006](../../ISSUE_885_FAILURE_ANALYSIS.md#f885-006--2026-11-07-35611-목록-재조회-정체와-전체-실패-교차-분석)을 따른다.
- 최신 Quality/Docker SUCCESS, E2E shard7의 i18n-master-data Cancel disabled 180초 FAIL(18 PASS/1 FAIL/61 NOT RUN). Trace는 PATCH412 완료 뒤 collection GET 미완료를 보였고 서버 건강/JS exception 부재 및 이전 동일 case PASS/수정 전 로컬 PASS는 transport 근인을 확정하지 못하는 반례다. UNKNOWN과 관측 누락을 구분한다.
- **역할/소유권:** Manager Work Packet·원장·통합/게시, infra 원격 로그/trace 읽기 전용, frontend `tests/e2e/i18n-master-data.spec.ts`만 구현, qa_docs 읽기 전용 사전검토. `issue_comment_writer=manager`. 버전 `0.144.0`/lock/제품/API/DB/Required3/8shard/QA/릴리스 권한 불변. risk_level=HIGH, qa_method=OWNER_MANAGED, qa_required=true, release_authorized=false, manager_decision=NOT TESTED.
- **producer→consumer/TEST_LIFECYCLE_REVIEW:** 기존 401 악성 오류 비노출·재인증은 유지하고, 412는 실제 catalog revision 충돌→실제 GET gate→pending 잠금→응답 후 Cancel 해제·stale 저장 거절로 EXTEND한다. 기존 geometry/언어/선택 ID/초안/보안 assertions KEEP_UNIQUE; 신규 중복 suite/skip/retry/timeout 확대 없음. 제품 변경 대신 실제 서버·동기화 관측 경계를 보강한다.
- **진단/선정:** 누적 실패 E2E 2개와 Description 직접 3개, 같은 catalog 인접 2개 = 7 spec/56 case, workers1/retries0/max-failures0. fast 검증은 이전 실패18파일·Markdown/projection 음성을 포함한 전체 Unit과 정책/TS/lint/build를 한 번 수행한다. 로컬 Docker 전체 smoke는 최신 원격 Docker 성공 이후 이번 테스트-only 변경으로 N/A, 새 Head 공식 Docker 증거는 원격에서 별도로 필요하다. 전체 로컬 E2E 미선정 사유는 직접·간접/음성 경계의 한정 집합 검증이며 원격 Full8은 유지한다.
- **AC_TEST_COVERAGE:** 위 AC01~AC10 표를 계속 적용하며 AC05/06의 mock401/실제412 및 초안, AC07/08의 pending/취소·locale/폭, AC10의 누적 실패 진단을 강화한다. local browser와 hosted8runner/Required3·Trusted/Owner·실운영/AT/native125%를 구분한다.
- **DOCUMENTATION_SYNC:** 원장·본 Work Packet UPDATED; 첫 parser 섹션의 정확 선언은 유지한다. AGENTS/DESIGN/API/DB_SCHEMA/SECURITY/CI_CD/REMOTE_VALIDATION/TEST_PLAN/GITHUB_OPERATIONS N/A(제품 계약·정책 변경 없음). 새 Head의 원격 결과는 NOT TESTED다. 원장에 실제 로컬 결과·source hash·미검증을 반영하고 새 PR CI 시작에서 멈춘다.

### L885-002 후속 일괄 교정

확대 진단에서 Milestone Source 전환의 실제 role가 radio인데 button으로 검색한 TEST_CONTRACT 실패를 발견했다. 같은 오류인 Task persistence helper와 Issue 등록까지 **3개 기존 spec을 함께 EXTEND**하고 Source `toBeChecked()`를 추가한다. 첫 브라우저 실행은 3PASS/1FAIL/1INTERRUPTED/51NOTRUN으로 보존하며, 동일 결함의 반복 timeout을 중단한 뒤 최종56개를 다시 실행한다. 상세 원인·원본 trace·최종 결과는 정규 원장 L885-002와 후속 기록을 따른다. 제품/Unit/CI/권한 변경은 없고 최종4개 변경 spec lint·typecheck·전체 선택56case를 다시 검사한다. 앞선 전체Unit307files/3747cases PASS·기존3skip, build PASS 및 최초 fast FAIL을 서로 덮어쓰지 않는다.

### L885-003 Summary 메타데이터 guard 보완

후속56case에서 Summary의 정상 `description+descriptionFormat` 저장을 `SUMMARY_SCHEDULE_READONLY` 409로 거절하는 제품 결함을 발견했다. backend가 Summary 허용 경계와 공용 Task 메타데이터 분류를 함께 교정하고, 기존 Summary 실제 SQLite·도메인·API 계약 테스트를 red→green으로 EXTEND한다. 일정/진척/Baseline/unknown 직접 쓰기 및 format-only PATCH 거절·권한/Origin/If-Match/revision 무변경을 유지한다. 기존 hierarchical readonly 음성·이전 실패18 Unit과 Markdown/projection을 교차 검증한다. 형식은 일정 입력이 아니라는 계약을 API·SCHEDULING_ENGINE에 명시하며 날짜 알고리즘/DB migration/CI·QA 정책은 변경하지 않는다. 위 과거 전체Unit/build 성공을 제품 보완 후 source의 PASS로 재사용하지 않고 새 검증·지문을 원장에 추가한다. phase=REWORK, risk_level=HIGH/qa_required=true/OWNER_MANAGED, Manager ACCEPT와 새 CI는 NOT TESTED다.

### L885-004/005 공통 편집기 원문·키보드 회귀

두 번째 전체56case는 53PASS/3FAIL로 완료됐다. Summary409 외의 Issue 두 실패는 자동 링크에 의한 비사용자 원문 재작성과 목록 플러그인의 일반 본문 Tab trap이었다. ui_ux 읽기 전용 설계를 따라 frontend가 공통 MDXEditor의 AutoLink만 끄고 일반 rich-text 본문에만 native Tab/ShiftTab 탐색을 적용한다. toolbar/table/code/Source 키맵은 범위 밖이며 기존 원문 정확 동등성·키보드 도달/viewport/ring/5폭 assertions를 유지한다. TEST_LIFECYCLE_REVIEW는 기존 Issue 두 case EXTEND이며 새 중복 suite/skip/timeout 확대는 없다. Task Editor·Issue 가이드·UI_UX_GUIDELINES UPDATED, API/SCHEDULING_ENGINE UPDATED, DB/CI·QA 정책 불변. 최종 source 동결 후 새 Unit/typecheck/lint/build·56case를 실행하고 UNKNOWN GET 정체·실제 AT/native125%·중첩 키보드 미검증과 새 원격 NOT TESTED를 별도 인계한다.

### 최종 자동 선정 도구와 수동 검증의 경계

최종 동결 source `7f3def2b...`에서 자동 fast 검증은 Task classifier/MDX 공통 편집기의 producer 자동 매핑2개가 없어 **LOCAL_PREPR=BLOCKED**(sourceStable=true, 선택48/missing0)다. 이 도구를 변경·우회해 PASS로 만들지 않는다. 원장의 명시적 수동 producer→Unit/HTTP·SQLite/브라우저/음성 매핑으로 전체 Unit·typecheck/lint/build·동일56case를 직접 실행하고 각 실제 결과를 별도로 기록한다. 자동 매핑 미지원, 중첩 편집기 키보드/실제AT/native125%, 원격Required3/Trusted/Owner는 미해결·미검증 상태를 유지한다. 최종 Manager ACCEPT가 아닌 PR CI 시작 준비 단계다.

### L885-006 최종 집계와 native Tab 상한 교정

제품 보완 후 전체56case는55PASS/1FAIL이었고 마지막 #869 실패는 Chromium 날짜 input의 내부 Tab 분절을 단순 DOM count에서 빠뜨린 TEST_CONTRACT였다. 날짜별4 native 정류장 상한을 반영해 ko390의 실제19번째 비밀번호 확인 도달을 확인했으며, 뒤의 추가 reverse assertion의 placeholder 중복 선택도 실제 contenteditable 본체로 한정한다. 제품/Unit은 변경하지 않고 단독 #869를 먼저 재검증한 뒤 최종56을 다시 실행한다. #869는 ko 고정5폭/effective125%/coarse이며 i18n 마스터3언어5폭과 구분한다. 정규 원장 L885-006에55/1 전체 집계·단독 red·구체 지문을 보존한다.

#869 단독 최종1PASS(23.0s/전체31.4s), 최종 typecheck/lint 및 테스트-only 보완의 정적 사전검토 PASS를 확인했다. 게시 후보의 구현/전체테스트 지문 `72d20b50...`, E2E 제외 제품/Unit 지문 `14272063...`에서 같은56case를 다시 실행하며 이전55PASS와 합산하지 않는다. 전체Unit3752PASS/기존3skip·build PASS 이후 마지막 변경은 #869 테스트 계수/진단/선택자뿐이다. 실제 최종56 집계·source 유지·새PR CI 출처는 정규 원장에 별도 추가한다.

### 게시 준비 결과

게시 후보 `72d20b50953d737e3453991ac7a4b371b9ba178c8c227f1d4249c58c6dd4356c`의 전체56 Chromium은 **56PASS/0FAIL/0SKIP, 10.7분/exit0**였고 실행 전후 sourceStable=true다. 전체 Unit3752PASS/기존3SKIP, 최종 typecheck/변경 lint/build 및 별도 정적 QA PASS를 확인했다. 자동 선정 CLI는 UNKNOWN2/BLOCKED를 유지하며 수동 검사 성공으로 덮어쓰지 않는다. 새 Head Full Required3/E2E8·Trusted/Owner와 중첩 키보드/다국어 전체/실제AT/native125%·운영 복구는 NOT TESTED다. 원장에 모든 원본 실패와 최종 명령·지문·제외/미검증·역할을 보존한다. 변경17파일을 한 번 push하고 새 CI 출처를 Issue/PR STATUS에 기록한 뒤 모니터링 없이 종료한다. Manager ACCEPT/merge/Main/Release/GHCR/Issue 종료는 이번 승인 범위가 아니다.
