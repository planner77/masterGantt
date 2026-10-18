# Issue #725 / PR #741 — 누적 PR CI 실패 분석

Primary Issue: [#725](https://github.com/planner77/masterGantt/issues/725) · 관련 PR: [#741](https://github.com/planner77/masterGantt/pull/741) · 최초 작성 2026-10-18 (KST)  
**Source of truth:** [PR CI 실패 누적 분석 지침](PR_CI_FAILURE_TRIAGE.md), [AGENTS.md §Issue #704](../AGENTS.md), [Work Packet](exec-plans/active/ISSUE_725.md).

이것이 **#725 전용 단일 canonical 실패 원장**이다. #724/#624의 실패 원장은 원본 그대로 남겨 상호 참조하되 이슈 간 실패를 합산하지 않는다. 새로운 PR/Run/Attempt는 이 파일 맨 아래에 추가하고 이전 원본 결과를 덮어쓰지 않는다.

## 1. 모든 접근 가능한 Full PR CI 이력 및 상태

PR #741, `feat/issue-725-process-workareas`, `main` 대상; GitHub Actions Workflow `.github/workflows/ci.yml`의 `event=pull_request`. 2026-10-18 조회 시 해당 branch의 Full 실행은 **2건**이다. 동일 run rerun attempt는 관측되지 않았다. Runner에서 원격 test-merge source artifact를 직접 해제·인증하지 않았으므로 해당 개별 immutable test-merge SHA는 **UNKNOWN**으로 남긴다. 원본 artifact ID는 아래에 보존한다. 실행 후 변경된 PR API의 base 값으로 과거 test merge를 역추정하지 않는다.

| 실패 | 원본 Run/Attempt · 일시(UTC) | 원본 HEAD/당시 기준 base | Required aggregate | Chromium 6 shards | 원본 artifact |
| --- | --- | --- | --- | --- | --- |
| F-725-001 | [#2961.1 / Run 39111408691](https://github.com/planner77/masterGantt/actions/runs/39111408691) · attempt1 · 08:25–08:47 | Head `6bdae8ff10b475e4ba91dcf8815ee0f45e0407cf`, initial PR base `ea4194763568432ef98e823bb796b59a5beb317c` (당시 Work Packet 기준) | Quality SUCCESS, E2E FAILURE, Docker SUCCESS | 1 CANCELLED / 2 CANCELLED / **3 FAIL** / 4 CANCELLED / 5 SUCCESS / 6 SUCCESS | [Shard3 report 12131286264](https://github.com/planner77/masterGantt/actions/runs/39111408691/artifacts/12131286264), [source 12129999702](https://github.com/planner77/masterGantt/actions/runs/39111408691/artifacts/12129999702) |
| F-725-002 | [#2965.1 / Run 39117714154](https://github.com/planner77/masterGantt/actions/runs/39117714154) · attempt1 · 10:02–10:16 | Head `c7a94025238dbd461cc2cc50a981968968c52dff`, base `c2395b17d864692c2e5e5aa36f55ea36e7197541` | Quality SUCCESS, E2E FAILURE, Docker SUCCESS | 1 CANCELLED / 2 CANCELLED / **3 FAIL** / 4 CANCELLED / 5 CANCELLED / 6 SUCCESS | [Shard3 report 12133183173](https://github.com/planner77/masterGantt/actions/runs/39117714154/artifacts/12133183173), [source 12133165949](https://github.com/planner77/masterGantt/actions/runs/39117714154/artifacts/12133165949) |

두 Run 모두 QA Preflight, policy, ESLint, TypeScript, Vitest, Next.js build, Docker build/smoke와 Required Quality/Docker가 성공했다. **QA Final — Automated FAILURE는 E2E 실패 및 Owner/필수 gate 미충족에서 비롯된 후단 판정**이며 새 제품 실패가 아니다. Main commit image/정식 GHCR/Release/Finalizer는 실행되지 않았다. `release_required=true` / `release_authorized=false` / `HIGH` / `OWNER_MANAGED`.

## 2. 원본 실패 및 취소/미실행의 독립 기록

### F-725-001 · #2961.1 / Shard 3

- 원본 [Job 117628563940](https://github.com/planner77/masterGantt/actions/runs/39111408691/job/117628563940), `E2E shard 실행`, `tests/e2e/task-editor-form-density.spec.ts:152`의 **#456 비기본 WBS fullscreen** 사례, 실제 오류 `helpers/gantt-readiness.ts:74` / spec line193. 5초 내 `operation=scroll,targetLeft=120`의 readiness 미충족: `TARGET_CORE_CAPACITY_INSUFFICIENT`, `TARGET_NATIVE_CAPACITY_INSUFFICIENT`. **89 passed, 1 failed, 3 did not run**. 취소된 shard1/2/4의 로그에는 별도 테스트 FAIL이 관측되지 않았으나 완주하지 못했으므로 UNKNOWN/CANCELLED로 보존. shard5/6만 SUCCESS.
- **분류:** `TEST_CONTRACT + FIXTURE_OBSERVABILITY`의 스크롤 가능 범위 입증 부족. 동일 #456 소비자의 [#724 Main M01](ISSUE_724_FAILURE_ANALYSIS.md), [#624 과거 보정](ISSUE_624_CI_FAILURE_ANALYSIS.md)과 **증상 유사**, Run과 이슈 귀속은 별개. 제품 Gantt 결함은 이 로그만으로 증명되지 않음.
- **이미 반영된 선행 교정:** #724 Main 보완 최신 commit `c2395b17d864692c2e5e5aa36f55ea36e7197541`에 선택적 실제 범위 witness Task(`EDITOR-76`, 2027-04-05)를 삽입하여 Core/native 실제 admission을 엄격 판정하는 fixture/spec를 포함. 해당 main 변경을 #725 branch의 2-parent merge `c7a940...`로 포함하고 TEST_PLAN/PLAN의 독립 변경을 보존. 코드의 `targetLeft=120`, `scrollTop=38`, Gantt/Editor 단언과 timeout/skip/retry는 그대로.
- **검증:** 원본 #724 후보의 별도 로컬 103 Chromium 케이스 PASS 이력은 다른 source의 증거. #2965.1 Shard3는 신규 #725 테스트에서 조기 중단하여 **#456 재실행되지 않음**. 정확한 현 후보에 대한 원격 #456 PASS는 아직 **NOT TESTED**이다.
- 하위 [Required E2E 117632253859](https://github.com/planner77/masterGantt/actions/runs/39111408691/job/117632253859) FAILURE 및 [QA Final 117632269928](https://github.com/planner77/masterGantt/actions/runs/39111408691/job/117632269928) FAILURE는 파생 판정. 취소된 Shard가 과거 성공한 테스트라는 추론 금지.

### F-725-002 · #2965.1 / Shard 3

- 원본 [Job 117647195417](https://github.com/planner77/masterGantt/actions/runs/39117714154/job/117647195417), `tests/e2e/issue-725-process-workareas.spec.ts:330`의 신규 **비활성 default + 중복 occurrence mapping / 단일 WorkArea owner** 사례, line338 최초 FAIL.
- **정확한 원본 차이:** `expect(areaResponse.status()).toBe(200)`에서 **Expected: 200 / Received: 201**. 요청은 `POST /api/process-catalog/admin/work-areas`, 정상 응답으로 WorkArea 신규 등록은 HTTP 201. Source [`handleMutateProcessCatalog`](../src/server/process-catalog/process-catalog-handlers-core.ts) 반환 계약은 `action === "create" ? 201 : 200`. 이는 `POST` vs `PATCH`의 예상 코드 차이이며 **201은 생성 성공**. 프론트·SQLite·HTTP 비즈니스 기능 FAIL로 해석하지 않는다.
- **분류:** `TEST_CONTRACT` — #725 새 E2E oracle가 기존 API 계약과 불일치. 첫 상태 코드 단언 뒤의 카탈로그 데이터/프로세스 두 owner/비활성 구역/checkbox 대체/실제 저장/canonical 및 quantity10 검증은 **미실행**. 해당 동작을 PASS로 주장하지 않는다.
- Shard3 **46 passed, 1 failed, 48 did not run**; PR `--max-failures=1` / matrix fail-fast. 다른 Shard1/2/4/5는 `The operation was canceled` 기록이며 추가 직접 테스트 failure 없음. Shard6 SUCCESS. `Next.js production build`/unit/lint/typecheck/Quality/Docker는 SUCCESS. [E2E aggregate 117649415651](https://github.com/planner77/masterGantt/actions/runs/39117714154/job/117649415651)와 [QA Final 117649428869](https://github.com/planner77/masterGantt/actions/runs/39117714154/job/117649428869) FAILURE는 파생.
- **안전한 보완:** 제품/API/SQL/DTO 불변. 이 신규 case의 **POST 상태 기대만 `201`로 수정**. 기존 PATCH `expect(disabledResponse.status()).toBe(200)`, 실제 생성 `updatedCatalog`, 동일 WorkArea 한 owner/원본 설비1·quantity10, 음성/권한/에러 단언을 그대로 보존. 성공 범위를 `response.ok()`/arbitrary 2xx로 약화하지 않는다.
- #724 F06 PR metadata parser 오류는 **다른 Issue에 귀속된 정책 서식 원인**이고 이 Run은 QA Preflight SUCCESS. Node20 deprecation warning 및 Playwright GitCommitInfo shallow fetch 3초 timeout 메시지도 관측됐으나 Shard3 첫 assert FAIL과 인과적으로 연결되지 않았으며 원인으로 추정하지 않는다.

## 3. 과거 #725 로컬/사전검토 실패와 결함 연결

과거 로컬 수정 전 원본은 [Work Packet](exec-plans/active/ISSUE_725.md)의 개별 실행과 `docs/evidence/issue-725/local-validation.json`에 보존. 시도 순서를 최신 PR CI PASS로 승격시키지 않는다.

| 과거 관측 (PR CI 아님) | 당시 원인·보완 | 이번 원인과의 관계 |
| --- | --- | --- |
| 초기 migration ledger 27→28 및 backend fixture 3 FAIL | 신규 migration 0028 반영, 구 DB fixture를 실제 historical schema 준비 후 업데이트; SQL/HTTP 단위 회귀 | F002는 migration/SQLite 실패가 아님. 두 Full Run Vitest SUCCESS. |
| 실제 Chromium `관리 범주` label locator timeout | select의 option 중첩 접근 이름 문제; 실제 role=combobox로 테스트 locator 수정. HMR/cold startup 단정 기각 | 새 F002도 locator가 아닌 strict HTTP status oracle 불일치 |
| 매핑 저장 후 focus 및 프로젝트 revision mismatch | 성공 response/revision/context 채택을 동일 batch로 처리 | 이번 두 remote Run에서 #725 기존 통합 case PASS (F002 직전 shard3 #46). |
| 390px 문서 가로 overflow | scroll owner의 absolute `.srOnly` containing block을 올바르게 지정; 임시 info-panel 근인 가설 기각 | 기존 #725 통합 case #46 PASS, 새 owner case 후반은 미실행. |
| native 설비 code autofocus / confirm modal 누락 / dialog intrinsic clipping | native autofocus, 기존 영향 확인 단계를 테스트에서 수행, 5폭 내부 overflow 교정 후 재검증 | 기존 통합 case PASS; 새 F002에서는 수정된 체크박스 단계에 도달하지 못함. |
| PR #741 초기 자동 리뷰 P2 두 건 | inactive compatibility/default WA로 형제 비활성 전파 방지; duplicate WA owner 선택 대체. 이전 Head `c7a940...`에서 code/test 추가, 리뷰 thread 2개 resolved | **해당 신규 테스트 첫 HTTP status에서 FAIL**; fix 자체의 종단 실행 증거 없음. 새 후보 remote E2E 필요. |

## 4. Cross-run 실패 매트릭스·누적 집합

| 실패 ID | 실패 파일·oracle | 교정 출처 | 현재 동결 후보의 검사/남은 위험 |
| --- | --- | --- | --- |
| F-725-001 #2961.1 | `tests/e2e/task-editor-form-density.spec.ts` #456 실제 Core/native horizontal capacity | #724 main `c2395b17...` scoped date witness의 import + 기존 strict 120px admission | **NOT TESTED** (F002에서 Shard3 조기중단; 새 Full 재검증) |
| F-725-002 #2965.1 | `tests/e2e/issue-725-process-workareas.spec.ts` 신규 case의 생성 POST 200≠201 | handler의 기존 `create=201`, E2E 단일 기대 수정 | 최종 변경 Source local Chromium **NOT TESTED**. 새 Full에서 나머지 case 실행 필수. |
| 과거 #725 local Chromium/SQLite | migration, locator, focus, CSS, confirming owner writes, inactive/duplicate catalog | 원래 #725 구현 Work Packet 및 P2 리뷰 수정 | 이전 Head의 제한적 로컬 PASS 기록만 존재. 새 Full에서 교차·음성 소비자 확인. |

**실제 원격 실패 파일 합집합:** `tests/e2e/task-editor-form-density.spec.ts` (#456), `tests/e2e/issue-725-process-workareas.spec.ts` (신규 F002). 동일 #725의 기능 직접/간접·음성 소비자는 `tests/server/process-catalog/process-catalog-service.test.ts`(default inactive/sibling active/ancestor inactive), `tests/server/process-catalog/process-context-service.test.ts`, `tests/server/templates/logistics-template-graph.test.ts`, `tests/server/db/database.test.ts`, `tests/e2e/project-logistics-management.spec.ts`, `tests/e2e/issue-624-logistics-unified.spec.ts`, `tests/e2e/project-workspace-ux.spec.ts`, 인접 #624/#667 Gantt readiness 소비자이다. 나머지 E2E6/Docker·Quality는 기존 Required 검사 범위 그대로. **로컬 no-fail-fast 교차 실행은 checkout/Playwright/원격 DNS 부재로 NOT TESTED**이며 원격 전체 PASS를 대체할 수 없다.

## 5. 회귀·구현 결정과 승인 경계

- 직접 원인은 새 테스트 oracle의 잘못된 **HTTP status = 200** 선택이다. 서버의 기존 201 생성 계약에 부합하도록 **단 한 곳만** `toBe(201)`로 수정한다. 기본/형제 WorkArea와 동일 physical area owner의 제품 보호 계약은 바꾸지 않는다.
- `docs/TEST_PLAN.md`, [Work Packet](exec-plans/active/ISSUE_725.md), 이 원장을 새 candidate에 일괄 기록한다. API/DB/DESIGN/AGENTS/CI workflow는 계약 변화가 없으므로 수정 N/A. 근거 없는 skip/retry/timeout/assertion 범위 축소·main 보호 gate 우회 금지.
- 리뷰 thread 2건은 앞서 수정 후 resolved (현재 미해결0 확인). 최신 main은 `c2395b17d864692c2e5e5aa36f55ea36e7197541`, PR Head는 `c7a94025238dbd461cc2cc50a981968968c52dff`. 새 commit 작성 직전에 HEAD/main/stale/review/충돌을 다시 확인하고 branch ref non-force 예상 SHA로 업데이트한다.
- **검증 상태:** 이번 세션에서는 GitHub Run/Job/handler/spec 정적 대조 완료. 로컬 checkout 없이 실제 Chromium/Vitest/Typecheck/ESLint/Docker 재실행 **NOT TESTED**. 이전 Head들의 PASS·PR #724 local PASS와 합산하지 않는다. 신규 Head의 Full PR Required Quality/E2E6/Docker, Trusted QA, Owner HIGH risk ACCEPT는 **NOT TESTED**. 사용자 요청은 **새 PR CI 시작 확인까지**, 모니터링/병합/Main/GHCR/정식 릴리스/Issue 종료는 범위 밖이다.

## 6. 다음 실패 시 필수 조치 (누적 append-only)

1. 먼저 [#2961.1](https://github.com/planner77/masterGantt/actions/runs/39111408691)·[#2965.1](https://github.com/planner77/masterGantt/actions/runs/39117714154)와 **이번 이후의 모든 #725 PR/Run/Attempt**를 GitHub로 재수집한다. `F-725-003` 이상의 절을 이 문서에만 추가한다.
2. F001/F002 및 과거 local 실패의 합집합과 반례를 다시 검토하고 누락된 shard cancellation·NOT RUN·test-merge source를 추측 없이 정정 섹션으로 남긴다.
3. 새 로그의 **최초 실제 FAIL**을 종속 aggregate/QA FAIL과 분리한다. 단발 assertion 수정을 연속 반복하는 대신 미실행된 F002 후단·#456 Gantt·직접/간접 소비자를 진단 범위로 잡는다.
4. 최신 동일 freeze source 교차 검사, 실패 원장·문서 동기화, 미해결 review=0/merge conflict=0 확인, **새 exact-Head Full PR CI 시작** 순서. Owner/Trusted/Release 권한은 별개다.
