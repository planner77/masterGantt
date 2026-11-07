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

이 첫 섹션은 MAIN-881-001 **교정 PR 단독 diff**의 신뢰된 QA Preflight 경로 정책이다. 이전 #884 초기 구현의 UPDATED 기록은 아래 원본 F881-001~007 이력 및 커밋으로 별도 보존하며 새 PR에 그대로 오인 적용하지 않는다.

- `AGENTS.md`: N/A(기존 한 줄 병합 제목·CI 정책 계약을 변경하지 않고 준수)
- `DESIGN.md`: N/A(제품 시각·Gantt 상호작용 코드는 이번 교정 PR에서 변경 없음)
- `docs/API.md`: N/A(Project API 및 인증 DTO를 변경하지 않음)
- `docs/DB_SCHEMA.md`: N/A(기존 SQLite migration 0037 포함 schema를 변경하지 않음)
- `docs/SECURITY.md`: N/A(Project 세션·보안 규약을 변경하지 않음)
- `docs/PROJECT_UX.md`: N/A(프로젝트 화면 표시·Gantt 레이아웃 변경 없음)
- `docs/REQUIREMENTS.md`: N/A(기존 AC1~AC10 사용자 요구를 변경하지 않음)
- `CHANGELOG.md`: N/A(0.144.0 버전·기능 원본과 이미 작성한 변경 이력 유지)
- `docs/exec-plans/active/ISSUE_881.md`: UPDATED
- `docs/ISSUE_881_FAILURE_ANALYSIS.md`: UPDATED
- `docs/ISSUE_881_TEST_PLAN.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(OWNER_MANAGED HIGH·Trusted QA 및 필수 증거 정책 불변)
- `docs/CI_CD.md`: N/A(검증기를 약화하거나 Required3 및 Main E2E8을 바꾸지 않음)
- `docs/TEST_PLAN.md`: N/A(기존 테스트 정책을 유지하고 Issue 881 집중 테스트 계획으로 회귀 기록)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 one-line empty-body merge API 운영 계약을 변경하지 않고 적용)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 PR Full·Trusted·Main 출처 증명과 GHCR 검증 요구 불변)
- `docs/SCHEDULING_ENGINE.md`: N/A(SVAR Gantt scheduling source를 변경하지 않음)
- `docs/IMPORT_EXPORT.md`: N/A(입출력 계약 및 데이터 포맷 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(Import schema와 버전 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(제품 UI 스타일·상호작용은 이번 교정 PR에서 변경 없음)

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

## F881-007 — Full #3550.1 native choice text-field 검사 충돌 (2026-11-07 KST)

- [Run42328258833 #3550.1](https://github.com/planner77/masterGantt/actions/runs/42328258833), attempt1, old exact HEAD `0d03b3b76ecf5814b0764ef126d72ad5624104d8` / base main `8f83083e01a79933d516ac200912de63c3cc45f6`. QA preflight, TypeScript, ESLint, Vitest, Next, Quality, Docker PASS. Chromium shard8 E2E #490 `capture490("tab-display-focus")` at helper `ui-geometry.ts:54` expected all 1px borders but display's native checkbox can have no computed border. 99 passed, 1 failed, 13 not run; 7 other shards cancelled; E2E/QA Final derived failure. Exact details [F881-007](../../ISSUE_881_FAILURE_ANALYSIS.md). Previous F881-006 ring clipping was not the assertion triggered this time.
- **Design/Implementation:** the fourth Settings tab's 3 native choices must not inherit `form-field` text input width100%/padding, so use `styles.visibilityOption` on label with 20px native checkbox, 44px label hit-area, semantic color/focus-visible, no document overflow. Keep Issue/dashboard/master check state, session PATCH/validation/DB and Gantt unchanged.
- **TEST_LIFECYCLE_REVIEW:** EXTEND `tests/e2e/helpers/issue490-settings-fixture.ts` and `tests/e2e/project-settings-dialog-layout.spec.ts` (do not retire #490/#232). Text inputs still require 1px border/background/labels; native checkbox/radio separately require labels, 16~32px non-stretched size, browser-native appearance; #881 three checkboxes additionally 18~28px, 44px label, Tab focus outline, Space OFF/ON. Existing actual #490 five widths, tab clipping, auth, pending, Origin/If-Match, actual keyboard, assertions, retry/skip/timeout/Required E2E8 remain intact.
- **AC_TEST_COVERAGE:** AC2 three independent toggle values and keyboard operation; AC4 tab content ARIA/focus; AC5 tab refocus/multi-viewport; AC9 390/768/1024/1440/1920, 44px native choice, KO/EN/VI UI; AC10 unchanged trusted Full8 gates. Other AC paths and original tests untouched. New HEAD exact Full CI evidence required, native125%/screenreader manual NOT TESTED.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_881_FAILURE_ANALYSIS.md`: UPDATED; `docs/exec-plans/active/ISSUE_881.md`: UPDATED; `docs/ISSUE_881_TEST_PLAN.md`: UPDATED. AGENTS.md/DESIGN.md/PROJECT_UX.md/UI_UX_GUIDELINES.md/NFR source contracts and QA/CI/Lifecycle unchanged; UI implements existing 44px/semantic focus guidance. No merge/Main/GHCR/Finalizer/issue closure or CI monitoring requested.

## MAIN-881-001 — 같은 Issue의 최초 Main trace 실패 복구 준비

