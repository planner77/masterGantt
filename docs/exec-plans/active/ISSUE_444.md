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


## Phase 2 재개 — 2026-10-24 실제 evidence 및 #444 후속 교정

- 최신 기준 main(분석 시): `4ce403a1e410ca599a780446f39513e1f1158326`; app `0.130.2` 유지. 이전 #450의 `0.104.0`은 역사적 배포 정보이지 현재 버전 변경 요청이 아니다.
- 상세 [전/후 검증 원장](../../CI_CACHE_PHASE2_EVIDENCE_444.md)에 권위 있는 before/after readiness Run ID·artifact digest·기준 이벤트와 성공 Run 수·값·한계 및 재현 명령을 정리했다.
- 2026-10-24 [readiness Run 40046472198](https://github.com/planner77/masterGantt/actions/runs/40046472198)에서 PR 19/19 (최소 12), Main 27/27 (최소 20), Release 17/17 (최소 25) READY. 자동 캐시 변경 권한 없음.
- #603 전후 PR `docker-build-cache` (PR `docker_smoke` → `pr_docker_smoke`) distinct 성공 Run **23→21**; median **97.482→90.520s** (-7.14%), p90 **110.173→99.371s** (-9.8%), runner min/run **1.533→1.472** (-3.98%). Job 분리 출처 [#659 commit](https://github.com/planner77/masterGantt/commit/6a3d61fac54f3fb5584351bd0a1e886afc3781f4); 실제 작업 동일성과 영향 분리는 **REVIEW_REQUIRED**. 단순 이름 대응을 최종 ADOPT 증거로 보지 않는다.
- Main `docker_smoke/docker-build-cache`: 성공 Run **20→20**, median **112.402→144.491s** (+28.55%), p90 **183.530→175.564s** (-4.34%), runner min/run **1.952→2.387** (+22.28%). 원인 귀속되지 않은 회귀 관측이므로 추가 cache 도입/Phase 2 완료 중단, Main build/publish 정책은 변경하지 않는다.
- 동일 workflow/event/metric에 대해 기존 전역 metric-key 일치를 요구하면 #659 PR job rename으로 비교 자체가 불가능하므로 `scripts/compare-ci-setup-metrics.mjs`에 범위를 모두 명시하는 focused mode를 추가했다. alias 출처 GitHub PR/commit URL 필수, 자체 증거를 자동 입증한 것으로 간주하지 않으며 비교 결과를 `REVIEW_REQUIRED`로 둔다.
- 데이터 부족 10 미만, provenance 없는 입력, 잘못된 runner 비용, duplicate workload key 및 다른 이벤트/Job 혼용은 `ADOPT` 차단한다. 기존 전역 비교 모드, 5%/runner nonincrease 기본 기준은 유지한다.
- **구현은 비교 검증의 정확도와 문서 증거 강화**이고 신규 cache/worker/shard/required gate 변경은 없다. Main 증가 원인을 확인하지 않고 PR cache read-only를 되돌리는 것도 금지한다.

## TEST_LIFECYCLE_REVIEW

| 구분 | 증거·판단 |
| --- | --- |
| 변경 AC/계약 | #444 after 전후 검증, Phase 2 도입 의사결정의 동등성·출처·표본 fail-closed. UI/DB/Runtime 변경 없음 |
| 사전 기존 테스트 검색 | `tests/scripts/ci-cache-phase2.test.ts`(분석·전후 비교·정적 캐시 계약·WORKLOAD_MISMATCH), `tests/scripts/ci-setup-provenance.test.ts`(bound source), `scripts/verify-ci-cache-contract.mjs`(npm/Next/Docker/Playwright), `tests/scripts/ci-setup-readiness.test.ts` 검색 |
| 판단 | 기존 `ci-cache-phase2.test.ts`를 **EXTEND**(renamed job positive 수치, provenance/동일 이벤트/10-run/duplicate/invalid cost/CLI 음성); 나머지는 **KEEP_UNIQUE**. 자동 삭제·skip·assertion/timeout 완화 없음 |
| 실행 증거 | Node 22에서 재현 가능한 두 artifact의 분석 JSON을 focused 비교 CLI로 로컬 검증: PR `REVIEW_REQUIRED`, Main `DO_NOT_ADOPT`. 신규 Vitest 및 원격 exact Head 정책/E2E/Docker는 PR CI 전 **NOT TESTED** |
| 잔여 위험 | 기존 ready 요약은 Run 분리 데이터가 없고 CI 구성·제품 버전/runner 환경 변화가 통제되지 않음. Main cache write/publish 재사용과 cache-miss 런타임 실증 필요 |
| 롤백 | focused 비교 확장, 테스트 및 이 문서만 원복. 운영 cache/required gates는 기존 상태 |


## AC_TEST_COVERAGE

- AC1: PR/Main/Release의 successful Run 10개 이상 조건은 기존 trusted readiness Run의 관측값으로 확인한다.
- AC2: baseline median/p90/cache-hit 수치는 두 readiness artifact의 링크와 digest로 재현 가능하게 기록한다.
- AC3: PR Docker 전후 median/p90/runner minutes 비교와 별도 Job rename review 상태를 기록한다.
- AC4: 기준 개선률을 초과해도 Main 비용 변동이 있어 최종 도입 판단은 보류한다.
- AC5: cache miss 상태의 실제 Required Job 동작은 원격 실증 전 NOT TESTED로 유지한다.
- AC6: cache stale 상태에서도 기존 Required Gate를 우회할 수 없도록 정적 검증 계약을 유지한다.
- AC7: 캐시와 측정 artifact의 민감정보 금지 계약은 유지하고 실제 전체 자료 감사는 후속 검증한다.
- AC8: npm, Next, Docker, Playwright cache의 책임과 무효화 방식을 기존 문서에 반영한다.
- AC9: 이전 Full PR CI 실패를 보존하고 새 Head Quality/E2E8/Docker Required 결과는 새 Run 전 NOT TESTED다.
- AC10: 병합 후 Main CI·GHCR 여부와 Issue 종료는 별도 승인 대상이며 이번 작업에서는 실행하지 않는다.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/CI_CACHE_PHASE2_EVIDENCE_444.md`: UPDATED
- `docs/ISSUE_444_FAILURE_ANALYSIS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 Owner 관리 QA 및 승인 기준과 보호 경계 유지)
- `docs/TEST_PLAN.md`: N/A(기존 테스트 체계 유지 및 기존 Vitest 파일의 검증 항목 확장)
- `docs/ISSUE_LIFECYCLE.md`: N/A(이슈 병합 승인 및 종료 처리 규칙 변경하지 않음)
- `DESIGN.md`: N/A(사용자 화면과 기능 디자인 변경 사항이 전혀 없음)
- `docs/API.md`: N/A(서버 API 계약 변경 없이 CI 측정 로직만 정리)
- `docs/DB_SCHEMA.md`: N/A(테이블 및 마이그레이션과 저장 구조 변경 없음)

