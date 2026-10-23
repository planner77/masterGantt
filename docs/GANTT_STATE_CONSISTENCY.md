# Gantt State Consistency Standard

표준 식별자: `GSC` · 버전: `1.0.0-candidate` · 작성: 2026-10-13 · 소유: Architecture/Manager · 문서 상태: `REVIEW_PENDING`

이 문서는 Gantt/Grid/Task Editor/Milestone/Calendar/Resource drill의 상태 정합성에 관한 장기 규범이다. [AGENTS](../AGENTS.md)는 필수 읽기 진입점, 본 문서는 규칙의 단일 원본, [Conformance](GANTT_STATE_CONFORMANCE.md)는 검증 기준, [보완 계획](exec-plans/active/GANTT_STATE_REMEDIATION.md)은 이번 이행 순서다. 문서 PR이 main에 반영되기 전에는 전역 배포 완료가 아니다. 구현 적합성은 별도이며 현재 구조적 보완은 `NOT IMPLEMENTED / NOT TESTED`다.

## 1. 적용 범위와 문서 우선순위

아래 경로와 그 호출자를 변경하는 에이전트는 이 표준을 적용한다: `src/features/gantt/**`, `src/features/projects/project-readonly-view.tsx`, Task/Milestone Editor와 Dashboard, Calendar 저장, Resource drill/return, 관련 Unit/Integration/E2E 및 동기화 진단 코드.

보안·권한·서버 도메인 규칙·기존 CI/QA/릴리스 게이트를 이 문서로 완화하지 않는다. [ARCHITECTURE](ARCHITECTURE.md), [Adapter ADR](GANTT_ADAPTER_ADR.md), [Sync Trace](GANTT_SYNC_TRACE.md), [PROJECT_UX](PROJECT_UX.md), [MILESTONE_TIMELINE](MILESTONE_TIMELINE.md), [TEST_PLAN](TEST_PLAN.md)의 기존 기능 계약을 유지한다. 승인된 본 규범과 과거 이슈별 서술이 충돌하면 아래 GSC-02/05/06의 명시적인 정합성 기준으로 차이를 기록하고 ADR에서 대체 범위를 승인한다. 과거 실험의 DEFER/FAIL을 삭제하거나 새 문서로 PASS로 바꾸지 않는다.

규범의 MUST는 필수, SHOULD는 근거 있는 예외만 가능한 권고다. 규범 승인, 구현 완료, 테스트 성공, 제품 배포는 서로 다른 상태다. `ACCEPTED` 승격은 문서 검토·기존 게이트·main 반영을 기록한 뒤에만 하며, 이것만으로 제품 준수를 선언하지 않는다.

## 2. 상태 모델: 같아 보이는 상태를 혼합하지 않는다

| 상태 | 권위 / 의미 | 다른 상태로 대신할 수 없는 이유 |
| --- | --- | --- |
| Canonical snapshot + revision | 서버가 확인한 Task/Link/Membership/도메인 데이터 | 같은 revision에서도 사용자가 이미 Core를 드래그했을 수 있음 |
| Desired projection | canonical + 명시 query/scope/display로 계산한 목표 | 이전 목표와 같은 것이 실제 Core 일치를 뜻하지 않음 |
| Observed Core | 해당 API 인스턴스에서 실제 읽은 payload/tree/order/links | 브라우저의 임시 변경을 서버 확정으로 취급할 수 없음 |
| Logical visible rows | projection + 접힘 상태의 논리 행 순서 | canonical 전체나 현재 DOM subset과 다름 |
| Native DOM / geometry | 가상화된 행, Chart 물리 크기, 실제 scroll | DOM에서 없는 행을 삭제/Milestone으로 판정할 수 없음 |
| Axis extent | 날짜 start/end와 scale 단위 | container width나 scroll offset과 별개 |
| User intent / lease | 최신 입력·명시 탐색·query/peer 문맥의 유효 권한 | 예전 자동 복원을 최신 입력으로 재승인하면 안 됨 |
| Observation attempt | 몇 번째 관측인지 | 의미가 같은 재관측은 데이터 변경이 아님 |
| Recovery state | pending/uncertain/required/reconciling/settled | 같은 canonical이어도 필요한 복구는 생략할 수 없음 |

실제 타입/필드명은 U1에서 기존 타입과 호환되게 확정한다. 새 상태 이름을 추가하는 것만으로 해결했다고 보지 않는다. 각 상태의 생성·변경·취소·읽기·쓰기를 담당하는 소유자와 관측 증거가 있어야 한다.

## 3. 필수 규칙

