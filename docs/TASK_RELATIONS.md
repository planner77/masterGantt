# Issue #34 — Task Editor 작업 관계 표시

## Issue #430 — Cut/Reparent의 Dependency 경계

Cut source Task/Summary와 모든 descendants를 하나의 이동 집합 `C`로 본다. Link 처리 기준은 관계 존재 자체가 아니라 `C` 경계 통과 여부다.

| predecessor | successor | Cut/Reparent |
| --- | --- | --- |
| C 내부 | C 내부 | 허용 — 기존 Link ID/endpoints/type/lag 유지 |
| C 외부 | C 내부 | 제한 — incoming boundary Link |
| C 내부 | C 외부 | 제한 — outgoing boundary Link |
| C 외부 | C 외부 | 무관 |

따라서 Summary 내부 Task끼리의 FS/SS/FF/SF 및 signed lag/lead는 Summary 전체 Cut → Paste를 막지 않는다. 실제 저장은 동일 Task identity를 이동하는 `reparent`이므로 Copy처럼 Link를 새로 만들지 않는다. 반대로 한 endpoint만 source subtree에 있는 Link가 하나라도 있으면 Context Menu Cut, Ctrl/Cmd+X, cut clipboard Paste와 서버 reparent가 같은 이유로 차단된다.

Paste anchor가 독립적으로 다른 Dependency endpoint인 것은 before/after 배치의 차단 사유가 아니다. 다만 `child` Paste가 linked leaf anchor를 Summary로 전환해야 하면 Summary Dependency endpoint 금지와 기존 fail-closed 보호를 유지한다. #335의 same-parent reorder, #378/#384의 Copy 내부 Link 복제, Delete/Indent/Outdent/Convert 보호는 변경하지 않는다.

## Issue #409 — Copy ID와 Relation Editor 검색 식별자 정합화

Task에는 서로 독립적인 두 식별자가 있다.

- **작업 ID**: `taskId` / DB `tasks.public_id` / immutable UUID. Context Menu `Copy ID`와 Task CRUD/Gantt의 canonical public identifier다.
- **외부 ID**: `externalId` / DB `tasks.external_id` / Project 내부 UNIQUE. Import·Dependency endpoint 계약에서 사용한다.

Relation Editor의 새 관계 후보 검색은 작업명, 외부 ID, 작업 ID를 모두 trim + case-insensitive contains로 검색한다. Summary, 자기 자신, 이미 해당 방향으로 연결된 Task를 제외하는 기존 후보 규칙은 유지한다. 후보와 선택 상태에서는 `외부 ID:`, `작업 ID:` 라벨을 사용해 두 값을 명시적으로 구분한다.

#390의 `Copy ID`는 계속 canonical `taskId`를 복사한다. 사용자는 복사한 UUID를 Relation Editor의 `작업명 / 외부 ID / 작업 ID 검색...`에 붙여넣어 동일 Task를 찾을 수 있다. 검색에 taskId를 사용하더라도 실제 관계 mutation은 기존 callback/API를 통해 Task를 resolve한 뒤 `predecessorExternalId / successorExternalId`를 전송하므로 Link 저장 계약은 변경하지 않는다.

## Issue #384 — 다중 root Copy 집합의 내부 관계

Copy 집합은 선택 ancestor를 제거한 여러 canonical root와 전체 자손의 union이다. 부모와 자손을 함께 선택해도 각 Task는 한 번만 복제된다. 서로 다른 root 사이 관계도 두 endpoint가 union 안이면 새 Link/Task ID로 복제하고 type과 signed lag/lead를 보존한다. 경계를 넘는 incoming/outgoing 관계는 복제하지 않고 원본 관계는 유지한다.

Task Editor는 Copy 성공의 동일 canonical snapshot에서 복사본 관계를 즉시 읽는다. client가 관계 목록을 재작성하거나 제출하지 않는다. #378의 Link 경계와 Cut/reparent/Delete/Convert 보호를 유지하며 다중 Cut/Delete/Edit는 추가하지 않는다. 입력·원자성은 [API](API.md#issue-384--여러-copy-source의-원자적-처리)를 따른다.

## Issue #378 — Copy 집합 내부 관계 복제

Task/Summary subtree Copy에서는 관계의 양쪽 작업이 모두 Copy 집합에 포함된 경우에만 관계를 복제한다.

