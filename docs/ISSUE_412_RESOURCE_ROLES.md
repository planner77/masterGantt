# Issue #412 — Global Resource 역할 모델과 관리 UI

## 기준

- 재정렬 기준 main: `cd282440369644052c61e481ef9fb64a91476df7`
- 기준 application version: `0.78.1`
- 구현 target: `0.79.0`
- 연계: Epic #411, developer grade #288, Project logistics resource roles #185, Resource Catalog #19/#329
- release_required: `true`
- release_authorized: `false`

## 도메인 결정

Resource의 **전역 역할(Global Resource Role)** 은 Project별 설비/시스템 담당 역할과 Resource Group membership에서 독립된 역량/프로필 속성이다.

stable role code는 다음 3개다.

- `PI`
- `DEVELOPER`
- `EQUIPMENT_OWNER`

한 Resource는 0개 이상의 역할을 가질 수 있고 한 그룹은 서로 다른 역할 조합의 Resource를 포함할 수 있다. 역할 변경은 그룹 membership, Task assignment, Project Equipment/System role, Calendar를 자동 변경하지 않는다.

`DEVELOPER` 전역 역할과 `developerGrade`는 독립 속성이다. 전역 역할을 지정/해제해도 개발자 등급을 자동 생성·삭제하지 않는다. #288의 **Project System developer 신규 배정 시 developerGrade 필수** 규칙은 그대로 유지한다.

## 저장 모델

Migration `0020_resource_roles.sql`은 `resource_roles(resource_id, role, created_at)` M:N 테이블을 추가한다.

- `PRIMARY KEY(resource_id, role)`: 동일 역할 중복 차단
- `CHECK role IN ('PI','DEVELOPER','EQUIPMENT_OWNER')`: stable code만 허용
- `FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE`
- 기존 Resource는 migration 후 역할 0개로 유지하며 임의 backfill하지 않는다.
- 조회 순서는 `PI → DEVELOPER → EQUIPMENT_OWNER`로 canonicalize한다.

## API / 동시성

기존 Resource Catalog API를 확장한다.

- Resource DTO: `roles: ResourceRole[]`
- Resource create/update: optional `roles`
- Group create/update에는 `roles`를 허용하지 않는다.
- 요청 배열은 허용 code, 최대 3개, 중복 없음으로 검증한다.
- Resource Catalog 관리자 session, exact Origin, strong `If-Match`, catalog revision, stale `412` 계약은 기존과 동일하다.
- 동일 canonical roles 저장은 no-op이며 revision을 증가시키지 않는다.
- 역할이 실제 변경되면 다른 Resource 속성과 같은 transaction에서 저장되고 catalog revision이 정확히 1 증가한다.

## UI

`/resources` 관리 화면에서 생성 시 전역 역할을 checkbox group으로 다중 선택하고, 각 Resource row에서도 역할을 바로 변경한다.

- 역할과 개발자 등급을 서로 다른 필드/표현으로 표시한다.
- role badge는 정보 표시용이며 선택 가능 여부/권한 근거로 사용하지 않는다.
- Resource Group 구성원 목록에는 각 Resource의 현재 역할을 참고 정보로 표시하지만 membership을 자동 변경하지 않는다.
- 기존 관리자 인증/새로고침/stale 복구/삭제 UX를 유지한다.
- 390/768/1024/1440px에서 control wrap과 document-level overflow를 검증한다.

## SVAR 경계

2026-10-04 기준 SVAR React Gantt 공식 Resource management 및 Resource의 `role` 속성은 PRO 기능이다.

- https://docs.svar.dev/react/gantt/api/properties/resources/
- https://docs.svar.dev/react/gantt/samples/

masterGantt는 Core 2.7.3과 자체 Resource Catalog를 사용하므로 #412의 전역 역할 관리 모델은 SVAR Resource API/PRO에 의존하지 않는다. 후속 #413의 Task 역할 적합성 필터 역시 이 global catalog를 source로 사용하고 assignment 자체 계약은 별도 Issue에서 다룬다.

## 검증

- SQLite: migration/ledger/table/index, stable role CHECK, PK duplicate, delete cascade, file reopen persistence
- Service: R1(PI+DEVELOPER), R2(EQUIPMENT_OWNER), R3(0 role), canonical order, duplicate reject, stale revision, developerGrade independence, group independence
- Project domain regression: global role edit가 `project_equipment_resource_roles` / `project_system_resource_roles`를 변경하지 않음
- Chromium: role 표시/체크 편집, `If-Match`, keyboard Space, group reference, long Korean Resource name, 390/768/1024/1440 overflow
