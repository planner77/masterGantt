# Issue #866 — Phase C: 화면 국제화와 상태 보존 설계

## 적용 범위와 검증 상태 (2026-11-05)

Phase C는 [Phase A](I18N_PHASE_A.md)의 언어 선택·공통 표시와 [Phase B](I18N_PHASE_B.md)의 관리형 표시명 저장 계약을 전체 화면에 연결한다. Project 목록·생성·설정·Import/Export, Gantt와 Task Editor, Issue, 물류·Resource·Milestone 조회, 공용 기준정보와 국가 캘린더 관리의 고정 문구·도움말·접근성 이름·검증 안내를 ko/en/vi로 표시한다. 관리형 Equipment/System의 원본 이름과 언어별 표시명 입력도 분리한다. 번역을 위해 기존 도메인·일정 계산·권한·revision 계약을 다시 정의하지 않는다.

이 변경의 위험 분류는 **HIGH / OWNER_MANAGED / qa_required=true**다. 로컬 Agent의 구현·단위 검증은 독립 인간 QA 또는 Owner ACCEPT가 아니다. 현재 Phase C 새 Head의 원격 quality/e2e/docker 및 최종 수동 UX는 **NOT TESTED**이며, 이 문서 자체로 완료·병합·릴리스 승인을 뜻하지 않는다. exact Head의 결과·작업 단계는 [활성 Work Packet](exec-plans/active/ISSUE_866.md), [원격 검증 정책](REMOTE_VALIDATION.md), [QA 정책](QA_REVIEW_POLICY.md)을 따른다.

## 언어 상태와 표시 경계

- 지원 언어는 `ko/en/vi`, Intl 표시 locale은 `ko-KR/en-US/vi-VN`이다. 유효한 명시 선택, 브라우저 선호의 첫 지원 언어, `ko` 순서로 해석한다. `mastergantt.ui.locale` 저장 실패 시 현재 탭의 명시 선택을 유지한다.
- `I18nProvider`는 서버와 첫 hydration snapshot을 `ko`로 고정하고 브라우저 상태를 구독해 이후 표시와 `<html lang>`을 갱신한다. 언어가 늦게 적용되는 것을 피하려고 서버 요청·인증·프로젝트 데이터를 브라우저 언어로 다시 쓰지 않는다.
- 코드에 포함한 고정 사전은 UI label·상태·도움말·ARIA·오류 안내의 Source of Truth다. 미등록 key의 한국어 fallback은 번역 완료 증거가 아니다. 기존 공통 key의 뜻을 바꾸어 다른 화면을 오역하지 않는다. 제품 용어 `Milestone`은 언어와 무관하게 유지한다.
- `t()`에는 앱 소유 key와 고정 enum label만 전달한다. Project/Task/Issue 이름·본문·설명, 사람 이름, 사용자가 입력한 검색어·URL·비밀번호·파일명은 불투명한 원문이다. 사용자 문자열이 우연히 사전 key와 같아도 번역하지 않는다. 문장 안에서는 원문을 parameter로 전달하며 재귀 번역하지 않는다.
- ID, externalId, code, route, API enum/error code, requestId, revision, keyboard event key는 표시 언어와 분리한다. 숫자처럼 보이는 ID도 숫자 parameter로 바꾸지 않는다. 원본 이름 편집 input은 번역 표시명이 아니라 저장된 `name`을 편집한다.

## 관리형 표시명과 쓰기

조회 표시 규칙은 `현재 locale의 nonblank translations[locale] → 원본 name`이다. 다른 locale의 번역을 중간 fallback으로 사용하지 않는다. 관리형 항목 검색은 원본 이름과 현재 표시명·기존 code/ID를 함께 사용한다. 같은 표시명이 생기면 기존 정렬 순서 또는 원본 code로 구별하되 선택 value와 관계 payload는 원래 ID/code를 유지한다.

번역은 [Phase B](I18N_PHASE_B.md)의 기존 owner별 선택 필드다. 생략은 보존, 명시적 `{}`는 전체 해제, 빈 locale 값은 해당 표시명 해제라는 서버 규칙을 유지한다. Equipment/System 및 legacy Process dialog는 수동 ko/en/vi 값을 초안에 포함하고, 변경이 없으면 `displayNameTranslationWriteField`로 필드를 생략한다. 삭제하려고 비운 값만 명시 replacement로 전달한다. 자동 번역·다른 언어 복사·원본 name backfill은 하지 않는다.

공용 기준정보는 해당 관리자 세션, 프로젝트 기준정보는 해당 프로젝트 edit session과 기존 Origin·If-Match·revision/CAS를 사용한다. 프로젝트 편집 권한이 공용 관리자 권한을 대신하지 않는다. Phase C는 새 번역 전용 endpoint, migration, machine Import schema를 추가하지 않는다. Copy/Template 및 손실 방어는 기존 Phase B 계약을 따른다.

## 화면·초안·Gantt 상태

언어는 데이터 조회·저장 identity가 아니라 표시 의존성이다. `locale/t`를 fetch·canonical mutation·editor 초기화 effect의 dependency로 추가하거나 언어를 Gantt/Workspace의 remount key로 사용하지 않는다. 현재 선택·query·펼침·scroll·Editor 초안·권한·pending/stale 상태는 같은 canonical 원본을 계속 사용한다. locale 기반 이름·순서·문구 memo는 읽기 전용 projection이다.

