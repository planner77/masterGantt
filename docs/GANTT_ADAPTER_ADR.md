## Issue #665 — 의미 관측 facade와 완료 증거 경계

U3는 U1의 공개 읽기/검증 포트를 사용하는 opt-in `createProjectionObservation`을 추가한다. Core tasks/tree/links의 실제 정합·dirty/recovery·API·desired query/scope와 layout/axis·원래 user intent lease를 관측 attempt와 구별한다. 재관측만으로 새 복원 권한을 주지 않으며 현재 proof/행/실측 문맥이 유효할 때만 semantic completion을 유지한다. missing/stale proof·Core drift·새 문맥은 fail-closed한다.

논리 visible IDs와 가상 mounted 행 subset을 구별하고 실제 mounted 이름·순서·정렬 증거를 유지한다. data/row 완료는 수평 복원 완료를 기다리지 않는다. 기존 Coordinator/port·제품 호출과 #569 geometry adapter/resize 예외·기존 timeout/허용오차·실험 FAIL/DEFER는 변경하지 않는다. 실제 axis의 읽기 evidence 및 source 변경 통지는 U3 port 소비자의 책임이며 제품 연결은 #667에서 단독 수행한다.

새 facade와 전용 Unit은 미연결 상태다. 설치2.7.3 captured Core fixture 재사용은 실제 browser 재수집이나 제품 Calendar·Resource E2E 성공이 아니다. 원격 gate/Owner 승인 전 MODULE_READY 최종 판정을 하지 않는다. [검증·인계·rollback](exec-plans/active/ISSUE_665.md).

# ADR — SVAR 2.7.3 공개 API와 Chart 기하 Adapter (#569)

## Issue #571 — 기존 제품 명령의 단일 port 통합

#571은 이 ADR의 A/B/C 실험 adapter 전체를 제품에 채택하지 않는다. 현재 검증된 공개 scroll-chart와 기존 peer/metadata/native 보정, #367 range compatibility의 명령 소유권을 production port로 모은다. synthetic range compatibility를 그대로 인수하는 것은 공식 resize-chart capacity 계약이나 A/B/C 전체 성공의 근거가 아니다. 새 capacity 우회·비문서화 date action·same-instance controlled origin 변경은 도입하지 않는다.

Coordinator는 명령 반환과 완료를 분리하며 최신 projection receipt, API/context, 실제 visible geometry 및 Core/native 정합을 유한 관찰한다. hidden/zero-size·범위 부족·superseded·timeout을 성공으로 바꾸지 않는다. dated Task reveal은 실제 Core axis 날짜 bounds를 확인하고 clamped $x를 실제 날짜 가시성으로 승인하지 않는다. 날짜 없는 summary-container는 현재 수평 위치를 보존한다. 기존 #549 개발 전용 revealMilestoneDate 직접 명령과 #569 PoC/trace fixture는 production 단일 writer 근거에서 제외한다. 기존 PoC의 DEFER·390 Day failure·Week header 미검증 원장은 유지한다. [#571 Work Packet](exec-plans/active/ISSUE_571.md)은 새 제품 후보의 회귀 증거를 별도로 기록한다.

### PR #610 / CI #2499.1 payload 회귀

Resource 복귀의 TIMED_OUT은 초기 Core tasks에 `projectDisplayKey`가 없고 후속 canonical projection에는 존재한 불일치다. 초기·후속 Task payload는 같은 canonical 표시 키를 사용해야 하며, strict payload 검사를 생략하지 않는다. Stage의 빈 Summary는 canonical progress가 null일 때 Core가 기본0으로 정규화한다. adapter 출력에 renderer 기본0을 명시하여 strict 비교를 일치시키되, 서버 DTO의 null·사용자 표시 `—`·Summary readonly·일정 미산정 의미는 유지한다. projection receipt는 좌표 복원 PASS를 대신하지 않는다.

## 상태와 범위

실험용 adapter 계약을 채택하되 제품 도입은 DEFER한다. 구현·문서·독립 PRE_QA 후 PR CI 시작까지가 현재 요청이며 제품 adapter 도입/기존 writer 교체는 승인하지 않는다. [Work Packet](exec-plans/active/ISSUE_569.md), 선행 [관측 계약](GANTT_SYNC_TRACE.md)을 따른다. 최신 main에는 #568이 포함되지만 #549~#553의 Milestone 표시 stack은 없어 동일 source로 취급하지 않는다.

## 공식 문서와 설치 버전

2026-10-09 확인 기준 설치 Core2.7.3/MIT와 현재 공식 사이트의2.8 문서는 다른 버전이다. 외부 demo URL 조회와 실제 조작, 설치 타입과 runtime, Core와 native settle 증거를 구분한다.

