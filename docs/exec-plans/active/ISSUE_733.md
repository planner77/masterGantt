# Issue #733 — 공정&WorkArea 대시보드

## Issue Work Packet

- Issue: [#733](https://github.com/planner77/masterGantt/issues/733), 상위 #723; 선행 #724/#725/#728/#729/#730, 호환 #615/#624.
- baseline_sha: `71b870b75da73f413da54e22e55bb03dc0f5abe7` (main, #730 통합).
- branch: `feat/issue-733-process-dashboard`; 전용 worktree를 사용하고 기존 checkout의 미추적 증거는 보존한다.
- baseline_version: `0.124.0`; candidate_version: `0.125.0`; dependency 불변.
- risk_level: HIGH; risk_reason: 공정 전용 consumer에 더해 #729 등록-only 하위 후보 및 동일 snapshot catalog 보완을 조정한다.
- qa_required: true; qa_method: OWNER_MANAGED; independent_qa: N/A(Owner-managed, 독립 인간 검토 없음); manager_decision: NOT TESTED; MERGE_READY: BLOCKED.
- release_required: true; release_authorized: false. 구현·문서 갱신·리뷰/충돌 해결·PR Full CI 시작까지만 요청되었다.
- documentation_owner: Manager; issue_comment_writer: manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION.
- 비범위: CI 완료 모니터링·병합·main/GHCR·Release/tag·브랜치 정리·Issue 종료, 새로운 계산기·DB·renderer·WBS/Assignment/Target writer, marker-ON.

## 역할과 공통 결함 조정

frontend733은 공정 descriptor/consumer와 전용 Unit/E2E, 기존 renderer/composer의 optional consumer 연결을 소유한다. ui_ux는 읽기 전용 설계, backend733은 기존 #729 API의 등록-only 하위 후보·같은 snapshot의 catalog와 관련 계약/transport·직접/음성 테스트를 소유한다. Manager는 통합·문서·버전·원격 게시를, qa_docs는 실제 분리된 읽기 전용 사전 검토를 담당한다. 서로의 변경을 되돌리지 않는다.

기존 #729는 등록-only 후보를 root에서만 보존하여 공정 아래 작업0 구역/설비/System가 사라졌고 report에 전체 공정/구역 catalog가 없어 단독 조회의 정확 구역 수를 표시할 수 없었다. 전용 consumer에서 임의 계산/가짜 작업을 생성하지 않고 공통 API 소유자와 최소 corrective를 조정한다. 실제 소속과 같은 Task를 공유하는 업무 관계를 구별하고 공통 System을 모든 공정/WorkArea로 배치하지 않는다.

## Design Delta B

기존 Light UI/system font/semantic token, 이름 우선과 상황형 도움말을 재사용한다. 공정 root 고정, 단독 요약과 선택 WorkArea/typed 설비·System/리소스 및 Milestone 교차 예시를 제공한다. 기존 개인 조회 설정을 유지하며 Task/Assignment 범위와 저장된 canonical 원본은 바꾸지 않는다. KPI는 기존 표 열을 늘리지 않고 구성·작업·coverage·full Gate로 구별한다. 기존 Gantt host/Coordinator와 editor를 재사용한다. DESIGN 규범 자체는 N/A이며 화면 세칙은 아래 UX 문서에 반영한다.

## AC_TEST_COVERAGE

- AC1: `tests/features/resources/process-workarea-dashboard.test.ts` 및 `tests/server/resources/issue-733-process-configuration.test.ts`, `tests/server/resources/wbs-dashboard-views-http.test.ts` — Target0 공정 A/B 구역·구역없음·legacy 미매핑, 원본 ID·수량·정확 Task와 구성-only.
- AC2: `tests/e2e/issue-733-process-workarea-dashboard.spec.ts`의 Target0 기능 case와 `tests/features/resources/process-workarea-dashboard.test.ts`의 preset 검증 — 공정 단독, 공정→WorkArea→[설비|System]→리소스, 공정→Milestone→리소스; typed 형제·조회 mutation0.
- AC3: `tests/domain/wbs-task-ledger-acceptance.test.ts`, `tests/domain/wbs-task-ledger.test.ts`, `tests/server/resources/issue-733-process-configuration.test.ts`, `tests/features/resources/process-workarea-dashboard.test.ts` — E10 두 구역/상위10, 동일 Task/Assignment 다중경로 합집합, shared MCS·미배정·미설정·구성-only, 다른 Task 누출0.
- AC4: `tests/e2e/issue-733-process-workarea-dashboard.spec.ts`의 Task 저장/stale/error 및 WorkArea dirty/저장, `tests/e2e/issue-730-view-composer.spec.ts`, `tests/server/resources/issue-733-process-configuration.test.ts`의409 음성 — 동일 원본 편집·취소/dirty/readonly/error·원래 경로·필터·선택 복귀, snapshot 변경/409·Gantt remount0.
- AC5: `tests/e2e/issue-733-process-workarea-dashboard.spec.ts`의5폭/keyboard, `tests/e2e/issue-624-logistics-unified.spec.ts`, `tests/e2e/milestone-dashboard-state.spec.ts`의 readonly, `tests/e2e/issue-719-contextual-help.spec.ts`의 logistics 및 #730 직접6case — 실제390/768/1024/1440/1920px·focus/Escape·긴 이름·내부 overflow·기존 Target/원본 호환. KPI/물류 writer 인접 Unit은 통합12파일 선정에 포함한다.

실행 전 위 항목은 선정 계획이며 PASS가 아니다. 구체적인 케이스/명령/결과는 아래 누적 검증에 기록한다.

## DOCUMENTATION_SYNC

Manager가 실제 구현과 대조하여 갱신한다.

- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/WBS_TASK_LEDGER.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_733.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(기존 시각·WBS 조회 투영·동급 분기 규범을 적용하는 Delta B)
- `docs/LOGISTICS_TARGETS.md`: N/A(기존 Target/member/coverage/상속 저장·호환 계약 불변이며 새 Target 생성 없음)
- `docs/DB_SCHEMA.md`: N/A(schema/migration/Repository 저장 writer 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Calendar·계획공수·Gate 알고리즘 재사용이며 일정 산식 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(개인 조회 spec은 Import 입력이 아니며 parser와 교환 schema 불변)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Import·Copy·Template·Excel writer와 교환 계약 불변)
- `docs/EXCEL_EXPORT.md`: N/A(기존 view spec Excel 미지원 경계를 유지하며 workbook writer 변경 없음)
- `docs/SECURITY.md`: N/A(기존 public-read 및 보호 mutation 권한·Origin/session 계약 불변)
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(기존 단일 Gantt writer와 marker-OFF 정책 적용이며 규범 변경 없음)
- `docs/GANTT_STATE_CONFORMANCE.md`: N/A(기존 적합성 계약 불변이며 실제 적용 증거는 본 Work Packet에 구분)
- `AGENTS.md`: N/A(기존 역할·소유권·문서 검증 지침 적용이며 실행 지침 자체 불변)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 PR CI 시작 단계까지 수행하며 lifecycle 계약 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH·OWNER_MANAGED·Trusted QA·Owner 승인 정책 불변)
- `docs/CI_CD.md`: N/A(Required3/E2E6·workflow·main/GHCR·Release 계약 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 원격 gate와 환경별 검증 분리를 유지하며 CI 시작까지만 수행)
- `docs/GITHUB_OPERATIONS.md`: N/A(canonical Refs·원격 게시·Owner 승인 경계를 재사용하며 운영 계약 불변)

## #720 매뉴얼 인계

`dashboard.process` → [공정과 WorkArea 현황](../../TARGET_RESOURCE_USER_GUIDE.md#공정과-workarea-현황). 이 화면의 preset·KPI·정확 상세·원본 편집/복귀·조회 실패 복구와 전용 Chromium을 추적한다. `/manual` route/전역 아이콘 구현은 OPEN #720 범위이며 이 PR에서 구현했다고 주장하지 않는다.

## 변경 영향·실패 원장 참조

[#730 단일 실패원장](../../ISSUE_730_FAILURE_ANALYSIS.md) 전체 및 최신 F730-011까지 확인했다. 조회 POST 오분류(F730-001), Hook 의존성(F730-002), npm 네트워크(F730-003), 늦은 원본 의도·영수증 경합(R730-001), canonical GET/fixture 준비·가시 영역, 큰 테스트 예산 결합을 구분한다. 직접 E2E 실패 고유7파일(#463/#550/#719/#623/#726/#727/Task Editor)은 다른 이슈의 역사이며 이번 FAIL로 합산하지 않는다. assertion·skip·retry·timeout·필수 gate를 완화하지 않는다.

공정 consumer→기존 WBS renderer/storage/transport→공통 API/원장→정확 상세/editor의 직접 소비자를 검증한다. shared optional seam은 기존 #730 기본 consumer를 음성/인접으로 확인하고 #624 legacy 조회·KPI·#728 oracle을 보존한다. 전체 원격6shard는 exact Head PR CI에 남긴다.

## 누적 검증 및 실패

- Node22.14.0/npm11.10.0, 전용 worktree `npm ci --prefer-offline --no-audit` exit0. dependency 변경 없음.
- gh CLI는 기존 HTTP401, 연결 GitHub API로 원본 Issue·댓글을 조회한다. 인증값을 출력/수정하지 않는다.
- UI 설계 읽기 전용 검토 완료. 실제 구현 비교·브라우저·Unit·PrePR·원격 CI는 실행 전 NOT TESTED.

### 중간 진단과 최종 소스 동결

- #729 구성-only 하위·catalog 누락, 교차 공정 WorkArea의 상위 구성0/하위10 불일치를 공통 소유자와 조정했다. 기존 원장 구성 selector의 명시 합집합·exact 소속 교차만 보완하고 Task selector·DB writer는 바꾸지 않았다. Task0 System은 실제 controls 구역이 없으면 null 구역 조회 상태에 보존한다. 공통 System의 공정 자동 복제는 없다.
- 별도 qa_docs/ui_ux가 원본 이름 누락·공정/구역 구성 범위·큰 단일 브라우저 case 결합을 지적했다. 동일 snapshot의 instance/Milestone 이름을 사용하고 기능/geometry/readonly/Task 저장·음성/WorkArea dirty 저장을 분리했다. 기본 단독[]·기존 개인 설정을 보존하고 교차는 명시 preset으로 제공한다.
- 최초 브라우저 호출은 잘못된 외부 `PLAYWRIGHT_BASE_URL` override로 ECONNREFUSED, 실행기4 FAIL/fixture 본문0이었다. 공식 config와 격리 서버로 다시 실행했다. 다음 실제4case는3 PASS/1 FAIL이며 FAIL은 Gate disclosure 내부의 IdentifierDetails까지 일치한 strict locator였다. 직접 자식 summary로 한정하고 단언은 유지했다. 이후 새 source의5개 케이스 전체를 재실행한다. 최초 결과를 최종 PASS로 덮지 않는다.
- backend 중간5파일67개와 별도 qa_docs5파일63개는 겹치는 집합이다. 당시 동결 통합 `npx vitest run --config tests/config/vitest.config.ts`의 공정 consumer/구성 API·WBS 원장/수용 oracle·view HTTP/model/transport·drill navigation/transport·통합 KPI/호환12파일 **114/114 PASS**, exit0다. 원본 JSON은 `/tmp/issue733-unit-final.json`이며 최종 정제 영수증에 요약한다. runtime source973개 aggregate SHA256 `2f4670606a8585f1c7076865e9ed0c8d01624cceb26056702b86d71d1131d2fc`가 실행 전후 일치했다. src/tests/package 범위이며 Next 생성 설정은 브라우저 후 별도로 원래 bytes를 확인한다.
- 브라우저 중 Next가 tracked next-env.d.ts/tsconfig.json의 생성 경로를 바꾼다. 전용 worktree에서 기존 원본으로 복원한 뒤 정적/PrePR 검증한다. backend의 병행 최종 typecheck는 중단(exit143)했고 후속 scoped lint는 미실행이었다. 이를 제품 FAIL이나 최종 정적 PASS로 전용하지 않는다.

- 추가 W1 반례를 실제 fixture로 재현했다. 주관리 PA 설비가 PB 구역에만 연결되면 PA 상위에는 있으나 모든 하위에서 사라졌다. 구성의 공정/occurrence 한정 null WorkArea를 해당 범위의 소속0으로 보완하고 root WorkArea null의 전체 소속0 및 Task selector는 유지한다. 기존 구성 summary를 후보 판정에 재사용하고 별도 계산기를 추가하지 않았다. 이전114 Unit 소스와 구별하여 새 소스에서 재검증한다.
- 다음5case 시도는1 PASS/1 INTERRUPTED/3 NOT RUN, 직접 중단 exit130이었다. geometry가 locale 정렬의 첫 행(공정 없음)을 A 공정으로 가정한 테스트 오류이며 초기 추정했던 render 경합은 폐기했다. 정확 A 공정 ID 행과 명시적 펼침 버튼 준비 확인으로 교정하고 기존 단언/timeout은 유지했다. 새 후보의5case 전체를 다시 실행한다.
- W1 보완 뒤12파일116 Unit PASS를 확인했으나 이어진 실제5폭의768px 키보드 검사에서 상세 버튼 right775px/표 owner right744px의31px 가림을 탐지했다. 이는 테스트 가정이 아닌 제품 focus 가시성 결함이다. 해당 시도는2 PASS/1 FAIL/1 INTERRUPTED/1 NOT RUN/exit130으로 보존한다. `:focus-visible`인 표 내부 버튼의 경계를 clientLeft/clientWidth+4px inset과 비교해 표 owner의 scrollLeft만0..max로 조정했다. 문서/Gantt scrollIntoView·추가 focus·event 취소는 없다. 기존 focus/scroll 개인 상태 기록을 유지하고 새 소스의 전용5case·인접#730 keyboard를 재검증한다.


### 최종 제품 소스의 직접 수용

- Node22.14.0/npm11.10.0/고정 Playwright Chromium, 공식 config·실제 격리 Next/HTTP/SQLite·workers1/retries0/max-failures0에서 전용 **5/5 PASS**, exit0. 기능27.868s,5폭25.571s,readonly21.160s,Task 저장/stale/error23.411s,WorkArea dirty/저장22.236s; reporter total198.145s에는 별도 fixture 준비/종료가 포함된다. 각 results1, unexpected0/flaky0/skipped0/errors0를 별도 qa_docs가 HTML report의 원본 JSON과 대조했다. 앞선 실패/중단과 합산하지 않는다.
- 390/768/1024/1440/1920px의 document 폭이 viewport와 일치하고6열 header/body 오차0, 좁은 표 내부 scroll과 긴 이름·KPI box를 확인했다.768px focus는685–739px⊂owner24–744px로 이전31px 가림이 해소되었다. Source508 manifest926c76925ad1ca4fea2d6bd5cac075a0f45910a29011b8397bf94ab38d5b7a96를 frontend가 동결했고 전체 runtime manifest973개는 통합 검증에서 다시 대조한다.
- 직접 geometry 원본은 [geometry.json](../../../output/playwright/issue-733/geometry.json)이다. tall element screenshot은 sticky/scroll 캡처로 빈 영역이 포함되어 `/tmp/issue733-raw-root`에 보존하고, 추적 소스 수정 없는 임시 capture probe로 실제 viewport5PNG를 별도 생성한다. probe는 삭제하며 직접5개 PASS와 캡처용1개 실행은 분리한다.

- 초기 작성 중 typecheck의 `member.name` TS2339는 configurationCatalog가 없던 단계의 실제 컴파일 실패였다. 같은 snapshot의 typed instance/Milestone 이름을 제공·소비하여 수정했으며 이후 typecheck PASS와 구분한다.
- 최종 viewport 캡처용 probe는 각각1 PASS(41.4s/35.6s)이며 기능5개 성공 수에 더하지 않는다. 임시 spec 삭제·추적 next-env.d.ts/tsconfig.json 원본 복원·508파일 지문 불일치0을 확인했다. 최신 frontend 자체 Unit3파일13개 및 typecheck/scoped ESLint PASS는 통합 선정의 부분집합이며 별도 합산하지 않는다.

### 최종 통합 선정과 자동 매핑 한계

- 동결 제품/테스트의12파일 **116/116 Unit PASS**, exit0. 전용5개와 별도의 인접9개가 고유14 Chromium 케이스이며 모두PASS/exit0다. 인접9개는 #7306개 전체(지연 의도·5root/개인 설정·원본/역전·5폭/keyboard·Milestone/Resource/WorkArea 취소 복귀·실제 저장), #624 exact legacy 통합1개, #463 readonly1개, #719 logistics5폭1개다. 추가 캡처2회와 이전 source 결과를 고유14에 합산하지 않는다.
- src/tests/package973파일의 시작/종료 runtime SHA256 `83d6e30966426b5fb794d9c2bf6d2482e6c344d8c3fae0d7fba1a3fae386e080` 일치. #463/#719/#730 재실행 생성물31개와 새 partial JSON5개는 `/tmp/issue733-regression-artifacts`에 보존하고 전용 worktree의 baseline bytes로 복원했다. 기존 사용자 checkout은 수정하지 않았다. #733 viewport7PNG와 원본 geometry는 이번 변경에 포함한다.
- typecheck·전체 ESLint(exit0, 기존13warnings/신규errors0)·version0.125.0·test discovery250 Unit files/763 browser cases(root/external cwd 동일)·Markdown276files·diff 검사는PASS다. `npm run build`의 실제 production Webpack build·standalone/runtime-tools도PASS/exit0다. build 뒤 next-env.d.ts/tsconfig.json은 baseline bytes로 복원했다.
- `verify:prepr --mode=fast`와 `--mode=targeted`는 둘 다 **BLOCKED/exit1**, sourceStable=true, UNKNOWN3/missing0/실행steps0이다. 보고서는 `.prepr-reports/issue733-{fast,targeted}/{report.json,SUMMARY.md}`다. 이를 CLI PASS로 바꾸거나 Required3 대체로 사용하지 않는다. 자동 매핑이 모르는 세 경로는 아래 직접 계약·실행으로 수동 추적했으며 도구의 source mapping 자체는 이 Issue에서 변경하지 않는다.

| UNKNOWN producer | 실제 consumer·직접 검증 |
| --- | --- |
| `src/contracts/wbs-dashboard-views.ts` | API report → `wbs-view-transport` → 공정 consumer/기존5root. transport의 catalog 누락/잘못된 processIds 음성, 실제 SQLite view HTTP·전용 구성 테스트, consumer Unit 및 실제 HTTP 전용5/공통6 Chromium |
| `src/features/logistics/project-logistics-unified.tsx` | process만 전용 consumer로 연결하고 equipment/system·legacy UnifiedContent·기존 drill provider 보존. 전용5·공통6 및 legacy #624 exact integration에서 readonly/Task/Assignment/원본 복귀·Gantt/조회 mutation0 검증 |
| `src/server/resources/wbs-dashboard-views-core.ts` | `ResourceDashboardService.queryWbsView` → `createWbsViewProjection`. 정적 직접-import 선택기는 fixture를 경유하는 이 호출을 추적하지 못한다. `tests/fixtures/wbs-dashboard-views.ts`의 실제 SQLite service를 사용하는 전용 구성 테스트와 기존 view HTTP·원장 oracle에서 idle membership·W1/null·wrong-pair·Task/A 교집합·409 및 실제 UI HTTP로 검증했다. 범용 smoke만으로 완료 처리하지 않는다. |

#730의 역사적7개 실패 파일 전체를 새 #733의 전 실패 집합으로 오인하지 않는다. 이번 변경은 공정 consumer/공통 read projection과 table X-focus로 한정한다. #550/#623/#726/#727/Task Editor의 나머지 대형 mutation·시간대/재시작·전체 matrix 및 모든 다른 E2E는 full PR CI에 남긴다. 이들 writer/fixture/timeout 소스는 수정하지 않았고 직접 Task/WorkArea 저장·권한/readonly·snapshot·원본 복귀와 API/domain 호환은 위 선정으로 실행했다. 공식 전체 회귀·hosted6shard·Docker/GHCR·Trusted/Owner는 로컬 결과로 대체하지 않는다.

### 사전 검토와 게시 경계

실제 Manager+frontend733/backend733/ui_ux/qa_docs를 분리 실행했다. 별도 qa_docs의 최종 코드·문서/원본 HTML결과·geometry·화면 대조는 미해결P1/P2 0건이다. 이 사전 검토는 독립 인간 QA나 Owner 최종 승인이 아니다. HIGH/qa_required=true/OWNER_MANAGED, independent_qa=N/A(Owner-managed, 독립 인간 검토 없음), manager_decision=NOT TESTED, MERGE_READY=BLOCKED를 유지한다.

현재 gh write 인증은401이고 연결 Git Data API의 허용된 blob/tree/commit/ref 도구를 사용하는 B 방식을 선택한다. 전체 local tree/부모·최신 main·원격 신규 branch 부재를 인증 조회하고 committed clean source의 `verify-pr-batch` prepare/before/after로 대조한다. API candidate는 author/시간으로 local Head와 달라도 전체 tree 동등성 및 부모를 확인한다. 한 번의 신규 Ref/PR 게시 후 exact Run/attempt·Head/base/test-merge 시작 snapshot만 확인한다. 실행 완료·runner 비용/성공률·Trusted/Owner 승인·main/GHCR·Release·Issue 종료는 NOT TESTED/범위 밖으로 인계한다.

정제된 최종 로컬 근거는 [local-validation.json](../../evidence/issue-733/local-validation.json), 화면은 [390px KPI](../../../output/playwright/issue-733/process-kpi-390.png)·[1440px KPI](../../../output/playwright/issue-733/process-kpi-1440.png)를 참조한다. 실물 touch/스크린리더/최종 수동 UX·운영환경 검증은 NOT TESTED다.

## #733 PR CI 실패 후 재작업 — 2026-10-20

- 최초 [PR #755 / Full CI #3035.1](https://github.com/planner77/masterGantt/actions/runs/39341161717): run 39341161717 / attempt 1, Head 51cfda4b091e520fd083f4d52fc2122010b10a01, base 71b870b75da73f413da54e22e55bb03dc0f5abe7, test merge 40335bedbb3cceb615d774aa5e942595908bd714. Quality/Docker SUCCESS, E2E Shard5 #622 원본 배정 포커스 FAIL, 나머지 5 Shard CANCELLED, QA Final 파생 FAILURE.
- [이슈 전용 누적 실패 원장](../../ISSUE_733_FAILURE_ANALYSIS.md)에 전체 원본과 직접 FAIL·취소·미실행, 원인과 과거 #730/#731 원장 교차 분석, 수정·검증·미검증 경계를 보존했다. 재실패 시 새로운 분석 파일이 아니라 동일 원장의 실행 목록·실패 매트릭스에만 추가한다.
- #622에서 canonical 배정 40% 저장, row/data-detail-state 확인은 PASS였으나 Task Editor 닫힌 뒤 반환 버튼의 keyboard focus가 5초 동안 inactive. 원본 Trace로 내부 RAF의 정확한 실패 타이밍을 확정하지 못했으므로 비동기 상세 재조회 중 조기 focus fallback은 재현 가능한 코드 경로에 근거한 경합 가설로 표기한다. 제품 복원은 같은 detail key/Task·Assignment 가시성과 확인된 ready를 기다리는 bounded 180 RAF로 수정하고 외부 사용자 focus·새 모달/화면 guard 보존.
- [PR #755 Codex P2 리뷰](https://github.com/planner77/masterGantt/pull/755#discussion_r4319896982): 같은 occurrence 안에서 공정 A의 설비/제어 System 하위에 공정 C에서만 연결된 WorkArea가 누출될 수 있다. W1 candidate membership을 정확 processId로 제한하고, 공정 A/C 동일 occurrence에서 새 C-only WorkArea, 설비/제어 System, Task0/Assignment0 음성·양성 회귀를 추가.
- 수정 범위: src/features/projects/project-readonly-view.tsx, src/server/resources/wbs-dashboard-views-core.ts, tests/e2e/issue-622-resource-plan-target.spec.ts, tests/server/resources/issue-733-process-configuration.test.ts, 누적 원장·본 Work Packet·docs/TEST_PLAN.md. #622의 toBeFocused strict assertion/5초 timeout은 변경하지 않고 연속 2 RAF 초점 안정성 검증을 추가. 저장 writer, 권한, CI six-shard/timeout/retries/skip, required gates, 버전 미변경.
- 최종 새 소스의 TypeScript/Vitest/Playwright/Build/Docker 로컬 실행은 이 GitHub Git Data 연동 경로에서 NOT TESTED. 이전 Head의 로컬 116 Unit/14 Chromium PASS는 새 Head 검증으로 승격하지 않는다. 새 정확 Head Required Quality/E2E/Docker, Trusted QA, Owner 최종 승인, merge/GHCR/Finalizer는 미완료. 브랜치 non-force synchronize로 Full PR CI 시작 확인까지만 진행하고 CI 완료 모니터링은 하지 않는다.
