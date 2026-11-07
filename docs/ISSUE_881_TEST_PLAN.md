# Issue #881 — 테스트·운영 수용 계획 (2026-11-07)

이 문서는 대규모 공통 `docs/TEST_PLAN.md` 원문을 대체하지 않는다. #711의 기존 Test Lifecycle 정책을 그대로 따른다.

## TEST_LIFECYCLE_REVIEW

- KEEP_UNIQUE: `tests/server/projects/project-contract-security.test.ts`, `tests/server/projects/project-service.test.ts`, `tests/server/projects/project-visibility.test.ts`, `tests/server/projects/project-copy-service.test.ts`, `tests/features/project-workspace-navigation.test.ts` 및 기존 Gantt/Issue E2E.
- ADD: `tests/server/projects/project-workspace-tabs-881.test.ts` (Boolean strict validation, Project별 ON default·CAS 격리), `tests/features/project-workspace-navigation-881.test.ts` (hidden section URL/deeplink), `tests/lib/i18n-workspace-visibility-881.test.ts` (KO/EN/VI fixed labels).
- EXTEND: `tests/e2e/project-settings-dialog-layout.spec.ts` 화면 표시 저장·hidden 링크 fallback·복구. 중복 제거·skip·retry/timeout 완화 없음.
- 잔여 고위험: 실제 private read/edit session, Project Copy/template, 변경 동시성, 다른 브라우저 session, 기존 dirty editor/Issue dialog, 키보드 focus/ARIA, 모바일 390px·native 125%·screenreader 및 #880 View 병합 회귀.

## AC_TEST_COVERAGE

| AC | 검사 범위 | 현재 증거 |
|---|---|---|
| AC1 | migration 0037 기존 행 DEFAULT ON 및 신규 CREATE | source 검토, 원격 미실행 |
| AC2 | Project edit session 변경, all OFF/ON, 일정 항상 표시 | SQLite + Chromium E2E 추가, 원격 미실행 |
| AC3 | Project A/B 값 격리, 새 세션/재시작/새 브라우저 | SQLite 신규, 운영 미실행 |
| AC4 | 숨겨진 peer 탭/keyboard roving/ARIA 제거 | navigation unit, 실제 브라우저 미실행 |
| AC5 | URL/legacy/storage/내부 drill, dirty/pending/focus, Gantt instance | navigation unit 및 E2E 일부, 잔여 수동 검증 |
| AC6 | 기존 Issue·KPI·Master 데이터 보존 및 다시 ON | save/re-enable E2E 추가, 회귀 원격 미실행 |
| AC7 | 무세션·만료·타 프로젝트·Origin·If-Match·Boolean 악성 입력 | 기존 security suite + SQLite/Zod 신규, 실제 원격 미실행 |
| AC8 | Copy/template, 구 JSON/DB rollback/restart | copy source flags 수정, 후속 운영 검증 |
| AC9 | 390/768/1024/1440/1920, KO/EN/VI, keyboard, screenreader, native125% | KO/EN/VI dictionary/unit, 기기 검증 미실행 |
| AC10 | 기존 테스트 탐색/중복/라이프사이클 및 원격 필수 CI | Work Packet 기록, run 결과별 판정 필요 |

## Remote verification

- Exact PR Head의 Quality(TypeScript/Lint/Vitest/Build), Chromium E2E8, Docker smoke, Trusted QA, GitHub PR 리뷰/충돌 판정은 각각 별도 증거다.
- 최초 Full #3534.1은 Preflight에서 중단됐고 제품 테스트는 SKIPPED, PASS가 아니다.
- 제품 변경이 merge 되었을 때도 실제 배포·native125%·screenreader는 별도 OWNER_MANAGED 인수 대상이며 미실행을 PASS로 기록하지 않는다.

## F881-002 — 0037 migration E2E/Unit 실패 보완 (2026-11-07)

- Full #3538.1 / 42308983093 attempt1의 QA Preflight·정책은 PASS, TypeScript+Lint+Vitest 직접 FAIL. 15/3722 단위 테스트 실패와 원인을 [F881-002 원장](ISSUE_881_FAILURE_ANALYSIS.md)에서 정확히 구분한다.
- Historical SQL Fixture는 기존 스키마 버전 0034까지 INSERT하는 경우 프로젝트 신설 컬럼을 강제하지 않는다. Migration 후 원래 칼럼 동등성·추가 세 플래그 ON을 별개 검사한다.
- 전역 latest migration 시점의 test fixtures/expected migration lists/count만 0037까지 추가한다. migration source 파일/checksum/구버전<=24/25/26/27/28/32/33/35 이전 DB fixture는 변조하지 않는다.
- 실패했던 11개 test files: `tests/server/migration-cli.test.ts`, `tests/server/calendars/country-calendar-integration.test.ts`, `tests/server/db/database.test.ts`, `tests/server/db/issue-623-target-migration.test.ts`, `tests/server/i18n/managed-display-names.test.ts`, `tests/server/logistics/logistics-targets-acceptance.test.ts`, `tests/server/logistics/task-target-bindings.test.ts`, `tests/server/process-catalog/process-catalog-service.test.ts`, `tests/server/process-catalog/process-context-service.test.ts`, `tests/server/projects/project-issues.test.ts`, `tests/server/resources/project-resource-memberships.test.ts`; 15 assertion failures end-to-end. `tests/fixtures/legacy-project.ts` DTO defaults와 Gantt React-hook 오류를 함께 보완한다.
- Test Lifecycle: existing tests EXTEND or KEEP_UNIQUE; no skipped tests, no Expected failure marking, no disabled assertions. Actual new HEAD local Node/npm/Vitest/ESLint/Playwright unavailable; GitHub exact Full8/Required3 result NOT TESTED until run.

