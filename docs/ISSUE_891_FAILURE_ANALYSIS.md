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


## F891-020 · 고정 소스 전수 tooltip 검사의 protocol 누적 예산 소진

고정source6b270c2ee78d2f56efe64daeec70eb5f02b0b432의targeted01은2026-11-15T01:54:49.985Z~02:25:46.316Z에실행했다. 실제Task toolbar case37은runner startTime02:13:08.672Z/duration92,876ms이며90,000ms제한으로timedOut했다. 독립qa891은trace의약1,502browsercalls(517expect/290waitForSelector/128getAttribute/134mouseMove/64hover)와첫~마지막90.051초를확인했다. 마지막실제frame에는Taskdialog가열려있고예상밖navigation도없었다. teardown뒤DOM부재를Escape제품결함으로단정하지않는다. 개별완료call최대2.175초와많은독립DOM조회누적이90초를소진한TOOLING경계다.

현재candidate의게시를차단하고원본trace/JSON/log/sourceaudit를LOCAL:891-targeted01에보존했다. 동일90초·모든locale/도구의hover/focus/Escape·label/visibility/좌표/nativeDialog/disabledassertion을유지하면서독립DOM관측을atomic snapshot으로batch하는교정이다. timeout/retry/sleep증가나case수축소는하지않는다. 교정Source의실제2case와최종새Head전체gate를다시실행한다.

## F891-021 · client-only MDX 준비 경계가 cold chunk 도중 종료

동일targeted01의Issue toolbar case38은runner startTime02:15:16.652Z/duration19,558ms,richvisible기본5초검사FAIL이다. 마지막DOM은“Markdown편집기를불러오는중…”이고MDXlazyJS16개는모두HTTP200이었다. 독립trace의HAR요청시각02:16:05.237~05.248Z,응답3.75~4.205초는그대로보존하며runner와browser관측시계의차이를추정해서고치지않는다. module/consoleerror근거는없으며client초기화가준비됐다는서버health/API GET만으로는보장되지않는다.

기존885는실제편집제어action의auto-wait를준비경계로사용하지만새helper는최초visible5초만요구했다. 기존상태비변경focus행동으로실제rich준비를확인한뒤기존visible5초assertion을유지한다. Source클릭으로mode를바꾸거나고정sleep·timeout증가로통과시키지않는다. 초기준비와실제기능검증을분리한TOOLING교정이며제품결함으로확정한것이아니다.

### targeted01 중단·공식 결과 경계

두실패원인이확인된뒤Manager는불필요한나머지실행을SIGINT로중단했다. 최종mode는BLOCKED/interrupted=true,source/environmentStable=true,outerCLI exit1이다. 원본Playwright는44PASS/2FAIL/1interrupted/40did-not-run(87계획),stats.expected44/unexpected2/skipped41/flaky0을보존한다. 엄격coverage파서는미실행까지미충족으로포함해44passed/43failed로계산했으며43개의실제assertionFAIL로표현하지않는다. TargetedUnit142PASS와기존fast4013PASS/3SKIP·DockerPASS도이Head의개별결과일뿐게시허가가아니다.

Root/snapshot소스·원본trace·보고서수정없이종료했고실제FAIL은FAIL,중단된남은검사는NOT TESTED다. 아직mainPush/registrywrite/tag생성0으로0.147.0은미발행후보이며승인된같은version에서하네스를교정한다. 새commit에모든필수모드를재실행하고이전성공을전용하지않는다.


### F891-020/021 후속 · 동일 assertion/예산의 atomic 관측·실제 준비 재시험

