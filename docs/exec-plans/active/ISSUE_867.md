# Issue #867 — 운영환경 기반 Project Issue 목록 기본 상태 필터

- **Primary Issue:** https://github.com/planner77/masterGantt/issues/867
- **기준:** main `43e97c3a4fd284b09d4c900ff8ab25e7a778c74b`, app `0.139.0`, 이번 PR 후보 `0.139.1`, 브랜치 `fix/issue-867-default-all-filter`.
- **Owner 승인 범위:** 분석/설계/구현/문서 갱신/리뷰·충돌 확인 후 **PR CI 시작까지**. CI 결과 모니터링·Merge/Main/GHCR Release/Issue 종료는 금지.
- **Risk / QA:** risk_level=HIGH (AGENTS.md·deploy/compose.yml·package/lockfile 및 src/server 보호 경로 변경; SSR→Client filter 경계), qa_method=OWNER_MANAGED, qa_required=true, independent_qa=N/A (Owner Managed), Manager ACCEPT=NOT TESTED. release_required=true, release_authorized=false.

## 계획 및 상태

1. Issue #849 업무 상태와 API의 `status` 생략 기본 `all`·#846 tombstone/권한 및 KPI 계약은 유지한다. #867은 **클라이언트 UI 최초/초기화 기본값만** 수정한다.
2. 순수 `resolveProjectIssueDefaultStatusFilter`: `all|open|registered|in_progress|completed` 유효, 미설정·공백 `all`, 잘못된 값 `all`+invalid 판정. 로거는 원문 env를 절대 기록하지 않는다.
3. `dynamic` Project 서버 페이지에서 서버-only 환경 구성으로 파싱하고 `ProjectReadonlyView` → `ProjectIssueWorkspace`에 enum props로 전달. 첫 fetch와 select 일치. 수동 설정을 탭 전환으로 재초기화하지 않는다.
4. `.env.example`과 `deploy/compose.yml`에서 선택형 환경 전달을 정의하고 운영용 사용 가이드를 갱신한다. 동일 이미지 컨테이너 재생성 시 변경한 값 적용, SQLite 볼륨 보존.
5. E2E 기본 `all` 조회·미완료 수동 선택·초기화 및 기존 Issue 인증/삭제/Gantt 인스턴스 회귀를 유지한다. 순수 구성 Unit에는 5개 값·미설정/오타·Compose 선택 전달 검증을 포함한다.

## Change impact / negative cases

| 수정 지점 | 직접·간접 소비자 / 부정 시나리오 | 위험 | 테스트 / 현재 증거 |
| --- | --- | --- | --- |
| 서버 config 파서 + 동적 페이지 | 미설정/잘못된 값·비밀값 로그·Next build-time 고정/SSR 불일치 | HIGH(보호된 서버 경로) | `tests/server/projects/project-issue-default-filter.test.ts`, 작성; 로컬 NOT TESTED |
| Project Host → Issue Workspace props | 최초 select와 API 불일치, 수동 상태 덮어쓰기, Task Editor handoff·Gantt 단일 인스턴스 | MEDIUM | `tests/e2e/project-issues.spec.ts` 기존 #838~#854 흐름 확장; Chromium NOT TESTED |
| Compose app.environment + .env.example | Compose 치환만 되고 앱 ENV 주입 누락, 미설정으로 기동 실패, 런타임 대신 이미지 빌드 고정 | HIGH(보호된 배포 경로) | Unit 정적 계약 + 운영 Compose config/recreate 확인; Docker NOT TESTED |
| 기존 Issue API/KPI/DB/read gate | open/all 조회 의미·DELETED 제외·Project 격리·비밀번호·KPI | LOW(불변) | 기존 `tests/server/projects/project-issues.test.ts` 유지; 원격 CI NOT TESTED |

## AC_TEST_COVERAGE

