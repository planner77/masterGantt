# Issues #838–#840 — 통합 PR #841 실패 원장

## 정책
실제 오류/Required CI 실패는 OWNER_MANAGED 승인으로 우회하지 않는다. 정확한 Head·base·run·attempt와 수정 후 재실행 원본을 보존한다. 새 실패는 해당 시점에 추적하며 전부 해결하기 전에는 병합·GHCR·종료 금지.

## Run #3366.1 / 40621944490 — 초기 QA 메타데이터 실패 (2026-10-28)
- HEAD: c55d2fb1c2ffcd325ae84d98c8132afa4e044002.
- QA Final 신뢰 경계 확인 failure: PR 본문 `qa_method` 정규 구문 누락. Preflight BLOCKED: 검증기 API 404 (대표 Work Packet `docs/exec-plans/active/ISSUE_838.md` 미존재).
- 해결: PR 본문에 `qa_method: OWNER_MANAGED`, `risk_level: HIGH`, `qa_required: true`, `release_required: true`, `release_authorized: true`를 단일 행 선언. 대표 Issue #838에 AC1..AC8 추가, 정확한 Work Packet 경로 생성.
- 당시 Full 검증은 Skipped: Quality/E2E/Docker PASS가 아님.

## Run #3368.1 / 40622338753 — 문서 영향 기록 미비
- HEAD: 51d7a50711dbedc05238a39e5df1ffbb6f2f61df.
- QA Final provenance PASS; Preflight FAIL: `DOCUMENTATION_SYNC` 문서 영향 기록 없음(`docs/CI_CD.md`). 원인: AGENTS.md/SECURITY.md 보호 경로 변경 시 QA docs union 포함.
- 해결: Work Packet `DOCUMENTATION_SYNC`에 CI_CD, QA_REVIEW_POLICY, GITHUB_OPERATIONS, REMOTE_VALIDATION의 보존 이유/명시 N/A 추가.
- 코어 구현 CI는 Preflight에서 차단돼 PASS 아님.

## Run #3369.1 / 40622534775 — 실제 코드/계약 실패
- HEAD: c05a4c433bb6c4f56c17085bc33c1472a57e5435.
- 변경 경로 판정, QA 신뢰 경계, Preflight, 정책 및 TypeScript 검증 PASS.
- ESLint FAIL: `project-issue-workspace.tsx` 97/128: React effect 내부 동기 setState 2건; 17 기존 경고는 이번 차단 원인이 아님.
- Vitest FAIL: 14 / 총 3373 (3356 PASS/3 SKIP). 원인:
  1. Migration 0032 신규 도입으로 고정된 31 버전 기대값이 만료됨 — migration CLI/database/issue-623/logistics targets/task bindings/process catalog/context/resource memberships 총 11개 구 테스트 실패.
  2. `tests/config/e2e-shard-plan.json`의 신규 E2E 스펙 누락(8-shard 계획 보존 검사 실패).
  3. `route-security-inventory.ts`의 Issue GET/POST/PATCH 신규 라우트 누락(동일 라우트 전수 점검 실패).
  4. Issue 신규 검색 테스트의 23개 입력이 동일한 URL 설명을 공유해 검색 예상 1건 대비 23건 반환.
- 보완: React effect에서 네트워크 비동기 결과에만 상태 업데이트, 신규 마이그레이션(32번째) 계약을 모든 해당 회귀에 정확 반영, shard2에 신규 Issue browser spec 배치(8-shard 모든 파일 exactly once), 기존 route security inventory에 세 신규 메서드 보안 정책 등록, 검색 fixture description 분리. 테스트 삭제·skip·assertion 완화 없음.
- 다음 Head의 새 Full PR CI에서 재검증 필요. 현 실패의 수치·상태를 이전 PASS로 소급 표시하지 않는다.


## Run #3370.1 / 40623302735 — 고정 기대값 잔여 4건
- HEAD: eb2a4a6bd07ba85d7a632f59e85e3ed8d99f4bc3.
- Preflight/정책/TypeScript/ESLint PASS. Vitest: 4 failed, 3366 passed, 3 skipped.
- Failing cases: migration-cli.schema_migrations COUNT expected31 actual32; database.sqlite_schema expected 56 tables actual 57 (project_issues); logistics-targets-acceptance MAX(version) expected31 actual32; edit-authorization-handlers exact route security inventory list expected 139 vs actual 142 (GET/POST/PATCH Issue).
- 조치: 기존 원장/인덱스/보안 테스트를 보존하고 명시적으로 0032, project_issues, 3 route 추가. 무관한 인증·스케줄링 테스트 수정·제외 없음. 다음 최신 HEAD의 PR Quality 전체 재검증 필요.
- Required Quality 실패에 따라 E2E/Docker 집계 실패 및 QA Final FAIL은 이 run의 실제 실패이며 회귀 성공으로 바꾸지 않는다.

## release_state
- qa_method: OWNER_MANAGED; risk: HIGH; independent_qa: N/A. 최신 성공 Full PR required 3종 + Trusted 및 exact Owner final ACCEPT 전 merge 불가.
- Main CI, OCI immutable candidate, Generic Finalizer와 정식 GHCR은 NOT EXECUTED; #838/#839/#840 OPEN 유지.
