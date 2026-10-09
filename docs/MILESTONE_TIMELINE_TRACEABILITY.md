# Milestone Timeline 수용 기준과 검증 추적

Epic [#548](https://github.com/planner77/masterGantt/issues/548), MT1–MT5 [#549](https://github.com/planner77/masterGantt/issues/549)–[#553](https://github.com/planner77/masterGantt/issues/553)의 구현·문서·환경별 증거를 연결한다. 사용자 요청 종료점은 각 PR의 exact-head CI 등록이다. 아래 등록은 `quality/e2e/docker` 성공이나 main 통합·정식 release·Epic 완료를 뜻하지 않는다. 모든 공식 원격 결과와 QA_FINAL/Manager ACCEPT는 NOT TESTED다.

## 선행 PR과 실행 등록

| Issue | PR / 정확한 head | CI 등록 / 검증 범위 |
| --- | --- | --- |
| #549 | [PR557](https://github.com/planner77/masterGantt/pull/557), `4bc4c31d9c5f46d90a83cbe4de878a52a2f2529b` | [37795569338 / #2210.1](https://github.com/planner77/masterGantt/actions/runs/37795569338), 공식 결과 NOT TESTED |
| #550 | [PR559](https://github.com/planner77/masterGantt/pull/559), `31345da9346dfbdc1ac02e4e7ca567edafec775f` | [37806909407 / #2216.1](https://github.com/planner77/masterGantt/actions/runs/37806909407), 공식 결과 NOT TESTED |
| #551 | [PR560](https://github.com/planner77/masterGantt/pull/560), `fb6e5a634b3fcd70d62d4e8404a42cefe0ab6ce9` | [37821023371 / #2217.1](https://github.com/planner77/masterGantt/actions/runs/37821023371), 공식 결과 NOT TESTED |
| #552 | [PR561](https://github.com/planner77/masterGantt/pull/561), `fed88f5e00e104a35cca44c342005bfe8fd04f4e` | [37839172928 / #2219.1](https://github.com/planner77/masterGantt/actions/runs/37839172928), 공식 결과 NOT TESTED |
| #553 | #552 exact head 기반 후보, PR/새 head는 원격 게시 후 Issue STATUS에 기록 | 현재 PR CI 등록 NOT TESTED; 아래 MT5 로컬 결과와 분리 |

선행 PR은 stacked base를 사용한다. 최신 main `3b9aea97aa885c5ecbf430f39b72ba722bbcf408`의 별도 #487/#558 CI 수정은 확인했으며 #553 제품 stack에 합치지 않았다. 선행 main 통합이 미완료이므로 기능의 main 활성화를 주장하지 않는다.

## MT1–MT4 보호 대상

| 단계 / 수용 기준 | 코드·테스트 / 정확한 로컬 증거 | 문서 / 남은 경계 |
| --- | --- | --- |
| MT1: canonical·WBS·Timeline·preference·조회 선택 분리, 단일 설치버전 adapter | #549 직접 Unit72·Core Chromium9/9; [실행 계획](exec-plans/active/ISSUE_549.md) | [Timeline](MILESTONE_TIMELINE.md), [Architecture](ARCHITECTURE.md); 새 표시 활성화는 후속 단계 |
| MT2: 날짜순 Dashboard 독립 관리·root M 생성·같은 Editor·소속/관계·readonly·삭제 취소 focus | #550 Unit88·synthetic UI19/19, 이전 source 실제 HTTP2/2의 제한 재사용 근거; [실행 계획](exec-plans/active/ISSUE_550.md) | [Project UX](PROJECT_UX.md), [Task Editor](TASK_EDITOR.md), [Task Relations](TASK_RELATIONS.md); 실제 HTTP를 최신 source 재실행으로 확대하지 않음 |
| MT3: 앱 소유 lane·같은 날짜 묶음·월요일 ISO Week·geometry·same instance | #551 동일 source UI17/17(46.4초), Unit29; [실행 계약](../output/playwright/issue-551/review-selected/execution-contract.json) | [Timeline](MILESTONE_TIMELINE.md); 5폭×Day/Week10 geometry ±1px, rows0.5px. 선택 집합 강조는 선택적 미구현; 173년 축 성능 NOT TESTED |
| MT4: WBS M 행 제외·기본 ON 독립 설정·legacy 조건·native selection·canonical 구조 명령·date/peer 복귀 | #552 최신 UI44/44(2.6분), source125 drift0; actual HTTP run6 3/3(57.1초), source405 drift0; Unit56 pure dependency 불변 제한 재사용; [실행 계약](../output/playwright/issue-552/review-selected/execution-contract.json) | [Requirements](REQUIREMENTS.md), [Timeline](MILESTONE_TIMELINE.md), [Test Plan](TEST_PLAN.md); Dashboard hidden paint의 실제 결함/수정 및 최초 FAIL 보존. 전체 Task drag/resize/Dependency/clipboard 및 production·보조기기 NOT TESTED |

## MT5 수용 기준별 연결

아래 항목은 구현 후 로컬 증거와 문서 동기화를 연결한다. 독립 PRE_QA와 원격 등록의 최종 기록은 Issue STATUS에 남긴다. 선행 증거 재사용은 직접 관련 제품·테스트·의존 파일 SHA와 영향 분석을 함께 기록한다. 착수 시 #552 최종 source125와 #553의 차이는 공통 export 안내 파일1개뿐이다. 따라서 unchanged Timeline/Core geometry는 #552 최신44case의 해당 보호 범위로 제한 재사용할 수 있으며 새 dialog/변경한 기존 spec의 fresh 실행을 대체하지 않는다. #551 source10 중6개는 #552에서 바뀌었으므로 #551 직접 실행은 역사적 근거이며 현재 geometry는 대응되는 #552 최신 검증에 연결한다. 문서 존재나 Agent 자체 PASS는 공식 회귀 성공이 아니다.

| #553 수용 기준 | 담당·검증 방법 | 문서 / 현재 상태 |
| --- | --- | --- |
| AC1 조회/표시/필터 전후 revision·전체 원본·Summary·Gate·Resource/물류 불변 | frontend actual Core UI 저장 요청0·canonical before/after, backend 고정 fixture semantic projection | REQUIREMENTS/PROJECT_UX/MILESTONE_STAGE_GATES, Local PASS: UI 고유37·실제 HTTP3, 조회 mutation0과 전체 원본 비교 |
| AC2 명시 편집의 동일 canonical snapshot/revision 반영 | marker/cluster→같은 Editor 저장 및 목록/Timeline/작업 화면 고유 ID 비교 | TASK_EDITOR/MILESTONE_TIMELINE, Local PASS: 새 UI10의 marker/cluster 같은 Editor 저장·revision·고유 ID 비교 |
| AC3 JSON UUID/FK remap·Template·Project/subtree/multi-root Copy·Cut·실제 재시작 no-loss | 신규 integration13 PASS(1.58초), 실제 HTTP run4 3/3 PASS(1.3분), source408 drift0. 같은33Task/8Link/5명시소속·실제 Next 재시작 full snapshot/projection 비교 | [IMPORT_EXPORT](IMPORT_EXPORT.md)/[MILESTONE_STAGE_GATES](MILESTONE_STAGE_GATES.md)/[실행 계약](../output/playwright/issue-553/backend-http/execution-contract.json), Local PASS |
| AC4 기존 full export·layout·security·지원 한도·#529 보존 | Excel ZIP/OOXML·JSON·SVG 실제 산출물, UI4형식 요청·PNG/URL cleanup의 직접/재사용 경계 | EXCEL_EXPORT/IMAGE_EXPORT/MILESTONE_USER_GUIDE, Local PASS: integration13·모킹 없는 HTTP3의 실제4형식 다운로드 및 새 UI10의 안내/요청; 지원 밖 legacy는 fail-closed |
| AC5 scope/member/page/return·전체 E/P Ready | exact member IDs·Resource/M drill/복귀와 전체 Gate fixture | PROJECT_UX/MILESTONE_STAGE_GATES, Local PASS: Resource60 assignment/Task와 ancestor1 full projection·페이지10 복귀, 전체 Gate fixture; 가상 DOM subset과 전체 집합 구분 |
| AC6 5viewport 및 주요 표시/오류 UI·keyboard·geometry | 새 export notice 실제5폭·focus/overflow 및 선행551/552의 source 불변 제한 geometry 재사용 | TEST_PLAN/MILESTONE_USER_GUIDE, Local PASS: 5폭×4형식20 실제 안내/focus/overflow 관측·새 UI10, Core geometry는 #552 대응 case 제한 재사용 |
| AC7 기존 보호 대상 대체 추적, skip/삭제 금지 | 기존 테스트 diff·직접 대응 assertion 목록 및 최초 FAIL 유지 | TEST_PLAN/본 추적표, Local PASS: 기존10spec 이관·고유 legacy27와 서버 parent 거부 Unit6; 최초 FAIL 보존, 독립 검토 대기 |
| AC8 위치/토글/소속/관계/export 차이·제한 가이드 | frontend 새 scoped 사용자 가이드 및 형식별 계약 비교 | MILESTONE_USER_GUIDE/MILESTONE_TIMELINE/PROJECT_UX/IMPORT_EXPORT/EXCEL_EXPORT/IMAGE_EXPORT, DOCUMENTATION_SYNC PASS: 현재 형식·제한·pending/412 재시도와 실제 출력 의미 연결 |
| AC9 각 자식 AC↔test↔docs↔원격 exact head Epic 연결 | 본 표 및 Manager Epic STATUS, 원격 결과 미조회 | 본 추적표/active PLAN/각 Issue STATUS, 선행4 PR/head/run 연결; #553 exact head/run와 Epic STATUS는 원격 등록 후 기록 |
| AC10 작성자 분리 qa_docs·Manager 판정·위험 | DOCUMENTATION_SYNC PASS 후 독립 read-only PRE_QA | Issue553 Work Packet, DOCUMENTATION_SYNC PASS; 작성자와 별도 read-only PRE_QA 및 Manager 게시 GO는 Issue STATUS에 기록. QA_FINAL/ACCEPT NOT TESTED |

## 환경과 완료 경계

Local Fast Feedback와 공식 PR 회귀를 구분한다. Windows Excel/VBA/DRM, 실제 mobile/touch·screen reader, production reverse proxy/TLS/storage·off-host backup, 최종 수동 UX는 NOT TESTED다. 에뮬레이션이나 Next dev SQLite 재시작을 production/운영 PASS로 확대하지 않는다.

이번 범위에서 병합·main CI/GHCR·정식 version tag/Release·브랜치 정리·Issue 종료는 수행하지 않는다. `release_required=true`, `release_authorized=false`. #548 및 하위 Issue 종료는 전체 Lifecycle의 실제 승인·gate·cleanup 이후 별도로 판단한다.

## MT5 백엔드 실제 실행과 최초 실패

[백엔드 실행 계약](../output/playwright/issue-553/backend-http/execution-contract.json)은 최신 integration13/HTTP3·명령·시각·source408·원본 로그 SHA·선별4관측·teardown과 최초 실패를 기록한다. HTTP run4는 retry0, 2026-10-08T20:45:03.538818Z–20:46:41.394726Z, source SHA256 `17c687754e28db8541a171d175db9ba49e22d24db06d5fffa5de9c8bc139f010`이며 Manager도 현재408파일과의 동등성을 확인했다. Unit13은 마지막 HTTP-only 오류코드/session assertion 수정과 독립된 직접 파일·의존 불변 근거로 제한 재사용했다. 여러 run의 같은 case 통과를 합산하지 않는다.

Actual HTTP에서는 nonempty Resource/Group/Role/Assignment/Logistics의 같은 revision 원본 Excel·opt-in #529·JSON Resource/물류 제외, Import remap·Copy/Template/multi-root/Cut 및 모킹 없는 OFF/search/collapsed 네 형식 다운로드를 직접 확인했다. PNG signature·SVG 대응 dimensions·object URL cleanup·mutation0·same instance와 completed/mixed/session/revision 원자 거부를 비교했다. SQL trigger rollback은 별도 nativeSQLite service integration이며 HTTP fault injection이라고 안내하지 않는다. 다운로드 관측의 hash는 base64 bytes에 대한 logicalHash이고 관측 JSON 파일의 raw SHA256과 구분한다.

최초 실패의 import 경로·기본 휴일/비근무 시작·M-only Summary inclusive duration·기간 clip·allocationPercent CHECK 및 HTTP external-ID collision409→mixed422 실제 code→새Project 생성의 sessionbinding401을 보존한다. 서버 정책을 바꿔 기대값에 맞추지 않고 fixture·검증 분리·편집 세션 재설정으로 현행 계약을 확인했다. 로컬 lint/중간 typecheck PASS와 frontend 전체 UI 종료 뒤의 최종 global typecheck를 분리한다.

## MT5 UI 실행, 재사용과 문서 동기화

[UI 실행 계약](../output/playwright/issue-553/frontend/review-selected/execution-contract.json)에 고유 UI37개를 기록한다. 새 UI10(29.0초)과 기존 보호27개(불변 실행 경로14·fresh #464 1·최신 알림12)의 합이며 반복 실행은 중복 합산하지 않는다. 기존 서버 parent 거부 Unit6(419ms, CLI 제외15)과 백엔드 신규 integration13/실제 HTTP3은 별도다. 새 UI10의 source397 SHA256 `d0ace1d5dd0eccfca7865ecd997d3961c7d41303a3fc0107da293dd884e18be7` 이후 바뀐 두 기존 spec은 새 UI에 import되지 않아 직접 의존 불변으로 제한 재사용했다. 전체37을 하나의 최신 source에서 모두 재실행했다고 해석하지 않는다.

새 UI는 synthetic route와 실제 기존 pure export builder를 사용한다. 실제 SQLite·모킹 없는 브라우저 다운로드는 백엔드 HTTP3 증거에만 연결한다. Resource 전체61개 projection과 가상 DOM subset을 분리하고, 원래 trigger가 focus 순간 connected=true/disabled=true인 경우 기존 Resource tab fallback을 직접 기록했다. 단일 marker의 이름·날짜·ID·상태·keyboard ring/hit과 같은 Editor 저장을 확인했다.

최초 새 UI7/3·8/2·9/1 실패는 synthetic full Gate/membership 응답, Task status fixture, 실제 keyboard focus 및 숨긴 패널/disabled trigger의 검증을 수정한 뒤10/10으로 이어졌다. 잘못된 Project planned 값을 Task에 적용한 fixture 실행은 유효 증거로 사용하지 않는다. 기존24/3 실패 뒤 가상 Summary의 full projection/selection/viewport를 검증하고 #464를 재실행했다. 알림 error8회는 canonical queue 완료와 mutation0을 보존했다. 성공 생성 후 높이568→540 차이는 기존 clipboard scope 안내의 실제20px+상하 margin4px씩=28px와 Task+1/revision+1로 증명했다. 임의 허용오차를 추가하지 않고 성공 이후 새 baseline에서 알림/닫기/복사/타이머 geometry를 정확 비교했다. 마지막 해당 case1/1 PASS10.0초이며 이전 알림11/12 PASS와 합쳐 고유12다.

frontend가 서버 종료 후 Next 설정2개와 과거 #461/#464 산출물7개를 exact parent로 복원했다. 중간 설정 복원 뒤 백엔드 typecheck와 최종 복원 뒤 전체 typecheck를 별개 실제 실행으로 기록한다. 변경13파일 lint warnings0·최종 typecheck·문서 링크160파일·diff check PASS. 최초 문서 링크 FAIL 뒤 누락된 추적 문서가 준비된 재검사 PASS도 유지한다.

DOCUMENTATION_SYNC는 backend4문서, frontend8문서/README, Manager CHANGELOG·PLAN·Packet·본 표를 반영했다. API/DB/schema/domain/security/CI/배포 계약의 N/A 근거는 [Work Packet](exec-plans/active/ISSUE_553.md)에 있다. 독립 검토와 원격 exact head 증거는 게시 후 Issue STATUS에서 확인하며 이 문서 자체의 존재를 QA/CI PASS로 사용하지 않는다.
