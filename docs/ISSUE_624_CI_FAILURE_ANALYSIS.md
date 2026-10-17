# Issue #624 — PR CI 누적 실패 원장 (PR #702)

> **유지 규칙:** 이 문서는 CI 실패 때마다 새 Run/Attempt/HEAD/Base/Test-Merge 증거를 독립 행으로 **추가**한다. 새 실패만 고치고 과거 원인을 지우지 않으며, 취소/Skip/미실행 Job을 제품 PASS로 승격하지 않는다. 원인 정리·대응은 `AGENTS.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/QA_REVIEW_POLICY.md`, `docs/REMOTE_VALIDATION.md` 및 [Work Packet](exec-plans/active/ISSUE_624.md)의 원본 계약을 따른다.

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
| (새 run마다 추가) | SHA40/40/40 | 정확한 링크·로그·Assertion | F-624-019… / 전파 vs root | Git commit | PASS/FAIL/BLOCKED/NOT TESTED | NOT TESTED→실제 상태 | 승인 전 BLOCKED |

## 5. 현재 완료/미완료 구분

- 확정: #2875.1의 문서 영향 경로 누락(F-624-001) → #2876.1의 AC1~7 Markdown 계약 불일치(F-624-007) → #2877.1의 실제 React Hook ESLint 오류(F-624-013)는 서로 다른 근인이다. 세 Run의 정확 Head/Base/Test-Merge와 실패/미실행/실제 통과 Job은 위 표대로 보존하며, 각 파생 Required aggregate·QA Final을 독립 제품 결함으로 중복 계산하지 않는다.
- 조건부: 새 Head의 React Hook 코드·helper Unit 및 Work Packet 문서 영향/AC 구조를 검토한다. #2877.1의 QA/Unit/Typecheck PASS를 새 HEAD로 승격하지 않으며 신규 CI3/Trusted 성공 전 QA/제품 검증은 NOT TESTED다.
- 미완료: 새 Full PR CI3종/Trusted QA 결과, 운영 성능·실기기·스크린리더, Owner HIGH 위험 수용 및 명시 병합 승인, Main GHCR/Finalizer/Issue 종료.
