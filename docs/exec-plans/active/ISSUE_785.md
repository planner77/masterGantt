# Issue #785 — 물류 실물 직접 모델과 레거시 무손실 호환

## 실행 계약

- Primary Issue: https://github.com/planner77/masterGantt/issues/785
- baseline main: `427d22245fb8e11254b2424ea5147ccbd5766979`, version `0.130.1`.
- branch: `feat/issue-785-retire-logistics-target`; 작업 경로 `/home/planner/Dev/masterGantt-785`.
- 승인: 2026-10-23 사용자 요청의 분석·설계·구현·문서 동기화·미해결 리뷰/충돌 처리·실패 원장·PR CI 시작까지. Issue의 최초 등록 한정 문구는 이번 명시 요청으로 이 범위에서 대체된다. CI 완료 모니터링·병합·main/GHCR·tag/release·Issue 종료·branch 정리는 제외한다.
- phase: PR_READY (비파괴 P1/P2 후보). ANALYSIS → DESIGN → IMPLEMENTATION → LOCAL_VALIDATED → DOCUMENTATION_SYNC를 수행했으며 PR CI 시작을 인계한다. 전체 Issue 수용 완료는 아니다.
- risk_level: HIGH; qa_required: true; qa_method: OWNER_MANAGED. 레거시 관계·공유 집계·외부 API/교환·전 화면 영향. 실제 별도 전문 Agent 구현과 읽기 전용 사전 설계를 사용한다. 독립 인간 QA/Owner 승인은 NOT TESTED이며 Agent 검토와 구별한다.
- manager_decision: NOT TESTED; MERGE_READY: BLOCKED. 정확 Head Required Quality/E2E8/Docker·Trusted QA·리뷰 스레드 0·Owner HIGH 위험 수용은 후속이다.
- version_decision: MINOR `0.131.0` (공개 기능·버전 경계 전환); release_required: true; release_authorized: false. 정식 게시 승인이 아니다.
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION. Sub-Agent의 GitHub 댓글/PR 게시 금지.
- 관련 완료 #723/#725/#726/#728~#737/#762는 재개방하지 않는다. 진행 #720/PR721은 문서 지침 5파일이며 제품 /manual은 아직 없다. 해당 공유 문서의 방향을 보존하되 미병합 PR을 임의 통합하지 않는다. 다른 열린 CI/진단/과거 Milestone PR은 본 범위가 아니다.

## 소유권과 API freeze

| 담당 | 쓰기 범위 | 제외 |
| --- | --- | --- |
| backend | 물류 계약/서비스/Target route 퇴역/보안 inventory·관련 integration 및 내부 legacy E2E seed | resource domain·export·UI·문서 |
| domain | resource/WBS 계약·domain·server resource/repository·공개 v2 직렬화/쿼리 및 테스트 | 물류 writer·UI·교환 |
| frontend | src/features 및 UI 소비자·UI Unit/E2E | server·domain·DB·문서 |
| exchange | exports, Copy, Template, task-target-transfer 및 관련 계약/테스트 | UI·resource math·문서 |
| ui_ux | 읽기 전용 설계·구현 비교 | 모든 파일 쓰기 |
| Manager | Work Packet·문서·version·통합·게시 조정 | 승인 없는 merge/release |

동일 파일 동시 쓰기 금지. 공용 계약 변경은 담당 간 shape를 먼저 합의한다. 구현 Agent는 다른 Agent의 변경을 되돌리지 않는다.

## P0 생산자 → 소비자 지도

