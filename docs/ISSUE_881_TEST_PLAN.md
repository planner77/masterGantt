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
