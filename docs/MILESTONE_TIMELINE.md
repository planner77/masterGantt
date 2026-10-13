## Issue #647 — 삭제 후 관리 진입점 focus 보존 (2026-10-13)

- Milestone 독립 목록에서 native WorkspaceDialog가 닫히기 전 예약된 RAF는 `:modal` trap에 의해 거부될 수 있다. 삭제한 원 관리 버튼이 DOM에서 소멸하면 같은 활성 프로젝트 Dashboard의 검색·추가·heading 중 실제 연결/표시 상태인 후보에 focus를 인계하되, 현재 활성 프로젝트/패널에 한정하고 또 다른 modal이 열려 있으면 기다린다. 한정된 RAF만 허용, 다른 날짜 좌표·SVAR viewport·WBS membership·Task source는 변화시키지 않는다.
- 원본 #616의 복구 CI #2621 샤드3 포커스 FAIL과 샤드5 이전 KPI 선택자 FAIL은 별개다. #639가 modern main의 KPI 선택자를 수정했지만 과거 immutable SHA에 새 테스트를 소급 반영한 것으로 간주하지 않는다. 새로운 변경 PR CI는 현재 main의 회귀 검증이며 원본 복구의 신뢰된 exact SHA 테스트를 대체하지 않는다.
- #647 PR CI #2626 shard-3 failure exposed the distinction between *DOM active element* and *visible, hittable focus target*: `focus({preventScroll:true})` left the Milestone toolbar at y≈−363.5px, with centerHit=false. The post-modal restore now uses native `focus()` for visible viewport placement, retaining bounded `:modal` cleanup, same-project panel guard and unchanged SVAR chart scroll. The E2E validates actual focus ring/viewport/hit-test as well as membership stability.

# Milestone Timeline

## Issue #551 — 대형 fixture용 개발 진단 hook 준비 수명 (2026-10-13)

SVAR 2.7.3 Core 인스턴스가 초기화된 뒤 1000 Task + 2000 Milestone projection을 처리하는 동안에도 개발 `__masterganttMilestoneTimeline` API는 같은 frame·API 인스턴스에 즉시 등록되어야 한다. `init(api)` 시점의 synchronous setup과 layout effect의 bounded reconciliation/cleanup을 사용하고, 실제 차트 geometry 측정/scroll projection이 끝났다고 잘못 선언하지 않는다. 각 진단 명령의 기존 제한·제품 기본 OFF·Milestone 좌표와 native bar ±1px·canonical 원본 무변경 원칙은 유지한다. 원본 #2605.1 readiness 5초 실패는 독립 증거로 보존한다.


## Issue #551 — 개발 calendar reveal의 viewport 소유권 (2026-10-13)

PR CI #2595.1의 5폭 `anchor=null`은 state-only 가시성 판단과 실제 native 날짜축 위치의 차이였다. 이후 #2600.1에서는 lane19개는 PASS였지만 공유 #549 Core7개가 FAIL했다. 앞선 보완에서 calendar `reveal`을 native `scroll-chart({date})`와 같은 경로로 바꾸어 이미 확인한 native date 오차를 교정 reveal에 재도입했다. 두 실패와 기존 검증 누락을 구별하여 보존한다.

개발 `reveal`은 canonical queue 이후 같은 API·현재 표시 문맥·지원 날짜 범위를 확인하고, 단일 adapter의 calendar `contentX`와 실제 native `.wx-scale` 원점으로 가시성을 판단한다. 이미 실제 보이는 날짜는 이동하지 않으며 화면 밖 날짜는 기존 `DIAGNOSTIC_SCROLL(left)` coordinator 경로를 사용한다. 기존 진단 scroll의 유한 frame·현재 의도/가시성/capacity 검사와 최대3회 native repair로 Core/native 정착을 확인한다. production DATE_REVEAL·새 scrollbar·독립 writer·private store write를 추가하지 않는다. 진단 보정 예산은 기존 peer/restore 예산과 분리하고 production에서 거부한다. 진단 중 revision/projection generation 변경은 취소한다. in-view 판단은 실제 native Chart 논리 plot 기준이며 좁은 화면의 외부 wrapper clip과 구별한다. 오른쪽 끝 날짜의 scroll target은 실제 최대 offset을 넘지 않으며 canonical contentX/날짜 anchor는 바꾸지 않는다. `nativeDateReveal`은 원형 native 오차 비교용으로 유지한다.

공유 probe `reveal`의 성공 영수증은 `SETTLED`다. 축 밖/지원 불가/숨은 문맥은 성공으로 취급하지 않는다. 기존 #367 날짜축 확장이 진단 요청을 취소한 `SUPERSEDED`도 성공 영수증이 아니다. Core geometry 기술 시험은 이 상태를 진단에 보존하고 원형의 실제 날짜 가시성·좌표±1px·행/no-loss를 독립 검사한다. 해당 시험에 새로 추가했다가 제거한 무조건 SETTLED 기대와 중간 실패는 Work Packet에 기록한다. 테스트는 #549의 exact calendar left±1px·in-view 반복 무이동·custom filter/0행 축 보존과 #551의 실제 날짜축/Task bar/tick±1px를 함께 검사한다. production 기본 OFF와 #552 활성화 경계는 유지한다.

## Issue #551 — native 날짜축을 기준으로 한 물리 X 정합성 (2026-10-12)

#551 opt-in lane은 설치 SVAR의 canonical date-only → `contentX`를 보존한다. 실제 화면의 좌표는 Core 상태 `scrollLeft` 단독이 아닌 동일 Chart 내부 `.wx-scale`의 렌더링된 원점(`axisOrigin`)에 `contentX`를 더한 값으로 측정한다. 이 원점은 read-only DOM bbox 측정이며 공개 Core geometry API를 새로 가정하거나 private store를 수정하지 않는다. native Chart scroll·기존 Core action·resize/peer 전환 시 제한된 observer/RAF로 갱신하고 unmount시 해제한다.

CI #2594.1의 기존 lane/native bar ±1px FAIL(5폭 3018~3036px)을 결함 증거로 보존하며, 수용 검증에는 별도 native scale 원점 + date `contentX` ↔ lane tick ±1px 및 같은 날짜 Task bar ↔ lane tick ±1px를 모두 요구한다. 개발 1000 Task+2000 Milestone 초기 진단 hook은 layout commit 시 등록하지만 대량 성능 PASS는 새 Chromium 실행 전 NOT TESTED다. 64px opt-in, production 기본 OFF, canonical 원본·Task selection·clip의 기존 계약은 그대로다.

## Issue #571 — 표시 소비자와 viewport 의도

Coordinator는 현재 일정의 peer 복귀·metadata 보존·명시 Task reveal을 중재한다. Milestone 전체 날짜 모집단·canonical Task/Link·Gate·Export를 viewport clip이나 native 행 목록으로 축소하지 않는다. #549 개발 probe와 현재 native Milestone 행/빠른 보기를 유지하며 #550~553 제품 lane/표시 전환은 별도 선행 gate다.

#569 실험 adapter와 신규 날짜 좌표 지원은 DEFER다. 이번 구현의 기존 Core Grid/Task reveal 및 Day/Week range 회귀 결과는 #551 lane tick≤1px·Week header 의미의 PASS 근거가 아니다. Coordinator 소비자는 projection 성공 이후 실제 visible geometry와 viewport settle을 따로 확인하며 hidden/inert/zero-size나 stale API/context에서는 날짜 이동을 실행하지 않는다. [검증 범위](exec-plans/active/ISSUE_571.md)를 따른다.

현재 native Grid reveal은 유지한다. 미통합 lane의 신규 DATE_REVEAL 요청은 UNSUPPORTED이며 typed intent의 존재만으로 날짜 이동 지원을 주장하지 않는다.

## Issue #570 — 표시 projection의 완료 계약

#570은 현재 canonical 전체 입력과 native 표시 membership·접힘·가상화의 의미를 분리한다. Milestone을 WBS에서 제거하는 #552 전환은 활성화하지 않으며 현재 M-only/빠른 보기와 #549 개발 probe의 의미를 보존한다. Milestone·숨은 Link·Summary roll-up·Gate 원본은 서버 snapshot이며 native 표시 집합으로 저장·Export 대상을 줄이지 않는다.

