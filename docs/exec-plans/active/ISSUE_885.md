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
- `docs/SCHEDULING_ENGINE.md`: N/A(의존성 날짜 계산 변경 없음, Task 응답 설명 형식만 보완)
- `docs/IMPORT_SCHEMA.md`: N/A(legacy 1.1 구조 동결, Markdown 손실 가능 내보내기는 명시 거절)
- `docs/EXCEL_EXPORT.md`: N/A(기존 Excel 시트 변경 없음, Markdown 본문 내보내기 금지)
- `docs/SECURITY.md`: N/A(기존 인증·Origin·세션·If Match 정책 불변)
- `docs/PROJECT_UX.md`: N/A(Issue와 Task 기존 Workspace 화면 배치 유지)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 초안·접근성·스크롤 공통 규칙 유지)
- `docs/ARCHITECTURE.md`: N/A(도메인 표기 복원이며 서버·네트워크 배포 구조 변경 없음)
- `docs/REQUIREMENTS.md`: N/A(요구사항 Source of Truth는 Issue 885 본문 유지)
## Commands / provenance

- Work performed by GitHub commits on `feat/issue-885-mdxeditor` against snapshot `f3f8b89`; source edits are commit-provenance, **not** execution evidence.
- No local `npm ci` or Vitest/Playwright/browser/production SQLite access in current runtime. Opening the non-draft PR triggers Full PR CI; user explicitly disallowed CI monitoring.
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
