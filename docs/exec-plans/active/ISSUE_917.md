# Issue #917 — 설비 주 관리 공정 선택화

## 범위와 승인

- Issue: https://github.com/planner77/masterGantt/issues/917
- baseline/main: `1b8437fd199ff8f3bb2359ba7acc0d38f1ff67ca`, version `0.145.2`.
- branch/worktree: `feat/issue-917-optional-equipment-process`, `issue-917`.
- risk_level=HIGH: SQLite FK/table rebuild, nullable shared DTO, Copy/Template 복원.
- 요청 범위: 분석·설계·구현·로컬 검사·실패 원장·정식 GHCR 게시·수동 Issue 종료. 현재 대화의 Owner 명시 요청을 publish_authorized=true 및 동일 범위 종료 위임 근거로 기록한다. 운영 배포는 미요청이다.
- 현행 #905/#906 정책: 강화 로컬 검증→main 직접 fast-forward Push→고유 SHA 이미지 게시/digest smoke. PR/Actions/Trusted/Finalizer 신규 실행 N/A. 2026-11-13 live API: Actions enabled=false; main ruleset은 deletion/non_fast_forward만 존재하며 classic protection은404.
- 버전 결정: 신규 nullable 기능 MINOR `0.146.0` 예정. 정식 게시 범위는 기존 publisher가 지원하는 `sha-<full SHA>` 고유 태그이며 SemVer/rolling tag는 변경하지 않는다.

## REUSE_REVIEW

REUSE_DECISION=EXTEND. Owner가 작성한 #917 §3/§5의 기존 단일 Equipment editor·CRUD·DTO/서비스/Repository·WorkArea/Task/System·fixture/Playwright 우선 재사용 결정을 그대로 적용한다. 새 CRUD/별도 editor/가짜 공정·Target·Task는 만들지 않는다. `verify-prepr.mjs`, `publish-local-image.mjs`, #912 backup/restore를 재사용하고 이전 source PASS를 승계하지 않는다. 초기 작업공간의 기존 변경은 별도 worktree로 보존했다.

## 설계와 소유권

- Manager: 통합·Work Packet·원장/Regression Index·버전·문서·source admission·Push/publisher·종료. 다른 담당 파일은 소유자와 조정한다.
- backend: migration0039, DB runner 필요 변경, logistics DTO/parser/service/repository 및 server/logistics·db 테스트. Equipment processId는 `string|null`, create optional/null, patch omitted 보존/null 해제. WorkArea와 독립; legacy Target 충돌은409 원자 롤백.
- exchange: Project Copy/Template schema 저장·복원·교환 소비자 및 관련 server/projects/templates 테스트. 누락된 비null 참조는 명시 오류, null은 원본 보존; silent skip 금지.
- frontend: 기존 logistics editor/filter/i18n 및 nullable Resource/WBS 조회 소비자·transport·model와 관련 unit/Chromium 테스트. 미지정 기본·필터·ko/en/vi·5폭/keyboard·dirty/stale/readonly 유지.
- ui_ux/qa_docs: 별도 read-only 설계/정확 source 검토. 구현자 자체 검토를 독립 PASS로 기록하지 않는다.
- 공유 interface: `EquipmentDto.processId: string|null`, create/update `processId?: string|null`, WBS `primaryProcessId: string|null`. 파일 writer 중복 금지.

## TEST_LIFECYCLE_REVIEW / AC_TEST_COVERAGE

기존 logistics-service/handlers/repository/resource-roles/task-links/targets, project-copy-logistics/logistics-template-graph/project-excel-logistics, resource-dashboard/wbs-view-transport/model, project-logistics-management/issue-726/734/schedule-views/linked-view의 직접·인접·음성 회귀를 확장한다. 기존 case/assertion/retry/skip 삭제·완화 없음. 신규 migration/nullable 테스트는 기존 seam에 추가한다.

| AC | 직접 검사와 증거 계획 |
| --- | --- |
| AC1 | 공정0 unit/fleet HTTP CRUD→SQLite restart, Chromium 실제 저장/재조회, 자동 생성0 |
| AC2 | parser create omitted/null, patch omitted/null/empty; 지정/변경/해제/재지정, upgrade 원본 유지 |
| AC3 | WorkArea 타 공정/타 프로젝트, roles/System/Task 링크 유지·거부 |
| AC4 | 전체/미지정/특정 필터, Resource/WBS nullable transport·집계·root 보존 |
| AC5 | fresh/upgrade/FK check/restart/실패rollback·격리 backup/restore, Copy/Template/지원 교환 왕복 |
| AC6 | Origin/session/If-Match/revision·legacy Target 충돌·transaction/dirty/stale 회귀 |
| AC7 | Chromium390/768/1024/1440/1920·ko/en/vi·keyboard/focus/readonly; 합성 PNG/geometry는 testInfo.outputPath |
| AC8 | 전체 static+Unit/Integration+production build, 영향 Chromium, Docker/API/SQLite, 같은 최종 source admission·문서/원장 |