metadata-only 변경은 같은 membership의 native filter/columns 재실행 사유가 아니다. 구조/scope/filter와 Core scale 설정 전환은 실제 행 정합성을 다시 확인해야 한다. 완료 receipt는 현재 revision·instance·generation의 Core 논리 행과 실제 DOM subset을 확인한 뒤 제공하며 #571 Coordinator의 후속 입력으로 사용한다. receipt 자체는 날짜 reveal/scroll writer가 아니다. #569 PoC 제품 도입 DEFER와 날짜 geometry 미검증 gate도 유지한다.

## 적용 범위와 현재 상태

#549~#551의 아래 current/target 표와 초기 실행 기록은 각 Issue 당시 baseline이다. #552 후보에서 적용되는 행/토글/호환 전환은 [새 표시 분리 계약](#issue-552--wbs와-milestone-표시-분리)을 따른다. 원격 등록과 main 적용 여부는 별도 lifecycle 증거로 판정한다.

Issue #549는 Epic #548의 MT1 공통 모델과 설치 SVAR Core 연동 기술 기반이다. 현재 운영의 Milestone Grid/Chart 행, 전체/Task/Milestone 빠른 보기와 고급 유형 필터를 유지한다. #550의 관리 진입은 기존 Dashboard에서 구현한다. #551은 기본 OFF인 opt-in lane capability와 개발 전용 기술 미리보기다. 운영 기본 표시 전환과 호환 UI는 #552, 통합 검증은 #553의 선행 gate 이후 범위다. 이 문서의 target은 현재 화면 기능 완료를 뜻하지 않는다.

baseline은 `dca2f7821f277ef31ee3dbcbdc1e51ad257209f0`, 설치 `@svar-ui/react-gantt` 2.7.3, 그 종속 `@svar-ui/gantt-store` 2.7.2, Next.js 16.3.8이다. 공식 문서 확인일은 2026-10-08이다. 원격 quality/e2e/docker와 독립 최종 QA는 실제 exact-head 증거를 확보하기 전 NOT TESTED다.

## current → target → compatibility

| 항목 | current | target | compatibility / MT1 경계 |
| --- | --- | --- | --- |
| WBS | Summary/Task/Milestone 행 | Summary/Task와 필요한 Summary context | #549에서 현재 행을 제거하지 않음 |
| 날짜 표시 | native Milestone 행 | 프로젝트 전체 Milestone의 날짜순 별도 lane | WBS 조건이나 viewport clip이 전체 모집단을 변경하지 않음 |
| 빠른 보기/types | `TaskFilterState.types`와 `getTaskQuickView`, 고급 조합 | 작업 유형 조건과 Milestone 표시 설정 분리 | 현재 빠른 보기 유지, 전환 UI는 MT4 |
| 필터 보존 | React 메모리와 `scopeTaskFiltersReference`의 scope별 Map | 기존 scope별 다른 조건 유지 | types URL/localStorage 이식은 존재하지 않으므로 만들지 않음 |
| 표시 환경설정 | 별도 Milestone 표시 설정 없음 | 프로젝트별 동일 브라우저, 기본 ON | 기존 Task-only는 새 OFF로 자동 변환하지 않음 |
| mixed types | Milestone와 다른 유형을 함께 지정 가능 | types에서 Milestone만 제외, 다른 유형과 모든 다른 조건 보존 | 순수 변환 함수만 제공; 현재 필터에 적용하지 않음 |
| Milestone-only | native 행 필터 | 원래 types 조건 보존, 호환 안내 | 빈 WBS/전체 Task로 조용히 치환하지 않음. Dashboard 열기/유형 조건 해제는 명시 사용자 명령 |
| scope | #399 단일 Summary root, `rootTask` URL | 원래 범위 유지 | #497 복합 scope/Milestone root는 현재 지원으로 표기하지 않음 |
| Milestone 소속 | 일반 작업 필터 | 표시 ON/OFF와 독립 | OFF도 소속 조건 동작, 전체 Milestone 모집단은 유지 |
| 날짜 조회 | native 행 이동 | 숨은 native 행 선택 없이 날짜 reveal | OFF는 일시 ON, 복귀 시 저장 OFF 복원. 명시 toggle은 일시 override 해제 |
| 선택 | native 작업/다중 선택 | 별도 active Milestone 조회 identity | 가시 일반 Task와 전체 E(M)의 교집합만 강조 |
| Export | canonical JSON/Excel/SVG/PNG | 같은 canonical 기반 | Timeline clip이나 표시 필터를 export 원본으로 사용하지 않음. 이미지 고정 열/clip은 기존 계약 |

## 순수 모델과 전체 데이터 보존

`src/features/milestones/milestone-timeline-model.ts`의 `buildMilestoneTimelineModel`은 canonical `tasks/links` 원본 참조를 보존한다. ID, parentExternalId, siblingOrder, 일정, Link, Membership이나 기존 Task DTO의 stageGate를 다시 저장하거나 재작성하지 않는다. WBS는 원본 순서의 Task/Summary만 반환한다. `matchedTaskIds`와 `ancestorContextTaskIds`를 분리하며 scope 교집합의 실제 일반 작업 `matchCount`, 직접 매칭 Summary 수와 context Summary 수를 따로 제공한다. scope 밖 조상은 전체 계산에 참여하지만 scope 행에 자동 노출하지 않는다.

Timeline은 전체 프로젝트의 Milestone이다. canonical 확정 `start` 오름차순, 기존 `stageFilterCandidates`의 externalId/taskId 안정 보조 키를 사용한다. 날짜 유효 범위는 기존 순수 domain의 1900-01-01..2199-12-31이다. null/없는 일정은 `missing`, 유효하지 않은 일정은 `invalid`로 `undatedMilestones`에 분리하며 오늘 날짜로 채우지 않는다. 동일 날짜/동일 이름은 identity를 합치지 않는다.

Membership/Gate는 기존 전체 `projectStageGates(stageSnapshotFromProject(tasks,links))`를 재사용한다. production canonical DTO의 서버 projection이 권한·mutation 결과의 기준이다. 이 모델의 전체 입력 재projection은 새 Ready/공수 엔진이 아니다. 전체 E(M)/P(M), 직접 predecessor, 수동 이벤트의 ready=null, 완료 기록 불일치를 유지한다. 날짜순 정렬이 Dependency를 만들거나 member Task 사이 Dependency를 Milestone Gate로 승격하지 않는다.

`canonicalSubtreeImpact`는 전체 canonical Summary subtree(또는 Task/Milestone root)의 합집합, 숨은 Milestone ID와 없는 요청 ID를 설명한다. 기존 서버 Copy의 Membership 제외 정책, incident/external Link guard, 완료 단계 잠금, Assignment 제약과 revision/auth 검증을 대체하지 않는다. Summary의 min/max 일정에는 숨은 Milestone도 기여하며 일반 Task가 없는 경우의 기존 Milestone progress 평균과 같은 날짜 span 1도 유지한다. 표시 집합만으로 Copy/Delete/Move 대상을 줄이지 않는다. 파괴적 명령의 확인 UI는 기존 대상/완료 잠금과 숨은 대상 설명을 유지해야 한다.

## 표시 환경설정과 상태별 결과

순수 schema는 `{version:1,showMilestones:boolean}`다. `normalizeMilestoneTimelinePreference`는 잘못된 값·unknown version·누락이면 기본 ON이다. JSON 문자열 parse, 프로젝트 publicId별 key 및 browser storage read/write는 후속 UI adapter 소유이며 MT1에는 storage 연결이 없다. 후속 권고 key는 `mastergantt:milestone-timeline:<publicId>`이며 저장 값은 이 schema만 사용한다. storage 접근/parse 실패는 ON fallback, 기존 types를 읽어 OFF를 추론하지 않는다. 필터 초기화/scope 변경은 별도 설정을 바꾸지 않는다. 사용자 explicit toggle 때만 저장한다.

