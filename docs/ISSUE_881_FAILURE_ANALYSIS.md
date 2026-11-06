# Issue #881 — 누적 실패 원장

- Primary: https://github.com/planner77/masterGantt/issues/881
- Baseline: main `229604522969133d1ccc6de0477e373252670c86` (0.142.0)
- 2026-11-07 초기 단계에는 실제 PR CI 실패가 존재하지 않음. 원격 Run/Attempt/직접 실패는 확인될 때만 추가.
- 미커밋 편집 스크립트 1차 실행에서 DTO 공통 문자열 중복 일치로 로컬 편집 시도 중단됨. Git ref/브랜치에 적용되지 않았으며 unique interface anchor로 보완하고 blob staging 재실행함. CI/제품 결함이 아니다.
- 로컬 런타임은 GitHub network unavailable, 원본 repository/dependencies 없음: TypeScript/Vitest/Playwright/Docker **NOT TESTED**. 외부 CI run이 started/queued인 것과 성공은 별개.
- 남은 위험: DB 0037 old-file backup/reopen, Project Copy/template, edit session 경합, hidden last-screen 및 dirty/pending, KO/EN/VI, browser geometry/focus/native125%, Gantt instance continuity, 운영 reverse proxy. 실제 실패를 파생 실패/정책 차단과 구분하고 정확한 Head/Attempt 단위로 원장에 누적한다.

## F881-001 — PR #884 Full #3534.1 QA 정책 사전 차단 (2026-11-07 KST)

