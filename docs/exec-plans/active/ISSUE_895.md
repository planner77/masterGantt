# Issue #895 (Primary) / #896 / #897 — 재사용 정책·Visual Evidence·Preview UAT 통합 Work Packet

## Scope / Baseline
- owner directive: 2026-11-08, 세 Issue 단일 신규 PR; 기존 #894는 #889/#890 전용으로 유지. 기존 #703 Preview, Playwright/Geometry, QA/Lifecycle를 **확장 재사용(A)**. 재사용 불가능/충돌은 Owner 사전 질문.
- baseline main: 90c5a1a951c749a9690b1c83e5a74b6d122dd6e3 (기존 PR #894 병합 뒤).
- branch: ci/issue-895-896-897-reuse-visual-uat. 기존 제품 Gantt source/Task/DB/API 변경 금지.
- source package version: 0.145.1; version_decision: keep. release_required: false; release_authorized: false.
- risk_level: HIGH; qa_method: OWNER_MANAGED; qa_required: true. Protected CI/QA Policy 변경이므로 기존 main base trusted Preflight·Full8/Required3/Trusted와 Owner 수동 수용 필요.
- implementation note: isolated GitHub source edit available, local Node/Python/Chromium/Docker checkout unavailable. No local test PASS claimed.

## REUSE_REVIEW
- REUSE_DECISION: EXTEND
- REUSE_CANDIDATES: Existing #703 Preview GHCR workflow and isolated Compose; #711 Test Lifecycle; scripts/qa_preflight.py and qa_final_automated.py; existing tests/e2e/schedule-views.spec.ts and scripts/compare-issue-118-layout.mjs; #836 OCI and #773 Release evidence unchanged
- REUSE_CONDITIONS: Existing trusted base QA and source provenance remain; only synthetic screenshot artifacts public; #896 integrity never auto DESIGN/UAT PASS; #897 GitHub Owner Issue comment plus exact source SHA and both digests; no new Required Check, no change to PR or Main Full8; previous decisions reused only within scope
- REUSE_OWNER_EVIDENCE: Current conversation 2026-11-08 18:59 KST Owner explicit reuse A and separate new PR; Github-authenticated Owner semantic confirmation required before merge
- REUSE_SCOPE_DRIFT: unchanged at branch creation; if shared code or UAT/CI authority conflict emerges stop and ask Owner
- REUSE_TEST_EVIDENCE: new unittest+existing Chromium fixture, remote CI NOT TESTED
- MAIN_CORRECTIVE_REUSE_SCOPE: Original #900 PR kept Main/PR Required checks unchanged and remains immutable. The post-merge #3582 corrective PR is an Owner-authorized *narrow repair inside the same existing* `.github/workflows/ci.yml`: carry actual `docker_smoke` producer Attempt to `publish-commit-image`. It does NOT create a new CI/release pipeline, Required Check, tag authority, test runner, or permission. Existing #836 OCI index+archive SHA and same-run Main Smoke/Publisher security constraints are **REUSE_AS_IS**; source-selection wiring is **EXTEND**. Owner confirmed reuse-first and correction through the present Main failure request.

## Design / Implementation
- #895: AGENTS/Lifecycle/Agent Prompt Work Packet contract and **existing** trusted QA Preflight/Final structural gate; questions/actual decision verified by Manager, not PR author's self assertion. No parallel governance tool.
- #896: existing schedule-views isolated fixture/test; Playwright capture helper writes synthetic PNG+geometry JSON with exact SHA/Issue/AC/locale/viewport and PNG SHA256. scripts/ui_evidence.py checks file integrity only. Existing ci.yml E2E8 shards upload safe representative manifest when present; absent shard NOT TESTED not false PASS.
- #897: scripts/preview_uat.py reuses qa_final_automated.GitHub read-only API; only repo User Owner's latest valid Issue receipt for same SHA+preview digest+evidence digest can be UAT_ACCEPTED. Later REWORK or source drift blocked. Manual Manager pre-merge UAT Gate, no automatic Ruleset change.
- public artifact security: synthetic fixture ONLY. No internal preview URL, real project/employee names, Cookie, production secret, external instance screen in GitHub Issue/PR/log.

## TEST_LIFECYCLE_REVIEW
- EXTEND: scripts/test_qa_preflight.py, scripts/test_qa_final_automated.py (reuse decision positive/PENDING/missing); tests/e2e/schedule-views.spec.ts (existing #889 real layout fixture/capture). KEEP_UNIQUE: existing Chromium8/E2E isolated SQLite, #118 original geometry harness and per-issue fixtures; no deletion/skip/timeout increase.
- ADD: tests/python/test_ui_evidence.py (synthetic/unsafe/sha/geometry positive and negative), tests/python/test_preview_uat.py (Owner/rework/stale/foreign/forged), tests/e2e/helpers/ui-evidence.ts; no new external SaaS or test runner.
- required: existing QA Preflight, Policy Python tests, TypeScript, ESLint, Vitest, Chromium8, Docker Smoke and default-branch Trusted. Protected CI bootstrap self-validation prohibited.

## AC_TEST_COVERAGE
- AC01: qa_preflight existing GH fixture tests missing/PENDING reuse block; docs Lifecycle all Issue and multi Issue PR contract; actual Owner follow-up NOT TESTED
- AC02: explicit REUSE_AS_IS or EXTEND and Owner evidence structure, same-scope reuse manual decision; prompt prevents duplicate Owner question
- AC03: Work Packet candidates cover UI, API, tests, Preview, OCI and evidence with positive/negative; examples in docs/QA_REVIEW_POLICY.md
- AC04: no SHA/Run/Attempt confidence gain from historical receipt; source-sha and screenshot checksum negative tests; PR Owner semantic confirmation separate
- AC05: AGENTS.md/Lifecycle/AGENT_PROMPTS.md/QA/CI/TEST_PLAN/Visual/UAT documents synchronized; test lifecycle and failure ledger recorded
- AC06: CI workflow unchanged Required3/E2E8/Docker/Trusted and full Policy Python tests; exact-Head Full needed before merger

## Related Issue Coverage #896
- AC01: synthetic manifest Issue/AC/viewport/state and DESIGN clause documented, overall acceptance Manual Owner NOT TESTED
- AC02: existing Playwright/Geometry/Fixture/CI reused; new ui_evidence.py validates only artifact envelope
- AC03: corrupt PNG/non-synthetic/NaN/path traversal/missing AC tests and no false PASS
- AC04: exact Source SHA, PNG checksum + UI artifact in CI, actual remote artifact NOT TESTED
- AC05: existing schedule-views Chromium positive fixture capture; full Run and actual UAT NOT TESTED
- AC06: Required3/E2E8/Trusted invariant and TEST_LIFECYCLE_REVIEW recorded

## Related Issue Coverage #897
- AC01: Owner Issue comment receipt parser + current PR/source/image/evidence exact match; actual Owner ACCEPT NOT TESTED
- AC02: nonOwner/other Issue/REWORK/duplicate/incomplete receipt negative tests
- AC03: source/image/manifest digest stale checks
- AC04: UAT mode separate from CI/Manager/GHCR; no release or Ruleset activation
- AC05: existing #703 separate SQLite/Preview manual; actual host UAT NOT TESTED
- AC06: one reusable decision; repeats only when scope or digest changes
- AC07: AGENTS/Lifecycle/Prompt/QA/Preview/CI/TEST_PLAN/UI docs and standalone failure ledger

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: N/A(기존 대용량 테스트 계획 원본을 보존하고 신규 사항은 docs/TEST_PLAN_895_897.md Addendum에 기록)
- `docs/TEST_PLAN_895_897.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/AGENT_PROMPTS.md`: UPDATED
- `docs/PREVIEW_PUBLISH.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `DESIGN.md`: N/A(제품 레이아웃·디자인 토큰·사용자 UI 직접 변경하지 않는 검증 프로세스 확장)
- `docs/SCHEDULING_ENGINE.md`: N/A(재사용 심사·합성 증거·Preview UAT 검증만 변경하며 일정 알고리즘·의존성·계산 입출력·근무일 정책은 수정하지 않음)
- `docs/API.md`: N/A(제품 HTTP API 및 인증 엔드포인트를 신규 생성하지 않는 GitHub read-only 연계)
- `docs/DB_SCHEMA.md`: N/A(SQLite schema·운영 데이터 변경과 Migration 없음)
- `docs/ARCHITECTURE.md`: N/A(기존 Preview·Playwright·QA/Lifecycle 모듈을 확장하며 제품 구조 불변)

## Validation / Status
- **Main F-001/F-002 / PR #900 post-merge:** Original Main [#3582 Attempt1–2](https://github.com/planner77/masterGantt/actions/runs/42487828570), SHA `bafe71b2855561a10c797f495c81449d96f0a62d`: first attempt E2E5 PATCH ECONNRESET (Quality/Docker and 7 other shards PASS), attempt2 **8/8 E2E + Quality/Docker PASS** but GHCR publisher fails to download `ci-oci-main-42487828570-2`; exact original verified Main Docker artifact exists only as `ci-oci-main-42487828570-1`. New F002 is a producer/consumer attempt naming defect, not an application regression. Existing #836 OCI production and `needs.docker_smoke` output carry-forward are **EXTEND/REUSE**; publisher now consumes producer `archive_attempt` instead of current `github.run_attempt` while retaining byte/index digest, attestation, exact SHA, registry and Finalizer gates. Existing `test_ci_image_reuse.py` guards partial-rerun scenario and no re-build/overwrite bypass. See canonical failure ledger appended Main #3582 section. Corrective PR exact Head Full/Trusted/Owner, Main image GHCR and Issue closure **NOT TESTED** before actual CI. Original merged PR is immutable.
- Rework #900 / Full #3580.1: [Run 42483080590](https://github.com/planner77/masterGantt/actions/runs/42483080590), Head `136f927ba4a639d5814e43e29c071629a5ce715f`, base `90c5a1a951c749a9690b1c83e5a74b6d122dd6e3`, test-merge `ff4a0c0d3b908989b67e255de9d4111410cd3e41`: Preflight/Policy/TypeScript/ESLint PASS; Vitest SC-03 참조 오류 1 FAIL(3799 PASS/3 SKIPPED), E2E/Docker NOT RUN, Required3/QA Final 파생 FAIL. 이전 W07 분리 설계를 재사용하고 live `gantt-state-conformance.json`에 현재 두 제목을 등록한다. 기존 실제 AST 검사로 RED(1 FAIL/13 PASS)→GREEN, 관련 Vitest 45 PASS/3 files 및 Python 정책/증거/UAT 73 PASS. 재사용 Node 설치는 브라우저 import의 `unified` 누락으로 Playwright 목록 조회 BLOCKED; 실제 두 W07 시나리오와 Full8/Docker/Trusted/Owner UAT/Manager ACCEPT는 새 exact-Head 검증 전 NOT TESTED. 전체 원장·교정·사전 검토 후 같은 PR의 CI 시작까지만 수행하고 모니터링하지 않는다. [누적 분석](../../ISSUE_895_FAILURE_ANALYSIS.md).
- Rework #900 / Full #3579.1: [Run 42479544101](https://github.com/planner77/masterGantt/actions/runs/42479544101), head `e47edb631208704bc8595022b7eb6066ac709676`: QA Preflight/Policy/Quality/Build/Docker PASS, Chromium 1·2·4·5·6 PASS; 7/8 fails `tests/e2e/project-task-persistence.spec.ts:58` (101 PASS, 1 failed, 6 NOT RUN) at 30-second per-test timeout on last API GET, 3/8 and 8/8 cancelled by matrix. Identical W07 test ran 29.4s PASS (#3577) and 23.1s PASS (#3578); real Playwright trace shows preceding HTTP requests returned, cumulative test limit reached. Reuse existing isolated fixture and all assertions, split long pointer/error/deletion and race/401/native hierarchy scenarios into two independently initialized tests; no timeout, retry, skip, E2E8 or Required gate changes. Next exact-HEAD Full PR CI/Owner UAT NOT TESTED. See docs/ISSUE_895_FAILURE_ANALYSIS.md.
- Rework #900 / Full #3578.1: Run 42475849089, head `6bf821cf9c57941f2e1547b8cb1552b6f99ea277`, Preflight/Policy/Quality/Build/Docker PASS, Chromium 7/8 successful. Shard 2/8 (113 selected / 102 PASS / 11 INCOMPLETE, no observed assertion failure) reached existing 35-minute CI job limit; required E2E and QA Final consequently FAIL. Prior #3577.1 synthetic UI evidence issue was already fixed: shard 3/8 PASS and 1 canonical JSON+PNG manifest verified. Existing test-shard plan reuse: move complete spec `issue-734-equipment-dashboard.spec.ts` 2→8 and `issue-735-system-dashboard.spec.ts` 4→6, preserving 147 unique specs, old #885/#894 planning history, required gates and unchanged 35m limit. Static assignment test adapted to source history; new Head Full CI and Owner UAT NOT TESTED; [cumulative analysis](../../ISSUE_895_FAILURE_ANALYSIS.md).
- Rework #900 / Full #3577.1: Preflight, Policy (including existing Python UAT/Visual Evidence unit), Quality/Build, Docker PASS on prior exact `9f36ccae7dff8bb5887e93867d0ab23dee75c517`; Chromium E2E #3/8 test cases 148 PASS/1 SKIPPED but post-test synthetic evidence validator fails on the `attachments/` JSON copy; #4/8 canceled by matrix. Correct canonical output-root vs Playwright reporter-copy distinction reusing existing scanner/attachments; no new pipeline/approval. Updated Head Full CI still NOT TESTED. Details: docs/ISSUE_895_FAILURE_ANALYSIS.md.
- GitHub remote source changes completed/ongoing; actual local/test CI: NOT TESTED until exact source run. No fake PASS.
- Stage A: reusable contract/advisory visual evidence/manual UAT verification. Stage B auto-blocking UAT required only with a separate Owner authorization after positive and negative remote evidence.
- Final merge/Main/Release/GHCR/Issue closure: NOT AUTHORIZED in this request.
