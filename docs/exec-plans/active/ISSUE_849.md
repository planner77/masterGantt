# Issue #849 — Project Issue 3상태 업무 수명주기 실행 계획

Primary Issue: https://github.com/planner77/masterGantt/issues/849
기준: main d7f41dbf7252b378c4eccc49642ac9978c58c57d (v0.137.0), target candidate v0.138.0 (MINOR feature), branch feat/issue-849-project-issue-three-state.
관련: #838/#839/#840 최초 Issue 모듈 및 #846 인증·삭제, AGENTS.md, DESIGN.md, PROJECT_ISSUES_USER_GUIDE, API/DB_SCHEMA/ARCHITECTURE/SECURITY/PROJECT_UX, ISSUE_LIFECYCLE, UI_UX_GUIDELINES.
risk_level: HIGH; qa_method: OWNER_MANAGED; qa_required: true; independent_qa: N/A (Owner-managed); manager_decision: NOT TESTED; release_required: true; release_authorized: false.
승인 범위: 설계·구현·문서·리뷰/충돌 확인·**PR CI 시작까지만**. CI 모니터링/병합/Main/GHCR/실운영 migration·release/Issue 종료는 수행하지 않는다.

## 계획 / 결정
1. 기준 계약: 업무 issue_status=registered|in_progress|completed. #846 논리 삭제는 별도 lifecycle_state=ACTIVE|DELETED, 일반 조회/집계에서 제외. 다음 미사용 migration은 0034로 확인. 0032/0033 원본 checksum 보존.
2. 데이터 이관: completed=true는 completed, false는 registered. 기존 값에서 in_progress를 추론할 수 없으므로 임의 전환 금지. 기존 감사/credentials, FK/name snapshots, 삭제 시각, created/updated의 byte 보존.
3. 입력/API: 신규 UI는 status+legacy completed boolean을 함께 전송. 서버는 status 명시 시 completed/완료일과 불일치 400, 구 11-field 클라이언트에서 status 생략 시 기존 completed로 파생. 0034 trigger는 직접 DB 쓰기도 불변식을 검증. 전체 summary는 total/completed/inProgress/registered, 검색 total은 필터 범위; 단일 read transaction으로 정합성 유지.
4. 필터: UI 기본과 초기화=open(등록+진행 중), 서버의 status 미기재는 레거시 호환 all. 선택값 open/all/registered/in_progress/completed, 삭제 상태 필터 추가 안 함.
5. UI: 등록/수정 3상태 선택, 완료 전환 시 Asia/Seoul 기본 완료일, 완료→미완료 전환 시 NULL. 기존 비밀번호/Task→설명/키보드 focus/5열 작업면·Gantt 인스턴스 보존. 상단 T/C/P/R 건수와 C/T, P/T, R/T 각각 소수 1자리 표시·0건 0.0%.

## 영향 및 위험
- **직접**: db migration, contracts/project-issues, ProjectIssueService parse/SQL/query, Issue Workspace UI/CSS, API·DB·UX·보안 문서.
- **간접**: migration all-applied exact 배열을 검사하는 SQLite/CLI/Logistics/Process/Resource 회귀, Browser fixture DTO·검색 결과·page stale 처리, legacy Issue GET/POST/PATCH, 0033 credential reset/soft delete, private access 및 프로젝트 revision 충돌.
- **잔여 위험**: Connector 환경에서 npm/node_modules/SQLite 파일 체크아웃·Playwright 브라우저가 없어 실제 로컬 유닛/TS/lint/E2E 실행은 **NOT EXECUTED**. PR exact HEAD Full Quality/E2E8/Docker와 Trusted QA 결과 전까지 **NOT TESTED**. 테스트 패스·운영 migration 성공을 주장하지 않는다. 운영 네트워크/백업·실사용자 UX 확인은 추후 별도.
- **회복**: 승인되지 않은 production migration 금지. 이미 적용된 0034는 단순 DROP COLUMN으로 되돌리지 않고 사전 SQLite 백업과 복원/롤백 runbook을 별도 검증한다. 코드 롤백은 schema reader 호환성을 실제 시험한 뒤만 수행한다.

