## PR #879 FULL-B002 — #3513.1 QA Preflight 문서 영향 누락 및 물류 유형 편집 P2 (2026-11-05 KST)

### 원본 Run·Job·직접 실패

- [PR #879](https://github.com/planner77/masterGantt/pull/879) Full CI **#3513.1 / [Run 41943199412, Attempt 1](https://github.com/planner77/masterGantt/actions/runs/41943199412)**, pull_request synchronize, HEAD `20f106f39f90d838193234c5bb0320977fe4af91`, base/main `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `1645f96490dc08e09efbe082c38b4de4f84213f4` (changes Job 126968856393 checkout log). Original completed FAILURE, original Fast non-authoritative skipped.
- **직접 FAIL: QA Preflight Job 126968984659, step 4, DOCUMENTATION_SYNC**: `docs/exec-plans/active/ISSUE_866.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — 문서 영향 기록 없음: docs/IMPORT_SCHEMA.md`. `FAIL=1, DEFERRED=5`. `PRIMARY_ISSUE, RISK_LEVEL, QA_METHOD, QA_REQUIRED, RELEASE_REQUIRED, RELEASE_AUTHORIZED, PATH_POLICY, ISSUE_AC`는 PASS. PR base=main 정책은 이번에는 PASS이며 #3510.1과 다른 원인이다.
- **파생 FAIL:** PR Fast Gate Job 126969113413 (PREFLIGHT_RESULT=failure), Required Quality 126969223864, Chromium E2E 126969223984, Docker 126969223914, QA Final 126969265352 (required quality 미성공). Policy/TypeScript/ESLint/Vitest/Next build, Chromium8 실제 실행 및 Docker implementation 전부 SKIPPED/NOT RUN. changes 126968856393 및 영향 Shadow 126969265079 SUCCESS는 제품 테스트 성공 근거 아님. 취소 샤드에서 별도 직접 FAIL을 확인하지 못함.
- 원인 분류: **POLICY_CI / DOCUMENTATION_SYNC 기록 누락**. Phase B는 Copy/Template version 6과 일정 JSON/Excel 손실 방어 409를 변경했으나 `docs/IMPORT_SCHEMA.md`의 영향 여부를 Work Packet의 현재 Phase B 문서 표에 명시하지 않았다. 스키마/Import 런타임 자체가 실패했다고 해석하지 않음.

### 리뷰 결함과 보완·검증 경계

- 별도 Code Review **P2**, [discussion r4475215195](https://github.com/planner77/masterGantt/pull/879#discussion_r4475215195): `src/features/logistics/logistics-type-catalog-admin.tsx`의 `saveEdit`는 412로 최신 목록을 갱신한 후에도 기존 번역 draft를 새로운 revision의 If-Match로 재전송할 수 있다. 이전 #3510.1 보완은 `TranslationEditor` 공통 컴포넌트(글로벌 Project Master/Resource Group)에만 적용되어 물류 유형 화면이 빠졌다. 이번 P2는 **실제 E2E 미실행 상태에서 발견된 정적 Code Review 결함**이며 직접 CI 오류는 아님.
- **설계/수정:** `docs/IMPORT_SCHEMA.md`에 schedule JSON 1.0/1.1 스키마 불변, 지원하지 않는 owner 번역 key strict reject, 복제/Template v6 사용, 기존 일정 Export 409 손실 차단 의미를 설명한다. Work Packet `DOCUMENTATION_SYNC`에 UPDATED 경로와 이유를 등록한다. 코드상 Import schema/API/CI 게이트는 변경하지 않는다.
- 물류 유형 편집의 **start revision**을 draft와 함께 보존하고 `catalog.data.revision`과 불일치하면 role=alert와 저장 disabled + submit 방어로 오래된 다국어 전체 replacement PATCH 차단. 취소 후 최신 항목을 재열어야 새 revision을 사용한다. 401 재인증/412 최신 조회·기존 서버 CAS/Origin 인증/권한은 유지한다.
- **TEST_LIFECYCLE_REVIEW:** EXTEND `tests/e2e/logistics-type-catalog-admin.spec.ts` mock HTTP: 최초 If-Match revision4→상대방 vi 변경 후412→최신 revision5 조회→기존 en 초안 보존, 두 번째 저장 차단 및 PATCH1회→명시 취소 후 최신 vi 확인→재저장 If-Match5/PATCH2회, vi 값 보존. KEEP_UNIQUE `tests/e2e/resource-catalog-delete.spec.ts` 공통 editor 동시수정 회귀, Phase A/Phase B Unit/SQLite/HTTP/Copy/Template/Import/Export 및 8-shard 145 spec. 신규 E2E 파일 추가/샤드 이동/timeout·retry·gate 완화 없음.
- **전체 이력 교차:** #878 FULL-001 E2E shard count 계약, FULL-002 SVAR en-US 헤더 계약 → #3509.1 성공은 Phase A Head 범위만; #879 FULL-B001 #3510.1 main 대상 아닌 PR의 Preflight BLOCKED → base main으로 변경되면서 이번 #3513.1에서는 정책 검사 통과; FULL-B002는 `docs/IMPORT_SCHEMA.md` 문서 영향 미기록 신규 원인. 선행 Codex P1 대용량 `TEST_PLAN.md` 유실은 이전 보완 commit 20f106f의 원본 Blob 복원으로 해결했으며 해당 문서는 이번 변경에서 그대로 보존한다. 구 #870/LLM/Issue UI 직접 실패는 독립 Source로 유지.
- **교차 소비자 합집합:** `docs/IMPORT_SCHEMA.md`, `docs/IMPORT_EXPORT.md`, `docs/exec-plans/active/ISSUE_866.md`, `docs/I18N_PHASE_B.md`, `tests/e2e/logistics-type-catalog-admin.spec.ts`, `src/features/logistics/logistics-type-catalog-admin.tsx`, `src/components/translation-fields.tsx`, `tests/e2e/resource-catalog-delete.spec.ts`, 기존 SQLite/HTTP/Copy/Template/Import/Export/Phase A specs. 새로운 Head의 실제 Node/TypeScript/Vitest/E2E8/Docker/Trusted 테스트는 **NOT TESTED**, 실패 Run #3513.1을 소급 PASS로 전환하지 않는다.
- 위험: HIGH / OWNER_MANAGED / qa_required=true / release_required=true / release_authorized=false, Issue #866 OPEN, PR #878/#879 미병합. 최신 Main 및 미해결 review/mergeability 재확인 후 신규 Full CI. 운영 DB 0036 백업·복구와 Phase C 전체 현지화는 남아 있음.

## PR #879 FULL-B001 — #3510.1 QA Preflight의 non-main base 정책 차단 (2026-11-05 KST)

### A. 원본 실행 및 직접·파생 구분

- Primary Issue #866 / PR #879. Full PR CI #3510.1: https://github.com/planner77/masterGantt/actions/runs/41941093006 (Run 41941093006, Attempt 1, pull_request.opened, FAILURE). HEAD dfc967258f5fa0cc8e188d116cdccd734f49c771; 이벤트 Base 8fca83bbc12cf516cd7f22438fa16c6b596d80fb (Phase A PR #878); Checkout test-merge 28d4bb5ece15503393808ecbcc5410168264fe02. 추후 PR base 갱신이 과거 이벤트 출처를 소급 변경하지 않는다.
- **직접 차단:** QA Preflight Job 126961958453 / step 4, 원본 base SHA의 scripts/qa_preflight.py 실행. 정책 코드 71행은 live pull request base.ref == main을 필수로 검사한다. 실제 PR base.ref=feat/issue-866-i18n-phase-a-main이므로 BLOCKED. 원본 출력: 'PR 최신 Head/base 변경·대상 저장소 불일치 (새 full CI 필요)'; deterministic FAIL=0, DEFERRED=0. 출처 API 오류/제품·SQLite 오류라는 증거는 없음. 분류 POLICY_CI / PR_BASE_CONTRACT.
- **파생:** PR Fast Gate Job 126962081626 FAILURE (PREFLIGHT_RESULT=failure, Policy/TypeScript/Lint/Vitest 모두 SKIPPED), Required Quality 126962207510 / E2E 126962207560 / Docker 126962207386 FAILURE 집계, QA Final 126962252068 FAILURE (required quality 미성공). Policy, ESLint, TypeScript, Vitest, Next Build, Chromium 8 shards, 실제 Docker implementation 전부 SKIPPED/NOT RUN. changes 126961782052 및 impact shadow 126962252220 SUCCESS는 구현 PASS 근거 아님.
- 독립 리뷰: Codex top-level comment https://github.com/planner77/masterGantt/pull/879#issuecomment-6646137991 (P1 Test Plan 의도치 않은 5762줄 삭제, P2 오래된 TranslationEditor draft가 최신 revision을 차용해 다른 관리자 vi 변경을 덮을 수 있는 silent lost update). 별도 리뷰 스레드 목록 최초 0건; 두 리뷰 지적은 #3510.1 Preflight의 직접 실패 원인이 아니며 보완 범위로 분리한다.

### B. 전체 실패 이력 교차·설계·보완

- #878의 FULL-001 shard count TEST_CONTRACT, FULL-002 SVAR 영어 header TEST_CONTRACT 원본 기록 불변. 성공한 #878 Full #3509.1 (Run 41930396372)는 Phase A HEAD 8fca83...에만 유효하며 #879 신규 코드의 PASS 근거 아님. 이전 통합 #870의 LLM/Issue UI 및 HTTP failures 역시 별도 source.
- POLICY_CI: scripts/qa_preflight.py, workflows/ci.yml, Required3, Trusted/Owner 정책을 변경하지 않는다. PR #879의 대상만 main으로 전환하여 Phase A+B 합산 diff를 올바른 Main-target Full CI로 검증한다. PR #878/879 병합, GHCR, Issue #866 종료는 여전히 HOLD.
- P1 DOCUMENT_INTEGRITY: 이전 코드 작성 시 대용량 docs/TEST_PLAN.md의 fetch_file content가 빈 문자열로 돌아와 6줄 요약으로 잘못 대체했다. Phase A base의 원본 Blob SHA 990eee5eb1e21cbffcd091b1331dba315d5990ee (829625 UTF-8 chars, 5765 LF 포함 줄수)를 별도 fetch_blob으로 확인하고 Git Tree에 SHA 원본으로 복원. Main 원본이 아니라 Phase A에서 갱신된 문구까지 보존. #711 Test Lifecycle/#697 정책 삭제 방지. Phase B 계획은 Work Packet/원장 및 별도 설계에 문서화한다.
- P2 CONCURRENT_EDIT: TranslationEditor 캐시 초안을 값만 저장하는 방식에서 revision+translations snapshot으로 변경, 처음 열 때의 catalogRevision을 고정한다. Project Master/Resource Group 양쪽에서 revision 전달, 401 재인증과 412 재조회 후에도 draft의 원래 revision 유지. 현재 revision이 다르면 role=alert, save disabled와 클릭 가드, 원본 초안 보존. 사용자는 취소 후 최신 row를 다시 열어 명시적으로 새 번역을 확인한다. 서버 If-Match/권한/Origin/CAS는 변경하지 않음.
- TEST_LIFECYCLE_REVIEW: 기존 tests/e2e/resource-catalog-delete.spec.ts에 다른 관리자 Vietnamese 갱신과 카탈로그 새로고침, 기존 English draft 보존, stale PATCH=0, 안내, 취소/다시 열기, 최신 revision PATCH와 Vietnamese 유지 assertion 추가. KEEP_UNIQUE 원래 145개 spec file/8-shard 계획, #866 Unit/SQLite/HTTP/Gantt, Required3. 추가 spec 파일/샤드 변경 없음.
- 검증 경계: 정적 Git Blob/Tree source 검토만 완료, 새로운 Head의 TypeScript/Vitest/SQLite/HTTP/Playwright/Docker/Trusted 실제 실행은 NOT TESTED. #866 Phase C 및 운영 backup/restore·12 owner 동시쓰기 검증 미완료. HIGH / OWNER_MANAGED / qa_required=true / release_required=true / release_authorized=false; GHCR/merge/issue close 보류.

## Phase B 분리 착수 (2026-11-05) — 원격 실패 미확인

- #878 정확 HEAD `8fca83bbc12cf516cd7f22438fa16c6b596d80fb`의 Full CI #3509.1 성공은 Phase A 범위만 증명한다. Phase B는 별도 Head/트리, 최초 PR CI 전 **NOT TESTED**.
- #870 이전 혼합 PR의 구현과 테스트는 참고 자료이며 그 당시 PASS/FAIL, 도메인/LLM/Issue 변경, 구버전 0.140.0을 Phase B 새 HEAD의 검증으로 승격하지 않는다. 기존 Full-001/002 및 역사적 실패 원문 유지.
- Branch: feat/issue-866-i18n-phase-b-owner-data, base는 #878 Phase A HEAD(최신 Main 364aa3.. 상속), 정확 PR/CI Run은 생성 이후에 기록한다. 신규 E2E shard 7, 145개 spec. 로컬 TypeScript/Vitest/브라우저/DB/Docker 실행: NOT TESTED.
- 현재 미실행/위험: Phase B 신규 원격 Quality/E2E8/Docker/Trusted, 프로젝트 Equipment/System UI 전수, 소유자별 HTTP 세션/경합, DB 백업/복원, Copy/Template6 실환경. release_authorized=false, 병합·게시·이슈 종료 HOLD.

# Issue #866 — 국제화 분리 PR 누적 실패 원장

기준 Main: `364aa3bdfde16fd3ca79add61c35a1cde21f6395` / `v0.141.1`. #866 전용 원장은 이 파일을 사용하며 이전 #870 원본(PR/Run/리뷰/실패)은 https://github.com/planner77/masterGantt/pull/870 와 해당 원본 브랜치 `docs/ISSUE_866_FAILURE_ANALYSIS.md`에서 독립 추적한다. 기존 CI 실패와 구현 중 원인은 덮어쓰거나 성공으로 소급하지 않는다.

## 원본 #870과 새 Phase A의 인과 분리 (2026-11-05)

- 원본 통합 PR #870: Head `ca58e987fd68261d9e9db97b4e931651350d6e4a`, 오래된 기준 `352a43e74c7b34c72d952f67783a53463f8b519d`, 국제화 + 독립 #865 LLM + #869 Issue 레이아웃을 339파일에 혼합. 이전 통합 PR의 원장에는 관리형 이름 저장/기존 스키마/HTTP·Playwright/E2E 원본 실패 사례가 기록되어 있다. 그 실패의 구 코드를 새 Main i18n Phase A의 제품 직접 실패로 섞지 않는다.
- 가장 최근 원본 PR #870의 [Full #3474.1 / Run41723556052](https://github.com/planner77/masterGantt/actions/runs/41723556052)에는 `tests/e2e/issue-726-task-logistics.spec.ts` 공정문맥 HTTP 실패/상세 원인 관측 등 별도의 역사 기록이 있다. 교정 제품 경로는 #869/#865 병합이 반영된 Main에서 재평가해야 하며, 구 PR 339파일을 일괄 덮어쓰지 않는다. 원본 결과를 새 Phase A의 테스트 PASS로 전용하지 않는다.
- 분리 Phase A: 0.141.1 → 0.142.0 candidate, 현재 원격 구현 성공/실패 Run 아직 **NOT TESTED**. 기존 한국어 UI/업무 Gantt·LLM 제품·API·DB/마이그레이션을 변경하지 않고 공통 Locale + UI Header/Navigation + SVAR words/date-only만 추가.
- 새로운 실패가 발생하면 **실제** GitHub Run/Attempt/Job/Step, Head/Base/Test merge, 직접 원인/파생 및 취소·미실행, 교정 코드/테스트/문서·리뷰·충돌 및 재검증을 본 문서에 **추가**한다. 과거 PR #870의 다른 Issue 결함을 신규 Phase A 실패라고 주장하지 않는다.
- 실행 계약: Required Quality/E2E8/Docker, Trusted QA, Owner HIGH/OWNER_MANAGED, 정식 release 승인 별개. 로컬 Checkout/실행 미확인, 신규 PR CI 시작까지만 진행, 결과 모니터링 안 함. Phase B/C까지 Issue #866 OPEN, tag/GHCR 정식 게시 금지.

## PR #878 FULL-001 — #3507.1 새 i18n E2E 샤드 명시 계획의 테스트 계약 실패 (2026-11-05 KST)

### A. 원격 실행 및 실패 집계

- [PR #878](https://github.com/planner77/masterGantt/pull/878), head `ccf39510441a447d3df8f9f85ee3c9b1e22008ce` / base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, branch `feat/issue-866-i18n-phase-a-main`. [Full #3507.1 / Run 41921474942](https://github.com/planner77/masterGantt/actions/runs/41921474942) `pull_request`, Attempt **1**, 결과 **FAILURE**. 원본 changes Job `126894787011`의 checkout·`PR_TEST_MERGE`에서 정확한 test-merge SHA **`5a91fa65c2a097fdc41998477c7aafcfe710d255`**를 별도 확인했다. FAST_DEVELOPMENT #269.1 Run41921474879 SKIPPED는 Required 증거가 아니다.
- **최초 직접 FAIL** = Vitest 단위·통합 Job `126895162188`, step `Run npm test`: `tests/scripts/e2e-shard-planner.test.ts:107:58`의 **`covers all current specs exactly once after #767 eight-shard escalation`**. 예상 파일 수 `[19,18,18,18,17,18,17,18]`, 실제 `[19,18,18,18,18,18,17,18]`. 새 `tests/e2e/issue-866-language-shell.spec.ts`를 `tests/config/e2e-shard-plan.json`의 shard5에 배치한 것은 맞지만, **해당 계획을 검증하는 유지 관리 테스트의 하드코딩된 counts만 과거 값 그대로**였다. 단순 코드를 넘겨서 PASS하거나 비교를 삭제/약화하지 않는다.
- Vitest **3527 PASS / 1 FAIL / 3 SKIPPED** (292 files: 290 PASS/1 FAIL/1 SKIPPED). 신규 `tests/lib/i18n-phase-a.test.ts` 6건은 본 Run에서 **PASS**, `tests/lib/date-display.test.ts` 3건 PASS. Policy, ESLint, TypeScript, QA Preflight, `changes` Job은 각각 SUCCESS; Next production build 및 Chromium8 실제 shards와 Docker 구현은 PR Fast Gate 정책으로 **SKIPPED/NOT RUN**.
- **파생 FAIL** = PR Fast Gate `126895994660` (`UNIT_RESULT=failure`), 세 Required aggregate Quality `126896155327` / E2E `126896155503` / Docker `126896155107` (**확실한 Job 번호는 Actions 원본 job list `126896155107` 참조; 직접 원인 아님**), QA Final Automated `126896209099` (`required quality 미성공`). 필수 E2E/Docker 실행 없음은 **FAIL 원본 아님**, SKIPPED를 PASS로 확대하지 않는다.

### B. 원인, 과거 이력과 교차 비교

- 분류: **TEST_CONTRACT** (신규 E2E 1개 명시 등록과 누적 샤드 count regression test 간 동기화 누락). 런타임 i18n·React/SVAR·SQLite·Docker 결함을 확인한 증거는 없음(전체 build/E2E/Docker는 미실행).
- **원본 혼합 PR #870의 역사적 직접 실패 합집합**은 기존 #866 원장 (원본 브랜치)에 그대로 있으며 원격 #3474.1의 `issue-726-task-logistics.spec.ts` HTTP context error 등은 현재 Phase A 소스에서 재실행되지 않아 **NOT TESTED**. 이번 직접 FAIL은 #870과 별개 `tests/scripts/e2e-shard-planner.test.ts`이며 신규 `issue-866-language-shell.spec.ts`가 계획에 새로 등록될 때만 나타나는 분기.
- 교차 영향 파일 합집합: `tests/scripts/e2e-shard-planner.test.ts`(직접 실패), `tests/config/e2e-shard-plan.json`(명시 Shard5 원본 producer), `tests/e2e/issue-866-language-shell.spec.ts`(신규 consumer), `tests/lib/i18n-phase-a.test.ts`(직접 PASS), 기존 `scripts/e2e-shard-planner.mjs` 및 다른 143개 기존 spec(무변경/원격 shard는 NOT RUN). 원본 E2E/QA 보안과 8 shard / fast gate / timeout / skip 정책 불변.

### C. 보완 및 교차 검증 계획

- **EXTEND** `tests/scripts/e2e-shard-planner.test.ts`의 정확한 8 shard count expectation에서 **Shard5만 17→18**로 변경하고, 기존 20개 역사적 spec 경로→shard 매핑과 함께 **새 `["issue-866-language-shell.spec.ts", 5]` 명시 검증 추가**. 원본 `Set(entries).size === entries.length`, `[...entries].sort() === discovered`, 모든 shard 선택 결과/dedup 및 결손·중복의 fail-closed 테스트는 유지.
- `tests/config/e2e-shard-plan.json`의 **144개 정확 명시 배치**, 8 shard, 이전 143개 스펙/역사적 projectedMs/sourceRunIds·실행 계획 전부 불변. 새 spec의 실제 소요 시간은 여전히 REMOTE_UNMEASURED. i18n 코드/제품 라벨/locale·package version/CI/QA 정책은 수정하지 않음.
- GitHub 커넥터로 원본 Job/Step·테스트 파일·샤드 계획·커밋/정책 검사·Phase A Work Packet을 정적으로 대조(**정적 일치 확인**). 로컬 `npm test`/TypeScript/Playwright/Docker 및 완전 동결된 신규 소스의 원격 Full 결과는 이 교정 작성 시 **NOT TESTED**. 반드시 새 HEAD의 Full PR CI로 정책·Vitest·Quality/E2E8/Docker·Trusted 검증을 다시 수행하며 #3507.1 과거 FAIL은 불변 유지.
- [Work Packet](exec-plans/active/ISSUE_866.md)의 REWORK1 / [Test Plan](TEST_PLAN.md)에서 신규 spec 배치와 명시 count assertion 동기화 근거를 보강. 미해결 리뷰 0, mergeable/현재 Main behind0 검증 후 새 Run ID+Attempt를 별도 감사한다. `HIGH/OWNER_MANAGED/qa_required=true`, `release_required=true/release_authorized=false`, Phase B/C 미완료·Issue OPEN·Main/정식 GHCR 배포 금지.
## PR #878 FULL-002 — #3508.1 영어 SVAR Grid 헤더와 구 E2E 단언 충돌 (2026-11-05 KST)

### A. Run/Attempt/Head/Base와 직접·파생 실패

- [PR #878](https://github.com/planner77/masterGantt/pull/878), branch `feat/issue-866-i18n-phase-a-main`, 정확 HEAD `cd3f0c57953a0bd50a0ac74c0303211e08b20e68`, base/Main `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, changes Job `126906655974` 원본 checkout·`PR_TEST_MERGE` **`6eef294a77b93b30dd0d90184a51b44035a8d014`**. [Full CI #3508.1 / Run 41924914789, Attempt1](https://github.com/planner77/masterGantt/actions/runs/41924914789), completed/**FAILURE**. Non-authoritative FAST #270.1 Run41924914479 SKIPPED는 Required PASS가 아니다.
- **직접 실패** = Chromium E2E Shard **4/8**, Job **`126908178973`**, step `E2E shard 실행`, `tests/e2e/project-workspace-layout.spec.ts:25:9`의 `en-US` 사례, assertion **line 83** `gridHeaders.getByText("외부 ID", { exact:true })`의 `toBeVisible` 실패 (`element(s) not found` / 5000ms). 원본에는 93개 선택 테스트 중 **33 PASS / 1 FAIL / 59 DID NOT RUN**로 PR의 `--max-failures=1` 조기 중단. 같은 spec의 `ko-KR` 사례는 정상 PASS. 이 실패는 작업/기간/날짜/상단 고정의 실패가 아니라 새 사용자 언어에 따라 실제 native Grid **`외부 ID` → `External ID`**가 번역되는데 **구 테스트만 한국어 문자열을 고정 기대**하는 계약 불일치다.
- **제품/계약 근거**: `src/features/gantt/svar-locales.ts`의 `appColumnTerms["외부 ID"]=["External ID","ID bên ngoài"]`, `src/features/gantt/project-gantt.tsx`의 `<Locale words={SVAR_LOCALES[locale]}>`, `tests/e2e/project-workspace-layout.spec.ts`의 두 `test.use({locale: ko-KR / en-US})` 분기가 원본 증거. 동일 spec는 기존 custom Column Menu `getByRole("checkbox",{name:"외부 ID"})`를 사용하며 이 앱 자체 메뉴는 Phase A에서 미번역, **native SVAR Grid 헤더만** 영어가 된다. 제목/에러로부터 임의 데이터 손상·SVAR 구현 버그를 주장하지 않는다.
- **단독 CI 검사 결과** = `Vitest` 3528 PASS / 3 SKIPPED (292파일: 291 PASS/1 SKIPPED), Unit Job `126907009480` **SUCCESS**, TypeScript `126907011273` **SUCCESS**, ESLint `126907009587` **SUCCESS**, 정책 `126907009619` **SUCCESS**, QA Preflight `126906834432` **SUCCESS**, PR Fast Gate `126908041800` **SUCCESS**, 실제 PR Next Build `126908178961` **SUCCESS**, Docker 구현 `126908178690` / Required Docker `126910489168` **SUCCESS**, Required Quality `126909012355` **SUCCESS**. Shard **7/8** `126908179115` SUCCESS; Shard 1/2/3/5/6/8은 `CANCELLED`, 따라서 전체 E2E가 성공한 것이 아니다.
- **파생 실패** = Required E2E aggregate `126916528651` (`RESULT=failure`), QA Final Automated `126916594844` (`required e2e 미성공`). E2E 4의 브라우저 테스트 실패가 원인이며 다른 6개 취소·QA는 독립 제품 결함 근거가 아니다. Shard4 Playwright 시작 직후 git fetch `GitCommitInfo: timeout of 3000ms` 기록은 별도 비차단 정보 메시지이고 33개 테스트가 계속 PASS한 후 정확한 UI 단언에서 실패하여 이번 직접 원인으로 분류하지 않는다.

### B. 이전 실패 전체/교차 영향 종합

- **FULL-001 #3507.1**: 143→144 E2E 명시 배치 변경 시 샤드 수를 고정 단언한 `tests/scripts/e2e-shard-planner.test.ts` 누락으로 TEST_CONTRACT FAIL 1개, 뒤따른 Required3·QA FAIL. 교정 커밋 `cd3f0c57953a0bd50a0ac74c0303211e08b20e68`의 **#3508.1 Vitest 3528 PASS**로 동일 source에서 해당 테스트 계약의 재검증을 확인. 원본 #3507.1 FAIL은 이 결과로 소급 PASS 처리하지 않는다.
- **FULL-002 #3508.1**: 새 SVAR Locale 도입 후 기존 E2E 영어 사례가 한국어 native header를 고정 단언한 문제다. 첫 번째 테스트 누락과 인과적으로 별개며 이전 PR #870의 #726 공정 문맥 HTTP/기준정보 번역/migration 및 원본 실패들을 현재 Phase A의 추가 직접 오류로 끌어오지 않는다.
- **실패·인접 소비자 합집합**: `tests/e2e/project-workspace-layout.spec.ts`의 ko/en 시간대·date-only·컬럼 선택/숨김·Gantt instance/스크롤/고정 헤더, `tests/lib/i18n-phase-a.test.ts`의 SVAR ko/en/vi 단어, `src/features/gantt/svar-locales.ts`과 `project-gantt.tsx` 실제 Locale, `tests/e2e/issue-866-language-shell.spec.ts`의 새 브라우저 저장·선택/바로가기, 기존 8-Shard E2E와 3 Required/Docker. 실행되지 않은 6개 Shard/Phase B/C는 NOT RUN/NOT IMPLEMENTED; 다음 새 Head에서 성공할지 미확정.

### C. 교정·테스트 생명주기 및 감사 경계

- **EXTEND** 기존 `tests/e2e/project-workspace-layout.spec.ts`의 두 표본을 **ko-KR → `외부 ID` / en-US → `External ID`**로 독립 정확 매핑하여 같은 native Grid column의 표시/숨김과 잘못된 언어의 헤더 부재를 검증한다. 기존 custom Column Menu 한국어 label 체크·체크해제, 헤더 고정/설정 modal/Escape·focus, Gantt API/DOM instance 보존, UTC date-only/미국 시간대, 60행 scroll/문서 overflow/JS 오류 모두 단언 그대로 유지. 각 실제 `html lang` 값 확인을 추가.
- **EXTEND** `tests/lib/i18n-phase-a.test.ts`의 static SVAR words 검증에 `["외부 ID"]`의 `ko="외부 ID"`, `en="External ID"`, `vi="ID bên ngoài"` 3언어 매핑 단언을 추가한다. **KEEP_UNIQUE** `tests/config/{playwright,transport}.config.ts` 기본 ko-KR, `tests/config/e2e-shard-plan.json`의 정확 144개 배치, `tests/scripts/e2e-shard-planner.test.ts` 최신 count, `tests/lib/date-display.test.ts` 및 모든 API/DB/LLM/권한/보안/E2E. 단언 삭제/완화·timeout/retry/Shard 갱신 없음.
- **문서 동기화**: `docs/exec-plans/active/ISSUE_866.md` REWORK2, `docs/TEST_PLAN.md`, `docs/I18N_PHASE_A.md`, `docs/REMOTE_VALIDATION.md`, 이 **동일 누적 실패 원장**에 추가. `AGENTS.md`, 제품 Locale·앱 버전 `0.142.0`/CI/QA/Required3/Owner 관리 정책 변경 없음.
- **검증 상태**: GitHub Run/Job/Step 로그 및 source/기존 E2E/사전 코드 교차 확인 완료. 새 코드가 생성된 후 실제 Chromium/TypeScript/Vitest/Next/Docker를 로컬에서 재실행하지 않았으므로 **NOT TESTED**; 새로운 HEAD Full PR CI + Trusted QA의 결과가 나올 때까지 PASS 선언 금지. `release_required=true`, `release_authorized=false`, #866 Phase B/C 미완료, Main merge/GHCR/Issue close 금지. 원본 #3507.1/#3508.1 실패/취소 상태와 실패 원인 기록 유지.
