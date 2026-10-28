# Issue #846 — 누적 PR CI 실패 원장

Primary Issue [#846](https://github.com/planner77/masterGantt/issues/846). **2026-10-28 PR 신규 작성 이전** 기록.  
Source of truth: [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_846.md).

## 1. Run/Attempt 전체 목록

| PR | Run URL/ID·Attempt | event/workflow/head/base | Required / shard | 실제 FAIL·취소·미실행 | 원본 증거 |
|---|---|---|---|---|---|
| 최초 제출 이전 | N/A | 새 PR CI 실행 이전 | 모두 NOT TESTED | **해당 Issue의 관측된 실제 실패 없음** | — |

**주의:** 관측된 실패가 없다는 뜻은 테스트 PASS가 아니라 **NOT EXECUTED/NOT TESTED**다. PR CI 시작 뒤 사용자가 모니터링 생략을 요청했으므로 결과를 추측해 소급 PASS로 남기지 않는다. 다음 재진입 시 실제 모든 Run/Attempt를 조회해 FAIL/취소/미실행을 구분하여 누적한다.

## 2. 이전 Issue 실패 이력과의 Cross-run 관계 (독립 원장)
#838–#840 통합 [원장](ISSUE_838_840_FAILURE_ANALYSIS.md): 기존 PR #841에서 migration 0032 도입 시 31→32 DB version/table/index/route inventory와 E2E 상위 탭 키보드, Resource FK 테스트 fixture가 직접 실패. #846의 신규 0033/DELETE/credential 정책 변경이 **동일한 전수 인벤토리**에 영향을 주므로 전체 위험 소비자 교차 보완. 원본 #841 Run 실패는 **#846 PR 실패 ID로 복사하지 않음**.

## 3. #846 누적 실패 파일·Cross-run 매트릭스
| 실패 ID | 당시 Run/Attempt/Job 및 직접 파일 | 원인·반례 | 해당 HEAD 재검증 / 잔여 위험 |
|---|---|---|---|
| 없음 | 이슈 최초 제출 이전 | 미관측(성공 아님) | 원격 exact-HEAD Required Quality/E2E8/Docker/Trusted QA **NOT TESTED** |

## 4. 변경 영향 + 기존 실패 교차 테스트 합집합
- 직접: `tests/server/projects/project-issues.test.ts`, `tests/e2e/project-issues.spec.ts`, `src/server/projects/project-issue-service-core.ts`, `src/server/projects/project-issue-handlers-core.ts`.
- DB exact: `tests/server/db/database.test.ts`, `tests/server/migration-cli.test.ts`, `tests/server/db/issue-623-target-migration.test.ts`, `tests/server/logistics/logistics-targets-acceptance.test.ts`, `tests/server/logistics/task-target-bindings.test.ts`, `tests/server/process-catalog/process-catalog-service.test.ts`, `tests/server/process-catalog/process-context-service.test.ts`, `tests/server/resources/project-resource-memberships.test.ts`.
- Security inventory: `tests/server/projects/edit-authorization-handlers.test.ts`의 정확한 API method/policy inventory.
- 음성/indirect KEEP_UNIQUE: Project edit auth, private project read gate, Task/Resource FK, Workspace navigation/Gantt instance, old 0032 checksum, 32→33 upgrade rollback.
- Browser widths/실기기/운영 SQLite migration·restore는 별도 검증; 사내 현장 데이터 접근하지 않음.

## 5. 동일 후보 source 검증
- `origin/main=9b3be65eaf2bf8d0b5de28377b7a347f8bfce16e` 기반 신규 branch. local Node/npm/SQLite/Playwright 환경 사용 불가로 **NOT EXECUTED**; 원격 Full PR CI로 검증 요청.
- `docs/TEST_PLAN.md` 기존 807,952자/5,617행 Blob 전체를 읽고 append만 적용, 기존 원본을 0행으로 덮는 #838 실패 유형을 사전 차단.
- 모든 migration 원본(#0032 등)은 수정하지 않았고 additive 0033만 추가; 인증 hash/비밀번호·Project read gate는 HIGH security로 Owner Managed 위험 수용과 Required PASS를 별개로 취급한다.
- 신규 Run HEAD/ID/attempt (실행 이후): **미기록 — 모니터링 생략 요청**. 실제 결과/FAIL이 수집된 후 이 원장에 전체 이력을 추가한다.
