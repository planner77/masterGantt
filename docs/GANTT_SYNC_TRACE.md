# Gantt Sync Trace — Issue #568

## 목적과 검증 층

이 도구는 [Issue #568](https://github.com/planner77/masterGantt/issues/568)과 상위 [#567](https://github.com/planner77/masterGantt/issues/567)의 분석 산출물이다. 제품의 동기화 알고리즘을 고치거나 새 상태 authority를 만들지 않는다. 다음 source를 구분한다.

| 층 | 고정 source | 확인 범위 |
| --- | --- | --- |
| 실제 Core | 설치 `@svar-ui/react-gantt` 2.7.3, Willow 합성 fixture | 명령/반환/Core state/native layout |
| React wrapper | 이번 진단 fixture | props/commit/layout/input/observer와 Core 사이 순서 |
| 전체 Project 비교 | PR #562 `afd5ec2899183a2464b64f91d34e9de5d8a8319c`, app0.106.1 | 실제 기존 5개 회귀의 두 독립 실행 |

main 기반 도구의 application0.103.1과 비교 stack0.106.1을 섞지 않는다. 모든 실험은 합성 데이터이며 server/Origin/session/revision 계약 변경을 요구하지 않는다.

## 공식 계약과 설치 버전

2026-10-09 확인: [exec](https://docs.svar.dev/react/gantt/api/methods/exec/) 문서는 void 반환을 명시하며 화면 안정화 Promise를 약속하지 않는다. [scroll-chart](https://docs.svar.dev/react/gantt/api/actions/scroll-chart/)는 left/top px를 사용한다. [resize-chart](https://docs.svar.dev/react/gantt/api/actions/resize-chart/)는 실제 chart container의 width/height/scrollSize 변경을 설명한다. [filter-tasks](https://docs.svar.dev/react/gantt/api/actions/filter-tasks/)의 filter/open과 [autoScale](https://docs.svar.dev/react/gantt/api/properties/autoscale/)은 별도 공개 계약이다.

[Willow demo](https://docs.svar.dev/react/gantt/samples/#/base/willow), Scroll to date와 External filter controls는 fixture의 공개 API 구성 참고다. 외부 demo URL을 읽은 사실을 실제 조작 PASS로 기록하지 않는다. 설치 `@svar-ui/gantt-store/dist/types/types.d.ts`의 exec 선언은 Promise<any>이며 `DataStore.d.ts`의 scroll-chart에는 date?:Date가 있다. 최신 공식 문서의 void 및 left/top 목록과 설치 타입을 혼합하지 않는다. runtime 반환/resolve, Core state, React commit, DOM settle은 각각 측정한다.

## 추적·완료 조건

구현은 `src/features/gantt/diagnostics/core-action-trace.ts`(schema·settle), `core-trace-observer.ts`(읽기 전용 API/native/ResizeObserver), `/diagnostics/core-action-trace`(합성 Core/React fixture)로 분리한다. fixture route는 nonproduction과 `E2E_ERROR_BOUNDARY_PROBE=true`를 함께 요구한다. 전체 Project observer는 nonproduction에서 명시적인 `?__coreTrace=1` opt-in일 때만 연결하며 좌표·Store를 쓰거나 `exec`의 반환 계약을 감싸지 않는다.

전체 Project의 `.project-gantt-frame.__issue568Trace`는 `configure(run,head,scenario)`, `snapshot()`, `settle()`을 제공한다. configure 인수는 64자 이내의 합성 식별 토큰으로 제한한다. screenshot·Playwright assertion·trace는 같은 run/head/scenario로 연결한다. observer가 붙은 source는 원본 PR source와 patch hash를 구분해 기록한다.

공통 trace는 action 이름과 허용된 non-sensitive numeric/boolean/식별값만 보존한다. Task 원문·description·URL·password·cookie·session·실제 DB는 저장하지 않는다. 고정 최대 크기의 ring과 cleanup으로 무제한 기록·listener/RAF 누수를 막는다. trace 순서는 단조 증가 sequence를 권위로 정렬하며 RAF tick을 함께 제공한다. Playwright clock 설치/정지로 performance.now 기준이 바뀐 비교 실험에서는 elapsedMs가 역행할 수 있으므로 시간 간격의 증거로 사용하지 않는다. 전체 Project의 projectionEpoch는 관측된 React layout commit 횟수이며 순수 projection 변경 횟수가 아니다.

- `COMMAND_ACCEPTED`: 명령 발행/반환 관측. 성공한 화면 갱신으로 해석하지 않는다.
- `CORE_STATE_UPDATED`: 공개 Core 좌표·state 변경 관측.
- `NATIVE_LAYOUT_SETTLED`: Core exact와 DOM ±1px, geometry 및 실제 scroll capacity가 3개 연속 frame에서 정합함.
- `SUPERSEDED_BY_INTENT`: 더 최신 명시 입력으로 관측 대상 무효화.
- `NO_SCROLL_CAPACITY`: 요구 좌표를 지원하지 않는 실제 native 범위.
- `TIMED_OUT`: 최대 대기 안에 조건 미충족. 실행 실패 근거를 보존한다.

이 완료 조건은 관측 구간 밖에 미래 writer가 없다는 증명이 아니다. 최초 왜곡 writer가 trace에 없으면 해당 원인의 소유 layer는 가설로 남긴다. 운영 browser/background throttling/장기 비동기 조건은 별도 검증한다.

## 재현 결과와 후속 판단

원본 PR #562를 수정하지 않은 로컬 Chromium/Next dev의 두 독립 run은 각각 3 PASS/2 FAIL, exit1이었다. 두 run의 source SHA는 위 비교 source로 동일하며 다음 결과는 원본 CI #2278의 FAIL을 취소하지 않는다.

| 반복 실패 대상 | 로컬 trial1 / trial2 | 관측과 후속 owner |
| --- | --- | --- |
| Resource peer 수평120 복귀 | PASS / PASS (로컬 재현 불가) | 실행 환경·writer 순서를 더 비교해야 하며 Core 결함 단정 불가 |
| pending 복귀 중 사용자 wheel30 | FAIL / FAIL | 공개 left30 기대에 실제0, Core/DOM ±1 정합 실패. viewport intent/geometry 경합 조사 대상 |
| fullscreen Task Editor metadata 수평120 | PASS / PASS (로컬 재현 불가) | 동일 source라도 로컬 성공을 CI 성공으로 이관하지 않음 |
| Inline Tab 저장 후 Week 전환 | FAIL / FAIL | 저장 직후 표시 정상, Week 전환 후 checkbox의 canonical 이름은 최신이나 native text cell은 구값. projection/native reconciliation 조사 대상 |
| Milestone390px Day/Week plot | PASS / PASS (로컬 재현 불가) | lane/plot geometry는 두 run에서 존재. CI layout/초기화 시점 추가 비교 필요 |

첫 왜곡 writer의 인과 확정은 action/React/observer 순서가 모두 있는 추가 trace에 근거해야 한다. 위 owner는 후속 분석 책임이지 제품 원인 확정이나 수정 PASS가 아니다. 고정 원본의 공개 diagnostics는 scroll/resize/select와 최근256 action을 제공하지만 timestamp·모든 writer source를 포함하지 않아 이것만으로 인과를 확정하지 않는다.

observer-only 비교 clone에서도 두 실패를 각각 두 번 확인했다. wheel의 두 trace는 동일하게 sequence68 wheel40, sequence71 Core30/native31, sequence77/78 filter30/31, sequence79 다음 resize의 before Core30/native0, sequence83/84 scroll-chart(left0)의 Core30→0 순서였다. native0을 최초 관측한 뒤 scroll event가 Core0에 전달되는 순서는 확인했으나 filter DOM commit의 직접 writer callsite는 관측하지 못했다. Inline은 Tab 직후 정상/Week 뒤 구값을 반복 확인했으며 set-columns/filter-tasks 주변의 실제 text writer는 미확정이다. 이 observer 실험은 수평 전용 이전 helper draft이며 수직 sample은 판정에 사용하지 않는다. 구버전 filterKey의 문자열 truthiness label도 active filter 판단에 사용하지 않으며 action/sample/sequence만 근거로 삼는다.

후속 adapter의 우선순위는 최신 사용자 intent > 유효한 명시 reveal > 동등한 scope/filter/geometry에서만 가능한 viewport 보존이다. 이 목록은 다음 이슈의 설계 입력이며 현재 제품의 상태 머신 구현이나 검증 PASS를 의미하지 않는다. geometry/capacity 불일치는 NO_SCROLL_CAPACITY, 새 intent는 SUPERSEDED_BY_INTENT, 제한 내 미정합은 TIMED_OUT으로 분리해 raw resize/scroll 순서를 보존한다.

고정 원본과 observer-only의 [재현 matrix](evidence/issue568/stack/reproduction-matrix.json), [명령·설정 영수증](evidence/issue568/stack/command-config-receipts.json), [manifest](evidence/issue568/stack/manifest.json)에 source/patch hash와 모든 최초 실패를 보존한다. 실제 반복 실행의 명령·source hash·관측 영수증은 [Issue 실행 계획](exec-plans/active/ISSUE_568.md)에 연결한다. raw Playwright ZIP/network traces·실제 DB·보안 데이터는 commit하지 않고 allowlist JSON만 남긴다.

## 실제 Core fixture 결과

[Core 실행 summary](evidence/issue568/core/summary.json)와 [source·artifact manifest](evidence/issue568/core/manifest.json)는 설치 Core2.7.3/Chromium1243, source manifest `00cbfad2f05fcb0671b75dea81c4ce8472d884aacf7c268fd2d99a24f2ce8931`에 고정한다. 최종 diagnostic test4건 PASS(15.6초)는 1440px 실제 명령·wheel·3-frame settle 두 context와 390px zero-capacity 분류 두 context를 뜻한다. 390px native clientWidth0/Core chartWidth>0을 관측했으며 wheel은 NOT TESTED다. 제품 390px 대응 성공이나 Core 결함 확정으로 해석하지 않는다.

실제 exec는 object thenable을 반환하고 resolve를 관측했다. Promise resolve와 3-frame native settle은 별도 sequence로 남았으며 resolve를 화면 완료로 삼지 않는다. 설치 scroll-chart(date)는 40px/day의 Jan1→Feb15에서 공개 left1800을 실측했다. rename-core와 React rename, filter0/reset/reveal, columns/resize/delete, Day/Week 및 제어 버튼 keyboard를 측정했다.

최초 fixture 높이0으로4 FAIL, 좁은 chart 폭0으로2 PASS/2 FAIL 두 번, evidence 파일 생성 순서 ENOENT로3 PASS/1 FAIL을 보존하고 최종4 PASS를 분리한다. 기존 제품 assertion/timeout/skip/workflow 변경은 없다. Unit9 PASS/typecheck PASS/변경부 ESLint0errors(기존 hook warning4)이며 공식 전체 회귀를 대체하지 않는다.

## 범위별 판정 경계

합성 fixture의 delete-core는 server의 confirmed Task Delete와 401/412/network 복구를 대신하지 않는다. fixture button의 Enter/Tab/Escape 관측도 native Inline 편집의 focus/저장/취소 완료와 다르다. 고정 stack의 Inline 실패 test는 Week assertion에서 중단되어 후단500/412/network는 해당 run에서 NOT TESTED다. 보완 실행은 별도 영수증으로 연결하며 다른 기능의 PASS를 이 항목으로 전이하지 않는다.

## 문서 영향

ARCHITECTURE/PROJECT_UX/TEST_PLAN/DECISIONS/active PLAN을 동기화한다. DESIGN/AGENTS는 제품 시각 언어·역할·검증 gate 변경이 없어 N/A다. API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/Import/VBA/배포/CI는 저장·권한·도메인·운영 계약 변경이 없어 N/A다. 진단 페이지의 production 차단과 allowlist/cleanup은 코드·테스트로 별도 확인한다.

보완 원본 검증: Inline keyboard 저장/취소 두 번과 confirmed Task Delete 401/412/network 각각두 번, 총8 PASS/exit0(2.6분). [보완 영수증](evidence/issue568/stack/supplemental-validation.json)에 정확한 source와 명령을 남긴다. 이는 Week 뒤 Inline 오류 복구 미도달 분기의 PASS를 대신하지 않는다.