| 경로/원본 | 소비자 | 결정 |
| --- | --- | --- |
| Target 전용 collection/detail/usage/impact, task target-bindings | 구형 UI/외부 호출/E2E fixture | 공개 쓰기·전용 조회는 기존 auth/Origin/session/If-Match를 보존한 410; 테스트 legacy 작성은 내부 fixture로 이동 |
| logistics_targets/members, task_target_bindings/members; resolver | WBS ledger·Resource·Task links·Copy/Template | 원본 읽기 호환 유지; DDL DROP·과거 migration 수정·자동 flatten 없음 |
| Task direct logistics-links/process-context | Task Editor·물류 관리 | 실제 Equipment/System ID + opaque 출처·scope/selection/coverage 호환 읽기 추가; 직접 writer와 분리 |
| Equipment/System 수정 전 영향 확인 | 관리 sourceImpact dialog | 전용 Target API 대신 canonical Task 영향·실물 이름 경계로 전환 |
| WBS ledger/resource KPI | 6개 dashboard·정확 drill·Plan·Excel | 기존 계산·T0/A/R·full Gate·고유 ID 합집합 보존. 신규 v2는 실물 용어/DTO, v1은 명시적 deprecated 읽기 경계 |
| navigation/screenKey/preset | workspace·복귀·숨은 panel | dashboard.target→dashboard.process, master.targets→master.processes. 폐기 UI mount/fetch/버튼 0 |
| project-logistics-unified/resource-target-views | 공정/설비/System 조회 | 기존 WBS physical view renderer 재사용; Target 축·필터·진단 제거 |
| Task Editor/리소스 상세/KPI/Plan/Excel 버튼 | 공개 UI·aria·empty/error/help | 실물 원본·출처·정확 Task/Assignment를 표시; 원본을 허위 미연결로 표시 금지 |
| Excel writer | OOXML 사용자 시트·필터·근거 | 실물·Task/Assignment canonical ID와 불투명 관계 참조 보존; Target 사용자 축 제거 |
| Copy/Template v2~v5 | 지원 구형 파일/전체 프로젝트 복제 | 내부 archive 그래프는 무손실 재매핑·원자 복사; dangling 원본은 전체 실패. 신규 직접 모델에서 그래프 자동 생성0 |
| JSON1.1/일정 Excel | 교환 | 기존 표현 범위·명시적 손실 방지 실패 유지; 임의 지원 확대0 |
| docs/user manual 인계 | 사용자/운영자/#720 | 현행 실물 업무 안내와 호환 감사 이력을 구분; 미구현 /manual을 구현됐다고 안내하지 않음 |

일반 용어 allowlist: JS EventTarget/event.target, anchor target, AssignmentTarget, WBS/dependency source/target, DOM/좌표 target, OOXML Relationship Target 속성, 과거 migration·archive 내부 식별자. 일괄 개명하지 않는다. 최종 정적 목록은 `docs/evidence/issue-785`에 보강한다.

## 표현 차이와 보존 설계

| 입력 | after | 손실 방지 |
| --- | --- | --- |
| 신규 Target0/직접 연결만 | 동일 공정/구역/Equipment/System 직접 원본 | Task/Assignment/숨은 그룹 생성0 |
| legacy-only/혼합 | 실물 유효 ID 합집합 + 모든 관계 출처 | 직접 연결과 동명·동일 ID 구별, 중복 count0 |
| whole/구성원 추후 변경 | 내부 whole 해석 유지·실물별 읽기 | 현재 멤버를 정적 직접 행으로 flatten 금지 |
| subset+coverage | 선택한 실제 member·coverage/source 유지 | ACS-only를 AMR로 확대 금지·quantity를 공수에 곱하지 않음 |
| Summary self/subtree/다중 조상 | sourceTaskId/scope/inherited별 provenance | 상속을 직접 원본처럼 편집/복제하지 않음 |
| 비활성/공통/공유 Fleet·System/cross-process 구역 | canonical UUID와 실제 관계 그대로 | 이름 추론·복제·자동 owner 재귀속0 |
| 비정상 FK/해석 불가 | 명시 오류·원본 보존·전체 rollback | 빈 자료/부분 성공으로 치환 금지 |

기존 직접 관계만으로 whole의 동적 행위/coverage를 완전 표현할 수 없으므로 DB 변환을 수행하지 않는다. P1 읽기 전용 내부 호환 계층은 승인된 전략이다. 레거시 출처 자체의 안전 편집이 제공되지 않은 부분은 AC4 예외/잔여 작업으로 명시하고 완료를 주장하지 않는다. 신규·기존 Task 직접 추가/편집은 기존 canonical writer로 계속 제공한다. 운영 DB 실제 건수·외부 소비자 0·backup/restore는 NOT TESTED이며 임의 완료 처리하지 않는다. 파괴적 P3 정리는 Owner 승인·소비자0·backup/재시작·source 비교 이후 별도다.

