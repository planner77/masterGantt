# Issue #895 / #896 / #897 — 단일 PR 초기 누적 검증·실패 원장

## 최초 상태 / Source
- Created: 2026-11-08, primary #895; related #896, #897.
- User-approved scope: one new PR, preserve already merged #894 for #889/#890 only, reuse option A (existing Preview/Playwright/Geometry/QA/Lifecycle).
- Baseline main 90c5a1a951c749a9690b1c83e5a74b6d122dd6e3, version 0.145.1. New branch ci/issue-895-896-897-reuse-visual-uat.
- At initial authoring: no PR run/attempt; all new/modified code local Python/TypeScript tests, Chromium, Docker, Main/GHCR and Preview UAT are NOT TESTED. GitHub source creation is not a runtime test.

## Actual known failures / rework
- None recorded at initial Issue implementation. Historical #889/#890 failures belong to docs/ISSUE_889_890_FAILURE_ANALYSIS.md and must not be relabeled or counted here.
- The first PR Full CI must be attached with exact PR/head/base/test merge, Run ID/Attempt, actual direct failures and cancellations (not aggregate-only), test file/shard status, corrections and unchanged-source outcomes. Never overwrite history.

## Reuse inventory and impact
- #895: AGENTS/Issue Lifecycle/AGENT_PROMPTS/qa_preflight.py/qa_final_automated.py, existing policy tests. No standalone new approval database.
- #896: existing schedule-views Playwright fixture and page.screenshot + geometry, CI E2E8 shard; new integrity checker validates only sanitized synthetic artifacts. Existing #118 before/after comparator retained for its own history; no replacement.
- #897: existing #703 Preview SHA/digest, existing QA GitHub read-only API and Owner GitHub Issue comments; no new token or CI bypass.
- Source/test contract: protected workflow/QA change HIGH; existing main trusted validation, required Quality/Chromium8/Docker, Owner final confirmation and no automatic self-approval.

## Next gate
- Exact new Head PR + CI run initiation; until then Full CI and manual real Preview UAT NOT TESTED.
- release_required=false / release_authorized=false. No merge/Main/GHCR/Issue closure by this initial request.

## 2026-11-08 — PR #900 / Full PR CI #3576.1 최초 실패·누적 분석 및 보완

