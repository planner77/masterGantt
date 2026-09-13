# Issue #3 — 정상 작업 추가 시 Gantt 상태 유지

## 범위와 기준

[Issue #3](https://github.com/planner77/masterGantt/issues/3), 기준 `main` `d540eb5`, 작업 branch `fix/issue-3-stable-gantt`.
원격 변경 반영 후에도 저장 중 `busy`가 `taskEditing`과 React key를 바꾸는 경로가 남아 있다. 이는 문서 navigation과 별개인 컴포넌트 재마운트 원인이다. 저장 성공 알림의 자동 focus와 snapshot 변경에 따른 SVAR store 초기화도 함께 점검한다.

서버 session/Origin/If-Match, canonical snapshot, Summary 계산, 첫 자식 전환 동의, milestone 부모 거부와 오류 복구를 유지한다. DB/API 변경, 임시 ID/낙관적 생성, release/운영 배포는 하지 않는다.

## 구현 및 표시 정책

설치된 SVAR Core 2.7.3은 config prop 변경 시 store 초기화를 수행하므로 key 제거만으로는 충분하지 않다. 최초 tasks/links/columns/시간축 설정은 유지하고, 이후 서버 snapshot과 공개 `api.serialize()` 결과의 차이를 공개 `api.exec()` 작업으로 반영한다. React의 canonical snapshot이 데이터 원본이며 SVAR는 그 렌더링 결과다. 서버 ID를 그대로 사용하고 파생 calendar duration은 비교에서 제외한다.

정상 저장에서는 key를 바꾸지 않으며, 권한과 일시적인 전체 busy 상태를 분리한다. 저장 중 native add/update를 가로채고 동기적인 HTTP 중복 방지 경계도 유지한다. 내부 반영은 사용자 명령과 구분해 POST/PATCH를 재발행하지 않는다. 명시적인 장애 복구에만 새 인스턴스를 허용한다.

표시 정책은 **기존 상태 우선**이다. 정상 추가 때문에 기존 선택·접힘·scroll을 자동 변경하지 않는다. 접힌 Summary 아래에 추가한 행은 사용자가 펼칠 때 보이며, 모든 신규 작업을 무조건 화면 안으로 이동시키지 않는다. 일반 작업이 새 Summary로 전환되는 최초 1회만 펼쳐 첫 하위 작업을 표시하되 기존 선택 위치는 유지한다. 초기 시간축은 기존 일정과 오늘부터 14일 범위를 포함한다. 성공 알림은 `role=status`로 전달하되 focus를 강제로 옮기지 않는다.

정적 검토에서 동기화 경합·잠금·열 너비·API identity 계측을 보완했다. 독립 QA는 설치된 Core에서 생성 ID가 action 최상위가 아니라 `task.id`를 사용한다는 점과 최초 Summary 펼침을 추가 보완 항목으로 확인했다. 아래 원격 결과가 확인되기 전에는 완료로 판정하지 않는다.

## 검증

- Pull 기준선 확인: 원격 `d540eb58c4492fdd945c2a0ebb61155a832918c5`의 [CI 34752263074](https://github.com/planner77/masterGantt/actions/runs/34752263074)는 quality/e2e/docker 및 main commit-image job 성공. 이번 수정의 검증 증거와는 별개다.
- Local Fast Feedback: **NOT TESTED** — 사용자 로컬 테스트 보류 유지.
- PR: [#16](https://github.com/planner77/masterGantt/pull/16).
- 수정 전 head `5043b767b8bc683ee5fcc64c15b0a70e915ffab0` / [CI #33](https://github.com/planner77/masterGantt/actions/runs/34754329128): quality PASS, Docker PASS, E2E FAIL (12개 중 2개 실패).
- 이번 후속 수정의 GitHub quality / e2e / docker: **NOT TESTED** — 커밋 후 실행 결과는 PR에 head SHA/run별로 기록한다. CI #33 결과를 새 head의 결과로 사용하지 않는다.
- Main GHCR digest: **N/A** — main 반영/이미지 완료를 주장하지 않는다.
- QA / Manager: 최종 검토 대기. 과거 W24 PASS를 이번 변경의 근거로 사용하지 않는다.

수용 기준: pending/success 인스턴스 및 DOM 유지, 문서 navigation 없음, 한 클릭당 POST 한 번, 저장 중 열 너비 유지, scroll/tree/selection/columns 보존, root/summary-child/첫 child 확인·취소, 오류/권한 복구, 순차 10회 추가, 기존 수정/설정/로그아웃 회귀.

신규 `project-gantt-stability.spec.ts`는 상태를 가진 API mock을 사용해 UI 동기화와 지연/오류를 검증한다. mock 응답을 reload 후 다시 읽는 검사는 실제 SQLite 영속성 증거가 아니다. 실제 저장·재조회는 기존 `project-task-persistence.spec.ts`와 서버 통합 테스트 및 Docker gate를 별도로 확인한다.

## CI #33 E2E 후속 수정 (2026-09-13)

### 관측 증거와 원인 구분

실패 Job `103716218950`의 `npm run test:e2e`에서 두 테스트 모두 첫 하위 작업 생성 성공 응답 이후 성공 알림 대신 `일정 화면을 최신 서버 정보로 복구했습니다.`를 받았다. 브라우저 로그에는 `Cannot read properties of null (reading 'forEach')`가 기록되었다. ClockController는 예약 콜백을 실행하는 스택이므로 그 이름만으로 Playwright 자체 결함이라고 단정하지 않는다.

기존 동기화 순서는 `update-task(parent -> summary) -> open-task(parent) -> add-task(child)`였다. 공개 SVAR `open-task` 구현은 펼침 상태 변경 후 동기적으로 tree 상태를 계산한다. 아직 자식이 없는 leaf를 먼저 펼쳐 잘못된 중간 트리를 노출하는 순서를 제거한다. 정확한 기존 브라우저 스택의 라이브러리 라인 매핑은 CI #33의 trace 미보존으로 미확인이다. 수정 전 실패 E2E를 그대로 재실행하여 원인 가설을 검증한다.

### 수정과 회귀 범위

`canonical-snapshot-sync.ts`의 `applyCanonicalGanttSync`로 공개 action 실행을 분리했다. 변경 전 snapshot에서 최초 summary 전환을 수집하고 `update-task -> add-task -> open-task` 순서로 실행한다. 실제 canonical child가 있는 새 전환만 펼치고 기존 summary 접힘 상태, 서버 ID, select:false, 내부 eventSource, stale version 중단과 오류 전파는 유지한다. React effect는 직렬 큐/동기화 guard/복구를 소유하며 serialize 실패도 finally로 guard를 해제한다.

`canonical-sync-execution.test.ts`는 첫 child 이전 펼침 금지, live snapshot 객체 변이, 기존 접힘 보존, 빈 summary 미펼침, 추가 실패 시 펼침 금지, stale 작업 중단을 검증한다. 기존 두 실패 E2E의 기대값·timeout·clock 설정을 변경하지 않았다. 테스트 삭제/skip/재시도 증가/품질 gate 완화는 하지 않는다.

### 실패 진단 자료 보존

CI #33의 업로드 단계는 `playwright-report/` 파일을 찾지 못했다. 기존 Playwright 설정에 HTML reporter가 없어 trace는 `test-results/`에만 생성되고 runner 종료와 함께 사라졌다. `tests/config/playwright.config.ts`에 list + HTML reporter를 명시하고 출력 경로를 repositoryRoot/playwright-report로 고정한다. 기존 workflow의 실패 시 업로드 경로와 7일 보존 정책은 변경하지 않는다. HTML 보고서에는 실패 trace/오류 context 첨부가 포함된다. 실제 artifact 업로드 검증은 실패한 원격 실행에서만 PASS로 판정한다.

## 근거

- [React key와 상태 보존](https://react.dev/learn/preserving-and-resetting-state)
- [SVAR intercept](https://docs.svar.dev/react/gantt/api/methods/intercept/)
- [SVAR add-task](https://docs.svar.dev/react/gantt/api/actions/add-task/)
- [SVAR open-task](https://docs.svar.dev/react/gantt/api/actions/open-task/)
- [SVAR 공개 DataStore 구현](https://github.com/svar-widgets/gantt/blob/2ffa82213baec254e2f25a324269d75dffcb3d5e/store/src/DataStore.ts)
- [Playwright Clock](https://playwright.dev/docs/clock)
- [Playwright HTML reporter](https://playwright.dev/docs/test-reporters#html-reporter)
- 설치된 Core 타입과 구현의 확인 결과는 구현 검토에 함께 기록한다.