| 원본 선행 작업 | 원본 후행 작업 | 복사본 처리 |
| --- | --- | --- |
| Copy 집합 내부 | Copy 집합 내부 | 새 Link ID와 새 Task endpoint로 복제 |
| 외부 | 내부 | 복제하지 않음 |
| 내부 | 외부 | 복제하지 않음 |
| 외부 | 외부 | Copy와 무관 |

복제된 관계는 원본 Link의 type과 lag/lead를 보존하지만 원본 Link ID를 공유하지 않는다. 원본 관계는 수정·삭제되지 않는다. linked Task의 Copy 허용은 Cut/reparent/Delete/Convert 등 다른 관계 포함 구조 명령의 허용을 의미하지 않는다.


## 목적

Grid 또는 Chart에서 여는 기존 Task Editor에 현재 작업의 **선행 작업**과 **후행 작업** 관계를 조회 전용으로 표시한다. 관계 추가·수정·삭제는 이번 범위에 포함하지 않으며, 현재 도메인 제약인 FS(Finish-to-Start), lag 0을 변경하지 않는다.

## 표시 규칙

- `link.successorExternalId === currentTask.externalId` 이면 선행 작업으로 표시한다.
- `link.predecessorExternalId === currentTask.externalId` 이면 후행 작업으로 표시한다.
- 상대 작업은 이름과 `externalId`를 함께 표시하여 동일한 작업명이 있어도 식별 가능하게 한다.
- 관계 유형은 `FS (종료 → 시작)`처럼 사용자 의미를 함께 표시하며 lag는 일 단위로 표시한다.
- 관계가 없으면 각각 `없음`으로 명시한다.
- snapshot 안에서 참조 대상 작업을 찾을 수 없는 비정상 데이터는 숨기지 않고 외부 ID와 경고를 표시한다.

## Revision 일관성

Issue #80부터 Task Editor는 관계만을 위해 Project snapshot을 다시 조회하지 않는다. `ProjectWorkspace`가 화면과 Gantt에 사용 중인 동일 canonical `tasks + links + revision`을 Editor에 전달하고, Editor session revision과 현재 Project revision이 일치할 때만 `buildTaskRelations()` 결과를 표시한다.

Editor가 열린 뒤 다른 변경으로 revision이 달라지면 기존 stale 보호 계약에 따라 저장을 막고 **최신 정보 다시 불러오기**를 요구한다. 재조회 성공 시 상위 canonical snapshot과 Editor task session이 함께 새 revision으로 갱신되므로 서로 다른 revision의 작업 필드와 관계를 혼합하지 않는다.

이 구조는 reverse proxy/base path에서 `window.location.pathname`을 다시 해석하거나 관계 전용 `GET /api/projects/{publicId}`를 호출할 필요가 없다.

## 구현 구조

- `src/features/gantt/task-relations.ts`: 링크 방향 판정, 상대 작업 resolve, 표시 모델 생성, 관계 유형 표시 문자열.
- `src/features/projects/project-readonly-view.tsx`: 동일 canonical `tasks + links + revision`을 Task Editor에 전달.
- `src/features/gantt/project-task-editor.tsx`: 전달된 canonical snapshot으로 관계를 계산하고 조회 전용 UI를 표시.
- `src/features/gantt/project-task-editor.module.css`: 선행/후행 목록 레이아웃과 작은 화면 overflow 처리.
- `tests/features/gantt/task-relations.test.ts`: 방향 판정, 동일 이름, 무관계, dangling reference, multiple/type/lag 회귀 테스트.
- `tests/e2e/project-task-editor.spec.ts`: Grid/Chart 더블클릭, Context Menu → Edit, Readonly 및 추가 Project GET/mutation 부재 회귀 테스트.

기존 Grid/Chart/context-menu 진입점은 동일 `ProjectTaskEditor`를 사용하므로 별도의 메뉴 동작이나 SVAR mutation 계약을 변경하지 않는다. 서버 API·DB schema·링크 생성 규칙도 변경하지 않는다.

## 검증 기준

