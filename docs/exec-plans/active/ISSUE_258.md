# Issue #258 관계 연결 작업 편집 실행 계획

상태: 구현·Local Fast Feedback·독립 QA 사전 검토 PASS, PR 준비 중 (2026-09-30 KST). 사용자 요청은 로컬 최신화, 구현, PR 생성 및 CI 시작까지다. CI 완료 모니터링, 병합, 정식 게시, 브랜치 정리와 Issue 종료는 이번 실행 범위에 포함되지 않는다.

## 기준과 승인 범위

- Issue: [#258](https://github.com/planner77/masterGantt/issues/258), 2026-09-29 확인, OPEN, 기존 댓글 없음.
- 기준 main: `74279aa4eccb27f513b3750ad238425567fea225`.
- 작업 branch: `feat/issue-258-dependency-aware-task-edit`. 기존 #258 branch/PR 없음 확인 후 생성.
- application version: 최신 main `0.54.0`에서 새 linked 편집 기능/API 지원 확대로 MINOR `0.55.0` 선택.
- `release_required=false`: 이번 요청은 PR/CI 시작까지이며 정식 릴리스는 범위 밖이다. `release_authorized=false`: 정식 게시 승인 없음.
- 기존 작업 branch와 untracked `output/`는 보존한다.

## 구현 순서와 파일 소유권

1. backend: 비일정 PATCH는 확정 leaf 일정과 requestedStart를 보존한다. 일정 PATCH는 requestedStart 기반 전체 leaf 후보 → 기존 generic dependency engine → Summary → 모든 영향 leaf allocation 검증 → 원본 대비 final diff → 원자 저장을 수행한다.
2. frontend: Task Editor 요청일/적용일 분리, Baseline 확정 일정 복사, linked 이름/진척/일정 편집, gesture별 단일 PATCH와 canonical 동기화. 구조/삭제 보호와 readonly/stale/session 계약은 유지한다.
3. DOCUMENTATION_SYNC → 독립 qa_docs 사전 검토 → infra commit/push/PR → 해당 head CI 시작 확인.

| 담당 | 쓰기 소유권 | 검증/산출물 |
| --- | --- | --- |
| backend | server/domain, 관련 Unit/SQLite Integration, API/ARCHITECTURE/SCHEDULING_ENGINE/TASK_RELATIONS/TEST_PLAN | 조정된 A→B→C fixture, 비일정 날짜 불변, 지연/앞당김, Manual/할당 혼합 rollback, 원자 revision, 성능 |
| frontend | Gantt UI/Workspace, 관련 Unit/E2E, TASK_EDITOR/PROJECT_UX/REQUIREMENTS/PRO_FEATURE_MATRIX | 요청일 의도·Baseline·Grid/Chart·keyboard·390/768/1024/1440px |
| ui_ux | 읽기 전용 설계와 구현 비교 | 요청일/적용일·상태·오류·복사 의미 검토 |
| infra | git/PR 운영, package/lockfile/CHANGELOG | version check, PR head와 CI 시작 근거 |
| Manager | 실행 계획, 공식 Issue 기록, 통합/판단 | 범위·승인·handoff·문서 영향 분석 |
| qa_docs | 읽기 전용 독립 검토 | AC/code/tests/docs 비교, 사전 검토와 미완료 원격 gate 구분 |

추가 Agent 재귀 생성과 동일 파일 동시 쓰기는 금지한다. 공식 Issue 댓글 작성자는 Manager다.

## 인수 기준과 보호 계약

- metadata/progress/Baseline-only 수정으로 dependency-adjusted 실제 일정, 요청일, Link, assignment, logistics가 변하지 않는다.
- 시작일/기간/모드 수정은 FS/SS/FF/SF 및 signed working-day lag, branching/join/Manual 제약을 동일 서버 엔진으로 계산한다.
- 최종 allocation 위반은 `409 RESOURCE_ASSIGNMENT_SCHEDULE_CONFLICT`, Manual 관계 위반은 `409 MANUAL_DEPENDENCY_CONFLICT`; metadata/Baseline/후행/Summary/revision까지 전체 rollback한다.
- 성공은 revision 정확히 +1, final persisted diff와 full canonical snapshot을 반환한다. 실패는 +0이다.
- 요청 시작일과 적용일을 구분하고 right resize/progress/duration-only에서 미수정 start를 전송하지 않는다.
- 구조·삭제·Summary readonly·session/Origin/If-Match 보호, Gantt 인스턴스와 view state를 유지한다.

## 빠른 검증과 성능 예산

전체 공식 회귀는 PR GitHub Actions의 `quality/e2e/docker`가 담당한다. 로컬은 관련 Unit/SQLite Integration/adapter와 필요한 targeted Chromium 검증만 수행한다.

5,000 Task chain/branch/join에서 pure engine과 실제 Task PATCH를 각각 측정한다. 구현 전 측정과 후보 측정을 구분하고 동일 환경을 기록한다. 이 작업의 잠정 warm-run 예산은 engine 2초, 실제 PATCH 5초다. 환경별 수치는 운영 성능 보장이 아니며 Calendar 탐색과 실제 DB 검증 비용을 함께 측정한다.

## 참조와 문서 영향

`DESIGN.md`의 파란색 Light UI/system font/semantic token과 기존 compact workspace를 유지한다. [UI_UX_GUIDELINES](../../UI_UX_GUIDELINES.md), [ISSUE_LIFECYCLE](../../ISSUE_LIFECYCLE.md), [REMOTE_VALIDATION](../../REMOTE_VALIDATION.md)을 따른다.

- 관련 Issue #104의 linked endpoint 제한 중 필드 편집만 확장한다. #200 generic 관계 계산, #202 Baseline, #203 Relation Editor를 재사용한다. 구조·삭제 정책은 #72/#31의 기존 범위를 유지한다.
- [SVAR update-task](https://docs.svar.dev/react/gantt/api/actions/update-task/)와 [intercept](https://docs.svar.dev/react/gantt/api/methods/intercept/): Core command 경계와 완료 이벤트를 확인하며 설치 `2.7.3` 동작을 별도 검증한다.
- [SVAR scheduling](https://docs.svar.dev/react/gantt/api/properties/schedule/): native auto scheduling은 PRO다. 기존 독립 서버 engine을 사용한다.
- [SQLite transaction](https://www.sqlite.org/lang_transaction.html): 여러 Task/metadata/revision 변경의 원자성 근거.
- DB_SCHEMA: 기존 requested/effective/Baseline column과 assignment invariant를 사용한다. schema 변경 없음, migration N/A.
- SECURITY: 기존 서버 권한, cookie, Origin, strong If-Match, project isolation을 유지한다. 보안 모델 변경 N/A.
- CI_CD/REMOTE_VALIDATION: workflow/registry/배포 변경 없음, 해당 계약 수정 N/A. version만 기존 SemVer 규칙을 따른다.

## 실행 근거

- Backend/Domain: 관련 11 files 119 tests PASS, 독립 QA가 핵심 SQLite/Domain 37 tests 재실행 PASS. `npm run typecheck`, 관련 ESLint PASS. 5,000 Task candidate 21–33ms, 실제 성공 HTTP PATCH 122–149ms; 상세 fixture와 변경 전 비교 제한은 [TEST_PLAN](../../TEST_PLAN.md)에 기록했다.
- Frontend: 관련 Vitest 57/57 PASS, targeted Chromium mock Editor/Grid 21/21 PASS 및 실제 SQLite linked chain+filter-hidden+Chart move/좌우 resize E2E 1/1 PASS. `npm run typecheck` PASS, 변경 파일 ESLint 0 errors(기존 React hook warning 1). 최종 synthetic UI 증거: `output/playwright/issue258-after-390.png`, `output/playwright/issue258-after-1440.png`.
- Version check `0.55.0`, Markdown local links 88 files, `git diff --check` PASS. 위 Local Fast Feedback은 원격 전체 회귀를 대체하지 않는다.
- 독립 qa_docs 사전 검토 PASS: Domain/SQLite 37/37, UI 모델/어댑터 52/52를 별도 재실행하고 복원된 Next 생성 파일 기준 typecheck·Markdown 링크·diff 검사와 390/1440px 캡처를 확인했다. 구현 담당의 Chromium 결과를 독립 실행으로 과대 표시하지 않는다.
- 현재 원격 `quality/e2e/docker`는 **NOT TESTED**이며 과거 CI PASS를 이 변경에 사용하지 않는다. 독립 QA 최종 결과와 PR/CI 시작 근거는 완료 후 기록한다.
