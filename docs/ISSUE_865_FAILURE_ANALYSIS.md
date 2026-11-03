# Issue #865 — 독립 PR #871 누적 실패 원장

Primary Issue: https://github.com/planner77/masterGantt/issues/865
PR: https://github.com/planner77/masterGantt/pull/871
원본 통합 PR: https://github.com/planner77/masterGantt/pull/870 (다른 Primary #866, 이 독립 원장에 실행 결과 합산 금지)

## PR871-FULL-001 — #3476.1 Policy Preflight 차단 (2026-11-04)

- 원본 Full PR CI: [Run #3476.1 / 41741295176](https://github.com/planner77/masterGantt/actions/runs/41741295176), attempt1, event `pull_request`, workflow `.github/workflows/ci.yml`, source Head `b3c693c895f9452dd35ac19920e593b23b1fdcb6`, Base/Main `352a43e74c7b34c72d952f67783a53463f8b519d`, 결론 FAILURE. 원본 Head는 기존 통합 PR #870 소스에서 #865만 이식한 신규 Main-based 브랜치다.
- **직접 실패:** `QA Final 신뢰 경계 확인` Job126283170236 보호변경 검사에서 `QA 경로 BLOCKED: PR 본문 qa_method의 명시값 필요`. `QA Preflight` Job126283300587에서 FAIL 5: PR 본문 risk_level / qa_method / qa_required 각각 정확한 단일 선언 누락, 보호 파일 PATH_POLICY 위험도 선언에 따른 파생 차단, `docs/exec-plans/active/ISSUE_865.md`의 정확한 `## DOCUMENTATION_SYNC` 섹션 누락. Primary Issue 및 Release required/authorized 등은 PASS.
- **분류:** `POLICY_METADATA + DOCUMENTATION_SYNC` 직접 오류, LLM 신규 컴파일/기능 오류의 근거 없음. 병렬 Quality/Vitest/TypeScript/ESLint/Build, E2E8Shard, Docker 구현은 전부 SKIPPED 또는 aggregate 의존성 실패; 이를 '테스트 실패' 또는 PASS라고 기록하지 않는다. QA Final 실행은 선행 차단으로 SKIPPED. FAST #251.1 advisory SKIPPED.
- **원인:** PR body에 `Risk: HIGH · qa_method=OWNER_MANAGED` 등 사람이 읽는 문장 형태를 넣었으나 정책 파서가 정확한 `risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `qa_required: true` 키 선언을 요구한다. Work Packet은 `## TEST_LIFECYCLE_REVIEW / DOCUMENTATION_SYNC` 단일 혼합 제목만 있어 정식 `## DOCUMENTATION_SYNC` 조회에 불합격했다.
- **보완:** PR body를 QA 파서용 명시 행으로 변경, Work Packet에 `## TEST_LIFECYCLE_REVIEW`, `## DOCUMENTATION_SYNC`, `## AC_TEST_COVERAGE` 독립 절 추가, 이 누적 원장 생성. 제품 코드/secret·권한·CI workflow/게이트/timeout/skip 조정 없음.
- **검증 경계:** GitHub 원본 Job/Step 로그의 정책 원인 확인 및 수정 문서의 정적 대조만 PASS. 새 exact Head Quality/E2E/Docker/QA Trusted/Owner ACCEPT는 **NOT TESTED**. 리뷰·충돌과 최신 Main 비교 후 새 Full PR CI 시작만 확인하고 완료 결과를 모니터링하지 않는다.

## PR871-FULL-002 — #3477.1 문서 매핑 형식 실패와 #3478 metadata 파생 (2026-11-04)

- [Full #3477.1 Run41742099717](https://github.com/planner77/masterGantt/actions/runs/41742099717), Head `86b4dda6ff8800b5f7cd7fb181575bbdb5bfb680`, base `352a43e74c7b34c72d952f67783a53463f8b519d`, attempt1, FAILURE. QA Preflight Job126286033516: 이전 run의 risk_level/qa_method/qa_required/Primary/Path/Issue AC는 이번에는 PASS; **DOCUMENTATION_SYNC 1건 FAIL** — Work Packet `## DOCUMENTATION_SYNC`는 있으나 `- \`path\`: UPDATED|N/A(reason)` 정규 항목 형식을 사용하지 않아 `DOC_SYNC 기록 누락`이다. Quality/E2E/Docker 구현 Job은 실행되지 않았으며 aggregate 실패는 직접 제품 FAIL이 아니다.
- [Metadata-only #3478.1 Run41742116522](https://github.com/planner77/masterGantt/actions/runs/41742116522)는 동일 Head의 선행 Full 실패를 재사용하는 read-only 검증에서 FAILURE. 새로운 LLM/DB/E2E/CI 구현의 독립 실패로 계수하지 않으며 새 Full 성공으로 메꿀 수 없는 증거를 소급 승격하지 않는다.
- **보완:** 신뢰된 base `scripts/qa_final_automated.py`의 `docs_gate`를 확인한 뒤 Work Packet에 정확한 `- \`docs/API.md\`: UPDATED`, `- \`DESIGN.md\`: N/A(reason)`, `- \`docs/TEST_PLAN.md\`: N/A(reason)` 등을 추가. `## AC_TEST_COVERAGE` 아래에 Issue AC1~AC9 각각 `- ACn: 증거/테스트 경로`를 넣어 구조 검증을 만족하도록 한다. TEST_PLAN 원문 변경 없는 이유와 별도 전용 문서의 검증 범위를 기록. QA Required·Trusted/Owner 정책과 위험 분류는 불변.
- **검증:** PR/Run/Job/Step 원본 확인 및 regex 구조의 독립 정적 검사만 PASS; 새 Head 전체 TypeScript/Vitest/E2E/Docker/Trusted/Owner는 NOT TESTED, 정확한 Git Head Full CI 필요.
