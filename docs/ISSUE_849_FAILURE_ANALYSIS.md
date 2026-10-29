# Issue #849 / PR #850 — 누적 PR CI 실패 분석

Primary Issue: #849 | 관련 PR: #850 | 갱신일: 2026-10-29 (KST)
Source of truth: AGENTS.md, docs/PR_CI_FAILURE_TRIAGE.md, docs/ISSUE_LIFECYCLE.md, docs/exec-plans/active/ISSUE_849.md

## 1. PR #850 전체 원격 Run/Attempt 기록

| 원본 Run/Attempt | HEAD 및 단계 | 관측 결과 | 직접/파생/미실행 분리 |
| --- | --- | --- | --- |
| [#3393.1](https://github.com/planner77/masterGantt/actions/runs/40784951385) · 40784951385.1 | `a94bf419c3e927ac2b155da616895b4da176acec` / Draft | FAILURE | Draft 차단이 의도된 동작. Quality/E2E/Docker Required 집계 파생 FAILURE, 구현 테스트 SKIPPED |
| [#3394.1](https://github.com/planner77/masterGantt/actions/runs/40785099400) · 40785099400.1 | `382eb5f67a127538241d4be084a22f4bdfcd2198` / Draft | FAILURE | 동일 Draft 차단, product/lint/typecheck/unit/Chromium8/Docker 구현 미실행 |
| [#3395.1](https://github.com/planner77/masterGantt/actions/runs/40785168680) · 40785168680.1 | `913c4e3b96c18bc408c54298e149e5d5598b94f8` / Draft | CANCELLED | Ready 전환/후속 Run 이후 취소. Required 집계 일부 FAILURE는 취소/skip의 파생, 독립 제품 FAIL 아님 |
| [#3396.1](https://github.com/planner77/masterGantt/actions/runs/40785203891) · 40785203891.1 | `913c4e3b96c18bc408c54298e149e5d5598b94f8` / FINAL_FULL | FAILURE | **F-001 QA Preflight 직접 FAIL**. PR Fast 및 3 Required+자동 QA 파생 FAIL, 구현 검사 NOT RUN |
| [#3397.1](https://github.com/planner77/masterGantt/actions/runs/40789357833) · 40789357833.1 | `c64897b0a23ae9378b38f70b04f9730e40f4954f` / FINAL_FULL | FAILURE | **F-002: migration 버전 기대값 5건, F-003: Issue KPI 구조 기대값 1건**. Preflight·Policy·TS·ESLint PASS, Unit 6 FAIL/3372 PASS/3 SKIPPED; E2E/Docker 미실행·집계 파생 FAIL |
| Fast Development #190.1 · 40784951407, #191.1 · 40785099377, #192.1 · 40785168679 | Draft 비권위 경로 | CANCELLED | 공식 Full CI나 QA PASS 아님 |
| Fast Development #193.1 · 40785204191 | Ready 비권위 경로 | SKIPPED | 공식 Full CI나 QA PASS 아님 |

- Base SHA: `d7f41dbf7252b378c4eccc49642ac9978c58c57d`, PR #850; 모든 Run Attempt=1. #3396.1 Test merge SHA: `8b890ed0c07a05cabc44c2f8acb3a4f20dc11213`. Draft 이전 Run의 Test merge SHA는 확보하지 못했으므로 UNKNOWN; 파일·기능 PASS를 추론하지 않는다.
- 직접 실패 원본: Job `123156729878`, [QA Preflight](https://github.com/planner77/masterGantt/actions/runs/40785203891/job/123156729878), `FAIL / DOCUMENTATION_SYNC` — `docs/exec-plans/active/ISSUE_849.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — 문서 영향 기록 없음: docs/CI_CD.md`. PR title/Refs, risk/QA flags, Issue AC, path policy는 PASS. 충돌/최신 Full/Owner/review/문서 의미는 DEFERRED.
- 파생 실패 Job: PR Fast `123156865887`, Required Quality `123156993905`, E2E `123156994005`, Docker `123156993849`, QA Final Automated `123157038453`. 정책/Typecheck/ESLint/Vitest/Build/Chromium 8 shard/Docker 실제 smoke는 SKIPPED, 원본 기능 회귀 시험 증거 없음.

## 2. 누적 실패 Cross-run 매트릭스

| 실패 ID | 최초 관측과 종류 | 근거와 원인 | 보완 및 검증/잔여 |
| --- | --- | --- | --- |
| DRAFT-001 | #3393.1 / #3394.1, 의도된 Draft-only Required 차단 | Draft는 공식 Full 경로가 아니며 실제 제품 테스트 없음 | #850 Ready 전환으로 Full 시작. Draft gate 변경 없음 |
| CANCEL-001 | #3395.1, 후속 Run 경합으로 CANCELLED | 취소 Job을 실행 성공으로 볼 수 없음 | 원본 이력 보존. 기능 PASS/FAIL은 UNKNOWN |
| F-001 | #3396.1 / Job 123156729878, 첫 **직접 FAIL** | 신뢰된 Base `scripts/qa_final_automated.py::docs_gate` 정규식은 `- path: UPDATED` 또는 `- path: N/A(reason)` 형태의 **정확한 한 행 끝 상태**만 허용(경로는 Markdown 코드 표기). 구 Work Packet의 `UPDATED: 설명` 및 `N/A(reason): 설명` 행은 인식되지 않아 CI_CD 항목이 누락됨 | Work Packet 모든 DOCUMENTATION_SYNC 기록을 정규식에 맞게 개정. QA 정책 스크립트/필수 게이트 수정 없음. 새 PR Full CI NOT TESTED |
| F-001-LATENT | 같은 문서의 후속 단계, **원격 직접 FAIL 아님** | AC_TEST_COVERAGE가 표만 갖고 있어 `- AC1: ...`~`- AC8: ...` regex 매핑 누락; 첫 blocker 제거 시 다음 단계에서 실패할 가능성 | 기존 AC 표를 삭제하지 않고 bullet AC1~AC8을 보완. 정적 구조 확인만, 원격 PASS 확정 아님 |

## 3. 누적 원인·합집합·수정 및 반례
- 유일한 제품 외 직접 실패 경로: `scripts/qa_preflight.py`이 호출하는 `scripts/qa_final_automated.py::docs_gate` 및 `docs/exec-plans/active/ISSUE_849.md`. 이전 Draft blocked/cancelled aggregate를 각각 별도 코드 실패 또는 브라우저 실패로 합산하지 않는다.
- **재발 방지**: 기존 Work Packet을 단순 개행/설명 유무로 판단하지 않고 base 검증 코드의 **full-line anchor** 형식과 required QA_DOCS 집합, AC1~AC8 bullet 매핑을 한 번에 검사. 기존 문서 영향 의미 및 N/A 근거 보존. Source policy 변경/skip/assertion 완화 없음.
- **교차 영향**: `tests/server/projects/project-issues.test.ts`(상태 CRUD·암호·stale·0034 SQLite), `tests/e2e/project-issues.spec.ts`(기본 filter·KPI·상태열·keyboard), `tests/server/db/database.test.ts` 및 migration CLI·Resource/Process/Logistics exact 0034 version 테스트. 이전에는 한 번도 실행되지 않았으므로 요구한 후속 Full PR에서 독립 검증할 것.
- #838–#840, #846 기존 이슈 원본 실패와 기록은 관련 참고 문서일 뿐, 이번 #849의 직접 CI 실패로 이전하지 않는다.

## 4. 같은 최종 source 검증과 새 PR CI
- 정적 구조 검증: Work Packet `DOCUMENTATION_SYNC` 상태 행의 정확한 전체형식/Required QA_DOCS 및 AC1~AC8 bullet 매핑의 존재를 확인한다. 이 자체는 원격 QA Preflight PASS가 아니다.
- 로컬 npm/node_modules 설치된 저장소 체크아웃이 없으며 GitHub 도구만 사용하므로 `npm run verify:prepr`, TypeScript/Lint/Vitest/Playwright/Docker 실측은 NOT EXECUTED. 코드·Migration·실행 환경 회귀가 없는지 최종 CI 전에는 알 수 없음.
- 새 Head의 Full Quality/E2E8/Docker/Trusted QA 및 Manager ACCEPT는 NOT TESTED. 현재 사용자 지시 범위는 PR CI **시작**; 완료 모니터링/병합/Main/GHCR/운영 Migration/이슈 종료 금지. 결과 수집 시 같은 본 원장에 Run/Attempt·직접/파생/취소/미실행과 수정 이력을 추가한다.

## 5. 2026-10-29 KST — 두 번째 Full 실패 F-002/F-003 (Run #3397.1)

**원본:** [#3397.1](https://github.com/planner77/masterGantt/actions/runs/40789357833), Run ID `40789357833`, Attempt 1, event `pull_request.synchronize`, PR #850, Head `c64897b0a23ae9378b38f70b04f9730e40f4954f`, Base `d7f41dbf7252b378c4eccc49642ac9978c58c57d`, test merge `49265a2fdaa83dc7dbdadf393d6c89e7b93bcb1b`.

- **직접 PASS:** QA Preflight `123170528807` (F-001 문서 오류 재발 안 함), Policy `123170637336`, TypeScript `123170637344`, ESLint `123170637407`.
- **직접 FAIL:** [Vitest `123170637628`](https://github.com/planner77/masterGantt/actions/runs/40789357833/job/123170637628) / `Run npm test`. 284 test files 중 4 failed, 279 passed, 1 skipped; **6 tests failed, 3372 passed, 3 skipped**. 다음 6개가 직접 실패 전부다.
- **파생 FAIL:** PR Fast Gate `123171393689`(`UNIT_RESULT=failure`), Required Quality `123171503970`, Chromium aggregate `123171504085`, Docker aggregate `123171504092`, QA Final Automated `123171541300`(`required quality 미성공`). Next build, E2E 8 shard, Docker smoke **SKIPPED/NOT RUN**, 별도 제품 회귀 확인 불가.

| ID | 직접 실패한 파일·case/라인 | 실제 vs 기대 | 유형/보완 |
| --- | --- | --- | --- |
| F-002a | `tests/server/migration-cli.test.ts:97` restart ledger | 34 vs 33 | TEST_CONTRACT: 34와 정확 0034 이름 확인 |
| F-002b | `tests/server/db/issue-623-target-migration.test.ts:46` fresh DB | 길이34 vs33 | TEST_CONTRACT: 34개 적용 검증 |
| F-002c | 동일 파일 :39, :56 migrated ledger | 1..34 vs 1..33 | TEST_CONTRACT: 버전 1..34와 원본 SHA256 checksums 전체 검증 |
| F-002d | 동일 파일 :89 late-failure rollback | pending 10 vs 9 | TEST_CONTRACT: 0025..0034 10개 적용, rollback/무손실 시험 유지 |
| F-002e | `tests/server/logistics/logistics-targets-acceptance.test.ts:479` reopen | MAX(version)=34 vs33 | TEST_CONTRACT: MAX=34, 정확 0034 이름 확인 |
| F-003 | `tests/server/projects/project-issues.test.ts:288` tombstone KPI | `{total:0,completed:0,inProgress:0,registered:0}` vs 구 2필드 | TEST_CONTRACT: 4필드 **전체 일치**와 registered/in_progress 삭제 제외 조건 추가 |

**누적 분석:** #3393·#3394는 Draft 차단, #3395는 취소, #3396(F-001)은 문서 형식으로 사전 차단돼 Vitest가 미실행. #3397에서 F-001 Preflight는 PASS하고 **새 유형** F-002/F-003이 발견됨. Migration #0034 및 summary DTO 확장에 비해 legacy assertion 6곳이 누락됐다. 관측된 직접 실패는 SQL 데이터 손상/권한 오류가 아니라 기존 테스트 기대 계약의 미동기화다. 현재까지 두 Run 간 같은 직접 원인 재발 증거 없음.

**보완/통합 범위:** 위 4개 파일의 exact-count/전 필드 equality를 **실제 명세와 일치**시키고 0034 이름 확인·등록/진행 중 tombstone negative filter를 추가한다. 스키마 적용·체크섬·기존 레코드 복원, #846 password/Origin/private/If-Match/412/429, 실제 브라우저/Gantt 회귀는 KEEP_UNIQUE. 테스트 삭제/skip, assertion 약화, CI 정책·Required Gate·retry/timeout 변경 없음.

**합집합 및 증거 경계:** F-001의 `docs/exec-plans/active/ISSUE_849.md`/QA Preflight + F-002 `migration-cli.test.ts`, `issue-623-target-migration.test.ts`, `logistics-targets-acceptance.test.ts` + F-003 `project-issues.test.ts`; 간접 `tests/server/db/database.test.ts`, `tests/e2e/project-issues.spec.ts`·credential/soft-delete 및 0034 migration. 수정된 HEAD의 실제 npm/SQLite/Playwright/Docker는 원격 CI 전 NOT TESTED(로컬 checkout/네트워크 접근 불가). 결과를 PASS로 추정하지 않는다.

**검토/인계:** 기존 원본 실패 3393~3397을 삭제하거나 PASS로 변경하지 않는다. 같은 PR #850의 최신 Main 정렬, 미해결 리뷰 thread, 충돌 여부를 확인한 후에만 새 HEAD PR Full CI를 시작하며, Run ID/Attempt는 시작 사실로 기록하되 CI 결과 모니터링·병합/Main/GHCR/운영 migration·Issue 종료는 하지 않는다.

## 6. Release F-004 — v0.138.0 Main 출처 증명 중복 Job 오류 (2026-10-29)

- **Main 근거:** PR #850 정확 two-parent merge SHA `ec98e168fa8810c0986e5f5e0d38201e915a293f`, PR Full [#3398.1](https://github.com/planner77/masterGantt/actions/runs/40795311231) SUCCESS, Main [#3399.1](https://github.com/planner77/masterGantt/actions/runs/40803478707) SUCCESS(Required3, E2E8/8, Main candidate GHCR publish/smoke), Generic Finalizer [#1219.1](https://github.com/planner77/masterGantt/actions/runs/40806521345) 최초 tag/dispatch SUCCESS.
- **실패 원본:** [GHCR Release #207.1](https://github.com/planner77/masterGantt/actions/runs/40806571540), Run `40806571540.1`, tag `v0.138.0`, Job `123236428921` Step 7 `Main verified candidate exact digest 확인` 직접 FAIL: `BLOCKED: cannot authenticate a PR-built Main release candidate: MAIN_PUBLISH_RUN_ATTEMPT_NOT_UNIQUE_OR_INCOMPLETE`. Static/E2E 8/8/Quality gate SUCCESS, candidate `sha256:53ad1af4bfd9de8c1b9ef618ae2800ab99407c81895283ad41f82d4d4abc77d1` pull 성공. 최종 attestation/tag promotion/Finalizer completion SKIPPED. Cleaning `No such container`는 앞선 실패 후 파생.
- **F-004 증거:** GitHub Main Attempt1 Jobs API: Required Quality `123217632761`, E2E `123225960675`, Docker aggregate `123217632846`, Main Publisher `123225990378` 각각 유일 SUCCESS. Main 구현 `Docker smoke 구현` `123216888037` SUCCESS + PR 전용 동명 `123217633885` SKIPPED. 기존 `verify_ci_image_release.py`의 전 Job 이름 `len(by_name[name])==1`이 해당 경우를 거부, `main_evidence=[]` → F-004. 외부 registry 연결/이미지 손상이나 8샤드 실패 증거는 없음.
- **교정:** `main_job_evidence`에서 **Main Docker에만** SUCCESS 1개 또는 SUCCESS+SKIPPED 정확 한쌍을 인정; Required3·Publisher 정확 단일 SUCCESS 유지. 다른 중복/실패/취소/미확인/성공 없는 smoke, 복수 Main 성공 Run을 계속 BLOCKED. `tests/python/test_ci_image_release.py`에 Main #3399 원본 유사 positive 및 다수 negative 추가. Test Lifecycle EXTEND/KEEP_UNIQUE; CI/workflow/보안·빌드 또는 이미지 내용 강도 하향 없음.
- **복구/버전:** Annotated `v0.138.0` tag(peeled SHA `ec98e168...`)는 생성됐고 GitHub Release by tag가 404로 정식 발행되지 않음. 기존 태그 이동/삭제·직접 overwrite·소급 성공·계약 우회 금지. 같은 Issue 신규 보완 PR의 **PATCH 후보 0.138.1**과 새 exact-HEAD 전체 PR CI/Trusted/Owner 승인 및 Main push CI/GHCR candidate/Release runtime/Finalizer를 차례로 검증해야 한다. `0.138.0` Owner 승인 marker는 새 버전에 적용 안 됨. 현장 운영 DB migration·새 GHCR 게시/Issue 종료 미실행.
