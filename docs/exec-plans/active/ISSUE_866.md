# Issue #866 — 한국어·영어·베트남어 국제화 / 최신 Main 분리 실행 계획

- Primary: https://github.com/planner77/masterGantt/issues/866
- 선행 통합 PR(역사적 참고, **직접 병합 금지**): https://github.com/planner77/masterGantt/pull/870
- 확정 Owner 정책: ko/en/vi 수동 선택, 최초 브라우저 선호 참고, 브라우저별 지속, unsupported=ko, 자유 입력 원문 불변, 관리형 기준정보 기존 ID/name/Unique 유지+수동 표시명/원문 fallback.
- Phase A 기준 Main: `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, 앱 `0.141.1`, SVAR React Gantt `2.7.3`.
- 현재 분리 후보: Phase A `v0.142.0`, `risk_level=HIGH` / `qa_method=OWNER_MANAGED` / `qa_required=true` / `release_required=true` / `release_authorized=false`. **Phase B/C 완료와 별도 정식 버전 승인이 있을 때까지 병합·정식 GHCR 발행 금지**.

## BASELINE_AND_SCOPE

구 PR #870는 **339개 변경 파일**에 현재 이미 구현 완료된 #865 사내 LLM 및 #869 Project Issue 레이아웃·E2E까지 혼합하고 기준 app version `0.139.1→0.140.0`이다. 현 Main에는 해당 기능이 이미 병합되어 있으며 실제 현재 버전 `0.141.1`을 사용한다. 과거 전체 PR Tree/버전을 Main에 재적용하면 운영 코드·권한·UI·migration 회귀 위험이 있다. 기존 PR의 i18n 구현에서 **순수 언어 registry/store/provider/selector, core static catalog, SVAR locales, 날짜 출력 helper, 상단 Navigation**만 선택 재사용한다. Domains/API/DB/기준정보 번역, LLM, Issue form 레이아웃, 오래된 E2E는 이 Phase A에 포함하지 않는다.

## PHASE_A_IMPLEMENTATION

- **E2E 명시 샤드 필수:** 신규 spec를 기존 `tests/config/e2e-shard-plan.json` Shard5(기존17→18)로 등록. 이미 존재한143개 spec의 배치·historical projectedMs·source Run 증거는 보존, 새 spec 1개의 duration은 `REMOTE_UNMEASURED`. Full E2E8/8 완료 전 실제 속도/전체 PASS를 가정하지 않는다.

1. `src/lib/i18n/{locales,store,provider,locale-selector,index}.ts(x)`, `catalogs/{core,shell}.ts`: explicit ko/en/vi 선택, localStorage `mastergantt.ui.locale`, 저장 미허용 시 탭 메모리 선택, 다른 브라우저 설정·미지원 언어 fallback, React `useSyncExternalStore`로 서버/첫 hydration 기본 ko를 유지하고 클라이언트 lang/사전·숫자 표시를 동기화한다. 번역은 정적 plain text만, 원본 유저 문자열은 임의 자동 번역하지 않는다. 안전한 오류 코드는 검증된 whitelist만 사용자 표시.
2. `src/app/layout.tsx`, `src/components/{workspace-shell,workspace-navigation}.tsx`: 상단 header 언어 선택기를 기존 Notification Portal **옆**에 추가하며 portal ID는 보존. 내비게이션/ARIA/skip link만 즉시 번역하고 도메인 본문은 추후 Phase C. `globals.css`의 3열 헤더/가로스크롤 Nav/selector/focus/모바일 폭·알림 영역을 보존한다.
3. `src/lib/date-display.ts`: `SSR_DATE_LOCALE=ko-KR`, 사용자가 선택한 locale > 브라우저 선호. date-only 출력에는 UTC 기준 calendar day만 적용하고 서버 저장일·일정 엔진/Work Calendar 계산에 영향을 주지 않는다. 실제 화면별 formatter 재연결은 Phase C.
4. `src/features/gantt/svar-locales.ts`, `project-gantt.tsx`, `svar-gantt.tsx`: SVAR 공식 `Locale words` 확장으로 한국어/영어/베트남어 static words/core/calendar를 제공하되 `weekStart=1`, iso W##/일정·정규 task ID/기간/관계/스크롤 상태를 건드리지 않는다. Locale Provider에 키를 넣어 Gantt를 remount하지 않으며 Gantt의 텍스트와 날짜 계산은 별개. 공식 참조: https://docs.svar.dev/react/gantt/guides/appearance/localization/ 및 https://docs.svar.dev/react/gantt/samples/ .
5. `tests/config/{playwright,transport}.config.ts`: 기존 테스트가 한국어 UI를 기준으로 작성된 사실을 숨기지 않고 기본 Browser Locale을 명시적 ko-KR로 **고정**하며, 새 국제화 E2E에서 개별 en-US/ko-KR을 override한다. CI Required Quality/E2E8/Docker/Trusted/Runner·cache·timeout·skip/retry는 변경하지 않는다. `package.json` / lock의 root 세 버전만 `0.142.0`으로 동기화하고 packages graph 불변.

## TEST_LIFECYCLE_REVIEW

- **ADD** `tests/lib/i18n-phase-a.test.ts` — 선택/브라우저 precedence·미지원/저장 금지·SSR 첫 렌더·reload·정적 번역 키·plain-text/비밀 노출 방지·원문 이름·숫자·SVAR 3개 로케일과 weekStart=1·date-only 음성.
- **ADD** `tests/e2e/issue-866-language-shell.spec.ts` — ko→en→vi 상단 헤더/ARIA/HTML lang/브라우저 저장/새로고침/URL 불변, 잘못된 값 fallback, 최초 en-US 선택. Phase A 외의 미번역 도메인 텍스트는 영어 번역을 주장하지 않는다.
- **KEEP_UNIQUE** `tests/lib/date-display.test.ts`의 UTC date-only 불변/시간대 원본, Gantt Core/Store/Viewport/E2E/실제 SQLite/Task Editor·WorkCalendar/Item 관리·권한 및 기존 transport/QA 테스트. Phase B/C에서 #866 기존 PR의 `tests/e2e/{i18n,i18n-master-data}.spec.ts`를 **최신 API/스키마에 맞춰 독립 재검증 후** 이식한다.
- 분리 트랜치/새 PR exact Head의 로컬 Node/Chromium/Docker/SQLite 실제 테스트는 **NOT TESTED**(GitHub 커넥터 코드 검토). 새 Full PR CI 시작·검증 전 기존 PR #870의 과거 PASS를 재사용/소급하지 않는다.

## DEPENDENCIES_AND_PENDING_AC

- **AC01 Phase A 구현**: registry/selector/storage + 새 Vitest/Playwright 검증. Phase A CLI/remote 결과 대기.
- **AC02 PARTIAL**: 헤더·내비게이션·Gantt static words만; Project List/Workspace/Issue/Editor/Dashboard/관리자는 한국어 문구 잔여 → **Phase C**.
- **AC03 PARTIAL**: SVAR custom words/Locale & weekStart; native Gantt *실제 인스턴스 보존/스크롤/Task edit/Day-week* 전수 원격 회귀 → **Phase C**.
- **AC04~AC06 NOT IMPLEMENTED**: owner별 관리형 기준정보 전역·프로젝트 표시명 저장 테이블/서비스/API/권한/마이그레이션/Copy·Template·Export 손실 가드 → **Phase B**, 기존 ID/code/name은 변경 금지.
- **AC07 PARTIAL**: 날짜 출력 helper/SSR 언어, 각 화면 날짜/숫자 formatter·진척/KPI 확인 → **Phase C**.
- **AC08 PARTIAL**: 헤더와 selector 390px 대응·ARIA, 전체 화면/관리 UI/긴 베트남어 접근성 5폭 시험 → **Phase C**.
- **AC09 PARTIAL**: Phase A tests; 전 영역 DB/HTTP/E2E/원본 파일·유사 테스트 inventory 및 fail-closed 회귀 → 각 Phase별 추가.
- 완성된 i18n·동시 저장·데이터 격리/실환경 검증까지 #866를 OPEN. **Phase A PR Full CI SUCCESS만으로 #866 전체 AC 충족·merge/Release/Issue 종료 권한 없음.**

## DOCUMENTATION_SYNC

- `AGENTS.md`: N/A(기존 테스트 검색, Owner Managed QA·변경 영향/릴리스 정책 준수; 본 PR에서 정책 자체를 바꾸지 않음)
- `DESIGN.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: N/A(국제화 기반은 컴포넌트 단위 별도 설계에 기록, 서버·경로 토폴로지 불변)
- `docs/API.md`: N/A(Phase A에서 API/DTO/server validation·HTTP 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(Phase A에서 DB·migration 전혀 변경 없음; Phase B에서 추가형 이관 예정)
- `docs/SECURITY.md`: N/A(Phase A 보안·권한 정책 불변, client static catalog만 추가)
- `docs/QA_REVIEW_POLICY.md`: N/A(고위험 Owner Managed·Trusted 검증 규칙 그대로 적용)
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 CI Finalizer·Owner 승인·PR Head lease 규정 보존)
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: N/A(phase 기반 부분 구현은 Issue open을 유지하며 기존 lifecycle 규칙 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(Phase A는 import/export schema/원본 식별자 불변)
- `docs/UI_UX_GUIDELINES.md`: N/A(상단 select/3열 헤더는 이 계획과 DESIGN.md에 수치 명시, 기존 UI 원칙 불변)
- `docs/TASK_EDITOR.md`: N/A(Task Editor 사용자 텍스트·상태/드래프트 불변)
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: N/A(Project Issue 레이아웃과 업무상태·개별 비밀번호 UI 현재 단계 비번역, #869 완료 내용 유지)
- `CHANGELOG.md`: UPDATED
- `docs/I18N_PHASE_A.md`: UPDATED
- `docs/exec-plans/active/ISSUE_866.md`: UPDATED
- `docs/ISSUE_866_FAILURE_ANALYSIS.md`: UPDATED
- `src/app/layout.tsx`: UPDATED
- `src/app/globals.css`: UPDATED
- `src/components/workspace-shell.tsx`: UPDATED
- `src/components/workspace-navigation.tsx`: UPDATED
- `src/lib/date-display.ts`: UPDATED
- `src/lib/i18n/index.ts`: UPDATED
- `src/lib/i18n/locales.ts`: UPDATED
- `src/lib/i18n/store.ts`: UPDATED
- `src/lib/i18n/provider.tsx`: UPDATED
- `src/lib/i18n/locale-selector.tsx`: UPDATED
- `src/lib/i18n/catalogs/core.ts`: UPDATED
- `src/lib/i18n/catalogs/shell.ts`: UPDATED
- `src/features/gantt/svar-locales.ts`: UPDATED
- `src/features/gantt/project-gantt.tsx`: UPDATED
- `src/features/gantt/svar-gantt.tsx`: UPDATED
- `tests/lib/i18n-phase-a.test.ts`: UPDATED
- `tests/e2e/issue-866-language-shell.spec.ts`: UPDATED
- `tests/config/playwright.config.ts`: UPDATED
- `tests/config/e2e-shard-plan.json`: UPDATED
- `tests/config/transport.config.ts`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED

## AC_TEST_COVERAGE

- AC01: `tests/lib/i18n-phase-a.test.ts` selected/browser/invalid/SSR/storage 및 `tests/e2e/issue-866-language-shell.spec.ts`; Phase A implementation, remote pending.
- AC02: `src/components/{workspace-shell,workspace-navigation}.tsx` + test shell only; all other screen localization **Phase C TODO**.
- AC03: `src/features/gantt/svar-locales.ts`, native `project-gantt.tsx` and demo `svar-gantt.tsx`, locale words/weekStart unit; native instance E2E **Phase C TODO**.
- AC04: Domain master-data translation **Phase B NOT TESTED/NOT IMPLEMENTED**; planned SQLite/admin API/owner isolation tests.
- AC05: Role/CSRF/revision/owner migration security **Phase B NOT TESTED/NOT IMPLEMENTED**; existing permission tests KEEP_UNIQUE.
- AC06: SQLite additive migration/old DTO/Copy/Template/Export **Phase B NOT TESTED/NOT IMPLEMENTED**.
- AC07: `src/lib/date-display.ts` UTC/locales and `tests/lib/date-display.test.ts` existing, screen-wide formatting **Phase C TODO**.
- AC08: header select CSS/accessibility new E2E; full screen/5 widths/hydration **Phase C TODO**.
- AC09: test lifecycle search new partial suites and keep unique, full production source/DB/E2E **Phases B/C TODO**.

## IMPLEMENTATION_HANDOFF

- 이 단계의 끝점은 Phase A의 분리 PR과 **Full PR CI 시작**까지만. Owner는 Phase A만 병합·릴리스 승인한 적 없음; `release_authorized=false`. 코드 리뷰/충돌/실패 원장 보완 및 성공한 Full·Trusted QA를 확보한 뒤에도 Phase B/C 기능 완료/발행 여부를 별도 결정한다.