## 검증·문서 Gate

AC1: producer-consumer 정적 목록·allowlist. AC2/8: UI 제거·old screen/preset·DOM/aria/network·5폭/keyboard/focus. AC3: Target0 실제 HTTP/SQLite/restart. AC4/5: legacy golden/원시 ID·coverage·T0/A/R·중복0·정확 drill/Plan/Excel. AC6: 410 및 기존 401/403/409/412/auth 원자성. AC7: Copy/Template/JSON fail-closed·restart/rollback·원본 count. AC9: ADD/EXTEND/KEEP_UNIQUE/RETIRE 판단과 실제 실행을 구분. AC10: 아래 docs + Required3/Trusted/Owner 후속.

TEST_LIFECYCLE_REVIEW: 기존 #623/#725/#726/#728~#737/#762 fixture 검색 후 변경 대상은 EXTEND, whole/subset/coverage/security/SQLite/실제 browser/OOXML은 KEEP_UNIQUE. 폐기 UI만을 요구하는 기대는 RETIRE_CANDIDATE로 기록하고 실물 동등 보호로 대체하며 skip으로 숨기지 않는다. 신규 통합 사례는 ADD; 겹치는 숫자검증은 PARTIAL_OVERLAP로 보호경계 유지.

Required docs: DESIGN, REQUIREMENTS, ARCHITECTURE, PROJECT_UX, TASK_EDITOR, UI_UX_GUIDELINES, LOGISTICS_DOMAIN_DESIGN, LOGISTICS_TARGETS, LOGISTICS_DASHBOARD, RESOURCE_KPI_DASHBOARD, TARGET_RESOURCE_USER_GUIDE, TARGET_RESOURCE_OPERATIONS, API, DB_SCHEMA, SECURITY, ISSUE_27_PROJECT_COPY, JSON_IMPORT/IMPORT_SCHEMA, EXCEL_EXPORT, TEST_PLAN, CHANGELOG, PLAN. Manager가 실제 최종 계약 기준으로 갱신한다. CI/Required8/main/GHCR/Finalizer·Scheduling/SVAR writer 정책 불변은 N/A 근거를 남긴다.

Local Pre-PR fast/targeted: source 동결 후 실행, 최초 오류/미실행/환경 한계를 실패 원장에 기록한다. 공식 원격 PASS와 구별한다. 운영 DB/Windows Excel·DRM/실물 proxy/storage/native 보조기기는 별도 NOT TESTED.

## 구현 중 추가 인벤토리와 경계

- 정적 baseline은 `docs/evidence/issue-785/producer-consumer-baseline.json`의155파일·line/symbol 목록이다. 실행 소비자0의 증거가 아니며 일반 target allowlist와 별도다.
- integrated KPI는 UI 제거만으로 configuration.targets/diagnostics/taskRows의 폐기 엔터티 정보가 남아 공개 경계v2 대상으로 추가했다. Resource/Group 배정의 일반 targetId/targetName은 식별 의미가 달라 보존한다.
- 독립 qa_docs가 실제 SQLite로 shared resource snapshot의 dangling FK inner JOIN 누락을 재현하여 명시 오류·원본불변 회귀를 추가한다. 새 실물 usage의 nosniff/UUID/graph-response budget도 사전 검토로 보완한다.
- 공개 v2는 내부 계산 DTO에 대한 중립 직렬화/검증 adapter이며 완전히 독립된 모든 필드의 명시v2 타입 체계로 재작성한 것은 아니다. 기존 snapshot/source/예산 검증을 보존하며 이 설계 한계를 기록한다.
- Excel opaque archiveReference는 원본 UUID를 감사 참조로 보존할 수 있다. 도메인 이름/선택/축의 비노출과 UUID bytes의 전면 제거를 구분한다. 참조를 삭제하여 무손실 추적성을 깨지 않는다.

