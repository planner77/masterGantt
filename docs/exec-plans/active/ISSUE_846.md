# Issue #846 — Project Issue별 인증·논리 삭제·등록 UI 실행 계획

Primary Issue: [#846](https://github.com/planner77/masterGantt/issues/846)  
이력: [#838–#840](ISSUE_838_840.md) 도입 원장, [#838–#840 실패 이력](../../ISSUE_838_840_FAILURE_ANALYSIS.md), 관련 [#836](https://github.com/planner77/masterGantt/issues/836) 이미지 조건부 재사용.  
기준: 2026-10-28 main `9b3be65eaf2bf8d0b5de28377b7a347f8bfce16e`, 신규 branch `feat/issue-846-issue-credentials-soft-delete`.  
`risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `qa_required: true`, `release_required: false`, `release_authorized: false`. 이번 요청은 구현·문서·리뷰·충돌 점검 및 **PR CI 시작까지만**. Main/GHCR/Issue 종료/운영 DB migration 실시 금지, CI 모니터링 생략.

## 1. 요구사항 / 설계 결정
- POST Issue 등록은 Project edit session, Origin, If-Match가 필요. 신규 비밀번호 `issuePassword`+확인, 8~128 Unicode 문자/512 UTF8 byte·제어문자 금지, 랜덤 16-byte salt + 고정 scrypt(32768,8,3,32). Server KDF bounded. raw password/credential hashes는 응답/브라우저 저장/로그에 포함하지 않는다.
- 보호된 Issue PATCH/DELETE는 각 Issue 비밀번호가 authority이며 Project edit session만으로 우회할 수 없다. 공개 Project 조회 사용자도 자체 Issue credential로 변경 가능. 비공개 프로젝트는 별도로 기존 read gate를 통과하여야 하고 transaction에서 사후 재확인한다. Issue 비밀번호는 Gantt·Task/Resource 수정 권한과 무관.
- 기존 migration-0032 레코드는 비밀번호 미설정 `UNSET`. 무비밀번호 legacy 쓰기는 409; Project **현재** edit session+Project **현재** 비밀번호를 모두 검증하는 명시적 /credential initialize/reset만 허용; credential_version·requestId audit. 관리자라도 본문 PATCH/DELETE 우회 불가.
- 삭제는 `lifecycle_state=DELETED`, `deleted_at` 원자적 수정(기존 `updated_at` 보존). SQL row/필드/created_at 보존, 일반 GET/검색/요약/KPI/완료 상태 필터에서 제외, 삭제 복구/삭제 필터 신규 UI 없음. 기존 Project 삭제 CASCADE는 별도 계약.
- Server state/revision/credential snapshot 재검증: KDF는 트랜잭션 외부, 변경은 단일 SQLite immediate transaction + project revision CAS. 클라이언트는 필수 strong If-Match 및 stale 412 처리.
- UI 순서: 관련 Task → Issue 내용 multiline, 별도 링크 미리보기 삭제, Issue 암호/확인 및 읽기 전용 legacy 관리자 명시적 설정, 삭제 경고+2차 확인, dialog keyboard/Escape/Tab, 완료일·Task 검색 그대로.
- Rate limiter는 현재 app instance별 Issue 10/15min 및 global 100/15min; 다중 인스턴스 환경에서 추가 shared ingress protection 필요. ERROR 429 Retry-After; Origin 403, mismatch 401, legacy 409, stale 412, missing/deleted 404, KDF capacity 503.

## 2. 영향 범위
- DB: `db/migrations/0033_project_issue_credentials_soft_delete.sql` 신규; 기존 `0032` checksum 변경 금지. CHECK/trigger/index, credential audit, audit Project/Issue FK CASCADE.
- API/Backend: ProjectIssueService parsers+per-Issue async verification/countercheck, handler, new `PATCH .../credential` / `DELETE .../issues/{issueId}`, route security inventory 및 rate limiter.
- UI: `src/features/projects/project-issue-workspace.tsx`, CSS. 기존 Project Workspace/Gantt 인스턴스 자체 변경 금지.
- Consumer: 정확 migration 33 및 audit table+indexes, Route exact method inventory, E2E mocked DTO/POST/PATCH/DELETE, SQL summaries, WBS ProjectRevision 412.

## 3. AC_TEST_COVERAGE / TEST_LIFECYCLE_REVIEW
| AC | 범주 / 경로 | 처리 |
|---|---|---|
| AC1 신규 Issue password/confirm POST session+scrypt storage | `tests/server/projects/project-issues.test.ts`, `tests/e2e/project-issues.spec.ts` | EXTEND #838–840 |
| AC2 보호 PATCH/DELETE Issue password only, no project edit bypass, private read guard | `tests/server/projects/project-issues.test.ts` | EXTEND |
| AC3 legacy UNSET→initialize/reset, project session+PW, audit, state conflict | `tests/server/projects/project-issues.test.ts` | EXTEND |
| AC4 SQL tombstone, 全 list/summary/status/query pagination/Repeat404 | `tests/server/projects/project-issues.test.ts`, `tests/e2e/project-issues.spec.ts` | EXTEND |
| AC5 form Task before contents/no preview, password/error/confirm, existing Task/Gantt navigation | `tests/e2e/project-issues.spec.ts`, peer/workspace related E2E | EXTEND / KEEP_UNIQUE |
| AC6 migration/checksums/row integrity/route mapping | `tests/server/db/database.test.ts`, `tests/server/migration-cli.test.ts`, `tests/server/db/issue-623-target-migration.test.ts`, migrations 0025–0032 upgrade consumers, `tests/server/projects/edit-authorization-handlers.test.ts` | EXTEND |
| AC7 unrelated Project login, Resource/Task permission, private read, Gantt instance unchanged | 기존 `tests/server/projects/edit-authorization-security.test.ts`, `tests/e2e/project-workspace-tabs-518.spec.ts`, `tests/e2e/project-task-editor-persistence.spec.ts` | KEEP_UNIQUE |

기존 같은 이름 테스트라 하더라도 Project auth / Browser E2E / SQLite FK / migration checksum / Private read boundary는 독립 관찰이므로 RETIRE/skip/assertion 완화 불가. 신규 delete/status variant는 기존 CRUD 검증을 대체하지 않는다. `docs/TEST_PLAN.md` 5,617행 원본 Blob을 검증하여 삭제 없이 #846 AC 표를 append했고 원본 0032 migration을 변경하지 않았다.

## 4. Failure history·validation gate
- #846 전용 기존 PR/CI 실패: **관측 없음**, 신규 실패는 [누적 실패 원장](../../ISSUE_846_FAILURE_ANALYSIS.md)에 HEAD/Run/Attempt/Job+원본 증거와 미실행·파생 실패를 구분해 기록.
- #838–#840 PR #841의 과거 실패: migration 32 schema/route exact inventories, fixture FK, 4-peer UX 키보드; 현재 migration 33과 DELETE/credential 새 route를 고려하여 직접/간접 시험 파일을 보존. 과거 #841 실패를 #846 원격 실패로 오인하지 않는다.
- **Local Test/Build/Browser**: GitHub connector environment에는 npm checkout/SQLite runtime이 없어 **NOT EXECUTED**. 새 PR HEAD의 Required Quality/Chromium8/Docker/Trusted QA 원격 증거 이전 **NOT TESTED**; 해당 결과를 성공으로 소급 금지. 실제 Main/GHCR/Finalizer 미실행.
- PR 작성 이후 open review threads 0/P1P2 0, current main conflict 여부를 원격 API로 확인. 문제 발견 시 우선 해결·commit 후 새 exact HEAD PR CI. CI 시작 후 **모니터링 없음**.

## 5. DOCUMENTATION_SYNC
| 경로 | 적용 |
|---|---|
| `AGENTS.md` | UPDATED: 최초 #838 session-only 정책에 #846 예외/최신 계약 명시 |
| `DESIGN.md` | UPDATED: Task→Issue 내용, preview 제거, 암호/삭제 UI |
| `docs/API.md` | UPDATED: 새 POST/PATCH/DELETE/credential 권한, response/error |
| `docs/DB_SCHEMA.md` | UPDATED: 0033 schema, audit, tombstone, FK, indexes |
| `docs/ARCHITECTURE.md` | UPDATED: verifier, read grant, transaction/revision |
| `docs/SECURITY.md` | UPDATED: password/legacy/reset, rate limit, private, CSRF |
| `docs/PROJECT_UX.md` | UPDATED: Issue 편집화면/검색/기존 Gantt 유지 |
| `docs/PROJECT_ISSUES_USER_GUIDE.md` | UPDATED: 등록·수정·삭제·최초 설정/복구 동작 |
| `docs/TEST_PLAN.md` | UPDATED: Full 원본 유지 + AC/검색/중복·폐기 판단 |
| `docs/CI_CD.md`, `docs/QA_REVIEW_POLICY.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md` | N/A: CI workflow/Required/QA/Release/remote evidence policy 변경 없음 |
| `docs/SCHEDULING_ENGINE.md` | N/A: Gantt/WBS 계산 엔진 변경 없음 |
| `CHANGELOG.md`, `package*.json` | N/A: Owner로부터 정식 릴리스 승인/버전 범위 미요청, PR만 시작 |

## 6. 비기능 및 잔여 위험
- Database operational backup/restoration, replication/shared limiter, Playwright multiple widths/real mobile/voiceover/accessibility 및 현장 QA는 원격 PR CI만으로 검증되지 않음.
- 기존 legacy 비밀번호는 분실된 상태로 간주. 관리자는 Project edit token과 실제 Project password를 함께 제시해야 하며, 이 모델의 owner recovery 강도가 운영 정책에 충분한지는 Owner QA 위험 수용 필요.
- 최초 migration 시 nullable 컬럼/trigger와 기존 프로젝트 Issue rows의 checksum·FK 정합성, concurrent modification/rotation/soft delete 사이 보안 race는 필수 직접 테스트/PR CI와 별개 운영 검증 범위.
