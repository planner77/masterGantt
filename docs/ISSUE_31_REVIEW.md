# Issue #31 — Grid·Chart 작업 삭제 분석·설계·검증 기록

## 목적

Grid 작업 행과 Chart 작업 막대의 우클릭 메뉴에 `작업 삭제`를 추가한다. 하위 작업이 있는 작업은 선택 작업과 모든 깊이의 자손을 하나의 논리적 삭제 단위로 처리하되, 사용자가 삭제 범위를 확인하기 전에는 삭제 요청을 전송하지 않는다.

## 기준과 설계 결정

- 기준 `main`: `51adbfb4fbd0c9b6e9d7bad2ffe40c858c6e7230`.
- 작업 branch: `feat/issue-31-task-context-delete`.
- 기존 `DELETE /api/projects/{publicId}/tasks/{taskId}`는 leaf/milestone 단건 삭제, edit session, Origin, `If-Match`, SQLite transaction, Summary 재계산을 이미 제공한다.
- 기존 단건 DELETE의 의미를 바꾸지 않는다. `includeDescendants=true`가 명시된 요청만 서버의 subtree 삭제 경로로 연결한다.
- 하위 작업 목록과 개수는 UI가 안내에 사용하지만 삭제 권위 데이터가 아니다. 서버는 transaction 안에서 저장된 parent 관계로 subtree를 다시 계산한다.
- 삭제 순서는 자손 우선이다. 선택 범위 밖의 상위 Summary가 비게 되면 기존 `EMPTY_SUMMARY_NOT_ALLOWED`를 유지한다.
- Link가 존재하는 일정의 hierarchy mutation은 현재 정책대로 `UNSUPPORTED_SCHEDULE_STRUCTURE`로 거부한다. 이 기능 때문에 Link를 조용히 제거하거나 일정 제약을 완화하지 않는다.
- 성공 시 Project revision은 논리적 삭제 1회에 정확히 1 증가하며 full canonical snapshot과 실제 `deletedTaskExternalIds` 전체를 반환한다.
- 정상 삭제는 기존 Gantt 인스턴스를 remount하지 않고 canonical snapshot으로 Grid와 Chart를 동기화한다.

## UI 계약

1. 실제 우클릭한 안정 `taskId`를 대상으로 `작업 정보`와 `작업 삭제` 메뉴를 제공한다.
2. Grid Header/빈 Chart/시간축/링크는 작업 삭제 메뉴 대상이 아니다.
3. Readonly, mutation 진행 중, Link가 있는 일정에서는 삭제 항목을 사용할 수 없다. 서버 검증은 별도로 유지한다.
4. 자손이 없으면 기존 단건 DELETE를 사용한다.
5. 자손이 있으면 작업명, 자손 수, 총 삭제 수를 표시하고 `취소` 또는 `하위 작업 포함 삭제`를 선택한다.
6. 취소/Escape/닫기는 DELETE 0회다. 확인 시에는 대화상자를 열 때의 revision을 사용한다. 그 사이 revision이 바뀌면 412로 재조회·재확인을 요구한다.
7. 마우스 우클릭뿐 아니라 ContextMenu 키/Shift+F10을 지원하고 메뉴 닫기 시 `preventScroll` 포커스 복구를 사용한다.

## 서버 계약

### 기존 단건

`DELETE /api/projects/{publicId}/tasks/{taskId}`

- leaf/milestone 단건 삭제 의미 유지.
- child가 있는 Summary의 암묵적 cascade 금지.

### 명시적 subtree 삭제

`DELETE /api/projects/{publicId}/tasks/{taskId}?includeDescendants=true`

- 기존 Task DELETE handler의 Origin/session/If-Match/error mapping을 재사용한다.
- 별도 subtree service가 transaction 안에서 session·Project binding·auth version·expiry·revision을 다시 검증한다.
- 저장된 계층에서 target+전체 자손을 계산하고 child-first 삭제한다.
- 남은 Summary를 재계산한 뒤 revision을 1회 증가시키고 canonical snapshot을 반환한다.
- 대상 없음/다른 Project, stale revision, 마지막 외부 child 제거, Link 포함 일정은 기존 안정 오류 계약으로 실패하며 부분 삭제하지 않는다.

## 구현 파일

- `src/features/gantt/project-gantt-with-delete.tsx`
- `src/features/gantt/task-delete-model.ts`
- `src/features/projects/project-readonly-view.tsx`
- `src/features/gantt/task-context-menu.css`
- `src/app/api/projects/[publicId]/tasks/[taskId]/route.ts`
- `src/server/projects/task-subtree-delete-service-core.ts`
- `src/server/projects/project-service.ts`

## 테스트

- Unit: `tests/features/gantt/task-delete-model.test.ts` — 다단계 자손, 형제 제외, leaf/unknown.
- SQLite service: `tests/server/projects/task-subtree-delete-service.test.ts` — child-first 원자 삭제, Summary 재계산, root 전체 삭제, 외부 Summary empty rollback.
- Chromium + 실제 SQLite API: `tests/e2e/project-task-delete-context.spec.ts` — 실제 Grid 우클릭, 삭제 메뉴, 확인 전 DELETE 0회, 취소 0회, `includeDescendants=true` 1회, 전체 자손 삭제·형제 보존·revision+1·Gantt instance 유지·reload persistence.
- 전체 회귀는 PR head의 GitHub Actions `quality`, `e2e`, `docker`로 판정한다. CI gate 삭제/skip/완화로 통과시키지 않는다.

## Semantic Versioning

현재 `0.6.0`에서 하위 호환 사용자 기능과 명시적 API 옵션을 추가하므로 프로젝트의 0.x 정책에 따라 **MINOR**를 증가시켜 `0.7.0`으로 관리한다. `package.json`과 `package-lock.json` top-level/root package version을 동일하게 유지한다. PR 검증 단계에서는 tag, GitHub Release, 정식 version GHCR image를 만들지 않는다. 정식 `v0.7.0` release는 main에 이 변경이 포함된 뒤 `docs/CI_CD.md`의 release 절차와 별도 승인 범위를 따른다.

## 검증 상태

문서 작성 시점의 코드·테스트는 branch에 반영됐으나 PR 전체 GitHub Actions는 아직 실행 전이다. 따라서 현재 판정은 **NOT TESTED**다. 최종 PR head SHA, run/job 결과, 실패·수정 이력과 환경별 미검증 범위는 실제 실행 후 이 문서와 PR에 갱신한다.
