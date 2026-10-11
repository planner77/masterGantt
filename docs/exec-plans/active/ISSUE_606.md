# Issue #606 — T1/T2 Trusted QA 실제 운영 검증
- Parent: #593, #580; related #600 (metadata 자동 복구)
- Baseline: main `c81285741610ad28dc5d6b50f9bb97264970a79d`
- Branch: `test/issue-606-trusted-t1-t2`
- Scope: 테스트용 public 정적 표식 1개와 본 Work Packet. CI/QA/실행코드 변경 없음.
- Risk: LOW / qa_method: OWNER_MANAGED / QA required true
- Release: release_required=false, release_authorized=false; 병합 금지, 정식 GHCR·배포 금지
- T1, T2 verdict at PR creation: NOT TESTED; Manager decision: NOT TESTED

## 실행 순서
1. T1: PR open → full PR CI Quality/E2E 6 shards/Docker Required SUCCESS → default-branch QA Final — Trusted SUCCESS 및 `automated_qa=PASS` 증명.
2. artifact `ci-pr-source-<run_id>-<attempt>`, `qa-final-trusted-<source>-<run>-<attempt>`의 PR/Head/base/test-merge/source attempt/validator SHA 일치 검증. 원본 run 및 별도 Trusted run URL 기록.
3. T1 PASS 및 동일 Head/base/test-merge 유지 후에만 T2: 같은 PR 본문에 해석에 영향 없는 설명 한 줄 추가(커밋/코드 변경 금지). `pull_request.edited` metadata-only CI + Trusted PASS; 기존 full CI 재사용/6-shard E2E·Docker 생략 검증.
4. 두 테스트 실행의 GitHub run 수/attempt/Runner 시간·재실행 건수 기록. #600 reconcile 동작이 관여하면 별도 계측.
5. 실패·기본 브랜치 경합·출처 누락은 PASS로 우회하지 않고 BLOCKED/FAIL/SUPERSEDED로 구분하여 기록.
6. 실증 완료 후 Owner 판단 아래 미병합 PR 닫고 test branch 제거, Issue에 결과 기록.

## DOCUMENTATION_SYNC
- `docs/exec-plans/active/ISSUE_606.md`: UPDATED
- `public/qa-trusted-issue-606.txt`: UPDATED (테스트 표식)
- `AGENTS.md`: N/A(기존 역할·운영 가이드 불변, 제품/CI 정책 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 Trusted QA/Owner-managed 규칙 그대로 원격 실증)
- `docs/CI_CD.md`: N/A(CI 워크플로, Required Check, 운영 계약 불변)
- `docs/ISSUE_LIFECYCLE.md`: N/A(현재 PR 병합 없이 테스트만)
- `docs/GITHUB_OPERATIONS.md`: N/A(GitHub 운영 절차 및 권한 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(#593 T1/T2 검증 기준을 적용, 신규 프로세스 없음)
- `docs/TEST_PLAN.md`: N/A(#593 T1/T2 행의 실증, 테스트 계획 자체 불변)
- `DESIGN.md`: N/A(사용자 인터페이스·제품 동작 변경 없음)
- `docs/API.md`: N/A(앱 API 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB·스키마 변경 없음)

## AC_TEST_COVERAGE
- AC1: T1 full run에서 Quality/E2E shard 1~6/Docker SUCCESS 및 source run/attempt, Head/base/test-merge 수집.
- AC2: T1 Trusted workflow_run의 실제 SUCCESS + `automated_qa=PASS` 원장, validator SHA와 provenance 검증.
- AC3: T2 PR edited metadata-only CI (Head unchanged), old full-run 귀속·skip/reuse 및 Trusted PASS 증명.
- AC4: fail-closed 경계·Ruleset/Owner 수동 승인 분리·stale 증거 처리 확인.
- AC5: 두 Run의 링크·SHA·각 attempt·실행 시간·중복·DOC_SYNC 증거 기록.
- AC6: PR 미병합/정식 GHCR 미게시, 검증 후 안전 정리.

## 결과 원장
| 시나리오 | Source run / attempt | Trusted run / attempt | Head/base/merge/validator | Outcome |
| --- | --- | --- | --- | --- |
| T1 | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| T2 | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
