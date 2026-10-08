# Issue #519 — Task/Summary Milestone 후보의 ID 표시 제거

## 범위와 기준
- Issue: https://github.com/planner77/masterGantt/issues/519
- 기준 main: `e61fa037d9b527dad5a014250dbdd1678519c027`, app `0.101.2`
- Branch: `fix/issue-519-milestone-picker-metadata`; 후보 PATCH `0.101.3`
- 종료점: 구현·테스트·문서 동기화·PR 생성과 exact-head PR CI 시작. 병합·Main CI·GHCR·종료 비범위.
- release_required=true / release_authorized=false. 단일 에이전트 순차 처리.

## UI 및 계약
- Task/Summary 작업 정보의 `MilestoneMembershipPicker` 목록에서 외부 ID·작업 ID span을 제거한다. 이름과 기존 날짜·상태, completed 잠금 문구는 유지한다.
- `matchesMembershipSearch`의 name/externalId/taskId trim·case-insensitive 검색과 React key·선택값의 canonical taskId는 유지한다. UUID Copy ID 검색 경로 보존.
- 해당 식별자를 aria/title/숨김 보조 요소에 다시 추가하지 않는다. #461의 표시 계약을 본 후속 #519가 대체한다. #495 전역 용어 정책은 별도 Issue.
- Relation Editor, Grid 단계 filter, Dashboard, Milestone 소속 작업 표의 ID 표시 정책은 이 Issue에서 변경하지 않는다.
- Membership projection, inheritance, keyboard/Escape/focus, readonly/pending/dirty/stale, revision, API/DB/Import/Export/Scheduling 비변경.

## 테스트와 문서
- 기존 `tests/e2e/project-task-editor.spec.ts` #461 fixture를 확장해 canonical UUID 및 외부 ID 검색, 동일 이름 후보, 날짜와 상태 유지, 후보 ID 미표시, Summary 필드 및 기존 keyboard/scroll/dirty를 확인한다.
- `docs/TASK_EDITOR.md`, `docs/PROJECT_UX.md`, `docs/TEST_PLAN.md`, `docs/UI_UX_GUIDELINES.md`, 활성 PLAN, CHANGELOG, package/lock 동기화.
- `DESIGN.md`(기존 content-aware 밀도 원칙 재사용), `AGENTS.md`(역할/CI gate 변경 없음), API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/CI_CD 등은 변경 N/A.

## 검증 상태
GitHub connector에서 파일 쓰기를 수행했다. 실행 가능한 로컬 npm/Chromium, 독립 qa_docs Sub-Agent 없음: **NOT TESTED**. GitHub Actions PR CI의 exact head quality/e2e/docker gate가 공식 근거다. 성공 전 최종 QA/merge는 승인하지 않는다.
