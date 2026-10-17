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
- `DESIGN.md`: N/A(사용자 인터페이스나 SVAR Gantt 화면을 수정하지 않는 CI 경로 작업)
- `docs/API.md`: N/A(앱 HTTP API 및 보안·인가 엔드포인트는 변경하지 않음)
- `docs/DB_SCHEMA.md`: N/A(SQLite 테이블과 migration 파일 변경이 없고 시험 DB는 격리함)

## AC_TEST_COVERAGE

- AC1: 정확 Issue·Owner·SHA 검증과 Build/Smoke/Preview digest Workflow 구현; 실제 GHCR 수동 게시·digest 확인은 main 반영 전 NOT TESTED.
- AC2: `tests/python/test_preview_publish.py`의 Actor·Issue·branch·main SHA·tag 200/401/403/429/500 등의 음성 테스트; PR CI 원격 실행 전 NOT TESTED.
- AC3: `tests/python/test_preview_publish.py`의 Build(read)·Publish(packages:write) 권한 분리와 이미지 SHA·archive SHA256 검사 계약; 실제 Run은 NOT TESTED.
- AC4: `docs/PREVIEW_PUBLISH.md`의 별도 Compose·volume/DB·digest pinning·백업·restore 절차; 실제 환경 검증 NOT TESTED.
- AC5: `.github/workflows/ci.yml`에서 기존 Required 3종·6-shard·Trusted QA·Main·Finalizer 불변 확인, Preview Python 회귀만 Policy에 추가; 원격 필수 검사 NOT TESTED.
- AC6: 반복 Preview→최종 PR/Main CI 전환과 정식 Finalizer 비연동 계약은 `docs/PREVIEW_PUBLISH.md`에 명시, 실제 원격 end-to-end NOT TESTED.
- AC7: `docs/PREVIEW_PUBLISH.md`에 최소 3건의 time-to-first-preview/Runner-minutes/CI-run 실측 계획, 실제 값 NOT TESTED.
- AC8: Preview 워크플로 비활성화 후 기존 PR/Main/Release 경로 영향 없는 독립 트리거·패키지 설계; 실제 롤백 실증 NOT TESTED.

## CI 실패 원장 연결 (2026-10-17)

- 원본 Run [39009485784.1](https://github.com/planner77/masterGantt/actions/runs/39009485784), PR #705, Head `9dd6f5c407dcb8417bf8b82b57a941d0ca8dcb26`, Base `de863713142a92f1cac56dbae044923822bca932`, test-merge `75e9ef89ecdd06111a3bdd16ad14e33ec50db73f`.
- 최초 실패는 `QA Preflight → DOCUMENTATION_SYNC: DOC_SYNC 기록 누락`이며 나머지 Required aggregate와 QA Final 실패는 연쇄, E2E/Docker/Unit 실제 실행은 SKIPPED. 기존 실패 결과는 불변이다.
- 구조 `## DOCUMENTATION_SYNC` / `## AC_TEST_COVERAGE`를 보완하고 `tests/python/test_preview_publish.py`에 실제 신뢰 QA `docs_gate` 회귀를 추가한다. 로컬 실행은 NOT TESTED, 새 exact HEAD PR CI 재검증 필요.
- 후속 실패 시 누적 원장인 [Issue #703 PR CI 실패 분석](../../ISSUE_703_PR_CI_FAILURE_ANALYSIS.md)에 Run별 새 근거를 추가한다.
