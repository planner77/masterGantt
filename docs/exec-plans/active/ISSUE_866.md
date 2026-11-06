## REWORK-C005 — Full #3526.1 상속 키 차단과 오류 출처 보완 (2026-11-06, 현재 단계)

사용자 요청의 종료점은 PR #879의 새 Full CI 시작 확인이다. 이후 모니터링·병합·Main/GHCR/Release/Finalizer·Issue 종료는 수행하지 않는다. 아래 C001~C004의 현재 단계·검증 표현은 해당 시점의 역사이며 이 절과 [누적 원장 C005](../../ISSUE_866_FAILURE_ANALYSIS.md)의 최종 기록을 우선한다.

- 시작 Head `8f1335cf96d1de8bb3dc767e72683bb8d0148a05`, main/base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, 원본 test-merge `e0e77f06469e978c53fb55cc103b7f0b8fa07175`. [Full #3526.1 / Run42100064413](https://github.com/planner77/masterGantt/actions/runs/42100064413), attempt1/pull_request/FINAL_FULL은 FAIL. Unit127500852712/step6의 기존 prototype-key 음성3건이 직접 실패이며 Required3/Fast/QA는 파생이다. 실제 Build/Chromium/Docker는 SKIPPED/NOT RUN이다.
- 역할·소유: Manager는 원장 전체 대조·재현·가설·영향 선정·동결·문서·통합, frontend는 공용 오류/WBS/국가 캘린더/Import·Project 생성 표시 및 지정 회귀, infra는 원격 출처·전체 이력/정제 증거와 Manager 인계 후 배치 게시, qa_docs는 읽기 전용 별도 기술검토. `issue_comment_writer=Manager`; Agent 검토는 독립 인간 QA/Owner ACCEPT가 아니다.
- 범위: `safeApiError` 승인 메시지와 WBS code 사전은 직접 소유한 키만 읽는다. 정확한 code/message 쌍·알려진 code 및 HTTP401/403/409/412 우선순위·화면별 fallback을 유지한다. 같은 Phase C 신규 Import 경고 사전과 기존 main의 Project 생성 오류 사전도 상속 키를 승인하지 않는다. 국가 캘린더는 실제 서버 문자열만 opaque로 보존하며 메시지 부재 시 앱 소유 fallback을 현재 언어로 번역한다. 국가/연도/field/row detail와 초안·401/412/CAS를 보존한다.
- 전체 CI28회(Full25+metadata3, 모두 attempt1)와 FAST25회(SKIPPED)를 대조했다. 누적 이전26회에 #3525.1 성공과 #3526.1 실패를 추가했다. #3525.1의 Head `e4b267348f27acf4d6059c202f62a867d93a4c69` 성공은 새 Head에 승계하지 않는다. [전체 이력](../../evidence/issue-866/ci3526-history.json), [원본 출처](../../evidence/issue-866/ci3526-source-proof.json), [실패 매트릭스](../../evidence/issue-866/ci3526-failure-matrix.json)를 따른다.

### C005 Gantt 표준 적용

`gantt_standard_version=GSC 1.0.0-candidate`. 읽은 문서 기준 commit은 `8f1335cf96d1de8bb3dc767e72683bb8d0148a05`이며 [GSC](../../GANTT_STATE_CONSISTENCY.md), [Conformance](../../GANTT_STATE_CONFORMANCE.md), [Adapter ADR](../../GANTT_ADAPTER_ADR.md), [Sync Trace](../../GANTT_SYNC_TRACE.md)를 적용한다. GSC-01/03/08/09/11/12에 따라 오류 표시와 WBS test oracle만 보완하며 canonical·Core·viewport·lease·쓰기 소유권은 변경하지 않는다. 설치 Core2.7.3/package/lock을 유지한다. 새 API/private write·예외 ADR은 N/A(기존 계약·단언 보존)다.

누적 SC-11/13의 Resource 원본/일정 왕복·focus/같은instance·조회0/쓰기0은 issue730 기존case를 보강해 검증하고, SC-08~13의 locale/필터/행·열·날짜·선택·Geometry는 선정된 i18n/Milestone/Resource/Gantt31spec의 기존 엄격한 단언을 유지한다. SC-02~07의 DnD 거부·Calendar writer/대규모 SC-14 전용 전체 여정은 이번 표시/오라클 delta에서 구현이 바뀌지 않아 전용 로컬 중복 실행을 제외하며 공식 Full8/Required3에서 전체 회귀한다. 실제 새 Head 원격·독립 인간 QA·Owner 승인은 NOT TESTED다. GSC 참조를 쓴 사실만으로 준수 PASS를 선언하지 않고 별도 Reviewer가 diff/실행 증거를 확인한다.

### C005 TEST_LIFECYCLE_REVIEW / AC_TEST_COVERAGE 보완

기존 전체 AC01~09 매핑을 유지하며 AC02/05/09의 오류 신뢰·표시·회귀 경계를 확장한다. EXTEND 기존 `safe-ui-error`/WBS transport/국가 캘린더 오류 Unit과 국가 캘린더·WBS 오류 브라우저 사례, ADD Import 실제 renderer Unit, EXTEND 기존 Project 생성 오류 브라우저, KEEP_UNIQUE 기존 누적31spec·SQLite/HTTP/마이그레이션/언어·날짜·Gantt 상태·8-shard 및 Required3다. 직접 실패와 기존 prototype-name 음성 테스트를 제거하거나 완화하지 않는다.

| 생산자·위험 | 직접·간접·음성 검증 |
| --- | --- |
| 승인 code/message와 WBS code 조회 | 기존3음성+전체 Object.prototype 키·상속 matcher 미호출·unknown code/승인 message 불일치·known code/status 우선순위 Unit |
| 국가 캘린더 오류 출처 | 실제 resolver→presenter의 서버 원문/앱 fallback·누락/비문자열·field/row detail; 기존 브라우저 파일의 locale 전환·초안/요청 수·401/412 회귀 |
| Import 경고 사전 | 실제 component renderer의 prototype key/unknown/known code·EN/VI 표시·원문 ID/path/name 및 기존 전송8case |
| 이전 #870/#878/#879 전체 실패 | C003의31고유spec(F2/E4/A13/B4/C7/D1) 전체와 전체 Vitest/원본설정 TypeScript·base docs_gate/AC 구조 |
| 기존 main의 Project 생성 오류 사전 | 기존 브라우저의 prototype code·정확 fallback·초안 보존·재시도 가능; 신규 C004 회귀와 구분해 같은 own-key 경계로 보완 |
| 제외·별도 | production HTTP/HTTPS transport·Docker 전체는 원격 gate; 운영 backup/restore·Windows Excel·실제AT/native125%는 별도 NOT TESTED |

동결된 최종 source에서 수동31spec을 workers1/retries0/max-failures0, 각 part20분 상한으로 검증한다. 최초 로컬2part 시도의 추가 실패와 중단을 원장에 보존했으며 WBS 오류 오라클 교정 후 최종검증은 공식 config로 각묶음을 순차 실행한다. 로컬 두 part를 병행할 때 서버 port/SQLite/dist/report를 분리하고 이를 원격8runner 동등성이나 성능 개선으로 해석하지 않는다. #752 Actions 진단24spec/4parts 정책은 변경/실행하지 않는다. 자동 Pre-PR의 UNKNOWN/BLOCKED와 수동 실제 회귀를 분리한다. 최종source `1cdd6edefdd0160dbcd56a290a02fb4c4953bd26c36a596654f1b6499b94d046`/1322입력은시작=종료다. 31고유spec/194계획=192PASS/기존2SKIP/FAIL0(E21/B20/C59/D8/A68/F16), 전체Unit3714PASS/기존3SKIP·build/runtime-tools·원본설정typecheck·변경13파일lint·탐색301/884·버전/cache/Markdown·base DOC_SYNC/AC구조PASS다. 자동Pre-PR UNKNOWN94/missing0/BLOCKED/sourceStabletrue는그대로유지한다. [최종실행증거](../../evidence/issue-866/ci3526-local-validation.json)와단일원장C005를따르며중간/단독/병행결과를합산하지않는다. 초기로딩의병행실패인과는미확정·최종순차실행비재현이고별도qa_docs `/root/ci3526_review`의범위한정PRE_QA기술검토PASS/새직접P1·P2=0이며미해결GitHub thread0/충돌없음을독립재확인했다. 인간QA/Owner승인이아니며게시직전lease재확인후새CI시작으로인계한다.

DOCUMENTATION_SYNC: UPDATED 본 Work Packet/PLAN/단일 원장/TEST_PLAN/REMOTE_VALIDATION/SECURITY/I18N_PHASE_C 및 정제 증거. 기존 정규 문서 영향 표를 유지한다. N/A API/DB/일정/배포/CI_CD 실행 정책: 응답 계약·마이그레이션·산식·권한·의존성·Workflow·Required3/8-shard/skip/retry/timeout은 변경하지 않는다. 버전0.142.0/release_required=true/release_authorized=false 유지.

HIGH/OWNER_MANAGED/qa_required=true, 새 Head Required3·Trusted·독립 인간 QA·Owner/Manager NOT TESTED/MERGE_READY BLOCKED/#866 OPEN. 최종 사전검토는 기술검토이며 병합 승인이 아니다.

## REWORK-C004 — #866 deferred P2 opaque-error provenance fix (2026-11-06)

The C002 E deferred P2 is addressed via explicit country-calendar error origin, trusted WBS code/status mapping, and paired exact code/message matching for `safeApiError`. Server-origin message `저장` must not be interpreted as a localization key; original field/row/country/year diagnostics stay literal, and local UI errors still translate. AC02/AC05/AC09 coverage extends; AC01–AC09 historical evidence and migration remain intact. TEST_LIFECYCLE_REVIEW: ADD country-calendar provenance unit, EXTEND safe UI/WBS error unit tests; KEEP_UNIQUE old E2E8/SQLite/HTTP and Required3. DOCUMENTATION_SYNC: UPDATED this Work Packet, docs/I18N_PHASE_C.md, docs/ISSUE_866_FAILURE_ANALYSIS.md, docs/SECURITY.md. N/A API/DB schema (no contract modification), docs/CI_CD.md and docs/TEST_PLAN.md policy (no gate/shard/timeout changes). Prior Full #3525.1 and Trusted #1172.1 PASS applied to older HEAD; new exact HEAD Full CI, trusted QA and Owner HIGH risk acceptance pending. HIGH/OWNER_MANAGED/qa_required=true, release_required=true/release_authorized=false, MERGE_READY=BLOCKED; #866 remains OPEN. Do not merge/GHCR/Finalizer/close before approval.

## REWORK-C003 — Full #3524.1 재시작 준비 예산 분리 (현재 단계)

C002 이후 새 Full #3524.1/Run42035505119의 전체8shard와 누적CI26회(Full23+metadata3)를 대조했다. 기준Head0323caf8c8b9319cd85606815a47eea2fdee34eb/base364aa3bdfde16fd3ca79add61c35a1cde21f6395/testmerge25d42c6a38bc85d364f98627897f2d1f430106de. Quality/Docker SUCCESS·E2E FAIL, 196관측PASS/직접1FAIL/기존1SKIP/미완료684다. 원본3524와 이전Head PASS를 새Head에 승계하지 않는다. [원장C003](../../ISSUE_866_FAILURE_ANALYSIS.md), 정제history/matrix/source proof를 따른다.

- 원인: inline 실제재시작18.87652초가 기본본문30초 안의 dev compile13경로 준비와 영속성단언 예산을 함께 소비. pristine1PASS/2CPU1FAIL 및 13→6경로 후보3FAIL을 보존하고 후보4파일은 복구했다.
- 설계결정: 단일spec의 실제UI저장·PATCH1/If-Match/revision·같은SQLite의 실제새프로세스/원래13경로를 준비fixture120초, 이후HTTP/data/Grid/bar/Task Editor/PATCH1을 기본본문30초로 분리. **종전 전체여정30초에서 준비120초+검증30초로 예산범위가 변경된다.** 기존 모든 단언(정적 expect 호출38개·이름검증 helper 호출8개)/첫case본문·공용fixture/제품/권한/retry0/skip·CI8shard/Required3는유지한다. 준비완료는전체PASS가아니다.
- 실제역할: Manager 가설/재현·설계선정/동결/검증/문서/통합게시, infra 전체원격증거와통제trace, 별도infra 단일spec구현, qa_docs read-only 독립기술검토. Agent검토는인간QA/Owner승인이아니다.
- source c7484317ed4eb4e66242f7b3c8c7b8ae207e7b186cb98acec58e3d4711392228/1319 동결. 2CPU3반복PASS(3.6분), 본문4.9/6.8/5.4초는준비포함시간과구분. 수동31고유spec=기존누적29+직접/인접2, F2/E4/A13/B4/C7/D1 각20분상한/workers1/retries0/max-failures0로검증한다. #752 Actions자동24spec/4parts 정책은변경하지않는다. 상세producer/소비자/음성/제외는원장C003 D를따른다.

### C003 검증·문서·위험

- LOCAL_VALIDATED: source c7484317ed4eb4e66242f7b3c8c7b8ae207e7b186cb98acec58e3d4711392228/1319 시작=종료,31spec/192계획=190PASS/기존2SKIP/FAIL0(F16/E21/A66/B20/C59/D8). 2CPU3repeat는별도이며중복가산없음. 원본설정typecheck/단일lint/탐색299·882/버전/cache/Markdown410/main DOCSYNC·AC구조PASS. 제품/DB/Unit/빌드입력1318개불변으로전체Unit/build/Docker로컬중복N/A·원격PASS승계없음.
- 자동Pre-PR UNKNOWN94/missing0/BLOCKED/sourceStabletrue, 최종report `.prepr-reports/ci3524/prepr-publish-final/`. [정제실행증거](../../evidence/issue-866/ci3524-local-validation.json), [원장C003 E](../../ISSUE_866_FAILURE_ANALYSIS.md)를따른다. 별도Agent직접보완기술검토PASS/새직접P1·P2=0과기존별도P2DEFERRED를구별한다. GitHub미해결thread0/충돌없음·게시직전재확인. 새Head Required3/Trusted/Owner/Manager NOT TESTED.

- EXTEND inline-name-persistence 전용fixture/관측영수증; 새case/skip/retry/삭제0. UPDATED 본packet/PLAN/원장/TEST_PLAN/REMOTE_VALIDATION/CI_CD/TASK_EDITOR 및정제evidence. API/DB/일정/보안/배포/제품UI·AGENTS/QA정책변경N/A(제품·공용구현불변). 정규DOCUMENTATION_SYNC/AC01~09의전체PR범위를보존한다.
- HIGH/OWNER_MANAGED/qa_required=true, release_required=true/release_authorized=false, 새Head Required3/Trusted/독립인간QA/Owner/Manager NOT TESTED/MERGE_READY BLOCKED/#866OPEN. 별도opaque-error P2 DEFERRED는보존한다. 새Full CI시작만확인하고모니터링·병합·GHCR/Release·Issue종료없음.

## REWORK-C002 — Full #3523.1 두 직접 실패와 Project 근거 표시 복구 (현재 단계)

사용자 요청에 따라 누적 원장 전체·관련CI25회와 새 전8shard를 대조하고 분석·설계·구현·리뷰/충돌·문서를 함께 갱신한다. 끝점은 새 Full PR CI 시작 확인이며 모니터링·병합·Main/GHCR/Release·Issue 종료는 하지 않는다. 아래 C001/Phase C의 이전Head 결과는 역사적 증거다.

- 기준 Head `c9a19bff307d5d889a1d353a674d9d5fb7d96da7`, base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `460fc993ff2d9ce6d36ee9d7b56c61f00d278d76`. [Run42012950520.1](https://github.com/planner77/masterGantt/actions/runs/42012950520)는 Quality/Docker SUCCESS, E2E FAIL. 실제454PASS/2FAIL/기존SKIP2/424미완료를 구별한다. 취소Shard5도실제FAIL이있다. [동일 누적 원장](../../ISSUE_866_FAILURE_ANALYSIS.md)의C002 및 새정제JSON을따른다.
- 역할: root Manager 재현/설계·선정/동결/문서/통합/게시, infra 전25회·8shard원문/report/timing, frontend 별도2명 Issue/Resource파일소유, qa_docs/error소비자·GSC독립read-only/추가backend경계검토. 실제Agent기술검토는최종인간QA/Owner판정이아니다.
- Issue TEST_CONTRACT는전용code allowlist의정확ko오류로교정하고같은오류에서EN/VI/KO·raw전체불일치·초안/record/revision·추가PATCH0·정상재시도성공을검증한다. backend rawmessage/password/code/enum/keyboard는유지한다.
- UI/UX Pro Max의범위표시관련검색2회는이특정계약에일치하는검증된결과가없었다. 일반권고는fallback으로만보고저장소의기존Project근거표시/UX계약을우선하며새시각체계는적용하지않는다.
- Resource PRODUCT/PRESENTATION은검증된Plan/Project projection에서만projectEvidence를만들어현재locale의Plan inner설명에기존Project전체부하근거wrapper를적용한다. pure renderer/type추출과집중8Unit, 기존scope/IDs/Assignmentgateway/lease/revision·사용자원문을유지한다. 기존421기대는그대로고정한다.
- 처음추가범위단언은Summary조상을누락해1FAIL/Issue1PASS였고실행중E2E수정으로STALE진단이다. 원문/zip capture2오류를보존한다. 새 source `eaa90be1bb19d08db2091017caf61e45e4bc52d2bf8ba0f3a45c370f1640d99b`/1319파일을다시동결했다. Source파일변경·Agent검증프로세스는root승인전중지한다.

### C002 영향·교차·음성 선정

| 생산자/계약 | 직접·간접·음성 소비자와 실행 |
| --- | --- |
| Issue 전용error allowlist·locale-reactive 표시 | project-issues전체case/ko-en-vi·raw비노출·wrongPATCH실패불변·정상재시도, 기존Issue HTTP·SQLite/auth Unit |
| ResourceNavigationLabel descriptor·verifiedProject wrapper | issue-736전체7case·Project/selected 정확Task/Assignment·Summary문맥·Load80/140·focus/filter복귀; 신규navigation8Unit/기존Plan9Unit |
| generic string/key/labels/Plan 현재locale renderer 추출 | issue-730-view-composer/resource-drill-ui·Milestone/Gantt i18n/Stage/ContextMenu 및원문label/no-wrapper 음성 |
| 과거#870/#878/#879 모든실제실패 | 이전동결25spec를포함해검색/밀도/관리형번역/stale/HTTP/공정/물류/복사/전송/locale/marker·기술Delete 보호 |
| Whole product host compile·기존정책 | 전체Vitest/type/lint/build·탐색299Unit/882browser·버전/cache·Markdown/main docs_gate/AC 구조 |

수동29고유spec/5parts(E4+A13+B4+C7+D1), workers1/retries0/max-failures0/각20분상한이다. #752 Actions 진단의24spec/4parts 자동상한을변경/실행하지않는다. 선택/제외·명령·지문·최종실행결과는아래LOCAL_VALIDATED와새정제증거에기록한다. 자동Pre-PR UNKNOWN/BLOCKED와수동실행은분리한다.

### C002 LOCAL_VALIDATED 증거

- source `eaa90be1bb19d08db2091017caf61e45e4bc52d2bf8ba0f3a45c370f1640d99b`/1319파일 시작=종료. 수동29spec/176계획=174PASS/기존2SKIP/FAIL0(E21+A66+B20+C59+D8), 전체Unit3666PASS/기존3SKIP, build/standalone/runtime-tools·원본설정typecheck·5파일lint0errors/기존경고1·탐색299/882·버전/cache/Markdown410·base문서구조PASS.
- 자동Pre-PR UNKNOWN94/missing0는BLOCKED/sourceStabletrue, 최종 report/SUMMARY `.prepr-reports/ci3523/prepr-publish-final/`에보존. [실제 명령·선정·지문](../../evidence/issue-866/ci3523-local-validation-20261105.json), [원장C002 F](../../ISSUE_866_FAILURE_ANALYSIS.md)를따른다. 이전Head/중간green/시각증거용재실행을고유사례에가산하지않는다.
- 직접2회귀정적Agent검토PASS와별도오류경계P2 DEFERRED를구별한다. GitHub미해결thread0/충돌없음·새Head Required3/Trusted/Owner/Manager NOT TESTED/MERGE_READY BLOCKED. API전체tree/부모와expectedHead를대조한한번게시뒤FullCI시작만확인하고모니터링하지않는다.

### C002 Test Lifecycle·문서·잔여 위험

- EXTEND project-issues/issue-736-resource-dashboard, ADD pure navigation renderer Unit8; 기존146E2E파일/882case/8shard·기능/접근성/허용오차/timeout/retry/skip/버전0.142.0은유지한다. 기존2캡처SKIP·3UnitSKIP은없애거나가산하지않는다.
- UPDATED: 본packet/PLAN/원장/TEST_PLAN/REMOTE_VALIDATION/DESIGN/I18N_PHASE_C/RESOURCE_KPI_DASHBOARD 및새정제history/matrix/후행실행증거. 정규DOCUMENTATION_SYNC/AC01~09의전체A+B+C범위는유지한다. 이번API/DB/일정산식/배포/CI권한/Ruleset은N/A(표시의미와검증만수정).
- DEFERRED: country-calendar serverMessage→t(line), WBS error.message→t(error), safeApiError의catalog포함검사에대한별도opaque-error 경계P2. 현재CI2직접오류와무관하며known-domain 국가/연도/row detail·STALE복구보존을별도설계/회귀해야한다. 미보완을숨기거나전역P1/P2=0으로보고하지않는다. 원장C002 E참조.
- HIGH/OWNER_MANAGED/qa_required=true, release_required=true/release_authorized=false. 새Head Required3/Trusted·Owner/Manager NOT TESTED/MERGE_READY BLOCKED/#866OPEN. 실제AT/native125%/WindowsExcel/운영환경·Main/GHCR/Release는NOT TESTED유지.

## REWORK-C001 — Full #3522.1 전체 실패 대조 및 접근성 오라클 보완 (현재 단계)

사용자 요청에 따라 기존 PR #879에서 실패 현상 확인·원인별 보완·리뷰/충돌 검사·원장 갱신을 마치고 새 Full CI를 시작한다. 시작 뒤 모니터링·병합·Main/GHCR/Release·Issue 종료는 하지 않는다. 아래 Phase C DELIVERY의 이전 실행/Head는 역사적 증거이며 새 판정으로 승계하지 않는다.

- 시작 Head `2844e0f7d78c7268057d89514a2db0239498dcb0`, main/base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, 원본 test-merge `31bce4daaccab57d15f5ccbeb1d8b4fd2b70c7de`. Full #3522.1/Run42003998824는 Quality/Docker SUCCESS, E2E/QA 파생FAIL, Shard8 직접TEST_CONTRACT 1건이다. 전8로그·원본report/timing 및 전체CI24회/attempt1을 대조했다. 상세는 [단일 실패 원장](../../ISSUE_866_FAILURE_ANALYSIS.md)의 REWORK-C001을 따른다.
- 실제 역할: Manager 재현·영향선정·문서·회귀/게시, 별도infra 전체24회 목록·8샤드/metadata 원본회수, frontend 지정5spec 수정, 별도qa_docs146spec 소비자감사 및 patch 독립 기술재검토. Agent사전검토는 독립인간QA/Owner ACCEPT가 아니다.
- 가설은 낡은UI이름→창준비상태→선택정리순으로 검토했고, pristine동일timeout30.2초와 실제DOM의 작업유형/일반작업으로TEST_CONTRACT를확정했다. 제품코드·UI동작/DB/API/enum/권한·revision·의존성/버전은 변경하지 않는다.
- 보완: 유형필터4spec/5조회 및 Resource관리자positiveheading1개를정확ko이름으로동기화한다. 기존legacy M 선택회귀를ko/en/vi로확장해2개사례만추가(전체880→882), 146개spec/8shard 배치·역사적성능값은불변이다. broadregex·다국어OR조회·rawenum/API/사용자이름·keyboard변경과skip/retry/timeout·허용오차완화는없다. 직접3언어green13.2초는확대검증합계와구별한다.
- `HIGH/OWNER_MANAGED/qa_required=true`, 0.142.0/release_required=true/release_authorized=false 유지. 새Head Required3/Trusted·독립인간QA/Owner·Manager판정은NOT TESTED, MERGE_READY=BLOCKED/#866OPEN이다.

### REWORK-C001 생산자·소비자·음성 영향 및 선정

| 계약/변경 | 직접·간접·음성 소비자와 검증 |
| --- | --- |
| 고정UI caption 현지화/ raw task·summary enum 분리 | 수정5spec 전체, exact3locale Task/summary선택·native/app/canonical ID·full counts/links·숨김 M·동일instance·writes0 |
| 기존#878 nativeheader/shard·#879 DOCSYNC/타입/migration | 기존shard/i18n/date/adapter/readiness/selection/search Unit9파일, 원본설정TypeScript·동일ESLint·base docs_gate/AC·탐색882·버전/CI정책 |
| 기존#879/#870 검색/관리형이름/밀도·401/412/stale·Project생성/설정 | 이전실패합집합A13spec(관리/Calendar/crossscreen/i18nmaster/languageShell/밀도/draft/create/masterrelation/workspacelayout/catalogdelete) |
| 구#870 공정/물류/Milestone·technicalDelete 및후속COPY lease | process-workareas/task-logistics/milestone-dashboard/multi-task-copy-paste4spec |
| PhaseC locale init/instance·filter·scroll·교차tab초안, 현재typefilter와상호작용 | i18n.spec와TaskContextMenu인접spec을함께선정 |
| PhaseC unknown500 전송원문·template/copy/import 보존 | 별도D의project-transfer-layout-491 전체8사례, 앞선수정의fallback/원문부재·응답완료순서검증 유지 |

로컬 CLI는동결source에서workers1/retries0/max-failures0, 최대20분의A13/B4/C7와최대10분D1=총25고유spec을수동선정한다. #752 수동Actions 진단workflow의24spec자동상한을바꾸거나그workflow를실행하지않으며이수동선정의추가1파일/4parts/비용을명시한다. 각묶음결과는고유사례로만합산하고원본fail/cancel/midrun/stale를숨기지않는다.

### REWORK-C001 LOCAL_VALIDATED 증거

- source `55c4fbc65ebe9414efa2a608dc3362566a2d5661ef4d1b50465fdb91a2556e97`/1317파일 시작=종료, 생성 Next설정/출력 복구. 수동25spec/155계획=153PASS+기존2캡처SKIP/FAIL0(A66+B20+C59+D8). 직접green3·이전Head는 중복 합산하지 않았다. 관련Unit9파일197PASS, 원본설정typecheck·5spec lint·탐색882·버전/CIcache·Markdown410·base docs_gate/AC구조 PASS.
- 자동Pre-PR UNKNOWN94/missing0는 BLOCKED, report/SUMMARY `.prepr-reports/ci3522/prepr-publish-final/`에 보존. 자동 공백과 수동 실제 검증을 구별한다. [최종 정제 실행증거](../../evidence/issue-866/ci3522-local-validation-20261105.json), [원장](../../ISSUE_866_FAILURE_ANALYSIS.md)의 REWORK-C001 D 참조.
- 미해결스레드0/충돌없음·별도Agent 정적검토PASS는 인간QA/Owner ACCEPT가 아니다. 새Head Required3/Trusted·인간QA/Owner·Manager NOT TESTED/MERGE_READY BLOCKED. 한 번 게시한 새 Full CI의 시작 정보만 STATUS 댓글에 후행 기록하고 모니터링하지 않는다.

### REWORK-C001 Test Lifecycle와 문서 영향

- EXTEND: milestone-visibility(기존case→3locale+불변식), project-task-quick-view, milestone-timeline-lane, milestone-stage-grid, resource-admin-layout. ADD/RETIRE/병합/삭제/skip추가0, 원래기능·접근성·geometry·선택/data/API보호단언KEEP_UNIQUE.
- KEEP_UNIQUE: 이전실패17spec, PhaseC native i18n/전송/메뉴인접 및9개관련Unit, 기존전체Unit/SQLite/HTTP/8-shard·Docker/QA/Owner정책. 자동Pre-PR UNKNOWN은BLOCKED로보존하고수동실행과구별한다.
- UPDATED: 본WorkPacket·활성 PLAN·단일실패원장·TEST_PLAN·REMOTE_VALIDATION 및정제실행목록/실패매트릭스. 정규DOCUMENTATION_SYNC/AC01~09는현재PR전체A+B+C범위를보존한다. 이번delta의DESIGN/제품UX/API/DB/보안/일정/배포/CI정책본문은N/A(제품변경없이기존번역표시를검증하는오라클만수정).
- 원격Full #3522의3658Unit/productionbuild/Docker 성공은원본Head에귀속한다. 이번delta에서관련9Unit/type/lint를실행하고실제제품/빌드입력바이트불변을대조하되새Head의Required PASS로승계하지않는다. 코드/의존성/Docker/빌드계약변경이없어불필요한로컬전체Unit/build/Docker반복은생략한다.

## PHASE_C_DELIVERY — A+B+C 통합 PR #879 (2026-11-05, 현재 단계)

사용자 요청에 따라 Phase C의 분석·설계·구현·문서 갱신을 기존 PR #879에 통합하고 새 Full PR CI를 시작한다. 아래 과거 Phase A/B 단락의 TODO/NOT IMPLEMENTED는 당시 기록이며, 현재 구현 범위와 미검증은 본 절 및 정규 AC_TEST_COVERAGE를 따른다. 종료점은 CI 시작 확인이며 모니터링·병합·Main/GHCR/Finalizer·정식 release·Issue 종료는 포함하지 않는다.

- 시작 Head `3fb37d77e6b4e80ee1daedf1642b6cfee1c2913b`, main/base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`. 기존 A+B [Full #3520.1 / Run41979842028](https://github.com/planner77/masterGantt/actions/runs/41979842028)의 Required3 SUCCESS는 이 시작 Head에만 유효하며 Phase C의 PASS로 재사용하지 않는다.
- 실제 역할: Manager 통합·사전검증·문서·배치 게시, 별도 frontend 4개 영역(Gantt/Project/Resource/Logistics), ui_ux 설계·infra 기존 원격 baseline 분석·별도 qa_docs 및 inventory Agent 읽기 전용 교차 검토. 파일 소유를 분리하고 이슈 #865 LLM/#869 Issue 레이아웃의 현재 main 구현을 보존한다. 구 #870의 339파일 tree/구버전은 재적용하지 않는다.
- 설계: [Phase C](../../I18N_PHASE_C.md). 고정 UI/ARIA/도움말/상태·검증 및 관리형 표시명을 ko/en/vi로 연결한다. 사용자 이름/내용/ID/code/enum/route/keyboard는 원문, 저장 날짜와 일정 산식은 불변이다. 기존 catalog 충돌은 기존 key를 우선하고 등록 action/status처럼 뜻이 다른 문맥에 명시 key를 둔다. 기존 core의 베트남어 3항목은 제품 용어 Milestone 보존을 위해 명시 교정한다.
- Gantt: 설치 SVAR 2.7.3의 `normalizedConfig → storeConfig → dataStore.init` locale 재초기화를 확인했다. 같은 API/DOM만으로 상태 보존을 선언하지 않는다. 최신 canonical에서 분리한 renderer row/Date와 안정 입력 배열, 기존 공개 API queue 및 Coordinator lease로 columns/grid/filter/open/selection/viewport를 복구한다. 기존 private store·별도 X/Y writer·서버 쓰기를 추가하지 않는다. 세부 근거는 GSC 문서/검증 절을 따른다.
- `HIGH / OWNER_MANAGED / qa_required=true`, 후보 `0.142.0`, `release_required=true / release_authorized=false`. Agent 사전검토는 독립 인간 QA가 아니며 `manager_decision=NOT TESTED / MERGE_READY=BLOCKED`, #866 OPEN. 새 exact Head의 원격 quality/e2e/docker·Trusted와 Owner 최종 검토는 NOT TESTED다.

### Phase C 변경 영향과 검증 선정

| 생산자 변경/과거 실패 | 소비자·음성 경계 | 실제 선정 |
| --- | --- | --- |
| 전체 catalog/locale·Server heading·도움말 | 3언어·SSR/storage·미지원/저장금지·opaque name/parameters | Phase A/C Unit, language-shell, 신규 i18n E2E |
| SVAR locale/init·날짜·숫자·menu | 최신 canonical 행/필터/열·split·selection/open·Day/Week/scroll·초안·쓰기0 | adapter/viewport/week Unit, 신규 native locale E2E, 기존 workspace/context/editor/Milestone 회귀 |
| owner 표시명·프로젝트 기준정보 번역 입력 | 원본 ID/name·omission/clear·401/412/stale·선택·density | managed-display-names SQLite/HTTP Unit, i18n-master-data 및 기존 공정/물류·관리자 회귀 |
| dynamic notification/navigation label | 원문 사용자값·현재 locale·기존 ID/시간/read/timer·history 유지 | notification/model Unit, native task draft E2E 및 Resource drill 회귀 |
| 과거 #878/#879/#870 실패 전체 | shard count·DOC_SYNC·migration·표/검색geometry·기술 Delete key | 원장 합집합 17 spec + Phase C 직접/인접/음성 spec, 전체 Vitest/type/lint/build |

로컬 브라우저는 workers1/retries0/max-failures0, 파일별 유한 묶음으로 실행한다. CI의 fail-fast·Required3·Chromium8·retry/timeout·권한·Ruleset은 변경하지 않는다. 기존 145개 spec 배치를 그대로 두고 신규 `i18n.spec.ts`만 Shard8에 추가해 146개를 정확히 한 번 배치한다. #3520의 Shard8 wall941s는 배치 참고값이며 신규 duration은 REMOTE_UNMEASURED, 10-run 성능 baseline으로 주장하지 않는다. 기존 projectedMs/sourceRunIds/metrics는 불변이다.

### Phase C Test Lifecycle

- ADD: `tests/e2e/i18n.spec.ts`(실제 브라우저 선호/storage/교차 탭 초안/Server heading·help/native locale 상태), `tests/lib/i18n-phase-c.test.ts`, `tests/components/safe-ui-error.test.ts`, `tests/components/context-help-label.test.ts`, `tests/components/project-work-calendar-errors.test.ts`.
- EXTEND: 기존 adapter/week/managed-name/resource/logistics/notification Unit 및 기존 E2E의 정확한 locale별 고정 UI·날짜 기대값, 기존 shard planner의 count와 신규 spec→Shard8 매핑. 원래 ID·자유 텍스트·키보드·권한·geometry 단언은 유지한다.
- KEEP_UNIQUE: B008 기존 17 spec 실패/인접/음성 합집합, Phase A/B SQLite/HTTP·migration·Copy/Template·Export409·401/412·GSC/viewport 및 기존 전체 8-shard 회귀. 테스트 삭제/skip 추가·허용오차/timeout/retry 완화는 하지 않는다.
- 로컬 실패·진단 수정·동결 source와 실행 결과는 [누적 원장](../../ISSUE_866_FAILURE_ANALYSIS.md)에 추가한다. 이전 Head의 PASS·중단 실행 관측은 최종 합계에 더하지 않는다.

## REWORK-B007 — PR #879 Full #3518.1 Project Master geometry + keyboard (2026-11-05)

- Source: Full Run 41965727570.1 https://github.com/planner77/masterGantt/actions/runs/41965727570, HEAD b8a90a709fa126efbad5bff8dcd1acd45449a50c, main base 364aa3bdfde16fd3ca79add61c35a1cde21f6395, test-merge d7cda7b58a284f3e5b200e6bec2a8d17a703460f. Preflight, Policy, ESLint, TypeScript, Unit 3540 PASS/3 SKIP, Next build, Quality and Docker PASS. Chromium shard7 Job 127043119334 direct FAIL: #457 populated master row 87px vs strict 48px; 1 PASS, 1 FAIL, 77 NOT RUN. Other7 shards CANCELLED; E2E aggregate and QA Final derived FAIL.
- Root cause PRODUCT/UI_LAYOUT: JSX styles.nameControl wrapped native name input and new translation button, but CSS Module had no .nameControl rule. Input width100% pushed 40px button below, doubling row. Add horizontal flex-nowrap/gap6 and input flex-basis0/min-width0; preserve original name/ID, scroll owner, fine40px/coarse44px controls, no clipping/fixed row height/hiding.
- Cross-feature keyboard sequence: name input -> translation dialog trigger -> sort -> Save -> Deactivate (Code disabled for used item). EXTEND original #457 E2E to check first Tab focus and aria-haspopup=dialog, then three Tabs and existing focus-visible; keep strict row<=48 and column geometry. No spec/shard additions or weakening.

### TEST_LIFECYCLE_REVIEW (REWORK-B007)

- EXTEND tests/e2e/cross-screen-regression.spec.ts; KEEP_UNIQUE tests/e2e/i18n-master-data.spec.ts 5 widths/3 languages/coarse/401/412 and existing Project Master, security, database, SVAR/Gantt, Copy/Template tests. Original Chromium8/Required3 and fail-fast, retry/timeout, assertions preserved. Exact new HEAD Playwright/CI: NOT TESTED.

### DOCUMENTATION_SYNC (REWORK-B007)

- UPDATED CSS Module, existing cross-screen E2E, this Issue Work Packet, Issue failure ledger, docs/I18N_PHASE_B.md and docs/UI_UX_GUIDELINES.md.
- N/A AGENTS.md, original docs/TEST_PLAN.md, API/DB schema/migration, CI trusted verifier/workflow, product version, Release/Owner policy. Existing canonical DOCUMENTATION_SYNC and AC_TEST_COVERAGE sections preserved. Phase C acceptance and GHCR/merge remain HOLD.

## REWORK-B006 — PR #879 Full #3517.1 선택적 translations TypeScript 컴파일 실패 (2026-11-05)

- [Run 41960950080.1](https://github.com/planner77/masterGantt/actions/runs/41960950080), source HEAD `1dfc5d7f5ec0ee0252773ba3900971ec977a2d90`, base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `2264f3ae06ae6a3461b7b68b60c01d2ef7f8fca3`; QA Preflight, Policy, ESLint PASS; Vitest 3540 PASS/3 SKIP. TypeScript Job127027137923 `resource-dashboard-service-core.ts:805` TS2339 두 건 직접 실패; Fast Gate/Required3/QA Final 파생 실패. Next/E2E8/Docker NOT RUN. 이전 #3515 TypeScript 9건·Vitest 3건, #3516 DOC_SYNC 차단을 누적 원장과 대조했다.
- **설계/보완:** Target 카탈로그는 Public DTO `ResourceDashboardTargetProjection["catalog"]` 타입으로 반환하도록 설계되어 있으나 `renderTargets`의 무타입 spread array가 group(선택적 번역)/resource(번역 없음)/target 원본 행을 좁은 union으로 추론. `catalog` 배열에 공용 DTO element의 `translations?` 필드를 명시하는 **컴파일 전용** 선언을 추가. 기존 런타임 값, 순서, Map, KPI 계산·원본 이름/ID·DB/HTTP 및 권한 무변경.
- **AC_TEST_COVERAGE:** AC04·AC05 언어별 관리형 name/owner DTO를 Resource target projection에서 안전하게 소비하는 타입 계약; AC06 migration/Copy/Template 보존, AC09 기존 managed-display-names server/SQLite assertions/Resource Dashboard/Gantt 등 유지. 전체 Phase C AC02·03·07·08·09 검증은 여전히 미완료.

### TEST_LIFECYCLE_REVIEW (REWORK-B006)

- KEEP_UNIQUE: `tests/server/i18n/managed-display-names.test.ts`의 snapshot/target/group 번역·KPI 불변, Resource Dashboard/WBS 호출 소비자, 기존 Vitest 3,540 PASS와 지난 이력의 Test/CI/HTTP/SQLite/E2E8/권한·경합 안전 테스트. 새 spec·skip·retry·timeout/coverage 완화 0. 변경 소스의 정적 DTO 호환 근거만 확인했으며 새 exact HEAD TypeScript/Full CI 이전 실제 결과는 **NOT TESTED**.

### DOCUMENTATION_SYNC (REWORK-B006)

- UPDATED: `docs/exec-plans/active/ISSUE_866.md`, `docs/ISSUE_866_FAILURE_ANALYSIS.md`, `docs/I18N_PHASE_B.md`, `src/server/resources/resource-dashboard-service-core.ts`.
- N/A: AGENTS.md, docs/TEST_PLAN.md(원본 정책 보존), docs/API.md·docs/DB_SCHEMA.md(기존 Phase B DTO/owner 설명 불변), docs/SCHEDULING_ENGINE.md(산식 불변), CI workflow/QA verifier·Required3·Chrome8·GHCR·운영 DB 변경 없음.

## REWORK-B005 — PR #879 Full #3516.1 DOCUMENTATION_SYNC 일정 계약 영향 기록 보완 (2026-11-05)

- 원본 Full [Run 41956539012.1](https://github.com/planner77/masterGantt/actions/runs/41956539012), `pull_request.synchronize`, HEAD `7bce2814ee96bdb168ad1e7556792183b4f5f8fd`, Main `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `6dabd4bce384bb7c56a45981016824eecdb674dd`는 원본 Job 로그의 checkout ref. QA Preflight Job `127012793287`은 단일 `DOCUMENTATION_SYNC` 직접 FAIL(문서 영향 기록 없음: `docs/SCHEDULING_ENGINE.md`), `FAIL=1/DEFERRED=5`; 다른 정책/필수 항목은 PASS. Fast Gate/Required3/QA Final은 파생 FAIL이며 TypeScript/Vitest/ESLint/Chromium8/Next Build/Docker 구현은 SKIPPED, 결과 NOT TESTED.
- 원인: REWORK-B004에서 migration 0036의 전진 적용 경로를 검증하도록 `tests/server/calendars/country-calendar-integration.test.ts`를 수정한 순간, 신뢰된 Main `scripts/qa_final_automated.py::docs_required`의 `calendar|schedul|dependency|duration|milestone` 경로 규칙이 `docs/SCHEDULING_ENGINE.md`의 영향 판단을 요구했으나 정규 `## DOCUMENTATION_SYNC`에 기록하지 않았다. 문서 자체 Blob SHA `96ca4156ae976168432cdffe7c2cdc785eb4df41`는 Main/HEAD가 같고 기존 Scheduling Engine, Working Calendar, Dependency, Resource Plan 계산 알고리즘은 변경되지 않았다.
- **보완:** 현재 정규 `## DOCUMENTATION_SYNC`에 `docs/SCHEDULING_ENGINE.md: N/A(reason)`를 추가한다. 실제 변경의 의미는 `0034→0035→0036` 적용 목록을 확인하도록 과거 테스트 기대값을 수정하는 것으로 기존 Country Calendar data/이력/스냅샷·근무일 산식·date-only/FS/SS/FF/SF 정책 변경이 아니다. 신뢰된 검사기/CI workflow/원본 Scheduling Engine 문서를 변경하거나 영향 기록 조건을 완화하지 않는다.
- **TEST_LIFECYCLE_REVIEW:** 이번 단계 테스트 코드 ADD/EXTEND/RETIRE 0. 직전 REWORK-B004의 기존 country calendar migration 보존 테스트, Project Issue migration regression, locale group search Vitest 및 신규 i18n snapshot, Phase A/B Playwright 145 spec/8 shards를 KEEP_UNIQUE. 이전 실행 미검증 영역은 PASS로 승격하지 않는다.
- **DOCUMENTATION_SYNC:** Work Packet 현재 `## DOCUMENTATION_SYNC` 수정, 누적 실패 원장 보존 갱신; 문서 `docs/SCHEDULING_ENGINE.md` 자체는 N/A(계산 불변). 해당 DOC_SYNC 규칙의 Main 대비 108개 changed file 합집합 7문서 재대조 결과 기존 6개 UPDATED와 이번 1개 N/A가 모두 충족. `## AC_TEST_COVERAGE` AC01~09·HIGH OWNER_MANAGED, qa_required=true, release_required=true, release_authorized=false 유지. 리뷰 thread 이전 P2 resolved, unresolved 0, branch main 대상 및 mergeable=true, #866 OPEN; CI 시작 이후 모니터링/병합/GHCR/Issue 종료 없음.

## REWORK-B004 — PR #879 Full #3515.1 직접 TS 9건·Vitest 3건 (2026-11-05)

- 원본 [Run 41947822098.1](https://github.com/planner77/masterGantt/actions/runs/41947822098), HEAD `7e861e458135f6fe35e88394ed376b152420c688`, main `364aa3bdfde16fd3ca79add61c35a1cde21f6395`. Preflight/Policy/ESLint PASS; TypeScript Job126984569355 TS2554/TS2339/TS2352 총9, Vitest Job126984569338 migration 적용 목록 3 FAIL(3536 PASS/3 SKIP), Required3/FastGate/QA는 파생 FAIL, E2E8·Docker·Next Build SKIPPED.
- **원인·구현:** Phase B 언어별 그룹 필터 UI는 `filterGroups(groups,query,locale)`을 호출하나 검색 helper가 기존 2인자만 허용. canonical name/code/id 검색을 보존하면서 현재 locale 표시명 검색과 다른 언어 매칭 격리를 추가. 런타임 snapshot의 `translations` 데이터는 존재하나 Resource Dashboard/WBS/Logistics public DTO 타입 선언이 누락; 선택적 DisplayNameTranslations 메타데이터를 DTO에 표현하고 cast를 제거. 신규 migration 0036이 정상 추가된 상태에서 구 테스트의 hardcoded 적용 목록·최고 버전 35 계약만 stale; 새 이력 0036 및 version36을 포함하되 원본 레코드/checksum/foreign-key/idempotent 단언은 그대로 유지.
- **TEST_LIFECYCLE_REVIEW:** EXTEND 기존 `tests/features/resources/resource-search-filter.test.ts` ko/en/vi/원본-ID/언어 격리, `tests/server/projects/project-issues.test.ts` 0032·0033→0036 보존 회귀, `tests/server/calendars/country-calendar-integration.test.ts` 0034→0036 보존 회귀. KEEP_UNIQUE 번역 snapshot·KPI와 145 Playwright spec/Chromium8, Phase A/B DB·HTTP·권한·동시수정·Copy/Template/Import/Export 회귀. ADD/DELETE/SKIP 없음, QA·CI 정책/마이그레이션 본문·릴리스 권한 불변.
- **DOCUMENTATION_SYNC (REWORK-B004):** 정규 `## DOCUMENTATION_SYNC`에 아래 영향 파일을 UPDATED로 추가하고 본 Work Packet·누적 실패 원장을 갱신한다. 신규 Head의 원격 TypeScript/Vitest/E2E8/Docker/Trusted 결과는 PR CI 전 NOT TESTED. 미해결 inline thread 0, 이전 P2 resolved, mergeable=true; #866 OPEN, release_authorized=false.

## REWORK-B003 — #3514.1 문서 영향 반복 실패 원인 및 교정 (2026-11-05)

- 원본 [Full #3514.1 Run 41946308147.1](https://github.com/planner77/masterGantt/actions/runs/41946308147), Head 420781ac039e75adbc4143525a848c5e6bb2ca68 / Main 364aa3bdfde16fd3ca79add61c35a1cde21f6395 / test-merge 765f10ba4696cad4b269741eb57f563d18fdb94a. QA Preflight Job126979392129 직접 DOCUMENTATION_SYNC FAIL (docs/IMPORT_SCHEMA.md missing), 세 Required 집계·QA Final은 파생, Node/E2E8/Docker NOT RUN.
- B002에서 갱신한 문서 본문과 ### DOCUMENTATION_SYNC (REWORK-B002)는 base의 검증기가 읽는 정규 `## DOCUMENTATION_SYNC`가 아니었다. 신뢰된 `scripts/qa_final_automated.py::section` 및 `docs_gate`는 정확한 2단계 heading 내부 `- `path`: UPDATED|N/A(reason)`만 인식한다. 검증기를 완화하지 않고 해당 **단일 정규 절**을 통합 변경 범위(Phase A+B)에 맞게 수정했다.
- 전체 Main diff와 docs_required를 대조한 필수 6문서: DESIGN.md, docs/TEST_PLAN.md, docs/DB_SCHEMA.md, docs/API.md, docs/IMPORT_EXPORT.md, docs/IMPORT_SCHEMA.md. 전부 실제 변경되었으므로 UPDATED. 함께 SECURITY/UI_UX/PROJECT_UX/LOGISTICS_DOMAIN_DESIGN/I18N_PHASE_B 등 영향 문서도 정합화. 정규 `## AC_TEST_COVERAGE`의 현재 구현·미검증 상태 수정.

### TEST_LIFECYCLE_REVIEW (REWORK-B003)

- ADD/RETIRE 없음. KEEP_UNIQUE: 기존 Test Lifecycle/Required3/Chromium8, Phase A language-shell/SVAR, Phase B SQLite/HTTP·Import/Export/Copy/Template·412 경합/145 E2E spec. 제품/테스트/정책/skip/retry/timeout 수정 없음. Remote new Head NOT TESTED.

### DOCUMENTATION_SYNC (REWORK-B003)

- UPDATED: docs/exec-plans/active/ISSUE_866.md의 exact `## DOCUMENTATION_SYNC`와 `## AC_TEST_COVERAGE`, docs/ISSUE_866_FAILURE_ANALYSIS.md, docs/I18N_PHASE_B.md.
- N/A: AGENTS.md, CI/CD workflow, scripts/qa_preflight.py, scripts/qa_final_automated.py, DB migrations/제품/Release 변경 없음. 기존 docs/IMPORT_SCHEMA.md 본문은 B002 갱신 그대로 보존.
## REWORK-B002 — PR #879 Full #3513.1 문서 영향과 물류 유형 동시 편집 교정 (2026-11-05)

- 원본 [Full #3513.1 / Run 41943199412.1](https://github.com/planner77/masterGantt/actions/runs/41943199412), HEAD `20f106f39f90d838193234c5bb0320977fe4af91`, base main `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `1645f96490dc08e09efbe082c38b4de4f84213f4`. 최초 QA Preflight Job126968984659의 **DOCUMENTATION_SYNC FAIL: docs/IMPORT_SCHEMA.md 미기록** (FAIL1/DEFERRED5); FastGate/Required Quality·E2E·Docker/QA Final은 파생, 실제 TS/Vitest/Chromium8/Docker SKIPPED.
- **문서 결정:** 일정 Import schema 1.0/1.1 기계 계약은 변경하지 않음. 관리형 표시명 ko/en/vi와 Project Copy/Template v6의 별도 snapshot 계약, 일정 Export의 `409 DISPLAY_NAME_TRANSLATIONS_EXPORT_UNSUPPORTED` 손실 거부를 `docs/IMPORT_SCHEMA.md` 상단에 명시한다. 기존 JSON schema 및 `src/contracts/import.ts`/validator 변경 없음.
- **P2 리뷰 [r4475215195](https://github.com/planner77/masterGantt/pull/879#discussion_r4475215195):** LogisticsTypeCatalogAdmin은 기존 TranslationEditor와 달리 독립적인 수정 폼이었다. 첫 수정 당시 global catalog revision을 보존하고 412·갱신 뒤 기존 번역 초안을 다른 언어까지 덮어쓰지 못하도록 저장 버튼/submit 차단 및 alert, 취소 후 재열기 정책을 동일하게 적용.
- AC04/AC05 번역 동시 수정/권한·기본 이름 불변 보호, AC06 Import 스키마 호환·Copy/Template/Export 손실 방어, AC09 테스트 원장·문서 영향 추적. Phase C AC02/03/07/08/09 전수 검증은 별도.

### TEST_LIFECYCLE_REVIEW (REWORK-B002)

- EXTEND `tests/e2e/logistics-type-catalog-admin.spec.ts` — 412 concurrency/기존 초안·신규 revision/다른 관리자 vi 변경 보존/중복 PATCH 거부/최신 원본 재편집. KEEP_UNIQUE `tests/e2e/resource-catalog-delete.spec.ts`, `tests/e2e/i18n-master-data.spec.ts`, `tests/lib/i18n-translation-write-field.test.ts` 및 기존 SQLite/HTTP/Import/Template/Copy/Gantt/E2E.
- 기존 145 E2E spec/8-shard 계획, 모든 Required Check/QA, 테스트 assertion·retry/timeout·skip 불변. 새 Head의 실제 테스트 결과는 CI 실행 전 NOT TESTED.

### DOCUMENTATION_SYNC (REWORK-B002)

- UPDATED: `docs/IMPORT_SCHEMA.md` (strict 일정 JSON 1.0/1.1의 번역 비지원과 손실 방어), `docs/exec-plans/active/ISSUE_866.md` (본 기록), `docs/ISSUE_866_FAILURE_ANALYSIS.md` (최초부터 실패 전수), `docs/I18N_PHASE_B.md` (동시 수정 설계). 관련 UI/E2E 최신 수정.
- N/A: AGENTS.md, docs/TEST_PLAN.md (선행 P1 복원 원본 정책 보존/본 Work Packet에서 Phase B 테스트 상세 추적), docs/IMPORT_EXPORT.md (이미 Export 409, Copy/Template v6 기록되어 있으며 기계 Import 계약은 이 문서에 명시), DB schema/마이그레이션, CI policy/Required3, package/lock, Main 릴리스 경로. 모두 현재 규정 그대로.

## REWORK-B001 — PR #879 Full #3510.1 Preflight BLOCKED 및 Codex P1/P2 보완 (2026-11-05)

- 원본 Full #3510.1 / Run 41941093006.1, HEAD dfc967258f5fa0cc8e188d116cdccd734f49c771, Base #878 HEAD 8fca83bbc12cf516cd7f22438fa16c6b596d80fb, test-merge 28d4bb5ece15503393808ecbcc5410168264fe02. 직접 QA Preflight 126961958453 POLICY_CI FAIL (base.ref != main), Fast Gate/Required3/QA Final은 파생. Vitest/TypeScript/E2E8/Docker NOT RUN.
- 설계 변경: 신뢰된 main-base QA 정책은 유지하고 PR #879의 GitHub 대상만 main으로 변경. Main diff에는 Phase A+B가 포함되나 선행 #878은 그대로 OPEN, 병합/정식 GHCR/Issue #866 종료는 승인되지 않음.
- Codex P1: Phase B 작성 시 docs/TEST_PLAN.md가 빈 fetch content로 덮인 결함. Phase A 원본 Git Blob 990eee5eb1e21cbffcd091b1331dba315d5990ee로 복원. 기존 5762줄 정책 source 보존, Phase B 테스트 내역은 본 Work Packet/별도 설계·실패 원장에서 추적.
- Codex P2: TranslationEditor는 snapshot(revision, translations)을 캐시하고 현재 catalog revision 변화 시 저장을 막고 경고를 표시. 리소스 그룹과 프로젝트 마스터 양쪽 적용. 서버 If-Match 변경 없이 stale silent overwrite 방지.

### TEST_LIFECYCLE_REVIEW (REWORK-B001)
- EXTEND tests/e2e/resource-catalog-delete.spec.ts: 2명 관리자 동시 갱신(모의), refresh revision 갱신, stale draft 저장0/초안 보존/경고, 취소 후 재열기, 최신 vi 유지 및 en 저장 확인.
- KEEP_UNIQUE #866 기존 관리형 마스터 SQLite/HTTP 테스트, Phase A locale shell, 145개 E2E spec/8 shards/Required3 및 QA 원본 검증. 신규 E2E 파일 없음. 전체 신규 source의 원격 테스트 결과는 NOT TESTED.
- AC04/AC05 revision 경쟁 회귀 방어, AC06 원본 migration/Copy/Template 불변; AC02/03/07/08/09 Phase C 미완료.

### DOCUMENTATION_SYNC (REWORK-B001)
- UPDATED docs/ISSUE_866_FAILURE_ANALYSIS.md, docs/exec-plans/active/ISSUE_866.md, docs/I18N_PHASE_B.md, docs/REMOTE_VALIDATION.md, PR #879 및 component/consumer/E2E.
- RESTORED docs/TEST_PLAN.md to exact Phase A source Blob; 정책 내용/원본 line 손실 없이 기존 Test Lifecycle source of truth 유지.
- N/A AGENTS.md, scripts/qa_preflight.py, CI workflow, QA/Trusted/Owner, packages, DB migration/권한 정책 수정 없음.

## PHASE_B_DELIVERY — 2026-11-05 (종속 PR / 최신 상태)

- Phase A Full PR #878 [#3509.1](https://github.com/planner77/masterGantt/actions/runs/41930396372) 성공 확인. 병합 및 정식 릴리스 미승인.
- 이번 Phase B는 Phase A Head 기반 브랜치 feat/issue-866-i18n-phase-b-owner-data로 구현한 **종속 PR**. 저장·권한·UI/12 owner, Copy/Template6/Exporter 및 E2E를 추가하되 Phase C 최종 AC가 남으므로 #866 OPEN / release_authorized=false. 과거 Phase A 단락의 NOT IMPLEMENTED는 당시 역사적 상태이며 현재 상태는 본 단락을 우선한다.
- 구현 설계: [Phase B 기술문서](../../I18N_PHASE_B.md). 신규 정확 Head 원격 Full CI/Trusted 및 실환경 백업·권한·5폭 검증 전 NOT TESTED. #870 원본 전체 PR 재사용·병합 금지.

### TEST_LIFECYCLE_REVIEW (Phase B)

- ADD: tests/server/i18n/managed-display-names.test.ts, tests/lib/i18n-translation-write-field.test.ts, tests/e2e/i18n-master-data.spec.ts.
- EXTEND: tests/server/db/database.test.ts, tests/server/migration-cli.test.ts, 기존 공정/물류/리소스/Template/Copy 관련 서비스 tests, tests/scripts/e2e-shard-planner.test.ts.
- KEEP_UNIQUE: Phase A tests/lib/i18n-phase-a.test.ts 및 tests/e2e/issue-866-language-shell.spec.ts, DB/HTTP/권한/Task/Gantt/Calendar/Chromium8 기존 사례.
- Remote new Head test 결과는 NOT TESTED. Shard7 신규 1개(17→18), 145개 spec 1:1, 기존 144개 이동 0.

### AC_TEST_COVERAGE (Phase B 추가)

- AC04: migration 0036/owner 12/DisplayNameTranslations/CRUD service/관리 UI + unit/SQLite/E2E. 전 owner 브라우저 실증 필요.
- AC05: 기존 global admin 및 project edit 세션 + revision/Origin/If-Match 재사용·음성 사례, 새 exact HEAD 원격 검증 필요.
- AC06: 0035→0036, copy/template6, export 명시거부, 신규 DB/reopen/FK/백업 복원 추가 검증 필요.
- AC02/03/07/08/09: Phase C 전 화면·Gantt 상태·장문/접근성·전수 검증 미완료.

### DOCUMENTATION_SYNC (Phase B 추가)

- UPDATED: docs/I18N_PHASE_B.md, docs/exec-plans/active/ISSUE_866.md, docs/ISSUE_866_FAILURE_ANALYSIS.md, docs/DB_SCHEMA.md, docs/API.md, docs/TEST_PLAN.md (원본 복원), docs/REMOTE_VALIDATION.md, docs/SECURITY.md, docs/IMPORT_EXPORT.md, docs/UI_UX_GUIDELINES.md, docs/PROJECT_UX.md, docs/LOGISTICS_DOMAIN_DESIGN.md, DESIGN.md, CHANGELOG.md, docs/REQUIREMENTS.md.
- N/A: AGENTS.md (기존 QA/보안/독립 Owner 규칙 준수, 정책 변경 없음), docs/ARCHITECTURE.md (서버·배포 토폴로지 불변), CI workflow/Runner/Required3/GHCR 운영 변경 없음.

# Issue #866 — 한국어·영어·베트남어 국제화 / 최신 Main 분리 실행 계획

- Primary: https://github.com/planner77/masterGantt/issues/866
- 선행 통합 PR(역사적 참고, **직접 병합 금지**): https://github.com/planner77/masterGantt/pull/870
- 확정 Owner 정책: ko/en/vi 수동 선택, 최초 브라우저 선호 참고, 브라우저별 지속, unsupported=ko, 자유 입력 원문 불변, 관리형 기준정보 기존 ID/name/Unique 유지+수동 표시명/원문 fallback.
- Phase A 기준 Main: `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, 앱 `0.141.1`, SVAR React Gantt `2.7.3`.
- 현재 분리 후보: Phase A `v0.142.0`, `risk_level=HIGH` / `qa_method=OWNER_MANAGED` / `qa_required=true` / `release_required=true` / `release_authorized=false`. **Phase B/C 완료와 별도 정식 버전 승인이 있을 때까지 병합·정식 GHCR 발행 금지**.

## BASELINE_AND_SCOPE

구 PR #870는 **339개 변경 파일**에 현재 이미 구현 완료된 #865 사내 LLM 및 #869 Project Issue 레이아웃·E2E까지 혼합하고 기준 app version `0.139.1→0.140.0`이다. 현 Main에는 해당 기능이 이미 병합되어 있으며 실제 현재 버전 `0.141.1`을 사용한다. 과거 전체 PR Tree/버전을 Main에 재적용하면 운영 코드·권한·UI·migration 회귀 위험이 있다. 기존 PR의 i18n 구현에서 **순수 언어 registry/store/provider/selector, core static catalog, SVAR locales, 날짜 출력 helper, 상단 Navigation**만 선택 재사용한다. Domains/API/DB/기준정보 번역, LLM, Issue form 레이아웃, 오래된 E2E는 이 Phase A에 포함하지 않는다.

## PHASE_A_IMPLEMENTATION

- **E2E 명시 샤드 필수:** 신규 spec를 기존 `tests/config/e2e-shard-plan.json` Shard5(기존17→18)로 등록. 이미 존재한143개 spec의 배치·historical projectedMs·source Run 증거는 보존, 새 spec 1개의 duration은 `REMOTE_UNMEASURED`. Full E2E8/8 완료 전 실제 속도/전체 PASS를 가정하지 않는다.

1. `src/lib/i18n/{locales,store,provider,locale-selector,index}.ts(x)`, `catalogs/{core,shell}.ts`: explicit ko/en/vi 선택, localStorage `mastergantt.ui.locale`, 저장 미허용 시 탭 메모리 선택, 다른 브라우저 설정·미지원 언어 fallback, React `useSyncExternalStore`로 서버/첫 hydration 기본 ko를 유지하고 클라이언트 lang/사전·숫자 표시를 동기화한다. 번역은 정적 plain text만, 원본 유저 문자열은 임의 자동 번역하지 않는다. 안전한 오류 코드는 검증된 whitelist만 사용자 표시.
2. `src/app/layout.tsx`, `src/components/{workspace-shell,workspace-navigation}.tsx`: 상단 header 언어 선택기를 기존 Notification Portal **옆**에 추가하며 portal ID는 보존. 내비게이션/ARIA/skip link만 즉시 번역하고 도메인 본문은 추후 Phase C. `globals.css`의 3열 헤더/가로스크롤 Nav/selector/focus/모바일 폭·알림 영역을 보존한다.
3. `src/lib/date-display.ts`: `SSR_DATE_LOCALE=ko-KR`, 사용자가 선택한 locale > 브라우저 선호. date-only 출력에는 UTC 기준 calendar day만 적용하고 서버 저장일·일정 엔진/Work Calendar 계산에 영향을 주지 않는다. 실제 화면별 formatter 재연결은 Phase C.
4. `src/features/gantt/svar-locales.ts`, `project-gantt.tsx`, `svar-gantt.tsx`: SVAR 공식 `Locale words` 확장으로 한국어/영어/베트남어 static words/core/calendar를 제공하되 `weekStart=1`, iso W##/일정·정규 task ID/기간/관계/스크롤 상태를 건드리지 않는다. Locale Provider에 키를 넣어 Gantt를 remount하지 않으며 Gantt의 텍스트와 날짜 계산은 별개. 공식 참조: https://docs.svar.dev/react/gantt/guides/appearance/localization/ 및 https://docs.svar.dev/react/gantt/samples/ .
5. `tests/config/{playwright,transport}.config.ts`: 기존 테스트가 한국어 UI를 기준으로 작성된 사실을 숨기지 않고 기본 Browser Locale을 명시적 ko-KR로 **고정**하며, 새 국제화 E2E에서 개별 en-US/ko-KR을 override한다. CI Required Quality/E2E8/Docker/Trusted/Runner·cache·timeout·skip/retry는 변경하지 않는다. `package.json` / lock의 root 세 버전만 `0.142.0`으로 동기화하고 packages graph 불변.

## TEST_LIFECYCLE_REVIEW

- **ADD** `tests/lib/i18n-phase-a.test.ts` — 선택/브라우저 precedence·미지원/저장 금지·SSR 첫 렌더·reload·정적 번역 키·plain-text/비밀 노출 방지·원문 이름·숫자·SVAR 3개 로케일과 weekStart=1·date-only 음성.
- **ADD** `tests/e2e/issue-866-language-shell.spec.ts` — ko→en→vi 상단 헤더/ARIA/HTML lang/브라우저 저장/새로고침/URL 불변, 잘못된 값 fallback, 최초 en-US 선택. Phase A 외의 미번역 도메인 텍스트는 영어 번역을 주장하지 않는다.
- **KEEP_UNIQUE** `tests/lib/date-display.test.ts`의 UTC date-only 불변/시간대 원본, Gantt Core/Store/Viewport/E2E/실제 SQLite/Task Editor·WorkCalendar/Item 관리·권한 및 기존 transport/QA 테스트. Phase B/C에서 #866 기존 PR의 `tests/e2e/{i18n,i18n-master-data}.spec.ts`를 **최신 API/스키마에 맞춰 독립 재검증 후** 이식한다.
- 분리 트랜치/새 PR exact Head의 로컬 Node/Chromium/Docker/SQLite 실제 테스트는 **NOT TESTED**(GitHub 커넥터 코드 검토). 새 Full PR CI 시작·검증 전 기존 PR #870의 과거 PASS를 재사용/소급하지 않는다.

## DEPENDENCIES_AND_PENDING_AC

- **AC01 Phase A 구현**: registry/selector/storage + 새 Vitest/Playwright 검증. Phase A CLI/remote 결과 대기.
- **AC02 PARTIAL**: 헤더·내비게이션·Gantt static words만; Project List/Workspace/Issue/Editor/Dashboard/관리자는 한국어 문구 잔여 → **Phase C**.
- **AC03 PARTIAL**: SVAR custom words/Locale & weekStart; native Gantt *실제 인스턴스 보존/스크롤/Task edit/Day-week* 전수 원격 회귀 → **Phase C**.
- **AC04~AC06 NOT IMPLEMENTED**: owner별 관리형 기준정보 전역·프로젝트 표시명 저장 테이블/서비스/API/권한/마이그레이션/Copy·Template·Export 손실 가드 → **Phase B**, 기존 ID/code/name은 변경 금지.
- **AC07 PARTIAL**: 날짜 출력 helper/SSR 언어, 각 화면 날짜/숫자 formatter·진척/KPI 확인 → **Phase C**.
- **AC08 PARTIAL**: 헤더와 selector 390px 대응·ARIA, 전체 화면/관리 UI/긴 베트남어 접근성 5폭 시험 → **Phase C**.
- **AC09 PARTIAL**: Phase A tests; 전 영역 DB/HTTP/E2E/원본 파일·유사 테스트 inventory 및 fail-closed 회귀 → 각 Phase별 추가.
- 완성된 i18n·동시 저장·데이터 격리/실환경 검증까지 #866를 OPEN. **Phase A PR Full CI SUCCESS만으로 #866 전체 AC 충족·merge/Release/Issue 종료 권한 없음.**

## DOCUMENTATION_SYNC

현재 원장은 Main 대비 PR #879의 Phase A+B+C 통합 diff 기준이다. 아래 역사적 Phase A 시점 N/A 기록보다 본 정규 절의 UPDATED/N/A가 최신 검증 기준이다. 테스트 정책 원문 docs/TEST_PLAN.md는 이전 오류에서 복원해 보존했으며 Main 대비 Phase A 변경분이 있어 UPDATED이다.

- `AGENTS.md`: N/A(기존 테스트 검색, Owner Managed QA·변경 영향/릴리스 정책 준수; 본 PR에서 정책 자체를 바꾸지 않음)
- `DESIGN.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(고위험 Owner Managed·Trusted 검증 규칙 그대로 적용)
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 CI Finalizer·Owner 승인·PR Head lease 규정 보존)
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: N/A(phase 기반 부분 구현은 Issue open을 유지하며 기존 lifecycle 규칙 변경 없음)
- `docs/IMPORT_EXPORT.md`: UPDATED
- `docs/SCHEDULING_ENGINE.md`: N/A(0036 migration 적용 목록과 Phase C 날짜·숫자 표시만 갱신하며 Working Calendar·의존성·기간·공수 산식과 Scheduling Engine 계약은 불변)
- `docs/IMPORT_SCHEMA.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/I18N_PHASE_B.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/I18N_PHASE_A.md`: UPDATED
- `docs/exec-plans/active/ISSUE_866.md`: UPDATED
- `docs/ISSUE_866_FAILURE_ANALYSIS.md`: UPDATED
- `src/features/resources/resource-search-filter.ts`: UPDATED
- `src/contracts/resource-dashboard.ts`: UPDATED
- `src/contracts/wbs-dashboard-views.ts`: UPDATED
- `src/contracts/logistics-dashboard.ts`: UPDATED
- `src/server/resources/resource-dashboard-service-core.ts`: UPDATED
- `tests/features/resources/resource-search-filter.test.ts`: UPDATED
- `tests/server/projects/project-issues.test.ts`: UPDATED
- `tests/server/calendars/country-calendar-integration.test.ts`: UPDATED
- `src/app/layout.tsx`: UPDATED
- `src/app/globals.css`: UPDATED
- `src/components/workspace-shell.tsx`: UPDATED
- `src/components/workspace-navigation.tsx`: UPDATED
- `src/lib/date-display.ts`: UPDATED
- `src/lib/i18n/index.ts`: UPDATED
- `src/lib/i18n/locales.ts`: UPDATED
- `src/lib/i18n/store.ts`: UPDATED
- `src/lib/i18n/provider.tsx`: UPDATED
- `src/lib/i18n/locale-selector.tsx`: UPDATED
- `src/lib/i18n/catalogs/core.ts`: UPDATED
- `src/lib/i18n/catalogs/shell.ts`: UPDATED
- `src/features/gantt/svar-locales.ts`: UPDATED
- `src/features/gantt/project-gantt.tsx`: UPDATED
- `src/features/gantt/svar-gantt.tsx`: UPDATED
- `tests/lib/i18n-phase-a.test.ts`: UPDATED
- `tests/e2e/issue-866-language-shell.spec.ts`: UPDATED
- `tests/e2e/project-workspace-layout.spec.ts`: UPDATED(REWORK2 native Gantt en-US/ko-KR header contract)
- `tests/config/playwright.config.ts`: UPDATED
- `tests/config/e2e-shard-plan.json`: UPDATED
- `tests/config/transport.config.ts`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED

- `docs/I18N_PHASE_C.md`: UPDATED
- `docs/GANTT_STATE_CONSISTENCY.md`: UPDATED
- `docs/GANTT_STATE_CONFORMANCE.md`: UPDATED
- `docs/EXCEL_EXPORT.md`: UPDATED

## AC_TEST_COVERAGE

A+B Full #3520.1 Required3 SUCCESS는 시작 Head만 증명한다. Phase C를 추가한 새 exact Head의 공식 전체 회귀는 NOT TESTED이며 로컬 증거/미검증은 별도 기록한다.

- AC01: Phase A registry/store/provider, Phase A/C Unit 및 language-shell/i18n E2E가 ko/en/vi·browser/storage·reload/invalid/denied 및 SSR 후 전환을 검증한다.
- AC02: Project·Issue·TaskEditor·Resource·Milestone·Logistics·관리/Calendar의 고정 UI/ARIA/help, opaque 사용자 텍스트 경계와 catalog literal coverage를 Phase C에서 구현했다. locale별 화면 검증과 기존 회귀는 최종 실행 절 참조, 새 전체 원격 결과 NOT TESTED.
- AC03: SVAR 2.7.3 Locale 및 GSC lease 기반 재초기화 복구, 최신 Task/필터/열·split·선택·펼침·Day/Week/scroll/초안/쓰기0을 adapter Unit와 실제 native locale E2E로 검증한다.
- AC04: Phase B migration0036/12 owner/DTO 저장·조회·수동번역·원문 fallback, Phase C Equipment/System/legacy Process editor 입력 및 managed-name 표시를 기존 SQLite/HTTP Unit와 관리자/공정/물류 E2E로 연결한다.
- AC05: 기존 global admin/Project edit·Origin/If-Match CAS·격리·401/412/stale/uncertain 저장 잠금 유지, locale에 의한 mutation0 및 dirty draft 보존을 기존 B008 및 Phase C 회귀로 검증한다.
- AC06: migration0035→0036·Project Copy·Template6 번역 보존·일정 JSON/Excel409 손실 방어·Import1.0/1.1 strict schema 기존 테스트 유지. 운영 backup/restore·Windows Excel 별도 NOT TESTED.
- AC07: date-only UTC/Intl 표시 및 숫자·공수·비율 현지화 Unit/화면 검증. 날짜 input/ISO/시간대·일정 산식·ID/revision/year 문자열은 유지하며 새 원격 전체 결과 NOT TESTED.
- AC08: 3언어·긴 Vietnamese·5폭/기존 density와 focus/keyboard·Escape/원래 Gantt 상태 보존을 기존 i18n-master-data/layout 및 신규 i18n E2E로 검증한다. 실제 screen reader/native125%/최종 수동UX는 NOT TESTED.
- AC09: Test Lifecycle ADD/EXTEND/KEEP_UNIQUE와 146개 spec·8-shard 단일배치·원래 정책 원문 보존. 전체 실패 원장/변경영향선정·최종 동결 Local Fast Feedback을 남기며 새 Required3·Trusted/Owner gate는 별도다.

## IMPLEMENTATION_HANDOFF

- 현재 단계의 끝점은 기존 PR #879의 Phase A+B+C 통합 코드·테스트·문서 게시 및 **새 Full PR CI 시작 확인**까지다. 시작 뒤 CI 결과를 모니터링하지 않는다. exact Head Required3/Trusted·독립 인간 QA/Owner HIGH 위험 수용·Manager ACCEPT는 NOT TESTED이며 `release_authorized=false`, MERGE_READY=BLOCKED를 유지한다. 병합·Main/GHCR/Finalizer·정식 release·Issue 종료는 이 요청에 포함되지 않는다.

## REWORK1 — PR #878 Full #3507.1 Vitest E2E shard-count 테스트 동기화 (2026-11-05)

- **원본** [Run 41921474942.1](https://github.com/planner77/masterGantt/actions/runs/41921474942), Head `ccf39510441a447d3df8f9f85ee3c9b1e22008ce`, Base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, Unit Job `126895162188`: `tests/scripts/e2e-shard-planner.test.ts:107` 기대 `[19,18,18,18,17,18,17,18]` vs 실제 `[19,18,18,18,18,18,17,18]`. **직접 TEST_CONTRACT 실패 1건**, Vitest 3527 PASS/1 FAIL/3 SKIPPED, 기존 i18n 6 Unit PASS. Policy/Typecheck/Lint/Preflight PASS, Fast Gate/Required3·QA 파생 FAIL, Chromium8/Docker/Next build 실제 실행은 SKIPPED. 상세 [누적 원장](../../ISSUE_866_FAILURE_ANALYSIS.md).
- **보완** `tests/scripts/e2e-shard-planner.test.ts`의 기존 count assertion은 유지하고 Shard5의 신규 파일 1개만 17→18로 정확히 변경, `issue-866-language-shell.spec.ts`→Shard5 매핑을 **추가 검증**. 테스트 삭제·skip·hash fallback·shard 이동·retry/timeout 완화 없이 144개 spec 1:1 배치/과거 143개 보존. `tests/config/e2e-shard-plan.json`의 원본 불변.
- **TEST_LIFECYCLE_REVIEW**: 기존 `tests/scripts/e2e-shard-planner.test.ts`를 EXTEND; `scripts/e2e-shard-planner.mjs`, `tests/config/e2e-shard-plan.json`, 나머지 Gantt/E2E/Locale 6 Unit/Date6/CI tests는 KEEP_UNIQUE. 직접 영향/인접/음성 소비자 합집합과 미실행 범위는 원장 기재. 새 정확 HEAD Full PR CI 전 원격 검증 NOT TESTED.
- **DOCUMENTATION_SYNC 추가:** `tests/scripts/e2e-shard-planner.test.ts`: UPDATED. 실패 원장 및 Work Packet, `docs/TEST_PLAN.md`는 UPDATED 유지. 기존 Issue AC01~09와 미구현 Phase B/C 경계, `release_authorized=false` 보존.
## REWORK2 — PR #878 Full #3508.1 native Grid en-US 헤더 검증 계약 교정 (2026-11-05)

- **원본 실행:** [Full #3508.1 / Run 41924914789](https://github.com/planner77/masterGantt/actions/runs/41924914789), HEAD `cd3f0c57953a0bd50a0ac74c0303211e08b20e68`, base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `6eef294a77b93b30dd0d90184a51b44035a8d014`. Shard4 Job `126908178973`의 `tests/e2e/project-workspace-layout.spec.ts:83` **en-US** 사례가 Gantt native Grid 헤더 `외부 ID`를 찾다 FAIL(번역 후 실제 `External ID`, 5s). ko-KR 같은 spec PASS, shard4 33 PASS/1 FAIL/59 미실행. Shard7 SUCCESS, 1/2/3/5/6/8 취소; QA·Required E2E 파생 FAIL, Quality·Docker·Vitest 3528 PASS. GitCommitInfo fetch 3초 경고는 이어지는 33 PASS와 직접 UI assertion 실패를 고려할 때 비차단 진단 메시지다.
- **원인:** 기존 E2E는 `en-US`로 강제한 날짜·고정 헤더 검증에서도 SVAR native 헤더만 `외부 ID` 한국어를 고정 기대했다. Phase A `SVAR_LOCALES.en.gantt["외부 ID"]="External ID"`가 정상 적용되면서 기존 테스트만 낡은 **TEST_CONTRACT**가 됨. Custom Column Menu checkbox `외부 ID`는 Phase C 이전 미번역이므로 Gantt 원본 텍스트와 독립적이다.
- **보완/수용:** `tests/e2e/project-workspace-layout.spec.ts`를 **EXTEND**해 ko-KR→`외부 ID`, en-US→`External ID` 정확한 헤더·잘못된 언어 부재 및 `<html lang>`를 단언. 기존 Column Menu checkbox 원문·날짜/스크롤/Project 설정·헤더 고정/동일 Gantt instance/API/선택/60 rows·문서 overflow/JS 에러·Escape/focus 검사 삭제 없음. `tests/lib/i18n-phase-a.test.ts` SVAR native 3언어 표시명 단언을 **EXTEND**해 ko/en/vi 사용 여부를 스펙에 고정. 필요 테스트·CI skip/timeout/retry/8-Shard 스케줄/제품 코드/DB/API는 불변.
- **전체 실패 원장:** [#866 누적 원장](../../ISSUE_866_FAILURE_ANALYSIS.md) `FULL-001`(샤드 숫자 회귀, 이번 #3508.1 Vitest 성공으로 재검증) 및 `FULL-002`(영어 Grid UI 원문 기대 실패) 모두 보존. 다른 취소 샤드, Phase B/C 검증은 **NOT TESTED**.
- **TEST_LIFECYCLE_REVIEW:** 기존 E2E `project-workspace-layout` 및 i18n Vitest를 EXTEND; `issue-866-language-shell.spec.ts`, `tests/lib/date-display.test.ts`, SVAR locale provider, 144개 Shard plan, 기존 권한·Gantt·Project/SQLite 테스트는 KEEP_UNIQUE. 단언 완화·제품 기능 롤백 금지.
- **DOCUMENTATION_SYNC:** `tests/e2e/project-workspace-layout.spec.ts`: UPDATED; `tests/lib/i18n-phase-a.test.ts`: UPDATED(기존); `docs/I18N_PHASE_A.md`: UPDATED, `docs/TEST_PLAN.md`: UPDATED, `docs/REMOTE_VALIDATION.md`: UPDATED, 원장/본 Work Packet: UPDATED. 나머지는 앞의 N/A/UPDATED 사유 그대로. AC03(번역 native Gantt)/AC07(날짜)/AC08(레이아웃) 테스트를 직접 보강했지만 #866 Phase B/C 미구현은 여전함.
- **승인/검증 경계:** 로컬 TS/Vitest/Playwright/SQLite/Docker 실행은 이번 교정에서 **NOT TESTED**; 새 정확 HEAD Full Quality/E2E8/Docker/Trusted 성공·Main strict·Owner 위험 수용 전 병합 금지. `HIGH/OWNER_MANAGED`, `release_required=true`, `release_authorized=false`, Version 후보 `0.142.0`/Issue #866 OPEN 유지.


## REWORK-B008 — PR #879 전체 실패 이력 기반 통합 보완 (2026-11-05)

### 기준·실제 역할·승인 경계

- Primary Issue #866, PR #879, 원격 작업 브랜치 `feat/issue-866-i18n-phase-b-owner-data` 재사용. 별도 로컬 worktree `/home/planner/Dev/masterGantt-879`, 작업 시작 Head `a7cbef53bd0c89f4f3a7a3c3ed5a76ba7cb2266e`, main/base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, 원본 #3519 test-merge `dbe1ffcb15791c997a974c3bf55479298c8495a0`.
- Manager: 누적 원장·영향 선정·문서·최종 검증/게시. 실제 별도 infra Agent: 전체 Run/Attempt/취소 로그 read-only 분석. frontend Agent: 지정 UI/기존 테스트 보완. ui_ux Agent: 생성/설정 공유 선택·검색 밀도 계약 read-only 검토. 별도 qa_docs의 사전 검토는 Owner 최종 승인이나 인간 독립 QA가 아니다.
- `HIGH / OWNER_MANAGED / qa_required=true`, 후보 0.142.0 유지, `release_required=true / release_authorized=false`. 승인 범위는 보완 후 기존 PR의 새 Full CI 시작까지다. `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`, #866 OPEN. CI 모니터링·병합·Main/GHCR/Finalizer/Release·Issue 종료는 수행하지 않는다.

### 누적 이력·가설 및 확정 원인

- PR #879의 CI #3510~#3519는 Full 8회와 metadata 2회(#3511 CANCELLED, #3512 FULL_FAILED), 모두 attempt 1이다. B001~B007과 선행 #878 FULL-001/002 및 #870 원본 원장 전체를 대조한다. #3519 취소된 shard7에도 실제 assertion FAIL이 있으므로 취소를 오류 없음으로 분류하지 않는다.
- 1순위 검색 CSS 누락 가설: 물류 목록 검색 입력은 `.addRow`/`.dialog` 밖에 있어 높이20px이다. 기존 #454 원본에서 로컬 RED로 확인했다. 번역 입력은 이미44px이므로 공유 번역 CSS 자체가 원인이라는 가설은 기각한다. 원본 #870 F866-TOUCH-006 교정이 Phase B 분리 때 빠진 재발이다.
- 2순위 공용 선택 소비 누락 가설: 생성·설정 공유 `ProjectMasterSelectFields`가 option 및 동명 비교에서 `item.name`만 사용한다. 실제 i18n-master-data 원본에서도 번역 저장 성공 후 영어 선택지가 원문인 RED를 확인했다. 데이터 쓰기 실패와 locale 선택 실패는 해당 재현의 원인이 아니다.
- 검색은 전용 `searchField`를 기존 40px fine/44px coarse token에 연결한다. 로컬 i18n 진단에서 추가 노출된 영어 상태/사용 건수의 행56.5px은 가시 단위를 Projects/Dự án으로 간결하게 표시하고 전체 설명 title을 유지해 교정한다. 영어 category tabs의 문서398px overflow는 header/tab flex child의 min-width:0·최대폭으로 내부 스크롤 소유권을 복구한다. 표시·버튼을 숨기거나 행/overflow 단언을 완화하지 않는다. 선택기는 `displayName(item, locale)`를 표시와 동명 판정에 함께 사용한다. ID/code·상위/하위 관계·비활성 기존 선택·자유 입력·revision/권한·DB/API는 불변이다. 동일 원인의 직접/간접 소비자를 함께 검증한다.

### 변경 영향·선정·비용 범위

| 수정 또는 이전 실패 계약 | 직접·간접·음성 소비자 | 선정한 실제 검증 | 제외·미검증 경계 |
| --- | --- | --- | --- |
| 물류 목록 검색 높이·번역 검색 | 장비/시스템 두 유형, fine/coarse, 5폭, focus·이름/활성/401/412 | `logistics-table-density.spec.ts`, `logistics-type-catalog-admin.spec.ts`, `admin-auth-layout.spec.ts` | 다른 관리자 전역 control 밀도는 변경하지 않음 |
| 공용 기준정보 선택 표시·동명 | 생성+설정, ko/en/vi·원문 fallback·선택 ID/하위 관계·기존 비활성 선택·초안 | 선택기 Unit, `i18n-master-data.spec.ts`, `project-master-relations.spec.ts`, `project-create-layout.spec.ts`, `new-project-draft-preservation.spec.ts` | 관계 편집기 등 전수 고정문구 번역은 Phase C |
| #878 샤드 수·영어 native Grid 헤더 | Phase A 언어 선택/storage/date-only/SVAR·전체 샤드 등록 | shard planner/i18n/date Unit, `project-workspace-layout.spec.ts`, `issue-866-language-shell.spec.ts` | 나머지 전체 Gantt 편집/스크롤은 기존 Full8에서 재검증 |
| #879 B004/B006 타입·검색·0036 migration | DTO·SQLite owner별 데이터/권한·Copy/Template/Export 및 Calendar/Issue 기대 | TypeScript 및 전체 Vitest 한 번 | 운영 DB 백업/복원과 Windows Excel은 NOT TESTED |
| #879 B007 및 B008 마스터 표·다국어 폭/밀도·번역 draft 경합 | 390/1440·fine/coarse·keyboard/Escape·401/412/stale·동시 쓰기 | `cross-screen-regression.spec.ts`, `i18n-master-data.spec.ts`, `resource-catalog-delete.spec.ts`, `logistics-type-catalog-admin.spec.ts` | 원격 취소 샤드 전체 PASS를 주장하지 않음 |
| #870 원본 관리자/공정/물류/Milestone 실패 | 실제 현 Main API·공정문맥·Task dialog·조회 권한/빈값·달력 | `country-calendar-admin.spec.ts`, `issue-725-process-workareas.spec.ts`, `issue-726-task-logistics.spec.ts`, `issue-732-milestone-dashboard.spec.ts` | 이전 #865 LLM/#869 코드 혼합 금지. transport/production-transport는 해당 Docker 환경 및 새 원격 Docker에서 검증 |
| Preflight base·정규 DOC_SYNC·metadata | main 대상·현재 필수12문서·AC01~09·전체 정책 원문 | base의 기존 `docs_gate` 구조 검사, Markdown link 및 버전/탐색/정책 검사 | GitHub 원격 귀속·Trusted/Owner는 로컬 구조 PASS로 대체하지 않음 |

로컬 진단은 기존 15개 Chromium spec, worker1/retries0/max-failures0, 최대20분의 한정 범위로 시작한다. 추가 실패가 있으면 원인별 보완 후 영향받은 집합을 같은 최종 source에서 재검증한다. 전체 Vitest/TypeScript/lint/build는 한 번 수행하고, 필요 없는 전체 로컬 Chromium/Docker 반복은 하지 않는다. 자동 Pre-PR의 UNKNOWN 매핑은 그대로 기록하고 정책/선정기를 완화하지 않는다. 수동 매핑·실제 명령·source 지문과 최종 결과는 누적 원장의 B008 검증 절에 기록한다.

### TEST_LIFECYCLE_REVIEW / DOCUMENTATION_SYNC 추가

- EXTEND: `tests/e2e/logistics-table-density.spec.ts`, `tests/features/projects/project-master-select-fields.test.ts`. `tests/e2e/i18n-master-data.spec.ts`는 KEEP_UNIQUE(기존 실제HTTP/SQLite·3언어×5폭·coarse·focus 단언이 새 오류도 탐지함). 기존 테스트의 실제 consumer seam에서 재현·번역명 충돌/원문 fallback·ID 보존·search geometry를 추가한다. 새 spec/샤드 이동/RETIRE/SKIP·retry/timeout 완화 없음.
- KEEP_UNIQUE: 전체 실패 파일 합집합과 위 15개 인접/음성 spec, migration/SQLite·HTTP·locale/SVAR·권한·Copy/Template/Export 기존 Unit. `docs/TEST_PLAN.md` 전체 정책 원문 보존.
- UPDATED: `DESIGN.md`, `docs/UI_UX_GUIDELINES.md`, `docs/PROJECT_UX.md`, `docs/TEST_PLAN.md`, `docs/REMOTE_VALIDATION.md`, `docs/I18N_PHASE_B.md`, 본 Work Packet 및 단일 실패 원장. 제품 파일은 물류 유형 UI/CSS, 생성·설정 공유 선택기 및 마스터 표 사용량 표시·header/tabs CSS다. 기존 테스트 실제 변경 범위는 최종 검증 절에 기록한다.
- N/A(이번 보완 자체): API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE/IMPORT_SCHEMA/IMPORT_EXPORT는 저장·권한·일정·교환 계약 변경 없음. 기존 PR 전체의 정규 DOCUMENTATION_SYNC UPDATED/N/A 및 AC_TEST_COVERAGE를 유지한다. CI workflow/Required3/Trusted/Ruleset/Runner/캐시·릴리스 정책, AGENTS.md는 변경하지 않는다.


### B008 동결 검증·미검증 인계

- 소스 동결: 코드/테스트/설정1283파일 SHA256 `b0b631baa30f9c6455908a71ae66b0d62f201bc3a7aae682bc472746d075e371`. 생성된 Next 설정·추적 캡처는 별도 보존 후 원본 복구하고 최종 fingerprint를 다시 비교한다. 문서 결과 기록과 제품/test source를 구별한다.
- 로컬 정적/Unit/build: TypeScript PASS, lint exit0(기존18warning/0error), Vitest3541 PASS/3기존SKIP·293files PASS/1기존SKIP(117.09초), production build와 runtime-tools PASS. 로컬 QA fixture11개 PASS, cache contract·버전·테스트 탐색 PASS. 베이스 validator의 정규 DOC_SYNC12문서 및 AC01~09 매핑은 STRUCTURAL_PASS, 의미 검토는 별도 Agent 사전 검토로 확인한다.
- `verify:prepr --mode=fast`는 UNKNOWN37/missing0으로 BLOCKED/sourceStable=true. 자동 매핑 공백은 유지하고 본 Work Packet의 수동 생산자→소비자 매핑에 따른 실제 검증을 별도 수행한다. 이 도구 BLOCKED를 PASS로 바꾸거나 원격 Gate를 완화하지 않는다.
- 기존15개 E2E 파일65계획 사례의 한정 실행 결과, 최종 source 비교·문서 링크 재검사와 실제 게시 증거는 아래 최종 결과 절에 추가한다. Playwright1.63.0 고정 Chromium headless-shell revision1243/browser153.0.8010.12, workers1/retries0/max-failures0. 최초 진단의 이전source PASS는 최종 결과에 합산하지 않는다.
- 실제 별도 frontend/infra/ui_ux/backend/qa_docs Agent가 구현·분석·읽기 전용 사전검토를 담당했다. Agent 정적 사전검토 PASS는 독립 인간 QA가 아니며 `independent_qa=N/A(Owner-managed, 독립 인간 검토 없음)`이다. 신규 원격 Required3/Trusted 결과 및 Owner/Manager 최종 ACCEPT는 NOT TESTED/MERGE_READY=BLOCKED다. Phase C·운영 backup/restore·Windows Excel·Main/GHCR/Release는 미검증이다.


### B008 추가 원격 목록 대조 — 원장 누락 #3475

#870의 실제 branch 목록은 Full8회(#3468~#3475)이고 #878는CI3회(#3507~#3509), PR #879는CI10회다. 모든 attempt1이며21회 실행 목록과 직접 실패 증거는 원장/정제 JSON에 연결한다. 원장 마지막 기록 뒤 #3475의 `master-controls-density`(신규 번역 입력에도 기존 padding8px/40px 기대) 및 `project-multi-task-copy-paste`(기술 키 Delete의 오역) 실패2개를 발견했다. 현재 Copy/Paste 키는 main과 같아 재발 검증만 추가하고, #455는 기존 원본 입력 검증을 유지한 채 번역3개44px/6px8px·추가Tab stop의 정확 테스트 계약을 보완한다.

기존15spec 진단을 중간 결과로 보존하고 **17spec 최종 동결 source**에서 전체 합집합을 재검증한다. 추가17spec 한정 실행도 worker1/retries0/max-failures0, 시간 상한20분이다. 같은 source의 정적/Unit 및 필요한 build를 갱신하고 이전 source PASS를 최종에 합산하지 않는다. `tests/e2e/master-controls-density.spec.ts`는 EXTEND, `project-multi-task-copy-paste.spec.ts`는 KEEP_UNIQUE다. 과거 production-transport는 원격 Docker 환경의 별도 검증으로 남긴다.


### B008 첫 확대 진단의 추가 오류와 테스트 계약 보완

첫15spec은61PASS/3FAIL/1기존SKIP(8.9분)이다. #454 412→GET200에서는 원인/번역 stale 경고2개를 단일alert로 조회했고, GET500 뒤 목록 재조회 성공시 오래된 초안의 저장을 허용한다고 기대했다. B002의 고정revision 정책에 맞게 초안·원인·추가 PATCH0·저장잠금 유지 후 명시 취소/재편집/사용자 재입력에서만 최신revision 저장을 검증한다. Resource Group stale 경고는 전역 Next route announcer와 구분해 해당 편집기 범위로 조회한다. 제품 경합 보호나 role=alert를 제거하지 않는다.

`tests/e2e/resource-catalog-delete.spec.ts`도 EXTEND한다. 초기65계획 진단의 PASS를 최종 결과로 승계하지 않고 이 보완과 #455를 포함한 새 source17spec/88계획 사례에서 재검증한다. 처음 소스의 b0b631b... 지문은 중간 진단용으로 보존하고 최종 지문은 별도 기록한다.


### B008 최종 소스 동결과 로컬 환경 예외

- 최종 코드/테스트/설정1283파일 SHA256 `4ffddace573d3504b165c2212fc52f1dc177e045df849ce3709479ce0e75d068`. 제품5파일·기존 테스트4파일만 B008에서 보완하며 최종17spec/88계획 Chromium 시작 전 원본설정으로 복구한 실제 파일의 변경 경로0개를 확인했다. 중간 b0b631b...는 이전15spec 진단의 지문이다.
- 최종 전체 Vitest3541 PASS/3기존SKIP·293files PASS/1기존SKIP(84.99초), production build/runtime-tools PASS, 원본 Next 설정 복구 후 TypeScript PASS. 최종 Chromium과 lint 및 source 종료 비교는 결과 확인 후 추가한다.
- 로컬 생성물 정리의 첫 스크립트가 Git 한글 경로 quoting을 일반 줄 단위로 처리해 중단됐다. NUL 구분 경로로 수정해 보존·복구했고 제품/test source 손상은 없다. 캡처 이동과 동시에 실행한 lint 한 번은 해당 이동 파일 ENOENT로 exit2였으므로 환경/정리 경합으로 별도 기록한다. 정리가 끝난 뒤 같은 제품/test source에서 lint를 재실행하며 해당 실패를 삭제하거나 제품 PASS로 소급하지 않는다.
- Next가 자동 생성한 next-env/tsconfig 추가 include와 추적 캡처는 원본 bytes로 복구해 게시하지 않는다. 최초/최종의 지문 비교는 생성물 보존 뒤 수행하며 raw trace/실행DB는 Git에 추가하지 않는다.


전체 작업 폴더 lint의 두 번째 실행은 로컬 빌드 산출물 `.next-prepr-final` 및 격리 Next 출력까지 탐색해 생성 코드에 대한 비정상적인 검사 범위를 만들었으므로 종료했다. CI/ESLint 설정을 바꾸지 않고 fresh checkout의 Git 추적 TS/JS 전체 파일을 동일 ESLint 설정으로 명시 전달해 재검증한다. 새 미추적 코드 파일은 없으며 새 JSON 증거 외 모든 제품/test 변경은 기존 추적 파일이다. 생성 코드 제외는 원격 Required lint 범위나 정책 변경이 아니다. 해당 로컬 환경 예외와 최종 exit를 구분한다.


### 서버 재시작 이후 B008 재개

서버 재시작으로 최종 단일17spec 실행이 exit143으로 중단됐다. 실제 계획은 초기 수동 합산86이 아니라 **88개**이며 해당 실행은12개 관측 PASS 이후 종료됐으므로 전체 성공으로 계산하지 않는다. 원격 PR Head는 여전히 a7cbef53...이고 commit/Ref 게시·새 CI 시작은 아직 없음을 재조회했다. 종료된 로컬 서버를 재사용하지 않고 source1283파일의 최종4ffddace... 지문 변경0개를 확인했다.

재개 검증은 같은 동결 source와 workers1/retries0/max-failures0으로17파일 전체를4개 부분으로 나눠 완료 여부를 영속 기록한다. A는13개 관리/UI·locale/생성/설정 관련파일, B는#725/#726 두파일, C는#732, D는다중Copy/Paste다. 단일 실행의 미완료를 PASS로 삼거나 이전 source 결과를 합산하지 않는다. 각 부분의 source·명령·exit·고유case와 전체합계를 최종 정제보고서에 저장한다. 부품화는 로컬 재개/실행환경 관리이며 원격 CI의8샤드/Required3/timeout/retry/정책을 바꾸지 않는다.


### B008 최종 검증·게시 인계

- 최종 code/test/config1283파일 SHA256 `4ffddace573d3504b165c2212fc52f1dc177e045df849ce3709479ce0e75d068`, 생성물 복구 뒤 종료 비교 변경0개. 같은 source에서 A13파일66PASS/기존2SKIP(5.1분), B2파일6PASS(5.7분), C1파일4PASS(3.2분), D1파일10PASS(4.6분): 중복 없는17파일88계획 = **86 PASS / 0 FAIL / 기존 캡처용2 SKIP**다. 테스트 자체 timeout/retry/skip/원격8샤드 정책 변경은 없다. 서버 재시작 중단12개 관측 PASS 및 이전15spec 결과를 이 합계에 더하지 않는다.
- 최종 전체 Vitest3541PASS/3기존SKIP(84.99초), 원본설정 TypeScript PASS, production build/runtime-tools PASS. 같은 ESLint 설정의 fresh-checkout 추적 JS/TS1118파일은 exit0/기존18warning/0error다. 자동Pre-PR 매핑은 BLOCKED로 남기며 수동 영향선정/실제 진단과 구분한다. 정제 증거 `docs/evidence/issue-866/pr879-local-validation-20261105.json`, 원본 명령·trace는 ignored `.prepr-reports/pr879-final/`에 보존한다.
- 별도 Agent 정적 사전검토 PASS는 인간 독립 QA/Owner ACCEPT가 아니다. HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false, manager_decision=NOT TESTED/MERGE_READY=BLOCKED 유지. 새 Head Quality/E2E/Docker·Trusted 결과는 NOT TESTED이며 CI 시작만 확인한다. Phase C·운영 백업복원·Main/GHCR/Release·Issue 종료는 수행하지 않는다.
- Git CLI의 만료된 인증을 추출·재설정하지 않고 허용된 Git Data API 배치 게시(B)를 사용한다. committed clean local tree와 API 전체 tree/부모를 대조하고, 원격 expected Head·main을 재조회한 뒤 Ref를 한 번만 갱신한다. 실제 candidate Head/새 Full Run·Attempt·base/test-merge 및 캡처 링크는 PR/Primary Issue STATUS 댓글에 후행 기록한다. PR 제목/본문 STATUS 편집으로 metadata CI를 추가하지 않는다.

### Phase C 최종 검증·게시 인계 (2026-11-05)

- 최종 게시 code/test/config1317파일 SHA256 `186f48255deb484699c2fc4e0233be11fc798596d4e0e35f9a73d7239d437ca4`. 전체 실행 묶음의 최초 지문은 `10a1794407eb3d2a10ae784c8908c35095153a206d92159df3408dac26ecd811`이며 **전체 지문이 시작과 같다고 주장하지 않는다**. 마지막 차이는 `project-transfer-layout-491.spec.ts` 한 파일의 unknown500 oracle/검증 순서뿐이다. 나머지1316파일(제품·공용fixture/helper/config·Unit·다른24spec)은 바이트가 동일하고, 수정spec은 최종파일 전체8사례를 재실행했다. 다른spec이 이 모듈을 import하지 않는 것도 확인했다. 소비 입력 동일성 지문과 각 실행 명령·source/결과는 [정제 증거](../../evidence/issue-866/phasec-local-validation-20261105.json)에 보존한다.
- 고유 Chromium25파일158계획 = **156 PASS / 0 FAIL / 기존2 SKIP**. A14파일72PASS/2기존SKIP, B3파일10PASS, C의 변경 없는7파일66PASS와 수정 전송파일8PASS다. 원래 C73PASS/1FAIL 및 중간 전송7PASS/1FAIL은 원장에 보존하고 이 합계에 더하지 않는다. workers1/retries0/max-failures0, 각 묶음20분/수정파일10분 상한을 유지했다.
- 전체 Vitest **3658PASS/기존3SKIP**, 297filesPASS/1기존SKIP(145.67초). 최종 차이는 Unit에서 실행하지 않는 별도E2E assert뿐이고 제품·Unit/공용입력은 동일하다. 수정파일의 typecheck/lint/discovery를 별도 재검증했다. 원본 Next 설정으로 typecheck PASS, production build/runtime-tools PASS. 같은 ESLint설정1124개JS/TS대상0errors/기존18warnings+ignored파일안내1, 마지막수정파일lint PASS. 버전·테스트탐색(298Unit파일/880브라우저사례)·문서링크·CIcache계약·QAfixture11PASS.
- 자동 `verify:prepr --mode=fast`는 UNKNOWN94/missing0으로 **BLOCKED**를 유지한다. 이 보고서의 실행중sourceStable=true는 자동도구의 짧은 실행 구간에 한정하며 전체E2E 지문변경을 숨기는 근거가 아니다. 실제 수동 소비자 매핑·실행·입력동일성 증거와 자동선정PASS를 구별한다. 최종 `.prepr-reports/phasec/prepr-final/report.json` 및 SUMMARY를 별도 보존한다.
- 별도Agent 정적 기술 사전검토 PASS/남은P1·P2=0이며 독립인간QA/OwnerACCEPT가 아니다. 새Head Required3/Trusted·Manager판정은 NOT TESTED, MERGE_READY=BLOCKED, #866OPEN/release_authorized=false. Main/GHCR/Release·운영backup/restore·WindowsExcel·실제AT/native125%·최종수동UX는 미실행이다. Equipment/System 번역입력 omission/clear/stale의 전용브라우저 조합은 별도 미실행이며 공용helper/12-owner HTTP·SQLite/기존CRUD 결과와 구별한다.
- 실제 UI 캡처: [베트남어Gantt](../../evidence/issue-866/phasec-gantt-vi.png), [베트남어390px관리자](../../evidence/issue-866/phasec-master-vi-390.png). 캡처는 keyboard/CAS/상태보존 실행증거를 대체하지 않는다. root 기본worktree의 사용자 deploy/compose/output 변경은 건드리지 않았다. 현재worktree의 테스트 생성물만 별도보존 후 원본으로 복구했다.
- CLI write 인증 만료를 우회·재설정하지 않고 허용된 Git Data API의 blob/tree/commit 및 expectedHead3fb37d77e6b4e80ee1daedf1642b6cfee1c2913b lease로 한 번 게시한다. clean committed local tree와 API 전체tree/부모·최신main을 대조한 뒤 Ref를 갱신한다. 실제 candidateHead/base/test-merge/FullRun·Attempt는 PR/PrimaryIssue STATUS 댓글에 후행기록한다. 실제 PhaseC 통합 범위로 PR제목/본문은 한 번 교정하며 상태표시를 위한 반복편집은 하지 않는다.
