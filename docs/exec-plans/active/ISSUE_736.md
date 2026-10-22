> **2026-10-21 최신 상태:** Issue #736은 #765 복구 후 **Closed/RETIRED**이며 기존 `0.128.0` 발행 승인은 철회되었다. 이 파일의 아래 오래된 `release_authorized=true/false`, `0.128.0`, PR #760·#764 및 미검증 상태들은 해당 시점의 **역사적 원장**이다. PR #764의 미병합 교정 내용은 신규 [Issue #767](ISSUE_767.md)의 `v0.129.1` PATCH로 승계되어 별도 PR/CI/Owner 승인/정식 게시 경계를 적용한다. #736/#765 재개방·기존 `v0.129.0` 태그 변경 금지.

> 2026-10-21 재개: PR #760 최신 Head `3c335ba1cd4ac3f747f2f841fde16a81353aa490`, main `08a1d9ff25a97aba67f08d6b67029ac55d45121a`의 Full #3065.1 실패를 F736-001/002·초기 L/E/R와 함께 분석한다. frontend는 테스트 observer·정확 요청/즉시 body·직렬 조건/지연 음성을, infra는 원격 전체3Run·취소10Shard·source/merge 귀속을, qa_docs는 read-only 사전 검토를, Manager는 문서/통합·한 번 게시를 담당한다. 버전0.128.0/HIGH/OWNER_MANAGED/qa_required=true/release_authorized=false 유지. 새 CI 시작까지만 수행하며 이후 모니터링·병합·릴리스는 제외한다. 아래 과거 실행 결과는 해당 source의 역사적 증거다.

