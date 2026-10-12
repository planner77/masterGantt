# Issue #633 — B2 재발행·원본 미발행 폐기 Work Packet (2026-10-12)

## 실행 정책

- Primary Issue #633; 신규 PR 범위: `scripts/release_debt_recovery.py`, trusted Generic Finalizer와 Resume Owner 재개, GHCR 읽기 전용 inventory 자동 기동, 교정 SemVer 후보 `0.106.1`, negative/positive fixtures·문서 동기화.
- 기준 main `f839ad01cd395004e623ae171f1684cfc49e482e`; branch `fix/issue-633-b2-release-recovery`.
- `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `manager_decision=NOT TESTED`, `release_required=true`, `release_authorized=false` (실제 exact SHA/버전별 Owner marker·인증된 레지스트리 실감사 전 게시 금지).
- B2는 #550의 v0.105.0 / #615의 v0.106.0을 **정식 발행한 적 없는 버전으로 승인하에 폐기**하며, 새 `v0.106.1`은 현재 수정된 main 코드를 대상으로 후보 제작. 이전 실패 CI를 PASS로 변경하거나 오래된 immutable SemVer tag를 덮어쓰지 않는다.
- 본 PR의 CODE/POLICY 자체 변경은 Trusted main QA 검증기의 자기 승인으로 취급하지 않는다. exact HEAD required CI PASS, 미해결 리뷰 0, Owner HIGH 잔여 위험 수용과 별도의 v2 승인 원장이 모두 필요하다.
- 감사 자동 실행은 Main CI 성공 후 read-only `INVENTORY_ONLY_NOT_RELEASE_AUTHORIZED`; Owner 승인 대상 main SHA가 고정된 뒤에만 B2 reissue mutation 경로를 열 수 있다. default main 외 PR 소스 실행 없음.

## DOCUMENTATION_SYNC

- `AGENTS.md`: N/A(기존 Owner·Release/Fail-closed 계약 유지, 상세 운영 문서에서 새 B2 제한만 정의)
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/ISSUE_633_RELEASE_DEBT.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_633.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `.github/workflows/ci.yml`: UPDATED
- `.github/workflows/release-debt-audit.yml`: UPDATED
- `.github/workflows/release-finalizer.yml`: UPDATED
- `.github/workflows/release-finalizer-resume.yml`: UPDATED
- `scripts/release_debt_audit.py`: UPDATED
- `scripts/release_debt_recovery.py`: UPDATED
- `scripts/test-release-debt-recovery.py`: UPDATED
- `scripts/auto_release_finalizer.py`: UPDATED
- `scripts/verify-issue-lifecycle.py`: UPDATED
- `DESIGN.md`: N/A(사용자 UI 변경 없음)
- `docs/API.md`: N/A(제품 HTTP API 변경 없음; GitHub Actions REST 내부만 사용)
- `docs/DB_SCHEMA.md`: N/A(SQLite migration 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(Gantt 일정 알고리즘 계약 변경 없음)

## AC_TEST_COVERAGE

- AC1: 기존 #550 Main #2515 FAIL, #615 Main #2526 FAIL 및 #628/#632/#634 성공 SHA/digest를 감사 fixture에 고정하고 trusted `--inventory-only` Git tag/Release/Private GHCR 상태를 별도 실조회.
- AC2: `test-release-debt-recovery.py`의 구버전 승인 철회, B2 Owner exact SHA·PR·version 인증, 타인 marker·stale·revoked negative. 신규 v0.106.1 marker는 exact merge SHA 이후에만 생성.
- AC3: 기존 `verify-issue-lifecycle.py` #615/closed/doc-only/unissued fail-closed와 새 `plan_b2`의 다섯 역사적 SHA만 승인된 특별 예외. 일반 자동 cross-Issue 승계 금지.
- AC4: `finalize_b2`는 신규 Main CI·GHCR candidate 검증, exact immutable formal Release SUCCESS, 실 digest 동일 뒤 old branches/candidates/RETIRE marker/Issue close 처리; Readiness≠Release, RELEASE in-progress는 BLOCKED.
- AC5: QA/GENERIC_FINALIZER/CI_CD/GITHUB_OPERATIONS/REMOTE_VALIDATION/TEST_PLAN/PLAN/CHANGELOG 및 package/lock 버전 동기화; 기존 #628/#586/#344/#595/#593 PR CI 회귀 및 신규 fixtures.
- AC6: `release-finalizer.yml`의 Owner issue_comment 트리거와 main trusted checkout, GHCR 인증·권한/기존 Required3와 concurrency 유지, 별도 one-shot workflow/Ruleset 완화 없음. 실제 trusted Actions / GHCR는 최신 Main 반영 후 따로 판정.

## 확인·복구 순서

1. exact-head PR CI 3 Required PASS, Trusted QA 및 리뷰 스레드 해결. B2 rollback/안전 조건 검토 후 Owner가 병합을 허가해야 한다.
2. Merge SHA/Main CI 성공 후 자동 read-only GHCR 감사 로그에서 구버전 exact tag 2개의 **ABSENT**를 확인한다.
3. 원본 #550/#615의 기존 version-scoped 발행 승인 각각 `authorized=false`로 철회, Issue #633에 새 v0.106.1 독립 Release 승인과 exact SHA scoped B2 marker를 신규 Owner comment로 기록한다.
4. Trusted generic Finalizer 재기동 → v0.106.1 annotated tag/Release CI/digest promotion → Resume → 구 버전 safely retired/cleanup/Issue 종료를 검증한다.
5. Registry/Git 태그 UNKNOWN/PRESENT, CI non-success, PR branch cleanup 실패, RuleSet/Trusted 오류가 발생하면 FAIL-CLOSED하고 원본 원장을 보존한다.

## 잔여 위험 / Rollback

- 원격 GitHub/GHCR 실제 실행·SBOM/provenance/Issue close는 **현재 NOT TESTED**; 로컬 fixture/PR 성공으로 소급 PASS하지 않는다.
- 새 feature package version `0.106.1`은 후보이며 이미 임의로 tag 생성하지 않는다. Owner의 원본 승인 marker를 다른 버전으로 재사용하지 않는다.
- Release 이전: 변경 PR revert하여 기존 Generic oldest-first Fail-closed 복구. 정식 Release 이후: tag를 덮어쓰지 않고 새로운 교정 SemVer로만 roll forward 한다.

## PR CI #2559.1 / 리뷰 P1 후속 보완 (2026-10-12)

- [Run #2559.1](https://github.com/planner77/masterGantt/actions/runs/38199684645): QA Preflight, 정책/품질/Vitest/ESLint/TypeScript/Next.js, Chromium 6/6 shard 및 Docker Required aggregate 전부 SUCCESS; `QA Final — Automated`만 미해결 리뷰 2건 때문에 BLOCKED. 원본 CI conclusion FAILURE와 두 리뷰의 감사 기록을 보존한다.
- 리뷰 P1 #4244416867: private GHCR은 `packages: read` 선언만으로 Docker 인증되지 않는다. pinned `docker/login-action` 및 기존 `GITHUB_TOKEN`으로 `ghcr.io`에 로그인한 뒤 `imagetools inspect` 실행한다. permissions/registry mutation 추가 없음.
- 리뷰 P1 #4244416874: Git/GitHub Release tag는 `v0.106.0`, GHCR 이미지 exact tag는 `0.106.0`. 감사 조회를 unprefixed SemVer로 수정하고, 이미 발행된 exact digest를 ABSENT로 오판하면 반드시 차단한다. 승인 오류·모호한 HTTP 404를 `UNKNOWN`으로 분류한다.
- `scripts/test-release-debt-audit.py`에 private GHCR exact tag·digest/unauthorized/404/manifest unknown 분류 fixture 추가; `verify-issue-lifecycle.py`에 audit workflow registry 인증·권한·순서 static contract 추가. 새 exact Head에서 PR CI 재검증. Trusted QA/Owner 위험 수용·정식 게시 승인은 별도다.

# Issue #633 — 교차 병합 미발행 릴리스 부채 감사 Work Packet

## 작업 범위와 검증 경계

- Issue: [#633](https://github.com/planner77/masterGantt/issues/633); PR: [#634](https://github.com/planner77/masterGantt/pull/634).
- 위험도: HIGH / qa_method: OWNER_MANAGED / qa_required: true / Manager ACCEPT: NOT TESTED.
- Base main: `d69749753fb9db002232d92d51446237a0fe042d` (초기 기준, PR 재정렬 시 확인); branch: `fix/issue-633-cross-issue-release-debt-audit`.
- 범위: #550 v0.105.0와 #615 v0.106.0의 실패·성공 SHA 및 버전·tag/Release/registry evidence 감사; read-only trusted main 수동 검증; 교차 Issue 자동 승계 차단의 회귀 방어; Owner exact-version 재발행 승인 구조 및 정책 문서.
- 비범위: 미발행 버전의 실제 폐기/승계 원장 mutation, 정식 GHCR tag/digest promotion, 기존 Finalizer 허용 범위 확대, Release CI/Ruleset/Required Check 완화, Issue close.
- release_required=false (이번 감사 PR은 기존 애플리케이션 0.106.0 유지). release_authorized=false. #550/#615의 별도 버전별 실제 정식 게시 의무는 계속 보류.
- 구현: `scripts/release_debt_audit.py`의 읽기 전용 상태 판정, `scripts/test-release-debt-audit.py`의 synthetic positive/negative fixtures, `scripts/verify-issue-lifecycle.py` 및 `ci.yml`의 기존/신규 정책 회귀.
- 신뢰 경계: PR에서 수정한 audit workflow가 자기 승인·정식 Release를 수행하지 않는다. main의 고정된 감사기와 재조회한 live SHA/Owner/GHCR 데이터만 증거로 삼고, READY 판정만으로 mutation하지 않는다.
- 2026-10-12 PR CI #2556.1 (run 38199169784.1)은 **QA Preflight BLOCKED (HTTP 404)**. 직접 원인: 본 필수 Work Packet 파일 누락. Quality/E2E/Docker aggregate FAILURE는 종속 실패이며 실제 회귀 실행은 SKIPPED. 원본 FAIL 기록은 보존하고 새 Head CI를 받는다.

## DOCUMENTATION_SYNC

- `AGENTS.md`: N/A(기존 고위험 QA 및 issue lifecycle 지침과 역할을 변경하지 않음)
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/ISSUE_633_RELEASE_DEBT.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `.github/workflows/ci.yml`: UPDATED
- `.github/workflows/release-debt-audit.yml`: UPDATED
- `scripts/release_debt_audit.py`: UPDATED
- `scripts/test-release-debt-audit.py`: UPDATED
- `scripts/verify-issue-lifecycle.py`: UPDATED
- `docs/exec-plans/active/ISSUE_633.md`: UPDATED
- `DESIGN.md`: N/A(사용자 인터페이스 및 디자인 계약 변경 없음)
- `docs/API.md`: N/A(제품 API와 서비스 DTO 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite 스키마 변경 없음)

## AC_TEST_COVERAGE

- AC1: real GitHub merge SHA/first-parent/CI 및 tag/Release 미발행 현황 문서화; `test-release-debt-audit.py` 원본 실패→BLOCKED fixture; GHCR exact digest 실제 검증은 default main trusted run 전 NOT TESTED.
- AC2: `test-release-debt-audit.py`의 version-scoped Owner marker·무승인·철회·새 SemVer negative/positive. 신규 버전 승인·미발행 폐기 원장 mutation은 NOT TESTED.
- AC3: `verify-issue-lifecycle.py`의 #615 adjacent 허용과 중간 Issue 차단 기존 fixture, `test-release-debt-audit.py`의 교차 Issue 차단/closed/docs-only/다른 승인 marker fixture.
- AC4: `release_debt_audit.py`의 main SHA/CI candidate/tag/digest 순서 검증. 실제 GHCR publication/Release/Resume/cleanup은 별도 Owner 승인을 요구하며 이번 PR에서는 NOT TESTED.
- AC5: 본 Work Packet, `docs/ISSUE_633_RELEASE_DEBT.md`, QA 정책/CI/릴리스 운영/원격검증/테스트 계획/CHANGELOG 동기화. `verify-issue-lifecycle.py`에서 #615/#586/#344 등 기존 회귀를 공식 PR CI에 유지.
- AC6: default-branch 기반 `release-debt-audit.yml` workflow의 read-only 권한과 `scripts/verify-issue-lifecycle.py` 계약검증. 실제 trusted GitHub Actions는 main 반영 후 독립 검증이 필요; RuleSet/인증 권한 우회 없음.

## QA / 롤백

- Local fast feedback: Python 문법/fixture 및 기존 `verify-issue-lifecycle.py`. 원격 PASS 증거는 동일 Head의 GitHub Actions에서만 인정.
- 3 Required aggregate Quality/E2E/Docker 결과는 새 run 이후 판정한다. Owner 고위험 위험수용/독립 정책 리뷰·Trusted QA/미해결 thread/최신 main 정렬은 병합 전 별도 Gate.
- 원격 감사가 UNKNOWN/BLOCKED면 비파괴 중단. 기존 Finalizer release-required/authorized 계약은 그대로 유지.
- Rollback: 감사 스크립트·수동 읽기 전용 Workflow·fixture·문서 변경만 revert. Tag/GHCR/Issue/branch 자동 변경이 없으므로 복구 원장은 현행 fail-closed로 계속 차단한다.