### GSC-01 — 저장 데이터와 표시의 권한 분리

서버 확정 snapshot을 유일한 저장 권위로 유지한다. 표시 토글·검색·scope·레이아웃·복구는 서버 mutation을 새로 발생시키지 않는다. Milestone은 native WBS에서 제외되어도 canonical ID/parent/siblingOrder/roll-up/Link/Membership과 구조 명령의 전체 subtree에는 남는다. native Core가 보유하는 전체 데이터와 WBS 표시 subset을 별도로 검증한다.

### GSC-02 — 실제 Core 정합성에 근거한 no-op

`sameAppliedProjection` 또는 revision/key 동일성만으로 canonical 검증·복구를 조기 종료하지 않는다. 생략은 다음을 모두 증명한 경우에만 가능하다.

1. 같은 API 인스턴스와 같은 목표 의미이다.
2. 실제 Core의 정규화된 데이터·계층·형제 순서·Link가 목표와 일치한다.
3. 아직 완료되지 않은 임시 Core 변경이나 미해결 recovery가 없다.
4. 검증 이후 관련 Core 변경 이벤트가 없어 그 증거가 여전히 유효하다.

정규화는 adapter가 명시적으로 소유한 필드에 한정한다. date-only/renderer 기본값 등 기존 변환은 유지하되, 좌표 캐시 같은 파생 필드를 canonical 변경으로 오인하지 않는다. 반대로 정렬은 단순 ID Set 비교로 승인하지 않는다. 읽기 실패·불명확한 상태는 no-op으로 승인하지 않는다.

전체 O(N) 스캔을 매 render/frame마다 수행하는 대신 검증된 Core mutation generation/dirty 상태를 이용할 수 있다. 단, native drag/inline/add/delete/link/type/structure와 app-owned 동작의 구분 및 누락 없는 invalidation을 테스트해야 한다. 새 사용자 편집이 pending인 동안 과거 snapshot으로 무조건 되돌리는 것도 금지한다.

### GSC-03 — 저장 거부와 결과 불명확성의 복구

request ID·base revision·affected IDs·Core dirty 상태로 임시 편집과 서버 응답을 연결한다. 401/412/422 등 확정 거부는 최신 확인된 권한·snapshot으로 실제 Core를 복구한다. 412에서는 다른 사용자의 새 revision을 읽어 오래된 기준으로 덮지 않는다.

500·timeout·연결 단절은 서버 commit 여부가 불명확할 수 있다. GET으로 최신 상태를 확인하기 전 자동 mutation 재시도, 과거 snapshot의 확정 성공 표시, 임의 revision 승격을 금지한다. GET도 실패하면 불확실/복구 필요 상태를 명시하고 충돌하는 추가 쓰기를 기존 UI 정책에 따라 차단하며 초안은 보존한다. 회복 후 canonical이 동일하더라도 실제 Core의 순서·날짜·임시 행·Link를 확인한다.

### GSC-04 — 상태별 쓰기 소유자

Canonical Reconciler는 data/tree/order/link의 검증·최소 변경을 소유하고 Viewport Coordinator는 앱의 X/Y·명시 탐색·축 transaction 권한을 소유한다. Native 사용자 wheel/reveal은 Core의 원래 동작을 유지한다. app이 native 이벤트를 다시 명령으로 보내는 feedback loop를 만들지 않는다.

`resize-chart`, `filter-tasks`, `set-columns`, display/fullscreen 변경도 간접적으로 X/Y를 바꿀 수 있다. 직접 `scroll-chart` 호출을 한 파일로 옮긴 것만으로 단일 writer 준수를 선언하지 않는다. 모든 직접/간접 변경 경로를 transaction/영향표에 등록하고 적용 전후 승인된 결과를 검증한다. 상위 Workspace나 Milestone lane에 두 번째 복원 컨트롤러를 만들지 않는다.

### GSC-05 — 날짜축 확장과 viewport 정책 분리

축 범위, 물리 Chart 크기, X/Y는 별도 값으로 취급한다. RANGE_EXTENSION은 필요한 날짜 범위와 유효한 위치 정책을 입력으로 받아야 하며 resize의 부수 좌표를 성공 결과로 채택하지 않는다.

준비 → 축 변경 → 실제 geometry 관측 → 유효한 위치 정책 적용 → Core/native 확인의 유한 transaction을 사용한다. 직접 resize API의 반환은 완료 증거가 아니다. 기존 synthetic resize compatibility는 버전 한정 예외이지 공식 무한 범위 지원 계약이 아니다. 대안은 설치 버전에서 작은 PoC로 비교하며 미검증 controlled start/end·PRO/private 기능으로 즉시 전환하지 않는다.

