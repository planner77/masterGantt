# Target·Resource 사용자 가이드

Issue #623의 Resource 우선 MVP 안내다. 지원 계약은 [Logistics Targets](LOGISTICS_TARGETS.md), 계산은 [Resource KPI](RESOURCE_KPI_DASHBOARD.md), 검증 상태는 [통합 수용표](TARGET_RESOURCE_ACCEPTANCE.md)를 따른다. 후순위 #624 통합 물류 화면이나 #379 전체 참조 JSON의 완료를 뜻하지 않는다.

## 1. 프로젝트와 구성 준비

Project direct link는 기본 읽기 전용이다. 조회·Resource 상세·허용된 Excel 보고서는 편집 로그인과 구별한다. Task/Assignment/Target를 바꾸려면 해당 Project의 편집 권한을 열고, 공통 기준정보 변경에는 별도 관리자 권한을 사용한다. 비밀번호·세션은 URL에 넣지 않는다.

제품 표준 공정을 만들고 유효한 사업부–제품–사업장 관계에서 사업장별 공정 occurrence를 적용한다. 같은 제품의 두 사업장은 표준 공정을 공유하며 특정 사업장 추가 공정은 별도로 둔다. WorkArea는 선택 사항이고 하나의 사업장·제품·공정 occurrence 전용이다. WorkArea를 쓰지 않는 업무에 가짜 기본 구역을 만들거나 다른 공정의 구역을 공유하지 않는다.

프로젝트의 `물류 구성`에서 공정 매핑과 Target를 구성한다. Target A에는 AMR10·ACS A, Target B에는 AMR5·ACS B를 놓고 공통 MCS는 기존 System 인스턴스 하나를 두 Target에서 재사용할 수 있다. 실제 같은 인스턴스를 이름만 바꿔 중복 등록하지 않는다. 시스템 종류 이름과 개별 인스턴스 label은 구별한다. 프로젝트 공통 Target은 명시적 `project_common`이며 임의 공정/WorkArea를 강제하지 않는다.

## 2. 같은 Task를 연결하기

실제 하나의 통합 업무는 하나의 Task를 여러 Target에 연결한다. 담당·기간·완료 기준이 다른 실제 업무일 때만 Task를 분리한다. Task Editor의 Target 연결에서 전체 구성원(whole) 또는 선택 구성원(subset)을 지정한다. ACS-only subset은 같은 Target의 AMR까지 포함하지 않는다. 작업 coverage는 실제 구성 수량과 별개이며 공수를 곱하는 값이 아니다.

기본 연결 범위는 self다. Summary는 subtree를 명시 선택할 수 있고 하위 Task는 직접 연결과 모든 조상 subtree의 합집합을 가진다. 하위 명시 연결은 상위 연결을 덮어쓰지 않는다. 직접/상속 출처를 확인하고, Target 구성 또는 WBS 이동으로 적용 범위가 달라지면 영향 확인을 거쳐 저장한다. 기존 직접 Equipment/System 연결만으로 Target를 자동 추정하지 않는다.

## 3. Resource에서 같은 원본 조회

`리소스`에서 기간·Target·검색을 선택하고 추가 공정/WorkArea/설비·시스템 조건은 고급 필터에서 펼쳐본다. Resource 우선 Group→Resource→Target, Target 우선 Target→Group→Resource 및 비교표는 같은 원시 Task/Assignment의 조회 방식이다. 정렬·접힘·페이지·보기 전환은 WBS parent·Task 날짜·배정을 저장하지 않는다.

5근무일100% Assignment 하나가 A/B에 함께 연결되면 A5 M/D·B5 M/D지만 선택 A∪B 전체는5 M/D다. Target와 중첩 Group 소계를 더해 전체값을 만들지 않는다. AMR10+5는15대, ACS A/B는2식, 공유 MCS는1식이며 수량을 계획공수에 곱하지 않는다. 관련 계획공수는 원가 배분·실적·잔여공수가 아니다. Task 진척을 바꿔도 계획공수는 줄지 않는다.

| 범위·상태 | 읽는 방법 |
| --- | --- |
| T0 | 개인 조건 적용 전 선택 일반 Task 진단 범위. 개인 필터로 미배정을 숨기지 않음 |
| A | 선택 조건을 만족하는 원시 개인 Assignment. 한 Task 공동담당자는 별도 Assignment |
| R | Project 일반 Task 개인 배정 이력에 개인 분류 조건을 적용한 Capacity 모집단 |
| partial | 알려진 공수 부분합과 미설정 배정이 함께 있음. 확정 전체가 아님 |
| unset | 투입률 미설정. 공수 null/공란을0으로 읽지 않음 |
| configured0 | 설정된 배정이 비근무일 등으로0 M/D. unset/empty와 다름 |
| M/M 기준 없음 | M/D는 보지만 M/M 환산은 미산정.0 M/M로 바꾸지 않음 |
| Target 미연결 / legacy | Target 연결 없음과 기존 직접 물류 연결만 존재하는 출처를 구별 |
| WorkArea 미사용 / 프로젝트 공통 | 공정에 구역을 지정하지 않은 상태와 project_common 예외를 구별 |

