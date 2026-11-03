# Issue #866 — 한국어·영어·베트남어와 LLM 기반·Issue 화면 통합

- Primary Issue: https://github.com/planner77/masterGantt/issues/866
- 관련 구현: https://github.com/planner77/masterGantt/issues/865 및 https://github.com/planner77/masterGantt/issues/869
- 기준 main: `352a43e7`, application `0.139.1`. 후보 MINOR `0.140.0`.
- 작업 브랜치: `feat/issue-866-i18n-llm-issue-layout`, 별도 worktree `masterGantt-865-866-869`.
- 승인된 종료점: 분석·설계·구현·문서·실패 원장·리뷰/충돌 처리 후 Ready PR의 Full CI 시작. 완료 모니터링·병합·Main/GHCR/정식 릴리스·Issue 종료는 범위 밖이다.
- risk_level: HIGH
- qa_method: OWNER_MANAGED
- qa_required: true
- independent_qa: N/A(Owner-managed; 구현 Agent의 자체 검증과 별도 사전검토는 인간 최종 QA가 아님)
- manager_decision: NOT TESTED
- release_required: true
- release_authorized: false
- MERGE_READY: BLOCKED

## 의존성 및 단일 PR 판단

| 이슈 | 필수 의존성 | 상관 관계 | 통합 판단 |
| --- | --- | --- | --- |
| #865 | 기존 Node 서버/배포/비밀정보 경계 | #866의 번역은 이 모듈을 사용하지 않는다 | 독립 모듈·독립 mock 검증, 같은 버전/PR에 포함 가능 |
| #866 | 기존 기준정보 FK·소유권·관리자/Project 세션·SVAR 2.7.3 | #869와 Issue JSX·장문 번역 레이아웃을 공유 | 공통 registry/DTO를 먼저 확정하고 UI 적용 |
| #869 | #838~#854 Issue 원장 및 병합된 #867 기본 필터 | Issue 화면 국제화와 같은 파일을 수정 | 단일 작성자가 레이아웃과 사전을 함께 구현 |

세 이슈 사이에 선행 병합을 요구하는 의존성은 없다. #865와 #866을 자동 번역 기능으로 결합하지 않는다. 단일 canonical `Refs #866`만 사용하고 관련 이슈는 별도 링크로 추적한다. Finalizer의 Primary Issue 종료가 #865/#869의 모든 AC와 실환경 검증 완료를 대신하지 않는다.

## 실행 계획 및 소유권

1. Manager: 현재 Issue·open PR·main을 조회하고 별도 최신-main worktree 생성, Work Packet/Issue PLAN 기록. 기존 작업 파일 보존.
2. backend `llm`: `src/server/llm/**`·전용 테스트. 등록 provider/model만 선택, 기본 OFF, runtime secret, 사설 IP DNS 고정 연결·redirect 거부·HTTP 별도 opt-in, bounded 비스트리밍 호출·안전한 오류. 공개 endpoint/업무 AI 기능 없음.
3. backend `translations_backend`: 기준정보 DTO·Repository/Service·migration·기존 API·SQLite/권한 테스트. `name` 원본과 ID/FK/기존 UNIQUE 보존, 선택적 `translations`를 같은 writer/revision/transaction에서 처리.
4. frontend `i18n_core`: registry/provider/SSR-mount 경계·저장·언어 선택·formatter·공식 SVAR Locale. Gantt 인스턴스와 일정 의미 보존.
5. frontend `ui_shell`: 공통 shell·Project·Task Editor·일반 dashboard/메시지 사전 적용. frontend `domain_ui`: 글로벌/Project 기준정보·리소스·물류 수동 번역 입력·조회·검색과 화면 사전.
6. frontend `issue_ui`: #869 read-only 설계 비교·실제 RED 재현→수정·기존 Issue E2E 확장 및 Issue 사전. Manager가 상위 CSS scroll 계약을 통합한다.
7. Manager: shared docs·Compose/.env.example·MINOR manifest/lock·CHANGELOG 단일 작성, 테스트 결과/실패 원장 동기화. 실제 분리된 read-only 사전검토 후 필요한 보완.
8. 최신 main 정렬·미해결 리뷰/충돌을 확인하고 코드/문서 동결 후 push/Ready PR 생성, 정확 Head의 CI 시작 URL/Attempt만 인계. 결과를 기다리지 않는다.

