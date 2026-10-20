# Issue #736 누적 실패·검토 보완 원장

> 최신 재개는 F736-003(#3065.1 응답 관측 경합)이다. 아래 초기 L/E/R 및 F736-001/002는 각 시점의 실패·교정·미검증을 보존한 역사적 기록이며 최신 PASS로 덮지 않는다.

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


## F736-003 — Full PR CI #3065.1 이전 필터 응답의 body 관측 경합 (2026-10-21 KST)

이 절은 최초 L/E/R 및 F736-001/002를 그대로 보존한다. 전체 branch의 pull_request Run 목록은 3건이며 모든 attempt1의 Jobs도 확인했다. 정제한 [누적 원본 증거](evidence/issue-736/ci-through-3065-attempt-1.json)와 [실패 직전 query timeline](evidence/issue-736/ci-3065-resource-query-timeline.json)은 raw header/cookie/로그·ZIP 없이 출처와 필요한 상태만 담는다.

| Run/attempt | Head / base / test merge | 직접 실패·파생 상태 |
| --- | --- | --- |
| [#3059.1 /39439974649](https://github.com/planner77/masterGantt/actions/runs/39439974649) | 94e602c3ee3c524dc41b348dd8ebe20330d59d1e /08a1d9ff25a97aba67f08d6b67029ac55d45121a /a0289adf7c30db53aab4b07d5e0a1f82edaf35bf | F736-001 TypeScript TS18048; Fast Gate/Required3/QA 파생 FAIL, E2E·Docker 미실행 |
| [#3062.1 /39485528120](https://github.com/planner77/masterGantt/actions/runs/39485528120) | f340a84526a3b38ed602ebcc8eaf5010807269c2 /08a1d9ff25a97aba67f08d6b67029ac55d45121a /4ca650d052b2a31ef4fb7b47f83f9a0e01500def | F736-002 M/M option matcher; Quality/Docker PASS·E2E/QA FAIL, 다른5 shard CANCELLED |
| [#3065.1 /39488288938](https://github.com/planner77/masterGantt/actions/runs/39488288938) | 3c335ba1cd4ac3f747f2f841fde16a81353aa490 /08a1d9ff25a97aba67f08d6b67029ac55d45121a /4253da1cb93aa72a69502f15111298357495ab41 | 아래 응답 관측 실패; Quality118856046491/Docker118856618749 PASS, E2E118860027492/QA118860070910 FAIL, 다른5 shard CANCELLED |

세 source artifact를 실행 없이 JSON으로 읽고 Git test-merge 두 부모를 대조했다. 과거 Run의 pull_requests[].head는 최신 Head로 변동되어 표시될 수 있으므로 원본 귀속은 run.head_sha·불변 ci-pr-source artifact를 사용했다. F736-001의 당시 미검증 test merge는 이번 교차 확인으로 보강한다. 과거 실패를 소급 PASS하지 않는다.

### 최초 오류와 가설 검증

- 직접 Job: [Chromium shard5/6 118855505647](https://github.com/planner77/masterGantt/actions/runs/39488288938/job/118855505647), E2E 실행20:03:46Z~20:10:34Z; Job20:02:52Z~20:10:40Z. 원본 Run은20:00:33Z~20:12:14Z.
- 테스트: `tests/e2e/issue-736-resource-dashboard.spec.ts:85`의 선택80/Project140/선택밖 원인 저장, :97 `response.json()`; 2026-10-20T20:10:34.527Z `Protocol error (Network.getResponseBody): No data found for resource with given identifier`와 body unavailable 문구. testcase26.9초, shard 결과10PASS/1FAIL/83NOT RUN. 앞선 두 #736 시나리오는33.939초/25.709초 PASS.
- [원본 report/Trace artifact12294613648](https://github.com/planner77/masterGantt/actions/runs/39488288938/artifacts/12294613648), ZIP5947651bytes·SHA256 7445f13a1a5e82682d1f0a4d66e54d07ce4b24759839e49278b085fd078c06ca. 내부 network/trace를 정적으로 읽었고 실행·PR code checkout을 통한 provenance 검증은 하지 않았다.
- H1(이전 조건 응답 선택): 기존 helper는 method/Project/spec/filter/scope 전체 대신 root/projection만 비교한다. Trace의 taskSearch→from→to 요청3개가 ERR_ABORTED, 개인 resourceIds까지의 요청20:10:33.084는 HTTP200 뒤 ERR_ABORTED, 실제 granularity=week 요청20:10:33.161는 HTTP200/취소없음이다. 따라서 이전 응답을 현재 Plan 영수증으로 받을 수 있는 관측 결함이 원본 오류와 일치한다.
- H2(body 읽기 전 abort): 응답 헤더 관측 뒤 별도 await로 body를 읽는 사이 queryKey 변경 cleanup의 AbortController가 이전 fetch를 취소한다. Trace의 status200+ERR_ABORTED가 이를 지지한다. CDP 내부에서 body가 제거되는 정확한 기전 전체는 UNKNOWN이다.
- H3(실제 navigation): goto/reload는 앞선 setup에만 있고 필터 batch에는 없다. 일반적인 navigation 안내 문구만으로 제품 navigation 결함을 주장하지 않는다.
- 분류: TEST_CONTRACT / ASYNC_RESPONSE_CORRELATION. 제품 수치·원장·Plan·Calendar·권한 결함이나 이전 M/M matcher 재발로 입증된 오류가 아니다.

### 취소·타임아웃·재분배 판단

- #3062 cancelled shard1/2/3/4/6의 실제 관측 PASS는23/111/46/32/53, #3065는13/73/50/32/47. 두 실행 모두 shard2의 기존 skip1개를 따로 보존했다. 취소10개 Job 내부에서 실제 FAIL은 발견되지 않았다. 취소 잔여는 진행 중/미실행을 분리할 자료가 부족해 UNKNOWN이며 전수 PASS로 계산하지 않는다.
- #3065 실패 shard Job7분48초·test26.9초로35분 E2E Job Timeout이 아니다. GitCommitInfo3초 경고 후 테스트가 계속 실행됐으며 직접 실패가 아니다. 이번 교정 목적으로 shard 배치·180초 case/35분 Job 한도·retry·skip·Required gate를 변경하지 않는다. 완료 Run10개 기반의 비용 baseline도 새로 주장하지 않는다.
- 별도 과거 #3059 ESLint118687236466의 checkout git fetch는 약599초 정체 후 취소됐고10분 Job 한도와 일치하지만 명시 timed_out annotation은 확보하지 못했다. npm run lint는 실행되지 않았다. 후속 #3062/#3065 ESLint SUCCESS로 재발 미관측이며, E2E 긴 테스트/샤드 문제로 분류하지 않는다.

### 보완 및 동일 source 검증

- 기존 `reportResponse` helper의 모든 소비자에서 Project 경로·POST·projection·spec·filters·scope의 완전한 요청을 비교한 뒤 body를 즉시 소비해 DTO 영수증을 반환한다. 변경한 각 필터의 응답을 직렬 확인하고 그 뒤 week Plan을 요청한다. body 오류·HTTP 오류를 retry/무시하지 않는다.
- 새로운 결정적 실제 Chromium observer regression은 이전 filter/다른 spec/다른 scope 응답을 먼저 전송한다. 기존 넓은 predicate로 통제 복원하면281ms에 이전 taskSearch=previous를 잘못 선택해 RED, 보완 helper는446ms GREEN이었다. 이는 원격 CDP 예외 자체를 매번 재현했다는 뜻이 아니며 동일 원인 패턴을 잡는 별도 통제 회귀다.
- report 및 Excel 지연 응답의 release handler 완료와 최신 화면·download0을 음성 검증한다. 기존 고유 Assignment ID·80/140/40수정→120·같은 source/snapshot·readonly/5폭/키보드·M/M null 및 HTTP 오류 단언은 유지한다.
- 누적 실제 원격 실패 파일 합집합은 `src/server/exports/resource-excel-export-core.ts`와 `tests/e2e/issue-736-resource-dashboard.spec.ts`다. 해당 export guard/Unit, 새 #736 전체5case, 기존 #622 Plan/Excel 및 #730 원본/늦은 intent를 직접·인접·음성으로 선정한다. 전체 공식 회귀는 새 exact Head의6Shard/Required3이며 로컬 선택은 대체 증거가 아니다.
- 최종 명령·고유 실행 결과·source 지문과 미검증은 아래 후속 기록과 Work Packet에 반영한다. HIGH/OWNER_MANAGED·Owner ACCEPT/Release 권한은 변경하지 않는다.


### F736-003 로컬 수집 중 추가 발견

- 첫 선택8 Chromium 실행은7PASS/1FAIL(4.2분)이었다. 직접 #736 앞2case와 readonly/역전·observer 음성, 기존 #6221/#7302는 PASS했다.
- 새 FAIL은 원격 CDP 오류가 아닌 추가한 정확 ID oracle이다. Plan fixture가 setup PUT으로 개인 배정을 교체하면 초기 `f.assignment.id`는 더 이상 현재 원본이 아니다. 첫 보강이 이 과거 ID와 report를 비교해17.8초에 실패했다. 제품 Assignment 누출/수치 오류로 분류하지 않는다.
- setup PUT 이후 canonical snapshot에서 정확 Task/Resource의 현재 Assignment를 찾고 allocation80을 확인한 뒤 report의 정확 ID를 비교하도록 교정했다. 길이1만으로 되돌리거나 ID 단언을 제거하지 않았다. 같은 사람의 선택80/전체140 및 선택 밖60→40 저장 후120·원시 ID·focus 복귀 단언은 유지한다.
- Excel 늦은 응답 handler도 finally 완료를 확인하고 rendering turn 뒤 download0을 검사하도록 음성을 강화했다. 관측 helper/제품 로직은 추가 변경하지 않았다. 동결 후 #736 전체5case를 다시 검증하고 변경 없는 인접3case의 PASS는 중복 합산하지 않는다.


### F736-003 최종 로컬 검증과 최신 main 통합

**추가 로컬 실패도 보존한다.** L736-004는 위 setup PUT 이후의 오래된 Assignment ID oracle이고, L736-005는 새 observer의 `toMatchObject(condition.filters ?? {})`에서 발생한 TS2345다. ResourceDashboardFilterInput에는 Record 인덱스 시그니처가 없으므로 `{...condition.filters}`로 같은 필드를 가진 일반 객체를 전달하도록 교정했다. cast·필드 제거·제품 타입/검증 완화는 없다. 첫 PrePR fast는 Typecheck에서 FAIL했으며 이후 Typecheck PASS다.

E736-004는 두 번째 PrePR fast의 lint FAIL이다. 보고된 전체 오류 2,438개와 경고 25,010개 중 오류는 모두 과거 격리 테스트가 남긴 `.next-e2e-isolated-*` 세 디렉터리를 전체 ESLint가 검사하며 발생했다. 실제 소스 경로의 lint 오류는 0개였다. 생성 시각 2026-10-20 22:36~22:43의 디렉터리 `25c328cc-8dbb-45b8-b79b-47ebca0fd3f3`, `3ca71f89-e6ba-4d08-a170-871df004b604`, `e82f6d32-db23-4505-bfed-f4337ee4060f`를 삭제하지 않고 외부 증거 폴더에 보존 이동했다. 해당 worktree의 활성 서버가 없음을 확인했고 ESLint ignore·CI 정책은 바꾸지 않았다. 다음 전체 lint는 오류0/기존 경고14로 PASS했다.

**정렬 전 Chromium:** 공식 Playwright config를 spread한 임시 config에서 webServer만 끄고 isolated-application fixture가 만든 개별 Next/SQLite를 사용했다. Chromium/worker1/retries0/max-failures0, 동일 고정 Playwright1.63.0이다. output/reporter는 Git 밖에 보존했고 임시 config와 Next 생성 설정·화면 출력은 실행 뒤 정리/복구했다.

```bash
npx playwright test --config tests/config/playwright.issue736.local.ts tests/e2e/issue-736-resource-dashboard.spec.ts tests/e2e/issue-622-resource-plan-target.spec.ts tests/e2e/issue-730-view-composer.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0 --grep '#736|#622|#730 실제 HTTP Milestone·리소스|#730 지연 원본'
npx playwright test --config tests/config/playwright.issue736.local.ts tests/e2e/issue-736-resource-dashboard.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0
```

첫 명령은7PASS/1FAIL(4.2분, L736-004)이고, 교정 후 두 번째 명령은 #736 전체5PASS(2.4분)다. 첫 명령의 변경 없는 인접 #622 Plan/Excel1case와 #730 지연 원본·실제 HTTP 원본2case는 각각30.2/21.4/24.0초에 PASS했다. 따라서 고유8case PASS이며 반복 실행을13개 성공으로 합산하지 않는다. #736의 최종5case 시간은25.2/17.2/24.7/19.3초와 observer95ms다. strict filter/spec/scope 통제 RED281ms/GREEN446ms는 별도 진단 실행이며 위 고유 수에 추가하지 않는다.

브라우저5case 실행 source SHA256은 `c8d145b5eb7c8d6332de75a1ded978813212c4ae9709e97b60b5dbf97ee8fc2e`, L736-005의 spread 한 줄 교정 후 최종 테스트 SHA256은 `e42d86c206b9f5dce3a46552fa77acd63eb3cf83b1c457524d2d160d2455de86`이다. 별도 qa_docs는 이 한 줄이 같은 JSON 필드를 보존함을 확인했다. 정렬 전 실행 증거를 통합 후 전체 기능 PASS로 확대하지 않는다.

**게시 직전 main 전진:** 실제 main은 `5ffe02a334d2279fabb63943c90614a7acfaf6ad`로 전진했다([#732 PR #761](https://github.com/planner77/masterGantt/pull/761)). PR metadata의 과거 base08a 표시와 별개로 인증된 main Ref와 fetch/merge-tree가 실제 충돌을 확인했다. 충돌3개 `CHANGELOG.md`, `package.json`, `package-lock.json`을 해결해 기존 #736 후보0.128.0과 main의0.127.0 변경 기록을 모두 보존했다. 공용 Project host 자동 병합은 Milestone consumer·생성 안내와 Resource consumer·기존 분석/Plan/Excel 구획을 함께 보존하며 frontend와 qa_docs가 양쪽 부모 diff를 읽기 전용으로 확인했다. main에서 가져온 #732 파일은 main 원본과 같고 새로운 의존성·workflow/QA/보안 변경은 없다.

**통합 후 PrePR fast:** 다음 명령의10개 검사 단계는 모두 PASS다. Typecheck, 전체 lint(오류0/기존 경고14), 전체 Vitest255파일/3,136case PASS 및 기존1파일/3case SKIPPED, production build·runtime-tools PASS를 포함한다. skip을 PASS 수에 넣지 않는다. 정책/발견/문서 링크/의존성 단계도 실제 실행 PASS다.

```bash
npm run verify:prepr -- --mode=fast --base=3c335ba1cd4ac3f747f2f841fde16a81353aa490 --issue=736 --pr=760 --risk=HIGH --report-dir=.prepr-reports/issue736-f003-main-integrated
```

E736-005: CLI 전체 판정은 **BLOCKED**, `sourceStable=false`다. Next production build가 `next-env.d.ts`와 `tsconfig.json`에 임시 `.next-prepr` 타입 경로를 생성해 시작/종료 fingerprint가 달라졌다. 시작 `eff085327b0156bf9d7821872a40f92984c9c46894ae5c7e3f140d945fe00fde`, 종료 `59e0f831e2ecbda4349e3d771a635c2ad7b92fd0bef1cea94483984fa5939a58`이며 changed 목록의 차이는 두 생성 설정 파일이다. 생성본을 Git 밖에 보존하고 두 파일을 실행 전 HEAD 바이트로 복구했다. 전체 CLI BLOCKED를 PASS로 바꾸거나 보고서를 고치지 않는다. 개별 단계 PASS와 CLI source 변경 판정, 새 Head의 원격 Required3는 서로 구분한다.

증거 위치는 `/home/planner/Dev/masterGantt-736-evidence/f736-003/`의 `first-eight-*`, `final-five*`, `helper-red.log`, `helper-green.log`, `prepr-fast.log`, `prepr-fast-fixed.log`, `prepr-main-integrated.log`, `legacy-isolated-next/`다. 정제한 영속 요약은 [로컬 검증 영수증](evidence/issue-736/f736-003-local-validation.json)에 남긴다. 원시 trace·브라우저 header·쿠키·runtime DB는 Git에 넣지 않는다.


**통합 후 Chromium:** 최신 main 통합 source에서 아래3case가 모두 PASS(1.3분)했다. #732 소속 Task 저장/새 snapshot/복귀/stale-error13.8초, #732 조건 밖 생성/필터 보존/정확 원본 접근14.4초, 원격 실패했던 #736 Plan 선택80/Project140/선택 밖40→120/정확 ID·일별 복귀19.6초다. #736 최종 e42d86c2 지문을 실제 브라우저에서 다시 실행했다. 통합 전8case에 새 인접 #7322case를 더한 고유 검증 범위는10case이며 #736 재실행을 추가 성공 수로 중복 합산하지 않는다. 통합 전 나머지7case는 당시 source의 증거로만 유지한다.

```bash
npx playwright test --config /home/planner/Dev/masterGantt-736-evidence/f736-003/main-integration/playwright.config.ts tests/e2e/issue-736-resource-dashboard.spec.ts tests/e2e/issue-732-milestone-dashboard.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0 --grep '새 Resource Plan 선택80|Milestone 소속 Task 원본 저장|조건 밖 생성 성공'
```

새 원격 게시 후보는 기존 Head `3c335ba1cd4ac3f747f2f841fde16a81353aa490`와 main `5ffe02a334d2279fabb63943c90614a7acfaf6ad`를 부모로 보존한다. 게시 전/후 batch lease·tree 검증과 미해결 review threads/mergeability를 재조회하고 새 exact Head/CI Run·Attempt는 Issue/PR STATUS 댓글로 연결한다. 새 Required Quality/E2E/Docker·Trusted QA는 **NOT TESTED**, HIGH/OWNER_MANAGED·Owner 위험 수용/Manager ACCEPT는 **NOT TESTED**, MERGE_READY=BLOCKED다. 사용자 요청대로 새 CI 시작만 확인하며 완료 모니터링·병합·main/GHCR·Release·Issue 종료는 하지 않는다.

최종 생성 설정 복구 후 `npm run typecheck` PASS, `node scripts/check-markdown-links.mjs` 285문서 PASS, staged/unstaged `git diff --check` PASS 및 미해결 index0을 확인했다. CLI 원본 BLOCKED 판정은 그대로 보존한다.

## M736-001 — PR #760 Merge Main CI #3071.1 기존 #621 정확 Assignment 로딩 실패 (2026-10-21 KST)

### 불변 원본 및 직접 실패

- Primary Issue [#736](https://github.com/planner77/masterGantt/issues/736), 원본 [PR #760](https://github.com/planner77/masterGantt/pull/760) 완료. Main push merge SHA `1c1938851aa8234febcba404f4007d6c94fb2233`, first parent `5ffe02a334d2279fabb63943c90614a7acfaf6ad` (#732), second parent `e7560fa9a117c3e72113901242d450f1021c2d8b` (PR Head), tree `7f6f53967223613425d40445a81fbbadf3e53b3f`(PR test-merge와 일치), application 0.128.0.
- [Main CI #3071.1 / Run 39499988360 attempt 1](https://github.com/planner77/masterGantt/actions/runs/39499988360): `event=push`, branch main, .github/workflows/ci.yml, 2026-10-20T21:23:41Z 시작~21:55:43Z 완료, overall FAILURE. PR Full [#3069.1](https://github.com/planner77/masterGantt/actions/runs/39493898903)과 [Trusted QA #711.1](https://github.com/planner77/masterGantt/actions/runs/39498403878)는 원래 PR Head에서 SUCCESS였지만 Main 실패를 대체하지 않는다.
- 원본 [Chromium E2E Shard3/6 Job 118894849896](https://github.com/planner77/masterGantt/actions/runs/39499988360/job/118894849896) FAILURE: `tests/e2e/issue-621-resource-target.spec.ts:343`의 '#621 Target exact Assignment 개인 수정·공동담당 불변·412/401 초안 보존'에서 line370 `getByLabel("리소스 1 ALICE · 긴 공동 담당 리소스 이름 투입률 (%)").toHaveValue("100")`이 5,000ms 내 element(s) not found. 106 PASS / 1 FAIL / 1 기존 SKIP; **기존 업무 단언 실패가 아니라 준비되지 않은 Editor field 관측 실패**이며 테스트 시나리오 시간 약33.1초, Shard wall 약26.7분으로 각각 180s/35분 timeout 미도달.
- Shards 1/2/4/5/6, TypeScript/ESLint/Vitest/Policy/Build/Docker implementation 모두 SUCCESS. Required Quality Job 118895561486 SUCCESS, Docker aggregate 118896751152 SUCCESS, E2E aggregate 118909028558 FAILURE(Shard3 파생). Main 임시 GHCR publish SKIPPED, 정식 release/tag/OCI digest/Finalizer/Issue FINAL NOT TESTED. 자동 QA Main은 SKIPPED(별도 독립 실패가 아님).
- [원본 Chromium Trace/report artifact 12303171944](https://github.com/planner77/masterGantt/actions/runs/39499988360/artifacts/12303171944)와 job log를 확인. Trace의 실제 GET /assigned-targets HTTP200 응답 328ms(21:31:33.118Z), 뒤따르는 **GET /assignment-targets HTTP200 4,014ms**(21:31:33.480Z), 실패 당시 UI '할당 정보를 불러오는 중…'·선택 Resource의 canonical Assignment ID 표시·allocation input 미표시. 서버 응답은 200이므로 특정 배정이 유실됐다는 증거 없음. 내부 React commit 시점/모든 부가 지연은 UNKNOWN.

### 종합 원인·교정·검증 계획

- **판정: INIT_TRANSPORT / 불필요한 추가 후보 조회로 인한 정확 Assignment Editor 준비 지연 + TEST_OBSERVABILITY.** `src/features/gantt/task-assignment-editor.tsx`는 `assigned-targets`의 정확한 개인/Assignment 검증, 값 및 catalogRevision 수령 이후에도 editable이면 **무관한 전체 `assignment-targets` 후보 API를 반드시 기다린 다음** loadedKey/ready를 확정한다. 정확 개인 편집에서는 선택 Resource가 이미 assigned DTO에 있으므로 전체 후보 조회는 편집 범위·입력 초기화에 필요하지 않다. 이 느린 부가 조회 때문에 5초 단언 예산 내 입력 필드 미생성이 발생한 직접 경로가 원본 Trace로 입증된다. #717 F-005a의 오래된 이름/코드 suffix Locator 불일치와 다르다(이번 Locator는 이름-first 코드와 일치하나 loading 상태). #736의 이전 F736-001/002/003(TypeScript, 옵션 matcher, report observer)과도 서로 다른 실패다.
- **제품 최소 교정:** 전체 후보 GET은 `editable && !initialAssignment`에서만 진행. 정확 모드에서는 이미 검증한 `assigned-targets`의 targets/allocations/catalogRevision과 해당 Assignment ID를 그대로 사용하며, 선택 밖 사람은 기존 exact 필터로 표시/수정 금지. 일반 Task Editor의 전체 후보, Global Role/검색, 401/412·catalog revision·동료 불변·atomic PUT는 유지. 무단 재시도/예외 억제·인증 해제·권한 완화 없음.
- **결정적 테스트:** 기존 `tests/e2e/issue-621-resource-target.spec.ts`의 바로 그 case에서 exact editor 진입 시 후보 API 요청 횟수를 관측하고 0이라고 단언한다(구 product는 1건이어서 RED, 새 경로는0). Editor '할당 저장' 가능 상태를 유한 15s 내 검사한 후 기존 percent100→80→70, 공동 담당 BOB 불변, 저장412/401 초안 유지·정확 Assignment ID/원본복귀 및 request3회 단언 유지. 기존 인접 비정확 Task Editor의 후보 검색/Role 필터 경로도 Full E2E에서 실행, #621/#622/#623 및 #736 Resource Plan/Excel 회귀 확인.
- 이전 #736 로컬 L/E/R와 Full PR F736-001/002/003, #717의 Label 원장, PR #760 성공 증거를 교차 대조함. 누적 **Main 실패 M736-001**은 원본 PR 실패로 재분류하지 않는다. 원격 실패 파일 합집합에 기존 Source/Tests 외 `tests/e2e/issue-621-resource-target.spec.ts`와 간접 제품 소비자 `src/features/gantt/task-assignment-editor.tsx`를 추가. 기존 증거 불변.
- **실행·미검증:** 원본 GitHub Source/Job/Trace 검토는 COMPLETE; 변경 후보의 실제 Playwright/TypeScript/Vitest/ESLint/Next Build/Docker 및 정확 Source 전체 QA는 이 연결 세션에 repo checkout/의존성이 없어 **NOT TESTED**. GitHub 교정 PR의 exact Head Full Quality/E2E6/Docker·default-main Trusted QA와 Owner의 새 Head 잔여 위험 수용을 필수로 검증한다. 정적 원본 비교·기존 타입 구조 확인은 전체 테스트 PASS가 아니다. 특정 case 5초 matcher의 전역 연장이나 E2E6/35분 worker/timeout/retry/skip 정책 변경 없음.
- **Main/릴리스 인계:** 기존 원본 Main SHA 실패는 불변 FAILURE. Same-Issue 신규 corrective PR은 원본과 분리된 canonical Refs #736, 새 Full PR CI+Trusted/충돌/Owner 수용 뒤 Merge/Main CI를 시작해야 하며, 성공 이전 정식 GHCR `0.128.0`·`v0.128.0` tag/Issue #736 종료 금지. 기존 [Owner release authorization](https://github.com/planner77/masterGantt/issues/736#issuecomment-6301778867)은 버전0.128.0에 한정되어 있으며 릴리스 성공 영수증이 아니다. 선행 #732 Main #3067.1(CANCELLED)과 별도 [교정 PR #763](https://github.com/planner77/masterGantt/pull/763)도 first-parent 별도 장애이므로 #736 성공으로 대체 불가. **Issue #736 OPEN 유지**. 사용자는 완료 모니터링을 원치 않으므로 이번 요청에서 새 Full PR CI 시작만 확인하고 새 CI 결과를 모니터링하지 않는다.
