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

안전 편집의 시작은 가장 작은 복원 가능한 작업인 **기존 Summary의 직접 레거시 바인딩 한 건의 `scope` 수정**으로 한정한다. `selection`, 선택 member, coverage, `target_id`, `task_id`, 원본 binding UUID, 공정·WorkArea context와 직접 Equipment/System 연결은 수정하지 않는다. `whole`은 계속 현재 member 집합을 동적으로 계산한다. 비 Summary·상속 provenance·깨진 FK·외부 Project·원본 없는 Task는 fail-closed. `self→subtree` 확대 시 비활성 Target/member를 신규 inherited 출처로 퍼뜨리지 않고, 신규 영향 경로 수가 제한 초과 시 preview 422 차단한다. 다른 관계 편집/원본 Target 구성 편집/자동 실물 마이그레이션·DDL·DROP·backfill은 미지원이다.

### 데이터 흐름

1. `GET /api/projects/{projectId}/tasks/{taskId}/legacy-binding-sources`: 정확 Task의 **직접 소스만** 목록 + 현재 Project revision, sourceFingerprint, 가능 범위. inherited/effective 집계와 직접 writer를 혼합하지 않는다.
2. `POST` preview: 정확 Origin, Edit Session, strong If-Match를 확인하고, 원본 source fingerprint·Project revision/Task 유형·source와 `loadBoundedTaskLogisticsSnapshot` integrity·한도 점검. 변경 전/후 domain resolver로 실제 영향 Task IDs 및 타입별 수를 계산하되 후보 subtree provenance 경로도 미리 상한 검사하여 읽기 전용 확인 토큰(이 snapshot과 desired scope 해시)을 발급. Preview에서 DB/revision 변경 0.
3. `PATCH` apply: 다시 auth/version/source/후보 전체를 IMMEDIATE transaction 안에서 계산하고 preview token 재검증. 원본 `task_target_bindings.scope`/updated_at **단일 행 업데이트** 뒤 예상 graph 동일성을 재조회해 검증하고 Project revision 정확 1회 증가. 실패 시 SQLite transaction 전체 rollback.
4. Task Editor의 `기존 연결 출처`에서 **Summary 직접 출처만** 범위 수정 진입, source/범위 선택→변경 작업 수 미리보기→명시 확인→저장. 읽기 전용·dirty/pending·권한 없는 경우 disabled. 원본 읽기/수정 오류는 빈 배열로 바꾸지 않고 fail-closed. 사용자 키보드·반응형 검증은 실제 원격 Chromium 및 수동 검토로 분리한다.
5. 구 `/target-bindings`, `/logistics/targets` 공개 경로는 계속 410이며 새로운 숨은 Target 작성, Base SVAR Gantt writer, WBS Task duplication, Assignment 변경이 없다.

### 변경 소유 파일

- 서비스 `src/server/logistics/legacy-binding-scope-service-core.ts`
- 권한/HTTP `src/server/logistics/legacy-binding-scope-handlers-core.ts`
- Route `src/app/api/projects/[publicId]/tasks/[taskId]/legacy-binding-sources/route.ts`
- 보안 inventory `src/server/security/route-security-inventory.ts`
- Task Editor `src/features/gantt/legacy-binding-scope-editor.tsx`와 `task-logistics-link-editor.tsx`
- 테스트 `tests/server/logistics/task-target-bindings-handlers.test.ts` (기존 Fixture·Assertion을 확장), `tests/server/logistics/task-target-bindings.test.ts` (실제 Equipment quantity/coverage와 전·후방 적용·복원), `tests/e2e/issue-726-task-logistics.spec.ts` (실제 브라우저·격리SQLite·새 UI/5폭/readonly)
- 관련 API/Domain/DB/Task/UX/Security/운영·TEST_PLAN/CHANGELOG/PLAN/실패 원장 문서는 본 Issue 계약에 동기화.

## AC_TEST_COVERAGE

