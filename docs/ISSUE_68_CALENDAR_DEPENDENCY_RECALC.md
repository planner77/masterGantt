# Issue #68 작업 캘린더 변경 시 Dependency 재계산

## 1. 요구사항 명확화

Issue #57의 Calendar 저장 경로는 Dependency Link가 있으면 `CALENDAR_RECALC_UNSUPPORTED`로 중단했다. Issue #68은 이 제한을 **현재 저장 모델이 지원하는 FS/lag=0** 범위에서 제거한다.

지원 범위:

1. 후보 Project Calendar materialize
2. 모든 Leaf를 `requestedStart + duration`으로 후보 Calendar에서 base 계산
3. 저장된 FS/lag=0 Dependency DAG를 위상 순서로 forward-pass
4. Auto 후행은 모든 선행 종료 다음 근무일 중 가장 늦은 bound 이상으로 이동
5. Manual 후행은 이동하지 않고 bound 위반 시 conflict
6. 최종 Leaf 결과로 Summary 재집계
7. Preview는 원인과 선행 작업을 표시하고 DB를 변경하지 않음
8. PUT은 Calendar, Auto/Summary 일정, revision을 단일 SQLite transaction으로 저장

SS/FF/SF, non-zero lag/lead, Summary dependency endpoint는 이번 범위가 아니다.

## 2. 원인 판정

저장된 후행 Auto 일정은 기존 Dependency 때문에 `requestedStart`보다 이미 늦을 수 있다. 따라서 후보 Calendar base와 현재 저장값만 비교하면 Calendar 원인을 잘못 표시할 수 있다.

Issue #68은 다음 순서로 원인을 판정한다.

- 현재 Project Calendar에서 requested base를 다시 계산
- 후보 Project Calendar에서 requested base를 계산
- 두 base가 다르면 `CALENDAR`
- 후보 base에 FS forward-pass를 적용해 추가 이동하면 `DEPENDENCY`
- 최종 Leaf 변경으로 Summary가 바뀌면 `SUMMARY`

Dependency 원인에는 실제 최대 lower bound를 만든 선행 External ID 목록을 포함한다.

## 3. 오류와 원자성

- 후보 Calendar 자체가 Manual 고정 구간을 바꾸면 `MANUAL_TASK_CALENDAR_CONFLICT`
- FS lower bound가 Manual 시작일보다 늦으면 `MANUAL_DEPENDENCY_CONFLICT`
- Dependency cycle은 `DEPENDENCY_CYCLE`
- missing/summary endpoint/지원 외 relation은 `UNSUPPORTED_SCHEDULE_STRUCTURE`
- Preview 실패/충돌은 저장하지 않는다.
- PUT 실패는 Calendar/Task/Summary/revision 전체를 rollback한다.
- 성공 시 Project revision은 정확히 1 증가한다.

## 4. 구현 구조

- `src/domain/scheduling/dependency.ts`: I/O가 없는 FS/lag=0 graph 검증과 forward-pass
- `work-calendar-service-core.ts`: 현재/후보 Calendar base 비교, Dependency 계산, Summary 집계, transaction orchestration
- `work-calendar-handlers-core.ts`: 구조화된 409 오류 매핑
- `work-calendar.ts`: Preview 원인/선행 ID 계약
- `project-work-calendar-editor.tsx`: Preview 상세 표시

SVAR React Gantt는 표시 계층으로만 유지한다. 이번 변경은 렌더러의 auto-scheduling 기능에 의존하지 않으므로 SVAR PRO scheduling 동작을 복제하거나 호출하지 않는다.

## 5. 버저닝

기존 API 필드를 제거하지 않고 Calendar mutation이 지원하는 일정 구조를 확장하는 하위 호환 기능 추가이므로 Semantic Versioning 기준 **0.16.1 → 0.17.0 MINOR**로 올린다.

## 6. 검증 계획

- Domain unit: FS 분기/합류, milestone, Manual conflict, cycle/invalid structure, immutable/idempotent
- Service integration: Calendar → predecessor → successor → Summary 결과 및 변경 원인
- Transaction integration: Manual dependency conflict rollback, revision 불변
- PR CI: typecheck/lint/Vitest/build/Chromium/Docker 전체 gate
