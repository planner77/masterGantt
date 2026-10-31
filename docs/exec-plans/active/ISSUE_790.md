## 2026-10-31 — Current Main rescope (this section supersedes historical version/PR state below)

- **Primary Issue:** [#790](https://github.com/planner77/masterGantt/issues/790); **Related/parent:** [#444](https://github.com/planner77/masterGantt/issues/444) remains OPEN for actual cache outcome, sample sufficiency, Main Docker deterioration investigation, cache-miss/stale/secret audit and Owner ADOPT/DO_NOT_ADOPT.
- **Base:** main `3c73737968dfdbd6817657f3a17bed07c209a528` / app `0.138.5`; **new branch** `ci/issue-790-cache-audit-current-main`. Legacy [PR #791](https://github.com/planner77/masterGantt/pull/791) at `0.130.2` / `b5898d49b4e0f8b610744bc22494b12687d29473` is obsolete and must not be merged/revalidated as current. Preserve its original Head/PR CI as history, not a substitute for this branch's Required3/Trusted QA.
- **Scope:** port the proven focused CLI comparison, PR job rename proof link and `REVIEW_REQUIRED` fail-closed outcome, input/provenance/10-run/duplicate/numeric/event negative tests, preserve existing global report behavior. Do **not** change `ci.yml`, Docker BuildKit read/write, Node/npm/Next/Playwright cache, version, DB/API/UI, strict Required3 or eight Chromium shards. This deployment PR has `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=false`, `release_authorized=false`.
- **Current metric readiness:** [Run 41149264718](https://github.com/planner77/masterGantt/actions/runs/41149264718), PR 14/19/min 5, Main 27/27/min 20, Release 17/17/min 25. `COLLECT_MORE` on current incomplete PR groups. The historical before/after PR Docker 97.482s→90.520s (−7.14%) and Main 112.402s→144.491s (+28.55%) are *observations*, not controlled causal or current cache savings.
- **Safety delta:** Offline `schemaVersion/requireBoundProvenance` JSON is **self-asserted**, not an authenticated GitHub receipt. Every focused numeric improvement stays `REVIEW_REQUIRED` (ADOPT=0), even for unchanged job names, until independently checked provenance and workload equivalence. Existing global comparison remains backward-compatible advisory behavior. Broken/missing provenance, insufficient samples, job alias ambiguity, invalid metrics and duplicates cannot grant eligibility.
- **TEST_LIFECYCLE_REVIEW:** `EXTEND` existing `tests/scripts/ci-cache-phase2.test.ts`, `KEEP_UNIQUE` provenance/readiness and cache guard suites; no tests deleted/skipped. New focused same-job positive-cost sample must remain REVIEW_REQUIRED. Current CI Policy/Quality/E2E8/Docker and trusted QA are `NOT TESTED` until new PR runs.
- **AC_TEST_COVERAGE:** AC1/2 source/sample and alias controls → focused CLI + provenance/missing/duplicate tests; AC3 negative inputs/invalid costs; AC4 docs and #444 OPEN/HOLD; AC5 exact new PR required checks/Trusted QA; AC6 exact Main optional candidate and Finalizer after Owner approval; AC7 parent #444 still OPEN after child #790 closure.
- **DOCUMENTATION_SYNC:** new evidence, this Work Packet, #444 Work Packet, AGENTS, CI_CD, GITHUB_OPERATIONS, REMOTE_VALIDATION and issue failure ledger. DESIGN/API/DB/UI/Nex runtime = N/A, since analytical tools only. This plan does **not** authorize merge/GHCR or declare CI PASS.

---

# Issue #790 — #444 Phase 2 Docker cache 전후 실측 비교 도구 배포

## 분석 / Scope

- Primary Issue: [#790](https://github.com/planner77/masterGantt/issues/790) (배포 가능한 검증 도구 개선).
- Parent: [#444](https://github.com/planner77/masterGantt/issues/444) (**OPEN**, 최종 cache 채택·Main 비용 분석/미스 복구 검증은 미완료).
- 기존 승인 검증: [#444 PR #789](https://github.com/planner77/masterGantt/pull/789) Full [Run 40049813638.1](https://github.com/planner77/masterGantt/actions/runs/40049813638), Trusted [Run 40050520289.1](https://github.com/planner77/masterGantt/actions/runs/40050520289): PASS. 원본 Head `2ad309c0b7927eeda039032567352e8d2fb00bd0` 전용 역사 증거이며 새 PR Head의 PASS 증거가 아님.
- Issue #790 branch: `ci/issue-790-cache-compare-deploy`; source baseline `main` `4ce403a1e410ca599a780446f39513e1f1158326`. PR은 새 생성; 기존 #789는 중복 병합 방지를 위해 superseded/closed 예정.
- app version: `0.130.2` 유지. `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=false`, `release_authorized=false`.
- 직접 변경 대상: CI 비용 비교 CLI, Vitest 정·음성, README 수준의 CI 운영/근거/실패 문서. 변경하지 않는 대상: CI workflow, cache writer/reader, npm-ci·Next·Playwright, required 3 aggregate/Chromium8, Docker smoke, 데이터베이스/API/UI, 앱 버전.
- 이 이슈는 **비교 도구의 배포 lifecycle만 종료**할 수 있다. #444의 `ADOPT/DO_NOT_ADOPT` 판단 및 실제 cache miss/stale, Main Docker 지표 원인 규명은 별도 실행/승인을 요구한다.

## 설계와 정량 근거

- [기준 Run 38109419594](https://github.com/planner77/masterGantt/actions/runs/38109419594) vs [후속 Run 40046472198](https://github.com/planner77/masterGantt/actions/runs/40046472198), 각 readiness artifact의 trusted 성공 Run만 수용.
- PR Docker `docker_smoke`→`pr_docker_smoke`(#659): distinct successful 23→21, median 97.482→90.520s(-7.14%), p90 110.173→99.371s(-9.80%), runner min/run 1.533→1.472(-3.98%). **Job alias 동등성 미확정**이므로 `REVIEW_REQUIRED`, 자동 ADOPT 불가.
- Main Docker 같은 Job: successful 20→20, median 112.402→144.491s(+28.55%), runner min/run 1.952→2.387(+22.28%). CI workload/빌드 변화 통제가 없어 #603 변경 탓이라고 단정하지 않는다.
- `scripts/compare-ci-setup-metrics.mjs`: 동일 workflow/event/metric의 explicit focused mode; 전후 Job이 다르면 GitHub PR/Commit 출처를 요구. 전체 group 비교 모드 호환 유지; sample<10/provenance false/duplicate/invalid numeric/event mismatch는 fail-closed.
- `tests/scripts/ci-cache-phase2.test.ts`: 기존 readiness/차이 검사 EXTEND, alias·provenance·input 음성 및 신규 한글 오류 stderr 검사. 기존 Policy·Playwright·SQLite 테스트 폐기·skip·timeout/retry 확대 금지.

## TEST_LIFECYCLE_REVIEW

| 항목 | 결과 |
| --- | --- |
| 변경 AC/행동 | #790 AC1~AC7, 비교기 진단 정확성·실측 provenance·Job alias 자동 ADOPT 차단. cache/필수 CI 런타임 변경 없음 |
| 기존 검색 | `tests/scripts/ci-cache-phase2.test.ts`, `tests/scripts/ci-setup-provenance.test.ts`, `tests/scripts/ci-setup-readiness.test.ts`, `scripts/verify-ci-cache-contract.mjs`, PR #789 diff 및 #444 Work Packet |
| 정책 | `EXTEND` 기존 `ci-cache-phase2.test.ts`, `KEEP_UNIQUE` provenance/readiness/static cache 계약. 신규 독립 중복 제품·브라우저 테스트 추가·폐기 없음 |
| 증거 | #789 원본 Full CI/Trusted 성공과 기존 정량 증거는 **참고용**. 새로운 #790 PR Head/Run/Attempt·QA/Owner·Main/GHCR/Finalizer는 실행 전 **NOT TESTED** |
| 잔여 위험 | 워크로드 동일성 미증명, Main Docker 느려짐의 인과 UNKNOWN, 원시 cache-miss/stale/secret 감사 미완료. #444가 계속 관리 |
| 롤백 | 새 비교 스크립트/검증 테스트/문서 변경만 revert. #603 cache writer와 기존 required gate는 불변 |

## AC_TEST_COVERAGE

- AC1: provenance-bound before/after successful artifact ID/digest와 동일 workflow/event/job/metric 비교 근거를 [#444 원장](../../CI_CACHE_PHASE2_EVIDENCE_444.md)에 기록.
- AC2: `compare-ci-setup-metrics.mjs` focused mode의 before/after job alias와 GitHub 출처 URL 필수·REVIEW_REQUIRED/no auto-ADOPT, 전역 기존 모드 호환 Vitest 검증.
- AC3: `tests/scripts/ci-cache-phase2.test.ts`에서 sample<10, provenance false, duplicate key, runner invalid, CLI 옵션 음성·한글 오류 등 확인; 이전 #789 Unit PASS는 역사적 source.
- AC4: 이 Work Packet/AGENTS/CI_CD/운영/원격 검증/실패 원장과 parent #444 인계 링크, Test Lifecycle 유지.
- AC5: 새 정확 HEAD의 PR CI `Build, static checks, and unit tests` / `Chromium end-to-end tests` / `Docker build and runtime smoke test` aggregate 3종·기본 브랜치 Trusted QA 및 Reviewer thread=0, 최신 main 확인; 새 PR 생성 전 NOT TESTED.
- AC6: 병합 후 Main CI 및 해당 SHA의 임시 GHCR 검증·Generic Finalizer 정상 종료 확인; release-required=false이고 SemVer 정식 발행은 N/A.
- AC7: #444 OPEN 유지, 실증하지 않은 Main 성능 귀속·cache miss/stale·보안 검사와 cache 최종 ADOPT는 #790 완료로 소급 PASS 불가.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/exec-plans/active/ISSUE_790.md`: UPDATED
- `docs/exec-plans/active/ISSUE_444.md`: UPDATED
- `docs/ISSUE_444_FAILURE_ANALYSIS.md`: UPDATED
- `docs/CI_CACHE_PHASE2_EVIDENCE_444.md`: UPDATED
- `docs/TEST_PLAN.md`: N/A(기존 Test Lifecycle 정책 불변, 기존 ci-cache-phase2 Vitest 케이스의 정·음성 확장만 유지)
- `docs/QA_REVIEW_POLICY.md`: N/A(OWNER_MANAGED·Trusted QA·Owner 고위험 승인 및 독립 Reviewer 기준 불변)
- `docs/ISSUE_LIFECYCLE.md`: N/A(메인 병합/Generic Finalizer의 표준 종료와 Primary Issue 엄격 정책 유지)
- `DESIGN.md`: N/A(앱 화면·컴포넌트·UX 설계 변경 없음)
- `docs/API.md`: N/A(HTTP API·DTO·인증 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite schema·migration 변경 없음)

## 배포/인계 조건

- 새 PR에는 **오직** `Refs #790`가 canonical Primary Issue로 존재하고, branch/title/Issue ID가 일치한다. `#444`는 Parent 링크이므로 이 PR 병합을 통한 #444 조기 종료 금지.
- 신규 PR CI Full 및 Trusted QA PASS/Head·Base·test-merge/Owner 명시 위험 수용 확인 전 **MERGE BLOCKED**. 기존 #789 성공을 새 PR 성공으로 전환하지 않음.
- Main CI/GHCR/Generic Finalizer는 새 merge SHA별로 독립 검증. #790 정상 FINAL 후 #444의 미완료 AC는 OPEN 유지.
