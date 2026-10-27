# Issue #824 통합 개선 검증 추적

## 출처와 판정 경계

[Work Packet](exec-plans/active/ISSUE_824.md)의 #826→#827→#828→#829→#830 순서에 따른 인수 기준별 검증 추적이다. 기준 main은 `e95cb091`, 앱은 `0.135.5`다. 아래 기존 테스트 경로는 검증 대상의 매핑이며 현재 Head의 실행 PASS가 아니다. 원격 Full CI·Trusted QA·독립 인간 최종 QA·Manager ACCEPT는 별도 증거로 판정한다.

R은 실제 Next HTTP/SQLite·세션을 사용하는 시나리오, M은 응답을 제어한 브라우저 UI 시나리오, H는 실제 성공 경로에 오류 응답만 제어한 시나리오다. M의 인증 후 화면은 synthetic 로그인 응답으로 표시한 작업면이므로 실제 인증·권한 분리 증거가 아니다. 실제 관리자 session 검증은 서버 통합 테스트 및 R 증거로 구분한다.

## #826 공통 조회

| AC | 검증 대상과 기존 경로 | 추가 직접 증거 |
| --- | --- | --- |
| AC1 | R `issue-730-view-composer.spec.ts`: 다섯 고정 관점, #798 고급 조건5관점 | 5소비자 fine36/coarse44·공통 typography 실측 |
| AC2 | 같은 spec의5폭·보이는 label/고급 조건 시나리오 | 넓은 label/input 같은 행·동일 제어 top/bottom≤1px |
| AC3 | 공통 요약/도구·KPI KEEP | section16/body14/tool13·line-height와 첫 데이터 위치 |
| AC4 | R 기존 구성저장/복원, 정확 Task/Assignment, 응답역전, 원본 저장·복귀, 초기화 focus | 현재 경로/기간·활성 조건 표시와 root/하위 축 보존 |
| AC5 | R/H 장문5폭·keyboard/coarse tap·오류 | fine/coarse 목표·focus containment·pending·tool rows |

## #827 Milestone 구획

| AC | 검증 대상과 기존 경로 | 추가 직접 증거 |
| --- | --- | --- |
| AC1 | R `issue-732-milestone-dashboard.spec.ts`: Target0·전체 Gate·5폭/keyboard | 계층 조회·전체 Gate/관리 이름과 경계 |
| AC2 | 동일 source의 두 구획 | section16/body14/tool13·fine36/coarse44 비교 |
| AC3 | R #732·`milestone-management-persistence.spec.ts`·`milestone-stage-gates.spec.ts` | 선택 Task/Assignment·공수 vs 전체 Gate·기준일·명시 완료를 구분 |
| AC4 | R #732 원본 저장/stale/error·조건 밖 생성/검색·focus, #730 Gantt 왕복; M `milestone-dashboard-state.spec.ts` | 원래 경로/필터·scroll·선택·단일 Gantt 유지 |
| AC5 | R/H #732 readonly/stale/error, M `milestone-management.spec.ts` 장문/동명·401/412/network·dirty Escape | 빈/미지정/차단/지연의 구획·상태 문구 유지 |

## #828 Global Resource

| AC | 검증 대상과 기존 경로 | 추가 직접 증거 |
| --- | --- | --- |
| AC1 | M `resource-tabs.spec.ts`·`tests/fixtures/resource-admin-453.ts`; 인증 전 `admin-auth-layout.spec.ts` 별도 | 동일 fixture 인증 후 개인/그룹/구성원·편집 before/after5폭 |
| AC2 | M `resource-tabs.spec.ts`·`resource-admin-layout.spec.ts` geometry | font·관리40/coarse44·보이는 검색 label·정렬 |
| AC3 | 같은 fixture의 panel/목록/구성원/첫 데이터 위치 | 불필요한 padding/반복 제목 실측 또는 KEEP 이유 |
| AC4 | M 기존976/800px 표·identity/역할·비활성·삭제불가·header/body alignment; `resource-catalog-delete.spec.ts` | 긴/동명·badge/action·표 소유 scroll/focus |
| AC5 | M 탭/search/scroll/dirty/pending/Escape, `resource-error-recovery.spec.ts`의401/412·재시도, `resource-global-roles.spec.ts` | UI 응답 제어와 서버 실제 auth/Origin/If-Match·권한 분리 통합 검증을 구분 |

