# Issue #891 — 공통 Markdown 편집 UI 실패·재작업 원장

Primary: https://github.com/planner77/masterGantt/issues/891

기준 main은 `9a98265ea7526feb2d589461146312e439206167`/0.146.0이다. 현행 로컬 검증·direct Push·고유SHA GHCR·수동 종료 경로를 사용한다. PR/원격 CI/Trusted/Finalizer 신규 실행은 N/A다. [Work Packet](exec-plans/active/ISSUE_891.md)의 범위·소유권·AC/테스트·환경 경계를 따른다.

최초 FAIL/BLOCKED/취소와 후속 source/수정·재시험 결과를 삭제 없이 아래에 누적한다. 작업 중 SCOPED 성공은 최종 exact source admission이나 게시 성공이 아니다. 제품/fixture/환경/정책/UNKNOWN을 구분하고 command/exit·실제 시각·source/환경·정제 artifact·잔여 위험을 기록한다.

## F891-001 · baseline 합성 프로젝트 생성 전 catalog ready 대기 누락

- 단계/판정: LOCAL_PREP / FAIL, 실제 `node /tmp/issue891/baseline.cjs` exit1. 개별시각 미수집(2026-11-14 담당자 보고), 기준 UI9a98265e·작업 중 diff fingerprint 미수집(SCOPED).
- 기대: 합성 Project/Issue/Task를 준비하고 변경 전 실제 geometry를 수집한다. 실제: POST0, 생성 폼이 거부해 waitForURL30s timeout/exit1. 제품 assertion 실패 또는 HTTP/SQLite 검증 실행 증거가 아니다.
- 원인/교정: baseline 합성 프로젝트 생성 전 catalog ready 대기 누락. waitForProjectMasterCatalogReady/submitProjectAndExpectCreated 재사용. 원본 로컬 로그는 `LOCAL:issue891/baseline-harness`에 보존하고 다음 성공은 별도 event로 추가한다. 전체 baseline/제품/게시 검증은 NOT TESTED다.

## F891-002 · baseline 단발 진단 context locale 미고정

- 단계/판정: LOCAL_PREP / FAIL, 실제 `node /tmp/issue891/baseline.cjs` exit1. 개별시각 미수집(2026-11-14 담당자 보고), 기준 UI9a98265e·작업 중 diff fingerprint 미수집(SCOPED).
- 기대: 합성 Project/Issue/Task를 준비하고 변경 전 실제 geometry를 수집한다. 실제: en-US 기본 context에서 Korean owner locator timeout/exit1. 제품 assertion 실패 또는 HTTP/SQLite 검증 실행 증거가 아니다.
- 원인/교정: baseline 단발 진단 context locale 미고정. ko-KR 고정 및 기존 fixture 준비 재사용. 원본 로컬 로그는 `LOCAL:issue891/baseline-harness`에 보존하고 다음 성공은 별도 event로 추가한다. 전체 baseline/제품/게시 검증은 NOT TESTED다.

## F891-003 · baseline harness의 사업부 선택 label을 실제 accessible name과 다르게 지정

- LOCAL_PREP / FAIL: `node /tmp/issue891/baseline.cjs` exit1. 로그mtime 약2026-11-13T22:22~23Z, exact 시작/종료시각 미수집. UI baseline9a98265e·작업중 diff fingerprint 미수집(SCOPED).
- 기대는 baseline fixture 준비 완료이며 실제는 exact 사업부 locator30s timeout. 원문 `LOCAL:issue891/baseline-harness` 보존.
- 교정: 기존 waitForProjectMasterCatalogReady와 실제 catalog control id 재사용. 제품 API/runtime 계약은 유지하며 반복 fixture 준비 오류와 실제 제품 assertion FAIL을 구분한다. 전체 baseline/최종 source 검증은 미완료다.

## F891-004 · baseline milestone 생성 fixture의 필수 duration0 누락