## 문서와 실행 계약

DB_SCHEMA/API/LOGISTICS_DOMAIN_DESIGN/PROJECT_UX/REQUIREMENTS/TEST_PLAN/Copy/Template/Import·Export/사용자 매뉴얼/CHANGELOG 영향 갱신. DESIGN은 공정 미선택 정상 원칙 준수; 상충 문구 확인 시만 수정. AGENTS는 정책 추가 없음(N/A).

작업 중 결과는 SCOPED이며 최종 clean commit의 `fast`/`targeted`/`docker`/`admit`를 같은 Node launcher·고정 baseline/환경에서 실행한다. 공통 source 검증 중 제품/fixture 수정 금지. 실패는 `docs/ISSUE_917_FAILURE_ANALYSIS.md`에 최초 결과 보존/후속 event append. unknown·필수 미검증·FAIL이면 Push/Publish/Close BLOCKED. #897 실제 Owner UAT/운영 환경은 합성 검사와 별도이며 자동 PASS 주장 금지.

초기 상태: PLAN / NOT IMPLEMENTED / NOT TESTED / NOT PUBLISHED / NOT DEPLOYED.


## 구현 freeze 전 상태 (2026-11-13)

LOCAL_IMPLEMENTED: migration0039/nullable CRUD, null-safe legacy Target409, 손상 비null참조409, 공정0/6관점/KPI·원본수량·provenance, 기존 editor/필터/i18n, Copy/Template7/명시 교환 loss guard를 구현했다. 신규 null Template만 v7을 생성하고 assigned-only는 기존 version 선택을 유지한다. API 오류·표시 문구와 교환 보고서의 `공정 미지정` 표시를 문서와 대조했다.

실제 독립 실행: backend_917(backend), exchange_917(worker Sol/High), frontend_917(worker Terra/Medium), frontend_state_tests_917(worker Terra/Medium), ui_design_917(read-only Terra/Medium), qa_917(read-only qa_docs), infra_readiness_917(infra). 실제 API/runtime에 요청한 역할/모델 설정이며 Manager 부모 모델의 별도 실측은 미확인이다. 여러 writer는 파일별 소유권을 분리했고 commit/Push/registry/Issue 쓰기는 Manager만 수행한다. qa_method=AGENT_LOCAL, independent_reviewer=/root/qa_917; 최종 exact-source QA는 아직 NOT TESTED.

SCOPED 결과: backend20파일175tests/마지막2파일16tests, exchange16파일144tests+graph직접24tests, migration인접6파일81tests, Resource17tests/KPI18tests, prepr-verifier50tests PASS. Chromium1test는공정0실제HTTP CRUD·전체/미지정/지정 필터·지정해제·ko/en/vi×390/768/1024/1440/1920·dialog/Tab/Escape/focus를검사했다. 추가상태2tests는412canonical/초안과legacy409, 기존유형1test는loading/error/readonly/nullableEscape를검사했다. fingerprint미수집dirtysource이므로최종검사로승계하지않는다. 원본실패·증거손실과합성AES CLI/0039격리복원은[원장](../../ISSUE_917_FAILURE_ANALYSIS.md)에기록했다.

최종 영향 계획: `selection.state=READY`, UNKNOWN0/missing0, Unit67파일/Chromium31파일(실행결과아님). 새 계약/UI/locale 및 target-project fixture17개 실제import소비자는기존selectImpact에정확매핑을추가했다. graph는실제exportedfunction직접왕복테스트로미발견소비자를해소했다. 매핑/검사강화이며UNKNOWN/필수gate/requiredchecks/workflow권한은완화하지않는다.

DOCUMENTATION_SYNC: API/DB_SCHEMA/LOGISTICS_DOMAIN_DESIGN/PROJECT_UX/REQUIREMENTS/TEST_PLAN/ISSUE_27_PROJECT_COPY/IMPORT_EXPORT/TARGET_RESOURCE_USER_GUIDE/CHANGELOG와로컬검증매핑관련LOCAL_PREPR/CI_CD/REMOTE_VALIDATION갱신. ARCHITECTURE/SECURITY/SCHEDULING_ENGINE/IMPORT_SCHEMA/DESIGN/AGENTS는기존계층·권한·일정/strictimport·공정미선택정상시각원칙을유지해N/A(새정책/권한변경없음). PLAN/실패원장/Regression Index를연결했고원장append-only/Markdown467파일검산PASS. 자동검산은업무/OwnerUAT승인이아니다.

