# Issue #556 — 누적 PR CI 실패 원장

- Primary: [Issue #556](https://github.com/planner77/masterGantt/issues/556); [PR #786](https://github.com/planner77/masterGantt/pull/786); 생성 2026-10-24 KST.
- 기준: [AGENTS.md](../AGENTS.md), [PR CI 실패 triage](PR_CI_FAILURE_TRIAGE.md) (#704 A→G), [Issue #556 Work Packet](exec-plans/active/ISSUE_556.md).
- 원본 Run 실패 판정은 불변. 이후 다른 Run/Attempt 실패는 이 문서에 추가하고 과거 오류를 PASS로 바꾸지 않는다.

## 1. 실제 Full PR CI Run/Attempt

| 실패 ID | Full Run / SHA | 실제 오류 | Required·기타 분류 |
| --- | --- | --- | --- |
| F-001 | [CI #3186.1 / Run 39963612115](https://github.com/planner77/masterGantt/actions/runs/39963612115), 2026-10-23 13:43~13:49 UTC. pull_request FINAL_FULL; Head 440513cc3612228d4575823bfe2c37e8cdfc5971, Base 427d22245fb8e11254b2424ea5147ccbd5766979, test merge 74ee98958f0a0641d6802c85c1a715ad8ab4a2ea (source attestation ci-pr-source-39963612115-1). | [Chromium E2E shard6 Job 120448846041](https://github.com/planner77/masterGantt/actions/runs/39963612115/job/120448846041) 3 PASS/1 FAIL/93 NOT RUN; shard1/2/3/4/5/7/8 CANCELLED, not PASS. | Required Chromium [Job 120450216122](https://github.com/planner77/masterGantt/actions/runs/39963612115/job/120450216122) FAILURE, automated QA [Job 120450252617](https://github.com/planner77/masterGantt/actions/runs/39963612115/job/120450252617) derived FAILURE. Required Quality and Docker SUCCESS. Policy, typecheck, lint, unit, build, Docker smoke and preflight SUCCESS. |
| F-002 | [CI #3193.1 / Run 40028881375](https://github.com/planner77/masterGantt/actions/runs/40028881375), 2026-10-23 21:43~21:46 UTC. pull_request FINAL_FULL; Head 411fd5990da7958191661eed2e4f0b5fcff3a619, Base 427d22245fb8e11254b2424ea5147ccbd5766979, test merge 951e5aaa1829f47dee10a426ba52db6c89949c56. | [Policy Job 120672045024](https://github.com/planner77/masterGantt/actions/runs/40028881375/job/120672045024) npm audit --omit=dev, Zod 4.6.2 <4.6.6 HIGH GHSA-mrhx-c7xc-m3w5, exit1. Vitest/Lint/Typecheck/npm ci PASS. | Fast Gate FAIL, 8 Chromium shards/PR Build/Docker smoke SKIPPED; Required Quality/E2E/Docker and QA Final FAILURE all downstream. |
| 별도 참고 | [FAST_DEVELOPMENT Run 39963612277](https://github.com/planner77/masterGantt/actions/runs/39963612277), 같은 old HEAD | SKIPPED | Full 원본 실패 횟수에 합산 금지. |

## 2. 누적 실패 집합·Cross-run 매트릭스

| ID / 원본 실패 | 당시 조건·actual | 분류·증거 | 교정/동일 source 미검증 |
| --- | --- | --- | --- |
| F-001: tests/e2e/canonical-projection.spec.ts line55, #570 metadata projection 768px Day | expected receipt.reasons=["data"], actual ["data","layout"]; Gantt update revision41 SETTLED, same Core selected IDs, query unchanged | TEST_CONTRACT. [원본 Playwright report/trace Artifact 12505462979](https://github.com/planner77/masterGantt/actions/runs/39963612115/artifacts/12505462979) geometry changes + resize-observer observed | 기존 case EXTEND: data exact, optional layout only when two genuine geometry samples and observer trace; new exact HEAD Chromium/Required QA NOT TESTED. |

| F-002: Policy/npm production audit (Zod 4.6.2) | High advisory GHSA-mrhx-c7xc-m3w5, npm audit exit1; E2E8 NOT RUN | POLICY_CI / DEPENDENCY_SECURITY — legitimate production security gate, not UI/Browser failure | Zod 4.6.7 exact manifest/lock SRI + immutable capture normalization and tamper negatives; new CI NOT TESTED. |

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

## 6. F-002 — Full PR CI #3193.1 High severity Zod audit (2026-10-24 KST)

### 6.1 귀속·원본·실제 실패

- [Full PR CI #3193.1, Run 40028881375 attempt 1](https://github.com/planner77/masterGantt/actions/runs/40028881375), pull_request FINAL_FULL, HEAD 411fd5990da7958191661eed2e4f0b5fcff3a619, base 427d22245fb8e11254b2424ea5147ccbd5766979, synthetic test merge 951e5aaa1829f47dee10a426ba52db6c89949c56. [Source Artifact 12533652896](https://github.com/planner77/masterGantt/actions/runs/40028881375/artifacts/12533652896), 실제 2026-10-23 21:43~21:46 UTC. 같은 HEAD의 [FAST_DEVELOPMENT 40028881372](https://github.com/planner77/masterGantt/actions/runs/40028881372)은 SKIPPED(Full 실패가 아님).
- 최초 직접 FAIL: [Policy job 120672045024](https://github.com/planner77/masterGantt/actions/runs/40028881375/job/120672045024), step **production dependency audit**, 2026-10-23 21:45:11 UTC. 명령 `npm audit --omit=dev`가 `zod <4.6.6`에 대한 HIGH [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)(oversized constrained collection validation memory exhaustion) 1건을 검출하고 exit1. 출력은 `npm audit fix --force` 사용 시 정확 `zod@4.6.7`로 교체한다고 명시. 기존 root manifest와 lock의 Zod가 exact 4.6.2여서 허용 범위 밖이라는 뜻이며 보안 취약점 예외 허용 근거는 아니다.
- Policy job 내 `npm ci` 설치 446 packages, version check v0.130.2, discovery 270 unit files/807 browser tests, Python lifecycle inventory 12cases 모두 SUCCESS. 다른 구현 Job Vitest/ESLint/TypeScript SUCCESS. PR Fast Gate [120672732493](https://github.com/planner77/masterGantt/actions/runs/40028881375/job/120672732493)는 `POLICY_RESULT=failure`를 정확 차단. PR Next Build/Docker smoke 및 8개 Chromium E2E는 **SKIPPED / NOT RUN**. Required Quality [120672801342](https://github.com/planner77/masterGantt/actions/runs/40028881375/job/120672801342), Required Chromium [120672801407](https://github.com/planner77/masterGantt/actions/runs/40028881375/job/120672801407), Required Docker [120672801293](https://github.com/planner77/masterGantt/actions/runs/40028881375/job/120672801293), Automated QA [120672835388](https://github.com/planner77/masterGantt/actions/runs/40028881375/job/120672835388) FAIL은 **파생**으로, 별도 제품/Chromium/Docker 실패가 아니다.

### 6.2 원인 분류와 이전 F-001 비교

- **F-002 = POLICY_CI(실제 취약 운영 의존성에 대한 정책의 정당한 FAIL), 근본 보완 대상=DEPENDENCY_SECURITY.** 4.6.2가 보안 권고 범위에 있고 `npm audit --omit=dev`의 실제 성공 조건(운영 취약점0)을 위반한 것이다. 첫 Full #3186.1의 같은 Audit는 PASS했으므로 외부 권고 DB 재분류/갱신 가능성이 있으나 정확한 갱신 일시·주체는 **UNKNOWN**. 이를 flaky policy로 간주하여 무한 재시도/allowlist 금지.
- **F-001은 E2E TEST_CONTRACT**(canonical-projection #570, expected data-only vs data+layout). 그 교정은 HEAD 411fd599에 들어 있으나 F-002 Run은 Chromium 8개가 모두 SKIPPED이므로 재검증 여부 **NOT TESTED**다. F-001 원본 실패·보완을 덮거나 F-002가 F-001 PASS를 증명했다고 주장하지 않는다. 지금까지 원본 실제 실패의 합집합은 E2E 1 case + dependency audit 1 step.

### 6.3 교정·음성 테스트·보안 한계

- **정확 변경**: 운영 direct `zod@4.6.2→4.6.7`(동일 major 4), `package.json`과 `package-lock.json` root/installed Zod 단 2 entry 정렬. npm tarball resolved URL `https://registry.npmjs.org/zod/-/zod-4.6.7.tgz`, SRI `sha512-g8W2D2kU6a8untc053fX1uVBKzM7yqAxW/3zwk83+6RyF2+SKOuV+c0wBDhUwzV1PaGapmZH+rmcUzPf+3CGwg==`, license MIT. lock 573개 entry 수와 나머지 package/scripts/version0.130.2/Next/SVAR/SQLite/API/DB/UI 계약은 불변. [업스트림 v4.6.7](https://github.com/colinhacks/zod/releases/tag/v4.6.7) 배포 확인; SRI는 서로 다른 공개 lock 기록에서 확인되었으나 연결된 로컬 환경은 npm registry DNS 실패로 **npm ci/audit 신규 source 직접 실행 NOT TESTED**. 새 원격 PR CI로 검증.
- **역사적 캡처 계약과 회귀**: `tests/fixtures/gantt-state-consistency/capture-sources/{package,package-lock}-original.snapshot.txt`의 Zod 4.6.2와 Next 16.3.8 원형은 불변이다. #752/#762의 `capture-install.ts`가 원형 capture와 현재 설치를 엄격 비교하므로 이번 승인 Zod 4.6.7의 exact version/registry/SRI/metadata만 새 `approved-zod-4.6.7-lock.json`에 고정하고 비교용 메모리 객체만 4.6.2로 정규화한다. 기존 approved Next 16.4.2의 10 package 검사, 기타 모든 dependency·script·metadata strict equality 유지.
- **TEST_LIFECYCLE_REVIEW**: `tests/scripts/prepr-verifier.test.ts` 기존 단일 negative regression EXTEND; 정확 root/installed version과 SRI, registry URL, 추가 optional deps 오염 6개 음성 사례 추가. 역사적 Core 실사용 3개(`canonical-recovery-runtime`, `state-consistency-runtime-fixture`, `axis-transaction-runtime-fixture`) 및 server strict request schema/HTTP 5폭/Task assignment·#556 조회/범위/marker OFF/Gantt E2E는 KEEP_UNIQUE. 신규 E2E spec/shard, timeout/retry/skip/Required gate 변경0. 수정된 test+security manifest는 새 Head remote Vitest/TypeScript/8Shard/Docker 검증 전 **NOT TESTED**.
- **잔여 위험**: 4.6.7을 설치해 이 npm audit 권고가 해결되는지는 새 원격 audit 성공으로 판단한다. 컨테이너 schema가 명시 max를 두지 않으면 version upgrade만으로 모든 메모리 소비 위험이 소멸한다고 보장할 수 없다. 기존 API request body byte/depth/array 최대치·HTTP 오류 보호를 유지하고, unbounded collection 전수 audit는 이 PR에서 수행했다고 주장하지 않는다. 필요 시 별도 Security 심사를 수행한다.
- **문서 동기화**: README, RESEARCH, SECURITY, CHANGELOG, Work Packet/본 원장. DESIGN/API/DB_SCHEMA/SCHEDULING_ENGINE/기존 UI/CI_CD/AGENTS/QA 정책 변경은 N/A(계약 불변); 원장의 Test Lifecycle Review가 TEST_PLAN의 공통 정책을 참조한다.

### 6.4 리뷰·충돌·다음 실행 인계

- PR #786 미해결 리뷰 스레드 0개, 리뷰 comment unresolved findings 없음(수정 전 GitHub GraphQL 조회). `mergeable=true` / main behind_by=0 (수정 전 SHA). Push 전후 exact HEAD/Base/mergeability/review 재확인 필요.
- User가 승인한 단계는 **코드 보완 → 실패 원장 누적 → PR CI 신규 시작**이며 지속 모니터링·병합·Main/GHCR/Release/Finalizer·Issue 종료는 별도 지시까지 금지. Risk HIGH / OWNER_MANAGED / qa_required=true / release_required=true / release_authorized=false / MERGE_READY=BLOCKED. 새 source의 세 Required, Trusted QA 및 Owner 수용은 원격 evidence 전까지 NOT TESTED.

