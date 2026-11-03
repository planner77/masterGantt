# Issue #867 — 운영환경 기반 Project Issue 목록 기본 상태 필터

- **Primary Issue:** https://github.com/planner77/masterGantt/issues/867
- **기준:** main `43e97c3a4fd284b09d4c900ff8ab25e7a778c74b`, app `0.139.0`, 이번 PR 후보 `0.139.1`, 브랜치 `fix/issue-867-default-all-filter`.
- **Owner 승인 범위:** 분석/설계/구현/문서 갱신/리뷰·충돌 확인 후 **PR CI 시작까지**. CI 결과 모니터링·Merge/Main/GHCR Release/Issue 종료는 금지.
- **Risk / QA:** risk_level=MEDIUM (Next SSR→Client filter 및 Compose runtime 경계), qa_method=OWNER_MANAGED, qa_required=true, independent_qa=N/A (Owner Managed), Manager ACCEPT=NOT TESTED. release_required=true, release_authorized=false.

## 계획 및 상태

1. Issue #849 업무 상태와 API의 `status` 생략 기본 `all`·#846 tombstone/권한 및 KPI 계약은 유지한다. #867은 **클라이언트 UI 최초/초기화 기본값만** 수정한다.
2. 순수 `resolveProjectIssueDefaultStatusFilter`: `all|open|registered|in_progress|completed` 유효, 미설정·공백 `all`, 잘못된 값 `all`+invalid 판정. 로거는 원문 env를 절대 기록하지 않는다.
3. `dynamic` Project 서버 페이지에서 서버-only 환경 구성으로 파싱하고 `ProjectReadonlyView` → `ProjectIssueWorkspace`에 enum props로 전달. 첫 fetch와 select 일치. 수동 설정을 탭 전환으로 재초기화하지 않는다.
4. `.env.example`과 `deploy/compose.yml`에서 선택형 환경 전달을 정의하고 운영용 사용 가이드를 갱신한다. 동일 이미지 컨테이너 재생성 시 변경한 값 적용, SQLite 볼륨 보존.
5. E2E 기본 `all` 조회·미완료 수동 선택·초기화 및 기존 Issue 인증/삭제/Gantt 인스턴스 회귀를 유지한다. 순수 구성 Unit에는 5개 값·미설정/오타·Compose 선택 전달 검증을 포함한다.

## Change impact / negative cases

| 수정 지점 | 직접·간접 소비자 / 부정 시나리오 | 위험 | 테스트 / 현재 증거 |
| --- | --- | --- | --- |
| 서버 config 파서 + 동적 페이지 | 미설정/잘못된 값·비밀값 로그·Next build-time 고정/SSR 불일치 | MEDIUM | `tests/server/projects/project-issue-default-filter.test.ts`, 작성; 로컬 NOT TESTED |
| Project Host → Issue Workspace props | 최초 select와 API 불일치, 수동 상태 덮어쓰기, Task Editor handoff·Gantt 단일 인스턴스 | MEDIUM | `tests/e2e/project-issues.spec.ts` 기존 #838~#854 흐름 확장; Chromium NOT TESTED |
| Compose app.environment + .env.example | Compose 치환만 되고 앱 ENV 주입 누락, 미설정으로 기동 실패, 런타임 대신 이미지 빌드 고정 | MEDIUM | Unit 정적 계약 + 운영 Compose config/recreate 확인; Docker NOT TESTED |
| 기존 Issue API/KPI/DB/read gate | open/all 조회 의미·DELETED 제외·Project 격리·비밀번호·KPI | LOW(불변) | 기존 `tests/server/projects/project-issues.test.ts` 유지; 원격 CI NOT TESTED |

## AC_TEST_COVERAGE