## 현재 문서 동기화

DESIGN의 Product Terminology/Workspace를 갱신하고 REQUIREMENTS·ARCHITECTURE·PROJECT_UX·TASK_EDITOR·UI_UX_GUIDELINES·LOGISTICS_DOMAIN_DESIGN·LOGISTICS_TARGETS·LOGISTICS_DASHBOARD·RESOURCE_KPI_DASHBOARD·WBS_TASK_LEDGER·API·DB_SCHEMA·SECURITY·Copy·JSON_IMPORT/IMPORT_SCHEMA·IMPORT_EXPORT·EXCEL_EXPORT·TEST_PLAN·사용자/운영 가이드·CHANGELOG·PLAN을 갱신한다. 사용자 가이드는 현행 실물 업무로 재작성하고 기존 보조 UI 안내를 제거한다. 내부 도메인 문서는 현행 경계와 호환 역사 우선순위를 명시한다.

N/A: AGENTS/QA_REVIEW_POLICY/ISSUE_LIFECYCLE은 현행 권한·Owner 정책 적용으로 변경 없음. CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS는 Required3/8shard/Trusted/main/GHCR/Finalizer·canonical trace 불변, 실행 결과만 Packet/PR로 인계한다. SCHEDULING_ENGINE은 알고리즘/SVAR writer 미변경. DEPLOYMENT는 DDL·Compose·image 실행 계약 불변이며 운영 실측은 NOT TESTED. `/manual` route/아이콘·registry는 진행 #720의 미구현 제품 범위로 새 구현을 주장하지 않는다.

## 사전 검증 실행 준비·자동 선택 경계

Pre-PR fast 실행은 sourceStable=true이나 자동 매핑 UNKNOWN28 때문에 BLOCKED(내부검사0); targeted dry-run은 NOT TESTED다. 이는 새 scope의 자동선정 미지원이며 실제 tests나 Required3의 성공이 아니다. 공용 selector/정책을 바꾸지 않고 Manager의 수동 영향 매핑으로 다음을 별도 실행한다.

- 전체 TypeScript/ESLint와 Vitest: 공개 계약/공통 snapshot/서비스·fixture가 넓게 변하므로 순수Domain·handler·SQLite·Copy/Template/OOXML·transport 및 간접 소비자를 한 후보 source에서 확인한다. 개별 Agent PASS를 단순 합산하지 않는다.
- production build: 새 route/서버 dependency·standalone/runtime tool 경계를 확인한다. Docker/GHCR는 원격 후속이다.
- 선택 Chromium: 변경된 실제 HTTP/SQLite 실물/레거시·Resource API와 UI, v2 mock5spec/KPI request-state, 공정·Task 직접 연결 및 Target0 종단/공유 fixture 음성 소비자를 포함한다. 실제 결과/제외는 반환 원장에 남긴다. 전체139spec은 원격8shard의 별도 gate다.
- Next 생성 next-env.d.ts/tsconfig 및 기존 output 증거의 실행 중 변경은 별도 원본 복원/새 이슈 증거 보관으로 구분하며 기존 역사 artifact를 덮어써 게시하지 않는다. 제품/테스트 source digest를 시작/끝 대조하고 실제 source 수정 시 관련 검증을 다시 수행한다.

독립 qa_docs의 사전 검토는 FK 손상409·subset anchor/empty source·실제 출처 공정/WorkArea 보존·W2 직접 선택 불변을 실제 SQLite에서 확인했다. 이 범위의 PASS는 최종 브라우저/전체 Required/독립 인간 QA/Owner 승인과 별개다.

## DOCUMENTATION_SYNC

