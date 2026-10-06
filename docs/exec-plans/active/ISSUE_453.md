# Issue #453 독립 리소스 탭 실행 계획

## Issue Work Packet

- Repository: planner77/masterGantt; Issue: [#453](https://github.com/planner77/masterGantt/issues/453).
- Lifecycle phase: PR #477 최신 main 충돌 해소 / 새 exact head PR CI 재검증. 최초 PR CI는 PASS였으나 current main 통합 후 새 head 결과를 공식 기준으로 사용한다.
- 현재 통합 baseline main: `d7316880732ecde5a8193764ac3b0cfca2ae455f`, application `0.87.1`. 최초 구현·before Source baseline은 `fd8fdc9e9207ab43a6fb7ff85b5a5acbe91d4553`이며 이전 `56e2e54f88ab9124ec81c52e157161181ed6c337` 재정렬은 역사적 검증 기록으로 유지한다.
- Branch: `feat/issue-453-resource-tabs`; worktree: `/home/planner/Dev/masterGantt-worktrees/issue-453`. 시작 시 기존 feature PR/원격 branch 없음.
- Version decision: MINOR `0.90.0`. 독립 탭·생성 dialog·프로필 명시 저장으로 사용자 작업 흐름이 추가되며 다른 미병합 후보 `0.87.0`/`0.88.0`/`0.89.0`을 재사용하지 않는다. package/lock은 infra가 반영했고 version check PASS다.
- release_required=true, release_authorized=false. 사용자 요청은 PR CI 시작까지만이며 정식 게시 승인이 아니다. merge/main CI/GHCR/tag/cleanup/Issue 종료는 이번 범위 밖이다.
- 순서: #453 CI 등록 → #454 → #455. 후속 구현은 선행 등록 전에 시작하지 않는다. 후속 branch는 승인된 누적 후보를 포함한다.

## 목표와 인수 기준

기존 동시 두 pane을 같은 카탈로그의 독립 리소스/리소스 그룹 탭으로 바꾸고 표시 중심 native table과 선택한 항목 하나의 편집 흐름을 제공한다. 글로벌 역할·개발자 등급·그룹 구성원은 별개이며 서버 세션/Origin/strong If-Match/revision/usage 삭제 guard 계약을 유지한다.

- [ ] 리소스·그룹을 독립 탭으로 탐색하고 active 목록이 full available width를 사용한다.
- [ ] 키보드 tab/arrow/Home/End, aria-selected/tab/tabpanel 연결, focus-visible, inactive panel focus 제외를 검증한다.
- [ ] 각 탭 검색·필터·스크롤과 dirty draft 처리 정책을 검증한다.
- [ ] 모든 resource row에 등급/역할 편집기와 표시 summary가 중복 상시 노출되지 않는다.
- [ ] 프로필/생성/그룹 구성원 관리에 keyboard로 접근·저장·취소·복귀할 수 있다.
- [ ] 0/1/3개 역할, 가장 긴 등급 label, active/inactive/delete-unavailable, 이름·코드 긴 한글/영문에서 column 침범/의도치 않은 document overflow가 없다.
- [ ] 390/768/1024/1440/1920px 동일 fixture의 before/after, pane/row/control bounding boxes, header/body 열 정렬을 기록한다.
- [ ] 100% zoom, 가능하면 실제 125% zoom 또는 미실행 사유를 기록한다. deviceScaleFactor를 browser zoom으로 보고하지 않는다.
- [ ] #426 footer/초안/역할·usage guard 회귀가 없고 관련 E2E와 exact head CI를 통과한다.
- [ ] DESIGN.md의 peer-view 기준과 PROJECT_UX/TEST_PLAN이 실제 구현과 일치한다.

인수 기준의 exact head 전체 CI 통과는 최종 ACCEPT gate이며 이번 사용자 요청 종료점에서 결과 NOT TESTED로 유지한다. 등록 사실만으로 통과를 주장하지 않는다.

## 승인 설계

Manager가 ui_ux의 `/tmp/issue453-uiux-design.md` 설계를 승인했다. 실제 구현과 증거는 별도로 검토한다.

- 기본 리소스 탭, mounted+hidden panel과 연결된 tab/tabpanel, ArrowLeft/Right·Home/End·Enter/Space 및 focus 복원. inactive panel은 접근성과 tab 순서에서 제외한다.
- 탭별 검색·상태 필터·스크롤·선택·구성원 초안을 보존한다. 탭 전환 GET/mutation 0. active 목록은 전체 가용 폭을 사용한다.
- Resource 열 최소 예산 976px(240/200/112/176/248), Group 800px(240/104/176/280); identity flexible, table 자체 scroll, 긴 값 전체 확인 경로. 역할0은 없음, 역할1/3은 기존 semantic badge wrap으로 안정 표시한다. 실제 geometry에 따라 증가 가능하다.
- 승인 설계의 profile revision context는 기존 PROJECT_UX 내부 Catalog Revision N 미표시 계약을 우선하여 정정한다. raw 번호를 화면에 노출하지 않고 최신 조회/수동 검토 안내로 표현하며 실제 If-Match/revision은 유지한다.
- 모든 행의 상시 등급/역할 편집기를 단일 profile dialog로 이동하고 두 값을 기존 PATCH로 함께 명시 저장한다. 입력 중 요청 0. 생성은 추가 버튼의 compact dialog로 분리한다.
- dirty 생성/profile 닫기·Escape·취소 및 다른 그룹 선택/구성원 닫기는 명시 폐기 확인. 탭 전환은 구성원 초안을 보존한다. footer 닫기 좌측/저장 우측 및 정렬 유지.
- 새 modal은 두 inline 생성 폼 동시 노출·배경 새로고침 조작을 제공하지 않는다. 기존 실패10개 사례의 초안/명시 재시도/자기 저장단위 성공만 초기화 보호는 유지하고, 다른 저장단위 보존은 group member dirty draft와 생성 실패/성공을 교차 검증한다. dialog 내부의 명시 최신 목록 조회는 기존 GET·pending guard를 재사용한다. Manager가 설계 보완을 승인했으며 오류 후 초안 자동 폐기/자동 mutation retry를 허용하지 않는다.
- 401은 로그인 focus·mutation 잠금, hidden modal trap 제외; 412는 최신 조회와 초안 보존 후 수동 검토/재저장; network/불명 응답은 성공 처리하지 않는다. 누락 ID를 조용히 필터해 저장하지 않는다.
- API/DB/공수/그룹 자동 구성/SVAR·Gantt/공통 primitive·global CSS 변경은 제외한다.

## 소유권과 위임

- Manager: PLAN.md, 이 Packet, CHANGELOG.md, 버전/단계/승인과 Issue 공식 댓글.
- frontend (`stage_editor_impl` 재사용): ResourceCatalogAdmin TSX/CSS와 해당 폴더 전용 UI helper, 관련 resource E2E와 전용 fixture, PROJECT_UX.md/TEST_PLAN.md/UI_UX_GUIDELINES.md의 관련 절. 다른 화면 구현·API/domain·공통 primitive·config·version·Git/connector 쓰기 금지.
- ui_ux (`stage_editor_design`): read-only 설계 및 구현/geometry 비교.
- 독립 QA: 구현하지 않은 read-only reviewer에 별도 Packet으로 배정한다. 자체 LFF는 독립 QA가 아니다.
- infra (`stage_dashboard_unit_tests` 실행에 운영 책임 재배정): 승인된 branch/version 준비와 이후 explicit allowlist commit/게시/PR/CI 등록. Manager 승인 전 게시 금지. 원래 thread 재개 한도로 재사용된 실행자의 실제 책임을 보고한다.
- issue_comment_writer=manager; 허용 PLAN/STATUS/EXCEPTION/RESUME/FINAL. Sub-Agent는 댓글 쓰기 없이 Result Contract로 반환한다.

## 검증과 문서 동기화

- frontend는 production 수정 전 exact baseline에서 동일 long KO/EN name/code·0/1/3 역할·미지정/특급·active/inactive·usage·구성원 fixture의 390/768/1024/1440/1920px before actual PNG/geometry를 확보한다.
- 서버 실행 중 source/shared fixture 수정 금지, 소유 server만 종료하고 generated next-env/tsconfig 복원. source freeze 후 after·header/body 정렬·control containment/비중첩·table scroll·문서 overflow·footer·focus 및 상태 보존을 검증한다.
- 관련 Unit/통합/E2E, typecheck/scoped lint/version/Markdown/diff LFF. 기존 #426 및 역할/등급/usage/401/412/password guard의 assertions는 새 진입 경로에 맞춰 유지한다. 첫 FAIL·원인·조치와 재검증 결과를 분리 기록한다.
- 기본 실제 100% 필수, 실제 125% browser zoom 가능하면 실행하고 불가하면 사유와 NOT TESTED. DSF/CSS zoom/viewport 축소는 browser zoom 증거가 아니다. 실기기/스크린리더/운영 환경은 별도 미검증 상태다.
- Required docs: PROJECT_UX.md, TEST_PLAN.md, UI_UX_GUIDELINES.md 관련 영향, PLAN/ISSUE_453/CHANGELOG. DESIGN 기존 token/peer-view 기준 재사용 여부 확인. API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/CI_CD/REMOTE_VALIDATION은 계약 변경이 없을 때만 N/A 근거 기록한다.
- DOCUMENTATION_SYNC → 독립 UI 비교/사전 QA → Manager PR_READY → allowlist 게시 → exact head/tree/부모/파일 동등성 → Refs #453 PR → pull_request ci.yml exact head 등록. quality/e2e/docker 결과 조회·모니터링 및 최종 ACCEPT 금지.
- 게시 artifact는 비밀을 제거한 before/after PNG 및 geometry만. 실제 DB·session/cookie/password·raw trace/log은 제외한다. 원래 root #464 branch 및 raw26파일을 보존한다.

## 현재 증거와 다음 handoff

- Branch/version 준비 PASS, baseline SHA와 root 보존 확인. 초기 node_modules symlink ignore 검증 실패는 로컬 Git exclude로 해결했으며 저장소 .gitignore 변경 없음.
- ui_ux 설계 완료, Manager 승인. 구현/browser/DOCUMENTATION_SYNC/사전 QA/게시/PR CI 등록은 아직 NOT TESTED.
- Before 첫 실행 session `96993`는 테스트 시작 전 Turbopack의 외부 node_modules symlink 거부로 FAIL했다. 제품 코드 실패와 구분하며 owned server 종료·generated2 복원 후 같은 lockfile의 frozen npm ci로 worktree 실행 환경을 준비한다. dependency/config/production 변경 없이 실제 before 캡처를 다시 실행한다.
- Before 재실행 session `66092` / `chd99430`: 1 PASS(개별 1.9초, 전체 5.7초), frozen npm ci `52944` / `chfa0998` exit 0. 동일 fixture의 5폭 PNG 5개·geometry 5개 확보. owned server 종료와 generated2 복원 후 Resource TSX/CSS baseline hash 동일. Header version은 준비된 `0.90.0`이며 Resource 제품 source baseline과 application 전체 byte 동등성을 혼동하지 않는다.
- Manager가 before 1440 PNG 및 geometry를 직접 확인했다. pane 폭 899.6875px/476.3125px, Resource 일부 행 높이 158.65625–161.0625px는 이 fixture의 실제 측정값이며 모든 행·폭의 일반 규칙으로 확대하지 않는다.
- 첫 구현 typecheck/lint `21784` PASS. source/CSS/fixture3 고정 후 마지막 관련 typecheck·8파일 lint·검색 Unit9개 `92675` / `ch6e98e8` exit0 PASS.
- After 첫 실행 `77844` / `ch38a461`: 22 PASS, 1 FAIL, 16 미실행. 최초 실패는 412→GET500 검증이 Next의 빈 route-announcer alert를 선택한 harness 오류다. trace/error-context는 게시 대상 밖에 보존하며 제품source/fixture hash불변·owned server종료·generated2복원 후 보호 목적을 유지한 selector 수정과 관련 미실행/실패 경로만 재검증한다. 전체 PASS 또는 after5폭 확보로 아직 보고하지 않는다.
- After 2차 `48930` / `ch36e4a9`: 역할 회귀1 PASS 후 폐기 확인의 계속 편집 초기 focus가 FAIL했다. React autoFocus만으로 WorkspaceDialog showModal 이후 초점을 보장하지 못한 제품 구현 결함이며 첫 alert harness 오류와 구분한다. 공유 primitive를 변경하지 않고 owned 부모의 ref focus·취소 복원을 보강한 뒤 관련 keyboard/복구를 검증한다.
- After 4차 `69975` / `ch931a49`: 412→GET401 및 오류4폭 5 PASS 뒤 같은 폐기 초기 focus 제품 FAIL 재현. 부모 effect만으로 보장되지 않아 owned control ref의 실제 HTML autofocus 속성을 연결하며 공유 primitive/타이머 변경 없이 신규10개를 `13585`에서 재검증한다. 3차를 포함한 상세 최초/반복 실패는 frontend 결과/TEST_PLAN에서 빠짐없이 기록한다.
- 6차 `60772` / `ch431c4e`: 신규동작·5폭 geometry7 PASS 및 after20 PNG/20 JSON 확보, aria-disabled button의 일반 Playwright click actionability timeout은 harness 실패로 분류했다. 실제 mouse/Enter에서도 DELETE0 검증을 유지하도록 보강. 7차 `8981` / `ch6c56c5`: 남은신규3+영향기존3 총6 PASS(10.3초). source변경 없이 탭별 scroll clamp0의 약한 근거를 충분한 행+top≥70/left230 assertion으로 보강하고 nested Escape focus2개를 `1022`에서 재검증한다.
- Manager는 after resources1440/groups390/profile390 PNG와1920 geometry를 직접 확인했다. 역할 plain text는 Issue의 badge 요구에 맞춰 보완하고 profile rawrevision 노출은 기존UX계약을 보존하도록 정정한다. 이 source 후속 보강 후20 artifact를 새후보와 연결하고 관련검증한다. 그 전 after가 최종후보와 동등하다고 주장하지 않는다.
- read-only infra preflight: 최신main은baseline fd8fdc9e 유지, 동일branch/PR 중복없음, root/raw26불변. 게시/CI PASS는 아니다.
- 9차 `47140` / `ch1642c8`: badge·탭scroll·갱신after20 geometry3 PASS 후 추가 pending5폭에서 Escape4번째가 native dialog를 닫는 제품 FAIL. 요청은 계속 pending이고 disabled control 때문에 focus가body로 떨어진 근거를 보존했다. 단일Escape PASS로 반복Escape FAIL을 대체하지 않는다. owned Resource modal 범위의 pendingRef Escape capture 차단·focus유지와 cleanup을 보강하고 응답 이후전환까지 재검증한다.
- 최종 LFF는 TEST_PLAN의 #453 기록을 따른다. After1~12차의 harness 실패와 제품 focus/pending Escape 실패를 모두 보존했다. 기존29개+신규11개+#120 Resource inactive1개 총41 unique browser 사례 PASS이며 실행57회/중복16회를 별도 기록한다. 단일 최종후보 전체41개 실행이 아니다. source 변경 영향이 없는 계약은 앞선 LFF hash와 영향분석으로 재사용했다.
- 마지막 실제 Chromium `83329` / `ch5df16b` 관련3 PASS 및 `48782` / `ch32fd7a` 환경/geometry·inactivecontrast2 PASS. typecheck `2901` / `chcc04e5`, 9파일 lint `11929` / `ch71f400`(오류0/경고0), version `chd83a95`(0.90.0), Markdown `chd394cd`(121파일), diff `ch7c0fa1` 모두 exit0. 검색 Unit9개는 `92675` / `ch6e98e8`의 동일 domain/search source 불변 결과를 재사용한다.
- Artifact: before PNG5/JSON5 + after PNG30/JSON30/environment JSON1 =71개. 기본 resources/groups/create/profile 및 dirty/pending의 5폭을 포함한다. 기존 legacy issue-268 출력·trace/report/DB는 게시하지 않는다. active panel폭358/720/976/1392/1600px, 최소 table976/800, identity240, header/body·셀control36+15 및 badge20 containment/비중첩·focus·footer 검증. actual125% zoom NOT TESTED(현재 headless browser chrome zoom 제어 없음), DSF/CSS/viewport를 대체PASS로 사용하지 않는다.
- After 실제 환경: en-US, Asia/Seoul, Chromium153.0.8010.12. Before locale/timezone/browser version은 별도 실측하지 않은 NOT RECORDED이며 동일 DesktopChrome config와 seed만을 근거로 구분한다. before Resource source는fd8, header준비값0.90.0이다.
- Required docs PROJECT_UX/TEST_PLAN/UI_UX_GUIDELINES와 Manager PLAN/이Packet/CHANGELOG 동기화. API/DB/auth/domain/공유 dialog/global CSS는 무수정으로 계약 문서 영향N/A. DESIGN 기존semantic token/peer-view/표 column 기준 재사용이며 새 framework/font/PRO/운영 변경 없다. 실제125%, 실기기/스크린리더/서버전체회귀/원격CI/GHCR/최종수동UX는 해당 증거 없이PASS로 보고하지 않는다.
- 다음 담당: frontend 최종 manifest/writer freeze 반환 → Manager DOCUMENTATION_SYNC gate → 독립ui_ux/QA → Manager PR_READY → infra explicit allowlist 게시 및 exacthead 검증 → PR CI 등록. 공식최종QA/quality/e2e/docker/Manager ACCEPT는NOT TESTED다.

## 게시 직전 main 이동과 재정렬

- 원격 게시 전 main이 `fd8fdc9e9207ab43a6fb7ff85b5a5acbe91d4553`에서 `56e2e54f88ab9124ec81c52e157161181ed6c337`로 7개 commit 이동했다. 운영 4파일과 lockfile의 `source-map-js 1.2.1 → 1.2.2` 변경이며 Resource 제품 소스는 변경되지 않았다. Issue EXCEPTION comment `6008184358`에 재개 지점을 기록했다.
- 승인 후보 89파일의 로컬 준비 commit `0564e5e1f3578213cc281324555d74db17aaa159`를 원격 쓰기 없이 최신 main에 rebase했다. 재정렬 HEAD `b0eec204090cf5b897c3bf7e2e26978937b0f483`, tree `e91e45dfdaa2a51c2eafb76f00e1619653723f3a`, 단일 부모는 위 최신 main이다. 충돌 0건, lockfile 제외 88파일 byte 불변, 운영 4파일은 main과 동일, application `0.90.0` 유지다. 이 HEAD는 문서·검증 갱신 전 중간 로컬 후보이며 최종 게시 SHA가 아니다.
- 기존 41 unique / 57회 browser LFF와 최초 실패 이력은 보존한다. dependency 변경에 맞춰 frozen npm ci, 관련 typecheck/lint/Unit 9 및 5폭 기본·dirty/pending geometry를 새로 검증한다. 그 뒤 문서 동기화·독립 사전 검토·최종 후보 manifest를 갱신한다. 이전 snapshot의 검토 PASS를 변경된 후보의 검토로 사용하지 않는다.
- 최신 통합 LFF: frozen npm ci `93526` / `ch797155` exit0(447 설치/448 audit, dev 포함 high6), typecheck `14418` / `ch75caca`, scoped lint `30542` / `ch4c8c62`, Unit9 `chc2f05f` PASS. Chromium `45776` / `cha9e89d` 지정2개 PASS(8.6초), after61 자료 갱신, owned Next 종료·generated2 복원·source/test/fixture10 drift0 및 복원 뒤 typecheck `6180` / `ch7b0103` PASS. 이전 high7과 새 high6은 각 실제 설치 결과이며 공식 production audit 판정과 구분한다.
- 현재 원격 branch/PR 쓰기는 0회다. 정식 quality/e2e/docker와 최종 ACCEPT는 NOT TESTED이며 결과 모니터링을 하지 않는다. 원래 #464 worktree와 raw 26파일은 보존한다.


## PR #477 최신 main 충돌 해소

- 최초 게시 head `c411634f75b7a69131a095e9cb6b7416060b827e`의 PR CI Run `37406441919` / Run #1898.1은 SUCCESS였다.
- 이후 main이 `d7316880732ecde5a8193764ac3b0cfca2ae455f` / application `0.87.1`까지 39 commits 전진했고 PR은 `mergeable_state=dirty`가 되었다. old base→current main과 #453 변경의 교집합은 문서5파일과 package/lock 2파일뿐이며 Resource TSX/CSS·관련 E2E/fixture는 main 이동에서 변경되지 않았다.
- CHANGELOG/PROJECT_UX/TEST_PLAN/UI_UX_GUIDELINES/PLAN은 최신 main의 후속 기록을 보존하면서 #453 내용을 병합한다. package/lock은 최신 dependency 및 source-map-js 1.2.2를 보존하고 candidate version `0.90.0`만 유지한다.
- published PR의 history를 강제 재작성하지 않는다. 기존 feature head를 첫 부모, 최신 main을 두 번째 부모로 하는 conflict-resolution merge commit을 만든 뒤 branch를 fast-forward한다.
- 새 exact head PR CI가 quality/e2e/docker를 다시 통과하기 전 최종 ACCEPT는 `NOT TESTED`다. 이번 사용자 요청의 종료점은 새 PR CI 시작 확인이다.