- LOCAL_PREP / FAIL: `node /tmp/issue891/baseline.cjs` exit1. 로그mtime 약2026-11-13T22:22~23Z, exact 시작/종료시각 미수집. UI baseline9a98265e·작업중 diff fingerprint 미수집(SCOPED).
- 기대는 baseline fixture 준비 완료이며 실제는 실제 API400 거부; 앞 Task/Summary4개 생성 성공. 원문 `LOCAL:issue891/baseline-harness` 보존.
- 교정: 기존 Task create contract의 milestone duration0 적용. 제품 API/runtime 계약은 유지하며 반복 fixture 준비 오류와 실제 제품 assertion FAIL을 구분한다. 전체 baseline/최종 source 검증은 미완료다.

## F891-005 · baseline harness가 Milestone을 일반 WBS Grid에서 검색

- LOCAL_PREP / FAIL: `node /tmp/issue891/baseline.cjs` exit1, exact시각 미수집(2026-11-14 run4/run5 담당자 보고). UI9a98265e+version/docs WIP(SCOPED), diff fingerprint 미수집.
- 실제: 일반WBS에Milestone행이없어locator timeout/exit1. 원본 로그 `LOCAL:issue891/baseline-harness` 보존.
- 교정: 기존 Dashboard navigation·UUID검색·상세 열기 helper 재사용. 제품계약·일반WBS Milestone비노출·MDX placeholder는 바꾸지 않는다.

## F891-006 · 빈 MDX placeholder와 실제 contenteditable에 동일 class가 있어 단일 locator가 중복

- LOCAL_PREP / FAIL: `node /tmp/issue891/baseline.cjs` exit1, exact시각 미수집(2026-11-14 run4/run5 담당자 보고). UI9a98265e+version/docs WIP(SCOPED), diff fingerprint 미수집.
- 실제: strict locator2개 매칭/exit1; 앞 geometry수집은 일부완료. 원본 로그 `LOCAL:issue891/baseline-harness` 보존.
- 교정: 실제 [contenteditable=true] 본문으로 대상 제한. 제품계약·일반WBS Milestone비노출·MDX placeholder는 바꾸지 않는다.

## baseline run6 후속 — F891-001~006 준비 오류 교정

실제 `node /tmp/issue891/baseline.cjs` exit0으로 동일 합성10종(Task/Summary/Milestone×단/장문6, 신규/기존Issue×단/장문4)×1440폭/900·1200·1600높이의30geometry를 수집했다. Task높이810/896/896px·폭1120px, Issue높이792/864/864px·폭736px다. 원본JSON SHA256 `f6902c0b60dafdbd8177d0e8458c9217d8212d66495102e876b536991d872ec7`, 로컬 `LOCAL:issue891/baseline.json` 및 beforePNG를 보존한다.

Editor/host/CSS 제품bytes는9a98265e와 같지만 version/docs는Manager WIP0.147.0이므로 clean전체baseline이 아닌 SCOPED UI기준이다. 신규제품코드·최종source·필수gate·GHCR PASS로 승격하지 않는다. 낮은화면 viewport안전상한을 지키고 tall1600px에서 Task1344px/Issue1296px(1.5×)를 목표로 한다.

## F891-007 · toolbar overlay React hooks 정적 검사 실패

- STATIC/FAIL, 담당자보고2026-11-13T22:34경(exact시각 미수집), UI baseline9a+제품WIP(SCOPED). 실제 `npm run typecheck && npx eslint src/features/markdown/*.tsx src/features/markdown/description-translations.ts` exit1. typecheck는PASS, ESLint는immutability(dataset prop수정)·set-state-in-effect(host생성후setOverlay)2FAIL이다.
- DOM메서드와stable callbackref로host부착을교정하고검사규칙은유지한다. 후속scoped lint/최종clean source는별도실행전까지미완료다. 원본은 `LOCAL:issue891/frontend-static-feedback` 담당자실행에연결한다.

## F891-008 · wrapper resize 높이가 실제 본문에 전달되지 않음

