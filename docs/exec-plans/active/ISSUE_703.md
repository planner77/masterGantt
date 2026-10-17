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

UPDATED: AGENTS.md, docs/CI_CD.md, docs/LOCAL_PREPR.md, docs/REMOTE_VALIDATION.md, docs/ISSUE_LIFECYCLE.md, docs/TEST_PLAN.md, 신규 docs/PREVIEW_PUBLISH.md.
N/A(reason): DESIGN.md, docs/UI_UX_GUIDELINES.md (UI 변경 없음); docs/API.md·docs/DB_SCHEMA.md (제품 REST/DB 변경 없음); docs/QA_REVIEW_POLICY.md (기존 QA·승인 정책 불변); docs/IMPORT_SCHEMA.md (Import 변경 없음).
