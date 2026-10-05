# Issue #452 구현 및 검증 증거

## 범위와 증거 수준

기준 main은 `6ce221bc16613625953b85244bb93ad50019b377` / application `0.83.3`, 후보는 `0.83.4`다. 세 관리자 route의 presentation·button spacing과 물류 만료 focus 복원 타이밍만 변경한다. 인증·API·DB·Scheduling 정책 및 후속 #453–#457의 표/탭 재설계는 변경하지 않는다.

이 문서의 legacy 목록은 **모든 26개 TSX 소비 파일에 대한 소스 기반 변경 전후 분석**이다. 24→0은 전역 선언과 해당 소비자의 유효 override/부모 배치를 검토한 결과이며, 전 행을 실제 browser에서 측정했다는 뜻이 아니다. 실제 실행한 영역은 별도 기재한다. 나머지 전체 기능의 수동 browser 검증은 `NOT TESTED`이며 PR CI 시작을 전체 UI 회귀 PASS로 표시하지 않는다. 기본 외부 간격을 제거한 뒤 의도된 독립 CTA는 부모로 이관하고, 기존 effective 0인 경우는 해당 간격 이관이 불필요하다는 근거를 제공한다.

전역24px 선언과 descendant override가 함께 있는 dialog는 실제 menu/compact-form ancestor에 따라 이전 실효 margin이0일 수 있다. 아래의 조건부 설명을 우선하며 실제 측정하지 않은 실효값을 computed style PASS로 단정하지 않는다.

## Legacy margin 소비자 전수 분석

