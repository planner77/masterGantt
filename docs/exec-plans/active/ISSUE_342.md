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
- `docs/CI_CD.md`: N/A(기존 Required3·8shard·Main/GHCR 및 CI 설정은 변경하지 않는다)
- `docs/REMOTE_VALIDATION.md`: N/A(로컬과 공식 원격 gate 분리·CI 시작 종료점의 기존 정책을 그대로 적용한다)
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
