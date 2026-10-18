# Issue #717 — 이름 우선·코드/ID 요청 조회

## 실행 범위와 승인

- Issue: [#717](https://github.com/planner77/masterGantt/issues/717), 기존 PR [#718](https://github.com/planner77/masterGantt/pull/718) 재사용. 2026-10-18 사용자 요청으로 과거 docs-only 제안을 제품 구현·미해결 리뷰/충돌 해결·Full PR CI 시작까지 확장했다. CI 완료 모니터링·병합·Main/GHCR·Issue 종료는 범위 밖이다.
- 기준 main: `d2768676aa7a0edff67df9bdeb3e1b49979fd577`, 기존 원격 Head `d97f1e60419575f4db3785c239b3ae341b3086d5`. 작업 worktree `issue-717`, local branch `fix/issue-717-name-first-ui`, 게시 대상은 기존 `docs/issue-717-name-first-identifier-policy`다. main과 기존 PR을 모두 조상으로 보존해 PLAN 충돌을 양쪽 기록 유지로 통합했다.
- Version: main `0.116.0` → 호환 표시 개선 PATCH `0.116.1`. `release_required=true`, `release_authorized=false`. 버전 변경은 태그·GHCR 승인 근거가 아니다.
- `risk_level: HIGH`, `qa_required: true`, `qa_method: OWNER_MANAGED`. 초기 MEDIUM에서 로컬 영향 선택기의 HIGH 최소 위험도(공유 Workspace/Resource·TEST_PLAN·E2E helper)에 맞춰 승격했다. 다중 frontend 조회/선택 표시와 공통 disclosure 영향; API/DB/권한/비동기 복구 엔진 변경 없음. 보호된 package/lock은 버전 일치 변경만 있다. 최신 main Owner-managed 경로를 유지하며 사용자 제공 AGENT 보호 검토 기준도 약화하지 않는다. 독립 qa_docs 사전 검토와 최종 신뢰된 QA/Owner 병합 허가는 구별한다.
- `manager_decision: NOT TESTED`, `MERGE_READY: BLOCKED`; exact-head Required3/Trusted/Owner 승인 전 ACCEPT 금지. Reviewer와 최종 소스 지문은 검증 절에 남긴다.

## 역할·설계·경계

Manager는 shared `IdentifierDetails`, Project/Import 표시, 문서/version·E2E·게시를 담당한다. `identity_design` ui_ux는 전 화면 inventory/read-only 설계, `milestone_identity` frontend는 Milestone/기존 E2E 및 실제 HTTP 테스트, `logistics_identity` frontend는 물류와 관련 단위 테스트, `editor_resource_identity` frontend는 Editor·Resource·기준정보, `identity_qa` qa_docs는 독립 read-only 사전 검토를 수행했다. 실제 분리 Agent 실행이며 동일 파일 동시 작성·sub-agent GitHub 댓글 없음. 모델/effort는 런타임 role 설정이며 별도 성능 검증을 주장하지 않는다.

`ui-ux-pro-max` keyboard/접근성 지침과 `playwright`를 적용했다. **Design Delta A**는 기존 #717 문서 제안의 `DESIGN.md` §1.3을 구현하며 원칙 자체를 재정의하지 않는다. native disclosure·semantic token·44px·이름 최소폭은 기존 공통 원칙의 B 구체화다. 별도 색상·폰트·시각 시스템은 추가하지 않는다. SVAR native API/interaction/Core 변경이 없어 신규 SVAR 공식 sample/API 조사 N/A; 기존 실제 Gantt 인스턴스 보존 회귀는 유지한다.

포함: 일반 Milestone·물류·Target·Task/관계·Resource·기준정보·Import 표시, 선택 후보 문맥과 원문 조회·복사, 관련 local 검색과 테스트. [전체 인벤토리](../../ISSUE_717_IDENTITY_INVENTORY.md)에 파일별 개선/예외/원문 경로를 기록한다. #519 picker 기존 구현과 #715의 설명 축소는 재구현하지 않는다.

불변: canonical code/externalId/taskId 데이터, React key/선택값/링크/저장·cache/API/DB/DTO/schema/JSON/Excel·Copy ID, 보안/Origin/If-Match/revision, Gantt Core/일정 엔진. 관리 코드 입력·외부 매핑·검증 오류·파괴적 공유 변경 확인은 근거 있는 예외다.

## 구현과 회귀 보완

- 기본 목록은 이름·상태·날짜/상위 경로. 전체 ID는 닫힌 native details의 읽기 전용 원문·명시 복사로 조회한다. Clipboard 실패 안내와 전체 텍스트 선택 대체 경로가 있다. 피드백은 현재 원문 scope와 일치할 때만 표시한다.
- 공정명은 첫 열, 최소220px; 공정 전체 표 최소728px와 셀 예산220/180/80/88/160px로 내부 가로 scroll을 소유한다. 기존 코드 자동 생성·수정 원문은 유지한다.
- 동명 관계 후보는 실제 표시 부모 이름/날짜가 같은지 비교한다. 다른 canonical 부모라도 같은 표시명이면 외부 ID로 보조 구분한다. 코드/ID 검색·선택/저장 body 원문은 유지한다.
- 기본 목록의 이름 누락은 읽을 수 있는 확인 필요 상태이며, Resource Plan/Target의 전체 원문 코드·ID는 각 disclosure에서 확인한다.
- 초기 독립 PRE_QA REWORK: 모바일 공정명 약60px 축소, 관계 후보 표시 충돌, Resource Plan 그룹/개인/Target 원문 접근 누락을 각각 보완했다. 원본 지적을 PASS로 소급하지 않으며 새 소스로 재검토한다.

## DOCUMENTATION_SYNC

- `DESIGN.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/ISSUE_717_IDENTITY_INVENTORY.md`: UPDATED
- `docs/ISSUE_717_FAILURE_ANALYSIS.md`: UPDATED
- `docs/exec-plans/active/ISSUE_717.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `AGENTS.md`: N/A(기존 역할·보안·문서·Owner 승인 기준 유지)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 단계·증거·Owner 승인·종료 게이트 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A(최신 main의 Owner-managed 정책 불변, 보호 파일 자기 승인 없음)
- `docs/AGENT_PROMPTS.md`: N/A(역할/모델·위임 절차 불변)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 PR 재사용과 B 게시 경로를 적용하며 권한·workflow·Ruleset 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(공식 Required3·Trusted QA·main/GHCR 게이트 불변)
- `docs/CI_CD.md`: N/A(기존 PATCH/version 승인·릴리스 계약 적용, CI 설정 변경 없음)
- `docs/API.md`: N/A(HTTP API·DTO·저장 payload 불변)
- `docs/DB_SCHEMA.md`: N/A(DB/schema/migration 불변)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정/달력/원장 알고리즘 불변)
- `docs/SECURITY.md`: N/A(인증/권한·Origin/revision 불변)
- `docs/IMPORT_SCHEMA.md`: N/A(파일 schema·canonical 외부 교환 원본 불변)
- `docs/IMPORT_EXPORT.md`: N/A(입출력 표시만 변경, 서버 처리·파일 규격 불변)
- `docs/DEPLOYMENT.md`: N/A(배포·Docker·운영 구성 불변)

## AC_TEST_COVERAGE

- AC1: `docs/ISSUE_717_IDENTITY_INVENTORY.md` 전 화면 파일별 조사·반영·예외·원문 접근; #519/#715 중복 비구현 확인.
- AC2: `tests/features/milestones/milestone-name-first.test.ts`, `tests/e2e/issue-717-name-first.spec.ts` 이름/상태/날짜와 닫힌 raw ID, 관리·원인/Copy ID 회귀.
- AC3: `tests/features/logistics/logistics-identity.test.ts`, 기존 `project-logistics-management.spec.ts`, 새 5폭 cell>=220px; 자동 코드 생성·원문 수정은 기존+실제 HTTP 회귀.
- AC4: inventory의 물류/Resource/Target·Task/관계·기준정보·Import 반영과 화면별 예외, 변경된 관련 Unit/E2E. 나머지 모든 화면의 5폭 전체 실증을 완료로 표시하지 않음.
- AC5: `relation-candidate-context.test.ts`, `resource-search-filter.test.ts`, 물류 identity/context·Resource Plan 단위 및 새 `issue-717-identity-persistence.spec.ts`; 같은 이름 중 정확 UUID 수정/삭제, 코드/ID/이름 검색, 전체 복사·누락 이름 회귀.
- AC6: 실제 Chromium/mock HTTP before+after 각 390/768/1024/1440/1920px, `issue-717-name-first.spec.ts` keyboard/Enter/Space/관리 Escape focus/전체원문 복사·거부 수동 선택/표 내부scroll·cell/dialog/document geometry. 실제 screen reader·실기기·모든 변경 화면 5폭은 NOT TESTED.
- AC7: diff의 server/domain/API/DB/export·SVAR Core 변경0, version/lock 일치, 관련 문서·기존 canonical E2E 보존. DOC_SYNC와 실제 local 검증·원격 CI를 구별.
- AC8: 기존 PR #718 재사용·최신 main ancestry/충돌 해결·리뷰 thread 재조회·B 단일 Ref 게시; Required quality/e2e/docker·Trusted·Owner ACCEPT는 새 exact head CI 완료 전 NOT TESTED.

## 검증 증거와 현재 상태

- Baseline before: main `d2768676aa7a0edff67df9bdeb3e1b49979fd577`, 독립 임시 worktree 실제 Chromium/mock HTTP 5개 폭 캡처 PASS. UI 데이터는 synthetic fixture이며 실제 업무 데이터 아님.
- 후보 after: 5폭+touch Chromium **6/6 PASS**, 공정 identity 최소220px, document<=viewport+1·modal bounds·원문 Clipboard·keyboard/focus·동일 Gantt·조회 mutation0. 1440 Clipboard 거부/수동 전체 선택 포함. `output/playwright/issue-717/{before,after}` geometry와 대표 screenshot을 보존한다.
- 구현 Agent local: Milestone 모델/SSR69 PASS, 물류13 PASS, Editor/Resource81 PASS, 관계 후보2/기존 관계7 PASS, 추가 Picker2 PASS. 서로 중복 실행한 사례는 합산해 unique test 수로 주장하지 않는다. 기존 관련 Chromium 타깃7 PASS. Production build/runtime-tools PASS, lint PASS(0 errors/기존14 warnings; task-local 생성 디렉터리만 CLI ignore), Markdown249파일/version/diff 검사 PASS. 전체 Vitest는 2875 PASS/3 SKIPPED/보안 KDF2 FAIL였다. 부하와 동시에 5초 timeout·뒤이은 capacity 결과가 발생했으며 관련 미수정 보안 파일10건+새 Milestone1건의 좁은 재실행11/11 PASS로 구별한다. 최종 전체 재실행 `vitest --maxWorkers=2`는 **2877 PASS/3 SKIPPED(234 PASS files/1 SKIPPED file), 62.60초**. 최초 전체 unit FAIL 이력은 소급 PASS하지 않는다.
- 실제 HTTP/격리 SQLite 동명 수정·삭제·readonly: **1/1 PASS**. 같은 이름의 두 번째 Milestone PATCH와 공정 PATCH/DELETE204만 실행, 첫 번째 원본 불변·전체 코드 유지·각 revision+1·readonly 무mutation/Clipboard를 확인했다. 최종 실행15.4초/전체44.9초; 앞선 fixture description400·count tab selector 실패와 구별한다.
- 독립 `identity_qa` 사전검토: 초기 REWORK·지적 보완 완료, 최신 source/docs 재검토 미해결 P1/P2=0. 직접 unit6파일30건 PASS. 최종 Head 재확인 대기. 최종 QA·Trusted/Owner ACCEPT 아님.
- 원격 Head/Full run/attempt: 게시 후 Issue STATUS 댓글의 실제 값을 authority로 사용한다. Required3·Trusted·Owner·Main/GHCR/tag/cleanup은 NOT TESTED/범위 밖, Issue OPEN 유지.
- 최초 Full #2923.1과 metadata #2926.1 실패는 [누적 원장](../../ISSUE_717_FAILURE_ANALYSIS.md)에 보존한다. 새 CI 결과를 모니터링하지 않는다.


## 로컬 사전 도구 결과와 공개 한계

`verify:prepr --mode=fast`는 최초 MEDIUM/HIGH 최소 위험도 불일치로 BLOCKED, HIGH 재분류 후에도 미등록 경로18개로 BLOCKED(sourceStable=false, 동시 생성물 변경)다. 자동 선택기를 완화하지 않았다. [inventory 수동 영향 매핑](../../ISSUE_717_IDENTITY_INVENTORY.md)에 실제 소비자·직접 테스트 및 미검증 범위를 기록하고 개별 Typecheck/Lint/Unit/Build/Chromium을 별도 실행했다. 이 결과를 CLI PASS로 부르지 않는다. 범위가 넓어 관련 기존 회귀·독립 QA를 수행하며, 자동 매핑 영속 보완·모든 화면 모든 조합은 후속이다. PR CI 시작은 이러한 미완료를 숨기는 병합 승인이나 전체 Lifecycle 완료가 아니다.

- 관련 기존 Chromium 최초66: 55 PASS/10 FAIL/기존 baseline capture1 SKIPPED. 실패10은 숨긴 copy control geometry5·공정 global selector1·구 resource label/geometry4였다. 수정 후 실패 사례 전부 재검증: Milestone 관리5/5, Resource 상태9/9(해당 실패4 포함), 공정 자동 코드1/1 PASS. 신규 #717 geometry/touch6/6와 실제 격리 HTTP1/1 PASS. 서로 중복하는 실행을 단일66-run PASS로 포장하지 않는다.
- 실제 Resource catalog 기존 E2E의 resource/group 5폭 캡처를 `output/playwright/issue-717/after/resource-catalog`에 보존한다. 그 밖의 과거 Issue screenshot은 덮어쓰지 않고 이 작업에서 생성한 변경만 복원했다.

## PR CI #2935.1 실패 REWORK 및 새 Full 사전 인계 (2026-10-18)

- 정확한 원본: [#2935.1](https://github.com/planner77/masterGantt/actions/runs/39090284911) Head `a0d6cafe9cbc7c73f4980fd36498c628d8f024dc` / Base `d2768676aa7a0edff67df9bdeb3e1b49979fd577` / Full E2E FAIL / Quality·Docker PASS. [동일 Issue 전체 누적 원장](../../ISSUE_717_FAILURE_ANALYSIS.md)은 F-001 #2923 문서, F-002 #2926 metadata, F-003a Shard4 Target 편집 textbox, F-003b Shard5 cancelled 내부 #622 Target ID 누락, #2927 docs-only 성공을 분리한다.
- 분류: F-003a `TEST_CONTRACT` (read-only textarea와 editable input의 동명 strict mode); F-003b `PRODUCT/PRESENTATION`(일별 부하 상세 출발 선택 Target ID 원문 경로 누락); E2E aggregate·QA Final 후속 실패는 파생이며 root로 별도 계수하지 않음.
- 교정 파일: `tests/e2e/logistics-target-authoring.spec.ts`, `tests/e2e/issue-622-resource-plan-target.spec.ts`, `tests/e2e/issue-623-resource-mvp.spec.ts`, `src/features/resources/resource-plan-details.tsx`, `docs/ISSUE_717_IDENTITY_INVENTORY.md`, `docs/ISSUE_717_FAILURE_ANALYSIS.md`, `docs/TEST_PLAN.md`, 본 Packet 및 PLAN.
- E2E4는 새 인스턴스 생성 fieldset의 **편집 textbox**를 대상으로 지정하고 Target/ACS/MCS/상속 후보에서 동명이 아닌 한 이름-first 선택을 확인. E2E5는 최초 daily 상세에 직접 선택 Target ID 원문을 닫힌 disclosure로 보여 원문 조회를 복구한다. #622/#623의 투입률 입력은 코드가 없는 이름-first 표시를 사용하되 allocation/Target canonical·부하80/140/120·동일 Excel assertions은 그대로.
- 변경 영향·확대: Target 생성(whole/subset/공유·관리/412), Resource Plan 첫 daily→day resources→assignments→Task 편집, Target/Resource 표시·ID 코드 원문/동명, #621/#622/#623/#717, 관련 suite + Full E2E6. 기존 테스트 결과 중 취소/미실행을 PASS로 전용하지 않는다.
- 보존: DB/API/문서 외부 형식·Release 권한/SVAR Core/CI required 3개·Shard6/Fail-Fast·제품 보안/일정 엔진. Version `0.116.1`, `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=false`.
- 본 실행 환경 로컬 Node 프로젝트/Chromium runner 미제공: 직접 제품 테스트 **NOT TESTED**. 원격 원본 로그/정적 source-contract 검토를 별도 근거로 기록한다. 새 Full CI는 GitHub에 새로운 Head가 게시된 뒤 Run을 실제 조회하고 시작까지만 확인한다. 미해결 리뷰/최신 main/충돌과 DOC_SYNC는 게시 직전 재검증한다. 새 Head Required3/Trusted/Owner ACCEPT/병합·Main/GHCR·Issue 종료 아직 NOT TESTED/미승인.

## 최신 main #449 합류 및 문서 계약 보존 (2026-10-18)

- Base `d2768676aa7a0edff67df9bdeb3e1b49979fd577` 이후 #449 PR #458 merge `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`가 최신 main이다. 이 SHA는 위의 최초 기준선과 구분한다.
- `DESIGN.md`: #717의 Name-first §1.3과 #449의 내부 KPI/행 밀도/입력 식별성/실제 browser evidence 공통 기준 전부 보존; `PLAN.md`: #717 REWORK/제품 구현과 #449 감사 절 모두 보존. #449 전용 문서 3개는 upstream 원문 그대로 유지하며 해당 Issue 승인/검증을 #717로 전이하지 않는다.
- main 정렬은 문서/브랜치 작업이며 전체 E2E/QA/Owner SUCCESS를 뜻하지 않는다. 위 `DOC_SYNC`의 `DESIGN.md`·`PLAN.md` 반영 의미는 그대로 유지된다.

## PR CI #2940.1 — F-004 Milestone 기본 닫힘/geometry REWORK (2026-10-18)

- 原본 [Full Run #2940.1](https://github.com/planner77/masterGantt/actions/runs/39091834164), Head `6b226df1962791a4d647811b9ad8df854d56e3a1`, Base main `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`; Quality·Docker PASS, E2E Shard1 390px #463 geometry FAIL, 기타5 CANCELLED, QA Automated E2E 파생 FAIL.
- 누적 [Issue #717 전용 실패 원장](../../ISSUE_717_FAILURE_ANALYSIS.md) F-001(#2923), F-002(#2926 metadata-only), F-003a/b(#2935, Target authoring/Resource Plan), F-004(#2940, 새 Milestone 표시/계측 소비자) 전체와 #2927 docs-only 성공/지난 Head 로컬 evidence를 분리한다. #2940에는 #2935 당시 직접 실패의 E2E 케이스가 새 Head에서 PASS로 관측됐다.
- 새 진단: 닫힌 `IdentifierDetails` copy 버튼은 DOM에는 있으나 시각/레이아웃 컨트롤이 아니다. 기존 #463 전체 DOM 버튼 geometry 계측은 숨긴 요소를 셀 밖 0 rect로 다룰 수 있다. **결합 assertion이 어떤 flag에서 false인지 원본 raw metric 미첨부로 확증되지 않음**; 고정 원본 Trace와 #717 직접 visible UI 검증을 구별한다.
- `tests/e2e/milestone-dashboard-state.spec.ts` 최소 Test 변경: `tbody details:not([open]) button`의 존재·숨김 상태를 별도 단언, painted 버튼만 containment/overlap 검증, 4가지 geometry flag별 엄격 assertion과 raw CI attachment. 기존 #463의 table1 first identity width≥260px, table width≥1052px, focus/keyboard/scroll/modal/Gantt inert/read-only·5폭 검증 완화/skip 0. `src/components/identifier-details.tsx` 등 제품 React/CSS/API/DB/SVAR 원본은 변경하지 않는다.
- 인접 검증: #717 이름/원문/복사/동명, #550 Milestone 관리 visible-only geometry, Resource Plan #622와 Target/Resource #623, Target authoring, PR 6 Shard 전체. 테스트 코드 변경의 제품/CI gate 영향 없음. `docs/TEST_PLAN.md`, 본 Work Packet, `docs/exec-plans/active/PLAN.md`, 누적 실패 원장 동기화. 기존 `## DOCUMENTATION_SYNC`와 `## AC_TEST_COVERAGE` 각 항목 유지.
- Local 실제 Node/Chromium 실행은 **NOT TESTED** (프로젝트 checkout/node_modules/Playwright 구성 부재), 원본 Artifact/코드 기반 원인 후보·CI 레포트에서 실패 위치는 검증. 이 변경의 완결 PASS는 새 원격 exact-Head Full CI/실제 artifacts 확인 전 주장 불가.
- Release/승인: `0.116.1`, `HIGH/OWNER_MANAGED/qa_required=true`, `release_required=true/release_authorized=false`. 리뷰 스레드0·충돌0·main 정렬 및 새 Full PR CI 시작까지만 진행, CI 모니터링·Merge/Main CI/GHCR/tag/Issue Close 금지. CI 종료·QA Trusted·Owner ACCEPT는 미확인.

## Full PR CI #2942.1 실패 REWORK — 누적 F-005a/b (2026-10-18)

- [원본 #2942.1](https://github.com/planner77/masterGantt/actions/runs/39093363065): Head `6d23240008b0022f5376c5f8c4dcb0d1a3fadffd`, Base `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`, Quality/Docker SUCCESS, E2E/QA Final FAIL. Shard3 Job 41 PASS/1 FAIL/#621 assignment legacy code label, Shard2 최종 CANCELLED이지만 내부46 PASS/1 FAIL/1 SKIP/#461 Milestone hidden copy geometry. Shard1/4/5/6 취소 및 미실행은 PASS 아님.
- [Issue #717 누적 실패 원장 F-001~F-005](../../ISSUE_717_FAILURE_ANALYSIS.md)의 #2923 docs, #2926 metadata-only, #2927 docs-only SUCCESS, #2935 Target/Resource 2실패, #2940 Milestone #463 실패 및 현재 #2942 2실패 전부 대조·원인/교정 보존. F-004 #463는 #2942 Shard1 PASS, F-003a/b는 새 Head의 도달 실행 각각 PASS; 다른 미실행은 NOT TESTED.
- 코드 변화: #717 이름-first 라벨을 적용한 `task-assignment-editor.tsx`는 중복이 아니면 코드 괄호를 제공하지 않는다. #621 E2E의 리소스1/2%·시작/종료/Target B 체크 selector만 실제 접근성 이름으로 정렬한다. 개인/Task/Assignment ID·투입률100→80→70, 412/401 mutation·초안·미선택 동료 불변 검사는 강제 PASS/skip 없이 유지한다.
- `milestone-membership-panel.tsx`의 첫 TD 닫힌 `IdentifierDetails` 안 hidden copy buttons를 구 #461 전체 DOM geometry가 포함하여 `allControlsContainedInCells=false`를 만들 수 있다. 테스트에서 숨김 비표시를 별도 검증하고 **실제 표시 버튼만** cell containment/nonoverlap 계측. 최초 실패 너비는 원본 진단에 없으므로 특정 폭으로 단정하지 않고 5폭 각각 CI Artifact 첨부.
- 미실행 소비자 예방: #623 Resource Target tree도 ID disclosure와 전체 button DOM 검사를 결합하고 있어 rendered-only + hidden 음성을 추가. Matrix/list/scroll/keyboard/전문 ID 복사·원본/서버 계약은 보존한다.
- 문서 갱신: `docs/ISSUE_717_FAILURE_ANALYSIS.md`, `docs/TEST_PLAN.md`, 본 Work Packet, `docs/exec-plans/active/PLAN.md`. 기존 `DOCUMENTATION_SYNC`/AC1~8 heading 및 항목별 영향 기록 유지; 보안·API·DB·SVAR·Schema/Version 변경 없음.
- 실제 동일 앱 소스 로컬 Playwright/Node 전체 실행은 이 환경에서 `NOT TESTED`; 정적 source–log 계약 확인과 원격 새 Full CI는 별도. 원격 이후 Quality/E2E/Docker·Trusted QA/Owner ACCEPT는 완료 증거 전 `NOT TESTED`; 요청대로 CI 시작 확인 뒤 **모니터링 안 함**, Merge/Main/GHCR/Issue 종료 없음. App `0.116.1`, `HIGH/OWNER_MANAGED/qa_required=true`, `release_required=true/release_authorized=false` 불변.

## Full PR CI #2944.1 F-006a/b 누적 REWORK — #130 그룹과 #623 Target subset 이름-first E2E (2026-10-18)

- **원본:** [#2944.1](https://github.com/planner77/masterGantt/actions/runs/39095135631), Run/Attempt `39095135631.1` Head `bfd4173f0099d03f3357262cea01b567a51825cf`, Base `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`. Quality·Docker aggregate SUCCESS. Chromium E2E Shard1 57 PASS/1 FAIL/76 미실행, Shard3 CANCELLED 내부43 PASS/1 FAIL/56 미실행. Shard2/4/5/6 CANCELLED, 자동 QA는 required E2E 실패에서 파생 BLOCKED.
- **누적 원장 참조:** [docs/ISSUE_717_FAILURE_ANALYSIS.md F-001~F-006](../../ISSUE_717_FAILURE_ANALYSIS.md)은 #2923 docs/QA 실패, #2926 metadata-only FAIL, #2927 docs-only 성공, #2935 #717 Target 작성/#622 원문 ID, #2940 Milestone #463 geometry, #2942 #621 Allocation/#461 Milestone membership 및 이번 #2944 #130 Resource Group/#623 Target subset 원본을 각각 구분한다. 이전 테스트 PASS는 정확 Head/개별 도달 범위에서만 보존하고 미실행을 성공으로 승격하지 않는다.
- **F-006a 직접 보완:** `project-filter-toolbar-consistency.spec.ts`는 `개발팀 (G-01)`라는 오래된 접근성 이름을 기대하나 #717 `project-resource-dashboard.tsx`의 group button은 유일한 name `개발팀`, raw `G-01`은 접힌 identifier details. 실제 버튼 visible 및 닫힌 식별 정보의 원본 code field full value를 펼쳐 검증하고 닫는다. Mock resource fixture와 API filter/키보드/스크롤/5폭/assertion은 동일하게 유지.
- **F-006b 직접 보완:** `issue-623-resource-mvp.spec.ts`의 `Target B 선택 구성원` 짧은 고정 그룹은 실제 `Target B · 긴 물류 설비 통합 제어 대상 이름 선택 구성원`의 legend와 불일치. `f.targets[1].name`을 이용해 정확한 그룹을 찾으며 자식 ACS-B 체크, 저장된 Target B memberId, 기존 whole/subset 효과·revision·원본 6개 mutation·5폭/Matrix의 UI는 유지. CI와 Playwright timeout을 연장하지 않는다.
- **교차 영향:** 과거 실패 E2E7파일(#717 Target authoring, #622 Plan, #463 Milestone, #621 Resource, #461 Membership, 이번 #130 Toolbar, #623 Resource) + 직접/간접 #717 이름우선·HTTP 동명·원본·권한·Legacy·Role 소비자를 새 Full E2E6에서 모두 확인. 동일 소스의 로컬 Chrome/Node 실측은 현재 실행 환경에 없어 NOT TESTED. 숨겨진 원본을 기본 노출시키는 제품 변경, CI gate 완화/skip 없음.
- **문서/관리:** 이 Work Packet의 기존 `## DOCUMENTATION_SYNC`와 `## AC_TEST_COVERAGE`를 유지하고 `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`, 전용 누적 원장과 함께 반영한다. 앱 `0.116.1`, HIGH/OWNER_MANAGED/qa_required=true, release_required=true/release_authorized=false. PR #718 Draft/Issue OPEN 유지, 최신 main/리뷰0/충돌0 확인 후 1회 branch update로 새 Full PR CI 시작까지만 진행. QA 완료/Owner ACCEPT/병합/Main/GHCR/Issue 종료는 범위 밖.

## CI #2945.1 누적 F-007 및 최신 main #719 통합 (2026-10-18)

- Issue #717 한 개의 [누적 실패 원장](../../ISSUE_717_FAILURE_ANALYSIS.md) F-001~F-007은 #2923/#2926 docs·metadata, #2927 docs-only Full SUCCESS(E2E 미실행), #2935 Target/Resource ID, #2940 Milestone geometry, #2942 #621/#461, #2944 #130/#623, #2945 #76 Workspace/#288 Resource Grade의 전체 원본 Run·Attempt·Shard, 취소 Job 내 실제 실패와 당시 보완·미검증을 모두 보존한다. 실패 E2E 합집합9개+직접/간접 #719 도움말 소비자를 다음 Full에서 검증한다.
- 원본 [Full CI #2945.1](https://github.com/planner77/masterGantt/actions/runs/39097301048) (Head 62b17d91e120d8879bf688f910b3e5d3889bf05d, Base 3eaa6026923c38f200a463f6985c7cc8f88f9bf0)는 Quality/Docker PASS, Shard6 #76 버튼 개발팀(G-01) 구형 code-label 80PASS/1FAIL/32 미실행, Shard1 Job CANCELLED 안 #288 숨긴 readonly 코드 textarea fill 131PASS/1FAIL/2 미실행, E2E/QA 파생 FAIL이다. Shard2/3/4/5 취소·미실행은 PASS 아님.
- 보완: project-workspace-ux.spec.ts의 그룹 개발팀 및 개인 테스트 리소스 실제 이름-first button selector로 교정, KPI·탭 키보드·Gantt 동일 instance/scroll·조회 mutation0 보존. resource-developer-grade.spec.ts의 신규 생성은 active 리소스 추가 Dialog 안 editable textbox 이름/코드만 찾고 developer grade ADVANCED·POST·4폭 기존 assertion을 그대로 유지. 제품 raw 코드 디스클로저/기본 숨김·ID 읽기, API/DB/보안/JSX 원본 변경 없음.
- 최신 main 7393483c4a15007868fceeaee70fb9e13c8b119a (#719 도움말·문서·컴포넌트·회귀)를 구 Base 3eaa6026 이후 8커밋으로 확인. 18개 중첩 경로는 양쪽 기능을 보존하도록 3-way 정렬, 비중첩 main-only 175경로/PR-only 파일 및 doc 증거 보존, package version 0.116.1 일치. main/PR 두 부모 commit으로 최신 main ancestor를 만들고 PR의 review thread=0, conflict=0 재확인 후 새 Full PR CI를 시작한다.
- 기존 DOCUMENTATION_SYNC/AC_TEST_COVERAGE 각 heading·매핑은 유지; TEST_PLAN, 본 Work Packet, 활성 PLAN, 원장 동기화. 현재 API 환경의 실제 merged-source npm/Playwright/Chromium/Next build는 NOT TESTED. 원격 CI 결과 모니터링은 하지 않으며 HEAD exact Required3·Trusted/Owner/Release 승인, PR merge/Main/GHCR/Issue Close는 수행하지 않는다. HIGH/OWNER_MANAGED/qa_required=true/0.116.1/release_required=true/release_authorized=false 유지.

## Full PR CI #2952.1 실패 F-008 — Resource #526 Matrix hidden ID 소비자 교차 보완 (2026-10-18)

- [#2952.1](https://github.com/planner77/masterGantt/actions/runs/39103690860) `39103690860.1` / Head `e876c351280b34633f7edabb3428116d16392d6a` / Base `7393483c4a15007868fceeaee70fb9e13c8b119a`, Quality/Docker SUCCESS, E2E/QA Final FAIL. Shard6 #526 Resource Milestone matrix 97PASS/1FAIL/15미실행; Shard2 129PASS/1SKIP SUCCESS, Shard3 99PASS/1SKIP SUCCESS, Shard1/4/5 CANCELLED·미완료.
- 같은 Issue의 [단일 실패 원장 F-001~F-008](../../ISSUE_717_FAILURE_ANALYSIS.md)은 #2923/#2926 문서, #2927 docs-only PASS, #2935 Target·Resource 원문, #2940 #463 geometry, #2942 #621/#461, #2944 #130/#623, #2945 #76/#288, 이번 #2952 #526까지 전 Run/Attempt/Shard 및 cancelled 내부 실제 FAIL·이전 교정을 보존. 누적 직접 실패 E2E 합집합10파일·#719 contextual help 간접 소비자를 새 Full에서 검증한다.
- #526 원인: ResourceMilestoneMatrix table의 첫 `th`에 이름 우선 `IdentifierDetails` 기본 닫힘이 포함되어 `tbody button.first()`는 hidden ID copy button으로 선택될 수 있고 사용 가능한 계획 공수 `td button`과 다르다. 原본 Playwright artifact의 접근성 스냅샷에서 metric 버튼은 별도 노출됐지만 상세 제목 `.resource-dashboard-selected h3`가 나타나지 않았음. **TEST_CONTRACT**, Product 계산/공수 결함이라고 단정하지 않음.
- #526 E2E 보완: `tbody td button`만 metric 실행·건수≤350·#526 stale child409 이후 새 상세에 적용; `tbody th details:not([open]) button`의 DOM 존재+toBeHidden을 독립 음성 검증; 5폭 geometry의 contained는 painted checkVisibility/positive rect controls만 검사; raw geometry를 assertion 전 CI attach. 최초 상세 heading focus/Escape restore, 서버 상세 rows=50, Metric 원래 5폭/264px/144px/height<=104/scroll·Gantt scroll/selection·mutation0·오류 복구 테스트 유지.
- Code Source/API/DB/CI Gate/Retry/timeout/Build/Version 변경0. #719 contextual Help와 #717 ID disclosure 2기능/최신 main 동시 보존. TEST_PLAN, Work Packet, active PLAN, 원장 DOC_SYNC 반영; 기존 AC1~8 및 DOC_SYNC 전체 유지. 로컬 Node/Chromium 동일 source 실행 NOT TESTED, remote exact-head Required3·Trusted QA/Owner ACCEPT는 새 CI 시작시 NOT TESTED. PR Draft/Issue OPEN, HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false/0.116.1, merge/Main/GHCR/Finalizer·종료 제외.

## PR Full CI #2954.1 — F-009a #527 Plan selector / F-009b #526 Milestone Row Density 보완 (2026-10-18)

- Immutable [Full #2954.1](https://github.com/planner77/masterGantt/actions/runs/39105484225) Run ID `39105484225` Attempt 1, HEAD `d41b06d2fd24384a8a18b117432165663e8fcde0`, BASE `7393483c4a15007868fceeaee70fb9e13c8b119a`. Quality/Docker SUCCESS, E2E FAILURE, QA Final required E2E 파생 FAILURE. Shard5 #527 72PASS/1FAIL/9미실행; Shard6 Job CANCELLED이나 실제 #526 97PASS/1FAIL/15미실행; Shard1~4는 CANCELLED·미실행을 PASS로 인정하지 않는다.
- [Primary #717 전용 누적 실패 원장 F-001~F-009](../../ISSUE_717_FAILURE_ANALYSIS.md)에 #2923/2926/2927(docs), #2935 Target/Resource #622, #2940 Milestone #463, #2942 #621/#461, #2944 #130/#623, #2945 #76/#288, #2952 #526 숨긴 ID Button, 이번 #2954 #527 strict mode + #526 row-density 모두의 원본 Run/Attempt, 직접·취소 내부 실패·분류·수정·미검증을 추가하고 이전 기록을 보존했다.
- **F-009a:** `tests/e2e/resource-plan-dashboard.spec.ts` `tr[data-plan-row="group"] th button`이 expander + hidden Group ID copy + hidden Code copy 3개를 잡아 `aria-expanded` strict mode 위반. 직접 `th > button[aria-expanded]` + count1로 선택하며 기존 week/month×group/resource/5폭·sticky·기간·가로scroll/Gantt Core 검증은 그대로 둔다.
- **F-009b:** [Playwright report artifact 12128891318](https://github.com/planner77/masterGantt/actions/runs/39105484225/artifacts/12128891318) 390px Group Milestone matrix 1열264·다른144, maxRowHeight=201.5px >104px, usableRows=2 <3; 기존 구조는 2-line clipped 긴 이름과 full-name raw-ID disclosure summary를 첫 cell에 세로 누적. `src/features/resources/resource-milestone-views.tsx`가 이름(최대2행)/짧은 native 식별 정보 disclosure를 flex 한 줄에 배치하고 원본 이름 title·ID/코드 raw 전값·복사·keyboard·44px hit를 유지한다. `resource-dashboard.module.css`의 Milestone matrix 전용 selector로 compact하고 내부 scroll·전체 5폭 보존. 원래 `maxRowHeight<=104`, `usableRows>=3` 수치를 완화하지 않는다.
- **직접 회귀/음성:** `tests/e2e/resource-milestone-views.spec.ts`에서 기본 ID/코드 copy hidden, `식별 정보` summary Enter로 원문 확인 및 Enter 닫기, 390/768/1024/1440/1920px row height/visible rows/clip/header/body/metric buttons/Gantt exact 보존. `tests/e2e/resource-plan-dashboard.spec.ts` 20 cases/50 rows/실제 expander count1, sticky/scroll. 간접 `resource-plan-ui`·`resource-kpi-integration-ui`, #719 ContextHelp, 누적 E2E 직접 실패 11파일과 #717 이름/ID 원문/저장 포함한 Full six-Shard 유지.
- Product UI/CSS 레이아웃과 테스트·문서만 수정. API/DB/Domain·Milestone 원장/Resource Capacity 계산·Export/CI Required3/6-Shard/maxFailures/timeout/retries/skip 변경 없음. `docs/ISSUE_717_IDENTITY_INVENTORY.md`, `docs/TEST_PLAN.md`, `CHANGELOG.md`, `docs/exec-plans/active/PLAN.md`, 본 Work Packet 및 전용 원장을 동기화하며 기존 DOCUMENTATION_SYNC/AC_TEST_COVERAGE 구조·항목 유지.
- 같은 HEAD/Source의 로컬 Node/Chromium/Vitest/Production Build는 이 GitHub API 환경에서 수행할 수 없어 `NOT TESTED`; Original Run/Job/Artifact 및 source 정적 계약만 확인. 새 Full CI 시작 확인 뒤 모니터링하지 않으며 PR Draft, Issue OPEN, HIGH/OWNER_MANAGED/qa_required=true, app0.116.1, release_required=true/release_authorized=false, Trusted/Owner/merge/Main/GHCR/Finalizer/Issue Close 수행하지 않는다.

## PR CI #2956.1 F-010 — #527 동일 파일 미보완 선택자 정리 (2026-10-18)

- **직전 원본:** [Full Run #2956.1](https://github.com/planner77/masterGantt/actions/runs/39107357815), HEAD `4a41ae41456e048568a4d0443769ad53fb38d45c`, base main `7393483c4a15007868fceeaee70fb9e13c8b119a`. Quality/Docker PASS, Shard5 `resource-plan-dashboard.spec.ts:370`에서 74 PASS / 1 FAIL / 7 미실행, 다른5개 Shard CANCELLED, E2E/QA 파생 FAIL.
- **F-009a와 직접 비교:** 이전 #2954의 첫 #527 20geometry 테스트에서 direct expander selector `th > button[aria-expanded]`를 이미 수정했고 이번 Run에서는 해당 케이스가 PASS. 그러나 **같은 파일의 두 번째 "50visible hierarchy/view return" 케이스 line385에 `th button`가 남아**, expander+닫힌 그룹ID/코드 복사 버튼3개 strict failure를 발생시킴. 전체 과거 11개 E2E 실패 파일+동일 파일 서로 다른 시나리오를 전용 [F-001~F-010 누적 원장](../../ISSUE_717_FAILURE_ANALYSIS.md)에 보존.
- **보완:** `resource-plan-dashboard.spec.ts`의 그룹 expander는 직접자식 `th > button[aria-expanded]`, 유일성·클릭 후 expanded=true 명시. native 닫힌 ID/code copy 버튼 DOM 존재와 Hidden을 별도로 확인. 같은 페이지의 개인 expander도 동일한 direct-child 범위로 좁힘. 50/34 행 페이지, 24개 하위 Resource, focus/keyboard, daily detail50/366, Gantt instance, Capacity/Target/개인·주월/readonly·권한·revision 기존 검증은 생략/완화하지 않음.
- **실행/범위:** Source/Runner log 정적 원인 분석 완료. 이 도구 환경 동일 앱 checkout/Node/npm/Chromium 없어 frozen new source 실제 로컬 E2E·unit·build NOT TESTED. 제품 React·CSS/Domain/API/DB·원본 ID 접근 및 #719 ContextHelp는 변경0. 기존 6-Shard/fast/Full/Trusted CI·timeout/retry/skip 변경0. TEST_PLAN·active PLAN 및 기존 `DOCUMENTATION_SYNC`·AC1~8 보존.
- **Gate:** 현재 최신 main과 정렬(behind0), 리뷰 스레드0, 병합 충돌0을 게시 직전 재검증 후 Draft PR #718에서 단일 non-force branch ref 업데이트로 새 Full PR CI 시작까지만 실행. App0.116.1, HIGH/OWNER_MANAGED/qa_required=true, release_required=true/release_authorized=false. CI 모니터링, Owner 승인, Merge/Main/GHCR/Issue close 수행하지 않음.

## 최신 main Issue #724 내비게이션 정렬 / #717 신규 E2E 경로 이관 (2026-10-18)

- 기존 PR Head `4a41ae41456e048568a4d0443769ad53fb38d45c`, 직전 main `7393483c4a15007868fceeaee70fb9e13c8b119a`, 이후 최신 main `ea4194763568432ef98e823bb796b59a5beb317c` (#724 PR #738 7커밋). 변경 파일 #724 73개 vs PR #718 132개에서 25개 경로 중복, 충돌 dirty 상태를 확인하고 ref 갱신 전 양쪽 기능을 보존하는 two-parent Git merge를 준비한다.
- 제품 Workspace 상위 일정/대시보드/기준정보, 하위 Milestone/리소스/공정&WorkArea/설비/시스템과 공통 Editor 복귀 경로는 #724 계약으로 유지. #717 이름 우선·서버 canonical raw ID/코드 disclosure/동명 편집·권한·소속/Target/Resource 누적 변경과 #719 ContextHelp UI는 보존. #724 신규 helper·문서·타 이슈 회귀/E2E 및 기존 #717 자료를 모두 유지.
- #724가 수정하지 못하는 PR 전용 E2E `issue-717-name-first.spec.ts` 및 `issue-717-identity-persistence.spec.ts`의 이전 탭명에 의존한 locator를 `openWorkspaceView(page, "milestones"|"processes")`로 옮기고, touch 원문 시험은 실제 `대시보드` 상위와 `Milestone` 하위 탭 각각의 `.tap()`을 보존한다. 5폭/원문/동명/patch/delete/readonly HTTP·SQLite/clipboard·원본 revision assertion 불변.
- #2956 직접 실패 F-010 Resource Plan #527 50행 group-expander hidden copy ambiguity 수정도 새 merged tree에 포함한다. 11파일 과거 E2E 실패 집합과 새 #724 navigation, #719 Help, #717 두 direct scenario는 향후 동일 Head Full 6-Shard PR CI에서 확인한다. 로컬 Node/Chromium 실행 **NOT TESTED**. 최신 main ancestry·리뷰0/병합 가능성 확보 후 한 번 비강제 ref update. app0.116.1/HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false. CI 모니터링/병합/Main/GHCR/종료 없음.
