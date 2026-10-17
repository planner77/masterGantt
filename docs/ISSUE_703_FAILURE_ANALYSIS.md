# Issue #703 / PR #705 — PR CI 연속 실패 분석 원장

공통 Source of Truth: [PR CI 실패 전체 이력 기반 REWORK](PR_CI_FAILURE_TRIAGE.md) (Issue #704). 이 문서는 정규 파일 `docs/ISSUE_<N>_FAILURE_ANALYSIS.md`의 #703 단일 원장이다.

이 문서는 CI 재발 시 **직전 실패만 고치지 않고 누적 실패/연쇄 취소/테스트 미실행을 구별**하기 위한 재사용 가능한 기록입니다. 원본 실패는 수정 후에도 실패 이력으로 남깁니다. 첫 기록: 2026-10-17 KST.

## 1. 원본 증거와 대상

- Repository: planner77/masterGantt, [Issue #703](https://github.com/planner77/masterGantt/issues/703), [PR #705](https://github.com/planner77/masterGantt/pull/705)
- [PR CI Run #2880.1](https://github.com/planner77/masterGantt/actions/runs/39009485784), Run ID 39009485784, Attempt 1, 결과 FAILURE.
- 원본 HEAD `9dd6f5c407dcb8417bf8b82b57a941d0ca8dcb26`; Base `de863713142a92f1cac56dbae044923822bca932`; Test-merge `75e9ef89ecdd06111a3bdd16ad14e33ec50db73f`.
- 직접 실패 Job: QA Preflight Job ID `117328744098`. 부수 실패: PR Fast Gate `117328782189`, QA Final `117328828548`.
- Preflight artifact: `qa-preflight-39009485784-1` (artifact ID 12092715042); 원본 진단 `FAIL: 1 / DEFERRED: 5`. QA Final 출력은 `required quality 미성공`이다.

## 2. 실패 원장 (다음 실패 시 행을 추가)

| 원본 Run/Attempt | 원본 SHA·Base | 최초 직접 FAIL | 연쇄 실패와 실제 미실행 | 수정 및 검증 |
| --- | --- | --- | --- | --- |
| [39009485784.1](https://github.com/planner77/masterGantt/actions/runs/39009485784) | `9dd6f5c…` / `de863713…` | QA Preflight `DOCUMENTATION_SYNC — DOC_SYNC 기록 누락` | PR Fast Gate FAILURE; Policy/TypeScript/ESLint/Vitest/Next Build/E2E shards/Docker smoke SKIPPED; 세 Required Aggregate 및 QA Final FAILURE | Work Packet 정형 문서/AC 매핑 및 동일 QA 계약 회귀 추가; 새 Head 원격 결과 전 NOT TESTED |

### 직접 실패의 근거

원본 Preflight 출력은 다음과 같다.

~~~text
FAIL / DOCUMENTATION_SYNC:
docs/exec-plans/active/ISSUE_703.md:
DOCUMENTATION_SYNC / AC_TEST_COVERAGE — DOC_SYNC 기록 누락
~~~

원본 Work Packet의 `## DOCUMENTATION_SYNC`에는 `UPDATED: AGENTS.md, ...`처럼 일반 서술과 일반 표만 존재했습니다. 신뢰된 main의 `scripts/qa_preflight.py`는 `scripts/qa_final_automated.py::docs_gate`를 호출하며, **일반 서술은 유효한 DOC_SYNC 행이 아닙니다**. 검증기가 요구하는 구조는 다음과 같습니다.

~~~markdown
## DOCUMENTATION_SYNC
- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(이번 작업에서 기존 QA 계약은 변경하지 않음)
...

## AC_TEST_COVERAGE
- AC1: 실제 관련 구현/테스트와 원격 미검증 경계를 기록
...
- AC8: 실제 관련 구현/테스트와 원격 미검증 경계를 기록
~~~

`docs_required(paths)`가 요구하는 전체 문서 합집합을 다룹니다. CI·Workflow·스크립트를 변경했으므로 `QA_DOCS`인 `AGENTS.md`, `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`, `docs/GITHUB_OPERATIONS.md`, `docs/REMOTE_VALIDATION.md`는 모두 대상입니다. `UPDATED`는 실제 PR diff에 존재해야 하며 `N/A(reason)`는 구체적인 이유를 써야 합니다. Issue AC1~AC8 각각 `- ACn:` 정규식 한 행이 필요합니다.

**변경: Work Packet 기록과 구조 회귀만 보완. Preflight 검증기/Required Gate/6-shard/Timeout은 약화하지 않음.**

### 연쇄 실패 분리

| 분류 | 원본 결과 | 해석 |
| --- | --- | --- |
| 변경 경로 판정 | SUCCESS | 경로 분류 성공 |
| QA Preflight | FAILURE | 문서 계약 직접 FAIL 1건 |
| PR Fast Gate | FAILURE | `PREFLIGHT_RESULT=failure`, 다른 빠른 검사 job skipped에 따른 올바른 차단 |
| Policy·TypeScript·Lint·Unit·Build | SKIPPED | 소스 검사 실행되지 않음. 실제 PASS도 제품 FAIL도 아님 |
| Chromium E2E(6개 shard)·Docker smoke | SKIPPED | 실제 테스트 미실행. timeout/flaky/제품 결함 주장 금지 |
| Quality·E2E·Docker Required aggregate | FAILURE 3건 | 보안상 fail-closed 집계이며 자체 원인 아님 |
| QA Final Automated | FAILURE | required quality 미성공의 전파; QA/Owner 승인 아님 |

PR #705 자동 Code Review Summary는 원본 Head에서 `status=failed, has_unresolved_findings=true`를 표시했으나 GitHub inline review thread 조회는 **0건**입니다. 별도 봇 댓글은 Codex code-review 사용 한도 도달을 알립니다. 이를 “보안 검토 완료”로 간주하지 않습니다. 실제 스레드가 생기면 다시 분류합니다.

## 2.1 Cross-run 실제 실패 집합 및 재검증

| 실패 ID · Job | 실제 첫 실패 / 조건 | 확정 원인 분류 | 새 최종 Source 확인 범위 |
| --- | --- | --- | --- |
| F-001 · PR #705 / 39009485784.1 / QA Preflight 117328744098 | `ISSUE_703.md` 비정형 `DOCUMENTATION_SYNC` → `DOC_SYNC 기록 누락` | `POLICY_CI` / 정형 문서 계약 위반 | trusted `qa.docs_gate`에 대한 문서/AC 매핑 positive·negative와 새 원격 QA Preflight. 결과 확인 전 NOT TESTED |

- **실제 실패 테스트 파일의 누적 합집합:** 없음. 최초 Run은 Preflight에서 E2E/Unit/Docker를 시작하지 않아 **테스트 성공 0건이 아니라 미실행 상태**다. 이후 Run의 직접 실패 파일·Case·Shard가 확인되면 표에 누적한다.
- **비최종 CI 시도:** 수정 Head `9b2d90148263504b6e330570416b6677642c6d97`의 Run `39010283771.1`은 과거 base를 기준으로 생성됐으나 이 사이 main이 #704 포함 10커밋 전진하였다. 해당 Run은 사용자의 CI 모니터링 생략 지시에 따라 최종 상태를 확인하지 않았으므로 실패·성공 어느 쪽으로도 재분류하지 않는다.

## 3. 원인 보완·증거 상태

- `docs/exec-plans/active/ISSUE_703.md`에 `## DOCUMENTATION_SYNC` 표준 파일별 `UPDATED/N/A(reason)`와 `## AC_TEST_COVERAGE`의 AC1~AC8 검증 맵을 보완.
- `tests/python/test_preview_publish.py`에 신뢰된 base `qa.docs_gate`와 동일 문서 구조의 positive/negative 회귀를 추가. 특정 문서 누락을 허용하는 테스트 완화가 아니라 원본 검증기를 실제 호출하는 방식.
- 본 분석 원장에 원본 Run ID/Attempt와 Job/최초 실패/연쇄 skipped/미검증 및 Source SHA를 불변으로 남김.
- 본 시점 실제 로컬 Python/Node/Docker 테스트 실행 증거는 **NOT TESTED**. 새로운 PR CI가 시작되어도 완료 성공은 별도 확인 전 NOT TESTED.
- Preview Registry 인증/태그 404, Docker archive/OCI digest 및 이식성, 3개 Run 절감효과는 **실제 Preview workflow main 반영 이후** 검증할 후속 실험이며 원본 CI 실패와 구별.

## 4. 향후 2회 이상 실패 시 반드시 재사용할 절차

1. **동결**: PR 최신 HEAD/Base/Test-Merge, Run ID/Attempt와 main SHA, 작업 파일 fingerprints 확인. Run이 취소되었어도 실제 Job/Trace에 기록된 테스트 FAIL은 따로 보존.
2. **누적 합집합**: 이 문서의 모든 과거 Run과 신규 Run을 함께 나열하고 직접 FAIL한 파일/Step/Assertion·환경·정책과 연쇄된 Required 집계, SKIPPED를 분리. 직전 Run 로그만 보고 원인을 단정하지 않음.
3. **유형별 분류**: 제품 결함, 테스트 fixture/contract, 환경·설치/transport, 정책/문서, source/base stale, 뒤따른 취소·집계 실패로 구분하며 정확한 Job 로그 링크를 붙임.
4. **일괄 보완**: 근거 있는 직접 오류를 모아 원인별로 수정; 합집합의 대상 테스트와 인접/교차/음성 소비자를 같은 고정 Source로 검증. Skip·Assertion 완화·timeout 일괄 증가는 금지. 중간 변경마다 CI를 반복 발생시키지 않도록 수정·문서를 묶어 최종 Push.
5. **세 단계 재검증**: (a) Work Packet `docs_gate`/Preflight 구조 검사 (b) 수정 관련 Policy·Python/Unit/E2E 진단과 교차 회귀 (c) 정확 HEAD/Base의 공식 Required Quality/E2E/Docker. 로컬 미실행은 NOT TESTED이며, 전 Run의 성공을 새 Head에 승계하지 않음.
6. **PR 점검 후 새 CI**: 현재 main 대비 branch behind=0, mergeable=true, 미해결 리뷰 스레드 0, canonical Refs #703·HIGH/OWNER_MANAGED, QA 문서·AC 계약을 확인한 후 정확 새 SHA의 PR CI 생성/시작 근거를 기록. 사용자가 CI 모니터링 생략을 요청하면 Run 시작까지만 보고.
7. **원장 업데이트**: 새 Run 별 Head/Base/Test-Merge, 실패+취소 shard 전체, 제품/계약/환경/정책 유형, 변경 SHA, 결과 및 여전히 NOT TESTED인 검증을 한 행씩 누적. 기존 실패 Run을 PASS로 덮어쓰거나 정식 GHCR/Finalizer를 호출하지 않음.

## 5. 다음 Run에서 먼저 볼 항목

- main #704의 공통 누적 원장을 먼저 읽고 이 문서의 모든 F-ID를 비교한 뒤 새 실패를 추가한다.

- QA Preflight `DOCUMENTATION_SYNC` 성공 여부 → 이번 수정의 직접 회귀 판정.
- 이전에 실행되지 않은 Policy 단계의 `test_preview_publish.py` (새 정책 회귀), Vitest/TS/ESLint, Chromium E2E6 및 Docker의 **최초 실제 오류**를 기록.
- 새로운 Codex 리뷰 스레드가 있다면 코드·문서에 필요한 변경을 반영하고 스레드 해결, 이후 새 HEAD에서 재검증.
- GHCR Preview 실제 게시/정식 Release는 이번 PR CI 요청 범위를 벗어나며 별도 Owner 지시와 검증이 필요.

## 6. 2026-10-17 전 이력 재확인 — #2883, #2884, #2891 추가 기록

**확정 근거 범위:** #2880.1·#2883.1·#2884.1·#2891.1의 GitHub Actions Run, Job/Step, 실패 Shard의 Playwright HTML·trace/격리 서버 진단 첨부를 교차 조회했다. 원본 Run의 성공·실패·취소를 변경하거나, 다른 Source SHA의 PASS를 새 후보의 성공 증거로 승격시키지 않는다. 이 절은 기존 F-001 원장을 삭제하지 않고 후속 증거로 확장한다.

### 6.1 Run/Attempt·Source·필수 Gate 누적 비교

| Run/Attempt / 원본 Head·Base | 직접 실패·성공 결과 | 연쇄·원본 자료 |
| --- | --- | --- |
| [#2880.1 / 39009485784](https://github.com/planner77/masterGantt/actions/runs/39009485784), Head `9dd6f5c407dcb8417bf8b82b57a941d0ca8dcb26` / Base `de863713142a92f1cac56dbae044923822bca932` | **POLICY_CI F-001:** QA Preflight DOCUMENTATION_SYNC 불일치 | Fast Gate/Required3/QA Final 실패, 제품 Unit/E2E/Docker 실제 미실행. 기존 수정을 F-001에 보존 |
| [#2883.1 / 39010283771](https://github.com/planner77/masterGantt/actions/runs/39010283771), Head `9b2d90148263504b6e330570416b6677642c6d97` / Base `de863713142a92f1cac56dbae044923822bca932` | **INIT_TRANSPORT F-002:** Chromium Shard5/6 Job `117331520973`의 `milestone-stage-exchange.spec.ts:132`에서 canonical GET `ECONNRESET`. Shard5 22 PASS/1 FAIL/60 NOT RUN | Run 전체 결론 `cancelled` (후속 synchronize). 그러나 Shard5의 **실제 FAIL**은 보존. 다른 Shard들의 취소는 테스트 실패로 간주하지 않음. [원본 HTML/Trace](https://github.com/planner77/masterGantt/actions/runs/39010283771/artifacts/12092861934) |
| [#2884.1 / 39010698270](https://github.com/planner77/masterGantt/actions/runs/39010698270), Head `cb8a9751791bbf61d21ee73b719513dff6514abe` / Base `78ec8d2ced62f543f73a8477c3e62fca8274274b` | **SUCCESS:** Preflight/Policy/Typecheck/ESLint/Vitest/Build, Chromium E2E6/6, Docker, QA Final/Trusted 검증 성공 | 성공은 이 정확 Head/Base의 반례 증거만 해당. F-002 원본 실패를 삭제하지 않고, #2891의 후속 상태와 합산 금지 |
| [#2891.1 / 39019744531](https://github.com/planner77/masterGantt/actions/runs/39019744531), Head `e2281c7e2aa7ba7e4081d10f1e6fa33ce5ce60c9` / Base `4307c8cdf1cc00a87fd7bff9f5e1a0c924bb3620` / Test-Merge `7396858cb331d6e5da0aba226958b8db9c280a60` | **INIT_TRANSPORT F-003:** Chromium Shard3/6 Job `117359396203`, `issue-623-resource-mvp.spec.ts:44` → `tests/e2e/fixtures/target-project.ts:48`의 canonical GET에서 `ECONNRESET`. Shard3 40 PASS/1 FAIL/49 NOT RUN | Policy/Quality/Docker/Build PASS, Shard1/2/4/5/6 `CANCELLED` by PR fail-fast, E2E aggregate 및 QA Final 실패. [원본 HTML/Trace/진단](https://github.com/planner77/masterGantt/actions/runs/39019744531/artifacts/12095994618) |

### 6.2 두 전송 오류의 실제 생존·메모리 증거

- **F-002 #2883 Shard5:** 기존 `observeIsolatedApi`가 첫 실패를 관측한 뒤 남긴 첨부 `isolated-application-diagnostics`에 `api_transport_failure`, `GET /api/projects/[publicId]`, `failure=ECONNRESET` 기록. 수집 당시 별도 Health 조회 **HTTP 200**, 격리 Next 실행 프로세스 **alive=true, exitCode=null, signal=null**. 관측된 `memory.events oom=0, oomKill=0`, cgroup currentBytes 약 **11.17GB** (maxBytes 미확인). **서버 종료/OOM이 직접 원인이라고 확인되지 않았음**.
- **F-003 #2891 Shard3:** 당시 실패한 `target-project.ts`의 `snapshot()`은 `page.request.get(api)`를 직접 호출하므로 최초 GET의 Observer 출처를 남기지 못했다. 그러나 실패 직후 Test failure 첨부의 격리 서버 실행 프로세스는 **alive=true, exitCode=null, signal=null**, 별도 Health **HTTP 200**, 관측 cgroup `oom=0, oomKill=0`·현재 사용량 약 **11.58GB** (한계값 미확인). 따라서 read ECONNRESET은 실제 전송 실패이며 **OOM/죽은 서버/DB 커밋 오류로 단정하지 않는다**. 기존 모든 작업 저장 단언은 그대로 유지한다.
- **Cancelled Shards:** #2891 Shard1/2/4/5/6 로그의 종료 시점까지 추가적인 실제 `✘`/Playwright FAIL은 식별되지 않았다. Shard1의 `Controlled E2E error boundary probe` 메시지는 해당 테스트의 의도된 오류 경계 시험 로그로서 별도 실패로 분류하지 않는다. 취소 이후 미실행 케이스는 `NOT RUN`이며 성공으로 계산하지 않는다.
- **공통 유형:** 실제 두 오류 모두 개발용 격리 Next 서버의 loopback **read-only canonical GET**에서 발생했다. 소켓 재사용·일시적 전송 단절은 가능한 가설이지만 trace만으로 네트워크/Next 메모리·GC 원인은 확정되지 않는다. 제품 코드의 데이터 정합성 실패(HTTP 비200 또는 Snapshot 불일치) 증거는 없다.

### 6.3 Cross-run 실패 합집합 및 교정 기준

| ID | 직접 실패 파일/계약 | 확정 원인 / 미확정 근인 | 이번 후보의 직접·교차·음성 재검증 |
| --- | --- | --- | --- |
| F-001 | `docs/exec-plans/active/ISSUE_703.md` 구조 `docs_gate` | `POLICY_CI` 형식 누락 확정, 보완 후 #2884/#2891 Preflight 성공 | 기존 `test_preview_publish.py::test_issue_703_work_packet_preflight_contract` 유지. 파일별 DOCUMENTATION_SYNC/AC1~8 검증 삭제 금지 |
| F-002 | `tests/e2e/milestone-stage-exchange.spec.ts` canonical read `GET /api/projects/{id}` | `INIT_TRANSPORT` 리셋 확인, 프로세스/소켓 근인 UNKNOWN | 첫 GET은 기존 observer가 진단 확보 → `ECONNRESET`일 때만 두 번째 read-only GET 최대 한 번. 같은 응답 HTTP200/revision/Task/멤버십·Import/Export/Copy/Template 단언 유지 |
| F-003 | `tests/e2e/issue-623-resource-mvp.spec.ts` → `tests/e2e/fixtures/target-project.ts` Snapshot GET | `INIT_TRANSPORT` 리셋 확인, 관측 누락이 별도 위험 | `seedIssue623`에서 실제 `observeIsolatedApi` 전달 → Snapshot GET 첫 실패의 process/health/cgroup 진단 보존 → 동일 오류에만 두 번째 GET 최대 한 번; Resource/Target/Assignment·WBS 6개 write exact/revision·Core instance 단언 유지 |
| Positive | #2884 E2E 6/6 | 동일 기능 정상 실행의 반례, 이번 Source의 PASS는 아님 | 변경과 무관한 테스트 일부 정상 PASS를 다중 Head의 신규 전체 성공으로 재해석하지 않음 |

**실제 실패 파일 논리적 합집합:** `docs/exec-plans/active/ISSUE_703.md`, `tests/e2e/milestone-stage-exchange.spec.ts`, `tests/e2e/issue-623-resource-mvp.spec.ts` 및 직접 소비자 `tests/e2e/fixtures/target-project.ts`. 교차 영향 `tests/e2e/fixtures/issue-623-target-resource.ts`, `tests/e2e/fixtures/isolated-application-diagnostics.ts`, `tests/e2e/issue-621-resource-target.spec.ts`(기존 fixture 기본 동작), 단위 `tests/scripts/isolated-readonly-get.test.ts`. 취소된 Shard의 다른 제품 테스트는 수집되지 않은 미실행 후보이며 실제 실패 파일로 확대하지 않는다.

### 6.4 한정적인 교정·기본 계약 불변

- 기존 검증기를 수정하거나 정책 Gate·Playwright Shard/fail-fast/retries/timeout을 변경하지 않는다.
- 신규 `observedReadOnlyGet`는 **같은 관측기**를 통한 첫 GET 오류 기록 후, 정확히 `Error.message`의 `ECONNRESET`에 한해서 **두 번째 GET 1회**만 실행한다. 첫 오류의 진단 정보는 이미 별도 첨부에 남는다. 두 번째도 실패하면 기존 오류를 숨기지 않고 FAIL.
- `tests/e2e/fixtures/target-project.ts`는 **Observer 옵션이 전달된 #623 사례**에만 이 교정을 적용한다. 인수 없이 사용하는 기존 #621 및 타 소비자의 원래 Snapshot 동작은 그대로 유지한다. POST/PUT/PATCH/DELETE 재전송 금지, HTTP4xx/5xx/비정상 JSON/assertion/ETIMEDOUT/ECONNREFUSED는 재시도하지 않는다.
- `tests/e2e/milestone-stage-exchange.spec.ts`는 기존 observer를 새 공통 bounded-read helper로 교체하며 의도된 기능 Assertion·Milestone/Stage UI·실제 server transaction 상태는 변경하지 않는다.
- `tests/scripts/isolated-readonly-get.test.ts`의 정상 GET 1회, 첫 Reset 후 관측/2회, 두 번째 Reset FAIL, HTTP 404/409/503 및 timeout·타 오류·non-Error 실패의 **positive/negative** 계약을 PR Quality Vitest에서 실행한다.
- 기존 #680 [ECONNRESET 한정 복구 선례](exec-plans/active/ISSUE_680.md)와 일치한다. **재시도 성공은 원시 전송 오류의 근본 원인 해결을 입증하지 않는다**. OOM/메모리 상승·Next dev 워커 교체·keep-alive·runner 동시성의 인과는 향후 증거가 있을 때만 별도 진단한다.

### 6.5 완료 기준과 남은 증거

- 이번 후보 변경의 실제 로컬 E2E/Node 환경은 가용 환경의 부재로 **NOT TESTED**. 문서/소스 정적 검사는 실행 여부와 구분한다.
- 새 전체 PR CI에서 F-001 Preflight/Quality·F-002·F-003 직접 사례와 6개 Shard/Docker가 정확 Head/base/test-merge에서 성공해야 PASS. 다음 CI Run이 새로 시작되었다는 것만으로 수용하지 않는다.
- 재발 시 **이 문서 F-001~F-003 전체**를 읽고 모든 후속 Run/Attempt·취소된 Shard의 실제 오류를 추가한 뒤, 두 E2E 파일/공통 fixture/간접 소비자의 전체 실패 합집합으로 진단한다. Timeout 일괄 증가·Skip·Assertion 완화·무관 이슈 자동 생성 금지.
- 리뷰 thread 0·main 정렬·병합 충돌 해결 확인은 CI 실행 전 재확인한다. 사용자가 요청한 마지막 작업은 새 PR CI **시작**이며 그 후 자동 모니터링/병합/GHCR 게시/Issue 종료는 수행하지 않는다.


## 7. #2894 성공 반례와 #2896 F-004 (2026-10-17)

본 누적 분석은 #2896만 보는 방식이 아니라 기존 F-001(DOC_SYNC), F-002(#464 GET ECONNRESET), F-003(#623 GET ECONNRESET) 및 #2884 성공까지 모두 대조한다. 이전 실패 Run·가설과 원인은 변경하지 않고 이번 사건을 추가한다. Source of Truth는 [#704 전 이력 분석 지침](PR_CI_FAILURE_TRIAGE.md)이며, 이 파일 외 다른 #703 원장을 만들지 않는다.

### 7.1 Run/Attempt 및 Cross-run 매트릭스

| 원본 Run / Head·Base | 직접 FAIL 또는 성공 반례 | 연쇄 Job·실행 여부 |
| --- | --- | --- |
| [#2880.1 / 39009485784](https://github.com/planner77/masterGantt/actions/runs/39009485784), Head `9dd6f5c407dcb8417bf8b82b57a941d0ca8dcb26` | F-001: Preflight `DOCUMENTATION_SYNC` 형식 누락. 원인은 위 `2.`와 `6.` 참조 | Required aggregates/QA Final 파생 실패, 실제 Unit/E2E/Docker NOT RUN |
| [#2883.1 / 39010283771](https://github.com/planner77/masterGantt/actions/runs/39010283771), Head `9b2d90148263504b6e330570416b6677642c6d97` | F-002: Shard5 `milestone-stage-exchange` canonical GET `ECONNRESET` | 전체 Run CANCELLED이나 Shard5에는 실제 22 PASS/1 FAIL |
| [#2884.1 / 39010698270](https://github.com/planner77/masterGantt/actions/runs/39010698270), Head `cb8a9751791bbf61d21ee73b719513dff6514abe` | 동일 Issue 정상 반례: 6-shard E2E, Quality/Docker/Trusted QA SUCCESS | 정확 당시 SHA/Base에만 유효 |
| [#2891.1 / 39019744531](https://github.com/planner77/masterGantt/actions/runs/39019744531), Head `e2281c7e2aa7ba7e4081d10f1e6fa33ce5ce60c9` | F-003: Shard3 `issue-623-resource-mvp` Snapshot GET `ECONNRESET` | 40 PASS/1 FAIL/49 NOT RUN, 5 Shard CANCELLED |
| [#2894.1 / 39021666390](https://github.com/planner77/masterGantt/actions/runs/39021666390), Head `c7a40d37f1b20c0f50fdc009f70e518d95b6541f`, Base `4307c8cdf1cc00a87fd7bff9f5e1a0c924bb3620` | 정확 해당 Head에서 Quality/Docker/6-shard E2E/QA Final SUCCESS, [Trusted QA #536](https://github.com/planner77/masterGantt/actions/runs/39023096156) SUCCESS | 성공은 후속 #2896의 승인 증거가 아니며 실패 이력 소급 변경 금지 |
| [#2896.1 / 39026038481](https://github.com/planner77/masterGantt/actions/runs/39026038481), Head `bdb550d96c688997443b4b4bbae37dc24235b245`, Base `c0eca9ad5bfdb6c14d98dec7c5cfd7256e4619d7`, Test-Merge `597a6b03d36d74378245b5fc5fdc8a1d1e21ed82` | **F-004 (INIT_TRANSPORT):** Shard3/6 Job `117377441664`, `issue-621-resource-target.spec.ts:92` → `fixtures/target-project.ts:54`에서 canonical GET `apiRequestContext.get: read ECONNRESET` | 39 PASS/1 FAIL/53 NOT RUN; 다른 5 Shard CANCELLED. Preflight/Policy/Typecheck/ESLint/Vitest/Build/Docker PASS, E2E aggregate 및 QA Final은 파생 FAIL |

### 7.2 F-004 실제 오류와 근인 분리

- [Shard3 Playwright 원본 Trace/diagnostics](https://github.com/planner77/masterGantt/actions/runs/39026038481/artifacts/12097868890)에서 첫 요청 `GET /api/projects/{publicId}`의 `ECONNRESET`을 확인했다. 당시 `target-project.ts`의 분기 `observeApi ? observedReadOnlyGet(...) : page.request.get(api)`는 #621의 `seedIssue621(page, origin)`에서 observer를 전달하지 않아 **직접 비관측 GET**을 수행했다. F-003 보완이 #623에만 연결되고 #621·#622 및 추가 직접 소비자를 빠뜨린 것은 코드에서 확인되는 보완 범위 누락이다.
- 첨부된 격리 서버의 `reason=test_failure`와 `requests=[]`는 당시 첫 오류에 observer가 없었음을 뒷받침한다. 실패 직후 Child process `alive=true`, `exitCode=null`, `signal=null`, 별도 Health HTTP **200**, cgroup `oom=0`/`oomKill=0`/`currentBytes=10,330,116,096`/`maxBytes=null`. 서버가 죽거나 OOM이라고 **확정할 수 없고**, 실제 TCP/Socket/Next 전송 근인은 `UNKNOWN`이다.
- #2896 E2E 이외 필수 Quality/Docker가 성공했고 후속 QA Final이 `required e2e 미성공`으로 실패했다. 다른 shard의 CANCELLED를 독립 PASS/FAIL로 처리하지 않는다. 위 F-002·F-003과 같은 read-only canonical GET류이나 물리적 근인이 같다고 확인되지는 않았다.

### 7.3 누적 실패 합집합과 원인별 일괄 보완

| 실패 ID | 원본 실제 실패 경로 | 새 동결 후보에 필요한 검증 |
| --- | --- | --- |
| F-001 | `docs/exec-plans/active/ISSUE_703.md` DOC_SYNC | Preflight 구조·AC 및 기존 `test_preview_publish.py` 유지. #2884·#2894·#2896 Preflight 성공 |
| F-002 | `tests/e2e/milestone-stage-exchange.spec.ts` GET | 기존 observer→`observedReadOnlyGet`와 Milestone·Import/Export·Copy/Template 업무 단언 불변 |
| F-003 | `tests/e2e/issue-623-resource-mvp.spec.ts` → `target-project.ts` GET | #623 두 E2E와 변경된 seed 인수, revision·Target·Assignment·WBS 6 mutation 단언 불변 |
| **F-004** | `tests/e2e/issue-621-resource-target.spec.ts` → `issue-621-target-project.ts` → `target-project.ts` GET | **#621의 5개 테스트 + 동일 seed를 사용하는 #622 한 개**를 포함해 관측 인수 필수화 |

**종합 수정:** `createTargetProject(page, origin, observeApi: ObserveIsolatedApi)`, `seedIssue621(page, origin, observeApi, wide?)`, `seedIssue623(page, origin, observeApi, wide?)`에 **mandatory observer**를 지정한다. 해당 fixture의 모든 직접·간접 E2E 소비자(#621 5, #622 1, #623 2, Target authoring 7, Resource Dashboard API 1)를 수정하며, 총 16개 테스트가 TypeScript 인수 검증의 보호를 받게 한다. 서버 요청은 기존 URL을 사용하고, 진단용 route는 `/api/projects/{publicId}`처럼 상대 경로를 전달하여 개인정보 없는 canonical route로 분류되게 한다. `tests/scripts/isolated-readonly-get.test.ts`에 해당 route 정규화의 Unit 검증을 추가한다.

**불변 안전 경계:** 정확 `ECONNRESET` 후 read-only GET **최대 한 번** 재조회. 관측기는 첫 실패를 진단 후 재throw한다. HTTP4xx/5xx·malformed JSON·2차 RESET·다른 transport 오류는 원래 FAIL. POST/PUT/PATCH/DELETE 재전송 금지. 기간·E2E timeout/retry/fail-fast/6-shard·기존 모든 도메인 Assertion·QA/Owner/Main/GHCR/Finalizer·정식 Release Gate 변경 없음.

**선정 교차 검증:** 직접 F-001~004 관련 Unit·Preflight, E2E #621 5/#622 1/#623 2·#464 1, 인접 Target Authoring 7·Resource API 1와 기존 비수정 Gantt/Target consumers. 새로운 remote 정확 SHA·base·test merge의 Required Quality/E2E6/Docker와 Trusted QA는 완료 전 `NOT TESTED`. 로컬 Node/npm/Chromium 실행 또한 실제 수행하지 않았다면 `NOT TESTED`이다.

**재실패 시** 이 문서 F-001~F-004와 모든 정상/취소 Run을 다시 읽고 이전 전체 실제 실패 파일 합집합 + 신규 원인을 한 원장에 추가한다. HTTP 리셋이라는 이유로 근인 해결을 주장하거나 테스트를 Skip·timeout 일괄 연장하지 않는다. main 정렬/리뷰 thread/충돌을 확인하고 새 PR CI **시작**까지만 진행한다.
