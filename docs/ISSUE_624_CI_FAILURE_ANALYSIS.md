# Issue #624 — PR CI 누적 실패 원장 (PR #702)

> **유지 규칙:** 이 문서는 CI 실패 때마다 새 Run/Attempt/HEAD/Base/Test-Merge 증거를 독립 행으로 **추가**한다. 새 실패만 고치고 과거 원인을 지우지 않으며, 취소/Skip/미실행 Job을 제품 PASS로 승격하지 않는다. 원인 정리·대응은 `AGENTS.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/QA_REVIEW_POLICY.md`, `docs/REMOTE_VALIDATION.md`, [전체 이력 기반 REWORK](PR_CI_FAILURE_TRIAGE.md) 및 [Work Packet](exec-plans/active/ISSUE_624.md)의 원본 계약을 따른다.

## 1. 고정 기준선과 원본 증거

| 구분 | 값 |
| --- | --- |
| Primary Issue | [#624](https://github.com/planner77/masterGantt/issues/624) — 공정·WorkArea·설비·시스템 통합 조회 및 Milestone 교차 |
| PR | [#702](https://github.com/planner77/masterGantt/pull/702), `feat/issue-624-logistics-unified-views` → `main` |
| 첫 실패 Run/Attempt | [#2875.1, Run ID 39007521324](https://github.com/planner77/masterGantt/actions/runs/39007521324), `pull_request` / opened |
| 이벤트 발생 | 2026-10-17 05:47 UTC (14:47 KST), 완료 conclusion=`failure` |
| 실패 HEAD | `5b57374e24d9842db47a83a5f8ede99cb0dd2bbc` |
| 실패 Base | `de863713142a92f1cac56dbae044923822bca932` |
| PR 검증 Test-Merge | `9f7cd652eb83da1e35753ba139a280050f65fde5` (CI checkout 로그로 관측) |
| Repo policy | 기본 브랜치 `scripts/qa_preflight.py` → `qa_final_automated.docs_gate`, `.github/workflows/ci.yml` |
| PR 버전 | app `0.115.0`; `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=false` |
| 검증 경계 | QA Preflight 1확정 FAIL/5 DEFERRED. TypeScript/Unit/E2E/Docker/Next build 제품 검증은 **SKIPPED**, 실제 제품 실패 아직 미확인 |

## 2. 누적 실패 원장

| 사건 / 단계 | Job ID | 실제 상태 | 결함/전파 유형 | 1차 원인 및 근거 | 조치·재검증 상태 |
| --- | ---: | --- | --- | --- | --- |
| F-624-001 / QA Preflight | [117322955991](https://github.com/planner77/masterGantt/actions/runs/39007521324/job/117322955991) | FAILURE | **문서/정책 ROOT** | `DOCUMENTATION_SYNC`: `docs/exec-plans/active/ISSUE_624.md`에 `docs/GITHUB_OPERATIONS.md` 영향 기록 없음. PRIMARY_ISSUE/RISK/QA/RELEASE/PATH_POLICY/ISSUE_AC는 PASS | Work Packet의 정확한 파일명에 `N/A(reason)` 추가. 차기 exact-HEAD CI 결과 **NOT TESTED** |
| F-624-002 / PR Fast Gate | [117322990328](https://github.com/planner77/masterGantt/actions/runs/39007521324/job/117322990328) | FAILURE | **다운스트림 파생** | Preflight=`failure`를 fail-closed로 전달 | 원본 수정 후 자동 재검증 |
| F-624-003 / 품질 집계 | [117323023452](https://github.com/planner77/masterGantt/actions/runs/39007521324/job/117323023452) | FAILURE | **다운스트림 파생** | QA Preflight 미성공. 개별 Typecheck/ESLint/Vitest/Build는 SKIPPED | CI 재실행 필요, 개별 테스트 PASS 아님 |
| F-624-004 / Chromium 집계 | [117323023407](https://github.com/planner77/masterGantt/actions/runs/39007521324/job/117323023407) | FAILURE | **다운스트림 파생** | PR Fast Gate/Preflight가 실패하여 Chromium PR 6-shard가 모두 SKIPPED | CI 재실행 필요; 제품 E2E 실패 **0건 관측**(실행 자체 없음) |
| F-624-005 / Docker 집계 | [117323023396](https://github.com/planner77/masterGantt/actions/runs/39007521324/job/117323023396) | FAILURE | **다운스트림 파생** | Docker smoke 구현 SKIPPED. 필수 집계는 fail-closed FAILURE | CI 재실행 필요, Docker PASS 아님 |
| F-624-006 / QA Final Automated | [117323038782](https://github.com/planner77/masterGantt/actions/runs/39007521324/job/117323038782) | FAILURE | **다운스트림 파생** | 로그 `자동 QA: FAIL / 사유: required quality 미성공` | 원본 CI 재검증 후 trusted/Owner 단계 별도 |
| O-624-001 / Codex Review | [PR #702 댓글](https://github.com/planner77/masterGantt/pull/702) | Usage limit / Review Failed | **별도 리뷰 가용성 이슈** | Codex reviewer 사용량 초과 안내, 실제 inline 미해결 thread **0**. QA Preflight 직접 원인 아님 | 자동 리뷰 미수행을 코드 리뷰 PASS/승인으로 표시 금지; 정책의 OWNER_MANAGED/Trusted/Owner 승인 유지 |

**진단 종합:** Run #2875.1의 확정 원인은 **문서 영향 누락 하나**다. 세 Required aggregate의 FAILURE는 독립 결함 3개가 아니며, 대부분의 개별 테스트는 미실행이다. TypeScript/E2E/제품/API·시간·환경 결함은 발생하지 않았다고 *증명된 것이 아니라 아직 검증할 기회가 없었던 것*. 취소한 Job의 실제 테스트 실패 보고는 이번 원장에 확인되지 않았으며, 이후 발생 시 별도 원인으로 보존한다.

## 2.1. PR CI #2876.1 — AC_TEST_COVERAGE 문서 표기 오류 (2026-10-17)

| 항목 | 원본 증거 |
| --- | --- |
| Run / Attempt | [Run 39008123509.1](https://github.com/planner77/masterGantt/actions/runs/39008123509), PR synchronize, conclusion=`failure` |
| Head / Base | `cc7604331780bda8dfdb12d2327c290409eb8596` / `de863713142a92f1cac56dbae044923822bca932` |
| test-merge | `7f45152608a5489a29da2dcd0725ef98c1425109` (CI checkout 원본 로그) |
| 직접 원인 | `qa_final_automated.docs_gate`가 `- **AC1**:`…`- **AC7**:`를 인식하지 못해 `Issue AC / test evidence mapping 부족: AC1,AC2,AC3,AC4,AC5,AC6,AC7` |
| 첫 실패와 관계 | #2875.1의 `docs/GITHUB_OPERATIONS.md` 누락은 이번 Run에서 해소됐고, AC markdown 문법은 별도의 신규 Root |

| 사건·Job | 실제 상태 | 결함 유형 | 원인·조치 |
| --- | --- | --- | --- |
| F-624-007 / [QA Preflight 117324706081](https://github.com/planner77/masterGantt/actions/runs/39008123509/job/117324706081) | FAIL | **신규 Root: 문서 계약** | `Issue AC / test evidence mapping 부족: AC1,AC2,AC3,AC4,AC5,AC6,AC7`. 모든 실제 AC 근거는 유지하고 `- **AC#**:` 7개를 plain `- AC#:`로 정규화 |
| F-624-008 / [PR Fast Gate 117324742958](https://github.com/planner77/masterGantt/actions/runs/39008123509/job/117324742958) | FAIL | 파생 | Preflight failure가 fast gate를 차단 |
| F-624-009 / [Quality 117324769744](https://github.com/planner77/masterGantt/actions/runs/39008123509/job/117324769744) | FAIL | 파생 | TypeScript, ESLint, Vitest, Next.js build 모두 **SKIPPED** — 제품 실패 아님 |
| F-624-010 / [Chromium 117324769815](https://github.com/planner77/masterGantt/actions/runs/39008123509/job/117324769815) | FAIL | 파생 | 실제 PR E2E shard 6개 모두 미실행, 테스트 실패 유무 미확정 |
| F-624-011 / [Docker 117324769701](https://github.com/planner77/masterGantt/actions/runs/39008123509/job/117324769701) | FAIL | 파생 | Docker smoke 구현 SKIPPED, 제품 Docker 테스트 미검증 |
| F-624-012 / [Automated QA 117324789022](https://github.com/planner77/masterGantt/actions/runs/39008123509/job/117324789022) | FAIL | 파생 | `자동 QA: FAIL / 사유: required quality 미성공`, 독립 원인 아님 |

정정된 Work Packet은 AC1~AC7을 `- AC1:...` 형태로 두고, `DOCUMENTATION_SYNC`의 `UPDATED(설명)`도 정책 parser가 인식하는 `UPDATED`로 정규화한다. 기존 설명과 테스트 근거는 삭제하지 않는다. 당시 TypeScript/Unit/Chromium6/Docker/Next build는 **미실행**, 세 Required aggregate/QA Final의 실패는 Preflight 원인의 전파다.

## 2.2. PR CI #2877.1 — React Hook ESLint 제품 코드 오류 (2026-10-17)

| 항목 | 고정 증거 |
| --- | --- |
| Run / Attempt | [Run 39008625870.1](https://github.com/planner77/masterGantt/actions/runs/39008625870), PR synchronize, conclusion=`failure` |
| Head / Base | `9e7cde9223733e2863ce015ad6e37e3d64388e6b` / `de863713142a92f1cac56dbae044923822bca932` |
| test-merge SHA | `fd21a5d5e32e27da307b543f4b72171edf358ffd` (실제 runner checkout 로그) |
| Preflight / Policy | [QA Preflight 117326191095](https://github.com/planner77/masterGantt/actions/runs/39008625870/job/117326191095) **PASS** — 문서 영향과 AC1~7은 이번 Run에서 해결. [Policy 117326228981](https://github.com/planner77/masterGantt/actions/runs/39008625870/job/117326228981) PASS |
| TypeScript / Vitest | [Typecheck 117326229055](https://github.com/planner77/masterGantt/actions/runs/39008625870/job/117326229055) **PASS**. [Vitest 117326229007](https://github.com/planner77/masterGantt/actions/runs/39008625870/job/117326229007) **PASS**: 225 test files PASS / 1 SKIP, 2783 cases PASS / 3 SKIP (원본 Head 증거이며 후속 Head에 재사용 금지) |
| 신규 ROOT | [ESLint Job 117326228997](https://github.com/planner77/masterGantt/actions/runs/39008625870/job/117326228997): `src/features/logistics/project-logistics-unified.tsx:76:7`, `react-hooks/set-state-in-effect`; 1 error + 14 warnings. 경고는 그 자체로 이번 failure 원인이 아님 |
| 미검증 | Full PR Chromium E2E6·Next production build·Docker implementation SKIPPED (Fast Gate 실패) |

### 누적 원인 원장에 추가할 F-624-013~018

| 사건/Job | 실제 상태 | 근인 vs 파생 | 근거와 수정 또는 검증 |
| --- | --- | --- | --- |
| **F-624-013** / [ESLint 117326228997](https://github.com/planner77/masterGantt/actions/runs/39008625870/job/117326228997) | **FAILURE** | **실제 코드 Root** | `useEffect` 안에서 `selection`/query/snapshot 불일치 시 `setSelection(null)`과 `setSelectionNotice(...)` 동기 실행. React Hook lint `react-hooks/set-state-in-effect`가 cascading render 위험으로 차단. 해당 Effect 안 동기 상태 변경을 제거하고 `currentLogisticsDetail(selection, data?.snapshotId, queryKey)`로 유효 상세를 렌더 시 계산. 사용자 관점/필터 전환의 상세 정리는 이벤트 핸들러로 이동, DOM 초점 Effect만 유지. |
| **F-624-014** / [PR Fast Gate 117326475629](https://github.com/planner77/masterGantt/actions/runs/39008625870/job/117326475629) | FAILURE | 파생 | `LINT_RESULT=failure`이고 Preflight/Typecheck/Unit/Policy는 success여서 fail-closed 차단 |
| **F-624-015** / [Quality 117326505024](https://github.com/planner77/masterGantt/actions/runs/39008625870/job/117326505024) | FAILURE | 파생 | 필수 품질 집계는 ESLint FAIL 전파. 이전 두 Run과 달리 개별 TypeScript·Vitest는 실제 PASS |
| **F-624-016** / [Chromium aggregate 117326504983](https://github.com/planner77/masterGantt/actions/runs/39008625870/job/117326504983) | FAILURE | 파생 | E2E Shard 실행이 모두 SKIPPED됨. 실제 Chromium Assertion 실패는 아직 없음/검증되지 않음 |
| **F-624-017** / [Docker aggregate 117326505077](https://github.com/planner77/masterGantt/actions/runs/39008625870/job/117326505077) | FAILURE | 파생 | Docker build/smoke implementation SKIPPED, Docker 제품 품질 아직 NOT TESTED |
| **F-624-018** / [QA Final 117326520962](https://github.com/planner77/masterGantt/actions/runs/39008625870/job/117326520962) | FAILURE | 파생 | `자동 QA: FAIL` — 세 required aggregates 실패. Trusted QA/Owner 승인이나 Codex 리뷰 usage 한도와 혼합 금지 |

**코드 보완의 제한 및 근거:** 기존 `ResourceDashboardDetails`의 정확한 canonical Task/Assignment selector·focus 복귀·readonly/stale 잠금은 바꾸지 않는다. `currentLogisticsDetail` pure 함수는 일치 snapshot/query에서 동일 참조를 반환하고, snapshot 바뀜·query 바뀜·데이터 없음에서는 null을 반환한다. 해당 6가지 경우의 신규 Unit(로컬 미실행)을 포함한다. 필터/관점의 사용자 이벤트에서만 old selection을 지우고 안내를 설정한다. `useEffect`에서는 DOM heading focus만 다뤄 ESLint rule을 끄지 않는다.

**차기 CI 전 평가:** 앞선 두 Root 문서 오류가 #2877.1에서 실제 PASS함을 보존한다. 새 HEAD lint 결과·새 helper Unit/E2E/Build/Docker는 원격 CI 실행 전 NOT TESTED다. 불필요한 14개 경고 일괄 수정, test skip·timeout 증가·assertion 완화·CI 정책 수정은 하지 않는다. 이후 제품 실패가 나타나면 F-624-019부터 원인 합집합에 추가한다.

## 2.3. PR CI #2879.1 — 실제 390px document overflow / Chromium 2·6 (2026-10-17)

| 원본 출처 | 확인 값 |
| --- | --- |
| Issue/PR/Workflow | Primary #624 / [PR #702](https://github.com/planner77/masterGantt/pull/702) / CI Full pull_request synchronize |
| Run/Attempt | [#2879.1 / 39009419792](https://github.com/planner77/masterGantt/actions/runs/39009419792), 2026-10-17T06:18:28Z~06:27:12Z, conclusion=failure |
| Head / Base / Test-merge | `b3eef1c21f0832f6af92571a8ed7c79080d8e6ae` / `de863713142a92f1cac56dbae044923822bca932` / `8b5d0b91276cdb0579f5df48a92c39d08558d3dc` (Shard 2 checkout 로그) |
| 최초 실제 실패 | [PR E2E Shard 2/6, Job 117328864733](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328864733), `tests/e2e/issue-624-logistics-unified.spec.ts:107:39`, `#624 same canonical Project across four logistics perspectives ... five widths` |
| 메시지 / 환경 | Viewport **390px**, `document.documentElement.scrollWidth` **704px**, 기대 `<=391px`; 신규 fixture는 네 perspective/원시 Task·Assignment·Milestone full Gate 비교를 선행하고 화면폭 검사 진입 후 오류 |
| 로그/Trace | [Shard 2 Playwright report artifact #12092701155](https://github.com/planner77/masterGantt/actions/runs/39009419792/artifacts/12092701155)의 `error-context.md`, `trace.zip`. 실제 Trace/실패 화면에서 통합 조회의 가로 넘침을 확인; raw trace·원본 이미지는 Git 미등록 |
| Shard 2 실행 범위 | `33 passed`, `1 failed`, `85 did not run`; `--max-failures=1`로 조기 종료. 해당 Run 전체 E2E/6 Shard PASS와 혼동 금지 |
| 다른 Shard | Shard **1,3,4,5,6 = CANCELLED**. 각각의 로그에서 취소 이전에 여러 테스트 PASS가 관측되었으나 중단 시 실제 추가 FAIL은 확인되지 않음. 취소를 PASS·정상 종료로 처리하지 않음 |
| 통과한 필수 검사 | QA Preflight [117328558497](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328558497), Policy [117328591075](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328591075), TS [117328591130](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328591130), ESLint [117328591062](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328591062), Vitest [117328591152](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328591152), Fast Gate [117328830255](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328830255), Next Build [117328864605](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328864605), Docker Smoke [117328864557](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328864557), Required Quality [117329218440](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117329218440) / Docker [117329268096](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117329268096) **SUCCESS** |
| Required/Final | [Chromium aggregate Job 117330159540](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117330159540) **FAILURE** (Shard 실패/취소 전파); [QA Final 117330178007](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117330178007) **FAILURE** (`required e2e 미성공`) |
| Main 정렬 | 실패 Run 당시 Base `de8637...`였으나 진단 시 최신 main `78ec8d2ced62f543f73a8477c3e62fca8274274b`까지 **10 commits behind**. 최신 main의 #704 공통 누적 실패 운영지침을 병합해 실제 새 Head에서 검증해야 함 |

### F-624-019~021 / 취소 Job 별도 보존

| ID | 분류 / 직접·파생 | 원본 및 보완 |
| --- | --- | --- |
| **F-624-019** | **PRODUCT UI responsive — 실제 신규 E2E 실패** | 390px viewport에서 document scrollWidth704 (expected<=391), `issue-624-logistics-unified.spec.ts:107`. 기존 `project-logistics-unified.module.css`의 `.root { display:grid; ... }`가 암묵적 auto 열을 사용하여 폭 넓은 내부 Target/Milestone table의 min-content 영향을 부모 Grid track으로 전파할 수 있음. headless Chromium 별도 정적 재현에서 같은 구조의 390px documentWidth712→`grid-template-columns:minmax(0,1fr);width:100%` 변경 시390, 내부 scroll client388/scroll710 유지. **실제 제품의 정확한 704px 기여 요소는 추가 DOM 측정 없으므로 원인 연결은 검증 대기**; strict 기존 assertion 그대로 유지 |
| **F-624-020** | CI 전파 | Required Chromium aggregate 실패. 한 Shard FAIL/다른 5개 CANCELLED 때문에 자동 fail-closed; 다른 소비자 테스트는 본 Run에서 전수 검증 불가 |
| **F-624-021** | CI 전파 | QA Final `required e2e 미성공`. QA 자체 결함·승인/권한 문제로 재분류하지 않음 |
| **C-624-001** | **CANCELLED (독립 증거)** | PR shard 1 [117328864653](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328864653), 3 [117328864629](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328864629), 4 [117328864778](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328864778), 5 [117328864673](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328864673), 6 [117328864644](https://github.com/planner77/masterGantt/actions/runs/39009419792/job/117328864644). 원본 취소 로그는 중간 PASS와 cancellation을 구별; 해당 Shard를 PASS로 승격하지 않음 |

**실제 수정 후보:** `src/features/logistics/project-logistics-unified.module.css`의 Grid에 **명시적 0 최소 너비 단일 열**을 부여하여 내부 688/710px table이 문서 자체가 아닌 기존 `ResourceTargetViews` / Milestone `.scroll` 안에서만 스크롤되게 한다. 신규 E2E는 원래 `<=viewport+1` 단언 및 390px **내부 scroll 소유**·five widths·canonical ID/full Gate·조회 mutation0·same Gantt/복귀를 **그대로 보존**한다. 재발 시 빠르게 진단할 수 있도록 실패한 width에만 실제 `documentWidth`, root/region width, overflow element top16을 JSON attachment로 기록한다. 테스트 기대값·timeout·skip·CI fail-fast는 변경하지 않는다.

**합성 독립 재현(실제 masterGantt browser PASS 아님):** Python Playwright + /usr/bin/chromium에서 동일 원칙의 grid/긴 Target selector/688px Target 표/710px Milestone 표 CSS를 만들어 테스트. 암묵적 auto track: 390→document712, 내부 region710/710(overflow 소유 상실). 위 grid track 수정: 390→document390, 내부 region388/710(내부 scroll 확인), 768→768, 1024→1024, 1440→1440, 1920→1920. 제품의 실제 API/React/기본 테마를 실행한 것이 아니므로 원격 새 Head 결과는 **NOT TESTED**다.

## 2.4. 전체 이력 Cross-run 매트릭스 (#704 공통 지침 수용)

| 원본 실제 실패·Run/Attempt | 당시 소스/증상 | 기존 보완 및 그 이후 원격 증거 | 직접·간접/음성 영향 및 신규 후보 | 같은 최신 Head 남은 검증 |
| --- | --- | --- | --- | --- |
| F-624-001 / #2875.1 | `ISSUE_624.md` docs/GITHUB_OPERATIONS 영향 누락 | `cc760433...`로 N/A 추가, **#2877.1·#2879.1 QA Preflight PASS** | 기존 docs parser/AC/원격 승인/버전 정책 | 최신 main의 #704 docs + 동일 HEAD Preflight / QA |
| F-624-007 / #2876.1 | Work Packet `- **AC#**:`를 parser가 인식 못함 | `9e7cde92...`로 `- AC#:` + UPDATED 문법 보완, **#2877.1·#2879.1 QA Preflight PASS** | 문서 영향 목록·AC1~7·read-only Trusted | 새 HEAD QA/doc gate |
| F-624-013 / #2877.1 | `project-logistics-unified.tsx:76` React Hook synchronous effect setState | `b3eef1c2...`로 exact query/snapshot derived detail+이벤트 무효화, **#2879.1 ESLint·Vitest·Typecheck PASS** | selection·stale·focus·exact Task/Assignment, `logistics-unified-model.test.ts` | 새로운 HEAD lint/unit/E2E 상태·복귀 |
| **F-624-019 / #2879.1** | **신규 E2E 390px viewport document704 > 391** | 제품에 CSS grid minmax0 보완 후보+strict overflow diagnostics. 별도 synthetic browser에서 390 doc712→390, 내부 scroll 보존 | `issue-624-logistics-unified.spec.ts`, `ResourceTargetViews`, Milestone table, 기존 #623/621 five widths 및 #528 drill, 긴 Target/0 mutation | 실제 동일 candidate의 390/768/1024/1440/1920 Chromium / 재실패 시 DOM offender trace 필수 |

**누적 실제 실패 파일 합집합:** `docs/exec-plans/active/ISSUE_624.md`(문서 계약 2개), `src/features/logistics/project-logistics-unified.tsx`(ESLint), `tests/e2e/issue-624-logistics-unified.spec.ts`(브라우저). 직접 회귀 `tests/features/logistics/logistics-unified-model.test.ts`, 인접/음성 #623 Resource MVP, #621/620 Target projection/HTTP, #528 exact editor/return, Milestone full Gate, #697 Gantt 영향 소비자. 일부 과거 테스트는 다른 source의 결과이므로 새 candidate의 PASS 증거로 재사용하지 않는다.

**동일 소스 검증 원칙:** doc Parser/정적 분석·CSS synthetic Chromium은 사전 근거이고 실제 새 Head TypeScript·Vitest·ESLint·Playwright·Build·Docker/Trusted는 **GitHub 새 Run에서만 판정**. 새로운 후보에서 반복 실패 시 마지막 실패 하나만 수정하지 않고 F-624-001/007/013/019 전체 원인·관련 소비자 및 C-624-001 취소 Shard의 누적 이력을 다시 확인한다. `docs/PR_CI_FAILURE_TRIAGE.md`의 A→G 순서를 따른다.

## 3. 왜 발생했고 무엇을 고쳤는가

1. `package.json`·`package-lock.json`의 app `0.115.0` 변경은 QA 정책상 protected/runtime execution path를 포함한다. 기본 브랜치의 `docs_required`는 QA 문서 `AGENTS.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`, **`docs/GITHUB_OPERATIONS.md`**, `docs/REMOTE_VALIDATION.md` 영향 기록의 합집합을 요구한다.
2. PR에 관련 정책의 실제 동작 변경은 없더라도 Work Packet의 `## DOCUMENTATION_SYNC`에 **정확한 경로**와 `UPDATED` 또는 `N/A(구체적인 이유)`를 적어야 한다. 기존 Work Packet은 `docs/GITHUB_OPERATIONS.md` 한 건을 누락해 `qa_final_automated.docs_gate`에 의해 거부됐다.
3. 교정은 `docs/exec-plans/active/ISSUE_624.md`에 `docs/GITHUB_OPERATIONS.md: N/A(package/lock 버전 메타데이터만 변경; GitHub 운영, CI 트리거, 리뷰·병합·GHCR 승인 절차 변경 없음)` 추가. GitHub 운영 문서 자체를 근거 없이 수정하거나 `docs_gate` 검사를 제거하지 않는다.
4. 이번 작업은 E2E·제품 결함을 아직 확인하지 않았으므로 Timeout 일괄 증가, Skip, Assertion 완화, QA/Ruleset/Release Gate 우회가 **아니다**. 이미 존재하는 신규 E2E의 정확한 Task/Assignment/Resource ID·Milestone full Gate·조회0 및 기존 #623 회귀를 다음 Full CI에서 그대로 실행해야 한다.

## 4. 후속 CI가 또 실패하면 사용할 원인 통합 절차

1. **후속 기준 고정:** 실패한 Run ID/attempt, 이벤트 종류, PR HEAD/base/test-merge SHA, 실제 체크아웃 SHA, 변경 파일/버전/코드·테스트·fixture SHA 기록. 동일 후보 테스트 중 소스를 바꾸지 않는다.
2. **Job 전수 조사:** Actions jobs를 attempt별로 **모든 페이지** 조회하고 실패·취소·SKIP·성공/집계를 분리한다. 첫 실패의 실제 로그/실패 Assertion과 취소된 Job에 기록된 테스트 오류를 구분하고 artifact·trace를 보존한다. Matrix fail-fast로 취소되었다면 그 사례를 테스트 PASS/FAIL로 추정하지 않는다.
3. **누적 실패 합집합:** 위 F-624-001을 유지하면서 이후 신규 F-624-019...를 등록한다. 분류는 (가) 제품/집계·수정 권한, (나) 테스트 계약/fixture·준비/경합, (다) 문서·정책·QA, (라) 환경/Runner·timeout, (마) 병합·review/프로비넌스. 동일 root의 연쇄 FAIL은 별도 제품 결함으로 중복 세지 않는다.
4. **실행 전략:** 해당 이슈가 특정 파일에 쏠렸으면 모든 누적 실패 spec의 합집합을 **조기 중단 없이** 선택 실행한다. 기존 #623 Golden, Resource Target HTTP/details, Milestone full Gate, 390/768/1024/1440/1920 viewport을 보존한다. 제품 결함이면 제품을 고치고, 순서/fixture 문제이면 정상 준비와 의도적 경합 테스트를 분리한다.
5. **세 단계 재검증:** (A) 관련 pure/unit/typecheck/lint + 정책 docs preflight, (B) 누적 실패 파일 합집합의 실제 HTTP/Chromium·Resource와 Stage 통합 회귀, (C) 같은 동결 HEAD의 full PR CI3종/Trusted 확인. 모든 단계는 서로 별도 결과/시간/환경·PASS/FAIL/BLOCKED/NOT TESTED를 표시한다.
6. **다음 시작 전 마감 조건:** `DOCUMENTATION_SYNC` 정확 경로/AC1~7 구조 동기화, `main` ahead/behind=0 behind, PR mergeable=true, 미해결 review thread=0. 이후 HEAD 변경으로 PR CI를 새로 시작하고 **결과 감시를 하지 않는다**. Owner의 고위험 수용·병합·Main/GHCR·정식 릴리스는 별도 지시/증거가 필요하다.

### 다음 실행 원장 템플릿

| Run/attempt | HEAD/Base/Test-Merge | 실패한 실제 Job/Shard·테스트 | 새 유형/원인 | 제품/fixture/문서 수정 커밋 | 로컬 누적 합집합/전수 검증 | 원격 Gate | 남은 위험 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| (새 run마다 추가) | SHA40/40/40 | 정확한 링크·로그·Assertion | F-624-022… / 전파 vs root | Git commit | PASS/FAIL/BLOCKED/NOT TESTED | NOT TESTED→실제 상태 | 승인 전 BLOCKED |

## 5. 현재 완료/미완료 구분

- 확정: #2875.1의 문서 영향 경로 누락(F-624-001) → #2876.1의 AC1~7 Markdown 계약 불일치(F-624-007) → #2877.1의 실제 React Hook ESLint 오류(F-624-013)는 서로 다른 근인이다. 세 Run의 정확 Head/Base/Test-Merge와 실패/미실행/실제 통과 Job은 위 표대로 보존하며, 각 파생 Required aggregate·QA Final을 독립 제품 결함으로 중복 계산하지 않는다.
- 조건부: 새 Head의 React Hook 코드·helper Unit 및 Work Packet 문서 영향/AC 구조를 검토한다. #2877.1의 QA/Unit/Typecheck PASS를 새 HEAD로 승격하지 않으며 신규 CI3/Trusted 성공 전 QA/제품 검증은 NOT TESTED다.
- 미완료: 새 Full PR CI3종/Trusted QA 결과, 운영 성능·실기기·스크린리더, Owner HIGH 위험 수용 및 명시 병합 승인, Main GHCR/Finalizer/Issue 종료.

## 6. CI #2879.1 이후 인계 현황 (정정/추가 원장; 과거 판정 불변)

- PR HEAD와 최신 main 정렬: 현재 Run #2879.1 Source는 `b3eef1c21...` (base `de863...`), 진단 시 main `78ec8d2...`로 ahead10. 새 후보의 merge parent/base/mergeability 및 정확 신규 Run ID를 새 CI 시작 직전에 기록하고, 갱신 시 이전 이력을 삭제하지 않는다.
- 수정 예정 파일: `src/features/logistics/project-logistics-unified.module.css`, `tests/e2e/issue-624-logistics-unified.spec.ts`, Work Packet·본 원장·PROJECT_UX/TEST_PLAN/REMOTE_VALIDATION/active PLAN·Target Resource rollout/CHANGELOG. 최신 main #704 소스 지침 보존.
- scope: HIGH/OWNER_MANAGED, release_required=true, release_authorized=false. Owner HIGH 위험 수용/명시 병합 승인·Trusted QA·Main/GHCR/Release/Issue 종료는 별도이며, 원격 새 Head CI 종료/성공은 **NOT TESTED**.


## 7. PR CI #2887.1 — #621 원본 GET transport reset / 누적 5차 실패 (2026-10-17)

**원본 고정값:** Primary Issue [#624](https://github.com/planner77/masterGantt/issues/624), PR [#702](https://github.com/planner77/masterGantt/pull/702); [Full CI #2887.1 / Run 39014302310](https://github.com/planner77/masterGantt/actions/runs/39014302310), pull_request synchronize, 2026-10-17T07:37:08Z ~ 07:44:39Z, conclusion=FAILURE. Head `105bd05786089fec2e9b76898ad01921332ba117` / Base `78ec8d2ced62f543f73a8477c3e62fca8274274b` / actual test-merge `30c4fce5904d0fa39b30d7c928bd1828adcbb03c` (각 Shard checkout 로그). 이후 main `4307c8cdf1cc00a87fd7bff9f5e1a0c924bb3620`로 전진, 진단 시 Feature behind=2. 신규 HEAD/merge는 별도 기록 필요.

### 실제 실패와 취소된 Job 조사

| 누적 ID / 원본 Job | Outcome | 유형 / 증거 |
| --- | --- | --- |
| **F-624-022** · [Chromium Shard 3/6 Job 117343433036](https://github.com/planner77/masterGantt/actions/runs/39014302310/job/117343433036) | **FAILURE** | `tests/e2e/issue-621-resource-target.spec.ts:92`의 저장1·복제0·역방향 편집 테스트에서 `tests/e2e/fixtures/target-project.ts:48`의 `f.snapshot()` GET이 `apiRequestContext.get: read ECONNRESET`로 실패. 원본 Task/Assignment 결과 ASSERT 실패/HTTP 4xx·5xx 응답 없음. 36개의 테스트 PASS 이후 1FAIL·53 NOT RUN이며 local fixture URL은 127.0.0.1 ephemeral port. [Playwright report/trace artifact 12094630518](https://github.com/planner77/masterGantt/actions/runs/39014302310/artifacts/12094630518) |
| **F-624-023** · [Chromium aggregate 117344399521](https://github.com/planner77/masterGantt/actions/runs/39014302310/job/117344399521) | FAILURE | Shard3 실제 실패 + 나머지 5개 CANCELLED을 fail-closed 전파한 집계, 독립 제품 오류로 세지 않음 |
| **F-624-024** · [QA Final 117344420857](https://github.com/planner77/masterGantt/actions/runs/39014302310/job/117344420857) | FAILURE | `required e2e 미성공` 파생; 별도 Reviewer 승인/CI 정책 문제 아님 |
| **C-624-002** · Shard [1 117343433050](https://github.com/planner77/masterGantt/actions/runs/39014302310/job/117343433050), [2 117343433044](https://github.com/planner77/masterGantt/actions/runs/39014302310/job/117343433044), [4 117343433062](https://github.com/planner77/masterGantt/actions/runs/39014302310/job/117343433062), [5 117343433047](https://github.com/planner77/masterGantt/actions/runs/39014302310/job/117343433047), [6 117343433046](https://github.com/planner77/masterGantt/actions/runs/39014302310/job/117343433046) | **CANCELLED** | 취소 전 Chromium 각각 56/31/11/24/49개 PASS 표시, 로그에서 별도의 ✘ assertion은 확인되지 않았으나 전수 종료하지 않았으므로 최종 PASS가 아님. Shard3에서 실제 PASS 36 및 실패 1; 이 숫자는 전체 계획 사례 수 또는 완료 PASS와 다름 |
| **Gate successes** | **SUCCESS** | Preflight, Policy, ESLint, TypeScript, Vitest, PR Fast Gate, Next Build, Docker smoke, 필수 Quality / Docker aggregate. `#2879.1`의 문서·Hooks·제품 레이아웃 보완은 이번 source의 static/build/QA gate에서 성공했으나 **#624 전용 Chromium5폭 spec은 Shard2 취소로 미검증** |

### Trace 타임라인과 사실/가설 분리

- 추적: [Shard3 Playwright trace](https://github.com/planner77/masterGantt/actions/runs/39014302310/artifacts/12094630518)의 request chain. 해당 프로젝트 원본 GET 및 Target binding/Assignment PUT은 200/201 응답과 ETag 증가를 반복했고 마지막 프로젝트 GET **07:42:38 UTC, HTTP 200**, 응답 헤더 `connection: keep-alive`, `keep-alive: timeout=5`. 그 뒤 UI는 Resource 보고서 ready 상태를 렌더하고, 약 **6.1초 후** 같은 origin/URL의 새 snapshot GET이 HTTP 상태 코드 없이 TCP `ECONNRESET`가 됨. 기존 `f.snapshot()`는 `page.request.get(api)`로 동일 APIRequestContext를 반복 사용했다.
- **확정 증상 분류 = INIT_TRANSPORT**: 서버/API 500나 canonical 데이터 불일치 증거가 아니라 브라우저 외부 테스트 HTTP의 전송 종료. 마지막 화면 렌더만으로 Next 프로세스가 계속 정상 실행 중이었는지, 다른 Runner 부하/idle socket race인지 증명되지는 않는다. 따라서 PRODUCT/ENVIRONMENT 또는 'Next dev 크래시'로 단정하지 않는다.
- **우선 가설 = 5초 유휴 keep-alive 소켓 재사용 경합**: 마지막 정상 GET의 `timeout=5`와 다음 GET의 약 6초 간격이 일치한다. 제품/API 권한·저장 경로 수정은 원인과 근거 불일치. 환경/프로세스 기원 가능성은 열어두고, 실패 시 health probe의 실제 결과로 분리한다.
- **fail-closed 보완:** `tests/e2e/fixtures/target-project.ts`의 **canonical snapshot GET만** `Connection: close` 요청으로 수행하여 오래된 socket 재사용을 피하도록 제어한다. GET 실패 시 read-only `/api/health/ready`를 2초 제한/새 close connection으로 **한 번만 진단**하고 원래 오류를 `cause`에 보존한 채 테스트는 **실패**시킨다. 자동 재시도, 서버 재시작, 데이터 캐시로 성공 위장, 4xx/5xx 완화/timeout·skip 추가는 없다. fixture의 `f.mutate`는 기존 ETag/If-Match/Authorization 처리와 원본 스냅샷을 유지한다.
- **검증 상태:** 현재 대화 실행 컨테이너는 GitHub 저장소 clone/Node deps·실제 isolated Next/Chromium 전체를 실행할 수 없어 새 HEAD의 Product/Transport PASS는 **NOT TESTED**. Playwright trace와 정적 소스 검토는 원격 통과 증거가 아니다. 연결 재발 시 health=ok 여부 및 원래 ECONNRESET cause, 서버 PID/자원·Runner CPU/memory/Next dev exit를 추가 조사하고 같은 source에서 운송/제품으로 재분류한다.

### 이전 모든 실패와의 Cross-run 대조 (#704 A→G)

| 실패 Root / 정확 Run | 원래 계약·당시 보완 | #2887.1에서 실제 재발 여부 | 이번 변경과 동일 후보에 요구되는 소비자 검증 |
| --- | --- | --- | --- |
| F-624-001 / #2875.1, `39007521324.1` | Work Packet `docs/GITHUB_OPERATIONS.md` N/A 누락 → docs 수정 | **재발 아님:** #2887.1 Preflight PASS | 같은 HEAD 문서 영향 합집합·AC1~7/정확 base QA |
| F-624-007 / #2876.1, `39008123509.1` | AC1~7 `**` Markdown parser 불일치 → plain `- AC#:` | **재발 아님:** #2887.1 Preflight PASS | Work Packet과 새 source/changed-path의 동일 문법 |
| F-624-013 / #2877.1, `39008625870.1` | effect 동기 setState lint → derived query/snapshot + 사용자 이벤트 무효화 | **재발 아님:** ESLint/Typecheck/Vitest PASS | `logistics-unified-model.test.ts`와 Resource exact drill/stale/readonly/focus |
| F-624-019 / #2879.1, `39009419792.1` | 신규 #624 Chromium 390px doc704, CSS grid explicit minmax0; 원본 assertion 유지 | **UNVERIFIED:** Shard2가 #2887.1에서 CANCELLED, #624 five-width 실측 완료 없음 | `tests/e2e/issue-624-logistics-unified.spec.ts` 390/768/1024/1440/1920, documentWidth<=width+1/내부 scroll, exact IDs·Milestone Gate·조회0 |
| **F-624-022 / #2887.1, `39014302310.1`** | 기존 #621 `f.snapshot` read ECONNRESET, idle keepalive **가설**; fail-closed connection close/health 진단 | 신규 Root, 원격 교정 미검증 | `tests/e2e/issue-621-resource-target.spec.ts`, 공유 `target-project.ts` 소비자 #623/#624, 실제 HTTP/원시 ID/저장1·복제0/권한 음성 |

**누적 실제 실패 파일·계약 합집합:** `docs/exec-plans/active/ISSUE_624.md`(2회 QA 문서 계약), `src/features/logistics/project-logistics-unified.tsx`(Hooks ESLint), `tests/e2e/issue-624-logistics-unified.spec.ts` 및 `src/features/logistics/project-logistics-unified.module.css`(390px 제품 overflow), **`tests/e2e/issue-621-resource-target.spec.ts` / `tests/e2e/fixtures/target-project.ts`(전송/fixture)**. 인접/음성: `tests/e2e/issue-623-resource-mvp.spec.ts`, `tests/e2e/logistics-target-authoring.spec.ts`, `tests/e2e/issue-622-resource-plan-target.spec.ts`, #528 Resource drill, Milestone full Gate, readonly/dirty/pending/401/412/invalid scope, Gantt one-instance. 업무 DB/글로벌 Resource KPI API는 이번 계약 수정의 대상이 아니며, 신규 서버 side 로직 없음.

**동일 source 검증/재실패 조건:** 세 Gate(Preflight/doc/Typecheck/Lint/Unit → bounded #621/#623/#624 Chromium 위 파일·fixture 원본 변경 없음·fail-fast OFF 진단 → 정확 HEAD Full PR CI Quality/E2E6/Docker/Trusted)를 구분한다. 환경에서 로컬 Browser 실행이 불가해 (A) 정적 source/parser 검토까지 수행, (B) 로컬 실제 Chromium `NOT TESTED`; (C) 새 GitHub PR CI를 시작하여 결과는 별도 후속 확인. 단일 source/test 변경 중 과거 Head의 PASS를 이월하지 않는다. fail-fast/CANCELLED의 기존 증거를 지우지 않으며 초기에 막혔던 `#624` E2E 제품 overflow도 별도 검증 대상이다.

**원격 상태·권한:** 진단 당시 main이 두 새 커밋(#679)으로 전진. AGENTS/CI_CD/GITHUB_OPERATIONS/PR_BATCH_PUBLICATION 및 docs/TEST_PLAN/REMOTE_VALIDATION/PLAN #679 변경을 **양쪽 모두 보존해 브랜치 통합**한다. Live PR review thread 0이며 실제 mergeable/latest main은 새 commit 직전에 재평가한다. risk=HIGH / qa_method=OWNER_MANAGED / release_required=true / release_authorized=false / manager_decision=NOT TESTED. 병합/Main GHCR/Finalizer·Issue 종료는 별도 승인 대상이다.

## 8. PR CI #2893.1 — #456 scoped Week axis capacity (2026-10-17)

**고정 출처**: [Run #2893.1, ID 39021459600](https://github.com/planner77/masterGantt/actions/runs/39021459600), pull_request/synchronize, attempt1, HEAD `417cc3ce1de3b00e7f90386e2dd73bf943e1ce86`, 당시 Base `4307c8cdf1cc00a87fd7bff9f5e1a0c924bb3620`, 실제 test merge `efb02ff6beaa379cf0e54798e8e59fd939e3f8ee` (runner checkout). 원본 결론 FAILURE.

| 누적 사건 / Job | 실제 결과 | 최초 오류 또는 파생 관계 |
| --- | --- | --- |
| **F-624-025** / [Shard3 117364313016](https://github.com/planner77/masterGantt/actions/runs/39021459600/job/117364313016) | FAIL | `tests/e2e/task-editor-form-density.spec.ts:150`, #456 scoped WBS/Week/fullscreen setup. 166행에서 `chart.scrollLeft=120` 강제 설정 후 168행의 5초 `expect.poll(chartScroll).toBe(120)`이 actual **62**로 실패. 85PASS/1FAIL/1SKIP/3NOT RUN. [trace](https://github.com/planner77/masterGantt/actions/runs/39021459600/artifacts/12096967012) |
| **F-624-026** / [E2E aggregate 117366383734](https://github.com/planner77/masterGantt/actions/runs/39021459600/job/117366383734) | FAIL, 파생 | Shard3 FAIL, 나머지 집계 규칙에 따라 Required E2E 실패 |
| **F-624-027** / [QA Final 117366396783](https://github.com/planner77/masterGantt/actions/runs/39021459600/job/117366396783) | FAIL, 파생 | required E2E 미성공; 별도 QA 정책 결함 아님 |
| C-624-003 / Shard1/2/4/5 | CANCELLED | 중간 개별 PASS는 있을 수 있지만 shard 전체 완료 검증 아님. 취소 로그에 추가 실제 FAIL 표시는 확인되지 않음 |
| P-624-001 / [Shard6 117364312992](https://github.com/planner77/masterGantt/actions/runs/39021459600/job/117364312992) | SUCCESS | 113 Chromium 사례 완료 |
| P-624-002 / [Shard2 117364312929](https://github.com/planner77/masterGantt/actions/runs/39021459600/job/117364312929) | CANCELLED, 개별 PASS | 신규 `issue-624-logistics-unified.spec.ts` 테스트 자체는 17.6초 PASS. Shard2 전체는 PASS 아님 |
| P-624-003 / [Shard3 117364313016](https://github.com/planner77/masterGantt/actions/runs/39021459600/job/117364313016) | 실패 전 개별 PASS | 앞선 `ECONNRESET` 사례인 `issue-621-resource-target.spec.ts:92` 등 #621 다섯 사례 PASS |
| P-624-004 / Preflight/Policy/ESLint/Typecheck/Vitest/Next Build/Docker, Required Quality/Docker | SUCCESS | 이 Head에서 앞선 첫 세 Root의 미재발 확인. 성공을 이후 Head로 이월하지 않음 |

**원인 분류**: `TEST_CONTRACT/FIXTURE_OBSERVABILITY` 가능성이 높다. #456 테스트는 scoped Summary/Week/fullscreen/외부ID 열 설정 직후 120px을 강제하지만 해당 axis가 양쪽 Core/native에서 120을 수용하는지 확인하지 않았다. 실제 62는 native scroll clamp와 일치한다. [#667 누적 분석](ISSUE_667_FAILURE_ANALYSIS.md)의 처음 120px 입력 전 Core/native capacity47 사례와 유사하나, 이번 원본 Core capacity와 RANGE_EXTENSION 진행이 계측되지 않았으므로 제품 viewport writer 결함 여부는 UNKNOWN으로 보존한다. Timeout만 늘려서는 유효한 축을 만들 수 없다.

**계약 유지 보완**: 최신 main #552의 Marker-OFF Canonical/Visible 분리 및 해당 #456 후속 소비자를 유지한 상태에서 `tests/e2e/task-editor-form-density.spec.ts`의 이 사례 초기화만 보완한다. `waitForGanttReadiness`로 current API/revision/Week/rootTask scope/query/3 frame·Core/native capacity를 검사하고, 120 수용 불가이며 양 capacity가 양수일 때 기존 사용자 입력인 실제 horizontal wheel 한 번을 수행한다. 이후 같은 문맥에서 `evaluateGanttReadiness(...targetLeft:120)` admission을 확인한 뒤 원래 `scrollLeft=120`, vertical38 및 Editor/metadata/선택/동일 Gantt identity를 그대로 단언한다. 이전/이후 admission·Coordinator를 attachment로 남긴다. Assertion/Skip/Timeout/Retry/QA 정책/프로덕션 writer 변경 없음.

**전체 이력 Cross-run 비교**: F-624-001 #2875.1 DOC_SYNC 누락 → F-624-007 #2876.1 AC Markdown parser → F-624-013 #2877.1 React Hook Lint는 이번 Preflight/Lint/Vitest 성공으로 미재발. F-624-019 #2879.1 신규 #624 390px document704 overflow는 이번 #624 개별 E2E PASS로 동일 테스트의 증상 미재발(Shard2 CANCELLED로 전수 PASS 아님). F-624-022 #2887.1 #621 GET ECONNRESET은 이번 #621 다섯 개별 테스트 PASS로 직접 재발 미관측. 이번 F-624-025는 별도의 기존 #456 스크롤 준비 전제 실패이며 #552 WBS/Milestone와 #667 viewport와의 연결을 검토한다. 과거 실패 및 CANCELLED 증거를 삭제하지 않는다.

**누적 실패 파일 합집합**: `docs/exec-plans/active/ISSUE_624.md`(DOC_SYNC/AC), `src/features/logistics/project-logistics-unified.tsx`(Hooks), `src/features/logistics/project-logistics-unified.module.css` + `tests/e2e/issue-624-logistics-unified.spec.ts`(390px), `tests/e2e/issue-621-resource-target.spec.ts` + `tests/e2e/fixtures/target-project.ts`(HTTP transport), **`tests/e2e/task-editor-form-density.spec.ts`**(#456 120px/62px). 교차·음성: #552 marker-OFF/#570 canonical-visible, #667 Gantt readiness, #623 Resource MVP, #621 same Task Editor, selected/wheel/new input precedence 및 dirty/readonly/401/412, 실제 user input으로 axis capacity가 확보되지 않으면 fail closed.

**동결 source 검증 경계**: (A) 서식/QA 정책/정적 타입·Unit (B) 관련 누적 실패 파일+인접 #456/#570/#552/#667의 no-fail-fast 한정 재현 (C) 같은 Head Full PR Quality/E2E6/Docker/Trusted. 이 환경에서는 로컬 Chromium 직접 실행 불가하여 (B) `NOT TESTED`. 새 원격 CI의 시작을 원본 수정 성공이라 주장하지 않는다. PR base 뒤에 main 37커밋(#552 marker OFF와 Core/fixture, app0.115.0)이 추가되어 branch/main을 양쪽 보존한 merge 후 후보 minor `0.116.0`으로 정렬할 계획. 완료 시 실제 SHA/Run/Attempt를 추가 기록. 사용자 지시대로 CI 완료 모니터링 없이 시작에서 종료하고 Owner 병합 승인/Main CI/GHCR/Release는 수행하지 않는다.

**다음 실패 원장**: 새 root가 발생하면 F-624-028부터 추가하고 처음 다섯 실패 및 이번 6번째 사례의 exact HEAD/base/test-merge, 취소된 Shard에 남은 실제 실패를 다시 읽는다.
