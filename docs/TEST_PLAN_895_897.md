# Test Plan Addendum — Issues #895 / #896 / #897 (2026-11-08)

The existing large docs/TEST_PLAN.md is preserved byte-for-byte to retain historical test/CI evidence; this addendum owns the new narrow contract. The Work Packet records that preservation and links this file.

## #895 — reuse review contract
- Existing trusted scripts/qa_preflight.py and scripts/qa_final_automated.py check a Work Packet ## REUSE_REVIEW for REUSE_DECISION/CANDIDATES/CONDITIONS/OWNER_EVIDENCE. Structural success is not authenticated Owner approval.
- Existing scripts/test_qa_preflight.py and scripts/test_qa_final_automated.py cover explicit EXTEND, missing section, PENDING and invalid Owner evidence; tests remain in CI's existing policy job.
- No retrospective reclassification of old successful PRs; new/REWORK issue decisions are validated when processing under updated trusted base.

## #896 — existing Playwright capture & evidence integrity
- tests/e2e/schedule-views.spec.ts uses the #889 isolated synthetic fixture to capture an additional screenshot/geometry manifest in tests/e2e/helpers/ui-evidence.ts. It is an OBSERVED_NOT_APPROVED evidence record with exact commit SHA, Issue/AC, viewport/locale, element rectangles and PNG SHA256.
- Existing Chromium8 test still exercises Task/view and HTTP/SQLite contracts. scripts/ui_evidence.py validates screenshot checksum, fixture provenance, non-finite geometry, source identity and path-safety; visual approval requires a separate Owner review.
- tests/python/test_ui_evidence.py covers valid and invalid manifests; ci.yml uploads **only** synthetic ui-evidence files after existing E2E shards. No separate visual test runner, no automatic golden baseline or false positive DESIGN PASS.
- #900/#3577.1 rework: Playwright `testInfo.attach(path=...)` duplicates JSON/PNG into `test-results/<test>/attachments/` with hashed filenames. These report-view attachments are **not** additional producer manifests. `scripts/ui_evidence.py` scans only the canonical test-output JSON siblings (excluding `attachments/`) and continues to enforce exact sibling screenshot existence, checksum, source, synthetic provenance, and geometry. `tests/e2e/helpers/ui-evidence.ts` labels report attachments distinctly to avoid artifact-name ambiguity. Regression tests assert that attachment copies cannot cause a false failure **or** supply a missing canonical manifest. No integrity checks are bypassed.

## #897 — Preview UAT approval integrity
- scripts/preview_uat.py reuses the existing qa_final_automated.GitHub read-only authenticated API wrapper and #703 Preview source/digest. It checks actual repo User Owner comments, Issue/PR latest Head, and both digest strings, newest valid comment authority.
- tests/python/test_preview_uat.py covers correct Owner receipt, REWORK after ACCEPT, stale SHA/image/evidence, nonOwner/foreign Issue, duplicate or incomplete comment and unavailable decision.
- Actual browser UAT on isolated Preview + Owner ACCEPT is **NOT TESTED** in this implementation; do not fabricate a screenshot or GHCR deployment.

## #900 / #3578.1 — 35분 E2E 샤드 임계시간 보완
- CI Full Run #3578.1 (42475849089) completed Quality/Preflight/Docker and 7/8 E2E shards; shard 3 verified one canonical synthetic UI evidence manifest after the #3577.1 correction. Shard 2 hit the unchanged 35-minute Job limit after 102/113 test PASS, leaving 11 NOT RUN; this is an incomplete E2E suite, not a product assertion PASS or UAT approval.
- Reuse existing `tests/config/e2e-shard-plan.json` + `scripts/e2e-shard-planner.mjs` and the existing single `tests/scripts/e2e-shard-planner.test.ts` invariant test. Move **entire files**, not selected tests: `issue-734-equipment-dashboard.spec.ts` 2→8 and `issue-735-system-dashboard.spec.ts` 4→6 using source-run completion intervals. Keep 147 E2E specs each exactly once; assert current destinations and reverse-link #900→#894→#885 history. Preserve historical projectedMs and all earlier decisions without interpreting them as new forecasts.
- Previous runner observed Playwright wall (minutes): shard 1 25.2, 2 censored at 35m, 3 27.4, 4 31.3, 5 23.2, 6 21.4, 7 22.7, 8 19.5. Transferred file completion spans of about 7.6m and 5.0m produce only **shift-only approximations**, not guaranteed wall times (especially 11 censored cases). New exact Head Full8, QA and Owner gates remain necessary. Do not enlarge 35m timeout, enable retries, alter fail-fast, test assertions, Required Check or worker count.

## PR #900 · Full #3579.1 — W07 장기 E2E 테스트의 독립 시나리오 분리

