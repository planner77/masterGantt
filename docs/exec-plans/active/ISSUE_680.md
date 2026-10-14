# Issue #680 — 병합 후 Main CI #2745 Milestone canonical GET transport 복구

## 근거·상태
- 선행: [#618](https://github.com/planner77/masterGantt/issues/618) / 병합 [PR #678](https://github.com/planner77/masterGantt/pull/678) / SHA `59fa8f9e8743e03699741a654038b3086c0e1778`. 최초 Main [CI #2745.1](https://github.com/planner77/masterGantt/actions/runs/38512238015) FAIL: Chromium Shard2 `milestone-stage-editor.spec.ts:53` / `GET /api/projects/{publicId}` ECONNRESET. 다른 5 Shard 및 Quality/Build/Docker PASS, GHCR 후보 게시 SKIPPED.
- #618은 이미 merged 및 issue closed이므로 해당 PR의 재병합·과거 실패의 소급 PASS 금지. 수정은 새 Issue #680의 단일 변경이다.
- baseline main: `59fa8f9e8743e03699741a654038b3086c0e1778`; candidate version `0.111.0` 유지. `release_required=false`, `release_authorized=false` (테스트 복구 자체의 신규 SemVer 승인 없음; #618의 별도 release 의무는 삭제하지 않음).
- risk_level=HIGH; qa_required=true; qa_method=OWNER_MANAGED; manager_decision=NOT TESTED; merge_ready=BLOCKED (새 CI/Trusted 전).
- 실행 방식: 연결 GitHub API에서 파일·커밋/PR 생성. 별도 로컬 Next/Playwright 실행 환경이 없어 로컬 전체 브라우저 및 운영 환경은 NOT TESTED. 원격 CI를 최종 판정한다.

## 원인·계약
- Milestone Editor는 Task 정보/소속 저장·기존 동일 ID/Gantt 상태를 실제 SQLite-backed isolated Next server에서 검증한다. 저장 후 canonical GET이 `apiRequestContext.get: read ECONNRESET`을 던졌으며, 응답 상태·payload mismatch의 증거는 없다. 이미 존재하는 `observeIsolatedApi` 실패 진단은 변경하지 않는다.
- 도구: 설치 `@playwright/test 1.63.0`. 기존 `observeIsolatedApi`가 첫 번째 read-only GET의 ECONNRESET과 process/cgroup/health 진단을 기록한 후 외부 catch가 이 오류만 최대 한 번 재조회한다. Playwright 내부 `maxRetries`는 관측기를 우회할 수 있으므로 사용하지 않는다. HTTP 4xx/5xx·잘못된 JSON·자료 불일치는 재시도하지 않는다. 기존 자동 통합 `POST/PATCH/PUT/DELETE` 재시도 0.
- read-only GET 성공 시 반드시 HTTP 200을 검사하고 기존 canonical revision+1, 이름·소속 저장, PATCH1, rollback, 5폭 geometry·focus·Gantt 인스턴스 불변을 유지한다. retry success를 서버 안정성 원인 해결로 표현하지 않으며 서버 종료/OOM/진단 필요성은 후속 조사 가능.
- 비교 증거: #618 PR CI #2743.1 Shard5 다른 read-only Resource Calendar GET ECONNRESET → #2744.1 GET-only bounded retry 후 전체 PASS. 동일 실패 유형이지 같은 서버 원인을 증명하지 않는다.

## GSC / 누적 시나리오
- 표준 `GSC 1.0.0-candidate` (`REVIEW_PENDING`), 기준 문서 commit `59fa8f9e8743e03699741a654038b3086c0e1778`의 `docs/GANTT_STATE_CONSISTENCY.md`, `docs/GANTT_STATE_CONFORMANCE.md`, `docs/GANTT_ADAPTER_ADR.md`, `docs/GANTT_SYNC_TRACE.md`, `docs/exec-plans/active/GANTT_STATE_REMEDIATION.md`.
- 적용: GSC-01 canonical 서버 단일 권위·조회 mutation0, GSC-03 확정 저장 후 읽기 실패 시 허위 저장/재mutation 금지, GSC-08 실제 HTTP200·canonical 비교, GSC-09 같은 Task ID/인스턴스 불변, GSC-11 기존 단언·원본 실패 기록 보존, GSC-12 exact-run·미검증 분리. GSC-02/04/05/06/07/10 Core/axis/viewport/lease writer 변경 없음.
- SC-05의 timeout/실패 분기 일부, SC-11/13의 Editor 왕복·저장·focus 불변을 기존 #461 E2E로 검증. 나머지 전체 SC-01~14, actual SVAR Core/DB production stress는 이번 test-only patch만으로 신규 PASS 주장 금지. 예외 ADR 없음.

## DOCUMENTATION_SYNC
- `docs/exec-plans/active/ISSUE_680.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `AGENTS.md`: N/A(에이전트 운영 규약 및 역할·승인·CI 의무를 변경하지 않음)
- `docs/GITHUB_OPERATIONS.md`: N/A(GitHub 병합·Main CI·GHCR 게시·Finalizer 운영 계약을 변경하지 않음)
- `docs/CI_CD.md`: N/A(Workflow·Required Check 및 Main 이미지 파이프라인 설정을 변경하지 않음)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 검증 구성과 신뢰 경계·환경별 판정 기준을 변경하지 않음)
- `DESIGN.md`: N/A(제품 시각 디자인·컴포넌트·레이아웃은 변경하지 않음)
- `docs/PROJECT_UX.md`: N/A(프로젝트 화면 전환·사용자 경험·포커스 구현을 변경하지 않음)
- `docs/TASK_EDITOR.md`: N/A(Task Editor 제품 동작·권한·저장 기능 변경 없이 테스트 읽기만 보완함)
- `docs/API.md`: N/A(서버 라우트·HTTP 계약과 오류 응답 정책을 변경하지 않음)
- `docs/DB_SCHEMA.md`: N/A(데이터베이스 스키마·마이그레이션·영속 구조를 변경하지 않음)
- `docs/SECURITY.md`: N/A(인증·권한·Origin 및 보안 게이트 구현을 변경하지 않음)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정 계산·Milestone 도메인 규칙과 스케줄링 엔진을 변경하지 않음)

## AC_TEST_COVERAGE
- AC1: 원본 CI #2745.1 Shard2/Job 출처와 71PASS·1FAIL/5shard PASS 및 GHCR SKIPPED 증거 보존.
- AC2: `milestone-stage-editor.spec.ts` read-only GET에만 observer 선진단 후 ECONNRESET 1회 외부 재시도, HTTP200, 기존 assertions/POST/PATCH 무재시도: diff 정적 검토. E2E 원격 PASS 전 NOT TESTED.
- AC3: 전체 PR Required Quality/E2E6/Docker + Trusted QA/리뷰 0/최신 main: 새 Head 원격 검증 전 NOT TESTED.
- AC4: 별도 PR 병합 후 새 Main push CI 및 임시 GHCR `ci-<full SHA>` digest/SBOM/provenance + Release Finalizer: 원격 증거 전 NOT TESTED.
- AC5: 재발 시 isolated-application diagnostics/process/cgroup/OOM/runner 동시성 조사; 네트워크 원인 단정 금지.

## 승인·후속
기존 PR #678을 다시 병합하지 않는다. 이 수정 PR의 정확한 Head에서 세 Required, Trusted QA 및 미해결 리뷰0, Owner 명시 병합 지시·잔여 위험 수용 확인 후에만 병합한다. Main CI 성공 이후 GHCR 임시 이미지와 Finalizer를 순서대로 검증한다. 정식 `0.111.0` tag/GHCR stable/Release는 별도 버전 승인 gate를 따른다.

## Preflight #2746.1 정책 정렬

- 새 PR #681의 [CI #2746.1](https://github.com/planner77/masterGantt/actions/runs/38514834346)는 source 테스트 실행 전에 QA Preflight FAIL: `PATH_POLICY` 최소 HIGH vs MEDIUM, `ISSUE_AC` Issue #680 AC1.. 이름 누락. 기존 세 Required Aggregate는 따라서 진짜 E2E 실패가 아닌 사전 차단으로 FAILURE 집계됐다.
- Issue #680 본문 AC1~AC7 명시와 `risk_level=HIGH`, PR #681의 HIGH 및 Work Packet HIGH를 동일하게 정렬한다. 정책 검사 코드는 변경하거나 완화하지 않는다. 수정 후 정확 Head 전체 PR CI/Trusted QA 결과를 재확인하며 원본 #2746.1은 실패 기록으로 보존한다.

## QA Preflight #2748.1 보완 기록

- [Run #2748.1](https://github.com/planner77/masterGantt/actions/runs/38514972556)에서는 PATH_POLICY 및 ISSUE_AC가 PASS. DOCUMENTATION_SYNC에서 `docs/SCHEDULING_ENGINE.md` 영향 기록이 없어 FAIL. Scheduling Engine 구현·일정 계산/Dependency/Calendar 수정이 없는 test-only GET transport 회복이므로 해당 문서는 N/A로 명시했다. QA policy/기준 docs 자체는 변경하지 않는다. 원본 Run의 실패는 보존하고 이후 새 Head Full CI를 재검증한다.

## PR #681 P2 리뷰 반영 — 진단 보존
- [Codex P2](https://github.com/planner77/masterGantt/pull/681): APIRequestContext 내부 `maxRetries:1`은 첫 ECONNRESET을 자동 흡수해 `observeIsolatedApi`의 transport_failure 기록/건강·프로세스·cgroup 자료를 누락시킬 수 있다.
- 이를 인정하여 재조회는 **관측기 바깥에서** 처리한다. 먼저 `apiRequest.get(api)`(관측기가 실패를 기록·진단) → `catch`에서 Error.message의 정확한 `ECONNRESET`만 판단 → 두 번째 `apiRequest.get(api)` 최대 한 번. 다른 exception/HTTP 오류는 그대로 FAIL. 독립 diagnostics helper를 변경하지 않는다.
- 미검증: 실제 첫 연결 종료, 실제 cgroup OOM/Next 프로세스 상태 또는 재시도 성공률은 로컬 실증하지 않았다. 원격 전체 PR CI 및 Trusted QA가 별도로 필요하다.
