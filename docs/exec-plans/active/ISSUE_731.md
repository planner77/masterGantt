# Issue #731 — 기존 KPI 보존과 통합 작업 원장 연결

## 현재 재개 — Main #3011.1 / M-003 (2026-10-19)

- 현재 baseline: `0aa1d3d71f13df6976539ef4ebaaadb9037121c4`, branch: `fix/issue-731-main-ci-cumulative`, application version: `0.123.0` 불변. 아래 최초 구현/과거 재개의 SHA·로컬/원격 상태는 당시 기록이며 새 Head의 증거가 아니다.
- [단일 누적 실패 원장 §11](../../ISSUE_731_FAILURE_ANALYSIS.md#11-m-003--pr-749-병합-main-30111의-시간-예산저장-후-조회-실패)에 관련 PR #746/#748/#749와 source CI10개·각 attempt1 전체를 교차 분석한다. 공유 분석과 실제 Run/Trace를 대조했으며, 최신 Docker aggregate SUCCESS는 구현 SKIPPED이므로 runtime smoke PASS로 보고하지 않는다.
- 이번 변경은 E2E 두 파일의 테스트 구성·응답 수명·저장 후 HTTP 조회/관측 보완이다. #623 golden/Excel과 여섯 mutation을 각각 독립 fixture의60초 case로 나누고 workbook bytes를 한 번 읽는다. 기존 다섯 폭은 폭별 독립30초 case에 tree→matrix 두 모드와 원본/keyboard/query0를 유지한다. Task Editor 후행 canonical GET6곳은 실제 same-origin browser/no-store·observer를 재사용하며 setup GET3곳은 유지한다. 제품·API·DB·CI/QA 정책·version 변경은 없다.
- 실제 역할: `731_ci_audit` infra 읽기 전용 전체 원격 이력 조사, `731_excel_budget` frontend #623 spec, `731_editor_transport` frontend persistence spec, `731_rework_qa` qa_docs 독립 읽기 전용 사전 검토, Manager 통합·문서·검증·GitHub 게시. 코드 소유권은 분리하고 Sub-Agent는 원격 댓글을 쓰지 않는다.
- 누적 실패 파일5개 전체를 동일 source에서 workers1/retries0/max-failures0으로 실행하고, 과거 실패 경계의 별도 새 프로세스 실행과 helper·원본 구성 음성 회귀를 구분한다. 최초 로컬 실패/정적 오류도 원장에 누적한다. 한 로컬 host의 PASS는 GitHub 독립 runner·연속 Main 안정성·Required3 PASS가 아니다.
- 위험/종료: HIGH / OWNER_MANAGED / qa_required=true / manager_decision=NOT TESTED / release_required=true / release_authorized=false. 리뷰·충돌0 및 새 Full PR CI 시작까지만 확인하고 CI 완료 모니터링·병합·Main/GHCR·Finalizer·Release/tag·Issue 종료는 수행하지 않는다.

## Issue Work Packet (최초 구현 당시)

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

현재 M-003 수정 묶음의 영향 기록이다. 최초 구현의 제품 계약 갱신은 기존 main에 포함되어 있으며 이번 E2E 전송/시간 예산 보완으로 다시 변경하지 않는다. Manager가 코드·문서 대조, 링크와 docs_gate 구조 검증을 수행하며 의미 검토/원격 Trusted/Owner 승인과 구분한다.

- `docs/ISSUE_731_FAILURE_ANALYSIS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_731.md`: UPDATED
- `docs/LOGISTICS_DASHBOARD.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/WBS_TASK_LEDGER.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/RESOURCE_KPI_DASHBOARD.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/PROJECT_UX.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/API.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/ARCHITECTURE.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/SECURITY.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `DESIGN.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `AGENTS.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/REQUIREMENTS.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/CI_CD.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(E2E 구성·응답 수명·저장 후 조회 관측만 보완하며 제품·공개 계약·정책·버전 변경 없음)

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

## F-002 — PR #746 CI #2998.1 Chromium Shard4 reset 및 테스트 transport 보완 (2026-10-19)

- [#2998.1 Run 39211001676](https://github.com/planner77/masterGantt/actions/runs/39211001676), attempt1, Head d2a90cd43a601afc1de99b8653d4f6d8ced6f304, base 01fdc08bf4b2f69f9797a8bd411d6712e7478c09, test merge d9fe866487184f94d7659d70dbfaac52edb95f73. Quality/Docker SUCCESS, actual E2E Shard4 [job 117924772746](https://github.com/planner77/masterGantt/actions/runs/39211001676/job/117924772746) FAIL, 나머지 Shard5개 CANCELLED, E2E aggregate 및 QA Final(사유 required e2e 미성공) FAIL. 미해결 리뷰 thread0은 유지됨. F-001과 F-002 결과 분리.
- 최초 실제 오류: tests/e2e/issue-726-task-logistics.spec.ts:262의 readContext(line244), 성공한 저장 PUT200 뒤 GET process-context 중 Playwright APIRequestContext 'read ECONNRESET'. [원본 Playwright artifact 12167294969](https://github.com/planner77/masterGantt/actions/runs/39211001676/artifacts/12167294969)의 trace와 격리 safe diagnostic을 확인함. health200·CLI process alive·cgroup OOM/OOM Kill 증가0이며 Next child RSS 증가만으로 worker restart나 OOM을 단정하지 않는다. product/write failure 판정 UNKNOWN, 관찰 오류 category INIT_TRANSPORT.
- #667의 UI 이후 canonical browser transport 선례 재사용. #726 E2E 파일에서 해당 **실제 페이지 진입 후** canonical GET helper를 page.evaluate same-origin fetch(cache:no-store, credentials:same-origin)로 전환하고 기존 observeIsolatedApi로 안전 관측한다. HTTP200/유효 JSON/실제 data.context와 exact processLinks·workAreaLinks·저장/초안/403/409/412/readonly/5폭/중복쓰기 단언 유지. 실제 API mock/GET 성공 가장/재시도/timeout 증가/skip/Required gate 변경 없음.
- 변경: tests/e2e/issue-726-task-logistics.spec.ts Blob bbad2bcf5339496fab8c24f2b6b06fbceab93513 및 docs/ISSUE_731_FAILURE_ANALYSIS.md 누적 F-002, docs/TEST_PLAN.md 변경 영향/교차 회귀, 이 Work Packet. 제품 src/API/DB/CI/QA/scheduling/Gantt Core·application version 변경0. 타 이슈 #726의 과거 원장/소유권은 변경하지 않고 #731에서 CI 실패에 노출된 인접 테스트 전송 경계만 교정.
- F-001(review/Product)과 F-002(E2E/transport UNKNOWN)의 모든 실제 Run/Job/Shard·실패/취소/미실행과 수정 후보는 [정규 #731 실패 원장](../../ISSUE_731_FAILURE_ANALYSIS.md)에서 Cross-run 대조. #667/#726 과거 선례는 원본 연결만 참조하며 #731 실패 수에 합산하지 않음.
- DOCUMENTATION_SYNC: docs/ISSUE_731_FAILURE_ANALYSIS.md NEW/APPENDED, docs/TEST_PLAN.md UPDATED, docs/exec-plans/active/ISSUE_731.md UPDATED; docs/API/LOGISTICS_DASHBOARD/DESIGN/AGENTS/CI_CD/DB_SCHEMA/SECURITY/CHANGELOG/UI manual은 제품 계약·UI·전역 원칙·version 변경0으로 N/A(reason). 별도 qa_docs/Trusted/Owner 승인은 수행 전 NOT TESTED.
- 테스트 도구 경계: GitHub connector-only 환경이므로 **새 Head 로컬 Vitest/tsc/Playwright/HTTP 실실행 NOT TESTED**. 원래 #2998 Unit/Build/Docker PASS 및 #2997 E2E6 PASS는 이 변경 Head의 검증으로 합산하지 않음. 새 전체6-shard PR CI의 Run/Attempt/Head/base/test-merge와 시작만 확인, 이후 모니터링/병합/Main/GHCR/Finalizer/Release·Issue close 미실행. HIGH / OWNER_MANAGED / release_authorized=false 유지.

## F-003 — PR #746 Full CI #2999.1 nullable 공정 관계 타입 검사 실패·후속 보완 (2026-10-19)

- **원본:** [#2999.1 / Run 39212770619](https://github.com/planner77/masterGantt/actions/runs/39212770619), attempt1, Head dd493bd1d973afe8eff80c053a03cd2096ff7afd, base 01fdc08bf4b2f69f9797a8bd411d6712e7478c09, test merge 8af177db944fa36e1163f608bf712a2789a50f32. `npm run typecheck` job117929793086 step7에서 `tests/e2e/issue-726-task-logistics.spec.ts(370,14) TS2488: TaskProcessLink[] | null` 컴파일 실패. QA Preflight·정책·ESLint·Vitest SUCCESS, Fast Gate job117930281120 FAILURE, Required Quality/E2E/Docker+QA Final 파생 FAILURE. **실제 E2E6/PR Build/PR Docker 실행 SKIPPED**, cancel아님. 기존 F-001(review), F-002(실제 Shard4 ECONNRESET)와 다르게 분류.
- **원인:** 이전 F-002의 same-origin canonical `readContext`가 명시 `TaskProcessContextResponse`로 타입 강화를 수행했고, 기존 spread `[...childContext.processLinks]` 앞에 `null`(legacy 미설정) 확인이 빠졌다. 제품/DTO nullable 의미 오류가 아닌 **TEST_CONTRACT**. 초기 legacy `null`과 명시된0 `[]`를 구분해야 하므로 DTO를 완화하거나 `as`/non-null assertion으로 우회하지 않는다.
- **보완:** `tests/e2e/issue-726-task-logistics.spec.ts` 저장후 `savedProcessLinks`에 `null`이면 정확한 오류를 던지는 runtime guard를 두고 그 다음에는 TypeScript가 안전한 배열로 좁히도록 한다. 정확 2개 UUID/self scope 정렬 단언, 기존 WorkArea·상속/초안·중복·403/409/412·readonly·5폭·browser same-origin/no-store·observeIsolatedApi는 전부 유지한다. 수정 Blob 4669f12e743d87c1ff93e717a7586c0577434263.
- **이슈별 실패 원장:** [docs/ISSUE_731_FAILURE_ANALYSIS.md](../../ISSUE_731_FAILURE_ANALYSIS.md) §7 F-003 및 Cross-run 매트릭스; `docs/TEST_PLAN.md`의 #731 F-003 회귀 선정, 본 Work Packet. 기존 F-001~002와 원본 실패 증거 불변. 타 Issue #726/#667의 과거 이력은 참고만 하며 본 이슈 실패 횟수에 합산하지 않음.
- **검증:** 저장소 실제 TypeScript/Vitest/Playwright/Docker는 connector-only 환경이라 NOT TESTED. Node22 전역 `tsc --strict --noEmit` 별도 최소 재현은 guard 뒤 `TaskProcessLink[] | null` narrowing PASS(본 repo 타입 검사 PASS 아님). 소스 정적 앵커·원래 legacy null/explicit0·정확 array 단언·same-origin 검증 경로 보존 확인. 새 Full PR CI는 HEAD 게시 후 시작/Run·Attempt까지만 확인하며 완료 감시는 하지 않음.
- **DOCUMENTATION_SYNC:** docs/ISSUE_731_FAILURE_ANALYSIS.md APPENDED, docs/TEST_PLAN.md UPDATED, docs/exec-plans/active/ISSUE_731.md UPDATED. AGENTS/CI_CD/QA/DB_SCHEMA/API/DESIGN/USER_GUIDE/CHANGELOG 및 PRODUCT src는 기존 계약·버전0.123.0·전역 원칙 불변으로 N/A(reason). PR main strict·review threads0·충돌 해소와 Git Tree 비교 후 한 non-force logical commit 게시. release_authorized=false / HIGH OWNER_MANAGED, 새로운 Required/Trusted/Owner ACCEPT NOT TESTED, 병합/Main/GHCR/Finalizer/Issue 종료 없음.

## M-001 — 병합 이후 Main CI #3002.1의 #731 KPI 원본 행 포커스 실패 (2026-10-19)

- **원격 출처**: [원 PR #746](https://github.com/planner77/masterGantt/pull/746) Head `0f844136f8975f6a7e0c246985bd384ea48b43ab`, PR Full [#3000.1](https://github.com/planner77/masterGantt/actions/runs/39213900305) 6-shard/Quality/Docker PASS + Trusted [#643.1](https://github.com/planner77/masterGantt/actions/runs/39217128743) PASS → Main merge `fbe7db83a4baa2877a75db0769a59077bbe308c4`의 [Main #3002.1 / 39218195042 attempt1](https://github.com/planner77/masterGantt/actions/runs/39218195042) FAIL. Main Quality/Docker PASS, Shard1~5 PASS, Shard6 job `117947043171` 실제 125 PASS/1 FAIL, E2E aggregate `117957329601` FAIL, Main GHCR job SKIPPED. 이 실패를 이전 F-001~F-003 PR 이력과 **같은 #731 실패 원장의 별도 M-001 절**로 누적한다.
- **최초 오류:** `tests/e2e/logistics-dashboard-request-state.spec.ts:411/424`, '공정·WorkArea 원본 이동'에서 `#logistics-master-process-proc-1` visible PASS, focused FAIL(inactive, 5s). [원본 trace artifact 12171083540](https://github.com/planner77/masterGantt/actions/runs/39218195042/artifacts/12171083540). 정확한 공정 행 생성은 관측되었으나 포커스 복원은 증명되지 않음.
- **원인 경계:** source `openKpiMaster`는 click-time 단일 rAF로 `focus`하나 상위 parent `onSubviewChange`→`setActiveScreen`이 별도 React state commit을 거친다. rAF가 panel 가시화보다 앞서 실행되는 경합은 유력한 가설이지만, 원격 trace만으로 어느 이벤트가 focus를 가로챘는지 단정하지 않는다. HTTP/SQLite·KPI 집계/권한·API 오류로 해석할 로그 없음. Main 전용 runner/시간차가 드러낸 실제 기능 회귀를 flaky로 무시하지 않는다.
- **보완:** `src/features/logistics/project-logistics-management.tsx`의 click-time rAF를 제거하고, canonical `kind/id/revision`·정확 subview가 React commit되었을 때만 한정된 8 frame/실제 가시 행을 확인해 focus 결과를 보존한다. 후속 사용자 입력 또는 돌아가기를 새 자동 focus가 덮지 않도록 stale request는 폐기. `tests/e2e/logistics-dashboard-request-state.spec.ts` 기존 두 label의 정확 공정 원본/키보드 focus를 유지하고 commit 후 연속 두 frame의 focus 안정성 및 후속 수동 버튼 focus 보존을 추가.
- **영향 및 음성 회귀:** #731 KPI 통합 source/diagnostics·WorkArea↔process, equipment/system 마스터 원본, #724 parent 화면 전환, #725 공정/다중 WorkArea, #726 Task links, #717 tab focus, #667 async/DOM focus, readonly·미존재/필터/비활성 원본·stale revision, 390/768/1024/1440/1920px 및 원래 dashboard 431줄 spec 전체. 누적 F-002 실패 spec, 서버 #731 canonical KPI, Required Quality/E2E6/Docker/GHCR 검증 경계를 따로 선정. Native Gantt/DB writer/일정 계산기/CI workflow/Ruleset·timeout/skip/retry 변경 없음.
- **인계 및 승인:** 현재 merged PR #746은 재사용 불가; `main=fbe7db83...`에서 같은 Issue `Refs #731` 교정 branch/PR, 전체 PR CI/Trusted QA/HIGH Owner 수용·review0/strict main을 통과한 **새 merge SHA**에서만 새 push Main CI가 시작된다. 원본 #3002 rerun은 코드 보완을 적용하지 않음. 코드·문서의 Git Data Blob/Tree 구조검사는 연결 도구로 수행하되 실제 로컬 npm/TypeScript/Playwright·QA 의미 검증은 NOT TESTED. `release_authorized=false`이므로 정식 v0.123.0 tag/GHCR 및 Issue 종료는 보류, 이전 PR/Main 실제 결과를 바꾸지 않음.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_731_FAILURE_ANALYSIS.md` M-001, `docs/TEST_PLAN.md`, `docs/PROJECT_UX.md`, `CHANGELOG.md`, 이 Work Packet을 함께 갱신. `DESIGN.md` 전역 시각 규칙 불변(N/A); API/DB/SECURITY/실제 #720 manual 페이지 새 경로 없음(N/A). HIGH/OWNER_MANAGED, release_required=true, release_authorized=false 보존.

## F-004 — PR #748 CI #3004.1 미해결 Codex P1·포커스 재시도 범위 보완 (2026-10-19)

- [교정 PR #748](https://github.com/planner77/masterGantt/pull/748), Head `33692194d31b9cc4b6aba82cbeb31e99f7b197fb`, base(main) `fbe7db83a4baa2877a75db0769a59077bbe308c4`, test merge `9de5652f25880295f60a827f00ba2788f148dc0c`. [Full CI #3004.1 / Run39223658039 attempt1](https://github.com/planner77/masterGantt/actions/runs/39223658039)은 Required Quality(E2E와 별도), E2E6 Shards, Docker 모두 **SUCCESS**. 그러나 QA Final job117974637296 step3에서 **미해결 review thread**를 탐지해 BLOCKED/FAILURE, 제품 테스트·Build 실패 없음.
- [Codex P1 comment4311801144](https://github.com/planner77/masterGantt/pull/748#discussion_r4311801144) / `PRRT_kwDOUUB7Bc6t10yb`: `project-logistics-management.tsx`의 `focusAfterCommit`는 `focused.closest(`#panel-${view}`)` 조건 때문에 destination table 하위가 **아닌** 검색창, KPI 복귀 버튼, workspace tab 등에 새 유효 focus가 있을 때 진행 중인 bounded rAF가 원본 row로 초점을 다시 훔칠 수 있다. PRODUCT 위험 + unresolved P1 감지 POLICY_CI 정상 차단을 분리. M-001 클릭시 rAF 실패와 달리 포커스 **가로채기** 범위 누락.
- 최소 제품 변경은 위 panel-limited 조건만 제거하여 같은 origin trigger/body/target 예외와 `isVisibleFocusTarget`의 connected/visible/enabled guard는 보존. 정확 kind/id/revision·activeTab·8frame bounded·returnToKpi 원래 진단 focus·올바른 canonical 원본/readonly·stale guard, 서버/DB/API/Gantt Core·CI policy/timeout/skip/retry를 변경하지 않는다.
- `tests/e2e/logistics-dashboard-request-state.spec.ts`: 기존 두 공정/WorkArea 왕복 및 두 animation frame 안정성·수동 돌아가기 focus를 그대로 두고, 렌더 뒤 검색창과 KPI 복귀 버튼을 table 외부에서 **row pending 중 명시 focus**할 때 후속 rAF가 가로채지 못하는 통제 E2E 2개를 추가. 일시적으로 정확 행 display:none을 적용했다가 MutationObserver에서 새 유효 sibling focus를 확인하면 제거한다. 두 프레임 뒤 해당 focus 유지, 원래 행 비초점·원본 콘텐츠·돌아가기·revision40을 검증. 원래 5초/권한/상태·숫자·제품 API 검증은 완화하지 않는다.
- 누적 [단일 #731 실패 원장](../../ISSUE_731_FAILURE_ANALYSIS.md) §9 F-004는 기존 F-001 review, F-002 ECONNRESET, F-003 TS2488 및 Main M-001 original focus FAIL 전력을 **모두 보존**하고 #748 Run/Job/6 Shard/QA 파생 실패와 미해결 P1/보완 근거를 기록. #746 PR 성공·#3002 Main 실패·#3004 Full PR 성공/QA BLOCKED는 서로 다른 immutable 소스·게이트.
- 직접/간접·음성 영향: #731 integrated KPI 진단 Master 원본, #725 WorkArea→공정, #724 parent subview/상위 tab, #717 focus, #667 focus/ECONNRESET과 #726 진단, #728/#729 canonical source·snapshot, 검색·복귀 버튼·새 사용자 초점·readonly/hidden/inert/없어진 행/다른 revision. 실제 로컬 TypeScript/Vitest/Chromium/HTTP는 연결 GitHub Git Data-only 환경이라 **NOT TESTED**; QA/Owner도 새 Head 전 NOT TESTED.
- 문서: `docs/ISSUE_731_FAILURE_ANALYSIS.md`, `docs/TEST_PLAN.md`, `docs/PROJECT_UX.md`, `CHANGELOG.md`, Work Packet 동기화. 신규 API/schema, 버전0.123.0, 전역 DESIGN 지침 변경 없어 각각 N/A(reason). 최신 main/base strict·미해결 리뷰0·충돌0 확인 뒤 한 commit으로 게시해 새 Full PR CI 시작까지만 확인. `release_required=true`/`release_authorized=false`, HIGH/OWNER_MANAGED, GHCR/Finalizer/Issue 종료·정식 버전 릴리스 금지.

## M-002 — 병합 Main CI #3007.1 설비 동적 API 재시작 준비/유형화 보완 (2026-10-19)

- **원격**: 최초 PR #746 merged `fbe7db83a4baa2877a75db0769a59077bbe308c4`; 뒤따르는 교정 PR #748 Full [#3006.1](https://github.com/planner77/masterGantt/actions/runs/39228359207) Quality/E2E6/Docker/Trusted PASS, merge `a0297cd4b01e0083273ad3444edc7fa1ed0a145f`; 하지만 [Main #3007.1 / Run39232888704](https://github.com/planner77/masterGantt/actions/runs/39232888704) attempt1의 shard3 실제 #725 E10 E2E에서 **재시작 후 설비 PATCH HTML HTTP404**. 재시작 전 같은 PATCH 200/JSON. Quality/Docker·5Shard SUCCESS, Shard3 101PASS/1FAIL/1SKIP, E2E aggregate FAILURE·GHCR skipped. 정확 Next.js dev 동적 router 미등록 원인은 UNKNOWN; 기존 #731 KPI 계산/Focus와 단일 제품 버그로 묶지 않음.
- **기존 모든 실패 대조:** [같은 #731 실패 원장](../../ISSUE_731_FAILURE_ANALYSIS.md)에서 F-001 WorkArea 원본 P2, F-002 #726 ECONNRESET, F-003 nullable TS, Main M-001 KPI 원본 포커스, F-004 다른 P1/신규 사용자 focus, 이번 Main M-002의 해당 Run/Job/Shard·바디 없는 HTTP 상태 및 #725 독립 원장 비교. 직접 실패 파일 합집합에 `tests/e2e/issue-725-process-workareas.spec.ts` 추가. 이전 실패·원본 PASS를 새 HEAD로 승격하지 않음.
- **보완 범위:** 외부 운영 제품 `src/` 코드/DB/React/SVAR/권한/WorkArea 관계·정식 version0.123.0/CI workflow 변경0. `tests/e2e/fixtures/isolated-application.ts`의 restart는 선택적 정확 Project equipment API route 옵션을 받아 원래 동일 startup 90초 안의 **read-only GET 405**(PATCH/DELETE-only route Next 계약)로 동적 라우트 준비를 감시하고, 404/초기 연결 error만 그 setup budget 안에서 관측. 다른 지위/외부 URL/프로세스 종료/준비 실패는 FAIL. 의도된 한 번뿐인 실제 PATCH 재시도·응답 성공 가장 금지.
- **수정/회귀:** `tests/e2e/issue-725-process-workareas.spec.ts`의 재시작에서만 선택적 경로 준비 활성화. 실제 browser PATCH 후행 두 건은 정확 HTTP200/JSON·위험하지 않은 status/Content-Type/request-id 존재만 기록하고, 원래 Dialog close·WorkArea B/0·quantity10·Gantt/Task·Target0·409/412/5폭·재시작 persistence 모두 그대로. 기존 비옵션 재시작 consumer는 영향 없음. `docs/TEST_PLAN.md`, 이번 Work Packet, `docs/ISSUE_731_FAILURE_ANALYSIS.md` 동기화 및 CHANGELOG 테스트 경계 보완. API/DB_SCHEMA/ARCHITECTURE/SECURITY/DESIGN/매뉴얼은 제품 계약·화면 신규 변경 없음으로 N/A(reason).
- **검증 및 다음 단계:** GitHub Git Data blob/전체 Tree/commit parent/strict 최신 main·review0/mergeable 검증 뒤 정확 #731 **신규 correction PR**; PR Full Quality/E2E6/Docker/Trusted QA와 HIGH Owner 승인/정식 version release 승인 분리. 연결 환경에 checked-out repo/npm/Chromium이 없어 실제 로컬 typed compiler·server SQLite/E2E NOT TESTED. 요청 종료점은 **새 Full PR CI 시작**이며 완료 모니터링/병합/Main/GHCR/Finalizer/Issue close 수행하지 않음. `release_authorized=false` 유지.

## M-003 현재 로컬 검증 인계

- source: [정제한 M-003 실행 영수증](../../evidence/issue-731/m003-local-validation.json). #6237case + 기존4실패파일36case의 합집합43/43 PASS,0FAIL/skip/flaky,751,450.72ms. 초기39case의38PASS/1geometryFAIL·TS2532·중단된 초기fast를 삭제하지 않고 같은 원장에 보존한다.
- Pre-PR fast 실제10단계 PASS(전체 Unit3,048PASS/3SKIP, lint0error/기존13warning, TypeScript·production/standalone/runtime-tools build 포함). helper·구성/legacy KPI·WBS 직접/음성6suite72PASS는 전체 Unit에 포함되므로 합산하지 않는다.
- fast/targeted의 종합은 생성nextenv/tsconfig·E2E출력의 fingerprint drift 때문에 BLOCKED다(UNKNOWN0/missing0). raw 보고서 판정을 유지하며 생성변경 복원/functional9파일 SHA256 불변을 별도 확인한다. 도구 guard를 바꾸거나 이전Head/원격PASS를 이월하지 않는다.
- #623 body예산80% 경고5건, 남은 최소3,238ms를 [실패 원장 §11.7](../../ISSUE_731_FAILURE_ANALYSIS.md#117-최종-동결-source의-로컬-실제-결과)에 수치로 기록했다. timing은 안정성 gate가 아니며 새 PR/독립Runner/Main·Trusted/Owner승인 NOT TESTED다.
- 새 프로세스에서 과거 실패 경계7case와 인접 Editor 오류/readonly6case 총13실행을 별도로 수행한다. 반복7case를 고유 수에 중복 합산하지 않는다. 최종 결과는 실행 후 아래에 추가한다.

- 별도 fresh13/13 PASS(과거 경계7반복+새 인접 오류/readonly6),0FAIL/skip/flaky/retries0. 누적43+새6의 고유 Chromium49case이며 반복 실행을 합산하지 않는다. 최종 raw JSON·phase timing/명령은 위 정제 영수증에 포함한다. 같은 host이므로 독립Runner 연속 안정성은 NOT TESTED다.
- 생성nextenv/tsconfig·역사적output 복원 후 해당diff0 및functional9hash일치를 확인한다. 독립 `731_rework_qa`의 실제 source/43raw/문서 검토상 P1/P2 잔여0이며 최종13결과·복원 증거를 인계한다. 이는 PRE_QA 범위이고 Owner-managed 독립QA는 N/A, 원격Required3/Trusted·Manager/Owner ACCEPT는 NOT TESTED다.
- Git CLI write인증 대신 허용된 Git Data API의 blob→전체tree/parent검증→새branch Ref1회 게시를 사용한다. canonical Refs731 새PR와 exactHead/base/testmerge·리뷰0/충돌0·FullCI Run/Attempt 시작은 Issue/PR STATUS 댓글에 연결한다. main/GHCR/Finalizer/Release/tag/Issue종료는 미실행이다.
