# Issue #372 — Gantt fullscreen에서 Task/Relation Editor 상태 보존

## 최신 재정렬 기준

- main: `5fda7d963b0ba5e2e09414c1328103f9e943b564`
- main version: `0.63.1`
- PR: #381
- 작업 branch: `fix/issue-372-fullscreen-editor`
- 후보 version: `0.63.2` PATCH
- 직전 PR CI: #1485.1 / run `36925422604` — **SUCCESS**
- release_required: `true` 예상
- release_authorized: `false`

## 재정렬 사유와 충돌

#1485.1은 다음을 모두 PASS했다.

- quality / policy / Vitest / ESLint / typecheck / Next.js build
- Docker smoke
- Chromium E2E shard 1/4, 2/4, 3/4, 4/4
- aggregate required checks

그 후 Issue #375가 main에 병합되면서 main이 2 commits 이동했다. #375는 Summary Task bar 시각 두께 변경이며 #372의 fullscreen editor source와 직접 기능 충돌은 없지만 다음 공통 파일을 변경했다.

- `CHANGELOG.md`
- `docs/PROJECT_UX.md`
- `docs/TEST_PLAN.md`
- `package.json`
- `package-lock.json`

따라서 GitHub는 PR #381을 `mergeable_state=dirty`로 판정했다.

해결 방식은 이전 branch history를 억지 merge하지 않고 **최신 main에서 새 재정렬 candidate를 만든 뒤 #372 변경만 재적용**하는 것이다. 이를 통해 #375 문서/버전/스타일 변경을 그대로 보존한다.

## #372 구현 계약

- Task Editor open을 위해 `document.exitFullscreen()`을 호출하지 않는다.
- Relation Editor도 동일 fullscreen-aware native dialog 경로를 사용한다.
- Editor open/close/save/cancel 후 사용자가 직접 종료하지 않았다면 `.project-gantt-frame` fullscreen을 유지한다.
- Grid/Chart scroll, splitter, column, scale, selection, Summary expand/collapse, filter, Gantt instance를 보존한다.
- browser가 Escape로 fullscreen을 종료하는 사용자 에이전트 동작은 차단하지 않는다.
- API/DB/Scheduling/Security/revision/If-Match/canonical snapshot 계약은 변경하지 않는다.

## E2E

- Grid/Chart double click
- Grid/Chart Context Menu → Edit
- readonly Task Editor
- Relation Editor
- `document.exitFullscreen()` 호출 0회 guard
- fullscreen request unsupported/rejection 기존 회귀 보존
- Relation endpoint를 같은 가시 날짜 구간에 배치하고 link visibility 확인 후 double click
- 동일 Gantt root/API identity 및 mutation 0회

## 버전

최신 main이 이미 #375로 `0.63.1`을 사용하므로 #372는 PATCH `0.63.2`를 사용한다.

## 현재 상태

- 최신 main 재정렬: 완료 후보 준비
- 충돌 해결: 최신 main 내용 보존 + #372 선택 재적용
- 문서 동기화: 반영
- Local Fast Feedback: connector 환경에는 repository shell/browser 실행 경로가 없어 별도 실행하지 않음
- 다음 단계: PR #381 head 교체 → synchronize PR CI 시작
