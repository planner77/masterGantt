# Issue #726 — 누적 PR CI 실패 원장

> Source of Truth: [PR CI 실패 누적 분석 지침](PR_CI_FAILURE_TRIAGE.md). Primary Issue [#726](https://github.com/planner77/masterGantt/issues/726), 구현 PR [#743](https://github.com/planner77/masterGantt/pull/743). 2026-10-19 기준 최초 원격 실패 1건(F-001) 확인. 기존 원본 실패는 성공으로 재분류하거나 삭제하지 않는다.

## 1. 원격 실행/Attempt 전체 목록

| ID | GitHub Run / event | Head / Base / Test-merge(관측) | Required3 및 하위 Job | 원본 증거 |
| --- | --- | --- | --- | --- |
| F-001 | [#2982.1](https://github.com/planner77/masterGantt/actions/runs/39166340575), `pull_request.opened`, `CI`, 2026-10-18 UTC | Head `0035c48f6e107ec24647bb84d40081b0f9a4a348` / Base `6f6dadb1b3ac10bc837c09273a0922611b2e3f81` / PR metadata `merge_commit_sha=9885c30ed5e46ae5f70ba8bca2104d68d7b45714` (Run에서 독립 교차검증하지 않음) | Quality **SUCCESS** (job `117790677086`); Docker **SUCCESS** (`117790786498`); Chromium E2E **FAILURE** (`117791324057`); QA Final Automated **FAILURE** (`117791341838`, 파생) | [Shard 4 / job 117790363382](https://github.com/planner77/masterGantt/actions/runs/39166340575/job/117790363382), [Playwright report artifact](https://github.com/planner77/masterGantt/actions/runs/39166340575/artifacts/12150668332) |

### Shard 완료/실패/취소 구분

- Shard 4: 실제 테스트 **6 PASS, 1 FAIL**, 같은 shard의 149 tests **NOT RUN**; PR `--max-failures=1` 조기 종료.
- Shard 1/2/3/5/6: **CANCELLED** (PR matrix fail-fast); 이들 테스트를 PASS 또는 0개 실패로 계산하지 않는다.
- QA Final Automated 실패는 Required E2E `failure`에 따른 **파생 판정**이다. 정책/QA 자체의 독립 결함이라고 보지 않는다.
- `GitCommitInfo: timeout of 3000ms exceeded while running git fetch origin ...` 경고가 있었으나 테스트는 계속 진행되었으므로 최초 실제 FAIL의 원인으로 확정하지 않는다.

## 2. 누적 실패 파일·교차 분석

| 실패 ID / 경계 | 최초 원본 메시지와 위치 | 제품·테스트·환경 분류 | 보완 후보 및 잔여 위험 |
| --- | --- | --- | --- |
| F-001 — `tests/e2e/issue-726-task-logistics.spec.ts` / `#726 Task 공정 0..N·WorkArea self/subtree ...` | 343행의 `processLinks` 배열 deep equality: 실제 2개 UUID는 기대 2개와 **정확히 동일한 값·scope**이나 배열 순서만 반대 | **TEST_CONTRACT**. Fixture `createTargetProject`는 A→B 생성 순으로 UUID를 쌓지만 DB canonical reader `src/server/repositories/process-context-repository-core.ts`는 `ORDER BY p.public_id`로 읽음. 생성 순서가 UUID 정렬 순서일 보장은 없음. 저장 내용 유실·잘못된 scope 증거는 없음 | 기대/실제 쌍의 `processId`를 정렬한 뒤 객체 전체에 대해 exact deep equality. **중복/누락/scope 변화는 계속 실패**. Remote Chromium 전체/취소 shard의 잠재 다른 실패는 NOT TESTED. |

- Cross-run 현황: #726에 연결된 PR #743의 조회 가능한 `pull_request` Full 실행은 #2982.1 한 건. 최초 실패 전후 추가 원격 재실패 없음. 본 문서는 다음 실패 때 F-002를 추가해 전 이력을 보존한다.
- 실패 파일 합집합: `tests/e2e/issue-726-task-logistics.spec.ts` 1개. 추가 영향 소비자: `tests/e2e/logistics-target-authoring.spec.ts`, `tests/e2e/issue-726-logistics-master.spec.ts`, `tests/e2e/project-logistics-management.spec.ts`, `tests/e2e/project-task-editor.spec.ts`, #725 process-context 회귀. 이들 원격 실행은 shard 취소/미실행 가능성 때문에 모두 PASS라고 표시하지 않는다.

## 3. F-001 원인 분석·REWORK 및 반례

- [원본 로그](https://github.com/planner77/masterGantt/actions/runs/39166340575/job/117790363382)의 expected IDs: `ff70044c...`, `796ba350...`; actual IDs는 그 반대 순서다. 양쪽 `scope: self`, 두 행 존재; 원인 `TEST_CONTRACT`는 테스트가 저장소의 정렬 계약 대신 Fixture 생성 순서를 의존한다는 것.
- **수정:** `tests/e2e/issue-726-task-logistics.spec.ts`에서 direct processLinks는 순서 없는 관계 집합임을 명시하고 비교 대상의 복사본과 expected를 모두 `processId.localeCompare`로 정렬해 exact object equality를 수행. 원본 서버/공정 서비스, API, DB 정렬, CI fail-fast/timeout/retry/Assertion 수는 변경하지 않음.
- 반례: 별도의 Node v22.16.0 순수 비교 검사에서 ID 역순은 PASS, 중복 또는 다른 scope는 FAIL(정규화 비교에 대한 smoke만 확인). Playwright 앱/HTTP/SQLite의 실제 동작을 실행했다는 의미는 **아님**.
- 원격 실행 전 영향 검증: TypeScript/Playwright 직접 실행 **NOT TESTED**. 현재 실행 환경에는 Repository checkout·dependency·GitHub 네트워크가 없어 E2E 재현을 수행하지 못했다. 기존 #726 Work Packet의 11개 로컬 Chromium PASS는 **이전 코드/환경** 증거이지 새 Head의 CI PASS가 아니다.

## 4. 인계·다음 PR CI

- 저장소 원장과 Work Packet을 같은 PR 변경 묶음에 기록한다. `main` 정렬: 관측 `behind_by=0`, `base_sha=6f6dad...`; PR GitHub `mergeable=true`; Review threads **0**. PR 병합·GHCR·릴리스·이슈 종료는 이번 요청 범위 밖.
- 수정 후 새로운 `synchronize` Full PR CI를 시작하며 Required Quality/E2E/Docker와 Trusted QA, Owner ACCEPT는 새 Head에서 **NOT TESTED**이다. 사용자 지침대로 결과 완료 모니터링을 수행하지 않는다.
- 담당: Test contract 보완=구현 담당, Run/Shard/원장 원본 감사=Manager/infra, 실제 원격 판정 및 HIGH 잔여 위험 수용=후속 Owner.