- AC1: 환경변수 `all/open/registered/in_progress/completed` 5종 → `tests/server/projects/project-issue-default-filter.test.ts` Unit, 구현됨/실행 NOT TESTED.
- AC2: 미설정/빈 값/공백 → `all` fallback 및 초기·초기화 값 → 구성 Unit + `tests/e2e/project-issues.spec.ts`, 실행 NOT TESTED.
- AC3: 미지원값 → `all`, 안전 경고(원문/비밀 출력 없음) → 구성 Unit + 서버 전용 Logger 코드 검토, 실제 로그 테스트 NOT TESTED.
- AC4: select 상태/첫 요청 status/초기화 대상 일치 → `tests/e2e/project-issues.spec.ts` EXTEND, 실행 NOT TESTED.
- AC5: 사용자가 수동 선택한 필터가 검색·목록 새로고침·탭 복귀에서 유지 → 기존 `tests/e2e/project-issues.spec.ts` Task Editor 복귀 및 상태 검색 회귀, 실행 NOT TESTED.
- AC6: Compose app env 전달, 이미지 재빌드 없는 컨테이너 재생성 반영 → 구성 Unit 정적 계약 + 운영 Docker Compose 재생성 수동 시험, 실행 NOT TESTED.
- AC7: ACTIVE 5종 조회·DELETED 제외·KPI/인증/API 불변 → `tests/server/projects/project-issues.test.ts` KEEP_UNIQUE + E2E, 실행 NOT TESTED.
- AC8: Unit/E2E/Compose 및 코드·문서 동기화 → 본 DOCUMENTATION_SYNC, CI 품질/Chromium 8/Docker 확인은 신규 PR Head에서 NOT TESTED.

## TEST_LIFECYCLE_REVIEW (#711)

