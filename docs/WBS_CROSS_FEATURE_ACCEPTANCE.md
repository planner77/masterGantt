# WBS 중심 다관점 통합 수용·이관

Issue [#737](https://github.com/planner77/masterGantt/issues/737), Epic [#723](https://github.com/planner77/masterGantt/issues/723)의 교차 기능 수용표다. 기준 main은 `56c7cfb96dbb97095e51606e9639cf4dc3fced36`, application `0.130.0`이다. 기능별 테스트를 대체하지 않으며 등록/문서/선행 Issue 종료를 제품 최종 수용으로 취급하지 않는다. 실제 명령·결과·실행 source는 [Work Packet](exec-plans/active/ISSUE_737.md)에 기록한다.

## 적용 결정과 oracle

[#723 W1/W2 최종 결정](https://github.com/planner77/masterGantt/issues/723#issuecomment-6245422717)이 #737 최초 댓글의 NOT FINAL보다 우선한다. 설비는 같은 Project의 서로 다른 공정 WorkArea0..N에 연결할 수 있다. Task의 명시 공정0..N을 설비/System/Target/조상에서 자동 채우지 않는다. legacy null과 명시 empty를 구별한다. #762 이후 신규 구역은 Project 공정 직접 소유이며 legacy occurrence/WorkArea의 UUID·alias는 보존한다.

동일 source/version·snapshot·기간·기준일·Calendar·selector·개인 범위에서만 raw ID와 수치를 대조한다. KPI와 5개 WBS root(Milestone/공정/설비/System/Resource)가 여섯 관점이다. 구성 설비15대/System3식, 일반 Task 수·진척, 개인 Assignment M/D는 서로 다른 모집단이다.

System 화면의 기본 `systemView=direct`는 시스템 미연결 Task를 제외한다. 이 화면은 raw Task-System 연결과 같은 시스템 KPI breakdown을 비교하며, 다른 root의 전체 작업/KPI 전체와 무조건 같은 값이라고 기대하지 않는다. 시스템 미연결/개인 미배정 작업은 전체 작업 모집단에서 별도로 보존한다. 실제 UI fixture→KPI/5root→화면 수치/정확 ID→다운로드 OOXML은 같은 실행 안에서 대조하며, 별도 Domain golden과 UUID/snapshot이 같다고 주장하지 않는다.

- AMR10+5=15, ACS2+공유MCS1=3. 등록-only 설비7/System1을 더한 fixture의 전체 구성은22/4이므로15/3과 같은 전체값으로 비교하지 않는다.
- 한5근무일100% Assignment는5M/D, 다른 사람50% 추가 시7.5M/D다. 다중 구역·Milestone·Group 경로의 반복은 합산하지 않는다. 개인 필터에서는 해당 개인 Assignment만 포함한다.
- W2 MCS 공통T0=2, A전용T1=3, B전용T2=4, AB통합T3=5 → 전체14/A8/B9/미연결2. 중첩 소계 합19는 전체14의 대체값이 아니다.
- selected80%와 같은 R의 Project140%·Capacity, 일반 Task와 개인 배정·등록 인원, 전체 Milestone Gate와 선택 Task 기여를 분리한다. 계획값을 물리 설치실적·실제공수·원가·가동률로 해석하지 않는다.

## AC와 WBS 추가 수용표

아래 파일은 검증 계약 매핑이다. 테스트 존재는 PASS 증거가 아니며 새 PR의 전체 회귀·Trusted QA·Owner 수용은 별도다. 신규 테스트는 `tests/server/resources/issue-737-cross-feature-acceptance.test.ts`, `tests/server/projects/issue-737-preservation.test.ts`, `tests/e2e/issue-737-target0-acceptance.spec.ts`다.

| AC / 추가 기준 | 교차 검증과 기존 보존 테스트 | 실제 범위·제한 |
| --- | --- | --- |
| AC1 / WBS-03 | 신규 Chromium의 기준정보4탭→KPI+5root→동일 Task 편집→일정/출발 복귀; 신규 server raw ID/공수 비교 | API로 만든 실제 격리 DB fixture 사용. 모든 등록 폼 조작은 기존 #725/#726/#727/#762 E2E가 담당 |
| AC2 / WBS-01·07 | 신규 preservation의 direct/target/mixed 전체 table·UUID·migration ledger·5root snapshot backup/restore/2회 reopen; `tests/server/templates/logistics-template-graph.test.ts`, `tests/server/projects/project-copy-logistics.test.ts` | v5 직접 owner/legacy alias·다중WA remap/Copy·Template·null/empty·whole/subset은 기존 transfer 테스트와 결합. 신규 backup은 이미 이관된 DB이며 구 schema upgrade는 기존 migration 테스트 범위 |
| AC3 / WBS-02·04·05 | 신규 server dynamic spec·details/scope/개인 집합; 신규 Chromium 축 추가/삭제/순서/단독; `tests/server/resources/wbs-dashboard-views-http.test.ts`, `tests/domain/wbs-task-ledger-acceptance.test.ts` | typed 형제 동일 깊이, 설비→공정→System→Resource / 설비→Milestone→공정 및 Milestone/Resource root. 모든 순열 E2E 대신 pure/contract 조합과 고위험 실제 경로 사용 |
| AC4 / WBS-02·04·05·06 | 신규 server SQLite 원시 집합→5root report/details→KPI→Resource Excel; `tests/server/resources/issue-736-resource-adapter.test.ts`, `tests/domain/wbs-task-ledger.test.ts` | raw ID·5/7.5·15/3·M/M null·selected80/Project140·미배정·등록-only·stale·전체 Gate. UI fixture 수치와 별도 Domain golden을 같은 snapshot이라고 주장하지 않음 |
| AC5 | 신규 Chromium 왕복·5폭·keyboard·Gantt identity·조회 mutation0; 아래 기능 보존표의 기존 E2E | 모든 상태×5폭 전수 조합을 신규 중복 구현하지 않음. 오류/권한/초안/응답역전·native viewport의 기존 단언은 그대로 Full CI 실행 |
| AC6 | 본 문서·사용자 가이드·이관 절차·TEST_PLAN·CI/원격 문서·Work Packet | API/DB/산식/UI/보안 정책 변경 없음. #720 앱 매뉴얼은 미구현 후속, Excel은 보고서이며 전체 JSON backup 아님 |
| AC7 | source fingerprint·명령 결과·PR exact Head/base/test merge·Run/attempt를 Work Packet/Issue STATUS에 구분 | CI 시작까지만. Required3/Trusted/Owner/Manager 완료 및 Epic 종료는 NOT TESTED/BLOCKED |

## 기존 기능 보존표

| 기존 기능 | 현재 경로 | 보존 검증 파일 (`tests/e2e/` 기준) |
| --- | --- | --- |
| KPI 카드·진척/지연/임박·공수·품질/직접·조율·상세 | 대시보드 → KPI | `logistics-dashboard-request-state.spec.ts`, `project-logistics-management.spec.ts`; server `issue-731-kpi.test.ts` |
| Milestone 추가·Editor·소속·관계·전체 Gate | 대시보드 → Milestone | `issue-732-milestone-dashboard.spec.ts`, `milestone-stage-gates.spec.ts`, `milestone-stage-grid.spec.ts` |
| 공정·선택 WorkArea·다중 구역/미연결 | 대시보드 / 기준정보 → 공정&WorkArea | `issue-733-process-workarea-dashboard.spec.ts`, `issue-725-process-workareas.spec.ts`, `issue-762-process-workareas.spec.ts` |
| 설비/System·수량·책임/controls/coordinates | 대시보드 / 기준정보 → 설비 / 물류 시스템 | `issue-726-logistics-master.spec.ts`, `issue-726-task-logistics.spec.ts`, `issue-734-equipment-dashboard.spec.ts`, `issue-735-system-dashboard.spec.ts` |
| Resource 등록≠배정·Group/Role·Plan/Peak/과투입·견적/Excel | 기준정보 → 리소스 / 대시보드 → 리소스 → 기존 분석 | `project-resource-memberships-persistence.spec.ts`, `issue-736-resource-dashboard.spec.ts`, `resource-excel-export-dashboard.spec.ts`, `resource-excel-export-api.spec.ts` |
| Task CRUD/Dependency/Calendar·다중 Summary scope·전체 복귀 | 일정, Summary 범위 탭 및 전체 일정 복귀 명령 | `project-task-editor.spec.ts`, `project-grid-reorder-persistence.spec.ts`, `project-work-calendar-preview.spec.ts`, `project-workspace-tabs-518.spec.ts`, `canonical-projection.spec.ts`, `gantt-state-recovery-editor.spec.ts` |
| Day/Week·Fullscreen·canonical/Core/native/viewport·marker OFF | 같은 단일 Gantt / 일정 복귀 | `milestone-timeline-lane.spec.ts`, `issue-736-resource-dashboard.spec.ts`, `project-workspace-ux.spec.ts` 및 `tests/config/gantt-state-conformance.json`의 spec/case 매핑 |

일정의 중복 `전체 프로젝트` 하위 탭 제거는 전체 일정 삭제가 아니다. 신규 통합 테스트의 instance/DOM 불변은 viewport 전체 SC 수용의 대체 증거가 아니다. 기능별 readonly·만료/401·dirty/pending·412/stale/error·응답역전·필터 탈락/삭제는 기존 spec의 정확한 검증 범위와 Full CI 결과로 판정한다.

## 교환과 복구

Project Copy와 지원 Template v5는 로컬 엔터티의 새 ID와 Global Resource/공유 catalog 원본 ID를 구분한다. 새 직접 구역 owner·다중 관계·Task 명시 null/empty·참여 원장을 silent loss 없이 보존하거나 전체 거부해야 한다. 지원하지 않는 plain JSON/일정 Excel을 전체 참조 backup으로 사용하지 않는다. #379 전체 참조 JSON은 본 이슈에서 구현하지 않는다.

동적 Excel은 현재 Resource-root만 지원한다. current/project·expected snapshot·raw ID·null·중첩 근거를 보존한다. 다른 root나 지원하지 않는 관계는 명시409로 거부하며 필터/spec을 생략한 재요청으로 성공을 만들지 않는다. Windows Excel/VBA/DRM 실제 열기는 NOT TESTED다.

합성 테스트는 disposable SQLite의 backup API→새 파일 열기→동일 table/ID/revision/ledger·외래키·report 확인→재시작을 수행한다. 운영/off-host/TLS·실제 storage의 복원은 NOT TESTED이며 [운영 절차](TARGET_RESOURCE_OPERATIONS.md)와 [배포 절차](DEPLOYMENT.md#8-backup-restore-rollback)를 따른다. UI 저장 view의 구 schema/잘못된 spec fallback은 기존 composer 검증 범위다. UI fallback과 DB rollback을 혼동하지 않는다. downmigration·원본 삭제·ledger 수동 편집·이전 binary의 새 DB 무검증 연결은 복구 절차가 아니다.

## 사용자 안내와 #720 인계

현재 제공 문서는 [기준정보·동적 조회 사용자 가이드](TARGET_RESOURCE_USER_GUIDE.md)다. 새 상위 메뉴와 업무 순서는 [실물 연결 종단 사용 흐름](TARGET_RESOURCE_USER_GUIDE.md#종단-사용-흐름)에서 설명한다. `screenKey`는 가이드의 기존 표와 anchor를 재사용한다. #720의 전역 매뉴얼 버튼·앱 `/manual` 페이지·registry를 새로 구현했다고 보고하지 않는다. 화면 제품·문서 계약의 최종 판정은 새 Head Required3와 Owner 승인 이후다.

## Issue #574 — Marker-OFF 교차 검증의 최신 source 연결 (2026-10-31)

main `8d6d3ba7a47e6df08c509baad6eedcc2adee1407` / application `0.138.4`에서 #507과 단일 PR로 V1~V8을 검증한다. 기존 #737의5root/KPI 수용표와 모집단·snapshot 계약은 그대로 유지한다. Gantt 상태·숨은 Milestone·교환 검증을5root 수치 전체 PASS 또는 운영 storage/Excel 환경 PASS로 확대하지 않는다.

| 교차 경계 | 원본 assertion과 검증 책임 |
| --- | --- |
| Task/metadata 저장·실패·unknown 결과와 단일 Gantt | #574 V1 / `gantt-state-product-integration`, `project-task-delete-context` / SC-05·기존 canonical 복구 |
| Resource·Export·Dashboard 복귀와 wheel/selection 경합 | V2/V3/V4/V7 / `resource-kpi-integration-ui`, `resource-excel-export-ui`, `viewport-coordinator`, `grid-task-start-reveal` / SC-09~12 |
| Marker OFF·변환·Dashboard/Editor·clipboard | V5/V6 / `task-context-menu-hierarchy`, `project-gantt-inline-name`, `inline-name-persistence`, `milestone-visibility` / same ID·권한·view-only mutation0 |
| M-only/empty·Summary·Export·Copy/Template·권한 | V8 / `milestone-timeline-interchange-http`, `milestone-timeline-interchange.test.ts` / full canonical UUID/FK·revision·실제 SQLite/HTTP |

상세 V1~V8 매핑은 [Gantt 정합 표](GANTT_STATE_CONFORMANCE.md), Milestone/교환 범위는 [추적표](MILESTONE_TIMELINE_TRACEABILITY.md), source별 실제 실행과 남은 검증은 [Work Packet](exec-plans/active/ISSUE_507.md)·[누적 원장](ISSUE_507_FAILURE_ANALYSIS.md)을 따른다. 이번 테스트 보강은 새 Coordinator/marker/Export 구현이나 UI/업무 정책 변경이 아니다. 최신 Head 원격 Required3/Trusted QA·Owner·Manager 최종 수용은 별도 NOT TESTED다.