2026-11-15T02:28:36Z~02:31:23Z 실제 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-task-editor-persistence.spec.ts --grep 'Issue #891 .* toolbar'`는exit0/2PASS(Task56.1초/Issue54.7초)다. HEAD6b270c2ee78d2f56efe64daeec70eb5f02b0b432 및 소유테스트diffSHA `50750d5ec1d6b0f2b84550045c28ac2e10a2d1161a849068caa4453a56585e28` 시작·종료동일한SCOPED이며controlled최종snapshot전체PASS는아니다. 원본로그/합성evidence는LOCAL:891-atomic-pass-112836에보존한다.

독립qa891은동일hover→focus→Escape순서의count/text/visible/focus/rect/viewport/nativeDialog/disabled검사가compound expect.poll로유지되고missingtooltip이통과할수없음을확인했다. rich.focus는실제client내용DOM준비를확인하는기존actionautoWait이며이후visible5초·전체90초검사를유지한다. 이준비동작을Editor초기default-focus증거로확대하지않고기존Editor고유테스트를유지한다. 제품/snapshot/timeout/retry/skip변경0이며이두case를정식게시용전체검증으로확대하지않는다.


## F891-022 · Manager 검증 순서와 완료 증거의 root lint 유입

2026-11-15T02:36:31.140Z~02:43:20.294Z frozen0fe의 `891-fast02`는 exit1/FAIL이다. source/envStable=true, source지문b9921539c9e6906f0476ef73df515255a7922f16321e0b4b1f86c363e58029af다. Manager가 완료된 이전traceviewer를source아래남긴채fast와targeted를동시실행해rootlint가이전HTML과진행중snapshot생성JS를읽었다. 실제Lint259errors/2835warnings,390099ms이며제품lint문제로단정하지않는다. 원본report/log/hash와즉시외부F022영수증·IssueEXCEPTION을보존한다.

완료된generated만파일별SHA동일하게source밖으로이관하고canonicalreport/runnerJSON/log/audit는원래경로에보존한다. ignore·sourceguard·선정은바꾸지않고fast lint와snapshot을동시에실행하지않는다. 기존외부계획은같은0fe fast재실행후게시·문서append였으나F023의실제producer교정이필요해지금새source에두실패를함께append한다. 이후새Head의전체필수gate를실행하며원본FAIL을대체하지않는다.

## F891-023 · legacy 회귀 산출물이 snapshot source를 덮어씀

2026-11-15T02:36:32.515Z~03:11:22.133Z `891-targeted02`는Unit142PASS와Chromium87PASS/0FAIL/0SKIP였으나최종snapshotaudit불일치로exit1/BLOCKED다. 원본source/envStable=true이며같은0fe/b992지문이다. 독립qa891이before/after5276파일을직접검산했다. tracked변경84개는허용Next2파일외#456 output/playwright/issue-456/after의81개PNG/JSON과#461 picker-geometry.json1개다. untracked는#456 gantt-public-events.json/gantt-state-phases.json2개다. index/HEAD/dependency복사·실행전후는같다. 원본report/audit/runner/log/화면은LOCAL:891-targeted02로보존하며87성공을전체modePASS로확대하지않는다.

이는제품기능assertion실패가아닌기존테스트출력producer의source오염이다. #898/#899의기존배치정책에맞춰두spec의출력위치만testInfo.outputPath로이관한다. historicalcommittedoutput을수정하거나sourceguard허용목록/fixture/assertion/timeout/retry/skip을바꾸지않는다. 교정후직접case빠른검증과새cleanHead의fast/targeted/Docker/admit·독립QA를분리실행한다. 검증전게시·종료는BLOCKED다.


### F891-023 후속 · 두 producer의 직접 빠른 검증

#456 단일fullscreencase는03:16:47~03:17:10Z exit0/1PASS(15.7초),#461 단일picker는03:17:40~03:17:57Z exit0/1PASS(11.3초)다. 담당자소유specdiff SHA는각각61823962d29e554f2526f5f45208accd424ba16a3f3f7038fa18e5d6f6008d71/8c8a0a35d14d4f9ace7bf45564a52f53ccc96a014bebb7cd4338b8fc8d7b8778이며시작끝동일,HEAD0fe의WIP SCOPED다. 두source output경로의변경/신규0과test-results전용출력을확인했다. 독립qa891은두diff가출력경로만바꾸고geometry/keyboard/Gantt/readonly/assertion/timeout을유지함을확인했다. Next생성변경을보존하며최종전체snapshotaudit는새cleanHead에서별도다.

## F891-024 · 신규 원장 draft의 테스트 경로 오타

문서WIP작성중Manager의F022 신규draft가존재하지않는tests/scripts/local-prepr.test.ts를참조해실제 `node scripts/verify-issue-ledger.mjs --base=0bf0e4e54cc445058b16c3764f79c27b81f5dd97` exit1/FAIL이었다. 정확개별시각은미수집(2026-11-15),공식최종mode가아닌SCOPED다. 실제경로tests/scripts/prepr-verifier.test.ts로신규draft만교정하고기존committed원장prefix는유지한다. validator와새source전체gate재시험전완료로주장하지않는다.


### F891-024 후속 · draft 경로 교정 검산

실재경로교정뒤같은validator명령은exit0/PASS(98failure/190event,기존prefix보존)였다. 문서WIP의SCOPED정적결과이며실제전체mode검증은새cleanHead에서실행한다.


## F891-025 · 실제 hover 보충 probe의 fixed portal 오분류

같은d523 Docker03이미지cbe48ada의추가관측첫run03:29:23~03:29:34Z는exit1이었다. Task/Rich/KO Undo의실제풍선은visible·viewport내(143~263.625/607~633px)였으나모든overflow조상을일괄clip으로센probe가DIALOG를거부했다. 첫probeSHA는변경전미수집이며원본logSHAbc95af13d4aa71299240617d111f66db8fd446a951b4ea9fafba27a0fbd51849를보존한다. screenshot추가진단03:29:53~03:30:07Z도같은oracleexit1이며probeSHA836b843d1a1f5df86e55546b1802b9ee5f92008e233a5f3ffc9528870a96a995/PNG4cb5c0c2ebdc25a126666f1b92cb3085682232f417d347ee43ed21af18560ab7다. ux891이PNG를실제열어dialog밖전체문구가그려짐을확인해제품clipping이아닌TOOLING기하oracle오류로구분했다. 원본최초·진단을별도보존하며108개PASS가아니다.

## F891-026 · 보충 probe의 locale 고정 dialog locator

03:31:09~03:31:53Z수정oracle run은KO Rich16개관측후VI전환에서KO이름으로만든dialoglocator를재사용해30초timeout/exit1이었다. 제품언어변경실패가아닌외부probe선택자오류이며나머지조합은NOT TESTED다. LOCAL:891-hover-run-QCrE5ryS원본을보존하고stable dialogselector만교정했다. 제품·설정·정식gate는변경하지않았다.

### F891-025/026 후속 · 실제 Radix 풍선 관측과 독립 검산

03:32:10~03:32:53Z새고유run-fGooL6zt는exit0/108geometry관측이다. Task/Issue×KO/VI/EN×Rich16/Source2,1440×1000범위다. probeSHA28c8c4bd0674935995d522ee69c657fcbdeebfc3344eea4eeacd3bd986cb37bf/observationsSHAc4d05c03e6817a04472b9bb256a093c34bc399c555f4a4143993ffc40a6ae80e이며검증Docker이미지source d523/IDcbe48ada와연결한다. sr-onlyrole설명대신실제Radixballoonroot를측정하고fixed viewportcontainingblock성립을확인했다. qa891은원문/script/hash와108JSON을재계산해invalid0을확인했고ux891은대표12PNG를모두실제열어각언어문구·viewport잘림0을확인했다(qa891추가2장). RichUndo6장은Descriptionlabel일부를일시가리지만본문입력·Action가림은없다. 이는108pixel검토·narrowhover·keyboard/AT·OwnerUAT가아니며정식prepr gate를대체하지않는다. 본인격리container/익명volume만정리했고source변경0·검증image는유지했다.

## F891-027 · 기존 5폭 편집기 회귀의 30초 누적 예산 소진

고정d523의targeted03은03:26:01.804~04:11:57.074Z실행후exit1/FAIL이다. Unit142PASS·Chromium86PASS/1FAIL/0SKIP,source/envStabletrue·중단0이며snapshotguard는PASS(Next생성2파일외변경0/untracked0)다. 따라서F023생산자교정은실제guard에서확인됐으나전체targeted성공은아니다. #891전용11개는전부PASS다.

실패는기존project-task-editor.spec의Issue#130 Phase3 다섯폭case31.3초다. trace311호출(108expect/88waitForSelector/34click/4screenshot)에서390/768/1024/1440폭의geometry·keyboard·footer·닫기/focus·같은Gantt검사가완료됐다. 1600폭을trace29.455614초에시작한뒤identifier-details.ts10의summary.click270ms중전체30초deadline이종료됐다. 최종DOM은열린Dialog/Revision20·활성summary이며클릭intercept·hidden·viewport이탈·geometry불일치오류는없다. 마지막영상은Dialog를열기전frame이므로제품닫힘으로해석하지않는다. 1600폭나머지검사는NOT TESTED다.

TOOLING누적관측예산원인을독립qa891이원본trace/DOM/실제frame으로검산했다. 원본전체report/audit/runner/log/trace를LOCAL:891-targeted03로보존한다. 기존30초/5폭/실제summaryclick·tab/keyboard·모든assertion·focus/Gantt·쓰기0을유지한단일case진단과독립DOM읽기batch교정후새Head전체gate를실행한다. 강제click/timeout증가/retry/폭축소/test분할은하지않으며검증전Push/Publish/Close는BLOCKED다.


### F891-027 후속 · 원본·교정판의 단일 case 계측

모두외부d523 archive+독립복사deps에서동일 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-task-editor.spec.ts --grep "Issue #130 Phase 3" --trace=on`을각1회실행했다. 공식30초FAIL은불변이며아래PASS는SCOPED단독부하관측이다. source별specSHA시작끝동일을확인했다.

