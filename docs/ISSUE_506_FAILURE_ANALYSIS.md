# Issue #506 / PR #803 — 누적 PR CI 실패 분석

Primary Issue: [#506](https://github.com/planner77/masterGantt/issues/506) | PR: [#803](https://github.com/planner77/masterGantt/pull/803) | 시작일: 2026-10-25
Source of Truth: [docs/PR_CI_FAILURE_TRIAGE.md](PR_CI_FAILURE_TRIAGE.md) 및 [Work Packet](exec-plans/active/ISSUE_506.md).
원본 실패를 삭제·덮어쓰기하거나 새 실행의 PASS로 소급하지 않는다. 동일 이슈의 향후 실패는 이 파일에 F-002부터 누적한다.

## 1. Run / Attempt 전체 목록 및 출처

| PR / Run | 날짜·이벤트 | 정확한 Source | 직접 FAIL / 인과 단계 | 결론 |
| --- | --- | --- | --- | --- |
| #803 · [Full Run #3264.1 / ID 40149276969](https://github.com/planner77/masterGantt/actions/runs/40149276969) · Attempt 1 | 2026-10-25 01:05:50Z~01:07:00Z, `pull_request` `FINAL_FULL` | Head `9ca412219c1d5efc26b691f3e553e51a2d395d9d`; Base `fcd1ae59d268efa1913f4de625a9013cabd1de4a`; test merge `6cde0bbce85ea845868aca4827473dfafa95598b`; branch `fix/issue-506-add-above-order-20261025` | QA Preflight `ISSUE_AC` 직접 FAIL → PR Fast Gate → Quality/E2E/Docker Required3 aggregate·Automated QA 파생 FAIL | **FAIL**, 제품/E2E/Docker **NOT RUN** |

- 동일 Head의 별도 `FAST_DEVELOPMENT` Run `40149276957`/Run #96.1은 Draft가 아닌 Ready PR이므로 **SKIPPED**; 공식 PR Full 성공 근거가 아니다.
- 원본 Source artifact `ci-pr-source-40149276969-1` ID `12581531469`, Preflight `qa-preflight-40149276969-1` ID `12581592382`, Automated QA `qa-final-automated-40149276969-1` ID `12581762393`, advisory `ci-impact-shadow-40149276969-1` ID `12582276901`; [Run artifacts](https://github.com/planner77/masterGantt/actions/runs/40149276969). 위 artifact들은 PASS 판정이 아니라 실패 출처/보고서다.
- 이번 시점 접근 가능한 PR #803의 Full failure 1건 확인. 구 `fix/issue-506-context-add-sibling-order` 브랜치에 PR 연결이 확인되지 않았고, 다른 Issue CI를 #506 실패로 합산하지 않는다. GitHub 기록의 접근 불가/향후 실행은 추정하지 않는다.

## 2. 원본 Job/Step 증거 및 파생 실패

| 구분 | GitHub Job ID | 원본 Step / 결론 | 판정 |
| --- | --- | --- | --- |
| 변경 경로 판정 | `121037170024` | success | PASS |
| QA Final 신뢰 경계 확인 | `121037170639` | success | PASS(보호 사전 경계, 최종 QA 아님) |
| **QA Preflight — 정책·문서 사전 검사** | **`121037223590`** | Step4 `원본 base SHA의 QA Preflight 실행 (read-only)`, `ISSUE_AC` FAIL | **직접 FAIL / POLICY_CI** |
| PR 빠른 검사 판정 | `121037282747` | Step3 `PR 필수 빠른 검사 결과 검증`, `PREFLIGHT_RESULT=failure` | 파생 FAIL |
| Quality Required aggregate | `121037331252` | Step2 병렬 quality 결과 집계 FAIL | 파생 FAIL |
| Chromium E2E Required aggregate | `121037331368` | Step2 E2E shard 결과 집계 FAIL | 파생 FAIL |
| Docker Required aggregate | `121037331357` | Step2 Docker 결과 집계 FAIL | 파생 FAIL |
| QA Final — Automated | `121037352474` | Step3 최신 PR 증거·문서·리뷰 확인; `required quality 미성공` | 파생 FAIL |
| 변경 영향 Shadow | `121037352430` | advisory-only success | PASS(실제 E2E/정식 품질 아님) |

- `Policy`, TypeScript, ESLint, Vitest, Next build, Chromium PR 8 shards 및 Docker smoke 구현 Job은 **SKIPPED / NOT RUN**. 무거운 테스트에서 실패 로그는 없고 결과를 PASS/FAIL로 꾸미지 않는다.
- Preflight Job 로그: `FAIL / ISSUE_AC: Issue #506 Acceptance Criteria — Primary Issue 본문에 AC1.. 식별자 없음`; FAIL 1 / DEFERRED 5, 나머지 risk/qa/release/path metadata PASS. [job 상세](https://github.com/planner77/masterGantt/actions/runs/40149276969/job/121037223590).
- 원본 실패 시점의 Issue에는 체크박스 수용 기준 13개가 있었지만 `AC1` 등 식별자가 없었다. trusted main `scripts/qa_preflight.py`는 Issue `\\bAC\\d+\\b`를 요구하므로 코드 이전 단계에서 차단되었다.
- 정적 후속 검사상, 기존 Work Packet의 `## AC_TEST_COVERAGE / TEST_LIFECYCLE_REVIEW` 결합 제목과 `- UPDATED ...` 형식은 `qa_final_automated.py::docs_gate`의 정확 `## AC_TEST_COVERAGE`, `## DOCUMENTATION_SYNC`의 `- \`file\`: UPDATED|N/A(reason)` 계약에도 불일치했다. 원본 Run에서는 AC 누락으로 해당 게이트가 실행되지 않았으므로 **미관측 잠재 실패**로 구분한다.

## 3. Cross-run 누적 실패 매트릭스

| ID·원본 | 원인 분류 / 당시 증거 | 보완 및 반례 | 새 HEAD·환경 검증 | 잔여 위험 |
| --- | --- | --- | --- | --- |
| F-001 · #803 Full #3264.1 / Preflight `ISSUE_AC` | **POLICY_CI**: Primary Issue AC 번호 부재. 당시 Work Packet 정형 section/문서 entries 부족도 독립적 구조 보완 대상 | Issue 원문 AC 13개를 AC1~AC13으로 정확 번호 부여, Work Packet 정확 `## AC_TEST_COVERAGE`와 13개 일대일 테스트 매핑, `## DOCUMENTATION_SYNC` 항목별 UPDATED/N/A 및 근거 정비 | 변경된 Issue 원문·Work Packet의 구조 정적 검증; 원격 Preflight/Full은 **NOT TESTED** | 새 Head trust Main Preflight 재실행 필요 |
| R-001 · [Review P1 #4369186957](https://github.com/planner77/masterGantt/pull/803#discussion_r4369186957), E2E #506 helper | **TEST_CONTRACT / 직접 CI 실패 아님**: `data-task-id=":<UUID>"` vs `taskId="<UUID>"`, `.filter()` 빈 결과 | 차트 bar `data-task-id`를 먼저 `.replace(/^:/, "")` 정규화하여 정렬·결과 동일 ID 비교. 기존 `projection-settled.ts` 경계와 일치 | Chromium은 이전 Run에 **NOT RUN**, 새 실행 필요 | 실제 viewport/virtualized bar/summary visibility 및 완전 E2E 미검증 |

- **누적 직접 실패 테스트 파일 합집합**: Preflight `scripts/qa_preflight.py::ISSUE_AC` / `scripts/qa_final_automated.py::docs_gate` 계약(후자는 사전 예방 발견; 원본 실행 실패 아님), P1 리뷰 `tests/e2e/task-context-menu-hierarchy.spec.ts::expectRenderedSiblingOrder` (미실행).
- **직접/인접/음성 회귀**: `tests/server/projects/task-hierarchy-command-service.test.ts`(root/nested/DB 순서), `tests/features/gantt/canonical-snapshot-sync.test.ts`(existing next-before/after), `tests/features/gantt/canonical-sync-execution.test.ts`(first-child/collapse), `tests/features/gantt/project-task-adapter.test.ts`(parent 매핑), #506 Chromium helper·scoped/root/reload, 기존 #373/#399/#407/#418 selection/readonly/scope. 모두 새 Head 실제 실행 전 **NOT RUN**.
- 재실행 횟수 0, Failures 1 original CI + review P1 별도; 실패 Job만 rerun하지 않고 **수정된 새 Head의 Full PR CI**로 전체 검증을 시작한다.

## 4. 코드·문서 교정, QA/Conflict 인계

- 수정 경로: Issue #506 AC 13개 라벨, `docs/exec-plans/active/ISSUE_506.md`의 표준 13항목/문서 기록, `tests/e2e/task-context-menu-hierarchy.spec.ts`의 Chart ID 정규화, 누적 본 문서, `CHANGELOG.md`·`docs/exec-plans/active/PLAN.md` 재작업 인계. `src/features/gantt/canonical-snapshot-sync.ts` 제품 변경 자체는 보존. `AGENTS.md`/ `DESIGN.md`·CI/QA·Ruleset/timeout/retry/shards 변경 없음.
- QA 리뷰: PR #803 review thread `PRRT_kwDOUUB7Bc6v9QU_` (P1) 1건 발견. 위 원인 교정 commit에 반영 후 reply·resolve 재검증 대상. 리뷰 스레드 해결은 자동 QA/Owner ACCEPT가 아니다.
- 첫 Run 당시 GitHub `main=fcd1ae59d268efa1913f4de625a9013cabd1de4a`, branch compare `ahead=2 behind=0`, PR `mergeable=true`였다. 새 commit 이후 main/base/충돌 및 미해결 스레드 다시 확인해야 한다.
- 저장소 연결 API에서 source·policy 정적 확인만 가능하며 실행 가능한 로컬 Next/Chromium 환경 또는 Node module checkout은 없음. `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, Docker와 Owner/Trusted QA는 **NOT RUN**.
- 위험 `HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=false`; 기존 v0.133.0 immutable tag 보존, 후보 v0.133.1. Full CI/Trusted QA·Owner 버전 승인 전 `MERGE_READY=BLOCKED`.

## 5. 새 Source 검증과 다음 PR CI

- 변경 의도: #506 API/DB/권한 불변, root/middle/nested의 정확 sibling 위치/Chart ID 단언을 *완화하지 않고* 정정.
- 시뮬레이션/정적 검사와 실제 CI는 별개: trusted `qa_preflight`와 `docs_gate` 구조식에 대한 원문 검증만 확인, 원격 PASS는 다음 Run 완료 전 미확인.
- 최종 code/document HEAD, 새 CI Run ID·Attempt, 리뷰 해결/충돌 상태는 해당 게시 단계의 결과로 Work Packet 또는 원장에 추가 기록한다. CI 모니터링·병합/Main/GHCR/Issue 종료는 이번 지시 범위 밖이다.
