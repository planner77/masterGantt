# Issue #413 — Task Resource 수행 역할

## 기준

- Epic: #411
- 선행: #412 Global Resource Role
- 재정렬 기준 main: `620209333270cebfe148227e4483a2c499f92b9b`
- 기준 application: `0.79.2`
- target application: `0.80.0`
- release_required: `true`
- release_authorized: `true`

## 도메인 결정

Task의 개인 Resource assignment는 선택적으로 `PI | DEVELOPER | EQUIPMENT_OWNER` 중 하나의 **수행 역할**을 가진다.

- 역할은 Resource의 전역 `roles`에 현재 포함되어 있어야 한다.
- 기존 `(project_id, task_id, resource_id)` unique invariant를 유지한다. 같은 Resource를 같은 Task에 역할별로 여러 번 배정하지 않는다.
- Group assignment에는 수행 역할을 저장하지 않는다.
- migration 이전 개인 assignment는 `assignment_role = NULL`인 **역할 미지정(legacy)** 상태로 그대로 유지하며 추정 backfill하지 않는다.
- API의 omitted/null role도 하위 호환을 위해 UNSPECIFIED로 읽고 쓸 수 있지만, Task Editor에서 새 개인 Resource를 선택할 때는 역할 선택을 필수로 한다.
- 수행 역할 변경은 allocation start/end/percent 및 Resource Calendar에 영향을 주지 않는다.
- #185의 Project Equipment/System 역할과 Global Resource Role, Task 수행 역할은 별개 모델이며 자동 동기화하지 않는다.

## 저장 및 정합성

`0021_task_assignment_roles.sql`은 `task_assignments.assignment_role` nullable TEXT를 추가한다. 허용값은 세 Global Resource Role뿐이다.

DB와 Service는 이중으로 invariant를 방어한다.

1. assignment INSERT/UPDATE trigger가 non-null role이 해당 `resource_roles` row에 존재하는지 검사한다.
2. Resource role DELETE trigger가 그 role을 참조하는 task assignment가 있으면 삭제를 거부한다.
3. Service assignment transaction은 Project strong `If-Match`, `catalogRevision`, 대상 active 여부를 검증한 뒤 Resource role membership을 다시 검사한다.
4. Resource Catalog role 변경 transaction은 제거되는 role별 Project/Task usage를 계산하여 사용 중 role 제거를 `RESOURCE_ROLE_IN_USE`로 fail-closed한다.
5. #412의 role replacement는 실제 제거 역할만 DELETE하고 추가 역할은 `INSERT OR IGNORE`하여 사용 중 role을 보존한 채 역할을 추가할 수 있다.

## API/UX

Assignment target 응답의 Resource는 `roles`를 포함한다. Project assignment는 Resource에 `role`을 포함하며 Group은 `null`이다.

Task Editor 리소스 탭은 다음을 제공한다.

- 역할 필터: 역할을 먼저 선택하면 해당 역할을 보유한 개인 Resource만 후보가 된다.
- Resource별 수행 역할 select: 해당 Resource가 보유한 역할만 노출한다.
- 역할 필터로 신규 Resource를 선택하면 그 역할을 초기값으로 사용한다.
- 기존 역할 미지정 assignment는 명시적으로 표시하고 저장 시 그대로 유지하거나 역할을 보완할 수 있다.
- 역할 변경은 allocation 초안을 건드리지 않는다.
- catalog stale, Project stale, 역할 제거 race는 성공으로 표시하지 않고 최신 정보 재확인을 요구한다.

SVAR React Gantt 2.7의 Resource assignment 모델도 같은 Resource의 같은 Task 중복 assignment를 허용하지 않고 allocation을 assignment 속성으로 다룬다. 본 구현은 PRO 내부 구현을 복사하지 않고 이 application의 기존 Resource tab/API 계약 안에서 performed-role metadata를 확장한다.

## 복사/Template

Project Copy와 Project Template snapshot/instantiate는 `assignmentRole`을 보존한다. 역할 미지정은 계속 null이다.

## 검증

- migration ledger/column/index/guard 존재
- 동일 multi-role Resource를 서로 다른 Task에 PI/DEVELOPER로 저장
- 보유하지 않은 role 저장 거부
- 사용 중 role 제거 거부 + role 추가는 허용
- Task Editor role-first filter, selected role payload
- 기존 NULL role / allocation / Group 계약 회귀
- Project Copy/Template 역할 보존
- 전체 PR Fast CI + Chromium E2E + Docker/remote validation required checks

## CI #1688 실패 보완

- Quality/Vitest/TypeScript/ESLint/Build/Docker는 PASS했고 Chromium E2E만 실패했다.
- 신규 #413 test는 접근성 tree의 `combobox[name="수행 역할"]` locator를 사용한다.
- 기존 #119 allocation validation은 수행 역할을 정상 선택한 뒤 기존 allocation 오류만 검증한다.
- legacy assignment 회귀는 저장 payload의 `role: null`을 명시적으로 검증한다.
- 최신 main `0.79.1` / Issue #418 scoped native-add 변경 위에 재정렬한다.

## 최신 main 재정렬 — #426 반영

- 최신 main `620209333270cebfe148227e4483a2c499f92b9b` / `0.79.2` 기준으로 재정렬한다.
- #426 Resource Catalog geometry 변경은 그대로 보존하며 #413 고유 변경과 직접 코드 충돌은 없다.
- 중첩 파일은 CHANGELOG / TEST_PLAN / package version이며 최신 main 내용을 우선 보존한 뒤 #413 항목을 합성한다.

## PR review 보완

- 역할 후보 검색은 server-side `role` filter를 MAX_SEARCH_RESULTS 적용 전에 수행하여 100건 초과 catalog에서도 후보 유실을 막는다.
- Template snapshot role이 현재 Resource Global Role에서 사라졌으면 assignment/allocation은 유지하고 role만 null로 복원하며 warning을 반환한다.
- 사용자 요청으로 v0.80.0 정식 GHCR 게시 승인을 Issue comment의 version-scoped authorization marker로 기록했다.
