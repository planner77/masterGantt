# Issue #785 — 물류 실물 직접 모델과 레거시 무손실 호환

## 실행 계약

- Primary Issue: https://github.com/planner77/masterGantt/issues/785
- initial baseline main: `427d22245fb8e11254b2424ea5147ccbd5766979`, version `0.130.1`.
- current validation base for #793: `96d97d12d0502bdc725daedae7dfd9be0090c4d3`, version `0.131.0` (앞선 #787의 실패 Main merge). 초기 #785 P1/P2 검증 base `4ce403a1e410ca599a780446f39513e1f1158326`와 구분한다.
- branch: `feat/issue-785-retire-logistics-target`; 작업 경로 `/home/planner/Dev/masterGantt-785`.
- 승인: 2026-10-23 사용자 요청의 분석·설계·구현·문서 동기화·미해결 리뷰/충돌 처리·실패 원장·PR CI 시작까지. Issue의 최초 등록 한정 문구는 이번 명시 요청으로 이 범위에서 대체된다. CI 완료 모니터링·병합·main/GHCR·tag/release·Issue 종료·branch 정리는 제외한다.
- phase: PR_REWORK(F785-009). 기존 #787 원본과 F785-001~008 이력 보존, #793 Full #3220.1의 문서 Gate 실패와 P1 review의 Resource Report worksheet 오선택 교정. 새 수정 HEAD의 Required3/Trusted는 NOT TESTED, Main/GHCR/Finalizer 대기.
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
- `docs/IMPORT_SCHEMA.md`: N/A(후속 PR793은 JSON 및 Excel 가져오기 스키마 무변경이고 리소스 보고서 단위 테스트만 교정)
- `docs/IMPORT_EXPORT.md`: N/A(후속 PR793은 교환 출입력 포맷과 서버 writer 로직에 변화가 없고 Excel Unit 검증 접근만 교정)
- `docs/EXCEL_EXPORT.md`: N/A(후속 PR793은 Excel 작성기와 공개 metadata 행 계약 불변이고 기존 테스트의 worksheet 조회 위치만 교정)
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

이 절은 최초 게시 Head `0a33b6ab`의 역사적 결과다. 현행 REWORK 후보의 결과는 마지막 F785-004 절과 단일 실패 원장을 따르며, 이 숫자를 새 후보 PASS로 재사용하지 않는다.

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
- `package.json`/lock의 정확 Zod4.6.7 단일 패치+SRI metadata, immutable Gantt capture의 `approved-zod-4.6.7-lock.json` 메모리 정규화, 기존 prepr-verifier 테스트 6개 negative cases 보완. README/SECURITY와 단일 실패 원장 동기화; 기존 TEST_PLAN 정책은 수정 없이 적용. 다른 도메인·정식 DB·API·Next/SVAR/CI Gate 변경0.
- AC6/9/10 보호: 보안 경계, 기존 test lifecycle EXTEND/KEEP_UNIQUE, 명시 문서 영수증. 실제 `npm ci`/`npm audit`/전체 Vitest/Chromium8/Docker는 네트워크·의존성 부재로 로컬 NOT TESTED; 새 exact HEAD PR CI/Trusted/Owner에서 판정. HIGH/OWNER_MANAGED, AC4/운영 DB·외부 소비자·Owner HIGH 승인 미충족, release_authorized=false/MERGE_READY=BLOCKED. 병합/Main/GHCR/Finalizer/Issue 종료 및 새 CI 모니터링 제외.

### 게시 무결성 보완 — docs/TEST_PLAN.md

대용량 `docs/TEST_PLAN.md` fetch 결과 내용이 0으로 제한되어 보충 섹션만 기록된 중간 커밋 `f7235d5`의 문서 누락을 원본 Git blob `1d2b679dda6730306d8f6586ba3921a9458d4e9f` 복원으로 바로 교정한다. 기존 Test Lifecycle 정책은 수정 없이 준수하며 #785별 AC9/TEST_LIFECYCLE_REVIEW 추가 분석은 본 Packet/누적 실패 원장에서 추적한다. 손상 HEAD CI 결과는 최종 source 증거로 이용하지 않는다.

## PR #787 REWORK F785-003 — Full #3195.1 Chromium 원본 ID 확인 회귀 (2026-10-24 KST)

