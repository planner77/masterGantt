# Issue #556 — 누적 PR CI 실패 원장

- Primary: [Issue #556](https://github.com/planner77/masterGantt/issues/556); [PR #786](https://github.com/planner77/masterGantt/pull/786); 생성 2026-10-24 KST.
- 기준: [AGENTS.md](../AGENTS.md), [PR CI 실패 triage](PR_CI_FAILURE_TRIAGE.md) (#704 A→G), [Issue #556 Work Packet](exec-plans/active/ISSUE_556.md).
- 원본 Run 실패 판정은 불변. 이후 다른 Run/Attempt 실패는 이 문서에 추가하고 과거 오류를 PASS로 바꾸지 않는다.

## 1. 실제 Full PR CI Run/Attempt

| 실패 ID | Full Run / SHA | 실제 오류 | Required·기타 분류 |
| --- | --- | --- | --- |
| F-001 | [CI #3186.1 / Run 39963612115](https://github.com/planner77/masterGantt/actions/runs/39963612115), 2026-10-23 13:43~13:49 UTC. pull_request FINAL_FULL; Head 440513cc3612228d4575823bfe2c37e8cdfc5971, Base 427d22245fb8e11254b2424ea5147ccbd5766979, test merge 74ee98958f0a0641d6802c85c1a715ad8ab4a2ea (source attestation ci-pr-source-39963612115-1). | [Chromium E2E shard6 Job 120448846041](https://github.com/planner77/masterGantt/actions/runs/39963612115/job/120448846041) 3 PASS/1 FAIL/93 NOT RUN; shard1/2/3/4/5/7/8 CANCELLED, not PASS. | Required Chromium [Job 120450216122](https://github.com/planner77/masterGantt/actions/runs/39963612115/job/120450216122) FAILURE, automated QA [Job 120450252617](https://github.com/planner77/masterGantt/actions/runs/39963612115/job/120450252617) derived FAILURE. Required Quality and Docker SUCCESS. Policy, typecheck, lint, unit, build, Docker smoke and preflight SUCCESS. |
| 별도 참고 | [FAST_DEVELOPMENT Run 39963612277](https://github.com/planner77/masterGantt/actions/runs/39963612277), 같은 old HEAD | SKIPPED | Full 원본 실패 횟수에 합산 금지. |

## 2. 누적 실패 집합·Cross-run 매트릭스

| ID / 원본 실패 | 당시 조건·actual | 분류·증거 | 교정/동일 source 미검증 |
| --- | --- | --- | --- |
| F-001: tests/e2e/canonical-projection.spec.ts line55, #570 metadata projection 768px Day | expected receipt.reasons=["data"], actual ["data","layout"]; Gantt update revision41 SETTLED, same Core selected IDs, query unchanged | TEST_CONTRACT. [원본 Playwright report/trace Artifact 12505462979](https://github.com/planner77/masterGantt/actions/runs/39963612115/artifacts/12505462979) geometry changes + resize-observer observed | 기존 case EXTEND: data exact, optional layout only when two genuine geometry samples and observer trace; new exact HEAD Chromium/Required QA NOT TESTED. |

현재 #556에 귀속된 실제 E2E 실패 파일 합집합은 1개(위 canonical-projection, 한 case). 다른 Issue #570의 테스트를 소비하지만 실패 자체는 #556 PR #786의 원격 결과다. 나머지 shard CANCELLED 및 선택되지 않은 테스트는 미검증이다.

## 3. F-001 최초 실패 사실·원인과 반례

- 원본 shard6 로그 최초 오류 2026-10-23 13:47:43 UTC: strict deep-equality expected data, received data+layout. 1 fail 이후 max-failures=1에 의해 93개 선택 케이스 NOT RUN; 나머지 7개 shard CANCELLED.
- Artifact의 projection receipt: apiInstance=svar-api-1, generation4, revision41, outcome SETTLED, selected Task ...0003; logical/Core/DOM 각 동일 3개 ID, queryConditionsChanged=false, columns 동일. Test asserts PATCH=1, POST=0, native filter-tasks/set-columns exec 없음.
- 동일 scenario Trace: root 720×587.5, chart235×487.5 → editor 기간 root720×560, chart235×460 → 저장 후 root720×587.5, chart235×487.5. resize-observer 3건, native resize-chart 2건. src/features/gantt/project-gantt.tsx는 root/chart layout signature가 달라질 때 scheduler.request("layout")하고 동일 receipt에 data+layout reasons가 포함될 수 있다.
- 실제 UI 크기 변경은 관측되었으나 어느 DOM 행의 크기가 변한 것인지는 해당 자료로 특정 불가. 기존 #556 Project scoped CSS/status 변경과 정상 편집 overlay 등 물리적 변화의 개별 기여는 UNKNOWN; 따라서 실제 제품 오류로 단정하지 않는다. GitCommitInfo fetch 3초 경고 및 fixture 의도된 HTTP404는 본 assertion 실패가 아니다.
- 판정 TEST_CONTRACT: 기존 #570 expected data-only가 실제 reflow를 고려하지 않음. 제품 ResizeObserver 억제·무조건 data 포함만 검사·skip/retry/timeout 확대·CI 게이트 우회 금지.

## 4. 교정, 영향/음성/검증 및 문서

- 기존 tests/e2e/canonical-projection.spec.ts #570 metadata 5 CSS widths×Day/Week 검증을 EXTEND (TEST_LIFECYCLE_REVIEW, 새 spec 0개). layout 사유의 조건부 허용은 정확한 reasons 집합·순서와 같은 Trace의 서로 다른 root/chart geometry 및 resize-observer를 요구한다. structure/membership/중복/순서 역전은 FAIL. 동일 시나리오의 필터/컬럼 core 무호출·저장1·선택/Query 조건/SETTLED·same-Gantt assertions 유지.
- 전체 영향 범위: #556 scope row/focus/hidden heading·현재 Summary와 선택 Task 개인 Assignment drill 구분·readonly·responsive/390/768/1024/1440/1920·filter/reset·native Milestone OFF·fullscreen. 기존 #556 관련 E2E6·Local34/34 실측은 과거 source 기록이며 이번 코드 변경 후 새 Chromium 통과로 소급하지 않음.
- Offline 원본 trace oracle replay 5/5: actual data+layout와 data-only 허용, no-geometry-witness layout, structure contamination, wrong-order 거부. 이는 원본 JSON으로 독립 로직을 점검한 것뿐 실제 Playwright/Vitest/TypeScript/Docker *수정 HEAD* 실행은 NOT TESTED; 새 Full PR CI 및 Trusted/Owner 수용 필요.
- 동일 수정에서 제품/DB/API/CI/AGENTS/DESIGN/ARCHITECTURE 변경 N/A(테스트 계약 정정과 원장 기록만). 이 정규 원장 및 Work Packet 업데이트가 DOC_SYNC다. 기존 verify:prepr의 CSS 생산자 맵 부재 BLOCKED를 PASS라고 주장하지 않는다.

## 5. 검토/충돌와 다음 PR CI 인계

- 기존 PR #786 review threads 조회 0, Codex code review unresolved findings 0. Head/base 조회에서 mergeable=true, base와 compare behind_by=0. 교정 push 이후 재확인한다.
- PR branch feat/issue-556-schedule-header-density를 재사용해 이전 HEAD 위에 테스트+이 문서+Work Packet을 한 Git commit으로 게시한다. 새 HEAD의 Run/Attempt 및 배포 HEAD 상태는 push 후 확인.
- risk_level=HIGH, qa_method=OWNER_MANAGED, qa_required=true, release_required=true, release_authorized=false, MERGE_READY=BLOCKED. 새 exact-head Required Quality/Chromium8/Docker, Trusted QA 및 Owner approval은 CI가 시작하더라도 완료 전 NOT TESTED. Main CI, GHCR/Release/Finalizer, Issue 종료 및 branch 정리는 사용자 지시 범위 밖.