## #829 프로젝트 기준정보

| AC | 검증 대상과 기존 경로 | 추가 직접 증거 |
| --- | --- | --- |
| AC1 | M `project-resource-memberships-ui.spec.ts`; R `issue-762-process-workareas.spec.ts`·`issue-726-logistics-master.spec.ts` | 4관점 동일5폭×900 before/after·폭/font/search rows. 과거 높이1000px 결과와 구분 |
| AC2 | M `project-logistics-management.spec.ts` 공용 shell·readonly/help | 선행 #825 뒤3물류 가용 폭·중복 header와 local 목록/도구 |
| AC3 | R #762 공정/WorkArea CRUD·미연결·readonly·pending412; M 공정등록/dirty/error | 비교 pane·active/detail·긴 label·빈 상태 clipping |
| AC4 | R #726 수량/여러 구역/시스템 직접·조율, #762 cross-process 관계; membership UI/persistence | 참여등록과 개인 Task배정 모집단·원본 ID·Task 불변 |
| AC5 | R/H #762/#726 생성/편집·오류/취소초안; M logistics 관리와membership401/412pending/Escape/focus | 현재 source의 dialog/편집 왕복·readonly·원본 복귀 |

## #830 전역 물류·프로젝트 관리자

| AC | 검증 대상과 기존 경로 | 추가 직접 증거 |
| --- | --- | --- |
| AC1 | M `logistics-table-density.spec.ts`·`master-controls-density.spec.ts` 및 `tests/fixtures/logistics-admin-454.ts`·`project-master-455.ts` | 인증 전/후·type/tab/list/form/관계 동일 fixture before/after. 양호한 곳 KEEP |
| AC2 | 기존 표/행/제어 geometry | section16/body14/보조12–13·관리40/coarse44·focus |
| AC3 | M type CRUD/If-Match·마스터3범주·`project-master-relations.spec.ts` | code/name/status·원본·관계·action grouping/column budget |
| AC4 | M 장문5폭·행/표 focus/scroll | 문서 overflow0·표 소유 scroll·마지막 action·keyboard clipping0. 관계 표/select/action의5폭·긴 label·coarse focus는 품목 표와 별도 측정 |
| AC5 | M 기존 CRUD·pending/Escape·401/403/412/network·관계 연결/해제 | 실제 인증/권한 분리 통합 검증과 응답 제어 UI 검증 분리 |

## 실제 실행 결과

구현과 최종 로컬 직접 검증을 완료했다. 결과는 source hashes·fixture·명령·환경·실패 원본·실행 case 범위에 귀속하며 테스트 존재·사전검토를 원격 PASS로 소급하지 않는다. 각25개 AC의 최종 수용은 새 Head의 공식 Full CI·독립 인간 AGENT QA·Manager 승인 전 NOT TESTED다. 아래 Local 상태는 실행한 범위만 뜻한다.

[실제 SQLite Local Fast Feedback 영수증](evidence/issue-824/security-fast-feedback.json): 기존 `admin-session-isolation.test.ts`의3관리자·프로젝트 편집 세션 상호 권한 거부와 `resource-catalog-delete.test.ts`의 실제 handler Origin403/미인증401/stale412/사용중409·DB 불변 **2case PASS**. `-t`에서 미선택4case는 실행 성공에 포함하지 않는다. 제품/테스트 auth source 변경 없음. 이 결과는 실제 DB/handler 범위이며 브라우저 로그인·Logistics/Master HTTP401/412·운영 인증 또는 전체 회귀 PASS가 아니다.

### #826 로컬 직접 결과

[원본 manifest](evidence/issue-824/wbs-manifest.json), [비교 수치](evidence/issue-824/wbs-comparison.json)의5소비자×5폭×fine/coarse before50/after50을 확인했다. 압축 JSON은 원본 bytes를 gzip으로 보존하며 manifest에 SHA256을 기록한다. baseline12개 source hashes는 main `e95cb091`, 최종13개는 로컬 순차 commit `d2f9692e`의 bytes와 전부 일치했다. 최초 baseline은 end-hash 검사가 없고 미변경 process CSS 경로 하나를 누락했으므로 해당 한계를 manifest에 명시한다. 최종 after는 start/end13hash 일치 `sourceStable=true`다.