- **Evidence:** [Run 40030302113.1](https://github.com/planner77/masterGantt/actions/runs/40030302113) / Shard2 Job120680499345, `issue-734-equipment-dashboard.spec.ts:231` UUID 표시 단언 실패. Policy/Typecheck/ESLint/Vitest/Build/Docker SUCCESS; shard 7개 취소, E2E/QA 파생 FAIL. 이전 F785-001/002는 불변 별도 기록.
- **Contract conflict:** #785의 공개 Logistics Target 폐기와 #717의 공유 인스턴스 정확 원본 ID를 이름 다음 **안전한 확인 단계**에서 조회할 수 있어야 한다는 기준을 동시에 만족해야 한다. `DESIGN.md` 1.3 및 `docs/ISSUE_717_IDENTITY_INVENTORY.md` 적용. ID를 상시 1차 제목으로 다시 보이게 하지 않고 기존 `IdentifierDetails` disclosure 재사용.
- **Change:** 공유 설비/System `previewInstanceEdit` 검증된 kind/ID를 일시적 확인 state에 전달하여 `변경 대상 식별 정보`에서 타입별 원본 ID를 조회·복사. #734/#735 기존 E2E 시나리오를 `EXTEND`해 실물명·실제 Task 사용처 숫자(전체1/직접1/기존0), 폐기 Target 문구0, 정확 UUID on-demand, 취소/dirty·실제 PATCH·snapshot·focus를 보존. 추가 중복 spec/skip/timeout/CI 수정0.
- **AC_TEST_COVERAGE:** AC2(UI Target0 및 원본 확인), AC4(legacy 출처 Count 보존), AC6(usage API kind/entityId/권한·revision/PATCH), AC8(이름·접힘/키보드/focus/5폭), AC9(TEST_LIFECYCLE_REVIEW: #734/#735 EXTEND, 기존 #717/#725/#726·보안/SQLite KEEP_UNIQUE), AC10(이슈별 failure 원장·Packet). UI 외 서비스·DB·Gantt Core·SVAR·Zod 패치 변경 없음.
- **Validation/gates:** 변경 source의 로컬 Node/Playwright/Docker 실행 NOT TESTED(현재 GitHub 연결 환경). 다음 exact Head Full Quality + Chromium8/8 + Docker/Trusted QA를 새 `synchronize` CI에서 인증. 미해결 리뷰0/main 병합 가능은 변경 전 확인이며 새 Head에서 재확인. Owner HIGH 수용, AC4 legacy 안전 편집·운영 DB/외부 consumer 미검증, release_authorized=false/MERGE_READY=BLOCKED 유지. 병합/Main/GHCR/Finalizer/Issue 종료 및 CI 모니터링 범위 밖.

## 2026-10-24 REWORK F785-004 — 전체 실패 이력 기반 재개

- 시작 remote/local Head=`14a2be51c421eaab0f7f1f4004f4fe222dea21d7`, baseline/main/base=`427d22245fb8e11254b2424ea5147ccbd5766979`, 현재 test merge=`322734a1ea8bbaffc89ed876f337d76cbab748f4`. 기존 로컬0a33에서 원격4후속commit을 fast-forward한 뒤 작업한다.
- infra `/root/publish_pr`가 Full5회/각attempt1 및 CANCELLED28shard 로그·실제 실패·immutableHead/base/merge·리뷰0/mergeabletrue를 독립 수집했다. #3194는 Run CANCELLED이나 취소 전 #734 UUID 실제FAIL이 있어 누락하지 않는다. [정제 영수증](../../evidence/issue-785/ci-cumulative-rework-20261024.json), [단일 실패원장](../../ISSUE_785_FAILURE_ANALYSIS.md)의 전체 Run/Attempt·Cross-run 매트릭스가 현행이다.
- 과거 bot no-findings는 초기0a33 code_review에 한정하고 security_review=null·현재Head승인이 아니다. 새후보 PRE_QA와 공식Owner/Trusted/Required를 구분한다.
- 최신3197.1의 shard2 Job120685901338 step7은 #734 dirty/PATCH case line231의 expected초기설비명 대 actual긴설비명 불일치다. frontend `/root/frontend_impl` 단일writer는 **원본 전체spec 순서**를 먼저 실행하며 red/상태조건을 확인하기 전 제품/테스트를 고치지 않는다. 원래 이름·정확canonicalID·pending/dirty·취소·PATCH/revision/snapshot/focus 보호를 낮추지 않는다.
- Manager는 원장/Packet·영향분석/실행영수증·PR본문/Issue STATUS를 소유한다. qa_docs `/root/qa_review`는 실제 별도 read-only 누적/후보 사전검토, infra는 원격출처와 최종 명시GO후 branch 게시를 소유한다. 파일동시쓰기/독자댓글·무승인rerun 없음.
- 누적 browser 실패8spec와 인접 #735/identifier/density 소비자를 검색한 뒤 bounded case집합으로 검증한다. exact원본실패case와 causal순서를 누락하지 않고 1~2batch로 분리하며 같은최종source를 유지한다. 전체Suite 무조건 반복이나 단독case PASS만으로 순서회귀 해소를 주장하지 않는다. Zod audit 및 historical capture/prepr Unit음성도 별도로 확인한다.
- TEST_LIFECYCLE_REVIEW: 기존 #734/#735 actual 시나리오는 EXTEND·KEEP_UNIQUE(오라클/fixture의 실제상태 의미 확인 후 변경), 이전KPIv2/보안/HTTP·SQLite/OOXML·historical snapshot은 KEEP_UNIQUE. 신규상시spec·skip·timeout/retry·Required/8shard·신뢰정책 변경 없음.
- DOCUMENTATION_SYNC 추가범위: 원장/Packet/실제정제증거와 PR본문 최신Head·한계/검증; 제품/API/DB/사용자가이드 변경 여부는 실제교정 영향 후 판단한다. TEST_PLAN#697/#711·현행QA정책은 재사용하며 과거1MB문서 본문을 파일조회결과 일부로 덮지 않는다.
- version0.131.0/HIGH/OWNER_MANAGED/qa_required=true, release_required=true/release_authorized=false와 AC4 legacy관계 자체편집 NOTIMPLEMENTED·Owner예외없음을 유지한다. 새 quality/e2e8/docker·Trusted/QA_FINAL·Owner ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED. 종료점은 새PR CI 시작이며 모니터링·병합/Main/GHCR/Release/Issue종료 제외.

### F785-004 확정 교정과 동결 검증 선정

원본full#7348은7PASS/1FAIL4.8분, 단독dirty도동일이름으로1FAIL하여원격증상을재현했다. canonical PATCH name와dialog name·exactID는일치하고seed반환f.name만초기값이라TEST_CONTRACT로확정했다. usage에는name필드가없다. 기존#734seed의최종canonicalGET sameID DTO반환·editor초기name엄격확인만교정하고제품/공용fixture/735변경0이다. 첫단독green1/1뒤의추가guard를포함한최종source에서32case를검증한다.

TEST_LIFECYCLE_REVIEW는#734기존actual8 EXTEND·원래이름/ID·dirty/PATCH/revision/focus보존, #735기존F003교정6 KEEP_UNIQUE, 이전실패13·identifier/density/v2음성5 KEEP_UNIQUE다. 신규spec/skip/timeout/Required/8shard변경0. 정확A/B선정/discovery·제외근거와코드/테스트·생성config차이·최종결과는단일실패원장과영수증에연결한다. 전체checkout sourceStable/자동Pre-PR PASS를주장하지않으며자체Next생성config는복원후정적검사를다시실행한다.

문서영향: 원장/Packet·실제정제evidence/PR본문만갱신한다. 이번교정에제품계약변화가없어DESIGN/PROJECT_UX/API/DB/SECURITY/TEST_PLAN 정책내용은추가수정N/A(기존PR의이전갱신이력과현행기준은유지)다. 1MB TEST_PLAN 원본/과거섹션을부분조회결과로덮어쓰지않는다.

### 최종 검증 후보 출처(로컬 회귀 완료)

최종 #734 spec SHA256은 `fcfa8253a808096cca79f73faa7ab262874974acda5d374f2b9cac7b8e40db16`, 제품 관리 컴포넌트는 변경 없는 `91731b0b3dc37fe1a05d193b3e198a9423082a0e3357ac914c0595b4811a529e`. tracked src/tests/scripts와 package/lock·static runtime-tool config(문서 제외)1128파일 내용 지문은 `0e413386703ac3ae1a143e31340fcf141b842b3ad6d4e1db55fffe1bb4976aef`. Next 생성2config는 별도 전후hash로 보고하며 전체checkout 불변으로 주장하지 않는다.

역사capture Unit4파일40PASS와 운영dependency audit0은 독립로그/sourcehash를qa_docs가 대조했다. browser A21/21(9.3분)+B11/11(4.2분), 고유32/32 PASS·중복/skip/flaky/retry0이다. [최종 영수증](../../evidence/issue-785/rework-browser-final.json)에 원래 #7348·#7356 및 직접/인접/음성 소비자와 source 지문을 보존한다. 생성config·과거 screenshot/evidence는 브라우저 종료 후 HEAD로 복원했다. [정적검사](../../evidence/issue-785/rework-static.json)는 typecheck PASS·전체 lint PASS(error0/warning10)다. 새 [자동fast](../../evidence/issue-785/rework-prepr-fast.json)는 BLOCKED/exit1·selection109/UNKNOWN30/missing0/step0이며 자동 실행 내부 sourceStable=true다. 이는 browser 전체checkout sourceStable=false와 다른 실행이며 수동32PASS로 BLOCKED를 대체하지 않는다. 기존28수동map에 증가한density fixture는 browser density2/KPI wire로, Zod허용fixture는 역사capture/prepr Unit4로 추가 매핑했다. #490/#491/viewport·나머지전체E2E와 AC4 안전편집/운영 검증은 NOT TESTED로 남긴다. 새Head Required/Trusted·Owner 수용은 NOT TESTED다.


### F785-004 독립 사전 검토와 인계

실제 별도 `/root/qa_review`는 구현 파일을 수정하지 않는 read-only 검토로 원본 red·same-case staleDTO 원인·엄격한 교정·누적 실패 이력·동결 browser32/Unit40/audit0·정적검사·문서/출처를 대조해 **PRE_QA=PASS, 미해결 지적0**을 반환했다. 이는 이번 보완의 PR 게시 준비 범위이며 정식 인간 APPROVED·Trusted QA·Owner HIGH 위험 수용 또는 전체 Issue ACCEPT가 아니다. 새 Head Required3/Trusted/QA_FINAL·Owner ACCEPT는 NOT TESTED, AC4 미구현/예외 승인 없음·release_authorized=false·MERGE_READY=BLOCKED를 유지한다. 마지막 원격 lease/리뷰/충돌 확인 후 기존 PR #787의 단일 새 Head synchronize Full CI 등록까지 인계하고 완료 결과는 모니터링하지 않는다.


## GIT-BASE-002 — 게시 직전 main 이동과 실제 충돌 통합 (2026-10-24 KST)

원격 쓰기 전 최종 lease에서 main이 기존 `427d22245fb8e11254b2424ea5147ccbd5766979`에서 #556/PR #786 merge `dd7f4d86db06e8a10b8c86b5412ed319154011e0`으로 이동했음을 발견했다. PR Head는 `14a2be51c421eaab0f7f1f4004f4fe222dea21d7` 그대로였고 PR API base 갱신이 지연되어 실제 main ref와 교차 확인했다. candidate object·본문·ref 원격 쓰기는 모두0인 상태에서 게시를 중단했다. 로컬 사전 후보 `e49e397b8be9eff483ec1906256b579c3b7f63d1`의 PRE_QA/32browser/40Unit/audit0은 **기존 base에 한정**하며 새 merge source의 PASS로 전용하지 않는다.

새 main의59파일에는 일정 상단·조회 버튼/모달 배경 geometry·관련 UI 회귀와 동일 Zod4.6.7·historical capture 보호가 포함됐다. `git merge --no-commit --no-ff origin/main`으로 실제15개 충돌을 확인했다. 문서9개는 두 Issue의 독립 요구사항·검증·보안 경계를 함께 보존하고 README의 동일 Zod 설명만 통합했다. package/lock 및 capture/allowlist/prepr5개는 infra, #621 E2E1개와 자동 merge된 shared UI 검토는 frontend가 소유하며 Manager가 문서를 담당한다. 이전 source의 테스트/증거를 삭제하지 않는다.

TEST_PLAN은 이전 원본 blob `1d2b679dda6730306d8f6586ba3921a9458d4e9f`를 유지했던 단계 이후, 새 main의 #556 섹션을 **전체 파일 기반으로 추가 통합**한다. 이는 다시 발생한 대용량 부분조회 덮어쓰기 손상이 아니다. 전체 기존 본문과 #785 영향표·#556 density/조회 회귀를 모두 유지하며 새 최종 blob은 통합 영수증으로 판정한다.

새 동결 source에서 충돌 해소·정적/역사Unit·#734/#735·공유 UI·#621 교차 회귀 및 별도 PRE_QA를 다시 판정한다. 원격 Required/Trusted/Owner·AC4 안전편집·release 권한과 CI 시작까지만이라는 범위는 불변이다.


### 새 main 통합의 영향·회귀 계획

문서9충돌은 양쪽 Issue 섹션을 합쳐 해결했다. package/lock은 새 main과 앱 version0.131.0만 다르고 기존 #785 HEAD 내용과 동일하다. [infra 충돌 영수증](../../evidence/issue-785/rework-main-infra-resolution.json)은 allowlist의 신뢰 moduleURL·Zod exact5metadata와 양쪽 negative 합집합·불변 snapshot 보존 및 통합된 역사Unit4파일40PASS를 기록한다. 보안 패치/앱 minor 결정을 서로 덮어쓰지 않는다.

새 main이 변경한 shared workspace/CSS·#621 이름/조회·Gantt geometry 소비자 때문에 기존32를 새 source에서 반복하고 #556 직접영향18을 더해 고유50case/두 bounded batch로 검증한다. 추가18은 canonical-projection metadata의5폭×Day/Week10(기존원격768Day 실패 포함), modal-feedback1(엄격 box equality), filter-toolbar1, empty-summary2, resource-drill-ui2, workspace5181, hierarchy3991이다. 최초 원격 실패·인접 readonly/empty/selection/범위·focus·peer/geometry 보호를 포함하며 skip/timeout/retry/shard를 바꾸지 않는다. 새 UI 설계·px개선 실측을 주장하지 않고 main 과거실측과 새 합병 교차회귀를 분리한다. 의미있는 UI 교정이나 actual geometry FAIL이 추가되면 그때 capture/영향 확대를 판단한다.

통합 중 이전 HEAD 대비 staged diff검사에서 새 main에 이미 있는 #556 원장/Packet의 EOF 빈줄2건을 관측했다. 이는 base 유입 문서로 보존하며 현재 PR 기준 `git diff --check origin/main`은 충돌 union의 SECURITY 끝 빈줄 정리 후 PASS다. Markdown317파일 링크·version0.131.0 검사도 PASS다.

새 main 통합 후 실제 discovery는 A27/9files+B23/10files, 고유50case/18spec·중복0이다. 초기 source manifest는 HEAD `e49e397b8be9eff483ec1906256b579c3b7f63d1` + MERGE_HEAD `dd7f4d86db06e8a10b8c86b5412ed319154011e0` 상태에서1128파일 digest `45e587eb3b73f4fe3aefed0a1cd2c918b14346d1fb8a935605bcf1ca6d7964f3`를 고정했다. 배치·명령·case별 결과·생성config의 전후차이는 /tmp/issue785-post-main-*에 이전32와 분리해 보존한다. 실행 중에는 전체PASS를 주장하지 않는다.

### 새 main 통합 Batch A 결과

[통합 A 영수증](../../evidence/issue-785/rework-post-main-browser-a.json)은 **27/27 PASS(12.5분), skip/flaky/retry0·exit0**이다. 기존 누적 실패/설비 전체8/System 전체6·실제HTTP/SQLite 재시작까지 검증했다.1128파일 scoped digest45e587eb3b73f4fe3aefed0a1cd2c918b14346d1fb8a935605bcf1ca6d7964f3은 전후 동일하고 Next 생성config2개의 차이는 별도 fullCheckoutSourceStable=false로 보존했다. B23은 동일 frozen source로 이어 실행하며 전체50 최종 판정은 실행 종료 후 기록한다.

### 새 main 통합 최종 browser 결과와 정적 검사 인계

[통합 최종 영수증](../../evidence/issue-785/rework-post-main-browser-final.json)은 **A27/27(12.5분)+B23/23(3.0분), 고유50case/18spec·중복/skip/flaky/retry0·exit0**다. [B 영수증](../../evidence/issue-785/rework-post-main-browser-b.json)의 #570 metadata5폭×Day/Week10(768Day 포함)·modal 엄격 box equality·toolbar/empty/readonly/peer·범위/계층·공용density 음성까지 통과했다. 이전32를 재사용한 결과가 아니다.

네 A/B 시작/종료의1128파일 digest는 `45e587eb3b73f4fe3aefed0a1cd2c918b14346d1fb8a935605bcf1ca6d7964f3`로 동일하며 실행 후 현재파일도 전부 일치한다. 새 UI 수정은 없었으므로 별도 px개선/capture 주장을 추가하지 않는다. fullCheckoutSourceStable=false인 Next 생성config2개의 변경은 그대로 기록했다. 종료 후 자동생성 AGENTS/config·과거 추적이미지/측정자료는 **merge index 기준**으로 복원했고 새로운 raw output은 /tmp에 보존했다. main에서 유입된 #556 역사증거를 HEAD 기준으로 지우거나 새785증거로 덮지 않았다. 복원 후 최종 정적검사·현재base 자동fast·별도 PRE_QA는 아래 최종 영수증으로 인계한다.

### 새 main 통합 최종 정적·자동선정 영수증

[복원 후 최종 정적검사](../../evidence/issue-785/rework-post-main-static.json)는 typecheck PASS/exit0·전체 ESLint PASS/exit0(error0/기존 warning10), Markdown317파일·version0.131.0·현재main대비 diff PASS다. TEST_PLAN 최종 blob은 `5edc20685005d8877d160059e5fff9ba46c3bac0`(1,083,528bytes)이며 main대비 #785 섹션21줄 추가/삭제0로 기존 전체본문과 #556 섹션을 보존한다. 역사capture Unit4파일40/40PASS(1.47초)의source5개도 최종bytes와 일치한다. 운영audit0은 package/lock bytes가 이전 실행과 완전히 같은 입력에만 재사용하며 새 통합browser50은 별도 실제 실행이다.

통합 main을 실제 부모로 가진 로컬 merge commit `66c49810bee4cd794231057351556273d3ee9b73`에서 [새 자동fast](../../evidence/issue-785/rework-post-main-prepr-fast.json)를 실행했다. base는 `dd7f4d86db06e8a10b8c86b5412ed319154011e0`, **BLOCKED/exit1·selection109/UNKNOWN30/missing0/내부step0·sourceStable=true**다. 증가2경로 density fixture/Zod allowlist와 기존28 수동영향표를 유지하고 CLI미등록 상태를 수정하지 않았다. 이후 문서/정제영수증만 보완하며 runtime/test/lock/tools1128 지문은 그대로다. 정식 새Head Required3/Trusted/QA_FINAL·Owner ACCEPT/AC4 안전편집은 미충족이며 MERGE_READY=BLOCKED다.

### 새 main 통합 PRE_QA 및 게시 판정

구현자와 분리된 실제 read-only `/root/qa_review`는 새 통합 source·원문/정제50case 전수·18spec 합집합·1128파일 네 지문·역사Unit40·정적검사·docs_gate 구조 및 의미·문서/PR초안을 대조해 **PRE_QA=PASS, 미해결 지적0**을 반환했다. 검토한 로컬 merge66c49810의 코드/테스트/lock/tools는 이후 문서·판정 stamp만 보완하는 최종 tree와 동일하다. 초기 e49의 이전32/PRE_QA를 새 source에 재사용하지 않았다.

이는 PR 게시 준비의 사전 검토이며 정식 새Head Required Quality/E2E8/Docker·default-branch Trusted/QA_FINAL·Owner HIGH 위험 수용·전체 Issue ACCEPT를 대체하지 않는다. AC4 안전편집 NOT IMPLEMENTED/READONLY·Owner예외없음, release_required=true/release_authorized=false·MERGE_READY=BLOCKED를 유지한다. 마지막 원격 main/head lease·review thread·test-merge 출처를 확인해 기존 PR787 본문1회·Head1회 반영 후 새Full CI 시작만 확인하고 모니터링하지 않는다. 새Run/Attempt·Head/base/testmerge는 Issue STATUS에 기록한다.


## 2026-10-24 REWORK F785-005 — 성공 Task 물류 mock 계약 누락

[단일 누적 원장](../../ISSUE_785_FAILURE_ANALYSIS.md#f785-005--full-32041-task-editor-물류-snapshot-계약-누락-2026-10-24-kst)이 기존6Full·초기 local 실패·새원본/가설/반례·확대선정의현행기록이다. [3204.1 정제증거](../../evidence/issue-785/ci-40040333641-attempt-1.json): Headf03933cb16c6c99a1a35a3095b55b6158d69bab5/base dd7f4d86db06e8a10b8c86b5412ed319154011e0/testmerge c442e7c6da33c5a7f92bac038bdddbe36f1cda96, shard2job120710326907step7의project-task-editor #461 checkbox30초FAIL(67PASS/1FAIL/25NOTRUN). 다른7cancelled로그추가testFAIL0·QualityDockerPASS, E2E/QA파생FAIL이다. artifact는metadata만조회하여Trusted출처PASS를주장하지않는다.

수정전원본 exactscenario가같은red였고 standalone이라선행67case가필수원인은아니다. taskId/master정상·links GET200에도projectRevision/compatibilityLinks누락을trace허용필드로확인했다. 두필드만보완한통제green1/1(2.9초/전체6.2초)로TEST_CONTRACT를확정했다. 기존F001KPIv2/ID/staleDTO교정과다른실제실패로모두보존한다.

동일누락소비자3곳(project-task-editor override·task-link-load-safety helper·task-editor-density helper)을일괄교정하고optionalDTO누락방지를성공전용Required<Pick> 타입으로확인한다. 기존density2case 중 물류 geometry1case는 정상dataready/error0을 확인하도록EXTEND하고 keyboard1case는 그대로 유지한다. 이전50의geometryPASS는원래assertion범위로보존하되정상물류load실증으로확대하지않는다. 제품guard/API/DB/UI계약완화0, 의도malformed/task/revision/permission·권한/지연/readonly음성은유지한다.

TEST_LIFECYCLE_REVIEW: #461기존7 EXTEND·safety12 KEEP_UNIQUE/성공fixture EXTEND·density2 EXTEND; 원장초기9실패spec·System·identifier/KPI음성·HTTP/SQLite·main18 KEEP_UNIQUE다. 신규상시case/spec/skip/timeout/retry/CI8·Required3변경0. 이전50을새source로재실행하고#4617+safety12+#726나머지2를더해71unique/20spec두batch로선정한다. 실행전최종71/PRE_QA는NOT TESTED.

문서영향은원장/Packet/정제source·PR/Issue STATUS갱신이다. 현재교정은성공mock/oracle에한정되어제품API/DB/보안/UX/TEST_PLAN정책내용은추가수정N/A(현행계약/이전갱신보존)다. 1MB TEST_PLAN blob5edc20685005d8877d160059e5fff9ba46c3bac0는덮지않는다. 새Head·동결지문·실제결과/자동UNKNOWN·자동 생성 config차이와독립사전검토를기록한후원격Head1회반영한다. 마지막main/headlease·미해결thread/충돌과새FullRunID+attempt/head/base/testmerge를재확인한다. Manager ACCEPT/Trusted/Required3·AC4 안전 편집/Owner예외없음·MERGE_READY BLOCKED/release_authorized=false는그대로이며CI시작후모니터링/병합/정식게시/Issue종료는하지않는다.

### F785-005 성공 생산자 감사와 동결

별도 qa_docs의 [정적 생산자 감사](../../evidence/issue-785/rerun2-f005-producer-audit.json)는 endpoint 참조17파일과 DTO 배열필드 검색·가져오는stateful fixture를 교차 확인했다. 성공 GET 생산자는 정확3곳이며 현재 revision/compatibility 배열/필수 타입 검사가 모두 있다. 검색범위에서 남은 성공producer metadata누락은0이다. 의도한 오류·요청0인 redirect목적지 응답·실제HTTP/GET전달·PUT gate/오류 주입·관측 helper는 성공생산자에서 제외한 이유를 함께 기록했다. 정적 감사 PASS는 runtime71/PRE_QA를 대체하지 않는다.

최종4파일 외 제품/API/DB/CI/공용 DTO 변경은0이다. frontend의 typecheck·변경4파일 ESLint·diff PASS 후 실제 discovery A36/10spec+B35/11spec, case중복0·고유71/20spec을 고정했다. `tracked src/tests/scripts + package/lock/static runtime-tool configs`1128파일(문서 제외) SHA256은 `60648b89a19a29597390a5a015d1f8dc23176408ddfdb050c6b7df7b6180d776`이다. /tmp/issue785-rerun2-final-selection.json 및 before/after-source·원문/정제batch 결과는 이전50과 다른 prefix로 보존한다. 테스트 생성config는 별도 전후 hash로 보고하며 실행 종료·복원 후 최종 정적검사/자동fast/사전검토를 기록한다.

### F785-005 실행 목록 재조회 범위

[새 원격 이력 조회](../../evidence/issue-785/rerun2-history-requery.json)는 branch의12/12 Run(Full6+advisory6)과 알려진6Head 각각의pull_request Run2/2를 별도 조회했다. per_page100 첫 페이지에 total_count 전부가 반환됐고 알려진6Full의 최신attempt는 모두1이었다. 이 조회범위의 pagination 누락/권한오류0이며 추가Full/attempt는 없었다. 과거5회의 immutable merge부모·직접/취소28로그 **내용**은 이전 정제영수증을 재사용했고, 목록·Head·최신attempt는 이번에 새로 대조했다. 신규3204의 direct/취소7로그는 새로 읽었다. 조직전체/Trusted workflow나 artifact payload 검증까지 완료했다고 확대하지 않는다.

### F785-005 최종 Batch A 결과

[동결 A 영수증](../../evidence/issue-785/rerun2-browser-a.json)은 **36/36 PASS(14.2분), skip/flaky/retry0·exit0**이다. 원본실패#461(최종본문3.2초)을 포함한 group7개·#7348·#7356·#726전체3·이전누적실패/HTTP·SQLite 재시작을 같은후보에서 검증했다. runtime/test/lock/tools1128파일 지문60648b89a19a29597390a5a015d1f8dc23176408ddfdb050c6b7df7b6180d776이 시작/종료 동일함을 확인했다. Next 자동생성2config 차이는 별도로 기록해 fullCheckoutSourceStable=true로 확대하지 않는다. B35는 같은 source로 진행하며 전체71/최종PRE_QA/새원격결과는 아직 NOT TESTED다.

### F785-005 최종 검증 영수증

[최종 browser](../../evidence/issue-785/rerun2-browser-final.json): **A36/36(14.2분)+B35/35(3.7분)=71/71 PASS,20spec·중복/skip/flaky/retry0·exit0**다. 원격실패#461 group7과safety12·#726전체3, 이전누적9실패spec·System·identifier/KPI·main18을 같은최종source에서검증했다. 새정상dataready/빈목록·물류연결저장활성·로드오류0을확인한5폭geometry도통과했으며기존keyboardcase/의도negative는유지됐다. [B 영수증](../../evidence/issue-785/rerun2-browser-b.json)과[원인/동결지문](../../evidence/issue-785/rerun2-f005-diagnosis.json)에각실행을연결한다.

네 A/B 시작/종료1128파일과현재파일의SHA256은모두 `60648b89a19a29597390a5a015d1f8dc23176408ddfdb050c6b7df7b6180d776`다. scopedSourceStable=true와Next생성next-env/tsconfig2개에따른fullCheckoutSourceStable=false를구분한다. 종료후추적58개생성물은HEADf039원본으로복원하고새raw output/trace/HTML은/tmp로보존해Git에게시하지않았다. 이전#556/기타issue의역사이미지를새측정자료로덮지않았다.

[복원후정적검사](../../evidence/issue-785/rerun2-static.json)는typecheckPASS/exit0,전체lintPASS/exit0(error0/기존warning10),Markdown317파일링크·version0.131.0·main대비diffPASS다. TEST_PLANblob5edc20685005d8877d160059e5fff9ba46c3bac0은변경없다. 제품src/공용DTO/guard·package/lock·Unit/capture검증입력변경0이므로이전Unit40·audit0은그입력범위에서만참고/제한재사용하며새로운실행/공식새HeadPASS로주장하지않는다.

[현행자동fast](../../evidence/issue-785/rerun2-prepr-fast.json)는 **BLOCKED/exit1·selected111/UNKNOWN30/missing0/내부step0·sourceStable=true**다. 이전109선정과새111선정을혼용하지않으며새로교정한E2E두파일직접선정이추가됐다. Unknown30의생산자수동영향매핑과71실제실행은자동판정을우회하거나변경하지않는다. 로그출력을읽던최초shell wrapper의exit0을PASS로사용하지않고최종직접명령의exit1을확인했다. 이후문서/판정stamp만보완하며src/tests/lock/tools지문은그대로다.

정식새Head Quality/E2E8/Docker·default-main Trusted/QA_FINAL·Owner ACCEPT는NOT TESTED,AC4안전편집미구현/예외없음·MERGE_READY=BLOCKED/release_authorized=false를유지한다. 최종실제별도read-only PRE_QA후기존PR787의본문1회·Head1회반영과새FullCI등록/시작확인으로인계한다.

### F785-005 독립 사전 검토와 PR 인계

실제 분리된 read-only `/root/qa_review`가 기준Headf039의 working후보(테스트4파일+문서, runtime/test/lock/tools지문60648b89a19a29597390a5a015d1f8dc23176408ddfdb050c6b7df7b6180d776)를 검토해 **PRE_QA=PASS, 미해결 지적0**을 반환했다. 원문71case/20spec·네1128파일manifest·성공producer3곳·모든음성/dirty/401412/ID보호·정적로그·문서구조/매핑·관측한계를 실제 대조했다. baseline f039 자체의 미수정 코드가 PASS했다는 뜻이 아니며, 이후 판정stamp/문서만 보완하고 source추가변경은없다. 게시될candidate의전체tree와검토tree를동일하게확인한다.

이검토는게시준비범위이며새Head의Required3/Trusted/Owner·전체AC수용을대체하지않는다. 실제원격reviewthreads/main충돌·head/baselease를다시확인한후기존PR787본문1회/Head1회로일괄반영하고새FullCI의정확RunID+attempt/Head/base/testmerge·시작상태를Issue STATUS에기록한다. 기존3204FAIL은불변이다. AC4미구현/예외없음·HIGH/OWNER_MANAGED/qa_required=true·Manager NOT TESTED/MERGE_READY BLOCKED·release_authorized=false와모니터링/병합/정식게시/Issue종료제외를유지한다.


## 2026-10-24 REWORK F785-006 — 설비 저장 후 보고서 root 불일치

[단일 누적 원장](../../ISSUE_785_FAILURE_ANALYSIS.md#f785-006--full-32081-설비-저장-후-보고서-관점-불일치-2026-10-24-kst)에7Full/metadata1/advisory7 및가설·재현·공유소비자감사를추가한다. [원격 정제영수증](../../evidence/issue-785/ci-40045100122-attempt-1.json): Full3208.1/Run40045100122/attempt1,Head473b0fb103d445f64ef6b44be63a9b4d6456cbdc·base dd7f4d86db06e8a10b8c86b5412ed319154011e0·testmerge fea4ad9558eec626ecbf56dc996e7d54127d3002. shard2job120725634037step7의#734:272가before.spec.root equipment/afterprocess로FAIL(5PASS/1FAIL/87NOTRUN4.6분),revision/snapshot앞단언PASS·focus뒤단언미실행이다. QualityDockerPASS/E2E·QA파생FAIL,취소7추가기록FAIL0·누적취소42다.

3207metadata는oldf039→current473b로SUPERSEDED/full_run=N/A이며Required statussuccess/구현SKIPPED를runtimePASS로쓰지않는다. 원본RunFAIL·staleHead QA BLOCKED는보존한다. sourceartifact는metadata만조회하여Trusted provenancePASS를주장하지않는다. 이전71은실제이전source의검증으로보존하고새후보의PASS로재사용하지않는다.

분류UNKNOWN. frontend는수정전원본#7348순서와단독dirty·실제query/reply/UIroot관측으로피드백루프를확보한다. 원래설비root/spec/filters/scope·정확PATCH1/revision+1/snapshot·두WorkArea/행/focus는보존한다. 응답body조건으로오류응답을걸러PASS시키지않고요청식별/응답echo를검증한다. qa_docs가7개waitForResponse소비자(광역4/부분2/전체조건선례1)와#730저장복귀인접case를감사하며제품/교정범위는근거후확정한다. Root문서단일writer·원격출처infra·재현/교정frontend·별도read-only QA를유지한다.

DOC_SYNC영향과최종동결회귀선정은실제제품/테스트변경범위후확정한다. TESTPLAN1MB원본5edc20685005d8877d160059e5fff9ba46c3bac0는부분조회로덮지않는다. 최종새Head/PRE_QA/Required3·Trusted/Owner/Manager ACCEPT는NOT TESTED이며AC4미구현/예외없음·MERGE_READY BLOCKED/release_authorized=false를유지한다. CI시작후완료모니터링/병합/Main/GHCR/Issue종료는제외한다.

### F785-006 원본 비재현·원격 trace·결정적 red

수정 없는원본#734전체8은 **8/8PASS(4.4분)**, 원본단독dirty(traceon)는 **1/1PASS(본문22.7초/전체40.6초)**였다. [자연 network 순서](../../evidence/issue-785/rerun3-local-natural-sequence.json)에는동일revision의equipment/process report가함께발생했고각성공응답은자신의요청spec과일치했다. 이비재현은원격FAIL을취소하거나환경flaky확정으로사용하지않는다.

원payload/status를보존하고PATCH후equipment전달만700ms지연한 [timing통제1회](../../evidence/issue-785/rerun3-timing-probe.json)도1/1PASS(22.6초/전체38.7초)였다. process서버응답은먼저완료됐지만browser요청이abort되어관측기에전달되지않았으므로의도한경합이재현된것이아니다. 임시DEBUGsource는/tmp에보존하고원본fcfa지문으로복원했다. 성공할때까지반복하지않고실제CItrace를조회했다.

[원본CI허용필드증거](../../evidence/issue-785/rerun3-ci-trace-allowed.json)는playwright-report-shard-2 artifact12541530991의ZIP4,540,711bytes를Actions SHA256 `99a75d3d3caa4de4e0a35deba67f86f6f9c1c4e4d5e627c905cefcefaca6ed34`와대조했다. 실패trace한개(3,191,690bytes)만ZIP/JSON데이터로읽었고JS/PR코드를실행하지않았다. ci-pr-source payload를검증한것은아니며auth/cookie/header/전체raw본문·원본ZIP/trace는Git에저장하지않는다.

원본Before는equipment/rev23이다. PATCH00:36:06.573Z성공/rev24후browser가00:36:06.726Z process/report,00:36:06.987Z equipment/report를각각POST하여각자200/같은root/rev24를반환했다. 그런데테스트APIRequestContext가00:36:07.295Z에다시POST한본문은process였고다시process/rev24를받아after.spec비교에사용했다. 오류DOM에서도설비tab selected·설비tabpanel/현재경로·수정된설비행이확인됐다. 이실패는서버가equipment요청의root를바꾼사례나최종UI가설비관점을잃은사례로관측되지않았다. process요청을발생시킨특정컴포넌트는확정하지않는다.

실제원본matcher source와원격응답순서를결합한명령 `node /tmp/issue785-rerun3-original-matcher-replay.cjs`를실행해 **exit1**, `Original source matcher selected: process`/expected equipment의결정적red를확보했다. 이는브라우저비재현결과와별개인 **actual matcher seam replay**다. 원본source지문/실제CI데이터를확인한뒤행한진단이며가짜제품실패로간주하지않는다. source/재현/가설대조는[진단영수증](../../evidence/issue-785/rerun3-f006-diagnosis.json)에연결한다.

사용자에게세가설/반증예측을공유한후 (1)광역waiter가다른정상process응답을선택한다는가설을원격trace·replay로확인했다. (2)최종UI가process로변경된다는가설은이실패시점의설비DOM/저장행에지지되지않고,(3)서버wrong-echo는관측한각요청/응답root일치로반증됐다. 분류는 **FIXTURE_OBSERVABILITY**이며제품guard/관점state를완화·변경할근거는없다. 이전F003 ID/F004stale DTO/F005mock필드누락과서로다른원인을동일#734의추가사건으로보존한다.

### F785-006 교정 범위·회귀 선정

Manager는약한6spec전체(#730/#732/#733/#734/#735/#737)의모든caller와공유exacthelper·Vitest회귀신설을승인했다. 기존#736정확조건선례는독립baseline으로유지한다. 정확Project path/POST·전체spec/filters/scope/report query와등록후request identity로대상을선택하고선택후status/응답echo를엄격검사한다. 다른내용의응답을body필터로숨기지않고UI가설비query를잃으면timeout/UI보존단언으로실패해야한다. 기존PATCH1회/revision+1/새snapshot/두WorkArea/수정행/원래focus와잘못된scope·응답역전·readonly/error음성을유지한다.

정확discovery에서교정6spec은#7306/#7324/#7335/#7348/#7356/#7376=35case,기존#7365를포함하면40case/7spec이다. 이전71과중복은#7348+#7356=14이므로 **71+40-14=97unique/25spec**이다. 수동4배치A36(10files)/B35(11files)/C15(#730/#732/#733의3files)/D11(#736/#737의2files)로각배치12파일이하를지키며최종source에서다시discovery한다. 25spec은자동진단helper상한을넘는수동분할범위라근거와전체합집합을명시하며자동workflow_dispatch/Full축소를하지않는다. 새matcherUnit은E2E97개에합산하지않는다.

TEST_LIFECYCLE_REVIEW는기존6spec의전체시나리오EXTEND·정확736/누적실패/permission·HTTPSQLite·main18 KEEP_UNIQUE,공유correlation seam의의미있는경합/wrong-echo Unit은ADD다. 새E2E상시spec/CI8-shard배치변경·skip/retry/timeout변경은없다. 새helper/Unit을source manifest에서누락하지않도록staging한뒤실제파일수/지문·최종Unit/E2E결과를기록한다. 문서영향은원장/Packet/정제증거/PR·Issue이며제품/API/DB/보안/UX계약변경없으면정책/TEST_PLAN추가수정은N/A로재사용한다. 현재최종97/Unit/PRE_QA/새Required·Trusted·Owner는NOT TESTED다.

### F785-006 보완 후보의 독립 검토 REWORK와 재동결

최초 sharedhelper 보완은 기존matcher에 대한Unit3FAIL→3PASS·확장7PASS와직접저장smoke2PASS를확인한후1130파일지문 `eddfed861b304dac186f240974bd9a2cdaec54832267491dee89d7643feb0624`로동결해97선정을시작했다. 이단계typecheck의readonly levels6오류/최소mockcast1오류도개발중발견해교정했으며최종PASS만으로초기오류를숨기지않는다.

독립qa_docs가새helper의두결함을추가로입증하여수정전본인소유driver/Playwright만안전중단했다. [중단 영수증](../../evidence/issue-785/rerun3-prototype-stopped.json)은A에서4PASS관측후CANCELLED, B/C/D미실행, source전후동일이다. 이는제품/원격CI새실패가아니라새보완후보의검토결함이며 **최종97PASS에부분4개를재사용하지않는다**.

- REVIEW-F006-P1: async responsepredicate가선택응답을await전에선점하지않아동일query의두미래응답이겹치면빠른두번째로통과한후늦은첫본문이공유body/text를덮을수있었다. 독립메모리harness에서선택request와cachedroot불일치및첫wrong-echo은폐를재현했고설치Playwright의동시predicate실행모델과도대조했다. 신규중첩Unit은기존7PASS+2FAIL로red였고,첫matchingResponse를await전에선점해선택응답별local cache로묶은뒤9/9PASS였다.
- REVIEW-F006-P2: filter echo가요청key만비교해조건{}에응답{taskSearch:other}도통과했다. WBS parser/service와제품transport의계약은빈배열/undefined제거·배열trim/dedupe/sort·search/taskSearch trim후 **전체조건동등성**이다. 기존#736의toMatchObject는검사한계이며공식subset계약이아니다. 추가filter거부·정상정규화양성을추가한Unit은9PASS+2FAIL→11/11PASS였다.

새predicate는처음일치한응답의capturePromise를동기로예약하고그응답의status/본문/echo검증실패를나중정상응답으로숨기지않는다. 선택request와body가일치하고listener가정리되며전체canonical filter를비교한다. caller의등록후조건객체in-place변경은확인되지않아해당추측으로범위를늘리지않았다. 두교정은원격F006의기존광역matcher오귀속과구분해보존한다.

독립read-only `/root/qa_review`는변경된helper/unit과원문red→green을다시대조하고별도메모리harness로wrong-first-echo FAIL·request/cache동일·listener0·추가filterFAIL·정상정규화PASS를확인해 **REWORK해소정적PASS/미해결0**을반환했다. 이는최종PRE_QA나97실행PASS가아니다. 관련smoke2PASS(1.5분)뒤TSindexsignature해소를위한filter객체shallowcopy만보완했고Unit/typecheck는다시PASS했다.

최종소유8파일은교정6spec+`tests/e2e/helpers/wbs-report.ts`+Vitest의`tests/scripts/wbs-report-correlation.test.ts`다. 새파일을staging하여E2E139spec계약을변경하지않고source manifest1130파일에포함했다. 새지문 `ca3e45a2e59f0cb9302e508fe2e2ef3cee60d9a2a727efb9208f367836ecc956`, helperSHA256 `5e5450870bf1b02907de9c5080716c0e72e1f8978ea03b3bafc3a726a990710c`, unitSHA256 `361affa14ca9c93b84573dcb945e8434ed06f529e326715058a1dd52e2a748a4`를고정했다. A36/B35/C15/D11=97/25spec을/tmp/issue785-rerun3-final2-*의새prefix에서처음부터실행하며중단/중간결과와합산하지않는다. Unit11은별도검증이며E2E97에합산하지않는다.

### F785-006 검증 도중 main 변경과 제한 재사용 계획

게시 준비 조회에서 main은 dd7f4d86db06e8a10b8c86b5412ed319154011e0에서 **4ce403a1e410ca599a780446f39513e1f1158326**(PR #788 / Issue #608)으로 변경됐다. 부모는 [dd7f4d86db06e8a10b8c86b5412ed319154011e0, 886e72d8911695b8b9568754c3636d00956e7f7c]다. 실제 diff는 #608 원장·Packet 두 문서와 `scripts/test_qa_final_automated.py`의 신규 세 테스트, 총3파일/222줄 추가뿐이다. 제품·validator 구현·workflow·package·JS/브라우저 테스트 변경은 없다.

진행 중인97 검증은1130파일 지문ca3e45a2e59f0cb9302e508fe2e2ef3cee60d9a2a727efb9208f367836ecc956에서 그대로 수행한다. 별도qa_docs는 Python 파일이CI quality unittest에서만 실행되고97 browser/새Unit11의import·실행 입력이 아님을 actualdiff와소비자로 확인했다. 이에 종료·생성물복원 후 main 통합, Python 전체test·Unit11·정적검사·새base 자동fast를 새로 실행하고, 전후1130manifest의 유일차이가 이Python1파일인지 대조한다. 충돌해결/추가변경이 브라우저 입력을 바꾸면 선정과 재실행을 다시 평가한다.

이 조건을 충족한 때에만97 actualPASS를 **동일 브라우저 입력에 한정한 Local Fast Feedback 재사용**으로 기록한다. 통합 source에서97을 새로 실행했다고 표현하지 않으며 이전 공식CI PASS를 새Head/base로 재사용하지 않는다. 현재 main 통합·추가검증·최종PRE_QA는 NOT TESTED이고, 새 Required3/Trusted/Owner·Manager ACCEPT와 AC4 예외 미승인은 계속 별도 gate다.

### F785-006 최종 Batch A 실제 결과

[최종 A 영수증](../../evidence/issue-785/rerun3-browser-a.json)은 **36/36 PASS(15.3분), skip/flaky/retry0·exit0**다. 원래실패 #734 dirty/PATCH/spec/snapshot/focus(본문23.2초)·#734 전체8·#735 전체6·이전#461 group7과 누적실패·실제HTTP/SQLite 재시작을 검증했다. 1130파일 지문ca3e45a2e59f0cb9302e508fe2e2ef3cee60d9a2a727efb9208f367836ecc956은 전후동일이다. Next가 next-env.d.ts/tsconfig.json을 생성해 fullCheckoutSourceStable=false인 사실은 별도로 보존한다. B/C/D가 같은동결source에서 계속되며 전체97·main통합 후 추가검증·최종PRE_QA는 아직 NOT TESTED다.

### F785-006 게시 쓰기 권한의 명시적 배정

이번 보완의 Issue 진행 댓글 작성자는 Manager만이다. 최종 clean commit/tree·Head/main lease와 사전 검토를 확인한 Manager의 별도 GO 이후 `infra`에게 기존 PR #787의 본문1회·정확 candidate tree와두부모 commit 생성·non-force ref1회·새CI등록/시작 확인만 위임한다. 이 명시 배정은 위 최초 계약의 Sub-Agent 게시 금지를 해당 최종게시 한정으로 대체하며, 임의 Issue/PR 댓글·병합·릴리스·CI완료 모니터링을 허용하지 않는다. GO 이전 infra는 read-only이고 Issue STATUS는 Manager가 기록한다.

### F785-006 최종 Chromium 전체 결과

[최종 browser 영수증](../../evidence/issue-785/rerun3-browser-final.json)은 **A36/36(15.3분)+B35/35(3.9분)+C15/15(8.3분)+D11/11(5.3분)=고유97/97 PASS,25spec·중복/skip/flaky/retry0·exit0**다. 원래 #734 저장 후 관점 불일치 case와 누적9실패spec·6변경consumer 전체35·독립#736·실제HTTP/SQLite 재시작·main18/권한·KPI음성·geometry/keyboard를 같은동결source에서 검증했다. 중단prototype A4·초기smoke/비재현·Unit11은97에 합산하지 않았다.

네배치의시작/종료 총8manifest와 현재1130파일의 지문은 모두ca3e45a2e59f0cb9302e508fe2e2ef3cee60d9a2a727efb9208f367836ecc956이다. scopedSourceStable=true이며 각배치Next생성next-env/tsconfig차이때문에 fullCheckoutSourceStable=false다. 모든원문로그/trace/HTML과전체manifest는/tmp에보존하고Git에는허용필드JSON만게시한다. [Unit 별도영수증](../../evidence/issue-785/rerun3-unit.json)은11/11PASS(165ms)와원문해시·3FAIL→3PASS/7확장·검토P1 7+2→9/P2 9+2→11을연결한다.

이97은main4ce통합전ca3source의실측이다. 다음생성물복원·main통합·Python전체/Unit11·정적fresh·새base자동fast·실제manifest유일차이대조 및최종PRE_QA를완료하기전게시하지않는다. 새Head Required3/Trusted/Owner는계속NOT TESTED이고AC4/Owner예외없음·MERGE_READY BLOCKED를유지한다.

### F785-006 main 통합·생성물 복원·입력 대조 완료

[생성물 복원 영수증](../../evidence/issue-785/rerun3-generated-cleanup.json): 실행이 끝난 후 추적74개를원본Head473b로복원하고미추적26파일을/tmp보존공간으로옮겼다. AGENTS/Next설정·다른Issue의역사스크린샷을새결과로덮지않았다. TEST_PLAN전체1,083,528B/blob5edc20685005d8877d160059e5fff9ba46c3bac0은그대로다.

로컬보완commit8c69d9a7을보존하고main4ce403a1e410ca599a780446f39513e1f1158326을mergecommit8914d89f760cd18abbf57426488b316a38fbf831로 **충돌0** 통합했다. [입력한정재사용 영수증](../../evidence/issue-785/rerun3-main-input-reuse.json)은1130manifest의유일변경이scripts/test_qa_final_automated.py이며제품/validator/workflow/package/E2E/helper/Unit11입력이동일함을확인한다. 통합지문은 **a98f0ffb6dd0434afe17cab5416fb2417d85c0acdbdaa6328332d374a20b453b**다. 이지문에서97을새로실행한것은아니며ca3의실제97을동일브라우저입력한정Local Fast Feedback으로재사용한다. 공식과거CI PASS는새base로재사용하지않는다.

[통합후새실행](../../evidence/issue-785/rerun3-postmerge-verification.json)은PythonQA전체 **37/37PASS**(신규3test포함)와helper Unit **11/11PASS(160ms)**다. API/Artifact403404429·네트워크/timeout/malformed의BLOCKED보존을mock검사했고실제외부Trusted승인PASS를뜻하지않는다. 이후source변경없이최종정적/자동fast·독립PRE_QA와게시lease/스레드를확인한다. 새원격Required3/Trusted/Owner·Manager ACCEPT/AC4예외는계속NOT TESTED다.

### F785-006 통합후 정적·자동 fast 판정

[새 정적영수증](../../evidence/issue-785/rerun3-static.json)은통합지문a98f0ffb6dd0434afe17cab5416fb2417d85c0acdbdaa6328332d374a20b453b에서typecheckPASS·전체lintPASS(error0/기존warning10)·Markdown319파일링크PASS·version0.131.0과main대비diffPASS다. #608 문서2개추가로이전317파일과구분한다.

[새base 자동fast](../../evidence/issue-785/rerun3-prepr-fast.json)는 **BLOCKED/exit1·selected115/UNKNOWN31/missing0/내부step0·sourceStable=true**다. 이전111/UNKNOWN30과혼용하지않는다. 새UNKNOWN은sharedhelper `tests/e2e/helpers/wbs-report.ts`1개이며직접Unit11과변경6consumer전체35case로수동영향을매핑했다. 기존30UNKNOWN의수동영향표와density/lockfixture추가지도는유지한다. 이수동mapping과97actualPASS는자동선정BLOCKED를PASS로바꾸거나selector정책을우회하지않는다.

이후변경은문서/판정영수증뿐이다. 최종read-only PRE_QA에서원문4batch/8manifest·입력한정재사용·Python37/Unit11·정적·자동BLOCKED·원장/Packet/PR본문·AC4/Owner/공식원격판정경계를대조한후clean최종tree를게시한다. source/guard·CI8shard/35분/Required3/보안·registry권한은변경없다.

### F785-006 독립 사전 검토와 최종 PR 인계

실제 별도 read-only `/root/qa_review`가 최종 통합 후보를 검토해 **PRE_QA=PASS, 미해결 지적0**을 반환했다([검토 영수증](../../evidence/issue-785/rerun3-preqa.json)). 원문4로그의97checkedcase와 정제batch 전수·고유97/25spec/기존71누락0,8전후manifest1130map·현재a98f전체map·유일Python1차이,Python37/Unit11fresh와정적5종 원문sha/exit0,TEST_PLAN전체blob를 대조했다. helper 검토P1/P2해소와6caller전체·736독립·원래보안/저장/focus단언,문서구조/영향mapping·게시범위 의미정합을 확인했다.

사전 검토 PASS는 게시 준비 범위다. ca3의 실제97과 main통합후 입력한정재사용·fresh검사,Next생성차이로fullCheckoutfalse,자동fastBLOCKED115/UNKNOWN31/step0,공식새HeadRequired3/Trusted/Owner NOT TESTED를 구분했다. AC4안전편집 미구현/READONLY·Owner예외승인없음·HIGH/OWNER_MANAGED/qa_required=true·manager_decision=NOT TESTED/MERGE_READY=BLOCKED·release_authorized=false는 유지한다.

이후 판정stamp/문서만 보완했고 source 추가변경은 없다. clean최종tree와 APIcandidate전체tree/두부모[473b,4ce]를 확인하고 기존PR본문1회→Head/mainlease재조회→nonforce ref1회→새testmerge/리뷰thread·충돌 및 FullCI등록/시작까지만 확인한다. 정확 게시Head/RunID/attempt/base/testmerge·metadata전용사건은 Issue STATUS로 연결하며 문서 자기SHA순환을 만들기 위해 추가push하지 않는다. CI완료모니터링/병합/Main/GHCR/Release/Issue종료/브랜치정리는 제외한다.

## PR #787 REWORK — F785-007 / Full #3216.1 Resource Excel metadata (2026-10-24 KST)

- **원본:** [Run40051075577.1](https://github.com/planner77/masterGantt/actions/runs/40051075577) Head7af290c8/base4ce403a1/test merge c7a5f963. Shard7 Job120744149110의 #529 XLSX 검증이 구 Actual target context 키로 JSON.parse(undefined) FAIL. Shard7 73PASS/1FAIL/4NOTRUN, Shard6/8 PASS·다른5 CANCELLED, Quality/Build/Docker SUCCESS, E2E/QA 파생 FAIL. 이전 F785-001~006 불변.
- **원인/변경:** 현재 writer는 정확한 공개 Actual report context 행을 출력하지만 과거 #529 테스트만 폐기된 Logistics Target 키 기대. 기존 E2E assertReportWorkbook을 새 키 문자열·기존 구 키 부재·원래 full canonical context 동등 검증으로 EXTEND. 하나의 검증 함수가 Current/exactAssignments/Project XLSX 모두 확인. 기존 실제 SQLite HTTP OOXML Unit도 시트 행명 양성·음성 EXTEND. writer/API/DB/Resource KPI/스냅샷·공수·ZIP·CI 워크플로 수정0.
- **AC_TEST_COVERAGE / TEST_LIFECYCLE_REVIEW:** 기존 #529 E2E 및 Unit을 사전 검색해 EXTEND, 이전 #719/#734/#461/#785 F006 및 HTTP/SQLite/Report detail/capacity/Plan/Original source provenance/Export security KEEP_UNIQUE. AC2/5/7/8/9/10. docs/EXCEL_EXPORT.md 현행 키와 원본 출처 분리 문서화, 단일 실패 원장 갱신. 새 중복 E2E·skip·timeout/Retry/Required 강도 완화0.
- **검증/인계:** 실제 로컬 E2E·Unit/npm·Docker는 GitHub DNS·checkout 부재로 NOT TESTED; 기존97 Chromium PASS 모집단은 #529를 포함하지 않음. 새 Head Full Quality/E2E8/Docker, default-main Trusted QA, Owner HIGH 승인 별도. 리뷰·base 충돌 재확인 후 기존 PR synchronize Full CI 시작만 하고 결과 모니터링/병합/Main/GHCR/Finalizer/Issue 종료 없음.
- **승인 상태:** HIGH/OWNER_MANAGED, manager_decision=NOT TESTED, MERGE_READY=BLOCKED, release_required=true/release_authorized=false. AC4 레거시 안전 편집 미구현·운영 DB/외부 소비자/백업 미검증 유지.

## F785-008 — Main CI trace 제목 실패 / 동일 Issue 후속 교정 (2026-10-24 KST)

- PR #787은 원본 Full #3217.1/Trusted PASS·Owner 승인 후 merge96d97d12로 병합됐으나 Main #3219.1 changes verify-ci-run-trace에서 Manager의 **비어 있지 않은 multiline commit_message**로 FAIL. 기존 immutable Main 실패는 보존하며 GHCR/tag/이슈 종료 없음. `scripts/main_ci_run_name.py`의 commit_title exact 한글30자 이하 + `commit_message:''` preflight는 정책으로서 불변.
- 동일 Issue/version0.131.0 non-docs corrective PR로 회복하는 기존 #729/Generic Finalizer same-Issue supersession 경로 적용. 다른 이슈가 main first-parent에 개입하면 자동승계 BLOCKED. package/lock/Gantt/제품/api/업무 계약 변경 없음.
- `tests/server/projects/resource-excel-export.test.ts`의 실제 SQLite HTTP OOXML 기존 #529 테스트를 EXTEND하여 Actual report context JSON의 exact canonical values와 stale target axis가 없음을 검증한다. F785-007 보완의 Unit 양·음성 행 이름뿐 아니라 JSON round-trip 근거를 강화. `docs/TEST_PLAN.md`의 기존 전체 1MB blob을 보존하고 TEST_LIFECYCLE_REVIEW/AC2/5/7/8/9/10을 additive 반영한다. 원래 E2E #529·Resource/Plan/Task·보안·퇴역 410/원본 ID 등은 KEEP_UNIQUE, duplicate E2E spec0.
- 후속 PR Full8/Required3·default-main Trusted QA·Owner HIGH ACCEPT 전 병합 금지. CI 모니터링 사용자 요청으로 생략. 다음 merge 요청은 `main_ci_run_name.py --as-merge-payload --expected-head-sha`가 산출한 빈 본문/정확 한 줄 제목의 lease-bound Merge API만 허용; Main 완료 후 GHCR exact digest/Release/Finalizer/Issue 종료.

## F785-009 — PR #793 Full #3220.1 QA 문서 Gate + 미해결 P1 리뷰 보완 (2026-10-24 KST)

- [원본 Full #3220.1 · Run40057374955](https://github.com/planner77/masterGantt/actions/runs/40057374955), attempt1, `pull_request`, workflow `.github/workflows/ci.yml`, Head `ee05a24f1e988e104a332d92a20469f3ce3189ee`, base/main `96d97d12d0502bdc725daedae7dfd9be0090c4d3`, test merge `59d839cb003d2dd377bf803a7fc5bfd567b80a21` (동일 tree, 부모 base/head). First direct failure는 QA Preflight Job120763274459의 DOCUMENTATION_SYNC: EXCEL_EXPORT에 PR 변경 대비 UPDATED 잘못 지정. Fast Gate Job120763319388 FAIL, Quality/E2E/Docker aggregate 파생FAIL, 실제 Vitest/E2E8/Docker implementation SKIPPED·NOT TESTED. 이전 #3219 main trace 실패/릴리스 미발행 부채와 다른 원인.
- [P1 review](https://github.com/planner77/masterGantt/pull/793#discussion_r4365798485)에서 `sheet1.xml`은 Gantt 시트이며 Resource Report가 아니라는 별도 테스트 TEST_CONTRACT 결함 확인. CI에서 실제 Unit을 실행하지 않았으므로 리뷰 기반 사전 발견으로 기록하며 가상의 Unit FAIL로 집계하지 않는다. 기존 성공한 인접 테스트가 사용하는 `xl/workbook.xml`의 sheetNames/인덱스를 재사용하고 실제 Resource Report XML을 파싱해 원래 JSON canonical context/legacy 키 부재·동일 숫자/출처 단언을 보존한다. 새 테스트 삭제/skip/timeout/retry/CI 완화 없음.
- DOCUMENTATION_SYNC 구조 교정: `docs/TEST_PLAN.md`: UPDATED(이 복구 PR의 1MB 원본 보존·F008 영향표 갱신). `docs/EXCEL_EXPORT.md`: N/A(현행 공개 Resource Report 문서와 writer/메타데이터 계약 불변, XLSX 시험 시트 찾아가기만 수정); `docs/IMPORT_EXPORT.md`: N/A(교환 writer/format 불변); `docs/IMPORT_SCHEMA.md`: N/A(가져오기 schema 불변). 단일 H2 `## DOCUMENTATION_SYNC`에 정확 파일별 변경 대비 판정, AC1~10는 기존 `## AC_TEST_COVERAGE`의 유효한 현재 경계로 보존. 기존 #787에서 해당 문서들을 UPDATED했다는 역사적 사실 자체는 유지한다.
- TEST_LIFECYCLE_REVIEW: 기존 `tests/server/projects/resource-excel-export.test.ts` 실제 SQLite/HTTP/OOXML #529 unit **EXTEND**; 기존 `tests/e2e/resource-excel-export-ui.spec.ts` 세 Workbook, 원본 #719/#734/#461, 보안·Zod/역사 capture·Task/Resource/Plan 회귀 **KEEP_UNIQUE**. AC2/5/7/8/9/10 연계. Test selection/새 Full Quality/Chromium8/Docker·default-main Trusted는 원격 결과 전 NOT TESTED. 이 연결된 GitHub-only 세션에서 실제 npm/Vitest/Chromium/Docker 미실행, 저장소 정적 parse 및 QA docs_gate의 파일별 정책 검사만 검증.
- 리뷰는 교정 커밋 뒤 근거 답변·P1 스레드 resolve, 최신 main/head mergeability·Git tree 검사 후 새 PR Full CI synchronize 시작까지만. `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `MERGE_READY=BLOCKED`, release_required=true(연속 동일 Issue 실패 원장으로 version0.131.0 승계), release_authorized=true(기존 승인 marker #6379091454, 정확 Main/Release 증거 선행). 원본 main #3219.1/후속 #792, 임시 GHCR·tag 미발행 상태 보존. 실패 및 승인 단계 완료 전 PR 병합·Main/Release/GHCR/Finalizer/Issue 종료는 수행하지 않는다.
