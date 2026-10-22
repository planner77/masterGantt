# Issue #762 — 누적 PR CI 실패 분석

Primary Issue: [#762](https://github.com/planner77/masterGantt/issues/762) | 구현 [PR #779](https://github.com/planner77/masterGantt/pull/779) | 최초 기록: 2026-10-22 UTC
Source of Truth: [PR CI 실패 누적 분석 지침](PR_CI_FAILURE_TRIAGE.md). 과거 실패 Run을 덮어쓰거나 SUCCESS로 소급 변경하지 않는다.

## 1. PR / Run / Attempt 전체 목록

| 원장 ID | Run 및 event | Head / Base / Test merge | Required aggregates | 최초 오류·증거 |
| --- | --- | --- | --- | --- |
| F-001 | [#3150.1](https://github.com/planner77/masterGantt/actions/runs/39779367052), ID 39779367052, attempt 1, `pull_request.opened`, CI/FINAL_FULL, 2026-10-22 12:33 UTC | Head `752d1c464f8f2e7cf61b330e2bbb15c18a8dafbb` / Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597` / Test-merge `9d295d4d56d58ea755e46f0780e5f1cc103bdbf9` | Quality PASS (119828278605), E2E FAIL (119832376573), Docker PASS (119829075135); QA Final FAIL 파생 (119832418392) | Shard 6, [Job 119827457118](https://github.com/planner77/masterGantt/actions/runs/39779367052/job/119827457118), [report/trace artifact](https://github.com/planner77/masterGantt/actions/runs/39779367052/artifacts/12426786845) |
| F-002 | [#3153.1](https://github.com/planner77/masterGantt/actions/runs/39783686345), ID 39783686345, attempt 1, `pull_request.synchronize`, CI/FINAL_FULL, 2026-10-22 13:04 UTC | Head `294a5a7136f2c56dff4796e089f6b9627e3fb381` / Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597` / Test-merge `e0dcf68c779b15f9c617f2b97b7612ea1ec6962d` | Quality PASS (119843381857), E2E FAIL (119848286078), Docker PASS (119845391902); QA Final FAIL 파생 (119848334445) | Shard 7 [Job 119842472249](https://github.com/planner77/masterGantt/actions/runs/39783686345/job/119842472249), [report/trace](https://github.com/planner77/masterGantt/actions/runs/39783686345/artifacts/12428298303) · #186 strict locator collision |
| F-003 | [#3154.1](https://github.com/planner77/masterGantt/actions/runs/39787884834), ID39787884834, attempt1, `pull_request.synchronize`, CI/FINAL_FULL | Head `c8d1a5d1738e6ae3d40f9d310d0bcc0cc716cb04` / Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597` / Test-merge `e2f75f49b797ab037aa0c6571590b5c9a281be43` (run-scoped 원본 artifact·Git 부모 교차 확인) | Quality PASS119857669681 / Docker PASS119858968207 / E2E FAIL119865301964 / QA 파생 FAIL119865346548 | Shard7 [Job119857156672](https://github.com/planner77/masterGantt/actions/runs/39787884834/job/119857156672), 46PASS/1FAIL/30NOT RUN; dirty Escape의 구 즉시 닫힘 기대 |

| F-004 | [#3155.1](https://github.com/planner77/masterGantt/actions/runs/39793693125), Run 39793693125/attempt1, 2026-10-22 14:12 UTC, Full `pull_request.synchronize` | Head `437a505ebe7eac7f9a08f38404a95af7e259793a` / Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597` / Test-merge `677671d94df106fe2ec6e87522d58ab44e90d4a8` | Quality PASS 119877546727 / E2E 8/8 PASS 119889712554 / Docker PASS 119878402371, QA Final Automated **BLOCKED** 119889755461 | [QA Final Job](https://github.com/planner77/masterGantt/actions/runs/39793693125/job/119889755461): Run ID/Attempt/검증 SHA 불일치. 동일 Head 재실행 attempt2는 QA Automated PASS·Run SUCCESS, 외부 Trusted #799.1은 source artifact attempt2 누락으로 FAIL |
| F-005 | [#3155.3](https://github.com/planner77/masterGantt/actions/runs/39793693125), Run 39793693125/attempt3, 2026-10-22 19:29 UTC, Full 재실행 | Head `437a505ebe7eac7f9a08f38404a95af7e259793a` / Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597` / Test-merge `677671d94df106fe2ec6e87522d58ab44e90d4a8` | Policy **FAIL** 120039957384 → PR Fast FAIL 120040936645 → Required Quality FAIL 120041047700 / E2E FAIL 120041047487 / Docker FAIL 120041047496, QA Final FAIL 120041096243; **8 E2E 및 Docker 본 실행 SKIPPED** | [Policy Job](https://github.com/planner77/masterGantt/actions/runs/39793693125/job/120039957384): `npm audit --omit=dev` Next.js `16.3.8` critical CVE/GHSA; 기존 Runtime 범위 `16.0.0–16.4.0` |


- 같은 HEAD의 [FAST_DEVELOPMENT #15.1](https://github.com/planner77/masterGantt/actions/runs/39779366938)은 `skipped`이며 Full/Required의 대체 증거가 아니다.
- 이 문서 최초 작성 시 #762를 귀속시킨 열린 PR은 #779 한 개이고, 조회 가능한 Full CI는 F-001 한 번이다. 이슈 #726의 별도 역사적 실패는 본 이슈 Run 수에 포함하지 않는다.

## 2. F-001 — 실제 최초 실패와 파생 취소

- **실제 실패:** Shard 6/8의 `tests/e2e/issue-726-task-logistics.spec.ts:234`, 테스트 `#726 Task 공정 0..N·WorkArea self/subtree 원본 연결, 초안·오류 보존과 상위 출처 구별`. 검증 위치 `:327`의 `expect(locator).toBeEnabled()`, 5초 경과 후 `element(s) not found`. 기존 선택기 `/A 작업구역 WA-A/`는 해당 체크박스를 찾지 못했다.
- **직접/파생 분리:** Shard 6 job ID 119827457118 FAIL, 실행 결과 36 PASS / 1 FAIL / 54 NOT RUN(91 cases, `--max-failures=1`). Shards 1/2/3/4/5/7/8 각각 jobs 119827457075 / 119827457138 / 119827457000 / 119827457196 / 119827457113 / 119827457156 / 119827457202 `CANCELLED`. 일곱 로그에서 별도 Playwright `✘`/assertion 실패는 관측되지 않았으나 완료 PASS도 아니다. E2E aggregate FAIL 및 QA Final `required e2e 미성공`은 같은 최초 실패에 따른 파생 결과이다.
- **정상 Job:** Changes, QA Preflight, Policy, Vitest, TypeScript, ESLint, PR Fast Gate, Next.js Build, Docker Smoke, Required Quality·Docker 모두 SUCCESS. 정책/빌드/이미지 환경 자체가 최초 실패라는 증거는 없다.
- Shard 6의 `GitCommitInfo: timeout of 3000ms ... git fetch` 경고 후 테스트가 37번 case까지 진행됨. 비검증 외부 fetch 진단을 UI checkbox 실패의 원인이나 임의 timeout/재시도 확대 근거로 승격하지 않는다. Playwright report의 `1 error was not a part of any test`는 정식 원인 불명으로 분리한다.
- 해당 실패 시점의 원본 CI/Artifact, 완료/취소 상태는 불변이며, 신규 HEAD CI 시작 직전까지 수정 후 원격 결과는 `NOT TESTED`이다.

## 3. 원인 분석 · 전체 실패 매트릭스

| 실패 ID / 영향 파일 | 원본 증거와 분류 | 이전 이력 대조 | 수정 후 확인/남은 위험 |
| --- | --- | --- | --- |
| F-001 · `issue-726-task-logistics.spec.ts`의 legacy WorkArea 선택 5곳 | **TEST_CONTRACT**: #762가 화면 label을 `A 작업구역 · 기존 공유 구역 WA-A`로 정확히 확장했지만 테스트는 이전 `A 작업구역 WA-A`를 찾음. `element(s) not found`는 선택·저장 API 실패의 직접 증거가 아님. | [#726 원장](ISSUE_726_FAILURE_ANALYSIS.md)의 과거 F-001은 UUID 배열 정렬 계약으로, 동일 증상/동일 원인이 아니다. 신규 #762 원격 Run은 F-001만 조회됨. | 명시적인 shared legacy label + 안정된 코드 전체를 검증하는 한 개 locator helper로 5 호출 수정. 원격 동일 케이스·소비자 회귀 아직 NOT TESTED. |

- **근거 교차:** `tests/e2e/fixtures/target-project.ts`가 A occurrence 아래 `A 작업구역`/`WA-A` 전역 구역을 작성하여 A 공정에 명시 매핑한다. `src/server/repositories/project-work-area-repository-core.ts`는 이 mapping을 `source: "legacy"` 읽기 alias로 반환한다. `src/features/logistics/project-workarea-options.ts`와 `src/features/gantt/task-process-context-editor.tsx`는 기존 WorkArea ID/owner를 유지하면서 legacy label에 ` · 기존 공유 구역`을 추가한다. 구 ID 삭제·사라진 체크박스·사용 불가 판정은 확인되지 않았으며 성공된 실 DB 동작과 다른 추론은 금지한다.
- **보완:** E2E test 내부 `legacyArea()` helper는 `/^A 작업구역 · 기존 공유 구역 WA-A$/`와 `getByRole("checkbox")`를 사용하여 기존 이름·기존 공유/읽기 alias 구별·정확 코드 확인을 함께 보존한다. 이전 선택기 5곳을 교체하며, 시간 증가·skip·retry·UI marker 제거·원본 DB/DTO 변경 없이 기존 저장·원자성·권한·Task/Summary/5폭 assertion을 유지한다.
- **교차 검증 대상:** 같은 #726 3개 Task/Equipment 케이스, #725의 직접/기존 공정 구역 매핑, #762 신규 실제 HTTP/SQLite/Task·설비 소비자, #730/#733 WBS drill, legacy/default/active/foreign-owner/error cases. 이번 수정은 테스트 선택기만이고 나머지 원격 취소 사례는 새 Full8 CI로 검증한다. 프론트엔드/DB 영속성과 보안·음성 검사는 기존 coverage를 약화시키지 않는다.

## 4. 변경 후보 검증·안전 경계

- 변경 경로: `tests/e2e/issue-726-task-logistics.spec.ts`, 이 원장, `docs/exec-plans/active/ISSUE_762.md`. 제품 코드는 그대로; `AGENTS.md`/`DESIGN.md`/`CI_CD.md`/`TEST_PLAN.md`의 정책·UI 원칙은 변경하지 않아 N/A.
- **한정 정적 검사 PASS:** 오리지널 패턴 정확 5곳 발견/5곳 전부 교체; 새 label은 정규식 매칭, 구 label·다른 code·다른 owner label은 거절. 이 검사는 브라우저·HTTP·SQLite 실행이 아니며 **Playwright, Unit, TypeScript, ESLint, 로컬 Pre-PR의 새 후보 HEAD는 NOT TESTED**이다.
- 신규 HEAD에서 [`issue-726-task-logistics.spec.ts`](https://github.com/planner77/masterGantt/blob/feat/issue-762-process-workarea/tests/e2e/issue-726-task-logistics.spec.ts) 와 #725/#762 직접/legacy 소비자 및 FULL8을 원격 CI로 검증한다. 기존 #3150.1의 실패·취소를 PASS로 취급하지 않는다.
- PR #779 review thread **0**, inline review comment **0**, review **0** 확인. 첫 재작업 직전 main `72c2c9d0a912dc906d4101ea41a7a57e0c686597`와 PR head 동일 merge base, ahead 1 / behind 0, `mergeable=true`; 충돌 없음. 새 HEAD에서 재점검한다.
- Risk HIGH, QA OWNER_MANAGED, independent QA N/A, Owner risk ACCEPT **NOT TESTED**, `release_required=true`, `release_authorized=false`; 새 PR CI는 전체 Required3/Trusted QA/Owner·Main/Release의 대체가 아니며 이번 요청은 새 PR CI 시작까지만이다.

## 5. 다음 Run 기록 규칙

- 새 한정 수정/원장/Work Packet 단일 HEAD SHA와 PR `synchronize` 이벤트의 새 Run ID/Attempt는 검증 확인 뒤 아래에 추가한다. 검증 시작과 성공은 구별한다. 추가 실패 시 F-002부터 동일 문서에 누적하며 원래 F-001을 수정·삭제하지 않는다.
## 6. F-002 — PR #779 Full #3153.1, 첫 교정 후 새 Strict Locator 실패 (2026-10-22)

### F-002 원격 출처 및 직접/파생 판정

- Full CI [#3153.1](https://github.com/planner77/masterGantt/actions/runs/39783686345) / run ID `39783686345` / attempt `1` / `pull_request.synchronize`; HEAD `294a5a7136f2c56dff4796e089f6b9627e3fb381` / base `72c2c9d0a912dc906d4101ea41a7a57e0c686597` / PR #779 test-merge `e0dcf68c779b15f9c617f2b97b7612ea1ec6962d` (조회 시 PR metadata 관측).
- **첫 실제 실패:** Chromium **Shard 7/8**, [Job 119842472249](https://github.com/planner77/masterGantt/actions/runs/39783686345/job/119842472249), `tests/e2e/project-logistics-management.spec.ts:298`의 `Issue #186 물류 구성 탭 전환·Gantt instance 유지` 케이스. 공용 `expectIdentifier()`의 기존 13행 `row.getByText("입고 공정",{exact:true})`가 기대 `visible` 대신 Playwright `strict mode violation`을 발생시켰다. 실제 매칭은 **2개**: `<strong>입고 공정</strong>` (표시 공정 원본명)과 WorkArea 버튼 안의 `<span class="...srOnly"> 입고 공정</span>` (접근성 설명). 오류 시각 2026-10-22 13:18:05 UTC. [Playwright report/Trace artifact](https://github.com/planner77/masterGantt/actions/runs/39783686345/artifacts/12428298303).
- **실행 수:** Shard7 **39 PASS / 1 FAIL / 37 NOT RUN** (`--max-failures=1`, 원래 77개). Shard **1,2,3,4,5,6,8은 CANCELLED**; job ID는 각각 `119842472444`, `119842472271`, `119842472499`, `119842472498`, `119842472226`, `119842472266`, `119842472297`. 모두 실제 로그 대조에서 별도 Playwright `✘`는 발견되지 않았지만 개별 성공 및 전체 PASS는 아니다.
- **Aggregate/파생:** Required Quality `119843381857` SUCCESS, Docker `119845391902` SUCCESS, Chromium E2E `119848286078` FAILURE, QA Final `119848334445` FAILURE (필수 E2E 미성공 파생). Policy·Preflight·TypeScript·ESLint·Vitest·Build·Docker 구현·Fast Gate 성공. `FAST_DEVELOPMENT #18.1`은 SKIPPED로 전체 Full 증거가 아니다. 모든 Shard의 `git fetch origin` 3000ms 경고는 테스트가 실행·진행되므로 Strict Locator 오류의 직접 원인 아님.
- **F-001 교차 원격 회귀 확인:** F-001 실패 파일 `tests/e2e/issue-726-task-logistics.spec.ts`의 이전 234행 단일 케이스는 #3153.1 Shard6의 **개별 case #37 PASS (1.0m)**를 직접 관측했다. 그러나 Shard6 Job 전체는 **CANCELLED**이므로 해당 샤드 Required PASS로 승격하지 않는다. 두 실제 실패 파일의 누적 합집합은 이 파일과 `project-logistics-management.spec.ts` **2개**다. #3150 F-001 원본은 변하지 않고, 이번 F-002는 같은 UI 의미 변화의 **다른 기존 소비자 테스트 계약 누락**, DB/API 결함이라는 증거는 없다.

### F-002 원인, 인접 경로 일괄 교정

- **판정 = TEST_CONTRACT (신규/교차 영향)**. #762의 `src/features/logistics/project-logistics-management.tsx`는 `<strong>{p.name...}</strong>`로 공정명을 표시하면서 작업 구역 선택 버튼의 이름 구별/접근성을 위해 `srOnly {p.name}`을 추가하였다. Playwright `getByText()`는 동일 row 내 두 text node에 매치한다. 보조 레이블은 정상 UI 계약이며 삭제하지 않는다. `getByText().first()`로 우연히 한 쪽만 선택하거나 assertion 제거·timeout·skip·retry로 우회하지 않는다.
- **재작업 대상**: `tests/e2e/project-logistics-management.spec.ts` 내 공통 `expectIdentifier`의 화면명 검증을 공정/설비/시스템 행의 정확한 `strong` 본문 `toHaveText(name)` 및 visible 검증으로 교정하고, 기존 `IdentifierDetails`의 코드 값·클릭 및 뒤따르는 코드 확인은 유지한다. 공정 3건(`입고/보관/출고`)과 신규 자동 코드 공정의 별도 검증 4곳도 canonical row-ID+`strong` 및 정확 name 검사로 전환한다. `입고 공정` 해당 row의 WorkArea 버튼 `getByRole("button",{name:/작업 구역.*입고 공정/})` 가시성 검사 **추가**로 접근성 이름 회귀를 보호한다.
- **동일 패턴 점검:** 해당 E2E 파일의 `getByText` 사용처를 전수 확인했다. 설비·시스템 행의 별도 visible-text 검사는 UI에 이번 `srOnly`가 추가되지 않아 그대로 둔다. 타 프로세스 WorkArea UI의 #725/#762 direct/legacy·Task/설비/Target/연계/공정/readonly 및 정확 drill은 원본 테스트를 약화하지 않으며 새 Full8에서 실제 PASS 확인 전 `NOT TESTED`.
- **한정 정적 소스 검사:** 기존 공용 1곳+공정 가시성 3곳+신규 생성 공정1곳, 정확 **5개 선택자 대체/보완** 확인; 교체된 위험 `getByText` 5곳 0잔존, `strong` 정확한 문자열/가시성 검증 및 WorkArea 버튼 접근성 단언 포함. 본 검사는 **GitHub 소스 본문 비교**이지 브라우저/HTTP/SQLite/TypeScript/ESLint 실행이 아니다. 현재 세션 로컬 Git checkout·npm deps 없음, 네트워크 DNS 연결 불가로 동일 소스 로컬 Playwright/Pre-PR은 **NOT TESTED**.
- 원본 #3150/#3153과 새 HEAD를 혼합하지 않는다. 변경 scope=1 E2E 파일, 이 누적 원장, [Work Packet](exec-plans/active/ISSUE_762.md); 제품·API·schema·workflow·8-shard/Required3·QA·Owner·정식 버전/출시 승인 정책 불변. [TEST_PLAN](TEST_PLAN.md)의 existing #762·#697 선정/제외 근거 활용, 일반 설계·운영 원칙 변경 없음으로 `AGENTS.md`/`DESIGN.md`/`CI_CD.md`/`TEST_PLAN.md` N/A.

### 재작업 인계 및 검증 미완료

- Source commit/PR head는 아래 갱신 후 정확 SHA로 확정; PR #779 동일 브랜치 사용. 수정 전 main baseline HEAD와 merge base `72c2c9d0a912dc906d4101ea41a7a57e0c686597`, `behind=0`, `mergeable=true`, unresolved review threads **0** (확인 시각 기준); 수정 후 재조회 필수. 별도 Code Review Summary가 과거 commit에서 running이라도 실제 inline thread가 생겼다는 뜻은 아니다.
- 신규 `pull_request.synchronize` Full8 PR CI는 **시작만 확인**. 새 HEAD의 Quality/E2E/Docker, 특히 Shard7 나머지37건 및 나머지 취소된 샤드, Trusted QA, Owner HIGH 수용은 수행/확인되기 전 `NOT TESTED`, `MERGE_READY=BLOCKED`. CI 모니터링·병합·GHCR·Finalizer·Issue 종료 미실행. 후속 실패면 F-003으로 이 문서에 덧붙임.


## 7. F-003 — Full #3154.1의 공정 초안 Escape 계약 재현 (2026-10-22)

### 원본·직접/파생 실패

원본 Head `c8d1a5d1738e6ae3d40f9d310d0bcc0cc716cb04`, base `72c2c9d0a912dc906d4101ea41a7a57e0c686597`, Full3154.1/run39787884834/attempt1. 최초 실제 실패는 Shard7 Job119857156672의 `project-logistics-management.spec.ts:550` `Dialog 취소 시 Escape 키로 닫히고 mutation이 발생하지 않는다`, assertion581의 dialog expected0/actual1(5초)이다. Shard7은46PASS/1FAIL/30NOT RUN, 다른7Shards는CANCELLED다. Quality/Docker SUCCESS와 E2E/QA 파생FAIL을 분리하고 skipped placeholder·미실행을 PASS로 취급하지 않는다. 실제 case8.0s는 test/job timeout이 아니라 assertion 불일치다.

이번 요청 시 기존 branch의 F-001/F-002 교정2commit을 fast-forward로 수용했다. 이전 원장과 교정을 되돌리지 않는다. run API의 `pull_requests.head`는 현재 PR Head로 drift할 수 있으므로 원본 `run.head_sha`/run-scoped 증거·checkout 로그와 현재 PR metadata를 구별한다. 원격 전체3run/각8shard 대조 결과는 아래 최신 검증에 누적한다.

### 재현과 가설·반증

원본 명령은 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-logistics-management.spec.ts --project chromium --grep 'Dialog 취소 시 Escape' --max-failures=0`다. 원본 source에서 로컬1FAIL/9.0s/exit1로 같은 assertion581 expected0/actual1을 재현했다. 실제 DOM에는 입력한 `임시 초안 공정`과 별도 `공정 변경 내용 버리기` dialog가 보존되어 있었다. 원본 stdout/trace는 `.prepr-reports/issue-762-f003-red.log`와 로컬 test artifact이며 실제 runtime DB·credential·전체 app 로그를 Git에 올리지 않는다.

검증 전 순위가설과 예측:

1. TEST_CONTRACT: #762의 dirty 폐기 확인 계약과 이전 즉시 닫힘 기대가 다르면 pristine은 즉시 닫히고, dirty는 계속 편집/명시 폐기에 따라 보존/종료된다.
2. pending 잠금: 저장 요청0과 활성 controls·명시 폐기 확인창이 관측되면 반증된다.
3. Escape 미수신 또는 dialog 선택 충돌: 첫 Escape가 별도 이름 확인창을 열고 두 번째 Escape가 확인만 닫으면 반증된다.

제품 source를 바꾸지 않고 pristine/dirty·계속편집·확인 Escape·명시 폐기·기존 공정 edit의 초안 보존을 검증한 단일 case가3.0s(전체5.7s) PASS했다. 따라서 가설1 TEST_CONTRACT로 확정하고2/3은 해당 관측 범위에서 기각했다. 제품의 초안 보호를 제거하거나 `toHaveCount(0)` 단언을 무조건 삭제하지 않는다.

### 보완과 전체 소비자 범위

동일 E2E case를 clean/dirty 경계로 명확히 하고 다음을 함께 검사한다: pristine Escape 즉시닫기·정확 trigger focus, dirty Escape 확인/초안 유지/mutation0, 계속 편집, 헤더 닫기 확인, 취소 버튼 확인, 중첩 확인창의 Escape만 취소, 명시 폐기 뒤 원본창 종료·정확 focus, 기존 공정 수정 초안의 같은 보존/폐기와 canonical 원명 불변. F-001의 legacy helper와 F-002의 정확 `strong`/접근성 버튼 검사도 그대로 보존한다.

이 파일의 fixture는 route mock과 비UUID ID를 사용한다. UI 상태·요청0 검증을 실제 HTTP/SQLite/서버 원자성 PASS로 확대하지 않는다. 실제 직접 공정/Task/설비·재시작·권한 증거는 #762/#725 등 별도 실제 backend fixture와 구별한다. 제품 UI·API·DB·공유 WorkspaceDialog·CI/샤드/timeout/retry/skip·Required3/QA/Owner 규칙은 변경하지 않는다.

### 누적 실패 합집합과 검증 매트릭스

| 원본 사건 | 실패 파일/계약 | 이전 교정 보존 | 이번 후보 재검증 |
| --- | --- | --- | --- |
| F-001 /3150.1 | issue-726-task-logistics.spec.ts — legacy 이름/source/code 선택 | 기존5곳 정확 helper 불변 | 전체3case PASS, 첫 누적19개 실행에 포함; 해당파일 source불변 |
| F-002 /3153.1 | project-logistics-management.spec.ts — 공정명과 srOnly 중복 | 정확 strong·버튼 접근성 단언 불변 | 최종 동일 파일 전체13case PASS, 4폭 clean Escape 포함 |
| F-003 /3154.1 | 같은 파일의 dirty Escape 기대 | 이번 clean/dirty·다중 닫기·초안 보존 강화 | 원본 red9.0s·단일green3.0s·최종13개 PASS; 고유누적20개 |

실패 파일의 고유 합집합은2개다. 직접/간접/음성 소비자로 동일 파일 전체(4폭 clean Escape 포함), #726 전체3case, 신규 #762의 실제 direct CRUD/Task·설비/네트워크/412, 기존 #7252case를 `--max-failures=0`으로 함께 검증한다. #717의 실제 공정명PATCH·#733 exact drill/취소focus 등은 제품 source불변에 따른 선정/제외 근거를 별도 명시하고 모든 취소 Shard를 local PASS로 대신하지 않는다.

### 검증·리뷰·권한 상태

- 수정 전 main/base72c2c9d0, remoteHead c8d1a5d1, behind0/mergeable=true, 미해결 review threads0 확인. 수정 후 정확 Head에서 재점검한다.
- 변경 test의 실제 누적 회귀/정적 검사와 frozen source 지문은 실행 뒤 아래 추가한다. 새 Head Full8 Quality/E2E/Docker·Trusted/Owner는 NOT TESTED, MERGE_READY=BLOCKED다.
- risk_level=HIGH, qa_required=true, qa_method=OWNER_MANAGED, independent_qa=N/A(독립 인간 검토 없음), manager_decision=NOT TESTED. version0.130.0 유지, release_required=true/release_authorized=false.
- 사용자 범위는 분석·교정·리뷰/충돌 해결·실패 원장과 관련 문서 갱신·새 PR CI 시작이다. 완료 모니터링·병합·Main/GHCR/Release·Issue 종료는 수행하지 않는다.

### 3Run/24Shard 원격 전수 교차 검증

[정제 원격 증거](evidence/issue762/rework-f003-remote.json)에 각3Run의 최신 attempt1·총90jobs·24개 실제 ChromiumShard를 보존했다. 실제 Playwright 실패는 F001/F002/F003 정확3건이며 실패 파일은2개, 다른21개의 CANCELLED 로그에서 별도 `✘`/expect 실패는 관측되지 않았다. 취소된 사례를 PASS로 승격하지 않는다. 각 Full의 Quality/Docker는SUCCESS, E2E/QA는FAIL이며 QA 오류는 모두 required e2e 미성공 파생임을 로그로 확인했다.

F001의 원본case는3153Shard6에서PASS(1.0m),3154Shard6에서PASS(54s)였지만 두 Shard 전체는CANCELLED다. F002의 원본case는3154Shard7 #40에서PASS(6.3s)였지만 해당 Shard 전체는FAIL이다. 따라서 F003은 앞선 두 교정의 동일 assertion 재발이 아니라 같은 기능 변경의 다른 test contract 누락이다. 원장 합집합2파일·3case를 유지하며 한 실패만 순차 교정해 다음 CI로 넘기지 않도록 이번에는 두 파일 전체를 실제 Chromium으로 실행한다.

원본 `ci-pr-source-<run>-1`3ZIP의 GitHub artifact digest/다운로드 bytes와 schema·repository·run/attempt·PR·Head/base/testmerge 및 Git testmerge의 정확 두 부모를 교차 확인했다. F003 source artifact12430135729, Playwright report artifact12431775074다. 원본PR 자료는 신뢰된 QA 승인으로 승격하지 않으며 이 검사는 provenance 확인과 원인분석 근거다. 별도의 default-branch Trusted QA와 Owner 최종 승인은 NOT TESTED다. connector의 branch 전체 workflow collection은 승인URL 제한400으로 조회하지 못했으므로 확인한3개 sourceHead/Run/Attempt 범위를 넘는 영구 전체 역사 완전성을 주장하지 않는다.

### F-003 최종 Local Fast Feedback와 source 재사용 범위

[정제 로컬 증거](evidence/issue762/rework-f003-local.json)에 명령·Node/npm/Playwright 버전·4개 E2E 파일의 SHA256과 실제 판정을 보존했다. 첫 누적선정은 `issue-726-task-logistics.spec.ts`3개 + `project-logistics-management.spec.ts`기존12개 + #7252개 + #7622개, 총19/19 PASS(5.6분)였으며 retry0/worker1/`--max-failures=0`이다. 이 과정에서 F001의 과거 실제 실패 case도34.1s PASS했다.

누적 실행이 discovery한 뒤 별도 Process 보호 case1개를 작성했으므로 그19개 실행에 신규 case를 포함했다고 보고하지 않는다. 최종 변경 파일 전체13/13 PASS(43.2s)를 다시 확인했고, 내용 불변인 다른3파일7case와 합쳐 고유20case PASS다. 같은 case 재실행·단일green·기존 source의309개 검사·원격 개별PASS를 더하지 않는다. 최종13개에는 clean/dirty 닫기뿐 아니라 pending 실제 요청1개/중복 Enter·Escape 차단, network 불명확 응답·412·401 이후 초안/저장잠금·요청If-Match40/40/41·canonical 원본 불변도 포함한다. 제품 source 변경은0이다.

신규 보호 test의 첫 전체실행은12PASS/1FAIL(46.6s)이었다. pending중 버튼 accessible name이 `저장`에서 `저장 중…`로 바뀌었는데 고정 이름으로 찾아 notfound가 난 test harness 결함이다. snapshot의 disabled submit/input/header가 존재함을 확인하고 같은 submit element를 선택하면서 초기/저장중 문구도 명시 검사하도록 수정했다. 단일case3.3s(전체6.1s) PASS 후 최종 전체13개를 재실행했다. 최초 실패 raw로그 `.prepr-reports/issue-762-f003-final-spec.log`를 보존하며 새로운 원격 F004 또는 제품 결함으로 오인하지 않는다.

원본 red는 한 Project·공정명1개 입력+Escape의 실제 call site를 유지한 최소 UI trigger다. CI와 로컬의 같은 assertion/DOM으로 결정적 재현을 확인해 별도 제품 계측은 추가하지 않았다. `[DEBUG-...]` instrumentation·throwaway 제품 코드는 없다. Next가 만든 next-env.d.ts/tsconfig.json 임시 변경은 모든 browser 종료 후 baseline으로 복원했다. 복원 후 전체 typecheck, 변경 E2E ESLint, version0.130.0, Markdown303문서, diff check PASS. root/external cwd discovery는268unit files/795browser tests PASS다.

Pre-PR fast는 실제 재실행하여 sourceStable=true, selection66/UNKNOWN19/missing0, BLOCKED(exit1)였고 내부검사 실행0/NOT TESTED다. targeted dry-run도 selection BLOCKED·NOT TESTED(exit0)이며 실행 증거가 아니다. 자동 선택기의 기존 producer→consumer 미등록을 PASS로 바꾸거나 정책을 수정하지 않고, 수동 선정 실제20case 및 별도 정적 검사와 구분한다.

변경 없는 #717의 공정명 실제PATCH와 #730/#733의 별도 exact drill·그 외 모든 Shard 전수는 이번 로컬에서 재실행하지 않았다(NOT TESTED). 제품·공유dialog·API/DB·drill source변경0이므로 이번은 누적2실패파일전체와 직접#725/#762 소비자를 우선선정했다. 새Head Full8/Required3·Trusted/Owner가 전체 원격검증이며 local20개로 대신하지 않는다. 읽기 전용 사전 QA는 기존 F001/F002 교정 보존과 route mock/실HTTP 경계를 확인했고 독립 인간QA 또는 Owner ACCEPT 영수증이 아니다.

실제 명령에는 환경변수 override나 CLI `--workers`/`--retries`가 없었다. workers1은 config, retries0은 Playwright default이며 모든 실제 명령은 정제 로컬 증거에 기록했다. `set -o pipefail` 후 stdout/stderr를 `.prepr-reports/`의 각 로그에 tee하여 exit와 최초 실패를 유지했다. 단일 green·전체 누적·신규guard 단독·최종13개 실행을 구분한다.

## 8. F-004 · F-005 — Full #3155 attempt별 원격 비교 및 Next.js production audit 보완 (2026-10-22)

### 전체 Attempt 타임라인과 원본 출처

- **원본 Run**: PR #779 / [Full #3155](https://github.com/planner77/masterGantt/actions/runs/39793693125), ID `39793693125`, `pull_request.synchronize`, branch `feat/issue-762-process-workarea`, HEAD `437a505ebe7eac7f9a08f38404a95af7e259793a`, Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597`, Test-Merge `677671d94df106fe2ec6e87522d58ab44e90d4a8`. 세 Attempt는 **동일 commit**의 다른 검사 이벤트이고 별개 수정/재게시가 아니다.
- **F-004 / Attempt1**: 첫 Full8 E2E 8/8, Quality/Docker PASS, 원본 `ci-pr-source-39793693125-1` 보존. 마지막 `QA Final — Automated` Job `119889755461`만 BLOCKED: 원본 로그 사유 `실행 ID/attempt/검증 대상 SHA 불일치`. 후속 QA만 재실행한 **Attempt2**는 같은 HEAD에서 `QA Final — Automated` Job `120030632813` PASS, 공식 PR Run은 `completed/success`; Quality/E2E8/Docker 결과는 원본 Attempt1에 성공한 증거다.
- **별도 Trusted QA 불일치 / Attempt2 연결**: default-main [Trusted #799.1](https://github.com/planner77/masterGantt/actions/runs/39837861572) / Job `120030804446`는 실패. 원본 `ci-pr-source-39793693125-1`은 실제 존재하지만 변경 경로가 아닌 QA Final 재실행에서 `ci-pr-source-39793693125-2`를 새로 생성하지 않아 `원본 CI PR event artifact 누락/중복/만료`로 차단되었다. 정책 결함/개선 후보로 별도 보호 변경 검토; **이번 #762 제품 PR에서 기본 브랜치 Trusted validator를 임의로 편집·완화하지 않는다.**
- **F-005 / Attempt3**: 원본 `ci-pr-source-39793693125-3` **존재**, Test-Merge/HEAD 동일. 정확 첫 실패는 Policy Job `120039957384`의 `production dependency audit`: `npm audit --omit=dev` -> `next 16.0.0 - 16.4.0`, **Critical 1건**, `exit code 1`. 적용 직전 package/lock의 생산 `next@16.3.8`가 영향 범위에 있다. GitHub 보안 권고 `GHSA-2464-fhr4-w9xw`(SVG Image Optimization RCE), `GHSA-p3m5-59mp-jv5r`(Server Actions DoS), `GHSA-673q-mjm6-r5xr`(`use cache` Typed Array RCE)를 함께 표시했다. Npm 진단은 `next@16.4.2` 설치를 안내한다. 원본 오류는 **배포 의존성 보안 취약성 / PRODUCT + 현재 보안 정책 점검**이며 이전 E2E fixture/선택기 재발과 다르다.
- **F-005 직접/파생 분리**: Policy FAIL → `PR 빠른 검사 판정` FAIL → Required Quality / E2E / Docker 세 집계 FAIL → QA Final `required quality 미성공` FAIL; [Trusted #801.1](https://github.com/planner77/masterGantt/actions/runs/39840883591)는 이 실패한 Run을 `원본 PR CI run 자체가 성공하지 않았습니다`로 거부. TypeScript·ESLint·Vitest/Preflight는 Attempt3에서 SUCCESS, Next Build/Chromium8/Docker 구현은 **SKIPPED/NOT TESTED**. 이전 Attempt2의 8/8 PASS를 Attempt3의 실행 PASS로 소급하지 않는다. 원본 npm audit report/Job을 직접 조회했고 취소 shard 실패 증거 없음(본 실행하지 않음). `npm ci`와 Test Discovery(268 unit files, 795 browser tests)는 policy Job에서 audit 이전 PASS.
- **근본 원인 설명**: 동일 lock/HEAD에서 Attempt1 정책은 성공했으나 Attempt3에서 npm advisory registry가 평가한 위험 판정이 바뀌었다. React·DB·Task 변경에 대한 테스트 실패나 Docker 빌드 문제라는 직접 증거가 아니다. 기존 `sharp@0.35.5`는 이미 SVG Image Optimization 권고의 workaround 최저 버전이지만, `next` 자체의 취약 버전 사용과 다른 두 보안 권고를 제거하지 않는다. 무조건 `npm audit --force`/exception/경고 숨김·security gate 비활성화는 금지한다.

### Cross-run 누적 실패와 수정·검증

| 사건 | 고유 직접 원인 | 이전 교정 검증 / 이번 수정 |
| --- | --- | --- |
| F-001 /3150.1 | `issue-726-task-logistics.spec.ts`의 legacy 구역 label locator | 3153/3154 해당 case 개별 PASS, 3155.1 Full8 PASS, test/source 불변 |
| F-002 /3153.1 | `project-logistics-management.spec.ts`의 공정명 srOnly strict 중복 | 3154 case 개별 PASS, 3155.1 Full8 PASS, test/source 불변 |
| F-003 /3154.1 | 같은 spec의 dirty Escape 초안/확인 계약 | 원본 red→로컬 green + 3155.1 Full8 PASS, test/source 불변 |
| F-004 /3155.1 | Automated QA 출처 run/attempt 관측 불일치 | Attempt2 동일 head 재실행 Automated QA PASS, 별도 Trusted #799.1 artifact 미생성 잔여 |
| F-005 /3155.3 | `next@16.3.8`의 새 Critical npm advisory | `next`·`@next/env`와 정확한 8개 SWC lock entries를 `16.4.2`로 보완, 새 원격 audit/모든 Chromium 재검증 **NOT TESTED** |

- **보완 범위**: `package.json` 직접 `next` + `@next/env` **16.3.8→16.4.2 exact pin**, `package-lock.json` 동일 두 package 및 Next의 플랫폼별 `@next/swc-*` **8개**에 대해 동일 npm package metadata SRI·resolved/CPU/OS/optional/engine 필드를 유지하여 정합화. `react/react-dom@19.3.0`, `@swc/helpers@0.5.23`, 내부 의존성 `postcss@8.5.23`, `sharp@0.35.5`, `eslint-config-next@16.3.4`, app version `0.130.0` 및 코드/API/DB, 8-Shard/Required3/Trusted QA/Owner 통제 **불변**. `@next/env`와 SWC를 업데이트하지 않는 부분 수정은 금지한다.
- **공식 근거**: Next.js 2026-10-14 보안 공지 `https://nextjs.org/blog/nextjs-security-update-october-14-2026`, GitHub 보안 권고 3건의 영향을 받는 버전 `<=16.4.0`/최초 patched `16.4.1`. 공식 `v16.4.2` 2026-10-15 릴리스 존재. Production audit 자체가 `next@16.4.2`를 수정 대상으로 반환. Next.js 16.4.2 npm SRI/lock metadata는 독립된 공개 npm-generated package-lock 2개(`kenlasko/monize`/frontend, `DesmondQuayson/math-word-hunt`) 동일 값 확인, 변경 정확10개 및 본 프로젝트 baseline과 대조. 이 외 비관련 lock dependency 자동 업데이트/강제 수정 없음.
- **정적 사전 검증**: Source `package.json`/root lock 일치, next runtime `@next/env` exact 및 SWC8 정확 pin, 전부 유효 SRI, 내장 postcss exact, sharp floor, React/ESLint/버전·공급자·CI source 불변, JSON 왕복/원본 10개만 변경. **소스·metadata 구조 검증 PASS; 새 source npm ci / npm audit / npm build / typecheck / Chromium/SQLite는 로컬 외부 npm registry 접속 불가로 NOT TESTED**. 성공 여부는 새 PR Full CI의 실제 로그/Run ID로만 판정한다.
- **직접·인접·음성 검증 대상**: Production `npm ci --prefer-offline --no-audit`/ `npm audit --omit=dev`/Next.js webpack Production Build 및 standalone runtime Docker smoke. 전체 Chromium8은 Next runtime 의존성 교체로 모든 화면 소비자 영향이 있으므로 공식 Full Required이며, F001/F002/F003의 두 누적 E2E 파일, #762 direct/legacy/Task/설비·copy/template 등 기존 등록 테스트를 생략하지 않는다. 변경 없는 데이터 소유권/권한/복구·원본 행 identity는 기존 E2E/Unit로 회귀 검증한다.
- **문서**: 이 단일 원장, [Issue Work Packet](exec-plans/active/ISSUE_762.md), [Security](SECURITY.md) 갱신. 이전 `docs/TEST_PLAN.md`에 등록한 Chromium 8/8·#762 직접 및 #726/#186 교차 검증 계약을 그대로 사용하며 각 테스트 세부 변경 N/A. `AGENTS.md`/`DESIGN.md`/`docs/QA_REVIEW_POLICY.md`/`docs/CI_CD.md`/`docs/REMOTE_VALIDATION.md`/`docs/DB_SCHEMA.md`/`docs/API.md`는 정책/스키마/API 변경 없음으로 N/A(기존 원칙 적용).
- **인계 및 범위**: 기존 PR #779와 branch 사용. 원격 HEAD `437a505ebe7eac7f9a08f38404a95af7e259793a`, main `72c2c9d0a912dc906d4101ea41a7a57e0c686597` behind0/mergeable=true, unresolved review thread0, changes-requested0 확인. 수정 후 동일 조건 재조회. risk HIGH, QA OWNER_MANAGED/independent human review N/A; 새 Head의 Required3·Trusted·Owner ACCEPT 모두 NOT TESTED, release_required=true/release_authorized=false, MERGE_READY=BLOCKED. 이번 요청은 수정/실패원장/새 PR Full CI 시작까지만, 병합/Main/GHCR/Finalizer/Issue 종료·지속 모니터링 제외.
