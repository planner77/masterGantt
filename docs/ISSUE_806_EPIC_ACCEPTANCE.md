# Issue #806 — Resource Epic 종단 수용 원장

## 목적·현재 출처

[#806 Epic](https://github.com/planner77/masterGantt/issues/806)의 E1–E6을 이미 종료된 [#807 R1](https://github.com/planner77/masterGantt/issues/807), [#808 R2](https://github.com/planner77/masterGantt/issues/808), [#809 R3](https://github.com/planner77/masterGantt/issues/809) 및 [#800 Geometry](https://github.com/planner77/masterGantt/issues/800)에 연결하고, 종단 통합 시 빠질 수 있는 경계를 기록한다. 이 문서는 과거 source별 실행 결과·현재 GitHub source 감사·향후 PR CI를 **서로 다른 증거 단계**로 유지한다.

- 이번 기준: 2026-10-26 `main` `73901d7eb86a734e1017df04efa0ba26c5abbb45`, package `0.135.1`. 변경 영역은 기존 Resource E2E assertion과 문서만이며 앱 동작/API/DB/CSS·SVAR Core/CI/버전은 불변.
- 제품 출처: [ResourceWorkspace](../src/features/resources/resource-workspace.tsx), [ResourceChartsDashboard](../src/features/resources/resource-charts-dashboard.tsx), [ResourceWbsDashboard](../src/features/resources/resource-wbs-dashboard.tsx), [ProjectResourceDashboard](../src/features/resources/project-resource-dashboard.tsx), [Resource Plan](../src/features/resources/resource-plan-view.tsx). 다른 화면의 공통 CSS나 권한은 건드리지 않는다.
- 수용 기준의 원본: [#806](https://github.com/planner77/masterGantt/issues/806), [DESIGN](../DESIGN.md), [Project UX](PROJECT_UX.md), [UI UX Guide](UI_UX_GUIDELINES.md), [KPI/원장](RESOURCE_KPI_DASHBOARD.md), [Test Lifecycle](TEST_PLAN.md), [#800 관측 계약](ISSUE_800_UI_GEOMETRY.md).
- 역사적 로컬 실측: [#807 Work Packet](exec-plans/active/ISSUE_807.md)의 **앱0.133.3** before→after, [#809 Work Packet](exec-plans/active/ISSUE_809.md)의 **앱0.134.0** chart15/기본KEEP5. 두 환경 자료를 **현재 앱0.135.1 실측/PASS**로 합치지 않는다.

## E1 — 기본 기능·원본 인벤토리: KEEP/FIX/DELETE-MERGED

| 업무 흐름 | 최초 문제·before | #807–#809 after / 보존 소유 | 종단 확인 |
| --- | --- | --- | --- |
| 기본 현황·참여/미배정·Group/Role/등급·기간·M/D/M/M | WBS 동적 + `기존 분석`이 기본 펼침 적층, 서로 다른 필터/중복 제목 | R1 단일 `기본 현황` peer, 기존 Project Resource report/검색/보고서 KPI 유지 | [#807 E2E](../tests/e2e/issue-736-resource-dashboard.spec.ts), #807 geometry |
| Resource root/공정·WorkArea·설비/System·Milestone 경로 | 추가 동적 조회가 기본 현황과 별도 상시 영역 | `동적 계층 탐색` peer의 구성(spec)·원본 WBS snapshot/Task/Assignment 유지 | [#730 composer](../tests/e2e/issue-730-view-composer.spec.ts), [#736 Resource](../tests/e2e/issue-736-resource-dashboard.spec.ts) |
| Resource Plan·과투입·Peak/주월·개인 Project 전체 참고 | 기존 보고와 동적 보고의 조회 의미 차이 | `Resource Plan` peer 및 기존 내부 Plan·일별/외부 원인 상세 유지. 선택80%/같은 개인 Project140%는 다른 범위 | [#736 E2E](../tests/e2e/issue-736-resource-dashboard.spec.ts), [Plan](../tests/e2e/resource-plan-dashboard.spec.ts) |
| Milestone 계층·교차/Stage Gate | 기존 분석의 고유 의미를 단순 동적 조회로 대체할 위험 | `Milestone 교차` peer, 전체 Gate vs 선택 Task 진행 구별 | [#736 E2E](../tests/e2e/issue-736-resource-dashboard.spec.ts), [Milestone](../tests/e2e/resource-milestone-views.spec.ts) |
| 개발 견적·Excel | 기존 분석을 접거나 제거하면 소비자 접근성이 저하 | `견적·Excel` peer, 기존 Export writer/report scope·개발자 견적 재사용 | [Excel E2E](../tests/e2e/resource-excel-export-dashboard.spec.ts) 및 #807 |
| 계획/Capacity·업무 집중·Milestone/실물 기여 시각화 | 기존 화면에 별도 차트 없음 | R3 `차트` peer의 세 유형/동일 데이터 표, #808 source 분석 단일 read model; Gantt Core PRO 불요 | [#809 chart E2E](../tests/e2e/issue-736-resource-dashboard.spec.ts), [분석 Domain](../tests/domain/resource-analysis.test.ts) |
| 원본 Task/Assignment·일정 이동/복귀 | 다른 가상 행/선택 밖 Task/지연 응답으로 잘못된 편집 위험 | canonical IDs·source/snapshot/진행 중 action 보호, 정확 Gantt 복귀·focus/scroll | #809 차트 T0/Project Plan 외부 Task 및 [drill E2E](../tests/e2e/resource-drill-ui.spec.ts) |
| 중복 UI/고정 설명 | 원래 `<details open data-resource-compatibility>`의 설명과 두 영역 병치 | 중복 래퍼 제거(**DELETE-MERGED**); 기존 업무 기능·고유 분석 삭제 없음 | #807/기존 #736 DOM assertion |

서로 같은 이름의 리소스라도 항상 원본 ID로 비교한다. 개인 Resource, Group, Role, 개발등급은 서로 다른 분모/다중 소속이며 등록-only/Role-only 인원을 실제 개인 Assignment 수·Capacity에 더하지 않는다. 공정/WorkArea/실물 다중 연결은 **비가산 집계**다. 폐기된 Logistics Target을 사용자-facing axis로 재도입하지 않는다.

## E2/E5 — 동일 조건 Geometry·KPI KEEP·잔여 위험

### #807 역사적 실측(앱0.133.3; 높이900, DPR1, zoom100%, 동일 실제 HTTP/SQLite fixture)

| 뷰포트 폭 | 기존 분석 KPI 첫 Y before → after (px) | after 첫 화면 완전 가시 표 행 |
| --- | --- | --- |
| 390 | 2612 → 1017 | 0 |
| 768 | 1836.5 → 670 | 0 |
| 1024 | 1725.5 → 578 | 0 |
| 1440 | 1518 → 526 | 1 |
| 1920 | 1518 → 526 | 1 |

원본 #807 증거에서는 5폭 문서 수평 overflow0, control 44px, canonical revision17/Task4/Assignment1 및 업무 mutation0이 별도 확인됐다. **390px에서 첫 화면에 표가 나타났다고 주장하지 않는다**. `#809` 역사적 차트15(3유형×5폭), 기본 현황 KEEP5, 문서 overflow0·동일 source chart/KEEP 영수증은 #809의 **앱0.134.0** 실행 결과이다. #809 기본 현황 KPI/table Y before→KEEP: 390=1017/1458, 768=670/958.5, 1024=578/799.5, 1440·1920=526/747.5. 390에서 차트 표 완전 가시행은0이며 일부 1440/1920 차트도0이므로 첫 fold 데이터 가시성을 무조건 PASS로 올리지 않는다.

[#800 Geometry](ISSUE_800_UI_GEOMETRY.md)는 기존 #730 실제 브라우저 test 안의 6관점×5폭 **30 관측**을 별도로 정의한다. 동적 관점과 KPI의 첫 Y 절대값을 동일하게 맞추지 않으며 수치·행 수·overflow/소유 스크롤·sibling overlap·keyboard/focus/Escape 등을 검증한다. #800/#807/#809 소스·런타임·fixture hash가 다른 과거 자료를 동일 환경 before/after라 계산하지 않는다. 현재 0.135.1/Issue #806 PR Head에서의 새로운 실측은 **NOT TESTED** (원격 exact-Head CI 대기)이다.

실기기 touch, screen reader, native Windows 125% 확대, Windows Excel/DRM·사내 운영 proxy 환경은 기존 [#517](https://github.com/planner77/masterGantt/issues/517) 등 별도 실증 범위이며 현 시점 PASS나 대체 수용으로 선언하지 않는다.

## E3/E4 — 분석 출처·scope·상태 불변식

1. 같은 unfiltered Project를 바라보는 Resource-root 동적 원본과 첫 차트 보고의 `Task IDs/Assignment IDs`는 같은 canonical 집합이어야 한다. 차트의 기간/단위·분석 projection이 달라질 수 있으므로 서로 다른 요청의 `snapshotId`와 숫자 자체를 무조건 동일하다고 강제하지 않는다. **이 경계가 이번 #806의 직접 E2E 추가 assertion**이다.
2. chart의 데이터 표·막대 선택→정확 ID/필터·snapshot 재검증→원본 Task/Assignment/일정→복귀로 이어진다. #809 기존 실제 E2E에는 T0 개인 미배정(선택 밖 Task), Project 전체 부하 외부 Task, 선택80 vs Project140, 조회 race/401/412, 일정 복귀가 있다. 해당 test는 **KEEP_UNIQUE**.
3. Row-slice/Group·Role·공정·Milestone은 여러 경로에 나타나더라도 원본 Assignment는 한 번만 프로젝트 총계에 기여한다. #808 Golden shared5 M/D/공동담당7.5, 0 Capacity→null Load, partial/unset 및 실제 인력/실적 제외가 보고서 원본 계약이다. Chart 과투입은 개인별 초과를 Group 평균으로 가리지 않는다.
4. 기본·동적·차트·Plan의 검색/Group/Role/등급/기간은 동일 의미라고 증명된 경우만 공유한다. 명시적 보고서 기간 인계만 사용자 action이며 다른 조건/selection을 **무음 초기화·자동 동기화하지 않는다**. 개인 current 집합과 동일 개인의 Project 전체 참고를 같은 분모로 합산하지 않는다.
5. chart peer가 보이지 않는 기본 화면·동적·Plan에서는 새로운 차트 요청/높이·클릭 가능 영역을 만들지 않는다. 차트를 열고 다시 Plan으로 복귀할 때 원래 표 컴포넌트/선택·scroll/필터와 요청 중지 상태를 보존한다. E2E는 이 cross-peer 계약을 R1 기존 test 안에서 확장한다.
6. Excel current/project/snapshot 계약, Resource Plan 기간별 Capacity/peak/cell detail, Milestone full Gate 및 원본 editor 권한/If-Match/412는 기존 파일의 고유 Oracle을 재사용한다. 화면 전환을 이유로 DB·Calendar·API·Task·Assignment·Gantt native 인스턴스를 수정하지 않는다.

## E6 — AC 증거·QA 상태와 완료 게이트

| AC | 실제 달성 범위(소스/역사 증거) | 아직 필요한 정확 증거 |
| --- | --- | --- |
| E1 | 위 KEEP/FIX/DELETE-MERGED inventory + #807/#808/#809/#800 명시 출처 | 현행 main/PR Head 0.135.1의 실제 브라우저 before/after 재비교는 없다 |
| E2 | R1 단일 업무면·UI 관측, R3 기본 현황 KEEP 증거 | 현재 Head 5폭 변화 검증, 화면 변경 없음은 source audit |
| E3 | R2 read model·Plan·Server golden, R3 3개 차트/동등 표·실물/Milestone | 전체 기능의 최신 Head CI Required / 실기기 |
| E4 | R3 chart/Plan/정확 drill E2E, 이번 R1↔R3 고유 ID 통합 보강 | #806 새 assertion 원격 Chromium 실행/성공 |
| E5 | R1·R3 history 5폭/keyboard·#800 6관점 관측 계약 | 0.135.1/새 Head geometry·누락 상태·native125%/screen reader |
| E6 | [Work Packet](exec-plans/active/ISSUE_806.md), 이 Epic 문서, 기존 Resource KPI/Project UX/UI Guide/Test Plan 연계; Design Delta B/C | PR CI Required3+Chromium8/8·Trusted QA·Owner 위험 수용 및 명시 종료 결정 |

검증의 단위는 서로 다르다: **정적 구조 확인 ≠ 과거 로컬 실행 ≠ 최신 PR CI ≠ Trusted QA ≠ Owner 수용 ≠ 실제 운영 현장 검증**. 검증하지 않은 상태는 `NOT TESTED`이고 과거 실패·취소를 PASS로 재분류하지 않는다. 이전 #807/#808/#809 이슈 종료만으로 이 Epic의 E1–E6이 자동 완료되지 않는다.

## TEST_LIFECYCLE_REVIEW·Design Delta

- EXTEND: [기존 #807 한 Playwright 시나리오](../tests/e2e/issue-736-resource-dashboard.spec.ts)의 dynamic↔chart Task/Assignment ID·비활성 조회. 새 E2E spec·fixture·서버 원장/계산 엔진 없음.
- KEEP_UNIQUE: #809 chart 3개/오류/원본 복귀, #808 Domain/HTTP golden, #736 Excel/Plan/SQLite, #800 6관점 Geometry와 #517 별도 실기기. PARTIAL_OVERLAP: #807/#809 peer 진입과 #800 관측은 위험 경계가 달라 유지.
- ADD / CONSOLIDATE_CANDIDATE / RETIRE_CANDIDATE: 없음. 기존 assertion, 8-shard, CI Required3, QA·Owner gates, skip/retry/timeout 변경 없음.
- Design Delta: **B/C**, 기존 DESIGN의 Workspace-first/compact/semantic token·KPI 내부 참조 및 정확 원본/keyboard 원칙 구체화·검증이다. 새로운 공통 시각 원칙이나 제품 UI 변경이 없으므로 `DESIGN.md` 변경 N/A.

## 진행 후 게이트

요청 범위는 #806 신규 Ready PR CI **시작까지**다. 이후 PR에 새 P1/P2 리뷰·충돌이 확인되면 해당 지적을 해결하고 최신 main/base/test-merge, 변경 Head 전체 Required3·Trusted QA를 다시 검증해야 한다. 정확 Head PR CI 성공과 독립된 Owner 수용 이전에는 `MERGE_READY=BLOCKED`, 정식 GHCR/태그/Finalizer/Issue 종료 모두 미승인이다.
