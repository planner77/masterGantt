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
