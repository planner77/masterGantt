# Issue #765 — 단일 누적 PR/Main CI 실패 원장 (#704)

## F765-001 — PR #766 최초 Full PR CI #3082.1 QA Preflight DOC_SYNC 구조 오류 (2026-10-21)

| 증거 | 값 |
|---|---|
| Primary Issue | #765 |
| PR / 정확 최초 Head | #766 / de6d280d743024fee7f68938851503b5c22d1e96 |
| Full PR CI | Run #3082.1 / 39562882308, attempt 1 |
| 최초 실패 Job | QA Preflight — 정책·문서 사전 검사 / job 119098162421 |
| 종속 실패 | PR 빠른 검사 판정 / job 119098256972, Quality/E2E/Docker aggregate 후속 파생 실패 |
| 최초 실패 위치 | docs/exec-plans/active/ISSUE_765.md — DOCUMENTATION_SYNC / AC_TEST_COVERAGE |
| 직접 원인 | Work Packet의 DOCUMENTATION_SYNC가 QA docs_gate가 요구하는 각 문서별 인용 경로 + UPDATED/N/A(reason) 행이 아니라 서술형 한 문장이고, AC_TEST_COVERAGE: AC1..AC6 mapping이 없음 |
| 실패 유형 | POLICY_DOCUMENTATION_CONTRACT (기능/API/Release 테스트가 실제 실행되기 전 Preflight 차단) |

### 원본과 비실행 상태

- Preflight 로그: 결론 FAIL, 1 direct, 5 DEFERRED. `FAIL / DOCUMENTATION_SYNC: docs/exec-plans/active/ISSUE_765.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — DOC_SYNC 기록 누락`.
- Full CI Fast Gate는 PREFLIGHT_RESULT=failure 때문에 Quality/E2E6/Docker 구현을 SKIPPED로 중단; 해당 결과를 별개의 제품 오류나 성능 Timeout으로 분류하지 않는다.
- 최초 Head의 신규 Python 회귀, package policy/Chromium/Build/Docker는 당시 NOT TESTED이며 과거 #734 Main/Release PASS를 신규 #765 source PASS로 전용하지 않는다.

### 교정

- docs/exec-plans/active/ISSUE_765.md: docs_gate가 요구하는 `## DOCUMENTATION_SYNC` 섹션의 `- `path`: UPDATED` 또는 `N/A(reason)` 행을 QA_DOCS/관련 문서마다 정확히 등록.
- `## AC_TEST_COVERAGE`에 Issue #765 원본 AC1..AC6와 구현 세부 I1..I8를 원본 source/음성 회귀·수용 대상으로 매핑.
- 본 단일 누적 실패 원장 파일 추가. 원본 PR CI Run/attempt/Job ID 및 파생 결과는 덮어쓰지 않는다.

### 검증 및 후속

- 새 정확 Head로 Full PR CI 새 실행이 필요. 유효한 Required Quality/E2E6/Docker·Trusted QA/Owner HIGH 판정은 새 Run에서만 판단.
- 원격 CI 재실행을 위해 E2E/Timeout/Required Gate를 완화하지 않음. root cause는 정책 문서 포맷이며 앱 코드 변경은 하지 않음.
- 실패/취소 항목이 반복되면 최초 F765-001부터 누적 검토 후 변동 source·새 Job/shard evidence를 추가.

## F765-002 — PR #766 두 번째 Full PR CI #3083.1 신규 정책 Unit 음성 실패 (2026-10-21)

| 증거 | 값 |
|---|---|
| Head | f2b652c04796de570c67256589d13c50d4cf5a14 |
| Full PR CI | #3083.1 / Run 39563381737, attempt 1 |
| 사전 검증 | QA Preflight SUCCESS — F765-001 수정 효과 확인 |
| 직접 실패 | 정책·저장소 계약 검사 / job 119099938088 |
| 테스트 | scripts/test-release-debt-recovery-765.py의 test_existing_closed_old_issue_needs_bot_retirement, 10 case 중 1 FAIL |
| 오류 | line272, 예상 AutoFinalizerBlocked 미발생 — OPEN Issue에 forged RETIRED marker가 있을 때 plan_765가 closed 상태일 때만 읽음 |
| 파생 영향 | Required Quality·PR CI 최종 SUCCESS 불가; 다른 Job의 SKIPPED/FAIL은 정책 오류와 분리 |

### 원인·조치

- 과거 RETIRED marker 검사는 historical Issue가 CLOSED인 경우에만 적용돼, Owner 계획 단계에서 OPEN Issue에 주입된 비인증 marker를 즉시 차단하지 못했다.
- 모든 old Issue에 대해 state와 관계없이 정확한 bot-origin RETIRED text/expected source/decision/digest를 먼저 감사하고, CLOSED인 경우 해당 인증 marker가 존재해야 한다는 추가 조건을 적용한다.
- 이로써 위조된 OPEN marker도 preflight/비가역 mutation 전에 BLOCKED; 기존 partial retired/closed idempotence는 유지한다.
- 새로운 Head에서 Full PR CI·10가지 정책 테스트/Trusted QA를 재검증한다. 이전 Run 결과/분석은 불변.

## F765-003 — PR #766 Full #3084.1 Shard 5 35분 제한 취소 및 E2E 분배 교정 (2026-10-21)

