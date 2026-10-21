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

## PR CI #3084.1 TIMEOUT 교정 — 테스트 커버리지 유지

- PR #766 Head 77b4e3ee9e67157fb48c5355c96b3c68177ab057에서 #3084.1 (39563793357) Shard 5/6은 91개 test PASS 후 35분 Job Timeout과 일치하는 08:19:06Z 취소. 나머지 5개 Shard 및 Quality/Docker 성공; E2E aggregate/QA Final 실패는 종속 결과다.
- 기존 실패 F765-001(Preflight), F765-002(위조 RETIRED 정책 Unit)는 #3084에서 Preflight/Policy 성공으로 보완 확인. 별도 원장은 [F765-003](../../ISSUE_765_FAILURE_ANALYSIS.md)에서 누적.
- 테스트 파일 4개만 tests/config/e2e-shard-plan.json에서 이동: project-task-editor 1→6, issue-623-resource-mvp 3→2, issue-730-view-composer 5→2, issue-735-system-dashboard 5→4.
- 136개 고유 E2E spec/6 shard/각 파일 정확 1개 배정 고정; 파일 수 [23,22,26,21,23,21] → [22,24,25,22,21,22]. 테스트 구문·대상·단언·Retry/Skip·35분 Job cap·Required checks·QA 정책/이미지·제품 기능 변경 없음.
- 단순 완료 case 소요를 이전한 추정 분포는 [26.8,22.2,27.5,25.5,26.9,27.2]분이지만 Shard5 잔여 4개 파일 등 미측정이 있어 실측 완료 전 PASS 아님.
- 새 Head Full PR CI Quality+E2E6+Docker, Trusted QA/Owner HIGH 및 필요한 Main CI 검증 전 MERGE_READY=BLOCKED. 미완료된 과거 CI를 재실행하지 않고 기존 릴리스 v0.129.0을 보존한다.

## PR CI #3085.1 — E2E Plan Unit 고정 기대값 오류 교정 (F765-004)

