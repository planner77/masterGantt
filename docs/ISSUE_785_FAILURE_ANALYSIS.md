# Issue #785 — 누적 실패·충돌·검증 원장

Primary Issue: https://github.com/planner77/masterGantt/issues/785
기준: [공통 실패 원장](PR_CI_FAILURE_TRIAGE.md). 원본 실패를 삭제하거나 PASS로 소급하지 않는다.

## 착수 원격·충돌 상태

2026-10-23 main `427d22245fb8e11254b2424ea5147ccbd5766979` 기준 #785 기존 PR/리뷰/CI 없음. 새 독립 worktree를 사용하며 원래 작업 트리의 untracked 사용자 자료는 보존한다. 진행 #720/PR721 등 다른 Issue의 리뷰 스레드는 본 Issue 권한으로 해결 처리하지 않는다. 최종 게시 전 최신 main과 merge 충돌을 재확인한다.

## 초기 도구·환경 기록

| ID | 판정 | 사실·처리 |
| --- | --- | --- |
| ENV-001 | BLOCKED | 로컬 `gh pr list`가 HTTP401 Bad credentials. 인증값 조회/변경 없이 연결 GitHub plugin으로 조회/게시한다. 제품/CI 실패가 아니다. |
| TOOL-001 | FAIL | GitHub comments 첫 호출에 repo 키 사용으로 schema validation 오류. repo_full_name으로 수정해 댓글0 조회. Issue 댓글 작성도 pr_number/comment 필드로 수정한 뒤 PLAN 등록 성공(6366100567). 제품/CI 실패가 아니다. |

## PR / Run / Attempt

본 후보 작성 시 원격 PR CI 시작 전이다. 등록 후 정확 PR/Head/base/Run/Attempt는 동일 Issue STATUS 영수증으로 인계한다. quality/e2e/docker·Trusted·Owner: NOT TESTED. 이번 범위는 CI 등록까지만이며 결과를 모니터링하지 않는다.

## 구현·Local Fast Feedback

실제 최초 실패·원인·보완·source 동결 후 재검증을 여기에 누적한다. 실행 전 PASS로 기록하지 않는다.

### 최초 로컬 실패 이력 (수정 후 결과와 분리)

| ID | 실행/판정 | 최초 원인·조치 | 재검증 |
| --- | --- | --- | --- |
| LOCAL-F01 | frontend typecheck FAIL | 폐기 typed screen literal을 기존 navigation test가 사용(TS2345). 구 key는 normalize migration 입력 사례로 이동. `/tmp/785-typecheck-first.txt` | 관련 feature 2파일42 PASS 보고; 동결 최종 검증 별도 |
| LOCAL-B01 | backend typecheck FAIL | 다른 Agent 편집 도중 template graph line40의 in-progress 잘못된 type identifier(TS1131/TS1434). exchange 수정. `/tmp/issue-785-backend-typecheck.log` | source 미동결 검사로 최종 PASS 근거 아님 |
| LOCAL-B02 | backend Vitest 13중10 PASS/3 FAIL | 신규 fixture 반환 shape 오류, revision0의400/양의 stale412 구분, 기존 immutable trigger가 손상 주입 UPDATE 차단. fixture를 실제 DTO/양의 stale/FK-off source삭제로 교정; 제품 방어 유지. `/tmp/issue-785-backend-vitest-initial.log` | 재검증 대기 |
| LOCAL-D01 | domain Vitest107중102 PASS/5 FAIL | 구 Target audit1·legacy HTTP projection1은 v1 header 누락; WBS schema/1 기대3은 기본v2 전환. 명시v1 audit와 새v2 검증 분리 | 재검증 대기 |
| LOCAL-X01 | exchange Vitest71중69 PASS/2 FAIL | SHARED-only whole의 null coverage를 subset로 잘못 기대; large Plan audit에v1 header 누락. subset fixture/명시v1로 교정 | 후속70 PASS/1 FAIL |
| LOCAL-X02 | exchange Vitest71중70 PASS/1 FAIL | ZERO-A equipment subset을 없다고 잘못 기대. 원본 fixture를 명시 coverage1+SHARED/ZERO 선택으로 구성하여 raw5/known0/공유/partial을 함께 검증 | 재검증 대기 |

위 표는 Agent별 실행 보고와 로컬 로그 경로다. 원시 runtime 로그를 Git에 게시하지 않으며 실제 실행·동결 source 결과는 최종 반환 계약에 별도 기록한다. 원격 PR 실패는 아직 관측하지 않았다.

### 추가 사전 검토·통합 발견

