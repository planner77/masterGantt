# Issue #771 — PR CI 누적 실패 원장

Primary Issue [#771](https://github.com/planner77/masterGantt/issues/771) · 구현 [PR #776](https://github.com/planner77/masterGantt/pull/776) · 2026-10-22 KST
Source of truth: [PR CI 실패 누적 지침](PR_CI_FAILURE_TRIAGE.md). Risk HIGH / OWNER_MANAGED / qa_required=true / release_required=false.

## 1. 원본 PR CI Run·Attempt 목록 (변경 불가 역사)

| Run / Attempt | Event / Source | 직접 실패 | 파생 결과 |
| --- | --- | --- | --- |
| [39730387486.1 · #3124.1](https://github.com/planner77/masterGantt/actions/runs/39730387486), 2026-10-22 14:51 KST | `pull_request.opened`, `FINAL_FULL`, Head `88ac413d2c3f389b8ea4018efed386375ccfcd53`, Base `f550a657c2fd04d49b7dee08783fab3b348e1497`, Test-Merge `c00cf1307439f5cccc338c036f406d4fa4198ac7` | Policy Job `119663965780` FAILURE | Fast Gate / Required3 / QA FAIL; Full E2E8·Docker·PR Build SKIPPED |
| [Fast advisory #1.1](https://github.com/planner77/masterGantt/actions/runs/39730387612) | non-draft PR `opened` | N/A | workflow SKIPPED (정상); non-authoritative, Full PASS 불가 |

현재 접근 가능한 #771의 최초 PR CI 실패. 이후 재실행/새 Head의 실패는 이 파일에 누적, 원본을 소급 PASS 처리하지 않는다.

## 2. 실제 Job/Step 증거 (Run 39730387486, attempt 1)

| Job | ID | 결과·첫 실제 오류와 구별 |
| --- | --- | --- |
| QA Preflight | `119663902075` | PASS |
| TypeScript / ESLint / Vitest | `119663965838` / `119663965815` / `119663965876` | 모두 PASS |
| [Policy](https://github.com/planner77/masterGantt/actions/runs/39730387486/job/119663965780) | `119663965780` | **최초 FAIL**, `python3 scripts/verify-issue-lifecycle.py` 실행 시 `pull_request edited event must rerun trace validation` 출력, exit 1 (2026-10-22T05:52:09Z) |
| [PR Fast Gate](https://github.com/planner77/masterGantt/actions/runs/39730387486/job/119664513700) | `119664513700` | FAIL, `POLICY_RESULT=failure`를 올바르게 차단 |
| Required Quality / E2E / Docker | `119664569446` / `119664569632` / `119664569469` | FAIL, 선행 Policy/Fast Gate의 파생 실패. 원본 Chromium shard 8/8, PR Docker smoke, PR Build는 SKIPPED/NOT RUN |
| [QA Final](https://github.com/planner77/masterGantt/actions/runs/39730387486/job/119664594710) | `119664594710` | FAIL, `required quality 미성공`; Owner 승인 아님 |

원본에서 Chromium assertion FAIL, 테스트 본문 Timeout 또는 Docker runtime 오류가 발생했다는 증거는 없다. 실제 E2E/Docker 검증은 **NOT TESTED**, Required aggregate의 FAILURE와 구분한다. 최초 Policy가 종료해 뒤쪽 회귀 단계는 실제 실행되지 않았다.

## 3. 누적 원인·리뷰 P1 교차 매트릭스

| ID | 계약 / 근거 | 유형 및 판단 | 조치·검증 경계 |
| --- | --- | --- | --- |
| F771-001 | `scripts/verify-issue-lifecycle.py:110`은 과거 `types: [opened, reopened, synchronize, edited]` 완전 문자열만 요구. #771 CI에는 `ready_for_review, converted_to_draft` 추가. [P1 동일 지적](https://github.com/planner77/masterGantt/pull/776#discussion_r4344996110) | **POLICY_CI / TEST_CONTRACT**, 원격 Policy의 확정 첫 원인 | 정규식으로 `pull_request.types`만 추출, `opened/reopened/synchronize/edited/ready_for_review/converted_to_draft` 정확 집합·중복/미지 이벤트 거부. 기존 `edited`는 반드시 유지. 새 원격 CI: NOT TESTED |
| F771-002 | [P1](https://github.com/planner77/masterGantt/pull/776#discussion_r4344996116): `scripts/ci_fast_development.py`의 점 포함 정규식이 `tests/e2e/../evil.spec.ts`를 수용. 현 작성된 음성 테스트가 실패할 수 있음 | **TEST_CONTRACT / SECURITY_BOUNDARY**, 확인된 소스 결함이나 #3124.1에서 해당 회귀는 **NOT RUN**; 독립 원격 실패로 중복 계수 금지 | `safe_test_id`에서 선택/제외 테스트 ID의 `.`/`..` 세그먼트 거부, Fast Playwright 실행 직전에도 세그먼트·실제 resolved root 검사. 양/음성 회귀 강화. 새 CI: NOT TESTED |
| F771-001 파생 | PR Fast Gate→Required3/QA 실패, Chromium8·Docker 미실행 | 별도 제품/환경 문제 증거 없음 | Policy와 경로 문제를 합쳐 수정하되 Required3 이름/8-shard/Full fail-fast/timeout/QA·Owner/Ruleset·Main·GHCR/Release는 불변 |

## 4. 전체 실패 파일 합집합 및 회귀 선정

- 실제 원격 최초 실패: `scripts/verify-issue-lifecycle.py` 이벤트 정적 계약 (Policy Job). 간접 영향: `.github/workflows/ci.yml`의 metadata-only `edited` 및 Ready/Draft, `scripts/pr_fast_gate.py`, 원본 QA Final 증거.
- 추가 발견된 잠재 오류/음성: `scripts/ci_fast_development.py`, `.github/workflows/pr-fast-development.yml`, `tests/python/test_ci_fast_development.py`; `tests/e2e/../evil.spec.ts` 선택·제외, 유효 test spec 유지, plan hash/Run ID/Attempt·Head/Base/Test-Merge 위조·FULL_REQUIRED/UNKNOWN fallback.
- 교차: `scripts/test_qa_preflight.py`, `tests/python/test_ci_impact_plan.py`, `scripts/verify-pr-metadata-evidence.py` (source·metadata·8 shard). 이전 통과한 265 Unit 파일 발견, 792 Browser test discovery, TS/ESLint/Vitest만 해당 과거 Head의 증거이며 새 Head PASS는 아니다.
- 로컬 repo checkout/npm 설치 불가인 연결 환경으로 실행된 로컬 Python/Node/Playwright 결과: **NOT TESTED**. 수정 후 Policy Job에 단위·보호 회귀를 포함하여 remote 새 Full로 검증한다.

## 5. DOC_SYNC, 리뷰·충돌·다음 Head

- 반영 범위: 코드 검증기와 Fast workflow, 신규 음성 테스트, `AGENTS.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`, `docs/REMOTE_VALIDATION.md`, `docs/exec-plans/active/ISSUE_771.md`, `docs/exec-plans/active/PLAN.md`, 이 단일 원장.
- `DESIGN.md`, `docs/API.md`, `docs/DB_SCHEMA.md`는 제품 UI·API·SQLite 미변경으로 N/A; app version 0.129.1 유지.
- PR 리뷰 P1 2건은 실제 코드 교정 근거에 답글 후 resolve. Main 최신 여부와 mergeability 재확인. 중간 CI 중복을 막기 위해 Git blob/tree 구성 후 **branch Ref fast-forward 1회**로 신규 `pull_request.synchronize` Full PR CI 시작.
- 수정 Head의 새 Run/Attempt·Quality/E2E8/Docker/Trusted는 원본 #3124.1과 독립; 요청대로 **시작 후 모니터링 생략**, 결과 NOT TESTED, `MERGE_READY=BLOCKED` 및 Owner HIGH 별도 승인 필요. B5 실제 시간 절감 효과 INSUFFICIENT_DATA. 병합/Main/GHCR/Finalizer/Issue 종료 미진행.
