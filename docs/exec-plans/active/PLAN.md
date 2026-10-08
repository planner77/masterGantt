## Issue #495 — Milestone 화면·문서 용어 정합화 (2026-10-08)

[Issue #495](https://github.com/planner77/masterGantt/issues/495) / [Work Packet](ISSUE_495.md). 기준 main `dca2f7821f277ef31ee3dbcbdc1e51ad257209f0` / app `0.102.1`, branch `fix/issue-495-milestone-terminology`, PATCH 후보 `0.102.2`. UI·접근성·오류·리소스·물류·Template·Import/Copy/Export의 용어를 `Milestone`으로 통일하고 E2E·DESIGN/AGENTS 및 도메인·UX·Export 계약 문서를 동기화한다. Ready/Completed, Membership/Dependency, API/DB/JSON 및 Excel 고정 header/sheet는 보존한다. 이 connector 실행에는 로컬 npm/Chromium/독립 qa_docs가 없어 NOT TESTED. 공식 원격 CI는 PR head의 quality/e2e/docker에서 확인한다. 종료점은 PR CI 시작, 병합/Main CI/GHCR/Issue 종료 비범위. `release_required=true`, `release_authorized=false`.

## Issue #519 — 최초 PR CI 실패·최신 main 통합 (2026-10-08)

[Issue #519](https://github.com/planner77/masterGantt/issues/519) / [Work Packet](ISSUE_519.md) / [PR #547](https://github.com/planner77/masterGantt/pull/547). 최초 head `d1924ffbbebc8cf38ebeafbde4edac67a8ecb599` / [CI #2185.1](https://github.com/planner77/masterGantt/actions/runs/37773843644): quality/docker 및 E2E 5개 shard SUCCESS, 5/6의 기존 #130 workspace 5폭×readonly/edit 단일 시나리오가 30s timeout으로 FAIL. 최신 main `599b824677cec2daa47743a60fcac422297f925b` / version `0.102.0`은 #130 시나리오를 폭별 독립 Playwright 테스트로 이미 분할했다. main 이력과 #529 구현을 보존하고 #519 UI/문서 delta를 통합하며 후보 PATCH `0.102.1`로 변경한다. 기존 0.101.3은 미병합 PR 후보 이력이다. 새 exact-head PR CI `quality/e2e/docker` 재검증 필요. 로컬 npm/Chromium 및 독립 qa_docs 미실행: NOT TESTED. `release_required=true` / `release_authorized=false`, 병합/Main CI/GHCR/Issue 종료 비범위.

## Issue #529 — Resource Plan·공수 견적 Excel 보고

[Work Packet](ISSUE_529.md)에 따라 최신 선행 #528 branch/head `899d5d7d12855771339e84f7d7b10ce1e1012983` 기반 `feat/issue-529-resource-excel-report`를 생성했다. 최신 main `b417fcc094bff98ea142374fcd746bce2458c2e1`, 후보 version0.102.0 MINOR, release_required=true/release_authorized=false. 동일 snapshot·현재 조건/Project 전체·raw 숫자/null·고유 Assignment·기존 Export 보안과 기본 시트 호환을 설계한다. 구현·DOCUMENTATION_SYNC·독립 PRE_QA 후 원격 게시·PR CI 등록까지만 진행하며 quality/e2e/docker 결과 모니터링·병합·main/GHCR·Issue 종료는 범위 밖이다. 공식 gate/QA_FINAL/Manager ACCEPT는 NOT TESTED다.

구현과 required docs를 동결했다. Backend 고유 Unit147·nativeAPI1, frontend 관련 Unit18·mock 고유3·native 고유3·기존 Milestone viewport1의 영향 범위 PASS를 확인했다. 최초 viewport FAIL과 재작업 FAIL, 반복 실행·controlled RAF·실행 당시 source hash 미수집은 별도로 보존한다. 독립 source/UI/PRE_QA 후 exact tree를 게시하며 PR/head/CI 실행 등록 증거는 Issue/PR에 기록한다. 전체 회귀와 Windows Excel/DRM은 NOT TESTED다.

최초 독립 PRE_QA는 readonly DOM 복원의 입력 취소 guard 누락으로 REWORK다. 기존 취소 oracle의 marker-null PASS는 실제 사용자 위치 보존 증거로 무효이며 원래 source/event 근거를 보존한다. DOM/Core 양쪽 취소·최종 public/DOM 직접 assertion·관련 검증/문서를 보완해 재동결하기 전 원격 게시를 보류한다.

DOM 입력 취소를 보완한 동일 제품 source에서 정상 복원/control·실제 Export·기존 Milestone3 PASS 및 취소1 PASS6.8초를 확인했다. 취소는 public30/DOM31 각각의 실제 사용자 위치와 이전120 복원 없음의 직접 assertion이다. 문서·소스를 다시 동결한 후 새 tree의 독립 delta QA를 거쳐 원격 게시한다.

## Issue #514 — 최신 #518 Workspace 구조 통합 / PR CI 준비

[Work Packet](ISSUE_514.md)에 따라 외부 #518 병합 main `f94c22b00cac57bab409ca57e744b0530d2d35e5` / application `0.101.1`의 상위 Milestone 탭과 복원 구조를 보존해 #514 보완을 적응 통합한다. 최종 branch는 `fix/issue-514-grid-start-reveal`, current worktree는 `issue-514-current`, 후보 PATCH `0.101.2`다. 최초 baseline `3fa543b10e98d59e50f63f3f53613affe720b648`의 source/진단/16조합 PASS와 실제 null/pending FAIL·폭 fixture FAIL은 historical로 보존한다. 최신 구조의 영향 검증·문서 gate·독립 PRE_QA 후 원격 게시와 exact-head PR CI 등록까지만 진행한다. CI 결과 모니터링·병합·main/GHCR·Issue 종료는 하지 않으며 release_required=true/release_authorized=false, 공식 quality/e2e/docker·QA_FINAL/Manager ACCEPT는 NOT TESTED다. 기존 #529 구현은 유지한다.

현재 #518 통합의 신규 고유16case(8matrix/16설정 포함)와 직접 관련 기존4case, Unit18case가 로컬 PASS다. 양 복원 queue의 새 입력 우선순위와 null start 수평 보호를 확인했다. 5폭10관측 중 390px 미래 시작점은 기존 minWidth720 작업면의 논리 viewport에만 포함되며 page x662 제한·outer pan NOT TESTED를 명시한다. 이전/현재 최초 typecheck fixture 오류 및 초기 oracle/폭 fixture FAIL을 보존하고 명시 타입 수정 뒤 현재 typecheck PASS를 구분한다. 최신 문서·독립 PRE_QA 후 게시하며 공식 CI와 최종 ACCEPT는 NOT TESTED다.

## Issue #518 — 일정·Milestone 상위 탭 구조 단순화 (2026-10-08)

[Issue #518](https://github.com/planner77/masterGantt/issues/518)의 현재 범위는 별도 `feat/issue-518-workspace-milestone-tab` 브랜치에서 #463의 내부 Gantt/Dashboard 중첩 탭을 제거하고 `일정 / Milestone 대시보드 / 리소스 / 물류 구성` 상위 탭으로 배치하는 것이다. 초기 기준 main은 `8b9d4d76758f73094ec84590e3a8a49314741587`, 이전 정렬 기준은 `b4a0898283571ac4f05d53299266acccadeeff68`, 신규 통합 기준 최신 main은 `3fa543b10e98d59e50f63f3f53613affe720b648` / application `0.101.0`; PATCH 후보 `0.101.1` (`release_required=true`, `release_authorized=false`). #399 WBS scope 탭, 기존 Gantt instance/viewport/filter/selection, #463 Dashboard 계산과 drill, dialog/focus 및 Core/Core-only 정책을 보존한다.

작성 범위는 application UI/CSS·관련 기존 Playwright 수정·#518 상위 탭 E2E·REQUIREMENTS/PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN/PLAN/CHANGELOG와 Work Packet 동기화 및 PR CI 시작까지다. GitHub connector에서만 원격 파일을 변경하므로 로컬 npm/Chromium LFF는 **NOT TESTED**이며 원격 exact-head CI의 quality/e2e/docker 결과도 PR 시작 전에는 **NOT TESTED**다. qa_docs 독립 검토는 별도 실행하지 않았으며 최종 ACCEPT/merge/main/GHCR/Issue 종료는 범위 밖이다. 상세는 [ISSUE_518](ISSUE_518.md)을 따른다.

Run #2158.1은 #518 고유 UI, Quality, Docker 및 E2E 5개 shard가 PASS했으나 shard 1의 기존 #502 Gantt Demo Error Boundary probe 1건이 FAIL했다. 원인은 본 Issue 코드 결함으로 단정하지 않고 hydration 이벤트 처리 준비 상태를 명시적으로 검증한다. E2E probe 전용 readiness 신호와 키보드/진짜 boundary 검증을 유지하며, 최신 main #527 통합과 함께 새로운 PR head의 required CI를 재시작한다. 이전 head PASS는 새 head 전체 ACCEPT 증거가 아니다.

최신 main #528 병합으로 Resource·Milestone·일정 간 canonical drill/원래 보기 복귀 계약을 보존한다. 내부 Gantt/Dashboard 탭을 상위 Workspace 탭으로 통합하면서 ResourceNavigationState.view에 milestones를 포함시키고, 단일 작업공간 tablist의 restore/heading focus에 연결한다. #518 UI/테스트/문서와 #528 Source of Truth를 함께 검증할 새로운 PR CI는 exact head에서 필요하며, 이전 #2161 PASS는 신규 head의 증거로 사용하지 않는다. `release_required=true` / `release_authorized=false`; CI 시작 이외의 병합·release·cleanup은 범위 밖이다.

## Issue #528 — Resource·Milestone·일정 간 drill-down

[Work Packet](ISSUE_528.md)에 따라 직접 선행 `feat/issue-527-resource-plan` / `a681089dcd374f56e1de4f56a8ee2bf5fe567e87` 기반 stacked PR로 순차 진행한다. Backend 관련6파일159Unit/독립159Unit·경계 probe2개 및 최종 UI 관련5파일28Unit·mock2/nativeUI1 PASS 후 문서 동결과 독립 PRE_QA를 진행한다. 후보 application `0.101.0`, `release_required=true/release_authorized=false`. 요청 종료점은 원격 PR·CI 시작 확인이며 CI 모니터링·병합·main/GHCR·Issue 종료는 비범위다. 공식 quality/e2e/docker·최종 ACCEPT는 NOT TESTED다.

## Issue #526 원격 인계

[PR #534](https://github.com/planner77/masterGantt/pull/534), head `1c518612395c45254ecbd018742e594ac88c3229`, [CI 37676430071 / 2099.1](https://github.com/planner77/masterGantt/actions/runs/37676430071) 등록을 확인했다. source tree `3c28e65d5fabc96d91103490f9536af357064523`, DOCUMENTATION_SYNC/독립 PRE_QA PASS. quality/e2e/docker 결과는 모니터링하지 않았고 NOT TESTED이며 #527로 진행한다.

## Issue #527 — 주·월 Resource Plan과 Capacity·과투입

[Work Packet](ISSUE_527.md)에 따라 직접 선행 `feat/issue-526-resource-milestone-rollup` / `1c518612395c45254ecbd018742e594ac88c3229` 기반 stacked PR로 순차 진행한다. [PR #535](https://github.com/planner77/masterGantt/pull/535), head `a681089dcd374f56e1de4f56a8ee2bf5fe567e87`, [CI 37684790075 / 2104.1](https://github.com/planner77/masterGantt/actions/runs/37684790075) 등록을 확인했다. source tree `d28ca7d9410b2a8894a0d7be739f5e2f35adc002`, DOCUMENTATION_SYNC/독립 PRE_QA PASS. application `0.100.0`, `release_required=true/release_authorized=false`. 요청 종료점은 원격 PR·CI 시작 확인이며 CI 모니터링·병합·main/GHCR·Issue 종료는 비범위다. 공식 quality/e2e/docker·최종 ACCEPT는 NOT TESTED다.

## #523–#528 요청 범위 진행 상태

#523 [PR #531](https://github.com/planner77/masterGantt/pull/531) / head `f8a51503745cd5f3f1f3c9986f6b7577d83ce93a` / [CI 37639620321](https://github.com/planner77/masterGantt/actions/runs/37639620321), #524 [PR #532](https://github.com/planner77/masterGantt/pull/532) / head `5c17d3a394d95c6799dceb2b22ed166dca34f241` / [CI 37643698987](https://github.com/planner77/masterGantt/actions/runs/37643698987), #525 [PR #533](https://github.com/planner77/masterGantt/pull/533) / head `c4454ba4085930ba2d6e32c58f1653a32e496aca` / [CI 37650777139](https://github.com/planner77/masterGantt/actions/runs/37650777139)의 실행 등록까지 확인했다. CI 결과는 조회하지 않았으며 공식 quality/e2e/docker·최종 ACCEPT는 NOT TESTED다. #526 PR #534 / CI 37676430071 및 #527 PR #535 / CI 37684790075 등록 후 #528 구현을 순차 진행했다. 작업 branch는 정리하지 않는다. #523의 외부 병합 및 추가 fix `37a16a55193a35b4d1dd608b14aae7a8317c84d3`는 후행 #527/#528 baseline에 반영했으며 이번 작업이 수행한 병합으로 보고하지 않는다.

## Issue #526 — Resource·Group Milestone roll-up과 비교표

[Work Packet](ISSUE_526.md)에 따라 직접 선행 `feat/issue-525-resource-dashboard-ui` / `c4454ba4085930ba2d6e32c58f1653a32e496aca` 기반 stacked PR로 순차 진행한다. application `0.99.0`, `release_required=true/release_authorized=false`. 요청 종료점은 원격 PR·CI 시작 확인이며 CI 모니터링·병합·main/GHCR·Issue 종료는 비범위다. 관련 backend211/frontend8 Unit·Next16.3.8 고유Chromium7·ui_ux 비교 PASS 후 최종stagedtree 독립 PRE_QA와 원격 게시를 수행한다. 공식 quality/e2e/docker·최종 ACCEPT는 NOT TESTED다.

## Issue #525 — Resource·Group 기본 Dashboard

[Work Packet](ISSUE_525.md)에 따라 직접 선행 `feat/issue-524-resource-dashboard-api` / `5c17d3a394d95c6799dceb2b22ed166dca34f241` 기반 stacked PR로 순차 진행한다. application `0.98.0`, `release_required=true/release_authorized=false`. 요청 종료점은 원격 PR·CI 시작 확인이며 CI 모니터링·병합·main/GHCR·Issue 종료는 비범위다. 관련 Unit10개·Chromium고유11개(긴 Dashboard 추가1 포함)와 ui_ux 설계 비교 PASS 후 최종 캡처·독립 사전 QA를 확인해 게시한다. 공식 quality/e2e/docker·최종 ACCEPT는 NOT TESTED다.

## Issue #524 — Resource KPI 조회 API와 동일 snapshot

[Work Packet](ISSUE_524.md)에 따라 직접 선행 `feat/issue-523-resource-kpi` / `f8a51503745cd5f3f1f3c9986f6b7577d83ce93a` 기반 stacked PR로 순차 진행한다. application `0.97.0`, `release_required=true/release_authorized=false`. 요청 종료점은 원격 PR·CI 시작 확인이며 CI 모니터링·병합·main/GHCR·Issue 종료는 비범위다. 관련 Vitest188개·실제 API Chromium1개 PASS 후 DOCUMENTATION_SYNC·독립 사전 QA를 거쳐 게시한다. 공식 quality/e2e/docker·최종 ACCEPT는 NOT TESTED다.

# Issue #523–#528 — Resource KPI 순차 구현

최신 main `f3373386d084bad5973b88180cd04ee9778e4fd6` / application `0.95.1`에서 #523을 시작한다. [#523 Work Packet](ISSUE_523.md)의 Domain·fixture·문서·독립 사전 검토 후 원격 PR과 CI 등록까지 진행하며, #524–#528은 직전 PR branch를 기반으로 순차 stacked PR을 만든다. CI 결과 모니터링·병합·main/GHCR·Issue 종료는 이번 범위 밖이다. `release_authorized=false`; 공식 quality/e2e/docker·최종 ACCEPT는 NOT TESTED다. #495/#518은 착수 시 OPEN이며 관련 PR이 없어 공유 UI 통합 상태를 후속 UI 착수 때 재확인한다.

# Active execution plan

## Issue #491 생성·복사·템플릿·입출력 폼 — 최신 Tooltip main 통합 / PR CI 시작

main `44b2ee3562cf76a73368a49fa17933ed341ab424` / application `0.94.2`에서 #456 C 후속을 구현하고 PATCH `0.94.3`의 최종 after 8case PASS(2.5분)를 확인했다. branch는 `fix/issue-491-project-transfer-layout`, 전용 worktree는 `issue-491`이며 [Issue #491 실행 계획](ISSUE_491.md)의 6AC·소유권·지원 경계·문서·검증을 따른다. 실제 7개 표면을 390/768/1024/1440/1920px에서 관측해 template/Export/Import 3표면을 FIX하고 나머지 지원 배치는 KEEP으로 기록한다. JSON-only Import/CSV mapping 미지원과 inline 견적 범위를 분리하며 신규 기능·계산은 추가하지 않는다.

실제 5폭에서 template save의 textarea/footer와 action 내부 간격, Export의 가로/세로 footer 간격이 0px임을 확인했다. 전체 8개 baseline before는 PASS(2.4분)이며 추가 region 측정에서 Import의 390px 초점 테두리 잘림도 확인했다. 소비자 4파일에 12px parent gap 및 Import의 8px focus 여유를 적용하는 최소안을 확정하고 PATCH `0.94.3`을 배정한다. 관련 최소 LFF·문서 동기화·독립 사전/게시본 검토 후 원격 PR 및 exact-head CI 등록까지 진행한다. CI 결과 모니터링·병합·GHCR/release·Issue 종료는 요청 범위 밖이고 공식 quality/e2e/docker 및 최종 ACCEPT는 NOT TESTED다. `release_required=true`, `release_authorized=false`다.


게시 전 외부 PR #513 / Issue #486 병합으로 main이 `d8d0bb3bab5d13ca68a6b319e116dec4ca24d48d`(tree `91cb73e2ca089f0b8ac7d3371ab29e33d0f845cf`), application `0.94.3`으로 전진했다. 원래 후보와 모든 실패·원본 자료는 `issue-491` worktree에 보존한다. 같은 branch의 새 `issue-491-current`에서 최신 Resource Catalog 코드·문서와 #491 고유 변경을 통합하고 PATCH 후보를 `0.94.4`로 정한다. 제품 4개와 테스트 2개는 main 변경과 겹치지 않는다. 기존 before 및 0.94.3 after는 과거 증거로 구분하고, 0.94.4의 관련 8개 E2E와 문서 동기화·독립 검토를 수행한 뒤 게시한다. CI 결과는 조회하지 않는다.

최신 0.94.4의 고유 after-current 실행은 관련 8개 모두 PASS(2.5분)다. 제품 4파일·spec/helper bytes는 원래 동결본과 같고 기존 before 재사용 범위를 명시했다. 새 geometry242/계약10 및 PNG10+JSON5 선택 증거를 기존 역사 자료와 구분한다. 문서 동기화·독립 UIX/PRE_QA·게시 동등성 후 PR CI를 등록한다. 공식 CI와 최종 ACCEPT는 NOT TESTED다.



게시 직전 외부 PR #498 / Issue #492 Hover Tooltip 병합으로 main이 `61a5f511d79e1f9429635bb0da35c0c02ee2163c`(tree `ff49917c4326aa6ff6b1d9f9ef33666148a4f11e`), application `0.95.0`으로 다시 전진했다. 새 현재 경로는 `issue-491-latest`, 후보는 PATCH `0.95.1`이다. 이전 0.94.4 후보·원본 증거·독립 검토는 과거 기록으로 보존한다. C 소비자 제품4/spec/helper가 동일한 범위의 before는 재사용하고, Gantt Tooltip의 실제 mousemove/focusin/scroll 영향을 반영하여 관련8개 E2E를 다시 실행한다. 최신 #492 소스·테스트·문서와 #491 자체 변경을 통합한 뒤 새 문서 gate·독립 delta 검토·게시본 동등성을 확인한다. 원격 쓰기와 CI 결과 조회는 아직0이다.

최신0.95.1의 after-latest8개 모두 PASS(2.5분)다. 제품4/spec/helper는 같고 최신GanttTooltip과 사용자 상태 보존을 새실행에서 확인했다. 기존78선택파일과 전체10회61case50PASS11원래FAIL 이력을 보존하고 새PNG10/JSON5·geometry242/계약10을 추가했다. 최신 문서 gate·독립delta 검토 후 게시본을 대조하고 PR CI등록으로 넘긴다. 공식CI/최종ACCEPT는 NOT TESTED다.


## Issue #486 Resource Catalog 401 보존 초안 전환 — 구현·문서 동기화 / PR CI 시작

최신 정렬 기준 `main`은 `44b2ee3562cf76a73368a49fa17933ed341ab424`, application `0.94.2`이며 작업 branch는 `fix/issue-486-suspended-resource-draft`다. 401 후 suspended dirty Resource/Group/Profile draft가 다른 editor trigger를 자동 가로채던 `openEditor()` 경로를 제거하고, `보존한 초안 확인`에서 초안 유지 또는 폐기 후 요청 editor 진입을 명시 선택하도록 수정한다. 기존 `보존한 초안 계속 편집`은 직접 재개 경로로 유지한다.

관련 E2E는 Resource→Group trigger의 자동 재개 금지/명시 재개 보존, Group→Resource trigger의 폐기 후 요청 editor 진입, Profile→다른 trigger의 명시 재개 보존을 추가한다. session/401/403/412, If-Match/revision, pending/Escape/focus와 API/DB/security/scheduling 계약은 유지한다. 상세 범위와 문서 영향은 [Issue #486 실행 계획](ISSUE_486.md)을 따른다. 하위 호환 버그 수정이므로 application version은 `0.94.3` PATCH다. `release_required=true`, `release_authorized=true`이며 사용자의 명시 승인에 따라 병합 후 exact main CI 성공 시 Generic Release Finalizer가 `0.94.3` 정식 GHCR 게시와 후속 lifecycle을 수행한다.

## Issue #490 프로젝트 설정·근무 규칙·인증 폼 — 로컬 검증 / 문서 동기화·PR CI 시작

현재 main `4f8fc2c9c86941d1b86ae4472b1e953707c85ef7` / application `0.94.0`을 기준으로 #456 B 후속을 통합한다. branch는 `fix/issue-490-project-settings-layout`, 현재 전용 worktree는 `issue-490-current`이며 상세 소유권·AC·문서·검증은 [Issue #490 실행 계획](ISSUE_490.md)을 따른다. 5폭 actual before에서 calendar 입력 경계·footer 간격·tab focus clipping을 확인했고, 빠른 반복 Escape와 같은 geometry canonical mock 갱신의 viewport 보존 guard를 포함한 제품 5파일을 최소 수정했다.

이전 0.93.1의 관련 E2E 5/5 PASS와 원래 FAIL을 보존한다. 독립 검토에서 actual password rotation pending/성공과 새 calendar field native focus 증거 보완을 요청했고, 작업 중 PR #499/main 이동으로 겹친 문서·버전 5파일을 통합한다. 제품 bytes는 유지하며 최신 baseline PATCH `0.94.1`에서 관련 6케이스가 모두 PASS했다(1.5분). actual password rotation과 새 Calendar field native focus를 보완했고 성공 refresh의 BODY 초점은 기존 동작으로 기록한다. 관련 최소 LFF와 문서 동기화·독립 사전/게시본 검토 후 PR CI 등록으로 넘긴다. `release_required=true`, `release_authorized=false`이며 요청 종료점은 원격 PR과 exact-head CI 등록이다. CI 결과 모니터링·병합·GHCR/release·Issue 종료는 수행하지 않는다. 공식 quality/e2e/docker와 최종 ACCEPT는 NOT TESTED다.

## Issue #459 Milestone Stage Gate Epic — 통합 감사 / PR CI

latest main `4098a064a9c5a614b0adfa1ac90dcbd9523db993` / application `0.92.0`에서 #460~#464가 모두 main에 반영된 상태를 기준으로 Epic 수용 기준을 재감사한다. 제품 runtime 재구현은 하지 않고, 상위 #459가 핵심 Source of Truth에 직접 연결되지 않은 문서 공백과 “member Task Dependency는 Milestone predecessor로 자동 승격하지 않는다”는 사용자 확정 정책의 전용 Domain regression을 보강한다.

branch는 `feat/issue-459-stage-gate-epic-integration`이며 상세 Work Packet은 [Issue #459 실행 계획](ISSUE_459.md)을 따른다. application version은 `0.92.0` 유지, `release_required=false`, `release_authorized=false`다. 이번 요청 종료점은 PR 생성 및 exact head PR CI 시작 확인이며 CI 완료 모니터링·병합·main CI·GHCR·Issue 종료는 수행하지 않는다.

## Issue #464 JSON·Excel·Copy·Template 보존 — latest main 재정렬 / 새 PR CI

PR #473 head `1e1397aca8d48780dbc8dcc397f333b3d9bb85ca`는 latest main `d748046733ae2006580052a480c984ae1eb1fa2a`보다 뒤처져 mergeable=false가 되었다. 현재 main에는 #463 병합, #455 기준정보 UI/transport corrective, #463 물류·Resource 결합 필터 보완이 포함되어 있으므로 이를 authoritative base로 보존하고 #464 고유 변경만 다시 적용한다.

충돌 교집합은 `project-gantt.tsx`와 문서 5개다. Gantt는 main의 context-menu surface-aware two-frame settle을 유지하면서 #464의 context selection `show:false`/Copy feedback 보존을 합친다. 문서는 최신 main 기록을 우선하고 #464 계약·검증 섹션을 병합한다. application candidate는 `0.92.0`을 유지한다.

정렬 후 exact new head에서 PR CI를 새로 시작하며 그 결과가 병합 판단 기준이다. 이번 요청 범위는 재정렬·충돌 해결·새 PR CI 시작까지이며 완료 모니터링·병합·main CI·GHCR/tag/release·branch cleanup·Issue 종료는 별도 단계다. `release_required=true`, `release_authorized=false`.


## Issue #455 기준정보 입력 컨트롤 — 최신 main 재정렬 / 병합 / Main CI

PR #481의 기존 head `7f9cfb87e4e56bba9eff444d74a0559bcb80b89d`는 PR CI Run `37411553451` / Run #1908.1 SUCCESS였으나, 이후 #453/#454 및 운영 변경이 main에 반영되어 최신 main이 `0fc986cb0cb642bdbedeec30157b27bd522b5a38`까지 전진했고 기존 head는 GitHub `mergeable_state=dirty`가 되었다. #455 고유 제품·테스트·fixture·증거를 최신 main 위에 재적용하고, 충돌 교집합인 CHANGELOG/PROJECT_UX/TEST_PLAN/active PLAN은 최신 main 기록과 #455 기록을 함께 보존한다.

새 exact-head PR CI의 quality/e2e/docker 성공을 병합 전 authoritative gate로 사용한다. 성공하면 PR #481을 main에 병합하고 해당 merge push로 Main CI가 시작되는 것까지 확인한다. 기존 Run #1908.1은 재정렬 전 head 근거이므로 새 head의 PASS로 대체하지 않는다. release/GHCR/finalizer/Issue close/branch cleanup은 이번 요청 범위에 포함하지 않는다.

## Issue #454 물류 유형 목록 — 최신 main 정렬 / 충돌 정리 / 새 PR CI

PR #478의 기존 head `04b3047328bb338bace1990e18a434ae80b611db`는 PR CI Run `37408864316` / Run #1900.1 SUCCESS였으나, 선행 #453이 별도 재정렬 후 PR #477로 병합되고 main이 `22326fc350b91ab59ddafa20ef97c3f418f71aae`까지 전진하여 기존 stacked head는 병합 불가 상태가 되었다. #454 자체 delta만 보존하고 최신 main을 병합하는 방식으로 정렬한다.

제품 `logistics-type-catalog-admin.tsx/.module.css`, #454 전용 E2E/fixture/output, version `0.90.1`은 기존 #454 후보를 유지한다. 충돌 교집합인 CHANGELOG/PROJECT_UX/TEST_PLAN/active PLAN은 최신 main의 #453 재정렬·#475/#461/#483 운영 기록을 보존하면서 #454 기록을 병합한다. published PR history는 force-push하지 않고 기존 #454 head를 첫 부모, 최신 main을 두 번째 부모로 하는 conflict-resolution merge commit을 사용한다.

새 exact head의 pull_request CI가 quality/e2e/docker를 다시 검증하며 그 결과 전에는 최종 ACCEPT를 재사용하지 않는다. `release_required=true`, `release_authorized=false`; 이번 요청 범위는 정렬·충돌 해결·새 PR CI 시작까지다.

## Issue #453 리소스 관리 독립 탭 — PR #477 최신 main 재정렬 / 새 PR CI

PR #477의 기존 head `c411634f75b7a69131a095e9cb6b7416060b827e`는 PR CI Run `37406441919` / Run #1898.1 SUCCESS였으나, 이후 main이 `d7316880732ecde5a8193764ac3b0cfca2ae455f` / application `0.87.1`까지 39 commits 전진해 GitHub `mergeable_state=dirty`가 되었다. Resource TSX/CSS 및 #453 관련 E2E/fixture는 main 이동에서 변경되지 않았고 충돌은 문서5파일과 package/lock 2파일에 한정된다. 최신 main의 #461/#462 및 Release corrective 변경과 source-map-js 1.2.2를 보존하면서 #453 문서와 candidate version `0.90.0`을 병합한다.

published PR history는 force-push하지 않고 기존 feature head와 최신 main을 부모로 하는 conflict-resolution merge commit으로 정렬한다. 새 exact head PR CI의 quality/e2e/docker가 공식 재검증 기준이며 시작 전/진행 중에는 `NOT TESTED`다. `release_required=true`, `release_authorized=false`; 병합·main CI·GHCR·tag/release·branch cleanup·Issue 종료는 이번 요청 범위 밖이다.

## Issue #460~#464 완료 단계 관리 — 순차 구현·문서 동기화·push·PR CI 시작

#460~#462는 main에 병합되어 있고 latest main `528ebfffa639a275ea4349a04860f5b3785e50e9` / application `0.90.2`의 #453~#455 UI 및 #461 Release corrective를 보존해 #463 candidate `0.91.0`을 유지한다. #463 [PR #472](https://github.com/planner77/masterGantt/pull/472)의 head `8f78a24d6e2d37e6c0a9da7ec1f79e2025a55a66` PR CI Run #1946.1(`37434077594`)은 quality/build/Docker와 Chromium shard 2~6 PASS, shard 1의 완료 단계 picker keyboard geometry 1건 FAIL이다. 열린 list의 `End/Home/Arrow` 대상 option은 이미 DOM에 있으므로 지연 rAF 대신 keyboard handler 안에서 즉시 `scrollIntoView(nearest)`해 active option 가시성을 보장한 뒤 새 exact-head PR CI를 시작한다. 상세는 [Issue #463 실행 계획](ISSUE_463.md)을 따른다.

최초 #460 기반 도메인·DB/API 구현의 정렬 기준은 main `9280536ddc85a8a841346bdf413b2ba638685880` / application `0.83.4`에서 구현한다. 작업 브랜치는 `feat/issue-460-stage-gates`, 예정 버전은 `0.85.0`이다. [Issue #460 실행 계획](ISSUE_460.md)에 Work Packet·공유 interface·잠금·호환성·검증·문서 소유권을 기록한다. 이후 #461 Editor → #462 Gantt/Grid → #463 KPI → #464 Import/Export·Copy·Template 순서로 선행 구현을 포함하는 branch를 만들고 각 push/PR CI 시작까지 반복한다. CI 완료 모니터링/병합/정식 릴리스/브랜치 정리/Issue 종료는 이번 요청 범위 밖이며 `release_authorized=false`다. 착수 당시 독립 사전 QA 및 원격 CI는 `NOT TESTED`였으며 이후 단계는 위 현재 상태와 Issue 로그를 따른다.

## Issue #452 관리자 공통 페이지·인증 폼·버튼 외부 간격 — 구현·문서 동기화 / PR CI 시작

최신 main `6ce221bc16613625953b85244bb93ad50019b377` / application `0.83.3`에서 세 관리자 화면의 공통 shell/auth presentation과 parent-owned button spacing을 구현한다. 기존 세션·비밀번호·API·권한을 분리 유지하고 #453–#457의 개별 탭/표 재설계는 제외한다. 후보 version은 PATCH `0.83.4`, branch는 `fix/issue-452-admin-layout`이며 범위·인수 기준·소유권·문서는 [Issue #452 실행 계획](ISSUE_452.md)을 따른다. `release_required=true`, `release_authorized=false`; 사용자 요청 종료점은 PR 생성과 exact head CI 시작 확인이다. CI 모니터링·병합·GHCR·Issue 종료는 범위 밖이다.

## Issue #430 Cut 내부 Dependency 허용 / 외부 경계 제한 — 구현·문서 동기화 / PR CI

최신 기준 main `5dc0cb3356d59b868ed0dfbfd58ed44072fb646b` / application `0.81.0`에서 Cut source subtree 내부 Dependency는 기존 Link identity/endpoints/type/lag를 보존한 채 cross-parent Paste/reparent를 허용하고, source 경계를 넘는 incoming/outgoing Link만 Context Menu·Ctrl/Cmd+X·cut Paste·server reparent에서 동일하게 제한한다. linked anchor before/after는 허용하되 linked leaf `child` 전환과 Delete/Indent/Outdent/Convert 보호는 유지한다. 후보 version은 MINOR `0.82.0`, branch는 `feat/issue-430-cut-internal-dependency`이며 상세는 [Issue #430 실행 계획](ISSUE_430.md)을 따른다. `release_required=true`, `release_authorized=false`; 사용자 요청 종료점은 PR 생성과 exact head PR CI 시작 확인이며 CI 완료·병합·main CI·GHCR·정식 release·Issue 종료는 범위 밖이다.

## Issue #418 Workspace 범위 Header/Row 작업 추가 일관성 — latest main 0.79.0 / merge 준비

최신 main `888b3a657ee9e29a69f322c505cb494d22f0275a` / application `0.79.0`의 #412 Resource 전역 역할 모델, #409 Relation Editor taskId 검색, #416 Week Header `Wxx + N일`, #299 Chart vertical DnD, #407 scoped Row add, #399 single-ProjectGantt scope tabs를 보존한다. Header/Row native `add-task`를 source-aware pure resolver로 통합해 scoped Header를 active root immediate child로 정의하고, descendant Row child·일반 Task first-child Summary 전환을 같은 canonical mutation 경계로 처리한다. canonical sync와 `filter-tasks` 직렬화 및 scroll/focus 복원으로 add 중 blank/flicker를 방지한다. 후보 version은 PATCH `0.79.1`, branch는 `fix/issue-418-scoped-native-add-continuity`; 상세는 [Issue #418 실행 계획](ISSUE_418.md)을 따른다. PR CI 성공 후 merge → exact Main CI SUCCESS → Generic Release Finalizer → approved `v0.79.1` release-image/GHCR → branch cleanup/Issue FINAL 순서로 진행한다.

## Issue #409 Copy ID / Relation Editor 식별자 불일치 — 최신 main 0.78.0 통합 / PR CI 재검증

최신 main `c7e4d8bb0617f8bcb8f6559b609b57aa56f59a32` / `0.78.0`의 #416 Week Header 근무 가능 일수와 기존 #299/#407/#370/#335/#399/#384 계약을 보존하면서 #390 `Copy ID`가 복사하는 canonical `taskId`와 Relation Editor의 `externalId` 검색·표시 불일치를 수정한다. 후보 검색을 name/externalId/taskId로 확장하고 두 ID를 명시적으로 표시하되 Link API는 externalId 계약을 유지한다. branch는 `fix/issue-409-relation-id-search`, 후보 version은 PATCH `0.78.1`이다. 상세는 [Issue #409 실행 계획](ISSUE_409.md)을 따른다. exact PR head CI PASS 후 merge → main CI → Generic Release Finalizer → GHCR 순서로 진행한다.

## Issue #416 Week Header 근무 가능 일수 상시 표시 — 구현·문서 동기화 / PR CI

최신 main `c005e05718fbca8c48973d7006c20cd4f905c6f6` / application `0.77.0`의 #299 Chart DnD와 #316 Project Calendar `workingDays`/Week Tooltip lifecycle을 함께 보존하면서 기존 ISO `Wxx` 및 68px 폭 안에 `N일` secondary label을 상시 표시한다. 어느 요일/공휴일인지의 상세는 기존 Tooltip에 남기고 Scheduling/API/DB/Gantt instance 계약은 변경하지 않는다. 후보 version은 MINOR `0.78.0`, branch는 `feat/issue-416-week-working-days`이며 상세는 [Issue #416 실행 계획](ISSUE_416.md)을 따른다. `release_required=true`, `release_authorized=false`; 사용자 요청 종료점은 PR 생성과 exact head PR CI 시작 확인이며 merge/main CI/GHCR/정식 release/Issue 종료는 범위 밖이다.

## Issue #407 Workspace 범위 탭 subtree 내부 작업 추가 회귀 — latest main 0.76.0 재정렬 / PR CI

최신 main `da0f39a4dde363bd84ad2e938089c40d2dd9e29a` / application `0.76.0`의 #370 Grid 시작일 Date Picker, #335 linked sibling reorder, #303 status/progress 및 #399 single-ProjectGantt scope tab 계약을 보존한다. scoped view 자체를 add 금지 신호로 쓰지 않고 native Grid 행 `+`의 target이 현재 subtree 안에 남는지 pure guard로 판정한다. root/descendant child와 일반 Task first-child Summary 전환은 허용하고 header/root-level, scope 밖 parent, Milestone 및 기존 hierarchy escape는 차단한다. 후보 version은 PATCH `0.76.1`, branch는 `fix/issue-407-scoped-task-add`이며 상세는 [Issue #407 실행 계획](ISSUE_407.md)을 따른다. 이전 head PR CI #1638.1은 전체 PASS했고, 최신 main 재정렬 head에서 새 전체 PR CI를 다시 통과한 뒤 승인 marker→merge→main CI→generic release finalizer 순으로 진행한다.

## Issue #370 Grid 시작일 Date Picker — #335 이후 최신 main 재정렬 / PR CI

최신 main `fa57ba77fd632fa530ca2c27091a072536a67172` / `0.75.0`의 #335 linked-subtree sibling reorder 계약을 보존하면서 [Issue #370 실행 계획](ISSUE_370.md)의 Grid 시작일 quick-edit만 재적용한다. 후보 version은 `0.76.0`; 이번 종료점은 새 PR CI 시작 확인이다.

## Issue #335 관계 연결 작업 sibling reorder — 최신 main 재정렬 / PR CI 재시작

최신 main `5101a4a701dd7dbbeb3091696c0c670c667cb840` / `0.74.0`의 #303 Task status/progress와 #399 Workspace WBS 범위 탭을 보존하면서 Dependency가 연결된 Task/subtree의 **same-parent sibling reorder**만 허용한다. Run #1614.1에서 신규 #335 E2E는 PASS했으나 기존 #116 Move submenu와 #104/#378 linked Move 기대값 회귀가 실패해 상위 Move trigger를 기존 UX와 action-specific capability의 합성 조건으로 보완한다. 후보 version은 다음 MINOR `0.75.0`이며 상세는 [Issue #335 실행 계획](ISSUE_335.md)을 따른다. `release_required=true`, `release_authorized=false`; 사용자 요청 종료점은 새 PR CI 시작 확인이다.

## Issue #399 Workspace 내부 WBS 범위 탭 — latest main 재정렬 / PR CI 재시작

최신 main `fd397c477ebbbdfaff7804be16bacd87fb8411d5` / application `0.72.0`의 #403 Project List column layout과 #367 Gantt timeline 동적 확장을 보존해 #399를 재정렬한다. `최상위로 열기`의 browser popup 진입을 동일 일정 Workspace 내부 WBS 범위 탭으로 교체하고 #373 subtree/canonical/deep-link/cross-tab/hierarchy guard를 유지한다. 반복 CI 분석에서 드러난 native add reject viewport 회귀는 ProjectGantt interceptor 경계에서 복원한다. 후보 version은 다음 MINOR인 `0.73.0`, branch는 `feat/issue-399-workspace-scope-tabs`다. 상세는 [Issue #399 실행 계획](ISSUE_399.md)을 따른다. 종료점은 최신 main 정렬 후 새 PR CI 시작 확인이다.

## Issue #403 Project List 날짜 열 겹침 — 구현 완료 / PR CI 시작 준비

latest main `cbe90acf0bf9785240e6a0ff2a2e5c532ab9251f` / `0.71.0`에서 Project List의 percentage column budget 문제를 명시적 `colgroup` fixed/flexible sizing으로 수정하고 생성/최근 변경 datetime geometry 회귀를 추가했다. 후보 version은 PATCH `0.71.1`이며 공통 설계·UI/UX·QA 기준도 동기화했다. 상세는 [Issue #403 실행 계획](ISSUE_403.md)을 따른다. 사용자 요청 종료점은 PR 생성과 required PR CI 시작 확인이며 merge/main CI/GHCR/Issue 종료는 범위 밖이다.


## Issue #390 작업 Context Menu Copy ID — CI #1536 실패 보완 / 최신 main 재정렬

PR #394 최초 head `60b3aefdeed8fd1819b996c8470f160ba139cfb6`의 CI #1536.1은 신규 E2E URL 정규식의 이중 escape로 TypeScript parser가 실패해 typecheck/ESLint/build/policy/Chromium이 연쇄 실패했다. Docker smoke는 PASS였다. 최신 main `5656096f295fd003010d9581ac883dbd1eee7d03` / `0.70.2`로 재정렬하면서 #364 clipboard compatibility와 #384 multi-selection Copy를 보존하고 후보 version을 `0.71.0`으로 조정한다. 상세는 [Issue #390 실행 계획](ISSUE_390.md)을 따른다. 종료점은 새 PR CI 시작 확인이다.

## Issue #384 다중 선택 Task Copy/Paste — PR #391 최신 main 통합·CI 시작 준비

main `2d310d2669d4b80bc961f67d81a4f51a7c3777cc` / `0.65.1`의 fullscreen·관계 편집·Week Tooltip·inline guard를 보존하며 선택 집합·Copy API·내부 Dependency 복제를 통합했다. 현재 후보 version은 `0.66.0`이다. 범위·소유권·version·검증은 [Issue #384 실행 계획](ISSUE_384.md)을 따른다. 사용자 요청 종료점은 PR 및 CI 실행 시작이며 CI 완료 모니터링·병합·릴리스·Issue 종료는 범위 밖이다.

## Issue #377 Task Editor 관계 탭 관리 — REWORK / 최신 main 재정렬·보완

PR #382의 최초 head `76106b7ba939b70f90312096b4e20dc49983d7ff` CI #1449에서 ESLint와 Chromium E2E가 실패했다. 원인은 관계 mutation 성공 시 부모 `editorSession` 객체 교체로 Task Editor native dialog effect가 다시 실행되어 Relation Editor 위로 올라온 점과, 직접 삭제 confirmation의 keyboard focus handoff가 없던 점이다. 최신 main `fbcbfc9669035b153cfd029545c969596c128731` / `0.63.2`로 재정렬하고 imperative canonical sync + confirmation focus restore로 보완한다. application version은 최신 main 기준 MINOR `0.64.0`이다. 상세는 [Issue #377 실행 계획](ISSUE_377.md)을 따른다.

## Issue #372 fullscreen 편집기 상태 보존 — 최신 main 재정렬·충돌 해결 / PR CI 재시작

최신 main `5fda7d963b0ba5e2e09414c1328103f9e943b564` / `0.63.1` 기준으로 다시 재정렬한다. PR CI #1485.1은 quality/e2e/docker 전체 PASS했지만 이후 Issue #375 병합이 `CHANGELOG.md`, `PROJECT_UX.md`, `TEST_PLAN.md`, `package*.json`을 변경하면서 PR #381이 behind 2 / mergeable_state dirty가 되었다. #375의 Summary bar 계약을 보존한 최신 main 위에 #372 fullscreen Editor 변경만 재적용하고 후보 version을 PATCH `0.63.2`로 조정한다. Relation E2E의 viewport fixture 안정화와 기존 fullscreen 요청 거부 회귀도 유지한다. 이번 요청 범위는 같은 PR #381의 새 head PR CI 시작까지다. 상세는 [Issue #372 실행 계획](ISSUE_372.md)을 따른다.

## Issue #373 Summary 하위 WBS scoped view — 구현 / PR·CI 시작

기준 main은 `9e22ebd1534471a67938a0d22adb2ba947066a83` / application `0.62.0`, 작업 branch는 `feat/issue-373-summary-root-view`다. Context Menu navigation, `rootTask` deep link, existing `filter-tasks` scoped visibility, same-origin cross-tab revision freshness와 문서/테스트를 구현한다. 상세 범위·N/A 계약·검증은 [Issue #373 실행 계획](ISSUE_373.md)을 따른다. Issue #378이 `0.62.0`으로 main에 병합된 뒤 재정렬했으며 후보 version은 다음 minor인 `0.63.0`이다. 사용자 요청 종료점은 PR 생성과 PR CI 시작 확인이며 CI 완료 모니터링·병합·main CI·GHCR·Issue 종료는 이번 범위 밖이다.

## Issue #345 빈 Summary WBS 컨테이너 — 독립 사전 QA PASS / PR·CI 시작 준비

최신 main·nullable Summary 계약·migration·표시·Import 범위·소유권과 검증은 [Issue #345 실행 계획](ISSUE_345.md)을 따른다. 이번 요청은 Issue 번호가 포함된 CI 실행 시작까지이며 완료 모니터링·병합·릴리스·Issue 종료는 범위 밖이다.

## Issue #344 삭제 실패 복구 — 사전 QA PASS / PR·CI 시작 준비

최신 main, 소유권, 삭제 성공 후 실패의 canonical/revision 보존 기준과 검증 범위는 [Issue #344 실행 계획](ISSUE_344.md)에 기록한다. 이번 요청은 PR 생성과 CI 시작까지이며 CI 완료 모니터링·병합·정식 게시·Issue 종료는 범위 밖이다.

## Issue #258 관계 연결 작업 편집 — 구현 및 PR 준비 중

최신 기준, 단계별 파일 소유권, 인수 기준, 성능 예산과 문서 영향을 [Issue #258 실행 계획](ISSUE_258.md)에 기록한다. 사용자 요청의 종료점은 PR 생성과 CI 시작이며 CI 완료·병합·GHCR·Issue 종료는 이번 범위 밖이다.

## 구현 화면 감사 후 개선 — 2026-09-28

최신 main `3802c1e6099819c06b388ef4ec37f132d2beea06` / `0.51.0`의 실제 화면을 검토해 #263 → #264 → #265 → #266 → #267 → #268 → #269 순서로 진행한다. 각 Issue는 구현·문서 동기화·독립 QA·PR·CI 시작까지 전달한 뒤 다음으로 넘어간다. 후속 PR은 앞 branch를 base로 하는 stacked PR이며 CI 모니터링·병합·릴리스·Issue 종료는 이번 범위 밖이다. 감사 인벤토리·상태별 설계·버전 배정은 [화면 검토 보고서](../../UI_AUDIT_2026_09_28.md)를 따른다. 실제 진행 상태와 PR/head/run은 각 Issue 댓글을 기준으로 한다. 아래 이전 날짜의 상태는 당시 기록으로 보존한다.

## UI/UX 순차 개선 — 2026-09-24 착수

### 현재 상태 — 2026-09-27 동기화

- Issue #196 Workspace Task/Milestone 빠른 보기 버튼: `feat/issue-196-task-milestone-quick-view` 브랜치에서 구현 완료.
- 일정 Toolbar `[ 전체 | Task | Milestone ]` 버튼 그룹, `TaskFilterState.types` 연동, CSS 반응형 및 Unit/E2E 테스트, 문서 동기화 완료. Application version: `0.35.0` MINOR.
- 기준 `main`: `b0743e5`, application version `0.34.1`에서 `0.35.0`으로 증가.
- 이 절 아래의 2026-09-24 `main` SHA, `Issue open`, E2E 실패/진행 중 표기는 **당시 실행 증거를 보존한 역사적 기록**이며 현재 상태 판정에 사용하지 않는다.
- #119, #122, #130, #140, #142는 모두 `closed/completed` 상태다.
- #130 Phase 1~4의 PR #150/#152/#153/#154는 모두 `main`에 병합됐다. #140 PR #161도 병합됐으며, #142 PR #162는 stacked base였던 #140 branch에 병합된 뒤 최종 #140 통합을 통해 `main`에 포함됐다.
- 과거 상태 동기화용 PR #165는 관련 구현 완료 후 내용이 stale해져 **superseded / close-without-merge** 처리했다. 해당 PR의 문서 snapshot을 현재 active plan으로 병합하지 않는다.
- 제품 코드/API/DB/Scheduling/Security/Deployment/CI 계약 변경은 없으며 이 문서 동기화에서 application version은 `0.34.1`을 유지한다.

> 현재 상태는 이 블록을 우선한다. 아래 기록은 원인 분석과 당시 검증 추적을 위해 보존한다.

2026-09-24 10:52 UTC 조회 시 원격 main은 `6386db860af69635cfb0fe626fd1a937905b9a56` / version `0.27.4`다. #116·#117은 다른 작업에서 병합·종료됐고, #118은 외부 병합 뒤 main CI 진행 중·Issue open이다. #141 미리보기(8303)와 후속 변경 미리보기(8305)는 각각 healthy/readiness 200이다. 아래 과거 main·Issue 상태는 당시 기록으로 읽고 최신 상태는 [UI/UX 실행 계획](UI_UX_ROLLOUT.md)을 따른다.

원격 상태와 사용자 요청에 따른 최신 작업은 [UI/UX 실행 계획](UI_UX_ROLLOUT.md)을 따른다. #30을 제외하고 #115 → #116 → #117 → #118 → #119 → #121 및 #122 검증, 이어 #130의 Project List → Workspace → Task Editor → Search/Filter 단계는 각 PR/CI 시작까지 진행했으며 미완 검증·충돌은 실행 계획에 남긴다. #155 전체 화면 PR/CI 시작 뒤 새로 확인한 UI/UX 이슈는 #136 브랜드 버전 → #141 파비콘/탭 제목 → #138 프로젝트 상태·필터 → #140 Grid 이름 인라인 편집 → #142 Chart 날짜 셀 정렬 순서로 처리한다. 이미 병합된 #120 token을 재사용하며 각 Issue는 수정·문서 동기화·PR 생성·해당 head의 CI 시작까지만 진행한 후 다음 Issue로 이동한다. 이 작업의 병합/main 검증·정식 릴리스·Issue 종료는 보류한다. 다만 2026-09-24 08:01 UTC `planner77` 계정의 PR #144 병합으로 main이 `e91bcff22a6e087b510d5706c2e71a75c47ad92f` / version `0.27.2`로 이동했고 main quality/e2e/docker 및 임시 GHCR exact digest smoke·cleanup이 PASS한 원격 사실은 별도 기록한다. 변경본 로컬 Docker는 #140 [PR #161](https://github.com/planner77/masterGantt/pull/161) 후보를 별도 볼륨과 8305 포트에서 확인했다. #142는 제품 runtime 변경 없이 전용 E2E와 문서만 준비하므로 새 preview는 필요하지 않다. 아래 Wxx/과거 이슈 기록은 당시 상태이며 이번 변경의 검증 근거로 재사용하지 않는다.

## Issue #33 — 운영 헤더 Gantt 데모 메뉴 제거 — 병합 완료 / v0.8.1 릴리스 준비

Issue #33은 운영 상단 주요 메뉴에서 `Gantt 데모` 링크를 제거하고 `/gantt-demo` 자체는 SVAR 통합·timezone/hydration 검증 fixture로 유지하는 범위로 구현했다. 전용 PR #42의 최종 head `62e891609df40cedf3d091cce6c4e0f2fc2d3fad`는 CI #130 (`34906688532`)에서 version/typecheck/lint/Vitest/build/Chromium E2E/Docker/HTTP·HTTPS/Compose gate를 모두 통과했고, `main`에 squash 병합되어 commit `ff12f358b856c33126574f27efbe830a8d8ee125`가 생성되었다. Application version은 SemVer PATCH `0.8.1`이다. 상세 분석·검증 근거는 [Issue #33 기록](../../ISSUE_33_REVIEW.md)과 [Issue #33 실행 계획](ISSUE_33_PLAN.md)을 따른다. 현재 다음 단계는 최종 `main` CI 및 immutable commit image 검증 후 annotated `v0.8.1` tag와 Semantic release image를 발행하는 것이다.


2026-09-24 후속 조회에서 원격 main은 외부 direct commit `998a65987a60d698256c54d57f7538a29f50d287`로 한 번 더 이동했다. 이는 Issue #116 Lifecycle helper workflow 한 파일 추가이며 이 작업의 push가 아니다. #136 이후 stacked PR은 지정된 선행 head를 기준으로 유지하고 새 main CI/릴리스 결과를 각 PR의 검증으로 전용하지 않는다.

## Issue #31 — Grid·Chart 우클릭 작업 subtree 삭제 — 진행 중

기준 main `51adbfb4fbd0c9b6e9d7bad2ffe40c858c6e7230`, branch `feat/issue-31-task-context-delete`. Frontend는 실제 우클릭 taskId의 삭제 메뉴와 자손 확인 dialog, Backend는 기존 Task DELETE의 보호 경계를 재사용하는 `includeDescendants=true` 원자 subtree 삭제를 담당한다. Scheduler는 삭제 후 살아남은 Summary 집계를 검토하고 qa_docs는 Unit/SQLite/실제 Chromium 및 문서 계약을 대조한다. Semantic Version은 하위 호환 기능/API 확장으로 `0.6.0 → 0.7.0` MINOR다. 최종 완료 판정은 같은 PR head의 GitHub Actions `quality/e2e/docker` 실제 결과로 하며, 실행 전 상태는 **NOT TESTED**다. 상세 근거는 [Issue #31 기록](../../ISSUE_31_REVIEW.md)을 따른다.

## PR #24 review 경계 후속 — 진행 중

PR #24 자동 review에서 확인한 375px compact header 경계와 Architecture 현재 UX 본문 정합화를 후속 처리한다. 기준 main은 병합 commit `820aeba800f48b035e4219f8094a5038593c8eb0`, 작업 branch는 `fix/pr24-review-boundaries`다. 이전 PR의 PASS를 새 변경에 전용하지 않으며 로컬 테스트 보류를 유지한다. 새 head의 원격 quality/E2E/Docker와 문서 link 검증이 끝날 때까지 **NOT TESTED**다. 세부 경계는 [후속 기록](../../PR23_FOLLOWUP.md)과 [대기 목록](../../PENDING_TESTS.md)을 따른다.

## PR #23 미해결 리뷰 후속 — PR #24 병합 완료

사용자 요청으로 미해결 P2 두 건(390px 알림 벨의 상단 navigation 가림, `INVALID_CREDENTIALS` 진단 코드 누락)을 PR #24에서 수정하고 `820aeba800f48b035e4219f8094a5038593c8eb0`로 main에 병합했다. 최종 PR head `93b6f9497ac937b46695327ef85fdc08efb76a7c`의 CI `34784330854` quality/E2E/Docker와 main CI `34784810624`의 4개 job 및 immutable `ci-820aeba800f48b035e4219f8094a5038593c8eb0` image 게시·검증은 PASS다. 로컬 테스트는 사용자 보류에 따라 NOT TESTED이며 별도 SemVer release와 운영 배포는 범위 밖이다. 실제 사내 proxy/Windows clipboard/스크린리더/최종 사용자 UX는 대상 환경이 필요한 미실행 항목으로 유지한다. 근거와 결과는 [후속 기록](../../PR23_FOLLOWUP.md)을 따른다.

## Issue #3 — 작업 추가 중 Gantt 인스턴스 유지 (진행 중)

- 사용자 요청으로 원격 `main`을 `d540eb5`까지 fast-forward했다. 기존 `next-env.d.ts`의 개발 서버 생성 변경은 보존하고 이번 커밋에서 제외한다.
- 열린 Issue 중 생성 시각이 가장 빠른 [#3](https://github.com/planner77/masterGantt/issues/3)을 처리한다. 작업 branch: `fix/issue-3-stable-gantt`.
- Frontend: 정상 저장의 key/권한/요청 상태 분리, canonical snapshot 동기화와 UI 상태 유지. QA: 지연 응답·중복 요청·인스턴스·화면 상태 회귀 테스트와 독립 검토. Infra: 해당 PR/head의 원격 quality/e2e/docker 확인. Manager: 통합·문서·판정.
- API/DB/일정 계산 계약과 명시적 실패 복구는 유지한다. 낙관적 임시 ID, PRO 기능, release 및 운영 배포는 범위 밖이다.
- 기존 로컬 테스트 보류 요청을 존중하여 로컬 실행은 하지 않는다. 이번 Issue의 공식 검증은 최신 [GitHub-first 정책](../../REMOTE_VALIDATION.md)에 따른 branch/PR Actions로 진행한다. 아래 과거 보류 기록과 W24 PASS는 이번 Issue의 결과가 아니다.
- 현재 판정: 구현/원격 검증 진행 전, **NOT TESTED**. 실제 결과와 남은 항목은 [Issue #3 기록](../../ISSUE_3_REVIEW.md)에 갱신한다.

현재 추가 작업: **Grid Header 우클릭 열 선택 — 로컬 커밋 / 검증 대기**. 외부 ID는 기본 숨김, 기존 별도 버튼 제거. 데이터 열 선택은 최소 한 열을 유지하고 같은 workspace 안에서만 보존한다. 테스트·빌드·원격 push는 보류하며 [대기 목록](../../PENDING_TESTS.md)에 검증 항목을 기록한다.

추가 후속 작업: **Grid/Chart 상단 ‘작업 추가 또는 삭제’ 패널 제거 — 로컬 커밋 / 검증 대기**. Native Grid `+`와 서버 API는 유지하며 테스트·원격 push 보류 정책은 동일하다. 제거된 패널에 의존하는 E2E 갱신 항목을 [대기 목록](../../PENDING_TESTS.md)에 추가한다.

현재 후속 작업: **작업 생성 이름·날짜·기간 자동 적용 — 로컬 커밋 / 일괄 검증 대기**. 입력 없이 `새 작업`·브라우저 오늘·1일을 적용하며 일반 Task의 Summary 전환 확인만 유지한다. 사용자 요청에 따라 로컬 커밋만 수행하고 테스트·빌드·CI 실행과 원격 push는 별도 요청까지 보류한다. [검증·원격 반영 대기 목록](../../PENDING_TESTS.md)에 재개 절차를 기록한다. 아래 W24 PASS는 이 후속 변경 이전의 기록이다.

상태: **W24 Project Grid/Delete/Hierarchical Gantt UI LOCAL PASS / Manager ACCEPT**. 목록 표·보호 삭제·native Header/행 `+`·child 저장/summary 집계·locale·주말·고정 header 작업공간을 구현했다. 전체 Unit 378/28 files, Chromium E2E 10, build/typecheck/lint PASS. 사용자 승인으로 W08의 Summary/계층 일부를 선행하되 WBS/reparent/FS 전체를 완료로 처리하지 않는다. 원격 CI/이미지 결과는 별도이다. 근거: [Requirements](../../REQUIREMENTS.md), [W24 Review](../../W24_REVIEW.md), [Decisions](../../DECISIONS.md), [Issue drafts](../../ISSUE_BREAKDOWN.md).

## Phase와 Task

| Phase | Task | Dependency | Assigned Agent | Acceptance Criteria | Status | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| B0 | 저장소/설정/요구 검사 | 최신 pull | Manager | 7개 TOML과 현재 파일/소스 상태 기록 | DONE STATIC | runtime 적용 검증 한계 |
| B1 | 공식 조사·설계·Import 계약 | B0 | researcher/backend/scheduler/excel_vba/infra | 공식 근거와 계약·경계 문서 | DONE PLANNING | 실제 Excel·native 미검증 |
| B2 | Test strategy·초기 독립 QA | B1 | qa_docs | 실제 문서 대조와 구체적 findings | DONE INITIAL REVIEW | 전체 통합 후 재검토 필요 |
| B3 | Manager 보완·Issue 분해 | B2 | Manager | findings 반영, dependency/AC/owner/risk 작성 | DONE PLANNING | 구현 결과 별도 검증 |
| B4 | 최종 독립 review→Manager 판단 | B3 | qa_docs→Manager | 최종 계약 일치, blocker 판정, review 증거 | PASS / ACCEPT | runtime 검증과 구분 |
| P1 | W01 Project Foundation | Bootstrap 최종 QA/Manager ACCEPT | frontend + backend | 공식 버전/라이선스·peer/engine 확인과 lockfile; build/typecheck/smoke 성공; server-only DB 경계 | DONE | Turbopack sandbox 제한; Webpack PASS |
| P1 | W02 SQLite Foundation | W01 | backend + qa_docs + Manager | projects/tasks/links/edit_sessions/holidays, FK/index, migration 실패와 rollback, 다른 Project FK 거부 | DONE / PASS / ACCEPT | Native Docker platform은 W16 검증 |
| P1 | W03 SVAR Minimal Integration | W01 | frontend + researcher + qa_docs + Manager | 설치 version에서 browser mount·final update event·date 왕복·readonly, PRO 호출 없음, 한 logical command 경계 | DONE / PASS / ACCEPT | exclusive end 추론의 실제 root pointer 왕복은 W07 PASS |
| P2 | W04 Project Create and Direct Read | W02 | backend + frontend + qa_docs + Manager | strict 입력3개, UUID URL, DB 재조회, scrypt+최초 session 원자 저장, 원문 password 미노출; D02 전 List 차단 | DONE / PASS / ACCEPT | production limiter·KDF benchmark는 W16 |
| P2 | W05 Readonly and Edit Authorization | W04 | backend + frontend + qa_docs + Manager | W05 적용 AUTH slice; 잘못된·만료·revoke·다른 Project session 거부; metadata 보호 mutation/revision; password rotation; route inventory | DONE / PASS / ACCEPT | production limiter·KDF benchmark는 W16; root Task auth W07 PASS, Import W12 |
| P2 | W06 Working Calendar and Duration | W01 | scheduler + frontend + researcher + qa_docs + Manager | 윤년·weekend·holiday·비근무 시작·범위·Manual 경계 unit; browser/server 동일 fixture | DONE / PASS / ACCEPT | root Leaf 저장 W07 PASS; Summary/WBS·FS는 W08/W09 |
| P2 | W07 Task and Link Persistence | W03,W05,W06 | backend + frontend + researcher + scheduler + qa_docs + Manager | root Task/Milestone strict CRUD, AUTH/DB rollback·reopen, 실제 pointer edit/reload·거부 복원, same-revision race, Task UUID/externalId 분리, Link Repository foundation | DONE / PASS / ACCEPT | Summary/Hierarchy·Link Route·FS는 W08/W09; 기존 구조는 fail-closed |
| P1 | W20 CI/CD and Semantic Container Release | W02,W07; W16 runtime 일부 선행 | infra + backend + researcher + qa_docs + Manager | PR/main Actions, strict·monotonic SemVer/annotated tag, non-root image·runtime config·readiness·restart persistence, candidate→GHCR digest→exact promotion, 최소 권한·SHA/digest pin, 상시 문서 규칙 | DONE / PASS / ACCEPT | W22에서 remote release까지 PASS; ruleset 미강제 위험 수용 |
| P1 | W21 Synchronized Gantt Workspace | W03,W07 | frontend + researcher + qa_docs + Manager | UI03–10, empty/0→1 Grid+Chart, explicit columns/gridWidth, Desktop viewport geometry, narrow inner scroll, auth/persistence regression | DONE / PASS / ACCEPT | persisted Summary/reparent/WBS는 W08; Resizer pointer 자동화 미검증 |
| P1 | W22 Main Commit GHCR Automation | W20,W21 | infra + qa_docs + Manager | 성공한 main만 immutable `ci-<SHA>` 게시, release `sha-<SHA>`와 분리, 두 digest를 registry에서 새로 pull해 policy/readiness/HTTP Project·Task auth/restart persistence 검증, PR·수동 CI read-only | DONE / PASS / ACCEPT | ruleset 미강제 위험 수용, GitHub Attestation 비활성; W16 운영 범위 별도 |
| P1 | W23 Project List 활성화 | D02,W04,W05 | backend + frontend + qa_docs + Manager | 전체 공개 summary, 최신 수정순, no-store, 생성→목록 복귀·reload, secret 제외, 기존 Mutation 인증 유지 | DONE LOCAL / PASS / ACCEPT | 원격 이미지·운영 네트워크 공개는 별도 |
| P1 | W24 Project Grid/Delete/Hierarchical Gantt UI | W23,W06,W07 | backend + frontend + scheduler + researcher + qa_docs + Manager | 표 목록·권한 삭제, Header root/row child, 명시 Summary 전환·집계, today/1day·locale·주말·column toggle·고정 headers | LOCAL PASS / ACCEPT | 원격 CI/image 별도 확인; subtree/reparent 후속 |
| P2 | W08 Hierarchy Summary and WBS | W06,W07 | scheduler + backend + frontend | SCH08–10; Summary+첫 child 성공, final empty/cycle 거부, REAL progress 정확성 | PARTIAL IN W24 | WBS/reparent 및 유효한 subtree 삭제 묶음 후속 |
| P2 | W09 FS Scheduling Recalculation | W06,W07 | scheduler + backend | SCH04–07/11; Manual conflict 전체 rollback, link 제거 날짜 복귀, 미지원 관계 명시 오류 | PLANNED | cycle·달력 계산 비용 |
| P3 | W10 Excel/VBA Environment POC | D01,W11의 작은 browser parser harness | excel_vba + researcher | 승인 VBA·추출·JSON/CSV 저장·한글/날짜·browser 실제 파일 읽기 증거; 후속 앱 통합은 W12/W13 후 | BLOCKED ENVIRONMENT | 조직 정책·원본 구조 |
| P3 | W11 Import Contract Executable Fixtures | Bootstrap 최종 QA, W06 | backend + excel_vba | Backend+Excel 공동 리뷰, Unicode ID·summary·FS/end·BOM/quote·limits, QA 승인; 단독 변경 없음 | PLANNED | 정규화 손실 |
| P3 | W12 JSON and CSV Import Service | W08,W09,W11,W10 초기 POC PASS | backend | IMP01–07/09–10, stale preview412, fault injection rollback, metadata 미변경, 동일 CSV/JSON 결과 | PLANNED | partial import·resource abuse |
| P3 | W13 Import Wizard and Manual Fallback | W12 | frontend | IMP08, row/path 오류 접근성, cancel/retry, 서버 diff 반영, 승인된 수동 경로만 제공 | PLANNED | 모호한 날짜/진척 mapping |
| P3 | W14 Excel/VBA Exporter | W10 PASS,W11,W12,W13 | excel_vba | 실제 POC 근거, stable IDs, 한글/date fixture, 누락 행 없음; W12/W13 실환경 round-trip | PLANNED | VBA 정책·환경차 |
| P4 | W15 Excel Table and Hyperlink Export | W07,W08,W09 | backend + frontend | XLS01–04, UTF8/date/formula-safe cells, hyperlink 실제 열기; secret/internal ID 없음 | PLANNED | 잘못된 URL·workbook 메모리 |
| P4 | W16 Docker Deployment | W02,W05,W07; production D02/D03 | infra | DEP01–07, target image build와 nonroot 권한, restart/restore 실제 PASS; 단일 app | PLANNED | ABI/libc·volume·backup |
| P4 | W17 Independent E2E and Release Review | W08,W09,W12,W13,W15,W16; VBA release W14 | qa_docs | TEST_PLAN의 초기 범위 실제 증거와 qa_docs PASS/FAIL/BLOCKED/NOT TESTED; Manager sign-off | PLANNED | 미검증을 PASS 처리 |
| P5 | W18 Excel Gantt Sheet Phase 2 | W15 PASS,W17 초기 release 안정화 | backend + frontend | XLS05 별도 검증, 범위 제한, Phase1 export 회귀 없음 | DEFERRED | Excel sheet/size 제한 |
| P5 | W19 Advanced Scheduling Discovery | 초기 release와 실제 사용자 우선순위 | researcher + scheduler | 공식 공개 근거, 비용·계약 영향 검토, 기능별 개별 issue; PRO 구현 비의존 | DEFERRED | 범위 확대·불명확한 제약 |

## 최초 Vertical Slice

W07은 Task CRUD와 Link 저장 기반까지이며 실제 FS mutation endpoint는 W09 검증 후 공개한다. W10 초기 환경/serialization POC와 W12/W13 이후 full application 통합 검증을 구분한다.

B4 후 W01→W02/W03→W04→W05→W06→W07의 작은 범위인 Project 생성→SQLite 저장→새 browser Direct Readonly→password unlock→단일 Task 편집→reload 유지를 완료했다. build/typecheck, authorization/isolation integration, date adapter, persistence E2E와 독립 QA를 통과했다. 전체 Import와 advanced scheduling은 후속 단계로 유지한다.

## 병렬 작업과 소유권

동시 실행은 세션 한도에 따라 Main+전문 Agent 최대3개다. Main은 공용 API/Import/Scheduling/Deployment 계약 변경을 조정한다. Backend는 server/db, Frontend는 UI/Gantt, Scheduler는 domain, Excel은 excel/vba, Infra는 Docker/운영 및 infrastructure-only 구현을 소유한다. 공용 계약이나 같은 파일을 여러 write agent가 동시에 수정하지 않는다. qa_docs/researcher/ui_ux는 read-only 결과를 반환한다. 문서 반영은 Issue Work Packet의 `documentation_owner`가 수행하며, PLAN 단계에서 Manager가 Manager 자신 또는 지정 Write Agent를 명시한다. read-only Agent 결과라고 해서 Manager가 항상 직접 문서를 작성하는 것으로 고정하지 않는다.

실제 구현 시 각 issue에 명시한 directory를 branch/worktree로 분리할 수 있으며 QA와 Manager 검토 후 merge한다. 원격에는 완료한 기반 작업과 검증 기록을 포함하며, 전체 제품 release 승인은 W17에서 별도로 수행한다.

## 환경 Gate와 후속 처리

- D01: 조직이 대상 Excel의 macro/cell/file export와 저장 위치를 확인해야 실제 POC를 진행한다. Fixture 기반 contract 검증과 분리한다.
- D02: 앱 접속자 전체 목록 공개 승인 완료. 인터넷 공개 및 운영 네트워크 경계는 별도 배포 결정이다.
- D03: target CPU/host/domain/TLS/volume/backup 정책은 배포 실행 전 확인한다.
- qa_docs 재시도에서 B4 독립 review가 완료되었다. 구현 후에도 각 issue의 실제 test evidence와 독립 QA/Manager review를 다시 수행한다.
- W01 실행 결과: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`(Webpack), health endpoint smoke PASS. 기본 Turbopack은 sandbox process/port 제한으로 실행하지 않았다.
- W02 실행 결과: build/typecheck/lint PASS, 전체 17 tests PASS, 독립 DB/CLI 16 tests PASS. [검증 기록](../../W02_REVIEW.md)
- W03 실행 결과: Core 2.7.3 browser fixture, build/typecheck/lint PASS, 전체 23 Vitest와 Chromium E2E 1개 PASS, 독립 QA PASS. [검증 기록](../../W03_REVIEW.md)
- W04 실행 결과: `POST /api/projects`, `GET /api/projects/{publicId}`, 생성/직접 UI 구현. Manager와 독립 QA가 build/typecheck/lint, 전체 55 Vitest를 PASS했고 Manager Chromium E2E 3개도 PASS했다. Project+session 원자성, 재시작 DB 재조회, Project 격리, Origin/body/rate/KDF/cookie/secret 경계를 검증했다. `GET /api/projects`는 D02 전 405다. qa_docs PASS / Manager ACCEPT. [검증 기록](../../W04_REVIEW.md)
- W05 실행 결과: unlock/current/logout, metadata PATCH, password rotation, edit UI와 실제 Route security inventory 구현. 최초 독립 QA의 expiry lock race, wrong-project Cookie 유효성, canonical protected ID finding을 수정했다. 전체 91 Vitest, typecheck/lint/build와 clean 기본 Turbopack Chromium 4/4(worker 1)를 PASS했다. Process-global create limiter를 spec 사이에서 경쟁시키지 않되 동일 revision concurrent PATCH 200+412는 spec 내부 병렬 HTTP로 유지했고, live HEAD/OPTIONS 불변, rotation rollback/old session 무효화를 포함한다. Backend/Security·Frontend/Browser qa_docs PASS / Manager ACCEPT. [검증 기록](../../W05_REVIEW.md)
- W06 실행 결과: `1900-01-01..2199-12-31` Gregorian ordinal, exact `Asia/Seoul`/`[6,0]`, 중복 Holiday 거부·nullable name 보존, inclusive 근무일과 calendar-only Leaf/Milestone 계산을 pure Domain으로 구현했다. 최초 독립 QA의 SSR-only runtime 증거와 Holiday `name: null` 불일치를 수정하고 malformed leaf/context도 보강했다. Domain 135/135, 전체 226/226 Vitest, typecheck/lint/build, clean 기본 Turbopack Chromium 7/7과 production dependency audit 0건을 PASS했다. Scheduler/Frontend/Browser qa_docs PASS / Manager ACCEPT. [검증 기록](../../W06_REVIEW.md)
- W07 실행 결과: root Task/Milestone POST/PATCH/DELETE, 32 KiB strict 입력, Project-scoped ScheduleRepository CRUD와 Link foundation, W06 `scheduleLeaf`, canonical snapshot/ETag를 연결했다. 실제 Handler→Service→SQLite authorization, cross-project UUID, transaction expiry/auth-version/rotation, create/update/delete/readback rollback, file reopen, same-revision HTTP `201+412`를 검증했다. 실제 SVAR 우측/좌측 resize·이동·삭제·reload와 401/412/422/500·canonical read 실패 복원도 통과했다. 전체 291/291 Vitest, typecheck/lint/build, clean 기본 Turbopack Chromium 8/8과 production dependency audit 0건 PASS. qa_docs PASS / Manager ACCEPT. [검증 기록](../../W07_REVIEW.md)
- W20 실행 결과: PR/main read-only CI와 annotated strict·monotonic SemVer release를 분리했다. Release는 local candidate gate 뒤 immutable commit candidate만 push하고 GHCR digest runtime smoke와, 활성화된 경우 GitHub Attestation 성공 후 stable alias와 exact version을 승격한다. 24 files/309 Vitest, typecheck/lint/build, Chromium 8/8, actionlint, audit/link, final `linux/amd64` non-root image, missing/insecure URL exit 1, readiness/native SQLite restart persistence를 PASS했다. qa_docs PASS / Manager ACCEPT. 당시 원격 Actions/GHCR는 NOT TESTED/BLOCKED였고, W22에서 admin 인증 성공 후 실제 artifact 증거를 계속 추적한다. [검증 기록](../../W20_REVIEW.md)
- W22 실행 결과: Main CI `34659591764`, PR `34659639024`와 release `34659839100`이 원격 PASS했다. Commit digest `sha256:09d815cf67fc9aeb5454bfdb1c76dee6361fa61423759a4e297fa6c328c12ae4`와 release digest `sha256:c03cf6f24a02917670df94334a648ba541d14652a5922e591efaa6df85b082eb`는 원격·로컬에서 policy/readiness/HTTP Project·Task authorization·restart persistence를 PASS했다. Release tag 전체가 동일 digest로 promotion됐고 양쪽 SPDX 2.3 SBOM 510 packages와 SLSA provenance도 조회했다. qa_docs PASS / Manager ACCEPT. [검증 기록](../../W22_REVIEW.md)

## Repository layout work (#12 / #13)

사용자 승인에 따라 배포 파일 정리와 테스트 설정 정리를 별도 커밋/stacked PR로 진행한다. 배포 구조와 새 검증은 #12, 테스트 config 이동은 #13에서 추적한다. 이 기록은 main 반영이나 CI PASS를 의미하지 않는다. 각 head의 quality/E2E/docker 실행 결과를 PR에 남기고 배포 PR → 테스트 설정 PR 순서로 검토한다. 실제 운영 배포, 데이터 이동, HTTP 지원, Node 버전 전환은 이번 범위에서 제외한다.

## Issue #8 — 내부망 HTTP

전용 브랜치에서 URL/쿠키/설정 주입/공유 URL과 문서를 갱신한다. PR quality/E2E/Docker 및 HTTP·HTTPS 실제 브라우저 검증 후 리뷰·병합하고 main exact digest 결과를 별도로 기록한다. 본 계획 추가만으로 PASS가 아니며 운영 Windows/WSL2 전환은 별도 미검증이다.


## Issue #492 — Grid/Chart 작업 Hover Tooltip

최신 main `d8d0bb3bab5d13ca68a6b319e116dec4ca24d48d` / application `0.94.3` 기준으로 `feat/issue-492-task-hover-tooltip`에서 작업 Hover Tooltip을 구현한다. Grid row와 Chart Task/Summary/Milestone를 기존 task target selector로 canonical taskId에 연결하고, 표시 authority는 `ProjectTaskDto`의 name/start/end로 고정한다. 설치된 SVAR React Gantt 2.7.3의 공식 Tooltip API를 검토했으나 실제 PR CI에서 Milestone/WBS scope 및 Header Tooltip 공존 회귀가 확인되어 app-owned delegated hover로 전환했다. Tooltip 상태와 native listener는 전용 child layer로 격리하여 hover가 ProjectGantt/SVAR 부모를 재렌더링하거나 viewport를 변경하지 않으며 date-less Summary의 Core anchor 날짜는 노출하지 않는다.

candidate version은 `0.95.0`, release_required=true, release_authorized=true다. 사용자가 병합 후 정식 GHCR 게시를 명시적으로 승인했으며 Issue #492의 version-scoped authorization marker가 authority다. REQUIREMENTS/PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN/CHANGELOG/Issue 실행 계획을 동기화하고 Unit+Chromium 명세를 추가한다. 현재 사용자 승인 범위는 latest-main exact PR CI SUCCESS → 병합 → exact Main CI 시작 및 성공 후 Generic Release Finalizer가 정식 GHCR 게시를 수행하도록 하는 것이다.


## Issue #456 — Task Editor 폼 밀도와 의미별 배치

[Issue Work Packet](ISSUE_456.md)을 기준으로 최신 main `05fe212060ed4a935510dc2f7a692bb9113c55e8` / version0.92.0에서 기존branch `fix/issue-456-task-editor-form-density`를 재사용하며 후보 PATCH0.92.1을 적용한다. 실제 before 후 A Task Editor의 필드·intrinsic action 폭·부모 간격을 정돈한다. 기존44px hit-area·동적탭·dirty/stale/canonical/Gantt 계약을 유지한다.

B 설정·근무 규칙·인증은 [#490](https://github.com/planner77/masterGantt/issues/490), C 생성·복사·template·입출력·견적은 [#491](https://github.com/planner77/masterGantt/issues/491)로 분리했으며 FOLLOW-UP/NOT TESTED다. 미검증 표면을 KEEP/PASS로 처리하지 않는다. 한 PR에 A/B/C를 restyle하지 않는다.

요청 종료점은 구현·DOCUMENTATION_SYNC·독립 사전 검토·원격 Refs #456 PR·exact head PR CI 등록이다. CI 결과 모니터링은 수행하지 않으며 quality/e2e/docker·최종 ACCEPT는 NOT TESTED다. release_required=true/release_authorized=false; 병합·main/GHCR·tag/release·cleanup·Issue 종료는 범위 밖이다. 현재 branch/version 준비와 실제 before 측정은 PASS이며, 구현과 관련 재검증·최종 문서·독립 사전 검토는 진행 중이다.

#456 실제before71개와 독립UIUX를 근거로 진행률 숫자 clipping, 일정+mode group, footer폭, relation/baseline32→44px을 FIX로 승인했다. Description읽기폭·기존탭/저장단위는 유지한다. 구현/LFF/최종문서·독립PRE_QA는 진행 중이며 원격CI/ACCEPT는 NOT TESTED다.

#456 A 구현·관련 Local Fast Feedback는 PASS이며 최종 source3에서8/8,재사용 포함27 unique/최종계열52 PASS 실행을 구분했다. before71/after86을 동결하고 문서7개 및 항목별N/A를 동기화한다. 실제 visible 집합이바뀌는metadata는스크롤복원에서제외하고 same집합metadata의120/38보존을검증했다. 다음은 같은171파일 후보의 독립UIX/PRE_QA,게시동등성,PR과CI등록이다. 공식quality/e2e/docker·최종ACCEPT는NOT TESTED이며#490/#491은후속으로남긴다.

## Issue #457 — 전 화면 회귀 체계 확장

선행 #456 PR #500의 exact head에서 stacked branch를 만들어 공통 측정 helper/대표 E2E/전체 coverage 표와 문서를 보강한다. [Work Packet](ISSUE_457.md)에 기준 SHA·역할·증거·검증 경계를 기록한다. version0.92.1 유지, tests/docs only, 공식 CI와 최종 ACCEPT는 NOT TESTED다. 현재 구현·독립 검토를 진행하며 요청 범위는 원격 PR과 exact-head CI 등록까지다. B #490/C #491 및 실제 배포/환경별 검증은 후속으로 유지하고 Epic #449를 종료하지 않는다.

#457의 실제 React error boundary 미실행은 [#502](https://github.com/planner77/masterGantt/issues/502), native125%·수동 UX·운영 source/version 미실행은 [#517](https://github.com/planner77/masterGantt/issues/517) FOLLOW-UP / NOT TESTED(BLOCKED 가능)로 분리 추적한다. 당시 #457 PR은 해당 후속이나 B #490/C #491를 자동 구현하지 않았다.

#457 게시 준비 중 선행 PR #500 병합을 확인했다. 최신 main `24072f4fd28cd1306b3c348d3f7da1a0e3dbc075`의 tree가 기존 측정 source와 정확히 같아 제품 검증을 재사용하며 최종 PR base는 main으로 갱신한다. 착수 당시 stacked 계획과 원래 capture source SHA는 역사 기록으로 보존한다. 독립 QA에서 확인한 목록 실측1280×720·Asia/Seoul 요약 정정 후 새 후보 검토로 진행한다.

## Issue #502 — 실제 Error Boundary·확대·배포 환경 검증 보완

최신 main `c94b13e110ed5fd9e17625daa084c181f35703e8` / application `0.95.1`에서 `test/issue-502-error-boundary-validation`을 최신 main 기준으로 재정렬한다. #457의 source-only 공백 중 자동화 가능한 root/gantt-demo 실제 React error boundary, keyboard retry와 focus restore를 server-gated non-production E2E probe로 구현한다. #457 geometry/provenance helper는 `evidenceScope=502`를 추가해 tracked evidence를 기본 덮어쓰지 않는다.

PR CI #2076.1은 ESLint의 effect 내부 동기 state update, #457 evidence literal fallback 회귀, reset 뒤 probe focus restore 실패로 FAIL했다. 보완은 recovery state를 timer callback으로 전환하고 recovered button을 새 key로 재마운트해 `autoFocus`로 focus를 복원하며, #457/#502 기본 evidence output을 각각 literal 경로로 유지한다. 실패 assertion/gate는 완화하지 않는다.

제품 인증/API/DB/scheduling 및 #490/#491 기능 범위는 변경하지 않는다. version은 `0.95.1`을 유지하고 release_required=false / release_authorized=false로 취급한다. native125% 실제 browser zoom, 실기기/screen reader/최종 수동 UX, 승인 운영 배포 source SHA/application version/proxy 비교는 GitHub-hosted CI로 대체하지 않으며 환경 후속 [#517](https://github.com/planner77/masterGantt/issues/517)에서 NOT TESTED/BLOCKED로 관리한다.

PR #516의 이전 exact head `ada3420df6d2018cec187c8b42103b843fb1c87b`는 PR CI #2078.1/#2079.1 SUCCESS다. Generic Finalizer가 no-release merge 후 #502를 자동 close하므로 CI로 대체할 수 없는 환경 검증을 #517로 분리했다. #517 이관 문서가 반영된 새 head에서 required PR CI와 독립 리뷰를 다시 통과한 뒤 #502를 병합/Main CI/finalize하고, #517은 OPEN으로 유지한다.


## Issue #520 — 동일 merge SHA 중복 Main CI evidence 선택

#502 finalize를 막은 duplicate Main CI 사례를 corrective한다. baseline은 main `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab`, application `0.95.1`, branch `fix/issue-520-duplicate-main-ci-evidence`다. application/runtime 계약은 바꾸지 않는 CI/Lifecycle orchestration fix이므로 version `0.95.1` 유지, release_required=false / release_authorized=false다.

`auto_release_finalizer.py`는 exact immutable SHA의 successful Main run을 보존하고, `issue_lifecycle.py`는 그 successful run의 main artifact gate까지 확인한다. PR latest-check 정책, GHCR immutable overwrite 거부, failed/cancelled run 보존 정책은 유지한다. `verify-issue-lifecycle.py`에 success→later failure와 all-failure 회귀를 추가한다.

#520이 main에서 SUCCESS하면 Generic Finalizer가 backlog의 #502를 다시 평가해 Main #2083.1의 valid success evidence를 사용할 수 있어야 한다. #517 환경 검증은 별도 OPEN 상태를 유지한다.