## AC_TEST_COVERAGE
| AC | 시나리오/계약 | 실제 소스 | 상태 |
|---|---|---|---|
| AC1 | 등록/진행/완료 생성·수정, 완료일 default/NULL, API strict parse 및 legacy 11필드 | tests/server/projects/project-issues.test.ts, tests/e2e/project-issues.spec.ts | EXTEND, NOT EXECUTED |
| AC2 | 0033→0034 실제 파일 reopen, deleted·credential 원본 보존/checksum/trigger/FK 및 0032→최신 업그레이드 | tests/server/projects/project-issues.test.ts, tests/server/db/database.test.ts 등 migration exact-array 8개 | EXTEND, NOT EXECUTED |
| AC3 | 권한·암호·Origin·strong If-Match·stale412/429·private read·Task 격리 | tests/server/projects/project-issues.test.ts 기존 #846 부정 테스트 | EXTEND/KEEP_UNIQUE, NOT EXECUTED |
| AC4 | 기본 open, 5개 상태 검색/페이지/초기화와 전체 요약 범위 분리 | tests/e2e/project-issues.spec.ts, tests/server/projects/project-issues.test.ts | EXTEND, NOT EXECUTED |
| AC5 | 상태 5열, 390~1920 width, 키보드/focus/Gantt 상태 보존 | tests/e2e/project-issues.spec.ts 및 기존 Project Workspace peer specs | EXTEND/KEEP_UNIQUE, NOT EXECUTED |
| AC6 | T=C+P+R, filter-independent summary, tombstones 제외, 0건, 비율 표시 | tests/server/projects/project-issues.test.ts, tests/e2e/project-issues.spec.ts | EXTEND, NOT EXECUTED |
| AC7 | TEST_LIFECYCLE_REVIEW 및 누적 실패 원장 정책 | Work Packet, ISSUE_LIFECYCLE, PR_CI_FAILURE_TRIAGE | 기록 / #3396.1 원본 직접 FAIL 및 과거 Draft·Cancelled 구분 |
| AC8 | AGENTS/DESIGN/UX/API/DB/ARCHITECTURE/SECURITY/Issue 사용자 가이드 동기화 | 하단 DOCUMENTATION_SYNC | 변경 준비 |

- AC1: 등록·수정의 등록/진행 중/완료 상태와 완료일 입력·DB 일관성을 검증하며 서버와 E2E 회귀는 기존 테스트 확장
- AC2: 0033→0034 SQLite migration 기존 필드/credentials/tombstone 보존·체크섬·FK·SQL trigger 음성 케이스 검증
- AC3: Issue 비밀번호·Origin·private read gate·strong If-Match·revision/412/429 등 인증 경계 기존 테스트 보존
- AC4: UI 기본 open, 검색 초기화 및 전체·등록·진행 중·완료 필터와 서버 페이지네이션 검증
- AC5: 목록 상태 5열·응답 상태 표시·390~1920px·키보드 포커스 및 Gantt 탭 상태 보존 검증
- AC6: 전체 T=C+P+R, 삭제 제외, 0건과 진행률 계산 및 검색/페이지 독립 KPI의 서버와 브라우저 검증
- AC7: TEST_LIFECYCLE_REVIEW와 이슈별 누적 실패 원장, Required3/Chrome8 경계 및 미실행 범위 기록
- AC8: AGENTS, DESIGN, API, DB_SCHEMA, SECURITY, PROJECT_UX, TEST_PLAN 및 사용자 가이드와 Work Packet 동기화

## TEST_LIFECYCLE_REVIEW
- 검색: 기존 test-file test scenarios in tests/server/projects/project-issues.test.ts (API, credential, deleted/KPI, 0032→33), tests/e2e/project-issues.spec.ts (Issue 생성→완료→수정→삭제/키보드·5폭), database/migration-cli/issue-623/target/process/resource 테스트의 0033 exact-applied 목록을 확인.
- **EXTEND**: 기존 #838–#846 API/브라우저/DB 일관성 테스트를 삭제하지 않고 849 상태, 필터, migration upgrade/guards 검증을 추가. 레거시 완료값과 #846 인증/삭제 독립성을 보존.
- **KEEP_UNIQUE**: 실제 HTTP/Browser, SQL FK·migration checksum, private read·Origin·rate limit은 결과가 비슷해도 서로 다른 신뢰 경계다. 더 빠른 단위 테스트를 이유로 통합/RETIRE 하지 않는다.
- **ADD**: 새 상태별 SQL 불변식·이관 원본 행 보존 및 상태별 KPI/필터 검증이 기존에 없어 추가. 다른 CI/E2E shard·실환경은 PR 경로에서만 검증.
- 미실행: npm verify:prepr, npm test/typecheck/lint/build, Playwright, Docker (로컬 runner 및 checkout 부재). 영구 skip·assertion 완화·flaky 면책 불가.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `DESIGN.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: UPDATED
- `docs/exec-plans/active/ISSUE_849.md`: UPDATED
- `docs/ISSUE_849_FAILURE_ANALYSIS.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(Owner Managed와 필수 검증 게이트의 기존 정책을 그대로 유지)
- `docs/CI_CD.md`: N/A(PR CI 세 Required 및 Main Release workflow 구성을 변경하지 않음)
- `docs/GITHUB_OPERATIONS.md`: N/A(PR CI 재실행 및 원격 커밋 운영 절차를 변경하지 않음)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 증거와 검증 단계의 기존 계약을 변경하지 않음)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 compact 디자인과 focus 접근성 규칙을 재사용)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 Issue 단계와 검증 승인 경계가 변경되지 않음)
- `docs/PR_CI_FAILURE_TRIAGE.md`: N/A(원장 작성 지침은 유지하고 이슈별 누적 원장만 생성)
- `docs/SCHEDULING_ENGINE.md`: N/A(Project Issue 상태는 WBS 일정 알고리즘과 독립)

