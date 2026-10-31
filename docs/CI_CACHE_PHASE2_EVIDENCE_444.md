> **2026-10-31 현행 준비도 재점검 (masterGantt 0.138.5):** [신뢰 Run 41149264718](https://github.com/planner77/masterGantt/actions/runs/41149264718) 기준 PR 19개 중 14개 그룹 준비·서로 다른 성공 Run 최소 **5/10**, Main 27/27·20/10, Release 17/17·25/10으로 전체 `COLLECTING`이다. 2026-10-24의 아래 표본은 **역사적 관측**이며 현행 동일 조건 A/B 실험 또는 캐시 `ADOPT` 승인 근거가 아니다. Job 명칭 변경 출처는 현행 workflow·런타임 동등성 검토가 필요하다. 새 범위 지정 비교의 수치 개선은 독립 출처 수용 전 자동 채택 대신 `REVIEW_REQUIRED`로 판정하며 #790은 캐시 workflow를 수정하지 않는다.
---

# Issue #444 — setup/cache Phase 2 Docker 전후 실측 및 채택 보류 (2026-10-24)

## 출처 (서로 다른 성공 Run만 집계)

- **Before**: [trusted readiness Run 38109419594](https://github.com/planner77/masterGantt/actions/runs/38109419594), artifact `ci-setup-phase2-readiness-38109419594`, digest `sha256:22852bc04fc07d49f680e5d8bbca47a6e5a8f9a9779b8bd32c60129f0a8f8043`.
- **After**: [trusted readiness Run 40046472198](https://github.com/planner77/masterGantt/actions/runs/40046472198), artifact `ci-setup-phase2-readiness-40046472198`, digest `sha256:4b6932b3ace02ec863fd9978b8f87fe31b7dee2991beb24bd8f0eee37e3414fa`.
- 두 `analysis.json`의 `schemaVersion=2`, `phase2Issue=444`, `requireBoundProvenance=true`, `minSamples=10`, `phase2Ready=true` 확인. 성공 Run artifact만 읽고 matrix/attempt를 추가 distinct run으로 계수하지 않는 기존 readiness 수집기 사용.
- #603 구현 [PR #604](https://github.com/planner77/masterGantt/pull/604)은 2026-10-11 06:17 UTC 병합. After의 최근 PR 성공 실행은 2026-10-20~24 UTC에 집중되어 #603 이후 관측값이다. 단, workload/CI 변경을 통제한 A/B 실험이 아니다.
- PR Docker Job `docker_smoke` → `pr_docker_smoke` 명칭 변경 근거: [#659 commit 6a3d61f](https://github.com/planner77/masterGantt/commit/6a3d61fac54f3fb5584351bd0a1e886afc3781f4), 동일 `&docker_smoke_steps` / `*docker_smoke_steps` 계약. 명칭 대응은 **숫자 비교용**이며 실질 workload 동등성/원인 귀속을 자동 보증하지 않는다.

## 동일 workflow/event/metric의 관측 비교

`workflow=.github/workflows/ci.yml`, `metric=docker-build-cache` (시간 ms, runner-minutes per distinct successful run).

| Lane/event | Before job → After job | distinct 성공 Run | median 전 → 후 | p90 전 → 후 | runner min/run 전 → 후 | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| PR / pull_request | docker_smoke → pr_docker_smoke | 23 → 21 | 97.482s → 90.520s (**−7.14%**) | 110.173s → 99.371s (−9.80%) | 1.533 → 1.472 (−3.98%) | **REVIEW_REQUIRED** (수치상 5% 충족) |
| Main / push | docker_smoke → docker_smoke | 20 → 20 | 112.402s → 144.491s (**+28.55%**) | 183.530s → 175.564s (−4.34%) | 1.952 → 2.387 (**+22.28%**) | **REGRESSION INVESTIGATION / DO_NOT_ADOPT 후보** |

PR 개선은 전/후 성공 Run 최소 10개 조건을 충족하지만 CI Job 분리와 그 사이의 런타임/빌드 변화가 교란 요인이다. Main의 악화 역시 #603 cache read-only 변경 때문이라고 인과적으로 확정할 수 없다. 따라서 **전체 최적화 ADOPT 및 #444 종료 보류**. 기존 PR read-only/Main-only writer를 증거 없이 롤백하거나 새로운 cache를 추가하지 않는다.

## 재현 방법

두 공식 artifact ZIP의 `analysis.json`을 각각 `before.json`, `after.json`으로 추출한다. URL/ID/digest는 위의 GitHub Actions source에서 검증한다.

```bash
# PR: job alias 출처는 필수. 수치는 계산하지만 ADOPT 판정은 금지됨.
node scripts/compare-ci-setup-metrics.mjs --baseline before.json --current after.json \
  --scope-workflow .github/workflows/ci.yml --scope-event pull_request \
  --scope-metric docker-build-cache --before-job docker_smoke --after-job pr_docker_smoke \
  --rename-evidence https://github.com/planner77/masterGantt/commit/6a3d61fac54f3fb5584351bd0a1e886afc3781f4

# Main: 동일 Job, 집계 단위는 독립. Main 악화 판정은 변경 원인을 뜻하지 않음.
node scripts/compare-ci-setup-metrics.mjs --baseline before.json --current after.json \
  --scope-workflow .github/workflows/ci.yml --scope-event push \
  --scope-metric docker-build-cache --before-job docker_smoke --after-job docker_smoke
```

비교 CLI는 Job rename 증거 URL이 없거나 출처가 unbound, 표본 10 미만, duplicate workload key, 잘못된 runner 비용, 다른 이벤트/워크플로면 자동 ADOPT를 거부한다. rename URL 자체는 동등성을 증명하지 못하므로 `REVIEW_REQUIRED`를 반환한다.

## Phase 3 안전 조건과 향후 채택 기준

- 기존 npm `~/.npm` only + `npm ci`/lockfile key, Next `.next/cache` runtime key, Playwright browser cache 미사용, Docker PR `cache-from` read-only/Main `cache-to mode=max`, required 3 checks·Owner/QA는 **변경하지 않음**.
- `cache-hit`/readiness는 quality/e2e/docker PASS를 대신하지 못한다. artifact에는 분석 JSON/Markdown만 저장하며 원시 secret/.env/runtime DB/test 결과를 추가 저장하지 않는다.
- **미검증**: 동일 workload/버전의 pair-wise 전후 표본, Main Docker 변동 원인·Main publish cache reuse의 정량 재검증, 의도적 cache miss·stale 회복 실 실행, PR Head Required3/Trusted QA, 병합 후 Main/GHCR.
- 따라서 `#444`은 **OPEN**, 전체 결과는 `HOLD / REVIEW_REQUIRED`이다. PR 성능 수치만으로 #603 rollback이나 #444 완료/정식 이미지 발행을 승인하지 않는다. CI 안정성과 보안 회귀가 확인되면 cache writer/reader 변경을 별도 교정과 Owner 승인으로 처리한다.


## 하위 배포 Issue #790 인계 (2026-10-24)

- 이 원장은 **장기 parent #444의 정량 관측과 HOLD 결정**의 권위 있는 근거이며, 이제 새 [#790](https://github.com/planner77/masterGantt/issues/790)이 `scripts/compare-ci-setup-metrics.mjs` + Vitest + 안내 문서 배포만 담당한다.
- 기존 [PR #789](https://github.com/planner77/masterGantt/pull/789)의 정확 Head `2ad309c0b7927eeda039032567352e8d2fb00bd0` Full [#3214.1](https://github.com/planner77/masterGantt/actions/runs/40049813638) 및 Trusted [#859.1](https://github.com/planner77/masterGantt/actions/runs/40050520289)은 성공했지만 #790 신규 PR의 Head/QA 증거가 아니다.
- #790을 완료해도 #444의 실제 cache miss/stale 회복, Main Docker median 증가 원인, runner-minute 변화, 동등 workload 전후 비교, security audit 및 ADOPT/DO_NOT_ADOPT 최종 판정은 **미완료/OPEN**. Generic Finalizer가 #444를 조기 종료시키지 않도록 PR Primary를 #790으로 분리했다.