| 소비 파일(src/ 기준) | 기존 → 변경 / 간격 소유권 | 실제 증거 또는 NOT TESTED 근거 |
| --- | --- | --- |
| app/error.tsx | 버튼24px→0, standalone-actions 부모24px | 단독 retry CTA 의도 보존. 에러boundary 실제강제실행 NOT TESTED(실제 오류 boundary 미실행), 소스확인 |
| app/gantt-demo/error.tsx | 버튼24px→0, 부모24px | 단독 retry 보존, 실제boundary NOT TESTED |
| components/empty-projects.tsx | 버튼24px→0, flex 부모24px | 신규 실제 isolated-app E2E390/1440 높이40px 부모24px 측정 |
| components/project-list.tsx | 필터 기존0유지; no-results 기존24px→0 | filterToolbar/filterConditionRow/dateFilterRow 명시0와 parentgap. noResults .secondary-button은 local selector여서 기존4px효과 주장 불가; gridgap/정렬 보존, 전역24 의존 제거 |
| components/workspace-notifications.tsx | header/errorList action24px→0 | headingActions flexgap8/errorList gridgap8이 소유. 가상alert/errorList 기존padding·gap 보존, 상세browser NOT TESTED |
| components/project-link-button.tsx | trigger scope global/module0유지; 수동복사 retry24px→0 부모24px | 신규 실제 clipboard실패 모달 E2E390/1440 부모24 높이40 Escape복원 |
| components/workspace-dialog.tsx | 닫기24px→0 | dialogHeading flex+gap16, margin-bottom16 소유. 관리자 비밀번호 모달 기존E2E PASS |
| features/project-master/project-master-admin.tsx | tabs/filters0유지, action24px→0 | 실제5폭 after-auth 상단/높이/비겹침/0px 확인. catalogSection/sessionSection gap/패딩보존 |
| features/logistics/logistics-type-catalog-admin.tsx | tabs/filters0유지, action24px→0 | 실제5폭 auth/after-auth 측정; toolbar/actions flexgap. 기존filteredlists/passworddialogs E2E PASS |
| features/logistics/project-logistics-management.tsx | actions24px→0 | 각 기존 row/dialog actions flex/gridgap 및 project-logistics-dialog-actions global0 보존. 전체물류대화상자 runtime NOT TESTED,child-redesign 비범위 |
| features/templates/create-from-template-form.tsx | template-search-status/form-actions24px→0; error단독 retry 부모24px | 부모flexgap8 기존; 오류retry standalone-actions 이전24보존. template-card-stats margin-top:auto 보존. 실제템플릿오류 NOT TESTED |
| features/templates/project-save-as-template-button.tsx | compact-form0 유지; retry 부모24px 명시 | menu panel ancestor에 따라 기존 retry도0일 수 있다. 새 wrapper는 의도된 설명→retry 간격을 부모가 명시적으로 소유한다. 실제 템플릿 저장 runtime NOT TESTED |
| features/resources/resource-catalog-admin.tsx | actions24px→0, rowActions 기존0유지 | 실제5폭 after-auth/기존create/password E2E PASS. 중복 button margin!important 제거. parentactions gap7.2px 유지 |
| features/resources/project-resource-workload.tsx | resource-workload-status 기존0유지 | globals statusbutton margin-top0 및 statusgrid gap보존. 상세workload runtime NOT TESTED |
| features/gantt/task-assignment-editor.tsx | assignmentFooter 저장·retry 등 전역24px→0 | assignmentFooter/allocation/assignment 부모 gap이 소유한다. 해당 action의 기존 effective 0을 주장하지 않는다. 상세 할당 runtime NOT TESTED |
| features/gantt/task-logistics-link-editor.tsx | retry 등 전역24px→0 | taskFields 및 dialog/relation group의 부모 gap이 소유한다. 상세 연결 runtime NOT TESTED |
| features/gantt/project-gantt.tsx | 수동ID복사 retry24px→0 부모24px | 기존복사URL동일pattern standalone-actions. SVAR/API 불변. actualGanttIDclipboard runtime NOT TESTED |
| features/gantt/project-task-editor.tsx | footer 기존0 유지; relation/header/confirmation24px→0 | footer/header/일반 button의 기존44px 규칙을 축소하지 않는다. 기존 relation/baseline action의32px 예외도 그대로다. relationSectionActions/relationActions에는 기존 margin0가 없으므로 부모 gap이 간격을 소유한다. 상세 Task Editor runtime NOT TESTED |
| features/gantt/gantt-demo.tsx | 기존24px→0 | gantt-demo-controls flexgap 및 toolbar layout parentgap소유. SVAR/domain 불변, demo runtime NOT TESTED |
| features/projects/create-project-form.tsx | catalog retry24px→0 | form-field/project-form 기존gridgap소유, 기본폼submit primarymargin0. 신규생성은 legacyE2E realAPI PASS, 전체생성 UI NOT TESTED |
| features/projects/project-import-button.tsx | trigger0 유지, wizard action 기본0으로 정합화 | 실제 menu panel/compact-form ancestor에 따라 기존 action도0일 수 있다. 단독 전역값24px을 모든 wizard의 실효값으로 단정하지 않는다. import-dialog-actions flex gap을 유지한다. Importflow runtime NOT TESTED |
| features/projects/project-work-calendar-editor.tsx | action24px→0 | fieldsets/grid gap 및 actionsRow flexgap6/section margin. 간격부족Standalone 별도 발견 없음; 상세calendar runtime NOT TESTED |
| features/projects/project-excel-export-button.tsx | trigger0유지/dialog24px→0 | projectcontext global0, exportdialog actionrow gap. Excelruntime NOT TESTED |
| features/projects/project-readonly-view.tsx | toolbar/filter/dialog 기존0유지; loaderror 부모24px; scope recovery 부모8px | .standalone-actions24 및 .project-scope-recovery-actions8 이관. Workspace 상세scope runtime NOT TESTED |
| features/projects/project-copy-button.tsx | context/compact-form0 유지; retry 부모24px 명시 | menu panel ancestor에 따라 이전 실효값은0/24px이므로 조건부다. 단독 retry의 간격을 부모24px으로 정의한다. 실제 copy error runtime NOT TESTED |
| features/projects/project-settings-dialog.tsx | compact-form 안 catalog retry·password form0→0, 밖 session logout24px→0 | metadata의 project-form compact-form 및 password form descendant 규칙은 margin0를 유지한다. sessionCardActions는 `.sessionCard` 부모의 12px column gap을 유지한다. 실제 설정 dialog runtime NOT TESTED |

