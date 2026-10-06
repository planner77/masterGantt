# Milestone Stage Gates

## 구현 경계

Issue #460은 기존 Milestone Task identity를 단계 Gate로 사용한다. WBS, 일정 Dependency와 단계 Membership은 각각 별도 관계이며 일정 엔진/SVAR Core를 교체하지 않는다. Editor/Gantt 단계 표현은 #461/#462, KPI는 #463, 교환·복사 완전 보존은 #464의 후속 범위다.

## 저장과 identity

`task_milestone_memberships(project_id, member_task_id, milestone_task_id)`에는 명시 소속만 저장한다. Project 안에서 Task/Summary 하나의 명시 소속은 0..1개다. member는 `task|summary`, target은 `milestone`이며 같은 Project의 기존 Task FK를 사용한다. DB composite FK, unique primary key, type trigger와 서버 검증을 함께 적용한다. 공용 API에는 내부 정수 PK 대신 immutable public `taskId` UUID를 사용한다. 이름/WBS/외부 ID는 Membership identity가 아니다.

Migration `0022_task_milestone_memberships.sql`은 빈 테이블을 추가한다. 기존 상태/진척/일정/Link/WBS/Assignment나 ID에서 소속을 추정하지 않고 원본을 보존한다. 다른 미병합 브랜치에 별도 0022 migration이 있으면 나중 통합하는 변경에서 최신 main ledger에 맞춰 번호를 조정해야 한다. loader의 연속 번호·checksum 검증은 유지한다.

## 상속과 canonical projection

일반 Task와 Summary는 자신 → 가장 가까운 Summary → 상위 Summary 순으로 최초 explicit 설정을 찾는다. Summary 지정은 subtree 기본값이고 더 가까운 설정은 override다. 지정 해제는 상속 복귀이며 상속 차단 sentinel은 지원하지 않는다. Milestone은 소속/상속 대상에서 제외한다. 빈 Summary는 기본값을 저장할 수 있다.

모든 canonical full snapshot의 Task는 다음 projection을 포함한다. 오래된 fixture 호환을 위해 TypeScript 필드는 optional이지만 실제 서버 응답은 항상 정규화한다.

```ts
membership: {
  explicitMilestoneTaskId: string | null;
  effectiveMilestoneTaskId: string | null;
  inheritedFromTaskId: string | null; // 직접 지정/미지정이면 null
}
```

Milestone에는 `stageGate`를 포함한다. `memberTaskIds/memberCount/completedMemberCount/incompleteMemberTaskIds`, `memberProgressPercent`, 직접 선행 Milestone ID/미완료 ID, `membersCompleted/predecessorsCompleted/ready/blocked/manualEvent/completionInconsistent`를 제공한다. UI filter, viewRoot, 접힘, 날짜 범위를 계산 입력으로 사용하지 않는다. Task/Link/hierarchy/subtree/Project metadata mutation도 GET과 같은 projector를 사용한다. Assignment/Calendar/Logistics 전용 응답은 전체 Task snapshot이 아니며 기존 Workspace 재조회/병합 계약을 유지한다.

`src/domain/milestones/stage-gates.ts`는 순수 상속/Gate/잠금 함수다. 브라우저용 `project-stage-model.ts`의 `stageSnapshotFromProject`와 `previewMilestoneMemberships`는 전체 canonical DTO와 명시 변경 초안을 같은 함수로 해석한다. client preview는 권한·저장 근거가 아니며 서버가 transaction 안에서 다시 검증한다.

## Ready와 명시 완료

E(M)는 M에 유효 소속된 고유 일반 Task 집합이다. Summary/Milestone은 작업 수·가중치에서 제외한다. P(M)는 Link의 직접 predecessor 중 Milestone인 집합이다. Task-level Link에서 단계 Link를 추론하지 않는다.

