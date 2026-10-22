# Issue #711 — PR CI 누적 실패 원장

- Primary Issue: [#711](https://github.com/planner77/masterGantt/issues/711) · PR: [#781](https://github.com/planner77/masterGantt/pull/781)
- 운영 기준: [PR CI 실패 누적 분석](PR_CI_FAILURE_TRIAGE.md), [Test Lifecycle](TEST_PLAN.md), [Work Packet](exec-plans/active/ISSUE_711.md)
- 기록 시각: 2026-10-23 KST. 최초 기록이며 원본 실패를 이후 PASS로 소급하지 않음.
- qa_method=OWNER_MANAGED, risk_level=HIGH, qa_required=true; 현재 Manager ACCEPT / 정확 새 Head Required3·Trusted QA = **NOT TESTED**.

## 1. 원본 PR Run / Attempt 전체 목록

| ID | 출처/불변 source | 정확한 직접 실패 | 나머지 Job / 판정 |
| --- | --- | --- | --- |
| F711-001 | [Full PR #3169.1](https://github.com/planner77/masterGantt/actions/runs/39857347455), Run `39857347455`, attempt1, pull_request, PR #781, Head `ef7db449356d661a3fb3a23b12f9fbbef75b4886`, base `6f9936f353ad6c735af6ca1c33af1a6a4b8ecf7e` | [Vitest Job `120099124900`](https://github.com/planner77/masterGantt/actions/runs/39857347455/job/120099124900) 1 FAIL: `tests/server/resources/wbs-dashboard-views-http.test.ts:212`, `AC1/4 persisted explicit process0 and multiWorkAreas retain snapshot/exact HTTP details after reopen`, **5,000ms test timeout** | 263 test files PASS/1 failed/1 skipped; **3,178 tests PASS, 1 FAIL, 3 SKIP**. QA Preflight, Policy, TypeScript, ESLint PASS; Fast Gate FAIL, Build/E2E8/Docker 실제 구현 **SKIPPED**, Required3 집계 FAIL, QA Final 파생 FAIL. 원본 출처 보존 |
| Review711-001 | [PR #781 review thread](https://github.com/planner77/masterGantt/pull/781#discussion_r4353727564), 최초 Head `ef7db449...`, P2 | `scripts/test_lifecycle_inventory.py` Policy 수집에서 `- run:`/블록 스크립트 및 미열거 명령 누락; **수집기 의미 결함** | 원본 `CI Policy` job 자체는 PASS — 이 결함을 CI 실패 2건으로 과대 계수하지 않음. 리뷰 해결 전 merge 차단 |

## 2. 누적 실패 파일 합집합과 파생 실패

- **원본 테스트 직접 FAIL:** `tests/server/resources/wbs-dashboard-views-http.test.ts`의 **SQLite 파일 신규 생성 → 실제 DB schema/migration/fixture 구축 → HTTP snapshot → DB close/reopen → HTTP 보존 단언** 케이스 한 건.
- **별도 코드 리뷰 결함:** `scripts/test_lifecycle_inventory.py`의 `POLICY_RUN` 정규식이 `- run:`을 인식하지 않고, 승인된 일부 명령 문자열만 선정하므로 누락된 인벤토리 성공이 발생할 수 있음. `tests/python/test_test_lifecycle_inventory.py`의 기존 검사는 해당 음성을 커버하지 못함.
- **파생 결과:** PR Fast Gate, Required Quality/E2E/Docker aggregate, QA Final. E2E 8개 및 Docker 구현을 실제 실패로 세지 않는다.
- **비실패 원본:** Policy·TypeScript·ESLint·QA Preflight의 성공은 동결된 과거 Head 증거이며 후속 Head PASS를 증명하지 않는다.
- #729 기존 [실패 원장](ISSUE_729_FAILURE_ANALYSIS.md)의 Main Trace F-001 및 Preflight 문서 F-002는 다른 원인·다른 Run. 이번 Timeout을 #729의 과거 기록으로 소급하거나 문제 증거로 추측하지 않음.

## 3. 원인 분류와 보완

### F711-001 · 테스트 5초 예산 소진

- **관측 근거:** Vitest 원본 25-test 파일 약 8.1초, 실제 이 케이스 한 건 `Test timed out in 5000ms`; 최초 실패는 이 테스트. 파일과 fixture 소스는 PR 기준 main에서 동일했으며 신규 #711 인벤토리 테스트의 실패는 아님. CI 병렬 부하가 주된 원인인지는 환경 계측이 없으므로 **UNKNOWN**.
- **작업 구조:** 실디스크 SQLite 초기 seed/migration·첫 HTTP snapshot·DB 재열기와 assertion을 하나의 5초 test callback에 누적했음. 비효율의 정확한 세부 단계별 시간은 측정되지 않았으며 UI/API 제품 결함 또는 flaky라고 확정하지 않는다.
- **보완:** 같은 파일의 단일 persistence 사례를 `beforeAll` 준비 단계(실제 파일-backed SQLite + HTTP snapshot)와 5초 제한을 유지하는 `it` 본문(DB 재열기/동일 snapshot·WorkArea·exact details 전부 단언)으로 분리. 실디스크/migration·진짜 HTTP/SQLite·snapshot/assignment/WorkArea 보존 검증 유지; 글로벌 timeout, assertion, retry, skip, Required Gate 변경 없음. setup 비용 자체 또는 속도 개선은 **NOT MEASURED**.
- **교차·음성 범위:** 동일 파일의 25개 테스트(동일한 진짜 fixture/server와 authorization, stale/revision, detail/scope), `tests/server/db/issue-623-target-migration.test.ts` 무손실·재오픈, 전체 Vitest, TypeScript와 Policy/Markdown, PR8 E2E/Docker; 새로운 정확 Head 실제 실행 전 **NOT TESTED**.

### Review711-001 · Policy 선언 인벤토리 누락

- **확정 원인:** Policy Job의 `- run:` 단축 YAML, `run: |` 여러 shell 명령, 새 검증기 이름을 허용 목록으로 필터하여 정적 성공 보고가 실제 Job 명령을 축소. 검증 명령·시험 방법의 의미 중복은 자동 판단 대상이 아님.
- **보완:** `scripts/test_lifecycle_inventory.py`의 Job step 파서가 `- run:`·`run:`·블록 원문을 **이름 무관하게 전부** 수집하고 Job/Step 조건·실행하지 않은 선언임을 기록. 알 수 없거나 빈 명령을 누락/0건으로 처리하지 않고 `InventoryError`로 fail-closed. `tests/python/test_test_lifecycle_inventory.py`에 직렬/블록/조건/알 수 없는 이름/빈 스크립트 음성 추가.
- **CI 정책 통제:** 기존 Policy Job에 신규 Python 파서 검사 한 단계만 **추가**. 기존 3 Required/8 Chromium shard/PR Fast/Targeted·Main/Trusted/GHCR·Owner 승인 기준 유지. 수집기 output은 실행/성공을 증명하지 않는다.

## 4. Main 정렬·새 PR 검증 경계

- 최초 PR은 base `6f9936f...`에 대해 열렸지만 `main`에 Issue #762 병합 `56c7cfb...` 등이 추가됨. 동시 `main` 변경 특히 `docs/TEST_PLAN.md`의 기존 **22줄 신규 문서**를 잃지 않는 병합 정렬 필수.
- 정렬은 소스 새 커밋에서 원본 main과 우리 Issue 파일을 모두 보존하며 `docs/TEST_PLAN.md`는 이전 전체 정책과 최신 main 추가문 모두 유지해야 함. 원본 작업 및 실패 원장 SHA/Runs 불변.
- 리뷰 [P2 thread](https://github.com/planner77/masterGantt/pull/781#discussion_r4353727564)은 수정 검증과 해당 thread 회신 후 resolved 처리. 미해결 0/충돌 0 확인 전 Merge 금지.
- 정적/로컬 파서 음성·문서 경로 검사와 remote Full PR CI 결과는 서로 분리한다. **새 PR CI 시작까지만**; 모니터링, 재재실행, 병합, Main/GHCR/Finalizer/Issue close는 별도 지시 전 금지.

## 5. 2026-10-23 · #737 main 정렬 / 신규 Full PR CI 재진입 (신규 실패 아님)

- **이전 Run 불변 기록**: [PR #781 Full #3171.1](https://github.com/planner77/masterGantt/actions/runs/39862589326), run `39862589326`, attempt `1`, pull_request, PR Head `116375357c19263d41c3d0102c05ebea9c41c8ce`, 당시 base `56c7cfb96dbb97095e51606e9639cf4dc3fced36`는 **SUCCESS**. 해당 source의 `Build, static checks, and unit tests`, `Chromium end-to-end tests` (8/8), `Docker build and runtime smoke test`, `QA Final — Automated` 모두 SUCCESS. [기본 브랜치 QA Final — Trusted #815.1](https://github.com/planner77/masterGantt/actions/runs/39865838088), run `39865838088`도 **SUCCESS**. 이 사실은 실패 F711-001의 결과를 변경하지 않는다.
- **새 base**: 이후 #737 [PR #782](https://github.com/planner77/masterGantt/pull/782)의 병합으로 `main=744f64fa8d79c3b18896a6aab0dfbe28174814f4` (이전 branch 대비 2 commit behind). #737은 `docs/TEST_PLAN.md`, `docs/CI_CD.md` 두 문서를 함께 수정하고 새로운 `tests/e2e/issue-737-target0-acceptance.spec.ts`, `tests/server/projects/issue-737-preservation.test.ts`, `tests/server/resources/issue-737-cross-feature-acceptance.test.ts`를 추가한다.
- **정렬·보존 정책**: #711 변경 12개 파일을 현재 main Git Tree에 적용하되, 겹치는 문서 두 건은 #711 고유 신규 절과 #737의 전체 최신 본문을 조합한다. 최신 `main` 제품/DB/API/로그/테스트/Shard/기존 문서 내용을 버리지 않는다. `AGENTS.md` 및 실패 원장·Work Packet·현재 QA 정책에 따라 테스트 삭제/timeout·retry·assertion/Required3 완화, 자동 release 권한 확대 없음.
- **리뷰·충돌 사전 확인**: [PR #781 P2](https://github.com/planner77/masterGantt/pull/781#discussion_r4353727564) 회신 후 `resolved=true`; 신규 미해결 스레드 **0건**. `main`과의 차이는 두 문서 내용 보존으로 해결. 새 Git Head에서 ancestry/compare 및 PR `mergeable`을 다시 확인한다.
- **정확 새 Head 증거**: 최신 main 정렬로 PR test-merge source가 변경되므로 #3171.1 및 Trusted #815.1은 **새 Head의 승인 증거가 아님**. 새로운 `pull_request synchronize` Full CI를 **시작만** 하고, Required 3종/Trusted QA 및 최종 Owner HIGH 위험 수용은 모두 새 Run 관측 전 **NOT TESTED**. 병합/Main CI/GHCR/Finalizer/Issue 종료 진행 안 함.
