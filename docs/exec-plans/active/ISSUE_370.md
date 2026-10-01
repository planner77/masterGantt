# Issue #370 Grid 시작일 Date Picker 실행 계획

## 목표와 종료점

Project Workspace Grid의 `시작` 셀에서 Date Picker로 Task/Milestone requested start를 빠르게 변경한다. 사용자 요청의 이번 종료점은 구현·문서 동기화·PR 생성과 **PR CI 시작 확인**까지다. CI 완료 판정, 병합, Main CI, GHCR release/finalizer와 Issue 종료는 후속 단계다.

## 기준과 의존성

- 제품/UX: `DESIGN.md`, `docs/UI_UX_GUIDELINES.md`, `docs/PROJECT_UX.md`, `docs/TASK_EDITOR.md`
- 일정: `docs/SCHEDULING_ENGINE.md`, Issue #258
- Grid 회귀: #140, #201, #233, #300, #345
- Task Editor 후속: #368은 open 상태이며 본 구현은 그 미구현 코드에 의존하지 않는다.
- SVAR React Gantt 2.7.3 공식 Grid columns API(2026-10-01 확인): inline editor `datepicker`를 공개 지원한다. 다만 공식 예제는 실제 row date field를 사용하며 masterGantt의 getter-only `projectStart`와는 데이터 계약이 다르다.

## 구현 결정

1. `projectStart`는 기존 getter 기반 locale 문자열 표시를 유지해 서버 effective `start`만 보여 준다.
2. SVAR inline `datepicker`는 getter-only custom column에서 실제 editor DOM이 생성되지 않는 것을 PR CI #1435에서 확인했다.
3. 편집 가능한 Task/Milestone 셀에는 masterGantt 소유의 `input[type=date]` overlay를 열고 Summary/readonly/mutation lock은 차단한다.
4. 날짜 선택은 기존 `onTaskCommand({ payload: { start } })`와 현재 revision으로 저장하며 Core row에 `projectStart` 값을 쓰지 않는다.
5. 저장 성공/실패는 기존 Workspace canonical snapshot 경로를 재사용한다. 별도 API/DB/Scheduling algorithm은 추가하지 않는다.
6. single click과 Enter/Space로 Picker를 열고 Escape/outside pointer/viewport change로 닫으며 focus restore를 제공한다. 시작일 셀 double-click은 기존 Task Editor 경로를 유지한다.

## 검증

- Unit: `tests/features/gantt/grid-start-date-editor.test.ts`
- E2E: `tests/e2e/project-gantt-inline-start-date.spec.ts`
- 기존 inline-name 회귀 기대를 #370 interaction에 맞게 갱신한다.
- 원격 PR CI가 실행되기 전 결과는 **NOT TESTED**이며, 정적 검토나 이전 CI PASS를 새 head의 PASS로 전용하지 않는다.

## 문서/버전

- REQUIREMENTS / PROJECT_UX / TASK_EDITOR / TEST_PLAN / CHANGELOG 동기화
- API/DB_SCHEMA/SCHEDULING_ENGINE 의미 변경 없음
- 사용자 기능 추가이므로 SemVer MINOR: `0.60.1 → 0.61.0`


## CI #1435.1 실패 분석

- TypeScript, ESLint, Next.js build, Docker smoke, Chromium shard 1/4·4/4는 PASS했다.
- 신규 Grid Date Picker E2E는 SVAR inline editor DOM이 생성되지 않아 shard 2/4에서 실패했다. getter-only `projectStart`와 실제 row field 기반 공식 예제의 차이를 확인하고 custom date overlay fallback으로 전환한다.
- shard 3/4의 기존 Task Editor 회귀는 시작일 column에 inline editor를 부여하면서 double-click이 Task Editor 대신 cell editor로 소비된 결과다. column editor를 제거해 기존 double-click 경로를 복원한다.
- Vitest 1건은 고정 세션 기준시각 `2026-10-01T00:00Z`와 handler의 실제 clock이 혼합되어 CI가 08:00Z 이후 실행될 때 세션이 만료되는 시간 의존 테스트다. `TaskFieldProjectService`에 동일 고정 clock을 주입해 결정적으로 만든다.
- #1435 실패를 PASS로 대체하지 않으며 새 PR head 전체 CI에서 다시 판정한다.
