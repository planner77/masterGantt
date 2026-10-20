# Issue #736 누적 실패·검토 보완 원장

[Work Packet](exec-plans/active/ISSUE_736.md)의 새 리소스 consumer/Plan/Excel·공통 원장 변경에 적용한다. 원격 CI 실패와 로컬 환경/테스트·제품 결함을 분리하며 최초 실패를 후속 PASS로 덮지 않는다. 현재 #736 기존 원격 PR/CI는 없었으며 새 exact Head Full CI 시작 뒤 완료 모니터링은 요청 범위 밖이다. 다른 #730/#733 원장의 실패를 #736 원격 실패로 재분류하지 않는다.

| ID | 관측/직접 원인 | 보완 및 재검증 경계 |
| --- | --- | --- |
| L736-001 | 초기 UI 모델·공통 view model/transport3파일12테스트 중10PASS/2FAIL. parser 결과의 .ok/.success 오타와 fixture Resource key A/R1 입력 오류를 교정 후 동일12PASS. 최종 전용 lockfile 설치 source의 통합 Unit은 별도 재실행 | 원시 수치/strict parser·null 단언을 유지하고 테스트 입력/타이핑만 교정. 이후 M/M null fallback1개를 추가했으며 최종통합의 새model4개에 포함. 테스트 오류를 제품 결함으로 분류하지 않음 |
| E736-001 | 최초 Chromium 시작의 공용3100포트 충돌, 이어 격리 실행에서 symlink 공용 node_modules의 Turbopack root panic. 공용 설치 Next16.3.4와 lockfile 요구16.3.8 불일치 | 전용 node_modules에서 frozen `npm ci --prefer-offline --no-audit` 실행. 브라우저 제품 단언에 도달하지 못한 환경 실패이며 Product PASS/FAIL 근거가 아님. 원본 설정과 격리 서버로 재실행 |
| L736-002 | 전용 의존성의 통합12파일137테스트는136PASS/1FAIL. 새 foreign scope 음성은400을 기대했으나 실제 source snapshot stale-first가412 REVISION_MISMATCH로 반환 | 제품 코드 불변, 정확412·JSON·REVISION_MISMATCH·workbook 미생성으로 oracle 교정. 해당9case 파일을 재실행하고 나머지128PASS와 분리 기록 |
| E736-002 | 전용 의존성 첫 Chromium에서 최초 Resource route 컴파일 중 data-ready=pending이 기본5초 준비 assertion을 초과 | 새 테스트 준비 대기만 유한30초로 한정하고4case 전체 재실행. 명시 제품 수치·저장/오류·포커스/geometry 단언 및 전역 CI timeout/retry/skip 불변 |
| E736-003 | 전용4case Chromium 실행이 결과 없이 SIGTERM143으로 중단. 후속 user 재개 시 이전 /tmp와 프로세스가 소실된 환경 재시작 확인 | 결과가 없는 중단을 제품 FAIL/PASS로 표시하지 않음. 전용 deps와 원본 격리 fixture로 새4case 실행, 결과는 저장소 ignored output에 보관 |
| L736-003 | 재개 Chromium 첫 scenario의180초 waitForResponse는 실제 개인 selectOption exact label locator 미해결이며, 앞선 두 preset/report는 HTTP200. 두번째 geometry 준비에서는 펼침 후 버튼 이름이 접기로 바뀌어 같은 펼침 locator focus가 미해결 | 새 select는 실제 accessible role combobox/name으로 찾고 펼침/접기 버튼은 양 상태의 동일 제어를 찾음. 제품 수치/HTTP/저장/geometry 단언·기존180초 한도 불변, 최초1FAIL/1INTERRUPTED/2NOT TESTED 및 원본 실행로그를 보존. Trace는 분석 후 재실행에서 삭제됨. 수정4case도 외부 SIGTERM143으로 종료되어 최종 browser BLOCKED, 타입 검사도143으로 중단 |
| R736-001 | ui_ux P1: 신규 Plan 단위에서 M/M 환산 미설정일 때 M/D 숫자에 M/M label을 붙일 수 있는 경로 | 실제 단위를 M/D로 fallback하고 M/M 선택을 비활성화·인접 안내. 정적 해소 확인, 최종 실제 browser/Unit 결과는 Work Packet에 기록 |
| R736-002 | qa_docs P2 실제 fixture: Project 전체 WBS Excel이 원 context의 위조 snapshot·foreign path를 수락. Public 전체 조회 권한 문제가 아닌 출처 결속 결함 | WBS project expectedReport.filters 필수화, 원 report와 exact scope/path/snapshot/source를 먼저 검증. 독립 재현에서 위조 snapshot409 REPORT_STALE·foreign path400 INVALID_SELECTION. 기존 legacy project 입력은 하위 호환 유지 |
| R736-003 | 사전 검토: Resource Excel 신규 UI 초안의 layout 문자열·빈 granularities가 기존 strict parser와 불일치 | typed ProjectExcelExportRequest의 기존 layout 구조와 주/월 목록 사용, UI 모델 strict parser 왕복 테스트. 검증 우회/기본PASS 변경 없음 |
| R736-004 | backend 조사: WBS 개인 필터 적용 후 Task union이 T0를 그대로 쓰면 다른 담당 Task가 남을 수 있음(Assignment 공수는 정확) | 명시 개인 조건 시 같은 필터를 통과한 Assignment의 Task ID 교집합으로 작업 KPI 제한. 필터가 없을 때 미배정 Task/T0 보존, 역할-only/등록-only로 공수 생성 금지 |