| AC | 증거·테스트 | 판정·잔여 |
| --- | --- | --- |
| AC1 원본 출처/권한 | 본 조사·#785 source tables, `legacy-binding-scope-service-core.ts`, GET source fingerprint·실물 원본 | 설계/코드 반영. 실행 NOT TESTED |
| AC2 안전 편집/원자성/역전 | 기존 `task-target-bindings-handlers.test.ts`와 `task-target-bindings.test.ts`에 whole/subset scope preview·원본 row·member/UUID/coverage=4 invariant·후행 inheritance·역방향 복원·foreign key 확인 | **scope만 구현**; 다른 원본 편집과 자동 변환·오프호스트 복구 미지원 |
| AC3 401/403/409/412/422/FK/경합 | 동일 HTTP 테스트의 Origin/Session/If-Match/unknown/missing/fingerprint/confirmation, SQLite transaction, 기존 #617/#623/#785 원본 완전성 회귀 | 실제 HTTP/SQLite/restart/동시성 확대 검증과 원격 실행 NOT TESTED |
| AC4 운영 소비자/백업/복구 | `TARGET_RESOURCE_OPERATIONS.md` 의 source count·consumer inventory·offhost backup/restore/restart·pre/post hash·Owner 승인 체크리스트 | 운영 DB, 외부 caller 계정/로그, off-host restore **NOT TESTED / 별도 실행** |
| AC5 UI·v2·교환·중복/이탈 | Task Editor 기존 compatibilityLinks + 신규 미리보기, #785/#623 Tests, `task-logistics-link-editor.tsx`, resource/WBS/Copy/Template/Excel의 원본불변 근거 | 신규 API 경로는 v2 집계 DTO에 영향 없음. 별도 UI 390/768/1024/1440/1920·focus/E2E/Excel 검증 NOT TESTED |
| AC6 Quality/E2E8/Docker/Trusted | non-draft PR Full CI; 신뢰된 base QA, Review Threads 0, strict main, Owner HIGH 수용 | 새 exact Head 원격 실행 시작까지만 승인; 결과/승인 NOT TESTED |

- AC1: #785 archive/직접 연결 전수 구분, legacy 원본 Task 및 Scope/Origin/Auth/Revision 계약 — legacy-binding-scope-service-core.ts와 docs/API.md; 외부 소비자 실측 NOT TESTED.
- AC2: 기존 source UUID·whole/subset/coverage·equipment quantity 및 self/subtree 효과·복원, 인플레이스 저장·rollback — task-target-bindings*.test.ts 확장; 실행 NOT TESTED, 운영 대량 이관 미지원.
- AC3: 401/403/409/412/422/428, stale token·비활성/외부 source·orphan·body race·SQLite restart와 P1 pending 동안 Task Editor 잠금 — 기존 HTTP Unit 및 #726 지연 PATCH E2E, 실행 NOT TESTED.
- AC4: consumer 전환 사용량과 오프호스트 backup/digest/restore/restart, 운영 승인 — TARGET_RESOURCE_OPERATIONS.md G0-G4 runbook, 운영 자료 접근 없어 NOT TESTED.
- AC5: 원본 source 및 Task Editor 5폭/readonly·동적 WBS/Resource/Copy/Template/Excel 계약, delayed-PATCH 중 초안 소실 방지 — #726 E2E/관련 단위 시험 및 TEST_PLAN, 브라우저 실행 NOT TESTED.
- AC6: 정확 새 Head의 Full Quality/Chromium8/Docker, Trusted QA와 Owner HIGH 승인 및 릴리스 판단 — CI 새 Run 시작 후 판정, 완료/수용 NOT TESTED.
- AC7: **상위 Issue #785의 역사적 `AC7 이관·교환` 참조 추적 전용 — #792의 신규 독립 수용 기준을 추가하는 것이 아님.** #792 본문 도입부의 `AC4/AC7`은 [상위 #785 AC7](https://github.com/planner77/masterGantt/issues/785)의 fresh/upgraded/legacy SQLite·backup/restore/restart·Copy/Template·JSON/Excel 원본 무손실·revert 요구사항을 가리킨다. #792에서는 AC2(scope self↔subtree 한 행의 UUID·member·coverage·provenance 보존 및 역전 테스트), AC4(운영 DB/외부 소비자·오프호스트 backup/restore 실증 보류), AC5(Copy/Template/Excel/JSON 기존 계약 유지)의 **기존 증거에만 매핑**한다. 운영 SQLite off-host 복구·전체 레거시 이관/퇴역 및 교환 무손실 실증은 **NOT TESTED/BLOCKED**, 자동 변환·데이터 삭제·추가 구현 승인 아님. `qa_final_automated.py::docs_gate`가 Issue 전문의 `\\bAC\\d+\\b`를 수집하므로 이 historical link도 명시적으로 대응한다.