1. 선행/후행 방향이 externalId 기준으로 정확히 분류된다.
2. 동일 이름 작업도 externalId로 구별된다.
3. 관계가 없는 작업은 빈 상태를 명시한다.
4. 상대 작업 참조가 유실된 snapshot도 정보 손실 없이 경고한다.
5. 관계 조회 snapshot revision이 Editor 기준과 다르면 stale 관계를 표시하지 않고 충돌 처리한다.
6. 기존 저장, dirty draft, 재조회, readonly/linked-task 보호 계약을 유지한다.
7. CI의 typecheck, lint, unit/integration, Chromium E2E, Docker smoke를 모두 통과해야 병합한다.


## Issue #74 표시 구조 보완

관계 데이터 계약과 revision 검증은 변경하지 않는다. Task Editor의 관계 정보는 별도 `관계` 탭으로 이동하며 탭에는 현재 선행+후행 관계 건수를 표시한다. wide 화면은 선행/후행을 2열로, 768px 이하에서는 1열로 stack한다. dangling reference, loading, error, empty 상태의 기존 의미와 경고 표현은 유지한다.


## Issue #97 mutation scope

Gantt link markers now support server-persisted FS/lag=0 create/delete. SVAR local actions are intercepted, sent through the protected Link API, and only the returned canonical snapshot is accepted. Issue #97 당시 Task Editor는 relation viewer였으며 현재 관계 탭 mutation 진입 계약은 아래 #377을 따른다.

## Issue #200 Relation Types & Lag

Gantt 관계선 우클릭 시 Relation Context Menu를 제공하여 FS/SS/FF/SF 의존성 유형 및 Lag(일 단위) 변경, 단일 관계 삭제를 지원한다.

## Issue #203 Relation Editor Dialog & Related Item Search

관계선(`[data-link-id]`) 더블클릭 및 Relation Context Menu의 "관계 관리..." 액션을 통해 접근 가능한 전용 Relation Editor 다이얼로그 모달을 제공한다.

1. **선택된 관계 설정**:
   - 선행 작업 (Predecessor)과 후행 작업 (Successor) 정보 및 Anchor(기준 작업) 전환 지원.
   - 관계 유형(FS, SS, FF, SF) 및 Lag(일) 수정 및 단일 관계 삭제.
2. **기준 작업의 연결된 관계 목록**:
   - Anchor 기준 선행 작업(Incoming) 및 후행 작업(Outgoing) 목록 조회 및 각각의 삭제 액션 제공.
   - 목록 항목 클릭 시 해당 관계를 선택된 관계로 전환.
3. **새 관계 추가**:
   - 연결 방향 선택: "후행 작업으로 추가 (기준 → 대상)" / "선행 작업으로 추가 (대상 → 기준)".
   - 작업 검색(인라인/드롭다운): Leaf Task 및 Milestone 대상 검색 (Summary 작업 및 자기 자신, 이미 연결된 중복 관계 자동 제외).
   - 관계 유형 및 Lag 설정 후 "관계 추가"를 통해 단일 인터페이스에서 관계 구성 완료.
4. **상태 보존 및 접근성**:
   - Relation Editor 오픈/변경/삭제/추가 중 Gantt 인스턴스, 스크롤 위치, 트리 접힘 상태 보존.
   - Escape 키 닫기 및 모달 Focus Trap 지원. 세부 초안·요청 보호는 아래 #266 계약을 따른다.

## Issue #266 관계 편집 Dialog의 키보드·초안·요청 보호

공통 `WorkspaceDialog`의 native modal로 배경 상호작용과 focus 이탈을 차단한다. 초기 focus는 안전한 닫기 명령에 두고, 종료 후에는 기존 부모의 실제 호출 위치 또는 Gantt 대체 지점 복원을 유지한다. 모달 전환을 이유로 Gantt 인스턴스나 스크롤·트리 상태를 초기화하지 않는다. 긴 제목은 줄바꿈하되 공통 헤더의 닫기 버튼은 줄바꿈하지 않는다.

검색 후보는 native button으로 Enter/Space 선택을 지원한다. 후보가 열렸을 때 Escape는 후보만 닫고 검색 입력으로 focus를 되돌린다. 요청 중에는 닫기·선택 변경·중복 mutation을 UI와 handler 양쪽에서 막는다. 실패 시 편집 초안과 오류를 유지하고 자동 재전송하지 않는다.