> 게시 정렬: main이 `5ffe02a334d2279fabb63943c90614a7acfaf6ad`(#732 PR #761)로 전진해 version/CHANGELOG3개 충돌을 해결했다. 아래의 시작 시점 main08a와 과거 실행은 역사적 증거다. 최신 main 통합 후 결과는 이 문서 마지막 F736-003 검증 절을 따른다.

# Issue #736 — 리소스 중심 대시보드와 기존 분석 보존

## Issue Work Packet

- Issue: [#736](https://github.com/planner77/masterGantt/issues/736), 상위 [#723](https://github.com/planner77/masterGantt/issues/723); 선행 #724/#727/#728/#729/#730, 기존 #522~#530/#619~#623 재사용.
- baseline_sha: `05f1e560eee456e6fba5535255c9ede30a357c16` (main); baseline_version: `0.125.0`.
- branch: `feat/issue-736-resource-dashboard`; 전용 worktree로 기존 작업/미추적 증거와 분리한다.
- candidate_version: `0.128.0` (MINOR, 새로운 리소스 조회 기능; 열린 #734/#735 후보와 구분). Dependency/lock 해석 변경 없음.
- lifecycle_phase: PR_CI; risk_level: HIGH; qa_required: true; qa_method: OWNER_MANAGED.
- risk_reason: 개인 Assignment 범위와 기존 Plan/과투입/견적/Excel의 서로 다른 조회 범위·snapshot·복귀를 보존해야 한다.
- independent_qa: N/A(Owner-managed, 독립 인간 검토 없음). 별도 qa_docs Agent는 읽기 전용 사전 검토이며 독립 인간 영수증이 아니다.
- manager_decision: NOT TESTED; MERGE_READY: BLOCKED. 새 Head의 Required3/Trusted QA 및 Owner 별도 위험 수용·병합 승인은 미완료다.
- release_required: true; release_authorized: false. 이번 사용자 요청은 PR Full CI 시작까지만이며 CI 모니터링·병합·main/GHCR·정식 Release·Issue 종료는 범위 밖이다.
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN,STATUS,EXCEPTION. Sub-Agent는 외부 댓글을 작성하지 않는다.

## 소유권과 비범위

- frontend: `src/features/resources/**`의 전용 consumer/호환 전환/상태 및 `src/features/projects/project-readonly-view.tsx` 통합, 관련 UI Unit/E2E.
- backend: 필요한 `src/server/**`/`src/contracts/**`와 관련 Unit/Integration. 기존 원장·계획 산식·Excel writer를 재사용한다.
- ui_ux: 읽기 전용 설계; qa_docs: 구현과 분리한 읽기 전용 사전 검토. Manager: 문서/버전/통합·최종 상태; infra: 원격 게시·PR/CI 시작.
- 공용 인터페이스는 backend/frontend 간 합의 후 단일 담당자가 수정한다. 다른 작업자의 변경을 되돌리지 않는다.
- 비범위: 새 Resource 공수 엔진·숨은 Target 생성·등록인원 기반 Capacity 변경·WBS writer·Gantt remount·marker ON·CI/보안/QA 정책 완화·릴리스 권한 변경.

## 보존 인벤토리

| 기존 기능 | 보존 경로와 범위 |
| --- | --- |
| 기본 Resource 현황, Group/Role/등급 필터·계층 | 기존 `ProjectResourceDashboard`를 사용하는 명시적 호환 분석 |
| Milestone 계층/비교, Target 계층/교차표 | 기존 서버 조회·고유 원시 합집합 및 full Gate를 재사용 |
| 주/월 Plan·일별 개인/Assignment 상세 | 기존 `ResourcePlanView`·일별 상세·정확 원본 편집 |
| 선택 수요와 같은 개인 Project 전체 참고 | 선택80%/Project140%를 별도 유지; Capacity R/Calendar를 등록인원으로 확대하지 않음 |
| 개인 Peak/과투입·선택 밖 원인 수정 | 기존 source scope와 Project 전체 cause 조회·출발 상태 복귀 |
| 개발자 등급·견적과 개인 Plan Excel | 기존 견적/Export 진입을 유지; 새 동적 형식 미지원이 기존 출력까지 막지 않음 |
| Target-only·direct 혼합 데이터 | #728/#729 통합 원장; 개인/Task/Assignment 원본 ID 교집합 |
| readonly·dirty·stale·권한 오류·Gantt 상태 | 기존 host/editor·snapshot guard·단일 Gantt 및 marker-OFF 유지 |

## AC_TEST_COVERAGE

- AC1: `tests/server/resources/issue-736-resource-adapter.test.ts`, `tests/features/resources/resource-wbs-dashboard-model.test.ts`, `tests/e2e/issue-736-resource-dashboard.spec.ts` — Target0의 Resource 단독·공정/WorkArea/설비·시스템 형제 및 Milestone/공정 계층, 등록-only/역할-only/비활성·미설정 구분 — 구현 후 실제 테스트 경로와 결과를 아래에 기록한다.
- AC2: `tests/e2e/issue-736-resource-dashboard.spec.ts`, `tests/e2e/resource-excel-export-ui.spec.ts`, 기존 #621/#622/#623 — 위 보존 인벤토리의 기존 분석/Plan/견적/Excel과 명시 전환 — 기존 회귀와 신규 consumer 테스트로 확인한다.
- AC3: `tests/server/resources/issue-736-resource-adapter.test.ts`, `tests/domain/wbs-task-ledger.test.ts`, `tests/domain/wbs-task-ledger-acceptance.test.ts`, `tests/domain/resource-target-plan.test.ts` — shared5M/D 중복0·공동담당7.5·선택80%/Project140%·Capacity R/Calendar/M/M null — 기존 원장 oracle과 정확 개인 범위 테스트를 사용한다.
- AC4: `tests/server/resources/issue-736-resource-adapter.test.ts`, `tests/server/projects/resource-excel-export.test.ts`, `tests/features/resources/resource-wbs-dashboard-model.test.ts` — 새 문맥/snapshot/selector의 API/UI/지원 Excel raw ID·총계·미산정, current/project 및 근거 반복 — writer 지원과 명시 제한을 구분한다.
- AC5: `tests/e2e/issue-736-resource-dashboard.spec.ts`, 기존 #730/#621/#622 편집/복귀 회귀 — 정확 원본 편집·선택 밖 원인·출발 상태 복귀·readonly/dirty/stale/401/412/역전·5폭 keyboard/focus/내부 overflow — 실제 실행 전 NOT TESTED다.

## DOCUMENTATION_SYNC

문서 작성자: Manager. 실제 구현 후 아래 영향 분석과 변경을 대조한다.

- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/EXCEL_EXPORT.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/ISSUE_736_FAILURE_ANALYSIS.md`: UPDATED
- `DESIGN.md`: N/A(Design Delta B. 기존 Resource root·이름 우선·compact/semantic token·내부 scroll/명시 범위 원칙을 적용하며 새 공통 시각 규범 없음)
- `docs/DB_SCHEMA.md`: N/A(schema/migration/저장 writer 변경 없음; 최종 diff 재확인)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Calendar/Plan/Capacity/진척 산식 재사용)
- `docs/SECURITY.md`: N/A(기존 public read/Origin/session/If-Match 경계 재사용)
- `docs/IMPORT_SCHEMA.md`: N/A(개인 조회 설정은 Import 원본이 아니며 기존 교환 입력 유지)
- `docs/IMPORT_EXPORT.md`: UPDATED
- `AGENTS.md`: N/A(기존 실행 지침 적용, 지침 자체 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 PR CI 시작까지의 중단 경계 적용)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 HIGH/OWNER_MANAGED·Agent 사전 검토와 Owner 결정 분리)
- `docs/CI_CD.md`: N/A(Required3/E2E6/main/GHCR/Release 계약 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(로컬/원격/환경별 gate와 CI 시작 후 모니터링 제외 유지)
- `docs/GITHUB_OPERATIONS.md`: N/A(canonical Refs/Issue와 branch/PR 게시 절차 재사용)

## #720 매뉴얼 인계

`dashboard.resources` → `docs/TARGET_RESOURCE_USER_GUIDE.md`의 리소스 중심 분석 절에 인계한다. 원본 등록·역할·배정과 계획공수, 동적 조회·호환 분석·Plan·Excel의 범위를 구별한다. `/manual` 제품 route 자체의 구현은 #720 범위다.

## 검증 상태와 인계

- Local Fast Feedback: 최종 제품 source의 지정12파일137개 Unit 중 최초136PASS/1FAIL은 신규 foreign-scope 오류 oracle400/412 불일치다. 제품 코드 변경 없이 exact412/JSON/error.code/파일 미생성을 교정한 동일9case 파일 재실행9PASS. 변경 없는 나머지11파일128PASS와 합쳐 고유137개 PASS이며 반복 검증을 중복 합산하지 않는다. 실행 당시 원본은 `/tmp/issue736-unit-final.json`, `/tmp/issue736-unit-fixed.json`이며 세션 환경 재시작으로 임시 파일은 소실되었다. 이 문서의 수치는 당시 도구 실행 결과이며 새 실행 증거로 재분류하지 않는다.
- 통합 명령: `npx vitest run --config tests/config/vitest.config.ts tests/server/resources/issue-736-resource-adapter.test.ts tests/server/resources/wbs-dashboard-views-http.test.ts tests/server/projects/resource-excel-export.test.ts tests/features/resources/resource-wbs-dashboard-model.test.ts tests/domain/wbs-task-ledger.test.ts tests/domain/wbs-task-ledger-acceptance.test.ts tests/domain/resource-target-plan.test.ts tests/features/resources/resource-drill-navigation-model.test.ts tests/features/resources/resource-drill-transport.test.ts tests/features/resources/resource-export-model.test.ts tests/features/resources/wbs-view-model.test.ts tests/features/resources/wbs-view-transport.test.ts`. 수정 테스트 재실행은 첫 파일만 동일 config로 실행했다.
- Node22.14.0/npm11.10.0의 전용 `npm ci --prefer-offline --no-audit` exit0, Next16.3.8/Playwright1.63.0 고정 의존성으로 실행했다. 처음 공용 symlink 설치는 실제 Next 버전이 달라 폐기하고 과거 실행 결과와 구별했다.
- `node scripts/verify-release-version.mjs`: PASS(v0.128.0), `node scripts/check-markdown-links.mjs`: PASS(279문서), `git diff --check`: PASS. 로컬 보호 validator의 `docs_gate`는 STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING/AC mapping PASS이며 실제 원격 Trusted QA PASS가 아니다.
- 별도 `/root/resource_review` Agent의 읽기 전용 사전 검토에서 알려진 source/docs 지적을 교정했다. UI 설계 `/root/resource_ux`의 M/M null 표시 오류도 보완했다. source 사전 검토는 Owner 승인·독립 인간 QA 영수증으로 사용하지 않는다.
- scoped ESLint19파일 PASS. 실제 Chromium 수정본4case와 typecheck는 반복 외부 SIGTERM143으로 종료되어 BLOCKED다. 재개 browser의 최초 결과1FAIL(라벨 locator)/1INTERRUPTED(펼침 이름 변경 locator)/2NOT TESTED를 보존하며 두 테스트 locator 오류를 교정했다. 수정본의 저장/412/5폭/Plan 원인·readonly/역전은 로컬 PASS로 주장하지 않는다. 공식 검증은 새 PR CI로 인계한다. 브라우저 로그: `/home/planner/Dev/masterGantt-736-evidence/browser/`; 최초 Trace는 분석했지만 재실행에서 삭제되어 보존 파일로 주장하지 않는다.
- GitHub quality/e2e/docker·Trusted QA: NOT TESTED (새 exact Head CI 시작까지만 수행).
- main/GHCR/digest/cleanup·정식 Release·운영 배포: NOT TESTED (이번 범위 밖).
- 실제 Windows Excel/VBA/DRM·수동 touch/스크린리더·운영 reverse proxy: NOT TESTED.
- GitHub CLI와 git push 인증은 만료되어 HTTP401/자격 오류다. 연결 GitHub 도구의 정상 조회와 Git Data 게시 경로를 사용하며 인증값을 출력·변경하지 않는다.
- 기존 #730/#733 누적 실패 원장과 shared Resource/Plan/Excel 소비자 영향을 확인한다. 최초 실패를 숨기지 않고 이 Work Packet과 전용 실패 원장에 남긴다. 과거 다른 Head PASS는 새 exact Head CI로 전용하지 않는다.

최초 환경/테스트 실패와 사전 검토 보완은 [누적 실패 원장](../../ISSUE_736_FAILURE_ANALYSIS.md)에 보존한다.

2026-10-20 재개: 사용자의 이전 요청 완료 지시에 따라 작업 tree와 main·기존PR을 다시 확인했다. main은 기준05f1e560과 같고 기존736PR은0건이다. 환경 재시작으로 과거 /tmp·프로세스는 소실되었으므로 브라우저 최종 검증은 저장소의 격리 fixture로 다시 실행한다. 구현/정책 범위나 정식 릴리스 권한은 확대하지 않는다.

최종 게시 정렬: 최신 main `08a1d9ff25a97aba67f08d6b67029ac55d45121a`의 #735 시스템 대시보드를 통합했다. 공통 metadata의 systemSelection과 Resource Excel 지원을 함께 보존했고 문서 양쪽 절·버전0.128.0을 유지했다. 이전137 Unit은 이 정렬 전 source의 증거이며 정렬 후 공식 전체 검증은 새 Head CI에 인계한다.

### PR CI #3059.1 재작업 — F736-001 (2026-10-21)

- 출처: [PR #760 Run 39439974649.1](https://github.com/planner77/masterGantt/actions/runs/39439974649), 기존 Head 94e602c3ee3c524dc41b348dd8ebe20330d59d1e; TypeScript job 118687236139의 Resource Excel src/server/exports/resource-excel-export-core.ts:60:22 TS18048. Vitest·Policy·Preflight SUCCESS, ESLint CANCELLED, Build/E2E6/Docker SKIPPED, Required3·QA Final FAILURE(파생). Timeout 아님.
- 기존 누적 L736/E736/R736 전체 이력과 AGENTS.md/PR_CI_FAILURE_TRIAGE.md를 검토하고 [단일 실패 원장](../../ISSUE_736_FAILURE_ANALYSIS.md)에 F736-001의 원본 Run/Attempt/Job/SHA·원인·비실행·조치를 추가했다.
- 수정: WBS Project canonical Assignment의 결손·Task/Resource 원본 불일치·중복 판정 뒤 명시적 return unsupported(...)으로 TypeScript non-null guard를 보장. 동일 예외·계산·원본 식별·Plan/Excel current/project/snapshot·권한 계약 보존. 샤드 재분배, CI timeout/retry/skip/Required3 변경 없음.
- 영향 범위: tests/server/projects/resource-excel-export.test.ts, tests/server/resources/issue-736-resource-adapter.test.ts, WBS ledger·기존 Resource Plan/Excel·E2E6. 별도 TypeScript 5.8.3 strict guard 최소 재현만 PASS; 새 Source의 실제 전체 typecheck/Unit/ESLint/Build/E2E/Docker는 NOT TESTED. GitHub CI에 인계한다.
- PR review thread 0, main base 08a1d9ff25a97aba67f08d6b67029ac55d45121a 대비 ahead1/behind0 및 mergeable=true 확인 후 수정. 새 Head/Run 별도 확인 예정. HIGH/OWNER_MANAGED, manager_decision=NOT TESTED, MERGE_READY=BLOCKED, release_authorized=false. 병합/Main/GHCR/Issue 종료 미수행.

### Full PR CI #3062.1 F736-002 E2E 단언 보완 (2026-10-21)

- 이전 Full PR CI [#3062.1](https://github.com/planner77/masterGantt/actions/runs/39485528120): Head f340a84526a3b38ed602ebcc8eaf5010807269c2, TypeScript/Lint/Vitest/Policy/Fast/Build/Docker 및 Required Quality/Docker SUCCESS; E2E shard5 failure, shard1/2/3/4/6 CANCELLED, Required E2E/QA Final FAILURE.
- 신규 원인: tests/e2e/issue-736-resource-dashboard.spec.ts:99에서 M/M option의 DOM `<option disabled value="mm">`가 관측되었음에도 Playwright toBeDisabled() matcher가 enabled 판정(5s 대기)하여 scenario 1FAIL, shard5의 앞선 10PASS/나머지83NOT RUN. Test 실제 본문36.1s, 180s timeout 아님. GitCommitInfo fetch timeout3s 경고는 이후 테스트 실행되므로 직접 원인 아님.
- 보완: response.mdPerMm null + MM option disabled attribute + JS property disabled true + select md fallback을 확인해 제품 계약을 원시 브라우저 속성과 선택 값으로 검증. 기존 80%/140%/수정40%/복귀 단언 모두 유지; source 제품/CI shard/timeout/retry/skip 변경 없음. 기존 [F736-001과 L/E/R 전체 이력](../../ISSUE_736_FAILURE_ANALYSIS.md)과 새 F736-002에 누적 기록.
- 관련 테스트: tests/e2e/issue-736-resource-dashboard.spec.ts 전체4 case, tests/features/resources/resource-wbs-dashboard-model.test.ts null fallback, 인접 #621/#622/#623 및 Resource Excel·drill 회귀. 새 Head 로컬 Playwright/Unit은 NOT TESTED; 원본 Head의 PASS는 역사적 증거. 새 exact Head GitHub Full Required3 검증 후 별도 판단.
- 조치 시작 시 PR #760 mergeable=true, main 대비 ahead2/behind0, 미해결 review thread 0. 새 Full PR CI 시작 후에도 HIGH/OWNER_MANAGED, manager_decision=NOT TESTED, MERGE_READY=BLOCKED, release_authorized=false. 사용자 요청대로 CI 완료 모니터링/병합/Main/GHCR/Issue 종료 제외.


## F736-003 실행 계획·문서 영향

- 누적 원장 F736-003과 정제 Run/provenance·query timeline을 갱신한다. TS guard·M/M matcher·초기 locator/환경/보호 검토 이력을 삭제하지 않는다.
- 테스트 observer만 변경하며 제품 API/DB/원장/산식/권한/화면 계약·의존성·version·workflow/Ruleset은 그대로다. 본 재개에서 `docs/ISSUE_736_FAILURE_ANALYSIS.md`, 본 Work Packet, `docs/TEST_PLAN.md`, PLAN/CHANGELOG와 정제 증거가 문서 변경 범위다. 기존 API/UX/Excel 문서는 새 계약 변경이 없으므로 추가 수정 N/A다.
- 직접+과거 실패: 새 #736 전체5 Chromium과 기존 Resource Excel/adapter/model Unit. 인접+음성: #622 실제 Plan/Excel1case, #730 지연 원본·리소스 원본2case, observer wrong filter/spec/scope 및 늦은 Excel download0.
- 공식 Required3/Trusted QA·Owner 승인=NOT TESTED이며 QA 사전 Agent 검토는 독립 인간 승인 영수증이 아니다. CI 모니터링·병합/main/GHCR·Release·Issue 종료는 범위 밖이다.


### F736-003 검증 결과·최신 main 정렬

- main `5ffe02a334d2279fabb63943c90614a7acfaf6ad`의 #732 Milestone 변경을 통합했다. 충돌3개(CHANGELOG/package/lock)는 #736 후보0.128.0과 양쪽 기록을 보존해 해결했다. 공용 host의 두 consumer/원본 편집/복귀와 main 파일 동일성을 frontend/qa_docs가 읽기 전용 검토했다.
- 최종 E2E source SHA256: `e42d86c206b9f5dce3a46552fa77acd63eb3cf83b1c457524d2d160d2455de86`. 정렬 전 #7365case+변경 없는 #6221/#7302case 고유8PASS. 정렬 후 #732 원본 저장/조건 밖 생성2case+#736 원격 실패 Plan1case가3PASS(1.3분)다. 중복 제외 고유 범위10case이며 정렬 전 결과를 통합 후 전체 PASS로 확대하지 않는다.
- 통합 후 PrePR fast의10개 단계는 모두PASS: typecheck, 전체 lint(0error/기존14warning), 전체 Vitest3,136PASS/기존3SKIPPED(255파일PASS/1SKIPPED), production build/runtime-tools 및 정책/문서/발견/의존성 검사. CLI 전체는 Next가 임시 타입 경로를 next-env/tsconfig에 생성해 sourceStable=false/BLOCKED다. 생성본 보존 후 실행 전 HEAD 설정을 복구했으며 전체 CLI PASS로 고쳐 쓰지 않는다.
- 최초 로컬7PASS/1FAIL의 stale ID oracle(L736-004), 첫 fast의 TS2345(L736-005), 과거 격리 Next 출력 lint(E736-004), 생성 설정 fingerprint(E736-005)를 [단일 누적 원장](../../ISSUE_736_FAILURE_ANALYSIS.md)에 남겼다. 동일 JSON 필드를 보존하는 spread 교정·현재 canonical Assignment ID 검증·외부 출력 보존으로 보완했다. 단언·CI/ignore/timeout/retry/skip 정책은 완화하지 않았다.
- 정확 명령/시간/단계/지문은 [정제 로컬 영수증](../../evidence/issue-736/f736-003-local-validation.json), 원격3Run/attempt·취소10Shard·test merge 부모는 [누적 원본 증거](../../evidence/issue-736/ci-through-3065-attempt-1.json), query별 HTTP/취소는 [실패 timeline](../../evidence/issue-736/ci-3065-resource-query-timeline.json)에 보존한다. 원시 ZIP/header/쿠키/DB는 Git 밖이다.
- DOCUMENTATION_SYNC: 본 Work Packet/실패 원장/TEST_PLAN/PLAN/CHANGELOG 및 증거 갱신. 본 수정은 observer 계약이며 API/DB/산식/권한/제품 UI/설계/CI/QA/Release 정책 추가 변경이 없어 관련 Source of Truth 추가 수정N/A다. main에서 가져온 #732 문서 변경은 그대로 보존했다.
- 새 exact Head/Run/Attempt는 Issue/PR STATUS 댓글로 인계한다. quality/e2e/docker/Trusted QA·Owner ACCEPT=NOT TESTED, MERGE_READY=BLOCKED다. 독립 Agent 소스 사전 검토PASS는 독립 인간 QA 영수증이 아니다. 새 Full PR CI 시작 후 모니터링·병합·main/GHCR·정식 Release·Issue 종료는 제외한다.

## M736-001 — #760 병합 Main CI #3071.1 E2E 교정 (2026-10-21)

- 기존 [#760](https://github.com/planner77/masterGantt/pull/760)은 병합 완료(`1c1938851aa8234febcba404f4007d6c94fb2233`, application0.128.0), [Main CI #3071.1](https://github.com/planner77/masterGantt/actions/runs/39499988360) Shard3/6 job118894849896의 기존 #621 정확 개인 편집 시 `toHaveValue("100")` element not found로 실패. Quality/Docker/Shards1·2·4·5·6 PASS, E2E aggregate FAIL 및 GHCR candidate SKIPPED. PR Full #3069.1/Trusted #711.1 과거 PASS 유지.
- 실제 Trace: canonical assigned-targets200/328ms, 불필요한 full assignment-targets200/4014ms, 실패 UI에 '할당 정보를 불러오는 중…'; 선택 인원의 데이터 소실 증거는 없음. 기존 F736-001~003과 #717 Label 실패를 비교하여 새로운 M736-001(INIT_TRANSPORT/TEST_OBSERVABILITY)로 [단일 실패 원장](../../ISSUE_736_FAILURE_ANALYSIS.md)에 누적함.
- 범위: `src/features/gantt/task-assignment-editor.tsx`의 *exact Assignment* 경로만 불필요한 candidates GET 생략(`editable && !initialAssignment`), assignedTargets의 catalogRevision·targets/allocations·ID 검증 유지. `tests/e2e/issue-621-resource-target.spec.ts`에서 후보 GET=0과 editor 저장 가능/원시 percent100→80→70, 공동담당 불변, 412/401 초안보존을 유지·강화. 인접 일반 Task Editor 후보 목록/Group/Role, #621/#622/#623/#736 Resource/Excel·Milestone/Task 회귀 선정.
- DOCUMENTATION_SYNC: 원장, 본 Work Packet, TEST_PLAN, PLAN, CHANGELOG를 M736-001 교정·검증 계약으로 UPDATED. DESIGN/API/DB_SCHEMA/IMPORT/SECURITY/SCHEDULING/UI_UX_GUIDELINES/MANUAL/CI_CD/AGENTS는 public API·스키마·레이아웃·권한·CI 정책 변경 없으므로 N/A. Existing docs historical language/source status 불변.
- Product Source/Trace GitHub GET 및 정적 차이 검토 PASS. 이 실행 환경에서 Node full dependency repository / Playwright browser/Unit/Build 미실행 NOT TESTED. 새 교정 PR Full CI/Trusted/Owner 승인/merge/Main/Release 성공은 시작 전 BLOCKED. HIGH/OWNER_MANAGED, 기존 version0.128.0와 Owner 승인 marker0.128.0 보존, 정식 GHCR/Issue 종료는 필수 검증/Finalizer 완료 뒤에만 가능. PR 시작 후 CI 완료 모니터링 없음.

## PR #764 Full CI #3076.1 REWORK — F736-004 (2026-10-21)

- Run [#3076.1](https://github.com/planner77/masterGantt/actions/runs/39510892786), exact head `30007409fa0730c7597140f37d769299337a6bb2` / original base `1c1938851aa8234febcba404f4007d6c94fb2233` / test merge `b761f2336e6469b460684e5966d2fbd9301a75f9`: Type/Lint/Vitest/Policy/Build/Docker and Quality/Docker aggregate SUCCESS; E2E Shard5 #530 M1→Resource→Schedule→M1 LIFO trigger focus lost (20.0s, 83PASS/1FAIL/11 NOT RUN), Shard2/3 SUCCESS, Shard1/4/6 CANCELLED; E2E/QA aggregates downstream FAIL. Trace #12307355571, no case/shard Timeout. Earlier #621 exact edit M736-001 reached PASS on Shard3.
- Open Codex P2 thread `PRRT_kwDOUUB7Bc6ujnCx`: exact editor skip of full candidates GET inadvertently also skipped active edit-session check. Public assigned-targets is not authorization. Corrective `GET /edit-sessions/current` validation in exact path and revoked-session E2E; general catalog remains for normal editing.
- Focus issue: Generic Milestone origin restoration used two rAF and captured node while dashboard data can be revalidated asynchronously. Preserve keyboard focus requirement; exact M1 bucket ID and Resource action attributes + visible/ready/nonstale MutationObserver lease restore, user input cancellation/modal gate/fallback. `resource-kpi-integration-ui.spec.ts` retains #530 numeric/source/return assertions; adds exact row ID/trigger contract.
- Original F736-001/002/003 and Main M736-001 immutable. Source and test/associated docs/TEST_PLAN/PLAN/CHANGELOG synchronized in [single issue failure ledger F736-004](../../ISSUE_736_FAILURE_ANALYSIS.md). No API/schema/CI/Timeout/Retry/Skip/Shard rule change. Latest main #732 PR #763 `62e715adbc3f497e319918306bf26cbdd73353b7` advances4 commits: keep its 135-file assignment plan, updated #621 test ready30s and TEST_PLAN changes without reverting.
- New exact Head has no local Node/Chromium execution in connector environment (NOT TESTED). Required3+6Shard and default-main Trusted QA must re-run. Review thread resolved only after documented code correction; Owner final HIGH acceptance separate. Prior 0.128.0 release marker retained, Main/GHCR/Finalizer/Issue close BLOCKED until proven. Do not monitor new CI after start.