## TEST_LIFECYCLE_REVIEW

 검색: `tests/server/logistics/task-target-bindings*.test.ts`, `tests/server/projects/issue-785-exchange.test.ts`, `tests/e2e/issue-726-task-logistics.spec.ts`, `tests/e2e/logistics-target-authoring.spec.ts`, `tests/server/resources/resource-public-v2.test.ts`, `tests/server/projects/resource-excel-export.test.ts`. `EXTEND`: #617/#785의 동일 SQLite·세션·legacy fixture에 scope PATCH positive/negative를 추가(동일 UUID와 member row). #726 기존 실제 Playwright/격리 SQLite source fixtures에 Summary source-only 범위 조정·5폭·readonly·실제 HTTP source provenance를 확장한다. 기존 8shard 배치 파일을 추가하지 않는다. `KEEP_UNIQUE`: 실제 HTTP, broken FK/transaction, Copy/Template, whole/subset coverage, 리소스 WBS 계산, OOXML, 실제 브라우저5폭·focus; 이 독립 보호는 통합·삭제하지 않는다. `PARTIAL_OVERLAP`: 기존 #785 readonly 출처 조회와 새 writer/확인 경계는 겹치나 독립 책임이다. `ADD`: 신규 endpoint 및 source-aware UI; `CONSOLIDATE_CANDIDATE=없음`, `RETIRE_CANDIDATE=없음`. CI/E2E skip, timeout, Required gate 변경0.

## 운영 dry-run / 검증 범위

**이번 Github 커넥터에서는 운영 DB나 내부 로그·호스트 볼륨·Docker·실제 브라우저를 실행할 수 없다.** 코드 검토/정적 문서 작업을 PASS로 승격하지 않는다. 적절한 전용 runner에서 frozen Head를 checkout해 `npm ci`, `npm run typecheck`, `npm run lint`, `npm test -- --run tests/server/logistics/task-target-bindings-handlers.test.ts` (CLI 옵션은 package/vitest와 일치 확인), `npm run build`, 관련 Playwright/SQLite restart·8-shard Full 실행을 별도로 확인한다.

오프호스트 격리 DB의 `PRAGMA integrity_check`/foreign_key_check, `sqlite_schema` checksum, migration ledger, source row IDs/count/column별 hash, Copy/Template·resource/WBS/Excel raw Task/Assignment, HTTP 410·신규 GET/POST/PATCH auth, rollback/restart를 before/after 비교한다. 운영 consumer 보유처·접속 실제 횟수·차단 응답 impact를 확인하고 운영 데이터 이관/레거시 폐기 승인은 별도 Owner 결정으로 유지한다.

## DOCUMENTATION_SYNC