전역·module override 전수: globals compact-form, task-confirm-dialog-actions, project-context-actions, project-action-menu-panel, scope-recovery, resource-workload-status, project-filter-toolbar의 명시0는 유지. scope-recovery8은 부모로 이관. project-list.module filterCondition/dateFilter0 유지, noResults .secondary-button localscope은 무효여서4px보존으로 분류하지 않음. resource.module memberFooter/adminAction/dialogAction/rowActions의 margin!important중복만제거; 다른wrap/white-space/gap유지. logistics tabs/filter margin-top0유지. project-master tab/status filter margin-top0유지. TaskEditor footer margin0 유지. relation actions의 margin24→0은 부모 gap 정합화이며 일반44px 및 기존 relation/baseline32px variants는 그대로다. KPI project-logistics-dashboard.module .kpiActionBtn margin-top:auto는 별도class, global secondary소비아님; 변경하지않음. template-card-stats auto역시변경없음. text-link24px유지.


## 검증 이력과 재현

- 처음 로컬 Playwright server startup은 sandbox bind 제한으로 실행 불가였고 승인된 실행으로 진행했다. baseline의 `/tmp` symlink는 Turbopack root 제한으로 실패하여 기준 main 소스를 별도 디렉터리에 archive하고 webpack server로 실행했다. source/version/CSS baseline은 기준 main 그대로다.
- 첫 신규 geometry spec은 Next route announcer도 포함하는 alert selector 때문에 FAIL했다. selector를 `main`으로 제한하여 실제 인증 오류만 검사했다.
- 만료 후 focus assertion 보강에서 물류 로그인 input 복원이 FAIL했다. 기존 microtask가 DOM mount 전에 실행되는 원인을 확인했다. 첫 timer 보정도 실패하여 만료 전용 ref와 authenticated=false/busy=false 이후 effect로 복원하고 기존 초기 focus 정책을 보존했다.
- legacy fixture의 첫 Project POST는 필수 ownerName 누락으로 400을 반환했다. 유효한 기존 fixture owner를 추가했으며 제품 API를 변경하지 않았다.
- legacy dialog를 연 뒤 viewport를 바꾸면 기존 row menu 닫힘 경로에 따라 dialog도 unmount되어 빈 geometry로 FAIL했다. viewport를 먼저 설정한 뒤 매번 실제 dialog를 여는 fixture로 보정했으며 제품 menu/dialog lifecycle을 바꾸지 않았다.
- 실패 기록을 숨기는 retry·실패 무시·gate 완화는 추가하지 않았다. 수정 후 최종 관련 테스트 결과를 아래에 기록한다.

## 원격 검증 경계

사용자 요청 종료점은 PR exact head의 CI 시작 확인이다. `quality`, `e2e`, `docker` 최종 결과는 `NOT TESTED`이며 모니터링하지 않는다. 병합·main CI/GHCR·정식 release·운영 배포·branch 정리·Issue 종료는 이번 범위 밖이다. `release_required=true`, `release_authorized=false`다.


## 최종 Local Fast Feedback

| 검증 | 실제 결과 | 근거 / 제한 |
| --- | --- | --- |
| 관련 Chromium combined run | FAIL: 13 PASS / 1 legacy fixture FAIL, exit 1 | session73011, 36.4s. 공통 인증3·리소스1·물류2·기준정보7 항목은 최종 제품 소스에서 성공. legacy fixture resize 경로만 실패 |
| 보정한 legacy fixture 단독 실행 | PASS: 1/1, exit 0 | session18369, 14.6s. viewport를 먼저 설정하고 dialog를 열도록 fixture만 수정. 그 뒤 제품 소스 변경 없음 |
| 실제 관리자·Project edit token 격리 | PASS: 1/1 | frontend 실행 + qa_docs 독립 재실행 exit0, 1.04s. 정상 own-domain 허용과 모든 cross-domain 거부를 실제 migrated SQLite에서 확인 |
| TypeScript | PASS | frontend 최종 실행 및 Manager가 generated tsconfig 복원 후 `npm run typecheck` 재확인 |
| 변경 관련 ESLint | PASS: 오류0 | 넓은 변경 파일 범위에서 기존 hook 경고5(gantt4/copy1), 마지막 신규 source/test 범위는 경고/오류 없음 |
| version / Markdown / diff | PASS | `npm run version:check`, `node scripts/check-markdown-links.mjs`(117 files), `git diff --check` |

**단일 실행의 14 PASS로 보고하지 않는다.** 제품 소스가 같은 실행의 성공13 항목과 fixture만 보정한 후속 성공1 항목을 구분해 Local Fast Feedback으로 재사용한다. 전체 회귀 PASS는 원격 CI 결과가 필요하다.

