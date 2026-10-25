# Issue #799 — 대시보드 지표 표시 인벤토리와 검증

## 기준과 판정 방법

main `fcd1ae59d268efa1913f4de625a9013cabd1de4a`(앱0.133.0, #798 포함)에서 시작한다. #799 후보는 PATCH0.133.1이며 의존성은 같다. 같은 Project/서버 snapshot·관측 fixture를 사용해 KPI+5개 동적 관점을390/768/1024/1440/1920px에서 비교한다. 구체 source·도구 hash·환경·실제 측정은 실행 영수증으로 고정한다. 아래 인벤토리는 소스·read-only 설계와 실제 before/after 관측을 연결한다. 표현 변경·로컬 실행과 공식 원격/최종 QA 판정은 구분한다.

[Work Packet](exec-plans/active/ISSUE_799.md)의 승인 범위는 PR CI 시작까지다. 전체 상태×5폭이나 실제 기기·운영 검증을 완료했다고 해석하지 않는다.

실제 before/after 런타임은 모두 version-only PATCH가 적용된0.133.1이다. before 제품 표시 CSS는 baseline main과 같으며, main의0.133.0을 실제 캡처 버전으로 표시하지 않는다. working tree 제품 지문은 캡처별 manifest에 별도로 기록한다.

## 6관점 표현 인벤토리

| 관점·소스 | 제목·기간/분모 | 값·단위·상태 | 행동·행/표·고급 정보 | 판정 |
| --- | --- | --- | --- | --- |
| KPI · `project-logistics-dashboard.tsx/.module.css` | 현재 조회 기간·분모와 기존 KPI 네 카드; 전체 Project 참고 구분 | 진척·건수·공수·단위, 품질 상태색과 미산정 | 기존 세부표·진단·정확 원본 drill·quality pane | KEEP; geometry·기능 대조군. 신규 요약 grid N/A |
| Milestone · `milestones/milestone-wbs-dashboard.tsx` | 선택 작업 고유 총계와 전체 멤버·직접 선행 Gate 분리; 기준일 | Task·Assignment 건, 진척%, M/D·M/M, 개인 미배정·물류 미연결·공수 미설정, Ready/Blocked/Completed | 공통 계층 표·전체 Gate disclosure·원본 일정/상태; 아래 전체 상태·관리의 별도 검색/표 | 동적 `.summary` 위계 FIX; 기존 관리 카드·전체 상태 표·관리 행동 KEEP |
| 공정&WorkArea · `process-workarea-dashboard.tsx` | 등록 구성 참고 vs 현재 필터된 작업; 관련 구역 소계 비가산 | 공정/WorkArea/설비 관리단위 개·원본 대·System 식; Task 건·진척%·계획공수·0/미연결 | 기존 계층 표·구성/구역·Coverage·전체 Gate disclosure·원본 drill | 동적 `.summary` 위계 FIX; 모집단·계산·표·진단 KEEP |
| 설비 · `equipment-dashboard.tsx` | 구성 참고 vs 필터된 고유 작업; 전체 등록 진단 별도 | 관리단위 개·원본 대·작업0·비활성, Task·진척·공수·미산정 | 원본 이름/유형·단품/Fleet·Owner·실제 controls·진단·전체 Gate·정확 drill | 동적 `.summary` 위계 FIX; metadata·표·원본 행동 KEEP |
| 물류 시스템 · `system-dashboard.tsx` | 구성 참고 vs 필터된 작업; 직접/조율/이전 전체·프로젝트 공통 범위 유지 | 등록 식·제어 설비 개/대, Task 건·진척·계획공수·공수 미설정 | 속성/제어/조율 원본·진단·전체 Gate·정확 drill; 속성 초안/toolbar | 동적 `.summary` 위계 FIX; mode·초안·toolbar·표 KEEP |
| 리소스 · `resource-wbs-dashboard.tsx` | 등록·역할·Project 개인 배정 참고 vs 필터된 Task/개인 Assignment; 기존 Plan 전체 Capacity 분리 | 등록/등록만/역할만/배정 인원, Task·Assignment 건·선택 배정·M/D/M/M·미산정/부분합 | 참여 원본·전체 Gate·정확 Assignment/Task drill·Excel current/project·기존 Resource Plan matrix | 동적 `.summary` 위계 FIX; 기존 Resource KPI·Plan·Capacity·matrix KEEP |

모든 FIX는 원래 label·값·단위·상태문과순서를 보존한다. 상태색만으로 의미를 전달하지 않으며 완료/지연 혼합 숫자에 하나의 실패색을 적용하지 않는다. `할당 없음`·`산정 불가 · 공수 미설정`·`—`·`알려진 부분합`·`환산 기준 미설정`을0으로 바꾸지 않는다.

## 설계 판정

기존5개 소비자와 공통 renderer의 소비자 미지정 기본 고유 총계 fallback이 공유하는 `.summary`만 수정한다. fallback도 기존 값·단위의 표시만 영향받으며 #730의 인접 회귀 범위로 분류한다. 의미별 flat 구획, label/value 대비, tabular 숫자·단위와 자연 줄바꿈, 분모 안내를 유지한다. 새 primitive·카드·폰트·테마·전역 button/control 규칙을 추가하지 않는다. #798 제어 영역과 표 열 budget·owner scroll·popover/dialog 소유권은 보존한다.

Design Delta B: `DESIGN.md`의 Flat surfaces·Data-dense·Typography·정확 상태/범위·KPI 내부 참조를 구체화한다. 신규 공통 원칙은 없으므로 DESIGN.md N/A. UI/UX Pro Max의 일반 숫자 권고는 원래 지표의 축약/계산 변경 근거로 채택하지 않는다. read-only 설계 담당은 `/root/metrics_design`이며 같은 크기의 label/value가 확인된 before를 근거로 label13px muted·value18px/600/tabular·gap8/16의 표시만 변경했다. 기존 intrinsic flex-wrap과 숫자·단위의 자연 폭을 유지한다.

## 최종 로컬 관측과 동등성

[비교 JSON](../output/playwright/issue-799/comparison.json), [before manifest](../output/playwright/issue-799/before/dashboards-manifest.json), [after manifest](../output/playwright/issue-799/after/dashboards-manifest.json)을 연결한다. 표준30쌍은 같은 fixture·권한·viewport에서 촬영했다. 실제 source는 미커밋 working tree의 파일별 지문으로 고정하며 manifest의 checkout HEAD를 최종 제품 commit으로 오인하지 않는다. 최종 CSS SHA256은 `78a76f5c98a99d4a91cf5994f6a89310c4d9441e7b922d92eb1ed73e0d71eaf5`다.

환경은 Node22·Next16.4.2·Playwright1.63.0, Chromium executable1243(실제 browserVersion은 관측별 JSON), `ko-KR`/`Asia/Seoul`·DPR1·높이900px·zoom100%, 격리 loopback HTTP/SQLite dev webpack이다. CI가 설치하는 browser revision과의 동일성·production/운영·native125%는 NOT TESTED다. before/after 모두 런타임0.133.1이며 실제1차 before의 제품 CSS는 main과 같다.

- before30/30·after30/30, fault0·document overflow0. KPI5쌍의 primary geometry 완전 일치, 동적25쌍 첫 요약Y 불변·표Y1.5~89px 앞당김·후퇴0.
- 30쌍의 표시값 순서·단위는 동등하며, 동적25쌍의 report snapshot/spec/filter/totals는 동등하다. KPI5쌍은 WBS report가 없는 별도 소비자이므로 해당 query 비교에 포함하지 않는다. 독립 exact read-only query5종의 full raw Task/Assignment·전체 Gate·구성/metadata도 전후 정확히 일치했다.
- canonical revision17·Task4·Assignment1, fingerprint `1dd5a90c59bedb603a4c84a0b2b88053b83b0757b6d643aee1fd40fd875cc80d` 보존, 업무 mutation0. readonly POST report query와 업무 변경을 구분한다.
- 원래 표 rowCount와 지표 수는 보존한다. 첫 요약·표의 Y와 visible 값은 owner scroll을 움직이지 않은 기본 캡처 기준이며 모든 표가 fold 안에 들어왔다는 뜻은 아니다.

첫 표의 Y(before→after)는 CSS px이며 아래 표는 소수 둘째 자리로 표시한다. 원래 정밀도는 비교 JSON에 있다.

| 관점 | 390 | 768 | 1024 | 1440 | 1920 |
| --- | --- | --- | --- | --- | --- |
| KPI (KEEP) | 1793.39→1793.39 | 1720.39→1720.39 | 1089.39→1089.39 | 834.39→834.39 | 834.39→834.39 |
| Milestone | 1177.00→1100.50 | 847.00→840.00 | 799.00→733.50 | 655.00→653.50 | 655.00→653.50 |
| 공정&WorkArea | 1570.39→1481.39 | 1176.39→1162.39 | 1043.39→976.39 | 899.39→896.39 | 899.39→896.39 |
| 설비 | 1363.39→1279.89 | 948.39→939.89 | 900.39→833.39 | 735.39→732.39 | 735.39→732.39 |
| 물류 시스템 | 1404.39→1384.89 | 1095.39→1086.89 | 983.39→980.39 | 903.39→900.39 | 903.39→900.39 |
| 리소스 | 1673.00→1648.00 | 1185.00→1176.50 | 1116.00→1107.50 | 951.00→948.00 | 951.00→948.00 |

390px의 완전히 보이는 Milestone 지표는6/9→7/9이며 전체 지표9개는 유지한다.1440px의 지표 가시성은 KPI4/4·Milestone9/9·공정14/14·설비12/12·System11/11·Resource14/14로 전후 같다. 같은 폭의 보이는 표 데이터 행은 KPI0/1·Milestone2/2·공정0/3·설비1/3·System0/1·Resource0/2로 같으며, typography 개선을 가시 행 증가로 과장하지 않는다.

대표 화면: [설비1440 before](../output/playwright/issue-799/before/equipment-1440-viewport.png) / [after](../output/playwright/issue-799/after/equipment-1440-viewport.png), [Milestone390 before](../output/playwright/issue-799/before/milestone-390-viewport.png) / [after](../output/playwright/issue-799/after/milestone-390-viewport.png).

### 보조 자료의 PARTIAL과 별도 readonly 보완

[원래 before 보조6](../output/playwright/issue-799/before/metric-details.json)은 정상 완결했다. [원래 after 보조6](../output/playwright/issue-799/after/metric-details.json)은 KPI/Milestone/설비/System4 PASS·공정/Resource2 timeout으로 **PARTIAL**이다. 이 실행을6/6 PASS로 바꾸지 않는다.

[readonly 보완](../output/playwright/issue-799/after/read-only-supplement.json)은 빠진 두 관점의1440px 인벤토리·4PNG와 독립 exact-query5 full raw 응답을 별도 source-stable 실행에서 확보했다. report-ready를 확인하는 public readonly 수집이며 원래 editable 보조와 권한 조건이 다르다. 두 권한의 전역 header geometry를 같은 조건 before/after로 비교하지 않는다. 기본30쌍의 같은 권한 geometry·표시값 비교와 보조 raw5의 독립 동등성을 구분한다. 각 collector hash·실패 원문·source는 비교 JSON과 영수증에 보존한다.

### 상태·행동 검증과 미실행 범위

| 범위 | 실제 증거 | 한계 |
| --- | --- | --- |
| 긴 KO/EN·0/미산정·환산 기준 없음·기본 scope | 표준30쌍·원래 fixture·기존 소비자5폭 E2E | 모든 문구/상태×5폭 조합을 실행한 것은 아님 |
| 숫자/단위·긴 상태문·형제 침범 | 확장 helper의 실제 text Range containment·unit line1,5개 소비자5폭 | 원래 server fixture의 표현값 범위 |
|20자리 수량·긴 부분합·산정불가 | [독립 DOM stress6/6](evidence/issue-799/independent-dom-stress.json),390/1440 | 합성 DOM text 표시 검사;20자리 서버 저장·실제 partial 서버 fixture PASS가 아님 |
| 공수0/unknown/partial/empty | 기존 model/formatter Unit22 실행 범위 | model PASS를 browser PASS로 전용하지 않음 |
| 원본/Gate·Plan·Assignment·Excel·stale/error·readonly/응답 역전 | 기존 격리 Chromium7/7 | 전체 consumer의 모든 저장/경합 조합은 공식 Full CI 대상 |
| pointer/keyboard·accessible name·focus·owner scroll | 기존5폭 case·[독립 설비390/1440 spot-check](evidence/issue-799/independent-browser-spot-check.json)의 Help Enter/Escape/focus | 실제 터치 기기·screen reader·운영·native zoom NOT TESTED |
| 동명이인·loading·공통 fallback·그 외 교차 상태 | #717/#719/#730 등 기존 고유 회귀 KEEP_UNIQUE | 이번 로컬에서 모든 조합 신규 실행은 NOT TESTED; exact-head Full CI와 구분 |

## 로컬 검증·문서·원격 판정

[선택 Chromium 영수증](../output/playwright/issue-799/local-chromium.json)은 최종 source7/7 PASS·retry0/skip0/flaky0·300.117초다. #732~#736 기존 case를 확장했고 새 상시 E2E 파일/테스트 수는 추가하지 않았다. [Unit 결과](../output/playwright/issue-799/local-unit.json)는4파일22case PASS다. 정제 보고서는 원본 ignored 경로·hash·크기를 보존하고 runtime stdout/headers를 게시하지 않는다. 독립 qa_docs가 원본과 정제 결과·source7개를 재대조했다.

[Work Packet](exec-plans/active/ISSUE_799.md)에 최종 typecheck·선택 ESLint·문서 링크/구조·pre-PR 계획·독립 PRE_QA와 게시 증거를 기록한다. [누적 실패 원장](ISSUE_799_FAILURE_ANALYSIS.md)은 초기 실행 파일/seed·보조 timeout·SIGTERM/orphan CLI·인증 입력/공유 fixture 설정·동시 dev 서버·제외 grid·원래 after 보조 PARTIAL을 보존한다. 최종 성공 수에 이전 실패·중간 후보 PASS를 합산하지 않는다.

Design Delta B, DESIGN.md N/A다. 원격 exact-head Quality/E2E8/Docker·Trusted QA·AGENT 인간 QA_FINAL·Owner/Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED다. 사용자 지정 종료점은 Ready PR Full CI 등록이며 이후 모니터링·병합·Main/GHCR/정식 릴리스·Finalizer·정리·Issue 종료는 수행하지 않는다.
