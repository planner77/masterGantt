# Issue #891 — 공통 Markdown 편집 도구와 편집창 크기

## 범위와 승인

- Issue: https://github.com/planner77/masterGantt/issues/891
- 현재 검증 baseline/main: #918 반영 `0bf0e4e54cc445058b16c3764f79c27b81f5dd97`, application baseline `0.146.0`, 이번 후보 `0.147.0`. 최초 착수/geometry의 `9a98265ea7526feb2d589461146312e439206167`은 이전 source 이력이다.
- 작업 branch/worktree: `feat/issue-891-mdx-editor`, `/home/planner/Dev/masterGantt-issue891`. 원래 작업공간의 변경은 보존한다.
- Owner는 분석·설계·구현·테스트·실패 원장·정식 GHCR 게시·Issue 종료를 요청했고, 충돌한 과거 지침 대신 최신 main의 로컬 검증·직접 Push·로컬 게시 정책을 명시 선택했다. Issue 본문의 등록 전용 상태는 이번 승인으로 구현 범위로 확장한다.
- 현재 승인: publish_required=true, publish_authorized=true, release_required=true, release_authorized=true. Owner 2026-11-15 요청에 따라 검증된 exact main source의 고유 SHA 게시·정식 `0.147.0`·annotated `v0.147.0`·`0.147`/`0`/`latest` 동일 digest 승격과 두 Issue 수동 종료까지 수행한다. 기존 immutable/0.145 alias는 보존하며 운영 배포는 미요청이다. 처음의 고유 SHA 전용 범위는 아래 재개 이력에서 구분한다.
- 신규 사용자 기능이므로 application version은 MINOR `0.147.0`으로 결정한다. package/lock의 version만 동기화하며 의존성 변경은 하지 않는다.
- qa_method=AGENT_LOCAL, qa_required=true. 제품 UI 위험은 MEDIUM이며 필요한 로컬 영향 매핑·게시 버전 경로를 포함한 최종 검증 범위는 HIGH로 관리한다. 권한·API·DB·일정 알고리즘 변경은 없다.
- PR/Actions/Trusted QA/Finalizer 신규 실행은 N/A(Owner 정책상 미사용). 사전 live 조회에서 Actions enabled=false, main ruleset24043042 deletion/non_fast_forward를 확인했다. Push 직전에 다시 조회한다.

## REUSE_REVIEW

REUSE_DECISION=EXTEND. Owner가 작성한 Issue #891의 구현 정책과 AC06은 기존 공통 `DescriptionField`, `@mdxeditor/editor@4.3.3`, 기존 Issue/Task 폼과 Playwright를 유지·확장하도록 명시한다. 별도 editor/새 저장 모델/중복 폼을 만들지 않는다. 기존 `verify-prepr`와 `publish-local-image`의 source admission·Build-once·exact digest smoke를 재사용한다.

기존 #885 원장의 원문 정규화·Tab/ShiftTab·toolbar locale·Source 및 실제 HTTP/SQLite 실패와 #869의 폼/keyboard geometry, #898의 산출물 sourceguard 경계를 검토했다. 과거 CI 정책 실패와 이번 제품 동작 검증은 구분한다. 기계 Regression Index는 전체 과거 이력 이관본이 아니므로 위 원장도 직접 검색했다. 이전 source PASS를 이번 source의 증거로 승계하지 않는다.

## 설계와 소유권

- Manager: Work Packet·버전·CHANGELOG·제품 문서·실패 원장/Regression Index·로컬 영향 매핑·통합 검사·Push/게시/종료. 공용 source와 최종 검증 시점을 조정한다.
- implement891(frontend): `src/features/markdown/**`, Task/Issue host editor와 CSS, 기존 관련 unit/Playwright 및 고유 누락 케이스. 변경 전에 동일 fixture의 실제 Dialog 높이를 측정하고 합성 증거만 남긴다.
- ux891: read-only 설계와 구현 비교. native Task dialog top-layer와 tooltip portal, 본문 scroll owner·안전 상한을 확인한다.
- infra891: read-only 운영 준비·live 설정 조사. 이후 실제 운영 단계는 명시 위임 범위에서만 수행한다.
- 별도 qa_docs: 정확 source·AC·diff·문서·실제 결과의 독립 read-only 검토. 구현자 자체 검사를 독립 PASS로 기록하지 않는다.

