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
