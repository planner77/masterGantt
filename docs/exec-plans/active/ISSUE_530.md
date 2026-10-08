# Issue #530 Resource KPI 통합 회귀와 사용자 가이드

## 범위와 실행 기준

[Issue #530](https://github.com/planner77/masterGantt/issues/530)은 [Epic #522](https://github.com/planner77/masterGantt/issues/522)의 R8이다. #523~#529의 공통 집계 Domain, API, Dashboard, Milestone 비교, Resource Plan, 정확한 일정 이동, Excel을 같은 합성 데이터로 연결해 검증한다. 등록 당시의 등록-only 경계는 최신 사용자의 구현·문서·원격 게시·PR CI 시작 요청으로 전환했다.

- baseline main: `599b824677cec2daa47743a60fcac422297f925b`, tree `17f659167a0c73152a6d15b1ba46ccdf0a626ae7`.
- 작업 branch: `test/issue-530-resource-kpi-integration`, 격리 clone `/tmp/mastergantt-issue530`.
- 착수 application은 `0.102.0`이다. 실제 일정 왕복의 viewport 결함을 확인해 최소 제품 수정과 PATCH로 범위를 보완한다. 확인한 최신 main `dca2f7821f277ef31ee3dbcbdc1e51ad257209f0`의 버전은 `0.102.1`이며, 이를 통합하고 제품 PATCH `0.102.2`를 적용한다. 최신 main 통합을 완료했으며 현재 HEAD는 `dca2f7821f277ef31ee3dbcbdc1e51ad257209f0`, index는 해당 main tree다. 제품·공통 fixture·UI test/helper 실행 bytes는 보존했다.
- 제품 PATCH에 따라 `release_required=true`, `release_authorized=false`로 전환한다. 정식 릴리스 승인과 main artifact는 현재 요청 범위 밖이며 게시·PR CI 등록까지만 수행한다.
- 종료점: 구현·Local Fast Feedback → DOCUMENTATION_SYNC → 독립 PRE_QA → 원격 branch/PR → 정확한 새 head 전체 PR CI 등록. CI 결과 모니터링·병합·main/GHCR·tag·Issue 종료·브랜치 정리는 하지 않는다.

선행 이슈는 착수 시 closed이며 관련 코드가 baseline에 존재한다. 각 선행 PR의 과거 PASS를 새 후보의 PASS로 소급하지 않는다. Task/WBS KPI 확장, Milestone 화면 전면 재설계, 자동 인력 배분, 실적·금액·단가, 새 권한·DB·PRO 기능은 제외한다.

## 공통 원장과 기대값

조회 구간은 동일한 5개 유효 근무일이며 A는 G1/G2, B는 G1에 속한다. T1은 M1의 A50%/B100%, T2는 M2의 A60%, T3은 Milestone 미지정 B20%, T4는 담당 없음, T5는 G1만 직접 지정, T6은 M2의 A allocation=null이다. Summary/Milestone의 책임 관계는 개인 공수를 생성하지 않는다.

| 기준 | 고정 기대값 |
| --- | --- |
| 알려진 공수 / 미설정 | 11.5 M/D / Assignment 1건, 부분합 |
| 고유 개인 할당 Task / Assignment / Resource | 4 / 5 / 2 |
| A / B | 5.5 M/D + 미설정1 / 6.0 M/D |
| G1 / G2 | 11.5 M/D + 미설정1 / 5.5 M/D + 미설정1 |
| M1 / M2 / 미지정 | 7.5 / 3.0 + 미설정1 / 1.0 M/D |
| 개인 미배정 / 완전 미할당 / Group만 지정 | 2 / 1 / 1 Task |
| M/M | 명시적 20일 기준에서만 0.575 |
| 고유 Capacity | A5 + B5 = 10 M/D |

G1+G2의 17 M/D를 Grand Total로 쓰지 않는다. 날짜·상태·진척·전체 Ready·필터·Calendar·기준일·환산까지 같은 원장을 사용하고 원시 ID와 숫자를 비교한다. 표시 반올림 값의 합으로 대조하지 않는다. Calendar/ISO 경계·Peak·부분합·비활성·미분류 등은 명시된 파생 fixture로 검증한다.

## 파일 소유권과 역할

backend는 공통 합성 fixture, Domain 및 실제 SQLite HTTP/API 생성 XLSX 통합 테스트와 관련 서버 문서를 담당한다. frontend는 실제 HTTP seed를 사용하는 Chromium 통합 흐름·5폭·keyboard·Gantt 상태 보존과 UI 문서를 담당한다. ui_ux는 읽기 전용 UX 검토, qa_docs는 작성자와 분리된 독립 검토다. infra는 setup, CHANGELOG, 승인 후 Git/PR/CI 등록을 담당한다. Manager는 본 계획·active PLAN·사용자 가이드·요구사항·workload/role/Milestone 연결·TEST_PLAN을 작성하고 버전·단계를 판단한다. 동일 파일을 동시에 수정하지 않는다.

## 검증 및 문서 동기화

공통 fixture를 Domain → 실제 SQLite HTTP → Dashboard → API 생성 Workbook으로 연결한다. 세 가지 계층과 두 matrix, 주/월→일별→개인 Assignment, 전체 부하 참고, 정확한 일정 왕복, 동일 snapshot Export를 검증한다. 조회만으로 원본·revision이 변하지 않고 재시작 후 같은 identity를 유지해야 한다.

OR/AND와 같은 Assignment 필터, T0/A 분모, 미설정/null/유효0, 진척과 계획 공수 불변, full Ready, 권한·Origin·If-Match·stale·foreign ID·예산·기존 Export/Workload를 다룬다. 성능 수치는 합성 데이터·실행 환경·관측 범위를 함께 기록하고 보장으로 확대하지 않는다.

390/768/1024/1440/1920px에서 실제 populated 표·내부 scroll·header/identity·focus를 확인하고 정상/empty/no-result/error/stale/readonly 전환과 Gantt 인스턴스·선택·viewport 등 기존 보존 계약을 검증한다. screenshot만으로 keyboard/state PASS를 주장하지 않는다. 공식 SVAR URL/API 확인과 실제 demo 조작은 구별하며 Core 2.7.3을 유지한다.

RESOURCE_KPI_DASHBOARD 사용자 가이드에는 팀 Milestone→개인 Task, 개인 주/월→전체 과투입 원인, 개발 Role/등급→동일 범위 Excel, 네 종류 진단 구분·보완 경로를 포함한다. API/ARCHITECTURE/SCHEDULING_ENGINE/SECURITY/EXCEL_EXPORT/PROJECT_UX/UI_UX_GUIDELINES/REQUIREMENTS/ISSUE_56_RESOURCE_WORKLOAD/ISSUE_414_ROLE_WORKLOAD_DASHBOARD/MILESTONE_STAGE_GATES/TEST_PLAN/PLAN/CHANGELOG를 실제 영향에 따라 갱신하거나 N/A 근거를 남긴다. DESIGN·AGENTS·DB·Import·VBA·배포·HTTP·CI gate 불변은 별도 확인한다.

## 실제 통합에서 발견한 결함

고정 1440px Chromium 실행에서 원래 일정의 Core/DOM 수평 위치240이 Resource의 정확한 Task 범위로 이동한 뒤 복귀하면0으로 바뀌었다. 최소 재현에서도120→0이며 API instance·선택·열·트리는 유지됐다. 임시 일정에서 pop할 때 현재0 좌표를 원래 peer 기록으로 재캡처하는 원문 관측을 보존했다. 테스트 기대값을0으로 낮추지 않는다.

각 navigation frame의 source와 destinationBefore에 Core/native viewport를 별도로 보존하고, pop/clear는 복귀 대상의 불변 기록을 사용한다. 실제 canonical queue가 같은 Project·scope/filter·canonical 객체·reset·reader/API identity·layout을 검증한 후 새로운 복귀 요청을 처리한다. 일반 탭 capture와 queued 입력 취소·geometry·stale 검증을 유지하며 중첩 복귀·전체 해제·대기 중 입력 취소를 검증한다.

## 현재 단계

구현과 최신 main 통합·PATCH 반영을 완료했다. Local Fast Feedback은 신규 backend15·관련205·frontend23 Vitest, 실제 Next HTTP1, 브라우저17(신규 실제7/기존 실제2/기존 mock8) PASS다. 별도 실제 Next API1개를 합치면18개다. 통합 후 typecheck·version·diff·Markdown153·root/외부 cwd 테스트 발견도 PASS다. DOCUMENTATION_SYNC PASS다. 독립 PRE_QA는 동결 후보의 별도 보고서와 Issue/PR에 기록한다. 새 원격 quality/e2e/docker와 QA_FINAL/Manager ACCEPT도 NOT TESTED이며 CI 등록 후 결과를 조회하지 않는다. Windows Excel/DRM, 실제 OS 125%, screen reader, 운영 배포는 별도 NOT TESTED다.

## 실행 증거와 검토 범위

[통합 검증 원장](../../evidence/issue530/integration-validation.json)과 [브라우저 source 영수증](../../../output/playwright/issue530/source-evidence.json)을 따른다. 신규 viewport unit12와 기존 Core/native3·navigation8을 합쳐 frontend23개이며 backend220개와 중복 없이 총243개다. 브라우저17개는 실제 UI7·기존 실제2·mock8이며 별도 API1개를 더해18개다. 기존13개 실행, 추가 기존drill3개, 신규 직접flow1개의 별도 영수증을 보존하고 반복 실행을 고유 개수에 더하지 않는다. 최초 제품240/120→0 실패와 수정 후120→120, nested120/240 방문 복귀를 구분한다. 실제 wheel 후 Core30/DOM31을 각각 유지하고 resize1024×768 후0/0을 유지했으며 원래120이 재적용되지 않았다. 정상 target canonical Task IDs 갱신은 계속 적용된다.

5폭 PNG10개와 geometry18관측은 실행 당시 application0.102.0 증거다. 최신 main 통합 뒤0.102.2 screenshot이라고 보고하지 않으며 보호된 제품·테스트 bytes 동일성으로 재사용한다. 실제 원장의 수직좌표는0이므로 nonzero 수직 브라우저 복원은 NOT TESTED이며 pure unit의 Core97/DOM96 비교와 구분한다. UI/UX 최종 검토 재개는 모델 capacity로2회 실행 불가였고 독립 qa_docs가10PNG·geometry·keyboard·상태·source 비교를 인수해 해당 범위PASS를 확인했다. 기존 ui_ux 설계·geometry 정책 검토도 별도PASS다.

추가 직접flow1개는 T1과Assignment2 기간만2026-09-28~10-02로 이동한 파생 데이터에서 M1→Resource→지연KPI→정확한T1 일정→Resource→M1을 확인했다. actualasOf2026-10-08/selectedknown7.5/Task1/Assignment2/지연1 및 canonical/revision 불변PASS다. 기존UI spec32,454bytes prefix와 제품·fixture/helper가 불변이므로 이전13개 증거는 그 실행 당시 범위로 재사용하며, 새1개는 candidate0.102.2의별도12.0초PASS다. Source-bound POST report와 같은 binding detail을 사용한다.