## 영향·다시 확인할 범위

Resource consumer→공통 view transport/renderer·동일 Assignment 원장→기존 Plan/report/detail·exact editor/복귀→Project Excel strict parser/read snapshot/기존 writer를 확인한다. 기본 공통 view, #621/#622/#623, Resource Excel·KPI·미배정 진단·full Gate·Calendar/R/null은 인접 소비자다. 신규 테스트의 해시 배정은 기존6Shard selector에 맡기고 Required3·timeout·retry·skip·기존 E2E 단언을 완화하지 않는다.

실제 실행 명령·종료 상태·최종 source와 아직 미검증 항목은 Work Packet에 기록한다. 별도 Agent 사전 검토는 최종 독립 인간 QA/Owner ACCEPT·새 Head 원격 전체 PASS가 아니다.

## F736-001 — PR #760 Full PR CI #3059.1 TypeScript 실패 (2026-10-20 UTC)

기존 L736/E736/R736의 관측·수정 기록은 보존한다. 이 문서 첫 문단의 '기존 원격 PR/CI 없음'은 최초 기록 시점의 과거 상태이며, 이후 첫 Full PR 실패는 아래와 같다. 타 이슈의 실패·Timeout은 본 이슈의 실패로 합산하지 않는다.

| 분류 | 실제 증거 |
| --- | --- |
| Issue/PR | [#736](https://github.com/planner77/masterGantt/issues/736) / [#760](https://github.com/planner77/masterGantt/pull/760); branch feat/issue-736-resource-dashboard |
| Run/Attempt | [Full PR CI #3059.1, Run 39439974649.1](https://github.com/planner77/masterGantt/actions/runs/39439974649); event pull_request; 시작 2026-10-20T14:31:17Z, 완료 14:42:35Z, conclusion failure |
| 원본 SHA | Head 94e602c3ee3c524dc41b348dd8ebe20330d59d1e; main base 08a1d9ff25a97aba67f08d6b67029ac55d45121a; 기존 STATUS의 test merge a0289adf7c30db53aab4b07d5e0a1f82edaf35bf (별도 부모 검증 NOT TESTED) |
| 최초 실제 오류 | [TypeScript job 118687236139](https://github.com/planner77/masterGantt/actions/runs/39439974649/job/118687236139), npm run typecheck / tsc --noEmit, 2026-10-20T14:32:52Z; src/server/exports/resource-excel-export-core.ts(60,22), TS18048: 'assignment' is possibly 'undefined', exit 2 |
| 선행 성공 | 경로 판정 118686919110, QA Preflight 118687076849, 정책 118687236119, Vitest 118687236102, QA 경계 118686918254 SUCCESS |
| 취소/미실행 | ESLint 118687236466 CANCELLED; PR Build, Chromium E2E 6 shards, PR Docker Smoke SKIPPED(빠른 검사 게이트가 차단함, 개별 제품 FAIL/Timeout이 아님) |
| 파생 실패 | PR Fast Gate 118692633668 FAILURE; Required Quality 118692740545, E2E 118692740869, Docker 118692741384 모두 FAILURE; QA Final 118692801510 FAILURE — 선행 TypeScript 오류의 파생 Gate 실패 |
| 리뷰/충돌 | REWORK 착수 기준 GitHub 미해결 review thread 0; PR mergeable=true, main 대비 ahead1/behind0 |

**유형·원인: PRODUCT/TYPE_SAFETY.** 신규 WBS Resource Excel에서 Map.get()은 Assignment가 없으면 undefined를 반환한다. 기존 코드는 없거나 Task ID·Resource ID 불일치 또는 중복인 경우 unsupported()를 호출하지만, 그 다음 행 projectIds.add(assignment.id)에서 컴파일러가 존재성을 증명하지 못하여 TypeScript TS18048로 차단된다. E2E 본문 실행 전 발생했으므로 Timeout·Playwright Shard 과부하와 인과관계가 없다. 기존 R736-002 source/snapshot 및 R736-004 개인 Assignment 범위 검증과 관련된 위치이지만 과거 Runtime 결함 재발로 볼 증거는 없다.

**조치:** src/server/exports/resource-excel-export-core.ts의 원래 불일치 판정 전체를 유지하면서 조건 분기를 명시적 return unsupported("WBS Project Assignment identity mismatch.")으로 종료한다. 정상 할당은 그대로 projectIds에 추가되며 결손·불일치·중복 원본은 기존 EXPORT_UNSUPPORTED 예외를 유지한다. 강제 non-null 단언, 원본 검증 우회, Task/Assignment ID·공수·Capacity·기간·null·Plan/Excel source/snapshot 로직 수정은 없다.

**Cross-run / 검증 인계:** 확인 가능한 #736 원격 Full PR CI의 첫 실패는 39439974649.1 단일 건이다. 원격 실제 실패 파일 합집합: src/server/exports/resource-excel-export-core.ts (typecheck); 로컬 기존 L736-001/002/003, E736-001/002/003, 사전 리뷰 R736-001/002/003/004는 기존 표에 보존한다. 격리 TypeScript5.8.3 strict 예제의 동일 guard는 PASS(전체 repository typecheck PASS 증거가 아님). 연결된 원격 저장소를 이 실행 환경에서 checkout/npm 실행할 수 없어 새 Head typecheck, Resource Excel/adapter·원장 관련 Vitest, ESLint, Build, Chromium6, Docker는 NOT TESTED. 새 Full PR CI가 이 범위와 과거 회귀·음성 사례를 검증해야 한다. Timeout/Retry/Skip/6Shard/Required3 정책 및 단언은 변경하지 않는다.

**승인 경계:** HIGH/OWNER_MANAGED, manager_decision=NOT TESTED, MERGE_READY=BLOCKED, release_authorized=false. 새 CI 시작만 확인하고 완료 모니터링·병합·Main CI·GHCR·Issue 종료는 수행하지 않는다. 새 Head/Run은 이슈 STATUS 댓글에 별도 연결한다.

## F736-002 — PR #760 Full PR CI #3062.1 Chromium E2E assertion 실패 (2026-10-20 UTC)

이 절은 F736-001과 최초 L736/E736/R736 이력을 삭제·대체하지 않고 누적한다. #3059.1의 TS18048은 이 실행에서 TypeScript SUCCESS로 교정 확인되었고, 이번에는 별도 E2E assertion의 첫 원격 실패다.

| 분류 | Run/Job/원본 증거 |
| --- | --- |
| 실행/귀속 | [Full PR CI #3062.1, Run 39485528120, attempt 1](https://github.com/planner77/masterGantt/actions/runs/39485528120), event pull_request, PR #760, Head f340a84526a3b38ed602ebcc8eaf5010807269c2, base main 08a1d9ff25a97aba67f08d6b67029ac55d45121a; 최초 실패 후 재실행 |
| 선행 검사 | QA Preflight 118844920898, TypeScript 118845026837, ESLint 118845026873, Vitest 118845026936, Policy 118845026965, PR Fast Gate 118845625089, Next Build 118845905767, Docker smoke 118845905709: SUCCESS |
| 최초 실제 실패 | [Chromium E2E shard 5/6 job 118845905766](https://github.com/planner77/masterGantt/actions/runs/39485528120/job/118845905766), 2026-10-20T19:52:12Z, tests/e2e/issue-736-resource-dashboard.spec.ts:85 scenario `새 Resource Plan 선택80·Project140·선택밖 원인 저장 후 정확 일별 상세 복귀`, assertion line 99 |
| 기대/실제 | `expect(option[value=mm]).toBeDisabled()` expected disabled / received enabled after 5000ms matcher wait. Playwright call log DOM은 13회 `<option disabled value="mm">M/M</option>`로 관측. Test는 36.1s에 실패했고 E2E 중간 이전 같은 shard에서 10건 PASS(8.2m), 83건 NOT RUN. 원본 오류는 테스트 예산 180s/Playwright 전체 shard Timeout이 아님 |
| 취소/파생 | shard 1/2/3/4/6는 fail-fast CANCELLED(그 안의 완료된 개별 PASS는 전체 shard PASS가 아님). Required Quality job118846549636 SUCCESS, Docker job118847118908 SUCCESS, Required E2E job118850965427 FAILURE 및 QA Final118851004741 FAILURE는 shard5의 파생 결과 |
| 증거 | [shard5 trace/report artifact 12294535776](https://github.com/planner77/masterGantt/actions/runs/39485528120/artifacts/12294535776); 원본 job log 확인. Trace 내부 재생·영상 수동 검증은 NOT TESTED. `GitCommitInfo: timeout of 3000ms` 경고는 테스트가 계속 실행됐으므로 직접 실패와 무관 |
| 원본 메인/리뷰 | REWORK 착수 당시 PR mergeable=true, main ahead2/behind0, review threads 미해결0. 병합/QA/GHCR 승인 없음 |

**원인 판단 — TEST_CONTRACT / ASSERTION_OBSERVABILITY.** 새 Resource Plan은 `data.mdPerMm === null`일 때 React `<option value="mm" disabled>`를 렌더하며, `resourceWbsPlanUnit("mm",null)`은 `md`로 fallback 한다(기존 Resource WBS model Unit PASS). 실제 Playwright 로그도 `disabled` 속성이 렌더된 옵션을 확인했으나 `toBeDisabled()` matcher는 `enabled`로 분류한다. 따라서 해당 matcher와 option 원시 DOM 사이 판정 불일치이며 *M/M UI 옵션을 활성화한 제품 결함으로 입증되지 않았다*. Playwright 내부 판단의 정확한 기술적 기전은 UNKNOWN; DOM 이외 실제 클릭 동작/스크린리더 수동 검증도 NOT TESTED다. 5초는 assertion wait 예산이며 테스트 전체 Timeout이 아니므로 6-shard 재분배·timeout/retry/skip 상향 금지.

**보완:** `tests/e2e/issue-736-resource-dashboard.spec.ts`에서 동일한 제한 정책을 더 직접적으로 검증한다. 응답 `report.mdPerMm`이 null임을 확인하고 M/M option의 `disabled` attribute 존재와 JavaScript property `disabled === true`를 각각 검사하며 select가 M/D (`md`) 상태인 것도 확인한다. `toBeDisabled()`라는 모호한 matcher 1개를 위의 네 조건으로 대체한다. 기존 80%·140%·외부 원인 40% 수정 후 120%, 정확한 Assignment/상태 복귀, 다른 단언과 테스트 180s 예산은 유지한다. 제품 코드는 미수정이며 숨은 환산/공수 조작 없음. Playwright 공식 locatorAssertions의 `toHaveAttribute`/`toHaveJSProperty`는 각각 DOM 속성·JS property를 검증한다.

**과거 전체 실패 교차 진단:** L736-001/002 테스트 parser·stale oracle, L736-003 locator, E736-001/002/003 환경·준비, R736-001 M/M null fallback·R736-002 exact Excel source/R736-004 개인 Assignment 격리를 모두 보존한다. F736-001(src/server/exports/resource-excel-export-core.ts:60 TypeScript)과 F736-002(tests/e2e/issue-736-resource-dashboard.spec.ts:99 option matcher)는 서로 다른 오류 유형이다. 누적 실제 원격 실패 파일 합집합: (1) src/server/exports/resource-excel-export-core.ts (2) tests/e2e/issue-736-resource-dashboard.spec.ts. 기타 취소 shard를 완료 PASS나 실패로 가정하지 않는다.

**영향·검증:** 변경은 새 E2E 단언만. 이미 원격 성공한 Head f340a845의 Quality/Docker를 다음 Head 성공으로 전용하지 않는다. 제품 MD/MM fallback은 tests/features/resources/resource-wbs-dashboard-model.test.ts에 Unit이 존재하고 과거 Run Vitest가 SUCCESS. 새 Head의 해당 E2E 4 case·다른 #621/#622/#623 기존 Resource Plan·원본 편집·Excel·full CI6 shards·Quality/Docker는 새 GitHub Full CI에서 검증한다. 연결 환경에 실제 repository checkout/Playwright/browser test runtime이 없어 새 Head local E2E 및 전체 Unit은 NOT TESTED. 기존 180s timeout과 PR required gates/6Shard 그대로다.

**진행 경계:** 수정 source/원장/Work Packet 동일 커밋으로 GitHub PR synchronize, review threads0·main 정렬 확인 후 Full PR CI 자동 시작만 확인한다. 신규 run 결과 모니터링·병합/Main/GHCR/Release·Issue 종료는 수행하지 않는다. HIGH/OWNER_MANAGED, manager_decision=NOT TESTED, MERGE_READY=BLOCKED, release_authorized=false.
