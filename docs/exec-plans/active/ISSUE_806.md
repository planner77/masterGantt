# Issue #806 — 리소스 대시보드 R1/R2/R3 종단 통합 수용

## Issue Work Packet

- repository: `planner77/masterGantt`
- issue: [#806](https://github.com/planner77/masterGantt/issues/806); children [#807](https://github.com/planner77/masterGantt/issues/807), [#808](https://github.com/planner77/masterGantt/issues/808), [#809](https://github.com/planner77/masterGantt/issues/809); geometry [#800](https://github.com/planner77/masterGantt/issues/800)
- lifecycle_phase: REWORK_R01 / DOCUMENTATION_SYNC_READY / PR_CI_START_PENDING (prior Full #3311.1 QA Preflight failed)
- requested_scope: 기존 R1/R2/R3 구현의 최신 main 종단 대조 → 기존 E2E 교차 계약 최소 보강 → 수용 증거·문서 갱신 → Ready PR Full CI 시작. 이후 모니터링·병합·Main CI·GHCR/Release·Finalizer·Issue 종료 제외.
- baseline/main: `73901d7eb86a734e1017df04efa0ba26c5abbb45` (2026-10-26 KST, Issue #809/PR #814 교정 포함)
- branch: `feat/issue-806-resource-epic-integration`
- current_version: `0.135.1`; candidate_version: `0.135.1`
- version_decision: 이미 병합된 앱 동작·API·DB·시각 CSS를 수정하지 않는 **기존 E2E assertion 및 검증 문서만** 변경; 제품 버전·lockfile 불변, formal release N/A.
- risk_level: HIGH
- risk_reason: Resource 기본/동적/Plan/차트 peer 간 동일 원본과 숨은 요청 경계를 확인하는 실제 HTTP/SQLite Chromium 통합 시나리오. 제품 소스·CI 정책은 비변경이나 전체 E2E 비용·정확성 영향.
- qa_required: true
- qa_method: OWNER_MANAGED
- independent_qa: N/A (OWNER_MANAGED; 이 작업에서 별도 독립 QA 실제 수행 증거 없음)
- manager_decision: NOT TESTED; MERGE_READY: BLOCKED
- release_required: false
- release_authorized: false

## 현행 분석 / 결정

#806은 2026-10-25 등록 당시 하위 제품 구현의 상위 Epic이었다. 착수 현재 #807 단일 Workspace, #808 canonical Resource read model, #809 세 차트/정확 drill-down, #800 Geometry 검증은 각각 이슈가 종료되어 main에 관련 기능이 존재한다. 재구현·새 SQL 저장소·PRO Resource load·retired Logistics Target 복원은 불필요하거나 금지된다. 이번 독립 구현 단위는 **같은 개인/Project 원본이 peer 전환에 따라 조용히 달라지지 않는 교차 assertion**과 Epic의 종단 검증 계약을 완성하는 것이다.

참조 우선순위: [DESIGN.md](../../../DESIGN.md) → [기존 리소스 분석·계약](../../RESOURCE_KPI_DASHBOARD.md) → [Project UX](../../PROJECT_UX.md) / [UI UX Guide](../../UI_UX_GUIDELINES.md) → [Test Lifecycle](../../TEST_PLAN.md) / [Issue Lifecycle](../../ISSUE_LIFECYCLE.md). 기존 KPI가 양호한 기준이며 compact/flat/이름 우선/상시 설명 최소화 원칙을 유지한다.

## 설계 / 변경 경계

- 제품 기능은 그대로 보존: 기본 현황, 동적 Resource root, Milestone 교차, Resource Plan, 견적·Excel, 기간 투입/업무 집중/기여 분포 차트; 원본 Task/Assignment·일정 이동/복귀는 기존 gateway만 사용.
- 개별 보고서의 검색/기간/Group/Role/grade/filter는 의미가 다른 독립 scope를 유지한다. 명시적 기간 인계만 허용하며 각각 다른 projection/filter의 snapshot ID나 M/D와 M/M을 억지로 동등 비교하지 않는다.
- 기존 `tests/e2e/issue-736-resource-dashboard.spec.ts`의 #807 단일 Workspace 실제 브라우저 시나리오만 EXTEND: 기본 진입에서는 차트 조회0, 미필터 Resource 동적 조회 응답을 붙잡아 실제 canonical Task/Assignment IDs와 nonempty fixture를 확인, 차트 peer의 첫 실제 report에서 같은 두 고유 ID 집합 일치, 차트를 숨기고 Resource Plan으로 복귀하면 원래 표/DOM과 요청 억제 보존. 비교는 peer의 동일 unfiltered Project 출처에 한정. 다른 조건의 snapshot을 같다고 가정하지 않는다.
- 제품 TSX/CSS, 서버/권한/원장/Calendar, public contract/DB, Excel writer, Gantt Core, dependency, package/lock, workflow·샤드·timeout·retry·Required check는 **변경하지 않음**.
- 최신 main은 #809 corrective 0.135.1이다. 역사적 #807(화면0.133.3)·#809(화면0.134.0)의 관측을 현재 0.135.1 동일 source 실행으로 위장하지 않는다.

## AC_TEST_COVERAGE

- AC1: E1 before/after KEEP inventory: #807 Workspace five widths, #808 source model, #809 chart15 and KEEP5, #800 KPI six-view geometry30. Source/history/provenance inventory in [Epic acceptance](../../ISSUE_806_EPIC_ACCEPTANCE.md); new HEAD actual Chromium NOT TESTED.
- AC2: E2 single default Resource peer and KPI/legacy compact baseline: #807 existing browser test and geometry; #809 KEEP evidence. Current source will be verified in required CI.
- AC3: E3 canonical Task/Assignment/Resource Group Role Grade Milestone physical pivot, Plan/Capacity and non-additive T0/null/partial/overload: #808 Domain and #809 HTTP SQLite Plan goldens KEEP_UNIQUE.
- AC4: E4 chart/table/Plan/export and exact original navigation: #807 existing Playwright E2E EXTEND unfiltered dynamic-chart canonical Task/Assignment ID sets and inactive chart no-fetch; #809 drill/401/412/80-versus-140 and #736 Excel separate evidence.
- AC5: E5 geometry at 390/768/1024/1440/1920, focus/keyboard/stale/error/readonly: #807 peer, #809 chart, #800 five-width baseline; actual 0.135.1/new Head and native125%/screenreader NOT TESTED.
- AC6: E6 documentation and gate: updated this Work Packet, Epic source provenance and single [failure ledger](../../ISSUE_806_FAILURE_ANALYSIS.md); resource KPI existing guide link. Required3 Chromium8 Trusted QA/Owner blocked until new Head verified.

## TEST_LIFECYCLE_REVIEW (#711)

- 사전 검색: `tests/e2e/issue-736-resource-dashboard.spec.ts`의 #807 기본/동적/Plan 동선 및 #809 차트 실제 원본, `issue-730-view-composer.spec.ts`(#800 viewport/keyboard), `cross-screen-regression.spec.ts`(타 화면 교차), `resource-plan-dashboard.spec.ts`, `resource-excel-export-dashboard.spec.ts`, `resource-drill-ui.spec.ts`, `tests/domain/resource-analysis.test.ts`, `tests/server/resources/wbs-dashboard-views-http.test.ts`. 상세 계약은 각 #807/#808/#809/#800 Work Packet.
- EXTEND: 기존 #807 **한 테스트** 안에 원본 ID 집합 동등성·기본 숨은 차트 no-fetch·전환 뒤 no-fetch 검증을 추가. 새로운 종단 E2E 파일이나 중복 fixture를 만들지 않는다.
- KEEP_UNIQUE: #809 차트 세 유형/80↔140/T0/복귀·401/412, #808 Domain/Snapshot, #736 HTTP·Plan·Excel/OOXML, #800 Geometry, #517 native125%/실기기. HTTP/SQLite/보안/이벤트 경계를 CSS 또는 순수 unit PASS로 대체하지 않는다.
- PARTIAL_OVERLAP: #807 peer 전환과 #809 차트 동선은 상호 중복처럼 보이지만 각각 고유한 전환 수명/분석 provenance·원본 상세 위험을 검증한다. 공통 #800 측정은 재실행 없이 새 수치로 합성 금지.
- ADD: 없음. CONSOLIDATE_CANDIDATE/RETIRE_CANDIDATE: 없음. Existing assertion/skip/retry/timeout/8-shard/Required3 완화·제거 없음.
- 실행 범위: GitHub 연결로 source/테스트/문서 감사 및 파일 수정. 이 환경에서 동일 source Next+Chromium/HTTP/SQLite·Vitest·tsc 전체와 실제 브라우저를 실행하지 않았으므로 **LOCAL NOT TESTED**, remote Ready PR Full CI 새 Run이 첫 정확 Head 검증이다. PR CI 시작만 하며 완료 감시는 수행하지 않는다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_806.md`: UPDATED
- `docs/ISSUE_806_EPIC_ACCEPTANCE.md`: UPDATED
- `docs/ISSUE_806_FAILURE_ANALYSIS.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/TEST_PLAN.md`: N/A(기존 Test Lifecycle 정책과 실제 테스트 선정 근거 유효; 이번 보완은 이슈 식별자와 기존 E2E 한 테스트에 대한 문서 계약 복구)
- `docs/PROJECT_UX.md`: N/A(제품 UX 및 원본 드릴다운 계약 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 density keyboard focus 지침 변경 없음)
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: N/A(사용자 조작과 릴리스 범위 변경 없음)
- `DESIGN.md`: N/A(기존 Workspace first와 KPI 기준의 Delta B C 세부 검증만 보완)
- `docs/API.md`: N/A(공개 read contract 수정 없음)
- `docs/DB_SCHEMA.md`: N/A(DB 원장 migration 변경 없음)
- `docs/ARCHITECTURE.md`: N/A(아키텍처와 persistence 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(Excel writer와 출력 계약 변경 없음)
- `AGENTS.md`: N/A(기존 실패 원장과 QA 지침 그대로 준수)
- `package.json`: N/A(앱 version 0.135.1 유지)
- `package-lock.json`: N/A(dependencies와 lock version 변경 없음)
- `tests/e2e/issue-736-resource-dashboard.spec.ts`: UPDATED

## CI/QA·후속 게이트

PR은 Ready, canonical Issue #806의 metadata `risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `qa_required: true`, `release_required: false`, `release_authorized: false`를 명시한다. 생성 직전 최신 main/다른 #806 PR·source/tree를 검증하고, PR 후 미해결 리뷰/mergeability 및 Full CI 등록을 확인한다. 현 시점 Required Quality/Chromium8/Docker·QA Final/Trusted/Owner 수용·실제 native125%/screen reader/Windows Excel은 **NOT TESTED**다. CI 모니터링, 병합, release, Issue 종료는 이후 별도 사용자 승인으로 진행한다.

## REWORK_R01 — Full PR CI #3311.1 QA Preflight 직접 실패 (2026-10-26 KST)

- 원본: [Run #3311.1 · 40268435859.1](https://github.com/planner77/masterGantt/actions/runs/40268435859), PR #815, Head `0812598bab7a8e99d42034815ee549866b353bb1`, Base `73901d7eb86a734e1017df04efa0ba26c5abbb45`, test merge `e325c042a82ee5a712c3cad82ecb5628ee6e5578`.
- 최초 직접 원인: Job `121395890824` base `scripts/qa_preflight.py` / `ISSUE_AC` FAIL. #806의 E1~E6은 정확한 수용 범위지만 parser는 `AC1` 등 표준 식별자만 탐색한다. 정책 우회 대신 이슈의 `AC1(E1)~AC6(E6)` 별칭을 추가하고 E1~E6 체크 미완료 보존.
- 파생 결과: Fast Gate, Required Quality/E2E/Docker, QA Final automated FAIL; TypeScript/Lint/Vitest/Next build/E2E8/PR Docker implementation은 SKIPPED/NOT RUN. 역사 실패는 FAIL로 보존. 더 자세한 집계·Artifact는 [단일 실패 원장](../../ISSUE_806_FAILURE_ANALYSIS.md).
- 원본 실패로 아직 실행하지 않았던 DOC_SYNC도 정적 감사에서 위험을 확인: 기존 `AC_TEST_COVERAGE`의 E1 table 및 `DOCUMENTATION_SYNC`의 `ADDED`/비정규 N/A는 main `qa_final_automated.docs_gate`가 요구하는 `- AC1:` 및 경로별 `UPDATED / N/A(reason)` 형식과 불일치. **실제 별도 CI 실패로 계수하지 않고** 이번 보완 묶음에서 선제 정합화.
- TEST_LIFECYCLE_REVIEW: 기존 #807 #809가 공유하는 `tests/e2e/issue-736-resource-dashboard.spec.ts` 한 사례 EXTEND 유지. #808 Domain·#736 Plan/Excel·#800 Geometry 및 기존 401/412/snapshot exact return KEEP_UNIQUE. 새 assertion/test/skip/timeout/retry/CI policy 변경 없음. 지역 Node/Chromium/SQLite/Docker 결과 NOT TESTED.
- 원격 기존 Head는 main behind0 / mergeable=true / review thread0, Codex summary findings0 (정확 새 Head의 human/Trusted QA 승인 아님). 새로운 Ready Head 게시 직전에 다시 확인. 현재 Gate MERGE_READY=BLOCKED, release_required=false, authorized=false. 새 PR CI는 시작까지만 확인하고 병합·Main/GHCR/Finalizer/이슈 종료/CI 모니터링 없음.
