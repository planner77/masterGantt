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