최종 root body14px·도구13px·fine36/coarse44·document overflow0, 넓은 label/input 및 모바일 status/고급조건의 동일행≤1px를 확인했다. 공정 toolbar 높이는390px284→216px,768/1024px152→124px,1440/1920px72→36px다. 첫 데이터 top은390px1440.5→1279.5px,1440px855.5→756.5px이며 모바일 데이터가 viewport 안에 전부 보인다는 뜻은 아니다. 기존 #798 E2E **1case PASS**는5root×5폭·coarse5root·keyboard/Escape·초안/활성 조건·원본 불변을 검증했다. 50관측을50개 테스트로 세지 않는다. 타입 검사·focused ESLint PASS. 현재 원격 전체 회귀·최종 QA는 NOT TESTED다.

### #827 로컬 직접 결과

[원본 manifest](evidence/issue-824/milestone-manifest.json)의 before10/after10(5폭×fine/coarse), capture faults0·start/end hash 일치와 document overflow0을 확인했다. 계층 조회와 전체 상태·관리를 이름 있는 두 section으로 구분하고 hairline/16px 간격을 사용한다. lower body16→14px·heading18→16px·fine button32→36px/coarse44px를 검증했다.

기존 #732 Target0·두 계층·전체 Gate·5폭 keyboard 실제 HTTP/SQLite E2E **1case PASS**(28.4초 case/57.3초 전체). 원본 Task/Assignment·단일 Gantt instance·조회 mutation0 단언을 유지했다. #827 source는 로컬 순차 commit `684c6b37`에 분리했다. 이후 source 변경에 대한 최종 회귀와 원격 전체 gate는 별도로 판정한다.

### #828 로컬 직접 결과

[원본 manifest](evidence/issue-824/resources-manifest.json)의 인증 전/개인/그룹/구성원/추가 dialog before50/after50(5폭×fine/coarse), capture faults0·sourceStable=true·문서 overflow0을 확인했다. synthetic 응답 제어 UI이며 실제 관리자 로그인·운영 목록 결과가 아니다. 인증 shell·H1은 KEEP이고 작업면 section heading17.6→16px, 검색16px/38.78px→14px/40px(coarse44px), 보이는 label13px·목록 padding16→12px를 정돈했다. dialog 입력/명령44px·개인/그룹 표976/800px·역할/비활성/삭제 불가 구분은 보존한다. 같은1440px 첫 데이터 top516.265625→485.875px다.

기존 `resource-tabs.spec.ts` 탭·scroll·구성원 초안/keyboard, profile403/pending/Escape,5폭 표·모달·footer/focus geometry의 **고유3case PASS**. 같은 after case의 반복 실행은 합산하지 않는다. 제품/기존 테스트는 로컬 순차 commit `733b6daf`에 분리했다. 실제 세션 분리/권한은 위 SQLite2case와 별도이며 원격 Full 회귀·최종 QA는 NOT TESTED다.

### #829 로컬 직접 결과

[원본 manifest](evidence/issue-824/project-master-manifest.json)의4관점×5폭×fine/coarse before40/after40, capture faults0·sourceStable/collectorStable=true·문서 overflow0을 확인했다.3물류 master의 반복 물류 구성/Gantt 독립 헤더를 제거하고 기존 도움말은 toolbar로 이동, readonly/권한 안내·실제 상단 명령 이름을 유지했다. section16/body14/보조13·관리40/coarse44와 프로젝트 리소스 참여검색40/dialog44를 구분한다. 변경은 로컬 순차 commit `fd042c14`에 분리했다.

기존 shell/modal5폭, readonly·공정 pending401/412, membership readonly/stale/등록과 coarse의 **고유6 UI case PASS**다. 응답 제어 UI와 별개로 실제 HTTP/SQLite `issue-762-process-workareas.spec.ts`의 공정0..N구역 CRUD·5폭/readonly·프로세스 재시작 지속성 **1case PASS**(41.6초 case/1.2분 전체)를 확인했다. 실제 HTTP와 UI의 반복 실행을 합산하지 않는다. 변경 영역 ESLint0error·host 기존 router warning1. 원본 수량/여러 구역/시스템 직접·조율·참여등록과 개인배정 의미는 변경하지 않았으며 원격 Full 검증은 NOT TESTED다.