## 설계 계약

- i18n은 정적 번역 사전과 명시적인 UI 호출만 사용한다. 사용자 자유 입력·기술 식별자·API enum·원본 name은 번역하지 않는다. locale 변경은 canonical write 0, SSR 초기 ko 뒤 mount 동기화, localStorage 오류는 안전하게 처리한다.
- 기준정보 번역은 원본 owner/FK와 locale에 귀속되고 해당 언어 값이 없으면 정확한 원본 name을 표시한다. 다른 언어 연쇄 fallback은 하지 않는다. `translations` 생략은 기존 값 보존, 명시 `{}`는 해제하는 하위호환 확장이다.
- Issue 데스크톱 목록만 수직 scroll owner다. 상단 컨텍스트/필터와 pagination은 밖에 유지한다. Dialog의 제목/닫기/Issue 명은 고정하고 본문만 스크롤하며, 날짜3열·등록자/담당자/상태3열·신규 비밀번호2열, 모바일 stack을 적용한다.
- LLM 설정은 공개 provider JSON과 별도 token JSON을 runtime에 읽는다. 시작·readiness·일반 UI·언어 변경은 네트워크 호출을 만들지 않는다. 명시 호출자에게만 타입화된 모듈을 제공한다.

## TEST_LIFECYCLE_REVIEW

- 기존 검색: `tests/e2e/project-issues.spec.ts`, 날짜/formatter·Gantt 상태 테스트, Project/Process/Logistics/Resource CRUD·DB migration·Copy/Template·인증·Origin·revision 테스트, 배포 Compose 계약. 기존 각 환경/권한/SQLite/브라우저 고유 사례는 KEEP_UNIQUE.
- ADD: locale registry/정적 사전/선택·fallback, 번역 DB·권한/원본 호환, LLM 구성/resolver·mock HTTP/SSRF/abort/크기 제한. 기존 경계에서 검출하지 못하는 새 계약에 한정한다.
- EXTEND: Issue 기존 fixture에서 목록 geometry/wheel·sticky/form layout 및 ko/en/vi, 날짜 formatter/Gantt 동일 인스턴스·원본 불변과 master 기존 CRUD 입력.
- 통합/폐기/skip/retry 증가 없음. 세 Required aggregate·기존 Chromium shard·QA/Trusted/Owner/Main/Release 권한은 변경하지 않는다.
- 실행 결과와 최초 오류는 [누적 원장](../../ISSUE_866_FAILURE_ANALYSIS.md)에 명령·환경·원인·보완·미검증을 분리한다.

## AC_TEST_COVERAGE

- AC01: locale 선택·저장·브라우저 fallback·storage 거부: tests/lib/i18n.test.ts 및 tests/e2e/i18n.spec.ts 구현, 선별 Chromium4/4 PASS. 독립 브라우저·reload·명시선택 유지 확인.
- AC02: 명시 UI 사전/SVAR/보간·안전 오류/ARIA 구현, 정적 callsite coverage와 helper Unit PASS. 전 화면의3언어 수동 UX는 NOT TESTED이며 원격 전체 회귀와 구별.
- AC03: 설치 SVAR2.7.3 공개 Locale/words 구현, 실제 native vi 헤더/날짜·동일 instance/scroll/draft·write0 Chromium4/4 및 native menu/readonly1/1 PASS. 날짜·주차/캘린더 관련31Unit PASS.
- AC04: 12owner 원본/번역 CRUD·해제·선택/fallback·고유성 구현, SQLite/HTTP 번역7/7 PASS와 domain identity/search Unit PASS. 실제 SQLite 관리자 UI 저장·검색/동명ID·해제·401재인증/412초안 보존·5폭 geometry1/1 PASS. 모든12도메인 UI 조합 전수 실증과는 구별.
- AC05: 기존 global admin/Project session·Origin/If-Match/revision·stale/rollback·타Project 격리 유지, 번역7SQLite/HTTP 및 backend 관련129case PASS. 신규 권한 우회 endpoint 없음.
- AC06: migration0036·신규/기존 DB/FK/reopen와 Copy/Template6·미지원 export 거부 구현·관련 Unit PASS. 운영DB backup/restore는 별도 NOT TESTED.
- AC07: locale 표시만 변경, date-only/UTC·Monday/W##·업무 calendar/기간/공수 불변. 날짜·주차·숫자 포맷/도메인 Unit PASS 및 native header 실제vi 검증 PASS.
- AC08: Issue5폭×3언어·keyboard/Escape/focus·coarse44·125%상당viewport PASS. 실제 native125%/실기touch/AT는 NOT TESTED. SSR/mount·동일Gantt/초안 보존은 i18n Chromium4/4 PASS.
- AC09: 기존 검색·ADD/EXTEND/KEEP_UNIQUE 및 신규2spec shard 등록 완료. 초기 FAIL/기각 가설/교정과 로컬·원격 증거는 누적 원장에 분리. 원격 Required3/Trusted·Owner/Manager는 NOT TESTED.

