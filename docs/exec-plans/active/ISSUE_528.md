# Issue #528 — Resource·Milestone·일정 간 drill-down

## Issue Work Packet

- Issue: [#528](https://github.com/planner77/masterGantt/issues/528), Epic [#522](https://github.com/planner77/masterGantt/issues/522).
- Lifecycle: IMPLEMENTATION → DOCUMENTATION_SYNC → PRE_QA → 원격 PR / CI 시작. CI 결과 모니터링·병합·main/GHCR·tag·cleanup·Issue 종료는 이번 요청 범위 밖이다.
- 착수 최신 main: `370b809447cc10d7afde1ae5a34685d220c3433b`. 직접 선행 branch `feat/issue-527-resource-plan`, exact head `a681089dcd374f56e1de4f56a8ee2bf5fe567e87`를 기반으로 stacked branch `feat/issue-528-resource-schedule-drill`를 생성한다. PR base는 `feat/issue-527-resource-plan`다.
- Version: `0.100.0` → MINOR `0.101.0`. 하위 호환 신규 기능이며 package/lockfile/CHANGELOG를 동기화한다.
- `release_required=true`, `release_authorized=false`; 정식 게시 승인은 없고 PR 단계까지만 요청되었다.
- 목표·AC: Issue 원문 전체와 [Resource KPI 계약](../../RESOURCE_KPI_DASHBOARD.md)을 따른다. 선행 구현과 동일 raw 계산·scope·distinct ID·snapshot/null 의미를 유지한다.
- Non-scope: WBS KPI·Milestone 전체 재설계·새 권한·자동 일정조정·URL 대량 ID.
- #495/#518 및 공유 Workspace 변경은 착수 시 최신 main/관련 PR을 재확인하고 현재 구현을 되돌리지 않는다.

## 소유권과 검증

- 주 담당: frontend. 소유 파일: Workspace/Gantt scope adapter와 Resource Dashboard drill model/UI/tests. 순차 실행하고 같은 파일을 동시에 수정하지 않는다.
- Manager: version/package/CHANGELOG/이 계획/active PLAN·Issue 댓글. ui_ux: read-only 설계/비교, qa_docs: DOCUMENTATION_SYNC 후 독립 사전 QA, infra: 원격 commit/tree 게시·PR·CI 등록.
- Issue 댓글 writer는 Manager; Sub-Agent 허용 유형 NONE. 재귀 Agent 생성·merge/release/close 금지.
- Local Fast Feedback: 변경 관련 Domain/SQLite/HTTP/UI tests, typecheck·changed-file lint. UI는 실제 Chromium geometry 390/768/1024/1440/1920px·keyboard/focus/Gantt instance 보존을 확인한다.
- Required docs: RESOURCE_KPI_DASHBOARD/PROJECT_UX/MILESTONE_STAGE_GATES/REQUIREMENTS/TEST_PLAN, active PLAN/이 계획/CHANGELOG. DB schema·Calendar 원장·AGENTS/DESIGN 공통 원칙 불변이면 항목별 N/A를 실제 diff와 함께 기록한다. API/public query 변경은 API/SECURITY를 동기화한다.
- 공식 quality/e2e/docker·최종 QA·Manager ACCEPT는 NOT TESTED이며 CI 등록 확인 뒤 다음 Issue로 진행한다.
- Environment-specific Windows Excel/실기기·운영 배포/최종 수동 UX는 이번 PASS로 주장하지 않는다.

## 실행 기록

구현·관련 Local Fast Feedback·DOCUMENTATION_SYNC·독립 사전 QA 진행 중이다. 원격 게시는 사전 검토 이후이며 source tree 동일성·실제 remote head를 확인한다.

## 확정 설계·단계 소유권

#527 PR535/head `a681089dcd374f56e1de4f56a8ee2bf5fe567e87`, CI37684790075/2104.1은등록만확인했고결과를조회하지않았다. 최신main `370b809447cc10d7afde1ae5a34685d220c3433b`는변동없고 #523 외부fix37a16은527parent에포함된다. 528IssueOPEN/댓글0/기존branchPR없음, #495/#518OPEN/현재navigation미구현을재확인했다. 이작업은현재nested Workspace를보존하고새문구에Milestone을사용한다. 설치Next/@next/env16.3.8·SVARCore2.7.3을확인했고node_modules를물리복사했다. 원root/527tree는수정하지않는다.

- backend: 공용drill DTO 및 resource-dashboard/milestone-dashboard DTO, dashboard query/service/handlers, 공용rawsnapshot reader/fingerprint, legacyMilestone service의additivecontext, 신규resource-dashboard/query·scope routes, inventory와관련Unit/SQLite/nativeAPI E2E. 공용DTO/query를먼저typecheck하고freeze반환한다. backendsource와frontendsource는분리하고DTOshape변경은Manager조정이다. backend문서는API/ARCHITECTURE/SECURITY/RESOURCE_KPI_DASHBOARD/REQUIREMENTS/TEST_PLAN, 완료후공유3문서를frontend에반환한다.
- frontend: DTOfreeze후단독으로Workspace/Gantt scopeadapter/resources Dashboard/legacyM/기존Editor callback/model/transport/CSS와관련Unit/mock/nativeUI E2E. backend Domain/API/DTO/version에쓰지않는다. 문서는PROJECT_UX/MILESTONE_STAGE_GATES/RESOURCE_KPI_DASHBOARD/REQUIREMENTS/TEST_PLAN이며backend소유권반환후갱신한다. sharednativewebserver/SQLite는backendAPI검증후frontendbrowser로직렬인계한다.
- ui_ux: read-only 설계와최종실제로그/geometry/PNG비교. qa_docs: DOCSYNC이후독립AC/code/test/docs/hash검토와관련Unit실행. infra: branch와원격exacttree게시/PR/CI등록만. Manager: package/lock/version0.101.0/CHANGELOG/이Packet/PLAN/Issue댓글. 모든Sub-Agent댓글허용NONE/재귀Agent금지.

## Scope·API 계약

ResourceDataContext는Projectpublicid/revision·Catalog/Calendarrevision·dataSnapshotId이며동일readtransaction의원시Task/Link/Membership/Assignment/연결Catalog/Calendar를동일정렬·동일내용으로fingerprint한다. ResourceDrillSourceContext는이를기반으로실제출발range/asOfDate/mdPerMm/mdPerMmSource/mdPerMmProvided/sourceProjection을보존한다. targetnormalizedfilters/표시projection은출발조건과구별해echo한다. Schedule bootstrap은currentcanonicalProjectrevision을확인하고동시변경은409로차단한다.

GET `/resource-dashboard/scope`는 `view=context|dashboard|plan`을구별한다. context는원장budget내원본context만반환하고기간계산을하지않는다. dashboard/plan은기존selector/metric/assignmentScope 및actual527period/date/demandScope를검증해페이지와무관한전체고유일반TaskIDs≤5000/개인AssignmentIDs≤8000/count/context를반환한다. ancestorSummary는분모에포함하지않고scope전체ID를현재page50IDs로대체하지않는다.

POST `/resource-dashboard/query`는공개읽기지만exactOrigin·실제UTF-8stream1MiB `readBoundedJson`·contenttype/encoding검증이필수다. 편집session·DBmutation·서버token/ledger를추가하지않는다. sourceContext+scope(scheduleSelection노드≤5000/summarySubtree root/exactAssignments≤8000)+filters+projection(report/details/groupChildren/planDaily/planDayResources/planDayAssignments/scope)를받는다. 모든후속projection에동일descriptor를POST재전송하고GETfallback으로scope를버리지않는다. snapshot은data+normalizedexactscope+normfilters/range/asOf/mdpolicy를포함하고mode/page/granularity는제외한다. private/no-store/nosniff, stale409우선/foreign400/semanticbudget422/transport413/Origin403을유지한다.

selected A는허용일반Task/정확Assignment교집합이며T0는허용일반Task집합을적용한뒤R/role조건전rawAssignment진단을유지한다. exactAssignmentsource에서allowedTask는고유실제A에서유도해다른Task/개인을선택으로확대하지않는다. 빈정확집합은empty이며Allfallback이아니다. #526 reference/excluded는source제한을유지하고Milestone필터만제거한다. #527 CapacityR/history/fullProjectA는sourceTask/A로축소하지않으며Project전체참고는sameR/period의명시demandScope=project다. Mselected contribution과parentResource전체원인을구별한다. fullReady/Blocked는fullcanonicalmembership을유지한다.

legacyMilestone report는같은transaction의additive resourceScopeContext를제공한다. 추가sourcecontext budget초과로기존report전체를422로바꾸지않고null+resourceScopeUnavailableReason안전enum을반환해해당crossdrill만차단한다. 현재bootstrap으로과거Mreportfresh를위장하지않는다. 실제invalid/366초과기간query는임의clip하지않는다. DB/domain계산·권한·revisionmutation은불변이다.

## Interaction·검증 계약

toolbar아래한곳에임시scope strip: 출발보기·고유TaskN/AssignmentA/조상contextC·실제기간/선택기여또는Project전체부하근거와원래보기/범위해제. Resource→일정은서버전체scope IDs, Schedule→Resource는선택Task/Summary일반descendants의모든개인배정을명시하고기존개인조건으로담당을조용히숨기지않는다. WBS/filter충돌시숨겨질n과N별도범위를확인하거나취소하며silentAND/조건삭제를하지않는다.

in-memory returnframe LIFO최대8개는sourceview/조건/trigger/viewport와destination이전조건을모두보존한다. 원래보기는직전출발frame으로pop복구, 범위해제는현재destination에남아drill전조건복원/해당frame해제다. 상한8시새이동차단및복귀/해제안내, 오래된origin을조용히버리지않는다. 정상mounted Dashboard/Gantt상태·단위/기간/tree/행기간page/scroll/selection/scale/columns/fullscreen/초안을기존invalidation규칙내보존한다.

기존Editor권한/dirty/editorOpening/session/relation/settings/delete/copy/import guard를조회전및asynccommit직전에재검사한다. abortgeneration/단일pending으로late응답·취소409·중복command를차단한다. focus는visible destinationheading, 복귀validorigintrigger→tabfallback, 해제currentheading, confirm취소/오류origintrigger다. readonly조회이동은허용하되편집권한을UI상태로판단하지않는다. 기존물류/Editor drill caller는호환wrapper로보존한다.

필수검증: >50전체N/ancestor분리·공동TaskexactA·Summary/multiRoot/동명Task/empty·outsideWBSfilterconfirm·M밖Project과투입원인·return/clear/LIFO8상한·stale/deleted/late409·dirty/pending/readonly/denied·실제nativeSQLite/Nextsource일관성/no-cookie/noMutation·5폭390/768/1024/1440/1920geometry/keyboard/focus/Ganttinstance실DOMscroll. 공식SVARgroupingguide는PRO전용이므로Core기존ancestorfilteradapter만사용한다. 공식demoURL확인과실제조작NOT TESTED를구별한다.

Required docs에API/SECURITY/ARCHITECTURE를포함한다. DB_SCHEMA/migration/SCHEDULING_ENGINE(알고리즘불변)/DESIGN/AGENTS/CI_CD/REMOTE_VALIDATION/workflow/Docker/ImportExcel은실제diff불변일때항목별N/A를기록한다. 이전526/527PASS는변경source면stale이며관련변경검증으로대체한다. 공식quality/e2e/docker·QA_FINAL/ManagerACCEPT·main/GHCR·release·실환경/최종수동UX는NOT TESTED다.

### Interface 전 독립 UI model 작업

backend DTO/query freeze 전에 frontend는 공용 DTO를 import하지 않는 generic return-frame/guard/scope 충돌 model과 관련 features Unit 파일만 구현할 수 있다. Workspace/transport/Resource/M/Gantt UI integration은 DTO freeze 이후다. 이 model은LIFO8/emptyexact/조건복원·충돌판정을검증하며 domainAPI 계산을복제하지않는다. backend공용파일/문서와분리해동시쓰기를하지않는다.

### 범위 해제의 nested history 결정

범위해제는 명시 사용자 명령으로 임시 이동 범위 전체를 해제하고 현재 destination에 남는다. 같은 destination으로 왕복해 latest.destinationBefore에 이전 임시 scope가 남을 수 있으므로, 이 return chain의 해당 destination 최초 진입 전 baseline(earliest matching frame.destinationBefore)을 복원한 뒤 frame chain을 전부 폐기한다. 원래보기는 latest1만 pop하고 직전 source를 복원한다. A→B→A→B의 해제는 B의 첫drill전조건, A→B→A의 해제는 A의 최초destination진입전조건을 복구한다. 상한8에 의한 자동 origin 폐기는 금지이며 이 명시 해제와 구별한다.

### DTO/query 동결 및 분리 UI 구현

공유4파일동결: resource-drill DTO SHA256 `223e387c2906d1ca82ad219ee76bc684942fcc52589163e306cd868bcabcfaa1`, Dashboard DTO `6b0bac46e63d4aef46d6e7f1f70febe050917b0523f0754eceb9e6fa135055ca`, Milestone DTO `2c35c4339fea557cf51c8ecf61abf161e340c65c29143a58e24f0a888cf64855`, resource-drill-query-core `f6fe9ab594b06c663e147ec173f6a146853d975e66b1dddbbdf77fd99724aac3`. typecheck9.17s PASS/첫FAIL없음. 이파일들은추가쓰기금지이며변경필요시Manager가후행consumer조정한다.

frontend독립navigationmodel 신규2파일/LIFO8·ninthblock·return/clearABAB/ABA·empty/distinct/ancestor/hidden/guard Unit1파일6개PASS121ms, typecheck/lint0warnings/diffPASS. 아직UIbrowser증거는아니다. DTO동결후frontend전체UI/transport통합을파일소유권분리해승인했다. backendservice/helper/routes/tests/docs는backend가계속소유하며공유문서는후행인계한다.

### 조기 독립 검토와 source Schedule 환산 결정

qa_docs WIP read-only 검토는공유4hash불변/PACKETLIFO일치·Origin/stream/legacy경계를정적으로확인했으며독립HTTP/최종PRE_QA는아니다. GETscope 삭제filterstale409우선, freshforeignscope가POST세부projectioncatch에서409로치환되는경로, ScopeDto에data.filters가없을때echo.targetFilters자기비교를개별owner보완검증으로인계했다. source/data stale409와fresh foreign400을projection전체에서일관되게검증한다.

Schedule bootstrap은ResourceDataContext만반환하며일정출발화면에M/D환산계산은없다. 따라서sourceProjection=schedule의명시환산미설정은mdPerMm=null/mdPerMmSource=query/mdPerMmProvided=true로구성하고targetfilters의실환경/사용자환산값과별도로echo/표시한다. 환경값을추정해unset/providedfalse를보내지않는다. legacyM/report의실제출발환산정책은정확히보존하고environment값변경시stale를검사한다. 출발min/max/today를임의clip하지않으며실제targetperiod366초과는명시오류다.

### Backend focused 검증 진행

신규SQLite/HTTP18tests PASS(2026-10-08 06:04:11 KST/1.75s). freshforeigndescriptor의8projection은400, stale source의8projection은409이며기존catch밖scopeID검증을추가했다. GETscope foreign/deletedfilter stale409도확인했다. Assignment원장만수정하고Projectrevision을유지해도datafingerprintstale409, originalsource/targetecho·legacyMcontextbudgetnull·1MiBexact/+1·원장5000/8000·기간366/367·readonly불변을검증했다. 초기신규16suite의fixture2FAIL은Plan grand→totals와DBCHECK가금지한allocation0→50으로보완했고원본로그를보존한다. 신규실제Next API검증은이후backend가먼저실행하며frontendUIbrowser는runtime반환뒤다.

### 실제 Next API 검증 및 runtime 인계

신규 `resource-drill-api.spec.ts` nativeSQLite/Next16.3.8/Chromium1case 첫실행PASS(15.8s/전체27.6s). bootstrap·M/report동일fingerprint·exactA·Milestone밖Project과투입scope·Origin403/media415/body413/unsupported405/protected401·no-cookie/revision불변·재시작동일/stalesource409를확인했다. backend는runtime을종료하고next-env/tsconfig를HEADbyte로복원해frontendbrowser에인계했다. 마지막신규test타입오류와unusedlint정리는backend소유에서진행하며query의unusedtypeimport제거만공유파일REWORK를Manager가승인했다(exportshape/runtime불변/최종hash추후교체). frontend작성중typecheck오류는frontend에서수정하며타인파일에쓰지않는다.

ResourceUIcontext cache는8returnframes의source와현재destination을모두보존해야한다. 필요시최대9livecontexts또는프레임UIprefsnapshot으로bounded하게구현하고cache8때문에최초origin을조용히버리지않는다. 9번째이동차단과현재contextcache수는다른예산이다.

### Backend 최종 동결·독립 부분 검토

backend20파일manifest `/tmp/issue-528-backend-freeze.json`, source/test14+전용API/ARCHITECTURE/SECURITY3문서는동결했고shared3문서작성권을frontend에반환했다. 관련6파일159Unit(신규19/기존140) PASS(2026-10-08 06:10:00 KST/2.20s), owned14 lint0error/0warning·전체typecheck·Markdown147·diffPASS. queryunusedtypeimport청소후최종SHA256 `114d3a431786c46b95027fcb8d71fd92bedde45f686d8c26277a893bc1c4b64f`, DTO3hash는불변이다. 2700A/40R/5G/2M/365일/985500Assignment-days in-processSQLite+POSThandler217.506397ms/1918601bytes, 주별matrix422무절삭이다.

qa_docs 독립6파일159Unit PASS(06:12:43 KST/2.43s/chunk01ab9a), source14+전용docs3 drift0. 별도GEThandler+nativeSQLite rawTask5000→200/64hash,5001→422REPORT_LIMIT_EXCEEDED/snapshot.tasks2조건PASS(06:14:40/chunkc60bdd), 각no-store/nosniff/no-cookie/원장불변확인. 독립handlerbenchmark241.201421ms/1918601bytes는owner측정과다른실행이다.

NativeAPI첫PASS당시별도service source manifest/patch는NOT RECORDED이며사후hash를작성하지않았다. 후속query descriptor조회배열→Map/freshforeigntargetfilter선검증/source409우선 유지와testtype·unusedimport정리후최종source에서NativeAPI는재실행하지않았다. 유효ID/필터정상path·Origin/body/echo/restart기존PASS를최종159Unit과함께Local검증으로재사용하는것이적절하다는독립경로검토를확인했다. 최종source의후행nativeUI는별도증거이며공식e2e는NOT TESTED다. 최종source의단일NativeAPI재실행PASS라고표시하지않는다.

### UI 통합 REWORK 기록

초기UI5파일25Unit/typecheckPASS 후nativeUI1은상대locator에전체rootselector를중첩한fixture오류로멈췄고finally close가원assertion을180s timeout으로가렸다. 최초trace/log를보존하고relativehasText/defaultactiontimeout15s로보완했으며testtimeout을늘리지않았다. nativeUI2는ResourceTask이름으로연기존Editor가hidden Schedule panel내부에남는실제제품오류를발견했다. 기존Editorcomponent/권한/초안계약을유지한채Workspace공통modal위치로이동해다시검증한다.

같은descriptor신규방문과return복귀의사용자조건이섞이지않도록cachekey를navigationvisitID로분리한다. ui_uxWIP검토의cache무한append위험은referencedsource/destinationBefore/currentkeys pin/prune≤9, confirm대기뒤sameProjectrevision일지라도Catalog/Calendar/Assignment fingerprint재검증, 모든Dialogcancel(Escape/overlay포함)공통triggerfocus/abort, manualpeer전환시strip의actualdestination/clear대상일치검증으로인계했다. WIPstatic검토와실제browser실패를구별하며최종UI/DOCSYNC/PRE_QA는후행이다.

### 확인 재검증과 Milestone 직접 표시

확인 Dialog 대기 후 commit 직전에는 GET context의 원장 fingerprint뿐 아니라 원래 sourceContext를 그대로 보내는 POST query의 명시 빈 scheduleSelection으로 출발 환산 정책·selector·Plan 기간을 검증한다. 검증용 빈 응답을 실제 이동 대상이나 새로운 출발 조건으로 사용하지 않는다. Calendar/Catalog/Assignment의 같은 Project revision 변경과 환경 환산값 변경도 stale로 차단한다. 일정 출발 asOfDate는 Project Calendar timezone의 오늘을 사용한다.

Milestone 자체 일정 이동은 일반 Task KPI와 구별하는 직접 Milestone 노드 표시다. 원래 Milestone report sourceContext 검증 후 현재 canonical Milestone ID를 표시 대상으로 보존하며 ResourceScopeDto.taskIds에 Milestone을 넣지 않는다. 일반 Task 0·Milestone 1·조상 문맥 수를 구별하고 빈 범위를 전체 일정으로 대체하지 않는다. sourceContext가 null인 report에서는 Resource·일정 cross command를 이유와 함께 비활성화한다.

UI native3은 Schedule→Resource·공통 Editor·양방향 복귀 1case PASS(7.9s/전체18.6s), native4는 확장 1case PASS(12.2s/전체23.0s)이며 5폭 문서 overflow0·버튼 containment, 8단계 왕복/9번째 차단, Gantt 동일 DOM 인스턴스·최종 cache1을 확인했다. 이 실행 뒤 Milestone 직접 노드 표시와 원본 selector/period 대조를 추가했으므로 영향 검증은 후행 증거로 구별한다. 초기 native1/2 FAIL 기록은 삭제하지 않는다. 390px 캡처는 scope strip/필터 영역이며 KPI 본문 전체 캡처로 주장하지 않는다.

### 후행 실제 UI 및 Resource 조건 충돌 보완

Native9의 실제 UI 1case PASS(16.7s)는 Milestone-only 직접 표시·일반 Task 0 분리, 8단계 복귀, 같은 Project revision의 Catalog 변경 확인 재검증, Escape focus를 포함한다. 같은 묶음의 mock2개는 scope query 메타키를 기존 fixture parser로 넘긴 오류와 기존 member externalId 변경으로 FAIL했으며 전체 묶음32.6s를 3case PASS로 표시하지 않는다. M ID를 scheduleSelection에 넣어 INVALID_SELECTION400이 발생한 native8은 원래 M context의 빈 preflight 검증과 UI 직접 표시 분리로 보완했다.

Schedule→Resource에서도 기존 destination Resource 조건이 새 고유 Task 일부를 숨기는 경우를 전체 scope와 비교하고 승인/취소 경로로 처리한다. 기존 WBS 충돌과 동일하게 출발 N·숨겨질 n을 구별하며 기존 조건을 조용히 제거하지 않는다. source 원장·DTO·저장은 변경하지 않으며 이 영향에 대한 후행 mock2/native1 검증 후 최종 문서·manifest를 동결한다.

### 최종 관련 UI 검증과 Manager 문서 동기화

최종 관련 브라우저 실행 `frontend528-browser11.log`는 mock2/native UI1의 고유3case PASS(전체31.9s)다. native API 최초1case 재사용과 구별하며 반복 native1case 실행을 고유 수에 더하지 않는다. UI 관련5파일28Unit PASS(690ms) 및 통합 typecheck PASS를 확인했다. 큰 Workspace/Gantt 파일의 기능과 무관한 전체 포맷 변경은 동일 AST의 기존 함수/return을 원래 스타일로 복원해 축소했다. 포맷 정리 후 최소 정적 검증과 UI 문서5개 최종 동기화·source/artifact manifest는 frontend가 인계한다.

Manager의 package/root lockfile/CHANGELOG version은0.101.0으로 일치하며 `npm run version:check` PASS다. Required docs는API/ARCHITECTURE/SECURITY/RESOURCE_KPI_DASHBOARD/PROJECT_UX/MILESTONE_STAGE_GATES/REQUIREMENTS/TEST_PLAN 및PLAN/이Packet/CHANGELOG다. DB_SCHEMA/migration은 저장 schema 불변, SCHEDULING_ENGINE/Calendar 원장·KPI/Plan pure 계산은 알고리즘 불변, DESIGN/AGENTS는 공통 시각 언어·지침 불변, CI_CD/REMOTE_VALIDATION/workflow/Docker는 검증·배포 계약 불변, IMPORT_SCHEMA/VBA/Excel Export는 입출력 계약 불변으로 각각N/A다. 실제 코드 diff와 독립 PRE_QA에서 이를 재확인한다.

공식 quality/e2e/docker 및 QA_FINAL/Manager ACCEPT는NOT TESTED다. 최종 source의 별도 API browser 재실행은NOT TESTED지만 최초 native API 증거와 최종 독립159Unit 경로 비교를 Local 근거로 재사용하고, 현재 native UI의 긍정 API 경로 증거를 구별한다. 독립 ui_ux/qa_docs는 UI 로그·PNG·geometry를 직접 비교하며 독립 browser를 재실행했다는 주장은 하지 않는다. 현재 staged exact tree의 독립 PRE_QA는 후행 gate다.

### SOURCE/DOCUMENTATION_FREEZE → QA_READY

Frontend32파일(소스17·신규테스트4·문서5·증거6) manifest `/tmp/issue-528-frontend-freeze.json`의 hash drift0과 Backend source14·전용 문서3 동결을 확인한 뒤 DOCUMENTATION_SYNC를 완료한다. 최종 Markdown148 links/owned lint0error·baseline 동일4hook warning/typecheck/diff PASS, Next 생성 설정은 HEAD byte로 복원했다. required docs의 실제 변경과 N/A 근거는 위 문서 목록 및 frontend evidence README에서 추적한다.

Browser11 이후 Membership Editor locate 원본 context bridge와 방문별 report pin/prune를 보완하고 기존 함수/return의 동등 AST 포맷을 복원했다. 레이아웃 불변으로 PNG/geometry를 Local 근거로 재사용하며, 해당 후행 source의 관련28Unit·typecheck와 독립 PRE_QA를 사용한다. Membership Editor locate의 실제 브라우저 조작은NOT TESTED다. 모든 교차 조합을 이번3case로 PASS라고 확대하지 않으며 [인수 기준별 근거와 미검증 범위](../../evidence/issue-528/README.md)를 따른다.

이후 source/test/docs 쓰기를 중단하고 Manager가 exact staged tree를 생성한다. ui_ux는 source/log/PNG/geometry의 설계 비교, qa_docs는 final tree의 문서 정합성·관련28Unit·typecheck/Markdown/version/diff 및 Backend159/경계 probe 재사용 근거를 독립 검토한다. PRE_QA 결과와 실제 remote head/PR/CI 등록은 Issue·PR에 기록하며 이 commit의 QA_READY가 공식 QA_FINAL/ACCEPT를 의미하지 않는다.

### 독립 UI/UX 검토 REWORK

Tree `06a72a74070b736a416ea63a0b66c2f2d72009c7`의 독립 UI5파일28Unit PASS(06:48:00 KST/744ms/chunk79347d), incremental=false typecheck PASS(9.08s/chunk038322), Markdown148/version0.101.0/diff PASS(chunk945ddf)는 보완 전 Local 증거이며 최종 PRE_QA PASS가 아니다. ui_ux는 새 scope strip 버튼의 실제18px hitbox/plain text와 cached hidden h2를 먼저 선택하는 destination focus를 REWORK로 판단했다.

기존 secondary-button의36/40px control·focus를 재사용하고 Resource visible heading을 선택하도록 frontend에 최소 보완을 승인했다. source/문서·5폭geometry/PNG/focus를 갱신한 뒤 새 manifest와 exact staged tree로 재검토한다. 이전 DOCUMENTATION_SYNC/최종 UI 검토는 이 영향에 대해 stale이며 Backend 불변 source159/경계 probe의 Local 재사용은 유지한다.

추가 REWORK: Milestone→일정의 원래 sourceContext를 검증한 뒤 manual frame에 오늘 lookup report context를 저장하여 출발 range/asOfDate/환산/sourceProjection 표시가 바뀌는 경로를 발견했다. 검증된 originalSource를 manual scope/return frame에 그대로 보존하고 lookup snapshot·target 조건은 구별하도록 승인했다. 원래 기간/명시 환산과 오늘이 다른 실제 fixture를 함께 검증한다. originalSource 없는 기존 물류 wrapper와 일반 Task/직접 Milestone 표시 분리 계약은 유지한다.

### REWORK3 재동결 → QA_READY

세 항목을 보완한 최종 native UI1case PASS(16.5s/전체27.4s, `frontend528-final-rework-native2.log`)다. mock2case의 browser11 PASS는 변경 불변 범위에서 재사용하며 고유3case를 최종 단일3case run으로 표현하지 않는다. 관련 변경 Unit2파일13case PASS(06:52:23 KST/244ms), typecheck·변경2파일 lint0warning·Markdown148·diff PASS다. 기존 불변3파일15case와 Backend159case는 분리 재사용하며 최종 독립 UI5파일28case를 새 tree에서 실행한다.

5폭 각각 strip 버튼2개의 실제 높이40px/native Tab outline solid3px/document overflow0을 확인했고 최초·8단계에서 visible Resource heading focus를 확인했다. Milestone 수동 asOfDate2026-10-02/range2026-10-01–2026-10-03/명시 query환산15를 원래 sourceContext로 strip/복귀 입력에 보존하고 return preflight로 검증했다. 같은 고유 native1case의 REWORK중 원본 M heading 문자열 locator 실패는 기록했으며 마지막16.5s PASS와 구별한다.

Frontend32파일을 새 manifest로 재동결하고 문서5/README/TEST_PLAN/PNG2/geometry를 갱신했다. next-env/tsconfig는 다시 HEAD byte로 복원했다. 새 exact staged tree를 생성해 ui_ux가3REWORK·최신 증거를 비교하고 qa_docs가 문서·관련 검증·source 불변/시점을 독립 확인한다. 이전 tree06a72의 최종 승인은 재사용하지 않는다. PRE_QA 결과·원격 인계는 Issue/PR에서 추적하고 quality/e2e/docker·QA_FINAL/Manager ACCEPT는 여전히NOT TESTED다.