필터 0행에서도 날짜축 start/end 유지와 조회 위치 정책을 독립 검증한다. 기존 검색 결과 0행의 원점 정책을 유지하되 이후 실제 사용자 이동을 과거 원점으로 덮지 않는다. 전역 빈 프로젝트와 검색으로 빈 WBS가 된 프로젝트, Milestone-only를 구별한다. resize로 capacity가 감소한 경우 명시적인 clamp/unavailable 결과와 사유를 반환하며, 이전 X/Y 보존으로 허위 보고하지 않는다.

### GSC-06 — 의미 세대와 관측 시도의 분리

server revision, Core dirty/recovery generation, query/scope, layout/axis, user intent와 observation ID를 동일한 취소 키로 취급하지 않는다. 의미가 같고 실제 Core/geometry/유효 receipt가 일치하는 재관측은 진행 중 복원을 불필요하게 무효화하지 않는다. 실제 Core drift·API 교체·query/layout/axis·사용자 입력 변경은 기존 권한을 무효화한다.

receipt는 source API·revision·목표 의미·Core 정합성·관측 상태를 포함한다. data/row 정합 receipt에 X/Y 복원 완료까지 요구하여, 그 receipt를 기다리는 viewport 작업과 교착시키지 않는다. 필요한 receipt가 생성될 queue 내부에서 viewport 완료를 기다리지 않는다. 완료 receipt 재사용에는 실제 Core 증거가 필요하며 유효 receipt라는 자기신고만으로 승인하지 않는다.

### GSC-07 — 최신 사용자 의도 우선

권한은 최신 실제 입력/명시 reveal, query/scope 전환, 유효 peer return, passive preservation의 기존 우선순위를 따른다. 낮은 우선순위 작업이 늦게 도착했다는 이유로 높은 우선순위 작업을 취소하지 않는다. 등록 당시 lease를 유지하고 await 이후 새로운 lease를 발급해 오래된 작업을 되살리지 않는다.

FILTER_RETURN은 1회 수평 bookmark이며 현재 세로 clamp를 보존하고 장기 복원 guard를 얻지 않는다. 사용자 wheel/pointer/key/touch, 새 query/scope, API 교체, unmount 및 hidden 상태의 의미에 맞춰 이전 복원·focus 요청을 취소한다. modal의 입력과 실제 Chart 입력을 구별한다.

### GSC-08 — 완료는 관측 결과로 판정

API 반환/Promise resolve, React commit, Core 적용, DOM 표시, viewport/focus 완료를 구별한다. typed outcome은 기존 SETTLED/SUPERSEDED/NOT_MEASURABLE/NO_SCROLL_CAPACITY/TIMED_OUT/FAILED 계약을 보존한다. 숨김·zero-size·사용자 취소·범위 부족을 PASS로 치환하지 않는다. 관측은 유한 예산, cleanup, 현재 source 재확인으로 구현한다. 무한 RAF/polling과 고정 sleep으로 성공을 만들지 않는다.

### GSC-09 — 인스턴스·표시·접근성 보존

정상 저장·실패 복구·query·Calendar·peer 복귀를 Gantt 강제 remount로 해결하지 않는다. 프로젝트 변경이나 명시적 fatal recovery가 필요하면 별도 승인된 사용자 동작으로 정의한다. 행이 DOM에 없다는 이유만으로 삭제/type 변경을 추론하지 않는다. canonical ID로 판정하고 virtualized DOM subset은 실제 가시 범위만 검증한다. 선택·clipboard·Milestone 선택은 별도 의미를 유지한다. focus는 connected/visible/hittable target과 새 사용자 입력을 확인하며 넓이 부족의 fallback은 명시적이어야 한다.

### GSC-10 — 설치 버전과 공개 API 근거

공식 문서·공식 sample, 설치 타입, 실제 runtime 실험을 분리한다. 기준 main `89f4ab7936fe74062f0398601d4a6596e3e51924`는 `@svar-ui/react-gantt` 2.7.3이다. 구현 시작 시 package/lockfile과 실제 설치 tree를 다시 확인한다. public serialize/tasks/tree/links, action 지원은 해당 버전으로 검증한다. private Store 쓰기·PRO 코드 복제·숫자 보정으로 오차 숨김은 금지한다. 허용된 read-only native geometry 진단도 보안 allowlist와 버전/테스트 경계를 가진다.

### GSC-11 — 누적 회귀와 증거