- `AGENTS.md`: N/A(기존 Manager와 Agent 역할 및 QA 검증 게이트의 지침을 그대로 적용하며 지침 자체는 바꾸지 않음)
- `DESIGN.md`: N/A(현행 compact Task Editor와 상태 잠금의 기존 공통 UI 원칙을 구체화할 뿐 디자인 시스템 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 Owner-managed 신뢰 QA, 별도 위험 수용 및 리뷰 해결 규칙을 그대로 유지함)
- `docs/CI_CD.md`: N/A(기존 Full CI Required3 및 Chromium 8샤드, Preflight 정책·워크플로 구조 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 PR 브랜치·병합/원격 CI 출처와 검증 권한 운영 계약은 변동 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(현행 원격 Quality·E2E·Docker·Trusted 증거 취합 계약을 그대로 사용하며 gate 변경 없음)
- `docs/TEST_PLAN.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/TARGET_RESOURCE_OPERATIONS.md`: UPDATED
- `docs/exec-plans/active/ISSUE_792.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/ISSUE_792_FAILURE_ANALYSIS.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: N/A(현재 이슈 Lifecycle 상태와 병합/Finalizer 권한 계약을 변경하지 않음)
- `docs/IMPORT_SCHEMA.md`: N/A(지원 JSON Import 필드와 현재 교환 스키마의 의미를 변경하지 않음)
- `docs/JSON_IMPORT.md`: N/A(레거시 그래프의 지원 JSON Import 범위를 넓히거나 변경하지 않음)
- `docs/IMPORT_EXPORT.md`: N/A(교환 파일의 원본과 보존 정책 및 writer 출력 포맷에 변경 사항이 없음)
- `docs/ISSUE_27_PROJECT_COPY.md`: N/A(지원 Project Copy 및 Template의 원본 재매핑 경로에 코드를 추가하거나 수정하지 않음)
- `docs/EXCEL_EXPORT.md`: N/A(Excel OOXML writer·원본 ID·비가산 집계와 지원 범위를 변경하지 않음)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 일정 엔진과 dependency 및 SVAR Gantt writer를 변경하지 않음)
- `docs/DEPLOYMENT.md`: N/A(신규 migration·DDL·Docker Compose 또는 image 배포 절차 변경 없음)

- 원격 #3231.1의 실패는 `## DOCUMENTATION_SYNC / N/A` 비정형 제목이었다. 같은 H2의 문서 영향 행뿐 아니라 `## AC_TEST_COVERAGE`의 `- ACn:` 정확 형식을 기본 브랜치 `docs_gate`에 맞게 모두 보완한다. 기존 QA Preflight를 우회하거나 완화하지 않는다.
- 위 `UPDATED`는 실제 #795 diff에서 변경된 파일만 지정한다. `N/A(reason)`은 현재 계약 불변의 의미적 근거이고, 새 기능/UX의 수동 검토와 remote PASS를 대체하지 않는다.

## PR·실패 누적 원장 인계

변경 source의 로컬 Node/Chromium/Docker 검증 `NOT TESTED`. Commit별 SHA와 원격 PR 번호/Head/Run/Attempt는 확인된 값만 Issue/PR STATUS·[실패 원장](../../ISSUE_792_FAILURE_ANALYSIS.md)에 갱신한다. `PR CI Started`는 성공·QA 승인·MERGE_READY가 아니다. 추가 실패 시 원인/직접 실패·파생/취소·로그 출처·시도·교정/새 Head를 동일 원장에 누적하고 최초 기록을 지우지 않는다.


## F792-001 — PR #795 첫 Full #3231.1 사전 실패 및 P1 재작업

- [첫 Full Run 40067826081.1](https://github.com/planner77/masterGantt/actions/runs/40067826081): original Head `8f1cab235bd9d15845e729641020e936dc42be79`, base `b45885812301d14b9f673841e9944b27b2642323`, `pull_request.opened`. `QA Preflight` Job 120794727284 Step4 `FAIL / DOCUMENTATION_SYNC`은 정확 H2 제목 누락. 뒤따른 Fast Gate/Required3/QA Final 실패는 파생; Policy/TS/Lint/Vitest/Chromium8/Docker 모두 미실행이다. [누적 원장](../../ISSUE_792_FAILURE_ANALYSIS.md) 원본 사건과 후속 시도는 구분한다.
- [P1 리뷰 thread](https://github.com/planner77/masterGantt/pull/795#discussion_r4366175663) **원본 직접 scope PATCH 중 외부 Task 초안 삭제 위험**: `LegacyBindingScopeEditor` PATCH 시작 전 parent pending true→`onApplied/reload` 종료 후 false, `TaskLogisticsLinkEditor`의 기존 writer pending과 OR 통합→`ProjectTaskEditor.locked` 및 native 탭 클릭/키보드 잠금, direct Checkbox/name/resource/close 차단. 리뷰 답글 4366206416, 스레드 resolved 상태를 별도 GitHub 조회로 확인. 실제 원격 전체 QA·Owner 승인과 다름.
- 검증 선택 `EXTEND`: `tests/e2e/issue-726-task-logistics.spec.ts`의 기존 격리SQLite/실제 HTTP/browser를 사용, PATCH 응답만 게이트로 지연시켜 `aria-busy`, close/tab/task-name/equipment/save disabled, Escape 억제, DB before·after, canonical refresh 후 unlock을 검증. 기존 직접/상속·5폭/readonly·whole/subset 및 authorization 회귀 `KEEP_UNIQUE`. 새 spec/shard/skip/retry/timeout 변경0.
- GitHub 연결로 코드·구조 정적 비교만 수행했으며 GitHub CI 최초 실행이 해당 제품 시나리오에 도달하지 못했다. Node/Playwright/Docker/진짜 운영 restore `NOT TESTED`. 신규 CI 시작 이후 정확 HEAD·Run/Attempt의 Trusted 결과와 Owner HIGH 위험 수용은 별도 판단, `MERGE_READY=BLOCKED`.

## F792-002 — PR #795 Full #3239.1 두 번째 QA Preflight 차단 (2026-10-24)

- **원본**: [Full Run #3239.1](https://github.com/planner77/masterGantt/actions/runs/40069142338) · Run ID `40069142338`, attempt 1, head `4819a8f8134ca5f5c74e13faf1123121541cdc2c`, base `b45885812301d14b9f673841e9944b27b2642323`, 원본 checkout/test-merge `6db0c7017faacc081776724d13ddd793034a5dcc`.
- 직접 원인은 `QA Preflight` Job `120798654052`의 `DOCUMENTATION_SYNC: Issue AC / test evidence mapping 부족: AC7`. PR metadata/risk/QA/Issue 자체 확인, 원래 DOCUMENTATION_SYNC H2 및 필수 docs 항목은 PASS 단계 도달. 즉 F792-001 H2 문제가 재발한 것이 아니라 `#785 AC4/AC7` **역사적 출처 참조**와 Work Packet AC1~AC6 매핑의 차이다. Product/CI 변경 오류의 증거 아님.
- 해결: 본 `## AC_TEST_COVERAGE`에 **AC7 역사적 #785 참조 전용 mapping** 한 행을 추가, #792의 AC2/AC4/AC5 기존 근거와 실제 운영 미검증을 연결했다. 기존 Issue 본문 역사·수용 기준을 임의 재정의하거나 실제 무손실 이관 성공으로 표시하지 않는다. 전체 `docs_gate` 항목/Issue 본문 7개 AC token을 사전 검사한다.
- `TEST_LIFECYCLE_REVIEW`: 코드·fixture·test assertions 변경 **0**. 기존 Unit/SQLite/Chromium8·WBS·Excel·Copy·Template·권한 독립 보호 KEEP_UNIQUE. 최초 2회 Full은 preflight 전후 범위만 검증하여 실제 제품/부하/브라우저 테스트는 `NOT RUN`, 새 Head Full만 권위 있다.
- 상세 직접/파생/아티팩트/중단·잔여 및 Cross-run matrix: [#792 누적 원장 F792-002](../../ISSUE_792_FAILURE_ANALYSIS.md#f792-002--pr-795-full-32391-documentation_sync-ac7-mapping-failure).

## F792-003 — 전체 이력 재수집 및 Full #3240.1 재작업 (2026-10-24)

- 승인 범위는 기존 PR #795의 분석·보완·리뷰/충돌 확인·누적 원장 기록과 새 Full CI 시작까지다. HIGH / qa_required=true / OWNER_MANAGED, version 0.131.0 유지, release_required=true / release_authorized=false. 원격 Required3·Trusted·Owner 위험 수용 전 MERGE_READY=BLOCKED다.
- 실제 실행은 Manager + frontend(UI/E2E) + backend(HTTP/SQLite·보안 목록 테스트) + infra(읽기 전용 원격 이력) + qa_docs(읽기 전용 변경 검토)로 분리한다. 문서는 Manager가 소유하며 같은 파일 동시 쓰기와 Sub-Agent의 Issue/PR 댓글·게시를 허용하지 않는다. 과거 커넥터 단일 실행 기록은 당시 사실로 보존한다.
- infra가 PR branch 전체 Full 9개를 조회했다. 기존 원장에서 빠진 #3232/#3236/#3238의 DOC_SYNC 항목 형식 실패와 #3233/#3234/#3235 취소를 [누적 원장](../../ISSUE_792_FAILURE_ANALYSIS.md)에 백필한다. 취소 Run의 test-merge는 UNKNOWN이고 #3234 base도 UNKNOWN이다. 현재 PR ref로 과거 출처를 추정하지 않는다.
- #3240.1의 원본 Head `25fed516656b2dfa864a7424ab6f3dd4a0df1423`, base `b45885812301d14b9f673841e9944b27b2642323`, test-merge `41ee531634eeb0a60513b44ff32c3c1a9e1b4595`. Preflight/Policy는 PASS에 도달했으나 TypeScript·ESLint·Vitest가 직접 FAIL이다. Next build/Chromium8/Docker 구현은 NOT RUN, Required3/QA FAIL은 파생이다.
- frontend는 Task/Revision을 key로 갖는 source 편집 세션으로 동기 effect reset을 대체하고, unmount 시 epoch를 무효화해 낡은 응답을 차단한다. PATCH의 parent pending은 `onApplied` 완료 뒤 finally에서 해제한다. E2E의 선택적 compatibilityLinks는 배열 존재를 명시 검사하며 누락은 계속 FAIL이다.
- backend는 System.active 변경 후 과거 fingerprint가 STALE로 거부되는 정상 우선순위를 보존한다. 새 source 조회 후 INACTIVE 거부와 DB 불변을 각각 검사한다. 보안 inventory 기대 목록에 신규 세 경로와 GET/POST/PATCH 권한·실제 변경 여부를 정확히 추가한다. 서버 제품 코드·API/DB/보안 계약 변경은 없다.
- TEST_LIFECYCLE_REVIEW: 기존 두 실패 Vitest 파일·#617/#785 source/교환 회귀와 #726 실제 HTTP/SQLite/5폭/readonly/지연 PATCH를 EXTEND/KEEP_UNIQUE한다. revision 변경 뒤 이전 preview/token 미노출·최신 scope 재조회도 기존 E2E에 추가한다. 신규 spec, skip, retry/timeout, 샤드/Required/validator 변경은 없다.
- DOCUMENTATION_SYNC의 정형 H2·파일 상태·AC1~AC7 매핑을 신뢰된 base의 `docs_gate`로 재검증한다. 구현의 lifecycle 정리와 테스트 보강은 기존 Task Editor/UX 계약을 유지하므로 API/DB/SECURITY/운영 설계 추가 변경 N/A다. 로컬 검증 및 동결 지문은 누적 원장의 F792-003에 기록한다. 실제 운영 DB/consumer/off-host restore/Windows Excel·수동 운영 UX는 계속 NOT TESTED다.
