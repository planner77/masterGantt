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