- 작업 진척 = `sum(duration × progress) / sum(duration)`; 구성원이 없으면 null.
- `membersCompleted`는 구성원이 1개 이상이고 모두 canonical status=completed인 경우다. 반올림한 100%를 사용하지 않는다.
- `predecessorsCompleted`는 직접 선행 Milestone 모두가 completed인 경우다. Link 유형/Lag는 날짜 계산에만 적용하며 Gate 판정은 상태를 사용한다.
- 미완료 Milestone의 `ready`는 구성원 완료 및 선행 완료가 모두 충족된 경우다. 구성원 0개는 수동 이벤트이고 Ready/작업 진척은 null이다.
- 미완료 선행이 있으면 미완료 Milestone은 `blocked=true`다. 수동 이벤트도 선행 조건은 면제하지 않는다.

Ready는 자동 완료가 아니다. status 선택/progress=100/생성/타입 변환 등 새 Milestone 완료 전환은 같은 서버 guard를 사용한다. 구성원이 있는 단계는 작업·선행 모두 완료, 수동 이벤트는 선행 모두 완료를 요구한다. 기존 `completed ↔ progress=100` 동기화는 유지한다. Summary의 파생 progress=100은 Milestone 완료 command가 아니다.

기존 완료 단계의 Task/선행 재개는 허용한다. 다른 단계를 자동 재개하거나 원래 완료 기록을 고치지 않고 `completionInconsistent`로 진단한다. 이미 completed인 Milestone의 이름·진척100 재저장은 새로운 완료 전환이 아니다. 명시적 비완료 전환으로 단계를 재개한 뒤 구조를 수정한다.

## 원자 mutation

- `PATCH /api/projects/{publicId}/tasks/{taskId}`에 `explicitMilestoneTaskId`를 추가한다. omission은 현재 explicit 보존, null은 해제다. Task의 기존 허용 필드와 한 transaction/revision으로 저장한다. Summary는 `name`과 Membership만 허용하며 일정은 계속 파생/readonly다.
- `POST /api/projects/{publicId}/milestone-memberships`의 strict `{changes:[{taskId,milestoneTaskId}]}`는 1..500개 unique source를 원자 적용한다. 기존 bounded JSON byte 제한도 적용한다. 각 target은 UUID 또는 null이다. 후보 조회는 기존 전체 snapshot을 사용하며 별도 후보 endpoint는 없다.
- edit session, exact Origin, strong If-Match를 요구한다. 서버는 IMMEDIATE transaction에서 session/authVersion/expiry와 revision을 재검증한다. 성공은 canonical full snapshot+ETag와 revision +1, 실패는 행·revision 전체 rollback이다.
- Membership-only batch는 Task requested/effective schedule, mode/duration, WBS/sibling, Link ID/type/Lag, Assignment를 변경하지 않는다.
- batch의 `operation.kind=milestoneMembership`이며 `changedTaskExternalIds`는 explicit source 및 실제 소속/Gate projection이 달라진 Task/Milestone을 포함한다. 기존 다른 operation의 changed 목록은 동작 힌트이며 클라이언트는 응답의 전체 canonical tasks/links를 수락해야 한다.

## 완료 구조 잠금

서버는 transaction 안에서 이전/새 explicit row와 유효 일반 Task 집합을 각각 비교한다. 같은 effective 결과라도 explicit↔상속 변경, 빈 Summary 기본값 변경은 구조 변경이다. 완료 단계가 old/new 영향 target이면 `COMPLETED_MILESTONE_STRUCTURE_LOCKED`로 차단한다.

Task 생성/삭제, subtree 삭제, 첫-child Summary 전환, hierarchy create/convert/indent/outdent/reparent/Copy 모두 같은 검사를 거친다. Cut은 기존 identity의 reparent이므로 같은 잠금이 적용된다. same-parent reorder·이름/설명·일반 작업 일정/진척은 소속을 바꾸지 않는 한 허용한다. override 때문에 실제 소속이 유지되는 이동과 Milestone child 생성도 blanket-lock하지 않는다.