관련 #865 AC1~9는 구성/resolver·mock HTTP A/B·한 서버 두 모델·기본 OFF·SSRF/secret·Compose·문서·업무기능 비노출로 검증한다. 관련 #869 AC1~7은 기존 Issue E2E의 동일 fixture geometry/실제 wheel·고정 필드·행 배치·상태/자격증명/Task 복귀·반응형과 문서 비교로 검증한다. 개별 실제 증거가 없으면 PASS로 묶지 않는다.

## DOCUMENTATION_SYNC

- `AGENTS.md`: N/A(기존 보안·QA·문서·다중 Agent 지침으로 충분하며 실행 정책 변경 없음)
- `DESIGN.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/DEPLOYMENT.md`: UPDATED
- `README.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/IMPORT_EXPORT.md`: UPDATED
- `docs/IMPORT_SCHEMA.md`: UPDATED
- `docs/EXCEL_EXPORT.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/ISSUE_261_RESOURCE_CALENDAR.md`: UPDATED
- `docs/SCHEDULING_ENGINE.md`: N/A(언어는 표시에만 적용; 순수 일정·공수 계산과 저장값 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 Owner-managed/Trusted/Required3 및 HIGH 잔여 위험 승인 유지)
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(Primary Issue 및 기존 CI 시작·리뷰 처리 절차를 그대로 적용)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 Lifecycle·승인·완료 조건 변경 없음)
- `CHANGELOG.md`: UPDATED

문서 업데이트는 실제 구현·변경 경로와 다시 대조한 뒤 확정한다. 사용자 Web 매뉴얼 제품 baseline은 #720의 현재 상태를 확인하고 미구현 페이지를 존재한다고 취급하지 않는다.

## 현재 검증과 잔여 위험

- frozen install: 완료. Node22.14.0/npm11.10.0, Next16.4.2/SVAR2.7.3. better-sqlite3 native build 재구성 완료.
- LLM70Unit, i18n/date10Unit 및 관련30Unit, 기준정보14suite163case, 언어 전환 Chromium4case 및 기존 Issue business4case의 개별 로컬 PASS를 확보했다. 동시 작성 중 실행을 최종 source 전체 회귀로 확대하지 않는다.
- 신규 Head의 공식 Quality/E2E/Docker·Trusted QA·Owner/Manager ACCEPT는 NOT TESTED.
- 운영 사내 LLM endpoint/DNS/내부CA·runtime secret·운영DB backup/restore·native125%/실기AT는 별도 환경에서 NOT TESTED.
- exact Head/Base/run에 대한 Owner HIGH 잔여 위험 수용·명시적 병합 허가는 미실시다. PR CI 시작은 병합 승인이나 릴리스 승인이 아니다.

## 별도 사전 검토와 원격 인계 경계

