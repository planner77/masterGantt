# Issue #825 — 누적 CI 실패·복구 원장

Primary Issue: [#825](https://github.com/planner77/masterGantt/issues/825) | 원본 기능 [PR #833](https://github.com/planner77/masterGantt/pull/833) | 갱신: 2026-10-27 KST
운영 규칙: [AGENTS.md](../AGENTS.md), [PR CI Failure Triage](PR_CI_FAILURE_TRIAGE.md), [GitHub Operations](GITHUB_OPERATIONS.md), [Main CI 한 줄 제목](../scripts/main_ci_run_name.py), [Work Packet](exec-plans/active/ISSUE_825.md).
이 원장은 기존 성공·실패의 원본 결론을 수정하지 않는다. 같은 Issue의 PR/QA/Main·로컬 환경 증거를 시간순으로 보존한다.

## 1. 원본 Run/Attempt 이력 (실패·파생·미실행 구분)

| 사건 | 실제 출처 / attempt | Head / Base (해당 시) | 결론 및 최초 직접 원인 |
| --- | --- | --- | --- |
| 원본 PR Full | [#3330.1 / 40455522644.1](https://github.com/planner77/masterGantt/actions/runs/40455522644) | `b66f58843fa29c86bf1756182676b501cbe3fd8f` / `dc8543f390616c0d5aca90a4f91899f3cf7ac5da` | SUCCESS: Quality/Chromium E2E 8/8/Docker |
| F825-QA-001 | [Trusted #979.1 / 40458359626.1](https://github.com/planner77/masterGantt/actions/runs/40458359626), Job `122036866602` | 위 원본 Full 귀속 | FAILURE: `AGENT 보호 파일: 현재 Head에 대한 독립 인간 QA_FINAL: PASS 리뷰 필요`. AGENT 선택의 외부 승인 증거 없음 |
| 정렬 후 PR Full | [#3333.1 / 40470969178.1](https://github.com/planner77/masterGantt/actions/runs/40470969178) | `a7f45f6e5175bc09cf57f565bfb29ac7588edba5` / `09d461f96f4cf99f5addd56d0894500cdbe02ed6` | SUCCESS: Quality/Chromium8/Docker |
| F825-QA-002 | [Trusted #981.1 / 40474635264.1](https://github.com/planner77/masterGantt/actions/runs/40474635264), Job `122089718678` | 정렬 후 Full 귀속 | FAILURE: F825-QA-001과 같은 AGENT 인간 QA 증거 부재 |
| F825-META-001 | [Metadata-only #3334.1 / 40477350603.1](https://github.com/planner77/masterGantt/actions/runs/40477350603), Job `122099029055` | `a7f45f6e5175bc09cf57f565bfb29ac7588edba5` / `09d461f96f4cf99f5addd56d0894500cdbe02ed6` | FAILURE: `PR latest Head stale` — PR 본문 편집과 `66754b9` 갱신이 겹친 **metadata-only 오래된 Head**, 실제 E2E/Build/Docker 새 실행 아님 |
| F825-QA-003 | [Trusted #982.1 / 40477500310.1](https://github.com/planner77/masterGantt/actions/runs/40477500310), Job `122099241158` | 위 metadata-only 원본 귀속 | FAILURE: `API pull_requests와 원본 artifact 불일치`; stale 출처에 대한 파생 신뢰 차단 |
| 최종 PR Full | [#3335.1 / 40477404132.1](https://github.com/planner77/masterGantt/actions/runs/40477404132) | `66754b94e205644b7c24a5dfce85b6266234f72c` / `09d461f96f4cf99f5addd56d0894500cdbe02ed6` | SUCCESS: QA Preflight·Policy·TypeScript·Lint·Unit·Build·Chromium8/8·Docker·Required3·QA Automated |
| 최종 Trusted | [#983.1 / 40481539833.1](https://github.com/planner77/masterGantt/actions/runs/40481539833) | 위 최종 Full 귀속 | SUCCESS: `OWNER_MANAGED`; `independent_qa=N/A`, Owner 위험 승인/업무 의미 검토 별도 |
| **MAIN-825-001** | **[Main #3336.1 / 40484177455.1](https://github.com/planner77/masterGantt/actions/runs/40484177455)** | **merge SHA `7ba1521407e6a1060ef442f1730275d38976f741`** | **FAILURE: 최초 변경 경로 판정 Job `122121700586`, Step7 CI 실행 추적 메타데이터 검증** |

## 2. MAIN-825-001 — 원본 Main 직접 실패 (2026-10-27)

- 실행: [GitHub Main push Run 40484177455.1](https://github.com/planner77/masterGantt/actions/runs/40484177455), `event=push`, `head_branch=main`, `head_sha=7ba1521407e6a1060ef442f1730275d38976f741`, 생성 `2026-10-27T09:53:02Z`, 완료/FAILURE. Main 첫 부모 `09d461f96f4cf99f5addd56d0894500cdbe02ed6`, 두 번째 부모 원본 PR Head `66754b94e205644b7c24a5dfce85b6266234f72c`. PR #833의 새 HEAD Full·Trusted 성공과 정확히 구분한다.
- 첫 직접 오류: `변경 경로 판정` Job **[122121700586](https://github.com/planner77/masterGantt/actions/runs/40484177455/job/122121700586)** 의 `CI 실행 추적 메타데이터 검증` (Step7), `python3 scripts/verify-ci-run-trace.py` exit 1, `2026-10-27T09:53:16Z`: `CI 실행 추적 오류: Issue # 접두어는 정확한 단일 행 표준 Merge 제목만 허용합니다 (번호·PR·한글 요약 형식 확인)`.
- 실제 immutable Merge 메시지의 **첫 줄**은 `Issue #825 · PR #833 · 물류 대시보드 폭·중복 헤더·KPI 정돈`으로 정규 제목에 가깝다. 하지만 빈 줄과 다음 본문이 추가돼 메시지 전체가 `parse_merge_title`에 거부됐다:
  ```text
  Issue #825 · PR #833 · 물류 대시보드 폭·중복 헤더·KPI 정돈

  Merge PR #833 (Refs #825); owner-managed QA, full PR CI #3335.1 and Trusted #983.1 verified. Preserve failure history and release_authorized=false.
  ```
- **확정 원인:** GitHub Merge API 요청자가 `commit_title` 외에 빈 문자열이어야 할 `commit_message`에 장문을 전달. 기존 `AGENTS.md` §Main CI 실행명/ Merge Commit 표준, `scripts/main_ci_run_name.py::merge_api_payload`의 **단일 행 제목/빈 본문/HEAD lease** 의무 위반. 이 실행의 코드/제품, 검증기, 러너 결함 증거는 없다. 분류 `POLICY_CI` / `MERGE_METADATA`; 위반 책임은 병합 오케스트레이션 호출에 있다.
- **파생 결과:** Required `Build, static checks, and unit tests` Job `122121817586` = FAILURE; Required `Chromium end-to-end tests` Job `122121817858` = FAILURE; Required `Docker build and runtime smoke test` Job `122121817682` = FAILURE. 세 Job 공통 직접 표시는 `CHANGES_RESULT=failure`에 대한 집계의 fail-closed이며 **각 구현 Job은 NOT RUN**. TypeScript/ESLint/Vitest/Policy/Next Build/Chromium8 구현 샤드/Docker smoke는 SKIPPED, `Main 임시 commit 이미지 게시·검증·정리` Job `122121865680`도 SKIPPED. `ci-7ba1521...` digest·SBOM·provenance 및 정식 GHCR/Finalizer는 이 Run에서 **NOT TESTED**. Shadow advisory Job의 SUCCESS는 집계 실패를 대체하지 않는다.
- **불변성:** 이 실패 Run ID/attempt/commit/부모·로그를 변경·재실행 성공으로 덮어쓰지 않는다. 이미 원본 push Run이 존재하고 FAILURE이므로 `main_ci_recovery.py`(original push Run 부재용)와 manual dispatch 기반 가짜 복구는 허용되지 않는다. Protected Main force-push/rebase/validator 완화/Required Check 이름·샤드·skip/timeout 수정 금지.

## 3. Cross-run 분석·영향 테스트·교정

| ID / 실패 경계 | 분류 | 직접/파생 | 현재 처리 및 남은 위험 |
| --- | --- | --- | --- |
| F825-QA-001/002 | POLICY_CI/GATE_MISSING | AGENT 보호 QA 승인 미확보 | 사용자 명시 승인으로 `OWNER_MANAGED` 전환 후 Full #3335.1 / Trusted #983.1 **PASS**. 과거 두 Trusted 실패는 그대로 불변 |
| F825-META-001 → F825-QA-003 | POLICY_CI / stale metadata | 이전 Head metadata-only 직접 실패→Trusted 출처 검증 파생 | 신규 exact Head Full #3335.1과 별개로 원본 결론 보존. Full PASS를 이전 metadata Run의 PASS로 소급하지 않음 |
| MAIN-825-001 | POLICY_CI / MERGE_METADATA | Main changes 직접 실패→Quality/E2E/Docker 파생 | 새 같은-Issue non-docs correction + 정확 1행/빈 body merge + 새 Main push CI 필요. 운영/릴리스 증거 아직 없음 |
| 로컬 dev·Pre-PR·production 초기 설정 | ENVIRONMENT / UNKNOWN | 최초 41case 5FAIL, 별도7case 3FAIL, 잘못된 production DATABASE_PATH 7FAIL, Pre-PR mapping/sourceStable BLOCKED | [원래 Work Packet](exec-plans/active/ISSUE_825.md)과 [분리 증거](evidence/issue-825/e2e-trace-diagnosis.json) 보존. 올바른 standalone production target7/7 PASS 및 PR Full SUCCESS가 앞선 환경 실패를 삭제하지 않음 |

- 기존 [#582/#586/#639/#808 정책 테스트](../scripts/verify-issue-lifecycle.py) 검색 후 `TEST_LIFECYCLE_REVIEW=EXTEND`: 현재 `scripts/verify-issue-lifecycle.py`에 Main #3336.1 **실제 multi-line 원본 메시지** negative와 `merge_api_payload(825, newPR, "물류 대시보드 Main CI 복구", exactSHA)`가 생성하는 `commit_title`+ `commit_message=""` 및 `expected_head_sha` positive만 추가. 새 테스트 스펙/중복 spec·테스트 삭제·skip·retry/timeout·QA/Required3/CI workflow 변경 없음. 기존 historical #586/#603/#639/#808은 KEEP_UNIQUE (불변 원본별 음성 사례).
- 제품 UI·Task/Resource/물류 집계·API/DB/Next/보안/원본·package/lock 현재 `0.135.5`는 유지. 이것은 **병합 실행 절차/검증 사전 보호 개선**이며 원본 기능 구현 변경이 아니다.
- PR 검증: 원격 새 정확 Head/Base/Test-Merge의 Full CI Required3(Chromium8/8 실제), 신뢰된 default-main Trusted, 리뷰 thread0 및 충돌 없음 확인 후에만 새 같은 Issue의 `merge_method=merge`, 짧은 한글 제목, **빈 commit_message**, lease-bound `expected_head_sha`로 정식 병합. 예시 명령: `python3 scripts/main_ci_run_name.py --issue 825 --pr <새 PR 번호> --summary "물류 대시보드 Main CI 복구" --as-merge-payload --expected-head-sha <새 PR SHA>` 후 `--validate-title` 비교. GitHub PR metadata의 `Refs #825`는 별도 한 행.
- **정식 릴리스:** 실패 Merge가 이미 `0.135.4 → 0.135.5`를 Main에 반영했음. 같은 Issue의 연속 non-docs corrective가 앱 버전 `0.135.5`를 유지할 때에만 Generic Finalizer의 *same-Issue failed-Main inheritance* 허용 여부를 별도 평가. `release_required=true`, `release_authorized=false`. 버전별 Owner 릴리스 승인 없이 annotated tag·rolling GHCR/정식 Release·Issue close 금지.
- Main #3336 실패 원본 증거는 [Issue STATUS/EXCEPTION](https://github.com/planner77/masterGantt/issues/825#issuecomment-6439176679)에서도 확인 가능. 새로운 PR/Head의 검증 및 새로운 Main push Run은 실제 생성 전 **NOT TESTED**. CI 모니터링은 요청 범위 밖.
