# Test Plan

## Issue #459 — Milestone Stage Gate Epic 통합 회귀

#460~#464의 개별 테스트를 Epic 수용 기준으로 묶어 다음 교차 불변식을 유지한다.

- `tests/domain/milestone-stage-gates.test.ts`: 서로 다른 Milestone의 member Task 사이 Task→Task Dependency만으로 후행 단계의 predecessor/blocked 상태가 생기지 않는다. 명시 Milestone→Milestone Link를 추가했을 때만 Gate predecessor가 생기며, 선행 Milestone 완료 후 Ready가 복구된다.
- Editor→canonical membership→Grid 단계 열/필터→Milestone Dashboard→물류/Resource drill-down은 같은 full Project revision과 effective membership을 사용한다.
- 부분 WBS/물류/Resource/기간 조건으로 화면 대상이나 공수 범위를 제한해도 Ready와 memberProgress의 full-stage E(M)/P(M)는 바뀌지 않는다.
- JSON/Excel/Project Copy/Template/subtree Copy는 explicit membership의 보존·명시적 제외 경계를 검증하며 effective/Ready를 입력 row로 평탄화하지 않는다.
- 완료 단계 소속/Dependency 잠금, legacy mixed Link 보존, stale/401/412/rollback 및 Gantt instance/scroll/tree/scale/selection/fullscreen 보존을 기존 하위 Issue 회귀와 함께 유지한다.

이번 #459 마무리 변경은 runtime/API/DB 알고리즘을 바꾸지 않고 umbrella 문서와 누락된 Dependency 의미 회귀를 보강한다. 공식 판정은 동일 PR head GitHub Actions의 `quality/e2e/docker`이며 CI 시작 전·진행 중은 NOT TESTED다.

## Issue #460 — Stage Gate 회귀

[Milestone Stage Gates](MILESTONE_STAGE_GATES.md)의 검증 파일 목록을 기준으로 explicit/상속/override/clear/빈 Summary/기준 scope 무관 계산, duration 가중률·반올림·canonical 완료·수동 이벤트·predecessor Gate를 검증한다. 실제 SQLite/API는 atomic composite/batch, 일정/WBS/Link/Assignment 불변, FK/Project 격리/unique/invalid type, 401/403/428/412, 오류 rollback, completion status/progress 양 경로, old/new explicit+effective 구조 잠금, CRUD/hierarchy/Link 우회, legacy mixed 보존/신규 금지, no-loss Copy/Template/Excel/Import를 포함한다.

DB 테스트는 schema21→0022에서 원래 Task/status/progress/Link/Assignment/ID/Project revision 불변과 empty membership을 비교하고 신규 DB/FK/restart도 확인한다. 실제 Next API E2E `milestone-stage-gates.spec.ts`는 저장/Ready/완료잠금/안전거부/401와 프로세스 재시작 SQLite 보존을 검증한다. M→M FS/SS/FF/SF signed Lag/N:M/cycle/Manual/근무일은 별도 scheduler 테스트에서 검증한다. 로컬 결과·독립 테스트 Agent·PR CI required quality/e2e/docker 및 운영 환경 결과를 서로 구분하며 미실행은 NOT TESTED다.


## Issue #430 Cut/Reparent Dependency 경계 회귀

- Unit `task-link-scope.test.ts`: source subtree의 internal→internal, external→internal, internal→external, external→external 및 missing Task를 분리해 XOR boundary 판정을 검증한다. 기존 `taskSubtreeHasDependencyLinks`의 Delete/Indent/Outdent 의미는 유지한다.
- Frontend model `task-context-menu-model.test.ts`: internal Dependency source의 cut clipboard는 Paste 가능하고 independently linked anchor도 before/after target으로 사용할 수 있어야 한다. source boundary Link가 있으면 Paste를 차단하며 linked anchor의 child-add capability는 계속 차단한다.
- SQLite service `task-hierarchy-command-service.test.ts`: internal SS/lag subtree의 cross-parent reparent 성공 후 동일 Link ID/endpoints/type/lag 및 revision +1을 확인한다. independently linked anchor 옆 before/after 이동을 허용하고 incoming/outgoing boundary Link는 `UNSUPPORTED_SCHEDULE_STRUCTURE`로 전체 거부/revision +0한다.
- Chromium `project-task-context-menu.spec.ts`: internal Link를 가진 Summary의 Context Menu Cut 활성 및 Ctrl+X → 다른 Summary As child Paste를 실제 HTTP/SQLite로 실행하고 관계 identity를 확인한다. 이후 subtree→outside Link를 추가하면 Cut이 disabled되고 Copy는 계속 enabled인지 확인한다.
- 기존 #335 same-parent linked reorder, #378/#384 Copy internal Link 복제, viewRoot/scope/self-descendant/stale/readonly/mutation-lock 및 Delete/Indent/Outdent/Convert 회귀를 전체 suite에서 유지한다.
- 공식 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker`다. 현재 connector-only 작업 환경에서 로컬 Node/Playwright 실행 증거가 없으면 Local Fast Feedback은 NOT TESTED로 기록하고 원격 CI 결과로 대체했다고 표현하지 않는다.

## Issue #409 Copy ID → Relation Editor 검색 회귀

- Unit `relation-editor-model.test.ts`: 작업명, externalId, taskId exact/partial, trim/case-insensitive 검색과 Summary/self/already-connected 제외 규칙을 확인한다.
- Chromium `project-task-editor.spec.ts`: Alpha Task의 Context Menu `Copy ID`로 canonical UUID를 실제 clipboard에 복사하고 Beta Task Editor → 관계 → 관계 추가에서 Ctrl+V로 붙여넣어 Alpha 후보가 검색되는지 확인한다.
- 후보/선택 UI는 `외부 ID: EDITOR-3`와 canonical `작업 ID: <UUID>`를 구분 표시해야 한다.
- taskId 검색으로 후보를 선택해도 Link POST는 기존 `predecessorExternalId/successorExternalId`를 사용하고 canonical snapshot에 동일 Link가 생성되는지 확인한다.
- 기존 Relation Editor keyboard/Escape/focus/dirty/pending/readonly 및 responsive 회귀는 `relation-dialog-ux.spec.ts`를 유지한다.
- API/DB/Scheduling/Security 계약은 변경하지 않는다. 공식 전체 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker` 결과를 사용한다.

## Issue #367 Gantt Day 밀도·우측 Timeline 동적 확장

- Unit: `timeline-range.test.ts`에서 Day 36px/Week 68px, right-edge pixel threshold, viewport chunk, 짧은 초기 scale buffer와 보존한 future end의 Day/Week 최소 scale width를 검증한다.
- Chromium E2E: `project-gantt-density.spec.ts`에서 Day `cellWidth=36`, Week 68, Grid 480px, 390/768/1024/1440px document overflow 부재를 확인한다.
- `project-gantt-scale.spec.ts`는 Day 숫자-only Header와 #315/#316 Tooltip, Day↔Week identity 회귀를 확인한다. SVAR의 horizontal virtualization은 Week focus·viewport resize 뒤 어떤 구체 Day 날짜 또는 ISO week label이 DOM에 남을지 보장하지 않으므로 특정 날짜/W38 복귀를 강제하지 않고, 동일 instance에서 Day scale은 숫자-only, Week scale은 `Wxx` 형식으로 각각 복원되며 반대 scale cell이 제거되는지 검증한다. 이어 native `scrollTo()`로 Chart를 오른쪽 끝까지 3회 이동하여 매번 `data-gantt-timeline-end`가 증가하는지 확인한다. 각 확장 뒤 Gantt/API instance identity와 non-zero horizontal scroll을 유지하고 POST/PATCH/PUT/DELETE가 발생하지 않아야 한다.
- 구현은 React `end` prop state 갱신을 사용하지 않는다. 고정 start/open end에서 public `resize-chart`의 scale expansion을 사용해 range 확장 자체가 Core store re-init, selection/column/filter reset을 일으키지 않도록 한다.
- #373 scoped view의 `filter-tasks`와 최신 #384 다중 selection, #390 Copy ID Context Menu가 우측 range 확장/scale 전환 때문에 풀리거나 사라지지 않는지 전체 Chromium 회귀로 확인한다.
- canonical Task end 또는 기존 사용자 future end가 Core 재계산 후 더 멀면 public resize path로 최소 end를 복구한다. Scheduling/Calendar/Dependency, Project revision, API/DB는 변경하지 않는다.
- 공식 전체 회귀 판정은 최신 main 정렬 후 동일 PR head의 GitHub Actions `quality/e2e/docker` 결과를 사용한다.

## Issue #390 작업 Context Menu Copy ID 회귀

- Chromium에서 Grid Task/Summary 및 Chart Milestone의 `Copy ID`가 각 canonical `taskId`를 system clipboard에 기록하는지 확인한다.
- Dependency endpoint에서도 활성이고, #384 Task `Copy` 후 `Copy ID`를 실행해도 Paste가 계속 활성화되어 application clipboard/selection이 변하지 않는지 검증한다.
- Copy ID 전후 Project revision 불변, readonly 사용 가능, #373 scoped root child의 정확한 ID를 확인한다.
- #364 호환 계약을 재사용해 modern Clipboard API 권한 거부 시 legacy로 우회하지 않고 수동 복사 dialog를 제공하며, 정확한 ID·전체 선택·재시도 실패·focus 복원을 확인한다. modern API 부재 시 legacy copy는 공통 helper 회귀가 보호한다.
- 새 enabled root action의 keyboard traversal을 갱신하며 기존 Context Menu 회귀를 유지한다.
- API/DB/Scheduling/Security 변경은 없다. 공식 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker`다.

## Issue #364 — 프로젝트 링크 자동 복사 HTTP 호환 회귀

- Unit: modern Clipboard API 성공 우선, modern API reject 시 legacy 미호출, modern API 부재 시 legacy copy 사용, 두 경로 실패 시 수동 fallback 진입 조건을 검증한다.
- Chromium: Project Workspace에서 `navigator.clipboard`가 없는 환경을 주입하고 같은 keyboard/click activation의 legacy copy로 canonical URL이 자동 복사되는지 확인한다. 성공 시 수동 모달은 열리지 않고 navigation/mutation/Gantt geometry·instance가 변하지 않아야 한다.
- Production transport: `plain.gantt.test` 실제 production HTTP origin에서 `isSecureContext=false` 및 modern Clipboard API 부재를 확인한 뒤, `execCommand`를 mock하지 않고 링크 복사 버튼을 눌러 브라우저의 실제 copy event가 canonical URL 선택값으로 발생하고 성공 안내/수동 fallback 부재를 검증한다. localhost secure-context 예외로 대체하지 않는다.
- 권한 보호: modern Clipboard API가 `NotAllowedError`로 거부되면 `document.execCommand("copy")`를 호출하지 않고 기존 수동 복사 모달을 제공한다. 이후 modern API 복구 시 재시도 성공과 focus 복원을 확인한다.
- 기존 `project-links-persistence.spec.ts`의 실제 Chromium Clipboard API read/write 검증은 유지해 legacy mock 검증과 실제 modern clipboard 증거를 구분한다.
- URL 생성은 기존 APP_BASE_URL/publicId 계약을 그대로 사용하며 API/DB/revision/auth/scheduling 변경은 없다. 공식 전체 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker` 결과를 사용한다.

## Issue #384 — 다중 선택 Task Copy/Paste

Selection Unit은 canonical preorder·ancestor/중복 제거·empty Summary·single/toggle/visible sibling range·다른 parent fallback·unknown/stale ID·collapse 숨김/선택 보존·canonical 불변을 확인한다. command/scope는 Copy taskIds·single Cut 분리와 모든 source/anchor subtree 경계를 확인한다.

실제 SQLite/HTTP 통합은 여러 root before/after/child·WBS 2/10 순서·FS/SS/FF/SF signed lag/lead·경계 Link 제외·metadata/Baseline·원본 불변·ancestor union·Assignment·500 source/5000 Task·rollback·Origin/session/If-Match/body limit·DB reopen을 검증한다. DB reopen과 Node 서버 restart는 별도 증거이며 서로 대체하지 않는다.

Chromium 신규 `project-multi-task-copy-paste.spec.ts`는 역순 checkbox→selected row Copy→Summary child Paste·새 endpoint·revision +1·Editor 관계·same instance·column width/scale/collapse/scroll 보존·reload 및 동일 DB 실제 서버 재시작과 390/768/1024/1440px screenshot/overflow를 확인한다. modifier/Shift checkbox/Space/Copy/Paste/Escape는 이중 toggle·inline 간섭 없이 확인한다. 선택 상태에서 Day·Week header Escape는 Tooltip을 우선 닫고 Task 선택을 유지한다. 기존 DnD/rename/double-click/scoped/readonly/pending/412 회귀는 관련 spec을 사용한다.

Review thread 보완으로 selection checkbox focus에서는 task mutation shortcut을 Copy/Paste(`Ctrl/Cmd+C,V`)로 한정하고 Cut/Delete(`Ctrl/Cmd+X,D`, Delete/Backspace)는 입력 guard를 우회하지 않도록 한다. Shift+F10/ContextMenu로 작업 메뉴를 연 경우 닫을 때 실제 checkbox trigger로 focus가 복귀하는지 Chromium 회귀에서 확인한다.

CI #1540.1의 shard 3/4는 #384 기능과 무관한 `project-resource-calendar-exceptions.spec.ts`의 conflict summary focus 한 건만 실패했다. 원인은 `setServerConflict()` 직후 단발성 rAF가 React commit 전에 실행될 수 있는 timing race였으며, serverConflict DOM commit 후 effect focus로 보완한다. 기존 E2E의 conflict summary focus·aria-invalid/aria-describedby·수정 버튼 focus 이동 계약은 그대로 재사용한다.

전문 Agent는 read-only patch를 작성하고 Manager가 승인 경로로 편집·실행했다. 이전 0.66.0 통합 후보에서 관련 Unit/SQLite/HTTP·관계·Week Tooltip 89개 PASS와 Chromium 집중 24개 PASS를 확보했다. PR CI #1515.1에서는 quality/build/typecheck/policy/docker가 PASS였고 Chromium shard 2/4·3/4에서 context-menu DOM 교체 회귀와 구 selection 기대를 확인해 보완했다. PR CI #1535.1은 quality/build/Vitest/TypeScript/ESLint/policy/docker와 Chromium shard 1/3/4가 PASS했고 shard 2/4에서 fullscreen 회귀 테스트가 가상화로 화면 밖인 `Stable leaf` DOM을 즉시 조회해 1건 실패했다. 제품 selection 상태는 `Scroll task 8` 및 `선택 1개`로 확인되므로, 현재 main 0.67.2 기준 재정렬 head에서는 스크롤 복원 뒤 `Stable leaf` 비선택을 검증하도록 테스트 순서를 보완하고 전체 PR CI를 다시 판정한다. 초기 FAIL·수정 근거·4폭 캡처·실제 서버 restart는 [실행 기록](exec-plans/active/ISSUE_384.md)에 구분하며 touch device/screen reader는 별도 미실행이다.
## Issue #331 Resource 관리 생성 폼 overlap 회귀

- Release #91 회귀 보완: initial Project loading 중 storage listener 설치 전에 발생한 revision announcement는 listener 등록 후 durable localStorage revision을 pending revision에 병합하고, authoritative follow-up GET이 전진하지 않는 stale durable target은 폐기한다. `project-revision-sync.test.ts`와 기존 #373 loading/cross-tab E2E가 이 계약을 고정한다.
- Finalizer recovery: exact main CI가 PASS여도 immutable formal release가 completed non-success로 반복 실패한 target은 later same-Issue corrective merge가 exact main CI PASS이고 validation scope가 동등 이상일 때만 supersede한다. release가 진행 중이거나 corrective release 자체가 실패한 경우에는 supersede하지 않는다. `scripts/verify-issue-lifecycle.py`가 intervening Issue order와 cleanup debt 전이를 검증한다.
- Chromium `tests/e2e/resource-admin-layout.spec.ts`에서 관리자 로그인 후 390/768/1024/1440px별 각 추가 버튼으로 연 생성 dialog의 form/body와 control bounding box를 비교해 상호 overlap이 없고 각 form의 수평 bounds 안에 들어오는지 확인한다.
- 같은 viewport 반복에서 document-level horizontal overflow 부재를 유지하며 390px과 1024px 결과 screenshot을 Playwright output에 남겨 모달 생성 입력의 containment 증거로 사용한다.
- 신규 리소스 폼의 이름 → 코드 → 개발자 등급 → 전역 역할 native Tab 순서 (#453)를 확인한다. 개발자 등급 값 생성/편집과 API payload는 기존 `resource-developer-grade.spec.ts`를 함께 회귀 실행한다.
- Grid DnD 직후 inline rename의 첫 클릭이 유실되지 않도록 DOM editability와 SVAR event guard ref가 같은 commit의 layout phase에서 동기화되어야 하며, 현재 main의 강화된 `project-grid-reorder-persistence.spec.ts` helper/시나리오를 그대로 보존한다.
- Resource Catalog API/auth/session/revision/`If-Match` 계약은 변경하지 않으며 관련 기존 E2E/서버 테스트와 PR exact head의 GitHub Actions `quality/e2e/docker` 결과를 공식 판정 근거로 사용한다.

## Issue #366 Resource 추가 코드·개발자 등급 overlap 직접 회귀

- #366의 현상은 #331에서 이미 수정된 동일 Resource Catalog 생성 폼 overlap 문제와 범위가 중복된다. #453부터 생성 입력은 compact dialog로 이동하며 #366 코드/등급 containment 인수 기준은 같은 Chromium 회귀에 유지한다.
- `tests/e2e/resource-admin-layout.spec.ts`에서 코드 입력에 허용 최대 길이인 64자를 채우고 개발자 등급을 선택한 상태로 390/768/1024/1440px을 순회한다.
- 각 viewport에서 기존 direct child overlap/form bounds/document overflow 검사에 더해 실제 `코드 input`과 `개발자 등급 select`의 bounding box가 서로 겹치지 않고 resource form의 수평 bounds 안에 있는지 직접 확인한다.
- 390px과 1024px에서는 `issue-366-resource-code-grade-layout-*.png` screenshot evidence를 남긴다. 이름 → 코드 → 개발자 등급 → 역할 Tab 순서와 developer grade option/API 회귀는 그대로 유지한다.
- Resource Catalog API/DB/auth/session/revision/If-Match, Scheduling, SVAR 계약은 변경하지 않는다. 사용자 승인에 따라 이 회귀 고정을 0.70.1 PATCH release로 게시하며, 공식 회귀 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker` 결과를 사용한다.

## Issue #416 Gantt Week Header 근무 가능 일수 상시 표시

- Unit: #316의 canonical `workingDays` helper 결과를 그대로 입력으로 사용해 persistent Header formatter가 일반 주 `5일`, 전체 비근무 `0일`, weekend WORKING override `6일` 등 `N일` 문자열을 만드는지 검증한다. 별도 근무일 산식은 추가하지 않는다.
- Chromium E2E: W38 일반 주의 Header `5일`과 Tooltip `근무일: 5일`, W39 예외 주의 Header `4일`과 Tooltip `근무일: 4일`이 동일한지 확인한다. 기존 공휴일 상세/WORKING 이름 제외/aria/viewport Tooltip 계약을 함께 회귀한다.
- Week `cellWidth=68`을 유지하고 390/768/1024/1440px에서 app-owned secondary label의 bounding box가 해당 Week cell 내부에 머무르는지 실제 browser geometry로 검증한다. Day↔Week round-trip 뒤 Week label 재생성, Day cell 미적용, 동일 Gantt/API instance와 mutation 0회를 확인한다.
- API/DB/Scheduling/Calendar 저장 계약은 변경하지 않는다. 공식 전체 판정은 최신 main 기반 동일 PR head의 GitHub Actions `quality/e2e/docker` 결과를 사용한다.

## Issue #316 Gantt Week Header 근무일·공휴일 Tooltip

- Unit: SVAR Sunday Week anchor를 ISO Monday로 정규화한 class/date key round-trip, 일반 주 5일, 복수 named NON_WORKING, 이름 없는 NON_WORKING, weekend WORKING override, legacy holidays fallback, W53→W01 경계를 검증한다.
- Chromium E2E: W38 일반 주 hover, W39 공휴일 주 focus, 실제 근무일 수, 복수 이름, WORKING 이름 제외, `aria-label`/`aria-describedby`, resize 후 live Week cell viewport clamp를 검증한다.
- 기존 #315 Day Tooltip hover/focus/viewport 계약, #314 숫자-only Day Header, #51 ISO Week, 44/68px cellWidth, Day 주말 강조, Gantt/API instance identity를 같은 spec에서 회귀 검증한다.
- 이전 main 기준 CI #1426의 quality/e2e/docker 전체 PASS를 참고하되, 최신 main 재정렬 head에서 전체 PR CI를 다시 판정한다.
- API/DB schema 및 Scheduling 저장 계약은 변경하지 않는다. 공식 판정은 동일 PR head SHA의 GitHub Actions `quality/e2e/docker` 결과를 사용한다.
- 상세 계약은 `docs/ISSUE_316_WEEK_HEADER_TOOLTIP.md`를 따른다.


## Issue #375 Summary Task bar 두께 회귀

- Chromium E2E는 동일 날짜 범위의 Summary와 일반 Task를 함께 렌더하고 SVAR root bar의 x/width가 동일한지 확인한다. Summary root 자체의 높이는 interaction hit-area로 유지하고 `::before` visual body와 progress wrapper만 일반 Task 높이의 약 60%(허용 55~70%)인지 geometry로 측정한다.
- Summary visual body의 수직 중심과 root/row 중심이 일치하고, visual body의 좌우 inset이 없어 #142의 inclusive cell range를 축소하지 않는지 확인한다.
- 얇은 body 바깥의 투명한 Summary root 영역을 우클릭해 기존 Context Menu가 열리는지 확인하여 pointer hit-area가 visual height로 축소되지 않았음을 검증한다. link marker는 root 50% 중심을 그대로 사용한다.
- 390/768/1024/1440/1600px, Day→Week, native fullscreen에서 동일 60% 비율과 Gantt instance 보존을 확인한다. readonly에서도 동일 시각 규칙을 사용한다.
- 일정 없는 Summary는 #345와 동일하게 `.wx-bar`가 생성되지 않아야 하고 Milestone에는 Summary pseudo body를 적용하지 않는다.
- API/DB/Scheduling/Calendar/Dependency 변경은 없다. 공식 전체 회귀 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker` 결과를 사용한다.

## Issue #373 / #399 Summary subtree Workspace 범위 탭

- Unit: `task-subtree-scope.test.ts`의 기존 진입/escape guard와 함께 #418 `native-task-add-intent.test.ts`에서 full-project Header root add, scoped Header→active root immediate child, scoped root/descendant Task·Summary Row child를 허용하는지 검증한다. Milestone/out-of-scope/missing/invalid scope와 Row `before/after`는 거부한다. 일반 Task Row child는 기존 서버 `convertParentToSummary: true` 경계로 연결하며 `project-task-adapter.test.ts`의 virtual root `parent=0` 회귀도 유지한다.
- #399 Chromium: `최상위로 열기 (작업공간 탭)` 실행 후 browser page 수가 증가하지 않고 현재 일정 View에 전체 프로젝트+Summary tab이 생기는지 확인한다. 두 Summary를 열어 중복 방지, active `rootTask`, close fallback, reload bootstrap을 검증한다.
- Gantt/state: scope 전환 전후 `data-project-gantt-instance` 및 API instance 동일성을 확인하고 full/Summary scope의 search/filter state가 서로 덮어쓰지 않는지 검증한다. #367의 timeline 동적 확장 end도 scope 전환으로 축소/초기화되지 않아야 한다.
- Keyboard/반응형: ArrowLeft/Right/Home/End, Summary Delete/close, focus-visible을 검증한다. 390/768/1024/1440px에서 tablist `overflow-y:hidden`, 내부 수평 overflow, document-level overflow 부재를 확인한다.
- Native add / continuity 회귀: #418 Chromium은 실제 SVAR Header `+`, scoped root Row `+`, descendant Summary Row `+`, 일반 Task Row `+`를 클릭한다. Header는 active root immediate child, Row는 대상 child로 기존 `POST /tasks`를 정확히 한 번 실행하고 일반 Task 첫 child는 Summary로 원자 전환되어야 한다. Milestone은 `aria-disabled=true`, mutation 0, 명시적 feedback을 유지한다. `requestAnimationFrame` probe에서 성공 add 중 Grid row count가 0이 되거나 Gantt frame이 disconnect/hidden되어서는 안 되며 horizontal scroll, focus, active scope tab, `data-project-gantt-instance`와 API instance를 보존한다. canonical Core sync 뒤 `filter-tasks`를 적용해 중간 visible-set mismatch를 허용하지 않는다. scope 밖 target, missing/readonly/mutation-lock 및 hierarchy escape는 계속 fail-closed 한다. #412 Resource 역할 UI, #409 Relation Editor ID 검색, #416 Week Header geometry/Tooltip 회귀도 함께 보존한다.
- #373 direct deep-link/cross-tab: `?rootTask=` URL을 명시적으로 별도 browser page에 열어 same edit session과 scope를 복원하고 scoped PATCH/revision 뒤 original tab이 storage announcement→canonical GET으로 최신 상태에 수렴하는지 유지한다.
- burst/loading: in-flight GET 중 N+1 announcement 및 receiver initial loading 중 N+1 mutation의 기존 cross-tab 회귀를 유지한다. 내부 Workspace scope tab 자체는 이 storage roundtrip에 의존하지 않는다.
- Scope/canonical: subtree AND search/filter, hidden ancestor 물류 inheritance, full canonical Task/Link context, 빈 root 유지, missing/type-changed invalid 복귀, hierarchy Context Menu/shortcut/DnD guard를 유지한다.
- Popup 회귀: 정상 `최상위로 열기` 경로에서 `window.open`/popup blocker 의존과 “새 탭을 열 수 없습니다” 안내가 없어야 한다.
- API/DB/Scheduling/Security: 새 endpoint/migration/algorithm/auth 모델 없음. 기존 Project GET, Task/Link mutation, edit session/Origin/strong If-Match/revision/canonical snapshot을 재검증한다.
- 공식 전체 판정은 동일 PR head GitHub Actions `quality/e2e/docker` 결과를 사용하며 CI 시작 전 PASS를 주장하지 않는다.

## Issue #378 Subtree Copy 내부 Dependency 회귀

- Unit(UI capability): linked Task에서도 Copy와 same-parent Move Up/Down을 허용하고 copy clipboard의 linked anchor before/after Paste를 허용한다. 같은 anchor의 Add/Indent 및 parent를 바꾸는 cut clipboard Paste는 기존 fail-closed를 유지한다.
- SQLite service: Summary subtree의 internal Dependency만 새 Task endpoint로 복제하고 external incoming/outgoing Link는 제외한다. Link ID uniqueness, FS/SS/FF/SF·lag/lead 보존, parent/sibling shape, revision +1 및 원본 불변을 검증한다.
- Scheduling: external incoming 제약이 제거된 copied Auto leaf가 requestedStart 기준으로 앞당겨지고 internal Dependency lower bound는 계속 적용되는지 검증한다. Summary 파생과 Baseline 불변을 함께 본다.
- Chromium E2E: linked Task의 Copy 메뉴 활성화, linked target의 Paste > Below 성공, 원본 Link 유지와 단일-task Copy의 외부 Link 미복제를 실제 API persistence로 확인한다. 기존 #104 unrelated-task capability 회귀도 함께 유지한다.
- Resource assignment가 있는 subtree의 Copy 거부, Cut/reparent/Indent/Outdent/Delete/Convert guard, child Paste의 linked leaf anchor 보호는 회귀 범위다.
- 공식 전체 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker` 결과를 사용한다. PR CI 시작 확인과 최종 PASS는 구분한다.


## Issue #368 Task Editor 요청 종료일·기간 양방향 계산

- Unit: Project Effective Calendar를 그대로 사용하여 duration→requestedEnd, requestedEnd→duration의 양 끝 포함 근무일 계산을 검증한다. 주말, NON_WORKING 공휴일, WORKING 주말 예외와 Auto 비근무 requestedStart의 다음 근무일 정규화, Manual 비근무 시작 오류, 잘못된/역순/비근무 요청 종료일 및 1~10,000 duration 경계를 포함한다.
- Model/command: 마지막 명시 입력 기준(duration/end)을 유지해 requestedStart 변경 시 반대 필드만 재계산하고, UI-only requestedEnd가 dirty source나 PATCH whitelist에 포함되지 않으며 저장 payload는 기존 start(requestedStart 의미)+duration만 사용하는지 확인한다.
- Chromium E2E: 작업 정보에서 기간 변경 즉시 요청 종료일 갱신, 요청 종료일 변경 즉시 기간 갱신, 공휴일 종료 입력의 field-level aria-invalid/aria-describedby 및 mutation 0회, 수정 후 저장 성공과 재오픈 재도출을 검증한다. Dependency-linked Auto Task의 요청/적용 일정 분리, Manual conflict, Summary readonly, Milestone duration=0 회귀를 기존 Editor 시나리오와 함께 유지한다.
- Responsive/Accessibility: 390/768/1024/1440px에서 요청 시작일·기간·요청 종료일이 content-aware 3열 또는 1열로 재배치되고 dialog/document unintended horizontal overflow가 없으며 keyboard-only 입력/저장과 자동 갱신 중 focus 보존을 확인한다.
- API/DB: 새 persisted requestedEnd 필드와 migration은 추가하지 않는다. 기존 Task PATCH, edit session, Origin, strong If-Match/revision, canonical snapshot과 401/412/422/5xx/network 초안 보존을 유지한다.
- 공식 전체 회귀 판정은 최신 main 정렬 후 동일 PR head의 GitHub Actions quality/e2e/docker 결과를 사용한다. PR CI가 시작되기 전에는 원격 PASS를 주장하지 않는다.

## Issue #361 Workflow 실행 추적 회귀

- 정적 contract: `ci.yml`, `issue-lifecycle.yml`, `release-finalizer.yml`, `release-image.yml`에 각각 목적에 맞는 `run-name`이 있고 `github.run_number`/`github.run_attempt`로 재실행을 구분하는지 확인한다.
- PR trace: canonical `Refs #361`, `ci/issue-361-...` branch, `[Issue #361]` 또는 호환 제목이 정확히 하나의 같은 Issue를 가리키면 PASS하고, 제목/branch/body가 다른 Issue를 가리키거나 제목에 추가 Issue 번호가 섞이면 FAIL해야 한다.
- PR metadata edit: `pull_request`의 `edited` activity가 CI를 새로 실행하여 이미 green인 동일 head SHA라도 수정된 title/body를 다시 검증해야 한다.
- Dependabot: 작성자=`dependabot[bot]`, 동일 저장소, `dependabot/` branch의 세 조건이 모두 맞는 자동 PR만 Issue trace 예외로 통과하고, 조건 일부만 모방한 PR은 FAIL해야 한다.
- Main trace: merge commit message에서 PR 번호와 단일 Primary Issue를 식별하고, 비-PR main push는 mutation identity를 추론하지 않은 채 fallback 표시를 사용한다.
- Lifecycle/Finalizer: Lifecycle 표시명은 input의 Issue/PR/operation을 직접 사용하고 Generic Finalizer는 triggering Main CI의 `display_title`을 계승해야 한다.
- Release trace: `issue_lifecycle.py`가 `release-image.yml` dispatch에 `inputs[issue_number]`, `inputs[pr_number]`을 전달하고 Release 표시명이 Issue/PR/tag/run attempt를 포함해야 한다.
- 불변식: workflow `name: CI`, required check 세 항목, trigger/permission/concurrency, exact merge SHA, release authorization와 GHCR digest gate는 변경되지 않아야 한다.
- 공식 원격 증거: PR 생성 후 Actions 목록의 PR CI 표시명에 Issue #361/PR 번호/run attempt가 실제로 노출되고 quality/e2e/docker required checks가 기존 이름으로 실행되는지 확인한다.

## Issue #315 Gantt Day Header 요일·휴일명 Tooltip

- Unit: date-only weekday locale 변환, SVAR day scale CSS class/date key round-trip, 일반 weekend, named NON_WORKING, 복수 이름 dedupe/order, WORKING 제외, legacy holidays fallback을 검증한다.
- Server: 동일 Project/date/dayType의 복수 persisted 이름이 Scheduling effective exception 하나를 유지하면서 canonical `ProjectCalendarDto.exceptions[].names`에 모두 보존되는지 검증한다.
- Chromium E2E: Day Header 일반 평일 hover, 복수 named holiday hover, named weekend focus, focus 중 다른 셀 hover 후 pointer 이탈 시 focus Tooltip 복귀, viewport resize 시 fixed Tooltip 재배치, WORKING override 이름 제외, Day→Week 시 day target/Tooltip 제거를 검증한다.
- 기존 #314 숫자-only Header, #51 ISO Week, 주말 강조, Day/Week cellWidth, Gantt/API instance identity, Chart interaction 계약은 유지한다.
- Local Fast Feedback은 현재 실행 환경의 github.com DNS 해석 실패로 BLOCKED이며, 공식 전체 회귀 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker` 결과를 사용한다.
- 상세 설계와 날짜/접근성 계약은 `docs/ISSUE_315_DAY_HEADER_TOOLTIP.md`를 따른다.

## Issue #356 CI 비용 선택 실행 회귀

- 일반 UI/feature PR은 Docker candidate/runtime smoke를 유지하되 image/runtime 구조 변경이 없으면 관찰용 baseline image rebuild를 생략한다.
- PR transport smoke는 deploy/security/http/auth 관련 경로에서만 실행하며, main push와 manual CI에서는 항상 실행한다.
- `.github/workflows/ci.yml` 또는 `.github/actions/**` 자체 변경은 두 선택 검증을 모두 실행하여 routing 변경을 자기 검증한다.
- 프로젝트 인증·세션 handler(`src/server/projects/**`) 변경도 transport smoke 대상이어야 한다.
- Issue #118 before/after evidence는 manual-only historical evidence이며 일반 PR에서 별도 runner를 시작하지 않는다.
- Next.js 보안 patch 뒤 production dependency audit이 0 critical로 통과하고 `@next/env`와 `next`가 동일 exact patch 버전으로 고정되는지 확인한다.
- transport smoke의 최초 GET navigation은 일시적 network/error page에 한해 readiness 확인 후 1회만 재시도하고 mutation은 자동 재시도하지 않는다.
- E2E shard는 6-way 및 `workers: 1` 격리를 유지하며 외부 OS dependency mirror 지연을 허용하기 위해 timeout만 25분으로 둔다.
- `tests/scripts/test-config-layout.test.ts`와 `tests/scripts/deployment-layout.test.ts`가 위 workflow/dependency contract를 고정한다.
- 공식 전체 회귀 판정은 최신 main 재정렬 후 동일 PR head의 quality/e2e/docker 결과를 사용한다.

## Issue #345 빈 Summary 검증

현재 정책은 빈 Summary 생성·마지막 child 삭제/이동 성공이다. 아래 W24/#31/#300/#344의 당시 `EMPTY_SUMMARY_NOT_ALLOWED` 검증은 역사적 근거이며 현재 acceptance를 대체하지 않는다. Leaf 날짜 필수·Summary Dependency 금지·401/Origin/If-Match/412·원자성 보호는 유지한다.

- `project-task-adapter.test.ts`: UI custom type 영폭 좌표의 유효성, 원본 null DTO 불변성, Renderer 날짜/진척 역전송 거부와 이름-only 변경.
- `project-search-filter.test.ts`: 이름/type 검색, 미산정 날짜·진척·기간의 직접 매칭 제외.
- `project-empty-summary.spec.ts`: 설치 Core 2.7.3 실제 Grid 행과 bar wrapper 0개, 전체 미산정 중첩 Summary의 no-bar/`—`/readonly 생성 차단.
- `project-empty-summary-persistence.spec.ts`: 실제 SQLite/API Root Summary 이름-only payload와 null canonical, 390/768/1024/1440px overflow·화면 근거, 첫 child/마지막 child 2회 전환, 같은 Core API instance/scale/재조회 보존.
- `project-task-delete-context.spec.ts`: #344 6가지 실패 복구는 현재도 유효한 Dependency409/401/412/network 주입을 사용하며 앞선 성공 삭제·Tree/scroll/scale/instance 보존을 검증한다. fault injection은 실제 서버 오류 발생 근거와 구분한다.

초기 browser probe의 날짜 없는 native Summary는 Core parse 예외로 FAIL, 날짜 없는 custom type은 no-bar 실패였다. [승인된 Renderer 전용 adapter](PRO_FEATURE_MATRIX.md#issue-345-빈-summary-core-273-표현)는 가짜 날짜를 canonical에 저장하거나 DOM bar를 숨기지 않는다. 최초 실제 persistence test는 test 비밀번호가 12자 상한을 넘어서 프로젝트 생성 전 validation으로 FAIL했고, readonly fixture assert는 fixture의 기본 편집 session을 끄지 않아 FAIL했다. 두 fixture를 수정했으며 제품 회귀와 구분한다. 로컬 최종 결과는 Issue/PR에 기록하며 원격 CI 완료 전 `quality/e2e/docker`는 NOT TESTED다.

CI 시작 증거는 exact PR head SHA, run ID/URL, 실제 실행 제목의 `Issue #345`를 함께 확인한다. 기존 Workflow name `CI`, required `quality/e2e/docker` check 식별자와 policy gate는 유지한다. 실행 시작 확인은 최종 원격 회귀 PASS를 의미하지 않으며 이번 요청에서 CI 모니터링·병합·릴리스는 수행하지 않는다.

로컬 실제 결과(2026-10-01): 관련 Unit 5 files / 80 tests PASS. Chromium 후속 21 tests(빈 Summary 3 + 기존 Editor 18) PASS, #344 recovery 6 + subtree 1 PASS. 추가 실제 초기 빈 프로젝트→Summary 생성 직후 Grid 이름 편집은 초기 columns editor가 빈 Task map을 캡처하여 FAIL했다. current ref를 읽는 editor 자격 판단으로 수정했고 긴 한국어 이름 저장·4폭 캡처·keyboard Enter 생성·nested collapse/expand·last child Outdent까지 강화한 최종 persistence 1 test PASS(9.4초, 전체 실행 28.1초). mock Core 2 tests도 PASS다. 관련 변경에서 실제 실행한 범위이며 전체 원격 회귀 PASS는 아니다. 시각 근거는 `output/playwright/issue345-empty-{390,768,1024,1440}.png`와 `output/playwright/issue345-nested-1440.png`다.

독립 UX 검토에서 null Editor의 초기 schedule dirty 비교가 빈 문자열과 null을 다르게 취급해 저장 안내를 잘못 표시함을 확인하고 normalize했다. 최종 persistence 시나리오는 기간·진척 `—`, 잘못된 저장 안내 없음, Escape 닫기도 검증한다. columns dependency 정리 중 captured canonical map 갱신을 제거하면 last child Outdent 후 Core bar가 남는 FAIL이 발생했다. `tasksById`를 읽는 canonical Grid getter와 공개 `set-columns` 동기화를 유지하도록 수정했으며 최종 persistence 1 test PASS(7.2초, 전체 실행 19.4초), 관련 Unit 80 tests PASS다. 이 변경에서 새로 발생한 실패를 이전 PASS로 숨기지 않는다.

CI #1381은 quality/audit/build/Docker 및 Chromium shard 1/3/4가 PASS하고 shard 2/4의 `project-empty-summary-persistence.spec.ts` 1건만 실패했다. API/DB에서는 Outdent 후 nested Summary가 `start=null`로 정상 전환됐지만 Core bar가 남았다. 원인은 #1376 stale Grid 보완에서 getter를 latest ref로 바꾸면서 `columns`의 `tasksById` dependency까지 제거해 public `set-columns` refresh trigger가 사라진 것이다. getter는 latest ref를 유지하고 dependency만 복원해 stale Grid와 empty-Summary bar 제거 요구를 동시에 만족하도록 한다. CI #1381 실패는 PASS로 재사용하지 않는다.

## Issue #330 물류 유형 관리 화면 정렬·상태 필터·밀도 개선

- Chromium E2E는 설비 유형/시스템 유형 전환 버튼의 `aria-pressed`와 동일한 control 높이를 확인하고, 전체/활성/비활성 필터가 이미 조회한 catalog snapshot에서 client-side로만 동작하여 추가 GET·mutation·catalog revision 변경을 만들지 않는지 검증한다.
- active/inactive가 혼재한 설비 fixture에서 필터 결과를 확인하고, 같은 비활성 필터를 유지한 채 시스템 유형으로 전환했을 때 0건 empty state를 표시하는지 확인한다.
- 390/768/1024/1440px에서 유형명/코드/정렬/유형 추가 control의 bounding box가 서로 겹치지 않고 document-level unintended horizontal overflow가 없는지 geometry로 검증한다.
- 목록 행은 compact padding으로 동일 viewport의 정보 밀도를 높이되 기존 이름 수정/활성·비활성 전환 버튼의 조작성, 관리자 인증/session, If-Match/catalog revision/stale 계약은 유지한다.
- DB/API/Scheduling/SVAR 계약은 변경하지 않는다. 공식 전체 회귀 판정은 동일 PR head의 quality/e2e/docker 결과를 사용한다.

## Issue #314 Gantt 일 단위 Header 숫자 표시

- Unit: `formatGanttDayOfMonth`가 1/9/10/22/31을 각각 숫자 문자열로 반환하고 `일` 접미사·요일·괄호를 포함하지 않는지 검증한다.
- Chromium E2E: Day mode 하위 scale에서 `14`, `22` 등 숫자-only Header를 확인하고 legacy `일`/괄호 문자열이 없음을 검증한다. Day → Week → Day 전환 후 숫자-only 형식 복원, Week `W38/W39`, weekend highlight, Gantt/API instance identity 유지 회귀를 기존 scale spec에서 함께 확인한다.
- Month scale format, Day/Week cellWidth(44/68), scheduling/calendar/task/link/Grid/API/DB 계약은 변경하지 않는다.
- PR 회귀 보완: Grid DnD 후 parent 변경/selection 리렌더를 거친 Task에서도 stale inline edit session이 다음 작업명 클릭을 차단하지 않고 inline rename이 열리는지 기존 #300 Chromium 시나리오로 검증한다.
- 공식 전체 회귀 판정은 최신 `main` 재정렬 후 동일 PR head의 GitHub Actions `quality/e2e/docker` 결과를 사용한다. #315/#316 Tooltip은 별도 Issue이며 이번 범위에 포함하지 않는다.

## Issue #285 공정 코드 자동 생성

- Contract/API: Process POST에서 code 생략은 성공하고 서버 생성 code가 non-empty, 64자 이하, 프로젝트 내 unique인지를 확인한다. 명시적 유효 code는 보존하고 blank/64자 초과 및 duplicate code 오류 계약은 유지한다.
- Service/transaction: 동일 프로젝트 연속 자동 생성, 기존 명시 code와의 호환, revision 증가와 canonical logistics 응답을 확인한다. 인증/Origin/If-Match 실패에는 공정 row/revision이 생성되지 않는 기존 회귀를 유지한다.
- Chromium E2E: 공정 추가 모달에 코드 입력이 없고 공정명에 최초 focus가 있으며, 이름만으로 저장 가능하고 POST body에 code가 없는지 확인한다. canonical 응답의 생성 code 표시, Escape 취소 mutation 0회와 trigger focus 복원, edit mode code 입력 유지, readonly 및 390/768/1024/1440px overflow 회귀를 기존 물류 spec과 함께 검증한다.
- DB schema, 설비/시스템 code 정책, Scheduling/SVAR 계약은 변경하지 않는다. 공식 PASS는 PR head의 quality/e2e/docker 결과를 사용한다.

## Issue #279 물류 구성 서브탭 overflow 회귀

- Chromium E2E는 390/768/1024/1440px에서 물류 구성 tablist의 `overflow-x: auto`, `overflow-y: hidden`, `scrollHeight <= clientHeight`를 실제 DOM geometry로 검증한다.
- 1024/1440px에서는 충분한 폭에서 불필요한 수평 overflow가 없는지 확인하고, 좁은 폭에서 수평 overflow가 생기더라도 모든 탭이 키보드로 접근 가능한지 확인한다.
- KPI 대시보드에서 `End`로 제어·조율 관계까지 이동했을 때 선택/focus 상태와 탭 bounding box가 tablist 가시 영역 안에 들어오는지 검증한다. ArrowLeft/ArrowRight/Home/End 기존 회귀와 readonly/editable 공통 레이아웃을 유지한다.
- 탭 탐색은 물류 mutation, Project revision 변경, Gantt instance 교체를 만들지 않아야 하며 document-level unintended horizontal overflow를 추가하지 않는다.
- Linux CI의 overlay scrollbar 유무 대신 `clientHeight/scrollHeight`와 computed overflow를 자동 판정 근거로 사용한다. Windows classic scrollbar의 최종 육안 확인은 환경별 검증으로 별도 기록할 수 있다.


## Issue #269 프로젝트 복사·템플릿 저장 인증·원본 복구

두 Dialog의 POST 401 뒤 비밀번호 재입력·focus·일반 초안 보존과 명시적 재인증 성공을 검사한다. POST 412 뒤 기존 snapshot 제출 차단, 최신 원본 GET만 실행, 다음 사용자 제출의 새 If-Match를 확인한다. 복사 직전 GET에서 revision이 바뀌면 POST 0회여야 한다. 최초 GET 실패·잘못된 응답의 재시도, 닫기/다시 열기 후 늦은 응답 무시, 인증부터 시작하는 pending 중복 제출·닫기 차단과 비밀번호 정리를 검사한다. 390/768/1024/1440px에서 오류·긴 이름·주요 명령 접근·focus/문서 overflow와 제목·닫기 버튼 폭을 확인하며 실제 서버 권한·원자성 전체 회귀는 PR CI로 구분한다.

## Issue #268 리소스 관리 초안·오류 복구

Resource/Group POST 실패와 성공을 구분해 실패 초안 보존·성공한 폼만 초기화를 검사한다. 지연/실패 새로고침에서 mutation 0회와 명시적 재조회, 401 재로그인 뒤 일반 초안 보존, 412 최신 revision GET 후 명시적 저장의 새 If-Match를 확인한다. 구성원 선택·검색은 재조회와 다른 폼 성공 뒤 유지하고, 사라진 선택 그룹 저장은 차단한다. 인증/비밀번호 변경 네트워크 실패에도 비밀번호를 지우고 성공 status와 오류를 구분한다. 390/768/1024/1440px 오류·긴 이름·keyboard/overflow를 검증하며 API/서버 권한 전체 회귀는 PR CI로 구분한다.

## Issue #363 빈 프로젝트 생성 semantic grouping / content-aware width

- `tests/e2e/project-create-layout.spec.ts`에서 project-master catalog를 긴 label fixture로 고정하고 기본 정보 → 프로젝트 분류 → 설명 → 편집 권한 section의 실제 vertical geometry 순서를 검증한다.
- 1440/1600px에서는 프로젝트 이름 > 소유자 > 상태의 content-aware 폭 관계, 기준정보 group의 full-width 사용, 설명 영역이 편집 비밀번호보다 충분히 넓은 것을 bounding box로 확인한다.
- 1024px에서는 기본 정보가 이름/소유자 2열 + 상태 다음 행으로 reflow하고 사업부/제품/사업장·법인이 충분한 폭에서 동일 행을 공유하는지 확인한다.
- 768px에서는 기준정보가 2열 + 다음 행으로, 320/390px에서는 기본 정보와 기준정보가 logical DOM/tab order를 유지한 1열로 reflow하는지 확인한다.
- 모든 검증 폭에서 document-level horizontal overflow 부재를 유지하고 기존 생성 validation/API, 기준정보 loading/error/retry, draft 보존, tab/skip-navigation 접근성 회귀는 기존 전체 E2E와 함께 실행한다.
- API/DB/Scheduling/Security 계약은 변경하지 않으며 실제 사용자 시각 평가는 browser evidence와 별도로 구분한다.

- Generic Finalizer 회귀: 같은 PR head SHA에 이전 실패/cancelled required check와 최신 성공 check가 공존할 때 최신 check-run ID만 채택해 PASS하고, 그보다 새로운 실패 check-run이 추가되면 FAIL/NOT TESTED로 차단하는 순수 lifecycle scenario를 검증한다.

## Issue #282 프로젝트 생성 Wide / Responsive Layout

- `tests/e2e/project-create-layout.spec.ts`는 320/390/768/1024/1440/1600px에서 `/projects/new`의 site-header→NEW PROJECT 간격, main/form 실제 폭, blank/template field의 같은 행 배치 또는 narrow 단일열 reflow, document-level horizontal overflow 부재를 geometry로 검증한다.
- 1440/1600px에서는 main과 blank form이 기존 75rem/42rem cap에 갇히지 않는 것을 실제 bounding box 폭으로 확인한다.
- 768/1024px에서는 blank와 template form이 2열을 사용하고 320/390px에서는 DOM/tab order와 일치하는 단일열 순서를 확인한다.
- 기존 `project-create-and-read.spec.ts`, `new-project-draft-preservation.spec.ts`, `template-picker-ux.spec.ts`, `skip-link.spec.ts`를 그대로 유지하여 생성 validation/API, 초안 보존, template 선택/오류, tab/skip-navigation 접근성 회귀를 PR 전체 E2E에서 함께 검증한다.
- API/DB/Scheduling/Security 계약은 변경하지 않으므로 해당 계층의 신규 계약 테스트는 N/A다.

## Issue #267 대시보드 조건·응답·탭 정합성

지연/실패/응답 역전 mock으로 조건 변경 시 이전 KPI·drill-down 차단, 최신 요청만 반영, HTTP·네트워크·잘못된 응답의 명시적 재시도를 검사한다. 최초 서버 기준일 표시가 불필요한 추가 GET을 만들지 않는지, 빈 값/0/91/소수 기간은 GET 없이 필드 오류를 제공하는지 확인한다. 세부 탭의 aria 연결·roving Tab·방향키/Home/End와 정상 작업 이동의 Gantt identity를 검증한다. 390/768/1024/1440px에서 빈 결과·오류·긴 이름 및 문서 overflow를 확인한다. KPI 알고리즘·API 전체 회귀는 기존 테스트와 PR CI로 구분한다.

## Issue #266 관계 Dialog 키보드·초안·요청 보호

후보 Enter/Space 선택과 Escape의 후보 우선 닫기, native dialog Tab/Shift+Tab containment, 실제 호출 위치 focus 복원, 같은 Gantt root/상태 보존을 검사한다. 명시적 Header/Footer 닫기는 후보 popup이 열려 있어도 popup 전용 Escape 처리와 분리되어 즉시 닫기 또는 dirty 확인 흐름으로 진입해야 한다. predecessor 방향을 포함한 관계 생성 성공 후 새 관계 초안은 기본값으로 초기화되어 불필요한 폐기 확인이 없어야 한다. dirty 닫기·다른 관계 선택의 계속 편집/폐기, 대상이 표시된 삭제 확인과 취소 DELETE 0회를 검증한다. 지연 mutation 중 Escape·닫기·선택·중복 요청을 차단하고 실패 후 초안을 보존해야 한다. Readonly와 긴 후보/제목을 포함하여 390/768/1024/1440px 주요 명령 접근·본문 scroll·문서 overflow 및 공통 닫기 버튼 줄바꿈을 확인한다. API/DB/스케줄링 알고리즘은 변경하지 않으며 전체 회귀는 PR CI로 구분한다.

## Issue #265 템플릿 조회·선택·폼 접근성

템플릿 조회 HTTP 오류·네트워크 실패·잘못된 응답을 정상 빈 배열과 구분하고 명시적 재시도 성공을 검증한다. Native radio의 방향키/Space 및 Tab 진입, 검색 label/count/reset·0건·필터 밖 선택 요약, 사용자 프로젝트 이름 보존을 확인한다. 필드 오류의 aria 연결과 focus, 수정 후 해제, 성공 제출 payload와 이동을 검사한다. 긴 카드와 폼은 390/768/1024/1440px에서 document overflow를 검사하고, #264의 초안·지연 제출 회귀도 함께 실행한다. 실제 서버 세션 발급·일정 계산 전체 회귀는 기존 통합 테스트와 PR CI로 구분한다.

## Issue #283 Docker standalone runtime 회귀

- Build: `next.config.ts`의 standalone output과 `tsconfig.runtime-tools.json`의 startup 도구 JavaScript emit이 production build에서 함께 생성되어야 하며, build 후 `.next/static`, optional `public/`, `db/migrations`가 prepared standalone tree에 stage되어야 한다.
- Image layout: final image에는 `server.js`, `.next/static`, compiled runtime validation/migration, `db/migrations`가 있고 전체 `src`, `.next/cache`, `next.config.ts`, `node_modules/tsx`, runtime TypeScript source는 없어야 한다.
- Startup: production `DATABASE_PATH`/canonical `APP_BASE_URL` validation이 server보다 먼저 실행되고 invalid config 또는 migration 실패 시 server를 시작하지 않아야 한다. source checkout의 `npm run start -- --hostname ... --port ...`도 `next start`가 아니라 generated standalone server를 실행해야 한다. generated server import 전에 repository-root Next production env files를 로딩하고, working directory가 standalone tree가 되더라도 로드된 환경값과 staged `db/migrations`로 readiness/DB 경로가 정상이어야 한다.
- Native SQLite: `better-sqlite3` load, create/read/write, migration ledger, readiness와 container restart 후 persistence를 기존 Docker smoke로 검증한다.
- Application/transport: Project/Task API authorization·persistence, HTTP/HTTPS reverse-proxy transport 및 Compose restart/recreate persistence 회귀를 기존 전용 smoke로 유지한다.
- Size: PR exact base SHA의 baseline image와 candidate를 동일 runner에서 build한다. Issue #283의 non-standalone → standalone 전환에는 `docker image inspect .Size` 기준 최소 25% 감소를 요구하고, 이미 standalone인 후속 PR은 추가 25% 감소를 강제하지 않는다. 모든 경우 summary에 size 비교, 주요 runtime directory footprint와 상위 layer를 기록한다.
- Security/supply chain: pinned Debian/glibc base digest, non-root UID/GID, secret/data 부재와 main/release SBOM/provenance 정책은 유지한다.
- Local Fast Feedback과 PR 원격 결과를 분리한다. 실제 npm/Docker 실행을 하지 못한 개발 환경에서는 정적 검토를 PASS로 승격하지 않고 PR head의 `quality/e2e/docker` 결과를 공식 증거로 사용한다.

## Issue #264 생성 방식 전환과 초안 보존

`tests/e2e/new-project-draft-preservation.spec.ts`에서 390/768/1024/1440px 양방향 폼 전환 뒤 비민감 입력·선택·검색·기준일 보존, 최초 방문 이후 템플릿 목록 재조회 없음, 숨겨진 panel의 focus 제외를 확인한다. 초기 template mode, 방향키/Home/End와 본문 바로가기 연결을 검사하며, 본문 바로가기 후 활성 panel의 첫 컨트롤에서 Shift+Tab 시 선택된 tab으로 복귀하는 회귀를 포함한다. 양쪽 생성 POST의 지연·실패를 mock하여 중복 제출 및 탭 전환 차단, 실패 후 초안 보존·비밀번호 삭제·명시적 재시도를 검증한다. 서버 API/권한 계약은 변경하지 않으며 공식 전체 회귀는 PR CI로 구분한다.

## Issue #263 연결·할당·담당자 조회 준비 상태

- Task 물류 links/master GET 지연·HTTP 오류·network·malformed 응답에서 선택/저장 비활성 및 PUT 0회를 확인한다. 실패를 정상 빈 목록으로 표시하지 않는다.
- 다시 시도 GET 성공 후 기존 직접 연결·scope를 복원하고 명시적 저장 payload/If-Match를 확인한다. taskId/revision 변경과 늦은 응답이 섞이지 않아야 한다.
- Assignment는 실제 target reference DTO와 nonempty 할당 응답을 사용해 정상 조회 회귀 및 실패 저장 차단·재시도를 검증한다.
- 설비/시스템 담당자 dialog는 catalog 실패 안내·재시도·저장 차단과 canonical 담당자 이름 fallback을 확인한다.
- 변경 화면의 readonly, 390/768/1024/1440px, 긴 이름 및 keyboard 상태를 실제 브라우저에서 확인한다. 원격 quality/e2e/docker 판정은 별도다.

## Issue #245 Gantt SVG/PNG 내보내기

- 서버 Unit/API: canonical WBS 순서, 전체 Grid+Chart와 기간 Chart-only, 날짜·행·bar/link clip, SVG XML 안전성, 비근무일, Summary/Task/Milestone/progress, 크기 제한, Origin/If-Match/412 및 Excel 회귀를 검증한다.
- Chromium E2E: 내보내기 진입점의 Excel/SVG/PNG, 기간 입력·오류, SVG XML과 PNG signature/크기, keyboard·Escape·focus 복원, 390/768/1024/1440px header, Gantt 상태 보존을 확인한다.
- Local Fast Feedback은 변경 관련 unit/typecheck/lint/E2E로 기록한다. 공식 전체 회귀는 PR의 동일 head에서 `quality/e2e/docker` 결과로만 판정한다. 실제 screen reader와 브라우저별 Canvas 한도는 환경별 별도 검증이다. 상세 계약은 [IMAGE_EXPORT.md](IMAGE_EXPORT.md)를 따른다.

> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


2026-09-12 후속 UI 변경의 테스트는 사용자 요청에 따라 일괄 실행까지 보류한다. 새 작업 이름·날짜·기간 자동 적용의 검증 항목과 기존 E2E 갱신 필요 사항, 별도 원격 push 절차는 [PENDING_TESTS.md](PENDING_TESTS.md)에 기록한다. 기존 PASS를 후속 변경에 적용하지 않는다.

상태: qa_docs가 작성한 검증 전략. W02–W07, W20과 W21 검증 기록은 [W07_REVIEW.md](W07_REVIEW.md), [W20_REVIEW.md](W20_REVIEW.md), [W21_REVIEW.md](W21_REVIEW.md)를 참조한다. 아래 표는 전체 제품 계획이며 W20의 로컬 container PASS도 원격 Actions/GHCR, production host/backup/restore와 VBA 통과를 뜻하지 않는다.

## Issue #209 docs-only main image skip

검증 이력:
- PR #210 / main CI #919에서 workflow·문서 혼합 변경이 docs-only가 아닌 것으로 분류되고 기존 임시 GHCR 게시→exact digest 검증→cleanup 경로가 SUCCESS임을 확인했다.
- 이 문서-only 후속 변경은 docs-only main merge에서 `publish-commit-image`가 SKIPPED되는지 실제 원격 증거를 만들기 위한 검증 입력이다. 병합 전에는 결과를 PASS로 간주하지 않으며 최종 run은 Issue #209에 기록한다.


- `.github/workflows/ci.yml`의 main 변경 유형 판정은 push의 `before..head` diff를 사용한다. 변경 파일이 1개 이상이고 모두 `docs/**` 또는 저장소 루트 Markdown(`*.md`)일 때만 `docs_only=true`다.
- 기준 SHA가 비어 있거나 all-zero, diff가 비어 있거나 비문서 파일이 하나라도 섞이면 fail-safe로 `docs_only=false`이며 기존 임시 GHCR registry gate가 유지되어야 한다.
- docs-only main push에서도 `quality`, Chromium E2E, Docker build/runtime smoke는 기존대로 실행하고, `Main 임시 commit 이미지 게시·검증·정리` job만 **SKIPPED**여야 한다. 따라서 GHCR login/publish/digest pull/cleanup 및 `packages: write` job은 시작되지 않는다.
- 비문서 main push에서는 기존 `publish-commit-image`가 실행되어 임시 `ci-<SHA>` 게시 → exact digest 검증 → package version 삭제를 수행해야 한다.
- PR과 `workflow_dispatch`는 기존처럼 registry write를 하지 않는다. PR head의 공식 회귀 판정은 기존 `quality/e2e/docker`를 유지한다.

## Issue #120 semantic UI state token 회귀

- `tests/e2e/ui-semantic-tokens.spec.ts`: Chromium computed style로 primary/error/warning/info/success 텍스트 대비를 측정하고 4.5:1 이상인지 확인한다.
- focus ring은 실제 focused Resource Admin control의 outline color와 인접 background를 측정해 3:1 이상인지 확인한다.
- readonly/output와 subtle inactive badge 조합은 각각 실제 surface에 대해 4.5:1 이상인지 확인한다.
- 390/768/1024/1440px Resource Admin 진입 화면의 document horizontal overflow 부재를 확인한다. 기존 Task Editor/Project Row Menu E2E가 keyboard/selected interaction 회귀를 계속 담당한다.
- 실제 모바일 기기와 screen reader는 CI 범위 밖이며 별도 검증 시 결과를 기록한다.

## Issue #181 Project List 고급 필터 밀도

- 기존 `tests/features/projects/project-list-filter.test.ts`의 predicate/조건 수/상태 기본값/invalid date 계약을 그대로 사용하며 domain filter 구현은 변경하지 않는다.
- `tests/e2e/project-list-search-filter.spec.ts`는 390×844·768×900·1024×900·1440×900에서 프로젝트 정보·날짜 그룹의 기본 접힘, inactive input 비노출, native summary Enter 조작, 활성 조건 값 summary 노출, 재접힘 뒤 값 식별, Escape 뒤 Filter trigger focus 복귀를 검증한다.
- 같은 E2E는 패널 `scrollHeight`/bounds/목록 시작 위치를 수집하고 변경 후 screenshot을 남기며 document-level horizontal overflow 부재를 확인한다. 기본 접힘 상태에서는 패널 자체가 max-height 때문에 불필요한 내부 scroll을 만들지 않는지 검사한다.
- 기존 #84 E2E는 disclosure를 명시적으로 펼친 뒤 Quick Search AND, timezone 날짜, invalid range, no-result, 삭제를 계속 검증하고 #130 Phase 4 toolbar E2E도 프로젝트 정보 disclosure를 펼친 뒤 기존 focus 계약을 검증한다. #177의 Project List 상태 즉시 변경 및 필터 재평가 회귀는 기존 status E2E에서 계속 담당한다.
- **Baseline 상태:** 구현 전 기준 `main@46de39b179eebae5a4b53b3f9d8e4aa2a562744d`의 동일 fixture/viewport `scrollHeight`·bounds·목록 시작 위치와 PNG는 아직 실행 증거가 없어 **NOT TESTED**다. 변경 전후 개선 판정은 이 baseline을 별도로 확보한 뒤 head 결과와 비교한다.
- 자동 공식 판정은 구현 PR의 동일 head SHA에서 GitHub Actions `quality/e2e/docker`를 사용한다. 실제 screen reader와 모바일 기기는 환경별 별도 검증이다.

## Issue #83 Project Task / Resource 검색·필터

- Unit: text normalization, inclusive date overlap, contained/start-in/end-in, milestone, type/schedule mode, progress/duration range, assigned/unassigned, Resource/Group ANY·ALL, ancestor context를 검증한다.
- Browser: 일정 Toolbar 검색/필터, Grid/Chart 동일 결과, ancestor context와 match count 분리, dangling dependency 미표시, 초기화, readonly, 탭 전환 상태 보존을 검증한다.
- Resource: 이름/code, kind, active/inactive, 연결 Task 기간 필터와 전체 Project workload 집계 라벨을 검증한다.
- 성능: 5,000 Task deterministic fixture에서 입력마다 Project snapshot 재조회 또는 Gantt 전체 page remount가 발생하지 않는지 검증한다.
- 공식 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker`, 병합 후 main 임시 GHCR exact digest smoke, 승인된 release image의 exact digest smoke를 사용한다.

## Issue #76 Project Workspace UX

- Global Header가 viewport 기반 full-width로 동작하고 전역 active navigation을 `aria-current`로 제공하는지 검증한다.
- Project Context가 프로젝트명·편집 상태 중심의 compact bar이며 Description/Owner/Revision은 Info disclosure에서 조회 가능한지 검증한다.
- Readonly 상태의 비밀번호 입력은 상시 공간을 점유하지 않고 `편집 잠금 해제` Dialog에서만 제공되며 기존 edit-session 인증/실패/재인증 계약을 유지하는지 검증한다.
- `일정 / 리소스` tablist/tab/tabpanel의 selected state, Arrow/Home/End keyboard 이동과 focus를 검증한다.
- 일정 → 리소스 → 일정 전환 전후 Gantt instance와 scroll/state가 보존되고 mutation/document request가 발생하지 않는지 검증한다.
- Resource workload는 full-width peer view로 표시하고 M/D·M/M·Refresh, Group → Resource → Task 계층과 과투입/미설정 상태를 검증한다.
- 390/768/1024/1440/1920px에서 unintended document horizontal overflow가 없고 Gantt 내부 scroll 계약은 유지되는지 검증한다.
- 최종 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker`와 병합 후 main artifact gate를 사용한다.

## Issue #72 Task Context Menu

최종 PR 검증 기준은 **PR #73 / CI Run #387**이다. `quality`, 전체 Chromium E2E, Docker build/runtime/transport/Compose smoke가 모두 PASS했으며, hierarchy reparent는 canonical sync에서 공개 `move-task` action을 사용하고 `update-task` parent 직접 변경으로 인한 recovery remount가 발생하지 않는지를 Unit/E2E에서 고정한다.

- Unit: 메뉴 enable/disable, sibling 경계, Indent/Outdent, clipboard Cut/Copy/Paste command mapping과 readonly/busy/**선택 Task endpoint link** fail-closed를 검증한다. Issue #104 회귀로 unrelated Task에만 Link가 있는 경우 현재 Task capability가 유지되는지 별도 검증한다.
- SQLite service: Move, Indent parent Summary 전환, subtree Copy identity/shape, boundary no-op rollback, 성공당 revision +1을 검증한다. cycle/empty Summary/assignment-copy/link 구조도 회귀 범위이며, Issue #104는 linked A↔B가 있어도 unlinked C의 hierarchy/delete mutation이 성공하고 기존 Link가 canonical response에 보존되는지 검증한다.
- API/security: 신규 `POST /task-commands`가 route security inventory에 포함되고 Origin/session/If-Match/stale revision/Project isolation 규약을 그대로 적용하는지 검증한다.
- Browser: Grid/Chart 우클릭과 Shift+F10, submenu keyboard focus, Ctrl/Cmd+X/C/V, Delete/Backspace/Ctrl+D, viewport edge, 실패 후 canonical recovery와 reload persistence를 검증한다.
- GitHub Actions의 동일 head quality/e2e/docker가 최종 자동 판정 근거다. SVAR Willow와의 실제 시각/키보드 UX 비교는 별도 수동 확인 항목이다.

## Issue #80 Task Editor 관계 표시 회귀

- Unit: predecessor/successor externalId 방향, 동일 이름, dangling reference, 관계 없음, multiple relation과 type/lag 보존을 검증한다.
- Chromium E2E: A → B fixture를 canonical snapshot으로 구성하고 Grid 더블클릭, Chart 더블클릭, Context Menu → Edit 각각에서 A의 후행 B/B의 선행 A 및 이름/externalId/type/lag를 확인한다.
- 관계 표시는 상위 canonical snapshot을 사용해 별도 관계용 `GET /api/projects/{publicId}`에 의존하지 않으며, Editor open만으로 mutation이 발생하지 않는지 검증한다.
- Readonly 및 Link 포함 일정에서도 Grid/Chart 더블클릭과 Context Menu로 Editor가 열리고 관계 탭 조회가 가능하며 Task Save와 관계 추가/편집/삭제 mutation action은 제공되지 않는지 검증한다.
- 기존 401/412/draft/reload/Gantt instance, Context Menu #77 focus 정책 및 no document navigation 회귀를 유지한다.
- PR의 `quality`, 전체 Chromium E2E, Docker smoke와 병합 후 main GHCR exact digest smoke를 공식 PASS 근거로 사용한다.

## 판정과 증거

### Issue #31 작업 subtree 삭제

- Unit: 실제 taskId 기준 자손 탐색이 모든 깊이를 포함하고 형제를 제외하며 cycle/unknown을 안전하게 처리한다.
- SQLite service: subtree를 child-first로 같은 transaction에서 삭제하고 남은 Summary를 재계산한다. 선택 범위 밖 Summary가 비면 같은 ID/type을 유지하며 일정만 null로 만든다(#345). Link·권한 등 유효한 거부는 rollback한다.
- API/security: 기본 DELETE는 기존 단건 의미를 유지하고 `includeDescendants=true`만 subtree를 활성화한다. session/Origin/If-Match/Project isolation, stale 412, Link 포함 409, revision 정확히 1 증가를 검증한다.
- Chromium 실제 API: Grid/Chart 우클릭의 정확한 target, 삭제 메뉴, 자손 확인의 작업명/개수, 취소 전 DELETE 0회, 확인 후 subtree DELETE 1회, sibling 보존, canonical Grid/Chart 동기화, Gantt instance 유지와 reload persistence를 검증한다.
- GitHub Actions `quality/e2e/docker`의 최종 동일 head 실행을 공식 회귀 근거로 사용한다. 실제 스크린리더·Windows/사내 브라우저 최종 UX는 별도 환경 검증이다.

당시 W24: Project 목록 table 및 authorized DELETE 확인/취소/성공/실패, 401/403/404/412/428과 cascade/rollback/isolation을 검증했다. Gantt Header root·row child 추가, first-child 명시 Summary 전환, nested leaf 변경 후 ancestor 집계·reload, milestone parent와 마지막 child 삭제 거부를 포함했다(마지막 child는 #345 이후 성공). Default browser-local today/1day, locale/date-only timezone, 토/일 음영, 외부ID 표시 토글, Project 및 Grid/Chart header의 내부 scroll 중 위치 유지도 검증했다. 실제 결과는 [W24_REVIEW.md](W24_REVIEW.md)에 기록한다.

W23 목록 검증: D02 공개 summary 필드 allowlist, 인증 없이 GET 200/no-store, 빈 목록과 DB 오류 구분, 최신 수정순·동률 정렬, 생성→목록 복귀→reload→새 브라우저 direct Readonly, 기존 Mutation 무인증 거부 회귀. 결과는 [W23_REVIEW.md](W23_REVIEW.md)에 기록한다. W04 당시 collection GET 405 검증은 역사적 기록이며 W23에서 200 계약으로 대체한다.

| 판정 | 의미 |
| --- | --- |
| PASS | 명시한 환경에서 기대 결과를 재현하고 command/version/fixture/exit code·산출물을 기록 |
| FAIL | 실행 결과가 계약과 다름; 재현 절차와 요구 ID 기록 |
| BLOCKED | 필요한 환경·권한·artifact 부재; 해제 조건 기록 |
| NOT TESTED | 계획만 있고 아직 실행 안 함 |
| UNKNOWN | Excel/VBA 환경의 정책·가능 여부 자체가 확인되지 않음 |

문서 존재·Agent 완료 보고는 제품 PASS가 아니다. 결과에는 commit, OS/CPU, Node/browser/Excel/Docker version, fixture, exact command, 시각, exit code를 기록한다. Password/Cookie/session/원본 Workbook 내용은 기록하지 않는다. Flaky retry로 최초 실패를 숨기지 않는다.

## 계층과 공통 fixture

- Static: R-ID와 API/DB/Security/Scheduling/Import/Deployment 간 양방향 추적 및 예제·링크 검증.
- Unit/Vitest: pure date/calendar/graph/summary/WBS, schema/security utility. Clock을 주입하고 DB/network 의존 제거.
- Integration: 임시 SQLite에 실제 migration 적용, Repository→Service→HTTP, FK/transaction/session/revision 검증.
- Browser/Playwright: 새 context, 두 편집자, Readonly/unlock/CRUD/drag/hierarchy/reload/import/export/error recovery.
- Artifact/system: 실제 target Docker/volume와 ExcelJS workbook 재개방, Excel/LibreOffice 표시, 승인된 Windows Excel 실환경 POC를 분리.

P-A/P-B 두 Project에 같은 externalId를 사용해 isolation을 시험한다. 금요일 2026-09-11, 주말, 9/14 테스트 조직 휴일, 윤년, 한글 ID·이름, `=1+1`, `+cmd`, `@SUM(1,1)`, HTML·SQL-like text, comma/quote/CRLF를 공통 fixture로 둔다. 9/14는 실제 법정 공휴일로 주장하지 않는다.

## Authorization / concurrency

| ID | 검증과 기대 결과 |
| --- | --- |
| AUTH01 | Create의 Origin/크기/rate 정책, Project+salt/hash+session 원자 저장, 같은 password에도 다른 salt/hash, 원문 미저장 |
| AUTH02 | 새 browser direct GET Readonly; UI 강제 edit 상태에서도 보호 API mutation은 거부 |
| AUTH03 | correct/wrong password, unknown Project 일반 오류, timing-safe compare, KDF concurrency/rate 제한 |
| AUTH04 | Production __Host cookie의 Path=/, HttpOnly/Secure/SameSite=Strict, Domain 없음, expiry; local HTTP 별도 이름; JS storage/token URL 없음 |
| AUTH05 | expiry 경계, revoke, auth_version, malformed token, P-A token으로 P-B write 거부; logout idempotent |
| AUTH06 | create/unlock/logout/preview 포함 unsafe method의 missing/null/malformed/multiple/cross Origin 거부, exact scheme/host/port; GET/HEAD 상태 불변 |
| AUTH07 | public Task UUID를 알아도 다른 Project CRUD 거부; parent/link composite FK도 cross-project insert 거부 |
| AUTH08 | If-Match 누락428/stale412; 동시 동일 revision write 둘 중 하나만 성공, 성공당 revision1 증가 |
| AUTH09 | preview 뒤 다른 write→commit412 전체 불변; password revoke/mutation race에서 transaction 최종 session 검증 |
| AUTH10 | route inventory를 보호 API 목록과 대조, 신규 unsafe endpoint 누락 실패; preview는 session+Origin 필요/If-Match 불필요/DB불변 |
| AUTH11 | log와 response body/error/non-cookie header에 password/hash/salt/session/Cookie/import body/SQL/stack/내부 path 없음. 인증 성공의 opaque session 원문은 의도한 `Set-Cookie`에만 존재 |
| AUTH12 | password 변경으로 이전 모든 session 무효화, 호출자 새 token만 유효; 204/new ETag/Set-Cookie 계약 |

### W04 실행 증거

- **AUTH01 PASS (생성 범위):** strict 입력, 32 KiB JSON, exact Origin, process-global 5/hour limiter, KDF concurrency 2, Project+derived password+최초 session digest 원자 저장, rollback과 원문 DB 부재.
- **AUTH02 PARTIAL PASS (W04 당시):** 생성 browser·새 Cookie 없는 browser 모두 direct GET/UI Readonly, DB 재개방 후 유지. 보호 mutation 강제 거부는 W05에서 추가 검증했다.
- **AUTH04 PARTIAL PASS (W04 당시):** production/local Cookie 직렬화와 token URL/DOM 비노출 PASS. Server-side expiry 소비는 W05에서 추가 검증했다.
- **AUTH06 PARTIAL PASS (W04 당시):** create의 missing/null/malformed/multiple/cross Origin과 GET 비변경 PASS. 현재 unsafe route inventory는 W05에서 추가 검증했다.
- **AUTH11 PARTIAL PASS:** 생성 response body/error/non-cookie header/DB/URL/DOM secret scan PASS. Opaque session 원문은 의도한 `Set-Cookie`에만 있고 DB에는 digest만 있다. 운영 access log와 Import/Export는 NOT TESTED다.
- Project 격리·canonical UUID·동일 404, collection GET 405, create recovery UI를 추가로 PASS했다. Exact command·환경은 [W04_REVIEW.md](W04_REVIEW.md)에 기록한다.

### W05 실행 증거

- **AUTH02 PASS (현재 Project metadata slice):** Direct API는 Cookie와 무관하게 Readonly, 새 browser는 Readonly이며 no-session/cross-project/noncanonical persisted ID metadata/password mutation은 거부되고 DB는 불변이다. Task CRUD slice는 W07까지 BLOCKED다.
- **AUTH03 PASS:** correct/wrong/unknown/corrupt credential, dummy scrypt, recorded profile, 동일 길이 timing-safe 비교, hash/verify 공유 KDF concurrency 2, global+Project bounded limiter를 검증했다.
- **AUTH04–06 PASS (현재 Route slice):** production/local 발급·만료 Cookie와 8 KiB/100 pair/duplicate parser, strict expiry/revoke/auth-version/project binding, 유효 wrong-project Cookie 보존, idempotent logout, exact Origin, current GET·live HEAD/OPTIONS 상태 불변과 credential CORS 미노출을 검증했다.
- **AUTH08 PASS (Project metadata/password):** strong positive If-Match, missing 428, malformed 400, stale 412, live 동일 revision 동시 PATCH의 정확한 200+412와 revision 1회 증가를 검증했다.
- **AUTH09 PASS (password/session race slice):** write lock 획득 뒤 final session-first expiry/revoke/auth-version/credential integrity 검사와 rotation insert fault 전체 rollback을 검증했다. Import preview/commit race는 W12까지 BLOCKED다.
- **AUTH10 PASS (현재 Route inventory):** 실제 `route.ts` export 전부를 policy inventory와 대조한다. 미래 Calendar/Task/Link/Import Route는 구현 시 inventory와 테스트를 동시에 확장해야 한다.
- **AUTH11 PASS (W05 application slice):** password/token/hash/salt가 response body/error/non-cookie header/URL/DOM/DB 원문에 나타나지 않는다. 운영 access log와 Import/Export는 NOT TESTED다.
- **AUTH12 PASS:** credential·`auth_version + 1`·`revision + 1`·기존 session 전체 revoke·호출자 새 session을 하나의 transaction에 저장하고 old session/password 거부와 caller edit 유지를 browser까지 검증했다.
- 전체 11개 파일 91개 Vitest, typecheck/lint/build와 clean 기본 Turbopack Chromium E2E 4개가 PASS했다. Webpack 개발 cache의 manifest race와 병렬 spec이 의도한 process-global create limit을 공유하는 실패를 재현해, 기본 Playwright server는 Turbopack·worker 1개로 고정했다. 동일 revision 병행성은 W05 spec 내부 병렬 HTTP로 계속 검증한다. 정확한 명령·환경·잔여 위험은 [W05_REVIEW.md](W05_REVIEW.md)에 기록한다.

### W06 실행 증거

- **SCH01 PASS:** strict `YYYY-MM-DD`, `1900-01-01..2199-12-31`, 윤년·월말·연말·overflow를 검증하고 전체 109,573일을 독립 oracle과 ordinal 왕복·요일 대조했다.
- **SCH02 PASS:** exact `Asia/Seoul`/weekend `[6,0]`, Holiday 날짜·중복·nullable name, 주말 중복, inclusive/exclusive next working day, 전체 비근무 범위 탐색 종료를 검증했다.
- **SCH03 PASS:** 일반 Task duration `1..10000`, inclusive end, supplied end 일치/불일치, milestone duration 0과 `start=end`를 검증했다.
- **SCH04/SCH06/SCH07 PARTIAL PASS (W06 leaf slice):** `requestedStart` 보존, Auto 비근무 시작 이동 warning, Manual 비근무 시작 거부, calendar-only milestone을 검증했다. Dependency 이동·Manual FS/Calendar aggregate conflict는 W09까지 BLOCKED다.
- **SCH11 PARTIAL PASS:** pure 입력 불변, frozen deterministic result, 5개 Node `TZ` 동일 결과와 Domain의 Date/Intl/process/I/O 비의존을 검증했다. Graph/summary 전체 멱등성은 W08/W09 후속이다.
- **SCH12 PARTIAL PASS:** raw SSR은 `pending`이고 hydration 이후에만 Client Engine이 계산하도록 구성해 UTC·Asia/Seoul·America/New_York Chromium에서 Server/Browser canonical fixture가 일치했다. 실제 SVAR drag/resize와 DB 저장은 W07까지 BLOCKED다.
- W06 Domain 4 files/135 tests와 전체 15 files/226 Vitest, typecheck/lint/build, clean 기본 Turbopack Chromium 7/7이 PASS했다. 정확한 범위·독립 QA·잔여 위험은 [W06_REVIEW.md](W06_REVIEW.md)에 기록한다.

### W07 실행 증거

- **AUTH02/AUTH05/AUTH07 PASS (root Task slice):** no/malformed/wrong-Project/expired/revoked/auth-version Cookie, password rotation 이전 session과 다른 Project Task UUID를 실제 Handler→Service→SQLite 경계에서 거부하고 row/revision 불변을 확인했다.
- **AUTH08 PASS (Task slice):** missing/stale If-Match를 거부하고 동일 revision 두 실제 HTTP POST의 결과가 정확히 `201 + 412`, revision은 한 번만 증가하며 승자 Task 하나만 남는지 검증했다.
- **AUTH09/DB02 PASS (Task slice):** `BEGIN IMMEDIATE` 안의 session-first 재검증과 create/update/delete/readback fault rollback, file-backed SQLite close/reopen의 requested/effective dates·progress·revision 보존을 검증했다.
- **AUTH10 PASS (현재 Route inventory):** Task POST/PATCH/DELETE가 모두 `origin-session-if-match`로 등록됐으며 외부 Link route는 W09 전까지 존재하지 않는다.
- **SCH03/SCH04/SCH12 PASS (root Leaf slice):** W06 `scheduleLeaf`가 Task/Milestone create/update에 적용되고, 실제 SVAR 우측 resize·좌측 resize·이동·삭제·reload에서 exclusive widget end와 inclusive domain end가 왕복한다.
- **UI01 PARTIAL PASS:** Create→unlock→root Task CRUD→pointer edit→reload vertical slice는 PASS다. Hierarchy와 FS는 W08/W09까지 BLOCKED다.
- **UI02 PARTIAL PASS:** Task 401/412/422/500 거부와 canonical 재조회 실패에서도 마지막 확정 Gantt를 복원했다. 403/409/413/429의 화면별 browser fixture는 후속 통합 QA까지 NOT TESTED다.
- W07 전체 21 files/291 Vitest, typecheck/lint/build, clean 기본 Turbopack Chromium 8/8과 production dependency audit 0건이 PASS했다. 정확한 범위·독립 QA·잔여 위험은 [W07_REVIEW.md](W07_REVIEW.md)에 기록한다.

### W21 실행 증거

- **UI03 PASS:** 빈 Project에서도 Grid와 Chart를 렌더하고 첫 root Task 저장 직후 동일 taskId의 Grid row와 `.wx-bar`가 reload 없이 보인다.
- **UI04 PARTIAL PASS:** supplied Summary/child의 snapshot 순서와 `parent/open` adapter를 unit으로 확인했고 단일 Core의 Grid/Chart 동시 pane을 Browser에서 확인했다. 실제 Summary 생성·expand/collapse와 WBS는 W08까지 BLOCKED다.
- **UI05 PASS:** 1440×900에서 Project Gantt 폭 1,000px 초과, 높이 580px viewport 규칙과 첫 화면 위치를 확인했고 max-width cap을 두지 않는다. 실제 Resizer drag geometry는 Core 제공 동작으로 유지하지만 별도 자동 조작은 NOT TESTED다.
- **UI06/UI08 PASS:** 기존 401/412/422/500·canonical read 실패 복원과 move/양쪽 resize/delete/reload persistence가 새 작업공간에서도 통과했다.
- **UI07 PASS:** 기존 direct Readonly/current-session/unlock/logout과 Task 보호 API 경계를 유지하며 native Add column을 노출하지 않는다.
- **UI09/UI10 PASS:** 390×844에서 Grid와 Chart가 함께 보이고 focus 가능한 outer region의 `scrollWidth > clientWidth`, 실제 `scrollLeft` 이동, document overflow 없음과 disclosure control 회귀를 확인했다.
- Manager 재검증: version 0.3.0, typecheck/lint/build PASS, 전체 24 files/310 Vitest와 clean isolated Turbopack Chromium 8/8 PASS. 독립 판정과 잔여 범위는 [W21_REVIEW.md](W21_REVIEW.md)에 기록한다.

## CI/CD / Semantic Release

| ID | 검증과 기대 결과 |
| --- | --- |
| CI01 | PR/main의 frozen `npm ci`, version check, typecheck, lint, 전체 Vitest, production build가 clean GitHub runner에서 실행 |
| CI02 | Chromium E2E worker 1, 실패 trace/report artifact, 일반 application job과 격리 |
| CI03 | clean `linux/amd64` image build, non-root UID/GID, native `better-sqlite3`와 migration/readiness 성공 |
| CI04 | ephemeral volume에 대표 Project 저장 후 같은 container/image restart에서 유지; image layer에는 DB/WAL/SHM 없음 |
| CI05 | package와 lockfile version이 strict SemVer로 일치; release tag가 annotated exact `v<version>`이고 모든 이전 valid tag보다 크며 malformed/mismatch/lower version은 hard fail |
| CI06 | PR job은 read-only이고 publish job만 최소 package/attestation 권한; Action full SHA와 base image digest pin, secret build arg/log 없음 |
| CI07 | Repository 단위 release 직렬화; stable만 latest/major/minor 갱신, prerelease는 exact SemVer만 보관; OCI source/revision/version, SBOM/provenance 존재 |
| CI08 | Pre-publish local candidate가 production config/migration/readiness/native SQLite/restart를 통과; PASS 후 GHCR exact SemVer를 직접 push하고 그 build output digest를 재-pull하여 smoke 및 활성화한 GitHub Attestation을 수행한 뒤 stable rolling alias만 승격; exact version/digest를 downstream test에 제공 |
| CI09 | PR·수동 CI는 registry write가 없고 성공한 `main` push만 모든 quality/E2E/container job 뒤 임시 `ci-<full SHA>`를 게시; exact digest 검증 뒤 package version을 삭제하며 기존 tag overwrite와 SemVer/rolling alias 생성을 거부 |
| CI10 | Main 임시 commit image와 SemVer exact release image를 각각 build output digest로 새로 pull해 image policy, migration/readiness, Project 생성·edit session·Task 저장, unauthorized write 거부, restart 후 Project/Task 재조회를 검증; main 임시 package 삭제까지 확인하고 BuildKit SBOM/provenance와 optional GitHub Attestation 결과를 구분 |

로컬 workflow lint와 Docker smoke는 implementation evidence다. GitHub-hosted Actions URL, tag, GHCR digest와 registry pull 결과가 없으면 CI01–02 및 CI05–10의 원격 부분은 **NOT TESTED**로 기록한다. Repository admin 인증 성공은 workflow나 artifact PASS가 아니다. D05에서 현재 private plan의 ruleset 미강제 위험을 수용했으므로 이를 blocker로 두지는 않지만 보호가 적용됐다고 표시하지 않는다. GitHub Artifact Attestation은 비활성이고 BuildKit SBOM/provenance만 필수이므로 둘을 혼동하지 않는다.

W20 로컬 실행 결과는 typecheck/lint/build, 24 files/309 Vitest, Chromium 8/8, actionlint, Compose, Markdown 30 files, production audit 0, `linux/amd64` non-root image와 invalid runtime config exit 1, readiness/native SQLite restart persistence까지 독립 QA PASS였다. 당시 원격 CI01–02와 CI05–08은 NOT TESTED/BLOCKED였으나 W22에서 main/PR와 `v0.4.0` release Actions/GHCR, 양쪽 digest의 원격·로컬 persistence와 SBOM/provenance를 PASS했다. [W20 검증 기록](W20_REVIEW.md), [W22 검증 기록](W22_REVIEW.md)

## Scheduling / database

| ID | 검증과 기대 결과 |
| --- | --- |
| SCH01 | strict date-only·윤년·월말·허용 기간, UTC/Seoul/DST 환경 동일 결과 |
| SCH02 | inclusive 근무일 duration, weekend+holiday/연속 휴일, 탐색 상한 |
| SCH03 | Task duration1+, milestone0/start=end, 잘못된 음수·소수 거부; end는 dependency 전 계산과 비교 |
| SCH04 | requestedStart 보존, Auto 이동 warning, dependency 삭제·앞당김 시 요청일로 복귀 |
| SCH05 | FS 분기·합류·여러 선행, self/duplicate/missing/summary endpoint/cycle/미지원 type·lag 거부 |
| SCH06 | Manual interval 유지, FS 및 calendar 변경 충돌 전체 거부, 명시적 Manual edit는 새 요청 |
| SCH07 | milestone 양쪽 endpoint와 chain에서 next-working-day FS, duration0 유지 |
| SCH08 | empty summary 단일 생성 거부; summary+첫 child batch는 최종 snapshot만 검증; 마지막 child 삭제·이동+summary 삭제 원자 처리 |
| SCH09 | nested/hidden descendant min/max span, fractional weighted progress·milestone-only 평균, DB REAL 값 왕복; summary mode auto/요청일null |
| SCH10 | root/sibling order, forward parent refs, reparent/reorder; sort/filter가 WBS나 stable ID를 바꾸지 않음 |
| SCH11 | 결정성·멱등성·입력 불변, leaf 근무일·FS bound·summary containment 성질 |
| SCH12 | Browser/server 동일 fixture, SVAR date end adapter, drag/resize, 단일 명령 중복 저장 방지 |
| DB01 | empty DB migration/ledger/checksum drift/FK pragma/foreign_key_check/WAL/busy 정책 |
| DB02 | bound SQL과 identifier allowlist, project isolation, nth-write fault 시 row·summary·revision 전체 rollback |
| DB03 | task-batch 100 operation/5MiB, unknown field/중복 변경 target, order 정규화, 명시적 삭제와 incident link ID 응답 |

## Import / VBA

| ID | 검증과 기대 결과 |
| --- | --- |
| IMP01 | minimal/full JSON1.0 preview→commit, normalized task/link/order/diff/count, preview DB불변 |
| IMP02 | encoding/JSON/duplicate key/version/unknown/missing field/date/duration/progress/type/mode 오류 path/code |
| IMP03 | payload·기존 DB duplicate ID, whitespace/control ID, missing parent/target·cycle·unsupported constraint 전체 거부 |
| IMP04 | array 뒤 parent forward reference, summary snapshot 차이 preview, derived authority |
| IMP05 | Manual conflict와 byte/task/link/depth/date 상한 초과→부분 commit 불가; direct API도 동일 validation |
| IMP06 | 정보용 Project metadata가 DB를 변경하지 않음; v1 참조는 batch 내부로 한정 |
| IMP07 | 첫·중간·마지막 insert fault 전체 rollback, stale commit 거부, 중단 후 일관된 재조회 |
| IMP08 | wizard file→parse→mapping→business preview→명시적 commit→result, cancel/back/retry/focus/loading |
| IMP09 | CSV UTF8 BOM 유무, reordered/duplicate/missing headers, metadata 일치, quoted comma/quote/CRLF, JSON predecessor cell, blank parent→null, [] 필수, JSON과 동일 결과 |
| IMP10 | 한글/Unicode externalId exact 보존과 API taskId 분리, formula-like text 실행·변형 없음 |

실제 Excel/VBA POC는 [VBA_EXPORT.md](VBA_EXPORT.md)의 각 항목을 PASS/FAIL/BLOCKED/UNKNOWN으로 기록한다. 조직 정책·대상 Workbook은 UNKNOWN, VBA/parser 미구현으로 못 하는 실행은 BLOCKED다. Fixture만으로 실제 POC를 PASS하지 않는다.

POC 필수: VBA 실행/셀 접근, Header 탐색·alias mapping, 필요한 열만 추출, 안정 ID·parent/dependency, 1900/1904 날짜·진척, 한글/escaping/encoding, 승인 위치 JSON과 CSV 저장, 오류 row 보고, 생성 파일의 실제 Web preview/commit. DRM 우회 없이 허용된 입력 경로만 검토한다.

## XLSX / Docker / UI

| ID | 검증과 기대 결과 |
| --- | --- |
| XLS01 | ExcelJS 재개방과 Project/Tasks/Dependencies, metadata·date·모든 task/link 값 비교 |
| XLS02 | canonical APP_BASE_URL/public ID hyperlink, Host header 영향 없음, password/session/internal ID 없음 |
| XLS03 | user string은 string cell, XLSX XML에 user-origin formula/external relationship 없음, 한글 실제 표시 |
| XLS04 | 한 revision snapshot, row/기간/resource limit, content-type·안전한 filename |
| XLS05 | Phase1 PASS 후 별도 Phase2: date/week/month, inclusive bar, weekend/holiday, progress/milestone/summary/print |
| DEP01 | actual arch clean lockfile build, builder/runtime ABI/libc/CPU, require/SELECT1/migration |
| DEP02 | non-root UID/GID, fresh volume·bind mount permission, invalid ownership 시 not-ready |
| DEP03 | live process vs ready SQL/config/migration/FK; checksum failure/readonly volume→503 또는 종료 |
| DEP04 | create/edit→restart/recreate 같은 volume→data/revision 유지, single instance |
| DEP05 | consistent backup→off-host artifact→isolated restore→integrity/FK/read/write/export/restart; 같은 volume 사본은 불충분 |
| DEP06 | context/image/history/log에 .env/PAT/DB/backup 없음; production path/URL/Secure 오류 시작 거부 |
| DEP07 | graceful/forced stop WAL durability, busy timeout, isolated upgrade/rollback |
| DEP08 | Compose `RESOURCE_CATALOG_ADMIN_PASSWORD` 누락 config fail-fast, app 환경 전달, 실제 관리자 인증 201/401, 인증 직후·재생성 후 로그의 정상/오류 비밀번호 원문 비노출 |
| UI01 | Create→Readonly→unlock→CRUD→drag/resize→hierarchy batch→FS→reload |
| UI02 | 401/403/409/412/413/429/500 복원, loading/error/keyboard focus, no-PRO runtime 사용 확인 |
| UI03 | 빈 Project에서도 좌측 Grid와 우측 Chart가 보이고, 첫 Task/Milestone 생성 성공 직후 reload 없이 Grid row와 Chart bar/milestone이 모두 표시 |
| UI04 | 단일 SVAR instance에서 Grid tree와 Chart row·세로 scroll이 동기화되고 parent/open/snapshot 순서가 유지 |
| UI05 | 1440×900 이상 Desktop에서 Project route가 가용 폭을 사용하고 Gantt 높이가 viewport 규칙을 따르며 Grid/Chart Resizer가 유지 |
| UI06 | Task mutation 실패·canonical 재조회 실패·401에서 optimistic ghost 없이 양쪽이 마지막 확정 snapshot으로 복원 |
| UI07 | Direct access는 Readonly이고 unlock 전 create/delete/drag/resize가 보호되며 unlock 뒤만 기존 Task API를 사용 |
| UI08 | create/move/좌우 resize/delete 뒤 reload 시 Grid 값과 Chart 위치가 동일 canonical server 상태와 일치 |
| UI09 | 390×844 좁은 viewport에서 focus 가능한 Gantt 내부 horizontal scroll로 Grid와 Chart 모두 접근 가능하고 document body overflow가 없음 |
| UI10 | 작업공간에 접근 가능한 이름과 keyboard focus가 있고 접이식 설정·작업 control이 기존 label/status 의미를 보존 |
| UI12 | Issue #74: Task Editor 3개 Tab, draft 보존, Arrow/Home/End keyboard, Resource/Group filter/assignment 저장 범위, 관계 2열→1열, sticky Footer, 360/768/1024/1440 horizontal overflow 없음과 기존 401/412/dirty/readonly 회귀 |
| UI13 | Issue #96: 1440/1024px Task Editor에서 작업명·날짜·기간·진행률·Description/URL 및 Resource allocation이 역할별 content-aware 폭을 사용하고, 768/390px에서 1열 전환하며 dialog/document horizontal overflow가 없음. 기존 Task/Assignment/Relation/dirty/stale/readonly 저장 계약 회귀 포함 |
| UI14 | Issue #104: A↔B Dependency가 있어도 unrelated C의 Context Menu mutation이 edit/busy/hierarchy 경계에 따라 활성화되고, linked A는 기존 fail-closed를 유지한다. Task Editor와 server Task/Hierarchy/Subtree Delete도 동일 task/subtree scope를 사용하며 unrelated Link를 canonical snapshot에 보존 |
| UI15 | Issue #201: Summary 접힘/펼침(open/collapsed) 상태 localStorage 저장·복원, project별 격리, stale ID 로드 시 정규화 저장, Quota/Security 예외 graceful fallback, 재진입 및 새로고침 후 동일 트리 상태 유지 |
| UI11 | Issue #3 및 PR #23: 지연 POST 대기/성공 동안 동일 Gantt DOM/API, no document navigation, action 열과 scroll/tree/selection/columns 유지; 순차 추가마다 정확히 한 POST 및 canonical row/bar 한 개, root/child/팝업 없는 명시적 Summary 전환·오류 복구 회귀. [현재 UX 계약](PROJECT_UX.md), [과거 검증 기록](ISSUE_3_REVIEW.md) |

## Requirement traceability와 Release gate

| Requirement | 계획한 증거 |
| --- | --- |
| R01–R05 | AUTH01–12, UI01 |
| R06–R09 | SCH01–12, 공식 API/version/license POC, 기능 Matrix |
| R10–R11 | DB01–03, Architecture dependency boundary |
| R12–R16 | VBA POC, IMP09–10, 공동 계약 검토 |
| R17 | IMP01–10 |
| R18–R20 | XLS01–05, Phase 분리 |
| R21–R22 | DEP01–08 |
| R23–R24 | Agent 설정·독립 QA·Manager 기록과 구현별 build/typecheck/tests |
| R25 | UI01–02, Project List 공개 정책 D02 |
| R29 | UI03–10, SVAR 공식 Grid/Chart·Resizer API와 Browser geometry |
| R30 | CI09–10, main-only publish 조건·immutable tag·digest HTTP persistence smoke |
| R31 | project-create-and-read / project-links-persistence: 목록 삭제 재인증·취소·삭제 후 404 및 기존 서버 권한 |
| R32–R38 | project-gantt-stability / project-task-persistence / project-workspace-layout: 팝업 없는 child 생성·상위 집계·locale·열 선택·geometry·인스턴스 유지 |
| R39–R41 | project-notifications / project-modal-feedback / project-links-persistence, workspace-notification-state / project-share-url: 알림·안전한 진단·링크·clipboard 및 fallback |
| R46 | task-editor-view-model / project-task-editor: 탭 키보드 이동, draft 보존, 반응형 overflow, 기존 Task/Assignment 저장 계약 회귀 |
| R45 | project-create-and-read / project-links-persistence: 1440px wide content, 행 overflow menu keyboard/Escape/focus, 프로젝트 복사·링크 복사·삭제 회귀와 작은 화면 접근성을 검증 |
| R50 | summary-toggle-preference / project-gantt: 프로젝트별 localStorage 접힘/펼침 복원, stale ID 정규화 저장, Quota/Security 예외 안전 처리, DB/API 불변 |

PR gate는 build/typecheck와 관련 unit/integration/E2E, migration 회귀, dependency/license 검토, 문서 일관성이다. 현재 command는 `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`다. 구현 PR은 test ID에 실제 command·결과를 연결해야 한다.

Unauthorized/cross-project write, secret 유출, stale overwrite, cycle 누락, partial import, XLSX formula/link injection, migration/restore 실패, restart 데이터 손실은 release blocker다. QA 보고는 Summary/Requirement Coverage/Test Results/Failures/Security/Regression/Documentation/Remaining Risks/Recommendation을 포함한다.

## Repository layout relocation (#12)

현재 배포 경로와 기존 Compose 프로젝트/volume을 유지하는 전환 절차는 [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md)를 따른다. Docker gate의 `scripts/verify-compose-smoke.sh`는 config/startup/readiness/restart/강제 recreate SQLite 보존에 더해 DEP08을 검사한다. 즉 `RESOURCE_CATALOG_ADMIN_PASSWORD` 누락은 config 단계에서 실패하고, 설정값은 app 컨테이너에 전달되어 실제 인증 정상 201/오류 401을 만들어야 하며, 인증 요청 직후 및 강제 재생성 후의 application log에는 정상/오류 입력 비밀번호 원문이 없어야 한다. 기존 quality/E2E/runtime/registry 권한·검증 gate는 유지한다.

## Test configuration relocation (#13)

설정은 `tests/config/vitest.config.ts`, `tests/config/playwright.config.ts`에 있다. `npm test`, `npm run test:e2e`는 그대로 사용한다. 직접 실행은 `npx vitest run --config tests/config/vitest.config.ts`, `npx playwright test --config tests/config/playwright.config.ts`로 지정한다. 설정 파일 기준 root/testDir/webServer.cwd를 사용하고 E2E DB `.data/playwright.sqlite3`, `.next-e2e`, `test-results/`는 루트 기준으로 유지한다. CI는 `node scripts/verify-test-discovery.mjs`로 루트/외부 cwd의 동일한 테스트 발견을 확인한 뒤 전체 테스트를 실행한다. 편집기에서 자동 발견되지 않으면 같은 설정 경로를 지정한다. 실제 Windows 편집기 UI 검증은 미실행이며 [배치 문서](REPOSITORY_STRUCTURE.md)를 함께 따른다.

## Issue #56 리소스 공수 회귀 검증

- DB migration: 기존 `task_assignments` 호환, nullable allocation 필드, allocation 범위 제약과 workload index를 검증한다.
- Service/API: Project calendar 근무일 기반 M/D, 선택 구간 clipping, M/M 설정 유무, 미설정 allocation 제외, 복수 그룹 Grand Total 중복 방지와 과투입 판정을 검증한다.
- Assignment mutation: resource의 기간/투입률 validation, group allocation 금지, revision/catalog revision 동시성 및 기존 assignment canonical snapshot 보존을 검증한다.
- UI/E2E: 기존 Gantt instance/폭/페이지 수평 overflow 계약을 유지하고 리소스 공수 조회가 프로젝트 작업면 외부 flex sibling으로 Gantt를 축소하지 않는지 전체 Chromium 회귀로 확인한다.
- PR 최종 gate는 version/typecheck/lint/Vitest/build, Chromium 전체 E2E, Docker migration/readiness/SQLite restart, production HTTP·HTTPS browser와 relocated Compose persistence를 모두 통과해야 한다.

## Issue #64 구조화 로그 및 요청 추적 회귀

- `LOG_LEVEL` 필터와 잘못된 설정 fallback을 단위 테스트한다.
- trusted/untrusted `X-Request-ID`, 응답 header, 오류 body와 server log 상관관계를 검증한다.
- 2xx/4xx/5xx lifecycle level, 예상하지 못한 500의 client/server 정보 분리, 민감 필드 redaction을 검증한다.
- readiness failure category 및 장애→복구 전환을 검증하고 정상 health probe가 반복 `info` 로그를 만들지 않는지 확인한다.
- migration CLI가 성공/실패 구조화 진단을 stderr에 남기면서 DB path/내부 오류 원문을 노출하지 않는지 검증한다.
- Docker Compose smoke에서 `runtime_configuration_validated`, `database_migration_completed`, `application_started` 이벤트가 `docker compose logs app`으로 조회되는지 확인한다.


## Issue #57 작업 캘린더 회귀 검증

Issue #57 PR은 기존 gate를 완화하거나 skip해서 통과시키지 않는다. 최신 PR head에서 다음을 검증한다.

- **Domain**: 평일/주말, `NON_WORKING` 평일 override, `WORKING` 주말 override, legacy holiday 호환, 중복·충돌 거부, leap/date 범위, timezone purity.
- **Country fixture**: KR/CN/VN/PH/TH/MX/US의 2026 metadata와 대표 휴일, CN/VN 보충 근무일, 지원 외 연도 `COUNTRY_CALENDAR_UNAVAILABLE`.
- **Migration 0006**: 기존 `project_holidays` row를 Custom Project rule/date로 보존, 기존 Project에 국가 rule 자동 추가 금지, 호환 VIEW/INSERT trigger, 재실행 ledger 안정성.
- **Service/API**: countries/read/preview/replace, edit session/Origin/If-Match, stale revision, Calendar exception 충돌, Calendar→FS/lag=0→Summary 재계산, Manual Calendar/Dependency conflict rollback, dependency cycle/지원 외 구조 오류, revision 정확히 +1.
- **Resource workload**: Project+Group+Resource Effective Calendar를 이용한 M/D, M/M 분자, 일별 allocation/과투입 판정. Group/Resource 휴무가 Project Task start/end를 이동시키지 않는지 검증.
- **Project copy**: source의 materialized Calendar rule/date가 새 Project로 독립 복사되고 source revision/Calendar는 변경되지 않는다.
- **UI/Chromium**: 설정 modal의 Calendar rule/custom date 편집, Preview/저장, canonical snapshot 재조회, 신규 KR 기본 Calendar의 실제 휴일 이동, 기존 알림/geometry/Gantt instance 회귀.
- **Docker**: migration 0006 적용 후 readiness, SQLite restart persistence, production HTTP/HTTPS 인증·Cookie·영속성, relocated Compose persistence.

PR #66 최종 검증 기준은 CI Run #350이며 quality, Chromium E2E 50/50, Docker smoke가 모두 PASS했다. Merge 후 main은 같은 gate를 다시 실행한 뒤 임시 `ci-<SHA>` GHCR image를 exact digest로 검증하고 삭제한다. SemVer release image는 annotated `v0.16.0` tag를 release authority로 사용한다.


## Issue #68 Calendar + Dependency 재계산 회귀

- **Domain**: FS/lag=0 단일/복수 선행, milestone endpoint, 요청일이 bound보다 늦은 경우 유지, Manual lower-bound conflict, cycle/missing/summary/unsupported relation 거부, 입력 불변과 멱등성.
- **Service**: 후보 Calendar로 선행 Auto가 이동하면 후행 Auto가 다음 근무일 FS bound로 이동하고 Summary가 최종 Leaf에서 재집계되는지 검증한다. Preview는 DB/revision을 변경하지 않는다.
- **원인 추적**: 현재 Calendar base와 후보 Calendar base를 비교해 `CALENDAR`를 판정하고 FS forward-pass가 추가로 이동한 작업만 `DEPENDENCY`로 표시한다. Summary는 `SUMMARY`로 표시한다.
- **원자성**: Manual dependency conflict에서 Calendar rule/date, Task/Summary, revision이 모두 원상태인지 검증한다.
- **HTTP/보안**: 기존 edit session, exact Origin, 강한 If-Match, stale 412 계약을 유지하고 cycle/지원 외 graph는 409 structured error를 반환한다.
- **PR gate**: version/typecheck/lint/test-discovery/Vitest/build, 전체 Chromium E2E, Docker migration/readiness/restart persistence를 기존 gate 완화 없이 실행한다.

## Issue #87 Agent Lifecycle와 한정 브랜치 정리 회귀

운영 기준은 [CI_CD.md](CI_CD.md) 9절, 실제 원격 판정은 [REMOTE_VALIDATION.md](REMOTE_VALIDATION.md), 작업 범위는 [ISSUE_87_COMPLETION.md](ISSUE_87_COMPLETION.md)를 따른다. 여기의 계획은 실제 Agent 실행이나 원격 삭제 PASS를 뜻하지 않는다. 아래 `CL87-*`는 PR #88 당시 수행한 **역사적 검증 기록**이며, Issue #124에서 전용 workflow와 `verify-issue-87-cleanup.py`가 퇴역했으므로 현재 실행 지침으로 사용하지 않는다. 현재 branch cleanup 회귀 실행은 이 문서의 Issue #124 절과 `python3 scripts/verify-safe-branch-cleanup.py`를 따른다.

| ID | 검증과 기대 결과 | 실행/근거 |
| --- | --- | --- |
| AG87-01 | ui_ux/frontend/qa_docs의 설계·구현·읽기 전용 책임, 기존 모델/동시 한도 보존, 위임/반환·파일 소유권·실행 불가 시 정직한 상태 기록 | TOML 구문/필수값, AGENTS·구성·Lifecycle·UI 가이드 대조; 실제 runtime은 별도 |
| AG87-02 | release_required와 release_authorized 분리, 명시적 승인 없는 tag/정식 게시 금지, 필요한 미승인 게시를 BLOCKED로 기록, 문서 변경의 release N/A와 main 임시 GHCR 분리 | Lifecycle 정책 시나리오와 독립 리뷰 |
| CL87-01 | [역사 기록] 당시 workflow inline Python을 추출하여 정상 삭제/이미 없음/무관 run 2개, API·CI·PR·SHA·branch 보호 조건 20개를 검증 (모형 24개) | 퇴역된 `verify-issue-87-cleanup.py`의 PR #88 당시 결과. 현재 실행 대상 아님 |
| CL87-02 | 잘못된 event/branch/source repository/workflow/attempt/SHA, 실패·진행 중 CI, 누락·skipped GHCR, job 페이지 초과에서 삭제하지 않음 | 모형 거부 시나리오; 실제 API 통신 실패·권한 부족은 원격 BLOCKED/FAIL로 기록 |
| CL87-03 | merge parent 2개/두 번째=PR head를 요구, squash·잘못된 parent·ancestry 불일치·새 tip·보호 branch·다른 열린 PR 참조에서 삭제하지 않음 | 모형 거부 및 PR #88 `merge_method=merge`, expected_head_sha 확인 |
| CL87-04 | 정상 삭제, push 전 stale tip, 서버 광고 이후 pre-receive 경합에서 명시적 SHA lease가 새 commit/다른 ref를 보존 (실제 로컬 Git 3개) | 격리 bare Git 테스트. 외부 통신 없음; 단일 삭제 refspec, 무조건 force/REST fallback 없음 |
| CL87-05 | 인증값이 Git 인자/설정 파일/로그에 남지 않고 trace/global/system 설정을 배제; PR validation은 contents:read와 credential 미보존, write cleanup은 checkout/fetch/artifact/cache/PR code 실행 없음 | Git 호출 검증, workflow 정적 검토, 실제 Actions 권한/step 로그 |
| CL87-06 | [역사 기록] PR 검증과 실제 원격 삭제를 분리. 당시 모형 24개+Git 3개=27시나리오를 5개 unittest method로 실행 | 퇴역된 Issue #87 전용 validation workflow의 당시 성공 증거. 현재 실행 대상 아님 |
| CL87-07 | 실제 PR #88 merge SHA의 main quality/e2e/docker/main GHCR 모두 success 뒤에만 고정 작업 branch를 삭제하고 ref 404 확인 | main/cleanup run·attempt·job·merge/head SHA, GHCR digest/smoke/SBOM·provenance/package 정리, cleanup summary와 API 404 |

기존 PR quality/e2e/docker와 최종 head의 독립 검토는 유지한다. 이 정리 회귀를 통과해도 main/GHCR/실제 삭제가 아직 실행되지 않았으면 NOT TESTED다. SHA lease 거부, 새 tip, 보호/다른 PR 참조, 필수 CI/GHCR 실패·누락, 권한/네트워크 오류를 무조건 삭제나 retry로 우회하지 않는다. 원격 삭제 postcondition이 미확인이면 이슈를 완료 처리하지 않는다. 정책·모형·Git 검증과 실제 운영 증거를 구분해 PR/Issue에 기록한다.

정리 workflow는 PR #88/고정 branch에 한정하며 다른 main run은 no-op, 이미 없는 branch는 재삭제하지 않는다. 대상 이름을 재사용하지 않고 퇴역은 증거 보존 후 별도 검토된 운영 변경으로 진행한다. 정식 릴리스나 운영 배포를 생성하지 않는다.


## Issue #77 Context Menu 초기 submenu 상태 회귀

- Grid Task 우클릭 직후 root menu만 표시되고 `Add` 및 다른 submenu가 자동 표시되지 않는지 검증한다.
- Chart Task 우클릭에서도 동일한 초기 상태를 검증한다.
- 최초 focus는 root `role=menu` container에 있고, ArrowDown/ArrowUp/Home/End로 명시적 탐색한 뒤에만 menuitem focus가 이동하는지 검증한다.
- `Add` hover와 keyboard focus/ArrowRight에서만 submenu가 표시되고, Escape 후 reopen 시 이전 submenu 상태가 남지 않는지 검증한다.
- Issue #72의 Add / Convert to / Edit / Cut / Copy / Paste / Move / Indent / Outdent / Delete 회귀 테스트를 함께 유지한다.
- 공식 완료 판정은 동일 PR head SHA의 GitHub Actions `quality`, `e2e`, `docker` PASS와 merge 후 main GHCR exact-digest smoke 결과를 사용한다.


### Issue #97 Link persistence

Regression scope includes link command deduplication, protected POST/DELETE contracts, graph validation, revision +1/rollback, SQLite reopen and Docker volume restart persistence, Task Editor relation visibility, and preservation of the mounted Gantt instance during canonical synchronization.


## Issue #108 Excel Gantt 주차 헤더 회귀

- `excelIsoWeekHeader`가 동일 연도 일반 구간에서 ISO 계산 key(`YYYY-Www`)는 유지하고 표시 label은 주차 번호만 반환하는지 검증한다.
- `2026-12-31`과 `2027-01-01`이 기존 규칙대로 같은 `2026-W53` 그룹에 속하면서 둘 다 `53`으로 표시되고, `2027-01-04`는 `2027-W01`/표시 `1`로 전환되는지 검증한다.
- Excel `Gantt` 월 헤더 `YYYY-MM`, 일 헤더, 작업 데이터, 스타일, merge 범위, 관계 DrawingML, 다른 sheet 계약은 변경하지 않는다.
- PR gate는 version consistency, typecheck, lint, 전체 Vitest, Markdown link, production build, Chromium E2E, Docker smoke를 기존 기준 그대로 적용한다.
- 병합 후 main CI와 임시 GHCR image exact-digest smoke가 PASS한 뒤, 승인된 `v0.23.2` annotated tag에 대해 정식 GHCR release image를 게시하고 digest 재검증한다.


## Issue #84 Project List 검색·필터

- Unit: 공통 text trim/case normalization, contains/not-contains/equals, null owner와 assigned/unassigned, browser timezone calendar date 변환, equals/before/after/inclusive range, Quick Search + advanced AND, invalid range validation, deletedIds 조합과 source order 보존을 검증한다.
- Browser: Project명/owner/description 검색, 고급 조건 수, 결과/전체 count, 결과 0건 전용 empty state와 reset, 날짜 조건, Escape focus restore, 검색 상태의 Row Action과 삭제 성공 후 결과 제거, 입력 중 Project collection API 재조회 없음, 390/768/1024/1440 viewport document overflow를 검증한다.
- 기존 Project List 회귀인 Link, Copy, clipboard fallback, 삭제 취소/credential failure/success/conflict와 EmptyProjects는 기존 E2E suite를 계속 실행한다.
- API/DB schema는 변경하지 않으므로 API/DB 문서 회귀는 N/A다. 공식 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker`, 병합 후 main 임시 GHCR exact digest smoke, 승인된 정식 release image exact digest smoke를 사용한다.


## Issue #124 공통 Branch Cleanup 안전성

- 공통 `safe_branch_cleanup.validate_snapshot`은 merged PR/base/main/repository/branch identity와 정확한 merged head tip을 검증한다.
- 현재 branch tip이 merged PR head와 다르거나 삭제 직전 ref가 바뀌면 FAIL한다.
- target main SHA ancestry 불일치, protected branch, branch를 head/base로 사용하는 open PR이 있으면 FAIL한다.
- 정상 조건에서만 explicit SHA `--force-with-lease` 삭제 경로를 허용하며 REST 무조건 ref DELETE fallback은 금지한다.
- repository policy regression은 완료된 Issue별 release/cleanup helper가 active workflow로 재도입되지 않는지와 workflow 내부 직접 branch deletion 패턴을 `.yml`/`.yaml`, short/long delete option, empty-source refspec, YAML folded `run`까지 검사한다.
- quality job에서 `python3 scripts/verify-safe-branch-cleanup.py`를 실행하며 기존 typecheck/lint/unit/markdown/build/E2E/Docker gate를 대체하지 않는다.
- Issue #68/#72/#75/#76/#80/#83/#84/#87/#96/#97/#104/#108 전용 완료 helper와 #87 전용 verifier는 퇴역 대상으로 확인한다.
- application code/API/DB/UI와 현재 package version은 변경하지 않는다. 정식 release는 N/A이며 merge 후 main CI와 정책상 임시 GHCR exact-digest smoke/cleanup은 별도 원격 증거로 확인한다.

## Issue #115 작업 캘린더 미리보기 상태 회귀

- 실제 Chromium에서 신규 KR 캘린더를 US로 바꾸면 기존 결과가 즉시 숨겨지고 재계산 요청·저장 요청의 국가 코드가 모두 US인지 확인한다. 저장 성공 뒤 응답을 미리보기로 재사용하지 않고 canonical 재조회 경로를 유지한다.
- 국가/적용 범위/시작일/종료일, 휴무일 이름/날짜/대상/대상 선택, 규칙·휴무일 추가/삭제 각각의 변경은 이전 미리보기를 무효화한다. 원래 값으로 되돌려도 명시적 재계산 전에는 결과를 다시 표시하지 않는다.
- Preview 실패와 응답 형식 오류는 결과를 지우고 재시도 안내를 표시한다. 요청 중 초안 잠금, metadata 저장으로 설정 창이 닫힌 뒤 늦은 응답 무시와 401/412 분기는 전용 E2E에서 검증한다. 현재 If-Match 헤더 전송과 응답 내부 calendar revision 일치 검사는 코드에서 확인하며, 내부 revision 불일치 응답을 별도 E2E로 주입하지 않는다. 같은 editor mount 상태에서 revision prop만 바뀌는 경로는 현재 브라우저 UI에 없어 코드 경계·원격 회귀로 별도 확인한다.
- 390/768/1024/1440px에서 상태 문구와 미리보기·저장 버튼이 접근 가능하고 의도하지 않은 문서 가로 overflow가 없는지 확인한다. 변경 전후 화면은 비밀값 없는 별도 PNG로 보관한다.
- 전용 테스트는 `tests/e2e/project-work-calendar-preview.spec.ts`이며 기존 전체 E2E를 대체하지 않는다. PR head의 `quality/e2e/docker`와 main GHCR digest 검증은 원격 실행 증거로 별도 판정한다. API/DB/스케줄링 계약은 바꾸지 않으므로 관련 계약 문서 변경은 N/A다.

## Issue #116 작업 Context Menu 하위 메뉴 회귀

- `tests/e2e/project-task-context-menu.spec.ts`에 390/768/1024/1440px의 네 viewport 모서리 메뉴 anchor를 추가한다. 각 경우 활성 `Add` 하위 메뉴 전체가 viewport gutter 안에 있는지, 오른쪽/왼쪽 flyout 또는 같은 폭 drilldown으로 배치되는지 검사한다.
- 390px에서는 최초 root focus와 닫힌 child, focus만으로 열리지 않음, ArrowRight·click·Enter·Space 진입, ArrowLeft·Back 복귀, Escape 전체 닫힘과 원래 Task focus 복원을 검사한다. Convert to/Move/Paste의 좁은 drilldown과 명령 접근, 명령이 모두 비활성인 외동 Task의 Move 및 자식이 있는 Summary의 Convert to에서 Back focus fallback도 검사한다. 넓은 화면에서는 기존 hover/focus/#77 초기 상태와 세 하위 메뉴의 좌우 배치·활성 명령 접근, ArrowLeft 뒤 부모 focus·child hidden·`aria-expanded=false`를 검사한다. 또한 열린 Add child에서 일반 root 명령 `Edit`로 focus 또는 pointer가 이동하면 child가 닫히고 Add의 `aria-expanded=false`가 되는 회귀를 검사한다.
- 390×160 짧은 화면에서는 실제 End/Home/ArrowDown 키보드 탐색으로 root 내부 스크롤·마지막/root 중간 명령 가시성·문서 scroll 불변을 검사한다. 하위 메뉴 마지막 명령 접근, sticky Back, 좁은 화면의 실제 명령과 Gantt instance 유지도 확인한다. 기존 #72 명령과 #104 endpoint Link 분리는 `project-task-context-menu.spec.ts`에 있으며 readonly 계약은 별도 `task-context-menu-hierarchy.spec.ts`가 검사한다.
- 2026-09-24 현재 코드를 작성했으나 로컬 Playwright, unit, lint, typecheck, build는 **실행하지 않았다(NOT TESTED)**. 자동 테스트의 계획/작성은 PASS 증거가 아니다. 로컬 실행 시 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-task-context-menu.spec.ts`와 변경 파일 lint/typecheck를 먼저 수행하고, PR head의 quality/e2e/docker는 해당 run의 원격 증거로 별도 판정한다.


## Issue #117 리소스 공수 조회 상태 회귀

- `tests/e2e/project-resource-workload-status.spec.ts`는 공수/assigned-targets의 첫 실패, 부분 실패, 개별 재시도, stale 결과, 네트워크 실패와 형식이 잘못된 HTTP 200 응답을 검사한다.
- assigned-targets가 최신 이름/코드를 반환하고 workload가 stale이어도 Group·Resource 행 라벨이 최신 메타데이터를 우선 표시하는지 검증한다.
- 개별 재시도 버튼은 요청 중에도 DOM에 유지되어 disabled/aria-busy가 되고 keyboard focus가 보존되는지, 재실패 후 같은 재시도 제어로 복귀하는지 검사한다.
- M/D·M/M, 검색/종류/활성/기간 필터, 열린 details, tab 왕복, SVAR Gantt instance 및 좁은 viewport의 overflow 계약을 유지한다.
- 진행 중 전역 새로고침 중복 요청 방지와 화면 이탈 뒤 늦은 응답 무시를 검사한다. API/domain/revision 계약 변경은 없으므로 API·DB·Scheduling 문서 영향은 N/A다.
- 최종 판정은 최신 PR head의 원격 `quality/e2e/docker` 전체 결과를 사용하며 이전 head의 PASS는 재사용하지 않는다.


## Issue #118 Project Context와 일정 도구줄 회귀

- `tests/e2e/project-context-toolbar-responsive.spec.ts`는 390/768/1024/1440px에서 긴 Project 이름만 말줄임되고 읽기 전용/편집 중 badge·정보·핵심 action 문구가 단일 행으로 viewport 안에 보이는지, 긴 설명의 정보 panel이 viewport 안에서 스크롤 가능한지 확인한다.
- 일정 도구줄은 390/768px에서 검색·필터가 첫째 줄, 결과·조건부 초기화가 둘째 줄인지 확인한다. 검색 결과·초기화 후 검색 focus, 필터 버튼의 `aria-controls`/`aria-expanded`, panel Escape 후 닫힘과 필터 버튼 focus 복원을 검증한다.
- readonly/editing 양쪽에서 검색·필터 전후 Gantt 상단 위치·높이와 document 가로 overflow, 일정↔리소스 tab 왕복 시 동일 Gantt DOM/API instance를 확인한다. 같은 spec에서 SVAR 내부 scale toolbar의 주 단위 선택과 차트 내부 가로 스크롤이 검색·초기화·tab 왕복 뒤 유지되는지도 확인한다. Scale 단위 전환 자체는 `tests/e2e/project-gantt-scale.spec.ts`, tab 왕복의 가로 스크롤은 `tests/e2e/project-workspace-ux.spec.ts`, tree 접힘·선택·column 표시/너비 상태의 기존 mutation 회귀는 `tests/e2e/project-gantt-stability.spec.ts`, column 메뉴와 긴 목록 스크롤은 `tests/e2e/project-workspace-layout.spec.ts`가 각각 검사한다. 새 #118 spec은 tree/column을 직접 변경하지 않으므로 이 계약의 이번 조합별 검증으로 과대 해석하지 않는다. SVAR 내부 scale toolbar CSS/구현은 수정 대상이 아니다.
- 이 명세의 `search-idle`/`search-reset` PNG는 새 구현에서 검색 전과 초기화 후를 기록할 예정이며 구현 전후 증거가 아니다. 높이 개선의 전후 판정에는 동일 fixture·viewport·readonly/editing 상태에서 구현 전 baseline과 변경 후 Gantt 위치·높이를 별도 측정해야 한다. 기존 390×844/768×1024 자료는 새 동일 fixture 비교의 수치 기준으로 사용하지 않는다. 전용 `Issue #118 구현 전후 레이아웃 증거` Workflow는 Before `703a6f08595dea06a918366192df464d7215108e`와 After `6386db860af69635cfb0fe626fd1a937905b9a56`에 동일 harness를 적용하고 390/768/1024/1440px 모두 **높이 844px**로 고정하여 editing/readonly를 측정한다. 390/768의 Gantt 가시 높이 개선, After document horizontal overflow 부재, 정보 컨트롤 단일 행을 Gate로 하고 raw metrics·comparison·before/after screenshot을 `issue-118-before-after-evidence` artifact에 보관한다. 일반 원격 `quality/e2e/docker`와 evidence Workflow는 서로 대체하지 않으며 최신 PR head에서 각각 판정한다. API/DB/Scheduling 테스트 및 문서 변경은 계약 불변으로 N/A다.


## Issue #119 반복 입력과 오류 연결 회귀

- `tests/e2e/project-repeated-input-accessibility.spec.ts`는 390/768/1024/1440px에서 Project 생성, 작업 캘린더, 반복 리소스 할당을 keyboard-only 제출한다. 각 필드의 고유 accessible name·fieldset/legend, `aria-invalid`·`aria-describedby`와 표시 오류, 제출 뒤 summary focus 및 요약 항목→오류 입력 focus를 검사한다.
- 잘못된 Project 생성은 POST 0회, 잘못된 캘린더 Preview/Save는 각각 POST/PUT 0회, 잘못된 할당은 PUT 0회를 검사한다. 입력 초안·date/percent 값, 키보드 조작과 문서 가로 overflow도 확인한다. 기존 생성 회귀인 `tests/e2e/project-create-and-read.spec.ts`의 단일 오류 text 기대는 새 복수 오류 요약과 필드 오류 링크에 맞춰 갱신하되 정상 생성·조회·복사·삭제 경로는 유지한다.
- #115의 `tests/e2e/project-work-calendar-preview.spec.ts`는 유효한 초안의 Preview/Save, 상태·실패·401/412·stale 응답을 계속 검증한다. 작업 저장/할당 저장 독립성과 revision·권한 계약은 기존 `tests/e2e/project-task-editor.spec.ts` 및 전체 원격 회귀로 함께 확인한다. 해당 API/domain 코드는 바꾸지 않는다.
- 로컬 Playwright·lint·typecheck·build·browser는 사용자 지시에 따라 **NOT TESTED**다. 작성된 명세의 PASS를 주장하지 않고 PR head의 `quality/e2e/docker` 실제 run으로 판정한다. API·DB·Scheduling 문서 갱신은 계약 불변으로 N/A다.

## Issue #121 App Shell 본문 바로가기 회귀

- `tests/e2e/skip-link.spec.ts`는 390/1440px에서 첫 Tab이 header 앞의 `본문으로 바로가기`에 도착하고 링크가 viewport 안에서 보이는지, 그 focus 순간의 PNG, `href=#main-content`/main `id`/`tabIndex=-1`, Enter 뒤 main focus, 다음 Tab이 본문 control로 이어지는지 검사한다. 본문 control이 없는 조회 중 상태는 main focus까지만 검사한다.
- 빈 Project 목록·리소스 관리·생성 화면·Project 조회 중·조회 오류·정상 Gantt 화면에서 같은 landmark를 확인한다. 프로젝트 목록→리소스 관리 Next client navigation에서는 동일 main DOM을 확인하고, reload 뒤 첫 Tab도 검사한다. 테스트용으로 main 높이를 늘려 아래로 스크롤한 뒤 skip을 실행해 scroll 위치가 main 쪽으로 되돌아오는지 확인한다.
- Modal dialog가 열리면 기존 focus trap 안에 Tab focus가 남고 skip link가 선점하지 않으며 Escape 뒤 설정 trigger focus를 복원하는지 확인한다. Skip 동작 중 API mutation 0회, 동일 Gantt DOM/API instance, document 가로 overflow 부재를 확인한다.
- 오류·읽기 전용·편집 중 Project에서 skip link Enter 후 main focus와 다음 Tab의 본문 control 이동, 화면 상태 안정성, edit-session/current GET 및 document navigation 0회를 확인한다. 같은 문서의 해시만 바뀐 popstate는 재확인 대상이 아니며, 실제 history 복귀의 재확인과 실패 시 읽기 전용 재시작은 `project-edit-permission-recheck.spec.ts`가 계속 검증한다. BFCache `pageshow.persisted` 분기는 코드에서 유지 여부를 확인하고 환경별 실제 BFCache 재현은 별도 증거로 판정한다.
- Native fragment focus/scroll가 브라우저별로 충분한지 실제 Chromium E2E에서 판정한다. API/DB/Scheduling 계약은 변경하지 않으므로 관련 문서·테스트 영향은 N/A다.

## Issue #130 Phase 1 Project List 시각·동작 회귀

- `tests/e2e/project-list-search-filter.spec.ts`의 Phase 1 명세는 긴 한국어·영어 이름과 설명, 소유자, 3행 이상의 동일 fixture에서 390×844·768×900·1024×900·1440×900·1600×900을 순회한다. Browser zoom 100%에서 native table과 62rem 최소 폭, wrapper 내부 스크롤, 문서 가로 overflow 없음, 설명 최대 두 줄, compact 행 높이, More 열 너비를 확인하고 viewport별 새 구현 상태 PNG를 남긴다.
- 각 폭에서 마지막 행 More 메뉴의 viewport bounds, 첫 명령 focus, End/Home 탐색, Escape 닫힘과 trigger focus 복원을 확인한다. 390px는 Project Link에서 Tab으로 More trigger에 도착해 Enter로 연다. 검색 결과 0건 상태와 초기화 후 원래 3행 복귀를 확인한다. 좁은 화면에서 유효한 Quick Search·프로젝트명 조건과 잘못된 생성일 범위를 함께 설정해 날짜 오류가 화면 안에 표시되고 유효한 조건의 단일 결과가 유지되는지도 확인한다. 기존 #84 명세의 AND predicate·결과 수·날짜·삭제 상태, 기존 Project Link/Copy/delete 인증·If-Match·401/412 회귀는 기존 전용 E2E와 전체 원격 suite를 유지한다.
- 구현 전후 시각 비교는 동일 fixture·viewport·zoom·상태의 **별도 baseline**과 변경 후 wrapper/열/행/overflow/menu 수치·PNG가 필요하다. 작성된 `issue-130-list-current-*.png`는 변경 후 상태만 기록하며 개선 수치가 아니다. 로컬 브라우저·Playwright·lint·typecheck·build와 실제 전후 캡처는 사용자 지시에 따라 **NOT TESTED**다. PR head의 `quality/e2e/docker`는 실제 run 증거로 판정한다. API/DB/Scheduling 계약 불변으로 해당 문서·테스트 변경은 N/A다.

## Issue #130 Phase 2 Project Workspace 시각·동작 회귀

- `tests/e2e/project-workspace-ux.spec.ts`의 Phase 2 명세는 동일한 긴 한국어·영어 제목/설명 fixture에서 390×844·768×900·1024×900·1440×900·1600×900의 읽기 전용/편집 중 상태를 확인한다. 제목 ellipsis와 전체 이름 `title`, badge·정보·핵심 action·더보기의 단일 행/viewport 접근, Context와 Gantt top/height, 문서 가로 overflow를 기록한다. 각 폭의 PNG는 현재 구현 상태다.
- 정보/더보기 panel의 viewport bounds와 Escape 닫힘·summary focus 복원, 일정/리소스 탭의 `aria-controls`·tabpanel·Home/End focus 및 같은 Gantt instance를 검증한다. 조회 중·오류 상태와 재시도 뒤 작업공간 복귀도 별도 route 명세로 확인한다. 기존 `project-workspace-ux.spec.ts`는 ArrowLeft/ArrowRight와 chart scroll을, `project-context-toolbar-responsive.spec.ts`는 주 단위 선택과 chart scroll을, `project-gantt-stability.spec.ts`는 tree/column/selection 회귀를 계속 검증한다. 새 Phase 2 명세가 모든 조합에서 tree/column/selection을 직접 조작한 것으로 해석하지 않는다.
- 동일 fixture·viewport·권한 상태의 **구현 전** Context/Gantt geometry·PNG baseline과 변경 후 수치를 별도로 측정해야 시각 개선을 판정할 수 있다. 작성된 새 구현 PNG나 과거 다른 viewport 수치를 전후 증거로 사용하지 않는다. 로컬 브라우저·Playwright·lint·typecheck·build 및 실제 전후 측정은 사용자 지시에 따라 **NOT TESTED**다. PR head의 `quality/e2e/docker`는 실제 run 결과로 별도 판정한다. API/session/revision/domain 계약 불변으로 API·DB·Scheduling 문서 영향은 N/A다.

## Issue #130 Phase 3 Task Editor 시각·동작 회귀

- `tests/e2e/project-task-editor.spec.ts`의 Phase 3 명세는 동일 Task fixture에서 390×844·768×900·1024×900·1440×900·1600×900 modal bounds, header 유형/External ID/Revision, tabs→본문→footer 수직 구조, 문서/대화상자 가로 overflow, footer 버튼 접근을 확인한다. 390px의 본문 스크롤 중 header/footer geometry가 유지되는지와 768px에서 내용이 넘칠 때 같은 계약을 확인한다. 1024px 이상은 작업명·진행률과 선행/후행 관계를 나란히, 390/768px은 한 열로 확인한다. 각 PNG는 새 구현 상태다.
- 같은 spec의 기존 명세가 modal focus trap/Escape dirty confirmation·원래 Task focus 복원, readonly/stale/412/failed reload의 초안 보존, 저장 중 PATCH 1회와 If-Match/canonical 결과, tab 키보드 이동, Resource 검색·Assignment 독립 저장 경계를 계속 확인한다. #119 반복 할당의 fieldset·오류 연결은 `project-repeated-input-accessibility.spec.ts`가 직접 검사한다. 새 Phase 3 viewport 명세만으로 모든 상태 조합을 직접 검증한 것으로 해석하지 않는다.
- 구현 전후 비교에는 같은 fixture·viewport·상태의 기존 modal/header/body/footer/필드·관계 geometry와 PNG baseline이 별도로 필요하다. 현재 baseline·실측과 로컬 Playwright·lint·typecheck·build·브라우저 검증은 사용자 지시에 따라 **NOT TESTED**다. PR head의 `quality/e2e/docker`는 실제 run 결과로 판정한다. Task PATCH/Assignment PUT/API·DB·Scheduling 계약은 변경하지 않으므로 관련 문서 영향은 N/A다.

## Issue #130 Phase 4 Search / Filter 공통 회귀

- `tests/e2e/project-filter-toolbar-consistency.spec.ts`는 Project List, 일정, 리소스에서 390×844·768×900·1024×900·1440×900·1600×900의 검색/필터/조건부 초기화/일치·전체 결과를 확인한다. 좁은 폭은 실제 control bounds의 첫째/둘째 행 겹침과 viewport 접근, 문서 가로 overflow를 확인한다. Reset 후 검색 focus, 고급 패널 Escape 뒤 필터 trigger focus 및 `aria-controls`/활성 조건 수를 검증한다. PNG는 변경 후 상태만 기록한다.
- Project List의 기존 `project-list-search-filter.spec.ts`가 #84 AND predicate·timezone 날짜·역순 날짜 오류 무시·no-result·삭제를 유지한다. 일정의 기존 `project-context-toolbar-responsive.spec.ts`와 `project-search-filter` 회귀는 client 필터·Gantt instance/scale/scroll을 확인한다. Phase4 전용 명세는 일정 섹션 설명이 정적이며 동적 결과 수는 도구줄 한 곳에만 있는지도 확인한다. Resource는 기존 `project-resource-workload-status.spec.ts`가 독립 공수/메타데이터 상태, M/D·M/M, 조회 중·실패·stale/부분 실패와 열린 details 보존을 검사하고, 고급 패널로 옮긴 종류·활성·Task 기간 control을 계속 조작한다. 날짜 역순은 기존 자동 양끝 정렬을 안내한다. 한쪽 날짜 입력은 '두 날짜 모두 입력' 안내와 함께 적용 조건 수에서 제외하고 Reset은 제공하며, 기존 Task 기간 predicate와 결과에는 적용하지 않는다. 오류 카드의 #120 상태 토큰과 390/768 도구줄 control viewport 접근은 정적 CSS 검토·원격 E2E에서 판정한다. 필터 입력·초기화는 API 재조회/보호 mutation 0회를 검증한다.
- 같은 fixture·viewport·상태의 구현 전 geometry/PNG baseline과 변경 후 자료를 별도로 비교해야 시각 개선을 판정할 수 있다. 로컬 Playwright·lint·typecheck·build·브라우저 및 전후 실측은 사용자 지시에 따라 **NOT TESTED**다. PR head의 `quality/e2e/docker`는 실행 결과로 별도 판정한다. API/domain/predicate 계약 불변으로 API·DB·Scheduling 문서 변경은 N/A다.

## Issue #155 Gantt Grid·Chart native 전체화면

- `tests/e2e/project-gantt-fullscreen.spec.ts`: 390×844·768×900·1024×900·1440×900에서 native fullscreen target이 `.project-gantt-frame`인지, App Shell·프로젝트 정보·검색/필터·리소스 panel이 target 밖인지, 버튼/`Ctrl/Cmd+Shift+F`/Escape와 진입·종료 focus, scale toolbar·Grid·Chart bounds, viewport resize 뒤 실제 상태 표시, 같은 SVAR instance/API identity, 보호 mutation 0회와 route 이탈 정리를 확인한다. 캡처는 변경 후 상태이며 동일 fixture의 구현 전 baseline과 혼동하지 않는다.
- 같은 spec은 실제 Grid↔Chart splitter와 작업 열 너비를 조정한 뒤 Summary collapse·선택·표시 열·주 단위·Chart 가로 scroll·Gantt 세로 scroll 및 Grid row↔Chart bar 정렬 보존을 확인한다. Fullscreen 안의 작업 메뉴 Escape 뒤 메뉴 닫힘·유효 focus·실제 fullscreen 상태와 버튼 표시 일치, 입력/contenteditable/dialog shortcut guard를 유지한다. Issue #372 회귀로 Grid/Chart double click과 Context Menu → Edit, readonly 조회 및 Relation Editor가 **`document.exitFullscreen()`을 호출하지 않고** native fullscreen 위에 표시되는지, 저장/취소/닫기 뒤에도 같은 Gantt instance와 fullscreen이 유지되는지 검사한다. 테스트는 fullscreen 진입 뒤 `document.exitFullscreen()`을 거부하는 guard를 설치해 Editor open 경로의 강제 종료 호출이 0회인지 판정한다. Relation Editor fixture는 연결선의 두 endpoint를 같은 가시 날짜 구간에 배치해 DOM link target이 실제 viewport에 렌더링된 뒤 double click을 수행한다. Request rejection은 기존처럼 별도 검증하고, 메뉴/Escape가 native fullscreen 자체를 종료할지는 브라우저 정책에 맡긴다. 기존 Task Editor dirty·stale·401/412·If-Match·Assignment 독립 저장은 별도 전용 spec의 계약을 유지한다.
- Fullscreen API는 사용자 활성화·권한·브라우저 구현에 의존한다. 로컬 Playwright·lint·typecheck·build·브라우저와 실제 Edge/Chrome 수동 동작은 사용자 지시에 따라 **NOT TESTED**다. PR head `quality/e2e/docker`는 새 실행 결과로 판정한다. API/DB/Scheduling 문서는 계약 불변으로 N/A다.

## Issue #171 전체화면 우측 컨트롤 비중첩 회귀

- `tests/e2e/project-gantt-fullscreen.spec.ts`의 기존 390×844·768×900·1024×900·1440×900 반복 검증에서 fullscreen 알림 버튼과 `Gantt 전체 화면 종료` 버튼의 실제 bounding box를 비교해 교차 영역이 없음을 확인한다.
- 같은 반복에서 알림 버튼을 실제 클릭해 `오류 알림함` dialog를 열고 닫은 뒤 동일 Gantt root/instance가 유지되는지 확인하고, 기존 전체화면 종료 동작을 이어서 검증한다. 단순 z-index 변경이나 pointer-events 우회로 클릭 가능성을 가장하지 않는다.
- 일반 화면 배치와 Fullscreen API/state/focus/scroll/selection 계약은 #155 회귀가 계속 담당한다. API/DB/Scheduling 문서는 계약 불변으로 N/A이며 로컬 Playwright·lint·typecheck·build·브라우저는 **NOT TESTED**; 정확한 PR head의 `quality/e2e/docker` 결과로 공식 판정한다.

## Issue #136 공통 헤더 빌드 버전 회귀

- `tests/e2e/workspace-header-version.spec.ts`는 `package.json.version`과 화면의 `v<SemVer>`가 일치하는지 검사한다. Infra가 version을 올린 PR 빌드에서도 테스트가 같은 package 원천을 읽으므로 화면의 수동 고정값을 허용하지 않는다.
- 390px에서는 기존 M 마크만 보이고, 480px에서는 브랜드 이름을 우선해 버전을 숨기며, 768/1024/1440px에서는 브랜드 옆 버전이 낮은 글자 위계로 보이는지 검사한다. 다섯 폭 모두 헤더 높이 57px 이하, 주요 navigation/알림 영역의 viewport 내 배치와 문서 가로 overflow 부재를 확인하고 변경 후 PNG를 남긴다. 홈 링크의 접근 가능한 이름·`href=/`·리소스 이동 후 홈 복귀 및 navigation `aria-current`도 확인한다.
- 로컬 Playwright·lint·typecheck·build·브라우저 및 실제 구현 전후 화면 비교는 사용자 지시에 따라 **NOT TESTED**다. 작성된 명세와 PNG 경로는 실행 증거가 아니다. PR head의 `quality/e2e/docker`는 실제 run에서 별도 판정한다. API/DB/Scheduling 및 보안·권한 계약 불변으로 해당 문서·테스트 변경은 N/A다.

## Issue #141 브라우저 제목과 파비콘 회귀

- `tests/e2e/project-browser-title-favicon.spec.ts`는 실제 격리 SQLite Project 세 건으로 목록·리소스·생성·Gantt 데모의 정확한 `masterGantt` 제목, 직접 URL의 서버 GET 전체 HTML에 포함된 초기 `masterGantt|canonical name`과 hydration 뒤 제목을 구분해 검사한다. 새로고침, SPA A→목록→B 이동, 같은 이름·서로 다른 publicId의 프로젝트→목록→다른 프로젝트 이동 및 프로젝트 이탈 후 기본 제목 복원도 확인한다. 로딩 중 잠시 기본 제목은 허용하며 404·클라이언트 조회 실패에서는 기본 제목을 확인한다.
- 프로젝트 이름 초안과 HTTP 500 저장 실패·401은 마지막 확정 이름을 유지하고, 성공한 metadata 저장은 전체 페이지 reload 없이 새 확정 이름을 제목에 반영하는지 확인한다. 412 재조회 대기 중에는 기본 제목으로 돌아갔다가 성공한 canonical 재조회 뒤 이름을 복원하는지 검사한다. 비밀번호·세션·If-Match·서버 인가 경로 자체는 기존 회귀에서 계속 검증한다.
- `<head>`의 SVG icon 링크와 해당 응답의 HTTP 200·M 브랜드 색상·SVG MIME을 확인한다. SVG 링크/응답만으로 실제 브라우저 탭 렌더링을 PASS로 보지 않으며 Edge/Chrome/Firefox/Safari 수동 시각 검증은 별도다. 로컬 Playwright·lint·typecheck·build·브라우저는 사용자 지시에 따라 **NOT TESTED**이고 원격 PR head의 `quality/e2e/docker`는 실제 run 결과로 판정한다. API/DB/Scheduling·보안·권한 계약 및 DESIGN/UI_UX_GUIDELINES 공통 원칙은 바뀌지 않으므로 해당 문서 영향은 N/A다.
- App Router의 `src/app/error.tsx`는 기존 오류 기록·다시 시도 버튼을 유지하면서 기본 제목을 복원한다. 전용 E2E는 malformed 프로젝트 조회 응답으로 client render 오류 경계를 유도해 오류 화면·재시도 버튼·기본 제목을 확인한다. 서버 렌더 DB 오류까지 별도로 주입한 것은 아니므로 그 경우의 화면·제목은 코드 검토와 원격 일반 회귀 범위로 구분한다.

## Issue #138 프로젝트 상태와 목록 필터 회귀

- DB/서비스 통합 테스트는 `0008_project_status.sql` 적용 전 기존 프로젝트가 `in_progress`로 채워지고, 신규 생성의 생략된 상태가 `planned`이며, `NULL`·미지원 값이 DB CHECK/API validation에서 거부되는지 확인한다. migration 실패 rollback, 기존 DB의 재시작 후 상태 지속, 상세·목록의 필수 `status`, 복사본의 `planned`, 기존 프로젝트 식별자·revision 보존도 검증한다.
- Project create와 PATCH는 세 상태의 생성·왕복 전환(특히 `completed → in_progress` 재전환), status만 변경하는 PATCH, 빈/알 수 없는 값 거부를 검증한다. 편집 세션·Origin 403·strong `If-Match`·revision 증가·`changedFields`·canonical snapshot, readonly 401과 stale 412, TaskField create 및 다른 metadata와 task-field metadata 갱신 시 상태 보존을 기존 계약과 함께 확인한다. Link/Hierarchy/Subtree mutation의 canonical project에도 같은 status가 유지되어야 한다. 상태 변경은 Task 잠금·일정 재계산을 유발하지 않는다.
- Excel export 테스트는 Project sheet의 기존 metadata·holiday 행을 보존하면서 마지막 데이터 행 뒤에 `프로젝트 상태`와 해당 한국어 표시명(`예정`/`진행 중`/`완료`)을 추가했는지 확인한다. Task 대상 import는 프로젝트 metadata를 갱신하지 않으므로 status import는 이번 범위에 없다.
- Project List E2E는 A=`planned`, B=`in_progress`, C=`completed` fixture로 첫 진입·새로고침 때 A/B만 표시되는지, 각 단일 상태·복수 조합·전체·아무것도 선택하지 않은 경우를 검사한다. 같은 List view에 있는 동안 선택을 유지하고 새 페이지 진입은 기본 A/B로 돌아오며 URL/localStorage는 사용하지 않는다. 검색어·기존 날짜 등 조건과 상태 선택은 AND이고, 기본 상태 선택은 `필터 N`에 가산되지 않으며 기본에서 벗어난 선택(전체/없음 포함)은 상태 조건 1개로 센다. Reset은 검색·기존 조건·상태 선택을 초기화하고 검색 focus를 복원한다.
- 별도 `상태` 열의 텍스트 badge, 생성의 기본 `예정` select, Workspace의 확정 상태 표시, 편집자 Settings의 상태 select와 readonly text를 검증한다. 상태 저장 성공 뒤 canonical 응답이 현재 화면과 재진입 목록에 반영되고, 실패/401/412 시 초안·확정 상태가 섞이지 않아야 한다. 빈 DB 안내와 필터 결과 없음(특히 상태 0개 선택) 안내를 구분하고, 완료 항목이 기본 숨김임을 설명한다.
- Keyboard-only로 native 상태 선택·필터 checkbox·Reset·Escape 후 trigger focus와 focus-visible을 확인한다. 390/768/1024/1440px에서 열과 필터 panel을 접근 가능하게 유지하고, 좁은 화면의 표 내부 가로 스크롤은 허용하되 문서 가로 overflow는 없어야 한다. 상태를 색상만으로 구분하지 않는다.
- 테스트 코드는 작성 대상이나 로컬 unit/integration/Playwright/lint/typecheck/build/browser는 사용자 지시에 따라 **NOT TESTED**다. PR 생성 후 해당 정확한 head의 `quality/e2e/docker` 실행 시작을 확인하며 완료/PASS로 해석하지 않는다. 기존 Docker 8299와 preview 8301–8303의 DB/volume을 건드리지 않고 #138 후보는 별도 preview 환경에서 readiness만 확인한다.

## Issue #140 Grid 작업명 인라인 편집 회귀

- 설치 SVAR Gantt 2.7.3의 `text` column built-in editor와 공개 Gantt `getTable(true)`→Table `open-editor` 한 번 클릭 경로를 전용 E2E에서 검증한다. Summary/Task/Milestone 각각 이름 텍스트 셀 한 번 클릭으로 입력이 열리고, tree expander·행 여백·다른 열·Chart·메뉴 클릭에서는 열리지 않아야 한다. 행 선택과 Summary 접힘 상태, Grid 열 너비/표시·가로/세로 스크롤·scale·Gantt API instance는 유지한다.
- 세 유형에서 Enter와 일반 blur가 각각 보호 Task PATCH를 **한 번만** 보내며 변경 필드는 `name` 하나다. 숫자만 있는 이름(예: `001`→`002`)도 Grid→Gantt 변환에서 앞자리 0을 잃지 않아야 한다. 응답의 canonical snapshot이 Grid·Chart label·열린 Task Editor 정보와 일치하고 reload 뒤에도 유지되는지 검사한다. Summary의 일정 필드 변경과 Task Editor 직접 편집은 여전히 차단한다. 이름 셀 두 번 클릭은 inline 편집에 귀속하고 기존 메뉴 Edit·Chart/비이름 영역 Task Editor 경로를 회귀 확인한다. 작업 URL이 있어도 editable 이름 클릭은 새 창 대신 인라인 편집이며 기존 허용된 URL 진입점은 유지한다.
- Escape는 Table `close-editor({ignore:true})`를 사용해 요청 없이 원래 이름과 셀 focus를 복원한다. 빈 이름·공백만·201 Unicode code point·잘못된 문자열은 서버 요청 없이 오류 연결·focus를 유지하고, 앞뒤 공백 trim은 Task Editor/서버와 동일하다. IME 조합 중 Enter가 조기 저장되지 않는지, Enter 직후 blur·연속 클릭이 중복 PATCH를 만들지 않는지 확인한다.
- readonly·권한 만료·다른 mutation pending에서는 inline editor가 열리지 않거나 즉시 닫히고 기존 정보 조회/선택은 가능해야 한다. 401은 readonly 전환과 원래 canonical 이름 복원, 412는 최신 snapshot 재조회와 충돌 안내, 400/500/network 오류는 optimistic Grid 이름 잔존 없이 복원·재시도 안내를 확인한다. 서버 edit session·Origin·strong If-Match·revision 검증은 기존 통합 회귀를 유지한다.
- Dependency endpoint의 기존 409/readonly 정책은 유지한다. 연결된 Task/Milestone의 이름 편집은 차단 또는 실패 복원·명확한 안내를 검사하고, Link·revision이 바뀌지 않아야 한다. 무관한 다른 Link만 존재하는 작업은 변경할 수 있어야 한다. Context Menu·Shift+F10·행 선택·expand/collapse·Drag & Drop·관계 표시·Auto Schedule·작업 검색/필터와 Grid state 보존도 전용/기존 E2E를 연결해 검증한다. 제품에 별도 Undo/Redo UI는 없어 신규 UI 검증 N/A다.
- 390/768/1024/1440px에서 input/오류가 viewport 또는 의도된 Grid 내부 가로 스크롤로 접근 가능하고 문서 overflow가 없는지 확인한다. 로컬 test/lint/typecheck/build/browser는 사용자 지시에 따라 **NOT TESTED**이며, 작성된 테스트의 존재는 PASS 증거가 아니다. #140 PR의 정확한 head에서 `quality/e2e/docker` 실행 시작만 확인하고 완료 여부는 별도 판정한다. API/DB/Scheduling/Security 계약 변경은 현재 계획상 N/A다.

위 항목은 #140의 **검증 계획**이다. 현재 작성된 `tests/e2e/project-gantt-inline-name.spec.ts`는 세 유형의 Enter 저장, Task의 blur 저장, 숫자 문자열·Escape·입력 오류·서버 실패·연결 제한·readonly·재조회·문서 overflow와 4개 폭의 input bounds·390px 오류 bounds를 직접 명세한다. Chart label·열린 Task Editor·Summary 일정 필드 차단·이름 더블클릭·다른 mutation pending·400 응답과 나머지 상태 보존 항목은 해당 전용 spec에서 아직 직접 단언하지 않았으며, 기존 테스트와 연결 증거를 확인하거나 후속 검증으로 남긴다. PR CI 시작 또는 일부 검사 성공만으로 미단언 항목을 PASS로 판정하지 않는다.

### Issue #177 Project 상태 빠른 변경

- Project List Chromium E2E는 상태 select의 accessible name/키보드 조작, 최신 canonical GET, current edit-session 재사용, 세션 없음의 password dialog, 잘못된 password/cancel 시 PATCH 0건, 성공 시 `{status}` 단독 payload와 strong If-Match를 확인한다.
- 기본 상태 필터에서 `in_progress → completed` 성공 직후 full reload 없이 행/결과 수가 감소하고 완료 필터를 추가하면 canonical completed 행이 다시 나타나는지 확인한다. 유효 session 획득 후 다음 직접 전환은 추가 password 없이 수행한다.
- Workspace E2E는 readonly badge와 edit-mode header status combobox를 구분하고, header 전환의 request body가 status-only인지, 성공 뒤 Settings select/canonical GET이 같은 값인지 확인한다.
- Workspace status 전환 전후 실제 `.project-gantt-widget .wx-gantt` DOM identity를 비교해 Gantt remount가 없음을 확인한다. status 변경 자체가 Task scheduling/resource mutation을 발생시키지 않아야 한다.
- 401/403은 readonly 복귀 또는 재인증 안내, 412는 최신 canonical status 재조회 후 stale draft 폐기, network/5xx는 성공 표시 금지로 검증한다. 같은 Project에서 빠른 중복 조작은 mutation lock으로 직렬화/차단한다.
- 기존 #138 API/DB status integration 테스트는 그대로 유지하며 신규 migration/API endpoint가 없음을 문서 gate에서 확인한다.

## Issue #202 기준 일정 (Baseline) 관리 및 차트 오버레이 회귀

- **마이그레이션 및 DB 영속성**:
  - `0014_task_baseline.sql` 적용 후 `tasks` 테이블에 `baseline_start`, `baseline_duration`, `baseline_end`가 정상 추가되는지 `tests/server/db/database.test.ts` 및 `tests/server/migration-cli.test.ts`에서 검증한다.
  - 마이그레이션 멱등성 및 롤백 안전성을 확인한다.
- **순수 계층/일정 도메인 엔진**:
  - `tests/domain/scheduling/hierarchy.test.ts`: 모든 하위 자손(leaf)에 baseline이 존재할 때 Summary의 baseline이 `min(baselineStart)`, `max(baselineEnd)`, `workingDaysBetween`으로 파생되는지 검증한다.
  - 자손 중 하나라도 baseline이 null이면 Summary baseline이 null로 계산되는지 검증한다.
- **Task Editor 및 클라이언트 모델**:
  - `tests/features/gantt/task-editor-model.test.ts`: draft 초기화 시 task의 baseline 필드가 채워지는지, "현재 일정으로 복사" 및 "기준 일정 삭제" 액션 시 draft와 payload가 올바르게 구성되는지 검증한다.
  - 마일스톤의 기준 일정 기간 0일 제한 및 유효하지 않은 날짜/기간 입력 거부를 검증한다.
- **Gantt 어댑터 및 동기화**:
  - `projectTasksToSvarTasks`가 SVAR ITask 객체에 `base_start`, `base_end`, `base_duration`을 정확히 매핑하는지 검증한다.
  - `canonical-snapshot-sync.ts`의 `sameTask`가 baseline 변경 사항을 감지하여 `update-task`를 누락 없이 발행하는지 검증한다.
- **UI 및 차트 오버레이**:
  - Gantt 툴바의 "기준 일정 보기" 토글(`showBaseline`) 동작과 SVAR `baselines` 연동을 확인한다.
  - Grid 열 선택 메뉴에서 `baselineStart`, `baselineEnd` 열의 표시/숨김 토글을 확인한다.

## Issue #203 Relation Editor 및 관련 아이템 검색·추가·삭제 회귀

- **도메인 및 검색 헬퍼 모델 단위 테스트 (`tests/features/gantt/relation-editor-model.test.ts`)**:
  - `getRelatedLinksForAnchor`:
    - 지정한 Anchor 작업의 `externalId`를 기준으로 선행(incoming) 및 후행(outgoing) 관계가 올바르게 분류되는지 검증한다.
    - 연결된 관계가 없는 작업의 경우 빈 배열을 안전하게 반환하는지 검증한다.
  - `searchCandidateTasks`:
    - Summary 작업(`type === "summary"`)이 후보에서 정확히 제외되는지 검증한다.
    - 자기 자신(`anchorExternalId`)이 후보에서 제외되는지 검증한다.
    - 이미 선행 또는 후행으로 연결된 작업이 중복 관계 방지를 위해 후보에서 제외되는지 검증한다.
    - 이름(`name`) 및 식별자(`externalId`) 검색 쿼리 필터링이 대소문자 무관하게 동작하는지 검증한다.
- **Relation Editor 다이얼로그 및 인터랙션**:
  - 관계선(`[data-link-id]`) 더블클릭 이벤트 캡처 및 Relation Context Menu의 "관계 관리..." 버튼을 통한 다이얼로그 오픈을 검증한다.
  - Anchor 전환, 선택된 관계의 유형/Lag 수정, 단일 관계 삭제, 신규 관계 추가(POST) 인터랙션을 확인한다.
  - `Escape` 키 입력 시 다이얼로그가 닫히고, 다이얼로그 내부에서 Tab/Shift+Tab Focus Trap이 동작하는지 확인한다.
- **화면 안정성 및 상태 보존**:
  - Relation Editor 열기/닫기/수정/삭제/추가 작업 중 Gantt 컴포넌트 인스턴스, 스크롤 위치, 요약 작업 접힘 상태가 리셋되지 않고 유지됨을 확인한다.
  - 읽기 전용(`readonly`) 모드에서 수정/삭제/추가 액션이 비활성화됨을 확인한다.


### Issue #196 Workspace Task/Milestone 빠른 보기 회귀

- Unit 테스트(`tests/features/projects/project-search-filter.test.ts`)에서 `types` 배열에 따른 `getTaskQuickView` 판정(`all`, `task`, `milestone`, `custom`), `applyTaskQuickView`의 불변성 및 다른 조건 보존, 빠른 보기 적용 상태의 `filterTasksWithAncestors` match count 및 ancestor context 분리를 검증한다.
- Playwright E2E(`tests/e2e/project-task-quick-view.spec.ts`)에서:
  - 일정 Toolbar에 빠른 보기 버튼 그룹(`[ 전체 | Task | Milestone ]`) 렌더링 및 기본 `전체` active(`aria-pressed="true"`) 확인
  - `Task` 클릭 시 일반 Task 필터링, Milestone 제외, ancestor Summary context 보존 확인
  - `Milestone` 클릭 시 Milestone만 표시, 일반 Task 제외 확인
  - `전체` 클릭 시 모든 Task/Summary/Milestone 가시성 복원 확인
  - 검색어 등 다른 조건과의 AND 조합 및 빠른 보기 전환 중 검색어 입력값 보존 확인
  - 전환 중 API mutation / document reload 0회 및 Gantt root identity 보존 확인
  - 390px 모바일 및 1024/1440px 데스크톱 뷰포트, readonly 상태 정상 동작 확인
- DB/API/Scheduling 변경은 없으므로 해당 통합 테스트 영향은 N/A다.

## Issue #211 — 범용 Issue Lifecycle 자동화

PR quality에서 `python3 scripts/verify-issue-lifecycle.py`를 실행한다. 정적 contract는 hard-coded Issue/PR 제거, workflow_dispatch 3 operation, per-Issue concurrency, read-only 기본 권한, `packages: write` 금지, merge API/pull_request_target 금지, exact merge SHA/main CI, 기존 release/cleanup 구성요소 재사용을 확인한다.

pure scenario는 unmerged verify, release N/A finalize readiness, 승인된 release, 미승인 release BLOCKED, version mismatch FAIL, required check/main CI 미완료 NOT TESTED, release 입력 정합성을 검증한다. 원격 integration은 main 병합 후 `operation=verify`를 실제 merged Issue/PR에 실행해 GitHub check-run/workflow-run evidence 조회를 확인한다. tag conflict, successful release reuse, branch already absent/tip changed/open PR 사용, duplicate FINAL은 실제 mutation 대표 검증 또는 격리된 test Issue에서 확인하며 운영 Issue에서 파괴적으로 시험하지 않는다.


## Issue #250 CI 성능 회귀

CI 최적화 자체의 인수 기준은 다음과 같다.

- `.github/workflows/ci.yml`의 기존 required check 표시 이름 3개가 유지된다.
- node 영향 변경은 policy/typecheck/lint/unit/build가 병렬 실행된다.
- E2E 영향 변경은 Playwright 6-way shard가 실행되며 각 shard는 기존 `workers: 1` 격리를 유지한다.
- docs-only/비관련 변경은 heavy Node/E2E/Docker job을 실행하지 않지만 aggregate required checks는 SUCCESS다.
- `.next/cache`, TypeScript incremental metadata, npm package cache, Docker GHA cache가 각각 정의되어 있다.
- `workflow_dispatch`는 전체 검증을 실행한다.
- main 비문서 변경의 임시 GHCR digest 검증·cleanup 계약과 PR read-only 권한은 유지된다.
- 실제 성능 판정은 변경 전 PR CI run #995와 최적화 PR의 wall-clock을 비교해 기록한다.


## Issue #260 Project Workspace 필터 배치 회귀

- `tests/e2e/project-filter-toolbar-consistency.spec.ts`는 390×844, 768×900, 1024×900, 1440×900, 1600×900에서 Schedule/Resource Toolbar의 검색, `필터 N`, 빠른 보기, 조건부 Reset, 결과 상태를 검사한다. 직접 자식의 `getBoundingClientRect()` 교차 영역이 1px를 초과하면 overlap 실패로 판정한다.
- Task Advanced Filter를 열린 상태로 유지해 **텍스트 / 일정·수치 / 유형·할당 / 물류** section heading을 확인하고, operator/value·From/To·Min/Max·Resource/Group picker·긴 공정/설비/시스템 label을 포함한 모든 input/select가 panel 좌우 bounds를 벗어나거나 서로 겹치지 않는지 실제 geometry로 검증한다.
- Resource Advanced Filter는 종류/상태/Task From/To와 한쪽 날짜 초안·역순 날짜 안내를 유지하면서 동일 geometry 검사를 수행한다. 768/1024에서는 2열 reflow, 390에서는 1열 reflow가 document horizontal overflow 없이 접근 가능해야 한다.
- 기존 #83/#130/#196의 predicate, active count, Task/Milestone quick view, Grid/Chart visibility, Reset/search focus, Escape/filter trigger focus, Gantt root identity, filter 조작 중 mutation/API 재조회 0회 assertion을 그대로 유지한다. 새 layout 검증은 이 기능 회귀를 대체하지 않는다.


## Issue #326 작업 캘린더 client draft key 호환성

- Unit: `createClientLocalId`가 `crypto.randomUUID` 지원 시 UUID 경로를 사용하고, 미지원 시 `getRandomValues` 또는 client-local 비보안 fallback으로 정상 생성되며 연속 key가 충돌하지 않는지 검증한다.
- Chromium: page init 단계에서 `Crypto.prototype.randomUUID`를 제거한 뒤 Project 설정 → 작업 캘린더에서 국가 규칙 추가와 날짜 예외 추가를 실행하고 새 row가 표시되며 Error Boundary로 전환되지 않는지 검증한다.
- 저장/Preview/API/Revision/Calendar scheduling 계약은 변경하지 않는다. 서버 `node:crypto.randomUUID`와 canonical public ID, 인증·세션용 난수 정책은 이번 회귀 범위 밖이며 기존 테스트를 유지한다.
- Console의 password form username 접근성 경고는 이번 crash의 직접 원인으로 취급하지 않으며, 구조 변경이 필요하면 별도 접근성 Issue에서 추적한다.
- 공식 전체 회귀 판정은 Issue #326 PR exact head의 GitHub Actions `quality/e2e/docker` 결과를 사용한다. 실제 HTTP/IP reverse proxy 환경은 환경별 검증으로 별도 판정한다.

## Issue #261 Resource Group/Resource 근무일 예외

- Domain/resolver: Project < Group < Resource 계층 양방향 override, 상위 대비 CHANGED/NO_EFFECT, 동일 유형 dedupe와 출처 보존, 반대 유형 conflict 및 입력/DB 순서 독립성. Resource 예외로 Group conflict가 은폐되지 않음.
- Calendar service/API: 누락 dayType의 NON_WORKING 정규화, PROJECT WORKING 거부, GET→PUT→GET canonical customDates, preview Resource별 최종 상태/상위 대비 효과/출처, 빈 그룹 충돌, 성공 revision +1/실패 +0, 기존 session/Origin/If-Match.
- Membership: 여러 프로젝트에 걸쳐 후보 구성원이 새 Group-level 충돌을 만들면 전체 구성원 변경과 catalog revision을 rollback. 할당이 없는 Resource도 검사한다.
- Workload: 공휴일 특별근무·그룹 휴무를 개인 근무로 복원·개인 휴무 재적용, M/D·M/M 분자와 일별 과투입, 중복 그룹 합산 방지, NO_EFFECT 계산 불변. Task start/end/duration은 어떤 Resource 예외로도 바뀌지 않음.
- Chromium: Group/Resource WORKING 등록·수정·삭제·재진입, NO_EFFECT 경고와 저장 가능, 충돌 오류 summary focus/입력 연결, 대상/유형/날짜/이름/추가/삭제의 preview stale, Project target 전환의 휴무일 정규화, canonical 재조회 및 Gantt 상태 보존. 390/768/1024/1440px에서 control overlap/document overflow 검사.
- 기존 Country WORKING, Project CUSTOM 휴무, Manual/Dependency Calendar 재계산 및 접근성 회귀를 함께 유지한다.

실제 로컬 실행 결과는 [Issue #261 검증 기록](ISSUE_261_RESOURCE_CALENDAR.md)에 기록한다. 사용자 요청 범위는 PR/CI 시작까지이므로 원격 quality/e2e/docker의 완료 판정은 NOT TESTED이며 main/GHCR/정식 release는 이번 작업 범위 밖이다.


## Issue #258 Backend/Domain 검증

`tests/domain/scheduling/task-candidate.test.ts`는 필드 분류(unknown 포함), 요청일 기반 앞당김과 결정성/입력 불변, 4 관계 × signed lag와 strongest bound, Manual conflict, WORKING/NON_WORKING 예외 및 연도 경계 Milestone을 검증한다. 기존 dependency/calendar/hierarchy domain 테스트는 세부 날짜·상한 공식의 회귀를 담당한다.

`tests/server/projects/task-dependency-edit.test.ts`는 실제 SQLite에 Link API로 늦춰진 월~금 A→B→C를 만들고 HTTP PATCH로 metadata/progress/Baseline 일정 불변, 기간 3→5/1의 지연/앞당김 및 전체 diff, Auto/Manual 전환, 직접/후행 resource와 Manual mixed rollback, NULL 할당 보존, populated logistics/Link 보존, strict end/unknown, revision/stale/session/Origin 보호와 SQLite reopen을 확인한다. FS/SS/FF/SF × lead/lag 및 추가 predecessor도 실제 저장 경로로 검증한다. 기존 TaskService linked guard 테스트는 실제 Link API fixture의 정상 metadata 저장 + 날짜 불변 + 삭제 보호로 대체했다. 계층/subtree delete guard와 Link/resource canonical 회귀를 함께 실행한다.

2026-09-29 Local Fast Feedback: 관련 11 파일 119 tests PASS. 이는 원격 전체 CI PASS가 아니며 PR quality/e2e/docker 판정은 해당 head의 Actions 결과를 사용한다.

5,000 Task 벤치마크는 `RUN_TASK_DEPENDENCY_BENCHMARK=1 npx vitest run --config tests/config/vitest.config.ts tests/server/projects/task-dependency-performance.test.ts`로 명시 실행한다. 기본 CI에서는 성능 시나리오를 skip하며 정확성 검증은 위 테스트가 담당한다. 출력은 `TASK_BENCHMARK_REPORT` 또는 `/tmp/mastergantt-issue258-benchmark.jsonl`이다. chain/branch 각 4,999 links, join 9,997 links; 1회 warmup 후 3회 기록한다. 환경: Node v22.14.0, Linux 6.6.87.2 WSL2, Intel Core Ultra 7 255H, in-memory SQLite, 월~금/추가 휴일 없음. 잠정 예산 pure engine 2초 / 실제 HTTP Handler-Service-SQLite PATCH 5초다.

| 모양 | 변경 전 aggregate 검증 engine(ms) | 변경 후 같은 검증 engine(ms) | 새 pure candidate engine(ms) | 변경 후 성공 PATCH(ms) |
| --- | --- | --- | --- | --- |
| chain | 44 / 38 / 43 | 44 / 44 / 40 | 33 / 25 / 25 | 146 / 135 / 139 |
| branch | 43 / 36 / 37 | 34 / 35 / 36 | 21 / 21 / 22 | 124 / 149 / 122 |
| join | 36 / 39 / 41 | 40 / 36 / 39 | 24 / 24 / 30 | 139 / 144 / 148 |

변경 전 동일 linked schedule PATCH는 계산을 지원하지 않아 409(8–13ms)였으므로 성공 PATCH 시간과 기능 동등 비교는 불가능하다. 후행 날짜 저장은 prepared UPDATE를 재사용하여 Task별 SELECT 재조회를 피하고 할당도 한 번 읽는다. 변경 후 실제 PATCH는 모두 200이고 engine/PATCH 예산을 통과했다. 이는 해당 로컬 fixture의 측정이며 Calendar 탐색/운영 디스크/원격 runner 일반 성능 보장은 아니다. 원격 CI와 최종 수동 UX 검증 상태는 별도 기록한다.


## Issue #300 Grid DnD 순서 영속성

- Gateway Unit: 드래그 중 `inProgress`는 로컬 피드백만, 최종 drop은 기존 reparent/move 명령으로 1회 저장. readonly/mutation lock/잘못된 target을 차단하고 canonical 동기화의 명시적 내부 move는 서버에 재전송하지 않는다.
- Canonical Unit: A/B/C → A/C/B → B 이름 변경 후 새 구조를 유지하며 불필요한 역방향 이동 명령이 없다. parent와 sibling 이동은 공개 move-task로 반영하고 일반 update-task에는 구조를 싣지 않는다.
- SQLite/HTTP: 기존 reparent before/after/child 이후 name/description/progress PATCH가 parent_id/sort_order를 보존하는지 실제 DB와 canonical GET으로 확인한다. sibling normalization과 revision +1, 401/403/412/invalid target/cycle/빈 Summary의 원자 거부를 검증한다.
- Chromium: 실제 pointer Grid DnD → inline rename → reload/reopen, Context Menu Up/Down → rename 비교, 비구조 필드와 접힘/펼침·parent 변경·타입 제한, 실패/412 canonical 복구와 Gantt identity 보존. Desktop에서 실제 DnD를 검증하고 390/768/1024/1440px에서 기존 Grid 접근·스크롤·document overflow를 확인한다.
- Project List 상태 회귀는 SSR 렌더 직후 hydration 전 select 조작으로 이벤트가 유실되지 않도록 control 활성화 시점을 검증하고, E2E는 enabled 상태 이후 조작한다.

실제 실행 결과와 실패/재실행 이력은 [Issue #300 기록](ISSUE_300_GRID_DND.md)에 구분한다. 사용자 요청은 PR/CI 시작까지이므로 원격 quality/e2e/docker 결과는 NOT TESTED이며 완료 모니터링은 수행하지 않는다.

## Issue #280 — Logistics Type Catalog

필수 회귀 범위:
- migration 0014 → 0015 적용, 기존 equipment/system row count·id·type code·관계/담당자/task link 보존과 FK integrity
- 기존 12개 default seed 및 custom type 생성/rename/active/inactive/restart 영속성
- env bootstrap 최초 1회, runtime password rotation 후 DB credential 우선, old session revoke
- 관리자 Origin/session/If-Match 및 stale 412, invalid/duplicate code, secret 비노출
- 신규 create/type-change는 active catalog만 허용하고 기존 inactive type 유지 편집 허용
- `/logistics-admin`과 Project Workspace의 loading/error/retry/session-expired 및 390/768/1024/1440 반응형·keyboard/focus/Escape
- Issue #285의 공정 code optional/server-generated 계약을 포함한 기존 물류 회귀

리뷰 회귀로 duplicate stable code는 HTTP 409 `LOGISTICS_CATALOG_CONFLICT`를 반환하고 revision을 증가시키지 않는지, 비밀번호 dialog 재열기 시 초안이 비어 있는지, 서버 logout 실패 시 로그인 화면으로 로컬 잠금 전환하면서 revoke 미확인 오류를 표시하는지 검증한다.

## Issue #288 개발자 Resource 등급 회귀

- DB/contract: `0016_resource_developer_grade.sql` 적용 후 기존 Resource는 NULL을 유지하고 4개 canonical 값과 NULL만 저장되며 그 외 문자열·빈 문자열은 거부한다. Repository/API round-trip에서 등급을 보존한다.
- Resource Catalog: 관리자 Resource 생성/수정/조회에서 미지정/초급/중급/고급/특급을 표시하고 실제 변경만 기존 catalog revision 정책을 따른다. 기존 session/Origin/stale revision 계약은 유지한다.
- Logistics role: 등급이 있는 Resource의 신규 Developer 배정은 허용하고 grade NULL 신규 배정은 `DEVELOPER_GRADE_REQUIRED`로 거부한다. migration 이전 동일 Developer+NULL 배정 보존은 허용하고, 역할 해제 후 전역 등급은 유지한다. PI/설비 담당/Task assignment는 등급을 요구하지 않는다.
- Chromium: Resource 관리자에서 등급 생성·목록 표시·수정과 390/768/1024/1440px document overflow를 확인한다. Developer picker는 등급 표시와 미지정 신규 배정 차단 안내를 확인한다.
- Scheduling/workload: 등급 변경만으로 duration, allocation, M/D·M/M, capacity, 일정 및 resource leveling 결과가 바뀌지 않아야 한다.
- 공식 전체 회귀 판정은 Issue #288 PR head의 `quality/e2e/docker` 결과를 사용한다.


## Issue #289 프로젝트 기준정보 회귀

- Migration/DB: `0017_project_master_catalog.sql` 적용, 기존 Project NULL 보존, category/code unique, category mismatch 차단, FK RESTRICT와 catalog revision을 검증한다.
- Service/API: active-only 일반 조회, 관리자 inactive 포함 조회, 별도 관리자 인증/Origin/login rate-limit/If-Match/412, 잘못된 category/id, 사용 중 stable code 변경 차단, inactive 신규 선택 거부/기존 참조 보존을 검증한다.
- Project aggregate: 생성·조회·목록·메타데이터 수정·복사·Template에서 동일 global 참조를 유지하고 rename/inactive가 참조를 깨뜨리지 않는지 검증한다.
- UI/E2E: 생성 폼은 기본 필드 validation을 catalog loading보다 먼저 수행하며 catalog 미확인 시 유효 저장만 차단한다. 관리자 category는 tablist/tabpanel·roving focus·Arrow/Home/End를 검증하고 390/768/1024/1440px overflow를 회귀 검증한다.
- 집중 서버 회귀는 `tests/server/projects/project-master-catalog.test.ts`; migration ledger/schema 기대값은 DB 및 migration CLI 테스트에서 0017까지 검증한다. 공식 PASS 판정은 PR exact-head GitHub Actions quality/e2e/docker 결과를 사용한다.

## Generic Release Finalizer contract (#350)

CI policy/static scenario에서 최소 다음을 검증한다.

- PR CI/수동 CI/실패 main CI는 lifecycle mutation 대상이 아님
- exact merge SHA에 대응하는 PR이 0건이면 skip, 복수면 fail-closed
- canonical `Refs #Issue`가 누락/복수이면 fail-closed
- version 동일은 finalize, version 변경은 release authorization 필요
- untrusted comment marker는 승인으로 인정하지 않음
- 최신 trusted revocation/version mismatch는 release BLOCKED
- Issue별 lifecycle helper/finalizer 파일 재도입 금지
- generic/release workflow concurrency가 queued work를 보존
- 인접 same-Issue corrective merge는 docs-only/non-docs validation scope가 동일할 때만 수렴하고, scope가 다르면 앞선 failed main CI를 우회하지 않음
- 수렴된 모든 PR identity가 `--cleanup-pr`로 lifecycle에 전달되고, 모든 branch safe cleanup PASS 전에는 FINAL/Issue close가 불가능함

## Issue #344 — 작업 삭제 실패 복구 회귀

Unit은 `tests/features/projects/canonical-snapshot-recovery.test.ts`에서 r10 삭제 전→r11 삭제 성공→오래된 r10 복구 거부, 마지막 확정 task set replay, 같은/높은 revision 허용, Project identity 분리를 검증한다. 기존 canonical sync 테스트는 native 임시 변화 복구에 사용하는 공개 SVAR action 경로를 검증한다.

당시 #344 서버 검증은 `tests/server/projects/task-delete-recovery.test.ts`에서 정상 삭제 성공 뒤 마지막 child 삭제 `409 EMPTY_SUMMARY_NOT_ALLOWED`, 기존 성공 삭제·revision 유지, canonical GET 일치와 subtree/unrelated Link 보존·DB 재오픈을 확인했다. 관련 3 files / 23 tests의 실제 실행 근거는 [서버 검증 기록](ISSUE_344_SERVER_VALIDATION.md)을 따른다. 당시 서버 transaction·도메인 정책 변경은 없었으며 #345는 빈 Summary 허용으로 이를 대체한다.

Chromium은 `tests/e2e/project-task-delete-context.spec.ts`의 실제 격리 SQLite 서버를 사용한다. 일반 Task 삭제 성공→마지막 child 거부를 두 차례 반복하고 Grid/Chart task set, GET revision, 실패 child 유지, 이후 정상 삭제 및 reload를 검증한다. 복구 GET에 삭제 전 낮은 revision snapshot을 주입하는 경우와 GET 자체 실패를 분리한다. `401/412/network` fault injection은 각각 읽기 전용 전환, 충돌 안내, network 오류 안내 뒤 성공 삭제 보존을 확인한다. Gantt identity와 Summary 접힘·스크롤·scale 보존은 해당 시나리오에서 검증한다. fault injection 결과는 정상 서버가 동일 오류 응답을 실제 발생시켰다는 근거로 사용하지 않는다.

| 근거 | 로컬 실행 상태 |
| --- | --- |
| 수정 전 main `6532edd8418772454b96fdeb895b90c5ab7d3d6d`, 일반 성공 삭제→정상 409 조합 2회 | PASS — 실제 SQLite/Chromium에서 원증상 미재현 |
| 수정 전 낮은 revision 복구 GET 주입 | FAIL — 성공 삭제된 `Delete C`가 Grid에 다시 표시됨 |
| 초기 수정 후 기존 subtree·정상 409 | PASS — 실행 당시 코드 기준 |
| 초기 수정 후 stale/조회 실패 | FAIL — 추가 조회 실패 알림이 원래 409 toast를 덮어써 오류 문구 assertion 실패; 단일 알림으로 수정 후 재검증 필요 |
| 중간 테스트 편집 typecheck | FAIL — 기존 subtree 테스트에 잘못 삽입된 변수 범위 오류; 최종 수정 후 재검증 필요 |
| 확정 snapshot helper Unit | PASS — 3 tests 실제 실행; 전체 원격 회귀를 대체하지 않음 |
| 삭제된 앞쪽 sibling 때문에 불필요한 이동을 만드는 canonical sync 회귀 | 수정 전 FAIL — delete 뒤 불필요 move 2회; 수정 후 PASS — 살아 있는 sibling 순서 비교, 관련 Unit 2 files / 12 tests |
| 통합 typecheck·변경 TS 8개 lint·version check | PASS — infra 실행 후 초기 조회 stale fallback 보완을 포함해 독립 QA가 최종 재검증 |
| 독립 사전 QA | PASS — 직접 5 files / 35 tests·typecheck·lint·version check·Markdown 링크 92개·diff 검증, AC/code/test/docs/화면 근거 비교. 원격 전체 회귀나 최종 코드 ACCEPT를 의미하지 않음 |
| 최종 삭제 복구 Chromium | PASS — 7 tests / 2.5분. normal/stale/unavailable/401/412/network 각각 두 차례 성공 삭제→거부와 Grid/Chart·같은 widget/API·접힘·가로 scroll·week·reload 확인 |
| 기존 pointer 저장·거부·GET 실패·same-revision race | PASS — 1 test / 31.8초. GET 실패의 마지막 확정 일정·동일 widget/API·bar geometry 복원을 강화 |
| PR exact-head `quality/e2e/docker` | NOT TESTED — 이번 요청은 CI 시작까지이며 완료 모니터링 제외 |

수정 전 stale 응답 재현 화면은 [before](../output/playwright/issue344-before.png), 수정 후는 [after](../output/playwright/issue344-after.png)다. 모두 실제 브라우저의 기능 상태 근거이며 날짜·Task 구성·scale이 달라 동일 fixture의 픽셀/배치 개선 비교로 사용하지 않는다. 추가 390/768/1024px 삭제 복구, 세로 scroll·selection 및 독립 keyboard/focus 검사는 NOT TESTED다. 실제 독립 UX 검토는 정적 코드·테스트·화면 비교 PASS다. 초기 전체 조회에서도 오래된 응답이 확정 snapshot을 덮지 않고 loading에 남지 않도록 보완했으며 이 분기의 별도 브라우저 조작은 NOT TESTED다. Network fixture는 요청 abort 경로이며 서버 commit 후 응답 유실·더 높은 canonical GET의 별도 브라우저 조작은 NOT TESTED다.

중간 로컬 공유 개발 서버에 Turbopack HMR panic이 발생하여 해당 실행을 중단했다. 기존 `.next-e2e`를 `/tmp/mastergantt-issue344-e2e-cache-20261001`로 보존 이동한 뒤 새 캐시의 동일 설정·격리 SQLite 테스트에서 위 7개 PASS를 확보했다. CI 설정·검사 gate는 변경하지 않았다. 전체 Lifecycle/main artifact/정식 release/운영 배포의 PASS로 확대하지 않는다.


### Issue #344 / PR #359 — CI #1373 follow-up

- PR CI #1373에서 production dependency audit, policy/lifecycle static checks, typecheck, lint, Next production build, Docker smoke와 Chromium shards 1/2/4는 PASS했다.
- Vitest는 `tests/scripts/deployment-layout.test.ts`가 `@next/env === 16.3.4`를 과거 버전으로 고정해 16.3.6 보안 패치와 불일치하여 1건 실패했다. 검증 의도는 특정 과거 버전이 아니라 standalone runtime의 `@next/env`가 framework `next`와 같은 버전으로 pin되는지이므로 동등성 검사로 수정한다.
- Chromium shard 3/4의 단일 실패는 `project-status.spec.ts`의 readonly canonical GET에서 `read ECONNRESET`이 발생한 transport reset이다. assertion 실패, HTTP 오류 응답 또는 서버 계약 불일치가 아니며 같은 shard의 다른 테스트는 계속 PASS했다. 제품 코드를 우회하지 않고 새 PR head 전체 E2E에서 재검증한다.
- CI #1373의 실패를 PASS로 대체하지 않는다. 후속 head의 원격 quality/E2E/Docker 결과를 별도 증거로 사용한다.


### Issue #344 / PR #359 — CI #1374 follow-up

- CI #1374의 quality, production dependency audit, lifecycle policy, TypeScript, ESLint, Vitest, Next build, Docker smoke와 Chromium shards 1/2/4는 PASS했다.
- 실패는 Chromium shard 3/4의 `project-workspace-ux.spec.ts` 1건이다. `정보` disclosure의 summary에 focus 후 Tab으로 subtree 밖으로 이동했지만 `<details open>`이 닫히지 않았다. 77개 다른 shard 테스트는 PASS했다.
- 기존 구현은 document `focusin` listener로 외부 focus를 감지했다. disclosure 자체의 React `onBlur`에서도 `relatedTarget`이 현재 details subtree 밖이면 닫도록 보완해 keyboard focus 이동을 구성요소 경계에서 직접 처리한다. Dialog/role=dialog로 이동하는 기존 예외는 유지한다.
- CI #1374의 실패를 PASS로 대체하지 않으며, 새 head의 원격 E2E 전체 결과를 별도 증거로 사용한다.


### Issue #344 / PR #359 — CI #1378 follow-up

- CI #1378의 quality, policy/audit, TypeScript, ESLint, Vitest, Next build, Docker smoke와 Chromium shards 3/4·4/4는 PASS했다.
- shard 1/4의 13건 실패는 CI #1374 보완에서 추가한 disclosure `onBlur`가 native Dialog open 전환 중 `relatedTarget=null`을 외부 focus 이탈로 오인하여 action-menu `details`를 닫은 회귀다. 그 결과 Copy/Template Dialog가 닫힌 details 내부에서 접근 불가능해져 재인증·412·focus 복원 테스트가 연쇄 실패했다.
- `onBlur`는 즉시 닫지 않고 다음 animation frame에 `document.activeElement`를 확인한다. 실제 focus가 details 내부 또는 `dialog/[role=dialog]`에 있으면 유지하고, 그 밖으로 이동한 경우에만 닫는다. 따라서 CI #1374의 Tab 외부 이탈 요구와 Dialog 내부 상호작용 요구를 동시에 만족하도록 한다.
- shard 2/4의 Grid inline rename 1건은 editor input이 생성되지 않은 단일 focus 실패다. 이번 변경 영역과 독립적이고 직전 CI #1374에서 해당 shard가 PASS했으므로 제품 수정 근거로 단정하지 않고 새 head 전체 E2E에서 재검증한다.
- CI #1378의 실패를 PASS로 대체하지 않는다.


### Issue #344 / PR #359 — CI #1379 follow-up

- CI #1379의 quality, policy/audit, TypeScript, ESLint, Vitest, Next build, Docker smoke와 Chromium shards 3/4·4/4는 PASS했다.
- shard 1/4의 9건 실패는 disclosure `onBlur`가 native Dialog open lifecycle과 여전히 충돌해 Copy/Template dialog가 사라지는 동일 계열 회귀다. `onBlur` 방식은 제거한다. 일반 외부 focus는 기존 document `focusin` 계약을 유지하고, CI #1374에서 필요했던 keyboard Tab 경로는 details의 `keydown(Tab)` 후 animation frame에서 실제 `document.activeElement`가 subtree 밖인지 검사해 닫는다. Dialog 클릭/open 흐름에는 이 처리가 개입하지 않는다.
- shard 2/4의 Grid inline rename 실패가 CI #1378과 #1379에서 구조 이동 직후 서로 다른 테스트에 반복됐다. 서버 move response와 Grid order 확인만으로 frontend canonical mutation lock 해제를 보장하지 않으므로, 공통 `renameInline` helper가 `data-task-mutation-locked != true`를 확인한 뒤 현재 row에서 editor input을 열도록 한다. 이는 제품 동작을 완화하는 것이 아니라 비동기 canonical sync 완료 경계를 테스트가 준수하게 하는 수정이다.
- 테스트 skip/재시도 횟수 증가는 적용하지 않으며 CI #1379 실패를 PASS로 대체하지 않는다.


### Issue #344 / PR #359 — latest main realignment

- PR #359 작업 중 main에 Issue #356 변경이 먼저 병합되어 branch가 8 commits 뒤처지고 merge conflict 상태가 되었다. 최신 main은 application 0.58.5 및 Next.js/@next/env 16.3.7 보안 패치를 포함한다.
- 충돌 해소는 최신 main의 CI/보안 변경과 16.3.7 dependency graph를 보존하고, #344 고유 lifecycle/focus/E2E 안정화만 적용한다. application version은 다음 PATCH인 0.58.6으로 증가한다.
- stale 16.3.6 lockfile 및 중복 @next/env 고정버전 수정은 최종 tree에 포함하지 않는다. tests/scripts/deployment-layout.test.ts는 최신 main의 exact Next/@next-env equality 계약을 사용한다.
- 최신 main 통합 head에서 PR quality/e2e/docker를 새로 판정하며 이전 #1373/#1374/#1378/#1379 결과를 최종 PASS로 재사용하지 않는다.



### Issue #344 / PR #359 — CI #1382 follow-up

- 최신 main 통합 head의 CI #1382에서 quality, policy/audit, TypeScript, ESLint, Vitest, Next build, Docker smoke와 Chromium shards 1/3/4는 PASS했다. disclosure/Dialog 보완은 원격 E2E에서 회귀 없이 통과했다.
- shard 2/4의 Grid reorder 4건은 공통 `renameInline` helper에서 발생했다. helper가 `hasText(name)`으로 row locator를 만든 뒤 클릭했고, SVAR editor가 열리며 표시 텍스트가 input으로 교체되자 해당 filtered row locator가 더 이상 일치하지 않아 `input element(s) not found`로 오판했다.
- 수정은 클릭 전에 row의 stable `data-id`를 저장하고, editor open 후 해당 `data-id`로 정확한 row/input을 다시 찾는다. 또한 mutation lock 해제와 `data-task-inline-editable=true`를 명시적으로 확인한다.
- 이는 제품 코드 수정이나 테스트 완화가 아니라 editor DOM 전환 이후에도 동일 행을 추적하는 locator 안정화다. CI #1382 실패를 PASS로 대체하지 않는다.


### Issue #344 / PR #359 — CI #1384 이후 Codex review 보완

- 최신 head `fcbf770a1e1f9bb77c9bcab4794c48a16817e832`의 CI #1384는 quality, policy/audit, TypeScript, ESLint, Vitest, Next build, Docker smoke 및 Chromium 4개 shard가 모두 PASS했다.
- Codex P1은 same-Issue coalescing이 latest docs-only merge만 선택하면 앞선 non-docs merge의 E2E/Docker/임시 GHCR evidence를 우회할 수 있음을 지적했다. 보완 후 immediate first-parent diff의 docs-only scope가 서로 다르면 coalesce하지 않는다.
- Codex P2는 coalescing 과정에서 earlier PR identity가 사라져 branch cleanup이 누락될 수 있음을 지적했다. 보완 후 earlier PR 번호를 cleanup obligation으로 보존해 `issue_lifecycle.py`에 반복 `--cleanup-pr`로 전달하고, formal release 성공 후 모든 branch를 공통 safe cleanup으로 정리한 뒤에만 FINAL/Issue close가 가능하다.
- pure/static lifecycle scenario에 동일 scope 수렴, scope mismatch 비수렴, cleanup PR 전달·반복 parser 계약을 추가한다. CI #1384는 이 후속 수정 이전 head의 결과이므로 새 head PR CI로 전체 gate를 다시 판정한다.


### Issue #344 / PR #359 — release-finalizer blocker recovery

- 현재 main `af2b4f3260e9bb0a614771dd9c327d8120729713`의 Generic Finalizer #5는 pending first-parent merges 2건을 발견했으나, 과거 Issue #344 merge `714bf2fd2c1a290bf2ae1d1541f0e2068bc6b2bb`의 exact main CI #1370 실패 때문에 DEFERRED됐다. 그 결과 뒤의 Issue #356도 아직 lifecycle 처리되지 않았다.
- 단순 #359 병합만으로는 pending이 #344(failed) → #356(Green) → #344(corrective) 순서가 되어 동일 blocker가 반복된다.
- 보완은 실패한 older attempt와 later same-Issue corrective target을 연결하되, corrective exact main CI SUCCESS와 validation-scope coverage를 필수로 한다. 중간 Issue는 목록에서 제거하거나 재정렬하지 않는다.
- superseded older attempt에는 release/finalize mutation을 하지 않고 branch cleanup 의무만 later corrective target으로 이관한다. middle Issue #356은 자체 exact CI/release authorization으로 먼저 처리되고, 이후 corrective #344 target이 처리된다.
- docs-only corrective target이 non-docs 실패 attempt를 대체하지 못하는 시나리오와 corrective CI가 Green이 아니면 기존 blocker를 유지하는 시나리오를 정적 contract test에 추가한다.


## Issue #377 Task Editor 관계 탭 관리 회귀

- Unit: relation mutation eligibility가 editable Task/Milestone만 허용하고 readonly, Summary, stale, dirty, busy를 fail-closed하는지 검증한다.
- Chromium E2E:
  - 기존 relation row **편집**으로 Relation Editor를 열어 type/lag PATCH 후 Relation Editor가 계속 topmost이며 닫을 수 있는지, 같은 관계 탭과 최신 revision이 즉시 반영되는지 확인한다.
  - relation row 직접 **삭제**는 keyboard로 실행했을 때 confirmation 취소 버튼으로 focus가 이동하고 취소 후 원래 삭제 trigger로 복원되는지 확인한다.
  - 삭제 확인 뒤 DELETE 1회만 보내고 row/count/revision을 canonical 응답으로 갱신하는지 확인한다.
  - 관계가 0건인 Milestone에서 **관계 추가**가 task Anchor mode Relation Editor를 열고 FS/SS/FF/SF 및 signed Lag를 기존 POST 계약으로 저장한 뒤에도 top-layer 순서를 유지하는지 확인한다.
  - Task draft dirty 상태에서는 add/edit/delete가 disabled되고 Link mutation이 발생하지 않는지 확인한다.
  - readonly에서는 관계 조회만 가능하고 relation mutation action이 존재하지 않는지 확인한다.
  - 기존 Task Editor 390/768/1024/1440px 관계 layout과 dialog/document overflow를 검증한다.
- 기존 관계선 double-click/Context Menu Relation Editor #203/#266 및 #372 fullscreen E2E를 유지해 신규 Task Editor 진입점이 기존 경로를 회귀시키지 않는지 확인한다.
- 공식 자동 판정은 동일 PR head의 required `quality`, `e2e`, `docker` 결과를 사용한다.


## Issue #329 Resource / Resource Group guarded DELETE 회귀

- Repository/Service: Resource usage를 Task assignment, Equipment role, System role, Resource Calendar의 distinct Project 합집합으로 계산하고 Group usage를 Task group assignment와 Group Calendar 합집합으로 계산한다.
- 삭제 성공: Project usage 0인 Resource/Group만 삭제되고 해당 `resource_group_members` row만 정리되며 반대편 Group/Resource는 보존된다. 성공한 실제 삭제만 catalog revision을 정확히 +1 한다.
- 삭제 거부: 각 usage category, inactive 사용 대상, 복수 Project 사용, stale catalog revision에서 삭제/membership/revision이 모두 rollback되고 `RESOURCE_IN_USE` 또는 `RESOURCE_GROUP_IN_USE`를 반환한다.
- Security/API: DELETE는 Resource Catalog 관리자 session + exact Origin + strong catalog `If-Match`를 요구하며 route security inventory에도 동일 정책으로 등록한다.
- Chromium: 사용 중 항목은 `삭제 불가`와 Project 사용 수를 노출하고, 미사용 항목은 confirmation dialog를 거친다. Group 삭제는 member Resource 보존 안내를 제공한다. Cancel은 trigger focus를 복원하고 성공 후 같은 검색 입력으로 focus를 이동하며 검색어를 유지한다.
- 390/768/1024/1440px에서 Resource/Group action 영역과 사용 사유가 겹치거나 document horizontal overflow를 만들지 않는다.
- 공식 전체 회귀 판정은 Issue #329 PR exact-head GitHub Actions `quality/e2e/docker` 결과를 사용한다.

## Issue #332 프로젝트 기준정보 관리자 UI 회귀

- 인증/정보 계층: 로그인 전 관리자 인증 section과 인증 후 session section, 기준정보 관리 section, 항목 추가 section, 목록 section의 heading/구분을 확인한다.
- 목록 구조: 이름/코드/정렬/상태·사용/작업 column header와 body row 정렬, active/inactive 상태 표시, 기존 저장·활성/비활성 action 접근성을 검증한다.
- 상태 필터: 기본 `전체`, `활성`, `비활성` 결과를 혼합 fixture로 검증하고 필터 조작만으로 `/api/project-master/admin/items` mutation이 발생하지 않는지 확인한다.
- category 일관성: 사업부 → 제품 → 사업장/법인 전환 뒤에도 현재 상태 필터가 유지되며 각 category 데이터에 동일 predicate가 적용되는지 확인한다.
- empty state: 실제 category 데이터 없음과 활성/비활성 필터 결과 0건을 구분해 안내한다.
- 접근성: category tab의 기존 roving focus와 Arrow/Home/End 계약을 유지하고 상태 필터의 accessible group name 및 `aria-pressed` 상태를 검증한다.
- Responsive: 390/768/1024/1440px에서 document-level horizontal overflow가 없고, 좁은 viewport에서는 table wrapper의 의도된 내부 수평 scroll만 발생하는지 확인한다.
- Regression: 기존 관리자 인증/session/Origin/login rate-limit/`If-Match`/412 및 catalog CRUD 의미와 Project 생성·편집의 inactive 참조 보존 계약을 변경하지 않는다.
- 공식 전체 PASS 판정은 Issue #332 PR exact head의 GitHub Actions `quality` / `e2e` / `docker` 결과를 사용한다.


## Issue #339 Task Editor Footer action 정렬 회귀

- 원인 회귀: 전역 `.secondary-button`의 page-level `margin-top`이 Task Editor Footer 안에서 Reload/Cancel에만 적용되고 Primary Save에는 적용되지 않는 상황을 방지한다.
- Chromium E2E는 기존 Task Editor 390/768/1024/1440px 반복 검증에서 Footer action의 computed `margin-top=0`을 확인한다.
- 768/1024/1440px에서는 `최신 정보 다시 불러오기`, `취소`, `저장`의 상단 y 좌표와 control height가 1px 허용오차 안에서 일치해야 한다.
- 390px wrap에서는 Reload가 위 행으로 배치되는 것을 허용하되 Cancel/Save 상단 y 좌표가 일치하고 세 action의 control height가 1px 허용오차 안에서 동일해야 한다.
- 기존 dialog/document horizontal overflow, sticky Footer, keyboard focus/Escape, stale reload, disabled/save busy, readonly 및 Task 저장/revision 회귀 테스트를 그대로 유지한다.
- 공식 판정은 Issue #339 PR exact head의 GitHub Actions `quality` / `e2e` / `docker` 결과를 사용하며, 정적 CSS 검토만으로 browser PASS를 주장하지 않는다.

## Issue #343 Project List 기준정보 column 회귀

- Unit: Project List 표시 helper가 catalog `name`을 사용하고 null/undefined/blank는 `미지정`, inactive는 `(비활성)` 의미 텍스트를 유지하며 긴 label을 domain mapping에서 축약하지 않는지 검증한다.
- Server: #289 Project master persistence 회귀에서 `listProjects()`가 assigned 사업부/제품/법인·사업장 표시명과 inactive 기존 참조를 canonical summary에 계속 반환하는지 확인한다.
- Chromium E2E: Project List에 프로젝트/사업부/제품/법인·사업장/상태/소유자/설명/생성/최근 변경/작업 column header가 모두 존재하고 미지정 placeholder가 row에 표시되는지 확인한다. #84 검색 후에도 동일 row data가 유지되어야 한다.
- 기존 #130 geometry 검증의 description/action cell index를 10-column 구조에 맞추고 390/768/1024/1440/1600px document overflow, table 내부 scroll, Row Action keyboard/focus, row density 회귀를 계속 검증한다.
- API/DB/Scheduling/Security는 기존 #289/#75/#84 계약을 재사용하므로 새 endpoint/migration 검증은 N/A다. 공식 전체 판정은 동일 PR head의 GitHub Actions `quality/e2e/docker` 결과를 사용한다.



## Issue #340 Task Editor 리소스 탭 레이아웃 회귀

- Chromium E2E는 390/768/1024/1440px에서 Resource/Group 혼합 fixture를 사용한다.
- 1024/1440px에서는 두 pane이 같은 행에 배치되고 Resource pane이 allocation 요구량에 맞게 더 넓은지 검증한다.
- 390/768px에서는 두 pane이 세로 stack되고 document/dialog horizontal overflow가 없는지 검증한다.
- `전체 → 리소스 → 그룹` 필터 전환 시 단일 유형 pane이 전체 폭을 사용하고 반대 pane이 남지 않는지 확인한다.
- 검색 결과 0건 empty state, pane 건수, inactive 표시, Resource 선택 시 allocation fieldset, Group allocation 미노출을 검증한다.
- 기존 #119 validation/focus, Assignment PUT, revision/catalog revision, 401/412, dirty/stale 및 canonical snapshot 회귀는 기존 테스트를 유지한다.
- 공식 PASS는 exact PR head의 GitHub Actions `quality` / `e2e` / `docker` 결과로 판정한다.

## Issue #403 — Data Table Column Geometry Regression

### 목적

Project List 및 유사한 data-dense table에서 열 추가/폭 변경 이후 header/cell text가 인접 열을 침범하거나 document-level horizontal overflow를 만드는 회귀를 자동/브라우저 검증 단계에서 조기에 발견한다.

### 기본 fixture

- 긴 프로젝트명
- 긴 사업부/제품/법인·사업장 표시명
- 긴 소유자명
- 긴 설명
- 생성/최근 변경 datetime
- null/미지정 metadata
- browser hydrate 이후 locale/timezone 표시

### viewport / display

- 390px
- 768px
- 1024px
- 1440px
- wide desktop
- 기본 100% zoom, 주요 data table은 가능하면 125% zoom smoke

### Geometry 계약

Project List 기준 최소 검증:

1. 생성 셀의 visible content가 최근 변경 셀 영역을 침범하지 않는다.
2. 최근 변경 셀의 visible content가 생성 또는 작업 셀 영역을 침범하지 않는다.
3. header와 body의 동일 열 경계가 정렬된다.
4. Row Action은 항상 보이고 keyboard/mouse로 접근 가능하다.
5. `document.documentElement.scrollWidth <= document.documentElement.clientWidth`를 기본 계약으로 한다.
6. 좁은 viewport에서 table 자체 overflow가 필요한 경우 `tableWrap.scrollWidth > tableWrap.clientWidth`는 허용하되 overflow owner가 table wrapper에 한정되는지 확인한다.
7. 긴 값이 ellipsis/truncate 되면 전체 값 접근 경로가 유지된다.

Playwright에서는 구현 CSS 값 자체를 단정하지 말고 사용자에게 보이는 geometry를 검사한다. 예를 들어 sibling cell의 `getBoundingClientRect()` 비교와 text/content overflow 여부를 사용하며 sub-pixel rounding에는 작은 tolerance를 허용한다.

### 회귀 범위

- #75 Project List wide/table/action 계약
- #84 검색/필터 후 동일 table geometry
- #343 사업부·제품·법인/사업장 열 표시
- Project open/copy/link copy/delete/status action
- native table semantics, keyboard focus, document overflow

실제 browser/E2E 증거 없이 정적 CSS 확인만으로 이 항목을 PASS 처리하지 않는다.

## Issue #426 — Resource/Admin Management Geometry Regression

- Chromium fixture는 긴 한국어 Resource name/code, `EXPERT` grade, role 0/1/3개, active/inactive, delete 가능/불가 상태와 Resource Group을 함께 포함한다.
- #426 당시 두 pane의 wide 비율/vertical stack은 역사적 검증 기록이다. #453부터 390/768/1024/1440/1920px 활성 tabpanel 전체 가용 폭과 inactive hidden 제외, 976/800px native table 소유 scroll로 대체한다.
- #453 표의 identity 최소 240px·역할 0/1/3 badge·모든 row action control이 셀 안에 들어오고 header/body 열 경계와 sibling 비중첩을 실제 bounding box로 검증한다.
- 현재 search/status/count/add toolbar → 표시 table의 경계와 별도 create/profile dialog input/control 경계를 검증한다. 이전 inline create form은 #453에서 dialog로 대체했다.
- #288 grade 값/표시/select 및 #412 역할 badge·checkbox accessible name·keyboard Space·412 초안 보존은 profile dialog 명시 grade+roles PATCH로 이관한다. 기본 목록은 표시 중심이며 저장 전 PATCH0을 검사한다.
- Group member editor를 연 상태에서 `닫기`는 좌측, `구성원 저장`은 우측이며 같은 행에서는 center/baseline이 정렬되는지 확인한다.
- 모든 viewport에서 `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`을 확인하고 의도된 component-owned overflow와 구분한다.
- 기본 100% zoom은 필수이며 환경이 허용하면 125% zoom smoke를 추가한다. screenshot은 보조 증거이며 geometry assertion을 우선한다.
- API/DB/Scheduling schema는 변경하지 않는다. 공식 판정은 exact PR head의 GitHub Actions `quality/e2e/docker` 결과를 사용한다.


## Issue #303 Task status / progress 회귀

- Unit/Domain: null/0/1/50/99.999/100 progress status 파생, completed↔progress, not_started→0, completed 해제, contradictory persisted pair 거부를 검증한다.
- Contract/Service: create/PATCH allowlist, status+progress 단일 mutation/revision, 일정·Link 불변, canonical response status를 검증한다.
- SQLite: `0019_task_status.sql`의 progress 기반 backfill, CHECK, reopen, migration ledger 19건을 검증한다.
- Copy/Template: subtree Copy가 0% `in_progress` 같은 명시적 status를 보존하고 Project Template instantiate 응답이 status를 누락하지 않는지 검증한다.
- Chromium: progress 100→completed, completed→100, 완료 해제, Grid 취소선, 동일 Gantt instance 및 기존 Phase 3 responsive geometry를 함께 검증한다. Desktop 작업명/보조 영역 2열과 390/768px stack을 유지한다.
- Scheduling purity: `src/domain/scheduling`은 외부 domain helper를 import하지 않고 Summary status를 derived progress에서 내부적으로 계산한다.
- 최종 판정은 최신 PR head의 새 `quality/e2e/docker` 전체 실행을 사용하며 과거 #1248 결과를 재사용하지 않는다.

## Issue #335 linked Task sibling reorder

- Unit(UI): linked/unlinked Task의 Move Up/Down, first/last sibling, readonly/mutation lock, Add/Indent/Outdent 등 기존 구조 guard를 비교한다.
- SQLite/Service: linked endpoint의 `move`와 same-parent `reparent before/after`가 Link payload와 requestedStart/start/end/duration/scheduleMode/status/progress를 보존하고 revision을 정확히 +1 하는지 확인한다. linked descendant subtree도 same-parent reorder를 허용한다.
- Negative: linked source/subtree의 cross-parent `child`/reparent는 `UNSUPPORTED_SCHEDULE_STRUCTURE` 정책을 유지하고 실패 시 revision/DB가 바뀌지 않아야 한다.
- Chromium: 실제 Context Menu Move와 pointer Grid DnD를 연속 수행해 순서, relation line, Link ID/endpoints/type/lag, reload persistence를 확인한다. #116 submenu keyboard/geometry, #104/#378 linked Copy/Paste, #399 scoped view, #300의 412/500 canonical 복구와 unlinked DnD를 함께 회귀한다.
- DB schema·새 API route는 N/A다. 동일 PR head의 GitHub Actions `quality/e2e/docker`가 공식 원격 판정이며 로컬 fast feedback 결과와 구분한다.

## Issue #370 Grid 시작일 Date Picker 회귀

- Unit: effective canonical `start`를 DatePicker 값으로 변환하는지, Task/Milestone만 편집 가능한지, Summary/readonly를 거부하는지, 같은 날짜는 no-op인지, 선택 날짜가 `{ start: YYYY-MM-DD }` 단일 일정 명령이 되는지 검증한다.
- Chromium E2E: 시작일 셀 single click → 날짜 Picker overlay open → 다른 날짜 입력 → PATCH 1회 → 같은 Gantt 인스턴스 canonical sync를 확인한다.
- Summary와 readonly는 Picker가 열리지 않고 PATCH가 0회여야 한다. Enter로 Picker를 열 수 있고 Escape 취소 후 원래 셀로 focus가 복귀해야 한다.
- 서버 409/412/422/500/network 실패는 선택값을 canonical로 남기지 않고 마지막 확정 일정을 유지해야 한다.
- 390/768/1024/1440px에서 Date Picker가 viewport를 벗어나거나 document-level horizontal overflow를 추가하지 않는지 확인한다.
- 기존 Grid 이름 inline edit, DnD, Chart drag/resize, Task Editor와 dependency-aware scheduling 회귀는 동일 PR head의 원격 CI/E2E에서 함께 판정한다.

### Issue #299 — Chart vertical DnD

- Unit: horizontal/vertical/pending axis lock, nearest visible sibling before/after, cross-level 거부, no-op, reparent mapping.
- Chromium: #300 isolated seed helper에서 실제 Chart C bar를 B 앞으로 drag하고 `task-commands` POST 1회 / Task PATCH 0회 / canonical·Grid `A,C,B` / indicator 제거 / 동일 Gantt API instance / reload persistence를 확인한다.
- 최신 main 회귀: #335 linked same-parent reorder, #399/#407 subtree scope·scoped add, #384 selection pointer capture, #367 timeline, #370 start-date quick-edit.

### Issue #412 — Global Resource roles

- Migration/DB: `0020_resource_roles.sql`, migration ledger 20건, table/index, stable role CHECK, `(resource_id, role)` duplicate 차단, 기존 Resource 0 role, delete cascade, 파일 DB reopen persistence를 검증한다.
- Service/API: R1=PI+DEVELOPER, R2=EQUIPMENT_OWNER, R3=0 role, canonical role order, invalid/duplicate request, group roles 거부, catalog revision no-op/+1, stale 412 mapping을 검증한다.
- Independence: role 변경↔developerGrade, Resource Group membership, Task assignment, Project Equipment/System roles, Calendar가 서로 자동 변경되지 않는지 검증한다. #288의 Project System developer grade 규칙은 유지한다.
- UI/Chromium: 생성/표시/row 역할 checkbox, keyboard Space/focus, 역할/등급 구분, Group member 역할 참고, long Korean name, mutation `If-Match`, 390/768/1024/1440px document overflow를 검증한다.
- 회귀: 기존 Resource 삭제 usage guard, group member 저장, Task Resource tab/assignment, logistics owner/developer/PI 저장, Resource Calendar 테스트는 동일 PR head의 전체 CI에서 함께 판정한다.

## Issue #485 — Global Resource Role 단일 기준 검증

- DB migration: `0023_deprecate_task_assignment_roles.sql`이 기존 `assignment_role`을 null로 만들고 role index/INSERT·UPDATE guard/role-delete guard를 제거하는지, 재실행·reopen·FK 정합성을 확인한다.
- Service/API: 신규 개인 Resource assignment는 role 없이 저장되고 canonical role은 null인지 확인한다. non-null legacy `role` mutation은 거부하고, 사용 중 Resource의 Global Role 변경/제거는 Task assignment 때문에 차단되지 않아야 한다.
- UI/E2E: Resource 선택 후 수행 역할 Select가 없고 Global Role badge만 표시되는지, Global Role 필터가 `assignment-targets?kind=resource&role=...` 후보 조회만 수행하며 저장 payload에 role을 넣지 않는지 확인한다.
- Workload/Milestone/Excel: 현재 Global Role 집합으로 분류하고 role 0개는 UNSPECIFIED인지 확인한다. multi-role assignment의 role subtotal 합은 Grand Total보다 클 수 있으며 Grand Total은 assignmentId 기준 한 번만 합산되어야 한다.
- Copy/Template: Project Copy와 신규 Template snapshot/instantiate가 Task별 role을 복제하지 않고 Resource/Group 참조와 allocation을 보존하는지 확인한다. legacy snapshot의 `assignmentRole`은 무시한다.
- 기존 readonly/401/412/catalog stale/inactive/중복 submit, allocation Calendar/M/D·M/M, Gantt state 회귀를 함께 검증한다.

## Issue #414 — Global Role 기반 Resource workload 검증

- #56 산식과 assignmentId Grand Total dedup은 유지한다.
- 역할 subtotal은 Resource의 현재 Global Role 집합에 따라 비가산 분류한다. DEVELOPER preset도 Global Role을 사용한다.
- 공식 전체 판정은 #485 PR exact head의 GitHub Actions quality/e2e/docker 결과로 한다.

## Issue #415 — Resource Effort Excel 검증

- workload: Calendar/range clipping 뒤 `effectiveWorkingDays`가 기존 M/D 산식과 일치하는지 확인한다.
- workbook: `includeResourceEffort` on/off, 기존 Logistics/Dependencies 조합, Summary/Detail 시트 append 순서와 OOXML 구조를 확인한다.
- 정합성: 동일 assignment가 여러 Group에 나타나도 Detail 1행/Grand Total 1회이며 Group명은 비가산 목록인지 확인한다.
- 값: 역할 subtotal, 개발자별 M/D·M/M, developerGrade, 진행률/상태/지연, allocation/유효 근무일을 검증한다.
- 미설정: `RESOURCE_MD_PER_MM` 없음, role null, allocation null을 0으로 위장하지 않는다.
- 보안: 프로젝트/Task/Resource/Group의 `= + - @` 시작 문자열 formula injection 방지를 확인한다.
- stale: workload `projectRevision`과 snapshot/If-Match revision 불일치 시 412 또는 workbook 생성 거부를 확인한다.
- 실제 Windows Excel 2021/DRM은 Environment-specific Validation으로 자동 CI PASS와 구분한다.

## Issue #435 Workflow 병목 최적화 검증

- Static contract: PR `edited`는 `verify-ci-run-trace.py`를 실행하고 node/policy/E2E/Docker routing output은 false여야 한다. aggregate quality/E2E/Docker required check 이름과 fail-closed 동작은 유지한다.
- Playwright: `CI_E2E_FULLY_PARALLEL=true`일 때만 `fullyParallel`을 활성화하고 workers=1은 유지한다. explicit `test.describe.configure({ mode: "serial" })` suite의 순차 계약을 훼손하지 않는다.
- PR/Main E2E: 6 shard 전체 PASS와 shard별 duration을 기록한다. 기준 7.4/11.7/13.6/5.1분 대비 최장/최단 편차가 개선되는지 확인한다.
- Release: `quality_static`과 6개의 `release_e2e_shard`가 병렬 실행되고 `Release quality gates` aggregate가 모두 PASS해야 candidate smoke가 시작된다. 단일 unsharded `npm run test:e2e` quality step은 존재하지 않아야 한다.
- Lifecycle: Main CI success + release not-started → `release_start`까지만 수행하고 FINAL/close는 하지 않는다. tagged/in-progress/failed는 mutation 없이 DEFERRED한다. release success completed event → exact release success evidence → `release_finalize` → cleanup/FINAL/close 순서다.
- Recovery: release failure 뒤 Issue/branch가 유지되고 동일 Release run attempt가 성공하면 별도 사용자 Finalizer 실행 없이 completion event로 lifecycle이 재개되어야 한다.
- Security/supply chain: authorization marker, annotated tag, exact SHA, exact digest smoke, no-overwrite, stable alias serialization, safe branch cleanup을 그대로 회귀한다.

- #435 4-shard 중간 계측: 6.0/8.9/14.5/5.1분으로 최장 shard 개선 실패. 6-shard 재검증에서 최장 shard와 전체 PR CI wall-clock을 기준으로 최종 채택 여부를 판정한다.

## Issue #446 Release completion Finalizer resume 회귀

- Static trigger: `release-finalizer-resume.yml`은 `Publish release image workflow_run.completed` fallback과 `workflow_dispatch(target_sha, release_run_id)`를 함께 유지한다.
- Explicit handoff: `release-image.yml`은 publish success 이후에만 Resume workflow를 dispatch하고 exact `needs.prepare.outputs.target_sha`와 `github.run_id`를 전달한다.
- Completion race: explicit Resume은 source run ID를 polling해 `completed/success`, release workflow path, `head_sha == target_sha`를 모두 확인한 뒤 resolver를 실행해 parent release가 아직 active인 race를 제거한다.
- Post-publication safety: Resume dispatch job은 `continue-on-error: true`로 immutable GHCR publication 성공을 뒤집지 않으며 candidate/runtime/API/attestation/promotion gate 뒤에 위치한다.
- Trust boundary: Resume workflow checkout ref는 `main`이어야 하며 `github.event.workflow_run.head_sha`를 code checkout ref로 사용하지 않는다.
- Resolver: explicit dispatch와 workflow_run fallback 모두 기존 `auto_release_finalizer.py --target-sha`를 사용해 current main first-parent backlog를 재계산한다.
- Remote: PR exact head의 quality/e2e/docker required checks를 통과한 뒤 merge한다. merge Main CI가 기존 #439의 successful `v0.83.3` evidence를 소비해 PR #443/#445 branch cleanup, FINAL marker, Issue close를 수행하고 #446 자체도 no-release finalize되는지 확인한다.

## Issue #437 Historical timing E2E shard optimizer 검증

- Reporter: 성공 test의 file/duration만 timing JSON에 기록하고 실패/취소를 성공 sample로 사용하지 않는다.
- History: 최근 성공 `main` CI run artifact를 최대 20개 읽고 run별 동일 file duration을 합산한 뒤 file별 median을 계산한다.
- Robustness: 단일 느린 outlier가 median estimate를 과도하게 바꾸지 않는지 검증한다.
- LPT: 동일 timing 입력은 항상 동일 6-shard file plan을 생성하며 각 file은 정확히 한 shard에 배정된다.
- Stale/invalid plan: 삭제 file은 무시하고 신규 spec은 deterministic fallback으로 반드시 한 shard에 배정한다. shard 번호가 `1..N` 범위를 벗어나거나 duplicate shard group/file assignment가 있으면 plan 전체를 거부하고 native sharding으로 fallback하여 test 누락을 방지한다.
- Missing/corrupt plan: 일반 CI/Release는 기존 Playwright native `--shard=N/6`로 fallback한다.
- Threshold: 성공 run 10회 미만, timing coverage 80% 미만, 최근 imbalance breach 부족, 예상 개선 미달, cooldown 미충족 중 하나라도 있으면 plan PR을 생성하지 않는다.
- Security: historical artifact 내용은 실행하지 않으며 현재 checkout의 `tests/e2e` file 목록과 duration JSON만 사용한다.
- Automation: optimizer가 만드는 branch/title/body는 Primary Issue #437 trace 계약을 만족하고, PR 생성 직후 exact branch에 `ci.yml workflow_dispatch`를 실행해 required quality/e2e/docker를 생성하며 자동 merge는 수행하지 않는다.
- Metrics: Step Summary에 run 수, coverage, 최근 imbalance ratio, baseline/proposed critical time, 예상 개선율, 4~8 shard 후보 runner-minutes를 기록한다.
- Remote: #437 implementation PR exact head의 quality/e2e/docker required checks를 통과하고, 병합 후 timing artifacts가 실제 main CI에서 생성되는지 확인한다.
- Activation: historical sample 10회가 쌓이기 전에는 native 6-shard fallback이 정상 상태이며, 첫 자동 plan PR은 threshold 충족 후 별도 required CI로 검증한다.

- Issue #508 regression: proposal 출력과 workflow artifact path가 모두 `e2e-shard-proposal.json`인지 확인하고 hidden filename을 다시 사용하지 않는지 검증한다.
- PR lookup script는 GitHub CLI의 `--search` 값을 `"[Issue #437] ci: E2E 샤드 계획 갱신" in:title` 단일 argument로 구성하고, 후보 목록에서 exact title만 기존 PR 번호로 선택하는 Unit test를 유지한다. 이 로직을 inline Bash quoting으로 되돌리지 않는다.
- Workflow contract test는 `shouldUpdate=false`에서 조회/생성 step이 skip되는 조건, `shouldUpdate=true`에서 기존 PR 번호가 있으면 생성하지 않는 조건, 번호가 비어 있을 때만 생성하는 조건과 proposal artifact path를 정적으로 검증한다.

## Issue #438 Build-once / verified digest release promotion 검증

- Main 분류: first-parent `package.json.version`과 현재 version이 다를 때만 `version_changed=true`이며 `current_version`을 candidate build metadata에 사용한다.
- Main artifact: 비문서 main merge의 quality/e2e/docker PASS 뒤 `ci-<merge SHA>`를 정확히 한 번 build/push하고 digest pull, image policy, readiness, SQLite restart persistence, Project/Task API, transport smoke를 통과해야 한다.
- Retention: successful non-docs Main CI의 verified `ci-*`는 version 변경 여부와 무관하게 Generic Finalizer까지 보존한다. no-release finalize가 exact temporary candidate를 정리하고 release-required candidate는 formal promotion source로 유지한다. failed artifact job은 successful handoff가 아니다.
- Release target: annotated tag의 `tag^{commit}`이 candidate SHA의 유일한 source이며 `github.sha`나 mutable branch를 candidate key로 사용하지 않는다.
- Candidate binding: `org.opencontainers.image.source`, `revision`, `version`과 registry digest가 repository/tag target/package version과 모두 일치해야 한다.
- Build-once: `release-image.yml`에는 `docker/build-push-action`이 없어야 하며 container image 재-build를 수행하지 않는다.
- Publication ordering: candidate image policy·transport·migration/readiness·SQLite persistence·Project/Task API와 optional attestation이 exact tag보다 먼저 완료되어야 한다.
- Promotion: 마지막 publication step의 `imagetools create --prefer-index=false` single-source promotion metadata digest가 candidate digest와 정확히 같아야 한다.
- Exact tag conflict: existing exact SemVer가 같은 digest이면 idempotent retry, 다른 digest이면 overwrite 거부.
- Runtime: promotion 전 candidate와 promotion 후 exact digest에 대해 image policy/readiness/SQLite persistence/Project·Task API 검증을 유지한다.
- Alias: prerelease는 exact만, stable은 exact/major.minor/major/latest를 같은 최종 promotion step에서 candidate digest로 갱신하며 그 뒤 실패 가능한 release gate가 없어야 한다.
- Supply chain: Main build에서 생성한 SBOM/provenance가 candidate digest에 바인딩되고 optional GitHub Attestation도 동일 digest를 subject로 사용한다.
- Cleanup: release candidate `ci-<SHA>`와 exact SemVer가 같은 package version/digest를 공유할 수 있으므로 exact/rolling tag가 존재하는 version을 `ci-*` tag 제거 목적으로 package version 전체 삭제하지 않는다.
- 공식 판정은 #438 implementation PR exact head의 required quality/e2e/docker PASS와, 실제 version-changing 후속 release에서 Main candidate digest = exact SemVer digest evidence를 별도로 확인한다.

### Issue #439 release candidate API smoke 회귀

- `release-image.yml`의 Project/Task API smoke가 전달하는 container 이름은 `verify-registry-api-smoke.mjs`의 hard-coded allowlist에 반드시 포함되어야 한다.
- `mastergantt-release-candidate` 이름을 정적 테스트로 workflow 호출과 allowlist 양쪽에서 확인하여 container rename 시 silent contract drift를 방지한다.
- Release Run #131의 실패는 API request/assertion 실패가 아니라 allowlist 선검증의 usage error였으므로 API persistence gate 자체를 완화하지 않는다.
- failed immutable `v0.83.2` tag는 재사용/이동하지 않고 새 PATCH corrective release에서 exact main candidate digest의 transport/image/migration/SQLite/Project·Task API 검증을 모두 다시 수행한다.

### Issue #438 PR CI transport reset 재검증 기록

- PR CI #1775의 quality, Docker, Chromium shard 1/2/3/5/6은 PASS했고 shard 4/6에서 `tests/e2e/project-status.spec.ts:135` 한 건만 실패했다.
- 실패는 `project-status.spec.ts:197`의 `page.request.get()`에서 발생한 `apiRequestContext.get: read ECONNRESET`이며 assertion failure, HTTP status 계약 위반, #438 release/digest workflow 변경 경로의 실패가 아니다.
- 동일 spec/transport reset은 과거 PR CI #1373에서도 관측됐으며 당시에도 제품 코드를 우회하거나 Playwright retry로 녹색 상태를 만들지 않고 새 exact head 전체 E2E로 재검증하는 정책을 사용했다.
- 이번에도 test retry·실패 무시를 추가하지 않는다. 문서 보완 commit으로 새 exact head PR CI를 시작하고 quality/e2e/docker 전체 결과를 새 evidence로 판정한다.

### Issue #438 Main CI version classifier failure correction

- Main CI #1777은 `main release candidate version 판정`에서 `${GITHUB_SHA}^1`을 조회하다 실패했다.
- 원인은 checkout `fetch-depth` expression에서 숫자 `0`이 falsy로 평가되어 push run도 depth 1이 되었고 merge parent object가 로컬 checkout에 없었던 것이다.
- version-change 판정의 authoritative 기준을 `github.event.before`로 변경한다. 이는 push 직전의 main SHA이며 docs-only 판정과 동일한 event boundary를 사용한다.
- `BEFORE_SHA`가 비어 있거나 all-zero이면 fail-closed로 중단하고 release candidate retention 결정을 추측하지 않는다.
- 회귀 계약은 `${GITHUB_SHA}^1` 사용 금지와 `git show "$BEFORE_SHA:package.json"` 사용을 정적으로 검증한다.

### Issue #438 Main push checkout depth correction

- PR #442 review에서 `BEFORE_SHA`를 사용하더라도 checkout이 depth 1이면 clean runner에 이전 main commit이 없을 수 있음을 확인했다.
- `changes` job checkout의 conditional `fetch-depth`는 숫자 `0`이 expression에서 falsy가 되어 `1`로 떨어지는 문제가 있었다.
- push event에서는 문자열 `'0'`을 사용해 full history를 받고 PR에서는 `'1'`을 유지한다.
- 따라서 Main version classifier와 docs-only diff가 동일한 push history를 안정적으로 사용할 수 있다.

## Issue #439 CI setup/cache 계측 검증

- Recorder unit: JSONL schema/version, stable workflow file identity, run/job/event/head metadata, duration, cache field와 Step Summary 행을 검증한다.
- Analyzer unit: workflow/event/job/metric별 그룹 분리, 10개의 서로 다른 successful run ID에서 median/p90·cache hit 분포가 deterministic하게 계산되는지 확인한다. 동일 run의 E2E matrix shard와 rerun attempt는 record 수만 늘리고 Phase 2 run 표본 수는 늘리지 않아야 한다.
- Node setup contract: cache path는 `~/.npm`만 사용하고 key에 OS/arch/Node/lockfile hash를 포함한다. `node_modules` cache는 금지하며 `npm ci --prefer-offline --no-audit`를 항상 실행한다.
- Cache miss: npm/Next cache miss 또는 partial restore에서도 install/build/test가 동일하게 실행되어야 하며 cache 상태가 required check PASS를 대신하지 않는다.
- Playwright Phase 1: OS dependency와 headless-shell 설치 시간을 분리 기록하지만 `actions/cache`/`ms-playwright` cache는 사용하지 않는다.
- E2E readiness: CI/Release E2E 실행 직전 `E2E_RUN_STARTED_MS`를 설정하고 timing artifact의 `runnerReadyMs`가 non-negative로 기록되는지 확인한다. 이 값은 webServer startup/readiness + discovery를 포함하는 runner readiness 지표다.
- Workflow contract: PR/Main CI build/E2E/Docker/Main image와 Release static/E2E/candidate job이 동일 recorder를 사용하고 JSONL artifact를 30일 보존한다.
- Existing caches: TypeScript tsbuildinfo, Next `.next/cache`, Docker GHA cache의 기존 correctness/invalidation 계약은 유지한다.
- Security: cache/artifact에 credentials, `.env`, user data, node_modules, SQLite runtime DB를 포함하지 않는다.
- Phase 2 gate: PR/Main/Release의 workflow/event/job/metric별로 서로 다른 successful run ID >=10 전에는 새 Playwright browser cache를 추가하지 않는다. 이후 before/after median/p90 및 runner-minutes 근거를 Issue #439에 기록한다.
- 공식 구현 판정은 #439 implementation PR exact head의 required quality/e2e/docker 결과다. 실제 cache 최적화 효과 판정은 최소 표본이 쌓인 뒤 별도 evidence로 수행한다.


## Issue #452 — 관리자 공통 presentation·버튼 간격 회귀

- 세 route `/resources`, `/logistics-admin`, `/project-master-admin`의 동일 viewport에서 header bottom→heading 시작·gutter·heading scale, 인증 panel 폭/padding/gap을 비교한다. 로그인 전후 동일 shell geometry와 description의 자연 줄바꿈을 구분한다.
- 390/768/1024/1440/1920px에서 input/submit bounding box와 computed style을 측정한다. Desktop 40px input/button top·height 차이 ≤1px, 540px 이하 순차 stack, 문서 가로 overflow 없음이 기준이다.
- 입력 border/background/padding/focus/disabled 및 label/error ID 연결을 확인한다. 긴 한글/영문 label·설명·오류와 busy 상태가 sibling control을 침범하지 않아야 한다.
- Enter submit/중복 요청 방지/401·403·429·네트워크 실패 후 비밀번호 삭제/기존 focus 정책/401 만료 후 재인증을 관련 E2E에 포함한다. 실제 session 경계는 서버 tests와 별도 확인하고 mock UI 성공으로 교차 권한 PASS를 대신하지 않는다.
- Secondary button 전체 소비자 목록에서 이전 margin의 실효값과 변경·부모 이관·N/A 이유를 기록한다. Project List/new/workspace/dialog/empty/error/KPI 및 Task Editor 44px hit-area, `.text-link`, KPI `margin-top:auto` 보존을 확인한다.
- 동급 action은 같은 행에서 top/height 차이 ≤1px를 검증한다. wrap/stack은 같은 행 기준을 무리하게 적용하지 않고 순서·overlap·가용 폭을 별도 확인한다.
- 실제 앱 before/after screenshot은 geometry·keyboard·권한 증거를 보조한다. 독립 qa_docs는 AC/code/tests/docs/실제 실행을 비교한다.
- 공식 전체 회귀는 PR exact head의 GitHub Actions quality/e2e/docker다. 사용자 요청 범위는 CI 시작 확인까지이며 완료 모니터링·merge/main/GHCR은 수행하지 않는다. 시작 전 또는 결과 미확인 gate는 NOT TESTED다.

실행 증거와 미검증 범위는 [Issue #452 실행 계획](exec-plans/active/ISSUE_452.md)에 동기화한다.

Issue #452 소비자 전수 및 실제 실행/미실행 구분은 [검증 증거](ISSUE_452_UI_EVIDENCE.md)를 따른다.


### Issue #452 Main CI transport reset corrective

- Main CI #1847.1의 Chromium shard 2/6은 `project-browser-title-favicon.spec.ts`의 direct document GET에서 assertion 이전 `socket hang up` 1건으로 실패했다. 같은 shard 56개와 다른 5개 shard, build/typecheck/lint/Vitest/Docker는 PASS였다.
- direct GET helper는 `socket hang up` 또는 `ECONNRESET` 예외만 최대 3회 bounded retry한다. HTTP 4xx/5xx, 잘못된 HTML/title/content-type과 retry 소진은 기존처럼 FAIL해야 한다.
- retry는 Playwright 전체 retry나 test 실패 무시가 아니며 제품 요청/저장 동작을 재실행하지 않는다. favicon 정적 GET과 canonical 프로젝트 document GET의 transport reset에만 동일 helper를 사용한다.
- corrective PR은 Issue #452의 non-docs 후속 merge로 `Refs #452`를 유지한다. application version은 `0.83.4`를 유지하고 기존 version-scoped release authorization을 재사용한다.
- PR exact head의 quality/e2e/docker가 모두 PASS한 뒤에만 병합한다. 새 main CI SUCCESS가 확인되면 Generic Release Finalizer가 first-parent backlog와 same-Issue corrective merge를 해석하여 v0.83.4 GHCR release를 진행해야 한다.


### Issue #452 GHCR candidate lifecycle corrective

- Main CI #1852.1의 `Main 임시 commit 이미지 게시·검증·정리` job은 `ci-e812e56f...`를 build/push하고 image policy/readiness/SQLite/API/transport smoke를 모두 PASS했다.
- 기존 cleanup은 immediate first-parent의 `version_changed=false`만 보고 해당 package version을 삭제했고, Generic Finalizer는 #466/#467을 same-Issue target으로 수렴해 e812 SHA의 v0.83.4 Release를 시작했다.
- Release #133.1은 static quality와 Chromium 6/6이 PASS했으나 `Main verified candidate exact digest 확인`에서 candidate 부재로 FAIL했다.
- 보완 후 Main artifact job은 successful non-docs candidate를 Finalizer에 handoff하고 직접 삭제하지 않아야 한다.
- 단, image push 이후 digest/policy/readiness/API/transport/artifact 검증이 실패하면 Generic Finalizer가 실행되지 않으므로 Main artifact job 자체가 exact `ci-<SHA>` package version을 fail-closed helper로 삭제해야 한다.
- no-release lifecycle fixture에서는 `cleanup_temporary_main_candidate`가 exact `ci-<SHA>` cleanup helper를 호출하며, release-required finalize에서는 candidate cleanup을 호출하지 않아야 한다.
- Generic Finalizer/Resume과 수동 finalize mutation job은 candidate cleanup에 필요한 `packages: write`를 가지되 PR/일반 CI 권한은 확대하지 않는다. formal build/promotion은 계속 `release-image.yml`만 수행한다.
- failed immutable `v0.83.4`와 미게시 작업 후보 `0.83.5`는 재사용하지 않는다. 최신 main 0.85.0 기준 corrective package version은 `0.85.1`이며 PR CI → Main CI → Finalizer → Release에서 새 exact SHA/digest로 검증한다.

## Issue #461 완료 단계 Editor 검증

범위는 Task/Summary 기본 Membership picker, Milestone 소속 batch 탭, 기존 Resource/Logistics 초안 보호와 같은 canonical revision 적용이다. 서버/DB/Domain algorithm/API authorization은 #460을 재사용한다. 신규 pure UI 모델 검증은 `tests/domain/milestone-editor-model.test.ts`, 실제 SQLite UI는 `tests/e2e/milestone-stage-editor.spec.ts`, mock UI 상태는 `project-task-editor.spec.ts`의 #461 시나리오다.

| 검증 | 범위 / 근거 |
| --- | --- |
| Unit | 직접/nearest Summary 상속/override/null 복귀, full hierarchy/links, explicit-only batch, 고유 일반 Task 영향, Summary name+membership-only/Task 한 payload, omission/null, 완료 잠금, manual event와 실제 동적 탭 |
| 실제 SQLite API + Browser | 기본 한 PATCH·batch 한 POST 각각 revision+1, 실패 rollback, 양쪽 Editor 재조회 일치, override 보존, 100%+선행 미완료 거부, manual N/A 명시 완료, 완료/reopen 별도 save |
| Mock Browser | UUID/동명이인 식별 metadata·긴 후보 active option scroll·Escape/focus, Summary 일정/진척 readonly, Resource/Logistics dirty/pending/stale/401/412/network 초안 보존, 교차 mutation/확인 focus/inert/기본 Baseline 잠금, readonly 검색과 지정 거부 |
| Geometry | 390/768/1024/1440/1920×844, 긴 한글/영문/UUID·21개 후보 행·5개 탭, table 960px owned horizontal scroll, document overflow 없음, dynamic Arrow/Home/End focus, 기존 Gantt identity 유지 |

Local Fast Feedback는 실제 명령과 최종 결과를 구현 Result Contract에 기록한다. 이번 로컬 명령은 `npm run typecheck`, 변경 TS/TSX에 대한 `npx eslint <files>`, `npx vitest run --config tests/config/vitest.config.ts tests/features/gantt/task-editor-model.test.ts tests/features/gantt/task-editor-view-model.test.ts tests/domain/milestone-editor-model.test.ts` 및 repository Playwright config의 관련 spec/grep만 실행한다. 원격 전체 quality/e2e/docker와 독립 최종 QA는 NOT TESTED다.

독립 테스트 작성 Agent는 milestone-editor-model 22/22와 파일 ESLint를 실행했다. 최초 1건 실패는 in_progress 전환 progress=1이라는 테스트 가정 오류였고 명시 progress60으로 수정했다. 구현 Agent의 최초 typecheck 실패는 membership 변수 누락 1건으로 수정했다. 실제 UI fixture 최초 실패는 Project description 누락400, native select option까지 포함한 locator, rollback409를422로 가정한 오류였으며 수정 후 통과했다. 28189 실행 중 readonly 조회와 mutation 잠금을 분리하면서 이전에 로드된 Logistics 테스트의 toBeDisabled 기대가 남아 8 PASS/1 FAIL이었고 aria-readonly 기대를 갱신하여 별도 최신 #461 6/6 재검증했다. 재시도로 최초 오류를 숨기지 않는다.

실제 after 캡처와 측정은 로컬 `output/playwright/issue-461/memberships-{390,768,1024,1440,1920}.png` 및 `geometry.json`으로 생성한다. 재현: 실제 Project 생성→Milestone 2개·Summary와 child/override·긴 후보18개 생성→기본 picker 저장→Milestone 소속 batch→상태 완료/reopen→소속 탭 전체 후보→각 viewport에서 동적 탭 keyboard와 측정/캡처. PR 이미지 첨부는 지정 infra/Manager가 준비하며 캡처 존재 자체를 원격 QA PASS로 취급하지 않는다.

Before actual screenshot은 NOT TESTED다. baseline `4b98dd44c44335ae64e65e43f1c64f5f1b3fa384`의 project-task-editor.tsx/model/view-model은 네 탭만 제공하고 Membership picker/batch 탭이 없으며 Summary 전체 readonly 정책을 사용했다. 같은 Project를 baseline에서 Grid/Chart/context-menu→작업 정보로 열면 이를 재현할 수 있다. 이 source/재현 근거와 현재 after 실제 화면을 구분한다. 실제 운영 reverse proxy, native fullscreen/실기기/스크린리더 수동 UX는 이번 추가 시나리오에서 별도 NOT TESTED이며 기존 CI 범위와 혼동하지 않는다.

DOCUMENTATION_SYNC: TASK_EDITOR/PROJECT_UX/REQUIREMENTS/API/MILESTONE_STAGE_GATES/UI_UX_GUIDELINES/TEST_PLAN을 갱신한다. DESIGN은 기존 blue Light/system font/semantic token/compact Editor 시각 규칙을 재사용하므로 N/A다. DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/IMPORT_SCHEMA/VBA/배포/CI 문서는 신규 DB·서버권한·domain algorithm·Import/VBA·infra 변경이 없어 N/A다. CHANGELOG/활성 PLAN은 Manager 소유로 handoff한다.

2026-10-06 최종 로컬 결과: 관련 Unit 3 files/72 tests PASS, 변경 파일 ESLint PASS, typecheck PASS. `milestone-stage-editor.spec.ts project-task-editor.spec.ts --grep '#461'`는 6/6 PASS(40.9s)이며 추가 Baseline 교차 잠금 수정 후 `project-task-editor.spec.ts --grep '#461 picker|linked tasks allow editing'`는 2/2 PASS(8.6s)다. 같은 실제 SQLite fixture의 기본·batch·ready/manual event·completed/reopen과 mock 상태/readonly를 실제 Chromium으로 실행했다. 기존 실제 Editor persistence·412·Milestone 허용 필드·Resource 역할 저장의 관련 회귀는 별도 28189 실행의 해당 4개 PASS로 확인했으며 그 실행의 이후 실패 1건과 최신 재검증 결과는 위 기록을 따른다.

최종 geometry의 documentWidth는 390/768/1024/1440/1920px 각각 viewport와 같았다. 표의 scroll/client width는 각각 960/351, 960/700, 960/948, 1076/1076, 1076/1076px이며 모든 active tab은 dialog 안에서 보였다. 화면은 가짜 정식 QA 결과가 아니라 로컬 after 재현 증거다. Native fullscreen/실기기/스크린리더 수동 UX와 원격 quality/e2e/docker는 NOT TESTED로 남긴다.

### Issue #461 독립 UI 검토 REWORK

독립 UI 검토에서 editable query에 `aria-readonly=true`를 사용한 semantic 충돌과 pending 소속 패널 조회 입력의 문서 불일치를 확인했다. query readonly 속성을 제거하고 `aria-describedby` 잠금 안내를 연결했으며 option/action의 mutation guard는 유지했다. 테스트는 검색 타이핑·결과 조회·Enter/실제 pointer 선택 시 Membership 불변·mutation 0을 확인한다. Panel 검색 Enter 보호는 browser 재현으로 확정한 과거 결함 판정이 아니라 부모 form 저장으로 전파되지 않도록 한 입력 흐름 보강이다.

최초 REWORK 명령은 picker/spec ESLint·typecheck PASS 뒤 관련 E2E 2 PASS/1 FAIL이었다. 실패는 `aria-disabled` option에 locator.click이 enabled를 기다린 테스트 timeout이며 실제 pointer 입력으로 검증을 보강했다. 표 header/body columnalignment, sibling cell/control bounds 비중첩, tab scrollHeight/clientHeight·focused outline 경계를 실제 SQLite geometry fixture에 추가하고 긴 후보 input/active option/list owner 측정을 `picker-geometry.json`에 별도로 기록한다.

이 semantic/입력 보호 REWORK의 문서 영향은 TASK_EDITOR/UI_UX_GUIDELINES/TEST_PLAN에 반영한다. PROJECT_UX/REQUIREMENTS/API/MILESTONE_STAGE_GATES는 기존 검색 조회·mutation 잠금·pending 계약에 맞추는 수정이며 새 화면 흐름/요구사항/API/domain 계약이 없어 추가 변경 N/A다. DESIGN/DB/security/scheduling/Import/VBA/infra N/A와 원격 quality/e2e/docker·독립 최종 QA NOT TESTED는 유지한다. 기존 72개 Unit과 영향 없는 E2E 증거를 재사용하며 전체 suite를 반복하지 않는다.

추가 geometry 검증은 4 PASS/1 FAIL로 focus outline의 실제 clipping을 발견했다. 공통 outline 3px와 offset 3px에 비해 tablist의 기존 block padding은 4px였으므로 focus token 기준 6px 공간으로 수정했다. 이 실패는 제품 geometry finding으로 기록하며 이전 document overflow/표 최소 폭 PASS와 구분한다. Semantic/패널/Logistics 관련 4개 PASS는 source guard 변경 없이 재사용하고 CSS 수정 뒤 실제 SQLite geometry fixture 하나만 재실행한다.

Focus 여백 수정 뒤 actual SQLite geometry fixture 1/1 PASS(33.0s)로 다섯 viewport의 header/body columnalignment·cell/filter 비중첩·tab scrollHeight/clientHeight 및 전체 focus 외곽선 가시성을 확인했다. 표 명령 열을 포함한 모든 `tbody td button`의 control/closest-td bounds와 control 간 비중첩은 별도 최소 fixture 재실행으로 보강한다. 긴 후보 측정은 active option/list owner, focused input/body owner 모두 가시성 true이며 실제 input focus를 유지했다.

REWORK 최종 관련 브라우저 결과: semantic/검색/readonly/pending/Logistics의 4개 PASS를 유지하고, 모든 표 버튼의 td-contained bounds·control 비중첩을 추가한 실제 SQLite fixture는 1/1 PASS(29.8s)다. 다섯 폭 모두 명령 열 control을 포함한 bounds 검사를 통과했으며 `geometry.json`에 각 control/td의 원시 경계를 남긴다. `picker-geometry.json`에는 긴 후보의 실제 input/option/scroll owner 경계를 분리하여 남긴다. 전체 Unit/브라우저 suite 및 원격 gate는 이 REWORK에서 반복하지 않는다.


## Issue #462 단계 필터·선택 Grid 열 검증

단계 조회는 full canonical Membership projection을 사용하고 기존 유형/검색/기간/리소스/물류 조건 및 Workspace scope와 AND로 적용한다. `stage-grid-model.test.ts`는 직접/상속/override/미지정, scope 밖 ancestor 계산과 표시 분리, 조건부 빈 Summary context, Milestone-only 설정 context 제외, actual match와 고유 일반 Task 건수 분리, stable 후보 정렬을 검증한다. `relation-editor-model.test.ts`는 신규 same-type 후보와 legacy mixed 조회/완료 Milestone 양 endpoint 잠금의 차이를 검증한다. `task-url-snapshot.test.ts`는 canonical URL 변경·삭제, frame 격리·오래된 cleanup과 안전한 URL/입력 제외 계약을 검증한다.

실제 SQLite Chromium fixture `milestone-stage-grid.spec.ts`는 단계 UUID trim/casefold 검색·유형 독립 상태·scope별 Map 보존·Project GET/mutation 0회·Gantt identity, 같은 #461 Editor 기본 PATCH의 revision+1·소속 Grid/filter 동기화와 Milestone 소속 탭 진입을 검증한다. 같은 fixture는 390/768/1024/1440/1920×844에서 toolbar control containment/비중첩, Grid header/body 정렬과 모든 row/header button·role-button·input의 셀 경계, 작업명 최소 180px·단계 180px, document overflow·owned scroll, popup viewport 경계·긴 후보 active option/list owner·입력 focus·Escape trigger focus 외곽선을 측정한다.

Mock `milestone-stage-grid-mock.spec.ts`는 readonly 조회·keyboard 메뉴 진입 API 0회, 실제 Core port click→click 신규 mixed Link 거부, legacy 조회와 외부 완료 canonical 상태의 삭제 잠금, collapsed Summary·Grid scroll·scale·instance 보존, URL 변경/삭제와 noopener/noreferrer 열기를 검증한다. 실제 native grip으로 조절한 작업명 폭은 단계 열 표시/숨김 뒤에도 유지되어야 하며 pending 중 단계 셀/메뉴 Editor 진입은 비활성이다. 기존 URL quick-edit와 fullscreen 상태 검증은 해당 시나리오만 좁게 실행한다.

2026-10-06 Local Fast Feedback: `npx vitest run --config tests/config/vitest.config.ts tests/features/projects/stage-grid-model.test.ts tests/features/projects/project-search-filter.test.ts tests/features/gantt/relation-editor-model.test.ts tests/features/gantt/task-url-snapshot.test.ts`는 4 files/35 tests PASS(195ms)다. repository Playwright config의 신규 실제/Mock 두 spec은 57795에서 4/4 PASS(27.9s), 추가 resized-name/pending 시나리오는 84073에서 1/1 PASS(4.8s)다. 전체 suite와 원격 quality/e2e/docker, 독립 최종 QA는 NOT TESTED다.

최초 실패는 보존한다. Typecheck의 notification 함수/인수 오류와 Unit의 alias runtime·기존 mixed 후보 기대는 수정했다. 실제 UI에서 추가 Project GET을 관측했으며 초기 effect 재연결이라는 추정은 상세 stack 근거로 정정했다. 기존 document MutationObserver의 URL decorator가 매 DOM 변경마다 GET을 발생시키는 것이 원인이었다. frame별 canonical URL 공급으로 교체했고 이번에 추가했던 초기 조회 완료 marker는 제거하여 원래 초기 조회/retry/cross-tab 계약을 유지했다. Warmup은 검증용 lazy compilation만 준비하며 제품 GET을 숨기지 않는다. 최초 native Link 테스트의 drag 입력은 설치 Core의 port click→click과 달라 수정했다. Editor tab/닫기와 header 속성 locator 오류도 수정했다.

50031의 실제 fixture PASS 뒤 캡처/원시 측정에서 작업명 열 47px 축소를 발견했다. 이전 assertion 범위의 PASS를 전체 geometry PASS로 확대하지 않는다. 공개 set-columns의 사용자 width/flexgrow를 보존하고 resize-grid로 optional 열 폭의 증감만 반영하여 해결했다. 57795 최종 측정의 작업명은 다섯 폭 모두 227px, 단계는 180px이다. documentWidth는 각 viewport와 같고 owned scroll/client 폭은 720/364, 720/718, 974/974, 1390/1390, 1870/1870px이다. 후보 popup bottom은 842/843/793/701/701px로 844px viewport 안이며 active option/input/focus와 header/body·모든 control containment가 true다.

After 화면은 `output/playwright/issue-462/stage-grid-{390,768,1024,1440,1920}.png`, 원시 측정은 `geometry.json`이다. Before actual screenshot은 NOT TESTED이며 baseline `055f3fb23f94d6d42261927de8e452e237641529` source/재현 근거를 사용한다. 같은 프로젝트에서 baseline은 단계 필터·선택 완료 단계 열·직접 소속 메뉴 진입이 없고 기존 일반 작업 정보 진입만 제공한다. 현재 재현은 실제 Project→Milestone 두 개/동명이인·긴 후보 18개·Summary/child/override/빈 Summary→단계 열 표시→필터/scope 전환→기본 picker 저장→각 폭의 keyboard 및 Grid 측정 순서다. 실제 수동 스크린리더/실기기 검증은 NOT TESTED다.

DOCUMENTATION_SYNC는 PROJECT_UX/TASK_EDITOR/TASK_RELATIONS/REQUIREMENTS/TEST_PLAN/MILESTONE_STAGE_GATES/UI_UX_GUIDELINES 갱신이다. DESIGN은 기존 blue Light/system font/semantic token을 재사용하여 N/A다. API는 기존 #460 mutation/GET payload를 그대로 사용하여 N/A, DB_SCHEMA는 schema/migration 변경 없음, ARCHITECTURE는 기존 full canonical/UI 경계 유지, SCHEDULING_ENGINE은 일정/Ready/상속 domain 변경 없음, SECURITY는 서버 session/Origin/revision 및 안전한 URL 계약 유지로 각각 N/A다. IMPORT_SCHEMA/VBA_EXPORT는 Import/VBA 변경 없음, CI_CD/REMOTE_VALIDATION/DEPLOYMENT는 workflow/배포 변경 없음으로 각각 N/A다. CHANGELOG/활성 PLAN은 Manager 소유로 handoff한다.

추가 기존 관련 회귀: `project-gantt-inline-start-date.spec.ts project-gantt-fullscreen.spec.ts --grep '저장된 Task URL|split/열/주 단위'`는 83780에서 2/2 PASS(7.2s)다. 이 실행은 전체 fullscreen suite나 전체 회귀 PASS를 뜻하지 않는다.

최종 source typecheck와 변경 파일 ESLint는 PASS(0 errors, 기존 project-gantt hook warnings 4개 유지)이며 isolated Next가 만든 next-env/tsconfig 경로는 실행 종료 뒤 baseline으로 복구했다. 로컬 Markdown 링크 검사와 diff whitespace 검사도 수행한다. 원시 geometry 5개 폭에 대해 작업명≥180px/단계=180px 및 popup 0..844px 경계를 추가 확인했다.


## Issue #463: 단계 dashboard와 scoped effort

최종 로컬 결과는 backend 관련 검증 PASS, actual #463 1/1 PASS, 새 layout/picker의 five-width geometry 및 추가 actual #462 PASS다. 최초 harness 오류와 가로 scroll/popup 제품 FAIL은 아래 이력으로 보존한다. 원격 quality/e2e/docker와 독립 최종 QA는 NOT TESTED다.

- `tests/domain/milestone-dashboard-model.test.ts`: request 정규화/배열 unique-sort, 요청 날짜 echo와 resolved 날짜 구분, mdPerMmProvided·omission/null/ENV 환산, publicId/Project exact revision/minimum Catalog revision, 과거 filter 응답 거부, null 표시와 서울 자정/year/leap 경계를 고정한다. client는 E/P/Ready/공수를 재계산하지 않고 DTO를 보존한다. 담당 Agent의 최초 Local Fast Feedback는64/64 PASS, 이 파일 ESLint PASS이며 실제 브라우저/원격 CI 증거는 별도다.
- `tests/domain/milestone-resource-drill.test.ts`: 개인 assignment ID/Task ID/Resource ID 교집합과 inclusive 기간 overlap, exact Project/Catalog revision 및 빈 ID 집합의 전체 범위 확대 방지를 검증한다. frontend Local Fast Feedback는5/5 PASS이며 기존 API의 값을 새 공수 산식으로 재계산하지 않는다.
- `tests/server/projects/milestone-dashboard-calculation.test.ts`: E/P full Gate, Summary 상속, S/F 독립, raw weighted progress·반올림100경계, 수동 이벤트·완료 불일치, mixed predecessor 제외, 직접/member 물류 관련 M, 범위 밖 불완료, 개인 assignment dedup·미설정·다중 그룹·same-assignment role/grade, raw M/M thirds, bucket Grand Total, coverage0/null, inclusive 날짜/horizon1·상한·서울 자정 및 query/ENV/null 정책을 검증한다.
- `tests/server/projects/milestone-dashboard-http.test.ts`: 실제 SQLite read transaction/Project row, clock 1회, 공개 readonly/no-store/최소 catalog·secret 비노출·무변경, Project 격리, Resource Group/Resource Calendar, 기존 workload totals 일치, resolved 범위400·strict query/ID/enum/size/scalar중복, unknown valid ID empty-match, revisions/날짜 재조회, 물류 환산/동일 full projection·날짜상한, DB close/reopen persistence 및 inventory를 검증한다.
- 기존 `tests/server/logistics/logistics-dashboard.test.ts`는 M/D/진척/ID/기간 기존 기대값을 유지하며 default20 M/M 기대를 명시 unset으로 갱신한다. 기존 Stage Gate/Resource workload/Calendar/API inventory 회귀를 함께 실행한다.
- UI의 echo/revision/timezone/요청 역전/실패 재시도·날짜 경계/focus/visible refresh, full-stage/scoped 공수 구분, 원인 ID 전체 일정 drill, Resource 범위 drill, readonly/Gantt mount 상태, 390/768/1024/1440/wide·긴 이름/큰 수·keyboard/column geometry는 frontend evidence와 별도 browser 검증으로 기록한다.
- Resource drill은 실제 기존 GET from/to가 Stage workloadRange와 같고 range echo/Project/Catalog revision이 맞는지, 받은 원시 assignment를 재계산 없이 표시 필터하는지, scope 해제 시 기본 GET으로 복귀하는지 검증한다. Stage raw/query 환산과 기존 Resource4자리 rounding/ENV 및 기간 subtotal의 표시 차이를 검사하며 새 Resource API/공수 엔진은 N/A(변경 없음)다.

Backend Local Fast Feedback는 관련 Stage/Logistics/Resource/Calendar 테스트 9 files/155 tests PASS 뒤 계산 회귀 2건을 추가하여 `milestone-dashboard-calculation.test.ts` 30/30 PASS로 재검증했다. `milestone-dashboard-http.test.ts`는34/34 PASS, API inventory를 포함한 `edit-authorization-handlers.test.ts`는17/17 PASS다. 이 결과는 서로 겹치는 실행이며 전체 suite PASS를 뜻하지 않는다. Backend source freeze 시점의 `npm run typecheck`와 변경 backend source/test의 scoped ESLint는 exit0, Markdown 링크 검사는122 files PASS, diff whitespace 검사는 PASS였다. 이후 frontend 수정의 최종 typecheck/lint는 해당 담당 결과로 별도 기록한다.

최초 backend 검증 실패도 보존한다. HTTP fixture가 개인 assignment의 전역 DEVELOPER 역할을 구성하지 않아 DB trigger `task assignment role is not held by resource`로 실패했고 fixture 역할을 추가했다. Calendar fixture의 target/scope 및 revision 함수 타입 오류를 실제 계약에 맞게 수정했다. 초기 typecheck의 frontend `mdPerMmProvided`/callback narrowing 오류는 frontend가 수정했으며 DB trigger와 authorization gate를 완화하지 않았다. Vite native configLoader future 경고는 유지했다.

실제 browser 검증 `tests/e2e/milestone-stage-dashboard.spec.ts`는 Next/SQLite에 병렬 M-A/M-B→M-JOIN, 수동/완료 이벤트, Summary 상속/Task override/빈 Summary/미지정 및 개인 DEVELOPER50/100/50·Group 참조·물류 direct link를 구성한다. Editor1 PATCH/revision+1→Grid/필터→full E/P/Ready·Blocked·Risk/완료율1/5→2026-10-05..06 공수 Grand Total2 M/D·JOIN0.5·미지정0.5→숨긴 bucket→물류 full gate→Resource 같은 기간/revision/3 assignment ID 검증은 실제 실행에서 PASS다. 기본 Project 한국 공휴일10/05를 제외한 근무일1이 각 개인 assignment의 기준이다.

7차 실행의 전체 browser 판정은 FAIL이었다. 원인 분리 실행(session66170/chunk45a54a,15.2s)에서 차트 가로 위치는 native fullscreen 전120(max1179)→활성120(max1155)→종료120(max1179)→peer 숨김 직전120(max1179)→복귀0(max1315)였다. native fullscreen 자체는 PASS이며 DOM의 최대 scroll 범위 축소로 생긴 clamp는 관측되지 않았다. 이 측정은 Core의 scale/chartWidth clamp 여부를 판정하지 않는다. peer 숨김/복귀의 horizontal scroll 손실을 확인해 frontend가 viewport 복원과 공개 scroll 상태를 검토하며 원인은 아직 확정하지 않는다. 최종 수정 뒤 전체 actual 재실행 전에는 PASS로 바꾸지 않는다.

8차 재실행(session28788/chunk2004b7,15.0s)은 첫 peer viewport 복원 수정 뒤에도120→0으로 FAIL이었다. Grid661/Chart client725 split 폭·native fullscreen 및 나머지 Gantt 상태는 PASS였고, 실제 Logistics UI의 M-B Ready/1 /1 및 API/Resource 같은 기간3 assignment ID도 다시 PASS다. checkpoint/report/trace를 유지하며 frontend 후속 수정과 전체 actual 재실행을 기다린다.

9차 실행(19.8s)은 공개 `scroll-chart` 상태를 보강한 뒤 requestedLeft120/domLeft120/publicLeft22로 FAIL이었다. 공개 이벤트 trace는 left0→120→22→0(visible=true)이며 공개 state120 조건에서 실패해 후속 layout/viewport1456→1440 검증은 NOT TESTED다. 초기 API·Logistics UI·Resource·readonly401·native fullscreen 검증은 PASS이고 frontend가 후속 수정 중이다. 이 결과를 최종 제품 PASS로 확대하지 않는다.

10차 actual 실행(session46909/chunk099033,20.4s, fixture SHA256 `3e66bbc01bbb459bfa45b17c45807b32ab00e1ba1eb6aed57179086f0e1fca5c`)은 live getter 도입 뒤 초기 DOM/public120 baseline 및 native fullscreen 종료120까지 PASS였다. peer 복원 count1/requested120 뒤 최종 live DOM/public이 모두0으로 FAIL이므로 단일 시점 진단값의 한계와 구분되는 실제 상태 회귀다. 기존 full/scoped API·Logistics UI·Resource 기간/IDs·readonly401은 다시 PASS였고, 후속 layout 및 조건부 #462 actual 실행은 NOT TESTED다. frontend 재작업과 최종 재실행을 기다리며 동일 경로 trace를 보존한다.

후속 mock 실행98701은10개 중8 PASS/2 FAIL이었다. 공개 live viewport·후속 실제 layout·1회 consume 및 request/time/cache, 기존 #462 stage-grid2건/fullscreen2건은 PASS였고, 실패2건은 표시값 `5 M/D`를 `5.00 M/D`로 가정한 기대 및 exact getByLabel harness였다. narrow 실행72881에서는 이 두 오류를 수정했으나 geometry 합성 조건1개와 refresh 응답 미대기 fixture race가 남아16265에서 측정/재검증 중이다. 이 시점의 geometry 원인은 제품 결함으로 확정하지 않는다. 최종 mock/geometry 판정은 후속 결과로 기록한다.

추가 측정95025(exit1)에서 geometry 실패는 닫힌 DETAILS 내부의 숨겨진 “Dashboard 조건 초기화” 버튼 cached rect를 표시 control로 집계한 harness 오류로 확인됐다. checkVisibility를 적용하여 실제 visible control containment 조건을 유지하며 제품 source는 변경하지 않았다. selection/catalog/revision narrow 실행16265는1/1 PASS였다. 390px narrow 측정에서 단계 표/공수 표 폭1052/800, header/body 및80개 cell control·필터·focus containment, documentWidth390은 PASS였다. 이 부분 측정을 다섯 폭 geometry PASS로 확대하지 않는다. 95025 시점의 geometry 전체 재실행과 actual 최종 결과는 NOT TESTED였다. 최초 mock 실패 context/trace는 `output/playwright/issue-463/first-mock-failures`와 `second-mock-failures`에 보존한다.

Five-width geometry 최종 narrow 실행21866은1/1 PASS(6.9s)였다. 명령은 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/planner/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome npx playwright test --config tests/config/playwright.config.ts tests/e2e/milestone-dashboard-state.spec.ts --grep 'five-width geometry' --workers=1`이다. 390/768/1024/1440/1920px의 header/body·전체 cell/기타 control containment·focus·popup·document 폭을 확인했다. 390px에서 단계 표/공수 표 폭은1052/800px이고 두 scroll owner의 client 폭은352px다. 나머지 폭별 원시 수치는 geometry.json에 기록한다. `output/playwright/issue-463/geometry.json`, `dashboard-{390,768,1024,1440,1920}.png`와 `dashboard-stage-table-{390,768,1024,1440,1920}.png`는 after 재현 증거이며 actual10차 가로 스크롤 제품 FAIL과 별도다.

10차 FAIL 뒤 Manager는 inactive peer의 display:none으로 생기는 zero geometry를 제거하도록 shared grid cell과 visibility:hidden/inert/aria-hidden의 최소 peer layout 전략을 승인했다. native fullscreen·Gantt instance·domain 계약을 유지하며 임의 restore delay/retry와 private API는 사용하지 않는다. 21866 five-width geometry PASS는 이 layout 수정 전 증거다. 새 layout 적용 뒤 viewport mock·다섯 폭 geometry·기존 fullscreen·actual을 재검증해야 하므로 이 항목의 최종 판정과 문서 동기화는 후속 실행에 따른다.

승인된 shared-grid peer layout 수정 뒤31864 실행은4/4 PASS(16.0s, exit0)였다. repository config로 `milestone-dashboard-state.spec.ts project-gantt-fullscreen.spec.ts --grep 'five-width geometry|public viewport|버튼·Ctrl|split/열' --workers=1`을 실행하여 새 five-width geometry·공개 viewport·기존 fullscreen 시나리오를 확인했다. inactive Gantt의 inert/visibility:hidden/keyboard focus 제외도 PASS다. 수정 전21866 geometry/PNG는 `output/playwright/issue-463/before-peer-grid-layout`에 별도 보존하고 현재 geometry/PNG는 새 layout 증거로 갱신했다. 이어 actual11차를 실행했으며 결과는 아래 기록을 따른다.

Shared-grid layout 후 actual11차 실행56655/chunk08d93a는1/1 PASS(15.3s, 전체25.8s)였다. live DOM/public 가로 위치120은 native fullscreen·peer 왕복·후속 layout에서 유지됐고 Grid661/Chart client725/scrollWidth1904 및 restore count1을 확인했다. full/scoped API·Editor/Grid·Logistics UI M-B Ready/1/1·Resource 동일 기간/IDs·readonly401도 PASS였다. 결과 JSON5개와 PNG는 `output/playwright/issue-463-actual`에 남긴다. 10차 trace에서 hidden resize726과 공개 restore 뒤 synthetic1972→726/scroll0을 관측했으며 zero-width action을 직접 관측했다고 주장하지 않는다. shared-grid layout box 유지로 기존 재현의 회귀를 해결했으나 실제 운영/다른 engine 전체 검증을 뜻하지 않는다. 이 실행은 ProjectRevision25/CatalogRevision3의5개 M과3개 개인 assignment ID를 원시 JSON에 보존했고 test SHA256은 `c8a6c9542591636c368efdfb89e53b7a1951ed1eff953dc1e1eb60173b127344`다. native fullscreen 활성 중 peer 탭 전환과 비영(0보다 큰) 수직 scroll의 SQLite actual 보존은 NOT TESTED다. 담당 scoped ESLint/typecheck는 PASS였고 추가 #462 actual은 아래 결과와 분리한다.

Manager 최종 코드 검토에서 peer 복원의 top을 가로 owner `.wx-chart.scrollTop`에서 읽는 위험을 확인하여 기존 수직 owner `.wx-gantt.scrollTop`을 사용하도록 최소 수정했다. 후속 mock64059는1/1 PASS(4.3s)였으며 maxVertical≥96을 먼저 확인한 뒤 native/public top96·left120이 peer 왕복과 후속 layout에서 유지되는지 검증했다. Actual11은 top0 범위의 기존 PASS로 재사용한다. 이 최소 수정은 수직 capture owner만 바꾸고 가로 scroll·layout·instance·서버 계산/조회는 바꾸지 않으며 top0에서는 양 owner의 기존 값이 같고 비영 범위는 새 mock으로 확인했다. 비영 SQLite actual은 실행하지 않아 NOT TESTED로 유지한다.

추가 #462 actual 실행23252/chunk19be1c는9.9s에 FAIL이었다. 390px에서 popup bottom845.5가 viewport 높이844를 넘었으며 첫 screenshot 이전 실패라 #462 생성 출력은 바뀌지 않았다. 당시 frontend가 후보 popup geometry를 재작업했다. 이 실패를 #463 actual11차의 서버/peer PASS로 가리지 않으며 수정 뒤 관련 geometry/actual 재검증 결과를 반영한다.

최초 실행의 중복 selector FAIL 뒤 fixture scope/interruption·한국 휴일 oracle·copy-sort oracle·label lookup을 수정한 이력을 보존한다. 명령은 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/milestone-stage-dashboard.spec.ts --project=chromium --workers=1`이다. 확인 폭은1440×900이며 API/Resource 동일 기간/revision/IDs와 readonly peer의 instance/Week/tree/selection/column width는 다시 PASS다. trace/screenshot 및 report JSON의 `actual-scroll-checkpoints`를 근거로 기록한다. native fullscreen 활성 중 peer 전환은 범위 밖 NOT TESTED이고, 다른 폭 geometry/mock 증거는 frontend handoff로 별도 기록한다.

후보 popup의 실제 browser chrome 측정·upward 배치·resize/scroll fit 수정 뒤34383/chunk e9aa2a는2/2 PASS(26.3s, exit0)였다. 명령은 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/planner/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome npx playwright test --config tests/config/playwright.config.ts tests/e2e/milestone-dashboard-state.spec.ts tests/e2e/milestone-stage-grid.spec.ts --grep 'five-width geometry|#462' --workers=1`이다. 기존 containment/viewport assertion을 유지하여 새 picker의 다섯 폭 geometry와 actual #462를 확인했다. 31864의 공개 viewport/기존 fullscreen 및 actual11차는 picker 후속 수정과 scroll source가 독립이고34383에서 교차 검증했으므로 재사용한다.

Frontend 최종 LFF는 typecheck11606/chunk92b97f exit0, 변경 picker/view/test ESLint51190/chunk7c6007 exit0, 소유 전체 ESLint26149 exit0(0 errors/9 warnings: 기존8개와 generation ref 보호의 의도된1개)다. 기존69개 Unit과 나머지 request/mock PASS는 영향 없는 범위로 재사용한다. 생성 next-env/tsconfig는 HEAD와 diff0으로 복구했다. 새 layout/picker의 geometry.json과10 PNG 및 actual6개 파일은 로컬 after 증거이며 before actual screenshot·실기기·스크린리더 수동 UX·운영 proxy는 NOT TESTED다.

수직 capture owner 수정 뒤 최종 frontend typecheck24623/chunk3a76dc는 exit0, picker/view/mock ESLint90970/chunk033b07는 exit0, Markdown 링크122 files는 PASS였다. 생성 파일 diff0을 확인하고 frontend source/doc writer를 freeze했다. 이 변경은 client viewport capture만 보강하므로 API·DB·서버 권한·snapshot/calculation 문서의 추가 변경은 N/A다.

PR #468의 새 main `a9107ab2776829cbb0467a762ab8bf9ce1ce82c4`를 feature #463에 `--no-ff --no-commit`으로 통합했다. 충돌은 0건이고 기존 72개 대상 파일 hash는 불변이며 main 원본 테스트 3개만 추가했다. 독립 QA의 `npx vitest run --config tests/config/vitest.config.ts tests/server/migration-cli.test.ts`는1 file/3 tests PASS(751ms, exit0, chunka6a71a, 시작07:18:09 KST)였다. subprocess의22개 migration 적용·재실행 applied[]·SQLite persistence/count22를 확인했고 기존 Vite native configLoader future 경고는 유지했다.

통합 후 browser 최소 LFF는 Chromium 환경 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/planner/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`에서 공통 명령 `npx playwright test --config tests/config/playwright.config.ts --workers=1`로 실행했다. 79426에서 `project-task-context-menu.spec.ts new-project-draft-preservation.spec.ts --grep 'Issue #390 Copy ID copies canonical|^blank 요청 중'`은 Copy ID1/1 PASS(18.6s, exit0, chunk55efaf)였다. 첫 anchored blank grep은 Playwright file prefix 때문에 발견되지 않아66106에서 `new-project-draft-preservation.spec.ts --grep 'blank 요청 중'`만 별도 실행해1/1 PASS(3.7s, exit0, chunk7e9a8a)를 확인했다. Template/다른 case는 실행하지 않았다. Next 생성 파일 diff0과 source hash 불변을 확인했으며 제품/API 계약 문서 추가 영향은 N/A다. 이 결과는 관련 LFF이고 전체 75개 대상 파일 변경의 독립 QA와 공식 quality/e2e/docker는 NOT TESTED다.

최종 DOCUMENTATION_SYNC는 API/ARCHITECTURE/SECURITY/REQUIREMENTS/MILESTONE_STAGE_GATES/ISSUE_56_RESOURCE_WORKLOAD/LOGISTICS_DASHBOARD/TEST_PLAN과 frontend 소유 PROJECT_UX/UI_UX_GUIDELINES/TASK_EDITOR를 갱신한다. DB_SCHEMA/migration은 저장 구조 변경 없음, SCHEDULING_ENGINE은 기존 inheritance/Ready/Calendar 알고리즘 재사용, IMPORT_SCHEMA/VBA_EXPORT/Export는 해당 경로 변경 없음, DESIGN은 기존 semantic token 재사용, CI_CD/REMOTE_VALIDATION/DEPLOYMENT/HTTP_OPERATION은 workflow·runtime·HTTP 보안 정책 변경 없음으로 각각 N/A다. 기존 Resource workload API는 같은 from/to 조회를 연결하는 UI 변경이며 새 필드/공수 엔진이 없어 N/A다. CHANGELOG/활성 PLAN/version/Git/PR은 지정 Manager/infra 소유로 handoff한다. 로컬 구현·문서 판정과 독립 QA/원격 CI 판정을 분리한다.

Local Fast Feedback는 관련 테스트 실행 결과이며 PR quality/e2e/docker 공식 회귀 PASS를 대체하지 않는다. 원격 실행 전/진행 중은 NOT TESTED다. 실제 운영 HTTP/TLS reverse proxy/Windows Excel/VBA/DRM은 별도 환경이며 #463에서 검증했다고 주장하지 않는다.

### Issue #461 PR #470 review 보완

PR #470의 P2 review 3건은 기존 저장·권한·domain 계약을 확대하지 않는 회귀 수정으로 처리한다. Resource 신규 선택→역할/투입 입력→선택 해제 후에는 선택 대상 기준 canonical draft가 원래 상태와 같아 dirty가 해제되어야 한다. Milestone의 소속 작업 탭에서 외부 type 변경을 감지해 명시 reload했을 때 새 type이 제공하지 않는 active tab은 작업 정보로 정규화한다. Membership 보유 Project의 Excel 409 응답은 `MILESTONE_MEMBERSHIP_PRESERVATION_UNAVAILABLE`과 함께 explicit source/target public Task ID를 `details`에 포함한다.

회귀 근거는 `project-task-editor.spec.ts`의 Resource 선택 해제/타입 변경 reload 시나리오와 `milestone-stage-gates.spec.ts`의 실제 HTTP Excel error details 검증으로 보강한다. 최신 main 정렬 뒤 동일 PR head에서 새 Full PR CI의 quality/e2e/docker 결과를 공식 판정 근거로 사용하며, 새 원격 PASS 전에는 기존 로컬·사전 QA 결과를 최종 ACCEPT로 승격하지 않는다.

### Issue #461 PR CI #1870 E2E corrective

PR CI Run #1870.1의 Chromium shard 4/6은 `project-task-editor.spec.ts`의 기존 회귀가 Summary Editor에 저장 버튼이 없어야 한다고 기대하여 1건 실패했다. #461 계약은 Summary 일정·진척은 readonly로 유지하되 이름과 Membership은 편집 가능하므로 저장 버튼 자체는 존재해야 한다. 제품 동작을 되돌리지 않고 해당 회귀를 저장 버튼 존재 + 작업명 editable + 요청 시작일 readonly 검증으로 갱신한다. 같은 run에서 quality/build/unit/docker와 나머지 E2E 5개 shard는 PASS였으며, 새 head의 전체 PR CI 결과를 공식 증거로 다시 사용한다.

### Issue #461 PR CI #1873 E2E corrective

PR CI Run #1873.1도 Chromium shard 4/6의 같은 기존 Summary 회귀 1건만 실패했다. #1870에서 저장 버튼 계약은 정정했지만 이어지는 문자열 assertion이 과거 문구 `하위 작업으로 계산`을 계속 요구했다. 현재 #461 UI는 Summary의 새 Membership 의미를 `하위 작업 기본 완료 단계`로 표시하고 요청 일정은 readonly로 유지하므로, 문자열 회귀를 현재 계약의 실제 label로 교체한다. 같은 run의 quality/build/unit/docker와 E2E 1/2/3/5/6 shard는 모두 PASS였다. 새 head 전체 PR CI 결과를 다시 공식 판정 근거로 사용한다.


## Issue #453 리소스 관리자 독립 탭 LFF와 화면 근거

구현자 로컬 검증이며 독립 QA·원격 quality/e2e/docker 결과가 아니다. Resource production baseline은 `fd8fdc9e9207ab43a6fb7ff85b5a5acbe91d4553`이고 header version은 infra가 준비한 0.90.0이다. before TSX/CSS는 baseline byte 동일이며 application 전체 파일 동일을 주장하지 않는다. 동일 seed(리소스12/그룹5, 긴 KO/EN name/code, 역할0/1/3, 미지정/EXPERT, active/inactive, usage0/used/unknown, 선택 그룹)를 사용했다. 전용 fixture의 실패·logout/deferred 제어는 after 테스트에 보강했으며 seed 의미는 바꾸지 않았다.

실행은 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/planner/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome npx playwright test --config tests/config/playwright.config.ts ... --project=chromium --workers=1 --max-failures=1` 공통이다. before만 `RESOURCE_CAPTURE=before`, `resource-tabs.spec.ts --grep 'baseline before'`를 사용했다. 아래 session/chunk는 실제 실행 핸들이다. 최초 실패의 raw trace/error context는 `/tmp/issue453-*-after-fail`에 보존하고 Git 게시 대상에서 제외한다.

| 실행 | session / 최종 chunk | 결과와 최초 원인 |
| --- | --- | --- |
| before 최초 | 96993 / b57775 | FAIL: Turbopack node_modules 외부 symlink, 테스트 시작 전 실패 |
| frozen 설치 | 52944 / fa0998 | npm ci exit0, dependency 변경0; 기존 audit high7 보고·자동 fix 없음 |
| before 재실행 | 66092 / d99430 | 1 PASS, 1.9s / 전체5.7s, 5폭 PNG/geometry |
| after1 | 77844 / 38a461 | 22 PASS·1 FAIL·16 미실행, 32.4s; 빈 Next route-announcer 선택 하니스 |
| after2 | 48930 / 36e4a9 | 1 PASS·1 FAIL·1 skip·9 미실행, 10.4s; 폐기 확인 초기 focus 제품 결함 |
| after3 | 38882 / cec9d4 | 1 PASS·1 FAIL·15 미실행, 8.9s; 401 명시 초안 재진입 누락 하니스 |
| after4 | 69975 / 931a49 | 5 PASS·1 FAIL·1 skip·9 미실행, 13.3s; 부모 effect만으로 focus 결함 지속 |
| after5 | 13585 / d291a5 | 1 FAIL·9 미실행; native autofocus로 초기 focus는 통과, 폐기 버튼 exact locator 누락 하니스 |
| after6 | 60772 / 431c4e | 7 PASS·1 FAIL·2 미실행, 42.0s; aria-disabled 일반 click actionability 하니스 |
| after7 | 8981 / 6c56c5 | 6 PASS, 10.3s; 실제 mouse·Enter DELETE0, 기존 layout/roles/401 재검증 |
| after8 | 1022 / 2b34ba | 2 PASS, 4.7s; 실제 left230/top≥70 왕복·nested Escape/취소 focus |
| after9 | 47140 / 1642c8 | 3 PASS·1 FAIL, 16.6s; badge/raw revision 정정 및 after20 통과, 반복 pending Escape 제품 결함 |
| after10 | 74763 / d0c05d | 5 PASS, 7.6s; owned modal focus/Escape capture, 기존401·중복 제출 및 pending5폭 |
| after11 | 83329 / 5df16b | 3 PASS, 9.5s; 권한403 안내·최종 after20+dirty/pending10, Tab/ShiftTab·포인터 닫기·응답 후 focus |
| after12 | 48782 / 32fd7a | 2 PASS, 7.6s; 실제 환경 metadata+after20 갱신·#120 inactive td/tr contrast 보호 |

기존 5개 spec(29 case)을 새 modal/tab 진입으로 이관하고 `resource-tabs.spec.ts` 신규11 case를 추가했다. before 전용1 case는 after에서 skip하도록 분리한다. 추가 #120 Resource inactive contrast 1 case의 selector를 상태 option 대신 실제 td/tr로 이관하여 ratio/opacity guard를 유지했다. after 누적41 unique case PASS이며 PASS 실행57회 중 중복16회는 변경 영향에 따른 좁은 재검증이다. 단일 최종후보 41개 전체 실행이라고 주장하지 않는다. focus 보강 이후 layout/roles/401/412·오류 keyboard를 재검증하고, badge/raw번호 정정 이후 역할/tab/최종 geometry를 재실행했다. 변하지 않은 API/요청·생성 오류·삭제 보호는 앞선 LFF를 영향 근거로 재사용한다. 전체 공식 회귀는 exact PR head CI를 따른다.

새 직접 검증은 atomic grade+ordered roles PATCH1/편집 중PATCH0, mutation403 초안·권한 안내, create/profile/member 동기 요청1, pending input/close/반복 Escape/Tab 잠금, dirty 생성/profile/member 폐기·계속 편집·focus 복원, 탭별 조건과 비영 scroll/초안·GET0/mutation0, explicit logout 성공/실패와 초기화 범위, used/unknown DELETE0, 검색 밖 전체 members PUT/If-Match 및 missing Resource PUT0이다. 이전 두 inline 생성폼의 동시 초안·배경 refresh는 modal 배경 접근 금지로 이관했으며 생성10 오류 case의 보호 목적을 구성원 초안과 교차해 유지한다.

게시 후보는 `output/playwright/issue-453/before/` PNG5+JSON5와 `after/` PNG30+JSON30+environment JSON1 총71개만이다. after 네 기본 surface(resources/groups/create/profile)는5폭, 추가 dirty 확인과 pending 생성도5폭이다. Group 기본 surface는 실제 구성원 section/footer를 포함한다. pending5폭은 모든 control disabled·반복 Escape·Tab/ShiftTab·좌표 닫기 시도 후 modal 유지와 응답 후 호출 버튼 focus를 포함한다. 390/768/1024/1440/1920에서 documentWidth=viewport, active panel=358/720/976/1392/1600px, Resource table 최소976/Group800, identity 최소240, header/body 정렬·셀 버튼36+15 및 역할 badge20 containment/비중첩·focus·footer 중앙 정렬을 검증했다. before부터 문서 overflow는0이었으므로 overflow 수정으로 과대 표현하지 않는다.

실제125% browser zoom은 NOT TESTED: headless 테스트에는 browser chrome의 native zoom 제어가 없으며 DSF/CSSzoom/viewport 변경을 zoom 증거로 사용하지 않았다. 실제 기기·screen reader, 서버 권한 전체 회귀, 원격CI·Docker·GHCR·최종 수동 UX도 NOT TESTED이다. API/DB/auth/domain/shared dialog/globalCSS 계약 변경은 N/A(해당 파일 무수정). 테스트·source·문서 최종 해시와 후속 type/lint/version/doclink 결과는 frontend Result/manifest에 기록한다.

최종 after 실제 환경은 `after/environment.json`에 기록했다: navigator.language `en-US`, Intl timezone `Asia/Seoul`, Chromium `153.0.8010.12` 및 같은 버전의 navigator userAgent. before locale/timezone/browser version은 별도 실측하지 않았으므로 NOT RECORDED이며 같은 DesktopChrome config와 동일 seed 근거를 after 실측과 구분한다. 날짜 없는 Resource fixture에 timezone 변환을 추가하거나 환경 추정을 PASS로 표시하지 않았다.

최종 LFF: typecheck session2901/chcc04e5 exit0, scoped ESLint9파일 session11929/ch71f400 exit0(오류0/경고0), version검사 chd83a95 exit0(0.90.0/package-lock 일치), Markdown link chd394cd exit0(121파일), diff check ch7c0fa1 exit0. 검색 Unit9개 session92675/ch6e98e8 PASS(116ms)는 domain/search source 불변으로 재사용한다. 테스트 발견 ch8d000d exit0은 #453 관련6spec41case(이 중before전용1)를 확인한다. Next는 종료했고 next-env.d.ts/tsconfig.json baseline복원·생성diff0, 최종 source/fixture freeze drift0이다. 추가 #120 inactive1을 합친 after unique41 집계와 test discovery의 before1을 혼동하지 않는다.

### Issue #453 최신 main 정렬 뒤 최소 재검증

원격 게시 전 unpublished 후보를 latest main `56e2e54f88ab9124ec81c52e157161181ed6c337` 위로 정렬한 현재 head는 `b0eec204090cf5b897c3bf7e2e26978937b0f483`이다. before Resource source baseline `fd8fdc9e9207ab43a6fb7ff85b5a5acbe91d4553`은 역사적 정확 근거로 유지한다. Resource production2 및 관련 tests/fixture는 바이트 불변이며 main 운영4파일과 lock의 source-map-js1.2.2 변경을 제품 UI 변경으로 간주하지 않는다. 기존 after41 unique/57 PASS 실행 이력은 source 불변·관련 API/interaction 불변 근거로 재사용한다.

새 lock으로 `npm ci` session93526/ch797155 exit0을 실행했다(447개 설치/448개 audit,8s). 실제 결과는 high6이며 이전 high7과 구분한다. eslint9.39.5 deprecation은 유지됐고 자동 audit fix/의존성 파일 수정은 없다. 새 환경에서 typecheck14418/ch75caca 및 scoped ESLint9파일30542/ch4c8c62는 exit0(오류0/경고0), 검색 Unit9개 chc2f05f는 PASS134ms였다.

동일 Playwright 공통 명령에 `tests/e2e/resource-tabs.spec.ts --grep 'after 동일|dirty 확인·pending' --project=chromium --workers=1 --max-failures=1`을 실행했다. session45776/cha9e89d exit0,2 PASS8.6s(4.2s/2.2s), 새 실패0이다. after30 PNG/30geometry JSON/environment JSON1을 현재 통합 후보에 연결해 갱신했다. 환경은 en-US/Asia/Seoul/Chromium153.0.8010.12, 실제 capturedAt `2026-10-06T02:41:30.597Z`이다. before10은 그대로 재사용하고 before 환경 NOT RECORDED와 native125% NOT TESTED를 유지한다. 새2개는 기존 case의 재실행이므로 unique41은 그대로이며 누적 PASS 실행은59(기존57+2)다. 이는 전체41개 새 head 재실행 또는 원격 회귀 PASS가 아니다.

owned Next 프로세스 종료 후 이번 실행 전 저장한 next-env.d.ts/tsconfig.json을 복원했고 generated diff0 및 source/test/fixture10 hash drift0을 확인했다. 게시 후보는 기존 allowlist71개뿐이며 legacy #268/raw trace/report/DB/runtime log는 제외한다. 정렬 후 변경은 TEST_PLAN 재검증 기록과 after61 artifact뿐이고 production 수정은 없다. 원격 quality/e2e/docker·독립 QA는 새 head에서 별도 판정한다.

## Issue #454 물류 유형 행 밀도와 열·dialog LFF

baseline `c411634f75b7a69131a095e9cb6b7416060b827e`, branch `fix/issue-454-logistics-table-density`, infra 준비 version0.90.1이다. 설치 의존성은 #453 frozen npm ci 결과의 실제 node_modules 디렉터리를 복사했고 root version 외 dependency content가 같다. #454 fresh npm ci는 NOT TESTED이며 새 install이나 dependency 변경을 주장하지 않는다. 구현자는 native catalog source2 및 전용 fixture/spec·이 문서/PROJECT_UX만 변경했다. 기존 logistics-type-catalog-admin.spec.ts 두 case는 수정 없이 유지했다.

동일 seed는 각 설비/시스템3개: 짧은 AGV/agv·MCS/mcs, 긴 KO/EN name·64/62자 code, active/inactive 및 usage0/2/12345다. 추가 empty/state 시나리오에서 usage1도 별도 검증한다. before production bytes는 baseline 그대로이고 header는 준비된0.90.1이므로 application 전체 baseline bytes 동일은 아니다. before/after seed 의미는 같으며 전용 mock route는 after 요청/오류/deferred 제어로 보강했다. mock API+실제 Chromium 조작이며 실제 SQLite/서버 authorization PASS로 확대하지 않는다.

공통 명령은 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/planner/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome npx playwright test --config tests/config/playwright.config.ts <spec> --project=chromium --workers=1 --max-failures=1`이다. before는 `LOGISTICS_CAPTURE=before`, 전용 spec의 `--grep '#454 before'`를 사용했다. after 최초와4차는 기존 spec+전용 spec `--grep-invert '#454 before'`,2·3차는 전용 `--grep '#454 after'`,5차는 양 spec `--grep 'Issue #280|Issue #330|#454 after|pending 동기|loading·'`이다.

| 실행 | session/chunk | 결과·원인·조치 |
| --- | --- | --- |
| before 최초 | 75038/ea41b0 | exit0,1 PASS7.1s(3.7s),두 유형·두 dialog5폭;이후65자 fixture 오류 발견으로 최종 증거 교체 |
| after1 | 95915/17332b | exit1,1 FAIL/13 미실행;768px 마지막 action keyboard focus 외곽선819.890625가 owner744 밖. 390 geometry는 PASS |
| 준비 명령 | 1be5e4 | raw 보존 Python 경로 결합 TypeError. 수정 뒤 probe 적용 전 별도 shell 명령이 실행된 조작 오류. 제품 오류와 구분 |
| after2 | 5949/49c1bb | exit1,같은 미수정case1 FAIL1.7s. 준비 실패 때문에 불필요한 동일 재실행. 첫 오류 tool로그는 보존됐으나 첫 raw trace는 이 실행으로 교체되어 원본 없음; 두번째 재현 raw 별도 보존 |
| after3 poll probe | 93072/d2787a | exit1,1 FAIL6.7s,5초 뒤에도 clipping 지속. assertion timing 가설 배제,raw 보존 |
| 제품 보강 | 승인된 owned tableWrap focus capture | 필요한 horizontal delta만 보정,fixture/keyboard/assertion 완화 없음. source/fixture 수정 전 owned Next STOP/generated복원 |
| after4 | 55822/790698 | exit1,11 PASS/1 FAIL/2 미실행19.9s. geometry·양쪽 성공·pending·412/401/network PASS. empty case는 GET 후 mock만 변경한 하니스 설정 순서;GET 전 설정으로 수정,raw 보존 |
| after5 | 22413/a4c7c0 | exit0,6 PASS11.1s(geometry4.2s),하니스 실패1+미실행 기존2 및 geometry/pending2 보강 재검증 |

최초 after14 unique case PASS,17 PASS 실행(중복3)이었고,아래 valid64 geometry1 재검증 후 누적18 PASS 실행(중복4)이다. before unique1은2회 실행했다. 단일 최종14개 전체 실행이 아니다. source는 after4~5 동일하고 test 변경은 empty 값 설정 시점·focus 측정 JSON 통합·pending row geometry assertion 보강이다. 기존11 PASS 중 영향 없는 요청/오류 case8개는 source-identical 근거로 재사용하고 geometry·두 pending은 다시 실행했다. 첫 실패를 retry로 숨기지 않는다. 신규 pure domain/API algorithm 변경이 없어 별도 Unit 작성/실행은 N/A이며 request/count/state/geometry 핵심 계약을 실제 browser E2E로 검증한다. 서버 service/handler 전체 회귀는 exact PR head CI의 기존 tests가 담당한다.

직접 coverage는 양 catalog POST/code identity/name-onlyPATCH/active-onlyPATCH 및 If-Match7→8→9→10,usage 불변, passwordPUT 성공,종류/필터 GET/mutation0,0건/필터0/loading/GET실패/retry, mutation401 로그인 focus/password clear,412→GET200/500/401 원인·초안·새If-Match 수동 저장,network/불명 canonical 성공오판·자동retry0,두 dialog 동기submit2→요청1이다. pending5폭에서 disabled input/cancel/close·반복Escape5·Tab/ShiftTab·실제 포인터 취소·응답 후 trigger focus를 검증했고 기존 #280 password Escape/clear/실패logout 및 #330 필터/count/control non-overlap 보호를 유지했다.

두 유형5폭 모두 documentWidth=390/768/1024/1440/1920,table824/824/950/1366/1574px,표시명240/240/366/782/990px,짧은 행47px,td block padding3px,action margin0 및 control40px다. 같은 행 action top/height 차이≤1px,header/body 경계·모든 row button closest-td containment·text/code/count 실제 Range containment 및 기타 input/control containment를 실측했다. 390/768은 table-owned scroll이며 실제 Tab으로 마지막 action+6px outline을 보여준다. 큰 폭 pointer focus의 불필요한 horizontal jump0도 확인했다. 이름/password dialog5폭 정상·invalid-disabled·pending footer의 top/height 차이≤1px,초기focus/Escape/취소/Tab trap,390px 조회 오류 복구 action containment를 확인했다.

게시 allowlist는 `output/playwright/issue-454/before/` PNG20+JSON20 및 `after/` PNG14+JSON21(environment1 포함),총75개다. after catalog 두 탭5폭 screenshot과 geometry10,dialog5폭 geometry10·대표390/1440 screenshot4이다. keyboard focus 측정은 catalog JSON에 합쳐 중복 artifact를 줄였다. raw trace/errorcontext는 `/tmp/issue454-{second,third,fourth}-after-fail`에 보존만 하며 Git 제외다. DB/.data/.next-e2e/test-results/playwright-report/runtime log/다른Issue output/원래 #464 raw는 게시하지 않는다.

실제 before/after 환경은 각 JSON에 en-US·Asia/Seoul·Chromium153.0.8010.12 및 navigator userAgent를 기록했다. 최종 after environment capturedAt `2026-10-06T03:12:36.238Z`,default100% zoom이다. native125% browser chrome zoom은 headless 제어가 없어 NOT TESTED이며 DSF/CSSzoom/viewport로 대체하지 않았다. 실제기기/screenreader/서버authorization 전체/원격quality+e2e+docker/최종 수동UX/독립 QA는 별도 NOT TESTED이다.

최종 source/test/fixture freeze5 drift0·owned Next STOP·next-env.d.ts/tsconfig.json 정확 복원은 ched8d0e로 확인했다. source/API/DB/auth/domain/shared CSS/shared dialog/SVAR 변경은 N/A이며 PROJECT_UX/TEST_PLAN만 frontend 문서 범위다. Root Packet/PLAN/CHANGELOG와 infra package/lock는 별도 writer로 보존했다. 최종 type/lint/version/link/diff 및 모든 경로별 SHA는 frontend Result Contract/manifest로 반환한다.

### Issue #454 유효64자 fixture 최종 증거 교체

최종 점검에서 첫 전용 fixture의 설비 code가15+50=65자라는 길이 오류를 발견했다. API64자 상한 위반의 synthetic fixture 오류이며 제품 validator를 변경하지 않았다. 기존65자 before/after75개는 `/tmp/issue454-invalid65-evidence`에 보존만 하고 게시하지 않는다. Manager 승인으로 hyphen1자만 줄여64자로 만들고, STOP 뒤 최종 source2를 별도 byte/hash 백업→source2 정확c411 baseline 임시 복원→before 캡처→STOP/generated복원→검증된 최종source2 byte 동일 복원→after geometry만 캡처했다.

유효64 before 재캡처77830/ch20c364 exit0,1 PASS6.6s(3.9s). after geometry31896/ch48c975 exit0,1 PASS7.4s(4.7s),실패0이다. 최종75 artifact는 같은 유효dataset으로 모두 교체됐고 환경/numeric actual metric/control pair 비중첩·세로/가로 focus 외곽선도 JSON에 명시했다. 사용 건수 header/cell computed text-align right와 font-variant-numeric tabular-nums를 실측했다. 최종 before 짧은 행 수치는390/768224.96875,1024140.96875,1440/1920100.96875px로 같고 after5폭47px이다.

마지막 ch7213f4는 source/test/fixture5 drift0,최종source2 백업byte 동일,owned Next STOP/generated2 정확 복원을 확인했다. 기존 CRUD/오류/pending/두 기존 case는 짧은 code에 대한 검증이며 제품 source도 동일하므로 재사용한다. 고유 after14개는 유지하고 PASS 실행은18회로 구분하며 전체14를 다시 실행하지 않았다. 게시 allowlist75개는 그대로이고 native125%·실기기·screenreader·serverauthorization 전체·remoteCI·독립 QA 미검증 경계도 유지한다.

## Issue #455 — 프로젝트 기준정보 제어 밀도 Local Fast Feedback

전용 `tests/fixtures/project-master-455.ts`는 세 범주 각각 짧은 used 행, 이름200자/code64자/정렬1000000/사용 수12345의 긴 행, inactive 행, unused0 행을 만든다. UUID와 API 길이/정렬 상한을 fixture 생성 시 검증한다. 같은 최종 12행 dataset으로 before/after를 비교하며 mock API UI 검증을 실제 SQLite authorization 검증으로 확대하지 않는다.

첫 before 76506/ch43c7c1 exit0(1 PASS,6.7초)는 초기 9행 fixture였다. 제품 수정 전 승인된 상한/unused0 보강 후 최종 before 51732/chd846d4 exit0(1 PASS,6.7초)를 다시 확보했다. 최종 게시 비교에는 12행 before만 사용한다. before production source는 baseline04b3047328bb338bace1990e18a434ae80b611db이며 header의0.90.2는 infra 준비값이다. 짧은 정상 행57px, 입력 border0px/transparent/padding0px/min-height auto를 실제 측정했다. #452의 전역 margin0는 이미 적용되어 있으므로 이번 변경을 button margin 제거라고 해석하지 않는다.

전용 spec은 세 범주×390/768/1024/1440/1920의 표/행/header-body/첫 행 경계, 정상/focus/disabled computed input style, control containment·비중첩, native Tab의 마지막 작업 접근, password dialog 초기/복원 focus를 확인한다. 기존 project-master-admin.spec.ts의7개 #289/#332 범주/필터/의미 구조/반응형 보호는 새 제목 selector만 이관한다. 추가 request/state 검증은 범주/필터 초안·생성 target, POST/명시 PATCH/active/password, used code 이유, 실제 필드 오류,0/1/filter0, GET 오류 복구, 동기 중복 submit/pending 반복 Escape, mutation401/403/412 및 복구 GET500/401/network/불명 canonical을 다룬다. 실패 요청을 자동 재전송하지 않는 counter를 유지한다.

첫 after 55446/chab1a09 exit1: 390px 표/입력/행/Tab geometry 통과 후 password 초기 focus FAIL(1 FAIL,18 미실행). React autoFocus만으로 native showModal 이후 focus가 보장되지 않은 제품 UI 오류다. 원본 trace/error context는 `/tmp/issue455-after-firstfail-1`에 보존하고 게시 대상에서 제외했다. owned form의 명시 초기 focus를 연결해 재검증한다.

모든 server 실행 중 production/fixture/test는 동결하고 종료 후 owned Next STOP, next-env.d.ts/tsconfig.json 정확 백업 복원 및 hash 불변을 확인한다. 기존 canonical 재적용 시 다른 dirty 행 덮임은 DEFER이며 이 검증으로 전체 저장 동작의 초안 보존을 주장하지 않는다. 실제125% browser zoom은 headless native UI로 실행할 수 없어 NOT TESTED이며 DSF/CSS zoom으로 대체하지 않는다. 실기기/screen reader, 전체 서버 authorization/원격 quality·e2e·docker, 독립 QA는 별도 근거가 없으므로 NOT TESTED다. API/DB/auth/domain/공유 CSS/Next·SVAR 엔진 계약 문서는 변경 없는 로컬 UI 범위로 N/A다.

### Issue #455 최종 후보 및 실행 이력

| 실행 | 실제 명령 범위 / handle·chunk | 결과 |
| --- | --- | --- |
| before 초기 | `MASTER_CAPTURE=before npx playwright test --config tests/config/playwright.config.ts tests/e2e/master-controls-density.spec.ts --project=chromium --workers=1 --max-failures=1 --grep '#455 before'` ·76506/43c7c1 | exit0,1 PASS6.7초; 초기9행, 최종 비교에서 제외 |
| before 최종 | 동일 명령·51732/d846d4 | exit0,1 PASS6.7초; 유효12행 dataset |
| after1 | 전용 spec+기존 spec,`--grep-invert '#455 before'` ·55446/ab1a09 | exit1,초기 focus1 FAIL/18 미실행 |
| after2 | 같은19개·40983/1beb06 | exit1,owned effect 보강 뒤 동일 초기 focus1 FAIL/18 미실행 |
| after3 | native autofocus ref 적용 뒤 같은19개·34563/44bd01 | exit1,2 PASS/1 FAIL/16 미실행; Next route announcer까지 선택한 alert strict selector 하니스 오류 |
| after4 | 같은 두 spec,`--grep-invert '#455 before\|#455 after 세 범주'` ·87943/1b8046 | exit0,18 PASS15.1초; alert는 main 영역으로 한정, 생성/행 draft 검사도 최종 보강 |
| after5 | 전용 spec,`--grep '#455 after 세 범주\|#455 실제 필드'` ·13519/99c70b | exit0,2 PASS7.3초; top≤1px와 실제 오류 computed 색상, loading 상태 좁은 재검증 |

모든 browser 명령은 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/planner/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`, workers1/max-failures1을 사용한다. 고유 after case는19개(기존7+전용12), PASS 실행은22회(2+18+2)이며 중복3회를 포함한다. 단일19개 전체 PASS 실행이라고 쓰지 않는다. 제품 source는 after3 이후 변경 없고 after4/5는 owned test selector 및 인수 기준 측정 보강만 적용했으므로 영향 없는 PASS를 재사용한다. 마지막 e54c15에서 source/test/fixture5 drift0·owned Next STOP·generated2 백업 정확 복원을 확인했다.

최종 evidence는 before28개(7PNG/21JSON)와 after32개(9PNG/23JSON), 총60개다. geometry는 세 범주15개 normal/focused 및 password5폭을 포함하고, PNG는 사업부5폭/password390·1440/error·saving 대표 상태만이다. 정상 짧은 행은 모든 폭47px, 입력/버튼40px, cell 상하3px, header/body 및 동급 control top 차이≤1px, first-row header gap0px, document width=viewport다. table width는390/768/1024에서960px,1440에서1344px,1920에서1552px이며 wide는 shell의 가용 작업면을 기준으로 한다. before의 입력 borderWidth0px shorthand는 네 면이 동일한 CSSOM 실측값이며 after는 borderSides 네 면1px도 명시했다. 정상 표면 rgb(255,255,255), padding8px/min-height40px/14px·20px/box-sizing border-box, focus3px outline, disabled 표면·used 이유, 실제 invalid input과 오류 설명의 computed 색 일치를 확인했다.

실측 환경은 en-US/Asia-Seoul(실제 값 `Asia/Seoul`)/Chromium153.0.8010.12, 기본100%이며 before/after environment JSON에 기록했다. fresh npm ci는 실행하지 않았고 infra가 #454의 동일 dependency 실제 디렉터리를 복사한 환경이다. 별도 pure domain 알고리즘 추가가 없으므로 신규 Unit N/A이며 동기 guard는 실제 browser request counter로 검증했다. typecheck/scoped lint/version/Markdown link/diff의 마지막 실행은 frontend Result Contract에 연결한다. 원본 실패 trace·runtime DB·report·log 및 다른 Issue 출력은 게시 allowlist에서 제외한다.

## Issue #475 Generic Finalizer closed-Issue backlog 회귀

- 재현 순서는 `FINAL #452@f8f...` → 미완료 `#461@fd8...` → 이미 closed인 #452를 다시 참조한 후속 merge `#474@56e...`다.
- 최신 merge의 Issue가 closed이지만 그 exact target SHA에 FINAL marker가 없으면 해당 merge 자체는 lifecycle mutation 대상에서 제외한다.
- 이 closed/no-marker merge는 수집 단계에서 non-actionable ordering barrier로 유지하여 same-Issue retry adjacency를 끊고, coalesce 이후에만 lifecycle target에서 필터링한다.
- barrier를 이유로 first-parent 탐색을 종료하지 않고 더 오래된 merge를 계속 조회하여 #461 같은 pending target을 발견해야 한다.
- 더 과거의 exact FINAL marker를 만나면 기존처럼 강한 boundary로 탐색을 종료한다.
- closed/no-marker merge에 대해 Issue reopen, release/finalize, branch cleanup을 수행하지 않는다.
- 동일 Issue의 pending retry 두 개 사이에 closed/no-marker merge가 있으면 두 retry를 coalesce하지 않고 각각의 first-parent/version 범위를 유지한다.
- `MAX_BACKLOG_DEPTH` 안에서 exact FINAL/non-PR historical boundary를 찾지 못하는 기존 fail-closed 계약은 유지한다.
- 정적/시나리오 검증은 `scripts/verify-issue-lifecycle.py`에서 closed skip classifier, exact FINAL boundary, pending backlog 보존을 함께 확인한다.

### Issue #475 Finalizer tag push Authorization corrective

- PR #476 병합 후 Main CI #1906.1은 SUCCESS였고 Generic Finalizer #64.1이 pending #461/v0.86.0을 정확히 발견했다.
- Finalizer #64.1은 `git push origin refs/tags/v0.86.0`에서 GitHub 응답 `Duplicate header: "Authorization"` / HTTP 400으로 실패했다.
- 원인은 Generic Finalizer checkout이 기본 credential persistence를 유지한 상태에서 `push_git_refs()`가 별도 `http.extraHeader` Authorization을 추가해 동일 header가 두 번 전송된 것이다.
- 자동 Finalizer와 수동 release/finalize/release_finalize checkout은 모두 `persist-credentials:false`를 사용해야 한다.
- lifecycle의 release tag `ls-remote`·`fetch`·`push`와 automatic finalizer의 exact tag evidence `ls-remote`·`fetch`는 동일한 process-scoped auth helper를 사용해야 한다.
- helper는 inherited `http.https://github.com/.extraheader`를 빈 값으로 reset한 뒤 job-scoped Authorization header 하나를 command-scope Git config로 넣어야 한다.
- 회귀 검증은 process-scoped config count/order, empty reset header, 단일 auth header, command argument token 비노출, lifecycle tag read/fetch/push와 automatic finalizer tag evidence read/fetch가 모두 authenticated helper를 경유하는지, mutation workflow의 non-persistent checkout을 확인한다.
- 기존 immutable tag가 생성되기 전에 push가 실패했으므로 v0.86.0 tag/release 중복 evidence를 만들지 않아야 한다. corrective merge 후 Generic Finalizer가 backlog를 재계산해 #461 release_start를 재시도한다.

## Issue #461 v0.86.0 GHCR Release static quality corrective

- Release Run #136.1 (`37412901512`)은 SemVer 검증과 Chromium E2E 6/6, Vitest 126 files / 1177 tests를 PASS했으나 `Release static quality`의 `npm audit --omit=dev`에서 `source-map-js 1.2.1` High 취약점으로 FAIL했다. 이에 따라 quality aggregate가 FAIL하고 Main verified digest 재검증·promotion·handoff는 SKIPPED였다.
- 같은 job에서 audit 실패 뒤 production build 시작 step이 SKIPPED됐는데 `Release production build 시간 기록`이 `if: always()`로 실행되어 빈 `started_ms`를 recorder에 전달한 2차 실패도 관측했다. 이 오류는 최초 audit failure를 대체하지 않으며 corrective에서 함께 제거한다.
- 현재 latest main은 #462 병합 이후 application `0.87.0`이며 `package-lock.json`의 `source-map-js`는 `1.2.2`다. 따라서 실패한 immutable `v0.86.0`을 재사용하지 않고 #461 same-Issue corrective PATCH `0.87.1`로 진행한다.
- 정적 회귀는 `tests/scripts/test-config-layout.test.ts`에서 `source-map-js >= 1.2.2`와 Release build 종료 계측의 `steps.release-build-start.outputs.started_ms != ''` guard를 확인한다. audit 자체는 PR/Main/Release의 실제 `npm audit` gate가 계속 authoritative하다.
- corrective PR의 공식 판정은 exact head의 PR quality/e2e/docker 결과다. 이번 요청 범위는 새 PR CI 시작 확인까지이며 merge/Main CI/tag/GHCR/branch cleanup/Issue close는 수행하지 않는다. 새 `0.87.1` release는 별도 명시 승인 전 `release_authorized=false`다.


## Issue #463 PR CI Run #1869 실패 재정렬·보완

- PR #472 head `ca15145b1167b7253841e648d23e59d1a172022a`의 PR CI Run #1869.1(`37382878627`)은 Vitest/ESLint/TypeScript/정책 검사는 PASS했으나 production build, Docker build, Chromium E2E shard 4/5/6이 FAIL했다.
- production build의 직접 원인은 `project-milestone-dashboard.module.css`의 전역-only `:global(.project-schedule-peer-tabs)` selector가 CSS Module pure 규칙을 위반한 것이다. Docker 실패는 같은 `npm run build` 오류의 연쇄 결과다. peer workspace 전역 layout selector는 `src/app/globals.css`로 이동하고 Milestone module은 local selector만 소유한다.
- 최초 #463 branch는 #462의 중간 head를 선행으로 사용했다. E2E 실패의 기존 Context Menu/Editor/Relation/scoped-add 경로는 기대를 완화하지 않고 latest main에 병합된 #461/#462 보완을 source of truth로 유지한 뒤 #463 delta만 재적용한다.
- 재정렬 후보는 latest main `d7316880732ecde5a8193764ac3b0cfca2ae455f` / application `0.87.1`을 포함하고 #463 candidate를 `0.88.0`으로 유지한다. #461 corrective의 `source-map-js 1.2.2` 및 Release 계측 guard를 되돌리지 않는다.
- 새 exact-head PR CI의 quality/e2e/docker는 등록 전까지 NOT TESTED이며 기존 Run #1869의 PASS를 새 head 증거로 전용하지 않는다.


## Issue #463 PR CI Run #1927 E2E geometry REWORK

- 재정렬 head `caa520bac3a0bb2d97e61e725e513280fffa5dc0`의 PR CI Run #1927.1(`37418422688`)에서 production build, Docker, Vitest, ESLint, TypeScript, 정책 검사는 모두 PASS했고 Chromium E2E shard 1~5도 PASS했다. shard 6의 기존 `Issue #407/#418 keeps scoped Header and Row additions canonical and continuous` 1건만 FAIL했다.
- 실패 지점은 여러 scoped row를 추가한 뒤 이전에 만든 `headerLeaf`를 taskId로 우클릭하는 단계다. #463의 peer tab이 일정 작업면의 세로 공간을 사용하면서 해당 행이 viewport 밖으로 이동했고, Playwright의 `locator.click({ button: "right" })`가 auto-scroll과 우클릭을 한 gesture로 결합하는 동안 SVAR virtual row가 교체되어 `contextmenu`가 생성되지 않았다. 서버 mutation, row persistence, Gantt instance/api instance, 이전 scoped-add assertion은 실패 지점 전까지 PASS했다.
- 이는 과거 #407/#384에서 기록한 virtualized-row/Playwright auto-scroll 경계와 같은 테스트 기하학 유형이다. 제품의 Context Menu guard나 권한/범위 계약을 완화하지 않는다. 해당 E2E helper가 target row를 먼저 `scrollIntoViewIfNeeded()`로 가시화하고 한 animation frame 안정화한 뒤 실제 우클릭을 수행하도록 보강한다. 메뉴 가시성 assertion은 그대로 유지한다.
- 새 head의 전체 PR quality/e2e/docker가 authoritative하며 Run #1927 PASS 결과를 새 head 증거로 전용하지 않는다.


### Issue #453 PR #477 최신 main 재정렬 및 새 PR CI 기준

PR #477의 최초 head `c411634f75b7a69131a095e9cb6b7416060b827e`는 PR CI Run `37406441919` / Run #1898.1에서 quality·E2E·Docker를 포함해 SUCCESS였다. 이후 main이 `d7316880732ecde5a8193764ac3b0cfca2ae455f` / application `0.87.1`까지 전진해 기존 head가 39 commits behind, GitHub `mergeable_state=dirty`가 되었으므로 그 성공을 현재 main 통합 후보의 공식 PASS로 재사용하지 않는다.

충돌 교집합은 CHANGELOG, PROJECT_UX, TEST_PLAN, UI_UX_GUIDELINES, active PLAN, package.json, package-lock.json 7파일이다. Resource production TSX/CSS와 #453 관련 E2E/fixture는 main 이동에서 변경되지 않았으므로 기존 #453 내용을 그대로 보존하고, 문서 5개는 main의 후속 기록과 #453 내용을 병합한다. package/lock은 main의 dependency·lock 변경을 보존하면서 application candidate `0.90.0`을 유지한다.

branch 정렬은 published PR history를 강제 재작성하지 않고 기존 feature head와 최신 main을 부모로 하는 conflict-resolution merge commit으로 수행한다. 새 exact head의 pull_request CI가 quality·E2E·Docker를 다시 통과하기 전 최종 ACCEPT는 `NOT TESTED`다.


## Issue #483 Resume 후속 Release dispatch 권한 회귀

- 재현: Issue #462 `v0.87.0` Release Run #137.1 성공 후 Resume Run #3.1 (`37419245205`)이 #462를 finalize하고 #461 corrective `v0.87.1` annotated tag까지 생성했지만, 다음 `release-image.yml` workflow_dispatch에서 HTTP 403 `Resource not accessible by integration`으로 실패했다.
- 원인: `release-finalizer-resume.yml`의 workflow permission이 `actions: read`여서 trusted main resolver가 다음 Release workflow를 dispatch할 수 없었다.
- 정적 contract: `scripts/verify-issue-lifecycle.py`는 automatic Generic Finalizer와 Release Completion Resume 양쪽에 `actions: write`가 있는지 검사한다.
- 보안 경계: Resume는 계속 trusted `main` checkout, source Release exact run ID/path/head SHA/success 검증, shared concurrency group을 유지한다. 다른 권한과 제품 source/API/DB/UI는 변경하지 않는다.
- 복구 판정: corrective PR exact head의 policy/typecheck/lint/unit/build/E2E/Docker PASS를 공식 PR gate로 사용한다. 병합 후 기존 `v0.87.1` tag를 authority로 Release dispatch를 재개하며 새 tag/version을 만들지 않는다.


## Issue #463 PR CI Run #1929 Context Menu target REWORK

- head `9b4e1d4680be581a0d91d5f23ac0d59cd778083f`의 PR CI Run #1929.1(`37424880340`)은 quality/build/Docker와 Chromium shard 1~5 PASS, shard 6의 동일 #407/#418 Context Menu 시나리오 1건 FAIL이다.
- 이전 pre-scroll 보강 뒤에도 동일 위치에서 실패했으므로 auto-scroll 단독 원인 가설은 폐기한다. 제품 `resolveTaskContextTarget`은 button/`[data-action="add-task"]` 등 앱 소유 control 우클릭을 의도적으로 제외하며, row-center 우클릭은 viewport/column geometry에 따라 해당 hit area에 걸릴 수 있다.
- E2E helper는 taskId 행의 canonical 작업명 hit area `[data-col-id=":text"] .wx-content > .wx-text`를 직접 가시화한 뒤 실제 right-click한다. 제품 Context Menu guard·권한·scope 계약과 메뉴 가시성 assertion은 변경하지 않는다.
- latest main `22326fc350b91ab59ddafa20ef97c3f418f71aae` / application `0.90.0`의 #453 리소스 UI/문서 변경을 보존하고 #463 candidate를 다음 MINOR `0.91.0`로 재정렬한다.
- 새 exact-head 전체 PR CI가 authoritative이며 이전 run의 부분 PASS를 새 head 증거로 전용하지 않는다.


## Issue #463 PR CI Run #1937 Core selection scroll REWORK

- head `b1ff0294195436b806e4b76929cd8bc269ec55bb`의 PR CI Run #1937.1(`37427125874`)은 quality/build/Docker와 Chromium shard 1~5를 PASS했으나 shard 6의 기존 #407/#418 Context Menu 시나리오 1건만 FAIL했다.
- Run #1937 Playwright trace를 직접 분석했다. 실패 우클릭은 canonical 작업명 text에 정확히 입력됐고 해당 taskId 행이 app-owned `data-copy-selected=true` / `aria-selected=true`로 전환됐다. 그러나 직후 SVAR Core selection/layout 동기화가 Grid table `scrollTop 147 → 124`와 chart resize를 발생시켰고, 기존 Task Menu scroll guard가 이 내부 보정을 메뉴 이후 실제 viewport 이동으로 판정하여 메뉴를 즉시 닫았다.
- 따라서 이전 auto-scroll 및 hit-area 가설은 최종 원인이 아니다. Task Context Menu에서 선택 밖 행을 singleton으로 만드는 계약의 authority는 #384부터 app-owned selection이다. Context Menu open 경로에서는 `applySelectionGesture(..., false)`로 Core `select-task` mirror만 생략하고 `data-copy-selected` singleton selection·menu taskId·명령 dispatch는 유지한다.
- 일반 click/keyboard selection의 Core mirror, 실제 사용자 scroll 시 메뉴 닫힘, 지연된 동일 scroll 알림 무시는 기존 계약을 유지한다. #407/#418 E2E는 메뉴 open 뒤 해당 행의 `data-copy-selected=true`를 추가 확인한다.
- 새 exact-head 전체 PR CI의 quality/e2e/docker가 authoritative하며 Run #1937의 부분 PASS를 새 head의 PASS로 전용하지 않는다.


## Issue #463 PR CI Run #1938 opening-layout scroll REWORK

- head `b711280b0629b7af6b579dcc831f54bd09897a92`의 PR CI Run #1938.1(`37429658024`)도 quality/build/Docker와 Chromium shard 1~5 PASS, shard 6의 기존 #407/#418 Context Menu 1건만 FAIL했다.
- 새 trace에서 Core `select-task` mirror를 제거한 상태에서도 작업명 우클릭 후 app-owned `data-copy-selected=true`가 반영되고 Grid table `scrollTop 147 → 124` 보정이 동일하게 발생했다. 따라서 Run #1937의 "Core mirror가 직접 원인" 가설은 반증됐고 해당 의미 변경은 되돌린다.
- 최종 원인은 Context Menu open 직후 app-owned selection + React/SVAR virtual-row layout settle 자체가 내부 scroll을 만들 수 있는데, 기존 menu scroll baseline을 settle 전에 캡처했다는 점이다. 메뉴 open 시 scroll guard를 bounded two animation frames 동안 settling 상태로 두고, 이 구간의 내부 scroll마다 현재 canonical task element에서 baseline을 재캡처한 뒤 settle 종료 시 최종 위치를 기준으로 arm한다. 임의 timeout/retry는 사용하지 않는다.
- 일반 selection의 Core mirror는 복원한다. 기존 `task-context-menu-scroll.spec.ts`는 같은 위치의 지연 scroll은 무시하고 bounded settle 이후 실제 scroll은 메뉴를 닫는 계약을 명시적으로 유지한다. #407/#418의 app-owned selection assertion도 유지한다.
- 새 exact-head 전체 PR CI의 quality/e2e/docker가 authoritative하며 이전 run의 부분 PASS를 새 head 증거로 전용하지 않는다.


## Issue #463 PR CI Run #1941 dual corrective

- head `703807d600c1499092b0144732669fbe54465ca6`의 PR CI Run #1941.1(`37431883032`)은 quality/build/Docker와 Chromium shard 2~5 PASS였고, shard 1의 dashboard cache/abort 1건과 shard 6의 전용 Context Menu scroll 1건이 FAIL했다.
- shard 6에서 기존 #407/#418 시나리오는 더 이상 실패하지 않아 opening-settle 보완은 해당 회귀를 해소했다. 새 실패는 Chart bar에서 연 메뉴의 settle 재캡처가 taskId fallback으로 Grid row를 먼저 찾아 Chart scroll owner를 잃은 회귀다. 연결된 원래 trigger가 있으면 그 요소를 계속 사용하고, 교체됐을 때만 원래 surface(grid/chart)를 보존한 taskId fallback을 사용한다.
- shard 1은 slow query를 abort하고 직전 cached query로 되돌릴 때 network I/O가 없는 cache hit임에도 ready 복원이 effect 내부 microtask 뒤로 밀려 CI 부하에서 loading 상태가 남았다. cache hit는 effect 진입 즉시 `ready`로 복원하고 actual fetch만 async 경로로 유지한다. 기존 focus TTL catch-up·catalog/revision 검증은 유지한다.
- latest main `0fc986cb0cb642bdbedeec30157b27bd522b5a38` / application `0.90.1`의 #454 UI/문서 변경을 보존하며 candidate `0.91.0`을 유지한다. 새 exact-head 전체 PR CI가 authoritative다.


## Issue #463 PR CI Run #1946 picker keyboard visibility REWORK

- head `8f78a24d6e2d37e6c0a9da7ec1f79e2025a55a66`의 PR CI Run #1946.1(`37434077594`)은 quality/build/Docker와 Chromium shard 2~6 PASS, shard 1의 `#463 readonly full-state/F separation, keyboard and five-width geometry` 1건만 FAIL했다. 이전 Context Menu scroll 및 dashboard cache/abort 회귀는 이 run에서 PASS했다.
- 실패는 390px 단계 picker에서 `End` 키 입력 직후 active option의 `scrollIntoView`를 requestAnimationFrame으로 지연해, CI에서 geometry 측정이 먼저 실행될 수 있는 timing race다. popup bounds는 viewport 안에 있었고 실패 assertion은 input focus/visibility/active option visibility 묶음이었다.
- 열린 list의 keyboard target DOM은 이미 존재하므로 `move()`에서 active state와 동시에 해당 option에 synchronous `scrollIntoView({block:"nearest"})`를 적용한다. focus·aria-activedescendant·Escape 복귀·popup fit 계약은 유지하며 임의 timeout은 추가하지 않는다.
- latest main `528ebfffa639a275ea4349a04860f5b3785e50e9` / application `0.90.2`의 #455 UI/문서 변경을 보존하고 #463 candidate `0.91.0`을 유지한다. 새 exact-head 전체 PR CI가 authoritative다.

### Issue #455 Main CI #1947.1 transport hostname corrective

Main CI Run `37435545662` / #1947.1은 build/typecheck/lint/Vitest/Docker smoke/E2E 6 shards와 게시 image policy/readiness/SQLite/API persistence까지 SUCCESS였으나, 게시 digest transport 검증의 production-http 첫 Chromium navigation에서 `ERR_NAME_NOT_RESOLVED`가 발생해 실패했다. 같은 script의 `/etc/hosts` 등록 뒤 HTTP/HTTPS readiness curl은 성공했으므로 application/image failure가 아니라 hosted runner Chromium의 test hostname resolution 실패로 분리한다.

Corrective는 `tests/config/transport.config.ts`의 Chromium launch option에 `plain.gantt.test`와 `secure.gantt.test`만 127.0.0.1로 매핑한다. browser URL/Host header와 HTTPS certificate hostname은 계속 원래 test domain을 사용하므로 Origin/cookie/TLS 의미를 localhost 예외로 바꾸지 않는다. shell/Node 측 `/etc/hosts`, NO_PROXY, 실제 Nginx와 신뢰 CA 검증도 유지한다. 최종 authoritative 판정은 corrective 병합 후 새 Main CI의 동일 published-digest transport smoke다.


### Issue #463 PR #472 unresolved review P2 — combined S scope

- PR review는 물류 조건을 만족하는 member와 Resource 조건을 만족하는 다른 member가 있을 때 기존 독립 existential 판정이 stage를 S에 포함할 수 있음을 지적했다.
- S의 물류+Resource 관련성은 기간을 제외한 동일 일반 Task 교집합으로 판정한다. 날짜는 기존 계약대로 F-only다. Resource 조건이 없으면 Milestone 자체의 직접 물류 match는 계속 S에 포함한다.
- Unit 회귀는 t1=물류 only, t2=Resource only일 때 rows/KPI가 empty이고, t2에도 같은 물류 연결을 추가하면 m1/scopedTaskIds=t2가 복원되는지 검증한다.
- 이 보완 후 exact-head PR CI를 다시 실행하며 이전 #1952 PASS는 수정 전 head 증거로만 유지한다.

## Issue #464 Local Fast Feedback와 보존/교환 검증

이 기록은 현재 feature0.89.0의 관련 로컬 증거이며 전체 suite/독립 최종 QA/PR quality/e2e/docker가 아니다. 원격 미실행/진행 중은 NOT TESTED, 운영 HTTP/TLS proxy·Windows Excel/VBA/DRM과 main/GHCR/release는 별도 범위다. source/문서/테스트 소유권은 Work Packet에 따르며 version/Git/PR/Issue 진행은 Manager/infra가 담당한다.

교환 담당의 `npx vitest run --config tests/config/vitest.config.ts tests/contracts/import.test.ts tests/contracts/import11.test.ts tests/server/imports/project-import-parser.test.ts tests/server/imports/project-import-service.test.ts tests/server/projects/edit-authorization-handlers.test.ts`는5 files/96 tests PASS(che9d797,1.26s)였다. 기존1.0 pure semantic/result·1.1 strict fields/derived 거부·status/baseline/Summary/forward membership/empty, UTF-8 fatal/한 BOM/decoded duplicate key/depth64/byte5 MiB/Content-Length+actual stream/multipart duplicate·unknown part, actual SQLite preview/commit201 permission edit·newUUID/advisory source·target Calendar·collision/budget/완료 full E/P/mixed 전체 거부/digest+권한+revision/trigger rollback/persistence 및 JSON readonly full export를 확인한다. Route security inventory는 실제 모든 route/method source와 exact policy를 비교하고 JSON export origin-if-match-read를 추가했다.

작성 중 첫 typecheck는 Import201의 permission literal widening1건과 frontend calendar weekendDays fixture1건으로 FAIL이었다. own literal은 edit as const로 수정했고 frontend가 fixture를 수정했다. 후속 새1.1 contract test의 cast/it.each tuple2 오류를 test input object shape로 수정했다. source freeze 시 전체 tsc는 own 오류0이나 actual 신규 spec createdTaskIds 오류1로 exit2(ch8bc539)였다. 해당 파일은 actual 담당 소유이며 후속 global typecheck 판정과 구분한다. Exchange source/test/route/기존 Stagegates E2E scoped ESLint는 exit0(ch626367)였다. 초기 test unused destructuring4 warning은 명시 Link field projection으로 정리했다.

최초 parser/contract 관련3 files/51 tests는 PASS(ch892d05,273ms)였다. 첫 SQLite/HTTP+inventory2 files/41 tests는34 PASS/7 FAIL(chbf2b46,1.03s)이었다. 실제 source 결함1건은 canonical source Calendar가 같은 NON_WORKING 날짜를 holidays와 exceptions에 함께 투영하여 preview 복원에서 DUPLICATE_CALENDAR_EXCEPTION을 발생시킨 것이었다. exceptions property가 있으면 해당 authority를 사용하고 holidays는 legacy-only fallback으로 수정하여 target Calendar/Scheduling 알고리즘은 유지했다. 나머지6건은 한국10/09 휴일을 근무일 baseline 시작으로 사용한3개 fixture, stageGate.memberProgressPercent를 memberProgress로 잘못 기대한1개, edit_sessions 실제 테이블명 대신 project_edit_sessions를 쓴1개, inventory 순서1개 oracle였다. 후속40 PASS/1 FAIL(ch196228)은 Link 비교 양쪽의 legacyMixed:false 처리 불일치 oracle였고 양쪽 canonical endpoint/type/lag projection 동등 비교로 수정했다.3 files/58 tests PASS(ch11b32d,1.02s) 후 budget/1.0 normalization/UUID collision/HTTP bounded parsing을 추가해96개 PASS를 확보했다. Vite native configLoader future 경고는 유지한다.

문서 producer 예제2개를 추가하여 `tests/contracts/import11.test.ts`만19/19 PASS(chc68f8c,258ms)로 검증했다. 이 결과는 이전17개에2개 추가한 범위이며 관련 unique98개다. Machine schema1.0은 byte 불변이고 새1.1 schema/example과 server field 계약을 별도로 비교한다. JSON syntax depth64와 WBS MAX_HIERARCHY_DEPTH64는 서로 다른 조건이다. CSV parser/production VBA producer 확장 및 실제 Windows 실행은 N/A/NOT TESTED이며 sourceTaskId/sourceCalendar가 새 FK/target authority를 대신하지 않음을 SQLite에서 확인했다.

보존 담당의 관련11 files는151 PASS(chf0e814,2.06s) 후 회귀2개를 추가했다. 최종 source의153개 실행은152 PASS/1 fixture oracle FAIL(ch75cbb6,2.07s)이었고 completed M에 progress0을 쓰면 기존 정책의 in_progress0으로 재개되는 것을 not_started로 잘못 기대한 것이었다. 원본 beforeSnapshot의 실제 status와 복사본 동등성을 비교하도록 oracle만 수정한 뒤 해당 Copy21/21 PASS(chd7a5d5,1.62s)였다. 이어 source4998+C2=5000 허용/overlap dedup와4999+C2=5001 거부·원본 불변을2개 추가해 helper23+기존 server budget/foreign4042=25 PASS(ch30c70a,588ms,18 무관 skip)였다. 기존153+새2의 unique155 관련 coverage이며 단일155 전체 PASS 실행으로 표현하지 않는다. source500/Project5000 상한을 shared UI helper도 preflight하고 서버의 cheap source404 resolve→budget→Assignment→full membership plan 순서를 유지한다.

보존 최초 실패도 유지한다. pure 계획20개 중2 FAIL(ch662e31)은 inherited-only empty Summary의 full E/explicit row 변화0인데 완료 destination 구조 잠금을 기대한 oracle와 child anchor 전후 nearest Summary 동일인데 변화로 기대한 oracle였다. source 불변으로 fixture를 수정했다. Copy20개 중4 FAIL(cha27b6f)은 완료 상속 아래 후속 Task 생성, 전체 DB를 source 불변으로 비교, Milestone 선행 완료 순서 등 fixture 오류였다. Template12개 중1 FAIL(chcc4b6c)은 실제 validSession revokedAt 미검사 결함이어서 source를 보강했고 wrong-public-id/wrong-project-id/expired/authVersion4개를 추가해16 PASS였다. 확대119개 중1 FAIL(chf179eb)은 actual unknown/foreign Copy404가 helper409로 바뀐 회귀였고 source resolve 순서를 복구하여 기존 test 기대를 유지했다. Source status/Calendar/Dependency 알고리즘을 바꾸지 않았다. Copy ack는 외부 explicit/상속/destination 의미 변화만 확인하며 Completed full E/P·모든 explicit source·incident endpoint 보존과 Assignment/권한 잠금을 우회하지 않는다.

Excel 담당의 관련6 files/27 tests는 PASS(chec147f,1.60s)다. 신규 `tests/server/projects/project-excel-stage.test.ts`10개는 native SQLite 병렬3M join/중첩 Summary override/Group 참조·null allocation/raw M/D·M/M/행별 IDs, missing·foreign·stale Stage DTO/HTTP200403400404412413500/source 불변을 확인한다. 기존5개 관련 회귀 파일도 포함한다. 같은 SQLite read transaction/clock1회 canonical/default Stage/optionalResource 및 Project/Catalog revision을 확인하고 current Dashboard filter와 다른 full default F를 workbook에 명시한다. 수천 UUID는 한 개씩 ID detail 행으로 기록하며 text32767/Stage50000행 상한 초과는 전체 거부한다. Excel4번째 Stage DTO를 완성한 뒤 보존 담당의 milestone-stage-service.test.ts 성공/missing/mismatch 회귀 결과는 후속 handoff로 기록한다.

기존 `tests/e2e/milestone-stage-gates.spec.ts`는 no-loss Excel409 임시 기대를 실제 workbook200/압축 OOXML의 source S/M/T UUID 보존, JSON1.1 explicit membership/완료 status, commit preview digest 누락428 및 invalid preview422로 갱신했다. 실제 browser는 source freeze와 공유 서버 직렬 승인 뒤 실행하며 아직 NOT TESTED다. 신규 actual exchange의 legacy 직접 DB seed는 비범위이고 browser legacy NOT TESTED를 유지한다. mixed JSON 원형 유지/양 버전 전체 Import 거부/rollback은 위 native SQLite service test가 근거이며 전체 Copy/Template 기존 mixed 보존은 보존 담당 server 증거와 분리한다.

DOCUMENTATION_SYNC는 API/TEST_PLAN/IMPORT_SCHEMA/IMPORT_EXPORT/JSON_IMPORT/ARCHITECTURE/SECURITY/REQUIREMENTS 및 새1.1 schema/examples를 교환 담당이 갱신하고 Excel/보존/UI 지정 writer 근거를 통합한다. 기존1.0 machine schema/VBA_EXPORT는 변경 없음, migrations/DB 구조/Calendar·Dependency Scheduling 알고리즘/Resource engine/CI_CD/REMOTE_VALIDATION/DEPLOYMENT/HTTP_OPERATION/DESIGN은 해당 구현 변경 없음으로 N/A다. DB_SCHEMA와 MILESTONE_STAGE_GATES 등 보존 기술 문서는 보존 담당, EXCEL_EXPORT는 Excel 담당, UI docs는 frontend 담당이다. 현재 단계는 로컬 source freeze와 docs evidence 작성이며 실제 browser/global typecheck/독립 QA/공식 원격 gate는 후속 근거를 기다린다.

Source freeze 후 JSON clock1/read-transaction/no-secret 회귀1건을 추가하여 server 파일29/29 PASS(ch1f015e,1.44s)를 확인했다. 이어 합법적인10,000자 description을 가진531 Task Project의 JSON이5 MiB를 넘으면 EXPORT_LIMIT_EXCEEDED로 전체 실패하고 source row/revision을 보존하는 회귀1건을 추가해 같은 파일30/30 PASS(ch210ccf,1.48s)를 확인했다. production source13개 hash는 freeze와 불변이고 후속 tests-only scoped ESLint는 exit0(ch4115cb)이다. 기존96+예제2+clock1+대량export1의 관련 unique100개 증거이며 단일100 전체 실행이라고 주장하지 않는다.

보존 담당의 Excel4번째 Stage DTO 연결 회귀는 matching workbook 성공/Tasks explicit·effective·inherited IDs/Stage full Gate·IDs/Dependency off 소속 유지/missing·stale DTO 전체 실패/source 불변을 검증했다. 해당1case만 PASS(chc196f5,686ms,31 무관 skip)이며 소유 milestone-stage-service.test.ts를 보존 담당이 갱신했다. Exchange/Excel source 변경은 없다. Excel 최초실패 ch4f0846의 .data 타입1오류는 owner가 수정했고, ch0871b3에서 runtime @ alias Vitest import 실패(new suite0 tests/기존11 PASS) 후 owned handler runtime import를 relative로 변경했다. ch482426의 신규8 FAIL/기존11 PASS는 DEVELOPER role fixture 미등록 DB trigger 오류여서 역할을 추가했고 trigger/assertion을 유지했다. Markdown 최초 ch272a74는 존재하지 않는 command 파일명 오류였고 실제 check-markdown-links.mjs로 수정해123 files PASS를 확인했다. Excel 최종 npx tsc --noEmit --incremental false는 exit0(chad1b34), scoped ESLint source4+test1은 exit0(ch71b600,warning0)였다.

보존 Excel 회귀는 typed ProjectExcelExportRequest annotation을 추가한 뒤 같은1case1/1 PASS(chd6f7bd,793ms,31 무관 skip)로 재검증했다. 작성 중 tsc의 columns.id:string widening3건(ch03a656)은 owner가 타입 annotation으로 해결했고 전체 typecheck PASS(ch14d5cd), scoped lint PASS(chc22e83), Markdown123 PASS를 전달했다. source7 hash는 불변이다.

Frontend mock/외부 PR470 review E2E의 관련 unique9 coverage는 PASS다. 최초74093 exit130/chb7fb1e는1 FAIL(6.5s: 닫힌 더보기의 hidden file input을 직접 선택한 harness),1 interrupted/7 not run이었다. user disclosure+filechooser를 통해 실제 흐름으로 수정했다.81801 exit130/chc174f2에서 Import2건은 PASS(1.9s/1.6s), Copy의 기존 Below label 대신 After를 찾은 harness는 FAIL(30.1s), JSON412의 safe 한국어 오류 대신 raw 영문을 기대한 harness는 FAIL(6.2s), geometry는 interrupted/4 not run이었다. tests-only 수정 뒤33014 exit0/chf17525는 남은7건 PASS(17.5s)였다. Copy native fullscreen/menu/keyboard/ack/pending2.3s, JSON 최신 mixed GET/If-Match/4121.1s, Copy/Import/Excel/JSON five-width5.1s, 외부 revision1.8s, completed M1.2s, review Resource dirty1.6s/type-tab1.6s를 확인했다. 앞선 Import2+후속7의 unique9이며 단일9 PASS 실행으로 표현하지 않는다.

Frontend after geometry는 `output/playwright/issue-464`의20 PNG+20 JSON으로390/768/1024/1440/1920×844px를 기록한다. documentWidth=viewport, control 침범/중첩0, focus outline visible, Copy720/Import960 own scroll과 header/body alignment를 확인했다. 최초 raw trace는 /tmp/issue464-first-mock-failures와 second-mock-failures에 Git 제외로 보존한다. product production327 source hash는 불변이고 Next 종료/backup2개 복구를 확인했다. mock evidence는 실제 SQLite exchange/browser나 공식 CI PASS를 대체하지 않으며 actual source freeze/직렬 실행 결과는 후속으로 기록한다.

앞선 frontend mock unique9 PASS 뒤 Manager 정적 검토에서 Import412 복구의 제품 gap을 발견했다. 파일은 유지됐지만 현재 revision을 다시 GET할 수단이 없어 새 preview도 이전 prop revision으로 거부될 수 있었다. frontend가 명시적 “최신 일정 조회”로 canonical GET을 수행하고 AbortSignal/target/generation을 apply 전 재검증하여 file/dialog을 유지하되 기존 preview를 무효화한다. 자동 preview/commit을 수행하지 않고 사용자가 다시 preview/diff를 확인한 뒤 새 digest와 manual commit을 제출한다. 신규 mock2개는412→GET revision 갱신→새 digest/manual201 및 늦은 GET의 취소/네트워크 명시 retry를 작성했다. Unit20 PASS(125ms)와 tsc/scoped lint89635 exit0를 전달했으나 후속5대상 browser 실행은 아직 NOT TESTED다. 기존9 PASS는 수정 전 source 증거이고 추가 버튼이 생겨 기존 geometry40 산출물의 최종 적용 판정은 stale로 유지한다. 이 finding은 첫 harness FAIL들과 구분되는 제품 복구 gap이며 backend 계약/source13은 변경하지 않았다.


Manager/독립 Domain 검토에서 canonical LinkService는 Task당 incoming101 DAG를 저장할 수 있지만 JSON1.1 schema는 perTask100인 교환 gap을 재현했다. 수정 전 JSON Export가101 predecessor를 성공 출력한 뒤1.1 재검증이 INVALID_FIELD tasks.101.predecessors로 실패했다. schema cap/Link engine/원형 Link를 변경하거나 줄이지 않고 serializer가101번째 row를 추가하기 전에422 EXPORT_LIMIT_EXCEEDED로 전체 실패하도록 수정했다. canonical LinkService로102 Task DAG를 만들고 incoming100의 Export+1.1 재검증 성공과 incoming101의 HTTP422/no attachment/no partial tasks/file body/no revision/source 불변 경계를 실제 SQLite에서 확인했다. server 파일31/31 PASS(chd4ad4e,2.10s)이며 기존30+새1이다. 이 source 변화로 이전 exchange13 freeze는 stale이고 새 manifest/LFF를 작성한다. 실제 browser는 승인된 Next STOP 상태의 source 재고정 뒤 실행한다.

최신 main f8f830d2e8d65a76c718301bad8225532ab8b94a(PR469)의 운영19파일 변경은 application source를 변경하지 않는다. TEST_PLAN writer가 a9107ab..f8f830d의 retention1줄 및 Issue452 candidate corrective12줄을 현재#461~#464 증거를 보존하여 정확히 통합했다. 운영15파일은 지정 Agent, CHANGELOG/version/package/PLAN은 Manager/infra 소유다. 성공 non-docs Main candidate의 Generic Finalizer handoff 원칙은 새 main 정책을 따르며 실제 실행/완료 범위를 바꾸지 않는다. 이번 작업의 PR CI 결과/monitoring/main/release는 미검증 또는 승인 범위 밖 상태를 유지한다.

perTask100 Export REWORK 후 최종 교환 LFF는 같은5 files의101/101 PASS(ch5ba256,3.43s)다. 이후 전체 `npx tsc --noEmit --incremental false`는 exit0(cha55acd), changed JSON core/관련 test scoped ESLint는 exit0(ch437839), Markdown123은 PASS(ch403560)였다. production13 새 source freeze SHA256은 `fe94c8eaa8a4f58955b80987f8ab1f40dca1204077f3becbba0341fc69c38865`다. 이전100unique 서술은 이전 source/여러 실행의 기록이며 이번 최종101개는 단일 관련 명령에서 실제 완주했다. DTO/body/Origin/revision/read transaction/clock과 cap100/Domain 알고리즘은 변경하지 않았다.

최신 main 운영 exact15파일 통합의 별도 최소 LFF는 lifecycle verify PASS(cha59263), deployment7/7 PASS(ch5dd3a1), version0.89 검증 PASS(chb12c87)다. CI_CD/REMOTE_VALIDATION/DEPLOYMENT N/A는 #464 제품 구현의 추가 운영 계약 변경이 없다는 뜻이며 최신main f8f830d의 운영 파일·candidate handoff 정책 통합은 별도 실제 변경으로 기록한다. 이 통합이 feature의 PR quality/e2e/docker 또는 main/release runtime 검증을 수행한 것은 아니다. 현재 source 재고정 뒤 actual2/기존Stagegates1의 직렬 browser 승인을 기다린다.

최초 actual exchange 실행42932/che331f2는 primary test6.6s에 FAIL(exit1)이었다. Resource admin POST의201 기대가401이었고 합성 admin password 길이14가 기존 설정 정책의 금지 구간13..15에 해당한 fixture 오류였다. 제품 authorization/설정 gate와 assertion은 유지하고 허용16자 이상 합성 fixture로 수정했다. 기존 Task/Stage seed API 약43건까지 진행했으나 Resource/Editor/Stage 조회·JSON/Excel·Copy/Template·viewport 및 두 번째 stale recovery는 해당 실행에서 NOT TESTED다. 첫 trace/error context는 test-results/milestone-stage-exchange---fa9fb-port·Copy-Template·소속-확인-통합-chromium에 Git 제외로 보존한다. Next 종료/생성2개 backup 복구/production327 hash drift0을 확인했고 Manager가 actual2 재실행을 승인했다. 첫 fixture FAIL을 최종 성공 근거로 숨기지 않는다.

Frontend412 제품 gap 보강 뒤 최종 targeted 실행6427/chb235f9는8/8 PASS(1.1m, exit0)다. repository Playwright config에서 milestone-exchange-state.spec.ts/project-gantt-image-export.spec.ts/project-multi-task-copy-paste.spec.ts, Chromium, workers1, max-failures1을 사용하고 grep은 `#464 Import commit|#464 Import cancellation|#464 Import and Copy 5|#464 Import 412|#464 cancelled latest|SVG/PNG export|다중 checkbox Copy의 canonical|pending 다중 Copy`였다. 기존 Import2+latest GET recovery/취소·실패2+새 five-width geometry1+실제 SVG/PNG/Excel1+기존 canonical multiCopy/pending4122를 확인했다. 이전33014의 변경 비영향 Copy fullscreen/JSON/외부 revision/완료 경계/Editor review2의6개를 재사용하여 unique14 coverage이며 단일14개 실행/전체 회귀 PASS는 아니다. 이전 geometry는 최신40개 PNG/geometry exact allowlist로 교체했고33014의 exact narrow grep은 압축된 context에서 복원하지 못하여 원래 tool 입력을 증거로 유지하며 추정 command를 기록하지 않는다.

Frontend 최종 Unit20 PASS(chb80fa2,125ms), scoped lint16파일 warning0/전체 tsc/Markdown123 PASS(session51659/chfc139c,exit0), 최종 UI 문서 추가 뒤 Markdown123 PASS(ch733383)다. source15/문서4 writer를 freeze했으며 exact manifest /tmp/issue464-frontend-final-manifest.json SHA256 `338a917fa5a5a656679c4266fc79abb96750a9a31b51fce809feb2257c3cafb8`에 기록한다. 생산327 hash drift0/생성 diff0(chb9c6bf)은 backend cap100 수정 전 상태 확인이며 이후 승인된 cap 수정의 새 전역 freeze는 별도다. 현재 실제 SQLite integration2/기존Stagegates1/원격/최종QA는 진행 또는 NOT TESTED다.

독립 Domain 최종 검토는 blocker0/PASS다. source13 fe94c8/Excel4 ec05f6/preservation7 a16445와30개 검토 파일 전후 hash 일치를 확인했다. actual LinkService/HTTP incoming100/101 회귀1개만1/1 PASS(30 무관 skip,1.99s,ch1c40b6)로 독립 실행했고 교환 담당의101/101 실행과 구분한다. pure import11은 앞서19/19 PASS(426ms,chf1014f)였고 이후 cap 수정은 validator를 바꾸지 않아 영향 없는 그 결과를 재사용했다. source-only Excel/domain 읽기는 독립 full Excel 실행이나 최종QA가 아니다. 최초 ESM named-export probe CJS SyntaxError 및 owner 수정 중 uncaught expected throw probe는 harness로 분리하고 실제 cap gap의 재현을 숨기지 않는다. 상세 /tmp/issue464-domain-exchange-review.md SHA256 `4539694ad60eabb81bf4acd342578b7a0a9d07555143dc260358f5ee3dc962bb`를 따른다.

독립 UI/UX 최종 검토는 blocker0/PASS이며20개 geometry JSON과12개 PNG를 직접 읽어120개 controls와40개 artifact manifest를 확인했다. 보고 /tmp/issue464-uiux-final-review.md SHA256 `d7a637c194fa634a027292e11ff01543870436735c761f6348240cc01e7c605d`와 artifact manifest311a484 기준이다. Own Excel 제품 승인·실제 SQLite 전체2·remote 최종QA/CI를 대신하는 판정은 아니며 actual과stagegates 후 최종DOCSYNC/QA를 구분한다.

Actual2차82735/ch75ac89는37.7s에 OOXML test parser harness로 FAIL했다. parser regex가 self-closing 빈 O cell을 다음 닫는 R(UUID) cell까지 묶어 Summary leaf Baseline O의 공란 assertion이 실패했다. 제품 Excel writer의 해당 value=undefined/공란 출력은 정상임을 읽기 확인했고 source를 바꾸지 않는다. owned E2E parser만 최소 수정하여 정적 샘플/lint/type을 검증한 뒤 동일 actual2개를 재실행한다. Seed/Editor/Milestone tab/Grid/Stage full M/D5.5·partial4/Logistics/Resource 같은 기간IDs/JSON 실제 download/Excel Task 일부까지 진행한 PASS와 남은 전체 및 두 번째 stale recovery NOT TESTED를 구분한다. 최초2차 trace/raw는 Git 제외로 보존하며 Next STOP/production327 복원(ch365696)을 확인했다. 이 harness FAIL은 제품 데이터 유실이나 source 변경 근거가 아니다.

Actual3차63530/ch080ac2는33.2s에 unlock harness의 edit-sessions201 기대가 정상 계약204와 달라 FAIL했다. 기존 [API.md](API.md)의 edit session 성공204를 그대로 유지하고 helper expectation만204로 수정하며 남은 endpoint harness를 실제 API 문서와 대조했다. 실제 Excel 전체 Stage/Tasks/ResourceSummary의 default full M/D5.5·범위/IDs/revision/Ready/null 공란과 JSON 실제 Target preview→commit201/revision2/newUUID/Task DAG/explicit·effective·inherited/status/requestedStart/Baseline/Gate 의미/source 불변/Assignment scope 제외까지 진행한 PASS를 기록한다. Whole Copy/Template/Copy warning/readonly viewport/두 번째 stale recovery는 이 실행에서 NOT TESTED다. source auth 계약은 변경하지 않고 Next STOP/production327·생성 파일 복원(chd5260d), 첫3개 raw trace 보존을 확인한 뒤 동일 actual2개를 재실행한다.

Actual 담당은 첫3회 trace/error context를 /tmp/issue464-actual-firstfail-1, -2, -3에 별도 보존(Git 제외)했다. OOXML parser의 self-closing/string/number 정적 샘플을 먼저 검증하고 unlock204 oracle를 실제 계약으로 고친 뒤4차67465를 실행한다. 스펙 SHA256은56f48002 접두어이며 최종 exact SHA는 actual handoff를 따른다. 각 재시도에서 Next STOP/생성2개 exact 복구/production327 drift0을 확인했고 제품 source는 변경하지 않았다.

Actual4차67465/ch5e4de2는 Whole Project Copy resetProgress:false의 POST201 기대에409 PERSISTED_SCHEDULE_INVALID를 반환한 첫 제품 FAIL이다. 앞선 세 번의 fixture/parser/status harness 실패와 구분한다. 원본은 정상 공개 API로 만든45 Tasks/6 M, nested/empty Summary, 병렬 join/Completed full E, 개인 Resource3+Group1, 물류 Equipment1, long Task120을 포함하고 legacy mixed는0이다. 앞선 JSON/Excel roundtrip 영역은 PASS에 도달했으나 Copy/Template/사용자 확인/readonly viewport·두 번째 recovery 및 전체2개 완주는 미검증이다. assert/fixture를 약화하지 않고 Next STOP/production327 drift0/생성 복원(ch7823f5)을 확인했다. Manager가 보존 source owner에게 읽기 원인 분석을 배정했고 source 쓰기는 별도 승인 뒤 수행한다. 교환13/Excel/UI는 불변이며 이전 LFF가 이번 실제 Copy 제품 FAIL을 대신하지 않는다. DOCSYNC/QA/actual 전체 완료는 Pending이다.

Actual 중간 handoff는 /tmp/issue464-actual-result.md와 /tmp/issue464-actual-manifest.json에 보존한다. 첫4회 스펙 SHA256은 `56f48002f11c845660065ae8102d288fda870bb06ba2081a7e74fec3832da38b`이며 /tmp/issue464-actual-production-first-four.json은 당시 source freeze 근거다. 첫4회 raw trace/error context는 /tmp/issue464-actual-firstfail-{1,2,3,4}/에 Git 제외로 보존하고 after PNG는 아직 없다. 4차의 비밀값을 제외한 합성 canonical API 재현은 /tmp/issue464-actual-whole-copy-repro.json에 있으며 source revision62/task45/M6/link3/assignment4다. 원인 분석은 보존 담당이 수행하며 이 기록만으로 가설을 확정하지 않는다. 브라우저 legacy mixed 직접 DB seed와 Cut는 범위 밖 NOT TESTED이고 native SQLite server LFF 및 frontend mock 근거와 분리한다.

Actual4차 Whole Copy 제품 실패의 원인은 보존 담당의 native SQLite 회귀2개가 최초2/2 FAIL(ch756532)로 재현했다. 원본 검증에서 `recalculatePersistedHierarchy(sourceTasks, calendar, sourceLinks)`의 sourceLinks를 누락해 정상 Task DAG의 requestedStart와 Dependency 적용 날짜 차이를 invalid로 판정했다. 보존 담당이 해당 호출에 원본 Links를 전달하는 최소 source 수정 뒤 Copy23/23 PASS였다. 기존 공용 Scheduling 계산 helper/Calendar 알고리즘과 Task DAG·membership·완료 guard를 바꾸지 않는다. 후속3 files/43 tests 실행은41 PASS/2 FAIL(ch1067b0)이었으며 기존 Summary→Task SQL 비정상 fixture와 신규 Template Baseline DTO omission/null oracle였다. 기존 WBS/Link/FK/Baseline assertion을 유지해 정상 DAG fixture 및 DB baseline-null oracle로 보정하고 후속 재검증한다. 이 중간 결과를43/43 PASS나 실제 브라우저 전체 PASS로 확대하지 않는다.

Whole Copy REWORK 최종 인계에서 actual4차 primary 시간은36.7s로 확인했다. 최종 관련3 files/44 tests는44/44 PASS(chcfa0ed,3.85s: Copy24/Template17/기존Copy3)다. 정상 API FS/lag의 effective≠requested, M→M Link, reset 양 옵션, Baseline/status/소속 새 FK, Template offset/reset과 source rows/snapshot 불변을 검증한다. 기존 비정상 Summary→Task SQL fixture는 정상 API Summary+child+predecessor3 Task/Task→Task FS1 Link로 보정했고 WBS/Link/UUID/Calendar/Baseline/원본 검증을 유지했다. 비정상 Summary endpoint 전체 거부/partial Copy0도 별도 추가했다. Template Baseline 생략/null oracle는 새 DB row의 baseline_start/end/duration null을 직접 검증했으며 Template source는 바꾸지 않았다. 이전 unique155 범위와 이번44개는 중복되므로 합산한 단일 전체 PASS를 주장하지 않는다. TypeScript/scoped ESLint4 PASS(ch0b0bc0), Markdown123/diff PASS(ch4fb3d7)다.

보존 담당의 새 source7 freeze SHA256은 `7225cee84607945647ff445267196df09d6bce6608b396ddcf2189321ee80f9c`, owned17 manifest SHA256은 `b857125ec3b96b2c1f2ba5a8cfd9188138e5fb1b9efe5a3c0a792fd88f5f164b`다. Copy service1개의 sourceLinks 전달만 바뀌고 다른6 source는 불변이며 이전 source freeze는 /tmp/issue464-preservation-source-freeze-before-copy-fix.json에 보존한다. API 입력/응답/error mapping·Origin/session/revision·DB/migration·공용 Calendar/계산 알고리즘은 그대로이므로 API/SECURITY의 추가 계약 변경은 N/A다. ISSUE_27_PROJECT_COPY/MILESTONE_STAGE_GATES는 보존 담당이 전체 Links 검증과 FS/lag 정상 복사를 반영했고 교환13/Excel/UI는 동결을 유지한다. 실제 통합 재실행/독립 Domain·최종QA/원격 CI는 별도 대기 또는 NOT TESTED다.

Copy REWORK의 독립 Domain 재검토도 blocker0/PASS다. 독립 담당은 관련3 files에서 Copy DAG reset 양 옵션·불법 Summary endpoint·Template DAG·기존 Copy 계층/휴일/식별자5개만5 PASS/39 skip(1.51s, session72007/ch85cf00)로 실행했고 기존 Copy 물류 회귀는 별도1 file/2 PASS(1.23s, session54592/ch539600)로 확인했다. 이 두 명령을 단일7개 실행이나 owner44개 결과로 표현하지 않는다. 검토 전후96개 source/test/docs/artifact hash는 drift0이며 새 보존 source7/owned17 manifest 일치를 확인했다. 변경 없는6개 보존 source 및 교환/Excel/frontend 검토는 동일 hash로 범위별 재사용하고 이전 Whole Copy source a16445 기준 결론은 stale이다. 상세 /tmp/issue464-domain-preservation-review.md SHA256 `d6baead04176783e2beea8d5893e8eb459242ab2c8c535af0e61378e132ff699`를 따른다. 실제 통합 완주와 전체 최종 사전QA/DOCUMENTATION_SYNC·원격 CI는 이 Domain 판정과 별도다.

Actual5차3149/ch2145b3는 primary1.1m에 row contextmenu 뒤 Copy 메뉴를20s 안에 찾지 못해 FAIL했다. 이 시점은 메뉴 harness/제품 원인 미확정이며 interactive cell 좌표나 scroll race를 확정 원인으로 기록하지 않는다. 새 Copy source에서 Whole Copy resetProgress:false의 새 UUID/Link/Gate/Assignment/원본 불변과 resetProgress:true의0/not_started, Template 생성·적용201/FK remap/status reset/원본 불변까지 실제 assertion PASS에 도달했다. 기존 actual Copy 테스트처럼 명시 작업명 cell을 contextmenu 대상으로 사용하도록 owned harness를 보정하고 같은2개 테스트를 재실행한다. 제품 source는 변경하지 않으며 UI Copy/사용자 확인/native fullscreen·readonly viewport/두 번째 stale recovery는 아직 NOT TESTED다. Next STOP/생성 원본 복구/production327 drift0(ch42c36c)과 첫5회 raw trace 보존을 확인했고 최종 성공 판정은 후속 완주 결과에 따른다.

실제 통합6차64441/ch59c068에서도 정확한 작업명 셀을 우클릭한 뒤 Copy 메뉴가 나타나지 않아 FAIL했다. 따라서 넓은 행 영역을 우클릭한 것이 원인이라는5차 가설은 배제한다. 전체 Project Copy와 Template 검증까지 도달한 부분 PASS는 유지하되 메뉴 이후와 두 번째 테스트는 NOT TESTED다. Core 선택의 자동 스크롤 직후 메뉴가 닫히는 경로는 분석 후보이며 원인으로 확정하지 않는다. Frontend 담당이 trace를 읽어 분석하고 제품 수정은 원인 확인과 Manager 승인 뒤 수행한다. Next 중지·생성 파일 원본 복원·production327 hash 불변을 확인했고 교환 source13개는 동결을 유지한다. 이전 문서의5차 원인 미확정 상태와 이번 가설 배제를 구분하며 최종 판정은 후속 실제 재검증을 따른다.

실제6차의 보고서 원시 시간은 primary63492ms/전체82642.603ms, 시작2026-10-05T23:43:11.966Z다. /tmp/issue464-actual-firstfail-6/report-timing.json과 최신 /tmp/issue464-actual-manifest.json에 보존한다. 스펙 SHA256은 `5015015dba8076bc34085dca7678ac479c498d7cdb94fe340fde3bf3ee77275a`, production327 freeze SHA256은 `f62cfe6a4b3436999bb9fbab6063713341030a0dafcff11d8ea4fe326d514944`다. 공통 실행 명령은 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/milestone-stage-exchange.spec.ts --project=chromium --workers=1 --max-failures=1`이며 브라우저 실행 파일 환경은 해당 담당 결과에 기록한다. 첫6회 trace와 재현 JSON은 Git 제외로 보존하고 after artifact는 아직 없다. 메뉴 원인을 확정하기 전 오류 분류는 미확정이며 source를 바꾸지 않은 실제 담당과 후속 frontend 분석을 구분한다.

실제5·6차 메뉴 실패는 후속 trace 분석에서 제품 race로 확정됐다. 메뉴 선택 전 native/public top192가 Core 기본 show:true 선택 뒤201로9px reveal되고 기존 scroll guard가 contextmenu를 닫았다. 넓은 행 우클릭 가설과 당시 원인 미확정 기록은 이전 분석 단계로 보존하며, 이번 관측이 그 미확정 판정을 대체한다. Manager는 frontend에 실제 project-gantt.tsx의 contextmenu 선택 mirror에만 공개 show:false를 전달하는 source1개 최소 수정과 기존 task-context-menu-scroll.spec.ts 회귀·UX 문서2개 동기화를 승인했다. 일반/keyboard/modifier 선택과 사용자 스크롤의 메뉴 닫힘은 유지한다. 교환13/Copy7/Excel4 및 실제 통합 스펙5015015는 고정하고, 메뉴 수정 뒤 관련 LFF·실제 통합·독립 검토/문서 근거를 새 기준으로 확정한다. 이전 메뉴 이전 영역의 부분 PASS로 수정 후 전체 실제 PASS를 주장하지 않는다.

Frontend의 contextmenu 최소 수정은 openTaskMenu에서 공개 select-task의 show:false를 명시하는1개 source 변경으로 동결했다. 상세 /tmp/issue464-context-menu-analysis.md와 /tmp/issue464-context-selection-freeze.json SHA256 `5b508bebacf1174c10058cd1714d3d6daaa4ced814d28db83a1da993fb17a9a9`를 따른다. 직접 Unit menu-scroll-guard4개는4/4 PASS(208ms, session3211/cha78f73), source scoped ESLint는0 errors/기존 warning4이며 전체 TypeScript/Markdown123은 PASS(session3211/ch33b646)다. 회귀 test 보강 뒤 test lint/TypeScript도 PASS(session11604/ch619883)였다. UI 문서2개는 공개 show:false와 실제 사용자 scroll의 메뉴 닫힘 계약을 반영했다. 이 결과는 actual6차 제품 FAIL 이후의 직접 Unit/정적 검증이며 새 mock·실제 통합 완주 결과는 아직 NOT TESTED다. 기존 frontend14 unique 범위의 contextmenu 영향 항목은 수정 후 검증과 구분하고, 변경 비영향 결과만 범위별 재사용한다.

Contextmenu 수정 후 관련 browser4개는4/4 PASS(session85154/ch4bb047,전체 표시1.4m)다. 기존 multi Copy24.1s·pending9.3s·신규 하단 메뉴5.4s·기존 화면 밖 메뉴3.1s를 새 source 기준으로 검증했다. 이전 Copy/contextmenu 동작 근거는 이 실행으로 갱신하며 layout을 바꾸지 않아 five-width40개 artifact는 변경 비영향 근거로 재사용한다. Source327 새 freeze05efed 접두어 기준 drift0과 Next 완전 중지/생성 원본 복원(ch659bec/ch33ce43)을 확인했다. 이4개 PASS를 실제 통합2개나 전체 suite PASS로 확대하지 않으며 동일 actual2개7차와 기존 Stage Gate1개는 후속 직렬 실행 결과를 따른다. Exact source SHA와 명령은 frontend 최종 handoff를 사용한다.

Frontend 최종 context handoff의 owned21 manifest SHA256은 `c2e97a1fc0561e77c39fbb4e4b99266313233387ed05c1ca941832dc4368d062`다. Unit/정적 검증 때5b508 기준에 이어 회귀 test 최종 내용을 포함한 context freeze는 /tmp/issue464-context-selection-freeze.json SHA256 `5378dd5086c2c12b2eaf3b072e26a227bd3b153f4ea95c8dceaf5e60ee1cb0eb`다. 실제 메뉴 회귀 명령은 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/planner/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome npx playwright test --config tests/config/playwright.config.ts tests/e2e/task-context-menu-scroll.spec.ts tests/e2e/project-multi-task-copy-paste.spec.ts --project=chromium --workers=1 --max-failures=1 --grep "미선택 하단 가상 행|화면 밖 막대를 우클릭|다중 checkbox Copy의 canonical|pending 다중 Copy"`였다. Native/public top192 보존·Core/소유 선택·Copy POST0·Escape focus·사용자 scroll 닫힘을 확인했고 해당4개 실행의 최초 실패는 없었다. 최종 UI 문서2개 추가 뒤 Markdown123 PASS(ch10b749)다. 기존14 unique와 이4개는 중복 항목이 있어 더한 단일18개 PASS로 표현하지 않는다.

실제7차21576/ch5f3027는 WARN Copy 메뉴 단계가 성공한 뒤 다음 DEST 작업명 셀의 Paste 메뉴를20s 안에 찾지 못해 FAIL했다. 보고서 시간은 primary62406ms/전체82891.751ms다. 앞선 contextmenu 수정은 Source Copy 메뉴 단계에서 실제 확인됐지만 전체 경고/복사 완료나 전체 통합 PASS로 확대하지 않는다. Paste 실패 원인은 미확정이며 frontend가 clipboard/메뉴 disabled/지연 scroll을 trace와 대조한다. 추가 source 수정은 원인 확인과 Manager 승인 뒤 수행한다. Source32705efed 접두어와 실제 스펙5015015는 불변이며 Next 중지/생성 원본 복원/drift0(chee8bcc)을 확인했다. Copy 경고 이후 내부 remap/완료 경계·readonly top96·두 번째 stale 복구는 NOT TESTED를 유지한다.

실제7차 Paste 실패는 trace에서 제품 layout race로 확정됐다. Copy feedback이 표시되며 Core 높이가407→379px로 바뀌고 DEST scrollIntoView 뒤 table.scrollTop이152였다. Context 선택의 setSelectionMessage('')가 안내를 지우면서 높이가407px로 복귀하고 table.scrollTop이124로 clamp돼 기존 scroll guard가 메뉴를 닫았다. Native/public top192는 유지됐으며 clipboard disabled가 원인이라는 증거는 없다. 앞선 원인 미확정 단계는 조사 이력으로 보존하고 이번 관측으로 확정 원인을 연결한다. Manager는 frontend에 context 선택만 feedback을 보존하는 내부 옵션과 실제 Copy→더 아래 DEST→Paste 회귀 확장을 같은4개 소유 파일에서 승인했다. 일반 선택의 기존 메시지 정리와 실제 사용자 scroll 닫힘은 유지하고 영구 빈 공간이나 넓은 layout 변경은 추가하지 않는다. 교환13/Copy7/Excel4는 고정하며 수정 후 관련 LFF·실제 통합·문서/독립 검토 결과는 새 기준으로 기록한다.

Paste layout race의 최소 수정은 context 전용 preserveFeedback 옵션이며 일반 선택의 기존 메시지 정리는 유지한다. Frontend 직접 검증80895/ch8091fa는 Unit menu-scroll-guard4/4 PASS(241ms), source lint0 errors/기존 warning4, 전체 TypeScript와 Markdown123 PASS다. 분석은 /tmp/issue464-context-menu-analysis-7.md에 보존했다. Mock 회귀는 Copy→더 아래 목적지→Paste enabled/Below→사용자 확인·취소 POST0까지 확장했고 root의 직렬 browser 승인을 기다린다. 실제7차 최초 실패는 그대로 보존하며 이 시점의 새 source browser와 전체 실제 통합은 NOT TESTED다. Exact 최종 source freeze는 후속 frontend handoff에 따른다.

실제7차 시작 시간은2026-10-05T23:52:15.412Z이며 primary62406ms/전체82891.751ms와 함께 /tmp/issue464-actual-manifest.json에 보존한다. WARN의 정확한 작업명→Copy와 DEST의 정확한 작업명 우클릭까지 완료한 뒤 main 메뉴의 Paste20s timeout이었고 As child 선택에는 도달하지 않았다. 최초 원인 미확정 읽기 단계(ch704419)와 이후 확정 layout race를 구분해 보존하며, 실제 스펙5015015를 유지한다. 첫7회 raw trace/error context는 Git 제외로 보존하고 Copy 확인 이후·readonly96·두 번째 stale 테스트는 후속 결과 전 NOT TESTED다.

Paste feedback 보존 수정 후 최신 관련 browser4개는4/4 PASS(session91415/ch127f06,exit0,40.1s)다. 다중 Copy13.6s·pending412 3.8s·확장 Source Copy→아래 DEST→Paste enabled/Below→경고 확인·취소 POST0과 table/native/public192 보존2.4s·기존 사용자 scroll 닫힘1.1s를 확인했다. 이전85154는 show:false만 적용한 source의 PASS이고 이번 실행은 preserveFeedback까지 적용한 최종 source의 직접 근거로 구분한다. Unit4/정적 검사80895의 PASS와 Next 중지(chca58b3)/생성2개 원본 복원·source327 drift0(chdf50cb), 마지막 복원 뒤 전체 TypeScript/Markdown123 PASS(session9175/ch27060d)를 기록한다. 최초 실제7차 제품 실패를 이번 mock 성공으로 숨기지 않으며 같은 실제 원본2개 완주는 후속 결과를 따른다.

Frontend 최종 owned21/evidence40 manifest SHA256은 `ed0aa0ef348080207a7284583f3b8d0dbc155dc08422453a9bebce74ca4137c8`, context source/test/문서4개 freeze SHA256은 `e0db8f866575742ee09019e0aa63410a3fd0247283bc17b7de2cad588d979a69`다. 상세 /tmp/issue464-frontend-result.json을 따르며 layout40개 기존 artifact는 변경 비영향으로 재사용한다. 이전14 unique와 겹치는 두 Copy 회귀·새 context 회귀의 반복 실행을 신규 건수로 더하거나 단일 전체 실행 PASS로 표현하지 않는다. 수정 후 실제 통합2/Stage Gate1/독립 최종QA/원격 CI는 대기 또는 NOT TESTED다.

실제 담당 thread 재개가 반복 거부되어 Manager가 frontend에게 원본 실제2개 테스트의 실행 책임만 재배정했다. 같은8차 실행이며 실제 스펙/source/fixture 쓰기는 허용하지 않는다. 실행 담당 변경은 기존 assertion이나 검증 범위를 줄이는 근거가 아니고 결과는 Local Fast Feedback로 기록하며 독립QA로 주장하지 않는다. 해당2개 종료 후 교환 담당의 기존 Stage Gate1개가 직렬 슬롯에서 이어진다.

실제8차의 첫 시나리오는 PASS(session14704/chfcdd45,29.1s)했다. 원본 assertion을 유지해 Copy→DEST Paste 확인·취소·ack과 readonly native fullscreen/peer/후속 layout의 public·DOM left120/top96까지 도달했다. 이전7차 이후 미검증 영역을 이번 실제 PASS로 갱신하지만 두 번째412 수동 복구는 실행 중이므로 전체2개 PASS로 표현하지 않는다. Manager의 독립 hash 확인에서도 source327/raw26 drift0이었다. 서버 실행 중에는 Stage Gate1개를 시작하지 않으며 두 번째 종료·Next 중지·생성 원본 복원 인계 뒤 직렬 검증한다. Final exact 스펙/명령/시간과 artifact는 후속 실제 handoff를 따른다.

실제8차는 원본2개 모두 PASS(session14704, 결과chb9ae2b/최종ch9ccc79,exit0)다. 통합29.1s·실제412 복구5.7s/전체54.3s였다. Copy→DEST Paste/As child→경고 취소0→ack1·내부 remap/완료 경계, readonly native fullscreen·peer·후속 layout의 public/DOM left120/top96 및412 파일 보존→명시 GET1→재preview→수동 commit201까지 원본 assertion으로 완주했다. 같은 스펙 SHA256 `5015015dba8076bc34085dca7678ac479c498d7cdb94fe340fde3bf3ee77275a`와 production327 freeze SHA256 `3d8ae3b8d3e97fcd9852c1c1069dffe19ab19b000b315dfd7c3798250d413c9d`를 유지했다. Next 중지(chd11a76)/생성2개 정확 복원·diff0/source327 drift0·스펙 불변(ch7fa29a)을 확인했다. 실행은 Manager가 frontend 구현자에게 재배정한 Local Fast Feedback이며 독립QA가 아니다.

최종 실제 handoff /tmp/issue464-actual-result.md SHA256은 `645ec22280dd7ee4a2b931b8e3f67bfa36c62d0ea35556839b4e12dc0bad57c2`, /tmp/issue464-actual-manifest.json SHA256은 `c39af1abf42b1150eb219956f29065e23bd693693392408c04aaba8687e1b7ec`다. 게시 후보는 [실제 readonly peer 화면](../output/playwright/issue-464-actual/after-readonly-peer.png)1개(SHA256 `c64f5fbde9476501121d7f85a397bd394e3d51d140620e730f01027ea242b279`)이며 첫7회 실패 raw trace/error context·DB/log/download/canonical 원본은 Git 제외로 보존한다. 이전 최초 하니스3회/Whole Copy 제품 실패1회/메뉴 제품 race3회의 이력과 source 수정·회귀 결과는 삭제하지 않는다. 기존 Stage Gate1개는 후속 직렬 검증이고 최종 독립QA·원격 CI·Windows Excel/VBA/DRM·실기기·스크린리더·운영 환경은 NOT TESTED다. 브라우저 legacy mixed 직접 DB seed/Cut와 변경 전 실제 screenshot은 실행하지 않았고 native SQLite·mock 및 기준 source 재현 근거와 분리한다.

기존 Stage Gate 실제1개도 PASS(session91128/chf683c1,exit0,개별12.8s/전체23.6s)다. 명령은 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/planner/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome npx playwright test --config tests/config/playwright.config.ts tests/e2e/milestone-stage-gates.spec.ts --project=chromium --workers=1 --max-failures=1`이었다. 실제 소속 저장/revision+1·상속·미완료409·완료/구조 잠금·Excel200/압축 XML의 S/M/T UUID·JSON1.1 명시 소속/완료 status·preview digest 누락428·잘못된 preview422·프로세스 재시작 후 canonical 불변·readonly mutation401·명시 재개와 삭제204를 검증했다. 스펙 SHA256 `a2038199164ae2a1db8ba76b9285a99fcb68e6596f3f39e1d87eb0bdc830d375`와 production327 freeze3d8ae3 기준은 불변이다.

Stage Gate 실행의 Next/Playwright 프로세스가 모두 종료됐고(ch3c8b42), 생성 next-env.d.ts/tsconfig.json은 직전 backup과 정확히 같은 bytes로 복원했다. Production327 hash drift0/스펙 불변(ch8d0645)을 확인했다. 초기 넓은 프로세스 검사에 기존 다른 사용자 컨테이너의 Next2개가 포함된 것은 검증 도우미의 범위 오류였으며 이번 실행 PID로 종료를 확인했고 기존 서비스는 변경하지 않았다. 이 Stage Gate 테스트의 최초 실행 실패는 없었다. NO_COLOR/FORCE_COLOR의 기존 경고는 유지한다. 이 실행은 교환 구현자의 Local Fast Feedback이며 실제8차2개와 별도 명령이고 독립QA/전체 suite/원격 CI를 대신하지 않는다.

최종 DOCUMENTATION_SYNC에서 교환 담당은 API/ARCHITECTURE/SECURITY/REQUIREMENTS/IMPORT_SCHEMA/IMPORT_EXPORT/JSON_IMPORT/TEST_PLAN과 신규1.1 schema/예제2개를 갱신했다. 보존 담당의 DB_SCHEMA/MILESTONE_STAGE_GATES/ISSUE_27_PROJECT_COPY/TASK_RELATIONS, Excel 담당의 EXCEL_EXPORT, frontend의 PROJECT_UX/TASK_EDITOR/UI_UX_GUIDELINES/IMAGE_EXPORT 최종 handoff를 통합했다. SourceCalendar 중복 복원·incoming101 cap·Whole Copy sourceLinks 누락·Import412 복구·Core 자동 reveal/feedback layout race의 실제 결함과 각 첫 실패/수정 후 검증을 구분해 보존한다. DB migration·기존1.0 machine schema·VBA/CSV producer·Calendar/Dependency/Resource 공용 알고리즘·HTTP transport 보안 정책의 추가 변경은 각각 N/A다. 새 Direct Project Hyperlink는 승인 범위 밖이며 추가하지 않았다. 제품 구현 기준 CI/배포 N/A와 별도 최신main 운영 정책 통합/LFF를 구분한다. 최종 Markdown 검사는 최신 Manager Packet/PLAN/CHANGELOG까지 포함하며 exact 소유 manifest는 해당 검사 뒤 확정한다. 독립 최종QA와 PR quality/e2e/docker·main GHCR/release·Windows Excel/VBA/DRM·운영 proxy/실기기/스크린리더는 실행 범위와 증거에 따라 NOT TESTED로 유지한다.

교환 담당의 최종 DOCUMENTATION_SYNC 판정은 PASS다. 실제8차2개와 기존 Stage Gate1개를 각 실행의 LFF로 확인했고 최신 Manager Packet/PLAN/CHANGELOG를 포함한 Markdown123 files 링크 검사(chbe9315), diff whitespace(ch92aa2c), 생성2개 Git diff0(chb51fb4)는 PASS였다. source13 freeze fe94c8은 유지하며29개 소유 파일의 최종 manifest와 Result Contract를 Manager에게 반환하고 writer를 동결한다. 전체138개 게시 후보의 독립 사전QA·게시 후 새 PR head의 quality/e2e/docker는 다음 단계이며 현재 NOT TESTED다.

### Issue #464 재정렬 후 원격 재검증

latest main `0fc986cb0cb642bdbedeec30157b27bd522b5a38` 및 #463 head `703807d600c1499092b0144732669fbe54465ca6` 위로 재정렬하며 기존 #464 로컬 증거는 이전 head의 범위 증거로 유지한다. JSON 1.1 동일 Export preview의 `changedTasks=[]`, Context Menu enabled-item keyboard 이동, #463 opening-scroll settle 승계를 새 head에서 검증한다. 공식 판정은 새 exact-head PR CI의 quality/e2e/docker이며 시작 전에는 NOT TESTED다.

### Issue #464 latest main 재정렬 — 2026-10-06

PR #473를 latest main `d748046733ae2006580052a480c984ae1eb1fa2a` 기준으로 다시 정렬한다. 해당 main에는 #463가 병합되어 있고 #455 UI/transport 및 #463 결합 필터 보완까지 포함된다. #464 고유 JSON/Excel/Copy/Template 구현과 Codex P2 round-trip 보완을 유지하고, `project-gantt.tsx`는 main의 context-menu surface settle을 보존하면서 context 선택에서만 `show:false`와 Copy feedback 보존을 재적용한다. 새 exact-head PR CI의 quality/e2e/docker가 공식 재검증 기준이며 결과 확인 전에는 NOT TESTED다.


## Issue #456 — 폼 밀도와 상태 보존 검증

검증 baseline은 `05fe212060ed4a935510dc2f7a692bb9113c55e8`, 작업 branch는 `fix/issue-456-task-editor-form-density`다. 전용 spec `tests/e2e/task-editor-form-density.spec.ts`와 합성 canonical fixture `tests/e2e/fixtures/task-editor-density.ts`를 추가했다. 테스트 설정은 `tests/config/playwright.config.ts`를 명시하고 기존 Task Editor·fullscreen·검색/필터·scope·peer·SQLite persistence case를 선택 실행했다. 전체 local suite는 반복하지 않았다.

### 실제 브라우저 증거

- Chromium 153.0.8010.12, locale en-US, timezone Asia/Seoul, devicePixelRatio 1, browser 기본 100%/visualViewportScale 1. native 125% 확대는 NOT TESTED이며 CSS scale/DSF로 대체하지 않았다.
- 390/768/1024/1440/1920px에서 Task/선택된 Resource allocation·역할/Relation/nested/Baseline/Footer 및 Milestone 소속·물류 동적 탭을 실제 앱에서 측정했다. 합성 값은 이름 168자, Description 2600자, URL 1640자, domain이 계산한 유효 Baseline 9999 working days다. 실제 limit를 넘는 잘못된 fixture로 before를 만들지 않았다.
- 원래 before evidence 71개는 `output/playwright/issue-456/before/`에 유지한다. 초기 incomplete capture는 Git 제외 `/tmp/issue456-before-firstcapture/`로 보존하고 최종 enriched before와 구분했다. after는 같은 정상 표면과 keyboard100%·날짜 오류·saving·비기본 Gantt 상태의 PNG/JSON을 `output/playwright/issue-456/after/`에 기록한다.
- desktop 진행률 값 clipping을 document overflow와 별도로 재현하고 실제10%/100% text 및 range/outline containment를 검사했다. baseline/relation action 최소44px와 모바일 native wrap 높이를 확인했다. desktop Footer Cancel58px/Commit85px, 높이44px이며 saving label 전환의 bounding box는 동일하다. description 전체 읽기 폭/min-height120px/vertical resize는 유지했다.
- representative1440 keyboard/focus/label-error 연결, actual pending disabled Save→body focus→반복 Escape와 public/DOM Gantt 상태, dirty/readonly/401/412/reload, nested Relation 및 #461 소속·Resource·Logistics 교차 draft 잠금을 별도로 검사한다. 모든 상태를5폭 전체 조합으로 실행했다고 주장하지 않는다.
- 비기본 WBS Summary scope, nativefullscreen, week, horizontal120/vertical38, 실제 task열227px/externalId열108px, 선택/tree/API/instance를 Editor 진입·각탭·취소와 metadata PATCH1 이후 비교했다. header 존재와 실제 폭을 확인해 empty-array 비교 PASS를 허용하지 않았다. ID 필터 변경·빈집합·null reset·reload의 새 API, 실제 scope/date/metadata/Link/Baseline 및 peer 왕복은 관련 selected case로 검증한다.

### 최초 실패와 진단 이력

실패 원본은 Git 제외 `/tmp/issue456-after-firstfail-<N>`에 보존한다. 성공 retry로 최초 실패를 지우지 않는다.

| 실패 기록 | 원인·조치 및 범위 |
| --- | --- |
| 1 / session95057 | 모바일 slider/value는 세로 배열인데 가로 비중첩만 검사한 하니스 오류. 실제 축에 맞게 수정. Milestone capture1 PASS |
| 2 / session52502 | mode label의 기존 accessible name에 options가 포함되어 exact getByLabel timeout. 기존 name selector와 별도 accessible name/label 검증으로 수정. Milestone1 PASS |
| 3 / session74651 | 실제 pending 반복 Escape로 dialog가 닫힘. layout2 PASS와 분리 |
| 4 / session39754 | dialog-local keydown guard는 disabled Save가 body로 focus를 보내면 막지 못함. 기존26+layout2 PASS, pending1 FAIL. 실제 in-flight/document capture 제한 guard로 수정 |
| 5–9 / sessions76678·36156·51080·82953·25767 | 비기본 Gantt120→0 FAIL. 빈 header selector를 실제열 geometry로 개선하고 단계별 public/DOM을 기록. speculative columns restore/DEV 계측은 Editor 진입 중 columns sync가 없다는 근거로 정확히 철회. session51080의 정상3case PASS는 실패와 분리 |
| baseline experiment / session92086 | source2를 exact baseline bytes로 잠시 복원해 같은120→0을 재현. baseline-existing 결함과 새 layout 영향 구분. STOP 뒤 승인 source2를 exact 복원 |
| 10–12 / sessions20091·25809·72302 | 직접 initialTab 진입도 FAIL하여 show-editor 경로 기각. focus/showModal 동기 호출 전후는120/821/1632로 동일하고 이후 native scrollWidth 축소/0이 관찰됨. 임시 browser 계측 철회 |
| 13–15 / sessions92406·69009·65170 | 같은 ID filter guard 뒤 Editor open/탭/취소120/38 유지, metadata 저장은 FAIL. canonical tasks identity까지 filter guard에 넣은 과도한 조건도 제거. session69009의 정상3case PASS와 저장 실패 분리 |
| 16–17 / sessions99503·5575 | 저장 단계에 filter-tasks 없음. update-task2→set-columns→scroll0 관찰. canonical sync 후2RAF/set-columns 전에도0/38/scaleWidth884/chartWidth822를 실측. 임시 source3 이벤트·대기 계측 철회 |
| 18 / session41437 | canonical 단계 복원은91px clamp 뒤 후속 columns0 reset을 막지 못함. metadata snapshot을 columns 완료/layout settle 이후 한 번 소비하도록 이동 |
| 19 / session1640 | 변경 스크립트 assertion 중단 뒤 미수정 source가 실행된 중복 FAIL. 별도 unchanged-source 원본으로 보존; 새로운 제품 원인으로 계산하지 않음 |

filter의 설치 handler가 직접 scroll0/timeline 축소를 수행한다고 단정하지 않는다. 반복 action을 제거한 뒤 Editor open/tab/cancel 보존과 canonical/columns 뒤 metadata 복원은 실제 브라우저 관찰 근거다.

### 최종 Local Fast Feedback와 재사용

- session3105/chunkb28d71: metadata snapshot을 columns 완료 뒤 소비한 source3의 비기본 Gantt1 PASS(8.1초).
- session39520/chunk956453: source3 영향 selected19 PASS(1.8분). 새4case, keyboard/dirty/readonly/401/412/reload/nested/#461 교차 초안·pending, search/filter/fullscreen/scope/peer와 실제 native SQLite requested dates·metadata·Baseline·successor persistence를 포함한다.
- 이후 same scale/public gridWidth/열 ID·width·hidden guard와 siblingOrder signature를 추가했다. session98507/chunkc16a5d: 비기본 Gantt·ID filter empty/null/new API·date/status/Baseline/milestone·scale/column/scope10 PASS(50.5초). guard는 복원 허용 범위를 더 좁히므로 앞선 정상 geometry/기존 상태 회귀는 source2/fixture 불변과 직접 관련 영향 근거로 재사용하며 예전 Escape-only 설명을 재사용하지 않는다.
- session40436/chunkae882f: 최신 guard source에서 실제 body-focus·반복 Escape 전후 public/DOM Gantt 비교, dirty/readonly/unlock·nested·401/412 및 소속/Resource/Logistics 교차 잠금9 PASS(29.5초). 당시 guard source에서19 unique scenario를 실행했고 앞선19의 영향 없는7 scenario를 재사용해26 unique scenario다. 이 최종 계열은 총38 PASS 실행/중복12회로 구분한다.
- Manager 검토 후 unmount cleanup의 request ref를 null로 무효화했다. source3 SHA256 `53bce567936360da3b755a920463c09c2fe9dc0ddec90c34b385b8cf810bee6f`에서 session69358/chunk3d875d 전용5 scenario PASS(24.6초), typecheck92399/chunk642279 PASS이며 같은 실행의 normal/state/env를 확정했다.
- 이어 snapshot 생성의 root 연결 및 소비의 실제 Gantt DOM 연결 조건만 추가했다. 당시 후보 source3 SHA256 `167c5e6a73e25925489368d568f8f0854bb59b9a5b73b98c485936f59d794212`에서 session4725/chunke914eb 비기본 metadata/Gantt1 PASS(7.0초), typecheck26034/chunk4c0c22 PASS다. 연결된 정상 화면의 판정에는 영향이 없는 guard 추가이므로 앞선 capture/run의 실제 hash를 소급 변경하지 않고 재사용했다.
- 이 중간 후보 계열은19+10+9+5+1=44 PASS 실행, 재사용 포함26 unique scenario/중복18회다. 최종 exact source에서는 대표1 scenario를 실행했고 이전25 unique scenario는 cleanup/DOM 연결 guard만 추가한 영향 근거로 재사용했다. 전체 after 이력은94 PASS testcase 실행과19 FAIL testcase 실행이며 같은 scenario 반복을 추가 coverage로 세지 않는다. baseline source2 실험 FAIL1과 before PASS3 실행은 별도다.
- 최신 typecheck session68684/chunk02b6de PASS. Scoped lint는 error0/warning4이며 exact baseline stdin lint session96489/chunk976615에도 같은4 hook 경고가 존재한다. required checks와 version/link/diff 결과는 최종 Result Contract와 manifest를 따른다.

최신 영향 검증은26 unique scenario이며 반복 실행을 별도 scenario로 세지 않는다. 이전 source의 추가 case와 중복 PASS 실행 횟수는 최종 Result Contract에 분리한다. mock-backed state/payload와 실제 SQLite persistence는 서로 대체하지 않는다. 전용 after fixture에는 유효한 빈 resource-workload/dashboard/logistics GET 응답을 추가했지만 기존 selected mock spec의 미구성 peer GET404 로그는 별도 한계로 남긴다. 해당 backend 전체 검증 PASS로 확대하지 않는다.

독립 QA가 active name/status metadata로 실제 visible ID 집합이 바뀌는 경계의 추가 guard를 요청했다. semantic visibleTaskFilterKey를 geometry 분류와 snapshot 생성/소비의 현재 filter signature 검증에 포함했다. 최종 source3 SHA256은 `98f77ddcc1d05c6e84ec4f559b6de4ae06f2295469b03312a0147b17ab637233`다. session37066/chunk796c82는 전용6 scenario와 scale/column/scope 대표2case 모두 PASS(51.1초), typecheck49261/chunk40ffc7 PASS다. 같은 visible집합의 metadata120/38 보존과 active name filter에서 rename→visible 빈집합→public/DOM0으로 이전120을 복원하지 않는 negative regression을 함께 확인했다. normal5폭/state/env도 이번 source에서 다시 수집했다.

최종 source 직접8 unique scenario PASS, 나머지19 unique는 기존19/10/9 실행에서 필터 signature guard 추가의 영향 근거로 재사용하여27 unique다. 최종 계열19+10+9+5+1+8=52 PASS 실행/중복25회, 전체 after102 PASS/19 FAIL testcase 실행이다. 이전 source SHA/실행 결과는 과거 단계 근거로 그대로 남기고 최종 hash로 소급 바꾸지 않았다.

Remote PR quality/e2e/docker는 이 frontend handoff 시점 NOT TESTED다. Manager의 독립 검토·infra 원격 게시/exact-head CI 등록 후 상태를 별도로 기록한다. CI 모니터링·merge/main GHCR/release는 사용자 이번 범위 밖이다. B #490/C #491은 FOLLOW-UP/NOT TESTED다.

## Issue #493 — Summary Task Description/URL 편집

- `tests/features/gantt/task-editor-model.test.ts`는 Summary command가 name/Description/URL/명시 완료 단계 소속만 포함하고 schedule/progress/Baseline 변경을 누락하는지, Description 길이와 URL scheme을 일반 Task와 같은 규칙으로 검증한다.
- `tests/domain/milestone-editor-model.test.ts`는 Summary 메타데이터와 완료 단계 소속을 한 command로 결합하면서 잘못된 일정 초안이 payload로 새지 않는지 확인한다.
- `tests/server/projects/summary-task-details.test.ts`는 실제 SQLite의 `TaskFieldProjectService`에서 Summary Description/URL 저장·canonical 재조회, child 추가/삭제에 따른 일정 재계산 뒤 메타데이터 보존, schedule readonly 거부와 revision 불변을 검증한다.
- `tests/e2e/project-task-editor.spec.ts`는 편집 가능한 Summary에서 Description/URL은 readOnly가 아니고 요청 시작일은 계속 readOnly인지 확인한다.
- `tests/e2e/project-task-editor-persistence.spec.ts`는 실제 브라우저+SQLite에서 Summary Description/URL PATCH 1회, 파생 일정 불변, 마지막 child 삭제 후 빈 Summary의 null 일정과 메타데이터 보존, reload 후 재표시를 검증한다. reload 후 값 검증은 실패 artifact에서 확인된 실제 접근성 tree의 `textbox` role을 사용한다.
- readonly/stale/pending/focus/Escape/Gantt instance 보존은 기존 Task Editor 회귀를 함께 사용한다. 전체 공식 회귀 판정은 동일 PR head의 `quality`, `e2e`, `docker` GitHub Actions로 한다.


## Issue #456 — Main CI #1993.1 dependency audit corrective

- PR #500 merge SHA `24072f4fd28cd1306b3c348d3f7da1a0e3dbc075`의 Main CI Run `37524404994` / #1993.1은 build, typecheck, lint, Vitest, Chromium E2E 6/6, Docker smoke가 SUCCESS였고 production dependency audit만 FAIL했다.
- 실패 원인은 `sharp 0.35.4`의 GHSA-wq5f-xc86-pv6w / CVE-2026-96889 (High)이며 audit gate는 완화하지 않는다.
- 최초 corrective PR #504 head `bc90e12e3dfc1eee8f1f1d4afdccb7964fb87acc`의 PR CI #2014.1에서 dependency audit를 포함한 quality, E2E 6/6, Docker가 SUCCESS했다.
- 그 사이 Issue #493가 병합된 latest main `8e7865dd69b398d818e0d80ae69e089d7f6dd9a7` / application 0.93.0이 동일 advisory 대응으로 `sharp 0.35.5`, `@img/sharp-libvips-* 1.3.4`를 이미 포함하므로 lockfile을 되돌리거나 중복 패치하지 않는다.
- #456 corrective는 latest main을 기준으로 재정렬해 `tests/scripts/test-config-layout.test.ts`의 `sharp >= 0.35.5`, 모든 `@img/sharp-libvips-* >= 1.3.4` 정적 회귀와 이 추적 기록을 유지한다. 실제 advisory authority는 계속 PR/Main/Release의 `npm audit --omit=dev`다.
- 재정렬 후 새 exact-head PR CI SUCCESS → merge → 새 Main CI 시작을 본 요청의 완료 기준으로 사용한다.

## Issue #457 전 화면 공통 geometry·상태 회귀

- [11행 coverage와 정확한 실행·예외](ISSUE_457_UI_UX_COVERAGE.md)를 기준으로 현재 branch의 대표 경로와 미실행 표면을 구분한다. Historical capture product source는 parent PR#500 `b397eedf35d50befb4ae17e623036f0a8d77f556` /0.92.1과 동일하다. 이번 CI 보완은 최신 main `8e7865dd69b398d818e0d80ae69e089d7f6dd9a7` 기준으로 재정렬하며 #493의 후속 제품 변경과 기존 캡처 provenance를 구분한다.
- `tests/e2e/helpers/ui-geometry.ts`를 기존 admin-auth, 생성/목록/공수/물류/설정 spec에 연결했다. 인증 정상·native keyboard focus·실제 error·deferred disabled의 computed style/label/description/clip owner를 검사하고 같은5폭에서 세 admin shell을 직접 비교한다. 최소 control/populated row/header 수, cell text/열 경계, document clientWidth+1, 내부 scroll/density와 native Tab last action을 검증한다. Empty colspan·숨은 text·0rect·inert는 성공 자료로 세지 않는다.
- `cross-screen-regression.spec.ts`는 직접 cross-admin 비교, populated Master 대표390/1440, 404 recovery/demo 대표만 추가한다. 생성 기존 spec에1920px를 추가했고 선택 기존 회귀를 유지했다. 전체 state×surface×viewport Cartesian product와 로컬 전체 suite 반복은 추가하지 않았다.
- 최종 대표 범위는 고유23개=최종 observer 직접7 PASS(32.7s)+제품 source/spec 불변 선택16 재사용이다. 총4실행36case의34 PASS/2 FAIL과 중간 `TS2304`는 별도로 보존한다. 최초 FAIL은 fold 아래 table 관찰 준비와 숨은 status text0rect의 observer 오류였다. 실제 제품 defect를 기대값 완화로 숨기지 않았다.
- Raw HTML/embedded ZIP/decoded JSON/trace/stdout은 각 실행 직후 고유 `/tmp/issue457-run<N>-*`에 보존하고 실제 case ID·해시를 `output/playwright/issue-457/runs.json`에 연결했다. 현재 PNG/JSON은 source/test/helper/fixture/env provenance를 가진다. Historical hardcoded outputs의 backup 필터 오류와 정확한 baseline403복원 경위도 coverage에 기록하며 성공한 사전 backup이라고 과대 보고하지 않는다.
- 같은 source/CSS는 KEEP이며 새 guard를 제품 개선으로 보고하지 않는다. #452 first-PR 공통 reusable helper 부재는 역사적 GAP/FAIL을 현재 보완하는 범위다. B#490/C#491 및 당시 React error boundary·실제 배포·native125·실기기/스크린리더는 #457 시점의 NOT TESTED 기록이다. 현재 실제 React boundary 자동화는 #502, native125·실기기/screen reader·운영 배포 검증은 #517이 소유한다. 당시 원격 `quality/e2e/docker` 미실행 기록은 역사 증거로 유지한다. CI 등록은 required jobs PASS와 최종 ACCEPT를 대체하지 않는다.

후속 추적은 분리한다. [#502](https://github.com/planner77/masterGantt/issues/502)는 실제 React error boundary 자동화를, [#517](https://github.com/planner77/masterGantt/issues/517)은 native125/실기기·screen reader·최종 수동 UX/배포 source·version의 환경별 검증을 소유한다. ui_ux·infra·qa_docs가 #517 환경 증거를 작성/비교/독립 확인하고 Manager가 환경 제공과 수용 범위를 판단한다. B#490/C#491 제품 개선과 별개다.

#457 독립 검토의 provenance 정정: 목록 `list-populated-1440`/`list-no-result-1440` key는 별칭이며 실제 JSON/PNG는1280×720이다. Current62 JSON은 ko-KR/Asia-Seoul/높이900/DPR1 49개, en-US/Asia-Seoul/높이900/DPR1 11개, en-US/Asia-Seoul/높이720/DPR1 목록2개다. 정상 Master auth는 기존 autofocus 때문에 focused/focusVisible=true이므로 normal을 비포커스 baseline으로 해석하지 않는다. 과거capture/test/source hash와141개raw PNG/JSON은 그대로 유지한다. 착수 시 stacked 계획과 달리 parent PR#500 외부 병합 후 최초 게시 base는 main `24072f4fd28cd1306b3c348d3f7da1a0e3dbc075`/0.92.1이었고 tree `6a322cc119ed5b0a435f3b1ff20fe5826035ed66`이 원래 capture source `b397eedf35d50befb4ae17e623036f0a8d77f556`과 정확히 같아 LFF를 재사용했다. PR CI 보완 시점에는 main이 `8e7865dd69b398d818e0d80ae69e089d7f6dd9a7`까지 전진하여 재정렬했다. 실제 운영 배포는 환경 후속 #517에서 NOT TESTED/BLOCKED다.

- #457 geometry helper는 일반 `npm run test:e2e`에서 tracked 증거를 덮어쓰지 않고 Playwright test output에 기록한다. tracked evidence publication은 `ISSUE_457_EVIDENCE_DIR` 명시가 필요하며, KEEP/REVIEW는 `ISSUE_457_BASELINE_SOURCE_AGGREGATE_SHA256`의 명시적 baseline과 source aggregate를 비교할 때만 부여한다. baseline이 없으면 중립 OBSERVATION이다.
- PR CI #2004.1의 production dependency audit에서 `sharp 0.35.4` / CVE-2026-96889가 High로 실패했다. audit gate는 완화하지 않는다. 최신 main에는 `sharp 0.35.5` 및 대응 `@img/sharp-* 0.35.5`, `@img/sharp-libvips-* 1.3.4`가 이미 반영되어 있으므로 그 lockfile을 그대로 사용하고 저장소 계약 테스트로 최소 버전을 고정한다.

## Issue #492 Grid/Chart 작업 Hover Tooltip 검증

- Unit: `task-hover-tooltip.test.ts`에서 canonical `ProjectTaskDto.start/end`가 공통 locale formatter를 사용하고 날짜 미설정 Summary는 `—`로 표시되는지 검증한다.
- Chromium: `project-task-hover-tooltip.spec.ts`에서 Grid/Chart 동일 Task의 작업명·시작일·종료일 parity, Task/Summary/Milestone, date-less Summary, Week, fullscreen, WBS scope, readonly를 검증한다.
- viewport 밖 Task/Milestone은 먼저 `scrollIntoViewIfNeeded()`로 위치를 확정한 뒤 hover한다. 제품은 scroll 중 기존 Tooltip을 닫는 계약이므로 Playwright `hover()`의 내부 auto-scroll과 hover 이벤트를 하나의 gesture로 결합해 오탐하지 않는다.
- app-owned delegated hover는 `TASK_TARGET_SELECTOR`의 Grid row/Chart bar를 canonical taskId로 resolve하며 Core API/렌더 anchor에 의존하지 않는다. hover 중일 때만 Task Tooltip DOM이 존재하고 Header focus·scroll·영역 이탈 시 제거되어 #315/#316 Header Tooltip과 `role=tooltip`이 중복되지 않아야 한다.
- 회귀: #315/#316 Header Tooltip, Context Menu, double-click Editor, Chart drag/dependency interaction을 PR 전체 E2E gate에서 함께 판정한다.
- #490/#456 Gantt 상태 보존 회귀는 hover 표시/닫힘 전후에도 horizontal/public viewport·tree·column·scale·selection·fullscreen이 유지되는지 기존 `task-editor-form-density.spec.ts`를 함께 판정한다. Tooltip state는 child layer에 격리되어 부모 Gantt render를 발생시키지 않아야 한다.
- 공식 결과는 동일 PR head의 GitHub Actions quality/e2e/docker다. CI가 완료되기 전에는 PASS로 기록하지 않는다.

## Issue #490 프로젝트 설정 회귀

`tests/e2e/project-settings-layout-490.spec.ts`는 현재 6case로 설정/보안/unlock 상태, Calendar 날짜/국가/validation/preview 상태, mock canonical Gantt 보존, native 반복 Escape, 실제 metadata API 및 실제 password rotation을 검증한다. 관측 helper는 390/768/1024/1440/1920px·높이900·ko-KR/Asia-Seoul·default100%에서 PNG/geometry와 실제 source bytehash/test hash/version을 기록한다. `ISSUE_490_EVIDENCE_DIR`를 명시하지 않은 일반 CI는 test output만 사용하여 tracked 증거를 덮어쓰지 않는다.

401/412로 닫힌 설정은 dialog PASS로 세지 않고 page-level readonly/canonical refresh 관측으로 구분한다. Mock state는 native 48px 열 resize·optional 외부ID 열·닫힌 중첩 Summary·native 선택·주 scale·Summary scope·scroll/public viewport·instance·전체 화면 round trip을 비교한다. 실제 API 테스트는 Origin/If-Match와 name/description 저장 성공, Task/Link/Calendar 불변 및 viewport를 별도로 검증한다. 요청 body/password/Cookie/token은 증거에 저장하지 않는다. Local Fast Feedback과 원격 quality/e2e/docker 판정을 분리하며 PR CI 시작만으로 전체 회귀 PASS를 주장하지 않는다. 실행별 실패·준비 oracle 정정·재사용 범위는 [Issue #490 검토 기록](ISSUE_490_UI_UX_REVIEW.md)에 기록한다.

Main CI Run #2035.1 corrective: shard 3/6에서 412 복구 직후 다음 보호 오류 주입이 canonical sync guard와 경합하여 POST가 시작되지 않고 `waitForRequest`가 timeout됐다. 제품의 sync 중 mutation 차단 계약은 유지한다. 비운영 환경의 Gantt frame에 `data-gantt-canonical-sync-depth` 진단 값을 기록하고, 연속 오류 E2E는 depth=0 및 mutation lock 해제를 확인한 뒤 다음 POST를 시작한다. timeout 확대나 retry로 실패를 숨기지 않는다.

PR #510 review corrective: 단순 `data-gantt-canonical-sync-depth=0`은 412 복구 React update가 passive effect를 시작하기 전의 이전 cycle 값일 수 있다. 비운영 frame에 canonical sync `generation`과 `settled-generation`을 기록하고, 연속 보호 오류 E2E는 mutation 직전 generation을 캡처한 뒤 새 generation이 증가하고 같은 generation이 settle되며 depth=0이 될 때까지 기다린다. 이전 cycle의 0을 새 복구 완료로 오인하지 않는다.

PR CI Run #2037.1 corrective: 위 shard 3/6은 PASS했으나 shard 4/6의 `project-status.spec.ts`가 revision 충돌 준비용 `page.request.get()`에서 단일 `ECONNRESET`으로 실패했다. 이 보조 요청은 제품 UI 기능 자체가 아니라 충돌 상태를 만드는 test harness이며, 별도 APIRequestContext 연결 재시도 대신 현재 페이지가 이미 사용하는 same-origin browser `fetch`로 snapshot GET과 외부 PATCH를 수행한다. 실제 UI 저장은 그대로 stale If-Match를 사용해 412/canonical refresh를 검증하며 timeout 확대·blind retry는 추가하지 않는다.

Main CI Run #2053.1 corrective: exact merge `75f014fccc8f6e3f19ba5fadebd3ecad4e0926c4`의 shard 2/6에서 `milestone-stage-grid.spec.ts` snapshot helper가 `apiRequestContext.get: read ECONNRESET`으로 실패했다. 같은 run의 다른 5개 E2E shard와 quality/build/typecheck/lint/Vitest/Docker는 PASS였고 HTTP status/assertion 실패는 없었다. 최신 main은 이후 #511 병합으로 `eab12824e359029b4c7f00b6ca7ab16535147a14` / app `0.94.2`까지 전진했으므로 corrective branch는 이 main에서 시작한다. 이미 저장소에서 검증된 direct GET 정책과 동일하게 snapshot GET에만 `socket hang up|ECONNRESET`을 최대 3회 bounded retry하고, 다른 예외·HTTP/JSON/assertion 실패와 retry 소진은 계속 FAIL한다. 제품 API/UI 동작과 mutation 경로는 변경하지 않는다.

#490 REWORK는 최신 main4f8fc2c9c86941d1b86ae4472b1e953707c85ef7/제품0.94.1에서6case를 실행한다. 0.93.1의 마지막5case와16runs40executions는 historical로 원본 hash를 유지한다. 새1case는1440px 실제 PUT hold→pending BODY·빠른2Escape·민감 입력 비움·중복PUT1개·native 보안탭 focus→204/revision+1/canonical GET/호출자 edit·이전 peer readonly·구password401/새password204와 정상 close/logout/unlock 초점을 검증한다. Calendar 기존 case에390px 새 field select/date의 native Tab·화면 안 bbox/ring을 추가한다. 성공 loading 동안 BODY 초점을 실제 관측으로 남기며 호출 버튼 복원 PASS로 확대하지 않는다. fullscreen 설정 진입은 지원 trigger가 frame 밖이라 N/A이고 fullscreen 왕복은 별도 검증한다. main #485 migration0023은 실제 isolated DB에 적용되며 변경된 stateful-project workload fixture는 이 spec의 직접 fixture가 아니다.

## Issue #486 — 401 후 Resource Catalog suspended draft 전환

- `tests/e2e/resource-error-recovery.spec.ts`에서 Resource dirty draft → 401 → 재로그인 → Group 추가 시 기존 Resource editor가 자동 재개되지 않고 `보존한 초안 확인`이 표시되는지 검증한다.
- `초안 유지`는 기존 draft를 suspended 상태로 보존하고, 이후 `보존한 초안 계속 편집`으로 재개했을 때 Resource 입력값이 그대로인지 확인한다.
- Group dirty draft → 401 → 재로그인 → Resource 추가에서는 `초안 폐기 후 리소스 추가`가 요청한 Resource editor를 열고 이전 Group draft를 제거하는지 확인한다.
- Profile dirty draft → 401 → 재로그인 → 다른 editor trigger에서도 자동 Profile 재개를 막고, 명시 재개 시 developer grade/roles 초안을 보존하는지 확인한다.
- 기존 password clearing/login focus, 401/412 수동 복구, pending 중복 mutation 차단, Escape/focus restore, Group 구성원 초안 보존 회귀를 같은 spec의 기존 case와 함께 유지한다.
- 현재 connector 세션의 Local Fast Feedback은 NOT TESTED다. 공식 판정은 동일 PR head의 required `quality`, `e2e`, `docker` GitHub Actions 결과로 수행한다.

## Issue #491 프로젝트 생성·전송 폼 회귀

`tests/e2e/project-transfer-layout-491.spec.ts`와 전용 `helpers/issue491-transfer-fixture.ts`의8case는 생성·템플릿 목록/생성·복사·템플릿 저장·JSON Import·readonly4형식 Export·inline 공수 옵션·실제 Gantt 상태를 검증한다. `ISSUE_491_EVIDENCE_DIR`를 생략하는 일반 CI는 test output을 사용해 tracked 증거를 덮어쓰지 않는다. 직접 CLI에는 `--config tests/config/playwright.config.ts`를 지정한다.

390/768/1024/1440/1920px geometry와 긴 입력/큰 표시값, 관련 validation/loading/pending/500/401/412/readonly를 표면별로 분리한다. 실제 footer12px·field/footer12px·top/height≤1px, native ring390/1440 clipping0을 assertion으로 검증한다. text-field 경계와 native radio/checkbox label/appearance는 별도 oracle이다. pending 빠른2Escape/민감 입력 비움/중복 POST, preview 취소와 commit busy, actual201/readonly download200 및 원본/canonical 의미를 확인한다. 공수 fixture의 큰 값은 실제 알고리즘 PASS가 아니며 source별 partial/stale 전체 회귀로 확대하지 않는다.

실제 Gantt는 Summary scope·optional 외부ID·native48px resize·closed nested tree·native 선택·주 scale·scroll120/38·instance/API/public viewport를 준비한다. 기존 workspace의 dialog 취소/템플릿 저장/지원 fullscreen 버튼 왕복을 동일 state로 비교하고 실제 Import commit의 instance/API/scale을 확인한다. 새 publicId navigation은 same-instance N/A, fullscreen C header 진입은 지원 경로 밖이다. headless keyboard Escape의 browser fullscreen 종료는 NOT TESTED로 구분한다.

역사적0.94.3 after8 PASS/8runs45case(34PASS/11originalFAIL)와 최신0.94.4 after-current8 PASS/합계9runs53case(42PASS/11originalFAIL), before/helper 재사용 조건, 미게시 raw/trace·원래 hash, 환경·공식 CI/수식·domain·Windows/DRM/125% 미검증은 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)를 따른다. 로컬 PASS는 새 PR head의 quality/e2e/docker PASS를 대체하지 않는다.

템플릿 instantiate의 실제 navigation·편집 상태·원본 불변은 검증했으나 safeJSON의201은 서버 계약 literal이며 response.status 직접 검증이 아니다. 기존 원본과 helper를 유지하고 최신 실행 provenance에 한계를 기록한다.

Issue #491의 두 번째 통합 최신 기준은 main `61a5f511d79e1f9429635bb0da35c0c02ee2163c`/0.95.1이다. 기존 #492 HoverTooltip 변경을 보존하고 동일 소비자 제품4/spec/helper로 새8case PASS를 확인했다. 이전0.94.3/0.94.4는 역사적 검증으로 보존하며 총10run61case(50PASS/11원래FAIL)와 최신 관측은 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)를 따른다. create/copy/instantiate201의 간접 근거와 직접 response.status 검증은 구분한다. 공식 CI와 최신 독립 검토는 별도다.

## Issue #502 실제 Error Boundary와 환경별 검증

#502는 #457에서 source-only로 남은 `app/error.tsx`와 `app/gantt-demo/error.tsx`를 실제 React 오류로 실행하는 자동화와, CI가 대체할 수 없는 환경별 검증을 분리한다.

- 자동화: `tests/e2e/error-boundary-regression.spec.ts`가 390/1440px에서 root와 gantt-demo segment에 client render 오류를 발생시킨다. native keyboard로 retry 버튼에 도달해 Enter로 `reset()`을 실행하고, 복구된 probe가 오류 전 focus 지점으로 돌아오는지 확인한다.
- 안전 경계: probe는 `NODE_ENV !== production` + `E2E_ERROR_BOUNDARY_PROBE=true`에서만 허용한다. root probe route는 gate가 닫히면 404이며 gantt-demo는 일반 요청에서 probe를 렌더링하지 않는다. 인증/권한/API/DB/scheduling 계약을 변경하지 않는다.
- 증거: #457의 `ui-geometry` provenance를 `evidenceScope=502`로 재사용하되 기본 artifact 경로를 Playwright test output에 격리한다. tracked evidence publication은 explicit opt-in이다.
- 구분: Project/API의 HTTP 500·network error UI를 route error boundary PASS로 사용하지 않는다.

| 검증 | 현재 판정 | 근거/다음 조건 |
| --- | --- | --- |
| root/gantt-demo 실제 React error boundary + retry + focus restore | PASS on previous head `ada3420df6d2018cec187c8b42103b843fb1c87b` | PR CI #2078.1/#2079.1 및 실제 #502 Chromium 2case PASS. #517 문서 이관으로 바뀐 새 head는 required CI를 다시 판정 |
| 실제 browser native 125% zoom | NOT TESTED | 환경 후속 #517. DPR/deviceScaleFactor/visualViewportScale로 대체 금지; 지원되는 실제 브라우저 수동 실행 필요 |
| 실기기·screen reader·최종 수동 UX | NOT TESTED | 환경 후속 #517. 승인 장비/접근성 환경에서 별도 기록 |
| 운영 source SHA/application version·proxy 입력 상태 | BLOCKED / NOT TESTED | 환경 후속 #517. 승인 운영 환경 metadata 접근이 제공될 때 read-only 비교; 운영 mutation 금지 |

GitHub Actions PASS는 위 환경별 항목을 자동 PASS로 승격하지 않는다.


### #502 → #517 환경 검증 이관

#502는 자동화 가능한 실제 React error boundary 검증을 PR #516으로 수렴시킨다. native125%·실기기/screen reader·최종 수동 UX·승인 운영 source/version/reverse proxy 검증은 lifecycle finalize와 실제 환경 PASS를 혼동하지 않도록 [#517](https://github.com/planner77/masterGantt/issues/517)로 이관한다. #502 merge/close는 #517 PASS를 의미하지 않는다.


## Issue #523 Resource KPI 공통 Domain 회귀

`tests/domain/resource-kpi.test.ts`와 `tests/fixtures/resource-kpi.ts`는 Task1/Resource2/Assignment2 grain,4근무일×50%=2M/D, Resource WORKING override와 필터 제외 Group Calendar/충돌, 복수 Group/Role 비가산, Resource/Group별 Milestone+미지정 raw 합, full-stage Ready/Blocked, duration 가중 진척과 canonical 완료, T0 미배정·Group-only·미설정 Task/Assignment ID, empty/all-unset/partial/비근무일0/분모0, M/M omission/null/invalid query/ENV와 순열·중복·필터 교집합을 검증한다. fixture는 실제 Task Calendar 근무일과 일치하는 기간/Duration 및 Assignment 부분기간, 한 날짜 Milestone을 사용한다.

`tests/server/resources/resource-kpi-compatibility.test.ts`는 native in-memory SQLite의 실제 Workload Service에서 legacy4자리1.3333 M/D/0.0702 M/M와 raw precision을 구별한다. 기존 Resource Workload service/integrity, Milestone calculation, Logistics fixture와 Calendar/Stage Gate tests를 Local Fast Feedback으로 함께 실행한다. 최초 raw float literal assertion4건 FAIL 및 canonical fixture 정렬 후 stale 기대값2건 FAIL을 수정하고 재실행 기록을 보존한다. Local PASS는 PR quality/e2e/docker PASS를 대체하지 않는다. HTTP/UI 신규 검증은 후속 단위이며 이번 Issue는 원격 PR CI 시작까지만 진행한다.


## Issue #524 Resource Dashboard SQLite·HTTP·브라우저 검증

`tests/fixtures/resource-dashboard.ts`는 #523 고정 입력을 native SQLite/public UUID로 적재한다. `tests/server/resources/resource-dashboard.test.ts`는 raw 합계·Task/Resource/Assignment grain, Resource/Group Milestone partition, 같은 Assignment 교집합, Group/Resource 활성 조건의 같은 Group membership, Resource/Task/WBS/연결Group 검색과 T0 분모, null/partial/0/M/M, compact selector/page, full Ready/Blocked 및 row assignmentRange를 직접 HTTP/Service로 확인한다. 다른 Project/미연결 개인·Group 전체 멤버·private description을 노출하지 않으며 비활성 기존 Assignment는 보존한다.

한 SQLite read transaction/clock1회, 별도 WAL 연결의 중간 변경에 대한 snapshot 일관성, revision bump 없는 Task/Link/Membership/Calendar/Catalog/Assignment 변경 및 Task 삭제 stale409, GET 전후 원본 Task/Link/Assignment/Calendar/revision 불변, SQLite 재시작 identity를 검증한다. Calendar bulk reuse/선택에서 숨긴 Group Calendar·same-layer 충돌도 확인한다. Query/ID/date/검색/page/selector 한도와 실제100개인×50Milestone/5000Assignment의 cell 폭발,320단계 WBS, 과다 Group 소속/반복은422로 실패하며 절삭하지 않는다.

실제 SQLite benchmark는 Task1011/개인Assignment1005/Group8/365일260근무일을 사용한다. timing/reportBytes는 선택 환경변수 RESOURCE_DASHBOARD_BENCHMARK_OUTPUT의 로컬 JSON 근거로 기록하며 로컬 기준3000ms 안에서 측정한다. 이 수치가 원격 CI나 운영 성능 PASS를 뜻하지 않는다. 전체 원격회귀는 PR quality/e2e/docker가 담당한다.

`tests/e2e/resource-dashboard-api.spec.ts`는 격리 실제 Next/SQLite/Chromium에서 편집 쿠키 없는 public report/detail, no-store/nosniff,405 mutation 거부, selection400, 원본 revision 불변, 실제 서버 재시작 snapshot과 scope/환산 stale409를 검증한다. 초기 실패 이력은 inventory 예상 route2개 누락, Turbopack 외부 node_modules symlink 거부, 신규테스트 비밀번호의 기존12자상한 위반, report nosniff 누락을 보존한다. route expected inventory·작업tree 실제 dependencies·유효 fixture·신규handler 성공/오류 nosniff를 보완하고 동일 관련 범위를 다시 검증한다. 최종 실행 결과는 Manager Issue/PR Work Packet에 exact head 근거로 기록하며 원격 CI 결과 모니터링은 이번 범위 밖이다.

## Issue #538 — Project master 계층 검증

- DB migration 0024: 이미 연결된 조합 중복 제거, 부분/legacy row의 무추정·무변경, FK/category/parent 보호, checksum/rollback.
- Unit/Service: 사업부 A/B에 제품 공유, 사이트 다중 조합, product-only/site-only 거부, 다른 사업부/조합 사이트 거부, 중복 링크 no-op revision, 사용/하위 연결 관계 unlink 409, inactive, 잘못된 UUID/category.
- Project API: create/update/template의 서버 직접 유효성 검증, 기존 project의 legacy/비활성 참조 조회·이름만 수정 및 copy 보존, 400/401/403/409/412 시 transaction 원자성.
- 관리자 API: 세션/Origin/If-Match/ETag/revision 동기화, stale 탭, 로그인 만료, 409 메시지.
- Browser: 관리자 항목/관계 영역 연결·해제 확인, 프로젝트 사업부/제품 변경에 따른 후보/초안 초기화 및 status 안내, 재선택, inactive 이전값, 390/768/1024/1440/wide, keyboard/focus/overflow.
- 해당 PR head의 공식 quality/E2E/docker GitHub Actions 증거가 최종 판정이며, 문서나 변경 코드만으로 PASS라고 하지 않는다.

### Issue #538 CI 보완: metadata-only viewport drift

Native Gantt가 canonical metadata 동기화 중 120→91 같은 비영(非零) scroll 이동을 수행해도 geometry/scope/columns/scale이 같고 사용자 입력이 없는 경우 public `scroll-chart`로 정확한 좌표를 복원한다. `metadataViewportRestoreTarget` unit은 nonzero, partial, zero, invalid 상태를 검증한다. 기존 `tests/e2e/task-editor-form-density.spec.ts` #456 테스트가 fullscreen/WBS 탭·tree·column·selection·vertical/horizontal scroll 동시 보존을 exact-head Chromium에서 확인한다.
