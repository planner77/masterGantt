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
