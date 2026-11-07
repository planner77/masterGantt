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

## F881-003 — PR #884 Full #3540.1 마지막 3개 migration 회귀 기대값 미반영 (2026-11-07 KST)

- **원본:** [PR CI #3540.1 / Run 42312940879](https://github.com/planner77/masterGantt/actions/runs/42312940879), Attempt 1, `pull_request`, PR #884, Head `d30bf51717de1a9f834ef6d6f412ae8506a169e9`, Base main `229604522969133d1ccc6de0477e373252670c86`, **FAILURE**.
- **직접 PASS:** 변경 경로 판정 Job128218538829, QA 신뢰 경계 Job128218539110, Preflight Job128218645665, ESLint Job128218752869, TypeScript Job128218752983, 정책/저장소 검사 Job128218752969. 즉, 기존 F881-001 정책 서식과 F881-002 TypeScript/ESLint 직접 결함은 새 소스에서 재발하지 않았다.
- **단일 직접 실패 계통:** [Vitest Job128218752910](https://github.com/planner77/masterGantt/actions/runs/42312940879/job/128218752910)의 `npm test`가 304 test files 중 2 failed/301 passed/1 skipped, 3,722 tests 중 **3 failed/3,716 passed/3 skipped**로 종료.
  1. `tests/server/db/database.test.ts:145`: 0021→현재 업그레이드 후 적용 파일 목록에서 `0037_project_workspace_tabs.sql` 1건 추가를 기대하지 않음.
  2. `tests/server/db/database.test.ts:163`: 최신 전체 신규 DB migration 적용 목록에서 마지막 `0037` 누락.
  3. `tests/server/resources/project-resource-memberships.test.ts:328`: 0028→현재 업그레이드 후 적용 파일 목록에서 마지막 `0037` 누락.
  각 원본 assertion diff는 배열 끝의 `+ "0037_project_workspace_tabs.sql"` 한 줄만 보고한다. Migration SQL 실행/데이터 변형 자체가 실패한 것이 아니다.
- **원인:** 이전 F881-002 보완에서 두 파일의 신규 0037 플래그 기본 ON 검증은 추가했지만, 동일 파일의 **최신 migration 전체 목록 기대값**과 레거시 원본 비교 시 새 컬럼 제외 목록을 갱신하지 못했다. 재실행 없이 PASS 선언 금지.
- **교정:** 위 두 테스트의 기존 `"0036_display_name_translations.sql"` 이후 `"0037_project_workspace_tabs.sql"`을 명시 추가(각각 2·1곳), **원본 행 동등성 비교 시에만** `visibility`와 0037 신설 세 컬럼을 정확한 allowlist로 제외한다. 데이터 보존의 다른 모든 컬럼·테이블과 FOREIGN KEY, 신규 1/1/1 default 검사, 전체/부분 migration checksum/rollback 검증은 그대로 유지한다.
- **파생 FAIL/실행 범위:** PR 빠른 검사 Job128219428232, Required Quality aggregate Job128219535685, E2E aggregate Job128219535684, Docker aggregate Job128219535577 및 QA Automated Job128219565293은 직접 Vitest 실패에 따른 후속 결과. Chromium E2E8, Docker 구현, Next production build는 **SKIPPED / NOT TESTED**이고 그 자체의 제품 결함 원인은 관측되지 않았다.
- **테스트 수명주기:** `TEST_LIFECYCLE_REVIEW=EXTEND` (기존 두 migration 회귀 테스트만 보강), `KEEP_UNIQUE` (그 외 테스트 보존); 삭제·skip·timeout/retry/required-check 약화 없음.
- **검증 경계:** 보완 커밋은 새 Head로 별도 Full CI를 시작해야 검증된다. 최초 #3534.1, #3538.1, #3540.1 실패는 모두 원장에 보존하며 이전 PASS를 신규 HEAD로 이월하지 않는다. 병합/Main/GHCR/Release/Issue 종료 미승인.

## F881-004 — PR #884 Full #3542.1: E2E #490 설정 탭 End/Home 회귀 (2026-11-07 KST)

- **원본:** [Full PR CI #3542.1 / Run 42314053741](https://github.com/planner77/masterGantt/actions/runs/42314053741), Attempt 1, `pull_request`, PR #884, Head `4d771854c2a4a49d249fa9c8cc64821d11a2caf9`, Base `229604522969133d1ccc6de0477e373252670c86`. Conclusion `FAILURE`, 원본 기록 불변.
- **직접 통과:** QA 경로 Job128222241122, Preflight Job128222415093, 정책 Job128222544808, TypeScript Job128222544726, ESLint Job128222544857, Vitest Job128222544703, PR Fast Gate Job128223270192, Next Production Build Job128223368340, Required Quality Job128224039726, Docker implementation Job128223368343, Required Docker Job128224820988 모두 `success`. F881-001~003의 직접 정책·정적 검사·migration 실패가 재발하지 않았다는 근거이며, 이후 새 HEAD에 PASS를 승계하는 것은 금지한다.
- **단일 직접 실패:** [Chromium shard 8/8 Job128223368602](https://github.com/planner77/masterGantt/actions/runs/42314053741/job/128223368602), Playwright `--max-failures=1`, 99건 성공 후 #100 `tests/e2e/project-settings-layout-490.spec.ts:10` (Issue #490 기본정보/보안/readonly 인증/5폭) 실패. 해당 test line20: `page.keyboard.press("End"); expect(편집·보안).toBeFocused()` → 5초 timeout. 런타임 DOM에서 `편집·보안`은 `aria-selected=false`, `tabindex=-1`. #881이 기존 설정 세 탭 뒤에 네 번째 `화면 표시`를 추가했기 때문에 **End는 마지막 네 번째 탭으로 정상 이동**, 구버전 세 탭 중심 E2E oracle이 잘못된 상태. `ProjectSettingsDialog.handleTabKeyDown`은 `End`를 `TABS.length-1`로 처리하므로 제품의 키보드 정책은 요구사항과 일치한다.
- **후속 차단:** 다른 Shard 1·3·4·5·6·7은 fail-fast로 `cancelled`, Shard 2는 `success`; Required Chromium aggregate Job128229749679과 QA Automated Job128229788935는 완전한 E2E8 증거가 없어 파생 `failure`. 전체 Chromium8 PASS가 아님. E2E 결함을 다른 취소 Shard의 결함으로 추정하지 않는다.
- **수정:** `tests/e2e/project-settings-layout-490.spec.ts` 안의 **End 기대 4곳 전부**(기본/캘린더/보안 키보드, 비밀번호 변경 실제 PUT pending)를 정확한 새 탭 순서 `일반 → 캘린더 → 편집·보안 → 화면 표시`로 전환한다. `End`는 `화면 표시`가 포커스/선택되어야 하고, `ArrowLeft`로 `편집·보안`으로 돌아와 기존 보안 패널 검증·비밀번호 pending/취소 동작을 그대로 지속한다. `tests/e2e/project-settings-dialog-layout.spec.ts`에는 4개 탭·End/ArrowLeft·ARIA 및 기존 설명 초안 보존을 강화한다.
- **TEST_LIFECYCLE_REVIEW:** `EXTEND` 기존 #490/#232 Playwright 두 파일. 기존 인증/Origin/If-Match/5폭/Native focus/dirty/pending/실제 password rotation/정상·오류 케이스 삭제·skip·timeout 증가·assertion 약화 0. 새 탭 의미상 변경된 목적지에 더 구체적인 포커스/선택 assertion 추가.
- **코드·정책 경계:** Project Settings source의 `End=TABS.length-1` 로직은 유지, 기존 Migration 0037/Project 권한, User read gate, AGENTS.md, Required Quality/E2E8/Docker 및 QA 보호 정책 수정 없음. 아래 새 HEAD의 실제 E2E8과 원격 전체 required 결과는 CI 재검증 전 **NOT TESTED**. 수동 screenreader/125%·운영 확인은 별도.
- **후속:** 새 Head와 Run/Attempt로 Full PR CI를 시작하되 요청대로 모니터링하지 않는다. PR/Issue OPEN, Owner 수용·병합/Main/GHCR/Release/Finalizer/종료 미승인.
