# Issue #449 — 전 화면 UI/UX 소스 감사와 개선 계획

검토일: 2026-10-05. 상위 이슈: [#449](https://github.com/planner77/masterGantt/issues/449).

## 1. 범위와 상태

사용자 요청은 DESIGN.md와 실제 사용 관찰을 바탕으로 UI/UX 개선점을 검토하고 실행 가능한 이슈로 등록하며, 반복 방지 지침을 보강하는 것이다. 이번 문서 작업은 제품 UI 구현·병합·릴리스·Epic 종료가 아니다.

| 구분 | 기준 / 상태 |
| --- | --- |
| 검토 main | `6ce221bc16613625953b85244bb93ad50019b377` |
| application / SVAR | `0.83.3` / `@svar-ui/react-gantt` `2.7.3` |
| 기준 문서 | [DESIGN.md](../DESIGN.md), [UI_UX_GUIDELINES](UI_UX_GUIDELINES.md), [PROJECT_UX](PROJECT_UX.md), [TASK_EDITOR](TASK_EDITOR.md), [TEST_PLAN](TEST_PLAN.md), [ISSUE_LIFECYCLE](ISSUE_LIFECYCLE.md) |
| 실행 방식 | 단일 에이전트 순차 소스 검토 및 분리 CSS 실험; 독립 sub-agent/QA 미실행 |
| 실제 사용 관찰 | 사용자가 보고한 화면 문제와 양호 사례를 입력으로 사용 |
| 코드 검토 | 아래 파일·선택자·화면 구성 확인 |
| 실험 | Chromium에서 관련 CSS만 분리하여 margin 영향 측정 |
| 실제 application 로그인·전 화면 조작 | NOT TESTED; 실제 배포 version과 source SHA 차이 미확인 |
| SVAR demo | URL 및 공식 guide 확인; JS demo 실제 조작 NOT TESTED |
| 제품 E2E / 원격 CI / 독립 QA | 이번 감사에서 미실행; 후속 구현 시 각각 검증 |
| 문서 변경 승인 범위 | docs-only, application version 유지, `release_required=false`, `release_authorized=false` |

모든 화면이 결함이라는 주장이나 전체 UX PASS 보고가 아니다. 사용자 관찰, 소스 사실, 추론, 제한 실험, 미검증 범위를 구분한다. 구현 시작 시 latest main과 사용 중인 배포 버전을 다시 확인한다.

## 2. 내부 양호 기준과 해석

사용자는 **프로젝트 → 물류 구성 → KPI 대시보드**의 균형 있는 컴포넌트 배치, 수평·수직 정렬, 색상, 공간 활용을 양호 사례로 제시했다.

[`project-logistics-dashboard.module.css`](../src/features/logistics/project-logistics-dashboard.module.css)에서도 다음 설계 구조를 확인했다.

- filterBar/filterGroup의 수평 묶음과 wrap.
- KPI/quality grid의 가용 폭에 따른 다열 배치.
- KPI value와 unit의 baseline 정렬 및 metadata/action 분리.
- table 내부 horizontal scroll, mobile의 명시적 reflow.

참고할 것은 정보 구조와 배치 원칙이다. 모든 화면을 KPI 카드로 감싸거나 CSS의 raw fallback 색상·실제로 선언되지 않은 alias를 그대로 복제하지 않는다. `margin-top:auto`로 카드 action을 하단에 두는 의도된 layout과, 모든 secondary button에 고정 상단 여백을 주는 primitive 문제를 구분한다. KPI 계산과 기존 drill-down/Gantt 동작은 보존한다.

## 3. 핵심 발견과 실행 이슈

| ID | 발견 / 근거 | 개선 방향 | 추적 |
| --- | --- | --- | --- |
| UI-01 | 동일 레벨 관리 페이지의 main-content padding 경로가 다름 | 공통 shell·gutter·heading 시작점 | [#452](https://github.com/planner77/masterGantt/issues/452) |
| UI-02 | secondary-button 전역 margin-top 1.5rem, 화면별 reset 혼재 | control 외부 margin을 parent gap으로 이관 | #452 |
| UI-03 | 3개 관리자 인증 form width/배치/입력 스타일이 따로 정의됨 | 인증 presentation 공통화, 세션·권한은 분리 유지 | #452 |
| UI-04 | Resource/Group 동시 배치와 row별 편집 control 상시 노출 | full-width peer tabs와 목록 중심 progressive disclosure | [#453](https://github.com/planner77/masterGantt/issues/453) |
| UI-05 | 물류 row action margin과 암묵적 table 열 배분 | compact row·명시적 column budget·dialog action 정렬 | [#454](https://github.com/planner77/masterGantt/issues/454) |
| UI-06 | 기준정보 plain input의 경계/높이/padding 스타일 명시 부족 | 공통 Field/Input 및 식별 가능한 정상 상태 | [#455](https://github.com/planner77/masterGantt/issues/455) |
| UI-07 | 기준정보 반복 heading/행 action 공간과 목록 밀도 문제 | 추가/목록 hierarchy 단순화·행 geometry 정돈 | #455 |
| UI-08 | Task Editor의 고정 최소 버튼 폭과 기타 form별 별도 배치 | 실제 content budget 검증 후 소단위 보완; hit-area 보존 | [#456](https://github.com/planner77/masterGantt/issues/456) |
| UI-09 | 개별 기능 성공만으로 cross-page 일관성·식별성·밀도를 판정할 수 없음 | 전체 coverage 표와 geometry/상태 회귀 체계 | [#457](https://github.com/planner77/masterGantt/issues/457) |

### 3.1 페이지 shell과 공통 버튼

소스: [`globals.css`](../src/app/globals.css).

```css
.main-content {
  width: min(100% - 3rem, 75rem);
  margin: 0 auto;
  padding: clamp(2.25rem, 6vw, 5rem) 0;
}
.main-content:has(> .resources-page) {
  padding-block: 1.25rem 2.5rem;
}
.text-link,
.secondary-button {
  margin-top: 1.5rem;
}
```

위는 검토 SHA의 발췌다. 프로젝트 목록/프로젝트 작업 화면에도 별도 modifier가 있으므로 이들이 모두 같은 값을 사용해야 한다는 뜻이 아니다. **동일 목적의 관리자 3개 화면**에 공통 계약이 필요하다. 1440px viewport와 root 16px를 가정하면 일반 main-content의 상단 padding은 80px, resource override는 20px로 계산된다. 이는 CSS 계산이며 실제 화면의 header-to-content 측정값이 아니다.

같은 높이 버튼도 secondary에만 top margin이 있으면 flex의 정렬 계산과 table cell의 외부 크기에 영향을 준다. `.text-link`와 일반 standalone 상태 화면의 기존 간격, KPI의 flex auto margin을 보존하면서 모든 legacy 사용처를 조사해야 한다. 화면별 `!important`를 더하는 방식은 공통 원인을 남긴다.

### 3.2 Resource / Group

소스: [`resource-catalog-admin.module.css`](../src/features/resources/resource-catalog-admin.module.css), [`resource-catalog-admin.tsx`](../src/features/resources/resource-catalog-admin.tsx).

검토한 현재 `.columns`는 `minmax(0,1.7fr) minmax(18rem,.9fr)`이며 72rem 이하에서는 1열이다. 과거 #426 본문에 있던 1:1 구조를 현재 코드로 오인하지 않는다. #426에서 보완한 footer/geometry는 유지한다.

그러나 양쪽 목록을 계속 동시에 배치하며 resource row에 profile summary와 편집 control이 함께 표시된다. 사용자가 동시 표시의 필요성을 낮게 평가했으므로 #453은 **리소스 / 리소스 그룹 독립 탭, active 목록 full width, 필요한 profile editor만 열기**를 목표로 한다. 글로벌 역할과 그룹 membership은 다른 개념으로 유지한다.

### 3.3 물류 유형

소스: [`logistics-type-catalog-admin.module.css`](../src/features/logistics/logistics-type-catalog-admin.module.css), [`logistics-type-catalog-admin.tsx`](../src/features/logistics/logistics-type-catalog-admin.tsx).

표 cell padding은 `.4rem .55rem`이지만 row의 `.actions` 안 secondary button은 전역 margin을 상쇄하지 않는다. tab/filter 버튼은 별도 reset을 사용한다. 이름 수정/비밀번호 dialog도 같은 action 구조를 사용한다. table 열은 표시명/코드/상태/사용 건수/작업이며 명시적 fixed/minimum/flexible budget이 필요하다.

#454는 전역 원인 #452를 사용하여 행 크기와 열 배분을 정돈한다. 기존 설비/시스템 tab 및 전체/활성/비활성 필터를 새 기능으로 재구현하지 않는다.

### 3.4 프로젝트 기준정보

소스: [`project-master-admin.module.css`](../src/features/project-master/project-master-admin.module.css), [`project-master-admin.tsx`](../src/features/project-master/project-master-admin.tsx).

`.field`는 grid/gap/min-width, `.table input`은 width/min-width만 정의한다. 다른 관리자 화면처럼 input border/background/padding/height/focus를 명시하지 않으며, 전역 `.form-field input` 선택자는 이 CSS-module `.field`와 다르다. 실제 최종 cascade는 구현 시 브라우저에서 확인한다. TSX의 `styles.itemActions` 참조에 대응하는 정의가 검토한 CSS에서 없다는 점도 함께 확인한다.

#455는 정상 상태에서도 입력 가능한 곳이 즉시 식별되도록 하고, 반복 title/설명과 행 action의 여백을 정돈한다. per-row 저장, 사용 중인 stable code 편집 금지, category keyboard 및 status filter의 기존 계약을 유지한다.

### 3.5 Task Editor 및 기타 form

소스: [`project-task-editor.module.css`](../src/features/gantt/project-task-editor.module.css), [`project-settings-dialog.module.css`](../src/features/projects/project-settings-dialog.module.css), [`project-work-calendar-editor.module.css`](../src/features/projects/project-work-calendar-editor.module.css), [`workspace-dialog.tsx`](../src/components/workspace-dialog.tsx).

Task Editor는 이미 탭과 schedule/status semantic grouping을 사용한다. `.footerActions button`의 최소 폭 6.5rem과 `.dialog button`의 최소 높이 2.75rem을 확인했다. root 16px일 때 각각 104px, 44px다. 모든 버튼의 실제 크기가 정확히 이 값으로 고정되어 있다는 뜻은 아니다. **높이 44px는 기존 접근성 계약일 수 있으므로 불필요한 폭·외부 간격부터 검토한다.**

#456은 Task Editor, settings/calendar, 생성/입출력 폼을 소단위로 나누어 실제 before 측정 후 FIX/KEEP/FOLLOW-UP으로 기록한다. 미조사 표면을 KEEP/PASS로 처리하지 않는다. 전체 Gantt/Editor 재작성이나 새로운 field 추가는 범위 밖이다.

## 4. 전 화면 coverage와 증거 깊이

| 화면군 | 감사에서 확인한 범위 | 후속 검증 / 담당 |
| --- | --- | --- |
| 전역 header·프로젝트 목록(`/`) | route·global shell/styles 및 관련 #403 계약 | shared CSS 회귀, 날짜/metadata 열, 검색/filter/row action: #452/#457 |
| 프로젝트 만들기(`/projects/new`) | route와 관련 component inventory; 전체 동작 미검증 | 필드 배치, 생성/복사/template, validation: #456/#457 |
| 프로젝트 일정(`/projects/[publicId]`) | workspace 구성/import와 shell, scope/Editor 의존 관계 | toolbar/filter/notifications/fullscreen 및 Gantt instance·state 보존: #452/#457 |
| 프로젝트 리소스/공수·견적 | workload component 진입·데이터 계약 식별; 전체 시각 상태 미검증 | filter→summary→detail·숫자 정렬, 계산 불변·export: #457, form은 #456 |
| 프로젝트 물류·KPI | dashboard CSS 세부 및 구성 확인 | 양호 기준 보존, filter/drill-down/좁은 화면: #457 |
| 글로벌 리소스 | CSS 세부, layout·profile·member footer 확인 | 로그인/peer tabs/목록/profile/member/비밀번호: #452/#453/#457 |
| 글로벌 물류 | TSX/CSS 세부 확인 | 로그인/두 유형/추가/수정/filter/비밀번호: #452/#454/#457 |
| 글로벌 기준정보 | TSX/CSS 세부 확인 | 로그인/세 범주/추가/행 편집/filter/비밀번호: #452/#455/#457 |
| Task/Resource/Relation Editor | CSS 세부, layout·footer·resource grouping 확인 | 실제 layout 및 nested dialog/상태별 동작: #456/#457 |
| settings/calendar | 해당 module CSS와 WorkspaceDialog 확인 | 실제 field cascade/validation/footer/keyboard: #456/#457 |
| copy/import/export/template dialog | workspace 구성/파일 inventory; 전체 구현 세부 미검증 | FIX/KEEP/FOLLOW-UP과 실제 before, focus/draft/옵션: #456/#457 |
| loading/empty/error/not-found 및 `/gantt-demo` | global state CSS 및 route 확인 | shared CSS 영향/복구 명령; demo는 업무 화면과 구별: #452/#457 |

모든 행의 actual-app 결과는 현재 NOT TESTED다. 기능 구현 시 #457 coverage에 route/entry, fixture, viewport, 상태, source SHA, before/after, PASS/FAIL/BLOCKED/NOT TESTED/N/A를 채운다. 감사의 코드 확인 깊이가 서로 다르다는 점을 숨기지 않는다.

## 5. 분리 CSS 실험

### 조건과 결과

전체 앱/Tailwind bundle 없이 관련 규칙만 가져와 원인을 분리했다. 이 결과를 서비스의 실제 table row height나 구현 후 합격 판정으로 인용하지 않는다.

- Browser: Chromium `144.0.7559.96`, headless.
- Viewport: 1100×900 CSS px, device scale 1, root font 16px.
- body: Arial, line-height 1.5; section max-width 900px.
- table: border-collapse collapse, cell padding `.4rem .55rem`, bottom border 1px.
- buttons: min-height 40px, padding `.5rem .875rem`, font `.875rem`, border 1px.
- `.actions`: flex, align-items center, gap `.45rem`, wrap.
- 비교 변수: secondary button `margin-top:1.5rem` 대 `0` 하나.

| 측정 | 현재 규칙 재현 | margin=0 비교 | 차이 |
| --- | ---: | ---: | ---: |
| 단일 table row 높이 | 77.78125px | 53.78125px | -24px |
| dialog secondary 높이 | 40px | 40px | 0px |
| dialog primary 높이 | 40px | 40px | 0px |
| secondary.top - primary.top | 12px | 0px | -12px |

두 버튼의 **자체 높이가 아니라 상단 위치 차이**가 줄었다. 동일 조건 재실행에서 같은 값을 확인했다. 실제 앱의 폰트, cascade, label, viewport, multiline 상태에 따라 절대값은 달라질 수 있다.

### 재현 절차

다음 HTML을 독립 페이지로 열고 viewport를 1100×900으로 지정한다. DevTools console의 결과를 확인한다. 앱 CSS를 덮어쓰는 용도로 사용하지 않는다. 관련 규칙과 DOM만 남긴 최소 재현이며 서비스 통합 테스트를 대체하지 않는다.

```html
<!doctype html>
<meta charset="utf-8">
<title>Isolated CSS test — not the masterGantt app</title>
<style>
:root { font-size: 16px; }
* { box-sizing: border-box; }
body { margin: 24px; font-family: Arial, sans-serif; line-height: 1.5; }
.example { max-width: 900px; }
.secondary-button {
  margin-top: 1.5rem;
  font-size: .875rem; font-weight: 650;
  min-height: 2.5rem; border: 1px solid;
  padding: .5rem .875rem;
}
.primary-button {
  font-size: .875rem; font-weight: 650;
  min-height: 2.5rem; border: 1px solid;
  padding: .5rem .875rem;
}
.actions { display: flex; gap: .45rem; align-items: center; flex-wrap: wrap; }
.tableWrap { border: 1px solid; padding: .5rem .75rem; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: .4rem .55rem; border-bottom: 1px solid; vertical-align: middle; }
.dialogExample { padding: 12px; border: 1px solid; }
.fixed button { margin-top: 0; }
</style>
<section class="example before">
  <div class="tableWrap"><table>
    <thead><tr><th>Name</th><th>Code</th><th>Status</th><th>Count</th><th>Actions</th></tr></thead>
    <tbody><tr><td>Equipment type</td><td>AGV</td><td>Active</td><td>12</td>
      <td><div class="actions"><button class="secondary-button">Edit name</button><button class="secondary-button">Deactivate</button></div></td>
    </tr></tbody>
  </table></div>
  <div class="actions dialogExample"><button class="secondary-button">Cancel</button><button class="primary-button">Save</button></div>
</section>
<script>
const before = document.querySelector('.before');
const fixed = before.cloneNode(true);
fixed.className = 'example fixed';
document.body.append(fixed);
console.table([before, fixed].map(section => {
  const secondary = section.querySelector('.dialogExample .secondary-button');
  const primary = section.querySelector('.dialogExample .primary-button');
  const a = secondary.getBoundingClientRect();
  const b = primary.getBoundingClientRect();
  return {
    variant: section.className,
    rowHeight: section.querySelector('tbody tr').getBoundingClientRect().height,
    secondaryMargin: getComputedStyle(secondary).marginTop,
    secondaryHeight: a.height, primaryHeight: b.height,
    topDelta: a.top - b.top
  };
}));
</script>
```

## 6. 共通 검증 계약

- 같은 목적의 admin shell은 동일 viewport에서 header-to-heading gap, gutter, 인증 control geometry를 비교한다. 서로 다른 길이의 설명을 억지로 같은 card 높이로 만들지 않는다.
- normal/focus/disabled/error/readonly control의 computed border/background/padding/font/height와 label/error 연결을 검증한다.
- table/header/body 열 경계, sibling text/control overlap, row height, visible rows와 list usable width/height, footer top/height를 측정한다. same-row/same-size action 차이는 1 CSS px 이내 기준으로 하되 wrap/stack은 별도 판정한다.
- document overflow와 table/Gantt 내부 scroll을 구분하고 마지막 column/action 접근성을 확인한다.
- 390/768/1024/1440/1920px, 긴 한글·영문, 0/1/다수 행, 역할 0/1/3개, 최장 등급/상태/action label, 큰 숫자·날짜, empty/error/saving/stale/session-expired를 위험 기반 조합으로 검증한다.
- keyboard tab/arrow/Home/End/Escape/focus restore, dirty draft와 401/403/412/429 복구를 보존한다. 시각 개선으로 auth/Origin/revision/If-Match/canonical snapshot이 바뀌어서는 안 된다.
- screenshot은 geometry/interaction의 보조 증거다. 실제 125% zoom을 실행하지 않았다면 그 상태를 명시한다. deviceScaleFactor를 browser zoom으로 오인하지 않는다.
- 기존 테스트 helper를 재사용하고 E2E 조합을 무작정 증식시키지 않는다. frontend 자체 확인·독립 QA·원격 CI를 구분한다.

## 7. 지침 반영과 실행 순서

DESIGN.md 11절에 내부 KPI reference, 공통 인증 presentation, parent-owned spacing, reset 이후 input 식별성, peer views, row/content budget, cross-screen 검증 원칙을 보강한다. 기존 1–10절의 방향·기능 계약·비범위는 유지한다.

실행 순서:

```text
#457 baseline/helper/coverage 설계 + #452 공통 기반
  → #453 리소스 탭 / #454 물류 표 / #455 기준정보
  → #456 Task Editor 및 기타 form 소단위 보완
  → #457 전체 coverage 통합 검증
```

공통 globals/primitive는 #452가 소유한다. 화면별 PR이 같은 파일에 독자적인 style override를 쌓지 않는다. 각 PR은 최초부터 자기 범위 테스트·문서·before/after를 포함한다. #457을 마지막 테스트 일괄 추가 작업으로 취급하지 않는다.

#426/#330/#332/#403 등 기존 보완과 #399/#407/#418 scope, #372 fullscreen, #411–#415 역할·공수·견적 계약은 보존한다. 서로 다른 작업을 한 giant restyle PR로 묶지 않는다. GitHub의 issue 참조/checklist만으로 자동 순차 구현·PR·CI가 시작되지 않는다.

화면별 `PROJECT_UX`, `TASK_EDITOR`, `TEST_PLAN`의 현재 구현 계약은 각 구현 PR에서 실제 결과와 함께 갱신한다. 이번 감사 문서에서 아직 구현하지 않은 목표를 현재 동작처럼 기록하지 않는다. docs-only PR은 `Refs #449`를 사용하고 Epic/child를 닫는 closing keyword를 사용하지 않는다.

## 8. 외부 공식 참조

확인일 2026-10-05. URL/문서 조회와 JS demo 조작은 별개다.

- [SVAR Base demo](https://docs.svar.dev/react/gantt/samples/#/base/willow)
- [SVAR Editor demo](https://docs.svar.dev/react/gantt/samples/#/editor/willow)
- [SVAR Editor guide](https://docs.svar.dev/react/gantt/guides/ui-layout/editor/) — field 구성, bottomBar의 명령 구분, custom Editor 진입을 참고한다. 최신 문서 API와 설치된 Core 2.7.3의 지원 범위가 같다고 가정하지 않는다.
- [Tailwind Preflight](https://tailwindcss.com/docs/preflight) — 기본 margin/border reset을 확인하고 실제 component cascade를 검증한다.
- [WAI-ARIA Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) — peer tab의 role/state/keyboard 의미를 참고한다.

글로벌 관리자 인증/카탈로그를 직접 대체할 Core demo가 이번 자료 조회에서 확인되지 않았으므로 app-owned UI를 유지한다. SVAR PRO 도입이나 private source 복제, 새 UI framework는 비범위다.
