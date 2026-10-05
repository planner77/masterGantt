# Issue #342 국가 Calendar 2026~2037 Catalog 및 Import/관리

상태: 최신 main 재정렬·DOCUMENTATION_SYNC 반영 후 기존 PR #346 exact-head CI 시작 준비. 사용자의 현재 승인 범위는 충돌 해소, 관련 문서 갱신, PR #346 head 갱신과 새 PR CI 시작 확인까지다. CI 완료 모니터링, 병합, main/GHCR, 정식 release, branch cleanup, Issue 종료는 범위 밖이다.

## 기준과 결정

- Issue: #342, OPEN. 기존 PR #346과 branch `feat/issue-342-country-calendar-catalog`를 재사용한다. 중복 PR을 만들지 않는다.
- 재정렬 기준 main: `e812e56f45fc9d641ffcd80e49fb0deaf115b704`, application `0.83.4`.
- 과거 PR head `54d219f53e598decea8682f06339d7b87964b919`와 CI #1355는 2026-09-30 상태의 증거이며 최신 head 검증에 재사용하지 않는다.
- 버전: `0.83.4 → 0.84.0` MINOR. 글로벌 Calendar Catalog, 신규 DB schema/API/admin UI라는 하위 호환 기능 추가다.
- migration: 과거 #342의 `0018_country_calendar_catalog.sql`은 현재 main의 0018~0021과 충돌하므로 **`0022_country_calendar_catalog.sql`**로 재배치한다. 기존 migration 파일은 수정하지 않는다.
- `release_required=true`: version-changing 기능 merge는 Generic Release Finalizer에서 정식 release가 필요하다. `release_authorized=false`: 이번 요청은 PR CI 시작까지이며 정식 GHCR 게시 승인은 없다. 따라서 tag/정식 release/GHCR promotion은 수행하지 않는다.
- 실행 방식: 이 세션은 GitHub 도구를 이용한 단일 에이전트 순차 처리다. 별도 qa_docs Sub-Agent 실행 도구가 없어 독립 사전 QA는 NOT TESTED이며 PASS로 주장하지 않는다.

## 구현 범위

- 7개 국가(KR/CN/VN/PH/TH/MX/US)의 2026~2037 관리 슬롯.
- `OFFICIAL | UNAVAILABLE | SUPERSEDED` 상태와 sourceVersion/sourceUrl 추적.
- repository 2026 built-in fixture + DB override. override가 있으면 우선하며 Scheduling은 OFFICIAL만 사용.
- canonical JSON / operator-friendly CSV Import, validation → additions/changes/deletions Preview → strong If-Match 기반 atomic Apply.
- 국가·연도 dataset metadata와 날짜/name/dayType/sourceKey CRUD.
- 기존 Project Master admin session, exact Origin, bounded JSON, Catalog revision 패턴 재사용.
- Project Calendar Preview/Save와 신규 Project 기본 Calendar가 effective resolver를 사용.
- Catalog mutation은 기존 Project materialized Calendar/Task를 자동 재계산하지 않음.
- `/calendar-admin` UI와 프로젝트 기준정보 화면의 보조 진입 action. 전역 Header 메뉴 수/geometry는 변경하지 않음.

## 최신 main 충돌 해소

- main의 Task status, Resource roles/assignment roles, JSON Import, Generic Release Finalizer, CI shard/setup 최적화와 Issue #452의 공통 관리자 shell/AdminAuth/버튼 spacing 계약을 그대로 보존한다.
- migration 번호는 0022로 이동한다.
- version은 과거 0.59.0이 아니라 최신 main 다음 MINOR 0.84.0을 사용한다.
- `work-calendar-service-core.ts`는 현재 Task status 등 최신 DTO mapping을 유지하고 country dataset lookup만 effective resolver로 교체한다.
- CI workflow 파일은 변경하지 않는다. 현재 main의 `quality/e2e/docker` required gate와 최적화 정책을 그대로 사용한다.

## UI/UX 기준

`DESIGN.md`와 `docs/UI_UX_GUIDELINES.md`의 Light-first / workspace-first / data-dense / flat surface / compact controls / progressive disclosure를 재사용한다.

- 국가/연도 filter는 상단 compact toolbar.
- metadata → Import Preview/Apply → 날짜 data table 순서로 작업 흐름을 배치.
- 위험한 삭제는 공통 WorkspaceDialog 확인.
- loading/error/success/stale revision 상태를 구분.
- 390/768/1024/1440px에서 form reflow, table 내부 horizontal scroll, document overflow 금지.
- 새 공통 visual token/component 규칙은 만들지 않는다.

