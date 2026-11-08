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