남은필수: 좁은표관리버튼글자별wrap의최소보완과5폭실측, 최종cleancommit의fast/targeted/docker/admit·독립QA·최신mainfast-forward·정식고유SHA GHCR같은OCI게시/Pull·후보이미지격리복원runtime·FINAL/수동종료. 기존운영DB/서비스/설정에는접근·배포하지않았다. 실기기/nativezoom/보조공학·Owner수동UAT·offhost복원은자동검사와구분하고미검증을PASS로표시하지않는다.


## 시각 보완과 최종 source 준비

F917-018의 좁은 관리 버튼 줄바꿈을 기존 설비표 CSS 안에서 보완했다. 새 editor/별도 원장을 추가하지 않고 관리 셀 최소 폭·nowrap과 44px 버튼을 유지하며 기존 내부 가로 스크롤을 사용한다. 직접 15조합 검사1건35.7s PASS는 SCOPED다. 추가 선정된 기존 테스트들의 PNG/JSON 출력도 testInfo.outputPath로 이관해 과거 committed 캡처와 검증 source를 보존한다. assertion·skip·retry·timeout은 변경하지 않는다. 최종 계획은32개 Chromium 파일이며 같은 source의 실제 실행 완료 전 PASS로 판정하지 않는다.


구현/테스트/문서 writer가 모두 편집을 종료했다. 최종 선정은67개 Unit/Integration 파일과32개 Chromium 파일이며 UNKNOWN0/missing0이다. 공통 fast는 전체 발견 Unit/Integration과 production build를 별도로 실행한다. 기록용 최종 source commit 뒤 새 clean validation worktree를 만들고 같은 Node/PATH·고정 baseline으로 fast→targeted→docker→admit를 순차 수행한다. 실제 exact SHA·보고서·image/복원/게시 결과는 Issue STATUS/FINAL에 귀속하며, 이 준비 문구만으로 실행 성공이나 종료를 주장하지 않는다.


## AC1/AC4 직접 소비자 보강

754의 공통 Gate는9step/전체4009tests·production build PASS였으나 새 source의 성공으로 승계하지 않는다. 독립QA의 coverage 지적으로 기존 #917 실제 Chromium에 공정/WorkArea/Task/Target0의Unit1·Fleet7등록, 이름/코드검색·미지정필터·inactive, 실제Equipment Dashboard/일정View nullable원본렌더를추가했다. 기존150초timeout/권한/dirty·geometry검사를유지하며후속clean source로fast/targeted/docker/admit를다시수행한다. 직접추가실행1건44.1s PASS는SCOPED다.


## 최종 검증 재작업 — F917-020

a388의 fast02는 PASS였고 targeted02의67파일803Unit/32파일149Chromium은rawPASS였으나, 최종 snapshot에서 docs/evidence의390/1440PNG가변해전체targeted는BLOCKED였다. 원장/Issue EXCEPTION에보존했고기존ResourceDrillUI의출력두곳만testInfo로이관했다. AST보호호출101개는동일하다. 독립QA의69파일출력감사를추가했으며새HEAD의공통/영향전체/Docker/admit전Push/게시/종료를금지한다.

## UI_EVIDENCE_CONTRACT와 미수집 경계

| 범위 | 기준과 실제 수집 | 상태 경계 |
| --- | --- | --- |
| 선택 공정/미지정·등록/지정해제·검색/비활성 | DESIGN의공정미선택정상/이름우선, PROJECT_UX#917; 실제HTTP+canonical재조회·#917Chromium | rawassertion PASS와snapshot 최종판정분리 |
| 390/768/1024/1440/1920×ko/en/vi | 직접30PNG/30JSON;document=viewport,관리버튼4개44px/nowrap/동일행,행105.28125px,dialog/focus/내부scroll | 같은runner provenance·최종guard완료뒤direct증거로판정 |
| #896 canonical v2 manifest | 이#917 testcase는captureSyntheticUiEvidence helper/v2manifest를생성하지않음 | NOT TESTED,현행StageA advisory;사후재구성으로PASS를만들지않음 |
| Owner수동UAT/실기기/AT/native125%/production | 자동Chromium/합성PNG와다른환경 | NOT TESTED;운영배포는요청범위밖 |

원본149PASS는sourceauditBLOCKED를대체하지않는다. 최종새HEAD에서같은직접수용기준과출력불변을다시실행한다. 후속문서의실제source/receipt/게시·종료기록은코드이미지와문서전용commit을구분한다.


## 세션 복구와 새 검증 source