## F881-003 — 0037 목록 검증과 원본 비교 복구

- #3540.1 / 42312940879 (Attempt1, HEAD `d30bf51717de1a9f834ef6d6f412ae8506a169e9`): 3,722 Vitest 중 3 FAIL, 3,716 PASS, 3 SKIP. 정책/TypeScript/ESLint PASS. 마지막 남은 migration list 누락 3건이며 제품 migration 실패·업무 데이터 손상은 직접 관측되지 않았다.
- `tests/server/db/database.test.ts` 신규 schema와 legacy 0021 upgrade의 적용 migration 리스트에 0037을 추가하고, `tests/server/resources/project-resource-memberships.test.ts` legacy 0028 upgrade 기대 목록에 0037을 추가한다.
- Old Project row equality는 0031 `visibility` 및 새 0037 세 `workspace_*_visible` 컬럼만 명시적으로 제외한다. 원래 존재하던 컬럼과 관련 업무 테이블은 정확히 비교하고 추가 칼럼은 `1/1/1` default로 별도 assertion한다. 데이터 보존 보호를 느슨하게 하는 과도한 필드 제외/skip/후처리 삭제를 금지한다.
- 新 HEAD actual Vitest/TypeScript/ESLint/Chromium8/Docker·TrustedQA는 원격 PR CI 결과 전 NOT TESTED.

## F881-004 — 4개 Project Settings 탭의 keyboard·ARIA E2E (2026-11-07)

