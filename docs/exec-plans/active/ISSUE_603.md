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

- `AGENTS.md`: N/A(기존 CI 캐시 정책과 fail-closed 운영 지침 그대로 유지하며 에이전트 지침 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(Owner-managed 위험도와 QA 승인 정책 변경 없이 기존 문서 검증 계약 준수)
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/exec-plans/active/ISSUE_444.md`: UPDATED
- `DESIGN.md`: N/A(사용자 화면이나 디자인 및 제품 UI 계약의 변경 없음)
- `docs/API.md`: N/A(API 엔드포인트 또는 데이터 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(영속 데이터 구조 및 마이그레이션 변경 없음)

## AC_TEST_COVERAGE

- AC1: 최신 PR exact Head의 required Quality, Chromium E2E 및 Docker smoke aggregate 성공 확인; 재실행 시 새로운 Head의 실행 결과로 판정(PENDING)
- AC2: `scripts/verify-ci-cache-contract.mjs`, `tests/scripts/ci-cache-phase2.test.ts`에서 pull_request의 cache-to 부재, cache-from 유지, gha-readonly 라벨을 검증
- AC3: 동일 cache contract 및 Vitest에서 main push cache-to mode=max 유지와 publish-commit-image writer 책임을 검증; Main 실실행은 병합 후 확인(PENDING)
- AC4: required Docker image build, image policy, runtime 및 persistence smoke 실행 확인; 명시적 cache miss 회귀 확인은 실제 미스 실행 증거로 판정(NOT TESTED)
- AC5: `.github/workflows/ci.yml` diff 및 `scripts/verify-ci-cache-contract.mjs`에서 shared cache write 조건과 GitHub 권한 비확대를 검토; PR 실행에서 재확인
- AC6: 병합 후 `#444`의 readiness artifact에서 동일 workflow/event/job/metric 그룹 successful distinct PR run 10회 이상 확보 후 before/after median, p90, runner-minutes 기록(PENDING)
- AC7: 병합 후 Main Docker median/p90 및 publish cache reuse를 전후 비교하고 회귀가 있으면 rollback 또는 DO_NOT_ADOPT 판정(PENDING)
- AC8: application version `0.104.0` 유지, `release_required=false` 및 `release_authorized=false` 확인; 정식 GHCR release 해당 없음

## QA 및 결과 경계

- 변경 대상: CI 워크플로·캐시 검증 계약(HIGH), qa_method=OWNER_MANAGED; 별도 독립 QA PASS나 Manager ACCEPT를 자동 주장하지 않는다.
- PR CI #2479.1의 Docker Hub 502는 외부 이미지 metadata 오류이며 #2479.2에서는 Docker/Quality/E2E 모두 성공했다. #2479.2 QA Final만 기존 AC ID 및 문서 매핑 누락으로 BLOCKED였다.
- 새 PR Head에서 기존 실행 결과는 과거 참고 증거만으로 유지하고, 새 CI 및 신뢰된 QA 결과로 검증한다.
- AC3, AC6, AC7은 실제 Main/after 측정 전에 완료로 표기하지 않으며, #444에서 독립 실행 표본 10회 및 비용·회귀를 확인한다.
- 정식 GHCR release는 불필요하지만 Main CI 및 프로젝트의 요구되는 최종 검증 단계는 생략하지 않는다.
