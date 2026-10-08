# Issue #514 선별 UI 검증 근거

현재 baseline은 `f94c22b00cac57bab409ca57e744b0530d2d35e5`이며 #518 상위 일정/Milestone 구조를 유지했다. 최초 baseline `3fa543b10e98d59e50f63f3f53613affe720b648`의 before 자료와 현재 실행을 구별한다. 모든 신규16·기존4 고유 browser 사례는 mocked canonical API + 실제 native React Gantt Core/pointer/Chromium 환경이다. SQLite·API 계산·persistence·전체 원격 회귀 PASS가 아니다.

## 선별 자료

- `before-null.json/png`: 최초 Week/fullscreen null Summary 선택의 public/native5005→0 실제 FAIL.
- `before-pending.json/png`: 최초 native dated reveal120→19830 뒤 지연 peer 복원이120으로 되돌리는 실제 FAIL.
- `matrix-*.json`8개: 현재 readonly/editable × Day/Week × normal/fullscreen8개 사례마다 root/nested를 검증한16설정. 좌/우·이미 보임·같은 instance·행/tree·열/scale·mutation0 근거.
- `current-pending-dated.json/png`, `current-pending-input.json`, `current-pending-source-filter.json`: actual pointer·wheel/연속 최신 선택·filter 변경 이후 pending 복원이 덮지 않는 public/native 각각의 값.
- `current-null.json/png`: null 선택의 수평 public/native 유지. 수직 위치 고정은 요구하지 않는다.
- `current-normal-long.json`, `current-editable-name.json`: 짧은 양방향 및 긴 bar start, editable 실제 이름 선택.
- `current-selection-guards.json`: reveal 전후 context show:false·Ctrl/Meta·Shift parent 경계·Space/Escape.
- `current-widths.json`: splitter/fullscreen 지원 UI의5폭 × 미래/과거10관측. 390 미래x662는 Core 논리 viewport 안이어도 실제 page 밖이며 과거x168은 안이다. 768 미래x684/과거x168,1024/1440/1920은 page 안이다. 기존 minWidth720 내부 작업면 제한을 기록하며 자동 좁은 화면 page-follow·사용자 outer pan PASS를 주장하지 않는다. outer pan은 NOT TESTED.
- `execution-manifest.json`: 실행별 시각/source hash·최종 파일 hash·로그·고유/반복 범위.

현재 신규16개는 current1의11PASS33.1초 + controls2의2PASS8.2초 + source1의3PASS6.7초다. 기존 영향4개는 current-regression1에서 PASS했고 같은 run의 새 선택 case1은 다른 parent Shift fallback을 range로 잘못 기대해 FAIL17.4초였다. controls2에서 기존 계약에 맞춰 수정·재검증했다. 이를 기존5개 PASS로 합산하지 않는다.

첫 current-width1은390 page intersection을 강제한 oracle FAIL이다. 이전 baseline의 좁은 이름 셀 pointerdown/up row 이동(no selection), fixture 필수 행 누락, Week 재클릭10px exact-zero 가정 실패와 최초 null/pending FAIL은 원본 worktree·`/tmp/frontend514-*.log`에 보존한다. 역사적 자료를 현재 성공 값으로 덮지 않았다.

최종 spec의 ProjectTaskDto[]는 browser 실행 뒤 발견한 type widening1건을 명시적 타입의 local 배열 선언으로 고친 변경이다. 배열값·splice 전달값·UI/API 행동은 동일하며 compiled byte 동일성을 주장하지 않는다. 런타임 fixture 값과 제품2파일은 바뀌지 않아 관련 browser 근거를 재사용하며 캡처 당시 spec SHA를 최종 SHA로 대체하지 않는다. 이전 baseline typecheck PASS 보고는 완료 로그 확인 전의 잘못된 판정이었다. 최초/현재 최초 typecheck FAIL을 보존하고 최종 현재 typecheck exit0만 PASS로 기록한다.

로컬 selection/timeline Unit2파일18PASS157ms, 최종 typecheck·변경 lint0error/기존4warning·Markdown/diff 검증은 manifest를 따른다. 공식 CI quality/e2e/docker·독립 QA_FINAL·Manager 최종 ACCEPT·공식 demo 실제 조작·실기기/screen reader·최종 수동 UX는 NOT TESTED다. [변경 spec](../../../../tests/e2e/grid-task-start-reveal.spec.ts)과 [테스트 계획](../../../../docs/TEST_PLAN.md#issue-514--grid-시작-위치와-peer-복원-영향-검증)을 함께 읽는다.

## 실행 당시 spec과 최종 spec 차이

| 실행 그룹 | 후속 spec 변화와 재사용 근거 |
| --- | --- |
| current1 / matrix8·pending input·null·dated | 이후 별도 선택/폭/source-filter case를 추가했다. 이 그룹의 fixture 값·observe/settle 함수·case 행동과 제품2파일은 동일하다. 후속 case 추가를 이전 실행 PASS로 대신하지 않고 각 case를 따로 실행했다. |
| current-controls2 / 선택·폭 | 이후 독립 pending-source-filter case 추가와 fixture 배열 명시 타입만 바뀌었다. 선택 case는 Shift 다른 parent fallback 기대를 보완한 최종 실행이고 폭 case는720px 기존 작업면 한계를 반영한 최종 실행이다. 이전 오류 실행은 보존한다. |
| current-source1 / source filter·기본·editable | 이후 fixture local 배열의 명시적 ProjectTaskDto[] 타입으로 typecheck 오류만 보완했다. 동일 canonical 배열/전달값이며 추가 제품 행동 변화는 없다. |
| 기존 영향4 | 각 기존 spec은 수정하지 않았다. 동일 현재 제품2파일에서 실제 실행한 native Core 근거를 사용한다. |

캡처 JSON의 당시 spec SHA는 그대로 보존한다. execution manifest의 최종 spec SHA와 같다고 표시하지 않으며, 서로 다른 spec hash를 제품 source drift로 해석하지 않는다. 기능 소스가 다시 바뀌면 이 재사용 판단도 다시 검토해야 한다.

Production DOM 복원은 snapshot/reset generation/instance/input/geometry를 검사하고 Core 복원은 실제 canonicalSyncVersion ref를 검사한다. DOM sync marker는 기존 개발/test 전용 추가 검사이며 개발 browser 증거를 production marker PASS로 해석하지 않는다.