### 문서 반영 판단
관련 API·DB·상태·UI·보안 계약은 변경된 문서와 비교했고, QA/CI/운영 정책은 변경하지 않으므로 각 N/A 근거를 별도 기록했다. 설명을 문서별 한 줄 끝에 붙이면 기본 브랜치 검증기의 엄격한 DOCUMENTATION_SYNC 정규식에서 누락되므로 변경 여부와 근거를 정확한 단일 상태 표기만으로 기록한다.

## 실패 원장 / 리뷰 / PR 인계

- 2026-10-29 확인: PR #850 Full [Run #3396.1](https://github.com/planner77/masterGantt/actions/runs/40785203891), Head `913c4e3b96c18bc408c54298e149e5d5598b94f8` Base `d7f41dbf7252b378c4eccc49642ac9978c58c57d`, Test merge `8b890ed0c07a05cabc44c2f8acb3a4f20dc11213`. 원본 QA Preflight Job `123156729878` 직접 `DOCUMENTATION_SYNC FAIL`: `docs/CI_CD.md` 영향 기록이 검증 정규식으로 식별되지 않음. Ready 이전 #3393/#3394 Draft 정책 차단, #3395 취소는 원본 FAIL과 별도 분류.
- 선행 누락까지 동시 보완: `docs_gate`는 `- \`path\`: UPDATED` 또는 `- \`path\`: N/A(reason)`으로 끝나는 단일 행만 인식하며, AC_TEST_COVERAGE에서는 `- AC1:` … `- AC8:` 구조의 증거 매핑을 요구한다. 과거 기록은 설명을 상태와 같은 행에 붙였고 AC 표만 작성해서 2차 차단 위험이 존재했다. 전체 DOCUMENTATION_SYNC 행을 형식에 맞추고 표는 보존하며 AC1~AC8 bullet을 추가했다.
- [누적 실패 원장](../../ISSUE_849_FAILURE_ANALYSIS.md): #3393~#3396, Fast #190~#193의 Run/Attempt/직접·파생·미실행 및 Source 보존. 최초 실패는 제품 직접 검사 전에 발생; TypeScript/Lint/Vitest/E2E8/Docker 구현 Job은 NOT RUN, 새 Head 결과는 NOT TESTED. 과거 #846 실패를 #849 실패로 계산하지 않는다.
- 요구된 QA/리뷰/충돌 점검 후 새 Full PR CI 시작까지만 수행. CI 결과 모니터링, Main merge/CI, GHCR, 운영 DB migration, Issue close는 별도 지시 없이는 실행하지 않는다. HIGH/OWNER_MANAGED 및 Required3/Trusted QA는 유지한다.


## REWORK #2 — 2026-10-29 / PR #850 #3397.1

- 원본 Run [#3397.1](https://github.com/planner77/masterGantt/actions/runs/40789357833) / Attempt 1 / HEAD `c64897b0a23ae9378b38f70b04f9730e40f4954f` / Test merge `49265a2fdaa83dc7dbdadf393d6c89e7b93bcb1b`.
- 이전 F-001 문서 Preflight와 Policy, TypeScript, ESLint는 PASS. 신규 Vitest 직접 실패 6건: 0034 Migration 예상 33/9개 미갱신 5건, #846 tombstone 2필드 KPI 기대값 1건. 3372 PASS/3 SKIPPED, E2E8·Docker 구현 NOT RUN. Required3/자동 QA는 파생 FAIL.
- 수정: `tests/server/migration-cli.test.ts`, `tests/server/db/issue-623-target-migration.test.ts`, `tests/server/logistics/logistics-targets-acceptance.test.ts`, `tests/server/projects/project-issues.test.ts`의 전체 원장 버전·체크섬/복구/상태 KPI 단언을 최신 명세로 보완하고 0034 정확 이름 및 삭제 상태별 필터 음성 검증 추가.
- [누적 실패 원장](../../ISSUE_849_FAILURE_ANALYSIS.md)에 #3393~#3397 직접/파생·취소·미실행과 전체 6건의 F-002/F-003 매트릭스 기록. TEST_LIFECYCLE_REVIEW는 EXTEND/KEEP_UNIQUE, 테스트 삭제/완화/CI 정책 변경 없음. 새 Head 테스트 NOT TESTED; 로컬 실제 npm/SQLite/Browser/Docker NOT EXECUTED.
- DOCUMENTATION_SYNC: 본 문서 및 #849 원장 UPDATED, 기존 필수 AGENTS/DESIGN/API/DB/SECURITY/TEST_PLAN 및 QA/CI 정책은 범위·의미 변경 없음. 리뷰·Main 충돌 검사 후 새 Full PR CI 시작까지만 진행.
