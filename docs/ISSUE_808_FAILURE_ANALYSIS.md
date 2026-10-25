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