| revision | UTC 시작~종료 | exit / 결과 | spec SHA256 | 변경 |
| --- | --- | --- | --- | --- |
| baseline | 04:18:31~04:19:02 | 0 / 1PASS, 21.6초 | 803819edfc0baaec89a90cbdc67a2752cb7383cc344478ac2e815793b557abe7 | 원본d523 testcase |
| after | 04:20:39~04:21:09 | 0 / 1PASS, 20.1초 | 849c5e10f7e265845c8b4213305a7338be6e5b18c53bd0090dd5430fad214ecc | 초기독립DOMbatch;최종본아님 |
| after2 | 04:21:55~04:22:25 | 0 / 1PASS, 19.9초 | 9b59715b8542b55d7b117d765d8cba19b65446428b673626e76c20877f6addbc | zeroarea null보강;최종본아님 |
| after3 | 04:22:49~04:23:29 | 0 / 1PASS, 29.8초 | 1b0812b3179ca6b6f0869d10499b5daf6b5a25b75ae2186137214523e6d205f1 | label4정확연결보강;부하변동관측 |
| final | 04:25:15~04:25:44 | 0 / 1PASS, 19.2초 | 5a11745413d274f2003c6878975ff42aa91a73348edb70abcb81540daf02236f | region2 role노출/단일성보강;최종동등정적QA PASS |