실제 combined 실행:

```sh
ISSUE_452_EVIDENCE_DIR=/tmp/issue452-after npx playwright test --config tests/config/playwright.config.ts tests/e2e/admin-auth-layout.spec.ts tests/e2e/admin-legacy-button-spacing.spec.ts tests/e2e/resource-admin-layout.spec.ts tests/e2e/logistics-type-catalog-admin.spec.ts tests/e2e/project-master-admin.spec.ts
```

fixture 보정 뒤 실제 단독 실행:

```sh
ISSUE_452_EVIDENCE_DIR=/tmp/issue452-after npx playwright test --config tests/config/playwright.config.ts tests/e2e/admin-legacy-button-spacing.spec.ts
npx vitest run --config tests/config/vitest.config.ts tests/server/security/admin-session-isolation.test.ts
```

최종 동일 소스에서 전체 관련 항목을 함께 재현하려면 첫 combined 명령을 사용한다. 실제 baseline은 별도 archive의 원본 main 서버와 당시 관측용 spec으로 실행했으며 baseline 검증에서는 신규 presentation 및 expiry-focus 기대값을 적용하지 않았다. baseline3/3 PASS는 원본 측정·기존 경로를 수집한 결과이며 신규 AC PASS가 아니다.

## 실제 화면·치수 증거

Chromium, root16px, 390/768/1024/1440/1920px에서 인증 전후 geometry를 기록했다. 캡처 시 비밀번호 입력은 비어 있고 runtime DB/log/token을 저장하지 않았다. 아래 1440px 수치는 JSON의 실제 측정값이다.

| 측정 | Resource before | Logistics before | Master before | after (3개 공통) |
| --- | --- | --- | --- | --- |
| main 좌측 gutter | 120px | 120px | 120px | 24px |
| header bottom→h1 top | 46px | 106px | 106px | 46px |
| 인증 panel 폭 | 520px | 520px | 768px | 520px |
| password input 높이 | 38px | 38px | 24px | 40px |
| submit 높이 | 40px | 40px | 40px | 40px |
| input/submit top 절대 차이 | 50px(원래 순차 배치) | 50px(원래 순차 배치) | 16px | 0px |
| input 경계 | 1px | 1px | 0px | 1px |

최종 heading section→panel gap16px, panel padding16px/gap12px, mobile gutter16px, 540px 이하 input→submit stack을 실제 assertion으로 확인했다. baseline Master JSON의 `cardPadding`/`cardGap`은 당시 inner form style 측정값이며 card 전체 padding 비교에 사용하지 않는다. `headingBottom:null`도 원래 관측의 한계로 보존한다.

- Resource: [before JSON](evidence/issue-452/before-resource.json), [after JSON](evidence/issue-452/after-resource.json), [after 1440px 화면](evidence/issue-452/after-resource-1440.png).
- Logistics: [before JSON](evidence/issue-452/before-logistics.json), [after JSON](evidence/issue-452/after-logistics.json), [after 1440px 화면](evidence/issue-452/after-logistics-1440.png).
- Master desktop: [before JSON](evidence/issue-452/before-master.json), [after JSON](evidence/issue-452/after-master.json), [before 1440px](evidence/issue-452/before-master-1440.png), [after 1440px](evidence/issue-452/after-master-1440.png).
- Master mobile: [before 390px](evidence/issue-452/before-master-390.png), [after 390px](evidence/issue-452/after-master-390.png).
- 독립 CTA/복사 dialog: [실제 legacy geometry](evidence/issue-452/after-legacy.json). 390/1440px에서 버튼40px·버튼 margin0px·부모24px, Escape/focus 복원을 확인했다.

## 문서·독립 검토

DESIGN/UI_UX_GUIDELINES/PROJECT_UX/TEST_PLAN/실행 계획·소비자 분석·CHANGELOG/package/lock을 최종 source 계약과 동기화했다. ui_ux가 설계 및 구현을 읽기 전용 비교했고 qa_docs가 소스/문서/JSON/화면·실행 결과를 독립 비교 및 실제 token 격리 테스트를 실행했다. 이는 PR 준비 gate이며 원격 full QA 또는 Manager 최종 ACCEPT가 아니다.
