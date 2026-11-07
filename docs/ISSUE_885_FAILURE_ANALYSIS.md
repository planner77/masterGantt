# Issue #885 failure/verification ledger — append-only

## 2026-11-07 885-PLAN-001
- Baseline main `f3f8b89ef09bab35987b32f4945dac91b6fa223a`, Scope Issue/Task MDXEditor + SQLite 0038.
- Context: GitHub connector supports remote file/commit/PR operations; local package installation, browser/SQLite runtime unavailable.
- **NOT TESTED**: static source review is not build/E2E/CI PASS. Risk: MDXEditor client-only initialization and lockfile resolver; read-only Markdown grammar, raw HTML rejection; form-focus and existing suite migration.
- Mitigation: exact v3-lock dependency closure from published packages, tests and docs, no CI/workflow gate weakening. Observe no CI output after requested PR trigger.
- Resolution: initial implementation branch committed; PR Full CI started via opening PR after docs/tests. If CI fails, register exact run+attempt and fix in a new authorized follow-up; do not mark as PASS.

## F885-001 — 2026-11-07 Full PR CI #3556.1 직접 실패 / 리뷰 P1

- 원본: [PR #887 Full CI #3556.1 Run 42362045811 attempt 1](https://github.com/planner77/masterGantt/actions/runs/42362045811), Head `d73f64aa3566d374d8a7213736b96b329f508296`, Base main `f3f8b89ef09bab35987b32f4945dac91b6fa223a`, GitHub generated Test Merge `ce9bdf129e9a41aa010713b9d448e5d724a0c583`. Original conclusion **FAILURE** (불변).
- 직접 원인: QA Preflight — 정책·문서 사전 검사 Job `128372373107` 에서 `DOCUMENTATION_SYNC`: `docs/exec-plans/active/ISSUE_885.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — DOC_SYNC 기록 누락`. 정확한 parser는 `scripts/qa_final_automated.py:docs_gate`, 경로별 `- \`path\`: UPDATED` 또는 `- \`path\`: N/A(reason)`(한 줄 종료) 및 각 `AC01`~`AC10` 단독 bullet 필요. 이전 Work Packet에는 `UPDATED, 설명`, `N/A; 설명`, `AC1..AC10`가 혼재했다. Primary Issue, HIGH, Owner QA, Release required, Release authorized 및 PATH POLICY 사전 검증은 PASS.
- 파생 실패: PR Fast Gate Job `128372458577`, Required Quality Job `128372525170`, E2E Job `128372524986`, Docker Job `128372524983`, QA Final Job `128372550166`. 정책 실행, TS, ESLint, Vitest, Next build, Chromium8 구현, Docker 구현은 **SKIPPED / NOT TESTED**이므로 코드가 실패했다고 단정하지 않는다.
- 별개 검토: 미해결 [P1 PR thread](https://github.com/planner77/masterGantt/pull/887) in `src/server/projects/task-field-project-service.ts:49`, reviewer `chatgpt-codex-connector`: LinkService 응답 `src/server/projects/link-service-core.ts:taskDtos`와 Subtree delete 응답 `src/server/projects/task-field-companion-services.ts:enrichTasks`에 `descriptionFormat` 미포함. Markdown Task 원본이 후속 편집/캐노니컬 스냅샷에서 plain으로 표시될 수 있는 실질 데이터 변경 위험.
- 수정 설계: 기존 날짜 계산/권한/DB transaction/revision 함수는 변경하지 않고, ScheduleRepository에서 읽은 `TaskRecord.descriptionFormat`을 두 응답 빌더에 정확하게 포함. `tests/server/projects/description-format-projections-885.test.ts`는 동일 Task DB format + Link POST + 다른 Task subtree 삭제 이후 전체 응답·canonical 재조회 형식 동일성을 검증.
- 문서 보완: Work Packet의 `DOCUMENTATION_SYNC`을 trusted regex 정확 서식으로 정렬, 필수 문서 `docs/EXCEL_EXPORT.md`, `docs/SCHEDULING_ENGINE.md` 등 N/A 사유까지 명시, `AC_TEST_COVERAGE`를 Issue 본문의 `AC01`~`AC10`로 매핑. #711 테스트 정책/Required3/8-shard/QA 게이트는 불변.
- 검증 경계: **코드/문서 변경 커밋은 테스트 실행 증거 아님**. 신규 Full PR CI 실행 전 결과 `NOT TESTED`, Owner QA/HIGH 잔여 위험 수용 및 merge/Main/Release/GHCR/Issue close 미승인. 다음 PR push는 새 HEAD의 `synchronize` Full CI만 트리거하고 모니터링하지 않는다.
