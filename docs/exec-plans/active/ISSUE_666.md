# Issue #666 — U4 날짜축 transaction·물리 geometry·스크롤 불변식

Refs #666

## 범위 / 실행 계약

phase: PR_READY → PR_CI
status: PRE_REVIEW_PASS_WITH_LIMITATIONS
risk_level: HIGH
risk_reason: 날짜축 변경의 간접 X/Y 쓰기와 비동기 취소·물리 capacity 경합
qa_method: OWNER_MANAGED
qa_required: true
qa_review_mode: 별도 qa_docs read-only 사전 검토 후 exact-head 원격 검증
manager_decision: NOT TESTED
MERGE_READY: BLOCKED
release_required: false
release_authorized: false
issue_comment_writer: manager
issue_comment_allowed_types: PLAN, STATUS, EXCEPTION, FINAL
documentation_owner: Manager

요청 종료점은 구현·관련 문서 갱신·미해결 리뷰 및 충돌 처리 후 exact-head PR Full CI 시작이다. CI 결과 모니터링·병합·Main/GHCR·tag/release·브랜치 정리·Issue 종료는 제외한다. 미연결 모듈 준비는 #552 제품 해결 또는 최종 QA/Owner ACCEPT가 아니다.

## 기준선 / 의존성 / 필독

- repository: planner77/masterGantt; Issue https://github.com/planner77/masterGantt/issues/666.
- baseline main/document commit: `d445ec58bf9106414c99a150ee8f52599834baf9`; 선행 #663 / PR #687의 병합을 확인했다.
- branch: `feat/issue-666-axis-transaction`; 별도 worktree를 생성하고 기존 작업자료를 보존했다. 착수 당시 관련 구현 PR 없음.
- application/lockfile: `0.114.0`; 설치 React Gantt `2.7.3`, transitive gantt-store `2.7.2`. 미활성 모듈·fixture만 추가하므로 version 유지, package/lockfile 변경 없음.
- GSC `1.0.0-candidate` / REVIEW_PENDING: [표준](../../GANTT_STATE_CONSISTENCY.md), [Conformance](../../GANTT_STATE_CONFORMANCE.md), [ADR](../../GANTT_ADAPTER_ADR.md), [Trace](../../GANTT_SYNC_TRACE.md), [보완계획](GANTT_STATE_REMEDIATION.md)을 위 document commit에서 읽었다. 적용 GSC-04/05/07/08/09/10/11 및 SC-08/09/10/12/14.
- AGENTS 및 REQUIREMENTS/ARCHITECTURE/API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/TEST_PLAN/REMOTE_VALIDATION/CI_CD/GITHUB_OPERATIONS/ISSUE_LIFECYCLE/QA_REVIEW_POLICY/DESIGN/UI_UX_GUIDELINES/active PLAN을 영향 분석에 적용한다.
- #569 A/B/C의 기존 FAIL/DEFER와 #571 production compatibility 경계를 보존한다. U2 #664/U3 #665 구체 구현 의존 없음. U5 #667은 기존 #552/PR #561의 유일한 제품 wiring 소유자, #573 작은 화면/focus와 #574 최종 통합 검증은 별도다.

## 역할 / 파일 소유권

- Manager `/root`: 범위·interface 조정, Work Packet 및 관련 문서, GitHub Lifecycle 기록·PR·CI 등록.
- frontend `/root/axis_impl`: 신규 `src/features/gantt/viewport/axis-transaction.ts`, 전용 `tests/features/gantt/axis-transaction.test.ts`.
- frontend `/root/axis_browser`: 신규 `tests/fixtures/gantt-axis-transaction/**`, 전용 실제 Core 검증 테스트.
- ui_ux `/root/axis_ux`: geometry/fallback/user priority read-only 검토; 파일·원격 쓰기 없음.
- qa_docs: DOCUMENTATION_SYNC 뒤 별도 read-only 사전 검토. 최종 QA_FINAL 또는 Owner/Manager ACCEPT와 구분한다.
- `project-gantt.tsx`, production `svar-viewport-port.ts`/`viewport-coordinator.ts`, Workspace/marker, 기존 A/B/C fixture 및 package/CI는 읽기 전용이다. 신규 facade를 production에서 import하지 않는다.

## 상태 / 전략 / 안전 경계

U1 public GeometryReaderPort·ConsistencyClockPort·ConsistencyAbortPort·UserIntentLease를 소비하며 requested date extent·API/query/axis identity·원래 lease·viewport 정책을 구분한다. observation 증가나 await 뒤 새 lease로 과거 작업을 재승인하지 않는다. 유한 prepare → axis change → actual geometry → valid viewport policy → Core/native settle을 사용하며 resize 부수 좌표를 목표로 채택하지 않는다.

