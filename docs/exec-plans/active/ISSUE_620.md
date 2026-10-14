# Issue #620 — Resource–Target 보고 API R2 Work Packet

## 기준·범위·담당

- Issue: https://github.com/planner77/masterGantt/issues/620, 상위 #613, 선행 #614/#617/#619, 기존 Resource #524/#528.
- baseline main: `b19b913f`; application `0.111.0` → `0.112.0` MINOR. 하위 호환 조회 API 확장에 따른 버전 준비이며 의존성 그래프는 변경하지 않는다.
- worktree: `/home/planner/Dev/masterGantt-issue-620`; branch: `feat/issue-620-target-resource-api`. 기존 작업 폴더와 미추적 증거는 보존한다.
- phase: PR_CI 실패 #2755.1 → GSC 리뷰 보완 및 새 exact-head PR_CI 요청 (구현·로컬·문서·별도 사전 검토 PASS). 사용자 요청 종료점은 구현·관련 문서 갱신·Local Fast Feedback·사전 검토 후 단일 PR 생성 및 exact-head Full CI 시작 확인이다. CI 완료 모니터링·병합·main CI/GHCR·tag/Release·Issue 종료·브랜치 정리는 범위 밖이다.
- 실제 Agent: `/root/backend`가 `src/**` 계약/서비스 및 `tests/server/resources/**`, `/root/http_tests`가 신규 `tests/e2e/resource-target-dashboard-api.spec.ts`, Manager가 문서/package/version/GitHub 운영을 담당한다. `/root/qa`는 별도 read-only 사전 검토자다. 동일 파일 writer를 중복 배정하지 않는다.
- issue_comment_writer: manager. Sub-Agent는 Issue/PR 댓글을 직접 게시하지 않는다.

## 구현 계약

기존 ResourceDashboardService의 read transaction에 Target/member/binding·legacy link·Project 공정 매핑·scoped master 이름/active 참조를 함께 포함하고 fingerprint로 report/detail/data context를 결속한다. #619 단일 pure projector와 #617 resolver를 사용하며 새 공수 원장·상속 엔진·cache를 만들지 않는다.

Target/member 조건은 같은 binding 경로, 같은 kind의 type/instance는 같은 member에서 판정한다. 개인/Group/Role/grade는 같은 개인 Assignment를 사용한다. T0 진단과 A 원시 Assignment를 구분하고 개인 필터로 T0 미배정 작업을 없애지 않는다. legacy 직접 MCS를 근거로 Target을 역추론하지 않는다. 전체 참고·선택 전체·중첩 소계 및 null/partial/미연결을 명시하며 grouping/page/접힘이 Grand Total을 바꾸지 않는다.

`exactAssignments`는 원본 source Assignment와 destination Target 조건의 교집합이다. 같은 Task의 다른 공동담당자 Assignment로 확대하지 않는다. source context와 destination filters를 각각 반환하고 변경된 참조는 `409 REPORT_STALE`로 거부한다. full canonical Project 참고는 `dimension=all/assignmentScope=projectReference` selector를 명시할 때만 source·사용자 필터를 제거한 참고 상세로 제공한다. 선택 A의 exact-source 교집합과 메타데이터/selector로 구별한다. 구 API에 새 조건을 요청하지 않으면 기존 결과/오류 의미를 유지한다.

기존 공개 Project 읽기 및 `private, no-store`·nosniff 응답 정책을 유지한다. 조회에 edit 권한을 새로 요구하거나 revision을 변경하지 않는다. malformed400/선택400/stale409/budget422를 유지한다. 기존 기간366일/응답2MiB를 상향하지 않으며 Target/member fan-out·summary cells·provenance를 materialization 전에 제한한다. 부분절삭 총계를 반환하지 않는다.

기존 Plan의 선택 demand는 공통 Target 필터 교집합을 지원하되 R 및 전체 Project 부하는 보존한다. Target별 기간 행/전용 selector·Excel 시트 확장은 #622, 사용자 분석 UI·공통 편집은 #621, 종단/운영 수용은 #623이다. R2는 report/detail/exact drill과 공통 identity를 확장한다. 기존 Excel은 공통 identity를 재검증하되 Target 필터/projectionOrder는 binding 유무 모두 명시 거부하여 우연한 부분 지원을 방지한다. DB migration·화면·Gantt·Scheduling algorithm·Import/Copy/Template 형식은 변경하지 않는다.

## GSC 사전 검토·정합성 영향 (PR #682 / CI #2755.1 REWORK)

