# Issue #486 — 401 후 보존 Resource 초안과 다른 편집 명령 분리

## 기준과 요청 범위

- Issue: #486 `[BUG][P2] 401 후 보존된 Resource 초안이 다른 편집기 열기를 가로채는 문제`
- 최신 정렬 기준: `main` `44b2ee3562cf76a73368a49fa17933ed341ab424`, application `0.94.2`
- 작업 branch: `fix/issue-486-suspended-resource-draft`
- 사용자 요청 종료점: 구현, 관련 문서 동기화, PR 생성, 동일 head PR CI 시작
- CI 결과 모니터링, 병합, main CI/GHCR, 정식 release, branch cleanup, Issue close는 이번 요청 범위 밖이다.
- version: 하위 호환 UI state bug 수정이므로 `0.94.3` PATCH
- `release_required=false`, `release_authorized=false`

## 문제와 사용자 흐름

Resource Catalog는 401 세션 만료 시 비민감 editor draft를 memory에 보존하고 editor를 suspended 상태로 둔다. 재로그인 후에는 `보존한 초안 계속 편집`이 문서화된 명시 재진입 경로다.

기존 `openEditor()`는 suspended dirty editor가 있으면 새 trigger의 kind/resource를 무시하고 기존 editor를 바로 재개했다. 따라서 Resource 초안이 suspended된 상태에서 `그룹 추가`를 눌러도 Group editor가 아니라 기존 Resource editor가 열릴 수 있었다.

수정 흐름은 다음과 같다.

1. 401 후 dirty Resource/Group/Profile draft는 계속 suspended 상태로 보존한다.
2. `보존한 초안 계속 편집`은 기존 draft를 직접 재개하는 명시 경로다.
3. suspended dirty draft가 있는데 다른 Resource/Group/Profile 편집 trigger를 누르면 `보존한 초안 확인` dialog를 표시한다.
4. `초안 유지`는 기존 draft를 suspended 상태로 그대로 남기고 trigger focus를 복원한다.
5. `초안 폐기 후 <요청 작업>`은 기존 editor draft만 지운 뒤 사용자가 실제로 누른 Resource 추가/Group 추가/Profile 편집을 연다.
6. 다른 trigger를 눌렀다는 사실만으로 기존 draft를 자동 재개하거나 자동 폐기하지 않는다.

## 보존 계약과 비범위

- 유지: admin session/401/403/412, strong If-Match/revision, pending 중복 mutation 차단, 비밀번호 clearing, catalog refresh, Escape/focus restore, 비민감 draft memory 보존
- API/DB/schema/security/scheduling 계약 변경 없음
- 공용 WorkspaceDialog primitive, Resource Catalog 시각 체계, 검색/필터/Group 구성원 저장 계약 변경 없음
- suspended draft의 영속 저장, 여러 editor draft 동시 보존, 새로운 autosave는 비범위
- SVAR Gantt 기능과 무관한 관리자 화면 상태 전환이므로 SVAR sample/API 변경·도입은 N/A

## 구현 파일

- `src/features/resources/resource-catalog-admin.tsx`
- `tests/e2e/resource-error-recovery.spec.ts`
- `docs/PROJECT_UX.md`
- `docs/TEST_PLAN.md`
- `docs/exec-plans/active/PLAN.md`
- `CHANGELOG.md`
- `package.json`, `package-lock.json`

## 검증

전용 E2E는 다음을 확인한다.

- Resource dirty draft → 401 → 재로그인 → Group 추가: 기존 Resource editor 자동 재개 금지, conflict dialog 표시, `초안 유지` 후 명시 재개 시 값 보존
- Group dirty draft → 401 → 재로그인 → Resource 추가: conflict dialog에서 폐기 후 실제 Resource editor가 열리고 Group draft 제거
- Profile dirty draft → 401 → 재로그인 → Resource 추가: 자동 Profile 재개 금지, `초안 유지` 후 명시 재개 시 Profile 값 보존
- 기존 401/412, password clearing, pending/focus/Escape 회귀는 기존 `resource-error-recovery.spec.ts`와 동일 PR head의 required CI로 판정한다.

현재 connector 세션에는 repository shell/worktree 실행 도구가 없으므로 Local Fast Feedback은 NOT TESTED로 남긴다. 최종 공식 검증은 PR head의 `quality`, `e2e`, `docker` GitHub Actions다.

## 문서 영향 판정

- DESIGN.md: 변경 없음. 기존 precise feedback/progressive disclosure/focus 규칙을 적용한다.
- AGENTS.md / ISSUE_LIFECYCLE.md / CI_CD.md / GITHUB_OPERATIONS.md: 절차 변경 없음.
- API.md / DB_SCHEMA.md / SECURITY.md / SCHEDULING_ENGINE.md: 제품 계약 변경 없음.
- PROJECT_UX.md / TEST_PLAN.md / active PLAN / CHANGELOG: 이번 editor 전환 계약과 검증 범위를 동기화한다.
