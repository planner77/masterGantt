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