- Full [#3085.1](https://github.com/planner77/masterGantt/actions/runs/39574608432), Head a91a826a728f8169446fac94de074310b5fb1678 / Base e20e4a72e59b46bde34c7ae5befd5e0f46ed335b / Test merge 3642c80e817847c9bb0bc6fe251b9e9f75ec54be.
- QA Preflight/Policy/TypeScript/ESLint PASS, Vitest 3159 PASS / 1 FAIL / 3 SKIP (tests/scripts/e2e-shard-planner.test.ts:126: 실제4/기대5). 이전 Shard5→4인 issue-735의 구 배치 값과 Shard5→2인 issue-730의 구 배치 값이 Test 계약에 남아 있었음.
- tests/scripts/e2e-shard-planner.test.ts: issue-735→4, issue-730→2로 갱신하고 project-task-editor→6, issue-623-resource-mvp→2의 두 이동도 추가 고정 assertion으로 보호. Plan JSON은 F765-003의 그대로, 136개 unique E2E spec/6 Shard coverage 불변.
- PR Fast Gate 실패로 해당 #3085 E2E6/Docker 실제 구현 NOT RUN; F765-003 Shard5 35분 Timeout 재분배 효과는 여전히 미검증. [F765-004 누적 원장](../../ISSUE_765_FAILURE_ANALYSIS.md)에 실제 Run/Job/반례 추가.
- 새 소스에서 기존 14개 명시 위치 모두 Plan JSON과 정적 일치; 원격 단위/Chromium/Build/Docker/Trusted QA는 새 CI 시작 전 NOT TESTED.

## Main CI #3087.1 실패 및 동일 SHA 복구 계획 (F765-005)

- [Main #3087.1](https://github.com/planner77/masterGantt/actions/runs/39583074075) source SHA `71f9b9ddb61be7f6e076accc027188f362e18bb1`, push event; Quality/Docker 및 5/6 Chromium Shards SUCCESS, Shard1 112PASS/1FAIL, aggregate E2E FAILURE. #765 정책 코드/원장 안전 경계 실패는 아니며 #491 템플릿 저장 POST201 이후 격리 GET가 `ECONNRESET`.
- Playwright Trace+isolated application diagnostics 확인: GET 전송 경과 약29ms, 테스트 서버 살아있고 Health200, cgroup OOMKill0. 원인 소켓 reset의 세부 기전은 UNKNOWN이며 35분 Timeout, 서버 전체 종료 또는 제품 회귀로 단정 금지.
- 기존 동일 source PR #3086.1의 #491 동일 테스트 PASS 비교. 소스 변경 없이 exact old Main run `39583074075`의 실패 Job만 다시 실행하여 성공/재실패와 종속 Aggregate/candidate 결과를 감사. 이전 attempt1 FAILURE는 불변으로 보존.
- canonical F765-005 누적 기록은 별도 docs-only branch에 보존해 **복구 대상 main SHA를 변경하지 않는다**. Repo main 및 등록된 GHCR 0.129.0 Digest/릴리스는 그대로. 정확한 이후 attempt/Artifact 확인 후 추가 기록 예정.
## DOCUMENTATION_SYNC

- `AGENTS.md`: N/A(현재 Owner/HIGH/PR CI/Finalizer 신뢰 경계 기존 정책 준수, 공통 AGENTS 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A(Owner-managed 보호경로의 Required Quality/E2E/Docker/Trusted 승인 불변)
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(신규 CLI·운영자 직접 명령 대신 기존 Generic Finalizer에서 실행)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 PR CI Run #3082.1/#3083.1 및 실제 증거는 전용 실패 원장·Work Packet·GitHub Actions 인계)
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `docs/exec-plans/active/ISSUE_765.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `tests/config/e2e-shard-plan.json`: UPDATED
- `tests/scripts/e2e-shard-planner.test.ts`: UPDATED
- `docs/ISSUE_765_FAILURE_ANALYSIS.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(사용자 UI/레이아웃·SVAR Gantt 로직/디자인 변경 없음)
- `docs/API.md`: N/A(제품 공개 API 계약·읽기/쓰기 엔드포인트 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite 테이블·스키마 마이그레이션 없음)

## AC_TEST_COVERAGE

- AC1: 원본 #732/#736/#734 불변 SHA·PR·First-parent·CI/Release 원장과 현재 main 시점 재조회.
- AC2: 인증된 private GHCR 전수 조회, Tag SHA/OCI Digest 정상/401/404/429/UNKNOWN 음성 실증.
- AC3: #764 변경 제외와 기존 Release #186의 #621/#530 회귀 검증 범위 및 남은 리스크 기록.
- AC4: 버전별 개별 게시 복구 대신 정확 승인된 미발행 퇴역·단일 통합 릴리스 계약 음성/양성 검증.
- AC5: #732 0.127.0/#736 0.128.0 최신 Owner 철회와 #765 독립 Owner 복구 승인 이력 구분.
- AC6: 신규 protected 복구 PR 단일화, 변경된 정책/CI/Finalizer와 이슈 관리·원장 테스트 연결.
- I1: exact Owner marker schema, duplicate/foreign/revoked/edited/wrong SHA/버전 테스트.
- I2: first-parent 네 역사적 merge와 새 #765 Merge, 원본 Main CANCELLED/FAILURE 및 #734 성공 검증.
- I3: Git tag/GitHub Release/private GHCR 0.127/0.128 ABSENT, 0.129 digest PRESENT, UNKNOWN 안전차단.
- I4: 세 과거 PR 브랜치 전부 SHA-leased preflight 후 삭제, #764 OPEN PR/브랜치 제외 테스트.
- I5: #732/#736 bot RETIRED 및 #734/#765 정상 FINAL 순서, 역사적 FINAL 위조 방지.
- I6: 중복 trigger·부분 완료 복구·main drift·closed barrier 복원 제한 및 fail-closed.
- I7: DOCUMENTATION_SYNC 개별 파일·N/A 근거, 독립 Work Packet·CI 실패 원장 보존.
- I8: 정확 신규 PR Head Required Quality/E2E6/Docker/Trusted/HIGH Owner 후 merge/Main 기준 적용.

## PR CI 실패 원장

- [F765-004](../../ISSUE_765_FAILURE_ANALYSIS.md): #3085.1 stale E2E-Shard mapping Vitest (3159 PASS/1 FAIL), Fast Gate로 Chromium/Docker 미실행; 4개 명시 배치 동기화.

- [F765-003](../../ISSUE_765_FAILURE_ANALYSIS.md): #3084.1 Shard5/6 35분 Job 제한 취소, 중간 결과 91 PASS·4개 후속 스펙 NOT RUN; 테스트 분배 교정.


- [F765-001](../../ISSUE_765_FAILURE_ANALYSIS.md): 최초 PR Full #3082.1 QA Preflight DOCUMENTATION_SYNC 구조 실패. 신규 원격 Full CI로 재검증 필요.

## 현재 단계

IMPLEMENTATION/PR CI: #3082.1 Preflight FAIL; #3083.1 Python Policy FAIL; #3084.1 E2E Shard5 CANCELLED; #3085.1 Vitest Shard Plan expectation FAIL (F765-004). New exact Head PR CI/Trusted QA NOT TESTED; Owner RETIRE separate approval not granted. Existing v0.129.0 formal GHCR remains immutable.