- PLAYWRIGHT / 제품FAIL. qa891 별도WIP진단(2026-11-14, exact시각 미수집), `node LOCAL:qa891/wip-resize-probe` 관측exit0. 31891합성public신규Issue·1440×1200·쓰기0에서native우하단drag가wrapper256→439→542px만바꾸고Richcontenteditable184px·Sourcecm-editor184px/cm-scroller28.796875px는그대로였다. 관측스크립트성공은AC03 PASS가아니다.
- 원인은mdxeditor display:block과미완성flex/height chain이다. 설치4.3.3공식mdxeditor-full-height opt-in을확인하고Rich/Source의실제가용본문높이·내부scroll까지검증한다. wrapper geometry만으로resize성공을판정하지않는다. 교정후실제결과와최종source gate는별도event로추가한다.

## F891-009 · 블록 선택기의 visible placeholder에 전체 툴팁 suffix를 넣어 인접 아이콘과 겹침

- VISUAL / FAIL. ux891가 WIP after PNG에서 실제 겹침을 확인했다. 프로세스 exit는 없는 시각 도구 관측이며 원본은 `LOCAL:issue891/after-task-short-900.png`다.
- 교정: 짧은 visible placeholder와 전체 tooltip/aria를 분리한다. 제품코드 WIP이며 최종source/geometry/keyboard 검증을 별도로 요구한다.

## F891-010 · native disabled Undo/Redo에 keyboard tooltip 접근 대안이 없음

- PLAYWRIGHT / FAIL. 별도 ux891/qa891의 WIP 진단이며 최종 source와 구분한다. 실제: 빈 Issue390x900의 role=radio Undo/Redo가 disabled=true/tabIndex=-1; focus 호출 후 실제focus=false/tooltip0.
- 명령/도구: `node <<'NODE' / standalone Playwright diagnostic stdin`, exit0. disabled 진단은 UTC2026-11-13T22:30~22:31, exact개별시각 미수집. 관측명령 exit0은 제품AC PASS가 아니다.
- 교정: native disabled 명령 차단을 보존하고 포커스 가능한 설명과 상태/Tab 전환을 검증한다. 초기 QA의 getByRole(button) 진단은 실제 Undo/Redo role=radio와 달라 timeout/exit1였으며 CSS selector로 교정해 위 제품 결함을 관측했다. 이 selector 준비 실패와 실제 제품 실패를 구분한다.

## F891-011 · 독립 UI CLI의 browser revision 불일치

- LOCAL_PREP / BLOCKED: ux891의 Playwright CLI browser 기동이 최신CLI revision1254 요구와 repository 고정Playwright1.63.0/revision1243 차이로 수행 불가했다. exact시각·exit는 담당자보고에 미수집이다. 기존 앱 browser·테스트·운영환경은 바꾸지 않았다.
- 독립 QA는 이미 기존1243으로 실제 WIP제품을 관측했고 최종frontend테스트도 같은 고정환경을 사용한다. CLI변경으로 제품gate를 우회하지 않으며 ux891의별도browser수행은미실행으로남긴다. PNG/설치API/30geometry 비교와 실제1243제품검사는 서로 구분한다.

## F891-012 · 공개 HistoryExtension API의 필수 TypeScript generic 누락

- STATIC / FAIL, 실제 `npm run typecheck` exit1. frontend891 작업중 SCOPED 결과이며 exact개별시각 미수집이다. 실제: 공개 getPeerDependencyFromEditor 호출의 타입오류3개; adapter typecheck FAIL.
- 교정: 공식 d.ts의 <typeof HistoryExtension> generic을 지정하고 타입규칙은 유지한다. 원본은 `LOCAL:issue891/test-toolbar1.log`와실패trace 및담당자정적검사에보존한다. 테스트준비실패를toolbar PASS로세지않으며최종clean source검사는별도다.

## F891-013 · baseline 공유 합성 서버에 프로젝트 생성이 누적돼 rate limit 도달

