# Issue #56 — 리소스별 계획 투입 공수(M/D·M/M)

## 1. 목적

Issue #19에서 추가한 글로벌 Resource / Resource Group 및 작업별 직접 할당을 기반으로, 프로젝트에서 리소스별 계획 투입기간과 투입률을 관리하고 계획 공수를 M/D 또는 명시적으로 설정된 M/M 기준으로 조회한다.

## 2. 데이터 모델

SQLite `0005_resource_workload.sql`은 기존 `task_assignments`에 다음 nullable 필드를 추가한다.

- `assignment_start`: 선택적 투입 시작일(`YYYY-MM-DD`)
- `assignment_end`: 선택적 투입 종료일(`YYYY-MM-DD`)
- `allocation_percent`: 0 초과 100 이하의 선택적 투입률

기존 Issue #19 데이터는 migration 후 세 필드가 `NULL`이다. 기존 할당의 `allocation_percent = NULL`을 100%로 추정하지 않는다. 사용자가 계획 투입률을 명시하기 전까지 해당 assignment는 `공수 미설정`으로 표시하고 합계에서 제외한다.

개별 `resource` 직접 할당만 계획 공수 속성을 갖는다. `group` 직접 할당은 담당 팀 참조이며 그룹 구성원에게 allocation을 자동 복제하거나 분배하지 않는다.

## 3. 투입기간과 유효성

- 시작/종료를 모두 생략하면 작업의 서버 확정 `start` / `end`를 상속한다.
- 명시 기간은 일반 leaf task의 확정 일정 범위를 벗어날 수 없다.
- 시작일은 종료일보다 늦을 수 없다.
- Summary / Milestone / group 직접 할당은 담당 정보로 보존하지만 개인 계획 공수 합계에는 포함하지 않는다.
- Project revision과 Resource Catalog revision의 기존 optimistic concurrency 계약을 유지한다.

## 4. 공수 계산

프로젝트의 기존 Calendar 근무일 규칙을 재사용한다. 별도의 주말/공휴일 계산 정책을 만들지 않는다.

```text
M/D = 조회 구간과 assignment 유효 구간의 교집합에 포함된 근무일 수
      × allocationPercent / 100
```

M/M은 조직마다 기준이 다르므로 숨은 상수로 정의하지 않는다.

```text
M/M = M/D / RESOURCE_MD_PER_MM
```

`RESOURCE_MD_PER_MM`이 유효한 양수일 때만 M/M 값을 제공한다. 미설정 또는 잘못된 값이면 M/D 조회는 계속 제공하되 M/M 전환은 비활성화하며 임의 환산을 하지 않는다.

## 5. 조회 API

### `GET /api/projects/{publicId}/resource-workload?from=&to=`

Project readonly 범위의 조회 API다. 서버가 assignment, Task 확정 일정, Project Calendar, Resource/Group catalog를 조합해 계산한다.

주요 응답 정보:

- 조회 범위 `from` / `to`
- 그룹 → 리소스 → 작업 계층
- 작업별 effective 시작/종료, 투입률, M/D, M/M
- 그룹/리소스 subtotal과 assignment 기준 Grand Total
- `unsetCount`: 투입률 미설정 건수
- `overAllocated`: 같은 리소스의 동일 근무일 allocation 합계가 100%를 초과했는지 여부
- `mdPerMm`: 현재 M/M 환산 기준 또는 `null`

한 리소스가 여러 그룹에 포함되면 각 그룹 아래에서 조회할 수 있다. Grand Total은 assignment ID 기준으로 한 번만 계산한다. 어느 그룹에도 속하지 않는 리소스는 `미분류 리소스`로 표시한다.

## 6. UI

Task Editor의 기존 담당 리소스/그룹 편집을 확장한다.

- 개별 Resource: 투입 시작, 투입 종료, 투입률(%) 입력
- Group: 기존 담당 그룹 선택만 제공, 개인 allocation 입력 없음
- 기존 allocation 미설정 Resource는 미설정 상태를 명시적으로 표시

프로젝트 화면에는 `리소스 공수` 조회 영역을 제공한다.

- 그룹 → 리소스 → 작업 drill-down
- M/D / M/M 표시 단위 전환
- M/M 기준 미설정 시 전환 버튼 비활성화 및 기준 미설정 표시
- 공수 미설정 건수 및 과투입 표시
- 새로고침으로 최신 서버 집계 조회

리소스 공수 UI는 `.project-page-shell`의 별도 flex sibling으로 Gantt 폭을 줄이지 않는다. React portal로 `.project-readonly` 내부에 배치해 기존 Gantt 인스턴스, 폭, 스크롤 및 header hit-area 계약을 유지한다.

## 7. 보안·호환성

- Assignment mutation은 기존 Project edit session, exact Origin, strong `If-Match`, Project/Catalog revision 검증을 그대로 사용한다.
- Workload GET은 Project direct read와 같은 공개 readonly 범위이며 password/session/token을 응답하지 않는다.
- SQL/stack/filesystem path는 공용 오류 응답에 노출하지 않는다.
- 기존 Issue #19 assignment ID와 canonical Project snapshot 참조를 유지한다.
- migration은 기존 `0004_project_owner.sql` 다음인 `0005_resource_workload.sql`로 추가한다.

## 8. 버전

사용자 workflow와 API/DB 계약을 하위 호환으로 확장하는 기능이므로 SemVer MINOR로 분류한다.

```text
0.13.0 → 0.14.0
```

`package.json`과 `package-lock.json`의 root version을 동일하게 유지한다.

## 9. 검증 기준

필수 GitHub Actions gate:

- release version consistency
- TypeScript typecheck / ESLint
- 테스트 발견 검증 / 전체 Vitest
- production dependency audit
- Markdown link / deployment shell syntax
- production build
- Chromium 전체 E2E
- Docker image build/content policy
- migration/readiness/native SQLite restart persistence
- production HTTP·HTTPS 실제 브라우저 검증
- relocated Compose persistence

Issue #56 구현 과정에서 신규 공수 영역을 `.project-page-shell`의 직계 flex sibling으로 추가해 기존 Gantt 폭과 E2E geometry가 변경되는 회귀를 확인했다. 공수 영역을 Project workspace 내부 portal로 이동해 해결했으며, 기존 persistence E2E의 레이아웃 검증은 전체 `.project-readonly`가 아니라 실제 일정 경계인 `.project-schedule`을 기준으로 유지한다.

## Issue #76 화면 배치 갱신

Issue #56 당시 Gantt 폭 회귀를 피하기 위해 사용한 page 하단 portal 배치는 Issue #76에서 폐기한다. Workload API/계산/assignment 계약은 그대로 유지하되, 표시 영역은 Project Workspace의 `리소스` tab으로 이동한다. 일정 tab과 리소스 tab은 sibling flex column으로 Gantt 폭을 나누지 않으며, tab 전환 중 Gantt panel mount를 유지해 기존 Gantt instance/state 보존 계약을 유지한다.
