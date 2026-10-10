# Issue #582 Work Packet — Main CI 실행명 단일 행 간소화

- issue: [#582](https://github.com/planner77/masterGantt/issues/582)
- pr: [#584](https://github.com/planner77/masterGantt/pull/584)
- base_main: `36b0eaa74a0614a76d1ed867bddb548149feb4bc` (2026-10-10 정렬 기준)
- branch: `ci/issue-582-main-run-name`
- previous_head: `5ed043dff398b6420e4f8af243c2e32a050b29af`
- risk_level: HIGH
- risk_reason: `.github/workflows/ci.yml` / Finalizer 및 CI 검증 스크립트·운영 지침은 #580에서 보호된 CI/QA 실행·정책 경계
- qa_required: true
- qa_method: AGENT (보호된 파일이 있어 AUTOMATED_MANAGER 대체 불가)
- reviewer: 별도 qa_docs 또는 지정된 독립 인간 Reviewer의 최신 Head 검토 필요; 현재 NOT TESTED
- manager_decision: NOT TESTED (별도 명시적 승인 필요)
- release_required: false
- release_authorized: false
- application_version: 유지 (제품 기능·DB·릴리스 변경 없음)
- phase: REWORK / DOCUMENTATION_SYNC / NEW PR CI START (병합 제외)

## 구현·검증 범위

1. Main CI는 Merge 이전에 생성된 `Issue #N · PR #P · 한글 요약` 단일행 커밋 메시지에 대해 간결한 실행명을 표시한다. 기존 merge/직접 Push는 SHA fallback을 유지한다.
2. Finalizer는 중복된 Main CI 표시명을 상속하지 않되, main run number/attempt 및 exact SHA 기반의 lifecycle authority를 유지한다.
3. `scripts/main_ci_run_name.py` 및 `scripts/verify-ci-run-trace.py`와 lifecycle 정적 검증이 새·구형 제목/거부 입력을 검사한다. GitHub Actions expression의 형식 검증 한계를 별도로 명시한다.
4. CI 필수 Quality/Chromium E2E/Docker와 릴리스 보호/권한을 변경·완화하지 않는다. 이전 PR CI의 SUCCESS는 새로운 Head의 PASS로 재사용하지 않는다.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 HIGH/AGENT 정책은 #580에서 확정됐으며 본 이슈에서는 정책을 수정하지 않음)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 검증 정책 자체는 변경하지 않고 현재 CI 로그·검사 결과만 활용함)
- `DESIGN.md`: N/A(제품 화면 디자인/도메인 기능이 아닌 GitHub CI 표시명 개선)
- `docs/API.md`: N/A(서버 API 동작과 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB 모델·마이그레이션 변경 없음)

## AC_TEST_COVERAGE

- AC1: `scripts/main_ci_run_name.py` 생성·파싱 회귀 및 `scripts/verify-issue-lifecycle.py` Main run-name 정적 계약; 실제 Main 표시명은 병합 후 확인 예정
- AC2: `scripts/verify-issue-lifecycle.py` Finalizer run/attempt·SHA fallback 정적 검증; 실제 Finalizer 실행은 병합 후 별도 실증
- AC3: `scripts/verify-ci-run-trace.py` 정상/구형 merge/수동 Push·PR metadata·Dependabot 시나리오와 malformed subject 실패 검증
- AC4: 기존 PR CI #2377.1에서 Quality/E2E 6샤드/Docker SUCCESS 확인; 변경된 새 Head의 전체 CI 검사 결과는 새 Run ID로 별도 확인
- AC5: `AGENTS.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `docs/TEST_PLAN.md`, `docs/GENERIC_RELEASE_FINALIZER.md` 계약과 문서 영향표 비교
- AC6: CI/QA 보호 파일 수정은 #580 신뢰된 base validator의 protected_paths 검증에 의해 자동 PASS 불허; 기존 required checks·release authority 보존과 별도 독립 QA 검토 필수
- AC7: 제품 버전·기능·런타임 DB·릴리스 승인 불변; Main 병합/GHCR/태그 생성/Issue 종료는 이번 범위에서 실행하지 않음

## 2026-10-10 — PR CI #2377.1 QA Final BLOCKED 원인 및 REWORK

- 원격 실행: [PR CI #2377.1](https://github.com/planner77/masterGantt/actions/runs/38036884036) / Head `5ed043dff398b6420e4f8af243c2e32a050b29af`
- 필수 세 aggregate, 실제 E2E 6샤드 및 Docker smoke는 모두 SUCCESS.
- 실패 Job: `QA Final — Automated`, Job `114172458209`. 기본 브랜치의 신뢰된 `scripts/qa_final_automated.py`가 `PR 본문 risk_level의 명시값 필요`로 BLOCKED 반환.
- 메타데이터 보완: PR 본문에 `risk_level: HIGH`, `qa_method: AGENT`, `qa_required: true`, 보호 경로·근거·실제 미검증 상태를 명시. Issue 인수 조건을 원래 체크리스트의 AC1~AC7로 구조화하고 본 Work Packet에 테스트·문서 영향 매핑을 기록.
- **정책상 남는 차단:** 보호된 `.github/**`, `scripts/**`, `AGENTS.md`, `docs/CI_CD.md` 등 파일이 PR에 포함돼 있어 #580 자동 QA는 위험도 메타데이터를 추가하더라도 `protected_paths()`에서 BLOCKED가 정상이다. 이를 CI 불량으로 위장해 자동 승인·skip·권한 완화하지 않는다. 별도 독립 Reviewer의 최신 Head QA_FINAL PASS 및 Manager ACCEPT 전 병합 금지.
- 완료 조건: 새 exact-Head PR CI 시작 기록, 새 Quality/E2E/Docker 및 자동 QA의 결과 구분. `QA Final — Automated`의 정책상 BLOCKED를 PASS로 보고하지 않는다.

## 2026-10-10 — PR CI #2381.1 보호 범위 자동 QA 차단, 후속 #595 연결

- 원격 실행: [PR CI #2381.1](https://github.com/planner77/masterGantt/actions/runs/38038527473), Head `3f5f266a64406144aa07c72055fdf47b0ee3e0d3`, overall FAILURE.
- 확인 결과: Quality aggregate PASS, E2E 6/6 PASS, Docker Smoke PASS. 유일한 실패는 [QA Final — Automated Job](https://github.com/planner77/masterGantt/actions/runs/38038527473/job/114177183425)으로 `automated_qa=BLOCKED`.
- 실제 차단 근거: `.github/workflows/ci.yml`, `.github/workflows/release-finalizer.yml`, `AGENTS.md`, `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`, `scripts/main_ci_run_name.py`, `scripts/verify-ci-run-trace.py`, `scripts/verify-issue-lifecycle.py`의 **보호된 CI/QA 실행·정책 변경** 감지. PR `risk_level=HIGH` / `qa_method=AGENT`는 정확하며, 이 보호 판단은 #580의 의도된 fail-closed 동작이다.
- 관련 설계·해소 Issue: [#595 — AGENT/보호 파일 독립 QA 승인 경로와 자동 QA 상태 분리](https://github.com/planner77/masterGantt/issues/595). 관련 신뢰 경계 안정화는 [#593](https://github.com/planner77/masterGantt/issues/593)과 별도 처리한다. #595가 설계·검증·채택되기 전에는 본 PR에서 #580 정책/보호 파일 검출을 우회하거나 자동 PASS로 변환하지 않는다.
- 본 보완 범위는 재현 증거·QA 문서/Work Packet 정합성 갱신이다. Head가 바뀌면 신규 PR CI를 시작하지만 기존 #580 base validator가 변하지 않은 경우 **QA Final 자동 차단이 다시 발생하는 것이 예상 결과**이다. 이를 배포 코드 실패나 인수 PASS로 오해하지 않는다. 신뢰 가능한 별도 `qa_docs` 또는 승인된 인간 Reviewer exact-Head 검토 및 Manager ACCEPT는 별도 증거로 필요하며, 미확보 시 MERGE_READY=BLOCKED이다.
- 기존 3개 required check, Ruleset, Main/GHCR/exact SHA, version, release authority는 무변경. CI 전체 SUCCESS 확보에는 후속 #595의 안전한 공식 승인 경로 정비가 선행된다.

## 2026-10-10 — PR CI #2385.1 정책 차단 재확인 및 reserved prefix fail-closed 강화

- [PR CI #2385.1](https://github.com/planner77/masterGantt/actions/runs/38040032290), Head `b34ea4ddf73eccbd9092890cddf75986e74919b1`: Quality/E2E6/Docker required gate 모두 PASS, `QA Final — Automated`만 변경된 보호 Workflow/정책 파일에 대한 독립 QA 요청으로 BLOCKED. Job `114180812375`의 로그에서 `protected_paths` 목록 및 `independent QA: NOT TESTED` 확인. 이전 #2381.1과 동일 정책상 예상 차단이므로 재실행만으로 전체 SUCCESS가 되지 않는다.
- 이와 별개로 코드 검토에서 `scripts/verify-ci-run-trace.py::validate_push()`의 `Issue #` 접두어에 ` · PR #` 구분자가 아예 없으면 **정상 직접 Push fallback으로 오인**하던 작은 예외를 발견했다. 예약된 `Issue #` 접두어는 표준 제목으로만 허용하여 이런 malformed 입력도 `TraceError` fail-closed 처리한다.
- `scripts/verify-issue-lifecycle.py`에 미완성 접두어/PR 구분자 누락/추가 본문 사례를 추가한다. 기존 GitHub Actions `run-name` 사전 평가 및 정상 직접 Push·구형 Merge 추적·권한·required checks 불변.
- [#595](https://github.com/planner77/masterGantt/issues/595) 독립 QA 보호 파일 승인/실행 상태 설계가 적용되기 전에는 `AGENT + protected` 경로의 자동 QA BLOCKED를 변경하지 않는다. 이 PR CI 신규 실행은 표준 제목 검증 회귀의 결과만 확인하며 QA_FINAL PASS가 아니다. 병합과 Main CI는 현재 범위에서 제외한다.

## 2026-10-10 — CI #2397.1 보호 Gate 재현 및 Unicode 제목 스푸핑 보완

- [PR CI #2397.1](https://github.com/planner77/masterGantt/actions/runs/38043637922) / Head `124fb4980780472ed853b0e55d0f9cacc2d4dbb6`: Quality/E2E6/Docker **모두 PASS**, `QA Final — Automated`만 protected Workflow/검증 스크립트 변경으로 **BLOCKED**하여 전체 workflow FAILURE. 제품/빌드 오류가 아닌 #595([PR #597](https://github.com/planner77/masterGantt/pull/597))의 승인 경로 선행 조건.
- 실질 코드 보완: `scripts/main_ci_run_name.py`의 요약 문자열에서 C1 제어문자, bidi override, zero-width format 및 Unicode 줄/문단 구분 문자가 ASCII 제어 검사에서 누락된 위험을 발견. `unicodedata.category`의 Cc/Cf/Cs/Zl/Zp 검사로 canonical Merge 제목 생성·파싱·Main Push trace가 해당 문자를 모두 fail-closed 처리한다.
- `scripts/verify-issue-lifecycle.py`에 신규 malformed Unicode 제목·생성기 부정 회귀를 추가하고 `docs/CI_CD.md` 및 `docs/TEST_PLAN.md` 검증 경계를 동기화한다. 기존 #580 CI/QA validator, Job 분기, 권한, 세 required aggregate, GHCR/release/보호 정책을 변경하지 않는다.
- 새 Head PR CI 실행 결과는 실제 Run 확인 전 NOT TESTED. 보호 파일을 포함하므로 `QA Final — Automated`가 현행 main 정책상 BLOCKED될 것이 예측된다. 이를 숨기거나 자동 PASS로 바꾸지 않으며, 정확한 Head 독립 QA/Manager 승인 및 #595의 안전한 공식 절차 확보 전 MERGE_READY=BLOCKED.
