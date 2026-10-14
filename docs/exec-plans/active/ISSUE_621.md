# Issue #621 — Resource–Target 다관점·동일 원본 편집 Work Packet

## 기준·범위·담당

- Issue: https://github.com/planner77/masterGantt/issues/621, 상위 #613, 계약 #614, 직접 선행 #618/#620, 재사용 #525/#526/#528 및 #570~#573.
- baseline main: `78691a97bb8c0ba74a560965ca39479d7c80b72c`. #618 composer와 #620 보고 API는 이 SHA에 포함된다. #620 Issue의 main artifact/Finalizer 완료 여부와 코드 선행 반영을 구분한다.
- branch/worktree: `feat/issue-621-resource-target-rollup` / `/home/planner/Dev/masterGantt-worktrees/issue-621`. 기존 작업 폴더·미추적 증거는 보존한다.
- application: `0.112.0` → `0.113.0` MINOR. 하위 호환 사용자 기능 추가이며 dependency graph는 유지한다. `release_required=true`, `release_authorized=false`; version 준비는 게시 승인이 아니다.
- phase: PR_READY → PR_CI 시작 인계. 구현·문서·Local Fast Feedback과 실제 Chromium 신규5개 최종 PASS. 요청 종료점은 사전 검토 후 PR 생성 및 exact-head Full CI 시작 확인이다. CI 모니터링·병합·main/GHCR·Release/tag·branch cleanup·Issue 종료는 범위 밖이다.
- 실제 역할: Manager 통합·문서/Work Packet/Issue 기록, `/root/ui_ux` 읽기 전용 설계, `/root/frontend` UI·gateway·Unit, `/root/e2e` 전용 실제 Next/SQLite Chromium 회귀, `/root/infra` branch/version/게시, 별도 read-only qa_docs 사전 검토. 같은 파일의 동시 writer를 배정하지 않는다. source/Unit은 frontend, 전용 E2E는 e2e, Markdown은 Manager, package/lock은 infra 소유다.
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN/STATUS/EXCEPTION/DECISION_REQUIRED/RESUME/FINAL. Sub-Agent는 Issue/PR 댓글을 직접 게시하지 않는다.
- AC3 구현 중 API 영향 확인으로 `/root/backend`에 `src/contracts/resources.ts`, Resource catalog service/repository 및 전용 server test 소유권을 추가했다. frontend는 Editor/transport, backend는 원자적 exact Assignment 갱신만 변경한다. 같은 파일 writer는 중복하지 않는다.

## 구현·UX 계약

기존 Resource 탭의 app-owned 표/계층을 확장한다. 별도 Resource 원장·집계 엔진·Gantt 인스턴스·PRO groupBy를 만들지 않는다. #620의 `projectionOrder`/`targetPath`와 같은 server filter를 사용하고 선택 전체와 전체 Project 참고를 서버 DTO로 표시한다. Target/Group의 중첩 소계는 비가산이며 접힘·상세 페이지·현재 표시 행으로 전체 총계를 계산하지 않는다. null/partial/all-unset·M/M 기준 미설정·T0/A 분모를 숨기지 않는다.

현재 화면은 기본 현황·Milestone 계층/비교·Plan을 제공하지만 Target projection과 필터의 client parsing/표현·편집 복귀가 연결되지 않았다. 목표 흐름은 기간·Target·검색 → Target 계층 또는 교차표 → 실제 Task/정확 Assignment 상세 → 기존 Editor → 동일 scope 복귀다. Resource 우선은 Group→Resource→Target→Task/Assignment, 역방향은 Target→Group→Resource→Task/Assignment다. 비교는 Resource 또는 Group×Target이다. 자주 쓰는 조건만 상시 노출하고 공정 occurrence/Process Type/WorkArea/설비·시스템 type·instance는 고급 필터에 둔다. 작업 미연결·legacy 미매핑·WorkArea 미사용·프로젝트 공통은 별도 의미로 표시한다.

