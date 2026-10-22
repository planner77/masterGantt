# Issue #752 / PR #780 — 누적 PR CI 실패 분석

Primary Issue: [#752](https://github.com/planner77/masterGantt/issues/752) | PR: [#780](https://github.com/planner77/masterGantt/pull/780) | 작성: 2026-10-22

원본: [PR CI 실패 공통 지침](PR_CI_FAILURE_TRIAGE.md), [작업 원장](exec-plans/active/ISSUE_752.md). 각 Head·Run·Attempt의 실제 실패/취소는 불변이며, 다른 Head의 PASS로 소급 변경하지 않는다.

## 1. Run/Attempt 이력 및 원본 출처

| 이력 | Head / Base / test-merge | 원본 Job·Step | 판정 |
| --- | --- | --- | --- |
| PR #780 [Full #3151.1](https://github.com/planner77/masterGantt/actions/runs/39782427411), Run 39782427411 attempt 1 | Head `d90c5760a31297271a9b0e61e8eee6202a15410c`, Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597`, Test-Merge `76d1a1016725d7480a393f026e6365fc5d2ef7e1` | 정책·TypeScript·Lint·Vitest·Build·E2E **8/8**·Docker·Required3 SUCCESS. QA Final Job `119850267324` step #3 `PR latest Head stale` FAIL; 뒤따른 새로운 HEAD로 전체 Workflow CANCELLED | 원본 HEAD stale/QA 차단. Chromium 직접 실패 관측0, 취소된 전체 Workflow를 PASS로 간주하지 않음 |
| PR #780 [Full #3152.1](https://github.com/planner77/masterGantt/actions/runs/39782641377), Run 39782641377 attempt 1 | Head `21f26a41969a9b46e081290c27efce2cefd21b03`, Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597`, Test-Merge `f28b80b50d768e6179b240fe26c62d298553b40f` | 정책·TypeScript·Lint·Vitest·Build·E2E **8/8**·Docker·Required3 SUCCESS. [QA Final Job 119863804861](https://github.com/planner77/masterGantt/actions/runs/39782641377/job/119863804861) step #3 `최신 PR 증거·문서·리뷰 확인` exit1; 사유 `미해결 review thread`. QA Report Artifact ID 12430986481 | 원본 Workflow FAILURE (QA 리뷰 차단, POLICY_CI), 제품 Assertion/Runner TimeOut 직접 실패 관측0 |

- 원본 Full Run은 서로 다른 HEAD이며 모두 정확 PR #780의 pull_request 이벤트이다. #3151의 stale와 #3152의 리뷰 위반은 별개 사건으로 분류한다.
- Job/API 결과를 확인했지만 original ZIP을 이번 요청에서 다시 다운로드해 독립 교차 검증한 것은 아니므로 별도 Trusted QA 출처 PASS로 승격하지 않는다.
- 최신 Head가 바뀌면 과거 Quality/E2E8/Docker PASS는 역사적 증거일 뿐, 새 Head의 Required PASS가 아니다.

## 2. 누적 실패·리뷰 종합 매트릭스

| ID | 실제 원인 및 출처 | 교정 대상 | 현재 검증 상태 |
| --- | --- | --- | --- |
| F752-001 · Full #3151.1 | `QA Final: PR latest Head stale`; 원본 종료 CANCELLED, 정책상 정상 차단. `POLICY_CI/STALE` | 새 Head Full CI에서만 공식 Required 재검증. 이전 성공/취소 재분류 금지 | 원본 확정, 후속 Head는 별도 |
| F752-002 · Full #3152.1 | `QA Final: 미해결 review thread`; 스레드 5개. `POLICY_CI/REVIEW_BLOCKED` | 리뷰 지적 보완·답변·Resolve 후 새 Head에서 QA 검증 | 원본 확정, 현재 후보는 NOT TESTED |
| R752-01 P1 | [상대 경로 삭제](https://github.com/planner77/masterGantt/pull/780#discussion_r4348598565): Playwright testDir-relative spec을 empty path로 만들어 reporter `suites=[]` 가능 | 승인된 file-relative/repo-relative/absolute canonical spec 정규화, 중첩 Suite와 traversal/미선정 음성 회귀 | 수정 후보 / 원격 미검증 |
| R752-02 P1 | [저장소 전체 300 Run으로 잘못된 INCOMPLETE](https://github.com/planner77/masterGantt/pull/780#discussion_r4348598575) | GitHub Actions REST query에 `branch=`를 pagination보다 앞에서 적용, 해당 PR/source 재검증 | 수정 후보 / 원격 미검증 |
| R752-03 P1 | [Base의 오래된 실패 원장](https://github.com/planner77/masterGantt/pull/780#discussion_r4348598579) | 직전 커밋에서 `ledger_text(..., head)`로 수정 완료; exact 불변 PR Head를 비실행 데이터로만 사용, 회귀 테스트 추가 | 기존 수정 재검토 / 원격 미검증 |
| R752-04 P2 | [선정한 일부 spec 미보고인데 READY](https://github.com/planner77/masterGantt/pull/780#discussion_r4348598589) | 선택된 개별 Spec 결과 없으면 `SPEC_NOT_OBSERVED`; skip/interrupted/UNKNOWN이면 `SPEC_NOT_FULLY_EXECUTED`, 결과 `INCOMPLETE` 유지 | 수정 후보 / 원격 미검증 |
| R752-05 P1 | [신규 워크플로 영문 표시](https://github.com/planner77/masterGantt/pull/780#discussion_r4348598602) | 사람이 읽는 workflow/run/job/step/input·Summary/댓글을 한글로 변경, ID·Required Check·판정 코드는 보존 | 수정 후보 / 원격 미검증 |
| R752-06 인접 | QA Final 단독 리뷰 위반을 독립 테스트 실패로 잘못 계산할 수 있음 | `QA Final — Automated`/Shadow 등 파생 Job은 2회 직접 실패 감지에서 제외하고 음성 회귀 | 수정 후보 / 원격 미검증 |

**직접 실패 E2E 테스트 파일 합집합: 관측0건.** 두 Full에서 Chromium E2E 8개 Shard는 모두 SUCCESS다. 신규 `workflow_dispatch` 기반 제한 진단이 실제로 정상이라는 뜻은 아니며, 별도 main 적용 이후의 실증이 필요하다.

## 3. 영향·보완 대상과 동일 source 회귀

- 직접 코드: `scripts/issue_752_diagnostics.py`(원본 이력/ledger/상태 판정/파일 정규화), `.github/workflows/issue-752-diagnostics.yml`(표시 언어/Worker 정제), `tests/python/test_issue_752_diagnostics.py`(경계 회귀).
- 간접/음성 소비자: [#770 영향/Shadow](exec-plans/active/ISSUE_770.md), [#771 Draft/Ready](exec-plans/active/ISSUE_771.md), [#772 LOW 정책](exec-plans/active/ISSUE_772.md), 기존 `scripts/test_qa_final_automated.py` 및 PR 정확 HEAD Full Chromium 8/8·Docker.
- 기존 Required3·Trusted QA·Owner/Ruleset·GitHub 보존 원본 변경 없음. 진단 Report/Artifact·PR 댓글은 권고이며 최신 Head의 Full CI PASS가 아니다.
- 로컬 checkout/실제 Python·Node·Chromium·Docker 실행 불가: `NOT TESTED`. 코드·단위 회귀를 단일 Git Tree 묶음으로 준비하며 게시 후 원격 CI 실행은 새 HEAD로 별도 판정한다. 신규 workflow_dispatch의 진단 관측·성능 개선 수치는 `INSUFFICIENT_DATA / NOT TESTED`.
- 패치 중 쪼개진 Contents API HEAD를 생성하지 않도록 Git Tree 일괄 게시 및 예상 부모 SHA 검증을 사용한다.

## 4. 리뷰·충돌·인계

- 2026-10-22 초기 확인: Review 5개 모두 `is_resolved=false`. main Base SHA `72c2c9d0a912dc906d4101ea41a7a57e0c686597`와 Head `21f26a41969a9b46e081290c27efce2cefd21b03`, GitHub `mergeable=true`, 실제 충돌 없음.
- 개선 code+tests/docs 묶음 게시 후 review 답글과 실제 Resolve를 확인한다. QA gate를 disable/skip 처리하거나 요구된 테스트 단언을 완화하지 않는다.
- 최신 Head exact Full Required, default-main Trusted QA, Manager/Owner HIGH 승인 `NOT TESTED`. Issue 종료·Release/GHCR/Finalizer는 사용자 별도 승인 사항.
- 향후 새로운 PR CI 실패가 발생하면 이 파일에 **F752-003 이후로 이어서 기록**하고 최초 두 Run의 취소·리뷰 차단 원본을 삭제·PASS로 바꾸지 않는다.

## 5. F752-003 — Full PR CI #3156.1 재실패 (2026-10-22 UTC / 2026-10-23 KST)

- **원본**: [PR #780 Full CI #3156.1](https://github.com/planner77/masterGantt/actions/runs/39794786478), Run ID `39794786478` / Attempt `1`, event `pull_request`, Head `77337c663e3645628f7114044c089f49ff6e054c`, Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597`. 로그에 전달된 Test-Merge `6956319699f8489ef706078467cf7d8eed08d03a`. 생성 2026-10-22T14:20:13Z, 종료 2026-10-22T14:33:09Z.
- **최초 실제 FAIL**: `정책·저장소 계약 검사` Job [119879493029](https://github.com/planner77/masterGantt/actions/runs/39794786478/job/119879493029), Step `Issue`의 Python `tests/python/test_issue_752_diagnostics.py:181`, case `test_workflow_displays_korean_without_changing_machine_identifiers`. 전체 `Ran 19 tests`에서 **1 FAIL**.
- **기대/실제**: 단위 테스트는 `name: Issue #752 — 반복 PR 실패 진단`을 찾았지만, 안전한 YAML 원본에는 `name: "Issue #752 — 반복 PR 실패 진단"`으로 따옴표가 존재한다. Python `assertIn`의 불일치이며 Workflow의 YAML 의미 또는 신규 진단 로직 자체 실패로 증명되지 않았다. 분류: **TEST_CONTRACT**.
- **파생 결과 분리**: `PR 빠른 검사 판정` Job `119880211948` 실패 → `Build, static checks, and unit tests` `119880313852` / `Chromium end-to-end tests` `119880313904` / `Docker build and runtime smoke test` `119880313718` 집계 실패. **PR E2E Shard 실제 실행 SKIPPED, Docker 구현 SKIPPED, PR Production Build SKIPPED**로, 제품·E2E Assertion 실패가 관측된 것은 아니다. `QA Final — Automated` Job `119880367810` 또한 Required failure 및 원본 검증 ID/Attempt/SHA 불일치로 BLOCKED(파생). 이전 #3152의 E2E8/8 성공을 새 HEAD의 성공으로 재사용하지 않는다.
- **최소 교정**: 테스트 기대값에 Workflow 원본의 이중 따옴표를 반영한다. YAML에 있는 `#`는 사람이 읽는 이름의 일부이므로 원본 Workflow의 인용부호를 제거하거나 Required Job·검증 조건을 완화하지 않는다. 변경: `tests/python/test_issue_752_diagnostics.py` 해당 Assertion **1줄**, 누적 원장 및 [Work Packet](exec-plans/active/ISSUE_752.md). `.github/workflows/issue-752-diagnostics.yml`·제품 코드·샤드 수·Timeout·Assertion/Retry/Skip 정책은 변경하지 않는다.
- **이전과 교차 점검**: F752-001 stale HEAD 취소, F752-002 리뷰 스레드 차단은 별개 사건으로 보존. 최신 리뷰 5건 모두 Resolved/0 미해결; main 대비 PR Conflict 0/Behind 0. 해당 19개 정책 테스트의 다른 **18개** 성공은 해당 Head 기록이며 다음 HEAD 새 실행 결과를 증명하지 않는다.
- **동일 소스 검증 상태**: 원격 실패 로그로 기대/실제 한 줄 차이를 확인했고, 변경 후보의 문자열 일치 여부를 정적 비교함. 직접 Python 실행은 이 GitHub 연결 작업 환경에서 `NOT TESTED`; 다음 정확 HEAD의 원격 `tests/python/test_issue_752_*.py` 및 기존 Required Quality/E2E8/Docker와 QA/Owner는 모두 `NOT TESTED`. 이번 사용자 승인 범위는 **새 PR CI 시작까지(모니터링 제외)**이며 merge/Main/GHCR/Release/Issue 종료 제외.

## 6. F752-004 — Full PR CI #3157.1 보안 의존성 감사 실패 (2026-10-23 KST)

- **원본 귀속**: [PR #780 Full CI #3157.1](https://github.com/planner77/masterGantt/actions/runs/39837796723), Run ID `39837796723` / Attempt `1`; event `pull_request`; Head `1a195a87ab393066124d4375755776cb5d397930`; Base `72c2c9d0a912dc906d4101ea41a7a57e0c686597`; Test-Merge `52a56ed20dd0e88dd27fad092358438df7a49394`. 원본 GitHub Run 생성 2026-10-22T19:10:38Z / 종료 2026-10-22T19:13:33Z.
- **최초 실제 FAIL**: `정책·저장소 계약 검사` Job [120030795349](https://github.com/planner77/masterGantt/actions/runs/39837796723/job/120030795349), **Step 8 `production dependency audit`**, 명령 `npm audit --omit=dev`, exit 1. `next 16.0.0 - 16.4.0`, `Severity: critical`, `1 critical severity vulnerability`. 보안 권고 `GHSA-2464-fhr4-w9xw`(SVG Image Optimization RCE), `GHSA-p3m5-59mp-jv5r`(Server Actions DoS), `GHSA-673q-mjm6-r5xr`(`use cache` Typed Array RCE). npm 출력: `Will install next@16.4.2, which is outside the stated dependency range`. 분류: **POLICY_CI / DEPENDENCY_SECURITY**이며 기존 고정 `next@16.3.8`이 새 보안 권고 범위에 포함.
- **역사적 차이**: [#3152.1](https://github.com/planner77/masterGantt/actions/runs/39782641377)에서는 같은 명령이 `found 0 vulnerabilities`로 성공했고, 이번 #3157에서는 Critical 1건. 이 PR은 그 사이 `package.json/package-lock.json`을 수정하지 않았으므로 npm 취약점 데이터/보안 권고 반영에 의해 기존 잠재 결함이 노출된 것으로 판단. 이 사실을 Issue #752의 진단 기능 결함 또는 E2E 재발로 잘못 분류하지 않는다.
- **파생 결과**: `PR 빠른 검사 판정` Job `120031666624`에서 `POLICY_RESULT=failure` → `Build, static checks, and unit tests` `120031791654`, `Chromium end-to-end tests` `120031791510`, `Docker build and runtime smoke test` `120031791289` **집계 FAIL**. PR Next.js Production Build, E2E8 Shard, Docker 구현은 **SKIPPED / NOT RUN**(직접 assertion FAIL 관측0). `QA Final — Automated` Job `120031845682`도 `required quality 미성공`으로 파생 FAIL. 별도 TypeScript/ESLint/Vitest Job은 성공했으나 원본 Required3 성공과 혼동하지 않는다. #3156.1의 문자열 단언 교정은 이번 실행에서 아직 해당 Python 검사까지 도달하지 못해 새 Head 기준 검증은 **NOT TESTED**.
- **공식 근거·보완**: [Next.js 2026-10-14 보안 공지](https://nextjs.org/blog/nextjs-security-update-october-14-2026)는 16.4.1부터 패치, [Next.js v16.4.2 릴리스](https://github.com/vercel/next.js/releases/tag/v16.4.2)를 안정 버전으로 공개. 상위 소스 `vercel/next.js@v16.4.2/packages/next/package.json`과 비교하여 `next`·`@next/env` **16.3.8 → 16.4.2**, 기존 8개 `@next/swc-*` 패키지 및 `node_modules/next`의 하위 핀/URL 동기화, `sharp` 허용 하한을 `^0.35.5`로 정렬. 잠금 파일의 실제 `sharp` **0.35.5**는 이미 충족하므로 보존. `eslint-config-next@16.3.4`는 개발 전용이고 이 프로덕션 Audit의 직접 원인이 아니므로 **변경 제외**(불필요한 ESLint 규칙/의존성 회귀 방지). `npm audit fix --force`/보안 검사 skip/allowlist/timeout/샤드 정책 완화 금지.
- **변경 소스·수용 위험**: `package.json`, `package-lock.json`, `tests/python/test_issue_752_diagnostics.py`(runtime lock 동기화/보안 하한 음성 검증), 이 누적 원장, `docs/exec-plans/active/ISSUE_752.md`, `docs/CI_CD.md`, `docs/REMOTE_VALIDATION.md`. 버전 `0.129.1`, API/DB/schema, CI Required3, E2E8, GHCR/Finalizer/Release 권한 불변. Next.js 마이너 업데이트는 영향 범위가 넓어 **HIGH/OWNER_MANAGED** 유지.
- **정적 사전 검증**: 공식 v16.4.2 manifest의 dependencies와 기존 Lock의 비변경 의존성 일치, exact `next`/`@next/env`/8 SWC 매핑 및 SHA 대신 기존 npm tarball URL 작성 규칙/기존 `integrity` 부재 유지, `sharp 0.35.5` 충족을 비교 검증. 작업 실행 환경은 네트워크 차단으로 실제 `npm ci`·`npm audit`·Next Build·Chromium·Docker **NOT TESTED**. 다음 정확 Head PR CI에서 `npm ci` → `npm audit --omit=dev` → Python 20개 정책 회귀 및 기존 Type/Lint/Vitest/Next Build/E2E8/Docker/QA를 실증해야 한다. 실패/누락을 PASS라고 기록하지 않는다.
- **리뷰·충돌·인계**: 작업 착수 당시 GitHub Review 5/5 Resolved(미해결0), PR `mergeable=true` 및 main `72c2c9d0...`와 동일 기준(behind0). 최종 단일 커밋 게시 전 재검사. 새 Head 공식 Required·Trusted QA/Owner 및 신규 `workflow_dispatch` 원격 실증은 `NOT TESTED`; 본 요청의 범위는 **새 PR CI 시작까지**, 자동 결과 모니터링·병합·Main/GHCR/Issue 종료 없음.
