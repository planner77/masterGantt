# Issue #867 / PR #868 — 누적 PR CI 실패 원장

Primary Issue: [#867](https://github.com/planner77/masterGantt/issues/867) | PR: [#868](https://github.com/planner77/masterGantt/pull/868) | 기록일: 2026-11-03 (KST)
Source of Truth: [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md), [Issue #867 Work Packet](exec-plans/active/ISSUE_867.md).
이 문서는 원본 실패를 불변 기록으로 보존한다. 새 Head의 테스트/QA 결과가 나와도 과거 FAIL을 PASS로 변경하지 않는다.

## 1. Run/Attempt 전체 원장

| 사건 | GitHub 원본 / 시도 | 이벤트·검증 유형 | Source | 실제 결과 / 구별 |
| --- | --- | --- | --- | --- |
| FAST #240.1 | [Run 41582346231](https://github.com/planner77/masterGantt/actions/runs/41582346231), attempt 1 | pull_request / FAST_DEVELOPMENT (비권위) | Head `9eb6ccd84b52eb9618c9cb4fc5a42e8c2deddf6a` | SKIPPED, Full CI PASS 증거 아님 |
| F867-001 | [Run 41582346250](https://github.com/planner77/masterGantt/actions/runs/41582346250), attempt 1, #3463.1 | pull_request.opened / CI FINAL_FULL | Head `9eb6ccd84b52eb9618c9cb4fc5a42e8c2deddf6a`; Base `43e97c3a4fd284b09d4c900ff8ab25e7a778c74b`; Test-Merge `1401978cefe4b7c2a59e08d11a0589cfae71d8b3` | 원본 QA Preflight + QA 경로 FAIL; 후속 Fast/Required 집계 FAIL, 제품 구현 Job SKIPPED |
| F867-002 (파생) | [Run 41583036060](https://github.com/planner77/masterGantt/actions/runs/41583036060), attempt 1, #3464.1 | pull_request.edited / CI METADATA_ONLY | 같은 Head/Base, PR 본문 metadata 수정 | `FULL_FAILED` 인증 승계로 FAIL; 새 Full 구현 실행 아님 |
| FAST #241.1 | [Run 41583505684](https://github.com/planner77/masterGantt/actions/runs/41583505684), attempt 1 | pull_request / FAST_DEVELOPMENT (비권위) | Head `410de003248c77a53a2520d87944b8a69516c141` | SKIPPED, Full CI PASS 증거 아님 |
| F867-003 | [Run 41583505545](https://github.com/planner77/masterGantt/actions/runs/41583505545), attempt 1, #3465.1 | pull_request.synchronize / CI FINAL_FULL | Head `410de003248c77a53a2520d87944b8a69516c141`; Base `43e97c3a4fd284b09d4c900ff8ab25e7a778c74b`; Test-Merge `8006bd13a62340acbefe8f5b4e481fc983a575f7` | Preflight·정책 SUCCESS, 테스트 파일 구문 오류로 TypeScript/ESLint/Vitest 직접 FAIL; Build/E2E/Docker 구현 SKIPPED |

최초 원장 시점에는 #868 한 PR, 세 Run 중 직접 Full 실패 #3463.1 한 건을 확인했다. 재개 시 두 기존 Head의 PR 이벤트 실행 목록을 다시 대조한 현재 누계는 한 PR, 다섯 Run(Full 실패 2건, metadata 파생 실패 1건, 비권위 FAST SKIPPED 2건)이다. 관측된 실행명·출처 artifact는 모두 attempt 1이며 다른 attempt의 존재는 연결 도구의 최신 조회만으로 별도 전수 인증하지 못했다. 기본 브랜치 `workflow_run` Trusted 실행 목록은 이 PR 이벤트 조회 범위에 포함되지 않으며 Trusted PASS를 주장하지 않는다.

## 2. 실제 Job / Step 귀속

### F867-001 — Full PR CI #3463.1 (41582346250.1)

- **QA Preflight** Job `125739948007`: `원본 base SHA의 QA Preflight 실행` FAIL. 신뢰된 main `scripts/qa_preflight.py`가 PR 본문에서 아래 **정확한 단독 선언 행**을 찾지 못하고, Issue 본문에서 `AC1..` 식별자를 찾지 못했다.
  - `RISK_LEVEL`: `risk_level` 단일 정규 선언 없음
  - `QA_METHOD`: `qa_method` 단일 정규 선언 없음
  - `QA_REQUIRED`: `qa_required` 단일 정규 선언 없음
  - `PATH_POLICY`: 위 선언 검증 실패에 의한 파생
  - `ISSUE_AC`: Issue #867 본문에 `AC1..` 식별자 없음
  - 5 FAIL, 5 DEFERRED. 구조 확인 전 `DOCUMENTATION_SYNC` 미평가.
  - 원본 [Preflight artifact `qa-preflight-41582346250-1`](https://github.com/planner77/masterGantt/actions/runs/41582346250) ID `13206785007`, 1,311 bytes (당시 미만료).
- **QA 신뢰 경계** Job `125739820795`: PR 본문 `qa_method`의 명시값 부재로 별도 직접 FAIL(`QA 경로 BLOCKED`).
- **PR Fast Gate** Job `125740075719`: 선행 `PREFLIGHT_RESULT=failure`, Policy/TypeScript/Lint/Vitest = SKIPPED 때문에 파생 FAIL.
- **Required 집계**: Quality `125740182397` FAIL, Chromium E2E `125740182332` FAIL, Docker `125740182239` FAIL. 실제 PR Policy/TypeScript/Lint/Unit/Next Build/Chromium8/Docker 구현 Job은 `SKIPPED`, `NOT RUN`; 테스트 assertion, 코드 실패, flakiness를 추론하지 않는다.
- **기타**: 변경 경로 판정 및 CI 영향 Shadow Job SUCCESS; 별도 Trusted QA 최종·Owner ACCEPT는 `NOT TESTED`.
- **분류**: `POLICY_CI` / PR·Issue 메타데이터 작성 계약 누락. 제품 코드 `PRODUCT` 판정 불가능.

### F867-002 — Metadata-only #3464.1 (41583036060.1)

- PR 본문에 QA 선언을 추가한 `edited` 이벤트. QA 경로 선검사 Job `125742004964` SUCCESS(메타데이터 형식 교정 확인).
- 메타데이터 증거 검증 Job `125742121575` 직접 FAIL: `PR metadata evidence: FULL_FAILED ... full_run=41582346250 · Full CI 41582346250.1 결론: failure`. 정확한 과거 Full CI 불합격의 안전한 전파.
- 자동 QA Job `125742290602` FAIL(`required quality 미성공`), Quality/E2E/Docker 집계 FAIL은 파생. Node/Vitest/Chromium/Docker 구현 SKIPPED.
- **분류**: `POLICY_CI` 파생·이전 실패 승계. 새로운 독립 전체 테스트 실패로 계수하지 않고 새로운 `synchronize` Full CI로 검증한다.

## 3. Cross-run 실패 매트릭스

| 실패 ID | 최초 원본/변경 전후 | 원인·보완 | 동일 source 교차 검증 / 잔여 |
| --- | --- | --- | --- |
| F867-001-A | PR `risk_level`/ `qa_method`/ `qa_required`가 문장 내 인라인 표기, 파서의 `^field: VALUE$`와 불일치 | PR 본문 독립 행에 `risk_level: HIGH`, `qa_method: OWNER_MANAGED`, `qa_required: true` 선언. 보호 경로(`AGENTS.md`, `deploy/`, `package*.json`, `src/server/`)는 `scripts/qa_final_automated.py`의 최소 HIGH 정책에 따름 | PR 본문 수정 후 자동 metadata-only 경로 검사 성공; Full QA Preflight는 새 Head에서 `NOT TESTED` |
| F867-001-B | Issue #867의 8개 수용 체크 항목에 `AC1..AC8` 정규식 매치 없음 | 이슈 본문의 8개 항목에 식별자 보존 추가, Work Packet `AC_TEST_COVERAGE` 8항목을 실제 의미에 맞춰 재매핑 | 새 Full Preflight의 `ISSUE_AC` 및 문서 Gate `NOT TESTED` |
| F867-001-C | Work Packet에는 `risk_level=MEDIUM` 기록 및 `docs/QA_REVIEW_POLICY.md`, `docs/REMOTE_VALIDATION.md` 영향 판정 누락 | 최소 HIGH로 정정, 기존 QA/CI 규정은 변경하지 않고 누락된 두 문서 `N/A(reason)` 추가. 보호 경로에서 요구하는 6개 QA 문서 모두 영향 판정 작성 | 현재 GitHub 문서 구조 검사는 신규 Full CI에서 검증 전 `NOT TESTED` |
| F867-002 | metadata-only가 이미 실패한 Full Run을 확인 | 동일 Head의 metadata-only 재실행으로는 과거 Full FAILURE 복구 불가. 코드·문서·원장 동결 후 새로운 PR Head의 `synchronize` Full CI 필요 | 신규 Full CI `NOT TESTED`; 완료 모니터링 제외 |

## 4. 누적 실패 집합 · 영향 범위와 재현

- **독립 원본 실패 합집합**: `scripts/qa_preflight.py`의 `RISK_LEVEL/QA_METHOD/QA_REQUIRED/ISSUE_AC`; `scripts/qa_final_automated.py`의 QA 경로 선택(메타데이터), `scripts/verify-pr-metadata-evidence.py`의 이전 Full Run 실패 증거 검증. `PATH_POLICY`/집계/FAST는 파생으로 따로 표시.
- **미실행 집합(전부 별도 원격 검증 필요)**: `tests/server/projects/project-issue-default-filter.test.ts`, `tests/e2e/project-issues.spec.ts`, 기존 `tests/server/projects/project-issues.test.ts` 및 인접 Unit/TS/Lint/Next build/Docker smoke, Chromium 8-shard, QA/Owner. 성공 건수 0으로 추정하지 않음.
- **제품 관련 영향**: `PROJECT_ISSUE_DEFAULT_STATUS_FILTER` 런타임 5종, 미설정/잘못된 값 `all`, server-only 정규화, SSR/Client 첫 요청 일치, 사용자 선택 보존, Compose app.environment. API/DB/삭제/KPI·권한 불변.
- **재현**: GitHub Run/Job 로그와 신뢰된 base 검증기 파서의 메타데이터 계약을 대조하여 원인 확정. 로컬 repository 전체 checkout 의존 Node 22/Vitest/Playwright/Docker 실행 환경 미확보(`git ls-remote` 외부 DNS 실패), 로컬 테스트 `NOT TESTED`. 메타데이터 형식은 정규식/Work Packet 파일 정적 점검으로 확인하되 실제 원격 검증 PASS라고 주장하지 않는다.
- **금지/비변경**: QA Preflight, Trusted QA, Required3, policy script, workflow, assertion 완화·skip·timeout/retry 증가, CI 종료권한의 무단 변경 없음.

## 5. 보완 완료 경계 및 후속 새 PR CI

- 수정 대상: GitHub PR 본문(정규 risk/QA/release 선언), Issue #867 본문(AC1..AC8), `docs/exec-plans/active/ISSUE_867.md`(HIGH, 매핑 및 QA 문서 영향), **본 누적 실패 원장 신규**.
- 기준 원본 Head `9eb6ccd84b52eb9618c9cb4fc5a42e8c2deddf6a` / Base `43e97c3a4fd284b09d4c900ff8ab25e7a778c74b`; 신규 후보 SHA는 게시 이후 추적. 임시 object와 정식 PR ref를 구분.
- 리뷰: #868 첫 조회 `unresolved=0`, CODEX review가 원본 Head에 Finding 없음 기록. 보완 후 **최신 Head** thread/mergeability 재조회 필요.
- CI 상태: 기존 `#3463.1 FAIL`, `#3464.1 metadata FAIL`은 원장에 유지; 새 Full PR CI 시작 시 `NOT TESTED`, 완료 결과 모니터링하지 않음.
- 위험/승인: `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`; independent_qa=N/A(Owner-managed), Trusted QA + Owner exact-Head 승인·Required3 별도. `release_required=true`, `release_authorized=false`. Merge/Main/GHCR/Issue 종료 금지.

## 6. F867-003 — Full #3465.1 재실패와 통합 보완 (2026-11-03)

### 원본 증거와 최초 원인

- 변경 경로 Job `125743521232`의 원본 출처 artifact `ci-pr-source-41583505545-1`(ID `13206905958`, 417 bytes, 조회 시 미만료) 및 checkout 로그에서 위 Head/Base/Test-Merge를 대조했다. artifact ZIP을 실행하지 않았다.
- 이전 F867-001 교정은 QA Preflight Job `125743664632`, QA 신뢰 경계 Job `125743521467`, 정책 Job `125743767863`의 SUCCESS로 확인했다. 과거 #3463/#3464 FAIL 자체는 유지한다.
- [TypeScript Job `125743768008`](https://github.com/planner77/masterGantt/actions/runs/41583505545/job/125743768008): `npm run typecheck`에서 `tests/server/projects/project-issue-default-filter.test.ts(35,1): error TS1005: ')' expected.` 직접 FAIL.
- [ESLint Job `125743768019`](https://github.com/planner77/masterGantt/actions/runs/41583505545/job/125743768019): 같은 파일 `35:0 Parsing error: ')' expected` 직접 FAIL. 원본 합계 1 error / 18 warnings이며 다른 경고를 실패 원인으로 확대하지 않는다.
- [Vitest Job `125743767927`](https://github.com/planner77/masterGantt/actions/runs/41583505545/job/125743767927): 같은 파일 34행 EOF에서 `[PARSE_ERROR] Expected ')' but found EOF`, suite 수집 전 FAIL. 원본 합계 **1 failed / 286 passed / 1 skipped files**, **3448 passed / 3 skipped tests**(전체 3451). 실패 suite에는 테스트가 수집되지 않았으므로 이를 4개 assertion 실패로 세지 않는다.
- Fast Gate `125744329492`, Required Quality `125744409256` / E2E `125744409473` / Docker `125744409311` FAIL은 선행 실패의 파생이다. 실제 PR Build `125744410651`, PR Chromium matrix `125744410178`, PR Docker `125744410849` 등은 SKIPPED/NOT RUN이며 제품 런타임 실패를 관측한 증거가 아니다. 자동 QA `125744479454`는 `required quality 미성공`으로 파생 FAIL.
- 분류: **테스트 소스 구문 결함**. 해당 파일 마지막 `describe(...)` 호출의 닫는 `);`가 누락됐다. 환경·flaky·제품 필터 의미 오류로 분류하지 않는다.

### 재현·가설·최소 교정

1. 원본 Head에서 `npm test -- tests/server/projects/project-issue-default-filter.test.ts` 실행: 원격과 같은 `Expected ')' but found EOF`, 1 failed suite / 0 collected tests로 **FAIL** 재현.
2. 가설 순위: 마지막 호출 닫기 누락이면 마지막 한 줄 수정으로 해소; 앞선 문자열 미종료이면 마지막 수정 후에도 잔존; 도구 버전 문제이면 동일 환경의 구문 수정만으로 해소되지 않음.
3. 마지막 `}`만 `});`로 교정한 동일 로컬 환경에서 Vitest·TS·ESLint가 PASS하여 첫 가설을 확정하고 나머지 가설을 기각했다. 제품 코드, assertion, 테스트 개수, timeout/retry/skip, CI/QA/Ruleset은 변경하지 않았다. 구문 수집 실패는 기존 suite 자체가 회귀 검출 경계이므로 같은 오류를 복제하는 신규 테스트는 추가하지 않는다(#711).

### 동일 후보 source의 교차 검증

수정 테스트 SHA256: `8f30296bfbc9dde70ffd6ba3961fc07b756f9f2f5effbf7a80c4311a7f570034`. 기준 Head `410de003248c77a53a2520d87944b8a69516c141`에 위 한 줄 교정을 적용한 제품·테스트 source를 동결했다. 이후 수정은 본 원장과 Work Packet에 한정한다.

| 누적 실패/영향 경계 | 실행·현재 판정 | 제외·잔여 위험 |
| --- | --- | --- |
| F867-001/002 메타데이터·문서·QA 경로 | #3465.1 Preflight/QA 경로/정책 SUCCESS로 이전 보완 확인 | 새 Head의 원격 Preflight·Trusted는 NOT TESTED |
| F867-003 직접 suite / 5종·공백·오타·비밀값 반환 금지·Compose 정적 전달 | `npm test -- tests/server/projects/project-issue-default-filter.test.ts` **4/4 PASS** | 실제 컨테이너 재생성·로그 출력은 별도 |
| 직접 + API/SQLite/삭제/KPI·로그/배포 인접·음성 | `npm test -- tests/server/projects/project-issue-default-filter.test.ts tests/server/projects/project-issues.test.ts tests/server/logging.test.ts tests/scripts/deployment-layout.test.ts` **4 files / 33 tests PASS** | pure parser와 실제 서버 경고 호출은 다른 경계 |
| TypeScript 공통 소비자 / 직접 ESLint | `npm run typecheck` PASS, `npx --no-install eslint tests/server/projects/project-issue-default-filter.test.ts` PASS | 전체 ESLint·전체 Unit의 새 Head 공식 결과는 원격에서 확인 |
| 문서·버전·diff | `node scripts/check-markdown-links.mjs` 393 files PASS; `node scripts/verify-release-version.mjs` v0.139.1 PASS; `git diff --check` PASS | 로컬 링크 검사는 원격 QA 승인이 아님 |

- **현재 환경과 제한:** Node `22.14.0`, npm `11.10.0`, Vitest `5.0.0`, TypeScript `5.8.3`, ESLint `9.39.5`. 격리 worktree에서 기존 root `node_modules`를 symlink로 재사용했다(커밋 제외). 설치 Next `16.3.4`와 PR lock `16.4.2`가 달라 frozen install/정확 의존성 환경 PASS는 주장하지 않는다. CI의 Node `22.23.4`/npm `10.9.9`와도 구분한다. Build/Chromium/Docker는 **NOT TESTED**이며 새 Full의 `npm ci`와 Required3가 공식 검증이다.
- **누적 실패 파일 합집합:** 실제 실패 테스트는 `tests/server/projects/project-issue-default-filter.test.ts` 1파일. 이전 메타데이터 실패의 `qa_preflight.py`/`qa_final_automated.py`/metadata evidence 계약도 위 매트릭스에 보존한다. SKIPPED Build/Chromium/Docker를 PASS로 합산하지 않는다.
- **선정/제외:** 이번 변경은 테스트 수집 구문 한 줄뿐이므로 직접 suite + API/로그/배포 정적 경계 + 전체 TS로 제한했다. 공유 상태·권한·SSR·CI 정책 변경이 없어 로컬 전체 E2E/build/Docker 반복은 제외한다. 기존 제품 E2E는 `all` 기본값 경로만 작성되어 있고 `open/completed` 서버 런타임→SSR→첫 API/초기화 변형 및 실제 경고 로거 호출은 미검증이다. 원격 전체 E2E가 성공해도 존재하지 않는 변형 테스트의 PASS로 확대하지 않는다. 같은 이미지 재생성/볼륨 보존도 별도 환경 검증 필요.
- **리뷰/운영:** 실제 backend 구현 Agent와 별도 qa_docs 읽기 전용 사전검토를 수행했다. 이는 독립 인간 최종 QA 또는 Owner ACCEPT가 아니다. PR #868은 조사 시 `mergeable=true`, 미해결 리뷰 스레드 0개이며 게시 전 최신 상태를 다시 확인한다. 로컬 Git/gh 인증 실패로 게시 방식 B(Git Data API)를 사용하고 전체 tree·부모·expected Head를 확인한 뒤 Ref를 한 번 갱신한다.
- **다음 실행:** 코드·원장·Work Packet을 함께 게시한 새 exact Head의 Full PR CI를 시작하고 Run/Attempt/Head/Base/Test-Merge는 Issue 상태 댓글에 연결한다. 새 Quality/E2E/Docker·Trusted·Manager ACCEPT는 **NOT TESTED**, `MERGE_READY=BLOCKED`. 사용자 지시에 따라 CI 완료 모니터링·merge/Main/GHCR/Release/Issue 종료는 수행하지 않는다.