툴팁은 공식 translation/tooltip API를 우선하고 설치 버전의 실제 keymap에 있는 키만 표시한다. 키가 없으면 현재 언어로 명시하며 native title 중복·overflow clipping을 피한다. locale 변경으로 editor/plugin을 remount하거나 source/selection/undo를 초기화하지 않는다.

전용 editor wrapper만 `resize: vertical; overflow: auto`를 갖고 폭은100%다. Rich/Source가 변경 높이를 사용하며 본문 최소11.5rem과 host의 안전 가용 높이를 지킨다. legacy plain/readonly는 명시 전환·원문 보존 정책을 유지한다. Dialog 전체 기본 높이는 동일 fixture의 기존 높이×1.5를 목표로 하되 기존 viewport 상한을 우선하며 실제 수치·제한 이유를 기록한다. 제목/닫기·Issue명·footer는 본문 스크롤과 분리한다.

## TEST_LIFECYCLE_REVIEW / AC_TEST_COVERAGE

기존 `project-issues.spec.ts`, `project-task-editor.spec.ts`, `project-task-editor-persistence.spec.ts`, `i18n.spec.ts` 및 Markdown 서버 안전성/형식 projection을 EXTEND/KEEP_UNIQUE한다. 관련 Task 삭제·관계·handoff·권한·If-Match·원문 length/AST·Gantt instance는 인접/음성 소비자로 유지한다. 고유 missing boundary에만 ADD하며 기존 assertions·timeout·retry·skip은 완화하지 않는다.

| AC | 실제 검증 계획 |
| --- | --- |
| AC01 | 설치4.3.3 toolbar 전수 hover/focus·현재 기능명/단축키·disabled/활성 trigger·native/fixed dialog clipping·실제 key 동작 |
| AC02 | KO→VI→EN→KO tooltip/aria 갱신, editor identity·selection/undo/source draft/mode와 저장 전 network write0 |
| AC03 | Rich/Source 실제 우하단 drag 증가/감소·min/max·폭 불변·scroll/toolbar/footer/focus 접근; plain 원문 보존 |
| AC04 | 신규/기존 Issue·Task/Summary/Milestone 단/장문 동일 fixture before/after px·ratio·cap 이유,5폭/낮은 화면/125%와 header/body/footer·문서 overflow |
| AC05 | 기존 HTTP/SQLite 저장·revision/권한·412·길이/AST/Source 오류·Tab/ShiftTab/Escape·Task→Issue→Task·dirty/stale/복구 및 Gantt instance 회귀 |
| AC06 | 기존 테스트 우선 확장, 공통 전체 Unit/Integration/build·관련 Chromium·Docker/runtime/SQLite·같은 clean source admission. 과거8shard/Required3는 신규 원격 실행 N/A |

로컬 영향 규칙에 공통 Markdown/Issue producer의 실제 소비자를 추가하되 UNKNOWN/missing/필수 gate 차단은 유지한다. full Unit/Integration은 `fast`, 영향 Chromium/unit은 `targeted`, 단일 OCI/runtime/API/SQLite는 `docker`, 같은 source 준비 판정은 `admit`로 분리한다. publisher까지 동일 직접 Node launcher/환경을 사용한다. 최종 실행 전 source/base·fixture/lock·환경을 고정하고 실행 중 소스를 변경하지 않는다.

공개 증거는 합성 fixture만 사용하며 screenshot/geometry는 `testInfo.outputPath`에 생성한다. #896 manifest와 #897 Owner 수동 UAT·실제 browser-chrome125%/AT/운영 장치는 실행한 범위와 미실행을 구분한다. 운영 배포·실운영 DB/backup/restore는 제품 표시 전용 변경이며 이번 요청 밖이다.

## DOCUMENTATION_SYNC