| 상태 | 결과 |
| --- | --- |
| 전체 Milestone 0개 | Timeline 데이터 없음과 날짜축/작업 영역을 구별 |
| Milestone 존재, viewport 안 0개 | 전체 모집단 유지, 현재 viewport에 없음으로 표시 |
| 일반 Task 0개, Milestone만 존재 | WBS emptiness와 날짜 축/관리 진입을 구별 |
| 날짜 null/invalid | 미확정 목록, 날짜 좌표/reveal 없음 |
| 소속 0개 수동 이벤트 | ready/가중 진척 null; 작업 없음으로 Ready를 꾸미지 않음 |
| 완료 기록 불일치 | canonical 완료 보존, 기존 진단 표시; 자동 재개/수정 없음 |
| 표시 OFF + 날짜 보기 | 저장 OFF를 유지한 일시 표시; 복귀 OFF |
| 일시 표시 중 명시 toggle | 일시 override를 지우고 새 사용자 설정만 저장 |
| 조회 Milestone 없음/stale | 별도 조회 선택 null, native selection 변조 없음 |
| scope/filter 밖 member | 전체 Gate 계산에는 포함, 가시 교집합만 강조 |

#399 scope는 client navigation/command guard이며 서버 authorization이 아니다. server는 scope URL 대신 전체 Project canonical hierarchy와 session/Origin/If-Match 계약을 따른다. 일정·권한·완료 상태·Export 내용은 lane의 표시 환경설정에 의존하지 않는다.

## Core adapter와 기술 gate

## Issue #551 PR #560 CI #2217.1 실패 보완 (2026-10-09)

