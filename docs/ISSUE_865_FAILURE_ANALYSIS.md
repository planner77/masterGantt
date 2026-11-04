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

## PR871-FULL-003 — #3479.1 보호 경로 Document Union 누락 (2026-11-04)

- 원본 [Full #3479.1 Run41742545244](https://github.com/planner77/masterGantt/actions/runs/41742545244), Head `d70a803667f9a8945be9723f070c8711a110f1b8` Base `352a43e74c7b34c72d952f67783a53463f8b519d`, Attempt1, FAILURE. QA Preflight Job126287542927의 직접 FAIL: `DOCUMENTATION_SYNC — 문서 영향 기록 없음: docs/GITHUB_OPERATIONS.md`. 나머지 메타데이터(Primary/risk/qa/AC/보호 분류)는 PASS; 전체 TypeScript/Vitest/E2E/Docker는 정책 차단으로 NOT RUN. QA·aggregate 실패는 파생이며 제품 직접 오류 아님.
- Base `scripts/qa_final_automated.py:docs_required`는 정책 경로 `docs/SECURITY.md`를 변경한 PR에서 QA_DOCS의 `AGENTS.md,docs/QA_REVIEW_POLICY.md,docs/CI_CD.md,docs/TEST_PLAN.md,docs/GITHUB_OPERATIONS.md,docs/REMOTE_VALIDATION.md` 전체를 기록하도록 요구한다. 이전 원장에 일부만 기록해 Union 사전 검증에 실패한 것으로 확인했다.
- 보완: Work Packet `## DOCUMENTATION_SYNC`에 변경 없는 5개 경로의 정식 `N/A(reason)` 기록을 보충하고 동일 Header/AC mapping을 유지한다. 실제 문서/테스트/보안 정책 원문은 수정하지 않는다. 새 exact Head CI만 시작하며 완료 모니터링/병합/정식 릴리스는 수행하지 않는다.

## PR871-FULL-004 — Full #3481.1 Markdown 링크 검사 실패 (2026-11-04)

- [Full #3481.1 / Run41743239291](https://github.com/planner77/masterGantt/actions/runs/41743239291), attempt1, Head `a800f7f039d37caf0c5a8b61d4c549ca1fd2b01b`, Main `352a43e74c7b34c72d952f67783a53463f8b519d`는 QA Preflight/신뢰경계 PASS 후 Unit/Vitest·ESLint·TypeScript PASS. 직접 실패는 `정책·저장소 계약 검사` Job126289994973의 `node scripts/check-markdown-links.mjs`: `docs/LLM_CONFIGURATION.md`에서 분리 후 없는 두 상대 경로 `exec-plans/active/ISSUE_866.md`, `ISSUE_866_FAILURE_ANALYSIS.md`를 참조. 이 오류가 PR 빠른 검사 및 Quality/E2E/Docker aggregate 실패로 파생되며 신규 LLM API/Runtime/SSRF 직접 FAIL은 확인되지 않았다.
- 원인: 통합 PR #870 원본 설정 가이드 마지막 줄의 #866 참조를 #865 분리시 교체하지 않아 독립 branch에 없는 문서를 지시했다.
- 교정: #865 문서 원문을 보존하고 마지막 참조만 실재하는 `docs/exec-plans/active/ISSUE_865.md` 및 `docs/ISSUE_865_FAILURE_ANALYSIS.md`로 정정. 원래 통합 PR의 누적 이력을 이 독립 PR의 PASS로 전용하지 않는 점을 명시.
- 테스트 수용: markdown 경로·파일 존재와 정확 Git blob을 GitHub API로 검토. 최종 독립 Head에서 full Unit/E2E/Docker 및 Trusted/Owner는 아직 NOT TESTED. 기존 QA/보안/CI 정책 불변.

## PR871-MAIN-SYNC-001 — 최신 main 정렬·리뷰/충돌/버전 정책 (2026-11-04 KST)

- 원격 전체 PR #871 이력(11 runs, FIRST PAGE·branch/PR 귀속 확인): 원본 Full 실패 #3476.1 Run41741295176, #3477.1 Run41742099717, #3479.1 Run41742545244, #3481.1 Run41743239291은 위 불변 사건에 각각 기록되어 있으며, metadata-only #3478.1 Run41742116522는 #3477 실패의 파생이다. 5개 FAST_DEVELOPMENT advisory #251/#252/#253/#255/#257은 SKIPPED이며 Required PASS로 계수하지 않는다. 최초 Run부터 정제한 증거는 원본 Action 링크를 따른다.
- [Full #3484.1 / Run41743950901](https://github.com/planner77/masterGantt/actions/runs/41743950901)은 이전 HEAD `0f8af9fe5438c7ce705cb863c3ea99575e5089c6`, 이전 base `352a43e74c7b34c72d952f67783a53463f8b519d`에서 workflow 최종 SUCCESS. 해당 성공은 최신 main 반영 전 증거이며 신규 정렬 Head의 CI 성공으로 승계하지 않는다. 별도 재시도 실패로 기록할 새 사건 없음.
- 최신 main [`c048461c0dafc1e7fa89786b6abb7a322788ea60`](https://github.com/planner77/masterGantt/commit/c048461c0dafc1e7fa89786b6abb7a322788ea60)은 #869 PR #872의 UI/문서/앱 `0.140.0`을 포함하며, #865 브랜치는 당시 4 behind/5 ahead, PR mergeable=false였다. common base `352a43e74c7b34c72d952f67783a53463f8b519d`를 확인했다.
- 해결 전략: **기존 #865 Head + 최신 main의 2-parent merge commit**. 최신 main의 전체 Git Tree를 기준으로 #865의 변경된 파일/테스트만 무손실 이식한다. #869의 Issue UI/CSS/E2E/문서·권한/SQLite 계약은 보존한다. `CHANGELOG.md`는 #865 `0.141.0` 신규 절 + #869 `0.140.0` 기존 절을 모두 유지, `docs/REQUIREMENTS.md`는 두 Issue 절을 유지, `package.json`/lock root version 두 군데를 `0.141.0`으로 동기화한다. 다른 의존성/lock bytes/CI 정책은 불변.
- 리뷰 사전 확인: PR #871 GraphQL inline review thread **0건**, review submissions **0건**, Codex summary의 최초 HEAD 지적 없음(새 Head 검증 근거 아님). 신규 merge commit push 이후 review/mergeability를 재조회한다. 해결 전 충돌은 위 문서·버전 중첩에서 발생했으며 수동 원본 내용 보존으로 해소한다.
- 보안/제품: `src/server/llm/**`, `tests/server/llm/**`, `.env.example` 및 Compose의 #865 contract 변경 없음. 사내망 실서버/실제 토큰 검증은 NOT TESTED; 권한·CI QA/Trusted·Owner 위험 승인/Issue 종료/정식 GHCR은 별도.
- 이 정렬의 로컬 TypeScript/Vitest/E2E/Docker 실행은 **NOT TESTED**. 새 HEAD로 Full PR CI 시작하되 완료 결과는 사용자 요청에 따라 모니터링하지 않는다. 새 Head의 Required3·Trusted QA·Owner ACCEPT는 시작 시점 **NOT TESTED**.
