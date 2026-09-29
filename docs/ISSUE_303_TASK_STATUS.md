# Issue #303 Task 상태·진행률 동기화

기준: 2026-09-30, 구현 branch `feat/issue-303-task-status-progress-sync`, 기준 main `05f02e6c80ebf0c0ebf2819bd677bce472973108`, application baseline `0.54.0`, target `0.55.0`, `@svar-ui/react-gantt 2.7.3`.

## 계약

Task status는 Project status와 별도 도메인이다.

| UI | code |
| --- | --- |
| 시작 전 | `not_started` |
| 진행 중 | `in_progress` |
| 완료 | `completed` |

일반 Task/Milestone은 직접 선택하고 Summary는 기존 derived progress에서 계산한다. progress가 정확히 100이면 completed, 0보다 크고 100보다 작으면 in_progress, 0이면 not_started다. fractional Summary progress는 반올림하지 않는다.

`progress=100`과 `status=completed`는 같은 Task PATCH/revision에서 동기화한다. 완료된 Task의 progress를 100 미만으로 낮추면 in_progress가 되며, status를 not_started로 바꾸면 progress 0, status를 in_progress로 바꾸는 시점의 progress가 100이면 0으로 정규화한다. 서버 repository는 모순된 status/progress를 정상 제품 mutation으로 저장하지 않는다.

## 영속성과 호환

`0015_task_status.sql`은 status TEXT column을 추가하고 기존 row를 progress 기준으로 backfill한다. API status 누락은 기존 client/import 호환을 위해 허용하며 create는 progress에서 상태를 유도한다. 과거 raw fixture처럼 progress만 존재하는 row는 repository read boundary에서 canonical 상태로 해석하고 정상 저장 시 status도 함께 기록한다.

## UI

Task Editor의 작업 정보 탭에서 상태 select를 진행률 근처에 둔다. draft 단계에서 상태와 진행률을 즉시 동기화하고 저장은 단일 PATCH를 사용한다. 완료 Grid 표시에는 작업명 텍스트의 `line-through`만 사용하며 색상에 의존하지 않는다. inline 이름 입력 자체에는 취소선을 강제하지 않고 저장/닫기 뒤 canonical row 표시에서 복원한다.

현재 #258이 아직 구현되지 않았으므로 Dependency endpoint Task의 기존 read-only 정책은 유지한다. #303 때문에 Link guard를 제거하거나 dependency-adjusted 일정을 재생성하지 않는다.

## 공식 자료 확인

SVAR React Gantt 공식 문서의 Task progress 0~100, Editor select/slider, Grid custom cell/표시 확장 지점을 확인했다. masterGantt는 기존 자체 Editor, command gateway, canonical server snapshot을 유지하며 SVAR 기본 Editor나 PRO scheduling으로 도메인 규칙을 이전하지 않는다. SQLite migration은 기존 migration runner transaction과 `ALTER TABLE ... ADD COLUMN` + deterministic backfill을 사용한다.

## 검증

Unit/domain은 0/1/50/99.999/100, 완료 해제와 명시 상태 전환을 검증한다. Service는 create/PATCH/DB row/revision을, DB test는 0015 backfill/reopen/CHECK를 검증한다. Chromium E2E는 progress→완료, 상태→progress, 완료 작업명 취소선/해제와 Gantt instance 보존을 검증한다. 공식 완료 증거는 해당 PR head의 quality/e2e/docker CI 결과로 판단한다.