- Source: [Full run 42305023293](https://github.com/planner77/masterGantt/actions/runs/42305023293), attempt1, event `pull_request`, PR #884, HEAD `3842c797cb3106abcf47ae2bb3b93e7c4afb2e67`, Base `229604522969133d1ccc6de0477e373252670c86`, test merge `66e2a4690f31409c2e99502fcc1e91b8027749e4`. Workflow **FAILURE**.
- **Direct** (not product test failures):
  1. QA Final 신뢰 경계 Job [128192084990](https://github.com/planner77/masterGantt/actions/runs/42305023293/job/128192084990): `QA 경로 BLOCKED: PR 본문 qa_method의 명시값 필요`; `scripts/qa_final_automated.py:pr_field` requires one full-line `qa_method: OWNER_MANAGED` without backticks.
  2. QA Preflight Job [128192281867](https://github.com/planner77/masterGantt/actions/runs/42305023293/job/128192281867): `RISK_LEVEL`, `QA_METHOD`, `QA_REQUIRED` lacked unique standalone lines; `PATH_POLICY` consequently failed; `DOCUMENTATION_SYNC` lacked per-path machine-readable entries `- \`path\`: UPDATED|N/A(reason)`. AC coverage combined identifiers also needed individual AC1..AC10.
- **Derived/untested**: PR Fast Gate Job128192418656 failed because Preflight failure; Quality/E2E/Docker aggregate jobs report failure on skipped dependencies, not underlying application defects. Actual TypeScript/Vitest/Chromium E2E8/Docker smoke **SKIPPED / NOT TESTED**; do not treat aggregate FAIL as four independent product failures.
- **Collateral source audit finding**: first PR mistakenly replaced the 5,806-line `docs/TEST_PLAN.md` with a 644-character snippet. Not identified by CI directly; on PR source audit restore original main blob `c9318ac0f4904c2b4637c32b3c4f7d0c2aad31a6` and move new plan into `docs/ISSUE_881_TEST_PLAN.md`, with explicit `N/A(reason)` in Work Packet. No pre-existing test cases may be silently deleted.
- **Corrections**: preserve QA Owner Managed HIGH policy and Required3, correct PR description exact fields; Work Packet `DOCUMENTATION_SYNC` explicit path records and individual `AC_TEST_COVERAGE`; restore Test Plan; include KO/EN/VI fixed message catalog+unit, Settings cancel draft reset. Product code changes are proactive risk remediation, not a reported CI product bug.
- **Verification boundary**: old Run remains FAILURE; new Head's Full/Trusted status must be separately observed. At time of writing no new execution PASS is asserted. Review threads/conflicts should be read after commit, and no monitoring after PR CI starts.

## F881-002 — PR #884 Full #3538.1 실제 정적 검사·Migration 회귀 실패 (2026-11-07 KST)

- **원본:** [Full PR CI #3538.1 / Run 42308983093](https://github.com/planner77/masterGantt/actions/runs/42308983093), attempt=1, event=pull_request, Head `dce7decd73f9ca5cb8f2c0880238fddbf36e44af`, Base main `229604522969133d1ccc6de0477e373252670c86`, 결론 `failure`.
- **사전 게이트 PASS:** QA 경로 Job 128205438791, QA Preflight Job 128205565187, 정책/저장소 검사 Job 128205689029. F881-001의 policy/문서 실패는 재발하지 않음.
- **직접 FAIL 1 — TypeScript Job [128205688972](https://github.com/planner77/masterGantt/actions/runs/42308983093/job/128205688972):** `tests/fixtures/legacy-project.ts(24,3) TS2741`, historical `ProjectRecord` fixture에 필수 `workspaceTabs`가 없음. 교정: pre-0037 raw writer는 유지하되 테스트 메모리 반환 DTO에 기본 ON 세 값 명시.
- **직접 FAIL 2 — ESLint Job [128205689004](https://github.com/planner77/masterGantt/actions/runs/42308983093/job/128205689004):** `src/features/projects/project-readonly-view.tsx:317` `react-hooks/set-state-in-effect`(동기 상태 초기화)와 `:684` `react-hooks/preserve-manual-memoization`(누락된 `setMetadataWorkspaceTabs` dependency). 두 error/기존 18 warning; 경고를 새로운 FAIL로 취급하지 않음. 교정: 동기 effect setter를 취소 가능한 microtask로 이관하고 useCallback 의존성 보완; Gantt remount 등 금지 유지.
- **직접 FAIL 3 — Vitest Job [128205689035](https://github.com/planner77/masterGantt/actions/runs/42308983093/job/128205689035):** 304 files 중 11 failed/292 passed/1 skipped; 3,722 tests 중 **15 failed/3,704 passed/3 skipped**. 오류는 두 종류:
  1. 14개 migration 기대값/assertion 유형: 추가 migration `0037_project_workspace_tabs.sql` 때문에 기존 0036 최종 버전·단일/배열 실행 목록·총 36건을 고정해둔 과거 테스트 오차. `migration-cli`, `db/database`, `db/issue-623-target-migration`, `i18n/managed-display-names`, `logistics/logistics-targets-acceptance`, `logistics/task-target-bindings`, `process-catalog/process-catalog-service`, `process-catalog/process-context-service`, `projects/project-issues`, `resources/project-resource-memberships`의 최신 전체 적용 기대값을 37 기준으로 정렬. 역사적 **부분 migration**과 원본 체크섬은 변경하지 않음.
  2. `calendars/country-calendar-integration.test.ts`: 0034 파일에 0037 컬럼을 명시 INSERT하는 현재 ProjectRepository를 사용해 `SqliteError: table projects has no column named workspace_issue_visible`. 교정: 실제 pre-0037 파일은 test-only historical writer로 생성하고, migration 전후 **기존 컬럼만** 비교하면서 새 0037 플래그 3개가 DEFAULT ON인지 별도 확인.
- **회귀 검증 강화:** `db/database`와 `resources/project-resource-memberships`에서 pre-0037 기존 Project 행의 신규 플래그 default 1/1/1을 별도 검증하고, 원본 raw row 비교에서는 오직 `visibility` 및 0037 신설 컬럼만 제외한다. 이전 업무 테이블/Foreign key·데이터 원형, checksum/rollback/assertion은 보존한다.
- **파생 FAIL/NOT RUN:** PR 빠른 검사 Job 128206458336, Required Quality Job128206572612, E2E aggregate Job128206572725, Docker aggregate Job128206572374 및 QA Automated Job128206615179은 직접 TypeScript/Lint/Unit 실패 또는 필요한 Required 근거 부재의 **파생 실패**. Chromium E2E8, Docker implementation, Next.js production build는 **SKIPPED/NOT TESTED**, 제품 E2E·Docker 결함이 확인된 것은 아님.
- **조치·판정:** 모든 추가 테스트 변경은 기존 검사량을 줄이거나 실패를 skip하지 않고 additive 0037을 인정하는 최소 보완. `AGENTS.md`/기존 Required3/E2E8/QA/Owner gate·historical migration 파일·실패 결과 불변. GitHub 원격 수정만 수행하여 새 HEAD의 실제 TypeScript/ESLint/Vitest/E2E/Docker 결과는 PR CI 실행 전 **NOT TESTED**.
- **결과 경계:** 새 커밋/PR CI는 별도 현재 정확 Head/Run/Attempt로 기록. 이 이력은 성공 근거가 아니며 병합·Main CI·GHCR·이슈 종료에 승인 부여하지 않음.
