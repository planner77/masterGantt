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

## F885-002 — 2026-11-07 Full PR CI #3557.1 npm lockfile 의존성 누락

- **원본:** [PR #887 Full #3557.1 / Run 42362952735](https://github.com/planner77/masterGantt/actions/runs/42362952735), attempt 1, Head `b0085ecd95e0402fa39e05bb8e29a4d32e339d46`, Base `f3f8b89ef09bab35987b32f4945dac91b6fa223a`. 결론 FAILURE이며 불변. 직전 #3556.1의 `DOCUMENTATION_SYNC` 실패는 이 실행에서 **QA Preflight SUCCESS**로 해소되었다.
- **직접 실패:** `npm ci --prefer-offline --no-audit`가 `EUSAGE`(package.json/lock 불일치)로 실패. 실제 Job: Vitest `128375089088`, ESLint `128375089115`, 정책·저장소 검사 `128375089139`, TypeScript `128375089152` 모두 `Node/npm setup 계측` 내부 npm ci 단계에서 동일하게 실패. 정확 메시지: `Missing: yjs@13.6.33 from lock file`, `Missing: lib0@0.2.119 from lock file`, `Missing: isomorphic.js@0.2.5 from lock file`. GitHub cache restore/setup-node 성공이므로 캐시 장애 증거 없음.
- **의존성 원인:** 초기 MDXEditor 도입 때 외부 공개 lockfile에서 npm v3 의존성 일부를 직접 이식하는 과정에서 `@lexical/yjs@0.48.0`의 nonoptional `yjs >=13.5.22` peer 및 `yjs→lib0→isomorphic.js` 전이 의존성 누락. CI npm v10의 재현 가능한 설치 검증이 이를 즉시 차단했다.
- **보완:** `package-lock.json`에 정확 세 레코드만 추가하고 기존 root dependencies, version=0.144.0, 기존 archive/배포/CI 설정/규칙을 변경하지 않는다. 공개 upstream lockfile `dedbin/rimo`의 npm registry `resolved`와 SHA512 `integrity`를 원본 그대로 사용: `yjs=13.6.33`, `lib0=0.2.119`, `isomorphic.js=0.2.5`. 구현 전 lockfile v3/root 의존성 및 `@lexical/yjs→yjs→lib0→isomorphic.js` 정확 경로를 읽기 전용 검사했다. 임의 SHA 생성/버전 하향/패키지 제거 없음.
- **파생 상태:** Fast Gate Job `128375177300`, Required Quality `128375208640`, E2E `128375208702`, Docker `128375208673`, QA Final `128375227073` 실패. 실제 TypeScript/ESLint/Vitest 구현, Next build, Chromium8, Docker 구현은 **SKIPPED/NOT TESTED**; npm 설치 실패를 소스 타입·E2E 직접 실패로 표시하지 않는다.
- **TEST_LIFECYCLE_REVIEW:** `KEEP_UNIQUE` 기존 Task/Issue/GFM/SQLite/브라우저/인증 테스트, 모두 다음 npm ci 성공 이후 동일 Full8에서 실행 예정. 잠금 파일만 교정하며 skip/timeout/retry/테스트 축소 없음. 별도 테스트 파일 불필요: npm ci 자체가 lockfile 그래프를 검증하는 명시적 사전 게이트이다.
- **AC_TEST_COVERAGE:** AC01/AC09(Next client-only MDXEditor 의존성 설치), AC04(원본 lockfile/빌드 재현성), AC10(실제 Full PR CI 실행) 및 기존 Work Packet의 AC01–AC10 매핑 계속 적용. 기능 동작·QA 성공은 새 Head의 CI 전 **NOT TESTED**.
- **DOCUMENTATION_SYNC:** `docs/ISSUE_885_FAILURE_ANALYSIS.md`: UPDATED; `docs/exec-plans/active/ISSUE_885.md`: UPDATED; `package-lock.json`: UPDATED. `AGENTS.md`, `DESIGN.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`: N/A(기존 구현/계약/검증 게이트 불변). 기존 Work Packet 상단의 기계 판독 `DOCUMENTATION_SYNC` 선언은 원본 PR 전체 diff 기준 유지.
- **검증 경계:** 이 수정에서 실제 `npm ci`/TypeScript/ESLint/Vitest/Next/Playwright/Docker를 아직 실행하지 않았다. 원격 Full CI 결과는 다음 새 Head에서 별개 기록해야 하며 이전 실패를 덮지 않는다. 모니터링·병합·Main CI·GHCR·Finalizer·Issue 종료는 미승인.
