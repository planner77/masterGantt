# Issue #342 국가 캘린더 재구현

## 목표와 기준

[Issue #342](https://github.com/planner77/masterGantt/issues/342)의 국가 근무 캘린더 원본 관리와 JSON/CSV 업로드를 최신 main에서 다시 구현한다. 기존 [PR #346](https://github.com/planner77/masterGantt/pull/346)과 branch `feat/issue-342-country-calendar-catalog`를 재사용한다. 과거 실패 이력을 보존하고 새 head의 원격 검증을 받는다.

- 최초 baseline main: `c94b13e110ed5fd9e17625daa084c181f35703e8`, application `0.95.1`.
- 통합·게시 baseline main: `36cf2db8ab0c6d04ab904b01c6bc8a0bb6b1cdab`, tree `e032aaebceaf82a882bf50d8df96a2ca8298e357`.
- 기존 PR head: `8a6b4fd99280c899005d4b7c9a6e876f46ce0856`.
- 격리 구현 branch: `rebuild/issue-342-country-calendar-catalog`. 공유 checkout과 기존 worktree를 수정하지 않는다.
- version: 신규 관리 기능과 지원 연도 확장이므로 MINOR `0.96.0`.
- `release_required=true`, `release_authorized=false`. 현재 요청 범위는 구현 및 PR 검증이다. 병합·main artifact·정식 GHCR·tag·Issue 종료·branch 정리는 실행하지 않는다.

## 최신 main 통합

구현 중 PR #516 / Issue #502가 main에 병합됐다. version은 `0.95.1`로 동일하다. main 변경 15개 중 #342 제품과 같은 path는 없고 TEST_PLAN·UI_UX_GUIDELINES·PLAN이 겹쳤다. 새 error boundary 검증 코드·공통 E2E 설정·geometry helper와 기존 계획을 보존해 통합했다. #342 backend 구현 bytes가 동일한 범위의 Local Fast Feedback은 재사용하고 새 공통 설정에서 관련 브라우저 검증을 다시 수행한다. 기존 실행을 최신 환경 전체 검증으로 확대하지 않는다.

## 확인한 실패

PR CI run `37566474453`, 기존 head `8a6b4fd99280c899005d4b7c9a6e876f46ce0856`의 quality/docker는 성공했고 e2e job `112615374357`의 `E2E shard 실행`이 실패했다. 관리자 조회 오류 후 metadata form이 사라져 `메타데이터 저장` 버튼을 찾는 검증이 실패했다. 이전 run `37558757715`, `37561192247`, `37563367685`의 국가 전환·조회 오류 경로도 새로운 상태 설계의 회귀 범위다.

Native Add 첫 클릭 요청 누락은 PR run `37563367685`뿐 아니라 baseline main run `37562885177`에도 존재한다. callback 참조의 화면 반영 시점을 최소 수정하고 기존 `project-gantt-stability.spec.ts` 회귀를 검증한다. 타임아웃 증가나 required gate 삭제로 해결하지 않는다.

## 구현 계약

1. KR/CN/VN/PH/TH/MX/US와 2026~2037의 84개 슬롯을 관리한다. 검증된 공식 자료는 OFFICIAL, 미확보는 UNAVAILABLE, 대체된 자료는 SUPERSEDED다. 미래 날짜를 규칙으로 생성하지 않는다.
2. immutable builtin과 SQLite override를 사용한다. 명시적인 UNAVAILABLE/SUPERSEDED override는 builtin을 차단한다. runtime 외부 휴일 API는 호출하지 않는다.
3. 기존 Project Master 관리자 session/cookie와 Origin 검사를 재사용한다. mutation은 strong If-Match를 요구하고 body 읽기 후 transaction 안에서 관리자 권한을 다시 검사한다.
4. metadata/date CRUD 및 strict JSON/CSV Preview→Apply를 제공한다. 실제 날짜 변경은 provenance를 무효화한다. no-op은 revision·updatedAt·상태·출처를 바꾸지 않는다.
5. Preview token은 원본 UTF-8 내용·format·선택 국가/연도·catalog revision·관리자 session·만료에 묶인다. Apply는 다시 검증하고 하나의 IMMEDIATE transaction에서 전체 대체한다. 삽입 중 오류에도 부분 저장하지 않는다.
6. 국가 원본 변경은 기존 Project materialized calendar/Task/Project revision을 변경하지 않는다. 명시적 Project calendar Preview/Save에서만 최신 OFFICIAL 원본을 읽는다. 새 UI는 Preview의 `countryCatalogRevision`을 Save에 전달하고 불일치는 412다.
7. 새 Project 기본 달력은 같은 UTC 연도의 effective KR OFFICIAL, 같은 연도의 검증된 builtin, 월~금 기본 근무주 순으로 초기화한다. 다른 연도의 휴일을 가져오지 않는다. 사용자가 명시적으로 선택한 국가 규칙의 미확보 연도는 상세 422로 거부한다.
8. 관리자 화면은 기존 DESIGN, AdminAuth, WorkspaceDialog와 semantic token을 사용한다. 조회 중과 오류에서도 선택 toolbar 및 metadata/action DOM을 유지한다. target/request/auth/file 세대, pending 잠금, Escape 및 날짜 이름·날짜 변경 후 focus 복원을 검증한다.

공식 출처·자료 적용 범위·파일 계약·갱신 절차는 [COUNTRY_CALENDAR_DATA](../../COUNTRY_CALENDAR_DATA.md), 서버 계약은 [API](../../API.md), 저장 구조는 [DB_SCHEMA](../../DB_SCHEMA.md)를 따른다.

## 소유권과 문서 동기화

| 담당 | 코드·검증 | 문서 |
| --- | --- | --- |
| backend | migration 0024, catalog repository/service/handler, shared contracts, 보호 routes, materialize/seed 연결, 관련 Unit/SQLite/API tests | API, DB_SCHEMA, ARCHITECTURE, REQUIREMENTS, SECURITY, SCHEDULING_ENGINE, ISSUE_57_WORK_CALENDAR |
| frontend | 관리자 화면/route/접근 링크, Project calendar editor revision 전달, Gantt callback 최소 수정, 관련 E2E와 5폭 증거 | PROJECT_UX, UI_UX_GUIDELINES, TEST_PLAN |
| Manager | 정책·공용 계약·통합 검토 | COUNTRY_CALENDAR_DATA, 이 계획, active PLAN |
| infra | version/package/lock/CHANGELOG, Manager 승인 뒤 기존 PR 게시와 CI | CHANGELOG |
| researcher | 공식 자료와 원표 대조, read-only | 문서 작성자를 위한 출처 handoff |
| qa_docs | AC/code/test/docs/실제 CI 독립 검토, read-only | 검토 결과 handoff |

UI 설계는 실제 frontend Agent가 read-only phase에서 수행한 뒤 구현 phase로 전환했다. 별도 native ui_ux Agent 실행을 주장하지 않는다. qa_docs는 별도로 실행해 독립 검토한다.

DESIGN은 기존 시각 정책을 사용하므로 변경 N/A다. 기존 Project Import schema, CI/CD·원격 검증 정책, 배포·HTTP·Excel/VBA 계약은 바꾸지 않으며 문서 영향 분석에서 각각 N/A 근거를 확인한다. 국가 파일 Import는 Project Import와 별도 계약이다.

## 검증과 단계

Local Fast Feedback은 strict parser, 실제 SQLite CRUD/Preview/Apply, no-op, 만료·revoked session·지연 body, session/target/content/format/revision token binding, 삽입 중 injected failure rollback, 기존 Project snapshot 불변, seed fallback 및 명시적 미확보 국가 규칙을 다룬다. 실제 관리자 인증과 JSON/CSV 적용 E2E를 mock race 검증과 구분한다. Native Add 관련 회귀, typecheck, 변경 파일 lint 및 문서 링크를 확인한다.

390/768/1024/1440/1920px에서 대표 상태와 native keyboard/focus/Escape 및 table 자체 overflow를 확인한다. CSS zoom이나 deviceScaleFactor를 실제 OS 125% 검증이라고 보고하지 않는다.

진행 순서는 구현 → Local Fast Feedback → DOCUMENTATION_SYNC → 독립 QA → Manager 게시 검토 → 기존 PR #346 게시 → 새 head quality/e2e/docker → 최종 QA다. head가 변경되면 세 원격 gate와 최종 QA를 다시 확인한다.

서버 Local Fast Feedback은 관련 239개 고유 테스트 PASS다(236개 Vitest + migration CLI 3개). 후속으로 추가한 US 2027→2028 FULL_PROJECT 통합과 국가 원본 미확보 상태에서 저장된 Template를 사용하는 검증을 포함한다. 기존 테스트의 반복 실행 수를 새 테스트 수로 더하지 않았다.

최신 main의 공통 E2E 설정과 helper에서 선택한 브라우저 10개가 PASS다. 국가 관리자 4개, Project Calendar 3개, Resource Calendar 1개, Native Add 2개이며 실제 서버/auth/SQLite 성공 경로와 제어 mock의 경합·오류 검증을 구분한다. 390/768/1024/1440/1920px의 populated table·control 경계와 실제 Tab focus를 확인했다. 첫 실행의 실패와 원본 기록은 보존한다. 캡처의 US 2031 E2E override는 테스트 자료이며 builtin 공식 자료의 검증 근거가 아니다.

관련 문서를 동기화한 뒤 독립 QA와 게시 검토를 진행한다. 새 head 원격 quality/e2e/docker와 최종 QA는 아직 NOT TESTED다. Local PASS를 전체 원격 회귀 PASS로 대체하지 않는다.
