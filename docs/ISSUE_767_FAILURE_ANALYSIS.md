# Issue #767 — 누적 실패 원장

## 목적

`v0.129.1` 교정 릴리스/후속 Issue #767의 새 PR·Main·Release CI 실패를 이슈 단위로 누적한다. 새 Run 전에는 실패를 만들어 기록하지 않으며, 과거 #736의 실패와 분리한다.

## 역사적 출처 (새 Issue 실패로 계산하지 않음)

| 구분 | 근거 | 결과 및 의미 |
| --- | --- | --- |
| #736 Main #3071.1 | [Run 39499988360](https://github.com/planner77/masterGantt/actions/runs/39499988360) | 정확 Assignment 초기 입력 미렌더, 원본 실패 M736-001 |
| #764 PR #3076.1 | [Run 39510892786](https://github.com/planner77/masterGantt/actions/runs/39510892786) | Milestone→Resource→일정 LIFO focus 실패 및 P2 권한 재검사, 원본 F736-004 |
| #764 PR #3092.1 | [Run 39602089760](https://github.com/planner77/masterGantt/actions/runs/39602089760) | Head 5abc658의 원본 Full Success; 새 Head PASS 아님 |
| #764 Trusted #734.1 | [Run 39607021968](https://github.com/planner77/masterGantt/actions/runs/39607021968) | 원본 Head에 대한 trusted SUCCESS; 후속 PR 재실행 필요 |

## 신규 실패 기록

현재 없음. 새 Full PR/Main/Release 실패 발생 시 `F767-001`부터 원본 Run ID/attempt/Job/정확 테스트/증거/원인/대책/새 SHA/반복 시 차이를 추가한다. 단순 실패 run 재실행이나 timeout 확대는 원인 분석 후 승인에 따르며 CI 실패 이력을 덮어쓰지 않는다.

## F767-001 — PR #768 Full #3093.1 QA Preflight Issue AC 식별자 누락 (2026-10-21 KST)

- **Original immutable Run**: [PR Full #3093.1 / 39609933138 attempt 1](https://github.com/planner77/masterGantt/actions/runs/39609933138), Head `e873e9c54e2812408e0be90381d106dc2828a6b3`, Base `71f9b9ddb61be7f6e076accc027188f362e18bb1`, event=`pull_request`.
- **직접 실패**: `QA Preflight — 정책·문서 사전 검사` Job `119256007917`, step `원본 base SHA의 QA Preflight 실행 (read-only)`. 보고서 `FAIL / ISSUE_AC: Issue #767 Acceptance Criteria — Primary Issue 본문에 AC1.. 식별자 없음` (artifact `12348994611`). 원본 Issue body는 `## AC` 아래 체크리스트 7줄이 있지만 `AC1`~`AC7` 식별자가 없었다.
- **파생 결과**: PR Fast Gate/3 Required aggregate/Automated QA FAIL; 실제 Quality/E2E6/Docker 구현 Job은 SKIPPED. 테스트 본문/Shard 35m Timeout, 소스 기능 결함 또는 새 Manifest/lockfile의 테스트 실패 **아님**.
- **원인**: 신규 후속 Issue #767 등록 시 docs의 Work Packet AC1..AC6과 달리 GitHub Primary Issue checklist에는 번호 접두어가 누락됨. 기존 #629 trusted base `qa_preflight.py`는 Issue 본문 **독립 AC1..** 식별자를 필수로 요구한다. 의도된 fail-closed 판정.
- **보완**: [Issue #767](https://github.com/planner77/masterGantt/issues/767) 본문의 기존 7개 체크리스트만 `AC1`~`AC7`로 변경해 내용·기준/Owner 권한/릴리스 범위는 불변. 이 실패를 단일 이슈 원장에 누적하고 문서-only 새 commit으로 Full PR CI `synchronize` 실행. 새 CI의 실제 3 Required 및 Trusted QA 결과는 별도 검증, 이전 SUCCESS로 추정 금지.
- **회귀 정책**: 해당 실패 때문에 글로벌 timeout/Retry/Shard/QA Preflight를 완화·비활성화하지 않음. 동일 issue 재실패 시 Primary Issue 실제 JSON/body와 new Run source를 먼저 대조한다.

## F767-002 — PR #768 Full #3094.1 Work Packet DOCUMENTATION_SYNC/AC_TEST_COVERAGE 누락 (2026-10-21 KST)

- **원본 Run**: [PR Full #3094.1 / 39610534229 attempt 1](https://github.com/planner77/masterGantt/actions/runs/39610534229), head `0a7ae24fbb3d862128c719b56a398c42e2abacd7`, base `71f9b9ddb61be7f6e076accc027188f362e18bb1`.
- **직접 원인**: `QA Preflight — 정책·문서 사전 검사`가 `ISSUE_AC PASS`까지 확인 후 `FAIL / DOCUMENTATION_SYNC: docs/exec-plans/active/ISSUE_767.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — Work Packet ## DOCUMENTATION_SYNC 누락`으로 중단. #3093.1의 AC 번호 오류는 해결, 이번 실패는 신규 Work Packet의 필수 구조 누락이다.
- **파생**: Fast Gate/세 Required aggregate/QA Final FAILURE, 실제 Quality/E2E/Docker 구현 job SKIPPED. 35분 E2E timeout 또는 제품 Assertion 오류가 아니다.
- **개선**: 기준 `scripts/qa_preflight.py`→`scripts/qa_final_automated.py::docs_gate`를 확인하고 신규 Work Packet에 별도 정확한 `## DOCUMENTATION_SYNC`/ `## AC_TEST_COVERAGE` 절을 작성. 변경 path 영향 union의 `DESIGN.md` (N/A 근거), `docs/TEST_PLAN.md` (UPDATED), `docs/SCHEDULING_ENGINE.md` (N/A 근거), Issue 본문 AC1..AC7 모두 각 테스트·증거에 매핑. 새 commit 후 Full CI를 `synchronize`로 다시 실행한다.
- **과거 증거/안전성**: 원본 #3093.1/#3094.1 실패를 PASS로 바꾸지 않고, 검증기/timeout/Retry/Shard/Required 정책 변경 또는 Owner 자동 승인 생성 금지.
