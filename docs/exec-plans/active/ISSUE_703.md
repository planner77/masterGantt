# Issue #703 — GHCR Preview-first / 정식 Release Gate 유지

- Primary Issue: https://github.com/planner77/masterGantt/issues/703
- Baseline main: de863713142a92f1cac56dbae044923822bca932 / app 0.114.1 (2026-10-17).
- Work branch: ci/issue-703-preview-publish.
- 요청 범위: 구현/문서/회귀 → PR 생성, 미해결 리뷰·충돌 확인/조치 → PR CI 시작. CI 완료 감시/병합/Main/실제 GHCR 게시/정식 Release는 범위 밖.
- Risk: HIGH (Workflow·GHCR registry credential·신뢰 경계). qa_method=OWNER_MANAGED; qa_required=true; independent_qa=N/A(Owner-managed); manager_decision=NOT TESTED.
- release_required=false, release_authorized=false; 앱·Schema 변경 없이 기존 SemVer 0.114.1 유지. 별도 Owner HIGH 위험 수용 및 최종 병합 승인 필요.

## 문서 및 설계 근거

AGENTS.md의 #598/#659/#697/#699, DESIGN.md(제품 UI 영향 없음), .github/workflows/ci.yml, deploy/docker/Dockerfile, scripts/verify-image-policy.sh, scripts/verify-registry-api-smoke.mjs, docs/CI_CD.md, docs/LOCAL_PREPR.md, docs/ISSUE_LIFECYCLE.md, docs/REMOTE_VALIDATION.md, docs/TEST_PLAN.md, docs/QA_REVIEW_POLICY.md 및 #438/#598/#659/#679/#697/#699 확인.

## 영향·소비자/음성 매핑

| 변경 Producer | 직접 소비자 | 부정·교차 검증 |
| --- | --- | --- |
| 수동 preview-publish.yml | Owner 수동 Workflow | Owner 아님, 이벤트/Repo/Issue/branch/SHA 불일치 BLOCKED |
| preview_publish.py 소스 검증 | trusted authorize/publish | Issue 실제 상태, branch HEAD, main 실행 SHA 최신성, API 오류 |
| GHCR Registry 인증 조회 | 동일 Preview tag 부재 | 200/401/403/429/5xx와 UNKNOWN 거부; 기존 정식 package 오염 금지 |
| Docker 이미지 Build | trusted 정책/SQLite/API Smoke | readiness, 인증 거부/Task 작성, Project 복구, DB restart 영속성 |
| 빌드 산출물 artifact | packages:write publish job | 빌드 재실행/소스 checkout 금지, SHA256/OCI revision 일치 |
| 시험용 Compose | 사용자 격리 환경 | 운영 DB·volume·Secrets·port와 분리, migration restore 필요 |

## 작업 구성

1. scripts/preview_publish.py: GitHub API로 Owner/Issue/branch/SHA/main 인증, GHCR manifest 상태 확인 (404만 absent).
2. .github/workflows/preview-publish.yml: 기본 main 수동 진입 / authorize(read) → build(read+trusted smoke) → publish(packages:write+재인증). Source branch는 publish job에 checkout하지 않는다.
3. tests/python/test_preview_publish.py 및 PR/Main CI policy unit: source/actor/registry negative, 권한·workflow 분리 정적 검증.
4. docs/PREVIEW_PUBLISH.md: 시험 배포·digest pin·롤백/DB 복원·안전·비용 측정.
5. 이번 변경의 Review/충돌 해결, PR CI 생성까지 작업. 실제 Preview workflow_dispatch는 main 병합 후 가능.

## AC 검증 상태

| AC | 내용 | 판정 |
| --- | --- | --- |
| AC1 | 정확 SHA Owner 호출→Preview GHCR digest | 구현 후보 / REMOTE NOT TESTED |
| AC2 | 잘못된 Actor/Ref/Issue/SHA/tag fail-closed | 단위 테스트 작성 / RUN NOT TESTED |
| AC3 | 빌드 Job과 packages:write Job 분리 | 정적 계약 작성 / RUN NOT TESTED |
| AC4 | 운영 DB·volume 격리, 시험 롤백 | 문서화 / 실제 시험 NOT TESTED |
| AC5 | PR Required3/QA/Owner/Main/Release/Finalizer 불변 | Preview policy 단위 테스트만 CI 추가 / 원격 검증 대기 |
| AC6 | 반복 Preview→최종 PR/Main, Finalizer 부작용 없음 | NOT TESTED |
| AC7 | 최소 3개 실제 시험 Time-to-first-preview/Runner 비용 비교 | NOT TESTED |
| AC8 | Preview 비활성화 시 기존 CI/Release 영향 없음 | 설계상 분리 / 실제 검증 NOT TESTED |

## 실행 근거와 위험

