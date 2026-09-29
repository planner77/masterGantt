# Issue #300 Grid DnD 이후 이름 수정 시 순서 복귀 수정

기준: `main` `812143fe72efafd3e1169b1f29e798b7a88ecf27`, 2026-09-29. [Issue #300](https://github.com/planner77/masterGantt/issues/300)을 대상으로 한다. 로컬 main을 fast-forward하고 `fix/issue-300-grid-dnd-order-persistence`에서 작업했다. 사용자 output/와 이전 작업 branch는 보존한다. 기존 API를 재사용한 회귀 수정이므로 version 0.53.5 → 0.53.6 PATCH다.

## 원인과 수정 경계

설치된 SVAR Core 2.7.3의 Grid는 drag 중 `move-task`에 `inProgress: true`, drop에 `inProgress: false`를 전달한다. 기존 ProjectGantt는 add/update를 가로채지만 native Grid move의 서버 저장 연결이 없어 client tree만 이동했다. Context Menu는 기존 hierarchy command로 DB order를 저장했다. 이름 PATCH의 schema와 Repository SQL은 parent/order를 갱신하지 않는다. 따라서 이름 저장 후 authoritative snapshot을 적용할 때 저장되지 않은 client 순서가 원래 DB 순서로 복원됐다.

공개 move-task gateway를 추가해 최종 drop을 기존 `{kind: reparent, taskId, anchorTaskId, placement: before|after|child}`로 전달한다. up/down은 기존 move 명령으로 연결한다. 드래그 중 피드백을 보존하고 drop 확정은 서버 canonical 결과로 적용한다. 내부 canonical 이동은 eventSource와 동기화 범위로 구분하여 서버 mutation으로 되돌려 보내지 않는다.

새 API, migration, hierarchy 알고리즘, DataProvider, PRO 또는 dependency 업그레이드는 없다. [#72](https://github.com/planner77/masterGantt/issues/72)의 계층 명령과 [#140](https://github.com/planner77/masterGantt/issues/140)의 이름 편집을 재사용한다. 부모 변경·타입·빈 Summary·cycle·Dependency 제한도 기존 서버 정책을 유지한다.

## UX 및 실패 처리

[DESIGN](../DESIGN.md)과 [UI_UX_GUIDELINES](UI_UX_GUIDELINES.md)의 작업 상태 보존 원칙을 적용한다. 기존 Grid/Context Menu/inline editor의 구조와 시각 표현은 유지하며 frontend가 기존 interaction 안의 버그 수정을 겸한다. 별도 ui_ux 재설계는 N/A다.

```text
Grid drag → 임시 행 이동
drop → 기존 보호 hierarchy 명령 → 새 revision/canonical 순서
이름 또는 비구조 속성 수정 → 같은 순서의 canonical snapshot
실패/412 → 기존 오류 안내와 canonical 복구
```

readonly와 저장 중에는 추가 native 이동을 차단한다. 이름 변경은 최신 revision을 사용하며 parent/sibling order를 변경하지 않는다. 성공한 저장과 복구는 동일 Gantt 인스턴스에서 처리하고 스크롤·선택·접힘 상태를 보존한다.

Core 2.7.3의 명시적 `inProgress: false`는 구조 이동을 다시 수행하지 않고 drag 표시와 source를 정리한다. 최종 저장을 연결한 뒤 이 내부 정리는 허용한다. `inProgress`가 없는 일반 move 명령은 서버 결과가 적용할 때까지 로컬 구조 변경을 차단한다.

## 공식 자료

2026-09-29 [SVAR Next.js backend guide](https://docs.svar.dev/react/gantt/integration-guides/nextjs/backend/), [move-task](https://docs.svar.dev/react/gantt/api/actions/move-task/), [update-task](https://docs.svar.dev/react/gantt/api/actions/update-task/)와 설치 Core의 Grid 구현을 확인했다. 공식 guide의 구조 이동과 일반 속성 수정 분리 원칙을 따르되 masterGantt의 cookie/Origin/If-Match/canonical API를 유지한다. 공식 문서 조회와 실제 사용자 조작 증거는 구분하며 후자는 본 제품의 focused Chromium 테스트에서 수집한다.

## 문서 동기화

- TASK_EDITOR/PROJECT_UX: native Grid 이동의 영속성, 후속 이름 편집, 실패 복구 계약.
- API/DB_SCHEMA/SCHEDULING_ENGINE: 기존 reparent 및 name-only PATCH의 저장 불변조건을 명료화한다. 실제 endpoint/schema/domain 정책 변경은 N/A.
- TEST_PLAN/CHANGELOG 및 본 기록 갱신. REQUIREMENTS/DESIGN/공통 UI_UX_GUIDELINES/ARCHITECTURE/SECURITY/IMPORT/CI_CD/REMOTE_VALIDATION은 기존 계약을 준수하므로 규칙 변경 N/A.

## 검증 및 승인 범위

### 변경 전 재현

infra가 기준 SHA의 별도 `/tmp` archive·합성 SQLite·임시 port에서 실제 pointer로 재현했다. Task B를 Task C 뒤로 이동하면 Grid는 `[A,C,B]`이지만 `task-commands` 요청은 0회이고 서버는 `[A,B,C]`였다. 이름을 수정하면 Grid가 `[A,B 수정,C]`로 되돌아갔다. 이 알려진 결함을 확인하는 단일 Chromium 재현 테스트는 1 PASS다.

- [DnD 직후 client 순서](images/issue-300/before-dnd-client-order-1440.png)
- [이름 변경 후 순서 복귀](images/issue-300/before-rename-rollback-1440.png)

실행: `/tmp/issue-300-baseline`에서 `npm run test:e2e -- --config tests/config/playwright.baseline.config.ts tests/e2e/issue-300-baseline.spec.ts --workers=1`. 임시 config는 공유 3100 서버를 생략하고 isolated fixture를 사용한다. 최초 sandbox loopback EPERM, 이어 외부 node_modules symlink에 대한 Turbopack 제한으로 제품 동작 진입 전 실패했다. 권한 승인 및 임시 baseline fixture의 `next dev --webpack`으로 실행했다. 변경 전 캡처의 dev bundler 차이를 제품 코드 차이로 간주하지 않는다.

### 변경 후 검증

- 실제 Agent: frontend 구현·브라우저, backend SQLite/HTTP regression, infra 최신화/branch/version/PR, qa_docs 독립 검토, Manager 통합.
- Local Fast Feedback PASS: frontend gateway/canonical unit 12 tests, backend 신규 6개를 포함한 service/HTTP 28 tests. qa_docs는 gateway/canonical/SQLite 3 files, 18 tests를 독립 실행하여 PASS를 확인했다. 이 수치는 겹치는 테스트를 포함하며 합산하지 않는다.
- Chromium PASS: `npm run test:e2e -- tests/e2e/project-grid-reorder-persistence.spec.ts --project chromium --grep Grid`의 focused 4시나리오(session `25171`, `4 passed (1.5m)`, exit 0)를 검증했다. 실제 pointer DnD의 최종 저장 1회, 이름만 PATCH, 직접 새로고침, 연속 DnD, Grid/Chart 행 중심 일치, drag 표시 정리, 진행률 수정, Context Menu Up/Down, 다른 parent로 이동·이름 수정·접힘/펼침·새로고침을 확인했다. 지연된 412/500에서는 편집 잠금과 canonical 복구 후 이름 변경, Gantt 인스턴스 보존을 확인했다.
- 390/768/1024/1440px에서 Grid 작업명 접근과 페이지 가로 overflow 없음, 실제 캡처를 확인했다. 별도 실제 touch 기기 조작은 NOT TESTED다.
- Typecheck, 대상 ESLint, version check, `git diff --check`, Markdown 링크 검사 PASS. ESLint는 기존 fullscreen hook dependency warning 1개가 있으며 오류는 없다.
- 초기 frontend E2E는 합성 fixture의 password 길이 제한 위반으로 제품 동작 전에 실패하여 값을 수정했다. 확장 parent 테스트의 새로고침 직후 동기 count 조회는 준비 중인 열린 Summary를 닫는 race를 일으켜, child 표시를 기다리는 조건으로 수정했다. 이후 최종 4시나리오가 모두 PASS다. backend 초기 fixture는 description을 제공하는 production service를 사용하도록 수정했다.
- DOCUMENTATION_SYNC PASS 및 qa_docs 독립 사전 QA PASS: required docs 갱신과 N/A 영향 분석, 코드·테스트 정합성을 확인했다. baseline `812143fe`와 working diff 대상 검토이며, QA는 unit 직접 실행과 Chromium report의 `4 expected / 0 unexpected / 0 flaky / 0 skipped`, 전후 캡처를 독립 확인했다. PR exact head의 원격 전체 회귀와 최종 ACCEPT를 대체하지 않는다.
- 원격 quality/e2e/docker: NOT TESTED. PR의 exact head CI 시작만 확인한다.
- 사용자 승인 범위는 구현·PR·CI 시작까지다. release_required=false / release_authorized=false; CI 완료 모니터링, merge, main/GHCR, 정식 release, 운영 배포, branch 삭제와 Issue 종료는 수행하지 않는다. 이는 전체 Issue 완료 또는 최종 Manager ACCEPT가 아니다.

### 변경 후 캡처

- [DnD와 이름 변경 이후 순서 및 Grid/Chart 정렬](images/issue-300/after-dnd-rename-1440.png)
- [390px](images/issue-300/after-reorder-390.png), [768px](images/issue-300/after-reorder-768.png), [1024px](images/issue-300/after-reorder-1024.png), [1440px](images/issue-300/after-reorder-1440.png)
