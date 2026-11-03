# Issue #867 / PR #868 — 누적 PR CI 실패 원장

Primary Issue: [#867](https://github.com/planner77/masterGantt/issues/867) | PR: [#868](https://github.com/planner77/masterGantt/pull/868) | 기록일: 2026-11-03 (KST)
Source of Truth: [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md), [Issue #867 Work Packet](exec-plans/active/ISSUE_867.md).
이 문서는 원본 실패를 불변 기록으로 보존한다. 새 Head의 테스트/QA 결과가 나와도 과거 FAIL을 PASS로 변경하지 않는다.

## 1. Run/Attempt 전체 원장

| 사건 | GitHub 원본 / 시도 | 이벤트·검증 유형 | Source | 실제 결과 / 구별 |
| --- | --- | --- | --- | --- |
| FAST #240.1 | [Run 41582346231](https://github.com/planner77/masterGantt/actions/runs/41582346231), attempt 1 | pull_request / FAST_DEVELOPMENT (비권위) | Head `9eb6ccd84b52eb9618c9cb4fc5a42e8c2deddf6a` | SKIPPED, Full CI PASS 증거 아님 |
| F867-001 | [Run 41582346250](https://github.com/planner77/masterGantt/actions/runs/41582346250), attempt 1, #3463.1 | pull_request.opened / CI FINAL_FULL | Head `9eb6ccd84b52eb9618c9cb4fc5a42e8c2deddf6a`; Base `43e97c3a4fd284b09d4c900ff8ab25e7a778c74b`; Test-Merge `1401978cefe4b7c2a59e08d11a0589cfae71d8b3` | 원본 QA Preflight + QA 경로 FAIL; 후속 Fast/Required 집계 FAIL, 제품 구현 Job SKIPPED |
| F867-002 (파생) | [Run 41583036060](https://github.com/planner77/masterGantt/actions/runs/41583036060), attempt 1, #3464.1 | pull_request.edited / CI METADATA_ONLY | 같은 Head/Base, PR 본문 metadata 수정 | `FULL_FAILED` 인증 승계로 FAIL; 새 Full 구현 실행 아님 |

현재까지 확인 가능한 #867 PR은 #868 한 건, 위 세 Run 중 직접 Full 실패는 #3463.1 한 건이다. 변경 전 동일 Issue의 기타 원본 실행은 확인되지 않았다. 후속 Run은 발생 시 같은 원장에 누적한다.

## 2. 실제 Job / Step 귀속

### F867-001 — Full PR CI #3463.1 (41582346250.1)

- **QA Preflight** Job `125739948007`: `원본 base SHA의 QA Preflight 실행` FAIL. 신뢰된 main `scripts/qa_preflight.py`가 PR 본문에서 아래 **정확한 단독 선언 행**을 찾지 못하고, Issue 본문에서 `AC1..` 식별자를 찾지 못했다.
  - `RISK_LEVEL`: `risk_level` 단일 정규 선언 없음
  - `QA_METHOD`: `qa_method` 단일 정규 선언 없음
  - `QA_REQUIRED`: `qa_required` 단일 정규 선언 없음
  - `PATH_POLICY`: 위 선언 검증 실패에 의한 파생
  - `ISSUE_AC`: Issue #867 본문에 `AC1..` 식별자 없음
  - 5 FAIL, 5 DEFERRED. 구조 확인 전 `DOCUMENTATION_SYNC` 미평가.
  - 원본 [Preflight artifact `qa-preflight-41582346250-1`](https://github.com/planner77/masterGantt/actions/runs/41582346250) ID `13206785007`, 1,311 bytes (당시 미만료).
- **QA 신뢰 경계** Job `125739820795`: PR 본문 `qa_method`의 명시값 부재로 별도 직접 FAIL(`QA 경로 BLOCKED`).
- **PR Fast Gate** Job `125740075719`: 선행 `PREFLIGHT_RESULT=failure`, Policy/TypeScript/Lint/Vitest = SKIPPED 때문에 파생 FAIL.
- **Required 집계**: Quality `125740182397` FAIL, Chromium E2E `125740182332` FAIL, Docker `125740182239` FAIL. 실제 PR Policy/TypeScript/Lint/Unit/Next Build/Chromium8/Docker 구현 Job은 `SKIPPED`, `NOT RUN`; 테스트 assertion, 코드 실패, flakiness를 추론하지 않는다.
- **기타**: 변경 경로 판정 및 CI 영향 Shadow Job SUCCESS; 별도 Trusted QA 최종·Owner ACCEPT는 `NOT TESTED`.
- **분류**: `POLICY_CI` / PR·Issue 메타데이터 작성 계약 누락. 제품 코드 `PRODUCT` 판정 불가능.

### F867-002 — Metadata-only #3464.1 (41583036060.1)

- PR 본문에 QA 선언을 추가한 `edited` 이벤트. QA 경로 선검사 Job `125742004964` SUCCESS(메타데이터 형식 교정 확인).
- 메타데이터 증거 검증 Job `125742121575` 직접 FAIL: `PR metadata evidence: FULL_FAILED ... full_run=41582346250 · Full CI 41582346250.1 결론: failure`. 정확한 과거 Full CI 불합격의 안전한 전파.
- 자동 QA Job `125742290602` FAIL(`required quality 미성공`), Quality/E2E/Docker 집계 FAIL은 파생. Node/Vitest/Chromium/Docker 구현 SKIPPED.
- **분류**: `POLICY_CI` 파생·이전 실패 승계. 새로운 독립 전체 테스트 실패로 계수하지 않고 새로운 `synchronize` Full CI로 검증한다.

## 3. Cross-run 실패 매트릭스

| 실패 ID | 최초 원본/변경 전후 | 원인·보완 | 동일 source 교차 검증 / 잔여 |
| --- | --- | --- | --- |
| F867-001-A | PR `risk_level`/ `qa_method`/ `qa_required`가 문장 내 인라인 표기, 파서의 `^field: VALUE$`와 불일치 | PR 본문 독립 행에 `risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `qa_required: true` 선언. 보호 경로(`AGENTS.md`, `deploy/`, `package*.json`, `src/server/`)는 `scripts/qa_final_automated.py`의 최소 HIGH 정책에 따름 | PR 본문 수정 후 자동 metadata-only 경로 검사 성공; Full QA Preflight는 새 Head에서 `NOT TESTED` |
| F867-001-B | Issue #867의 8개 수용 체크 항목에 `AC1..AC8` 정규식 매치 없음 | 이슈 본문의 8개 항목에 식별자 보존 추가, Work Packet `AC_TEST_COVERAGE` 8항목을 실제 의미에 맞춰 재매핑 | 새 Full Preflight의 `ISSUE_AC` 및 문서 Gate `NOT TESTED` |
| F867-001-C | Work Packet에는 `risk_level=MEDIUM` 기록 및 `docs/QA_REVIEW_POLICY.md`, `docs/REMOTE_VALIDATION.md` 영향 판정 누락 | 최소 HIGH로 정정, 기존 QA/CI 규정은 변경하지 않고 누락된 두 문서 `N/A(reason)` 추가. 보호 경로에서 요구하는 6개 QA 문서 모두 영향 판정 작성 | 현재 GitHub 문서 구조 검사는 신규 Full CI에서 검증 전 `NOT TESTED` |
| F867-002 | metadata-only가 이미 실패한 Full Run을 확인 | 동일 Head의 metadata-only 재실행으로는 과거 Full FAILURE 복구 불가. 코드·문서·원장 동결 후 새로운 PR Head의 `synchronize` Full CI 필요 | 신규 Full CI `NOT TESTED`; 완료 모니터링 제외 |

## 4. 누적 실패 집합 · 영향 범위와 재현

- **독립 원본 실패 합집합**: `scripts/qa_preflight.py`의 `RISK_LEVEL/QA_METHOD/QA_REQUIRED/ISSUE_AC`; `scripts/qa_final_automated.py`의 QA 경로 선택(메타데이터), `scripts/verify-pr-metadata-evidence.py`의 이전 Full Run 실패 증거 검증. `PATH_POLICY`/집계/FAST는 파생으로 따로 표시.
- **미실행 집합(전부 별도 원격 검증 필요)**: `tests/server/projects/project-issue-default-filter.test.ts`, `tests/e2e/project-issues.spec.ts`, 기존 `tests/server/projects/project-issues.test.ts` 및 인접 Unit/TS/Lint/Next build/Docker smoke, Chromium 8-shard, QA/Owner. 성공 건수 0으로 추정하지 않음.
- **제품 관련 영향**: `PROJECT_ISSUE_DEFAULT_STATUS_FILTER` 런타임 5종, 미설정/잘못된 값 `all`, server-only 정규화, SSR/Client 첫 요청 일치, 사용자 선택 보존, Compose app.environment. API/DB/삭제/KPI·권한 불변.
- **재현**: GitHub Run/Job 로그와 신뢰된 base 검증기 파서의 메타데이터 계약을 대조하여 원인 확정. 로컬 repository 전체 checkout 의존 Node 22/Vitest/Playwright/Docker 실행 환경 미확보(`git ls-remote` 외부 DNS 실패), 로컬 테스트 `NOT TESTED`. 메타데이터 형식은 정규식/Work Packet 파일 정적 점검으로 확인하되 실제 원격 검증 PASS라고 주장하지 않는다.
- **금지/비변경**: QA Preflight, Trusted QA, Required3, policy script, workflow, assertion 완화·skip·timeout/retry 증가, CI 종료권한의 무단 변경 없음.

## 5. 보완 완료 경계 및 후속 새 PR CI

- 수정 대상: GitHub PR 본문(정규 risk/QA/release 선언), Issue #867 본문(AC1..AC8), `docs/exec-plans/active/ISSUE_867.md`(HIGH, 매핑 및 QA 문서 영향), **본 누적 실패 원장 신규**.
- 기준 원본 Head `9eb6ccd84b52eb9618c9cb4fc5a42e8c2deddf6a` / Base `43e97c3a4fd284b09d4c900ff8ab25e7a778c74b`; 신규 후보 SHA는 게시 이후 추적. 임시 object와 정식 PR ref를 구분.
- 리뷰: #868 첫 조회 `unresolved=0`, CODEX review가 원본 Head에 Finding 없음 기록. 보완 후 **최신 Head** thread/mergeability 재조회 필요.
- CI 상태: 기존 `#3463.1 FAIL`, `#3464.1 metadata FAIL`은 원장에 유지; 새 Full PR CI 시작 시 `NOT TESTED`, 완료 결과 모니터링하지 않음.
- 위험/승인: `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`; independent_qa=N/A(Owner-managed), Trusted QA + Owner exact-Head 승인·Required3 별도. `release_required=true`, `release_authorized=false`. Merge/Main/GHCR/Issue 종료 금지.
