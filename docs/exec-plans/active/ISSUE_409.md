# Issue #409 실행 계획 — Copy ID / Relation Editor ID 검색 정합화

상태: 구현·테스트·문서 동기화 진행 중, PR CI 준비.

## 기준

- main: `fa57ba77fd632fa530ca2c27091a072536a67172`
- main version: `0.75.0`
- target version: `0.75.1`
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

## 검증

- Unit: name/externalId/taskId exact·partial·case-insensitive·trim, 기존 exclusion.
- Chromium: Copy ID → clipboard → Beta Task Editor → Relation Editor → Ctrl+V → Alpha 후보 → Link create.
- 후보/선택의 두 ID 표시.
- Link POST는 externalId endpoint.
- 기존 relation-dialog UX keyboard/Escape/focus/dirty/pending/readonly/responsive 회귀 유지.
- API/DB/Scheduling/Security: N/A.

공식 판정은 동일 PR exact head의 GitHub Actions quality/e2e/docker다.
