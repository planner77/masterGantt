# Issue #711 — Test Suite Lifecycle 정책·최초 인벤토리 Work Packet

- **Primary Issue**: [#711](https://github.com/planner77/masterGantt/issues/711) · [요구사항/Acceptance Criteria 원본](https://github.com/planner77/masterGantt/issues/711)
- **ANALYSIS baseline**: `main` SHA `6f9936f353ad6c735af6ca1c33af1a6a4b8ecf7e` (2026-10-23 KST), branch `qa/issue-711-test-lifecycle`. 시작 당시 version `0.129.1`; 최신 `main`(#762 병합) 정렬 이후 **0.130.0 유지**(앱 version 변경 금지).
- **Phase**: ANALYSIS → PLAN → IMPLEMENTING → DOCUMENTATION_SYNC → PR CI(시작까지만); CI 모니터링·병합·Main·GHCR·Finalizer·이슈 종료는 **비범위**.
- **risk_level=HIGH**: `AGENTS.md`, `docs/ISSUE_LIFECYCLE.md`, `.github/pull_request_template.md` 공통 QA/작업 계약 및 `scripts/` 테스트 인벤토리 CLI 추가. 정책/수집 오류가 QA/리뷰에 영향을 줄 수 있음.
- **qa_method=OWNER_MANAGED, qa_required=true, independent_qa=N/A(Owner-managed; 독립 검토 수행 주장하지 않음), manager_decision=NOT TESTED, MERGE_READY=BLOCKED**.
- **release_required=false; release_authorized=false**. 제품 UI/API/DB·dependency·container/배포·기존 workflow·version 변경 없음.
- **Manager 역할**: 이슈 원본/AC, 위험·승인 경계 및 SOT 단일성; **구현(단일 세션)**: 문서·읽기 전용 inventory CLI·파서 회귀 테스트·PR; **QA**: 정확 Head Required3 및 Main Trusted의 실제 증거 확인은 미래 후속 작업. 별도 Sub-Agent/Reviewer를 실행하지 않았음.
- **Scope**: 신규 테스트 필요성, 유지/통합/폐기/노후/flaky 판정·금지 게이트의 SOT, 현재 파일/명령 정적 Inventory·완전 case discovery 경로, 시범 감사 3종 이상, PR용 기록 필드, 4주/릴리스 점검.
- **Non-scope**: 테스트 삭제·Skip·Quarantine·Assertion/Timeout/Retry 완화, shard/Required Check/PR Gate/Trusted QA 변경, 제품 기능 수정, GHCR 발행·Issue 종료. 단, 동일 실제 SQLite/HTTP test의 초기 준비 분리 및 기존 Policy Job의 수집기 Python unit 한 단계 **추가**는 F711-001 REWORK로 허용.

## 설계 및 구현 계약

1. **단일 원본**: [`docs/TEST_PLAN.md`](../../TEST_PLAN.md#issue-711--test-suite-lifecycle-추가--검토--유지통합--조건부-폐기)에 Test Suite Lifecycle 판정표·예시·삭제 Gate·정기 점검을 등록. AGENTS/Lifecycle/PR Template은 해당 정책의 짧은 지시 및 연결만 작성.
2. **경계 구분**: [#697](https://github.com/planner77/masterGantt/issues/697) 변경 영향 테스트 선정, [#699](https://github.com/planner77/masterGantt/issues/699) Local Pre-PR, [#704](https://github.com/planner77/masterGantt/issues/704) 동일 Issue 실패 누적, [#437](https://github.com/planner77/masterGantt/issues/437) shard 비용 분배, [#659](https://github.com/planner77/masterGantt/issues/659) CI Fast Gate/Fail Fast는 독립 유지. #711은 **자산의 추가부터 폐기까지**만 관할.
3. **초도 인벤토리**: [`docs/TEST_LIFECYCLE_INVENTORY_711.md`](../../TEST_LIFECYCLE_INVENTORY_711.md)에 main 파일 수 **Vitest 265/E2E 137** 정적 기준을 기록, 케이스 수는 미수집 **UNKNOWN**, 실제 조건부 Job/실행 case 수·실행시간/Flaky 비용은 원격 근거 없으므로 UNKNOWN. 현행 shard count **8**(Issue 작성 당시 6은 과거 사실). 기존 `scripts/verify-test-discovery.mjs`와 겹치지 않는 read-only `static/discover`를 제공한다. 초기 Code Review P2에 따라 현재 Policy Job **모든 run step(단축형/블록 포함)**과 조건·unknown/empty Fail Closed를 보장한다.
4. **수집기 Fail-Closed**: Node Vitest JSON 및 Playwright list 형식/총계/파일 불일치·Policy job 누락·경로 탈출·수집 실패는 nonzero 및 UNKNOWN. `summary.json`, `inventory.csv`, `summary.md` 별도 산출. 유사 Title 후보 자동 탐지는 **CANDIDATE_ONLY**; 중복 확정·리팩터/삭제 자동 없음.
5. **시범 감사**: 권한 보안 unit vs 실제 Browser session, Target #621 vs #623 공통 fixture/다른 mutation·Excel, pre-0025 SQLite migration, Project List vs Task/Resource 검색의 실제 시나리오·독립 assertion을 분리. 분류는 KEEP_UNIQUE / PARTIAL_OVERLAP / RETIRE 거절 / ADD 조건부. 현재 제품 test spec 변경·삭제 0.
6. **운영/롤백**: Owner는 old→new AC/음성/보안/DB/경합·브라우저 coverage 매핑, 정확 source 재검증 PASS, Review 해결 및 위험 승인, 최소 단위 revert를 요구. 이 정책 PR에서 baseline vs after 효율 개선 수치는 NOT MEASURED. 정기 감사 4주 혹은 릴리스 주기.
7. **PR/검증**: `.github/pull_request_template.md`에는 `TEST_LIFECYCLE_REVIEW` 신규/기존 검색·조치·증거·잔여 위험을 짧게 추가. #697 `AC_TEST_COVERAGE` 중복 표 요구 금지. PR은 **Ready**로 생성해서 현재 Full PR CI를 시작하고 CI Run 완료는 모니터링하지 않는다.

## TEST_LIFECYCLE_REVIEW

| 항목 | 내용 |
| --- | --- |
| Changed contract / AC | 회귀 자산 정책 `AC1~AC7`, 실제 제품 기능 계약에는 영향 없음 |
| Existing test search | `scripts/verify-test-discovery.mjs`, `tests/config/vitest.config.ts`, `tests/config/playwright.config.ts`, `tests/server/projects/edit-authorization-security.test.ts`, `tests/e2e/project-edit-authorization.spec.ts`, `tests/e2e/issue-621-resource-target.spec.ts`, `tests/e2e/issue-623-resource-mvp.spec.ts`, `tests/server/db/issue-623-target-migration.test.ts`, `tests/e2e/project-list-search-filter.spec.ts`, `tests/e2e/project-search-filter.spec.ts` 및 Policy Job |
| Decision | 기존 Test `KEEP_UNIQUE`/`PARTIAL_OVERLAP`, 의미 중복 `CANDIDATE_ONLY`, Python 수집기 양성/음성 `ADD`(Policy 검증 자체를 CI Policy Job에 추가). #729 file-backed SQLite/HTTP 수용 test는 준비와 실제 assertion budget을 분리하는 안정화 `EXTEND`; 삭제/Skip/Timeout 증가 0 |
| Evidence | main SHA와 파일 목록/원본 시나리오 정적 확인. 새로운 Parser 테스트의 실행 및 같은 HEAD E2E/Policy Required: **NOT TESTED** |
| Residual risk | JSON 출력 버전/CLI 형식 변화, 실제 동적 case 수·Flaky/time Cost 자료 없음. `--mode discover` 실행 실패는 UNKNOWN으로 처리하고 CI PASS로 오인하지 않음. Owner HIGH 판단·Trusted/Required 증거는 향후 |
| Rollback | 신규 CLI/테스트/문서만 revert 가능. 제품 테스트/CI/DB·GHCR/버전 원본에 변경 0 |

## REWORK — PR #781 Full #3169.1, F711-001 (2026-10-23 KST)

- 원본 PR HEAD `ef7db449356d661a3fb3a23b12f9fbbef75b4886` / base `6f9936f353ad6c735af6ca1c33af1a6a4b8ecf7e` / [Full Run ID 39857347455 attempt 1](https://github.com/planner77/masterGantt/actions/runs/39857347455). **Vitest 1 FAIL**는 `tests/server/resources/wbs-dashboard-views-http.test.ts:212`의 기본 5s timeout, 3178 PASS·3 SKIP. 기존 #729 실제 SQLite/HTTP 계약이 느린 초기 disk migration/seeding과 첫 스냅샷을 5초 단일 callback에 포함. 정확 구간·CPU contention 원인은 증거 없어 UNKNOWN.
- 테스트를 실제 file-backed DB, 서버·초기 HTTP 준비 `beforeAll`과 재오픈+동일 HTTP/WorkArea/Assignment 단언 `it`으로 분리. 원래 테스트 케이스 수와 모든 assertion을 보존, global/per-test timeout 증대·skip/fixture mock 없음. 이전 결과 PASS 주장은 금지.
- [P2 Reviewer](https://github.com/planner77/masterGantt/pull/781#discussion_r4353727564) Policy command 누락: `- run:`/블록/임의 validator까지 조건 포함한 소스 목록으로 변경, 이름 필터 제거, fail-closed Parser test 추가, CI Policy Job에 해당 Python unittest 한 단계 추가(기존 Required3/8 shard 불변).
- QA Preflight·TypeScript·ESLint·Policy는 지난 HEAD PASS, PR Fast Gate/Required3/QA 실패는 Vitest 실패 전파·미해결 리뷰(1) 포함, E2E8/Docker/Build는 **SKIPPED_NOT_TESTED**. 실패 전체 원본·파생·교정·잔여 위험: [원장 F711-001](../../ISSUE_711_FAILURE_ANALYSIS.md).
- `main`은 Issue #762 병합 `56c7cfb96dbb97095e51606e9639cf4dc3fced36`으로 전진. 정렬 시 최신 main 제품 v0.130.0/DB 0030·기존 docs/TEST_PLAN 22라인 및 기타 변경을 보존하고 새 Head PR CI를 실행해야 한다. 리뷰 스레드는 코드 교정→실제 응답→Resolve 순서, Merge/Finalizer는 이번 요청 제외.
- Local GitHub-connector 환경: Python/Node/Vitest/Docker 실제 실행 및 현 HEAD 정확 SHA CI·Trusted는 **NOT TESTED**(원격 신규 PR CI 시작 전). `TEST_LIFECYCLE_REVIEW` 추가 테스트: Python 단축형/블록/조건/unknown/empty, #729 실제 SQLite persisted reopen 및 전체 25 테스트, 영향 #762 새 migration/DB path, 전체 required3.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/TEST_LIFECYCLE_INVENTORY_711.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `.github/pull_request_template.md`: UPDATED
- `docs/exec-plans/active/ISSUE_711.md`: UPDATED
- `docs/ISSUE_711_FAILURE_ANALYSIS.md`: UPDATED
- `.github/workflows/ci.yml`: UPDATED (Policy Job additive Python unit; Required3/8-shard/집계 의미 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A(OWNER_MANAGED, Trusted QA, HIGH 위험 승인 및 exact Head 인수 기준 유지)
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(브랜치 PR CI 자동 실행, 리뷰 승인·Main/GHCR/Finalizer 운영 계약 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 Run 증거 기준 및 기존 테스트 실행 방식 변경 없음)
- `docs/AGENT_PROMPTS.md`: N/A(작업 패킷 필수 필드는 변경하지 않고 Test Lifecycle 리뷰는 안내 링크로 제공)
- `DESIGN.md`: N/A(시각 컴포넌트·UI 동작·표시 변경 없음)
- `docs/API.md`: N/A(HTTP 및 DTO 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite 스키마·Migration 변경 없음)
- `docs/DEPLOYMENT.md`: N/A(컨테이너/운영 환경·배포 방법 불변)
- `CHANGELOG.md`: N/A(애플리케이션 기능·SemVer 릴리스 변경 없음)

## AC_TEST_COVERAGE

- AC1: `docs/TEST_PLAN.md` 판정표로 ADD/EXTEND/KEEP_UNIQUE/PARTIAL_OVERLAP/STALE/FLAKY/RETIRE, positive/negative 및 보호 조치 명시; 실제 QA 의미 검토 NOT TESTED.
- AC2: AGENTS/Lifecycle/PR Template ↔ TEST_PLAN 단일 원본 링크 및 #697/#699/#704/#437/#659 독립 역할 표, 독립 CI 정책 미수정으로 확인; GitHub 정적 비교 대상.
- AC3: main 기준 E2E **137 files**/Vitest **265 files**, Policy Job 명령 별도; parser `static/discover`, `inventory.csv`·`summary.json`으로 file/test case 구분. **실수집 case 수 및 Policy 동적 실행 수 UNKNOWN(증거 없으므로 미완료)**.
- AC4: `docs/TEST_LIFECYCLE_INVENTORY_711.md`에서 권한/브라우저·DB migration 폐기 거절, #621/#623 공통 fixture 부분 통합 후보, 신규 schema/권한 negative 예시를 AC 영향과 연결; 코드는 삭제·변경하지 않음.
- AC5: 삭제 전 old/new AC·보안/실제 DB/브라우저/경합 커버리지, 같은 source PASS, 리뷰/Owner 승인·롤백·Flaky 임시 격리 기준을 TEST_PLAN에 기록; Required bypass/skip/assertion 완화 0.
- AC6: `scripts/test_lifecycle_inventory.py`, `tests/python/test_test_lifecycle_inventory.py`의 완전 Policy run step/빈블록·미상 명령 음성과 경로 검증, 기존 Policy Job에서 신규 Python unittest 실행. 신규 Head의 원격 Test/Required3/Trusted는 **NOT TESTED**(실제 RUN 전).
- AC7: `.github/workflows/ci.yml` Policy Job에 재현 가능한 unittest **검사 1단계만 추가**, 8 shard matrix/Required3/Full/Targeted/Docs-only/GHCR·Finalizer/Owner 승인 코드 및 집계 불변. 효과 미측정 **NOT TESTED**.

## 사전 검증·인계

- GitHub 원본 `main`·Issue·AGENTS·QA/CI/Lifecycle·Policy/Playwright/Vitest 설정을 조회해 역할과 위험도를 확인했고 기존 제품 test·workflow/버전 변경은 계획하지 않았다.
- GitHub-only 연결에서 Node/Python/browser/Docker 직접 실행, 문서 상대 링크 검증 CLI, Vitest/Playwright 동적 case 수집은 **NOT TESTED**(원격 PR Policy/Quality의 실제 출처가 나오기 전 PASS 주장 금지).
- PR에서 현재 main과 변경된 파일 수·리뷰 스레드/충돌 확인 및 Head/Base/Test-Merge·Required3/Trusted QA 증거를 후속 평가한다. 이 요청은 **PR CI 시작 후 모니터링 중단**이며 병합·Main CI·GHCR·Finalizer·이슈 종료는 금지한다.

## 2026-10-23 · #737 main 정렬 (PR CI 재시작 인계)

- 새로운 main SHA: `744f64fa8d79c3b18896a6aab0dfbe28174814f4` (#737, PR #782). 기존 PR Head `116375357c19263d41c3d0102c05ebea9c41c8ce`와의 2커밋 차이 확인. 이전 #762 기준 `0.130.0` 제품 version 유지, #737 추가 2개 Vitest 파일 및 Chromium E2E 1개 파일과 전체 신규 코드/문서를 보존.
- 공유 수정 문서 `docs/CI_CD.md`와 `docs/TEST_PLAN.md`는 *#711 앞부분+최신 main 본문* 방식으로 손실 없는 정렬; 기타 #711 전용 파일은 동일 내용 유지. 코드 리뷰 P2 해결, 미해결 스레드=0 (동기화 전 조회).
- 이전 정확 HEAD의 [Full #3171.1](https://github.com/planner77/masterGantt/actions/runs/39862589326) Quality/E2E8/Docker 및 [Trusted #815.1](https://github.com/planner77/masterGantt/actions/runs/39865838088) 성공은 immutable 과거 기록. 새 Head와 최신 base의 Required3/Trusted/Manager ACCEPT는 **NOT TESTED**.
- REWORK 판단: 새로운 기능을 추가하지 않고 Main 동기화/문서 원장 갱신만 수행. `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=false`, `release_authorized=false`. 실제 PR CI synchronize 트리거 확인까지만 하고 모니터링/병합/Main/GHCR/Finalizer/Issue 종료 금지.
- 실패·교정 누적 증거: [단일 #711 실패 원장](../../ISSUE_711_FAILURE_ANALYSIS.md). 초도 Inventory와 현재 수치의 시간·source 경계를 [인벤토리](../../TEST_LIFECYCLE_INVENTORY_711.md)에 유지.
