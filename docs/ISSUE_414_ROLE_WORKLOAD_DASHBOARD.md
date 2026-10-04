# Issue #414 — 역할 기반 Resource workload 및 개발자 공수 견적

## 기준

- Epic: #411
- 선행: #412 Global Resource Role, #413 Task Resource 수행 역할
- 구현 기준 main: `a280505596961395d165f3759d3a27649ddac8b5`
- 기준 application: `0.80.0`
- target application: `0.81.0`
- release_required: `true`
- release_authorized: `false`

## 목적

기존 #56 Resource workload를 새 계산 엔진으로 교체하지 않고, 같은 Task Resource assignment를 수행 역할 기준으로 분류해 PI·개발자·설비 담당 공수와 개발자 견적을 Project Resource View에서 확인한다.

## 계산 계약

역할은 **분류 차원**이며 공수를 추가로 생성하지 않는다.

```text
M/D = 조회 구간과 assignment 유효 구간의 교집합 근무일
      × allocationPercent / 100
M/M = M/D / RESOURCE_MD_PER_MM
```

- 개인 Resource가 직접 할당된 일반 Task만 계획 공수를 생성한다.
- Group, Summary, Milestone, Project Equipment/System 책임 관계는 개인 공수를 생성하지 않는다.
- Grand Total은 기존처럼 `assignmentId`별 한 번만 합산한다. 한 Resource가 여러 Group에 속해도 Grand Total은 증가하지 않는다.
- 역할 subtotal도 동일 assignment row의 `assignment_role`을 기준으로 정확히 한 bucket에 넣는다.
- `assignment_role = NULL`은 Global Role에서 추정하지 않고 `UNSPECIFIED`로 별도 집계한다.
- `allocationPercent = NULL`은 기존처럼 공수 미설정이며 100%로 추정하지 않는다.
- Resource Calendar 계층과 과투입 판정은 #56/#261 계약을 그대로 사용한다.
- Task progress/status는 표시 정보다. 계획 공수를 진척률로 차감하거나 실제 소진 공수로 환산하지 않는다.

## 상태·지연 표시

Task detail에는 canonical `start/end/progress/status`를 함께 반환한다. 지연은 물류 대시보드 #188과 같은 정의를 재사용한다.

```text
delayed = progress < 100 AND canonical end < asOfDate
```

`asOfDate`는 Project `calendarTimezone` 기준 서버 날짜다. 새로운 지연 정의를 만들지 않는다.

## API 확장

기존 public-read `GET /api/projects/{publicId}/resource-workload`를 하위 호환 확장한다.

기존 필드에 추가되는 정보:

- `asOfDate`, `timezone`
- `roleTotals[]`: role, assignmentCount, effortMd, effortMm, unsetCount
- `unspecifiedRoleCount`
- `overAllocatedResourceCount`
- Resource detail의 `developerGrade`
- Task detail의 `role`, canonical taskStart/taskEnd, progress/status/delayed

기존 client fixture를 깨지 않도록 신규 응답 필드는 TypeScript contract에서 optional로 수용하되 실제 server response는 제공한다.

## UX

기존 Resource tab의 Group → Resource → Task drill-down을 유지한다.

- 상단 전체 계획 공수 / 공수 미설정 / 과투입 요약을 유지한다.
- PI / 개발자 / 설비 담당 / 역할 미지정 역할 subtotal을 별도 flat summary row로 표시한다.
- 고급 필터에 수행 역할과 개발자 등급을 추가한다.
- `개발 견적` preset은 `종류=Resource`, `수행 역할=DEVELOPER`를 한 번에 적용한다.
- preset 및 역할/기간/등급 필터가 적용된 drill-down의 Resource/Group subtotal은 **현재 표시 Task**만 다시 합산한다. 상단 Project 전체 역할 subtotal은 필터와 무관한 서버 권위 값으로 유지한다.
- 개발자 Resource에는 개발자 등급을 표시하고 Task row에서 역할, 상태/지연, 진행률, canonical 일정, allocation 기간/%, 계획 공수를 함께 본다.
- M/M 기준 미설정이면 기존처럼 M/M 전환을 비활성화한다.
- stale/error/partial retry 상태와 일정↔리소스 tab의 Gantt mount/state 보존 계약은 변경하지 않는다.

## DESIGN / SVAR 검토

`DESIGN.md`와 `docs/UI_UX_GUIDELINES.md`의 workspace-first, data-dense, flat surface, compact control, progressive disclosure 규칙을 그대로 적용한다. 새로운 global visual token이나 layout primitive가 필요하지 않아 DESIGN.md 자체 변경은 N/A다.

SVAR React Gantt 2.7 계열의 Resource/Resource Load는 PRO 범위다. 이 Issue는 PRO 내부 workload 구현을 복제하지 않고 기존 application-owned Resource Catalog, assignment, Calendar, API를 유지한다. SVAR의 resource role / assignment allocation / resource calendar가 서로 분리된 정보 구조만 참고한다.

## 검증 기준

서버 fixture:

- PI 2 M/D + Developer 8 M/D + Equipment Owner 3 M/D = Grand Total 13 M/D
- multi-role Resource의 서로 다른 Task 역할 분류
- multi-group Resource의 Grand Total assignmentId dedup
- Global DEVELOPER Resource의 role-null assignment를 UNSPECIFIED로 유지
- M/M 기준 20일 때 0.65 M/M, 기준 미설정이면 null
- 같은 Resource 50% + 100% overlap의 과투입 감지
- Task progress/status 변경이 계획 공수 합계를 변경하지 않음

Chromium:

- 역할 subtotal, 개발 견적 preset, 역할/등급 filter
- Task progress/status/일정/투입 정보
- 390/768/1024/1440px에서 document overflow 없음
- 일정↔리소스 왕복 후 동일 Gantt instance와 필터/preset 상태 유지
- 기존 loading/error/stale/partial retry 회귀 유지

전체 판정은 PR exact head의 GitHub Actions quality/e2e/docker 결과를 사용한다.
