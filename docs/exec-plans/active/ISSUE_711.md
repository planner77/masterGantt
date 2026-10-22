# Issue #711 — Test Suite Lifecycle 정책·최초 인벤토리 Work Packet

- **Primary Issue**: [#711](https://github.com/planner77/masterGantt/issues/711) · [요구사항/Acceptance Criteria 원본](https://github.com/planner77/masterGantt/issues/711)
- **ANALYSIS baseline**: `main` SHA `6f9936f353ad6c735af6ca1c33af1a6a4b8ecf7e` (2026-10-23 KST), branch `qa/issue-711-test-lifecycle`, 현재 `package.json` 제품 version **0.129.1 유지**.
- **Phase**: ANALYSIS → PLAN → IMPLEMENTING → DOCUMENTATION_SYNC → PR CI(시작까지만); CI 모니터링·병합·Main·GHCR·Finalizer·이슈 종료는 **비범위**.
- **risk_level=HIGH**: `AGENTS.md`, `docs/ISSUE_LIFECYCLE.md`, `.github/pull_request_template.md` 공통 QA/작업 계약 및 `scripts/` 테스트 인벤토리 CLI 추가. 정책/수집 오류가 QA/리뷰에 영향을 줄 수 있음.
- **qa_method=OWNER_MANAGED, qa_required=true, independent_qa=N/A(Owner-managed; 독립 검토 수행 주장하지 않음), manager_decision=NOT TESTED, MERGE_READY=BLOCKED**.
- **release_required=false; release_authorized=false**. 제품 UI/API/DB·dependency·container/배포·기존 workflow·version 변경 없음.
- **Manager 역할**: 이슈 원본/AC, 위험·승인 경계 및 SOT 단일성; **구현(단일 세션)**: 문서·읽기 전용 inventory CLI·파서 회귀 테스트·PR; **QA**: 정확 Head Required3 및 Main Trusted의 실제 증거 확인은 미래 후속 작업. 별도 Sub-Agent/Reviewer를 실행하지 않았음.
- **Scope**: 신규 테스트 필요성, 유지/통합/폐기/노후/flaky 판정·금지 게이트의 SOT, 현재 파일/명령 정적 Inventory·완전 case discovery 경로, 시범 감사 3종 이상, PR용 기록 필드, 4주/릴리스 점검.
- **Non-scope**: 기존 테스트 삭제·Skip·Quarantine·Assertion/Timeout/Retry 완화, test allocation·8-shard 변경, 추가 Required Check/Rule/PR Gate/Trusted QA, 실제 제품 기능 수정, GHCR 정식 발행·Issue 종료.

## 설계 및 구현 계약

1. **단일 원본**: [`docs/TEST_PLAN.md`](../../TEST_PLAN.md#issue-711--test-suite-lifecycle-추가--검토--유지통합--조건부-폐기)에 Test Suite Lifecycle 판정표·예시·삭제 Gate·정기 점검을 등록. AGENTS/Lifecycle/PR Template은 해당 정책의 짧은 지시 및 연결만 작성.
2. **경계 구분**: [#697](https://github.com/planner77/masterGantt/issues/697) 변경 영향 테스트 선정, [#699](https://github.com/planner77/masterGantt/issues/699) Local Pre-PR, [#704](https://github.com/planner77/masterGantt/issues/704) 동일 Issue 실패 누적, [#437](https://github.com/planner77/masterGantt/issues/437) shard 비용 분배, [#659](https://github.com/planner77/masterGantt/issues/659) CI Fast Gate/Fail Fast는 독립 유지. #711은 **자산의 추가부터 폐기까지**만 관할.
3. **초도 인벤토리**: [`docs/TEST_LIFECYCLE_INVENTORY_711.md`](../../TEST_LIFECYCLE_INVENTORY_711.md)에 main 파일 수 **Vitest 265/E2E 137** 정적 기준을 기록, 케이스 수는 미수집 **UNKNOWN**, 실제 조건부 Job/실행 case 수·실행시간/Flaky 비용은 원격 근거 없으므로 UNKNOWN. 현행 shard count **8**(Issue 작성 당시 6은 과거 사실). 기존 `scripts/verify-test-discovery.mjs`의 discovery와 겹치지 않는 `scripts/test_lifecycle_inventory.py`의 read-only `static/discover`를 제공한다.
4. **수집기 Fail-Closed**: Node Vitest JSON 및 Playwright list 형식/총계/파일 불일치·Policy job 누락·경로 탈출·수집 실패는 nonzero 및 UNKNOWN. `summary.json`, `inventory.csv`, `summary.md` 별도 산출. 유사 Title 후보 자동 탐지는 **CANDIDATE_ONLY**; 중복 확정·리팩터/삭제 자동 없음.
5. **시범 감사**: 권한 보안 unit vs 실제 Browser session, Target #621 vs #623 공통 fixture/다른 mutation·Excel, pre-0025 SQLite migration, Project List vs Task/Resource 검색의 실제 시나리오·독립 assertion을 분리. 분류는 KEEP_UNIQUE / PARTIAL_OVERLAP / RETIRE 거절 / ADD 조건부. 현재 제품 test spec 변경·삭제 0.
6. **운영/롤백**: Owner는 old→new AC/음성/보안/DB/경합·브라우저 coverage 매핑, 정확 source 재검증 PASS, Review 해결 및 위험 승인, 최소 단위 revert를 요구. 이 정책 PR에서 baseline vs after 효율 개선 수치는 NOT MEASURED. 정기 감사 4주 혹은 릴리스 주기.
7. **PR/검증**: `.github/pull_request_template.md`에는 `TEST_LIFECYCLE_REVIEW` 신규/기존 검색·조치·증거·잔여 위험을 짧게 추가. #697 `AC_TEST_COVERAGE` 중복 표 요구 금지. PR은 **Ready**로 생성해서 현재 Full PR CI를 시작하고 CI Run 완료는 모니터링하지 않는다.

## TEST_LIFECYCLE_REVIEW

| 항목 | 내용 |
| --- | --- |
| Changed contract / AC | 회귀 자산 정책 `AC1~AC7`, 실제 제품 기능 계약에는 영향 없음 |
| Existing test search | `scripts/verify-test-discovery.mjs`, `tests/config/vitest.config.ts`, `tests/config/playwright.config.ts`, `tests/server/projects/edit-authorization-security.test.ts`, `tests/e2e/project-edit-authorization.spec.ts`, `tests/e2e/issue-621-resource-target.spec.ts`, `tests/e2e/issue-623-resource-mvp.spec.ts`, `tests/server/db/issue-623-target-migration.test.ts`, `tests/e2e/project-list-search-filter.spec.ts`, `tests/e2e/project-search-filter.spec.ts` 및 Policy Job |
| Decision | 기존 Test `KEEP_UNIQUE`/`PARTIAL_OVERLAP`, 의미 중복 `CANDIDATE_ONLY`, 본 PR 신규 Python CLI 테스트 `ADD`(Fail Closed parser/정적 file vs case 구분), 테스트 삭제/Skip 0 |
| Evidence | main SHA와 파일 목록/원본 시나리오 정적 확인. 새로운 Parser 테스트의 실행 및 같은 HEAD E2E/Policy Required: **NOT TESTED** |
| Residual risk | JSON 출력 버전/CLI 형식 변화, 실제 동적 case 수·Flaky/time Cost 자료 없음. `--mode discover` 실행 실패는 UNKNOWN으로 처리하고 CI PASS로 오인하지 않음. Owner HIGH 판단·Trusted/Required 증거는 향후 |
| Rollback | 신규 CLI/테스트/문서만 revert 가능. 제품 테스트/CI/DB·GHCR/버전 원본에 변경 0 |

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/TEST_LIFECYCLE_INVENTORY_711.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `.github/pull_request_template.md`: UPDATED
- `docs/exec-plans/active/ISSUE_711.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(OWNER_MANAGED, Trusted QA, HIGH 위험 승인 및 exact Head 인수 기준 유지)
- `docs/CI_CD.md`: N/A(기존 8-shard/PR Full-Targeted/Required3/Policy/워크플로 실행 정책 변경 없음)
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
- AC6: `scripts/test_lifecycle_inventory.py`, `tests/python/test_test_lifecycle_inventory.py` parser/비정상 입력·상대 링크 확인 대상. 현 GitHub-only 세션의 Python/Node 실행 **NOT TESTED**; 원격 Required3/Trusted/실제 전체 case 결과는 **NOT TESTED**.
- AC7: `.github/workflows/ci.yml`, 8 shard matrix, Required3/Full/Targeted/Docs-only, GHCR·Finalizer/Owner 승인 코드를 변경하지 않음. 시간/비용 개선은 미측정 **NOT TESTED**.

## 사전 검증·인계

- GitHub 원본 `main`·Issue·AGENTS·QA/CI/Lifecycle·Policy/Playwright/Vitest 설정을 조회해 역할과 위험도를 확인했고 기존 제품 test·workflow/버전 변경은 계획하지 않았다.
- GitHub-only 연결에서 Node/Python/browser/Docker 직접 실행, 문서 상대 링크 검증 CLI, Vitest/Playwright 동적 case 수집은 **NOT TESTED**(원격 PR Policy/Quality의 실제 출처가 나오기 전 PASS 주장 금지).
- PR에서 현재 main과 변경된 파일 수·리뷰 스레드/충돌 확인 및 Head/Base/Test-Merge·Required3/Trusted QA 증거를 후속 평가한다. 이 요청은 **PR CI 시작 후 모니터링 중단**이며 병합·Main CI·GHCR·Finalizer·이슈 종료는 금지한다.
