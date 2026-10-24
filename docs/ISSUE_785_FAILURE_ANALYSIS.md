# Issue #785 — 누적 실패·충돌·검증 원장

Primary Issue: https://github.com/planner77/masterGantt/issues/785
기준: [공통 실패 원장](PR_CI_FAILURE_TRIAGE.md). 원본 실패를 삭제하거나 PASS로 소급하지 않는다.

최신 분석 Head는 7af290c87d6317bc9ad1391b1a15f3e63b9fc01a, base/main은 4ce403a1e410ca599a780446f39513e1f1158326이다. Full #3216.1 Resource Excel 직접 실패는 마지막 F785-007에 기록한다. 과거 F785-001~006의 원본 상태 및 동결 로컬97/PRE_QA는 해당 source와 실행 모집단의 이력으로 보존한다.

## 2026-10-24 재개 — 현재 원격 출처 및 검증 경계

이번 재개 기준 Head는 `14a2be51c421eaab0f7f1f4004f4fe222dea21d7`이다. 기존 작업공간의 `0a33b6ab`는 원격 후속4commit을 반영하지 않은 상태여서 **원격 branch를 fast-forward한 뒤** 진단했다. 기존 세 교정과 문서 원본 복구를 보존한다. `main/base`는 `427d22245fb8e11254b2424ea5147ccbd5766979`로 동일하다. 현행 판정은 아래 전체 목록과 마지막 개별 사건을 따른다. 위쪽 최초 로컬/게시 전 절은 당시 기록이다.

[정제 원격 영수증](evidence/issue-785/ci-cumulative-rework-20261024.json)은 PR/Run/Attempt·Job/Step·immutable merge 부모·원본 source artifact 메타데이터와28개 취소 shard 로그 조회를 연결한다. 실제 원문은 /tmp에 보존하고 앱 runtime 로그/토큰/DB는 Git에 저장하지 않는다. 과거 Run의 `pull_requests[].head`는 현재 PR Head로 변할 수 있어 원본 Head 근거로 사용하지 않았다. `run.head_sha`와 각 checkout test-merge의 정확 두 부모를 교차 확인했다.

## 원인 분석 시점의 Run/Attempt 전체 목록

아래는 이번 재실패 분석 시점까지 확인한 Full8회 실패/취소 목록이다. 새 게시 후 등록한 Run/Attempt·정확 Head/base/test merge는 같은 Issue의 STATUS와 PR 검증 기록에 연결하며 이 표의 과거 결론을 소급 변경하지 않는다.

모두 event=`pull_request`, workflow=`.github/workflows/ci.yml`, attempt=`1`이다. 처음5회 base는 `427d22245fb8e11254b2424ea5147ccbd5766979`, #3204.1/#3208.1은 `dd7f4d86db06e8a10b8c86b5412ed319154011e0`, #3216.1은 `4ce403a1e410ca599a780446f39513e1f1158326`이다. source artifact/출처 부족을 PASS로 바꾸지 않는다.

