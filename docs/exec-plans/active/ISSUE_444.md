# Issue #444 — setup/cache Phase 2·3 실측 최적화 및 guard

## 현재 기준

- Issue: #444 `[CI/CD] setup/cache Phase 2·3 실측 최적화 및 guard`
- 기준 main: `2a68ff585780c2b3bdeaf2c46417e5ef539b0d11`
- Parent Issue: #444 (측정·최적화 완료 전 OPEN 유지)
- 구현 lifecycle Issue: #450
- 작업 branch: `ci/issue-450-phase2-readiness-deploy`
- 구현 PR: #451 (기존 #448은 lifecycle 분리 과정에서 superseded/closed)
- application version: `0.104.0` 유지
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

초기 구현은 PR #448에서 진행했으나 #444를 측정 완료 전 OPEN 유지해야 하는 요구와 Generic Finalizer의 no-version finalize(close) 계약이 충돌했다. 저장소 Primary Issue trace 정책(branch/body/title 일치)을 보존하기 위해 구현 배포 lifecycle을 #450 / PR #451 / `ci/issue-450-phase2-readiness-deploy`로 분리했다. #450은 배포/Main CI 완료 후 종료 가능하지만 Parent #444는 baseline 수집 → READY → 실제 Phase 2 최적화 또는 DO_NOT_ADOPT → after 검증 완료 전까지 OPEN 유지한다.

Issue #444의 실제 cache 최적화 채택 Acceptance Criteria는 10-run baseline과 동일 workload before/after evidence가 쌓인 뒤 후속 작업에서 완료한다.

## Phase 2 후보 진행 (2026-10-11)

- baseline authority: readiness Run #32.1 / artifact digest `sha256:22852bc04fc07d49f680e5d8bbca47a6e5a8f9a9779b8bd32c60129f0a8f8043`
- Candidate 1 Playwright browser/headless-shell cache: **DO_NOT_ADOPT**
  - 전체 Playwright setup runner-min/run-equivalent 9.749 중 OS deps 8.209(84.2%), headless shell 1.540(15.8%)
  - Linux OS dependency는 cache 대상이 아니며 browser binary cache 이득이 제한적
- Candidate 2 Docker BuildKit: **IMPLEMENT — Issue #603**
  - PR docker-build-cache median 97.482s / p90 110.173s
  - Main docker-build-cache median 112.402s / p90 183.530s
  - PR cache export 21.8s, Main smoke export 69.6s 실측
  - PR shared cache write 제거, Main writer 유지 후 동일 metric successful PR >=10으로 after 판정
- Candidate 3 npm ci: Docker after 판정 뒤 진행

