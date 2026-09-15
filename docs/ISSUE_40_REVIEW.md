# Issue #40 Task Editor E2E scroll-state 안정화

## 결론

Issue #40에서 보고된 실패는 제품의 실제 스크롤 이동 결함이 아니라 E2E 관찰 방식의 간헐성이다. PR #38의 동일 head에서 최초 CI는 실패하고 재실행은 성공했으며, 실패 diff에서는 기존 좌표가 바뀌지 않은 상태에서 `[0, 0]`인 scrollable DOM 항목이 새로 추가되어 배열 길이만 달라졌다.

2026-09-15 기준 `main`은 0 위치 항목을 제외하는 완화가 이미 들어가 최근 CI #142가 성공했지만, 레이아웃 시점마다 `scrollHeight/clientHeight` 등을 검사해 SVAR 내부의 모든 scrollable descendant를 다시 수집하는 구조는 남아 있었다. 따라서 정확히 같은 형태의 실패 빈도는 낮아졌지만 구조적 원인은 해결되지 않은 것으로 판단한다.

## 원인 분석

기존 `project-task-editor.spec.ts`는 메뉴 열기/닫기 전후에 Gantt 내부 DOM 전체를 순회하고 그 순간 scrollable로 판정된 요소의 `scrollLeft`/`scrollTop` 배열을 deep equality로 비교했다.

이 방식은 검증하려는 요구사항인 “Task context menu 조작이 화면 스크롤을 움직이지 않는다” 외에 다음 조건까지 암묵적으로 동일해야 했다.

- SVAR 내부 DOM의 scrollable 판정 결과 수
- layout/measurement 완료 시점
- 내부 요소의 overflow geometry
- zero-position 보조 scroll container의 생성 시점

따라서 좌표 이동이 없어도 관찰 대상 집합 자체가 달라지면 실패할 수 있었다.

## 설계 결정

Task Editor 테스트와 실제 스크롤 동작 테스트의 책임을 분리한다.

1. `project-task-editor.spec.ts`
   - 메뉴 열기/취소/대상 전환 전후의 위치 불변성을 확인한다.
   - 동적으로 전체 DOM을 탐색하지 않고 다음 의미 있는 고정 대상만 관찰한다.
     - `window`
     - `.project-gantt-scroll` 프로젝트 작업공간
     - `.project-gantt-widget .wx-table-container` SVAR Grid
     - `.project-gantt-widget .wx-chart` SVAR Chart
   - 각 selector가 정확히 1개인지도 검증해 테스트 대상이 모호해지는 것을 즉시 감지한다.
   - 기존 frame geometry, Gantt instance/API instance, mutation/navigation 불변성 검증은 유지한다.

2. `task-context-menu-scroll.spec.ts`
   - 실제 Chart `scrollLeft`를 변경했을 때 context menu가 닫히는 회귀 테스트를 계속 담당한다.
   - 좌표 변화가 없는 지연 scroll event에서는 메뉴가 유지되는 계약도 계속 검증한다.

이 구분으로 DOM topology 변화와 실제 사용자 관찰 상태 변화를 분리한다.

## 구현 범위

- `tests/e2e/project-task-editor.spec.ts`
  - 동적 scrollable descendant 배열 수집 제거
  - `menuInvariantScrollState()` 고정 selector 기반 snapshot 추가
- `package.json`, `package-lock.json`
  - 버그 수정 범위의 Semantic Version PATCH인 `0.8.2` 적용
- `CHANGELOG.md`
  - 0.8.2 수정 내역 기록

제품 런타임 코드와 데이터 모델/API에는 변경이 없다.

## 버전 판단

공개 기능/API 호환성 변화가 없고 테스트 회귀 안정화에 해당하므로 저장소 `docs/CI_CD.md`의 Semantic Versioning 기준에 따라 PATCH 증가인 `0.8.1 -> 0.8.2`를 적용한다.

## 검증 기준

다음 조건을 모두 만족해야 완료로 판단한다.

- `package.json`과 `package-lock.json`의 버전이 모두 `0.8.2`로 일치한다.
- 정적 검사, unit, build가 성공한다.
- Chromium E2E 전체가 성공한다.
- Docker build/runtime smoke가 성공한다.
- 같은 PR head에서 E2E를 재실행해 간헐 실패가 재발하지 않는다.
- main 병합 후 commit image CI가 성공한다.
- annotated `v0.8.2` tag가 main의 검증된 commit을 가리킨다.
- tag 기반 release image workflow가 성공한다.

최종 PR/CI/tag 실행 번호는 GitHub Issue #40의 완료 기록에 남긴다.
