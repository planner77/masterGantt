# Issue #430 — Cut 내부 Dependency 허용 / 외부 경계 Link 제한

## 1. 기준과 목표

- 기준 main: `a280505596961395d165f3759d3a27649ddac8b5`
- 기준 application: `0.80.0`
- 작업 branch: `feat/issue-430-cut-internal-dependency`
- 목표 version: `0.81.0` (하위 호환 사용자 workflow 확장 → MINOR)
- 사용자 종료점: 구현·문서 동기화·PR 생성·PR CI 시작
- `release_required=true`
- `release_authorized=false`

Cut source subtree 내부에서 완결되는 Dependency는 이동을 막지 않고 기존 Link identity와 endpoint를 그대로 유지한다. source subtree 경계를 넘는 incoming/outgoing Link가 있으면 Context Menu/keyboard/Paste/server reparent가 동일하게 차단한다.

## 2. 범위

### 구현

- `task-link-scope.ts`: subtree external ID 집합을 공통 계산하고 boundary-crossing Link helper를 추가한다.
- `project-gantt.tsx`: Context Menu Cut 및 Ctrl/Cmd+X에 boundary helper를 적용한다. Delete의 기존 any-link guard는 유지한다.
- `task-context-menu-model.ts`: cut clipboard Paste 가능 여부를 source boundary로 판정한다. independently linked anchor의 before/after는 허용하고 linked leaf child 전환은 기존 capability로 차단한다.
- `task-hierarchy-service-core.ts`: non-sibling reparent에서 source subtree boundary Link만 거부한다. internal Link는 clone/delete/update하지 않는다.

### 비범위

- 다중 Cut
- Cross-Project Cut/Paste
- Dependency endpoint/type/lag 변경
- Delete/Indent/Outdent/Convert 보호 완화
- Copy 정책 변경
- API payload/schema 변경
- DB schema/migration 변경
- SVAR PRO/private 구현 사용

## 3. 불변조건

- internal Link: public ID, predecessor/successor, type, signed lag/lead 불변
- source Task/descendant: taskId/externalId 불변
- edit session, Origin, strong If-Match, Project revision, cycle/scope/self-descendant 보호 유지
- linked leaf anchor의 `child` Paste가 Summary endpoint 전환을 요구하면 fail-closed
- 성공한 hierarchy mutation은 기존 계약대로 revision +1, 실패는 +0
- Context Menu / keyboard / server command 의미가 동일해야 한다.

## 4. 테스트

- Unit: `tests/features/gantt/task-link-scope.test.ts`
  - internal / incoming / outgoing / unrelated / missing task
- Frontend model: `tests/features/gantt/task-context-menu-model.test.ts`
  - internal source + independently linked target Paste 허용
  - boundary source Paste 차단
- Server integration: `tests/server/projects/task-hierarchy-command-service.test.ts`
  - internal Link subtree cross-parent reparent
  - independently linked anchor before/after
  - incoming/outgoing boundary reject
  - existing #335/Indent/Outdent regression
- Chromium: `tests/e2e/project-task-context-menu.spec.ts`
  - internal Link Summary Context Cut + Ctrl+X + As child Paste
  - Link identity preservation
  - external outgoing Link 추가 후 Cut disabled / Copy enabled
- 공식 remote gate: 동일 PR head `quality/e2e/docker`

현재 실행 환경은 GitHub connector 중심이며 Node/Playwright 명령 실행 가능한 checkout이 없으므로 Local Fast Feedback은 **NOT TESTED**로 남긴다. 실행하지 않은 로컬 검증을 PASS로 대체하지 않는다.

## 5. 문서 영향

필수 갱신:
- `docs/REQUIREMENTS.md`
- `docs/API.md`
- `docs/SCHEDULING_ENGINE.md`
- `docs/TASK_RELATIONS.md`
- `docs/PROJECT_UX.md`
- `docs/TEST_PLAN.md`
- 이 실행 계획과 active `PLAN.md`
- `CHANGELOG.md`

N/A:
- `docs/DB_SCHEMA.md`: table/column/index/FK/migration 변경 없음.
- `docs/ARCHITECTURE.md`: Route→Service→Repository 경계 및 canonical snapshot 구조 변경 없음.
- `docs/SECURITY.md`: session/Origin/If-Match/Project 권한 계약 변경 없음.
- `DESIGN.md`, `docs/UI_UX_GUIDELINES.md`: 기존 action-specific / scope-relative command semantics와 disabled-state 원칙을 그대로 적용하며 새 시각/공통 설계 규칙 없음.

## 6. Phase / 결과 계약

```text
INTAKE → ANALYSIS → PLAN → VERSION_DECIDED → BRANCH_READY
→ IMPLEMENTING → DOCUMENTATION_SYNC
→ PR_OPEN → PR_CI (사용자 요청 종료점)
```

독립 Sub-Agent/qa_docs 실행 도구가 현재 세션에 없으므로 독립 QA는 요청 종료점에서 **NOT TESTED**다. PR CI 완료, QA_FINAL, merge, main CI, GHCR, formal release, branch cleanup, Issue close는 후속 승인/요청 범위다.
