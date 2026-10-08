# Issue #518 — 일정·Milestone 상위 탭 단순화 실행 계획

- Issue: https://github.com/planner77/masterGantt/issues/518
- 기준 main: `8b9d4d76758f73094ec84590e3a8a49314741587`; application `0.99.0`
- branch: `feat/issue-518-workspace-milestone-tab`
- 후보 version: `0.99.1` (PATCH: 기존 탭 계층/공간 문제 시정)
- release_required: true / release_authorized: false
- 현재 종료 목표: 구현·관련 문서 동기화·PR 생성·exact-head PR CI 시작. CI 완료, 독립 QA 확정, merge/main, tag/GHCR, branch cleanup, Issue 종료는 범위 밖

## 구현 의도와 경계

1. `project-readonly-view.tsx` 상위 `activeView`를 schedule/milestones/resources/logistics로 통합한다. `일정`은 Gantt를 직접 표시하고 `Milestone 대시보드`를 바로 옆 peer로 올린다. Gantt 내부 `전체 프로젝트 / Summary ...`는 #399의 WBS scope이므로 유지한다.
2. #463 Gantt/Dashboard 기존 peer-tabs/body 중복 행을 제거한다. Milestone 활성 중 Gantt는 위치·측정 상자를 유지하고 visibility:hidden/inert/aria-hidden 처리한다. Resource/Logistics에서는 기존 hidden 처리다. 복귀는 같은 scope/filter에서 DOM native scroll과 공개 `scroll-chart`를 복원하며 Gantt remount 및 Project mutation을 만들지 않는다.
3. 공통 Task/Relation/Copy Dialog를 숨길 수 있는 일정 panel 바깥으로 이동해 Milestone에서 편집 상세 조회·닫기와 focus/origin 복원을 유지한다. readonly/edit 및 pending/stale 의미는 변경하지 않는다.
4. 상위 4개 tab에 ARIA controls/labelledby/selected, roving tabIndex, Arrow/Home/End와 narrow horizontal scroll을 제공한다. #463 Dashboard KPI/필터/드릴, #399 scope, import/export, DB/API/Scheduling 계약은 비범위다.

## Source of Truth와 문서

- `AGENTS.md`: 역할·품질·DOCUMENTATION_SYNC·CI gate 적용. 상세 중복 기재 없음(N/A).
- `DESIGN.md`: workspace-first, data-dense, compact controls, flat surfaces를 그대로 적용. 신규 token/공통 primitive 없이 현 규칙으로 충분하므로 원문 변경 N/A.
- `docs/ISSUE_LIFECYCLE.md`, `docs/CI_CD.md`, `docs/REMOTE_VALIDATION.md`: 순서/승인/CI gate 변화 없음(N/A).
- 현재 UI 계약 문서 `docs/REQUIREMENTS.md`, `docs/PROJECT_UX.md`, `docs/UI_UX_GUIDELINES.md`, `docs/TEST_PLAN.md`, `CHANGELOG.md`, `docs/exec-plans/active/PLAN.md` 동기화.
- `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/SCHEDULING_ENGINE.md`: 관련 domain/API/persisted data 변화 없음(N/A).

참고: https://docs.svar.dev/react/gantt/samples/#/base/willow 및 https://docs.svar.dev/react/gantt/ (설치 Core 2.7.3). 상위 Project Workspace navigation은 SVAR가 아닌 앱 소유 UI다. 공개 scroll-chart 동작을 재사용하며 PRO API를 추가하지 않는다. 공식 URL 참조와 실제 브라우저/SDK 조작 검증은 구분한다.

## 품질·검증 범위

- E2E: `project-workspace-tabs-518.spec.ts` (4 tab 순서/ARIA, nested Gantt tab 없음, Summary/WBS 유지, Milestone→Task Editor→복귀, Gantt visible layout/instance, readonly, 390/768/1024/1440/1920 geometry).
- 기존 #463 `milestone-dashboard-state`, `milestone-stage-dashboard`, `milestone-stage-exchange`, `milestone-stage-grid`/mock, Resource/status, `project-workspace-ux`에서 삭제된 내부 tab/selector를 새 실제 DOM에 맞춘다.
- PR의 필수 `quality/e2e/docker` 결과는 exact head/run에서 검증한다. 실패 시 원인을 고쳐 **새 head의 새 CI**로 회귀 검증한다.
- 원격 GitHub connector는 npm/Chromium 로컬 실행 환경이 아니므로 로컬 LFF **NOT TESTED**. 별도 독립 ui_ux/qa_docs Sub-Agent 실행/QA PASS를 주장하지 않는다. 원격 CI로도 실제 사용자의 배포 서버·브라우저/스크린리더 검증을 대신하지 않는다.

## 후속 단계

Branch 변경과 문서 동기화 후 PR 생성 및 해당 head의 GitHub Actions run 시작을 확인한다. 성공 확인·merge·GHCR 게시 요청은 별도 사용자 승인/범위에 따른다. `release_authorized=false`인 상태에서 정식 태그·게시를 실행하지 않는다.
