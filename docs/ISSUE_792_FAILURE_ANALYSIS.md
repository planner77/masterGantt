# Issue #792 — 누적 실패·재시도·충돌 원장

Primary Issue: https://github.com/planner77/masterGantt/issues/792
공통 분류: [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md) · [Work Packet](exec-plans/active/ISSUE_792.md) · [#785 이력](ISSUE_785_FAILURE_ANALYSIS.md)

## F792-000 · 2026-10-24 · 착수 및 위험 한계

- baseline: main `b45885812301d14b9f673841e9944b27b2642323`에서 `feat/issue-792-legacy-source-scope-safety` 독립 분기. #785 원본과 공개 410 상태 보존.
- 직접 제품/CI 실패 관측: **없음 (NOT RUN/NOT TESTED, PASS가 아님)**. 기존 #785/#793의 역사적 실패는 본 Issue 실패로 복제하거나 원본 판정을 수정하지 않는다.
- 원인/조치 구분: #785에는 직접 archive 관계 안전 편집이 없어 Summary 바인딩 범위만 preview/confirm/in-place UPDATE 기능을 추가한다. 회원 변경·whole 정의·coverage·운영 DB 이전은 미구현·별도 승인 범위.
- 입력/실행: GitHub 커넥터 source fetch·branch 파일 편집만 가능. Node/npm/Vitest/Chromium/Docker/실제 오프호스트 데이터베이스 접근·로그 수집이 없어 로컬 검사 전체 `NOT TESTED`. 기존 테스트 Fixture를 확장했지만 테스트 작성은 실행 성공이 아니다.
- 보안/원자성 코드 위험: Origin/edit-session/If-Match+서버 재검사·source fingerprint·impact token·SQLite IMMEDIATE rollback·postcheck를 구현했다. 실제 공격·경합·운영 restore 실증이 끝나지 않아 `qa_required=true`/HIGH/OWNER_MANAGED/Owner 승인 전 병합 금지.
- 재현/교정: 현재 최초 CI 실패를 보고받지 않았다. 다음 Full Run의 **Job별 직접 FAIL**, skip/cancel로 인한 파생 Required3/QA와 exact Head/base/test-merge를 구분해 F792-001부터 추가한다.
- 처리 범위: PR 비Draft `opened`로 Full CI를 **한 번 시작**하고 모니터링은 하지 않는다. Merge/Main/GHCR/Finalizer/Issue 종료는 승인 밖.

## 로컬 코드 자기점검 기록 (원격 테스트와 구별)

| ID | 분류 | 수정/검토 | 실행 결과 |
| --- | --- | --- | --- |
| LOCAL-001 | 정적 위험 교정 | patch parser의 literal `true as const`로 TS 반환 타입 명확화 | 타입 검사 NOT RUN |
| LOCAL-002 | 정적 위험 교정 | UI Map tuple 타입, 취소 시 busy 해제, 브라우저 수동 Origin 헤더 제거 | Chromium NOT RUN |
| LOCAL-003 | 정적 위험 교정 | Vitest SQLite raw row 비교 callback을 `unknown` 안전 캐스트로 조정 | Vitest NOT RUN |
| LOCAL-004 | 정적 위험 교정 | 신규 subtree 후보의 provenance fanout 50,000건 경로 한도 검증 전치 | 단위테스트/부하 NOT RUN |
| LOCAL-005 | 정적 위험 교정 | 비활성 Target/member의 self→subtree 확대 차단, active coverage/regression 추가 | Vitest NOT RUN |
| LOCAL-006 | 검증 범위 확대 | orphan/인증·stale async body race/SQLite file restart·Equipment numeric coverage=4·역범위 복원 테스트 확장 | 실행 NOT RUN |

## PR / Review / Merge / CI 출처

- PR 번호, exact Head SHA, base SHA, test merge SHA: **PR 개설 전 미확정**. 개설 후 실제 영수증만 기록.
- 미해결 리뷰 스레드: **개설 후 별도 조회**; 다른 PR/#785/#793의 스레드를 임의 resolve하지 않는다.
- `mergeable`은 GitHub PR 검사에서만 확인하며 최신 main 정렬 후 재확인한다. 이전 base로 판정한 결과를 현행 최신으로 오인하지 않는다.
- `CI_STARTED`는 PR `opened` 이벤트로만 확인. Run ID/Attempt가 조회되지 않았거나 사용자 지시로 모니터링하지 않은 경우 **NOT CONFIRMED / NOT TESTED**로 기록한다.
- 재시도 시 취소 Run도 기록하고 cancellation 이전의 실제 첫 실패와 별개 집계 실패를 구분한다.

## 운영 검증 보류

| 항목 | 상태·근거 |
| --- | --- |
| 운영 원본 row/coverage/Task/Assignment before/after | NOT TESTED — 운영 DB 접근 없음 |
| 외부 클라이언트 구형 API 사용량·410 영향 | NOT TESTED — 인증된 접속/consumer 로그 없음 |
| off-host SQLite backup+manifest+restore+restart | NOT TESTED — 운영 볼륨/복구 호스트 접근 없음 |
| 사용자 UI 390·768·1024·1440·1920px, Tab/Escape/focus | NOT TESTED — 브라우저 세션 없음 |
| Owner HIGH 위험 수용·정확 Head Trusted QA | NOT TESTED — 원격 완료 후 별도 |

변경 부채와 신뢰 경계는 [운영 가이드](TARGET_RESOURCE_OPERATIONS.md)와 [Issue #792 Work Packet](exec-plans/active/ISSUE_792.md)을 따른다.
