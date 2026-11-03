# Issue #866 — #865/#869 통합 구현 누적 실패 원장

Primary: [#866](https://github.com/planner77/masterGantt/issues/866). 관련: [#865](https://github.com/planner77/masterGantt/issues/865), [#869](https://github.com/planner77/masterGantt/issues/869). [Work Packet](exec-plans/active/ISSUE_866.md). 기준 main `352a43e7`, 후보 `0.140.0`, `feat/issue-866-i18n-llm-issue-layout`.

## 원본과 범위

신규 구현이므로 착수 시 해당 기존 PR/Full/metadata/rerun은 없다. 다른 Issue의 실패를 전용하지 않는다. 로컬 재현·구현 중 오류와 PR CI 원본을 구별하며 첫 Full 시작 후 결과는 모니터링하지 않는다.

## 실행 목록

| ID | 환경/Run/Attempt/Head/Base/Test-Merge | 실제 결과 | 원인·보완·잔여 |
| --- | --- | --- | --- |
| SETUP-001 | local Node22.14.0/npm11.10.0, main352a43e7 | npm ci --ignore-scripts 성공, better-sqlite3 rebuild 성공 | frozen 의존성 설치. install 감사 20건은 production 감사와 구별하여 후속 확인 |
| PR-INITIAL | PR/Run/Attempt 미생성, Head/Test-Merge 미확정 | NOT TESTED | 새 Head에서 기존 Full Required3 시작. 성공을 선행 선언하지 않음 |

## Cross-run / 구현 중 실패 매트릭스

착수 시점 구현 테스트는 NOT TESTED였으며 후속 실행은 아래 시간순으로 추가한다. 최초 RED 재현 및 관측된 테스트/제품/환경/계약 오류는 삭제하지 않고 이 절에 추가한다. 원인 미확정은 UNKNOWN. 미실행/취소/skip을 PASS로 합산하지 않는다.

## 인계

Manager가 정규 원장을 관리하고 구현 Agent는 명령·실제 건수·최초 오류·보완을 반환한다. 코드/테스트/문서 동결 뒤 이전 실패 합집합과 직접·인접·음성 사례를 검증하고 최신 main 정렬·미해결 리뷰/충돌을 확인한다. Owner-managed 최종 승인, Trusted QA, 실환경 LLM 및 Main/Release는 NOT TESTED.

## 로컬 최초 실패와 보완 (2026-11-03)

원격 PR/Run/Attempt는 아직 없다. 아래는 기준 main352a43e7 위 작업 중 로컬 source에서 관측했으며 동시 작성 중 전체 source 동결 PASS를 뜻하지 않는다.

| ID / 분류 | 최초 실제 오류 | 보완/재검증 | 잔여 |
| --- | --- | --- | --- |
| F869-TEST-001 / TEST_CONTRACT |10행에서도 반드시 overflow라고 단언하여 FAIL;10행은 가용 높이에 들어갈 수 있음 | 실제 조건인20행 이상 overflow·10행 데이터 접근 및4page size 검증으로 수정 | skip/timeout/retry 증가 없음 |
| F869-PRODUCT-001 / PRODUCT | 기존 table clientHeight=scrollHeight880px/20행, 목록 대신 상위 패널 scroll. 내용 textarea98px. before-list/editor PNG 보존 | parent/child flex·min-height0 및 table overflow, dialog fixed title/body scroll, rows8/11.5rem | 최종5폭/3언어 geometry 재검증 예정 |
| F869-ENV-001 / INIT_TRANSPORT | 초기 브라우저 보완 재실행 중 동시 shell AST parse로 INTERRUPTED 및 module-scope t undefined runtime FAIL | shell JSX traversal와 loader를 LocalizedText로 교정 | 해당 실행은 PASS로 합산하지 않음 |
| F869-PRODUCT-002 / PRODUCT | locale selector를4번째 grid child로 추가하여 header97px, 문서 세로 overflow41px | 기존 header-actions에 selector/bell 묶어3열 유지 | 후속 header 가로폭은 아래 별도 |
| F869-PRODUCT-003 / PRODUCT | reporter/assignee row의 inline 중앙 정렬로 status 입력과2px 불일치 | 해당3열 inline align-start | geometry 재실행 |
| F869-PRODUCT-004 / PRODUCT | EN390에서 editor overflow0이나 document 가로 overflow31px; 기존 actions 고정40px에 select+bell 배치 | actions widthauto/min-width0/gap 및 select bounded폭, nav 내부 horizontal scroll | 실제5폭/3언어 후속 검사 필요 |
| F-LLM-001 / PRODUCT | 최초60case 중59PASS/1FAIL. chunked 응답1MiB 초과가 INVALID_UPSTREAM_RESPONSE 대신 UPSTREAM_ERROR | destroy의 aborted 동기 event보다 안정 오류를 먼저 settle | 이후 전용70case PASS |
| F-LLM-002 / PRODUCT | token JSON의 literal/escape 중복 키를 JSON.parse가 허용; 음성2case FAIL | duplicate-key scanner로 fail-closed | 같은 suite70/70PASS |
| F-LLM-003 / TYPE | @types22 RequestOptions의 autoSelectFamily overload 불일치 | 명시 옵션 type·http/https wrapper. IP pin/TLS 동작 유지 | 독립 strict tsc/대상ESLint PASS |
| F866-DB-001 / PRODUCT·FIXTURE | 최초5suite43case 중40PASS/3FAIL. per-owner 번역 read로 고정 query수25→85; pre0025 fixture가 현재 schema Repository를 조기 사용 | owner-ID batch조회, historical fixture는 당시 direct SQL 사용 | 마지막14suite163case PASS |
| F866-DB-002 / TEST_CONTRACT | expanded67case 중66PASS/1FAIL: 새0036 migration exact list 누락 | 실제0036와12table/pending count를 모든 관련 exact assertion에 추가 |83case3FAIL/163case4FAIL의 후속 잔여 assertion도 원인별 보존, 최종163/163PASS |
| F866-DB-003 / FIXTURE | 신규 managed translation5case 중4PASS/1FAIL: seed되지 않은 wms 사용 | 실제 seed mcs 선택 |5/5PASS |
| F866-UI-001 / TEST_CONTRACT | shell/domain 첫 AST pass가 declaration/map parameter/module loader까지 감싸 TS parse/runtime FAIL | 자기 소유 파일만 되돌려 JSX render seam으로 범위 제한 후 재적용 | 후속 typecheck PASS, 정적 사전 coverage 대기 |
| F866-UI-002 / ENVIRONMENT | 새 순수 TS helper의 @alias를 Vitest가 해석하지 못해2suite0수집 | 상대 import로 고침 | 개별 helper 회귀 재실행 |
| F866-UI-003 / PRODUCT | 기존 project metadata 빈 name 회귀: displayName helper가 whitespace를 표시 | !name.trim() 기존 guard 복원 | 개별 metadata 회귀 재실행 |

- 구현 Agent 보고 LLM 전용70/70 PASS/ESLint/strict TypeScript PASS. 테스트 내부 mock seam과 import graph 검사는 실제 프로덕션 번들·운영 endpoint 검증을 대신하지 않는다.
- 실제 i18n Chromium4/4 PASS(11.4초): en 첫 방문→vi 저장/reload, 잘못된 저장/fr→vi, storage SecurityError+수동ko 유지, cross-tab en/vi/ko 전환 중 Task Editor dirty·동일 API/DOM Gantt·scroll/revision·Task/Link/Assignment write0. 날짜/i18n Unit10/10 PASS.
- 기존 Issue business Chromium4/4 PASS(16.4초): 등록·Resource/Task·상태/비밀번호 안전오류/필터/Gantt 복귀, readonly 등록/prefill·late return·느린 canonical 경합. 새 레이아웃5폭/3언어는 별도로 검증한다.
- `npm audit --omit=dev` 실제0건(info/low/moderate/high/critical 모두0). npm install 전체20건은 dev 의존성 포함이며 실제 조용한 보안 업그레이드를 수행하지 않았다.
- 당시 실행에서 관측한 실제 source와 최종 source의 변경 영향을 재대조해야 한다. 위 로컬 성공을 신규 PR Full/Trusted/Owner PASS로 전용하지 않는다.

## 추가 통합·독립 검토 결과

- **F866-SNAPSHOT-001 / PRODUCT:** 두 SQLite WAL connection에서 owner name 조회와 번역 조회 사이 다른 writer가 commit하면 name=Before, translations.en=After display, revision3으로 섞이는 RED를 재현했다. owning service read transaction으로 name/번역/revision을 같은 snapshot에 묶었다. 최종 관련10suite129case PASS 및 신규 번역7/7 PASS. 그 직전 backend 확대 회귀는122파일1346PASS/기존1파일3skipped였으며 새 skip은 없다.
- **F866-PARSER-001 / PRODUCT:** Service의 Resource Group 번역이 readDashboard Zod 파서에서 strip되어 rows와 catalog.groups에서 undefined가 됨을 실제 SQLite fixture→Service→클라이언트 parser로 독립 재현했다. optional translation schema를 추가하고 같은 경로를 독립 재검증하여 보존 PASS. WBS transport에서 같은 유실이 있다는 초기 가설은 원본 bodyData 반환을 확인해 **기각**했으며 별도 결함으로 세지 않는다.
- **F866-DISPLAY-001 / PRODUCT:** 서로 다른 원본 이름이 같은 EN/VI 표시명을 갖는 경우 원본 name 비교로 ID/code 구별이 빠졌다. 현재 displayName 비교로 수정했다. 자유 입력 WBS 범위/단계 이름에 t(label)을 적용한 경우도 제거하여 사전 키와 같은 사용자 이름을 보존한다.
- **F866-ERROR-001 / PRODUCT:** domain transport의 raw error.message/details가 t fallback으로 노출될 수 있어 safeApiError code→고정 메시지 및 제한된 diagnostics로 교정했다.
- **F866-NATIVE-001 / PRODUCT:** 초기 i18n4case PASS의 더 좁은 증거 뒤 실제 native header를 강화 검증하니 en→vi 전환 후 Start가 남아 Bắt đầu 불일치 FAIL. Locale의 초기 columns 재처리와 imperative set-columns 경합을 확인하고 공식 words alias/현재언어 getter로 수정 중이다. 강화된 동일 instance/실제 헤더 재검증 전에는 PASS를 선언하지 않는다.
- **F869-FOCUS-001 / PRODUCT:** 삭제 확인 표시로 focused trigger가 사라지며 focus가 body로 내려가 Escape가 dialog에 도달하지 않았다. 새 취소 버튼 focus 및 취소 후 원래 trigger 복원을 추가했다. 최종 #869 Chromium1/1 PASS15.6초. 그 이전 전체 Issue5/5 PASS28.7초와 후속 HMR INTERRUPTED80초를 구별한다.
- **F866-FULLLOCAL-001:** 최초 root 전체 Vitest는7filesFAIL/287PASS/기존1skipped,3testsFAIL/3535PASS/기존3skipped였다. 실제 실패 합집합은4suite 새 i18n alias 해석, 사전 누락2key, 신규 E2E2spec shard 인벤토리 누락, chart KO 문구 초과→과투입 변경이다. alias 교정 뒤 기존 physical-source가 범위0/범위미지정으로 붙는 JSX 공백 유실도 확인했고 원래 문장 간격을 복원했다. assertion을 낮추지 않고 원래 KO 문구를 보존했다.
- **F866-INVENTORY-001 / TEST_CONTRACT:** shard planner6case5PASS/1FAIL(143→145 신규2spec 미등록) RED→명시 등록/분포 assertion 보존 후6/6PASS. 기존8shard/배치·과거 성능지표는 그대로다. 발견검사295Unit파일/873브라우저case는 root/외부cwd 동일 PASS다.
- **F866-TYPE-001 / TEST_CONTRACT:** 새 calendar Unit의 weekendDays가 number[]로 추론되어 tuple[6,0]와 충돌했다. 정확한 DTO type annotation으로 교정했다. 새 calendar 안전오류 경로의 잘못된 CustomDraft.kind 참조도 실제 origin 필드 계약으로 수정했다.
- **F866-ENV-002 / ENVIRONMENT:** GitHub CLI gh api user는 HTTP401 Bad credentials였다. Git fetch read는 가능하고 연결 GitHub 도구의 조회·Issue comment는 정상이다. 게시에는 동일 후보 tree/parent/lease를 검증하는 Git Data API를 사용하며 사용자에게 credential을 요구하거나 출력하지 않는다.
- **Compose 실증:** synthetic .env→docker compose config --quiet 및 실제 격리 Compose container의7개 LLM runtime 값 일치 PASS. network_mode none, DB/port mount 제거, 기존 로컬 image ID sha256:83c08bcafc62df05e983a65c1a7c2a49d3b5a4bdc516392e5103d53a70428e98를 사용했다. 새 source image build/runtime·운영 LLM smoke PASS로 확대하지 않는다. 실제 secret·config 원문은 출력하지 않았다.
- 전체 ESLint 최초0errors/22warnings 중 새 formatter unused import는 제거 중이며 기존 경고와 구별한다. 최종 source 검사 결과를 별도 추가한다.

## 최종 source 동결 전 마지막 보완

- F866-NATIVE-001: 공식Locale words alias·현재선택언어 getter 교정 후 강화된 native 헤더/vi 날짜·실제 비영 가로스크롤·동일API/DOM·원본쓰기0 검증 PASS. 최종 i18n4/4 PASS12.6초. 중간 domain callback의 t undefined 실패는 실제 hooked component로 교정했다.
- F866-LAYOUT-002: 실제SQLite admin UI390px/VI에서 implicit grid 최소457px로 문서overflow RED. minmax(0,1fr)·탭min-width0·legend wrap 교정 후 같은5폭 assertion PASS.
- F866-DRAFT-001: inline 번역 Editor가401상태의 부모조건부unmount로 draft를 잃을 수 있어 host별 stableowner 키의 controlledReact state cache로 보존했다. 최초ref.current render 접근 lint ERROR는 immutable state로 교정했다. 성공/취소는해당키만제거, process-global/localStorage cache 없음. 실제401save→재인증→초안유지·412초안유지·cancelclear 최종SQLiteE2E1/1 PASS24.6초.
- domain Vitest59/59 PASS, 스크린샷5폭과static감사 누락0/rawKoreanJSX0. 초기 browser 재인증·정렬가정 오류는 실제명시재인증/code기반fixture로 수정했으며 제품오류와구별한다.
- 새 i18n runtime imports의 Vitest alias 수집실패는 production과 동작이 같은 상대경로로 변경했다. 후속 milestone/stage/relation suite PASS. 기존physicalSource의 단어공백 손실은 원래 JSX 경계172곳을 복원하여 원문표현을 유지했다.

최종 후보 동결 source SHA256: `3e9a96ec4b940dff934c9788f37ff17c7b56d77ff93c56acf501469b3f3dc47c` (src/tests/db/deploy 및 root진입점1207파일). 위초기실패 합집합·직접/간접/보안·도메인 소비자를 전체Vitest/타입/린트/Nextbuild로 재검증한다. 생성되는next-env/tsconfig의 임시E2E경로는 기동전main원본으로 복원했다. 실제최종결과는 다음절에 기록한다.

## 동결 source의 누적 실패 합집합 재검증 결과

초기 root 전체Unit7filesFAIL/3testsFAIL과 alias후physical공백 실패의 합집합을 유지하고 최종 동결 source에서 전체 `npm test`를 다시 실행했다. 결과294files/3548tests PASS, 기존1file/3tests skipped,22.93초다. 앞선7개실패파일은 모두실행성공했고 skip/assertion/timeout/retry 완화는 없다. `npm run typecheck`, 전체lint0errors18warnings, Next production/runtime-tools build, version0.140.0, 발견/Markdown/diff 검사 PASS. 검사후source1207파일SHA256이 동결값과 동일함을 확인했다.

최종 정제근거는 [local-validation.json](evidence/issue-866/local-validation.json)이다. 실제비밀값을사용하지 않고 `.next/static`에서LLM runtime설정식별자3개미포함을 확인했다. staticimport검사와 mock70case는 실제내부망DNS/CA/모델접근성·새GHCRimage실증을 대신하지 않는다.

이후변경은 문서/증거와원격인계에한정한다. 최신main352a43e74c7b34c72d952f67783a53463f8b519d에서충돌없음이며 기존관련openPR/미해결리뷰는없었다. 새PR의현재Head/Base/mergeability/review상태와CI시작Run/Attempt는STATUS댓글에남긴다. 신규원격quality/e2e/docker/Trusted·Manager ACCEPT=NOT TESTED, MERGE_READY=BLOCKED, release_authorized=false다.

### F866-PUBLISH-001 — API 게시 자료 전달 크기 제한

Git CLI 인증401을 우회하는 기존연결 Git Data API 경로에서 큰source JSON을 터미널결과로읽을때1MiB 출력상한으로 part4의 문자열이절단되어 JSON.parse가 FAIL했다. 코드·테스트·Git tree내용오류가아니며 branch ref/PR/CI를변경하기전 immutable blob/tree작성단계에서중단했다. 해당파일을ASCII JSON200,000자구간으로읽어복원하고15개중간tree를순서대로작성한뒤,258개경로의전체결과SHA가로컬git write-tree `3ed8285f19348d2b3f5558bc18a321a4273a4a16`와동일함을확인했다.16개PNG blob도각각staged object SHA와일치했다. 이추가기록을포함한최종tree를다시대조한후에만commit/branch/PR을게시한다. 제품동결source지문은변경하지않았다.

## PR870-FULL-001 — Full #3468.1의 첫 원격 실패 및 재개 (2026-11-03)

이 절은 이전 구현 중 로컬 실패·보완 기록 뒤에 추가한 **첫 원격 PR CI 원본**이다. 이전 동결source 로컬PASS는 유지하되 원격실패를 덮어쓰지 않는다. 정제 전체Job/8Shard/직접실패 목록은 [CI41618392066 attempt1](evidence/issue-866/ci-41618392066-attempt-1.json)에 보존한다.

### Run/Attempt·원본 귀속과 전체 결과

| 실행/환경 | Head/Base/Test-merge 및 출처 | 실제 결과 |
| --- | --- | --- |
| [Full3468.1](https://github.com/planner77/masterGantt/actions/runs/41618392066), Run41618392066/attempt1, pull_request, `.github/workflows/ci.yml`, 생성2026-11-03T10:20:07Z | PR870, Head`98272e108095e841b22e5433a5d91639ff7c4a8f`, Base`352a43e74c7b34c72d952f67783a53463f8b519d`, test-merge`244ec7e7f99463f54edd3dbd4699922646e9c4f1`. `ci-pr-source-41618392066-1` ID13221977612/schema mastergantt-ci-pr-source-v1/미만료를실행없이읽고API와대조 | **FAIL**, 원본세aggregate는quality PASS/E2E FAIL/Docker FAIL |
| [FAST243.1](https://github.com/planner77/masterGantt/actions/runs/41618392195), 별도 advisory workflow | 동일Head의개발경로이며 Full이아님 | **SKIPPED**, 필요한검증PASS로사용하지않음 |
| [Trusted1114.1](https://github.com/planner77/masterGantt/actions/runs/41620253310), workflow_run, validatorSHA`352a43e74c7b34c72d952f67783a53463f8b519d`, Job125863864044 | sourceRun41618392066를귀속확인 | 원본CI자체비성공에의한파생 **FAIL**(run conclusion=failure), 독립제품오류아님 |

접근한동일Head PR원본은위Full/FAST2개이며 Full의run_attempt=1, 이전attempt없음을확인했다. Trusted조회는최근workflow_run페이지와원본Run로그로교차확인했으며2500개전체이력을전부수집했다고주장하지않는다. 이번Issue의새로시작하는후속Full결과는NOT TESTED다.

- **Quality SUCCESS**: aggregate125859887448. Preflight125857673893, 정책125857828366, TypeScript125857828441, ESLint125857828246, Vitest125857828484, PRproductionbuild125858916871, FastGate125858717644 모두SUCCESS.
- **E2E**: aggregate125859682564 FAILURE는실제아래2case의파생. Shard1 Job125858917014 FAILURE: 실제2PASS/1FAIL/126NOT RUN. Shard7 Job125858916888 **CANCELLED이나실행step FAILURE/실제1PASS·1FAIL·80NOT RUN**이므로원본실패를보존한다. 나머지6Shard는CANCELLED이며관측한PASS는2번0/3번8/4번1/5번2/6번9/8번1이다. 해당부분PASS를Shard전체PASS로합산하지않고나머지는NOT TESTED다.
- **Docker**: 구현Job125858916726의step22 `production HTTP·HTTPS 전송 정책 검증` 직접FAIL, aggregate125863608457은파생FAIL. image build·OCI/digest/SBOM/provenance·image policy·잘못된HTTP설정거부·migration/readiness·SQLite native persistence는SUCCESS. 후속Compose검증step23은SKIPPED/NOT TESTED. PR에서registry write·Main임시image/정식release는대상이아니다.
- QA Automated125863652095는required미성공의파생FAIL이다. 미해결review_threads는조회시0이며Codex기계리뷰의원본HeadFinding없음은독립인간QA/Owner승인이아니다. main은여전히BaseSHA와동일하고mergeable=true다.

### 누적 실제 실패 파일 합집합·가설과 보완 계획

| ID/원본Job·파일·위치 | 최초 기대/실제 | 재현·확정/기각 | 수정 소유권/직접·인접·음성 검증 |
| --- | --- | --- | --- |
| F866-CI-001 / [Shard1 Job125858917014](https://github.com/planner77/masterGantt/actions/runs/41618392066/job/125858917014), `tests/e2e/admin-auth-layout.spec.ts:17`, assertion65/helper71 | sibling controls>=2, actual1; master인증화면 | 같은기존test로RED. snapshot의실제help이름은`프로젝트 기준정보 관리 도움말 도움말`. ContextHelp가완성label의기존suffix검사를없애무조건붙인**제품회귀**다. 공백정규화·늦은마운트가설은실제JSON라벨로기각 | frontend: 공유ContextHelp완성label처리와KO/EN/VI unit. 기존admin3case·#719keyboard/Escape/touch/modal초안·같은33소비자분석. 기존locator·형제수/geometryassertion유지 |
| F866-CI-002 / [CANCELLED Shard7 Job125858916888](https://github.com/planner77/masterGantt/actions/runs/41618392066/job/125858916888), `tests/e2e/cross-screen-regression.spec.ts:28`, assertion36 | rowHeightMax<=48px, actual87px | 동일test RED. name입력40px+아래번역명령40px+td6px/border=87px인**제품밀도회귀**. 줄바꿈/전역44px가설과구별 | domain frontend+read-onlyui_ux: ProjectMaster만compact번역trigger를입력옆에두고기존WorkspaceDialog로편집. 원본5열/960pxbudget·48px기본행 유지. 5폭/3언어·새Tabstop·기존마지막action·focus/Escape·401/412초안/취소보존 검증 |
| F866-CI-003 / [Docker Job125858916726 step22](https://github.com/planner77/masterGantt/actions/runs/41618392066/job/125858916726), `tests/transport/production-transport.spec.ts:114`, create55 | HTTP/HTTPS모두`getByLabel('프로젝트 이름',{exact:true})`입력대기180000ms timeout | 별도transport config의선택언어계약을짧은동일페이지probe로확인중. runtime권한·TLS원인과구별하며관측전언어원인확정금지 | infra: 원본production HTTP/HTTPS기동·설정locale·재시작/권한/Origin/revision/쿠키/비밀번호/로그아웃 전체검증. 기존timeout/trace비노출·gate유지 |

최초부터현재까지로컬실패합집합(앞절의alias/physical공백·사전·chart·migration·LLM·snapshot/parser)도보존한다. 이번remote직접실패합집합은위**3spec/4case**(Chromium2+HTTP/HTTPS2)다. Docker기본정책상trace/screenshot/video를수집하지않고, Shard7reportupload는취소되어원본joblog를근거로사용한다. Shard1report/trace와sourceartifact ZIP은읽기전용자료이며실행하지않았다.

### 재작업 경계

user는원장참조·현상/원인·보완·리뷰/충돌처리후새PR CI시작을승인했다. 제품후보0.140.0은유지하며HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false다. 기존Required3/8Shard/Full·metadata/Trusted·Owner/Main/GHCR/Finalizer/권한을변경하지않는다. UI문서·TestPlan·WorkPacket을동기화하고후보동결후위전체실패와인접·음성경로를검증한다. 새Head의quality/e2e/docker·Trusted/Manager ACCEPT는NOT TESTED, MERGE_READY=BLOCKED다. CI결과완료모니터링·병합·게시·Issue종료는이번범위에없다.

### REWORK1 원인 확정과 추가 소비자 감사

- F866-CI-001은 ContextHelp 공유formatter에서 완성된 source/등록 EN·VI prefix/suffix형 이름을 구별해 교정했다. 기존 admin/helper selector와형제수단언은변경하지않고 원본master RED→GREEN을확인했다. 추가prefix형2case의RED와 Object.fromEntries type추론오류(TS2352)는 typed Map·13case 회귀로수정했다. 관련33도움말소비자와8개browser spec을분석했다.
- F866-CI-002는 ProjectMaster만name input+번역아이콘을한행으로정돈하고WorkspaceDialog로편집하도록교정했다. 원본87px→실제46.5~47px, 기존fine48px상한을유지했다. 새Tab정지점·Enter/첫한국어focus/Escape복원과원래3Tab마지막action을검증했다. 새focus구현RED는modal표시후boundedRAF, EN긴usage56.5px RED는보조문구ellipsis/full title·숫자상시표시로수정했다. 기본3언어×5폭행<=48/coarse44px 및행<=52와401/412초안·취소보호는유지했다.
- F866-CI-003은 같은실패Head의실제이미지 `sha256:0910cab958d7ac7d1e220925af1b3f230e772583043db4641f132e9b278813f1`로 HTTP/HTTPS 모두 navigator en-US/html lang en/KO프로젝트label0·ENlabel1을확인해확정했다. 입력5개·pageErrors0·ready정상으로JS미기동/Origin·readiness오류가설을기각했다. 별도 `tests/config/transport.config.ts`에ko-KR만명시하고같은이미지·변경없는원래2protocol case전체가PASS(16.8초)했다. HTTPsecure=false/HTTPSsecure=true와TLS검증·실제쿠키/Origin/revision·컨테이너재시작/영속성·rotation/revocation·crossProject/logout을유지했다. 무조건적인앱기본KO화가아니다.
- 수동browser.newContext가공통locale를상속하지않는다는가설은설치Playwright1.63 `runBeforeCreateBrowserContext`의combinedoptions주입과기존#719touch PASS로**기각**했다. 59경로73호출을 [감사명세](evidence/issue-866/rework-1-context-audit.json)에보존하고 불필요한일괄test수정을하지않았다. nativeGantt의기존영어action literal/array/인수소비자는독립AST감사에서미수정0건이었다.
- **F866-SSR-001 / 추가요구사항누락:** 독립QA가VI390실제캡처에서4개관리자Server Component의h1/설명/help가KO로남는것을발견했다. 기존key검사가i18n import없는파일을건너뛰어놓친것으로 원격최초3spec실패와별도다. 새무조건ServerrawJSX검사를먼저실행해17개누락 RED를확인하고4페이지 LocalizedText/정적사전으로보완한다. plainEnglisheyebrow도브랜드/보존도메인용어와구분해3개언어표시를검증한다.
- 로컬실행환경에서infra격리runner가생성한 `test-results/transport`의root소유권때문에다른Playwright기동EACCES가발생했다. 해당infra생성subtree만uid/gid1000으로복원하고기타repo/운영파일을재귀변경하지않았다. 검증runner내CA/hosts만수정했으며hostCA/hosts는불변, 고유test컨테이너/volume은정리했다. 이환경실패와제품오류를구분한다.

실패Head이미지의수정된test계약2/2와최종candidate제품이미지의검증은구분한다. 후자는제품source동결후한번실행하여직접·인접소비자를같은후보로확인한다. PR새Full/Trusted와실운영LLM·TLS는여전히NOT TESTED다.

### REWORK1의 추가 로컬 실패와 복구

원격Full의ESLint는PASS였다. 이번동결후로컬전체lint는이전production build가생성한 `.runtime-tools/**/*.js`를소스와함께읽어require-style15errors를냈다. 새제품TS오류가아니며freshCI의lint-before-build환경과구별한다. git ls-files로비추적생성물임을확인한해당디렉터리만/tmp에보존하고동일 `npm run lint`를다시실행한다. ESLint정책/ignore/Required gate는변경하지않았다. production build성공은별도명령/로그로보존하고최종source/test동결지문은변하지않는다.

### F866-ERROR-002 — 인접 WBS 404 안내의 안전 코드 매핑 누락

최초 보완 동결 source `39103e836e5a0a80ca70c29e6f8e91c119f3cc6ed58621c65bd20ff7473f7e1e`에서 원격 직접 실패와 공유 도움말·i18n·실제 SQLite 인접 경로 24case를 실행했다. 결과는 **21 PASS / 3 FAIL**이다. #719 milestone geometry 및 milestone/resource 지연 WBS 오류 fixture가 `PROJECT_NOT_FOUND`를 반환할 때 기존 고정 안내 대신 일반 오류가 표시됐다. 원격 Full의 직접 실패와 구분한 추가 제품 회귀이며 타이밍·언어 상속·fixture 오류가 아니다.

`safeApiError`가 raw error.message를 숨기도록 바꾼 F866-ERROR-001의 code allowlist에 PROJECT_NOT_FOUND가 빠진 것이 원인이다. 임의 응답 문자열을 다시 노출하지 않고 기존 정적 사전의 프로젝트 미발견 문구로 매핑한다. 새 회귀는 비밀처럼 보이는 upstream prose를 무시하는 KO 결과와 EN/VI 결과를 고정 검증한다. 먼저 1 FAIL/3 PASS를 재현했다. 첫 후속 검사는 병합 사전의 기존 영문 문구(`The project could not be found.`) 대신 다른 사전의 같은 키 문구를 기대해 1 FAIL/18 PASS였으며, 실제 우선순위의 기존 문구로 새 assertion을 바로잡았다. 제품 사전과 기존 브라우저 assertion은 변경하지 않았다. 최종 관련 3suite19case PASS다.

중간 후보의 전체 Vitest3562 PASS 및 로컬 image `sha256:72d7ed652b8c4aa2867d8b9441994183ef03a5f152cf1a4874e8377e69fad2f3`의 HTTP/HTTPS2/2 PASS는 이 추가 매핑 이전의 증거다. 이를 최종 후보 검증으로 재사용하지 않는다. 누적 실패 합집합에 해당 3case를 추가하고 동일 수정 source에서 다시 실행한다. 기존 assertion/skip/retry/timeout·전송 보안 gate는 유지한다.

### F866-ENV-003 — 동일 로컬 호스트의 검사 동시 부하

수정 source `1b339a914781f565f496800808a6d38bc898cc01bdccb5ba7a204f70fb916d72`에서 브라우저/전체 Unit을 함께 실행한 첫 검사는 294files/3562tests PASS, LLM real-source AST boundary 1case가 기본 5000ms를 넘겨 FAIL(52.46초), 기존 1file/3case skipped였다. 같은 source의 해당 suite만 실행하면 3/3 PASS(1.60초)다. 원본 원격 Quality와 직전 후보의 전체 Unit PASS 이력도 유지한다.

브라우저 종료 후 전체 Unit을 다시 실행했으나 typecheck와 같은 호스트의 다른 프로젝트 작업이 겹친 상태였다. 관측값은 16 CPU, load average13.95, swap4059/4096MiB였고 여러 Unit worker와 tsc가 동시에 CPU를 사용했다. 이 실행을 완전히 격리된 순차 검사라고 표시하지 않는다. #737 backup/restore 2case와 resource-drill raw Task budget 1case의 5초 초과도 추가 관측했으며 결과를 아래 최종 표에 보존한다. 제품 오류가 없다는 결론은 개별 PASS만으로 내리지 않는다. 모든 assertion·5000ms 제한·CI 설정을 유지하고, 다른 프로젝트는 건드리지 않은 채 로컬 전체 Unit worker 수만 제한해 같은 source의 전 사례를 통제 검증한다.

상기 두번째 부하 실행의 최종 결과는 2files FAIL/293 PASS/기존1skipped, 3tests FAIL/3560 PASS/기존3skipped,48.88초다. 실패는 위 #737 두 case와 resource-drill 한 case뿐이며 LLM boundary는 이 실행에서 PASS였다. 첫 실행과 두번째 실행의 실패 합집합 3suite4case를 모두 유지한다.

### REWORK1 최종 source 교차 검증

source1209파일 SHA256은 `1b339a914781f565f496800808a6d38bc898cc01bdccb5ba7a204f70fb916d72`이며 검사 전후 불변이다. 앱/테스트 snapshot tree는 `8cf310abb6f50571e413e171ba739d9c00414584`다. 이후 문서/정제 증거/새 합성fixture 캡처만 추가한다.

| 범위 | 동일 source 실제 결과 | 명령·경계 |
| --- | --- | --- |
| 전체 Unit 및 최초~현재 실패 합집합 | 295files/3563tests PASS, 기존1file/3tests skipped,114.73초 | `npm test -- --maxWorkers=2`; 로컬 worker만 제한. assertion·기본5000ms·CI 설정 불변 |
| 원격 직접 실패 및 인접 브라우저 | 24/24 PASS,2.8분 | admin-auth-layout/cross-screen-regression/#719-contextual-help/i18n-master-data/i18n 5spec; workers1/retries0/max-failures0 |
| typecheck / 전체 ESLint | PASS / 0errors18warnings | `npm run typecheck`, `npm run lint`; source/정책 오류를 숨기는 ignore 추가 없음 |
| root/외부cwd 발견 / Markdown | 296Unit파일·874browsercase 동일 PASS / 397파일 PASS | `node scripts/verify-test-discovery.mjs`, `node scripts/check-markdown-links.mjs` |
| 별도 Agent 안전 오류 검토 | 미해결P1/P2=0; 독립2files12tests PASS | 현재 source 읽기 전용. 신뢰된 인간 QA·Owner/Manager 최종 승인과 구별 |

공유help의원래 geometry/형제수, populated table48px, 번역modal Tab/Enter/첫focus/Escape복원, 3언어×5폭/coarse44px, 실제SQLite401/412초안보존·취소, nativeGantt동일인스턴스/스크롤·언어변경쓰기0, SSR관리화면EN/VI, WBS404/지연·report준비경계를확인했다. 최초부터현재까지Unit실패·원격직접4case·추가#719 3case가모두최종실행에포함됐다. fullUnit을workers2로통제하자5초초과합집합4case도모두통과했다. 이는관측부하의영향을지지하지만원격성공을보장하지않으며기존부하FAIL도그대로유지한다.

정제결과는 [rework-1-local-validation.json](evidence/issue-866/rework-1-local-validation.json)에보존한다. 원본 [local-validation.json](evidence/issue-866/local-validation.json)·원본CI보고서는덮어쓰지않았다. PR본문의3548PASS·옛지문은최초Head98272e1의역사적증거이며새Head의증거는이번명세와STATUS댓글을따른다.

### 최종 후보 production image·전송 및 제출 경계

동일snapshot tree `8cf310abb6f50571e413e171ba739d9c00414584`를격리archive로만들어표준Dockerfile로빌드한image `sha256:ddccd3883ad2d125a2f162fbbfaf832f7882301eea740cb072e542033f764a83`에서 Next production/TypeScript/runtime-tools build PASS, 기존production HTTP/HTTPS **2/2 PASS(21.7초)**, 잘못된설정거부6case PASS·잘못된설정에서migration쓰기0을확인했다. Node26.8.2/Next16.4.2/SQLite13.0.3/Playwright1.63.0/Chromium153(rev1243)의로컬격리runner다. HTTP9.9초/HTTPS10.2초이며원본180초timeout·0retry·인증CA·실제Nginx/TLS·쿠키/Origin/revision/재시작영속성·비밀번호rotation/세션revocation·crossProject/logout을유지했다.

검사전후5055Gitblob및1209source파일이원본snapshot과동일했다. 고유prefix시험container/volume잔여0, archive생성물UID1000복원, hostCA/hosts와workingtree불변이다. image에는version0.140.0만label했으며옛Head나정식releaseauthority를부여하지않았다. 정제명세는 [rework-1-final-transport.json](evidence/issue-866/rework-1-final-transport.json)이다. 중간tree4388d27/image72d7ed6의18.3초PASS는SUPERSEDED_INTERMEDIATE로구분하고최종검증에대입하지않는다.

DOCUMENTATION_SYNC와AC01~09구조검사PASS, 문서·코드·테스트의의미정합성사전검토를마쳤다. 관련문서DESIGN/I18N/UI_UX/TEST_PLAN/CI_CD/REMOTE_VALIDATION/CHANGELOG/WorkPacket을갱신했다. 재작업API/DB/LLM/권한/일정계약변경은없어그문서의기존통합PR변경만유지했다. 최신main352a43e74c7b34c72d952f67783a53463f8b519d에충돌없음·원격review threads0을조회했다.

새Head/Full Run·attempt·당시Base/test-merge는PR/Issue STATUS댓글에기록한다. 새quality/e2e/docker/Trusted/Owner·Manager ACCEPT=NOT TESTED, MERGE_READY=BLOCKED다. CI완료모니터링·병합·Main/GHCR/tag/Release·branch정리·Issue종료는수행하지않는다. HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false를유지한다.

## PR870-FULL-002 — Full #3469.1 실패와 REWORK2 (2026-11-03)

이전 Full3468.1·REWORK1의 원격/로컬 실패와 중간·최종 후보 증거를 유지한다. 두 번째 원격 Full의 정제 전체 증거는 [CI41640034518 attempt1](evidence/issue-866/ci-41640034518-attempt-1.json)이다. 원본 run·artifact·로그만 읽었으며 새 CI 결과를 모니터링하지 않았다.

| 원본 실행 | 출처 및 판정 |
| --- | --- |
| [Full3469.1](https://github.com/planner77/masterGantt/actions/runs/41640034518) | Run41640034518/attempt1, pull_request/CI, Head`a2b4766651f0a4fe9fbc2cf9f887f03e78ed1a19`, Base`352a43e74c7b34c72d952f67783a53463f8b519d`, test-merge`3260201076458249ab8e599c672cfca852634727`; source artifact와 현재PR·commit→PR 단일 귀속 교차 검증 |
| Quality aggregate125933359482 | SUCCESS. TypeScript/ESLint/Vitest/정책/PR production build 실행 성공. 새 Head 성공으로 재사용하지 않음 |
| E2E aggregate125933998758 | FAILURE. Shard1 Job125932521351 실제3PASS/1FAIL/125NOT RUN. 나머지7Shard CANCELLED; 전체 로그의 추가 실제FAIL0. 계획874case 중 관측67PASS/1FAIL/806미완료·미실행 |
| Docker 구현125932521432 / aggregate125934860814 | SUCCESS. 원래HTTP/HTTPS2/2 PASS16.6초, 설정거부6·Compose/SQLite영속성 PASS. 이전 transport 오류 재발 없음 |
| [Trusted1115.1](https://github.com/planner77/masterGantt/actions/runs/41641270830) / Job125935104752 | 원본Full 실패의 파생 FAIL. validator352a43e7, automated_qa=FAIL, PR Head/base/test-merge 필드null인 조기 차단. Trusted 출처검증·독립 QA·Owner 승인 완료를 뜻하지 않음 |

원본 첫 실패는13:02:45Z의 `country-calendar-admin.spec.ts:76` → assertion151:316이다. 실제SQLite Import/metadata/rename/delete/Project Preview·Save 및412 경계 뒤, 422 미확보 응답은 확인했지만 alert의 `US 2032`가 `해당 국가·연도 공식 자료가 미확보입니다.`로 바뀌어5000ms에 FAIL했다. 이후 Save disabled 단언은 원본에서 미도달이므로 PASS로 세지 않는다. 이전 admin auth3case/cross-screen3case 및 populated행·HTTP/HTTPS 보완은 이번 원격의 해당 실행 범위에서 통과했다.

### Cross-run 원인과 제한적 확대 재현

| 실패 ID·분류 | 원인·반례·보완 경계 |
| --- | --- |
| F866-CALENDAR-001 / PRODUCT | 최초 i18n/안전 오류 교정에서 미확보 상세 국가·연도를 제거했다. 해당 editor/safe-ui-error는REWORK1에서변경0이므로 새 매핑 때문에 생긴 회귀가 아니라3468조기중단으로 미실행된 잠복 오류다. 로컬 country전체6case는2FAIL/4PASS(2.8분)로 동일 US2032 손실을 재현했다. 응답422는정상이라 네트워크/권한/서버coverage오판 가설을기각했다. rawprose를복원하지 않고 exact국가·연도 식별자만제출countryRules/range와대조해 구조화state·React텍스트로 표시한다. 일반 고정문구와previewStatus는렌더시현재언어로번역한다. |
| F866-FIXTURE-002 / TEST_CONTRACT | country초기조회오류170, #730 stale395/503403, #491 template500111의4assertion(3case)이 임의서버문구노출을기대한다. 최초safeApiError의보안계약과불일치다. 두번째countrycase는expected제어된원문/actual고정조회실패로RED. #730/#491 직접case도각RED를확인했다. 고정안내와rawmarker비노출을검증하고기존409/503readiness·retry·detaildisabled·pending/dirty/401/412를유지한다. 가짜code를제품allowlist에추가하지않는다. |
| F866-WBS-ERROR-003 / PRODUCT_SECURITY | 8직접소비자/54합성error.message감사에서 WBS의response.json예외가safeApiError를우회하고dashboard/details가unknownError.message를표시하는누락을재현했다. nonJSON503의PRIVATE_UP본문조각이SyntaxError에포함됨을확인했다. transport의fetch/JSON경계를고정typed오류로감싸고두consumer는typed안전메시지외unknown예외를고정fallback으로표시한다. AbortError·stale/status·origin/provenance·음성응답과재시도복구를보존한다. |

[사전 소비자 감사](evidence/issue-866/rework-2-safe-errors-audit.json)의 위치는실패Head기준이다. 첫실패부터의누적파일합집합에 country-calendar-admin, issue-730-view-composer, project-transfer-layout-491, WBStransport unit 및country오류helper unit을추가한다. project-work-calendar-preview·project-resource-calendar-exceptions와이전admin/cross-screen/#719/i18n/실제SQLite, 전송보안을직접/간접/음성검증으로선정했다. 임의메시지복원·assertion/timeout/retry/skip·Required3/8Shard변경은하지않는다.

국가helper의최초일반안내동작 RED1/1 뒤45case와catalog2case47/47 PASS를확보했다. 이는최종통합source의원격또는전체브라우저PASS가아니다. 사용자선택국가·날짜범위, 유효연도1900~2199, 중복제거·잘못된path/code/Unicode/설명문자열거부와opaque연도2032를확인했다. 숫자보간Intl그룹핑으로2,032를만들지않는다. 별도QA가같은화면의preview상태안내한국어고정도발견해기존4key+새완료template로번역하며원래KO문장·상태/저장경계를유지했다.

### REWORK2 보완 중 추가 관측과 검증 범위 동결

WBS 기존두브라우저case는수정전각각안전한일반문구가표시되어rawprose기대값으로FAIL했다. transport확대unit은9PASS/8FAIL(2.26초)로nonJSON200/409/412/503·fetch원문/nestedcause·취소경계를재현했다. 첫보완후17PASS/1FAIL은bodyread중abort fixture가비동기abort전 `signal.reason`을읽어undefined를기대하는새테스트오류였다. Promise거절을먼저받은뒤현재reason과identity를대조하도록바로잡았고제품취소가드를완화하지않았다. 최종transport18/18 PASS(2.34초)다. 모든실패로그는/tmp에정제보관하고원본실패를PASS로덮지않는다.

최종후보source1211파일SHA256 `da05a70603a1fbf82e42f03756168ff23cbdd25ba03edff0773e3977794fb54c`, 앱/테스트snapshot tree`3cc1f5b11b088190a62158b46e91d166f84682d9`를동결했다. 전체 `npm test -- --maxWorkers=2`는296files/3619tests PASS, 기존1file/3tests skipped,118.87초였고source지문은불변이다. 새skip/timeout/retry·CI설정변경없음. 297Unit파일/874browsercase는root/외부cwd동일발견PASS다. 이후제품/테스트변경이생기면이증거의유효범위를재평가한다.

동결전독립검토는country45/45·WBS18/18 PASS, 현재미해결P1/P2=0이다. 업무명/원문오류를번역키로넣지않고국가/연도·technicalcode를보존하며known-provenance검증과data-ready차단·요청취소를유지했다. 이는신뢰된인간QA·Owner위험수용·최신Head원격Required3/Trusted·Manager ACCEPT가아니다.

보조archive검증 첫 호출은 이전manifest의tree필드를참조해KeyError였다. 이번snapshotTree필드에로컬검증기를맞춰5081Gitblob·1211source개별SHA를재확인했다. 제품source·gate·assertion은변경하지않았다.

### 동일 후보 image·전체 이력의 transport 재검증

동일snapshot3cc1f5b11b088190a62158b46e91d166f84682d9를표준Dockerfile로build한image `sha256:ea79e50714533f2fd1e6ca2846293f1179a7b36aee0d350e5138504d90b52447`는productionbuild와기존HTTP/HTTPS2/2 PASS(16.7초),설정거부6종·잘못된설정의migration쓰기0을확인했다. 원래180초timeout/0retry/TLS CA·Cookie/Origin/revision/restart/SQLite/rotation/logout을유지했고5081Gitblob/1211source전후SHA불변·ownedcontainer/volume잔여0·hostCA/hosts불변을확인했다. LOCAL이며새PRCI/MainGHCR성공이아니다.

### REWORK2 확대49case의 결과와 추가 수렴

첫동결후10spec49case를fail-fast없이끝까지수집한결과46PASS/3FAIL(15.8분)이다. country의원래US2032/Save차단은통과했으나새EN전환검사가KO고정dialog이름을계속조회해elementnotfound였다. 실제snapshot은Project settings/정상English안내(US2032)를포함했다. 언어무관dialog단일성검증으로새locator를교정하고synthetic422완료·전역privateprose비노출을추가했다. 이새테스트오류를제품미해결로분류하지않는다.

추가2FAIL은resource-calendar-exceptions의rawdetails문구기대와#491큰공수999999.99/50000.00의그룹핑없는기대다. 전자는실제API의구조화date/layer/resourceId/groupIds와두로컬그룹catalog로fixture를맞추고날짜/리소스/각그룹을따로검증한다. raw rules문장을복원하거나가짜ruleID를localkey로맞추지않는다. 후자는#866의ko-KR Intl표시계약대로999,999.99 M/D와50,000.00 M/M를독립literal로검증한다. 원래API숫자·M/D→M/M변환·두자리반올림·입력/연도/ID/CSV값은변경하지않았다. 추가감사는error.details11곳/7파일에서위한곳외새rawprose기대없음, 큰숫자20곳에서위2곳외현재불일치없음을확인했다. [details감사](evidence/issue-866/rework-2-details-audit.json)·[숫자감사](evidence/issue-866/rework-2-number-audit.json)를보존한다.

별도독립QA가같은충돌화면의고정라벨을번역된문자열상태에저장해언어전환후이전언어로남는**F866-CONFLICT-LOCALE-004/P2**를확인했다. 현재로컬target의ID+kind·날짜·enum을검증해typedentry를보관하고렌더시고정label/enum만번역하도록수정했다. 사용자이름/날짜는opaque보존한다. 최초helper45PASS/1FAIL RED뒤58helper+2coverage60PASS다. 중간TypeScript TS18046은callback안detail.path narrowing손실로stable path변수로교정했다. 기존401/412/isCurrent/dirty/초기화·요약focus/aria-invalid/describedby·Save차단·현재모든규칙수정버튼을유지했다.

**규칙상관한계:** server는요청마다새규칙UUID를생성하고clientdraft.key는전송하지않으므로server rules.UUID↔localkey의정확한매칭은실제계약에서성립하지않는다. rawfallback을허용하지않고현재모든초안규칙의이름/날짜/수정버튼을유지한다. QA는이번범위필수P1/P2제품보완으로보지않았으며정확한충돌규칙만특정하는기능은PASS로주장하지않는다. 구조화correlation계약추가는별도범위다.

### 최종 B 동결과 검증 선정

추가보완후1211파일SHA256 `b715f14349c42d05636f6bfbfbd14723c9558ac49195b31a126208e32166d83f`, snapshot tree`e1b41e1b6248f2422ee981fd35f4e4b575c5ee4b`로다시동결했다. A대비변경은calendar editor/helper/unit과country/resource-calendar/#491의E2E3파일뿐이다. A의image/단위/49case증거는별도로유지하고B성공으로치환하지않는다.

최종B는실제원격·로컬실패case합집합과변경직접/인접·음성경로35case/11spec로수렴했다. 기존49중30case와기존Issue5case를선정했다. 제외19개의비실패고급관점·전송등은A진단성공에한정하며B브라우저PASS에합산하지않는다. `--grep`은로컬진단범위선정이며CI의874case/8Shard·assertion/skip/timeout/retry/Required gate는그대로다. 과거alias/DB/LLM/사전/typedparser 등Unit실패는전체Unit으로, HTTP/HTTPS실패는동일B의전송full2case로검증한다. B독립helper58/58 PASS·읽기전용diff검토미해결P1/P2=0이며공식원격승인과구별한다.

### B 최종 Local Fast Feedback와 제출

동결B source1211파일SHA256`b715f14349c42d05636f6bfbfbd14723c9558ac49195b31a126208e32166d83f`는검사전후불변이다. 전체Unit296files/3632tests PASS·기존1file/3tests skipped(145.16초), 선별Chromium35/35 PASS(9.3분), 전체typecheck/ESLint0errors18warnings PASS다. 원격originalcountry422US2032와Save차단, EN/VI/KOalert/status·충돌label전환/쓰기0·rawprose비노출, typedWBS JSON/비JSON오류와재시도·stale/provenance, #491그룹핑/반올림·template초안/권한, 이전admin/행높이/#719·Gantt/번역초안·Issue869focus/scroll을확인했다.

같은Bsnapshot e1b41e1b6248f2422ee981fd35f4e4b575c5ee4b를표준Dockerfile로빌드한image`sha256:7c0365429908a4063785371bcb3133b79dc7363bfd67b3084f5bdc4c30080a64`에서productionbuild/HTTPHTTPS2/2 PASS23.0초(10.1/11.4초), 설정거부6·잘못된설정migration쓰기0을확인했다. 5082Gitblob/1211source전후일치·ownedcontainer/volume잔여0·hostCA/hosts불변이다. Node26.8.2격리runner이며원래180초timeout/0retry/TLS실제CA·Cookie/Origin/revision/restart/SQLite/rotation/logout을보존했다. A imageea79/3cc1snapshot의16.7초PASS는중간증거로따로보존했다.

[최종명세](evidence/issue-866/rework-2-local-validation.json), [B전송검증](evidence/issue-866/rework-2-final-transport.json), [중간A전송](evidence/issue-866/rework-2-intermediate-transport.json), [최종35선정목록](evidence/issue-866/rework-2-browser-selection.txt)을따른다. 이전보조증거와기존tracked캡처는덮어쓰지않았고신규합성캡처는output/playwright/issue-866-rework2에분리했다. details비JSON의별도브라우저주입은이번범위에서미실시이며공유transport/formatterUnit·소비자정적검토의증거로한정한다.

최종문서영향과AC01~09구조검사를재대조한다. riskHIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false유지. 실제독립Agent검토미해결P1/P2=0은인간최종QA/Owner위험수용이아니다. 최신PRHead/Base/test-merge·threads/충돌·새Full Run/attempt는STATUS댓글에기록한다. 새Required3/Trusted/Manager ACCEPT=NOT TESTED, MERGE_READY=BLOCKED다. 요청대로CI시작만확인하고완료모니터링·병합·Main/GHCR/Release/Issue종료는수행하지않는다.

## PR870-FULL-003 — Full #3470.1 실패와 REWORK3 (2026-11-04)

이전Full3468.1/3469.1과모든로컬실패·교정·선정제외의근거를보존한다. [새원본명세](evidence/issue-866/ci-41650170956-attempt-1.json)는3Full/3FAST·각attempt1/metadata-only0·rerun0/Trusted1114~1116및8Shard모든로그를대조했다. sourceartifact13235814297의정확schema/중복키·타입·PR870단일귀속/Head/base/test-merge/attempt와실제ZIP/API digest를읽기전용검증했으며PR코드나ZIP을실행하지않았다.

| 원본 실행 | 실제 결과와 출처 |
| --- | --- |
| [Full3470.1](https://github.com/planner77/masterGantt/actions/runs/41650170956), Run41650170956/attempt1, pull_request/CI | Head`bfe2362a9b0d79128c4fd7e2e97a69f3e699f2d9`, Base`352a43e74c7b34c72d952f67783a53463f8b519d`, test-merge`74739b5a83ef1aec258b492e4a2e01c4674279d8`; FAILURE |
| Quality125968879044 | SUCCESS. 원본전체Unit296files/3632testsPASS·기존1file/3tests skipped93.74초; 타입/린트/정책/PRproductionbuildPASS. 새Head근거로재사용하지않음 |
| E2E125970209318 | FAILURE. Shard4 Job125967791231은5PASS/1FAIL/87NOT RUN; 다른7Shard CANCELLED 실제추가FAIL0. 전체874case중150PASS/1FAIL/723미완료·미실행 |
| Docker구현125967790891 / aggregate125970407199 | SUCCESS. 원래HTTPHTTPS2/2PASS16.7초, 설정오류6/invalid migration writes0/Compose영속성PASS. 원본registry write없음 |
| [Trusted1116.1](https://github.com/planner77/masterGantt/actions/runs/41651545207), Job125970714715 | 원본Full 실패의파생FAIL; 독립QA·Manager NOT TESTED. 새제품오류·정상Trusted출처완료로합산하지않음 |

원본첫직접오류는2026-11-03T14:11:21Z의`issue-725-process-workareas.spec.ts:98`→119:83이다. expectedheading `공정 & 작업 구역 관리`, actualheading `공정 &amp; 작업 구역 관리`로5000ms elementnotfound였다. auth/context부족·EN선택·로딩미완료가아니며snapshot의실제KO제목으로확인했다. 해당spec·두heading소비자·catalog는982/a2/bfe사이같은blob이므로REWORK2신규회귀가아닌첫i18n변환의잠복오류다. 이전admin3/crossscreen3/country6/HTTPHTTPS2는이번원격실행에서통과했다.

### Cross-run 분석·제한적 확대·보완

- **F866-ENTITY-005 / PRODUCT:** JSXText의HTMLentity는React컴파일이해석하지만이를JS번역리터럴로옮기면`&amp;`/`&apos;`가그대로표시된다. KO는키원문을반환하고encoded/decoded사전alias가동시에있어기존key존재검사를통과했다. sourcebfe기존i18n검사2files10/10PASS(1.31초)는교정성공이아닌탐지사각의근거다.
- 원본#725전체2case를로컬 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/issue-725-process-workareas.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0 --output=test-results/rework3-red`로재현해1FAIL/1PASS(1분)를확인했다. 첫caseheading에서실패했으며두번째기존owner선택case는그대로PASS였다.
- [정적entity감사](evidence/issue-866/rework-3-entity-audit.json)에서활성JS번역리터럴5곳(두heading·readonly안내2·설비등록안내1), encodedcatalogkey7개/번역값4개를확인했다. 정확한정적표시문자와canonical사전을맞추고동등한alias를정리한다. XMLserializer의정상escape14곳은유지한다. 이미decoded인TaskContext안내/Milestone표문구는기존소비자와의정합성만대조한다.
- 사용자입력·displayName·runtime translate에일반HTMLdecoder를넣거나innerHTML로렌더하지않는다. 정상JSXText/quotedJSXattribute의entity해석과JS-expression문자열의미해석을회귀로구별한다. en/vi에도entity문자열이표시되지않아야하며자유원문의literal `&amp;`는그대로보존한다.
- 직접인접소비자 `project-logistics-management.spec.ts`의readonly따옴표안내294/461과같은제목813도함께선정한다. #725실제SQLite/타공정E10/재시작·legacy410·Gantt보존·관리자auth/Revision기존단언과readonly버튼부재·도움말/Escape/가로overflow를유지하고KO/EN/VI전환·프로젝트쓰기0검증을확장한다.

기존원장의실제실패합집합(도움말/기본행/국가및충돌문맥/WBS안전오류/숫자표시/Issuefocus/HTTPHTTPS·Unit전체)을최종source에서선정·재검증한다. version0.140.0/HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false와Required3/8Shard·권한·Full/metadata·Trusted/Owner정책을유지한다. 새Full시작은후속STATUS에기록하고결과모니터링·병합·Main/GHCR/Release·Issue종료는수행하지않는다.

### REWORK3 단위·직접 검증 중 관측

첫동결1211파일SHA256`5b12aee110c164d5dc1390fee7aabd415fce24d5d746833ac46a90efc6ea8358`/snapshot`85a66cfac02e46872bf4d310f4974f52a3d69def`에서전체Unit296files/3636tests PASS·기존1file/3tests skipped156.73초를확보했다. 직접6case는4PASS/2FAIL(3.1분)였다. 원래원격실패#725첫case의모든업무/E10/restart는1.3분PASS했고, typed설비상태·탭전환·5폭도PASS였다.

두FAIL은새locale검증의TEST_CONTRACT다. #725에서legacy공정pane에는없는`project-process-mapping-title` ID를가정했고, readonly물류pane에서는정상적으로숨겨보존한Gantt에공유visible전제helper를사용했다. locale별정확한heading접근성name과숨겨진Gantt의동일DOM/API/instance식별자보존을검증하도록신규probe를교정한다. 원래기존단언이나공유helper의visibility조건을변경하지않으며새timeout/retry를주지않는다. 최종source를다시동결해직접6case와이전실패합집합35case를같은source의두part로검증한다.

새guard는최초3PASS/1FAIL에서16관측(활성5+사전7+값4)을실제로잡았다. 첫교정중catalogshell항목이남은검사11PASS/1FAIL도보존하며정규화완료뒤i18n14/14PASS1.26초다. 독립qa_review14/14PASS1.94초·미해결P1/P2=0은이정적교정/사전검토범위이며최종브라우저·원격QA성공이아니다. canonical영수증은 [rework-3-static-canonical-receipt.json](evidence/issue-866/rework-3-static-canonical-receipt.json)에alias삭제5/key변경2의동등값·placeholder보존을기록한다.

### REWORK3 B 동결 교차 검증과 인계

B동결1211파일SHA256`fb8aef37f15108c26761ad1bf26331cfd04371bd906217932a495843f322c387`, snapshot`d025c60976e184d424cd642f0852c7e7b46f21df`는A대비E2E2파일만다르며production은동일했다. B에서전체Unit296files/3636tests PASS·기존1file/3tests skipped111.65초, 직접6/6 PASS2.4분 및과거실패/직접·간접/음성35/35 PASS8.3분으로고유41case/13spec을확인했다. 두part전후같은Bsource를검증했고생성된Next config와기존tracked캡처는원복했다. 전체typecheck·ESLint0errors18warnings·발견297Unit파일/874browsercase PASS다. 새skip/timeout/retry/CI8Shard변경은없다.

같은B tree를표준Dockerfile로build한image`sha256:4b533dad06eaf16770fccb2f3155457ebe43f71494327d1383ee12b74062db08`에서productionbuild/기존HTTPHTTPS2/2 PASS21.2초(10.5/9.1초),설정거부6종/invalid migration writes0을확인했다. Node26.8.2/Next16.4.2/SQLite13.0.3로컬격리runner이며원래180초timeout/0retry/TLS실제CA·Cookie/Origin/revision/restartSQLite/rotation/revocation/crossproject/logout을유지했다. 5096Gitblob/1211source전후동일·ownedcontainer/volume잔여0·hostCA/hosts불변이다. A archive는build미실시중간증거로보존했으며새Head/GHCR성공을뜻하지않는다.

[Local검증명세](evidence/issue-866/rework-3-local-validation.json)·[B전송명세](evidence/issue-866/rework-3-final-transport.json)·[직접6선정](evidence/issue-866/rework-3-direct-selection.txt)·[과거35선정](evidence/issue-866/rework-3-history-selection.txt)에명령·환경·수치·범위를보존한다. 새합성KO/EN/VI캡처는output/playwright/issue-866-rework3에분리했다. 이전source/canonical/CI/실패증거는덮어쓰지않았다.

정적교정과수정된E2E에대한독립qa_review검토미해결P1/P2=0·독립i18n14/14PASS는사전검토이며인간최종QA/Owner승인이아니다. RiskHIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false 유지. 최신Head/Base/test-merge·review threads/충돌·시작FullRun/attempt는STATUS댓글에기록한다. 새Required3/Trusted·Owner/Manager ACCEPT=NOT TESTED, MERGE_READY=BLOCKED다. 요청범위는CI시작까지만이며완료모니터링·병합·Main/GHCR/tag/Release/Issue종료는수행하지않는다.
## PR870-FULL-004 — Full #3471.1 실패와 REWORK4 (2026-11-04)

기존 Full3468.1/3469.1/3470.1, 각 1회 Attempt, 세 차례 REWORK의 원본 FAIL·기각 가설·보완·로컬 검증은 위 절에 불변으로 유지한다. 이번 추가 원본은 [Full #3471.1](https://github.com/planner77/masterGantt/actions/runs/41704268626), Run41704268626 / attempt1, event=pull_request, workflow=.github/workflows/ci.yml, Head 3ef679d930d50bf4eb9d597b31a49be795baca74, Base/main 352a43e74c7b34c72d952f67783a53463f8b519d, 조회 시 PR API test-merge 66db3d0e2f215edbab2a5b5810f6bd80b2ad02cc다. Run created 2026-11-03T19:32:55Z, completed FAILURE. 이전 Full 네 개의 Head는 98272e1 → a2b4766 → bfe2362 → 3ef679d이며 각각 다른 소스이므로 과거 PASS는 최신 Head의 PASS가 아니다. 별도 FAST #243~#246은 advisory SKIPPED이고 Full 승인으로 사용하지 않는다.

### 원격 실행·Shard 원본과 파생 판정

| 범위 | 실제 판정·근거 |
| --- | --- |
| Quality / Job126160284591 | SUCCESS. Vitest·타입·ESLint·정책·PR production build 경로 성공. |
| Docker / Job126161816322 | SUCCESS. 첫 Full3468의 transport locale 원인 보완 이후 Docker 3연속 성공. |
| Chromium E2E aggregate / Job126163181918 | FAILURE. Shard3 Job126158915804의 E2E 실행 step7 직접 FAILURE에서 파생. |
| QA Final Automated / Job126163231575 | FAILURE. Required E2E 미통과에 따른 파생 차단; 독립 신규 제품 오류로 계수하지 않음. |
| Shard3 / Job126158915804 | 계획153case 중 28 PASS / 1 FAIL / 1 SKIPPED / 123 NOT RUN. 원본 실패 시각 2026-11-03T19:45:53Z. |
| Shard1/2/4/5/6/7/8 | 7 Job 모두 CANCELLED. 로그에서 각각 41/7/9/23/29/28/23 PASS를 실제 관측했고 직접 실패 추가 0; 취소된 나머지는 NOT RUN/INCOMPLETE이다. |
| 8-Shard 전체 / 계획874case | 로그로 관측한 188 PASS / 1 FAIL / 1 SKIPPED / 684 미완료·미실행. 7개 취소 Shard를 완료 PASS로 보지 않는다. |

정제 작업별 Job·계수·Run·출처는 [ci-41704268626-attempt-1.json](evidence/issue-866/ci-41704268626-attempt-1.json)에 추가했다. Source artifact ci-pr-source-41704268626-1은 Run API의 존재·ID13264592408·미만료만 확인했다. ZIP payload 및 digest를 직접 검증하지 않아 provenance 전부 PASS로 주장하지 않는다. 해당 로그의 Node.js20 deprecated 경고는 E2E 직접 실패가 아니다.

### F866-TOUCH-006 — 물류 유형 검색 입력의 터치 높이 계약 누락

- **원본:** [Shard3 Job126158915804](https://github.com/planner77/masterGantt/actions/runs/41704268626/job/126158915804) / tests/e2e/logistics-table-density.spec.ts:79의 기존 #454 after 5폭/keyboard/coarse 사례, assertion126. 기대 높이 >=44px, 실제 20px. 터치390x900의 설비/시스템 유형 화면에서 visible button,input,select 전체를 검사하는 경로이며, assertion·timeout을 느슨하게 해서 해결할 문제가 아니다.
- **소스 근거/분류 PRODUCT:** i18n 통합 때 물류 유형 관리에 별도 이름 또는 코드 검색 input이 .panel 직속 label로 추가됐다. CSS의 --catalog-control-height는 coarse에서44px이나 높이 스타일은 .addRow input과 .dialog input에만 적용된다. 번역 필드 input은 별도44px, 버튼은 .panel button 44px로 보호되며 신규 검색 입력만 누락됐다. 해당 컴포넌트 Git blob1657c52becf564764feaeb08780ed36187aef79b는 Full3468~3471의 네 Head에서 동일해 최근 REWORK3에 새로 들어온 수정이 아닌 초기 #866 변경의 잠복 회귀다.
- **관측/반례:** 실제 원격 오류의 20px 입력 원소 식별은 오류 메시지에 기록되지 않았으므로 가장 개연성 높은 원인으로 평가한다. 별도 격리된 Chromium144/Python Playwright의 대표390px hasTouch DOM·동일 관련 CSS selector에서 검색입력 minHeight=0/실측21px를 확인했다. 기존 높이 selector에 .panel>label>input을 포함하면 minHeight=44px/실측44px, addRow input·tabs button은 전후44px였다. 이 실험은 앱 전체 E2E 재현이나 Trace 확인이 아닌 제한적 CSS 인과성 검증이다.
- **일괄 보완:** src/features/logistics/logistics-type-catalog-admin.module.css의 기존 label/input 스타일에 .panel 직속 검색 label/input을 편입하여 모바일만이 아니라 데스크톱과 키보드 조작에도 동일한 공통 컨트롤 형태를 적용한다. tests/e2e/logistics-table-density.spec.ts의 기존 coarse 경로를 EXTEND하여 설비/시스템 탭 각각 검색 입력 높이를 접근성 label로 명시적으로 확인하고 기존 전체 button/input/select >=44px assertion을 그대로 유지한다. 테스트 skip·retry·timeout·8Shard·Required3·보안/권한/저장 계약은 불변이다.
- **누적 직접 실패 파일 합집합:** admin-auth-layout.spec.ts, cross-screen-regression.spec.ts, country-calendar-admin.spec.ts, issue-725-process-workareas.spec.ts, logistics-table-density.spec.ts, tests/transport/production-transport.spec.ts. 이전 재작업에서 추가한 #719/context·i18n·Project Issue·WBS/Calendar·Project Logistics·번역 초안/권한 등 직접·인접·음성 소비자 선정은 유지한다. 최신 logistics-table-density.spec.ts는 REWORK3 선별 13spec/41case에 없었다. 반복된 잠복 오류 방지를 위해 최소한 이번 직접 Spec 전체 및 누적 5개 E2E 원본 Spec과 production transport를 후속 실행 대상으로 유지한다.
- **검증의 정확한 경계:** 동일 실제 저장소 Head의 전체 Vitest, 타입/린트, Chromium E2E, Docker는 이번 수정의 로컬 checkout·GitHub 런타임이 없어 NOT TESTED. 위 격리 CSS 실험만 제한적 PASS이며 과거 REWORK3 41case PASS를 새 후보의 PASS로 전용하지 않는다. 다음 원격 exact-Head Full CI·Trusted QA·Owner/Manager ACCEPT도 시작 전 NOT TESTED다.
- **리뷰/충돌·안전:** PR API에서 HEAD3ef679d/Base352a43e, mergeable=true, 독립 review threads API에서 unresolved 0, main SHA가 base와 같았다. 현행 risk HIGH / OWNER_MANAGED / qa_required=true / release_required=true / release_authorized=false, MERGE_READY=BLOCKED. 코드·테스트·원장·Work Packet·정제증거를 단일 Git Data batch commit으로 게시하고 Ref를 단 한 번 갱신한다. 게시 후 새 Head/Run을 대조하지만 결과 모니터링/병합/Main·GHCR/Release·Issue 종료는 수행하지 않는다.

## PR870-FULL-005 — Full #3472.1 실패와 REWORK5 (2026-11-04)

이 절은 이전 Full #3468.1~#3471.1의 실제 실패·각 보완 및 로컬 증거를 소급 변경하지 않고 누적한다. 현재 접근 가능한 PR870 원본 Full은 **5회 모두 attempt1에서 FAILURE**이며 각각 다른 Head다. 원본 [Full #3472.1 / Run41710299107](https://github.com/planner77/masterGantt/actions/runs/41710299107), workflow `.github/workflows/ci.yml`, event `pull_request`, Head `0f9cc15ac140a19b06e9fe519c0883b3f9d58970`, Base/main `352a43e74c7b34c72d952f67783a53463f8b519d`, 조회 당시 PR test-merge `404e4884f5ea4ac9efdb7cfd4921c5ac511be4b0`, created 2026-11-03T20:11:46Z, completed FAILURE. 해당 Run의 source artifact `ci-pr-source-41710299107-1` ID13266017985는 존재·미만료만 조회했고 ZIP content/digest까지 독립 검증하지 않았으므로 검증된 source receipt라고 주장하지 않는다. FAST #247.1은 advisory SKIPPED다.

### Run/Shard 실제 판정

| 결과 집계 | 원본 Job/판정·근거 |
| --- | --- |
| Quality | Job126180959937 SUCCESS, TypeScript/Vitest/ESLint/정책/Next Production Build 성공 |
| Docker | Job126183101438 SUCCESS, 첫 Full의 언어 설정 transport 실패는 이번 원격에서 재발하지 않음 |
| E2E | Aggregate126182997462 FAILURE, [Shard3 Job126180157898](https://github.com/planner77/masterGantt/actions/runs/41710299107/job/126180157898) 실행 step7 직접 FAILURE |
| QA Final Automated | Job126183145112 FAILURE, E2E Required 실패에 따른 파생 |
| Shard3 원본 | 153중 29 PASS / 1 FAIL / 1 기존 SKIP / 122 NOT RUN. 직전 #3471 터치44px 실패 case `logistics-table-density.spec.ts:79`가 이번 원격에서 PASS |
| 다른7Shard | Shard1/2/4/5/6/7/8 모두 CANCELLED, 해당 로그의 관측 PASS는 각31/3/5/23/28/26/11, 직접 신규 FAIL 0. 미완료를 PASS로 합산하지 않음 |
| Full8 874계획 | 156 관측 PASS / 1 직접 FAIL / 1 SKIP / 716 미완료·미실행 |

세부 출처/Job/계수/오류 diff는 [ci-41710299107-attempt-1.json](evidence/issue-866/ci-41710299107-attempt-1.json)에 별도 정제 기록했다. E2E/QA 실패 2개는 Shard3 직접 실패 1개의 파생이고 서로 다른 오류 2건이 아니다.

### F866-PAYLOAD-007 — 다국어 표시명 Optional PATCH/POST 필드의 기본 전송 회귀

- **실제 최초 오류:** 2026-11-03T20:23:46Z, `tests/e2e/logistics-table-density.spec.ts:150` → `156` explicit payload 단언. 기존 #454 설비 유형 create와 name-only PATCH는 `{code,name,sortOrder}` / `{name}`을 기대하나 실제 요청에는 각각 `translations:{}`가 추가됐다. `If-Match` 네 요청의 기존 `"7"/"8"/"9"/"10"` 단언은 통과한 뒤 body deep-equal에서 실패했으므로 revision이나 인증 오류로 전가하지 않는다. 시스템 유형의 다음 같은 테스트와 나머지 E2E는 미실행이며 PASS라고 하지 않는다.
- **원인 (PRODUCT_CONTRACT + TEST_CONTRACT):** #866 UI의 `add/saveEdit`가 번역 변경 여부와 관계없이 `translations` 상태를 body에 넣는다. 서버 `parseDisplayNameTranslations`·`writeDisplayNameTranslations`의 기존 신규 계약은 생략=보존, 명시 `{}`=전체 해제다. 실제 #454 fixture에는 번역이 없어 데이터 소실이 관측된 것은 아니지만, 기존 번역이 있는 타입의 이름만 수정할 때 의도치 않은 해제가 발생할 수 있는 제품 위험이므로 테스트 기대값을 새 body에 맞추어 무작정 완화하지 않는다.
- **기존 이력과 관계:** 이전 #3468·#3469·#3470·#3471의 ContextHelp/행밀도/transport/캘린더/HTML entity/터치 입력 높이는 서로 다른 이슈이고 원장/Run에 남긴다. 이번 원본에서 직전 터치 입력 E2E가 실행 PASS했으며 그 다음 payload 단언에 걸려 다른 테스트가 노출되지 않았다. 같은 원인 분류의 후속 소비자(설비·시스템 유형, create/name-only PATCH/기존 번역 수정·전체 해제)를 함께 검토한다.
- **계약·수정:** 새 순수 `src/lib/i18n/translation-write-field.ts`는 원본과 현재 번역의 trim/NFC 의미 비교를 사용한다. 실변경이 없으면 field를 생략해 기존 API와 데이터 값을 보존하고, 값 추가/부분삭제 시 필요한 전체 번역 집합, 전체 해제 시 명시 `translations:{}`를 전송한다. 원시 nonblank 값은 서버의 허용 문자열·제어문자 검증을 통과하도록 임의 수정 없이 보낸다. `src/features/logistics/logistics-type-catalog-admin.tsx`의 add/saveEdit에 적용하고 기존 활성 토글/코드/If-Match/401/412/권한·원문 이름을 변경하지 않는다.
- **회귀 테스트:** 기존 `tests/e2e/logistics-table-density.spec.ts`의 정확한 구 legacy body/If-Match assertion을 유지한다. 해당 사례의 설비·시스템 각 경로에 EN 번역 추가→번역 미변경 이름 저장→전체 해제의 제출 body·원본name·기존 번역 보존 검증을 EXTEND한다. `tests/fixtures/logistics-admin-454.ts`의 모의 서버는 선택 번역의 replacement·omission·empty-clear를 실제 백엔드 의미대로 구현한다. `tests/lib/i18n-translation-write-field.test.ts`를 ADD하여 no-op/create/partial/full clear/trim/NFC/raw unsafe 입력을 직접 검증한다. E2E spec 개수·Case 총874·8Shard·assertion 기본치/skip/retry/timeout/권한·QA gates는 변경하지 않는다.
- **제한 검증:** 동일 helper Git blob `1370fa201453fc867bd4bc5d1c74617f103a2556`를 격리된 Node22.16/TypeScript5.8.3 스텁 환경에서 strict `tsc --noEmit` PASS, JS runtime 직접 11개 단언 PASS로 검사했다. 이 단독 proof는 실제 repo의 전체 Unit, 874 E2E, HTTP/HTTPS, Docker 검증과 다르므로 후자는 **NOT TESTED**다. 이전 Head의 PASS를 새 Head PASS로 승계하지 않는다.
- **누적 파일 합집합:** 기존 admin-auth-layout / cross-screen-regression / country-calendar-admin / issue-725-process-workareas / logistics-table-density / production-transport 원본에 최신 `logistics-table-density`의 서로 다른 explicit payload case를 추가한다. 이 Spec의 전체 case 및 인접 `logistics-type-catalog-admin.spec.ts`와 `i18n-master-data.spec.ts`, 서버의 managed-display-names·Logistics Catalog contract, 각 401/412·부분삭제 경로가 직접/간접·음성 후보이다. 새 Unit/E2E 범위는 실제 로컬 저장소가 없어 실행하지 못함을 명시한다.
- **진행 경계:** docs/ISSUE_866_FAILURE_ANALYSIS.md·Work Packet·I18N·API·Run evidence를 기존 본문 삭제 없이 갱신. 최신 main/PR 리뷰 스레드·충돌 재검토 후 단일 Git Data commit으로 게시하고 exact Head PR Full CI 자동 시작 여부를 확인한다. HIGH/OWNER_MANAGED, qa_required=true, release_required=true, release_authorized=false, MERGE_READY=BLOCKED 유지; 결과 모니터링/병합/Main/GHCR/Release·Issue 종료 제외.
