# Issue #342 국가 Calendar 2026~2037 Catalog 및 Import/관리

상태: 최신 main 0.92.0 재정렬·충돌 해소·DOCUMENTATION_SYNC 후 기존 PR #346의 새 exact-head CI 시작 준비.

## 기준과 결정

- Issue: #342, OPEN. 기존 PR #346과 branch `feat/issue-342-country-calendar-catalog`를 재사용한다.
- 최신 main: `05fe212060ed4a935510dc2f7a692bb9113c55e8`, application `0.92.0`.
- 최신 main은 #459 Stage Gate Epic, #460~#464 membership/dashboard/JSON 1.1 계약과 migration `0022_task_milestone_memberships.sql`을 포함한다.
- 기존 #342 migration `0022_country_calendar_catalog.sql`은 번호 충돌이므로 **`0023_country_calendar_catalog.sql`**로 재배치한다. 적용된 migration ledger를 재작성하지 않는다.
- version: **`0.92.0 → 0.93.0` MINOR**. 글로벌 Catalog, DB schema/API/admin UI라는 하위 호환 기능 추가다.
- 현재 요청 종료점: 최신 main 정렬, 충돌 해소, 문서 동기화, PR #346 head 갱신 및 새 PR CI 시작 확인. CI 완료 모니터링·병합·main/GHCR·정식 release·branch cleanup·Issue 종료는 현재 요청 범위 밖이다.
- 과거 #1844/#1845/#1850/#1855/#1858 결과는 각 과거 head에 한정되며 새 head의 required gate를 대체하지 않는다.

## 구현 범위

- KR/CN/VN/PH/TH/MX/US, 2026~2037 관리 슬롯.
- `OFFICIAL | UNAVAILABLE | SUPERSEDED` 상태와 sourceVersion/sourceUrl.
- 2026 built-in fixture + DB override; DB override 우선, Scheduling은 OFFICIAL만 사용.
- JSON/CSV Import validation → additions/changes/deletions Preview → strong If-Match 기반 atomic Apply.
- 국가·연도 metadata와 date/name/dayType/sourceKey CRUD.
- Project Master admin session, exact Origin, bounded JSON, Catalog revision 재사용.
- Project Calendar Preview/Save와 신규 Project 기본 Calendar가 effective resolver 사용.
- Catalog mutation은 기존 Project materialized Calendar/Task를 자동 재계산하지 않음.
- `/calendar-admin`은 Issue #452 공통 `admin-page` shell과 `AdminAuth` presentation을 사용.
- #459 Stage Gate explicit/effective membership, Ready/KPI, JSON 1.1, Copy/Template/Export/Import 의미는 변경하지 않음.

## CI #1850/#1855 후속

- #1850: `project-status.spec.ts`의 읽기 GET에서 transient `ECONNRESET`; 제품 assertion 실패가 아니었다.
- 최신 main의 GET-only transport retry 정책을 `project-status.spec.ts` direct GET에도 적용한다. `socket hang up|ECONNRESET`에 최대 3회, POST/PATCH mutation은 retry 금지.
- #1855: `변경 경로 판정` job이 abandoned/cancelled되어 quality/e2e/docker aggregate가 fail-closed했다. 이후 main의 CI/Lifecycle 변경을 그대로 받아들이고 새 exact head에서 다시 검증한다.

## DOCUMENTATION_SYNC

갱신:
- REQUIREMENTS, ARCHITECTURE, API, DB_SCHEMA, SCHEDULING_ENGINE
- ISSUE_57_WORK_CALENDAR, COUNTRY_CALENDAR_DATA
- PROJECT_UX, TEST_PLAN, REMOTE_VALIDATION
- CHANGELOG, v0.93.0 release note, active PLAN, 본 실행 계획