| 항목 | 원본 증거 |
|---|---|
| Primary Issue / PR | [#765](https://github.com/planner77/masterGantt/issues/765) / [#766](https://github.com/planner77/masterGantt/pull/766) |
| Head / Base | 77b4e3ee9e67157fb48c5355c96b3c68177ab057 / e20e4a72e59b46bde34c7ae5befd5e0f46ed335b |
| Test merge | e6f7c4fa315a52ad7e1297f99e383f5acf8ac936 — exact 부모 Base/Head, Tree 일치 |
| Workflow | [PR Full #3084.1 / 39563793357, attempt 1](https://github.com/planner77/masterGantt/actions/runs/39563793357), pull_request, .github/workflows/ci.yml |
| 직접 미완료 | [E2E Shard 5/6 · PR, Job 119101891509](https://github.com/planner77/masterGantt/actions/runs/39563793357/job/119101891509), CANCELLED |
| Job 실행구간 | 2026-10-21 07:43:52Z 시작 → 08:19:06Z 강제 종료(약 35분 13초), YAML timeout-minutes:35 |
| 원본 진행 | 해당 Shard 테스트 91건 PASS 이후 취소, 결과 오류 단언 미관측. 이후 4개 스펙의 테스트 미실행/미확인 |
| 필수 파생 결과 | E2E aggregate Job 119116077101 FAILURE, QA Final Job 119116117668 FAILURE; Main image job SKIPPED |
| 별도 성공 | Quality(정책·Vitest·TS·ESLint·Build) SUCCESS, Docker SUCCESS, E2E 1·2·3·4·6 SUCCESS |
| 분류 | POLICY_CI / E2E SHARD JOB TIMEOUT. Cancel actor 원본에서 별도 확증되지 않으나 정확히 35분 Job 상한에 도달; 개별 Test timeout 또는 제품 오류로 단정 금지 |

### 전체 실패 이력 교차 판단

- F765-001 (#3082.1): DOCUMENTATION_SYNC 사전 검사 FAIL → #3084.1 Preflight SUCCESS로 보완 확인.
- F765-002 (#3083.1): OPEN source의 위조 RETIRED marker 검사 누락 → #3084.1 정책·저장소 계약 검사 SUCCESS로 보완 확인.
- F765-003 (#3084.1): 유효한 코드/정책/5개 샤드 완료, Shard 5만 35분 Job 상한에 도달해 미완료. 두 이전 FAIL과 독립적 병목이며 Python 복구 모듈/테스트 불변.
- Run #3084.1 Shard별 실제 Playwright 표시 시간(분): [30.1, 14.5, 31.2, 21.4, 35분 상한 취소, 23.8]. Shard 5에서 완료된 장시간 테스트 파일: issue-730-view-composer(6case/242.2초), issue-735-system-dashboard(6case/246.3초). Shard 1 project-task-editor(33case/200.9초), Shard 3 issue-623-resource-mvp(7case/220.4초)는 각 샤드의 35분 임계 접근 재발 방지 후보.
- Shard 5의 마지막 완료는 resource-kpi-integration-ui #530 원인→Resource→일정→M1 LIFO(21.1초), 08:18:33Z. 후속 resource-milestone-ui, resource-plan-dashboard, skip-link, ui-semantic-tokens 파일은 **NOT RUN**, 새 Head PASS 아님.

### 교정 — 테스트 파일 배치만 변경

| File | 기존 Shard → 신규 Shard | #3084에서 통과한 테스트 본문 합계 |
|---|---|---|
| project-task-editor.spec.ts | 1 → 6 | 200.9초 |
| issue-623-resource-mvp.spec.ts | 3 → 2 | 220.4초 |
| issue-730-view-composer.spec.ts | 5 → 2 | 242.2초 |
| issue-735-system-dashboard.spec.ts | 5 → 4 | 246.3초 |

- tests/config/e2e-shard-plan.json에 위 4개 spec만 옮기고 기존 136개 E2E spec은 정확히 한 Shard씩 모두 보존; Before 파일수 [23,22,26,21,23,21] → After [22,24,25,22,21,22].
- 테스트/단언·Retry/Skip/Playwright timeout·35분 Job timeout·6-Shard·workers=1·PR fail-fast=true/Main fail-fast=false·Required Quality/E2E/Docker 이름/권한·기존 historical medians는 **변경 없음**.
- #3084 실측 완료 케이스의 시험 시간만 다른 샤드로 가상 이관하면 약 [26.8,22.2,27.5,25.5,26.9,27.2]분이지만 **예측치가 아닌 근사치**. Shard 5의 남은 4개 파일/Runner 지연/fixture setup은 미계측이므로 추가 여유를 보장하지 않으며 새 PR CI 실증이 필수.
- F765-003은 테스트 누락을 허용하는 근거가 아니며 새 Head에서 136개 모든 스펙의 6-Shard coverage 및 연속 3 Required 전체 PASS를 확인해야 한다.

### 후속 재검증 / 종료 경계

- 동일 Head/Plan의 static 136 unique coverage, exact Base/PR 상태, Work Packet/Docs sync 후 신규 PR Full CI 시작. 이전 Head #3084 PASS를 신규 Head CI PASS로 소급 전용하지 않는다.
- 실패한 과거 shard5만 단독 재시도하면 중간 완료 근거는 얻을 수 있어도 리밸런싱 자체/PR 새 Head 3 Required 전체의 통합 검증은 되지 않는다.
- 미해결 리뷰 스레드/충돌 0인 경우에도 Trusted QA/Owner HIGH 승인/새 Main CI와 실제 퇴역 Owner authorization 전에 merge/RETIRED/FINAL/Close는 금지.
