# Issue #792 — 기존 물류 원본 관계 안전 편집 및 운영 이관 검증

## 실행 계약 / 근거

- Primary Issue: https://github.com/planner77/masterGantt/issues/792
- 선행: [#785 원본·호환 설계](ISSUE_785.md), [AGENTS](../../../AGENTS.md), [DESIGN](../../../DESIGN.md), [Lifecycle](../../ISSUE_LIFECYCLE.md), [Test Plan](../../TEST_PLAN.md), [운영 절차](../../TARGET_RESOURCE_OPERATIONS.md), [SVAR Custom Editor](https://docs.svar.dev/react/gantt/guides/ui-layout/editor/).
- Baseline `main=b45885812301d14b9f673841e9944b27b2642323` (2026-10-24 확인), branch `feat/issue-792-legacy-source-scope-safety`.
- 위험 `HIGH` / `qa_required=true` / `qa_method=OWNER_MANAGED`; 독립 인간 QA `NOT TESTED`(대체 Trusted 경로), Manager exact Head 승인 `NOT TESTED`. 새 Head `MERGE_READY=BLOCKED`.
- `release_required=true`(사용자 접근 UI/API), `release_authorized=false`; 현행 0.131.0 유지. 후속 릴리스 버전/게시 결정은 #785 안정화·Owner 승인 이후. 이 구현의 PR CI 시작 자체가 릴리스 승인 아님.
- 이번 승인 범위: 분석·코드·테스트·문서·리뷰 및 충돌 조사·이슈별 원장·**PR Full CI 시작**. CI 모니터링, merge/main/GHCR/Release/Finalizer, Issue close 금지.
- 구현 조직: Github connector를 사용한 Manager 단일 순차 구현. 독립 code/UX/reviewer 또는 오프호스트 DB 운영 검증이 실행되었다고 주장하지 않는다.

## 분석: 현행 원본·허용 범위

#785는 공개 Target CRUD/Binding writer를 410으로 퇴역시키면서 `logistics_targets`, `logistics_target_members`, `task_target_bindings`, `task_target_binding_members` 원본, `whole/subset+coverage`, `Summary self/subtree`, Copy/Template archive, 임의 Project 직접 관계를 보존하였다. `loadBoundedTaskLogisticsSnapshot`과 `resolveTaskTargetBindings`는 read-only 해석·출처 보존이다. 공용 Task Editor의 기존 출처 목록은 읽기 전용이었으며, 지원된 신규 직접 Equipment/System writer는 기존 source UUID나 coverage를 바꿀 수 없다.

안전 편집의 시작은 가장 작은 복원 가능한 작업인 **기존 Summary의 직접 레거시 바인딩 한 건의 `scope` 수정**으로 한정한다. `selection`, 선택 member, coverage, `target_id`, `task_id`, 원본 binding UUID, 공정·WorkArea context와 직접 Equipment/System 연결은 수정하지 않는다. `whole`은 계속 현재 member 집합을 동적으로 계산한다. 비 Summary·상속 provenance·깨진 FK·외부 Project·원본 없는 Task는 fail-closed. 다른 관계 편집/원본 Target 구성 편집/자동 실물 마이그레이션·DDL·DROP·backfill은 미지원이다.

### 데이터 흐름

1. `GET /api/projects/{projectId}/tasks/{taskId}/legacy-binding-sources`: 정확 Task의 **직접 소스만** 목록 + 현재 Project revision, sourceFingerprint, 가능 범위. inherited/effective 집계와 직접 writer를 혼합하지 않는다.
2. `POST` preview: 정확 Origin, Edit Session, strong If-Match를 확인하고, 원본 source fingerprint·Project revision/Task 유형·source와 `loadBoundedTaskLogisticsSnapshot` integrity·한도 점검. 변경 전/후 domain resolver로 실제 영향 Task IDs 및 타입별 수를 계산하여 읽기 전용 확인 토큰(이 snapshot과 desired scope 해시)을 발급. Preview에서 DB/revision 변경 0.
3. `PATCH` apply: 다시 auth/version/source/후보 전체를 IMMEDIATE transaction 안에서 계산하고 preview token 재검증. 원본 `task_target_bindings.scope`/updated_at **단일 행 업데이트** 뒤 예상 graph 동일성을 재조회해 검증하고 Project revision 정확 1회 증가. 실패 시 SQLite transaction 전체 rollback.
4. Task Editor의 `기존 연결 출처`에서 **Summary 직접 출처만** 범위 수정 진입, source/범위 선택→변경 작업 수 미리보기→명시 확인→저장. 읽기 전용·dirty/pending·권한 없는 경우 disabled. 원본 읽기/수정 오류는 빈 배열로 바꾸지 않고 fail-closed. 사용자 키보드·반응형 검증은 실제 원격 Chromium 및 수동 검토로 분리한다.
5. 구 `/target-bindings`, `/logistics/targets` 공개 경로는 계속 410이며 새로운 숨은 Target 작성, Base SVAR Gantt writer, WBS Task duplication, Assignment 변경이 없다.

### 변경 소유 파일

- 서비스 `src/server/logistics/legacy-binding-scope-service-core.ts`
- 권한/HTTP `src/server/logistics/legacy-binding-scope-handlers-core.ts`
- Route `src/app/api/projects/[publicId]/tasks/[taskId]/legacy-binding-sources/route.ts`
- 보안 inventory `src/server/security/route-security-inventory.ts`
- Task Editor `src/features/gantt/legacy-binding-scope-editor.tsx`와 `task-logistics-link-editor.tsx`
- 테스트 `tests/server/logistics/task-target-bindings-handlers.test.ts` (기존 Fixture·Assertion을 확장)
- 관련 API/Domain/DB/Task/UX/Security/운영·TEST_PLAN/CHANGELOG/PLAN/실패 원장 문서는 본 Issue 계약에 동기화.

## AC_TEST_COVERAGE

| AC | 증거·테스트 | 판정·잔여 |
| --- | --- | --- |
| AC1 원본 출처/권한 | 본 조사·#785 source tables, `legacy-binding-scope-service-core.ts`, GET source fingerprint·실물 원본 | 설계/코드 반영. 실행 NOT TESTED |
| AC2 안전 편집/원자성/역전 | 기존 `task-target-bindings-handlers.test.ts`에 whole/subset 단일 scope preview·원본 row·member/UUID invariant·후행 inheritance·foreign key 확인 | **scope만 구현**; 다른 원본 편집과 자동 변환·오프호스트 복구 미지원 |
| AC3 401/403/409/412/422/FK/경합 | 동일 HTTP 테스트의 Origin/Session/If-Match/unknown/missing/fingerprint/confirmation, SQLite transaction, 기존 #617/#623/#785 원본 완전성 회귀 | 실제 HTTP/SQLite/restart/동시성 확대 검증과 원격 실행 NOT TESTED |
| AC4 운영 소비자/백업/복구 | `TARGET_RESOURCE_OPERATIONS.md` 의 source count·consumer inventory·offhost backup/restore/restart·pre/post hash·Owner 승인 체크리스트 | 운영 DB, 외부 caller 계정/로그, off-host restore **NOT TESTED / 별도 실행** |
| AC5 UI·v2·교환·중복/이탈 | Task Editor 기존 compatibilityLinks + 신규 미리보기, #785/#623 Tests, `task-logistics-link-editor.tsx`, resource/WBS/Copy/Template/Excel의 원본불변 근거 | 신규 API 경로는 v2 집계 DTO에 영향 없음. 별도 UI 390/768/1024/1440/1920·focus/E2E/Excel 검증 NOT TESTED |
| AC6 Quality/E2E8/Docker/Trusted | non-draft PR Full CI; 신뢰된 base QA, Review Threads 0, strict main, Owner HIGH 수용 | 새 exact Head 원격 실행 시작까지만 승인; 결과/승인 NOT TESTED |

**TEST_LIFECYCLE_REVIEW:** 검색: `tests/server/logistics/task-target-bindings*.test.ts`, `tests/server/projects/issue-785-exchange.test.ts`, `tests/e2e/issue-726-task-logistics.spec.ts`, `tests/e2e/logistics-target-authoring.spec.ts`, `tests/server/resources/resource-public-v2.test.ts`, `tests/server/projects/resource-excel-export.test.ts`. `EXTEND`: #617/#785의 동일 SQLite·세션·legacy fixture에 scope PATCH positive/negative를 추가(동일 UUID와 member row). `KEEP_UNIQUE`: 실제 HTTP, broken FK/transaction, Copy/Template, whole/subset coverage, 리소스 WBS 계산, OOXML, 실제 브라우저5폭·focus; 이 독립 보호는 통합·삭제하지 않는다. `PARTIAL_OVERLAP`: 기존 #785 readonly 출처 조회와 새 writer/확인 경계는 겹치나 독립 책임이다. `ADD`: 신규 endpoint 및 source-aware UI; `CONSOLIDATE_CANDIDATE=없음`, `RETIRE_CANDIDATE=없음`. CI/E2E skip, timeout, Required gate 변경0.

## 운영 dry-run / 검증 범위

**이번 Github 커넥터에서는 운영 DB나 내부 로그·호스트 볼륨·Docker·실제 브라우저를 실행할 수 없다.** 코드 검토/정적 문서 작업을 PASS로 승격하지 않는다. 적절한 전용 runner에서 frozen Head를 checkout해 `npm ci`, `npm run typecheck`, `npm run lint`, `npm test -- --run tests/server/logistics/task-target-bindings-handlers.test.ts` (CLI 옵션은 package/vitest와 일치 확인), `npm run build`, 관련 Playwright/SQLite restart·8-shard Full 실행을 별도로 확인한다.

오프호스트 격리 DB의 `PRAGMA integrity_check`/foreign_key_check, `sqlite_schema` checksum, migration ledger, source row IDs/count/column별 hash, Copy/Template·resource/WBS/Excel raw Task/Assignment, HTTP 410·신규 GET/POST/PATCH auth, rollback/restart를 before/after 비교한다. 운영 consumer 보유처·접속 실제 횟수·차단 응답 impact를 확인하고 운영 데이터 이관/레거시 폐기 승인은 별도 Owner 결정으로 유지한다.

## DOCUMENTATION_SYNC / N/A

UPDATED: 본 Packet, `docs/LOGISTICS_DOMAIN_DESIGN.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/SECURITY.md`, `docs/TASK_EDITOR.md`, `docs/UI_UX_GUIDELINES.md`, `docs/TARGET_RESOURCE_OPERATIONS.md`, `docs/TEST_PLAN.md`, `CHANGELOG.md`, `docs/exec-plans/active/PLAN.md`, 별도 `docs/ISSUE_792_FAILURE_ANALYSIS.md`.

N/A(reason): `AGENTS.md`, `DESIGN.md` 정책·색/형상 변경 없음(본 파일이 구현 지침). `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/REMOTE_VALIDATION.md`, `.github/workflows/**`은 기존 Full8/Required3/Trusted/Owner/Finalizer 규칙 불변. `docs/IMPORT_SCHEMA.md`, `docs/JSON_IMPORT.md`, `docs/IMPORT_EXPORT.md`, `docs/ISSUE_27_PROJECT_COPY.md`, `docs/EXCEL_EXPORT.md`은 지원 직렬화·프로젝트 Copy/Template·공수 시트 변경 없음; 기존 #785 원본 보존 테스트 유지. `docs/SCHEDULING_ENGINE.md`은 일정·SVAR writer 불변. `docs/DEPLOYMENT.md`는 DDL/Compose/배포 계약 불변; 실제 운영 검증은 이번 운영 절차에 별도 기록.

## PR·실패 누적 원장 인계

변경 source의 로컬 Node/Chromium/Docker 검증 `NOT TESTED`. Commit별 SHA와 원격 PR 번호/Head/Run/Attempt는 확인된 값만 Issue/PR STATUS·[실패 원장](../../ISSUE_792_FAILURE_ANALYSIS.md)에 갱신한다. `PR CI Started`는 성공·QA 승인·MERGE_READY가 아니다. 추가 실패 시 원인/직접 실패·파생/취소·로그 출처·시도·교정/새 Head를 동일 원장에 누적하고 최초 기록을 지우지 않는다.
