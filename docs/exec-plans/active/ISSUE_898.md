# Issues #898 / #899 — 실제 Ctrl+휠 입력 및 조회 View Task 시작점 Reveal 통합 Work Packet

- Primary: https://github.com/planner77/masterGantt/issues/898
- Related: https://github.com/planner77/masterGantt/issues/899
- 기준: main `4aad8865972e3446f0d34c7ffcfd2bbab439e366` (2026-11-09), 앱 0.145.1, 설치 @svar-ui/react-gantt 2.7.3.
- 작업 브랜치: `fix/issue-898-899-gantt-input-reveal`; PATCH 후보 `0.145.2`. 본 PR은 병합·Main CI·정식 GHCR 게시/태그·Issue 종료를 포함하지 않는다.
- risk_level: HIGH / risk_reason: Ctrl+wheel 브라우저 기본 확대 차단과 네이티브 Core·조회용 수평 스크롤의 실제 pointer hit-test·선택/Editor 경합 및 소스 freshness에 직접 영향.
- qa_method: OWNER_MANAGED; QA_REQUIRED: true; qa_required: true; release_required: true; release_authorized: false; manager_decision: NOT TESTED; MERGE_READY: BLOCKED.
- 새 PR HEAD/Full Required Quality·Chromium E2E8·Docker/Trusted/Owner/Preview UAT 검증은 PR CI 실행 완료 전 **NOT TESTED**; 운영 Chrome/Edge 일반 마우스·하이브리드/터치·브라우저 기본 배율 별도 UAT 필요.
- 소유 경계: 입력 이벤트·메시지/뷰 표시만 수정. 원본 Task/Links/Assignment/Equipment/Project Revision·DB/API/인증·SVG/JSON/Excel·SVAR Core 라이브러리와 기존 0.145.1 GHCR digest는 불변.

## 분석 / 원인과 구분

### #898
`src/features/gantt/gantt-density.ts`의 기존 body selector는 렌더링된 특정 Grid row/bar/후손 위주였고 포인터가 Chart 빈 부분·Grid 여백·scroller overflow 층에 있을 때 event.target이 매치되지 않을 수 있었다. `project-gantt.tsx`의 `wheel` capture listener는 매치 실패 시 `preventDefault`하지 않으므로 Grid에서 브라우저 Page Zoom을 유발할 수 있다. **이는 소스 기반 원인 후보이며 현재 운영 장치의 event target/cancelable/coarse 실제 계측은 없다.** 기존 #822의 제한된 실제 pointer 회귀와 #889의 synthetic dispatch가 모든 실마우스 위치를 덮지 못했다. 비취소 가능 이벤트는 차단 성공으로 허위 승인하지 않는다.

### #899
`schedule-view-panel.tsx` Grid Task 이름의 `onClick`이 `openTask(id)`로 직접 연결되며 이는 선택 직후 Editor를 연다. 조회 View에는 WBS `TASK_REVEAL align:start`에 대응하는 자체 scroller 정렬이 없다. Resource·설비 View는 WBS와 별개 readonly projection이므로 현재 보이는 `viewRowKey` 행의 `row.start`를 `axis.start`·`pixelsPerDay`로 변환하여 해당 projected scroller만 움직여야 한다.

## REUSE_REVIEW

- REUSE_DECISION: EXTEND

사용자 현재 요청의 “각 단계에서 이전 단계 결과를 재활용할 수 있으면 재활용”이라는 명시적 범위에 따른 승인이다. 이전 #895의 공통 재사용 정책 및 #896/#897 증거/Preview 기능은 대체하거나 우회하지 않는다.
- REUSE_CANDIDATES: #822 density engine/frame listener, #880/#889 조회 panel·fixture·bookmark, #852 native start-align 의미, #896 UI Evidence helper와 #897 Preview UAT.

  1. #822 `createDensityWheel`·`nextDensityLevel`·기존 frame capture listener/입력 lease: 로직/버스트/프로필 그대로 확장.
  2. #880/#889 `ScheduleViewPanel`, source GET/receipt·projection/`viewRowKey`·bookmark·native axis/한 scroller/Editor canonical 진입: 신규 Core scroll writer 없이 확장.
  3. #852 WBS `TASK_REVEAL align:start` 사용자 의도와 #889 스크롤/선택/resize/cellHeight 일관성: 설계 의미만 재사용, 숨긴 WBS viewport 직접 변경 금지.
  4. `tests/e2e/schedule-views.spec.ts`의 실제 HTTP/SQLite `seedScheduleViews`, `tests/e2e/project-summary-bar-visual.spec.ts`의 물리 `Control+page.mouse.wheel`, #896 `captureSyntheticUiEvidence`·geometry/manifest: 기존 테스트/증거의 출처를 유지하며 현재 소스에서 다시 실행.
