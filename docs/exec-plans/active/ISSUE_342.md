# Issue #342 — 국가 Calendar Catalog 재구성

## Work Packet

- Issue: https://github.com/planner77/masterGantt/issues/342
- 요청 종료점: 분석·설계·구현·DOCUMENTATION_SYNC·미해결 리뷰/충돌 해결·실패 원장 작성 후 새 PR Full CI 시작. CI 결과 모니터링은 수행하지 않는다.
- baseline: main `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14`, application `0.138.5`. 초기 Issue PLAN 댓글의0.138.4 표기는 실제 baseline 재조회로 정정한다.
- branch: `feat/issue-342-country-catalog-current`; worktree: `/home/planner/Dev/masterGantt-worktrees/issue-342-current`.
- 기존 PR #346 / old head `297ae4ff1c1c016727c7814c5d689fb9acd202bf`는 직접 병합하지 않는다. 최신 Issue 지시에 따라 새 PR로 현재 main에 필요한 국가 Catalog 모듈만 재구성한다. 기존 실패/리뷰 이력은 보존한다.
- version: MINOR `0.139.0` (하위 호환 관리자 기능·지원 연도 추가). release_required=true, release_authorized=false. 병합/Main/GHCR/tag/Issue 종료는 이번 승인 범위 밖이다.
- risk_level: HIGH; risk_reason: 전역 Calendar Catalog와 SQLite migration·관리자 mutation·향후 Project materialization 변경. qa_required=true; qa_method=AGENT.
- 실제 역할: root Manager=설계·문서/원장·버전·통합, backend=contracts/server/repository/migration0035·Unit/API, frontend=page/features/navigation·E2E, ui_design=read-only 설계, research=공식 원자료 read-only 대조, infra=과거CI 감사·원격 게시, qa_docs=별도 read-only 사전 검토.
- issue_comment_writer=Manager; infra의 별도 Issue 댓글 쓰기는 허용하지 않는다.
- 파일 소유권: server/contracts/migration/backend tests는backend; UI/E2E는frontend; 모든docs/package/lock/CHANGELOG는Manager. 동일 파일 동시 쓰기 금지.

## 설계

builtin+DB override를 선택한다. DB-only 전환 없이 현재2026 자료와 검증된 US2027~2030·TH2027 자료를 사용할 수 있고, 운영 수정은 별도 override로 관리한다.84슬롯 중12 OFFICIAL/72 UNAVAILABLE이며 관리 가능과 공식 자료 확보를 구별한다. UNAVAILABLE/SUPERSEDED override는 builtin을 차단한다. runtime 외부 API를 호출하지 않는다.

migration0035는 catalog state/dataset/date만 추가한다. 기존 Project/Task/revision·권한 row는 수정하지 않는다. Project Preview/Save만 최신 effective OFFICIAL을 materialize하며 Preview의 catalog revision을 Save에서 검증한다. 기본 Project 생성은 effective KR가 없으면 월~금 주간 규칙으로 생성한다. 비공식 override를 builtin fallback으로 우회하지 않는다.

JSON/CSV는 전체 연도 교체이며 merge/partial skip은 없다. Preview는 DB write0, Apply는 검토한 원문·format·대상·catalog revision·session·만료에 묶인 token을 재검증하고 transaction으로 저장한다. 실제 날짜 수정은 출처를 무효화하고 동일 변경은no-op이다. 상세 한도·오류는 API 계약을 따른다.

UI는 현재4개 전역 메뉴를 보존하고 기준정보에서 국가 캘린더로 이동한다. compact toolbar·metadata·data table과 별도Preview/확인·날짜 모달을 제공한다. dirty/pending/401/412·역순 응답·stale 파일·오류/초점 계약은 PROJECT_UX의 #342 절을 따른다. SVAR API/renderer 변경은 없으므로 신규 Core/PRO API 조사는N/A다.

## DOCUMENTATION_SYNC

- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/SCHEDULING_ENGINE.md`: UPDATED
- `docs/ISSUE_57_WORK_CALENDAR.md`: UPDATED
- `docs/COUNTRY_CALENDAR_DATA.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/ISSUE_342_FAILURE_ANALYSIS.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(기존 light/system font/token·Product Terminology와 table 원칙을 그대로 적용한다)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Project 교환 기능은 유지하며 국가 Catalog 별도 계약을 API와 전용 운영 문서에 명시한다)
- `docs/IMPORT_SCHEMA.md`: N/A(Project JSON1.0/1.1·VBA 교환 schema는 변경하지 않으며 국가 JSON/CSV는 별도 계약이다)
- `docs/CI_CD.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(기존권한·canonical Refs·리뷰/충돌 처리 운영 계약을 변경하지 않는다)
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH/AGENT와 보호 경로의 별도 인간승인·Manager gate를 완화하지 않는다)
- `AGENTS.md`: N/A(실행 지침·역할·권한 정책은 변경하지 않는다)
- `docs/DEPLOYMENT.md`: N/A(Docker/Compose·SQLite volume 경로는 유지하고 새 migration은 기존 loader로 적용한다)
- `docs/HTTP_OPERATION.md`: N/A(HTTP/HTTPS Origin·session·cookie 정책은 변경하지 않는다)
- `docs/VBA_EXPORT.md`: N/A(Excel DRM/VBA 및 기존 Task 교환 계약은 변경하지 않는다)

## AC_TEST_COVERAGE

- AC1: country-calendar-catalog.test.ts의7국가×12연도84슬롯·범위 검사.
- AC2: country-calendar-data.test.ts 및 catalog.test.ts의공식 연도/미확보·masking 검사.
- AC3: COUNTRY_CALENDAR_DATA.md의7국가 공식 source/획득·변환·검증/version 운영 절차와research 원표 대조.
- AC4: catalog.test.ts의metadata/source roundtrip·no-op·출처 무효화 검사.
- AC5: country-calendar-admin.spec.ts 실제 인증 JSON/CSV 파일 업로드 흐름.
- AC6: catalog/integration.test.ts의strict JSON/CSV·중복/null/date/quote·Preview binding/만료 및E2E diff 확인.
- AC7: catalog/integration.test.ts 및country-calendar-admin.spec.ts 실제date/sourceKey/metadata CRUD.
- AC8: country-calendar-data/catalog.test.ts의WORKING/NON_WORKING 보존·공식CN/VN 보충근무일 대조.
- AC9: integration.test.ts의중간삽입 실패·권한회수·revision 경쟁 rollback 및no-op 검사.
- AC10: integration.test.ts 및실제E2E의기존Project Calendar/Task/revision 불변 검사.
- AC11: integration.test.ts의FULL_PROJECT·Template·명시저장 및E2E Project Preview/Save/canonical 재조회.
- AC12: integration.test.ts의COUNTRY_CALENDAR_UNAVAILABLE 국가/연도 detail 및Project Calendar UI 오류 표시.
- AC13: country-calendar-admin.spec.ts의5viewport geometry·keyboard/Escape/focus·pending/dirty/401/412/response epoch 검사.
- AC14: DOCUMENTATION_SYNC의required docs 반영과Markdown link·독립 사전 검토.
- AC15: 아래실제Local Fast Feedback; 새Head quality/e2e/docker는PR CI 시작 시 NOT TESTED이며공식PASS/최종AC 완료로주장하지않는다.

## 검증과 인계

로컬 실행과 첫 실패는 [단일 실패 원장](../../ISSUE_342_FAILURE_ANALYSIS.md)에 누적한다. source 변경 후 해당영향 결과를 재검증하며 전체 회귀는GitHub Actions에서 수행한다. 사전 독립 코드 검토는QA_FINAL/인간Reviewer 영수증/Manager ACCEPT가 아니다. package/lock·보안정책 경로가 포함되어보호main 검증기는별도신뢰된인간Reviewer·원본Required3·Owner영수증이없으면정상적으로BLOCKED할수있다. 이번종료점은CI 시작이며이를우회하지않는다.

## TEST_LIFECYCLE_REVIEW

- 검색 범위: `tests/server/calendars/`, `tests/server/db/`, migration 관련 tests, `tests/e2e/*calendar*`, admin/modal·keyboard·geometry helper 및 과거 PR346 실제 실패 파일 합집합. 파일 이름만으로 중복을 판단하지 않고 실제 setup·mutation·assertion을 비교했다.
- ADD: country-calendar-catalog.test.ts / country-calendar-integration.test.ts / country-calendar-admin.spec.ts. 최신 main에는 운영용 국가 Catalog·Preview token·관리자 CRUD가 없어 기존 Project Calendar 테스트로 대체할 수 없다. 순수 parser/service 검증과 실제SQLite/HTTP/E2E 책임을 나눈다.
- EXTEND: country-calendar-data.test.ts는 미래 공식자료와 기존6국가2026 effective bytes 보존·VN2026 공식3행 정정, 기존migration tests는0035 count/order·upgrade/reopen, editor/resource E2E는Preview catalogRevision과명시적저장 계약만 보완한다. 기존음성/권한 검증을 삭제하지 않는다.
- KEEP_UNIQUE: 기존Scheduling/Copy/Template/Project권한·Resource우선순위 테스트는 고유 책임을 유지한다. Calendar 소스변경·materialized snapshot/기본Project 생성의간접소비자는backend16파일과선택브라우저로검증하고전체회귀는PR Required3에남긴다.
- 과거실패합집합·교차회귀: 원장의모든PR346 Run/Attempt와실제실패파일을기준으로country/admin·Project Calendar 외 notifications·repeated-input-accessibility·task-editor-form-density·workspace-header-version·settings 등현재main사례를선정한다. 과거실패를최신source PASS로덮어쓰지않고관측불가/취소/미실행을별도로기록한다.
- 자동선정: targeted dry-run은UNKNOWN6로BLOCKED/NOT TESTED이며41선정전체를실행한것이아니다. 수동대응은page/navigation→실제기준정보진입E2E, catalogwrapper/defaultseed→실제SQLite Project생성·Calendar, verifieddata→effective2026 golden+미래공식dataset, strictjson→catalog parser malformed/duplicate검사다. 선정기정책은수정하지않는다.
- 실행/미실행: VN 공식 정정 후 backend16파일210PASS, 별도qa_docs3파일55PASS(고유수에중복합산하지않음). 최종브라우저와source지문은원장에추가한다. 로컬전체Vitest/8shard/Docker·실제운영/native125%는NOT TESTED다.

## 공식 자료 정정 결정

초기7국가2026 원본보존계획은출처없는이식을막기위한방침이었다. 이후researcher·별도qa_docs가VN2026의Jan2휴무/Jan10보충근무/Nov24문화의날을정부원표와독립대조해누락을확인했다. Manager는이를17행/WORKING2개와새sourceVersion으로정정하도록결정했다. 나머지6국가2026 원본과VN기존14행은보존하고제안단계Nov23/Nov28은제외한다. VN14일로이미저장된Project가Catalog정정만으로변하지않고명시적Preview/Save뒤17행을채택하는실제SQLite회귀를추가한다. 최초208개PASS와정정후재실행은원장에서구분한다.

## 독립 사전 검토 및 원격 인계

별도 `/root/qa_docs`가 실제 코드·공식 원표·문서·실행 로그를 읽기 전용으로 비교해 **PRE_QA PASS**를 반환했다. 검토46개제품·테스트경로의 path+NUL+rawbytes 지문은 `bdf3e91cf5a2672ee093fa78d667bedae09f2f997c9dfe45a74e374f4fb12b21`이다. 서버210·독립55·브라우저고유30의실행별source한계와첫실패는원장에보존했다. 남은독립사전지적은없다. 이결과는보호경로의신뢰된인간Reviewer QA_FINAL/Owner영수증·Required3·최종Manager ACCEPT가아니다.

원격게시1단계는검토한tree/branch만생성한다. 그commit을인용해옛PR346미해결6개thread를실제해결하고원장에기록한뒤, 문서delta를게시하고새ReadyPR을생성해FullCI를시작한다. CI등록만확인하며진행/결과모니터링·병합·Main/GHCR·릴리스는진행하지않는다.

원격1단계153c58fb/tree1573e91b에교정소스를게시했고Manager가구PR346의6개미해결리뷰를실제답변·resolve했다(전체25/미해결0재조회). 구PR은병합하지않고대체CLOSED로전환했으며Issue342는OPEN이다. 현재main ce8ca4ec 직접기반/충돌파일0이다. 이결과를실패원장에기록한문서delta를게시한뒤새PR FullCI를시작한다. finalHead/PR/Run은Issue댓글에보존한다.

## REWORK 1 — PR864 Full3455 QA Preflight 선언 누락 (2026-10-31)

- 재개 기준: PR864/open/Ready, Head `cf9458c15bceb2dddadc3a40903feeede39707e8`, main/base `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14`, test-merge `978a89b2f4eda1c7501370c98909febe032a83f8`. 최신 main/Head는 그대로이며 충돌·미해결 스레드0이다.
- 원본 [Full3455.1](https://github.com/planner77/masterGantt/actions/runs/41169048995)은 QA Preflight의 `qa_required` 선언 누락으로 FAIL이다. `PATH_POLICY`와 후속 집계는 파생 실패이며 타입/Unit/build/Chromium/Docker는 **NOT RUN**이다. 제품 회귀가 실행돼 실패한 것으로 해석하지 않는다. Trusted1101의 원본CI미성공 사유도 별도로 구별한다.
- 원인: 이전 게시에서 PR 본문에 `risk_level`·`qa_method`만 선언하고 필수 독립행 `qa_required: true`를 빠뜨렸다. 문서/AC 구조 검사만 확인하고 실제 Preflight 전체 계약을 재생하지 않은 게시 준비 누락이다. Work Packet의 qa_required 문구가 PR 본문 선언을 대신하지 않는다.
- 최소 보완: PR 본문에 정확히1개 `qa_required: true`를 추가한다. 기존 HIGH/AGENT·독립 QA 의무·보호 validator·Required3·Origin/session/revision 및 release 권한은 바꾸지 않는다. 제품·테스트·CI코드 변경 근거가 없어 그대로 둔다. 버전0.139.0 유지, release_required=true/release_authorized=false.
- 실제 역할/소유권: Manager=분석·교정본문·Packet/TEST_PLAN/PLAN, infra=전체 원격 이력·원장12절·허용된 단일 API Ref 게시, 별도 qa_docs=read-only 독립 사전 검토. 본 REWORK에 backend/frontend 제품 수정을 배정하지 않는다. Issue 댓글 작성은 Manager다.
- 결정적 재현: 실제 연결 API로 읽은 PR/Issue/69파일 snapshot과 현재 Work Packet을 main의 `qa_preflight.check`에 재생한다. 교정전 QA_REQUIRED/PATH_POLICY2개 FAIL, 단일 선언 추가후 deterministic failure0/PASS이며 HIGH/AGENT·최종 gate DEFERRED를 보존한다. `/tmp/issue342-rework1-preflight-replay.py`와 log/json에 입력·결과를 보존한다. 이는 실제원격출처 인증/공식CI PASS가 아닌 로컬 데이터 재생이다. 단일 필드 누락을 직접 재현했으므로 추측성 제품 가설·임시제품계측·새회귀test 추가를 생략한다.

### TEST_LIFECYCLE_REVIEW — REWORK delta

- 검색: `scripts/qa_preflight.py`, `scripts/test_qa_preflight.py`, `scripts/test_qa_final_automated.py`, 원장의 모든 기존 실패11파일/8E2E 및 현재 PR diff69파일을 대조했다.
- KEEP_UNIQUE: 기존 Preflight11개는 필드 enum/중복·위험도·AGENT·경로·source·문서 검사를 소유한다. FinalQA37개는 독립승인·정확Head/base/원본CI·문서·미해결리뷰 계약을 소유한다. 현행 두 suite를 실제 실행해 총48개 PASS이며 새테스트/삭제/skip/단언완화는 없다.
- 기존 실패합집합/간접/음성: 이번 새 실패에 실제 테스트파일은0개다. 기존 11파일 합집합은 보존한다. 현재backend34/frontend12 파일hash가 이전 로컬 검증manifest와 전부 일치하고 runtime/fixture/의존성/설정도 그대로다. 따라서 기존210Unit/고유30브라우저 한정 증거는 해당동일제품bytes의 과거Local증거로 재사용하며 새Head의원격PASS로표시하지않는다. docs/PR본문만교정하는데제품E2E 전체를추가반복하지않는다. 원격Full8/Required3는새Head에서모두실행해야한다.
- 문서 영향: 본 Packet·단일 실패원장·TEST_PLAN·active PLAN UPDATED. API/DB/보안/UX/운영/버전·CI정책은 직전 구현계약과 동일하므로 추가수정 N/A다. 기존 DOCUMENTATION_SYNC/AC_TEST_COVERAGE는 그대로 유지하고 실제추가경로를 다시 검사한다.
- 게시: 실제본문계약 교정으로 `edited` 이벤트1회는 불가피하다. 모든 문서·본문·로컬검증·리뷰/충돌을 먼저 동결하고 API candidate commit/tree/부모를 검증한 뒤, 본문1회교정과 expected oldHead를 지정한 branch Ref1회갱신을 이어 수행한다. 이전Head의 metadata가새Head로SUPERSEDED될수있으며 이를Required3의PASS로사용하지않는다. Draft왕복/반복본문수정/정책우회 없이 같은PR864의 synchronize FullCI 등록만 확인하고 이후 모니터링하지 않는다.

REWORK1의별도 `/root/qa_docs` 독립PRE_QA는 **PASS**다. 원본Job124442902691직접로그·독립API본문/Issue AC15/69파일/원본Packet 재생·기존48개정책테스트·backend34/frontend12지문·4문서delta를직접대조했고추가지적없음이다. Manager48개와독립48개는같은suite이므로96개로합산하지않는다. 새Head 원격Required3/Trusted/인간QA_FINAL·Manager ACCEPT는NOT TESTED다.

실제targeted prepr는delta선정READY/0tests/UNKNOWN0이며실행명령없음으로NOT TESTED(exit1)였다. 해당보고서는 `.prepr-reports/2026-10-31T04-44-39.253Z-445246-f290704f`에보존하며PASS로주장하지않는다. 원격PR본문입력의검증은별도실제snapshot 전체재생과기존정책48개로보완했다. 자동선정기/CI를교정해무조건PASS로바꾸지않는다.

## REWORK 2 — Full3457의 신규 E2E spec 명시 등록 (2026-10-31)

- 기준: PR864 Ready/open, Head `fb93818a7decea0bfc92d131381f663bb5f10bda`, main/base `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14`, test-merge `95edd95818930c3df9e1816332f8c87fc253aa86`. 현재 충돌·미해결 리뷰0이다. 기존PR346/3455/3456 실패와후속workflow를원장전체에대조한다.
- 직접 원인: [Full3457.1](https://github.com/planner77/masterGantt/actions/runs/41170081603)의 QA Preflight는PASS이고 Vitest Job124446062488의현재spec명시계획검사만FAIL이다. 실제143개/명시142개로 신규 `tests/e2e/country-calendar-admin.spec.ts`가누락됐다. 원본3447PASS/1FAIL/3SKIP이며build/E2E/Docker는NOT RUN이다. 이전metadata누락과새계획등록누락을구별한다.
- 보완 소유권: infra는 `tests/config/e2e-shard-plan.json` 및 `tests/scripts/e2e-shard-planner.test.ts` 두파일과관련LFF, Manager는문서6개/버전판단·통합, 별도qa_docs는read-only 독립검토다. 같은파일동시쓰기는금지하고Issue댓글은Manager가작성한다.
- 설계: 기존142개위치·8shard/schemaVersion1을그대로보존하고신규파일을Shard1에1회명시한다. countvector는 `[19,18,18,18,17,18,17,18]`이며기존exactcoverage·중복0·기존destinationassert를유지하고country→1을추가한다. hash fallback으로명시누락검사를대체하거나제외·skip·timeout/retry·workers·concurrency/Required3·권한을변경하지않는다.
- 선택 근거: Manager는기존계획의historical projectedMs 최소Shard1=1265283ms로신규1개만등록하도록승인했다. qa_docs의파일수우선Shard5(17개/1265505ms)대안도검토했으나정확성blocker가아닌선택기준차이다. 222ms를실제성능차이/새143spec비용개선근거로쓰지않는다. historical generatedAt/sourceRunIds/metrics/모든projectedMs는보존하고신규비용은REMOTE_UNMEASURED다.
- 위험도/범위: 전체PR HIGH/AGENT/qa_required=true 유지. 이번delta는실행계획등록·기존테스트·문서이며제품/API/DB/Calendar자료/화면/의존성은변경하지않는다. application version0.139.0 유지; 원래기능release_required=true/release_authorized=false. 게시승인은같은PR의새FullCI시작까지만이며모니터링/병합/Main/GHCR/Issue종료를포함하지않는다.

### TEST_LIFECYCLE_REVIEW — REWORK2 delta

- 검색: 누적11실패파일합집합·신규실패 `tests/scripts/e2e-shard-planner.test.ts`와 `scripts/e2e-shard-planner.mjs`, 현행8shard JSON, `test-config-layout`·PR optimizer 및release-image reuse/ci_impact_plan의독자계획parser를대조했다.
- EXTEND: 기존planner의현재전체집합=명시전체집합·unique·8개CLI선택합집합·고정위치case에서countvector와country명시위치만정합화한다. 새testcase를중복추가하거나누락/중복assert를완화하지않는다. 기존누락을허용하는selectorfallback은그대로이지만이를명시계획완료의근거로쓰지않는다.
- KEEP_UNIQUE: config-layout/optimizer는workflow연동·test발견/비용제안을, release-reuse는실제8shard실행증거·이미지권한을, ci_impact_plan은신뢰된영향선정을각각소유한다. 독립소비자를통합·삭제하지않고누락·중복음성변형도거부돼야한다.
- 재현/확대: 원본기존planner6개에서5PASS/1FAIL을실제재현한뒤고쳤다. 같은plan의실제selectorCLI8회가합집합143/중복0/country→1·기존142위치불변이어야한다. root/external cwd의test발견도대조한다. 실제전체Unit실패였으므로동결source에서전체Vitest를1회수행해숨은Unit실패를확인한다. 원장의옛Unit실패파일도전체실행에포함된다.
- 브라우저/제품재사용: backend34/frontend12의기존지문이일치하고UI·fixture·runtime코드는변하지않는다. 이전E2E8파일/고유30의한정증거는동일제품bytes에재사용하며이번plan이원격8runner에서실제로성공했다는증거가아니다. 로컬전체브라우저/cleanDocker를추가반복하지않으며새Head Full8/Required3를필수로남긴다.
- DOCUMENTATION_SYNC delta: 본Packet·단일실패원장·TEST_PLAN·CI_CD·REMOTE_VALIDATION·active PLAN UPDATED. API/DB/보안/UX/공식자료·Release/배포계약추가변경은N/A다. 기존DOC_SYNC와AC1~15 mapping은유지하고실제새경로를재검증한다.
- 게시: PR본문필수선언은현재정확하므로단순Head/상태전달목적으로본문을다시수정하지않는다. 모든코드·문서·원장을동결·검토한후같은branch Ref1회갱신으로새synchronize FullCI를시작한다. 실제새Head/Run/Attempt는운영댓글에기록하고결과를모니터링하지않는다.


REWORK2 최종 Local Fast Feedback: planner/optimizer/config 기존3파일26PASS, 실제8selector143개정확1회/중복0, root/external cwd발견287Unit파일/867browsercase, 전체Vitest3448PASS/기존3SKIP(286파일PASS/1파일SKIP), 별도정책Python58PASS, typecheck/변경lint/version0.139.0/391Markdown링크/diff검사PASS다. 관련26개는3448개에포함되며qa_docs의독립26개·Python37개를동일suite에중복합산하지않는다. source2파일manifest는 `3eae929a6c662c231a018398c45e280d40b78f1994f4422976d78e554932a0f1`이고명령·source경계·최초오류는단일원장에보존한다.

별도 `/root/qa_docs`의REWORK2 독립PRE_QA는 **PASS**다. 원본3457로그·RED·수정2파일·과거142배치/history불변·selector8개·누락/중복음성·독자policy·실제전체Unit로그·6문서정합성을직접비교했고추가사전지적은없다. 기존AC1~14의로컬구현/관련증거는동일제품bytes범위에서재사용하며AC15의로컬Unit범위만새로보완했다. AC15의새Head Required3/Full8·Trusted/인간QA_FINAL·Manager ACCEPT는 **NOT TESTED**다.


## REWORK 3 — Full3458 관리자 인증 간격 회귀 (2026-10-31)

- 기준: PR864 Ready/open, Head `ee3a0f1404c1748b18455ad6234b4d948ced0121`, main/base `ce8ca4ec7f0eb2ba63d883b7c22786c5d033aa14`, test-merge `870d7d2e91287f88aefeb6153e5969a2c94157c3`. 재조회 시 충돌·미해결 리뷰0이다. 이전PR346/신규Full3455·3457/metadata3456 및보완결과를 단일원장1~13절과대조한다.
- 원본 [Full3458.1](https://github.com/planner77/masterGantt/actions/runs/41171285334)의직접실패는Shard1 Job124450161450 `admin-auth-layout.spec.ts:68`의master제목하단→인증카드 기대16px/실제56px다. quality124450562959/Docker124450898948는SUCCESS, E2E aggregate124450525405는파생FAIL이다. 나머지7Shard는CANCELLED이며로그내추가실제FAIL0을미완료PASS로해석하지않는다. 전체30Job은13SUCCESS/2FAIL/7CANCELLED/8SKIPPED다.
- 진단: 기존실패mastercase를수정없이실행해같은16→56 FAIL을재현했다. 국가링크를heading과인증카드사이독립row로추가해 gap16+row24+gap16=56이됐다. DESIGN/Project UX의16px계약은유효하며cardpadding16/cardgap12도통과해오래된테스트·인증패딩오류가설을기각했다. 분류PRODUCT/페이지통합회귀다. 이전metadata·8shard명시계획보완은이번실제Preflight/Vitest PASS로구별한다.
- 소유권: frontend는해당page/route-local CSS의heading내링크배치와직접관련기존E2E확장·정제화면증거·LFF, infra는전체원격이력·원장14절과승인후단일게시, Manager는Packet/TEST_PLAN/PROJECT_UX/PLAN·버전·통합,별도qa_docs는read-only사전독립검토를담당한다. Issue댓글은Manager다. 동일파일동시쓰기는금지한다.
- 범위: 기존4개global메뉴·국가관리진입을유지하고독립spacer를제거한다. 전역CSS/AdminAuth·인증권한/API/DB/Calendar자료·8shard/Required3·timeout/retry/skip/concurrency는변경하지않는다. 전체PR HIGH/AGENT/qa_required=true, version0.139.0·release_required=true/release_authorized=false유지다.

### TEST_LIFECYCLE_REVIEW — REWORK3 delta

- 검색/합집합: 과거12파일합집합에새실제실패 `tests/e2e/admin-auth-layout.spec.ts`를추가해13개로유지한다. 기존country/Project8E2E,3서버Unit,planner1개를빠뜨리지않고생산자→소비자를대조한다.
- EXTEND: 기존admin-auth-layout의mastercase에새링크heading내포함·정확href·keyboard/focus·비겹침을추가한다. 기존16px·5폭·인증실패/만료·중복제출assert는보존한다. 동일책임의별도test를추가하거나assert/timeout을완화하지않는다.
- KEEP_UNIQUE: resource/logistics/master의서로다른session·권한오류, master입력/CRUD·relations와기존버튼간격, country의실제SQLite/파일/권한·응답역전,globalheader/notifications의메뉴4개와hitarea,기존Gantt/상태/반복입력/폼밀도는각책임을유지한다.
- 검증선정: 기존실패8E2E의bounded26case에공통인증3case·master입력밀도/분류CRUD2case·관계1case·legacy버튼간격1case를더해33고유사례를선정한다. 국가6case는기존26에포함되며중복합산하지않는다. workers1/retries0/max-failures0으로실행해직접/간접/음성을수집한다. 390/768/1024/1440/1920px에서gap·overflow·링크와도움말·keyboard를확인한다. 고유수/실행별source·첫실패/재실행은원장14절에기록하며동일case중복을합산하지않는다.
- 미변경소비자: backend34/기존infra2파일의최종지문을재검사한다. 제품server/fixture/의존성/명시계획이같은범위에서기존210서버·3448Unit/26plannerPASS의로컬증거를재사용하며새Head원격RequiredPASS를주장하지않는다. bounded브라우저를수행하고전체로컬E2E/cleanDocker반복은하지않는다.
- DOCUMENTATION_SYNC delta: 본Packet·단일실패원장·TEST_PLAN·PROJECT_UX·active PLAN UPDATED. CI_CD/REMOTE_VALIDATION은REWORK2갱신유지이며이번workflow/원격증거계약추가변경N/A다. DESIGN/UI_UX는기존16px/token/interaction원칙을준수해추가변경N/A,API/DB/보안/공식자료/운영·Release계약도추가변경N/A다.
- 인계: 소스·문서·동결지문·별도PRE_QA·리뷰/충돌을확인한뒤같은PR/branch를한번갱신해새FullCI등록까지만수행한다. 정확한새Head/Run/Attempt는운영댓글에기록한다. PR본문진행상태편집·이전FAILrerun숨김은없다. 새Required3/Trusted/보호인간QA_FINAL·Owner/Manager ACCEPT는NOT TESTED이며모니터링·병합·Main/GHCR/Issue종료는진행하지않는다.


REWORK3 사전도구 dry-run은 **NOT TESTED/선정BLOCKED**다. `.prepr-reports/2026-10-31T06-09-07.047Z-651557-f2153b26`에selected2/UNKNOWN2(page.tsx·route CSS module)를보존한다. 자동선정기매핑미등록을이번제품수정으로완화하지않고위33개실제브라우저선정으로수동생산자→소비자를검증한다. dry-run은테스트실행PASS가아니며13파일합집합이도구12파일진단제약을넘어도전체논리범위를축소하지않는다. 새실제API snapshot+현재Packet/예정diff의main Preflight 로컬재생은결정FAIL0/PASS·최종DEFERRED5이며실제원격source/승인을실행한것이아니다. backend34/infra2파일은이전manifest SHA256와전부동일함을Manager가확인했다.


REWORK3 별도기하probe는5폭로그인전후 heading→card16px·H1위치보존·document overflow0과390px coarse44px를확인했다. 화면은[390px](../../evidence/issue342/rework3/master-auth-390.png)·[1440px](../../evidence/issue342/rework3/master-auth-1440.png),수치는[기하영수증](../../evidence/issue342/rework3/master-auth-geometry.json)이다. probe는합성인증/목록응답이며DB쓰기0·추가고유testcase0이고실제국가관리SQLite경로와구별한다. 390px는제목안자연줄바꿈으로카드y223→231(+8px),768px이상은223→183(-40px)다. 모든폭의세로높이가줄었다고일반화하지않는다.


REWORK3 최종브라우저는선정33고유사례 **33PASS/0FAIL**,5.1분이다(`/tmp/issue342-rework3-frontend-green.log`). 명령과source한계는원장14절에보존한다. 기존26·인증3·master인접4의합계이며별도기하probe를추가testcase로합산하지않는다. source4파일manifest SHA256 `04f5154af44010c3d114873b25431fe4547f4e1b647924dbcee115fa7b9e7447`가실행전후같고새CSS를명시포함한다. captureUi의trackedaggregate만으로새untrackedCSS까지결속됐다고주장하지않는다. Manager의기존backend34/frontend12/infra2+신규auth/CSS를합친50경로path+NUL+bytes 지문은 `8bed01fba9d00bdfe2773594d6291799ad01d7641a3e88428756e9d6815a41cb`다.

최종예정12파일을stage한뒤새CSS·정제증거를포함한PR예정78경로로main Preflight 로컬재생을다시수행해 **PASS/결정FAIL0/DEFERRED5**를확인했다(`/tmp/issue342-rework3-preflight-final.log`). 앞74경로는당시tracked후보의중간검사로만보존하며78경로검사와구별한다. 새Head원격source검증·Required/Trusted/인간QA_FINAL·Manager ACCEPT는계속NOT TESTED다.


최종clean-config `tsc --noEmit`·변경경로ESLint·diff는frontend의실제terminal exit0/PASS(session30675)다. 생성된tracked Issue455/456출력30개는 `/tmp/issue342-rework3-generated-output`에보존후기준Head bytes로복원했고next-env/tsconfig의dev생성차이도복원했다. 제품4경로지문은동일하다. 기하JSON의수동설명값만한글화한최종SHA256는 `c6af9f0d0eff472462ddd28f5b0fbb87ebd216098e0a9d56701032fb4f9d134b`이며수치/키/브라우저원문/제품지문·PNG는동일하다.


REWORK3 별도 `/root/qa_docs`의최종독립 Agent **PRE_QA PASS**를확인했다. 원본직접FAIL·취소7로그·기존원장98490bytes보존,동결33PASS/정적검사·혼합실제/합성검증범위·5폭기하·source4/전체50지문·최종78경로DOCSYNC/AC/391링크를직접대조했고남은사전지적은없다. 이판정은보호인간QA_FINAL/새Head Required3·Trusted/Owner/Manager ACCEPT가아니다. 최신main ce8ca4ec와기준Head ee3a0f14는유지되고Ready/open·mergeable=true·미해결thread0이며canonical Refs342/qa_required:true1개다. 검토한12파일(source4/docs5/evidence3)을같은branch Ref1회갱신으로게시해새FullCI를등록한다. 새Head/Run/attempt는Issue/PR운영댓글에연결하고결과는모니터링하지않는다. MERGE_READY는BLOCKED다.
