# Issue #790 — 누적 PR CI 실패·결정 원장 (2026-10-31)

Primary [#790](https://github.com/planner77/masterGantt/issues/790) · 상위 [#444](https://github.com/planner77/masterGantt/issues/444) · [PR #863](https://github.com/planner77/masterGantt/pull/863) · [누적 실패 정책](PR_CI_FAILURE_TRIAGE.md)

## 1. 소스 및 범위

- 구현 기준 Main `3c73737968dfdbd6817657f3a17bed07c209a528`, 앱 `0.138.5`, Chromium 8-shard, 브랜치 `ci/issue-790-cache-audit-current-main`.
- 과거 [PR #791](https://github.com/planner77/masterGantt/pull/791)의 Head `b5898d49b4e0f8b610744bc22494b12687d29473` / Base `4ce403a1e410ca599a780446f39513e1f1158326` / 앱 `0.130.2`와 [Full #3218.1](https://github.com/planner77/masterGantt/actions/runs/40056085324) 성공은 역사적 증거일 뿐 신규 Head의 PASS가 아니다.
- 비교 CLI·정/음성 테스트·문서만 변경한다. 실제 캐시 writer·workflow/Required3·제품 SemVer·DB/API/UI 및 GHCR 정식 릴리스 권한은 불변이다.

## 2. 역사적 정량 관측 — 현행 인과관계 미확정

| 기록 | 관측 및 출처 | 분류·결정 |
| --- | --- | --- |
| H790-001 | [기준 Run 38109419594](https://github.com/planner77/masterGantt/actions/runs/38109419594) vs [후속 Run 40046472198](https://github.com/planner77/masterGantt/actions/runs/40046472198): PR Docker 97.482→90.520초, Job `docker_smoke`→`pr_docker_smoke` | `REVIEW_REQUIRED` / 같은 workload 미증명, `ADOPT` 보류 |
| H790-002 | Main Docker 112.402→144.491초(+28.55%), runner-minutes 증가 | `REGRESSION_CANDIDATE` / 원인 `UNKNOWN`, #444에 인계 |
| H790-003 | [2026-10-31 준비도 41149264718](https://github.com/planner77/masterGantt/actions/runs/41149264718): PR 14/19·최소 성공 5/10, Main 20/10, Release 25/10 | `COLLECTING` / 신규 캐시 확대 금지 |
| H790-004 | 구 PR #791은 앱 0.130.2의 오래된 CI 계약 | `STALE_SOURCE` / 최신 Main 선택 이식 |

## 3. 누적 실패 원본과 교정

| 실패 ID | Run/Attempt 및 정확한 소스 | 직접 실패·파생/미실행 | 원인·조치 |
| --- | --- | --- | --- |
| F790-001 | [PR #863 Full #3452.1 / Run 41162179454](https://github.com/planner77/masterGantt/actions/runs/41162179454), 2026-10-31 03:02 UTC; Head `d84f2e2a59aca30bc4aca9ebb126d1f2f021a3f5`, Base `3c73737968dfdbd6817657f3a17bed07c209a528`, Test-Merge `7e8c7ce2d7cc71bd3ee2e82d00b384db0b17672d` | Quality `SUCCESS`, Chromium E2E 집계 `SUCCESS`, Docker `SUCCESS`; QA Final Job `124423225894`만 `BLOCKED`(exit 1). 일부 직접 E2E shard는 선택 정책으로 `SKIPPED`여서 8/8 실검증 PASS 아님. | `POLICY_CI`: 미해결 P1 문서 리뷰 스레드. 새 한글 문서 교정·리뷰 해결 후 새 Head 재검증. |

- **최초 실패 로그:** [QA Final Job](https://github.com/planner77/masterGantt/actions/runs/41162179454/job/124423225894)의 `자동 QA: BLOCKED`, `사유: 미해결 review thread`. 아티팩트 `qa-final-automated-41162179454-1`(ID `13027402805`). 기존 FAIL을 PASS로 덮지 않는다.
- **Codex P1:** [미해결 스레드](https://github.com/planner77/masterGantt/pull/863#discussion_r4430085648)에서 `AGENTS.md`의 CI/CD 한글 작성 규칙 위반을 지적했다. 신규 `AGENTS.md`·`docs/CI_CD.md`·`docs/GITHUB_OPERATIONS.md`·`docs/REMOTE_VALIDATION.md`·본 실패 원장과 인접 #444/#790 계획·실측의 사람이 읽는 안내를 한글화한다. SHA/Run ID/경로/CLI 옵션/자동화 상태 코드는 원문으로 유지한다.
- **전체 직접 실패 테스트 파일의 합집합:** 없음. TypeScript, ESLint, Vitest, 정책 검사, PR Next Build·Docker 구현은 최초 Run에서 성공했다. 정책·리뷰 차단을 제품 오류로 해석하지 않고 `SKIPPED`/`NOT RUN`을 PASS로 간주하지 않는다.

## 4. 검증 경계 및 인계

- `tests/scripts/ci-cache-phase2.test.ts`는 `EXTEND`, `tests/scripts/ci-setup-provenance.test.ts`·`tests/scripts/ci-setup-readiness.test.ts`·`scripts/verify-ci-cache-contract.mjs`는 `KEEP_UNIQUE`. 서로 다른 성공 Run 최소 10개, 동일 workflow/event/metric, 출처, 중복/비정상 비용/변경 Job 음성 조건 유지.
- JSON `requireBoundProvenance`는 독립 인증이 아니므로 개선된 같은 Job도 `REVIEW_REQUIRED / ADOPT=0`다. 테스트 삭제, assertion/skip/retry/timeout 및 Required 게이트 완화 없음.
- **일괄 원인:** 신규 CI 관련 운영 문서의 영문 설명이 한글 작성 정책에 위배되었고 미해결 리뷰가 QA Final을 차단했다. 정책·문서 교정 후 새 Head로 PR CI를 시작한다. 이 환경에서 별도 로컬 Node/Vitest/Docker는 `NOT TESTED`; 기존 Run의 CI 결과는 새 Head에 소급 적용하지 않는다.
- **범위:** 미해결 리뷰 해결·Main 충돌 확인·실패 원장과 문서 갱신·새 PR CI 시작까지. CI 완료 모니터링, 병합, GHCR·Finalizer, Issue 종료는 수행하지 않는다. 새 Head/Run ID는 GitHub 원격 이력에서 별도 추적한다.

## 5. 상위 #444 미완료 보존

- #790은 자기 Head Required·Trusted QA·Owner 수용 및 병합/Main CI·필요 임시 OCI·Finalizer 완료 후에만 종료한다.
- #444는 cache miss/stale/secret 감사, 신뢰 가능한 전후 ROI, Main 비용 원인과 `ADOPT / DO_NOT_ADOPT / INSUFFICIENT_DATA` 결정 전까지 `OPEN` 유지한다.