### #830 로컬 직접 결과

[원본 manifest](evidence/issue-824/global-master-manifest.json)의 인증2/물류2/마스터3/관계8영역×5폭×fine/coarse before80/after80, capture faults0·sourceStable=true·문서 overflow0을 확인했다. 물류 본문16→14px·입력14.4px/38px→14px/40px로 정돈했다. Project Master 품목은 기존 fine14px/40px·heading16px·column budget을 KEEP하고 coarse40→44px만 보완했다. auth shell 제한은 유지한다.

관계 장문200자 synthetic fixture에서 표가390px viewport의3169.5px에서680px로 줄고,1440px에서는 owner와같은1358px다. 마지막 action열130px·이름 wrap·표 소유 scroll을 사용하고 관계 해제 버튼은 fine40/coarse44px를 유지한다. 이름/코드·관계 및 handler는 변경하지 않았다.

기존 #454 두 유형5폭·모달/native focus, #455 세 범주5폭·모달/native focus, #538 관계 두 단계 해제·장문5폭/정렬·마지막 action native Tab·outline3px 여유의 **직접3case PASS**를 원본 stdout에서 확인했다. 추가 유형 CRUD/If-Match·pending/Escape·loading/error/0·master 초안 CRUD/password pending5case의 실제 원본 stdout을 검증했다. 직접3case와 합쳐 고유8case이며 이후 강화한 #538 동일case를 추가 합산하지 않는다. source는 로컬 순차 commit `c577dd00`다. 실제 운영/음성AT·원격 전체 및 최종 인간 QA는 NOT TESTED다.

## 사전검토 지적과 교정 추적

- F824-001 / #826 / P2: 첫 after source에서390px 작업 상태 입력과 인접 `필터·조회 구성` 버튼의 top/bottom이12px 어긋남. 별도 ui_ux가 제공된 실제 geometry·equipment/resource1440/390 캡처와 source를 읽기 전용으로 비교해 발견했다. 데스크톱 수평 label·36px는 설계 부합이지만 모바일 동일행≤1px AC는 REWORK다. 구현자는 모바일 정렬과 기존 E2E 단언을 보완하고 최초 after와 교정 source 증거를 구분한다. 최종 after50 및 모바일 동일행≤1px 단언을 포함한 기존 #798 E2E 재검증 PASS. 최초 실패 source와 최종 source는 별도 압축 원본으로 보존한다.

- F824-002 / #826 / ENVIRONMENT: 최초 #798 직접 E2E는 보존용3199 fixture에 `PLAYWRIGHT_BASE_URL`을 지정해 재seed한 BU code 충돌400으로 제품/신규 단언 실행 전에 FAIL했다. 원본 stdout/trace는 `output/playwright/issue-824/wbs/e2e-attempt1-fixture-conflict/`에 보존한다. API guard·fixture source를 완화하지 않고 정식 isolatedApplication의 새 DB에서 같은 case를 실행한다. 새 격리 DB의 동일 #798 case PASS(1.7분 case/2.4분 전체). 최초 실패를 덮지 않는다.

- F824-003 / #829 / ENVIRONMENT: 최초 baseline selector는 계속 mounted 상태인 비활성 일정 pane의 inert/aria-hidden을 제외하지 않아 두 pane에 매칭됐다. 0sample/8fault의 strict-mode 도구 실패이며 제품/업무 시나리오 실패가 아니다. active panel ID로 collector를 교정하고 before40을 다시 확보했다. 원본을 `project-master/before-attempt1-selector-fail`에 보존한다.
- F824-004 / #829 / P2: 최초 after에서 고급 summary의 coarse target이40px였다.44px로 보정한 최종 after40 및 직접 상태 시나리오를 검증했고 최초 값을 별도 보존한다.
- F824-005 / #828 / P2: 추가된 구성원 검색의 보이는 label `구성원 검색`이 기존 접근성 이름 `그룹명 구성원 리소스 검색`에 연속해서 포함되지 않았다. 별도 qa_docs source 검토가 [WCAG 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)의 label-in-name 차이를 확인했다. 보이는 label을 `구성원 리소스 검색`으로 맞추어 기존 접근성 이름·그룹 문맥·동작을 보존하고 기존 시나리오에 단언을 보강한다. 실제 음성 AT 검증은 NOT TESTED다. 보이는 label 교정 뒤 members5폭×fine/coarse10관측(sourceStable=true)과 기존 #453 fine5폭 geometry/접근성 이름 단언1case PASS(8.1초 case/9.6초 전체). 해당 시도의 E2E coarse 블록은 F824-008에 따라 미실행으로 정정한다. 이전3개 고유case 중 같은 geometry case의 재실행이므로 고유case를 추가 합산하지 않는다.

