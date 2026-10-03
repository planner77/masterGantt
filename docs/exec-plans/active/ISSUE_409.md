# Issue #409 실행 계획 — Copy ID / Relation Editor ID 검색 정합화

상태: 최신 main 재정렬 및 PR CI 재검증.

## 기준

- main: `da0f39a4dde363bd84ad2e938089c40d2dd9e29a`
- main version: `0.76.0`
- target version: `0.76.1`
- branch: `fix/issue-409-relation-id-search`
- release_required: true
- release_authorized: false

## 문제

#390 `Copy ID`는 canonical `taskId` UUID를 복사하지만 Relation Editor는 후보를 작업명과 `externalId`로만 검색하고 `externalId`만 “ID”처럼 표시했다. 따라서 복사한 UUID로 관계 후보를 찾을 수 없고 이름 검색 결과의 ID가 복사 값과 다르게 보였다.

## 구현

1. `searchCandidateTasks()`: name + externalId + taskId contains 검색.
2. placeholder: `작업명 / 외부 ID / 작업 ID 검색...`.
3. 후보/선택 표시: `외부 ID:`와 `작업 ID:`를 별도 metadata로 표시.
4. Link create callback/API는 기존 task resolve → externalId payload를 유지.
5. #390 Copy ID 구현은 변경하지 않는다.
6. 최신 main의 #370 Grid 시작일 Date Picker 및 기존 일정/편집 계약을 보존한다.

## 검증

- Unit: name/externalId/taskId exact·partial·case-insensitive·trim, 기존 exclusion.
- Chromium: Copy ID → clipboard → Beta Task Editor → Relation Editor → Ctrl+V → Alpha 후보 → Link create.
- 후보/선택의 두 ID 표시.
- Link POST는 externalId endpoint.
- 기존 relation-dialog UX keyboard/Escape/focus/dirty/pending/readonly/responsive 회귀 유지.
- API/DB/Scheduling/Security: N/A.
- 정렬 후 exact PR head의 GitHub Actions quality/e2e/docker를 새로 판정한다.

공식 판정은 동일 PR exact head의 GitHub Actions quality/e2e/docker다.
