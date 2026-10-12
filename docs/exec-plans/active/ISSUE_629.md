## PR CI #2532.1 원본 실패 및 보완 (2026-10-12 KST)
- [원본 PR CI #2532.1](https://github.com/planner77/masterGantt/actions/runs/38186982545) — HEAD `541b4b36ff6ba007ac79e8cb562a9565ceba5927`, run `38186982545.1`: 변경 경로/QA bootstrap PASS, Preflight는 base 미도입으로 `NOT TESTED`(Job 자체 SUCCESS), Chromium E2E 6/6·Docker smoke 및 aggregate SUCCESS. Policy Job의 `scripts/test_qa_preflight.py::test_workflow_aggregate_guard_contract` 10개 중 9개 PASS/1개 FAIL.
- 직접 원인: Python assert가 `ref: ${{ github.event.pull_request.base.sha }}`(literal backslash 포함)을 기대하나 workflow의 실제 값은 `ref: ${{ github.event.pull_request.base.sha }}`. 문자열 `\$`의 불필요한 역슬래시를 제거하고 일치/잘못된 escaped form 불일치 회귀를 추가. 신규 Policy Job 실패 → required `Build, static checks, and unit tests` FAILURE → `QA Final — Automated`는 `required quality 미성공`으로 FAIL. E2E·Docker의 원본 성공은 수정 후 새 Head의 성공 근거가 아니다.
- Codex PR #630 P1 review도 동일 Assertion 오류를 지적했다. 리뷰 스레드는 재확인·응답 전까지 미해결로 취급. 원본 #2532.1의 FAIL 상태는 소급 수정하지 않는다.
- 새 Head Python policy tests / Quality·E2E·Docker·Trusted QA는 새 PR CI에서만 판정. Owner ACCEPT, merge/Main CI/GHCR/Issue close는 이번 재작업 범위 밖.

# Issue #629 — QA Final 사전 검증(Preflight)

## Work Packet
- Lifecycle: ANALYSIS → PLAN → BRANCH → IMPLEMENT → DOCUMENTATION_SYNC → PR CI (현재 단계).
- Base main: `6eaec3331fcbc720ab42106789a505c5ee5eefb4`; branch: `ci/issue-629-qa-preflight`.
- Scope: trusted base SHA의 PR 메타데이터/변경 파일 기반 구조·정책·문서 검사; Full CI 선행 차단 및 required aggregates 세 종 fail-closed; 실패 원인 replay/문서·실측 운영 계획.
- Non-scope: final QA/Trusted provenance 변경, PR edited #600 조율, 앱 UI/DB/API/제품 버전, main/merge/GHCR, GitHub Ruleset 변경.
- risk_level=HIGH; qa_method=OWNER_MANAGED; qa_required=true; independent_qa=N/A(Owner-managed, 독립 검토 없음); manager_decision=NOT TESTED.
- release_required=false; release_authorized=false. 기존 앱 버전 유지.
- Security: base ref checkout with read-only token, no PR code execution/Secrets/PAT/pull_request_target; GitHub API metadata/Work Packet is untrusted data. Bootstrap on introducing PR reports NOT TESTED and retains full CI.
- Deferred: latest aggregate jobs/Trusted QA/review, precise test-merge and Owner acceptance, no false MERGE_READY.
- Validation: policy job `scripts/test_qa_preflight.py` and existing QA suites, remote PR CI P1–P5 NOT TESTED until run; historical fixture 2373/2522 categories are synthetic replay, not direct replay of archived bytes.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `scripts/qa_preflight.py`: UPDATED
- `scripts/test_qa_preflight.py`: UPDATED
- `.github/workflows/ci.yml`: UPDATED
- `DESIGN.md`: N/A(제품 UI 및 UX 지침 변경 없음)
- `docs/API.md`: N/A(애플리케이션 서버 API 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(데이터베이스 구조 변경 없음)
- `docs/DECISIONS.md`: N/A(새 아키텍처 의사결정 기록이 아니라 기존 #598/#593/#600 정책 적용)

## AC_TEST_COVERAGE
- AC1: test_qa_preflight.py title/Refs와 문서 누락 원인 replay, 원격 P2 예정
- AC2: test_qa_preflight.py 보호 경로·AGENT/OWNER_MANAGED·qa_required 분기
- AC3: CI workflow needs/always required aggregate 3종 계약, 실 CI fail/normal P1/P2 필요
- AC4: mergeable pending/deferred 및 stale Head/base blocked 테스트, Trusted QA 별도 검증
- AC5: #600 metadata edited 분리, main/manual/Docker release gate 불변; 원격 P5 필요
- AC6: QA Python scenario 및 원본 historical run 정합 실 검증, remote P1–P5 PENDING
- AC7: qa-preflight-report.json/run/attempt 시간 기록, 실제 절감 runner-minutes 측정 PENDING, rollback CI_CD 참고
- AC8: AGENTS·CI_CD·QA_REVIEW_POLICY·GITHUB_OPERATIONS·REMOTE_VALIDATION·TEST_PLAN·ISSUE_LIFECYCLE·PLAN·CHANGELOG 및 본 Packet 동기화

## Open risks / rollout
- Preflight를 변경하는 PR 본인은 기존 base validator만 사용할 수 있다. 최초 도입 PR에서는 base가 새 파일을 갖지 않아 Bootstrap NOT TESTED(기존 Full CI는 전부 유지). 이후 별도 실제 실패 PR로 required 3종 FAILURE·heavy jobs skip을 검증한다.
- PR workflow 자체는 PR이 편집 가능하다. 독립된 기본 브랜치 Trusted QA와 exact Head/base/Run 판정은 유지하며 자체 승인 금지.
- GitHub API rate/error, fork, aggregate cancelled, merge base drift는 반드시 실제 원격에서 fail-closed 확인; CLI/local tests만으로 완료 선언 금지.
- 새 PR CI 시작까지만 수행. 병합/Issue close/GHCR/post-release 작업은 불허.