GitHub Connector는 저장소 파일의 읽기·쓰기가 가능하지만 이 세션의 격리 컨테이너는 github.com DNS 접근 불가여서 해당 Repository checkout/npm/Docker 실행을 수행하지 못했다. 로컬 unit/Python/Container Smoke PASS를 주장하지 않는다. 실제 원격 PR CI 결과는 별도 검증 대상이며, 이번 지시에는 CI 모니터링이 포함되지 않는다.

HIGH 위험 잔여 항목: registry 인증 404 오판 가능성, Docker archive 전송 비용/크기, 대상 main 이동 시 재시도, OCI digest/Revision 검증, untrusted Build의 외부 네트워크, GitHub Environment 보호 정책(필요 시 Owner 사전 구성). Preview는 운영 권한을 갖지 않으며 정식 CI·Release를 대체하지 않는다.

## DOCUMENTATION_SYNC

신뢰된 base의 `qa_final_automated.docs_gate`는 아래의 개별 파일별 표준 형식과 별도 AC 매핑을 요구합니다. 기존 `UPDATED: ...`/`N/A(reason): ...` 나열은 유효한 구조화 증거가 아닙니다.

- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 QA 위험도·Owner 병합 승인과 필수 CI 검증 기준을 그대로 보존)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 GitHub 병합·릴리스 명명 및 CI 한글 규칙에는 변경 사항 없음)
- `docs/LOCAL_PREPR.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/PREVIEW_PUBLISH.md`: UPDATED
- `docs/exec-plans/active/ISSUE_703.md`: UPDATED
- `docs/ISSUE_703_FAILURE_ANALYSIS.md`: UPDATED
- `docs/PR_CI_FAILURE_TRIAGE.md`: N/A(main #704의 PR CI 누적 분석 지침을 변경하지 않고 그대로 준수함)
- `docs/SCHEDULING_ENGINE.md`: N/A(Milestone 테스트의 GET 전송만 제한 복구하며 일정·Dependency 도메인 알고리즘 불변)
- `DESIGN.md`: N/A(사용자 인터페이스나 SVAR Gantt 화면을 수정하지 않는 CI 경로 작업)
- `docs/API.md`: N/A(앱 HTTP API 및 보안·인가 엔드포인트는 변경하지 않음)
- `docs/DB_SCHEMA.md`: N/A(SQLite 테이블과 migration 파일 변경이 없고 시험 DB는 격리함)

## AC_TEST_COVERAGE

- AC1: 정확 Issue·Owner·SHA 검증과 Build/Smoke/Preview digest Workflow 구현; 실제 GHCR 수동 게시·digest 확인은 main 반영 전 NOT TESTED.
- AC2: `tests/python/test_preview_publish.py`의 Actor·Issue·branch·main SHA·tag 200/401/403/429/500 음성 및 `tests/scripts/isolated-readonly-get.test.ts`의 관측된 ECONNRESET 1회 read-only 복구·비Reset/HTTP 오류 전파 5시나리오; PR CI 새 Head 전 NOT TESTED.
- AC3: `tests/python/test_preview_publish.py`의 Build(read)·Publish(packages:write) 권한 분리와 이미지 SHA·archive SHA256 검사 계약; 실제 Run은 NOT TESTED.
- AC4: `docs/PREVIEW_PUBLISH.md`의 별도 Compose·volume/DB·digest pinning·백업·restore 절차; 실제 환경 검증 NOT TESTED.
- AC5: `.github/workflows/ci.yml`에서 기존 Required 3종·6-shard·Trusted QA·Main·Finalizer 불변 확인, Preview Python 회귀만 Policy에 추가; 원격 필수 검사 NOT TESTED.
- AC6: 반복 Preview→최종 PR/Main CI 전환과 정식 Finalizer 비연동 계약은 `docs/PREVIEW_PUBLISH.md`에 명시, 실제 원격 end-to-end NOT TESTED.
- AC7: `docs/PREVIEW_PUBLISH.md`에 최소 3건의 time-to-first-preview/Runner-minutes/CI-run 실측 계획, 실제 값 NOT TESTED.
- AC8: Preview 워크플로 비활성화 후 기존 PR/Main/Release 경로 영향 없는 독립 트리거·패키지 설계; 실제 롤백 실증 NOT TESTED.

## CI 실패 원장 연결 (2026-10-17)

- 최신 main Issue #704의 공통 지침 [PR CI 실패 누적 REWORK](../../PR_CI_FAILURE_TRIAGE.md)을 적용한다. Issue별 정규 경로는 `docs/ISSUE_703_FAILURE_ANALYSIS.md` 하나이며 과거 Run 원장을 덮어쓰지 않는다.

- 원본 Run [39009485784.1](https://github.com/planner77/masterGantt/actions/runs/39009485784), PR #705, Head `9dd6f5c407dcb8417bf8b82b57a941d0ca8dcb26`, Base `de863713142a92f1cac56dbae044923822bca932`, test-merge `75e9ef89ecdd06111a3bdd16ad14e33ec50db73f`.
- 최초 실패는 `QA Preflight → DOCUMENTATION_SYNC: DOC_SYNC 기록 누락`이며 나머지 Required aggregate와 QA Final 실패는 연쇄, E2E/Docker/Unit 실제 실행은 SKIPPED. 기존 실패 결과는 불변이다.
- 구조 `## DOCUMENTATION_SYNC` / `## AC_TEST_COVERAGE`를 보완하고 `tests/python/test_preview_publish.py`에 실제 신뢰 QA `docs_gate` 회귀를 추가한다. 로컬 실행은 NOT TESTED, 새 exact HEAD PR CI 재검증 필요.
- 후속 실패 시 누적 원장인 [Issue #703 PR CI 실패 분석](../../ISSUE_703_FAILURE_ANALYSIS.md)에 Run별 새 근거를 추가한다.

## 2026-10-17 CI #2883.1·#2884.1·#2891.1 전체 이력 교차 보완

- 실패 누적 단일 원장은 [docs/ISSUE_703_FAILURE_ANALYSIS.md](../../ISSUE_703_FAILURE_ANALYSIS.md)의 F-001~F-003 및 [#704 공통 지침](../../PR_CI_FAILURE_TRIAGE.md) 참조.
- 원본 #2880: 문서 DOC_SYNC 직접 실패(Preflight) → #2884·#2891에서 Preflight SUCCESS로 보완 검증. 원본 실패 이력 불변.
- #2883: `milestone-stage-exchange.spec.ts`의 관측 GET `ECONNRESET`, Run 자체는 취소되었으나 Shard5에 실제 FAIL가 기록됨. [Run](https://github.com/planner77/masterGantt/actions/runs/39010283771), [Trace/진단](https://github.com/planner77/masterGantt/actions/runs/39010283771/artifacts/12092861934) 확인.
- #2884: Chromium6/6, Quality/Docker, Trusted QA 성공 (이전 SHA 한정). 동일 source에 대한 새 검증으로 승격 불가.
- #2891: `issue-623-resource-mvp.spec.ts` → `target-project.ts` GET `ECONNRESET`. Health=200, isolated process alive, cgroup oomKill0(모두 실패 직후 자료), 서버 종료·OOM 확정 증거 없음. [Run](https://github.com/planner77/masterGantt/actions/runs/39019744531), [Trace/진단](https://github.com/planner77/masterGantt/actions/runs/39019744531/artifacts/12095994618). Cancelled 5 shards는 실제 실패로 기록하지 않는다.
- 유형: `INIT_TRANSPORT` 직접, 근인은 `UNKNOWN`. 5개 이슈를 포괄하는 제품 변경이나 전체 Skip·Timeout 확대 금지. 변경 영향은 `tests/e2e/fixtures/isolated-application-diagnostics.ts`, `target-project.ts`, `issue-623-target-resource.ts`, `issue-623-resource-mvp.spec.ts`, `milestone-stage-exchange.spec.ts` 및 새 `tests/scripts/isolated-readonly-get.test.ts`.
- 보완: 관측기 선진단(프로세스/메모리/Health/HTTP), 정확 `ECONNRESET` **읽기 전용 GET 1회** 복구, 두 번째 실패 또는 비Reset·HTTP 오류는 원래 FAIL. 모든 POST/PUT/PATCH/DELETE 재전송0, canonical revision·Target/Task6 mutation·M/D/M/M·Excel/JSON·Gantt instance 단언과 기존 6-shard/fail-fast 불변. [Issue #680](../../exec-plans/active/ISSUE_680.md) 선례를 제한적으로 재사용.
- 검증 예정: 신규 Vitest deterministic negative/positive 5 사례, 기존 #623 E2E 2건·#464 E2E(관련 1건)·#621 fixture 경계, policy/Preflight 및 최종 Full Required3·Trusted QA. 실제 신규 Head 결과는 **NOT TESTED**.
- DOCUMENTATION_SYNC: `docs/TEST_PLAN.md` UPDATED, `docs/REMOTE_VALIDATION.md` UPDATED, `docs/exec-plans/active/ISSUE_703.md` UPDATED, `docs/ISSUE_703_FAILURE_ANALYSIS.md` UPDATED. `docs/SCHEDULING_ENGINE.md` N/A(Milestone 표시/일정 엔진 계약 변경 없음, 테스트 한정 GET 전송 실패 복구).
- 추가 AC 매핑: AC2의 실패 시 안전한 BLOCKED·출처 관측; AC3의 권한 분리는 불변, AC5는 기존 PR Required3 유지. Preview 자체의 GHCR 게시 AC1/AC6/AC7/AC8은 main 병합 후 별도 실행 전 NOT TESTED.


## 2026-10-17 PR CI #2896 F-004 REWORK — 관측 인수 전체 적용

- 최신 Main 기준: `c0eca9ad5bfdb6c14d98dec7c5cfd7256e4619d7` (#552 merge), application `0.115.0`. 기존 최초 baseline/developer history는 위 Work Packet에 불변으로 보존한다.
- 새 F-004: [Run #2896.1](https://github.com/planner77/masterGantt/actions/runs/39026038481), Head `bdb550d96c688997443b4b4bbae37dc24235b245` / Base `c0eca9ad5bfdb6c14d98dec7c5cfd7256e4619d7` / Test-Merge `597a6b03d36d74378245b5fc5fdc8a1d1e21ed82`. Shard3 `issue-621-resource-target.spec.ts:92` → `target-project.ts:54` unobserved canonical GET `ECONNRESET`; 39 PASS/1 FAIL/53 NOT RUN, 5 shard CANCELLED. Preflight/Policy/Quality/Docker PASS, E2E aggregate/QA Final 파생 FAIL.
- 과거 원장 합집합은 [단일 누적 실패 문서 F-001~F-004](../../ISSUE_703_FAILURE_ANALYSIS.md)를 따른다. #2880 DOC_SYNC, #2883 milestone-stage-exchange read reset, #2891 issue-623 read reset과 #2884/#2894 정확 과거 Head 전체 CI SUCCESS를 누적 대조했다. 원본 기록 삭제·타 SHA PASS 승계 금지.
- 실제 [#2896 Trace](https://github.com/planner77/masterGantt/actions/runs/39026038481/artifacts/12097868890): observer가 없는 실패 경로로 API request event 누락, 격리 프로세스 생존·별도 Health200·cgroup oomKill0 관측. 원시 TCP/Next Socket/OOM의 인과 증거는 UNKNOWN. F-003의 observer 선택적 전달이 F-004에 닿지 못했던 **코드 적용 누락**은 확인됨.
- 변경 producer: `tests/e2e/fixtures/target-project.ts`, `issue-621-target-project.ts`, `issue-623-target-resource.ts`의 필수 `ObserveIsolatedApi` 인수 및 상대 canonical route. 직접 소비자: #621 5case, #622 1case, #623 2case, Target authoring 7case, Resource Dashboard API 1case. 누락된 optional branch는 제거하며 TypeScript가 필수 인수 미전달을 차단한다.
- 보호 정책: observer 먼저 오류·Health/child/cgroup 기록한 후 **정확 ECONNRESET인 GET만 1회** 추가 시도, HTTP 오류·다른 transport·두 번째 실패는 FAIL. POST/PUT/PATCH/DELETE 재시도0. #680 선례와 관련 #621/#622/#623/#464·Admin Target 인접 소비자, 기존 Revision/Task/Assignment/SQLite/UI 모든 단언·timeout/fail-fast 그대로.
- 증거: 기존 `tests/scripts/isolated-readonly-get.test.ts` positive/negative5에 canonical route 값과 absolute URL 분류를 검증하는 신규 Unit 1개(합계6). 신규 정확 Head의 typecheck/Unit/직접 E2E 16 + #464/Full E2E 6Shard/Docker·Trusted QA는 PR CI 실행 전 `NOT TESTED`. 로컬 실제 npm/Chromium/Docker 미실행은 `NOT TESTED` (구현 diff·관측 자료 감사와 구분).
- DOCUMENTATION_SYNC: `docs/ISSUE_703_FAILURE_ANALYSIS.md`, `docs/TEST_PLAN.md`, `docs/REMOTE_VALIDATION.md`, 본 Work Packet UPDATED. `docs/SCHEDULING_ENGINE.md`는 일정·Dependency 도메인 알고리즘과 Milestone 바/표시 변경 없음으로 N/A. `docs/API.md`·`docs/DB_SCHEMA.md`·`DESIGN.md` 제품 인터페이스/DB/UI 변경 없음 N/A. 원래 서식 `## DOCUMENTATION_SYNC`/`## AC_TEST_COVERAGE`은 QA Preflight와 일치하도록 그대로 유지한다.
- AC 매핑 영향: AC2 fail-closed 관측, AC3 Preview 게시 권한 분리 불변, AC5 PR Required3·원격 검증 요구 불변. AC1/4/6/7/8 실제 Preview GHCR 게시·rollback·성능 측정은 후속 실증 전 NOT TESTED. release_required=false/release_authorized=false.
- Owner 요청 범위: 동일 #705 Branch 수정·main 정렬, 미해결 리뷰 Thread와 충돌 해결, 새 PR CI **시작**. 성공 모니터링·병합/Main CI/GHCR/Finalizer/Issue 종료는 미진행.
