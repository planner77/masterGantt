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