| ID | 판정 | 최초 사실·조치 | 결과 |
| --- | --- | --- | --- |
| REVIEW-F01 | FAIL(실행 전 검토) | 기존 coverage를 퍼센트로 오해해100상한/%를 넣은 초안. 정수 물리 범위로 교정하고 quantity150/coverage125 fixture 추가 | 브라우저 검증 대기 |
| LOCAL-R01 | FAIL(수집 전) | 신규 physical source 컴포넌트 runtime @ alias가 Vitest 해석과 불일치 | 기존 상대 runtime import로 교정·2PASS, 설정/skip 변경0 |
| LOCAL-X03 | FAIL(typecheck) | 신규 exchange fixture의 optional filter 타입을 required DTO에 전달 | NonNullable로 교정·최종 동결78PASS 보고 |
| QA-P1-001 | FAIL(실제 SQLite 재현) | FK OFF로 task_id999999 archive binding을 주입하면 FK위반1인데 default resource HTTP200/WBS 정상. shared resource snapshot이 integrity guard 없이 inner JOIN 누락 | domain에 REWORK·명시409/원본불변 회귀 요청 |
| REVIEW-API01 | FAIL(공개 인벤토리) | integrated KPI config.targets/targetWithoutTaskIds/taskRows.targetIds가 공개 응답에 남음 | domain에 중립v2 boundary/실제 Resource·Group 배정 ID보존·회귀 요청 |
| REVIEW-HTTP01 | FAIL(정적 검토) | 새 usage 응답에 nosniff 없음, 공통 logging도 추가하지 않음·resolver/응답 예산 미명시 | backend에 nosniff/UUID/기존 한도·비절삭422 회귀 요청 |

Agent별 로컬 교정은 전체 source 동결 통합 검증을 대신하지 않는다. independent Agent pre-QA는 인간 Reviewer/Owner 승인 영수증이 아니다.

LOCAL-M01: pinned baseline 인벤토리 재생성에서 PCRE pattern에 git grep -E를 사용해 구문 오류/빈 목록이 발생했다. git grep -P + subprocess check=True + 비어 있지 않음 검증으로 교정하여 정확 baseline 155파일을 재생성했다. 테스트/제품 결과가 아니다.

QA-P2-002: 실제 SQLite defaultv2 `projectionOrder=resource,equipment`가200 physicalProjection을 반환하지만 retired diagnostics가 제거되어 client readDashboard=null. 신규 화면은 canonical WBS views를 사용하므로 v2의 구 projectionOrder를 명시410으로 종료하고 v1 audit은 유지하도록 설계 보완했다. 동결 후 실제 negative 재검증은 별도다.

LOCAL-D02: v2 전환 마지막 small batch의 synthetic legacy fixture를 schema2로 단순 재표기한 오류1건 FAIL. 실제v1 fixture로 복원하고 browser mock은 fulfill 경계에서 진짜 serializer를 사용한다. 기본 fetch의v1 위장 응답 수용을 완화하지 않는다.

QA-P1-001 독립 재현 후속: 동일 orphan1 원본/FK 위반을 보존하며 default Dashboard409 LOGISTICS_SOURCE_INVALID, WBS409로 확인. 원본200 실패는 이력으로 유지한다.

QA-P2-003: subset binding의 anchor_member_id를 FK OFF로999999로 바꾸면 FK위반1에도 기존 guard가 성공/defaultv2 report200을 반환하는 추가 누락을 독립 재현했다. backend에 `(project,binding,target,member)` 정확 anchor 검증과409·원본불변 회귀를 요청했다. 모든 archive 테이블 FK 목록과 guard 커버리지를 함께 재검토한다.

TEST_CONTRACT-785: 기본 client가 실제v2 schema를 요구하므로 기존 성공 mock은 fulfill 경계에서 toResourcePublicV2로 직렬화한다. pure v1 audit fixture를2로 재명명하지 않으며 malformed/wrong snapshot/오류 negative를 그대로 유지한다. 변경 공유 stateful fixture 및 Resource/KPI request-state 소비자는 확대 로컬 대상에 추가한다.

LOCAL-PREPR01: fast 실제 실행 BLOCKED(exit1), sourceStable=true, selection101·UNKNOWN28·missing0, 내부 검사0/NOT TESTED. 새 계약/UI/간접 server/shared fixture의 자동 producer-consumer map 미등록이 원인이다. targeted dry-run은 NOT TESTED(exit0), 자동선택 BLOCKED이며 실행 증거가 아니다. 공용 selector/gate를 완화하지 않는다. Manager가 Work Packet/TEST_PLAN에 직접·인접·음성 소비자를 수동 매핑한 로컬 실행을 별도 기록하며 CLI BLOCKED를 PASS로 바꾸지 않는다. [fast](evidence/issue-785/prepr-initial-fast.json), [targeted](evidence/issue-785/prepr-initial-targeted.json).

