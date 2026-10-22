# Issue #737 — 누적 로컬 검증·실패 원장

기준 main `56c7cfb96dbb97095e51606e9639cf4dc3fced36` / application `0.130.0`. [Work Packet](exec-plans/active/ISSUE_737.md)·[원장 지침](PR_CI_FAILURE_TRIAGE.md)을 따른다. 최초 PR 게시 전 로컬 테스트 작성 오류를 기록하며 원격 CI 실패로 분류하지 않는다. 원본 도구 transcript는 보존하지만 실행별 source fingerprint는 당시 수집하지 않았고 소급 생성하지 않는다.

## 로컬 실행과 수정

| 사건 | 명령·실행 환경 / 최초 결과 | 분류·원인과 교정 | 재검증·한계 |
| --- | --- | --- | --- |
| L737-001 | Node22 / Vitest `tests/server/resources/issue-737-cross-feature-acceptance.test.ts`, Start07:10:12(Asia/Seoul), session1454,5/5 FAIL | TEST_CONTRACT:4case raw oracle SQL의 존재하지 않는 `a.kind`,1case stale 상세 예상412/실제409 `REPORT_STALE`. 실제 schema의 `resource_id IS NOT NULL`과 상세409 계약을 적용 | 다음 실행3FAIL/2PASS. 제품/schema/handler 변경 없음 |
| L737-002 | 동일 명령, Start07:10:32,session18958,3FAIL/2PASS | TEST_CONTRACT: 신규 WBS effort에는 기존 KPI effort의 수치6필드 외 `assignmentIds`/`unsetAssignmentIds`가 있음. 모든 공통 수치14/.7/configured는 일치. rawID는 별도 exact equality를 유지하고 공통 effort필드를 `toMatchObject`로 검증 | unsupported Excel 추가 후07:10:45 session98623,6/6PASS. KPI handler/full Gate 강화 후07:11:31 session60146,6/6PASS |
| L737-003 | Manager 로컬 `qa_final_automated.docs_gate` 검사,exit1 | DOCUMENTATION: CI_CD/REMOTE_VALIDATION 문서가 policy 영향 집합을 요구하므로 `docs/QA_REVIEW_POLICY.md` 등 exact N/A 항목 필요. 정책 코드를 바꾸지 않고 Work Packet에 실제 무영향 근거 추가 | 최종 구조 재검사와 의미 사전 검토는 Work Packet 최종 결과를 따름 |
| L737-004 | QA 보강 뒤 실제 Chromium 종합1case,120s timeout·line76 KPI `waitForResponse` | FIXTURE_OBSERVABILITY: KPI는 mount 시 이미 요청하고 탭 재진입은 캐시를 사용한다. 뒤늦게 observer를 설치한 신규 수용 테스트가 새 요청을 기다림. KPI 화면의 실제 `새로고침` 명령 앞에 정확 Project 응답 observer를 설치하고 fresh 응답을 검증하도록 변경, 제품·timeout·retry 변경 없음 | Trace/error-context/screenshot을 ignored `.prepr-reports/issue737-ui-kpi-observation/`에 보존. 최종 source 재검증은 Work Packet에 기록 |
| L737-005 | `npm run verify:prepr -- --mode=fast --base=56c7cfb96dbb97095e51606e9639cf4dc3fced36 --risk=HIGH --issue=737 --report-dir=.prepr-reports/issue737-fast-attempt`,exit1 | BLOCKED: 기존 영향 selector에 `tests/config/e2e-shard-plan.json`의 producer→consumer 자동 map이 없어 UNKNOWN1/선택4/실제검사0. sourceStable=true는 이 미실행 시점의 관측일 뿐 테스트 PASS 아님 | 기존 도구/정책을 수정하지 않는다. Manager가 Work Packet에서 planner Unit의 직접·음성·누락/중복0·기존138배치 보존을 수동 매핑하고 실제 실행. 자동 Pre-PR PASS와 개별 검증 PASS는 구분 |
| L737-006 | 보강 Chromium 종합1case,18.5s FAIL·line106 DOM metric | TEST_CONTRACT: dt의 `term` role에 accessible name 조건을 사용한 신규 locator가0개를 반환. fresh KPI 응답·raw ID/기간·공수 비교는 통과한 뒤 UI 수치 조회에서 실패 | `term`의 실제 텍스트를 정확 비교하여 찾아 원래 숫자 단언을 유지. 원본 Trace/error-context는 `/tmp/issue-737-browser-attempt3/`에 보존(일시환경·원격 artifact 아님). timeout/retry/제품 변경 없음 |
| L737-007 | 보강 Chromium 종합1case,14.7s FAIL·line96 Task ID 집합 | TEST_CONTRACT: System consumer 기본 `systemView=direct`는 시스템 미연결 Task를 제외한다. 이를 KPI 전체 Task2와 같은 scope로 비교한 신규 oracle 오류 | 실제 raw Task-System 연결과 같은 KPI 시스템 breakdown의 exact Task/분모/공수를 대조하고 다른 root 전체의 미배정 Task 보존 단언 유지. `/tmp/issue-737-browser-attempt4/`에 원본 보존, 제품 기본필터·계산 변경 없음 |