dbec의 fast03 4009PASS/3기존benchmarkSKIP·Docker03 10stepPASS·exactimage fresh91HTTP/복원/restartPASS는 역사 증거로 보존한다. R01 probe FAIL과 targeted03 중단/env drift는 F917-021/022에 append했다. 미완료 targeted03 67browserPASS/0관측FAIL은 wholeNOT TESTED이며 이전환경 report 재결합은 BLOCKED다. 새 원장 commit을 freeze한뒤 같은 실제 환경의 fast→docker→freshimage runtime→전체targeted→admit를 실행한다. private detached supervisor는 기존 CLI/선정/guard를 바꾸지 않고 child exit를 보존하는 임시 운영 도구다. 실제 별도 read-only qa_docs=/root/qa_resume917와 infra=/root/infra_resume917가 재개했으며 최종QA는 새완결증거 전 NOT TESTED다.


## fast04 준비 오류 후 재개

F917-023은 preserved interrupted snapshot 안의 생성JS를 root lint가 읽은 실제FAIL이다. 실행중 source/잔재를 바꾸지 않았으며 종료 뒤 snapshot전체를 밖으로 이관해56080개inventory bytes/hash 동일을확인했다. 원본report/log와별도relocationreceipt는보존한다. 새원장source의fast05/docker05/targeted05/admit05를같은controlled actualenv에서실행하며 이전04는PASS로전용하지않는다. 실제 CLI/선정/ignore/sourceguard는변경없다.


## 검증한 제품과 게시 결과

제품source `9d0e6b8b0d2f38ea4e287d09c21979e18dfa863b`,version0.146.0의공통9step/4009UnitPASS·기존opt-in3SKIP,영향67파일803Unit/32파일149ChromiumPASS·역사before1SKIP,source/env/snapshot불변,Docker10step/admitPASS를확인했다. 실제별도qa_resume917 제품QA PASS·미해결0과Manager게시범위ACCEPT후normalmainFF/exactremote/Actions0확인,29step정식게시/exactdigest Pull/API·SQLite restartPASS다.

태그 `ghcr.io/planner77/mastergantt:sha-9d0e6b8b0d2f38ea4e287d09c21979e18dfa863b`,index `sha256:0c60ffe02a98018abc1b81c5a147a1f2d0575804de7cd5cd25403bff164a7f78`,config `sha256:ad3cf2adb57e125c3fb73f2c191d39abc21a2486fe6232f55c67ed09ee17c281`. SBOM/provenance와동일OCI archive를보존했고rebuild0,실제runtimeR03의freshAES/0038→39/23steps91HTTP/73tables44rows보존/restart2/integrityFK/cleanupPASS는[단일원장](../../ISSUE_917_FAILURE_ANALYSIS.md)에연결했다. F024의Agent preflight환경BLOCKED도append했으며Nodechild/launcherexit·시각미수집을구분한다.

실제추가Agent는infra_resume917(별도runtime증거준비/검산·registry읽기),qa_resume917(read-only 독립제품QA/영수증/문서검토)이며Manager가mainPush/publisher만실행했다. 본후속docs-only의fast/admit/독립문서QA/mainFF/FINAL은아직완료전이며Issue종료를선기록하지않는다. 새문서는제품/테스트/빌드입력변경0이므로image/Chromium/Docker N/A이고제품artifact source는9d로유지한다. 운영배포/Owner수동UAT/실기기/nativezoom/AT/offhost는NOT TESTED·미요청범위그대로다.


## 완료 판정과 최종 기록

제품 AC1~7과 로컬 필수 gate, 실제 정식 GHCR 게시/exact digest smoke는 PASS이며 별도 qa_resume917의 제품·게시 QA도 PASS다. 보존 후검산의 원본 ONLY+1 BLOCKED(F025)는 그대로 두고, 기존494 tag names/선정9 full descriptor 보존과 app SHA1+동일 후보 attestation metadata1·graph17blob 일치를 별도 PASS로 기록했다. 미선정486 descriptor NOT TESTED와 metadata PUT actor UNKNOWN을 확대 해석하지 않는다. Reviewer 보조 조회 오류 F026도 최초 exit/교정/시각 미수집과 함께 단일 원장에 append했다.

본 후속 기록의 docs-only 공통 fast/admit·독립 문서 QA·normal main FF 및 최종 AC8/Issue 종료 판정은 Issue FINAL에서 해당 정확 Head에 연결한다. 제품·테스트·빌드 입력은 검증한9d 그대로이므로 새 image/Chromium/Docker는 N/A다. 별도 정식 Git/SemVer tag·rolling/latest 승격·운영 배포는 수행하지 않았다. 원격 작업 branch는 만들지 않았고 로컬 작업 branch 정리와 증거 보존 worktree의 실제 상태도 FINAL에서 구분한다.
