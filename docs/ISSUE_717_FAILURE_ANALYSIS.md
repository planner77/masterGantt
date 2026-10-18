# Issue #717 — PR CI 누적 실패 분석 및 REWORK 원장

정규 실패 원장: `docs/ISSUE_717_FAILURE_ANALYSIS.md`. Primary Issue [#717](https://github.com/planner77/masterGantt/issues/717); 문서 설계 PR [#718](https://github.com/planner77/masterGantt/pull/718). [공통 실패 지침](PR_CI_FAILURE_TRIAGE.md) #704에 따라 원본 Run/Attempt는 성공 시에도 **원본 FAIL 유지**, 새 실패 때 동일 파일에 추가한다.

## 이력 범위·실패 매트릭스 (2026-10-18 최초 조사)

조회한 `Refs #717` 연계 PR: **#718 하나**. 해당 PR branch `docs/issue-717-name-first-identifier-policy`의 접근 가능한 Full CI는 **1회**(Run #2923 attempt 1). 이전 별도 PR/실패 원장 없음. GitHub 제한·조회 기간 외 실행은 미확인으로 남긴다.

| 실패 ID | 원본 PR / Run / Attempt / Head | 실제 실패 원인·단계 | 보완 및 후속 상태 |
| --- | --- | --- | --- |
| F-001 | PR #718 · [CI #2923.1](https://github.com/planner77/masterGantt/actions/runs/39080414283) · `39080414283.1` · `23e09aada982087047d90037704cdbb8b750bf97` | `POLICY_CI`: PR body risk/QA key의 **독립 전체 줄 선언 부재**, Work Packet **정규 heading 및 행 구조 부재**. Preflight FAIL 5, QA route BLOCKED, Fast Gate 실패, 3 required aggregate 파생 FAIL | 기존 검증기 보존. PR 본문 필드·동일 Work Packet exact section/AC mapping 교정. 새 동일 SHA 로컬 테스트 및 remote Full PASS는 **NOT TESTED** |

### F-001 원본 고정 증거

- **귀속:** PR #718, Issue #717, event `pull_request`, branch `docs/issue-717-name-first-identifier-policy`, Run created 2026-10-17 23:48:25 UTC (=2026-10-18 08:48:25 KST), workflow `CI`, attempt 1.
- **Ref:** Head `23e09aada982087047d90037704cdbb8b750bf97`; Base main `6fea0397bc07d0c3adf2d769f9ba6829473503a2`; GitHub test-merge `fc3aada1cc42043ede90e4af6c7d0c46320218ad` (Fast Gate checkout 로그). 원본은 변경 없이 참조한다.
- **최초 차단 [QA trust boundary job #117536033073](https://github.com/planner77/masterGantt/actions/runs/39080414283/job/117536033073):** `QA 경로 BLOCKED: PR 본문 qa_method의 명시값 필요`.
- **직접 실패 [QA Preflight job #117536064475](https://github.com/planner77/masterGantt/actions/runs/39080414283/job/117536064475):** 전체 5 FAIL: `RISK_LEVEL`·`QA_METHOD`·`QA_REQUIRED` 각각 '정확히 한 개의 선언 필요'; `PATH_POLICY`는 선행 선언 오류의 파생; `DOCUMENTATION_SYNC`는 `Work Packet ## DOCUMENTATION_SYNC 누락`. `PRIMARY_ISSUE`·`ISSUE_AC`는 PASS. [원본 Preflight artifact](https://github.com/planner77/masterGantt/actions/runs/39080414283/artifacts/12118229350).
- **파생 [Fast Gate #117536096158](https://github.com/planner77/masterGantt/actions/runs/39080414283/job/117536096158):** `PREFLIGHT_RESULT=failure`, `POLICY_REQUIRED=true`이나 `POLICY_RESULT=skipped` → FAIL. 필수 집계 `quality #117536119969`, `e2e #117536120004`, `docker #117536120008` **모두 FAILURE**(전제조건 차단 반영).
- **실행 여부:** `policy`/typecheck/lint/unit/Next.js build/Chromium PR shard 6개/Docker 실제 구현 Job은 **SKIPPED / NOT RUN**. `QA Final — Automated`도 **SKIPPED**. 앱 UI 실패·flaky/E2E/물류 로직 결함으로 추정할 증거가 없다.
- **분류:** `POLICY_CI`(문서·PR metadata 계약 위반); (신규 원인). 인증 검증기 자체의 버그로 판정하지 않는다. parser의 전체 줄 선언과 `## DOCUMENTATION_SYNC`·`## AC_TEST_COVERAGE` exact heading, `- \`path\`: UPDATED/N/A(reason)`, `- AC1: ...`~`- AC8: ...` 형태는 `scripts/qa_preflight.py` 및 `scripts/qa_final_automated.py`가 실제 요구한다.

## 재발 원인·보완 계획과 교차 검증

1. **PR 본문 정규 계약:** 키별 정확히 한 줄 `risk_level: LOW`, `qa_method: OWNER_MANAGED`, `qa_required: false`, `release_required: false`, `release_authorized: false`; canonical `Refs #717` 한 줄 유지. 기존 bullet의 inline `\`risk_level: LOW\``는 정규 표현식의 전체 줄 선언이 아님. CI 코드 수정 또는 파서 완화 금지.
2. **Work Packet 정규화:** headings 정확히 `## DOCUMENTATION_SYNC` / `## AC_TEST_COVERAGE`; 수정 파일별 `UPDATED`, 보존 계약은 각 파일별 `N/A(reason)`. Issue AC1~AC8 각각의 **개별 한 줄 mapping**에 실제 구현·검증의 미완료/NOT TESTED를 정직하게 표기. 이번 docs-only이므로 제품 수용 기준을 완료로 체크하지 않는다.
3. **현재 직접 영향:** `DESIGN.md` 내용 불변. `docs/exec-plans/active/ISSUE_717.md`와 `docs/exec-plans/active/PLAN.md`, 본 원장만 추가/수정. PR metadata는 정확한 head에서 유효하게 하며 commit SHA는 branch ref 게시 후 다시 도출.
4. **로컬 정적 회귀:** Issue의 AC1~8과 본문 단일 `Refs`, PR의 풀라인 5개 key를 parser에 맞춰 검사. DOC_SYNC 행과 변경 파일 대응·필수 문서가 일치하는지 검토. 로컬 Python / GitHub Actions는 직접 실행된 것만 PASS로 분리하며 실행 미확인은 NOT TESTED.
5. **원격 새 Full PR CI:** PR main base 변경 여부와 미해결 review thread 0/충돌 없음 확인 → 준비한 보완을 branch 1회 이동하여 PR `synchronize`로 Full CI 생성. edited 메타데이터 이벤트가 생기면 반드시 **metadata-only ≠ full CI**로 구별. 새 Run/Attempt/Head의 required quality/e2e/docker 및 Trusted QA는 실제 완료 전 PASS 아님.

### 누적 범위 및 인계

- 과거 **실제 실패 테스트 파일 합집합: ∅** — 실행된 제품 테스트 자체가 없었다. 의미는 “테스트 전부 성공”이 아니라 “미실행”이다.
- 기존 Run이 취소되거나 재실행된 시도가 추가 확인되면 원본을 소급 수정하지 말고 F-002 이후 새 절을 추가한다.
- 담당: Manager=PR metadata/Work Packet/doc 영향 및 최종 판정; infra=Git 변경 묶음 게시·CI Run 증거; frontend=후속 UI 실제 구현·테스트; qa_docs=증거 검토. 이번 재작업은 **문서 CI 정상화**, 제품 구현·main merge·GHCR·Issue Close 제외.
- 완료 조건(이번 요청): 새 Head를 반영한 **새 Full PR CI 실행 시작**. 모니터링·CI 성공·Trusted QA PASS·Owner 병합 승인은 후속 실제 결과 없이는 주장하지 않는다.
