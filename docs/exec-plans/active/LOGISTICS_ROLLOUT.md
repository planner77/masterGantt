# 물류 구축 관리 기능 실행 계획

## 1. 상태와 범위

2026-09-26 설계/이슈 등록 기록. 상위 [Epic #183](https://github.com/planner77/masterGantt/issues/183).

- baseline main: `9f313eb30328486f3e6a2cfa31935542bc2067d2`, application `0.33.0`.
- 설계 branch: `docs/issue-183-logistics-domain-design`.
- 이번 산출물: 도메인 설계, 대시보드 계산 계약, 구현 지침, 이 실행 계획과 구현 이슈6건.
- 이번 단계는 문서-only이며 source/migration/application version/의존성/기존 workflow는 변경하지 않는다.
- 설계 PR 제출 이후 검토/CI 상태는 PR과 Epic의 최신 기록을 확인한다. 이 문서에 PR 또는 CI가 언급된 것만으로 성공을 추정하지 않는다.
- 실행 방식: 단일 에이전트 순차 처리. 독립 Sub-Agent/qa_docs 실행 증거 없음.
- release_required=false(이번 문서-only), release_authorized=false. main 병합/정식 GHCR/운영 배포는 이번 범위 밖이다.

기준 문서: [도메인](../../LOGISTICS_DOMAIN_DESIGN.md), [대시보드](../../LOGISTICS_DASHBOARD.md), [구현 지침](../../LOGISTICS_IMPLEMENTATION_GUIDELINES.md), [Lifecycle](../../ISSUE_LIFECYCLE.md), [AGENTS](../../../AGENTS.md).

## 2. 구현 Work Package

| ID / Issue | 구현 범위 | 선행 | 주 담당 | 등록 시 상태 |
| --- | --- | --- | --- | --- |
| LG-01 [#184](https://github.com/planner77/masterGantt/issues/184) | 공정·설비·시스템·제어/조율 SQLite/API, canonical 연계, 복사 guard | 설계 PR 검토·병합 | backend | OPEN / NOT TESTED |
| LG-02 [#185](https://github.com/planner77/masterGantt/issues/185) | 기존 Resource 역할 배정, primary/비활성/사용 영향/권한 | LG-01 | backend | OPEN / NOT TESTED |
| LG-03 [#186](https://github.com/planner77/masterGantt/issues/186) | 물류 구성·공정 탐색·설비/시스템·담당자 UI | LG-01, LG-02 | frontend | OPEN / NOT TESTED |
| LG-04 [#187](https://github.com/planner77/masterGantt/issues/187) | 3종 Task M:N 연결, self/subtree, 출처·필터·편집 | LG-01, LG-02 | backend, frontend 협업 | OPEN / NOT TESTED |
| LG-05 [#188](https://github.com/planner77/masterGantt/issues/188) | 중복 없는 KPI/공수·데이터 품질·MCS 범위·drill-down | LG-04, UI 통합은 LG-03 | backend, frontend 협업 | OPEN / NOT TESTED |
| LG-06 [#189](https://github.com/planner77/masterGantt/issues/189) | 완전 복사/삭제/보고용 Excel/Import 경계/통합 회귀 | LG-01~LG-05 | backend, frontend 협업 | OPEN / NOT TESTED |

기본 순서는 LG-01 → LG-02 → LG-03 → LG-04 → LG-05 → LG-06이다. LG-03/LG-04를 병렬 진행하려면 Manager가 ProjectWorkspace/TaskEditor/DTO 등의 파일 소유권을 분리하고 각 branch의 기준을 명시한다. 기본은 최신 main 기준 독립 PR이며 동일 변경을 여러 stacked PR에 중복 포함하지 않는다. schema/API/공통 read model을 먼저 병합한 뒤 소비 UI를 진행한다.

실제 GitHub 사용자 assignee를 임의 배정하지 않았다. 위 주 담당은 Agent 역할 배정안이다. 각 이슈의 AC·문서 목록·보안·버전 검토·검증 기준이 실행 Packet의 출발점이며 착수 시 최신 상태로 다시 확인한다.

## 3. 기존 이슈와 중복 방지

- [#19](https://github.com/planner77/masterGantt/issues/19): global Resource/Group와 task_assignments를 재사용한다.
- [#56](https://github.com/planner77/masterGantt/issues/56), [#57](https://github.com/planner77/masterGantt/issues/57): 계획 공수와 작업 달력의 계산 권위를 유지한다.
- [#30](https://github.com/planner77/masterGantt/issues/30): VBA→JSON 가져오기 제안 계약을 독자 변경하지 않는다. 물류 bulk import는 별도 후속 승인 범위다.
- [#138](https://github.com/planner77/masterGantt/issues/138), [#177](https://github.com/planner77/masterGantt/issues/177): Project lifecycle 상태/상태 변경 UX는 새 설비 진척이나 관제 상태로 대체하지 않는다.
- 기존 fullscreen/알림/탭/이름 인라인 편집의 최신 구현과 회귀를 확인한다. 과거 계획의 CI 성공을 이번 변경에 재사용하지 않는다.

## 4. 단계별 배포 안전장치

LG-01부터 기존 마스터 데이터가 없는 Project는 그대로 사용할 수 있어야 한다. 물류 데이터가 있는 Project의 복사만 명시적인 미지원 오류로 막고 LG-06 완성 뒤 해제한다. 단계 중간에 데이터 일부를 누락한 복사 성공을 만들지 않는다.

role 배정은 Task allocation/권한을 자동 바꾸지 않는다. Task 물류 연결은 기존 schedule/FS를 바꾸지 않는다. 관리 화면의 비활성 제외 정책을 Project 전체 진척 집계에 그대로 적용하지 않는다. 새 tab은 Gantt panel을 remount하지 않는다.

별도 feature flag를 추가할 경우 초기값·회수 시점·테스트를 이슈에 정의하고 단순한 TODO 상태를 제품 완료로 노출하지 않는다. schema/API version과 UI flag를 혼동하지 않는다.

## 5. 설계 단계 검증 기록

### 실제 수행한 확인

GitHub connector로 기준 main의 AGENTS/DB_SCHEMA/Issue Lifecycle/Project·Resource DTO/계획 공수 문서와 관련 이슈를 읽었다. 지정 SVAR demo URL, Editor·columns 공식 문서와 관련 sample 링크, SQLite foreign key/partial index 공식 문서를 조회했다. SPA를 실제 브라우저로 조작하거나 설치 패키지 runtime을 실행하지는 않았다.

별도의 Python stdlib/sqlite3 합성 검산을 수행했다. 사용 SQLite는 **3.46.1**이며 프로젝트의 better-sqlite3 runtime이 아니다. 아래 총19개 assertion이 통과했다.

| 검산 영역 | assertion 수 | 관측 결과 |
| --- | ---: | --- |
| FK/primary/삭제 | 9 | cross-project FK 거부; primary 중복 및 contributor primary 거부; 사용 중 Resource/설비 삭제 거부; Task 연결만 cascade; Project local cascade; 다른 Project/global Resource 유지; foreign_key_check 빈 결과 |
| 근무일 fixture | 3 | 공휴일 rule 없는 주말-only 달력에서 T1/T2/T3 duration=4/2/2 |
| KPI·집합·공수 | 7 | 전체50%, E1 정확히200/3%, 분모0→None, 일반 지연T1 1개, 과거 미완료 Milestone1개,4MD/미설정1, 겹치는 소계 비가산성 확인 |

SQLite 실험은 Project-local FK에 deferred NO ACTION, 각 local row의 Project cascade, Task association cascade, global Resource RESTRICT, primary partial UNIQUE를 사용했다. API/auth/프로젝트 migration 파일을 실행한 결과가 아니라 설계 패턴의 제한된 검산이다. KPI 검산 또한 실제 app 계산기/대시보드 통합 테스트가 아니다.

### 판정 구분

| 항목 | 현재 판정 |
| --- | --- |
| 소스·공식 문서 조사 | 수행함; runtime 검증과 별도 |
| 합성 수식/SQLite 관계 패턴 검산 | PASS,19 assertions |
| 제품 기능 구현·migration·API | NOT TESTED / 미구현 |
| 실제 SVAR/브라우저 UX·성능 | NOT TESTED |
| 독립 qa_docs/Manager 승인 gate | 독립 QA 미실행, 병합 판단 보류 |
| PR quality/e2e/docker | 최신 PR run에서 별도 확인. 검산을 대체 증거로 사용하지 않음 |
| main GHCR/정식 Release/운영 배포 | 이번 요청의 수행 범위 밖 |

## 6. 완료·인수인계 기준

설계 PR은 문서와 Issue 등록의 산출물이다. 구현 Epic의 완료 PR이 아니므로 자동 close 키워드를 사용하지 않는다. 하위 이슈는 각 AC, DOCUMENTATION_SYNC, 같은 head의 quality/e2e/docker, 독립 검토, 승인된 범위의 후속 gate를 충족한 후 종료한다.

Epic은 전체 구축 시나리오(공정3, 설비3관리단위, 공유 ACS/SCS/MCS, 겸임 Resource, 3종 Task, 복사/삭제/보고, 중복 없는 집계)의 통합 증거가 모인 뒤에만 종료한다. 실적 이력/VBA 물류 bulk import 등 비범위를 구현 누락으로 오해하지 않도록 별도 제한을 안내한다.

다음 실제 구현 진입점은 LG-01 #184다. 그 전에 설계 PR의 검토와 문서 링크/원격 검증 상태를 확인하고 사용자 요구와 다른 cardinality 정책이 발견되면 DECISION_REQUIRED로 남긴다.
