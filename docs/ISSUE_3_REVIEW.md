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
- PR / head SHA: 아직 생성 전.
- GitHub quality / e2e / docker: **NOT TESTED**.
- Main GHCR digest: **N/A** — 아직 PR 검증 전이며 main 반영/이미지 완료를 주장하지 않는다.
- QA / Manager: 검토 대기. 과거 W24 PASS를 이번 변경의 근거로 사용하지 않는다.

수용 기준: pending/success 인스턴스 및 DOM 유지, 문서 navigation 없음, 한 클릭당 POST 한 번, 저장 중 열 너비 유지, scroll/tree/selection/columns 보존, root/summary-child/첫 child 확인·취소, 오류/권한 복구, 순차 10회 추가, 기존 수정/설정/로그아웃 회귀.

신규 `project-gantt-stability.spec.ts`는 상태를 가진 API mock을 사용해 UI 동기화와 지연/오류를 검증한다. mock 응답을 reload 후 다시 읽는 검사는 실제 SQLite 영속성 증거가 아니다. 실제 저장·재조회는 기존 `project-task-persistence.spec.ts`와 서버 통합 테스트 및 Docker gate를 별도로 확인한다.

## 근거

- [React key와 상태 보존](https://react.dev/learn/preserving-and-resetting-state)
- [SVAR intercept](https://docs.svar.dev/react/gantt/api/methods/intercept/)
- [SVAR add-task](https://docs.svar.dev/react/gantt/api/actions/add-task/)
- 설치된 Core 타입과 구현의 확인 결과는 구현 검토에 함께 기록한다.
