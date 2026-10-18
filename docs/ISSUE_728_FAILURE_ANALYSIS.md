# Issue #728 / PR #742 — 누적 PR CI 실패 분석

> Primary Issue: [#728](https://github.com/planner77/masterGantt/issues/728) · PR [#742](https://github.com/planner77/masterGantt/pull/742) · 최초 분석 2026-10-19 KST. 기존 실행의 불변 FAIL과 새 Source의 미검증 결과를 구별한다.
> 운영 정책: [PR CI 실패 누적 원장](PR_CI_FAILURE_TRIAGE.md), [AGENTS](../AGENTS.md), [Lifecycle](ISSUE_LIFECYCLE.md), [QA 정책](QA_REVIEW_POLICY.md), [Issue Work Packet](exec-plans/active/ISSUE_728.md). 같은 Issue의 재실패는 새 문서가 아니라 본 문서에 Run/Attempt와 원인·해결을 누적한다.

## 1. 전체 원격 Run/Attempt

| PR / workflow / 시각 | Run/Attempt · HEAD/base/test merge | Required 및 실제 Job | 원본 실패 / 상태 |
| --- | --- | --- | --- |
| #742 · CI `pull_request`, 2026-10-18 13:52:11 UTC | [#2978.1](https://github.com/planner77/masterGantt/actions/runs/39133442705), ID `39133442705`, attempt `1`; head `0f9bc1d117f1611f7f3db744f1e17785efb67e5d`, base `0b8624651ad20ee5c450d29f4f5de2abdce5036b`, test merge `bc7e82d4f286f7a3a494cfae7bc364fc902105ad`, branch `feat/issue-728-wbs-ledger` | Quality aggregate `117693908895` SUCCESS; E2E aggregate `117697464039` SUCCESS (shard1~6 SUCCESS); Docker aggregate `117694036821` SUCCESS; QA Preflight `117693163905` SUCCESS, TypeScript/ESLint/Vitest/build/Smoke SUCCESS | **QA Final — Automated job `117697481847` FAILURE/BLOCKED**. [원본 QA job](https://github.com/planner77/masterGantt/actions/runs/39133442705/job/117697481847): `사유: 미해결 review thread`, exit 1. 기타 실제 테스트 FAIL 0건 관측 |

Actions branch 실행 목록 조회 시 #728은 해당 Full Run 1건이며 추가 attempt/metadata Run은 관측되지 않았다. 당시 실패한 자동 QA의 `independent QA=NOT TESTED`, `Manager ACCEPT=수동 증거 필요` 상태는 보존한다. 누락 로그·취소된 shard는 확인되지 않았으며 **새 Head의 전체 테스트 결과는 아직 NOT TESTED**다.

## 2. 누적 Cross-run 실패 매트릭스

| ID/증거/분류 | 원본 실패와 인과성 | 조치 및 새 Source 회귀 | 재실패 시 함께 확인할 범위 |
| --- | --- | --- | --- |
| F728-001 · [#2978.1 QA job](https://github.com/planner77/masterGantt/actions/runs/39133442705/job/117697481847) · `POLICY_CI` | 최종 QA가 미해결 PR review thread 2건을 탐지하여 정상적으로 차단. Quality/E2E6/Docker 집계 자체는 성공. 게이트 설정 결함이나 테스트 오류로 분류하지 않음 | 지적 2건을 코드+회귀 테스트로 수정, 별도 스레드 답변/resolve 후 새 HEAD Full CI. 게이트 우회·기존 실패 PASS 소급 금지 | 새 원격 QA가 여전히 thread/HEAD/base/신뢰 출처를 거부하면 최신 리뷰/Run/attempt와 새 원인 분리 |
| R728-001 · [Review thread](https://github.com/planner77/masterGantt/pull/742/files) `wbs-task-ledger.ts:181-183` · `PRODUCT` | `kpi.resources`에 존재하지만 `resourceMemberships`에서 빠진 Resource가 역방향 검증 없이 허용됨. 등록 수·구성 출처 과소 계산 가능; 당시 CI 테스트에서 실패한 건 아니고 reviewer가 발견 | `RESOURCE_MEMBERSHIP_SNAPSHOT_INCOMPLETE` 추가 검증. 기존 초과/foreign Resource `RESOURCE_REFERENCE_UNAVAILABLE` 유지. 누락/초과 Fixture 음성 테스트 | 한쪽 행 수만 비교하는 오류, 부분 페이지, 중복 Join, 등록-only/미배정 Resource |
| R728-002 · [Review thread](https://github.com/planner77/masterGantt/pull/742/files) `wbs-task-ledger.ts:307-308` · `PRODUCT` | 기본 Resource KPI가 무역할 개인배정을 `roles:["UNSPECIFIED"]`로 정규화한 후 WBS `role:null`의 비어 있음 검사에서 배제함. 원시 개인배정 존재 Task까지 사라짐 | null 역할 분기가 단일 `UNSPECIFIED`를 수용하도록 제한하고 명시 `role:"UNSPECIFIED"`·정의된 다른 Role 필터를 유지. 개인배정/미배정/WBS 정·역 선택 회귀 | null/명시/복수 Role, 원시 미배정 Task, Assignment identity, 순서 독립, 계획 M/D 중복·유실 |

## 3. 최초 실패 사건 F728-001 — 상세

- **원본 메시지·첫 실제 오류:** QA Final — Automated의 `최신 PR 증거·문서·리뷰 확인 (read-only)` 단계가 `자동 QA: BLOCKED`, `사유: 미해결 review thread`를 출력하여 exit 1. Job ID `117697481847`. 소스/CI 환경 문제라는 추측이나 E2E 실패라는 판정은 근거 없음.
- **원인 구별:** CI 결론 `failure`는 QA Gate의 기대된 fail-closed 동작. 두 미해결 리뷰가 가리킨 코드 결함은 실제 동작 위험이나, 이번 원격 실행에서 별도의 Unit/E2E FAIL로 관찰되지 않았다. 원본 메타데이터/Run/Job은 수정하거나 삭제하지 않는다.
- **Reviewer 원문 의미:** (1) canonical membership 전체 행 보장; (2) 역할 미지정 Assignment의 `role:null` 조회 손실 방지. 대응 코드의 정당성은 #725/#727 typed DTO 및 원래 Resource KPI 정규화·WBS null branch 계약에 근거한다.
- **수정 파일:** `src/domain/resources/wbs-task-ledger.ts`, `tests/domain/wbs-task-ledger.test.ts`, `docs/WBS_TASK_LEDGER.md`, `docs/exec-plans/active/ISSUE_728.md`, 본 원장. 기존 권한/CI/필수 검증/버전은 변경하지 않는다.
- **반례/음성:** 외부 등록 ID는 기존 `RESOURCE_REFERENCE_UNAVAILABLE`; 등록 행이 빠지면 새 완전성 오류; 역할 미지정 배정은 null과 explicit UNSPECIFIED에서 모두 선택되되 `DEVELOPER`에서는 제외; 원시 무배정 Task는 남고 `T3`의 개인배정 50%는 2.5 M/D로 한번만 합산.
- **동일 Source 재현·검증:** GitHub source·리뷰·로그에 근거한 정적 대조만 수행. 새로운 TypeScript/Vitest/Playwright/Docker의 로컬 실행은 Node 의존성·전체 checkout 부재로 `NOT TESTED`. 신규2개 Unit 및 기존 영향 테스트는 새 PR Full CI의 원격 검증 대상으로 유지; 원격 시작만으로 PASS 판정하지 않는다.

## 4. 누적 원인·교차 소비자와 검증 경계

- **누적 직접 실패 파일 합집합:** CI Unit/E2E 직접 실패 파일은 없음. 실제 CI 실패 생산자는 `scripts/qa_final_automated.py`의 정책 차단(수정 불필요), 리뷰 발견 코드 위치는 `src/domain/resources/wbs-task-ledger.ts` 두 곳.
- **신규 직접 테스트:** `tests/domain/wbs-task-ledger.test.ts` 2건. **인접:** `tests/domain/wbs-task-ledger-acceptance.test.ts`, `tests/domain/resource-kpi.test.ts`, 기존 Target·Resource Plan·Milestone Stage Gate, `tests/fixtures/wbs-task-ledger.ts` 및 #727 참여자 DTO 소비자. 기존 `174/174 PASS`는 PR 최초 동결 Source의 기록이며 이 보완 Source 성공 증거 아님.
- **비범위/음성:** #729의 DB snapshot/HTTP writer 미구현은 본 pure Domain 변경 대상 아님. Dashboard·Gantt UX·CI workflow/Required3의 코드나 타 이슈 실패 원장을 바꾸지 않음. 로컬 실행 미관측을 PASS로 기재하지 않음.
- **확인된 원인 수렴:** 최초 관측 F728-001 하나와 리뷰 PRODUCT 위험 R728-001/002를 한 묶음으로 보완. 과거 다른 Issue의 migration·E2E·QA 오류를 #728 실패로 전용하거나 false-positive로 축소하지 않는다.

## 5. 게시·후속 운영

- 같은 `feat/issue-728-wbs-ledger` 브랜치의 단일 보완 commit으로 위 Source/회귀/문서/원장을 동시 게시하고 PR #742의 최신 HEAD를 갱신한다. 게시 전 main은 `0b8624651ad20ee5c450d29f4f5de2abdce5036b`로 PR base와 동일하며 PR `mergeable=true`; 게시 직전/직후 재확인한다.
- 보완 후 PR 리뷰 두 건 각각에 코드·검증 근거를 답변한 뒤 resolved 상태를 확인한다. PR synchronize의 **새 Run/Attempt는 별도 결과**이며 기존 #2978.1 실패는 불변이다. Run 생성 여부와 링크는 PR/Issue 댓글에서 새 HEAD와 연계하여 인계한다.
- 새로운 Run의 Required Quality/E2E6/Docker·Trusted QA, Owner ACCEPT/HIGH 위험 수용 및 merge 가능성은 수행 결과 확인 전 `NOT TESTED`/`BLOCKED`다. 사용자의 요청대로 새 CI **시작까지만** 하고 모니터링·병합·Main/GHCR/정식 릴리스·Issue 종료는 수행하지 않는다.