- UPDATED: CHANGELOG, DESIGN, TASK_EDITOR, PROJECT_ISSUES_USER_GUIDE, UI_UX_GUIDELINES, TEST_PLAN, 이 Work Packet, 단일 실패 원장/Regression Index, 현재 PLAN.
- LOCAL_PREPR: 기존 실행기 영향 매핑의 직접 소비자 확장만 기록한다. source/환경/admission 정책은 유지한다.
- AGENTS: N/A(기존 공통 역할·재사용·검증/게시 계약으로 구현하며 실행 지침 자체를 바꾸지 않는다).
- API/DB_SCHEMA/SECURITY/ARCHITECTURE/SCHEDULING_ENGINE/IMPORT_SCHEMA/VBA_EXPORT/DEPLOYMENT: N/A(표시·상호작용 변경이며 저장/서버/원문/안전성·배포 계약 변경 없음).
- CI_CD/GITHUB_OPERATIONS/REMOTE_VALIDATION: N/A(기존 Owner 로컬 게시 계약을 적용하고 workflow/권한/Ruleset/원격 실행을 변경하지 않는다).

## 실행 결과와 남은 gate

초기 의존성 준비 `npm ci` exit0,711packages 설치. 설치가 보고한11vulnerabilities(9moderate/2high)는 기존 lock의 현황이며 의존성 자동수정은 하지 않았다. 공식 로컬 gate·독립 QA·Push·게시·FINAL은 아직 NOT TESTED다. 실제 실패와 후속 재시험은 [단일 원장](../../ISSUE_891_FAILURE_ANALYSIS.md)에 append하고 정확 source·report·시각·exit/count에 연결한다.

## 변경 전 실제 높이 기준

동일 합성10종×1440폭/900·1200·1600높이30측정(run6 exit0)의 Task높이는810/896/896px·폭1120px, Issue높이는792/864/864px·폭736px다. Editor/host/CSS는9a98265e bytes이며 version/docs는0.147.0 WIP로 clean전체source가 아닌 SCOPED baseline이다. baseline JSON SHA256 `f6902c0b60dafdbd8177d0e8458c9217d8212d66495102e876b536991d872ec7`. 최초6준비실패와교정은원장에보존했다.

기존88~90viewport안전상한을유지하면서rem상한54/56을81/84로조정하고실제height를설정한다.1600높이에서는Issue864→1296·Task896→1344px의1.5×를목표로하며900높이에서는기존viewportcap때문에792/810px를유지한다. after실제측정과최종gate는아직NOT TESTED다.

## 1차 구현 후 geometry 빠른 검증(SCOPED)

동일합성fixture30측정의실제after exit0에서폭1120/736px는불변이었다. 높이900에서는Task810→810/Issue792→792(기존90/88dvh상한),1200에서는Task896→1080(1.205357×)/Issue864→1056(1.222222×,각viewport상한),1600에서는전10종Task896→1344/Issue864→1296으로정확1.5×다. 실제height와max-height를함께설정했으며상한만높인변경이아니다. 이WIP결과는최종clean source의전체gate/QA/GHCR을대체하지않는다.

30건의 실측은[합성 geometry 기록](../../evidence/issue-891/dialog-height-observations.json)에 source 경계·원본JSON hash·before/after/비율·상한 이유와 함께 보존한다.

## 공개 toolbar adapter의 범위

native disabled 도구의 keyboard 설명을 제공하기 위해 기존 공통 MDXEditor와 plugin/state/translation은 유지하고 공개 ButtonWithTooltip·Gurx/Lexical command/state로 필요한 action만 감싼다. readOnly/canUndo/canRedo/table/list 조건에서 명령을 차단하고 새로운 hotkey는 등록하지 않는다. 직접사용하는 설치/lock 버전은 Gurx1.2.4·Lexical/history/extension0.48.0이며 dependency 변경/deep import는 없다. 비활성 click/Enter/Space의 원문/명령/쓰기0와 활성전환·history를 실제검증한다.

## 위험도 확정

`risk_level: HIGH`, `qa_method: AGENT_LOCAL`, `qa_required: true`. 공통 editor의 tooltip/focus·Rich/Source height·history/list/table command adapter와 로컬 영향 선정 도구·버전 경로가 최종범위에 포함된다. API/DB/auth 계약은 불변이지만 초기 MEDIUM 제품UI 분류보다 검토범위가 넓어 HIGH로 관리한다. 새 source의 공통/영향/컨테이너 gate와 실제 독립 Reviewer를 모두 확인한 뒤 게시 범위 Manager 판정을 기록한다.