- AC1: 설정값 5종 및 유효 값 공백 trimming → `tests/server/projects/project-issue-default-filter.test.ts`, 신규 Unit, NOT TESTED.
- AC2: 미설정/빈 값/잘못된 값 `all` fallback 및 원문 로그 미노출 → 구성 Unit + 서버-only 경계, NOT TESTED.
- AC3: 최초 필터와 요청 status 일치, 수동 open·all 전환·초기화 → `tests/e2e/project-issues.spec.ts` EXTEND, NOT TESTED.
- AC4: 초기화 버튼 조건, 검색/페이지 복귀, 전체 ACTIVE 포함·DELETED 제외·KPI 불변 → 기존 Issue 브라우저+서비스 테스트, NOT TESTED.
- AC5: Compose 변수 전달·이미지 재빌드 없이 재생성·데이터 보존 → Unit 정적 검증 + 운영 수동 검증 필요, NOT TESTED.
- AC6: AGENTS/DESIGN/사용자 가이드/API/ARCHITECTURE/PROJECT_UX/REQUIREMENTS/CHANGELOG/.env/Compose 및 본 계획 계약 동기화 → DOCUMENTATION_SYNC.
- AC7: PR 최신 Head Quality/Chromium8/Docker + Trusted/Owner 인수는 원격 별도 확인. 현 범위 PR CI 시작, NOT TESTED.

## TEST_LIFECYCLE_REVIEW (#711)

- 검색: 기존 `tests/e2e/project-issues.spec.ts`의 최초/초기화 `open` 단언, #854 Task Editor handoff·focus·읽기 전용 등록; `tests/server/projects/project-issues.test.ts` 서버 DB·KPI·soft delete/권한; `tests/server/logging.test.ts` JSON 로그 정제 및 `tests/scripts/deployment-layout.test.ts` Compose 계약.
- **EXTEND**: 기존 Issue E2E 최초/초기화 단언을 `all`로 전환하고 `open` 수동 필터를 같은 fixture에서 검증. #838–#854의 다른 assertions는 보존.
- **ADD**: 환경변수 순수 파서와 Compose 런타임 전달 Unit. 기존 Issue 상태/KPI DB 테스트는 변경하지 않는다.
- **KEEP_UNIQUE**: HTTP/Chromium·SQLite·인증·로그/배포의 독립 위험을 로컬 Unit 성공으로 대체하지 않는다. 테스트 삭제/skip/required gate 완화 금지.
- 로컬 Node 22/npm/Playwright/Docker 실행 환경 없음: `npm run verify:prepr -- --mode=fast --issue=867 --risk=MEDIUM`, typecheck, lint, Vitest, E2E, compose config 모두 **NOT TESTED**. GitHub CI 결과와 배포 수용을 혼동하지 않는다.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `DESIGN.md`: UPDATED
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `.env.example`: UPDATED
- `deploy/compose.yml`: UPDATED
- `CHANGELOG.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `docs/exec-plans/active/ISSUE_867.md`: UPDATED
- `docs/DB_SCHEMA.md`: N/A(DB/마이그레이션 변경 없음)
- `docs/SECURITY.md`: N/A(read gate/인증 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(Gantt/SVAR/일정 계산 변경 없음)
- `docs/TEST_PLAN.md`: N/A(공통 테스트 정책 불변, 이슈 테스트는 본 Work Packet에서 명시)
- `docs/CI_CD.md`: N/A(기존 Workflow/Required3/Release policy 불변)
- `docs/GITHUB_OPERATIONS.md`: N/A(배포 값·재생성은 Issue 사용자 가이드에 설명, GitHub 운영 절차 불변)
- `docs/ISSUE_LIFECYCLE.md`: N/A(이슈 Lifecycle/QA gate 불변)

## 실행 및 잔여 위험

- API/DB 변화 없이 UI 기본값 구성에 한정. 새 서버용 기본값 파서는 Next 서버 요청에서 평가한다.
- 코드·테스트·문서의 Git Data API 게시 전에는 로컬 actual Node/Browser 검증 부재를 `NOT TESTED`로 유지한다.
- PR CI 시작 후 원격 정확 Head/Run/Attempt 확인은 수행하되 **완료 모니터링하지 않는다**. 실패 발생 시 #704에 따라 `docs/ISSUE_867_FAILURE_ANALYSIS.md` 누적 원장을 첫 실패 시 작성한다.
