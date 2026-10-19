# Issue #731 — 기존 KPI 보존과 통합 작업 원장 연결

## Issue Work Packet

- Issue: [#731](https://github.com/planner77/masterGantt/issues/731), 상위 #723, 선행 #724/#728/#729.
- baseline_sha: `01fdc08bf4b2f69f9797a8bd411d6712e7478c09` (main).
- branch: `feat/issue-731-kpi-integration` (별도 worktree; 기존 checkout/untracked 증거 보존).
- baseline_version: `0.122.0`; candidate_version: `0.123.0` (신규 KPI 통합 출처·진단의 MINOR, dependency 변경 없음).
- risk_level: HIGH; risk_reason: 기존 KPI 모집단·직접/Target·개인 Assignment 및 여러 화면 snapshot/원본 편집 복귀에 영향.
- qa_required: true; qa_method: OWNER_MANAGED; manager_decision: NOT TESTED.
- independent_qa: N/A(Owner-managed). 별도 읽기 전용 Agent의 사전 코드 검토는 원격 Trusted QA·Owner 최종 승인과 구분한다.
- release_required: true; release_authorized: false. 구현·PR CI 시작 요청은 정식 게시 승인이 아니다.
- lifecycle_phase: IMPLEMENTATION → LOCAL_FAST_FEEDBACK → DOCUMENTATION_SYNC → PRE_QA → PR_CI.
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION.
- 종료 범위: 구현·문서 갱신·로컬 빠른 검증·PR Full CI 시작. CI 완료 모니터링·병합·Main/GHCR·Finalizer·Release/tag·브랜치 정리·Issue 종료는 범위 밖.

## 소유권과 구현 경계

실제 `kpi_backend` backend는 전용 KPI read consumer/API·DTO 확장과 서버 수용 테스트, `kpi_frontend` frontend는 기존 KPI 컴포넌트·Management callback, `kpi_e2e` frontend는 직접·간접 UI fixture/spec, `kpi_ux` ui_ux는 읽기 전용 설계, Manager는 문서·통합·version·route inventory·검증·GitHub 게시를 소유한다. 공통 해석기 조사 `inspect_common`은 읽기 전용이다. 동일 파일 동시 작성과 Sub-Agent 원격 댓글은 하지 않는다.

기존 `ProjectLogisticsDashboard`를 확장한다. `GET /logistics/dashboard`의 default와 기존 Target/Resource API는 유지한다. 전용 `GET /logistics/kpi?source=integrated`는 #728 resolver 및 #729 read snapshot을 소비하고 기존 KPI 계산 authority를 재사용한다. 공통 DTO/계산기를 여기서 수정·복제하지 않는다. 저장 writer·DB migration·Gantt Core·Calendar·Gate 알고리즘·CI workflow/권한/Ruleset 변경은 없다.

## 구현 전 기능 인벤토리 → 구현 후 대응

| 구현 전 기능 | 구현 후 보존 위치·검증 |
| --- | --- |
| 대시보드 → KPI의 기존 `ProjectLogisticsDashboard` | 같은 메뉴·컴포넌트를 확장; 새 범용 트리로 교체하지 않음 |
| 기준일, 서버 timezone 기본일, 자동 기준일 복귀 | 기존 필터·기준일 표시 유지; 현재 snapshot 평가이며 과거 복원 아님 |
| 임박 기간 문자열 입력·1..90 정수 validation | 기존 입력·field error·잘못된 입력 요청0 유지 |
| direct / coordination 선택 | 기존 시스템 집계 옵션 유지; 실제 controls/coordinates 관계만 범위 확대 |
| 활성 마스터 선택·새로고침·오류 재시도 | 기존 명시 조건·요청 세대 guard 유지; 미조회/오류를0으로 표시하지 않음 |
| 기간 가중 진척·작업 수·기간 분모·전체 일정 이동 | 기존 카드·산식·정확 Task ID drill 유지 |
| 미완료 지연 Task 수·일정 이동 | 기존 종료일/asOf 비교·정확 지연 ID 유지 |
| Milestone 총수·지연/임박·경보 일정 | 기존 horizon·ID 합집합 유지 |
| 계획 투입 M/D·M/M·환산 미설정·미설정 건수·투입 일정 | 기존 계획 의미·calendar·null/0/partial 구분 유지; 설치/실적 공수로 명칭 변경하지 않음 |
| 관련 Milestone 전체 상태 표·원본/일정 명령 | full canonical membership/선행 Gate 유지; 현재 선택 분모와 구별 |
| 물류 미연결·주제어/Owner/PI 미지정·설비 등록수/수량 | 기존 품질 패널 유지; 정상 미연결을 일률 오류로 판정하지 않음 |
| 공정/설비/System 세부 탭과 표·진척/지연/공수·일정 필터 | 같은 세 표/열·keyboard roving tab 유지; 일정은 서버의 정확 Task ID로 이동 |
| loading/error/empty/readonly·최신 revision 확인 | 최신 조건과 응답 불일치 차단·복구 유지 |
| Gantt 인스턴스·일정 선택·화면 복귀 | 기존 host/editor 재사용; 조회로 remount/저장 없음 |
| 코드·UUID 조회/복사 | #717 이름 우선·접힌 IdentifierDetails 유지 |

추가 기능은 별도 접힌 구성/연결 진단이다. 등록 공정/WorkArea/설비관리단위·수량/System/참여자와 일반 Task0 대상, 미연결/미배정/공수 미설정·Owner/PI/주제어 목록을 원시 ID로 연다. 기존 표에 고정 열을 추가하지 않는다. source/version·snapshot과 선택 분모를 표시한다.

## 지표·분모와 호환

작업 KPI는 고유 일반 Task, 공수는 고유 개인 Assignment, Milestone은 별도 고유 Milestone, 구성은 등록 master ID를 사용한다. 구성·관련 Task·수량·공수·등록/배정 인원을 같은 분모로 표시하지 않는다. WorkArea 미사용·미연결은 정보성 상태다. 일반 전체 조회에서 미연결 Task를 숨기지 않는다.

동일 direct-only 원시 집합의 기존 값은 유지한다. Target-only/혼합으로 포함 작업이 늘 때 source basis를 명시한다. 신규 W2 공정 축은 Task의 명시 공정0..N이며 기존 설비/System 구성 유도 공정과 다를 수 있다. 동일 집합의 수치 보존과 새로운 집합의 범위 변화를 구별한다. E10의 여러 WorkArea 소속은 상위 수량10이며, 같은5 M/D Task가 두 공정에 보여도 전체는5다. MCS 공유 작업 연관은 원가 배분이나 controls를 생성하지 않는다.

## Design Delta B와 상태 정합성

기존 Light UI/system font/semantic token, 이름 우선, 상황형 도움말, native disclosure, 44px control과 표 소유 scroll을 적용한다. DESIGN.md는 새 전역 원칙이 없어 N/A다. 기존 품질 패널은 유지하고 추가 진단만 접는다. 공정/설비/System의 전체 열 예산과 긴 이름·390/768/1024/1440/1920px를 검증한다.

출발 조건/source/snapshot·탭·선택 진단은 KPI mount에 유지한다. Task/Assignment/master는 정확 ID로 기존 편집/관리 경로를 사용한다. revision/source 교체 시 이전 숫자·drill을 숨기고 최신 조회가 필요함을 안내한다. 숨긴 Gantt를 재생성하거나 새 viewport writer를 만들지 않는다. 적용 GSC: 동일 인스턴스·canonical gateway·source stale·기존 복귀 lease/focus 계약. 실제 관측과 미검증은 실행 원장에 기록한다.

## AC_TEST_COVERAGE

- AC1: 위 기능 보존표, 기존 `logistics-dashboard-request-state.spec.ts` 및 KPI 직접 소비 fixture.
- AC2: 신규 서버 `issue-731` 수용 및 #728/#729 golden 회귀; Target0/Target-only/혼합·직접/상속/공유·조율·Task/Assignment 합집합.
- AC3: 신규 서버 exact 진단 ID와 새 UI 진단 drill; 구성수/작업수/수량/공수/등록인원·배정인원 분모.
- AC4: 기존 logistics 계산·Resource KPI·Milestone full Gate 회귀 및 신규 통합 source 비교.
- AC5: 확장한 기존 request-state UI spec·관련 Milestone/도움말 소비자; 원본 편집/일정/복귀·stale/error/readonly/empty·5폭·keyboard·열 예산.
- AC6: LOGISTICS_DASHBOARD·WBS 지표사전·PROJECT_UX·사용자 가이드·TEST_PLAN·CHANGELOG·Work Packet과 실제 구현 대조.

테스트 존재는 PASS가 아니다. 원격 quality/e2e/docker·Trusted QA·Owner ACCEPT는 NOT TESTED로 유지한다.

## DOCUMENTATION_SYNC

작성자 Manager. 관련 계약·구현 대조 및 Markdown 링크 검증을 수행하고 원격 QA/Owner 승인과 구분한다.

- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/WBS_TASK_LEDGER.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_731.md`: UPDATED
- `DESIGN.md`: N/A(기존 Light UI·이름 우선·native disclosure·내부 scroll 원칙 구체화이며 새 전역 정책 없음)
- `AGENTS.md`: N/A(기존 역할·OWNER_MANAGED·CI 시작 종료 경계 준수이며 실행 지침 자체 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 HIGH·OWNER_MANAGED·Trusted QA·Owner 최종 승인 경계를 유지)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 PR CI 시작 단계까지만 수행하며 lifecycle 계약 불변)
- `docs/DB_SCHEMA.md`: N/A(기존 관계를 한 read transaction으로 조회하며 저장 schema·migration 불변)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Calendar·공수·full Milestone Gate authority 재사용; 테스트 mock warmup만 갱신)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Import·Export·Copy·Template writer와 교환 계약 불변)
- `docs/IMPORT_SCHEMA.md`: N/A(새 KPI는 read consumer이고 import schema·parser·저장 계약 불변)
- `docs/EXCEL_EXPORT.md`: N/A(기존 Excel writer·source/기간/current/project 범위 불변)
- `docs/REQUIREMENTS.md`: N/A(기존 WBS 중심 요구의 KPI 소비 구현이며 신규 도메인/전역 정책 없음)
- `docs/CI_CD.md`: N/A(Required Quality/E2E6/Docker·workflow·Main/GHCR·release 계약 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 원격 gate와 환경별 증거 규약 유지; 완료 모니터링은 요청 범위 밖)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical Refs·branch/title trace·묶음 게시·승인 경계 유지)

## 누적 실행·실패 원장

로컬 최초 실패는 원격 CI 실패와 구분한다. #731 원격 PR CI는 아직 시작 전이며 원격 실패를 주장하거나 없는 run을 생성하지 않는다.

- GitHub CLI 조회는 HTTP401 Bad credentials. 연결 GitHub 도구로 원본 Issue/댓글 조회·PLAN 게시, Git fetch는 성공. 인증값 출력/변경 없음.
- 환경 초기 검증에서 기존 checkout node_modules symlink는 현재 lock과 불일치하여 `npm ls --depth=0 --offline` FAIL. symlink만 제거하고 전용 worktree `npm ci --prefer-offline --no-audit`로447 packages 설치 성공(12초). 기존 checkout dependency는 변경하지 않음. eslint deprecation 경고는 원문 그대로 보존.
- 구현/검증 진행 중. 로컬 최초 실패와 수정 후 결과를 누적 기록하며 이전 실패를 성공으로 덮지 않는다.

- 서버 fixture 최초 실패: 공수 설정0 시나리오에서 DB가 금지하는 allocation0 또는 Calendar rule enum `permanent`/잘못된 scope를 사용해 CHECK constraint FAIL. 실제 기존 계약의 `FULL_PROJECT` 및 `NON_WORKING` 달력으로 설정된0 M/D를 생성하도록 fixture를 수정했다. 제품 제약을 완화하지 않았다. 동시 수정 중 QA 실행93 PASS/1 FAIL은 최종 동결 증거가 아니며 이후 재실행94 PASS로 구분한다.
- 구현 사전 검토에서 공정 선택에 따른 full Gate 원본 누락 위험, process 수식 복제/반올림 차이, Milestone source 검증 누락, 상위 controlled master 이동 누락 및 KPI 출발 source 인계 누락을 확인해 수정했다. 기존 authority 재사용·동일 Task 집합의 원행 재사용·전체 Gate/전용 source 검증으로 보강했다.
- 초기 UI 실행:17 PASS/6 FAIL(새 navigation scope/query mock 부재와 작업 중 WorkArea DTO 확장), 중간 실행8 PASS/4 FAIL/1 interrupted(변경 중 ReferenceError), 안정화25실행20 PASS/5 FAIL(readonly Assignment edit를 enabled로 기대한 테스트 oracle), 이어10실행9 PASS/1 FAIL(readonly input을 disabled로 기대한 oracle). production readonly 정책은 유지하고 테스트를 disabled/readonly 구분에 맞게 수정했다. 같은 원인 재실행을 고유 케이스 수로 합산하지 않는다.
- `qa_preflight.py --help` 진단 호출은 실제 help parser가 없어 event 누락 BLOCKED를 반환했다. 실제 QA/CI 실행 증거가 아니며 생성한 임시 report는 정리했다. PR metadata gate의 local 구조 검증은 별도 수행한다.


## 최종 로컬 검증과 인계

- 동결 source: [파일별 SHA256·검증 요약](../../evidence/issue-731/local-validation.json). 최종 commit HEAD는 PR/Issue 시작 증거 댓글에서 연결한다. 아래 반복 실행은 고유 케이스에 합산하지 않는다.
- 서버 직접/간접·음성 회귀:6파일94/94 PASS. 신규 KPI14는94에 포함. [원본 JSON](../../evidence/issue-731/unit-results.json). `issue-731-kpi`, 기존 `logistics-dashboard`, `wbs-task-ledger`, `wbs-task-ledger-acceptance`, `wbs-dashboard-views-http`, `edit-authorization-handlers`를 한 번에 실행했다. migrated SQLite→production Handler→실제 Node HTTP socket은 Next 브라우저 API의 실제 네트워크 실행과 구별한다.
- UI: 최종27/27 PASS,0FAIL/0flaky/0skipped,84.0999초. [브라우저 영수증](../../../output/playwright/issue-731/local-ui-receipt.json). `logistics-dashboard-request-state.spec.ts`와 #719 logistics 도움말에 한정했다. 오류/invalid/응답역전·기간 validation/tab keyboard·5폭·readonly·empty·원본 Task/Assignment 취소·정확 schedule/source lease/return focus·Resource/process/WorkArea 관리 왕복을 확인했다. fixture로 mock한 합성 API이며 실운영 데이터/HTTP 브라우저 E2E로 확대하지 않는다.
- 390/768/1024/1440/1920px [화면·열 예산 JSON](../../../output/playwright/issue-731). 실제 DOM의6개 공정 열·표 내부 scroll·문서 overflow·focus 및 동일 Gantt root를 확인했다. 추가 진단에 표 고정 열을 늘리지 않았다. 최종 screen reader·실기기·운영 UX는 NOT TESTED다.
- `tsc --noEmit --incremental false`: PASS. `npm run lint`: exit0,0error/기존 미수정 파일13warning. 변경 파일의 scoped ESLint도 PASS.
- frozen dependency·version0.123.0·Markdown268파일 링크·test discovery·diff check: PASS. QA helper의 `docs_gate` 직접 호출은 DOCUMENTATION_SYNC 구조/AC1~6 매핑만 통과하며 의미 QA·Owner ACCEPT와 구분한다.
- 독립 `kpi_review` qa_docs 사전 검토: 미해결 P1/P2 0. 위94case 직접 실행과 source/문서 교차 검토. 최종 Trusted QA·Owner 승인·독립 인간 QA PASS를 의미하지 않는다.

### Pre-PR 자동 선정 BLOCKED와 수동 영향 매핑

실제 `verify:prepr --mode=fast`·`--mode=targeted`, base=origin/main, issue731, riskHIGH를 각각 실행했다. 둘 모두 UNKNOWN8/missing0·실행step0·sourceStable=true로 BLOCKED다. [fast 원본](../../evidence/issue-731/prepr-fast.json) / [targeted 원본](../../evidence/issue-731/prepr-targeted.json). 자동 map/gate를 수정하거나 이 결과를 PASS로 전환하지 않았다.

| UNKNOWN producer | 실제 직접·인접·음성 소비자와 실행 |
| --- | --- |
| `src/contracts/logistics-dashboard.ts` | 신규 KPI API14 + legacy/full Gate/WBS/route6파일94, malformed/missing-integrated UI |
| `src/features/logistics/logistics-kpi-configuration.tsx` | 5폭·exact Task/Assignment·master/WorkArea/Resource·readonly·empty·stale UI |
| `src/features/logistics/logistics-kpi-validation.ts` | malformed-integrated/missing-integrated·현재 필터/revision 불일치·snapshot source stale UI |
| `src/features/logistics/project-logistics-dashboard.module.css` | 5폭 긴 이름·table-owned scroll·열 예산·document overflow·keyboard focus |
| `src/features/logistics/project-logistics-dashboard.tsx` | 기존 네 카드/세 표/조건·request-state·Milestone server full Gate·정확 schedule/source/return |
| `src/features/logistics/project-logistics-management.tsx` | master process/WorkArea/Resource 정확 원본/복귀·Task/Assignment editor·#719 help UI |
| `tests/e2e/fixtures/task-editor-density.ts` | 기존 JSX KPI read envelope만 warm-up. 타입/정적검사 PASS; 해당 전체 density spec은 공식 PR CI로 인계, 로컬 NOT TESTED |
| `tests/fixtures/logistics-integrated-kpi.ts` | 위 request-state 및 #719 직접 사용27case. 다른 Milestone/time-axis mock warm-up은 strict 타입·정적 대조, 해당 전체 browser spec은 PR CI로 인계 |

직접 API/브라우저94+27case의 PASS는 위 자동 선정 BLOCKED와 별도다. 전체 Unit/E2E6·production build·Docker/SQLite restart·Trusted·strict main/Owner 승인·운영 환경은 PR/환경별 실제 증거가 필요하다. 미실행을 숨기거나 timeout/retry/skip·테스트 단언·CI gate를 완화하지 않았다.

## PR #746 원격 F-001 및 Codex P2 REWORK (2026-10-19)

- [Full CI #2997.1](https://github.com/planner77/masterGantt/actions/runs/39206611413) · attempt1, Head ddfbb26791889876306d3b8e178e9a8729f46165, base 01fdc08bf4b2f69f9797a8bd411d6712e7478c09, test merge 5b56630436448a2bc402e42956f7a0d061957b78. Required Quality/E2E6/Docker SUCCESS, QA Final [job 117919094703](https://github.com/planner77/masterGantt/actions/runs/39206611413/job/117919094703) FAILURE, 사유 '미해결 review thread'. 이전 '원격 PR CI 시작 전'은 최초 개발 당시의 기록이며 이 절이 후속이다.
- [Codex P2 지적](https://github.com/planner77/masterGantt/pull/746#discussion_r4310736228): WorkArea 구성 taskIds에 현재 KPI 선택 집합 included를 교차하여 관련 Task와 personal Assignment 원본이 KPI 필터를 바꾸면 사라지는 PRODUCT 분모 결함. 다른 configuration.targets는 이미 full canonical 범위를 따른다. QA Final의 리뷰0 보호 차단은 올바른 정책 동작이었다.
- 제품 교정: src/server/logistics/logistics-kpi-service-core.ts의 WorkArea 관계를 ordinaryRows 전체와 원본 개인 assignments로 계산한다. KPI 선택 집합과 진척·공수/진단·full Milestone Gate·Target0/Target-only/혼합, activeOnly 구성 master 및 구 API default는 변경하지 않는다.
- 테스트 추가: tests/server/logistics/issue-731-kpi.test.ts에서 direct/target/mixed × process/equipment/system/taskAssignee/role 다섯 필터의 WorkArea Task/Assignment full 드릴 불변 및 선택 KPI에서 T3/A3가 제외되어도 구역 구성에는 존재하는 경계를 검증한다. 수정 파일 Blob 6f0f2dd8204e107de689dae5312cc78ff7d064b1, 테스트 Blob 07d916b5dd864d1c66f76b00af9294fbe42c9e7b.
- 새 단일 실패 원장 [docs/ISSUE_731_FAILURE_ANALYSIS.md](../../ISSUE_731_FAILURE_ANALYSIS.md)에 원본 Job/Shard/분류/로컬 과거 오류와 미검증을 보존했다. docs/API.md·docs/LOGISTICS_DASHBOARD.md·docs/TEST_PLAN.md와 함께 동기화했고, DESIGN/AGENTS/CI/Ruleset/DB/Scheduling 문서는 새 전역 정책이나 해당 경계의 변경이 없어 N/A(reason). 기존 증거를 소급 변경하지 않는다.
- 최종 HEAD 로컬 Vitest/Typecheck/Chromium 등은 연결 GitHub 도구에서 직접 실행할 환경이 없어 NOT TESTED. 이전 동결 Head의 서버94/94·Chromium27/27과 원격 Required PASS를 새 Head 증거로 전용하지 않는다. 새로운 Full PR CI/Trusted QA·Owner ACCEPT는 완료 증거 전 NOT TESTED.
- 발표 방식: 기존 PR Head에 한 논리적 Git Data commit을 비강제로 게시, 지적 스레드에 구현·테스트 근거 회신 및 resolve 후 main 정렬/충돌·review0 확인, 새 Full CI 시작 Run/Attempt만 확인. 병합/Main/GHCR/Finalizer/Issue 종료/정식 릴리스 승인 없음.