## resizer의 본문 가용 높이

Task/Issue의 기존 스크롤 본문에 marker를 두고 ResizeObserver로 현재 clientHeight를 관측한다. 최대 높이는 host본문 clientHeight-12px·60dvh·40rem 중 작은 값으로 제한하되 최소15rem을 우선해 기존 본문11.5rem 이상을 보존한다. 극히 낮은 화면에서 최소편집영역이 host본문보다 크면 기존 외부 본문 스크롤로 편집기/다른 필드에 도달하며 제목·footer는 고정한다. 크기조절은 원문/DB/API 상태를 저장하지 않는다.


## 2026-11-15 재개·정식 버전 게시 승인 확장

#918의 로컬 fast4009PASS/targeted119PASS/Docker10step/admit·독립qa918 PASS 후 main `0bf0e4e54cc445058b16c3764f79c27b81f5dd97`에 정상FF반영됐고 신규Actions Run0건을 확인했다. #891의 최종검증 baseline은 이SHA다. 최초9a98265e baseline과 WIPgeometry는 역사기록으로 유지한다. 원래 작업을89ee2e99에 보존하고6471dd8b에서 #918 원장/지침을 append-only통합했다. 원본작업·generated파일936개의별도백업/동일이관 뒤Next생성설정을기준원문으로준비했으며새검사중sourceguard실패를복원해숨긴것이아니다.

Owner의 이번 명시 요청은 “918에 이어서891까지 진행한 후 버저닝 규칙에 따라 버전 채번 후 정식 버전 GHCR 게시 및 이슈 종료까지”다. 신규 세로조절/툴팁 기능에 MINOR `0.146.0→0.147.0`을 적용한다. `release_required=true/release_authorized=true`: 검증한 새exactmain SHA의고유SHA게시·정식`0.147.0`·annotated`v0.147.0`·기존정식정책의`0.147`/`0`/`latest`동일digest승격을포함한다. 기존0.145alias·모든immutable버전과SHA태그는보존하며운영배포는미요청이다. 최초고유SHA만의승인범위는이번명시정식게시승인으로확장됐으며이전이력을소급변경하지않는다. 최종SHA는LOCAL_VERIFIED/QA/Manager판정과Issue승인기록에고정한뒤동일OCI만승격한다.

실제역할: Manager통합/문서/버전/스크립트영향매핑/공통gate/Push·게시·종료, implement891은Terra/medium으로요청된별도frontend worker(제품/관련테스트단일writer), ux891은Terra/medium read-only설계비교, qa918/qa_release891은별도read-only 검토. 준비단계frontend891은플랫폼frontend역할의Sol/medium으로read-only조사만수행했고제품구현PASS로기록하지않는다. 설정값과실제독립실행은구분하며별도runtime모델식별증거가없으면검증된것처럼주장하지않는다.

#916실증절차와기존고유SHA publisher를재사용한다. 별도승격준비의정적QA에서fresh admission/후행FAIL차단·immutable쓰기직전충돌확인·부분실패UNKNOWN보존을보완했으며실제preflight·승격은검증전NOT TESTED다. 별도qa_release891의실제preflight검토후에만태그/registry쓰기한다. 동일clone의공통Git lock은외부writer에대한serverCAS가아니므로쓰기직전읽기/보존확인을함께수행하고불일치면차단한다.

DOCUMENTATION_SYNC추가: CI_CD의버전/정식수동승격절차는UPDATED(동일OCI·별도명시승인·현재실행방식정합화), AGENTS는#918반영본재사용/N_A. 전체새source fast/영향Chromium·Unit/Docker/admit·최종QA와게시·종료는아직NOT TESTED다.


## UI_EVIDENCE_CONTRACT

아래 표는 합성 fixture의 검증 범위와 DESIGN/화면 계약을 연결한다. 실행 여부와 PASS는 해당 source의 실제 Playwright 보고서로 판단한다. WIP 관측·manifest의 `CAPTURED_BEFORE_TEST_COMPLETION`을 최종 clean source 성공이나 Owner UAT로 확대하지 않는다.

