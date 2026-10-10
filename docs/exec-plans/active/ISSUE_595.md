# Issue #595 — 보호 경로 AGENT QA 승인 검증

## Work Packet / 현재 단계

- Issue: [#595](https://github.com/planner77/masterGantt/issues/595) / #580·#565 후속, #593 Trusted provenance 관련
- 기준 main: `36b0eaa74a0614a76d1ed867bddb548149feb4bc` / app `0.104.0`
- 유형: CI/QA 승인 정책과 신뢰 검증기, HIGH / qa_required=true / qa_method=AGENT
- release_required=false / release_authorized=false. 기능·DB/Schema·GHCR·기존 필수 체크는 변경하지 않는다.
- 기존 원인: #550 PR #559의 정상 제품 SemVer `0.105.0` package/lock 변경에 대해 #580 검증기의 `protected_paths`가 항상 자동 QA를 BLOCKED 처리. 기존 3개 required aggregate는 모두 PASS였다.
- 본 구현 대상: `scripts/qa_final_automated.py` 및 `scripts/test_qa_final_automated.py`, 관련 정책·테스트·운영 문서. protected paths 목록과 자동 QA 위조 방지는 보존한다.
- 단계: ANALYSIS → DESIGN → IMPLEMENTATION → DOCUMENTATION_SYNC → PR CI STARTED (원격 결과 및 독립 QA/Manager 승인 별도).
- 신뢰 경계: PR 작성자가 관리 가능한 문서·코드·댓글만으로 QA PASS를 창작하지 않는다. 기본 브랜치의 검증기에서 GitHub Review의 승인 주체/커밋, repository owner의 별도 승인 증거, 원본 CI의 완료/성공을 read-only 재확인한다. 승인 부재는 BLOCKED.

## 설계와 대안

현행 `AUTOMATED_MANAGER`는 protected 파일이 있으면 그대로 BLOCKED다. `AGENT`의 protected PR은 보호를 해제하지 않고 독립 인간 APPROVED 리뷰(`QA_FINAL: PASS`, 구현자/owner/봇과 분리, 유효 협업자와 정확 Head 커밋), owner가 해당 리뷰 이후 제출한 정확 PR/Issue/Head/base/CI Run·Attempt/잔여 위험 수용 기록, 원본 CI의 Quality/E2E/Docker 모두 완료·SUCCESS를 확인한 경우에 한해 검증 기록을 인식한다. 검증기 변경 PR 자체는 처음에는 기존 main validator 기준으로 BLOCKED되므로 독립 QA/Manager 없이 자동 병합할 수 없다.

댓글/PR metadata만의 자기 인증 금지. 비교 경로는 REST 제출자와 Review의 실제 `author_association`, 최신 최종 상태, `commit_id`, Github 발생 시간, exact Head/base 및 origin run/attempt/QA 증거를 함께 사용한다. GitHub API 접근 실패, 주체 불명확, 이전 head 재사용, 다른 Run/attempt, 검토자 분리 실패, 신뢰된 원본 체크 불일치는 fail-closed다. #593의 provenance 경로는 후속 통합 시 재조정한다.

## Local Fast Feedback 및 원격 테스트

로컬/Unit: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/test_qa_final_automated.py`; 필수 안전 사례는 정상 외부인 승인/Owner 수용, 동일 주체·봇·stale·COMMENTED·검토 누락·승인 누락·잘못된 PR/base/CI·미완료 필수 Job·원장 불명확 및 AUTOMATED_MANAGER 보호 접근 차단. 기존 CI policy Job이 동일 Python 테스트를 자동 실행한다. 실제 로컬 실행 결과는 별도 실행 전 NOT TESTED. 원격 `quality/e2e/docker` 각 aggregate는 PR의 exact HEAD로 새로 검증한다.

원격 진정한 protected 승인 수용 시나리오는 해당 신뢰 검증기가 독립 QA/Manager 리뷰를 거쳐 main에 반영되고, 동작이 정상이라는 별도 보호 변경 검증용 PR의 실제 인간 APPROVED와 Owner comment, 성공한 required Full CI Run/Attempt를 확인한 이후에만 PASS라고 보고한다. 현행 #595 PR 자체는 기존 base 검증기에서 protected를 BLOCKED하는 것이 정상이다.

## 문서·증거 확인

- QA_FINAL: NOT TESTED. 독립 `qa_docs` 또는 지정된 인간 Reviewer의 실제 검토와 HEAD 증거 필요.
- Manager ACCEPT: NOT TESTED. 동일 작성자의 순차 자체 검토는 독립 검토가 아니다.
- #550의 기존 제품 HEAD, 버전·CI/QA 원장·QA BLOCKED 결과는 변경하지 않는다.
- #595 보호 변경의 정확한 HEAD와 QA/CI 실패 원인, 위험 수용·출처 및 잔여 위험을 PR에 별도 남긴다.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/DECISIONS.md`: UPDATED
- `docs/AGENT_PROMPTS.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_595.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(제품 UI·접근성/시각 디자인을 변경하지 않고 QA 승인/증거 체계만 수정한다)
- `docs/API.md`: N/A(외부 사용자 API와 DTO·네트워크 계약 변경이 없다)
- `docs/DB_SCHEMA.md`: N/A(SQLite 저장소·Migration·데이터 형식 변경이 없다)
- `docs/SECURITY.md`: N/A(자격증명·세션과 서버 Authorization 계약을 변경하지 않고 기존 QA의 보호 입력을 유지한다)

## AC_TEST_COVERAGE

- AC1: `scripts/test_qa_final_automated.py` — 승인 증거 부재 BLOCKED, 정확 Head 독립 인간 Review+Owner 수용만 허용하는 시나리오
- AC2: `scripts/test_qa_final_automated.py` — `AUTOMATED_MANAGER` protected 차단, stale Head/base 및 잘못된 Run/Review/comment 부정
- AC3: `scripts/test_qa_final_automated.py` — 기존 LOW/MEDIUM/HIGH, 보호 경로 및 정상 non-protected QA 회귀 보존
- AC4: `scripts/qa_final_automated.py`의 원격 GitHub REST review/comment/job receipt와 `test_protected_agent_requires_independent_review_and_owner_accept` 테스트
- AC5: `docs/QA_REVIEW_POLICY.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/REMOTE_VALIDATION.md`, `docs/GITHUB_OPERATIONS.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md` 등 DOCUMENTATION_SYNC 및 원격 문서 링크
- AC6: `.github/workflows/ci.yml` 수정 없음, 기존 Quality/E2E/Docker Required Check 유지 확인 및 정확한 HEAD 원격 PR CI(시작 전 NOT TESTED)
- AC7: `scripts/qa_final_automated.py`의 보호 성공 상태와 `independent_qa`, `manager_decision` 분리, README/PR에서 기존 차단과 성공/승인을 구분

## Release 및 Merge Guard

현재 구현 후보는 `release_required=false`이며 사용자의 정식 GHCR 승인 없이 release tag/image 게시를 진행하지 않는다. 본 PR은 자체 CI PASS 여부와 무관하게 **정책 보호 파일 변경의 독립 QA 및 owner Manager ACCEPT 전 병합 금지**. 신규 Trusted Workflow 실기능 테스트·운영배포는 NOT TESTED로 기록한다.

## PR CI #2391.1 및 독립 Code Review P1 대응 (2026-10-10)

- PR [#597](https://github.com/planner77/masterGantt/pull/597), 최초 Head `1246cf3cd6cec6012158ccacc13cd91eb7428973`, [CI #2391.1](https://github.com/planner77/masterGantt/actions/runs/38042395640). Build/Unit/TypeScript/Lint/Policy Python 및 Docker/required Quality/E2E aggregate 모두 PASS. 제품 E2E shard는 경로 판정에 따라 SKIPPED로, 실실행 PASS로 계산하지 않는다. `QA Final — Automated`는 기존 base `36b0eaa74a0614a76d1ed867bddb548149feb4bc`의 보호 검증기가 QA script/정책·실행 가이드 수정을 발견하여 BLOCKED. 이는 본 보안 정책 PR에서 의도된 동작이며 독립 QA는 NOT TESTED.
- [P1 리뷰](https://github.com/planner77/masterGantt/pull/597): `trusted_source()`가 run의 기본 `/actions/runs/{id}/jobs`를 최신 attempt 전용으로 조회한다. attempt1에서 성공한 Quality/E2E/Docker aggregate를 보존하고 실패 QA Job만 attempt2에서 재실행하면 최신 Job 목록엔 aggregate가 없어 Trusted가 `evidence()`에서 거부되어 #595 복구 절차가 진행되지 않는다.
- 보완: `effective_run_jobs(gh, run_id, run_attempt)`는 동일 run의 `/attempts/{i}/jobs`를 1..최신 순서대로 제한(1~10회)·페이지 확인하여 이름별 **마지막으로 실제 실행된 attempt**의 결론과 source_attempt를 선택한다. 최신 QA-only attempt의 누락 aggregate는 이전 성공을 보존하고, 이후 attempt에서 실제 재실행된 실패·취소 aggregate는 이전 성공을 덮어써 반드시 BLOCKED/FAIL된다. attempt 누락·중복 이름·불명확한 Job은 fail-closed.
- `trusted_source()`의 `evidence()`는 위 effective 원장을 사용하며 `required_job_source_attempts`를 감사 원장에 추가한다. receipt가 지목한 원본 Full CI aggregate 검증 자체는 기존 `/attempts/{ci_attempt}/jobs`의 동일 대상 확인을 유지하고, 더 최신 attempt에서 실패한 Job은 효과 원장에서 거부한다. `workflow_run.pull_requests=[]` 귀속 복구는 선행 [#593](https://github.com/planner77/masterGantt/issues/593) 범위로 남기며 제목 기반 추정 금지.
- 단위 회귀: 기존 신뢰 source test + 신규 attempt1 aggregate success/attempt2 QA-only success 및 각 required source_attempt=1, attempt2 E2E 실패 override, 중복 Job, missing prior attempt, 0·11 attempt fail-closed. `scripts/test_qa_final_automated.py`의 기존 보호 리뷰·Owner 승인 부정 시나리오도 유지.
- `AGENTS.md` 정책·`DESIGN.md` 제품 UI/권한·API·DB·Scheduler·workflow YAML·버전은 이번 P1에 변경 없음(N/A). 영향 문서만 동기화한다. 새 Head의 Quality/E2E/Docker/정책 Python 및 독립 QA/실제 Trusted positive는 실행 증거 확보 전 NOT TESTED. 승인 없는 merge/main/GHCR/tag/Issue close 금지.

## PR CI #2396.1 이후 보완 — 메타데이터 Full-CI 증거의 exact Attempt 복원 (2026-10-10)

- 원본 PR [#597](https://github.com/planner77/masterGantt/pull/597) Head `1035d7159a61edf170d88e97d103adb9bc68a4db`, [CI #2396.1](https://github.com/planner77/masterGantt/actions/runs/38043610160): policy Python, TypeScript/Lint/Unit/Build, Quality/E2E/Docker required aggregate PASS. `Chromium E2E shard`는 경로 판정에 의해 SKIPPED이므로 E2E 테스트 실실행 PASS가 아니다. 자동 `QA Final — Automated`만 이전 신뢰 base validator의 protected 검증기·정책 변경 차단으로 BLOCKED. 독립 QA/Manager ACCEPT는 NOT TESTED.
- 추가 영향 분석: `trusted_source()`는 이미 PR #597의 P1에서 `effective_run_jobs()`로 기존 required Job을 attempt별 결합한다. 그러나 `verify_same_base_full_run()`은 메타데이터 전용 PR edited 시 같은 Full CI Run을 조회하면서 여전히 **최신 attempt만 반환하는 기본 `/runs/{id}/jobs`**를 사용하고 있었다. Full CI attempt1에서 세 aggregate PASS, attempt2 QA-only PASS인 경우 동일 PR/Head/base의 적법한 성공 원장을 증명할 수 없어 이후 metadata-only 검증이 실패할 수 있다.
- 보완: `verify_same_base_full_run()`도 위 공용 `effective_run_jobs()`를 사용하여 Full CI Run ID의 모든 정확 Attempt(1~최신, 최대10)의 최종 실행 Job 결과를 검증한다. `run_attempt`가 API 응답에서 누락되면 재사용하지 않는다. 출처가 다른 Run/Head/base의 Job은 결합하지 않는다. 이후 재실행된 aggregate의 실패·취소를 이전 성공으로 덮어쓰지 않는다.
- 회귀: `test_metadata_full_ci_requires_matching_base`는 정확 `/attempts/1/jobs`와 `run_attempt` 누락 차단을 추가한다. `test_metadata_reuses_exact_full_run_after_qa_only_retry`는 동일 Full CI attempt1 required PASS→attempt2 QA-only PASS를 재사용 가능하게 검증하며, attempt2 E2E FAIL 및 attempt1 자료 누락을 거부한다. 기존 `test_trusted_qa_only_retry_resolves_exact_prior_aggregate_jobs`와 AGENT 보호 승인·메타데이터 출처 검증은 유지한다.
- 이번 수정은 Job 증거 조회와 테스트·문서에 한정되며 `.github/workflows/ci.yml`, GitHub Ruleset, Reviewer 인증, protected 경로 목록, 버전, Release·GHCR 불변이다. #593의 `workflow_run.pull_requests=[]` 신뢰 귀속 보완은 중복 구현하지 않는다. 정확한 새 Head의 quality/e2e/docker·독립 QA 결과는 새 실행 전 NOT TESTED.
