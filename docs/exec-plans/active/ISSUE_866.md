## REWORK-B004 — PR #879 Full #3515.1 직접 TS 9건·Vitest 3건 (2026-11-05)

- 원본 [Run 41947822098.1](https://github.com/planner77/masterGantt/actions/runs/41947822098), HEAD `7e861e458135f6fe35e88394ed376b152420c688`, main `364aa3bdfde16fd3ca79add61c35a1cde21f6395`. Preflight/Policy/ESLint PASS; TypeScript Job126984569355 TS2554/TS2339/TS2352 총9, Vitest Job126984569338 migration 적용 목록 3 FAIL(3536 PASS/3 SKIP), Required3/FastGate/QA는 파생 FAIL, E2E8·Docker·Next Build SKIPPED.
- **원인·구현:** Phase B 언어별 그룹 필터 UI는 `filterGroups(groups,query,locale)`을 호출하나 검색 helper가 기존 2인자만 허용. canonical name/code/id 검색을 보존하면서 현재 locale 표시명 검색과 다른 언어 매칭 격리를 추가. 런타임 snapshot의 `translations` 데이터는 존재하나 Resource Dashboard/WBS/Logistics public DTO 타입 선언이 누락; 선택적 DisplayNameTranslations 메타데이터를 DTO에 표현하고 cast를 제거. 신규 migration 0036이 정상 추가된 상태에서 구 테스트의 hardcoded 적용 목록·최고 버전 35 계약만 stale; 새 이력 0036 및 version36을 포함하되 원본 레코드/checksum/foreign-key/idempotent 단언은 그대로 유지.
- **TEST_LIFECYCLE_REVIEW:** EXTEND 기존 `tests/features/resources/resource-search-filter.test.ts` ko/en/vi/원본-ID/언어 격리, `tests/server/projects/project-issues.test.ts` 0032·0033→0036 보존 회귀, `tests/server/calendars/country-calendar-integration.test.ts` 0034→0036 보존 회귀. KEEP_UNIQUE 번역 snapshot·KPI와 145 Playwright spec/Chromium8, Phase A/B DB·HTTP·권한·동시수정·Copy/Template/Import/Export 회귀. ADD/DELETE/SKIP 없음, QA·CI 정책/마이그레이션 본문·릴리스 권한 불변.
- **DOCUMENTATION_SYNC (REWORK-B004):** 정규 `## DOCUMENTATION_SYNC`에 아래 영향 파일을 UPDATED로 추가하고 본 Work Packet·누적 실패 원장을 갱신한다. 신규 Head의 원격 TypeScript/Vitest/E2E8/Docker/Trusted 결과는 PR CI 전 NOT TESTED. 미해결 inline thread 0, 이전 P2 resolved, mergeable=true; #866 OPEN, release_authorized=false.

## REWORK-B003 — #3514.1 문서 영향 반복 실패 원인 및 교정 (2026-11-05)

- 원본 [Full #3514.1 Run 41946308147.1](https://github.com/planner77/masterGantt/actions/runs/41946308147), Head 420781ac039e75adbc4143525a848c5e6bb2ca68 / Main 364aa3bdfde16fd3ca79add61c35a1cde21f6395 / test-merge 765f10ba4696cad4b269741eb57f563d18fdb94a. QA Preflight Job126979392129 직접 DOCUMENTATION_SYNC FAIL (docs/IMPORT_SCHEMA.md missing), 세 Required 집계·QA Final은 파생, Node/E2E8/Docker NOT RUN.
- B002에서 갱신한 문서 본문과 ### DOCUMENTATION_SYNC (REWORK-B002)는 base의 검증기가 읽는 정규 `## DOCUMENTATION_SYNC`가 아니었다. 신뢰된 `scripts/qa_final_automated.py::section` 및 `docs_gate`는 정확한 2단계 heading 내부 `- `path`: UPDATED|N/A(reason)`만 인식한다. 검증기를 완화하지 않고 해당 **단일 정규 절**을 통합 변경 범위(Phase A+B)에 맞게 수정했다.
- 전체 Main diff와 docs_required를 대조한 필수 6문서: DESIGN.md, docs/TEST_PLAN.md, docs/DB_SCHEMA.md, docs/API.md, docs/IMPORT_EXPORT.md, docs/IMPORT_SCHEMA.md. 전부 실제 변경되었으므로 UPDATED. 함께 SECURITY/UI_UX/PROJECT_UX/LOGISTICS_DOMAIN_DESIGN/I18N_PHASE_B 등 영향 문서도 정합화. 정규 `## AC_TEST_COVERAGE`의 현재 구현·미검증 상태 수정.

### TEST_LIFECYCLE_REVIEW (REWORK-B003)

- ADD/RETIRE 없음. KEEP_UNIQUE: 기존 Test Lifecycle/Required3/Chromium8, Phase A language-shell/SVAR, Phase B SQLite/HTTP·Import/Export/Copy/Template·412 경합/145 E2E spec. 제품/테스트/정책/skip/retry/timeout 수정 없음. Remote new Head NOT TESTED.

### DOCUMENTATION_SYNC (REWORK-B003)

- UPDATED: docs/exec-plans/active/ISSUE_866.md의 exact `## DOCUMENTATION_SYNC`와 `## AC_TEST_COVERAGE`, docs/ISSUE_866_FAILURE_ANALYSIS.md, docs/I18N_PHASE_B.md.
- N/A: AGENTS.md, CI/CD workflow, scripts/qa_preflight.py, scripts/qa_final_automated.py, DB migrations/제품/Release 변경 없음. 기존 docs/IMPORT_SCHEMA.md 본문은 B002 갱신 그대로 보존.
## REWORK-B002 — PR #879 Full #3513.1 문서 영향과 물류 유형 동시 편집 교정 (2026-11-05)

- 원본 [Full #3513.1 / Run 41943199412.1](https://github.com/planner77/masterGantt/actions/runs/41943199412), HEAD `20f106f39f90d838193234c5bb0320977fe4af91`, base main `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `1645f96490dc08e09efbe082c38b4de4f84213f4`. 최초 QA Preflight Job126968984659의 **DOCUMENTATION_SYNC FAIL: docs/IMPORT_SCHEMA.md 미기록** (FAIL1/DEFERRED5); FastGate/Required Quality·E2E·Docker/QA Final은 파생, 실제 TS/Vitest/Chromium8/Docker SKIPPED.
- **문서 결정:** 일정 Import schema 1.0/1.1 기계 계약은 변경하지 않음. 관리형 표시명 ko/en/vi와 Project Copy/Template v6의 별도 snapshot 계약, 일정 Export의 `409 DISPLAY_NAME_TRANSLATIONS_EXPORT_UNSUPPORTED` 손실 거부를 `docs/IMPORT_SCHEMA.md` 상단에 명시한다. 기존 JSON schema 및 `src/contracts/import.ts`/validator 변경 없음.
- **P2 리뷰 [r4475215195](https://github.com/planner77/masterGantt/pull/879#discussion_r4475215195):** LogisticsTypeCatalogAdmin은 기존 TranslationEditor와 달리 독립적인 수정 폼이었다. 첫 수정 당시 global catalog revision을 보존하고 412·갱신 뒤 기존 번역 초안을 다른 언어까지 덮어쓰지 못하도록 저장 버튼/submit 차단 및 alert, 취소 후 재열기 정책을 동일하게 적용.
- AC04/AC05 번역 동시 수정/권한·기본 이름 불변 보호, AC06 Import 스키마 호환·Copy/Template/Export 손실 방어, AC09 테스트 원장·문서 영향 추적. Phase C AC02/03/07/08/09 전수 검증은 별도.

### TEST_LIFECYCLE_REVIEW (REWORK-B002)

- EXTEND `tests/e2e/logistics-type-catalog-admin.spec.ts` — 412 concurrency/기존 초안·신규 revision/다른 관리자 vi 변경 보존/중복 PATCH 거부/최신 원본 재편집. KEEP_UNIQUE `tests/e2e/resource-catalog-delete.spec.ts`, `tests/e2e/i18n-master-data.spec.ts`, `tests/lib/i18n-translation-write-field.test.ts` 및 기존 SQLite/HTTP/Import/Template/Copy/Gantt/E2E.
- 기존 145 E2E spec/8-shard 계획, 모든 Required Check/QA, 테스트 assertion·retry/timeout·skip 불변. 새 Head의 실제 테스트 결과는 CI 실행 전 NOT TESTED.

### DOCUMENTATION_SYNC (REWORK-B002)

- UPDATED: `docs/IMPORT_SCHEMA.md` (strict 일정 JSON 1.0/1.1의 번역 비지원과 손실 방어), `docs/exec-plans/active/ISSUE_866.md` (본 기록), `docs/ISSUE_866_FAILURE_ANALYSIS.md` (최초부터 실패 전수), `docs/I18N_PHASE_B.md` (동시 수정 설계). 관련 UI/E2E 최신 수정.
- N/A: AGENTS.md, docs/TEST_PLAN.md (선행 P1 복원 원본 정책 보존/본 Work Packet에서 Phase B 테스트 상세 추적), docs/IMPORT_EXPORT.md (이미 Export 409, Copy/Template v6 기록되어 있으며 기계 Import 계약은 이 문서에 명시), DB schema/마이그레이션, CI policy/Required3, package/lock, Main 릴리스 경로. 모두 현재 규정 그대로.

## REWORK-B001 — PR #879 Full #3510.1 Preflight BLOCKED 및 Codex P1/P2 보완 (2026-11-05)

- 원본 Full #3510.1 / Run 41941093006.1, HEAD dfc967258f5fa0cc8e188d116cdccd734f49c771, Base #878 HEAD 8fca83bbc12cf516cd7f22438fa16c6b596d80fb, test-merge 28d4bb5ece15503393808ecbcc5410168264fe02. 직접 QA Preflight 126961958453 POLICY_CI FAIL (base.ref != main), Fast Gate/Required3/QA Final은 파생. Vitest/TypeScript/E2E8/Docker NOT RUN.
- 설계 변경: 신뢰된 main-base QA 정책은 유지하고 PR #879의 GitHub 대상만 main으로 변경. Main diff에는 Phase A+B가 포함되나 선행 #878은 그대로 OPEN, 병합/정식 GHCR/Issue #866 종료는 승인되지 않음.
- Codex P1: Phase B 작성 시 docs/TEST_PLAN.md가 빈 fetch content로 덮인 결함. Phase A 원본 Git Blob 990eee5eb1e21cbffcd091b1331dba315d5990ee로 복원. 기존 5762줄 정책 source 보존, Phase B 테스트 내역은 본 Work Packet/별도 설계·실패 원장에서 추적.
- Codex P2: TranslationEditor는 snapshot(revision, translations)을 캐시하고 현재 catalog revision 변화 시 저장을 막고 경고를 표시. 리소스 그룹과 프로젝트 마스터 양쪽 적용. 서버 If-Match 변경 없이 stale silent overwrite 방지.

### TEST_LIFECYCLE_REVIEW (REWORK-B001)
- EXTEND tests/e2e/resource-catalog-delete.spec.ts: 2명 관리자 동시 갱신(모의), refresh revision 갱신, stale draft 저장0/초안 보존/경고, 취소 후 재열기, 최신 vi 유지 및 en 저장 확인.
- KEEP_UNIQUE #866 기존 관리형 마스터 SQLite/HTTP 테스트, Phase A locale shell, 145개 E2E spec/8 shards/Required3 및 QA 원본 검증. 신규 E2E 파일 없음. 전체 신규 source의 원격 테스트 결과는 NOT TESTED.
- AC04/AC05 revision 경쟁 회귀 방어, AC06 원본 migration/Copy/Template 불변; AC02/03/07/08/09 Phase C 미완료.

### DOCUMENTATION_SYNC (REWORK-B001)
- UPDATED docs/ISSUE_866_FAILURE_ANALYSIS.md, docs/exec-plans/active/ISSUE_866.md, docs/I18N_PHASE_B.md, docs/REMOTE_VALIDATION.md, PR #879 및 component/consumer/E2E.
- RESTORED docs/TEST_PLAN.md to exact Phase A source Blob; 정책 내용/원본 line 손실 없이 기존 Test Lifecycle source of truth 유지.
- N/A AGENTS.md, scripts/qa_preflight.py, CI workflow, QA/Trusted/Owner, packages, DB migration/권한 정책 수정 없음.

## PHASE_B_DELIVERY — 2026-11-05 (종속 PR / 최신 상태)

- Phase A Full PR #878 [#3509.1](https://github.com/planner77/masterGantt/actions/runs/41930396372) 성공 확인. 병합 및 정식 릴리스 미승인.
- 이번 Phase B는 Phase A Head 기반 브랜치 feat/issue-866-i18n-phase-b-owner-data로 구현한 **종속 PR**. 저장·권한·UI/12 owner, Copy/Template6/Exporter 및 E2E를 추가하되 Phase C 최종 AC가 남으므로 #866 OPEN / release_authorized=false. 과거 Phase A 단락의 NOT IMPLEMENTED는 당시 역사적 상태이며 현재 상태는 본 단락을 우선한다.
- 구현 설계: [Phase B 기술문서](../../I18N_PHASE_B.md). 신규 정확 Head 원격 Full CI/Trusted 및 실환경 백업·권한·5폭 검증 전 NOT TESTED. #870 원본 전체 PR 재사용·병합 금지.

### TEST_LIFECYCLE_REVIEW (Phase B)

- ADD: tests/server/i18n/managed-display-names.test.ts, tests/lib/i18n-translation-write-field.test.ts, tests/e2e/i18n-master-data.spec.ts.
- EXTEND: tests/server/db/database.test.ts, tests/server/migration-cli.test.ts, 기존 공정/물류/리소스/Template/Copy 관련 서비스 tests, tests/scripts/e2e-shard-planner.test.ts.
- KEEP_UNIQUE: Phase A tests/lib/i18n-phase-a.test.ts 및 tests/e2e/issue-866-language-shell.spec.ts, DB/HTTP/권한/Task/Gantt/Calendar/Chromium8 기존 사례.
- Remote new Head test 결과는 NOT TESTED. Shard7 신규 1개(17→18), 145개 spec 1:1, 기존 144개 이동 0.

### AC_TEST_COVERAGE (Phase B 추가)

- AC04: migration 0036/owner 12/DisplayNameTranslations/CRUD service/관리 UI + unit/SQLite/E2E. 전 owner 브라우저 실증 필요.
- AC05: 기존 global admin 및 project edit 세션 + revision/Origin/If-Match 재사용·음성 사례, 새 exact HEAD 원격 검증 필요.
- AC06: 0035→0036, copy/template6, export 명시거부, 신규 DB/reopen/FK/백업 복원 추가 검증 필요.
- AC02/03/07/08/09: Phase C 전 화면·Gantt 상태·장문/접근성·전수 검증 미완료.

### DOCUMENTATION_SYNC (Phase B 추가)

- UPDATED: docs/I18N_PHASE_B.md, docs/exec-plans/active/ISSUE_866.md, docs/ISSUE_866_FAILURE_ANALYSIS.md, docs/DB_SCHEMA.md, docs/API.md, docs/TEST_PLAN.md (원본 복원), docs/REMOTE_VALIDATION.md, docs/SECURITY.md, docs/IMPORT_EXPORT.md, docs/UI_UX_GUIDELINES.md, docs/PROJECT_UX.md, docs/LOGISTICS_DOMAIN_DESIGN.md, DESIGN.md, CHANGELOG.md, docs/REQUIREMENTS.md.
- N/A: AGENTS.md (기존 QA/보안/독립 Owner 규칙 준수, 정책 변경 없음), docs/ARCHITECTURE.md (서버·배포 토폴로지 불변), CI workflow/Runner/Required3/GHCR 운영 변경 없음.

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

현재 원장은 Main 대비 PR #879의 Phase A+B 통합 diff 기준이다. 아래 역사적 Phase A 시점 N/A 기록보다 본 정규 절의 UPDATED/N/A가 최신 검증 기준이다. 테스트 정책 원문 docs/TEST_PLAN.md는 이전 오류에서 복원해 보존했으며 Main 대비 Phase A 변경분이 있어 UPDATED이다.

- `AGENTS.md`: N/A(기존 테스트 검색, Owner Managed QA·변경 영향/릴리스 정책 준수; 본 PR에서 정책 자체를 바꾸지 않음)
- `DESIGN.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: N/A(국제화 기반은 컴포넌트 단위 별도 설계에 기록, 서버·경로 토폴로지 불변)
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/SECURITY.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(고위험 Owner Managed·Trusted 검증 규칙 그대로 적용)
- `docs/CI_CD.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 CI Finalizer·Owner 승인·PR Head lease 규정 보존)
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: N/A(phase 기반 부분 구현은 Issue open을 유지하며 기존 lifecycle 규칙 변경 없음)
- `docs/IMPORT_EXPORT.md`: UPDATED
- `docs/IMPORT_SCHEMA.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TASK_EDITOR.md`: N/A(Task Editor 사용자 텍스트·상태/드래프트 불변)
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: N/A(Project Issue 레이아웃과 업무상태·개별 비밀번호 UI 현재 단계 비번역, #869 완료 내용 유지)
- `CHANGELOG.md`: UPDATED
- `docs/I18N_PHASE_B.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/I18N_PHASE_A.md`: UPDATED
- `docs/exec-plans/active/ISSUE_866.md`: UPDATED
- `docs/ISSUE_866_FAILURE_ANALYSIS.md`: UPDATED
- `src/features/resources/resource-search-filter.ts`: UPDATED
- `src/contracts/resource-dashboard.ts`: UPDATED
- `src/contracts/wbs-dashboard-views.ts`: UPDATED
- `src/contracts/logistics-dashboard.ts`: UPDATED
- `src/server/resources/resource-dashboard-service-core.ts`: UPDATED
- `tests/features/resources/resource-search-filter.test.ts`: UPDATED
- `tests/server/projects/project-issues.test.ts`: UPDATED
- `tests/server/calendars/country-calendar-integration.test.ts`: UPDATED
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
- `tests/e2e/project-workspace-layout.spec.ts`: UPDATED(REWORK2 native Gantt en-US/ko-KR header contract)
- `tests/config/playwright.config.ts`: UPDATED
- `tests/config/e2e-shard-plan.json`: UPDATED
- `tests/config/transport.config.ts`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED

## AC_TEST_COVERAGE

Full #3515.1에서 Phase B의 TypeScript·Vitest 직접 FAIL을 확인하고 REWORK-B004 보완했으나, 보완 후 새 exact HEAD 전체 원격 PASS는 미확인이다. 기존 AC01 Phase A 성공을 Phase B/Phase C로 승계하지 않는다.

- AC01: Phase A Full #3509.1 PASS (exact Head 8fca83b)로 공통 언어 선택·storage·SVAR header 검증. Phase B 현재 Head의 전체 검증은 별도.
- AC02: `src/components/{workspace-shell,workspace-navigation}.tsx` + test shell only; all other screen localization **Phase C TODO**.
- AC03: `src/features/gantt/svar-locales.ts`, native `project-gantt.tsx` and demo `svar-gantt.tsx`, locale words/weekStart unit; native instance E2E **Phase C TODO**.
- AC04: Phase B migration 0036/12 owner, 수동 표시명 API/관리 UI 및 SQLite·브라우저 테스트를 구현했으나 신규 Head 원격 실행은 Preflight 차단으로 NOT TESTED.
- AC05: 기존 global admin/Project edit·Origin/If-Match CAS·격리 및 ResourceGroup/ProjectMaster/Logistics Type의 412·stale draft 경합 보호 구현, 신규 CI 아직 NOT TESTED.
- AC06: SQLite 0035→0036, Project Copy·Template v6 번역 보존, 일정 JSON/Excel 409 손실 방어 및 Import 1.0/1.1 strict schema 불변, 신규 CI/운영 백업복원 NOT TESTED.
- AC07: `src/lib/date-display.ts` UTC/locales and `tests/lib/date-display.test.ts` existing, screen-wide formatting **Phase C TODO**.
- AC08: header select CSS/accessibility new E2E; full screen/5 widths/hydration **Phase C TODO**.
- AC09: Test Lifecycle ADD/EXTEND/KEEP_UNIQUE 기록과 145 spec·8-shard 배치·기존 test policy 원문 보존, 신규 전체 CI·Trusted 검증 NOT TESTED.

## IMPLEMENTATION_HANDOFF

- 이 단계의 끝점은 Phase A의 분리 PR과 **Full PR CI 시작**까지만. Owner는 Phase A만 병합·릴리스 승인한 적 없음; `release_authorized=false`. 코드 리뷰/충돌/실패 원장 보완 및 성공한 Full·Trusted QA를 확보한 뒤에도 Phase B/C 기능 완료/발행 여부를 별도 결정한다.

## REWORK1 — PR #878 Full #3507.1 Vitest E2E shard-count 테스트 동기화 (2026-11-05)

- **원본** [Run 41921474942.1](https://github.com/planner77/masterGantt/actions/runs/41921474942), Head `ccf39510441a447d3df8f9f85ee3c9b1e22008ce`, Base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, Unit Job `126895162188`: `tests/scripts/e2e-shard-planner.test.ts:107` 기대 `[19,18,18,18,17,18,17,18]` vs 실제 `[19,18,18,18,18,18,17,18]`. **직접 TEST_CONTRACT 실패 1건**, Vitest 3527 PASS/1 FAIL/3 SKIPPED, 기존 i18n 6 Unit PASS. Policy/Typecheck/Lint/Preflight PASS, Fast Gate/Required3·QA 파생 FAIL, Chromium8/Docker/Next build 실제 실행은 SKIPPED. 상세 [누적 원장](../../ISSUE_866_FAILURE_ANALYSIS.md).
- **보완** `tests/scripts/e2e-shard-planner.test.ts`의 기존 count assertion은 유지하고 Shard5의 신규 파일 1개만 17→18로 정확히 변경, `issue-866-language-shell.spec.ts`→Shard5 매핑을 **추가 검증**. 테스트 삭제·skip·hash fallback·shard 이동·retry/timeout 완화 없이 144개 spec 1:1 배치/과거 143개 보존. `tests/config/e2e-shard-plan.json`의 원본 불변.
- **TEST_LIFECYCLE_REVIEW**: 기존 `tests/scripts/e2e-shard-planner.test.ts`를 EXTEND; `scripts/e2e-shard-planner.mjs`, `tests/config/e2e-shard-plan.json`, 나머지 Gantt/E2E/Locale 6 Unit/Date6/CI tests는 KEEP_UNIQUE. 직접 영향/인접/음성 소비자 합집합과 미실행 범위는 원장 기재. 새 정확 HEAD Full PR CI 전 원격 검증 NOT TESTED.
- **DOCUMENTATION_SYNC 추가:** `tests/scripts/e2e-shard-planner.test.ts`: UPDATED. 실패 원장 및 Work Packet, `docs/TEST_PLAN.md`는 UPDATED 유지. 기존 Issue AC01~09와 미구현 Phase B/C 경계, `release_authorized=false` 보존.
## REWORK2 — PR #878 Full #3508.1 native Grid en-US 헤더 검증 계약 교정 (2026-11-05)

- **원본 실행:** [Full #3508.1 / Run 41924914789](https://github.com/planner77/masterGantt/actions/runs/41924914789), HEAD `cd3f0c57953a0bd50a0ac74c0303211e08b20e68`, base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `6eef294a77b93b30dd0d90184a51b44035a8d014`. Shard4 Job `126908178973`의 `tests/e2e/project-workspace-layout.spec.ts:83` **en-US** 사례가 Gantt native Grid 헤더 `외부 ID`를 찾다 FAIL(번역 후 실제 `External ID`, 5s). ko-KR 같은 spec PASS, shard4 33 PASS/1 FAIL/59 미실행. Shard7 SUCCESS, 1/2/3/5/6/8 취소; QA·Required E2E 파생 FAIL, Quality·Docker·Vitest 3528 PASS. GitCommitInfo fetch 3초 경고는 이어지는 33 PASS와 직접 UI assertion 실패를 고려할 때 비차단 진단 메시지다.
- **원인:** 기존 E2E는 `en-US`로 강제한 날짜·고정 헤더 검증에서도 SVAR native 헤더만 `외부 ID` 한국어를 고정 기대했다. Phase A `SVAR_LOCALES.en.gantt["외부 ID"]="External ID"`가 정상 적용되면서 기존 테스트만 낡은 **TEST_CONTRACT**가 됨. Custom Column Menu checkbox `외부 ID`는 Phase C 이전 미번역이므로 Gantt 원본 텍스트와 독립적이다.
- **보완/수용:** `tests/e2e/project-workspace-layout.spec.ts`를 **EXTEND**해 ko-KR→`외부 ID`, en-US→`External ID` 정확한 헤더·잘못된 언어 부재 및 `<html lang>`를 단언. 기존 Column Menu checkbox 원문·날짜/스크롤/Project 설정·헤더 고정/동일 Gantt instance/API/선택/60 rows·문서 overflow/JS 에러·Escape/focus 검사 삭제 없음. `tests/lib/i18n-phase-a.test.ts` SVAR native 3언어 표시명 단언을 **EXTEND**해 ko/en/vi 사용 여부를 스펙에 고정. 필요 테스트·CI skip/timeout/retry/8-Shard 스케줄/제품 코드/DB/API는 불변.
- **전체 실패 원장:** [#866 누적 원장](../../ISSUE_866_FAILURE_ANALYSIS.md) `FULL-001`(샤드 숫자 회귀, 이번 #3508.1 Vitest 성공으로 재검증) 및 `FULL-002`(영어 Grid UI 원문 기대 실패) 모두 보존. 다른 취소 샤드, Phase B/C 검증은 **NOT TESTED**.
- **TEST_LIFECYCLE_REVIEW:** 기존 E2E `project-workspace-layout` 및 i18n Vitest를 EXTEND; `issue-866-language-shell.spec.ts`, `tests/lib/date-display.test.ts`, SVAR locale provider, 144개 Shard plan, 기존 권한·Gantt·Project/SQLite 테스트는 KEEP_UNIQUE. 단언 완화·제품 기능 롤백 금지.
- **DOCUMENTATION_SYNC:** `tests/e2e/project-workspace-layout.spec.ts`: UPDATED; `tests/lib/i18n-phase-a.test.ts`: UPDATED(기존); `docs/I18N_PHASE_A.md`: UPDATED, `docs/TEST_PLAN.md`: UPDATED, `docs/REMOTE_VALIDATION.md`: UPDATED, 원장/본 Work Packet: UPDATED. 나머지는 앞의 N/A/UPDATED 사유 그대로. AC03(번역 native Gantt)/AC07(날짜)/AC08(레이아웃) 테스트를 직접 보강했지만 #866 Phase B/C 미구현은 여전함.
- **승인/검증 경계:** 로컬 TS/Vitest/Playwright/SQLite/Docker 실행은 이번 교정에서 **NOT TESTED**; 새 정확 HEAD Full Quality/E2E8/Docker/Trusted 성공·Main strict·Owner 위험 수용 전 병합 금지. `HIGH/OWNER_MANAGED`, `release_required=true`, `release_authorized=false`, Version 후보 `0.142.0`/Issue #866 OPEN 유지.