| AC / 제품 계약 | 기존 테스트·상태 | 실제 측정 및 범위 | 제외·수동 판정 |
| --- | --- | --- | --- |
| AC01~03 / DESIGN의 공통 Markdown 도구·본문 면적, UI_UX의 tooltip·focus·state | project-task-editor-persistence의 Task/Issue toolbar 2case | 1440×1000에서 KO→VI→EN→KO, Rich/Source 실제 hover/focus/단축키·Escape·disabled 명령 차단, 같은 editor·selection/undo/source draft·쓰기0, 실제 우하단 drag/min/max·폭 불변·긴본문 실제 내부scroll 끝에서 toolbar/footer 접근 | 모든 viewport×언어×도구 활성 조합의 Cartesian 실행 아님. Mac 실장치 shortcut과 AT 수동 수용은 NOT TESTED |
| AC04 / 같은 fixture Dialog 기본 높이1.5배·기존 viewport cap | 같은 spec의 1440×900/1200/1600 geometry 3case | Task/Summary/Milestone 단·장문6개와 신규 Issue 단·장문2개, 기존 Issue 단·장문2개: 높이별10개·총30관측. 원본9a 제품bytes의 SCOPED before와 비교. Task 폭1120/Issue736 유지,1600높이에서1344/1296px(1.5×),900과1200은 기존90/88dvh 상한 | before는 전체 clean source admission이 아닌 보존된 제품표면 기준이다. 승인 pixel golden 없음·자동 교체 없음 |
| AC04~05 / 안전한 제목·본문 scroll owner·footer/비밀번호/focus | 같은 spec의 responsive 5case | 390/768/1024/1440/1920폭 × 900/480높이 × short Task/Summary/Milestone3종 및 기존 long Issue1종: 대표40조합. Dialog/문서 overflow≤1px, 실제 footer 버튼 hit-test와 제목/비밀번호 접근. 합성 PNG·geometry·fixture·manifest 수집 | 각 폭에서 신규 Issue/long Task를 모두 교차하지 않는다. 단·장문 전체 유형은 위1440×3높이의30관측에서 별도 확인 |
| AC04~05 / 실제 browser zoom과 초안/접근 보존 | 같은 spec의 native Chromium125% 1case | full Chromium의 chrome.tabs setZoom/getZoom=1.25, DPR×1.25·실제viewport1440×900→약1152×720 및 CSS zoom=1/visualScale=1 확인. short Task3종과 기존 long Issue의 header/footer·title draft·쓰기0 | 단일 로컬 Chromium 자동 검증이다. 다른 OS/브라우저·실기기·터치·운영 host·Owner 직접 UX 수용은 NOT TESTED |
| AC05~06 / 원문·권한·revision·dirty/stale·handoff·Gantt 유지 | 기존 project-issues/project-task-editor/persistence/form-density/i18n 및 인접 link/delete/state 소비자, Markdown AST/projection Unit/HTTP SQLite | 최종 영향 선정과 runner file/case 수, 실제 명령·exit·source/fixture·환경에 연결. 기존 assertion/timeout/retry/skip 유지 | 업무/운영 데이터로 시연하지 않는다. 자동 PASS는 독립 의미 검토·Owner UAT·운영 배포를 대체하지 않는다 |

대표 manifest는 실제 fixture payload·PNG/geometry hash와 source metadata를 검산한다. 캡처되지 않은 나머지 상태를 PASS로 채우지 않으며 #897 Owner UAT·screen reader/실장치·운영 브라우저는 NOT TESTED로 유지한다. 최종 Report/Issue FINAL에 WIP와 clean source 실행을 구분한다.


## Local Fast Feedback 인계

구현자는F016 locale동기화·Source컴포넌트mount경계,공식full-height최소높이와긴본문scroll을교정했다. F017은Playwright shifted소문자입력의TOOLING오류로물리KeyZ를사용하며,F018은특정클래스대신wrapper내실제overflowowner의끝scroll상태를검증한다. 초기정적검사및번역Unit3개는PASS이나그뒤교정이있어최종공통gate를대체하지않는다.