- `README.md`: UPDATED
- `DESIGN.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/WBS_TASK_LEDGER.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/TARGET_RESOURCE_OPERATIONS.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/ISSUE_27_PROJECT_COPY.md`: UPDATED
- `docs/JSON_IMPORT.md`: UPDATED
- `docs/IMPORT_SCHEMA.md`: UPDATED
- `docs/IMPORT_EXPORT.md`: UPDATED
- `docs/EXCEL_EXPORT.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/WBS_CROSS_FEATURE_ACCEPTANCE.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/SCHEDULING_ENGINE.md`: N/A(일정/Calendar/Dependency 알고리즘과 SVAR writer 불변)
- `docs/CI_CD.md`: N/A(Required3/8shard/Main/GHCR/Finalizer 정책과 workflow 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 gate·출처·승인 정책 불변, 실행 결과는 본 Packet/PR에 구분)
- `docs/GITHUB_OPERATIONS.md`: N/A(canonical PR/Issue trace·권한·운영 정책 불변)
- `docs/DEPLOYMENT.md`: N/A(DDL/Compose/런타임 배포 계약 불변, 운영 검증은 NOT TESTED)
- `AGENTS.md`: N/A(현행 지침 적용, Next 자동 생성 변경은 정확 base로 복원)
- `docs/QA_REVIEW_POLICY.md`: N/A(OWNER_MANAGED/Owner HIGH 승인·Trusted 정책 불변)

## AC_TEST_COVERAGE

- AC1: `docs/evidence/issue-785/producer-consumer-baseline.json`의 pinned155파일 지도, 본 Packet의 소비자/allowlist와 추가 KPI 경로. 정적 인벤토리는 외부 소비자0 증거가 아님.
- AC2: `tests/e2e/logistics-target-authoring.spec.ts`, `issue-624-logistics-unified.spec.ts`, `issue-621-resource-target.spec.ts`, `tests/features/project-workspace-navigation.test.ts` — DOM/aria/네트워크/구screen·저장상태·폐기UI0; 실제 결과는 아래 실행원장.
- AC3: `tests/e2e/issue-725-process-workareas.spec.ts`, `issue-726-logistics-master.spec.ts`, `issue-726-task-logistics.spec.ts`, 기존 `issue-737-target0-acceptance.spec.ts`; `tests/server/resources/issue-737-cross-feature-acceptance.test.ts` — 직접 모델·HTTP/SQLite/restart·Task0/구역0.
- AC4: `tests/server/logistics/task-target-bindings.test.ts`, `tests/server/resources/resource-public-v2.test.ts`, `tests/server/projects/issue-785-exchange.test.ts`, `tests/e2e/logistics-target-authoring.spec.ts` — whole/subset/coverage125/상속/공유/원본불변/실물출처문맥; 레거시 출처 자체 편집은 읽기 전용 미구현이므로 전체 AC4 미완료.
- AC5: `tests/domain/wbs-task-ledger-acceptance.test.ts`, `tests/server/resources/issue-623-canonical-acceptance.test.ts`, `issue-622-target-plan-excel.test.ts`, `tests/e2e/issue-622-resource-plan-target.spec.ts`, `issue-623-resource-mvp.spec.ts` — T0/A/R·공유5/AMR15·선택80/전체140·full Gate/정확 상세/OOXML.
- AC6: `tests/server/logistics/task-target-bindings.test.ts`, `tests/server/projects/edit-authorization-handlers.test.ts`, `tests/server/resources/resource-public-v2.test.ts`, 기존 bindings/Target handlers — 401/403/428/412→410·공개 writer0·권한/원자성·invalid source409/예산422. 외부 소비자 수/종료일은 NOT TESTED.
- AC7: `tests/server/projects/issue-785-exchange.test.ts`, `task-target-transfer.test.ts`, `issue-623-target-transfer-acceptance.test.ts`, `tests/server/templates/logistics-template-graph.test.ts`, `tests/server/db/issue-623-target-migration.test.ts` — archive 원형·FK/원본 count·원자 rollback·JSON1.1지원 불변·재시작. 운영/off-host restore/P3 파괴종료는 NOT TESTED.
- AC8: 위 실제 Chromium 실물/Resource/KPI·5폭·Tab/Escape/focus·long-name/readonly/stale/dirty·canonical불변과 `tests/features/resources/physical-connection-sources.test.ts`/`resource-physical-filters.test.ts`. 모든 상태×5폭·실제 보조기기/native125%·최종 수동 UX는 NOT TESTED.
- AC9: 본 TEST_LIFECYCLE_REVIEW와 `docs/TEST_PLAN.md` #785 영향표 — ADD/EXTEND/KEEP_UNIQUE/RETIRE 대체·skip/timeout/gate완화0. Pre-PR 자동선정 BLOCKED는 별도 유지.
- AC10: 본 DOCUMENTATION_SYNC·사용자/운영 가이드·CHANGELOG·최종 링크 검사와 Head별 Required Quality/E2E8/Docker·Trusted·Owner HIGH 승인 인계. 원격/Manager ACCEPT는 NOT TESTED, main/GHCR/Finalizer는 범위밖.

