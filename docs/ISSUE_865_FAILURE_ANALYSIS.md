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
