## REWORK-B007 — 기준정보 테이블 이름+번역 버튼 밀도 (2026-11-05)

- In Full #3518.1 Chromium shard7, #457 Master populated table row maximum was 87px vs strict <=48px. Existing input occupied 100% width and new translation dialog trigger wrapped below because Project Master CSS Module omitted the referenced .nameControl class.
- Define .nameControl display:flex/nowrap, gap6/min-width0, centered controls and a shrinkable name input (flex:1 1 0, width0, min-width0). Retain 240px name column within 960px horizontally scrollable table, 40px fine and 44px coarse controls; no forced row heights, clipped text/error, or hidden button. Original name/ID/code and session/CAS untouched.
- Keyboard order: Name -> accessible translation dialog trigger -> Sort -> Save -> Deactivate for used rows. Existing #457 observer asserts row<=48 at 390/1440, focus visibility and scroll owners; add first Tab/aria-haspopup assertion without weakening. Existing Phase B i18n-master-data tests enforce 5 widths x three locales and coarse row<=52. New source browser PASS remains NOT TESTED.

## REWORK-B006 — Resource Target 카탈로그의 선택적 번역 타입 계약 (2026-11-05)

- Resource Dashboard `renderTargets`는 원본 target 카탈로그, Global resource group(선택적 `translations`) 및 resource(번역 미지원)를 동일 표기용 카탈로그로 통합한다. 각 요소의 정규 타입은 `ResourceDashboardTargetProjection["catalog"][number]`이며 `translations?: DisplayNameTranslations`가 선택적으로 존재한다.
- 기존 TypeScript 무주석 배열 spread는 혼합 유니언으로 추론하여 `label?.translations` 접근 시 TS2339 2건을 발생시켰다(Full #3517.1). 명시적 DTO catalog 타입을 선언해 기존 조회값·선택적 속성·fallback 원문·ID/코드·정렬/수량 및 실제 KPI 산식을 보존한다. unsafe cast나 강제 번역 backfill 없음.
- 기존 managed-display-names와 target snapshot/Resource Dashboard tests가 실행된 #3517.1 Vitest 3540 PASS/3 SKIP는 교정 이전 소스의 근거이며, 새 HEAD TS/E2E8/Docker/Trusted PASS 근거가 아니다. Test Lifecycle / 원본 Fail Ledger는 Work Packet과 누적 원장에 보존한다.

## REWORK-B003 — 문서 검증기 정규 heading 및 Phase A+B 최신 영향 (2026-11-05)

- Full #3514.1도 앞선 #3513.1과 동일한 문서 누락으로 Preflight 단계에서 차단. 실제 docs/IMPORT_SCHEMA.md 본문 갱신은 되었으나 Work Packet의 `### DOCUMENTATION_SYNC (REWORK-B002)`는 정책이 요구하는 `## DOCUMENTATION_SYNC` 정규 절이 아님. 검증기 코드가 아닌 작업 문서의 정규 절과 6 Required 경로의 실제 changed-files/UPDATED 여부를 교정.
- Phase A 완료 근거/Phase B 코드 구현과 신규 Head 검증 미실행을 `## AC_TEST_COVERAGE`에 구분하여 기록하고 원본 테스트 정책·DB/API·일정 JSON schema/CI workflow는 불변. 새 Full CI·Trusted 이후 별도 판단.
## REWORK-B002 — 관리형 번역과 일정 교환 계약 및 물류 유형 edit race (2026-11-05)

- 일정 Import JSON 1.0/1.1은 번역 표시명 owner 메타데이터를 표현하지 않으며 machine schema를 변경하지 않는다. 자세한 확정 계약/거부·Copy/Template v6 경계는 [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md) 상단에 추가했다. 기존 Export 409 손실 거부 유지.
- LogisticsTypeCatalogAdmin의 번역 편집은 시작 revision을 고정하고 412 재조회 및 동시 갱신 후 stale draft 저장을 금지한다. 기존 입력값을 유지·경고하고 취소/재열기를 요구하며, 리소스 그룹·프로젝트 마스터 TranslationEditor와 동일한 동시 수정 정책이다.
- [Full #3513.1](https://github.com/planner77/masterGantt/actions/runs/41943199412)은 DOCUMENTATION_SYNC 경로 누락으로 preflight 단계에서 실패, 런타임 tests NOT RUN. E2E 물류 유형 race 부정 사례와 문서 영향 기록을 추가하되 실제 새 Head Full CI/Trusted 확인 전 NOT TESTED; Phase C/운영 DB 복구는 별도.

## REWORK-B001 — Main 대상 검증/번역 초안 보호 (2026-11-05)

- 최초 #879 stacked PR은 base.ref=main 필수 신뢰된 QA Preflight에서 차단되었다. PR 대상만 main으로 변경해 Main 대비 Phase A+B 변경을 검증한다. 이 조치는 #878 병합·릴리스 승인이 아니다.
- Code Review P1의 TEST_PLAN 원문 정책 유실은 Phase A Git Blob SHA 990eee5e...로 복원하고 본 Phase B 문서와 Work Packet에 새 테스트 소유권을 기록한다.
- Code Review P2는 TranslationEditor 초안 revision을 값과 함께 보존하고 다른 관리 변경으로 catalog revision이 갱신되면 저장을 막아 해결한다. 기존 초안은 alert와 함께 보존하고 취소 후 최신 항목을 다시 열어야 저장된다. 401/412 복구, 기존 전역/프로젝트 권한 및 저장 revision CAS는 유지.
- 기존 tests/e2e/resource-catalog-delete.spec.ts에 동시 수정 lost-update 방지 회귀를 추가한다. 145 E2E spec, 8 shard, Required3 및 이전 이력 모두 보존. 신규 HEAD Full CI 이전 테스트 상태 NOT TESTED.

# Issue #866 — Phase B: 관리형 기준정보 번역 저장·소유권·UI

## 기준·변경 경계 (2026-11-05)

- 선행 PR: #878 Phase A, Head 8fca83bbc12cf516cd7f22438fa16c6b596d80fb, 기준 Main 364aa3bdfde16fd3ca79add61c35a1cde21f6395. 본 단계는 Phase A 위에서 구현했으며, 첫 CI 차단 후 PR #879 target을 main으로 정렬하여 Phase A+B diff를 검증한다. 병합은 Phase C 및 Owner 최종 인수까지 금지한다.
- 원본 통합 PR #870은 역사적 구현 참고 자료로만 사용한다. #865 LLM, #869 Issue UI 및 이전 0.140.0 트리를 이식하지 않으며, 실제 충돌 검사 후 #866 관련 변경만 선택 적용한다.
- 범위: migration 0036, 12개 owner별 번역 저장, API/DTO 추가형 필드, 글로벌/프로젝트 도메인 서비스 기존 인증 및 revision 트랜잭션, Copy/Template v6 번역 보존, 손실 있는 일정 JSON/Excel export 명시 거부, 관리자 입력 UI 및 관련 회귀 검증.
- 이 PR 자체는 정식 릴리스가 아니며 Phase C 전체 화면 문자열·Gantt 상태·5폭/전체 권한 실증 전 #866 완료, 병합, GHCR 게시 금지. HIGH / OWNER_MANAGED / qa_required=true / release_required=true / release_authorized=false.

## 저장·계약

- db/migrations/0036_display_name_translations.sql: project_master_items, logistics_equipment_types, logistics_system_types, process_types, product_standard_processes, site_product_processes, work_areas, project_work_areas, project_processes, project_equipment, project_logistics_systems, resource_groups 각각 독립 번역 테이블. owner_id INTEGER 또는 owner_code TEXT FK + (owner,locale) 복합 PK, CASCADE. 저장 원본 ID/code/name/UNIQUE/FK와 0001~0035 migration checksum은 변경하지 않는다.
- 지원 locale은 ko/en/vi. 서버 입력 translations 필드를 생략하면 기존 값을 보존하고, {}는 전체 해제, 빈 값은 개별 해제. NFC/trim, 200 codepoint, 제어문자/유효하지 않은 UTF-16/지원하지 않는 locale 거부. 임의 SQL table 입력을 허용하지 않는 고정 owner map.
- 기존 API name은 원본 값이며 선택적 translations만 추가. 화면 표시 시 선택 언어 번역이 있으면 사용, 없으면 정확한 원본 name; 다른 언어 번역을 연쇄 대체하지 않는다. 수정·선택·관계는 언제나 ID/code 기반. 서로 다른 owner가 같은 숫자 ID나 번역명을 갖더라도 연결하지 않는다.
- 번역 쓰기는 별도 무인증 API가 아니라 기존 도메인 서비스 CRUD 안에서 처리한다. 글로벌 마스터·공정·유형·리소스 그룹은 해당 전역 관리자 세션, 프로젝트 공정/설비/시스템/WorkArea는 해당 프로젝트 edit session 및 현재 revision 검사를 통과해야 한다. 기존 Origin/CSRF, If-Match, 삭제보호, rollback, 세션 재검증을 우회하지 않는다.
- 조회 단위는 각 서비스의 SQLite 스냅샷과 일치하도록 하고, 일괄 조회 시 owner별 번역 map 사용. 기존 수량/KPI/업무 상태·원문/일정 산식은 불변.

## 복제·호환·손실 방어

- Project Copy는 복제된 owner ID로 번역값을 연결하고, 다른 Project ID에 누출하지 않는다. Template version 6는 필요한 번역 metadata를 보존하고 구버전 스냅샷과의 호환성 검사를 수행한다.
- 일정 JSON/Excel export가 owner 번역·연관 공정 문맥을 표현하지 못하면 경고 없는 유실을 금지하고 명시적으로 409를 반환한다. 원본 소스가 무조건 export 가능하다고 안내하지 않는다.
- 기존 0035 SQLite→0036은 원본 데이터 backfill이 없는 추가형 변경. 재오픈, 무결성 검사, 기존 name 보존을 테스트해야 한다. 역마이그레이션 시 번역 손실 없이 단순 0036 테이블 삭제만으로 복구됐다고 주장하지 않으며 백업/동일 이미지 복원을 별도 운영 검증한다.

## UI · 테스트 소유권

- 등록/수정: Project Master, 물류 유형, 공정 카탈로그·프로젝트 공정/WorkArea, 리소스 그룹의 원본 name과 ko/en/vi 표시명을 분리 관리한다. TranslationFields/TranslationEditor는 별도 컴포넌트. 정식 Domain dictionaries는 코드에 포함되며 자유 입력 name/description/task는 번역하지 않는다.
- TEST_LIFECYCLE_REVIEW — ADD: tests/server/i18n/managed-display-names.test.ts, tests/lib/i18n-translation-write-field.test.ts, tests/e2e/i18n-master-data.spec.ts. EXTEND: tests/server/db/database.test.ts, migration-cli 및 공정·복제·템플릿·리소스·물류 경계 테스트, tests/scripts/e2e-shard-planner.test.ts. KEEP_UNIQUE: 원본 권한·CSRF/If-Match, Project/WorkArea/SQLite·기존 Gantt/Task/Calendar·Phase A language-shell·Chromium8/Required3.
- 신규 E2E i18n-master-data.spec.ts 1개만 Shard 7의 기존 17→18에 추가(전체 144→145). 기존 144개 배치·과거 projectedMs 및 실제 성공 출처를 보존한다. 새 duration은 REMOTE_UNMEASURED; 테스트·CI skipped/timeout/retry 완화 없음.
- 코드/Git 패치의 컨텍스트 매칭은 검토했으나 로컬 TypeScript·Vitest·Playwright·실제 SQLite·Docker 실행은 NOT TESTED. Phase B 새 Head Full PR CI와 Trusted/Owner, 실제 관리 화면·권한 검증 필요.

## 후속 잔여 위험 / AC 연결

- AC04: 12 owner 저장·조회 서비스와 대표 관리 UI/검색의 정적 구현. Project별 Equipment/System 원문 대비 수동 편집 UI 전수와 전 영역 표시·검색/동명이름 선택 실제 브라우저 확인은 추가 검증.
- AC05: 기존 owner 서비스 트랜잭션 재사용 및 테스트 추가; 각 HTTP 권한·stale revision·동시쓰기·세션 취소·전역/프로젝트 격리의 새 Head 실증 필요.
- AC06: migration 0036/Copy/Template6/Export 409 추가. 기존/신규 DB 및 실제 restore·롤백, 모든 이전 API/양식 호환은 새 CI·운영 환경에서 확인.
- AC02/03/07/08/09: 전 화면 다국어·SVAR instance/스크롤/일정/Task 미저장 Draft, 장문·접근성·Gantt/Project Issue/Resource Dashboard 포맷 등 Phase C 범위, 현재 미완료.

## 배포 및 승인

- 기본 버전 후보 0.142.0(Phase A), 이번 종속 PR 자체로 새 GHCR SemVer·OCI 정식 게시 안 함. PR #878 및 #870, 기존 Main, Issue #866 OPEN 유지.
- 고위험 DB 변경이므로 사전 백업, 새 빈 DB와 기존 DB 양쪽의 migration, FK check/reopen/rollback, Owner 최종 수용은 필수. CI 성공만으로 운영 데이터 안전이나 릴리스 승인 간주 금지.
## REWORK-B008 — 전체 실패 이력과 공유 선택 소비자 (2026-11-05)

Full #3519.1에는 물류 검색 입력 coarse 20px과 취소된 shard7의 프로젝트 생성 표시명 누락이라는 직접 오류 두 개가 있다. 이전 #870의 검색 높이 교정이 Phase B 선택 이식에서 빠진 점까지 대조한다. 물류 검색은 기존 40/44px 변수를 상속하고, 생성·설정 공유 선택기는 현재 언어 표시명으로 label과 동명 여부를 함께 계산하되 원본 ID·코드·종속 필터·비활성 기존 선택·초안을 보존한다. 동일 로컬 진단에서 드러난 영어 표 행56.5px은 사용량 단위를 기존 사전의 Projects/Dự án으로 축약하고 전체 title을 보존하며, 영어390px category tabs의 문서398px overflow는 header/tabs의 min-width:0 및 내부 scroll로 교정한다. 번역 저장 서비스·API·DB/권한 및 자유 입력 원문은 변경하지 않는다.

기존 실패 테스트 합집합과 직접·인접·음성 소비자의 동일 source 진단 결과는 [단일 실패 원장](ISSUE_866_FAILURE_ANALYSIS.md)에 기록한다. 원본 취소/미실행과 새 CI NOT TESTED를 구분하며 Phase C 및 운영 백업·복원은 미완료다.

## Phase C 연결과 유지되는 경계 (2026-11-05)

[Phase C 설계](I18N_PHASE_C.md)는 이 문서의 owner별 저장·권한·fallback·생략/명시 삭제 계약을 유지하면서 전체 화면 고정 문구와 날짜·숫자 표시를 연결한다. Equipment/System 및 legacy Process dialog는 원본 name과 수동 ko/en/vi 초안을 분리하고 변경 없는 translations 필드를 생략한다. Project Master의 `TranslationDraftSnapshot`, 물류 유형의 시작 revision 고정·412 stale 잠금, B007/B008의 이름+번역 버튼 밀도·검색 높이 보완은 재적용 과정에서도 유지한다.

Phase B의 “Phase C 예정/후속”은 당시 검증 범위를 설명하는 역사 기록이다. 현재 Phase C 소스 반영만으로 Phase A+B의 원격 성공을 새 Head에 재사용하거나 전체 #866 완료로 승격하지 않는다. HIGH / OWNER_MANAGED / qa_required=true를 유지하며 새 Head의 원격 quality/e2e/docker와 최종 수동 UX는 NOT TESTED다. 독립 인간 QA·Owner ACCEPT·정식 릴리스 승인은 별도다.