## TEST_LIFECYCLE_REVIEW

ADD는 중립v2 계약/실물출처·필터·손상FK/교환 통합 Unit/Integration, EXTEND는 기존Task/Resource/WBS/Copy/Template·브라우저 mock 네트워크 계약이다. whole/subset/coverage/self/subtree·보안·실제HTTP/SQLite·OOXML·정확Assignment/공동담당자·5폭·Gantt 보존은 KEEP_UNIQUE다. 폐기된 authoring/tree/matrix의 UI 기대만 RETIRE_CANDIDATE로 종료하고 실물/보존출처 보호로 대체한다. 기존 사례수를 유지하며 skip으로 없애지 않는다. 역사테스트3SKIP은 기존 파일의 조건이고 이번 변경으로 추가하지 않았다.

## 최종 Local Fast Feedback·인계

제품/테스트1187파일 보완 동결 digest는 `b3bbe49b69a460507610310f4cc8fcae42c4d234bb30efaab068e3e5bcea45a6`다. 마지막 관찰/fixture 수정3개E2E만 달라진 최종1187파일 digest는 `23438f2d7a5622a4682de10e2686a9229ea53edee74ad93a773c6a399dfa5dca`, 제품 전용 digest는 `4577a92488bf6420dd108616270a8752d2189046fd8ddd4a066520a07c3c3b82`다. 원격 commitSHA는 PR/Issue STATUS의 등록 영수증으로 인계한다. 실제 파일별 대조·명령/판정은 [정제 영수증](../../evidence/issue-785/local-validation-receipt.json)을 따른다.

| 검증 | 실제 결과 | 경계 |
| --- | --- | --- |
| 전체 Vitest | 276파일 PASS/기존1파일 SKIP, 3250 PASS/기존3 SKIP | 보완 제품source 기준, 마지막3E2E만 수정·Unit source불변 |
| TypeScript | PASS | 제품전체 + 마지막테스트교정 typecheck PASS |
| 전체 ESLint | PASS, 0errors/기존10warnings | 경고6파일 baseline불변; 마지막변경E2E lint0 |
| Production Build | PASS | isolated .next-prepr/standalone/runtime-tools; Docker/GHCR 대체 아님 |
| 발견 | PASS, 277Unit files/806browser cases, root·externalcwd 동일 | 기존139E2Espec/8shard 배치 불변 |
| 첫 실제Chromium | 30PASS/5FAIL, 35cases/10spec·16.3분 | 최초제품/fixture실패 보존 |
| 확대 실제Chromium | 64PASS/8FAIL, 72cases/19spec·13.1분 | 실패는testcontract3·index증거수집ENV5, 제품source/focus 보완 PASS |
| 복구 실제Chromium | 9/9PASS·2.2분 | 위8실패+인접Taskcontext1; 제품변경0, 3E2E관찰/입력교정 |
| 선택 고유73case | PASS(64 bounded재사용 + 9복구) | 단일최종source 전체73동시실행 결과가 아님. 실제HTTP/nativeSQLite·mock·5폭/원본ID/권한·공수·OOXML을 case별 구분 |
| Pre-PR 자동선정 | BLOCKED; 내부검사0 | UNKNOWN 자동매핑은 수동검증PASS로 바꾸지 않음. 최종 보고서는 아래 링크로 인계 |
| 독립 Agent pre-QA | 비파괴P1/P2범위 PASS | 인간QA/QA_FINAL/Owner/Manager ACCEPT 아님 |
| quality/e2e8/docker·Trusted·Owner | NOT TESTED | PR CI 등록까지만 진행; 결과 모니터링 없음 |

