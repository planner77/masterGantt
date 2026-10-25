# Issue #808 — 누적 실패·PR CI 준비 원장

Primary Issue: [#808](https://github.com/planner77/masterGantt/issues/808) | 갱신일: 2026-10-25
Source of truth: [PR_CI_FAILURE_TRIAGE](PR_CI_FAILURE_TRIAGE.md)

## 1. 원격 PR/Run/Attempt

착수 시 `Refs #808` PR 검색 결과0. 기존 해당 Issue의 PR CI 실패 run은 관측되지 않았다. 새 CI는 시작 전 NOT TESTED다. 선행 #807/PR #810의 실패·PASS는 별도 원장이며 #808의 성공/실패로 옮기지 않는다. 원격 게시 직전 infra가 관련 PR·리뷰·충돌을 다시 확인한다.

## 2. 누적 실패 매트릭스

| ID | 원본 실제 실패 | 원인·교정 | 현재 상태 / 경계 |
| --- | --- | --- | --- |
| F808-001 | 초기 `gh issue view 808 --json ...` exit1, GitHub GraphQL HTTP401 Bad credentials | CLI 인증 실패. 연결 GitHub 도구로 Issue808/806/809·PR 조회 성공, git fetch origin main 성공 | 조회 복구 PASS. CLI 인증을 복구했다고 주장하지 않으며 secret 출력/수정 없음 |
| F808-002 | Next 로컬 문서 `use-client.mdx` 읽기 실패 | 설치 가이드는 `.md` 확장자. 파일 검색 후 `use-client.md`를 실제 읽음 | 문서 확인 PASS. 제품/CI 실패와 구분 |
| F808-003 | 초기 Domain typecheck TS18048 4건(detail target undefined narrowing) | backend가 `return fail`로 narrowing을 명시 | 동결 최종 typecheck PASS; 최초 실패 보존 |
| F808-004 | 없는 `scripts/verify-markdown-links.mjs` 명령 exit1 MODULE_NOT_FOUND | 실제 `scripts/check-markdown-links.mjs` 검색·실행 | Markdown343개 PASS. 제품/CI 실패 아님 |
| F808-005 | Work Packet 로컬 docs_gate의 AC1~AC6 매핑 인식 실패 | `- AC1 (R2-AC1):`를 검증기의 정확 `- AC1:` 형식으로 교정 | 기존 검증기로 DOC_SYNC 구조·AC1~AC6 매핑 PASS. gate를 수정하지 않음 |
| F808-006 | 독립 QA의 physical 상세 범위 P1 재현: equipment=E10 선택의 기존 ledger 근거는E10만, 신규 taskSources는E10+E5 | union이 선택 variant의 좁힌 rows 대신 snapshot.rows를 재사용해 상세 관계를 확대함. backend가 선택 rows/provenance 합집합과 정확 상세를 보완 중 | total 선택 row 보완 후에도 pivot E10 cell의 상세가 total.taskSources를 재사용해 E5를 포함하는 잔존을 QA가 재현. cell별 좁힌 근거 교정 후 최종 직접19case 및 독립 원본 total/cell 재현 PASS. 최초·잔존 재현 모두 보존 |
| F808-007 | 독립 QA P2 재현: Group G1 조건 pivot은G1만이나 Plan.groups는G1/G2 모두 반환 | 중복 membership의 Calendar를 보존하되 기존 Plan projectionGroupIds로 표시 그룹을 제한해야 함 | projectionGroupIds 교집합으로 교정. 최종 그룹/Calendar 직접 테스트 및 독립 G1 재현 PASS |
| F808-008 | 독립 QA P2:500Task/500Assignment·32Group(33cells)의 Plan예산 내 입력이8,555,787byte 모델 생성 | 셀별 반복 근거가 기존2MiB 응답 한도를 넘는데 analysis는 직렬화 제한을 적용하지 않음 | 기존 reportBytes budget 재사용·UTF-8 크기 초과 음성 테스트 및 독립 원본fixture의 한도 거부 PASS. QA 최초 synthetic fixture의 R2 membership 참조 오류와 정상 fixture 재현을 구분 |
| F808-009 | 독립 QA 비용 검토: conditions raw 배열을 unique/validate한 뒤 variants 한도를 확인해 검증 scan이 selectionRows budget 밖에서 선행 | 기존 idsPerField/totalIds를 normalize 전에 적용하고 validateConditions scan도 동일 작업량 budget에 포함하도록 보완 | 200/400 raw cap을 값scan 전에 적용하고 validation scan을 budget에 포함; 최종 duplicate·축당/전체 과다 입력 음성 PASS. 실제 production 성능 장애로 단정하지 않음 |
| F808-010 | 독립 QA P1: Resource R1 source path에서 기존 T0진단 denominator6/개인미배정2가 신규4/0으로 축소 | sourceScope의 A Task집합을 diagnostics T0에도 적용해 개인필터 무효 진단을 숨김 | sourceScope.diagnosticTaskIds로 기존 T0와 A를 분리. 최종 직접 및 독립 R1 진단6/미배정2/personal flag 재현 PASS |
| F808-011 | 22:16:01 backend tsc TS2353: ResourcePlanInput에 여분 RESOURCE_DASHBOARD_LIMITS property | 한도 상수 교정 중 textual replace가 calculateResourcePlan 입력에 여분 필드를 삽입 | 해당 필드 제거 후22:16:24 tsc PASS. assertion/기존 Plan API 변경 없음 |
| F808-012 | infra가 게시 tree payload를 단일 exec 출력으로 읽던 중 출력 토큰 상한으로 JSON truncation·parse 실패 | 원격 mutation0인 준비 단계에서 발생. 파일별 bounded chunk로 읽어 같은 bytes의 tree payload를 구성하는 방식으로 변경 | 제품/test 실패와 구분. 소스3hash·14파일불변·원격게시전 정확tree/bytes 재검증 필수 |

초기 adapter Vitest12/12 PASS는 보완 전 후보의 LFF이며 최종 source 증거가 아니다. 누적 실제 실패 테스트 파일 합집합: 아직 Unit assertion 실패 없음; 초기 TS 실패 파일 `src/domain/resources/resource-analysis.ts`. 도구 인자 schema 확인 중 `get_repo`의 잘못된 `repo` 인자 오류는 mutation/제품 실패 없이 정정했으며 원격 repo 변경은 없었다.

## 3. 원인별 보완·교차 범위

제품·fixture 실패는 실제 관측 후 추가한다. 새로운 adapter 계약에 직접 테스트를 추가하고 기존 ledger/KPI/Plan·서버/Excel 경계는 고유 oracle로 유지한다. 기존 테스트 삭제·skip·timeout/허용 오차 확대·CI gate 완화는 수행하지 않는다. retry로 최초 실패를 덮어쓰지 않는다.

## 4. 동일 후보 검증·리뷰/충돌·다음 CI

baseline `048ae92ff673f1d0c4c69171fe3cc9bffe25dc19`, branch `feat/issue-808-resource-analysis`, 별도 worktree. LFF source fingerprint·명령/결과·별도 사전 검토·미해결 리뷰/충돌 및 게시 head/run은 최종 동결 후 추가한다. 원격 Required3/Trusted/Owner는 NOT TESTED, MERGE_READY=BLOCKED. 사용자 요청에 따라 PR CI 시작 확인 뒤 결과 모니터링은 하지 않는다.

## 5. 인접 원장·실제 서버/Excel 빠른 검증

Manager 실행: `npx vitest run --config tests/config/vitest.config.ts tests/domain/wbs-task-ledger.test.ts tests/domain/wbs-task-ledger-acceptance.test.ts tests/domain/resource-kpi.test.ts tests/domain/resource-plan.test.ts tests/domain/resource-plan-periods.test.ts tests/domain/resource-plan-budget.test.ts tests/server/resources/resource-kpi-integration.test.ts tests/server/projects/resource-excel-export.test.ts tests/server/resources/wbs-dashboard-views-http.test.ts tests/features/resources/wbs-view-transport.test.ts tests/features/resources/resource-dashboard-model.test.ts --reporter=json --outputFile=/tmp/issue-808-validation/adjacent.json`

11파일/152 tests PASS, failed0/skipped0, exit0. 기존 in-memory SQLite·HTTP handler·OOXML 검증과 pure 모델/Calendar 테스트를 구분하며 실제 Chromium browser/full CI 실행이 아니다. 새 analysis adapter 직접 검증은 source 보완 이후 별도로 동결하여 수행한다. 실행기 Vite CommonJS configLoader 안내 warning은 기존 설정이며 테스트 FAIL이 아니다. 이11파일 및 소비 원장/서버/fixture source는 이번 diff에서 변경하지 않았고 새 adapter 결과의 PASS로 과대 표시하지 않는다.

## 6. 보완 전후 단계 구분

backend의18개 직접 Unit·typecheck·대상 ESLint PASS(22:17:34 KST)는 F808-010 T0 교정 전 후보다. 이전16case 및 초기12case를 최종 후보 PASS로 합산하지 않는다. backend 별도 인접6파일97PASS는 실행 범위가 겹치므로 Manager11파일152와 더해 고유 건수를 부풀리지 않는다. 최종 source는 알려진 모든 P1/P2를 일괄 보완·동결한 뒤 직접 테스트와 필요한 정적 검증·QA 재검토로 판정한다.

## 7. 최종 동결·교정 판정·원격 준비

최종3파일 source SHA는 [검증 증거](evidence/issue-808/local-validation.json)와 [Work Packet](exec-plans/active/ISSUE_808.md)에 기록했고 backend 동결·Manager 직접검증·별도 qa_docs 재검증에서 일치한다. 최종19/19 직접Unit·전체TypeScript·대상ESLint PASS. 기존11파일152tests는 관련 원장/서버/fixture가 변경되지 않아 영향 분석으로 재사용하며 초기12/16/18 또는 backend97을 더하지 않는다.

독립 `/root/analysis_qa`: total E10·pivot E10detail·G1 Plan·R1 T0 denominator6/personallyUnassigned2 및 원본8,555,787byte fixture 한도 거부5건을 모두 최종 source에서 재현 PASS, 새 코드 지적0. 문서 의미 검토도 PASS이며 최종 원격 QA_FINAL/Owner ACCEPT와 구분한다. 모든 발견의 최초 FAIL/교정 중 잔존은 위 원장에 보존했다.

infra 사전조회: 최신 main048ae92ff673f1d0c4c69171fe3cc9bffe25dc19, 선행PR810의 리뷰1개 resolved, #808의 과거 canonical PR/CI0. 새PR 게시 직전 최신main·부모/bytes/tree·현재 미해결리뷰/충돌을 조회한다. 실제 PR/head/run/attempt와 게시결과는 Issue808 STATUS/PR에 남긴다. 게시 후 원격 quality/e2e/docker·Trusted QA·Manager ACCEPT는 NOT TESTED 상태로 인계하며 CI 결과를 모니터링하지 않는다.

로컬 환경 한계: 기존 symlink node_modules의 실제 Next는16.3.4, package/lock 선언은16.4.2다. Node22.14.0/Vitest5.0.0/TypeScript5.8.3/native SQLite13.0.3에서 관련 pure Domain·서버/OOXML LFF를 실행했으며 Next API 코드/실제browser/build를 수정·실행하지 않았다. 선언 버전 frozen npm ci·build·Chromium은 원격 Full CI의 별도 NOT TESTED다. 로컬 실행을 완전한 CI 동등 환경으로 보고하지 않는다.

## 8. REWORK_R01 — PR811 Full QA gate·미해결 리뷰2건 (2026-10-25)

이 절이 현재 상태다. 앞선1~7절의 PR 미생성/원격 NOT TESTED·최종19case 사전검토는 최초 게시 당시의 역사적 범위로 보존한다. 사용자 재개 요청에 따라 전체 원장과 GitHub 관련 PR/모든 Run/Attempt·원본 출처·리뷰를 대조했다. 정제 원격 증거는 [rework-r01-remote.json](evidence/issue-808/rework-r01-remote.json)이다.

### 접근 가능한 전체 원격 이력과 판정

원본 PR Head `4a1c9c8b11cadb70f94f034c4484d3a2acd30597`, Base `048ae92ff673f1d0c4c69171fe3cc9bffe25dc19`, Test merge `a6db61caa0117f3f8cacc26327d5ef7c0bd5456d`. canonical PR 검색1·Issue timeline7건·PR commit1개·branch run2개·착수 이후 repository run8개와 각각의 다음 페이지가 비어 있음을 확인했다. 관련6runs 모두 attempt1이며 metadata-only PR CI·이전 attempt는 없다. 서로 다른 workflow의 보조 성공/skip을 Required/Trusted PASS로 전용하지 않는다.

| PR / Run·Attempt | event / 역할 | 실제 판정·최초 실패·취소·미실행 |
| --- | --- | --- |
| PR811 / [Full #3297.1·40197745892](https://github.com/planner77/masterGantt/actions/runs/40197745892) | pull_request / 원본 Full | Run FAIL.30Jobs=success22/failure1/skipped7/cancelled0. Required quality/e2e/docker·Chromium8/8·TypeScript/ESLint/Vitest/production build/Docker 구현은 PASS. 유일 실패는 QA Final Automated job121188791718/step3,2026-10-25T13:57:13Z `미해결 review thread`, automated_qa=BLOCKED, exit1 |
| [Trusted #944.1·40199971387](https://github.com/planner77/masterGantt/actions/runs/40199971387) | workflow_run / 기본브랜치 검증 | 파생 FAIL. job121188878120/step4,13:57:33Z `원본 PR CI run 자체가 성공하지 않았습니다`, exit1. validator SHA는 위 Base와 동일 |
| [Fast #119.1·40197745824](https://github.com/planner77/masterGantt/actions/runs/40197745824) | pull_request / 참고용 | SKIPPED. 실제 Full/Required PASS 근거가 아님 |
| [Diagnostics #139.1·40199971334](https://github.com/planner77/masterGantt/actions/runs/40199971334) | workflow_run / 진단 후보 | workflow SUCCESS이나 진단 권고 NOT_RECOMMENDED/failedAttempts0. 실제 구현/테스트 실패0이며 별도 진단 rerun을 시작하지 않음 |
| [Metadata reconcile #844.1·40199971364](https://github.com/planner77/masterGantt/actions/runs/40199971364) | workflow_run / metadata 복구 | SUCCESS/NO_METADATA, 최신 Head metadata-only run 없음·rerun 요청0. Full/QA 성공이 아님 |
| [Readiness #879.1·40199971370](https://github.com/planner77/masterGantt/actions/runs/40199971370) | workflow_run / 보조 준비 | SKIPPED. 원본 실패를 성공으로 바꾸지 않음 |

source artifact12600328831의 PR811/run40197745892/attempt1/Head/Base/Test-Merge 일치를 JSON으로 교차 확인했다. QA Automated artifact12601886796·Trusted artifact12600947038은 위 차단 사유와 일치한다. zip을 실행하거나 PR 코드를 검증기로 checkout하지 않았다. Full Jobs30/Artifacts23, Trusted Job1/Artifact1의 후속 페이지는 비었다. 성공한 구현 로그·E2E timing/trace 전체는 실패 분석에 필요하지 않아 다운로드하지 않았고 별도 새로운 PASS 증거로 가정하지 않는다. issue_comment Finalizer 비대상2runs는 별도 제외 목록으로 보존했다. 원본 로그2개와 JSON ZIP4개는 `/tmp/issue-808-rework-r01`에 보존하며 signed download URL/secret은 tracked 증거에 넣지 않는다.

### 누적 Cross-run/리뷰 원인 매트릭스

| ID / 원본 | 계약·재현 및 커버리지 공백 | 보완·현재 후보 검증 |
| --- | --- | --- |
| F808-013 / Full3297.1 QA job121188791718·Trusted944.1 | 원본 구현 Required는 PASS이나 미해결 review2개로 QA gate BLOCKED, Trusted는 원본runFAIL로 파생FAIL. 과거 로컬19PASS·리뷰0은 PR등록시점 사실이며 이후 자동 리뷰를 최종 성공으로 가장할 수 없음 | 두 실제 코드 지적을 보완·현재source 회귀검증 후 스레드를 해결하고 새 Head Full을 시작해야 함. workflow/validator·승인 기준 수정 금지 |
| F808-014 / [review4371006803](https://github.com/planner77/masterGantt/pull/811#discussion_r4371006803) | 공동배정 T3의 R1 source∩R2 query는 assignmentIds=[]이나 TaskT3/완료분모1 잔존. 기존 emptyR2 사례는 공동담당자 배정 자체가 없어 이 교집합 경계를 실행하지 못함 | 원본코드에 회귀추가 RED 확인, 교집합 후 개인 A의 Task 재유도 보완 중. 개인 null 미배정·T0 진단은 별도 보존 |
| F808-015 / [review4371006805](https://github.com/planner77/masterGantt/pull/811#discussion_r4371006805) | Resource/Group/Role pivot후보가 catalog-only여서 total6Task 중 GROUP_ONLY/UNASSIGNED가 cell/정확 상세에서 누락. 기존 등록-only 검사·비가산 총계 검사는 null bucket의 Task cover를 검증하지 못함 | 세 개인축 null bucket의 실제 Task membership 회귀3개 RED, 기존 원장의 미배정 membership 기준 후보를 재사용해 보완 중. 개인 공수/Capacity 생성 금지 |

원격 실제 실패 테스트 파일 합집합은0(모든 Vitest/E2E 성공). 원격 리뷰 수정 source 합집합은 `src/domain/resources/resource-analysis.ts`. 로컬 재현/교정 테스트 합집합은 `tests/domain/resource-analysis.test.ts`이며 이전 F808003/011의 TypeScript source·F808006~010 상세/분모/비용 계약도 계속 교차 검증한다. 취소0, skipped7은 비대상 job이며 필요한 검증의 PASS로 계산하지 않는다.

### RED feedback loop와 가설·보완 범위

원본 source4a1c9c8b에서 테스트4개만 추가하고 `npx vitest run --config tests/config/vitest.config.ts tests/domain/resource-analysis.test.ts -t 'co-assigned Task|provides the' --reporter=verbose` 실행:23:00:00KST exit1/389ms/4FAILED, 재실행23:00:25 exit1/365ms/동일4FAIL. 기존19개는 디버깅 필터로 미선정이며 최종 회귀 PASS로 합산하지 않는다. 정확 관측은 ghostTask actual[T3]/expected[]와 Resource/Group/Role nullcell undefined다.

가설 순위와 예측을 사람에게 보고한 뒤 검증했다. H1: Assignment 제한 후 Task 재유도가 없어 공동담당 scope 교집합에서만 ghost가 생긴다. H2: metadata-only 후보라 실제 미배정Task 변화가 null 후보에 반영되지 않는다. H3: 무조건 Task=A로 자르면 기존 의도적 null 미배정과 독립 T0도 잃으므로 개인 조건·raw 미배정 분기의 원래 의미를 유지해야 한다. 원본 RED를 직접 실행한 뒤 두 누락 원인을 좁혀 교정하며 원장 엔진·Calendar·HTTP/API·CI 정책을 재구현하지 않는다.

같은 원인 유형 전체를 한 후보에서 교정하고 개인 Resource/Group/Role/grade·source path/exactAssignments·OR/null/미배정·T0/CapacityR·과거 상세/예산/Plan/Excel oracle의 직접·인접·음성 범위를 선정한다. 초기23/23 GREEN은 확대 검사 전이며 최종 source 동결/검증·DOC_SYNC/별도 사전검토·스레드 해결·최신 main 충돌/원격 tree·새 CI 등록 결과는 아래 후속 절에 남긴다. 현재 원본 CI FAIL은 불변이며 새 Head Required/Trusted/Manager ACCEPT는 NOT TESTED다.

## 9. REWORK_R01 최종 동결·검증·남은 원격 gate

F808-014/015는 기존 원장의 personal Assignment 교집합 규칙과 실제 미배정 Task membership을 adapter에 그대로 적용해 교정했다. source/query의 개인 조건이 있으면 교집합 Assignment에서 Task를 재유도하고 raw 개인 미배정 Task가 기존 null 분기로 허용된 경우만 남긴다. T0의 diagnosticTaskIds와 Capacity R은 독립이다. pivot 순회는 현재 prefix selection을 전달해 Resource/Group/Role null 후보를 실제 업무 membership에서 보강한다. 기존 등록 catalog 빈 행·실물 exact detail·비가산 합계·Plan/Calendar/예산은 유지한다.

추가 실제 local FAIL F808-016:23:03:04 새 exactAssignment 회귀가 Project참고 knownMd21.5를 기대했으나 actual14였다. Role DEVELOPER 조건의 same-R은 R1이며 기존 정책대로 full Project R1공수14가 oracle다. 기대를14와 population[R1]로 교정한 TEST_CONTRACT 오류이며 제품 공수 엔진·상한·assertion 의미를 완화하지 않았다. 이후 같은 테스트 포함 직접33 PASS다.

최종 SHA256: contract(불변) `b30753dcbe05af762c3b616346fccb91fb84925c09af44d71274e3907199d697`, Domain `6925bc91a7fa49f5c14d4e4374428e14b3281ac737a8376ac1bc76cb84143c2d`, test `db6b027a2ce41ffb5d0dbfa073ffa4a07c673036a47469b6b0db9faf59791a9a`. [동결 로컬 증거](evidence/issue-808/rework-r01-local.json)에 실제 명령·7파일/123/123(직접33+인접90)·failed0/skipped0, TypeScript/대상ESLint/diffcheck PASS를 기록했다. 33은 최초19+원본RED4+교차10이며 반복·앞선23/31 GREEN을 더하지 않는다.

독립 `/root/analysis_qa`:23:06:05KST 동결source 전후해시일치·직접33/33 PASS(584ms), 별도 원본/음성8체크 PASS. 공동배정 ghostTask0·완료분모0/T0진단6·미배정2, 개인3축 및3쌍 중첩null의 정확Task·Assignment0/공수0, Resource[null,R1] OR의6Task/14MD를 확인했다. 기존F808006~010의19회귀도 모두 통과했고 새P1/P2없음. 이것은 LOCAL_PRE_QA이며 최종humanQA/Trusted/Owner·Manager ACCEPT로 전용하지 않는다.

추가 운영 실패 F808-017: infra의 게시 payload 준비에서 새110,939byte 원격 이력 JSON을 단일 exec 출력으로 읽어 토큰 상한에 따른 JSON truncation/parse 오류가 재발했다. 원격 tree/commit/ref 변경0·제품 source/test 변화0인 단계의 오류이며 F808-012와 같은 원인이다. 동일 원인2회이므로 Manager가 수집 계획을 재검토했다. 모든 파일은 크기 추정 없이6,000byte bounded chunk로 읽어 결합·검증하도록 변경했고, tracked 원격 증거는 전체6run/30job 신원·결론·step별결론개수·모든 비성공step·실패사유·artifact/출처hash를 유지한 정제 형식으로 바꿨다. 반복된 성공 step 설명만 제외하고 원본110,939byte JSON은 `/tmp/issue-808-rework-r01/remote-history.json`에 보존하며 원본SHA를 정제 JSON에 결속했다. 게시 전 local staged tree=remote tree 및 전체 bytes/hash 동등성을 재검증해야 하며 최초 운영 실패를 삭제하지 않는다.

최종 문서·증거의 별도 읽기 검토 DOC_SYNC/LOCAL_PRE_QA PASS, version0.134.0·Markdown343·diffcheck·기존 main 검증기의 DOC_SYNC/AC1~6 구조검사 PASS를 확인했다. 실제 리뷰2개 해결·최신main/충돌·원격tree/부모/bytes·새CI등록은 게시 인계에서 확인한다. 원격게시 후 PR/Head·원본Run/Attempt·리뷰/충돌 상태는 Issue808 STATUS/PR댓글에 기록하며, commit자기참조를 피하기 위해 게시SHA를 이source에 소급삽입하지 않는다. 원본Run40197745892.1 FAIL·Trusted40199971387.1 파생FAIL은 유지한다. 새Head Required3/Trusted/Manager ACCEPT는 NOT TESTED이며 CI시작 이후 결과 모니터링·병합/main/GHCR/Release·Issue종료는 수행하지 않는다.


## 10. MAIN-808-001 — 병합 메시지 다중 행으로 Main CI #3299.1 실패 (2026-10-26 KST)

### 원본 증거와 구분

- 원래 [PR #811](https://github.com/planner77/masterGantt/pull/811) exact Head `d3fb5b0ea476006269be61872007304bc65794ea`, Base `048ae92ff673f1d0c4c69171fe3cc9bffe25dc19`, Test-Merge `c965ba1bdb9e6c05bdb8612c657a7d773aec596c`. 실제 merge `028f80b3c59bb373a7a34f3c95279cf8e17be603`의 부모와 Tree `bce5186294384894cbbe4e2f90f8b91266adb40b`는 검증된 Test-Merge와 동일하며 브랜치 최신 정렬·충돌 0이었다.
- 원본 [Full PR CI #3298.1 / Run 40201535967](https://github.com/planner77/masterGantt/actions/runs/40201535967) attempt 1은 Quality/E2E8/Docker/QA Automated SUCCESS, [Trusted QA #945.1 / 40203867985](https://github.com/planner77/masterGantt/actions/runs/40203867985) attempt 1도 SUCCESS; 원본 #3297.1/Trusted #944.1 실패는 앞 절에 보존.
- **실제 최초 실패**: [Main CI #3299.1 / Run 40224125090](https://github.com/planner77/masterGantt/actions/runs/40224125090), event=push, head_branch=main, exact SHA `028f80b3c59bb373a7a34f3c95279cf8e17be603`, attempt1, completed/FAILURE. `변경 경로 판정` Job `121261784538`, `CI 실행 추적 메타데이터 검증` Step, `python3 scripts/verify-ci-run-trace.py`가 `Issue # 접두어는 정확한 단일 행 표준 Merge 제목만 허용합니다`로 exit1.
- **직접 원인**: GitHub merge API에서 유효한 `Issue #808 · PR #811 · 리소스 분석 집계·범위 계약 정비` 제목 아래에 `Merge PR #811 for Issue #808`/Manager ACCEPT/`Refs #808` 여러 줄 `commit_message`를 잘못 전달. `scripts/main_ci_run_name.py::parse_merge_title`의 전체 commit 한 줄 계약 위반. 이는 **병합 실행 절차 결함**이며 Resource 분석 제품/검증기 결함으로 추측하지 않는다. AGENTS.md의 기존 `commit_message=""` 규칙 위반을 사실로 기록한다.
- Quality/E2E/Docker Required 세 집계 FAIL은 선행 `changes` 실패의 파생 결과. 실제 Policy/TypeScript/ESLint/Vitest/Build/Chromium8/Docker 구현과 GHCR main candidate Job은 **SKIPPED / NOT RUN**, GHCR `ci-028f80b...` digest·SBOM·provenance, 정식 v0.134.0, Finalizer **NOT TESTED / BLOCKED**. 이 Run/Commit은 수정·재분류·retry로 성공화하지 않는다.

### 복구 대상과 테스트 수명 관리

- [#582 병합 제목 규칙](../scripts/main_ci_run_name.py), AGENTS.md, CI/CD·Issue Lifecycle, [#639](exec-plans/active/ISSUE_639.md) 및 [#792 동일 실패 절차](exec-plans/active/ISSUE_792.md)를 적용: 과거 merge SHA 불변 유지. `main_ci_recovery.py`는 **original push CI 부재**용이므로 완료된 실패 Run #3299에는 사용하지 않는다. 새 동일 Issue corrective PR을 **새 exact Head 및 Full PR CI/Trusted QA/Owner 승인**으로만 merge한다.
- 범위: 원본 Domain·contract·DB·UI·기존 테스트/fixture·CI validator·workflows·Required3/8Shard/timeout/retry/skip을 변경하지 않는다. 기존 정책 검사 `scripts/verify-issue-lifecycle.py`에 **실제 #3299 다중 행 부정 fixture**와 `merge_api_payload` 한 줄/빈 본문 긍정 fixture만 추가한다. 기존 #586/#603/#639 유사·고유 검증은 보존하고 대체하지 않는다.
- corrective Merge 전 `python3 scripts/main_ci_run_name.py --issue 808 --pr <newPR> --summary '리소스 분석 Main CI 복구' --as-merge-payload --expected-head-sha <newHEAD>`로 기존 도구가 생성한 **정확 페이로드**를 사용한다. 검증된 title과 `commit_message=""`, 40자리 Head lease를 그대로 전달하며 새 PR Head/Base/Test-Merge 출처가 다르면 중단한다.
- 앱 `0.134.0` 제품과 package/lock 불변. 실패한 같은 Issue Main이 이미 `0.133.4→0.134.0` 변경했으므로 Generic Finalizer의 *같은 Issue 실패 승계·first-parent* 계약 검증 후 버전 발행 의무를 잃지 않는다. [#808 Owner의 v0.134.0 전용 승인](https://github.com/planner77/masterGantt/issues/808#issuecomment-6401854691)은 원본 실패 Main에 대한 면책이 아니라 **다음 verified Main/Release**의 version-scoped 정책 증거다.
- 추적/승인: 원본 실패 누적 보존; 신 corrective PR CI·Trusted/충돌/리뷰·Owner ACCEPT·Main push full·GHCR/Finalizer는 원격 실제 관측 전 **NOT TESTED**. Issue **OPEN**, 이미지/정식 tag/운영 배포 없음. 사용자 요청대로 새 CI 시작 후 결과 모니터링은 하지 않는다.
