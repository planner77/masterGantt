# Issue #572 — Inline 이름 저장·Revision·SVAR 표시 일관화

## 승인 범위와 기준 (2026-10-11)

사용자의 현재 요청은 구현, 관련 문서 갱신, 독립 PRE_QA 및 PR CI 시작까지다. Issue 본문의 이전 등록 전용 범위는 이 요청으로 대체한다. CI 결과 모니터링, 병합, main/GHCR, release, branch 정리, Issue 종료는 수행하지 않는다.

- repository: planner77/masterGantt, [Issue #572](https://github.com/planner77/masterGantt/issues/572).
- lifecycle_phase: PRE_QA_VALIDATED → PR_CI_START_READY. 기준 main `2815d7b3de273afaaed301e6f0fc5d0071ce2b24`.
- branch: `fix/issue-572-inline-name-consistency`, worktree `/tmp/mastergantt-572`.
- 선행 #568/#570 및 #571 PR #610 Head `eb8eebfd29261bcc4c271b0ad9c1c17b0480c03c`는 main에 포함되어 stacked branch가 필요하지 않다. 착수 시 #572 기존 PR/branch 없음.
- version: 기존 기능 회귀 수정 PATCH `0.104.2 → 0.104.3`. package.json/lockfile/CHANGELOG를 함께 갱신한다.
- release_required=true, release_authorized=false. release 승인은 요청에 포함되지 않았다.
- risk_level=HIGH, qa_required=true, qa_method=AGENT, qa_review_mode=qa_docs. 반복된 canonical/native 비동기 상태·focus 경합과 저장 영속성 회귀 영역이다.
- reviewer: `/root/issue570_qa_fix`; pre_qa=PASS(PR CI 시작 범위), qa_final=NOT TESTED, manager_decision=NOT TESTED. 보호된 manifest/lock 변경의 최종 인간 QA_FINAL·필수 CI·Owner ACCEPT는 사용자 제공 AGENTS #595의 gate를 유지하며 Agent PRE_QA로 대체하지 않는다.
- issue_comment_writer=manager; 모든 공식 Issue 기록은 Manager만 작성한다. 구현/검토 Agent는 댓글 후보만 반환한다.

## 목표·비범위·현재 사실

서버 ProjectSnapshot/revision이 저장 authority이며 React DTO, SVAR ITask.text, Grid/Chart 이름 표시를 같은 확인된 이름으로 연결한다. native text editor를 유지하고 Enter/Tab/pointer blur를 단일 name-only PATCH gateway로 보낸다. Escape는 저장하지 않는다. trim·well-formed Unicode 1~200·문자열 `001` 규칙은 기존 validator를 재사용한다.

현재 세션의 committed flag는 중복 PATCH만 차단하며 requestId와 confirmed revision이 없다. project revision effect가 정상 성공 응답에도 token/session을 초기화할 수 있고 실패 finally는 draft를 지운다. 이 정적 위험을 CI #2278 Grid 표시 실패의 확정 원인으로 단정하지 않는다. 선행 #571의 blur capture와 Escape token/API guard를 보존하며 baseline과 통제 회귀로 실제 증거를 구분한다.

비범위는 서버 rename API·Task schema·DB·Scheduling·인증/권한·Import/Export 재설계, 새 에디터/PRO, viewport writer/projection 전면 교체, #552 표시 전환이다. main에는 #552 Milestone WBS 분리 stack이 미통합이다. 현재 main의 Milestone 기능을 임의 제거하지 않으며 현재 projection에서 제외된 Milestone을 rename 때문에 WBS로 다시 주입하지 않는다. 미통합 Dashboard 경로 검증은 NOT TESTED로 분리한다.

## UX 및 구현 계약

AppShell → Project Workspace → toolbar → 기존 native Grid/Chart 배치는 유지한다. 이름 셀에 기존 Core input, 연결된 inline 오류/status를 사용한다. 새 dialog·error summary·시각 체계는 도입하지 않는다.

상태는 Idle → Editing(taskId/baseRevision/editorSession/rawDraft) → Committing(requestId/name/cause) → AwaitingConfirmation(정확한 응답 taskId/revision/name) → Confirmed 또는 Rejected(rawDraft/error)다. 저장 성공과 React canonical/Core/mounted Grid 표시 완료는 별도다. 응답은 동일 session/request/API에서만 현재 UI에 귀속하고 최신 revision을 덮지 않는다. 가상화로 셀이 없으면 getter와 canonical payload를 유지하고 remount 후 확인하며 DOM textContent를 직접 쓰지 않는다. 무한 polling·RAF를 추가하지 않는다.

| 입력/상태 | 동작 |
| --- | --- |
| Enter, 비조합 | 한 번 저장하고 현재 세션의 이름 셀 focus를 보존한다. |
| Tab/Shift+Tab | 같은 gateway로 한 번 저장하고 native 다음/이전 focus를 보존한다. |
| pointer blur | 클릭 도착 대상과 toolbar 동작을 보존한다. 늦은 결과가 focus를 탈취하지 않는다. |
| Escape, 비조합 | PATCH 0회, 초안 취소, 현재 session/API에서만 원래 셀 focus 복원. |
| IME Enter/Escape | 조합 키를 앱 저장/취소로 소비하지 않는다. 실제 OS IME와 합성 composition 증거를 구분한다. |
| 잘못된 이름/변경 없음 | 잘못된 이름은 PATCH 0회·input/aria 오류 유지, trim 후 변경 없음은 PATCH 0회. |
| Committing/새 세션/늦은 응답 | 단일 request, 중복 PATCH 없음. 오래된 결과로 새 초안/focus/표시를 덮지 않는다. |
| 409/network/5xx | canonical 이름 유지, 실패 draft를 메모리에 보존, 자동 재전송 없음. |
| 401/412 | 기존 readonly/stale 경계와 명시 재조회 유지. 실패 draft를 새 revision으로 자동 전송하지 않는다. |

실패 draft 재개는 같은 작업의 명시 재편집에 한정하고 Project/API/Task identity 및 revision 경계를 검사한다. 412 뒤 명시 조회로 revision이 진행되어도 conflict 초안은 이전 base로 재열어 보존하고 저장을 막는다. Escape로 초안을 명시 폐기한 뒤 새 canonical 이름을 재편집해야 하며 새 base로 묵시적 승격하지 않는다. 입력이 이미 다른 곳으로 이동한 경우 오류 알림이 focus를 뺏지 않는다. 390/768/1024/1440px에서 input·오류·focus와 Grid 소유 overflow를 확인한다. metadata 이름 변경은 #570/#571 경계를 따르며 instance/tree/selection/columns/viewport/일정/Link/Resource 계획을 불필요하게 바꾸지 않는다.

DESIGN Delta B: 기존 precise feedback·SVAR-native·상태 보존·keyboard/focus 원칙의 구체화다. ui-ux-pro-max의 targeted UX 검색에서 오류 명확성·blur 후 focus 탈취 방지만 채택했다. `DESIGN.md: N/A — 신규 공통 원칙 없음`. 화면 계약 문서를 갱신한다.

## 파일 소유권과 handoff

| 담당 | 단독 쓰기/책임 |
| --- | --- |
| frontend `/root/issue570_frontend_fix` | project-gantt.tsx inline 연결, task-editor-model.ts saved 확인 정보, project-readonly-view.tsx 정확한 응답 연결 최소 범위, inline E2E |
| domain `/root/issue571_unit` | 신규 inline-name-session.ts 순수 상태 머신·전용 Unit, 독립 파일 inline-name-persistence.spec.ts 실제 Next/SQLite 회귀 |
| infra `/root/issue571_ci_failure` | branch/worktree, package.json/lockfile, Manager gate 후 원격 commit/PR/CI 시작 |
| Manager `/root` | 이 Work Packet, PLAN, CHANGELOG 및 모든 관련 문서·Issue 기록·통합 |
| ui_ux `/root/issue571_ux`, researcher `/root/issue571_research` | read-only interaction·공식 SVAR/설치 코드 검토 |
| qa_docs `/root/issue570_qa_fix` | 구현과 분리된 read-only AC/code/test/docs 및 독립 PRE_QA |

동일 파일을 동시에 수정하지 않고 타인의 변경을 되돌리지 않는다. frontend와 domain은 export/interface를 먼저 합의한다. browser port3100은 frontend 단독 사용 뒤 서버를 닫고 QA에 인계한다. 실행 중 소스 변경 없이 manifest로 고정하고 runtime DB·로그·생성물은 커밋하지 않는다.

## AC와 검증 계획

| AC | 계획/증거 |
| --- | --- |
| AC1 | Stable leaf → Blur saved 실제 Grid/Chart·reload 유지, PATCH 1회, If-Match·revision 일치. |
| AC2 | Enter/실제 Tab·ShiftTab/pointer blur/Escape/IME·001·0/201자·readonly·401/409/412/network·linked/nonlinked·4폭. 실제 OS IME는 별도 환경 경계. |
| AC3 | TaskEditor↔Grid 동일 canonical 이름, revision conflict·늦은 응답·Core instance/viewport 보존·가상화 후 표시. |
| AC4 | 승인된 inline/adapter/test 범위와 TASK_EDITOR/TEST_PLAN/PROJECT_UX 및 필요한 ARCHITECTURE 동기화, #140/#258 계약 유지. |
| AC5 | 독립 PRE_QA 뒤 exact-head PR CI Quality/E2E/Docker 시작. CI 결과·QA_FINAL·Manager ACCEPT 전 제품 전체 완료 선언 금지. |

공식 문서의 현재 API와 설치 Core2.7.3 실행 순서를 구분하며 researcher의 URL·코드 근거를 아래에 연결한다. `api.exec` 반환은 렌더 완료 증거가 아니다. 관련 Unit/targeted Chromium/typecheck/lint/version/Markdown 검사만 Local Fast Feedback으로 수행하고 전체 회귀는 GitHub Actions에 맡긴다. 원격 실행을 시작한 뒤 결과 모니터링은 하지 않는다.

## DOCUMENTATION_SYNC

- required: TASK_EDITOR.md, PROJECT_UX.md, TEST_PLAN.md, ARCHITECTURE.md, CHANGELOG.md, ISSUE_572.md, PLAN.md.
- API.md/DB_SCHEMA.md/SCHEDULING_ENGINE.md/SECURITY.md/IMPORT_SCHEMA.md: N/A — 서버·도메인·권한·교환 계약 변경 없음. 실제 diff에 영향이 생기면 재판정한다.
- DESIGN.md/UI_UX_GUIDELINES.md: N/A — 상위 기존 원칙의 화면별 구체화이며 새 공통 규칙 없음.
- CI_CD.md/REMOTE_VALIDATION.md/DEPLOYMENT.md: N/A — workflow/required checks/배포/원격 증거 계약 변경 없음.
- AGENTS.md: N/A — 실행/QA 신뢰 정책 변경 없음.

현재 계약을 반영한 문서와 항목별 영향 기록이다. required7문서와 코드·AC 정합성의 별도 qa_docs 의미 검토 PASS를 확인했다. 최종 원장의 실행 증거 추가분을 다시 확인한 뒤 이 후보를 PR CI 시작에 인계한다. 이는 원격 CI·QA_FINAL·Manager ACCEPT의 PASS가 아니다.

- `docs/TASK_EDITOR.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/ISSUE_572.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `DESIGN.md`: N/A(기존 precise feedback와 상태 보존 원칙의 화면별 구체화이며 신규 공통 원칙 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(새 공통 interaction 규칙 없이 화면별 inline 세칙만 TASK_EDITOR와 PROJECT_UX에 반영)
- `docs/API.md`: N/A(서버 endpoint와 Task PATCH shape 및 revision authorization 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(스키마와 migration 및 영속 원장 의미 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(name-only 기존 metadata 경로 사용으로 일정 알고리즘과 날짜 계산 변경 없음)
- `docs/SECURITY.md`: N/A(서버 session Origin If-Match 권한 검증 불변)
- `docs/CI_CD.md`: N/A(CI workflow required checks 권한과 버전 정책 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(로컬 원격 환경별 증거 경계와 CI 운영 계약 불변)
- `AGENTS.md`: N/A(Agent 역할 및 QA 신뢰 gate 정책 변경 없음)

## AC_TEST_COVERAGE

- AC1: project-gantt-inline-name.spec.ts의 기존 blur·reload·PATCH/If-Match 검증 및 새 실제 Tab과 inline-name-persistence.spec.ts의 실제 Next/SQLite 경로. 최종 실행 결과는 아래 원장으로 구분한다.
- AC2: 기존 inline native 4건과 신규 실패 draft·Tab/ShiftTab·blur focus·composition·오류 경계, pure inline-name-session.test.ts. 실제 OS IME는 NOT TESTED이며 합성 이벤트로 대체하지 않는다.
- AC3: TaskEditor 양방향·가상화·지연 응답·revision·instance/viewport 회귀. 부모 canonical acceptance와 Core/Grid 확인을 별도 검증하고 최종 실행 근거를 기록한다.
- AC4: inline 전용 제품/adapter/test 소유권과 required7문서 동기화, DESIGN Delta B 및 #140/#258·미통합 #552 적용 경계. 독립 의미 검토 전 Gate PASS 아님.
- AC5: 독립 PRE_QA와 새 exact-head PR CI 시작을 분리한다. required Quality/E2E/Docker 및 QA_FINAL/Manager ACCEPT는 미완료이며 timeout/skip 완화 없이 최초 FAIL 원장을 보존한다.

## 실행 원장

BRANCH_READY: local/remote branch와 baseline 확인, version check·diffcheck PASS. Next16.3.8/Core2.7.3와 동일 dependency lock을 확인하고 실체 node_modules를 준비했다. 제품 구현·검증·문서 완료·독립 PRE_QA·PR CI는 진행 전/진행 중이며 공식 quality/e2e/docker·main/GHCR·QA_FINAL·Manager ACCEPT는 NOT TESTED다.

### 변경 전 직접 관측

- `/tmp/issue572-inline-baseline4.log`: 기존 inline Chromium 4 PASS(29.5초). #571 보완이 이미 포함된 main의 결과이며 과거 CI #2278/비교 stack #562의 Grid 표시 FAIL을 소급 PASS로 바꾸지 않는다.
- `/tmp/issue572-draft-before.log`: 신규 실패 draft 재진입 Chromium 1 FAIL. 500 응답 뒤 canonical `Stable leaf`는 유지되지만 명시 재편집 input도 `Stable leaf`이며 요청했던 `보존할 이름 초안`이 소실됐다. PATCH는 1회다. 이 통제 실패를 저장 성공 뒤 Grid 표시 문제의 확정 원인으로 확대하지 않는다.

### 첫 통합 및 보완

- 순수 FSM 27 Unit PASS, 전용 lint PASS. 통합 중 sessionId 전달 누락으로 전체 typecheck 1 FAIL을 보존하고 연결 후 typecheck PASS를 확인했다. 이 합성 Unit은 Core/브라우저/OS IME 검증이 아니다.
- `/tmp/issue572-inline-after5.log`: 4 PASS/1 FAIL(26.7초). 신규 실패 draft 복원은 PASS, 기존 compositionstart→Enter에서 input이 사라져 FAIL이다. Core child 저장 키 전달은 막되 IME의 브라우저 기본 동작을 preventDefault하지 않는 경계로 보완했다.
- `/tmp/issue572-inline-after5b.log`: 같은 5건 5 PASS(25.8초). 실제 OS IME는 여전히 NOT TESTED다. 이 결과를 이후 추가 보완/새 테스트의 PASS로 확대하지 않는다.
- 가상화 행이 없는 경우 서버 저장을 실패로 바꾸지 않고 화면 확인 대기로 분리한다. 초기 관찰은 유한 예산이며 동일 API/session/request의 후속 실제 mount는 MutationObserver로 확인한다. 새 세션/Project/API/unmount에서 observer·RAF·timer를 해제하며 새 scroll writer나 DOM 문자열 수정을 추가하지 않는다. 최종 추가 회귀·독립 검토는 별도 원장에 기록한다.
- `/tmp/issue572-focus3.log`: 새 실제 Tab/Shift+Tab·pointer blur 지연 응답 3건 모두 FAIL. Tab/Shift+Tab은 PATCH 0회로 저장 요청에 도달하지 않았으며 pointer Week 클릭은 PATCH 1회지만 응답 전 toolbar focus가 유지되지 않았다. 이전 toolbar blur PASS를 실제 Tab 또는 focus 완료 증거로 쓰지 않는다. Core 키/닫기 focus 순서를 보완하며 기대값·timeout은 완화하지 않는다.
- 설치 Core의 Tab hotkey가 preventDefault 후 다음 open-editor를 요청하지만 현재 앱 session guard가 이를 차단해 저장되지 않는 경계를 확인했다. 이름 input의 Tab은 Core hotkey 전파만 막고 브라우저 기본 이동과 공통 blur gateway를 사용한다. pointer blur의 실제 activeElement는 이전 이름 Grid cell이었으며 editor close의 Core focus 복원과 연결된다. [공개 focus-cell API](https://docs.svar.dev/react/grid/api/actions/focus-cell/)의 row/column은 optional이다. 설치 구현과 실제 검증에서 빈 payload로 이전 focusCell을 해제한 뒤 close-editor를 실행해 도착 focus를 보존한다. 공식 문서만으로 빈 payload의 해제 동작을 단정하지 않는다.
- 후속 통제 focus 3건은 3 PASS(12.4초): 실제 Tab/Shift+Tab 각각 PATCH 1회와 최종 성공 문구·도착 focus, pointer Week의 pending·완료 focus다. 최종 추가 회귀는 별도 원장에 기록한다. 진단용 focusCell 읽기는 제품 기능으로 남기지 않는다.
- `/tmp/issue572-stale-ime2.log`: 2 PASS(11.2초). 412 뒤 명시 조회·이전 base 초안 보존·저장 차단·Escape 명시 폐기와 합성 composition blur의 Core clickOutside 경로 PATCH 0회/원문 유지다. 실제 OS IME 조작이나 미통합 #552 Dashboard PASS를 의미하지 않는다.
- 실제 SQLite 첫 단일 Chromium case는 기본 30,000ms 초과로 FAIL(31.3초)이다. Enter/Tab·Task Editor·reload와 실제 프로세스 재시작 뒤 GET까지 진행했으나 이후 reload 표시 확인은 완료하지 못했다. 완료 전 단계를 전체 영속성 PASS로 쓰지 않는다. timeout을 늘리지 않고 새 fixture의 저장·Editor/reload와 최소 rename·프로세스 재시작 두 case로 나누며 기존 assertion을 유지한다. 임시 config의 reporter 경로 오류와 sandbox 동적 port EPERM은 제품 실패와 구분하고, repo config 변경 없이 임시 reporter 지정 및 허용된 실행으로 해결했다.
- `/tmp/issue572-inline-final11.log`: 제품 freeze 후 native inline Chromium 11 PASS(1.1분). 실제 Tab/Shift+Tab·pointer focus, draft 재진입·412 재조회 경계·합성 composition blur, 유한 확인 대기 종료 후 가상화 remount와 기존 4폭 회귀를 포함한다. 이후 409 실패 입력 추가는 테스트만의 변경으로 해당 case를 별도 다시 검증한다. 관련 5파일 Unit 100 PASS, typecheck PASS, 관련 lint 0 error/기존 경고 3개다. 격리 Next가 생성한 설정 경로는 게시하지 않으며 서버 종료 후 원래 설정으로 typecheck를 재확인한다.
- `/tmp/issue572-409-evidence3.log`: 제품 변경 없이 409를 추가한 실패 case 및 pointer/draft 회귀 3 PASS(29.4초). 임시 capture 문장은 제거하고 최종 테스트 lint PASS다. 합성 fixture의 확정 이름 1280px·복원 draft 390px 캡처는 `docs/evidence/issue572/`에 제한적으로 저장한다. 화면 캡처를 동작·실제 SQLite·OS IME·전체 회귀 PASS로 사용하지 않는다.
- 실제 Next/SQLite 최종 2 case PASS(59.9초, 각 본문 12.6초/16.8초): route mock 없는 Enter·Tab name-only PATCH·If-Match/revision, Tab 뒤 reload·Grid/Chart/Task Editor 양방향, 같은 SQLite와 실제 새 Next 프로세스의 API/reload/Editor 일치 및 일정·Link 보존이다. 기본 30초를 유지했고 fixture별 역할을 나눈 보완이며 제품 수정·assertion 삭제는 없다. 해당 E2E lint/typecheck PASS, 제품 3파일 SHA-256 실행 전후 동일이다. 독립 파일 담당 실행 receipt는 최초 FAIL `53377a`, 최종 2 PASS `207c80`, lint `0e44e1`, typecheck `20b15f`, 해시 전/후 `04a1aa`/`5afe52`다. 별도 stdout 파일은 없고 최초 trace는 같은 outputDir의 후속 실행으로 정리되어 현재 보존된 artifact로 주장하지 않는다. 최종 PASS trace는 retain-on-failure 정책상 생성되지 않았다.

### 공식 API·설치 코드 근거

확인일 2026-10-11. [Gantt Grid columns](https://docs.svar.dev/react/gantt/guides/grid/columns/)와 [Grid inline editors](https://docs.svar.dev/react/grid/guides/configuration/inline_editors/)의 native text editor를 유지한다. [Grid open-editor](https://docs.svar.dev/react/grid/api/actions/open-editor/), [close-editor](https://docs.svar.dev/react/grid/api/actions/close-editor/), [update-cell](https://docs.svar.dev/react/grid/api/actions/update-cell/)의 공개 action/intercept로 단일 gateway를 구성한다. `close-editor({ignore:true})`는 편집 값 적용을 취소하는 계약이며 이미 전송한 HTTP 요청을 취소하거나 서버 rollback하는 API가 아니다.

[getTable(true)](https://docs.svar.dev/react/gantt/api/methods/gettable)는 Table readiness Promise, [getTask](https://docs.svar.dev/react/gantt/api/methods/gettask/)는 현재 Core Task 읽기다. [update-task](https://docs.svar.dev/react/gantt/api/actions/update-task/)를 서버 commit으로 취급하지 않으며 [api.exec](https://docs.svar.dev/react/gantt/api/methods/exec/)의 공식 반환은 void다. 설치 EventBus의 thenable resolution도 React/native 렌더 완료 증거가 아니다.

설치 Gantt2.7.3 내부 React Grid2.7.4/Grid store2.7.3/Gantt store2.7.2의 실행 순서는 `close-editor → update-cell → editor 정리`이며 앱의 앞선 Table interceptor가 원본 native update를 차단한다. 숫자 coercion 전에 mounted input 원문을 읽고 기존 normalizer를 사용한다. 현재 공식 문서는 Gantt2.8 계열 자료이므로 설치2.7.x dist의 관측과 구분하며 URL/소스 조회를 공식 demo의 실제 조작 PASS로 보고하지 않는다. 공식 inline guide는 이 앱의 서버 confirmation이나 OS IME 동작을 보장하지 않는다.

read-only researcher가 확인한 설치 source SHA-256:

- `node_modules/@svar-ui/grid-store/dist/index.js`: `e0a199099c788a8a3ef1437a262791e8e4bae16e0785e412267c4a17c5035527`.
- `node_modules/@svar-ui/react-grid/dist/index.es.js`: `c53cab7381b29f9e1b1190e91e22d41c908030080477481ec76bf40f07273ed7`.
- `node_modules/@svar-ui/react-gantt/dist/index.es.js`: `77eb434954f1ed1a1af5b78eb82c24bc3053d1ea92062a83bc7ae3b8adff98043`.

EventBus interceptor는 prepend 순서이며 false에서 후속 체인을 중단한다. Gantt wrapper의 기본 update-cell→update-task 번역보다 앱 interceptor가 먼저 실행되어 단일 PATCH 경계를 유지한다. `getTable(true)`의 설치 readiness timer는 Table API 사용 가능성만 나타낸다.

## 최종 후보와 인계

제품과 테스트는 다음 SHA-256으로 동결했다. runtime DB·원본 로그·trace·생성된 Next 환경/TypeScript 설정은 게시 대상에서 제외한다. UI 증거는 합성 fixture PNG 2개와 capture-manifest만 포함한다.

| 파일 | SHA-256 |
| --- | --- |
| src/features/gantt/project-gantt.tsx | 6ebd212012f3ae1c4cbea7a6a3b8b6bb94b40e666a77db23bd02fe042bc4d258 |
| src/features/gantt/task-editor-model.ts | 3d2c62dc170317071c80689158637edb1dbe0ea98dc1594303133ea0efd64dd6 |
| src/features/projects/project-readonly-view.tsx | 23db4920122f39437f96cef9256b83e167b5294e168aa4a05fb2df7a37f67dcf |
| src/features/gantt/inline-name-session.ts | 14a83d0aeeee8f330e09151c90e320920370aaa23f3c6bb056810b8199fd978b |
| tests/features/gantt/inline-name-session.test.ts | cb53908d7fd940e6672e0a66fae9173b7a52e2a8bd8051d8594f5156be3bb0f5 |
| tests/e2e/project-gantt-inline-name.spec.ts | 453688eb01b4a79671e7239fec953bea1e8f6ecf78bdf948063da2d2e1f8a8a1 |
| tests/e2e/inline-name-persistence.spec.ts | ba485de18930e45decf6b3aa209c5527df8edc684ad327cc1c1ede4f639132ca |

독립 Reviewer `/root/issue570_qa_fix`는 동결된 제품·테스트 7항목의 실행 전/후 지문 일치, 관련 Unit 5파일100 PASS(425ms, receipt `f8cb1e`), Chromium inline 11 PASS(41.6초, `/tmp/issue572-independent-inline11-allowed.log`)를 확인했다. 코드·AC·required7문서 의미 검토에 신규 지적이 없어 PR CI 시작 범위의 PRE_QA PASS다. 최초 독립 browser 준비의 sandbox webServer exit1은 테스트 실행 전 환경 실패(`/tmp/issue572-independent-inline11.log`)로 별도 보존했으며 제품 FAIL/PASS로 쓰지 않는다. 실제 SQLite 2 PASS는 담당자의 별도 실행과 QA의 spec/원장 검토이며 QA 독립 SQLite 실행으로 확대하지 않는다. 서버를 모두 종료하고 Next 생성 설정 2개를 baseline으로 복원했으며 게시하지 않는다.

baseline 설정 복원 뒤 Manager의 최종 `npm run typecheck` exit0(receipt `f97198`)다. version·변경 lint·Markdown180파일 link·diffcheck 및 Work Packet DOCUMENTATION_SYNC/AC1~AC5 구조 검사를 통과했고, 구조 PASS와 별도 의미 검토를 구분한다. 제품과 테스트의 최종 지문은 위 표와 동일하다.

최신 canonical 역순 응답 차단은 FSM·기존 canonical-snapshot-recovery Unit 및 부모 코드 검토의 분리 증거다. 새 지연 browser case는 focus 보존이며 부모의 실제 역순 응답 통합 경쟁 자체는 NOT TESTED로 구분한다. 실제 OS IME·미통합 #552 Dashboard·원격 quality/e2e/docker·QA_FINAL·Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED다. 원격 main과 작업 branch는 게시 준비 시 baseline과 동일함을 재확인했다. 실행·문서 기록까지 포함한 정확 후보를 커밋해 새 PR의 full CI 시작만 확인하며 결과 모니터링·병합·후속 lifecycle은 수행하지 않는다.
