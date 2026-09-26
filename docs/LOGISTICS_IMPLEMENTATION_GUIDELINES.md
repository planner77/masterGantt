# 물류 기능 구현 지침

## 적용 범위와 우선순위

[Epic #183](https://github.com/planner77/masterGantt/issues/183)의 LG-01~LG-06 구현에 적용하는 보조 지침이다. [AGENTS](../AGENTS.md), [ISSUE_LIFECYCLE](ISSUE_LIFECYCLE.md), [REMOTE_VALIDATION](REMOTE_VALIDATION.md)의 권한·검증·릴리스 gate를 완화하지 않는다.

업무 모델은 [LOGISTICS_DOMAIN_DESIGN](LOGISTICS_DOMAIN_DESIGN.md), 계산은 [LOGISTICS_DASHBOARD](LOGISTICS_DASHBOARD.md), 의존성과 현재 작업 위치는 [LOGISTICS_ROLLOUT](exec-plans/active/LOGISTICS_ROLLOUT.md)를 읽는다. 이 문서의 존재는 모델/코드/migration/API가 이미 구현되었다는 증거가 아니다.

## 1. 착수 Work Packet

Manager는 현재 Issue 본문/댓글, 최신 main SHA/version, 관련 open PR, 실제 DB migration ledger와 구현 상태를 읽는다. 과거 계획의 완료 문구를 현재 완료 증거로 재사용하지 않는다. 다음을 Issue의 PLAN에 남긴다.

```text
issue / parent_epic / dependencies
approved_scope / non_scope / AC
baseline_main_sha / work_branch / head
primary_agent / collaborators / file_ownership
api_contract / migration_scope / calculation_scope
version_decision / release_required / release_authorized
required_docs / documentation_writer
local_checks / remote_checks / environment_checks
issue_comment_writer / allowed_types
known_risks / next_handoff
```

이번 설계 등록은 제품 구현 착수/병합/정식 게시 승인이 아니다. 구현 이슈별 release_required를 Manager가 판단하고 release_authorized는 명시 승인 전 false다. 문서-only PR은 application version 유지, 정식 release N/A다. 필요한 main 임시 artifact 검증은 기존 Lifecycle대로 별도 판정한다.

## 2. 역할별 책임

| 역할 | 책임 |
| --- | --- |
| Manager | 사용자 요구와 설계 기본안 구분, 선행/범위/버전/승인 결정, 공통 계약과 중복 구현 조정, Issue PLAN/최종 기록 |
| researcher | 공식 SVAR/SQLite·설치 버전·Core/PRO 차이 조사. 문서 조회/실제 실행을 구분 |
| ui_ux | 공정/설비/시스템 정보 구조, 역할과 투입의 분리, 필터·직접/파생·상태·접근성 설계. read-only |
| backend | migration/DTO/Service/Repository/API, Project 격리, Resource 참조/사용 영향, atomic copy, 집계 read model과 테스트 |
| frontend | 관리/편집/대시보드 UI, canonical 동기화, Gantt 상태, filter/drill-down, E2E와 지정 문서 |
| scheduler | 기존 일정·calendar·summary 재계산 계약 검토, 물류 연결 비간섭, 공수 모듈 재사용 및 집합 계산 검토 |
| excel_vba | 기존 #30 producer/consumer 계약과 물류 보고/향후 import의 경계 검토. 요청 없이 schemaVersion/원본 DRM 처리 변경 금지 |
| infra | 지정 branch/PR/CI/승인된 후속 작업, migration/container persistence 증거, 안전한 cleanup |
| qa_docs | 작성자와 독립된 요구·코드·테스트·문서 검토와 gate 판정. read-only |

역할명을 Issue에 적었다고 해당 Agent가 실제 실행되거나 GitHub assignee로 등록된 것은 아니다. 독립 Agent 도구가 없으면 단일 에이전트 순차 처리로 기록하고 독립 QA를 대체한 것으로 표시하지 않는다. 같은 파일에 여러 Writer를 동시에 배정하지 않는다.

## 3. 구현 중 지켜야 할 불변식

1. 공정 트리, WBS, 물리 Equipment, 논리 System, global Resource를 혼합하지 않는다. 마스터 이름으로 FK를 만들지 않는다.
2. Equipment/System 역할은 기존 Resource ID 참조다. 역할 등록을 권한 부여·task_assignments·공수100%로 확장하지 않는다. Group 구성원을 자동 배정하지 않는다.
3. 모든 Project-local FK는 project_id를 포함한다. 다른 Project ID를 API 필터만으로 막았다고 DB 검증을 생략하지 않는다.
4. 직접 Task 연결과 Summary subtree 파생은 별개다. default=self, subtree opt-in, 직접+상속 dedup/provenance를 유지한다. 파생 row를 자식 DB에 복제하지 않는다.
5. controller/coordinates 관계를 Task 선후행 링크로 바꾸지 않는다. 물류 메타데이터 때문에 기존 일정·진척·공수 계산을 변경하지 않는다.
6. Project edit session/Origin/If-Match 및 관련 catalogRevision을 한 transaction에서 검증한다. 실패 후 일부 저장 성공을 보고하지 않는다.
7. 실제 서버 canonical 응답은 새 물류 aggregate를 일관되게 포함한다. 다른 mutation, tab 전환, copy/import에서 필드가 조용히 지워지지 않게 한다.
8. 초기 master 제거는 비활성화다. 기존 inactive 참조는 보존/표시하고 새 참조는 거부한다. 사용 중 hard delete와 global Resource 삭제 영향도 검증한다.
9. Task·assignment ID를 집계의 dedup key로 사용한다. 겹치는 공정/설비/시스템 소계를 합해 전체 KPI를 만들지 않는다.
10. 실적일/기준선이 없는 실제 납기준수율·S-curve·실적 공수를 만들지 않는다. NULL 투입률과 분모0의 의미를 보존한다.

## 4. 변경 경계·호환성

LG-01에서 copy guard를 먼저 둔다. LG-06에서 모든 local ID remap/role/association 복사가 검증되기 전 guard를 제거하지 않는다. 기존 물류 없는 프로젝트는 정상 작동해야 한다. 새 UI는 대응 기능이 준비된 단계에서 노출한다.

기존 JSON/CSV 및 #30의 제안2.0에 새 field를 몰래 삽입/무시하지 않는다. 보고용 Excel과 import 가능한 계약을 구분한다. DRM 우회, 실제 운영 인력 명단/장비 주소/secret의 GitHub·로그·fixture 기록은 금지한다.

공식 SVAR sample의 아이디어는 활용하되 온라인 문서를 설치 버전 API라고 단정하지 않는다. 기존 app Task Editor와 Core adapter를 우선한다. PRO/internal DOM/private store 의존 변경, 라이브러리 업그레이드, 신규 UI framework는 별도 범위 결정 없이는 수행하지 않는다.

## 5. DOCUMENTATION_SYNC

계획 문서의 예정형 표현은 실제 구현된 범위만 변경한다. 변경별 최소 검토 대상:

| 변경 | 필수 동기화 대상 |
| --- | --- |
| 도메인/migration/삭제/FK | LOGISTICS_DOMAIN_DESIGN, DB_SCHEMA, REQUIREMENTS, TEST_PLAN |
| DTO/API/auth/revision | API, SECURITY, ARCHITECTURE, 관련 물류 문서 |
| 관리/Task 연결 화면 | PROJECT_UX, TASK_EDITOR, TEST_PLAN; 필요 시 DESIGN/UI_UX_GUIDELINES |
| 범위/진척/공수/대시보드 | LOGISTICS_DASHBOARD, API, TEST_PLAN; 엔진 변경 시 SCHEDULING_ENGINE |
| 복사/Excel/Import | ISSUE_27_PROJECT_COPY, EXCEL_EXPORT, IMPORT_EXPORT, IMPORT_SCHEMA, README |
| 모든 구현 | LOGISTICS_ROLLOUT의 증거/상태, CHANGELOG와 version 정책 검토 |

변경하지 않는 문서는 N/A 근거를 남긴다. 계획만 기록된 새 테이블/API를 DB_SCHEMA/API의 '현재 구현' 목록에 미리 추가하지 않는다. 원래 requirements와 충돌하면 임의 한쪽을 선택하지 말고 Manager가 결정 근거와 AC를 함께 갱신한다.

## 6. 검증·보고 Gate

Local Fast Feedback은 직접 영향 Unit/SQLite/타입 검증 위주이며 같은 PR head의 원격 quality/e2e/docker를 대신하지 않는다. 필수 회귀에는 cross-project FK, role primary 중복, Resource inactive/사용 중 삭제, stale revision/rollback, Task self/subtree/이동/타입변환, 중복 집계, copy/remap/delete, canonical 응답 보존, readonly 및 Gantt mount/state가 포함된다.

합성 fixture의 기대값은 Project50%, E1 66.666…%, 지연 Task1, 지연 Milestone1, 계획4MD/미설정1이다. 실제 제품의 calendar/assignment/query 함수를 통해 재현하고 문서 예제 수식만 계산한 것을 integration PASS로 표시하지 않는다.

최신 head가 바뀌면 기존 head의 원격 gate/QA 결과는 stale다. 독립 QA, 실제 Windows Excel/DRM, 운영 proxy, backup-restore 결과가 없으면 각각 BLOCKED 또는 NOT TESTED로 남긴다. UI는 실제 Chromium keyboard/focus/반응형/상태 보존 증거가 필요하다.

Issue 기록은 PLAN/STATUS/EXCEPTION/DECISION_REQUIRED/RESUME/FINAL의 기존 정책을 따른다. PR은 Refs로 연결하며 docs PR 병합으로 Epic이나 구현 이슈를 자동 종료하지 않는다. 기능 전체와 승인 범위의 Lifecycle이 끝난 뒤에만 종료 판단을 한다.