- Exact [Full #3542.1 / Run 42314053741](https://github.com/planner77/masterGantt/actions/runs/42314053741), Attempt1, HEAD `4d771854c2a4a49d249fa9c8cc64821d11a2caf9`: QA·정적 검사·unit·build·Docker PASS, Chromium shard8 #490 테스트 `End` 키 기대 `편집·보안` (구 3-tab) 오류로 FAIL. 제품은 현재 4-tab 구성의 네 번째 `화면 표시`로 정상 이동.
- EXTEND `tests/e2e/project-settings-layout-490.spec.ts`: 초깃값 tab count4; `일반→캘린더→End=화면 표시→ArrowLeft=보안→Home=일반` 키보드/aria-selected/focus 경계, 일반 초안 보존, 비밀번호 회전 PUT pending 중 `End→화면 표시→ArrowLeft→보안`의 안전성. 기존 원본 5폭/비밀번호/Origin/If-Match/401/412/timeout/escape 검증은 유지한다.
- EXTEND `tests/e2e/project-settings-dialog-layout.spec.ts`: #232 및 #881의 tab count4와 신규 `화면 표시` 활성화/포커스, End+ArrowLeft, 저장 후 기존 Issue·대시보드·기준정보 복구를 검사한다.
- E2E suite 등록·샤드 배치·timeout·skip·최종 E2E8 Required gate 불변. Retry 결과가 아니라 신 Head Full CI에서 실제 8/8 성공 근거가 필요하다.

## MAIN-001 — #880/881 two-source integration acceptance

- Branch PR #884 `eaa64b38f049a8cd2b48806c9ce3ccbf0e95f15b` and main `8f83083e01a79933d516ac200912de63c3cc45f6` are diverged from `229604522...` and overlap in Project Workspace, i18n and docs. Preserve both project-top-level visibility and schedule-internal WBS/Resource/설비 readonly View. Gantt Task Editor must retain canonical Task ID and scope/scroll after view/tab transitions.
- Updated i18n registry must include **both** `scheduleViewMessages` (#880) and `workspaceVisibilityMessages` (#881), with KO/EN/VI translations and no duplicate key overriding unrelated data.
- Latest Main 8-shard planner and #880 schedule-view source API, source tests, resource/equipment E2E, 0037 DB tests, #881 keyboard tests remain active. New merge Head needs exact full Quality + E2E8 + Docker and Trusted/Owner checks; source-level three-way hunks are not PASS.
- Prior #3546.1 shard7 #866 UI `Cancel disabled` timeout after 401 is unresolved. Keep original trace/run evidence, do not weaken timeout or disabled-state assertion merely to pass unrelated old failure. If it recurs, inspect isolated #866 flow separately.
- Test Lifecycle: KEEP_UNIQUE #880/#866/#881 scenario coverage; EXTEND Work Packet documentation and failure origin; 0 deleted, 0 skipped or relaxed tests.

## F881-006 — 4-tab focus ring viewport-transition regression

- 실패 provenance: [Full #3548.1 / Run 42326071407](https://github.com/planner77/masterGantt/actions/runs/42326071407), exact HEAD `65dc51c35bd26edccc5a7c8f79c01698f9bbc2e1`: Required Quality와 Docker PASS, shard8/8의 #490 테스트 `tab-display-focus`에서 focus ring right449가 scroll owner right357을 초과하여 390px clipping. E2E aggregate는 FAIL; other 7 shards CANCELLED.
- 제품 레이아웃: Project Settings 네 번째 `화면 표시` 탭은 48rem 이하에서 flex-wrap되며 CSS `6px` focus outline+offset은 기존대로 유지. Tab list 밖에 잘리거나 접근 불가능한 focus control이 없어야 한다.
- 핵심 회귀: 기존 #490 capture490('tab-display-focus') 390/768/1024/1440/1920 + `assertFocusVisible` 유지, #232/#881 프로젝트 설정 E2E에서 `End`로 네 번째 탭 focus 후 1440→390/768/1024/1440 리사이즈. Re-focus 없이 `toBeFocused()`, `aria-selected=true`, focused rect ± outline-inset inside owner, 문서 수평 overflow=0, 이후 Escape 닫기/restore focus 및 일반 설명 초안 보존을 검사.
- Existing #880 schedule source, Project API/SQLite, Test Lifecycle/Required E2E8/QA gates, E2E timeout 및 skip 설정은 변경하지 않는다. New CI 실행 전 결과 NOT TESTED; AT/native 125%는 별도 수동 인수.

## F881-007 — #3550.1 native checkbox geometry / focus

- [Run 42328258833](https://github.com/planner77/masterGantt/actions/runs/42328258833), HEAD `0d03b3b76ecf5814b0764ef126d72ad5624104d8`, Chromium shard8 E2E #490 `capture490("tab-display-focus")`: `assertIdentifiableInput` checks four text input border widths>=1px on 3 newly visible native checkboxes; 99 PASS, 1 FAIL, 13 NOT RUN; other 7 shards CANCELLED, E2E/QA aggregate downstream FAIL. Quality/Docker and other static jobs PASS on old HEAD only.
- Product: Settings display choices use dedicated `visibilityOption` label with native checkbox size20px, 44px label height, focus-visible and no text-field width100%/padding inheritance. No changed Project flags, permission, persistence, auth, Gantt, or workflow logic.
- EXTEND #490 fixture: text inputs retain strict border/background checks; checkbox/radio retain label association, intrinsic 16~32px, appearance!=none and existing 5-width visibility/focus. EXTEND #232/#881 browser: 3 checked boxes with 18~28px/44px labels; native keyboard Tab-focus ring and Space OFF->ON; original End/ArrowLeft, 390/768/1024/1440/1920, Escape/draft/save/restore remain. Neither tests nor E2E job contracts skipped/weakened. Source-only static diff inspection is **NOT TESTED** for new exact HEAD's Full CI. Native 125% / AT remain manual.
\n## MAIN-881-001 — Main trace 실패의 비문서 교정 회귀\n\n- 기존 #582/#586/#603/#639/#808/#825/#854의 `scripts/verify-issue-lifecycle.py`와 `main_ci_run_name.py` 시나리오를 먼저 검색함. `TEST_LIFECYCLE_REVIEW=EXTEND`: 같은 검증 스크립트에 실제 Main #3552.1의 여러 줄 `head_commit.message`를 거부하는 negative, `merge_api_payload`가 올바른 한글 한 줄 제목과 **빈 commit_message**, exact Head SHA lease를 반환하는 positive를 추가. `KEEP_UNIQUE`: Project SQLite/권한/E2E8 및 기존 Main/Release 관련 보호 회귀. 기존 정책, 실행 취소/Skip/Retry/Timeout 완화 0.\n- 교정 PR은 수정 범위가 제품 코드가 아닌 test-guard + 문서이지만 `scripts/**`를 실제 수정한 **non-docs correction**. 동일 #881 Main 실패 commit과 contiguous 후속 PR의 scope가 자동 Finalizer에 의하여 검증되기 전 원본 release 의무를 임의 완료 처리하지 않는다.\n- 원본 Run42345455498 직접 trace failure, Quality/E2E8/Docker implementation NOT RUN, GHCR NOT RUN. 변경 HEAD의 PR Full/Trusted/새 Main source/registry는 각 Run이 완료되기 전 `NOT TESTED`. 테스트 요구 AC10 정책/실패 attribution/출처, AC1~9 제품 기능의 기존 positive/negative 수용증거는 원본 #3551.1 출처 그대로 보존한다.\n