- REUSE_CONDITIONS: Source SHA/fixture/상태/화면 캡처/테스트 assertion의 출처를 추적; #822/#889 과거 PASS는 새 Head를 자동 승인하지 않음. 기존 실사용 Core 2.7.3 외 새 Gantt 구현, 새 서버/DTO, 별도 Preview/Playwright 엔진, test skip·timeout 완화, global wheel preventDefault 금지.
- REUSE_OWNER_EVIDENCE: Issues #898/#899·본 사용자 통합 PR 및 결과 재사용 요청; #895 완료 이슈의 범위 정책. 별도 신규 구현 승인 사항은 없음. #896 증거가 새 기능 AC를 자동 승인하지 않음.

## 설계 및 구현 계약

1. **실제 입력 소유권:** 하나의 `.project-gantt-frame` `wheel` 캡처 `{capture:true,passive:false}`에서 현재 활성 WBS·Resource·설비 가시 body(행/bar, 여백, 차트 빈 영역/scroll layer)만 처리. `clientX/Y`/target/현재 body 가시 경계를 함께 판정하며 header/toolbar/input/Editor/dialog/menu/외부는 제외. 유효하고 `cancelable=true`인 첫 이벤트에서만 `preventDefault`; noncancelable은 성공 가정 금지. 34/32/30/28px·coarse44px/accumulation/RAF lease 유지. 수평 시간축 확대나 글로벌 Zoom hook은 추가하지 않는다.
2. **조회 단일 클릭:** Resource/설비 Task Grid 셀/작업명 클릭 시 canonical ID만 선택하고 현재 `viewRowKey` 클릭 경로를 bookmark로 저장. Editor 자동 열기 금지. 날짜가 존재하고 현재 scroll capacity가 충분하면 보이는 Bar 시작점/고정 Grid 오른쪽 경계의 오차 목표 ≤1 CSS px. 중복 할당의 동일 canonical Task는 모두 선택 표시, 클릭한 표시 경로는 별도 유지.
3. **Editor 명시 진입:** Grid 더블클릭 또는 별도 포커스 가능 `작업 정보 열기` 아이콘 버튼(Enter/Space/터치), Chart Bar 클릭은 기존 `props.onOpenTask` 경로를 사용. 새로운 편집/권한 경로가 아닌 기존 single canonical Task Editor 사용. 그룹/유형/모델/설비 row는 열고 접기만 유지.
4. **측정 불가능:** `projectedTaskReveal` typed 상태 `ALIGNED | NO_DATE | NO_SCROLL_CAPACITY | NOT_MEASURABLE`, 현재 scrollWidth/clientWidth 내 한 번만 제한하고 축 범위 변경/무한 scroll/false PASS/자동 Editor fallback 금지. 스크롤 이벤트/bookmark·react rendering/source request receipt/사용자 의도 우선. 테스트 전용 last-reveal 행/결과를 DOM data attribute로 표시하되 업무 데이터 저장·로그·API 변경 없음.
5. **GSC/비변경:** readonly 조회의 server write=0, Project canonical snapshot/revision/selectedTaskIds, WBS 실제 SVAR Core instance, hidden native Grid state 및 public API/GSC-04/05/07/08, Day/Week/locale/fullscreen/collapse/virtualization/keyboard 유지.

## TEST_LIFECYCLE_REVIEW

