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

## F881-003 — Full PR CI #3540.1 마지막 migration 회귀 보완

- Exact [Run #3540.1 / 42312940879](https://github.com/planner77/masterGantt/actions/runs/42312940879), Attempt1, Head `d30bf51717de1a9f834ef6d6f412ae8506a169e9`, Base `229604522969133d1ccc6de0477e373252670c86`: Quality FAILED; 정책/Preflight·TypeScript·ESLint PASS, Vitest 3/3722 FAIL. E2E8·Docker·Next build SKIPPED; remote Full PASS 아님.
- `database.test.ts` 2건, `project-resource-memberships.test.ts` 1건은 각각 최신 SQLite migration 0037 목록이 누락됐다. 두 파일의 기존 역사 원본 행 비교는 원래 컬럼을 그대로 검증하되 신규 `workspace_*_visible` 세 컬럼 및 이미 별도 확인하는 `visibility`만 제외한다. migration default ON, 기존 DB 데이터·FK·checksum assert는 유지한다.
- TEST_LIFECYCLE_REVIEW: EXTEND 기존 SQLite upgrade/schema acceptance 2개 파일, KEEP_UNIQUE 나머지; 삭제/skip/weakening 0.
- AC_TEST_COVERAGE: AC1/AC3/AC8은 정확한 최신 migration 0037 파일 목록과 Project 신규 플래그 ON default 및 데이터 보존을 기존 테스트에서 재검증; AC2/4/5/6/7/9/10은 위 인수 기준과 새 Full CI 증거가 필요하다.
- DOCUMENTATION_SYNC: `docs/ISSUE_881_FAILURE_ANALYSIS.md`: UPDATED, `docs/exec-plans/active/ISSUE_881.md`: UPDATED, `docs/ISSUE_881_TEST_PLAN.md`: UPDATED. AGENTS.md/DESIGN.md/API.md/DB_SCHEMA.md/SECURITY.md/CI·QA 정책 원문은 기술 계약 변경 없으므로 유지.
- Previous F881-001/002/003 are immutable FAILURE provenance; next exact Head Full PR CI starts via branch synchronize, not a rerun of the old failure. Review/mergeability read-only check; no monitor/merge/Main/GHCR/Issue close.

## F881-004 — #3542.1 E2E 구 탭 인수기준 정렬

- 原 CI [Full #3542.1 / Run42314053741](https://github.com/planner77/masterGantt/actions/runs/42314053741), Attempt1, Head `4d771854c2a4a49d249fa9c8cc64821d11a2caf9`, Base `229604522969133d1ccc6de0477e373252670c86`: QA Preflight/TypeScript/ESLint/Vitest/Build/Required Quality/Docker PASS, Chromium shard8 E2E 단일 직접 FAIL. 전체 E2E Required·QA Final FAILURE.
- `tests/e2e/project-settings-layout-490.spec.ts` #490 E2E의 old 3-tab assumption 때문에 `End` key가 세 번째 `편집·보안`에 포커스되어야 한다고 판정한 오류. #881 새 `화면 표시`는 네 번째이므로 제품 `End`가 마지막 탭으로 이동하는 것이 정상. Source `handleTabKeyDown` 변경·권한 완화 없이 테스트 기대만 바로잡는다.
- **TEST_LIFECYCLE_REVIEW:** EXTEND `tests/e2e/project-settings-layout-490.spec.ts`(기존 E2E End 4곳, 새 4개 탭·아리아 선택/포커스, ArrowLeft 보안 패널 복귀, 실제 비밀번호 변경 PUT pending)과 `tests/e2e/project-settings-dialog-layout.spec.ts`(#232 초안 보존·4-tab End/ArrowLeft). KEEP_UNIQUE 기존 보안·UI/실제 API·5폭/화면·Gantt 원본 검증. Skip/timeout/retry/기존 assertion 약화 0.
- **AC_TEST_COVERAGE:** AC2/AC4/AC5/AC9에 네 번째 탭 표준 keyboard End/ArrowLeft/Home 및 focus, dirty·busy·pending 보존 경로를 추가한다. AC1/3/6/7/8/10은 상단 매핑 유지하며 새 Full CI evidence가 필요하다.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_881_FAILURE_ANALYSIS.md`: UPDATED; `docs/exec-plans/active/ISSUE_881.md`: UPDATED; `docs/ISSUE_881_TEST_PLAN.md`: UPDATED. 정책·제품 키보드 handler/UI/DB/CI workflow는 계약 변경 없음.
- 주의: shard8 Playwright fail-fast 1건 후 다른 6 shards `cancelled`, shard2 SUCCESS. 전체 Chromium8 PASS가 아니며 별도 신 HEAD의 재검증 전 성공 선언 금지. 단일 전체 CI 시작까지만 요청 승인, 이후 모니터링/merge/Main/Release/GHCR/Issue 종료 금지.

## F881-005 / MAIN-001 — 2026-11-07 최신 main alignment

- [PR Full #3546.1 / Run 42320142990](https://github.com/planner77/masterGantt/actions/runs/42320142990), exact Issue Head `eaa64b38f049a8cd2b48806c9ce3ccbf0e95f15b` / old Main 229604522..., Quality/Docker PASS but Chromium E2E shard7 `tests/e2e/i18n-master-data.spec.ts:68` (#866) 180s timeout: 401 후 Cancel 버튼 disabled. Origin·pending state 원인 불명; other 6 shards cancelled by fail-fast. Full8/QA Final FAIL. 수정 없이 새로운 Main 통합 CI에서 재실증하고, 재현 시 #866 독립 분석한다. E2E skip/timeout, unrelated auth code, QA 정책 완화 금지. [F881-005](../../ISSUE_881_FAILURE_ANALYSIS.md).
- GitHub PR #884 before merge: base main `229604522969133d1ccc6de0477e373252670c86` (0.142.0), Head `eaa64b38f049a8cd2b48806c9ce3ccbf0e95f15b`; latest main `8f83083e01a79933d516ac200912de63c3cc45f6` (0.143.0; #880) now has 4 new commits, GitHub mergeable=false/dirty. Explicit align requested by Owner; new PR commit will **include latest main as second parent** rather than force/rebase history.
- 3-way source inventory: #880 ↔ #881 overlap docs CHANGELOG/API/PROJECT_UX/REQUIREMENTS/SECURITY (independent prepend; both retained), package/lock (choose newer 0.144.0), `project-readonly-view.tsx` (3 upstream vs 13 issue disjoint hunks), i18n index (combine scheduleViewMessages and workspaceVisibilityMessages). Other latest-main-only routes, E2E static shard plan, schedule-view projection, UX/assets/tests remain inherited. No conflicting work-around or deletion permitted.
- **TEST_LIFECYCLE_REVIEW:** KEEP_UNIQUE all #880 tests and PR source evidence; EXTEND project-settings #490/#232 tests already present; latest Main 8-shard schedule-views tests and full CI checks remain active. Avoid status conflation of old failed source, new full required and metadata-only checks.
- **AC_TEST_COVERAGE:** AC1–3 settings schema/canonical and source isolation independent of #880; AC4–5 hidden top tabs vs internal WBS/Resource/설비 views remain separate; AC6–8 canonical Task/no-mutating source, server session/revision and DB migration; AC9 KO/EN/VI catalog dual merge and same keyboard expectations; AC10 both suites and no skip.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_881_FAILURE_ANALYSIS.md`: UPDATED, `docs/exec-plans/active/ISSUE_881.md`: UPDATED, `docs/ISSUE_881_TEST_PLAN.md`: UPDATED. Also merge latest main CHANGELOG/API/PROJECT_UX/REQUIREMENTS/SECURITY prepend sections losslessly. Main-only `docs/TEST_PLAN.md` and CI_CD/REMOTE_VALIDATION/ADR updates remain unchanged.
- **New remote validation:** exact 2-parent Merge Head/Tree, Main ancestry, zero unresolved review threads, no merge conflicts, then **Full PR CI start only**. This Work Packet does not assert TypeScript/Vitest/E2E/Docker PASS on new head. No merge/Main CI/Publish/Finalizer/Issue completion.

## MAIN-001 merge object — exact source

- Git merge object `d7b5874ad6c7d9963d2216d908d0ba6a1f753849`: first parent Issue #881 `eaa64b38f049a8cd2b48806c9ce3ccbf0e95f15b`, second parent latest main/#880 `8f83083e01a79933d516ac200912de63c3cc45f6`; resulting tree `44770f65375e8f4d6248dfc8bcc43c2c7c479798`. User-requested main alignment without force push. Both Gantt source #880 and top-level display #881 present in tree; i18n registry includes both catalogs.
- Source tree read-back verified, branch update and CI result remain distinct steps. Historical failure #3546.1 not relabeled PASS. E2E8/Required3/Trusted QA/Owner acceptance must be obtained for final exact Head.

## F881-006 — #3548.1 좁은 화면 설정 탭 포커스 클리핑 보완

- **원본:** [Full #3548.1 / Run42326071407](https://github.com/planner77/masterGantt/actions/runs/42326071407), attempt1, Head `65dc51c35bd26edccc5a7c8f79c01698f9bbc2e1`, Base latest main `8f83083e01a79933d516ac200912de63c3cc45f6`: policy/Preflight/TypeScript/Lint/Vitest/Next build/Quality/Docker PASS, Chromium shard8 #490 focused `화면 표시` 탭의 390px focus outline right449px이 clip-owner right357px 밖으로 나가 FAIL. 나머지 shards 7개는 fail-fast로 CANCELLED, E2E8/QA Automated FAIL.
- **UI 원인/조치:** 기존 세 탭용 horizontal flex row에 네 번째 설정 탭 추가. 1440px에서 focused End 탭이 390px로 리사이즈될 때 가로 클리핑이 남음. `project-settings-dialog.module.css`에서 `max-width:48rem` 시 wrap을 허용해 네 탭 전부 보이고 기존 6px outline inset/desktop single-line 유지. DOM tab order/aria, password/edit session/Project metadata/Gantt 변경 없이 수정.
- **TEST_LIFECYCLE_REVIEW:** KEEP_UNIQUE 기존 `#490` 5-width capture+focused outline geometry, EXTEND `tests/e2e/project-settings-dialog-layout.spec.ts` viewport transition 1440→390 with active fourth tab, explicit focus-ring boundary and no horizontal document scroll, focus retained through 390/768/1024/1440. Failed E2E regression remains enabled; no skip, timeout/retry/threshold modification.
- **AC_TEST_COVERAGE:** AC4 keyboard/ARIA/focused 4-tab DOM, AC5 active tab while resizing with no hidden bypass/dirty loss, AC9 390/768/1024/1440/1920 geometry + 6px ring, AC10 existing #490 and #232 preservation; all other AC mappings remain above. Browser E2E/new Head evidence still NOT TESTED.
- **DOCUMENTATION_SYNC:** `docs/PROJECT_UX.md`: UPDATED; `docs/ISSUE_881_FAILURE_ANALYSIS.md`: UPDATED; `docs/ISSUE_881_TEST_PLAN.md`: UPDATED; `docs/exec-plans/active/ISSUE_881.md`: UPDATED. Existing AGENTS/DESIGN/API/DB/SECURITY/CI/QA contracts unchanged.
- **작업 한계:** 신규 exact-head full PR CI 시작과 단발성 충돌·review 확인까지; 이후 모니터링, 승인, merge, Main CI, GHCR, Issue close 미실행.

## Verification & release boundary

Remote GitHub connector edits only. There is no locally mounted repository or dependency tree; full TypeScript/Vitest/Playwright/Docker local execution NOT TESTED. Work performed is implementation+commit+new PR to begin full CI; requested stop after kickoff. Existing review threads/mergeable state to be read at PR creation, no monitor after. No merge/Main/GHCR/tag/Issue close/Owner release approval.