완료 Milestone endpoint의 Link 추가/유형·Lag 변경/삭제는 재개를 요구한다. Link 구조 잠금은 날짜 재계산보다 먼저 검사하여 재개 사유를 보존한다. 기존 no-op type/Lag 응답은 revision을 올리지 않는다. 미완료라도 참조받는 Milestone 삭제/일반 Task 전환은 `MILESTONE_REFERENCED`이며 FK cascade로 다른 작업의 소속을 조용히 없애지 않는다. Project 전체 삭제는 기존 명시 확인·권한 계약으로 모든 Project-scoped row를 함께 삭제한다.

## Dependency와 legacy

신규 일반 Link 생성은 Task→Task 또는 Milestone→Milestone만 허용한다. mixed는 `MIXED_DEPENDENCY_ENDPOINT`, Summary는 기존 `SUMMARY_DEPENDENCY_ENDPOINT`로 거부한다. 자기/중복/순환/프로젝트 경계·FS/SS/FF/SF·signed Lag·Auto/Manual/근무일 계약은 유지한다.

기존 mixed Link는 migration/GET/일정 계산에서 보존하고 canonical `legacyMixed=true`로 구분한다. 기존 endpoint를 유지한 type/Lag 수정과 삭제는 허용한다(완료 endpoint 잠금은 적용). 서버 소유 Copy의 legacy Link 보존도 허용한다. client의 `legacy=true` 등 bypass 입력은 strict contract에서 거부한다. Membership 없는 기존 Project의 무관 필드 편집은 mixed Link 때문에 거부하지 않는다.

## 단계적 데이터 유실 방지 inventory

| 경로 | #460 동작 / 구현 위치 | 후속 |
| --- | --- | --- |
| canonical read/Task/Link/metadata/hierarchy/subtree 응답 | 공통 `milestone-stage-core.ts` projector | #461/#462 표시 |
| Task PATCH / batch 소속 | explicit 저장 + 상속·잠금·완료 guard | #461 atomic Editor 구현 |
| child/create/delete/convert/indent/outdent/reparent | 같은 transaction old/new 구조 검증, FK 안전 rollback | 유지 |
| 전체 Project Copy | 원본에 Membership이 있으면 `MILESTONE_MEMBERSHIP_PRESERVATION_UNAVAILABLE` 전체 거부; 없는 원본은 기존 복사 유지 | #464 FK remap |
| Template 저장 | Membership이 있으면 같은 no-loss 오류, 독립 snapshot의 기존 경로는 유지 | #464 snapshot 확장 |
| Template 생성/duplicate | 저장 시 Membership 보유 원본을 차단하므로 신규 metadata가 빠진 Template을 만들지 않음; 기존 Template은 원래 초기 진척0 계약 유지 | #464 |
| subtree/multi-root Copy | 복사 집합의 explicit/effective 또는 target 참조가 있으면 no-loss 전체 거부; 무관 Copy는 계속 허용, 완료 destination의 E(M) 변경은 구조 잠금 | #464 내부 remap/외부 경고 |
| Excel | Membership 보유 canonical snapshot은 선택 옵션과 관계없이 no-loss 오류; 기존 Membership 없는 workbook은 유지 | #464 단계 열/요약 |
| JSON Import preview/commit | 실제 서버 저장 구현은 부재. 과거 고정 성공 stub를 제거하고 501 `IMPORT_UNAVAILABLE`; preview는 Origin/session, commit은 Origin/session/If-Match를 검증. 모두 무변경 | #385/#464 구현 |
| JSON Export | 실제 export endpoint/serializer 부재; 구현 완료라고 주장하지 않음 | #379/#464 |
| JSON 1.0 pure validator/schema | 기존 strict shape 유지, Membership/effective/legacy client flag unknown field 거부; HTTP 저장 권한이 아님 | 새 version 계약 #464 |
| SVG/PNG | 현행 선택 Grid/Chart의 시각 출력; metadata backup/round-trip exporter가 아님. #460은 새 stage 열/label을 노출하지 않음 | #462/#464 표시 정합 |

보존 경로 미구현은 지원을 가장하지 않는 명시 거부다. 원본/새 Project/Template에 부분 row를 남기지 않으며 사용자는 대상에 단계 소속이 있는 동안 해당 출력·복사 경로를 사용할 수 없다. #464에서는 이 제한을 검증된 보존/명시적 경계 정책으로 대체한다.

