# Issue #881 — Project workspace 표시 설정 (Owner A안)

- Primary: https://github.com/planner77/masterGantt/issues/881
- Related follow-up (owner-only auth, not prerequisite): https://github.com/planner77/masterGantt/issues/882
- Baseline: main `229604522969133d1ccc6de0477e373252670c86`, 0.142.0, 2026-11-07
- risk_level=HIGH / qa_method=OWNER_MANAGED / qa_required=true / release_required=true / release_authorized=false
- manager_decision=NOT TESTED / MERGE_READY=BLOCKED

## Owner policy / implementation

1. Project-scoped edit session holder may change Issue, dashboard, master tab visibility. Schedule always visible; default all ON. Same Project read gate for GET, server-owned values, no separate Owner-only auth. Owner name is display-only.
2. SQLite migration 0037 adds three checked Boolean-compatible integer columns with DEFAULT 1; old/new rows default ON. Project Copy inherits source. No data deletion or ACL change.
3. Reuse metadata PATCH strong If-Match, Origin, session project binding/recheck inside transaction, revision. Strict three boolean keys; unknown/partial/mistyped rejected. Project DTO always emits canonical workspaceTabs on service path.
4. Project settings fourth tab, separate `workspaceTabs` PATCH without accidental other draft updates; modal busy/cancel and server snapshot update.
5. Shared workspace navigation availability check for primary tabs, deep links, last screen restore, browser back/forward and internal selectScreen. Hidden screens revert to schedule, no new Gantt instance; existing edit/Issue/Task navigation guards persist. Cross-browser visibility follows latest GET/reload, not local preference.

## TEST_LIFECYCLE_REVIEW

Existing contract/security/project-service/project-visibility/project-copy + workspace-navigation + Project Settings E2E searched. **KEEP_UNIQUE** for existing security, concurrency, Gantt and Issue suites; no deletions/skip/timeout adjustment. **ADD** strict three-boolean/migration/session/revision SQLite test (`tests/server/projects/project-workspace-tabs-881.test.ts`) and hidden URL/section navigation test (`tests/features/project-workspace-navigation-881.test.ts`). Existing full CI E2E8/Quality/Docker is required, not locally assumed. Remaining browser validation 390/768/1024/1440/1920, keyboard/ARIA/KO-EN-VI, native125%, real screenreader NOT TESTED pending actual evidence.

## AC_TEST_COVERAGE

- AC1: migration `0037` default-ON / create + historical rows; existing SQLite migration/restart risk noted.
- AC2: same-project edit session and each independent ON/OFF including all OFF; `project-workspace-tabs-881.test.ts` / Project Settings E2E.
- AC3: isolated A/B Project persistence in SQLite; multiple browser sessions/DB reopen and production runtime still need verified evidence.
- AC4: hidden primary tab removal and keyboard semantics; workspace-navigation-881 unit + Project Settings E2E, real ARIA/focus proof pending.
- AC5: URL/legacy/localStorage/back-forward/internal navigation fallback to Schedule; unit/E2E and explicit dirty/pending/Gantt viewport safety review.
- AC6: reenable preserves Issue, Dashboard, Master canonical data and session rights; E2E save/reopen plus existing Project Issue suite preserved.
- AC7: Origin/strong If-Match/session binding/expired/foreign/owner-name spoof/Boolean/unknown key; existing HTTP security + new contract/SQLite regression.
- AC8: Project Copy copies source flags, new creation ON; existing copy/JSON compatibility and migration rollback/runtime pending full verification.
- AC9: KO/EN/VI strings in standalone i18n catalog + unit, responsive/keyboard/real 125% & screenreader remain NOT TESTED until evidence.
- AC10: #711 TEST_LIFECYCLE_REVIEW above, new unit/SQLite/Chromium E2E, PR Full Required3/Trusted QA gates unchanged; initial CI #3534.1 stopped by preflight.
## DOCUMENTATION_SYNC

