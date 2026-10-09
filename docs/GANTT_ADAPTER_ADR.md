# ADR — SVAR 2.7.3 공개 API와 Chart 기하 Adapter (#569)

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