- 검색: 기존 `tests/e2e/project-issues.spec.ts`의 최초/초기화 `open` 단언, #854 Task Editor handoff·focus·읽기 전용 등록; `tests/server/projects/project-issues.test.ts` 서버 DB·KPI·soft delete/권한; `tests/server/logging.test.ts` JSON 로그 정제 및 `tests/scripts/deployment-layout.test.ts` Compose 계약.
- **EXTEND**: 기존 Issue E2E 최초/초기화 단언을 `all`로 전환하고 `open` 수동 필터를 같은 fixture에서 검증. #838–#854의 다른 assertions는 보존.
- **ADD**: 환경변수 순수 파서와 Compose 런타임 전달 Unit. 기존 Issue 상태/KPI DB 테스트는 변경하지 않는다.
- **KEEP_UNIQUE**: HTTP/Chromium·SQLite·인증·로그/배포의 독립 위험을 로컬 Unit 성공으로 대체하지 않는다. 테스트 삭제/skip/required gate 완화 금지.
- 최초 구현 환경에서는 로컬 Node 22/npm/Playwright/Docker 실행 환경이 없어 당시 계획 명령 `npm run verify:prepr -- --mode=fast --issue=867 --risk=MEDIUM`, typecheck, lint, Vitest, E2E, compose config 모두 **NOT TESTED**였다. 위 MEDIUM은 당시 이력이며 현재 위험도는 HIGH다. 재개 환경의 실제 실행 결과와 의존성 차이는 아래 F867-003 절을 따른다.

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
- `docs/ISSUE_867_FAILURE_ANALYSIS.md`: UPDATED
- `docs/DB_SCHEMA.md`: N/A(DB/마이그레이션 변경 없음)
- `docs/SECURITY.md`: N/A(read gate/인증 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(Gantt/SVAR/일정 계산 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(Owner-managed 위험도 HIGH로 선언하되 기존 독립 QA·Trusted·Owner Gate 완화 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(로컬/원격 증거 경계·Required3와 Head/Run 검증 정책 불변)
- `docs/TEST_PLAN.md`: N/A(공통 테스트 정책 불변, 이슈 테스트는 본 Work Packet에서 명시)
- `docs/CI_CD.md`: N/A(기존 Workflow/Required3/Release policy 불변)
- `docs/GITHUB_OPERATIONS.md`: N/A(배포 값·재생성은 Issue 사용자 가이드에 설명, GitHub 운영 절차 불변)
- `docs/ISSUE_LIFECYCLE.md`: N/A(이슈 Lifecycle/QA gate 불변)

## 실패 #3463.1 및 문서·QA 선언 보완 (2026-11-03)

- 원본 Full CI [Run 41582346250.1](https://github.com/planner77/masterGantt/actions/runs/41582346250)는 QA Preflight 5개 metadata FAIL(`RISK_LEVEL, QA_METHOD, QA_REQUIRED, PATH_POLICY, ISSUE_AC`), QA 신뢰 경계에서 `qa_method` 명시 선언 누락으로 FAIL. Fast Gate·Quality/E2E/Docker 집계 FAIL은 **파생**, 실제 TypeScript/Vitest/Chromium/Docker 구현 Job은 SKIPPED.
- 같은 Head에서 PR 본문 편집으로 발생한 metadata-only [Run 41583036060.1](https://github.com/planner77/masterGantt/actions/runs/41583036060)는 원본 Full CI `FULL_FAILED`를 정확히 승계하여 FAIL. 이를 새 제품 결함/독립 Full 검증 실패로 중복 계수하지 않는다.
- 보완: PR 본문에 정확한 단일 `risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `qa_required: true` 및 release 두 필드를 선언, Issue #867의 8개 수용 기준에 `AC1..AC8` 부여, 본 Packet의 AC 매핑 정합화 및 QA 필수 문서 6종 영향 판정을 완성함.
- 누적 실패 원장: [docs/ISSUE_867_FAILURE_ANALYSIS.md](../../ISSUE_867_FAILURE_ANALYSIS.md). 기존 검증기·CI Workflow/Ruleset·테스트 assertion을 수정하거나 약화하지 않는다. 로컬/remote 새 Head PASS는 아직 `NOT TESTED`.

## 실행 및 잔여 위험

- API/DB 변화 없이 UI 기본값 구성에 한정. 새 서버용 기본값 파서는 Next 서버 요청에서 평가한다.
- 최초 Git Data API 게시 당시 로컬 actual Node/Browser 검증은 `NOT TESTED`였다. 현재 재개 환경의 로컬 실행 여부는 아래 F867-003 절과 원장에 분리한다.
- PR CI 시작 후 원격 정확 Head/Run/Attempt 확인은 수행하되 **완료 모니터링하지 않는다**. 실패 발생 시 #704에 따라 `docs/ISSUE_867_FAILURE_ANALYSIS.md` 누적 원장을 첫 실패 시 작성한다.

## F867-003 REWORK — 테스트 구문 교정과 최신 검증 (2026-11-03)

- 기준 실패: PR #868 / Head `410de003248c77a53a2520d87944b8a69516c141`, Base `43e97c3a4fd284b09d4c900ff8ab25e7a778c74b`, Test-Merge `8006bd13a62340acbefe8f5b4e481fc983a575f7`, [Full #3465.1 / Run 41583505545.1](https://github.com/planner77/masterGantt/actions/runs/41583505545). 누적 전체 이력·직접/파생 FAIL·SKIPPED·가설/반증은 [동일 실패 원장](../../ISSUE_867_FAILURE_ANALYSIS.md#6-f867-003--full-34651-재실패와-통합-보완-2026-11-03)에 보존한다.
- 이전 메타데이터 교정은 #3465 Preflight/QA 경로/정책 SUCCESS로 확인했다. 이번 직접 오류는 `tests/server/projects/project-issue-default-filter.test.ts` EOF의 `describe` 호출 종료 누락 하나이며 TypeScript·ESLint·Vitest에 함께 나타났다. 마지막 `}`→`});` 한 줄 수정, 기존 4개 테스트/단언/제품 코드·CI 정책 불변. 기존 suite가 오류를 검출하므로 중복 테스트는 추가하지 않는다(#711).
- 실제 실행 분담: backend Agent가 위 테스트 파일만 구현·검증, Manager가 원장/본 Packet·GitHub 기록·통합 게시, 별도 qa_docs Agent가 코드/문서/원격 실패를 읽기 전용 사전검토. `issue_comment_writer=manager`; Sub-Agent GitHub 쓰기 없음. 최종 독립 인간 QA나 Owner 수용으로 확대하지 않는다.
- 동결 source: 수정 테스트 SHA256 `8f30296bfbc9dde70ffd6ba3961fc07b756f9f2f5effbf7a80c4311a7f570034`; 기준 Head에 구문 한 줄을 적용한 제품/테스트는 고정하고 이후 원장/본 Packet만 갱신한다.
- 로컬 재현 **FAIL**: 직접 Vitest는 수정 전 원격과 동일 `Expected ')' but found EOF`, suite 수집 전 실패. 최소 수정 후 직접 4테스트 **PASS**. 직접+기존 `project-issues.test.ts`/`logging.test.ts`/`deployment-layout.test.ts` **4파일/33테스트 PASS**, 전체 `npm run typecheck` **PASS**, 직접 ESLint **PASS**, 버전 v0.139.1·Markdown393파일 링크·diff 검사 **PASS**. 명령과 선정/음성/제외는 원장 6절 참조.
- 환경 경계: 현재 Node22.14.0/npm11.10.0, 기존 root 의존성을 worktree symlink로 재사용(커밋 제외). Vitest5.0.0/TS5.8.3/ESLint9.39.5이며 Next16.3.4는 lock16.4.2와 다르다. CI Node22.23.4/npm10.9.9와 구분하고 정확 lock/frozen install·Build/E2E/Docker PASS로 사용하지 않는다. `verify:prepr` fast/diagnose는 미실행이며 로컬 전체 Unit/전체 ESLint·브라우저·컨테이너는 **NOT TESTED**다. 이번 구문 교정 영향에 맞춰 직접/인접/음성 4파일과 전체 TS로 제한했다.
- 현재 AC 검증 공백: AC1/2의 파서5종/공백·AC3의 원문 미반환·AC6의 Compose 정적 전달은 직접 Unit PASS. 실제 서버 로거 경고(AC3), `open/completed` 구성별 SSR→첫 요청/초기화·선택 유지(AC4/5), 동일 이미지 재생성·SQLite 볼륨 보존(AC6)은 **NOT TESTED**이고 일부는 테스트 미작성이다. 기존 E2E의 `all` 경로만으로 전체 환경 변형 PASS를 주장하지 않는다. AC7 API/삭제/KPI의 로컬 인접 회귀 PASS도 새 exact-head 원격 Required3를 대체하지 않는다.
- DOCUMENTATION_SYNC: 이번 delta는 테스트 구문과 원장/본 Packet이며 API/DB/아키텍처/보안/UI/운영 설정 계약은 추가 변경 없음. 위 최초 DOCUMENTATION_SYNC는 전체 PR diff의 분류를 유지하며 최신 원장/본 Packet을 함께 게시한다.
- 운영: PR #868 조사 시 충돌 없음(`mergeable=true`), unresolved review=0; 게시 직전 최신 Head/main/스레드를 재조회한다. Git/gh 로컬 인증 실패로 연결된 Git Data API 방식 B를 사용해 전체 tree·부모와 expected Head를 확인하고 Ref를 한 번 갱신한다. 새 Run/Attempt/Head/Base/Test-Merge는 Issue STATUS에 기록한다.
- 현재 `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=false` 유지. 새 Head Quality/E2E/Docker·Trusted·Manager ACCEPT=**NOT TESTED**, `MERGE_READY=BLOCKED`. 종료점은 새 PR CI 시작이며 모니터링·merge/Main/GHCR/Release/Issue 종료를 수행하지 않는다.