`projectionRowKey`는 표시 identity이고 canonical `taskId/assignmentId/targetId`는 편집 대상이다. 실제 Task는 기존 Task Editor, Assignment는 기존 Resource 편집 경로에서 정확 개인/Assignment를 식별한다. Target 구성은 #618 composer로 이동한다. Task 이름과 Target 이름 명령을 분리하고 가상 Group/Target 헤더·합계 셀의 날짜/진척/공수를 저장하지 않는다. grouping/filter/정렬은 WBS parent·날짜·Dependency·Resource allocation을 변경하지 않는다.

기존 Task assignments PUT의 generic 전체 교체는 모든 Assignment ID를 재생성하고 allocation을 생략하면 null로 초기화한다. AC3의 동일 원본 편집에는 부적합하므로 optional `editAssignmentId`의 단일 개인 배정 갱신을 추가한다. 기존 route/handler의 권한·Origin·strong If-Match·catalog revision을 재사용하고 정확 Task/resource/assignment 조합을 검증한다. 해당 row의 기간/allocation만 변경해 Assignment ID·다른 공동담당자 원본 값/기간/미설정/비활성·timestamps를 보존한다. generic PUT의 생략/전체 교체 의미를 암묵 변경하지 않는다. 입력/권한/범위/날짜 오류는 atomic rollback이며 schema migration은 없다.

저장은 기존 server session/Origin/strong If-Match·canonical scheduling gateway를 재사용한다. 저장 뒤 이전 report는 stale로 잠그거나 같은 canonical snapshot에 맞춰 재조회하며, 오래된 셀을 최신 성공으로 표시하지 않는다. Resource→일정→Resource 복귀는 기존 drill transport/provider와 viewport coordinator에 위임한다. 가능한 같은 조건·보기·페이지·펼침·선택·focus를 보존하고, 원본 행이 필터에서 탈락하면 사유를 안내하고 유효한 컨트롤로 복귀한다. 취소·dirty/pending·권한만료·409/412·응답역전에서 기존 초안/guard를 유지한다.

| 상태 | 동작 |
| --- | --- |
| loading / empty / no-results | 조회 상태와 조건에 따른 빈 결과를 구별하며 재조회 경로 제공 |
| readonly | 조회·drill 허용, mutation은 기존 권한 gate로 차단 |
| dirty / pending | 초안 보존·기존 확인 절차, 중복 저장·충돌 이동 차단 |
| stale / 409 / 412 | 기존 결과임을 표시, 상세/편집 잠금 또는 기존 Editor 복구, 명시 재조회 |
| error / inactive / unmapped | 오류·비활성 legacy·미연결 의미를 텍스트로 구별 |
| saved / filtered-out | 새 revision 재검증, 유효 행 복귀 또는 사유와 fallback focus |

390/768/1024/1440/1920px에서 긴 이름·다열 표는 table-owned 내부 scroll로 처리한다. native button/select·명시 label·focus ring·Enter/Tab/Escape·연결되고 visible한 복귀 target을 검증한다. 기존 Light/system font/semantic token/compact controls를 재사용한다.

## GSC 적용·증거 경계

- `gantt_standard_version=GSC 1.0.0-candidate (REVIEW_PENDING)`; `reviewed_document_commit=78691a97bb8c0ba74a560965ca39479d7c80b72c`.
- 필수 참조: GANTT_STATE_CONSISTENCY/CONFORMANCE/ADAPTER_ADR/SYNC_TRACE 및 active GANTT_STATE_REMEDIATION. 규범 본문·기존 DEFER/FAIL을 이 작업에서 변경하지 않는다.
- 적용: GSC-01 canonical 저장/조회 분리, GSC-03 Editor 실패·불명확 결과 guard, GSC-04 기존 canonical/viewport writer 유지, GSC-06 report/query 세대·응답 취소, GSC-07 최신 사용자 의도·focus, GSC-08 실제 관측, GSC-09 remount0·canonical identity, GSC-10 설치 Core2.7.3/public API, GSC-11 누적 회귀, GSC-12 범위별 원장.
- 상태/쓰기 소유권: Resource UI는 표시 조건·selection·상세 페이지를 소유한다. Task/Assignment 저장은 기존 Editor/server gateway, canonical Core 반영은 기존 reconciler, 일정 이동/복귀는 기존 viewport coordinator가 소유한다. 두 번째 Core/scroll writer를 추가하지 않는다.
- 누적 검증: SC-11 Resource report→detail→Editor/일정→복귀를 직접 검증하고 Task 저장·실패/취소·readonly와 관련된 SC-01/02/03/04/09/10/12 보호 의미를 기존 회귀와 대조한다. SC-05~08/13/14의 axis/Calendar/3000행 native 전수 수용은 이번 신규 기능 검증으로 대체하지 않으며 전체 원격 CI까지 NOT TESTED다. `exception_adr=NONE`이며 표준 면제가 아니다.
- 공식 grouping 문서는 PRO 제약 확인에만 사용한다. URL/문서 확인·설치 타입·실제 Chromium 조작 증거를 구분한다. GSC 전체 준수·U5/#574 완료를 주장하지 않는다.