- [Run #3579.1](https://github.com/planner77/masterGantt/actions/runs/42479544101), head `e47edb631208704bc8595022b7eb6066ac709676`: QA Preflight/Policy/Quality/Build/Docker PASS and 5/8 Chromium shards PASS. Shard 7 stopped after 101 PASS at `project-task-persistence.spec.ts:58` with one per-test 30s timeout near final canonical GET; six remaining cases NOT RUN. Shards 3/8 canceled by matrix. Earlier #3578.1 shard 2 35m problem did not recur.
- Original unchanged W07 test used 29.4s (#3577.1 PASS), 23.1s (#3578.1 PASS), and 30.9s (#3579.1 FAIL). The downloaded #3579 Playwright trace shows earlier GET/POST/DELETE calls completed; last GET attempted near test deadline. Server hang is NOT established. Multiple distinct pointer edits/errors/deletion and concurrency/authorization/native addition operations in one test exhausted the test budget.
- Reuse `tests/e2e/project-task-persistence.spec.ts`, `createProject`, `test.use(isolatedApplicationOptions)`, real Next/SQLite/HTTP fixture and existing W07 assertions. Split into: (A) pointer drag/422/412/500 recovery and delete/reload, (B) fresh empty project, same-revision 201/412 concurrency, unauthorized 401/readonly/unlock and native root/child creation/reload. Both verify empty canonical state at their respective boundary. Preserve test timeout 30s, workers=1, E2E8 plan, no retries, no skips, no assertion removal or new infrastructure.
- New source must pass both W07 tests and all 8 CI shards, previous #895 policy/QA and #896 visual artifact guards, Quality/Build/Docker and Owner gate. Earlier run PASS is diagnostic only; local full browser validation is NOT TESTED.

## PR #900 · Full #3580.1 — W07 분리의 live 등록표 소비자 동기화

- 기존 두 W07 시나리오·실제 AST 검증기를 재사용한다. `tests/config/gantt-state-conformance.json` SC-03가 분리 전 제목을 참조하여 Vitest가 실패했으므로 현재 A/B 제목을 모두 등록한다. 기존 owners/rules/evidence/NOT TESTED 계약·검증기·W07 assertions는 유지한다.
- 재사용 범위는 현재 source의 실제 등록 검사와 기존 negative cases, 이전 shard rebalance의 일대일 coverage/history, prepr 선택 소비자, Preflight/Final/UI/UAT 양·음성이다. 기존 3-file Vitest 45 PASS(2.13s), Python 73 PASS(0.032s); original manifest 검사 1 FAIL/13 PASS 재현 후 GREEN. 신규 중복 검사·별도 runner는 추가하지 않는다.
- 이번 로컬 환경은 기존 Node 설치를 pure AST/unit 용도로 재사용했다. Playwright 목록 조회는 `unified` 미설치로 BLOCKED이며 뒤의 전체 discovery는 NOT RUN. 실제 W07 두 case/SQLite/브라우저/신규 Head Full E2E8·Docker·Trusted·Owner UAT는 NOT TESTED다. 과거 “로컬 환경 없음” 문구는 최초 작성 시점 이력이며 위 범위만 이번에 갱신한다. 구체적 source SHA·manifest SHA256·Run/Job 및 원본/파생 상태는 [누적 원장](ISSUE_895_FAILURE_ANALYSIS.md)을 따른다.

## Current validation boundary
## #895 Main #3582.2 — producer attempt OCI Artifact reuse regression

- [Main Run #3582 / 42487828570](https://github.com/planner77/masterGantt/actions/runs/42487828570) attempt 1: E2E 5/8 native progress PATCH ECONNRESET, Required E2E FAIL; successful Docker producer stored immutable `ci-oci-main-42487828570-1`. Attempt 2 re-ran failures: **8/8 E2E, Quality, Docker all SUCCESS**, but Main OCI publisher requested non-existent `ci-oci-main-42487828570-2` and stopped; second timer error was derived from skipped start step. No GHCR candidate/digest/Finalizer proven.
- Existing `ci.yml` and `tests/python/test_ci_image_reuse.py` are reused. Producer `docker_smoke.outputs.archive_attempt` is the source attempt and is preserved by GitHub partial re-runs; the publisher consumes that value rather than `github.run_attempt`. Validation still requires successful producer + expected OCI archive hash/index/revision, GHCR exact digest, same-run image policy/readiness/SQLite and protected Owner/QA. A missing/invalid producer artifact is BLOCKED, not a fallback to another source. Keep `ci-oci-main-<run>-<producer attempt>` immutable; do not rename or copy an old ZIP to the new attempt.
- Unit source contract: assert producer output context, output-driven publisher name, reject prior wrong consumer-attempt string, exact Producer1/Consumer2 example, unchanged OCI and overwrite guards; empty metric start skips secondary telemetry error. New PR CI/Trusted QA/Owner acceptance and new Main/GHCR/Finalizer **NOT TESTED** until actual results. No test skip, timeout/retry, new workflow, Required3/E2E8 or release authority changes.

- Source authored on branch ci/issue-895-896-897-reuse-visual-uat from exact main SHA 90c5a1a951c749a9690b1c83e5a74b6d122dd6e3 (PR #894 already merged).
- No full local Node/Python/Chromium/Docker environment in this session; exact updated PR Head's required CI and default-main Trusted QA are necessary evidence.
- Test coverage is additive; original E2E8, workers=1, Quality, Docker, owner merge authorization, Release evidence reuse and finalizer remain unchanged.
