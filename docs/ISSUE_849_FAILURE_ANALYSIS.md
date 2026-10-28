# Issue #849 / PR #850 — 누적 PR CI 실패 분석

Primary Issue: #849 | 관련 PR: #850 | 갱신일: 2026-10-29 (KST)
Source of truth: AGENTS.md, docs/PR_CI_FAILURE_TRIAGE.md, docs/ISSUE_LIFECYCLE.md, docs/exec-plans/active/ISSUE_849.md

## 1. PR #850 전체 원격 Run/Attempt 기록

| 원본 Run/Attempt | HEAD 및 단계 | 관측 결과 | 직접/파생/미실행 분리 |
| --- | --- | --- | --- |
| [#3393.1](https://github.com/planner77/masterGantt/actions/runs/40784951385) · 40784951385.1 | `a94bf419c3e927ac2b155da616895b4da176acec` / Draft | FAILURE | Draft 차단이 의도된 동작. Quality/E2E/Docker Required 집계 파생 FAILURE, 구현 테스트 SKIPPED |
| [#3394.1](https://github.com/planner77/masterGantt/actions/runs/40785099400) · 40785099400.1 | `382eb5f67a127538241d4be084a22f4bdfcd2198` / Draft | FAILURE | 동일 Draft 차단, product/lint/typecheck/unit/Chromium8/Docker 구현 미실행 |
| [#3395.1](https://github.com/planner77/masterGantt/actions/runs/40785168680) · 40785168680.1 | `913c4e3b96c18bc408c54298e149e5d5598b94f8` / Draft | CANCELLED | Ready 전환/후속 Run 이후 취소. Required 집계 일부 FAILURE는 취소/skip의 파생, 독립 제품 FAIL 아님 |
| [#3396.1](https://github.com/planner77/masterGantt/actions/runs/40785203891) · 40785203891.1 | `913c4e3b96c18bc408c54298e149e5d5598b94f8` / FINAL_FULL | FAILURE | **F-001 QA Preflight 직접 FAIL**. PR Fast 및 3 Required+자동 QA 파생 FAIL, 구현 검사 NOT RUN |
| Fast Development #190.1 · 40784951407, #191.1 · 40785099377, #192.1 · 40785168679 | Draft 비권위 경로 | CANCELLED | 공식 Full CI나 QA PASS 아님 |
| Fast Development #193.1 · 40785204191 | Ready 비권위 경로 | SKIPPED | 공식 Full CI나 QA PASS 아님 |

- Base SHA: `d7f41dbf7252b378c4eccc49642ac9978c58c57d`, PR #850; 모든 Run Attempt=1. #3396.1 Test merge SHA: `8b890ed0c07a05cabc44c2f8acb3a4f20dc11213`. Draft 이전 Run의 Test merge SHA는 확보하지 못했으므로 UNKNOWN; 파일·기능 PASS를 추론하지 않는다.
- 직접 실패 원본: Job `123156729878`, [QA Preflight](https://github.com/planner77/masterGantt/actions/runs/40785203891/job/123156729878), `FAIL / DOCUMENTATION_SYNC` — `docs/exec-plans/active/ISSUE_849.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — 문서 영향 기록 없음: docs/CI_CD.md`. PR title/Refs, risk/QA flags, Issue AC, path policy는 PASS. 충돌/최신 Full/Owner/review/문서 의미는 DEFERRED.
- 파생 실패 Job: PR Fast `123156865887`, Required Quality `123156993905`, E2E `123156994005`, Docker `123156993849`, QA Final Automated `123157038453`. 정책/Typecheck/ESLint/Vitest/Build/Chromium 8 shard/Docker 실제 smoke는 SKIPPED, 원본 기능 회귀 시험 증거 없음.

## 2. 누적 실패 Cross-run 매트릭스

| 실패 ID | 최초 관측과 종류 | 근거와 원인 | 보완 및 검증/잔여 |
| --- | --- | --- | --- |
| DRAFT-001 | #3393.1 / #3394.1, 의도된 Draft-only Required 차단 | Draft는 공식 Full 경로가 아니며 실제 제품 테스트 없음 | #850 Ready 전환으로 Full 시작. Draft gate 변경 없음 |
| CANCEL-001 | #3395.1, 후속 Run 경합으로 CANCELLED | 취소 Job을 실행 성공으로 볼 수 없음 | 원본 이력 보존. 기능 PASS/FAIL은 UNKNOWN |
| F-001 | #3396.1 / Job 123156729878, 첫 **직접 FAIL** | 신뢰된 Base `scripts/qa_final_automated.py::docs_gate` 정규식은 `- path: UPDATED` 또는 `- path: N/A(reason)` 형태의 **정확한 한 행 끝 상태**만 허용(경로는 Markdown 코드 표기). 구 Work Packet의 `UPDATED: 설명` 및 `N/A(reason): 설명` 행은 인식되지 않아 CI_CD 항목이 누락됨 | Work Packet 모든 DOCUMENTATION_SYNC 기록을 정규식에 맞게 개정. QA 정책 스크립트/필수 게이트 수정 없음. 새 PR Full CI NOT TESTED |
| F-001-LATENT | 같은 문서의 후속 단계, **원격 직접 FAIL 아님** | AC_TEST_COVERAGE가 표만 갖고 있어 `- AC1: ...`~`- AC8: ...` regex 매핑 누락; 첫 blocker 제거 시 다음 단계에서 실패할 가능성 | 기존 AC 표를 삭제하지 않고 bullet AC1~AC8을 보완. 정적 구조 확인만, 원격 PASS 확정 아님 |

## 3. 누적 원인·합집합·수정 및 반례
- 유일한 제품 외 직접 실패 경로: `scripts/qa_preflight.py`이 호출하는 `scripts/qa_final_automated.py::docs_gate` 및 `docs/exec-plans/active/ISSUE_849.md`. 이전 Draft blocked/cancelled aggregate를 각각 별도 코드 실패 또는 브라우저 실패로 합산하지 않는다.
- **재발 방지**: 기존 Work Packet을 단순 개행/설명 유무로 판단하지 않고 base 검증 코드의 **full-line anchor** 형식과 required QA_DOCS 집합, AC1~AC8 bullet 매핑을 한 번에 검사. 기존 문서 영향 의미 및 N/A 근거 보존. Source policy 변경/skip/assertion 완화 없음.
- **교차 영향**: `tests/server/projects/project-issues.test.ts`(상태 CRUD·암호·stale·0034 SQLite), `tests/e2e/project-issues.spec.ts`(기본 filter·KPI·상태열·keyboard), `tests/server/db/database.test.ts` 및 migration CLI·Resource/Process/Logistics exact 0034 version 테스트. 이전에는 한 번도 실행되지 않았으므로 요구한 후속 Full PR에서 독립 검증할 것.
- #838–#840, #846 기존 이슈 원본 실패와 기록은 관련 참고 문서일 뿐, 이번 #849의 직접 CI 실패로 이전하지 않는다.

## 4. 같은 최종 source 검증과 새 PR CI
- 정적 구조 검증: Work Packet `DOCUMENTATION_SYNC` 상태 행의 정확한 전체형식/Required QA_DOCS 및 AC1~AC8 bullet 매핑의 존재를 확인한다. 이 자체는 원격 QA Preflight PASS가 아니다.
- 로컬 npm/node_modules 설치된 저장소 체크아웃이 없으며 GitHub 도구만 사용하므로 `npm run verify:prepr`, TypeScript/Lint/Vitest/Playwright/Docker 실측은 NOT EXECUTED. 코드·Migration·실행 환경 회귀가 없는지 최종 CI 전에는 알 수 없음.
- 새 Head의 Full Quality/E2E8/Docker/Trusted QA 및 Manager ACCEPT는 NOT TESTED. 현재 사용자 지시 범위는 PR CI **시작**; 완료 모니터링/병합/Main/GHCR/운영 Migration/이슈 종료 금지. 결과 수집 시 같은 본 원장에 Run/Attempt·직접/파생/취소/미실행과 수정 이력을 추가한다.
