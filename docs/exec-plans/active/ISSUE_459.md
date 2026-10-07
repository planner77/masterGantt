# Issue #459 — Milestone Stage Gate Epic 통합

## 현재 기준

- 기준 main: `4098a064a9c5a614b0adfa1ac90dcbd9523db993`
- application version: `0.92.0`
- 상위 Issue: #459
- 구현 완료 하위 Issue: #460, #461, #462, #463, #464
- 이번 작업 branch: `feat/issue-459-stage-gate-epic-integration`

#460~#464가 도메인/DB/API → Editor → Gantt/Grid → Dashboard/KPI → JSON·Excel·Copy·Template 순으로 이미 main에 병합되었다. #459에서 제품 기능을 다시 구현하지 않고 Epic 수용 기준과 최신 main을 비교해 통합 공백만 보완한다.

## 통합 감사 결론

제품 runtime 계약은 하위 Issue 구현으로 충족되어 있다.

- Membership은 WBS와 Dependency에서 분리되어 explicit 0..1 + 가장 가까운 Summary 상속으로 계산된다.
- 실행 일정 Dependency는 Task→Task, 단계 Gate는 Milestone→Milestone으로 유지되며 신규 mixed Task↔Milestone 생성은 제한된다.
- Ready/Completed, 완료 구조 잠금, legacy mixed Link 호환, canonical projection이 서버 권위로 구현되어 있다.
- Editor/Grid/filter/Dashboard/물류·Resource/JSON·Excel/Copy/Template가 동일 Stage projection을 사용한다.
- #464 main 반영 뒤 application version은 0.92.0이다.

남은 공백은 다음 두 가지다.

1. `REQUIREMENTS.md`, `ARCHITECTURE.md`, `TEST_PLAN.md`에 하위 Issue별 계약은 있으나 Epic #459 자체의 통합 Source of Truth 연결이 없다.
2. 사용자가 확정한 “각 Milestone에 속한 Task들의 Dependency로 실행 흐름을 표현하고 Task Dependency를 Milestone predecessor로 자동 승격하지 않는다” 정책은 구현상 성립하지만 이를 직접 고정하는 전용 Domain regression이 없다.

## 이번 변경

### 코드/테스트

`tests/domain/milestone-stage-gates.test.ts`에 Epic 통합 회귀를 추가한다.

- 서로 다른 Milestone에 속한 완료 Task 사이의 Task→Task Dependency만 있을 때 후행 Milestone은 predecessor Gate를 가진 것으로 보지 않는다.
- 동일 fixture에 명시적 Milestone→Milestone Dependency를 추가했을 때만 blocked/Ready 판정이 바뀐다.
- 선행 Milestone을 완료하면 Ready가 복구되는지 확인한다.
- 계산 호출이 입력 Link를 새 Milestone Link로 생성/변환하지 않는 순수성도 기존 함수 계약과 함께 유지한다.

### 문서

- `docs/MILESTONE_STAGE_GATES.md`: #459 umbrella 계약과 하위 Issue 역할, Task Dependency와 Gate Dependency 분리 명시
- `docs/REQUIREMENTS.md`: #459 통합 요구사항 추가
- `docs/ARCHITECTURE.md`: canonical Stage projection의 단일 데이터 흐름과 surface별 역할 연결
- `docs/TEST_PLAN.md`: Epic 수준 교차 회귀와 증거 기준 추가
- `docs/exec-plans/active/PLAN.md`: 현재 실행 상태를 #459 PR CI 단계로 갱신

`CHANGELOG.md`는 갱신하지 않는다. 0.92.0에서 사용자 기능이 새로 바뀌는 것이 아니라 이미 릴리스된 #460~#464 계약의 문서 통합과 회귀 guard를 추가하는 변경이기 때문이다.

## Version / Release

- application version: `0.92.0` 유지
- `release_required=false`
- `release_authorized=false`
- 근거: 제품 runtime/API/DB 동작을 변경하지 않는 문서 + 테스트 보강이다.

## 검증

Local Fast Feedback은 현재 GitHub connector 중심 실행 환경에서 Node/Playwright 작업 트리를 직접 실행하지 않으므로 `NOT TESTED`로 기록한다. PR 생성 뒤 동일 exact head의 GitHub Actions `quality/e2e/docker` 집계가 공식 검증이다.

이번 사용자 요청의 종료점은 **문서/회귀 보강 → PR 생성 → exact PR head CI 시작 확인**이다. CI 완료 모니터링, 병합, main CI, GHCR, Issue 종료는 수행하지 않는다.
