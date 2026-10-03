# Issue #253 Core 기준 일정 Chart 정렬 POC

## 범위와 판정 기준

- Issue: [#253](https://github.com/planner77/masterGantt/issues/253), 선행 저장·편집·Grid 구현: #202 / PR #227.
- 기준 main: `e12a52a9ca5c1f06281e1cc07ffb5db540b25e66`, application version `0.48.0`, SVAR React Gantt Core `2.7.3`.
- 사용자 승인 범위는 PR 생성과 CI 시작까지다. CI 모니터링·병합·릴리스·Issue 종료는 포함하지 않는다.
- 실제 기준 일정이 현재 일정과 같을 때 x/width/row가 ±1 CSS px 안에 정렬되어야 한다. Day/Week, 가로·세로 스크롤, Grid resize, Summary 접힘, 필터, fullscreen, 390/768/1024/1440px, 장기 일정·월/년 경계, Task/Milestone/complete Summary, 권한·상호작용·인스턴스 보존을 모두 통과해야 제품 구현으로 진행한다.
- PRO `baselines`/`base_*`, 미문서 내부 상태·task geometry, SVAR 내부 DOM을 좌표 authority로 사용하거나 고정 px/날짜 보정을 넣는 방법은 허용하지 않는다.

## 공개 계약 조사

공식 [getState](https://docs.svar.dev/react/gantt/api/methods/getstate/)와 [getReactiveState](https://docs.svar.dev/react/gantt/api/methods/getreactivestate/)는 `start/end`, `scales`, `cellWidth/cellHeight`, `scaleHeight`, `gridWidth`, scroll과 `area`를 설명한다. [resize-chart](https://docs.svar.dev/react/gantt/api/actions/resize-chart/)는 `width/height/scrollSize`를 제공한다. 그러나 정규화된 timeline 원점과 날짜→pixel 변환, 접힘·필터 이후 실제 표시 행 위치를 제공하는 계약은 확인하지 못했다.

설치된 전이 store 타입에 있는 `xArea`, `_start`, `_scales`와 task geometry는 공식 React Gantt 공개 API로 문서화되지 않았으므로 후보 입력에서 제외했다. [getTask](https://docs.svar.dev/react/gantt/api/methods/gettask/)는 task 설정을 반환하며 [taskTemplate](https://docs.svar.dev/react/gantt/api/properties/tasktemplate/)는 막대 내부 콘텐츠용이다.

[autoScale=false](https://docs.svar.dev/react/gantt/api/properties/autoscale/)는 고정 범위 실험에 사용했으나 범위 밖 drag를 제한하므로 현재 편집 동작을 보존하는 일반 해법으로 간주하지 않는다. [scale 설정](https://docs.svar.dev/react/gantt/guides/timeline/scales/)만으로 모든 scale의 실제 원점 규칙을 보장할 수 있다는 근거도 확인하지 못했다.

## 재현과 증거 구분

테스트 전용 fixture는 `tests/poc/`에서 별도 loopback server로 Core를 렌더한다. 제품 route/debug hook은 추가하지 않는다. 후보 계산은 공개 상태와 소유 host 크기만 사용한다. `.wx-bar`의 실제 bounds는 브라우저 검증 oracle로만 읽으며 후보 계산에 전달하지 않는다.

```sh
npm ci
CAPTURE_BASELINE_POC=1 npx playwright test --config tests/config/playwright.config.ts tests/e2e/baseline-alignment-poc.spec.ts
```

CI에서는 같은 spec을 전체 Chromium E2E와 함께 실행하고 측정 JSON을 attachment로 남긴다. `CAPTURE_BASELINE_POC=1`일 때만 저장소 증거를 재생성한다. 측정 테스트의 PASS는 유효한 관측을 확보했다는 뜻이며 제품 POC의 정렬 PASS와 별개다. ±1px 기준을 완화하거나 required CI gate를 변경하지 않는다.

초기 로컬 실행은 sandbox의 server bind 제한으로 BLOCKED였고 권한 확장 후 재실행했다. 첫 native oracle selector는 실제 DOM과 달라 수정했다. 최종 관측 spec은 1/1 PASS이며 이전 실행 오류를 제품 회귀나 POC 정렬 PASS로 해석하지 않는다. typecheck, fixture TypeScript 검사, 대상 ESLint, Markdown link 검사도 PASS다. PR의 원격 `quality/e2e/docker`는 CI 시작 시점에 **NOT TESTED**로 기록하고 완료를 모니터링하지 않는다.

## 실측 결과와 Gate

2026-09-28, Chromium `153.0.8010.12`, Asia/Seoul, 1440×844 viewport에서 Task 하나의 동일 날짜 후보를 측정했다. [측정 JSON](evidence/issue-253/public-state-alignment.json), [기본 Week 화면](evidence/issue-253/core-week-default-fixture.png), [고정 범위 Week 화면](evidence/issue-253/core-week-fixed-range-fixture.png)을 남겼다. 화면에는 native Core 막대와 주황색 시험 후보 marker가 함께 보인다. 제품 Chart 오버레이 구현은 아니다.

두 x 후보는 `host.left + gridWidth + elapsedDays × cellWidth / unitDays - scrollLeft`와 `host.left + host.width - resize.width + 날짜 offset - scrollLeft`다. 행 중심은 알려진 fixture의 Summary 다음 첫 Task 행과 공개 `scaleHeight/cellHeight`로 계산했다. 후보 폭은 4일 날짜 차이에 공개 cell 크기를 곱했다. 표시 행 순서 일반화는 검증하지 않았다.

| Scale / autoScale | gridWidth 기준 x 오차 | resize-chart 기준 x 오차 | 폭 오차 | 행 중심 오차 | 기초 정렬 |
| --- | ---: | ---: | ---: | ---: | --- |
| Day / true | 105px | 101px | 0px | 0.5px | FAIL |
| Week / true | 160px | 156px | 약 0.286px | 0.5px | FAIL |
| Week / false | 28px | 24px | 약 0.286px | 0.5px | FAIL |
| Day / false | 5px | 1px | 0px | 0.5px | 제한된 후보 PASS |

기초 후보 Gate는 **FAIL**이다. Day 고정 범위의 한 관측이 허용 오차 안에 있어도 Week 및 기본 autoScale 후보가 실패하므로 제품 구현의 선행 조건을 충족하지 못한다. 이는 시험한 전략의 실패이며 모든 가능한 공개 API 접근이 불가능하다는 증명은 아니다. `area`도 이 런타임에서 `{start:0,end:15,from:0}`으로 관측되어 공식 문서의 timestamp 설명과 달랐다. 이 값을 원점으로 채택하지 않았다.

가로·세로 scroll, 실제 Grid resizer, Summary collapse/expand, filter, fullscreen, 390/768/1024px, 장기·월/년 경계, Milestone/complete·partial Summary, readonly/edit, keyboard·drag·resize·비색상 구분은 **NOT TESTED**다. fixture의 `initCount=1`은 관측했지만 제품 toggle의 무재마운트 증거가 아니다. 기초 좌표 Gate가 실패해 전체 matrix와 제품 overlay/toggle 구현으로 진행하지 않았다.

## 후속 결정

현재 상태는 **DECISION_REQUIRED**다. 기존 저장·Editor·Grid Baseline은 유지하며 Chart bar/toggle은 제공하지 않는다. Issue가 지정한 선택지는 PRO 도입 검토, 별도 렌더링 계층 확대 설계, Chart 표시 보류다. 선택 후 범위·라이선스·API 계약을 확정하고 새 전략으로 전체 인수 기준을 검증해야 한다. 이번 PR은 재현 가능한 POC와 문서 정합성 수정으로 전달하며 Chart 기능 완료나 CI PASS로 보고하지 않는다.

## 문서·버전 영향

제품 코드·API·DB·일정 알고리즘은 변경하지 않는다. application version은 `0.48.0`을 유지하고 `release_required=false`, `release_authorized=false`로 기록한다. 테스트 bundler는 직접 사용하는 기존 lock 버전의 `esbuild`를 devDependency로 명시한다.

- `TEST_PLAN.md`: #202 범위의 PRO 연동·Chart toggle 설명을 저장·편집·Grid 계약으로 바로잡고 #253을 별도 POC gate로 구분한다.
- `PRO_FEATURE_MATRIX.md`, `PROJECT_UX.md`: 저장·편집 구현과 Chart POC 상태를 구분한다.
- API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/IMPORT_SCHEMA/CI_CD/REMOTE_VALIDATION: 계약·권한·workflow 변경이 없어 갱신 N/A다.
- DESIGN/UI_UX_GUIDELINES: 제품 UI 변경이 없어 갱신 N/A다. 향후 UI는 기존 token, 비색상 구분, pointer-events 없음, `aria-pressed` toggle과 무재마운트 계약을 따라야 한다.

재부팅 이전 `/tmp` 작업과 미저장 관측은 증거로 사용하지 않았다. 이번 증거는 지속 worktree에서 다시 실행한 측정이다.