The following explicit per-path status is checked by trusted `scripts/qa_final_automated.py:docs_gate`; original 5,806-line `docs/TEST_PLAN.md` is preserved from main. A focused [Issue #881 test plan](../../ISSUE_881_TEST_PLAN.md) holds additions.

- `AGENTS.md`: UPDATED
- `DESIGN.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/ISSUE_881.md`: UPDATED
- `docs/ISSUE_881_FAILURE_ANALYSIS.md`: UPDATED
- `docs/ISSUE_881_TEST_PLAN.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(Existing QA review and Owner Managed policy unchanged)
- `docs/CI_CD.md`: N/A(Existing PR Quality E2E8 Docker gate unchanged)
- `docs/TEST_PLAN.md`: N/A(Existing full test lifecycle original preserved, new Issue 881 test plan added)
- `docs/GITHUB_OPERATIONS.md`: N/A(Existing PR CI and GitHub permissions unchanged)
- `docs/REMOTE_VALIDATION.md`: N/A(Existing trusted PR and deployment evidence requirements unchanged)
- `docs/SCHEDULING_ENGINE.md`: N/A(Project schedule calculations and SVAR Core unchanged)
- `docs/IMPORT_EXPORT.md`: N/A(Existing JSON schema contract unchanged)
- `docs/IMPORT_SCHEMA.md`: N/A(No change to import schema or version)
- `docs/UI_UX_GUIDELINES.md`: N/A(Existing dialog focus and keyboard requirements applied)

## 2026-11-07 F881-001 rework — exact provenance

- Original Full Run [#3534.1 / 42305023293](https://github.com/planner77/masterGantt/actions/runs/42305023293), attempt1, HEAD `3842c797cb3106abcf47ae2bb3b93e7c4afb2e67`, main `229604522969133d1ccc6de0477e373252670c86`.
- Direct failures: QA protected route Job 128192084990 (PR body qa_method parser), QA Preflight Job 128192281867 (risk_level / qa_method / qa_required one-field-per-line and DOC_SYNC syntax). Fast gate, aggregate Required3 are derived failures; TypeScript/Vitest/E2E8/Docker were SKIPPED.
- Corrected: PR metadata strict declarations in standalone lines, Work Packet path-by-path sync and individual AC1..AC10 mapping, restore historical 5,806-line `docs/TEST_PLAN.md`, add focused Issue #881 test plan and KO/EN/VI static strings, cancel resets pending display draft. No CI gate weakened.
- New exact PR HEAD and Run/Attempt are recorded only after a real source update and kickoff. Owner-only #882 remains separate.
- Review threads / mergeability are rechecked before new CI kickoff; no monitor/merge/release/finalize.

## F881-002 — 2026-11-07 #3538.1 실제 실패·보완 계획

- **Run:** [Full #3538.1 / 42308983093](https://github.com/planner77/masterGantt/actions/runs/42308983093), attempt 1, HEAD `dce7decd73f9ca5cb8f2c0880238fddbf36e44af`, Base `229604522969133d1ccc6de0477e373252670c86`, 결론 FAILURE. 정책 Preflight·QA 경로·정책 계약은 SUCCESS.
- **직접 원인:** TS2741 pre-0037 fixture missing `workspaceTabs`; React-hooks ESLint error 2건(sync setState effect, useCallback dependency); Vitest 15 failed/3704 pass/3 skipped (10 suites의 마이그레이션 0037 반영 누락, 1 historical calendar test가 pre-0037 컬럼 INSERT). E2E8·Docker·Production Build SKIPPED로 원인 단정 금지. 자세한 직접 Job ID와 중간 결과는 [누적 원장](../../ISSUE_881_FAILURE_ANALYSIS.md) F881-002.
- **보완:** TypeScript legacy ProjectRecord DTO에 default ON, effect microtask 안전 복원+memo deps, 기존 exact migration history 기준 37 목록/개수·최종 버전 갱신. 추가된 checked columns는 이전 원본 row 비교에서만 제외하며 원본 기존 필드는 계속 deep equal, 새 플래그 default1을 직접 assert. 0034 calendar fixture는 historical writer로 INSERT, 원본 row projection + 0037 플래그를 각각 독립 검증한다.
- **TEST_LIFECYCLE_REVIEW:** EXTEND 기존 11개 파일의 역사 DB 업그레이드/SQLite/CLI 회귀 및 Project fixture, KEEP_UNIQUE 전 원본 보존·0 skip·0 assertion 축소. 새 migration 0037을 포함한 마지막 버전 반영이 실패 은폐가 아니도록 원본 SHA·schema_migrations checksum/foreign-key/rollback 검사 유지.
- **AC_TEST_COVERAGE:** AC1/AC8 SQLite 0037 forward migrate, legacy rows·default1·reopen, AC2/AC7 Project metadata session/revision/Boolean, AC4/AC5 safe UI Effect/URL restore, AC6 original unchanged, AC9 multi-language and E2E, AC10 original test-lifecycle conformance. 모든 AC의 기존 위 매핑 계속 유효하며 결과는 새 CI에서 별도 판정.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_881_FAILURE_ANALYSIS.md`: UPDATED; `docs/exec-plans/active/ISSUE_881.md`: UPDATED; `docs/ISSUE_881_TEST_PLAN.md`: UPDATED. 기존 AGENTS/DESIGN/API/DB/SECURITY의 기술 계약 변경 없음. Build/CI/QA gate, 기존 migration 파일 및 #882 owner-only 구분 불변.
- **경계:** 새 HEAD PR Full CI kickoff만 승인. 미해결 리뷰/충돌은 새 커밋의 pre-CI 읽기 결과 기록; CI 결과 모니터링·merge/Main/Release/Finalizer/GHCR/Issue close는 수행하지 않음.

## Verification & release boundary

Remote GitHub connector edits only. There is no locally mounted repository or dependency tree; full TypeScript/Vitest/Playwright/Docker local execution NOT TESTED. Work performed is implementation+commit+new PR to begin full CI; requested stop after kickoff. Existing review threads/mergeable state to be read at PR creation, no monitor after. No merge/Main/GHCR/tag/Issue close/Owner release approval.