원본단독21.6초와최종19.2초를안정적인성능보장으로해석하지않는다(label판29.8초변동도보존). 동일trace정의의test.trace pw:api247→172, browser1-trace before377→332이다. 명시적접근성검증으로expect133→163(+30),waitForSelector107→37,click40→40,screenshot5→5다. 최종소스는5폭/30초/summary실제click·tab/key·visibility·focus·scroll·footer·Gantt·쓰기0와기존Nodegeometryassert를유지하며label4의정확연결/region2의노출·단일성을명시해동등성을복원했다. hidden/zeroarea를가짜rect로통과시키지않는다. 제품/src/config/fixture변경0이며독립qa891정적PASS후최종소스별도실행이다. 새cleanHead전체fast/targeted/Docker/admit·최종QA는필수이며아직미실행이다.


## F891-028 · resize·자동 스크롤 정착 중 기존 메뉴가 실제 소실

94c5의targeted04는04:36:03.663~05:07:02.209Z실행후exit1/FAIL이다. Unit142PASS·Chromium86PASS/1FAIL/0SKIP,source/env불변·중단0·snapshotguardPASS/untracked0다. F027의#1305폭case는같은전체회귀에서22.1초PASS했고#891전용11개도전부PASS였으나이번전체FAIL을대체하지않는다. 원본LOCAL:891-targeted04 report/audit/runner/log/trace를보존한다.