마지막3E2E는 #621의 정확 선택영역 locator, #623의 실제PUT pending/200 관측gate, #726의 실제fixture변수 인자다. 제품파일 변경0을 대조하여 기존64PASS 중 변경없는case만 제한 재사용했다. 최초실패와 source/환경 차이는 [단일 실패 원장](../../ISSUE_785_FAILURE_ANALYSIS.md)에 남긴다. 실제OS/브라우저·명령·stdout/JSON 원문은 로컬 `/tmp/issue-785-*`와 `.prepr-reports`에 보관하고 Git에는 정제영수증과 선택 화면만 추가한다.

Task Editor/기존출처·공정/WorkArea·3상위탭·구screen/저장상태·5폭 readonly/keyboard/overflow는 첫 동결후 실제실행했다. 최종보완은 Resource출처/row펼침과 테스트계약이므로 해당경로를 추가 재검증했다. 범위밖 전체139spec과 모든상태×5폭은 로컬PASS로 확대하지 않는다. 두 화면 [390px](../../../output/playwright/issue-785/review/physical-archive-390.png), [1440px](../../../output/playwright/issue-785/review/physical-workspace-1440.png)는 최초source f2e38a4d의 PASS사례 첨부를 보존한 것으로 해당Task/탐색제품경로는 이후보완에서 불변이다.

## 실제 실행·잔여 승인 경계

Main Manager가 docs/version/통합을 담당하고 backend·domain(scheduler)·frontend·resource_ui(frontend)·exchange(backend)·ui_ux·qa_docs·infra를 실제 별도 Sub-Agent로 실행했다. ui_ux/qa_docs는 읽기 전용이며 구현 Agent 자체검증과 분리했다. 역할의 model/effort 구성값을 실제 제공자 runtime model 검증으로 과대 표시하지 않는다.

qa_docs는 orphan JOIN/anchor·공정/구역 참조·KPI노출·잘못된projection·출처누락을 실제SQLite에서 독립 재현·보완 확인하고 최종복구로그를 검토했다. 검토는 비파괴P1/P2후보의 PR준비범위다. **AC4 레거시출처 자체 안전편집은 NOT IMPLEMENTED/미충족이며 Owner 예외승인도 없다.** 운영DB실측·외부consumer0/종료일·off-host backup/restore·WindowsExcel/DRM·실물보조기기는 NOT TESTED, 파괴적P3는 별도승인gate다. 이PR은 전체Issue완료/QA_FINAL/MERGE_READY가 아니며 Issue를 자동종료하는근거로 사용하지 않는다. release_authorized=false; Owner후속범위결정·Required3/Trusted·HIGH위험수용 전 병합/릴리스/종료 없음.

Source 용어 allowlist에는 사용자 입력 이름/설명의 원문도 포함한다. 제품의 폐기 affordance와 달리 사용자 자료의 일반 단어를 일괄 치환하거나 Task이름/설명을 무단변경하지 않는다. UI시스템 용어·선택·Target엔터티 source노출을 제거하며 일반AssignmentTarget/EventTarget·OOXML Target·기술archive식별자는 각계약대로 유지한다.

## 게시 직전 자동선정·문서 최종 영수증

[최종fast](../../evidence/issue-785/prepr-publish-fast.json)는BLOCKED/exit1·sourceStable=true·selection108/UNKNOWN28/missing0/내부step0다. [최종targeted계획](../../evidence/issue-785/prepr-publish-targeted.json)은dry-run NOT TESTED/exit0·자동선정BLOCKED다. [28producer 수동영향매핑](../../evidence/issue-785/manual-impact-mapping.json)은관련Unit/실제HTTP·SQLite/브라우저·음성소비자와선택근거를기록하며자동상태를바꾸지않는다. 최종Markdown315파일링크·version0.131.0·unstaged/staged diff검사는PASS다. artifact추가후docs지문은달라져도기록된제품/테스트1187파일bytes는불변이다. 공개v2/보존legacy·safe편집미구현·Owner gate의의미검토는자동문서구조검사와구분한다.

