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
- #846 PR #848 Run #3383.1 (`40667716755`) **QA Preflight 직접 FAIL**: Work Packet의 `- 재발 방지: 이슈 실패 원장과 계획에 GitHub API 경로/HTTP 메서드를 기재할 때는 bracketed placeholder를 parenthesis와 인접해 결합하지 않는다. Inline code도 정규식 검사 대상이다. 기존 CI 원본 Run/Job ID와 오류 원인은 원장에 보존하고 CI 검사를 완화하지 않는다.

## DOCUMENTATION_SYNC`/`## AC_TEST_COVERAGE` 정확 제목+`- `path`: UPDATED/N/A(...)` 기록 부재. 코드 품질·단위·브라우저·Docker는 **SKIPPED**이고 Required 3종/QA 자동은 파생 FAIL; 전용 [누적 실패 원장](../../ISSUE_846_FAILURE_ANALYSIS.md)에 원본 Job IDs와 reviewer findings 기록.
- #838–#840 PR #841의 과거 실패: migration 32 schema/route exact inventories, fixture FK, 4-peer UX 키보드; 현재 migration 33과 DELETE/credential 새 route를 고려하여 직접/간접 시험 파일을 보존. 과거 #841 실패를 #846 원격 실패로 오인하지 않는다.
- **Local Test/Build/Browser**: GitHub connector environment에는 npm checkout/SQLite runtime이 없어 **NOT EXECUTED**. 새 PR HEAD의 Required Quality/Chromium8/Docker/Trusted QA 원격 증거 이전 **NOT TESTED**; 해당 결과를 성공으로 소급 금지. 실제 Main/GHCR/Finalizer 미실행.
- #3384~3386은 synchronize CANCELLED. #3387.1 (`40695293920`)은 ARCHITECTURE 경로의 Issue-ID placeholder 뒤 붙은 `(PATCH/DELETE)` 때문에 Policy 직접 FAIL(F-002). #3388.1 (`40696244473`), #3389.1 (`40696478448`)은 전체 Run CANCELLED이지만 동일 원인 Policy Job이 선행 FAIL. #3390.1 (`40696957804`)은 직전 원인 기록을 원장 4회/Work Packet 1회 재현해 Markdown link check 직접 FAIL(F-003). QA Preflight/TS/ESLint/Vitest는 #3390 HEAD에서만 PASS, build/E2E8/Docker 미실행. `[name]`와 `(target)`을 인접하게 적는 오류 문자열은 **inline code에서도 현재 검사기에 탐지되므로** 원장에는 `{issueId}` 표기로 정규화한다. [누적 실패 원장](../../ISSUE_846_FAILURE_ANALYSIS.md) 확인.
- 리뷰 thread P1 `4399156235`와 P2 `4399156238` 각각 수정 후 reply + RESOLVED; 원격 최신 HEAD 재리뷰/Required는 별도 NOT TESTED.
- PR #848 시작 HEAD `dcb240562bc32ab2d503b2ff368990bc17b4dc9d`에서 Codex P1/P2 리뷰 2건이 발견되어 stale POST fixture와 Project password unlock policy를 수정 대상으로 분류. 변경 전 main behind=0/mergeable=true; 수정 뒤 최신 main/리뷰 스레드 재검사 및 정확 새 HEAD Full PR CI 시작. 새 Run은 시작 자체만 확인하고 결과 **모니터링 없음**.

## DOCUMENTATION_SYNC
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

### QA Preflight 형식 계약 — 정확한 영향 기록

기존 표는 작업자용 의미 설명으로 유지한다. 자동 Preflight `scripts/qa_final_automated.py::docs_gate`의 exact section/line format은 아래 별도 항목으로 충족한다. 정책 N/A는 변경되지 않은 CI/QA 규칙을 임의 완화한다는 의미가 아니다.

- `AGENTS.md`: UPDATED
- `DESIGN.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: UPDATED
- `docs/exec-plans/active/ISSUE_846.md`: UPDATED
- `docs/ISSUE_846_FAILURE_ANALYSIS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(Owner-managed QA and trusted approval gates unchanged)
- `docs/CI_CD.md`: N/A(Full PR CI and required Quality E2E Docker checks unchanged)
- `docs/GITHUB_OPERATIONS.md`: N/A(PR review merge and release operations remain unchanged)
- `docs/REMOTE_VALIDATION.md`: N/A(Remote exact Head and run attempt evidence requirements unchanged)
- `docs/SCHEDULING_ENGINE.md`: N/A(Issue-only data changes never mutate canonical scheduling engine)
- `docs/IMPORT_EXPORT.md`: N/A(Project import export semantics and formats are unchanged)
- `docs/IMPORT_SCHEMA.md`: N/A(Issue ledger remains excluded from project import/export)
- `docs/EXCEL_EXPORT.md`: N/A(Excel schedule and resource exports are outside this change)

## AC_TEST_COVERAGE

- AC1: Extend tests/server/projects/project-issues.test.ts for new per-Issue salt, scrypt payload validation, no GET verifier disclosure, legacy UNSET initialize/reset, credential audit. Browser project-issues.spec.ts verifies password confirmation.
- AC2: Extend tests/server/projects/project-issues.test.ts for correct Issue password without Project edit session on public Project, wrong/other password, private read gate, project edit token not bypassing Issue credentials.
- AC3: Extend Issue service and browser E2E for preserved SQL tombstone, deleted_at, exclusion from all status/query/pagination/KPI, and three filter values all/open/completed unchanged.
- AC4: Extend Issue HTTP service tests for Origin, stale 412, wrong Project references, duplicate DELETE, reset and revision revalidation; migrations/index/route security snapshots advanced to version 33. Production backup/restore remains NOT TESTED.
- AC5: Extend tests/e2e/project-issues.spec.ts to verify Task field before multiline Issue description, no link preview, original Task search, completion toggle, password and delete confirmation without changing Gantt state.
- AC6: Extend tests/e2e/project-issues.spec.ts for 390/768/1024/1440/1920 dialog bounds, keyboard Escape/focus restoration, 401 error. Native screenreader and real mobile remain NOT TESTED.
- AC7: AGENTS.md, DESIGN.md, API, ARCHITECTURE, DB_SCHEMA, SECURITY, PROJECT_UX, TEST_PLAN, Issue user guide, Work Packet and cumulative failure log updated; TEST_LIFECYCLE_REVIEW existing cases EXTEND and independent auth/Task/Gantt KEEP_UNIQUE, no test RETIRE.

## 6. 비기능 및 잔여 위험
- Database operational backup/restoration, replication/shared limiter, Playwright multiple widths/real mobile/voiceover/accessibility 및 현장 QA는 원격 PR CI만으로 검증되지 않음.
- 기존 legacy 비밀번호는 분실된 상태로 간주. 관리자는 Project edit token과 실제 Project password를 함께 제시해야 하며, 이 모델의 owner recovery 강도가 운영 정책에 충분한지는 Owner QA 위험 수용 필요.
- 최초 migration 시 nullable 컬럼/trigger와 기존 프로젝트 Issue rows의 checksum·FK 정합성, concurrent modification/rotation/soft delete 사이 보안 race는 필수 직접 테스트/PR CI와 별개 운영 검증 범위.
