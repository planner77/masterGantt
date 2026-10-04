# Issue #409 실행 계획 — Copy ID / Relation Editor ID 검색 정합화

상태: 최신 main 0.78.0 통합 및 PR CI 재검증.

## 기준

- main: `c7e4d8bb0617f8bcb8f6559b609b57aa56f59a32`
- main version: `0.78.0`
- target version: `0.78.1`
- branch: `fix/issue-409-relation-id-search`
- release_required: true
- release_authorized: true — 사용자가 GHCR 게시가 적절한 순서에 실행되도록 명시적으로 요청함

## 문제

#390 `Copy ID`는 canonical `taskId` UUID를 복사하지만 Relation Editor는 후보를 작업명과 `externalId`로만 검색하고 `externalId`만 “ID”처럼 표시했다. 따라서 복사한 UUID로 관계 후보를 찾을 수 없고 이름 검색 결과의 ID가 복사 값과 다르게 보였다.

## 구현

1. `searchCandidateTasks()`: name + externalId + taskId contains 검색.
2. placeholder: `작업명 / 외부 ID / 작업 ID 검색...`.
3. 후보/선택 표시: `외부 ID:`와 `작업 ID:`를 별도 metadata로 표시.
4. Link create callback/API는 기존 task resolve → externalId payload를 유지.
5. #390 Copy ID 구현은 변경하지 않는다.
6. 최신 main의 #416 Week Header 근무 가능 일수와 기존 #299/#407/#370 및 일정/편집 계약을 보존한다.

## 검증

- Unit: name/externalId/taskId exact·partial·case-insensitive·trim, 기존 exclusion.
- Chromium: Copy ID → clipboard → Beta Task Editor → Relation Editor → Ctrl+V → Alpha 후보 → Link create.
- 후보/선택의 두 ID 표시.
- Link POST는 externalId endpoint.
- 기존 relation-dialog UX keyboard/Escape/focus/dirty/pending/readonly/responsive 회귀 유지.
- API/DB/Scheduling/Security: N/A.
- latest main 통합 후 exact PR head의 GitHub Actions quality/e2e/docker를 새로 판정한다.
- PR CI PASS 후 Issue comment의 v0.78.1 version-scoped release authorization marker를 확인하고 merge한다.
- merge 후 exact main CI success가 Generic Release Finalizer와 release-image/GHCR 게시의 선행 조건이다.

공식 판정은 동일 PR exact head의 GitHub Actions quality/e2e/docker다.
