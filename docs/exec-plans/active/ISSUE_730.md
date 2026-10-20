# Issue #730 — 고정 관점과 동적 하위 축 공통 조회

## Issue Work Packet

- Issue: [#730](https://github.com/planner77/masterGantt/issues/730), 상위 #723, 선행 #724/#729, 지표 원장 #728.
- baseline_sha: `01fdc08bf4b2f69f9797a8bd411d6712e7478c09` (main).
- branch: `feat/issue-730-view-composer`; 기존 checkout 및 #731 PR과 분리.
- baseline_version: `0.122.0`; candidate_version: `0.124.0`. 신규 공통 조회 UI의 MINOR이며 동시 열린 #731의 `0.123.0`을 사용하지 않는다. dependency 불변.
- risk_level: HIGH; risk_reason: 다섯 관점의 공유 원시 범위·snapshot·편집/일정 복귀·상태 보존에 영향.
- qa_required: true; qa_method: OWNER_MANAGED; independent_qa: N/A(Owner-managed); manager_decision: NOT TESTED.
- release_required: true; release_authorized: false. 사용자 요청 범위는 구현·문서 갱신·로컬 검증 후 PR CI 시작까지다.
- lifecycle_phase: IMPLEMENTATION → LOCAL_FAST_FEEDBACK → DOCUMENTATION_SYNC → PRE_QA → PR_CI.
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION.
- 비범위: CI 완료 모니터링, 병합, Main/GHCR/Release/tag, 브랜치 정리, Issue 종료, API 기본 의미·서버 계산·WBS/Assignment/Target writer 변경.

## 소유권과 의존성

Manager는 문서·version·통합·GitHub 게시를 소유한다. `view_contracts` explorer는 API/host 조사, `view_ux` ui_ux는 읽기 전용 설계, `view_state` frontend는 순수 model/storage/transport와 단위 테스트, `view_frontend` frontend는 공통 composer/table/detail와 기존 host 연결, 별도 frontend는 E2E, `view_review` qa_docs는 사전 검토를 수행한다. 구현 소유권을 파일 단위로 분리하며 다른 Agent의 변경을 되돌리지 않는다. Sub-Agent 원격 쓰기·재귀 위임은 없다.

#729의 POST `/resource-dashboard/views`와 `WbsViewSpec`/report/details/scope를 재사용한다. 원본 ID와 경로 viewRowKey를 구분하고 숫자는 서버 값만 표시한다. 공정→[설비|시스템]은 같은 깊이 typed 형제이며 설비 root의 두 사용자 예시를 지원한다. 단독 root는 levels=[]다. 기존 Milestone 관리·Resource Plan/KPI 및 KPI 화면을 제거하지 않는다.

## Design Delta B

기존 파란 Light UI/system font/semantic token·이름 우선·상황형 도움말을 재사용한다. 관점 탭은 root를 고정하고 구성 disclosure에 native select·추가/삭제·위/아래·적용·초기화를 제공한다. native table의 동일 열 budget과 내부 scroll을 사용하고 가상 그룹은 편집 불가다. 조회 설정은 Project+root browser storage의 versioned 개인 상태이며 업무 revision을 변경하지 않는다. 손상/구버전 설정은 안내와 복구 경로를 제공한다.

GSC `1.0.0-candidate` REVIEW_PENDING를 적용한다. 같은 Gantt host와 기존 editor/drill provider를 사용하며 조회·정렬·계층 변경에 canonical mutation0/Gantt remount0을 검증한다. 조건/원본 revision/snapshot 변경 시 상세를 무효화하며 응답 세대·취소를 적용한다. 공식 Core/PRO grouping에 의존하지 않는 app-owned 조회 표다.

## AC_TEST_COVERAGE

- AC1: `tests/features/resources/wbs-view-model.test.ts`와 `tests/e2e/issue-730-view-composer.spec.ts` — 모든 root의 단독/두 사용자 수정 계층 저장·복원, 두 설비 예시·typed 형제·Project 격리·Gantt 보존.
- AC2: `tests/features/resources/wbs-view-model.test.ts`, `wbs-view-transport.test.ts` — 서버 parser oracle·손상/구버전 storage·root/축 반복·잘못된 형제/depth·요청/응답 source 불일치 음성.
- AC3: `tests/server/resources/wbs-dashboard-views-http.test.ts`, `tests/domain/wbs-task-ledger*.test.ts` 및 신규 UI — E10/Task 비가산·공유 Milestone 원시 범위·등록-only/미배정·같은 서버 총계, exact Task/Assignment ID와 가상 그룹 원본0.
- AC4: 신규 실제 HTTP UI의 Task/Assignment 원본·진짜 Task 저장(revision/snapshot)·Milestone/Resource/WorkArea editor·실제 원래 보기/409 차단·focus/선택과 페이지 상태 전달(실제 50행 초과 다음/이전 클릭은 NOT TESTED), `tests/features/resources/resource-drill-navigation-model.test.ts`, 기존 `tests/e2e/issue-624-logistics-unified.spec.ts`의 legacy source/drill/분리된 원본 focus 회귀.
- AC5: 신규 UI의 390/768/1024/1440/1920px·긴 이름/숫자·6열 budget·내부 scroll·44×44/Tab/Enter/Escape/touch·readonly/empty/error/stale 및 기존 #518/#724/#552/Resource 소비자.
- AC6: model의 ordered-pair800·결정적 order/depth500·typed sibling120 조합을 서버와 대조하고 실제 브라우저는 대표 고위험5개에 집중. 기존 소비자6개는 새 기능 케이스와 중복 합산하지 않는다.

## DOCUMENTATION_SYNC

작성자 Manager. 구현·계약·문서/AC 대조와 Markdown 링크 검증을 진행한다. 실제 실행 결과는 최종 동결 source 원장으로 구분하며 원격 QA/Owner 승인을 대신하지 않는다.

- `DESIGN.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/LOGISTICS_DASHBOARD.md`: UPDATED
- `docs/WBS_TASK_LEDGER.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/ISSUE_730_FAILURE_ANALYSIS.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_730.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/DB_SCHEMA.md`: N/A(기존 DB schema·migration·Repository·저장 writer 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Calendar·공수·full Gate 알고리즘 및 Gantt canonical writer 재사용이며 일정 산식 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(개인 조회 spec은 Import 입력이 아니며 parser·교환 schema 불변)
- `docs/IMPORT_EXPORT.md`: N/A(기존 Import·Copy·Template·Excel writer와 교환 계약 불변)
- `docs/EXCEL_EXPORT.md`: N/A(새 view spec의 명시 미지원 경계를 유지하며 workbook writer 변경 없음)
- `docs/SECURITY.md`: N/A(기존 public-read Origin/session·보호 mutation·server authorization 계약 불변이며 browser 설정에 인증값·원본 응답을 저장하지 않음)
- `docs/GANTT_STATE_CONSISTENCY.md`: N/A(GSC 현재 규범을 적용하고 기존 host/Coordinator를 재사용하며 표준·Core·viewport writer 변경 없음)
- `docs/GANTT_STATE_CONFORMANCE.md`: N/A(기존 적합성 시나리오 계약 불변이며 이 변경의 실제 적용 증거는 본 Work Packet에서 범위를 구분)
- `docs/CI_CD.md`: N/A(Required Quality/E2E6/Docker·workflow·Main/GHCR·Release 계약 불변)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 gate·환경별 증거를 유지하며 사용자 요청의 CI 시작 종료 경계 적용)
- `docs/GITHUB_OPERATIONS.md`: N/A(canonical Refs·변경 묶음 게시·Owner 승인 경계 재사용이며 운영 지침 변경 없음)
- `AGENTS.md`: N/A(기존 역할·파일 소유권·OWNER_MANAGED·문서/검증 지침을 적용하며 실행 지침 자체 불변)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 PR CI 시작 단계까지만 수행하며 lifecycle 계약 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A(HIGH·OWNER_MANAGED·Trusted QA·Owner 최종 승인 규정 불변)

#720 앱 내 매뉴얼 자체는 선행 미구현이며 기존 사용자 가이드의 `동적 조회 구성과 정확 상세`에 다섯 dashboard screenKey/anchor를 인계한다. 현재 화면 기능·버튼·실패 복구와 이 안내를 같은 PR에서 대조한다.

## 누적 실행·실패 원장

- 시작: 최신 main과 기존 #731 PR을 조회하고 별도 worktree를 생성했다. 초기 제품 변경/PR/CI 없음.
- gh 인증은 기존 HTTP401이며 연결 GitHub API로 원본 Issue/댓글/관련 이슈를 읽었다. 인증값 출력·수정 없음.
- 로컬/원격 검증은 실행 전 NOT TESTED. 로컬 최초 실패와 수정 후 결과를 함께 보존한다.

### 구현·진단 중 발견 및 보완

- 별도 Worktree에서 Node22.14.0/npm11.10.0, frozen `npm ci --prefer-offline --no-audit`447 packages 설치 성공. 신규 dependency 없음. 설치의 eslint deprecation 경고는 기존 버전 원문이며 임의로 패키지를 교체하지 않았다.
- state Unit 최초 실행은 Vitest alias import FAIL로 relative import를 사용하도록 fixture/test import만 교정했다. 중간 tsc의 자체 Record 타입·작성 중인 openWbsEntity/WorkArea props/rowSearch 누락은 최종 타입 검사와 구분한다.
- 사전 검토에서 scope 재검증 응답 뒤 stale 원본 명령 실행 가능성, 요청 필터와 응답 provenance 비교 누락, Source/상세의 view/page·선택/focus 복귀 손실, 손상 storage 날짜/ID, Resource/WorkArea 원본의 실제 대상 연결을 확인해 보강했다. WBS→legacy는 display adapter만 사용하고 원본 검증은 WBS spec/filter/scope/snapshot/path로 수행한다.
- 최초 실제 HTTP Chromium3개 진단은1 PASS/2 FAIL. 다섯 root·preset/저장/복원 자체는 진행했으나 조회구성 disclosure helper의 재로딩 타이밍 및 이름+semantic type을 포함하는 rowheader의 exact-text oracle 때문에 실패했다. native open 상태·의미 기반 locator로 수정했고 단언·timeout/CI 정책을 완화하지 않았다.
- 인접5개 진단은3 PASS/2 FAIL. #518은 non-GET21회, #724는3회를 업무 mutation으로 계산했으나 실제 추가 요청은 새 read-only POST `/api/projects/<canonical UUID>/resource-dashboard/views`였다. 정확한 method+endpoint만 제외하고 나머지 업무 write0 단언을 보존했다. mock 기존 navigation은 새 WBS 성공 증거로 간주하지 않는다.
- 최종 조합9개 첫 시도는 새 WorkArea fixture의 workAreaLinks에 API 미허용 occurrenceId를 전달해 HTTP400 INVALID_PROCESS_CONTEXT로2개 FAIL. 같은 알려진 준비 실패의 나머지 반복을 중단했다. fixture를 실제 processId/workAreaId/scope 계약에 맞추고 9개를 새로 실행한다. 이 중단/실패를 최종 성공으로 덮지 않는다.
- 브라우저 실행 중 전체 lint는 생성·삭제 중인 `.next-e2e-isolated-*` 파일 ENOENT로 실패했다. 병행 tsc도 생성 중 validator.ts syntax 오류를 관측했다. 제품 코드 오류나 원격 FAIL로 표시하지 않으며 브라우저 종료·생성 산출물 정리 뒤 같은 소스로 정적 검사를 다시 수행한다.
- 마지막 의미 검토에서 표 이름 찾기로 선택 행을 숨긴 경우 과거 상세가 남을 수 있어 선택·상세를 즉시 지우도록 보완했다. 서버 총계는 그대로이며 브라우저 회귀를 추가했다.

- 추가 브라우저 진단에서 복원 뒤 native select의 wrapped label exact-text locator가 옵션 텍스트까지 포함해 실패했음을 별도 실제 Chromium DOM으로 확인했다. 같은 accessible-name role selector로 교정했으며 저장된 spec/화면 선택은 정상임을 구별했다.
- 실제 제품 결함: WBS scope200 뒤 legacy `/scope?view=context`의 다른 fingerprint와 비교하여 정상 원래 보기 복귀가 차단됐다. WBS는 explicit-task-context를 포함하는 자체 fingerprint이며 원본 WBS scope만 다시 검증하도록 분리했다. 실제 legacy frame의 기존 검증과 409 stale 차단은 유지한다. 취소/새 사용자 의도·revision generation 검사도 유지한다.
- 실제 제품 결함: Resource 원본 대화상자 취소 뒤 자동 fallback focus를 새로운 사용자 의도로 오인해 출발 버튼 focus가 복원되지 않았다. 동일 panel의 자동 focus는 기다리고 pointer/key/wheel의 실제 후속 입력·generation 취소를 유지했다. 재생성 행은 server viewRowKey+action으로 정확히 찾는다.
- 실제 시각/접근성 검토: 이름 검색의 flat 결과에서 접힘 aria 상태와 실제 노출이 어긋나므로 검색 중 펼침 명령을 표시하지 않는다. 검색 해제 시 저장된 접힘 상태로 복원한다. Tailwind reset 후 입력 경계가 보이지 않던 문제는 기존 border-control/surface-panel·focus/selected/disabled token과44px hit area로 보완하고 5폭 화면을 재촬영한다.

## 공식 자료와 환경 경계

설치된 Next16.3.8의 `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` 및 Client/Server boundary를 확인했다. browser storage·event handler는 기존 Client 경계에서만 사용하며 server parser를 client bundle에 import하지 않는다. [SVAR API overview](https://docs.svar.dev/react/gantt/api/overview/)와 [공개 intercept API](https://docs.svar.dev/react/gantt/api/methods/intercept/)를 조회했으나 최신 웹 문서의 기능을 설치 Core2.7.3의 추가 capability로 가정하지 않았다. 이번 조회 구성기/표는 app-owned native UI이며 신규 PRO grouping/API·Core writer 변경과 공식 demo 조작은 N/A다. URL 조회는 실제 demo 조작 증거가 아니다.

- 후속 실제 복귀 진단에서 원래 보기/Resource 원본의 정확 focus가 새 report/detail 준비 직전 복원되어 후속 pending 전환에 사라지는 경합을 확인했다. 기존 복귀 coordinator에 성공한 report/detail 영수증을 연결하고 새 ownerData가 확인되기 전의 상세는 즉시 비현재 상태로 취급한다. 명령 pending과 상세 pending을 분리하며 최신 사용자 의도·취소 generation은 유지한다. arbitrary timeout/retry 증가로 해결하지 않는다.

- 관련 실제 기존 소비자 `issue-624-logistics-unified.spec.ts`의 모든 원시 Assignment ID·full Gate·4관점·5폭·legacy 원본/일정 복귀를 보존했다. 새 POST views를 업무 mutation으로 세는 동일 정적 결함에는 정확한 method+Project endpoint만 제외했으며 기존 HTTP 원장과 API 의미는 그대로다.
- 최종 통합 Chromium10개는 reporter/last-run에서10 PASS/실패0을 기록했으나 shell 종료가143이었다. 원인은 확정하지 않았고 테스트 성공 관측과 종료 코드를 분리했다. 후속 기존 #624+geometry2개는 실제 exit0/PASS를 확인했다. 종료143을 숨기거나 전체 명령 PASS로 승격하지 않고, 같은 제품 소스를 짧은 두 실행으로 나누어 정상 종료까지 재검증한다. timeout/retry/CI gate 변경 없음.
- 시각 검토에서 도움말 버튼 폭32px를 확인하여 높이뿐 아니라44×44px를 보장했다. DOM 검증도 width와 height를 모두 검사하며 마지막5폭 PNG는 표가 보이는 실제 scroll 위치에서 재촬영한다. 원본143과 중간 실패/trace/runtime log는 ignored `.prepr-reports/issue-730/browser-diagnostics`에 로컬 보존하며 Git에는 정제된 결과·PNG/geometry/source 지문만 포함한다.

## 최종 로컬 범위와 잔여 검증

실제 Chromium은 신규 대표5개와 기존 인접6개의 고유11개로 계산한다. 같은 geometry·focus 시나리오의 재실행은 고유 케이스 수에 더하지 않는다. 최초10개 reporter PASS/shell143과 후속 정상 종료 실행을 별도로 보존한다. 최종 Task 저장의 지연 응답·정확 focus 검증은 추가 보완 후 결과를 기록한다.

- 조회 구성/model·storage·transport와 기존 navigation/domain/실제 SQLite HTTP oracle:11 files/155 tests PASS, exit0. 별도 qa_docs의6files/75tests는 이 집합의 부분집합이며 합산하지 않는다.
- 5폭 DOM:390/768/1024/1440/1920px, document overflow0, 클릭 가능한 버튼 최소44×44px. 모바일은 표 소유 scroll로 6열 예산을 유지한다. 실제 표가 보이는 위치에서 PNG를 생성했다.
- 실제 50행 초과 상세의 다음/이전 페이지 클릭, 모든 계층 순열의 브라우저 실행, 최종 수동 UX·실제 운영 환경은 NOT TESTED. 페이지 state 전달·응답 page 불일치 검사는 구현/단위 검증과 구별한다.
- `quality`/`e2e`/`docker`, Trusted QA·Owner 위험 수용·Manager ACCEPT, Main/GHCR/Release는 NOT TESTED. 요청 범위의 종료는 PR Full CI 시작이며 결과 모니터링은 하지 않는다.

- 최종 사전 검토에서 Task 저장 뒤 느린 report가 기존24 animation-frame 복원 예산을 넘으면 원래 버튼 focus를 잃는 제품 결함을 발견했다. 실제 HTTP 저장 후 report를32 animation frames 동안 보류한 회귀에서 `toBeFocused()` FAIL/exit1로 재현했다. 기존 navigation의 report/detail 확인 영수증을 사용하고 canonical revision이 바뀔 때만 새 응답을 기다리도록 보완한다. 상세 React key는 경로 viewRowKey로 유지하여 snapshot 갱신에 Task/Assignment view/page를 초기화하지 않으며, ownerData/snapshot 불일치로 과거 상세·명령을 즉시 차단하는 계약은 유지한다. 수정 후 실제 저장/취소/복귀 재검증 결과는 별도로 기록한다.

### 정제된 로컬 증거

- [단위/SQLite HTTP 결과](../../evidence/issue-730/unit-results.json), [최종 변경 source 지문](../../evidence/issue-730/source-freeze.json).
- 실제 UI [390px](../../../output/playwright/issue-730/composer-390.png), [768px](../../../output/playwright/issue-730/composer-768.png), [1024px](../../../output/playwright/issue-730/composer-1024.png), [1440px](../../../output/playwright/issue-730/composer-1440.png), [1920px](../../../output/playwright/issue-730/composer-1920.png). 같은 폴더의 geometry JSON은 viewport·표 열 경계·scroll·실제 hit area를 기록한다.
- PNG와 정제 JSON은 합성 fixture의 로컬 증거다. runtime log/trace/DB/인증 상태는 Git에 포함하지 않는다.

- 수정 후 실제 저장의 report를160 animation frames 동안 보류하여 기존24/120 frame 한계를 모두 넘긴 상태에서도 새 revision/snapshot 및 원래 Task 버튼 focus PASS를 확인했다. WBS 복귀는 MutationObserver로 성공 응답/상세 영수증과 화면 상태 변화를 기다리며, error/stale/invalid는 현재 heading으로 복귀하고 실제 사용자 입력·새 generation·Project/unmount는 대기를 해제한다. 여러 resource visit는 캡처한 Project+resourceViewId로 owner를 구분한다.
- broad11개 이후 공통 복귀 보완은 대표3개로 재검증했다. 이 실행 도중 첫 fixture startup에 exact resource visit 선택 한 줄이 적용되어 전체 실행의 동일-source PASS로 주장하지 않는다. 별도 최종 동결에서 취소/일정 복귀와 Milestone/Resource/WorkArea 원본 복귀2개를 다시 확인하고, 저장 케이스는 마지막 수정 이후 새 서버 startup/파일 mtime/지문 경계를 명시한다. 고유 케이스 수는11개 그대로다.

### Manager 영향 매핑과 제외

| 변경 producer | 소비자·실제 검증 | 음성·인접 경계 |
| --- | --- | --- |
| `wbs-view-model/storage/transport` | 신규 model/transport 단위, 서버 parser oracle·SQLite HTTP golden, 신규 실제 UI5개 | 손상/구버전·Project/root·forged revision·stale409·오류/역전·가상 원본0 |
| `wbs-view-composer/table/details/dashboard` | 다섯 root 구성·동일 합계·원본/일정·저장·5폭 DOM·원본 복귀 | 업무 mutation0·Gantt remount0·선택 소멸/권한/등록-only·기존 KPI/Milestone 유지 |
| `project-logistics-management.tsx` | 신규 WBS host/Task trigger, 기존 `issue-624-logistics-unified.spec.ts` 실제 HTTP 4관점·raw Assignment/full Gate 회귀 | #518/#724 기존 workspace 및 #552 Milestone mode |
| `project-logistics-unified.tsx` | 고정 root 전환·typed sibling·기존 unified 소비자·정확 Task/Assignment editor | 기존 Target/Plan/legacy 원본·일정 복귀 |
| `project-process-management.tsx` | 신규 실제 WorkArea 원본 ID·별도 admin 권한과 취소/focus 복귀 | 기존 master/readonly·업무 API 보존 |
| `project-readonly-view.tsx`·drill context/model·Resource master | 직접 navigation unit·Task/Assignment/Resource/Milestone/WorkArea 원본·scope·취소/저장·복귀 | 실제 legacy #624 및 Resource consumer·stale/필터 충돌·새 intent 취소 |
| `tests/e2e/fixtures/wbs-view-composer.ts` | 신규 대표5개가 production API로 실제 SQLite 데이터를 준비·읽기 | test mock 응답 주입은 에러/역전 음성에만 사용하며 합성 데이터를 운영 증거로 전용하지 않음 |
| `package.json`·lockfile | version-only0.124.0, frozen npm ci·version check | dependency/Core/CI gate 불변. Audit/build·전체 Unit/E2E/Docker는 PR Full CI |

공통 원장 writer·서버/DB/Import/Export/일정 산식은 변경하지 않아 이 영역의 전수 로컬 회귀는 제외한다. 대신 직접 사용하는 기존 HTTP/domain 원장과 기존 Dashboard/Resource/Milestone 소비자를 선정했다. 전 순열 브라우저·전체 Vitest/Playwright·production Docker/GHCR/환경별 검증은 로컬 선택 범위가 아니며 기존 원격 Required3을 축소하지 않는다. CLI 자동 매핑의 UNKNOWN은 수동 매핑으로 설명하더라도 CLI PASS로 바꾸지 않는다.

### 최종 판정과 실제 명령

- 최종 동결 취소/일정·Milestone/Resource/WorkArea 복귀2개: PASS/exit0,85개 제품 파일의 전후 SHA256 지문 일치. [실제 UI 영수증](../../../output/playwright/issue-730/local-ui-receipt.json)은 broad11개, 후속 보완5파일, 저장160RAF PASS와 중간 source 변경 실행을 분리한다.
- generated `next-env.d.ts`/`tsconfig.json`과 이전 #724 캡처2개는 정확한 HEAD 원본으로 복원했다. 신규 #724 산출물·원시 trace/log/임시 DB는 ignored 진단 폴더에 보존하거나 fixture 소유 경로만 정리했으며 Git에 포함하지 않는다.
- 최종 `npm run typecheck`, `npm run lint`, `node scripts/verify-release-version.mjs`, `node scripts/verify-test-discovery.mjs`, `git diff --check`: PASS/exit0. 발견246unit files/733browser cases는 실제 전체 실행 수가 아니다. 로컬 production build·audit·전체 Unit/E2E·Docker는 NOT TESTED이며 PR Quality/E2E6/Docker가 공식 회귀다.
- 실제 Pre-PR `fast`/`targeted`: 모두 BLOCKED/exit1, sourceStable=true, 시작/끝 fingerprint `6e816040174aac50d284a645b9984cb6c6b01ced7a80a922f2c5bc4b6df37e38`. UNKNOWN4/missing0, CLI 실행 단계0개이며 fast선정26files/targeted27files를 실행했다고 표시하지 않는다. UNKNOWN4는 위 표의 세 logistics producer와 신규 E2E fixture다. 실제 수동 영향 매핑·직접/인접 검증을 위에 보존했으며 CLI selector/정책은 바꾸지 않는다.
- [통합 로컬 원장](../../evidence/issue-730/local-validation.json), [fast 보고서](../../evidence/issue-730/prepr-fast.json), [targeted 보고서](../../evidence/issue-730/prepr-targeted.json), [fast 요약](../../evidence/issue-730/prepr-fast-summary.md), [targeted 요약](../../evidence/issue-730/prepr-targeted-summary.md). 이 지문은 CLI 실행 당시 dirty tree의 지문이며 후속 증거/문서 추가까지 같은 값이라고 주장하지 않는다. 최종 제품/테스트22개 source 지문은 별도 원장을 따른다.

```bash
npm run verify:prepr -- --mode=fast --base=01fdc08bf4b2f69f9797a8bd411d6712e7478c09 --risk=HIGH --issue=730 --report-dir=.prepr-reports/issue-730-fast-final
npm run verify:prepr -- --mode=targeted --base=01fdc08bf4b2f69f9797a8bd411d6712e7478c09 --risk=HIGH --issue=730 --include=tests/e2e/issue-730-view-composer.spec.ts --include=tests/server/resources/wbs-dashboard-views-http.test.ts --report-dir=.prepr-reports/issue-730-targeted-final
```

실제 별도 frontend(UI·순수 상태·탐색·E2E), read-only ui_ux/qa_docs 및 infra 역할을 실행했다. runtime model 이름/effort의 실제 적용은 별도 검증하지 않았으며 역할 설정값을 실행 성능 증거로 사용하지 않는다. 별도 qa_docs의 source/문서 사전 검토는 미해결 P1/P2 0건이며 OWNER_MANAGED의 독립 인간 QA·Trusted PASS·Owner 위험 수용/명시 병합 승인·Manager ACCEPT와 구분한다. 최종 Source/증거 read-only 대조 뒤 단일 변경 묶음을 게시한다.

최종 별도 qa_docs 사전 검토: 현재 source22/제품85 지문 mismatch0, 실제 UI 영수증·5폭 geometry/PNG·PrePR UNKNOWN4/steps0·문서 의미 대조 PASS, 미해결 P1/P2 0건. 마지막 Markdown 링크 검사는270files/exit0다. 이 검토는 원격 Trusted QA·독립 인간 QA·Owner/Manager 최종 승인이 아니다. DOCUMENTATION_SYNC의 로컬 의미 검토를 마쳤으며 검증기 구조 결과의 `SEMANTIC_REVIEW_PENDING` 상태값은 원격 신뢰 검증 결과로 승격하지 않는다. 로컬 문서·증거를 동결하고 원격 PR Full CI 시작 단계로 전달한다.


## PR #747 — Full CI #3001.1 실패 후 재작업 (2026-10-19)

- 이슈 전용 누적 문서: [ISSUE_730_FAILURE_ANALYSIS.md](../../ISSUE_730_FAILURE_ANALYSIS.md). Original Full [#3001.1](https://github.com/planner77/masterGantt/actions/runs/39215173057), HEAD `3962299f07e90108990f75b5dbdd811815057e02`, base `01fdc08bf4b2f69f9797a8bd411d6712e7478c09`, test merge `aed0793999f7642d5daf154d36ced58069a97fc4`. Quality/Docker aggregate SUCCESS. Chromium shard1 #463 mutation0 expected/1 received FAIL, other 5 shards CANCELLED, E2E aggregate FAIL, QA Final은 E2E 미성공 파생 FAIL. 취소된 테스트는 PASS로 집계하지 않는다.
- TEST_CONTRACT 보완: 새로운 read-only `POST /api/projects/{UUID}/resource-dashboard/views`를 일반 업무 쓰기로 잘못 계수한 watcher 수정. #730 최초 로컬 #518/#724 유사 오분류와 [#728](../../ISSUE_728_FAILURE_ANALYSIS.md), [#717](../../ISSUE_717_FAILURE_ANALYSIS.md), [#724](../../ISSUE_724_FAILURE_ANALYSIS.md) 실패 원장의 원인 분리 정책을 대조했다. **exact method/path만 제외**하고 다른 모든 업무 write의 0회 단언은 유지한다. 공통 helper를 #463/#552/#518/#730에 재사용한다.
- PRODUCT P2: [PR 리뷰 스레드](https://github.com/planner77/masterGantt/pull/747#discussion_r4311267545)는 지연된 original scope 이후 후속 `상세`·행 이름 검색에도 원본으로 이동하는 경합. report/original generation 분리 및 검색·상세·refresh·정렬·구성·접기 등 최신 사용자 의도의 동기 abort를 적용. 실제 HTTP scope 응답을 보류한 후 두 intent 모두 오래된 이동을 거부하는 E2E를 추가했다.
- 기존 로컬/사전 실패와 최종 소스 영수증은 당시 source에 귀속해 보존한다. 신규 동결 후보의 로컬 full regression/npm/Playwright는 GitHub 원격 편집 경로에서 **NOT TESTED**. PR synchronize가 등록하는 Full CI는 별도 판정하며 QA Gate/timeout/retry/skip/assertion 완화 없음. 최신 main strict·review 0·merge conflict 0 재확인, CI 시작까지만 수행한다. Owner QA 수용·병합/Main/GHCR/정식 릴리스·Issue 종료 및 CI 모니터링은 제외.

## 최신 main(#731) 정렬과 공통 변경 합성 — 2026-10-19

- #730 최초 PR Head `3962299f07e90108990f75b5dbdd811815057e02` / 당시 main `01fdc08bf4b2f69f9797a8bd411d6712e7478c09` 이후 #731 PR #746 병합으로 main `fbe7db83a4baa2877a75db0769a59077bbe308c4`(5 commits ahead)로 전진했다. GitHub #747은 behind5, mergeable=false로 변경되었다. 과거 테스트·QA PASS를 현재 main 출처로 재사용하지 않는다.
- 세 갈래 최초 공통 파일 15개를 baseline-relative edit로 대조했다. API/UX/KPI/아키텍처/가이드/PLAN/TEST_PLAN의 두 이슈 추가 내용을 보존, manifest/lock은 0.124.0 후보로 유지하며 0.123.0(#731) CHANGELOG을 보존했다. 실제 공통 React 두 파일에서는 #731의 KPI 통합 source/원본 Resource/WorkArea 작업과 #730의 WBS 원본 이동·세대 검증·공통 구성기를 함께 연결한다.
- GitHub blobs/원본 patch 재구성은 정적 보존 검증이다. 전체 실제 TypeScript·E2E·Docker·Main/Trusted QA는 새 exact source CI까지 NOT TESTED. 다음 브랜치 ref 업데이트는 기존 #730 HEAD를 첫 부모, 최신 main을 둘째 부모로 보존하는 non-force fast-forward merge이며 branch/PR 정렬 결과로 판단한다.
- 리뷰 R730-001 동기 취소·F730-001 read-only POST watcher 보완, 회귀 검사기와 단일 실패 원장 경로는 [누적 분석](../../ISSUE_730_FAILURE_ANALYSIS.md)에 기록했다. 사용자 승인 범위는 **새 Full PR CI 시작**까지이며 병합·GHCR·정식 Release·Issue 종료·CI 모니터링은 여전히 제외한다.

## F730-002 재개 — 두 원본 Run의 누적 검증 (2026-10-19)

- 기준 remote Head `b4ba9994ee77a8dbc4a3bb36c8ee6e00beab7a51`, 최신 main `fbe7db83a4baa2877a75db0769a59077bbe308c4`이며 이미 조상 통합 완료. 별도 `fix/issue-730-ci-cumulative` worktree에서 기존 보완과 #731 변경을 보존한다. version0.124.0/dependency/권한/원격 gate 불변, HIGH/OWNER_MANAGED/qa_required=true/release_authorized=false.
- [같은 전용 실패 원장 §7](../../ISSUE_730_FAILURE_ANALYSIS.md)에 #3001.1/3003.1 원본 run/attempt·artifact/Head/base/test merge·실제 FAIL과 취소/미실행·원인/보완을 추가한다. 처음부터 끝까지 원장/Issue·PR 댓글·리뷰를 읽고 #724/#726/#717/#729 및 통합 #731 원장의 관련 경계를 대조했다.
- 최신 실패는 React Compiler Hook inferred deps 누락3개이며 frontend가 setter 의존성만 보완했다. 부모·상세 사이의 모든 원본 요청에 최신 intent가 우선하는지, 조회 POST 관찰기의 같은 원인 누락과 음성 테스트의 실제 목적지 오라클을 함께 검토한다.
- 통합/순수 상태·원장·helper 음성과 누적 E2E/직접·인접 소비자를 선정해 동일 source에서 실행하며 실제 결과/지문을 §7에 이어 기록한다. 최초 구현이나 b4에서 NOT TESTED였던 결과를 재사용하지 않는다. DESIGN/API/DB/일정·Import/Export 계약의 추가 변경은 없으며 현재 제품·상태 보존 규범을 적용한다.

### F730-002 보완의 영향·문서 대조

| 보완 producer | 직접·인접 소비자와 실제 선정 | 음성·제외 경계 |
| --- | --- | --- |
| `openWbsEntity` Hook deps | 전체 ESLint, 실제 #730 설비/System/WorkArea 원본 및 #624 통합 소비자 | 세 setter 의존성만 보완, CRUD·원본 ID·권한 불변 |
| 부모/Details 공통 intent와 host 일정 handoff | #730 지연 원본→상세/검색·교차 Task 명령·두 번째 host scope, Milestone/Resource 정상 일정 이동·원래 보기·저장160RAF | 실제 설비 수정 modal0/정확 Task·focus·업무 mutation0; busy 자기 취소 방지, legacy/KPI signal 없는 기존 경로 유지 |
| exact 조회 관찰기 소비자 | 누적 실제 실패 #463 전체7개, 실제 WBS 진입 watcher13개 및 #518 인접1개 | helper Unit23개로 다른 POST/PATCH·잘못된 method/path·Task/Assignment/설비 mutation은 여전히 쓰기; KPI-only/master-only/일정-only는 조회에 진입하지 않음 |
| 공통 WBS/model/transport/domain/HTTP | 직접13files/195Unit·실제 SQLite HTTP, 통합 #731 KPI17개 포함 | 독립 helper23개 재실행은 부분집합이며 중복 합산하지 않음 |

이번 재작업은 Architecture·Project UX·사용자 가이드의 최신 의도/정상 복귀, TEST_PLAN·PLAN·CHANGELOG 및 같은 실패 원장을 동기화한다. `DESIGN.md`·UI/UX 가이드의 기존 시각/keyboard/focus/상태 보존을 적용하며 레이아웃·제품 용어 변경은 없다. 공개 API·DB·보안·일정 산식·Import/Export는 추가 변경 N/A(일시적 app-owned intent 신호만 추가, 공개 DTO/저장 이력에 넣지 않음). 원격 CI/QA 정책·required 이름·권한·package version/lock 변경도 없다. 전체 production build/audit/Unit/E2E/Docker와 환경별 검증은 해당 원격/환경 gate에 남기며 로컬 선정 결과로 승격하지 않는다.

### F730-002 최종 로컬 판정과 단일 게시 인계

- 최종13files/195Unit·SQLite HTTP **PASS/exit0**. 같은 source Chromium27개 **26PASS/1FAIL**, #623전체2개 단발 진단 **1PASS/1FAIL/exit1**. 모두 sourceStable=true, fixture/단언/timeout/retry/원격 gate 변경 없음. #623의 마지막1920px matrix에서 전체30초 제한이 두 번 관측됐고 원인은 UNKNOWN이며 **LOCAL_VALIDATED=FAIL**이다. 중간27PASS/195Unit 및 통제 음성FAIL은 최종 결과로 이월하지 않는다. [누적 원장 §7.7–7.8](../../ISSUE_730_FAILURE_ANALYSIS.md), [통합 로컬 원장](../../evidence/issue-730/rework-20261019/local-validation.json), [최종 UI 영수증](../../../output/playwright/issue-730-rework/local-ui-receipt.json)을 따른다.
- 최종 전체 typecheck/lint·version0.124.0·test discovery PASS; lint0errors/13warnings, 발견248unit files/747browser cases는 실행 수가 아니다. 변경source35/전체product·E2E656개 지문 mismatch0, tracked Next/이전 증거 복원, raw/DB/auth 제외, owned process0이다.
- 실제 PrePR fast/targeted는 **BLOCKED/exit1/sourceStable=true**, UNKNOWN5/missing0/실행단계0, 선정36/38files 미실행. logistics3producer·WBS fixture·readonly helper의 수동 영향 매핑은 위 표와 원장을 따르며 CLI 정책/PASS는 바꾸지 않는다. [fast](../../evidence/issue-730/rework-20261019/prepr-fast.json)/[targeted](../../evidence/issue-730/rework-20261019/prepr-targeted.json)의 명령/base/head/working 지문을 보존한다.
- 별도 qa_docs source/문서 사전검토 P1/P2 미해결0, 최초26/1 및 단발1/1 보존·UNKNOWN 위험을 확인했다. HIGH/qa_required=true/OWNER_MANAGED/manager_decision=NOT TESTED이며 독립 인간 QA/Trusted/Owner·Manager 최종 승인이 아니다. 로컬 시간 위험을 명시하고 기존 PR747의 단일 게시·Full CI 시작까지만 인계한다. 게시 전후 리뷰/충돌·exact Head/main/tree/Run·Attempt 확인 후 Issue/PR STATUS로 남기며 완료 모니터링·병합/Release/Issue 종료는 하지 않는다.

## 2026-10-19 — 최신 main(#731 PR #748) 정렬 및 PR CI 재시작

- 출발 PR #747 Head `c8f0c283ceb87ff9afc205cd51080c5baed42fea`, main `a0297cd4b01e0083273ad3444edc7fa1ed0a145f` (#731 KPI 원본 포커스 교정). 기존 기준 `fbe7db83a4baa2877a75db0769a59077bbe308c4` 대비 3커밋 이동·#747 behind3/mergeable=false. 미해결 review thread0을 원격 확인했다.
- 네 공통 변경 파일 `CHANGELOG.md`, `docs/PROJECT_UX.md`, `docs/TEST_PLAN.md`, `src/features/logistics/project-logistics-management.tsx`의 diff를 공통 base 기준으로 양방향 source reconstruction 검증하고 충돌1(테스트 계획 동일 위치 섹션)을 두 이슈 기록 보존으로 해결했다. #731 KPI 정확 원본 focus, #730 WBS 원본/일정·정확 조회 구조, main-only E2E/문서 유지. 전체 새 PR CI·Trusted QA는 source 게시 전 NOT TESTED.
- [#730 단일 누적 실패 원장](../../ISSUE_730_FAILURE_ANALYSIS.md) F730-003에 #3005.1 npm ci `better-sqlite3` node-gyp의 Node v22.23.3 `SHASUMS256.txt` ECONNRESET/파생 Quality·E2E·Docker aggregate를 정확히 기록했다. 제품 테스트 실패로 혼동하지 않으며 CI/npm 환경 정책을 무단 수정하지 않는다. 본 요청은 main 정렬·리뷰/충돌 해결·새 Full CI **시작까지**, CI 모니터링·병합/게시/종료는 제외한다.

## PR #747 — F730-004 #3008.1 Read-only GET 전송 오류 보완 (2026-10-19)

- 원본 [Full #3008.1](https://github.com/planner77/masterGantt/actions/runs/39234279476): Head `435ccfffdf60eb4d1695b2260175e7c8728e3918`, main `a0297cd4b01e0083273ad3444edc7fa1ed0a145f`, test merge `472b1313424e12fe67df4864295a0ee4cf5f9c01`. Quality/Docker/Build/Typecheck/Lint/Unit SUCCESS, E2E Shard6 #550 `GET /api/projects/{id}` ECONNRESET (71PASS/1FAIL/62NOT RUN), 다른5 Shard CANCELLED; QA Final은 E2E 미성공에 따른 종속 실패.
- 실제 Playwright artifact 진단: 격리 서버 CLI 살아 있음, 별도 Health 200/27ms, OOM/oomKill 0. 원시 전송 reset은 확정되나 소켓 keepalive/Next worker/OOM 원인 UNKNOWN. 이전 #3005 Node headers 설치 ECONNRESET 및 #3001 watcher/#3003 Hooks 오류와 합산하지 않음. 단일 [#730 누적 원장 F730-004](../../ISSUE_730_FAILURE_ANALYSIS.md#10-f730-004--full-pr-ci-30081-shard6-550-canonical-get-transport-reset-2026-10-19) 참조.
- 기존 `tests/e2e/fixtures/isolated-application-diagnostics.ts`의 검증된 `observedReadOnlyGet`를 `tests/e2e/milestone-management-persistence.spec.ts` 두 `get()`에 재사용하고 `Connection: close`를 적용했다. 첫 ECONNRESET만 observer/health/process/cgroup 증거 수집 후 최대 한 번 같은 읽기 전용 GET으로 재확인한다. 기존 tests/scripts/isolated-readonly-get.test.ts의 정상/한정 복구/두 번째 실패/HTTP·기타 전송 음성 계약 유지. POST/PUT/PATCH/DELETE 재전송, timeout/retries/skip/기존 업무 Revision·Task·Milestone Gate assertion 변경 없음.
- 문서 동기화: 본 Work Packet UPDATED; `docs/ISSUE_730_FAILURE_ANALYSIS.md` UPDATED (F730-001~004 단일 누적); `docs/TEST_PLAN.md` UPDATED. `AGENTS.md`, `docs/CI_CD.md`, `docs/QA_REVIEW_POLICY.md`, `DESIGN.md`, `docs/PROJECT_UX.md`, 공개 API/DB/스키마/서버 제품·릴리스 policy N/A(변경 없음). 새 브랜치 source의 로컬 CI-like·Chromium 실제 실행은 NOT TESTED; Required Quality/E2E6/Docker·Trusted QA/Owner 수용과 병합은 별도.
- 재작업 종료점은 기존 PR #747의 main strict 정렬·미해결 리뷰 0·mergeability 확인 후 **새 Full PR CI 시작**. 원격 PR CI 시작을 PASS나 정식 배포/이슈 완료로 보고하지 않는다. CI 모니터링은 진행하지 않는다.

## #730 — PR #747 최신 main 정렬/리뷰·충돌 해소 및 CI 재시작 (2026-10-19)

- 출발 #730 Head `da6d256290f1c5fcc6edd5e33643098e19b92cd3`, 최신 main `0aa1d3d71f13df6976539ef4ebaaadb9037121c4`(#731 PR #749 후속), 공통 base `a0297cd4b01e0083273ad3444edc7fa1ed0a145f`. 리뷰 스레드 unresolved0(기존 P2 resolved/outdated)·main behind2/mergeable=false 관측. 기존 #730 소스/테스트와 #731 새 fixture의 범위를 분리한다.
- 충돌 파일 두 개: `CHANGELOG.md`는 서로 다른 구역 변경을 보존, `docs/TEST_PLAN.md`는 같은 마지막 삽입 위치의 #731 M-002와 #730 F730-004 양쪽 회귀 계약을 누락 없이 통합한다. main-only `tests/e2e/fixtures/isolated-application.ts`, `tests/e2e/issue-725-process-workareas.spec.ts`와 #731 문서/원장은 최신 그대로 유지한다.
- 기존 [Full #3009.1](https://github.com/planner77/masterGantt/actions/runs/39238265650)의 Chromium Shard2 `issue-719-contextual-help.spec.ts:89` **primaryDataTop 1099→1119(20px)** 실제 FAIL을 별도 F730-005로 [#730 전용 누적 실패 원장](../../ISSUE_730_FAILURE_ANALYSIS.md)에 추가했다. 변경 원인은 UNKNOWN, 다른5 shard CANCELLED/Quality·Docker SUCCESS/QA 파생 FAIL을 분리했다. 이번 범위에서 #719 assertion/CI 보호 규정을 완화하거나 검증되지 않은 제품 수정은 하지 않는다.
- 새 브랜치는 최초 Head first-parent, 최신 main second-parent 한 번의 merge/ref update로 정렬한다. 새 Head Required3·Trusted QA/Owner 결과는 검증 실행 전 NOT TESTED. CI 실행 등록 확인까지만 수행하며 완료 모니터링/병합/Main/GHCR/Release/Issue 종료하지 않는다.


## Full #3022.1 실패 재개 — 누적 원인 보완 및 PR CI 시작

- 기준 Head `2a97043f40f3437778e2936b9413ff3269d197af`, main `5df178868139c4a307701e4807896691971b3376`의 별도 `fix/issue-730-pr-ci-3022` worktree. main은 이미 조상이며 게시 직전 다시 확인한다. HIGH/qa_required=true/OWNER_MANAGED, version0.124.0/dependencies 불변, release_required=true/release_authorized=false. PR을 main으로 병합하거나 릴리스하는 범위는 아니다.
- infra는 전체 Full/Attempt·artifact/checkout·Job/취소·리뷰 출처를 읽기 전용 수집하고 정제 JSON을 소유한다. frontend는 #726 후행 readLinks와 브라우저/관측 음성, 별도 frontend는 #719 도움말 synthetic fixture 경합만 소유한다. ui_ux는 원본 #719 trace/network를 독립 읽기 전용 대조했다. Manager는 문서·게시·리뷰/충돌 확인, 별도 qa_docs는 최종 코드/문서/실행 증거 사전 검토를 담당한다. 동시 파일 쓰기·브라우저 실행을 하지 않는다.
- #3012의 #62360초 실패를 백필하고 최신 main의 #731 M-003 시나리오 분리/원시ID·공수·여섯 mutation·폭별 geometry/키보드/같은 Gantt 단언을 보존한다. #3022는 `readLinks` 후행 GET ECONNRESET이며 정확 소켓 근인은 UNKNOWN이다. 앞서 교정된 process-context와 달리 남은 별도 APIRequestContext 호출·observer 누락을 실제 같은 origin browser GET/no-store로 정합화한다. 업무 mutation/HTTP 오류/JSON/권한·readonly 단언은 그대로 유지한다.
- #719 원본 trace의 같은 scrollTop383에서 WBS pending24px가404 error/retry44px로 바뀌어 primaryDataTop1099→1119였다. legacy synthetic fixture의 미처리 WBS POST가 실제 서버로 전달된 경합을 보완하며, 제품 도움말 CSS나 geometry 동일값 단언을 완화하지 않는다. 실제 로컬 RED/수정 후 결과는 전용 원장에 추가한다.
- 누적 실제 실패5파일 전체와 직접 #730, 변경 helper/오류관측의 정상·음성 및 #731 인접 canonical 소비자를 최종 source에서 한정 검증한다. 직접 재현·통제 negative·과거 결과·같은 최종 source의 결과를 구분하고 실제 실행 수만 기재한다. 전역 CI6-shard/Required3/timeout/retry/skip·보호 정책은 변경하지 않는다. Local/자동 PrePR/원격 결과는 별도 판정이다.
- DOCUMENTATION_SYNC: 전용 실패 원장·이 Work Packet·TEST_PLAN·active PLAN·CHANGELOG 및 정제 실행/원격 JSON을 갱신한다. DESIGN/UI_UX/PROJECT_UX/ARCHITECTURE/API/REQUIREMENTS/DB/보안/일정·Import/Export/사용자 가이드 N/A(제품·공개계약 불변, 테스트 전송/합성 fixture 준비만 교정). CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/QA 정책/AGENTS N/A(기존 Required·권한·게시·승인·누적 진단 절차 그대로 적용).
- 기존 R730-001 thread는 resolved/outdated, 시작 시 unresolved0/충돌0. 새 리뷰/충돌이 생기면 해결 근거를 같은 실패 원장에 기록한다. 모든 변경을 한 묶음으로 게시하고 새 exact Head Full CI의 Run/Attempt/Head/base/test merge 등록만 확인한다. 완료 모니터링·Main/GHCR/Release/tag·브랜치 정리·Issue 종료·Manager ACCEPT는 수행하지 않는다.


### Full #3022 재작업 최종 로컬 판정

- [전용 원장 §16](../../ISSUE_730_FAILURE_ANALYSIS.md), [원격7Run](../../evidence/issue-730/rework-3022/remote-failures.json), [helper/누적 browser30](../../evidence/issue-730/rework-3022/browser-validation.json), [help12/통제RED](../../evidence/issue-730/rework-3022/help-validation.json), [Unit219](../../evidence/issue-730/rework-3022/unit-validation.json), [정적 검사](../../evidence/issue-730/rework-3022/static-validation.json), [source963](../../evidence/issue-730/rework-3022/source-freeze.json)을 연결한다. 고유42 Chromium/16파일219Unit PASS이며 기존 같은 case 반복/제어 실패/이전 후보는 합산하지 않는다. functional source963 mismatch0, help 전체 지문의 실행 중 최초 캡처 한계도 보존한다.
- TypeScript/ESLint0error·기존13warning/version0.124.0/Markdown275/discovery248unit files·757browser cases/diff PASS. 전체 로컬 회귀/build/audit/Docker·원격 Required/Trusted/Owner·환경별 검증은 별도다. 첫 병행 lint SIGINT/exit130은 LOCAL_INTERRUPTED로 보존했고 browser teardown/생성물 복원 후 standalone PASS를 확정했다.
- 실제 PrePR targeted dry-run은 NOT TESTED/sourceStable=true/steps0/UNKNOWN7/missing0. full fast/targeted 실행이 아니며 수동 영향 검증으로 CLI 매핑/정책을 수정하지 않는다. 과거 UNKNOWN5/BLOCKED 및 로컬 시간 실패는 원래 출처에 보존한다. 현재42PASS가 과거 원격 FAIL의 소급 성공이나 reset TCP 내부 근인 증명은 아니다.
- 새 GitHub 리뷰/충돌이 없는 경우 해결건0을 기록하고, main은 이미 조상인 경우 불필요한 merge commit을 만들지 않는다. 최종 source를 한 묶음 게시 후 정확 Run/Attempt/Head/base/test merge 등록만 확인한다. 사용자 지시대로 CI 완료 모니터링·병합·Main/GHCR·정식 릴리스·Issue 종료 및 Manager ACCEPT는 하지 않는다.

- 별도 `/root/qa_review` 최종 read-only 사전 검토 PASS/P1·P2미해결0, source963 재계산 mismatch0. 원격 Head2a97043f/main5df17886/mergeable=true/미해결review0/충돌0을 재조회했고 main이 조상이므로 추가 통합 N/A다. Git push dry-run 인증401로 Git Data API 단일 Ref 게시를 선택하며 전체 tree와 부모를 대조한다. 이것은 Owner/Trusted·Manager 최종 승인이 아니며 새 source CI 등록 후 결과 모니터링 없이 인계한다.

## F730-008 — Full #3023.1 신규 재실패 교정 (2026-10-20)

- 최신 실패 정확 Run `39274370437`/attempt1, source `ec1a18e67b7d1a12b040e8298bde98ba93d93256`, base `5df178868139c4a307701e4807896691971b3376`. [동일 누적 원장 §17](../../ISSUE_730_FAILURE_ANALYSIS.md)에 #727 후행 GET 오류, 직접/파생 Job, F730-001~007 교정과 다른 호출 지점, 원인 UNKNOWN을 누적한다. 기존 remote42 Chromium·219 Unit PASS는 이전 Head 검증일 뿐 새 원격 Source 통과가 아니다.
- Work Packet의 구현 계약: 리소스 Catalog·Task·Assignment seed API 및 독립 권한 검증은 보존. UI 등록 이후 Project canonical2, assigned-targets2, resource-memberships1만 browser same-origin/no-store/observer로 조회하고 status200/JSON/data의 형태 및 원래 Task/Links/Assignment ID/등록/Gantt/scroll/dirty/재시작 단언을 유지한다. redirect error/1회 조회/위조 URL·민감 정보 비공개. 신규 helper와 E2E 음성 테스트 및 진단 template unit test를 같은 Commit에서 작성한다.
- 범위: `tests/e2e/project-resource-memberships-persistence.spec.ts`, 신규 `tests/e2e/helpers/browser-project-resource-data.ts`, 신규 `tests/e2e/browser-project-resource-data.spec.ts`, 진단 fixture 및 진단 unit, 실패 원장·TEST_PLAN·active PLAN·CHANGELOG. 제품 runtime/DB/API/디자인/기존 Core/Gantt/시스템 변경 N/A; 원격 CI·Workflow·retry/timeout 변경 N/A.
- 검증 경계: 연결 GitHub API만으로 파일·문서와 예상 source를 정적으로 대조했고 실제 Node/Vitest/Next/Playwright/Docker/PrePR는 **NOT TESTED**. 새로운 단위/E2E 자동 실행 및 이전 실패 합집합은 원격 Full PR CI에 남긴다. 최종 main/HEAD/review/충돌 확인 후 단일 원자 게시·PR CI 등록까지만이며 CI 완료 모니터링/병합/GHCR·정식 release·Issue 종료/Owner 승인 없음. `release_authorized=false` 불변.


## F730-009 — #3025.1 TypeScript strict null 실패 교정 (2026-10-20)

- 출처: [PR Full #3025.1 / Run39313371409](https://github.com/planner77/masterGantt/actions/runs/39313371409) attempt1, Head `827db790ab567b80ff3a53374f00842ad1ed89b4`, TypeCheck Job `118268773525`: `project-resource-memberships-persistence.spec.ts(91,10)` `TS2532`의 `Array.find(...).registered` nullable 역참조. Policy/ESLint/Vitest 성공, Fast Gate 차단으로 무거운 PR Build/E2E/Docker 구현 Job SKIPPED. 전체 실제 E2E 실패 파일 합집합6개 그대로.
- 구현: 기존 마지막 리소스 재시작 검증을 `registeredMember` 원본 ID 조회 + `expect(registeredMember).toMatchObject({ registered:true })`로 수정하여 검색 불일치 또는 false를 모두 차단한다. 신규 assertion은 실존 확인/등록 확인을 유지하며 non-null assertion·타입 우회·테스트 삭제·timeout/retry/CI 정책 변경이 없다.
- 증거: [같은 #730 실패 원장 §18](../../ISSUE_730_FAILURE_ANALYSIS.md)에 직접·파생 Job/과거8사례 비교 및 Source 수정·검증 한계를 기록한다. GitHub 연결만으로 원본 타입 오류와 정확 수정 텍스트를 검토했으며, 보완 HEAD의 전체 Node/Vitest/Chromium/Docker/PrePR는 **NOT TESTED**. 새 정확 HEAD의 Required Quality/E2E6/Docker로 검증하며 기존 로컬42 Chromium·219 Unit PASS는 과거 source 결과다. 직접 #727과 신규 read-only helper 음성·#726/#719/#623/#730/Task Editor 회귀는 그대로 유지한다.
- 범위: `AGENTS.md`·`ISSUE_LIFECYCLE.md` 및 현재 QA 지침 준수, 실제 기능·API/DB/디자인/보안/CI workflow 변경 없음. HIGH/OWNER_MANAGED/candidate 0.124.0/release_authorized=false. 검토/충돌·main 정렬 확인 뒤 PR CI 시작 등록까지, 후속 완료 모니터링·병합/Main/GHCR/Release/Issue 종료는 제외.

## F730-010 — PR Full #3027.1 #623 여섯 mutation Test Budget 재발 (2026-10-20)

- 원본 [#3027.1 Run39314765099](https://github.com/planner77/masterGantt/actions/runs/39314765099), attempt1, Head `6005dfcf00bbe006e5345938d944cce9ee3c7014`, Base `5df178868139c4a307701e4807896691971b3376`, Test-Merge `0bd9deb2a72b85de1b0ed2f8403e40d9a9ff6380`. Shard3 #623 여섯 UI mutation case 60s TIMEOUT, 44 PASS/1 FAIL/63 NOT RUN, 나머지 Shard CANCELLED, Quality·Docker·PR Build SUCCESS.
- [동일 전용 실패 원장 §19](../../ISSUE_730_FAILURE_ANALYSIS.md)의 trace phase별 값과 F730-006/#731 M-003-A를 대조: 실제 seed20.790초 + 나머지 원본/다중 저장 단계로 전체 body61.586초. 마지막 `assigned-targets` page.evaluate는 test deadline 직전이었고 단일 호출 지연 근인은 UNKNOWN. 제품/DB/Scheduling 장애로 단정하지 않는다.
- **변경 계약:** 단일 `issue-623-resource-mvp.spec.ts`의 동일 Project 여섯 UI mutation case만 기존60s→실측 기반 유한90s로 조정. 기존4 PATCH+2 PUT, 정확 same Task/Assignment ID·revision+6, Target subset/배정80%·WBS·Target·Resource 왕복·동일 Gantt·쓰기0 조회·HTTP/권한/오류 단언/trace phase 계측 불변. 분리하면 같은 Project에서 여섯 UI mutation의 연결 수용 근거가 사라지므로 3개 독립 테스트 변경은 폐기했다.
- 직접 `#623` Golden/OOXML + 여섯 mutation + geometry5, 직전 누적 실제 실패6파일과 #726/#727/#731 Task Editor·#730 WBS·#719 등을 변경 영향 범위로 선정한다. Test default timeout/Full PR6 Shard/PR Fast Gate·Retry/Skip/Assertions/Workflow/GHCR 정책 수정0. 새 Source의 local TS parser는 diagnostics0, **프로젝트 전체 typecheck/실 HTTP SQLite·Chromium/Full PrePR/Docker는 NOT TESTED**; exact Head 원격 Full CI가 정식 검증한다.
- DOCUMENTATION_SYNC: ISSUE_730_FAILURE_ANALYSIS, 이 Work Packet, TEST_PLAN, active PLAN 및 CHANGELOG를 변경. 제품 기능/UI/DB/API/Security/Calendar/SVAR/GSC 및 수용 의미는 불변으로 문서 변경 N/A. HIGH/OWNER_MANAGED, version0.124.0, `release_authorized=false`. 리뷰 unresolved0·충돌0·main 정렬 확인 후 단일 non-force commit과 PR CI 등록까지만 진행, CI 결과 모니터링·병합·Main/GHCR/Release·Issue 종료하지 않는다.

## F730-011 — Full #3029.1 Task Editor 3개 시간대 검증 30초 제한 REWORK (2026-10-20)

- 출처 [PR Full #3029.1 / Run 39320381909](https://github.com/planner77/masterGantt/actions/runs/39320381909), attempt1, source HEAD `0e229ca683bf6fc14fcc81013b6e809e61d5dade`, base `5df178868139c4a307701e4807896691971b3376`. Shard4 `project-task-editor-persistence.spec.ts:8` 30초 Timeout, 79PASS/1FAIL/83NOT RUN; E2E 다른 5 Shards, Quality, PR Build, Docker SUCCESS. 원본 TimeZone 테스트는 UTC/Seoul 확인 후 New York Editor 확인 도중 body deadline, Save/원본 revision/URL/Gantt 불일치 증거 없음. 실패/타이밍 출처는 [#730 전용 원장 §20](../../ISSUE_730_FAILURE_ANALYSIS.md)에 이전 F730-001~010과 구분 기록한다.
- 수정 계약: `tests/e2e/project-task-editor-persistence.spec.ts`의 첫 케이스만 `test.setTimeout(45_000)`으로 유한 예산, **3개의 새 BrowserContext/UTC·Asia/Seoul·America/New_York와 같은 Project/Task, 원래 Editor 저장PATCH1/revision·Description/기간/진척·URL 링크 팝업·원래 Gantt 인스턴스·Task 메뉴** 전체 보존. 다른 테스트의 30초, 전역 CI·retry/skip/assertion·product code/DB/API 변경0. 분리 시 한 Project/Editor 저장→세 Context 연속 확인의 수용 범위 손실을 고려해 유지한다.
- 영향 및 검증: 직접 원본 Task Editor3case, 과거 실제 실패7파일(#463/#550/#719/#623/#726/#727/#3029 Task Editor), 간접 WBS/Resource/KPI/Task Editor cross-TZ·Gantt·error/readonly, Chromium6 Shard, Quality/Docker/Trusted. 원본 Trace/Job 성공과 새로운 HEAD 실제 PASS는 구분한다. 이 연결 GitHub 원본 텍스트 기반 검증에서 로컬 full typecheck/Vitest/Chromium/Next/SQLite/Docker/PrePR는 **NOT TESTED**. 버전0.124.0/HIGH/OWNER_MANAGED, release_authorized=false; 문서/실패 원장 동기화 후 최신 main/review/충돌 확인, PR CI 등록까지만 처리하고 완료 모니터링·병합/Main CI/GHCR/Finalizer/Release/Issue 종료는 범위 밖.

## 2026-10-20 — GHCR Release #182 실패 후 same-Issue 교정 Work Packet

- baseline/main: PR #747 merge `71b870b75da73f413da54e22e55bb03dc0f5abe7`; PR #747 Main #3034.1/Finalizer #724.1 SUCCESS. Immutable `v0.124.0` tag Release #182.1/#182.2 E2E FAIL. Owner 기존 version-scoped marker는 v0.124.0 한정.
- corrective branch: `fix/issue-730-release-e2e-012`; candidate_version `0.124.1` (PATCH), risk_level HIGH, qa_required=true, qa_method OWNER_MANAGED, release_required=true, **release_authorized=false (0.124.1)**, manager_decision NOT TESTED. Same-Issue release-failure supersession 사용, tag 이동/삭제 금지.
- 원인 및 보완: [단일 실패 원장 §21–22](../../ISSUE_730_FAILURE_ANALYSIS.md); #621 stale/no-ready focus→Tab 테스트 결함은 server ready/enabled/actual focused를 기다린 후 원래 Tab 단언으로 판정. #623 fresh real SQLite/HTTP seed와 두 layout을 각각 30초에 묶는 다섯 폭의 예산 결합은 45초 유한한 개별 상한으로 교정. 제품 코드, API, Core, CI Workflow/Retry/Skip, 전체 검증단언 불변.
- 영향 검증: #621/#623 직접 원본과 이전 #730 E2E 실패8파일 합집합 + #730 composer/drill/#719 help/#726 logistics/#727 membership/#731 KPI Task Editor, native focus/stale/readonly/Mutation0/Gantt instance, 새 Head Full PR Quality/E2E6/Docker + Trusted QA. 본 GitHub Data API 편집환경의 실제 npm/typecheck/lint/Vitest/Next/SQLite/Playwright/Docker/PrePR는 **NOT TESTED**. 기존 Run의 성공을 새 Head 결과로 전용하지 않는다.
- Documentation: UPDATED = #730 단일 FAILURE_ANALYSIS, TEST_PLAN, Work Packet, CHANGELOG, package/lock; N/A = DESIGN/AGENTS/API/DB/CI_CD/REMOTE_VALIDATION/UIUX/CI Workflow (계약 변경0).
- User 요청에 따라 source 보완과 원격 Full PR CI 시작까지 진행. Owner 새 SemVer 승인·위험 수용/리뷰·Main CI/새 GHCR 게시·old tag 폐기 승인/Issue close는 완료 전 별개 게이트. Release #182 재실행 금지(동일 테스트 원본).
