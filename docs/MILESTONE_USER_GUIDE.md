# Milestone 사용 가이드 — 운영 marker OFF 기준선

> 적용 경계: Issue #552의 native Milestone 행 분리 이후, Issue #553의 데이터 교환/출력 확인용. 현재 PR CI/배포 수용과 사용자 가이드의 문서 게시 여부는 별도로 확인한다.

## 일정·소속·관계 확인

일정의 Grid/Chart에는 **Summary와 일반 Task만** 표시된다. Milestone의 native WBS 행·막대와 상단 Timeline marker/lane은 **기본 OFF**이며 일반 사용자의 'Milestone 표시' 토글이 없다. Milestone은 프로젝트 **Milestone Dashboard**에서 이름·날짜·Ready/Completed, 관계 및 소속 Task를 조회/관리한다. 날짜 이동 요청이 marker OFF에서는 불가능할 경우 해당 Dashboard 상세/소속 Task를 통해 탐색한다. 화면에 일반 Task가 0개이거나 Milestone만 있어도 원본 일정이 빈 것은 아니다.

Milestone 검색/소속 필터는 **표시할 일반 Task의 조건**이며 실제 Stage Gate의 전체 구성원 집합을 자르지 않는다. Summary 접힘, 날짜 범위, 검색, readonly, Workspace 탭 왕복은 canonical Milestone/Link/Membership, 전체 Ready·Completed 판정, 프로젝트 revision을 변경하지 않아야 한다. 직접 등록된 소속과 Summary에서 상속된 유효 소속은 다르다. 실제 편집/삭제·복사에서는 서버 edit session, If-Match, 완료 잠금과 외부 관계 정책이 우선한다.

## 내보내기 형식별 의미

일정 화면의 **내보내기**는 화면 그대로의 캡처가 아니다. **Milestone 표시 여부와 별개로 원본 일정 데이터를 출력하며, 현재 Gantt 레이아웃과 다를 수 있다.** 선택한 파일 형식·범위·서버의 기존 지원 한도가 우선한다.

- **JSON 1.1:** 프로젝트 전체 Task/Summary/Milestone, 원본 Dependency와 **명시 소속**을 교환한다. 새 프로젝트 Import에서는 UUID/FK를 재발급하므로 문자열 UUID 동일성이 아니라 parent/형제/관계/소속·일정 의미로 비교한다. 유효/상속 소속은 대상 계층에서 재계산한다. Resource/Group 배정, Logistics, 인증·프로젝트 전체 백업은 JSON 교환 범위가 아니다. 원본에 있는 legacy mixed Link를 JSON이 기록해도 현재 Import는 해당 조합을 **파일 전체 거부**할 수 있다.
- **Excel:** 기본 Tasks/Gantt/Milestone 시트는 화면에서 숨긴 원본 Milestone/전체 Gate 및 기존 canonical WBS 행 레이아웃을 따른다. '일정 Dependency 포함'을 해제해도 Milestone 소속은 유지한다. Resource 추가 보고서는 선택 사항이며 그 보고서에만 선택 범위/집계 grain이 적용된다. 0/미설정·부분합과 전체 Project E/P의 의미를 혼합하지 않는다.
- **SVG/PNG:** 현재 지원하는 **전체 확장 WBS + 선택 날짜 범위 clip**의 별도 renderer 출력이다. 화면의 선택 열·동적 접힘·Milestone Timeline marker를 그대로 그리는 기능이 아니다. 지원하지 않는 Dependency/구조는 오류로 거부할 수 있으며 링크나 멤버를 조용히 누락시키지 않는다. Milestone 소속 상세와 모든 원본 Link가 필요하면 JSON/Excel을 사용한다.

## 안전·오류·환경

Export/Import/Copy/Cut은 서버의 Origin, session, revision, 읽기 transaction, 파일/행/픽셀 상한, UTF-8·XML escaping을 유지한다. 취소/권한 만료/409·412·422·500 및 통신 불확실 시 성공으로 간주하지 말고 원본 재조회 및 재시도 정책을 따른다. 숨은 Milestone 데이터는 삭제 전 영향 확인 대상이다. 실제 Windows Excel/DRM, 운영 reverse proxy, 외부 소비자 복원 실증은 이 문서만으로 검증 완료가 아니다.

기술 계약: [표시 정책](MILESTONE_PRESENTATION_POLICY.md), [Milestone Stage Gate](MILESTONE_STAGE_GATES.md), [JSON 교환](IMPORT_EXPORT.md), [Excel](EXCEL_EXPORT.md), [이미지](IMAGE_EXPORT.md). 통합 증거: [#553 추적표](MILESTONE_TIMELINE_TRACEABILITY.md).
