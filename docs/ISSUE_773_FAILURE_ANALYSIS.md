# Issue #773 — Release reuse 개인 실패·검증 원장 (2026-10-22)

- Primary: [#773](https://github.com/planner77/masterGantt/issues/773); Issue branch `ci/issue-773-release-evidence-reuse`.
- 목적: 동일 Issue PR CI/Main/Release 관련 **실제** 실패 발생 시 이전 원인·대책을 같은 파일에 누적하여 재발을 분석. 실제 원격 실패 없이 SUCCESS/FAIL/timeout을 생성하지 않는다.
- 현재 상태: PR #777 초기 Full Run #3131.1 및 동일 사유 재발 #3134.1에서 **QA Preflight DOCUMENTATION_SYNC 실패 확인**; 이번 교정 전 Head의 Policy/E2E8/Docker는 사전 차단으로 **미실행**. 교정 이후 정확 Head Full·Trusted는 새 Run 이전 **NOT TESTED**. 정식 Release flag 활성화/후보 게시/미발행 부채 정리/Finalizer 전부 미실행.
- 역사적 성능 비교: Release #186.1의 약 35분(구 E2E6) vs 현재 공식 8-way는 실행 정책이 달라 직접 같은 모집단이 아니다. 승인된 Main8/8과 Release8/8 성공 Run 최소3개 수집 전 성능 성과는 **INSUFFICIENT_DATA**.

## 등록된 구현 중 설계 위험 (실제 장애 기록 아님)

| ID | 위험·재현 전제 | 현재 방어 및 잔여 점검 |
| --- | --- | --- |
| R773-001 | 동일 aggregate green이어도 개별 E2E shard skipped/FAIL/CANCELLED | 정확 Workflow path/id, Main event=push, Run+Attempt, policy/typecheck/lint/unit/build/Docker/Main image 및 8개 실제 shard 단계가 모두 SUCCESS여야 인정. timing skip=0·case_count/test list 요구; 실제 원격 대응 NOT TESTED |
| R773-002 | 만료/중복/위조 Artifact와 run/attempt 오귀속 | exact named artifact unique, ZIP 단일 expected file, workflow_run/id/head+payload source, count/profiles 일치 확인. 누락·오염은 FULL; 실제 workflow logs 확인 전 NOT TESTED |
| R773-003 | tags, immutable main first-parent, PR/Issue·Owner marker/version 일치 실패 | annotated peeled Git ref+package+lock, first-parent, 2-parent merge 및 version-scoped Owner marker 독립 재조회. 변경/권한 불명 시 FULL/BLOCKED |
| R773-004 | Main/Release E2E 환경·fixture·reporter/Chromium/OS·Node/npm·testplan drift | fingerprint/runner image profile 비교, 명확하지 않으면 REUSE_INELIGIBLE. hash 비교·기본 workers1/8-shard 계약 유지. 최신 Run 실제 측정 후 확대 결정 |
| R773-005 | GHCR ci-SHA digest가 Main manifest와 drift 또는 Label/SBOM·provenance 누락 | 기존 container job에서 registry digest/OCI label/source/version, transport/API/SQLite/migration, verified publish/attestation은 생략 불가. mismatch는 BLOCKED; 삭제/override 금지 |
| R773-006 | SHADOW 결과가 신규 Release PASS/Owner 승인으로 자동 승격 | `RELEASE_REUSE_ENABLED` 기본 OFF·명시 age policy·exact Owner marker 필수, summary `REUSED_VERIFIED` 별도 의미. Stage2 별도 사용자 승인 전 금지 |
| R773-007 | GitHub Actions/Playwright JSON reporter 패키지 출력·차이로 정상 receipt 생성 불가 | `npm run --silent test:e2e -- --list --reporter=json`로 npm prefix 제거; 로컬/remote list contract 점검 예정. Invalid receipt=FULL, Main 성공 오염하지 않음 |

## 실제 PR CI 실패 기록 — 누적 (2026-10-22)

### F773-001 — 첫 PR Full #3131.1

- **원본**: [PR #777 / Actions Run 39744960939.1](https://github.com/planner77/masterGantt/actions/runs/39744960939), Head `8871252ce3c16138ff8eebcf4da8850aad01860c`, Base `b6c7ba8c9b2a28015c8cd29664a4d8b221229181`; 당초 test-merge SHA는 원본 로그에서 별도 확정하지 않음.
- **직접 실패**: `QA Preflight — 정책·문서 사전 검사`의 `원본 base SHA의 QA Preflight 실행 (read-only)` 단계: `FAIL / DOCUMENTATION_SYNC`, `Issue AC / test evidence mapping 부족: AC1,AC2,AC3,AC4,AC5,AC6,AC7`.
- **직접 원인**: Work Packet `## AC_TEST_COVERAGE`의 항목이 `- **ACn (Dn)**:` (강조·별칭 혼합)으로 작성됨. Base `scripts/qa_final_automated.py`의 구조 검증기 `docs_gate`가 요구하는 `^\\s*-\\s*(AC\\d+)\\s*:` 형태로 인식되지 않음. 실제 테스트 누락을 입증한 실패가 아니라 **증거 매핑 표기 계약 위반**.
- **파생**: PR Fast Gate FAIL, 3 Required aggregate Quality/E2E/Docker FAIL, QA Final — Automated FAIL. Typecheck/ESLint/Unit/Build/Chromium8/Docker implementation은 Skipped, 따라서 기능 테스트 실패라고 해석하지 않음.
- **조치**: 다음 교정에서 동일한 수용 기준의 증거를 `- ACn: Dn — ...`으로 변경, 이슈나 검증기 요구 조건은 완화하지 않음.

### F773-002 — 동일 원인 재발 #3134.1

- **원본**: [PR #777 / Actions Run 39745206861.1](https://github.com/planner77/masterGantt/actions/runs/39745206861), Head `753ff55fa6669a147b8d674a3c11e8852b52d36f`, Base `b6c7ba8c9b2a28015c8cd29664a4d8b221229181`, PR test-merge `340bfb73d31f657a80beb2b3a195bf8945c0b279` (Fast Gate checkout 기록).
- **직접 실패**: Preflight `DOCUMENTATION_SYNC`: AC1~AC7 매핑 모두 미인식. PRIMARY_ISSUE, RISK_LEVEL, QA_METHOD/REQUIRED, ISSUE_AC, PATH_POLICY 등 나머지 사전 항목 PASS. 위의 F773-001과 같은 문서 형식 결함이 코드 보완 두 건 동안 교정되지 않아 재발.
- **파생**: Fast Gate FAIL/정적 및 E2E8·Docker 실제 Job 모두 미실행/세 Required aggregate FAIL/Automated QA FAIL. 원본 성공으로 재기록하지 않음. 중간 Full #3132.1 / #3133.1은 cancelled (새 Head 수정 순차 진행), 원인 검증 결과로 사용하지 않음.
- **수정**: `docs/exec-plans/active/ISSUE_773.md`의 AC1~AC7을 모두 `- ACn: Dn — ...` 표기로 정규화. 테스트 ID/근거·미검증·`INSUFFICIENT_DATA`를 그대로 유지. `scripts/qa_final_automated.py`, QA/Required3, Main Full8, GHCR/Owner/Release gate는 불변.
- **사전 구조 검증**: 원래 base 검증기 정규식 `(?im)^\\s*-\\s*(AC\\d+)\\s*:\\s*\\S.{8,}# Issue #773 — Release reuse 개인 실패·검증 원장 (2026-10-22)

- Primary: [#773](https://github.com/planner77/masterGantt/issues/773); Issue branch `ci/issue-773-release-evidence-reuse`.
- 목적: 동일 Issue PR CI/Main/Release 관련 **실제** 실패 발생 시 이전 원인·대책을 같은 파일에 누적하여 재발을 분석. 실제 원격 실패 없이 SUCCESS/FAIL/timeout을 생성하지 않는다.
- 현재 상태: PR #777 초기 Full Run #3131.1 및 동일 사유 재발 #3134.1에서 **QA Preflight DOCUMENTATION_SYNC 실패 확인**; 이번 교정 전 Head의 Policy/E2E8/Docker는 사전 차단으로 **미실행**. 교정 이후 정확 Head Full·Trusted는 새 Run 이전 **NOT TESTED**. 정식 Release flag 활성화/후보 게시/미발행 부채 정리/Finalizer 전부 미실행.
- 역사적 성능 비교: Release #186.1의 약 35분(구 E2E6) vs 현재 공식 8-way는 실행 정책이 달라 직접 같은 모집단이 아니다. 승인된 Main8/8과 Release8/8 성공 Run 최소3개 수집 전 성능 성과는 **INSUFFICIENT_DATA**.

## 등록된 구현 중 설계 위험 (실제 장애 기록 아님)

| ID | 위험·재현 전제 | 현재 방어 및 잔여 점검 |
| --- | --- | --- |
| R773-001 | 동일 aggregate green이어도 개별 E2E shard skipped/FAIL/CANCELLED | 정확 Workflow path/id, Main event=push, Run+Attempt, policy/typecheck/lint/unit/build/Docker/Main image 및 8개 실제 shard 단계가 모두 SUCCESS여야 인정. timing skip=0·case_count/test list 요구; 실제 원격 대응 NOT TESTED |
| R773-002 | 만료/중복/위조 Artifact와 run/attempt 오귀속 | exact named artifact unique, ZIP 단일 expected file, workflow_run/id/head+payload source, count/profiles 일치 확인. 누락·오염은 FULL; 실제 workflow logs 확인 전 NOT TESTED |
| R773-003 | tags, immutable main first-parent, PR/Issue·Owner marker/version 일치 실패 | annotated peeled Git ref+package+lock, first-parent, 2-parent merge 및 version-scoped Owner marker 독립 재조회. 변경/권한 불명 시 FULL/BLOCKED |
| R773-004 | Main/Release E2E 환경·fixture·reporter/Chromium/OS·Node/npm·testplan drift | fingerprint/runner image profile 비교, 명확하지 않으면 REUSE_INELIGIBLE. hash 비교·기본 workers1/8-shard 계약 유지. 최신 Run 실제 측정 후 확대 결정 |
| R773-005 | GHCR ci-SHA digest가 Main manifest와 drift 또는 Label/SBOM·provenance 누락 | 기존 container job에서 registry digest/OCI label/source/version, transport/API/SQLite/migration, verified publish/attestation은 생략 불가. mismatch는 BLOCKED; 삭제/override 금지 |
| R773-006 | SHADOW 결과가 신규 Release PASS/Owner 승인으로 자동 승격 | `RELEASE_REUSE_ENABLED` 기본 OFF·명시 age policy·exact Owner marker 필수, summary `REUSED_VERIFIED` 별도 의미. Stage2 별도 사용자 승인 전 금지 |
| R773-007 | GitHub Actions/Playwright JSON reporter 패키지 출력·차이로 정상 receipt 생성 불가 | `npm run --silent test:e2e -- --list --reporter=json`로 npm prefix 제거; 로컬/remote list contract 점검 예정. Invalid receipt=FULL, Main 성공 오염하지 않음 |

으로 AC1~AC7 **7/7 매핑 대상 존재 확인**. 이는 문서 파싱 구조 확인이지 CI PASS가 아님.
- **미해결 리뷰 스레드/충돌**: 교정 전 조회 기준 [PR #777](https://github.com/planner77/masterGantt/pull/777) GraphQL inline review threads **0**, 리뷰 제출 **0**; GitHub `mergeable=true`, `main...head` `behind_by=0`, 충돌 없음. 새 Head에서 최종 확인 필요.
- **다음 검증**: 단일 새 커밋 Push → PR synchronize 이벤트의 신규 non-draft `FINAL_FULL` Run 생성. 원본 Run/Attempt/Head는 생성 후 조회하며, 성공/실패 및 Owner 최종 승인은 `NOT TESTED`. 요청에 따라 CI 완료까지 모니터링·병합·Main/GHCR/Issue 종료 없음.

## CI 실패 시 동일 Issue 누적 기록 템플릿

- **Failure ID**: F773-001부터 순차.
- **원본**: PR # / Run ID.attempt / Head/Base/Test-merge SHA / failing job+step / Actions URL.
- **직접 원인**: 로그/Trace/artifact로 입증된 실제 실패; 원인이 불명하면 UNKNOWN.
- **파생 실패**: QA Preflight/Policy/Fast Gate/aggregate/Trusted 등의 차단을 근인과 분리; 미실행 E2E를 실패/성공으로 잘못 표기하지 않는다.
- **조치**: 영향 파일과 diff, 재현+수정 재검증, Source SHA, PR review unresolved/conflict check.
- **새 검증**: 새 Full PR CI Run ID.attempt, 종료상태는 독립 확인 전 NOT TESTED.
- **Owner/Release**: HIGH 위험 승인과 별도 Version Release authorization, GHCR/tag/Finalizer/Issue close 상태를 직접 구분.

실패가 실제로 발생하기 전에는 미발생 사실만 기록하고 원인·성공 증거를 임의 생성하지 않는다.