REVIEW-CONTEXT01: Task 실물 출처에서 기존 공정/WorkArea가 누락되지 않도록 actual archive source context를 additive readonly DTO/UI로 제공한다. 직접 Task W2 선택을 채우거나 source를 직접 원본처럼 저장하지 않는다. 기존 authoring fixture에 source 이름/ID와 직접 공정 미선택 보호를 추가한다. frontend context 타입 오류는 backend DTO 작성 중 실행한 비동결 검사이며 계약 작성 후 최종 재검증한다.

QA-P2-003 후속 독립 재현: subset anchor999999·empty member graph·선택 member삭제 세 경우 명시409/원본불변. 실제 출처 공정/WorkArea를 보존하며 직접W2 processIds/workAreaIds[] 및 legacy-null은 자동변경0. backend가 archive4테이블 FK13그룹을 대조해 process/mapping/occurrence-area 참조도 보완했다.

## 실제 Chromium 첫 배치 — 원본 실패 보존

Local run `browser-core`, 명령/원문 `/tmp/issue-785-browser-core.log`, JSON `/tmp/issue-785-browser-core.json`, trace/error-context `/tmp/issue-785-browser-core-artifacts`. Chromium1.63.0/WSL2·실제 Next/격리 HTTP/nativeSQLite·worker1/retries0, 10spec35cases 계획. 시작 runtime/test/config1184파일 digest `f2e38a4d756553d1e3683068e3a65df33ea4d3e60faeaf6a078aa7c9ca932fc9`. 실행 완료 전 전체 PASS로 간주하지 않는다.

| ID | 실제 실패 | 원인·보완 계획 |
| --- | --- | --- |
| BROWSER-P1-001 | issue-621-resource-target.spec.ts:150, 실물 필터 상세의 `실물 연결·출처`가 없어15초 click실패 | PRODUCT: detail/Plan source와 provenance budget을 legacy wantsTargets에만 결속해 physical systemIds/무필터 조회에서 누락. 별도 실제 실물 출처 제공 조건으로 source+기존 budget을 함께 적용; projection 생성 조건과 분리 |
| BROWSER-P2-002 | 같은 spec:193, exact Assignment 성공 저장 뒤 원래 edit trigger가 없어 focus실패 | PRODUCT: 펼침 key가 snapshotId를 포함해 저장 시 행이 접힘. query+parent+kind+canonical ID 기반 표시key를 유지하고 상세는 새snapshot으로 재조회·stale/identity 검증. 기존 host exact focus 복원은 유지 |

해당 첫 배치 동안 제품/테스트 source를 수정하지 않고 전체 실패를 수집한다. timeout·원래 focus 단언·공수/공동담당자·보안 경계를 완화하지 않는다. 다음 후보는 보완 후 새source로 관련Unit/Chromium을 검증하고 첫 실패를 PASS로 덮어쓰지 않는다.

첫 core 배치 완료: 10spec35cases 중30PASS/5FAIL·16.3분, retries0·skip0. [정제 결과](evidence/issue-785/browser-core-initial.json). 추가 실패는 #623:351(동일 snapshot 펼침/상세 소실), #624:12(직접 APIRequestContext report/details POST Origin 누락403), resource-target-dashboard-api:17(퇴역 archive mutation fixture가 실제410을 받음)이다. 후자 두 개는 TEST_CONTRACT, 서버 방어는 정상이다.

추가 정적 소비자 감사에서 #734/#735/#736/#737/#762의 oldGET200[]와 이미410으로 바꾼#725/#726의 Target0 DB증명 누락을 확인했다. 테스트 전용 SQLite4table 실제count0+공개410을 함께 검사하고 archived API fixture는 명시 내부seed로 전환한다. 일반HTTP read/drill/권한/stale/restart는 유지한다. 첫 source에서 Target Editor7·Target0/권한·공수5·80/140·5폭 Resource geometry는 PASS였으나 변경 후보의 관련 부분은 새 source에서 별도 재검증한다.

LOCAL-LINT02: 보완 후 전체lint가 최초build의 생성물 `.runtime-tools/**/*.js`를 다시 스캔해 require-style15errors/기존10warnings로 FAIL했다. 원본runtime/test source 오류가 아니라 이 새worktree에서 제가 만든 산출물의 잔류다. 해당 디렉터리를 `/tmp/issue-785-runtime-tools-initial`로 보존 이동한 뒤 같은 코드로 lint를 재실행한다. ESLint 설정/규칙/CI gate는 변경하지 않는다. 원문 `/tmp/issue-785-rework-lint.log`.

