# Issue #885 failure/verification ledger — append-only

## 2026-11-07 885-PLAN-001
- Baseline main `f3f8b89ef09bab35987b32f4945dac91b6fa223a`, Scope Issue/Task MDXEditor + SQLite 0038.
- Context: GitHub connector supports remote file/commit/PR operations; local package installation, browser/SQLite runtime unavailable.
- **NOT TESTED**: static source review is not build/E2E/CI PASS. Risk: MDXEditor client-only initialization and lockfile resolver; read-only Markdown grammar, raw HTML rejection; form-focus and existing suite migration.
- Mitigation: exact v3-lock dependency closure from published packages, tests and docs, no CI/workflow gate weakening. Observe no CI output after requested PR trigger.
- Resolution: initial implementation branch committed; PR Full CI started via opening PR after docs/tests. If CI fails, register exact run+attempt and fix in a new authorized follow-up; do not mark as PASS.

## F885-001 — 2026-11-07 Full PR CI #3556.1 직접 실패 / 리뷰 P1

- 원본: [PR #887 Full CI #3556.1 Run 42362045811 attempt 1](https://github.com/planner77/masterGantt/actions/runs/42362045811), Head `d73f64aa3566d374d8a7213736b96b329f508296`, Base main `f3f8b89ef09bab35987b32f4945dac91b6fa223a`, GitHub generated Test Merge `ce9bdf129e9a41aa010713b9d448e5d724a0c583`. Original conclusion **FAILURE** (불변).
- 직접 원인: QA Preflight — 정책·문서 사전 검사 Job `128372373107` 에서 `DOCUMENTATION_SYNC`: `docs/exec-plans/active/ISSUE_885.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — DOC_SYNC 기록 누락`. 정확한 parser는 `scripts/qa_final_automated.py:docs_gate`, 경로별 `- \`path\`: UPDATED` 또는 `- \`path\`: N/A(reason)`(한 줄 종료) 및 각 `AC01`~`AC10` 단독 bullet 필요. 이전 Work Packet에는 `UPDATED, 설명`, `N/A; 설명`, `AC1..AC10`가 혼재했다. Primary Issue, HIGH, Owner QA, Release required, Release authorized 및 PATH POLICY 사전 검증은 PASS.
- 파생 실패: PR Fast Gate Job `128372458577`, Required Quality Job `128372525170`, E2E Job `128372524986`, Docker Job `128372524983`, QA Final Job `128372550166`. 정책 실행, TS, ESLint, Vitest, Next build, Chromium8 구현, Docker 구현은 **SKIPPED / NOT TESTED**이므로 코드가 실패했다고 단정하지 않는다.
- 별개 검토: 미해결 [P1 PR thread](https://github.com/planner77/masterGantt/pull/887) in `src/server/projects/task-field-project-service.ts:49`, reviewer `chatgpt-codex-connector`: LinkService 응답 `src/server/projects/link-service-core.ts:taskDtos`와 Subtree delete 응답 `src/server/projects/task-field-companion-services.ts:enrichTasks`에 `descriptionFormat` 미포함. Markdown Task 원본이 후속 편집/캐노니컬 스냅샷에서 plain으로 표시될 수 있는 실질 데이터 변경 위험.
- 수정 설계: 기존 날짜 계산/권한/DB transaction/revision 함수는 변경하지 않고, ScheduleRepository에서 읽은 `TaskRecord.descriptionFormat`을 두 응답 빌더에 정확하게 포함. `tests/server/projects/description-format-projections-885.test.ts`는 동일 Task DB format + Link POST + 다른 Task subtree 삭제 이후 전체 응답·canonical 재조회 형식 동일성을 검증.
- 문서 보완: Work Packet의 `DOCUMENTATION_SYNC`을 trusted regex 정확 서식으로 정렬, 필수 문서 `docs/EXCEL_EXPORT.md`, `docs/SCHEDULING_ENGINE.md` 등 N/A 사유까지 명시, `AC_TEST_COVERAGE`를 Issue 본문의 `AC01`~`AC10`로 매핑. #711 테스트 정책/Required3/8-shard/QA 게이트는 불변.
- 검증 경계: **코드/문서 변경 커밋은 테스트 실행 증거 아님**. 신규 Full PR CI 실행 전 결과 `NOT TESTED`, Owner QA/HIGH 잔여 위험 수용 및 merge/Main/Release/GHCR/Issue close 미승인. 다음 PR push는 새 HEAD의 `synchronize` Full CI만 트리거하고 모니터링하지 않는다.

## F885-002 — 2026-11-07 Full PR CI #3557.1 npm lockfile 의존성 누락

- **원본:** [PR #887 Full #3557.1 / Run 42362952735](https://github.com/planner77/masterGantt/actions/runs/42362952735), attempt 1, Head `b0085ecd95e0402fa39e05bb8e29a4d32e339d46`, Base `f3f8b89ef09bab35987b32f4945dac91b6fa223a`. 결론 FAILURE이며 불변. 직전 #3556.1의 `DOCUMENTATION_SYNC` 실패는 이 실행에서 **QA Preflight SUCCESS**로 해소되었다.
- **직접 실패:** `npm ci --prefer-offline --no-audit`가 `EUSAGE`(package.json/lock 불일치)로 실패. 실제 Job: Vitest `128375089088`, ESLint `128375089115`, 정책·저장소 검사 `128375089139`, TypeScript `128375089152` 모두 `Node/npm setup 계측` 내부 npm ci 단계에서 동일하게 실패. 정확 메시지: `Missing: yjs@13.6.33 from lock file`, `Missing: lib0@0.2.119 from lock file`, `Missing: isomorphic.js@0.2.5 from lock file`. GitHub cache restore/setup-node 성공이므로 캐시 장애 증거 없음.
- **의존성 원인:** 초기 MDXEditor 도입 때 외부 공개 lockfile에서 npm v3 의존성 일부를 직접 이식하는 과정에서 `@lexical/yjs@0.48.0`의 nonoptional `yjs >=13.5.22` peer 및 `yjs→lib0→isomorphic.js` 전이 의존성 누락. CI npm v10의 재현 가능한 설치 검증이 이를 즉시 차단했다.
- **보완:** `package-lock.json`에 정확 세 레코드만 추가하고 기존 root dependencies, version=0.144.0, 기존 archive/배포/CI 설정/규칙을 변경하지 않는다. 공개 upstream lockfile `dedbin/rimo`의 npm registry `resolved`와 SHA512 `integrity`를 원본 그대로 사용: `yjs=13.6.33`, `lib0=0.2.119`, `isomorphic.js=0.2.5`. 구현 전 lockfile v3/root 의존성 및 `@lexical/yjs→yjs→lib0→isomorphic.js` 정확 경로를 읽기 전용 검사했다. 임의 SHA 생성/버전 하향/패키지 제거 없음.
- **파생 상태:** Fast Gate Job `128375177300`, Required Quality `128375208640`, E2E `128375208702`, Docker `128375208673`, QA Final `128375227073` 실패. 실제 TypeScript/ESLint/Vitest 구현, Next build, Chromium8, Docker 구현은 **SKIPPED/NOT TESTED**; npm 설치 실패를 소스 타입·E2E 직접 실패로 표시하지 않는다.
- **TEST_LIFECYCLE_REVIEW:** `KEEP_UNIQUE` 기존 Task/Issue/GFM/SQLite/브라우저/인증 테스트, 모두 다음 npm ci 성공 이후 동일 Full8에서 실행 예정. 잠금 파일만 교정하며 skip/timeout/retry/테스트 축소 없음. 별도 테스트 파일 불필요: npm ci 자체가 lockfile 그래프를 검증하는 명시적 사전 게이트이다.
- **AC_TEST_COVERAGE:** AC01/AC09(Next client-only MDXEditor 의존성 설치), AC04(원본 lockfile/빌드 재현성), AC10(실제 Full PR CI 실행) 및 기존 Work Packet의 AC01–AC10 매핑 계속 적용. 기능 동작·QA 성공은 새 Head의 CI 전 **NOT TESTED**.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_885_FAILURE_ANALYSIS.md`: UPDATED; `docs/exec-plans/active/ISSUE_885.md`: UPDATED; `package-lock.json`: UPDATED. `AGENTS.md`, `DESIGN.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`: N/A(기존 구현/계약/검증 게이트 불변). 기존 Work Packet 상단의 기계 판독 `DOCUMENTATION_SYNC` 선언은 원본 PR 전체 diff 기준 유지.
- **검증 경계:** 이 수정에서 실제 `npm ci`/TypeScript/ESLint/Vitest/Next/Playwright/Docker를 아직 실행하지 않았다. 원격 Full CI 결과는 다음 새 Head에서 별개 기록해야 하며 이전 실패를 덮지 않는다. 모니터링·병합·Main CI·GHCR·Finalizer·Issue 종료는 미승인.

## F885-003 — 2026-11-07 Full PR CI #3558.1 코드·테스트 실패와 0038 이력 보존

- **실패 실행 출처(불변):** [PR #887 Full #3558.1 / Run 42363953686](https://github.com/planner77/masterGantt/actions/runs/42363953686), attempt 1, Head `bbb85a79b67b9d2f305e3bffbe6de96e71017ffe`, Base main `f3f8b89ef09bab35987b32f4945dac91b6fa223a`. Original conclusion **FAILURE**. QA Preflight `128378023033`, 정책·저장소 계약 `128378092022` 및 npm ci 성공, 이전 F885-001/002는 이번 실행의 직접 원인이 아님.
- **직접 실패 A:** TypeScript Job `128378092058` — `TS1005 src/features/markdown/description-field.tsx(46,6): '}' expected`. 원인: Markdown 변환 버튼 JSX `onClick` 함수 block 닫힘 누락. ESLint Job `128378091989`도 동 구문과 `mdx-client-editor.tsx(28,15) Cannot access refs during render`를 오류 처리. JSX 수정, 최초 Markdown은 lazy useState로 고정, 변경 추적 ref는 이벤트 콜백에서만 참조.
- **직접 실패 B:** Vitest Job `128378091975` — **24 failed / 3723 passed / 3 skipped** (308 suites, 18 failed files). 원인은 0038 도입 대비 구 0037 고정 migration 목록/ledger(version 37), pre-0038 Task 저장 경로에서 `description_format` 신규 컬럼을 요구한 `SQLITE_ERROR`, 기존 Task/Issue raw row의 신규 checked default field 비교 불일치, Task/Summary payload `descriptionFormat` 추가 뒤 구 정확 DTO 기대, 역사적 고정 SVAR package 출처 검증기에서 MDX direct 5개/신 lock 265개를 승인하지 않은 오류.
- **설계 보완:** `ScheduleRepository.insertTask`의 `plain` INSERT는 역사 schema의 컬럼만 쓰며 0038 schema `DEFAULT 'plain'`도 상속한다. `markdown` INSERT는 0038 `description_format` CHECK 컬럼을 명시하여 구 DB에서는 실패하도록 보안적으로 fail closed 한다. 마이그레이션 0038의 작업/Issue raw 데이터는 내용·checksum·FK·원본 행 그대로 두고 새 컬럼을 레거시 비교에서만 제외하고 신규 `plain` default를 별도 assert. 기존 test lifecycle에서 이력·마이그레이션 rollback/checksum·모든 정밀 Assertions 유지.
- **SVAR immutable 증거:** 역사 capture `tests/fixtures/gantt-state-consistency/capture-sources/*original.snapshot.txt`는 **수정하지 않음**. 기존 573개 lock entry는 Next16.4.2/Zod4.6.7 보안 승인 외 엄격 동등 비교 그대로. #885 신규 5 direct deps 정확 pin과 **265개 신규** npm registry/SRI/전이 메타데이터를 `tests/fixtures/gantt-state-consistency/approved-issue-885-mdx-lock.json`에 고정해 설치 출처 비교; SRI 변조·무단 package 삽입 음성 테스트를 확장. 기존 Gantt Core source bytes SHA256, snapshot 증명은 그대로.
- **파생 실패·미검증:** Fast Gate `128378419815`, Quality aggregate `128378477288`, E2E `128378477282`, Docker `128378477374`, QA Final `128378497206` FAIL. 실제 Next Build/Chromium8/Docker 구현은 **SKIPPED/NOT TESTED**. 근거 없는 UI/Release 성공 선언 금지.
- **TEST_LIFECYCLE_REVIEW:** 원본 테스트/지표·음성 KEEP_UNIQUE, 역사 DB 원본 열 보존 검증과 0038 checked 기본값·SVAR SRI 음성 EXTEND, 새로운 승인 추가가 아닌 과거 fixture의 관측 범위를 정확히 분리. 0 test skip/timeout 완화/retry 추가/원본 테스트 제거/CI 게이트 약화. 다음 새로운 HEAD Full CI로만 적합 판정.
- **AC_TEST_COVERAGE:** AC01/09(Next client-only TSX/ref), AC02/04(0038 schema/legacy plain/checksum/raw row), AC06(편집 DTO 포맷 전파), AC10(SVAR immutable capture 및 Full CI) 매핑. 다른 AC01~AC10 상단 Work Packet 유지.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_885_FAILURE_ANALYSIS.md` UPDATED, `docs/exec-plans/active/ISSUE_885.md` UPDATED. `AGENTS.md`, `DESIGN.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/CI_CD.md`, `docs/QA_REVIEW_POLICY.md` 기존 계약 변경 없음. 불변 migration SQL·역사 캡처 파일·QA/CI 워크플로우 무변경.
- **한계:** 이 보완 커밋은 실제 테스트 수행 증거가 아니다. 다음 PR synchronize Full CI의 상태/결과는 사용자 요청에 따라 모니터링하지 않으며 새 테스트는 **NOT TESTED**. 병합/Main/GHCR/Release/Issue 완료 미승인.

## F885-004 — 2026-11-07 PR CI #3559.1 실패 및 #3556~3559 전체 원인 계보·재발 방지

- **실패 원본:** [PR #887 Full CI #3559.1 / Run 42365288584](https://github.com/planner77/masterGantt/actions/runs/42365288584), attempt 1; Source Head `47d6f1f820fd5759a07163819b7b3ba05d934fa5`, Base main `f3f8b89ef09bab35987b32f4945dac91b6fa223a`; conclusion **FAILURE**. 원본 Run 증거를 수정하거나 이전 FAIL을 PASS로 재기록하지 않는다.
- **직접 성공 게이트:** QA Preflight Job `128382032091` SUCCESS, 정책·저장소 검사 `128382121024` SUCCESS, TypeScript `128382121041` SUCCESS, ESLint `128382121030` SUCCESS, npm ci SUCCESS. 따라서 과거 QA 문서/lockfile/JSX/ref 오류가 이 실행의 직접 실패는 아님.
- **직접 실패:** Vitest Job `128382120969`의 **2 failed / 3745 passed / 3 skipped (3750 tests; 308 suites)**. (1) `tests/server/migration-cli.test.ts:97` 신규 0038 적용 후 `schema_migrations.count=38`이나 후단 read-only 검증은 37로 고정; (2) `tests/server/resources/project-resource-memberships.test.ts:356` 과거 Task 원본 행 비교의 *두 번째 SQLite reopen 루프*에서 신규 `description_format='plain'` 필드를 제거하지 않아 기존 레거시 20필드 vs 현재 21필드 충돌. 초기 업그레이드 시 첫 번째 비교는 이미 0038 신규 필드 배제+기본값 별도 검증하여 성공했음. 원본 Task 값 변경/소실 증거는 없음.
- **직접 원인과 예방 설계:** #885가 제품 DB 필드, 앱 편집기, npm lock, 응답 DTO, 역사 스냅샷을 동시에 변경했는데 사전 계약 검증을 매 단계마다 추가하면서 전체 회귀 경로(동일 테스트의 첫 번째 vs 두 번째 assertion)를 빠뜨린 **수평 영향 범위 누락**. 본 교정은 (1) CLI *처음·재실행·실제 SQLite file*에 38/0038 ledger/두 테이블 기본 `plain` checked column 확인, (2) Project Resource migration의 *첫 비교·재시작 후 비교*에서 각각 이전 원본 컬럼을 정확히 비교하고 신규 `description_format`은 별도 `plain` 검증. checksum/rollback/revision/FK/실제 Resource·Task 연계 및 기존 부정 assertions는 그대로.
- **네 번의 Full PR CI 실패 계보 (전후 성공 게이트로만 범위 한정):**
  - #3556.1 / `42362045811`: `DOCUMENTATION_SYNC` 엄격 문법 실패·P1 링크/삭제 DTO 원문 형식 누락; #3557.1 이후 QA Preflight SUCCESS, P1 코드·SQLite 독립 회귀 테스트 반영·리뷰 스레드 resolved.
  - #3557.1 / `42362952735`: `npm ci EUSAGE` `yjs/lib0/isomorphic.js` 누락; #3558.1 이후 npm ci SUCCESS. 공개 registry SHA512 고정, 기존 pin 그대로.
  - #3558.1 / `42363953686`: TSX `}` 구문·React ref lint 오류와 Vitest 24건(0038 이전 schema insert/ledger, Task payload, SVAR 증거); #3559.1 TypeScript/ESLint SUCCESS, Vitest 24→2건으로 감소. immutable 원본 lock/승인된 신규 그래프 265개, 엄격 SRI 음성 테스트 유지.
  - **#3559.1 / `42365288584`**: 남은 Vitest 2건의 *누락된 두 번째 assertion*만 수정. 새 HEAD의 실제 PASS는 아직 미확인.
- **실패와 파생 상태 구분:** Fast Gate `128382515395`, Required Quality `128382570934`, E2E 집계 `128382570978`, Docker 집계 `128382570865`, Automated QA Final `128382591100` FAILURE는 Vitest FAIL에 따른 종속 결과. 원본 Full CI #3556~#3559는 **Next Production Build/Chromium E2E8/Docker 실제 Job이 전부 SKIPPED**; 이 영역과 Owner-managed/Trusted QA는 지금도 **NOT TESTED**이고 별도의 후속 성공 증거 필요.
- **TEST_LIFECYCLE_REVIEW:** `EXTEND` 기존 `tests/server/migration-cli.test.ts`의 실제 CLI 전체 38개/0038 이름 및 tasks+project_issues 형식·기본값, `tests/server/resources/project-resource-memberships.test.ts`의 legacy before/reopen/Resource·Task 원본 전체 열·FK 검증. `KEEP_UNIQUE` 기존 3750 tests, 308 files, 모든 기존 security/Markdown/DTO/scheduling/DB checksum/SVAR immutable negative suites. skip/timeout/retry/검증 스크립트/Required3 정책 변경 없음.
- **AC_TEST_COVERAGE:** AC02/AC04(기존 Task·Issue plain DEFAULT 및 원본 동등성, SQLite 0038 단조 마이그레이션), AC06(프로젝트 Resource·Task 권한/연계 그대로), AC10(전체 실패 역사와 Full CI 실행 원본 분리) 확장; AC01/03/05/07/08/09는 상단 Work Packet의 기존 tests 및 향후 Next/E2E8/QA evidence 유지.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_885_FAILURE_ANALYSIS.md` UPDATED; `docs/exec-plans/active/ISSUE_885.md` UPDATED. 기존 `AGENTS.md`/DESIGN/API/DB_SCHEMA/CI_CD/QA_REVIEW_POLICY/TEST_PLAN`의 출처·검증 규칙 불변. 새로운 제품 DB migration·버전·CI 수정 없음.
- **기술 경계 및 판단:** 현재 작업에서 실제 npm ci/Next build/Chromium/Docker를 로컬 실행할 수 있는 repo+registry runtime을 확보하지 못했으므로 이번 교정은 **STATIC REVIEWED / RUN NOT TESTED**. 기존 main과 PR base가 동일 `f3f8b89...`, GitHub PR mergeable=true 및 미해결 리뷰 스레드 0건은 커밋 전 관측값일 뿐 최종 QA/merge 증거 아님. 다음 Push는 PR Full CI를 한 번 시작하고 관측을 중단한다. **merge/Main/GHCR/Release/Issue close 미승인**.

## F885-005 — 2026-11-07 Full PR CI #3560.1 · Chromium E2E 예전 Description textarea 호출

- **원본:** [PR #887 Full #3560.1 / Run 42366243384](https://github.com/planner77/masterGantt/actions/runs/42366243384), attempt 1, HEAD `b7afbb49c41b8909ca59dc1fbd0ddfcd825f7f82`, base `f3f8b89ef09bab35987b32f4945dac91b6fa223a`, overall conclusion **FAILURE**. 별도 FAST_DEVELOPMENT #305.1 skipped는 권위 있는 PASS가 아님.
- **직접 성공 증거:** QA Preflight `128384885452`, 정책·저장소 계약 `128384961064`, TypeScript `128384961086`, ESLint `128384961122`, Vitest `128384961134`, PR Next.js production build `128385358117`, PR Docker smoke 구현 `128385358134`는 각각 **SUCCESS**. Required aggregate Quality `128385849368`, Docker `128386298208`도 **SUCCESS**. 따라서 이전 F885-001~004의 원인은 이번 HEAD의 직접 실패로 남아 있지 않다.
- **직접 실패:** [Chromium E2E shard 2/8, Job 128385358230](https://github.com/planner77/masterGantt/actions/runs/42366243384), `tests/e2e/milestone-management-persistence.spec.ts:101`의 #550 실제 HTTP·SQLite Milestone 관리 시나리오. 기존 `editor.getByLabel("Description", {exact:true}).fill(...)`는 Issue #885의 공통 `DescriptionField`가 `role=group`의 `plain` 리터럴 표시 및 명시적 전환 버튼으로 바뀌면서 **비입력 요소에 fill 시도** → `Error: Element is not an <input>, <textarea>, <select> or [contenteditable]`. Shard2는 **12 PASSED, 1 FAILED, 91 NOT RUN** (104 cases) 후 fail-fast, 타 7개 shard **CANCELLED**. Required E2E aggregate `128387628419` **FAILURE**, Automated QA `128387648736` **FAILURE**. 8/8 E2E PASS가 없으므로 전체 PR CI 실패이며 오직 이 한 E2E의 원인을 확인했다.
- **소스 영향 조사:** 기본 브랜치 코드 검색 `getByLabel("Description")`는 `tests/e2e/project-task-editor-persistence.spec.ts`, `tests/e2e/project-task-editor.spec.ts`, `tests/e2e/milestone-management-persistence.spec.ts`를 지목. 전자 2개 PR HEAD는 각각 Source 모드 helper 또는 plain→Markdown 버튼으로 이미 변경되어 있고, 마지막 #550 테스트만 이전 `.fill` 유지. `getByLabel("Issue 내용")` 구 호출은 `tests/e2e/project-issues.spec.ts`에서 MDX Source/CodeMirror로 이미 변경됨. 관련 다른 textbox 검색 7건은 Task/Issue Description 대상이 아닌 각 독립 양식. 새 PR 테스트에서 고정 schema/인증/scheduling/Owner gate를 바꾸지 않는다.
- **전체 실패 계보 및 확인된 회복:** F885-001/#3556.1 QA `DOC_SYNC` 규칙 → #3557.1부터 Preflight 성공. F885-002/#3557.1 `npm ci` 누락 `yjs/lib0/isomorphic.js` → #3558.1부터 설치 성공. F885-003/#3558.1 TSX/ref + 24 Vitest fail(0038 DTO/legacy schema/frozen SVAR graph) → #3559.1 TS/lint PASS·Vitest 2개만 FAIL. F885-004/#3559.1 마이그레이션 CLI 38개, Resource Task 재개방 검증 2건 → #3560.1 Vitest SUCCESS. **이번 F885-005 E2E에서는 아직 나머지 7 shard의 성공 증거를 확보하지 못했다.** 원인 1건씩 드러나는 이유는 신 CI 단계가 이전 필수 단계 성공 전까지 skip되고 E2E fail-fast로 후속 검증이 중단되기 때문이지, 건너뛴 단계를 PASS로 간주해서는 안 된다.
- **보완 설계:** 기존 UI 접근권한/Markdown legacy-preservation은 정상이므로 제품 소스·DB·security/CI는 변경하지 않는다. #550 E2E만 기존 원본 Milestone 생성·Edit·HTTP CAS·Link/StageGate·401/403/428/412/409/400 거절·SQLite restart·Source Hash 확인을 모두 보존하고, 명시적 전환 클릭 → `#task-description` Markdown format 확인 → MDXEditor Source 모드 → `.cm-content[contenteditable]` 입력 후 정확 PATCH `description`+`descriptionFormat=markdown`, canonical DTO의 format 유지까지 강화한다. 구 `.fill(plain group)` 호출을 삭제한 것은 기능 테스트 제거가 아니라 새로운 편집 인터페이스에 맞춘 동일 사용자 조작이다.
- **TEST_LIFECYCLE_REVIEW:** `EXTEND` #550 기존 고유 통합 E2E의 Markdown 명시 전환/Source 입력/DB format 세 assertions; `KEEP_UNIQUE` 나머지 #550 원본 HTTP·Milestone·복사·rollback·restart/SQLite 및 기존 Task/Issue E2E·Vitest 3750 suite collection. No test skip, test-level/Global timeout extension, retry/CI gating change, fixture weakening, security bypass.
- **AC_TEST_COVERAGE:** AC01/02(legacy plain→WYSIWYG Source 명시 변환), AC04/06(canonical Task/Milestone 저장 응답/재시작, 0038 default), AC09(Next 클라이언트 편집기 진입), AC10(기존 독립 #550 E2E 보존 및 Full8 재검증). 다른 AC01~AC10은 Work Packet 기존 경계를 그대로 요구.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_885_FAILURE_ANALYSIS.md` UPDATED, `docs/exec-plans/active/ISSUE_885.md` UPDATED, `tests/e2e/milestone-management-persistence.spec.ts` EXTEND. `AGENTS.md`, `DESIGN.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/TEST_PLAN.md`, `docs/CI_CD.md`, `docs/QA_REVIEW_POLICY.md` 불변. 별도 release/GHCR 승인 없음.
- **제한:** 이 변경은 Source/static 검토와 GitHub 커밋 증거이며 새 Head의 Chromium8 전체, Trusted QA, Owner 수동 수용 결과는 **NOT TESTED**. 차기 non-draft PR synchronize 후 자동 CI 시작에서 멈추며 모니터링, merge, Main, Release, GHCR, Issue close는 진행하지 않는다.

## F885-006 — 2026-11-07 #3561.1 목록 재조회 정체와 전체 실패 교차 분석

### 원격 출처와 관측

- [PR #887](https://github.com/planner77/masterGantt/pull/887), branch `feat/issue-885-mdxeditor`, workflow `CI`, event `pull_request`, [Full #3561.1 / Run 42367928874](https://github.com/planner77/masterGantt/actions/runs/42367928874), attempt 1, 생성 `2026-11-07T11:22:43Z`, 원본 결론 **FAILURE**.
- Head `c136213dae525f95697b116b6624ef333320ea70`, base `f3f8b89ef09bab35987b32f4945dac91b6fa223a`, test merge `e44091b98876a4d9b901b8a9226cf74c8d0e3fa7`. 재개 시 최신 main은 동일 base이며 PR mergeable=true, 미해결 리뷰 thread=0이었다. 이는 병합 승인이 아니다.
- Required Quality Job `128390694876` **SUCCESS**, Docker Job `128391418158` **SUCCESS**, 실제 Next build Job `128390410581` **SUCCESS**. Required E2E Job `128391906373`와 Automated QA Job `128391925884` **FAILURE**. 새 Head에 이 성공을 재사용하지 않는다.
- 직접 실패는 Chromium shard7 Job `128390410606`, `tests/e2e/i18n-master-data.spec.ts:68`의 `Cancel` 클릭이다. `Test timeout of 180000ms exceeded`; 버튼이 disabled인 채 남았다. **18 PASS / 1 FAIL / 61 NOT RUN**. 다른 7 shard는 **CANCELLED**다.
- 원본 artifact `playwright-report-shard-7`, ID `13573190319`, SHA256 `27e1957ab97015555f6ddaf6aacba47f05bc28025017fe49b8d71a1d859e6b64`의 trace에서 PATCH 412는 **19.065ms**에 완료했다. 직후 `11:29:16.358Z` collection GET `/api/project-master/admin/items`는 응답 없이 끝까지 미완료(`status=-1`, `time=-1`)였다. `mutate → loadCatalog` 대기 중이므로 pending/Cancel 잠금은 관측과 일치한다.
- pageError/JS exception은 없고 서버 alive, health 200/130ms, OOM/oomKill=0이었다. GET 정체의 TCP/브라우저 interception/DEV 내부 근인은 **UNKNOWN**이다. UI의 finally 누락, 서버 전체 장애, Markdown 선택자 문제로 확정하지 않는다. 테스트는 기존 초안 값과 악성 marker 부재만 확인해 재조회 완료를 입증하지 못했다(**FIXTURE_OBSERVABILITY**).
- 반례: 직전 #3560.1의 취소된 shard7 Job `128385358210`에서는 같은 case가 **PASS(10.0s)**였다. 이번 수정 전 동일 Head의 로컬 명령 `npm run test:e2e -- tests/e2e/i18n-master-data.spec.ts --workers=1 --retries=0 --max-failures=0`도 **1 PASS(19.2s, 전체 1.2분)**였다. 이는 원격 실패 비재현이며 원격 FAIL의 해소 증거가 아니다.

### Cross-run 실패 매트릭스

원격 branch 전체 조회 결과 Full CI 6개는 모두 attempt 1의 서로 다른 Run이다. 보조 FAST_DEVELOPMENT #301~306은 모두 SKIPPED이며 추가 성공/실패 표본으로 합산하지 않는다. 기존 F885-001~005의 원본 결론·당시 교정은 그대로 보존한다.

| 실패 | 원본 Run / Head | 최초 실패 계약 | 후속 관측 / 이번 검증 범위 |
| --- | --- | --- | --- |
| F885-001 | [3556.1 / 42362045811](https://github.com/planner77/masterGantt/actions/runs/42362045811), `d73f64aa3566d374d8a7213736b96b329f508296` | POLICY_CI: DOC_SYNC 문법; 별도 P1 Link/delete DTO 형식 누락 | #3557~3561 Preflight 성공. 정확 DOC_SYNC/AC parser 및 실제 SQLite projection 회귀 유지 |
| F885-002 | [3557.1 / 42362952735](https://github.com/planner77/masterGantt/actions/runs/42362952735), `b0085ecd95e0402fa39e05bb8e29a4d32e339d46` | npm lock peer 그래프 누락 | #3558~3561 설치 성공. 이번 격리 worktree 실제 npm ci 711 packages 성공, pin/lock 변경 없음 |
| F885-003 | [3558.1 / 42363953686](https://github.com/planner77/masterGantt/actions/runs/42363953686), `bbb85a79b67b9d2f305e3bffbe6de96e71017ffe` | TSX/ref 및 0038 schema/DTO/고정 증거의 24 FAIL·18 files | #3559 TS/lint 성공, #3560~3561 Vitest 성공. 이번 full Unit/정책 검증에 18개 실패 파일과 Markdown/projection 음성 포함 |
| F885-004 | [3559.1 / 42365288584](https://github.com/planner77/masterGantt/actions/runs/42365288584), `47d6f1f820fd5759a07163819b7b3ba05d934fa5` | TEST_CONTRACT: CLI/reopen의 두 번째 assertion 누락 | #3560~3561 Vitest 성공. 이번 CLI/실제 SQLite 재오픈을 포함한 Unit 유지 |
| F885-005 | [3560.1 / 42366243384](https://github.com/planner77/masterGantt/actions/runs/42366243384), `b7afbb49c41b8909ca59dc1fbd0ddfcd825f7f82` | TEST_CONTRACT: Milestone Description group에 textarea fill | #3561 shard2 취소로 전체 성공 미확정. 이번 Milestone 3case 및 Issue/Task 직접 소비자 동시 선정 |
| F885-006 | [3561.1 / 42367928874](https://github.com/planner77/masterGantt/actions/runs/42367928874), `c136213dae525f95697b116b6624ef333320ea70` | UNKNOWN GET 정체 + FIXTURE_OBSERVABILITY: 412 후 refresh 완료 미관측 | 수정 전 로컬 비재현. 실제 stale revision·실제 GET·요청 중 잠금/완료 후 해제 검증으로 테스트 경계 보강; transport 근인 미확정 유지 |

누적 재실패는 서로 같은 원인의 반복이 아니다. 초기 문서/설치/정적 gate가 후단 실행을 막았고, 이후 E2E fail-fast가 다른 소비자 실행을 중단했다. 이전 정적 보완만으로 새 단계의 실행을 검증하지 못한 것이 공통 누락이다. 이번에는 과거 실패 파일의 합집합과 직접·간접 소비자를 한정하여 fail-fast 없이 실행한다.

### 취소 로그와 누적 실패 파일 합집합

infra가 #3560/#3561의 취소된 shard **14개** 원문 로그까지 확인했다. 추가 assertion/test FAIL은 발견하지 못했다. 의도된 error-boundary probe와 GitCommitInfo 보조 timeout은 별도 실제 실패로 계산하지 않는다. 취소/미실행 case는 여전히 **NOT TESTED**이며 14 shard PASS라고 보고하지 않는다. #3556~3559 실제 Next/E2E/Docker SKIPPED도 기존 기록 그대로다.

#3558의 18개 실패 파일은 원문으로 재확인했다. 테스트 이름이 유사해도 별개의 SQLite/도메인/Core 증거 경계를 유지한다.

```text
tests/domain/milestone-editor-model.test.ts
tests/scripts/prepr-verifier.test.ts
tests/features/gantt/axis-transaction-runtime-fixture.test.ts
tests/features/gantt/canonical-recovery-runtime.test.ts
tests/features/gantt/state-consistency-runtime-fixture.test.ts
tests/features/gantt/task-editor-model.test.ts
tests/server/migration-cli.test.ts
tests/server/calendars/country-calendar-integration.test.ts
tests/server/db/database.test.ts
tests/server/db/issue-623-target-migration.test.ts
tests/server/i18n/managed-display-names.test.ts
tests/server/logistics/logistics-targets-acceptance.test.ts
tests/server/logistics/task-target-bindings.test.ts
tests/server/process-catalog/process-catalog-service.test.ts
tests/server/process-catalog/process-context-service.test.ts
tests/server/projects/project-issues.test.ts
tests/server/projects/task-hierarchy-multi-copy.test.ts
tests/server/resources/project-resource-memberships.test.ts
tests/e2e/milestone-management-persistence.spec.ts
tests/e2e/i18n-master-data.spec.ts
```

### 보완 설계와 선정

- **EXTEND** 기존 `i18n-master-data.spec.ts` 한 case: 401의 악성 오류 marker 비노출·재인증·보존 초안을 유지한다. 412는 다른 항목의 실제 API 변경으로 catalog revision을 전진시켜 **실제 서버 CAS 거절**을 받는다. 후속 실제 collection GET을 통제 보류해 요청 중 Cancel 잠금/초안을 확인하고, 해제 후 실제 응답·최신 revision·오래된 초안 저장 차단·Cancel 활성화를 확인한다. 임의 sleep/force click/skip/retry/timeout 확대는 사용하지 않는다.
- 직접/인접/음성 브라우저 집합은 **7 spec / 56 case**: 누적 E2E 실패 2파일 + `project-issues.spec.ts`, `project-task-editor.spec.ts`, `project-task-editor-persistence.spec.ts`(Description/dirty/권한/실제 SQLite) + `project-master-admin.spec.ts`, `project-master-relations.spec.ts`(같은 catalog/권한/관계/화면). `workers=1,retries=0,max-failures=0`으로 한정한다. Unit은 위 18파일과 신규 Markdown/projection 테스트를 포함한 기존 full suite로 검사한다.
- 제품 `loadCatalog` timeout/재시도, 공통 TranslationEditor, DB/DTO/Markdown/CI 정책은 수정하지 않는다. 원격 GET 정체의 근인이 미확정인 상태에서 제품 범위를 넓히지 않는다. 원격에서 같은 정체가 반복되면 이 Run/trace와 새 실제 HTTP·GET 완료 관측을 대조하여 별도 transport 조사를 수행한다.
- **AC_TEST_COVERAGE:** AC01/02/04 직접 Description·0038·canonical 회귀, AC03/05/06 악성 오류/401/412·초안·서버 CAS, AC07/08 pending·focus·5폭/3locale/coarse, AC09 Next build, AC10 누적 원장/정책·전체 Required gate를 연결한다. 실제 screen reader/native 125%/운영 DB 복구는 별도 **NOT TESTED**다.
- **DOCUMENTATION_SYNC:** 이 원장과 Work Packet만 갱신한다. 기존 첫 DOC_SYNC 정확 문법 유지. 제품/API/DB/CI/보안 정책 변경이 없어 관련 가이드는 기존 N/A 근거를 유지한다. 후속 원격 Full Required3/Trusted/Owner는 **NOT TESTED**, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`다.
- 실행 역할: Manager 통합·문서·게시, infra 원격 원문/취소 로그 읽기 전용, frontend 테스트 보완, qa_docs 별도 사전검토. `OWNER_MANAGED`를 독립 인간 최종 QA PASS로 전용하지 않는다. 원시 trace/DB/인증 로그는 Git에 저장하지 않는다.

### 최종 후보 검증

최종 동일 테스트 source의 실행 결과·hash·로컬 report와 잔여 위험은 아래에 추가한다. 이 절 작성 시 아직 보완 후 검증은 **NOT TESTED**이며 새 PR CI는 모든 보완을 한 묶음으로 게시한 뒤 한 번 시작한다. 시작 이후 결과 모니터링·병합/Main/GHCR/Release/Finalizer/Issue 종료는 승인 범위 밖이다.

- 최초 보완 source `c5fc2849b7adc273dabdfad0f2bea7664093be2e7d3290eb2a2f99f00a67494c`의 단독 Chromium은 **1 PASS(13.6s, 전체47.8s)**, 파일 ESLint PASS였다. qa_docs 사전검토에서 mock401/실제412 구분과 최초 구현 환경 표현을 교정하고, 실제412 원문 message 비노출 및 지역화 충돌 안내 assertion을 추가했다. 이후 최종 spec SHA256은 `9387de789596cee12bd25e0ee25d17e742dc54d9e60ed122e49160840a4d5f36`이다. 앞선 source의 단독 PASS를 최종 spec PASS로 사용하지 않는다.
- **L885-001 로컬 진단 실패(원격 Run과 별개):** Node22.14.0/npm11.10.0/WSL2에서 `npm run verify:prepr -- --mode=fast --base=c136213dae525f95697b116b6624ef333320ea70 --risk=HIGH --issue=885 --pr=887 --report-dir=.prepr-reports/issue-885-final-fast`를 실제 실행했다. Version/discovery/Markdown links/cache/QA fixture/dependencies/typecheck/lint는 PASS였고 Unit은 **1 FAIL / 3746 PASS / 3 SKIPPED, 308 files, 62.49s**였다. `tests/server/llm/llm-boundary.test.ts:65` 실제 소스 import graph 검사에서 5000ms timeout(5063ms), assertion 위반 출력은 없었다. Pre-PR report는 **FAIL**, sourceStable=true, fingerprint `ba6ea24983ed6ce53aad0944d0f0accd774e6f8cb23ebe76595fdeb6021a0feb`로 보존한다. Production build는 이 실행에서 NOT RUN이다.
- 같은 LLM 파일 단독 명령 `npm test -- tests/server/llm/llm-boundary.test.ts`는 **3 PASS / 2.12s**였다. 원격 #3561 Unit은 SUCCESS이므로 현재 자료는 로컬 병렬 실행 부하 가설과 양립하지만 시간 초과의 근인을 단정하지 않는다. 테스트 timeout/소스/설정을 변경하지 않고 `npm test -- --maxWorkers=1`로 전체 파일을 한 번 더 실행하여 차이를 확인한다. 최초 FAIL을 삭제하거나 단독 성공으로 전체 성공을 추론하지 않는다.
- 최종 구현·검증 source 지문은 Git 추적 `src/`, `db/`, `tests/`, `scripts/`, `package.json`, `package-lock.json`의 경로순 SHA256 합성 `4c0920f06ef87c0687ea5d2bf1b92347182d8824754f5761aaa1ffdc963a8008`이다. 문서에 결과를 추가하는 변경 및 Next 자동 생성 타입·스크린샷과 제품/테스트 소스를 구분하며, 아래 최종 검증 후 같은 지문을 다시 비교한다.
- 최종 source의 `npm test -- --maxWorkers=1`는 **307 files PASS / 1 file SKIPPED, 3747 cases PASS / 기존3 cases SKIPPED(3750), 297.15s, exit0**였다. 과거 실패18 Unit 파일·Markdown/projection/LLM 음성을 모두 포함하며 새로운 skip/timeout/설정 변경은 없다. 로그 `.prepr-reports/issue-885-unit-serial.log`와 최초 fast FAIL report를 함께 보존한다. 원격 병렬 runner와 동일 환경이라는 주장은 하지 않는다.
- qa_docs `/root/qa_review`가 최종 spec hash를 확인해 별도 **정적 사전검토 PASS**를 반환했다. 두 P2(401 실제/주입 표현, 실제412 원문 오류 비노출)를 해소했고 새 지적은 없었다. 이는 HIGH 최종 Owner 수용/Trusted QA/Manager ACCEPT나 독립 인간 QA 영수증이 아니다.
- 최종 spec의 `npm run typecheck`, `npx eslint tests/e2e/i18n-master-data.spec.ts`, `NEXT_DIST_DIR=.next-prepr npm run build`는 모두 **PASS/exit0**였다. Next16.4.2 webpack compile42s·후속 TypeScript39.9s·페이지 생성·standalone/runtime-tools까지 완료했다. Next가 생성한 next-env/tsconfig 출력 경로는 실행 후 원본으로 복원하며 게시 diff에 포함하지 않는다. 이 로컬 build는 새로운 PR Head의 Required Quality/Docker PASS가 아니다.

### L885-002 — 확대 브라우저 진단에서 같은 Source 역할 오류 3개 소비자 발견

- 위 첫 후보 지문 `4c0920f0...`로 7spec/56case, workers1/retries0/max-failures0 명령을 실행했다. i18n 최종9387 spec **PASS(20.9s)**, Milestone-only past/future **PASS** 후 Milestone 전체 편집 case가 **180초 FAIL**했다. 당시 401/412 보완의 별개 성공을 전체 E2E 성공으로 확대하지 않는다.
- trace/error-context에서 실제 원문 전환은 `radio "원문 모드"`였고 `getByRole("button", Source...)`가 잘못된 계약이었다. 설치 MDXEditor4.3.3의 `DiffSourceToggleWrapper → SingleChoiceToggleGroup → Radix ToggleGroup(type=single)` 및 실제 DOM의 `role=radio/aria-checked`가 일치한다. JS/CSS는 200(16~215ms), pageError=0, 서버 health200/45ms, OOM0으로 편집기 미로딩 가설은 기각했다. `.cm-content.fill`에는 도달하지 못했다. **TEST_CONTRACT**로 확정한다.
- 동일 오류를 `milestone-management-persistence.spec.ts:107`, `project-task-editor-persistence.spec.ts:8` helper, `project-issues.spec.ts:131`의 세 소비자에서 확인했다. 이전 F885-005는 textarea→Source 입력 경로를 정적으로만 교정하여 실제 접근성 역할을 확인하지 못했다. 직전 실패 한 곳뿐 아니라 이들 세 소비자를 함께 `getByRole("radio", ...)`로 교정하고 선택 후 `toBeChecked()`를 추가한다. 원래 저장 payload/DB·revision/dirty/보안 assertions는 보존한다.
- 같은 잘못된 선택자를 기다리던 Issue case까지 확인한 뒤 Manager가 소유한 진단 프로세스에 SIGINT를 전달해 불필요한 동일 timeout 반복을 중단했다. 첫 명령의 최종 결과는 **3 PASS / 1 FAIL / 1 INTERRUPTED / 51 NOT RUN, 6.6분, exit130**이다. 원본 로그 `.prepr-reports/issue-885-browser-56.log`, partial report/trace `.prepr-reports/issue-885-browser-before-role-fix/`를 보존한다. 중단·미실행을 PASS로 계산하지 않는다. 보완 후 **같은 56개 전체**를 다시 fail-fast 없이 실행한다.
- 이 추가 보완은 E2E 파일3개의 selector/선택 상태 검증만 변경한다. 제품/Unit/lock/schema/CI source는 위 Unit·build 검증과 같으며, 최종 TypeScript/4개 변경 spec lint와 브라우저 전체 선택 집합을 새 source에서 다시 검사한다. 이전 full Unit307 PASS/기존skip과 새 E2E 결과는 환경·source 경계를 명시하여 기록한다.
- 세 Source 소비자 교정 후 `npm run typecheck` 및 변경4개 spec의 ESLint는 **PASS/exit0**였다. 최종 구현·전체 테스트 합성 SHA256 `9683a61e0f491013fa97fefa625052c46d315a39f33566493bf8bdcb2855d00b`, 제품/Unit 경계(위 합성에서 `tests/e2e/` 제외) `dfeea1181ae11834f952822bf921ee8cf754d50280c8813cf449edca4dcb4fff`를 동결했다. 후자는 실제 Unit/build를 수행한 parent source와 byte hash가 동일함을 `git show c136213d:<path>` 대조로 확인했다. 최종 56case는 새 동결 source로 별도 실행하며 이전 partial의 3PASS와 합산하지 않는다.

### L885-003 — Summary 저장 허용 목록에서 Description 형식 누락

- Source 역할을 교정한 지문 `9683a61e...`의 다음 56case 실행에서 실제 Task 저장·Milestone·Issue Source 전환은 성공했지만, `project-task-editor-persistence.spec.ts:128` Summary case가 **FAIL**했다. Trace의 요청은 정확히 `description='요약 설명\n상세'`, `descriptionFormat='markdown'`, URL을 보냈고 서버가 **409 SUMMARY_SCHEDULE_READONLY**를 반환했다. Source 선택/입력/MDX 로딩 문제가 아닌 **PRODUCT** 결함이다.
- `src/server/projects/project-service-core.ts`의 Summary raw-key 허용 목록은 name/description/url/explicitMilestoneTaskId만 알고 새 `descriptionFormat`을 일정 필드로 오인했다. `src/domain/tasks/task-patch-fields.ts`의 메타데이터 분류에도 같은 필드가 없어 unknown으로 분류됐다. 기존 F885-001의 DTO 형식 전파 보완은 mutation 응답에 관한 것이었으며 입력 guard·분류 소비자까지 포괄하지 못했다.
- 보완은 메타데이터 분류와 Summary 입력 허용 경계를 함께 정합화한다. Description/형식은 본문 메타데이터이고 실제 일정·진척·Baseline·unknown 필드의 Summary 직접 쓰기는 계속 거절한다. 형식 단독 PATCH를 새로 허용하지 않고 description 동반 검증·권한/Origin/If-Match·revision/실패 시 무변경을 유지한다.
- backend는 기존 `summary-task-details.test.ts`, `task-field-contract.test.ts`, `task-candidate.test.ts`를 EXTEND하여 실제 Markdown Summary 저장/재조회와 형식 누락 호환·명시 plain 전환·format-only 및 일정 혼합 거절을 검증한다. `task-hierarchy-service.test.ts`의 기존 readonly 음성을 유지해 함께 실행한다. 신규 중복 테스트 파일은 만들지 않는다. 실패 테스트를 먼저 실행해 원래409를 확인한 뒤 제품을 교정한다.
- 이전 Unit/build 성공의 제품 source 지문은 이 제품 보완 이후의 증거로 재사용하지 않는다. 입력 guard/분류 변경은 새 관련 Unit·typecheck/lint/build 및 56case 교차 검증으로 재확인하며 최종 지문·실행/미실행을 별도 추가한다. 과거 모든 FAIL과 UNKNOWN GET 정체는 유지한다.
- 지문 `9683a61e...`의 전체 실행은 **53 PASS / 3 FAIL, 56case 전부 실행, 10.0분, exit1**로 끝났다. 실패는 Summary409 한 건과 아래 Issue 원문 재작성·Tab trap 두 건이었다. 로그 `.prepr-reports/issue-885-browser-56-final.log`는 당시 명칭 그대로 보존하며 최종 성공 로그로 덮어쓰지 않는다.
- backend가 기존 테스트를 먼저 확장한 명령은 **5 FAIL / 25 PASS(30), 2.80s**로 원래 SummaryReadonlyError와 format unknown 분류를 재현했다(`issue-885-summary-red.log`). 제품 두 경계를 교정한 뒤 기존 readonly·handler·strict contract·projection까지 **7files/69cases PASS, 5.45s/exit0**, 변경5파일 lint PASS였다. 신규 고유 case는5개이며 최종 전체 수는 다음 실제 실행으로 확인한다. 새 migration·형식 단독 허용·원본 보안/일정 음성 제거는 없다.

### L885-004/005 — Issue 원문 재작성과 키보드 trap의 공통 편집기 보완

- **L885-004 PRODUCT:** `project-issues.spec.ts:200`의 정확한 records 동등 비교에서 상태만 저장한 Issue의 원문 `로그: https://example.com/issues/123\n추적 완료`가 `로그: [https://example.com/issues/123](https://example.com/issues/123)\n추적 완료`로 바뀌었다. MDXEditor의 기본 AutoLink가 초기 정규화 이후에도 URL을 link node로 변환해 onChange를 발행했다. 단순 재개방·다른 필드 편집 시 본문 무변경 계약 위반이며 예상값을 정규화해 통과시키지 않는다. 공통 편집기의 공식 `linkPlugin({disableAutoLink:true})`로 비사용자 자동 변환만 중단하고 수동 링크·읽기 GFM은 유지한다.
- **L885-005 PRODUCT:** `project-issues.spec.ts:569`의 ko/390 비밀번호 확인 포커스 검증이 실패했다. 원본 제한은20 Tab이었다. trace에서 본문 focus가 고정된 채 빈 paragraph의 들여쓰기가 매 Tab마다 40px씩 증가했으므로 단순 새 툴바 길이 부족으로 단정할 수 없다. 설치 listsPlugin의 TabIndentation이 일반 본문의 Tab을 소비했다.
- ui_ux의 좁은 설계는 일반 rich-text 본문에서 수정키/IME 없는 Tab·ShiftTab을 브라우저 폼 탐색으로 넘긴다. 가장 가까운 contenteditable이 정확한 앱 rich-text root일 때만 propagation을 중단하고 default를 막지 않는다. toolbar·중첩 표/CodeMirror·Source는 제외해 표의 셀 이동과 코드 들여쓰기 키맵을 임의로 없애지 않는다. 이들 중첩 편집기의 독립 키보드 탈출은 별도 **NOT TESTED**다.
- frontend는 기존 #869의 원본/dirty·locale·element identity·5폭·title/body scroll·focus/viewport/ring assertions를 유지한다. 실제 유효 tab-stop 수+한 바퀴 상한으로 focus 경로를 검사하고 본문 진입과 전후 필드 이동을 확인한다. timeout/retry 확대나 focus 강제 지정으로 마지막 필드 도달 검증을 대체하지 않는다. 기존 첫 Issue의 정확한 원문 비교도 유지한다. 코드·UI 판단은 ui_ux 읽기 전용 설계와 frontend 구현을 구분한다.

### 제품 보완 후 최종 동결·로컬 실행

- 동결 구현/테스트 합성 SHA256은 `7f3def2bcf854dfab8ed4ee0840f5a38ae848aa8be7546bd9ec0ff99b7549f02`(추적 src/db/tests/scripts/package+lock 1326파일)이다. Summary guard/classifier·Markdown 공통 편집기·기존 Unit3파일·E2E4파일의 최종 검증은 이 source에서 수행한다. 이전 지문들의 FAIL/PASS는 별도 이력이며 새 source에 합산하지 않는다.
- **LOCAL_PREPR=BLOCKED:** 최종 `verify:prepr --mode=fast` 실행은 두 producer의 자동 매핑 미지원 때문에 명령 실행 전에 안전하게 중단했다. 선택48테스트/UNKNOWN2/missing0, sourceStable=true, fingerprint `c8ebb169f54629e4e627f8478427492b3da198cb5bd26a54b06b2f44557769d0`, report `.prepr-reports/issue-885-product-final-fast/`다. `src/domain/tasks/task-patch-fields.ts`와 `src/features/markdown/mdx-client-editor.tsx`의 누락을 지우거나 catch-all/정책 변경으로 PASS로 만들지 않는다. 이는 실제 테스트 실패나 원격 Required PASS가 아니다.
- **수동 영향 매핑:** Task classifier→Summary guard/leaf metadata/schedule·progress·baseline·unknown 음성은 `task-candidate`, `summary-task-details`, `task-field-contract`, 기존 hierarchy/handler/projection Unit 및 실제 Summary·Milestone E2E로 검증한다. MDX 공통 편집기→Issue 재개방/상태만 저장·2회 Source↔visual 원문 보존, #869 본문 Tab/ShiftTab·ko/en/vi5폭·Task/Summary 저장/dirty/readonly와 Milestone 입력은 같은 7spec56case로 검증한다. 과거 실패18 Unit과 나머지 음성은 전체 Unit에 포함한다.
- Manager는 이 명시적 수동 매핑으로 직접 실행한 전체 Unit·typecheck/lint/build·한정 브라우저 결과를 별도로 인계한다. 자동 선정 report는 계속 BLOCKED이며 수동 PASS로 덮어쓰지 않는다. 자동 producer 매핑의 별도 보강과 최종 Owner/Trusted/Required 증거는 후속 검토 항목이다. 현재 사용자 승인 범위는 새 PR CI 시작까지이고 Manager ACCEPT/merge 승인은 아니다.
- 최종 전체 Unit 명령 `npm test -- --maxWorkers=2`는 **307 files PASS / 기존1 file SKIPPED, 3752 cases PASS / 기존3 cases SKIPPED(3755), 132.59s, exit0**였다(`issue-885-product-unit.log`). 과거 실패18파일과 이번 Summary 추가5case·Markdown/DB/보안/LLM source 경계를 포함한다. 이전 source의 3747PASS와 합산하지 않는다.
- 최종 `npm run typecheck`, 제품3파일/변경Unit3파일/변경E2E4파일 ESLint 및 `NEXT_DIST_DIR=.next-prepr npm run build`(webpack·Next TypeScript·페이지·standalone/runtime-tools) 모두 **PASS/exit0**였다(`issue-885-product-build.log`). Markdown417파일 링크와 정확한 DOC_SYNC/AC01~10 parser도 PASS이며 parser PASS는 의미 QA/Owner 승인이 아니다. 이전 Next 자동 생성 타입 변경은 원본으로 복원한다.
- qa_docs의 최종17파일 **정적 사전검토 PASS**를 받았다. Summary의 실제 일정/진척/Baseline/unknown 차단과 엄격 입력/transaction, Tab 적용 범위·수정키/IME/표·CodeMirror 제외, 수동 링크/읽기 renderer 유지와 기존 원문/포커스 assertions 보존을 확인했다. 중첩 키보드 탈출·리스트 계층 Tab·AT/native125%는 독립 실증 전 NOT TESTED, 자동 매핑은 BLOCKED, 최종 원격/Owner/Manager 승인도 NOT TESTED다.

### L885-006 — 최종 집계55 PASS/1 FAIL과 Chromium 날짜 필드의 내부 Tab 정류장

- 지문 `7f3def2b...`의 브라우저 실행 전체 집계는 **55 PASS / 1 FAIL, 10.4분/exit1**이다(`issue-885-product-browser.log`). Summary200 실제저장/재조회, Issue 원문 정확 보존·2회 모드 전환, 다른54개 중 관련 경로는 실제 PASS였지만 #869 ko/390 비밀번호 확인 포커스 검증은 여전히 FAIL이었다. 중간 진행 보고에서 로그 마지막 PASS행만 읽어 실패0으로 전달한 것은 잘못된 집계이며 최종 원장과 보고는 전체 FAIL행을 포함한 집계를 따른다.
- 새 focus-path는 `tabStopCount=16`, 본문 진입=true, paragraph 들여쓰기 증가=0이었다. 원래 제품 Tab trap은 해소됐지만 DOM input 하나인 날짜 입력이 Chromium의 연/월/일/달력 버튼 여러 native 정류장을 소유해 단순 DOM count가 반복 상한을 과소평가했다(**TEST_CONTRACT**). 테스트는 본문에17번째로 정상 도달한 직후 끝났다.
- #869에 보이는 활성 날짜 입력당 최대4 native 정류장(기존 DOM count에 이미1개 포함)을 반영해 `nativeStopBudget=tabStopCount+3*nativeDateCount+1`로 한정한다. 기존 password-confirmation 실제 focus/viewport/ring 및 일반 본문 양방향 Tab assertions는 유지한다. timeout/retry나 목표 focus를 강제로 지정하는 변경은 없다.
- 날짜 상한 교정 source `ebe94388c3e309684c39b6eaad45ab775c68c772a349d8afcb331b8541e4bbb2`의 #869 단독 실행은 **1 FAIL/19.2s**였다. ko390 경로는 실제 `16 DOM stops / 2 date inputs / budget23`에서 **17 본문 → 18 비밀번호 → 19 비밀번호 확인**을 통과했고, 추가한 reverse assertion이 같은 class를 쓰는 placeholder까지2개 선택해 strict violation으로 실패했다. 제품 오류로 바꾸거나 기존 focus 단언을 삭제하지 않고 `[contenteditable='true']`로 실제 본체를 한정한다. 단독 red report/trace는 `.prepr-reports/issue-885-focus-date-budget-red/`에 보존한다.
- 마지막 변경은 #869 테스트의 계수·진단·실제 본체 선택자뿐이며 제품3파일·Unit3파일은 앞선3752PASS/build 검증 이후 변경하지 않았다. 새 spec SHA256 `c56a4a5ceef3e15e1d5fb16d6e18ee64657b525a4ebbd282cd8e0f225b1254ea`에서 먼저 #869 단독을 재검증하고, 최종56case는 동일 동결 source에서 다시 실행한다. 이전55PASS와 단독PASS를 합산해 새56PASS라고 하지 않는다.
- **범위 정정:** #869는 **ko 고정·5폭**과 기존 effective125%·coarse·focus 복원 case다. 앞선 수동 매핑의 `#869 ... ko/en/vi5폭`은 부정확한 축약이었다. 3locale×5폭은 별개 `i18n-master-data.spec.ts`의 마스터 입력 검증이며 같은 Issue 편집기의3언어 실증으로 확대하지 않는다. 실제 AT/native125%·중첩 편집기/리스트 Tab은 별도 미검증이다.
- 마지막 spec `c56a4a5c...`의 #869 단독 재검증은 **1 PASS, 23.0s(전체31.4s), exit0**였다. ko5폭 모두 실제19번째 비밀번호 확인 도달, 390은 DOM16/date2/budget23, 768/1024/1440/1920은 DOM17/date2/budget24였다. 본문 진입·역방향 Tab/ShiftTab·focus ring·viewport·title·effective125%·coarse·focus 복원도 같은 case에서 통과했다. 정제 요약 `.prepr-reports/issue-885-focus-native-summary.json`, raw report `.prepr-reports/issue-885-focus-native-green/`를 보존한다.
- 이 테스트-only 보완의 별도 정적 사전검토 PASS를 받았고 최종 typecheck/파일 lint도 PASS였다. 게시 후보의 전체 구현·테스트 지문은 `72d20b50953d737e3453991ac7a4b371b9ba178c8c227f1d4249c58c6dd4356c`, E2E 제외 제품/Unit 지문은 `142720631caed24226e13a1290eeec9a65151e6fa8976192f81a40f53d72f827`이다. 마지막 변경 범위는 #869 계수/진단/본체 선택자뿐이며 앞선 제품/Unit/build 실행 이후 제품·Unit 파일을 수정하지 않았다. 최종56case는 이 게시 후보에서 별도 다시 실행한다(`issue-885-publish-browser.log`).

### 게시 후보 최종 결과와 새 CI 인계

- **최종 Chromium: 56 PASS / 0 FAIL / 0 SKIPPED, 7spec, 10.7분, exit0.** `issue-885-publish-browser.log`의 전체 집계이며 이전 부분 실행·55PASS·단독PASS를 합산한 수치가 아니다. 명령은 위 같은7spec에 `--workers=1 --retries=0 --max-failures=0`이다. 최종56에는 누적 E2E 실패의 Milestone/i18n, Issue 원문·모드 전환/Tab·실제 Task/Summary/연결 저장, 권한/오류/충돌·초안 및 인접 마스터 경계를 포함한다.
- 실행 전후 구현·전체 테스트 지문이 모두 `72d20b50953d737e3453991ac7a4b371b9ba178c8c227f1d4249c58c6dd4356c`로 같았다(`issue-885-publish-source-end.json`, sourceStable=true). 최종 report/첨부와 생성 화면은 `.prepr-reports/issue-885-publish-final/`에 보존하고, Next 자동 생성 타입 및 기존 output 증거 덮어쓰기는 게시 diff에서 제외했다. raw trace/인증·실제 DB는 Git에 넣지 않는다.
- 로컬 최종 결과는 전체 Unit **3752PASS/기존3SKIP**, 최종 typecheck/변경 TS10파일 lint/build **PASS**, 최종56 Chromium **PASS**, 별도 정적 사전검토 **PASS**다. 69개 focused Unit은 전체 Unit의 일부이며 중복 합산하지 않는다. 초기 fast Unit timeout FAIL, 부분 브라우저 중단,53/3·55/1 및 단독 red는 모두 위에 보존한다. **LOCAL_PREPR 자동 선정은 UNKNOWN2/BLOCKED**로 남고 실제 명령 성공과 구분한다.
- 게시 전 `2026-11-07 12:59:38 UTC` 원격 재확인: PR887 OPEN/non-draft/mergeable=true, 미해결 review thread0, main/base `f3f8b89ef09bab35987b32f4945dac91b6fa223a`, 원격 작업 branch Head `c136213dae525f95697b116b6624ef333320ea70`로 시작 기준과 동일했다. 이는 새 Head 최종 리뷰나 strict-main/Trusted 성공이 아니다.
- 변경은 제품3파일·기존 Unit3파일·E2E4파일·관련 문서7파일의 한 묶음으로 게시한다. 새 commit/Full PR CI Run·Attempt·Head/base/test merge는 게시 후 **Issue885 STATUS 및 PR887 댓글**에 남겨 추가 문서 push로 중간 Head/CI를 만들지 않는다. 시작 등록 후 job/완료/Trusted 결과는 모니터링하지 않는다.
- 최종 상태: `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`, `release_required=true`, `release_authorized=false`. 원격 Required Quality/E2E8/Docker·Trusted/Owner 최종 판단은 **NOT TESTED**다. UNKNOWN GET 정체 근인, 자동 producer 매핑2개, MDX 다국어 전체/중첩·리스트 키보드/실제AT/native125%·운영 복구의 미검증은 별도 후속 경계다. 병합·Main/GHCR/Release/Finalizer·브랜치 삭제·Issue 종료는 실행하지 않는다.

## F885-007 — 2026-11-07 Full #3562.1 Shard3 프로젝트 GET ECONNRESET / 전체 F885-001~006 재평가

### 정확한 원본·직접 검증 상태

- **원본 불변:** [PR #887 Full #3562.1 / Run 42375152828](https://github.com/planner77/masterGantt/actions/runs/42375152828), attempt 1, source HEAD `346610481b4265757329866caa2bab9ed227d773`, base main `f3f8b89ef09bab35987b32f4945dac91b6fa223a`, overall FAILURE. 관련 FAST #307.1은 SKIPPED이며 증거로 사용할 수 없다.
- **직접 성공:** QA Preflight `128411183882`, 정책·저장소 `128411256976`, npm ci, TypeScript `128411256991`, ESLint `128411256914`, Vitest `128411256935`, Next production build `128411887925`, Docker implementation `128411888028` 모두 SUCCESS. Required Quality `128412173250`, Required Docker `128412925948` SUCCESS. 이는 오직 이 HEAD의 성공 결과이다.
- **직접 실패:** Chromium E2E shard3 Job `128411888070`, `tests/e2e/issue-762-process-workareas.spec.ts:19`의 Project canonical GET가 HTTP 응답 전 `Error: apiRequestContext.get: read ECONNRESET`로 종료됨. 26 PASS/1 FAIL/132 NOT RUN, 나머지 7 shards CANCELLED. Required E2E `128412859647`, QA Final `128412944408` FAILURE는 이 직접 실패의 파생. GitCommitInfo 초기 `git fetch` 3초 timeout은 별도 도우미 출처이며 이 E2E의 원인이라고 단정하지 않는다.
- **원격 artifact forensic:** `playwright-report-shard-3` artifact `13575093837`(원본 파일 2,894,205 bytes)의 isolated fixture sanitized `isolated-application-diagnostics` 첨부를 직접 읽었다. **실패 이후** 테스트 실패 snapshot 시 격리 Next server process `alive=true,exitCode=null,signal=null,expectedShutdown=false`; health `/api/health/ready` HTTP **200 / 37ms**, cgroup `oom=0,oomKill=0`. 최근 프로젝트 POST는 HTTP201, 브라우저 측 canonical GET도 HTTP200 이력이 존재. 따라서 서버 종료·OOM·API 계약 HTTP500를 직접 실패 원인으로 확정할 수 없고, 가능한 원인으로 연결 풀/Next dev compile 중 개별 TCP 소켓 종료가 남는다. 실제 실패한 GET에는 응답 코드가 없으며 정상 GET 완료 증거를 실패한 요청의 성공으로 치환하지 않는다.
- **교차 실패 계보:** F885-001/#3556 DOC_SYNC → 최신 Preflight SUCCESS; F885-002/#3557 npm lock peer → 최신 npm ci SUCCESS; F885-003/#3558 JSX/ref/24 Vitest → 최신 TS/ESLint/Vitest SUCCESS; F885-004/#3559 SQLite 0038 추가 두 비교 → 최신 Vitest SUCCESS; F885-005/#3560 구 Description textarea → F885-006 로컬 56/56 전체 성공과 #3562 unit/build 성공이나 *이번 CI의 동일 E2E 전체 8/8은 아직 미실행*; F885-006/#3561 catalog GET 미완료 → 새 test+product 교정·로컬56 통과했으나 원격 #3562에서는 다른 기존 격리 테스트에서 네트워크 `ECONNRESET`. F885-006 GET 정체와 F885-007 reset은 비슷한 읽기 경계에 있지만 인과·공통 root는 **UNKNOWN**.
- **근본적인 검증 범위 공백:** 기존 코드에는 `tests/e2e/fixtures/isolated-application-diagnostics.ts:observedReadOnlyGet` (#703/#860)이 있고 `tests/scripts/isolated-readonly-get.test.ts`가 200/404/409/503/timeout/두 번째 reset/다른 오류에 대해 동일 GET 1회 추가만 허용함을 독립 테스트한다. #762의 **두 E2E case**는 아직 `page.request.get`를 직접 사용해 해당 진단·한정 복구 경계를 통과하지 않았다. 초기 7-spec/56case 로컬 집합에도 #762가 포함되지 않았으며 Full8 fail-fast가 해당 샤드 후속 132case를 미실행으로 남겼다.
- **보완 설계:** 신규 제품 재시작/메모리·Timeout·CI·HTTP 미들웨어 변경은 증거 부족으로 보류. 기존 #762 두 E2E의 canonical Project/Process Context/Target-retired/Task-process-context **읽기 전용** GET에만 `observedReadOnlyGet(observeIsolatedApi,relativeRoute,()=>page.request.get(url,{headers:{Connection:"close"}}))`를 적용한다. 모든 첫 전송 실패를 별도 프로세스/health/cgroup 관측으로 안전 첨부한 다음 정확 `ECONNRESET`/socket-hang-up에 한해서만 두 번째 GET 최대1회. 2회 모두 실패·다른 예외·timeout·HTTP401/404/409/410/503·JSON 오류는 실패/원본 assertion을 유지. POST/PATCH/DELETE·revision CAS·재시작·기존 5폭/관계·권한·초안/조회 assertions 절대 재시도하지 않는다.
- **TEST_LIFECYCLE_REVIEW:** `EXTEND` 기존 #762 E2E 2개(0 skip/retire, 모든 원본 assertions 유지) 및 GET 200 정확 검증. `KEEP_UNIQUE` GET helper의 기존 엄격 음성 Unit `tests/scripts/isolated-readonly-get.test.ts`, #550/Issue885 Markdown Task/Issue/DB 0038/Gantt 증거, #866 GET/412·#869 초안/focus, 전체 8-shard/Required3. 재시도 공통 정책을 확대하거나 test-level/global timeout, Playwright retries/maxFailures/CI 스킵은 변경하지 않음.
- **AC_TEST_COVERAGE:** AC01~04 #885 Markdown/API/DB 기존 검증 유지, AC05/06 #762의 실제 HTTP·프로젝트 권한/반환 상태·CAS·저장/재열기, AC07/08 390~1920 UI/focus·로컬 이력, AC09 최신 Next build 및 새 CI 필수 증거, AC10 7회 Full 실패와 원본 Artifact·source/boundary 구분. 기존 AC01~AC10 Work Packet 매핑 및 QA 정책 불변.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_885_FAILURE_ANALYSIS.md` UPDATED, `docs/exec-plans/active/ISSUE_885.md` UPDATED, 기존 `tests/e2e/issue-762-process-workareas.spec.ts` EXTEND. `AGENTS.md`, `DESIGN.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/TEST_PLAN.md`, `docs/CI_CD.md`, `docs/QA_REVIEW_POLICY.md` 유지. 원본 secret-containing HTTP trace/raw screenshot을 Git에 업로드하지 않음.
- **검증 경계:** 본 변경은 원격 Branch source+실패 artifact·기존 helper Unit 근거의 정적 보완이며 수정 후 전체 CI/브라우저 실행은 **NOT TESTED**. 정확 Head/Attempt/Required3/Trusted/Owner 별개. 새 HEAD 단일 Push로 Full PR CI를 시작하고 **모니터링하지 않음**. 병합/Main/Release/GHCR/Issue close 제외, HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false, manager_decision NOT TESTED.

## F885-008 — 2026-11-07 PR #887 Full CI #3563.1, Chromium E2E 샤드1·3의 35분 상한 취소

### 원본 결론·실행 계보

- **원본 불변:** [Run #3563.1 / 42376741473](https://github.com/planner77/masterGantt/actions/runs/42376741473), `pull_request`, attempt1, source Head `26ac9049a82ea143e1aa614039c3cf62041e2a04`, base `f3f8b89ef09bab35987b32f4945dac91b6fa223a`. 전체 Run 결론은 **CANCELLED**(FAILURE와 분리). 동일 Head 비권위 FAST #308.1은 SKIPPED. QA Preflight `128415857426`, Policy `128415927908`, TS `128415927984`, ESLint `128415927893`, Vitest `128415927963`, Next build `128416446673`, Docker 구현 `128416446831`, Required Quality `128416824140`, Required Docker `128417501028` 모두 SUCCESS.
- **직접 상한 근거:** `ci.yml`에서 PR용 `pr_e2e_shard.timeout-minutes=35`. 모든 E2E Job이 `13:26:30~31Z` 시작. Shard1 Job `128416446815`은 `14:01:49Z`에 CANCELLED, Shard3 `128416446839`는 `14:01:47Z`에 CANCELLED, 두 `E2E shard 실행` 단계 모두 `14:01:43~44Z`에 `The operation was canceled`가 기록됨. **35분 + 약16초의 runner 정리**와 일치. GitHub가 취소 API 호출자/원인을 별도 노출하지 않아 수동 cancel 가능성을 절대 부정하지 않되, 같은 시간상한을 두 Job이 동시에 도달한 강력한 구조적 증거다. 애플리케이션 assertion/HTTP500·메모리 부족의 직접 FAIL 로그는 확인되지 않았다.
- **8-shard 실제 원본 소요시간:** shard1~8 job wall(min) `[35.30,29.85,35.28,21.12,32.22,33.23,22.97,28.00]`. **2/4/5/6/7/8 SUCCESS**. Shard1 원문에서 **최소125 PASS**, 마지막 `resource-milestone-ui.spec.ts`는 완료되지 않았고, Shard3에서 **149 PASS와 일부 미완료**(로그 번호150)이며 이후 8-shard 모든 실행이 끝난 것은 아님. E2E Required aggregate `128424370612` FAILURE(`needs.pr_e2e_shard.result=cancelled`), Automated QA Final `128424392860` FAILURE는 이 취소의 파생. 원본 Full 8 PASS는 없다.
- **이전 F885-001~007 재검증:** F885-001의 DOC_SYNC/미해결 P1 link format → 최신 Preflight SUCCESS·PR review resolved. F885-002 npm `yjs/lib0/isomorphic` lock → 최신 npm ci/Policy·Build SUCCESS. F885-003 TSX/ref, SQLite 0038/DTO, SVAR immutable packages 24 Unit failure → 최신 TS/ESLint/Vitest SUCCESS. F885-004 나머지 CLI·legacy Task 비교 2 Unit failure → 최신 Vitest SUCCESS. F885-005 구 textarea→Source 입력/role 오류 → #3561 이후 로컬56case PASS, 이번 shard2 SUCCESS; 다른 E2E 증거는 계속 별도. F885-006 실제 catalog GET 정체 → 로컬56 PASS·새 원격7번 shard SUCCESS, **원인 미확정**. F885-007 shard3 #762 GET ECONNRESET → #3563 shard3에서 `issue-762-process-workareas` 2case PASS, 엄격 GET-only 진단 도입과 양립하나 TCP 근본 원인 해결을 증명하지 않음. 최신 독립 문제는 E2E 작업 분량/35분 하드상한과 예상치의 불일치다.
- **공통 구조 분석:** #3556~3559의 앞단 Quality/Preflight 실패는 downstream E2E를 차단했고 #3560~3562의 E2E 첫 FAIL은 다른 shard를 중단했다. 이제 원래 147 파일이 8 shard에 모두 배정되어 실증됐고 6 shard SUCCESS/2 timeout 위험이 드러났다. 단일 스펙 문법 보완보다 **전체 원본 E2E 경로·시간 예산/실패 원인 계보**를 함께 관리할 필요가 있다.

### 안전한 정적 재배치와 추정 한계

- **설계 선택:** 기존 8샤드/1worker/35분/모든 test/fail-fast/Required3/QA gate 보존. **6개 전체 E2E spec만 다른 샤드로 이동**, 테스트 내용·실행 수·선택·재시도·타임아웃은 건드리지 않는다. 관측된 각 완료 spec의 시각 차이를 파일별 wall 근사치로 사용한다. 취소된 테스트 실행·Fixture 효과·다른 Runner에서는 차이가 날 수 있으므로 이는 실측 *보정 가정*이지 새 HEAD 성능 보장이 아니다.
- **이동 / #3563 완료 파일 구간 wall:** shard1→4 `project-summary-bar-visual` 4.06분 및 `project-grid-reorder-persistence` 3.01분; shard3→7 `project-list-search-filter` 3.94분 및 `milestone-stage-exchange` 2.41분; shard6→4 `milestone-visibility-persistence` 1.83분; shard5→7 `logistics-dashboard-request-state` 1.57분. 이전 계획 개수 `[19,18,19,18,18,18,18,19]`, 이후 `[17,18,17,21,17,17,21,19]`, 총 **147/147 중복0·누락0**, 보존된 과거 `metrics`/`sourceRunIds`/기존 모든 `projectedMs`/manualRebalance F767/Issue880 메타데이터 불변.
- **단순 Shift-only 전후 관측치:** 기존 `[35.30,29.85,35.28,21.12,32.22,33.23,22.97,28.00]` → 이동 파일 구간 더하기/빼기 `[28.23,29.85,28.93,30.02,30.65,31.40,30.89,28.00]`분, 최대 **31.40분**. 이 수치는 취소 당시 미완료 케이스 시간 및 순서·캐시·compile·Runner 부하 불포함. 반드시 새 Run/Attempt·실제 8/8 PASS를 별도로 확인하고 개선율/시간 절약을 실제 결과로 발표하지 않는다.
- **사전 검증:** `tests/config/e2e-shard-plan.json` 원본과 수정본 8샤드의 정확 147개 파일 집합/유일성, 여섯 출발·도착·old/new counts, 이동하지 않은 141개 소속 완전 동일, `tests/scripts/e2e-shard-planner.test.ts`의 기존 선택 전체·고정 소속 assertions 유지 및 신규 incident pins/6개 목적지 검증을 정적으로 확인. GitHub Actions PR 테스트/새 Chromium 실제 실행은 **NOT TESTED**.
- **TEST_LIFECYCLE_REVIEW:** KEEP_UNIQUE 원래 147 E2E specs 및 각 assertion, 8샤드/35분/다수 negative/DB·보안·Markdown·i18n·뷰 UI 직접/인접 회귀. EXTEND 기존 shard planner 단위 테스트의 현재 file counts/추가 6개 고정 소속·metadata consistency, ADD 신규 suite 없음, RETIRE/SKIP 없음. Workflow/플랫폼 timeout·retries/gate 변경0.
- **AC_TEST_COVERAGE:** AC01~09 기존 MDXEditor/SQLite/Gantt/Issue/Local56 원문 검증을 새 배치에서 그대로 실행(실제 결과는 아직 미확인). AC10 Fail Ledger·TEST_LIFECYCLE_REVIEW·historical metrics 불변·147파일 고유 배정·Required E2E8/Trusted/Owner provenance 추가. CI/QA 승인과 E2E 무검증 구분.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_885_FAILURE_ANALYSIS.md`, `docs/exec-plans/active/ISSUE_885.md`, `docs/CI_CD.md`: UPDATED. `tests/config/e2e-shard-plan.json`, `tests/scripts/e2e-shard-planner.test.ts`: UPDATED. `AGENTS.md`, `DESIGN.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/TEST_PLAN.md`, `docs/QA_REVIEW_POLICY.md`, `docs/GITHUB_OPERATIONS.md` 제품/테스트 정책·릴리스 정책 변경 없으므로 추가 변경 없음. 원본 QA Preflight DOC_SYNC 선언 정확 형식 유지.
- **Exit/risk:** HIGH, OWNER_MANAGED, qa_required=true, release_required=true, release_authorized=false, manager_decision NOT TESTED, MERGE_READY BLOCKED. Exact new HEAD PR Full CI **킥오프까지만**, 이후 CI 결과 모니터링·리트라이/메타데이터 조작·병합/Main/GHCR/Release/Finalizer/Issue close 없음.
