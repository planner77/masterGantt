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

- 최신 main의 Issue #378 `0.62.0`을 기준으로 재정렬하며 해당 Task Editor 양방향 일정 입력 계약을 보존한다.
- REQUIREMENTS / PROJECT_UX / TASK_EDITOR / TEST_PLAN / CHANGELOG 동기화
- API/DB_SCHEMA/SCHEDULING_ENGINE 의미 변경 없음
- 사용자 기능 추가이므로 SemVer MINOR: `0.62.0 → 0.63.0`


## CI #1435.1 실패 분석

- TypeScript, ESLint, Next.js build, Docker smoke, Chromium shard 1/4·4/4는 PASS했다.
- 신규 Grid Date Picker E2E는 SVAR inline editor DOM이 생성되지 않아 shard 2/4에서 실패했다. getter-only `projectStart`와 실제 row field 기반 공식 예제의 차이를 확인하고 custom date overlay fallback으로 전환한다.
- shard 3/4의 기존 Task Editor 회귀는 시작일 column에 inline editor를 부여하면서 double-click이 Task Editor 대신 cell editor로 소비된 결과다. column editor를 제거해 기존 double-click 경로를 복원한다.
- Vitest 1건은 고정 세션 기준시각 `2026-10-01T00:00Z`와 handler의 실제 clock이 혼합되어 CI가 08:00Z 이후 실행될 때 세션이 만료되는 시간 의존 테스트다. `TaskFieldProjectService`에 동일 고정 clock을 주입해 결정적으로 만든다.
- #1435 실패를 PASS로 대체하지 않으며 새 PR head 전체 CI에서 다시 판정한다.


## CI #1438.1 실패 분석

- TypeScript, Vitest, Next.js build, Docker smoke, 정책 검사와 Chromium shard 1/3/4는 PASS했다. 이전 #1435의 logistics clock 및 Task Editor double-click 회귀는 해소됐다.
- ESLint는 readonly/mutation lock effect에서 Picker state를 동기적으로 닫는 setState를 react-hooks/set-state-in-effect로 거부했다. state close를 microtask callback으로 이동해 effect 본문 동기 setState를 제거한다.
- Chromium shard 2에서 pointer single click은 SVAR Grid가 bubble click을 소비해 부모 onClick까지 도달하지 않는 경우가 있어 Picker가 열리지 않았다. 시작일 quick-edit 진입은 onClickCapture에서 처리한다.
- keyboard Enter 경로는 Picker가 정상 open됐지만 native input[type=date]가 Escape를 bubble 전에 소비해 overlay가 남았다. Picker input의 onKeyDownCapture에서 Escape를 선점하여 닫고 원래 셀 focus를 복원한다.
- #1438 실패를 PASS로 대체하지 않으며 새 head의 전체 PR CI 결과로 다시 판정한다.


## 최신 main 재정렬 — CI #1441 전

- CI #1438 보완 직후 main에 PR #376의 동일 logistics session clock 결정화가 병합되어 branch가 2 commits 뒤처졌다.
- 해당 main 변경은 #370 branch에 이미 동일 내용으로 포함되어 있었으므로 최신 main `2dc06f772390ba41c0687ab2a22353f6c077fc80`을 기준으로 #370 변경만 다시 적용했다.
- 재정렬 head의 PR CI를 새로 시작하며 이전 #1441 pending 실행은 최종 검증 근거로 사용하지 않는다.


## CI #1442.1 실패 분석

- TypeScript, ESLint, Vitest, Next.js build, Docker smoke, 정책 검사와 Chromium shard 1/3/4는 PASS했다. 실패는 shard 2의 #370 interaction 4건으로 한정된다.
- pointer single click은 capture 단계에서 Picker를 열었지만, 같은 클릭의 SVAR cell selection 마무리 과정에서 내부 Grid scroll 이벤트가 발생했고 `scroll → close` listener가 방금 열린 Picker를 즉시 닫았다. Picker가 keyboard Enter에서는 남고 pointer click에서만 사라진 원인이다.
- 자동 `HTMLInputElement.showPicker()` 호출은 browser native date popup을 열어 Escape가 browser UI에서 먼저 소비되었다. overlay 자체를 quick Date Picker로 유지하고 native popup 자동 호출을 제거한다.
- overlay open 중에는 SVAR 내부 scroll로 닫지 않고 outside pointer와 viewport resize만 닫는다. Escape는 document-level keydown capture에서 처리해 input/native control보다 먼저 overlay를 닫고 원래 셀 focus를 복원한다.
- #1442 실패를 PASS로 대체하지 않으며 새 head 전체 PR CI로 다시 판정한다.