## PR/Release 범위

- primary trace: `Refs #444`; 과거 #603/#450은 출처이지만 이번 PR의 Primary Issue가 아니다.
- `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=false`, `release_authorized=false`; application version 변경 없음.
- 구현 branch: `ci/issue-444-phase2-evidence-comparison`. 이번 요청은 새 PR **생성 및 PR CI 시작까지만**; CI 모니터링, 병합, Main/GHCR, Issue 종료 불포함.


## F444-002 — PR #789 Full Run 40048923080.1 교정

- 실패 Head `93835ad7145d7233b3c7bc1accb1875d53c096b0` / Base `4ce403a1e410ca599a780446f39513e1f1158326`, full CI Run [#3211.1](https://github.com/planner77/masterGantt/actions/runs/40048923080).
- QA Preflight: PR metadata 3종의 독립 선언이 없어 실패하였고 Issue 원문의 10개 AC에 식별자가 누락되었다. QA Final도 동일 메타데이터를 요구한다.
- Fast Gate와 Quality/E2E/Docker 집계 실패는 위 직접 실패의 파생 결과이며 실제 구현 테스트는 수행되지 않았다.
- PR 리뷰 [P1](https://github.com/planner77/masterGantt/pull/789#discussion_r4365476882)은 신규 진단 오류 메시지를 한글로 수정하고 별도 부정 테스트를 추가해 대응한다.
- 보호된 문서 검증기의 독립 AC 매핑과 파일별 `UPDATED` 또는 `N/A(reason)` 구문을 위와 같이 교정하였다.
- 원인과 이전 PR #448의 실패·취소 원본은 [이슈별 누적 실패 원장](../../ISSUE_444_FAILURE_ANALYSIS.md)에 보존한다.
- 로컬 Node 22 CLI 10개 및 구문 검사 PASS. 신규 Vitest와 정확 Head 공식 CI 결과는 NOT TESTED. 사용자 지시 범위는 새 PR CI 시작까지이다.


## 배포 Lifecycle 하위 분리 #790 (2026-10-24)

- Owner는 **#444 장기 미완료 유지**와 비교기 배포 완료 구분을 승인했다. 신규 [#790](https://github.com/planner77/masterGantt/issues/790) Work Packet은 [ISSUE_790.md](ISSUE_790.md), 기존 #444 [PR #789](https://github.com/planner77/masterGantt/pull/789)는 성공 검증을 보존한 채 Superseded/Closed.
- #789 Full [#3214.1](https://github.com/planner77/masterGantt/actions/runs/40049813638) 및 Trusted QA [#859.1](https://github.com/planner77/masterGantt/actions/runs/40050520289) PASS는 정확 이전 Head만의 증거다. #790 신규 branch/title/PR `Refs #790`의 Required3·Trusted·Owner 승인/병합·Main CI·GHCR·Generic Finalizer를 별도로 수행한다.
- #790은 focused CLI·부정 테스트·문서 동기화 후 종료 가능. #444 AC4~AC7/AC10의 실제 Main Docker 인과·miss/stale·원본 secret 감사·ADOPT 확정은 **미완료**, #444 OPEN. 자동 finalize와 no-version GHCR cleanup으로 #444를 조기 종료하지 않는다.