- F824-006 / #829 / P2: 추가 coarse 단언에서 참여관리 호스트의 `작업 일정에서 배정 관리` gateway가40px로 남아 있음을 발견했다. 첫 상태 선별5case는4 PASS/1 FAIL이며 이 실패는 제품 target 편차다. 호스트의 해당 gateway에만 local CSS class로 coarse44px를 연결하고 React 동작/Task·Gantt 경계를 유지한다. 기존4case와 실패 원본을 보존하고 교정 case·최종40관측에서44px를 재검증했다.

- F824-007 / #827 / ENVIRONMENT: 추가 하단 경계 캡처의 최초 window scroll은 실제 panel scroll owner를 움직이지 않아 하단이 보이지 않았다. 기존 geometry/업무 테스트와 별개인 캡처 도구 범위 오류다. 실제 panel의 scroll owner를 사용한 보정 대표 캡처와 원본을 구분하며 canonical fingerprint 불변을 확인한다. 보정 캡처 완료 전 하단 육안 검증을 PASS로 주장하지 않는다.

- F824-008 / #828 / TEST: 최종 typecheck에서 `resource-tabs.spec.ts:214`의 `browser` 미정의 TS2304와 파생 implicit-any6건이 FAIL했다. 새 coarse 검증 블록이 browser fixture를 받는 after case가 아니라 다음 동적 생성 취소 case에 들어가 있었다. 앞선 after E2E PASS는 fine5폭·label/geometry 범위이며 그 coarse 블록은 미실행이었으므로 E2E coarse 주장은 철회한다. 별도 CLI의 실제 coarse 실측은 그대로 유효하다. 제품 변경 없이 올바른 after case로 블록12줄을 이동한 `74ce0634`에서 동일 case의 실제 coarse2탭 검증 PASS(11.4초 case/12.6초 전체)와 전체 typecheck exit0 PASS를 확인했다. 원본 typecheck FAIL은 보존한다.

- F824-009 / #830 / PRODUCT P2: 최종 coarse390 관계 nativeTab 캡처에서 하단 focus ring이 이미지 끝까지 이어졌다. 별도 qa_docs의 PNG 원본/픽셀 비교는 fine390의 닫힌 하단 곡선과 차이를 확인했다. 기존 `nativeFocus.contained`는 좌우 경계만 검사했고 control rect/environment는 focus 전 수치이므로 상하 focus clipping0 근거로 사용하지 않는다. 4point 진단은 coarse390에서 실제 nativeTab 후 button top855.671875/bottom899.671875px·height44px, outline3px+offset3px의 outer bottom905.671875px를 측정했다. viewport900px의 하단5.671875px clipping이 immediate/2RAF 이후에도 같아 실제 제품 FAIL이다. 다른3표본은 PASS, box shadow/ancestor Y clip은 없었다. `final-runtime/focus-visibility-before/receipt.json`의0fault/sourceStable=true는 유효한 FAIL 수집을 뜻하며 총괄 exit1/FAIL을 보존한다. 관계 row action에만 scroll-margin-block8px를 적용하고 기존 nativeTab 시험에 viewport·모든 clip ancestor의 양축/전체 outline 경계를 보강한 뒤 재검증한다. 원본22표본의 범위는 당시 source/version·일반 geometry 및 수평 focus로 한정한다. 교정 `scroll-margin-block:8px` 뒤 coarse390 button bottom891.671875px·outer bottom897.671875px로 viewport 안2.328125px 여유를 확보했다. 실제 nativeTab/outline3+offset3·44px를 유지한4point의 viewport/모든 clip ancestor 양축은 immediate/2RAF 모두 PASS다. 기존 #538 기능 case의 fine5폭·coarse390/1440 및 전체 초점선 검사1case PASS(3.2초 case/4.0초 전체), 같은 고유case 재실행으로 합산하지 않는다. RED와 PASS는 [진단 manifest](evidence/issue-824/focus-visibility-manifest.json)로 구분한다. 교정 source의 새22표본·build/typecheck/focused lint도 PASS이며 아래 최종 영수증을 따른다.