- 최초 head `fb6e5a634b3fcd70d62d4e8404a42cefe0ab6ce9`, [run 37821023371](https://github.com/planner77/masterGantt/actions/runs/37821023371). Next production build, TypeScript, ESLint, Vitest, policy 및 Docker PASS. Chromium 6개 중 shard 2에서 89 PASS/1 FAIL, 나머지 shard PASS. 따라서 E2E 전체 FAIL.
- 실패는 `tests/e2e/milestone-timeline-lane.spec.ts:126`의 1000 Task/2000 Milestone, peer tab 복귀 후 Grid splitter 변경 시 lane plot이 5초간 존재하지 않는 현상이다. CI trace에서 Core `_chartWidth=842px`와 실제 DOM `.wx-chart=825px` 차이 17px, `gridWidth=560px`, `hidden=false`, laneMeasurement.count=14, queueVersion=2를 확인했다.
- Core scrollbar gutter/렌더링 폭 차이 상황에서 DOM 너비와 내부 state 너비가 1px 이내여야 한다는 조건 때문에 lane을 표시하지 못했다. 실제 DOM plot의 x/width/clip을 기준으로 lane 위치를 결정하고 날짜/scrollLeft/unit/cellWidth는 기존 Core state 기반으로 유지한다. zero-size/hidden/inert/unsupported scale은 fail closed하며 timeout·retry·skip은 완화하지 않는다.
- 미해결 PR 리뷰 P2 두 건에 따라 혼합 날짜 cluster item focus/Editor 진입에서 해당 ID의 선택 및 guide 동기화, scroll로 focused marker가 사라질 때 surviving marker 또는 전체 목록 focus 복원을 추가했다. 다른 dialog/tab 사용자가 이미 focus를 옮긴 경우에는 빼앗지 않는다.
- 새 E2E는 기존 대형 fixture의 실제 plot 원점·폭, Grid/Chart/fullscreen/scroll 불변 assertion을 유지하고 혼합 날짜 guide 및 가로 clip 키보드 복원 회귀를 추가한다. 새 head의 정식 quality/E2E/docker, QA_FINAL/Manager ACCEPT는 실제 새 CI 결과 확인 전 NOT TESTED.
- `DESIGN.md`/`AGENTS.md`는 시각 원칙·작업 지침·검증 계약 불변으로 N/A. API/DB/Security/Scheduling/ImportExport/배포/워크플로/패키지 버전 역시 불변이며 제품/테스트/관련 문서만 수정한다. release_required=true, release_authorized=false. 병합/Main CI/GHCR/Issue 종료는 요청 범위 밖이다.


공식 [base Willow demo](https://docs.svar.dev/react/gantt/samples/#/base/willow), [filter-tasks](https://docs.svar.dev/react/gantt/api/actions/filter-tasks/), [scroll-chart](https://docs.svar.dev/react/gantt/api/actions/scroll-chart/), [getState](https://docs.svar.dev/react/gantt/api/methods/getstate/)를 참고했다. [markers](https://docs.svar.dev/react/gantt/api/properties/markers/)는 PRO다. 정적 URL 조회와 실제 JavaScript 공식 demo 조작은 구분하며 공식 demo 조작은 NOT TESTED다. 이 기능은 PRO marker나 비공개 store mutation, source 복제, 독립 Gantt/remount를 사용하지 않는다.

단일 `src/features/gantt/milestone-timeline-adapter.ts`의 exports는 다음과 같다.

- `filterMilestoneWbsRows(api,visibleTaskIds|null)`: 공개 filter-tasks/open:false. caller는 필요한 Summary context와 canonical 원본을 별도로 유지한다.
- `milestoneDateCoordinate(api,dateOnly)`: 기존 local date adapter와 설치 gantt-store package-root 공개 getDiffer를 사용한다. typed getState의 `_scales.start/end/minUnit/lengthUnit`, `_weekStart`, `_chartWidth`는 읽기만 한다. Day/Week step 1, lengthUnit day에서만 반환한다.
- `revealMilestoneDate(api,dateOnly)`: 이미 가시면 viewport를 움직이지 않는다. 유효 축 안의 날짜만 공개 scroll-chart/left로 이동하며 native hidden row selection과 연결하지 않는다. 축 밖은 false로 반환하므로 caller의 기존 범위 확장이 선행한다.

주의: react-gantt 2.7.3의 타입은 getDiffer를 재export하지만 runtime은 재export하지 않는다. 이미 lockfile에 있는 gantt-store 2.7.2의 root export를 사용하며 새 패키지/버전을 추가하지 않는다. 이 package는 내부 state management 설명을 가진다. 공개 타입의 derived field와 exported helper 조합은 **문서화된 안정 widget geometry API가 아니다**. 해당 결합을 이 버전 제한 adapter에 격리하고 실제 DOM 기준점과 ±1px로 검증한다. 알 수 없는 scale/step, 날짜 오류, zero-size/유효하지 않은 geometry는 null/false이며 lane 활성화를 허용하지 않는다. 새 수식으로 ms/day 또는 week=7 pixel 산술을 복제하지 않는다.

공개 `scroll-chart({date})`는 설치 Core에서 hour 차이와 `_start`를 사용한다는 정적 source 관찰이 있다. 실제 America/New_York fixture의 Day/Week 결과는 calendar-day bar와 달랐다. hour 차이 및 원래 `_start`와 normalized `_scales.start` 차이가 원인 후보이며, 전체 차이를 DST 하나로 확정하지 않는다. 단일 adapter는 실제 Task geometry와 같은 calendar-day helper의 contentX를 공개 left 명령으로 전달한다. 이 순수 adapter 자체는 DOM을 쓰지 않는다. 통합 개발 probe의 물리 위치 정착은 위의 기존 coordinator/port만 소유한다.

MT1 probe는 기존 ProjectGantt의 개발 모드에서만 존재한다. frame namespace `__masterganttMilestoneTimeline`의 작은 diagnostic은 최대 500개 ID/좌표/Link endpoint와 64개 공개 이벤트만 보관하고 Task 본문/secret을 포함하지 않는다. 소유 listener/property는 cleanup한다. 운영에서 행 숨김을 노출하지 않는다. 필터 projection은 Core scale/config 갱신 뒤 기존 canonical 동기화 queue와 순서가 맞아야 한다. 첫 실험은 filter 직후 7행, Day→Week 설정 변경 뒤 원래 10행으로 돌아왔다. 개발 probe는 명시 요청 ID를 보관하고 같은 API/source/filter key/현재 요청 generation/현재 scale/가시 nonzero viewport를 확인한 뒤 queue 이후 공개 filter를 재적용한다. source/scope 변경은 요청을 폐기하고 소유 cleanup이 오래된 요청을 무효화한다. 이는 native filter 자체의 scale 지속성이 아니라 앱이 제어하는 표시 projection 기술 대안이다. 후속 production은 실제 visibleTaskIds와 공통 queue를 연결해야 하며 개발 probe ref를 제품 기능으로 사용할 수 없다. 기술 gate가 통과하기 전 후속 행 제거를 활성화하지 않는다.

## CI #2348.1의 #530 복원 가드와 동적 날짜축 검증 경계

최신 main의 #530 peer restore는 동일 Gantt viewport가 복귀한 직후 stale programmatic `scroll-chart(left)`를 차단한다. 실제 Chart 내부 wheel/pointer/key/touch는 새 사용자 의도이므로 이 guard를 해제하지만, 개발용 `__masterganttMilestoneTimeline.scroll` 호출은 사용자 입력이 아니다. 이는 복원 가드의 정상 보호 계약이며 #549 기술 시험이 그대로 강제 programmatic scroll을 보내고 축 확장을 기대해서는 안 된다.

[PR CI #2348.1](https://github.com/planner77/masterGantt/actions/runs/38000871776)의 Chromium shard2에서 우측 programmatic scroll 뒤 scale width가 37404에서 변하지 않은 현상을 확인했다. guard 차단은 source상 가능한 직접 원인이지만 해당 실패 trace를 전부 재현했다고 보고하지 않는다. #549 E2E는 실제 Chart trusted wheel로 이전 복원 보호를 해제한 뒤 개발용 공개 right-edge scroll과 RAF 기반 확대를 검사한다. 기존 `width > oldWidth`, 동일 instance/행·Link/canonical/mutation0 검증은 유지하며, `expect.poll`은 여러 비동기 Core/React 프레임의 완료까지 유한 시간 안에 확인하는 용도다. 확대되지 않으면 FAIL이며 축 확장 정책(#367)과 #530 복원 가드는 변경하지 않는다.

## 검증 증거와 미검증

관련 Unit은 `tests/features/gantt/milestone-timeline-adapter.test.ts`, 모델 Unit은 `tests/domain/milestone-timeline-model.test.ts`다. 실제 synthetic ProjectGantt Chromium 실험은 `tests/e2e/milestone-timeline-core.spec.ts`이며 390/768/1024/1440/1920px, Day/Week, leap/month/year/DST, native Grid/Chart 행과 Task start geometry, canonical Link/no-loss/hidden endpoint, zero row/date axis, 같은 instance와 scroll/resize/fullscreen/peer return을 대상으로 한다.

최초 브라우저 실행은 FAIL(9개 중 1 PASS/8 FAIL)이었다. Day→Week 설정 변경 뒤 probe의 단발 filter가 초기화되어 7개 expected 행 대신 원래 10개가 복원되었다. Milestone-only/empty fixture는 일반 Task가 항상 있다는 Dashboard fixture 전제에서 실패했으며, fullscreen 종료 테스트는 실제 accessible name을 잘못 사용했다. 최초 원본 trace는 `/tmp/mastergantt-549-initial-fail`에 보존하고 Git에는 synthetic 요약과 선별 PNG/JSON만 넣는다. 최초 실행의 uncommitted probe source hash는 NOT CAPTURED이며 baseline SHA는 실행 probe의 exact source SHA를 뜻하지 않는다. 최종 실행만 아래 source SHA-256으로 대조한다.

Remote CI quality/e2e/docker, 독립 QA 최종 승인, 실제 운영 storage/reverse proxy, Windows Excel, 실기기/screen reader 및 후속 lane 전체 keyboard/focus/Escape UX는 NOT TESTED다. 로컬 technical gate는 후속 기능 전체 UX 승인이나 서버 persistence 검증을 대신하지 않는다.

## 문서 영향과 다음 단계

요구사항/Project UX/Stage Gates/공통 UI/UX/TEST_PLAN/DESIGN/PRO matrix와 단일 adapter architecture 설명을 동기화한다. API/DB/SECURITY/SCHEDULING/Import/Export 계약은 runtime mutation·schema·domain algorithm·auth/revision·export renderer 변경이 없어 N/A다. 모델은 기존 scheduling/calendar/Gate를 사용하고 filter/probe는 renderer 표시 명령뿐이다. 후속 #550~#553은 이 계약과 technical gate를 재사용하되 각 Issue의 exact-head CI/독립 검증을 별도로 받아야 한다.

### 최종 Local Fast Feedback

- adapter 신규 5개와 기존 date adapter/timeline range 11개: 16 PASS. 모델 신규 24개와 기존 관련 32개: 56 PASS. 서로 다른 파일의 합계 72 PASS이며 MT1 신규 모델/adapter만은 29개다.
- Chromium synthetic Core 실험 9개 자동 assertion PASS: 5폭 Grid/Chart Task/Summary 행 순서/높이와 native Task start 대비 adapter 좌표 ±1px, Day/Week와 leap/month/year/DST fixture 날짜, hidden M endpoint Link 비표시/Task→Task 유지/canonical Link equality, 같은 instance, Milestone-only/empty axis, native column/Grid resize/fullscreen/동적 축/peer return, mutation0.
- native date reveal의 실제 오차는 NY fixture의 Day -1px / Week -39px였다. 앱 adapter의 public left 경로는 두 scale 모두 계산 contentX와 0px 차이였으며 가시 날짜 재조회는 움직이지 않았다. 이 관찰은 모든 timezone/config의 일반 보장이 아니며, 날짜 헤더 전체 의미 일치의 PASS도 아니다.
- Milestone-only 필터 전후 start는 2026-03-10 유지, 오른쪽 end는 2026-10-24 → 2026-10-25로 관측 1일 증가했다. 원래 exact end assertion FAIL을 보존하고 기존 #367 monotonic extension과 날짜축 비축소 계약을 구분했다. 날짜 insideRange/reveal 후 visible, 양수 axis/viewport, canonical ID/Link/revision 불변과 mutation0도 함께 PASS다. 임의 확대 제어를 새로 구현한 것이 아니며 기존 날짜 범위 guard를 유지한다.
- typecheck, 변경 파일 ESLint(새 error 0, 기존 ProjectGantt warning 4), Markdown local link와 diff whitespace 검증 PASS. production build/전체 회귀/Docker는 로컬에서 실행하지 않았다.

선별 실제 화면/JSON과 실행 command/exit/source 지문은 [evidence 디렉터리](../output/playwright/issue-549/review)와 [최초 실패 요약](../output/playwright/issue-549/initial-failure.json)에 있다. runtime DB/log/trace/Next 산출물은 Git에 넣지 않는다. 화면은 기존 개발 ProjectGantt에 synthetic 표시 필터를 적용한 기술 실험이며 실제 새 lane 예산/높이/keyboard UX를 측정하거나 승인한 증거가 아니다.

### 독립 UI/UX 비교에서 확인한 Week 날짜 헤더 불일치

자동 실험 9개 PASS의 날짜 oracle은 canonical 날짜를 계산한 adapter x와 **native Task bar anchor**의 일치다. 위쪽 month/year 헤더와 아래 ISO week/date 구간까지 canonical 날짜의 의미가 일치하는지 검사하지 않았다. 이를 전체 날짜축 의미 PASS로 확대하지 않는다.

독립 UI/UX 비교에서 기존 선별 화면에 다음 불일치를 확인했다.

| 실제 캡처 | canonical/native Task 위치 | 화면의 날짜 헤더 | 판정 범위 |
| --- | --- | --- | --- |
| [geometry-1440.png](../output/playwright/issue-549/review/geometry-1440.png), Week | T-year의 시작 Jan 1, 2027, 좌측 native bar | 위쪽 July 2026, 아래 W53 → W01 | Week month/year와 Task 날짜 의미 불일치: FAIL(실제 캡처 관찰) |
| [DST-reveal.png](../output/playwright/issue-549/review/DST-reveal.png), Week | T-DST/M-DST의 시작 Mar 10, 2026, 좌측 native bar | 위쪽 November 2025, 아래 W10 | Week month/year와 Task 날짜 의미 불일치: FAIL(실제 캡처 관찰) |

Day 캡처의 헤더 일치는 UI/UX 비교에서 관찰했지만, 모든 Day/Week 헤더·timezone의 의미 oracle 자동화는 NOT TESTED다. Week 불일치의 원인과 변경 전 baseline 재현은 NOT TESTED다. 이것을 기존 baseline 결함이나 이번 adapter 결함 중 하나로 확정하지 않으며, native date scroll 오차/DST 하나로 원인을 단정하지 않는다. 제품 scale/date 알고리즘은 이번 문서 REWORK에서 수정하지 않았다.

**#551 lane 활성화 전 별도 date/header 의미 gate**: 같은 Gregorian canonical 날짜를 adapter/native anchor와 대응하는 가시 Day 셀 또는 ISO week의 실제 날짜 구간, month/year 헤더 경계와 함께 대조해야 한다. Day/Week, leap/month/year/DST, 가로 scroll/resize/scale 전환·동적 축 이후를 포함하고, Week의 월·연도와 주 구간이 서로 일치해야 한다. 동일 source의 실제 브라우저 증거와 필요한 E2E assertion, 원인 및 검증된 대안을 확보하기 전 gate는 FAIL/NOT TESTED 상태이며 #551 lane의 좌표 표시를 활성화하지 않는다. 기존 Task bar와 adapter x의 ±1px 일치만으로 이 gate를 통과할 수 없다. 현재 운영 Milestone 행/빠른 보기 유지, canonical/domain/API/auth/revision 불변 및 기존 9개 자동 assertion PASS는 이 제한과 구별한다.

## #569 공개 Core 좌표·기하 Adapter PoC와 병행 적용

#549는 공통 조회 모델과 개발용 기술 probe를 제공하며 운영 Milestone 행을 제거하지 않는다. 최신 main에 병합된 #569 PoC는 아래 버전 제한 및 좌표/스크롤 안전 경계를 추가한다. PoC의 `DEFER` 제품 도입 판정은 #549 synthetic PASS로 해제되지 않는다.

[Adapter ADR](GANTT_ADAPTER_ADR.md)에 따라 같은 Chart의 controlled origin/unit/cellWidth와 native scroll owner를 기준으로 날짜 좌표를 검증한다. Timeline에 독립 scroll authority를 만들지 않는다. 지원 범위는 균일한 단일 scale 행의 Day/Week이며 실제 tick 폭이 설정과 다른 짧은 축은 거부한다. 날짜 anchor와 native bar/tick ≤1 CSSpx 및 Grid가 보이는 경우의 행/bar y정렬을 실제 Chromium에서 확인한다.

hidden/inert/zero-size에서는 측정·복원하지 않는다. 390px의 native capacity 부족은 NO_SCROLL_CAPACITY로 분리하고 기존 목록/Editor 조회 경로를 유지한다. 잘못된 오늘 날짜 보정이나 자동 전체 범위 확대를 하지 않는다. PoC의 Chart 공간 확대 후 회복과 구체적인 제품 fallback UI는 별개이며 후자는 #551 통합 gate에서 확정한다.

Milestone-only/empty는 canonical의 서로 다른 상태이며 Task identity·Summary rollup·Membership/Dependency를 변경하지 않는다. #569 PoC의 M-only 모형은 #551의 전체 lane 사용성 PASS를 대신하지 않는다. 비교 #551 회귀는 PR #562의 고정 source로 별도 기록한다. 전체 폭의 반복 확장 지원은 확인되지 않았으므로 adapter의 제품 도입은 DEFER다.

## #549 병합 후 Main CI #2359.1 — wheel/scroll event 순서 불변식

#549 기술 probe의 right-edge 테스트는 사용자 휠→공개 `scroll-chart`의 **실제 처리 순서**를 검증해야 한다. 실패 [Main CI #2359.1](https://github.com/planner77/masterGantt/actions/runs/38006587229)의 [trace artifact](https://github.com/planner77/masterGantt/actions/runs/38006587229/artifacts/11651782948)는 Core/native left=26640 상태에서 프로그래밍 우측 이동 `scroll-chart(36960)`을 요청한 **이후** 앞서 발행된 사용자 wheel 이벤트 `scroll-chart(26671)`이 도착하는 역전이 발생했음을 기록한다. 최종 scroll이 오른쪽 extension 임계에 도달하지 않아 width=37404가 유지됐다.

`await page.mouse.wheel()` 반환이 native wheel 및 Core state 갱신 완료를 보장한다는 종전 테스트 가정을 철회한다. 새 E2E는 trusted wheel 후 Core left 증가와 native scrollLeft 동기(±1px)를 실제 조건으로 bounded poll하고 몇 RAF를 settle한 다음 **최신 관측값**으로 right-edge API를 호출한다. 그 다음 실제 축 너비의 증가, 같은 instance/행·Link/canonical/no-mutation을 계속 검증한다. 기존 #530 복원 가드와 #367 범위 확장 로직, #569 PoC DEFER 및 #551 Week header 의미 gate는 변경하지 않는다. 이 기록은 실패 원본 trace와 수정 의도를 구별하며 새 CI 실행 전 PASS라고 표시하지 않는다.


## Issue #550 — 기존 Dashboard의 독립 관리 진입

관리 목록은 기존 Milestone Dashboard의 보고 population·검색·날짜·상태·범위·KPI·freshness를 유지하는 평면 표시다. canonical Task.start의 유효 날짜, externalId, taskId 순으로 기존 stageFilterCandidates를 재사용한다. 미설정/무효 날짜는 마지막에 표시하며 부모·siblingOrder·Dependency를 저장하지 않는다. 같은 이름·날짜도 data-milestone-task-id와 canonical taskId로 구분한다. 전체 Milestone 0개와 검색/다른 조건의 결과 0개를 구별한다. Gantt WBS scope 밖 단계와 소속/관계 endpoint는 전체 canonical snapshot에서 resolve한다.

표의 기존 1052px 최소 예산과 조회 144px 열을 유지한다. 상세·소속·원인 조회를 보존하고 관리 버튼에 추가 명령을 모은다. 좁은 화면의 표 가로 스크롤과 480px 상한의 표 내부 세로 스크롤, toolbar reflow를 사용한다. 관리 대화상자는 기존 WorkspaceDialog의 native modal·Tab 보호·Escape와 semantic token을 재사용한다. 한 번에 관리 메뉴/생성 dialog/Editor 한 경로만 연다.

| 명령 | 진입과 권한 | 기존 계약/지원 경계 |
| --- | --- | --- |
| Milestone 추가 | 편집 모드의 Dashboard toolbar, 이름/요청 시작일 작은 form | POST tasks의 type=milestone/duration=0/progress=0/parentExternalId=null, parentTaskId 생략. 프로젝트 root append이며 선택 Summary/scope를 부모로 사용하지 않음 |
| 상세 / 소속 작업 | 이름·상세·소속 버튼 또는 관리 메뉴, readonly 조회 가능 | 같은 Task Editor의 task/memberships 탭. 기존 Description/URL/일정/명시 소속/상속/override 저장 단위 유지 |
| 관계 조회·관리 | 관리 메뉴에서 같은 Editor의 relations 탭 | 같은 Relation Editor; readonly 조회, mutation은 기존 dirty/pending/revision/completed/endpoint guard |
| 작업 ID 복사 | readonly에도 가능 | canonical task UUID, 기존 clipboard compatibility helper. Project/Task mutation 없음 |
| Milestone 복사 | 편집 모드에서 단일 source를 자신의 다음 sibling 위치에 복사 | 기존 previewMembershipCopy/task-commands와 acknowledgement, Assignment·완료 단계 fullE/explicit/incident 경계와 서버 guard. 완료 수동 이벤트도 기존 경계를 통과하면 허용; 일괄 완료 잠금으로 Copy를 축소하지 않음 |
| Milestone 삭제 | 편집 모드, 기존 삭제 계획과 명시 확인 | 완료 단계 구조 잠금/incident Link/Assignment/domain/revision 검증 유지. Summary subtree/다중 M 관리 명령을 새로 확대하지 않음 |
| 완료 / 재개 | 상세 Editor에서 상태 선택 후 명시 저장 | Ready를 자동 Completed로 처리하지 않음. 재개 성공 후 소속/관계 구조 변경을 별도로 저장 |
| 해당 날짜에서 보기 | 유효 canonical 예정일과 현재 원본 조회 문맥이 있을 때 | 현재 정상 native 일정 조회 경로; 새 lane 활성화나 숨은 native행 선택을 제공하지 않음 |
| 소속 작업 일정에서 보기 | 전체 E(M)의 정확한 memberTaskIds와 원본 조회 문맥이 있을 때 | Milestone 날짜 조회와 별도 명령. 0-member/날짜없음/문맥없음은 사유와 비활성 표시 |

추가 form의 입력 초안은 Escape/취소/닫기에서 폐기 확인을 거친다. 계속 입력 또는 Escape로 입력을 유지하며 명시 폐기만 닫는다. 저장 중에는 중복 제출과 닫기를 차단한다. 401/412/network 실패는 입력을 보존하고 자동 재전송하지 않는다. 열린 revision이 바뀌면 다시 제출하지 않고 취소 후 최신 canonical 검토를 안내한다.

생성 성공은 기존 saveTask 보호 gateway와 applySnapshot의 canonical revision 검증 이후에만 처리한다. 서버는 별도 createdTaskId 필드가 없으므로 이전 Task ID 집합과 응답 Task ID 집합의 유일한 새 Milestone, taskCreate operation 및 changed external ID를 대조한다. 이름·배열 마지막 행으로 추측하지 않는다. 현재 생성 요청/Project/canonical 응답이 같을 때 기존 Editor로 넘기고, ID가 유일하지 않으면 자동 Editor를 열지 않고 목록 확인을 안내한다.

닫기 focus는 원 Dashboard의 연결된 visible/non-inert 실제 trigger로 복귀한다. 관리 메뉴가 열린 상태에서 외부 canonical 삭제나 보고 population 변화로 대상이 사라지면 관리 ID를 현재 컴포넌트의 조건부 render-state 조정으로 자식 commit 전에 폐기한다. focus 복원만 취소 가능한 한정된 RAF에 맡긴다. 대상이 RAF 전에 복귀해도 폐기가 취소되지 않으며, 명시적인 같은/다른 ID의 새 열기 명령은 이전 focus frame을 취소한다. 같은 ID가 다시 등장해도 사용자 명령 없이 메뉴를 다시 열지 않는다. 삭제·갱신으로 trigger가 사라지면 보이는 검색→추가→heading으로 복귀한다. 복원은 현재 표시된 Dashboard의 Project identity를 확인하여 다른 Project나 숨은 panel에 오래된 focus를 적용하지 않는다. Dashboard 호출의 Task/Relation Editor가 숨은 Gantt에 focus를 넘기지 않는다. 단순 조회는 기존 Gantt 인스턴스와 필터·scope·Day/Week·열·scroll 보존 경로를 유지하며 mutation/revision 증가가 아니다.

#549의 Week 날짜 헤더 의미 FAIL와 원인/baseline NOT TESTED 및 #551 date/header oracle activation gate는 유지한다. #550은 새로운 lane, preference wiring, M행/빠른 보기 제거를 활성화하지 않는다. 현재 URL scope는 #399 단일 Summary이며 #497 복합/M root가 현재 기능이라고 표기하지 않는다.


### #550 로컬 검증과 문서 영향

신규 관리 helper Unit4와 관련 기존66 총70 PASS, actual Chromium synthetic UI19/19 PASS exit0(44.5s), backend의 development isolated HTTP/SQLite2/2 PASS exit0(전체43.3s, skipped/flaky0)다. 실제 생성/편집/소속·관계/전체 Gate/완료 경계/보호 거절/restart canonical equality와 빈/M-only/readonly를 synthetic UI와 구별한다. 상세 범위·최초 fixture FAIL·한계는 [TEST_PLAN](TEST_PLAN.md#issue-550--milestone-관리-진입-local-fast-feedback)을 따른다. 원격 quality/e2e/docker 및 production/proxy/실기기·스크린리더는 NOT TESTED다.

MILESTONE_TIMELINE/PROJECT_UX/TASK_EDITOR/TASK_RELATIONS/REQUIREMENTS/TEST_PLAN/MILESTONE_STAGE_GATES에 실제 UI/command/검증 영향을 반영한다. API/DB/SECURITY/SCHEDULING/Import/Export/CI/배포 계약은 새로운 endpoint/schema/auth/revision/algorithm/persistence/renderer/workflow가 없어 N/A다. DESIGN/AGENTS의 기존 Light/system-font/semantic-token/Core/PRO/역할 규칙을 재사용하므로 새 디자인·역할 규칙을 추가하지 않는다. 현재 native M행과 types/quickview는 보존되고 #551 날짜 헤더 gate를 통과한 것으로 표기하지 않는다.


표시된 Dashboard focus 복원은 native browser focus를 사용하여 검색/추가/heading 또는 실제 trigger가 viewport 안으로 드러나도록 한다. Gantt/Core 좌표나 DOM scroll을 강제 변경하지 않는다. 마지막 실제19case에서 fallback의 viewport/outline/center hit/불투명 sticky·fixed 가림 없음과 기존 Chart scroll을 확인했다. 실제HTTP/SQLite2PASS는 native focus, 관리 ID 폐기 및 삭제 취소 focus 보완 전 source의 증거이며 Manager의 서버 영향 N/A 재사용 결정과 이전Workspace SHA를 [TEST_PLAN](TEST_PLAN.md#issue-550--milestone-관리-진입-local-fast-feedback)에 기록한다.


기존 Gantt의 Cut/Copy clipboard/Paste, 위·아래 이동/들여쓰기·내어쓰기/유형 변경 등 hierarchy 명령은 현재 native 행·메뉴·keyboard 경로와 기존 capabilities를 유지한다. 이 관리 메뉴는 그 경로를 새로 복제하거나 다중 Milestone 명령을 확장하지 않는다. #552에서 행을 제거하기 전에는 전체 기존 명령 inventory의 대체 진입·명시 비지원/후속 경계를 별도로 검토해야 하며 #550만으로 해당 명령을 제거하지 않는다.

삭제 확인의 취소/Escape도 현재 Milestone Dashboard의 실제 trigger 또는 visible fallback으로 복귀한다. 확인 도중 외부 갱신으로 trigger가 사라져도 검색/추가/heading을 복원하며 취소는 삭제 요청을 보내지 않는다. 관리 ID의 조건부 자체 state 조정은 [React 공식 지침](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)을 따른다(확인 2026-10-09). DOM focus와 frame cleanup은 effect/event에 유지하고 다른 컴포넌트 state나 render 중 ref를 변경하지 않는다.


#550 PR 리뷰 보완: 412 POST 충돌 시 생성 초안을 stale로 전환해 동일 If-Match 재제출을 막고, 480px 높이 제한을 Milestone 관리 목록에만 적용하여 기존 공수 bucket 표에 전파하지 않는다.

### #550 PR CI #2368.1 — Milestone 이름·검색·상세 진입 정합 (2026-10-10)

최신 main 통합 시 관리 표의 사용자 표기 일부(`단계 상세`)와 결과 0건 텍스트의 조사(`Milestone가`), #550 테스트에 남은 `단계 검색`이 기존 Milestone UI 계약 및 #463/#518 E2E 선택자와 어긋났다. **표시 및 접근성 이름을 동일한 `Milestone` 계약으로 복구**하고 E2E가 올바른 이름을 검증한다. 빈 프로젝트와 조건 결과 0개를 계속 구분한다. #551/552 Timeline 활성화, domain/API/DB/상태 저장/Date·Week geometry 계약의 변경은 N/A다.

## Issue #551 — opt-in lane와 공개 Week 구간 표시

Baseline `31345da9346dfbdc1ac02e4e7ca567edafec775f`, Core 2.7.3/store 2.7.2에서 개발 서버 Chromium으로 검증한다. production capability는 `enabled` 기본 false, 전체 canonical `timelineModel`, 선택적인 `activeMilestoneTaskId`, `onOpenMilestone(taskId,actualTrigger)`, `onOpenDashboard()`다. Workspace는 전체 snapshot의 Task/Link로 모델을 memoize하며 WBS scope·Task 필터·scroll RAF마다 전체 E/P를 재계산하지 않는다. 개발 전용 미리보기/공개 displayMode setter는 사용자 제품 명령이나 운영 testhook이 아니다. 기존 M 행·빠른 보기·types와 저장 환경설정은 그대로이며 #552의 기본 활성화 gate와 구별한다.

### 변경 전 Week 불일치와 지원 대안

#549의 native month/year 의미 FAIL은 #551 시작 시 별도로 재현했다. 4개 날짜×Day/Week 중 Day는 canonical 날짜/월 의미가 일치했고, Week 상위 월 3개가 불일치했다(2026-01-31→October 2025, 2026-03-10→November 2025, 2027-01-01→July 2026). native Task start와 adapter x ±1px 일치만으로 이 FAIL을 해결하지 않는다. 실제 Week 진단은 `_weekStart=0`, 168개 하위 주 합계/축폭 11424px와 40개 상위 월 합계 13668px, 차이 2244px였다. Day의 1065개 일/36개 월 합계는 모두 38340px였다. 설치 source의 월별 부분 주 반올림과 실제 합계 차이는 원인 근거이며 최초 실행 source/hash·FAIL은 보존한다.

정책 대안은 scoped 공개 Locale `calendar.weekStart=1`과 Week 상위 행 `unit:week,step:1`이다. 문제가 있는 native month 셀을 고쳤다고 주장하지 않고 같은 실제 `[Monday,nextMonday)` 주 셀의 포함 Gregorian 월·연도 span으로 표현을 대체한다. 같은 월 `2027.01`, 두 월 `2027.01→02`, 두 해 `2026.12→2027.01`; ISO week-year를 Gregorian year와 구별한다. 68px 셀의 ellipsis는 허용하지만 accessible name과 기존 keyboard Week detail에 전체 구간·포함 월·ISO를 제공한다. Day month/day 표시와 Project Calendar/Task Editor 정책은 유지한다. 확인일 2026-10-09, [공개 scales](https://docs.svar.dev/react/gantt/api/properties/scales/)·[Locale](https://docs.svar.dev/react/gantt/guides/appearance/localization/)를 따른다.

실제 oracle는 canonical 날짜가 하위 ISO 주 구간 안에 있는지, 상위 Gregorian span과 동일 구간인지, native anchor/adapter가 ±1px인지 각각 확인한다. 월 1일의 adapter x는 주 셀 내부 위치로 비교하며 존재하지 않는 native month 셀 경계 PASS로 표기하지 않는다. 2199-12-31의 exclusive end 2200-01-06/ISO2200-W01은 표시 metadata다. Calendar 지원 범위를 2200으로 넓히지 않으며 해당 주 전체 근무일은 미산정 사유를 표시한다. 기존 tooltip helper의 상한 예외를 직접 Unit로 보존하고 새 UI fallback만 적용한다. 상한 browser fixture는 시험 시각 2199-12-01로 기존 오늘 포함 축을 작게 유지한다. 현재 시각 2026을 함께 둔 최초 fixture는 초기 probe 준비 timeout FAIL이었으며 tooltip 실행 FAIL이나 정확한 시간 초과 원인으로 과대 해석하지 않는다.

### 실제 row 순서와 조작 계약

같은 wrapper/ancestry/key 안에서 앱 소유 64px sibling lane(Grid 대응 공간+plot) → native Grid/date header → native Task rows 순서다. native 날짜 헤더 아래에 Core 내부 공간을 삽입하지 않는다. ON은 peer 탭 가시성/geometry 측정과 독립적으로 64px를 예약하고 OFF는 0px로 반환한다. 개발 기술실험의 Grid-only는 lane 0px, Chart-only는 collapsed Grid38px+resizer4px의 Core 고유42px rail을 제외한 실제 plot 전체를 따른다. fake Task/별도 Gantt/remount/scaleHeight 변경/PRO markers는 사용하지 않는다.

Marker는 높이 44px, 상하 10px이며 이름·상태를 최대 160px 두 줄에 표시한다. 이름은 ellipsis, 전체 이름/date/externalId/readonly·완료·Ready/Blocked/수동/완료 불일치는 accessible label과 같은 ID의 Editor/묶음 목록에서 확인한다. 개별 읽기 최소 96px, 묶음 최소 120px/최대 160px 설계 예산에서 현재 구현은 160px를 사용하고 그 폭을 확보하지 못하면 전체 목록으로 안내한다. 색만으로 상태를 구별하지 않는다. 묶음은 `N개 Milestone`과 동일일/근접 날짜 범위이며 첫 항목 상태를 묶음 전체 상태로 표시하지 않는다.

동일 날짜 및 최종 control bbox+양쪽 outline 3px/offset 3px(외곽 6px)+2px 여유가 겹치는 날짜를 묶는다. 160px control의 현재 분리 기준은 176px이다. plot 안 8px과 sticky 전체 목록·owner/window 물리 clip 뒤 control만 clamp하고 각 원래 날짜 tick/guide x는 이동하지 않는다. 390px의 기존 최소 720px 논리 작업면과 화면 밖 물리 clip은 별도다. 전체 목록은 Task 필터/범위와 독립인 프로젝트 전체 모집단을 명시한다. 프로젝트 0개, 미정/invalid, 날짜 viewport 0개, 물리 화면 밖, 조작 폭 부족, geometry 없음은 서로 다른 이유를 표시한다.

Lane은 날짜순 Left/Right/Home/End roving Tab 한 개, Enter/Space를 사용한다. native 묶음 dialog는 50개씩 표시하며 Up/Down/Home/End와 기존 Tab/Escape를 사용한다. 단일 marker/묶음 항목은 canonical taskId와 실제 trigger로 #550의 같은 Editor를 연다. 열린 묶음의 대상/날짜/문맥 소멸은 현재 컴포넌트 조건부 state 조정으로 폐기하며 focus RAF만 취소 가능하다. 같은 ID가 돌아와도 자동 재개하지 않는다. 새 modal이 열려 있으면 오래된 focus 예약이 탈취하지 않는다. Editor가 열린 상태의 OFF는 dirty/pending 초안을 폐기하지 않는다. 끊긴 lane trigger는 살아 있는 전체 목록 또는 보이는 일정 작업면으로 복귀하고 숨은 native M 행 선택을 사용하지 않는다.

Guide는 focus → hover → 별도 조회 선택 순으로 하나를 derive하며 pointer-events:none/aria-hidden이다. viewport 측정 이후에도 현재 canonical 날짜 좌표를 사용한다. native Task 다중 선택/clipboard·pointer/context menu·일정 편집 gateway와 분리한다. 선택적인 member 강조는 이번 구현에 없으며 fullE∩visible Task를 지원한 것으로 표기하지 않는다.

### 측정·검증 범위

단일 version-bound adapter가 공개 state/calendar helper와 read-only Chart bbox, app owner clientbox, window 교집합을 읽는다. typed derived state와 `.wx-chart` 구조는 문서화된 안정 geometry API가 아니다. 지원 Day/Week step1 이외/hidden/zero-size/폭 불일치는 fail-closed한다. 모델/API/문맥/scale/display가 일치한 측정만 표시하며 canonical queue 완료 뒤 현재 version으로 측정하며 대기 중 요청을 합친다. await 중 새 queue가 생긴 경우만 한정 재요청하고 idle polling은 없다. tagged public event·ResizeObserver·owner scroll listener와 RAF를 cleanup한다. 사용자 scroll을 복원하거나 DOM scroll을 강제하지 않는다.

로컬 증거와 최초 FAIL/제약은 [TEST_PLAN](TEST_PLAN.md#issue-551--opt-in-lane와-week-의미-local-fast-feedback)에 기록한다. production build/실제 운영·reverse proxy·실물 touch/screen reader·remote quality/e2e/docker는 이 개발 Chromium 증거로 대체하지 않는다.

#551 최신 로컬 검증은 동일 source Chromium17/17 PASS(46.4s), 직접 관련 Unit29 PASS, typecheck/변경 lint PASS다. [선별 실행 계약](../output/playwright/issue-551/review-selected/execution-contract.json)에 실행 시각·source SHA와 최초 FAIL/경고 범위를 구분한다. 로컬 결과는 독립 QA 및 원격 quality/e2e/docker를 대체하지 않는다.

## Issue #552 — WBS와 Milestone 표시 분리

#552 후보 구현은 #196의 세 유형 빠른 보기와 고급 Milestone 유형 선택을 단일 `◆ Milestone 표시` 명령으로 대체한다. WBS 행은 Summary/Task이며 소속 단계 필터와 조회 조건은 그대로 유지한다. 전체 canonical tasks/links를 Core와 도메인 명령에 전달하고 공개 `filter-tasks`로 표시 ID만 제어한다. 숨긴 Milestone은 Summary roll-up, 전체 E(M)/P(M), 기존 완료/관계 보호와 canonical export에 계속 참여한다. 표시 전환은 서버 권한이나 revision 변경 명령이 아니다.

프로젝트별 브라우저 설정은 `mastergantt:milestone-timeline:<publicId>`의 `{version:1,showMilestones:boolean}`이며 기본 ON이다. 누락/잘못된 schema는 기본 ON, 읽기/쓰기 오류는 현재 메모리 선택을 유지하며 프로젝트당 한 번 알린다. 명시 토글만 저장하며 필터 초기화, 범위/상위 탭 변경, 날짜 확인은 저장하지 않는다. 저장 설정과 임시 날짜 표시의 OR만 유효 표시를 결정한다. 기존 개발 preview는 추가 authority가 아니다.

기존 `types`는 React 메모리와 scope Map에만 존재한다. mixed 조건은 M만 제외하고 다른 조건을 보존한다. M-only는 원 조건을 그대로 유지하고 빈 WBS와 Dashboard 열기/유형만 해제의 명시 선택을 안내한다. URL 또는 저장소 types migration은 만들지 않으며 reload 후 메모리 조건은 사라진다. Summary root가 외부 canonical 갱신에서 M이 된 경우 삭제와 구별하고 같은 Gantt instance를 숨김/inert 상태로 보류한다. 명시 전체 프로젝트 복귀 전 범위를 넓히지 않는다. 서버 Summary 변환 정책은 변경하지 않는다.

날짜 조회는 현재 canonical M taskId/date/snapshot과 기존 queue를 확인하여 공개 scroll-chart/단일 date adapter를 사용한다. 저장 OFF는 일시 ON이며 원래 보기 명령은 출발 Dashboard 조건/관리 trigger와 이전 peer/public viewport 정보를 복귀시킨다. 새 사용자 intent나 snapshot/root/filter 변경이 이전 복원보다 우선한다. 좁은 물리 폭에서 marker 조작이 불가능하면 현재 조건을 보존한 Dashboard의 exact ID를 강조하고 현재 목록 trigger로 focus를 옮긴다. 조건 때문에 행이 없으면 그 이유와 별도 조건 해제 선택을 제공한다. 날짜 조회는 소속 작업 drill의 resourceScopeContext와 분리하며 소속 drill의 기존 guard는 유지한다.

선택 정리는 공개 select-task toggle:true/show:false로 native M 잔존만 제거하고 일반 Task를 유지한다. 명시 M clipboard root는 제외하지만 Summary root는 숨은 M을 포함한 전체 canonical subtree다. 기존 Copy 소속 확인은 copiedTaskIds와 canonical M의 교집합 수를 설명하고 closure Copy status와 삭제 확인도 숨은 영향을 알린다. Copy의 Assignment 제한을 Delete/Move의 포괄 잠금으로 확대하지 않는다. 신규 확인 modal이나 도메인 guard를 만들지 않는다.

이 절은 stacked #552 후보의 계약이다. 로컬, 실제 HTTP/SQLite, 독립 QA와 원격 exact-head quality/e2e/docker는 [테스트 계획](TEST_PLAN.md#issue-552--milestone-표시-분리-검증)에서 별도 판정한다. main/production 및 원격 결과를 로컬 실행으로 대신하지 않는다.

### #552 공개 Chart resize 보완 경계

설치 Core Layout은 ResizeObserver가 읽은 `latestLayout`의 Grid 폭으로 공개 `resize-chart`를 호출한다. 실제 80px/5단계 splitter에서 마지막 Grid 560px/Chart 825px인데 Core 폭 842px가 남은 실패를 보존한다. 842는 이전 Grid 544px로 계산한 값이며 최신 정상 이벤트의 826px와 실제 bbox 825px는 테두리 1px 차이다. 단순히 17px scrollbar 문제라고 단정하지 않는다.

앱의 기존 resize/observer/canonical queue가 요청한 측정에서만 한 번 frame을 넘긴 뒤 현재 commit을 읽는다. 단일 adapter는 installed typed `_columnsWidth`, `_scrollSize`, `_chartHeight`와 read-only native owner/content/Grid/resizer/Chart bbox를 대조한다. owner offsetWidth − 현재 effective Grid 폭 − native scrollSize − 4px가 실제 plot과 ±1px 이내이고 기존 높이도 일치할 때, stale Core 폭에만 공개 `resize-chart`를 한정 재발행한다. Chart-only의 effective 38px rail과 resizer4px를 사용하며 nominal Grid 폭을 대신 넣지 않는다. Grid-only/hidden/zero/지원하지 않는 rail·height는 보완하지 않는다. 직전 layoutKey=[version,correction,_columnsWidth,widget.offsetWidth]와 같은 요청을 중복 차단하며 새 layoutKey는 다시 한 번 보완할 수 있다. 자체 resize 이벤트는 재진입시키지 않는다. 공개 scrollLeft/top 명령, private state write, library patch, remount, idle polling은 없다. 이는 설치 버전에 결합된 앱 보완이며 안정 geometry API라는 보장이 아니다.

#552 Local Fast Feedback의 이전 실행과 visibility 수정 후 실행은 별도 source 지문으로 구분한다. 순수 의존성이 불변인 Unit56만 영향 재사용하며 UI44/실제HTTP3은 제품 visibility 수정 후 재실행한다. 명령/시간/소스 지문과 검증되지 않은 환경은 [TEST_PLAN](TEST_PLAN.md#552-local-fast-feedback-이력과-미검증-경계) 및 [실행 계약](../output/playwright/issue-552/review-selected/execution-contract.json)을 따른다. 설정 읽기는 SSR defaultON과 cached browser snapshot을 분리하며 저장 실패 시 현재 memory 선택을 유지한다. Clipboard는 canonical tasks가 바뀐 commit에서 explicit M root만 제거하고 Summary full subtree를 보존한다. 최신 source 실제 HTTP는 whole canonical 복사/권한/atomicity의 지정3cases 범위이며 production·원격회귀 완료를 뜻하지 않는다.

#552 정상 scope의 visibility는 schedule 조상을 상속한다. Dashboard 활성 중 Core의 실제 bbox와 instance를 유지하되 scope owner/Toolbar/native Grid/Chart의 paint는 hidden이어야 한다. invalid Summary scope의 별도 hidden/inert와 명시 복귀는 그대로다. 최초390px PNG의 peer 노출을 결함 근거로 보존하고 수정 후 fallback PNG를 exact-ID focus/외곽6px·조건 보존과 함께 비교한다.


### #552 Date reveal correction (2026-10-13)

A production `DATE_REVEAL` request now uses the canonical date coordinate via the public SVAR scroll-chart command, preserving vertical position and retaining Milestone rows outside WBS. Invalid or out-of-axis dates must fail closed and retain explicit Dashboard fallback. This does not enable private SVAR APIs or change stored visibility authority.
