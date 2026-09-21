# Issue #34 — Task Editor 작업 관계 표시

## 목적

Grid 또는 Chart에서 여는 기존 Task Editor에 현재 작업의 **선행 작업**과 **후행 작업** 관계를 조회 전용으로 표시한다. 관계 추가·수정·삭제는 이번 범위에 포함하지 않으며, 현재 도메인 제약인 FS(Finish-to-Start), lag 0을 변경하지 않는다.

## 표시 규칙

- `link.successorExternalId === currentTask.externalId` 이면 선행 작업으로 표시한다.
- `link.predecessorExternalId === currentTask.externalId` 이면 후행 작업으로 표시한다.
- 상대 작업은 이름과 `externalId`를 함께 표시하여 동일한 작업명이 있어도 식별 가능하게 한다.
- 관계 유형은 `FS (종료 → 시작)`처럼 사용자 의미를 함께 표시하며 lag는 일 단위로 표시한다.
- 관계가 없으면 각각 `없음`으로 명시한다.
- snapshot 안에서 참조 대상 작업을 찾을 수 없는 비정상 데이터는 숨기지 않고 외부 ID와 경고를 표시한다.

## Revision 일관성

Issue #80부터 Task Editor는 관계만을 위해 Project snapshot을 다시 조회하지 않는다. `ProjectWorkspace`가 화면과 Gantt에 사용 중인 동일 canonical `tasks + links + revision`을 Editor에 전달하고, Editor session revision과 현재 Project revision이 일치할 때만 `buildTaskRelations()` 결과를 표시한다.

Editor가 열린 뒤 다른 변경으로 revision이 달라지면 기존 stale 보호 계약에 따라 저장을 막고 **최신 정보 다시 불러오기**를 요구한다. 재조회 성공 시 상위 canonical snapshot과 Editor task session이 함께 새 revision으로 갱신되므로 서로 다른 revision의 작업 필드와 관계를 혼합하지 않는다.

이 구조는 reverse proxy/base path에서 `window.location.pathname`을 다시 해석하거나 관계 전용 `GET /api/projects/{publicId}`를 호출할 필요가 없다.

## 구현 구조

- `src/features/gantt/task-relations.ts`: 링크 방향 판정, 상대 작업 resolve, 표시 모델 생성, 관계 유형 표시 문자열.
- `src/features/projects/project-readonly-view.tsx`: 동일 canonical `tasks + links + revision`을 Task Editor에 전달.
- `src/features/gantt/project-task-editor.tsx`: 전달된 canonical snapshot으로 관계를 계산하고 조회 전용 UI를 표시.
- `src/features/gantt/project-task-editor.module.css`: 선행/후행 목록 레이아웃과 작은 화면 overflow 처리.
- `tests/features/gantt/task-relations.test.ts`: 방향 판정, 동일 이름, 무관계, dangling reference, multiple/type/lag 회귀 테스트.
- `tests/e2e/project-task-editor.spec.ts`: Grid/Chart 더블클릭, Context Menu → Edit, Readonly 및 추가 Project GET/mutation 부재 회귀 테스트.

기존 Grid/Chart/context-menu 진입점은 동일 `ProjectTaskEditor`를 사용하므로 별도의 메뉴 동작이나 SVAR mutation 계약을 변경하지 않는다. 서버 API·DB schema·링크 생성 규칙도 변경하지 않는다.

## 검증 기준

1. 선행/후행 방향이 externalId 기준으로 정확히 분류된다.
2. 동일 이름 작업도 externalId로 구별된다.
3. 관계가 없는 작업은 빈 상태를 명시한다.
4. 상대 작업 참조가 유실된 snapshot도 정보 손실 없이 경고한다.
5. 관계 조회 snapshot revision이 Editor 기준과 다르면 stale 관계를 표시하지 않고 충돌 처리한다.
6. 기존 저장, dirty draft, 재조회, readonly/linked-task 보호 계약을 유지한다.
7. CI의 typecheck, lint, unit/integration, Chromium E2E, Docker smoke를 모두 통과해야 병합한다.


## Issue #74 표시 구조 보완

관계 데이터 계약과 revision 검증은 변경하지 않는다. Task Editor의 관계 정보는 별도 `관계` 탭으로 이동하며 탭에는 현재 선행+후행 관계 건수를 표시한다. wide 화면은 선행/후행을 2열로, 768px 이하에서는 1열로 stack한다. dangling reference, loading, error, empty 상태의 기존 의미와 경고 표현은 유지한다.
