# Issue #773 — Release reuse 개인 실패·검증 원장 (2026-10-22)

- Primary: [#773](https://github.com/planner77/masterGantt/issues/773); Issue branch `ci/issue-773-release-evidence-reuse`.
- 목적: 동일 Issue PR CI/Main/Release 관련 **실제** 실패 발생 시 이전 원인·대책을 같은 파일에 누적하여 재발을 분석. 실제 원격 실패 없이 SUCCESS/FAIL/timeout을 생성하지 않는다.
- 현재 상태: 최초 구현, 로컬·원격 exact-head Python/TS/Playwright/CI 실행 **NOT TESTED**; PR CI 최초 실행 예정. 정식 Release flag 활성화/후보 게시/미발행 부채 정리/Finalizer 전부 미실행.
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

## CI 실패 시 동일 Issue 누적 기록 템플릿

- **Failure ID**: F773-001부터 순차.
- **원본**: PR # / Run ID.attempt / Head/Base/Test-merge SHA / failing job+step / Actions URL.
- **직접 원인**: 로그/Trace/artifact로 입증된 실제 실패; 원인이 불명하면 UNKNOWN.
- **파생 실패**: QA Preflight/Policy/Fast Gate/aggregate/Trusted 등의 차단을 근인과 분리; 미실행 E2E를 실패/성공으로 잘못 표기하지 않는다.
- **조치**: 영향 파일과 diff, 재현+수정 재검증, Source SHA, PR review unresolved/conflict check.
- **새 검증**: 새 Full PR CI Run ID.attempt, 종료상태는 독립 확인 전 NOT TESTED.
- **Owner/Release**: HIGH 위험 승인과 별도 Version Release authorization, GHCR/tag/Finalizer/Issue close 상태를 직접 구분.

실패가 실제로 발생하기 전에는 미발생 사실만 기록하고 원인·성공 증거를 임의 생성하지 않는다.