## CI #1444.1 실패 분석

- TypeScript, ESLint, Vitest, Next.js build, Docker smoke, 정책 검사와 Chromium shard 1/3/4는 PASS했다. shard 2도 71건 PASS 후 #370 single-click focus 1건만 실패했다.
- Picker overlay 자체는 pointer single click으로 정상 표시되고 기존 즉시 닫힘 문제는 해소됐다.
- 실패는 Picker render effect가 date input에 focus한 뒤 SVAR가 원래 pointer cell selection을 마무리하며 Grid cell로 focus를 되돌리는 순서 경쟁이다.
- overlay open 뒤 두 animation frame을 거쳐 date input focus를 재적용하여 SVAR selection 완료 이후에도 keyboard focus가 날짜 컨트롤에 남도록 한다.
- #1444 실패를 PASS로 대체하지 않으며 새 head 전체 PR CI 결과로 다시 판정한다.


## CI #1446.1 실패 분석

- TypeScript, ESLint, Vitest, Next.js build, Docker smoke, 정책 검사와 Chromium shard 1/3/4는 PASS했다. shard 2도 71건 PASS 후 #370 single-click focus 1건만 실패했다.
- Date Picker overlay는 정상 표시되지만 SVAR의 같은 click bubble handler가 Grid 셀 focus를 다시 가져가 input focus assertion이 실패했다.
- 시작일 quick-edit click을 capture 단계에서 `preventDefault()`와 `stopPropagation()`으로 소유하여 일반 SVAR cell click/selection handler와 분리한다. double-click Task Editor는 별도 dblclick 이벤트 계약을 유지한다.
- #1446 실패를 PASS로 대체하지 않으며 새 head 전체 PR CI로 다시 판정한다.


## CI #1452.1 실패 분석

- TypeScript, ESLint, Vitest, Next.js build, Docker smoke, 정책 검사와 Chromium shard 1/3/4는 PASS했다.
- shard 2 실패 3건은 #370 전용 Picker가 아니라 기존 fullscreen/stability/resource-calendar 회귀에서 시작일 셀 클릭 후 `wx-selected` 행 선택이 생기지 않은 문제다.
- 원인은 직전 보완의 capture click `preventDefault/stopPropagation`이 SVAR의 정상 cell/row selection까지 차단한 것이다.
- click propagation은 유지하고, SVAR의 선택 처리가 끝난 다음 event-loop tick에 Picker를 연다. 이렇게 행 선택과 quick-edit focus를 모두 보존한다.
- 시작일 셀 double-click 시 pending Picker open timer를 취소하고 기존 Task Editor를 우선한다.
- #1452 실패를 PASS로 대체하지 않으며 새 head 전체 PR CI 결과로 다시 판정한다.


## 최신 main 재정렬 — Issue #378 이후

- CI #1452 이후 main에 Issue #378이 병합되어 application version이 0.62.0으로 상승하고 `project-gantt.tsx`의 Copy/linked-task 보호가 변경됐다.
- #378의 linked subtree Copy/keyboard/menu 계약을 보존한 채 #370 Date Picker 변경만 최신 main에 재적용한다.
- #370은 다음 하위 호환 기능 버전인 0.63.0으로 조정하고 새 PR head 전체 CI로 검증한다.


## CI #1452 이후 최신 main 재정렬

- main에 Issue #378이 병합되어 0.62.0과 linked subtree Copy/keyboard/menu 계약이 추가됐다.
- #370 재정렬은 해당 변경을 보존하고 최신 main `9e22ebd1534471a67938a0d22adb2ba947066a83` 위에 Date Picker 변경만 다시 적용했다.
- Application version은 0.63.0이며, 이 head의 PR CI 결과만 최종 검증 증거로 사용한다.