TranslationEditor는 번역값과 시작 revision을 `TranslationDraftSnapshot`으로 함께 보존한다. 목록 갱신·401 재인증·412 이후 최신 revision으로 옛 초안을 재귀속하지 않는다. 저장은 잠그고 초안·경고를 유지하며 취소 후 최신 항목을 다시 열도록 한다. Equipment/System dialog도 열 때의 revision과 dirty snapshot에 번역값을 포함하고 기존 취소 확인·uncertain/stale 저장 잠금을 유지한다. locale 변경만으로 초안을 지우거나 저장하지 않는다.

SVAR Core의 공식 Locale와 기존 Gantt 상태 경계를 사용한다. 표시 언어를 바꾸어 canonical Task/Link/Membership을 재생성하거나 Summary·Resource·Milestone Gate를 계산하지 않는다. Task Editor가 여는 canonical Task ID, 날짜·duration·assignment·공정/Target 연결 및 서버 검증은 유지한다. native `W##`/ISO 주차와 저장 calendar는 UI 문구 번역과 별개다. 상세 비회귀 증거는 [Task Editor](TASK_EDITOR.md), [프로젝트 UX](PROJECT_UX.md)와 해당 Gantt 실행 원장을 따른다.

## 알림과 날짜·숫자

알림은 최종 번역 문자열을 원장에 굳히지 않고 고정 `message/operation` key와 `presentation.parameters`, `presentation.labels` 및 `presentation.segments` descriptor를 보관한다. `parameters`의 이름·사용자값은 그대로 보간하고, `labels`에 지정한 앱 소유 label만 번역한다. 열린 toast·오류 목록과 복사 텍스트는 현재 locale로 표시한다. 알림 ID·발생시각·read 상태·순서·보존 한도·5초 toast 수명은 언어 변경의 영향을 받지 않는다. Plan 상세와 일정 이동 설명도 owner 표시명·고정 message key·period/trail descriptor를 보관하고 현재 locale에서 렌더한다. 외부에서 전달된 opaque label은 그대로 유지한다. 안전한 code/requestId 필터도 유지한다.

날짜 input/API/SQLite의 `YYYY-MM-DD`, UTC timestamp, 근무일·duration·시간대는 canonical 값이다. Date-only 표시는 UTC 달력 성분을 검증해 Intl로 포맷하고, 날짜를 브라우저 자정 timestamp로 재해석해 하루 이동시키지 않는다. timestamp의 시간대 표시는 해당 화면의 기존 계약을 따른다. 숫자는 읽기용 수량·공수·비율·건수만 Intl로 표시하며 type=number/date input 값, CSS percentage width, HTTP status와 식별자는 바꾸지 않는다. 표시가 바뀌어도 KPI 산식·공수 분모·정렬용 원본 수치가 바뀌지 않는다.

## 오류와 신뢰 경계

고정 UI 오류 key·명시적인 안전 code·검토된 domain detail만 번역 대상으로 삼는다. 외부 예외·응답 message를 사전 key 또는 HTML로 실행하지 않는다. 알려지지 않은 오류는 화면별 고정 context fallback을 사용하되, 기존 서버 계약에서 허용하는 validation field/row detail와 업무 충돌 안내를 일괄 generic 오류로 지우지 않는다. ID·error code·requestId는 원문 식별자다. 물류 mutation의 앱 소유 오류와 opaque 서버 detail은 별도 구분하고, Dashboard의 검토된 오류 및 HTTP status 문구는 고정 template로 표시한다.

언어 저장은 비밀 저장소가 아니다. URL/localStorage/알림·복사 텍스트에 password/session/token·원본 request body를 추가하지 않는다. [Security](SECURITY.md)의 서버 인증·Origin·CAS·안전한 오류 출력 정책이 표시 언어보다 우선한다.

## 검증 인계

필수 관찰은 세 언어의 고정 UI/ARIA/도움말, 원문이 사전 key와 같은 사용자 텍스트, 관리형 번역 fallback·중복 이름 선택, 생략 보존/명시 삭제, locale 전환 중 dirty Editor와 Gantt 선택·scroll 보존, 401/412 후 저장 차단, 날짜 경계·숫자 표시, 알림 재표시·복사와 장문 반응형이다. 390/768/1024/1440px 및 해당 Work Packet의 추가 폭에서 keyboard/focus/Escape/복원·overflow를 실제 원격 E2E와 최종 UX 증거로 판정한다. 브라우저 미실행을 UX PASS로 기록하지 않는다.

관련 단위 검증은 locale/store/catalog·date-only·알림 descriptor·managed identity/search 및 기존 domain/API 테스트를 사용한다. 전체 테스트 소유권·원격 gate·미검증 항목은 [TEST_PLAN](TEST_PLAN.md)에 유지한다. 운영 DB 복구·Windows Excel/DRM·실제 proxy/TLS·독립 인간 QA와 Owner 결정은 이 문서의 로컬 구현 증거와 별도로 판정한다.

## 대표 로컬 화면과 검증 한계

[베트남어Gantt](evidence/issue-866/phasec-gantt-vi.png)와 [390px관리자](evidence/issue-866/phasec-master-vi-390.png)는 현재 소스의 실제 브라우저 캡처다. 입력·focus·상태·권한 검증은 별도 테스트 결과를 따른다. 프로젝트 Equipment/System 번역입력의 omission/clear/stale 전용브라우저 조합은 별도로 실행하지 않았으며, 공용translation helper·12-owner HTTP/SQLite와 기존CRUD 검사와 구분한다. 새 exact Head의 공식 전체CI·독립인간QA·Owner판정과 운영/Windows/실제AT검증은 별도다.