LOCAL-B03: 소비자 fixture 보완typecheck의 preview union impactToken TS2339 최초실패. 명시 속성 검증으로 교정 후 typecheck PASS. 내부seed결과를 HTTPResponse로 위장하거나 무조건cast하지 않았다.

REWORK-BROWSER-ENV01: KPI5폭의 captureUi가 `git ls-files src`로 추적 파일을 읽으면서 아직 unstaged 삭제 상태인 task-target-binding-editor.tsx를 읽어 ENOENT로 실패했다. 실제 제품/테스트 bytes는 동일하며, 이후 capture가 실제 후보 source(신규파일 포함)를 읽도록 src/tests의 승인 변경을 Git index에 staging했다. 파일 삭제를 취소하거나 helper 검증을 약화하지 않았다. staging 시점 이후도 동일runtime source digest를 유지하며 앞선5FAIL은 ENVIRONMENT/증거수집 실패로 보존하고 나중에 해당5폭을 재실행한다.

REWORK-BROWSER-CONTRACT01: #621:98은 보존된 개인 상세와 새 전체Task 상세 두 개가 정상 존재하여 `.resource-dashboard-detail` 광역locator가strict2건으로 실패했다. 실제 KPI로 연 '선택 범위 할당 Task' 영역으로 한정해ready/원래이름/canonicalID 단언을 유지할 계획이다. #623:351은 이제앞5저장 통과 후 direct저장 pending의짧은버튼상태를 성공후 관찰하여 실패; 실제HTTP 요청을 잠시 보류해 pendingdisabled를 관찰하고 풀어 실제200·6writes/revision/원본불변을 검증한다. #726:62는 counter추가fixture가 브라우저전역 origin을 잘못 참조해 ReferenceError; 실제fixture의isolatedApplication을 사용한다. source변경은 현재72배치가 끝난후 수행한다.

72case/19file 보완 배치 완료:64PASS/8FAIL·13.1분·retries0/skip0. [정제 결과](evidence/issue-785/browser-rework.json). 실제 제품 출처/포커스 실패는 통과했고, 남은8은 TEST_CONTRACT3(case#621선택영역strict2, #623pending관찰, #726fixture변수)와 ENVIRONMENT5(captureUi의unstaged삭제파일 읽기)다. 전체API/Resource/KPI 나머지mock·8Target0중해당scope오류제외·공수/정확drill/legacyAPIrestart는PASS. 최종보완은제품파일변경0, 테스트입력/관찰만수정하고 실패8+같은scope추가1을 실제재실행한다. 기존64PASS는동일제품bytes와변경없는case에한해제한재사용하며 단일최종source72동시실행PASS로 표현하지 않는다.

## 최종 복구 결과

[복구9case](evidence/issue-785/browser-recovery.json)는9/9PASS·2.2분이다. 8원본실패와인접1case를재실행했고 원래72배치64PASS는동일제품bytes·변경없는case만제한재사용했다. 고유73case수용을 단일최종source 전체실행으로 부풀리지 않는다. 제품digest `4577a92488bf6420dd108616270a8752d2189046fd8ddd4a066520a07c3c3b82` 불변, 최종3E2E관찰/fixture입력만교정됐다. [제품/테스트 지문·로컬 영수증](evidence/issue-785/local-validation-receipt.json).

전체Unit3250PASS/기존3SKIP·typecheck/build/discoveryPASS, 전체lint0errors/기존10warnings다. Runtime生成CJS스캔 최초lintFAIL도 보존했고 산출물이동 후동일code검사PASS다. Next生成AGENTS/next-env/tsconfig3파일과기존output증거는정확HEAD원본으로복원했다. 새worktree의테스트生成82파일은/tmp에보관하여기존역사증거/PR에섞지않았다. Git에는선택2PNGs와정제JSON만추가한다.

독립Agent사전QA는비파괴P1/P2범위PASS, 전체AC4안전편집은NOT IMPLEMENTED/Owner예외승인없음이다. 자동Pre-PR선정BLOCKED·원격Required3/Trusted/Owner미실행은계속분리한다. 미해결GitHub리뷰/최신main충돌과PR CI등록상태는게시직전재조회하며등록후Issue STATUS에기록한다. 아직원격CI실패를관측하거나과거다른Issue실패를이원장의새실패로전용하지않았다.

게시직전fast 재실행도BLOCKED/sourceStable=true/selection108·UNKNOWN28·missing0·실행0이며targeted dry-run NOT TESTED다. 최종실제검증과자동선정차이는 [28개수동매핑](evidence/issue-785/manual-impact-mapping.json), [fast](evidence/issue-785/prepr-publish-fast.json), [targeted](evidence/issue-785/prepr-publish-targeted.json)에보존한다. CLI상태를수동PASS로고치지않았다.