### 원본과 기존 결과 재사용
- [PR #900](https://github.com/planner77/masterGantt/pull/900), Primary #895 (related #896, #897), branch `ci/issue-895-896-897-reuse-visual-uat`, event `pull_request/opened`. [Run #3576.1](https://github.com/planner77/masterGantt/actions/runs/42471148020), ID **42471148020**, attempt **1**, 2026-11-08 10:22–10:23 UTC, `conclusion=failure`.
- 원본 `head=e581168767765e3950e23acabb0a3c2843d4ee68`, `base=90c5a1a951c749a9690b1c83e5a74b6d122dd6e3`, 원본 CI checkout `test-merge=c8cc0a94cae1979d585df439a4617dc721980755`. 해당 SHA들을 혼합해 PASS 승격하지 않는다.
- 해당 Issue의 현재 접근 가능한 Full PR CI 실패 이력은 #3576.1 한 건이다. 같은 HEAD의 FAST_DEVELOPMENT #318.1 / Run 42471147985는 `SKIPPED`. #889·#890/#894의 역사적 실패는 해당 이슈 원장에 보존하며 #895의 직접 실패로 중복 산정하지 않는다.
- 기존 trusted #711 QA·Preflight·Final, #703 Preview, #118 Geometry, Chromium8/schedule-views fixture, 기존 OCI/Release 보호를 그대로 재사용한다.

### 원본 Job/Step·실행 상태
| Job ID·명칭 | 실제 결론 | 실제 관측·원인 |
| --- | --- | --- |
| 128701932465 변경 경로 판정 | PASS | 경로·위험 판정 성공 |
| 128701932197 QA Final 신뢰 경계 확인 | PASS | trusted checkout 검증 |
| **128702014595 QA Preflight** | **FAIL — 최초 직접 실패** | 원본 base `scripts/qa_preflight.py`의 `DOCUMENTATION_SYNC`: Work Packet `ISSUE_895.md`에 `docs/SCHEDULING_ENGINE.md` 영향 기록 없음. 다른 PRIMARY/RISK/QA/RELEASE/PATH/ISSUE_AC 판정은 PASS |
| 128702101552 PR 빠른 검사 | FAIL (파생) | PREFLIGHT_RESULT=failure; policy/typecheck/lint/unit 미실행 |
| 128702102565 정책, 128702102865 TypeScript, 128702102325 ESLint, 128702102209 Unit, 128702102737 Next.js build | SKIPPED / NOT RUN | QA Preflight 차단으로 원본 테스트 수행되지 않음 |
| 128702162712 Chromium 8-shard matrix, 128702162273 Docker 구현 | SKIPPED / NOT RUN | E2E·Docker 실제 실행·검증/Visual Artifact 없음 |
| 128702161534 Quality 집계, 128702161448 E2E 집계, 128702161447 Docker 집계 | FAIL (파생) | 사전 검사 실패 때문에 Required 집계 차단; 실제 Quality/E2E/Docker 실패로 오해 금지 |
| 128702183601 QA Final — Automated | FAIL (파생) | 세 Required 미성공. Owner/Trusted QA 승인 아님 |
| 128702183589 변경 영향 Shadow 계획 | PASS (비차단) | Required PASS 대체 불가 |

[사전 검사 로그](https://github.com/planner77/masterGantt/actions/runs/42471148020/job/128702014595), [Fast Gate 로그](https://github.com/planner77/masterGantt/actions/runs/42471148020/job/128702101552), [QA Final 로그](https://github.com/planner77/masterGantt/actions/runs/42471148020/job/128702183601).
**실제 실패 테스트 파일의 합집합 = 없음(아직 미실행)**. `tests/python/test_preview_uat.py` 결함은 코드 리뷰로 발견되었으며 원본 CI 직접 실패로 소급하지 않는다. 취소된 E2E 케이스/실행 시간이나 성공 횟수를 추정하지 않는다.

### 전체 실패 Cross-run 매트릭스·교정
| ID | 근거·분류 | 보완·영향 소비자 | 차기 신규 Head 검증 |
| --- | --- | --- | --- |
| F-001 #900/#3576.1 QA Preflight | `POLICY_CI` — Scheduling Engine 영향 기록 누락 | `docs/exec-plans/active/ISSUE_895.md`에 `docs/SCHEDULING_ENGINE.md: N/A(reason)` 기재. Scheduling algorithm/DB/API 변경 없음. 기존 trusted `docs_gate` 재사용 | Preflight/Final 자동 QA·Required3 **NOT TESTED** |
| R-001 [P1 UAT parser](https://github.com/planner77/masterGantt/pull/900#discussion_r4505873586) | `TEST_CONTRACT` — 숫자 `evidence_sha256`가 `[a-z_]+`에 불일치 | `scripts/preview_uat.py` 필드 정규식 숫자 허용 + allowlist·중복·SHA/Digest/Owner 보호 유지; `tests/python/test_preview_uat.py` 정상·미등록 숫자 키 음성 회귀 보강 | Python policy/positive·negative **NOT TESTED** |
| R-002 [P1 Visual source SHA](https://github.com/planner77/masterGantt/pull/900#discussion_r4505873588) | `FIXTURE_OBSERVABILITY` — `CI_E2E_SOURCE_HEAD_SHA`는 CI가 전달하지 않는 이름 | 기존 `E2E_SOURCE_HEAD_SHA` 사용. GitHub Actions에서는 변수 없으면 test-merge로 대체하지 않고 차단. 로컬 fallback 보존. Chromium8/manifest/Preview source 일치 검증 필요 | E2E shard·Manifest **NOT TESTED** |
| R-003 [P1 CI 한글](https://github.com/planner77/masterGantt/pull/900#discussion_r4505873590) | `POLICY_CI` — 신규 step과 Summary 영어 표기 | `.github/workflows/ci.yml` 한글 표시·요약만 수정. Job ID/Required check/artifact path·상태 코드 불변 | Workflow 실제 실행 **NOT TESTED** |

### 같은 source 영향·인계
- 직접: Python UAT parser allowlist/양·음성, Visual Evidence 정확한 source SHA, Work Packet docs gate, Workflow 한글 정책. 간접: QA Final·Preflight·PR Fast Gate, 기존 8-shard Playwright, UI JSON integrity validator, Preview digest. 미실행 항목은 신규 Full PR CI에서 수행해야 한다.
- 보호 정책: risk_level=HIGH, OWNER_MANAGED, qa_required=true, release_required=false. 새 Required/신뢰 QA/Owner 수용·충돌/리뷰 해결은 별도; skip/retry/timeout 상향, 역사 원본 삭제, #894 변경 없음.
- 코드 변경·문서 교정과 누적 원장 기록은 **동일 신규 Git commit**으로 push하여 `pull_request/synchronize` Full PR CI를 트리거한다. 원격 검증 이전에 로컬/신규 CI PASS를 주장하지 않는다. 새 SHA의 Run·Attempt/검증 결론은 이후 수집하며 본 요청에서는 모니터링하지 않는다.

## 2026-11-08 — PR #900 / Full PR CI #3577.1 재실패·전체 실패 매트릭스 갱신

### Run 출처와 이전 증거 재사용
- [Run #3577.1 / ID 42472111325 / Attempt 1](https://github.com/planner77/masterGantt/actions/runs/42472111325), workflow CI PR [전체 검증], event `pull_request/synchronize`, 2026-11-08 10:35–11:14 UTC, `conclusion=failure`.
- `head=9f36ccae7dff8bb5887e93867d0ab23dee75c517`, `base=90c5a1a951c749a9690b1c83e5a74b6d122dd6e3`, PR test-merge `e3b543bb5f784d3e9379bb0686247864ef40f54b`. 원본 `#3576.1 / e581168`의 실패 문서·리뷰 이력은 상단에 불변 보존.
- [FAST_DEVELOPMENT #319.1 / 42472111198](https://github.com/planner77/masterGantt/actions/runs/42472111198)는 SKIPPED·비권위. 이전 Full #3576.1의 간접 파생 실패를 이 신규 Run의 직접 실패로 재분류하지 않는다.

### 실제 Job·Shard·원본 로그
| 항목·Job ID | 결론·실측 결과 | 단계·원인 |
| --- | --- | --- |
| 신뢰 경계 128705079302, 변경 경로 128705079521, **Preflight 128705157779** | PASS | 이전 F-001 `docs/SCHEDULING_ENGINE.md` 문서 영향 누락 교정 성공. 이전 판정과 로그 재사용 |
| 정책 128705229184 | PASS | 기존 Python UAT parser 9 tests PASS, Visual Evidence 7 tests PASS; 별도 재수정 불필요 |
| TypeScript 128705229227, ESLint 128705229155, Vitest 128705229137, Next.js PR Build 128705811946 | PASS | 소스·제품 로직 직접 테스트 성공. 새 HEAD에 PASS 자동 이월 불가 |
| 빠른 검사 128705743487, Quality 집계 128706130607, Docker 구현 128705811936·Docker 집계 128707025669 | PASS | 품질·Docker 보호 유지; 단계별 원본 재사용 |
| Chromium E2E **1/8** 128705812030, **2/8** 128705811997, **5/8** 128705812040, **6/8** 128705812028, **7/8** 128705811954, **8/8** 128705812018 | PASS | 여섯 shard에서 실제 작업 완료; 이전 SHA의 성공이며 최종 신규 SHA 전체 PASS 아님 |
| [Chromium **3/8** Job 128705812025](https://github.com/planner77/masterGantt/actions/runs/42472111325/job/128705812025) | **FAIL / 직접 원인 F-002** | Playwright **148 PASS, 1 SKIPPED** (149 selected)로 실제 테스트 완료. 후속 `합성 UI 증거 체크섬·기하 검증`에서 `{"status":"BLOCKED","reason":"screenshot missing, symlink, or too large"}` 실패 |
| [Chromium **4/8** Job 128705811998](https://github.com/planner77/masterGantt/actions/runs/42472111325/job/128705811998) | **CANCELLED/INCOMPLETE** | matrix fail-fast로 E2E 실행 진행 중 취소, 로그상 완료된 테스트는 PASS 사례로 보존하되 전체 shard PASS 아님. 실제 독립 테스트 FAIL 증거는 없음 |
| Chromium Required 집계 128713715119, QA Final 128713740037 | FAIL (파생) | E2E shard 3 FAIL·4 CANCELLED에 따른 차단. QA Final `required e2e 미성공`; 신규 제품/Owner 판정 오류가 아님 |
| 변경 영향 Shadow 128713739887 | PASS (비차단) | Required/Owner/QA 승인으로 승격 불가 |

### 실물 Artifact 정밀 재현
- [shard-3 원본 Visual Evidence ZIP](https://github.com/planner77/masterGantt/actions/runs/42472111325/artifacts/13614838072), Artifact ID `13614838072`, 4 files. Playwright 실제 정상 JSON·PNG 형제 파일과 `attachments/` 밑 자동 복제 2건으로 구성.
- 원본 `ui-evidence-resource-1440-ko.json`은 screenshot `ui-evidence-resource-1440-ko.png`를 참조하며 실제 PNG 크기 **122326 bytes**, SHA-256 `c00ff17fca014217455424c0b63c48add91ef44e798d75c9203a055b31347b7f`이 정확하게 일치.
- `attachments/ui-evidence-resource-1440-ko-json-<hash>.json`은 Playwright `testInfo.attach(path=...)`가 생성한 **report-view 복제본**. 내용은 원본과 동일하지만 이 `attachments/` 폴더에는 manifest가 요구하는 basename의 PNG가 없어 `validate_manifest()`에서 FAIL. 상대 위치가 바뀐 복제본을 독립 canonical manifest로 `rglob` 처리한 것이 증명된 최초 원인.
- 원본 증거 유실/손상 또는 PNG checksum 실패가 아니다. ZIP 격리 환경에서 `attachments/` 배제한 원본 1쌍 선택 → screenshot 존재·hash 일치 **진단 PASS**; 이는 GitHub 신규 HEAD의 공식 Python/Chromium PASS 아님.

### 전체 이력·원인/교정 Cross-run
| ID·실패 회차 | 실제 최초 원인 | 이전 조치의 재사용과 이번 교정 | 새 Head 미검증 |
| --- | --- | --- | --- |
| F-001 #3576.1 / QA Preflight | `POLICY_CI`: `ISSUE_895.md` Scheduling Engine DOC_SYNC 누락 | 수정 `9f36cca`를 신규 #3577.1 Preflight PASS로 재사용해 해결 판정. 해당 코드·문서 추가 변경하지 않음 | 신규 source 구조 검사 미실행 |
| R-001/R-002/R-003 #3576.1 리뷰 3건 | 숫자 필드 파서/소스 SHA/CI 한글 정책 | 댓글 답변·resolved, #3577.1 Policy/Chromium 검사로 사용된 부분 증거 보존. 기존 3건 수정 재진행 불필요 | 신규 HEAD의 전체 Trusted QA 전 NOT TESTED |
| **F-002 #3577.1 / Chromium3 post-test** | `FIXTURE_OBSERVABILITY`: 실물 `attachments/` 파일을 독립 JSON manifest로 오검증 | 기존 `scripts/ui_evidence.py` 스캐너가 canonical 디렉터리만 탐색하고 checksum/fixture/geometry 검증은 보존. `testInfo.attach` 표시명을 canonical prefix 밖으로 구분. 기존 `tests/python/test_ui_evidence.py`에 attached-copy 오탐 및 canonical 누락 음성 회귀 2건 추가 | 신규 HEAD 8-shard·report artifact **NOT TESTED** |
| #3577.1 Chromium4 | `CANCELLED`, 독립 FAIL 아님 | shard3 원인을 먼저 고쳐 정상 8-way 완료를 확인. 테스트 skip/timeout 증가나 역사 결과 삭제 없음 | 취소된 잔여 테스트 **NOT RUN** |

- **전체 직접 실패 합집합**: `scripts/qa_preflight.py`의 `docs_gate` DOC_SYNC (#3576.1), `scripts/ui_evidence.py`의 `main()/validate_manifest()` 실제 Artifact 검증 (#3577.1). **실제 Playwright assertion 실패는 관측되지 않음**. 직접·간접·음성 교차: `test_ui_evidence.py` positive/checksum/unsafe/attachments, `test_preview_uat.py` 이전 9 PASS 재사용, 기존 `schedule-views.spec.ts` 148 PASS/1 SKIPPED, E2E 8-shard/업로드/Required, QA Preflight·Final.
- 역할: infra=Run/Job/ZIP 원본, 구현=검증기·첨부명·회귀, Manager=F-001/F-002 재발/파생 분리·리뷰/충돌·원장, Owner=사후 Preview UAT·최종 HIGH 승인. 이전 6 shard/Quality/Docker **PASS는 진단 증거만 재사용**하며 신규 SHA의 공식 Required PASS를 대체하지 않는다.
- 검증 명세: 동일 원본 ZIP을 임시 격리해 `attachments/` 배제 canonical JSON 하나만 선택 및 PNG SHA256 일치 확인(진단 PASS). 수정 후 신규 exact HEAD 전체 CI/Trusted QA/Owner UAT는 **NOT TESTED**. CI 보호/8 shard/fail-fast/timeouts·독립 UAT/Release·다른 이슈 PR #894 불변.
- Review: [PR #900](https://github.com/planner77/masterGantt/pull/900) 현재 미해결 review thread 0, 기존 3건 resolved/outdated, 새 발견 없는 상태. Mergeability `true`, base `main`, 확인 당시 conflict 없음. 원장과 보완 사항을 동일 단일 commit에 기록하고 PR `synchronize` CI만 시작하며 이후 모니터링은 실시하지 않는다.

## 2026-11-08 — PR #900 / Full PR CI #3578.1 취소 재발·교차 원인 종합

### 원본 Run/Attempt, 전체 이력·출처
- [Full PR CI #3578.1](https://github.com/planner77/masterGantt/actions/runs/42475849089), Run ID **42475849089**, Attempt **1**, event `pull_request/synchronize`, overall `CANCELLED`, 2026-11-08 11:27–12:07 UTC. PR #900 / Primary #895, related #896·#897, branch `ci/issue-895-896-897-reuse-visual-uat`.
- Exact `head=6bf821cf9c57941f2e1547b8cb1552b6f99ea277`, `base=90c5a1a951c749a9690b1c83e5a74b6d122dd6e3`, event test-merge `a1ba45dfdb01d0fbff46c757add5ed756335698e` (different from Head). FAST_DEVELOPMENT #320.1 / ID 42475849103 is `SKIPPED` and does not certify Full.
- Old evidence reused without rewriting: #3576.1 initial Work Packet documentation impact FAIL was resolved by #3577.1 Preflight PASS; #3577.1 synthetic UI evidence attachment-copy false FAIL resolved by #3578.1 shard3 PASS + exact one-manifest integrity receipt. Previously reviewed P1 threads remain resolved. Neither past PASS nor current partial 7/8 meets Full8.

### Source Run actual Jobs and failure/cancellation separation
| Job/ID | Observed state | Independent/derived details |
| --- | --- | --- |
| QA trust 128716933531, Change paths 128716933392, QA Preflight 128717001807 | PASS | Prior F-001 fix reused, not repeated |
| Policy 128717076589, TypeScript 128717076547, ESLint 128717076601, Vitest 128717076596, PR Fast Gate 128717674643 | PASS | No independent failing unit or type assertion |
| Next.js PR build 128717738614, Quality aggregate 128718101407, Docker smoke implementation 128717738718, Docker aggregate 128718871374 | PASS | Existing producer/build/smoke reusable as prior-source diagnostic only |
| E2E **1/8** 128717738700, **3/8** 128717738636, **4/8** 128717738726, **5/8** 128717738714, **6/8** 128717738658, **7/8** 128717738659, **8/8** 128717738664 | PASS | Successful Playwright test-body wall minutes: 25.2, 27.4, 31.3, 23.2, 21.4, 22.7, 19.5 respectively; no new PASS applied to next source |
| [E2E **2/8**, Job 128717738673](https://github.com/planner77/masterGantt/actions/runs/42475849089/job/128717738673) | **CANCELLED / F-003** | Historical plan 19 files, 113 tests selected, **102 completed PASS**, 11 **NOT RUN**. Job started 11:31:24Z; `The operation was canceled` at 12:06:35Z, ~35m11s after start; `.github/workflows/ci.yml` has unchanged `timeout-minutes: 35`. No Playwright test assertion failure observed. Job-timeout interpretation strongly supported by time and configuration; no contrary failed testcase log |
| E2E Required aggregator 128725685576, QA Final 128725710106 | FAIL, **derived** | E2E `RESULT=failure` due to incomplete shard2; QA Final: `required e2e 미성공`. Do not count separate product failures |
| Change impact Shadow 128725710177 | PASS (advisory only) | Non-authoritative; no Owner/Trusted QA bypass |
| Main OCI publish 128725711340 | SKIPPED | Never infer GHCR/Release pass from PR |

- Shard3 original log `148 passed / 1 skipped` and exact manifest `EVIDENCE_VERIFIED_NOT_UAT`, `sourceSha=6bf821cf...`; [artifact 13615693566](https://github.com/planner77/masterGantt/actions/runs/42475849089/artifacts/13615693566). Previous `#3577.1` original failing ZIP and `#3576.1` direct preflight diagnostics remain recorded above.

### F-003 measured load and new design (not a timeout increase)
- Existing full8 plan has **147 unique files** in shards `[17,19,17,22,18,16,19,19]`, historical original LPT projectedMs unchanged since original #767 and subsequent manual #885/#894 decisions. #3578.1 measured shard2 102/113 PASS before 35m cancellation; among successful complete files, `issue-734-equipment-dashboard.spec.ts` ran 8 PASS, 4.5m summed test body and about **7.6m completion span**. Shard4 `issue-735-system-dashboard.spec.ts` ran 6 PASS, 3.1m test body and about **5.0m completion span**.
- Rebalance whole file `tests/e2e/issue-734-equipment-dashboard.spec.ts` **2→8**, `tests/e2e/issue-735-system-dashboard.spec.ts` **4→6**. Recipient #8 19.5m and #6 21.4m, source #4 31.3m, chosen to reduce both the current critical shard2 and near-critical shard4 without moving existing #889/#890 schedule-view fixture. No new shard/test runner; no per-test selective exclusion. Current counts become `[17,18,17,21,18,17,19,20]`, same 147 unique spec paths. File ordering sorted.
- Shift-only approximate observed job bodies including source completion spans: shard2 canceled portion ~35.2−7.6=27.6m **plus 11 unmeasured cases**, #4 31.3−5.0≈26.3m, #6 21.4+5.0≈26.4m, #8 19.5+7.6≈27.1m. This is **not** a calibrated forecast: missing/censored cases, fixture/setup coupling, host jitter and cross-shard overhead cannot be treated as zero or as assured gains.
- Preserve #885 and #894 immutable recorded history; add `manualRebalance900` with exact run/head/base/merge, 35m timeout, observed test counts, move list, before/after file counts, and estimation caveat. `tests/scripts/e2e-shard-planner.test.ts` asserts unique 147 inventory, 8-way selects and reverses current #900 moves to historical #894 and #885 counts. Existing `scripts/e2e-shard-planner.mjs` unchanged. No test assertion/skip/retry/worker/timeouts, Required3, trusted QA, Original test plan, GHCR or #894 change.
- Classification: **ENVIRONMENT / CI_SHARD_JOB_TIMEOUT**, not PRODUCT assertion. This is independent new incident F-003, not recurrence of F-001 document record or F-002 evidence path. Whole prior direct-failure set: `docs_gate` DOCUMENTATION_SYNC F-001 (fixed, remote Preflight PASS), synthetic `ui_evidence.py` attachment traversal F-002 (fixed, remote shard3 verifier PASS), shard2 35m incomplete F-003 (rebalance candidate; remote new Head NOT TESTED).

### Evidence, review, remaining authority
- Tests to revalidate on **one new exact Head**: current `tests/scripts/e2e-shard-planner.test.ts` unique coverage and historical invariant (targeted unit), plan selector, all 8 Playwright shards (including 11 incomplete cases), QA Preflight/Policy, Quality, Docker, and QA Final. Old successful runs supply diagnostic durations only. No local/browser Full8 PASS claimed. Direct TypeScript/Playwright source unchanged.
- All 3 previous inline review threads were resolved/outdated, no new unresolved threads observed; base `main`, `mergeable=true` before preparing correction. New conflicts/reviews to recheck before push. Owner UAT/Trusted QA/Merge not authorized. Script/write and docs/Work Packet/Failure ledger bundled into one source commit and one fast-forward PR ref update, triggering Full PR synchronize CI; **no CI monitoring**.


## 2026-11-08 — PR #900 / Full PR CI #3579.1 E2E 테스트 예산 초과

### A–C. 원본 Run·전체 누적 이력
- [Run #3579.1 / ID 42479544101, attempt 1](https://github.com/planner77/masterGantt/actions/runs/42479544101), pull_request/synchronize, overall FAILURE, 2026-11-08 12:17–12:48 UTC, Primary #895, related #896/#897. Head e47edb631208704bc8595022b7eb6066ac709676; base 90c5a1a951c749a9690b1c83e5a74b6d122dd6e3; test-merge 6d0d3c6aed297b563781b6bbefdee13a67f01d74. FAST_DEVELOPMENT #321.1 / ID 42479544090 was SKIPPED and is not Full CI PASS.
- Immutable earlier incidents F-001 (#3576, Work Packet document impact), F-002 (#3577, Visual Evidence attachment copies), F-003 (#3578, 2/8 shard 35-minute job cap) are retained above. #3579 Preflight and #3 Visual Evidence and #2 shard completed successfully; do not repeat previously validated repairs.

### Actual Job/Step and direct/derived status
| Job ID | Conclusion | Observation |
| --- | --- | --- |
| QA trust 128728269876; change paths 128728270161; Preflight 128728345892 | PASS | Previous Work Packet correction reused |
| Policy 128728442577; TS 128728442636; Vitest 128728442646; ESLint 128728442666; PR gate 128728835912 | PASS | No independent unit or static-contract failure |
| PR Build 128728909728, Quality 128729266722, Docker impl 128728909765, Docker aggregate 128730380960 | PASS | Prior validation healthy on this head |
| E2E 1/8 128728909729, 2/8 128728909878, 4/8 128728909780, 5/8 128728909763, 6/8 128728909819 | PASS | Five complete shards |
| [E2E 7/8 Job 128728909802](https://github.com/planner77/masterGantt/actions/runs/42479544101/job/128728909802) | FAIL / F-004 DIRECT | 108 selected: 101 PASS, 1 FAIL, 6 NOT RUN (--max-failures=1). project-task-persistence.spec.ts:58 original W07 scenario fails after 30.9s, Playwright Test timeout of 30000ms exceeded at final GET around line 261; no assertion mismatch shown |
| E2E 3/8 Job 128728909744; 8/8 Job 128728909767 | CANCELLED (derived) | Matrix fail-fast; 142 and 109 tests respectively had passed before cancellation, but whole shards INCOMPLETE |
| Required E2E aggregate 128735426945, QA Final 128735445768 | FAIL (derived) | Required E2E incomplete; QA Final reason required e2e 미성공 |
| Advisory Shadow 128735445759 | PASS/advisory | Not Trusted/Owner acceptance |
| Main temporary OCI 128735447196 | SKIPPED | No GHCR/Release evidence |

### D–F. Evidence-based cause, repair and crossed regressions
- Exact same W07 test previously PASS at 29.4s (#3577.1) and 23.1s (#3578.1), then 30.9s FAIL at #3579.1. Playwright trace [shard7 report artifact 13618190833](https://github.com/planner77/masterGantt/actions/runs/42479544101/artifacts/13618190833) contains test.trace, 0-trace.trace, 1-trace.trace. Earlier GET/POST/DELETE returned normally. The final canonical GET starts near the per-test deadline, so no evidence supports a 30-second API hang or product data assertion failure.
- Classification F-004: TEST_CONTRACT / FIXTURE_OBSERVABILITY. A monolithic ~260-line W07 test combines pointer moves and rejects (422/412/500), unknown-write recovery, delete/reload, simultaneous 201/412 race, forced 401 readonly/unlock, native root/child add and final reload. Per-test 30s budget exhaustion differs from F-003 35-minute shard cap.
- Reuse existing test.use(isolatedApplicationOptions) with per-case isolated Next/SQLite, createProject, drag helpers, route guards and **all positive/negative assertions**. Divide W07 into two independent cases at canonical deletion/reload boundary: A=pointer/error/manual-recovery/delete; B=fresh empty project, exact If-Match race, 401/readonly/reunlock and native hierarchy add with persisted canonical snapshot. Add empty-list assertions after delete and before race. No removed tests, skip, retry, increased timeout, relaxed assertions or new fixture, pipeline, E2E8 or Required3 policy.
- Accumulated failure union: F-001 docs_gate; F-002 ui_evidence.py canonical report; F-003 E2E2 35m; F-004 project-task-persistence.spec.ts W07 30s. Direct and indirect regression scope: both W07 scenarios and actual HTTP/SQLite, 8-shard full run (including #3 visual evidence and #2 rebalanced workload), existing Python UAT and UI guards, Preflight/Policy/TypeScript/Vitest/Docker/QA. Past PASS is diagnostic; updated exact Head NOT TESTED.
- Local environment: original GitHub job and downloaded trace inspected. No local Next/Chromium environment available to claim executable browser PASS. Static source check: original one W07 scenario becomes two, all existing contract/assertion signatures preserved, no timeout/skip/retry changes.

### G. Review/merge/publish boundary
- Before editing: 3 earlier P1 review threads resolved/outdated, unresolved=0; PR base main and mergeable=true. Recheck before push.
- Single Git Data batch: original W07 spec refactor, Issue #895 Work Packet, TEST_PLAN_895_897.md and this canonical ledger only; prior CI and Visual Evidence code remains unchanged. New synchronize Full PR CI must establish its own PASS. No CI monitoring, merge, Main, GHCR, Release, or Issue closure authorized.


## 2026-11-08 — PR #900 / Full #3580.1 SC-03 등록표 참조 누락

### A–C. 원본·전체 이력 대조와 재사용 결정
- [Full #3580.1 / Run 42483080590 / attempt 1](https://github.com/planner77/masterGantt/actions/runs/42483080590), `pull_request/synchronize`, 2026-11-08 13:03:05–13:06:50 UTC, `FAIL`. Head `136f927ba4a639d5814e43e29c071629a5ce715f`, base `90c5a1a951c749a9690b1c83e5a74b6d122dd6e3`, checkout test-merge `ff4a0c0d3b908989b67e255de9d4111410cd3e41`. 원본 출처는 [source artifact 13618252718](https://github.com/planner77/masterGantt/actions/runs/42483080590/artifacts/13618252718) 및 Vitest checkout 로그다.
- 원격 `ci.yml/runs?branch=ci/issue-895-896-897-reuse-visual-uat` 전체 페이지와 원장 전체를 대조: #3576.1 `42471148020` FAIL, #3577.1 `42472111325` FAIL, #3578.1 `42475849089` CANCELLED, #3579.1 `42479544101` FAIL, #3580.1 `42483080590` FAIL, 모두 attempt 1. 이전 네 Run의 정확한 SHA·Job·취소·미실행 상세는 위 불변 절을 재사용하며 같은 로그·artifact를 다시 내려받거나 진단을 반복하지 않았다. FAST_DEVELOPMENT #322.1 / `42483080611` SKIPPED는 비권위다.
- `REUSE_DECISION: EXTEND`: Owner의 기존 A안 및 이번 “단계 결과 재활용” 요청에 따라 W07 독립 시나리오·실제 AST 검사기·기존 음성 회귀·샤드 플래너를 재사용한다. 재사용 범위·조건은 기존 Work Packet과 동일하며 추가 기능/승인 경로를 생성하지 않는다. 이전 성공은 원인 진단 근거이고 신규 Head의 Required PASS가 아니다.

### 실제 Job/Step과 직접·파생 실패
| Job ID·항목 | 실제 결론 | 관측 |
| --- | --- | --- |
| 경로 128739033563, 신뢰 경계 128739033889, Preflight 128739114241 | PASS | F-001 교정 재사용 |
| Policy 128739200778, TypeScript 128739200837, ESLint 128739200848 | PASS | 기존 Python/정책·타입·lint 교정 유지 |
| [Vitest 128739200785](https://github.com/planner77/masterGantt/actions/runs/42483080590/job/128739200785) | **FAIL / F-005 직접** | 13:06:07 UTC, `tests/features/gantt/state-consistency-manifest.test.ts:15`, SC-03가 분리 전 영어 제목을 찾지 못함. 1 FAIL / 3799 PASS / 3 SKIPPED, 310 files, 104.49s |
| Fast Gate 128739776684 | FAIL (파생) | Unit 실패로 차단 |
| PR Build 128739839919, E2E matrix 128739840017, Docker 구현 128739840075 | SKIPPED / NOT RUN | 새로운 W07 두 시나리오/브라우저/SQLite/Docker 실행 증거 없음 |
| Required Quality 128739838904, E2E 128739838896, Docker 128739838948 | FAIL (파생) | 실제 E2E/Docker 오류로 중복 산정하지 않음 |
| QA Final 128739860876 | FAIL (파생) | Required3 미성공; Trusted/Owner 승인 아님 |
| Shadow 128739860848; Main 게시 128739861821 | PASS(advisory); SKIPPED | Main/GHCR 검증 없음 |

### 종합 원인·누적 실패 매트릭스
| 실패 ID | 기존 교정·이번 재발/회귀 판정 | 후보 source 검증·남은 범위 |
| --- | --- | --- |
| F-001 #3576 DOC_SYNC | #3577~#3580 Preflight PASS, 수정 재진행 불필요 | 기존 Preflight/Final 양·음성 unit 재사용 |
| R-001~003 파서/source SHA/한글 리뷰 | 기존 3개 스레드 resolved/outdated, 현재 미해결 0 | 기존 UAT/증거 Python 회귀 재사용, 과거 리뷰/로그 불변 |
| F-002 #3577 attachment-copy 검증 | #3578 shard3의 canonical manifest 1개 검증 PASS 재사용; #3579 shard3는 CANCELLED이며 전체 PASS 아님 | 기존 canonical/attachment/checksum/unsafe 음성 unit 재검증 |
| F-003 #3578 35m shard2 | #3579 shard2 PASS, 재배치 교정 유지 | 기존 플래너 exact coverage/unique/history 회귀 재검증; 실제 신규 8-shard wall time NOT TESTED |
| F-004 #3579 W07 30s | 기존 두 독립 시나리오 설계 유지; #3580에서는 미실행 | W07 실제 Chromium/HTTP/SQLite·timeout 해소 **NOT TESTED**, 새 Full에 인계 |
| **F-005 #3580 AST 등록표** | `TEST_CONTRACT`: F-004 분리의 간접 소비자 동기화 누락. 삭제된 영어 제목을 live JSON이 계속 참조 | SC-03를 현재 A·B 두 제목으로 등록; 실제 기존 AST 검사 RED→GREEN. 검사기·assertion 완화 없음 |

- 누적 직접 실패 파일/계약 합집합: `scripts/qa_preflight.py` docs gate → `docs/exec-plans/active/ISSUE_895.md`; `scripts/ui_evidence.py`; `tests/config/e2e-shard-plan.json`이 배치한 `issue-734-equipment-dashboard.spec.ts` 등 shard2 workload(개별 assertion FAIL 아님); `tests/e2e/project-task-persistence.spec.ts`; `tests/features/gantt/state-consistency-manifest.test.ts` → `tests/config/gantt-state-conformance.json`.
- 원격 로그와 같은 오류를 기존 `npm test -- tests/features/gantt/state-consistency-manifest.test.ts`로 최소 재현: **1 FAIL / 13 PASS, 1.97s**. 별도 infra 읽기 전용 실제 AST 검산에서도 원본 오류 1개, 두 현재 제목을 넣은 메모리 후보 오류 0개였다. 원격 test-merge SHA와 로컬 Head의 동일 증상은 checkout drift 원인에 반하며, 실제 현재 한글 제목을 인식하므로 AST의 한글 처리 결함도 기각한다.
- 수정은 `tests/config/gantt-state-conformance.json` SC-03의 제목 교정 및 종전 결합 시나리오 양쪽 등록뿐이다. `HTTP_SQLITE`/`REGRESSION_REFERENCE`/`NOT TESTED`, owners/rules/requiredEvidence 보존. 역사적 evidence/옛 제목·기존 제품 코드·W07 spec·검증기·샤드·workflow·version은 수정하지 않는다.

### D–F. 동결 후보의 제한적 교차 검증
- source 기준: parent `136f927ba4a639d5814e43e29c071629a5ce715f` + 수정 manifest SHA256 `6f3aaa81aab220fed888d04eb731907c527f2a21cbda721263572403b0ac56ab`. 아래 검사 이후 executable source/fixture 변경 없음; 원장/Work Packet/Addendum/PLAN만 문서 갱신.
- 환경: Linux 독립 worktree, Node `22.14.0`, Vitest `5.0.0`, TypeScript `5.8.3`, Python 3. 기존 작업 폴더의 `node_modules`를 링크하여 순수 AST/unit에만 재사용했으며 PR lockfile의 frozen install 동등성을 주장하지 않는다. 원래 작업 폴더의 사용자 변경은 보존한다.
- **PASS — 45 tests / 3 files / 2.13s**: `npm test -- tests/features/gantt/state-consistency-manifest.test.ts tests/scripts/e2e-shard-planner.test.ts tests/scripts/prepr-verifier.test.ts`. 실제 SC-01~14 source-reference 검증, missing/duplicate/parameter/path/evidence-exaggeration 음성, 이전 shard 교정·일대일 coverage/history 및 W07 관련 prepr 소비자 매핑을 재사용했다. `fatal: Needed a single revision`은 prepr 음성 fixture의 stderr이며 최종 exit 0이다.
- **PASS — 73 tests / 0.032s**: `PYTHONPATH=scripts python3 -m unittest scripts/test_qa_preflight.py scripts/test_qa_final_automated.py tests/python/test_ui_evidence.py tests/python/test_preview_uat.py`. 누적 정책/문서·attachment·checksum·unsafe·Owner/REWORK/stale receipt 양·음성 재검증. fixture가 출력하는 API 부재 `QA Final BLOCKED`는 음성 테스트 결과이며 실제 Trusted QA 실행이 아니다.
- **BLOCKED — 로컬 Playwright 목록 조회**: `npm run test:e2e -- tests/e2e/project-task-persistence.spec.ts --list`가 재사용 설치의 `Cannot find module 'unified'`로 import 단계 실패, `No tests found`는 파생 메시지다. 실제 테스트 assertion 실패와 구별한다. 뒤의 `node scripts/verify-test-discovery.mjs`는 명령 중단으로 **NOT RUN**. 브라우저용 설치 확대나 전체 로컬 회귀를 추가하지 않고 기존 AST 검증·과거 원격 근거를 재사용; 실제 W07 두 시나리오/최신 Full E2E8·Docker는 **NOT TESTED**다.
- full typecheck/lint/build/Docker는 이번 JSON 참조만의 보완과 무관한 추가 로컬 반복이므로 기존 #3580 타입/lint 및 #3579 Build/Docker를 진단 근거로 재사용한다. 신규 Head의 공식 성공은 새 Full PR CI로만 판정한다. 새 regression test는 기존 red-capable 실제 AST/음성 검사로 충분하여 중복 생성하지 않았다.

### G. 문서·리뷰·충돌·게시 경계
- 문서 영향: 이 원장, `ISSUE_895.md`, `TEST_PLAN_895_897.md`, active `PLAN.md` 갱신. 기존 `TEST_PLAN.md` 원본 보존. 제품 API/DB/보안/일정 알고리즘/UI 및 CI workflow 계약은 변경이 없어 관련 규범 문서 추가 수정 N/A. 신규 manifest 등록은 실행 PASS를 뜻하지 않는다.
- 기존 원격 리뷰 3건 resolved/outdated, 미해결 0. base `90c5a1a951c749a9690b1c83e5a74b6d122dd6e3`가 HEAD ancestor, API `mergeable=true`; `mergeable_state=blocked`는 실패 checks이며 충돌 아님. 게시 직전 head/base/main과 리뷰를 재확인한다.
- 실제 역할: Manager=최소 JSON 보완/원장/통합, infra `/root/ci_diagnosis`=분리된 읽기 전용 원인 검산, qa_docs `/root/preqa`=동일 manifest SHA256에 대한 별도 읽기 전용 PRE_QA PASS. 두 제목의 실제 literal 유일성·등록 의미·보호 계약·문서 정합을 검토했고 #3579 shard3 CANCELLED를 PASS로 읽힐 수 있던 신규 요약 문구를 정밀화했다. 이전 #3579 절의 shard3 무결성 확인 문구로 전체 shard PASS를 추론하지 않는다. 이 검토는 원격 exact-Head QA_FINAL/Owner 제품 UAT/최종 승인 대체가 아니다. Markdown 링크 424 files 및 `git diff --check` PASS.
- HIGH/OWNER_MANAGED/qa_required=true/release_required=false/release_authorized=false 유지. 단일 push의 synchronize Full CI 시작 확인까지만 수행; 이후 모니터링·병합·Main/GHCR/Release·Issue 종료 없음. 새 Required3/Trusted·Owner UAT·Manager ACCEPT **NOT TESTED**, `MERGE_READY=BLOCKED`.


## 2026-11-08 — PR #900 Main CI #3582.1–2 GHCR 게시 Artifact Attempt 불일치

### 사건 출처·기존 결과 재사용
- [PR #900](https://github.com/planner77/masterGantt/pull/900) 병합 Main SHA `bafe71b2855561a10c797f495c81449d96f0a62d`, first parent `90c5a1a951c749a9690b1c83e5a74b6d122dd6e3`, second parent(PR Head) `9ab296fc3e967df57e411a1a599b905a9d960e39`; 병합 및 PR Head Tree 모두 `af2c2cb13b2e80c4acbc6744fdeef5b71a2b28d1`. Version 0.145.1, release_required=false, release_authorized=false.
- [Main CI #3582 / Run 42487828570](https://github.com/planner77/masterGantt/actions/runs/42487828570), attempt 1 `failure` (2026-11-08 14:02–14:37 UTC), attempt 2 `failure` (재실행 19:08–19:33 UTC). GitHub 공식 규칙에 따라 재실행하지 않은 성공 Job 출력은 이전 Attempt에서 유지된다: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs
- 위 원장의 F-001~F-005 및 [Full PR #3581.1 / 42484246431](https://github.com/planner77/masterGantt/actions/runs/42484246431) SUCCESS, [default-main Trusted QA #1232.1 / 42487210344](https://github.com/planner77/masterGantt/actions/runs/42487210344) SUCCESS는 각각 원본 상태 그대로 보존한다. PR/기능 회귀는 Main 성공을 대체하지 않으며 이번 원인은 새로운 Main 게시 소비자 경계다.

### Main Attempt 1 직접 실패 — MAIN-3582-F001 (재분석 이력)
- `Chromium E2E 5/8` Job `128753531417`에서 `tests/e2e/project-task-delete-context.spec.ts:239` 28px 행 사례가 HTTP PATCH `read ECONNRESET`(spec 276)으로 실패. 92 selected, 91 PASS, 1 FAIL; 다른 7개 Chromium/Quality/Docker PASS. 패킷 원인/제품 defect는 UNKNOWN, 단언/상태 불일치 증거 없음. [Main shard5 원본 로그](https://github.com/planner77/masterGantt/actions/runs/42487828570/job/128753531417), [Playwright artifact 13621466756](https://github.com/planner77/masterGantt/actions/runs/42487828570/artifacts/13621466756).
- E2E Required `128762225886` FAIL (파생); Main OCI 게시 `128762243886` SKIPPED, GHCR candidate NOT PUBLISHED. 기존 성공 원본 Job을 재사용하여 GitHub `rerun-failed-jobs`를 요청했고 Run attempt 2가 생성됨. E2E의 원본 FAIL은 소급 PASS 처리하지 않음.

### Main Attempt 2 직접 실패 — MAIN-3582-F002 (확정 원인)
| 단계/Job | 이번 attempt·실제 결론 | 근거 |
| --- | --- | --- |
| E2E 5/8 128831572832 및 다른 7개 E2E | **SUCCESS 8/8** | 재실행된 shard5 포함 Required 완료 |
| E2E Required aggregate 128837746460 | SUCCESS | `RESULT=success` |
| Quality Required 128831574974, Docker Required 128831574725, Docker Smoke 128831573493 | SUCCESS (이전 성공 Job 보존 포함) | 새 source 재작성/보호 우회 없음 |
| [GHCR Main publisher Job 128837770156](https://github.com/planner77/masterGantt/actions/runs/42487828570/job/128837770156) | **FAIL / 직접 F002** | `actions/download-artifact`에서 `ci-oci-main-42487828570-2` 찾기 실패. 현재 attempt 번호를 Producer 재실행 번호로 잘못 가정 |
| `Main image build/push 시간 기록` step | FAIL (파생) | archive download 실패로 `main-image-start`가 실행되지 않은 상태에서 `if: always()`가 빈 start time으로 실행 |
| GHCR `ci-bafe71...` 게시·exact digest smoke·SBOM·Finalizer | NOT RUN / NOT TESTED | 게시 성공 증거 없으므로 임시·정식 태그 및 Issue CLOSED 금지 |

- 원본 [`ci-oci-main-42487828570-1` Artifact 13620520702](https://github.com/planner77/masterGantt/actions/runs/42487828570/artifacts/13620520702) (118418731 bytes) 및 [`ci-main-build-contract-42487828570-1` Artifact 13620445987](https://github.com/planner77/masterGantt/actions/runs/42487828570/artifacts/13620445987)은 정상 생산됐으며 Attempt 1의 Docker smoke 성공 Job에서 업로드되었다. Attempt 2에는 Docker 생산 Job을 재실행할 필요가 없어 `-2` ZIP이 생성되지 않음. 누락된 Artifact를 조작하거나 이전 Attempt 데이터를 새 Attempt로 재표기해서는 안 된다.
- 원인 `POLICY_CI / FIXTURE_OBSERVABILITY` 경계 버그: `.github/workflows/ci.yml`의 OCI 소비자가 `github.run_attempt`(소비자 최신 Attempt)를 사용하면서 생산자의 실제 Attempt를 잃음. 종전 `needs.docker_smoke.outputs.index_digest/archive_sha256/revision/decision`은 성공한 생산자 Job에서 승계되었는데 Artifact 이름만 현재 Attempt를 사용하여 불일치. 제품 버그·GHCR 서비스 오류 증거 없음.

### 최소 보완·재사용·교차 검증 범위
- 기존 `docker_smoke` Job의 output에 `archive_attempt: github.run_attempt`를 추가하여 **생산자 실제 실행 Attempt**를 전달한다. `publish-commit-image`의 artifact 이름에서 소비자 `github.run_attempt` 대신 `needs.docker_smoke.outputs.archive_attempt`를 참조한다. Producer가 성공하지 못하면 기존 `needs.docker_smoke.result == success`로 차단; 이름이 유효하지 않거나 Artifact가 없으면 download-action은 fail-closed. `verified_oci.py`에서 archive SHA256/index digest/manifest/attestation/labels 검사, 기존 Main Source/PR SHA/Tree/Owner, GHCR exact-digest pull/policy/readiness/SQLite/API/Finalizer 정책은 그대로 적용.
- 기존 성공 Producer outputs를 재사용하되 **증거 승계가 아닌 실제 새 job 실행**을 요구하지 않는다. `tests/python/test_ci_image_reuse.py`의 기존 OCI 및 정책 보안 테스트를 확장하여 (attempt1 producer, attempt2 publisher) source-to-consumer 이름과 이전 잘못된 이름 음성, index/byte 검증·태그 overwrite 거부 불변을 확인한다. `Main image build/push 시간 기록`은 upstream skip에서 빈 값 오류가 나지 않도록 시작 timestamp가 존재할 때만 실행한다(게시 Gate 완화 아님).
- 소스 수정은 새 교정 PR에서만 진행한다. 보호된 CI workflow 변경이므로 `HIGH/OWNER_MANAGED`, 기존 Full PR CI Required Quality/E2E8/Docker + Trusted QA/Owner 명시 수용과 리뷰0·mergeability·DOC_SYNC가 필요하다. 과거 #3582.2의 E2E8/Quality/Docker PASS를 신규 Head 공식 PASS로 옮기지 않음.
- Source 재사용 조건 명시: 기존 `ci_image_reuse.py`/생산자 OCI + `verified_oci.py`/기존 `ci_image_contract.py` 및 Full CI gate **EXTEND**, 별도 게시 파이프라인·무단 OCI 태그 생성 **N/A**. TEST_LIFECYCLE_REVIEW/AC_TEST_COVERAGE/기존 SHA·Run·Attempt 조합 보호 유지.
- 이번 소스 교정 PR의 실제 Unit/Python/YAML 구문/PR Full/Trusted/Owner/신규 Main 및 GHCR+Generic Finalizer는 새로운 각 정확 SHA의 실행 증거가 확인되기 전 **NOT TESTED**. 원본 #3582의 재실행 추가만으로 수정 YAML이 기존 Run에서 실행되지 않음(실행 source 고정). #895·#896·#897의 이슈 종료는 보류.


## 2026-11-09 — PR #901 Full #3587.1 DOCUMENTATION_SYNC 및 P1 한글 작성 보완

### 원본 Run 및 이전 성과 재사용
- [PR #901](https://github.com/planner77/masterGantt/pull/901), Primary #895, 관련 #896/#897, 교정 브랜치 `ci/issue-895-main-3582-oci-producer-attempt`. [PR Full #3587.1 / Run 42516438448 / attempt 1](https://github.com/planner77/masterGantt/actions/runs/42516438448) `completed/failure` (2026-11-08 UTC), source Head `5ca7ef14e482e91a1c10f27e6ab95c69e60aada8`, base `bafe71b2855561a10c797f495c81449d96f0a62d`, 당시 test merge `b634759e78195aa805ae1ec1a45f88b5a9301500`. 이 PR은 변경한 `ci.yml` 등 보호 경로 때문에 HIGH/OWNER_MANAGED, 필수 Full8/Trusted QA와 별도 Owner 수용이 필요하다.
- 기존 **F-001~F-005**(PR #900 전체)와 **MAIN-3582-F001/F002**(최초 E2E transport 불명 및 Main OCI Artifact Attempt 불일치)는 위 불변 기록에 보존한다. [Main #3582.3 / 42487828570 attempt 3](https://github.com/planner77/masterGantt/actions/runs/42487828570)에서 Quality·E2E8·Docker 및 Main OCI 게시·검증은 실제 **SUCCESS**였고, [Generic Finalizer #1474.1 / 42517047238](https://github.com/planner77/masterGantt/actions/runs/42517047238)은 **SUCCESS**로 #895를 종료했다. 기존 SHA `bafe71b2855561a10c797f495c81449d96f0a62d`의 검증된 임시 GHCR 후보는 Finalizer에서 정리됐다. 이 Main 완료를 #901의 신규 Head PASS로 합산하지 않는다. #896/#897은 별도 OPEN이며 실제 Preview UAT는 기존대로 NOT TESTED.
- 현재 목적은 새 제품 변경이나 본 이슈 재오픈이 아니라 **향후 부분 재실행 시도 번호 혼동 방지**. 기존 #836 `docker_smoke` 생산 Job·`publish-commit-image` 소비 Job, `verified_oci.py` 보안 검증과 `test_ci_image_reuse.py`를 재사용한다. 새로운 OCI 업로드·태그·승인 파이프라인은 추가하지 않는다.

### 직접/파생 Job·검증 상태
| 출처 | 결론 | 근거 |
| --- | --- | --- |
| 변경 경로 판정 128840371510, QA 신뢰 경계 128840371326 | PASS | Head/Base/보호 경로 판정 |
| [QA Preflight 128840453870](https://github.com/planner77/masterGantt/actions/runs/42516438448/job/128840453870) | **FAIL — 최초 직접 실패 PR901-F001** | `DOCUMENTATION_SYNC`: `docs/exec-plans/active/ISSUE_895.md`의 `AGENTS.md: UPDATED` 선언과 이번 PR 변경 파일 불일치. 다른 PRIMARY/RISK/QA/RELEASE/PATH/ISSUE_AC/REUSE_REVIEW 판정은 PASS |
| PR Fast Gate 128840529050 | FAIL (파생) | QA Preflight 실패로 구현 검사 시작 차단 |
| TypeScript 128840530106, Vitest 128840530079, ESLint 128840529674, Production Build 128840605850, E2E 8-shard 실행 128840606284, Docker 구현 128840605468 | SKIPPED / NOT RUN | 실제 제품/테스트 Assertion 실패를 새로 관측하지 못함 |
| Quality Required 128840604758, E2E Required 128840604754, Docker Required 128840604782, QA Final Automated 128840629909 | FAIL (파생) | Full8·Docker 실행이 없으며 사전 검증 실패를 별개 제품 실패로 중복 계산하지 않음 |
| 변경 영향 Shadow 128840629796 | PASS (비권위) | Owner·Trusted QA·Required PASS 대체 불가 |
| [Inline P1 리뷰](https://github.com/planner77/masterGantt/pull/901) `PRRT_kwDOUUB7Bc61Dyp_` | **미해결 1건 — PR901-R001** | 신규 `docs/TEST_PLAN_895_897.md`의 Main OCI 설명과 `ci.yml` 설명용 주석을 한글로 작성해야 한다는 지적. 기존 CI 식별자·명령·상태값은 보존 |

### 종합 원인·최소 보완 및 확인 범위
- **PR901-F001 = POLICY_CI / 문서 동기화 범위 착오.** 동일 Work Packet은 원래 PR #900을 위해 `AGENTS.md`, `docs/QA_REVIEW_POLICY.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md` 등을 `UPDATED`로 기록했다. PR #901은 그 파일들을 수정하지 않았으므로 과거 이력이 이번 diff의 문서 영향이라고 잘못 표현됐다. 기존 검증기 `qa_final_automated.py::docs_gate`는 보호된 CI 변경의 QA DOCS 전체에 변경 또는 `N/A(reason)`을 요구하며, 이 중 `AGENTS.md`에서 먼저 차단했다. **원인 해결은 QA 검증기 변경이 아닌 이슈별 Work Packet의 실제 영향 상태 정정**이다.
- `ISSUE_895.md`의 `DOCUMENTATION_SYNC`를 #901 범위로 재정리하여 비변경 정책 문서를 각각 충분한 `N/A(근거)`로 작성하고, 기존 PR #900에서의 실제 문서 갱신은 원본 원장/PR 링크로 보존한다. 현재 변경한 `docs/CI_CD.md`는 `UPDATED`, 기존 큰 `docs/TEST_PLAN.md`은 기존 결정대로 `N/A(근거)`, 신규 Addendum `TEST_PLAN_895_897.md`는 `UPDATED`. 기존 `REUSE_REVIEW`, AC01~06, 발행/Owner 정책, QA 코드/Required Gate는 변경하지 않는다.
- **PR901-R001 = CI 문서 한글 규정 위반.** 이번 PR에서 추가한 Test Plan의 OCI 생산 시도 설명, `ci.yml`의 신규 설명용 주석 및 `test_ci_image_reuse.py`의 테스트 설명을 한글로 갱신한다. `archive_attempt`, GitHub expression, OCI index/digest SHA, job 이름과 상태 코드는 **그대로** 유지한다. 관련 리뷰에는 수정 커밋을 안내하고 실제 해결되면 스레드를 resolved로 전환한다. 원래 프로젝트 파일의 오래된 영어 이력까지 무관하게 수정하지 않는다.
- **재사용/영향:** main의 실제 `#3582.3` 검증과 기존 `#836` 생산·소비자 구조, `test_ci_image_reuse.py` 보호 양·음성, 전체 `#895` 이전 실패 매트릭스는 재사용한다. 수정은 문서·주석·테스트 설명에 한정하며 `docker_smoke.outputs.archive_attempt` 생산과 `needs.docker_smoke.outputs.archive_attempt` 소비, OCI archive SHA256·index/provenance/SBOM·GHCR exact digest·중복 Tag 금지 로직은 불변이다.
- **동일 변경 source 사전 점검:** Work Packet QA DOCS 6종 (`AGENTS.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`)의 변경/비변경 기록을 기존 `docs_gate` 정규식 규약에 맞게 재작성. 신규 Test Plan·workflow·Python 테스트 설명에서 지적된 신규 영문 문구를 교정. 제공 도구 내 원격 Blob read-back/문자열 구조 검증은 사전 정적 확인일 뿐 Python/Node/Chromium 실제 실행 PASS가 아니며, 신규 exact Head의 QA Preflight, 정책 Unit, Full Chromium8/Docker/Trusted QA는 **NOT TESTED**이다.
- **출처·권한:** `main=bafe71b2855561a10c797f495c81449d96f0a62d`, PR #901 Head 고정 후 원장/Work Packet/Test Plan/`ci.yml` 주석·기존 Python 회귀 설명을 단일 Tree·Commit으로 게시할 예정. base/mergeability, 새로운 미해결 스레드, 충돌을 게시 직전에 재조회한다. 새 synchronize Full PR CI는 시작만 확인하고 모니터링하지 않는다. 이 단계에서는 #901 병합, 새 Main, GHCR 정식 태그 발행 및 #896/#897 완료를 하지 않는다.
