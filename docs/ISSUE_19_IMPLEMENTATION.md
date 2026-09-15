# Issue #19 글로벌 리소스·그룹 및 작업 할당 구현

## 1. 확정 범위

Issue #19의 기존 `Decision Required`는 2026-09-15 구현 요청을 승인으로 보고 다음과 같이 확정한다.

- 글로벌 카탈로그 관리는 Project edit session과 분리된 `resource_catalog_admin` 세션만 허용한다.
- bootstrap 비밀번호는 `RESOURCE_CATALOG_ADMIN_PASSWORD` 환경 변수로만 주입한다. 16자 미만/미설정이면 인증을 fail-closed 한다.
- 리소스/그룹은 `name`, optional `code`, `description`, `active`만 저장한다.
- 그룹은 평면 집합이며 중첩 그룹은 지원하지 않는다. 한 리소스는 여러 그룹에 속할 수 있다.
- 그룹 직접 할당은 ‘담당 팀 참조’이며 멤버 개인 할당을 생성하지 않는다.
- `task`, `summary`, `milestone` 모두 리소스/그룹 직접 할당을 허용한다.
- 할당은 일정·진행률·기간·workload·capacity·calendar·leveling 계산에 영향을 주지 않는다.
- 삭제 대신 비활성화를 기본 제거 방식으로 사용한다. 글로벌 FK는 `ON DELETE RESTRICT`다.
- SVAR React Gantt의 PRO resource API/package는 사용하지 않는다. 앱 자체 DB/API/UI로 구현한다.

## 2. 공식 SVAR 경계 확인

2026-09-15 공식 문서 기준으로 React Gantt의 Resources, Resource load, Resource calendars, Resources backend는 PRO 기능이다. `add-assignment` 역시 PRO 전용이며 공식 동작에서는 summary task에 assignment를 추가할 수 없다.

따라서 본 구현은 SVAR의 `resources`, `assignments`, `add-assignment`, resource grouping/workload API를 호출하지 않는다. 기존 Gantt Core의 Task 식별자를 앱 자체 assignment 모델의 참조 키로만 사용한다.

참조:

- https://docs.svar.dev/react/gantt/samples/
- https://docs.svar.dev/react/gantt/api/actions/add-assignment/
- https://docs.svar.dev/react/gantt/overview/

## 3. 데이터 모델

Migration `db/migrations/0003_resource_catalog.sql`을 추가한다.

### `resource_catalog_state`

글로벌 catalog optimistic concurrency용 singleton revision을 가진다. 리소스/그룹/멤버 변경 transaction에서만 1 증가한다.

### `resources`, `resource_groups`

- 내부 INTEGER PK와 외부 UUID `public_id`를 분리한다.
- `code`는 optional/unique다.
- `active`는 신규 할당 후보 포함 여부를 결정한다.
- 비활성 대상의 기존 assignment는 유지한다.

### `resource_group_members`

`(group_id, resource_id)` 복합 PK로 멤버 중복을 차단한다. 양쪽 FK는 `ON DELETE RESTRICT`다.

### `task_assignments`

- `(project_id, task_id)` composite FK로 다른 Project의 Task 참조를 DB에서 차단한다.
- `resource_id`/`group_id`는 XOR CHECK로 정확히 하나만 허용한다.
- 부분 UNIQUE index로 같은 Task에 같은 Resource/Group 중복을 금지한다.
- Task/Project 삭제 시 해당 assignment만 cascade하고 글로벌 catalog는 보존한다.

## 4. 권한 및 세션

### Project edit session

기존 `mastergantt_edit` 쿠키와 Project `auth_version` 검증을 그대로 사용한다. 다음 동작에 필요하다.

- `GET /api/projects/{publicId}/assignment-targets`
- `PUT /api/projects/{publicId}/tasks/{taskId}/assignments`

### Resource catalog admin session

별도 `mastergantt_resource_admin` (`HTTPS production`: `__Host-mastergantt_resource_admin`) HttpOnly/SameSite=Strict 쿠키를 사용한다. 세션 토큰 원문은 DB에 저장하지 않고 SHA-256 hash만 저장한다. TTL은 8시간이다.

Project edit session을 global admin으로 승격하지 않는다.

## 5. 동시성

- 글로벌 mutation: catalog revision을 strong `If-Match`로 요구한다.
- Task assignment mutation: Project revision을 `If-Match`로 요구하고 body의 `catalogRevision`도 같은 transaction에서 검증한다.
- catalog/member update의 no-op은 catalog revision을 증가시키지 않는다.
- 동일 Task assignment 목록 재제출은 Project revision을 증가시키지 않는다.
- 실제 assignment 변경은 Project revision만 정확히 1 증가시키며 catalog revision은 변경하지 않는다.

## 6. API

### 관리자 세션

- `POST /api/resource-catalog/admin-sessions`
- `DELETE /api/resource-catalog/admin-sessions`

### 글로벌 관리