위 시간은 Vitest `Start at` 출력이다. L001 첫 UTC 경고는 `2026-10-22T22:10:13.506Z`이며 현재 세션 날짜2026-10-23과 구분한다. 실행 로그는 도구 transcript에만 있고 별도 영구 로그 파일/실행별 hash는 없다. 공통 Vitest 명령은 `npx vitest run --config tests/config/vitest.config.ts tests/server/resources/issue-737-cross-feature-acceptance.test.ts`다. 앞선5case와 최종6case를 합산해 고유 수로 보고하지 않는다.

## 사전 검토 보완과 생성물

- qa_docs P2: Chromium report의 대표ID 포함만으로 다른 Task 유입/미배정 누락을 검증하기 부족하다. canonical 일반 Task/개인 Assignment exact 집합과 UI·API 수치, 같은 scope의 실제 UI Excel download·OOXML 비교를 보강한다.
- qa_docs P2: Project snapshot만으로 Global Resource 복제0은 증명하지 못한다. 전후 `/api/resources` 원시 ID 집합 비교를 추가한다. 독립 인간 QA 승인으로 취급하지 않는다.
- qa_docs P2: 사용자 가이드의 과거 occurrence 전용 WorkArea/Template v3/관리자 경로 설명이 신규 #762 직접 owner·Template v5와 충돌했다. 기존 공유/Target 호환 경로로 한정하고 신규 직접 등록·권한·지원 v5 절차로 연결했다. 제품 변경은 없다.
- 최초 브라우저 source6/6은 로컬 PASS이나 위 강화 전 source다. 강화 후 종합과 최종 source 전체6case 결과를 Work Packet에 구분한다.
- Next dev가 `AGENTS.md` heading·`next-env.d.ts`·`tsconfig.json`의 isolated dist 경로를 자동 수정했다. 테스트 종료 후 초기 committed bytes로 생성물만 복원하며 제품 변경으로 게시하지 않는다. 중간 실행을 sourceStable PASS로 주장하지 않는다. 최종 별도 fingerprint/검증으로 구분한다.

## 원격·잔여 경계

현재 #737 PR CI는 게시 전이므로 원격 Run/Attempt/Job/head/base/test-merge는 NOT TESTED다. CI 시작 시 Issue STATUS에 exact 출처를 기록하고 결과 모니터링·rerun·병합은 이번 범위 밖이다. 원격 실패 발생 시 원본 전체 Run/Attempt/취소 shard를 조회하고 본 파일에 누적하며, 로컬 작성 오류/선행 #736 퇴역 원장과 섞지 않는다.

## 최종 로컬 수렴

동결 후 Vitest15파일168case·Chromium6/6 및 scoped lint/typecheck/version/discovery/Markdown/diff PASS. 14개 test/fixture manifest read-back drift0이며 실제 명령·hash·실행 경계는 [검증 JSON](evidence/issue737/local-validation.json)에 있다. 앞선 FAIL과 자동 Pre-PR BLOCKED는 그대로 보존한다. 최종 PASS는 원격 Required3/Trusted QA·Owner 승인이나 운영 복원 PASS가 아니다.