- **표준 및 참조 source**: `gantt_standard_version=GSC 1.0.0-candidate` (`REVIEW_PENDING`), `reviewed_document_commit=b19b913f9e55870e48b9b955b3a321485021b781` (이번 PR 기준 main). 착수 후 REWORK 시 `docs/GANTT_STATE_CONSISTENCY.md`, `docs/GANTT_STATE_CONFORMANCE.md`, `docs/GANTT_ADAPTER_ADR.md`, `docs/GANTT_SYNC_TRACE.md`, `docs/exec-plans/active/GANTT_STATE_REMEDIATION.md`와 `AGENTS.md`의 필수 참조 경계를 재확인했다. 장기 규범은 원본 문서에 유지하며 이 Work Packet은 변경점의 적용 판정·증거만 기록한다.
- **적용 GSC**: GSC-01(서버 canonical 및 읽기/표시 권한 분리), GSC-06(보고 snapshot identity/선택 scope와 Gantt Core의 별도 세대 구별), GSC-09(기존 drill/return 연결에 임의 Gantt remount·선택 변경 금지), GSC-11(기존 회귀·원격 실패 분리), GSC-12(범위별 원장/검증 보존). GSC-02/03/04/05/07/08/10의 native Core no-op·rollback·viewport·SVAR adapter 변경은 이번 PR이 하지 않아 해당 알고리즘의 적합성 **N/A, 전체 준수 PASS 아님**이다.
- **상태/쓰기 소유권**: 변경 파일은 기존 Resource report/detail/query의 server-side **읽기 전용** snapshot·projection/selector와 계약·테스트다. canonical Task/Assignment/Target 생성·갱신, SVAR Core data/tree/order/link writer, Viewport X/Y·axis/focus writer, React Gantt 인스턴스·Editor 복구 흐름을 추가하거나 변경하지 않는다. Resource report identity와 exact-source Assignment 필터는 read transaction 내 서버 원장에 묶이며 projectionOrder는 표현 설정으로 canonical 변이를 일으키지 않는다. Public read는 기존 session/auth·no-store/nosniff 경계를 유지한다.
- **SC-11 적용 범위** (Resource/Dashboard/drill·Export 왕복): `tests/server/resources/resource-target-dashboard.test.ts`, `tests/e2e/resource-target-dashboard-api.spec.ts`, 기존 Resource drill/UI/Excel 회귀를 사용해 같은 snapshot, exactAssignments source 제한, 선택/전체 참고 scope, stale, 조회 mutation 0 및 기존 Excel 미지원 경계를 검토한다. 신규 SQLite17, 실제 HTTP1, 기존 회귀는 이전 로컬 원장에 따라 **해당 데이터/API 범위만 PASS**; `resource-kpi-integration-ui` 등 전체 실제 Core/scroll/selection을 포함한 SC-11 제품 종단 왕복은 **NOT TESTED**. U5/#574 최종 통합 검증을 대체하지 않는다.
- **SC-14 관련 PR 실패** (1000 Task + 2000 Milestone, 실제 Core readiness): #2755.1 / run `38523714154`, Chromium shard4 Job `115719610063`의 `tests/e2e/milestone-timeline-lane.spec.ts:173`에서 5초 동일 API instance/probe readiness gate 미충족. 42 PASS, 1 FAIL, 1 SKIP, 93 NOT RUN(해당 shard); 다른 shard 일부 CANCELLED. GSC-08/09/10 및 SC-14와 관련된 **미해결 원격 회귀**이며 단일 로그로 3000행 Core 지연/제품 회귀/CI 부하를 단정하지 않는다. 테스트 skip·timeout 확대·검증 약화는 적용하지 않는다. SC-14의 제품 구현·안정화 소유는 U1/U4/U5/#551 후속 경계에 두되, 이 PR의 Required E2E가 실패했다는 사실은 그대로 유지한다.
- **제외 및 ADR**: 이번 #620은 새 Gantt UI/adapter/native mutation/viewport change, Calendar writer, Milestone 위치·선택 변경 없음. SC-01~10/12/13 native 시나리오에 대한 제품 수정·이행 완료 선언을 하지 않으며 기존 ADR의 SVAR 2.7.3 public API·DEFER를 변경하지 않는다. 새 규범 예외를 요청하지 않아 `exception_adr=NONE`; GSC/SC 준수 면제를 뜻하지 않는다.
- **증거/판정 한계**: Reviewed target `PR #682`, 최초 실패 Head `90c3e8e2438276c8c9c44fc70fb6788894f964ac`, base `b19b913f9e55870e48b9b955b3a321485021b781`, full CI `#2755.1` (run `38523714154`), Chromium Job `115719610063`; Quality·Docker PASS, Required E2E FAIL, Automated QA FAIL(원격 리뷰 미해결도 포함). 초기 로컬 코드·HTTP PASS와 원격 실패/취소를 혼동하지 않는다. 본 기록은 리뷰 보완이며 인간/Trusted QA·새 Head 전체 CI 성공이나 최종 Manager ACCEPT의 증거가 아니다.

