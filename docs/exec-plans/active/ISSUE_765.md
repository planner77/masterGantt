# Issue #765 — 인증된 v0.129.0으로 #732/#736 미발행 부채 퇴역 및 #734 FINAL 복구

## 작업 경계

- Primary Issue #765. 복구 구현은 기존 이슈 하나 안에서 수행하며 별도 이슈 분리 없음.
- Risk HIGH / qa_method=OWNER_MANAGED / qa_required=true / manager_decision=NOT TESTED.
- 정확한 기준 main: e20e4a72e59b46bde34c7ae5befd5e0f46ed335b. 기존 버전 0.129.0 유지, release_required=false, release_authorized=false (#765 PR 자체의 새로운 정식 이미지 발행 없음).
- 제품 API/DB/Schema/UI/AGENTS.md/DESIGN.md/QA 규칙은 불변. CI 정책/Finalizer/문서만 수정.
- 보호경로와 CI 정책 수정이므로 exact Head 3 Required Quality/E2E6/Docker, trusted QA, 미해결 리뷰 0, Owner HIGH 위험수용 및 Main CI/임시 후보 검증 필수. 기존 #732/#736 Main CI 재실행, v0.129.0 재게시 금지.

## 불변 릴리스 증거

| 단계 | Issue/PR | Merge SHA | 애플리케이션 버전 | Main CI |
|---|---|---|---|---|
| 1 | #732 / #761 | 5ffe02a334d2279fabb63943c90614a7acfaf6ad | 0.127.0 | #3067.1 CANCELLED |
| 2 | #736 / #760 | 1c1938851aa8234febcba404f4007d6c94fb2233 | 0.128.0 | #3071.1 FAILURE |
| 3 | #732 / #763 | 62e715adbc3f497e319918306bf26cbdd73353b7 | 0.128.0 (유지) | #3077.1 CANCELLED |
| 4 | #734 / #759 | e20e4a72e59b46bde34c7ae5befd5e0f46ed335b | 0.129.0 | #3081.1 SUCCESS |
| 5 | #765 / 신규 복구 PR | 병합 이후만 확정 | 0.129.0 (유지) | 실행 이후 판정 |

- #734 Owner 승인 v0.129.0: Issue comment 6305865915; exact Release #186.1 Run 39543231934 SUCCESS.
- GHCR 정식 0.129.0 + ci-e20e4a72... 검증 digest: sha256:37c9d83696fbfb3b2a6c5ec365f3bc509ee7ebbb80f5249eea9b82d26c6d7032.
- #732 0.127.0 개별 게시 Owner 철회: Issue comment 6307754727; #736 0.128.0 철회: 6307755249.
- #736 PR #764는 아직 OPEN/missing CI이며 소스 수정은 0.129.0 이미지에 포함되지 않음; 복구 대상/브랜치 삭제 제외.

## 구현 소유 파일

- scripts/release_debt_recovery_765.py: bounded Owner marker, exact first-parent 및 Main run 검증, Git/Release/private GHCR 사전 감사, old branch 사전 검사, bot-origin RETIRED.
- scripts/auto_release_finalizer.py: 승인된 #765 plan이 있을 때만 지정한 old 3개 SHA를 일반 pending에서 제외. #633 B2 및 기타 SHA는 그대로 처리.
- .github/workflows/release-finalizer.yml: Owner issue_comment(765) 전용 trusted main 재개 Job. 다른 댓글/PR 소스는 실행하지 않음.
- .github/workflows/ci.yml + scripts/test-release-debt-recovery-765.py: 보호 CI 정책 Job에 positive/negative 전용 Unit fixture 추가.
- docs/GENERIC_RELEASE_FINALIZER.md, docs/ISSUE_LIFECYCLE.md, docs/CI_CD.md, docs/TEST_PLAN.md, docs/exec-plans/active/PLAN.md, CHANGELOG.md 동기화.

## 두 단계 승인: 구현 승인과 RETIRED 실행 승인

사용자에게서 받은 구현 지시는 이번 protected code PR 작성/테스트 승인이다. 아래 **RETIRE 실제 mutation은 다른 시점의 exact SHA가 확정된 Owner 댓글을 별도로 요구**한다.

새로운 승인 마커 키: mastergantt-release-debt-765-authorization:v1. 유효한 코멘트는 Issue #765에서 최신 Owner가 발행하고 HTML comment 형태를 가져야 한다. JSON 예시는 다음과 같다.

```json
{
  "authorized": true,
  "mode": "RETIRE_732_736_TO_734",
  "recovery_issue": 765,
  "recovery_pr": "REPLACE_WITH_REAL_INTEGER_AFTER_PR_MERGE",
  "recovery_sha": "REPLACE_WITH_EXACT_40_HEX_MERGE_SHA",
  "source_732_sha": "5ffe02a334d2279fabb63943c90614a7acfaf6ad",
  "source_736_sha": "1c1938851aa8234febcba404f4007d6c94fb2233",
  "correction_732_sha": "62e715adbc3f497e319918306bf26cbdd73353b7",
  "release_sha": "e20e4a72e59b46bde34c7ae5befd5e0f46ed335b",
  "release_run_id": 39543231934,
  "release_digest": "sha256:37c9d83696fbfb3b2a6c5ec365f3bc509ee7ebbb80f5249eea9b82d26c6d7032",
  "expected_version": "0.129.0",
  "note": "Owner authorizes one-time bounded retirement for #732/#736 based on the already verified v0.129.0 SHA and OCI digest. Historical Main CI remains unchanged."
}
```

위 예시는 recovery_pr과 recovery_sha가 가짜 placeholder이므로 실행용 마커가 아니다. 신규 복구 PR의 실제 번호와 Merge 40자리 SHA로 치환하고, #765 PR의 Main CI Quality/E2E6/Docker 및 ci-SHA 후보 PASS를 확인한 후에만 Owner marker를 기록한다. 기존 자동 댓글 또는 이슈 설명을 Owner 승인으로 간주하지 않는다.

## 복구 실행 순서

1. 최신 main과 정확 PR761/760/763/759/복구PR 연결 SHA·first-parent 5연속·즉시 parent/version·PR Refs/provenance를 read-only 검증. 새 main이 더 전진했으면 BLOCKED.
2. 원본 Main #3067 CANCELLED, #3071 FAILURE, #3077 CANCELLED를 인증된 GitHub Run id/status/source로 확인하며 이후 실제 success가 생겼으면 재감사. 실패/취소를 PASS로 바꾸지 않음.
3. Owner의 구버전 개별 게시 철회 최신 marker, 복구 Issue #765의 정확 Owner marker, #734의 Release Owner marker 존재 검증.
4. 과거 v0.127.0/v0.128.0 Git tag·GitHub Release·Private GHCR exact tag 인증된 ABSENT와 old ci-SHA candidate tag ABSENT. 등록된 Package metadata의 모든 페이지 조회; Git tag/Release/Package 중 하나라도 UNKNOWN/401/403/404/429면 BLOCKED.
5. v0.129.0 annotated Git tag의 peeled SHA, Release #186.1 completed SUCCESS, Main verified candidate + exact OCI digest 동일성, 신규 #765 Main/ci-SHA PASS 검사.
6. 과거 3개 PR 브랜치 모두 SHA-leased dry-run preflight; 외부 Open PR 참조/보호/변경된 HEAD 발견 시 mutation ZERO.
7. 정확 3개 branch만 SHA-leased 안전 정리 후 #732(761+763)/#736(760)에 github-actions[bot] RETIRED 불변 원장 각 1개 기록, Closed. 구버전에는 정상 FINAL을 위조하지 않음.
8. 기존 Generic Finalizer에서 #734는 이미 성공한 Release #186을 인용해 정상 Final, #765는 신규 no-release Main artifact 검증·candidate cleanup/branch cleanup/Final. 기존 0.129.0 tag/image 재빌드·덮어쓰기 절대 금지.
9. 부분 실행이나 중복 Owner trigger는 기존 RETIRED/Closed/브랜치 상태를 정확 재검증한 후 멱등 재진입.

## 반드시 통과할 정책 회귀

- 최신 Owner marker revocation/foreign actor/malformed/double marker/잘못된 PR·SHA·run·version·digest 차단.
- 다른 Issue가 first-parent 사이에 삽입되거나 최신 main이 바뀌면 BLOCKED.
- 과거 Main SUCCESS 위조, 원본 Run 누락, 기존 Release/Main candidate UNKNOWN, GitHub Release/Private GHCR 404에서 false ABSENT 금지.
- historical ci-SHA unexpected present, current v0.129 OCI label/digest mismatch, bot RETIRED 위조·duplicate 차단.
- 브랜치 preflight 실패 시 삭제/댓글/이슈 Close 0건; partial 완료 후 재실행 시 중복 RETIRED 0건.
- 기존 #622/#633/일반 Finalizer/동일 버전 릴리스 불변; 정확한 새로운 #765 PR CI·Trusted/Owner ACCEPT는 완료 전 NOT TESTED.

## DOCUMENTATION_SYNC

UPDATED: recovery module, Generic Finalizer, existing Owner trigger, CI policy regression, Finalizer/Lifecycle/CI_CD/TEST_PLAN/CHANGELOG/PLAN/본 Work Packet.
N/A: AGENTS.md, DESIGN.md, QA_REVIEW_POLICY.md, API.md, DB_SCHEMA.md (공통 Owner/QA policy 유지, 제품 API/UI/DB 불변).

## 현재 단계

IMPLEMENTATION/PR CI: 검사 전 NOT TESTED. Owner RETIRE 별도 승인 Marker 없음. 기존 v0.129.0 정식 이미지 발행 완료/변경 금지.
