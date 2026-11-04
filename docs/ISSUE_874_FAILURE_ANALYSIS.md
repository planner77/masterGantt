# Issue #874 — 단일 실패 원장 (Release Runner 환경 드리프트)

## F874-001 — confirmed GHCR Release #216.1 / 2026-11-04

| Field | Immutable evidence |
| --- | --- |
| Linked issue/PR | Issue #865, PR #871; follow-up #874 |
| Main SHA | 78a48b29f3a6e5ec1a0a9817ffa1976dc4de74aa |
| SemVer tag | annotated v0.141.0; preserve |
| PR actual Docker Job | 126371984402; hosted runner ImageVersion 20261101.186.1 |
| Main Full | #3489.1 / Run 41776085393 SUCCESS; Docker Job 126396726096 ImageVersion 20261101.186.1 |
| Main OCI index | sha256:a6a2b658f440280eca66a218b83ec5eb8b86c80d657d8082a7cabb794dcce842 |
| Finalizer | #1346.1 / Run 41779125648 SUCCESS = dispatch initiation, not completed release |
| Release | #216.1 / Run 41779185247; candidate Job 126417402392; hosted runner ImageVersion 20261025.179.1 |
| Direct failure | step Main verified candidate exact digest 확인: PR_ORIGIN_RELEASE_SOURCE_UNAVAILABLE:PR_MAIN_BUILDER_OR_INPUT_DRIFT |
| Successfully executed | GHCR login + exact digest pull, Release static, Release Chromium8 |
| NOT RUN | Release candidate runtime smoke, promotion, GHCR SemVer and Finalizer completion |

### Causal classification

POLICY_CI / RUNNER_ENVIRONMENT_CROSS_RUN. Existing scripts/verify_ci_image_release.py calls verify_source() which invokes ci_image_contract.verify() and fingerprint(root). The latter compares **current Release runner ImageVersion** to historical PR receipt as if Release runner rebuilt the image. PR and Main source/builders were matching; the newly provisioned Release host is not authoritative build provenance. No independent evidence of a different OCI digest or tampered receipt was supplied. Do not reclassify PR/Main as green from Release failure or claim that cause alone establishes registry integrity.

### Corrective action and control

- Source+build phase: PR origin and Main builder attestation/job/archive/OCI+Git tree match still required. Continue to block PR/Main mismatch or tampering; Main-only safe rebuild fallback remains.
- Promotion phase: separately authenticate original successful Main Run/Attempt and Main builder witness artifact, compare PR receipt and Main receipt (including exact OCI archive hash/index/source/Run/Attempt) and re-hash source files/tree. Release host ImageVersion is verifier environment only.
- Added regression positive 20261101.186.1 vs 20261025.179.1; negatives for builder/source/digest/run/receipt/publisher mismatch. Existing unique-security tests preserved.
- Existing Release #216.1 and v0.141.0 are **immutable failures**: no retroactive rewriting, tag moves or blind rerun. New verifier does not run on old tag source.
- risk_level HIGH; qa_method OWNER_MANAGED; qa_required true; release_required false; release_authorized false. Owner HIGH risk acceptance and merge permission NOT GIVEN.
- This task ends at new PR Full CI trigger; remote result NOT TESTED; no CI monitoring/merge/Release/Issue closure.

## F874-002 — Implementation review / non-execution classification

- Prior occurrence #849 / Release #207 had a different job-name duplicate recognition bug: same display-name Docker implementation SUCCESS + PR-only SKIPPED. This existing correction is retained; #874 is *not* a reason to accept duplicate success/failure or skipped Main work.
- Branch changes emit an exact Main receipt artifact. Older Main runs lack it and must BLOCK (not silently self-approve). A retry of the old v0.141.0 tag still uses the previous source and cannot gain the new behavior.
- Python unit/integration and remote PR Full results remain NOT TESTED until observed. A new PR can trigger Full CI without claiming PASS. Individual validation results should be appended only after direct evidence from their Run/Attempt.