## 4. 원본 편집과 복귀

Task 행은 기존 Task Editor에서 이름·기간·상태·진척·Target 연결을 바꾼다. 정확 Assignment 행은 표시된 개인/Assignment ID의 배정 편집에서 기간·투입률을 바꾼다. Target 이름·구성은 Target composer에서 바꾸며 Task 이름 편집과 혼용하지 않는다. 가상 Group/Target 헤더·총계는 읽기 전용이다.

저장 후 같은 Task/Assignment ID의 다른 보기는 최신 snapshot으로 갱신되거나 stale를 표시한다. Resource→Editor/일정→Resource 복귀는 원래 조건·선택·펼침·상세·focus를 보존한다. 조건에서 탈락하거나 삭제된 행은 자동 복제/재연결하지 않고 유효한 컨트롤로 복귀한다.

pending 중 중복 저장하지 않는다. 취소·이동 시 dirty 초안 확인을 따르고 권한 만료401·기준 변경409/412에는 초안 보존/명시 폐기와 재조회 경로를 사용한다. 오류 응답을 저장 성공으로 간주하거나 mutation을 자동 재시도하지 않는다. Escape와 Tab/Enter는 현재 Editor/상세의 기존 닫기·복귀 순서를 따른다.

## 5. 주·월 Plan과 과투입 원인

Plan에서 선택 기여와 같은 개인의 Project 전체 참고를 구별한다. A80%와 다른 B60%이면 선택 A는80%, 같은 개인의 해당 Project 전체는140%다. 이는 전사 전체 부하가 아니다. Target/Task/기간 필터는 R를 줄이지 않는다. Resource Calendar를 적용한 고유 resource-day Capacity를 사용하고 Target/Group/Milestone에 반복 표시된 참고 Capacity를 합산하지 않는다.

주/월→일별→개인→정확 Assignment로 내려가 개인 Peak/초과를 확인한다. Group 평균이 정상이어도 개인이 초과할 수 있고 하루150%/다음0%는 평균75%라도 초과일이 있다. 미설정 allocation도 별도로 확인한다. Project 참고 원인은 출발 Target 밖 배정을 포함하며 출발 선택과 현재 참고 범위를 표시한다. 밖의 B 배정을 수정한 뒤 A 조건으로 돌아와 새 부하를 확인한다.

## 6. Excel과 안전한 교환

`Excel 보고서`에서 Resource 보고서 포함 및 current/project 범위를 명시한다. current는 같은 조건·source·snapshot, project는 확인된 기간/asOf/Calendar/M/M 정책을 유지하면서 개인/Task/Milestone/Target/공정/WorkArea/인스턴스·exact 제한을 제거한다. 이 선택은 추가 Resource 보고서에만 적용하며 기존 일정/Tasks 등은 Project 전체 기준이다.

기본7개 Resource 시트와 조건부4개 Target 근거 시트는 raw Assignment ID·M/D·M/M·null·기준 revision을 보존한다. 같은 Assignment가 여러 근거 행에 나와도 총계를 다시 더하지 않는다. stale export는 실패하므로 새 snapshot을 조회해 다시 요청한다. [Excel 형식](EXCEL_EXPORT.md)을 따른다.

Excel은 보고서이며 운영 백업/Target 무손실 재가져오기 형식이 아니다. Target-bearing plain 일정 Excel/일정 JSON은 현행 loss guard로 거부한다. Project Copy는 새 local ID를 만들고 global 참조는 재사용한다. Task binding 포함 Template는 logistics schemaVersion3, binding 없는 v2 및 legacy는 호환한다. 개인 Assignment가 있는 Task 복사는 현재 `TASK_COPY_ASSIGNMENTS_UNSUPPORTED`로 거부하며, 전체 Project Copy/Template와 지원 범위가 다르다. 다른 사업장으로 자동 이름 매핑/재배치된다고 가정하지 않는다. #379 전체 참조 JSON 미완료 및 [이관·복구 절차](TARGET_RESOURCE_OPERATIONS.md)를 확인한다.
