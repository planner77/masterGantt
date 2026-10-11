# Issue #603 — #444 Phase 2 Docker BuildKit PR cache write 제거 및 after 실측

## 기준

- Parent: #444
- baseline readiness: Run #32.1 / `38109419594`
- baseline artifact digest: `sha256:22852bc04fc07d49f680e5d8bbca47a6e5a8f9a9779b8bd32c60129f0a8f8043`
- 기준 main: `b4d566e29bf2f976f51796405fd7c6f1ec5e2638`
- application version: `0.104.0` 유지
- release_required: false
- release_authorized: false
- 제품 UI/API/DB/Scheduling 계약: N/A

## Phase 2 판정

Playwright browser cache는 공식 Playwright 권고와 baseline 비용 분해에 따라 DO_NOT_ADOPT:
- OS deps 8.209 runner-min/run-equivalent (84.2%)
- headless shell 1.540 (15.8%)
- Linux OS dependency는 cache 대상이 아니고 browser binary cache restore 이득도 제한적

Docker는 IMPLEMENT:
- PR docker-build-cache median 97.482s / p90 110.173s
- Main docker-build-cache median 112.402s / p90 183.530s
- PR #451 CI #2473.1 GHA mode=max export 21.8s
- Main #2474.1 smoke export 69.6s
- Main publish 단계는 warm cache를 읽어 apt/npm layer CACHED, cache export 약 1s

## 구현

1. docker_smoke `cache-from` 유지
2. docker_smoke `cache-to`는 `github.event_name == 'push'`에서만 활성
3. PR/workflow_dispatch는 shared Docker cache read-only
4. Main publish commit image의 max-mode writer는 유지
5. metric cache label: PR=`gha-readonly`, push=`gha-write-max`
6. static contract + Vitest로 writer 수/조건 고정

## 검증

- PR exact head Quality/E2E/Docker aggregates
- cache miss에서도 Docker image policy/runtime/persistence smoke 동일 실행
- Main writer 회귀 금지
- 병합 후 PR after successful run >=10을 모아 #444 before/after compare
- median 5% 미만 개선 또는 correctness/Main regression이면 rollback/DO_NOT_ADOPT

## DOCUMENTATION_SYNC

- AGENTS.md: N/A — #444의 cache evidence/fail-closed 원칙 그대로
- docs/CI_CD.md: UPDATED
- docs/TEST_PLAN.md: UPDATED
- docs/GITHUB_OPERATIONS.md: UPDATED
- docs/REMOTE_VALIDATION.md: UPDATED
- docs/exec-plans/active/ISSUE_444.md: UPDATED
- DESIGN/API/DB schema: N/A