## DOCUMENTATION_SYNC

- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: UPDATED
- `docs/exec-plans/active/ISSUE_621.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(기존 Light/compact/progressive disclosure/table sizing/상태·focus 원칙의 구체화인 Design Delta B)
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: N/A(기존 canonical Task/Assignment/Target 원장을 사용하며 schema/migration 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 canonical scheduling/KPI/Calendar 알고리즘을 재사용하며 계산 정책 불변)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Import/Export 형식을 변경하지 않으며 Target Excel 확장은 후속622)
- `docs/IMPORT_SCHEMA.md`: N/A(Import payload/validation/atomic restore 계약 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(기존 Target 조건 미지원 거부 경계 유지, 새로운 workbook 기능 없음)
- `docs/SECURITY.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/DEPLOYMENT.md`: N/A(Docker/Compose/운영 저장소 및 환경 계약 변경 없음)
- `docs/CI_CD.md`: N/A(현행 minor version 및 required CI/릴리스 절차 유지, workflow 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(현행 원격 Required/Trusted gate 유지, 이번 실행 상태는 Work Packet에 별도 기록)
- `docs/GITHUB_OPERATIONS.md`: N/A(GitHub 권한/Ruleset/원격 운영 계약 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(최신 Owner-managed 정책을 그대로 사용하며 QA 승인 경계 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(현행 Lifecycle을 적용하며 단계/승인 범위 변경 없음)
- `AGENTS.md`: N/A(기존 실행 지침·역할·신뢰 정책 변경 없음)

Design Delta 후보: **B — 기존 원칙 구체화**. 데이터 밀도·progressive disclosure·table-owned scroll·canonical 편집/상태/복귀는 기존 DESIGN 방향이다. 신규 공통 원칙을 채택하지 않으면 `DESIGN.md: N/A`로 기록한다. API/DB/Scheduling/Import/Deploy/CI/QA 정책은 기존 계약 재사용 범위이며 실제 diff로 영향/N/A를 최종 판정한다.

## AC_TEST_COVERAGE

| AC | 검증 범위 |
| --- | --- |
| AC1 | #620 HTTP/SQLite 총계·selector 회귀, Target 계층/교차표·접힘/상세 페이지에서 서버 union 총계 보존 |
| AC2 | Resource→동일 Task Editor 저장1·복제0·WBS/Target A/B 같은 ID/새 값, 역방향 갱신 |
| AC3 | 정확 Assignment 개인·기간/allocation 편집, 공동담당 불변·공유 Task identity |
| AC4 | 헤더·정렬·필터·group 전환 mutation0, 기존 server editor validation 회귀 |
| AC5 | readonly/권한만료/409·412/응답역전/dirty/pending/취소/필터탈락·scope/focus 보호 |
| AC6 | 실제 Chromium 390/768/1024/1440/1920px·긴 이름/다열/내부scroll·keyboard/상세복귀·Gantt instance 보존 |
| AC7 | 기존 Resource KPI/Milestone/Plan/Task Editor·#528 exactAssignments source 회귀 |
| AC8 | 문서 diff·AC mapping·Design Delta·Markdown links 및 code/docs 정합성 |

- AC1: `tests/e2e/issue-621-resource-target.spec.ts` 및 기존 `tests/server/resources/resource-target-dashboard.test.ts`의 서버 union 총계/상세 페이지와 UI 계층·교차표/접힘 검증.
- AC2: 같은 전용 E2E에서 shared Task Editor 저장1회·복제0·WBS/Target A/B의 canonical ID·역방향 조회 검증.
- AC3: 같은 전용 E2E 및 기존 server drill 회귀의 정확 Assignment 편집·공동담당 보존·identity 검증.
- AC4: 같은 전용 E2E의 projection control mutation0 및 기존 server 권한/ID/If-Match 거부 검증.
- AC5: 전용 E2E·frontend model 회귀의 readonly/401/409·412/dirty/pending/취소/늦은 응답/필터탈락·scope/focus 검증.
- AC6: 전용 E2E의 390/768/1024/1440/1920px·keyboard/내부scroll·상세복귀·같은 Gantt instance 검증.
- AC7: 기존 Resource model/drill/transport/Plan·Task Editor 회귀와 전용 E2E에서 Milestone·Plan 전환·exact source 범위 검증.
- AC8: 문서 diff·위 UPDATED/N/A 합집합·Design Delta B·GSC 적용/제외·Markdown links 및 code/docs 정합성 검토.

실제 test 이름과 실행 결과는 freeze 후 아래 원장에 기록한다. 미실행은 PASS가 아니다.

## 위험·QA·운영 원장

`risk_level=HIGH`, `risk_reason=공통 Task/Assignment 편집·동일 원본 정합성·scope/focus 복귀`, `qa_required=true`, `qa_method=OWNER_MANAGED`(최신 #598), `independent_qa=N/A(Owner-managed 최종 운영 경로)`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`.