- PLAYWRIGHT / FAIL, 실제 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-task-editor-persistence.spec.ts --grep Issue #891 task toolbar` exit1. frontend891 작업중 SCOPED 결과이며 exact개별시각 미수집이다. 실제: test-toolbar1 프로젝트생성429/RetryAfter2879, 원본 assertion FAIL; 제품toolbar 검증 전 fixture 준비 실패.
- 교정: 기존 isolatedApplication fixture로 서버/SQLite를 격리해 재실행하며 rate limit 정책은 바꾸지 않는다. 원본은 `LOCAL:issue891/test-toolbar1.log`와실패trace 및담당자정적검사에보존한다. 테스트준비실패를toolbar PASS로세지않으며최종clean source검사는별도다.

## F891-014 · Escape 뒤 내장 tooltip 잔존

- PLAYWRIGHT / FAIL: 실제 `Issue #891 task toolbar labels, actual shortcuts, locale history and vertical resize` 1caseFAIL/exit1. `LOCAL:issue891/test-toolbar2.log`와원본trace보존. helper131행에서Escape뒤tooltip기대0/실제1로5000ms실패했다. 개별exact시각미수집·작업중SCOPED다.
- custom keyboard tooltip과내장Radix의억제/close전환을진단해같이닫고상위Dialog를보존해야한다. 원본assertion이나timeout/retry는바꾸지않으며교정후실행결과는별도추가한다.

## F891-015 · 비활성 도구의 hover pointer 차단

- PLAYWRIGHT / FAIL: `LOCAL:issue891/test-toolbar3.log`, toolbar실제case1FAIL/exit1. 두번째button내span hover를toolbar가intercept하면서90000ms기존testbudget을소진했다. exact개별시각미수집·WIP SCOPED다.
- 원인은설치toolbarButton[data-disabled]의pointer-events:none이었다. aria-disabled상태에pointer-events:auto를명시해hover를허용하고click/Enter/Space의명령guard는유지한다. forcehover·timeout증가·retry로통과시키지않는다. 후속실행결과는별도기록한다.


## F891-016 · locale 전환 후 MDXEditor 내부 번역 상태 미갱신