## 검증

- `tests/domain/milestone-stage-gates.test.ts`: 상속/override/해제/빈 Summary/Milestone 제외/가중률·반올림/수동 이벤트/Ready·진단/명시 잠금/브라우저 preview/invalid hierarchy.
- `tests/domain/milestone-dependency-scheduling.test.ts`: 별도 scheduler가 작성한 M→M graph/관계 유형·signed Lag/Calendar/Manual 회귀.
- `tests/server/projects/milestone-stage-service.test.ts`: 실제 SQLite atomic composite/batch, schedule·WBS·Link·Assignment 불변, FK/Project 격리, 완료 전환·잠금·legacy·no-loss/restart/Project delete.
- `tests/server/projects/milestone-membership-http.test.ts`: 별도 테스트 Agent의 SQLite+HTTP handler 보호/401/403/428/412/rollback/Gate 검증.
- `tests/server/db/database.test.ts`: 신규 DB 및 schema21→0022 원본 Project/Task/status/progress/legacy Link/Resource/Assignment/ID/revision 보존, FK 검사.
- `tests/e2e/milestone-stage-gates.spec.ts`: 실제 Next HTTP mutation/canonical/완료 잠금/no-loss/401/SQLite 프로세스 재시작.

Local Fast Feedback와 PR quality/e2e/docker 공식 회귀를 분리한다. CI 실행 전/진행 중은 NOT TESTED이며 이 문서 존재나 로컬 PASS로 원격 성공을 주장하지 않는다. 실제 운영 reverse proxy/Windows Excel/VBA/DRM은 별도 환경이다.


## Issue #461 UI projection과 저장 경계

Editor는 `project-stage-model.ts`의 browser-safe full-project snapshot/preview를 재사용한다. 검색·Grid 필터·WBS 표시·날짜 범위를 Gate 입력으로 사용하지 않는다. Task/Summary picker의 null 초안에서도 preview effective/inheritedFrom 값을 같이 표시한다. Milestone 후보의 Summary 지정은 root 하나만 바꾸며 상속을 direct rows로 확장하지 않는다. batch impact는 고유 일반 Task의 effective 대상이 실제 달라진 수다.

완료 단계는 old/new target 잠금을 preview하고 서버가 transaction에서 다시 검증한다. manualEvent의 ready=null은 가짜 0%/100%가 아니며 predecessor 조건을 만족하면 명시 완료를 시도한다. 완료 기록 불일치는 진단이며 자동 재개가 없다. 본인 상태·memberProgress·미완료 member/predecessor를 분리하고 재개 성공 canonical을 받은 뒤 소속/관계 변경을 활성화한다.

Task/Summary 이름+소속 한 PATCH, Milestone 초안 한 batch POST와 같은 canonical revision 동기화를 `tests/domain/milestone-editor-model.test.ts`, `tests/e2e/milestone-stage-editor.spec.ts`, `project-task-editor.spec.ts`의 #461 fixture로 검증한다. DB/migration/Domain algorithm/Import·Copy·Grid 변경은 이 UI Issue의 범위 밖이다.

## Issue #462 조회 projection과 Scheduling Link UI

단계 필터와 Grid의 effective/출처는 browser-safe stageSnapshotFromProject/projectStageGates projection을 사용한다. scoped task 배열을 상속 계산의 authority로 사용하지 않으며 canonical hierarchy는 그대로 보존한다. Summary context는 effective 일반 Task 수에 합산하지 않고 Milestone 자신의 소속 셀은 비어 있다. 표시 목록의 날짜 정렬은 Dependency 생성·Ready 계산·일정 재계산·WBS 저장을 하지 않는다.

신규 Link UI는 같은 유형 후보와 native drag guard를 사용한다. 기존 mixed Link는 기존 일정/canonical 표시를 유지하며 Ready의 선행 단계 집계는 기존 공용 domain 규칙을 그대로 따른다. 완료 Milestone 양 endpoint 보호는 기존 #460 구조 정책의 UI 표현이고 domain/DB/API 변경은 없다.