- EXTEND: `tests/e2e/schedule-views.spec.ts` (#880/#889 실제 HTTP/SQLite, 중복경로, Reader/read-only, 5폭/Day·Week/Fullscreen 및 synthetic wheel)에 **실제 pointer Control+mouse.wheel**, 브라우저 page zoom 및 조회 클릭 후 좌표/Editor/원본 write=0를 추가. 기존 #880 Editor-Enter 경로는 새로운 명시 정보 버튼에서 계속 PASS해야 하며 제거하지 않는다.
- KEEP_UNIQUE: `tests/e2e/project-summary-bar-visual.spec.ts` (#822 WBS 실제 pointer/34↔28px/bar 및 Summary geometry), `tests/e2e/project-gantt-fullscreen.spec.ts`, `tests/e2e/i18n.spec.ts`, `tests/features/gantt/gantt-density.test.ts` (#822 wheel accumulation·clamp), `tests/e2e/schedule-views.spec.ts` 기존 개별 수용 항목. 스크린샷·합성 WheelEvent 성공은 물리 pointer page zoom 방지의 대체 증거 아님.
- ADD: `tests/features/gantt/schedule-view-reveal.test.ts` (정확 날짜 좌표·capacity 경계·없는 날짜/미측정 typed 분류)만 신규 생성; 다른 data/schema/보안 테스트는 중복하지 않는다.
## AC_TEST_COVERAGE

- AC01: #898 WBS·Resource·설비의 실제 Ctrl+wheel Grid/Chart fine34↔28px·native geometry, 기존 #822/#889 및 새 schedule-views 물리 pointer E2E EXTEND; #899 조회 단일 클릭 차트 좌측 정렬은 동일 실제 HTTP/SQLite 시나리오.
- AC02: #898 실제 브라우저 Page Zoom 독립 측정(devicePixelRatio/innerWidth/visualViewport)과 취소 가능 wheel·(0,0) synthetic fallback·헤더 음성, density Unit·schedule-views/#822 E2E; #899 명시 Editor 더블클릭/Enter/Chart 동등 ID.
- AC03: #898 일반 wheel·Editor/input/header 외부 제외·burst/coarse, #822 고유 테스트 KEEP_UNIQUE; #899 중복 viewRowKey/실행 용량 부족·날짜 미산정 typed 분기 Unit과 Resource/Equipment 클릭 흐름.
- AC04: #898 기존 WBS Core identity·원본 snapshot/revision/readonly write0, #880/#889 HTTP/SQLite fixture 및 E2E, 신규 source/browser start CSS px 측정; #899 실제 mouse/keyboard/scrollLeft·선택 경쟁·원본 불변.
- AC05: #898 기존 물리 wheel E2E 및 #889 synthetic 차이를 분리하고 현재 정확 SHA #896 PNG/geometry/flow manifest 증거 재사용; #899 #895 재사용 출처와 인수 기준 연결, 기존 검증 삭제/skip 없음.
- AC06: #898/#899 AGENTS·DESIGN·UI_UX·PROJECT_UX·GSC·TEST_PLAN·Work Packet·누적 실패 원장 동기화; 신규 Ready Full PR Required Quality/E2E8/Docker, 기본 브랜치 Trusted QA·Owner/Preview UAT와 별도 릴리스 gate는 재실행 후에만 판정.

- AC #898-01/02: WBS·Resource·설비 × Grid/Chart 실제 `page.mouse.wheel`/Ctrl, 34→32→30→32→34 및 실제 변경 geometry/pageZoom 독립 확인. 별도 기존 #889 synthetic full cycle 34→28→34을 유지; 전체 3 View × 모든 포인터 위치 조합은 원격/운영에서 추가 확인.
- AC #898-03/04: body 이외 Ctrl+wheel·일반 wheel/Editor/툴바 제외; canonical/WBS instance 및 server writes0. 기존 #822/#889 회귀를 함께 사용.
- AC #899-01/02: Resource/설비 단일 클릭→bar left와 sticky split right 오차 ≤1 CSS px, Editor 닫힘. 더블클릭/명시 버튼 Enter/Chart 클릭으로 같은 canonical Editor 접근.
- AC #899-03/04: 복수 소속·설비 조회 projection·원본 동일, 날짜·스크롤 용량/80+행/늦은 응답 및 UI 폭·Day/Week/Fullscreen은 기존 fixture/추가 Unit와 현재 source 검증. 빠른 입력 경합/실기기 실제 UAT는 미실행 시 NOT TESTED.
- AC #898/#899-05/06: #896 UI 증거 출처·manifest와 #897 Preview UAT 별도, 필요한 문서·원장 동기화. Full PR Required Quality / Chromium E2E 8/8 / Docker 및 기본 브랜치 Trusted QA·Owner·MERGE gate를 기존 정책으로 실행한다.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `DESIGN.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/GANTT_STATE_CONSISTENCY.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_898.md`: UPDATED
- `docs/ISSUE_898_899_TEST_PLAN.md`: UPDATED
- `docs/ISSUE_898_899_FAILURE_ANALYSIS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(QA Trusted와 Owner Managed의 기존 통과 조건 및 역할 보호 정책 변경 없음)
- `docs/CI_CD.md`: N/A(Required3 E2E8 Docker와 workflow trigger 및 이미지 출처 정책 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(PR metadata 원본 규약을 준수할 뿐 CI 운영 절차나 권한 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(SHA Run Attempt E2E 실측과 운영 UAT의 구분 및 원격 검증 기준 불변)
- `docs/SCHEDULING_ENGINE.md`: N/A(조회 UI의 선택 스크롤 및 휠 대상만 변경하고 일정 계산 엔진 불변)
- `docs/API.md`: N/A(Project GET 읽기 경계 및 서버 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite 데이터 구조와 migration 변경 없음)
- `docs/SECURITY.md`: N/A(세션 권한 및 readonly API 쓰기 차단 계약 불변)

대용량 `docs/TEST_PLAN.md`의 기존 1.18MB 원문은 Git Blob SHA를 기준으로 손실 없이 읽어 맨 앞에 본 실패·재시험 계약만 추가했다. 상세 #898/#899 수용 커버리지는 `docs/ISSUE_898_899_TEST_PLAN.md`에도 보존한다.
## LOCAL_VALIDATION_SELECTION

- LOCAL_VALIDATION: 원격 Full #3606.1은 PR 메타데이터/QA Bootstrap 직접 FAIL, Quality/E2E8/Docker SKIPPED다. 수정 브랜치의 실제 로컬 Node/Chromium·full repo 검증 결과를 확보하지 못했으므로 Unit/E2E/typecheck/lint/실마우스/원격 CI 결과는 **NOT TESTED**. 이전 Head의 PASS·코드 리뷰/정적 검사/새 테스트 작성은 실제 실행 PASS를 뜻하지 않음.
## 검증 상태 / CI 인계

- CI 진입: 기존 PR #904/브랜치를 유지한다. #3606.1 실패 원인과 Codex P2 리뷰 반영/미해결 thread 해결/최신 main 충돌 검증 뒤, 수정 HEAD를 한 번 push하여 새 표준 Full PR CI를 시작하고 **완료 모니터링하지 않는다**. 수정 전 #3606.1의 결과는 새 HEAD에 전이하지 않는다.
- 후속 Gate: 실제 PR Head Required3/E2E8·Trusted·Owner/Preview UAT와 main exact OCI/정식 Patch tag/GHCR/Finalizer는 별도 확인 전 `BLOCKED/NOT TESTED`; 기존 0.145.1 tag/digest/FINAL 변경 금지.

## PR #904 — Full #3606.1 원인·보완 및 재개 (2026-11-09)

- 실패 source `77d79ef963beecbc2f4c2f46975701dea4d77008`, Run [42568402966.1](https://github.com/planner77/masterGantt/actions/runs/42568402966). 변경 경로 판정 Job `128999906441`의 `verify-ci-run-trace.py`가 PR 본문 canonical standalone `Refs #898` 없음으로 직접 FAIL, QA Bootstrap Job `128999906060`이 PR body의 독립 `qa_method: OWNER_MANAGED` 선언 없음으로 직접 FAIL. Fast Gate 실패와 Required3 aggregate 실패는 파생, 제품 Vitest/ESLint/TypeScript/E2E8/Docker는 SKIPPED.
- 리뷰 [P2 thread](https://github.com/planner77/masterGantt/pull/904/files) `PRRT_kwDOUUB7Bc61JB5u`: 좌표 없는 synthetic `WheelEvent`의 `clientX/Y=0`를 실제 포인터로 오인하는 회귀. `densityWheelPointer`에서 **untrusted && (0,0)**만 DOM fallback 처리; 신뢰된 실제 `(0,0)` 또는 좌표 있는 이벤트는 기존 body 좌표 검증을 그대로 수행. 동일 helper를 Native input lease와 capture wheel 모두 사용하고 Unit/기존 #822/#889 회귀를 유지한다.
- PR title의 Primary Issue `Issue #898` 하나, branch `issue-898-899` Primary 898, PR body canonical `Refs #898` 한 줄, 정규화된 위험/QA/릴리스 선언과 Work Packet REUSE_REVIEW/AC_TEST_COVERAGE/DOCUMENTATION_SYNC 구조로 수정한다. 이 변경은 CI 검증기 변경·문서 안전검사 완화가 아니다.
- 재사용: 이전 #822/#880/#889 Unit/E2E와 현재 실패 Run/Job, #896 원본 UI evidence helper. 검증 대상 새 Head의 전체 PASS·운영 기기·Owner/Trusted/UAT **NOT TESTED**; merge/release_authorized=false.

## PR #904 — Full #3608.1 REWORK: TestInfo identifier shadowing (2026-11-09)

- 이전 #3606.1 PR metadata·QA Bootstrap 직접 FAIL은 이번 [Full #3608.1 / 42573087287.1](https://github.com/planner77/masterGantt/actions/runs/42573087287)에서 관련 Jobs PASS로 해결 확인. 새 직접 실패는 `tests/e2e/schedule-views.spec.ts:891:44` TS2345 단 1건: `info: TestInfo` 인자를 for-loop 내부 `const info: Locator`가 가려 `captureSyntheticUiEvidence(page, info, ...)`의 인수 타입 불일치. QA Preflight/Vitest/ESLint/정책 PASS, Fast Gate/Required3/QA Final 파생 FAIL, Chromium8·Docker/Next Build는 SKIPPED.
- **REUSE_REVIEW (기존 EXTEND 승인 유지)**: #880/#889 `seedScheduleViews`/실제 SQLite/Project fixture·기존 편집 버튼, #896 `captureSyntheticUiEvidence`를 있는 그대로 재사용. 구현 수정은 로컬 중첩 변수 `info` → `openInfoButton`과 해당 2개 `focus/press` 참조만. 증거 helper API, 명시 선택/Editor UX, 테스트 assertion/timeout·CI 게이트 무변경.
- **TEST_LIFECYCLE_REVIEW / AC_TEST_COVERAGE**: 기존 `tests/e2e/schedule-views.spec.ts`를 `EXTEND`하는 #898 AC01~06 / #899 Grid start-reveal·Editor keyboard·3 View mouse wheel의 실제 검증 경로를 유지, 기존 #822 물리 휠/합성 취소·#889 density·#880 editor 회귀는 `KEEP_UNIQUE`. 이 Run의 E2E가 실행되지 않았으므로 신규 Head browser PASS·UI Evidence manifest/Preview Owner UAT는 NOT TESTED.
- **DOCUMENTATION_SYNC**: `tests/e2e/schedule-views.spec.ts` 변경과 본 Work Packet, `docs/ISSUE_898_899_FAILURE_ANALYSIS.md`, `docs/ISSUE_898_899_TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md` 갱신. `AGENTS.md`, `DESIGN.md`, `docs/TEST_PLAN.md`, UI_UX/PROJECT_UX/GSC 및 다른 정적 계약 문서는 직전 #898/#899 범위와 새 위험/AC가 동일해 변경 불필요·유효한 기존 Source를 그대로 재사용한다. 기존 #895 REUSE_DECISION=EXTEND, DOC_SYNC 경로 목록, 원본 #3606.1 실패 증거 보존.
- **Gate**: risk HIGH / qa_method OWNER_MANAGED / qa_required=true / release_required=true / release_authorized=false / MERGE_READY BLOCKED. 새 HEAD full Required3/8-shard/Trusted/Owner/UAT 및 실제 기기는 결과 확인 전 NOT TESTED; 이번 요청은 리뷰 0·충돌 0 확인 후 기존 PR #904에 변경사항 한 번에 push하여 Full PR CI를 **시작**하는 데서 종료(완료 모니터링 없음).

## PR #904 — Full #3609.1 E2E Shard3 R3 포커스 복귀 REWORK (2026-11-09)

- **정확 원본**: [Run 42579764884.1](https://github.com/planner77/masterGantt/actions/runs/42579764884), Head `0c030acb85878b97b7880c46ce40fd65df6cf6b6` / main `4aad8865972e3446f0d34c7ffcfd2bbab439e366`. Typecheck/ESLint/Vitest/Policy/Build/Docker, QA Preflight PASS, Chromium 6/8 PASS, shard3 기존 #880 Editor Escape focus assertion 직접 FAIL, 나머지6 CANCELLED/NOT TESTED, E2E 집계/QA Final 파생 FAIL. 최초 두 PR CI 실행의 실패·보완은 위 절/누적 원장 보존.
- **REUSE_REVIEW**: 기존 사용자 EXTEND 승인/후속 재활용 요청을 적용. #880의 `finishTaskEditor` schedule-row recovery·MutationObserver/입력 lease/6초 종료, #899의 `data-schedule-task-open`/원본 Task Editor, #880/#889 실제 HTTP SQLite/Playwright+ #896 evidence를 먼저 조사. 별도 모달/포커스 유틸·두 번째 state writer 불필요.
- **직접 원인 및 설계**: 분리된 조회 Grid의 선택 버튼이 `row.querySelector("button:not(:disabled)")`의 첫 요소가 되어 명시적 정보 버튼에서 연 Editor 종료 시 호출 버튼이 아닌 선택 버튼으로 복원되는 불일치. `editorTriggerReference.current`가 같은 유효 row 내 활성 버튼이면 우선 포커스; 원래 호출 버튼 DOM 교체 시 버튼 역할별 우선 탐색(정보/Chart/선택)→기존 첫 버튼/scroll root 안전 fallback. 기존 source-ready·rowKey/canonical·dialog closed·사용자 입력 세대/관계는 유지.
- **TEST_LIFECYCLE_REVIEW**: `tests/e2e/schedule-views.spec.ts` #880 테스트 원본(Enter→Editor→Escape→`toBeFocused`) 유지, #899 실제 새 다중 View/Chart test를 EXTEND해 정보·Grid select·Chart bar 세 호출 경로 각각 focus restore 검증. 기존 test skip/삭제/timeout/retry 완화·UI evidence 수정 없음. 오류 고치기 위해 기존 assertion을 약화하지 않음.
- **AC_TEST_COVERAGE**: #898-AC01~AC06 real wheel/Page Zoom 검증 및 #899-AC01~AC06 click reveal/Editor/원본 쓰기0/기기·스냅샷은 기존 Work Packet 그대로; 추가 focus 검사로 Editor 명시 진입/사용자 gesture 보호를 보완. 신규 exact source Chromium shard3 및 타7/Required3 전체 PASS까지 MERGE_READY=BLOCKED.
- **DOCUMENTATION_SYNC**: `docs/TASK_EDITOR.md`에 Editor 종료 후 원본 버튼 역할 중심 포커스 복원 명시, `docs/ISSUE_898_899_TEST_PLAN.md`·[누적 원장](../../ISSUE_898_899_FAILURE_ANALYSIS.md)·이 Work Packet·`docs/exec-plans/active/PLAN.md` 동기화. `AGENTS.md`/`DESIGN.md`/`docs/PROJECT_UX.md`/`docs/UI_UX_GUIDELINES.md`/`docs/GANTT_STATE_CONSISTENCY.md` 정책 자체는 앞선 수정 계약과 동일·재사용. 다른 API/DB/security/CI 검증기·Release 정책 불변.
- **검증 경계**: 로컬 Chromium/CI에 대한 신규 실행 결과는 확인 전 `NOT TESTED`; 사용자 운영 Chrome/Edge/포인터 종류별 UAT, #897 Preview 수용 별도. 이 단계는 같은 PR #904의 단일 HEAD로 코드/테스트/원장 반영 및 새 Full PR CI **시작**까지만, CI 완료 감시/병합/GHCR/Issue close 금지. `HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false` 유지.

## PR #904 — Full #3610.1 REWORK: virtualized End/Arrow focus (2026-11-09)

- [Run #3610.1](https://github.com/planner77/masterGantt/actions/runs/42596598153) / HEAD `ab62ff3e38e060f7e19965431777ca1675ba6606`: Required Quality·Docker, metadata/QA preflight, Vitest, TypeScript, ESLint, Next Build PASS. Chromium shard3 기존 #880 85 Task End→마지막 084의 정보 버튼 focused 직접 FAIL, 다른 7 shard CANCELLED/NOT TESTED, E2E aggregate 및 QA Final 파생 FAIL. 직전 #3609.1의 Task Editor Enter/Escape focus 경로는 이번 동일 실행 PASS.
- **REUSE_REVIEW=EXTEND 유지**: 기존 #880 `navigateRow`·로컬 virtualizer/rowKey·scroll owner, #899의 정보 버튼 속성 `data-schedule-task-open`, #880/#889 실제 HTTP+SQLite/Playwright fixture와 #896 evidence를 우선 재사용. 별도 키보드 컨트롤러/원본 데이터 writer/시간축 확장 금지.
- **원인과 수정**: `navigateRow`가 첫 `button:not(:disabled)`를 찾는데 #899 분리 후 첫 요소가 선택 버튼이 됨. Task는 같은 viewRowKey의 명시 `data-schedule-task-open` 활성 버튼 우선, 그룹은 기존 expand/collapse 첫 버튼, 부재 시 기존 활성 버튼 fallback. 1회 RAF에 `userIntent` guard를 넣어 후속 사용자 입력이 선행 focus를 덮지 않도록 함. Server write·WBS Core·캐노니컬 TaskId/permissions·source freshness 불변.
- **TEST_LIFECYCLE_REVIEW / AC_TEST_COVERAGE**: #880 `schedule-views.spec.ts:319-389`의 End·Home·가상행 수/2초·WBS 왕복·쓰기0는 KEEP_UNIQUE. 동일 테스트를 EXTEND하여 084 End→083 ArrowUp→084 ArrowDown과 정확 정보 버튼 focus를 검증. #898 AC01~06 real wheel/zoom 및 #899 AC01~06 단일 Grid select/reveal·명시 Editor/readonly는 원래 계약 유지. Test skip/timeout/retry/shard·Required3·Trusted/Preview/Owner 기준 불변.
- **DOCUMENTATION_SYNC**: `src/features/gantt/schedule-view-panel.tsx`, `tests/e2e/schedule-views.spec.ts`와 Work Packet·`docs/ISSUE_898_899_FAILURE_ANALYSIS.md`·`docs/ISSUE_898_899_TEST_PLAN.md`·`docs/exec-plans/active/PLAN.md`·`docs/TASK_EDITOR.md`를 동기화. 기존 `AGENTS.md`, `DESIGN.md`, `docs/TEST_PLAN.md`, GSC·UI/UX·Project UX 문서의 원칙 및 원본 테스트는 그대로 재사용. 기존 `DOCUMENTATION_SYNC` 선언·AC01~06 매핑을 변경/우회하지 않는다.
- **Gate**: 동일 PR #904 정확 새 HEAD의 미해결 리뷰0·main 충돌0 검증 뒤 Full PR CI 시작, 완료 모니터링·병합/Main/GHCR/Issue 종료 없음. HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false/MERGE_READY BLOCKED. 새 HEAD 검증 및 운영 실기기/Owner UAT `NOT TESTED`.