## REFERENCES

- https://github.com/planner77/masterGantt/issues/874
- https://github.com/planner77/masterGantt/actions/runs/41779185247
- https://github.com/planner77/masterGantt/actions/runs/41776085393
- https://github.com/planner77/masterGantt/actions/runs/41779125648
- docs/exec-plans/active/ISSUE_874.md and original docs/ISSUE_836_FAILURE_ANALYSIS.md.

## F874-003 — PR #875 최초 Full PR CI #3490.1: PR 출처·QA 메타데이터 직접 차단 (2026-11-04)

- **원본:** [PR #875](https://github.com/planner77/masterGantt/pull/875), 실패 Head `2aac0397dac3cb0ab1f9222f7f62ebc5d5c58cca`, base `78a48b29f3a6e5ec1a0a9817ffa1976dc4de74aa`; [Full #3490.1 / Run 41802463033](https://github.com/planner77/masterGantt/actions/runs/41802463033) FAILURE.
- **직접 실패 A:** `변경 경로 판정` Job `126481300326`, Step `CI 실행 추적 메타데이터 검증`(8). `scripts/verify-ci-run-trace.py`의 REF_RE는 PR 본문에 정확히 독립 한 행 `Refs #874`를 요구하나, 최초 PR 본문의 `Refs #874. Release ...`는 매칭 안 됨. 원본 오류: `PR 본문에는 canonical 'Refs #<Primary Issue>'가 정확히 1개 필요합니다: []`.
- **직접 실패 B:** `QA Final 신뢰 경계 확인` Job `126481300894`, Step `보호 변경·AGENT 경로 판정`(4). 신뢰된 `scripts/qa_final_automated.py::pr_field`는 독립 `qa_method: OWNER_MANAGED` 선언을 요구하는데 최초 PR 본문은 bullet 한 행에 다수 필드를 병기해 인식 실패. 실제 로그: `QA 경로 BLOCKED: PR 본문 qa_method의 명시값 필요`.
- **파생:** `PR 빠른 검사 판정` Job `126481447890`은 CHANGES_RESULT=failure/PREFLIGHT_RESULT=skipped로 FAIL. Quality aggregate `126481553907`, Chromium E2E aggregate `126481553915`, Docker aggregate `126481553752`는 선행 차단의 파생 FAIL. 실제 TypeScript/Python/Playwright8/Docker 구현 검증은 SKIPPED/NOT RUN으로 코드나 이미지 원본의 직접 실패 증거 없음.
- **Codex P1 리뷰:** thread `PRRT_kwDOUUB7Bc6zhIlt`, comment `4465524798`, workflow 1385행. AGENTS.md CI/CD 한글 작성 원칙 위반: 새 Main builder receipt upload step 표시 이름과 Release의 신규 Main builder receipt 요약이 영문. artifact 이름/Run·Attempt/Required Job 연동 이름 보존하며 표시 설명만 한글로 수정.
- **시정 조치:** PR 본문을 정확한 `Refs #874` 독립 행과 `risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `qa_required: true`, `release_required: false`, `release_authorized: false` 독립 행으로 정규화; PR 제목 설명 한글화. 새 workflow step `Main 검증 빌드 계약 증거 보존 (Release Runner 환경 독립)`으로 변경. Release Job Summary에 한글 설명 적용, `tests/python/test_ci_image_contract.py`에 표시명 회귀 추가. Policy/QA parser와 CI Required3/Chromium8/timeout/skip/Owner 승인 경계는 불변.
- **TEST_LIFECYCLE_REVIEW:** 기존 `scripts/verify-ci-run-trace.py`와 `scripts/qa_final_automated.py`를 찾아 파싱 계약 확인. 정책 코드는 변경하지 않으며 기존 회귀 KEEP_UNIQUE, 표시명 테스트 EXTEND.
- **후속 검증:** 변경된 정확 PR Head synchronize로 새 Full PR CI 시작; #3490.1 FAIL 기록 불변. 새 Run/Attempt 결과는 요청에 따라 모니터링하지 않음(NOT TESTED). 기존 v0.141.0/Release #216 불변. Owner 병합/정식 게시 승인 없음.

## F874-004 — PR #875 두 번째 Full #3495.1 문서 계약 검증 직접 실패 (2026-11-04)

- **정확 원본:** PR #875 / Head `307f4e60971e937beef442a44a4796fb2393aa32`, Base `78a48b29f3a6e5ec1a0a9817ffa1976dc4de74aa`, synthetic test-merge `825285840f04e6a5b94b31a6e12753505d8d9a31`, [Full #3495.1 / Run 41808667267](https://github.com/planner77/masterGantt/actions/runs/41808667267), Attempt 1 FAILURE.
- **직접 실패 Job:** `QA Preflight — 정책·문서 사전 검사` Job `126502553202`, Step `원본 base SHA의 QA Preflight 실행 (read-only)`(4), `FAIL / DOCUMENTATION_SYNC: docs/exec-plans/active/ISSUE_874.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — DOC_SYNC 기록 누락`. 검사는 FAIL 1 / DEFERRED 5, Primary Issue/위험도/QA 방식/QA 필수/Release 플래그/변경 경로/Issue AC는 PASS.
- **검증기 근거:** 기본 브랜치의 `scripts/qa_final_automated.py::docs_gate`는 Work Packet `## DOCUMENTATION_SYNC` 내 문서별 한 줄 `- \`path\`: UPDATED` 또는 `- \`path\`: N/A(reason)`만 인식하고 `## AC_TEST_COVERAGE`에서 `- AC1:` ~ `- AC6:`의 독립 상세 근거를 요구한다. 이전 Work Packet은 경로를 `UPDATED: A; B; ...`로 한 줄 묶고 `## TEST_LIFECYCLE_REVIEW / AC_TEST_COVERAGE`라는 결합 섹션을 사용했으므로 parser와 불일치. 이는 **POLICY_DOC / WORK_PACKET_SCHEMA**이며 소스 기능 실패가 아니다.
- **파생 실패:** `PR 빠른 검사 판정` Job `126502713393`(PREFLIGHT_RESULT=failure), Required Quality `126502851443`, E2E `126502804177`, Docker `126502804783` 집계 FAIL; Trusted 자동 QA `126502878438`도 `required quality 미성공`으로 FAIL. 실제 TypeScript/Vitest/8개 Chromium E2E/Docker 구현 Job은 SKIPPED/NOT RUN. 실패를 제품 테스트·원본 이미지 무결성 오류로 계수하지 않는다.
- **수정:** `docs/exec-plans/active/ISSUE_874.md`의 `## AC_TEST_COVERAGE`를 별도 절로 분리해 AC1~AC6마다 구체 테스트·인수 경계 기록. `## DOCUMENTATION_SYNC`는 실제 변경된 정책/CI/테스트/Work Packet/원장을 개별 `UPDATED`, 그 외 필수 문서는 구체적 `N/A(reason)` 행으로 정리. 기존 신뢰된 QA parser, 보호 Workflow, Required3, 8-Shard, timeout/skip/retry, 원본 Git/OCI/Receipt·GHCR Release 게이트 **변경 없음**.
- **검증·실행 제한:** Parser 정규식에 맞춘 19개 문서 및 소스 경로의 형식과 AC1~AC6 독립 행을 구조 검산. 원격 새 Head의 Full/Trusted QA는 시작 전 NOT TESTED. 기존 #3490.1, #3495.1 및 Release #216.1 실패, `v0.141.0` annotated tag 모두 보존. Owner 병합/게시 승인 미부여.
- **리뷰·충돌:** PR #875 기존 P1 thread PRRT_kwDOUUB7Bc6zhIlt 해결 완료, 새 미해결 thread 0(2026-11-04 확인). Main 비교 당시 behind 0/mergeable true. 최신 Head를 생성한 후 PR 상태를 다시 확인.