직전 실패만 검사하지 않고 [Conformance](GANTT_STATE_CONFORMANCE.md)의 누적 상태 전환 묶음을 적용한다. Product logic / adapter / geometry / test oracle / fixture / infrastructure를 구분한다. canonical ID·무mutation·readonly·실패 원자성·정확 좌표 등의 기존 불변식을 skip/허용오차/timeout 확대만으로 약화하지 않는다. 정당한 UI 계약 전환은 기존 보호 의미를 새 경로에서 검증하고 변경 사유를 남긴다.

동일 run/attempt/Head/base/test-merge/설치 버전/명령/fixture와 원본 실패를 연결한다. 순수 함수 반례, mock Core, 실제 SVAR browser, 실제 HTTP/SQLite, 전체 PR/Main CI의 증거를 서로 대체하지 않는다. 취소된 shard·미실행 후단은 NOT TESTED이며 PASS로 합산하지 않는다. CI 설정은 현행 정책을 따르고 이 표준을 이유로 별도 승인 없이 바꾸지 않는다.

### GSC-12 — 에이전트 준수·예외·유지보수

작업 시작과 REWORK 시 Work Packet에 `gantt_standard_version`, 읽은 문서 commit, 적용 GSC ID, 상태/쓰기 소유권 영향, 누적 시나리오, exception ADR, 결과/미검증을 기록한다. 에이전트가 지침을 읽었다는 자기신고만으로 준수를 승인하지 않는다. Reviewer는 실제 diff·테스트·증거를 확인한다.

예외에는 규칙 ID, 목적, 버전/범위, 위험, 대안, 검증·롤백·만료/재평가 조건, 승인 주체를 ADR로 남긴다. 구현에 맞춰 규범을 조용히 약화하지 않는다. 표준 변경은 REVIEW_PENDING → ACCEPTED → SUPERSEDED와 대체 문서/버전을 관리한다. CI가 문서 참조·불변식을 자동 강제하는 기능은 U1/U5/#574에서 실제 구현·검증되기 전까지 NOT IMPLEMENTED다.

## 4. 책임과 완료 조건

| 계층 | 소유 | 금지 |
| --- | --- | --- |
| 서버 / mutation gateway | 확정 데이터·권한·revision·명령 결과 | UI 상태로 권한 결정, 불명확 요청 자동 재시도 |
| Reconciler | 실제 Core 비교·정규화·차이 적용·복구 결과 | 임의 X/Y 복원, 서버 보정 mutation |
| Projection observation | 의미·Core·논리 행·가시 DOM 정합 관측 | 직접 Core/DOM 쓰기, viewport 완료 대기 교착 |
| Viewport Coordinator / port | 의도 우선순위·축 transaction·X/Y settle | 신규 데이터 권위, 오래된 lease 재승인 |
| Milestone/Workspace UI | 명시 의도 전달·가시 정보·focus handoff | 독립 scroll controller, 숨은 native 행 생성 |
| 검증 담당 | 규칙↔실패↔source↔테스트 증거 확인 | 구현자 자기 PASS를 독립 QA로 표시 |

## 5. 근거와 기술 검토 출발점

- [Issue #552 요구사항](https://github.com/planner77/masterGantt/issues/552), [기존 Sync Epic #567](https://github.com/planner77/masterGantt/issues/567).
- [CI #2679.1](https://github.com/planner77/masterGantt/actions/runs/38388682185): 원본 empty axis/Calendar 실패. [CI #2682.1](https://github.com/planner77/masterGantt/actions/runs/38393906015): rollback/empty-filter 회귀. 세부 사실과 가설은 각 immutable 소스와 원본 artifact로 재검증한다.
- [serialize](https://docs.svar.dev/react/gantt/api/methods/serialize/), [resize-chart](https://docs.svar.dev/react/gantt/api/actions/resize-chart/), [scroll-chart](https://docs.svar.dev/react/gantt/api/actions/scroll-chart/), [exec](https://docs.svar.dev/react/gantt/api/methods/exec/), [filter-tasks](https://docs.svar.dev/react/gantt/api/actions/filter-tasks/).
- [Willow 및 공식 samples](https://docs.svar.dev/react/gantt/samples/#/base/willow). 2026-10-13 문서/URL 확인은 실제 demo 조작 PASS가 아니다. 설치 2.7.3 PoC와 최신 사이트 내용을 혼동하지 않는다.

## 6. 변경 원장

- 2026-10-13 / #661: GSC-01~12 후보 규범 작성. 기존 #570/#571 구성요소를 폐기하지 않고 actual-Core no-op, indirect viewport write, semantic observation 경계를 보강하는 계획. 제품 구현·검증·main 적용은 별도 gate.