- F824-010 / 최종 실측 / ENVIRONMENT: CLI 재시작 후 이전 synthetic project edit cookie가 없어 최초 재측정 준비가 BLOCKED됐다. 인증 요청에 `password` 필드를 사용해400이었으며 실제 계약의 `editPassword`로204 세션을 복원했다. 제품/API/guard를 변경하지 않고 실패한 준비 로그·부분 관측과 최종 `after-final136-focusfix2*`22표본을 분리했다. 비밀번호/쿠키 값은 게시 증거에 포함하지 않는다.

## 최종 로컬 실행 영수증

- [단계별 명령·stdout SHA·고유case](evidence/issue-824/phase-command-receipts.json): 고유 Chromium20case = #8261 + #8271 + #8283 + #8297 + #8308. 실제 HTTP/SQLite3case와 응답 제어 UI17case를 구분한다. 반복 #453/#538의 재검증을 고유case에 더하지 않는다. 별도 실제 SQLite 서비스/handler2case는 앞서 기록했다. 일부 원본 stdout은 원래 tool result에서 정확히 재구성한 영수증으로 표시했으며 원래 redirected stdout과 구분한다.
- [최종22표본 manifest](evidence/issue-824/final-runtime-manifest.json), [요약](evidence/issue-824/final-runtime-summary.json): WBS5소비자1440px×fine/coarse10, KPI390/1440px×fine/coarse4, Milestone 실제 scroll-owner 경계4, 관계 실제 nativeTab4다. DOM v0.135.6·Next16.4.2·Playwright1.63.0·Headless Chromium153, locale ko-KR/timezone Asia/Seoul·DPR1/visual scale1·root font16px를 기록했다. 제품/collector source start=end·fault0·문서 overflow0이며 project3그룹 canonical revision17/fingerprint `c0506d05699ad2ba6b68c36ccf4dab3be030ff47e02cb6e553c822624f0df2a7`가 전후 같았다.
- [최종 build/type/lint](evidence/issue-824/final-fast-validation.json): 새 source의 production build39.441초/typecheck23.528초/focused ESLint11.457초 모두 exit0·PASS. 수정된 product17+기존E2E8+collector1+package/lock2,28파일의 SHA256 start=end/current를 검증한다. 기존 router warning1은 유지한다. 이는28파일의 동결 범위이며 Manager 문서·Next 생성물까지 포함한 whole-Git sourceStable 선언이 아니다.
- [F824-009 집약 영수증](evidence/issue-824/focusfix-result.json)과 [FAIL/PASS 진단](evidence/issue-824/focus-visibility-manifest.json)은 최초 수평 focus 검사와 새 전체 outline/viewport·clip ancestor 양축 검사의 차이를 보존한다. 기존44px 버튼·outline을 축소해 통과시키지 않았다.
- [서버·CLI 정리](evidence/issue-824/cleanup.json): 본 작업 세션과 loopback3199만 종료·포트 미점유를 확인했다. 실제 운영 서버/DB는 사용하지 않았다. 기존 E2E가 갱신한 tracked 역사적 산출물114개는 task-local 원본/해시를 보존한 뒤 baseline으로 복원했다. Next 생성 AGENTS.md·tsconfig.json2파일도 별도 보존 후 baseline으로 복원했으며 복원 후 typecheck PASS다. raw runtime 로그/trace ZIP/DB/쿠키는 Git에 저장하지 않는다.

### AC별 Local 실행 범위와 남은 gate

