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