## PR #787 REWORK — Full #3187.1 (2026-10-24 KST)

- **Evidence:** [Run 39975107608.1](https://github.com/planner77/masterGantt/actions/runs/39975107608) / shard5 Job 120488909192. #719 KPI Mock이 공개 `logistics-kpi/2` 직렬화 누락으로 버튼 readiness 검증에서 직접 실패. 나머지 7개 Chromium shard 취소/Required E2E·Automated QA 파생 FAIL이며 Quality·Build·Docker 성공. 정확 분류와 원본 보존: [이슈별 실패 원장](../../ISSUE_785_FAILURE_ANALYSIS.md#pr-787--최초-원격-full-pr-ci-실패-f785-001-2026-10-24-kst).
- **Change scope:** 테스트 Fixture 2개(`issue-719-contextual-help.spec.ts`, `fixtures/task-editor-density.ts`)의 공개 KPI Mock을 `toResourcePublicV2`로 통일; Task Editor Fixture의 요청 시점 필터 echo도 맞춘다. #785의 제품/API/DB/데이터 이관·집계·UX 변경0. `TEST_LIFECYCLE_REVIEW`: #719 geometry/help/accessibility `EXTEND`, 공통 Editor Fixture `EXTEND`, 기존 v2 negative/request-state `KEEP_UNIQUE`; `AC_TEST_COVERAGE`의 AC2/8/9/10을 동일 수용표로 유지.
- **검증 계획:** 이 환경의 로컬 npm/Chromium/Docker `NOT TESTED`. 새 exact Head에서 Policy·TypeScript·ESLint·Vitest·PR Build·Chromium E2E8/8·Docker·QA 필수. 앞선 11PASS/다른 7 shard 취소를 전체 성공으로 소급하지 않음. 미해결 리뷰0·main 충돌 없음은 수정 전 조사, 커밋 후 재확인. Owner HIGH 수용·Trusted QA·레거시 안전 편집 AC4·외부소비자/운영 DB 미검증과 release_required=true/release_authorized=false, MERGE_READY=BLOCKED 유지. CI 시작 후 모니터링/병합/GHCR/Finalizer/Issue 종료 제외.

## PR #787 REWORK F785-002 — Full #3192.1 (2026-10-24 KST)

- 직접 Policy Audit 취약 `zod@4.6.2` / `GHSA-mrhx-c7xc-m3w5`; Run 40028478592 Job120670771956. Fast Gate에 의해 E2E8·Docker·PR Build 미실행, Required3/QA 파생 FAIL. F785-001 E2E와 독립 기록.
- `package.json`/lock의 정확 Zod4.6.7 단일 패치+SRI metadata, immutable Gantt capture의 `approved-zod-4.6.7-lock.json` 메모리 정규화, 기존 prepr-verifier 테스트 6개 negative cases 보완. README/SECURITY/TEST_PLAN과 단일 실패 원장 동기화. 다른 도메인·정식 DB·API·Next/SVAR/CI Gate 변경0.
- AC6/9/10 보호: 보안 경계, 기존 test lifecycle EXTEND/KEEP_UNIQUE, 명시 문서 영수증. 실제 `npm ci`/`npm audit`/전체 Vitest/Chromium8/Docker는 네트워크·의존성 부재로 로컬 NOT TESTED; 새 exact HEAD PR CI/Trusted/Owner에서 판정. HIGH/OWNER_MANAGED, AC4/운영 DB·외부 소비자·Owner HIGH 승인 미충족, release_authorized=false/MERGE_READY=BLOCKED. 병합/Main/GHCR/Finalizer/Issue 종료 및 새 CI 모니터링 제외.

