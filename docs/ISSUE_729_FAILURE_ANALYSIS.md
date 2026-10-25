# Issue #729 — Main CI 누적 실패 원장

## F-001 — PR #744 최초 Main CI trace 검증 실패 (2026-10-19 KST)

| 항목 | 원본 증거 |
| --- | --- |
| 최초 구현 PR | [#744](https://github.com/planner77/masterGantt/pull/744), HEAD `7ef1e4f8a576574437e62f236e66effa444df7fc` |
| 원격 PR 검증 | [Full #2992.1](https://github.com/planner77/masterGantt/actions/runs/39189869219): Quality/E2E 6-shard/Docker SUCCESS; [Trusted QA #634.1](https://github.com/planner77/masterGantt/actions/runs/39191876216) SUCCESS |
| 병합 SHA | `59f42e291a48608d1280951a7d7874a21992aaa5` (two-parent; PR test merge와 Git Tree 동일) |
| 실패 run | [Main #2993.1](https://github.com/planner77/masterGantt/actions/runs/39200938710), ID `39200938710`, attempt1, push, 결론 FAILURE |
| 최초 실패 Job | `변경 경로 판정` job `117893582604`, `CI 실행 추적 메타데이터 검증` exit1 |
| 정확한 오류 | `CI 실행 추적 오류: Issue # 접두어는 정확한 단일 행 표준 Merge 제목만 허용합니다 (번호·PR·한글 요약 형식 확인)` |
| 영향을 받은 결과 | Required Quality/E2E/Docker aggregate 실패(선행 추적검증 차단, 실제 테스트 skipped); Main 임시 GHCR skipped |
| 재현 입력 | GitHub Merge API의 `commit_title="Issue #729 · PR #744 · WBS 다관점 조회·snapshot 상세 API"` 외 `commit_message="Refs #729\n\n..."`를 전달하여 실제 merge commit message가 여러 줄이 됨 |
| 기준 규정 | `scripts/main_ci_run_name.py`의 `parse_merge_title`, `merge_api_payload` 및 `scripts/verify-ci-run-trace.py`: 단일 한글 표준 제목·빈 `commit_message`만 허용 |

### 원인, 보호 기준과 교정 방안

**Root cause는 Manager의 Merge API 인수 지정 오류**다. Product test/성능/러너 실패로 오진하지 않는다. `main_ci_run_name.py --as-merge-payload` 결과(특히 `commit_message: ""`)를 실제 호출에 적용하지 않은 것이 직접 원인이다. 해당 원본 커밋과 실패 실행은 불변으로 보존한다. Main trace gate를 완화하거나 재실행으로 원본 HEAD를 소급 성공시키지 않는다.

동일 Issue 후속 non-docs corrective PR을 최신 main SHA `59f42e291a48608d1280951a7d7874a21992aaa5`에서 작성하여 다음을 수행한다.

1. WBS API·기존 호환·버전 `0.122.0`을 유지하고 공정 하위 typed 형제(equipment/system) 순서를 바꾸어도 원시 Task/Assignment·부모 KPI 합집합이 동일함을 검증하는 **실제 SQLite→HTTP 수용 테스트** 추가.
2. 최종 Head에 대한 신규 Full PR CI Required Quality/E2E6/Docker, 기본 Trusted QA, review thread0·main strict, Owner HIGH 위험 재수용 후에만 Merge한다.
3. 새 PR의 실제 merge title은 `scripts/main_ci_run_name.py --as-merge-payload`와 일치하는 한 줄 한글 형식, `commit_message=""`로 제한한다. 병합 직후 새 Main CI Required3, 임시 GHCR exact `ci-<SHA>` digest/SBOM/provenance를 확인한다.
4. `scripts/auto_release_finalizer.py`의 동일 Issue/연속 non-docs/동일 version·후속 Main success 한정 supersession과 미발행 `v0.122.0` 의무 승계를 **실제 run 결과로 확인**한다. 다른 Issue 개입, docs-only 교정, version 변경 시 release 의무 자동 승계 금지.
5. [Owner version-scoped 승인](https://github.com/planner77/masterGantt/issues/729#issuecomment-6259829502)은 `0.122.0`에 대해서만 유효하며 배포 검증을 대체하지 않는다.

### 상태

후속 PR/Head, 회귀 테스트 및 PR CI·Trusted QA, 정확한 new Main CI/GHCR/Release, safe cleanup·Issue close는 **NOT TESTED / BLOCKED**. 실제 Run/Attempt/병합/정식 게시 결과 확인 후 같은 문서에 누적한다. 기존 PR #744 Full CI와 Main FAIL을 교정 PR의 새로운 PASS로 바꿔 쓰지 않는다.

## F-002 — 교정 PR #745 최초 PR CI #2994.1 QA Preflight 문서 동기화 FAIL (2026-10-19 KST)

- 원본: [PR #745](https://github.com/planner77/masterGantt/pull/745) HEAD `4c5fec2fa22d79a5bb7b22fc7643ba941a02a774`, base `59f42e291a48608d1280951a7d7874a21992aaa5`. [Full PR CI #2994.1](https://github.com/planner77/masterGantt/actions/runs/39201801581), run ID `39201801581`, attempt1, event pull_request, conclusion failure.
- 최초 실패 Job: `QA Preflight — 정책·문서 사전 검사` `117896199677`, `원본 base SHA의 QA Preflight 실행 (read-only)`. 실제 사유: `FAIL / DOCUMENTATION_SYNC: docs/exec-plans/active/ISSUE_729.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — 문서 변경 또는 N/A(reason) 미입증: docs/TEST_PLAN.md`. 정책/이슈/QA Required 플래그·changed path 검사는 PASS.
- 결과: PR Fast Gate FAIL에 따라 Quality/E2E/Docker Required aggregates FAIL, 실제 Unit/Chromium/Build/Docker는 skipped; QA Final도 실패. 이는 수용 테스트 구현 실패가 아니라 **신규 테스트 영향 문서 동기화 미충족**.
- 보완: `docs/TEST_PLAN.md`에 새 AC2/3 역방향 sibling 메타모픽의 테스트 범위 및 F-001/F-002 회귀 근거를 추가하고, Work Packet의 DOCUMENTATION_SYNC에 `docs/TEST_PLAN.md: UPDATED`와 실제 영향/제외 사유를 명시. QA Preflight를 완화하거나 `NOT TESTED`를 PASS로 바꾸지 않음. 신규 push→Full PR CI 전체 재검증.
- F-001 최초 main trace 실패와 F-002 documentation gate 실패는 서로 다른 원인이다. 두 Run/Attempt의 결과를 보존하며 이후 동일 Issue 재실패 시 이 원장 전체를 누적 대조한다.