213WIPsource의11case는10PASS/1FAIL이었고,F019의정확readonlyPOST분류와canonical동등성강화후674WIPsource의native단일1case는PASS다. 같은clean source11PASS로합산하지않는다. 대표V2manifest7개의무결성은PASS지만dirty capture·개별전체workingdiff차이를제품/테스트부분지문과혼동하지않으며Owner수용은NOT TESTED다. 최종서로다른모드의검증은새clean commit과고정baseline0bf에서전체실행한다.

실제별도ux891은1440×1000KO의Task/Issue Source-resized PNG두장의toolbar/resizehandle/footer에명백한겹침·가로잘림이없음을관측했다. 캡처에열려있지않은tooltip동작이나다른화면/125%를시각PASS로확대하지않았다. 독립qa891은원본trace/설치키맵/API보안inventory·handler를대조해위교정과원장분류를검토했으며최종clean source QA는아직별도다.


## 최종 소스 준비

로컬빠른검증이끝난후3100포트가비었음을확인했다. next-env/tsconfig의실제생성차이를외부소유자전용archive에백업하고,이worktree의Playwright/Next출력·합성DB를파일별SHA동일대조후source밖으로이관했다(각각238/2/1/9/252개파일). 10PASS run의전체원본산출물은별도LOCAL:891-eleven-103202에이미보존돼있다. Next두파일은기준원문으로준비했으며이후최종검사중sourceguard실패를복원·무시한것이아니다. 최종clean commit뒤에는제품/테스트/문서/fixture/설치환경을고정하고직접Node launcher의fast/targeted/docker/admit를실행한다.

최종head QA는실제별도qa891·ux891가보고서/선정·PNG/geometry·snapshot audit를검토한뒤판정한다. 실제모델설정요청과별도Agent실행은구분하며runtime식별메타데이터가없으면모델검증PASS로표현하지않는다. 원격PR/Actions/Trusted/Finalizer·운영배포는N/A(Owner범위);정식게시와종료는로컬gate후에만수행한다. 최종실제명령·case수·source/env지문·image/OCI/digest·승인·IssueFINAL은같은정확source의외부실행보고에연결해추가문서작성으로검증source를바꾸지않는다.


## F020/F021 공식 gate REWORK

6b candidate의fast4013PASS/3기존optinSKIP·Docker10stepPASS·targetedUnit142PASS는실제독립검산됐으나Chrome은Task전수관측예산과Issue coldclient준비경계에서2FAIL했다. 원본44PASS/2FAIL/1interrupted/40notrun을보존하고Manager가남은run을중단해targetedmode는BLOCKED다. 제품소스의Escape닫힘이나module실패로단정하지않으며protocol시간/네트워크/실제frame으로원인을구분했다.

원래90초/default5초기능assertion·모든도구/locale/hover/focus/Escape를유지하면서독립DOM관측batch와기존비변경action준비계약을재사용한다. testcase분할/선정축소/timeout·retry완화0이다. 새source를확정해같은baseline0bf의공통/전체영향/Docker/admit를다시실행한다. 이시점main은#918의0bf이며6b는미Push/미게시이고0.147.0정식태그는아직발행하지않았다. source변경뒤이전6b성공을재사용하지않는다.


## 하네스 REWORK 빠른 검증

관측batch는모든기존16도구×locale hover/focus/Escape·label/visibility·좌표/nativeDialog/disabled조건을유지한채독립DOM읽기를같은시점으로묶는다. 첫rich.focus는기존action자동준비계약을명시하며내용/모드/API를변경하지않는다. 기존visible5초와case전체90초는동일하며Source모드클릭·임의sleep·재시도·테스트분할/축소는없다. Editor초기default-focus는기존고유테스트의책임으로남긴다.

별도qa891정적검토PASS후WIP2case실제실행이02:28:36~02:31:23Z exit0/2PASS(Task56.1초,Issue54.7초)였다. 원본부분지문과원문은F020/021에보존했고새frozen전체source의공통/영향/Docker/admit·최종독립QA는여전히필수다. 제품코드는6b와같고변경은동일계약을검사하는하네스및실패/추적문서다. 0.147.0은미발행후보로유지한다.
