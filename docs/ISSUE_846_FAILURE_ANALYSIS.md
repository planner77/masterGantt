# Issue #846 — 누적 PR CI 실패 원장

Primary Issue [#846](https://github.com/planner77/masterGantt/issues/846). **2026-10-28 최초 제출 이전 기록에서 시작하며 Run #3383.1 실제 실패 및 재작업 중 superseded 실행을 누적 기록.**  
Source of truth: [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_846.md).

## 1. Run/Attempt 전체 목록

| PR | Run URL/ID·Attempt | event/workflow/head/base | Required / shard | 실제 FAIL·취소·미실행 | 원본 증거 |
|---|---|---|---|---|---|
| 최초 제출 이전 | N/A | 새 PR CI 실행 이전 | 모두 NOT TESTED | **해당 Issue의 관측된 실제 실패 없음** | — |
| #848 | [#3383.1 · 40667716755](https://github.com/planner77/masterGantt/actions/runs/40667716755) | pull_request FINAL_FULL; HEAD `dcb240562bc32ab2d503b2ff368990bc17b4dc9d`; base `9b3be65eaf2bf8d0b5de28377b7a347f8bfce16e`; merge `1e2378489ff4d68c3e8c5e8b0528b46021c0a788` | QA Preflight FAIL; required 3종 파생 FAIL | 실제 TYPECHECK/Vitest/E2E8/Docker build 모두 SKIPPED | [Preflight Job #122746527763](https://github.com/planner77/masterGantt/actions/runs/40667716755/job/122746527763) |
| #848 | #3384.1 · 40694937211; #3385.1 · 40695008031; #3386.1 · 40695191365 | pull_request synchronize, 순차 재작업 HEAD `7b22507d...` / `8b41a8b3...` / `fc332600...` | 모두 CANCELLED | 진행 중 HEAD 교체; completed success 증거 없음 | Actions API 2026-10-28 13:22 UTC 조회 |
| #848 | #3387.1 · 40695293920 | pull_request synchronize; HEAD `f0755314067daa957a535fc8252a9c3bcbb46e09` | 조회 당시 IN_PROGRESS | 다음 문서/회귀 보완 HEAD로 supersede 예정; 결과 추정 금지 | Actions API 2026-10-28 13:22 UTC 조회 |

**주의:** 관측된 실패가 없다는 뜻은 테스트 PASS가 아니라 **NOT EXECUTED/NOT TESTED**다. PR CI 시작 뒤 사용자가 모니터링 생략을 요청했으므로 결과를 추측해 소급 PASS로 남기지 않는다. 다음 재진입 시 실제 모든 Run/Attempt를 조회해 FAIL/취소/미실행을 구분하여 누적한다.

## 2. 이전 Issue 실패 이력과의 Cross-run 관계 (독립 원장)
#838–#840 통합 [원장](ISSUE_838_840_FAILURE_ANALYSIS.md): 기존 PR #841에서 migration 0032 도입 시 31→32 DB version/table/index/route inventory와 E2E 상위 탭 키보드, Resource FK 테스트 fixture가 직접 실패. #846의 신규 0033/DELETE/credential 정책 변경이 **동일한 전수 인벤토리**에 영향을 주므로 전체 위험 소비자 교차 보완. 원본 #841 Run 실패는 **#846 PR 실패 ID로 복사하지 않음**.

## 3. #846 누적 실패 파일·Cross-run 매트릭스
| 실패 ID | 당시 Run/Attempt/Job 및 직접 파일 | 원인·반례 | 해당 HEAD 재검증 / 잔여 위험 |
|---|---|---|---|
| F-001 | #3383.1 / Preflight Job #122746527763 / docs/exec-plans/active/ISSUE_846.md | 정확 `## DOCUMENTATION_SYNC`·`## AC_TEST_COVERAGE` 섹션 및 기록 문법 부재, QA Preflight 직접 FAIL | rework에 exact heading / bullet 항목·AC1~AC7 추가; 원격 새 Head NOT TESTED |
| R-001 · Review P1 | [#4399156235](https://github.com/planner77/masterGantt/pull/848#discussion_r4399156235) / tests/server/projects/project-issues.test.ts | stale POST에서 비밀번호 누락으로 body 400, 412 기대 계약 충돌 (코드 리뷰, **당시 Vitest 미실행**) | createBody() 사용·음성 입력 경계 교정, 리뷰 reply/resolve; 새 Head NOT TESTED |
| R-002 · Review P2 | [#4399156238](https://github.com/planner77/masterGantt/pull/848#discussion_r4399156238) / project-issue-service-core.ts | Project 비밀번호에 기존 unlock 정책에 허용된 tab/newline 거부 | parseUnlockProjectInput 재사용·Unicode 음성/양성 회귀, 리뷰 reply/resolve; 새 Head NOT TESTED |

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
- PR #848의 Run #3383.1 직접 실패 및 #3384.1~#3386.1 취소, #3387.1 진행 중 경계를 아래에 기록. 새 exact HEAD 결과는 **NOT TESTED**로 유지; 다음 재진입 시 run/attempt 원본으로 추가한다.

## 6. F-001 원본 실패 — PR #848 / Full PR Run #3383.1 / 40667716755 (attempt=1)

- **Source:** 2026-10-28 09:53:01Z, pull_request FINAL_FULL, PR #848, head `dcb240562bc32ab2d503b2ff368990bc17b4dc9d`, base `9b3be65eaf2bf8d0b5de28377b7a347f8bfce16e`, test-merge `1e2378489ff4d68c3e8c5e8b0528b46021c0a788`. 원본 [Run #3383.1](https://github.com/planner77/masterGantt/actions/runs/40667716755).
- **직접 실패:** Job `122746527763` QA Preflight, step `python3 scripts/qa_preflight.py` (원본 base 검증기, 09:53:41Z). `DOCUMENTATION_SYNC` **FAIL 1**, 5개 최종 항목 DEFERRED. 오류: `docs/exec-plans/active/ISSUE_846.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — Work Packet ## DOCUMENTATION_SYNC 누락`. 당시 계획서는 `## 5. DOCUMENTATION_SYNC`+표와 `## 3. AC_TEST_COVERAGE / TEST_LIFECYCLE_REVIEW`여서 검증기 `section(plan,"DOCUMENTATION_SYNC")`의 **exact heading** 및 `- \`path\`: UPDATED|N/A(reason)`/ `- AC#: ...` 구문과 맞지 않았다. 문서 형식 직접 오류이며 앱/런타임 검증 실패 증거는 아님.
- **선행 상태:** 변경 경로 판정 Job `122746358052` 성공, QA Final 신뢰 경계 Job `122746357468` 성공, ISSUE_AC/PATH_POLICY 통과.
- **파생 FAIL:** PR 빠른 검사 `122746665840`, Quality Required `122746801521`, E2E Required `122746801848`, Docker Required `122746801709`, QA Final — Automated `122746848233`는 Preflight FAIL/선행 SKIPPED에 종속되어 FAIL. **실제 앱 코드/검사 직접 실패로 분류 금지**.
- **미실행:** TypeScript `122746666515`, ESLint `122746666996`, Vitest `122746666418`, Next production build `122746803102`, Docker 구현 `122746802950`, Chromium8 E2E `122746803871`은 SKIPPED/NOT RUN. Fast Development Run #181.1 `40667716724`의 SKIPPED는 non-authoritative. E2E 8개 샤드 완료 성공이 아니다.
- **보완:** Work Packet에 정확 `## DOCUMENTATION_SYNC`, `## AC_TEST_COVERAGE` 제목 및 명시적인 path/UPDATED/N/A, AC1~AC7 전부 기록. 주어진 PR 변경 파일과 base `qa_final_automated.py::docs_gate` 문법을 대조해 **로컬 문서 구조 검사 PASS**(원격 Preflight PASS 주장 금지). 같은 원인 재발 방지를 위해 기존 #838–#840 완전한 원장/문서 보존.
- **신규 리뷰 위험:** Codex review HEAD 동일 시점 P1 stale POST fixture `input()`(password 없음 → 400), P2 Project password validator가 newline/tab을 금지. 해당 직접 위험은 **리뷰 증거로 발견**, Full CI에서 아직 실행되지 않았으므로 F-001 테스트 실패와 구별. 정상 본문 `createBody()`로 412 검증, 기존 canonical `parseUnlockProjectInput`(well-formed/1024-byte)로 Project 암호 인증, Issue 암호 별도 8~128/no-control 유지. 테스트에 Project control Unicode 허용/invalid surrogate 거부, 역사적 schema 0032→0033 기존 row 보존 추가. 두 review thread에 수정 설명을 답변하고 resolved 처리.
- **재작업 기간의 후속 CI:** #3384.1/3385.1/3386.1은 재작업 synchronize로 취소되었으므로 FAIL/성공 원본 코드 테스트 증거로 사용하지 않음; #3387.1은 중간 관측 시 in_progress. 최종 doc/코드 freeze와 새 정확 HEAD PR CI 결과는 재조회 전 **NOT TESTED**.

## 7. Cross-run 실패 집합 및 재검증 계획

| 분류 | 전체 이력/재발 위험 | 현 코드 수정/검증 계획 |
|---|---|---|
| F-001 신규 문서 Preflight | #838–840에서 DOCUMENTATION_SYNC/AC mapping 문제 선례, 현재 #846 Run #3383.1 재발 | exact heading/line format 보강, Base validator 규칙 정적 검사 및 새 Full PR Preflight 재검증 |
| R-001 stale negative test | 직접 `tests/server/projects/project-issues.test.ts`; 기존 #838–840 fixture/권한 우선순위 이력 | P1 수정, 정상 요청의 stale 412, no session 401, Origin 403 개별 관찰 |
| R-002 recovery 암호 정책 | canonical `project-contract.ts`의 1–12 well-formed Project 비밀번호, unlock 1024 UTF-8-byte와 신규 Issue 8–128 제어문자 거부 충돌 | canonical parser 재사용, tab/newline/한글 및 malformed Unicode 경계 긍정·음성 테스트 |
| prior #841 DB/schema/route/UX | migration 31→32/route count/index/fixtures/cross-project FK/상위 4탭 E2E | migration 32→33 체크섬·legacy row·FK, DB/schema/index exact, security route, project-workspace-ux E2E KEEP_UNIQUE |
| SQLite atomic auth/delete/security | credential state race, reset/update/delete 경합, private read/Project revision CAS | 기존 Issue SQL/HTTP 테스트 EXTEND, backend transaction in source review; 실제 동시성/운영 restore는 NOT TESTED |
| browser/timeouts | Task 순서, preview 삭제, URL 원문, 5 widths, Escape/Tab/focus | 기존 `tests/e2e/project-issues.spec.ts` EXTEND, 기존 Gantt/Task E2E KEEP_UNIQUE, 현 Run에서는 NOT RUN |

**누적 실제 실패 파일**(범위 #846 원본 Run): CI Preflight가 호출한 계획 문서 `docs/exec-plans/active/ISSUE_846.md` 1개. TypeScript/Vitest/E2E8/Docker 소스에서 **직접 실제 FAIL 0개 관측**(SKIPPED, PASS 아님). 리뷰 지적은 별도 미검증 잠재 실패로 구분한다. 과거 #841 직접 이력에는 `tests/server/db/database.test.ts`, `tests/server/migration-cli.test.ts`, `tests/server/projects/edit-authorization-handlers.test.ts`, `tests/scripts/e2e-shard-planner.test.ts`, `tests/server/projects/project-issues.test.ts`, `tests/e2e/project-workspace-ux.spec.ts`, migrations 관련 DB/Resource/Logistics tests가 포함되어 #846 영향 선정에서 배제하지 않았다.

**동결 이후 보류:** 코드·문서 새 HEAD의 TypeScript/ESLint/Vitest/Build/Chromium8/Docker/Trusted QA, PR exact current main/test-merge 및 운영 SQLite migration/restore/rollback은 실제 실행 전 NOT TESTED. Owner Managed는 Required FAIL을 통과로 간주하지 않는다. 새 HEAD PR CI를 시작한 뒤 본 작업은 CI 모니터링/병합/Main/GHCR 없이 종료한다.
