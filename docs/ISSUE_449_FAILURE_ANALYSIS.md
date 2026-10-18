# Issue #449 / PR #458 — 누적 PR CI 실패 분석 원장

Primary Issue: [#449](https://github.com/planner77/masterGantt/issues/449) | PR: [#458](https://github.com/planner77/masterGantt/pull/458) | 최초 작성: 2026-10-18 (KST)
공통 Source of Truth: [PR_CI_FAILURE_TRIAGE.md](PR_CI_FAILURE_TRIAGE.md).
**이 파일은 #449 전용 누적 원장**이다. 후속 PR·Run·Attempt 실패는 기존 기록을 지우지 않고 같은 파일에 이어서 기록한다. 다른 Issue의 실패를 이 원장의 실패 건수에 합산하지 않는다.

## 1. 접근 가능한 전체 PR CI 실행 목록

2026-10-18 원격 GitHub Actions의 PR branch `docs/issue-449-ui-ux-audit` / `pull_request` 실행 목록 2건을 조회했다. 해당 브랜치의 이전 metadata-only 및 다른 이벤트/관련 이슈 CI까지 완전 회수했다는 주장은 하지 않는다.

| PR / Run·Attempt | Source·event | Required 집계·실제 검사 | 원본 결론 |
| --- | --- | --- | --- |
| #458 / [#1832.1 · 37313760348](https://github.com/planner77/masterGantt/actions/runs/37313760348) | HEAD `c9fe35f131af10a907702a59a90bd70a9a4d77da`; 2026-10-05 `pull_request`; 당시 Base/test-merge는 본 조회에서 재교차하지 않아 UNKNOWN | 과거 문서 PR의 CI 전체 결론 SUCCESS; **현재 HEAD의 PASS 근거로 재사용 불가** | **SUCCESS** — 실패 건 아님 |
| #458 / [#2934.1 · 39089429716](https://github.com/planner77/masterGantt/actions/runs/39089429716) | HEAD `84004e9d6fe84905777bd3130656a5ab35eaa9de`; Base `d2768676aa7a0edff67df9bdeb3e1b49979fd577`; test-merge `6906dbea79697e80b436e991116733ac71576257`; 2026-10-18 02:15:19Z `pull_request` | Quality/E2E/Docker **required aggregate 세 개 SUCCESS**. 문서 전용 change: Chromium 실제 shard, TypeScript/ESLint/Vitest/build/Docker smoke는 **SKIPPED**, E2E/Docker 집계 SUCCESS를 실제 테스트 실행 PASS라 주장하지 않는다 | **FAILURE** — QA Final 미해결 리뷰 게이트 |

원본 Fail #2934.1의 Job/Step:
- `변경 경로 판정` #117562787360 SUCCESS; `QA Final 신뢰 경계 확인` #117562787537 SUCCESS; `QA Preflight` #117562816376 SUCCESS; `정책·저장소 계약 검사` #117562856778 SUCCESS; `PR 빠른 검사 판정` #117562984483 SUCCESS.
- Required `Build, static checks, and unit tests` #117563014459 SUCCESS; `Chromium end-to-end tests` #117563014425 SUCCESS; `Docker build and runtime smoke test` #117563014429 SUCCESS. 문서 변경에 따른 구현 Job SKIPPED는 별도 보존.
- **직접 실패**: `QA Final — Automated` [Job #117563033524](https://github.com/planner77/masterGantt/actions/runs/39089429716/job/117563033524), Step `최신 PR 증거·문서·리뷰 확인 (read-only)` → `자동 QA: BLOCKED`, `사유: 미해결 review thread`, exit 1 (2026-10-18 02:16:48Z). 이는 Quality/E2E/Docker의 결함 또는 실패에서 파생된 결과가 아니다.
- 원본 Artifact: [qa-final-automated-39089429716-1](https://github.com/planner77/masterGantt/actions/runs/39089429716/artifacts/12122385971), [qa-preflight-39089429716-1](https://github.com/planner77/masterGantt/actions/runs/39089429716/artifacts/12122206436), [ci-pr-source-39089429716-1](https://github.com/planner77/masterGantt/actions/runs/39089429716/artifacts/12121862028). 세 개 모두 조회 시 만료되지 않음. Artifact 내용 자체에 대한 독립 증거 검증은 별도로 하지 않았다.

## 2. 누적 실패 집합 및 Cross-run 매트릭스

| ID / 발생 | 최초 실제 실패·원인 | 이전 이력과의 관계 | 보완 및 검증 |
| --- | --- | --- | --- |
| **F-449-001** · PR #458 / #2934.1 / QA Final #117563033524 | `POLICY_CI`의 **정상 fail-closed 리뷰 보호**: 미해결 GitHub review thread `PRRT_kwDOUUB7Bc6tmh-g`. Codex P1 [comment #4305390765](https://github.com/planner77/masterGantt/pull/458#discussion_r4305390765)은 오래된 HEAD `c9fe35f` 기준으로 활성 PLAN에 #449 rollout이 없다고 지적함 | 기존 #1832.1은 성공, 해당 P1 코멘트는 이번 #2934.1 실행 중 02:16:17Z에 추가됨. QA Final 확인 시각은 02:16:48Z. 사전 조회 thread 0에서 완료 시 새 미해결 thread 1로 변한 **시점 차이**가 직접 원인. 제품/fixture/test 계약 FAIL은 관찰되지 않음 | 현재 HEAD의 [활성 PLAN](exec-plans/active/PLAN.md) 최상단 #449 및 [전용 Work Packet](exec-plans/active/ISSUE_449.md)에 실행 범위·소유권·완료/미검증 상태·문서 동기화가 이미 반영됨을 대조했다. [해결 근거 답글 #4305415726](https://github.com/planner77/masterGantt/pull/458#discussion_r4305415726) 뒤 같은 thread를 GitHub **resolved=true**로 전환했다. 검증기/Required check·리뷰 기준은 변경하지 않음. 새 HEAD의 QA/CI PASS는 **NOT TESTED** |

**누적 실제 실패 테스트 파일 합집합: 공집합**(원본 Run에서 실패한 제품/테스트 파일 없음). 실패 검증기 소비자는 신뢰된 main의 `scripts/qa_final_automated.py` 및 GitHub reviewThreads 상태다. 이것은 앱 E2E 전체가 실제 실행됐다는 의미가 아니다.

## 3. 부수적인 로컬 BLOCKED 기록 — PR CI 실패 건수에서 분리

기존 [Work Packet](exec-plans/active/ISSUE_449.md)의 2026-10-18 재개 기록에는 대규모 미커밋 main 정렬 중 Pre-PR 준비가 `spawnSync git ENOBUFS`로 **BLOCKED**되었다고 명시된다. 이는 **GitHub Actions 실패가 아니며** 이번 #2934.1 원인도 아니다. 기존 계획은 도구의 버퍼·정책을 변경하지 않고 통합 커밋을 만든 뒤 `verify-prepr --mode=targeted --dry-run`으로 다시 확인하여 `READY/UNKNOWN0/missing0/sourceStable=true`를 보고했다. Dry-run은 테스트 실행/CI PASS가 아니며 동일 후보에서 실제 로컬 모든 검사 수행은 NOT TESTED. 원본 ENOBUFS와 최초 실패를 성공으로 덮어쓰지 않는다.

## 4. 원인 유형별 보완·회귀 영향 분석

- **확정 원인:** `POLICY_CI` — 열린 리뷰 스레드가 있는 PR의 QA Final을 차단한 올바른 정책. 새 리뷰가 사전 체크 이후 도착했고 활성 PLAN 등록을 반영한 최신 HEAD에 대한 재해결 상태가 미갱신된 것이 운영상 실패 원인이다.
- **검토 후 기각:** 제품/CSS 오류, TypeScript, Chromium E2E, Docker build 실패는 #2934.1 직접 원인이라는 증거 없음. 테스트 gate를 비활성화하거나 QA 스크립트를 변경·review finding을 무시하는 해결책은 채택하지 않음.
- **실제 보완:** P1 본문의 활성 PLAN 등재 여부와 소유권·역사/현행 구분을 원격 파일에서 대조; 리뷰에 해결 근거를 답변하고 GitHub API로 **resolved=true**를 확인. #449 전용 원장 신규 등록 및 Work Packet 연결. 변경은 Markdown 두 파일뿐이며 제품·test·CI·QA 정책·release version 불변.
- **선택/제외 검증:** 직접=해당 review thread 상태, active PLAN §449, Work Packet DOC_SYNC/AC1~AC8, origin main/base/head, PR docs-only diff; 교차=기존 QA Preflight/Required aggregate 원본 상태 보존; 음성=새 product/test 변경·gate 완화·의도치 않은 전역 docs 변경 없음. 로컬 Node/Chromium E2E는 이 세션에서 실행하지 않아 NOT TESTED.
- **남은 위험:** 신규 리뷰가 CI 시작 후 다시 제기되거나 변경된 HEAD에 대한 QA·메타데이터 판정이 달라질 수 있음. #517 실제 환경 검증·Epic 최종 수용은 별도 NOT TESTED/BLOCKED이며 #449를 종료하지 않는다.

## 5. 신규 PR CI 시작·인계 경계

- 등록 전 원본 PR HEAD: `84004e9d6fe84905777bd3130656a5ab35eaa9de`; Base/main: `d2768676aa7a0edff67df9bdeb3e1b49979fd577`; 기존 test-merge: `6906dbea79697e80b436e991116733ac71576257`. 새로운 commit의 정확한 HEAD/test-merge/run은 게시 후 다시 조회하여 #449/PR 댓글에 별도 기록한다.
- P1 thread를 실제 GitHub에서 resolved 확인. 문서 두 파일의 원자적 fast-forward commit으로 새 `pull_request synchronize` Full PR CI 등록을 요청한다. **등록 시각 결과는 NOT TESTED**; 사용자 요청대로 새 CI의 결과는 모니터링하지 않는다.
- 위험 LOW/OWNER_MANAGED, 사전 독립 문서 검토는 이전 HEAD의 근거일 뿐 새 QA_FINAL/Trusted QA/Owner ACCEPT가 아니다. `release_required=false`, `release_authorized=false`; 병합·main CI·GHCR·이슈 종료 금지. 후속 CI 재실패 시 이 원장 F-449-002 이후에 Run/Attempt 및 이전 실패 합집합을 **append-only**로 기록한다.
