# Issue #377 실행 계획 — Task Editor 관계 탭 관리

상태: REWORK 구현 완료, PR #382 새 head CI 재실행 준비.

## 최신 기준

- main: `fbcbfc9669035b153cfd029545c969596c128731`
- main application: `0.63.2`
- target application: `0.64.0`
- branch: `feat/issue-377-task-editor-relations`
- PR: #382
- 이전 실패 head: `76106b7ba939b70f90312096b4e20dc49983d7ff`
- 이전 PR CI: #1449 failure

## 실패/리뷰 분석

### P1 / CI E2E

Relation Editor에서 Link mutation 성공 시 부모가 `setEditorSession(...)`으로 새 session 객체를 전달했다. Task Editor의 native dialog effect가 전체 session을 dependency로 사용해 cleanup→`showModal()`을 다시 실행했고 Task Editor가 top layer에서 Relation Editor 위로 재등록됐다.

증거:
- Chromium shard 3/4 신규 #377 테스트 2건에서 Relation Editor 닫기 버튼 click이 Task Editor dialog의 pointer interception으로 timeout.
- Codex review P1과 동일 원인.

보완:
- 부모 `editorSession` 객체를 relation mutation마다 교체하지 않는다.
- `ProjectTaskEditorHandle.applyCanonicalSession()` imperative interface로 열린 Task Editor의 base/draft/revision만 canonical snapshot에 맞춘다.
- Task Editor dialog open effect는 mount/unmount lifecycle에만 실행한다.
- Relation Editor는 mutation 전후 topmost modal을 유지한다.

### ESLint

초기 구현의 session prop sync `useEffect`에서 동기 `setState`를 호출해 `react-hooks/set-state-in-effect` 오류가 발생했다.

보완:
- 해당 effect를 제거하고 명시적 mutation event에서 imperative sync를 호출한다.

### P2 / Focus

직접 삭제 confirmation이 DOM에 추가돼도 focus가 기존 trigger에 남아 keyboard 순서가 부자연스러웠고 취소 시 trigger 복원도 없었다.

보완:
- 삭제 trigger를 ref로 기억한다.
- confirmation 생성 후 취소 버튼으로 focus 이동.
- 취소 시 원래 trigger로 복원.
- 삭제 성공 후 사라진 row 대신 관계 추가 action으로 안전하게 focus 이동.

## 구현 범위

- Task Editor 관계 탭 add/edit/delete.
- Relation Editor `linkId | anchorTaskId` 진입.
- dirty/stale/readonly/pending/Summary guard.
- canonical session imperative sync.
- direct-delete focus handoff.
- 기존 #372 fullscreen 계약 보존.
- DB/API/Scheduling semantics 변경 없음.

## 검증

- Unit: relation mutation block reason.
- Chromium:
  - PATCH 후 Relation Editor topmost/close 가능 + Task Editor revision sync.
  - direct delete focus 이동/복원 + DELETE/revision/count.
  - zero-link Milestone Anchor POST 후 top-layer 유지.
  - dirty/readonly.
  - 390/768/1024/1440 overflow.
  - 기존 #203/#266/#372 회귀.
- PR exact head quality/e2e/docker가 최종 자동 판정 근거.

로컬 runtime은 현재 도구 환경 제약으로 NOT TESTED이며 GitHub Actions 결과를 공식 원격 검증으로 사용한다.