저장하지 않은 관계 유형·Lag 또는 새 관계 초안이 있으면 닫기와 다른 관계 선택 전에 inline 확인을 제공한다. `계속 편집`은 입력을 유지하고, 명시적 폐기만 이동·종료한다. 삭제는 선행/후행 작업으로 대상을 알리는 확인 뒤 실행하며 취소는 DELETE를 보내지 않는다. 마지막 관계 삭제로 창이 닫히면서 남은 초안을 버리게 되면 삭제 확인에 이 영향도 명시한다. 확인 중에는 본문 편집을 잠그고, 취소 후에는 관련 입력/명령으로 focus를 돌린다. Readonly는 조회만 허용하며 기존 부모 mutation callback과 canonical/revision 계약을 변경하지 않는다.


## Issue #258 — 관계 편집과 연결 Task 편집의 경계

위 #34/#97의 FS-only와 linked-task 보호는 해당 구현 당시의 기록이다. 현재 Relation Editor는 FS/SS/FF/SF 및 signed 근무일 Lag를 지원하며, 연결된 일반 Task/Milestone의 이름/설명/URL/진척/Baseline 편집과 시작/기간/기존 API scheduleMode 변경도 허용한다. Summary는 name-only, 연결 Task의 삭제·변환·계층 변경은 기존 보호를 유지한다.

비일정 저장은 현재 적용 일정과 요청일을 보존한다. 일정 변경은 모든 leaf의 요청일에서 후보를 만들고 Relation API와 동일한 pure dependency 계산을 사용하여 후행 지연/앞당김 및 Summary를 저장한다. Task PATCH는 Link ID/type/lag를 바꾸지 않는다. 관계 변경 뒤 Task Editor도 같은 최신 canonical tasks/links/revision으로 요청일과 적용일을 읽으며 stale 초안은 기존 재조회 계약을 따른다. 자세한 저장·오류 계약은 [API](API.md), 계산은 [SCHEDULING Engine](SCHEDULING_ENGINE.md)을 따른다.


## Issue #377 Task Editor 관계 탭 관리 진입

Task Editor 관계 탭은 #203 Relation Editor와 #200 Link mutation의 추가 진입점이며 관계 도메인이나 별도 cache를 복제하지 않는다.

- 기존 관계 **편집**은 canonical linkId로 Relation Editor를 열고, **삭제**는 predecessor→successor/type/lag를 식별하는 확인 뒤 기존 DELETE를 사용한다.
- **관계 추가**는 `anchorTaskId`로 Relation Editor를 열 수 있다. 선택된 Link가 없어도 현재 Task/Milestone externalId를 Anchor로 후보 검색과 predecessor/successor 생성 흐름을 제공한다.
- Anchor mode에서 마지막 관계를 삭제해도 원래 Task Anchor가 유효하면 Dialog를 유지해 계속 관계를 추가할 수 있다.
- Task Editor dirty/stale/readonly/pending 및 Summary는 relation mutation을 fail-closed한다.
- Link mutation 성공 응답의 canonical `tasks + links + project.revision`은 Workspace와 열린 Task Editor local canonical session에 함께 반영한다. 부모의 `editorSession` 객체를 교체해 Task Editor native dialog를 재등록하지 않는다.
- Relation Editor의 dirty/confirm/pending/Escape/focus contract는 #266을 유지한다. Task Editor 직접 삭제 confirmation도 trigger→confirmation→trigger focus 흐름을 보장한다.

Summary endpoint, graph validation, FS/SS/FF/SF 계산, Lag/Lead, Link API/DB schema는 변경하지 않는다.

## Issue #335 Dependency와 WBS sibling order의 분리

Dependency Link의 의미와 WBS sibling order는 별도 계약이다. 같은 parent에서 Task/subtree의 위치만 바꾸는 `move up/down` 또는 `before/after`는 Link ID, predecessor/successor, type, signed lag/lead를 변경하지 않으며 Dependency 일정 재계산 입력을 새로 만들지 않는다. requested/effective schedule 및 Task status/progress도 reorder 자체로 변경하지 않는다.

서버는 command가 실제 parent 변경인지 먼저 판정한다. same-parent reorder만 Link guard 예외이며 cross-parent/child, Indent/Outdent, Cut/Paste, Delete, Convert와 Link 자체 mutation은 기존 검증을 유지한다. canonical 응답의 동일 Link를 기준으로 relation line이 이동한 row endpoint를 따라야 한다.