별도 Agent 사전 검토는 실제 검토 범위만 보고하며 Owner의 HIGH 잔여 위험 수용·명시 병합 허가·Trusted QA를 대체하지 않는다. exact Head/base Required 세 aggregate·review thread0 및 Trusted QA는 후속 원격 gate다.

- 기존 #621 PR/branch 중복: infra가 open PR10개 및 exact branch all-state PR을 조회해 일치0 확인.
- gh CLI 인증401. git fetch와 연결 GitHub 도구 사용, 권한/token/Ruleset 수정 없음.
- 설치: 실제 `npm ci --no-audit --no-fund` PASS,447 packages/9초. 실제 Next16.3.8·SVAR Core2.7.3 확인. CI frozen install의 대체 증거는 아니다.
- Manager Local Fast Feedback: server Target/drill·pure Target KPI·version4파일82tests PASS/3.83초; 별도 drill transport/navigation·Task Editor model4파일64tests PASS/0.261초. 실행 시점/범위를 구분하고 이후 변경된 source 검증은 담당 결과와 연결한다.
- frontend Local Fast Feedback: Target client/dashboard/transport/Plan/navigation5파일30tests PASS, 최종 typecheck PASS, 변경 source/test ESLint0errors·기존 gradeText unused warning1, diff check PASS. 실제 Next use-client guide·설치 Core public types 확인, PRO/private/new Gantt/writer 추가 없음.
- backend Local Fast Feedback: 신규 exact native/HTTP handler25tests PASS, 기존 관련 포함5파일37tests PASS(신규25의 재실행과 중복 합산하지 않음), typecheck/변경 ESLint PASS. 선택row ID·공동담당 null+dates/비활성/Group·timestamps, no-op0, 잘못된 ID/범위/입력·401/403/428/409/412·revision fault rollback 검증.
- 별도 `/root/qa` focused 실행: backend exact·기존 Assignment/client/transport5파일38tests PASS/0.958초; 별도 client3파일13tests PASS/0.323초. 초기 runtime alias import 때문에 model collection0tests FAIL이 있었으며 relative runtime import 수정 후 해소했다. 실행 중복을 단일 전수 결과로 합산하지 않는다.
- 실제 Chromium 초기 원장: readonly input을 disabled로 기대한 oracle FAIL을 readOnly 검증으로 교정했다. button 내부 small에 대한 중심 hit-test oracle도 contains(hit)로 교정했다. source 변경 중 Assignment 실패는 원인을 확정하지 않고 원본 증거를 보존한다. 실제390 focus clipping은 제품 UI FAIL로 확인해 sticky 열 폭/scroll-padding·Resource owner focus reveal을 보완하고 전체 ring 검증을 추가했다. stale 복구 sequence와 일정의 명시적 모든 개인 담당 조회의 새 source 의미에 대한 test 기대를 바로잡았다. 중단된 후단은 PASS가 아니다. 최종 freeze 실행 결과는 별도 기록한다.
- 최종5개 실행1차: HTTP union/readonly/exact source와 동일 Task 저장/WBS 역방향2개 PASS, matrix·Assignment·stale3개 FAIL. 중첩 Resource 복귀 focus는 실제 제품 문제이며 Resource 원본의 논리 Task/Assignment/명령을 보존하고 ready 상태·유효 visit·최신 사용자 입력을 확인하는 유한 복귀로 보완했다. Assignment401은 일시 만료 문구 대신 안정된 초안 보호 상태/실제 값 검증, stale는 실제 초안 폐기 버튼 이름으로 oracle을 교정했다. 최초 실패·중단 trace/error는 로컬에 보존하고 Git에는 게시하지 않는다.
- 영향3개 재실행: 정확 Assignment15.4초·stale/역전/취소/필터탈락13.3초 PASS, matrix의 복귀 focus는21.8초 FAIL. 비동기 이후 activeElement/trigger를 읽는 경계도 보완해 실제 `request.trigger`를 loading/await 전에 원본 frame에 전달했다. 이후 matrix22.6초와 진단22.0초도 focus FAIL이므로 이를 유일 원인으로 단정하지 않는다. 실제 진단은 같은 원본/new Task·Assignment·명령과 visible/ready visit0을 확인했으나 activeElement=BODY였다. 첫 RAF에 아직 숨겨지거나 미마운트인 Resource를 즉시 종료하는 경로를 같은 generation/사용자 의도 안에서 유한 준비 대기로 보완한다. 오래된 legacy2RAF focus도 generation으로 취소한다. 기존4개 PASS의 비영향 범위만 재사용하고 마지막 matrix1개는 새 source에서 재실행한다. 실패를 후속 성공으로 소급 PASS하지 않는다.
- 추가 관측: 위 준비 대기/세대 보호 후에도 matrix22.5초가 FAIL해 focusin·MutationObserver·report/details request/response 시간을 test-only observer로 수집했다. 원래 정확 `이 Task 일정` 버튼 focus 성공 뒤10ms에 report가 ready=false/detail stale이 되면서 행이 교체되고 BODY로 이동했으며, 이후 report/details200·ready에도 복귀하지 않았다. 실제 원인은 cached ready 관측과 재활성화 후 실제 report/detail 확인의 시점 차이다. 숨김/논리 selector 문제만으로 실패를 설명하지 않는다. 기존 report confirmation 및 상세 성공 receipt가 현재 visit/범위에서 새로 확인되기 전에는 복귀 lease를 끝내지 않도록 보완하고, timeout/skip/기존 단언은 완화하지 않는다.
- 최종 receipt 보완은 기존 report confirmation ID 및 현재 data/query에 속한 상세 성공 receipt를 사용한다. 출발 시 실제 trigger·report/detail receipt를 함께 보존하고 재활성화의 새 확인 뒤 원본 명령으로 focus한다. 새 report prop과 일치하지 않는 상세는 passive effect 전 render부터 loading·이전 명령 잠금으로 표시한다. 같은 active context의 오류 복귀는 존재하지 않는 새 activation을 기다리지 않는다. 유한120RAF·같은 visit/project·generation·새 pointer/keyboard/wheel 취소를 유지하며 추가 Gantt/viewport writer·server API·authorization은 없다. 공용 detail readiness 변경의 영향으로 신규5개 시나리오 전체를 다시 검증한다.
- **최종 실제 Chromium 실행 PASS**: `npx playwright test --config tests/config/playwright.config.ts tests/e2e/issue-621-resource-target.spec.ts`, session17064, 신규5개 모두 PASS/2.0분. 개별12.6/14.0/18.7/16.0/13.4초: HTTP union/readonly/exact source, 동일 Task 저장1·복제0/WBS 역방향, Target 계층/교차/5열페이지·2mode×5폭·정확2단계 복귀/새 사용자 입력취소/composer/실제Core DOM 및 API instance/무mutation, 정확 Assignment 날짜·80%/동일ID·Bob null 보존/412·401초안, 응답역전/실제409→최신canonical재조회/취소·필터탈락fallback. 앞선 실패4개 재사용만으로 구성한 결과가 아니라 마지막 공용 readiness 변경 뒤5개를 실제 한 번에 실행했다. 최초 실패는 위 원장에 그대로 남는다.
- 최종 실제 화면/geometry: 합성 after PNG390/1440px와 `matrix-geometry.json`의 Resource/Group×390/768/1024/1440/1920px10개 관측, 환경·source-scope 원장을 선별 게시한다. documentWidth=viewport, header/body 정렬·셀내용 경계·focus ring/painted·390 내부scroll을 검증했다. 수정 전 baseline screenshot 실증은 NOT TESTED이며 최초 clipping 원본 trace와 source gap을 보존한다. raw trace/error/DOM timeline/DB/log·Secret는 Git에 게시하지 않는다.
- #528 검증 구분: `모든 개인 담당 조회`는 명시적 fresh scheduleSelection source라 공동담당2가 정상이다. UI의 fresh Task source→Alice 개인필터→Target교차1과 HTTP/Unit의 exactAssignments 원본1→Target A/B/path교차1을 구별한다. fresh UI 흐름만으로 exactAssignments-specific 전체 브라우저 경로 PASS를 주장하지 않는다.
- DOCUMENTATION_SYNC:215 Markdown 링크·diff·`docs_gate` required docs합집합/AC1~8 structural PASS. 별도 qa_docs의 최신14문서/packet 의미 대조에서 열린 P1/P2 없음. 자동 구조 PASS와 실제 의미·최종 원격/Owner 승인 판정을 구분한다.
- 사전 Agent 검토: **PASS**. 별도 `/root/qa`의 source/backend/14문서·Work Packet 대조에서 열린 P1/P2 없음. 최종 실제 Chromium5PASS와 source inventory20파일을 직접 재계산해 mismatch0·SHA256 `d6d5da25c3f555c99e7068fe41036e511b8c68c57a5e3ddf4a781a01410499e3`를 확인했다. inventory는 package/lock·production source·E2E spec/fixture 범위이며 Unit/문서 전체 manifest로 과대 표시하지 않는다. 독립 인간 QA/Trusted QA/Owner ACCEPT의 대체가 아니다.
- 게시 전 generated `next-env.d.ts`/`tsconfig.json`을 기준 HEAD로 복원했다. 실제 typecheck/version0.113.0·dependency graph 불변·diff·215 Markdown 링크·docs_gate/AC1~8 구조 PASS. `.github/**`/scripts/deploy·권한·Required gate·pin 변경 없음.
- 선별 공개 증거: [최종 실행](../../../output/playwright/issue-621/execution-result.json), [source inventory](../../../output/playwright/issue-621/source-inventory.json), [10개 geometry](../../../output/playwright/issue-621/matrix-geometry.json), [source scope](../../../output/playwright/issue-621/source-scope-evidence.json), [환경](../../../output/playwright/issue-621/environment.json), [390px after](../../../output/playwright/issue-621/target-matrix-390.png), [1440px after](../../../output/playwright/issue-621/target-matrix-1440.png). 최초 실패/DOM timeline은 로컬 전용이며 공개 증거 목록과 구분한다.
- 별도 미검증: 기존 #528/#530/Milestone 전체 E2E는 PR Required 회귀에서 검증하며 로컬 전수 PASS가 아니다. Target 상세 UI50행 pagination은 NOT TESTED(실제 UI4열 비교 page·HTTP Assignment limit1 page와 구별). native125%·실기기/screen reader·운영/TLS/backup도 NOT TESTED다.
- 원격 quality/e2e/docker·Trusted QA: NOT TESTED; 요청 범위는 CI 시작까지.
- main/GHCR·tag/Release·cleanup·Issue 종료·운영/실기기/screen reader: 미수행, 요청 범위 밖.
