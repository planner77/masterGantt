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
- MAIN_CORRECTIVE_REUSE_SCOPE: 병합된 PR #900의 Main·PR 필수 검증과 과거 판정은 유지한다. 후속 PR #901은 기존 `.github/workflows/ci.yml` 안에서 `docker_smoke`가 OCI를 생산한 실제 Attempt 번호를 `publish-commit-image`에 전달하는 범위에 한정한다. 별도 CI·Release 파이프라인, 필수 Check, 태그 권한, 테스트 실행기 또는 권한을 추가하지 않는다. 기존 #836 OCI index·archive SHA256 및 Main Docker 검증·게시 보호 계약은 **REUSE_AS_IS**, 시도 번호 전달만 **EXTEND**하며 기존 Owner의 재사용 우선 및 이번 Main 실패 보완 지시를 따른다.

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
이번 표는 **후속 PR #901의 변경 파일**을 기준으로 한다. 원래 PR #900에서 실제 변경한 문서들은 과거의 UPDATED 이력으로 유지하며, 이 PR에서는 변경하지 않았다는 사실과 그 이유를 별도로 표시한다.
- `AGENTS.md`: N/A(원본 PR 900에서 규정 반영 완료, 이번 변경은 기존 CI 내부 OCI 생산 Attempt 전달만 수정)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 Owner 관리 QA와 인증된 Trusted 및 필수 검증 조건 변경 없음)
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: N/A(기존 대용량 테스트 이력 보존, 신규 검증은 TEST_PLAN_895_897.md에 추가)
- `docs/TEST_PLAN_895_897.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 GHCR 게시 운영과 권한 규정 유지, 생산 Attempt 변경은 CI_CD.md에 기록)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 Run과 Attempt 및 SHA 출처 검증 규칙을 그대로 사용)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 Issue 승인 및 Finalizer 종료 순서 변경 없음)
- `docs/AGENT_PROMPTS.md`: N/A(기존 재사용 질의와 에이전트 책임 규칙 변경 없음)
- `docs/PREVIEW_PUBLISH.md`: N/A(Preview와 UAT 단계가 아닌 Main OCI 게시 계약만 수정)
- `docs/UI_UX_GUIDELINES.md`: N/A(화면 UI 및 시각 검증 동작 변경 없음)
- `DESIGN.md`: N/A(제품 UI와 레이아웃 수정 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정 계산 및 의존성 로직 변경 없음)
- `docs/API.md`: N/A(제품 HTTP API 경로 및 인증 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite 테이블 및 Migration 변경 없음)
- `docs/ARCHITECTURE.md`: N/A(기존 OCI 게시 파이프라인만 수정하고 서비스 구조 변경 없음)

## Validation / Status
- **PR #901 / Full #3587.1 사전 검사 실패:** [Run 42516438448.1](https://github.com/planner77/masterGantt/actions/runs/42516438448), Head `5ca7ef14e482e91a1c10f27e6ab95c69e60aada8`, Base `bafe71b2855561a10c797f495c81449d96f0a62d`. 원본 `QA Preflight`의 유일한 직접 실패는 `DOCUMENTATION_SYNC`에서 이전 PR #900의 `AGENTS.md: UPDATED`를 이번 PR #901의 변경으로 잘못 기록한 것. Quality·E2E·Docker 본 검증은 차단되어 NOT RUN; Required3 및 QA Final 실패는 파생 판정. 추가 P1 미해결 리뷰는 신규 CI 운영 설명과 workflow 주석의 한글 작성 문제. 이번 Work Packet은 #901 영향 표를 정확하게 N/A 사유로 교정하고 신규 설명을 한글로 정리했으며 원래 #900 기록은 이력으로 보존한다. 수정 HEAD의 필수 CI·Trusted QA는 **NOT TESTED**.
- **기존 Main #3582.3와 #895 완료 실적 재사용:** 동일 Main `bafe71b2855561a10c797f495c81449d96f0a62d` [Main #3582.3](https://github.com/planner77/masterGantt/actions/runs/42487828570)와 [Generic Finalizer #1474.1](https://github.com/planner77/masterGantt/actions/runs/42517047238) 성공, #895 CLOSED. 당시 Docker Smoke와 Main OCI 임시 게시·SHA256 검증 및 임시 Candidate 삭제는 완료했으며 #896/#897은 OPEN. 이는 재발 방지 PR #901의 새 HEAD에 대한 PASS가 아니라 재사용 가능한 기존 운영 결과다.
- **Main F-001/F-002 / PR #900 post-merge:** Original Main [#3582 Attempt1–2](https://github.com/planner77/masterGantt/actions/runs/42487828570), SHA `bafe71b2855561a10c797f495c81449d96f0a62d`: first attempt E2E5 PATCH ECONNRESET (Quality/Docker and 7 other shards PASS), attempt2 **8/8 E2E + Quality/Docker PASS** but GHCR publisher fails to download `ci-oci-main-42487828570-2`; exact original verified Main Docker artifact exists only as `ci-oci-main-42487828570-1`. New F002 is a producer/consumer attempt naming defect, not an application regression. Existing #836 OCI production and `needs.docker_smoke` output carry-forward are **EXTEND/REUSE**; publisher now consumes producer `archive_attempt` instead of current `github.run_attempt` while retaining byte/index digest, attestation, exact SHA, registry and Finalizer gates. Existing `test_ci_image_reuse.py` guards partial-rerun scenario and no re-build/overwrite bypass. See canonical failure ledger appended Main #3582 section. Corrective PR exact Head Full/Trusted/Owner, Main image GHCR and Issue closure **NOT TESTED** before actual CI. Original merged PR is immutable.
- Rework #900 / Full #3580.1: [Run 42483080590](https://github.com/planner77/masterGantt/actions/runs/42483080590), Head `136f927ba4a639d5814e43e29c071629a5ce715f`, base `90c5a1a951c749a9690b1c83e5a74b6d122dd6e3`, test-merge `ff4a0c0d3b908989b67e255de9d4111410cd3e41`: Preflight/Policy/TypeScript/ESLint PASS; Vitest SC-03 참조 오류 1 FAIL(3799 PASS/3 SKIPPED), E2E/Docker NOT RUN, Required3/QA Final 파생 FAIL. 이전 W07 분리 설계를 재사용하고 live `gantt-state-conformance.json`에 현재 두 제목을 등록한다. 기존 실제 AST 검사로 RED(1 FAIL/13 PASS)→GREEN, 관련 Vitest 45 PASS/3 files 및 Python 정책/증거/UAT 73 PASS. 재사용 Node 설치는 브라우저 import의 `unified` 누락으로 Playwright 목록 조회 BLOCKED; 실제 두 W07 시나리오와 Full8/Docker/Trusted/Owner UAT/Manager ACCEPT는 새 exact-Head 검증 전 NOT TESTED. 전체 원장·교정·사전 검토 후 같은 PR의 CI 시작까지만 수행하고 모니터링하지 않는다. [누적 분석](../../ISSUE_895_FAILURE_ANALYSIS.md).
- Rework #900 / Full #3579.1: [Run 42479544101](https://github.com/planner77/masterGantt/actions/runs/42479544101), head `e47edb631208704bc8595022b7eb6066ac709676`: QA Preflight/Policy/Quality/Build/Docker PASS, Chromium 1·2·4·5·6 PASS; 7/8 fails `tests/e2e/project-task-persistence.spec.ts:58` (101 PASS, 1 failed, 6 NOT RUN) at 30-second per-test timeout on last API GET, 3/8 and 8/8 cancelled by matrix. Identical W07 test ran 29.4s PASS (#3577) and 23.1s PASS (#3578); real Playwright trace shows preceding HTTP requests returned, cumulative test limit reached. Reuse existing isolated fixture and all assertions, split long pointer/error/deletion and race/401/native hierarchy scenarios into two independently initialized tests; no timeout, retry, skip, E2E8 or Required gate changes. Next exact-HEAD Full PR CI/Owner UAT NOT TESTED. See docs/ISSUE_895_FAILURE_ANALYSIS.md.
- Rework #900 / Full #3578.1: Run 42475849089, head `6bf821cf9c57941f2e1547b8cb1552b6f99ea277`, Preflight/Policy/Quality/Build/Docker PASS, Chromium 7/8 successful. Shard 2/8 (113 selected / 102 PASS / 11 INCOMPLETE, no observed assertion failure) reached existing 35-minute CI job limit; required E2E and QA Final consequently FAIL. Prior #3577.1 synthetic UI evidence issue was already fixed: shard 3/8 PASS and 1 canonical JSON+PNG manifest verified. Existing test-shard plan reuse: move complete spec `issue-734-equipment-dashboard.spec.ts` 2→8 and `issue-735-system-dashboard.spec.ts` 4→6, preserving 147 unique specs, old #885/#894 planning history, required gates and unchanged 35m limit. Static assignment test adapted to source history; new Head Full CI and Owner UAT NOT TESTED; [cumulative analysis](../../ISSUE_895_FAILURE_ANALYSIS.md).
- Rework #900 / Full #3577.1: Preflight, Policy (including existing Python UAT/Visual Evidence unit), Quality/Build, Docker PASS on prior exact `9f36ccae7dff8bb5887e93867d0ab23dee75c517`; Chromium E2E #3/8 test cases 148 PASS/1 SKIPPED but post-test synthetic evidence validator fails on the `attachments/` JSON copy; #4/8 canceled by matrix. Correct canonical output-root vs Playwright reporter-copy distinction reusing existing scanner/attachments; no new pipeline/approval. Updated Head Full CI still NOT TESTED. Details: docs/ISSUE_895_FAILURE_ANALYSIS.md.
- GitHub remote source changes completed/ongoing; actual local/test CI: NOT TESTED until exact source run. No fake PASS.
- Stage A: reusable contract/advisory visual evidence/manual UAT verification. Stage B auto-blocking UAT required only with a separate Owner authorization after positive and negative remote evidence.
- Final merge/Main/Release/GHCR/Issue closure: NOT AUTHORIZED in this request.