- PLAYWRIGHT / 제품 FAIL. 2026-11-15T01:14:58Z~01:17:15Z, 실제 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-task-editor-persistence.spec.ts --grep 'Issue #891 .* toolbar'` exit1, Task/Issue toolbar2건 모두FAIL. HEAD6471dd8b의문서WIP병행상태이며시작diff지문미수집(SCOPED)이다. 원본로그와두trace/error-context는 LOCAL:891-toolbar-failure-101458로보존한다.
- 실제는 KO→VI 뒤 주변UI만베트남어가되고편집기toolbar일부가한국어로남아helper116행단축키언어검사가거부했다. 설치MDXEditor4.3.3 corePlugin.update가내부translation상태를갱신하지않는경로를확인했다. 공개translation$갱신으로교정하며editor/plugin remount·undo/selection/source초안초기화나assertion완화는하지않는다. 교정후2건과11개전체·최종clean source gate/QA는별도실행전NOT TESTED다.


### F891-016 후속 · Rich 동기화 후 Source 모드에서 동기화 컴포넌트 해제

2026-11-15T01:17:47Z~01:20:51Z 동일 toolbar2건 재시험은 exit1/2FAIL로 Source locale assertion462행에서 거부됐다. 원본로그/두trace는 LOCAL:891-toolbar-failure-101747에 보존한다. HEAD6471dd8b311719b83e7f6f84f3236bda8a020ddf 및 제품/테스트 소유범위 git diff SHA256 `71abc972f119c445542c7de0d855c128aa42ff682e9d04fcc02438f84aa3e316`은 시작·종료 동일했다. 이는 전체source admission 지문이 아닌 SCOPED 작업중 관측이다.

Rich locale 왕복은 통과했으나 translation 동기화 컴포넌트를 DiffSourceToggleWrapper children에 두면 Source 모드에서 unmount되는 설치 구현을 독립 qa891이 확인했다. 테스트 실행이 끝난 뒤에만 동기화 컴포넌트를 wrapper 밖의 항상 mount되는 경계로 옮기고 새 재시험으로 분리한다. 원래 Source/모드/undo/selection assertion은 유지한다.


## F891-017 · Source redo 진단의 Playwright shifted 소문자 키 입력

2026-11-15T01:21:12Z~01:24:50Z toolbar2건 재시험은 exit1/2FAIL로 Source redo472행에서 원문marker가 복원되지 않았다. Rich/Source locale 왕복·draft/selection/editor identity는 통과했다. HEAD6471dd8b311719b83e7f6f84f3236bda8a020ddf 및 제품/테스트 소유범위 diff SHA256 `63f30cf80e931ec2414a3feb91bf604996cfcb0c33d9282f3246843d88492a86` 시작·종료 동일, 전체source admission이 아닌 SCOPED다. 원본로그/두trace는 LOCAL:891-toolbar-failure-102112에 보존한다.

독립 qa891은 설치 Playwright coreBundle의 physical KeyZ/소문자 alias 처리와 CodeMirror runHandlers/historyKeymap을 대조했다. `Control+Shift+z`는 key='z'를 보내 CM의 Ctrl-z undo로 해석되고, 실제 물리 입력 `Control+Shift+KeyZ`는 key='Z'로 redo를 실행하는 차이가 있다. 따라서 TOOLING 키 입력 불일치로 분류한다. assertion·history계약·키맵은 유지하고 실제 물리키 입력만 교정한다. 새hotkey나 Source history변경은 하지 않는다. 교정 뒤 실제PASS는 별도 재시험으로 확인한다.

## F891-018 · 긴 Rich 본문의 내부 스크롤 경계 재검증

2026-11-15T01:26:23Z~01:27:36Z 기존 toolbar2건에 상한/긴본문 경계를 추가한 run은 exit1/2FAIL이다. Rich 대상 root의 scrollHeight/clientHeight가 각각1753/1753px·1704/1704px여서 helper199행 내부스크롤 조건을 충족하지 않았다. 원본로그/두trace는 LOCAL:891-toolbar-failure-102623에 보존한다. HEAD6471dd8b311719b83e7f6f84f3236bda8a020ddf 및 제품/테스트 diff SHA256 `179e75cd2f7393ac3514f12c44734bb717572d9d7997adbb069955474bf217ea`는 시작·종료 동일한 SCOPED다.

관측 당시에는 특정 클래스의 높이와 실제 scroll owner를 구분할 필요가 있어 UNKNOWN으로 보존한다. 설치full-height 구조·computedoverflow와 wrapper 안 실제 scroll/toolbar접근을 조사하고, flex 최소 높이 chain과 테스트 oracle을 교차 검토한다. 외부 Dialog본문 scroll로 AC03를 우회하거나 assertion을 완화하지 않는다. 다음 실제 관측에서 제품/도구 원인과 교정·재시험을 추가한다.


### F891-017 후속 · 단일 Task 진단과 물리키 교정

2026-11-15T01:27:58Z~01:29:35Z Task 한 건의 단일 진단은 Source redo 동일조건으로1FAIL/exit1이었다. HEAD6471dd8b 및 제품/테스트diffSHA `0f512cfcf4fc7ad8c5c4e52d405fe462c72f76c2dbb6eef252a8c1c3b1185185` 시작·종료동일, 원본은 LOCAL:891-toolbar-failure-102758에 보존한다. 이 진단은 긴본문/상한·Source identity 경계를 좁혀 확인한 실행이며 반복성공으로 최초실패를 숨긴 것이 아니다. 이후 redo 입력을 물리KeyZ로 바꾸고 새 run으로 분리한다.

### F891-018 후속 · 원본 trace의 실제 경계와 oracle 정정

별도 qa891이 최초Task trace의 마지막 실제 screencast를 확인했다. 긴본문은 resizer 안에 있고 handle/toolbar/Taskfooter가 화면 안에 보였으며,1753/1753이라는 지정root치수만으로 외부Dialog로의 overflow를 입증할 수 없었다. 따라서 초기UNKNOWN 관측은 특정root를scrollowner로고정한 TOOLING oracle문제로구분하며,원본화면만으로내부scroll조작PASS를주장하지않는다.

공식full-height flexchain의min-height0을보강하고 새helper는wrapper내실제overflow후보의scrollTop·본문끝도달·toolbar/footer접근을검사한다. 외부dialog는후보에서제외한다. 01:27:58~01:29:35Z 단일Task진단에서는긴본문overflow·실제scroll과max cap검사가통과했지만Source redo가FAIL이므로전체PASS가아니다. 물리키와수정oracle을함께반영한새source의Task/Issue·전체회귀는별도실행한다.


## F891-019 · native125 관측자의 읽기 전용 WBS POST 오분류

2026-11-15T01:32:02Z~01:40:34Z 강화된 #891 11case run은10PASS/1FAIL,exit1이었다. Task/Issue toolbar2건과1440높이3건·반응형5건은PASS, native125의607행에서writes1vs0으로FAIL했다. 원본전체로그/trace/PNG/geometry/fixture/manifest는 LOCAL:891-eleven-103202에보존한다. HEAD6471dd8b311719b83e7f6f84f3236bda8a020ddf 및 제품/테스트diffSHA `213f39dbfbb82e6e954d5cb3f63dc0d17bf778d0150546babf567993dad6a8b8`은시작·종료동일한SCOPED다.

독립 qa891과 구현자가 확인한 유일한 관측POST는01:40:29.565Z `/api/projects/{syntheticUUID}/resource-dashboard/views` HTTP200이다. 기존route보안inventory는origin-public-query-read/mutatesState:false이고 route→handleWbsViewQuery→queryWbsView는SQLite읽기transaction이다. docs/API및기존HTTP원문before/after테스트도mutation0을명시한다. 기존`isWbsViewReadQuery` helper의정확POST+canonicalUUID경계만조회로분류하고다른POST/PUT/PATCH/DELETE는모두쓰기0을요구한다. POST일괄제외나assertion완화는없다. Project/Issue canonical GET 전후동등성도추가했다.

후속 native단일재시험은2026-11-15T01:41:58Z~01:42:36Z, 실제 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-task-editor-persistence.spec.ts --grep 'Issue #891 native Chromium'` exit0/1PASS다. HEAD6471dd8b 및 제품/테스트diffSHA `674bb6b090a27347c32f96b389a0ec93835d45c9af840730979794589ec5bd90` 시작·종료동일, LOCAL:891-native-pass-104158에PNG와원본결과를보존한다. 실제chrome.tabs zoom1.25/DPR/viewport/CSSzoom검사와원문·revision보존을통과했으며다른OS/실기기/Owner UAT는NOT TESTED다.

기존10PASS와native1PASS는테스트counter가일부다른WIPsource이므로동일clean source의11PASS로합산하지않는다. 최종소스준비뒤전체공통·영향(모든11case포함)·Docker/admit를다시실행한다. 신규PUT관측과toolbar의동일조회분류추가도그최종실행에서검증한다.

### F891-016~018 후속 · 제한범위 교정 관측과 최종 경계

물리KeyZ교정Task단일검사는2026-11-15T01:30:06Z~01:31:38Z exit0/1PASS이며제품/테스트diffSHA `56e40b19dad8bad2063c49d38898a3ee615a6b146d2512f487a5600b83cf01dc` 시작·종료동일이었다. Rich/Source locale·undo/redo·같은editor·resize/min/max·긴본문scroll의실제교정관측이며LOCAL:891-task-pass-103006에보존한다. 이후끝scroll상태의toolbar/footer검사를더강화한213source의Task/Issue2case도개별PASS이나전체run은위F019로exit1이므로전체source PASS로확대하지않는다. 원래실패를삭제하지않고최종정확source의결과는IssueFINAL/검증보고서와대조한다.