N/A:
- DESIGN.md: 최신 공통 visual/geometry 규칙을 그대로 사용하며 새 전역 디자인 규칙 없음.
- AGENTS.md: 현재 역할/DOCUMENTATION_SYNC/GitHub-first/Lifecycle 규칙 변경 없음.
- UI_UX_GUIDELINES.md: 기존 admin/data-dense/keyboard/focus 규칙을 재사용.
- CI_CD.md / GITHUB_OPERATIONS.md: workflow/required check/GHCR 운영 계약 자체 변경 없음.
- SECURITY.md: 새로운 인증 체계 없이 Project Master admin session/Origin/If-Match 재사용.
- IMPORT_SCHEMA.md: Project JSON 1.1 Import와 별도 Country Calendar Import 계약이며 Project import schema 변경 없음.

## CI #1960 실패 보완

- Vitest 1513개 중 1509 PASS, 1 FAIL, 3 skipped.
- 실패는 `SQLite connection and schema > adds explicit stage storage to schema 21 without inferring or altering existing data`.
- legacy schema21 DB를 최신 migration directory로 올리면 이제 `0022_task_milestone_memberships.sql`과 `0023_country_calendar_catalog.sql`이 연속 적용되는 것이 정상이다.
- 테스트 기대값을 0022+0023으로 갱신하고 기존 row 불변/empty membership/FK invariant에 더해 Country Calendar Catalog 초기 revision 1/dataset 0건을 확인한다.
- 제품 코드와 migration SQL은 변경하지 않는다.

## Codex review REWORK

- P1 stale provenance: 수동 날짜 Add/Edit/Delete가 기존 source metadata와 OFFICIAL 상태를 유지하던 문제를 수정한다. 같은 mutation transaction에서 status=UNAVAILABLE, sourceVersion/sourceUrl=null로 전환하고 재승인을 요구한다.
- P1 persistence layering: Country Calendar SQL을 \`src/server/repositories/country-calendar-repository-core.ts\`로 이동하고 Service는 Repository만 호출한다.
- P2 file selection race: \`File.text()\` generation token으로 가장 최근 선택만 envelope에 반영한다.
- 관련 Unit/E2E와 ARCHITECTURE/API/PROJECT_UX/TEST_PLAN/CHANGELOG/release note를 동기화한다.
- 이 rework로 #1964 PASS는 stale이며 새 exact head에서 full PR gate와 Codex review를 다시 받아야 한다.

## Codex review REWORK 2

- P1 target/snapshot 정합: selector 변경 직후 snapshot을 비우고 GET 성공 시에만 새 snapshot을 채운다.
- P1 stale 412 draft: revision conflict reload 시 열린 edit/delete draft를 폐기한다.
- P2 sole-date delete: 수동 변경은 즉시 UNAVAILABLE이므로 마지막 날짜 삭제를 허용한다.
- P2 no-op PATCH: 지원 field 최소 1개를 요구하고 unknown field를 거부한다.
- P2 native file input: successful Import Apply 후 DOM file input value까지 초기화한다.
- Unit/Chromium과 API/UX/Test Plan/CHANGELOG/release note를 다시 동기화한다.

## Codex review REWORK 3

- P2 effective provenance: override가 유일한 built-in 연도를 비활성화해 \`supportedYears=[]\`이 되면 목록 descriptor의 sourceVersion/sourceUrl도 null이어야 한다.
- public descriptor DTO는 nullable provenance를 허용하되 실제 Scheduling \`CountryCalendarDataset\`은 non-null provenance 타입을 유지한다.
- Unit/API/Test Plan/CHANGELOG/release note를 동기화한다.

## 검증

- Catalog parser/service/CRUD/atomic import/stale revision/WORKING 보존 Unit.
- built-in first-edit clone 및 OFFICIAL effective resolver.
- 기존 Project snapshot 불변 + 명시적 Preview/Save 최신 dataset 반영 Integration.
- migration 0023 및 schema/index/FK/route-security inventory.
- /calendar-admin Import/CRUD 및 responsive Chromium.
- project-status direct GET transient reset 회귀.
- 공식 전체 판정은 새 exact head의 GitHub Actions `quality/e2e/docker` 결과로 수행한다.
