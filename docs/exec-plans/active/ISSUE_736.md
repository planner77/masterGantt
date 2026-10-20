# Issue #736 — 리소스 중심 대시보드와 기존 분석 보존

## Issue Work Packet

- Issue: [#736](https://github.com/planner77/masterGantt/issues/736), 상위 [#723](https://github.com/planner77/masterGantt/issues/723); 선행 #724/#727/#728/#729/#730, 기존 #522~#530/#619~#623 재사용.
- baseline_sha: `05f1e560eee456e6fba5535255c9ede30a357c16` (main); baseline_version: `0.125.0`.
- branch: `feat/issue-736-resource-dashboard`; 전용 worktree로 기존 작업/미추적 증거와 분리한다.
- candidate_version: `0.128.0` (MINOR, 새로운 리소스 조회 기능; 열린 #734/#735 후보와 구분). Dependency/lock 해석 변경 없음.
- lifecycle_phase: LOCAL_VALIDATION; risk_level: HIGH; qa_required: true; qa_method: OWNER_MANAGED.
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