실패#81은기존#456첫5폭case의390×844첫openRow다(9.7초). helper의menu toBeVisible은PASS했으나다음toHaveCount1이0으로5초FAIL했다. qa891은두실제frame의OPEN→CLOSED와DOM의HTMLscrollTop130→108px변화를직접확인했다. 추가사용자click/Escape는없다. setViewport완료에도coordinatorAPPLYING/RANGE_EXTENSION이고rowvisible뒤SUPERSEDED/writes3였으며현재Core/native geometry의3RAF정착barrier는없었다. rightclick의기본autoWait는여러자동scroll·devportal/html pointerintercept뒤실제click을완료했다. 메뉴가보인뒤document22px이동은제품의scroll-close정책과일치하지만정확listener호출순서는원본trace에없어UNKNOWN으로보존한다. 제품geometry검사까지도달하지않았다.

기존source의메뉴는실제viewportresize·조상scrollchange에닫히며이는안전한위치계약이다. 이를완화할근거는없다. 탐색mdx_readiness는setup/openRow가행visible/APIinstance만확인하고resize후projection/viewport/Core/native정착을확인하지않음을코드로확인했다. 같은spec의기존waitForGanttReadiness는현재source·API/revision/scale/scope·publicreceipt·nativegeometry와3RAF안정성key를검사하므로재사용후보다. 다른case의week값을그대로복사하거나blind sleep/강제click/메뉴reopen·retry/timeout·폭·assertion변경으로통과시키지않는다.

외부원본singlecase와읽기전용resize/capture-scroll/pointer/menuMutation시각을관측해trigger·준비경합을구분한다. 진단단계의UNKNOWN과후속확인분류를분리하고정착된실제사용자경로로최소교정후새cleanHead전체gate·독립QA를다시실행한다. Push/Publish/Close는계속BLOCKED이며0.147.0정식태그/registry쓰기는아직없다.


### F891-028 후속 · 계측 원본과 최소 준비 교정의 단일 실행