실제 분리된 ui_ux와 qa_docs가 read-only 설계/구현 비교·보안/도메인/문서 사전검토를 수행했다. ui_ux의 control44px·action열·등록버튼 의미·focusring 지적, qa_docs의 동명표시·안전오류·원문 이름 번역/응답parser 지적을 반영했다. 독립6files87case 실행 PASS와 실제 SQLite→Service→client parser 교정 재검증 PASS를 확보했다. 이는 신뢰된 인간 최종 QA/Owner ACCEPT가 아니다. 위험도 HIGH/OWNER_MANAGED와 Required3/Trusted/strict/리뷰0/별도Owner 승인 조건은 유지한다.

main은 마지막 조회에서도352a43e74c7b34c72d952f67783a53463f8b519d이며 새 작업은 기존main 기반이다. 새 PR 생성 전 관련 기존 open PR은 없었다. 최종 PR에서 현재 Head/Base/mergeability·review threads를 다시 확인하고 시작 Run/Attempt는 Issue STATUS에 남긴다. CI 완료를 모니터링하지 않으며 원격 결과는 NOT TESTED다.

## 최종 선별 브라우저 및 환경 검증

- `tests/e2e/i18n.spec.ts`:4/4 PASS12.6초. 실제 native vi 헤더/날짜·동일 Core/API/DOM·비영 스크롤·미저장 Task 초안·권한/revision·write0, 저장/거부된storage/브라우저 fallback 확인.
- native Gantt menu/readonly:1/1 PASS. 기존15spec의 native ko 메뉴 label을 실제Locale에 맞췄으며 권한/음성 assertion은 유지했다.
- `tests/e2e/project-issues.spec.ts`:전체5/5 PASS28.7초와 마지막 삭제focus 교정 뒤 #8691/1 PASS15.6초. 100건/4page size·wheel·desktop parent/docoverflow0,5폭×3언어·고정제목/본문/3/3/2열·184px textarea·keyboard/focus/coarse44·125%상당viewport 확인.
- `tests/e2e/i18n-master-data.spec.ts`:최종 실제SQLite1/1 PASS24.6초. 등록/재조회·원문/번역 검색·취소/해제·동명ID 선택·401재인증/412초안 보존·raw오류 비노출·5폭44px/문서overflow0 확인. 모든도메인 화면 전수·실기125%/AT는 NOT TESTED.
- synthetic `.env`→Compose config quiet와 실제격리container의7env 전달 PASS. 기존로컬image를 사용한 환경 매핑 검사이며 새 image/운영endpoint smoke와 구별한다.
- 새 정식0.140.0 GHCR/tag/Release 승인 없음. PR Full을 시작하고 종료결과를 모니터링하지 않는다.

## 동결 후보 최종 Local Fast Feedback

source SHA256 `3e9a96ec4b940dff934c9788f37ff17c7b56d77ff93c56acf501469b3f3dc47c`의1207파일은 전체검사 전후 불변이다. `npm test`:294files/3548case PASS, 기존1file/3case skipped(새skip0),22.93초. `npm run typecheck`, `npm run lint`(오류0/경고18), `npm run build`(Next production+runtime-tools), version0.140.0·발견·Markdown/diff 검사 PASS. `.next/static`에 LLM runtime 설정 식별자3종이 없음을 확인했다. 실제 비밀값을 빌드에 넣지 않았다.

[정제 검증 명세](../../evidence/issue-866/local-validation.json)에 환경/명령/건수·동결지문·실환경 및 원격미검증을 보존한다. [목록 이전](../../../output/playwright/issue-869/before-list.png), [목록 이후](../../../output/playwright/issue-869/after-list.png), [영문390 폼](../../../output/playwright/issue-869/after-en-390-editor.png), [베트남어 Gantt](../../../output/playwright/issue866/vietnamese-gantt.png), [기준정보390](../../../output/playwright/issue-866-master-390.png)에서 실제 합성fixture 화면을 확인할 수 있다. 전체화면/다른도메인 전수·실기native125%·AT/운영LLM 검증으로 확대하지 않는다.

DOCUMENTATION_SYNC는 코드·DB/API·계약·가이드·실제변경경로와 재대조했으며 로컬docs_gate 구조/AC01~09 매핑 검사 PASS다. 이 구조적 성공은 원격 Trusted QA나 Owner 위험 수용/Manager ACCEPT를 뜻하지 않는다.