- Source PR #884 [Full CI #3551.1 / Run42339976906](https://github.com/planner77/masterGantt/actions/runs/42339976906) / [Trusted #1198.1 / Run42342272396](https://github.com/planner77/masterGantt/actions/runs/42342272396)는 정확 원본 HEAD `b6d64ef0...`에서 성공. 병합 SHA `8efe2d90d9de9194587648c77499665ff68c3615`, 첫 부모 `8f83083...`, 둘째 부모 `b6d64ef...`, 버전 `0.144.0`.
- [Main #3552.1 / Run42345455498](https://github.com/planner77/masterGantt/actions/runs/42345455498) 최초 직접 실패는 Changes Job128322093695 Step8 `verify-ci-run-trace.py`의 multiline merge message rejection. Required Quality/E2E/Docker FAIL은 파생, 실제 구현 Job·Main image 미실행. [MAIN-881-001 누적 원장](../../ISSUE_881_FAILURE_ANALYSIS.md)을 따름. 원본 Main/이전 PR CI를 PASS로 덮어쓰지 않는다.
- **TEST_LIFECYCLE_REVIEW:** `EXTEND` `scripts/verify-issue-lifecycle.py` 기존 #582/#586/#603/#639/#808/#825/#854의 merge trace contract에 원본 881 negative 및 SHA-leased/empty-body corrective positive 추가. `KEEP_UNIQUE` #881 SQLite/Project 보안/Chrome 8과 기존 Policy/Finalizer tests. 새 test 파일 없이 기존 suite assertion은 강화하며 skip·timeout·문서 원본 삭제 0.
- **AC_TEST_COVERAGE:** AC10는 merge provenance, original Run/Attempt attribution, immutable failure, 표준 corrective payload 및 exact HEAD PR CI/Trusted/8샤드/Required3 검증; AC1~AC9는 기존 #881 실제 제품 스위트 보존, Main trace 실패로 실행되지 않은 Main 제품 Job은 NOT RUN.
- **릴리스 범위:** Owner 정식 GHCR 승인 Issue comment `6703144666` (`expected_version=0.144.0`) 유지, 별도 #882 owner-only 인증은 본 이슈 선행 아님. 같은 Issue 연속 non-docs corrective + 버전 무변경 시 Generic Finalizer가 처음 실패 merge의 릴리스 의무를 포함하는지 신뢰된 main CI 후 확인. 이전 Main #3552.1은 FAILURE 유지.
- **병합 시 강제:** 새로운 PR 생성·정확 Head의 Full PR CI Required3+Chromium8/8 및 default-main Trusted SUCCESS·리뷰 0/충돌 0/strict latest Main+Owner HIGH 수용 후 `main_ci_run_name.merge_api_payload(881, newPR, \"프로젝트 화면 표시 Main CI 복구\", newHead)`의 `commit_title` 및 `commit_message=\"\"`, `expected_head_sha` 전부 적용. 정식 병합이 실패하면 main 직접 push·CI 우회 금지. 새 Main push Run 시작 뒤 모니터링 중단, GHCR/Release/Issue close는 자동 Fail-closed Finalizer에 맡기고 증거 미확보를 완료로 주장하지 않는다.\n
## F881-008 — #3553.1 QA Final P1 리뷰 대응

- **원본:** [PR #886 Full #3553.1 / Run42346136823](https://github.com/planner77/masterGantt/actions/runs/42346136823), HEAD `ba48d1e9a27ef422968245e8ccd9530bd8c13314` / base `8efe2d90d9de9194587648c77499665ff68c3615`. QA Preflight/Policy/TypeScript/ESLint/Vitest/Next Build/실제 Docker 및 Required3 SUCCESS, QA Final Job128325720208만 미해결 P1 리뷰로 직접 FAIL. `E2E_REQUIRED=false`에 따라 E2E 8개 구현 샤드 `skipped/NOT RUN`; E2E aggregate SUCCESS는 실실행 Full8 증거가 아님. [F881-008 실패 원장](../../ISSUE_881_FAILURE_ANALYSIS.md) 참고.
- **리뷰:** [#4500452016](https://github.com/planner77/masterGantt/pull/886#discussion_r4500452016)에서 신규 `scripts/verify-issue-lifecycle.py` 설명·오류 문구를 한글로 작성하도록 P1 지적. `AGENTS.md` CI/CD 한글 작성 원칙을 준수하되 immutable `failed_881_message` 원본 fixture는 번역 금지. 신규 주석/직접 작성 오류 문자열 세 건만 한글화. QA Gate 우회 없이 스레드 응답·해결.
- **TEST_LIFECYCLE_REVIEW:** EXTEND 기존 #881 음성/양성 검증을 같은 의미로 유지한 채 사람용 설명 한글화; KEEP_UNIQUE 기존 Main #582/#586/#603/#639/#808/#825/#854 회귀와 프로젝트 보안/SQLite/E2E. 시나리오 삭제·skip·timeout·retry 변경 없음.
- **AC_TEST_COVERAGE:** AC10의 정책 검증/리뷰 문구 및 원본 Main 실패 출처, AC1~9 기존 제품 기능 검증 범위 유지. 운영 배포·GHCR/최종 종료는 여전히 신 Main CI 및 릴리스/Finalizer 게이트가 필요하다.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_881_FAILURE_ANALYSIS.md`, `docs/exec-plans/active/ISSUE_881.md`, `docs/ISSUE_881_TEST_PLAN.md`: UPDATED; `AGENTS.md`와 `DESIGN.md`, CI/QA/SECURITY 등 정책 문서: N/A(기존 정책을 따르는 국소 수정으로 계약 자체는 불변). 첫 `## DOCUMENTATION_SYNC`의 상세 경로별 상태 유지.
- **실행 경계:** 새 exact-HEAD PR CI 시작까지만 진행; 모니터링·병합·Main CI/GHCR·Issue 종료는 이번 요청의 범위 밖. 신규 CI 성공 결과는 시작만으로 주장하지 않는다.
