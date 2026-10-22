# Issue #770 — 누적 PR CI 실패 원장

## 2026-10-22 — R770-MAIN-001: 최신 main 병합 및 8-shard 호환 (실패 아님)

- 최신 성공 원본: [Full PR CI #3105.1](https://github.com/planner77/masterGantt/actions/runs/39696698959), Run ID `39696698959` / Attempt 1 / Head `b53a15de9aaee3ce96887b3ec24446bc482e2c81` / Base `71f9b9ddb61be7f6e076accc027188f362e18bb1`. GitHub의 실제 Quality/Chromium E2E 6/6/Docker/QA Final 결과 모두 **SUCCESS**. [Trusted QA #747.1](https://github.com/planner77/masterGantt/actions/runs/39700558664)도 SUCCESS. 과거 F770-001/F770-002 실패와 별도 사건이며 성공을 실패로 재표기하지 않는다.
- 사용자 요청 시점 PR #774는 **새 main `81c28fa5502caee27e98d4d293b0b1b28e6340dd`보다 behind 10 / ahead 15 / mergeable=false**. 변경 파일 충돌은 `.github/workflows/ci.yml`, `AGENTS.md`, `docs/CI_CD.md`, `docs/REMOTE_VALIDATION.md`, `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`의 중첩 수정이며 PR #770 기능 테스트의 신규 실패로 추정하지 않는다.
- #767 current main은 app **0.129.1**, Chromium E2E **8-shard(1..8, 각17 specs, 총136)** 및 관련 CI/Release/optimizer/QA 정책을 포함. PR #770의 **과거 6-shard Shadow 기대값은 최신 main과 비호환**이므로 인증된 base의 `tests/config/e2e-shard-plan.json` schema/group/shardCount를 정확히 검증해 현재8(미등록·불일치 UNKNOWN), 기존 6-shard 이력은 역사 증거로 분리한다. 6/6=현재 8/8 PASS 주장 금지.
- 병합 전략: 신규 PR Head는 구 Issue branch Head + 새 main의 **two-parent merge commit**으로 만든다. resulting Tree는 **최신 main 전체 Tree 기준**이며 원 branch에만 있는 분류기·Python 테스트·timing reporter·실패 원장은 무손실로 유지한다. workflow는 새 main의 8-shard 변경을 우선하고 정책 회귀 + 비차단 Shadow Job만 삽입. 중첩 문서들은 기존 Issue #770 additive section + 최신 main 문서 전체를 보존한다.
- 리뷰 조회 시 기존 P1/P2 스레드는 **2건 모두 resolved**(아웃데이트 표시, 별도 신규 thread 없음). 새 Head 병합 가능·리뷰 상태는 push 뒤 다시 확인한다.
- 변경 결과 검증: 신뢰된 8-shard 정책/정확 1..N/기존 6개 샤드 위장 실패 단위 테스트 추가; 새 Head 원격 Full Quality/E2E8/Docker 및 Trusted QA는 실행 전 **NOT TESTED**. README/UI/API/DB/버전/Release 설정에 별도 수정/태그 이동 금지. `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `release_required=false`, `release_authorized=false`.
- **이번 사건은 원본 PR CI 자체의 실패가 아니라 최신 main 진전으로 인한 병합 불가/Shadow 계약 드리프트**이므로 F770-003 등 가공 실패 ID를 생성하지 않는다. 새 CI 결과는 후속 Run에 독립 귀속한다.


Primary Issue: [#770](https://github.com/planner77/masterGantt/issues/770) · [PR #774](https://github.com/planner77/masterGantt/pull/774) · 2026-10-22
정책: [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md), [Work Packet](exec-plans/active/ISSUE_770.md). Branch: `ci/issue-770-trusted-impact-shadow`. 원본 Head `903dfc5591b43befaafe4aa55bce56049b0dff85`, Base/Main `71f9b9ddb61be7f6e076accc027188f362e18bb1`.

## 1. PR #774 모든 Run/Attempt 및 실패 원인

| ID | 원본 CI 및 증거 | 실제 최초 오류 | 후속 Job 및 검사 상태 |
|---|---|---|---|
| F770-001 | [Full #3101.1](https://github.com/planner77/masterGantt/actions/runs/39688555697), Run `39688555697`, attempt 1, PR Head `903dfc55...` | QA 신뢰 경계 Job `119528703661`: PR `qa_method` 누락 선언; QA Preflight Job `119528839848`: RISK_LEVEL / QA_METHOD / QA_REQUIRED / PATH_POLICY / ISSUE_AC 5개 FAIL | Fast Gate `119528932548` FAIL. Required Quality `119529024628`, Chromium aggregate `119529024432`, Docker aggregate `119529024670` 파생 FAIL. 실제 TS/Lint/Unit/Build/Chromium6/Docker 구현 **SKIPPED** |
| F770-002 | [Metadata-only #3103.1](https://github.com/planner77/masterGantt/actions/runs/39691582062), Run `39691582062`, attempt 1, 동일 Head/Base | Metadata evidence Job `119538900460`: `FULL_FAILED` (검증 대상 Full `39688555697.1` 실패) | Required Quality `119538997121`, E2E `119538997066`, Docker `119538997164`, QA Final `119539029027` 파생 FAIL. 실제 제품·브라우저 검사 전부 **SKIPPED** |

- 조회 당시 PR의 test-merge snapshot은 `35c752eb2ab5e42a8bf037352d423dcd6df1478c`였으나 두 실행의 원본 `ci-pr-source` artifact는 독립 디코딩하지 못했으므로 **정확한 이벤트별 test-merge SHA 귀속은 UNVERIFIED**. Head/Base, Run/Attempt는 API/로그로 확인했다.
- 현재 접근 가능했던 Issue #770 / PR #774의 관련 Full CI 실패 1건, metadata-only 실패 1건을 별도 이력으로 보존한다. metadata-only는 Full 테스트를 다시 실행한 것이 아니며 옛 Full FAIL을 PASS로 소급하지 않는다.
- 첫 오류 유형: **POLICY_CI**, 실제 제품 FAIL/Playwright timeout 아님. 기존 CI의 fail-closed는 정상이므로 검사기를 완화하지 않는다.

## 2. Cross-run 실패·리뷰 보완 매트릭스

| 분류/원인 | 원본 사실 및 보완 내용 | 새 HEAD 확인 |
|---|---|---|
| F770-001: PR 메타데이터 구조 | PR body가 `- \`risk_level: HIGH\``처럼 코드 인라인으로 작성되어 정규식이 standalone 필드로 인식하지 못함. 본문을 `risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `qa_required: true` 각각 단 한 번의 유효 선언으로 교정. `release_required=false`, `release_authorized=false` 유지 | 신규 Full Preflight **NOT TESTED** |
| F770-001: Primary Issue AC ID | Issue에 `A1..A7`로 표기되어 QA는 `AC1..AC7`을 찾지 못함. 동일 수용 문구를 보존하고 식별자만 수정 | 신규 Full Preflight **NOT TESTED** |
| F770-002: 수정 metadata only | 수정된 PR 설명으로 발생한 #3103.1은 기존 Full 실패를 발견하여 정상 차단. 별도 코드를 commit하여 새로운 `synchronize` Full CI 생성 필요 | 이전 FAIL 불변 |
| 리뷰 [P1](https://github.com/planner77/masterGantt/pull/774#discussion_r4342743213): 277KB 인자 | 실제 Unit 258개/E2E 136개 import graph JSON을 Node 단일 argv 인자로 넘겨 OS `E2BIG` 위험. **이번 Full에서는 Preflight가 먼저 실패했으므로 별도 리뷰 발견**. base-trusted Node 코드만 실행, PR 데이터는 stdin 전달. 실제 파일 인벤토리와 200KB 이상 입력을 사용하는 회귀 추가 | 신규 Policy/Shadow **NOT TESTED** |
| 리뷰 [P2](https://github.com/planner77/masterGantt/pull/774#discussion_r4342743221): 정상 skip 누락 | `resource-tabs.spec.ts` 기본 `test.skip`가 기존 reporter passed-only 목록에 없어 정상 6-shard 성공을 허위 미완료로 기록. `entries` passed-only 호환 유지, `skippedFiles` / `skippedCaseCount` 필드 추가. Shadow는 passed ∪ skipped 전체 파일 커버리지 확인, 별도 skipped-only 집계. 누락·구형 artifact·잘못된 source는 UNKNOWN; Skip≠PASS | 신규 Policy/Chromium/Shadow **NOT TESTED** |

누적 **실제 실패 Unit/E2E 테스트 파일의 합집합: 없음**. 모든 제품/브라우저 구현 Job은 실행되지 않았다. 보완 대상은 `scripts/ci_impact_plan.py`, `tests/config/e2e-timing-reporter.cjs`, `tests/python/test_ci_impact_plan.py`, PR/Issue 메타데이터 및 문서다. `tests/e2e/resource-tabs.spec.ts`의 기존 Skip/단언/timeout은 수정하지 않는다.

## 3. 검증, 미완료 및 다음 단계

- 회귀 명령: `python3 -m unittest discover -s tests/python -p 'test_ci_impact_plan.py' -v` — 실제 Unit/E2E file inventory 기반 200KB 초과 stdin Node selector, skip/pass/missing·reporter JSON 및 보안 negative 검사. 실제 로컬 실행은 이 세션에서 **NOT TESTED**; 새 PR Policy CI가 최초 검증한다.
- 문서: 본 파일에 실패 누적, [Work Packet](exec-plans/active/ISSUE_770.md)·[TEST_PLAN](TEST_PLAN.md)·[CI_CD](CI_CD.md)·[REMOTE_VALIDATION](REMOTE_VALIDATION.md)·active PLAN 교정. 제품 UI/DB/API/버전 변경은 N/A.
- 리뷰 P1/P2 스레드에 수정 근거 답변 후 해결, 새 Head에서 main 충돌·최신 base 확인. 이전 Source SHA와 로그/원장은 원본으로 유지하고 재실행 결론을 덮어쓰지 않는다.
- 신규 exact Head commit 후 `pull_request.synchronize` **Full CI 시작을 실제 Run ID/Attempt로 확인**. 사용자 지시대로 CI 결과 모니터링 생략. 세 Required Quality/E2E6/Docker, Trusted QA, Owner HIGH 승인 전 **MERGE_READY=BLOCKED**.
- 위험: HIGH / OWNER_MANAGED / qa_required=true / manager_decision=NOT TESTED / release_required=false / release_authorized=false. PR 병합/Main CI/GHCR/정식 릴리스/Issue 종료 금지. Shadow 영향 분류의 실제 FN/FP·절감 시간은 INSUFFICIENT_DATA.