## DOCUMENTATION_SYNC

- `docs/API.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: UPDATED
- `docs/exec-plans/active/ISSUE_620.md`: UPDATED (GSC 1.0.0-candidate 리뷰·SC-11/SC-14 및 실패 원격 증거 보완)
- `CHANGELOG.md`: UPDATED
- `docs/evidence/issue620/resource-target-performance.json`: UPDATED
- `AGENTS.md`: N/A(실행 지침과 역할 및 승인 정책 자체를 변경하지 않음)
- `DESIGN.md`: N/A(새 화면·공통 시각 언어·제품 용어 및 디자인 원칙 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(사용자 interaction·keyboard·focus·반응형 구현 변경 없음)
- `docs/PROJECT_UX.md`: N/A(Workspace·Gantt 인스턴스·viewport·상태 보존 동작 변경 없음)
- `docs/TASK_EDITOR.md`: N/A(Target authoring 및 Task Editor 구현 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(기존 영속 테이블을 읽기 전용으로 조회하며 schema와 migration 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 pure KPI projector와 Calendar를 재사용하며 일정 알고리즘 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(Import payload 및 원자적 복원 형식 변경 없음)
- `docs/IMPORT_EXPORT.md`: UPDATED
- `docs/EXCEL_EXPORT.md`: UPDATED
- `docs/DEPLOYMENT.md`: N/A(Docker·운영 스토리지·환경 설정 변경 없음)
- `docs/CI_CD.md`: N/A(기존 minor version 정책 준수 및 CI workflow·릴리스 권한 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 required 원격 회귀·신뢰 계약 유지하며 실행 상태는 본 원장에 기록)
- `docs/GITHUB_OPERATIONS.md`: N/A(GitHub 운영·권한·required checks 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(현행 QA 운영 경로를 사용하며 신뢰·Owner 승인 정책 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 Lifecycle 단계 및 승인 범위 변경 없음)

## AC_TEST_COVERAGE

- AC1: `tests/server/resources/resource-target-dashboard.test.ts` 및 `tests/e2e/resource-target-dashboard-api.spec.ts`의 SQLite/server·실제 Next HTTP에서 기존 무Target 결과 회귀와 같은 snapshot/filter의 Resource/Group/Target 원시 총계 동등을 검증한다.
- AC2: Target/member/binding·Project 공정·WorkArea·master 이름/active 변경의 stale409 및 새 identity, 별도 WAL 연결 snapshot 일관성과 재시작을 검증한다.
- AC3: #619 shared5M/D·two Target·공유 MCS·ACS-only subset·직접/상속 출처·legacy 미연결 golden 기대값을 서버 통합에서 대조한다.
- AC4: exactAssignments source 제한·Target 교집합·공동담당 누출0·Task/Assignment 구별·T0/A와 source/current 문맥을 기존 #528 회귀와 검증한다.
- AC5: unknown/cross-project ID·same-binding/member/개인 Assignment 조인·read guard·400/401/403/409/422·no-store/nosniff 경계를 직접 handler 및 HTTP로 검증한다.
- AC6: 신규 server suite의 bounded page·selector·비가산 subtotal·null/partial·bounded provenance·사전 fan-out/cell/byte 예산 및 대표 multi-Target fixture SQL query plan/시간/응답 크기를 검증한다. 기존 Plan 선택 demand 교집합·R/전체 Project 보존과 legacy Excel의 Target 조건 명시 거부도 포함한다.
- AC7: 위 DOCUMENTATION_SYNC의 실제 diff와 API 요청/응답/오류/한도·AC1~AC6 테스트 매핑, Markdown 링크 및 trusted main의 문서 구조 검사를 수행한다.

## 위험·QA·릴리스

risk_level: HIGH
risk_reason: 서버 read 권한·동일 snapshot·정확 Assignment 교차 및 중첩 지표 정합성
qa_required: true
qa_method: OWNER_MANAGED
reviewer: /root/qa (별도 read-only 사전 Agent 검토)
independent_qa: N/A(Owner-managed 운영 경로; 별도 인간 최종 승인 주장 없음)
manager_decision: NOT TESTED
release_required: true
release_authorized: false

사전 검토 및 로컬 PASS는 GitHub required Quality/E2E/Docker·Trusted QA 또는 Owner의 HIGH 잔여 위험 수용/최종 병합 허가가 아니다. 최신 Head/base 원격 결과와 명시적 Owner 승인 전 `MERGE_READY=BLOCKED`다. 버전 준비만으로 정식 발행을 승인하지 않는다.

## 검증·운영 원장

- 선행 #617/#619는 착수 시 CLOSED이며 최신 main에 구현이 포함돼 있다. 이전 CI 실패/Owner 결정/병합 증거는 각 Issue의 원장을 보존한다.
- 로컬 gh CLI HTTP401: 연결된 GitHub 도구로 조회·게시한다. Secret/token/권한 정책을 수정하지 않는다.
- node_modules는 기존 설치의 로컬 hardlink 복사로 준비한다. 실제 CI의 `npm ci` frozen install을 대체하는 증거가 아니다.
- Manager Local Fast Feedback: `npm run version:check` PASS, `tests/scripts/verify-release-version.test.ts` 7 tests PASS, package/lock top/root 버전3개 외 dependency graph 동일, Markdown 링크214파일·`git diff --check` PASS. trusted main 문서 구조 검사 `docs_gate`는 required docs 합집합과 AC1~AC7 mapping을 PASS했으며 의미 검토는 별도다.
- 구현 담당 신규 SQLite suite: `tests/server/resources/resource-target-dashboard.test.ts` 초기16 tests PASS. Process Type·same-binding/member·unknown/cross-project·빈 exact source·T0/A·7종 raw master/mapping 변경의 stale409, member/binding·legacy Excel stale, WAL snapshot/reopen, 사전 raw graph/fan-out·page provenance·실제2MiB envelope 경계를 검증했다. 최종 source freeze 및 전체 영향 회귀 결과는 아래에 기록한다.
- 초기 기존 영향 회귀: dashboard/drill/compatibility·Target domain4파일102 tests PASS. 최종 실행과 합산해 단일 전수 실행으로 표시하지 않는다.
- 신규 실제 HTTP E2E 첫 PASS: 실제 Next/SQLite1개 시나리오44.1초. 이후 projection 순서/Plan·dual reference scope 단언 및 source 보완 뒤 최종 재실행 예정. 초기 null allocation 입력은 기존 계약에 맞게 생략으로 교정했고, Plan granularity를 생략한 테스트 작성 오류도 명시 week opt-in으로 교정했다. 이 초기 FAIL은 제품 FAIL/원격 실패로 분류하지 않으며 삭제하지 않는다.
- 최종 backend LFF: 신규 suite17 tests PASS (추가 SQLite A5/B5/distinct5+detail 합계 포함), typecheck·scoped ESLint·diff PASS. 기존 영향 범위19파일247 tests, Excel2파일23 tests 및 selector hardening/drill2파일35 tests는 별도 실행 PASS이며 중복을 합산하지 않는다.
- 실제 HTTP 최종 집중 실행: `npx playwright test --config tests/config/playwright.config.ts tests/e2e/resource-target-dashboard-api.spec.ts --project chromium --workers=1` 1 PASS/44.1초 (시나리오33.1초), 실제 Next/SQLite 재시작2회. 동일 data/report snapshot의 projection 순서 변경, Plan 선택3M/D·Project4.5M/D, exact source/Target 교집합·T0/null·보안·stale를 확인했다. 이후 마지막 변경은 Target node selector의 비선택 참고 범위 조합400 guard이며 신규 native 반례로 검증했다. 정상 browser 입력과 서비스 동작은 불변으로 앞선 HTTP 증거를 영향 범위 내 재사용한다.
- 사전 QA `/root/qa`: 별도 read-only Agent의 코드/테스트/문서 검토 PASS. 직접 focused3파일74/74 PASS (2.60초), 마지막 parser guard1 PASS/16 deselected 및 신규 golden1 PASS/16 deselected를 각각 재검증했다. deselected는 PASS가 아니며 중복 합산하지 않는다. reviewer의 src/tests14파일 경로+내용 SHA256 집계 fingerprint는 `4312be7104ee8d418cd528aa00cca6cd8f235952bee49eb911fb617f50943129`다.
- 성능 증거: [합성 SQLite 측정](../../evidence/issue620/resource-target-performance.json).131 Task·245 Assignment·2 Target·6 member·245 binding에서 SQL prepare48회,34.36ms, `{data}` 응답294445bytes. logistics_targets/task_target_bindings/logistics_target_members 모두 indexed SEARCH다. 같은 로컬 대표 fixture의 관측이며 운영 SLA/대량 운영 수용 PASS가 아니다.
- DOCUMENTATION_SYNC: PASS (구조·링크 및 별도 코드/문서 의미 대조). 공개 Excel의 stale412/서비스409, full canonical 참고 selector와 선택 A의 exact 교집합, dual scope·selected-only Target selector, 기존 Plan R/전체 Project·Excel 미지원 경계를 대조했다.
- 사전 QA: PASS (위 실제 별도 Agent의 로컬·문서 범위). 인간 승인·원격 Trusted QA·최종 Manager ACCEPT는 아님.
- 원격 Quality/E2E/Docker·Trusted QA: NOT TESTED. 이번 요청은 CI 시작 확인까지다.
- main/GHCR/tag/Release/배포/Issue 종료: 미수행, 요청 범위 밖.
