# Issue #849 — Project Issue 3상태 업무 수명주기 실행 계획

Primary Issue: https://github.com/planner77/masterGantt/issues/849
기준: main d7f41dbf7252b378c4eccc49642ac9978c58c57d (v0.137.0), branch feat/issue-849-project-issue-three-state.
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
| AC7 | TEST_LIFECYCLE_REVIEW 및 누적 실패 원장 정책 | Work Packet, ISSUE_LIFECYCLE, PR_CI_FAILURE_TRIAGE | 기록 / 신규 CI 실패 미확인 |
| AC8 | AGENTS/DESIGN/UX/API/DB/ARCHITECTURE/SECURITY/Issue 사용자 가이드 동기화 | 하단 DOCUMENTATION_SYNC | 변경 준비 |

## TEST_LIFECYCLE_REVIEW
- 검색: 기존 test-file test scenarios in tests/server/projects/project-issues.test.ts (API, credential, deleted/KPI, 0032→33), tests/e2e/project-issues.spec.ts (Issue 생성→완료→수정→삭제/키보드·5폭), database/migration-cli/issue-623/target/process/resource 테스트의 0033 exact-applied 목록을 확인.
- **EXTEND**: 기존 #838–#846 API/브라우저/DB 일관성 테스트를 삭제하지 않고 849 상태, 필터, migration upgrade/guards 검증을 추가. 레거시 완료값과 #846 인증/삭제 독립성을 보존.
- **KEEP_UNIQUE**: 실제 HTTP/Browser, SQL FK·migration checksum, private read·Origin·rate limit은 결과가 비슷해도 서로 다른 신뢰 경계다. 더 빠른 단위 테스트를 이유로 통합/RETIRE 하지 않는다.
- **ADD**: 새 상태별 SQL 불변식·이관 원본 행 보존 및 상태별 KPI/필터 검증이 기존에 없어 추가. 다른 CI/E2E shard·실환경은 PR 경로에서만 검증.
- 미실행: npm verify:prepr, npm test/typecheck/lint/build, Playwright, Docker (로컬 runner 및 checkout 부재). 영구 skip·assertion 완화·flaky 면책 불가.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `DESIGN.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: UPDATED
- `docs/exec-plans/active/ISSUE_849.md`: UPDATED
- `docs/TEST_PLAN.md`: N/A(access): 이 GitHub 커넥터에서 원문 본문이 빈 값으로 반환되어 무손실 갱신 불가. TEST_LIFECYCLE_REVIEW/AC_TEST_COVERAGE를 본 Work Packet에 상세 기록했으며 checkout 가능한 구현자가 후속 보완해야 함.
- `docs/UI_UX_GUIDELINES.md`: N/A(reuse): 기존 compact/state/scroll/focus 계약 그대로
- `docs/ISSUE_LIFECYCLE.md`: N/A(policy): 기존 단계·QA/CI·릴리스 규정 그대로
- `docs/CI_CD.md`: N/A(workflow): CI/Release 설정 자체 변경 없음
- `docs/QA_REVIEW_POLICY.md`: N/A(policy): Owner Managed 정책 변경 없음
- `docs/PR_CI_FAILURE_TRIAGE.md`: N/A(no failure yet): 최초 원격 CI 실패부터 별도 849 누적 원장 생성 의무
- `docs/GITHUB_OPERATIONS.md`: N/A(workflow): PR/병합/GHCR 정책 유지
- `docs/SCHEDULING_ENGINE.md`: N/A(scope): WBS/Task 및 Gantt core 엔진 변경 없음
- `CHANGELOG.md`: N/A(release pending): 정식 릴리스 승인 전 버전·배포 기록하지 않음
- `package.json`: N/A(release pending): 버전 변경은 사용자 정확 버전·정식 GHCR 승인 이후 분리 검토

## 실패 원장 / 리뷰 / PR 인계
- 이 Issue의 **원격 PR CI 최초 실행 결과는 아직 NOT TESTED**. 과거 #838–#840/#846 실패를 #849의 신규 실패로 오인하지 않는다. 첫 실패 시 docs/ISSUE_849_FAILURE_ANALYSIS.md를 만들고 모든 Run/Attempt·직접/파생 실패를 누적 기록한다.
- 최신 main/base drift와 미해결 review thread, mergeable 여부를 PR 생성 후 조회하며, 중간 SHA에서 PASS를 재사용하지 않는다. Owner Managed는 독립 QA 면책이 아닌 사용자 위험 수용 절차다.
