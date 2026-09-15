# Issue #36 구현 설계

## 요구사항

Task Editor의 진행률 입력을 0~100, step 1 Slider로 변경하고 Description/URL 편집·저장 및 Grid/Chart 일반 클릭 시 URL 실행을 추가한다. 기존 explicit Save, If-Match revision, canonical snapshot, Context Menu 및 drag/resize 동작은 유지한다.

## 설계 결정

- `tasks.description`, `tasks.url`은 nullable TEXT로 추가한다. 기존 행은 migration 후 NULL이다.
- Description 빈 값은 NULL로 정규화한다. HTML로 렌더링하지 않는다.
- URL은 trim 후 빈 값은 NULL, 그 외 `http:`/`https:`만 허용한다. `javascript:`, `data:`, `vbscript:`, `file:` 등은 서버와 클라이언트에서 거부한다.
- Progress는 기존 숫자 필드/API를 재사용하되 Editor에서는 range input(`min=0`, `max=100`, `step=1`)과 현재 `%` 값을 표시한다. 저장 버튼 전에는 mutation하지 않는다.
- Summary 일정 필드의 기존 읽기 전용 정책은 유지한다. Description/URL의 Summary 허용 범위는 기존 Editor read-only 정책을 우회하지 않는다.
- URL 클릭은 `pointerdown`과 최종 `click`의 동일 task/좌표 이동 임계값을 확인해 drag/resize/dependency 연결 뒤에는 실행하지 않는다. 우클릭은 제외하고, `window.open(url, "_blank", "noopener,noreferrer")`를 사용한다.
- URL 실행 대상 DOM 식별은 기존 `task-context-target.ts`의 UUID 기반 Grid row/Chart bar 해석을 재사용한다.

## 변경 계층

1. `db/migrations/0002_task_description_url.sql`
2. `ProjectTaskDto`, create/update request contract
3. `task-contract.ts` server validation
4. `ScheduleRepository` row mapping/INSERT/UPDATE
5. `ProjectService` create/update/canonical snapshot/project copy
6. `project-task-adapter.ts`, `task-editor-model.ts`
7. `project-task-editor.tsx` + CSS
8. `project-gantt.tsx` safe link click integration
9. unit/API/DB/Chromium E2E와 관련 문서

## 수용 기준 핵심

- 기존 DB에서 migration 성공 및 기존 task 조회 보장
- Progress 0/1/중간/99/100 저장·재조회 일치
- Description 개행 보존
- http/https 허용, 위험 scheme 거부
- Editor Save 1회 PATCH, Cancel은 무변경
- URL click 1회만 실행, drag/resize/right-click에는 미실행
- URL 실행으로 Gantt reload/remount 금지
