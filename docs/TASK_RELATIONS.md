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

Task Editor가 열린 뒤 프로젝트가 다른 곳에서 변경될 수 있으므로 관계 목록만 최신 snapshot으로 조용히 교체하지 않는다. Editor가 관계 조회를 수행할 때 canonical GET snapshot의 project revision이 Editor session의 기준 revision과 정확히 같은 경우에만 목록을 채택한다. revision이 달라졌거나 기준 작업의 ID/externalId가 달라졌으면 충돌 상태로 전환하여 저장을 막고 **최신 정보 다시 불러오기**를 요구한다.

최신 정보 다시 불러오기가 성공하면 작업 필드와 관계를 새 revision 기준으로 함께 다시 조회한다. 이 방식으로 Editor가 서로 다른 revision의 작업 필드와 관계를 혼합해 보여주지 않도록 한다.

## 구현 구조

- `src/features/gantt/task-relations.ts`: 링크 방향 판정, 상대 작업 resolve, 표시 모델 생성, 관계 유형 표시 문자열.
- `src/features/gantt/project-task-editor.tsx`: 관계 snapshot 조회·revision 검증·조회 전용 UI.
- `src/features/gantt/project-task-editor.module.css`: 선행/후행 목록 레이아웃과 작은 화면 overflow 처리.
- `tests/features/gantt/task-relations.test.ts`: 방향 판정, 동일 이름, 무관계, dangling reference, 유형 표시 회귀 테스트.

기존 Grid/Chart/context-menu 진입점은 동일 `ProjectTaskEditor`를 사용하므로 별도의 메뉴 동작이나 SVAR mutation 계약을 변경하지 않는다. 서버 API·DB schema·링크 생성 규칙도 변경하지 않는다.

## 검증 기준

1. 선행/후행 방향이 externalId 기준으로 정확히 분류된다.
2. 동일 이름 작업도 externalId로 구별된다.
3. 관계가 없는 작업은 빈 상태를 명시한다.
4. 상대 작업 참조가 유실된 snapshot도 정보 손실 없이 경고한다.
5. 관계 조회 snapshot revision이 Editor 기준과 다르면 stale 관계를 표시하지 않고 충돌 처리한다.
6. 기존 저장, dirty draft, 재조회, readonly/linked-task 보호 계약을 유지한다.
7. CI의 typecheck, lint, unit/integration, Chromium E2E, Docker smoke를 모두 통과해야 병합한다.