| 계약 | 공식 문서 | 설치2.7.3·검증 경계 |
| --- | --- | --- |
| exec | [void 반환](https://docs.svar.dev/react/gantt/api/methods/exec/) | 타입 Promise<any>; #568 실제 thenable resolve는 DOM 완료가 아님 |
| scroll-chart | [left/top px](https://docs.svar.dev/react/gantt/api/actions/scroll-chart/) | 타입 date?:Date 포함; 명령 후 actual geometry/settle 필수 |
| resize-chart | [현재 container width/height/scrollSize](https://docs.svar.dev/react/gantt/api/actions/resize-chart/) | synthetic width로 시간축을 늘리는 현행 코드는 문서 의미 밖의2.7.3 예외 |
| autoScale | [data/interaction에 따른 동적 범위](https://docs.svar.dev/react/gantt/api/properties/autoscale/) | unchanged-data right-edge scroll 자체의 무한확장 보장 없음 |
| start/end | [명시 범위](https://docs.svar.dev/react/gantt/guides/timeline/scales/) | same-instance prop 변경의 선택/origin/viewport 보존은 PoC에서 확인 |
| getState area | [visible date/from](https://docs.svar.dev/react/gantt/api/methods/getstate/) | 최신 문서는 area를 날짜 timestamp로 설명하지만 설치2.7.3 area는 render-data의 행/가상화 영역이다. 날짜 authority로 사용하지 않으며 controlled axis를 actual tick/bar로 검증 |
| Willow/Scroll-to-date/Scale-cell/Flexible columns | [공식 samples](https://docs.svar.dev/react/gantt/samples/) | 최신 demo와 로컬2.7.3의 버전·source 차이를 기록 |

## 대안과 실측 기준

| 대안 | PoC | 채택 조건 | 위험·비용·되돌리기 |
| --- | --- | --- | --- |
| A autoScale+start/end | unchanged-data 오른쪽끝3회와 미래Task갱신 분리 | scroll만으로 확장되는지와 actual geometry/상태 보존 | 단순하지만 scroll전용계약 없음. PoC 구성만 제거 가능 |
| B 명시적 날짜 범위 | start 고정/end 단조증가3회 | remount 없이 선택/열/scroll/visible date/origin 유지 | documented props도 runtime reset 가능. 제품미도입·기존 경로 보존 |
| C synthetic resize 호환 |2.7.3에서 큰width→실측width복원 | 실제range/capacity 증가, transient resize·정렬/상태/observer loop 확인 | 문서의physical 의미밖예외. 버전가드/명시opt-in/유한상한, 교체가능모듈로격리 |

5폭 × Day/Week의 최종 결과는 아래와 같다. 테스트 PASS는 이 성공·실패 분류가 기대와 일치한다는 뜻이며 모든 대안의 지원 PASS가 아니다.

| 조건 | A | B | C |
| --- | --- | --- | --- |
| 390px, Chart 공간 확대 후 Day | 3회 확장 성공 | 3회 확장 성공 | 첫 확장의 위치 보존 실패·TIMED_OUT; 나머지 NOT TESTED |
| 390px, Chart 공간 확대 후 Week | 3회 확장 성공 | 3회 확장 성공 | 3회 확장 성공 |
| 768/1024/1440/1920px, Day/Week | 첫 확장 성공; 두 번째 edge에서 TIMED_OUT | 첫 확장 성공; 두 번째 edge에서 TIMED_OUT | 첫 확장 성공; 두 번째 edge에서 TIMED_OUT |

넓은 화면의 두 번째 edge는 공개 명령의 Core 좌표와 native 좌표가 일치하지 않아 잔여 2회 확장을 실행하지 않는다. C Day는 range/capacity 증가만으로 상태 보존 성공을 주장할 수 없다. A의 unchanged-data scroll, 명시적 end 변경, 미래 Task 변경은 서로 다른 실험으로 기록한다. 어느 대안도 전체 프로파일에서 3회 연속 확장과 상태 보존을 보장하지 못하므로 제품 writer 교체는 DEFER한다. 후속 도입은 원인 분석과 동일 프로파일의 새 증거를 요구한다.

## 인터페이스·안전 경계

`src/features/gantt/adapter/gantt-adapter.ts`의 `createGanttAdapter`는 readCore/readGeometry/sample, dateToViewportPx/viewportPxToDate, scroll/revealDate, resizeCompatibility, settle/supersede/trace/dispose를 제공한다. Core/native readers는 읽기 전용이다. 직접 Store 수정·DOM scrollWidth write·PRO 사용은 금지한다. scroll/date reveal만 공개 API 명령을 통해 요청하며 반환·Core 변화·DOM3-frame settle을 구분한다. hidden/inert/detached/zero-size에서는 측정·복원하지 않는다. NO_SCROLL_CAPACITY는 자동 무한 재시도 대신 visible layout 복귀/공간확대/명시 재시도를 제공하는 조건이다. 이 안내는 제품 도입 전 UX 연결이 필요한 제안이며 현재 화면 기능이 아니다.

date↔px는 공개 controlled origin/unit/cellWidth와 실제 native scroll owner를 기준으로 검증한다. 지원 범위는 균일한 단일 scale 행의 Day/Week다. 관측한 Core `_start`와 controlled origin이 같아야 하며 native tick 폭과 설정 cellWidth가 0.001px 이내로 일치해야 한다. 짧은 축에서 실제 tick 69px/설정 68px처럼 늘어난 폭은 UNMEASURABLE로 거부한다. 다중 scale, Month/custom scale, PRO와 다른 Core 버전은 지원 근거가 없다.

실제 Chromium에서 양방향 좌표, visible date reveal, tick/bar ≤1 CSSpx, Grid가 있는 경우 행/bar 중심의 y정렬을 확인한다. 390px Chart-only 공간에서는 숨겨진 Grid와의 y정렬을 주장하지 않는다. 월말/연말/윤일/DST의 달력 연산은 Unit 범위이며 실제 native 경계 날짜 기하는 NOT TESTED다. ms÷86400000을 별도 날짜 authority로 사용하지 않는다.

Core의 plot 높이와 native outer scroll owner 높이는 분리한다. 설치 소스는 physical 높이에서 scale 높이를 뺀 값을 `_chartHeight`로 저장한다. 관측 예는 outer 420px/scale 36px/plot 384px다. C 복원은 plot 높이를 사용하고 plot 높이가 0이면 거부한다. outer clientHeight와 Core plot 높이를 혼용하지 않는다.

## 상한·성능·cleanup

Manager PoC 상한은 10 calendar years, 최대 1,000,000 CSSpx, trial당 3회 확장이다. 달력 연산의 2월 29일 → 3월 1일 rollover를 Unit으로 고정한다. 동일 경계 중복/재진입을 막고 제한 초과는 명시 실패로 반환한다. receipt 대기는 1500ms, settle은 기본 1500ms/최대 5000ms·3개 안정 frame이다. 최신 intent/dispose가 기존 관측과 timer를 취소하고 listener/RAF/ResizeObserver는 instance 수명과 함께 정리한다.

single-read p95 <16.7ms를 목표로 40개 synthetic Task에서 100회 읽기를 측정한다. 최종 30개 프로파일의 p95는 모두 0.099999994ms, 관측 최대는 0.200000018ms였다. 정확한 값과 측정 환경은 [PoC 증거](evidence/issue569/adapter/summary.json)에 남긴다. 측정되지 않은 10년 장거리·대량·운영 성능은 NOT TESTED다. 제품 도입 전 최종 horizon/성능 정책을 다시 승인한다.

## 문서·후속 gate

ARCHITECTURE/DECISIONS/PROJECT_UX/MILESTONE_TIMELINE/TEST_PLAN/active PLAN/ISSUE_569를 동기화한다. 기존 제품 writer 미변경이므로 version 0.103.1 유지, release_required=false/release_authorized=false다. API/DB/auth/domain/운영·시각 언어·Agent 역할 변경은 N/A다.

독립 PRE_QA 후 PR CI로 넘긴다. exact-head quality/e2e/docker, QA_FINAL, Manager 최종 ACCEPT, main/GHCR은 NOT TESTED다.

## 공식 demo 실제 조작 증거

[공식 demo 영수증](evidence/issue569/official/receipt.json)은 Chromium1243/1440×1000에서 Willow 열기, Scroll-to-date 양끝 이동, cell slider와 flexible column grip 실제 조작을 기록한다. scroll start0/end2304(native max2305), cell width100→111와 native scrollWidth3300→3663, text column171.5→221px를 관측했다. 최신 demo의 정확한 package/Core version은 UNKNOWN이므로 설치2.7.3의 지원·날짜정확도·무한확장 PASS로 이관하지 않는다.

## 취소·명령 실패 정책

명령의 동기 throw·false 반환·thenable rejection·receipt timeout은 기존 DOM이 안정돼 있어도 성공으로 바꾸지 않는다. receipt와 layout settle 모두 유한 대기이며 최신 사용자 intent 또는 dispose가 대기와 timer를 취소한다. 취소 뒤 이전 transaction의 후속 명령은 발행하지 않는다.

C의 synthetic width 적용과 physical width 복원 사이에 취소되면 Core에 임시 기하가 남을 수 있다. 후속 명령 금지를 우선하고 adapter가 해당 불완전 상태를 유효한 geometry로 재사용하지 않도록 한다. 자연적인 physical layout 복귀를 실제로 읽어 확인한 뒤 명시적으로 adapter를 재생성하는 것이 회복 조건이다. adapter 재생성만으로 기존 Core의 임시 기하가 복구됐다고 간주하지 않는다. 이 취소 구간의 실측이 부족하면 C의 제품 도입은 DEFER이며 기존 제품 경로의 안전성을 이번 PoC로 승인하지 않는다.

## 실패 이력과 증거 해석

초기 origin 불일치와 7 PASS/3 FAIL matrix는 가상화된 offscreen tick의 측정 문제 및 넓은 Week의 늘어난 cell 폭을 드러냈다. 이후 source 변경이 섞인 실행은 중간 진단으로만 보존한다. 최종 source를 고정한 실행과 프로파일별 oracle 반복만 최종 증거로 사용한다. 허용 오차 증가, 고정 지연, 기존 테스트의 assertion/timeout/skip 변경으로 실패를 숨기지 않는다.

기존 main의 #367/#514 원본 회귀는 8/8 PASS, 별도 PR #562의 #551 원본 회귀는 2/2 PASS다. source가 다른 이 결과를 신규 adapter 또는 Milestone stack 전체의 PASS로 옮기지 않는다. [회귀 manifest](evidence/issue569/regression/manifest.json)와 [공식 demo 영수증](evidence/issue569/official/receipt.json)을 구분한다.

최종 source를 고정한 Chromium matrix는 10/10 PASS(30개 A/B/C trial)이며, 그 직전 clean matrix도 10/10 PASS다. 최종 단일 Unit suite는 19 PASS, typecheck와 변경 파일 lint는 PASS다. [Adapter manifest](evidence/issue569/adapter/manifest.json)는 source 및 선별 산출물 SHA-256을 고정한다. 이 로컬 결과는 PR CI 결과를 대체하지 않는다.

## PR #576 코드 리뷰 보완 (2026-10-09)

- 날짜↔px는 실제 Core `state.scales`가 정확히 1행이며 controlled `axis.unit`과 같은 단위이고 `step===1`일 때에만 계산한다. 불일치 시 `UNMEASURABLE`.
- 개발용 PoC의 `extend`는 진행 중 재진입을 `BUSY`로 거부한다. 중복 요청은 확장 예산을 소비하거나 동일 React state commit을 성공으로 계상하지 않는다.
- Empty/Milestone/A-mode future task는 settle 결과와 실제 Core task 상태·native DOM 상태를 검사한다. 검증용 변화일 뿐이며 제품 적용은 계속 DEFER.
- 과거 브라우저 증거는 이전 Head의 결과이고 새로운 PR CI는 별도 확인이 필요하다.

### PR CI #2292.1 실패 원인 및 수정

- 최신 E2E shard 1/6에서 10개 프로파일 모두 `getState().tasks === null`인데 배열 `[]`을 가정해 실패했다. Quality/Docker 및 다른 5개 shard는 PASS였다.
- **2.7.3 공개 API `serialize()`**로 실제 Core Task 컬렉션을 읽으며, null/비배열은 성공으로 대체하지 않고 검증 실패로 남긴다. DOM `data-task-id` 관측과 실제 settle assertions는 유지한다.
- 이 수정 후 Head의 브라우저/E2E 결과는 별도 PR CI에서만 확정한다. 이전 10/10 PoC 증거 또는 앞선 CI 성공을 새 결과로 전용하지 않는다.

### PR CI #2293.1 E2E Milestone 직렬화 계약 수정 (2026-10-09)

- `quality`/`docker` 및 Chromium shard 2~6 PASS, shard 1의 #569 10개 프로파일 FAIL. 동일한 실패는 Milestone을 `start=end`라고 잘못 가정한 assertion에서 발생했다.
- 설치 Core 2.7.3의 `api.serialize()` 출력에는 Milestone의 `start`만 있고 `end`가 없다(`endMs=null`). [SVAR 공식 Milestone 가이드](https://docs.svar.dev/react/gantt/guides/tasks/milestone/)도 duration=0, start만 있고 end 없음으로 정의한다.
- 합성 Milestone fixture의 `end` 입력을 제거하여 문서 계약과 일치시키고 E2E의 기대 직렬화 결과를 `{startMs: 2026-01-10, endMs:null}`로 교정했다. Empty 배열·Milestone 단일 id·native DOM 표시·A 미래 Task 변경·settle 검증은 유지한다. 기존 경로의 검증 제한/제품 도입 DEFER도 유지한다.
- 이번 새 Head의 전체 CI 성공 여부는 새 PR CI 결과를 확인하기 전까지 **NOT VERIFIED**이다. 앞선 Head의 CI 성공 및 로컬 결과를 전용하지 않는다.

### PR CI #2294.1 세 경계 실패 분석과 수정 (2026-10-09)

- CI #2294.1: Quality/Docker PASS. E2E shard 1(390px Day, fallback 직후 `NO_SCROLL_CAPACITY`), shard 2(#463 복원 진단 attribute null), shard 6(#530 Playwright `pauseAt`가 install 시점보다 과거) 각 1건 FAIL. 다른 shard는 PASS. 과거 #569 Milestone 직렬화 오류와는 다른 실패다.
- #569 테스트는 Chart-only 토글 직후 **native geometry가 실제로 measurable 상태**가 될 때까지 조건 기반으로 폴링한 뒤 `NATIVE_LAYOUT_SETTLED` 3프레임 검사까지 통과해야 한다. 확장/좌표의 FAIL 판정, timeout, PoC DEFER 및 성공/실패 분류 oracle은 변경하지 않는다.
- 기존 #463 테스트는 복원 이벤트가 아예 불필요한 same-instance 상황의 `data-gantt-peer-restore=null`을 허용하되, 검색 전후 raw marker 불변과 Core/native viewport strict equality를 확인한다. 앱 writer는 변경하지 않는다.
- 기존 #530 테스트는 Playwright 공식 Clock의 install→pauseAt 시각 역행을 피하기 위해 pause 목표를 먼저 고정하고 가상 install 시각을 60초 앞서 설정한다. pause는 같은 현실시각에서 이뤄지며 이어지는 500ms 안정성 검증을 유지한다. 해당 버전/CI runner에서의 최종 통과는 새 PR CI 결과만이 근거다.
- 제품 적용 DEFER, 기존 version 0.103.1, merge/release/Issue 종료 제외는 유지한다. [Playwright Clock 공식 문서](https://playwright.dev/docs/api/class-clock).

## PR CI 반복 실패의 증거 경계

최초 `evidence/issue569/adapter/manifest.json`과 summary는 PR 최초 head `469de57567d8b06269b649f76caa67071fc0d613`에 대응하는 source snapshot이다. 이후 P2 및 CI 보완의 현재 source hash로 재표시하지 않는다. 최신 작업 baseline은 `9f0458124198470872c6764cbd5b00dedc75417b`이며 그 CI #2295.1에서는 #569 PoC를 포함한 shard 1이 PASS였다. 이 실행의 전체 E2E는 별도 #463 검색 후 viewport 기대값 때문에 FAIL이므로 전체 PASS로 해석하지 않는다.

Empty는 공개 serialize 결과를 정규화하고 Milestone은 종료일이 없는 시점으로 검증한다. Chart-only 확대는 native 측정 가능 조건을 기다린 뒤 기존 3-frame settle을 요구한다. 이 기존 보완을 유지하며 현재 REWORK는 #463의 peer/layout 보존과 filter 축소의 native clamp를 구분하는 검증 보완이다. adapter 구현·지원 분류·제품 도입 DEFER와 PoC 상한은 이번 보완에서 변경하지 않는다. 상세 최초 오류와 실행별 연결은 Work Packet의 종합 실패 이력으로 관리한다.

## Issue #661 — 상태 정합성 표준과 후속 Adapter 결정

상태: `REVIEW_PENDING`. 장기 규범은 [Gantt State Consistency](GANTT_STATE_CONSISTENCY.md), 적합성 검증은 [Conformance Matrix](GANTT_STATE_CONFORMANCE.md), 구현 단위·파일 소유권은 [구조적 보완 계획](exec-plans/active/GANTT_STATE_REMEDIATION.md)을 따른다. 기존 위쪽 실험/실패/DEFER 원장은 그대로 보존한다. 문서 갱신은 A/B/C 제품 채택이나 기존 #552 실패 해결의 증거가 아니다.

후속 결정은 세 경계를 명시적으로 보강한다. GSC-02는 canonical key 동일성뿐 아니라 실제 Core payload/tree/order/link와 recovery 상태를 검사한다. GSC-05는 synthetic resize도 간접 viewport writer로 취급하며 날짜 범위·물리 container·X/Y 보존 정책을 각각 검증한다. GSC-06은 의미가 같은 재관측과 실제 Core/query/axis/사용자 의도 변경을 구별한다. 기존 receipt의 유효성을 자기신고로 승인하거나 모든 관측 generation 변경을 무조건 무시하지 않는다.

U4는 설치 2.7.3에서 실제 Core fixture로 A/B/C 또는 최소 개선안을 비교하고, 지원 프로파일·취소 중 임시 geometry·원래 X/Y·실제 사용자 입력의 우선권·상한을 증명한 한 가지 전략을 U5에 전달한다. 최신 문서의 props를 설치 버전의 런타임 보장으로 확대하지 않으며 library upgrade, private Store 변경, 새 scroll controller는 이 결정의 범위가 아니다. 실제 source를 확인한 후에도 불충분하면 `DECISION_REQUIRED/DEFER`와 대안을 기록한다.

표준 예외/전략 채택 기록에는 적용 GSC ID, 버전·프로파일, 원본 실패와 반례, 선택/기각 대안, 실제 검증 source와 결과·미검증, rollback·재평가 조건, 승인 주체를 포함한다. 규범 승인과 제품 연결 및 CI 성공은 별도 gate다. 이 문서 변경 자체로 보호된 CI/QA/Owner·릴리스 권한을 바꾸지 않는다.

## Issue #663 — U1 읽기 포트와 설치 serialize 경계

React wrapper2.7.3의 실제 transitive gantt-store는2.7.2이며 두 package 버전을 별도 provenance에 기록한다. U1의 공통 public reader는 `src/features/gantt/state-consistency/index.ts`에서 제공하며 실제 설치2.7.3의 tasks/tree/links를 정규화한다. `tree`는 전체 DFS flat 배열이며 중첩 `data` 참조를 다시 flatten하지 않는다. renderer duration·open·좌표 캐시는 비교에서 제외하되 parent·형제 순서·adapter-owned payload·Links는 보존한다. null/읽기 실패를 빈 정상 상태로 바꾸지 않는다.

[합성 browser fixture와 provenance](../tests/fixtures/gantt-state-consistency/actual-core-provenance.json)는 현재 공식 [serialize 문서](https://docs.svar.dev/react/gantt/api/methods/serialize/)·설치 타입·실제 runtime 출력의 근거를 분리한다. file:// fixture는 기존 #568 bounded trace를 재사용하고 production port/제품 연결은 추가하지 않는다. 기존 A/B/C 실험 DEFER와 실패 원장은 불변이며 U1 reader 검증을 범위 확장·geometry·날짜축 지원 승인으로 사용하지 않는다. 상세 [Work Packet](exec-plans/active/ISSUE_663.md).

## Issue #663 — Summary 날짜 기대값 정규화와 CI 재작업

설치2.7.3은 날짜 없는 canonical Summary도 하위 Task에서 시작/종료를 계산해 serialize한다. U1은 해당 canonical의 **누락된 날짜만** bottom-up으로 도출하고 명시적 canonical 날짜·실제 Core 날짜를 제거하지 않는다. 원본 synthetic canonical↔실제 capture와 nested Summary/날짜 drift를 Unit으로 비교한다. 실제 snapshot/provenance source와 기존 DEFER 원장은 유지하며 제품 복구 알고리즘으로 확대하지 않는다.

#2779 P2 보완 뒤 #2780 Unit/TypeScript의 미정의 normalizeCanonicalCore는 테스트 import 누락으로 별도 발생했다. public export import를 복구하고 기존 일치/불일치 단언과 typecheck를 실행하며 허용오차·timeout·workflow를 변경하지 않는다. 로컬/원격·skipped/미검증은 [#663 원장](exec-plans/active/ISSUE_663.md)에서 구분한다.

## Issue #664 — U2 actual conformance / recovery facade

결정 범위는 U1 공개 reader/clock/abort 계약을 소비하는 opt-in 모듈이다. 기존 canonical sync 호출자와 production Coordinator/port를 변경하지 않는다. 공개 serialize 전체 Task/tree/Link를 정규화하고 실제 순서·날짜·payload·관계 차이만 복구한다. Link 배열의 열거 순서는 관계 의미가 아니며 Task preorder/parent는 의미다. collapsed/virtualized DOM subset으로 full canonical을 대체하지 않는다.

공식 [serialize](https://docs.svar.dev/react/gantt/api/methods/serialize/), [move-task](https://docs.svar.dev/react/gantt/api/actions/move-task/), [update-task](https://docs.svar.dev/react/gantt/api/actions/update-task/) URL 확인과 설치 React2.7.3/store2.7.2 실제 fixture 결과를 구분한다. 공개 명령 반환만으로 recovered를 승인하지 않으며 후속 실제 Core read가 일치해야 한다. private Store/PRO/새 resize·viewport 우회는 없다. 기존 A/B/C 실험 DEFER/FAIL과 #2682 제품 실패는 유지한다.

U5는 read-only canonical GET, stale revision·query/scope 거부, native invalidation과 serialized queue, 401 권한 잠금/초안, uncertain GET 실패의 추가 쓰기 차단을 연결한다. date-only/Task exclusive-end/Milestone renderer 기본값은 기존 adapter/U1 normalization을 재사용한다. 실제 제품 no-op/복구·Bar geometry·간접 viewport 영향은 아직 미검증이며 [#664 Work Packet](exec-plans/active/ISSUE_664.md)의 증거 범위를 따른다. 롤백은 facade와 연결 소비자를 함께 되돌리며 DB 변경은 없다.

## Issue #666 — U4 날짜축 transaction facade (2026-10-15)

상태: 미활성 모듈 구현 및 로컬 검증, 제품 도입 DEFER. 기존 #569의 제품 채택 DEFER와 실패 이력은 유지한다. U4가 준비하는 단일 facade는 `src/features/gantt/viewport/axis-transaction.ts`의 `createAxisTransaction`이며 U5가 production Coordinator의 원래 lease를 전달할 때에만 연결할 수 있다. 이번 PR은 production port/Coordinator/ProjectGantt/Workspace를 변경하지 않는다.

### 전략과 근거

2026-10-15 최신 공식 [resize-chart](https://docs.svar.dev/react/gantt/api/actions/resize-chart/)의 width/height는 실제 container 크기이고, [scales](https://docs.svar.dev/react/gantt/guides/timeline/scales/)의 start/end·autoScale은 날짜 범위 계약이다. 최신 문서의 설명을 설치 React2.7.3/store2.7.2의 same-instance 상태 보존 증거로 사용하지 않는다. 기존 source/lockfile fingerprint와 새 실제 browser 관측은 [Work Packet](exec-plans/active/ISSUE_666.md) 및 전용 fixture provenance에서 구분한다.

| 전략 | U4 판단 / 조건 | 남은 위험 |
| --- | --- | --- |
| A autoScale | 기존 API 동작의 비교군이며 facade의 암묵적 자동 확장으로 채택하지 않음 | unchanged-data scroll의 무한 확장 계약 없음; 실제 unsupported 결과를 보존 |
| B explicit extent | 미활성 facade의 우선 실험 전략. 공개 props 변경은 callback port가 소유하고 actual coverage/physical/position 검증 뒤에만 SETTLED | same-instance prop commit·filter·layout 경합은 새 실제 profile 증거 필요; 제품 채택은 U5/#573/#574에서 별도 판단 |
| C synthetic compatibility | 설치 wrapper2.7.3/store2.7.2·명시 opt-in·actual API source identity가 모두 필요하며 제품 도입 DEFER | 물리 width 의미 밖의 예외; 중단·timeout·실패 뒤 해당 source를 taint해 facade 재생성으로 우회하지 않음 |

### 유한 실행과 권한

원래 request의 UserIntentLease·AbortPort를 유지한다. request extent와 변경 전 extent의 합집합만 전달하여 좌우 날짜 coverage를 축소하지 않는다. prepare의 Core X/Y를 preserve 목표로 고정하며 resize 이후 부수 X/Y를 새 목표로 삼지 않는다. 실제 geometry의 안정 관측 뒤에만 origin/preserve/explicit position 정책을 적용하고 Core exact/native ±1px의 연속3frame 확인으로 SETTLED를 반환한다. capacity 부족은 NO_SCROLL_CAPACITY/UNAVAILABLE이며 allowClamp를 명시한 경우에만 CLAMPED를 반환하고 requested/applied/capacity를 함께 기록한다.

API/query/scope/layout/외부 axis·사용자 입력/명시 reveal·hidden/unmount 취소의 소유자는 기존 Coordinator/호출 port다. facade의 isLeaseCurrent/abort는 그 원래 권한을 확인하며 자체 승인 extent 변경은 예상 전후 transition으로 검증해야 한다. await 뒤 새 lease를 만들거나 취소 후 과거 위치를 replay하지 않는다. 서로 다른 요청은 BUSY, 같은 request와 동일 lease/abort는 coalesce한다.

요청 union과 초기/coverage/physical/settle의 실제 관측축을 모두 검증한다. port 권한 읽기 실패는 typed FAILED/PORT_FAILED로 반환하고 원문 오류를 노출하지 않는다. 상한은 date extent 전체10calendar years, 실제 scale width1,000,000CSSpx, facade당 확장3회다. 기본 deadline1500ms/120frame와 실제 geometry3frame·Core/native3frame을 사용하며 기존 테스트 timeout/허용오차·skip을 변경하지 않는다. synthetic taint는 실제 source object의 weak lifetime으로 보관해 ID 재사용/메모리 증가와 재생성 우회를 방지한다. 동일 source의 자동 taint 해제는 지원하지 않으며 자연 physical 회복 관측·별도 검토 없이 재사용하지 않는다. dispose와 abort는 현재 관측의 frame/listener를 취소하고 후속 callback은 context.current()/signal로 delayed write를 차단해야 한다.

### 인계와 검증 경계

신규 모듈은 U1 public ports/type을 소비하며 U2/U3 concrete 구현에 의존하지 않는다. 실제 source별 지원/미지원 결과와 local tests·원본 실패·미검증은 Work Packet의 실행 원장에 기록한다. standalone 합성 Core는 실제 제품 membership/revision·HTTP/SQLite·marker/Grid/Task Editor 통합을 대신하지 않는다. #667 제품 연결·#573 작은 화면/focus·#574 최종 누적 검증 후 별도 Owner 수용 전 제품 해결 PASS를 주장하지 않는다. rollback은 facade와 연결 소비자를 함께 수행하며 기존 compatibility의 알려진 한계를 유지한다.

### 동일 source의 실제 비교 결과

최종 implementation fingerprint는 `e747196c95b95235fb8b3be0b25cf7fa88043742b95403eabcad14971995368a`다. fixture mode `U1`은 공통 U1 포트를 사용하는 U4 facade trial을 뜻하며 U1 reader 검증의 재사용 PASS가 아니다.

| 프로파일 | A / B 비교군 | C 비교군 | U4 explicit facade |
| --- | --- | --- | --- |
| 390px Day/Week | NO_SCROLL_CAPACITY | NO_SCROLL_CAPACITY | NOT_MEASURABLE; 좁은 제품 fallback DEFER |
| 768/1024/1440px Day | 각각 3회 정착 | 첫 회 TIMED_OUT, 이후 NOT TESTED | 오른쪽 끝 3회·X/Y 보존·실제 capacity 증가 SETTLED |
| 768/1024/1440px Week | 각각 3회 정착 | 각각 3회 정착 | 오른쪽 끝 3회·X/Y 보존·실제 capacity 증가 SETTLED |
| 1920px Day/Week | 각각 3회 정착 | 각각 3회 정착 | 오른쪽 끝 3회·X/Y 보존·실제 capacity 증가 SETTLED |

A/B/C 비교군은 기존 fixture에서 명시 extent 변경을 포함한 trial이다. A의 unchanged-data right-edge scroll 자체 자동 확장 계약으로 확대하지 않는다. 새 Core fixture는 60개 합성 Task, 고정140px Grid/500px 높이·단일 scale의 자체 profile이다. 과거 #569의 다른 profile FAIL/DEFER를 소급 수정하지 않는다. U4의 넓은 화면8profile×3회24확장은 새 facade 결과이며 broad 제품 지원 PASS가 아니다.

short project의1440px Day/Week에서 normal/global empty/M-only/no-match의8case는 ORIGIN Core/native0으로 정착했고,390px의8case는 UNAVAILABLE다. no-match는 실제 filter-tasks를 실행하여 canonical60/visible0 및 task/tree/link 불변을 확인했다. 확장 commit 직후 실제 wheel/Task reveal/Milestone reveal/filter/열/물리 폭 변경6case는 SUPERSEDED 및 후속 쓰기0이다. C 실제 synthetic 쓰기1후 취소·복원 쓰기0·동일 API 재시도의 COMPATIBILITY_TAINTED를 확인했다.

B를 미활성 facade의 검증된 넓은 profile 전략으로 선택하며 C는 물리 width 예외·실제 Day 위치 실패·중단 taint 때문에 제품 채택하지 않는다. native fullscreen API/제품의 column-resize UI·marker/Grid 정렬·390px fallback·대량1000+2000·장기 lifecycle·Task Editor와 HTTP/SQLite 통합은 U5/#573/#574의 NOT TESTED다. 같은 synthetic profile의 성공만으로 전체 AC 또는 제품 해결을 승인하지 않는다.

추가 actual capacity 경계: allowClamp=false는 requested.left5393/native capacity5293에서 NO_SCROLL_CAPACITY·쓰기0, allowClamp=true는 Core/native5292와 목표5293이 달라 TIMED_OUT이다. 실제 full-capacity clamp는 FAIL / 제품 지원 DEFER이며 fake Unit의 CLAMPED 결과로 대체하지 않는다. Core/native의 유효 capacity 교집합은 현재 U1 port의 별도 관측 계약이 없어 U5에서 먼저 결정해야 한다. 임의1px 보정·Core exact 완화는 하지 않는다. 완료 후 actual wheel의100→237 및 추가 facade 쓰기0은 별도 확인했다. 최종 capture72는 성공/불가/실패·취소를 포함한 scenario group 수다.

### PR #690 source-wide taint 보완 (2026-10-15)

미완료 synthetic geometry의 위험은 전략이 아니라 동일 Core API **object identity**에 귀속된다. `AxisTransactionOptions.source`를 필수로 받아 EXPLICIT_EXTENT도 이전 facade의 taint를 확인한다. SYNTHETIC_COMPATIBILITY의 opt-in source는 동일 object여야 하며 불일치 시 명시적으로 거부한다. source는 각 mount에서 새로 생성된 실제 API object이고 동일 mount 전략 간 공유한다. 새 wrapper object를 임의 생성해 오염을 우회하지 않는다.

기존 72개 Chromium capture는 리뷰 보완 **이전** source의 역사적 증거로 고정하며 원본 파일·SHA를 덮어쓰지 않는다. `*.snapshot.txt`에 기존 구현과 browser 소스를 보존해 fingerprint를 검증하고 현재 소스의 동작은 강화된 Unit으로 별도 검증한다. 리뷰 보완 버전의 재실행 Chromium/제품 E2E는 아직 NOT TESTED이며 기존 full-capacity clamp FAIL·390px DEFER를 유지한다.

## Issue #667 — U2/U3/U4 제품 소비 결정

기준 main `29c86ca918baa1811bc12a3eb60f86ffc5406b40`, 설치 React Gantt2.7.3/store2.7.2. 제품 mount 단위 adapter는 공개 serialize의 실제 Core 정합을 검사하고 서버 확인 결과를 소비한다. 의미 관측은 완료 재사용을 검증하며 같은 canonical key만으로 dirty Core를 승인하지 않는다. viewport/axis 쓰기는 기존 Coordinator/port 하나로 모은다.

U4 제품 경로는 기존 #367 synthetic/physical resize pair를 SYNTHETIC_COMPATIBILITY transaction 안에서 소비하며 actual coverage·geometry·명시 X/Y 정책을 관측한다. 명시 end prop 전략은 React wrapper 재초기화와 선택/열·geometry 보호 위험 때문에 채택하지 않는다. pair 실행 자체나 #666 clamp 실패를 성공으로 승인하지 않고 불완전 geometry taint·측정 불가·취소를 별도 결과로 유지한다. 현재 공식 exec 반환형(void)과 설치 Promise 타입 차이를 정착 근거로 사용하지 않으며 actual Core/native 관측을 유지한다. 기존 A/B/C 실패·DEFER 원장은 불변이다.

#675는 미병합 진단 patch이므로 복사하지 않고 main #686의 독립 준비 영수증을 보존한다. 제품 표시는 native Milestone 행/marker 미활성을 유지하며 #552에서 별도 변경한다. source·실제 결과·compatibility 한계·rollback은 [#667 Work Packet](exec-plans/active/ISSUE_667.md)을 따른다. 규범 GSC1.0.0-candidate/REVIEW_PENDING을 변경하거나 예외 승인을 추론하지 않는다.

U5의 `recoverNaturalGeometry`는 taint를 새 facade/새 전략으로 우회하지 않는다. source-wide 미완료 writer0·active0과 독립 Core 물리 크기·native DOM/axis/capacity/X/Y의 유한 3프레임 일치를 읽기 전용으로 확인하며, 실패/취소/숨김이면 기존 taint를 유지한다. 원래 새 요청 lease만 소비하고 과거 위치 replay·복구 resize/scroll·확장 예산 재발급은 하지 않는다. 실제 add→취소 후 width936 실패 및 현재 source 재검증은 #667 Work Packet에서 추적한다.

제품 축 예산은 mounted lifetime이 아닌 등록 command별 bounded attempt다. 기존 모듈의 facade당3회/4회째거부 검사를 유지하며 제품은 명령당1회로 제한한다. 새 facade도 같은 API/source의 전역 taint/active transaction/미종료 callback을 공유하므로 재생성으로 불명확 geometry를 우회할 수 없다. 실패/취소/BUSY인 같은 명령을 새 facade로 자동 재시도하지 않으며 전체10년/1,000,000px 상한은 그대로 적용한다. 이 범위 결정은 기존3회 반복 edge 제품 회귀의 예산 소진 실패를 근거로 한다.

RANGE_EXTENSION도 U4 안에서 기존 X/Y를 보존하므로 capacity-only 예외로 다른 좌표 명령과 병렬 승인하지 않는다. 더 높은 우선순위의 filter/peer/reveal이 pending이면 거부하고 원래 epoch/revision이 바뀌면 위치 쓰기 권한을 폐기한다. 실제 Core scale unit과 React 표시 단위가 일치한 뒤에만 축을 준비한다. untagged native 앞 이동이 SVAR scroll 이벤트의 요청 좌표와 실제 native DOM 좌표에서 일치하면 오래된 passive 축 보존을 취소하고 그 ingress의 고정 stamp로 새 edge 요청을 등록한다. 이는 인간 wheel 입력의 실증이 아니라 실제 native 이동에 대한 supersession 정책이다. own tag/기준 target·뒤로 clamp·이벤트 좌표만 변경되고 DOM이 움직이지 않은 상태·폐기된 source/context의 늦은 callback은 새 의도로 승격하지 않는다.

같은 live API/context에서 태그 없이 실제 native 앞 이동을 일으킨 지연 callback과 사용자/프로그램 이동은 공개 계약만으로 구별할 수 없다. 이 경우 현재 물리 이동이 오래된 passive 보존을 취소하는 정책을 적용하며 인간 입력으로 판별했다고 주장하지 않는다. 데이터 저장/권한을 승인하는 근거로 사용하지 않는다.

지원 범위는 설치 Core 2.7.3/store 2.7.2 및 현재 동기 resize/scroll handler 프로파일이다. port의 1500ms Promise race와 U4 callback 종료는 임의의 미래 async-before-Store writer가 끝났다는 일반 보장이 아니다. library 또는 해당 handler를 비동기로 변경할 때 source taint·늦은 쓰기·natural recovery를 재검증해야 한다.

#667 CI #2811 보완: view visibility 변경의 layout phase에서 legacy bridge receipt를 폐기한다. PEER_RETURN은 원래 lease로 fresh visible U3 receipt를 기다린 뒤 기존 acceptedProjection 고정·3-frame settle을 수행한다. 이전 session의 좌표 일치만으로 완료하지 않으며, 완료 대기 중 generation 변경을 무시하도록 완화하지 않는다.