- `GET/POST /api/resources`
- `PATCH /api/resources/{resourceId}`
- `GET/POST /api/resource-groups`
- `PATCH /api/resource-groups/{groupId}`
- `PUT /api/resource-groups/{groupId}/members`

관리 mutation은 exact Origin + admin session + catalog `If-Match`를 요구한다.

### Project 할당

- `GET /api/projects/{publicId}/assignment-targets?kind=resource|group&q=...`
  - Project edit session 필요
  - active 대상만 반환
  - 최대 100건
- `GET /api/projects/{publicId}/assigned-targets`
  - 기존 Project read 범위에서 실제 할당된 대상의 최소 필드만 반환
  - 그룹 전체 멤버 목록은 반환하지 않음
- `PUT /api/projects/{publicId}/tasks/{taskId}/assignments`
  - Project edit session + exact Origin + Project `If-Match`
  - body에 catalog revision 포함
  - 최대 100개 직접 할당
  - 성공 응답은 최신 `project`, `tasks`, `links`, `assignments` 전체 canonical aggregate와 `catalogRevision`, `warnings`, `operation`을 반환한다.
  - 실제 변경이면 응답 `project.revision`은 요청 `If-Match` revision보다 정확히 1 증가하고, 동일 목록 no-op이면 revision을 유지한다.
  - 응답 `ETag`은 항상 최신 `project.revision`의 strong ETag와 일치한다.

## 7. Canonical Project 응답

`ProjectTaskDto`와 일정 계산 모델에는 resource 필드를 추가하지 않는다. 대신 Project aggregate 응답에 stable typed assignment 참조 컬렉션을 추가한다.

```json
{
  "id": "assignment-public-id",
  "taskId": "task-public-id",
  "target": {
    "kind": "resource",
    "id": "resource-public-id"
  }
}
```

변경 가능한 표시 이름/코드/active 상태는 `/assigned-targets`에서 분리하여 조회한다. `TaskFieldProjectService`가 기존 read/task/metadata canonical 응답에 현재 assignment를 다시 붙이므로 다른 Task 저장 후 assignment 참조가 사라지지 않는다.

Assignment PUT도 같은 canonical aggregate 규칙을 따른다. ResourceCatalogService의 내부 mutation 결과는 revision과 assignment 변경 결과만 담고, HTTP route가 mutation 직후 최신 Project canonical snapshot을 다시 읽어 응답을 구성한다. snapshot revision과 mutation revision이 불일치하면 성공 응답을 만들지 않고 fail-closed 한다.

## 8. UI

### `/resources`

- 별도 관리자 로그인
- Resource/Group 추가
- 활성/비활성 전환
- Group 멤버 다중 선택 및 전체 교체
- catalog revision 충돌 시 최신 catalog 재조회

### Task Editor

- 현재 Task의 Resource/Group 할당 표시
- 편집 모드에서 active 후보 다중 선택
- 비활성 기존 할당은 표시/해제 가능, 신규 선택은 불가
- Task 필드가 dirty 상태이면 assignment 저장을 막아 두 개 revision mutation의 입력을 섞지 않는다.
- assignment 저장 후 기존 canonical reload callback을 사용하여 전체 페이지 reload 없이 Project revision을 동기화한다.

## 9. 검증 항목

신규 서비스 테스트는 다음을 검증한다.

- Project edit 권한과 global admin 권한 분리
- Resource/Group/멤버 생성과 catalog revision 증가
- Resource+Group 동시 직접 할당
- assignment 변경 시 Project revision +1
- 동일 목록 no-op 시 Project revision 유지
- stale catalog revision 거부

Migration 추가에 따라 기존 migration/schema 고정 테스트의 기대 migration/table/index 목록도 `0003_resource_catalog.sql` 기준으로 갱신되어야 한다. PR/CI 단계에서 전체 정적 검사·단위/통합·빌드·E2E 결과를 확인하고 발견되는 회귀를 수정한다.

## 10. 후속 범위 제외

- allocation %, hours/day
- workload/capacity 계산
- resource calendar
- leveling/auto scheduling 연계
- 인사/연락처/급여/단가/자격 정보
- 그룹 중첩
- 그룹 멤버의 개인 assignment 자동 확장
- 물리 삭제 API


## 11. 최종 검증 및 릴리스

- 릴리스 버전: `0.12.0` (Semantic Versioning MINOR)
- 최종 PR: #53
- 최종 PR CI: Run #235 `success`
- Vitest: 530/530 PASS
- Chromium E2E: 50/50 PASS
- Docker/runtime smoke: image policy, migration/readiness, SQLite restart persistence, HTTP/HTTPS cookie·auth transport, relocated Compose persistence PASS
- 릴리스 태그: `v0.12.0` annotated tag를 병합된 release commit에 생성한다.
- GHCR: `release-image.yml`의 SemVer/tag 검증과 release candidate quality/container gate를 통과한 digest만 exact/rolling tag로 승격한다.
- GitHub Release 설명은 `docs/releases/v0.12.0.md`를 기준으로 한다.