## DOCUMENTATION_SYNC

갱신 대상:
- `docs/REQUIREMENTS.md`: R56 추가.
- `docs/ARCHITECTURE.md`: built-in + DB override resolver와 관리자 경계.
- `docs/API.md`: admin endpoints/If-Match/revision.
- `docs/DB_SCHEMA.md`: migration 0022와 Catalog tables.
- `docs/SCHEDULING_ENGINE.md`: OFFICIAL effective dataset resolution/materialization.
- `docs/ISSUE_57_WORK_CALENDAR.md`: 기존 Working Calendar 원칙 확장.
- `docs/COUNTRY_CALENDAR_DATA.md`: 국가별 공식 source/변환/검증/sourceVersion/import 형식.
- `docs/PROJECT_UX.md`: admin UI/반응형/진입 경로.
- `docs/TEST_PLAN.md`, `docs/REMOTE_VALIDATION.md`: 최신 exact-head gate와 회귀 범위.
- `CHANGELOG.md`, `docs/releases/v0.84.0.md`, 이 실행 계획과 active PLAN.

N/A 근거:
- `DESIGN.md`: 기존 semantic token/geometry 원칙을 그대로 적용하며 새 전역 디자인 규칙 없음.
- `AGENTS.md`: Agent 역할, DOCUMENTATION_SYNC, GitHub-first, Generic Finalizer 지침 변경 없음.
- `docs/UI_UX_GUIDELINES.md`: 기존 admin/data-dense/keyboard/focus 규칙 재사용, 새 공통 interaction 지침 없음.
- `docs/CI_CD.md`, `docs/GITHUB_OPERATIONS.md`: workflow/required check/권한/GHCR 운영 계약 변경 없음.
- `docs/SECURITY.md`: 새 인증 체계 없이 Project Master admin session/Origin/If-Match 재사용.
- `docs/IMPORT_SCHEMA.md`: Project JSON Import와 별도 Country Calendar import 계약이며 Project import schema를 변경하지 않음.

문서 갱신 뒤 코드/계약이 바뀌면 DOCUMENTATION_SYNC는 stale이며 다시 확인한다.

## CI #1850 실패 보완

- exact head `0836d7d2b401079efd454af8f655080f11830931`의 PR CI #1850은 Chromium shard 4/6에서 `project-status.spec.ts:197`의 읽기 전용 GET이 `ECONNRESET`으로 끊겨 FAIL했다.
- 같은 run의 quality/typecheck/lint/Vitest/build/Docker 및 다른 shard 결과와 별개로, 새 head에서는 전체 required gate가 stale이므로 다시 검증한다.
- 최신 main `e812e56f...`에는 Issue #452의 같은 종류 `socket hang up`에 대한 GET-only 최대 3회 retry가 `project-browser-title-favicon.spec.ts`에 이미 병합됐다.
- 동일 transport 정책을 `project-status.spec.ts`의 direct GET에만 확장한다. POST/PATCH mutation은 retry하지 않아 side effect 중복 위험을 만들지 않는다.
- 이 보완은 제품 API/DB/Scheduling 계약을 변경하지 않는 E2E transport 안정화다. application version은 `0.84.0` 유지.

## 검증과 handoff

- 기존 #342 Unit/Integration/E2E를 최신 main에 재이식하고 migration/schema/route inventory 기대값을 0022 기준으로 갱신한다.
- 과거 #1355에서 발생한 unrelated Grid DnD E2E 실패는 과거 head 사실로만 기록하며 새 exact head의 전체 required gate 결과로 재판정한다.
- Local Fast Feedback: 이 환경에서 repository checkout/실행 증거를 확보하지 않았으므로 NOT TESTED. 원격 PR CI를 공식 전체 회귀로 사용한다.
- 독립 qa_docs 사전 QA: NOT TESTED(전용 Sub-Agent 실행 도구 없음). 원격 CI 성공과 동일 의미가 아니며 향후 merge gate에서 별도 확인해야 한다.
- 이번 종료점: PR #346의 base가 최신 main, head가 충돌 해소 commit인 것을 확인하고 해당 exact head의 새 PR CI가 queued/in_progress/pending 중 하나로 생성된 것을 확인한다. 완료 상태는 모니터링하지 않는다.
