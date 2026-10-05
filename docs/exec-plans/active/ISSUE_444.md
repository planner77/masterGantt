# Issue #444 — setup/cache Phase 2·3 실측 최적화 및 guard

## 현재 기준

- Issue: #444 `[CI/CD] setup/cache Phase 2·3 실측 최적화 및 guard`
- 기준 main: `6ce221bc16613625953b85244bb93ad50019b377`
- 작업 branch: `ci/issue-444-setup-cache-phase2-guard`
- application version: `0.83.3` 유지
- release_required: `false` — CI 분석/guard 변경이며 제품 runtime/API/DB schema를 변경하지 않는다.
- release_authorized: `false`
- DESIGN/API/DB/Scheduling/UI 계약 변경: N/A

## 선행 조건 판정

#439 Phase 1 release 직후 착수 시점이라 PR/Main/Release 각 workflow/event/job/metric 비교 그룹의 distinct successful run ID >=10 조건은 아직 충족되지 않았다. 따라서 실제 Playwright browser cache 또는 추가 cache 계층 도입은 DEFER한다.

이번 구현은 표본이 충분해진 뒤 Phase 2를 재현 가능하게 수행하고 Phase 3 안전 계약을 CI가 fail-closed로 검증하도록 준비한다.

## 구현 범위

1. `scripts/analyze-ci-setup-metrics.mjs`
   - PR/Main/Release lane 분류
   - lane별 readiness
   - median/p90 + runner-minutes/run + exact cache hit rate
   - 충분한 표본의 비용 후보 순위
2. `scripts/compare-ci-setup-metrics.mjs`
   - 동일 workflow/event/job/metric before/after 비교
   - 표본 부족은 `COLLECT_MORE`
   - 기본 채택 기준: median 5% 이상 개선 + runner-minutes 비증가
3. `scripts/verify-ci-cache-contract.mjs`
   - npm `~/.npm` 전용 / `node_modules` 금지
   - npm OS/arch/Node/lockfile invalidation
   - Next OS/arch/Node/Next/lockfile invalidation
   - Docker OS/arch namespace
   - Playwright browser cache evidence 전 비활성
   - cache miss fallback과 setup metric artifact 경계 검증
4. `.github/workflows/ci.yml`
   - policy job에서 cache contract guard 실행
   - Next cache key 재현성 입력 강화
   - Docker GHA cache scope OS/arch 분리
5. `.github/workflows/ci-setup-readiness.yml`
   - successful `CI` / `Publish release image` 완료와 일일 schedule에서 자동 재평가
   - PR=`ci.yml/pull_request`, Main=`ci.yml/push`, Release=`release-image.yml/workflow_dispatch` successful artifact 수집
   - trusted `main` checkout, read-only repository 권한 + Issue comment write만 허용
   - #444 단일 marker 댓글과 analysis artifact 갱신
   - READY에서도 cache 변경/PR 생성/Issue close는 자동 수행하지 않음
6. `scripts/render-ci-setup-readiness.mjs`
   - lane별 ready groups와 최소 distinct run/10, blocker, 비용 후보를 Issue 댓글 형식으로 렌더링
7. 테스트
   - readiness/candidate/cache hit rate
   - 표본 부족 fail-closed
   - before/after ADOPT 판정
   - static cache contract
   - trusted checkout/최소 권한/comment idempotency/READY non-mutation
8. 문서
   - `AGENTS.md`
   - `docs/CI_CD.md`
   - `docs/TEST_PLAN.md`
   - `docs/GITHUB_OPERATIONS.md`
   - `docs/REMOTE_VALIDATION.md`

## 완료 경계

초기 사용자 요청 범위는 구현, 관련 문서 갱신, PR 생성과 PR CI 시작까지였고 PR #448 Run #1818.1이 required quality/e2e/docker PASS했다. 후속 요청으로 Phase 2 readiness 자동화를 같은 branch/PR에 추가하며 새 head의 PR CI를 다시 시작한다. 새 CI 완료 모니터링, merge, main CI, GHCR release, Issue 종료는 현재 범위 밖이다.

Issue #444의 실제 cache 최적화 채택 Acceptance Criteria는 10-run baseline과 동일 workload before/after evidence가 쌓인 뒤 후속 작업에서 완료한다.
