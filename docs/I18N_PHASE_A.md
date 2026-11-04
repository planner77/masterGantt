# Issue #866 — Phase A 국제화 기술 설계 및 운영 경계

현재 Main `364aa3bdfde16fd3ca79add61c35a1cde21f6395` / v0.141.1에서 기존 PR #870의 i18n 부분만 선택 이식한다. #865 사내 LLM, #869 Issue 등록 폼 등 이미 병합된 기능·API·DB/migration·의존성 graph를 다시 적용하지 않는다.

## 상태·선호·SSR

- Locale Registry `ko/en/vi`, 표기용 `ko-KR/en-US/vi-VN`, storage key `mastergantt.ui.locale`; 명시 저장된 유효 값 우선, 없으면 브라우저의 첫 지원 언어, 없으면 한국어.
- React `I18nProvider`의 `useSyncExternalStore` 서버 Snapshot은 `ko`로 고정. 첫 hydration 뒤 사용자 선택으로 갱신하고 `<html lang>`을 변경한다. Browser localStorage 접근 실패는 화면 실패로 만들지 않고 현재 탭의 명시 선택을 보존한다.
- 정적 catalog는 `core` + `shell`만 Phase A에서 등록한다. 미등록 UI key는 기존 한국어 key를 fallback하므로 실제 번역 완료를 의미하지 않는다. 자유입력 Project/Task/Issue/설명, 서버 DTO·enum·error code·WBS ID·DB PK/FK·Revision·권한은 절대 자동 번역·수정하지 않는다. 서버 error code는 whitelist의 사용자 메시지만 렌더하며 unknown 원문 오류를 노출하지 않는다.
- 언어 선택기 Label/ARIA와 keyboard focus, 앱 Header 3열 배치(브랜드 / 가로스크롤 Nav / 언어·알림). 기존 Notification Portal `workspace-notification-slot`의 ID·소유는 그대로 유지한다. 390px에서 Nav만 내부 가로스크롤, 문서 전체 overflow를 만들지 않는 것을 목표로 E2E/시각 검증한다.

## 날짜·Gantt

- `SSR_DATE_LOCALE=ko-KR`; Date-only `YYYY-MM-DD`는 `Date.UTC` + `timeZone=UTC`로 포맷만 변경하며 저장 date/Today local date 생성/Calendar working-days는 보존한다. 실제 Date/Number formatter의 화면별 useEffect/useI18n 연결은 Phase C.
- SVAR React Gantt 2.7.3 Willow 내부 `<Locale words={SVAR_LOCALES[locale]}>`로 ko/en/vi custom Gantt/Core/Calendar words 적용. Built-in English/Chinese 및 사용자 Locale 확장을 제공하는 **공식** [SVAR Localization](https://docs.svar.dev/react/gantt/guides/appearance/localization/) / [Samples](https://docs.svar.dev/react/gantt/samples/) 참고. `calendar.weekStart=1`, ISO W##, Day/Week UTC date-only, Core Task/Link/assignment/readonly/scroll 인스턴스/ID 참조는 불변. 언어 변경에 Gantt `key`를 두지 않는다.

## 기능 단계와 병합 범위

- Phase A 현 구현: 언어 선택 + 공통 표시 + SVAR words (v0.142.0 후보, 보안/DB/API 미변경).
- Phase B 예정: 기존 owner별 master data의 별도 번역 구조, 국소 owner/revision/CSRF 검증, 전역/프로젝트 관리자 권한/기존 name ID 유일성 보존, SQLite additive migration 및 조회 fallback·Copy/Template/API schema.
- Phase C 예정: 화면 전체 strings, Gantt native Instance·Scroll/Editor 비회귀, 장문 영어·베트남어와 5 viewport, Date/Number, SSR Hydration, TypeScript/Vitest/SQLite/HTTP/E2E8 smoke. 현재 Phase A에서 AC02~09는 부분/미구현으로 분류하고 완료라고 보고하지 않는다.

## 테스트·품질

`tests/lib/i18n-phase-a.test.ts`: registry/store/static catalog, storage-denial, SSR, 안전한 User Input, SVAR, date-only. `tests/e2e/issue-866-language-shell.spec.ts`: browser ko/en/vi 선택·영속·HTML lang·잘못된 저장값 fallback. 현 한국어 UI E2E legacy assertion은 Playwright/Transport default locale ko-KR 고정하고 신규 언어 테스트만 별도 en-US로 실행한다. 이는 기존 QA assertion 약화나 E2E skip이 아니다.

No Owner release approval. Existing `v0.141.1` annotated tag/OCI fingerprint 및 #865/#869 제품 기능은 불변. `release_required=true`, `release_authorized=false`. Phase A PR CI/Trusted를 통과해도 전체 #866 CLOSED/정식 게시 근거가 아니다.
