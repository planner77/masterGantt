# Issue #806 — 누적 PR CI 실패 분석 원장

Primary Issue: [#806](https://github.com/planner77/masterGantt/issues/806) · PR: [#815](https://github.com/planner77/masterGantt/pull/815) · 최초 기록: 2026-10-26 KST.
Source of truth: [PR CI Failure Triage](PR_CI_FAILURE_TRIAGE.md), [AGENTS](../AGENTS.md), [Test Plan](TEST_PLAN.md), [Work Packet](exec-plans/active/ISSUE_806.md).

## 1. 해당 Issue 전체 원격 실행 목록

Issue #806으로 연결된 기존 PR/branch 검색 당시 없음. 이 원장의 접근 가능한 이력은 **PR #815 하나**, Full **Run 40268435859 attempt1**이며 이후 새 Head/Attempt는 별개로 누적한다.

| 원본 | 시각·이벤트 | Head/Base/Test-merge·출처 | 결론 |
| --- | --- | --- | --- |
| [Full #3311.1](https://github.com/planner77/masterGantt/actions/runs/40268435859) | 2026-10-26 04:19Z, pull_request, CI | Head `0812598bab7a8e99d42034815ee549866b353bb1`; base `73901d7eb86a734e1017df04efa0ba26c5abbb45`; test-merge `e325c042a82ee5a712c3cad82ecb5628ee6e5578` | FAIL, QA Preflight 직접1 + Required3/QA/빠른검사 파생. 제품 test SKIPPED |
| [Draft Fast #128.1](https://github.com/planner77/masterGantt/actions/runs/40268435851) | 같은 첫 HEAD, FAST_DEVELOPMENT advisory | Full와 별개 | SKIPPED / 비권위 |

원본 [Preflight Job 121395890824](https://github.com/planner77/masterGantt/actions/runs/40268435859/job/121395890824), [Preflight report Artifact](https://github.com/planner77/masterGantt/actions/runs/40268435859/artifacts/12626902999), [PR source Artifact](https://github.com/planner77/masterGantt/actions/runs/40268435859/artifacts/12626788048), [Automated QA Job](https://github.com/planner77/masterGantt/actions/runs/40268435859/job/121396076255). GitHub에서 원본 Job/step 로그를 읽었으며 Secret/원시 로그는 저장하지 않는다.

## 2. Original Job, 직접/파생 오류 및 SKIPPED·취소

| Job ID | 실제 결론 | 근거·구분 |
| --- | --- | --- |
| 121395806996 Changes | SUCCESS | 원본 PR source 증거 생성 |
| 121395807345 QA trust boundary | SUCCESS | base validator bootstrap 확인만, 최종 QA 아님 |
| **121395890824 QA Preflight** | **FAILURE 직접** | 정확 에러: `FAIL / ISSUE_AC: Issue #806 Acceptance Criteria — Primary Issue 본문에 AC1.. 식별자 없음` |
| 121395976519 PR Fast Gate | FAILURE 파생 | PREFLIGHT_RESULT failure. Policy, Typecheck, Lint, Unit SKIPPED |
| 121396049189 Build/static/unit Required | FAILURE 파생 | 구현 Quality/Build/Vitest SKIPPED |
| 121396049252 Chromium E2E Required | FAILURE 파생 | E2E **8개 shard 실제 미실행**, 집계 FAIL |
| 121396049279 Docker Required | FAILURE 파생 | Docker implementation SKIPPED |
| 121396076255 QA Final Automated | FAILURE 파생 | required quality 미성공 |
| 121396076090 Shadow advisory | SUCCESS | 실제 Full CI 대체 불가 |

첫 직접 오류는 정책/이슈 메타데이터의 불일치이며 제품/Playwright assertion의 직접 FAIL이 아니다. E2E 실행0, 취소0, TypeScript/Vitest/Lint/Next build/E2E/Docker **NOT RUN**. “테스트 실패0”을 구현 PASS로 표시하지 않는다.

Preflight 상세: PRIMARY_ISSUE·risk_level·qa_method·qa_required·release 플래그·path policy PASS, ISSUE_AC FAIL1, mergeability/fullCI/reviews/base test merge/document meaning DEFERRED5. QA Final은 required quality 미성공으로 FAIL.

## 3. 누적 Cross-run 실패 매트릭스

| 원본 ID | 직접 실패 파일·계약 | 원인 분류·정확 근거 | 보완/잔여 검증 |
| --- | --- | --- | --- |
| F806-R001 / Full40268435859.1 Job121395890824 | main `scripts/qa_preflight.py` · `ISSUE_AC` / Issue #806 Epic AC E1~E6 | **POLICY_CI / 문서 식별자 불일치**. main 검증기는 `re.findall(r"\bAC\d+\b", issue_body)`이고 기존 이슈에는 표준 `AC1` 표기가 없었음. 코드·fixture 실패 아님 | Issue AC1(E1)~AC6(E6) 별칭, 의미/미완료 유지. 새 Head exact CI는 NOT TESTED |
| F806-LATENT-001 (실행 FAIL 아님) | main `qa_final_automated.docs_gate` / Work Packet 구조 | #3311.1은 ISSUE_AC가 실패하여 DOCUMENTATION_SYNC를 검증하지 못함. 소스 감사에서 `AC_TEST_COVERAGE` bullet/`DOCUMENTATION_SYNC` 표준 경로 형식 불일치 발견. **별도 CI 직접 실패로 계수 금지** | Work Packet `- AC1:`~`- AC6:`, `UPDATED/N/A(reason)`로 정규화. QA validator·workflow 변경 금지 |

**누적 실제 실패 Playwright/Vitest 테스트 파일 합집합: 없음 (미실행)**. 직접 오류 계약은 Issue body + base `scripts/qa_preflight.py`, 새 대응은 Issue metadata·Work Packet·이 원장. 과거의 E1~E6 수용/사실과 기존 실패 기록을 변경해 PASS 처리하지 않는다.

## 4. 보완 및 교차 검증 선정

- 동일 #815/`feat/issue-806-resource-epic-integration` 브랜치 유지, 처음 Head는 `0812598bab7a8e99d42034815ee549866b353bb1`. 현재 main SHA와 mergeability·review thread0을 최초 확인. 게시 직전 최신 main/Head/tree/threads 재확인, 기대 SHA를 유지하고 단일 correction tree/commit push 한다.
- 제품 `src/`, 원본 Task/Assignment/Calendar/DB, public API, 0.135.1 package/lock, E2E assertion·fixture, workflow/Required3·8 shard·QA validator **불변**.
- Issue 원래 E1~E6은 AC1..AC6 식별자만 병기. Work Packet에서 각각 직접 AC mapping과 문서의 path별 명시 상태를 제공하며 다른 docs는 근거 있는 N/A로 표시. [Epic 수용 원장](ISSUE_806_EPIC_ACCEPTANCE.md)의 AC/E 별칭 동기화.
- TEST_LIFECYCLE_REVIEW: 최초 PR이 기존 `tests/e2e/issue-736-resource-dashboard.spec.ts` #807 단일 test를 EXTEND. 재작업에서 테스트 변경0. KEEP_UNIQUE #808 Domain/HTTP/SQLite, #809 chart/원본/401/412, #736 Plan/Excel, #800 geometry, #517 native125% 현장. ADD/CONSOLIDATE/RETIRE 없음; skip·assertion/timeout/retry 완화 없음.
- 재검증: base `qa_preflight.py` Issue 정규식과 `qa_final_automated.docs_gate` section/AC line/doc path parser에 새 Issue/Work Packet 구조 정적 대조. Node·Vitest·real HTTP/SQLite·Chromium·Docker 실행 환경이 이 커넥터 호출에는 없으므로 **LOCAL NOT TESTED**. 새 Head 전체 원격 Full CI의 Quality/E2E8/Docker가 필수.
- 리뷰/충돌: 첫 Head inline unresolved threads0, Codex summary findings0(일반 댓글; human/Trusted/Owner 승인 아님), PR mergeable true/behind main0. 새 Head 재검증 필요.
- risk_level HIGH; qa_method OWNER_MANAGED; qa_required true; release_required false / authorized false; manager_decision NOT TESTED; MERGE_READY BLOCKED. 이슈·PR 출시 권한 변화 없음.

## 5. 다음 PR CI 및 원장 누적 규칙

이 원장 작성 시 새 correction Head/Run은 **NOT TESTED**. 메타데이터·서로 연결된 관련 문서와 원장을 하나의 Git tree/commit으로 만든 다음 동일 PR의 새 `pull_request synchronize` Full CI **시작**만 확인한다. 다른 실행 결과를 참조해 PASS로 추정하지 않는다. 요청대로 모니터링·병합/Main CI/GHCR/Finalizer·Issue 종료는 제외한다.

재실패 시 같은 원장의 F806-R002 행으로 Run/Attempt/실제 오류와 이전 실행 집합을 추가하고 #3311.1 원본 실패를 보존한다.
