# Issue #261 Resource 근무·휴무 날짜 예외 설계와 검증

기준: `main` `6a383a0b376f5357625305a8ec0a9ff62e00b367`, 2026-09-29. [Issue #261](https://github.com/planner77/masterGantt/issues/261)의 AC01–17을 대상으로 한다. 버전은 하위 호환 기능 추가에 따라 0.52.0 → 0.53.0이다.

## 범위와 근거

선행 #19(Resource/Group), #56(workload), #57(Calendar), #68(Calendar/Dependency)를 확인했다. 기존 NON_WORKING 합집합은 특별근무를 표현하지 못하고 Editor는 CUSTOM 유형을 round-trip하지 못한다. Project < Group < Resource의 명시적 예외로 일반화하되 Task 일정에는 Project Calendar만 사용한다. 같은 계층의 동일 유형은 계산상 한 번만 반영하고 모든 출처를 보존한다. 반대 유형은 저장 전 거부하며 Group membership 변경도 모든 관련 프로젝트에서 같은 invariant를 유지한다. Resource-level 예외로 Group-level 충돌을 숨기지 않는다.

DB의 기존 day_type CHECK는 두 유형을 지원하므로 신규 migration은 N/A다. Project CUSTOM WORKING, Resource Leveling, 시간/반일 Calendar와 PRO 도입은 범위 밖이다. API는 [API](API.md), 저장은 [DB_SCHEMA](DB_SCHEMA.md), 순수 계산은 [SCHEDULING_ENGINE](SCHEDULING_ENGINE.md)이 상세 Source of Truth다.

사용자 승인 범위는 구현·PR·CI 시작까지다. `release_required=false`, `release_authorized=false`; CI 완료 모니터링, merge, main/GHCR, version tag, 운영 배포, Issue 종료는 수행하지 않는다. 이는 전체 Issue 완료/Manager ACCEPT 판정이 아니다.

## UI 설계

[DESIGN](../DESIGN.md)의 Light/workspace-first/compact 시각 언어와 [UI_UX_GUIDELINES](UI_UX_GUIDELINES.md)의 keyboard/focus/state 규칙을 적용한다. 기존 설정 탭과 2열 fieldset을 확장하여 새 모달·페이지를 추가하지 않는다. 별도 테이블 도입보다 기존 field-level 오류 연결과 좁은 화면 리플로우를 보존한다.

```text
설정 → 작업 캘린더
[국가 공휴일] 기존 유지
[사용자 날짜 예외]
  이름 / 날짜
  대상 / 대상 선택
  유형: 휴무일 또는 근무일 / 삭제
[날짜 예외 추가]
[미리보기 계산] [작업 캘린더 저장]
일정 변경 요약 + 리소스 날짜 예외 영향
  날짜 · 대상 · 적용됨/효과 없음 · 리소스 수
  세부 출처: 리소스별 최종 근무/휴무 · winning layer/source
```

Group/Resource만 두 유형을 선택한다. Project는 휴무일 고정이며 WORKING 초안의 target을 Project로 바꾸면 NON_WORKING으로 정규화하고 상태를 알린다. `CHANGED/NO_EFFECT`는 해당 계층의 상위 결과와 비교한 효과다. 더 구체적인 Resource 예외가 최종 결과를 다시 바꿀 수 있으므로 각 리소스의 최종 상태와 적용 출처를 별도로 표시한다. 구성원이 없는 그룹은 대상 0명을 명시한다.

| 상태 | 동작 |
| --- | --- |
| 편집 | 날짜·이름·대상·유형·추가·삭제 변경 시 이전 preview/충돌 무효화 |
| 계산/저장 중 | 초안과 중복 요청 잠금, 진행 텍스트, 늦은 응답 방어 |
| NO_EFFECT | 효과 없음 경고, 명시적 설정 저장 허용 |
| 동일 계층 충돌 | 날짜/Group/Rule/Resource 오류 요약, focus 및 입력 연결, 동일 초안 저장 차단 |
| 401/412 | 기존 재인증/최신 snapshot 경로 및 초안 보호 |
| 저장 성공 | canonical Calendar 재조회와 WORKING 복원, 기존 Gantt instance/작업 상태 보존 |

native select·순번 fieldset·고유 accessible name·summary/inline errors를 사용한다. 타이핑 중 focus를 이동하지 않고 명시적 제출 오류에서는 요약으로 focus를 이동한다. 390/768px는 기존 한 열, 1024/1440px는 두 열을 유지하고 긴 이름/오류를 wrap한다. 실제 동작은 화면 캡처와 별도로 focused E2E로 검증한다.

## 공식 자료와 자체 구현 경계

2026-09-29 인터넷 검색 및 [SVAR Calendars](https://docs.svar.dev/react/gantt/guides/scheduling/calendars/), [Resource Calendar](https://docs.svar.dev/react/gantt/guides/resources/resource-calendar/), [resources API](https://docs.svar.dev/react/gantt/api/properties/resources/)를 조회했다. 설치 Core 2.7.3을 유지한다. 공개 자료의 Task bar/Resource 가용성 분리 개념만 참고한다. PRO ResourceLoad의 Task/Resource 시간 교집합 규칙은 #261의 상위 휴무→근무 override와 다르므로 채택하지 않는다. 공식 [Base demo](https://docs.svar.dev/react/gantt/samples/#/base/willow) 등 URL 조회와 JavaScript demo 실제 조작은 다르며 후자는 NOT TESTED다.

## 문서 동기화와 실행 증거

- 갱신 대상: REQUIREMENTS, API, DB_SCHEMA, SCHEDULING_ENGINE, ISSUE_57_WORK_CALENDAR, PROJECT_UX, TEST_PLAN, PRO_FEATURE_MATRIX, CHANGELOG.
- DESIGN/UI_UX_GUIDELINES는 기존 원칙을 적용하므로 규칙 자체 변경 N/A. ARCHITECTURE/SECURITY/IMPORT/CI_CD/REMOTE_VALIDATION은 기존 경계·보안·배포·검증 정책을 유지하므로 계약 변경 N/A.
- 실제 전문 Agent: ui_ux 설계, scheduler 도메인, backend 서비스/API, frontend UI/E2E, infra branch/version/PR, qa_docs 독립 사전 검토. Manager가 통합한다.
- 로컬 빠른 검증: scheduler의 Domain+기존 purity 16개 및 SQLite adapter 4개 PASS. backend의 Calendar service/Resource catalog/workload/신규 override 4개 파일 17개 PASS(신규 service/API 6개 포함). 대상 ESLint, typecheck, version check PASS. Manager Markdown 링크 86개 PASS.
- 독립 QA 직접 실행: 신규 Domain 14개 + SQLite adapter 4개 + service/API 6개 PASS. 전체 회귀나 원격 CI PASS를 의미하지 않는다.
- 최초 purity 실행은 sandbox의 자식 프로세스 EPERM으로 실패했으며, 권한 승인 후 같은 검증을 재실행해 PASS했다.
- 독립 qa_docs 사전 검토: PASS(로컬 실행·코드·테스트·문서·화면 증거 범위). domain/service 보안·원자성 및 최종 UI 보완을 확인했다. 원격 CI 미완료이므로 최종 Manager ACCEPT는 아니다.
- Chromium: 관련 4파일 16개 중 최초 15개 PASS/1개 fixture FAIL. 기존 Preview 2개·반복 입력 접근성 12개 PASS를 재사용하고, 변경된 신규 UI mock 1개와 실제 SQLite 1개를 각각 최종 재실행하여 PASS했다. 실제 SQLite 최종 실행은 16.5초이며 Group/Resource WORKING 저장·canonical GET·재진입, Task/Link 불변, Gantt instance/API identity·선택·스크롤 보존을 확인했다. mock은 PUT409 이전 preview 제거·canonical 정규화 draft 반영·재조회401 처리도 검증한다.
- 최초 브라우저 실패는 Project fixture description 누락(400), admin session 생성 응답 기대값 200/실제201 불일치, Manual fixture의 KR 공휴일을 누락한 duration 불일치(422)였다. fixture를 수정하고 실제 API 테스트는 Auto start+duration으로 서버 날짜 계산을 사용했다. 제품 검증을 생략하거나 실패 assertion을 제거하지 않았다.
- Chromium 권한 요청 1회는 sandbox 승인 대기 후 중단되어 실행되지 않았다. 이후 승인된 실행 결과를 위 근거로 사용한다.
- UI 리뷰에서 발견한 PUT409 stale preview·revision 변경 뒤 conflict state·Task/Resource 영향 영역 구분을 보완하고 canonical Calendar GET을 추가했다. 생성된 next-env/tsconfig의 임시 UUID 경로는 최종 diff에서 제거했다.
- 원격 quality/e2e/docker: NOT TESTED. PR 생성 후 CI 시작만 확인한다.

## 화면 증거

아래 이미지는 합성 테스트 데이터로 생성한 변경 후 화면이다. 화면 폭 검증은 screenshot과 별도로 E2E에서 실행했다.

- [390px 날짜 예외](images/issue-261/calendar-exceptions-after-390.png)
- [768px 날짜 예외](images/issue-261/calendar-exceptions-after-768.png)
- [1024px 날짜 예외](images/issue-261/calendar-exceptions-after-1024.png)
- [1440px 날짜 예외와 NO_EFFECT](images/issue-261/calendar-exceptions-after-1440.png)
- [실제 SQLite Group/Resource 근무일 Preview](images/issue-261/calendar-exceptions-real-preview.png)

실제 스크린리더·운영 배포·공식 SVAR JavaScript demo 조작은 NOT TESTED다.

변경 전 화면 캡처는 NOT TESTED다. 기준 SHA `6a383a0b376f5357625305a8ec0a9ff62e00b367`의 별도 `/tmp` source와 합성 SQLite를 준비했으나, localhost 서버 시작이 sandbox `listen EPERM`으로 차단되었다. 권한 요청은 승인 대기 중 중단되어 실행되지 않았다. 기존 작업 서버·DB에는 영향을 주지 않았으며, 변경 후 화면과 별도 E2E 검증을 PR 증거로 사용한다.
