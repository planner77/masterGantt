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
