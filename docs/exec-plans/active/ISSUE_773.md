# Issue #773 — 인증된 Main Full 증거의 Release 중복 검증 재사용

## 범위·출처·승인

- Primary: [Issue #773](https://github.com/planner77/masterGantt/issues/773); 상위 Epic [#769](https://github.com/planner77/masterGantt/issues/769), hard dependency #438(Build-once 완료)·#770(source/plan Shadow 완료).
- First implementation baseline: `main` `b6c7ba8c9b2a28015c8cd29664a4d8b221229181`, package **0.129.1**, branch `ci/issue-773-release-evidence-reuse`. 현재 Main/Release는 Chromium **8/8 shards**, 당시 Issue 원문의 6/6은 과거 기준.
- 위험: `risk_level: HIGH`; `qa_method: OWNER_MANAGED`; `qa_required: true`; `manager_decision: NOT TESTED`; `release_required: false`; `release_authorized: false`.
- 최신 Owner 요청은 **설계→코드/문서 구현→새 non-draft PR Full CI 시작**까지만 승인. CI 모니터링·병합·Main CI·GHCR 게시·tag 조작·Finalizer·Issue 종료 **미승인**. 기존 Issue 본문의 “등록만”은 최초 지시이며 현 요청으로 범위 변경.
- `release_required=false`는 이 CI 정책 Issue의 정식 이미지 미발행 뜻이며, 실제 다른 버전의 미래 Release는 기존 별도 Owner exact-version 승인/Generic Finalizer를 여전히 요구함.
- **실측 이전** 직접 Python 단위 테스트, 실제 8/8 Main 증거, Release reuse 전환 및 비용 효과는 `NOT TESTED`; 성공한 과거 6-shard/8-shard와 비교 불가능한 경로는 `INSUFFICIENT_DATA`. 검증 없이 PASS/절감률 주장 금지.

## 기존 동작 및 변경 설계

1. **Main Full 자체는 변경 금지.** `.github/workflows/ci.yml`의 정책, Quality(typecheck/lint/unit/build), Chromium 각8-shard, Docker/HTTP·HTTPS/API/SQLite smoke, 패키지/SBOM/provenance GHCR `ci-<SHA>`, 세 Required aggregate·Trusted QA/Ruleset 그대로. Main push `main_image` 완료 뒤 advisory `--list --reporter=json`로 Playwright test inventory/실제 case 수를 계산하고 `scripts/release-reuse-main-manifest.py`로 Main Run ID+Attempt/source SHA/version/lock/source+testplan hash/OS+arch/Node/npm/Playwright/Chromium package/Docker fingerprint/candidate digest를 **불변 run-scoped artifact**로 추가. 이 receipt 자체는 성공 증명/승인 아님. 생성 오류는 원본 Main PASS로 위장하지 않으며 기존 Main Check 결과에 영향을 주지 않음.
2. **신뢰된 Release 판정**은 Release tag 실행 코드에 인증 권한을 위임하지 않고 default-main checkout의 `scripts/release-reuse-evidence.py`에서만 수행; 원격 annotated tag target peeled commit, git first-parent Main merge(PR two parents), 정확 Issue/PR 귀속·package/lock version·Owner version-scoped marker, CI workflow path/id/event=push/main/source SHA/run+attempt/final success를 독립 확인. 동일 이름 중복/attempt ambiguity/없거나 만료된 artifact/권한 실패는 INELIGIBLE.
3. **실제 일한 Full**: Main Policy/TypeScript/ESLint/Vitest/Next build, 두 aggregate, Docker implementation+aggregate, Main GHCR implementation, 8개의 실제 E2E implementation shard 성공 + 단계별 selected mandatory steps, 지정 원본 E2E timing ZIP8개에서 `status=passed`, skipped 0, 전체 spec/테스트 건수·workers1·CLI mode·runner/환경/Playwright lock+browser package 일치. aggregate만 green 또는 premerge PR Full 성공은 대체 불가. Retry/outdated/synthetic green을 소급 전환하지 않음.
4. **Release 정확 분기**: `RELEASE_REUSE_ENABLED` 기본 off(리포트 SHADOW만). Owner의 별도 명시 승인으로 flag 및 `RELEASE_REUSE_MAX_AGE_HOURS`(1..720)를 설정하고 모든 검증 통과·digest 동일일 때만 `REUSED_VERIFIED`. 이 경우 Release의 반복 static/E2E는 `skipped`이고 aggregate summary는 **REUSED_VERIFIED / NOT EXECUTED**, 절대로 EXECUTED/FULL_PASS 아님. flag off/증거 누락·만료/plan·환경·SHA mismatch/권한 모호 시 기존 **FULL Release**를 실행. Main 선택 검증/PR Fast/Targeted 결과는 사용하지 않음.
5. **잔여 release-specific 필수 gate 보존**: 기존 Container에서 registry candidate live digest/OCI source-revision-version 확인, 실제 HTTPS/HTTP/nginx/DB migration/readiness/SQLite restart/Project·Task API persistent smoke/image policy 이후 선택 attestation → verified exact digest SemVer promotion/rolling alias → Generic Finalizer handoff. Reuse receipt digest와 live digest 불일치 시 **BLOCKED**, 게시/Issue 종료 금지. no release rebuild·tag 이동/덮어쓰기 금지 정책 유지.
6. **승격 보류 위험**: Main의 `--list` inventory가 정확히 전체 suite인지, reused branch와 release branch의 OS image/Node npm minor·Playwright/Chromium versions·fixture+DB migration/worker setup·환경 세부값이 동일한지, artifact retention 30일 내 freshness 예산/OCI provenance/SBOM 검증이 완전한지 Remote positive/negative 재현 필요. 현 구현의 인증된 축만 성공해야 eligible; 출처 미확실은 FULL/BLOCKED. 이 이슈는 실제 flag ON이나 정식 release 수행을 승인하지 않음.
7. **Rollback**: 즉시 `RELEASE_REUSE_ENABLED=false`/unset → 기존 static+Release E2E8/8 FULL 경로 실행. 의도하지 않은 Github workflow skip/step drift 발견 시 `prepare` reuse job/if guard만 복구; Required Check 명칭, source verification, Main Full, GHCR/Finalizer·미발행 부채 #633/#765, exact SemVer tag 이력 불변.

## 파일/구성 및 문서 계약

- `.github/workflows/ci.yml`: 기존 Policy Test에 #773 회귀 추가; Main image 완료 후 read-only/continue-on-error receipt + run/attempt별 Artifact 보존 (30일).
- `.github/workflows/release-image.yml`: `prepare`의 권한 제한·trusted checkout·SHADOW eligibility + artifact, Full/reuse 분기, quality `REUSED_VERIFIED` 상태 및 live digest comparison. 기존 container/publish/finalizer 삭제·단축 없음.
- `scripts/release-reuse-main-manifest.py`, `scripts/release-reuse-evidence.py`, `tests/python/test_release_reuse_evidence.py`: 유일 provenance 계약 + fail-closed negative/positive.
- `tests/config/e2e-timing-reporter.cjs`: 기존 timing schema1/run attribution/기록 유지하며 runner imageOS/version/arch/OS 추가, 전환 후 새 성공 Run부터 이용 가능. 기존 Artifact에 값을 소급 채우지 않음.
- #438 verified digest, #712/#713 postmerge PR metadata, #770 impact shadow, #771 Draft Fast와 #772 LOW 병합 완화는 서로 다른 소비자/권한이며 `REUSED_VERIFIED`를 PR Full/QA/Owner PASS로 오인하지 않음.

## AC_TEST_COVERAGE

- AC1: D1 — Python `test_full_job_provenance`, `test_plan_full_coverage_no_duplicates`, `test_main_e2e_reporter_fails_closed` 및 원본 workflow step/source/digest profile 체크. 실제 Main8/8·Release 비교 `NOT TESTED`.
- AC2: D2 — 시뮬레이션 missing shard, duplicate job name, cancelled/skip, wrong attempt, expired/duplicate ZIP, failed step, environment drift, skippedCaseCount, owner revoke. Github API/rate limit, tag drift, GHCR live digest failure 시 Full 또는 BLOCKED 운영 검증 `NOT TESTED`.
- AC3: D3 — `release-image.yml`의 `container`, `publish`, `resume_finalizer`은 검증된 기존 단계; 이번 PR에서 실제 정식 Release 수행하지 않음. `NOT TESTED`.
- AC4: D4 — 최소 3개 성공 Full Release baseline + 동일 source/version SHADOW/flag 승격 시험, wall-clock/Runner-minutes(단가 아닌 job elapsed), 실제 fallback BLOCKED 사건의 Run ID/Attempt + artifacts/step evidence 비교가 필요. 8-shard 실측이 아직 부족하면 **INSUFFICIENT_DATA**. Release v0.129.0의 6-way 과거 35분은 최신8-way 비교 대조군이 아님.
- AC5: D5 — formal GHCR/tag/Issue 종료 작업 배제; 모든 기존 v0.129.0 등 immutable Release/GHCR 리소스 불변.
- AC6: D6 — protected workflow HIGH/OWNER_MANAGED/qa_required=true. 동일 Head **Final Full PR Quality/E2E8/8/Docker + default-main Trusted + Owner 위험 승인**, merge 뒤 Main Full 실제 검증 및 차기 개별 version release 승인 전 policy reuse 승격 금지. flag 기본 off/rollback 설명.
- AC7: D7 — 아래 DOCUMENTATION_SYNC 및 버전·제품 N/A 기록. Actual remote Python/PW/Docker CI `NOT TESTED` until new PR run.

## 메트릭 수집과 전환 Gate

| 단계 | 필요 증거 | 상태 |
| --- | --- | --- |
| Stage 1 / SHADOW | 기존 Release FULL, 인증된 Main Source/Manifest/8 shard, 불일치 이유·Runner-minutes·wall-clock baseline 3개 이상 | NOT TESTED / INSUFFICIENT_DATA |
| Stage 2 승인 | Owner의 별도 release policy flag + max-age 설정과 concrete run/attempt 식별; false positive 0, negative 모두 Full/BLOCKED | NOT APPROVED |
| Stage 2 / REUSED_VERIFIED | 원본 Main Full confirmed, static/E2E release NOT EXECUTED, candidate HTTP/HTTPS/DB/API/persistence & promotion unchanged | NOT TESTED |
| Rollback | flag off → 동일 source의 Full Release, immutable old Tag/OCI unchanged | CODE PATH ONLY / NOT TESTED |

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/exec-plans/active/ISSUE_773.md`: UPDATED
- `docs/ISSUE_773_FAILURE_ANALYSIS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(existing OWNER_MANAGED/Trusted QA/Owner independent risk acceptance unchanged)
- `docs/ISSUE_LIFECYCLE.md`: N/A(existing Finalizer source, permissions, signed marker, issue closure gates unchanged)
- `docs/exec-plans/active/PLAN.md`: N/A(new Work Packet is registered explicitly; global roadmap unchanged)
- `DESIGN.md`: N/A(no UI/UX, Gantt visual interaction or theme changes)
- `docs/API.md`: N/A(no application HTTP API, permission, canonical projection or request/response contract change; GitHub Actions read-only API only)
- `docs/DB_SCHEMA.md`: N/A(no SQLite model/migration/schema changes)
- `package.json`: N/A(no production code or version changes)
- `package-lock.json`: N/A(no dependencies or lockfile changes)
- `CHANGELOG.md`: N/A(no end-user application behavior or formal release changes)

## 2026-10-22 Preflight correction — PR #777

- [Full PR CI #3131.1](https://github.com/planner77/masterGantt/actions/runs/39744960939)과 [#3134.1](https://github.com/planner77/masterGantt/actions/runs/39745206861)은 base-trusted QA Preflight가 `DOCUMENTATION_SYNC`를 거부해 실패. Head `8871252ce3c16138ff8eebcf4da8850aad01860c` 및 `753ff55fa6669a147b8d674a3c11e8852b52d36f`에서 AC1~AC7 매핑은 문서에 있었으나, `- **AC1 (D1)**:` 형식이 신뢰된 `qa_final_automated.docs_gate`의 요구형식 `- AC1: ...`와 달라 인식되지 않았다. Policy/Typecheck/Lint/Unit/E2E8/Docker 실제 Job은 그 때문에 시작되지 않았다.
- 이번 교정은 AC1~AC7을 `- ACn: Dn — <실제 증거/NOT TESTED>`로만 정규화, 원래 각 수용기준의 검증 근거·미검증 구분 보존. 검증기나 Required gate 완화 없음. [Issue 전용 실패 원장](../../ISSUE_773_FAILURE_ANALYSIS.md)에 최초 및 반복 장애를 분리 누적.
- 문서 계약 검토: `qa_final_automated.docs_gate`의 `AC_TEST_COVERAGE` 정규식과 7/7 일치하는지 사전 구조 검증. 실제 원격 Preflight/Full8/QA 재검증은 새 Head Run 전 `NOT TESTED`.
- PR #777 inline review thread 0, GitHub mergeable=true, `main...branch` behind 0 (교정 전 조회 기준); 새 SHA/최종 test-merge/Trusted 상태는 새 PR Full CI에서 별도 검증.

## Handoff

- [PR #777](https://github.com/planner77/masterGantt/pull/777)은 이미 non-draft이며, 교정 커밋을 해당 Head 브랜치에 게시하면 GitHub의 `pull_request.synchronize`로 새 `FINAL_FULL` PR CI가 자동 시작된다. 새 Run과 Head는 게시 후 별도 확인하되, 사용자 요청에 따라 결과/성공까지 지속 모니터링하지 않는다. Full/Trusted/QA PASS는 새 Run 증거 없이는 주장하지 않는다.
- Future release enabling requires at least 3 completed independent baseline evidence observations and explicit Owner **separate** policy + version authorization. Current policy Issue PR itself never self-approves.
