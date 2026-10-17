# Issue #715 — PR CI 전체 실패 누적 분석 원장

[공통 실패 분석](PR_CI_FAILURE_TRIAGE.md)과 [AGENTS.md](../AGENTS.md), [Issue Lifecycle](ISSUE_LIFECYCLE.md)을 적용. Primary Issue [#715](https://github.com/planner77/masterGantt/issues/715), PR [#716](https://github.com/planner77/masterGantt/pull/716).

## F-001 / 2026-10-18 — Full PR CI #2922.1
- 원본 [Run 39079976744, attempt 1](https://github.com/planner77/masterGantt/actions/runs/39079976744). Workflow `CI`, event `pull_request`, 2026-10-17T23:41:14Z, completed FAILURE.
- PR #716, Branch `docs/issue-715-contextual-help-density`, Head `ee5871040fd75d49f83881d0d10e613702a5de56`, Base `6fea0397bc07d0c3adf2d769f9ba6829473503a2`, 변경 3개 Markdown 파일. `refs/pull/716/merge` 실패 후 조회 SHA `70f3fbccd0f32efd7f5d53ac29afb25a1a5ad16a`(이것이 정확 원본 Actions checkout test-merge인지 독립 확인 전 NOT TESTED).
- 처음부터 조사 가능한 동일 PR Full Run은 **이 1건**이며 이전 Attempt/성공·실패 Run은 검색되지 않았다(조회 시점). 외부 다른 Issue의 실패는 여기 합산하지 않는다.

### 최초 실제 오류
1. Job `변경 경로 판정` ID `117534760755`, Step `CI 실행 추적 메타데이터 검증`: `scripts/verify-ci-run-trace.py`는 제목 `Issue #715` 또는 `(#715)`를 허용하지만 원 제목은 `docs: #715 ...`. **`PR 제목의 Issue 표기는 Primary Issue #715 하나만 허용합니다: title Issues=[]`**. 직접 FAIL.
2. Job `QA Final 신뢰 경계 확인` ID `117534760682`, Step `보호 변경·AGENT 경로 판정`: `qa_final_automated.pr_field`는 본문 독립행 `qa_method: OWNER_MANAGED`를 필요로 하나 원 본문은 inline 코드 `qa_method=OWNER_MANAGED`만 언급. **`QA 경로 BLOCKED: PR 본문 qa_method의 명시값 필요`**. 직접 FAIL.

### 파생/미실행 매트릭스
| 원본 Job/범위 | 상태 및 증거 |
| --- | --- |
| `PR 빠른 검사 판정` ID `117534790613` | FAIL(파생): CHANGES_RESULT=failure, PREFLIGHT_RESULT=skipped. 자체 제품 검사 원인 아님 |
| Required quality/e2e/docker aggregate 3개 | FAILURE(초기 gate 실패 파생). 실제 제품 테스트가 실행됐다는 뜻 아님 |
| QA Preflight, Policy, Typecheck, ESLint, Unit, Build | SKIPPED |
| Chromium E2E 6개 shard, Docker smoke 구현 | SKIPPED / NOT RUN. 테스트 실패를 0건 성공이라 해석하지 않음 |
| `QA Final — Automated` | SKIPPED; 최종 판정 아님 |
| Source artifact `ci-pr-source-39079976744-1` | 생성 성공; 필수 테스트/승인 PASS가 아님 |

### 원인 분류·교정·미검증
- **POLICY_CI / PR 메타데이터 규격 부정합**. 제품/Playwright 결함 근거 없음. 당시 Fast Gate가 필요한 검사를 fail-closed로 중단한 정상 보호 동작.
- PR 제목의 `#715`는 `Issue #715` 계약의 대체가 아니고 PR 본문 인라인 `qa_method`는 명시 단독 필드가 아니다.
- **잠재 후속 차단(실제 실패 아님):** `qa_final_automated.docs_gate`는 `## AC_TEST_COVERAGE`와 `- AC1: ...`~`- AC7: ...`, `## DOCUMENTATION_SYNC`의 `- \`path\`: UPDATED|N/A(reason)`을 요구. 기존 Work Packet의 `## AC_TEST_COVERAGE / 상태`와 Markdown 표만으로는 구조적 검증 불충족 우려.
- **보완:** PR 제목 `Issue #715` canonical trace, PR 본문 `risk_level: LOW`/`qa_method: OWNER_MANAGED` 독립 행, 기존 단일 `Refs #715` 유지. `docs/exec-plans/active/ISSUE_715.md`의 AC1~AC7/문서 영향 구조 수정, 이 정규 실패 원장 신규 등록. 필요 테스트/QA/인수 조건·CI 검증기 설정은 그대로 유지.
- **선택 검증:** PR metadata/title/branch/Refs 정규식·Work Packet 섹션·AC1~7 문서 매핑의 정적 대조. 실제 Python/Node/Chromium 로컬, 제품 코드 테스트는 **NOT TESTED**. 신규 PR Full CI와 Trusted QA는 정확 새 Head/Run/Attempt의 원격 결과를 확인해야 함. docs-only skip은 제품 E2E PASS가 아니다.
- 현재 문서 작업 위험 LOW/OWNER_MANAGED, version `0.115.0` keep, release_required=false/release_authorized=false. 향후 4개 화면 제품 변경은 별도 버전/위험도/실증. 새 CI 완료·Owner 승인 전 병합·GHCR·Issue close 금지.

## 재실패 대응
같은 파일에 F-002 이후 Run/Attempt를 누적하고 이전 전체 실패·파생·미실행 및 수정 집합을 비교한다. 실패 원본의 FAIL/미실행을 소급 PASS하거나 지침을 우회하지 않는다.