최신 공식 문서 조회일 2026-10-15: [resize-chart](https://docs.svar.dev/react/gantt/api/actions/resize-chart/)는 현재 물리 container width/height/scrollSize를 정의한다. [scales](https://docs.svar.dev/react/gantt/guides/timeline/scales/)의 explicit start/end 및 autoScale 설명은 설치2.7.3 same-instance 상태 보존의 증거가 아니다. [scroll-chart](https://docs.svar.dev/react/gantt/api/actions/scroll-chart/)의 공개 명령 반환과 실제 Core/native settle을 구분한다. 설치 runtime 비교와 전략 판정은 아래 실행 원장 및 ADR에 기록한다.

날짜 coverage와 실제 width/height/scrollSize/capacity/X/Y를 별도 검증한다. 기존 좌표가 불가능하면 명시 clamp 또는 unavailable을 반환하며 hidden/zero-size는 성공이 아니다. 실제 사용자 wheel/reveal·새 query/axis/API·hidden/unmount가 원래 lease를 취소한다. synthetic 폭 적용 도중 취소된 불완전 geometry를 자동 재사용하지 않는다. server mutation·Core data/tree/link/membership/revision 변경·두 번째 production writer는 허용하지 않는다.

## AC_TEST_COVERAGE

- AC1: 전용 실제 Core fixture의 A/B/C 비교·설치 source/lockfile fingerprint와 `docs/GANTT_ADAPTER_ADR.md`의 선택·기각·DEFER/위험 판정.
- AC2: `tests/features/gantt/axis-transaction.test.ts` 및 실제 Core fixture에서 zero rows/no-match/M-only의 axis coverage와 명시 origin/preserve, resize X=100 부수 결과 거부.
- AC3: 같은 Unit 및 실제 fixture에서 원래 lease 취소, wheel/reveal/query 우선·과거 position 후속 replay 금지.
- AC4: 전용 실제 fixture와 Unit의 Day/Week·short/large·390/1440·layout/fullscreen/column resize·capacity clamp/unavailable·hidden/zero-size typed 결과.
- AC5: 전용 Unit의 coalescing/busy/유한 budget/overflow/cleanup, 실제 fixture의 same API instance·정규화 task/tree/link 불변·server mutation 0 및 bounded lifecycle 확인. 제품 membership/revision·HTTP/SQLite 증거는 U5 후속이다.
- AC6: 신규 facade·U1 public port 의존, production consumer 0 및 기존 assertions/timeout/skip/package/CI 변경 0 확인. 실제 fixture source/provenance와 U5 연결·rollback 계약을 인계한다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_666.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/GANTT_ADAPTER_ADR.md`: UPDATED
- `docs/GANTT_SYNC_TRACE.md`: UPDATED
- `docs/GANTT_STATE_CONFORMANCE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/GANTT_STATE_REMEDIATION.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(규범 버전과 MUST 및 REVIEW_PENDING 상태 불변이며 구현 현황은 Conformance에 기록)
- `AGENTS.md`: N/A(기존 실행 지침과 GSC 필독·역할·권한·검증 gate 적용이며 지침 수정 없음)
- `docs/REQUIREMENTS.md`: N/A(미연결 모듈이며 제품 기능 계약 변경 없음; 인수 기준 원본은 Issue666)
- `DESIGN.md`: N/A(제품 시각 언어·화면·사용자 flow 변경 없음; DESIGN Delta A 부재)
- `docs/UI_UX_GUIDELINES.md`: N/A(제품 interaction·focus·접근성 계약 변경 없이 fixture에서 검증)
- `docs/PROJECT_UX.md`: N/A(제품 연결과 실제 사용자 flow 변경은 U5 전용 범위)
- `docs/MILESTONE_TIMELINE.md`: N/A(Milestone 표시·canonical subtree·membership·revision 계약 불변)
- `docs/API.md`: N/A(REST API·권한·Origin·revision 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB schema·migration·실제 SQLite 변경 없음)
- `docs/SECURITY.md`: N/A(합성 allowlist fixture만 사용하며 기존 보안 정책 불변)
- `docs/SCHEDULING_ENGINE.md`: N/A(서버 일정 계산과 기존 date-only 알고리즘 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(Import schema·호환성·파일 처리 변경 없음)
- `docs/VBA_EXPORT.md`: N/A(Excel·VBA·DRM 관련 실행 및 기능 변경 없음)
- `docs/DEPLOYMENT.md`: N/A(Docker·Compose·runtime·운영 배포 변경 없음)
- `docs/CI_CD.md`: N/A(기존 workflow·Required gate·권한·릴리스 계약 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(공식 전체 회귀·main GHCR·환경별 증거 경계 그대로 적용)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical Issue/PR·QA·운영 정책을 적용하며 정책 변경 없음)

## 로컬 실행 원장 / 미검증

구현·실제 Core 최종 source 수집·별도 사전 검토를 완료했다. 이전 #569 PoC 또는 #663 reader PASS를 새 모듈 PASS로 전용하지 않는다.

- Manager 관련 LFF: `npm test -- tests/features/gantt/axis-transaction.test.ts tests/features/gantt/viewport-coordinator.test.ts tests/features/gantt/svar-viewport-port.test.ts tests/features/gantt/timeline-range.test.ts tests/domain/gantt-adapter.test.ts tests/features/gantt/state-consistency-contract.test.ts tests/features/gantt/core-reader.test.ts tests/domain/core-action-trace.test.ts` → 8파일170 tests PASS. 이는 첫 implementation source의 결과이며 후속 P2 보완 결과는 별도 기록한다.
- Markdown222개 local link/version0.114.0/diff 공백 검사 PASS. 구현 담당의 Unit18/typecheck/scoped lint PASS와 별도 QA의 focused159 tests PASS는 같은 고유 테스트의 일부를 반복 실행한 것이며 합산 표본으로 과대 표시하지 않는다.
- 별도 qa_docs 사전 P2: 요청 union의10년 상한만 검사하면 callback이 실제100년 축을 반환해도 SETTLED로 승인되는 반례를 독립 재현했다. 실제 observed axis의 초기/coverage/physical/settle 모든 단계에도 동일 상한을 검증하도록 보완했다. 신규4phase 반례와 초기/await후 권한 읽기 예외3개를 추가해 최종 Unit25 PASS다. isLeaseCurrent/abort.isCurrent 예외가 typed 결과 대신 원문으로 reject되는 보조 반례도 sticky authorityReadFailed와 FAILED/PORT_FAILED 정규화로 보완했다. 원본 소스385809의 브라우저69case는 intermediate로 보존하고 최종 implementation SHA256 `e747196c95b95235fb8b3be0b25cf7fa88043742b95403eabcad14971995368a`로 다시 수집한다.
- 최초 fixture 오류: bounded child height 누락으로 Core top36/native0을 관측했다. A/B/C의 object 인수인 scroll에 number를 전달해 baseline left0인 초기62case를 수집했다. 이 원본은 실패 원장/초기 snapshot으로 보존하고 지원 PASS 근거에서는 제외한다. 실제 wheel이 아닌 dispatch와 단순 invalidate 주입은 실제 사용자 입력으로 판정하지 않으며 실제 barrier·page.mouse.wheel·public Core reveal/filter/column/physical resize 관측으로 보완한다.

공식 quality/e2e/docker·Trusted QA·QA_FINAL·Owner/Manager ACCEPT는 NOT TESTED. main/GHCR·정식 release·운영/최종 수동 UX는 이번 범위 밖이다. native fullscreen 권한/실기기·대규모 제품 통합·HTTP/SQLite는 합성 browser fixture로 대체하지 않는다.

## 인계 / 롤백

U5는 원래 Coordinator lease를 등록 시점부터 유지하면서 단일 facade를 호출해야 한다. 실제 strategy 지원 프로파일과 DEFER 범위를 확인하고 필요한 production wiring을 별도 source에서 수행한다. 취소된 synthetic geometry는 자연적인 물리 복귀를 실제로 확인하기 전 유효한 상태로 재사용하지 않는다. 모듈·연결 소비자는 함께 rollback하며 기존 compatibility 경로의 알려진 한계를 정상화 PASS로 표시하지 않는다. 서버/DB rollback 없음.

## 사전 검토 보완 원장

별도 qa_docs `/root/axis_qa`는 파일 수정 없이 `node --import tsx --input-type=module` 임시 stdin 실행으로 실제100년 axis/정상 geometry를 반환하는 port 반례를 재현했다. 첫 implementation385809에서는 SETTLED/APPLIED였으며 보완 뒤 실제 날짜 horizon 초과는 fail-closed다. 같은 방식으로 isLeaseCurrent에서 throw하는 반례의 원문 Promise reject를 확인하고 FAILED/PORT_FAILED로 보완했다. 원본159 tests/상한 보완163 tests/최종 실행은 source별 반복 실행이며 합산 고유 case 수로 사용하지 않는다.

최종 facade 기본값: maxFrames120, maxDurationMs1500, maxScaleWidth1,000,000, maxExtensions3. 설정 상한은 maxFrames600, maxDurationMs5000, maxScaleWidth1,000,000, maxExtensions3이며 날짜 union과 실제 관측 extent 모두10calendar years다. 자체 dispose·명시 abort는 active signal을 즉시 abort하고 isCurrent만 변한 경우는 다음 frame에서 재확인한다. 지연 callback은 context.current()/signal을 검사해야 하며 새 lease 발급으로 오래된 작업을 재승인하지 않는다.

## 실제 Core 결과 / 인수 범위

최종 implementation SHA256: `e747196c95b95235fb8b3be0b25cf7fa88043742b95403eabcad14971995368a`. `tests/fixtures/gantt-axis-transaction/actual-core-2.7.3.json`은 baseline main+변경 source/lockfile 지문, 실제 Chromium153/Asia-Seoul, 명령·실패 원장·프로파일별 전후 Core/native 및 typed 결과를 고정한다. mode U1은 U1 공통 port를 소비하는 U4 trial이다. prepare-browser build 시 지문과 record 시작/끝 지문을 대조하여 실행 도중 source가 바뀐 캡처를 최종 증거로 채택하지 않는다.

- A/B/C/U4의5폭×Day/Week40profile: A/B는390에서 NO_SCROLL_CAPACITY,768/1024/1440/1920에서 각각3회 정착. C는390에서 NO_SCROLL_CAPACITY, Day768/1024/1440에서 첫 회 TIMED_OUT(좌표 보존 실패) 및 이후 NOT TESTED, 그 외 넓은5profile에서3회 정착.
- U4 explicit facade는768/1024/1440/1920×Day/Week의8profile×3회24확장에서 실제 axis/capacity 증가 및 같은 API·X/Y·selection을 보존하여 SETTLED/PRESERVED.390의2profile은 NOT_MEASURABLE/UNAVAILABLE로 제품 fallback DEFER다.
- short16case:1440의Day/Week×normal/global empty/M-only/no-match8case는ORIGIN Core/native0/0 SETTLED,390의8case는NOT_MEASURABLE. no-match4case는 실제 filter-tasks로canonical60/visible0 및 task/tree/link 불변을 확인했다.
- 초기단계6취소 모델과 extent commit 이후 실제6입력을 구분한다. 후자는 actual page.mouse.wheel137/nativeX100→237, public Task/Milestone reveal·filter-no-match·열변경·물리 폭변경이며 모두heldWrites1 이후 SUPERSEDED/lateWrites0이다. query/reveal 모델 주입을 실제 사용자 입력으로 사용하지 않는다.
- C actual syntheticwrite1 이후 취소: SUPERSEDED, restoringWrites0, 동일API facade 재생성도 COMPATIBILITY_TAINTED. 자연 physical resize의 실제 관측은 taint 자동 해제 승인이 아니며 재사용은 계속 거부한다.
- 별도 qa_docs는 actual Chromium2case(확장 중 실제 wheel, Week-short 실제 filter0→ORIGIN)를 독립 재실행 PASS했고 원본69capture의8개source fingerprint 일치를 확인했다. fixture assertions를 포함한 독립6파일173tests PASS는 브라우저69profile 개수와 다른 수치다. 최종 추가capacity/post-settle 결과와 최종Unit 수는 아래 게시 인계에서 확정한다.

AC1은 신규 제한 profile의B전략/기각 이유/위험·DEFER를 ADR에 기록했다. AC2/3/5의합성module 범위는 실제 Core·불변성·취소와Unit으로 검증했으며 제품 membership/revision·HTTP/SQLite를대신하지않는다. AC4는 실제 관측한 Day/Week/폭/short/large/physical 변경/hiddentyped 범위까지만 충족한다. nativefullscreen/실제제품UI resize·marker정렬·390fallback·대규모SC14는NOT TESTED/U5·#573/#574후속이다. AC6은productionconsumer0/packageCI0/기존test완화0 및U1portfacade/source인계로검증한다. 따라서 전체 제품 AC PASS·최종 MODULE_READY/Owner ACCEPT로 확대하지 않는다.

## 실제 capacity 경계 실패 / 최종 인계 조건

추가한 실제3case를 포함하여 최종 capture는72개 scenario group이다. 이는72개 제품 PASS가 아니다. capacity 밖 요청을 allowClamp=false로 거부하는 case는 NO_SCROLL_CAPACITY/UNAVAILABLE 및 쓰기0이다. allowClamp=true는 실제 requested.left5393·native 계산 capacity.left5293·Core/native 실제5292에서 TIMED_OUT/UNAVAILABLE이다. **실제 full-capacity clamp 지원 FAIL**, 제품 지원 DEFER로 판정한다. Unit의 SETTLED/CLAMPED는 그 결과를 실제로 확인할 수 있는 fake port 계약 검증이며 이 실패를 대신하지 않는다. Core exact/native±1을 늘리거나 임의1px 보정으로 성공을 만들지 않는다.

U1 GeometryReaderPort는 실제 native geometry와 Core 위치를 제공하지만 Core 자체의 최대 capacity를 별도 필드로 제공하지 않는다. U4는 false PASS 없이 유한 timeout을 반환한다. U5는 동일 source에서 실제 Core/native 유효 capacity의 교집합을 관측하는 port 계약을 먼저 결정해야 하며, 검증 없이 allowClamp=true의 제품 지원을 선언하지 않는다. 공통 interface나 production writer를 이번에 임의 확장하지 않는다.

완료 뒤 실제 wheel은 SETTLED 이후 nativeX100→237, facade 쓰기2 유지 및 replay0으로 확인했다. 초기 단계6취소·중간 실제6입력·완료 뒤 실제 wheel을 서로 구분한다. native fullscreen/대규모 lifecycle·390px fallback·실제 full-capacity clamp·제품 marker/HTTP/SQLite 통합은 최종 제품 PASS 범위에서 제외한다.

분류검증용 신규 fixture Unit은 실패의 실제 outcome/좌표를 명시적으로 검사하며 이전 테스트의 assertion/timeout/skip을 수정하지 않는다. 신규 실제 clamp 성공 기대 검사가1FAIL한 원본을 기록하고 성공 지원 검증 대신 알려진 실패 분류검증으로 정정한다. 실패 run을 성공으로 소급 변경하지 않는다.

## 최종 빠른 검증 / DOCUMENTATION_SYNC / 게시 인계

- 최종 실제 capture: `2026-10-15T02:26:31.250Z`, 72 scenario groups, implementation SHA256 `e747196c95b95235fb8b3be0b25cf7fa88043742b95403eabcad14971995368a`, browser `a6d0a79a58431e1d178b78a3003ccdaafbea6a95ae914c6712d144b77e1571cb`, record `6cf1866b94c00ce80feee1683804ccefcd3aff15a62d9cbd43cda400b5d06995`. source/lockfile 8개 지문 일치를 확인했다.
- Manager 최종 관련 LFF: 위 8파일에 `tests/features/gantt/axis-transaction-runtime-fixture.test.ts`를 추가한 9파일 186 tests PASS. 신규 module25 + capture분류9 =34 tests를 포함한다. 같은 테스트의 반복 실행을 합산하지 않는다.
- typecheck/scoped ESLint/version0.114.0/Markdown222/diff 공백/production consumer0/packageCI0/DOC_SYNC 구조·AC1~6 mapping PASS. 의미적 문서 검토도 별도 qa_docs가 완료했다. 최종 exact Head/CI 시작은 Issue/PR STATUS에 기록한다.
- 별도 read-only qa_docs `/root/axis_qa`: 실제100년 axis·authority throw 반례를 독립 재실행하여 수정 후 fail-closed를 확인했다. 실제 Chromium2case(중간 wheel·Week-short filter0→ORIGIN)도 독립 PASS. 최종72capture의8source hash 일치·원본 실패·범위 제외를 확인하고 관련6파일175tests 독립 PASS. 미해결 P1/P2 지적0건은 한정 module/code/doc 범위이며 실제 full-capacity clamp의 FAIL은 남는다.
- DOCUMENTATION_SYNC: 지정9문서 갱신 및 각 N/A 근거를 확인하고 의미 경계는 실제 실패·DEFER·미검증과 일치한다. 별도 사전 검토는 정식 QA_FINAL/Owner/Manager ACCEPT가 아니다.

최신 main 정렬·PR Head/base/test merge·review thread 수·CI run_id/run_attempt/URL은 게시 직전 및 PR 생성 뒤 GitHub Issue/PR STATUS에 기록한다. 신규 단일 PR을 생성하고 CI 시작만 확인하며 결과 모니터링하지 않는다. 공식 quality/e2e/docker·Trusted QA·QA_FINAL·Owner/Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED를 유지한다. Issue는 OPEN이고 merge/main/GHCR/release/tag/cleanup은 실행하지 않는다.
