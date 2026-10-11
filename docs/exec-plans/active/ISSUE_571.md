# Issue #571 — 단일 Viewport Coordinator

## 범위와 결정 (2026-10-11)

사용자 요청은 구현·문서 동기화·독립 PRE_QA 후 PR CI 시작까지다. Issue 본문의 과거 등록 전용 문구는 이번 구현 요청으로 대체한다. 병합·main CI·GHCR·Release·Issue 종료는 포함하지 않는다.

- 기준 main: `ac2a3f69d09da1cbc7e4f833da0fa0515434f895` (#570 PR #592 병합).
- 브랜치: `feat/issue-571-viewport-coordinator`.
- Application PATCH `0.104.1 → 0.104.2`: 기존 기능의 viewport 소유권·경쟁 복원을 보완한다.
- `risk_level=HIGH`, `qa_required=true`, `qa_method=AGENT`; 실제 독립 Reviewer는 `/root/issue570_qa_fix`.
- 위험 사유: 여러 화면의 비동기 복원과 실제 입력이 경쟁하며 기존 viewport 회귀가 반복된 영역이다. package.json/lockfile 변경도 포함하므로 protected 인간 최종 QA gate를 유지한다.
- `release_required=true`, `release_authorized=false`, `manager_decision=NOT TESTED`. PR CI 시작은 ACCEPT나 제품 전체 PASS가 아니다.
- 이번 대화에서 직접 제공된 AGENTS #595에 따라 manifest/lock을 포함한 protected AGENT 변경의 최종 판정에는 작성자와 다른 신뢰된 인간의 현재 Head `QA_FINAL: PASS`, 세 필수 CI 및 그보다 늦은 Owner ACCEPT가 필요하다. 별도 Agent의 PRE_QA는 이를 대체하지 않는다. 이 조건은 PR CI 시작을 막지 않으며 최종 병합 gate는 BLOCKED로 유지한다.
- 상위 #567, 선행 #568/#569/#570, 회귀 #514/#518/#529/#367 및 #344/#456/#490. #549 기반과 #550~553 미통합 제품 표시 stack을 구분한다.

## 구현 전 UX·소유권

현행 AppShell → Project → 일정/Milestone/리소스/물류 → scope/filter/scale toolbar → Grid/Chart 배치를 유지한다. 문제는 동일 viewport를 parent peer DOM 복원·child peer/metadata 복원·range 확장이 각각 쓰는 것이다. 목표는 현재 사용자의 이동을 보존하고 새 의도보다 오래된 복원을 실행하지 않는 것이다.

DESIGN Delta B: 기존 UX-12 상태 보존 원칙의 구체화. `DESIGN.md: N/A`. ui-ux-pro-max 검색은 이 상태 머신에 직접 적용할 결과를 주지 않아 기존 DESIGN/화면 계약을 우선한다. 새 smooth scroll/시각 체계를 도입하지 않는다.

| 역할 | 소유권 |
| --- | --- |
| Manager /root | Work Packet·문서·manifest/lock 버전·GitHub 기록·원격 게시 |
| frontend /root/issue570_frontend_fix | production port·Gantt/parent 연결·관련 E2E |
| frontend /root/issue571_unit | pure Coordinator 제품 모듈·전용 Unit; 초기 구현자 인계 ACK 이후 단독 소유 |
| ui_ux /root/issue571_ux | read-only interaction·반응형 설계 검토 |
| researcher /root/issue571_research | read-only 공개 API·Core2.7.3 경계 검증 |
| explorer /root/issue570_queue_review | read-only 전체 writer inventory |
| qa_docs /root/issue570_qa_fix | 실제 별도 read-only 독립 PRE_QA |

동시 파일 수정·타인의 변경 되돌림을 금지한다. 부모는 immutable capture와 typed intent만 제출하며 Gantt DOM 복원 loop를 제거한다. Resource 자체 표·tablist·focus 스크롤은 기존 소유권을 유지한다.

## 인터페이스·상태 머신

순수 `viewport-coordinator.ts`는 API instance/context identity, intent/projection/geometry/user gesture epoch, pending operation, bookmark 및 결과를 소유한다. `svar-viewport-port.ts`만 앱의 Core scroll-chart 및 Gantt native viewport 보정·range 명령을 실행한다. project-gantt는 UI intent·projection receipt 전달, parent는 capture/request ingress만 사용한다.

우선순위는 실제 사용자 wheel/pan·명시 Task/date reveal > scope/filter > 정합한 peer return > passive metadata/column/scale 보존이다. 수신 시각만으로 passive를 최신 사용자 의도로 간주하지 않는다. intent가 생성된 gesture/context 세대와 priority를 함께 검사하며 superseded 작업은 후속 명령을 실행하지 않는다. Native Core wheel/Grid selection reveal은 Core 소유이며 scroll 이벤트를 재귀 enqueue하지 않는다.

상태는 IDLE → WAIT_PROJECTION → PREPARING_GEOMETRY → WAIT_PROJECTION/WAIT_GEOMETRY → APPLYING → SETTLING → SETTLED. SUPERSEDED/NOT_MEASURABLE/NO_SCROLL_CAPACITY/TIMED_OUT/FAILED를 구분한다. 명령 반환/Promise는 완료 증거가 아니다. 기존 compatibility resize 준비가 실제로 명령을 발행했으면 준비 전 generation보다 새로운 성공 receipt를 요구한다. 최신 성공 projection receipt의 동일 API/revision/scope/filter/scale/columns/display 문맥과 실제 visible nonzero geometry, Core exact/native ±1px의 3연속 frame을 유한 예산으로 확인한다. hidden/inert/detached 또는 입력/context 변경·dispose는 stale 작업을 무효화하고 RAF/listener/timer를 해제한다. 동일 canonical revision에서 관측 generation만 바뀌는 WAIT 단계는 최신 receipt를 따르고 geometry 안정 frame을 다시 센다. 적용 직전 generation을 고정하며 그 뒤 변경은 SUPERSEDED다. metadata revision 증가만으로 remount/reset하지 않는다.

필터 시작 전 bookmark는 필터 중 새 wheel/pan/reveal/scope 이동이 없을 때만 복원 가능하다. 0행 결과에 비영점 bookmark를 재생하지 않는다. Grid/Chart capture의 wheel/pointer/touch/keyboard는 이전 복원을 취소하지만 toolbar/Editor 입력을 viewport 이동으로 오인하지 않는다. Editor '일정에서 보기'도 명시 Task reveal로 연결한다.

#569 실험 adapter의 제품 채택·새 날짜 좌표 수식·synthetic capacity 도입은 DEFER다. 기존 #367 range 확장은 회귀 보존 대상으로 단일 ingress/port로 옮기며 기존 호환 경로가 공식 capacity 지원으로 승격되었다고 주장하지 않는다. 신규 out-of-capacity 요청은 bounded unsupported 결과로 끝낸다. #551 lane/Week header 의미 gate는 이번 Coordinator로 PASS가 되지 않는다.

현재 제품의 Grid Task 시작일 이동은 기존 Core native reveal을 유지한다. Editor Task reveal은 현재 관측한 행/bar geometry에서 공개 left/top 명령을 만든다. 날짜가 있는 Task는 실제 Core scale 날짜 범위를 먼저 검증하고 범위 밖 요청을 유한 실패로 끝내며 clamped $x를 실제 날짜 가시성으로 승인하지 않는다. 날짜 없는 summary-container는 인공 anchor로 수평 이동하지 않고 현재 left를 보존한다. 미통합 #551 소비자의 DATE_REVEAL typed 요청은 UNSUPPORTED이며 비문서화 scroll-chart(date)를 새 제품 지원으로 도입하지 않는다.

## 검증 계획·완료 경계

| AC | 근거/검증 |
| --- | --- |
| 1 | Resource peer no-input120, 실제 wheel≈30 우선, 늦은120 재적용0·Core/native 정합 |
| 2 | metadata/설정 저장·delete normal/401/412/network, instance/tree/selection/columns/scale/viewport/revision 계약 |
| 3 | Grid start reveal·Editor locate 후 metadata, filter typing/clear/bookmark·0결과·타 scope |
| 4 | 기존 Day/Week 3회 right-edge, 390/768/1024/1440/1920 clipping·hidden/tab return; #551 미통합 lane 별도 NOT TESTED |
| 5 | Unit priority/epochs/receipt 실패·timeout/hidden/capacity/dispose, trace 단일 writer 및 stale 명령0 |
| 6 | 문서 정합·실제 독립 PRE_QA, 새 exact-head 공식 quality/e2e/docker CI 시작 |

관련 Local Fast Feedback와 원격 전체 CI를 분리한다. PRE_QA는 QA_FINAL/Manager ACCEPT가 아니다. 로컬 실행 증거는 아래 원장에 기록하며 원격 전체 CI는 시작 전 NOT TESTED다.

## 초기 검증 원장

- 순수 Coordinator 첫 보강 suite 29 PASS, 추가 actual geometry 안정 관측 검증을 포함한 후속 suite 30 PASS. test-only 주입 가정 오류 1 FAIL은 harness를 의미 기반 관측으로 수정한 뒤 재검증했다. 실제 DOM/port/원격 CI PASS로 확대하지 않는다.
- 첫 실제 Core Chromium `/tmp/issue571-browser1.log`: 기존 metadata 2개와 late native0 경계 1개 **0 PASS/3 FAIL**. active filter `task-editor-form-density.spec.ts:229` 및 late0 `:262`는 metadata 저장 전 설정한 public left120이17로 관측됐다. 최초 실패를 숨기거나 기대값을 변경하지 않는다. 새 async range/restore 경합은 이 시점 원인 가설이며 실제 trace와 후속 실행으로 확인한다.
- 같은 최초 실행의 fullscreen `:166`은 native chart left120 대신33이다. 세 실패 모두 저장 전 단계이며 metadata 저장 후 실패로 잘못 귀속하지 않는다.
- 독립 explorer의 active filter trace: 15720.302ms의 call47은 DOM47/Core46이고 이전 RANGE_EXTENSION은 SUPERSEDED/writes0, 15840.495ms call51은 RANGE_EXTENSION SETTLING/writes2와 resize1904→906 이후 Core/DOM17, 16122.846ms call55는 SETTLED/writes3이다. 실제120이 성립한 뒤17로 복원된 것이 아니라 초기 capacity 부족의 clamp와 지연 확장의 결합이다. 세 번째 write의 구체 종류는 당시 JS 산출물 미보존으로 UNKNOWN이다.
- 설계 보완: RANGE_EXTENSION은 좌표 복원이 아닌 기존 geometry 호환 명령이다. 단일 ingress/port에서 visible/API/context를 확인해 기존 동기 resize pair를 즉시 발행하고 receipt/geometry만 후속 관찰한다. 좌표 복원/reveal의 최신 projection 대기는 유지하며 range가 과거 좌표의 repair/보호 authority를 갖지 않도록 구분한다.
- 두 번째 Chromium `/tmp/issue571-browser2.log`: **2 PASS/1 FAIL(17.2초)**. active filter·late native0는 PASS, fullscreen은 여전히 저장 전 `:166` native120 대신0으로 FAIL이다. 첫 실행의17/33과 구분하며 no-op metadata 요청의 지연 snapshot 재생을 확인한다.
- range 전용 Unit 보강은 **31 PASS/1 FAIL**로 현재 Core120/native17 불일치에도 SETTLED를 반환하는 관측 결함을 발견했다. range의 fixed-position repair를 제거하더라도 현재 Core/native 정합의 3frame 성공 조건은 유지해야 한다. 보완 후 새 결과를 별도로 기록한다.
- 세 번째 Chromium `/tmp/issue571-browser3.log`: **2 PASS/1 FAIL(17.6초)**. fullscreen의 초기120/38은 성립했지만 Editor 탭 순회·취소 이후 `:187`에서 Core/native0/0이 됐다. metadata 저장은 `:189` 이후이므로 이 실패는 저장 전 Editor 취소 상태 보존 회귀다. 앞선 초기 capacity 실패와 구분한다.
- 세 번째 trace의 독립 원인 분석은 실제 reset이 Editor보다 앞섰음을 확인했다. 5857.416ms call67은120/38, 5898.3ms PASSIVE_RESTORE WAIT_GEOMETRY(writes14), 5975.037ms는 requestedLeft0/Core0/0 SETTLING(writes15), 6096.844ms는0/0 SETTLED(writes16)다. 첫 context-menu right-click은6140.093ms call103이다. API/sync generation7/revision20/receipt26은 유지되고 capacity도 충분했다. 따라서 assertion은 취소 뒤 실패했지만 첫 원인은 늦은 no-op passive0 재생이며 Editor/native-add/hidden을 원인으로 귀속하지 않는다. no-op handoff capture는 유지하되 좌표 ingress를 생략하고 실제 metadata/revision 복원과 진단 scroll을 분리한다.
- 네 번째 Chromium `/tmp/issue571-browser4.log`: **1 PASS/2 FAIL**. fullscreen은120/38에서0/38, latezero는저장후 assertion `:274`에서0이다. 최신 trace에서 첫 reset은 앱 write 증가 없이 scale/area 폭204로 축소→native/Core0→후행 range 복구였으며 세 번째 실행의 PASSIVE0 재생과 구별한다. fullscreen5629.907ms writes14/120→6352.049ms writes14/0, latezero16265.614ms native120→16279.509ms native0·폭204→16314.375ms Core0/writes10이다. 내부 축 축소의 원인은 이 시점 UNKNOWN이다. no-op 전면생략만으로 상태 보존 계약을 만족하지 못했으므로 최종 해법으로 채택하지 않는다.
- pure Coordinator와 Unit 소유권 인계 후 range 정합·abort cleanup·trace tokens/decisionReason·명령 전후 projection/geometry 재검증을 보완했다. **36 Unit PASS 및 typecheck PASS**. 최종 이 단계 제품 SHA256 `922b0f217dd08d558f24e61b2b620b05bae2f4c079ab6a4bbfede37673838873`, Unit `01399f902d9653bd334449459b10260019d9266aed64e64f07a2384e1d0f15a0`. 실제 port/DOM 및 원격 CI PASS와 구분한다.

## 고정 소스 후속 검증

- 다섯 번째 Chromium `/tmp/issue571-browser5.log`: **1 PASS/2 FAIL(20.4초)**. fullscreen `:187`과 latezero 초기 `:262`에서 실패했다. 실행 시작 후 제품 소스가 바뀌었으므로 최종 고정 소스 검증 근거로 사용하지 않는다.
- 여섯 번째 `/tmp/issue571-browser6.log`: fullscreen **1 FAIL**, `:187`에서 left120→0/top38 유지. history의 PASSIVE_RESTORE120/38은 WAIT_PROJECTION 중 같은 revision의 관측 generation30→32를 STALE_PROJECTION으로 처리해 SUPERSEDED됐다. 적용 전 관측 갱신과 실제 stale 적용을 구분한 후 재실행했다.
- 순수 보완 후 **39 Unit PASS / typecheck PASS**, freeze `2026-10-11T09:02:27Z`. 제품 SHA256 `ef4a5028a3a524f3acf1039b0b42ecb3e647aa0dd79f778ea705ff75e60eed52`, Unit `be223e7e96415061219a8c6b70564cdfc8091b29ca0473121d426133f160ba9c`. WAIT 최신 receipt·generation별 geometry 재시작·명령 후 generation 변경 시 추가 repair0을 구분해 검증한다.
- 고정 제품 `/tmp/issue571-browser7.log`: 기존 fullscreen·active filter·late native0 **3 PASS**, 신규 Editor locate는 제품 명령 전 fixture의 가상화 행 순서 때문에 **1 FAIL/TIMEOUT**. fixture 순서·명시 Task ID locator만 보완했다.
- 같은 제품 `/tmp/issue571-browser8.log`: **4 PASS(12.2초)**. pending peer의 실제 wheel, filter source 변경, native Grid의 양방향 Task start reveal, 신규 Editor locate의 실제 top 이동·행 focus·후속 Project metadata 좌표 유지다. 제품 4개 지문은 `/tmp/issue571-browser7-source.sha256`에 고정했다.
- 변경 lint는 **0 errors / 기존 hook warnings3개**, typecheck PASS다. 실제 독립 PRE_QA와 추가 직접 영향 matrix는 진행 중이며 원격 전체 quality/e2e/docker, 최종 QA_FINAL·Manager ACCEPT는 NOT TESTED/별도 gate다.

## 독립 PRE_QA 보완

- 첫 독립 Chromium subset **9 PASS(31.6초)**: `/tmp/issue571-independent-browser.log`, 고정 제품 지문과 함께 보존한다. scoped quick filter의 0행에서0·해제 후 bookmark120 복귀, 필터 중 실제 wheel 후 bookmark 부활0 및 readonly mutation0을 포함한다.
- 독립 qa_docs는 별도 pure 실행으로 SETTLED rev3/gen5 이후 동일 geometry의 rev4/gen6·이전 receipt에서도 잔존 guard가 current=true/release증가0임을 확인했다. 실제 사용자 브라우저 실패로 확대하지 않지만 새 revision에서 이전 authority가 native repair/차단할 수 있어 REWORK로 판정했다. 완료 authority에도 accepted revision/generation 및 최신 유효 receipt를 요구하도록 보완 후 재검증한다.
- 날짜 있는 Task의 Core $x가 axis 경계로 clamp될 수 있어 finite geometry만으로 Task 날짜 reveal을 승인할 수 있다는 정적 REWORK를 확인했다. 실제 scale start/end admission을 추가하고 범위 밖은 bounded 결과로 끝낸다. summary-container는 인공 날짜이므로 이 admission에서 제외하고 수평을 보존한다. 새 날짜 좌표 수식이나 #569 adapter 채택은 하지 않는다.

- pure guard REWORK 보완 후 **43 Unit PASS / typecheck PASS**, freeze `2026-10-11T09:08:36Z`. 제품 SHA256 `6cf3e3ed443da677be8e0d9a25b4dd85d125786535fc6e30818c08131d1f15d7`, Unit `5518a9208757d2099663e676cff200c7e08f990ad013ddefd9dd5e646f7bc4e4`. 동일 geometry의 canonical revision 변경·새 generation·동일 generation의 invalid receipt 모두 잔존 authority 해제, 진행 중 invalid receipt 이후 repair0을 검증했다.
- writer inventory의 범위는 production 앱 경로다. 기존 #549 개발 전용 `__masterganttMilestoneTimeline.reveal → revealMilestoneDate`의 직접 scroll-chart와 #569 PoC/trace fixture는 명시적 진단 예외다. 별도 nativeDateReveal probe는 port를 통과하지만 진단 코드 전체의 단일 writer를 주장하지 않는다. 제품 DATE_REVEAL은 계속 UNSUPPORTED다.

- dated bounds port 보완 후 **51 Unit PASS(43 Coordinator+8 admission) / typecheck PASS / lint 0 errors·기존 warnings3개**. 새 `task-reveal-target.ts`는 axis start 포함/end 제외·invalid canonical date·clamped x·capacity 부족을 명령 전에 거절하고 날짜 없는 Summary의 수평120을 보존한다. 새 날짜 좌표 계산을 도입하지 않는다.
- 최종 제품 지문: port `753d7a110f2f7253061ecfabe567ea98b239db9d7fcb6a17f217e0dd8471d773`, reveal admission `7ea38ad52d9580ace10e15b634cc27738c0ceade7a35b52a6d2c7d4a393f29e4`, Coordinator는 위 `6cf3e3ed...`이다. React 연결 지문은 Gantt `52fb077f850618718fac1555dd2d2d0817e29c60c907d7815a04fd7238d4e047`, Workspace `a9a66dc0ed6187be671fd834bee9ccf9f8c0d032aa807310667b530bdc79cd86`이며 `/tmp/issue571-final-source.sha256`에 전체 source manifest를 보존한다.
- 독립 qa_docs의 pure 재현은 새 revision 후 oldGuardValid=false, contextChanged 뒤 guardPresent=false로 PASS다. 관련 7파일 **90 Unit PASS(236ms)**이며 최종 port admission을 포함한 후속 브라우저 재검증은 별도 기록한다.

## DOCUMENTATION_SYNC

- `docs/ARCHITECTURE.md`: UPDATED
- `docs/GANTT_ADAPTER_ADR.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/MILESTONE_TIMELINE.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(Delta B: 기존 UX-12 상태 보존 원칙 구체화)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 keyboard/focus/scroll 소유권을 유지하고 화면별 PROJECT_UX를 갱신)
- `docs/API.md`: N/A(서버 API 및 Origin/session/revision 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB와 migration 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정 도메인 계산과 canonical Milestone 모집단 변경 없음)
- `docs/SECURITY.md`: N/A(권한과 readonly 보호 mutation 계약 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(Import/Export 계약 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(Import schema 변경 없음)
- `docs/VBA_EXPORT.md`: N/A(VBA 변경 없음)
- `docs/DEPLOYMENT.md`: N/A(배포 변경 없음)
- `docs/CI_CD.md`: N/A(CI policy와 required gates 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 검증 정책 변경 없이 기존 PR CI를 사용)
- `docs/GITHUB_OPERATIONS.md`: N/A(GitHub 운영 계약과 권한 변경 없음)

## AC_TEST_COVERAGE

- AC1: pending peer wheel/rapid selection·filter source 변경·native Grid 양방향 reveal은 고정 제품 browser8 및 직접 영향 matrix에서 PASS. Resource 실제 resize중 복원 취소는 선별 matrix PASS이며 실제 Resource no-input120·latezero 보정/wheel 왕복은 최종 독립9의2건 PASS다. Core exact/native±1px와 최신 입력 우선권을 순수 Coordinator/실제 browser에서 확인한다.
- AC2: fullscreen metadata·late native0·Editor locate 후 Project metadata는 독립 5 Chromium PASS. 직접 영향 matrix의 canonical21·설정 metadata2·DnD2·empty Summary/native-add1·Grid3은 29 PASS. confirmed delete normal/401/412/network는 마지막 선별 matrix 4 PASS다. 원격 전체 회귀는 NOT TESTED.
- AC3: native Grid 시작일 양방향 reveal·Editor locate 실제 top 이동/행 focus·후속 metadata 유지, scope quick filter의 0행0/해제bookmark120·실제wheel 후 부활0 및 readonly mutation0은 실제 Chromium PASS. NullSummary x보존과 datedaxis 밖 거절은 Unit PASS이며 NullSummary Editor locate 실제 DOM은 NOT TESTED. 미통합 #551의 제품 DATE_REVEAL은 UNSUPPORTED/별도 NOT TESTED.
- AC4: Day/Week scale 및 기존 right-edge/hidden/tab/resize 회귀를 기존 project-gantt-scale과 #549 probe에 매핑한다. metadata projection의 390/768/1024/1440/1920px는 direct matrix PASS. 최종 선별 scale/probe 실행 결과는 아래 후속 원장을 따른다. #551 lane tick/Week header 의미 gate는 미통합 별도 NOT TESTED이며 기존 축 회귀로 대체하지 않는다.
- AC5: Coordinator priority/epochs·latest receipt·actual frame 정합·유한 timeout·dispose/hidden·명령후 stale repair0·잔존 guard revision/generation/receipt 무효화 및 준비resize후 fresh receipt floor는 최종 관련129 Unit PASS. production writer source inventory와 Coordinator event history에서 ingress/phase/outcome/intent-context-gesture-projection tokens/decisionReason을 확인한다. 개발 전용 probe 직접 writer는 명시적 예외이며 제품 단일 writer 증거에서 제외한다.
- AC6: ARCH/ADR/PROJECT_UX/TEST_PLAN/MILESTONE/TASK_EDITOR/PLAN/Work Packet을 동기화하고 DESIGN Delta B/N/A를 기록했다. 별도 qa_docs 의미 검토 및 최종 독립 로컬 실행 후 PR CI 시작을 확인한다. exact-head 원격 quality/e2e/docker·protected 인간 QA_FINAL·Owner Manager ACCEPT는 완료 전 NOT TESTED/별도 BLOCKED이며 로컬 PASS로 대체하지 않는다.

## 최종 선별 실행 원장

- guard/date admission 보완 후 독립 qa_docs: 관련 8파일 **98 Unit PASS(374ms)**, `/tmp/issue571-independent-unit-final2.log`; fullscreen metadata·active filter·late native0·Editor locate→Project metadata·WBS filter bookmark **5 Chromium PASS(20.9초)**, `/tmp/issue571-independent-browser-final.log`. 이는 pure6cf3 단계의 증거이며 이후 range 입력 admission 보완과 구분한다.
- frontend 직접 영향 matrix **29 Chromium PASS(2.3분)**, `/tmp/issue571-direct-matrix.log`: canonical21 + Grid3 + Chart DnD2 + empty Summary/native-add1 + 설정 metadata2. 실행 뒤 source manifest 지문 일치 PASS다.
- 마지막 range admission 보완: 유한 양수 `width≤1_000_000` 외에는 `UNSUPPORTED/INVALID_RANGE_WIDTH`이며 port 명령·frame·release0. Coordinator **51 Unit PASS/typecheck PASS**, freeze `2026-10-11T09:14:05Z`. 제품 SHA256 `efe06bd74a44194ceda38220755bae2978907ba01ee754bf0a5f6ff021aff9ca`, Unit `6374a0cc5a1f5d12174a0638014188a777c8c9b46aa8737451ab12437e766895`. 기존 유효 range/WAIT/settle 경로는 바뀌지 않았으며 최종 독립 5 Chromium과 관련 Unit을 다시 실행한다.
- 범위 한계: 실제 axis 안이라도 관측 target x가 native capacity 밖이면 `NO_SCROLL_CAPACITY`로 끝난다. near-end 최적 clamp/새 axis adapter는 도입하지 않으며 허위 SETTLED로 바꾸지 않는다. 전체 Milestone 표시 stack·최종 수동 UX·원격 전체 CI는 로컬 일부 성공으로 완료 판정하지 않는다.

- range admission 이후 추가 선별 matrix **7 Chromium PASS(2.0분)**, `/tmp/issue571-recovery-matrix.log`: confirmed delete normal/401/412/network4 + scale1 + #549 1440px geometry probe1 + Resource 실제 viewport resize pending 취소1. scale은 기존 Day 3회 right-edge 및 Day/Week 전환·폭별 헤더 회귀를 포함하며 미통합 #551 lane 의미 검증을 대체하지 않는다. 실행 뒤 source manifest 일치와 diffcheck PASS다.
- 새 range admission 소스의 독립 관련 8파일 **106 Unit PASS(591ms)**, `/tmp/issue571-independent-unit-final3.log`. 이 결과와 앞선 pure6cf3의 98 Unit을 구분한다.
- 최종 검토에서 native-add continuity가 클릭 시 old좌표를 캡처한 뒤 mutation unlock 때 fresh stamp를 만드는 경계를 REWORK로 확인했다. 대기 중 실제 입력이 원래 capture를 취소하지 않으면 늦은 복원이 최신 사용자 이동을 덮을 수 있다. 정상 자체 add의 geometry 변경은 허용하되 캡처 당시 gesture/API/scope/filter/scale/columns와 실제 취소를 검사하도록 보완한다. window 복원·focus에도 동일 stale 검사를 적용한다.
- 이 발견 직후 시작된 최종 독립 browser 실행은 session85097을 종료(exit130)했다. PASS/FAIL 근거로 사용하지 않으며 보완 후 새 source로 무입력 delayed add와 actual wheel delayed add 및 최종 독립 subset을 재검증한다.

- native-add 첫 보완 실행은 2 PASS(7.7초)였지만 receipt가 최신 revision인지와 늦은 명령 완료까지 충분히 관찰하는지 oracle를 추가 검토했다. 두 번째 실행은 무입력1 PASS/actual wheel1 FAIL(14.1초)이며, 실패는 응답 release 전 wheel후132를 클릭 전300보다 크다고 단정한 setup assertion이다. 클릭 뒤 실제 wheel 직전 좌표에서 변화·정합을 측정하고, 응답 뒤 최신 revision receipt와 완료/취소 이력 및 유한 RAF 후 늦은 재생0을 검증하도록 보완한다. 이 실패를 응답 후 stale 복원 실패로 귀속하지 않는다.
- native-add 캡처에는 Coordinator identity·원래 gesture/intent·API/key/scope/filter/scale/columns·measurable/window/fullscreen 문맥을 보관한다. input/filter/explicit reveal/API cleanup에서 capture를 폐기하고, unlock 이후에도 살아 있는 동일 capture와 원래 권한만 예상 add geometry에 인계한다. 최신 입력 권한을 새로 만들어 이전 capture를 재승인하지 않는다. helper 선언 전 참조 lint 오류1개는 해결 후 0 errors/기존 warnings3개, typecheck PASS다.

- native-add 최종 보강 oracle **2 Chromium PASS(10.9초)**, `/tmp/issue571-native-add-browser3.log`: 최신 canonical revision receipt SETTLED, 무입력 NATIVE_ADD 실제 SETTLED, 응답 뒤36 실제 RAF의 위치 유지와 actual wheel 후 NATIVE_ADD APPLYING0을 확인했다. wheel은 클릭 전300보다 커야 한다고 가정하지 않고 실제 클릭 이후 위치에서0으로 이동시킨 후 이전 capture의 부활이 없는지 검증한다.
- 최종 native-add 제품 freeze manifest는 `/tmp/issue571-native-add-final-source.sha256`다. Gantt SHA256 `bf1b8fa0cbd0bc54d1b7849ff2c8b58ea10846449d8a92f2e31d9fd9aa4f96e6`, 전용 E2E `ce25678bf796ae411a9a441c4e7bac8c275858ae644c9077d11e341c6df7a504`. Coordinator/port/admission/Workspace 및 Unit 지문은 직전 단계와 같다. typecheck PASS, lint0 errors/기존 warnings3개, diffcheck PASS다.

- 고정 native-add 소스의 최종 독립9 실행 `/tmp/issue571-independent-browser-final3.log`: **7 PASS/2 FAIL(1.6분)**, 독립 Unit106 PASS(683ms)/manifest8항목 일치/diffcheck PASS. Resource actual wheel·metadata3·Editor locate·filter bookmark·native-add actual wheel은 PASS다. Resource 무입력 첫복귀 `resource-kpi-integration-ui.spec.ts:314`는 기대Core/native120→실제0/0으로 FAIL, native-add 무입력은 좌표300/300 유지 중 `:120`의 최신 receipt rev21이 TIMED_OUT으로 FAIL이다. 최초 실패 trace는 `/tmp/issue571-independent-final3-failures.tar.gz`에 보존했다.
- Resource 실패는 injected latezero 전 첫 복귀에서 발생했다. 원래 capture는120, capacity1111/API/selection/columns는 유지됐다. 독립 trace32620.107ms의 PEER_RETURN은 logical visible=true이나 실제geometry `[1390,504,0,0,216,504]`에서 즉시 NOT_MEASURABLE/HIDDEN_OR_UNMEASURABLE, writes8로 끝났다. 32760.775ms에는 range만SETTLED/geometry `[1390,504,905,504,2016,504]`/receipt16SETTLED·rev16이 됐지만 peer 적용은 재실행되지 않았다. source 권한보다 앞서 초기0 geometry에서 복원 intent를 소비한 것이 직접 원인이다.
- Manager 결정: 새로운 component별120RAF loop를 추가하지 않고 중앙 Coordinator의 WAIT_PROJECTION/WAIT_GEOMETRY가 logical visible의 일시적0 geometry를 원래 stamp/current 취소 조건으로 유한 대기한다. 실제 hidden context는 즉시 거절, persistentzero/inert는 유한 실패, 측정 전 명령0·새 입력/문맥 변경 취소를 유지한다. 원래120 복원이 APPLY에 도달해야 하며 기대값을0으로 바꾸지 않는다.
- native-add 무입력 실패의 Core/native300/300은 유지됐고 receiptgen13/rev21TIMED_OUT 및 NATIVE_ADD WAIT_PROJECTION→TIMED_OUT을 확인했다. 이를 viewport 위치 실패로 귀속하지 않는다. clone한 create 응답 fixture와 실제 canonical DTO/관측 predicate를 분리해 조사하며 성공 조건을 약화하지 않는다.

- Resource의 일시적 zero geometry 보완 후 Coordinator **55 Unit PASS/typecheck PASS**, freeze `2026-10-11T09:33:40Z`. 제품 SHA256 `60de9576665a42b4045971a344fbc3c1b6002f0d40136890e20539ea612d1b13`, Unit `609784a2c170132efa731f5a1fd80688f85063dd582731056018b25b2b6978eb`. 측정 전 명령0, 실제 hidden 즉시 거절, 지속zero의 유한 실패, 대기 중 wheel/scope 취소를 검증했다. 실제 Resource 진단 반복2건도 PASS이나 임시 진단 소스이므로 최종 독립 후보 증거와 구분한다.
- 임시 projection predicate 진단 중 시작한 관련 Unit 준비 실행은 **99 PASS/11 FAIL**이었다. fake HTMLElement의 dataset을 가정한 임시 진단 코드에서 발생했으며 최종 후보 제품 실패로 귀속하지 않는다. 진단 원복·전체 소스 동결 뒤 관련 Unit을 다시 실행한다.
- delayed-add fixture의 create operation에 실제 계약의 changedTaskExternalIds/deletedTaskExternalIds/deletedLinkIds가 누락돼 recovery 경로를 타는 결함을 보완했다. 별도 receipt timeout은 실제 bar와 Grid 행의 중심이6.5px 어긋나 barsCorrect=false인 것으로 확인됐다. label/payload/ID/required rows/bars/columns/text/vertical/horizontal 조건은 만족했다. 실제 scroll owner는 Chart/Gantt가300 또는 실제 wheel0으로 일치하는 반면 Grid table-box만7px 또는28px 따로 스크롤됐다. 이미 보이는 header 버튼의 Playwright 자동 scrollIntoView와 실제 포인터 동작을 분리 검증하며 projection 정렬 predicate를 완화하지 않는다. 임시 진단 변경은 최종 tree에서 제외한다.
- 실제 pointer의 첫 클릭 불발은 add glyph가width0/height16이고 hit target이columnheader인 준비 상태였다. font ready·양수 glyph폭·elementFromPoint의 실제 add target을 확인한 뒤 포인터 클릭하도록 fixture 준비를 보완했다. 테스트의 Grid 자동 scroll과 제품의 실제 클릭을 분리하며 receipt/행 정렬 predicate는 변경하지 않았다. 최종 관측은 응답 뒤120 실제 RAF로 보강했다.
- 최종 production port는 detached, hidden/inert, documenthidden, 자체 display/visibility 비활성을 context.visible=false로 구분한다. 논리visible의 일시적 chartzero만 원래 권한으로 유한 대기한다. hardhidden 의미 Unit8개를 추가한 핵심71 Unit PASS(220ms), typecheck PASS/lint0 errors·기존 warnings3개/diffcheck PASS다. 임시 `projection-settled.ts` 진단은 원복했고 baseline 대비 diff0이다. 전체 제품/테스트 지문은 `/tmp/issue571-peer-final-source.sha256`이며 port `11266140da96c719499f90bd1d10932e45b1aa8a9d25c426d9d33036014bd63d`, E2E `94d2b4f22000c52749b4a4a202192ef3264226c7c3c7416cc9c0ae88b26357a4`, admission Unit `4d1cb597573af290e3ce61d8147f7a8aa035e492260bf87ba950200a431488e9`다. Coordinator55 및 Gantt/Workspace/admission 지문은 직전 freeze와 같다.
- 이 고정 소스의 마지막 frontend 선별 실행은 **3 Chromium PASS(37.9초)**, `/tmp/issue571-peer-final-browser.log`다. 실제 Resource 원래120 복귀 및 late native0×2 보정, delayed-add 무입력 SETTLED, 실제wheel0 이후120RAF 동안 stale APPLYING0을 확인했다. 실행 전후8파일 manifest 일치 PASS 후 qa_docs에 서버를 인계했고 제품/테스트 편집을 중단했다.
- 설치 Core의 add action은 font stylesheet에 의존하는 빈 icon element이며 Willow가 stylesheet link를 나중에 공급한다. 따라서 API/행 준비만으로 glyph hit 준비를 보장하지 않는다. Grid table-box는 overflow:hidden이며 설치 Grid의 기본 focus에도 preventScroll이 없으므로 독립 scroll offset과 Core/native 일치가 양립할 수 있다. 이번7/28의 최초 writer는 UNKNOWN이며 font 준비 후 실제 포인터 검증의 PASS를 최초 원인 확정으로 확대하지 않는다.
- 고정 소스의 최종 독립 후속 실행 `/tmp/issue571-independent-unit-final6.log`: 관련8파일 **118 Unit PASS(360ms)**. `/tmp/issue571-independent-browser-final4.log`: **8 Chromium PASS/1 FAIL(1.4분)**, PRE_QA REWORK다. Resource2/native-add2/fullscreen·active-filter metadata2/Editor locate/filter bookmark는 PASS다. #570 latezero test의 `task-editor-form-density.spec.ts:274`는 저장 뒤 publicLeft120 기대에0으로 FAIL이며 의도적인 latezero 주입 전이다. 이를 주입 방어 실패나 native-add 실패로 귀속하지 않는다. 실행 전후8파일 manifest 일치/임시 projection diff0이며 실패 trace는 `/tmp/issue571-independent-final4-failure.tar.gz`에 보존했다. 최초 reset과 요청 authority를 분리 분석한 뒤 보완하며 PR 게시는 보류한다.
- 독립 final4 trace: 최초120→0은 저장 전 우클릭 메뉴 단계다. 63137.030ms native120→63255.810ms 새 chart node native0→63269.586ms public requestedLeft0→63604.616ms 저장click 순서이며 Coordinator writes8은 증가하지 않았다. 최초zero 직접 writer는 UNKNOWN이다. 저장 후 PASSIVE는 p26SETTLED의 APPLYING(writes14)→기존 compatibility resize pair(writes16)/geometry204→905→receiptp27SETTLED 뒤 STALE_PROJECTION이 됐으며 실제 scroll120 발행은0회였다. contextEpoch5/gesture1은 고정이고 HIDDEN_CONTEXT 종료 증거는 없다. 같은 고정 소스의 단독 재현1PASS7.0초는 최초 FAIL을 취소하지 않는다. 시각은 snapshot 최초 관측 시각이다.
- Manager 결정: 기존 호환 geometry 준비를 `port.prepare`/중앙 PREPARING_GEOMETRY로 분리하고 최신 receipt·연속 geometry 검증 뒤 accepted projection을 고정한다. 실제 resize를 발행했으면 준비 전 generation보다 새로운 성공 receipt를 요구한다. no-op 준비에는 불필요한 generation 갱신을 요구하지 않는다. 좌표 APPLY 이후 generation/receipt 변경의 취소 규칙은 유지하며 일괄 완화하지 않는다. 준비 중에는 원래 source/API/canonical revision/gesture/조회 문맥의 취소 조건을 유지하고 과거 좌표를 쓰지 않는다.
- 준비 분리 pure **64 Unit PASS/typecheck PASS**, freeze `2026-10-11T09:49:43Z`. 제품 SHA256 `c3adc3d758a97542b05b12a333c9d0ffd73ce974f2f7a68cc8ea6f323ffcc497`, Unit `1d2b5d4e851a401e503cb1606c64ddf7960a4c985fb18aab20894a4e0b5483c6`. 추가9개는 준비 후 새 성공 receipt·기존 receipt 재사용 금지·no-op·준비 중 실제 입력/revision 취소·실패 분류·range 예외를 검사한다. port의 준비resize2회/좌표apply1회 및 취소 후scroll0 의미 Unit2개를 추가해 핵심82 Unit PASS(222ms)다. 실제 source freeze/browser/독립 PRE_QA는 후속 실행으로 구분한다.
- 준비 분리 최종 고정 소스의 metadata 회귀는 최초 **1 PASS(7.4초)**와 같은 고유 case의 추가 반복 **3 PASS(15.7초)**다. `/tmp/issue571-prepare-final-browser.log`, `/tmp/issue571-prepare-final-browser3.log`. 이를 고유4개 case로 합산하지 않는다. 기존 latezero 차단/실제wheel/같은 검색의 빈집합 계약과 기대120은 유지했다. `/tmp/issue571-prepare-final-source.sha256` 전8파일 사후 일치/diffcheck PASS, typecheck PASS/lint0 errors·기존 warnings3개이며 QA에 서버를 양도했다. PASS 실행의 trace는 retain-on-failure 설정으로 보존되지 않아 실제 browser의 resize floor 이벤트 개별 귀속은 NOT TESTED이고 Unit 의미 검증과 브라우저 결과를 구분한다.
- 최종 prepare 소스의 독립 관련8파일 **129 Unit PASS(365ms)**, `/tmp/issue571-independent-unit-final7.log`. 최종 Coordinator/admission/Gantt/Workspace/E2E 지문은 앞선 기록을 따르며 port SHA256 `be9e899d671b2e052286b7cc037b9068a441ec7162660a5756fb66f92d62d478`, port Unit `e9ec4afd22f552325b30ed1bf4a67259b20ddaedc25f524f2aaa90e315820cd6`이다. 전체8파일 manifest 및 임시 projection diff0을 독립 Reviewer가 확인했다. 최종 Chromium9의 결과와 별도 PRE_QA 판정은 실행 완료 후 기록한다.
- 최종 고정 소스의 독립 `/tmp/issue571-independent-browser-final5.log`: **9 Chromium PASS(1.4분)**. Resource no-input120/latezero 보정·실제wheel2, fullscreen/active-filter/latezero metadata3, Editor locate→Project metadata1, WBS filter bookmark1, delayed native-add 무입력/실제wheel2다. 앞선8/1 FAIL과 수정 전 결과는 유지한다. 전체 원격 quality/e2e/docker는 NOT TESTED이며 로컬 성공을 공식 전체 회귀로 확대하지 않는다.
- 별도 Reviewer `/root/issue570_qa_fix` 최종 **PRE_QA PASS / DOCUMENTATION_SYNC 의미 검토 PASS**. 실제 validator 문서/AC 구조 검사 PASS, staged19개 allowlist·실행 전후/staged source8개 지문 일치·임시 진단 diff0을 확인했다. Manager는 동일 후보의 PR CI 시작을 진행한다. 이는 QA_FINAL·Manager ACCEPT가 아니며 사용자 AGENTS #595에 따른 현재 Head의 별도 인간 QA 및 이후 Owner ACCEPT 전 최종 병합은 BLOCKED다. #551 미통합 의미 gate·Null Summary Editor locate 실제 DOM·capacity 밖 near-end 최적 이동·최종 수동 UX의 미검증 경계는 유지한다.

## 2026-10-11 원격 전체 PR CI #2498.1 실패 및 회귀 보완 (PR #610)

- 원본 Head `de6b39bf1fc6b2ae89842da71257a5d5b2f59bc7`, [Run 38130201016](https://github.com/planner77/masterGantt/actions/runs/38130201016): Quality/Docker PASS, Chromium E2E shard2/3/4/5 총 10 FAIL. 원본 실패 이력은 재실행으로 덮어쓰지 않는다.
- 실제 Playwright HTML/Trace 검토: #529 복귀 시 Core120/native108을 정합하기 전 Projection receipt가 TIMED_OUT, Coordinator PEER_RETURN WAIT_PROJECTION→TIMED_OUT이며 기존 좌표120을 Core/native0이 덮었다. Projection은 canonical 데이터·행 수렴을 평가하므로 가로 좌표는 후행 Coordinator가 검증하도록 분리한다. 다른 E2E의 기존 수직 정합 검사는 유지한다.
- #530: 실측 viewport resize가 React dependency보다 먼저 발생해 이미 대기 중인 peer 복귀가120을 재생하였다. 브라우저 창 크기/Fullscreen을 source context identity에 포함해 즉시 lease 무효화한다. Native top-only SVAR scroll-chart를 stale horizontal guard가 차단하지 않도록 수평 writer만 보호한다.
- #463/#530: 과거 E2E 영수증의 admissionCapacity 필드 누락을 실제 수용된 physical capacity로 복구. #568 `effect-request/effect-cleanup` trace는 새 단일 Coordinator의 ingress/종료 관측으로 연결하며 옛 부모 scroll writer는 되살리지 않는다.
- #549: `__masterganttMilestoneTimeline.scroll`은 기존 개발용 수평 직접 검증을 위해 typed DIAGNOSTIC_SCROLL 포트로 이동. Production에서는 UNSUPPORTED이며 Core/native 실제 연속3프레임 없이 성공을 주장하지 않는다. #367 RANGE_EXTENSION도 canonical receipt가 아닌 실제 Core/native 기하3프레임 수렴을 독립 기준으로 삼는다.
- #571/RFC: 물리 capacity가 이미 충분한 경우 불필요한 resize-chart와 추가 projection epoch를 만들지 않는다. Codex P2 vertical drag-edge 반복 supersession은 single-flight로 차단한다.
- 테스트: projection의 임시 가로 불일치·range pending receipt·dev diagnostics Unit 보강, 원본 10 E2E assertion/timeout/skip/retry는 변경하지 않는다. 현 원격 신규 전체 CI 검증은 START 이전 NOT TESTED이며 완료 PASS로 소급하지 않는다. 변경된 샘플/trace가 의미하는 범위 외의 사용자 환경 검증은 별도다.


## 2026-10-11 원격 전체 PR CI #2499.1 실패 및 후속 보완

- 최신 원본 [Run 38132372241](https://github.com/planner77/masterGantt/actions/runs/38132372241), run_attempt=1, Head `f10dfd0308cd6782f4ac908e7ec8905b09e12e5f`, base `ac2a3f69d09da1cbc7e4f833da0fa0515434f895`, test merge `9171e7339c136e1ad7134a7495ed4cb0c07ed6bc`. quality FAIL, e2e FAIL, docker PASS. 이전 #2498.1 실패와 구분한다.
- Vitest job114449211771: 10 FAIL/1958 PASS/3 skipped. Chromium shard3 job114449211766: 4 FAIL/90 PASS/1 skipped, shard5 job114449211811: 2 FAIL/94 PASS. shard2/4는 이번 run에서 PASS다.
- 원인1: port가 window 크기/Fullscreen lease를 읽지만 Node Unit fixture에 window가 없어 `window is not defined`. 제품 browser lease를 제거하지 않고 coherent fixture와 sufficient/insufficient capacity 테스트를 보완한다.
- 원인2: `milestone-dashboard-state.spec.ts:117`의 검색 해제 후 FILTER_RETURN이 과거 top96을 재생했다. 필터 1행의 합법적인 native top0 clamp는 복원 대상이 아니다. bookmark를 left+context+gesture로 제한하고 prepare/apply 각각 최신 정합 Core top을 사용한다. 세로96→0/24, 준비 중32→8, native/Core 정합 전 쓰기0, 사용자 이동 후 bookmark 폐기를 Unit으로 검증한다.
- 원인3: 같은 spec의 pending 실제 input 테스트는 제품 capture listener보다 늦게 등록된 관찰자가 listener 사이 cleanup을 본 순서 오류다. 제품은 즉시 FILTER_INPUT→SUPERSEDED/writes0으로 올바르게 취소한다. 테스트 관찰자를 addInitScript로 먼저 설치하며 제품 취소·기존 assertion·RAF barrier/cleanup 계약을 유지한다.
- 원인4: Stage peer return은 빈 Summary expected progress 미지정/Core0으로 strict payload 검사가 막혔다. Resource export 및 no-export control은 초기 Core tasks의 projectDisplayKey 누락/후속 projection의 canonical 표시 키 불일치다. 다른 predicate가 정합한 실제 임시 진단으로 확인했으며, strict 검사를 완화하지 않고 초기·후속 adapter 입력을 일치시킨다. renderer progress0은 canonical Summary null/표시 `—`를 바꾸지 않는다.
- 원인5: inline 이름 `Blur saved`는 PATCH0이며, 실행 trace에는 입력값 반영·revision40/편집 가능 유지·PATCH0이 있으며, 설치 Core 소스상 document bubbling 바깥 클릭 저장보다 React scale 변경이 먼저 editor를 교체하는 경합으로 진단했다. 실제 focusout/click 호출 스택은 trace에 없어 기전의 근거는 소스와 실행 순서다. 실제 focusout을 기존 close-editor/update-cell 저장 gateway로 연결하되 Escape·IME·검증·중복 저장·500/412/network 계약을 유지한다.
- frontend baseline6 실행 `/tmp/issue571-ci2499-baseline6.log`: 동일 6 FAIL 재현. 최초 trace는 `/tmp/issue571-ci2499-baseline6-failures`에 보존한다. 각 보완 후 결과는 아래에 별도 기록하며 실패 원장을 성공으로 덮어쓰지 않는다.
- 위험 분류는 HIGH/AGENT/qa_required=true, application 후보0.104.2를 유지한다. 새 버전 bump·CI workflow/timeout/retry/skip/gate 변경은 하지 않는다. 실제 별도 qa_docs PRE_QA 이후 기존 PR #610의 새 full CI 시작까지만 수행한다. 공식 전체 회귀 결과와 QA_FINAL/Manager ACCEPT·병합은 별도다.

### 후속 Local Fast Feedback와 고정 소스

- frontend 고정 소스 `/tmp/issue571-ci2499-after6.log`: 원격 실패6건 **6 Chromium PASS(1.6분)**. Stage 실제 SQLite, Milestone 필터·pending trusted input, inline 전체 실패 처리 흐름, Resource export/no-export 양쪽을 포함한다.
- `/tmp/issue571-ci2499-adapter-port-unit.log`: adapter/port **33 Unit PASS(298ms)**. `/tmp/issue571-ci2499-canonical-unit.log`: canonical/projection **39 Unit PASS(328ms)**. pure Coordinator **70 Unit PASS**, typecheck PASS. 중복 파일을 포함한 실행 수를 독립 테스트 수로 합산하지 않는다.
- `/tmp/issue571-ci2499-typecheck.log`: PASS. `/tmp/issue571-ci2499-lint.log`: 0 errors/기존 hook warnings3. `git diff --check` PASS. 임시 predicate 진단 제거 및 projection-settled.ts diff0, 실패6건의 timeout/retry/skip과 제품 strict projection 검사를 유지했다.
- 고정 소스 manifest `/tmp/issue571-ci2499-final-source.sha256` 실행 전후7항목 일치. 제품 지문: project-gantt.tsx `06898ca4530d4cd0f0772dffa0392046feea3a34ba330652df15355833c0a601`, project-task-adapter.ts `4996769eef4cc65959da810ec16130944b2821ef9e3cb3b4ce0dceeffdaea3cd`, viewport-coordinator.ts `2c0de5a87d7bcc94ac90429d7a0bc259312a68dc23e03e386d59655f3e7624b8`.
- DOCUMENTATION_SYNC 구조/AC1~AC6 mapping 검사 PASS, Markdown179문서 링크 검사 PASS. 구조 PASS는 독립 의미 검토와 구분한다.
- 실제 IME 조합 도중 바깥 클릭 blur의 Core 후속 동작은 NOT TESTED다. 새 focusout 연결의 composition guard와 기존 IME Enter 검증을 이 사용자 환경 전체 PASS로 확대하지 않는다. 최종 수동 UX·#551 미통합 lane 등 이전 미검증 경계도 유지한다.

### 독립 PRE_QA 첫 후속 실행 — REWORK

- 별도 `/root/issue570_qa_fix`: 관련9파일 **151 Unit PASS(383ms)**, `/tmp/issue571-ci2499-independent-unit9.log`. 최초 sandbox browser 시도는 webServer 시작 Exit1/실제 테스트0으로 준비 실패이며 제품 FAIL로 분류하지 않는다.
- 고정 manifest7 전후일치 상태에서 독립 `/tmp/issue571-ci2499-independent-browser6.log`: **5 Chromium PASS/1 FAIL(1.7분)**. Milestone2/Stage1/Resource2는 PASS다. inline 이름 case는 390px 열기→Escape/input0까지 성공한 뒤768px resize→두 번째 이름 클릭에서 input 부재로 spec137/helper33 `toBeFocused`가 실패했다. 기존 원격의 Week blur PATCH0 지점에 도달하기 전이므로 이를 동일 저장 실패로 귀속하지 않는다.
- 최초 독립 실패 trace/context/log는 `/tmp/issue571-ci2499-independent-inline-firstfail.tar.gz`에 보존한다. PRE_QA REWORK로 PR 게시를 보류하고 실제 resize·편집기 재진입 원인을 확인한다. source/test 변경 없는 단순 retry로 이 결과를 숨기지 않는다.

### Inline 재진입 추가 조사와 권한 보완

- 독립 최초768px 실패에는 Core open/close/focusout 기록이 없어 정확 분기는 UNKNOWN이다. 제한한 임시 진단 반복에서는 재현되지 않았고, 이를 최초 실패의 PASS 전환이나 원인 증명으로 사용하지 않는다.
- 첫 pointerdown→resize→pointerup 통제 실패는 y859.5/viewport844의 화면 밖 좌표라는 테스트 준비 오류여서 제품 재현 근거에서 제외했다. 실제 화면 안의 동일 Task 이름 hit을 확인한 통제는 기존 코드에서도 PASS다. 이 결과로 미실증 click fallback 확대를 도입하지 않는다.
- 정적 검토에서 Escape의 close-editor Promise 완료 focus가 생성 당시 권한을 재확인하지 않는 누락을 확인했다. 이전 Escape 완료가 다음 편집으로 focus를 빼앗지 않도록 token 및 API identity가 그대로일 때만 focus한다. 원래768px 실패의 직접 원인이라고 확정하지 않는다.
- 새 회귀는 실제 이름 영역에서 pointerdown한 뒤 native viewport resize·새 projection SETTLED receipt·동일 Task 이름 hit을 확인하고 pointerup→편집 focus를 검증한다. 기존 inline3개 전체와 함께 확인하며 임시 console/DOM 진단은 제거한다.

### 최종 독립 검토와 PR CI 시작 인계

- frontend 후속 `/tmp/issue571-ci2499-inline-final4.log`: 기존 inline 3건+신규 pointer 1건 **4 Chromium PASS(21.7초)**. 후속 typecheck PASS, lint 0 errors/기존 warnings3. 그 뒤 신규 test의 초기 실제 SETTLED poll·한글 title만 보완했고 test lint 0 errors/0 warnings다.
- 별도 Reviewer `/root/issue570_qa_fix`의 최종 `/tmp/issue571-ci2499-independent-inline-final4.log`: 동일 최종 후보 **4 Chromium PASS(21.9초)**. 기존390/768/1024/1440 재진입·invalid·IME Enter·Escape·Week blur PATCH1·500/412/network/401과 실제 pointer/resize를 포함한다. 최초 독립5 PASS/1 FAIL 이력을 유지하고, 원래768px exact 기전 UNKNOWN 및 새 pointer의 이전 소스 PASS를 숨기지 않는 조건에서 **PR CI 시작용 PRE_QA PASS**다.
- 관련9파일151 Unit PASS 및 Milestone2/Stage1/Resource2의 앞선 독립5 PASS는 해당 코드 영향이 유지된 범위의 재사용 증거이며 최종4건과 별도다. 중복 실행을 서로 다른 테스트 수로 합산하지 않는다. 모든 원격 공식 전체 CI 결과는 새 Head에서 별도 확인해야 한다.
- 최종 manifest `/tmp/issue571-ci2499-final3-source.sha256` 8항목 독립 실행 전후 일치. 최종 project-gantt.tsx SHA256 `362bacf4b6ee7bd8aeed9b24ba3e0c8938880d09b8cb1c8573c487aee4697726`, 신규 inline E2E `ca4a9a084c30ddcc4c50585ab43d60caf02f6f60d6e2555c14097880165ef89c`. 공용 adapter/pure/기존 시험 지문은 앞선 기록과 동일하다. 임시 진단0·projection-settled.ts diff0·미실증 fallback 확장0을 확인했다.
- DOCUMENTATION_SYNC 의미 검토와 구조/AC mapping을 구분한다. 관련 문서·실패 이력·새 준비 조건·IME 실제 blur 미검증 경계를 동기화했다. generated Next 설정·runtime DB/log·실행별 output 그림/JSON은 후속 commit 대상에서 제외한다.
- Manager의 이번 승인은 동일 후보 게시 및 full PR CI 시작에 한정한다. canonical PR title/Refs를 유지하고 기존 branch/PR #610을 재사용한다. quality/e2e/docker의 신규 결과는 **NOT TESTED**, 최종 Manager ACCEPT는 **NOT TESTED**, 보호 AGENT의 현재 Head 인간 QA_FINAL/후속 Owner ACCEPT 전 병합은 **BLOCKED**다. 사용자 요청대로 CI 시작 확인 후 결과 모니터링·merge/main/GHCR/release/Issue 종료를 수행하지 않는다. 실제 새 Head/run URL은 Issue/PR STATUS 댓글에 남긴다.


## 2026-10-11 원격 PR CI #2500.1 실패 및 후속 보완

- 원본 [Run38135294369](https://github.com/planner77/masterGantt/actions/runs/38135294369), attempt1, Head `f001fdf922e59cccb961b1cd87112b251d89a3a5`, base `ac2a3f69d09da1cbc7e4f833da0fa0515434f895`, test merge `a2913ab44054fcdc3c87d9a374f5c93f9b2d28b9`. 원본 event artifact와 workflow/job API를 대조했다. quality PASS(job114458059325), docker PASS(job114458232489), e2e FAIL(job114460892532). 이전 #2499의 Unit10/E2E6 실패는 이번 run에서 재발하지 않았다.
- shard2 job114457848219: 1 FAIL/71 PASS. `grid-task-start-reveal.spec.ts:152`의 :167에서 clock300ms 뒤 canonical 시작일 startVisible이 false다. PEER_RETURN은 FILTER_INPUT/writes0으로 정상 취소됐지만 후속 PASSIVE_RESTORE가 native Core Grid reveal로19830에 이동한 뒤 old120을 APPLY/SETTLED(writes2)하여 사용자의 명시 이동을 되돌렸다. 로컬 baseline에서도 동일 원인을 재현했다.
- shard4 job114457848310: 1 FAIL/104 PASS/1 skipped. `viewport-coordinator.spec.ts:5`의 :30은 대상 행이 존재하나 focus inactive다. TASK_REVEAL은 SETTLED/Core/native top117/writes6으로 성공했다. 스크롤 성공과 후속 focus 처리를 분리하며, 로컬 baseline의 Editor PASS로 원격 실패를 덮어쓰지 않는다.
- 증거: `/tmp/issue571-ci2500-manifest.json`, 원본 event artifact11700512950, shard2 HTML/trace11700878528, shard4 HTML/trace11701260381 및 `/tmp/issue571-ci2500-job-<jobid>.log`. frontend baseline2는 Grid FAIL/Editor PASS(14.3초), 최초 artifacts는 `/tmp/issue571-ci2500-baseline2-artifacts`에 보존한다.
- Grid 보완 방향: 기존 native select-task의 명시 show:x/y/xy/true를 최신 사용자 이동으로 관측하여 stale pending/passive·metadata capture 권한을 취소한다. Core show 동작은 그대로이고 새 앱 reveal writer를 추가하지 않는다. show:false·canonical-sync·project-owned-selection을 실제 사용자 이동으로 오인하지 않는다.
- 이번 범위는 기존 PR #610의 새 full CI 시작 확인까지이며 이후 결과 모니터링은 수행하지 않는다. 같은 미릴리스 application 후보0.104.2, HIGH/AGENT/qa_required=true, release_required=true/release_authorized=false를 유지한다. 기존 실패·UNKNOWN·인간 최종 QA gate는 소급 변경하지 않는다.

### Grid 보완 첫 회귀와 선택 명령 보강

- native reveal 관측 보완 후 `/tmp/issue571-ci2500-grid-final.log` 전체 Grid 파일: **15 PASS/1 FAIL(1.2분)**. 원격 filter-source 실패는 PASS로 바뀌었지만 modifier/keyboard 계약의 :218에서 checkbox Space 뒤 old0→20664 이동을 관측했다. 최초 artifacts는 `/tmp/issue571-ci2500-grid-after-artifacts`에 보존한다.
- 실제 마지막 select-task는 project-owned-selection이고 show가 미지정이다. 새 native-user 관측은 이 source를 이미 제외하므로 사용자 입력 승격 오류로 귀속하지 않는다. empty selection의 Core toggle에서 show:false 누락, modifier/Shift mirror의 기본 reveal=true에 따른 앱 TASK_REVEAL 발행이라는 기존 코드 누락을 확인했다.
- 선택 동기화는 show:false를 명시하고 modifier/Shift mirror는 reveal=false로 전달해 복수 선택·checkbox가 viewport를 이동하지 않도록 보완한다. 일반 native Grid show와 명시 Editor locate는 유지한다. 이 첫 회귀 실패를 숨기거나 expectation을 변경하지 않는다.
- Editor 제한 진단3회는 모두 PASS(20.9초), SETTLED→동일 controller→현재 Grid 행 focus 직후 active=true이며 이후 settings 입력 전 추가 focus가 없었다. 원격 exact focus 소실 기전은 UNKNOWN으로 유지한다. 명시 locate가 일반 닫기의 이전 trigger RAF를 예약하지 않도록 분리하고, 완료 후 현재 Grid 행만 focus하는 소유권 보완을 진행한다.

### 고정 소스 Local Fast Feedback

- checkbox 호출 경계 확인 중 시작한 첫22건 명령은 exit130으로 중단했다. 그 뒤 소유 파일 편집을 마치고 새 서버로 실행했으며, 중단 실행을 고정 소스 PASS로 사용하지 않는다.
- 최종 `/tmp/issue571-ci2500-final22.log`: **22 Chromium PASS(1.4분)**. Grid 전체16건, Editor locate, 일반 취소/readonly dialog, metadata3을 포함한다. 원격 filter-source 및 로컬 checkbox 회귀의 assertion·timeout은 그대로다.
- 관련3파일 **103 Unit PASS(336ms)**. `/tmp/issue571-ci2500-final-typecheck.log`: PASS. `/tmp/issue571-ci2500-final-lint.log`: 0 errors/기존 warnings3. `git diff --check` PASS.
- `/tmp/issue571-ci2500-final-source.sha256`의 제품2파일 실행 전후 일치: Gantt `f0620246f785ef67eff18e0399f445eb2f3b41c549be7c83d37fe678300f65e3`, Workspace `9d4447910706142b71fa4e71c86fdd75ef0b474f9a29b281cf537585082c022e`. 임시 진단0, pure/port·테스트/expectation/timeout 변경0. generated Next 설정·runtime output은 제외한다.
- Editor의 일반 close callback은 기존 무인수 wrapper를 유지하며 명시 locate만 이전 trigger 복원 RAF를 생성하지 않는다. SETTLED/동일 controller 및 현재 visible/connected Grid 행에만 focus한다. 원격 focus 소실의 exact 기전은 UNKNOWN이며 소스상 focus 소유권 보완과 현재 PASS를 구분한다.

### 최종 독립 PRE_QA와 새 full PR CI 인계

- 별도 Reviewer `/root/issue570_qa_fix`의 `/tmp/issue571-ci2500-independent4.log`는 **3 Chromium PASS(16.7초)**: Grid filter-source :152, Editor locate :5, 일반 취소 focus :233이다. modifier/keyboard의 잘못된 line174 선택으로 이 실행에서 누락된 :175는 --list로1개를 확인한 뒤 `/tmp/issue571-ci2500-independent-modifier1.log`에서 **1 PASS(6.9초)**다. 3+1 실행 경계를 유지하며 첫 실행을4 PASS로 부풀리지 않는다.
- 최종 독립 고유4건 PASS 및 source/문서 검토로 **동일 후보의 PR CI 시작용 PRE_QA PASS**다. 제품2파일 manifest 전후 일치, 제품/테스트 diff SHA256 `86c5b55644b65995583d6af73c6afd2b18ab920c4f1c2353f4b51c611659b644`. 원격 Editor exact 원인 UNKNOWN, 앞선 baseline/첫 Grid 회귀 FAIL 및 일반 취소·명시 locate 계약을 보존한다.
- 관련 문서/AC 구조 검사 PASS, Markdown179문서 링크 PASS, staged diffcheck PASS. DOCUMENTATION_SYNC 의미 검토는 독립 Reviewer가 따로 수행하며 구조 검사를 의미 PASS로 대체하지 않는다.
- 게시 후보는 제품2파일 및 문서7개(Work Packet/PLAN/ARCHITECTURE/PROJECT_UX/TASK_EDITOR/TEST_PLAN/CHANGELOG)의9파일이다. 테스트·pure/port·CI/권한/버전·generated 설정·runtime output 변경은 없다. 기존 PR #610/branch와 application0.104.2를 유지한다.
- Manager는 동일 후보 게시와 새 full PR CI 시작 확인까지만 진행한다. 신규 quality/e2e/docker는 **NOT TESTED**, QA_FINAL/Manager ACCEPT는 미완료이며 사용자 AGENT 보호 인간 최종 gate 전 병합은 **BLOCKED**다. CI 시작 뒤 결과 모니터링·병합/main/GHCR/Release·Issue 종료는 수행하지 않는다. 새 Head/run URL과 시작 확인은 Issue/PR STATUS 댓글에 남긴다.
