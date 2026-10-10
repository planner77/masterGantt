# Milestone Timeline

## 적용 범위와 현재 상태

Issue #549는 Epic #548의 MT1 공통 모델과 설치 SVAR Core 연동 기술 기반이다. 현재 운영의 Milestone Grid/Chart 행, 전체/Task/Milestone 빠른 보기와 고급 유형 필터를 유지한다. 관리 진입은 #550, 날짜 lane은 #551, 표시 전환과 호환 UI는 #552, 통합 검증은 #553의 선행 gate 이후 범위다. 이 문서의 target은 현재 화면 기능 완료를 뜻하지 않는다.

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

공식 [base Willow demo](https://docs.svar.dev/react/gantt/samples/#/base/willow), [filter-tasks](https://docs.svar.dev/react/gantt/api/actions/filter-tasks/), [scroll-chart](https://docs.svar.dev/react/gantt/api/actions/scroll-chart/), [getState](https://docs.svar.dev/react/gantt/api/methods/getstate/)를 참고했다. [markers](https://docs.svar.dev/react/gantt/api/properties/markers/)는 PRO다. 정적 URL 조회와 실제 JavaScript 공식 demo 조작은 구분하며 공식 demo 조작은 NOT TESTED다. 이 기능은 PRO marker나 비공개 store mutation, source 복제, 독립 Gantt/remount를 사용하지 않는다.

단일 `src/features/gantt/milestone-timeline-adapter.ts`의 exports는 다음과 같다.

- `filterMilestoneWbsRows(api,visibleTaskIds|null)`: 공개 filter-tasks/open:false. caller는 필요한 Summary context와 canonical 원본을 별도로 유지한다.
- `milestoneDateCoordinate(api,dateOnly)`: 기존 local date adapter와 설치 gantt-store package-root 공개 getDiffer를 사용한다. typed getState의 `_scales.start/end/minUnit/lengthUnit`, `_weekStart`, `_chartWidth`는 읽기만 한다. Day/Week step 1, lengthUnit day에서만 반환한다.
- `revealMilestoneDate(api,dateOnly)`: 이미 가시면 viewport를 움직이지 않는다. 유효 축 안의 날짜만 공개 scroll-chart/left로 이동하며 native hidden row selection과 연결하지 않는다. 축 밖은 false로 반환하므로 caller의 기존 범위 확장이 선행한다.

주의: react-gantt 2.7.3의 타입은 getDiffer를 재export하지만 runtime은 재export하지 않는다. 이미 lockfile에 있는 gantt-store 2.7.2의 root export를 사용하며 새 패키지/버전을 추가하지 않는다. 이 package는 내부 state management 설명을 가진다. 공개 타입의 derived field와 exported helper 조합은 **문서화된 안정 widget geometry API가 아니다**. 해당 결합을 이 버전 제한 adapter에 격리하고 실제 DOM 기준점과 ±1px로 검증한다. 알 수 없는 scale/step, 날짜 오류, zero-size/유효하지 않은 geometry는 null/false이며 lane 활성화를 허용하지 않는다. 새 수식으로 ms/day 또는 week=7 pixel 산술을 복제하지 않는다.

공개 `scroll-chart({date})`는 설치 Core에서 hour 차이와 `_start`를 사용한다는 정적 source 관찰이 있다. 실제 America/New_York fixture의 Day/Week 결과는 calendar-day bar와 달랐다. hour 차이 및 원래 `_start`와 normalized `_scales.start` 차이가 원인 후보이며, 전체 차이를 DST 하나로 확정하지 않는다. 단일 adapter는 실제 Task geometry와 같은 calendar-day helper의 contentX를 공개 left 명령으로 전달한다. 강제 DOM scroll은 하지 않는다.

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