| Full / Run | 원본 Head | 원본 test merge | 직접 실패·취소·미실행 |
| --- | --- | --- | --- |
| [#3187.1](https://github.com/planner77/masterGantt/actions/runs/39975107608) / `39975107608` / FAILURE | `0a33b6ab7017b4d60d75562c1104eaea75747b28` | `0a65630bdfa8ec54b72a98da142e2c6408e4193c` | #719 KPI v2 fixture 누락으로 버튼 not mounted; shard5 Job120488909192 11PASS/1FAIL/90NOTRUN, 나머지7shard CANCELLED. Quality/Docker SUCCESS |
| [#3192.1](https://github.com/planner77/masterGantt/actions/runs/40028478592) / `40028478592` / FAILURE | `433fa32279be7c9c0f812c40b717f91298741fe3` | `cca62818164a129ede7552030e02708ac2ed032a` | Policy Job120670771956 step9 Zod high audit FAIL. Typecheck/lint/Unit SUCCESS, Fast Gate가 PR Build/E2E8/Docker 구현 차단·미실행; Required3/QA 파생 FAIL |
| [#3194.1](https://github.com/planner77/masterGantt/actions/runs/40030198022) / `40030198022` / CANCELLED | `f7235d51cb9784f891697555dee52297b705b422` | `8c7db96182c4622427186dace66b1fd3940411d9` | Run CANCELLED이나 취소 전 shard2 Job120677436747의 #734 UUID 실제 FAIL(5PASS/1FAIL/87NOTRUN). 문서 복구 전 중간 Head이며 최종 검증에 재사용하지 않음 |
| [#3195.1](https://github.com/planner77/masterGantt/actions/runs/40030302113) / `40030302113` / FAILURE | `d8180882ea30ff72af83ef4c049e40bd1caea18d` | `086262b05c7536f33eb86bfb0e7603c6f00b0cba` | shard2 Job120680499345 #734 UUID 실제 FAIL(5PASS/1FAIL/87NOTRUN), 나머지7shard CANCELLED. Quality/Docker SUCCESS |
| [#3197.1](https://github.com/planner77/masterGantt/actions/runs/40032862265) / `40032862265` / FAILURE | `14a2be51c421eaab0f7f1f4004f4fe222dea21d7` | `322734a1ea8bbaffc89ed876f337d76cbab748f4` | shard2 Job120685901338 #734 확인창의 이름 불일치 실제 FAIL(5PASS/1FAIL/87NOTRUN), 나머지7shard CANCELLED. Quality/Docker SUCCESS |
| [#3204.1](https://github.com/planner77/masterGantt/actions/runs/40040333641) / `40040333641` / FAILURE | `f03933cb16c6c99a1a35a3095b55b6158d69bab5` | `c442e7c6da33c5a7f92bac038bdddbe36f1cda96` | shard2 Job120710326907 step7 #461 Logistics checkbox 대기 timeout(67PASS/1FAIL/25NOTRUN), 나머지7shard CANCELLED. Quality/Docker SUCCESS; base dd7f4d86 |
| [#3208.1](https://github.com/planner77/masterGantt/actions/runs/40045100122) / `40045100122` / FAILURE | `473b0fb103d445f64ef6b44be63a9b4d6456cbdc` | `fea4ad9558eec626ecbf56dc996e7d54127d3002` | shard2 Job120725634037 step7 #734 저장 후 spec.root 기대equipment/실제process(5PASS/1FAIL/87NOTRUN), 나머지7 CANCELLED. Quality/Docker SUCCESS; base dd7f4d86 |
| [#3216.1](https://github.com/planner77/masterGantt/actions/runs/40051075577) / 40051075577 / FAILURE | 7af290c87d6317bc9ad1391b1a15f3e63b9fc01a | c7a5f963efc2a2d9549e0d3c174bc3d2bd637e16 | Shard7 #529 stale Excel metadata key Actual target context → JSON.parse(undefined); 73 PASS/1 FAIL/4 NOT RUN. Shard6/8 PASS, other5 CANCELLED; Quality/Docker PASS, E2E/QA derived FAIL; base4ce403a1 |

초기5회에 대한 Advisory `pr-fast-development.yml`은 #40.1/#42.1/#44.1/#45.1/#47.1 다섯 Run 모두 SKIPPED이며 Full 실행/Required PASS가 아니다. 정확 Run ID와 Head는 정제 영수증에 보존한다. E2E fail-fast로 CANCELLED인28개 shard 로그를 모두 읽었으며, 기록된 추가 test FAIL은0이었다. 취소/미실행 테스트는 NOT TESTED로 유지한다. #3194의 Run CANCELLED와 이미 기록된 test FAIL은 서로 다른 층의 사실이다.

현재 PR Review Thread0·mergeable=true는 조회 시점의 상태이며 변경 후 재확인한다. 초기 bot code_review의 no-findings는 `0a33b6ab7017b4d60d75562c1104eaea75747b28` 범위이고 security_review=null이다. 이를 `14a2be51` 또는 새 후보의 검토/Owner 승인으로 재사용하지 않는다.

## 이전 동결 후보의 누적 실패 파일 합집합 및 Cross-run 매트릭스

| 파일/계약 | 최초 실제 실패/당시 교정 | 최신 재발·인접 영향 | 이번 후보 재검증 |
| --- | --- | --- | --- |
| `issue-719-contextual-help.spec.ts` | F785-001/3187: v2 schema 없는 KPI mock | task-editor-density 공용 mock 소비자·KPI request-state | PASS: A #719 1case + B v2 음성2; 공용 density2 |
| `package.json`/lock·Gantt history capture | F785-002/3192: Zod audit high | Zod4.6.7 exact allowlist·registry/SRI/version 음성·historical capture3 | PASS: npm ci/Zod4.6.7·운영 audit0·역사/음성 Unit40 |
| `issue-734-equipment-dashboard.spec.ts` | #3194 CANCELLED 중 실제FAIL·F785-003/3195 UUID 누락 | F785-004/3197 현재이름 대 초기fixture 기대 불일치 | 원본8 red7PASS/1FAIL·단독red 후 최종 원본8/8 PASS(A) |
| `issue-735-system-dashboard.spec.ts` | F785-003 인접 구 Target문구/rawUUID oracle 교정 | System 공유원본·정확ID on-demand·이름/dirty/취소/저장 | PASS: 기존 전체6/6(B), on-demand ID·저장/복귀 유지 |
| `issue-621-resource-target.spec.ts` | 초기 local actual source 누락·snapshot 행 key·strict2 locator | exact Assignment·공동담당/dirty/stale·Source/복귀 | PASS: 새 동결 A3case, 과거64/9 재사용과 구분 |
| `issue-623-resource-mvp.spec.ts` | 초기local snapshot 상세소실·pending 관찰 | 원장/6writes/revision·Assignment/공수·Excel | PASS: A 여섯 mutation1case, 실제 SQLite/HTTP 보호 유지 |
| `issue-624-logistics-unified.spec.ts` | 초기local report/details Origin 누락403 | 6관점 정확원본·읽기 POST | PASS: A 같은 canonical 원본1case, 서버Origin guard 불변 |
| `resource-target-dashboard-api.spec.ts` | 초기local 퇴역 archive mutation이410 | 내부 legacy seed·명시v1 audit/기본v2·restart | PASS: A 실제HTTP/SQLite·restart1case |
| `issue-726-task-logistics.spec.ts` | 초기local counter fixture의 browser-global origin | Task 직접/상속·Target0 실제4table0·권한/412 | PASS: A 실제 직접연결1case, 세션/If-Match 유지 |
| `logistics-dashboard-request-state.spec.ts` | 초기local captureUi unstaged 삭제경로 ENOENT와 v2 producer | source/drill/역순응답/negative snapshot·capture 지문 | PASS: A5폭+B wrong-revision/malformed2, scoped source 검증 |

논리적 누적 browser 실패 합집합은 위8spec(#719/#734 및 로컬6)이며, #735는 직접 관련 인접 소비자로 추가한다. 공통 task-editor-density·identifier의 실제 소비자와 역사 capture Unit은 별도 영향 표로 연결한다. helper12file/24spec 한도를 넘는 수동 진단은 bounded batch로 나눠 실행하되 원장 합집합은 하나로 유지한다. 동일 이름/역할이라는 이유로 Unit·HTTP/SQLite·실제 browser/OOXML 보호를 통합 삭제하거나 skip하지 않는다.

## 착수 원격·충돌 상태

2026-10-23 main `427d22245fb8e11254b2424ea5147ccbd5766979` 기준 #785 기존 PR/리뷰/CI 없음. 새 독립 worktree를 사용하며 원래 작업 트리의 untracked 사용자 자료는 보존한다. 진행 #720/PR721 등 다른 Issue의 리뷰 스레드는 본 Issue 권한으로 해결 처리하지 않는다. 최종 게시 전 최신 main과 merge 충돌을 재확인한다.

## 초기 도구·환경 기록

| ID | 판정 | 사실·처리 |
| --- | --- | --- |
| ENV-001 | BLOCKED | 로컬 `gh pr list`가 HTTP401 Bad credentials. 인증값 조회/변경 없이 연결 GitHub plugin으로 조회/게시한다. 제품/CI 실패가 아니다. |
| TOOL-001 | FAIL | GitHub comments 첫 호출에 repo 키 사용으로 schema validation 오류. repo_full_name으로 수정해 댓글0 조회. Issue 댓글 작성도 pr_number/comment 필드로 수정한 뒤 PLAN 등록 성공(6366100567). 제품/CI 실패가 아니다. |

## PR / Run / Attempt

최초 후보 작성 당시에는 원격 PR CI 시작 전이었다. 이후 실제 전체 이력은 위 Run/Attempt 목록과 동일 Issue STATUS 영수증으로 연결한다. quality/e2e/docker·Trusted·Owner: NOT TESTED. 이번 범위는 CI 등록까지만이며 결과를 모니터링하지 않는다.

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

이 절은 최초0a33 후보의 복구 이력이다. 후속 Full5회 및 현행 F785-004 검증과 모집단·source가 다르므로 새 후보의 성공으로 소급하지 않는다.

[복구9case](evidence/issue-785/browser-recovery.json)는9/9PASS·2.2분이다. 8원본실패와인접1case를재실행했고 원래72배치64PASS는동일제품bytes·변경없는case만제한재사용했다. 고유73case수용을 단일최종source 전체실행으로 부풀리지 않는다. 제품digest `4577a92488bf6420dd108616270a8752d2189046fd8ddd4a066520a07c3c3b82` 불변, 최종3E2E관찰/fixture입력만교정됐다. [제품/테스트 지문·로컬 영수증](evidence/issue-785/local-validation-receipt.json).

전체Unit3250PASS/기존3SKIP·typecheck/build/discoveryPASS, 전체lint0errors/기존10warnings다. Runtime生成CJS스캔 최초lintFAIL도 보존했고 산출물이동 후동일code검사PASS다. Next生成AGENTS/next-env/tsconfig3파일과기존output증거는정확HEAD원본으로복원했다. 새worktree의테스트生成82파일은/tmp에보관하여기존역사증거/PR에섞지않았다. Git에는선택2PNGs와정제JSON만추가한다.

독립Agent사전QA는비파괴P1/P2범위PASS, 전체AC4안전편집은NOT IMPLEMENTED/Owner예외승인없음이다. 자동Pre-PR선정BLOCKED·원격Required3/Trusted/Owner미실행은계속분리한다. 미해결GitHub리뷰/최신main충돌과PR CI등록상태는게시직전재조회하며등록후Issue STATUS에기록한다. 아직원격CI실패를관측하거나과거다른Issue실패를이원장의새실패로전용하지않았다.

게시직전fast 재실행도BLOCKED/sourceStable=true/selection108·UNKNOWN28·missing0·실행0이며targeted dry-run NOT TESTED다. 최종실제검증과자동선정차이는 [28개수동매핑](evidence/issue-785/manual-impact-mapping.json), [fast](evidence/issue-785/prepr-publish-fast.json), [targeted](evidence/issue-785/prepr-publish-targeted.json)에보존한다. CLI상태를수동PASS로고치지않았다.

## PR #787 — 최초 원격 Full PR CI 실패 F785-001 (2026-10-24 KST)

- **원본:** [Full #3187.1 / Run 39975107608](https://github.com/planner77/masterGantt/actions/runs/39975107608), event=`pull_request`, PR #787, HEAD `0a33b6ab7017b4d60d75562c1104eaea75747b28`, base/main `427d22245fb8e11254b2424ea5147ccbd5766979`. 원본 Run/Attempt는 재실행 또는 수정 이후에도 FAIL로 유지한다.
- **첫 직접 FAIL:** [Chromium E2E shard 5/8 / Job 120488909192](https://github.com/planner77/masterGantt/actions/runs/39975107608/job/120488909192) `tests/e2e/issue-719-contextual-help.spec.ts:74:37`의 `#719 logistics 동일 fixture 5폭...`. `openSurface` line 51의 `getByTestId("logistics-dashboard-view").getByRole("button", {name:"일정에서 전체 작업 보기"})`는 5,000ms 후 `element(s) not found`. 이 shard는 순서상 초기 11건 PASS 후 12번째 테스트가 실패하며 `--max-failures=1`로 중단됐다. 총 102 계획 케이스를 PASS로 간주하지 않는다.
- **근본 원인(TEST_CONTRACT):** #785에서 제품 KPI fetch는 정확히 `wire.data.schema==="logistics-kpi/2"`를 확인하고 `fromResourcePublicV2`로 읽는다. 반면 #719의 이전 Mock `withIntegratedKpi`를 `{data:...}`로 직접 내보내 v2 공개 schema를 누락했다. 정상 응답 수락 전 `ready`가 false가 되어 KPI 카드의 작업 보기 버튼이 mount되지 않는다. #785 신규 v2를 사용한 `tests/e2e/logistics-dashboard-request-state.spec.ts`와 대비하여 계약 원인을 확인했다. 별도 `GitCommitInfo: git fetch ... timeout of 3000ms`는 해당 Assertion의 직접 실패 로그가 아니다.
- **파생:** PR shard 1/2/3/4/6/7/8 `cancelled` (PR fail-fast); Required `Chromium end-to-end tests` 및 `QA Final — Automated` FAIL은 E2E 파생. Policy/TypeScript/ESLint/Vitest/PR Build/Docker smoke와 Required Quality/Docker는 SUCCESS. 다른 shard의 미실행 테스트는 `NOT TESTED`이며 FAIL/PASS로 재분류하지 않는다.
- **교정:** `tests/e2e/issue-719-contextual-help.spec.ts`의 KPI Mock 응답을 생산 계약과 동일한 `toResourcePublicV2({data:withIntegratedKpi(...)})`로 직렬화한다. `tests/e2e/fixtures/task-editor-density.ts`에서도 동일한 구형 wire producer를 발견하여 v2로 통일하고 horizonDays/systemView/activeOnly/asOfDate를 실제 요청 파라미터와 맞춘다. 제품의 schema gate, `isDashboard` 검증, 기존 #719의 5폭·도움말 키보드/포커스/Escape/overflow/네트워크 0 쓰기, E2E 8 shard/timeout/retry/max-failures/Required 체크를 변경하거나 완화하지 않는다.
- **교차 검토/TEST_LIFECYCLE_REVIEW:** #719의 기존 실제 Chromium 시나리오는 `EXTEND`(Fixture wire만 현행 계약으로 갱신), 공통 Task Editor fixture는 `EXTEND`, 기존 `logistics-dashboard-request-state.spec.ts`의 v2/오류/잘못된 snapshot 검증은 `KEEP_UNIQUE`; 신규 삭제·skip·중복 E2E 등록 없음. 다른 생산자 가능성을 기본 브랜치 코드 검색과 변경 파일/fixture 대조로 검토했다.
- **사전 검증 한계:** GitHub 연결로 정확 소스와 CI 로그/기존 정상 v2 Fixture를 대조했지만 이 환경에서 Node·Playwright·Docker 실행은 `NOT TESTED`이며 원격 새 Run 결과도 실행 전 `NOT TESTED`. 수정 뒤 단일 HEAD `synchronize`에서 기존 Full8·Quality·Docker·Trusted 정책을 재검증한다.
- **리뷰·충돌:** 수정 전 PR #787 GraphQL 미해결 Review Thread 0건, 당시 초기0a33 Head에 한정된 Codex no findings(후속Head 승인 아님), GitHub `mergeable=true`, main 기준 SHA 동일. 수정 HEAD에서 재검증할 항목이며 병합/Owner 승인 증거가 아니다.

## PR #787 — F785-002 두 번째 Full PR CI 실패 (2026-10-24 KST)

- **원본:** [Full #3192.1 / Run 40028478592](https://github.com/planner77/masterGantt/actions/runs/40028478592), PR #787, HEAD `433fa32279be7c9c0f812c40b717f91298741fe3`, base/main `427d22245fb8e11254b2424ea5147ccbd5766979`. F785-001 Chromium 실패와 별도 원본·별도 원인.
- **직접:** [Policy Job 120670771956](https://github.com/planner77/masterGantt/actions/runs/40028478592/job/120670771956) `npm audit --omit=dev` High `GHSA-mrhx-c7xc-m3w5`, `zod <4.6.6` 취약·직접 운영 의존성 4.6.2. runner 권고는 `npm audit fix --force`, `zod@4.6.7`이나 강제 자동수정은 사용하지 않는다. 공식 GitHub Advisory patched `4.6.6`.
- **파생:** PR Fast Gate POLICY_RESULT=failure; PR Build·E2E8 shard·Docker 실제 **SKIPPED/NOT TESTED**, Required Quality/E2E/Docker·QA Automated **파생 FAIL**. TypeScript·ESLint·Vitest·QA Preflight SUCCESS. 이전 #3187.1 E2E 수정은 이 Run에서 미실행이다.
- **원인 보완:** `package.json`/lock에서 Zod 한 패키지만 `4.6.2→4.6.7`, resolved `https://registry.npmjs.org/zod/-/zod-4.6.7.tgz`, SRI `sha512-g8W2D2kU6a8untc053fX1uVBKzM7yqAxW/3zwk83+6RyF2+SKOuV+c0wBDhUwzV1PaGapmZH+rmcUzPf+3CGwg==`. 독립 공개 bun.nix 파일 및 Gentoo Manifest SHA512 `83c5b60f...`와 교차 대조했다. 신규 `approved-zod-4.6.7-lock.json`과 `capture-install.ts`은 기존 frozen Gantt browser capture를 재작성하지 않고 정확 Zod 보안 차이만 메모리 정규화. 역사 Vitest #752 당시 4개 failing consumers 재발 위험을 기존 `prepr-verifier.test.ts`의 tampered registry/SRI/version/manifest/lock 음성으로 보호. 테스트 assertion/시간·CI 정책/Next/SVAR/도메인/API/DB 변경0. README/SECURITY/Work Packet 갱신. 기존 docs/TEST_PLAN.md의 정책은 원본을 그대로 적용한다.
- **TEST_LIFECYCLE_REVIEW:** 기존 history-capture tests EXTEND, Zod·보안·HTTP·SQLite·실물 테스트 KEEP_UNIQUE, test skip/폐기/중복0. AC6 보안, AC9 Test Lifecycle, AC10 문서 연계.
- **검증 경계:** package·lock JSON 구조 및 Zod 변경 경로, 공개 SRI 교차 확인만 수행. GitHub 연결 환경 registry/npm install 및 실제 Node/Vitest/Chromium/Docker 실행은 `NOT TESTED`. 정확 HEAD 새 PR Full8/Required3/Trusted 검증 필요. 기존 두 실패 원본 PASS 소급 금지.
- **리뷰/충돌/승인:** 변경 전 미해결 Thread0, `mergeable=true`, 현재 main/base 동일. 변경 후 확인한다. HIGH/OWNER_MANAGED, AC4 legacy 안전 관계 편집·운영 DB/외부 소비자 실측, Trusted QA·Owner HIGH 수용 미충족. `release_authorized=false`, `MERGE_READY=BLOCKED`.

### F785-002 교정 게시 중 DOCS-GIT-001 (문서 손상 예방·복원)

- 2026-10-24 커밋 `f7235d51cb9784f891697555dee52297b705b422`의 `docs/TEST_PLAN.md`는 대용량 원본 blob `1d2b679dda6730306d8f6586ba3921a9458d4e9f`을 GitHub 파일 조회에서 내용 길이 0으로 수신한 뒤 보충 섹션만 작성하여 문서 본문 약 5,403줄이 누락된 중간 게시 실수다. 테스트·업무 코드 원인과 별개다.
- 후속 교정 commit에서 원본 Git blob SHA `1d2b679dda6730306d8f6586ba3921a9458d4e9f`를 **바이트 그대로 복원**한다. TEST_LIFECYCLE_REVIEW는 본 실패 원장·Work Packet에 계속 존재하며 정본 `docs/TEST_PLAN.md`의 기존 내용은 그대로 유지한다. 이 문서 손상 중간 HEAD의 CI를 최종 변경 검증으로 재사용하지 않는다.
- 복구된 단일 HEAD의 Full PR CI를 다시 시작하고 CI 모니터링은 생략한다.

## PR #787 — 세 번째 원격 Full PR CI 실패 F785-003 (2026-10-24 KST)

- **원본 출처:** [Full #3195.1 / Run 40030302113](https://github.com/planner77/masterGantt/actions/runs/40030302113), PR #787, HEAD `d8180882ea30ff72af83ef4c049e40bd1caea18d`, base/main `427d22245fb8e11254b2424ea5147ccbd5766979`. F785-001(#719 KPI Fixture), F785-002(Zod npm audit)와 **각기 다른 직접 원인**, 이전 원본 상태를 PASS로 소급 변경하지 않는다.
- **직접 FAIL:** [Chromium PR shard 2/8 Job 120680499345](https://github.com/planner77/masterGantt/actions/runs/40030302113/job/120680499345) `tests/e2e/issue-734-equipment-dashboard.spec.ts:231`, `#734 설비 원본 dirty 유지·정확 PATCH 저장·새 snapshot과 focus 복귀`. `공유 인스턴스 변경 확인` 대화상자에서 테스트가 `f.equipment.id` UUID 직접 문자열을 기다렸으나 화면은 이름·관련 작업1·직접1·기존0만 제공해 5초 Timeout; shard는 5 PASS 뒤 여섯 번째 실패, 나머지 실행 중단(`--max-failures=1`). `GitCommitInfo git fetch ... timeout 3000ms`는 이 단언의 직접 실패가 아니다.
- **원인/계약 검토:** #785의 실물 중심 UI로 이전 Target 사용자 문구를 없애면서 **공유 원본 변경 확인 단계의 원본 UUID 접근도 누락됨**. `DESIGN.md` 1.3 및 `docs/ISSUE_717_IDENTITY_INVENTORY.md`는 안전한 공유 인스턴스 변경 확인에서 **이름 우선 + 정확한 원본 ID on-demand 조회/복사**를 요구한다. 따라서 단순히 UUID 단언을 삭제하거나 제품에 UUID를 상시 반복 표시하는 것 모두 정본 위반이다. 이어지는 `tests/e2e/issue-735-system-dashboard.spec.ts:117`도 구형 `공유 Target 0개` + raw UUID 노출을 기대하여 후속 실패 위험이다.
- **직접 교정:** `src/features/logistics/project-logistics-management.tsx`의 `previewInstanceEdit`가 API 응답 `kind/entityId`를 검증한 정확 실물 `kind,id`를 일시적 `sourceImpact` state에 저장. 기존 `IdentifierDetails` disclosure `변경 대상 식별 정보` 아래 `설비 원본 ID / 물류 시스템 원본 ID`를 읽기·복사 가능하게 제공한다. 기본 확인 문구는 설비/System 이름 및 기존 direct/compatibility Task 수 유지, 사용자용 Target 엔터티/버튼/축 재노출0. 저장 전 사용처 검증/취소·초안/다중 쓰기·revision/원자 PATCH/focus 흐름 불변.
- **기존 테스트 EXTEND:** #734는 원본 이름·작업1/직접1/기존0·폐기 Target 문구0·접힘의 정확 canonical ID 조회와 원래 불변/dirty/PATCH/snapshot/focus 단언을 결합. #735 역시 구 `공유 Target 0개`를 폐기하고 System 동일 원본/작업 수/정확 ID 및 저장 후 복귀를 검증. ID가 제목의 primary label로 노출되거나 Target 화면으로 복귀하는 방식 금지.
- **간접/음성 경계:** #717 이름 우선/긴 이름·동명·키보드 identifier, #725/#726 실제 기준정보 및 #734/#735 공유 인스턴스 검증, Task 직접 연결·레거시 출처, #785 AC2/4/6/8/9/10을 대조. 과거 테스트 삭제·skip·assertion/timeout/Required Check 완화 없음. 실제 원격 Full Head 재검증 전 제품/테스트 PASS `NOT TESTED`.
- **파생:** 나머지 Chromium 7 shard CANCELLED(Fail-Fast), Required E2E·QA Automated FAIL. Policy/npx Audit, TypeScript, ESLint, Vitest, PR Build, Docker 구현/Required Quality·Docker는 SUCCESS. 취소된 테스트는 미실행으로 표시한다.
- **리뷰/충돌/승인:** 원본 PR #787 Review Thread0, `mergeable=true`, main/base SHA 동일. 새 commit 후 재확인하며 HIGH/OWNER_MANAGED, AC4 레거시 관계 자체 편집 및 운영 데이터·외부 consumer/Owner 승인 미충족; `MERGE_READY=BLOCKED`, `release_authorized=false`. 사용자 요청은 수정·원장/Packet 기록·새 PR CI 시작까지만, 모니터링/병합/Main/GHCR/Finalizer/Issue 종료 제외.

## F785-004 — Full #3197.1 설비 확인창 이름 불일치 (교정·로컬 회귀 PASS)

- 원본: Run40032862265/attempt1, Head14a2be51, shard2 Job120685901338 step7, `issue-734-equipment-dashboard.spec.ts:215` case의 line231 `confirmation.toContainText(f.equipment.name)`.
- 실제 expected=`다공정 장거리 통합 반송 설비 Long operational equipment name`, actual=`설비LongEquipmentNameWithoutWhitespace` 다섯 반복. UUID 누락 F785-003과 새 관측을 분리한다. 정확 원본 ID on-demand 접근은 이전 교정을 유지한다.
- 먼저 frozen14a2 원본 전체spec의 순서·앞선5폭 long-name 변경을 포함해 `workers1/retries0/max-failures0`로 재현한다. 아직 원인 가설을 확정하거나 코드/테스트를 수정하지 않는다. 원문 `/tmp/issue785-734-red-original.log`, 시작 지문 `/tmp/issue785-734-red-original-provenance.json`.
- 로컬 설치의 zod4.6.2/manifest4.6.7 불일치는 dedicated worktree의 수동 `npm ci`로 동기화했다. 이는 원격 name assertion의 원인으로 단정하지 않으며 lock/SRI 및 audit/history regression을 별도로 확인한다.
- 원본 재현·가설/반례·최소교정·최종source 합집합 재검증은 완료 후 이 사건에 추가한다. 전체 AC4 안전편집/운영/Owner HIGH 수용 미완료 및 새 Required3/Trusted NOT TESTED·release_authorized=false는 불변이다.

### F785-004 원본 로컬 재현

원격Head14a2와 동일한 코드/테스트에서 원본 #734 전체8case를 `workers1/retries0/max-failures0`로 실제 실행해 **7PASS/1FAIL(4.8분)**을 관측했다. 실패line231의 expected/actual은 원격과 같다. 시작/끝의 #734/#735/제품관리컴포넌트3파일SHA256이 동일하므로 재현 중 수정으로 만든 red가 아니다. [재현 영수증](evidence/issue-785/rework-red-original.json), 원문/trace는 /tmp에 보존했다.

추가 관측: 실제 dialog 이름의 `설비` 접두사는 앞선5폭case의 이름과 다르며 해당 dirtycase가 사용하는 `seed()` 자체 PATCH의 이름과 일치한다. 따라서 '이전 case의 긴이름 오염'은 아직 원인이 아니며 same-case setup과 반환 fixture의 시점 차이를 구분한다. 수정 전 **단독dirty1case**로 축소 재현하고 canonical read/usage response·정확ID를 함께 대조한다.

### F785-004 최소 red와 검증 가설

원본 코드를 유지한 단독명령 `env -u PLAYWRIGHT_BASE_URL npx playwright test --config tests/config/playwright.config.ts tests/e2e/issue-734-equipment-dashboard.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0 --grep '#734 설비 원본 dirty'`도 같은 line231/이름으로1FAIL했다. 다른 testcase가 필요하지 않으므로 prior-case 상태 오염은 기각한다. 실제 최신원격 증상으로 red가 되는 최소 seam은 이 단독 실제HTTP/SQLite/Chromium case다.

가설을 사용자에게 순위와 함께 공유한 뒤 검증한다: (1) setup PATCH 뒤 stale seed 반환이면 sameID canonical name은 긴이름, fixture는 초기이름이며 반환값만 갱신해 통과한다. (2) server/usage 또는UI cache가잘못됐으면 canonicalGET과usage/dialog 이름이 다르다. (3) 다른실물 선택이면 request/usage/확인창 원본ID가 다르다. 좁은 API snapshot·usage identity probe만 사용하고 앱로그/인증정보는남기지 않는다. 제품원인 근거없이UI/schema/gate를완화하거나 이름단언을genericregex로 바꾸지 않는다.

### F785-004 가설 검증·최소 교정

F785-003의 원본 ID disclosure 교정과 이름 단언 강화가 기존 seed 반환값의 시점 불일치를 드러냈다. 현재 확인창은 최신 canonical 이름과 정확 ID를 제공한다. F785-003의 실제 제품 교정과 이번 F785-004의 테스트 setup 교정은 다른 원인이며 서로의 원본 실패를 소급 변경하지 않는다.

실제 최소 red trace의 허용필드만 대조했다. seed의 PATCH200 canonical name은 `설비LongEquipmentNameWithoutWhitespace` 다섯 반복이며 dialog name과 일치하고, 반환된 `f.equipment.name`만 초기 이름이었다. PATCH canonical equipment ID·usage `entityId`·dialog Identifier UUID는 동일한 fixture ID `e67242ce-234f-4063-8e45-0ea46179df1b`, kind=equipment·direct1/compatibility0이었다. **usage 응답에는 name 필드가 없으며 이름을 비교한 것은 canonical PATCH와 dialog다.** 따라서 server/cache 이름 오류와 다른 원본 선택은 반증됐고, same-case setup이 stale DTO를 반환하는 TEST_CONTRACT가 원인이다. 이전 case 오염은 단독 red로 이미 기각했다.

최소 교정은 `tests/e2e/issue-734-equipment-dashboard.spec.ts` 한 파일이다. seed의 모든PATCH가 끝난 뒤 canonical GET에서 **같은 equipment.id**의 DTO를 찾고 없으면 명시 실패하며 최신 값을 반환한다. editor 초기 name도 그 canonical name과 엄격히 같아야 한다. 원래 dialog name·ID on-demand·작업1/direct1/기존0·dirty·취소·PATCH1/revision+1·snapshot/focus·5폭 단언은 유지한다. generic regex/삭제/skip/timeout/retry 변경은 없다. 제품·공용 fixture·API/DB/계산·System spec은 변경0이다.

인접 #735의 `seedSystem`은 이미 rename PATCH 뒤 최신snapshot에서acsA/B/MCS를 반환해 같은 stale 패턴이 없음을 전수 검색했다. 기존 F785-003의 System on-demand ID 교정과 dirty/stale/readonly/5폭은 별도 직접 회귀로 유지한다. 첫 교정후 단독 green은 **1/1PASS(본문22.6s/전체38.5s)**이며 원문 `/tmp/issue785-734-green-minimal.log`다. 이후 의도한 setup PATCH 이름/정확ID guard를 추가한 최종source와는 구분해 최종32case로 다시 검증한다. 임시 DEBUG instrumentation은0이다.

### 이번 동결 후보의 영향 기반 실행 계획

qa_docs가 실제 discovery로 A21case/8file + B11case/4file = **32unique case/11unique spec, case중복0**을 확인했다. 모든 누적 실패14case와 원본 #734 unminimized8·기존System on-demandID 교정6·identifier/공용Editor/v2음성을 포함한다. A/B는 workers1/retries0/max-failures0으로 순차 실행하며 원본에 필요한 선행조건을 제거해 개수를 맞추지 않는다.

- A21: #621 exactTask/실물filter/정확Assignment3, #623여섯mutation1, #624같은원본1, #620실제HTTP1, #726Task직접1, KPI request-state5폭5, #719logisticshelp1, #734전체8.
- B11: #735전체6, #7171440 identifier/복사·deniedfallback/keyboard1, #456공용density정상·validation/pending/Escape2, KPI wrongrevision/malformed음성2.
- 역사capture Unit4(`prepr-verifier`, `state-consistency-runtime-fixture`, `axis-transaction-runtime-fixture`, `canonical-recovery-runtime`) 및 Zod npm audit는 browser32와 별도로 실행한다.
- #717다른폭/touch·490/491/viewport와 나머지전체E2E는 이번직접교정(기존#734fixture1)의 변경 비영향·비용 범위를 근거로 NOT TESTED→원격Full8로 인계한다. 새 실제 실패/제품변경이 발견되면 다시 영향 범위를 평가한다.
- Next가 isolated build UUID를 next-env/tsconfig.include에 기록하는 생성 차이는 전체config hash/변경목록으로 남긴다. app/test/lock/tools 불변과 **전체checkout sourceStable**을 혼동하지 않는다. 검증 후 생성config를 원본으로 복원하고 정적검사를 재실행한다. Pre-PR UNKNOWN/BLOCKED를 숨기거나 guard를 약화하지 않는다.

### 동결 보안·historical capture 검증

최종기존#734helperguard source동결후 `npm test -- tests/scripts/prepr-verifier.test.ts tests/features/gantt/state-consistency-runtime-fixture.test.ts tests/features/gantt/axis-transaction-runtime-fixture.test.ts tests/features/gantt/canonical-recovery-runtime.test.ts`는 **4files/40tests PASS(exit0)**다. 역사Core캡처를재작성하지않고허용Zod4.6.7뿐인정·잘못된version/manifest/registry/SRI/lock 음성을유지한다. 원문 `/tmp/issue785-rework-unit.log`의일부Git missing-revision stderr는음성guard호출이며Vitest실제판정40PASS와구분한다.

같은package/lock의 `npm audit --omit=dev --json`는exit0, 운영의존성 total/high/critical을포함해모든취약수0이었다. [정제audit영수증](evidence/issue-785/rework-security-audit.json)에Node22.14.0/npm11.10.0·manifest/lockSHA256·설치zod4.6.7을보존한다. 개발의존성/새Docker이미지·원격Required전체PASS를뜻하지않는다. browserA/B32는 이40Unit·audit와 별도로 모두 PASS했다.

정제원격JSON의3197 `directFailure.error` 중 previous mutating case는수집시점가설이다. `interpretationCorrection`과이F785-004의현재확정(same-case staleDTO·단독재현)을우선하며,원격expected/actual/RunSHA/결론은변경하지않았다. JSON failedSpecUnion2는원격실패file합집합,본원장browser8은초기로컬포함합집합으로서모집단이다르다.

### 동결 browser Batch A 결과

A는 **21/21 PASS(9.3분), skip/flaky0, exit0**다. [정제case/명령/source영수증](evidence/issue-785/rework-browser-a.json)에누적실패case·원래순서#734전체8·정확ID/숫자/dirty/401412/pending/출처와기존KPIv2/HTTP재시작을연결했다. 변경#734guard의최종hash `fcfa8253a808096cca79f73faa7ab262874974acda5d374f2b9cac7b8e40db16`에서모두통과했으며, 단독green만으로결론을대체하지않았다.

A시작/끝의정의된app/test/lock/tool/staticconfig1128파일digest는 `0e413386703ac3ae1a143e31340fcf141b842b3ad6d4e1db55fffe1bb4976aef`로동일/sourceChangedPaths0이다. 반면Next자동생성 `next-env.d.ts`/`tsconfig.json`전후hash가변해 **fullCheckoutSourceStable=false**다. scoped sourceStable=true를전체checkout불변/PREPR전체PASS로표현하지않는다. 원문/trace/전체manifest는 /tmp에보존했고문서/evidence는Manager병행작성범위로manifest에서제외됐음을명시했다. B11도 같은 scoped frozen source로 **11/11 PASS(4.2분)**했다. A/B 합계 고유32/32 PASS·중복/skip/flaky/retry0이다.


### F785-004 최종 로컬 회귀·게시 경계

[최종 browser 영수증](evidence/issue-785/rework-browser-final.json)은 A21/21(9.3분)·[B11/11](evidence/issue-785/rework-browser-b.json)(4.2분), 고유32case/11spec·중복/skip/flaky/retry0을 기록한다. 원래 #734 전체8의 순서와 #735 전체6을 포함하며 실제HTTP/SQLite와 mock case의 검증 범위를 구분한다. 네 A/B 시작·종료의 1128파일 scoped digest가 모두 같고 제품/공유 fixture/#735 변경0이다. 전체checkout sourceStable=false라는 Next 생성config 차이는 그대로 보존했다.

브라우저 종료 후 next-env.d.ts/tsconfig.json·과거 추적 screenshot/evidence 생성물을 원본 HEAD로 복원하고 새 비추적 output은 /tmp에 보존했다. raw log/trace/DB를 게시하지 않는다. [복원 후 정적 영수증](evidence/issue-785/rework-static.json): typecheck PASS/exit0, 전체 ESLint PASS/exit0·기존 warning10/error0이다. TEST_PLAN 원본 blob `1d2b679dda6730306d8f6586ba3921a9458d4e9f`는 변경하지 않았다.

[현행 자동선정](evidence/issue-785/rework-prepr-fast.json)은 **BLOCKED/exit1**, selection109/UNKNOWN30/missing0/내부step0이며 해당 실행의 sourceStable=true다. 이는 브라우저 전체checkout의 안정성 판정과 다른 실행이다. 과거108/28과 현재109/30을 혼용하지 않고 자동선정 guard를 우회하지 않는다. 기존 [28 producer 수동영향매핑](evidence/issue-785/manual-impact-mapping.json)에 추가된 `tests/e2e/fixtures/task-editor-density.ts`는 B density2와 A/B KPI wire 소비자로, `tests/fixtures/gantt-state-consistency/approved-zod-4.6.7-lock.json`은 역사capture/prepr Unit4의 정확version/registry/SRI 음성으로 수동 매핑했다. 자동UNKNOWN을 제거한 것은 아니다.

영향 기반 직접 실행32·Unit40·운영audit0은 별도 실제 증거이며 공식 새Head Full Quality/Chromium8/Docker·Trusted/Owner는 NOT TESTED다. #490/#491/viewport·나머지 전체E2E, 운영DB/외부소비자·AC4 legacy관계 안전편집은 이번 로컬 검증 범위에 추가하지 않는다.


### F785-004 독립 사전 검토와 인계

실제 별도 `/root/qa_review`는 구현 파일을 수정하지 않는 read-only 검토로 원본 red·same-case staleDTO 원인·엄격한 교정·누적 실패 이력·동결 browser32/Unit40/audit0·정적검사·문서/출처를 대조해 **PRE_QA=PASS, 미해결 지적0**을 반환했다. 이는 이번 보완의 PR 게시 준비 범위이며 정식 인간 APPROVED·Trusted QA·Owner HIGH 위험 수용 또는 전체 Issue ACCEPT가 아니다. 새 Head Required3/Trusted/QA_FINAL·Owner ACCEPT는 NOT TESTED, AC4 미구현/예외 승인 없음·release_authorized=false·MERGE_READY=BLOCKED를 유지한다. 마지막 원격 lease/리뷰/충돌 확인 후 기존 PR #787의 단일 새 Head synchronize Full CI 등록까지 인계하고 완료 결과는 모니터링하지 않는다.


## GIT-BASE-002 — 게시 직전 main 이동과 실제 충돌 통합 (2026-10-24 KST)

원격 쓰기 전 최종 lease에서 main이 기존 `427d22245fb8e11254b2424ea5147ccbd5766979`에서 #556/PR #786 merge `dd7f4d86db06e8a10b8c86b5412ed319154011e0`으로 이동했음을 발견했다. PR Head는 `14a2be51c421eaab0f7f1f4004f4fe222dea21d7` 그대로였고 PR API base 갱신이 지연되어 실제 main ref와 교차 확인했다. candidate object·본문·ref 원격 쓰기는 모두0인 상태에서 게시를 중단했다. 로컬 사전 후보 `e49e397b8be9eff483ec1906256b579c3b7f63d1`의 PRE_QA/32browser/40Unit/audit0은 **기존 base에 한정**하며 새 merge source의 PASS로 전용하지 않는다.

새 main의59파일에는 일정 상단·조회 버튼/모달 배경 geometry·관련 UI 회귀와 동일 Zod4.6.7·historical capture 보호가 포함됐다. `git merge --no-commit --no-ff origin/main`으로 실제15개 충돌을 확인했다. 문서9개는 두 Issue의 독립 요구사항·검증·보안 경계를 함께 보존하고 README의 동일 Zod 설명만 통합했다. package/lock 및 capture/allowlist/prepr5개는 infra, #621 E2E1개와 자동 merge된 shared UI 검토는 frontend가 소유하며 Manager가 문서를 담당한다. 이전 source의 테스트/증거를 삭제하지 않는다.

TEST_PLAN은 이전 원본 blob `1d2b679dda6730306d8f6586ba3921a9458d4e9f`를 유지했던 단계 이후, 새 main의 #556 섹션을 **전체 파일 기반으로 추가 통합**한다. 이는 다시 발생한 대용량 부분조회 덮어쓰기 손상이 아니다. 전체 기존 본문과 #785 영향표·#556 density/조회 회귀를 모두 유지하며 새 최종 blob은 통합 영수증으로 판정한다.

새 동결 source에서 충돌 해소·정적/역사Unit·#734/#735·공유 UI·#621 교차 회귀 및 별도 PRE_QA를 다시 판정한다. 원격 Required/Trusted/Owner·AC4 안전편집·release 권한과 CI 시작까지만이라는 범위는 불변이다.


### 새 main 통합의 영향·회귀 계획

문서9충돌은 양쪽 Issue 섹션을 합쳐 해결했다. package/lock은 새 main과 앱 version0.131.0만 다르고 기존 #785 HEAD 내용과 동일하다. [infra 충돌 영수증](evidence/issue-785/rework-main-infra-resolution.json)은 allowlist의 신뢰 moduleURL·Zod exact5metadata와 양쪽 negative 합집합·불변 snapshot 보존 및 통합된 역사Unit4파일40PASS를 기록한다. 보안 패치/앱 minor 결정을 서로 덮어쓰지 않는다.

새 main이 변경한 shared workspace/CSS·#621 이름/조회·Gantt geometry 소비자 때문에 기존32를 새 source에서 반복하고 #556 직접영향18을 더해 고유50case/두 bounded batch로 검증한다. 추가18은 canonical-projection metadata의5폭×Day/Week10(기존원격768Day 실패 포함), modal-feedback1(엄격 box equality), filter-toolbar1, empty-summary2, resource-drill-ui2, workspace5181, hierarchy3991이다. 최초 원격 실패·인접 readonly/empty/selection/범위·focus·peer/geometry 보호를 포함하며 skip/timeout/retry/shard를 바꾸지 않는다. 새 UI 설계·px개선 실측을 주장하지 않고 main 과거실측과 새 합병 교차회귀를 분리한다. 의미있는 UI 교정이나 actual geometry FAIL이 추가되면 그때 capture/영향 확대를 판단한다.

통합 중 이전 HEAD 대비 staged diff검사에서 새 main에 이미 있는 #556 원장/Packet의 EOF 빈줄2건을 관측했다. 이는 base 유입 문서로 보존하며 현재 PR 기준 `git diff --check origin/main`은 충돌 union의 SECURITY 끝 빈줄 정리 후 PASS다. Markdown317파일 링크·version0.131.0 검사도 PASS다.

새 main 통합 후 실제 discovery는 A27/9files+B23/10files, 고유50case/18spec·중복0이다. 초기 source manifest는 HEAD `e49e397b8be9eff483ec1906256b579c3b7f63d1` + MERGE_HEAD `dd7f4d86db06e8a10b8c86b5412ed319154011e0` 상태에서1128파일 digest `45e587eb3b73f4fe3aefed0a1cd2c918b14346d1fb8a935605bcf1ca6d7964f3`를 고정했다. 배치·명령·case별 결과·생성config의 전후차이는 /tmp/issue785-post-main-*에 이전32와 분리해 보존한다. 실행 중에는 전체PASS를 주장하지 않는다.

### 새 main 통합 Batch A 결과

[통합 A 영수증](evidence/issue-785/rework-post-main-browser-a.json)은 **27/27 PASS(12.5분), skip/flaky/retry0·exit0**이다. 기존 누적 실패/설비 전체8/System 전체6·실제HTTP/SQLite 재시작까지 검증했다.1128파일 scoped digest45e587eb3b73f4fe3aefed0a1cd2c918b14346d1fb8a935605bcf1ca6d7964f3은 전후 동일하고 Next 생성config2개의 차이는 별도 fullCheckoutSourceStable=false로 보존했다. B23은 동일 frozen source로 이어 실행하며 전체50 최종 판정은 실행 종료 후 기록한다.

### 새 main 통합 최종 browser 결과와 정적 검사 인계

[통합 최종 영수증](evidence/issue-785/rework-post-main-browser-final.json)은 **A27/27(12.5분)+B23/23(3.0분), 고유50case/18spec·중복/skip/flaky/retry0·exit0**다. [B 영수증](evidence/issue-785/rework-post-main-browser-b.json)의 #570 metadata5폭×Day/Week10(768Day 포함)·modal 엄격 box equality·toolbar/empty/readonly/peer·범위/계층·공용density 음성까지 통과했다. 이전32를 재사용한 결과가 아니다.

네 A/B 시작/종료의1128파일 digest는 `45e587eb3b73f4fe3aefed0a1cd2c918b14346d1fb8a935605bcf1ca6d7964f3`로 동일하며 실행 후 현재파일도 전부 일치한다. 새 UI 수정은 없었으므로 별도 px개선/capture 주장을 추가하지 않는다. fullCheckoutSourceStable=false인 Next 생성config2개의 변경은 그대로 기록했다. 종료 후 자동생성 AGENTS/config·과거 추적이미지/측정자료는 **merge index 기준**으로 복원했고 새로운 raw output은 /tmp에 보존했다. main에서 유입된 #556 역사증거를 HEAD 기준으로 지우거나 새785증거로 덮지 않았다. 복원 후 최종 정적검사·현재base 자동fast·별도 PRE_QA는 아래 최종 영수증으로 인계한다.

### 새 main 통합 최종 정적·자동선정 영수증

[복원 후 최종 정적검사](evidence/issue-785/rework-post-main-static.json)는 typecheck PASS/exit0·전체 ESLint PASS/exit0(error0/기존 warning10), Markdown317파일·version0.131.0·현재main대비 diff PASS다. TEST_PLAN 최종 blob은 `5edc20685005d8877d160059e5fff9ba46c3bac0`(1,083,528bytes)이며 main대비 #785 섹션21줄 추가/삭제0로 기존 전체본문과 #556 섹션을 보존한다. 역사capture Unit4파일40/40PASS(1.47초)의source5개도 최종bytes와 일치한다. 운영audit0은 package/lock bytes가 이전 실행과 완전히 같은 입력에만 재사용하며 새 통합browser50은 별도 실제 실행이다.

통합 main을 실제 부모로 가진 로컬 merge commit `66c49810bee4cd794231057351556273d3ee9b73`에서 [새 자동fast](evidence/issue-785/rework-post-main-prepr-fast.json)를 실행했다. base는 `dd7f4d86db06e8a10b8c86b5412ed319154011e0`, **BLOCKED/exit1·selection109/UNKNOWN30/missing0/내부step0·sourceStable=true**다. 증가2경로 density fixture/Zod allowlist와 기존28 수동영향표를 유지하고 CLI미등록 상태를 수정하지 않았다. 이후 문서/정제영수증만 보완하며 runtime/test/lock/tools1128 지문은 그대로다. 정식 새Head Required3/Trusted/QA_FINAL·Owner ACCEPT/AC4 안전편집은 미충족이며 MERGE_READY=BLOCKED다.

### 새 main 통합 PRE_QA 및 게시 판정

구현자와 분리된 실제 read-only `/root/qa_review`는 새 통합 source·원문/정제50case 전수·18spec 합집합·1128파일 네 지문·역사Unit40·정적검사·docs_gate 구조 및 의미·문서/PR초안을 대조해 **PRE_QA=PASS, 미해결 지적0**을 반환했다. 검토한 로컬 merge66c49810의 코드/테스트/lock/tools는 이후 문서·판정 stamp만 보완하는 최종 tree와 동일하다. 초기 e49의 이전32/PRE_QA를 새 source에 재사용하지 않았다.

이는 PR 게시 준비의 사전 검토이며 정식 새Head Required Quality/E2E8/Docker·default-branch Trusted/QA_FINAL·Owner HIGH 위험 수용·전체 Issue ACCEPT를 대체하지 않는다. AC4 안전편집 NOT IMPLEMENTED/READONLY·Owner예외없음, release_required=true/release_authorized=false·MERGE_READY=BLOCKED를 유지한다. 마지막 원격 main/head lease·review thread·test-merge 출처를 확인해 기존 PR787 본문1회·Head1회 반영 후 새Full CI 시작만 확인하고 모니터링하지 않는다. 새Run/Attempt·Head/base/testmerge는 Issue STATUS에 기록한다.


## F785-005 — Full #3204.1 Task Editor 물류 snapshot 계약 누락 (2026-10-24 KST)

### 원격 원본·전체 이력 대조

[정제 원격 영수증](evidence/issue-785/ci-40040333641-attempt-1.json), [원본 Job](https://github.com/planner77/masterGantt/actions/runs/40040333641/job/120710326907): event pull_request, `.github/workflows/ci.yml`, Run40040333641/attempt1, Headf03933cb16c6c99a1a35a3095b55b6158d69bab5·base dd7f4d86db06e8a10b8c86b5412ed319154011e0·checkout/test merge c442e7c6da33c5a7f92bac038bdddbe36f1cda96다. GitHub immutable 두 부모 [dd7f,f039]와 tree ec868480f750d6f708943a06a935771a1f942987를 교차 확인했다. PR/current main drift0·review thread0·mergeable=true는 조회 시점 사실이다.

직접 FAIL은 `tests/e2e/project-task-editor.spec.ts:1183`의 `#461 Logistics 별도 초안·외부 revision·401 유지와 교차 저장 잠금`, line1191의 `dialog.getByRole("checkbox", {name:/설비 초안/}).check()`다. locator.check Test timeout30000ms, shard2 67PASS/1FAIL/25NOTRUN·12.3분이다. Quality/Policy/Typecheck/Lint/Unit/Build/Docker PASS, E2E aggregate/QA는 원본 E2E에 따른 파생 FAIL이다. 취소7개 shard 로그도 전부 읽었으며 추가 기록된 testFAIL0, 누적 취소로그35개다. 미실행/취소는 PASS가 아니다. 이번 advisory53은 SKIPPED이며 이전5개 advisory와 분리해 Full/Required 증거로 쓰지 않는다.

source artifact12539260992는 unique/unexpired metadata만 조회했고 payload/schema 검증은 NOT TESTED다. 이를 default-main Trusted QA provenance PASS로 주장하지 않는다. raw 로그/trace는 /tmp/issue785-rerun2-*에 보존하고 Git에는 정제 자료만 둔다. 이전0a33 bot no-findings·과거 PRE_QA는 현재 후보의 승인으로 사용하지 않는다.

### 원본 red·세 가설·반례

변경 없는 f039 source의 spec SHA256 `8d3450bfbdb24459c91f1332069504017e2995d56013c17ffd08900b13e4ccf2`에서 `env -u PLAYWRIGHT_BASE_URL npx --no-install playwright test --config tests/config/playwright.config.ts tests/e2e/project-task-editor.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0 --grep 'Logistics 별도 초안'`를 실제 실행했다. 같은 checkbox 대기30초로 FAIL했고 error-context에 물류 연결 로드 오류·서버 권한 확인불가와 checkbox0을 확인했다. 단독으로 같은 증상이므로 앞선67개 사례 오염은 필수 원인이 아니다.

사용자에게 (1) 성공 links mock 필수 snapshot metadata 누락, (2) master 기준정보 형식 불일치, (3) route 매칭/요청 순서 경합의 세 가설과 각각의 반증 예측을 제시한 뒤 좁은 trace probe로 검증했다. [허용 필드 probe](evidence/issue-785/rerun2-f005-snapshot-probe.json)에서 links GET200의 요청 taskId·내부 taskId는 정확히 일치했다. master GET200·revision20·permission edit·의도한 설비1/role[]도 정상이다. 반면 links에는 projectRevision/compatibilityLinks 키가 없었다.

**두 필드만 보완**한 통제 변형의 원래 scenario는 1/1PASS(본문2.9초/전체6.2초)였다. master/route/제품 guard·assertion/timeout은 그대로여서 (1)이 지지되고 (2)/(3)은 반증됐다. 분류는 TEST_CONTRACT다. 이 중간 green과 최종 source의 확대 검증은 구분한다. F785-001의 KPI v2 missing-schema와 같은 '성공 mock 계약 소비자 누락' 계열이나 응답·validator·실패case가 다르며, F785-004의 stale DTO 반환과도 별개다.

### 공유 소비자 누락과 검증 범위 정정

같은 누락을 `task-link-load-safety.spec.ts` 성공 helper(복구6/권한4/지연1/readonly1의12case)와 `fixtures/task-editor-density.ts` 성공 GET에서도 확인했다. 이전50 중 `task-editor-form-density.spec.ts`의 물류 geometry는 tabpanel visible만 확인하여 오류 상태의 geometry가 통과할 수 있었다. **기존 PASS 판정은 실제 assertion 그대로 보존하지만 정상 물류 데이터 로드의 실증으로 확대하지 않는다.** 이 검증 공백은 FIXTURE_OBSERVABILITY이며 당시 assertion의 실제 PASS를 FAIL로 소급하지 않는다. 새 후보는 해당 성공 화면의 ready/empty/물류 연결 저장 제어·오류0 확인을 기존 case에 EXTEND한다.

성공 fixture에만 정확한 현재 projectRevision·compatibilityLinks를 제공하고, DTO의 optional 필드를 누락할 수 없도록 테스트 전용 Required<Pick> 검사를 보완한다. 제품 DTO/validator를 느슨하게 하지 않는다. 의도한 malformed/wrong-task/wrong-revision/permission missing·401/412·late-response·readonly의 음성 보호는 유지한다. 신규 상시 spec/skip/timeout/retry·CI8/Required3·보안/릴리스 정책 변경0이다.

### 현재 후보 Cross-run 매트릭스·선정

| 과거/현재 경계 | 이전 증거·이번 영향 | 최종 동결 후보 계획 |
| --- | --- | --- |
| #719 KPI v2(F001) | 성공 wire schema 누락 교정 보존 | 기존 logistics 도움말·KPI5폭/v2음성 재실행 |
| Zod/history(F002) | 동일package/lock·capture의 정확version/registry/SRI·불변 원본 보호 | 변경없는 입력의 기존Unit40/audit0 범위만 재사용; 공식 새CI는 별도 |
| #734 ID(F003)·stale DTO(F004) | on-demand exact ID/name/dirty/revision/focus 보호 | 원래순서 전체8 재실행 |
| #735 공유 System | 정확 원본·저장/취소/5폭·readonly | 기존전체6 재실행 |
| #621/#623/#624 | 실제 source·snapshot 유지/6writes·Origin/같은원본 | 기존 선정5case 재실행 |
| resource-target-dashboard-api | retired fixture·공개v2/legacyv1·HTTP/SQLite/restart | 기존 실제HTTP1 재실행 |
| #726 task logistics | 초기 counter fixture 원인과 Task 직접/상속 | 기존1+인접2=전체3 |
| logistics-dashboard-request-state | 초기capture staging·공개v2·snapshot 음성 | 기존5폭+wrong-revision/malformed2 재실행 |
| project-task-editor(F005) | 성공links metadata 누락 | #4617case 및 원래실패 재실행 |
| load-safety/density shared | 같은누락12소비자·오류화면geometry 검증공백 | safety12+기존density2의성공oracle 강화 |
| main #556 shared workspace | runtime/CSS변경없음·기존모달/metadata/범위/조회 경계 | 이전직접영향18도 새source로재실행 |

최초부터 원격 실제실패 file합집합은 #719/#734/project-task-editor의3개이며, 초기 local6개 실패를 합친 논리적 browser실패 합집합은 **9spec**다. System·load-safety/density·identifier·실제 #726 인접 및 main18을 함께 선정했다. 계획은 이전50+새#4617+safety12+#726추가2=**고유71case/20spec**의두 bounded batch다. 예A36/10spec+B35/11spec, 중복case0은 discovery로 확인하고 실행한다. 전체E2E139spec/미선정조합은 원격Full8로 인계하며 runtime/test/lock/tools 지문·최종 명령·고유case/시간/원문을 실제 실행 후 기록한다. 아직 최종71/PRE_QA/새Required·Trusted·Owner는 NOT TESTED다.

Manager는 원장/Packet/정제증거·Issue댓글, frontend는 mock3곳+기존density spec의단일writer, infra는원격출처/마지막게시, qa_docs는별도read-only검토를소유한다. source동결 후 결과를 서로다른후보와합산하지않고 생성config차이/자동prepr UNKNOWN도보존한다. HIGH/OWNER_MANAGED·AC4안전편집미구현/Owner예외없음·release_authorized=false/MERGE_READY=BLOCKED는 불변이다. 새CI시작까지만 수행하고 완료모니터링·merge/Main/GHCR/Release/Issue종료/브랜치정리는 제외한다.

### F785-005 성공 생산자 감사와 동결

별도 qa_docs의 [정적 생산자 감사](evidence/issue-785/rerun2-f005-producer-audit.json)는 endpoint 참조17파일과 DTO 배열필드 검색·가져오는stateful fixture를 교차 확인했다. 성공 GET 생산자는 정확3곳이며 현재 revision/compatibility 배열/필수 타입 검사가 모두 있다. 검색범위에서 남은 성공producer metadata누락은0이다. 의도한 오류·요청0인 redirect목적지 응답·실제HTTP/GET전달·PUT gate/오류 주입·관측 helper는 성공생산자에서 제외한 이유를 함께 기록했다. 정적 감사 PASS는 runtime71/PRE_QA를 대체하지 않는다.

최종4파일 외 제품/API/DB/CI/공용 DTO 변경은0이다. frontend의 typecheck·변경4파일 ESLint·diff PASS 후 실제 discovery A36/10spec+B35/11spec, case중복0·고유71/20spec을 고정했다. `tracked src/tests/scripts + package/lock/static runtime-tool configs`1128파일(문서 제외) SHA256은 `60648b89a19a29597390a5a015d1f8dc23176408ddfdb050c6b7df7b6180d776`이다. /tmp/issue785-rerun2-final-selection.json 및 before/after-source·원문/정제batch 결과는 이전50과 다른 prefix로 보존한다. 테스트 생성config는 별도 전후 hash로 보고하며 실행 종료·복원 후 최종 정적검사/자동fast/사전검토를 기록한다.

### F785-005 실행 목록 재조회 범위

[새 원격 이력 조회](evidence/issue-785/rerun2-history-requery.json)는 branch의12/12 Run(Full6+advisory6)과 알려진6Head 각각의pull_request Run2/2를 별도 조회했다. per_page100 첫 페이지에 total_count 전부가 반환됐고 알려진6Full의 최신attempt는 모두1이었다. 이 조회범위의 pagination 누락/권한오류0이며 추가Full/attempt는 없었다. 과거5회의 immutable merge부모·직접/취소28로그 **내용**은 이전 정제영수증을 재사용했고, 목록·Head·최신attempt는 이번에 새로 대조했다. 신규3204의 direct/취소7로그는 새로 읽었다. 조직전체/Trusted workflow나 artifact payload 검증까지 완료했다고 확대하지 않는다.

### F785-005 최종 Batch A 결과

[동결 A 영수증](evidence/issue-785/rerun2-browser-a.json)은 **36/36 PASS(14.2분), skip/flaky/retry0·exit0**이다. 원본실패#461(최종본문3.2초)을 포함한 group7개·#7348·#7356·#726전체3·이전누적실패/HTTP·SQLite 재시작을 같은후보에서 검증했다. runtime/test/lock/tools1128파일 지문60648b89a19a29597390a5a015d1f8dc23176408ddfdb050c6b7df7b6180d776이 시작/종료 동일함을 확인했다. Next 자동생성2config 차이는 별도로 기록해 fullCheckoutSourceStable=true로 확대하지 않는다. B35는 같은 source로 진행하며 전체71/최종PRE_QA/새원격결과는 아직 NOT TESTED다.

### F785-005 최종 검증 영수증

[최종 browser](evidence/issue-785/rerun2-browser-final.json): **A36/36(14.2분)+B35/35(3.7분)=71/71 PASS,20spec·중복/skip/flaky/retry0·exit0**다. 원격실패#461 group7과safety12·#726전체3, 이전누적9실패spec·System·identifier/KPI·main18을 같은최종source에서검증했다. 새정상dataready/빈목록·물류연결저장활성·로드오류0을확인한5폭geometry도통과했으며기존keyboardcase/의도negative는유지됐다. [B 영수증](evidence/issue-785/rerun2-browser-b.json)과[원인/동결지문](evidence/issue-785/rerun2-f005-diagnosis.json)에각실행을연결한다.

네 A/B 시작/종료1128파일과현재파일의SHA256은모두 `60648b89a19a29597390a5a015d1f8dc23176408ddfdb050c6b7df7b6180d776`다. scopedSourceStable=true와Next생성next-env/tsconfig2개에따른fullCheckoutSourceStable=false를구분한다. 종료후추적58개생성물은HEADf039원본으로복원하고새raw output/trace/HTML은/tmp로보존해Git에게시하지않았다. 이전#556/기타issue의역사이미지를새측정자료로덮지않았다.

[복원후정적검사](evidence/issue-785/rerun2-static.json)는typecheckPASS/exit0,전체lintPASS/exit0(error0/기존warning10),Markdown317파일링크·version0.131.0·main대비diffPASS다. TEST_PLANblob5edc20685005d8877d160059e5fff9ba46c3bac0은변경없다. 제품src/공용DTO/guard·package/lock·Unit/capture검증입력변경0이므로이전Unit40·audit0은그입력범위에서만참고/제한재사용하며새로운실행/공식새HeadPASS로주장하지않는다.

[현행자동fast](evidence/issue-785/rerun2-prepr-fast.json)는 **BLOCKED/exit1·selected111/UNKNOWN30/missing0/내부step0·sourceStable=true**다. 이전109선정과새111선정을혼용하지않으며새로교정한E2E두파일직접선정이추가됐다. Unknown30의생산자수동영향매핑과71실제실행은자동판정을우회하거나변경하지않는다. 로그출력을읽던최초shell wrapper의exit0을PASS로사용하지않고최종직접명령의exit1을확인했다. 이후문서/판정stamp만보완하며src/tests/lock/tools지문은그대로다.

정식새Head Quality/E2E8/Docker·default-main Trusted/QA_FINAL·Owner ACCEPT는NOT TESTED,AC4안전편집미구현/예외없음·MERGE_READY=BLOCKED/release_authorized=false를유지한다. 최종실제별도read-only PRE_QA후기존PR787의본문1회·Head1회반영과새FullCI등록/시작확인으로인계한다.

### F785-005 독립 사전 검토와 PR 인계

실제 분리된 read-only `/root/qa_review`가 기준Headf039의 working후보(테스트4파일+문서, runtime/test/lock/tools지문60648b89a19a29597390a5a015d1f8dc23176408ddfdb050c6b7df7b6180d776)를 검토해 **PRE_QA=PASS, 미해결 지적0**을 반환했다. 원문71case/20spec·네1128파일manifest·성공producer3곳·모든음성/dirty/401412/ID보호·정적로그·문서구조/매핑·관측한계를 실제 대조했다. baseline f039 자체의 미수정 코드가 PASS했다는 뜻이 아니며, 이후 판정stamp/문서만 보완하고 source추가변경은없다. 게시될candidate의전체tree와검토tree를동일하게확인한다.

이검토는게시준비범위이며새Head의Required3/Trusted/Owner·전체AC수용을대체하지않는다. 실제원격reviewthreads/main충돌·head/baselease를다시확인한후기존PR787본문1회/Head1회로일괄반영하고새FullCI의정확RunID+attempt/Head/base/testmerge·시작상태를Issue STATUS에기록한다. 기존3204FAIL은불변이다. AC4미구현/예외없음·HIGH/OWNER_MANAGED/qa_required=true·Manager NOT TESTED/MERGE_READY BLOCKED·release_authorized=false와모니터링/병합/정식게시/Issue종료제외를유지한다.


## F785-006 — Full #3208.1 설비 저장 후 보고서 관점 불일치 (2026-10-24 KST)

### 원본 실행·metadata 분리

[정제 원격 증거](evidence/issue-785/ci-40045100122-attempt-1.json), [직접 실패 Job](https://github.com/planner77/masterGantt/actions/runs/40045100122/job/120725634037): event pull_request, CI path `.github/workflows/ci.yml`, Run40045100122/attempt1, Head473b0fb103d445f64ef6b44be63a9b4d6456cbdc·base dd7f4d86db06e8a10b8c86b5412ed319154011e0·checkout/testmerge fea4ad9558eec626ecbf56dc996e7d54127d3002다. immutable 두 부모 [dd7f,473b] 및 tree1a2eebda2ee6438e73d48b455167a52d65300e33를 교차 확인했다. mutable `run.pull_requests.head`는 원본 Head 근거로 사용하지 않았다. source artifact12540783634는 unique/unexpired metadata만 조회했고 payload/schema/Trusted provenance 검증은 NOT TESTED다.

직접 FAIL은 `issue-734-equipment-dashboard.spec.ts:220`의 dirty/PATCH/snapshot/focus case, line272 `expect(after.spec).toEqual(before.spec)`다. 기대 root=equipment, 실제 root=process이며 version/contextSourceVersion/levels[]는 같다. 직전 revision+1·새snapshot 단언은 통과했고 뒤의 editor/focus 단언은 실행되지 않았다. shard2는 **5PASS/1FAIL/87NOTRUN·4.6분**이다. #3204의67/1/25와 혼용하지 않는다. 다른7 shard의 취소 로그도 모두 읽었으며 추가 기록된 testFAIL0, 누적 취소로그42개다. Quality/Typecheck/Lint/Unit/정책/PR Build/Docker PASS, E2E aggregate/Automated QA는 원본 E2E 미성공에 따른 파생 FAIL이다. GitCommitInfo fetch3000ms 경고는 해당 root 단언의 직접 원인이 아니다.

| metadata 전용 원본 | 판정과 적용 범위 |
| --- | --- |
| #3207.1 / Run40045070522 / Headf03933cb16c6c99a1a35a3095b55b6158d69bab5 | 원본Run FAIL 유지. metadata Job120724897159는 event Head와 current473b의 차이로 SUPERSEDED/full_run=N/A. Required aggregate의success status는 구현SKIPPED여서runtimePASS가 아니다. QA120724973167은 stale Head로BLOCKED이며 새Head Full/제품실패로합산하지 않는다. |

branch15/15(Full7+metadata1+advisory7), 알려진7Head별2/2(f039만metadata포함3/3)를 새로 조회했고 최신attempt는 모두1이다. 이 조회범위의 pagination누락/권한오류·추가Run/attempt는 없다. 과거원본의 immutable merge/로그 내용은 이전영수증을재사용하고 신규3208 direct/취소7 및3207metadata로그를새로읽은경계를보존한다. PR/main drift0·미해결thread0·mergeable=true는조회시점이다. 원격/소스쓰기없이수집했다.

### 진단·재현 계획과 계약

현재 분류는 UNKNOWN이다. 실제 UI 설비 관점 보존 회귀와 다른 보고서 응답의 테스트 오귀속을 분리한다. 현재#734SHA256 `fcfa8253a808096cca79f73faa7ab262874974acda5d374f2b9cac7b8e40db16`는 이전71검증과 같다. F785-003 ID·F785-004 stale DTO·F785-005 links metadata 보완을 되돌리지 않고 기존원격FAIL/로컬PASS 모두 그대로 보존한다.

원본#734전체8을workers1/retries0/max-failures0으로 먼저 실행하고 단독dirty와 비교한다. 비재현PASS는그대로기록하며원격실패를flaky로단정하지않는다. 실제POST의Project/method/spec/filter/scope와응답·revision/snapshot·현재화면root/행/focus를허용필드로연결해제어가능한피드백루프를확보한후3개이상의가설과반증예측을사용자에게제시한다. source/단언/timeout을바꾸거나성공할때까지무한retry하지않는다.

read-only 정적검토에서#734의nextReport는URLsuffix/projection.report만검사하여 BEFORE와AFTER 모두다른관점응답을잡을위험이확인됐다. 잡힌요청을API로재실행해도실제Equipment UI의관점보존을입증하지않는다. 기존#736의정확pathname/POST/전체spec·filters·scope query matching이선례다. endpoint+waitForResponse를함께쓰는7spec 중광역helper4(#730/#732/#733/#734),부분조건2(#735root/#737root+levels),정확전체조건1(#736)을감사대상으로식별했으며현재모두수정필수나제품원인이라고확정하지않는다.

[Logistics Dashboard](LOGISTICS_DASHBOARD.md)의equipment고정root/공통편집host 및#734 Packet의AC5/저장복귀계약을유지한다. 수정시에도 **실제UI설비root·동일spec/filters/scope·새revision/snapshot·정확PATCH1회·두WorkArea·수정행과원래focus복귀**가필수다. 응답body를원하는root만남기는방법으로wrong-echo를숨기지않고요청식별후응답echo를엄격히단언해야한다. 제품수정필요성/공유helper소유범위/최종회귀선정은재현근거후확정한다.

누적원격실패파일합집합은#719/#734/project-task-editor의3개,초기local6개와합친실제browser실패합집합은9spec로유지된다(같은#734의새실패사건추가). 이전71과새원인소비자/음성·저장복귀경계를동결source에서다시선정하고실행/제외·비용과source지문을기록한다. 이전71을새후보PASS로합산하지않는다. root는원장/Packet/정제증거·Issue로그,frontend는재현/교정,infra는출처/마지막게시,qa_docs는실제별도read-only검토를소유한다.

최종새후보/원격Required3·Trusted/Owner·Manager ACCEPT는NOT TESTED다. HIGH/OWNER_MANAGED/qa_required=true,AC4안전편집미구현/Owner예외없음,release_authorized=false·MERGE_READY=BLOCKED를유지한다. 끝은기존PR787의새FullCI시작이며모니터링·병합/Main/GHCR/Release/Issue종료/브랜치정리는제외한다.

### F785-006 원본 비재현·원격 trace·결정적 red

수정 없는원본#734전체8은 **8/8PASS(4.4분)**, 원본단독dirty(traceon)는 **1/1PASS(본문22.7초/전체40.6초)**였다. [자연 network 순서](evidence/issue-785/rerun3-local-natural-sequence.json)에는동일revision의equipment/process report가함께발생했고각성공응답은자신의요청spec과일치했다. 이비재현은원격FAIL을취소하거나환경flaky확정으로사용하지않는다.

원payload/status를보존하고PATCH후equipment전달만700ms지연한 [timing통제1회](evidence/issue-785/rerun3-timing-probe.json)도1/1PASS(22.6초/전체38.7초)였다. process서버응답은먼저완료됐지만browser요청이abort되어관측기에전달되지않았으므로의도한경합이재현된것이아니다. 임시DEBUGsource는/tmp에보존하고원본fcfa지문으로복원했다. 성공할때까지반복하지않고실제CItrace를조회했다.

[원본CI허용필드증거](evidence/issue-785/rerun3-ci-trace-allowed.json)는playwright-report-shard-2 artifact12541530991의ZIP4,540,711bytes를Actions SHA256 `99a75d3d3caa4de4e0a35deba67f86f6f9c1c4e4d5e627c905cefcefaca6ed34`와대조했다. 실패trace한개(3,191,690bytes)만ZIP/JSON데이터로읽었고JS/PR코드를실행하지않았다. ci-pr-source payload를검증한것은아니며auth/cookie/header/전체raw본문·원본ZIP/trace는Git에저장하지않는다.

원본Before는equipment/rev23이다. PATCH00:36:06.573Z성공/rev24후browser가00:36:06.726Z process/report,00:36:06.987Z equipment/report를각각POST하여각자200/같은root/rev24를반환했다. 그런데테스트APIRequestContext가00:36:07.295Z에다시POST한본문은process였고다시process/rev24를받아after.spec비교에사용했다. 오류DOM에서도설비tab selected·설비tabpanel/현재경로·수정된설비행이확인됐다. 이실패는서버가equipment요청의root를바꾼사례나최종UI가설비관점을잃은사례로관측되지않았다. process요청을발생시킨특정컴포넌트는확정하지않는다.

실제원본matcher source와원격응답순서를결합한명령 `node /tmp/issue785-rerun3-original-matcher-replay.cjs`를실행해 **exit1**, `Original source matcher selected: process`/expected equipment의결정적red를확보했다. 이는브라우저비재현결과와별개인 **actual matcher seam replay**다. 원본source지문/실제CI데이터를확인한뒤행한진단이며가짜제품실패로간주하지않는다. source/재현/가설대조는[진단영수증](evidence/issue-785/rerun3-f006-diagnosis.json)에연결한다.

사용자에게세가설/반증예측을공유한후 (1)광역waiter가다른정상process응답을선택한다는가설을원격trace·replay로확인했다. (2)최종UI가process로변경된다는가설은이실패시점의설비DOM/저장행에지지되지않고,(3)서버wrong-echo는관측한각요청/응답root일치로반증됐다. 분류는 **FIXTURE_OBSERVABILITY**이며제품guard/관점state를완화·변경할근거는없다. 이전F003 ID/F004stale DTO/F005mock필드누락과서로다른원인을동일#734의추가사건으로보존한다.

### F785-006 교정 범위·회귀 선정

Manager는약한6spec전체(#730/#732/#733/#734/#735/#737)의모든caller와공유exacthelper·Vitest회귀신설을승인했다. 기존#736정확조건선례는독립baseline으로유지한다. 정확Project path/POST·전체spec/filters/scope/report query와등록후request identity로대상을선택하고선택후status/응답echo를엄격검사한다. 다른내용의응답을body필터로숨기지않고UI가설비query를잃으면timeout/UI보존단언으로실패해야한다. 기존PATCH1회/revision+1/새snapshot/두WorkArea/수정행/원래focus와잘못된scope·응답역전·readonly/error음성을유지한다.

정확discovery에서교정6spec은#7306/#7324/#7335/#7348/#7356/#7376=35case,기존#7365를포함하면40case/7spec이다. 이전71과중복은#7348+#7356=14이므로 **71+40-14=97unique/25spec**이다. 수동4배치A36(10files)/B35(11files)/C15(#730/#732/#733의3files)/D11(#736/#737의2files)로각배치12파일이하를지키며최종source에서다시discovery한다. 25spec은자동진단helper상한을넘는수동분할범위라근거와전체합집합을명시하며자동workflow_dispatch/Full축소를하지않는다. 새matcherUnit은E2E97개에합산하지않는다.

TEST_LIFECYCLE_REVIEW는기존6spec의전체시나리오EXTEND·정확736/누적실패/permission·HTTPSQLite·main18 KEEP_UNIQUE,공유correlation seam의의미있는경합/wrong-echo Unit은ADD다. 새E2E상시spec/CI8-shard배치변경·skip/retry/timeout변경은없다. 새helper/Unit을source manifest에서누락하지않도록staging한뒤실제파일수/지문·최종Unit/E2E결과를기록한다. 문서영향은원장/Packet/정제증거/PR·Issue이며제품/API/DB/보안/UX계약변경없으면정책/TEST_PLAN추가수정은N/A로재사용한다. 현재최종97/Unit/PRE_QA/새Required·Trusted·Owner는NOT TESTED다.

### F785-006 보완 후보의 독립 검토 REWORK와 재동결

최초 sharedhelper 보완은 기존matcher에 대한Unit3FAIL→3PASS·확장7PASS와직접저장smoke2PASS를확인한후1130파일지문 `eddfed861b304dac186f240974bd9a2cdaec54832267491dee89d7643feb0624`로동결해97선정을시작했다. 이단계typecheck의readonly levels6오류/최소mockcast1오류도개발중발견해교정했으며최종PASS만으로초기오류를숨기지않는다.

독립qa_docs가새helper의두결함을추가로입증하여수정전본인소유driver/Playwright만안전중단했다. [중단 영수증](evidence/issue-785/rerun3-prototype-stopped.json)은A에서4PASS관측후CANCELLED, B/C/D미실행, source전후동일이다. 이는제품/원격CI새실패가아니라새보완후보의검토결함이며 **최종97PASS에부분4개를재사용하지않는다**.

- REVIEW-F006-P1: async responsepredicate가선택응답을await전에선점하지않아동일query의두미래응답이겹치면빠른두번째로통과한후늦은첫본문이공유body/text를덮을수있었다. 독립메모리harness에서선택request와cachedroot불일치및첫wrong-echo은폐를재현했고설치Playwright의동시predicate실행모델과도대조했다. 신규중첩Unit은기존7PASS+2FAIL로red였고,첫matchingResponse를await전에선점해선택응답별local cache로묶은뒤9/9PASS였다.
- REVIEW-F006-P2: filter echo가요청key만비교해조건{}에응답{taskSearch:other}도통과했다. WBS parser/service와제품transport의계약은빈배열/undefined제거·배열trim/dedupe/sort·search/taskSearch trim후 **전체조건동등성**이다. 기존#736의toMatchObject는검사한계이며공식subset계약이아니다. 추가filter거부·정상정규화양성을추가한Unit은9PASS+2FAIL→11/11PASS였다.

새predicate는처음일치한응답의capturePromise를동기로예약하고그응답의status/본문/echo검증실패를나중정상응답으로숨기지않는다. 선택request와body가일치하고listener가정리되며전체canonical filter를비교한다. caller의등록후조건객체in-place변경은확인되지않아해당추측으로범위를늘리지않았다. 두교정은원격F006의기존광역matcher오귀속과구분해보존한다.

독립read-only `/root/qa_review`는변경된helper/unit과원문red→green을다시대조하고별도메모리harness로wrong-first-echo FAIL·request/cache동일·listener0·추가filterFAIL·정상정규화PASS를확인해 **REWORK해소정적PASS/미해결0**을반환했다. 이는최종PRE_QA나97실행PASS가아니다. 관련smoke2PASS(1.5분)뒤TSindexsignature해소를위한filter객체shallowcopy만보완했고Unit/typecheck는다시PASS했다.

최종소유8파일은교정6spec+`tests/e2e/helpers/wbs-report.ts`+Vitest의`tests/scripts/wbs-report-correlation.test.ts`다. 새파일을staging하여E2E139spec계약을변경하지않고source manifest1130파일에포함했다. 새지문 `ca3e45a2e59f0cb9302e508fe2e2ef3cee60d9a2a727efb9208f367836ecc956`, helperSHA256 `5e5450870bf1b02907de9c5080716c0e72e1f8978ea03b3bafc3a726a990710c`, unitSHA256 `361affa14ca9c93b84573dcb945e8434ed06f529e326715058a1dd52e2a748a4`를고정했다. A36/B35/C15/D11=97/25spec을/tmp/issue785-rerun3-final2-*의새prefix에서처음부터실행하며중단/중간결과와합산하지않는다. Unit11은별도검증이며E2E97에합산하지않는다.

### F785-006 검증 도중 main 변경과 제한 재사용 계획

게시 준비 조회에서 main은 dd7f4d86db06e8a10b8c86b5412ed319154011e0에서 **4ce403a1e410ca599a780446f39513e1f1158326**(PR #788 / Issue #608)으로 변경됐다. 부모는 [dd7f4d86db06e8a10b8c86b5412ed319154011e0, 886e72d8911695b8b9568754c3636d00956e7f7c]다. 실제 diff는 #608 원장·Packet 두 문서와 `scripts/test_qa_final_automated.py`의 신규 세 테스트, 총3파일/222줄 추가뿐이다. 제품·validator 구현·workflow·package·JS/브라우저 테스트 변경은 없다.

진행 중인97 검증은1130파일 지문ca3e45a2e59f0cb9302e508fe2e2ef3cee60d9a2a727efb9208f367836ecc956에서 그대로 수행한다. 별도qa_docs는 Python 파일이CI quality unittest에서만 실행되고97 browser/새Unit11의import·실행 입력이 아님을 actualdiff와소비자로 확인했다. 이에 종료·생성물복원 후 main 통합, Python 전체test·Unit11·정적검사·새base 자동fast를 새로 실행하고, 전후1130manifest의 유일차이가 이Python1파일인지 대조한다. 충돌해결/추가변경이 브라우저 입력을 바꾸면 선정과 재실행을 다시 평가한다.

이 조건을 충족한 때에만97 actualPASS를 **동일 브라우저 입력에 한정한 Local Fast Feedback 재사용**으로 기록한다. 통합 source에서97을 새로 실행했다고 표현하지 않으며 이전 공식CI PASS를 새Head/base로 재사용하지 않는다. 현재 main 통합·추가검증·최종PRE_QA는 NOT TESTED이고, 새 Required3/Trusted/Owner·Manager ACCEPT와 AC4 예외 미승인은 계속 별도 gate다.

### F785-006 최종 Batch A 실제 결과

[최종 A 영수증](evidence/issue-785/rerun3-browser-a.json)은 **36/36 PASS(15.3분), skip/flaky/retry0·exit0**다. 원래실패 #734 dirty/PATCH/spec/snapshot/focus(본문23.2초)·#734 전체8·#735 전체6·이전#461 group7과 누적실패·실제HTTP/SQLite 재시작을 검증했다. 1130파일 지문ca3e45a2e59f0cb9302e508fe2e2ef3cee60d9a2a727efb9208f367836ecc956은 전후동일이다. Next가 next-env.d.ts/tsconfig.json을 생성해 fullCheckoutSourceStable=false인 사실은 별도로 보존한다. B/C/D가 같은동결source에서 계속되며 전체97·main통합 후 추가검증·최종PRE_QA는 아직 NOT TESTED다.

### F785-006 최종 Chromium 전체 결과

[최종 browser 영수증](evidence/issue-785/rerun3-browser-final.json)은 **A36/36(15.3분)+B35/35(3.9분)+C15/15(8.3분)+D11/11(5.3분)=고유97/97 PASS,25spec·중복/skip/flaky/retry0·exit0**다. 원래 #734 저장 후 관점 불일치 case와 누적9실패spec·6변경consumer 전체35·독립#736·실제HTTP/SQLite 재시작·main18/권한·KPI음성·geometry/keyboard를 같은동결source에서 검증했다. 중단prototype A4·초기smoke/비재현·Unit11은97에 합산하지 않았다.

네배치의시작/종료 총8manifest와 현재1130파일의 지문은 모두ca3e45a2e59f0cb9302e508fe2e2ef3cee60d9a2a727efb9208f367836ecc956이다. scopedSourceStable=true이며 각배치Next생성next-env/tsconfig차이때문에 fullCheckoutSourceStable=false다. 모든원문로그/trace/HTML과전체manifest는/tmp에보존하고Git에는허용필드JSON만게시한다. [Unit 별도영수증](evidence/issue-785/rerun3-unit.json)은11/11PASS(165ms)와원문해시·3FAIL→3PASS/7확장·검토P1 7+2→9/P2 9+2→11을연결한다.

이97은main4ce통합전ca3source의실측이다. 다음생성물복원·main통합·Python전체/Unit11·정적fresh·새base자동fast·실제manifest유일차이대조 및최종PRE_QA를완료하기전게시하지않는다. 새Head Required3/Trusted/Owner는계속NOT TESTED이고AC4/Owner예외없음·MERGE_READY BLOCKED를유지한다.

### F785-006 main 통합·생성물 복원·입력 대조 완료

[생성물 복원 영수증](evidence/issue-785/rerun3-generated-cleanup.json): 실행이 끝난 후 추적74개를원본Head473b로복원하고미추적26파일을/tmp보존공간으로옮겼다. AGENTS/Next설정·다른Issue의역사스크린샷을새결과로덮지않았다. TEST_PLAN전체1,083,528B/blob5edc20685005d8877d160059e5fff9ba46c3bac0은그대로다.

로컬보완commit8c69d9a7을보존하고main4ce403a1e410ca599a780446f39513e1f1158326을mergecommit8914d89f760cd18abbf57426488b316a38fbf831로 **충돌0** 통합했다. [입력한정재사용 영수증](evidence/issue-785/rerun3-main-input-reuse.json)은1130manifest의유일변경이scripts/test_qa_final_automated.py이며제품/validator/workflow/package/E2E/helper/Unit11입력이동일함을확인한다. 통합지문은 **a98f0ffb6dd0434afe17cab5416fb2417d85c0acdbdaa6328332d374a20b453b**다. 이지문에서97을새로실행한것은아니며ca3의실제97을동일브라우저입력한정Local Fast Feedback으로재사용한다. 공식과거CI PASS는새base로재사용하지않는다.

[통합후새실행](evidence/issue-785/rerun3-postmerge-verification.json)은PythonQA전체 **37/37PASS**(신규3test포함)와helper Unit **11/11PASS(160ms)**다. API/Artifact403404429·네트워크/timeout/malformed의BLOCKED보존을mock검사했고실제외부Trusted승인PASS를뜻하지않는다. 이후source변경없이최종정적/자동fast·독립PRE_QA와게시lease/스레드를확인한다. 새원격Required3/Trusted/Owner·Manager ACCEPT/AC4예외는계속NOT TESTED다.

### F785-006 통합후 정적·자동 fast 판정

[새 정적영수증](evidence/issue-785/rerun3-static.json)은통합지문a98f0ffb6dd0434afe17cab5416fb2417d85c0acdbdaa6328332d374a20b453b에서typecheckPASS·전체lintPASS(error0/기존warning10)·Markdown319파일링크PASS·version0.131.0과main대비diffPASS다. #608 문서2개추가로이전317파일과구분한다.

[새base 자동fast](evidence/issue-785/rerun3-prepr-fast.json)는 **BLOCKED/exit1·selected115/UNKNOWN31/missing0/내부step0·sourceStable=true**다. 이전111/UNKNOWN30과혼용하지않는다. 새UNKNOWN은sharedhelper `tests/e2e/helpers/wbs-report.ts`1개이며직접Unit11과변경6consumer전체35case로수동영향을매핑했다. 기존30UNKNOWN의수동영향표와density/lockfixture추가지도는유지한다. 이수동mapping과97actualPASS는자동선정BLOCKED를PASS로바꾸거나selector정책을우회하지않는다.

이후변경은문서/판정영수증뿐이다. 최종read-only PRE_QA에서원문4batch/8manifest·입력한정재사용·Python37/Unit11·정적·자동BLOCKED·원장/Packet/PR본문·AC4/Owner/공식원격판정경계를대조한후clean최종tree를게시한다. source/guard·CI8shard/35분/Required3/보안·registry권한은변경없다.

### F785-006 독립 사전 검토와 최종 PR 인계

실제 별도 read-only `/root/qa_review`가 최종 통합 후보를 검토해 **PRE_QA=PASS, 미해결 지적0**을 반환했다([검토 영수증](evidence/issue-785/rerun3-preqa.json)). 원문4로그의97checkedcase와 정제batch 전수·고유97/25spec/기존71누락0,8전후manifest1130map·현재a98f전체map·유일Python1차이,Python37/Unit11fresh와정적5종 원문sha/exit0,TEST_PLAN전체blob를 대조했다. helper 검토P1/P2해소와6caller전체·736독립·원래보안/저장/focus단언,문서구조/영향mapping·게시범위 의미정합을 확인했다.

사전 검토 PASS는 게시 준비 범위다. ca3의 실제97과 main통합후 입력한정재사용·fresh검사,Next생성차이로fullCheckoutfalse,자동fastBLOCKED115/UNKNOWN31/step0,공식새HeadRequired3/Trusted/Owner NOT TESTED를 구분했다. AC4안전편집 미구현/READONLY·Owner예외승인없음·HIGH/OWNER_MANAGED/qa_required=true·manager_decision=NOT TESTED/MERGE_READY=BLOCKED·release_authorized=false는 유지한다.

이후 판정stamp/문서만 보완했고 source 추가변경은 없다. clean최종tree와 APIcandidate전체tree/두부모[473b,4ce]를 확인하고 기존PR본문1회→Head/mainlease재조회→nonforce ref1회→새testmerge/리뷰thread·충돌 및 FullCI등록/시작까지만 확인한다. 정확 게시Head/RunID/attempt/base/testmerge·metadata전용사건은 Issue STATUS로 연결하며 문서 자기SHA순환을 만들기 위해 추가push하지 않는다. CI완료모니터링/병합/Main/GHCR/Release/Issue종료/브랜치정리는 제외한다.

## F785-007 — Full #3216.1 / #529 Resource Excel 메타데이터 TEST_CONTRACT (2026-10-24 KST)

- **귀속:** Issue #785/PR #787, [Full Run 40051075577 attempt1](https://github.com/planner77/masterGantt/actions/runs/40051075577), event=pull_request, workflow=.github/workflows/ci.yml, head=7af290c87d6317bc9ad1391b1a15f3e63b9fc01a, base/main=4ce403a1e410ca599a780446f39513e1f1158326, immutable test merge=c7a5f963efc2a2d9549e0d3c174bc3d2bd637e16 (parents base/head; tree 393765fb92b77e52bb0b981276ae7f21b884af2d). 역사7Full·metadata/취소 및 원래 FAIL 결론을 소급 수정하지 않는다.
- **직접 실패:** [Chromium Shard7 Job120744149110](https://github.com/planner77/masterGantt/actions/runs/40051075577/job/120744149110), 2026-10-24T02:05:30Z, tests/e2e/resource-excel-export-ui.spec.ts:109의 #529 실제 readonly Resource/exact XLSX case. assertReportWorkbook line59에서 metadata.get(Actual target context)는 undefined이고 JSON.parse(undefined)는 SyntaxError. 실제 Export HTTP/ZIP 다운로드·메타데이터 추출 이후 오래된 키를 찾은 Assertion 실패. Shard7: 73 PASS/1 FAIL/4 NOT RUN; Shard6/8 SUCCESS, 다른5 CANCELLED(Fail-Fast). 취소5개 Job 로그에서 다른 기록된 직접 테스트 실패0, 미실행은 NOT TESTED.
- **파생:** Policy(운영 npm audit 포함)/TypeScript/ESLint/Vitest/PR Build/Docker 구현 및 Required Quality/Docker SUCCESS. Required E2E aggregate와 Automated QA Final은 Shard7로 인한 파생 FAILURE. GitCommitInfo git fetch 3000ms timeout은 직접 ASSERT 오류가 아니다.
- **원인:** TEST_CONTRACT, F785-001 KPI mock, F785-002 Zod, F785-003~004 설비 공유 ID/이름, F785-005 물류초안, F785-006 설비 보고서 응답 오귀속과 별도 간접 소비자. 생산자는 이미 Resource Report에 Actual report context 및 publicEvidenceJson(bundle.sourceContext)를 기록하고 기존 Actual target context 사용자 축은 폐기했다. #529 E2E만 이전 문자열을 기대. 실제 원본/수량/Assignment 손실 증거는 없으므로 writer를 구 Target 형식으로 되돌리지 않는다. 기존 local Chromium97/25spec에는 #529 case가 없으므로 이전 PASS를 새 실패에 소급하지 않는다.
- **보완 및 음성 보호:** 기존 #529 E2E 한 시나리오의 재사용 helper에서 현재 정확 metadata 키 존재/문자열 타입, 이전 키 부재, JSON 파싱 후 원래 full canonical resourceScopeContext 값 동등성을 모두 검사. current·exactAssignments·Project 전체 XLSX 3회 동일 helper 경유. 기존 tests/server/projects/resource-excel-export.test.ts의 실제 SQLite/HTTP/OOXML testcase를 EXTEND해 빠른 공개 행명 양성·구 행명 음성 검증. Original source provenance (not current totals)·그 외 원래 raw 수치·Assignment·snapshot·Gantt viewport/focus·limit·보안 단언 보존. 새 E2E spec 0, 테스트 skip/retry/timeout/CI/8shard 변경0.
- **TEST_LIFECYCLE_REVIEW / AC:** E2E #529 및 해당 기존 Unit EXTEND. 이전 모든 실패 파일·Project/Resource Plan/Excel/ZIP·SQLite/HTTP/Identity/401·stale 및 기간별 수치 검증 KEEP_UNIQUE. AC2 공개 Target 비노출, AC5 T0/A/R/공수, AC7 OOXML Report, AC8 readonly·실제 Gantt/Focus, AC9 사전 검색 후 기존테스트 확장, AC10 docs/EXCEL_EXPORT.md·원장·Work Packet 동기화. 삭제·중복 통합·강제 test skip 없음.
- **검증 한계:** GitHub source/원본 Job/Writer/기존 소비자 교차 확인과 변경 스니펫 TypeScript 구문 점검만 수행. 컨테이너 GitHub DNS 미해결로 npm/실제 Playwright/SQLite/Docker 로컬 실행 NOT TESTED. 새로운 정확 Head에서 Quality/E2E8/Docker/Trusted QA 결과를 검증해야 하며 CI 시작은 PASS가 아님.
- **리뷰·승인:** 현재 PR 미해결 review threads0, main/base 및 mergeable=true는 수정 전·후 별도 재확인. risk HIGH, OWNER_MANAGED, manager_decision=NOT TESTED, MERGE_READY=BLOCKED, release_required=true, release_authorized=false. AC4 레거시 관계 자체 안전 편집 NOT IMPLEMENTED/READONLY/Owner 예외 없음, 운영 DB/외부 소비자/off-host backup·restore/Windows Excel 최종수동 UX NOT TESTED. 요청 범위는 보완·원장/문서·새 PR Full CI 시작까지이며 모니터링·병합/Main/GHCR/Release/Finalizer/Issue 종료 불포함.

## F785-008 — 병합 후 Main CI #3219.1 Trace 즉시 FAIL, 동일-Issue 교정 PR (2026-10-24 KST)

- **원본/불변:** Issue #785 PR #787의 정상 Full PR CI #3217.1 (Run40054221748, Head b057adab66e64153122368063988939836033c60, base4ce403a1e410ca599a780446f39513e1f1158326, testmerge13621f707fc827f26553ce8a8f8f97b6ca173083), Trusted QA Run40056100919 PASS, review0. 사용자 명시 병합/정식 GHCR/이슈 종료 지시와 Owner version0.131.0 marker [#6379091454](https://github.com/planner77/masterGantt/issues/785#issuecomment-6379091454)를 확인하고 GitHub Merge API 실행. 최초 불변 merge SHA `96d97d12d0502bdc725daedae7dfd9be0090c4d3`, 부모[4ce403a1,b057adab], Tree525572fa9178889111eb48a6de37142c42cdbab3, PR #787 merged.
- **직접 실패:** [Main CI #3219.1 / Run40056918163](https://github.com/planner77/masterGantt/actions/runs/40056918163), push main, attempt1, HEAD96d97d12..., changes Job120761811086 'CI 실행 추적 메타데이터 검증' (scripts/verify-ci-run-trace.py) 2026-10-24T03:06:12Z 즉시 FAIL. 메시지 'Issue # 접두어는 정확한 단일 행 표준 Merge 제목만 허용합니다'. GitHub merge title 'Issue #785 · PR #787 · 비파괴 Logistics Target 도메인 전환'은 짧은 한국어 표준 제목이지만 **Manager가 commit_message에 여러 줄의 Refs 및 검증 메모를 전달**하여 전체 commit.message가 여러 줄이 됨. scripts/main_ci_run_name.py parse_merge_title는 전체 메시지가 제목 한 줄일 때만 PASS. `main_ci_run_name.py --as-merge-payload`에서 commit_message:''를 사전생성해야 한다는 AGENTS/CI_CD/선례 #729를 이 호출에서 지키지 않은 Manager 운영 실수. 제품/브라우저/러너 결함 아니다.
- **파생/미실행:** Quality/E2E8/Docker aggregate=FAIL은 changes 차단의 파생이며 실제 TypeScript/Lint/Vitest/Build/E2E8/Docker 구현 Job들은 SKIPPED/NOT TESTED. Main `publish-commit-image` SKIPPED, verified ci-96d... GHCR candidate 없음, v0.131.0 annotated tag·Release·정식 GHCR·Issue FINAL 없음. 당시 Generic Finalizer는 failed Main을 PASS로 전용할 수 없다. 원본 Run/merge commit을 force-move/amend/rerun-success로 위장하지 않는다.
- **복구 판단:** 정확 Main SHA recovery #639는 'original push Main CI exists'에 의해 불가. #729의 같은 현상 회복 방식을 적용하여 **같은 Issue #785의 후속 비문서 테스트 교정 PR**을 원본 실패 main 바로 위에서 생성. package/lock version0.131.0 유지. `tests/server/projects/resource-excel-export.test.ts` 기존 실제 SQLite/HTTP/OOXML 증거에 canonical Resource context(JSON XML unescape→원본 context equality, 폐기 Target 키0)를 추가해 F785-007의 #529 Excel 시험 계약을 보강한다. P1/P2 제품·보안·스케줄·SVAR/API 무변경. F785-001~007과 Main #3219 기록은 불변 보존.
- **TEST_LIFECYCLE_REVIEW / AC:** 기존 Resource Excel Unit 내 동일 실제 HTTP/OOXML 검사 **EXTEND**, #529 실제 Chromium 다운로드/current/exact/project, 기존 Security/SQLite/Task/Resource/Plan 보호는 KEEP_UNIQUE. 새 test spec 파일0, 제거/skip/timeout/CI 우회0. docs/TEST_PLAN.md의 영향표를 기존 전체 1MB 원본 유지·additive 갱신하고 Work Packet 이관. AC2/5/7/8/9/10. 제품 속성·테스트 설정·CI 게이트 완화 금지.
- **Finalizer 승계 사전조건:** 실패한 PR #787 merge는 0.130.2→0.131.0. 후속 PR은 부모가 해당 merge인 같은 Issue·non-docs·version0.131.0→0.131.0로 유지하고 전역 8Shard Full PR CI/Trusted/Owner 승인 및 올바른 single-line merge API (commit_title: Issue #785 · PR #<new> · 한글30자 이하, commit_message:'', head SHA lease)로 새 Main push 성공을 검증한다. Generic Finalizer가 첫 실패의 미발행 v0.131.0 의무를 인증된 **연속 동일-Issue non-docs correction**에 한해서만 상속, exact ci-digest/annotated tag/Release/Owner marker/cleanup 후 #785 종료. 사이에 다른 Issue merge·docs-only·version 변경·신규 Main 실패 시 BLOCKED; 기존 v0.131.0 tag 이동/강제 GHCR push 금지.
- **상태:** 원본 Owner 릴리스 승인 version0.131.0은 본문대로 보존하되 corrective PR의 정확 HEAD/Full CI/Trusted·HIGH ACCEPT는 신규 검증 전 NOT TESTED. 현재 #785 OPEN, #792는 안전한 legacy edit·운영 이관 후속. 사용자 요청의 CI 완료 모니터링 불필요를 존중하며 새 PR CI 등록까지만 우선 실행, 새 Main·GHCR·Issue 종료 성공은 결과 전 주장하지 않는다.
