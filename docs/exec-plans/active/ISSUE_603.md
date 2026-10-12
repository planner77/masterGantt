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

- `AGENTS.md`: N/A(기존 CI 실행명 생성기와 Issue lifecycle 지침은 유지하고 운영상 사용 누락만 복구)
- `docs/QA_REVIEW_POLICY.md`: N/A(Owner managed QA 신뢰 경계와 HIGH 위험도 정책을 변경하지 않음)
- `docs/CI_CD.md`: N/A(캐시 writer와 required CI workflow 정의 변경 없이 merge 제목 사전 검증만 보완)
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: N/A(기존 Main CI 및 Generic Finalizer 원격 검증 절차 그대로 적용)
- `docs/exec-plans/active/ISSUE_444.md`: N/A(장기 after 성능 검증은 #444에서 별도로 OPEN 추적)
- `DESIGN.md`: N/A(제품 UX 디자인 변경 없음)
- `docs/API.md`: N/A(제품 API 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB schema 변경 없음)

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

## Main CI #2483.1 실패 복구 (2026-10-11)

- 원인: #604 merge commit `09d8d51ccc09bc12353eb05315eb43df09034975`의 제목 `Issue #603 · PR #604 · Docker BuildKit PR cache read-only`에 한글 요약 없음. `verify-ci-run-trace.py`에서 fail-closed; 실제 Main Docker/build/E2E 미실행. 해당 SHA의 CI 기록 FAIL 유지.
- 대응: `scripts/verify-issue-lifecycle.py`에 이 오류를 재현하는 exact-title FAIL 및 생성기 Korean-canonical PASS 회귀 테스트를 추가했다. 생성기를 사용하지 않은 병합을 반복하지 않도록 운영 지침과 테스트 계획 동기화.
- 안전 경계: 기존 `main` immutable commit 재작성, 검사 우회, 정식 태그/GHCR release 발행 없음. 신규 same-Issue #603 PR은 **비문서 실행 검증 파일** 변경을 포함하여 기존 non-doc 실패 실행을 모두 포함하는 전범위 Main CI로 회복한다.
- 이 PR의 인수 증거: 새 PR Head Quality/E2E/Docker required 모두 PASS, QA Automated/Trusted PASS, 최신 main 정렬 및 thread 0. 병합 commit은 반드시 `scripts/main_ci_run_name.py`의 generated `Issue #603 · PR #<새 번호> · Docker 캐시 Main CI 복구`, 빈 본문, exact Head SHA lease를 사용한다.
- 새 Main이 성공하면 first-parent Generic Finalizer가 구 실패 시도 SUPERSEDED 기록을 남기고 마지막 정상 #603 target을 finalize/close한다. 정상 이전에는 이슈 OPEN 유지. #444 after 성능 측정/rollback 평가는 독립 OPEN.
