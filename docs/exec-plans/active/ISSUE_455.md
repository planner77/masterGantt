# Issue #455 관리자 화면 개선 실행 계획

## Issue Work Packet

- Repository: planner77/masterGantt; Issue [#455](https://github.com/planner77/masterGantt/issues/455).
- Phase: DOCUMENTATION_SYNC / PRE_QA. 요청 종료점은 구현·문서 동기화·독립 사전 검토·원격 branch/PR 및 exact head pull_request / ci.yml 등록이다. CI 결과 모니터링은 수행하지 않는다.
- Baseline: `04b3047328bb338bace1990e18a434ae80b611db` (선행 #454 PR #478 / CI run `37408864316` 등록), 선행 후보 version `0.90.1`. 작업 branch `fix/issue-455-master-controls-density`, 후보 PATCH `0.90.2`. 선행 PR 등록 후 누적 후보에서 분기하며 최신 main의 독립 변경 보존 여부를 확인한다.
- release_required=true, release_authorized=false. 병합·main CI/GHCR·tag·정식 release·branch cleanup·Issue 종료는 이번 요청 범위 밖이다. quality/e2e/docker·공식 최종 QA/ACCEPT는 NOT TESTED다.

## 목표·인수 기준

인증 후 사업부/제품/사업장·법인 항목의 이름/code/order input 식별성과 추가·목록 열/행 밀도·header-firstrow 경계·action 정렬을 개선한다. #332 범주/필터·row별 편집·code/usage/비활성 참조 및 권한/revision 계약을 유지한다. 최신 main `56e2e54f88ab9124ec81c52e157161181ed6c337`은 선행 후보에 포함되어 있으며 준비 시 유지됐다.

- [ ] 사업부/제품/사업장·법인 모두에서 항목 추가 및 row의 이름/코드/정렬 input을 정상 상태에서 명확히 식별한다.
- [ ] computed border/background/padding/min-height/font/focus 상태를 측정하고 단지 input DOM 존재만으로 PASS하지 않는다.
- [ ] name/code/order와 submit, row 저장/상태 버튼의 정렬·최소 폭이 유지된다. 같은 행 동급 control의 top/height 차이는 1 CSS px 이내.
- [ ] 현재 범주/목록 header/body/추가 영역이 구분되며 불필요한 반복 제목/설명이 실제 목록 공간을 낭비하지 않는다.
- [ ] 단일행 row height의 before/after와 first-row/header 경계를 기록한다. 긴 내용은 clipping하지 않고 정해진 wrap/scroll 정책을 따른다.
- [ ] 0/1/다수 행, 긴 한글/영문/코드, active/inactive/used code, saving/error/401/412, category/filter 전환 및 빈 결과 검증.
- [ ] 390/768/1024/1440/1920px에서 table wrapper의 의도된 scroll 외 document overflow/neighbor control 침범이 없다.
- [ ] label/aria-describedby/aria-invalid, focus-visible, Enter submit, keyboard 범주 이동, dialog Escape/초점 복귀 유지.
- [ ] 인증/session/Origin/revision/If-Match/CRUD/비활성 참조 및 프로젝트 생성 선택지 회귀 없음.
- [ ] before/after browser evidence, relevant E2E, exact PR head CI, 문서 동기화.

## 소유권·단계·문서

- Manager: 이 Packet·PLAN.md·CHANGELOG.md, 버전/단계/승인, 공식 Issue 댓글(PLAN/STATUS/EXCEPTION).
- ui_ux stage_editor_design: read-only 설계·구현 비교. frontend stage_editor_impl: src/features/project-master/project-master-admin.tsx, project-master-admin.module.css, 전용 관련 E2E/fixture, PROJECT_UX.md, TEST_PLAN.md; production/test/fixture는 전용 범위만 수정하고 shared/global CSS/API/DB/auth/domain 변경은 제외한다.
- infra stage_dashboard_unit_tests: 승인된 branch/version 준비·allowlist commit·게시·PR·CI 등록. read-only 독립 QA stage_exchange_domain_review는 구현자와 분리한다. 실제 기존 실행자에 책임을 재배정하며 새 역할 모델 runtime을 실행했다고 주장하지 않는다.
- 여러 Agent가 같은 파일을 수정하지 않는다. 다른 작성자·원래 #464 branch/raw26·제외 자료를 보존한다. issue_comment_writer=manager; Sub-Agent는 remote 댓글 없이 Result Contract로 반환한다.
- DESIGN.md/UI_UX_GUIDELINES/PROJECT_UX/Next 설치 버전 guide를 따른다. 글로벌 관리자 native table이며 SVAR 내부 재구현이나 새 공통 framework는 필요하지 않다.
- 최초 실제 before와 동일 fixture/viewport after를 390/768/1024/1440/1920px로 검증한다. 실제 row/control top·height·padding·column/header alignment·document/table overflow와 keyboard/focus를 기록한다. 강제 row 높이로 긴 내용이나 control을 자르지 않는다. 기존 소스 검토·분리 CSS 실험을 실제 before로 사용하지 않는다.
- 100% 실제 browser 필수. native125% 가능하면 실행하고 불가 사유와 NOT TESTED를 기록한다. DSF/CSS zoom/viewport로 대체하지 않는다. mock browser와 실제 서버 authorization/운영 검증은 구분한다.
- source/fixture 수정 전 owned Next를 종료하고 generated next-env/tsconfig를 복원한다. freeze 후 관련 최소 LFF만 수행하며 실패/원인/조치/재검증과 재사용 근거를 보존한다. 전체 회귀는 PR CI에 맡긴다.
- Required docs: PROJECT_UX/TEST_PLAN/이 Packet/PLAN/CHANGELOG. 계약 변경 없는 API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/CI_CD/REMOTE_VALIDATION 및 기존 DESIGN 기준 재사용은 N/A 근거로 기록한다.
- DOCUMENTATION_SYNC → 독립 UI/사전 QA → Manager PR_READY → explicit allowlist 게시 → published head/tree/parent/files 독립 동등성 → Refs #455 PR → exact head CI 등록 확인. 등록 사실과 PASS를 혼동하지 않는다.
- 게시 자료는 비밀 제거 PNG/geometry/env explicit allowlist만. 실제 DB/cookie/session/password/raw trace/log/test report는 제외한다.

## 검증·다음 handoff

Branch/version 준비 PASS. Issue open/본문 동일/기존 구현PR 없음(감사458만 존재), version check0.90.2 PASS. 동일 의존성의 선행 실제 node_modules 복사, staged diff0, 제품 무수정. PLAN comment `6008714039`. 실제 before·설계·구현·LFF·독립검토·게시/CI는 아직 NOT TESTED. → 설계 → read-only 설계 → frontend before·구현·관련 LFF·문서 → 독립 검토 순서다.

## 초안 정책 범위 결정

- source에서 itemActions CSS 정의 누락을 확인했다. category/filter 전환은 drafts[id] 및 공통 생성 입력을 유지하므로 이번 AC로 실제 검증하고 새 dirty 확인 흐름을 추가하지 않는다. 현재 category가 생성 대상이며 전환 후 이 의미를 목록/추가 영역 제목·label로 분명히 한다.
- 기존 applyCatalog는 저장/새로고침/412 최신 GET의 canonical 재적용 때 다른 dirty row도 덮는다. Manager는 이 더 넓은 draft merge/revision 로직을 이번 밀도 개선에서 변경하지 않고 DEFER/후속검토 위험으로 기록하기로 결정했다. 모든 동작의 초안 보존을 주장하지 않는다. 기존 row별 편집 안내는 이 정책에 맞게 짧게 보완할 수 있다.
- 실제 fixture는 name200/code64/order0..1000000 및 UUID 등 해당 API 상한을 먼저 검증하고 원래 #454의65자 synthetic 오류를 반복하지 않는다.

## 승인 설계

Manager가 `/tmp/issue455-uiux-design.md`를 승인했다. 초기 table 최소960px는 이름 flexible/min240 + 코드192 + 정렬120 + 상태/사용216 + 작업192px이며 실제 intrinsic으로 조정한다. 생성/행 input과 action40px·td block padding3px로 짧은 행 약47px를 목표로 하되 row 높이를 고정하거나 긴 내용을 자르지 않는다. 입력의 실제 border/background/padding/font/focus/disabled/error, header-firstrow 경계·column/control 정렬을 검증한다. 누락 itemActions를 정의하고 중복 제목을 축약한다.

used code의 visible 이유·aria-describedby와 확인된 입력 오류의 aria-invalid/오류 연결을 보강한다. category 추가 대상이 제목/label에 명확히 나타나며 canonical 재조회 때 다른 미저장 입력이 초기화되는 기존 정책 안내를 남긴다. 새 dirty flow/draft merge/API/auth/shared/global 변경은 없다. 실제 Tab 초점이 부분적으로 가리면 owned table의 필요한 가로 delta만 보정하는 접근성 보강을 승인하며 테스트 강제 scroll로 PASS를 대신하지 않는다.

## 실제 before

- 최초 before `76506` / `ch43c7c1`:1 PASS(6.7초), 대표 PNG7·geometry/environment JSON21=28개 확보.1440px 짧은 행57px, 추가 input은 border0/background transparent/padding0/min-height auto/font16px·line-height24px로 실제 측정했다. CSS 존재만으로 식별성 PASS를 주장하지 않는다.
- owned Next 종료·generated2 복원·freeze4 drift0. 제품 수정 전에 name200/usage12345/unused0 등 유효 경계 fixture를 완성하고 before만1회 갱신한다. 최종 before/after는 동일 최종dataset을 사용하며 최초 결과는 별도 이력이다. 기존 더 넓은 draft 초기화 로직은 변경하지 않는다.

- 최종 유효fixture12행(3범주)은 name200/code64/order1000000/usage12345를 포함한다. 갱신 before `51732`:1 PASS(6.7초), owned Next 종료·generated2 복원·baseline source hash 불변을 확인했다. 이전9행의 최초before와 구분하고 최종 비교는12행 dataset을 사용한다.

## 초기 focus REWORK

첫 after `55446` / `chab1a09`:1 FAIL/18 미실행.390px table/row/input/Tab 접근 검사 뒤 비밀번호 dialog의 초기 focus가 FAIL했다. 원본 trace를 보존하고 owned Next 종료·generated2 복원·source5 freeze 불변을 확인했다. Manager는 owned 비밀번호 input/form의 native autofocus attribute/ref로 초기 focus를 보강하도록 승인했다. 공통 WorkspaceDialog/API/새 흐름은 변경하지 않고 sourcefreeze 후 실패·미실행 관련 검증을 이어간다. 부분 PASS를 전체 PASS로 보고하지 않는다.

- 2차 `40983` / `ch1beb06`도 초기 focus1 FAIL/18 미실행. owned effect만으로 native showModal 순서를 해결하지 못한 이력을 보존한다. input ref의 native autofocus attribute를 연결한3차 `34563` / `ch44bd01`는3범주×5폭 geometry 및 범주/필터·생성/저장/활성의2 PASS를 확보했다. 짧은 행 모두47px, table960/1344/1552px, document overflow0이다.
- 3차의 다음 오류 case1 FAIL/16 미실행은 Next route announcer까지 잡은 alert selector strict 오류다. 원본 근거를 보존하고 main 내부 실제 오류로 selector를 한정해 실패1+미실행16을 검증한다. 이 harness 보강은 제품 source를 변경하지 않는다. 부분2 PASS를 전체 PASS로 보고하지 않는다.

## 최종 관련 검증·문서 동기화

- `87943` / `ch1b8046`:18 PASS(15.1초). 마지막 geometry top/실제 오류 computed·loading 재검증 `13519` / `ch99c70b`:2 PASS(7.3초). 고유 after19개(기존7+전용12), PASS실행22회(2+18+2, 중복3)를 구분한다. 단일 최종 전체19개 실행이 아니며 native autofocus 수정 후 source가 같은 after3~5 결과를 영향 분석으로 재사용했다.
- 최종 typecheck `87435` / `che49845`, scoped lint `85195` / `chc5cb5c`(경고0), version `chfb1dd8`0.90.2, Markdown `che85b16`123파일, diff `chc3370f` 모두 PASS. owned Next 종료·generated2 정확 복원·source/test/fixture5 drift0(`che54c15`/`ch8b7502`). 최초 focus2회와 announcer harness 실패 원본3개는 별도 raw에 보존하고 게시하지 않는다.
- 입력 normal/focus/disabled/field-error와 동기 pending 보호·비밀번호 native autofocus/반복 Escape/취소/초점 복원을 검증했다.412 뒤 최신 GET 실패 원인을 유지하는 owned UI 보강은 API나 canonical 적용 정책을 변경하지 않는다.
- 유효12행 동일 before/after: 짧은 행57→47px, input/action40px, top/header-body 차이≤1px, document overflow0, table 최소960px 및1440/1920px 가용1344/1552px. before28+after32=60개 PNG/JSON(env 포함), owned7파일과 별도 root3/version2를 결합해 게시 후보72파일로 검토한다. Header는 준비된0.90.2이며 before 제품 source04b304와 application 전체 byte 동등성을 혼동하지 않는다.
- PROJECT_UX/TEST_PLAN 및 Manager Packet/PLAN/CHANGELOG 동기화 PASS. API/DB/auth/domain/Scheduling/CI/배포/공유 CSS·WorkspaceDialog·SVAR/Import/Export 계약 무변경으로 영향 N/A다. 실측환경 en-US/Asia/Seoul/Chromium153.0.8010.12/기본100%; native125%는 headless browser chrome 제어 부재로 NOT TESTED이며 DSF/CSS로 대체하지 않는다. Fresh npm ci는 동일 의존성 복사로 재실행하지 않았다. 실제 기기·screen reader·전체 서버/원격 CI·공식 최종 QA/ACCEPT는 별도 미검증이다.
- 다음: 동결72 manifest → 독립 UI/사전 QA → Manager PR_READY → remote exacthead/tree/부모/파일 동등성 → Refs #455 PR → CI 등록. 기존 canonical 갱신의 다른row 초안 초기화는 후속 DEFER 위험으로 남긴다.

## 게시 직전 main 통합·후보 갱신

- main이 `56e2e54f88ab9124ec81c52e157161181ed6c337`에서 `1e531d29bf7c822cc0239ae815cd691abc0bf25e`로13commit 이동했다. version0.86.0/제품/dependencies는 그대로이고6개 릴리스 운영파일·문서가 변경됐다. 기존 후보와 중첩은 CHANGELOG/TEST_PLAN2개다. Issue EXCEPTION `6008945182`에 재개 지점을 기록했다.
- 로컬 준비commit `f3c42dcc9af27ba35d5667310e40d8dbbbc6e729`를 만든 뒤 exact main1e를 통합했다. TEST_PLAN append 충돌은 양쪽 원문을 모두 보존해 해결했고 기존453/454/455 절과 새main 기록을 유지했다. 기존72파일 중 이2문서 제외70파일 byte 불변, 나머지main4 운영파일은1e exact blob, version0.90.2 유지다.
- 최종 통합 중간local HEAD `61a046678494fc1e7fbef57189da9cccc7ae4059`, tree `c89a191693da22f18f69cf253f163880bdb44405`, 부모 순서는 `[04b3047328bb338bace1990e18a434ae80b611db,1e531d29bf7c822cc0239ae815cd691abc0bf25e]`다. 누적feature ancestry와 최신main을 모두 보존하며 원격main을 병합한 것이 아니다. 이 HEAD는 마지막 문서 갱신 전 로컬 중간후보로서 최종 게시 SHA가 아니다.
- 원격쓰기0, tracked/stageddiff0 및 원래#464/raw26·453/454 보존 확인. 관련19 unique/22 PASS LFF는 제품/tests/60증거 byte불변으로 재사용하고 새browser/전체로컬회귀를 반복하지 않는다. 기존main의 운영 검증 기록은 이번 LFF/원격CI 결과와 구분한다. 문서context·Markdown/diff/version·새76파일 manifest·독립delta검토를 갱신한 뒤 게시한다.
- 현재 게시 계약: 선행누적04b와 최신main1e 두 부모, old72 feature경로+main4 운영경로=76 explicit allowlist. 이전72 snapshot UI/PRE_QA PASS는 그 snapshot에 한정하고 새후보에는 delta검토 결과를 사용한다. quality/e2e/docker·공식최종ACCEPT는 NOT TESTED이며 결과 모니터링은 수행하지 않는다.

## 2026-10-06 latest main 재정렬 / 병합 단계

기존 published head `7f9cfb87e4e56bba9eff444d74a0559bcb80b89d`의 PR CI Run `37411553451`은 SUCCESS였으나 최신 main `0fc986cb0cb642bdbedeec30157b27bd522b5a38` 대비 diverged/dirty가 되어 병합 근거로 재사용하지 않는다. #455 고유 변경을 최신 main 위에 재적용하고 CHANGELOG/PROJECT_UX/TEST_PLAN/active PLAN 충돌은 최신 main의 후속 기록을 보존하는 방향으로 해소한다.

새 exact-head PR CI가 성공한 경우에만 PR #481을 병합하고 merge push의 Main CI 시작을 확인한다. 이번 사용자 요청은 Main CI 시작까지이며 GHCR 게시, Generic/Release Finalizer, tag/release, Issue close, branch cleanup은 별도 단계다.

## 2026-10-06 Main CI #1947.1 실패 보완

PR #481 병합 commit `528ebfffa639a275ea4349a04860f5b3785e50e9`의 Main CI Run `37435545662`은 `Main 임시 commit 이미지 게시·검증·정리`에서 실패했다. image build/push, policy, readiness, SQLite/API persistence는 성공했고 production transport browser 검증에서 HTTP test hostname 첫 navigation이 `ERR_NAME_NOT_RESOLVED`로 실패했다. script의 hosts 등록 및 HTTP/HTTPS curl readiness는 성공한 상태였다.

Corrective branch `fix/issue-455-main-ci-transport-dns`는 Playwright Chromium에 두 test domain만 loopback resolver rule로 고정한다. browser URL/Host/TLS hostname과 실제 Nginx·CA 검증은 유지한다. corrective PR CI 성공 후 병합하여 새 Main CI 시작을 확인하며, 새 Main transport smoke가 최종 판정이다.