## REWORK1 — PR870 Full3468.1 실패 재개 (2026-11-03)

[누적원장 PR870-FULL-001](../../ISSUE_866_FAILURE_ANALYSIS.md#pr870-full-001--full-34681의-첫-원격-실패-및-재개-2026-11-03)에원본Run41618392066/attempt1·전체8Shard/Quality·Docker·Trusted와정확Head/Base/test-merge를추가했다. 직접실패는ContextHelp완성label중복, ProjectMaster기본행87px(상한48), production HTTP/HTTPS의한국어프로젝트label대기다. CANCELLED Shard7의실제FAIL도포함했다.

소유권: frontend공유help/helperunit/기존admin·#719소비자, domainfrontend+ui_ux의compact번역trigger/WorkspaceDialog·밀도/초안, infra의전송언어재현/HTTPHTTPS와원본출처, Manager의문서/원장/검토·통합/새Full시작이다. 테스트assertion/gate를완화하지않고먼저각RED를확인한다. 추가된Tabstop은실제접근순서로반영하되48px·마지막actionfocus·권한/dirty/401/412는유지한다. 별도browsercontext의locale상속은설치버전에서실증전일괄변경하지않는다.

기존0.140.0/HIGH/OWNER_MANAGED/qa_required=true/release_authorized=false유지. 원본QualityPASS도새Head승인으로재사용하지않는다. 새Full시작까지진행하며완료모니터링/병합/Main·GHCR/Issue종료는제외한다.

## REWORK1 동결 source의 재검증과 인계

공유ContextHelp완성label중복, ProjectMaster기본행87px, 별도transport의locale누락을수정했다. 추가SSR관리화면4개미번역과안전한PROJECT_NOT_FOUND코드매핑누락도보완했다. 새번역편집은compact버튼/WorkspaceDialog를사용하며48px기본행·44pxcoarse·focus/Escape·401/412초안보존을유지한다. API/DB/권한·일정계산·LLM계약은재작업에서변경하지않았다.

동결source1209파일SHA256 `1b339a914781f565f496800808a6d38bc898cc01bdccb5ba7a204f70fb916d72`에서전체Unit295files3563tests PASS/기존1file3tests skipped(114.73초, `npm test -- --maxWorkers=2`), boundedChromium24/24 PASS(2.8분), typecheck/전체lint0errors18warnings/발견296Unit·874browsercase/Markdown397파일PASS다. 부하중Unit2회실패와중간browser21PASS/3FAIL을 [누적원장](../../ISSUE_866_FAILURE_ANALYSIS.md)에보존했다. assertion/timeout/retry/skip/Required검증은완화하지않았다.

[정제재검증](../../evidence/issue-866/rework-1-local-validation.json), [완성된VI관리화면390](../../../output/playwright/issue-866-ssr-admin/issue-866-project-master-admin-vi-390.png), [VI기준정보390](../../../output/playwright/issue-866-master-vi-390.png), [EN기본행1440](../../../output/playwright/issue-866-master-en-1440.png), [coarse390](../../../output/playwright/issue-866-master-coarse-390.png)에현재source의실제합성fixture근거가있다. 기존#719/최초구현캡처는덮어쓰지않았다.

분리된qa_docs의추가검토P1/P2미해결0이며사전Agent검토를인간최종QA/Owner승인으로사용하지않는다. 최신main352a43e74c7b34c72d952f67783a53463f8b519d/PR870은현재충돌없음·review threads0이다. 최종Head와시작Full Run/Attempt는STATUS댓글에기록하고완료결과를모니터링하지않는다. 새HeadRequired3/Trusted/Owner·Manager ACCEPT=NOT TESTED, MERGE_READY=BLOCKED, release_authorized=false이며병합/mainGHCR/Release/Issue종료는범위밖이다.

같은source의격리Dockerimage `sha256:ddccd3883ad2d125a2f162fbbfaf832f7882301eea740cb072e542033f764a83`에서productionbuild/설정거부6·잘못된설정의migration쓰기0/실제HTTPHTTPS2/2 PASS21.7초다. TLS·쿠키/Origin/revision/재시작·자격증명보호를유지했고5055Gitblob/1209sourceSHA가검사전후동일했다. ownedcontainer/volume잔여0·hostCA/hosts불변이다. [전송검증](../../evidence/issue-866/rework-1-final-transport.json)은로컬증거이며새원격Required3/MainGHCR성공이아니다. DOCUMENTATION_SYNC는추가코드·테스트·문서와다시대조했다. 최종CI시작과Head/Run정보는STATUS댓글을따른다.

## REWORK2 — Full3469.1 후속

Run41640034518/attempt1·Heada2b4766651f0a4fe9fbc2cf9f887f03e78ed1a19/Base352a43e74c7b34c72d952f67783a53463f8b519d/test-merge3260201076458249ab8e599c672cfca852634727에서quality/DockerPASS·E2EFAIL을확인했다. 원격실제1실패는미확보국가US2032문맥손실이며이전부터잠복해있던제품오류다. 기존도움말·행높이·전송오류는해당실행에서통과했다. [누적원장](../../ISSUE_866_FAILURE_ANALYSIS.md#pr870-full-002--full-34691-실패와-rework2-2026-11-03)에전체8Shard·출처·반례를보존한다.

국가·연도식별자를제출규칙/범위에대조하고고정안내·Preview상태를현재언어로표시한다. raw오류문구를기대하는3case4assertion은실제안전표시계약과비노출검증으로동기화한다. 추가보안감사에서확인한WBS비JSON/fetch예외는transport와dashboard/details에서함께안전오류로처리하며AbortError·stale/readiness·출처·권한·초안경계를유지한다. API응답/schema/DB/엔진알고리즘/CI정책변경없음, 버전0.140.0/HIGH/OWNER_MANAGED/qa_required=true/release_authorized=false유지다. 최종source동결후누적실패합집합+인접/음성소비자를검증하고PR870새Full을시작한다. 원격결과모니터링·병합·Main/GHCR/Release·Issue종료는범위밖이다.

REWORK2확대49진단은46PASS/3FAIL이었다. 신규locale테스트KO고정locator,충돌fixture의rawdetails기대,큰숫자표시의nogroup기대를교정했다. 추가QA의충돌label언어stale P2를구조화state/렌더시번역으로보완했다. server규칙UUID↔draftkey정확상관미지원한계와모든초안수정경로유지는[원장](../../ISSUE_866_FAILURE_ANALYSIS.md)에기록하며정확한충돌규칙특정을PASS로주장하지않는다.

B동결1211파일SHA256`b715f14349c42d05636f6bfbfbd14723c9558ac49195b31a126208e32166d83f`,snapshot`e1b41e1b6248f2422ee981fd35f4e4b575c5ee4b`에서전체Unit/35선별browser/동일image전송검증을진행한다. Bbrowser는A49중30+추가Issue5이며제외19case는A진단근거에만한정한다. Required3/874case/8Shard·모든기존보안/도메인/상태조건은유지한다. 실제최종결과와새Head/FullRun은후속정제명세·STATUS를따른다.

B최종Local Fast Feedback는전체Unit3632PASS/기존3skip145.16초·선별browser35/35PASS9.3분·typecheck/전체lint0errors18warnings PASS다. 동일Bimage `sha256:7c0365429908a4063785371bcb3133b79dc7363bfd67b3084f5bdc4c30080a64`의productionbuild/기존HTTPHTTPS2/2PASS23.0초·설정거부6·invalid migration writes0·5082blob/1211source불변/ownedcontainer·volume잔여0을확인했다. [B명세](../../evidence/issue-866/rework-2-local-validation.json)·[전송명세](../../evidence/issue-866/rework-2-final-transport.json)·[선정35목록](../../evidence/issue-866/rework-2-browser-selection.txt)을따른다. [영문미확보](../../../output/playwright/issue-866-rework2/unavailable-en.png)·[베트남어충돌](../../../output/playwright/issue-866-rework2/calendar-conflict-vi.png)에서안전한문맥·현재언어/원문이름보존을확인할수있다. 원장·Security/I18N/TestPlan/Calendar지침/Changelog·DOCUMENTATION_SYNC를실제변경에맞춰갱신했다. 새Head원격quality/e2e/docker/Trusted·Owner/Manager승인은NOT TESTED이며새Full시작과출처는STATUS댓글을따른다.

## REWORK3 — Full3470.1 후속 (2026-11-04)

원본Run41650170956/attempt1·Headbfe2362a9b0d79128c4fd7e2e97a69f3e699f2d9/Base352a43e74c7b34c72d952f67783a53463f8b519d/test-merge74739b5a83ef1aec258b492e4a2e01c4674279d8는quality/DockerPASS·E2EFAIL이었다. #725공정제목의literal HTMLentity를기대원문으로복원하는잠복i18n오류이며이전보완의재발은아니다. 전체8Shard150PASS/1FAIL/723미완료·sourceartifact/API귀속·Trusted파생FAIL·로컬RED는 [누적원장](../../ISSUE_866_FAILURE_ANALYSIS.md#pr870-full-003--full-34701-실패와-rework3-2026-11-04)에보존한다.

정적JS번역문구5곳/canonicalcatalogkey·값을정규화하고기존coverage에entity의미검사를추가한다. 정상JSX/사용자입력/미등록문구/XMLescaping은불변이며runtimeHTMLdecoder/새dependency를추가하지않는다. #725실제업무/재시작·물류readonly/반응형과KO/EN/VI·쓰기0검증을확장한다. source동결후누적실패·직접/인접/음성검증과문서정합성을확인한뒤기존PR870에새Full을시작한다. HIGH/OWNER_MANAGED/버전0.140.0/qa_required=true/release_authorized=false 및모든원격승인경계는유지한다.

REWORK3 B동결1211파일SHA256`fb8aef37f15108c26761ad1bf26331cfd04371bd906217932a495843f322c387`/tree`d025c60976e184d424cd642f0852c7e7b46f21df`에서전체Unit3636PASS/기존3skip111.65초·직접6/6PASS2.4분+과거실패35/35PASS8.3분(고유41case/13spec), typecheck/전체lint0errors18warnings/발견297Unit·874browsercase를확인했다. B image`sha256:4b533dad06eaf16770fccb2f3155457ebe43f71494327d1383ee12b74062db08`의build/HTTPHTTPS2/2PASS21.2초/negative6·invalid migration writes0·5096blob/1211source동일/시험자원정리도PASS다. 이전A의새probe가정실패2건과guard부분교정FAIL을원장에보존했고기존단언/공유helper/timeout/retry를완화하지않았다.

[검증명세](../../evidence/issue-866/rework-3-local-validation.json), [전송명세](../../evidence/issue-866/rework-3-final-transport.json), [영문공정제목](../../../output/playwright/issue-866-rework3/process-heading-en.png), [베트남어readonly](../../../output/playwright/issue-866-rework3/readonly-notice-vi.png)에실행증거와범위를보존한다. 문서I18N/TestPlan/Changelog/WorkPacket·누적원장을동기화하며독립사전검토미해결P1/P2=0은인간QA·Owner·Manager승인을대체하지않는다. 최신PR출처·새Full시작은STATUS댓글에기록하고완료모니터링·병합·릴리스는수행하지않는다.

## REWORK4 — Full3471.1 물류 유형 검색 터치 높이 (2026-11-04)

[Full #3471.1 / Run41704268626](https://github.com/planner77/masterGantt/actions/runs/41704268626)는 Head3ef679d/Base352a43e/test-merge66db3d0의 Quality·Docker SUCCESS, E2E Shard3 직접 FAILURE(기대44px/실제20px), QA 파생 FAILURE였다. 계획874case 중 188 PASS/1 FAIL/1 기존 SKIP/684 미완료·미실행이며 나머지7Shard는 CANCELLED다. [누적 실패 원장](../../ISSUE_866_FAILURE_ANALYSIS.md#pr870-full-004--full-34711-실패와-rework4-2026-11-04) 및 [Run 정제증거](../../evidence/issue-866/ci-41704268626-attempt-1.json)를 따른다.

#866의 이름/코드 검색 input이 .panel 직속 label에 있어 기존 .addRow/.dialog 입력높이 규칙에서 누락됐다. REWORK4는 기존 CSS 공통 높이 var(터치44px)를 해당 label/input에 재사용한다. 기존 tests/e2e/logistics-table-density.spec.ts의 5폭·Keyboard·coarse 검증을 EXTEND해 검색 입력을 정확한 label로 확인하고 범용 컨트롤 높이 assertion을 유지한다. ADD 별도 중복 Spec은 만들지 않으며 이전 원격 실패와 인접·음성 테스트는 KEEP_UNIQUE다. source 계약(검색/번역/권한/DB/API/LLM)과 CI/QA·8Shard·skip/retry/timeout·릴리스 권한은 변경하지 않는다.

실험 증거는 실제 앱 E2E가 아닌 synthetic Chromium144/Playwright390px hasTouch CSS cascade의 RED21px→GREEN44px에 한정한다. GitHub connector-only 환경이므로 새 Head 로컬 Vitest/Playwright/Build/HTTP HTTPS는 NOT TESTED이고 exact Head 공식 Full CI를 시작해 별도 확인한다. 이번 문서 동기화는 원장·Work Packet·보조 Run evidence에 한정하며 설계와 기존 QA/보안 계약 문서는 변경 필요 없음. 최신 리뷰0·PR mergeable/main정렬은 게시 직전후 검토하고 결과 모니터링·병합·Main/GHCR/릴리스·이슈 종료는 수행하지 않는다.

## REWORK5 — Full3472.1 Optional 번역 payload 회귀 (2026-11-04)

[Full #3472.1 / Run41710299107](https://github.com/planner77/masterGantt/actions/runs/41710299107), Head `0f9cc15ac140a19b06e9fe519c0883b3f9d58970`, base `352a43e74c7b34c72d952f67783a53463f8b519d`, Quality/Docker SUCCESS·E2E Shard3 직접 FAIL·QA 파생 FAIL. 계획874중 실제156PASS/1FAIL/1SKIP/716미실행·미완료. 지난 #3471의 44px 검증은 이번 원격에서 PASS, 그 다음 legacy request body expect에 추가된 `translations:{}` 때문에 FAIL이다. [원장](../../ISSUE_866_FAILURE_ANALYSIS.md#pr870-full-005--full-34721-실패와-rework5-2026-11-04) 및 [원본 증거](../../evidence/issue-866/ci-41710299107-attempt-1.json)를 따른다.

서버 계약은 optional translations 생략=보존, `{}`=전체 해제다. UI의 기본 빈 translations를 create/name-only PATCH에 무조건 넣어 해당 계약을 침해하므로, 실제 변경 시만 전체 replacement를 전송하는 pure helper와 UI 수정을 선택했다. 기존 #454 E2E 정확 body·If-Match 단언은 KEEP_UNIQUE, 동일 test 양쪽 설비/시스템 탭에 번역추가/무변경/전체해제 경로 EXTEND, 새 pure helper 4 Unit case ADD. 지원 신규 E2E spec 없이 기존 계획의 8Shard/874case 유지. Fixture는 API의 omit/replace/empty-clear semantics를 모사하도록 보완한다.

문서 동기화: `docs/I18N.md`(optional writer semantics) UPDATED, `docs/API.md`(Logistics Catalog optional translations) UPDATED, 본 Work Packet·원장·Run evidence UPDATED. DESIGN/UI_UX/DB_SCHEMA/SECURITY/CI_CD/REMOTE_VALIDATION N/A(렌더링·schema·권한/Workflow 변경 없음). 단일 helper Git blob `1370fa201453fc867bd4bc5d1c74617f103a2556`를 isolated Node22.16/TS5.8.3 strict typecheck 및 11 직접 assertions PASS했으나 제품 E2E/Unit 전체/Production Docker는 **NOT TESTED**. 같은 PR의 새로운 exact-Head Full을 시작하되 결과 모니터링 없음. HIGH/OWNER_MANAGED/qa_required=true/release_authorized=false 유지, Merge/Main/GHCR/Release/Issue 종료 금지.
