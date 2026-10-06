# Issue #460 완료 단계 도메인·DB/API 실행 계획

## 범위와 현재 단계

Epic [#459](https://github.com/planner77/masterGantt/issues/459)의 기반 [#460](https://github.com/planner77/masterGantt/issues/460)을 구현한다. 사용자 승인 범위는 #460 → #461 → #462 → #463 → #464의 순차 구현, 문서 동기화, push, PR CI 시작이다. CI 완료 모니터링, 병합, main 이미지 검증, 정식 릴리스, 브랜치 삭제와 Issue 종료는 범위 밖이다.

현재 단계는 `DOCUMENTATION_SYNC PASS`이며 최신 main 정렬 후 독립 사전 QA로 인계한다. 원격 `quality/e2e/docker`와 독립 사전 QA는 `NOT TESTED`다. 작업을 완료하거나 공식 회귀 검증을 통과했다는 의미가 아니다.

## Issue Work Packet

- 저장소: `planner77/masterGantt`.
- 기준 main / 작업 시작 head: `6ce221bc16613625953b85244bb93ad50019b377`, application `0.83.3`.
- 재개 시 최신 main: `9280536ddc85a8a841346bdf413b2ba638685880`, application `0.83.4`. PR #466 관리자 UI 변경을 정렬한 뒤 사전 QA와 PR 게시를 진행한다. migration은 여전히 0021까지이며 새 0022와 충돌하지 않는다.
- 작업 브랜치: `feat/issue-460-stage-gates`. 시작 시 기존 동일 이슈 branch/PR 없음.
- 목표와 인수 기준: Issue #460 본문 및 [Editor 복합 저장·잠금 영향·호환성 댓글](https://github.com/planner77/masterGantt/issues/460#issuecomment-5995315500)을 따른다.
- 버전 결정: 하위 호환 API/저장 기능 확장이므로 MINOR `0.85.0`. 별도 열린 PR #346의 `0.84.0`과 중복을 피한다. `release_required=true`, `release_authorized=false`; 정식 게시 승인 없음.
- 소유권: backend는 도메인/contracts/DB/repository/service/route/관련 테스트와 영향 기술 문서, infra는 branch/push/PR 및 package manifest·lock 버전, Manager는 범위·공유 interface·이 실행 계획·상위 PLAN·CHANGELOG·릴리스 설명을 소유한다.
- scheduler는 읽기 전용 계산 검토, qa_docs는 문서 동기화 뒤 독립 사전 검토를 담당한다. 후속 Editor/Gantt/Dashboard UI는 이 단계에서 구현하지 않는다.
- `issue_comment_writer=manager`; 구현/검토 Agent의 원격 댓글 쓰기는 허용하지 않는다.

## 구현 계약

명시 소속만 `task_milestone_memberships`에 저장한다. Task/Summary source와 Milestone target은 같은 Project의 canonical Task identity로 연결하고 source당 최대 하나를 허용한다. 일반 Task는 자신과 가장 가까운 Summary의 명시 설정을 따라 유효 소속을 계산하며 Milestone은 상속하지 않는다. 해제는 상속 복귀이며 상속 차단 sentinel은 추가하지 않는다.

공유 canonical projection은 Task의 `membership.explicitMilestoneTaskId`, `effectiveMilestoneTaskId`, `inheritedFromTaskId`와 Milestone의 `stageGate`를 제공한다. 파생 값은 저장 입력이 아니다. 기존 mixed Dependency는 `legacyMixed` 조회 정보로 구분하되 임의 삭제하거나 재계산에서 제외하지 않는다.

Task PATCH의 `explicitMilestoneTaskId` omission은 보존, null은 해제다. Summary의 이름·소속만 편집할 수 있고 파생 일정·진척은 기존 readonly 계약을 유지한다. 기본 필드와 소속은 하나의 transaction/revision에서 저장한다. `POST /api/projects/{publicId}/milestone-memberships`의 `changes: [{ taskId, milestoneTaskId }]`는 여러 명시 변경을 원자 적용한다.

Membership-only 변경은 일정/WBS/Dependency/assignment를 보존한다. 구성원이 있는 단계 완료는 일반 Task 상태와 직접 선행 Milestone 상태를 서버에서 검증한다. 구성원 0개는 수동 이벤트로 작업 진척/Ready가 N/A이며 선행 완료 조건은 유지한다. Ready를 자동 Completed로 바꾸지 않는다. status와 progress=100의 모든 완료 전환 경로를 검사한다.

완료 구조 잠금은 명시 소속 차이와 old/new 유효 소속 차이, Link 구조를 검사한다. 완료 단계가 있다는 이유만으로 이름 편집·같은 부모 reorder·일반 Task 진척 편집을 막지 않는다. CRUD/hierarchy/삭제/변환/Link의 기존 transaction 안에서 검사해 실패 시 row와 revision을 rollback한다.

신규 Link는 Task→Task 또는 Milestone→Milestone만 허용한다. 기존 mixed Link는 조회·일정과 무관 편집을 보존하며 endpoint가 같은 기존 관계의 type/lag 편집·삭제는 명시 호환 경로로 취급한다. 완료 endpoint 잠금은 별도로 적용한다.

## 데이터 유실 방지와 의존성

현재 main의 JSON Import HTTP route에는 고정 성공 응답이 있고 JSON Export 구현은 확인되지 않았다. #464의 완전한 직렬화 지원 전에는 보존 미지원 경로의 성공을 가장하지 않는다. Membership이 있는 Project의 Copy/Template/Excel은 명시적인 누락 방지 오류를 제공하고, Membership 없는 기존 Project는 기존 흐름을 유지한다. Import 미지원 응답은 Preview에서 기존 인증·Origin 계약을, Commit에서 인증·Origin·If-Match revision 계약을 유지한다. 실제 저장 없이 성공을 반환하지 않는다.

Migration loader는 연속 번호를 강제한다. 당시 #460에서 `0022_task_milestone_memberships.sql`을 선점했고 별도 PR #346의 Country Calendar migration과 번호 충돌 가능성을 기록했다. 후속 #459 Epic 통합으로 0022가 main에 확정되었으므로 #342 재정렬에서는 Country Calendar migration을 `0023_country_calendar_catalog.sql`로 이동하며 기존 적용 ledger를 재작성하지 않는다.

후속 branch는 선행 구현을 기반으로 구성한다. 이번 요청에서 main 병합을 하지 않으므로 PR에 의존 관계와 누적 변경 범위를 명시한다. 선행 PR의 CI 시작을 확인한 뒤 다음 이슈 구현으로 넘어간다.

## 검증과 문서 동기화

- pure unit: 직접/상속/중첩 override/해제/빈 Summary/Milestone 제외, Ready와 진척·반올림·선행 완료·수동 이벤트·완료 불일치.
- SQLite/API: project isolation/source-target type/unique/dangling, 인증·Origin·401/412, atomic batch/복합 PATCH, revision +1/rollback +0, Membership-only 일정 불변.
- 구조·관계: 간접 소속 변경 잠금, endpoint 잠금, unrelated reorder/name 허용, mixed legacy와 신규 제한, 기존 DAG/type/lag/Calendar/Manual 계산 회귀.
- migration: 신규 DB 및 기존 DB의 일정/status/progress/Link/assignment/ID 보존.
- required docs: MILESTONE_STAGE_GATES, REQUIREMENTS, ARCHITECTURE, DB_SCHEMA, API, SCHEDULING_ENGINE, TASK_RELATIONS, SECURITY, TEST_PLAN 및 영향 Import/Copy 계약. Manager는 CHANGELOG와 실행 계획을 동기화한다.
- UI 구현 없는 이 단계의 DESIGN/UI_UX_GUIDELINES/PROJECT_UX/TASK_EDITOR 영향은 backend 결과와 독립 QA에서 판정하고 N/A 또는 필요한 계약 변경을 기록한다.
- 로컬 빠른 검증과 원격 PR CI를 분리한다. `quality/e2e/docker` 결과는 모니터링하지 않으며 `NOT TESTED`로 유지한다.

## 로컬 실행 근거

backend의 마지막 변경 대상 43/43, Task candidate 16/16, DB 25/25, 독립 HTTP 테스트 Agent 35/35, scheduler 26/26이 PASS다. 실제 isolated Next HTTP·SQLite 프로세스 재시작 E2E 1/1이 PASS이며 관련 ESLint·최종 typecheck·Markdown 117개·diff 검사가 PASS다. 확대 관련 회귀에서 발견한 DB table/index 기대값 누락, Manual fixture 비근무일 요청, E2E Export 필수 요청 필드 누락은 수정 후 해당 대상을 재검증했다. 이 결과는 공식 전체 회귀 또는 최신 main 정렬 후 head의 원격 결과를 대체하지 않는다.

문서 동기화는 MILESTONE_STAGE_GATES 신규와 API/DB_SCHEMA/ARCHITECTURE/REQUIREMENTS/SCHEDULING_ENGINE/TASK_RELATIONS/SECURITY/TEST_PLAN/IMPORT_EXPORT/IMPORT_SCHEMA/EXCEL_EXPORT 갱신 및 Manager 계획·CHANGELOG 반영으로 완료했다. JSON 1.0 machine-readable schema는 기존 strict 계약을 유지한다. UI는 후속 범위이며 현재 Editor 계약 변경은 N/A, Docker/CI 변경도 N/A다. 설치 Next Route Handler·authentication guide를 확인했으며 next-env/tsconfig 생성 파일 drift는 없다.

다음 handoff: infra 최신 main 정렬 → 독립 사전 QA → Manager PR 준비 판단 → infra push/PR/CI 시작.
