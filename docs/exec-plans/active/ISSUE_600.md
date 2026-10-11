# Issue #600 — metadata CI 자동 회복 및 QA 중복 억제

## Work Packet
- Base main: `e41696430a78045998e35edad7cab5bb901a097e`; branch `ci/issue-600-metadata-reconcile`; version `0.104.0` 유지.
- Scope: default-branch `workflow_run` metadata recovery + 안전성 Python 테스트·운영 문서; non-scope: merge/main CI/GHCR/Ruleset 변경. risk_level=HIGH; qa_method=OWNER_MANAGED; qa_required=true; independent_qa=N/A(Owner-managed, 독립 검토 없음); manager_decision=NOT TESTED.
- Design A chosen: existing ci.yml Required gate / concurrency logic unchanged (policy job additionally runs #600 Python scenarios); Full CI + metadata-only never cancel one another. Extra workflow_run job carries narrowly scoped actions:write and only retries the latest failed metadata CI job aggregate after exact three-gate Full CI. Design B would change required source/check contexts and needs Ruleset migration, so rejected. No Runner polling or pre-success PASS.
- IMPORTANT: automation can recover the latest failure only when it has exact PR attribution and first failed attempt evidence; it does not prevent earlier completed Trusted FAIL entries. AC3/AC8 partially met until real end-to-end rehearsal.
- Release: release_required=false; release_authorized=false; no app version/tag/GHCR.
- Fast feedback: Python scenario tests and syntax planned; GitHub PR three aggregate result NOT TESTED until CI.

## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/DECISIONS.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `DESIGN.md`: N/A(UI·사용자 기능 변경 없음)
- `docs/API.md`: N/A(서버 API 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB·migration 변경 없음)

## AC_TEST_COVERAGE
- AC1: scripts/test-pr-metadata-reconcile.py exact success/deferred, CI workflow unchanged, live scenario PENDING
- AC2: scripts/test-pr-metadata-reconcile.py failed/cancelled/base/attempt, qa_final_automated.verify_same_base_full_run
- AC3: scripts/test-pr-metadata-reconcile.py latest edited/synchronize stale, real rapid edit PENDING
- AC4: scripts/test-pr-metadata-reconcile.py live trace mismatch plus existing verify-ci-run-trace.py/QA
- AC5: scripts/verify-issue-lifecycle.py contracts, existing aggregate names, actual Ruleset replay PENDING
- AC6: .github/workflows/qa-final-trusted.yml unchanged, #593 provenance tests, real Trusted PENDING
- AC7: scripts/test-pr-metadata-evidence.py M1-M8 + scripts/test-pr-metadata-reconcile.py; #591 real reproduction PENDING
- AC8: docs/CI_CD.md measurement plan, before/after Actions run/Runner minutes PENDING
- AC9: DOCUMENTATION_SYNC and scripts/verify-issue-lifecycle.py document path gate

## Verification boundary
- baseline Full/metadata/QA run URLs in Issue #600, no baseline savings estimate invented.
- Same SHA CI and trusted verifier runtime success NOT TESTED until PR workflows complete; protected workflow modifications require Owner verification before merge.

## CI #2432.1 REWORK (2026-10-11 KST)
- Failed run: https://github.com/planner77/masterGantt/actions/runs/38089024177 , exact prior Head `9e62a6fc233a235c638c249546809d1a4f8532f9`.
- Policy job actually executed `python3 scripts/test-pr-metadata-reconcile.py`: 11 tests, 1 ERROR and 1 FAIL. `test_old_success_never_overrides_latest_failure` selected metadata run #23 but GH.get mock returned #22 irrespective of run ID, producing false STALE. `test_failed_nonmetadata_job_is_not_retried` assigned success again to an already-successful changes job and therefore could not raise expected NO_RETRY.
- Fix: map API /actions/runs/<id> to exactly one mock run and assert unexpected ID; for changes-job scenario set failure and for metadata/required-aggregate scenarios replace the original failure with success. Assert exact NO_RETRY in all negative cases; retain the remaining nine tests and #577 M1-M8.
- Consequence: Quality aggregate and QA Final — Automated failed because policy failed. TypeScript/ESLint/Vitest/production build/E2E shards 6 of 6/Docker smoke jobs were SUCCESS for the previous Head only and are not evidence for the next Head. No bypass or forced PASS.
- New PR CI execution after this correction: NOT TESTED until its new exact Head workflow starts; no merge/Main CI/GHCR requested.

## 2026-10-11 최신 main 충돌 해소 및 #593 provenance 호환
- 이전 PR Head: `ef852df9465a2e83aa0546d3085b327b66f35822`; 이전 PR CI [#2438.1](https://github.com/planner77/masterGantt/actions/runs/38090571785)는 SUCCESS지만 이번 main alignment Head에는 증거로 재사용하지 않는다.
- 최신 main 고정 SHA: `25e368ef7b4ba7cf59ac5b81e94dd0a98b87f31d`; 기준점 `e41696430a78045998e35edad7cab5bb901a097e` 이후 main 93개 커밋 선반영. Two-parent merge commit으로 main의 #593 신뢰 QA provenance, #586 Finalizer, #437 E2E shard plan 및 CI 계약을 유지하고 #600 경량 workflow·테스트·문서 델타만 결합한다.
- 문서 8종 공통 변경은 #600 상단 정책 문단과 latest main 전체 본문을 양쪽 모두 보존하였다. `.github/workflows/ci.yml`은 main의 PR 출처 artifact, Required Check 이름, E2E shard 및 나머지 모든 변경을 유지하면서 #600 Python recovery 테스트 실행 step만 다시 적용한다. `scripts/verify-issue-lifecycle.py` 역시 latest main 계약 검사 전체와 #600 정적 계약·#593 provenance 의무를 병합한다.
- #593 도입 `source_artifact`/`verified_source` 기반 CI 원본 이벤트 원장을 복구 판정에도 적용한다. `workflow_run.pull_requests=[]`를 단독 승인하지 않되, 정확한 run/attempt artifact와 단일 commit→PR 조회가 일치하면 정상 판정할 수 있다. SHA/Head/base/test-merge, 살아 있는 PR, 신뢰된 default branch, required 3종, write token 최소권한 및 fail-closed는 불변.
- #600 회귀는 13개 deterministic scenario(빈 pull_requests/없는 artifact 포함) + 기존 #577 M1–M8 + #593 QA Python regression. Local Fast Feedback은 GitHub 커넥터만 사용하므로 NOT TESTED, 정확 새 Head의 policy/Quality/E2E/Docker/Trusted QA는 PR CI에서 새로 판정한다.
- Merge/Main CI/GHCR/릴리스/이슈 종료는 이번 요청 범위 밖. PR CI 시작 직후 결과 NOT TESTED, HIGH Owner 최종 검토 별도.

## 2026-10-11 PR CI #2463.1 SUCCESS / QA Trusted #97.1–97.2 BLOCKED 재작업
- 최신 병합 정렬 Head `8d0f9ea75eeb1458d3ef654a86a896993e4c6cd9`의 [PR CI #2463.1](https://github.com/planner77/masterGantt/actions/runs/38100331683): Quality/E2E/Docker 및 QA Final — Automated SUCCESS. 댓글 리뷰 3건 해결, thread 0, base `25e368ef7b4ba7cf59ac5b81e94dd0a98b87f31d` 일치.
- [default-branch QA Trusted #97.1/#97.2](https://github.com/planner77/masterGantt/actions/runs/38101359507)는 원본 CI artifact GET HTTPError로 BLOCKED(재실행 동일). 원본 `ci-pr-source-38100331683-1` artifact ID `11687426556`는 존재하며 Github connector로 ZIP 실제 다운로드 성공. GitHub Actions runner 단계의 실제 HTTP status는 구 verifier에서 출력하지 않아 확정 원인 단정 금지.
- Python `urllib.request.HTTPRedirectHandler.redirect_request`는 기본값으로 cross-origin 302에도 Bearer Authorization header를 복사한다는 사실을 로컬 stdlib 코드 검사로 확인. GitHub artifact ZIP endpoint는 외부 signed storage로 redirect될 수 있으므로 인증 헤더 유출/HTTP 거부 가능성을 차단하도록 `_ArtifactRedirect`를 도입한다. Redirect는 HTTPS·신뢰된 download host로 제한하고 cross-origin Authorization/Cookie/Proxy-Authorization 제거, JSON ZIP 크기·정확 run/attempt·provenance·fail closed 보존. HTTP 오류 숫자만 보고, Secret/서명 URL 기록하지 않는다.
- Regression: `scripts/test_qa_final_automated.py::test_source_artifact_redirect_never_exposes_token`에서 Azure/actions CDN 인증 헤더 제거, same-origin 보존, HTTP downgrade·악성 호스트·userinfo 차단을 검증. 기존 #593 source-artifact & #600 회귀 계속 시행. `docs/TEST_PLAN.md` 업데이트.
- **신뢰 경계:** 새 PR 코드를 기본 브랜치 Trusted QA가 실행하지 않으므로 이번 수정만으로 #97 실패를 PASS로 바꾸지 않는다. Protected main Trusted 검증은 수정 코드의 main 반영 후 별도 재검증이 필요하고, Owner 수동 승인도 정확한 Head+Trusted PASS 전에는 MERGE_READY가 아니다. 본 재작업은 신규 Head PR CI를 시작하는 데까지 수행; merge/Main CI/GHCR/tag는 차단 상태를 유지한다.

## 2026-10-11 PR CI #2466.1 실패 재작업
- [PR CI #2466.1](https://github.com/planner77/masterGantt/actions/runs/38101702813), Head `5d0ddf41c01c4840b7abff7870b42a078481d92f`: policy Job의 `scripts/test_qa_final_automated.py` 34개 중 `test_source_artifact_redirect_never_exposes_token` 1개가 `AttributeError: Request.remove_unredirected_header`로 ERROR. Quality aggregate 및 QA Automated 연쇄 FAILURE, E2E 6/6·Docker·Node/TS/ESLint/Unit/Build는 SUCCESS(이전 Head 증거만).
- 표준 Python `urllib.request.Request`에는 `remove_unredirected_header`가 존재하지 않으며 `remove_header`가 `headers`와 `unredirected_hdrs` 둘 다 삭제. 또한 `Proxy-Authorization` 저장 키는 `Proxy-authorization`으로 정규화되므로 원본 문자열만 삭제하면 Proxy bearer가 유출될 수 있음. 실제 키를 case-insensitive하게 순회하여 Authorization/Cookie/Proxy-Authorization을 모두 삭제하도록 수정.
- Regression: redirect된 Request 내부 headers/unredirected_hdrs에 민감한 키 없음, 호출 전 원본 Request 보존, same-origin 정상 처리, 악성 호스트/HTTP/userinfo 차단, `remove_header()` 양쪽 dict 제거 확인. 기존 Fail-closed/3 required CI 및 Trusted main 경계 변경 없음.
- 이번 요청은 새 exact-Head PR CI 시작까지만. 병합/Main CI/GHCR/Owner 수용은 진행하지 않음; 이전 Trusted BLOCKED는 소급 PASS 불가.