외부94c5archive+독립복사deps에서같은원래case명령 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/task-editor-form-density.spec.ts --grep "#456 동일 유효 자료" --trace=on`을각1회실행했다. 원래specSHA9c09f28e6825fd3b82077b3fc9d746119bacf9ce18c1303081ba64dd9d264ab5를보존하고외부계측본에만resize/capture-scroll/pointer/contextmenu/메뉴·coordinatorMutation시각관찰을추가했다(specSHA5eb3b7e25131934d76c6a13b7e63d1b6a93e5ef0c5564191dead3ab9a2f72fd5). 05:12:35~05:13:19Z exit0/1PASS31.3초였고APPLYING→SETTLING/writes3→SUPERSEDED·문서108뒤menuopen을관측했으나메뉴닫힘은이번재현되지않았다. 관찰타이밍영향을인정하며정확최초callbackUNKNOWN과공식FAIL은유지한다.

최소교정은첫5폭case의setViewport직후동일UUID4행scrollIntoView로원래rightclick자동준비를명시하고,기존waitForGanttReadiness가day/revision20/동일API/scope null/query빈값/canonical5/visible4·현재receipt와Core/nativegeometry의초기+3RAF동일key를검사한뒤원래openRow를실행한다. 공통helper는변경하지않았다. allowCancelledPriorWork는임의현재실패를통과시키지않으며활성/실패/UNKNOWN은계속차단한다. helper가종류까지제한하지않는점을독립QA가지적해SUPERSEDED반환때RANGE_EXTENSION을해당case에서명시assert했다. 메뉴visible/count1/미리editor0/수정enabled·실제click/menu0/editor1·5폭·geometry·mutation0·120초와모든기존검사는유지했다.

독립qa891최종9줄diff정적PASS후별도최종archive에서05:18:14~05:18:59Z exit0/1PASS32.0초였다. specSHA0b8e79bff24d466ae51135ec2c8ce7cf696c18a1ef78e2754f604c99e3291104시작끝동일,diffSHA8919e83c06f6cac77373af5445707a14afc1440dad0e548f2b810677adfe611b다. browsertrace viewport5/click40/screenshot25는계측원본과같다. 정확listener를단정하지않고확인된fixture정착준비불변식을보강한것이며제품closeguard/비즈니스코드수정은없다. 현재이PASS는SCOPED이고새cleanHead전체fast/targeted/Docker/admit·실제최종QA전Push/Publish/Close는BLOCKED다.


## 현재 제품 source의 최종 로컬 검증과 게시 (2026-11-15)

제품 source `f45f7c0a25960a34970005cae93bd7b55ace2831`, base0bf0e4e54cc445058b16c3764f79c27b81f5dd97는clean exact source다. fast05 9단계/4013UnitPASS·기존opt-in3SKIP, targeted05 Unit142/11files·Chromium87/8files PASS(FAIL/SKIP/flaky/retry0), Docker05 10단계, admit05 publishAllowed=true/reasons0를독립qa891이검산했다. source지문d8fb543cc72640ea17114201694c60c74c67b6cd9e936302ade5056e9f055bd9/환경a29758a80dbeb93a85b75e0a3dec6fffe7f9c2b7968f2916fee0a1c5bc30c41e,fixture567a8f11add07cd52d0de18ab5e6529466f97d8cd2f72642d24901c1c5da325b/lock09abd4b4f1408a26e0614509b14e2dc27608fd33675881823484b7f50151ae26가결속된다. snapshot5276파일/index/dependency지문전후동일,untracked0·허용Next2외변경0다. F016~024/027/028에는실제current-source event를append했다. 과거F028정확listener는UNKNOWN으로유지하며현재정착준비/동일경로검증을원인확정·모든상황무재발로확대하지않는다.

현재이미지sha256:13c1abdfb042a7459c0a276bd2cc1c3db2159170d99f3b9cdb82d795db6b231e의새hover실행06:00:47~06:01:24Z는108geometry검산이며F025/026에source별event를append했다. UX가실제20PNG(targeted8+대표hover12)를열어표시된제어의가로잘림/제어간겹침차단지적0을보고했다. RichUndo6장은Descriptionlabel일부를일시가리며lowheight/native125의화면밖handle은그이미지로시각판정하지않았다. 108pixel전체·narrowhover·AT·OwnerUAT는별도다. dirtycapture는공식clean입력/최종audit의허용Next출력과연결하며cleanfullDiff동일이라고부르지않는다.

## F891-029 · 보조 태그 조회의 ORAS 출력 옵션 오타

Manager보조조회가`oras repo tags --registry-config <auth-file> --output json ...`로exit1이었다. 실제설치1.3.6의옵션은`--format json`이며기존정식실행기에는처음부터맞는옵션이있었다. 최초stderr와개별exact시각은미수집으로명시하고완전원문보존으로주장하지않는다. 기존실행기/CLIhelp확인뒤인증된교정read는exit0,당시registry496/Git210·최고SemVer0.145.2/new0.147.0·0.147·v0.147.0부재를확인했다. source/registry변경0이며실제태그발행은후속별도증거다. LOCAL:891-F029외부원본영수증을단일원장/index에이관했다.

## F891-030 · fresh graph 병렬 Pull 정지와 단일변수 새 검증

원래preflight step18은06:22:31.543~06:42:22.157Z,wrapperFAIL_OR_BLOCKED/outerexit1·childexitnull/SIGTERM으로BLOCKED다. 8blob완료,대형a8ac/e815/7f60 partial각22,714,118/19,802,274/15,231,069bytes가06:26:27.315~349Z에동시정지했고15분55초갱신이없었다. stdout1149bytes/stderr0·36AESstreams정합/trunc0이며명시HTTP오류/근본원인은UNKNOWN이다. 원본script71a5/config/실패receipt/partial/AES는그대로보존했다. 실제SHA publisher29단계/58AESstreams의PASS와이BLOCKED를구별했다.

공식ORAS1.3.6/oras-go2.7소스와설치help의concurrency가동시copytask수만조절함을확인하고,새실행기SHAaf67c3e86cd7f4f1362a3aeb14fcbd31201ce5c191b1c71dc43a54d547140745의preflightcp에만`--concurrency 1`을추가했다. 새configSHA4c2db3ae5f5a365739fbae8c825b3f02356fe3d339fa42741752622aeddad85c는실행directory만다르다. 기존20분/recursive전체graph/bytes/runtime/freshadmit/reportpins/lock/sidecar/태그검사를유지했다. 새빈layout에서실제Pull했고이전partial/cache를재사용하지않았다. 이는정지근본원인확정이아닌통제변수1개실험이다.

새graph Pull은2026-11-15T07:08:11.905Z~2026-11-15T07:09:43.776Z,preflight32단계/64AESstreams·17blob전수bytes/hash·exactruntime/API/auth/SQLiterestart/integrity·freshadmitPASS다. 별도qa_release891이07:13:37Z미해결0으로실제검산해preflightintegrity8e52e44292f3758be8f26ef5ce06e6328c8fec2b7aa7dc6949aad129311e5d41/scriptaf67/source/digest에결속한review를반환했고Manager가실제그결과만0600sidecar로기록했다. Reviewer별도셸환경과controlledrun의a297환경을구분하며Reviewer재실행PASS로표현하지않았다.

### F891-030 후속 · 정식 0.147.0 승격과 독립 최종 QA

고유SHA publisher는2026-11-15T06:10:20.941Z~2026-11-15T06:19:17.143Z29단계PASS/VERIFIED였고,07:17:52.127Z정식승격은PASS였다. annotatedv0.147.0 object3323aa85b10dcb75feff405130bbfe0cf106efbb→sourcef45f7c0a25960a34970005cae93bd7b55ace2831;GHCR0.147.0/0.147/0/latest/SHA모두index`sha256:5ac1904dac65ef88c64952b67866a84d078a39dc74bea007f254c7a5a1fa10f8`다. preflight32+promote64=96명령/192AESstreams(AAD/hash/bytes/권한/trunc0),기존498tag names보존+신규2=500,기존Git420ref lines보존+새2였다. 선정9descriptor중옛0.145.0/0.145.1/0.145.2/0.145는불변이며미선정descriptor전수불변으로확대하지않는다. 재빌드0·허용4개registrytag쓰기와Git새tag외기존태그삭제/덮기0이다.

실제동일digest runtime/API/auth/SQLite는preflight에서PASS했고승격후에는새exactdigestPull이PASS했다. 추가post-promote runtime재실행으로주장하지않는다. SBOM371packages/SPDX·SLSAv1·17blob결속을확인했다. 최종qa_release891은07:21:35Z미해결0/PASS를반환했다. 최종receiptintegrityb842c6b473457acb157a585d84b09703a8758a06b16aa96e59e8a3bbe2f5b72c다. 외부writer의서버CAS는없으며live재조회/공통local lock으로경쟁창을줄인범위다. 운영배포/운영DB접근은없고oldformalrefs는유지했다.

## F891-031 · 로컬 receipt 진단의 count 자료형 오독

보조Python조회에서graph.blobs정수를list로읽어`TypeError: int object is not subscriptable`/exit1이었다(개별exact시각미수집). actualgraph count17과OCI tar member의실제크기55,229,482/35,133,237/28,232,655bytes를다시읽고CLIhelp의옵션을확인한조회는exit0이었다. source/registry/정식검사변경0이며제품장애나새Graph검증PASS로확대하지않는다. LOCAL:891-F031원본/정정메타를보존했다.

## 종료 증거 문서의 경계

이추가는이미게시한제품sourcef45f7c0a25960a34970005cae93bd7b55ace2831뒤의문서전용변경이다. app/src/package/lock/Docker/검증도구는변경하지않고0.147.0과immutableGit/GHCRdigest를유지한다. 새문서Head의공통검사·직접원장Unit·admission·독립문서QA·일반mainFF는별도로수행하며그결과/최종Issue상태는GitHubFINAL에결속한다. 이문서를썼다는사실로아직끝나지않은문서gate나Issue종료를PASS로표시하지않는다.