| Issue | Local 실행 근거 | 부분 검증 경계 |
| --- | --- | --- |
| #826 | AC1~4:5소비자 밀도/정렬·typography·구성/현재 경로·조건 보존; AC5:장문 fixture/keyboard·coarse 실측 | AC5의 모든 오류/pending 조합은 로컬 전체 실행이 아니며 새 Full CI의 기존 상태 시나리오가 필요 |
| #827 | AC1~4:명명 구획·위계·독립 모집단·Target0/Gate/원본/Gantt; AC5:선별 실제 시나리오·대표 boundary | AC5의 빈/readonly/동명·stale/오류 전체 matrix는 새 Full/최종 QA에서 판정 |
| #828 | AC1~4:인증 전/후 synthetic inventory·표 budget·검색 label/초안·fine/coarse; AC5:UI3case+별도 실제 세션 분리2case | mock 인증/CRUD는 실제 운영 인증이 아님. 나머지401/412·재시도 시나리오와 실제 서비스 회귀는 새 Full에서 확인 |
| #829 | AC1~3:4관점 폭/표/헤더·실제 공정/구역CRUD·활성/미연결; AC4~5:참여/배정 구분·UI6case/실HTTP1case | 설비 수량/시스템 직접·조율 producer는 source 불변이며 전체 기존 domain/API 회귀는 새 Full에서 확인 |
| #830 | AC1~4:8영역 inventory·typography/열 예산·긴 이름/표 소유 scroll·전체 focus 양축; AC5:UI CRUD/오류/관계8case와 실제 세션 분리 | Logistics/Master의 실제 HTTP401/412 직접 로컬 검증은 미실행. 서비스/DB 분리·UI 응답 제어와 구분하며 새 Full/최종 인간 QA 필요 |

[별도 qa_docs PRE_QA](evidence/issue-824/pre-qa.json)는 PASS/미해결 P1/P2=0이다.28파일 정규화 지문 `32231e165187eec1d7da4b2f18ece639e7f04bdb865056e1a7f23a84e6c4f38b`와 최종 원본/영수증·25AC를 읽기 전용으로 독립 검산했다. 현재 로컬 증거를 각25개 AC의 최종 ACCEPT나 Required3·Trusted PASS로 격상하지 않는다. 구현자와 별도 ui_ux/qa_docs의 사전검토는 실제 인간 QA_FINAL 또는 Owner Manager receipt가 아니다.

[최초 CLI 환경 BLOCKED](evidence/issue-824/initial-cli-environment.json)는 CLI 기본 Chromium1247 미설치로 발생했다. 제품/CI를 바꾸지 않고 이미 설치된 Chromium1243을 명시해 실행했다. 저장소 Playwright1.63.0의 browsers.json은1243/Chrome153.0.8010.12를 지정한다. 실제 runtime/명령을 기록했으며 이 로컬 실행을 독립 GitHub runner·headless-shell 환경과 같다고 주장하지 않는다.

### Local Pre-PR 자동 선정과 공식 CI의 구분

[Pre-PR dry-run 원본](evidence/issue-824/prepr-dry-run.json)은 명령 `npm run verify:prepr -- --mode=fast --base=origin/main --risk=HIGH --issue=824 --dry-run`의 `NOT TESTED` 결과다. 실제 테스트를 실행하지 않았고 producer→consumer 자동 매핑7경로 UNKNOWN으로 selection=BLOCKED다. 이 결과를 PASS로 바꾸거나 자동 정책을 수정하지 않는다. 본 문서의25AC 수동 매핑·20고유 직접 실행·새 source의 build/type/lint 영수증은 해당 도구 PASS와 별도이며 공식 전체 회귀는 새 PR의 기존 Full8/Required3로 검증한다. 당시 변경 파일111개를 대상으로 한 로컬 문서/AC 구조 검사는 risk_floor=HIGH·protected package/lock2개, DOC_SYNC=STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING/AC_MAPPING_PASS_SEMANTIC_REVIEW_PENDING이다. 구조 검사를 의미·업무 QA/인간 승인으로 확대하지 않는다.

## 환경별 별도 미검증

63km 실프로젝트·운영 관리자 목록, 실제 reverse proxy/TLS/storage, native125%·실기기·screen reader는 NOT TESTED다. synthetic fixture·Chromium·GitHub Actions로 이 환경별 결과를 대체하지 않으며 #517의 별도 검증을 유지한다.
