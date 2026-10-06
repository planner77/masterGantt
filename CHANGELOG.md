# Changelog

## [0.93.0] - 2026-10-06

### Added

- Issue #342: KR/CN/VN/PH/TH/MX/US 국가 Calendar의 2026~2037 관리 슬롯과 OFFICIAL/UNAVAILABLE/SUPERSEDED 상태를 DB override Catalog로 추가한다.
- JSON/CSV 국가 Calendar Import의 검증 → 추가/변경/삭제 Preview → 원자적 Apply와 국가·연도별 sourceVersion/sourceUrl 및 NON_WORKING/WORKING 날짜 CRUD 관리자 화면을 추가한다.
- 국가별 공식 데이터 확보·변환·검증·정정 절차와 sourceVersion 규칙을 docs/COUNTRY_CALENDAR_DATA.md에 문서화한다.

### Changed

- 최신 main `24072f4fd28cd1306b3c348d3f7da1a0e3dbc075` / v0.92.1의 Issue #456 Task Editor UI/상태 보존 개선을 함께 보존한다.

- 최신 main 0.92.1의 Milestone Stage Gate membership/대시보드/JSON 1.1 교환 계약과 기존 0018~0022 migration을 보존하고, Country Calendar Catalog migration을 `0023_country_calendar_catalog.sql`로 재배치한다.
- 2026 built-in fixture는 초기 baseline으로 유지하고 Project Calendar Preview/Save 및 신규 Project 기본 Calendar는 최신 OFFICIAL DB override를 우선 사용한다. Catalog 변경만으로 기존 Project의 materialized Calendar/Task는 자동 재계산하지 않는다.
- Issue #452의 공통 `admin-page` shell과 `AdminAuth` presentation을 국가 Calendar 관리자에도 적용하고 Application version을 `0.92.1`에서 `0.93.0`으로 증가한다.

### Fixed

- 수동 날짜 CRUD가 기존 OFFICIAL provenance를 유지하지 않도록 즉시 UNAVAILABLE로 전환하고 source metadata를 비워 공식 재검증을 요구한다.
- Country Calendar SQL persistence를 Repository 계층으로 분리해 `Route Handler → Service → Repository → SQLite` 경계를 복구한다.
- 빠른 파일 재선택에서 이전 `File.text()` 완료가 최신 선택 envelope를 덮어쓸 수 없도록 generation guard를 추가한다.
- country/year 조회 실패 시 이전 snapshot을 제거해 새 selector와 이전 데이터가 섞이지 않게 하고, 412 reload 후 stale 날짜 편집 초안을 폐기한다.
- 날짜 PATCH는 최소 1개 지원 field만 허용하고 unknown/no-op payload를 거부하며, 마지막 날짜 삭제 후에도 fail-closed UNAVAILABLE 상태를 유지한다.
- Import Apply 성공 후 native file input을 초기화해 동일 파일을 즉시 다시 선택할 수 있게 한다.
- supportedYears가 비어 있는 국가는 과거 built-in provenance를 노출하지 않고 sourceVersion/sourceUrl을 null로 반환한다.
- 변경 없는 날짜 편집은 no-op으로 처리해 OFFICIAL provenance와 revision을 보존하고, target 전환 시 신규 날짜/file draft를 폐기하며 DELETE pending 중 취소를 차단한다.
- Import Preview와 Apply를 HMAC token으로 exact revision·country/year·format·file bytes에 묶어 Preview 우회를 차단한다.
- current-year KR override가 재승인 대기여도 신규 Project 기본 Calendar는 built-in approved baseline으로 fallback하여 Project 생성 가용성을 유지한다.
- PR CI #1995 production dependency audit에서 확인된 librsvg CVE-2026-96889를 해소하기 위해 Next 16.3.8의 허용 범위 내에서 optional `sharp 0.35.4 → 0.35.5`, `sharp-libvips 1.3.3 → 1.3.4` lock tree를 갱신한다.

## [0.92.1] - 2026-10-06

### Fixed

- Issue #456: Task Editor의 상태·진행률 내부 열 예산을 조정해 desktop에서 진행률 숫자가 오른쪽에 잘리는 문제를 수정한다.
- 요청 일정과 일정 모드를 하나의 의미 그룹으로, Description과 URL을 상세 정보 그룹으로 묶고 기존 설명 읽기 폭과 textarea resize를 유지한다.
- Footer의 짧은 명령에 일괄104px 폭을 강제하지 않고 action별 normal/pending label에 맞는 폭을 사용한다. 기존44px 클릭 영역과 최신 조회 좌측·취소/저장 우측 계약을 유지한다.
- Task Editor 저장 중 반복 Escape가 대화상자를 닫는 경로를 차단해 기존 pending 잠금 계약을 보강한다.
- Editor 진입 등 상위 화면의 렌더에서 같은 visible Task 집합의 Gantt 필터가 반복 적용되어 가로 스크롤을 초기화하는 경로를 보완한다. 실제 필터·범위·Task 집합 변경과 API 교체는 기존 필터 계약을 유지한다.
- 같은 보기에서 일정·계층·관계가 유지되는 metadata 저장 후 Gantt 가로 스크롤이 초기화되는 경로를 공개 viewport API로 보완한다. 실제 일정·범위 변화와 사용자 스크롤은 조건부 복원 대상에서 제외한다.
- Editor 관계·기준 일정 action의32px 최소 높이를44px로 확대하며 긴 label의 자연 wrap을 유지한다. 동적 탭·독립 저장·dirty/stale·server canonical 및 Gantt 상태 계약은 변경하지 않는다.

### Changed

- #456의 Task Editor A를 첫 소단위 PR로 개선한다. 설정·근무 규칙·인증 B는#490, 생성·복사·template·입출력·견적 C는#491의 후속 범위로 분리하며 미검증 표면을 완료로 처리하지 않는다.

## [0.92.0] - 2026-10-06

### Added

- Issue #464: JSON 1.0 호환을 유지하는 JSON 1.1 명시 단계 소속 교환, 보호된 Import preview/원자 commit, 전체 일정 JSON Export와 Excel 단계 보고를 제공한다.
- 전체 Project Copy·Template과 subtree/multi-root Copy에서 단계 Membership을 새 Task ID로 안전하게 remap하고 외부 소속 제외·상속 변화·완료 단계 경계를 명시적으로 검증한다.

### Changed

- latest main `d748046733ae2006580052a480c984ae1eb1fa2a`에는 #463가 병합되어 있으며, 해당 main의 #455/transport/필터 후속 보완을 보존해 #464를 재정렬하고 application version을 `0.91.0`에서 `0.92.0`으로 증가한다.
- JSON 1.1 preview는 advisory source calendar와 dependency로 source effective schedule을 재구성하여 동일 Export 재가져오기를 거짓 일정 변경으로 표시하지 않는다.

### Fixed

- Context Menu opening scroll settle 보완을 #463에서 승계하고, #464 키보드 회귀 검증은 실제 enabled root item 순서를 기준으로 수행한다.

## [0.91.0] - 2026-10-06

### Added

- Issue #463: 완료 단계의 전체 소속·선행 상태 기반 Ready/위험 KPI와 조회 범위의 개인 assignment 공수를 구분하는 readonly 대시보드/API 및 관련 물류 단계 정보를 제공한다.
- 대시보드 원인·소속 상세·리소스 조회를 기존 Editor와 일정에 연결하고, 기준일·revision·조건 변경에 맞춰 갱신한다. 일정과 대시보드 왕복 시 Gantt 인스턴스와 보기 상태를 보존한다.

### Fixed

- 완료 단계 대시보드의 물류·Resource 조건을 서로 다른 member에서 조합해 단계 관련성을 만들지 않고, 같은 일반 Task가 두 non-date 조건을 함께 만족할 때만 S에 포함한다.
- PR CI Run #1869에서 발견된 CSS Module의 전역-only selector를 전역 스타일 소유 위치로 이동해 Next.js production build와 Docker build의 동일 연쇄 실패를 제거한다. 최신 main의 #461/#462 회귀 보완은 유지하고 #463 변경만 재적용한다.
- PR CI Run #1941에서 opening-settle이 기존 #407/#418 회귀를 해소한 뒤, Chart bar menu의 baseline 재캡처가 Grid row로 surface를 바꾸는 새 회귀를 확인했다. 연결된 원래 trigger 또는 원래 grid/chart surface를 보존한 fallback을 사용해 실제 Chart scroll 닫힘 계약을 유지한다.
- slow query abort 후 직전 cached query로 복귀할 때 cache hit를 effect 진입 즉시 ready로 복원하여 불필요한 loading 잔류를 제거한다. 실제 network fetch·TTL focus catch-up·revision/catalog 검증은 유지한다.

- PR CI Run #1946에서 390px 단계 picker의 End 키 active option scroll이 requestAnimationFrame에 지연되어 geometry 측정과 경합하는 회귀를 확인했다. 열린 option DOM을 keyboard handler에서 즉시 scrollIntoView(nearest)하여 focus·active option 가시성 계약을 결정적으로 유지한다.

### Changed

- Logistics M/M의 무조건 20일 환산을 명시 query·유효 환경 설정·미설정(null) 정책으로 정합화하고 사용 기준·출처를 제공한다. 기존 물류 계획 M/D·진척·대상 ID는 보존한다.
- Application version을 `0.90.0`에서 `0.91.0`으로 증가한다. latest main의 #453 및 선행 #460~#462를 보존한 재정렬 PR이며 정식 릴리스는 게시하지 않는다.

## [0.90.2] - 2026-10-06

### Fixed

- Issue #455: 기준정보 항목의 이름·코드·정렬 input 경계와 focus·disabled 상태를 식별하기 쉽게 하고 추가 영역·목록 열 배분·행 action·header-firstrow 밀도를 정돈한다. 기존 범주/필터 초안·row별 저장·code/usage·권한/revision 계약을 유지한다.
- 최소960px 표와40px 입력·버튼을 적용해 짧은 행을5폭에서47px으로 유지한다. 현재 생성 대상과 canonical 갱신 후 미저장 입력 초기화 정책을 안내하고, 비밀번호 창의 native 초기 focus를 보강한다.
- 최신 main의 릴리스 운영 변경·문서를 보존해 누적 후보를 통합한다. 제품·의존성과0.90.2 version은 유지한다.

## [0.90.1] - 2026-10-06

### Fixed

- Issue #454: 물류 설비·시스템 유형 목록의 열 너비·행 밀도·사용 건수 정렬과 편집 dialog action 정렬을 정돈한다. 기존 유형 code·usage·필터·권한·revision 계약을 유지한다.
- 최소824px 표의 이름·코드·상태·사용·작업 열을 명시하고 좁은 화면의 키보드 focus에 필요한 가로 이동을 표 내부에서 처리한다. 짧은 한 줄 fixture는5폭에서47px이며 긴 값은 자연스럽게 줄바꿈한다.
- 수정·비밀번호 dialog의 pending 조작과 초점을 보호하고, 412 뒤 최신 목록 조회 실패/401 원인을 유지하며 열린 수정 초안의 명시 조회 복구를 제공한다.

## [0.90.0] - 2026-10-06

### Added

- Issue #453: 리소스와 리소스 그룹을 독립 탭의 전체 폭 목록으로 구성하고 탭별 검색·상태·스크롤 및 구성원 초안을 보존한다. 생성 dialog와 선택한 리소스의 프로필 명시 저장으로 상시 행 편집기의 밀도를 줄인다.

### Changed

- 기존 관리자 권한·카탈로그 revision·역할/등급·usage 및 구성원 저장 계약을 유지한다. Application version은 `0.90.0`이며 이번 작업 범위는 PR CI 시작까지다.
- 최신 main의 Lifecycle 운영 변경과 source-map-js 1.2.2 lockfile을 보존하여 후보를 재정렬한다.

## [0.86.0] - 2026-10-06

### Added

- Issue #461: Task/Summary 작업 정보에서 완료 단계의 검색·직접 지정·상속 복귀를 편집하고 Milestone 소속 작업 탭에서 명시 소속 초안을 원자 적용한다. Summary 일정은 파생 읽기 전용으로 유지한다.
- Milestone의 본인 상태와 소속 진척·Ready·선행 차단·수동 이벤트·완료 불일치 진단을 구분하고 명시 완료/재개 및 초안 보호를 적용한다.

### Fixed

- Issue #475: Generic Release Finalizer가 FINAL marker 없는 closed Issue merge를 historical boundary로 오인해 그 이전 pending lifecycle을 숨기던 문제를 수정한다. closed merge는 mutation 대상에서 제외하되 non-actionable ordering barrier로 보존해 same-Issue retry coalesce가 이를 가로지르지 못하게 하고, exact FINAL marker까지 탐색을 계속한다.
- PR #470 review: 새 리소스를 선택했다가 해제하면 남은 역할·투입 초안 때문에 false dirty 상태가 유지되던 문제를 선택된 리소스 기준 canonical 비교로 수정한다.
- PR #470 review: 외부 변경으로 Milestone이 일반 Task로 바뀐 뒤 다시 불러올 때 더 이상 존재하지 않는 `소속 작업` 탭이 활성 상태로 남지 않도록 작업 정보 탭으로 정규화한다.
- PR #470 review: Membership 보유 Project의 Excel 보존 차단 오류에 명시 source와 target의 public Task ID를 포함하여 API의 구조화된 진단 계약을 지킨다.

### Changed

- Application version을 `0.85.1`에서 `0.86.0`으로 증가한다. 최신 main의 #452 release-candidate lifecycle 보완과 선행 #460 Stage Gate 구현을 함께 보존하며 이번 요청에서 정식 릴리스를 게시하지 않는다.

## [0.85.1] - 2026-10-06

### Fixed

- Issue #452: Main CI에서 검증한 non-docs `ci-<SHA>` candidate를 Generic Release Finalizer 판정 전에 삭제하지 않고 lifecycle handoff까지 보존하도록 GHCR 수명주기를 정합화한다.
- `release_required=false` finalize에서만 exact temporary candidate를 fail-closed helper로 정리하고, release-required candidate는 formal exact-digest promotion에 사용하도록 유지한다.
- Generic Finalizer/Resume 및 수동 finalize 경로에 temporary package cleanup을 위한 최소 `packages: write` 권한·job-scoped token과 정적 회귀 검증을 추가한다. 정식 image build/promotion은 계속 `release-image.yml`에만 위임한다.
- PR #469를 최신 `main` 0.85.0 / Issue #460 변경 위로 재정렬해 Milestone Stage Gate 구현과 문서를 보존한다.
- 실패한 immutable `v0.83.4`와 미게시 작업 후보 `0.83.5`는 재사용하지 않고 corrective PATCH `0.85.1`에서 새 Main verified candidate와 정식 GHCR promotion을 다시 수행한다.
- Application version을 `0.85.0`에서 `0.85.1`로 증가한다.

## [0.85.0] - 2026-10-05

### Added

- Issue #460: Task/Summary의 단일 명시 완료 단계 소속과 Summary 상속을 일정 Dependency 및 WBS와 분리하여 저장한다. canonical snapshot에 직접·유효 소속·상속 출처 및 Milestone의 소속 작업 진척·Ready·선행 차단·완료 불일치 진단을 제공한다.
- 작업 기본 필드와 소속의 복합 PATCH 및 여러 소속 변경의 batch command는 기존 edit session·Origin·If-Match 검증 아래 하나의 transaction/revision으로 처리한다. Summary의 파생 일정·진척은 읽기 전용을 유지한다.

### Changed

- Milestone 완료 전환을 서버에서 재검증하고 완료 단계의 명시·유효 소속 및 Dependency 구조 변경에는 먼저 재개하도록 요구한다. 일반 Task 진척과 비구조 편집은 기존 계약을 유지하고 완료 상태를 자동으로 연쇄 변경하지 않는다.
- 신규 Task↔Milestone Dependency 생성을 제한하며 기존 mixed Link의 조회·일정·명시적 편집·삭제 호환성을 보존한다.
- 소속 보존이 아직 지원되지 않는 Import/Copy/Template/Excel 경로는 명시적인 데이터 유실 방지 오류를 반환한다. Import의 기존 고정 성공 응답을 실제 저장으로 표시하지 않는다. 후속 Issue #464에서 완전한 보존을 구현한다.
- Application version을 `0.83.4`에서 `0.85.0`으로 증가한다. 별도 열린 PR #346의 `0.84.0`과 중복을 피하며 이번 요청에서 정식 릴리스를 게시하지 않는다.

## [0.83.4] - 2026-10-05

### Fixed

- Issue #452: 리소스·물류 유형·프로젝트 기준정보 관리자 페이지의 공통 시작점과 인증 presentation을 맞추고 비밀번호 입력의 경계·정렬·오류 연결을 명시한다. 관리자별 세션·API·권한 계약을 유지한다.
- 물류 관리자 세션 만료 후 새 로그인 입력이 mount되기 전에 focus를 시도하던 타이밍을 보정하여 재인증 focus 정책을 실제로 적용한다.
- Secondary button의 전역 외부 margin을 제거하고 toolbar/form/footer/독립 CTA가 간격을 소유하도록 기존 소비자를 이관한다. 링크·KPI·Task Editor의 의도 배치는 유지한다.
- 관련 인증·geometry 회귀와 제품 설계·UX·테스트 계획 문서를 동기화하고 Application version을 `0.83.3`에서 `0.83.4`로 증가한다.

## [0.83.3] - 2026-10-05

### Fixed

- Issue #439: GHCR Release candidate의 실제 container 이름 `mastergantt-release-candidate`를 registry Project/Task API smoke allowlist에 추가하여 v0.83.2 Release Run #131의 deterministic usage 오류를 수정한다.
- Release workflow 호출 인자와 registry smoke allowlist의 container 이름이 다시 어긋나지 않도록 정적 회귀 테스트를 추가한다.
- 실패한 annotated `v0.83.2` tag는 이동·재사용하지 않고 same-Issue corrective PATCH `0.83.3`에서 exact Main verified candidate digest 검증과 GHCR promotion을 다시 수행한다.
- Application version을 `0.83.2`에서 `0.83.3`으로 증가한다.

## [0.83.2] - 2026-10-05

### Changed

- Issue #439: PR/Main/Release의 checkout, Node/npm, Playwright, Next build cache, Docker Buildx/build-push setup 비용을 동일 JSONL/Step Summary 형식으로 계측한다.
- npm download cache는 OS/arch/Node/lockfile key와 exact hit/miss를 기록하고 `npm ci` 및 `node_modules` 비캐시 계약을 유지한다. Playwright browser cache는 baseline 10회 전에는 활성화하지 않는다.
- baseline analyzer를 workflow/event/job/metric별로 분리하고 서로 다른 successful run ID 10개 이상을 Phase 2 진입 기준으로 사용해 matrix shard와 rerun이 표본 수를 부풀리지 않도록 한다.
- cache miss에서도 기존 required quality/E2E/Docker gate를 그대로 실행하고 cache/artifact에 secret, runtime DB, test PASS evidence를 저장하지 않는 안전 계약을 문서·회귀 테스트로 고정한다.
- Application version을 `0.83.1`에서 `0.83.2`로 증가한다.

## [0.83.0] - 2026-10-05

### Added

- Issue #415: Excel 내보내기에 선택적 Resource Effort Summary/Detail을 추가해 역할별·개발자별 계획 M/D·M/M과 assignment grain 상세를 제공한다.
- Resource workload detail에 Calendar/range clipping이 반영된 canonical `effectiveWorkingDays`를 추가한다.

### Changed

- Excel 공수 견적은 #414 workload 서비스와 동일한 Project revision/range/`RESOURCE_MD_PER_MM` 기준을 재사용하며 assignmentId로 중복을 제거하고 여러 Group은 비가산 목록으로 표시한다.
- M/M 기준이 없거나 공수가 미설정된 경우 0으로 환산하지 않고 명시적인 미설정 상태를 유지한다.
- 기존 Gantt/Tasks/Project/Dependencies/Logistics 시트 순서와 Origin/If-Match/formula injection 보호를 유지하고 Application version을 `0.82.0`에서 `0.83.0`으로 증가한다.


## [0.82.0] - 2026-10-05

### Added

- Issue #430: Task/Summary Cut에서 source subtree 내부 Dependency는 허용하고 subtree 경계를 넘는 incoming/outgoing Dependency만 제한하는 boundary-aware 정책을 추가한다.

### Changed

- Context Menu `Cut`, `Ctrl/Cmd+X`, cut clipboard Paste와 server `reparent`가 동일한 Dependency boundary 판정을 사용하며 내부 Link의 ID/endpoints/type/signed lag를 이동 후에도 그대로 보존한다.
- 독립적으로 linked된 Paste anchor의 before/after 배치는 허용하되 linked leaf의 child 전환, Delete/Indent/Outdent/Convert 및 #378/#384 Copy 보호 정책은 유지한다.
- Unit/frontend model/SQLite service/Chromium 회귀와 Requirements/API/Scheduling/Relations/UX/Test Plan 문서를 동기화하고 Application version을 `0.81.0`에서 `0.82.0`으로 증가한다.

## [0.81.0] - 2026-10-05

### Added

- Issue #414: 기존 Resource workload에 PI/개발자/설비 담당/역할 미지정 수행 역할별 M/D·M/M subtotal과 `개발 견적` preset, 수행 역할·개발자 등급 drill-down을 추가한다.
- Resource Task detail에 canonical 진행률·상태/지연·일정과 allocation 기간/투입률, Resource 개발자 등급을 함께 표시한다.

### Changed

- #56의 Calendar/allocation 기반 계획 공수 산식과 assignmentId Grand Total dedup을 유지하면서 `assignment_role`을 분류 축으로만 확장한다. 역할 미지정은 Global Role에서 추정하지 않는다.
- 지연 판정은 #188 물류 대시보드와 동일한 Project timezone 기준 `progress < 100 && end < asOfDate`를 사용하며 progress/status는 계획 공수를 변경하지 않는다.
- Application version을 `0.80.0`에서 `0.81.0`으로 증가한다.

## [0.80.0] - 2026-10-04

### Added

- Issue #413: Task의 개인 Resource assignment에 수행 역할 `PI | DEVELOPER | EQUIPMENT_OWNER`를 저장하고 역할 우선 후보 필터 및 Resource별 역할 선택 UI를 추가한다.
- migration `0021_task_assignment_roles.sql`로 nullable `assignment_role`과 role membership/role-delete DB guard를 추가한다.

### Changed

- assignment target DTO가 Resource Global `roles`를 제공하고 Project assignment 응답/Project Copy/Project Template이 수행 역할을 보존한다.
- 사용 중인 Global Resource Role 제거는 Project/Task usage와 함께 `RESOURCE_ROLE_IN_USE`로 fail-closed한다. 역할 추가는 기존 사용 중 역할을 삭제하지 않는 diff 기반 갱신으로 처리한다.
- 역할 미지정 기존 assignment는 추정 backfill 없이 `NULL`로 유지하며 #56 allocation·Calendar·M/D·M/M 산식은 변경하지 않는다.
- Application version을 `0.79.2`에서 `0.80.0`으로 증가한다.

## [0.79.2] - 2026-10-04

### Fixed

- Issue #426: Resource Catalog의 Resource/Group pane을 정보량에 맞는 content-aware 비율로 재배치하고 중간 폭에서는 조기에 vertical stack하여 역할·등급·행 action 때문에 Resource identity가 collapse하는 회귀를 수정한다.
- Resource row를 Identity / Profile(현재 개발자 등급·Global 역할 요약 및 편집) / Lifecycle·Delete action으로 구분하고, 검색·생성·목록 geometry와 Group 구성원 footer의 `닫기` 좌측 / `구성원 저장` 우측 action hierarchy를 복구한다.
- #288의 개발자 등급 읽기 표시와 #412의 `전역 역할: 없음` 표시·역할 PATCH draft 보존을 유지하면서 390/768/1024/1440/1600px Chromium geometry 회귀와 관리 화면 공통 설계·QA 지침을 추가한다.
- 최신 main의 #418 scoped Header/Row add continuity를 보존하고 Application version을 `0.79.1`에서 `0.79.2`로 증가한다.

## [0.79.1] - 2026-10-04

### Fixed

- Issue #418: Workspace WBS 범위에서 native Grid Header `+`와 Row `+`의 의미를 scope-relative resolver로 통합한다. scoped Header는 active Summary root의 immediate child를, root/descendant Row는 해당 작업의 child를 생성하며 일반 Task first-child Summary 전환과 Milestone 차단을 기존 canonical 서버 계약으로 유지한다.
- canonical Gantt sync 뒤 `filter-tasks`를 같은 직렬 queue에서 적용하고 native add 전후 scroll/focus를 복원해 성공 저장 중 Grid 전체가 순간적으로 비거나 위치가 튀는 중간 상태를 제거한다. active scope와 동일 ProjectGantt/API instance, #412 Resource 역할 모델, #409 Relation Editor 식별자 검색 및 #416 Week Header 표시를 유지한다.
- 실제 SVAR Header/Row control, Milestone disabled semantics, requestAnimationFrame continuity probe와 pure intent Unit 회귀를 추가하고 Application version을 `0.79.0`에서 `0.79.1`로 증가한다.

## [0.79.0] - 2026-10-04

### Added

- Issue #412: Resource에 전역 역할 `PI`, `DEVELOPER`, `EQUIPMENT_OWNER`의 0..N 프로필을 추가하고 Resource Catalog 관리자 화면에서 다중 선택·표시할 수 있다.
- migration `0020_resource_roles.sql`로 Resource↔Role M:N을 저장하며 stable role CHECK, 중복 PK, Resource 삭제 cascade와 role→resource 조회 index를 추가한다.
- Resource Catalog create/update/response에 `roles`를 추가하고 기존 관리자 session·Origin·strong `If-Match`·catalog revision 계약을 유지한다.

### Changed

- 전역 `DEVELOPER` 역할과 `developerGrade`는 독립적으로 유지하며 역할 지정/해제가 등급을 자동 생성·삭제하지 않는다. 기존 #288의 Project System developer 신규 배정 시 등급 규칙은 변경하지 않는다.
- Resource Group 구성원 화면에는 현재 Resource 역할을 참고 정보로 표시하지만 membership, Task assignment, Project Equipment/System role, Calendar를 자동 변경하지 않는다.
- 최신 main의 #409 Relation taskId 검색 회귀 수정을 보존하고 Application version을 `0.78.1`에서 `0.79.0`으로 증가한다.

## [0.78.1] - 2026-10-04

### Fixed

- Issue #409: Context Menu `Copy ID`가 복사하는 canonical `taskId` UUID를 Relation Editor의 관계 추가 검색에서 직접 찾을 수 있도록 작업명·외부 ID·작업 ID 통합 검색을 추가한다.
- Relation Editor 후보/선택 상태에서 `externalId`와 `taskId`를 각각 `외부 ID`, `작업 ID`로 명확히 구분해 표시한다.
- taskId로 후보를 검색해도 Dependency Link 저장은 기존 `predecessorExternalId / successorExternalId` 계약을 유지하며 API/DB/Scheduling schema는 변경하지 않는다.
- 최신 main의 #416 Week Header 근무 가능 일수와 기존 #299/#407/#370 계약을 보존하고 Application version을 `0.78.0`에서 `0.78.1`로 증가한다.

## [0.78.0] - 2026-10-04

### Added

- Issue #416: Gantt Week Header의 기존 ISO `Wxx` 아래에 현재 Project Calendar 기준 실제 근무 가능 일수를 `N일` secondary text로 상시 표시해 여러 주의 capacity를 즉시 비교할 수 있게 한다.

### Changed

- #316의 canonical `workingDays`와 app-owned Week date class/MutationObserver lifecycle을 그대로 재사용하고, 요일별 근무 위치·공휴일명·비근무 사유는 기존 hover/focus Tooltip에서 확인하도록 정보 계층을 유지한다.
- 최신 main의 #299 Chart vertical DnD를 보존하면서 기존 ISO Week formatter, Week `cellWidth=68`, Day/Week 전환, Gantt/API instance, Scheduling/API/DB/revision 계약을 변경하지 않으며 390/768/1024/1440px Header geometry 회귀를 추가한다.
- Application version을 `0.77.0`에서 `0.78.0`으로 증가한다.

## [0.77.0] - 2026-10-04

### Added

- Issue #299: Gantt Chart의 Task/Summary/Milestone bar를 수직 Drag & Drop하여 같은 parent의 visible sibling 앞/뒤로 재정렬할 수 있다.
- vertical gesture는 axis lock 후 기존 수평 일정 이동/resize와 분리되고 protected hierarchy command에 정확히 한 번 저장된다. drop indicator와 긴 프로젝트 edge-scroll을 제공하며 reload와 후속 Task mutation에서도 canonical 순서를 유지한다.

### Changed

- 최신 main의 #300 Grid persistence, #335 linked same-parent reorder, #399/#407 subtree scope·scoped add, #384 selection, #367 timeline, #370 start-date quick-edit 계약을 보존한다.
- SVAR React Gantt 2.7.3 Chart의 X축-only bar drag 경계를 public `drag-task(top)` feedback과 server-authoritative `task-commands` bridge로 보완한다.
- Application version을 `0.76.1`에서 `0.77.0`으로 증가한다.

## [0.76.1] - 2026-10-04

### Fixed

- Issue #407: #399 Workspace 범위 탭에서 scope 여부만으로 모든 native Grid `+`를 차단하던 회귀를 수정해 scoped root/descendant의 유효한 Child Task 추가를 다시 허용한다.
- 행별 add 가능 여부를 subtree/milestone/권한 기준으로 판정하고 Context Menu Child/요약 작업 추가, 일반 Task first-child Summary 전환과 동일 canonical mutation 계약을 유지한다.
- scoped header/root-level add, root sibling/Outdent/Paste/DnD scope 탈출, Milestone child, readonly/mutation lock 및 #399 notification geometry 선제 차단을 유지하면서 #370 Date Picker와 #335 linked same-parent sibling reorder 계약을 보존한다.
- Application version을 `0.76.0`에서 `0.76.1`로 증가한다.

## [0.76.0] - 2026-10-04

### Added

- Issue #370: Project Workspace Grid의 `시작` 셀에서 Task/Milestone 시작일을 single click Date Picker로 빠르게 변경할 수 있다.
- getter-only `projectStart`는 서버 확정 effective `start` 표시를 유지하고, application-owned `input[type=date]` overlay가 선택 날짜를 기존 dependency-aware Task PATCH의 requested start 입력으로 전달한다.
- Summary/readonly/mutation lock 차단, Enter/Space keyboard open, Escape/focus restore, 실패 시 canonical 일정 유지 및 전용 Unit/Chromium E2E를 추가한다.

### Changed

- Grid 다중 선택 흐름에서 start-cell pointer intent를 보존하고 row selection을 먼저 확정한 뒤 현재 `projectStart` cell을 다시 찾아 Date Picker를 연다.
- 최신 main의 #335 linked-subtree sibling reorder, #399 Workspace 범위 탭, #384 다중 선택/복사, #367 timeline 확장, #303 Task status 계약을 보존한다.
- Application version을 `0.75.0`에서 `0.76.0`으로 증가한다.

## [0.75.0] - 2026-10-03

### Added

- Issue #335: Dependency Link가 연결된 Task/Milestone과 linked descendant를 포함한 subtree도 같은 parent 안에서는 Context Menu `Move Up/Down` 및 Grid `before/after`로 sibling order를 변경할 수 있다.

### Changed

- sibling reorder는 Link ID/source/target/type/lag와 requested/effective schedule 및 #303의 Task status/progress를 변경하지 않고 기존 `task-commands` transaction에서 siblingOrder와 revision만 확정한다.
- 다른 parent로 이동하는 Grid DnD/`child`, Indent/Outdent, Cut/Paste, Delete, Convert의 기존 Dependency guard는 유지한다.
- #399 Workspace WBS 범위 탭과 #303 Task status/progress 계약을 보존하고, 기존 Context Menu E2E의 linked Move 기대값을 새 정책으로 갱신하며 Application version을 `0.74.0`에서 `0.75.0`으로 증가한다.

## [0.74.0] - 2026-10-03

### Added

- Issue #303: Task/Milestone에 `not_started / in_progress / completed` 상태를 추가하고 진행률 100%와 완료 상태를 원자적으로 양방향 동기화한다.
- 완료된 Task/Milestone 및 derived progress가 정확히 100%인 Summary의 Grid 작업명에 취소선을 표시한다.

### Changed

- 최신 main의 #258 관계 Task 편집, #368 요청 종료일, #384 다중 Copy, #399 Workspace 범위 탭 계약을 유지한 채 Task status를 canonical API/SQLite snapshot에 포함한다.
- Migration `0019_task_status.sql`은 기존 progress를 기준으로 status를 deterministic backfill한다.
- subtree Copy는 명시적 status를 보존하고 Project Template instantiate 응답도 canonical status를 포함한다.
- Application version을 `0.73.0`에서 `0.74.0`으로 증가한다.


## [0.73.0] - 2026-10-03

### Added

- Issue #399: Project 일정 View에 `전체 프로젝트`와 여러 Summary subtree를 같은 화면에서 전환하는 compact WBS 범위 탭을 추가한다.
- Summary 범위 탭은 중복 생성 없이 재활성화하며 닫기, Arrow/Home/End/Delete keyboard, 한 행 horizontal overflow와 scope별 search/filter state를 지원한다.

### Changed

- #373의 `최상위로 열기` 기본 동작에서 `window.open`/popup blocker 의존을 제거하고 동일 ProjectGantt instance에서 `viewRootTaskId + filter-tasks` 범위만 변경한다.
- milestone/scoped/missing native add는 ProjectGantt의 native click capture 경계에서 canonical row/task를 확인해 SVAR target handler 전에 차단하고 feedback만 발행한다. 정상 add는 기존 SVAR/서버 mutation 경로를 유지해 invalid command의 visibility/focus scroll side effect 자체를 제거한다.
- 기존 `?rootTask=` deep link/reload/direct-entry와 실제 browser tab 간 revision freshness, canonical snapshot/Dependency/hierarchy guard 및 권한·If-Match·revision 계약을 유지한다.
- 최신 main의 #403 Project List column layout, #367 Timeline 동적 확장, #390 Copy ID 및 #364 clipboard compatibility를 보존한다.
- Application version을 `0.72.0`에서 `0.73.0`으로 증가한다.

## [0.72.0] - 2026-10-03

### Added

- Issue #367: Gantt Chart를 오른쪽으로 탐색할 때 공개 `scroll-chart.left`/`resize-chart.width`를 기준으로 남은 timeline 폭을 판정하고, 고정 start/open end의 SVAR public resize path로 미래 날짜 scale을 viewport 기반 chunk로 반복 확장한다.
- 최초 range가 viewport보다 짧으면 Core의 resize expansion과 추가 future buffer를 사용하고, canonical sync/Day·Week 전환 후에도 사용자가 확보한 future end 이상을 복구한다.

### Changed

- Day Header/timeline cell 폭을 44px에서 36px로 줄여 동일 화면에서 더 많은 날짜를 표시하며 Week 68px, 숫자-only Header와 Day/Week Tooltip 계약은 유지한다.
- Timeline 확장은 React `end` prop을 반복 변경하지 않아 Core store re-init을 피하고, Gantt/API instance, scroll/tree/column/filter/selection/fullscreen과 Project Scheduling/API/DB/revision 계약을 보존한다.
- PR CI #1496.1/#1572.1/#1575.1 분석에서 `area`를 수평 날짜 범위로 오해한 구현과 end-prop 기반 재초기화 위험을 제거했다. #1575.1의 #373 scoped filter 회귀 증거를 반영해 public resize expansion으로 설계를 전환한다. PR CI #1579.1/#1584.1/#1587.1에서는 #373 회귀가 해소된 것을 확인했고, SVAR horizontal virtualization에서 특정 Day 날짜나 `W38`이 반드시 DOM에 복귀한다고 가정하던 E2E를 동일 instance의 Day 숫자-only/Week `Wxx` scale 복원과 반대 scale cell 제거 검증으로 바로잡는다.
- 최신 main의 Issue #403 Project List 날짜 열 레이아웃 및 Issue #390 Copy ID 기능을 보존하고 Application version을 `0.71.1`에서 `0.72.0`으로 증가한다.

## [0.71.1] - 2026-10-03

### Fixed

- Issue #403: Project List의 생성/최근 변경 datetime이 인접 열을 침범하지 않도록 percentage 합계 기반 폭 배분을 명시적 `colgroup` column budget으로 전환하고 날짜 metadata의 최소 폭을 확보한다.
- 프로젝트명·사업부·제품·법인/사업장·상태·소유자·설명·날짜·Row Action의 역할을 fixed/flexible column으로 분리하고, 좁은 화면에서는 기존 table-owned horizontal scroll을 유지한다.
- 390/768/1024/1440/1600px에서 긴 metadata, browser locale/timezone 날짜, header/body alignment, sibling cell geometry, document/table overflow를 검증하는 Chromium 회귀를 추가하고 공통 UI/UX·QA 설계 기준을 동기화한다.
- Application version을 `0.71.0`에서 `0.71.1`로 증가한다.

## [0.71.0] - 2026-10-03

### Added

- Issue #390: Grid/Chart 작업 Context Menu에 `Copy ID`를 추가해 Task/Summary/Milestone의 canonical `taskId`를 OS clipboard에 복사한다.

### Changed

- readonly·mutation lock·Dependency 연결 여부와 무관한 조회성 action으로 동작하며 #384의 Task Copy/Paste clipboard·선택 집합과 Project revision을 변경하지 않는다.
- #364의 공통 clipboard compatibility를 재사용하고, modern 권한 거부 또는 자동 복사 최종 실패 시 수동 복사 Dialog를 제공한다.
- CI #1536.1의 E2E URL 정규식 parse 오류를 제거하고 latest main 기준 회귀를 다시 검증한다.
- Application version을 `0.70.2`에서 `0.71.0`으로 증가한다.


## [0.70.2] - 2026-10-03

### Fixed

- Issue #364: Project List/Workspace의 프로젝트 링크 복사가 secure-context Clipboard API에만 의존해 내부망 HTTP에서 자동 복사되지 않던 회귀를 수정한다.
- modern Clipboard API가 없거나 insecure context인 경우 사용자 click activation 안에서 legacy copy 호환 경로를 시도하고, 실제 성공한 경우에만 성공 안내를 표시한다.
- modern Clipboard API가 권한 거부/reject된 경우 legacy로 우회하지 않고 기존 수동 복사 모달을 유지하며, URL/권한/navigation/revision/Gantt 상태 계약은 변경하지 않는다.
- `plain.gantt.test` production HTTP transport에서 real browser legacy copy 경로를 검증해 localhost secure-context/mock만으로 HTTP 회귀가 통과하지 않도록 한다.
- Application version을 `0.70.1`에서 `0.70.2`로 증가한다.

## [0.70.1] - 2026-10-03

### Fixed

- Issue #366: #331에서 이미 수정된 Resource Catalog의 코드 입력·개발자 등급 컨트롤 overlap 해결책을 현재 main 기준 회귀 계약으로 직접 고정한다.
- 허용 최대 길이 64자 코드와 개발자 등급 선택 상태에서 390/768/1024/1440px 실제 input/select geometry, form bounds, document overflow 및 기존 Tab 순서를 Chromium으로 검증한다.
- Resource Catalog runtime CSS/API/DB/auth/session/revision/If-Match 계약은 변경하지 않으며 Application version을 `0.70.0`에서 `0.70.1`로 증가한다.

## [0.70.0] - 2026-10-03

### Added

- Issue #340: Task Editor 리소스 탭을 담당 리소스와 리소스 그룹의 compact section으로 분리하고 1024px 이상에서 Resource 쪽을 더 넓게 사용하는 content-aware 2-pane 레이아웃을 제공한다.
- 리소스/그룹 단일 유형 필터에서는 선택 pane이 전체 폭을 사용하며, 선택 Resource의 투입 시작/종료/투입률은 바로 아래 detail 영역에서 가용 폭을 사용한다.
- pane별 표시/전체 건수와 등록 없음/필터 결과 없음 상태를 구분하고 readonly에서는 현재 Task에 실제로 표시 가능한 할당 대상만 집계한다.
- 390/768/1024/1440px layout·overflow·필터 전환·allocation/Group 분리와 readonly 집계 Chromium 회귀를 추가한다.
- Assignment API, Project/Catalog revision, If-Match, 401/412, dirty/stale 및 canonical snapshot 계약은 변경하지 않는다.
- Application version을 `0.69.0`에서 `0.70.0`으로 증가한다.

## [0.69.0] - 2026-10-03

### Added

- Issue #343: Project List에 사업부, 제품, 법인/사업장을 독립 column으로 표시하고 #289의 canonical Project summary 표시명 계약을 재사용한다.
- 미지정 값은 `미지정`, 비활성 기준정보는 기존 표시명을 유지한 `(비활성)` 의미 텍스트로 표시하며 긴 이름은 한 줄 ellipsis와 `title` 전체값 접근 경로를 제공한다.
- native table semantics, 프로젝트명 primary Link, 상태 변경, 검색/필터, Row Action과 좁은 화면 table 내부 horizontal scroll 계약을 유지하고 관련 Unit/E2E 회귀를 보강한다.
- API/DB/Scheduling/SVAR 계약은 변경하지 않으며 Application version을 `0.68.1`에서 `0.69.0`으로 증가한다.

## [0.68.1] - 2026-10-03

### Fixed

- Issue #339: Task Editor Footer가 전역 `.secondary-button`의 page-level 상단 margin을 상속해 Reload/Cancel만 Save보다 아래로 밀리던 UI 회귀를 수정한다.
- Footer가 spacing을 소유하도록 세 action의 margin, control height, padding, line-height와 box sizing을 동일 geometry로 정규화하고 390/768/1024/1440px Chromium geometry 회귀를 추가한다.
- 390px wrap에서는 Reload 독립 행을 허용하면서 Cancel/Save 정렬과 전체 action 높이를 유지하고, 기존 stale/disabled/saving/readonly 및 Task 저장·revision 계약은 변경하지 않는다.
- Application version을 `0.68.0`에서 `0.68.1`로 증가한다.

## [0.68.0] - 2026-10-02

### Added

- Issue #384: Gantt의 checkbox·Ctrl/Cmd·Shift 다중 선택 집합을 Copy/Paste하고 canonical hierarchy 순서로 여러 root 및 전체 자손을 복제한다.
- 내부 Dependency를 새 Task/Link ID로 재매핑하며 외부 Link 제외, 단일 Cut/Edit/Delete/Move 경계, 기존 일정 재계산·원자성·권한·revision 계약을 유지한다.
- 기존 단일 Copy API와 호환되는 `taskIds` 계약과 selection/filter/clipboard 및 SQLite·Chromium 회귀 검증을 추가한다.

### Fixed

- SVAR가 우클릭 pointer gesture 중 row DOM을 교체해 contextmenu target이 조상으로 재지정되는 경우 pointerdown Task ID로 현재 canonical row를 다시 resolve해 작업 메뉴를 안정적으로 연다.
- 리소스 캘린더 서버 충돌 summary focus를 `setState` 직후 단발성 `requestAnimationFrame`에 의존하지 않고 실제 React commit 이후 effect에서 적용해 CI 부하에서도 접근성 focus 계약을 안정적으로 유지한다.
- PR review 보완으로 selection checkbox의 task shortcut을 Copy/Paste로 제한하고, keyboard Context Menu 종료 시 실제 checkbox trigger로 focus를 복원한다.
- Application version을 `0.67.2`에서 `0.68.0`으로 증가한다.

## [0.67.2] - 2026-10-02

### Changed

- Issue #332: 프로젝트 기준정보 관리자에서 인증, 범주, 항목 추가, 목록 영역을 compact flat surface와 divider로 명확히 구분한다.
- 사업부/제품/사업장·법인 목록에 semantic column header와 상태/사용 표시를 추가하고, `전체 / 활성 / 비활성` client-side 상태 필터 및 필터별 empty state를 제공한다.
- 상태 필터는 category 전환 뒤에도 유지하며 필터 조작만으로 catalog mutation/revision 변경을 발생시키지 않는다.
- 390/768/1024/1440px에서 document overflow 없이 좁은 화면의 표만 내부 수평 스크롤되도록 Chromium 회귀를 추가한다.
- Project Master 인증/session/Origin/If-Match/CRUD 의미는 변경하지 않는다.
- Application version을 `0.67.1`에서 `0.67.2`로 증가한다.

## [0.67.1] - 2026-10-02

### Fixed

- Issue #331 release recovery: immutable `v0.65.1`의 Release quality가 동일 #373 cross-tab loading race로 두 번 실패한 경우 기존 tag를 이동·덮어쓰지 않고, later same-Issue corrective merge의 Green main CI와 동일/강한 validation scope로 lifecycle을 승계할 수 있도록 Generic Release Finalizer를 보강한다.
- Formal release 상태를 tag 없음/미실행/진행 중/성공/실패로 판별하고, 진행 중 release는 중복 mutation 없이 DEFERRED하며, completed non-success release만 corrective supersession 후보로 취급한다.
- Cross-tab durable revision announcement는 listener 설치 후 localStorage를 병합하고 authoritative GET이 전진하지 않는 stale durable target은 폐기해 초기 loading race와 영구 stale revision 반복을 함께 방지한다.
- Application version을 `0.67.0`에서 `0.67.1`로 증가한다.

## [0.67.0] - 2026-10-02

### Added

- Issue #385: Project Workspace의 `더보기 → 가져오기 (JSON)`에서 문서화된 JSON 파일을 선택해 server-side Preview 후 Commit할 수 있는 JSON Import 진입점을 추가한다.
- `POST /api/projects/{publicId}/imports/preview`와 `POST /api/projects/{publicId}/imports` 경로를 기존 Import handler에 연결하고 preview는 edit session 기반 non-mutating, commit은 strong `If-Match` 기반 mutation 보안 inventory에 등록한다.
- 외부 작업자·시스템·LLM이 참조할 수 있도록 `docs/JSON_IMPORT.md`와 `docs/schemas/project-import.schema.json`을 추가한다.

### Changed

- JSON Import 진입점은 Workspace의 compact action menu에 배치하고 다른 Project mutation/Task Editor/Relation Editor가 진행 중이면 시작을 차단한다.
- initial loading 중 cross-tab revision event를 놓친 경우에도 저장된 최고 revision을 seed하여 canonical snapshot이 최신 revision으로 수렴하도록 보강한다.
- Application version을 `0.66.0`에서 `0.67.0`으로 증가한다.

## [0.66.0] - 2026-10-02

### Added

- Issue #329: Resource Catalog 관리자 화면에서 어떤 Project에도 참조되지 않은 Resource와 Resource Group을 명시적 확인 후 영구 삭제할 수 있다.
- Resource 사용 여부는 Task assignment, 설비 owner/contributor, 시스템 PI/developer, Resource Calendar를 통합하고 Group은 Task assignment와 Resource Group Calendar를 통합해 distinct Project 수로 판정한다.
- `DELETE /api/resources/{resourceId}`와 `DELETE /api/resource-groups/{groupId}`를 추가하고 관리자 session, exact Origin, strong catalog `If-Match`, transaction 내 usage 재검증 및 catalog revision +1 계약을 적용한다.

### Changed

- Resource Catalog 응답에 `projectUsageCount`와 `deletable` UX 힌트를 추가하고, 사용 중 항목은 삭제 불가 사유를 표시한다. 실제 DELETE는 UI 상태를 신뢰하지 않고 서버에서 다시 fail-closed 검증한다.
- 안전한 삭제 시 Resource/Group membership만 함께 정리하며 반대편 Catalog entity는 보존한다. 기존 FK `RESTRICT/NO ACTION`은 최종 무결성 방어선으로 유지한다.
- Application version을 `0.65.1`에서 `0.66.0`으로 증가한다.


## [0.65.1] - 2026-10-02

### Fixed

- Issue #331: 리소스 관리의 신규 리소스/리소스 그룹 생성 폼을 실제 field 수에 맞는 별도 responsive Grid로 분리하고 shrink 가능한 track과 control containment를 적용해 코드·개발자 등급·추가 버튼이 중간 viewport에서 겹치지 않도록 수정한다.
- 390/768/1024/1440px에서 두 생성 폼의 direct control overlap/form bounds/document overflow와 신규 리소스 폼 Tab 순서·개발자 등급 옵션을 Chromium으로 검증한다.
- Grid reorder 직후 첫 inline rename 클릭에서 DOM editability와 실제 SVAR event guard ref가 다른 render 시점을 가리키지 않도록 해당 ref와 project revision/session invalidation을 layout phase에서 동기화한다. 최신 main의 강화된 reorder helper는 그대로 보존한다.
- Resource Catalog API, 관리자 session/revision/If-Match, Scheduling/DB 및 SVAR dependency 계약은 변경하지 않는다.
- Application version을 `0.65.0`에서 `0.65.1`로 증가한다.

## [0.65.0] - 2026-10-02

### Added

- Issue #316: Gantt Week Header hover/focus Tooltip에서 Project Calendar 기준 실제 근무일 수와 명명된 NON_WORKING 공휴일을 표시한다.
- Issue #315의 검증된 scale CSS class/date parser 및 viewport-safe Tooltip lifecycle을 Week scale에 재사용하고 SVAR Sunday Week anchor를 ISO Monday로 정규화한다.
- WORKING weekend override와 이름 없는 NON_WORKING을 canonical 근무일 계산에 반영하면서 기존 ISO `Wxx`, Week 68px, Day/Week 전환 및 Gantt/API instance 계약을 유지한다.
- Application version을 `0.64.0`에서 `0.65.0`으로 증가한다.

## [0.64.0] - 2026-10-02

### Added

- Issue #377: Task Editor 관계 탭에서 기존 선행/후행 관계를 직접 편집·삭제하고, 관계가 없는 Task/Milestone도 현재 작업을 Anchor로 Relation Editor를 열어 새 선행/후행 관계를 추가할 수 있다.
- 기존 Relation Editor의 linkId 진입에 task Anchor 진입을 추가하며 FS/SS/FF/SF, signed Lag/Lead, 후보 검색과 기존 Link POST/PATCH/DELETE·Scheduling 계약을 그대로 재사용한다.

### Changed

- Task draft dirty/stale/readonly/pending 및 Summary에서는 relation mutation을 fail-closed하고, 성공한 relation mutation은 열린 Task Editor의 base/draft/revision을 imperative canonical sync로 갱신하여 Relation Editor가 topmost modal을 유지한다.
- Task Editor 관계 행의 직접 삭제 confirmation은 keyboard focus를 취소 버튼으로 이동시키고 취소 시 원래 삭제 trigger로 복원한다.
- 390/768/1024/1440px relation action layout, 기존 관계 PATCH→DELETE, zero-link Anchor POST, modal top-layer 및 focus 회귀 E2E를 보강한다.
- Application version을 `0.63.2`에서 `0.64.0`으로 증가한다.

## [0.63.2] - 2026-10-02

### Fixed

- Issue #372: Gantt native fullscreen에서 Grid/Chart 작업을 더블클릭하거나 Context Menu → Edit으로 Task Editor를 열 때 애플리케이션이 `document.exitFullscreen()`을 강제 호출하던 동작을 제거한다.
- Task Editor의 저장·취소·닫기와 Relation Editor의 open/close가 동일 fullscreen/Gantt instance를 유지하고, 기존 scroll·tree·column·scale·selection/filter 및 focus 복원 계약을 보존한다.
- fullscreen Editor 회귀 E2E에서 Grid/Chart 진입 경로, readonly, Relation Editor, shortcut guard와 강제 `exitFullscreen()` 호출 0회를 검증한다. Relation Link fixture는 endpoint 날짜를 가시 구간으로 정렬해 off-viewport locator timeout을 방지한다.
- Application version을 `0.63.1`에서 `0.63.2`로 증가한다.

## [0.63.1] - 2026-10-02

### Changed

- Issue #375: Gantt Chart의 일정 있는 Summary Task는 SVAR root bar의 interaction/x·width geometry를 유지하면서 visual body와 progress만 일반 Task 높이의 60%로 줄여 행 중앙에 표시한다.
- Summary의 hover/selected/focus/critical 상태는 얇은 visual body에 유지하고, 투명해진 상·하 root 영역도 기존 click/double-click/right-click/drag hit area로 남긴다. 일반 Task·Milestone 및 일정 없는 Summary의 기존 표현은 변경하지 않는다.
- 390/768/1024/1440/1600px, Day/Week, fullscreen, readonly와 Empty Summary를 포함하는 Chromium geometry/interaction 회귀 검증을 추가하고 Application version을 `0.63.0`에서 `0.63.1`로 증가한다.

## [0.63.0] - 2026-10-01

### Added

- Issue #373: 하위 작업이 있는 Summary의 Grid/Chart Context Menu에 `최상위로 열기`를 추가하고, 선택 Summary를 가상 root로 삼아 해당 Summary와 모든 자손만 새 브라우저 탭에서 표시하는 WBS scoped view를 지원한다.
- scoped view는 `?rootTask=<taskId>` deep link와 기존 SVAR `filter-tasks` 경로를 사용하며, 전체 Project canonical snapshot·Dependency·Resource/Logistics 연결·edit session·Origin·If-Match·revision 계약을 유지한다.
- scoped tab의 편집으로 revision이 증가하면 동일 origin의 다른 Project tab에 revision 신호를 전달해 최신 canonical snapshot을 재조회하되 기존 Gantt instance와 사용자 view state를 불필요하게 remount하지 않는다.
- 삭제되거나 Summary가 아니게 된 root는 전체 Project로 조용히 fallback하지 않고 scope 오류와 복귀 경로를 표시하며, 자식이 모두 제거된 빈 Summary는 유효한 scoped root로 유지한다.
- PR review 보완으로 scoped root 밖 hierarchy mutation을 Context Menu/shortcut/native add 및 DnD provisional 단계에서 차단하고, hidden ancestor의 물류 subtree 상속 및 initial loading/in-flight refresh 중 연속 cross-tab revision N→N+1 동기화를 보존한다.
- Application version을 `0.62.0`에서 `0.63.0`으로 증가한다.

## [0.62.0] - 2026-10-01

### Added

- Issue #378: Task/Summary subtree Copy 시 복사 집합 내부에서 predecessor와 successor가 모두 포함된 Dependency Link만 새 Task ID로 재매핑해 함께 복제한다.
- 복제 Link는 새 public ID를 사용하고 FS/SS/FF/SF 및 signed lag/lead를 보존하며, 외부→내부·내부→외부 경계 Link는 기본적으로 복제하지 않는다.
- copied leaf는 원본 requestedStart/duration/scheduleMode를 보존한 뒤 현재 Project Calendar와 전체 Dependency engine으로 effective schedule을 재계산하고 Summary 파생값을 같은 transaction에서 갱신한다.
- linked Task의 Copy와 copy-clipboard Paste(before/after)는 허용하되 Cut/reparent/Indent/Outdent/Delete/Convert와 linked leaf를 Summary로 바꾸는 child Paste 보호는 유지한다.
- Unit/SQLite service/Chromium 회귀 검증을 보강하고 Application version을 `0.61.0`에서 `0.62.0`으로 증가한다.

## [0.61.0] - 2026-10-01

### Added

- Issue #368: Task Editor의 일반 Task 일정 입력에 `요청 종료일`을 추가하고, Project Effective Calendar의 양 끝 포함 근무일 규칙으로 기간↔요청 종료일을 양방향 계산한다.
- 마지막으로 직접 수정한 기간 또는 요청 종료일을 기준으로 요청 시작일 변경 시 반대 값을 재계산하며, 공휴일/NON_WORKING/WORKING 예외와 Auto 비근무 시작일 보정을 동일 Scheduling Domain 함수로 적용한다.
- 요청 종료일은 UI-only draft로 유지해 Task PATCH와 DB의 canonical `requestedStart + duration` 계약을 변경하지 않고, 서버 확정 시작/종료일과 Dependency 재계산 결과를 별도 정보로 표시한다.
- 필드별 오류 연결과 390/768/1024/1440px 반응형 계약을 유지하고, 단위/E2E 회귀 검증을 추가한다.
- Application version을 `0.60.1`에서 `0.61.0`으로 증가한다.

## [0.60.1] - 2026-10-01

### Fixed

- Issue #363: 빈 프로젝트 생성 폼을 기본 정보 / 프로젝트 분류 / 설명 / 편집 권한의 semantic section으로 재구성해 관련 없는 필드가 grid 잔여 공간 때문에 인접해 보이던 문제를 수정한다.
- 사업부·제품·사업장/법인 기준정보 group을 full-width responsive 영역으로 분리하고 프로젝트 이름·소유자·상태·설명·편집 비밀번호에 content-aware 폭을 적용한다.
- 320/390/768/1024/1440/1600px geometry 회귀 검증에 긴 기준정보 label과 semantic group 순서/폭/overflow 검사를 추가한다.
- 기존 Project 생성 API/DB/validation, #282 wide page, #289 기준정보 저장, tab/draft/accessibility 계약은 유지한다.
- Generic Release Finalizer가 동일 PR head SHA의 이전 실패/cancelled required check를 최신 성공 check보다 나중에 순회해 `NOT TESTED`로 오판하던 문제를 수정하고, required check 이름별 최신 check-run ID만 판정하도록 한다.
- Application version을 `0.60.0`에서 `0.60.1`로 증가한다.

## [0.60.0] - 2026-10-01

### Added

- Issue #315: Gantt Day Header hover/focus Tooltip에서 locale 요일과 Effective Project Calendar의 명명된 NON_WORKING 휴일명을 표시한다.
- 동일 날짜의 복수 Project-level 휴일명은 canonical snapshot의 optional `exceptions[].names` projection으로 중복 없이 deterministic하게 제공한다.
- SVAR 공개 `scales[].css(date)`로 masterGantt-owned 날짜 class를 부여하고, viewport-safe `role="tooltip"` overlay를 연결한다. WORKING override와 일반 weekend에는 별도 휴일명을 추가하지 않는다.

## [0.59.0] - 2026-10-01

### Added

- Issue #345: Summary를 WBS 컨테이너로 정의해 자식이 없는 Summary의 직접 생성과 마지막 자식 삭제·이동 이후 유형·ID 유지를 지원한다.
- 일정 있는 Task/Milestone 자손이 없는 Summary의 날짜·기간·진척을 `null`로 표현하고 저장·집계·Grid/Chart·Import/Export·복사/템플릿 경로를 정합화한다. 일반 Task/Milestone의 필수 일정과 보안·revision 계약은 유지한다.
- Import는 schema 1.0 순수 검증기·null 계약·VBA 예제까지만 추가하며 신규 preview/commit 화면/API는 #30 후속 범위다.

### Changed

- Issue #361: PR CI, Main CI, Issue Lifecycle, Generic Release Finalizer, GHCR Release 실행 인스턴스 이름에 Primary Issue/PR/run attempt 추적 정보를 연결하고 PR branch/body/title의 Primary Issue 일치를 초기 CI gate에서 검증한다.
- Lifecycle가 정식 release workflow를 dispatch할 때 Issue/PR trace input을 함께 전달하되 required check 이름, release 권한·승인·digest gate와 application version은 변경하지 않는다.
- PR title/body 변경 시 `edited` 이벤트로 trace gate를 재실행하고, 제목에는 Primary Issue 하나만 허용한다. Dependabot 자동 PR은 작성자·동일 저장소·`dependabot/` branch를 모두 확인한 제한적 예외로 처리한다.

- CI 실행 제목에 PR 제목을 포함해 `Issue #345`와 같은 관련 Issue 번호를 Actions 실행 목록에서 확인할 수 있게 한다. Workflow `CI`와 required check 이름·권한·실행 gate는 유지한다.
- PR CI #1376의 production dependency audit 대응으로 `next`와 `@next/env`를 16.3.8로 갱신한다.
- 빈 Summary의 canonical 날짜를 표시하는 Grid getter가 특정 render의 Task map을 캡처하지 않고 최신 canonical ref를 읽도록 변경해, 실패 복구에서도 마지막 확정 일정이 유지되게 한다.
- migration CLI 회귀 기대값에 `0018_empty_summary_schedule.sql`과 migration ledger 18건을 반영한다.\n- CI #1381에서 확인된 빈 Summary Outdent 후 잔존 bar 회귀를 보완하기 위해 latest-ref Grid getter는 유지하고 `tasksById` 기반 column refresh trigger를 복원한다.
- Application version을 `0.58.6`에서 `0.59.0`으로 증가한다.

## [0.58.6] - 2026-10-01

### Fixed

- Issue #344 후속: 실패한 main CI 이후 같은 Issue의 corrective merge는 docs-only/non-docs 검증 scope가 동일할 때만 Generic Release Finalizer가 수렴하도록 하고, scope가 다르면 앞선 실패 merge를 우회하지 않는다.
- coalesce된 모든 PR identity를 보존해 formal release 성공 후 각 branch를 공통 safe cleanup으로 검증·삭제하며, 하나라도 cleanup이 완료되지 않으면 FINAL marker와 Issue close를 금지한다.
- 프로젝트 정보/더보기 disclosure는 native Dialog open과 충돌하는 blur 기반 닫기를 제거하고, keyboard Tab 이후 실제 focus가 disclosure 밖으로 이동한 경우에만 닫도록 보완한다.
- Grid DnD/구조 이동 직후 inline rename 회귀 테스트는 frontend canonical mutation lock 해제를 확인한 뒤 편집을 시작해 서버 응답과 UI 동기화 완료 사이의 race를 제거한다.
- 최신 main의 Next.js 16.3.7 보안 패치와 CI 최적화를 그대로 유지하며 이전 16.3.6 의존성 상태로 되돌리지 않는다.
- Application version을 `0.58.5`에서 `0.58.6`으로 증가한다.

## [0.58.5] - 2026-10-01

### Changed

- Issue #356: 일반 PR의 Docker baseline image 비교를 standalone/image 구조 변경에만 실행하고, HTTP/HTTPS transport smoke를 deploy/security/http/auth 관련 변경에만 선택 실행하여 필수 candidate/runtime smoke를 유지하면서 불필요한 이중 build·browser setup을 줄인다.
- main push와 수동 CI에서는 transport smoke를 항상 유지하며 required aggregate check와 fail-closed routing 계약은 변경하지 않는다.
- 완료된 Issue #118 고정 before/after 레이아웃 evidence workflow를 manual-only historical evidence로 전환하고 workflow contract·원격 검증 문서를 동기화한다.
- 프로젝트 인증·세션 handler(`src/server/projects/**`) 변경도 PR transport smoke 대상에 포함해 API route 밖 구현 변경이 HTTP/HTTPS 검증을 우회하지 못하도록 한다.
- CI #1368에서 감지된 Next.js `next/og ImageResponse` critical advisory 대응으로 `next`와 `@next/env`를 16.3.7로 갱신하고 lockfile을 동기화한다.
- fresh Chromium이 격리 hosts/Nginx 설정 직후 일시적으로 `chrome-error://chromewebdata/`로 전환하는 경우 readiness 확인 뒤 최초 GET navigation만 1회 재시도하며, mutation은 재시도하지 않는다.
- GitHub-hosted runner의 Playwright OS dependency 설치가 Ubuntu mirror 지연으로 길어질 수 있어 E2E shard timeout을 15분에서 20분으로 조정하되 4-way shard와 `workers: 1` 격리 계약은 유지한다.
- CI #1369에서 드러난 `@next/env` 고정 버전 회귀 테스트를 Next.js와 동일 exact version을 요구하는 계약으로 변경해 보안 patch 갱신 시 stale 숫자 기대값으로 실패하지 않도록 한다.
- CI #1372에서 SemVer 회귀 테스트의 과도한 escape를 수정하고, shard 2가 74개 테스트를 모두 PASS한 뒤 cleanup 직전에 20분 timeout으로 취소된 실행을 근거로 E2E shard timeout을 25분으로 조정한다.
- Application version을 `0.58.4`에서 `0.58.5`로 증가한다.

## [0.58.4] - 2026-09-30

### Fixed

- Issue #344: 정상 삭제 성공 후 `EMPTY_SUMMARY_NOT_ALLOWED` 응답만으로 작업이 부활하는 원증상은 최신 main에서 재현되지 않았으며, 실패 복구 GET이 오래된 snapshot을 반환하는 경로에서 이전 삭제 결과를 덮어쓰는 문제를 재현하고 수정한다.
- canonical revision guard와 `no-store` 조회, 최신 snapshot 기반 in-place 복구를 적용해 오래된 응답 또는 복구 GET 실패 이후에도 성공한 삭제 결과를 보존하며, 마지막 자식 삭제를 거부하는 도메인 정책은 유지한다.
- 삭제 이후 남은 형제 작업의 상대 순서를 비교해 불필요한 이동 명령을 방지하고 Summary 접힘 상태를 보존한다. 복구 실패·오래된 응답·readonly 전환과 실제 포인터 편집 회귀 검증을 추가한다.
- Application version을 `0.58.3`에서 `0.58.4`로 증가한다.

## [0.58.3] - 2026-09-30

### Fixed

- Issue #330: 물류 유형 관리 화면의 설비/시스템 전환 버튼 정렬과 유형 추가 폼의 정렬 입력·추가 버튼 겹침을 수정하고, 390/768/1024/1440px에서 content-aware reflow와 document overflow 회귀 검증을 추가한다.
- 목록에 전체/활성/비활성 client-side 상태 필터와 필터 결과 empty state를 추가하고, 목록 행의 세로 여백을 줄여 기존 조작성과 관리자 인증/session/catalog revision 계약을 유지한 채 정보 밀도를 높인다.
- Application version을 `0.58.2`에서 `0.58.3`으로 증가한다.

## [0.58.2] - 2026-09-30

### Fixed

- Issue #326: 작업 캘린더의 국가 규칙/날짜 예외 draft key 생성을 `crypto.randomUUID()` 직접 호출에서 client-local ID helper로 전환해 HTTP/IP 등 `randomUUID` 미지원 브라우저 컨텍스트에서도 추가 동작이 화면 Error Boundary로 전파되지 않도록 한다.
- 임시 key는 Web Crypto UUID → `getRandomValues` → 비보안 로컬 fallback 순서로 생성하며 React/local draft 식별에만 사용하고 서버 canonical public ID·인증/세션 난수 정책은 변경하지 않는다.
- helper Unit test와 `Crypto.prototype.randomUUID`를 제거한 Chromium 작업 캘린더 회귀 테스트를 추가한다.
- Application version을 `0.58.1`에서 `0.58.2`로 증가한다.

## [0.58.1] - 2026-09-30

### Changed

- Issue #314: Gantt Day mode의 하위 날짜 Header를 locale 기반 날짜+요일 표기에서 day-of-month 숫자(`1`~`31`)만 표시하도록 간소화한다.
- SVAR 공개 `scales[].format` API를 사용하며 기존 Month Header, ISO Week, 44/68px cellWidth, 주말 강조, Gantt/API instance identity와 일정 데이터 계약은 유지한다.
- 숫자 formatter Unit test와 Day → Week → Day Chromium 회귀 검증을 추가한다.
- PR 회귀에서 확인된 Grid DnD/selection 후 stale inline edit session을 정리해 다음 작업명 클릭이 편집기로 정상 진입하도록 보완한다.
- Application version을 `0.58.0`에서 `0.58.1`로 증가한다.

## [0.58.0] - 2026-09-30

### Added

- Issue #289: Project에 사업부·제품·사업장/법인 nullable 선택형 메타데이터와 전역 project-master catalog/admin API·UI를 추가한다.
- migration `0017_project_master_catalog.sql`로 stable master 참조, category 무결성, catalog revision 및 별도 관리자 credential/session을 추가한다.
- 전역 `/project-master-admin` 관리 화면에서 category별 항목 추가·표시명 수정·활성/비활성·정렬 순서·사용 Project 수를 관리한다.

### Changed

- Project 생성·설정·목록·복사·Template 경로가 동일 global master 참조를 보존하며 inactive 항목은 신규 선택에서 제외하되 기존 참조는 유지한다.
- #280의 물류 관리자와 동일한 bounded 관리자 로그인 rate-limit 패턴을 project-master 관리자 인증에도 적용한다.
- Application version을 `0.58.0`으로 증가한다.

## [0.57.0] - 2026-09-30

### Added

- Issue #288: 글로벌 Resource에 nullable 개발자 등급(초급/중급/고급/특급)을 추가하고 Resource 관리자에서 생성·표시·수정할 수 있도록 한다.
- 시스템 Developer 신규 배정 시 개발자 등급을 필수 검증하고, 기존 미지정 Developer 배정은 migration 호환을 위해 보존한다. 등급은 일정·공수·capacity·비용 계산에 영향을 주지 않는다.
- `0016_resource_developer_grade.sql`과 DB/역할/Chromium 회귀 테스트를 추가한다.


## [0.56.0] - 2026-09-29

### Added

- Issue #280: 설비 유형과 물류 시스템 유형을 고정 allowlist가 아닌 글로벌 관리 카탈로그로 전환하고, 전용 `/logistics-admin` 관리자 화면에서 유형 추가·표시명 수정·활성/비활성·사용 건수를 관리한다.
- `LOGISTICS_CATALOG_ADMIN_PASSWORD` bootstrap credential, 별도 HttpOnly 관리자 세션, 런타임 비밀번호 변경, catalog revision/`If-Match` 동시성 제어를 추가한다.
- migration `0015_logistics_type_catalog.sql`에서 기존 12개 type code와 프로젝트 물류 데이터를 보존하면서 DB 고정 type CHECK를 catalog FK로 전환한다.
- Project Workspace의 설비/시스템 추가·수정은 active catalog를 사용하고, 기존 inactive type은 참조를 보존한 채 편집할 수 있다.

## [0.55.0] - 2026-09-29

### Added

- Issue #258: 관계가 있는 작업의 이름·진행률 등 메타데이터를 유효 일정 보존 상태로 편집하고, 일정 필드 변경 시 `requestedStart`와 전체 의존관계를 기준으로 일정을 재계산한다. Manual 충돌이나 할당 기간 위반은 작업·일정·revision 변경을 원자적으로 취소한다.

### Changed

- 작업 편집기·Grid·차트의 편집 제한을 필드별로 분리해 관계 작업의 메타데이터 편집과 서버 검증을 거치는 일정 편집을 허용한다. readonly·요약 작업·pending·stale 상태의 보호 계약은 유지한다.

## [0.54.1] - 2026-09-29

### Fixed

- Issue #300: Grid Drag & Drop의 확정 이동을 기존 Task hierarchy command에 연결하여 작업명 수정·재조회 후에도 새 parent/sibling 순서를 유지한다.
- 드래그 중 화면 피드백과 서버 저장을 구분하고 canonical 내부 이동의 중복 전송을 차단한다. 기존 권한·revision·실패 복구와 동일 Gantt 인스턴스를 유지한다.
- CI #1232에서 Project List 상태 E2E가 React hydration 전에 상호작용해 이벤트가 유실되는 race를 확인하고, 상태 변경 control을 hydration 완료 뒤 활성화하도록 보완했다.

## [0.54.0] - 2026-09-29

### Added

- Issue #285: 공정 생성 요청에서 `code` 생략을 허용하고 서버가 공정 public UUID를 기반으로 안정적인 내부 코드 `PROC-<UUID>`를 생성한다. 기존 명시적 code API와 수정 화면의 code 편집 계약은 유지한다.

### Changed

- 물류 구성의 공정 추가 모달에서 업무 입력이 아닌 공정 코드 필드를 제거하고 공정명을 첫 focus/필수 입력으로 사용한다. 기존 DB `code NOT NULL / UNIQUE`, Project copy·Template·Excel 조회 계약은 변경하지 않는다.

## [0.53.6] - 2026-09-29

### Fixed

- Issue #279: 물류 구성 5개 서브탭의 수평 overflow는 유지하면서 교차축 세로 overflow를 명시적으로 차단하고, 음수 하단 여백에 의존하던 active indicator 정렬을 제거한다.
- 좁은 화면의 ArrowLeft/ArrowRight/Home/End 키보드 탐색에서 포커스된 탭을 수평 viewport 안으로 보정하며 390/768/1024/1440px의 실제 tablist geometry를 Chromium E2E로 검증한다.


## [0.53.5] - 2026-09-29

### Fixed

- Issue #269: 프로젝트 복사·템플릿 저장의 인증 만료 재입력과 원본 revision 충돌 복구를 추가한다. 최신 원본을 명시적으로 확인한 뒤 재제출하며, 조회 실패·늦은 응답에서 저장을 차단하고 일반 입력 초안을 유지한다.

## [0.53.4] - 2026-09-29

### Fixed

- Issue #268: 리소스·그룹 저장 실패 시 입력을 보존하고 성공한 폼만 초기화한다. 목록 재조회 오류·세션 만료·revision 충돌의 복구 경로와 최신 목록 확인 전 저장 차단을 추가한다. 최신 관리자 비밀번호 변경 모달 UX를 유지하면서 검증 오류와 성공 안내를 분리하고 390px 긴 이름·헤더 overflow를 방지한다.

## [0.53.3] - 2026-09-29

### Changed

- Issue #282: `/projects/new`를 page-specific wide shell로 전환해 사이트 헤더 아래 불필요한 상단 여백과 75rem 본문 cap을 제거한다.
- 빈 프로젝트와 템플릿 생성 폼을 desktop/tablet의 가용 수평 공간을 활용하는 responsive grid로 정돈하고, 704px 이하에서는 logical one-column flow로 reflow한다.
- 320/390/768/1024/1440/1600px geometry E2E를 추가해 header spacing, wide form, multi-column/single-column 전환과 document overflow 부재를 검증한다.

## [0.53.2] - 2026-09-29

### Fixed

- Issue #267: 물류 대시보드 조건 변경·조회 실패에서 이전 KPI와 작업 이동을 차단하고 최신 응답만 표시한다. 기간 입력 검증과 명시적 재시도, 세부 현황 탭의 키보드·접근성 연결을 추가한다.

## [0.53.1] - 2026-09-29

### Fixed

- Issue #266: 관계 편집을 공통 native Dialog로 전환하고 후보 키보드 선택, 초안 폐기·삭제 확인, 요청 중 닫기·중복 요청 차단을 적용한다. 명시적 닫기 명령은 후보 popup보다 우선해 닫기/dirty 확인 흐름으로 진입하며, 선행 방향 관계 생성 성공 후 새 관계 초안을 기본값으로 초기화한다.

## [0.53.0] - 2026-09-29

### Added

- Issue #261: Resource Group/Resource 사용자 날짜 예외에 근무일(WORKING)을 추가하고 Project < Group < Resource 순서로 가용 Calendar를 결정한다. 같은 계층 충돌은 Calendar 저장과 그룹 구성원 변경에서 원자적으로 거부한다.
- Calendar Editor에서 근무·휴무 유형을 저장·복원하고 미리보기에 상위 대비 적용/효과 없음, 리소스별 최종 상태와 출처를 표시한다. 효과 없는 명시 예외도 저장할 수 있다.
- Resource workload의 M/D·M/M·과투입 계산에 계층형 Calendar를 적용하며 Project Task 일정과 기존 인증·revision 계약을 유지한다.

## [0.52.4] - 2026-09-29

### Fixed

- Issue #265: 템플릿 조회 실패·정상 빈 목록·검색 결과 없음을 구분하고 재시도를 제공한다. Native radio 선택, 검색 결과와 선택 요약, 사용자 이름 보존, 필드 오류 접근성과 반응형 폼 간격을 개선한다.

## [0.52.3] - 2026-09-29

### Changed

- Issue #283: Docker production runtime을 Next.js `output: "standalone"` 기반으로 전환하여 final image가 traced runtime dependency, `.next/static`, SQL migration, build-time compiled startup 도구만 포함하도록 축소한다.
- container startup validation과 DB migration은 build stage에서 CommonJS JavaScript로 컴파일하여 final image에서 전체 `src`, 전체 `.next`, production `node_modules` 복사와 TypeScript runtime loader 의존을 제거한다. repository의 `npm run db:migrate` source CLI용 `tsx`는 `devDependency`로 이동하고 production dependency/runtime에서는 제거하며, standalone final image에도 포함되지 않는지 정책 검사로 고정한다. source `npm run start`는 static/public/migration 자산을 준비한 generated standalone server를 실행하도록 전환하고 repository-root Next production env files를 먼저 로딩해 기존 hostname/port, `.env.local`, DB migration 경로 사용법을 유지한다.
- PR Docker gate는 PR base image와 candidate를 동일 runner에서 build하여 uncompressed image size, 주요 runtime artifact footprint와 상위 layer를 기록한다. 최소 25% 감소 hard gate는 이번 non-standalone → standalone migration에만 적용하여 이후 일반 PR을 불필요하게 차단하지 않는다. 기존 non-root, migration-before-server, readiness, native SQLite, restart persistence, transport/Compose smoke는 유지한다.

## [0.52.2] - 2026-09-29

### Fixed

- Issue #264: 새 프로젝트 생성 방식 탭을 왕복해도 각 폼의 초안을 유지하고, 제출 중 방식 전환과 중복 요청을 차단한다. 비밀번호는 제출 payload 확보 후 메모리에서 지운다.
- 본문 바로가기 후 활성 생성 panel의 첫 컨트롤에 focus가 들어오면 tablist를 다시 역방향 탐색할 수 있도록 skip-navigation 상태를 해제한다.

## [0.52.1] - 2026-09-29

### Fixed

- Issue #263: 작업 물류 연결·리소스 할당은 현재 작업/revision의 조회가 성공한 뒤에만 저장할 수 있다. 조회 오류의 빈 초안 저장을 차단하고 명시적 재시도를 제공한다.
- 물류 설비·시스템 담당자 후보 조회 실패를 알리고 최신 목록 확인 전 편집을 잠근다. 기존 담당자 이름·코드는 canonical 값으로 표시한다.

## [0.52.0] - 2026-09-29

### Changed

- Issue #235 정식 릴리스를 위해 애플리케이션 버전을 0.51.1에서 0.52.0으로 갱신한다. 기능 구현은 PR #241의 main 병합 내용을 사용하며 release artifact는 해당 최신 main 검증 후 생성한다.

## [0.51.1] - 2026-09-28

### Changed

- Issue #260: Project Workspace의 일정/리소스 필터 Toolbar를 content-aware responsive grid로 정돈하여 768/1024px에서 불필요한 full-width 적층을 줄이고 390px에서만 필요한 추가 적층을 허용한다.
- Task Advanced Filter를 텍스트, 일정·수치, 유형·할당, 물류 의미 section으로 재구성하고 operator/value·From/To·Min/Max·Resource/Group·물류 checkbox의 폭과 wrapping 규칙을 분리해 긴 label/값에서도 overlap과 document overflow를 방지한다.
- 390/768/1024/1440/1600px E2E에 열린 Advanced Panel, 긴 물류 label, toolbar child 및 input/select bounding-box overlap·bounds 검증을 추가한다.


## [0.51.0] - 2026-09-28

### Added

- Issue #235: 리소스 관리 화면의 상단 여백을 compact하게 조정하고, 내부 Catalog Revision 표시를 제거한다.
- 관리자 비밀번호 변경·새로고침·로그아웃을 하나의 관리 명령 행으로 통합하고, 비밀번호 변경은 접근 가능한 modal dialog로 전환한다. Catalog revision/If-Match/401/412 계약은 유지한다.
- 390/768/1024/1440px에서 관리 명령 정렬·document overflow·header-to-content spacing과 dialog Escape/focus restore를 E2E로 검증한다.

- Issue #245: Project Gantt를 canonical snapshot에서 SVG로 내보내고, 같은 SVG를 브라우저 Canvas에서 PNG로 변환해 다운로드한다. 전체 Project는 WBS Grid와 Chart를, 기간 지정은 지정한 날짜의 Chart만 포함한다.
- 내보내기 진입점에서 기존 Excel과 SVG/PNG를 선택하며, 기간·범위 입력, revision 동시성 검사와 크기 제한을 적용한다. 기존 Excel의 관계 및 물류 구성 보고서 옵션은 유지한다.


## [0.50.0] - 2026-09-27

### Added

- Issue #234: 리소스 관리 검색 및 그룹 구성원 작업 UX 개선.
  - 리소스 / 리소스 그룹 / 그룹 구성원 독립 검색 (`src/features/resources/resource-catalog-admin.tsx`, `resource-search-filter.ts`):
    - 리소스 목록, 리소스 그룹 목록, 그룹 구성원 할당 목록 각각에 실시간 Client-side 검색 바 및 일치 카운트(`일치 n / 전체 N`, 구성원: `일치 n / 전체 N · 선택 M`) 추가.
    - 이름(`name`) 및 코드(`code`) 대소문자 무시 substring 검색 지원 (trim 처리 및 null code 안전 처리).
    - `Escape` 키 입력 시 검색어 즉시 초기화 지원.
    - 데이터 없음(`등록된 리소스가 없습니다.`)과 검색 조건 불일치(`검색 조건과 일치하는 리소스가 없습니다.`) 상태 명확히 분리.
  - 그룹 구성원 선택 상태 보존:
    - 구성원 검색으로 일부 리소스가 필터링되더라도 기존 선택 상태(`selectedMembers`)를 100% 보존.
    - `구성원 저장` 시 필터된 항목만이 아닌 전체 선택 집합을 정확히 전송.
  - 그룹 구성원 푸터 액션 정렬 (`resource-catalog-admin.module.css`):
    - `memberFooterActions` 전용 스타일을 도입하여 데스크톱에서 `닫기`(secondary) 좌측, `구성원 저장`(primary) 우측 정렬로 일관되게 배치.
    - 모바일 뷰포트에서 자연스러운 랩/스택 처리로 오버플로우 방지.

## [0.49.0] - 2026-09-28

### Changed

- Issue #233: Project Gantt 정보 밀도 개선.
  - 초기 Grid 폭을 620px에서 480px로 축소하고 주요 Grid column 폭을 재조정해 Timeline 작업 공간을 확대했다.
  - 기간 column은 canonical working-day duration 의미를 유지하면서 cell 표시를 `N 근무일`에서 숫자 `N`으로 단순화했다.
  - SVAR 공개 `cellWidth` API를 사용해 Day 44px / Week 68px을 적용했다.
  - Day/Week 전환 전 현재 column state를 캡처하고 공개 `set-columns` API로 복원하여 사용자가 resize한 column 폭을 유지한다.
  - Chromium E2E로 480px Grid, 숫자 duration, 44/68 cellWidth 계약과 390/768/1024/1440px document overflow를 검증한다.

## [0.48.0] - 2026-09-28

### Added

- Issue #232: 프로젝트 설정 다이얼로그 정보 구조·탭·반응형 폼 레이아웃 개선.
  - 전용 와이드 모달 및 탭 컴포넌트(`WorkspaceDialog size="wide"`, `ProjectSettingsDialog`, `project-settings-dialog.module.css`):
    - 공통 다이얼로그의 기본 38rem 폭 외에 settings 전용 와이드 뷰(최대 60rem)를 지원하여 데스크톱 가용 공간 활용.
    - WAI-ARIA APG 준수 탭 인터페이스(`role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`) 구현.
    - 키보드 ArrowLeft/ArrowRight 및 Home/End 키를 통한 직관적인 탭 탐색 지원.
    - 탭 전환 시 컴포넌트를 unmount하지 않고 DOM에 유지(`hidden` 속성)하여 작업 중인 캘린더 규칙/미리보기, 비밀번호, 설명 등의 초안(draft) 상태 100% 보존.
  - 3개 카테고리 기반 정보 구조(IA):
    - **기본 정보**: 프로젝트 이름과 상태(compact select)를 2열 그리드로 정렬하고 설명 textarea는 전체 폭으로 배치.
    - **작업 캘린더**: 기존 `ProjectWorkCalendarEditor`를 통합하고 국가 규칙 및 휴무일 입력 항목을 2열 그리드와 우측 정렬 액션 행으로 정돈하여 항목 밀도 개선.
    - **편집·보안**: 새 비밀번호 변경 폼과 세션 안내 카드 및 편집 모드 종료 액션을 독립 분리.
  - 반응형 및 접근성:
    - 390/768px 모바일에서 1열 스택 레이아웃으로 자연스럽게 전환되어 가로 overflow 방지.
    - `Escape` 키 닫기 및 닫힘 후 '프로젝트 설정' 트리거 버튼으로의 포커스 복원 보존.

## [0.47.0] - 2026-09-28

### Added

- Issue #231: 프로젝트 화면 '정보' 및 '더보기' 팝오버 포커스 이탈 시 자동 닫힘 개선.
  - 외부 인터랙션 및 포커스 감지 (`src/features/projects/project-readonly-view.tsx`):
    - `infoPopoverOpen` state 및 `infoPopoverReference` 추가로 상태 제어 일원화.
    - document 레벨의 `pointerdown` 및 `focusin` 이벤트 리스너를 통해, 사용자가 팝오버 외부 영역을 클릭하거나 키보드 Tab 등으로 포커스를 이동했을 때 자동으로 팝오버가 닫히도록 개선.
    - 팝오버 내부 자식 요소(버튼, 링크, 입력창 등)로의 포커스 이동은 유지하여 내부 조작 가능성 보장.
    - 모달 다이얼로그(`dialog, [role="dialog"]`) 조작 시 부수적인 팝오버 닫힘 이벤트 충돌 방지.
  - 상호 배타적 오픈 및 접근성:
    - '정보'와 '더보기'가 동시에 열리지 않도록 상호 배타적 토글 핸들러 적용.
    - 동일 버튼 클릭 시 기존의 열기/닫기(toggle) 동작 보존.
    - `Escape` 키 입력 시 열려 있는 팝오버가 즉시 닫히는 표준 접근성 동작 유지.
  - Review 보완: 외부 클릭, Tab 포커스 이탈, disclosure 상호 배타, 복사 Dialog 예외를 Playwright E2E로 검증.

## [0.46.0] - 2026-09-28

### Added

- Issue #230: 프로젝트 목록 필터 입력 컨트롤 너비 및 날짜 범위 From/To 대칭 정렬 개선.
  - 프로젝트 정보 필터 dropdown은 9.5rem, text input은 14rem의 compact/content-aware 폭을 사용한다.
  - 생성일/최근 변경일의 From/To date input을 동일한 폭으로 대칭 배치하고 단일 날짜 입력도 동일 규칙을 사용한다.
  - 모바일에서 global label 규칙보다 높은 specificity로 column label을 유지하고, 공용 clear button은 CSS Modules의 global class로 정확히 선택한다.
  - #230 전용 Playwright 회귀 테스트로 desktop compact 폭, From/To 대칭, mobile label 방향, clear button 정렬, horizontal overflow를 검증한다.

## [0.45.1] - 2026-09-28

### Fixed

- Issue #229: 프로젝트 목록 화면에서 공통 `.main-content`의 큰 상하 여백을 목록 전용 compact spacing으로 제한해 시스템 헤더와 `WORKSPACE` 본문 사이의 과도한 간격을 축소했다.
- 390/768/1024/1440px 반응형 E2E에 헤더-본문 간격과 문서 수준 가로 overflow 회귀 검증을 추가했다.
- 최신 main `0.45.0` 기준으로 재정렬해 Relation Editor 변경과 함께 검증되도록 했다.

## [0.45.0] - 2026-09-28

### Added

- Issue #203: 관계선 더블클릭 Relation Editor 및 관련 아이템 검색·추가·삭제 구현.
  - 전용 Relation Editor 다이얼로그(`RelationEditorDialog`, `relation-editor-dialog.css`):
    - 관계선(`[data-link-id]`) 더블클릭 및 Relation Context Menu의 "관계 관리... (Relation Editor)" 액션을 통한 접근.
    - 선택된 관계의 선행(Predecessor)/후행(Successor) 작업 상세 및 Anchor(기준 작업) 전환 지원.
    - 관계 유형(`FS`, `SS`, `FF`, `SF`) 및 `Lag` 수정, 선택 관계 즉시 삭제.
    - Anchor 기준 연결된 모든 선행/후행 관계 목록 조회 및 항목별 선택/삭제 액션.
    - 프로젝트 내 Leaf Task 및 Milestone 대상 검색(인라인/자동완성)을 통한 신규 관계 추가 (Summary 및 자기자신, 중복 관계 자동 제외).
  - 순수 도메인 및 검색 헬퍼 모델(`src/features/gantt/relation-editor-model.ts`):
    - `getRelatedLinksForAnchor`, `searchCandidateTasks` 순수 함수 및 단위 테스트 작성.
  - 화면 안정성 및 접근성:
    - 다이얼로그 오픈/조작 중 Gantt 인스턴스, 스크롤 위치, 요약 작업 접힘 상태 완벽 보존.
    - `Escape` 키 닫기 및 다이얼로그 내부 Focus Trap 구현.
    - `ProjectReadonlyView`의 `saveLink` POST 페이로드에 `type` 및 `lag` 옵션 지원.
    - 읽기 전용 상태에 대한 안전한 비활성화 처리.

## [0.44.0] - 2026-09-28

### Added

- Issue #202: Schedule Item Baseline 저장·편집·Grid 표시 기반 지원.
  - SQLite migration `0014_task_baseline.sql`로 Task/Milestone Baseline start/duration/end를 저장한다.
  - 모든 descendant leaf에 Baseline이 있을 때 Summary Baseline을 파생하고 partial Summary는 완전한 Baseline으로 취급하지 않는다.
  - Task Editor에서 현재 일정 복사, Baseline 수정/삭제, Summary 파생 정보 조회를 지원한다.
  - Grid 열 메뉴에서 기준 시작/기준 종료를 선택적으로 표시한다.
  - Project Copy 시 Baseline을 보존한다.
- Chart Baseline Overlay는 Issue #253으로 분리했다. SVAR PRO `baselines` 및 `base_start/base_end/base_duration`에 의존하지 않으며, Core 공개 API 기반 Alignment POC를 통과한 경우에만 Chart 표시를 구현한다.

## [0.43.0] - 2026-09-28

### Added

- Issue #201: 프로젝트 재진입 시 Gantt Grid의 Summary 접힘/펼침(open/collapsed) 상태 복원 구현.
  - 순수 헬퍼 모듈 `src/features/gantt/summary-toggle-preference.ts` 구현:
    - 로컬 스토리지 키 `mastergantt:summary-toggle:<projectPublicId>` 격리.
    - v1 JSON 스키마 `{ version: 1, collapsedSummaryIds: string[] }` 직렬화/역직렬화 및 유효성 검증.
    - stale Summary ID를 현재 Summary 집합으로 필터링하고 로드 시 정규화된 결과를 storage에 다시 기록.
    - QuotaExceededError/SecurityError 등 localStorage 오류는 Gantt 동작을 깨지 않도록 비파괴적으로 처리.
  - `ProjectGantt` 컴포넌트 연동:
    - `projectPublicId` 기준 프로젝트별 상태 저장 및 Gantt API 초기화 후 1회 복원.
    - 마우스/키보드 `open-task` 액션에서 접힘/펼침 상태 실시간 영속화.
    - Fullscreen/필터/canonical snapshot 변경과 충돌하지 않도록 기존 in-memory 상태를 우선 유지.

## [0.42.0] - 2026-09-27

### Added

- Issue #200: 관계 Context Menu에서 관계 종류(FS/SS/FF/SF)·Lag 설정 및 일정 재계산 지원.
  - DB 마이그레이션 `0013_link_types_and_lag.sql`: `links` 테이블의 `type`을 `FS`, `SS`, `FF`, `SF` 허용으로 확장하고, `lag`를 `-10000..10000` 근무일 범위로 완화, `(project_id, predecessor_task_id, successor_task_id)` 유니크 제약 적용.
  - 순수 스케줄링 엔진(`src/domain/scheduling/calendar.ts`, `dependency.ts`):
    - `previousWorkingDay`, `shiftWorkingDate(date, offset, calendar)`, `startFromEnd(end, duration, calendar)` 구현.
    - 4대 의존성 관계(FS: End-to-Start, SS: Start-to-Start, FF: End-to-End, SF: Start-to-End) 및 근무일 단위 Lag(지연/선행) 계산 공식 적용.
    - 다중 선행 의존성 중 가장 강한 제약(strongest lower bound)을 적용하며, 기존 FS/0 결과 100% 회귀 보존.
  - 백엔드 REST API 및 계약:
    - `PATCH /api/projects/{publicId}/links/{linkId}` 신규 라우트 추가: type/lag 수정, no-op 판별, 순수 엔진 일정 재계산, revision atomic 증가, 412/404/409 오류 처리.
    - `CreateLinkRequest`에 `type`, `lag` 필드 지원 추가.
    - `POST /api/projects/{publicId}/links`에서도 FS/SS/FF/SF 및 lag 저장 지원.
    - `src/server/exports/project-excel-export-core.ts`: Excel 내보내기 시 FS/SS/FF/SF 및 lag 검증 허용.
  - 프론트엔드 UI/UX:
    - 관계선 SVG(`[data-link-id]`) 우클릭 시 호출되는 `RelationContextMenu` 신규 구현.
    - 선행·후행 작업명 표시, 관계 종류(FS/SS/FF/SF) 및 Lag(근무일) 선택/입력, 변경사항 없을 시 저장 비활성화, Escape 닫기, 관계 삭제 지원.
    - SVAR React Gantt의 link type (`e2s`, `s2s`, `e2e`, `s2e`) 실시간 시각적 양방향 어댑터 매핑.

## [0.41.0] - 2026-09-27

### Added

- Issue #195: 프로젝트 템플릿 등록·관리 및 템플릿 기반 프로젝트 생성 구현.
  - SQLite 마이그레이션 `0012_project_templates.sql` 추가: `project_templates` 테이블 및 `project_templates_active_idx`, `project_templates_created_at_idx` 인덱스 생성.
  - 템플릿 계약 인터페이스 `src/contracts/project-templates.ts` 정의 (템플릿 DTO, 작업/링크/배정/물류 스냅샷 인터페이스, 요청/응답 타입).
  - 저장소 계층 `ProjectTemplateRepository` 및 도메인 서비스 `ProjectTemplateService` 구현:
    - `createTemplateFromProject`: 기존 프로젝트에서 WBS 계층, FS 링크, 리소스 배정 및 물류 마스터/연결을 근무일 기준 상대 오프셋(`offsetDays`)으로 추출하여 JSON 스냅샷 직렬화 및 템플릿 저장.
    - `listTemplates`, `getTemplate`, `updateTemplate`, `deleteTemplate`, `duplicateTemplate`: 템플릿 검색 및 CRUD, 독립 사본 복제 지원.
    - `instantiateProject`: 지정된 기준 시작일(`projectStartDate`) 및 작업 캘린더에 맞춰 근무일 기반 날짜 재계산, WBS 계층/링크 삽입, 스케줄링 순수 엔진(`recalculateFinishStartDependencies`, `recalculateHierarchy`)을 통한 전체 일정/Summary 자동 재계산, 진척률(0%) 초기화, 리소스 배정 및 물류 마스터/연결 복제, 새 편집 세션 토큰 발급.
    - 원본 프로젝트 삭제 후 템플릿 보존 및 템플릿 삭제 후 생성된 프로젝트 보존(완전한 데이터 독립성 보장).
  - REST API 라우트 및 핸들러 구현:
    - `GET /api/project-templates` (템플릿 목록/검색)
    - `POST /api/project-templates` (프로젝트에서 템플릿 생성, Origin 및 편집 세션 인증)
    - `GET /api/project-templates/[templateId]` (템플릿 상세)
    - `PATCH /api/project-templates/[templateId]` (템플릿 수정, Origin 검증)
    - `DELETE /api/project-templates/[templateId]` (템플릿 삭제, Origin 검증)
    - `POST /api/project-templates/[templateId]/duplicate` (템플릿 복제, Origin 검증)
    - `POST /api/project-templates/[templateId]/instantiate` (템플릿 기반 프로젝트 생성, Rate Limiting 및 `Set-Cookie` 세션 발급)
  - UI 연동:
    - 프로젝트 상세 읽기 전용 뷰("더보기" 메뉴)에 `ProjectSaveAsTemplateButton` 추가: 원클릭 템플릿 저장 대화상자.
    - 프로젝트 생성 페이지(`src/app/projects/new/page.tsx`): `NewProjectTabs` 탭 UI 제공 ("빈 프로젝트 만들기" / "템플릿에서 만들기" 전환 지원).
    - 템플릿 선택 및 생성 폼(`CreateFromTemplateForm`): 등록된 템플릿 검색/선택 카드, 통계 배지(작업, 마일스톤, 물류 공정/설비/시스템 수), 기준 시작일 및 프로젝트 정보 입력 후 생성 지원.

## [0.40.0] - 2026-09-27

### Added

- Issue #189: 프로젝트 복사·삭제·내보내기 연계 및 물류 기능 통합 검증 (물류 LG-06).
  - 프로젝트 복사(Copy) 시 임시 가드(`LogisticsCopyNotSupportedYetError`) 해제 및 전체 물류 마스터(공정 계층 트리, 설비, 시스템, 제어·조율 관계, 리소스 역할, 태스크 물류 연결) 및 리소스 배정 원자적 복제 구현.
  - 새 프로젝트 및 복사 대상 로컬 엔티티에 새로운 독립 UUID v4 public ID 발급, 부모-자식 계층 관계 보존, 글로벌 리소스 ID 동일 참조 유지.
  - 비활성 마스터/리소스 복사 시 `warnings` 수집 및 반환, resetProgress 진척률 0% 초기화 및 WBS Summary 엔진 재계산 지원.
  - 프로젝트 복사 모달 UI(`ProjectCopyButton`)에 복사 대상 물류 항목 카운트(공정·설비·시스템) 및 글로벌 리소스 참조 보존 안내 문구 추가, 복사 경고 토스트 알림 연동.
  - Excel 내보내기에 `includeLogistics` 옵션 추가 및 "Logistics" 보고용 추가 시트 구현:
    - 프로젝트 및 물류 구성 요약 메타데이터(프로젝트명, ID, revision, 산출 기준일, 등록 공정·설비·시스템 수, 총 설비 수량).
    - 공정 마스터(코드, 이름, 상위 공정, 순서, 활성 상태).
    - 설비 마스터 및 제어/역할(코드, 이름, 유형, 단위, 수량, 소속 공정, 제어 시스템 및 역할, 담당자 및 역할, 제조사, 모델, 설명).
    - 물류 시스템 마스터(코드, 이름, 유형, 계층, 관리 범위, 담당 공정, 조율 시스템, 담당자 및 역할, 공급사, 설명).
    - 태스크-물류 연결(WBS, 작업명, 외부 ID, 대상 구분, 대상 코드, 대상 명, self/subtree 연결 범위).
    - Excel formula injection(`=`, `+`, `-`, `@`) 방지 안전 텍스트 처리 및 "전체 프로젝트 무손실 재가져오기(Import) 백업 파일이 아닌 보고용 출력물" 안내 명시.
  - Excel 내보내기 모달 UI(`ProjectExcelExportButton`)에 "물류 구성 보고서 포함" 옵션 체크박스 추가.
  - SQLite foreign key cascade에 의한 프로젝트 삭제 시 종속 물류 데이터 자동 정리 및 타 프로젝트/글로벌 리소스 보존 검증.

## [0.39.0] - 2026-09-27

### Added

- Issue #188: 공정·설비·시스템·담당자 대시보드 및 중복 없는 집계 구현 (물류 LG-05).
  - 순수 계산 엔진 `calculateLogisticsDashboardPure` 구현:
    - 3개 핵심 KPI: 기간 가중 진척률(`Σ(duration * progress) / Σ(duration)`, Summary/Milestone 제외, taskId 중복 없이 정확히 1번 집계), 미완료 지연 일반 작업(`progress < 100 AND end < asOfDate`), 마일스톤 경보(지연: `due < asOfDate`, 임박: `asOfDate <= due <= asOfDate + horizonDays - 1`).
    - 시스템 조율 범위 roll-up(`systemView: 'coordination'`): Coordinator DAG 순회 및 컨트롤러 제어 설비 합집합 roll-up, 중복 태스크는 정확히 1번만 집계.
    - 보조 계획 공수 집계: 일반 Leaf task의 리소스 배정(M/D, M/M), assignmentId별 중복 제거, 공수 미설정 작업 카운트.
    - 데이터 품질 및 구성 진단: 물류 미연결 작업 수 및 %, 주 제어기 미매핑 설비, 주 담당자 미지정 설비, 주 PI 미지정 시스템, 설비 수량 합계.
    - 공정별, 설비별, 시스템별 세부 breakdown 행 계산.
  - 단일 읽기 트랜잭션 기반 일관된 스냅샷 조회 서비스 `LogisticsDashboardService` 구현.
  - REST API `GET /api/projects/:publicId/logistics/dashboard` 핸들러 및 라우트 구현 (Public-read 권한 등록).
  - UI 컴포넌트 `ProjectLogisticsDashboard` 및 CSS Module 구현:
    - 상단 필터 바 (기준일, 임박 일수, 시스템 집계 모드, 활성 마스터만 보기, 수동 새로고침).
    - 4대 핵심 KPI 카드 그리드 (진척률 게이지 바, 지연 작업, 마일스톤 경보, 투입 공수).
    - 데이터 품질/구성 진단 패널.
    - 세부 현황 표 3종(공정별/설비별/시스템별 탭 전환) 및 행별 '일정 필터' drill-down 연동(클릭 시 일정 탭 자동 전환 및 필터 적용).
  - `ProjectLogisticsManagement` 첫 번째 서브탭으로 대시보드(`dashboard`) 통합 (키보드 5개 탭 탐색 지원).
  - 합성 결정적 픽스처 기반 단위 테스트 및 SQLite 단일 트랜잭션 통합 테스트 작성.

## [0.38.0] - 2026-09-27

### Added

- Issue #187: Summary·Task·Milestone의 설비·시스템 연결 및 범위 필터 구현 (물류 LG-04).
  - DB 마이그레이션 `0011_task_logistics_links.sql` 추가 (`task_equipment_links`, `task_system_links` 테이블 정의, `scope IN ('self', 'subtree')`, tasks cascade, equipment/systems NO ACTION deferrable 제약 및 인덱스).
  - 작업별 설비/시스템 연결 조회 및 원자적 교체 REST API 구현 (`GET/PUT /api/projects/:publicId/tasks/:taskId/logistics-links`).
  - Summary 작업의 하위 자손 상속(`subtree`) 지원 및 일반 작업/마일스톤의 `subtree` 지정 차단(`400 INVALID_TASK_LOGISTICS_LINKS`), 비활성 마스터 신규 연결 거부(`409 EQUIPMENT_INACTIVE`, `409 SYSTEM_INACTIVE`).
  - 설비/시스템 영구 삭제 시 연결된 태스크 링크 존재 보호(`409 EQUIPMENT_IN_USE`, `409 SYSTEM_IN_USE`).
  - 작업 정보 대화상자(Task Editor)에 4번째 탭 `물류 연결 (logistics)` 추가: 설비/시스템 다중 선택, Summary subtree opt-in, 상속된 연결 및 출처 Summary 표시, 주 담당자(Owner/PI) 메타데이터 표시, 독립 저장 및 If-Match revision 동시성 제어.
  - 일정(Gantt) 화면 고급 필터에 물류 3개 차원(공정, 설비, 시스템) 범위 필터 추가, effective 상속 매칭, 트리 계층 무결성을 위한 context row 보존 및 일치 카운트 정확성 보장.

## [0.37.0] - 2026-09-27

### Added

- Issue #186: 공정·설비·물류시스템 구성 및 담당자 관리 화면 UI 구현 (물류 LG-03).
  - Project Workspace에 `물류 구성` 탭과 공정/설비/물류시스템/제어·조율 관계 관리 화면을 추가하고 기존 Gantt mount/state를 유지한다.
  - 기존 Resource 카탈로그를 설비 Owner/Contributor와 시스템 PI/Developer 역할에 연결하며 readonly/edit-session, stale revision, 반응형·키보드 접근성 계약을 유지한다.
  - Review 보완으로 최신 LG-02 API 계약(`childSystemIds`, DELETE 영구 삭제)과 정렬하고 mutation 후 logistics snapshot 보존 및 401/403 readonly 강등 회귀를 검증한다.

- Issue #185: 설비 담당자 및 시스템 PI·개발자 역할 배정 스키마 및 REST API 구현 (물류 LG-02).
  - 설비 담당자 배정 테이블(`project_equipment_resource_roles`) 및 시스템 역할 배정 테이블(`project_system_resource_roles`) DDL 및 0010 마이그레이션 (`role IN ('owner', 'contributor')`, `role IN ('pi', 'developer')`, `is_primary` 최대 1개 partial unique index, resources 참조 시 `NO ACTION`으로 삭제 방지).
  - 설비 담당자 및 시스템 역할 배정 REST API 엔드포인트 구현 (`PUT /api/projects/:publicId/logistics/equipment/:equipmentId/resource-roles`, `PUT /api/projects/:publicId/logistics/systems/:systemId/resource-roles`).
  - 비활성 리소스 신규 배정 차단(`409 RESOURCE_INACTIVE`) 및 기존 배정 유지 허용 규칙 구현.
  - 설비·시스템 DTO에 `resourceRoles` 필드 확장 및 스냅샷/뮤테이션 응답 연동.
  - Review 보완으로 DELETE 영구 삭제 계약, 참조 중 삭제 차단, system scope/process mapping 불변식, documented wire property(`parentId`, `childSystemIds`) 및 canonical logistics mutation 응답을 정합화한다.

## [0.36.0] - 2026-09-27

### Added

- Issue #184: 물류 도메인 공정·설비·제어시스템 스키마 및 REST API 기반 구현 (물류 LG-01).
  - 공정(`project_processes`), 설비(`project_equipment`), 제어/조율 시스템(`project_logistics_systems`), 공정-시스템 매핑(`project_system_processes`), 설비-제어시스템 매핑(`project_equipment_systems`), 조율-제어 연계(`project_system_links`) DDL 및 0009 마이그레이션.
  - 공정·설비·시스템 CRUD 및 관계 교체 REST API 13개 엔드포인트 구현 (세션·Origin·If-Match 검증, 프로젝트 revision 1회 증가 원자적 처리).
  - 전체 스냅샷 및 태스크/링크 뮤테이션 응답에 `logistics` aggregate 필드 확장.
  - 물류 구성 데이터가 포함된 프로젝트 복사 요청 시 안전한 차단 가드(`409 LOGISTICS_COPY_NOT_SUPPORTED_YET`) 연동.

## [0.35.0] - 2026-09-27

### Added

- Issue #196: Project Workspace의 일정(Schedule) Toolbar에 `[ 전체 | Task | Milestone ]` 빠른 보기 버튼 그룹을 추가한다.
- 사용자는 고급 필터 패널을 열지 않고도 일반 Task 또는 Milestone만 빠르게 중심 조회할 수 있다.
- 빠른 보기 버튼은 기존 #83의 `TaskFilterState.types`와 동일한 Source of Truth를 공유하며, 검색어/기간/리소스 등 다른 필터 조건을 보존한다.
- 버튼 전환은 client-side view state로 동작하여 API 재조회, Project mutation, revision 증가, Gantt remount 없이 즉시 가시성을 갱신한다.
- 390/768/1024/1440px 뷰포트 및 전체화면 모드에서 레이아웃 겹침이 없으며 keyboard Tab 및 ARIA pressed 상태를 지원한다.

## [0.34.1] - 2026-09-26

### Fixed

- Issue #181: Project List 고급 필터의 프로젝트 정보·날짜 조건을 native disclosure로 재배치해 기본 세로 점유를 줄이고, 활성 조건은 접힌 summary에서도 값과 적용 상태를 확인할 수 있게 한다.
- 1024/1440px에서는 조건 그룹 내부를 2열 compact grid로, 390/768px에서는 1열로 배치하며 기존 Quick Search AND semantics, 상태 기본값과 #177의 상태 즉시 변경, 날짜 오류 처리, 조건 수·초기화·no-result와 Escape focus 복귀 계약을 유지한다.
- Project List E2E에 390×844·768×900·1024×900·1440×900의 disclosure keyboard, geometry, screenshot, document overflow 회귀를 추가한다. 구현 전 baseline 실측·캡처는 별도 증거 확보 전까지 NOT TESTED다.

## [0.34.0] - 2026-09-26

### Added

- Issue #177: Project List의 상태 셀과 편집 중 Project Workspace 제목 영역에서 `예정 / 진행 중 / 완료`를 바로 변경할 수 있다.
- Project List는 최신 canonical revision을 읽고 기존 edit session을 재사용하며, 세션이 없으면 편집 비밀번호 인증 후 status-only PATCH를 수행한다.
- Workspace header status 변경은 기존 Gantt 인스턴스와 작업공간 상태를 유지하면서 canonical mutation response를 적용한다.

### Changed

- Project List의 상태 변경 성공 직후 기존 client-side status filter를 다시 평가하여 완료 전환 등으로 필터에서 제외된 행과 결과 건수를 full reload 없이 즉시 갱신한다.
- List와 Workspace는 공용 status mutation client를 통해 strong `If-Match`, status-only payload, 401/403/412 및 canonical status 계약을 공유한다.
- 하위 호환 사용자 workflow 추가이므로 Semantic Versioning 정책에 따라 `0.33.1`에서 `0.34.0`으로 증가한다.

## [0.33.2] - 2026-09-26

### Fixed

- Issue #171: Gantt native 전체화면에서 우측 상단 알림 버튼의 hit area를 예약해 전체 화면/종료 버튼과 겹치지 않도록 하고, 390/768/1024/1440px에서 두 컨트롤의 비중첩 및 독립 클릭을 E2E로 검증한다.

## [0.33.1] - 2026-09-26

### Fixed

- Issue #157: 운영 Compose를 GHCR/prebuilt image 전용 경로로 분리하고 `pull_policy: always`를 적용해 rolling tag의 stale local image 재사용 가능성을 줄인다.
- local/CI source build는 `deploy/compose.build.yml` override에서만 허용하고 registry pull을 비활성화하여 운영 image pull과 build 경로를 명확히 분리한다.
- exact SemVer/verified digest 우선 배포, rolling tag의 명시적 pull/recreate, 실행 image identity 확인, Compose config 출력의 secret 마스킹 절차와 회귀 검증을 문서화한다.

## [0.33.0] - 2026-09-26

### Fixed

- Issue #142: Summary Task와 Task를 시작일 셀 좌측부터 종료일 셀 우측까지 inclusive 범위로 표시하고, Milestone을 Day/Week scale의 실제 날짜 셀 중앙에 정렬한다. 가로 스크롤과 390/768/1024/1440px 회귀 검증을 추가하고 기존 drag/resize/progress/dependency 및 날짜 저장 계약을 유지한다.


## [0.32.0] - 2026-09-24

### Added

- Issue #140: Grid 작업명 셀의 한 번 클릭 인라인 편집을 추가한다. Summary·Task·Milestone의 이름을 기존 권한·revision 계약으로 저장하고 Enter·blur 저장, Escape 취소 및 입력 오류 복구를 지원한다.

## [0.31.0] - 2026-09-24

### Added

- Issue #138: 프로젝트 상태 예정·진행 중·완료의 저장·편집과 목록 다중 필터를 추가한다. 기존 프로젝트는 진행 중으로 이관하고 신규·복사 프로젝트는 예정으로 시작하며 기본 목록에서 완료를 제외한다.

## [0.30.0] - 2026-09-24

### Added

- Issue #141: masterGantt 파비콘과 프로젝트명에 따른 브라우저 title을 제공하고 비종속 화면·오류·프로젝트 이탈 시 기본 title로 복원한다.

## [0.29.0] - 2026-09-24

### Added

- Issue #136: 공통 헤더 브랜드 옆에 package.json의 빌드 버전을 표시하고 좁은 화면에서는 기존 탐색 공간을 유지한다.

## [0.28.0] - 2026-09-24

### Added

- Issue #155: Gantt 전체 화면 전환과 키보드 단축키를 추가하고, 종료 시 focus 복귀와 Task Editor 열기 전 안전한 전체 화면 종료를 지원한다.

## [0.27.10] - 2026-09-24

### Fixed

- Issue #130 Phase 4: Project 목록·일정·리소스 검색 도구줄의 필터 수·초기화·결과 표현과 좁은 화면 배치를 통일하고 부분 날짜 안내와 focus 복귀를 유지한다.

## [0.27.9] - 2026-09-24

### Fixed

- Issue #130 Phase 3: Task Editor의 정보 위계와 반응형 필드 배치를 정리하고 본문 스크롤 중 header·탭·footer 접근을 유지한다.

## [0.27.8] - 2026-09-24

### Fixed

- Issue #130 Phase 2: Project Context와 일정·리소스 탭의 간격·시각 토큰을 정합화하고 정보·더보기 disclosure의 Escape focus 복귀를 지원한다.

## [0.27.7] - 2026-09-24

### Fixed

- Issue #130 Phase 1: Project 목록의 정보 위계·간격·상태 토큰을 정리하고 기존 표·검색·행 메뉴와 좁은 화면 내부 스크롤 계약을 유지한다.

## [0.27.6] - 2026-09-24

### Fixed

- Issue #121: App Shell에 키보드 본문 바로가기와 focus 가능한 main landmark를 제공하고 기존 dialog focus trap을 유지한다.

## [0.27.5] - 2026-09-24

### Fixed

- Issue #119: 리소스 할당·캘린더 반복 입력과 Project 생성의 필드 오류를 입력에 연결하고, 명시적 제출의 오류 요약과 키보드 focus 이동을 제공한다.

## [0.27.4] - 2026-09-24

### Fixed

- Issue #118: 좁은 화면에서 Project 제목·상태·일정 검색 도구줄을 읽고 조작하기 쉽게 배치하고, 필터 panel의 키보드 닫기와 focus 복귀를 유지한다.

## [0.27.3] - 2026-09-24

### Fixed

- Issue #117: 리소스 공수와 이름·코드 메타데이터의 조회 상태를 분리하고, 부분 실패·마지막 성공 결과·최신 메타데이터 라벨·focus를 보존하는 개별 재시도를 제공한다.

## [0.27.2] - 2026-09-24

### Fixed

- Issue #116: 작업 Context Menu 하위 메뉴를 화면 여유 공간에 따라 좌우 flyout 또는 같은 폭 drilldown으로 배치하고, 작은 화면·짧은 높이에서 키보드 탐색과 명령 접근을 유지한다. 열린 하위 메뉴에서 일반 root 명령으로 focus/pointer가 이동하면 child를 닫아 표시 상태와 `aria-expanded`를 일치시킨다.

## [0.27.1] - 2026-09-24

### Fixed

- Issue #115: 작업 캘린더 입력이나 기준 revision이 바뀌면 이전 미리보기를 무효화하고 재계산을 안내한다. 계산 중·실패·완료 상태를 구분하고 초안과 기존 저장·인증 계약을 유지한다.

## [0.27.0] - 2026-09-24

### Added

- Issue #120: 기존 파란색 업무 UI palette를 유지하면서 surface/text/border/action/focus/status 의미를 명시하는 semantic UI token 계층을 추가한다.
- error/warning/info/success 상태와 focus outline을 공통 token으로 정의하고 실제 Chromium computed style에서 텍스트 대비와 focus 가시성을 측정하는 회귀 검증을 추가한다.

### Changed

- Task Editor, Resource Catalog Admin, Project Row Actions, Workspace Feedback의 selected/focus/disabled/error 상태를 공통 semantic token 또는 문서화된 density 예외로 정합화한다.
- focus indicator는 밝은 surface와 3:1 이상, readonly/subtle badge 일반 텍스트는 4.5:1 이상 대비를 유지하도록 실제 렌더링 조합을 검증한다.
- Issue #99가 0.26.0을 선점한 최신 main에 재통합했으므로, 하위 호환 UI enhancement를 다음 MINOR 버전 0.27.0으로 증가한다.


## [0.26.0] - 2026-09-23

### Added

- Issue #99: 유효한 리소스 관리자 세션에서 관리자 비밀번호를 UI/API로 변경하고 SQLite scrypt 자격증명으로 영속화한다.
- 최초 실행 시 `RESOURCE_CATALOG_ADMIN_PASSWORD`를 seed로 사용하며 DB 자격증명이 생성된 뒤에는 런타임 변경값을 우선한다.

### Changed

- 프로젝트 편집 및 리소스 관리 신규 비밀번호 정책을 복잡도 강제 없이 1~12 Unicode 문자로 통일한다.
- 리소스 관리자 비밀번호 변경 시 기존 관리자 세션을 모두 revoke하고 호출자에게 새 세션을 발급한다.
- 기존 장문 Project 비밀번호는 unlock/삭제 재인증에 계속 사용할 수 있도록 호환성을 유지한다.
- 현재 main `0.25.0` 이후 사용자 기능/API 확장이므로 MINOR 버전 `0.26.0`으로 증가한다.

## [0.25.0] - 2026-09-23

### Added

- Issue #84: Project List에 프로젝트명·소유자·설명 Quick Search와 typed 고급 필터를 추가한다.
- 고급 필터는 프로젝트명/소유자/설명 text operator, 소유자 지정 여부, 생성일/최근 변경일의 browser-timezone 날짜 조건을 지원한다.
- 전체 수/일치 수, 검색 결과 0건 전용 상태, 조건별 삭제·전체 초기화, Escape focus 복귀와 responsive 접근성 계약을 추가한다.

### Changed

- Issue #83의 text normalization/operator primitive를 Task/Project filter가 공유하도록 분리하고 Project 전용 predicate는 독립 adapter로 유지한다.
- 검색은 client-side read-only view state이며 Project API/DB/revision과 기존 Row Action 정렬·mutation 계약을 변경하지 않는다.
- 사용자 기능 확장이므로 현재 main `0.23.1` 및 병행 중인 `0.24.0` 후보와 충돌하지 않도록 다음 MINOR 버전 `0.25.0`을 사용한다.

## [0.23.2] - 2026-09-23

### Fixed

- Issue #108: Excel 내보내기 `Gantt` 시트의 주차 헤더에서 ISO week year와 `W` 접두어를 제거하고 주차 번호만 표시한다.
- 월 헤더의 `YYYY-MM` 형식과 기존 ISO week 계산/그룹 경계는 유지하며, 연말·연초 `W53 → W01` 경계를 회귀 테스트로 고정한다.

### Changed

- API/DB 계약 변경 없이 기존 Excel 표시 형식만 수정하므로 Semantic Versioning 정책에 따라 `0.23.1`에서 PATCH 버전 `0.23.2`로 증가한다.


## [0.23.1] - 2026-09-22

### Fixed

- Issue #104: 프로젝트에 Dependency Link가 존재할 때 관계가 없는 Task의 Context Menu mutation까지 전역 비활성화되던 회귀를 수정한다.
- Context Menu/단축키/Task Editor와 서버 Task·Hierarchy·Subtree Delete 검증을 선택 Task 또는 영향 subtree 기준으로 좁혀, unrelated Link는 그대로 보존하면서 unlinked Task의 편집·이동·삭제를 허용한다.
- 관계 endpoint 자체와 관계가 포함된 영향 subtree는 기존 fail-closed 안전 계약을 유지한다.

### Changed

- 하위 호환 UI/서버 권한 판정 버그 수정이므로 Semantic Versioning 정책에 따라 `0.23.0`에서 PATCH 버전 `0.23.1`로 증가한다.

## [0.23.0] - 2026-09-22

### Added

- Issue #83: Project 일정 화면에 Task 통합 텍스트, effective 일정 기간, type/schedule mode, progress/duration, 할당 여부, 특정 Resource/Group ANY·ALL 검색/필터를 추가한다.
- 일치한 하위 Task를 표시할 때 ancestor Summary를 context row로 유지하고 실제 match count와 분리하며, 숨겨진 Task endpoint를 가진 dependency line은 표시하지 않는다.
- Resource 탭에 이름/code, Resource/Group 종류, 활성 상태, 연결 Task 기간 기반 필터를 추가하고 전체 Project workload 집계와 필터된 표시 행을 명확히 구분한다.

### Changed

- 검색/필터는 Project mutation·revision·DB 저장 없이 page-session view state로 동작하고 일정/리소스 탭별 상태를 유지한다.
- 사용자에게 노출되는 검색/필터 기능 확장이므로 Semantic Versioning 정책에 따라 `0.22.0`에서 `0.23.0`으로 증가한다.

## [0.22.0] - 2026-09-22

### Added

- Issue #97: Gantt의 FS/lag=0 작업 관계 생성·삭제를 보호된 Link API와 SQLite transaction에 연결하고 canonical snapshot으로 동일 SVAR instance를 동기화한다.
- Link 생성·삭제 후 dependency graph를 재계산해 Auto Task와 downstream 일정 및 Summary 파생값을 갱신하며, cycle/self/duplicate/Summary endpoint/Manual conflict를 원자적으로 거부한다.
- `POST /api/projects/{publicId}/links`와 `DELETE /api/projects/{publicId}/links/{linkId}`에 edit session, exact Origin, strong If-Match, Project isolation을 적용한다.

### Changed

- 사용자 기능/API 확장이므로 Semantic Versioning 정책에 따라 `0.21.1`에서 `0.22.0`으로 증가한다.

이 프로젝트의 주요 변경은 Semantic Versioning과 [CI/CD 정책](docs/CI_CD.md)에 따라 기록한다.

## [Unreleased]

## [0.21.1] - 2026-09-22

### Changed

- Issue #96: Task Editor의 작업 정보와 Resource allocation 입력을 content-aware grid로 조정해 넓은 화면에서 불필요한 stretching을 줄인다.
- 작업명은 주 입력 폭으로 제한하고 일정은 날짜/기간/확정 종료일에 맞는 비율, 진행률 slider는 최대 폭, Resource 투입률은 날짜보다 좁은 폭을 사용한다.
- 768px 이하에서는 기존 1열 stack으로 전환하며 Task PATCH, revision, dirty/stale/readonly, Assignment 저장 및 Relation 계약은 변경하지 않는다.
- 기존 기능의 호환 UI 밀도 보완이므로 `0.21.0`에서 PATCH 버전 `0.21.1`로 증가한다.

## [0.21.0] - 2026-09-22

### Added

- Issue #76: Project Workspace에 WAI-ARIA 기반 `일정 / 리소스` peer view 탭을 추가하고 두 panel을 mount 상태로 유지해 탭 전환 중 Gantt instance/state가 불필요하게 초기화되지 않도록 한다.

### Changed

- Global Header를 기존 75rem 제한에서 분리한 full-width App Shell로 변경하고 현재 전역 메뉴에 `aria-current`를 제공한다.
- Project Header를 프로젝트명과 편집 상태 중심의 compact context bar로 재구성하고 Description/Owner/Revision은 Info UI로 이동한다.
- 읽기 전용 편집 비밀번호 form은 상시 노출하지 않고 명시적 `편집 잠금 해제` Dialog에서만 입력하도록 변경한다.
- Resource workload를 Gantt 하단 portal에서 독립적인 full-width Resource View로 이동하고 Summary, M/D·M/M·Refresh toolbar, Group → Resource → Task hierarchy를 정돈한다.
- Issue #87의 `docs/UI_UX_GUIDELINES.md`와 UI/UX Agent 계약을 이번 Workspace 구현에 적용한다.
- 사용자 UI의 하위 호환 기능 확장이므로 Semantic Versioning 정책에 따라 `0.20.2`에서 `0.21.0`으로 증가한다.

## [0.20.2] - 2026-09-22

### Fixed

- Issue #80: Task Editor의 관계 표시가 `window.location.pathname` 파싱과 별도 Project GET에 의존하던 회귀를 수정하고, `ProjectWorkspace`가 이미 보유한 동일 canonical `tasks + links + revision` snapshot을 직접 사용하도록 변경한다.
- Grid 더블클릭, Chart 더블클릭, Context Menu → Edit에서 동일한 선행·후행 관계가 표시되고 Editor open만으로 mutation이 발생하지 않도록 Chromium E2E 회귀를 추가한다. 관계 표시 자체는 별도 Project GET에 의존하지 않는다.
- Readonly/Link 포함 일정에서도 Grid·Chart 더블클릭으로 조회용 Editor를 열 수 있고, 관계의 상대 작업명/externalId/type/lag 및 multiple relation 표시를 유지한다.

### Changed

- `0.20.1`이 Issue #77에서 사용되었으므로 하위 호환 회귀 결함 수정인 Issue #80은 다음 PATCH 버전 `0.20.2`를 사용한다.

## [0.20.1] - 2026-09-22

### Fixed

- Issue #77: Task Context Menu를 열 때 첫 번째 항목인 `Add`에 자동 focus가 지정되어 submenu가 즉시 열리던 회귀를 수정한다.
- 최초 focus는 root menu container에 두고, hover 또는 ArrowDown/ArrowUp/Home/End 등 사용자의 명시적 탐색 이후에만 menuitem과 submenu가 활성화되도록 변경한다.
- Grid와 Chart 모두에서 최초 open, close 후 reopen, pointer hover, keyboard navigation을 Playwright 회귀 테스트로 검증한다.

### Changed

- 하위 호환 UI 결함 수정이므로 Semantic Versioning 정책에 따라 `0.20.0`에서 `0.20.1`로 증가한다.

## [0.20.0] - 2026-09-21

### Changed

- Issue #74: Task Editor를 작업 정보·리소스·관계 3개 탭으로 재구성하고 Header/Tab/Footer는 유지한 채 Body만 스크롤하도록 대형 반응형 modal layout을 적용한다.
- WAI-ARIA tab pattern에 맞춰 Arrow Left/Right, Home/End 키보드 탐색과 focus-visible을 제공하고 360/768/1440px에서 horizontal overflow를 방지한다.
- 리소스 할당은 검색·유형·할당됨 필터, 선택 우선 정렬, Resource/Group badge와 row/divider 구조로 정돈하고 기존 Task PATCH와 Assignment PUT 저장 계약은 분리 유지한다.
- 관계 정보는 wide 화면 2열, narrow 화면 1열로 표시하고 관계/할당 건수를 탭과 섹션에서 확인할 수 있게 한다.
- 하위 호환 사용자 UX 확장이므로 Semantic Versioning 정책에 따라 `0.19.0`에서 `0.20.0`으로 증가한다.

## [0.19.1] - 2026-09-21

### Fixed

- Issue #75 정식 release gate에서 좁은 viewport의 행 작업 버튼을 Playwright가 자동 스크롤한 직후 메뉴를 열면서 지연된 `scroll` 이벤트와 경합하던 E2E 불안정성을 수정한다.
- 반응형 메뉴 검증은 작업 trigger를 먼저 `scrollIntoViewIfNeeded()`로 안정화하고 두 animation frame 뒤에 메뉴를 열어 실제 사용자 흐름인 ‘스크롤 완료 후 클릭’을 검증한다.

### Changed

- `v0.19.0` annotated tag의 release run #18은 candidate build/GHCR write 이전 Chromium E2E에서 실패했으므로 tag를 이동·삭제·재사용하지 않는다.
- 실패한 exact version을 덮어쓰지 않는 릴리스 정책에 따라 후속 PATCH 버전 `0.19.1`로 정식 release를 재진행한다.
## [0.19.0] - 2026-09-21

### Changed

- Issue #75: 프로젝트 목록 페이지를 일반 Form 폭과 분리해 최대 100rem의 wide layout으로 확장하고 Header/Table 좌우 기준선을 맞춘다.
- 프로젝트명을 primary navigation으로 유지하면서 행 작업을 `프로젝트 복사`·`링크 복사`·`삭제`가 포함된 accessible overflow menu로 통합한다.
- Header/Row typography, divider, hover/focus-within, Description 우선 열 배분과 반응형 horizontal scroll을 정리한다.
- 기존 링크 복사 fallback과 프로젝트 삭제 재인증/If-Match/오류 처리 계약은 변경하지 않는다.
- 하위 호환 사용자 UX 확장이므로 Semantic Versioning 정책에 따라 `0.18.0`에서 `0.19.0`으로 증가한다.


## [0.18.0] - 2026-09-21

### Added

- Issue #72: 편집 권한이 있는 Grid/Chart 작업의 우클릭 메뉴를 SVAR Willow 기본 작업 흐름에 맞춰 Add, Convert to, Edit, Cut, Copy, Paste, Move, Indent, Outdent, Delete로 확장한다.
- `POST /api/projects/{publicId}/task-commands`를 추가해 생성 위치 지정, 형식 변환, sibling 재정렬, indent/outdent, cut-paste reparent, subtree copy를 서버 권위의 단일 transaction으로 처리한다.
- Canonical hierarchy 동기화는 SVAR 공개 `move-task` action을 사용해 parent/sibling 변경을 반영하며, 구조 변경 중 불필요한 Gantt recovery remount를 방지한다.
- Ctrl/Cmd+X, Ctrl/Cmd+C, Ctrl/Cmd+V와 Delete/Backspace/Ctrl+D 작업 단축키를 추가한다.

### Changed

- 계층 명령 성공 시 전체 canonical snapshot을 반환하고 Project revision을 정확히 1 증가시키며, 기존 Dependency Link가 있는 일정은 기존 정책대로 계층 mutation을 거부한다.
- subtree copy는 리소스 할당을 조용히 누락하지 않도록 할당이 있는 원본을 `TASK_COPY_ASSIGNMENTS_UNSUPPORTED`로 명시적으로 거부한다.
- 하위 호환 사용자 기능/API 확장이므로 Semantic Versioning 정책에 따라 `0.17.0`에서 `0.18.0`으로 증가한다.


## [0.17.0] - 2026-09-19

### Added

- Issue #68: 작업 캘린더 Preview/저장 경로에 기존 `FS/lag=0` Dependency를 포함하는 서버 권위 forward-pass 재계산을 추가한다.
- `changedTasks`에 `CALENDAR` / `DEPENDENCY` / `SUMMARY` 원인과 실제 lower bound를 만든 선행 작업 External ID를 포함한다.
- Calendar 변경 후 Manual 후행 작업이 FS lower bound를 위반하면 `MANUAL_DEPENDENCY_CONFLICT`로 전체 저장을 거부한다.

### Changed

- Dependency Link 존재만으로 반환하던 `CALENDAR_RECALC_UNSUPPORTED` 제한을 제거하고, cycle은 `DEPENDENCY_CYCLE`, 지원 외 구조는 `UNSUPPORTED_SCHEDULE_STRUCTURE`로 구분한다.
- Calendar rule/date, Auto Task, Summary 파생값과 Project revision은 하나의 SQLite transaction에서 저장하며 revision은 정확히 1 증가한다.
- 하위 호환 일정 기능 확장이므로 Semantic Versioning 정책에 따라 `0.16.1`에서 `0.17.0`으로 증가한다.


## [0.16.1] - 2026-09-18

### Fixed

- Issue #67: Docker Compose가 `.env`의 `RESOURCE_CATALOG_ADMIN_PASSWORD`를 app 컨테이너에 전달하지 않던 결함을 수정한다.
- 관리자 비밀번호 누락 시 Compose config 단계에서 fail-fast하고, CI Docker smoke에서 실제 컨테이너 환경 전달·인증 성공/거부·로그 비노출을 검증한다.

### Changed

- 하위 호환 Docker 배포 결함 수정이므로 Semantic Versioning 정책에 따라 `0.16.0`에서 `0.16.1`로 증가한다.

## [0.16.0] - 2026-09-18

### Added

- Issue #57: 프로젝트별 작업 캘린더 관리 기능을 추가한다. 대한민국을 기본 국가로 하고 중국, 베트남, 필리핀, 태국, 멕시코, 미국의 2026년 국가 공휴일 fixture와 출처/version metadata를 저장소에 고정한다.
- 국가 규칙은 프로젝트 전체 또는 기간 범위로 적용할 수 있으며, 조직·개인·프로젝트 휴무일을 별도 CUSTOM 규칙으로 관리한다.
- Scheduling Domain에 명시적 `NON_WORKING` / `WORKING` 날짜 예외를 추가해 중국·베트남의 보충 근무일처럼 주말을 근무일로 전환하는 규칙을 지원한다.
- `GET /api/work-calendars/countries`, `GET/PUT /api/projects/{publicId}/work-calendar`, `POST /api/projects/{publicId}/work-calendar/preview` API와 Preview UI를 추가한다.
- 리소스 공수 계산은 Project + Resource Group + Resource 휴무일을 합성한 Effective Calendar를 사용한다.

### Changed

- 기존 `project_holidays` 데이터는 migration에서 신규 작업 캘린더 모델로 손실 없이 옮기고 호환 VIEW/trigger를 유지한다.
- 신규 프로젝트에는 생성 시점의 대한민국 `FULL_PROJECT` 국가 규칙을 기본 생성하며, 기존 프로젝트에는 migration만으로 국가 규칙을 자동 추가하지 않는다.
- 작업 생성·수정·삭제 및 하위 작업 삭제 재계산은 신규 Project Calendar를 서버 권위 일정 계산에 사용한다.
- 사용자 기능, API와 DB 계약을 하위 호환으로 확장하므로 Semantic Versioning 정책에 따라 `0.15.0`에서 `0.16.0`으로 증가한다.

## [0.15.0] - 2026-09-18

### Added

- Issue #64: Docker/server stdout에 JSON 한 줄 구조화 logger, 실제 `LOG_LEVEL` 필터, 민감 필드 redaction과 안전한 500 진단을 추가한다.
- 검증된 `X-Request-ID` 또는 서버 UUID를 API lifecycle, 오류 body, 응답 header와 서버 로그에서 동일하게 사용하는 request correlation을 추가한다.
- runtime configuration, DB migration, application startup과 readiness 장애/복구 운영 이벤트 및 Nginx↔Docker 추적 문서를 추가한다.

### Changed

- Issue #61의 리소스 관리자 인증 진단을 공통 logger에 연결하고 주요 Project/Task/Resource/Export API를 동일 request lifecycle 체계에 편입한다.
- 하위 호환 운영 관측성 및 request-correlation 기능 추가이므로 Semantic Versioning 정책에 따라 `0.14.1`에서 `0.15.0`으로 증가한다.


## [0.14.1] - 2026-09-18

### Fixed

- Issue #61: 리소스 편집 관리자 인증 실패 원인을 Docker/server stdout의 구조화 로그에서 구분할 수 있도록 진단 로그를 추가한다.
- 비밀번호 미설정·정책 위반·불일치를 `ADMIN_PASSWORD_NOT_CONFIGURED`, `ADMIN_PASSWORD_POLICY_INVALID`, `ADMIN_PASSWORD_MISMATCH`로 구분하면서 외부 API는 기존 `RESOURCE_ADMIN_AUTH_FAILED` 계약을 유지한다.
- 비밀번호, session token, Cookie/Authorization 및 예외 원문이 로그에 노출되지 않도록 회귀 테스트를 추가하고 `requestId` 기반 추적 절차를 문서화한다.

### Changed

- 하위 호환 운영 진단/보안 수정이므로 Semantic Versioning 정책에 따라 `0.14.0`에서 `0.14.1`로 증가한다.

## [0.14.0] - 2026-09-17

### Added

- Issue #56: 작업별 개별 리소스에 계획 투입 시작일·종료일·투입률을 저장하고 프로젝트 근무일 기준 M/D를 계산한다.
- 프로젝트 화면에 `그룹 → 리소스 → 작업` 계층의 리소스 공수 조회를 추가하고 M/D와 설정된 기준의 M/M 전환, 미설정 공수 및 과투입 표시를 제공한다.
- `GET /api/projects/{publicId}/resource-workload` 집계 API와 SQLite `0005_resource_workload.sql` migration을 추가한다.

### Changed

- `RESOURCE_MD_PER_MM`이 유효한 양수일 때만 M/M 환산을 제공하고, 미설정 시 임의 기준을 사용하지 않는다.
- 하위 호환 사용자 workflow와 API/DB 계약 추가이므로 Semantic Versioning 정책에 따라 `0.13.0`에서 `0.14.0`으로 증가한다.

### Fixed

- 공수 조회 영역이 기존 프로젝트 작업면의 Gantt 폭·스크롤 계약을 변경하지 않도록 portal로 격리하고, E2E 레이아웃 검증 경계를 실제 `.project-schedule`로 맞춘다.


## [0.13.0] - 2026-09-16

### Added

- Issue #28: 프로젝트의 Grid와 Gantt Chart를 계층/WBS, 시작·종료일, 근무일 기간, 진행률과 함께 Excel(.xlsx)로 내보내는 기능을 추가한다.
- 내보내기 실행 때마다 작업 관계 포함/제외/취소를 명시적으로 선택하며, 관계 포함 시 Dependencies 시트와 Gantt 관계 화살표를 생성한다.
- canonical snapshot과 strong If-Match를 사용해 동일 revision의 읽기 전용 데이터를 내보내고, 외부 Excel 서비스나 SVAR PRO export 기능에 프로젝트 데이터를 전송하지 않는다.

### Changed

- 사용자 기능 추가에 따라 Semantic Versioning 정책으로 애플리케이션 버전을 0.12.0에서 0.13.0으로 증가한다.


## [0.12.0] - 2026-09-16

### Added

- Issue #19: 프로젝트에 종속되지 않는 글로벌 리소스와 리소스 그룹을 관리하고, Task/Summary/Milestone에 개별 리소스 또는 그룹을 직접 할당·해제할 수 있다.
- 별도 `resource_catalog_admin` 세션, catalog revision, Project revision 기반 동시성 검증과 SQLite `0003_resource_catalog.sql` migration을 추가한다.
- `/resources` 관리 화면과 Task Editor의 리소스/그룹 다중 할당 UI를 추가한다. SVAR PRO Resource API는 사용하지 않는다.

### Changed

- Assignment PUT 성공 응답을 `project`, `tasks`, `links`, `assignments` 전체 canonical aggregate와 strong Project ETag를 반환하는 계약으로 확정한다.
- 사용자 workflow와 API/DB 계약을 하위 호환으로 확장하므로 Semantic Versioning 정책에 따라 `0.11.1`에서 `0.12.0`으로 증가한다.

## [0.11.1] - 2026-09-15

### Changed

- Issue #51: Gantt `주` 표시의 하위 Chart Header를 날짜 범위에서 ISO 8601 Week(`W01`~`W53`)로 변경했다.
- ISO week 계산을 독립 helper로 분리하고 월 경계 및 `W52/W53 → W01` 연말·연초 경계를 단위 테스트로 검증한다.
- Chromium E2E에서 ISO week Header 표시, 날짜 범위 제거, `일 ↔ 주` 반복 전환 시 Gantt/API 인스턴스 유지와 일 모드 주말 강조 회귀를 검증한다.

## [0.11.0] - 2026-09-15

### Added

- Issue #36: Task Editor의 진행률 입력을 0~100%, 1% 단위 Slider로 변경하고 현재 값을 명시적으로 표시한다.
- Task에 여러 줄 Description과 `http://`/`https://` URL을 저장할 수 있으며, 위험한 URL scheme은 클라이언트와 서버에서 거부한다.
- URL이 저장된 Grid 행/Chart 작업은 일반 클릭으로 새 탭에서 링크를 열며 drag/resize/우클릭 동작과 분리한다.
- SQLite migration `0002_task_description_url.sql`을 추가하고 canonical snapshot, 프로젝트 복사, subtree 삭제 응답까지 신규 필드를 보존한다.

### Fixed

- 기존에 저장된 소수 진행률은 다른 필드만 편집할 때 저장을 막지 않도록 호환성을 유지하고, 사용자가 Slider로 변경하는 값부터 1% 정수 단위를 적용한다.
- 프로젝트 복사 시 Description/URL을 원본 복사 transaction 안에서 함께 저장하여 all-or-nothing 계약을 유지한다.

## [0.10.0] - 2026-09-15

### Added

- Issue #34: Task Editor에 현재 작업의 선행/후행 관계를 조회 전용으로 표시한다. 상대 작업명과 externalId, 관계 유형, lag를 함께 보여주며 Editor 기준 revision과 동일한 canonical snapshot만 채택해 stale 관계 혼합을 차단한다. 사용자 기능 추가에 따라 버전을 `0.10.0`으로 갱신한다.


## [0.9.0] - 2026-09-15

### Added

- Issue #35: Gantt Chart 상단에서 기본 일 단위와 주 단위를 즉시 전환할 수 있다. 전환은 동일 SVAR Gantt 인스턴스를 유지하며 일 보기에서만 기존 주말 강조를 표시한다. 사용자 기능 추가에 따라 버전을 `0.9.0`으로 갱신한다.

## [0.8.3] - 2026-09-15

### Fixed

- Issue #37: 프로젝트 직접 진입뿐 아니라 브라우저 history/BFCache 복원에서도 서버의 현재 편집 세션을 다시 확인한다. 재검증 중 작업공간을 inert 처리하고, 만료·잘못된 응답·조회 실패는 fail-closed로 읽기 전용 재진입시켜 stale edit UI를 폐기한다. 정상 edit 재검증은 기존 Gantt 인스턴스를 유지한다.

## [0.8.2] - 2026-09-15

### Fixed

- Issue #40: Task Editor E2E의 스크롤 불변성 검증이 레이아웃 시점마다 달라질 수 있는 전체 scrollable DOM 목록을 비교하지 않도록 변경했다. `window`, 프로젝트 작업공간, SVAR Grid, Chart의 명시적 컨테이너 위치만 비교하고 실제 스크롤에 따른 메뉴 닫힘 검증은 전용 `task-context-menu-scroll.spec.ts`에 유지하여 동일 head 재실행에서도 안정적으로 회귀를 검출한다.

## [0.8.1] - 2026-09-15

### Fixed

- Issue #33: 운영 상단 주요 메뉴에서 `Gantt 데모` 링크를 제거한다. `/gantt-demo` route와 fixture는 SVAR 통합·timezone/hydration E2E 검증 자산으로 유지하고, 헤더 회귀 테스트는 프로젝트 메뉴와 알림 hit-area 및 데모 링크 미노출을 검증한다.
- 저장이 거부된 drag/resize의 canonical 조회가 성공하면 동일 Gantt 인스턴스에 서버 snapshot을 동기화하고, 조회 실패 시에만 강제 reset하여 검증되지 않은 로컬 변경을 폐기한다. 관련 비동기 E2E는 실제 스크롤 상태와 canonical 일정 복구를 기다려 검증한다.


## [0.8.0] - 2026-09-15

### Added

- Issue #27: 기존 프로젝트의 저장 일정·계층·의존관계·휴일을 독립 프로젝트로 원자 복사하고 새 ID·편집 비밀번호를 발급한다. 목록과 상세 작업공간에서 복사 대화상자에 진입할 수 있으며 선택적으로 진척률을 초기화한다.
- Issue #8: production 내부망 HTTP opt-in, 외부 URL 기반 쿠키 정책, Nginx HTTP 예제 및 production HTTP/HTTPS 브라우저·영속성 CI.
- Issue #31: Grid·Chart 작업 우클릭 메뉴에 보호된 작업 삭제를 추가하고, 자손이 있으면 범위를 확인한 뒤 서버가 저장 계층을 재계산하여 하나의 transaction으로 subtree를 삭제한다. 사용자 기능/API 확장에 따라 버전을 `0.7.0`으로 갱신한다.
- PR #23 후속: 작은 화면의 알림 아이콘·상단 navigation 겹침과 인증 오류 진단 코드 누락을 보완하고 관련 UX 계약·회귀 검증을 정리한다. 원격 결과는 후속 PR에 기록한다.
- 공간을 차지하지 않는 5초 Toast와 최대 50건 오류 알림함·미확인 표시·안전한 내용 복사 (#18).
- 목록과 상세 화면의 공용 프로젝트 링크 복사 및 clipboard 거부/미지원 시 수동 복사 (#21). APP_BASE_URL/publicId 기반 직접 접근과 기존 권한을 유지한다.
- Grid 행/Chart 막대 우클릭 및 키보드로 여는 작업 정보 편집기 (#4). 명시적 PATCH 저장, 근무일 기간, 권한/요약 작업 읽기 전용, 실패 시 초안 보존과 Revision 충돌 재검토를 제공한다. 사용법과 검증 범위는 [Task Editor](docs/TASK_EDITOR.md)를 참조한다.

### Fixed

- 모달 top layer 안에서 안내를 확인할 수 있도록 dialog 내 live region을 제공하고, 전역 status 선택자로 발생하던 W05 E2E strict mode 오류를 수정했다. 관련 [UX 계약·CI 실패 분석·보충 테스트 계획](docs/PROJECT_UX.md)을 참조한다.
- 작업 저장 중 Gantt 재마운트를 제거하고 서버 확정 snapshot을 같은 인스턴스에 반영하도록 개선 (#3). 기존 화면 상태 보존 및 중복 mutation 차단 회귀 검증은 해당 PR 결과로 추적.

### Repository layout

- Vitest/Playwright 설정을 `tests/config/`로 이동하고 명시적 config 선택과 root/외부 cwd 테스트 발견 검증을 추가했다 (#13).
- 배포 파일을 `deploy/`로 이동하고 Compose 프로젝트명 명시, CI/Dependabot 참조와 격리 Compose 재생성·영속성 검증을 추가했다 (#12).

### Changed

- annotated `v*` tag ref를 지정한 수동 실행에서도 기존 Semantic Release 검증과 GHCR digest smoke를 동일하게 수행할 수 있도록 release workflow 실행 경로를 보완했다.
- 프로젝트명 하단의 Revision/시간대/휴일/작업/연결·펼침 설정을 제거하고 설정 기능을 헤더 버튼의 별도 창으로 이동했다 (#9).
- 목록의 삭제 버튼을 항상 표시하되 기존 세션과 무관하게 새로 입력한 비밀번호 확인 후 보호 DELETE/If-Match를 호출한다 (#10).
- Grid 행 +의 첫 하위 추가 시 확인 팝업 없이 기존 명시적 요약 전환 옵션을 전송한다 (#11). 마일스톤/계층·집계 검증은 유지한다.
- Grid Header 우클릭 표시 열 선택으로 전환하고 외부 ID를 기본 숨김 처리. 별도 외부 ID 표시/숨기기 버튼 제거.
- Grid/Chart 상단의 ‘작업 추가 또는 삭제’ 패널과 전용 UI 상태 제거. Native Grid `+`와 서버 Task 삭제 API는 유지.
- 새 작업 생성 시 이름·시작일·기간 입력을 제거하고 `새 작업`·오늘·1일 자동 적용(Milestone은 0일 유지). 과거 Summary 전환 확인은 #11로 대체한다.
- 과거 로컬 검증 보류 기록은 `docs/PENDING_TESTS.md`에 보존한다. 이번 다섯 이슈는 사용자 승인에 따라 GitHub Actions로 검증하며, 최종 head의 실제 결과는 PR #23에서 추적한다.

## [0.6.0] - 2026-09-12

### Added

- 편집 권한을 확인하는 Project 삭제와 전체 목록의 표 형태 UI
- SVAR Grid Header/행 `+` 기반 최상위·하위 작업 추가와 명시적 상위 Summary 전환
- 하위 일정 변경에 따른 조상 Summary 일정·진척 집계
- 외부 ID 표시 선택, 오늘/1일 기본값, 주말 음영, 사용자 locale 날짜 표시

### Changed

- 프로젝트 설정을 접고 프로젝트·Grid·Chart Header를 유지하는 내부 세로 스크롤 작업공간

## [0.5.0] - 2026-09-12

### Added

- D02 승인에 따른 전체 Project 목록 API와 홈 목록 화면; 생성 후 복귀·새로고침 시 저장 목록 표시
- 목록은 공개 summary만 반환하고 기존 프로젝트별 편집 인증 유지

### Changed

- 현재 비공개 플랜에서 main/tag 보호 규칙 미강제 위험을 수용하고 GHCR 자동화를 진행하도록 D05 확정
- 최초 원격 push에서 확인한 PAT `workflow` scope 누락을 배포 선행 조건으로 문서화
- PAT 권한 보완 후 실제 main/`v0.4.0` Actions·private GHCR 게시·digest 실행 검증 완료 기록 추가

## [0.4.0] - 2026-09-12

### Added

- main commit마다 검증을 통과한 GHCR `ci-<full SHA>` 테스트 이미지 게시와 registry digest 재다운로드 검증
- 게시 이미지의 Project/Task HTTP 저장·권한·재시작 persistence 검증

### Changed

- Commit 테스트 이미지와 Semantic Version release 이미지의 태그 공간 분리
- BuildKit SBOM/provenance를 유지하고 GitHub 서명 attestation은 지원 플랜에서 명시적으로 활성화

## [0.3.1] - 2026-09-12

### Changed

- D04 운영 결정을 GHCR private, 최소 `packages: read`, 필수 CI, 보호된 `v*` tag와 지정 release 권한으로 확정
- Pull Request는 유지하되 필수 승인 review 수를 0으로 설정
- 과거 노출 credential의 재사용을 사용자 수용 잔여 위험으로 기록하고 원격 차단 사유를 인증 미구성으로 변경

## [0.3.0] - 2026-09-12

### Added

- Project 화면의 좌측 계층 Task Grid와 우측 동기 Gantt Chart 작업공간
- 빈 일정, 생성 직후 양쪽 표시, Desktop geometry와 narrow 내부 scroll Browser 회귀 검증

### Changed

- Project route가 viewport 폭·높이를 사용하고 Project 설정과 Task 관리를 접이식으로 표시

### Fixed

- 빈 Project에서 Gantt가 렌더링되지 않던 문제와 좁은 화면에서 Gantt min-content가 document 전체를 확장하던 문제

## [0.2.0] - 2026-09-12

### Added

- Project별 root Task/Milestone 생성·수정·삭제와 실제 SVAR pointer persistence
- GitHub Actions application/E2E/container CI
- Semantic version tag 기반 GHCR image publish, SBOM/provenance와 registry digest smoke
- SQLite migration/readiness 및 non-root persistent container 기반

### Security

- Project edit session, optimistic concurrency와 transaction 내부 authorization 재검증
- Workflow 최소 권한, immutable Action SHA와 base image digest 정책

## [0.1.0] - 2026-09-11

### Added

- Next.js, SQLite migration/repository, SVAR Core와 Project 생성·직접 Readonly 기반
- Project edit password/session lifecycle
- Working Calendar와 Leaf/Milestone Scheduling Engine 기반

## [0.90.1] - 2026-10-06

### Fixed

- Issue #454: 물류 설비·시스템 유형 목록의 열 너비·행 밀도·사용 건수 정렬과 편집 dialog action 정렬을 정돈한다. 기존 유형 code·usage·필터·권한·revision 계약을 유지한다.
- 최소824px 표의 이름·코드·상태·사용·작업 열을 명시하고 좁은 화면의 키보드 focus에 필요한 가로 이동을 표 내부에서 처리한다. 짧은 한 줄 fixture는5폭에서47px이며 긴 값은 자연스럽게 줄바꿈한다.
- 수정·비밀번호 dialog의 pending 조작과 초점을 보호하고, 412 뒤 최신 목록 조회 실패/401 원인을 유지하며 열린 수정 초안의 명시 조회 복구를 제공한다.

## [0.90.0] - 2026-10-06

### Added

- Issue #453: 리소스와 리소스 그룹을 독립 탭의 전체 폭 목록으로 구성하고 탭별 검색·상태·스크롤 및 구성원 초안을 보존한다. 생성 dialog와 선택한 리소스의 프로필 명시 저장으로 상시 행 편집기의 밀도를 줄인다.

### Changed

- 기존 관리자 권한·카탈로그 revision·역할/등급·usage 및 구성원 저장 계약을 유지한다. Application version은 `0.90.0`이며 이번 작업 범위는 PR CI 시작까지다.
- 최신 main 0.87.1의 #461/#462 및 Release corrective 변경과 source-map-js 1.2.2 lockfile을 보존하여 후보를 재정렬한다.

## [0.87.1] - 2026-10-06

### Fixed

- Issue #461 corrective: 실패한 v0.86.0 GHCR Release Run #136.1의 static quality에서 발견된 `source-map-js 1.2.1` High 취약 버전을 재사용하지 않는다. 최신 main에 반영된 `source-map-js 1.2.2` 이상을 정적 회귀로 고정한다.
- Release static quality가 audit 등 선행 gate에서 실패해 production build 시작 step이 실행되지 않은 경우, 빈 `started_ms`로 setup metric recorder가 2차 실패하지 않도록 build 시작 output이 존재할 때만 종료 계측을 수행한다.

### Changed

- Application version을 `0.87.0`에서 `0.87.1`로 증가한다. immutable 실패 tag `v0.86.0`은 이동·덮어쓰기·재사용하지 않고 same-Issue corrective PATCH로 검증한다.

## [0.87.0] - 2026-10-06

### Added

- Issue #462: 완료 단계 소속 조회를 유형·검색·기간·리소스·WBS 범위와 조합하고 선택 Grid 열과 공통 Editor 진입을 제공한다. full canonical 소속과 조회 가시성을 구분하며 기존 Gantt 상태를 보존한다.

### Changed

- Application version을 `0.86.0`에서 `0.87.0`으로 증가한다. 선행 #460/#461을 포함하는 순차 구현 PR이며 정식 릴리스는 게시하지 않는다.

## [0.86.0] - 2026-10-06

### Added

- Issue #461: Task/Summary 작업 정보에서 완료 단계의 검색·직접 지정·상속 복귀를 편집하고 Milestone 소속 작업 탭에서 명시 소속 초안을 원자 적용한다. Summary 일정은 파생 읽기 전용으로 유지한다.
- Milestone의 본인 상태와 소속 진척·Ready·선행 차단·수동 이벤트·완료 불일치 진단을 구분하고 명시 완료/재개 및 초안 보호를 적용한다.

### Fixed

- Issue #475 follow-up: Generic Finalizer의 release tag 접근을 단일 process-scoped 인증 계약으로 통일한다. lifecycle mutation checkout은 credential persistence를 끄고 tag `ls-remote`·`fetch`·`push` 및 automatic finalizer의 exact tag evidence 조회가 inherited extraHeader를 reset한 뒤 단일 job-scoped Authorization header를 사용하여 duplicate header와 private-repo unauthenticated read를 함께 방지한다.
- Issue #475: Generic Release Finalizer가 FINAL marker 없는 closed Issue merge를 historical boundary로 오인해 그 이전 pending lifecycle을 숨기던 문제를 수정한다. closed merge는 mutation 대상에서 제외하되 non-actionable ordering barrier로 보존해 same-Issue retry coalesce가 이를 가로지르지 못하게 하고, exact FINAL marker까지 탐색을 계속한다.
- PR #470 review: 새 리소스를 선택했다가 해제하면 남은 역할·투입 초안 때문에 false dirty 상태가 유지되던 문제를 선택된 리소스 기준 canonical 비교로 수정한다.
- PR #470 review: 외부 변경으로 Milestone이 일반 Task로 바뀐 뒤 다시 불러올 때 더 이상 존재하지 않는 `소속 작업` 탭이 활성 상태로 남지 않도록 작업 정보 탭으로 정규화한다.
- PR #470 review: Membership 보유 Project의 Excel 보존 차단 오류에 명시 source와 target의 public Task ID를 포함하여 API의 구조화된 진단 계약을 지킨다.

### Changed

- Application version을 `0.85.1`에서 `0.86.0`으로 증가한다. 최신 main의 #452 release-candidate lifecycle 보완과 선행 #460 Stage Gate 구현을 함께 보존하며 이번 요청에서 정식 릴리스를 게시하지 않는다.

## [0.85.1] - 2026-10-06

### Fixed

- Issue #452: Main CI에서 검증한 non-docs `ci-<SHA>` candidate를 Generic Release Finalizer 판정 전에 삭제하지 않고 lifecycle handoff까지 보존하도록 GHCR 수명주기를 정합화한다.
- `release_required=false` finalize에서만 exact temporary candidate를 fail-closed helper로 정리하고, release-required candidate는 formal exact-digest promotion에 사용하도록 유지한다.
- Generic Finalizer/Resume 및 수동 finalize 경로에 temporary package cleanup을 위한 최소 `packages: write` 권한·job-scoped token과 정적 회귀 검증을 추가한다. 정식 image build/promotion은 계속 `release-image.yml`에만 위임한다.
- PR #469를 최신 `main` 0.85.0 / Issue #460 변경 위로 재정렬해 Milestone Stage Gate 구현과 문서를 보존한다.
- 실패한 immutable `v0.83.4`와 미게시 작업 후보 `0.83.5`는 재사용하지 않고 corrective PATCH `0.85.1`에서 새 Main verified candidate와 정식 GHCR promotion을 다시 수행한다.
- Application version을 `0.85.0`에서 `0.85.1`로 증가한다.

## [0.85.0] - 2026-10-05

### Added

- Issue #460: Task/Summary의 단일 명시 완료 단계 소속과 Summary 상속을 일정 Dependency 및 WBS와 분리하여 저장한다. canonical snapshot에 직접·유효 소속·상속 출처 및 Milestone의 소속 작업 진척·Ready·선행 차단·완료 불일치 진단을 제공한다.
- 작업 기본 필드와 소속의 복합 PATCH 및 여러 소속 변경의 batch command는 기존 edit session·Origin·If-Match 검증 아래 하나의 transaction/revision으로 처리한다. Summary의 파생 일정·진척은 읽기 전용을 유지한다.

### Changed

- Milestone 완료 전환을 서버에서 재검증하고 완료 단계의 명시·유효 소속 및 Dependency 구조 변경에는 먼저 재개하도록 요구한다. 일반 Task 진척과 비구조 편집은 기존 계약을 유지하고 완료 상태를 자동으로 연쇄 변경하지 않는다.
- 신규 Task↔Milestone Dependency 생성을 제한하며 기존 mixed Link의 조회·일정·명시적 편집·삭제 호환성을 보존한다.
- 소속 보존이 아직 지원되지 않는 Import/Copy/Template/Excel 경로는 명시적인 데이터 유실 방지 오류를 반환한다. Import의 기존 고정 성공 응답을 실제 저장으로 표시하지 않는다. 후속 Issue #464에서 완전한 보존을 구현한다.
- Application version을 `0.83.4`에서 `0.85.0`으로 증가한다. 별도 열린 PR #346의 `0.84.0`과 중복을 피하며 이번 요청에서 정식 릴리스를 게시하지 않는다.

## [0.83.4] - 2026-10-05

### Fixed

- Issue #452: 리소스·물류 유형·프로젝트 기준정보 관리자 페이지의 공통 시작점과 인증 presentation을 맞추고 비밀번호 입력의 경계·정렬·오류 연결을 명시한다. 관리자별 세션·API·권한 계약을 유지한다.
- 물류 관리자 세션 만료 후 새 로그인 입력이 mount되기 전에 focus를 시도하던 타이밍을 보정하여 재인증 focus 정책을 실제로 적용한다.
- Secondary button의 전역 외부 margin을 제거하고 toolbar/form/footer/독립 CTA가 간격을 소유하도록 기존 소비자를 이관한다. 링크·KPI·Task Editor의 의도 배치는 유지한다.
- 관련 인증·geometry 회귀와 제품 설계·UX·테스트 계획 문서를 동기화하고 Application version을 `0.83.3`에서 `0.83.4`로 증가한다.

## [0.83.3] - 2026-10-05

### Fixed

- Issue #439: GHCR Release candidate의 실제 container 이름 `mastergantt-release-candidate`를 registry Project/Task API smoke allowlist에 추가하여 v0.83.2 Release Run #131의 deterministic usage 오류를 수정한다.
- Release workflow 호출 인자와 registry smoke allowlist의 container 이름이 다시 어긋나지 않도록 정적 회귀 테스트를 추가한다.
- 실패한 annotated `v0.83.2` tag는 이동·재사용하지 않고 same-Issue corrective PATCH `0.83.3`에서 exact Main verified candidate digest 검증과 GHCR promotion을 다시 수행한다.
- Application version을 `0.83.2`에서 `0.83.3`으로 증가한다.

## [0.83.2] - 2026-10-05

### Changed

- Issue #439: PR/Main/Release의 checkout, Node/npm, Playwright, Next build cache, Docker Buildx/build-push setup 비용을 동일 JSONL/Step Summary 형식으로 계측한다.
- npm download cache는 OS/arch/Node/lockfile key와 exact hit/miss를 기록하고 `npm ci` 및 `node_modules` 비캐시 계약을 유지한다. Playwright browser cache는 baseline 10회 전에는 활성화하지 않는다.
- baseline analyzer를 workflow/event/job/metric별로 분리하고 서로 다른 successful run ID 10개 이상을 Phase 2 진입 기준으로 사용해 matrix shard와 rerun이 표본 수를 부풀리지 않도록 한다.
- cache miss에서도 기존 required quality/E2E/Docker gate를 그대로 실행하고 cache/artifact에 secret, runtime DB, test PASS evidence를 저장하지 않는 안전 계약을 문서·회귀 테스트로 고정한다.
- Application version을 `0.83.1`에서 `0.83.2`로 증가한다.

## [0.83.0] - 2026-10-05

### Added

- Issue #415: Excel 내보내기에 선택적 Resource Effort Summary/Detail을 추가해 역할별·개발자별 계획 M/D·M/M과 assignment grain 상세를 제공한다.
- Resource workload detail에 Calendar/range clipping이 반영된 canonical `effectiveWorkingDays`를 추가한다.

### Changed

- Excel 공수 견적은 #414 workload 서비스와 동일한 Project revision/range/`RESOURCE_MD_PER_MM` 기준을 재사용하며 assignmentId로 중복을 제거하고 여러 Group은 비가산 목록으로 표시한다.
- M/M 기준이 없거나 공수가 미설정된 경우 0으로 환산하지 않고 명시적인 미설정 상태를 유지한다.
- 기존 Gantt/Tasks/Project/Dependencies/Logistics 시트 순서와 Origin/If-Match/formula injection 보호를 유지하고 Application version을 `0.82.0`에서 `0.83.0`으로 증가한다.


## [0.82.0] - 2026-10-05

### Added

- Issue #430: Task/Summary Cut에서 source subtree 내부 Dependency는 허용하고 subtree 경계를 넘는 incoming/outgoing Dependency만 제한하는 boundary-aware 정책을 추가한다.

### Changed

- Context Menu `Cut`, `Ctrl/Cmd+X`, cut clipboard Paste와 server `reparent`가 동일한 Dependency boundary 판정을 사용하며 내부 Link의 ID/endpoints/type/signed lag를 이동 후에도 그대로 보존한다.
- 독립적으로 linked된 Paste anchor의 before/after 배치는 허용하되 linked leaf의 child 전환, Delete/Indent/Outdent/Convert 및 #378/#384 Copy 보호 정책은 유지한다.
- Unit/frontend model/SQLite service/Chromium 회귀와 Requirements/API/Scheduling/Relations/UX/Test Plan 문서를 동기화하고 Application version을 `0.81.0`에서 `0.82.0`으로 증가한다.

## [0.81.0] - 2026-10-05

### Added

- Issue #414: 기존 Resource workload에 PI/개발자/설비 담당/역할 미지정 수행 역할별 M/D·M/M subtotal과 `개발 견적` preset, 수행 역할·개발자 등급 drill-down을 추가한다.
- Resource Task detail에 canonical 진행률·상태/지연·일정과 allocation 기간/투입률, Resource 개발자 등급을 함께 표시한다.

### Changed

- #56의 Calendar/allocation 기반 계획 공수 산식과 assignmentId Grand Total dedup을 유지하면서 `assignment_role`을 분류 축으로만 확장한다. 역할 미지정은 Global Role에서 추정하지 않는다.
- 지연 판정은 #188 물류 대시보드와 동일한 Project timezone 기준 `progress < 100 && end < asOfDate`를 사용하며 progress/status는 계획 공수를 변경하지 않는다.
- Application version을 `0.80.0`에서 `0.81.0`으로 증가한다.

## [0.80.0] - 2026-10-04

### Added

- Issue #413: Task의 개인 Resource assignment에 수행 역할 `PI | DEVELOPER | EQUIPMENT_OWNER`를 저장하고 역할 우선 후보 필터 및 Resource별 역할 선택 UI를 추가한다.
- migration `0021_task_assignment_roles.sql`로 nullable `assignment_role`과 role membership/role-delete DB guard를 추가한다.

### Changed

- assignment target DTO가 Resource Global `roles`를 제공하고 Project assignment 응답/Project Copy/Project Template이 수행 역할을 보존한다.
- 사용 중인 Global Resource Role 제거는 Project/Task usage와 함께 `RESOURCE_ROLE_IN_USE`로 fail-closed한다. 역할 추가는 기존 사용 중 역할을 삭제하지 않는 diff 기반 갱신으로 처리한다.
- 역할 미지정 기존 assignment는 추정 backfill 없이 `NULL`로 유지하며 #56 allocation·Calendar·M/D·M/M 산식은 변경하지 않는다.
- Application version을 `0.79.2`에서 `0.80.0`으로 증가한다.

## [0.79.2] - 2026-10-04

### Fixed

- Issue #426: Resource Catalog의 Resource/Group pane을 정보량에 맞는 content-aware 비율로 재배치하고 중간 폭에서는 조기에 vertical stack하여 역할·등급·행 action 때문에 Resource identity가 collapse하는 회귀를 수정한다.
- Resource row를 Identity / Profile(현재 개발자 등급·Global 역할 요약 및 편집) / Lifecycle·Delete action으로 구분하고, 검색·생성·목록 geometry와 Group 구성원 footer의 `닫기` 좌측 / `구성원 저장` 우측 action hierarchy를 복구한다.
- #288의 개발자 등급 읽기 표시와 #412의 `전역 역할: 없음` 표시·역할 PATCH draft 보존을 유지하면서 390/768/1024/1440/1600px Chromium geometry 회귀와 관리 화면 공통 설계·QA 지침을 추가한다.
- 최신 main의 #418 scoped Header/Row add continuity를 보존하고 Application version을 `0.79.1`에서 `0.79.2`로 증가한다.

## [0.79.1] - 2026-10-04

### Fixed

- Issue #418: Workspace WBS 범위에서 native Grid Header `+`와 Row `+`의 의미를 scope-relative resolver로 통합한다. scoped Header는 active Summary root의 immediate child를, root/descendant Row는 해당 작업의 child를 생성하며 일반 Task first-child Summary 전환과 Milestone 차단을 기존 canonical 서버 계약으로 유지한다.
- canonical Gantt sync 뒤 `filter-tasks`를 같은 직렬 queue에서 적용하고 native add 전후 scroll/focus를 복원해 성공 저장 중 Grid 전체가 순간적으로 비거나 위치가 튀는 중간 상태를 제거한다. active scope와 동일 ProjectGantt/API instance, #412 Resource 역할 모델, #409 Relation Editor 식별자 검색 및 #416 Week Header 표시를 유지한다.
- 실제 SVAR Header/Row control, Milestone disabled semantics, requestAnimationFrame continuity probe와 pure intent Unit 회귀를 추가하고 Application version을 `0.79.0`에서 `0.79.1`로 증가한다.

## [0.79.0] - 2026-10-04

### Added

- Issue #412: Resource에 전역 역할 `PI`, `DEVELOPER`, `EQUIPMENT_OWNER`의 0..N 프로필을 추가하고 Resource Catalog 관리자 화면에서 다중 선택·표시할 수 있다.
- migration `0020_resource_roles.sql`로 Resource↔Role M:N을 저장하며 stable role CHECK, 중복 PK, Resource 삭제 cascade와 role→resource 조회 index를 추가한다.
- Resource Catalog create/update/response에 `roles`를 추가하고 기존 관리자 session·Origin·strong `If-Match`·catalog revision 계약을 유지한다.

### Changed

- 전역 `DEVELOPER` 역할과 `developerGrade`는 독립적으로 유지하며 역할 지정/해제가 등급을 자동 생성·삭제하지 않는다. 기존 #288의 Project System developer 신규 배정 시 등급 규칙은 변경하지 않는다.
- Resource Group 구성원 화면에는 현재 Resource 역할을 참고 정보로 표시하지만 membership, Task assignment, Project Equipment/System role, Calendar를 자동 변경하지 않는다.
- 최신 main의 #409 Relation taskId 검색 회귀 수정을 보존하고 Application version을 `0.78.1`에서 `0.79.0`으로 증가한다.

## [0.78.1] - 2026-10-04

### Fixed

- Issue #409: Context Menu `Copy ID`가 복사하는 canonical `taskId` UUID를 Relation Editor의 관계 추가 검색에서 직접 찾을 수 있도록 작업명·외부 ID·작업 ID 통합 검색을 추가한다.
- Relation Editor 후보/선택 상태에서 `externalId`와 `taskId`를 각각 `외부 ID`, `작업 ID`로 명확히 구분해 표시한다.
- taskId로 후보를 검색해도 Dependency Link 저장은 기존 `predecessorExternalId / successorExternalId` 계약을 유지하며 API/DB/Scheduling schema는 변경하지 않는다.
- 최신 main의 #416 Week Header 근무 가능 일수와 기존 #299/#407/#370 계약을 보존하고 Application version을 `0.78.0`에서 `0.78.1`로 증가한다.

## [0.78.0] - 2026-10-04

### Added

- Issue #416: Gantt Week Header의 기존 ISO `Wxx` 아래에 현재 Project Calendar 기준 실제 근무 가능 일수를 `N일` secondary text로 상시 표시해 여러 주의 capacity를 즉시 비교할 수 있게 한다.

### Changed

- #316의 canonical `workingDays`와 app-owned Week date class/MutationObserver lifecycle을 그대로 재사용하고, 요일별 근무 위치·공휴일명·비근무 사유는 기존 hover/focus Tooltip에서 확인하도록 정보 계층을 유지한다.
- 최신 main의 #299 Chart vertical DnD를 보존하면서 기존 ISO Week formatter, Week `cellWidth=68`, Day/Week 전환, Gantt/API instance, Scheduling/API/DB/revision 계약을 변경하지 않으며 390/768/1024/1440px Header geometry 회귀를 추가한다.
- Application version을 `0.77.0`에서 `0.78.0`으로 증가한다.

## [0.77.0] - 2026-10-04

### Added

- Issue #299: Gantt Chart의 Task/Summary/Milestone bar를 수직 Drag & Drop하여 같은 parent의 visible sibling 앞/뒤로 재정렬할 수 있다.
- vertical gesture는 axis lock 후 기존 수평 일정 이동/resize와 분리되고 protected hierarchy command에 정확히 한 번 저장된다. drop indicator와 긴 프로젝트 edge-scroll을 제공하며 reload와 후속 Task mutation에서도 canonical 순서를 유지한다.

### Changed

- 최신 main의 #300 Grid persistence, #335 linked same-parent reorder, #399/#407 subtree scope·scoped add, #384 selection, #367 timeline, #370 start-date quick-edit 계약을 보존한다.
- SVAR React Gantt 2.7.3 Chart의 X축-only bar drag 경계를 public `drag-task(top)` feedback과 server-authoritative `task-commands` bridge로 보완한다.
- Application version을 `0.76.1`에서 `0.77.0`으로 증가한다.

## [0.76.1] - 2026-10-04

### Fixed

- Issue #407: #399 Workspace 범위 탭에서 scope 여부만으로 모든 native Grid `+`를 차단하던 회귀를 수정해 scoped root/descendant의 유효한 Child Task 추가를 다시 허용한다.
- 행별 add 가능 여부를 subtree/milestone/권한 기준으로 판정하고 Context Menu Child/요약 작업 추가, 일반 Task first-child Summary 전환과 동일 canonical mutation 계약을 유지한다.
- scoped header/root-level add, root sibling/Outdent/Paste/DnD scope 탈출, Milestone child, readonly/mutation lock 및 #399 notification geometry 선제 차단을 유지하면서 #370 Date Picker와 #335 linked same-parent sibling reorder 계약을 보존한다.
- Application version을 `0.76.0`에서 `0.76.1`로 증가한다.

## [0.76.0] - 2026-10-04

### Added

- Issue #370: Project Workspace Grid의 `시작` 셀에서 Task/Milestone 시작일을 single click Date Picker로 빠르게 변경할 수 있다.
- getter-only `projectStart`는 서버 확정 effective `start` 표시를 유지하고, application-owned `input[type=date]` overlay가 선택 날짜를 기존 dependency-aware Task PATCH의 requested start 입력으로 전달한다.
- Summary/readonly/mutation lock 차단, Enter/Space keyboard open, Escape/focus restore, 실패 시 canonical 일정 유지 및 전용 Unit/Chromium E2E를 추가한다.

### Changed

- Grid 다중 선택 흐름에서 start-cell pointer intent를 보존하고 row selection을 먼저 확정한 뒤 현재 `projectStart` cell을 다시 찾아 Date Picker를 연다.
- 최신 main의 #335 linked-subtree sibling reorder, #399 Workspace 범위 탭, #384 다중 선택/복사, #367 timeline 확장, #303 Task status 계약을 보존한다.
- Application version을 `0.75.0`에서 `0.76.0`으로 증가한다.

## [0.75.0] - 2026-10-03

### Added

- Issue #335: Dependency Link가 연결된 Task/Milestone과 linked descendant를 포함한 subtree도 같은 parent 안에서는 Context Menu `Move Up/Down` 및 Grid `before/after`로 sibling order를 변경할 수 있다.

### Changed

- sibling reorder는 Link ID/source/target/type/lag와 requested/effective schedule 및 #303의 Task status/progress를 변경하지 않고 기존 `task-commands` transaction에서 siblingOrder와 revision만 확정한다.
- 다른 parent로 이동하는 Grid DnD/`child`, Indent/Outdent, Cut/Paste, Delete, Convert의 기존 Dependency guard는 유지한다.
- #399 Workspace WBS 범위 탭과 #303 Task status/progress 계약을 보존하고, 기존 Context Menu E2E의 linked Move 기대값을 새 정책으로 갱신하며 Application version을 `0.74.0`에서 `0.75.0`으로 증가한다.

## [0.74.0] - 2026-10-03

### Added

- Issue #303: Task/Milestone에 `not_started / in_progress / completed` 상태를 추가하고 진행률 100%와 완료 상태를 원자적으로 양방향 동기화한다.
- 완료된 Task/Milestone 및 derived progress가 정확히 100%인 Summary의 Grid 작업명에 취소선을 표시한다.

### Changed

- 최신 main의 #258 관계 Task 편집, #368 요청 종료일, #384 다중 Copy, #399 Workspace 범위 탭 계약을 유지한 채 Task status를 canonical API/SQLite snapshot에 포함한다.
- Migration `0019_task_status.sql`은 기존 progress를 기준으로 status를 deterministic backfill한다.
- subtree Copy는 명시적 status를 보존하고 Project Template instantiate 응답도 canonical status를 포함한다.
- Application version을 `0.73.0`에서 `0.74.0`으로 증가한다.


## [0.73.0] - 2026-10-03

### Added

- Issue #399: Project 일정 View에 `전체 프로젝트`와 여러 Summary subtree를 같은 화면에서 전환하는 compact WBS 범위 탭을 추가한다.
- Summary 범위 탭은 중복 생성 없이 재활성화하며 닫기, Arrow/Home/End/Delete keyboard, 한 행 horizontal overflow와 scope별 search/filter state를 지원한다.

### Changed

- #373의 `최상위로 열기` 기본 동작에서 `window.open`/popup blocker 의존을 제거하고 동일 ProjectGantt instance에서 `viewRootTaskId + filter-tasks` 범위만 변경한다.
- milestone/scoped/missing native add는 ProjectGantt의 native click capture 경계에서 canonical row/task를 확인해 SVAR target handler 전에 차단하고 feedback만 발행한다. 정상 add는 기존 SVAR/서버 mutation 경로를 유지해 invalid command의 visibility/focus scroll side effect 자체를 제거한다.
- 기존 `?rootTask=` deep link/reload/direct-entry와 실제 browser tab 간 revision freshness, canonical snapshot/Dependency/hierarchy guard 및 권한·If-Match·revision 계약을 유지한다.
- 최신 main의 #403 Project List column layout, #367 Timeline 동적 확장, #390 Copy ID 및 #364 clipboard compatibility를 보존한다.
- Application version을 `0.72.0`에서 `0.73.0`으로 증가한다.

## [0.72.0] - 2026-10-03

### Added

- Issue #367: Gantt Chart를 오른쪽으로 탐색할 때 공개 `scroll-chart.left`/`resize-chart.width`를 기준으로 남은 timeline 폭을 판정하고, 고정 start/open end의 SVAR public resize path로 미래 날짜 scale을 viewport 기반 chunk로 반복 확장한다.
- 최초 range가 viewport보다 짧으면 Core의 resize expansion과 추가 future buffer를 사용하고, canonical sync/Day·Week 전환 후에도 사용자가 확보한 future end 이상을 복구한다.

### Changed

- Day Header/timeline cell 폭을 44px에서 36px로 줄여 동일 화면에서 더 많은 날짜를 표시하며 Week 68px, 숫자-only Header와 Day/Week Tooltip 계약은 유지한다.
- Timeline 확장은 React `end` prop을 반복 변경하지 않아 Core store re-init을 피하고, Gantt/API instance, scroll/tree/column/filter/selection/fullscreen과 Project Scheduling/API/DB/revision 계약을 보존한다.
- PR CI #1496.1/#1572.1/#1575.1 분석에서 `area`를 수평 날짜 범위로 오해한 구현과 end-prop 기반 재초기화 위험을 제거했다. #1575.1의 #373 scoped filter 회귀 증거를 반영해 public resize expansion으로 설계를 전환한다. PR CI #1579.1/#1584.1/#1587.1에서는 #373 회귀가 해소된 것을 확인했고, SVAR horizontal virtualization에서 특정 Day 날짜나 `W38`이 반드시 DOM에 복귀한다고 가정하던 E2E를 동일 instance의 Day 숫자-only/Week `Wxx` scale 복원과 반대 scale cell 제거 검증으로 바로잡는다.
- 최신 main의 Issue #403 Project List 날짜 열 레이아웃 및 Issue #390 Copy ID 기능을 보존하고 Application version을 `0.71.1`에서 `0.72.0`으로 증가한다.

## [0.71.1] - 2026-10-03

### Fixed

- Issue #403: Project List의 생성/최근 변경 datetime이 인접 열을 침범하지 않도록 percentage 합계 기반 폭 배분을 명시적 `colgroup` column budget으로 전환하고 날짜 metadata의 최소 폭을 확보한다.
- 프로젝트명·사업부·제품·법인/사업장·상태·소유자·설명·날짜·Row Action의 역할을 fixed/flexible column으로 분리하고, 좁은 화면에서는 기존 table-owned horizontal scroll을 유지한다.
- 390/768/1024/1440/1600px에서 긴 metadata, browser locale/timezone 날짜, header/body alignment, sibling cell geometry, document/table overflow를 검증하는 Chromium 회귀를 추가하고 공통 UI/UX·QA 설계 기준을 동기화한다.
- Application version을 `0.71.0`에서 `0.71.1`로 증가한다.

## [0.71.0] - 2026-10-03

### Added

- Issue #390: Grid/Chart 작업 Context Menu에 `Copy ID`를 추가해 Task/Summary/Milestone의 canonical `taskId`를 OS clipboard에 복사한다.

### Changed

- readonly·mutation lock·Dependency 연결 여부와 무관한 조회성 action으로 동작하며 #384의 Task Copy/Paste clipboard·선택 집합과 Project revision을 변경하지 않는다.
- #364의 공통 clipboard compatibility를 재사용하고, modern 권한 거부 또는 자동 복사 최종 실패 시 수동 복사 Dialog를 제공한다.
- CI #1536.1의 E2E URL 정규식 parse 오류를 제거하고 latest main 기준 회귀를 다시 검증한다.
- Application version을 `0.70.2`에서 `0.71.0`으로 증가한다.


## [0.70.2] - 2026-10-03

### Fixed

- Issue #364: Project List/Workspace의 프로젝트 링크 복사가 secure-context Clipboard API에만 의존해 내부망 HTTP에서 자동 복사되지 않던 회귀를 수정한다.
- modern Clipboard API가 없거나 insecure context인 경우 사용자 click activation 안에서 legacy copy 호환 경로를 시도하고, 실제 성공한 경우에만 성공 안내를 표시한다.
- modern Clipboard API가 권한 거부/reject된 경우 legacy로 우회하지 않고 기존 수동 복사 모달을 유지하며, URL/권한/navigation/revision/Gantt 상태 계약은 변경하지 않는다.
- `plain.gantt.test` production HTTP transport에서 real browser legacy copy 경로를 검증해 localhost secure-context/mock만으로 HTTP 회귀가 통과하지 않도록 한다.
- Application version을 `0.70.1`에서 `0.70.2`로 증가한다.

## [0.70.1] - 2026-10-03

### Fixed

- Issue #366: #331에서 이미 수정된 Resource Catalog의 코드 입력·개발자 등급 컨트롤 overlap 해결책을 현재 main 기준 회귀 계약으로 직접 고정한다.
- 허용 최대 길이 64자 코드와 개발자 등급 선택 상태에서 390/768/1024/1440px 실제 input/select geometry, form bounds, document overflow 및 기존 Tab 순서를 Chromium으로 검증한다.
- Resource Catalog runtime CSS/API/DB/auth/session/revision/If-Match 계약은 변경하지 않으며 Application version을 `0.70.0`에서 `0.70.1`로 증가한다.

## [0.70.0] - 2026-10-03

### Added

- Issue #340: Task Editor 리소스 탭을 담당 리소스와 리소스 그룹의 compact section으로 분리하고 1024px 이상에서 Resource 쪽을 더 넓게 사용하는 content-aware 2-pane 레이아웃을 제공한다.
- 리소스/그룹 단일 유형 필터에서는 선택 pane이 전체 폭을 사용하며, 선택 Resource의 투입 시작/종료/투입률은 바로 아래 detail 영역에서 가용 폭을 사용한다.
- pane별 표시/전체 건수와 등록 없음/필터 결과 없음 상태를 구분하고 readonly에서는 현재 Task에 실제로 표시 가능한 할당 대상만 집계한다.
- 390/768/1024/1440px layout·overflow·필터 전환·allocation/Group 분리와 readonly 집계 Chromium 회귀를 추가한다.
- Assignment API, Project/Catalog revision, If-Match, 401/412, dirty/stale 및 canonical snapshot 계약은 변경하지 않는다.
- Application version을 `0.69.0`에서 `0.70.0`으로 증가한다.

## [0.69.0] - 2026-10-03

### Added

- Issue #343: Project List에 사업부, 제품, 법인/사업장을 독립 column으로 표시하고 #289의 canonical Project summary 표시명 계약을 재사용한다.
- 미지정 값은 `미지정`, 비활성 기준정보는 기존 표시명을 유지한 `(비활성)` 의미 텍스트로 표시하며 긴 이름은 한 줄 ellipsis와 `title` 전체값 접근 경로를 제공한다.
- native table semantics, 프로젝트명 primary Link, 상태 변경, 검색/필터, Row Action과 좁은 화면 table 내부 horizontal scroll 계약을 유지하고 관련 Unit/E2E 회귀를 보강한다.
- API/DB/Scheduling/SVAR 계약은 변경하지 않으며 Application version을 `0.68.1`에서 `0.69.0`으로 증가한다.

## [0.68.1] - 2026-10-03

### Fixed

- Issue #339: Task Editor Footer가 전역 `.secondary-button`의 page-level 상단 margin을 상속해 Reload/Cancel만 Save보다 아래로 밀리던 UI 회귀를 수정한다.
- Footer가 spacing을 소유하도록 세 action의 margin, control height, padding, line-height와 box sizing을 동일 geometry로 정규화하고 390/768/1024/1440px Chromium geometry 회귀를 추가한다.
- 390px wrap에서는 Reload 독립 행을 허용하면서 Cancel/Save 정렬과 전체 action 높이를 유지하고, 기존 stale/disabled/saving/readonly 및 Task 저장·revision 계약은 변경하지 않는다.
- Application version을 `0.68.0`에서 `0.68.1`로 증가한다.

## [0.68.0] - 2026-10-02

### Added

- Issue #384: Gantt의 checkbox·Ctrl/Cmd·Shift 다중 선택 집합을 Copy/Paste하고 canonical hierarchy 순서로 여러 root 및 전체 자손을 복제한다.
- 내부 Dependency를 새 Task/Link ID로 재매핑하며 외부 Link 제외, 단일 Cut/Edit/Delete/Move 경계, 기존 일정 재계산·원자성·권한·revision 계약을 유지한다.
- 기존 단일 Copy API와 호환되는 `taskIds` 계약과 selection/filter/clipboard 및 SQLite·Chromium 회귀 검증을 추가한다.

### Fixed

- SVAR가 우클릭 pointer gesture 중 row DOM을 교체해 contextmenu target이 조상으로 재지정되는 경우 pointerdown Task ID로 현재 canonical row를 다시 resolve해 작업 메뉴를 안정적으로 연다.
- 리소스 캘린더 서버 충돌 summary focus를 `setState` 직후 단발성 `requestAnimationFrame`에 의존하지 않고 실제 React commit 이후 effect에서 적용해 CI 부하에서도 접근성 focus 계약을 안정적으로 유지한다.
- PR review 보완으로 selection checkbox의 task shortcut을 Copy/Paste로 제한하고, keyboard Context Menu 종료 시 실제 checkbox trigger로 focus를 복원한다.
- Application version을 `0.67.2`에서 `0.68.0`으로 증가한다.

## [0.67.2] - 2026-10-02

### Changed

- Issue #332: 프로젝트 기준정보 관리자에서 인증, 범주, 항목 추가, 목록 영역을 compact flat surface와 divider로 명확히 구분한다.
- 사업부/제품/사업장·법인 목록에 semantic column header와 상태/사용 표시를 추가하고, `전체 / 활성 / 비활성` client-side 상태 필터 및 필터별 empty state를 제공한다.
- 상태 필터는 category 전환 뒤에도 유지하며 필터 조작만으로 catalog mutation/revision 변경을 발생시키지 않는다.
- 390/768/1024/1440px에서 document overflow 없이 좁은 화면의 표만 내부 수평 스크롤되도록 Chromium 회귀를 추가한다.
- Project Master 인증/session/Origin/If-Match/CRUD 의미는 변경하지 않는다.
- Application version을 `0.67.1`에서 `0.67.2`로 증가한다.

## [0.67.1] - 2026-10-02

### Fixed

- Issue #331 release recovery: immutable `v0.65.1`의 Release quality가 동일 #373 cross-tab loading race로 두 번 실패한 경우 기존 tag를 이동·덮어쓰지 않고, later same-Issue corrective merge의 Green main CI와 동일/강한 validation scope로 lifecycle을 승계할 수 있도록 Generic Release Finalizer를 보강한다.
- Formal release 상태를 tag 없음/미실행/진행 중/성공/실패로 판별하고, 진행 중 release는 중복 mutation 없이 DEFERRED하며, completed non-success release만 corrective supersession 후보로 취급한다.
- Cross-tab durable revision announcement는 listener 설치 후 localStorage를 병합하고 authoritative GET이 전진하지 않는 stale durable target은 폐기해 초기 loading race와 영구 stale revision 반복을 함께 방지한다.
- Application version을 `0.67.0`에서 `0.67.1`로 증가한다.

## [0.67.0] - 2026-10-02

### Added

- Issue #385: Project Workspace의 `더보기 → 가져오기 (JSON)`에서 문서화된 JSON 파일을 선택해 server-side Preview 후 Commit할 수 있는 JSON Import 진입점을 추가한다.
- `POST /api/projects/{publicId}/imports/preview`와 `POST /api/projects/{publicId}/imports` 경로를 기존 Import handler에 연결하고 preview는 edit session 기반 non-mutating, commit은 strong `If-Match` 기반 mutation 보안 inventory에 등록한다.
- 외부 작업자·시스템·LLM이 참조할 수 있도록 `docs/JSON_IMPORT.md`와 `docs/schemas/project-import.schema.json`을 추가한다.

### Changed

- JSON Import 진입점은 Workspace의 compact action menu에 배치하고 다른 Project mutation/Task Editor/Relation Editor가 진행 중이면 시작을 차단한다.
- initial loading 중 cross-tab revision event를 놓친 경우에도 저장된 최고 revision을 seed하여 canonical snapshot이 최신 revision으로 수렴하도록 보강한다.
- Application version을 `0.66.0`에서 `0.67.0`으로 증가한다.

## [0.66.0] - 2026-10-02

### Added

- Issue #329: Resource Catalog 관리자 화면에서 어떤 Project에도 참조되지 않은 Resource와 Resource Group을 명시적 확인 후 영구 삭제할 수 있다.
- Resource 사용 여부는 Task assignment, 설비 owner/contributor, 시스템 PI/developer, Resource Calendar를 통합하고 Group은 Task assignment와 Resource Group Calendar를 통합해 distinct Project 수로 판정한다.
- `DELETE /api/resources/{resourceId}`와 `DELETE /api/resource-groups/{groupId}`를 추가하고 관리자 session, exact Origin, strong catalog `If-Match`, transaction 내 usage 재검증 및 catalog revision +1 계약을 적용한다.

### Changed

- Resource Catalog 응답에 `projectUsageCount`와 `deletable` UX 힌트를 추가하고, 사용 중 항목은 삭제 불가 사유를 표시한다. 실제 DELETE는 UI 상태를 신뢰하지 않고 서버에서 다시 fail-closed 검증한다.
- 안전한 삭제 시 Resource/Group membership만 함께 정리하며 반대편 Catalog entity는 보존한다. 기존 FK `RESTRICT/NO ACTION`은 최종 무결성 방어선으로 유지한다.
- Application version을 `0.65.1`에서 `0.66.0`으로 증가한다.


## [0.65.1] - 2026-10-02

### Fixed

- Issue #331: 리소스 관리의 신규 리소스/리소스 그룹 생성 폼을 실제 field 수에 맞는 별도 responsive Grid로 분리하고 shrink 가능한 track과 control containment를 적용해 코드·개발자 등급·추가 버튼이 중간 viewport에서 겹치지 않도록 수정한다.
- 390/768/1024/1440px에서 두 생성 폼의 direct control overlap/form bounds/document overflow와 신규 리소스 폼 Tab 순서·개발자 등급 옵션을 Chromium으로 검증한다.
- Grid reorder 직후 첫 inline rename 클릭에서 DOM editability와 실제 SVAR event guard ref가 다른 render 시점을 가리키지 않도록 해당 ref와 project revision/session invalidation을 layout phase에서 동기화한다. 최신 main의 강화된 reorder helper는 그대로 보존한다.
- Resource Catalog API, 관리자 session/revision/If-Match, Scheduling/DB 및 SVAR dependency 계약은 변경하지 않는다.
- Application version을 `0.65.0`에서 `0.65.1`로 증가한다.

## [0.65.0] - 2026-10-02

### Added

- Issue #316: Gantt Week Header hover/focus Tooltip에서 Project Calendar 기준 실제 근무일 수와 명명된 NON_WORKING 공휴일을 표시한다.
- Issue #315의 검증된 scale CSS class/date parser 및 viewport-safe Tooltip lifecycle을 Week scale에 재사용하고 SVAR Sunday Week anchor를 ISO Monday로 정규화한다.
- WORKING weekend override와 이름 없는 NON_WORKING을 canonical 근무일 계산에 반영하면서 기존 ISO `Wxx`, Week 68px, Day/Week 전환 및 Gantt/API instance 계약을 유지한다.
- Application version을 `0.64.0`에서 `0.65.0`으로 증가한다.

## [0.64.0] - 2026-10-02

### Added

- Issue #377: Task Editor 관계 탭에서 기존 선행/후행 관계를 직접 편집·삭제하고, 관계가 없는 Task/Milestone도 현재 작업을 Anchor로 Relation Editor를 열어 새 선행/후행 관계를 추가할 수 있다.
- 기존 Relation Editor의 linkId 진입에 task Anchor 진입을 추가하며 FS/SS/FF/SF, signed Lag/Lead, 후보 검색과 기존 Link POST/PATCH/DELETE·Scheduling 계약을 그대로 재사용한다.

### Changed

- Task draft dirty/stale/readonly/pending 및 Summary에서는 relation mutation을 fail-closed하고, 성공한 relation mutation은 열린 Task Editor의 base/draft/revision을 imperative canonical sync로 갱신하여 Relation Editor가 topmost modal을 유지한다.
- Task Editor 관계 행의 직접 삭제 confirmation은 keyboard focus를 취소 버튼으로 이동시키고 취소 시 원래 삭제 trigger로 복원한다.
- 390/768/1024/1440px relation action layout, 기존 관계 PATCH→DELETE, zero-link Anchor POST, modal top-layer 및 focus 회귀 E2E를 보강한다.
- Application version을 `0.63.2`에서 `0.64.0`으로 증가한다.

## [0.63.2] - 2026-10-02

### Fixed

- Issue #372: Gantt native fullscreen에서 Grid/Chart 작업을 더블클릭하거나 Context Menu → Edit으로 Task Editor를 열 때 애플리케이션이 `document.exitFullscreen()`을 강제 호출하던 동작을 제거한다.
- Task Editor의 저장·취소·닫기와 Relation Editor의 open/close가 동일 fullscreen/Gantt instance를 유지하고, 기존 scroll·tree·column·scale·selection/filter 및 focus 복원 계약을 보존한다.
- fullscreen Editor 회귀 E2E에서 Grid/Chart 진입 경로, readonly, Relation Editor, shortcut guard와 강제 `exitFullscreen()` 호출 0회를 검증한다. Relation Link fixture는 endpoint 날짜를 가시 구간으로 정렬해 off-viewport locator timeout을 방지한다.
- Application version을 `0.63.1`에서 `0.63.2`로 증가한다.

## [0.63.1] - 2026-10-02

### Changed

- Issue #375: Gantt Chart의 일정 있는 Summary Task는 SVAR root bar의 interaction/x·width geometry를 유지하면서 visual body와 progress만 일반 Task 높이의 60%로 줄여 행 중앙에 표시한다.
- Summary의 hover/selected/focus/critical 상태는 얇은 visual body에 유지하고, 투명해진 상·하 root 영역도 기존 click/double-click/right-click/drag hit area로 남긴다. 일반 Task·Milestone 및 일정 없는 Summary의 기존 표현은 변경하지 않는다.
- 390/768/1024/1440/1600px, Day/Week, fullscreen, readonly와 Empty Summary를 포함하는 Chromium geometry/interaction 회귀 검증을 추가하고 Application version을 `0.63.0`에서 `0.63.1`로 증가한다.

## [0.63.0] - 2026-10-01

### Added

- Issue #373: 하위 작업이 있는 Summary의 Grid/Chart Context Menu에 `최상위로 열기`를 추가하고, 선택 Summary를 가상 root로 삼아 해당 Summary와 모든 자손만 새 브라우저 탭에서 표시하는 WBS scoped view를 지원한다.
- scoped view는 `?rootTask=<taskId>` deep link와 기존 SVAR `filter-tasks` 경로를 사용하며, 전체 Project canonical snapshot·Dependency·Resource/Logistics 연결·edit session·Origin·If-Match·revision 계약을 유지한다.
- scoped tab의 편집으로 revision이 증가하면 동일 origin의 다른 Project tab에 revision 신호를 전달해 최신 canonical snapshot을 재조회하되 기존 Gantt instance와 사용자 view state를 불필요하게 remount하지 않는다.
- 삭제되거나 Summary가 아니게 된 root는 전체 Project로 조용히 fallback하지 않고 scope 오류와 복귀 경로를 표시하며, 자식이 모두 제거된 빈 Summary는 유효한 scoped root로 유지한다.
- PR review 보완으로 scoped root 밖 hierarchy mutation을 Context Menu/shortcut/native add 및 DnD provisional 단계에서 차단하고, hidden ancestor의 물류 subtree 상속 및 initial loading/in-flight refresh 중 연속 cross-tab revision N→N+1 동기화를 보존한다.
- Application version을 `0.62.0`에서 `0.63.0`으로 증가한다.

## [0.62.0] - 2026-10-01

### Added

- Issue #378: Task/Summary subtree Copy 시 복사 집합 내부에서 predecessor와 successor가 모두 포함된 Dependency Link만 새 Task ID로 재매핑해 함께 복제한다.
- 복제 Link는 새 public ID를 사용하고 FS/SS/FF/SF 및 signed lag/lead를 보존하며, 외부→내부·내부→외부 경계 Link는 기본적으로 복제하지 않는다.
- copied leaf는 원본 requestedStart/duration/scheduleMode를 보존한 뒤 현재 Project Calendar와 전체 Dependency engine으로 effective schedule을 재계산하고 Summary 파생값을 같은 transaction에서 갱신한다.
- linked Task의 Copy와 copy-clipboard Paste(before/after)는 허용하되 Cut/reparent/Indent/Outdent/Delete/Convert와 linked leaf를 Summary로 바꾸는 child Paste 보호는 유지한다.
- Unit/SQLite service/Chromium 회귀 검증을 보강하고 Application version을 `0.61.0`에서 `0.62.0`으로 증가한다.

## [0.61.0] - 2026-10-01

### Added

- Issue #368: Task Editor의 일반 Task 일정 입력에 `요청 종료일`을 추가하고, Project Effective Calendar의 양 끝 포함 근무일 규칙으로 기간↔요청 종료일을 양방향 계산한다.
- 마지막으로 직접 수정한 기간 또는 요청 종료일을 기준으로 요청 시작일 변경 시 반대 값을 재계산하며, 공휴일/NON_WORKING/WORKING 예외와 Auto 비근무 시작일 보정을 동일 Scheduling Domain 함수로 적용한다.
- 요청 종료일은 UI-only draft로 유지해 Task PATCH와 DB의 canonical `requestedStart + duration` 계약을 변경하지 않고, 서버 확정 시작/종료일과 Dependency 재계산 결과를 별도 정보로 표시한다.
- 필드별 오류 연결과 390/768/1024/1440px 반응형 계약을 유지하고, 단위/E2E 회귀 검증을 추가한다.
- Application version을 `0.60.1`에서 `0.61.0`으로 증가한다.

## [0.60.1] - 2026-10-01

### Fixed

- Issue #363: 빈 프로젝트 생성 폼을 기본 정보 / 프로젝트 분류 / 설명 / 편집 권한의 semantic section으로 재구성해 관련 없는 필드가 grid 잔여 공간 때문에 인접해 보이던 문제를 수정한다.
- 사업부·제품·사업장/법인 기준정보 group을 full-width responsive 영역으로 분리하고 프로젝트 이름·소유자·상태·설명·편집 비밀번호에 content-aware 폭을 적용한다.
- 320/390/768/1024/1440/1600px geometry 회귀 검증에 긴 기준정보 label과 semantic group 순서/폭/overflow 검사를 추가한다.
- 기존 Project 생성 API/DB/validation, #282 wide page, #289 기준정보 저장, tab/draft/accessibility 계약은 유지한다.
- Generic Release Finalizer가 동일 PR head SHA의 이전 실패/cancelled required check를 최신 성공 check보다 나중에 순회해 `NOT TESTED`로 오판하던 문제를 수정하고, required check 이름별 최신 check-run ID만 판정하도록 한다.
- Application version을 `0.60.0`에서 `0.60.1`로 증가한다.

## [0.60.0] - 2026-10-01

### Added

- Issue #315: Gantt Day Header hover/focus Tooltip에서 locale 요일과 Effective Project Calendar의 명명된 NON_WORKING 휴일명을 표시한다.
- 동일 날짜의 복수 Project-level 휴일명은 canonical snapshot의 optional `exceptions[].names` projection으로 중복 없이 deterministic하게 제공한다.
- SVAR 공개 `scales[].css(date)`로 masterGantt-owned 날짜 class를 부여하고, viewport-safe `role="tooltip"` overlay를 연결한다. WORKING override와 일반 weekend에는 별도 휴일명을 추가하지 않는다.

## [0.59.0] - 2026-10-01

### Added

- Issue #345: Summary를 WBS 컨테이너로 정의해 자식이 없는 Summary의 직접 생성과 마지막 자식 삭제·이동 이후 유형·ID 유지를 지원한다.
- 일정 있는 Task/Milestone 자손이 없는 Summary의 날짜·기간·진척을 `null`로 표현하고 저장·집계·Grid/Chart·Import/Export·복사/템플릿 경로를 정합화한다. 일반 Task/Milestone의 필수 일정과 보안·revision 계약은 유지한다.
- Import는 schema 1.0 순수 검증기·null 계약·VBA 예제까지만 추가하며 신규 preview/commit 화면/API는 #30 후속 범위다.

### Changed

- Issue #361: PR CI, Main CI, Issue Lifecycle, Generic Release Finalizer, GHCR Release 실행 인스턴스 이름에 Primary Issue/PR/run attempt 추적 정보를 연결하고 PR branch/body/title의 Primary Issue 일치를 초기 CI gate에서 검증한다.
- Lifecycle가 정식 release workflow를 dispatch할 때 Issue/PR trace input을 함께 전달하되 required check 이름, release 권한·승인·digest gate와 application version은 변경하지 않는다.
- PR title/body 변경 시 `edited` 이벤트로 trace gate를 재실행하고, 제목에는 Primary Issue 하나만 허용한다. Dependabot 자동 PR은 작성자·동일 저장소·`dependabot/` branch를 모두 확인한 제한적 예외로 처리한다.

- CI 실행 제목에 PR 제목을 포함해 `Issue #345`와 같은 관련 Issue 번호를 Actions 실행 목록에서 확인할 수 있게 한다. Workflow `CI`와 required check 이름·권한·실행 gate는 유지한다.
- PR CI #1376의 production dependency audit 대응으로 `next`와 `@next/env`를 16.3.8로 갱신한다.
- 빈 Summary의 canonical 날짜를 표시하는 Grid getter가 특정 render의 Task map을 캡처하지 않고 최신 canonical ref를 읽도록 변경해, 실패 복구에서도 마지막 확정 일정이 유지되게 한다.
- migration CLI 회귀 기대값에 `0018_empty_summary_schedule.sql`과 migration ledger 18건을 반영한다.\n- CI #1381에서 확인된 빈 Summary Outdent 후 잔존 bar 회귀를 보완하기 위해 latest-ref Grid getter는 유지하고 `tasksById` 기반 column refresh trigger를 복원한다.
- Application version을 `0.58.6`에서 `0.59.0`으로 증가한다.

## [0.58.6] - 2026-10-01

### Fixed

- Issue #344 후속: 실패한 main CI 이후 같은 Issue의 corrective merge는 docs-only/non-docs 검증 scope가 동일할 때만 Generic Release Finalizer가 수렴하도록 하고, scope가 다르면 앞선 실패 merge를 우회하지 않는다.
- coalesce된 모든 PR identity를 보존해 formal release 성공 후 각 branch를 공통 safe cleanup으로 검증·삭제하며, 하나라도 cleanup이 완료되지 않으면 FINAL marker와 Issue close를 금지한다.
- 프로젝트 정보/더보기 disclosure는 native Dialog open과 충돌하는 blur 기반 닫기를 제거하고, keyboard Tab 이후 실제 focus가 disclosure 밖으로 이동한 경우에만 닫도록 보완한다.
- Grid DnD/구조 이동 직후 inline rename 회귀 테스트는 frontend canonical mutation lock 해제를 확인한 뒤 편집을 시작해 서버 응답과 UI 동기화 완료 사이의 race를 제거한다.
- 최신 main의 Next.js 16.3.7 보안 패치와 CI 최적화를 그대로 유지하며 이전 16.3.6 의존성 상태로 되돌리지 않는다.
- Application version을 `0.58.5`에서 `0.58.6`으로 증가한다.

## [0.58.5] - 2026-10-01

### Changed

- Issue #356: 일반 PR의 Docker baseline image 비교를 standalone/image 구조 변경에만 실행하고, HTTP/HTTPS transport smoke를 deploy/security/http/auth 관련 변경에만 선택 실행하여 필수 candidate/runtime smoke를 유지하면서 불필요한 이중 build·browser setup을 줄인다.
- main push와 수동 CI에서는 transport smoke를 항상 유지하며 required aggregate check와 fail-closed routing 계약은 변경하지 않는다.
- 완료된 Issue #118 고정 before/after 레이아웃 evidence workflow를 manual-only historical evidence로 전환하고 workflow contract·원격 검증 문서를 동기화한다.
- 프로젝트 인증·세션 handler(`src/server/projects/**`) 변경도 PR transport smoke 대상에 포함해 API route 밖 구현 변경이 HTTP/HTTPS 검증을 우회하지 못하도록 한다.
- CI #1368에서 감지된 Next.js `next/og ImageResponse` critical advisory 대응으로 `next`와 `@next/env`를 16.3.7로 갱신하고 lockfile을 동기화한다.
- fresh Chromium이 격리 hosts/Nginx 설정 직후 일시적으로 `chrome-error://chromewebdata/`로 전환하는 경우 readiness 확인 뒤 최초 GET navigation만 1회 재시도하며, mutation은 재시도하지 않는다.
- GitHub-hosted runner의 Playwright OS dependency 설치가 Ubuntu mirror 지연으로 길어질 수 있어 E2E shard timeout을 15분에서 20분으로 조정하되 4-way shard와 `workers: 1` 격리 계약은 유지한다.
- CI #1369에서 드러난 `@next/env` 고정 버전 회귀 테스트를 Next.js와 동일 exact version을 요구하는 계약으로 변경해 보안 patch 갱신 시 stale 숫자 기대값으로 실패하지 않도록 한다.
- CI #1372에서 SemVer 회귀 테스트의 과도한 escape를 수정하고, shard 2가 74개 테스트를 모두 PASS한 뒤 cleanup 직전에 20분 timeout으로 취소된 실행을 근거로 E2E shard timeout을 25분으로 조정한다.
- Application version을 `0.58.4`에서 `0.58.5`로 증가한다.

## [0.58.4] - 2026-09-30

### Fixed

- Issue #344: 정상 삭제 성공 후 `EMPTY_SUMMARY_NOT_ALLOWED` 응답만으로 작업이 부활하는 원증상은 최신 main에서 재현되지 않았으며, 실패 복구 GET이 오래된 snapshot을 반환하는 경로에서 이전 삭제 결과를 덮어쓰는 문제를 재현하고 수정한다.
- canonical revision guard와 `no-store` 조회, 최신 snapshot 기반 in-place 복구를 적용해 오래된 응답 또는 복구 GET 실패 이후에도 성공한 삭제 결과를 보존하며, 마지막 자식 삭제를 거부하는 도메인 정책은 유지한다.
- 삭제 이후 남은 형제 작업의 상대 순서를 비교해 불필요한 이동 명령을 방지하고 Summary 접힘 상태를 보존한다. 복구 실패·오래된 응답·readonly 전환과 실제 포인터 편집 회귀 검증을 추가한다.
- Application version을 `0.58.3`에서 `0.58.4`로 증가한다.

## [0.58.3] - 2026-09-30

### Fixed

- Issue #330: 물류 유형 관리 화면의 설비/시스템 전환 버튼 정렬과 유형 추가 폼의 정렬 입력·추가 버튼 겹침을 수정하고, 390/768/1024/1440px에서 content-aware reflow와 document overflow 회귀 검증을 추가한다.
- 목록에 전체/활성/비활성 client-side 상태 필터와 필터 결과 empty state를 추가하고, 목록 행의 세로 여백을 줄여 기존 조작성과 관리자 인증/session/catalog revision 계약을 유지한 채 정보 밀도를 높인다.
- Application version을 `0.58.2`에서 `0.58.3`으로 증가한다.

## [0.58.2] - 2026-09-30

### Fixed

- Issue #326: 작업 캘린더의 국가 규칙/날짜 예외 draft key 생성을 `crypto.randomUUID()` 직접 호출에서 client-local ID helper로 전환해 HTTP/IP 등 `randomUUID` 미지원 브라우저 컨텍스트에서도 추가 동작이 화면 Error Boundary로 전파되지 않도록 한다.
- 임시 key는 Web Crypto UUID → `getRandomValues` → 비보안 로컬 fallback 순서로 생성하며 React/local draft 식별에만 사용하고 서버 canonical public ID·인증/세션 난수 정책은 변경하지 않는다.
- helper Unit test와 `Crypto.prototype.randomUUID`를 제거한 Chromium 작업 캘린더 회귀 테스트를 추가한다.
- Application version을 `0.58.1`에서 `0.58.2`로 증가한다.

## [0.58.1] - 2026-09-30

### Changed

- Issue #314: Gantt Day mode의 하위 날짜 Header를 locale 기반 날짜+요일 표기에서 day-of-month 숫자(`1`~`31`)만 표시하도록 간소화한다.
- SVAR 공개 `scales[].format` API를 사용하며 기존 Month Header, ISO Week, 44/68px cellWidth, 주말 강조, Gantt/API instance identity와 일정 데이터 계약은 유지한다.
- 숫자 formatter Unit test와 Day → Week → Day Chromium 회귀 검증을 추가한다.
- PR 회귀에서 확인된 Grid DnD/selection 후 stale inline edit session을 정리해 다음 작업명 클릭이 편집기로 정상 진입하도록 보완한다.
- Application version을 `0.58.0`에서 `0.58.1`로 증가한다.

## [0.58.0] - 2026-09-30

### Added

- Issue #289: Project에 사업부·제품·사업장/법인 nullable 선택형 메타데이터와 전역 project-master catalog/admin API·UI를 추가한다.
- migration `0017_project_master_catalog.sql`로 stable master 참조, category 무결성, catalog revision 및 별도 관리자 credential/session을 추가한다.
- 전역 `/project-master-admin` 관리 화면에서 category별 항목 추가·표시명 수정·활성/비활성·정렬 순서·사용 Project 수를 관리한다.

### Changed

- Project 생성·설정·목록·복사·Template 경로가 동일 global master 참조를 보존하며 inactive 항목은 신규 선택에서 제외하되 기존 참조는 유지한다.
- #280의 물류 관리자와 동일한 bounded 관리자 로그인 rate-limit 패턴을 project-master 관리자 인증에도 적용한다.
- Application version을 `0.58.0`으로 증가한다.

## [0.57.0] - 2026-09-30

### Added

- Issue #288: 글로벌 Resource에 nullable 개발자 등급(초급/중급/고급/특급)을 추가하고 Resource 관리자에서 생성·표시·수정할 수 있도록 한다.
- 시스템 Developer 신규 배정 시 개발자 등급을 필수 검증하고, 기존 미지정 Developer 배정은 migration 호환을 위해 보존한다. 등급은 일정·공수·capacity·비용 계산에 영향을 주지 않는다.
- `0016_resource_developer_grade.sql`과 DB/역할/Chromium 회귀 테스트를 추가한다.


## [0.56.0] - 2026-09-29

### Added

- Issue #280: 설비 유형과 물류 시스템 유형을 고정 allowlist가 아닌 글로벌 관리 카탈로그로 전환하고, 전용 `/logistics-admin` 관리자 화면에서 유형 추가·표시명 수정·활성/비활성·사용 건수를 관리한다.
- `LOGISTICS_CATALOG_ADMIN_PASSWORD` bootstrap credential, 별도 HttpOnly 관리자 세션, 런타임 비밀번호 변경, catalog revision/`If-Match` 동시성 제어를 추가한다.
- migration `0015_logistics_type_catalog.sql`에서 기존 12개 type code와 프로젝트 물류 데이터를 보존하면서 DB 고정 type CHECK를 catalog FK로 전환한다.
- Project Workspace의 설비/시스템 추가·수정은 active catalog를 사용하고, 기존 inactive type은 참조를 보존한 채 편집할 수 있다.

## [0.55.0] - 2026-09-29

### Added

- Issue #258: 관계가 있는 작업의 이름·진행률 등 메타데이터를 유효 일정 보존 상태로 편집하고, 일정 필드 변경 시 `requestedStart`와 전체 의존관계를 기준으로 일정을 재계산한다. Manual 충돌이나 할당 기간 위반은 작업·일정·revision 변경을 원자적으로 취소한다.

### Changed

- 작업 편집기·Grid·차트의 편집 제한을 필드별로 분리해 관계 작업의 메타데이터 편집과 서버 검증을 거치는 일정 편집을 허용한다. readonly·요약 작업·pending·stale 상태의 보호 계약은 유지한다.

## [0.54.1] - 2026-09-29

### Fixed

- Issue #300: Grid Drag & Drop의 확정 이동을 기존 Task hierarchy command에 연결하여 작업명 수정·재조회 후에도 새 parent/sibling 순서를 유지한다.
- 드래그 중 화면 피드백과 서버 저장을 구분하고 canonical 내부 이동의 중복 전송을 차단한다. 기존 권한·revision·실패 복구와 동일 Gantt 인스턴스를 유지한다.
- CI #1232에서 Project List 상태 E2E가 React hydration 전에 상호작용해 이벤트가 유실되는 race를 확인하고, 상태 변경 control을 hydration 완료 뒤 활성화하도록 보완했다.

## [0.54.0] - 2026-09-29

### Added

- Issue #285: 공정 생성 요청에서 `code` 생략을 허용하고 서버가 공정 public UUID를 기반으로 안정적인 내부 코드 `PROC-<UUID>`를 생성한다. 기존 명시적 code API와 수정 화면의 code 편집 계약은 유지한다.

### Changed

- 물류 구성의 공정 추가 모달에서 업무 입력이 아닌 공정 코드 필드를 제거하고 공정명을 첫 focus/필수 입력으로 사용한다. 기존 DB `code NOT NULL / UNIQUE`, Project copy·Template·Excel 조회 계약은 변경하지 않는다.

## [0.53.6] - 2026-09-29

### Fixed

- Issue #279: 물류 구성 5개 서브탭의 수평 overflow는 유지하면서 교차축 세로 overflow를 명시적으로 차단하고, 음수 하단 여백에 의존하던 active indicator 정렬을 제거한다.
- 좁은 화면의 ArrowLeft/ArrowRight/Home/End 키보드 탐색에서 포커스된 탭을 수평 viewport 안으로 보정하며 390/768/1024/1440px의 실제 tablist geometry를 Chromium E2E로 검증한다.


## [0.53.5] - 2026-09-29

### Fixed

- Issue #269: 프로젝트 복사·템플릿 저장의 인증 만료 재입력과 원본 revision 충돌 복구를 추가한다. 최신 원본을 명시적으로 확인한 뒤 재제출하며, 조회 실패·늦은 응답에서 저장을 차단하고 일반 입력 초안을 유지한다.

## [0.53.4] - 2026-09-29

### Fixed

- Issue #268: 리소스·그룹 저장 실패 시 입력을 보존하고 성공한 폼만 초기화한다. 목록 재조회 오류·세션 만료·revision 충돌의 복구 경로와 최신 목록 확인 전 저장 차단을 추가한다. 최신 관리자 비밀번호 변경 모달 UX를 유지하면서 검증 오류와 성공 안내를 분리하고 390px 긴 이름·헤더 overflow를 방지한다.

## [0.53.3] - 2026-09-29

### Changed

- Issue #282: `/projects/new`를 page-specific wide shell로 전환해 사이트 헤더 아래 불필요한 상단 여백과 75rem 본문 cap을 제거한다.
- 빈 프로젝트와 템플릿 생성 폼을 desktop/tablet의 가용 수평 공간을 활용하는 responsive grid로 정돈하고, 704px 이하에서는 logical one-column flow로 reflow한다.
- 320/390/768/1024/1440/1600px geometry E2E를 추가해 header spacing, wide form, multi-column/single-column 전환과 document overflow 부재를 검증한다.

## [0.53.2] - 2026-09-29

### Fixed

- Issue #267: 물류 대시보드 조건 변경·조회 실패에서 이전 KPI와 작업 이동을 차단하고 최신 응답만 표시한다. 기간 입력 검증과 명시적 재시도, 세부 현황 탭의 키보드·접근성 연결을 추가한다.

## [0.53.1] - 2026-09-29

### Fixed

- Issue #266: 관계 편집을 공통 native Dialog로 전환하고 후보 키보드 선택, 초안 폐기·삭제 확인, 요청 중 닫기·중복 요청 차단을 적용한다. 명시적 닫기 명령은 후보 popup보다 우선해 닫기/dirty 확인 흐름으로 진입하며, 선행 방향 관계 생성 성공 후 새 관계 초안을 기본값으로 초기화한다.

## [0.53.0] - 2026-09-29

### Added

- Issue #261: Resource Group/Resource 사용자 날짜 예외에 근무일(WORKING)을 추가하고 Project < Group < Resource 순서로 가용 Calendar를 결정한다. 같은 계층 충돌은 Calendar 저장과 그룹 구성원 변경에서 원자적으로 거부한다.
- Calendar Editor에서 근무·휴무 유형을 저장·복원하고 미리보기에 상위 대비 적용/효과 없음, 리소스별 최종 상태와 출처를 표시한다. 효과 없는 명시 예외도 저장할 수 있다.
- Resource workload의 M/D·M/M·과투입 계산에 계층형 Calendar를 적용하며 Project Task 일정과 기존 인증·revision 계약을 유지한다.

## [0.52.4] - 2026-09-29

### Fixed

- Issue #265: 템플릿 조회 실패·정상 빈 목록·검색 결과 없음을 구분하고 재시도를 제공한다. Native radio 선택, 검색 결과와 선택 요약, 사용자 이름 보존, 필드 오류 접근성과 반응형 폼 간격을 개선한다.

## [0.52.3] - 2026-09-29

### Changed

- Issue #283: Docker production runtime을 Next.js `output: "standalone"` 기반으로 전환하여 final image가 traced runtime dependency, `.next/static`, SQL migration, build-time compiled startup 도구만 포함하도록 축소한다.
- container startup validation과 DB migration은 build stage에서 CommonJS JavaScript로 컴파일하여 final image에서 전체 `src`, 전체 `.next`, production `node_modules` 복사와 TypeScript runtime loader 의존을 제거한다. repository의 `npm run db:migrate` source CLI용 `tsx`는 `devDependency`로 이동하고 production dependency/runtime에서는 제거하며, standalone final image에도 포함되지 않는지 정책 검사로 고정한다. source `npm run start`는 static/public/migration 자산을 준비한 generated standalone server를 실행하도록 전환하고 repository-root Next production env files를 먼저 로딩해 기존 hostname/port, `.env.local`, DB migration 경로 사용법을 유지한다.
- PR Docker gate는 PR base image와 candidate를 동일 runner에서 build하여 uncompressed image size, 주요 runtime artifact footprint와 상위 layer를 기록한다. 최소 25% 감소 hard gate는 이번 non-standalone → standalone migration에만 적용하여 이후 일반 PR을 불필요하게 차단하지 않는다. 기존 non-root, migration-before-server, readiness, native SQLite, restart persistence, transport/Compose smoke는 유지한다.

## [0.52.2] - 2026-09-29

### Fixed

- Issue #264: 새 프로젝트 생성 방식 탭을 왕복해도 각 폼의 초안을 유지하고, 제출 중 방식 전환과 중복 요청을 차단한다. 비밀번호는 제출 payload 확보 후 메모리에서 지운다.
- 본문 바로가기 후 활성 생성 panel의 첫 컨트롤에 focus가 들어오면 tablist를 다시 역방향 탐색할 수 있도록 skip-navigation 상태를 해제한다.

## [0.52.1] - 2026-09-29

### Fixed

- Issue #263: 작업 물류 연결·리소스 할당은 현재 작업/revision의 조회가 성공한 뒤에만 저장할 수 있다. 조회 오류의 빈 초안 저장을 차단하고 명시적 재시도를 제공한다.
- 물류 설비·시스템 담당자 후보 조회 실패를 알리고 최신 목록 확인 전 편집을 잠근다. 기존 담당자 이름·코드는 canonical 값으로 표시한다.

## [0.52.0] - 2026-09-29

### Changed

- Issue #235 정식 릴리스를 위해 애플리케이션 버전을 0.51.1에서 0.52.0으로 갱신한다. 기능 구현은 PR #241의 main 병합 내용을 사용하며 release artifact는 해당 최신 main 검증 후 생성한다.

## [0.51.1] - 2026-09-28

### Changed

- Issue #260: Project Workspace의 일정/리소스 필터 Toolbar를 content-aware responsive grid로 정돈하여 768/1024px에서 불필요한 full-width 적층을 줄이고 390px에서만 필요한 추가 적층을 허용한다.
- Task Advanced Filter를 텍스트, 일정·수치, 유형·할당, 물류 의미 section으로 재구성하고 operator/value·From/To·Min/Max·Resource/Group·물류 checkbox의 폭과 wrapping 규칙을 분리해 긴 label/값에서도 overlap과 document overflow를 방지한다.
- 390/768/1024/1440/1600px E2E에 열린 Advanced Panel, 긴 물류 label, toolbar child 및 input/select bounding-box overlap·bounds 검증을 추가한다.


## [0.51.0] - 2026-09-28

### Added

- Issue #235: 리소스 관리 화면의 상단 여백을 compact하게 조정하고, 내부 Catalog Revision 표시를 제거한다.
- 관리자 비밀번호 변경·새로고침·로그아웃을 하나의 관리 명령 행으로 통합하고, 비밀번호 변경은 접근 가능한 modal dialog로 전환한다. Catalog revision/If-Match/401/412 계약은 유지한다.
- 390/768/1024/1440px에서 관리 명령 정렬·document overflow·header-to-content spacing과 dialog Escape/focus restore를 E2E로 검증한다.

- Issue #245: Project Gantt를 canonical snapshot에서 SVG로 내보내고, 같은 SVG를 브라우저 Canvas에서 PNG로 변환해 다운로드한다. 전체 Project는 WBS Grid와 Chart를, 기간 지정은 지정한 날짜의 Chart만 포함한다.
- 내보내기 진입점에서 기존 Excel과 SVG/PNG를 선택하며, 기간·범위 입력, revision 동시성 검사와 크기 제한을 적용한다. 기존 Excel의 관계 및 물류 구성 보고서 옵션은 유지한다.


## [0.50.0] - 2026-09-27

### Added

- Issue #234: 리소스 관리 검색 및 그룹 구성원 작업 UX 개선.
  - 리소스 / 리소스 그룹 / 그룹 구성원 독립 검색 (`src/features/resources/resource-catalog-admin.tsx`, `resource-search-filter.ts`):
    - 리소스 목록, 리소스 그룹 목록, 그룹 구성원 할당 목록 각각에 실시간 Client-side 검색 바 및 일치 카운트(`일치 n / 전체 N`, 구성원: `일치 n / 전체 N · 선택 M`) 추가.
    - 이름(`name`) 및 코드(`code`) 대소문자 무시 substring 검색 지원 (trim 처리 및 null code 안전 처리).
    - `Escape` 키 입력 시 검색어 즉시 초기화 지원.
    - 데이터 없음(`등록된 리소스가 없습니다.`)과 검색 조건 불일치(`검색 조건과 일치하는 리소스가 없습니다.`) 상태 명확히 분리.
  - 그룹 구성원 선택 상태 보존:
    - 구성원 검색으로 일부 리소스가 필터링되더라도 기존 선택 상태(`selectedMembers`)를 100% 보존.
    - `구성원 저장` 시 필터된 항목만이 아닌 전체 선택 집합을 정확히 전송.
  - 그룹 구성원 푸터 액션 정렬 (`resource-catalog-admin.module.css`):
    - `memberFooterActions` 전용 스타일을 도입하여 데스크톱에서 `닫기`(secondary) 좌측, `구성원 저장`(primary) 우측 정렬로 일관되게 배치.
    - 모바일 뷰포트에서 자연스러운 랩/스택 처리로 오버플로우 방지.

## [0.49.0] - 2026-09-28

### Changed

- Issue #233: Project Gantt 정보 밀도 개선.
  - 초기 Grid 폭을 620px에서 480px로 축소하고 주요 Grid column 폭을 재조정해 Timeline 작업 공간을 확대했다.
  - 기간 column은 canonical working-day duration 의미를 유지하면서 cell 표시를 `N 근무일`에서 숫자 `N`으로 단순화했다.
  - SVAR 공개 `cellWidth` API를 사용해 Day 44px / Week 68px을 적용했다.
  - Day/Week 전환 전 현재 column state를 캡처하고 공개 `set-columns` API로 복원하여 사용자가 resize한 column 폭을 유지한다.
  - Chromium E2E로 480px Grid, 숫자 duration, 44/68 cellWidth 계약과 390/768/1024/1440px document overflow를 검증한다.

## [0.48.0] - 2026-09-28

### Added

- Issue #232: 프로젝트 설정 다이얼로그 정보 구조·탭·반응형 폼 레이아웃 개선.
  - 전용 와이드 모달 및 탭 컴포넌트(`WorkspaceDialog size="wide"`, `ProjectSettingsDialog`, `project-settings-dialog.module.css`):
    - 공통 다이얼로그의 기본 38rem 폭 외에 settings 전용 와이드 뷰(최대 60rem)를 지원하여 데스크톱 가용 공간 활용.
    - WAI-ARIA APG 준수 탭 인터페이스(`role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`) 구현.
    - 키보드 ArrowLeft/ArrowRight 및 Home/End 키를 통한 직관적인 탭 탐색 지원.
    - 탭 전환 시 컴포넌트를 unmount하지 않고 DOM에 유지(`hidden` 속성)하여 작업 중인 캘린더 규칙/미리보기, 비밀번호, 설명 등의 초안(draft) 상태 100% 보존.
  - 3개 카테고리 기반 정보 구조(IA):
    - **기본 정보**: 프로젝트 이름과 상태(compact select)를 2열 그리드로 정렬하고 설명 textarea는 전체 폭으로 배치.
    - **작업 캘린더**: 기존 `ProjectWorkCalendarEditor`를 통합하고 국가 규칙 및 휴무일 입력 항목을 2열 그리드와 우측 정렬 액션 행으로 정돈하여 항목 밀도 개선.
    - **편집·보안**: 새 비밀번호 변경 폼과 세션 안내 카드 및 편집 모드 종료 액션을 독립 분리.
  - 반응형 및 접근성:
    - 390/768px 모바일에서 1열 스택 레이아웃으로 자연스럽게 전환되어 가로 overflow 방지.
    - `Escape` 키 닫기 및 닫힘 후 '프로젝트 설정' 트리거 버튼으로의 포커스 복원 보존.

## [0.47.0] - 2026-09-28

### Added

- Issue #231: 프로젝트 화면 '정보' 및 '더보기' 팝오버 포커스 이탈 시 자동 닫힘 개선.
  - 외부 인터랙션 및 포커스 감지 (`src/features/projects/project-readonly-view.tsx`):
    - `infoPopoverOpen` state 및 `infoPopoverReference` 추가로 상태 제어 일원화.
    - document 레벨의 `pointerdown` 및 `focusin` 이벤트 리스너를 통해, 사용자가 팝오버 외부 영역을 클릭하거나 키보드 Tab 등으로 포커스를 이동했을 때 자동으로 팝오버가 닫히도록 개선.
    - 팝오버 내부 자식 요소(버튼, 링크, 입력창 등)로의 포커스 이동은 유지하여 내부 조작 가능성 보장.
    - 모달 다이얼로그(`dialog, [role="dialog"]`) 조작 시 부수적인 팝오버 닫힘 이벤트 충돌 방지.
  - 상호 배타적 오픈 및 접근성:
    - '정보'와 '더보기'가 동시에 열리지 않도록 상호 배타적 토글 핸들러 적용.
    - 동일 버튼 클릭 시 기존의 열기/닫기(toggle) 동작 보존.
    - `Escape` 키 입력 시 열려 있는 팝오버가 즉시 닫히는 표준 접근성 동작 유지.
  - Review 보완: 외부 클릭, Tab 포커스 이탈, disclosure 상호 배타, 복사 Dialog 예외를 Playwright E2E로 검증.

## [0.46.0] - 2026-09-28

### Added

- Issue #230: 프로젝트 목록 필터 입력 컨트롤 너비 및 날짜 범위 From/To 대칭 정렬 개선.
  - 프로젝트 정보 필터 dropdown은 9.5rem, text input은 14rem의 compact/content-aware 폭을 사용한다.
  - 생성일/최근 변경일의 From/To date input을 동일한 폭으로 대칭 배치하고 단일 날짜 입력도 동일 규칙을 사용한다.
  - 모바일에서 global label 규칙보다 높은 specificity로 column label을 유지하고, 공용 clear button은 CSS Modules의 global class로 정확히 선택한다.
  - #230 전용 Playwright 회귀 테스트로 desktop compact 폭, From/To 대칭, mobile label 방향, clear button 정렬, horizontal overflow를 검증한다.

## [0.45.1] - 2026-09-28

### Fixed

- Issue #229: 프로젝트 목록 화면에서 공통 `.main-content`의 큰 상하 여백을 목록 전용 compact spacing으로 제한해 시스템 헤더와 `WORKSPACE` 본문 사이의 과도한 간격을 축소했다.
- 390/768/1024/1440px 반응형 E2E에 헤더-본문 간격과 문서 수준 가로 overflow 회귀 검증을 추가했다.
- 최신 main `0.45.0` 기준으로 재정렬해 Relation Editor 변경과 함께 검증되도록 했다.

## [0.45.0] - 2026-09-28

### Added

- Issue #203: 관계선 더블클릭 Relation Editor 및 관련 아이템 검색·추가·삭제 구현.
  - 전용 Relation Editor 다이얼로그(`RelationEditorDialog`, `relation-editor-dialog.css`):
    - 관계선(`[data-link-id]`) 더블클릭 및 Relation Context Menu의 "관계 관리... (Relation Editor)" 액션을 통한 접근.
    - 선택된 관계의 선행(Predecessor)/후행(Successor) 작업 상세 및 Anchor(기준 작업) 전환 지원.
    - 관계 유형(`FS`, `SS`, `FF`, `SF`) 및 `Lag` 수정, 선택 관계 즉시 삭제.
    - Anchor 기준 연결된 모든 선행/후행 관계 목록 조회 및 항목별 선택/삭제 액션.
    - 프로젝트 내 Leaf Task 및 Milestone 대상 검색(인라인/자동완성)을 통한 신규 관계 추가 (Summary 및 자기자신, 중복 관계 자동 제외).
  - 순수 도메인 및 검색 헬퍼 모델(`src/features/gantt/relation-editor-model.ts`):
    - `getRelatedLinksForAnchor`, `searchCandidateTasks` 순수 함수 및 단위 테스트 작성.
  - 화면 안정성 및 접근성:
    - 다이얼로그 오픈/조작 중 Gantt 인스턴스, 스크롤 위치, 요약 작업 접힘 상태 완벽 보존.
    - `Escape` 키 닫기 및 다이얼로그 내부 Focus Trap 구현.
    - `ProjectReadonlyView`의 `saveLink` POST 페이로드에 `type` 및 `lag` 옵션 지원.
    - 읽기 전용 상태에 대한 안전한 비활성화 처리.

## [0.44.0] - 2026-09-28

### Added

- Issue #202: Schedule Item Baseline 저장·편집·Grid 표시 기반 지원.
  - SQLite migration `0014_task_baseline.sql`로 Task/Milestone Baseline start/duration/end를 저장한다.
  - 모든 descendant leaf에 Baseline이 있을 때 Summary Baseline을 파생하고 partial Summary는 완전한 Baseline으로 취급하지 않는다.
  - Task Editor에서 현재 일정 복사, Baseline 수정/삭제, Summary 파생 정보 조회를 지원한다.
  - Grid 열 메뉴에서 기준 시작/기준 종료를 선택적으로 표시한다.
  - Project Copy 시 Baseline을 보존한다.
- Chart Baseline Overlay는 Issue #253으로 분리했다. SVAR PRO `baselines` 및 `base_start/base_end/base_duration`에 의존하지 않으며, Core 공개 API 기반 Alignment POC를 통과한 경우에만 Chart 표시를 구현한다.

## [0.43.0] - 2026-09-28

### Added

- Issue #201: 프로젝트 재진입 시 Gantt Grid의 Summary 접힘/펼침(open/collapsed) 상태 복원 구현.
  - 순수 헬퍼 모듈 `src/features/gantt/summary-toggle-preference.ts` 구현:
    - 로컬 스토리지 키 `mastergantt:summary-toggle:<projectPublicId>` 격리.
    - v1 JSON 스키마 `{ version: 1, collapsedSummaryIds: string[] }` 직렬화/역직렬화 및 유효성 검증.
    - stale Summary ID를 현재 Summary 집합으로 필터링하고 로드 시 정규화된 결과를 storage에 다시 기록.
    - QuotaExceededError/SecurityError 등 localStorage 오류는 Gantt 동작을 깨지 않도록 비파괴적으로 처리.
  - `ProjectGantt` 컴포넌트 연동:
    - `projectPublicId` 기준 프로젝트별 상태 저장 및 Gantt API 초기화 후 1회 복원.
    - 마우스/키보드 `open-task` 액션에서 접힘/펼침 상태 실시간 영속화.
    - Fullscreen/필터/canonical snapshot 변경과 충돌하지 않도록 기존 in-memory 상태를 우선 유지.

## [0.42.0] - 2026-09-27

### Added

- Issue #200: 관계 Context Menu에서 관계 종류(FS/SS/FF/SF)·Lag 설정 및 일정 재계산 지원.
  - DB 마이그레이션 `0013_link_types_and_lag.sql`: `links` 테이블의 `type`을 `FS`, `SS`, `FF`, `SF` 허용으로 확장하고, `lag`를 `-10000..10000` 근무일 범위로 완화, `(project_id, predecessor_task_id, successor_task_id)` 유니크 제약 적용.
  - 순수 스케줄링 엔진(`src/domain/scheduling/calendar.ts`, `dependency.ts`):
    - `previousWorkingDay`, `shiftWorkingDate(date, offset, calendar)`, `startFromEnd(end, duration, calendar)` 구현.
    - 4대 의존성 관계(FS: End-to-Start, SS: Start-to-Start, FF: End-to-End, SF: Start-to-End) 및 근무일 단위 Lag(지연/선행) 계산 공식 적용.
    - 다중 선행 의존성 중 가장 강한 제약(strongest lower bound)을 적용하며, 기존 FS/0 결과 100% 회귀 보존.
  - 백엔드 REST API 및 계약:
    - `PATCH /api/projects/{publicId}/links/{linkId}` 신규 라우트 추가: type/lag 수정, no-op 판별, 순수 엔진 일정 재계산, revision atomic 증가, 412/404/409 오류 처리.
    - `CreateLinkRequest`에 `type`, `lag` 필드 지원 추가.
    - `POST /api/projects/{publicId}/links`에서도 FS/SS/FF/SF 및 lag 저장 지원.
    - `src/server/exports/project-excel-export-core.ts`: Excel 내보내기 시 FS/SS/FF/SF 및 lag 검증 허용.
  - 프론트엔드 UI/UX:
    - 관계선 SVG(`[data-link-id]`) 우클릭 시 호출되는 `RelationContextMenu` 신규 구현.
    - 선행·후행 작업명 표시, 관계 종류(FS/SS/FF/SF) 및 Lag(근무일) 선택/입력, 변경사항 없을 시 저장 비활성화, Escape 닫기, 관계 삭제 지원.
    - SVAR React Gantt의 link type (`e2s`, `s2s`, `e2e`, `s2e`) 실시간 시각적 양방향 어댑터 매핑.

## [0.41.0] - 2026-09-27

### Added

- Issue #195: 프로젝트 템플릿 등록·관리 및 템플릿 기반 프로젝트 생성 구현.
  - SQLite 마이그레이션 `0012_project_templates.sql` 추가: `project_templates` 테이블 및 `project_templates_active_idx`, `project_templates_created_at_idx` 인덱스 생성.
  - 템플릿 계약 인터페이스 `src/contracts/project-templates.ts` 정의 (템플릿 DTO, 작업/링크/배정/물류 스냅샷 인터페이스, 요청/응답 타입).
  - 저장소 계층 `ProjectTemplateRepository` 및 도메인 서비스 `ProjectTemplateService` 구현:
    - `createTemplateFromProject`: 기존 프로젝트에서 WBS 계층, FS 링크, 리소스 배정 및 물류 마스터/연결을 근무일 기준 상대 오프셋(`offsetDays`)으로 추출하여 JSON 스냅샷 직렬화 및 템플릿 저장.
    - `listTemplates`, `getTemplate`, `updateTemplate`, `deleteTemplate`, `duplicateTemplate`: 템플릿 검색 및 CRUD, 독립 사본 복제 지원.
    - `instantiateProject`: 지정된 기준 시작일(`projectStartDate`) 및 작업 캘린더에 맞춰 근무일 기반 날짜 재계산, WBS 계층/링크 삽입, 스케줄링 순수 엔진(`recalculateFinishStartDependencies`, `recalculateHierarchy`)을 통한 전체 일정/Summary 자동 재계산, 진척률(0%) 초기화, 리소스 배정 및 물류 마스터/연결 복제, 새 편집 세션 토큰 발급.
    - 원본 프로젝트 삭제 후 템플릿 보존 및 템플릿 삭제 후 생성된 프로젝트 보존(완전한 데이터 독립성 보장).
  - REST API 라우트 및 핸들러 구현:
    - `GET /api/project-templates` (템플릿 목록/검색)
    - `POST /api/project-templates` (프로젝트에서 템플릿 생성, Origin 및 편집 세션 인증)
    - `GET /api/project-templates/[templateId]` (템플릿 상세)
    - `PATCH /api/project-templates/[templateId]` (템플릿 수정, Origin 검증)
    - `DELETE /api/project-templates/[templateId]` (템플릿 삭제, Origin 검증)
    - `POST /api/project-templates/[templateId]/duplicate` (템플릿 복제, Origin 검증)
    - `POST /api/project-templates/[templateId]/instantiate` (템플릿 기반 프로젝트 생성, Rate Limiting 및 `Set-Cookie` 세션 발급)
  - UI 연동:
    - 프로젝트 상세 읽기 전용 뷰("더보기" 메뉴)에 `ProjectSaveAsTemplateButton` 추가: 원클릭 템플릿 저장 대화상자.
    - 프로젝트 생성 페이지(`src/app/projects/new/page.tsx`): `NewProjectTabs` 탭 UI 제공 ("빈 프로젝트 만들기" / "템플릿에서 만들기" 전환 지원).
    - 템플릿 선택 및 생성 폼(`CreateFromTemplateForm`): 등록된 템플릿 검색/선택 카드, 통계 배지(작업, 마일스톤, 물류 공정/설비/시스템 수), 기준 시작일 및 프로젝트 정보 입력 후 생성 지원.

## [0.40.0] - 2026-09-27

### Added

- Issue #189: 프로젝트 복사·삭제·내보내기 연계 및 물류 기능 통합 검증 (물류 LG-06).
  - 프로젝트 복사(Copy) 시 임시 가드(`LogisticsCopyNotSupportedYetError`) 해제 및 전체 물류 마스터(공정 계층 트리, 설비, 시스템, 제어·조율 관계, 리소스 역할, 태스크 물류 연결) 및 리소스 배정 원자적 복제 구현.
  - 새 프로젝트 및 복사 대상 로컬 엔티티에 새로운 독립 UUID v4 public ID 발급, 부모-자식 계층 관계 보존, 글로벌 리소스 ID 동일 참조 유지.
  - 비활성 마스터/리소스 복사 시 `warnings` 수집 및 반환, resetProgress 진척률 0% 초기화 및 WBS Summary 엔진 재계산 지원.
  - 프로젝트 복사 모달 UI(`ProjectCopyButton`)에 복사 대상 물류 항목 카운트(공정·설비·시스템) 및 글로벌 리소스 참조 보존 안내 문구 추가, 복사 경고 토스트 알림 연동.
  - Excel 내보내기에 `includeLogistics` 옵션 추가 및 "Logistics" 보고용 추가 시트 구현:
    - 프로젝트 및 물류 구성 요약 메타데이터(프로젝트명, ID, revision, 산출 기준일, 등록 공정·설비·시스템 수, 총 설비 수량).
    - 공정 마스터(코드, 이름, 상위 공정, 순서, 활성 상태).
    - 설비 마스터 및 제어/역할(코드, 이름, 유형, 단위, 수량, 소속 공정, 제어 시스템 및 역할, 담당자 및 역할, 제조사, 모델, 설명).
    - 물류 시스템 마스터(코드, 이름, 유형, 계층, 관리 범위, 담당 공정, 조율 시스템, 담당자 및 역할, 공급사, 설명).
    - 태스크-물류 연결(WBS, 작업명, 외부 ID, 대상 구분, 대상 코드, 대상 명, self/subtree 연결 범위).
    - Excel formula injection(`=`, `+`, `-`, `@`) 방지 안전 텍스트 처리 및 "전체 프로젝트 무손실 재가져오기(Import) 백업 파일이 아닌 보고용 출력물" 안내 명시.
  - Excel 내보내기 모달 UI(`ProjectExcelExportButton`)에 "물류 구성 보고서 포함" 옵션 체크박스 추가.
  - SQLite foreign key cascade에 의한 프로젝트 삭제 시 종속 물류 데이터 자동 정리 및 타 프로젝트/글로벌 리소스 보존 검증.

## [0.39.0] - 2026-09-27

### Added

- Issue #188: 공정·설비·시스템·담당자 대시보드 및 중복 없는 집계 구현 (물류 LG-05).
  - 순수 계산 엔진 `calculateLogisticsDashboardPure` 구현:
    - 3개 핵심 KPI: 기간 가중 진척률(`Σ(duration * progress) / Σ(duration)`, Summary/Milestone 제외, taskId 중복 없이 정확히 1번 집계), 미완료 지연 일반 작업(`progress < 100 AND end < asOfDate`), 마일스톤 경보(지연: `due < asOfDate`, 임박: `asOfDate <= due <= asOfDate + horizonDays - 1`).
    - 시스템 조율 범위 roll-up(`systemView: 'coordination'`): Coordinator DAG 순회 및 컨트롤러 제어 설비 합집합 roll-up, 중복 태스크는 정확히 1번만 집계.
    - 보조 계획 공수 집계: 일반 Leaf task의 리소스 배정(M/D, M/M), assignmentId별 중복 제거, 공수 미설정 작업 카운트.
    - 데이터 품질 및 구성 진단: 물류 미연결 작업 수 및 %, 주 제어기 미매핑 설비, 주 담당자 미지정 설비, 주 PI 미지정 시스템, 설비 수량 합계.
    - 공정별, 설비별, 시스템별 세부 breakdown 행 계산.
  - 단일 읽기 트랜잭션 기반 일관된 스냅샷 조회 서비스 `LogisticsDashboardService` 구현.
  - REST API `GET /api/projects/:publicId/logistics/dashboard` 핸들러 및 라우트 구현 (Public-read 권한 등록).
  - UI 컴포넌트 `ProjectLogisticsDashboard` 및 CSS Module 구현:
    - 상단 필터 바 (기준일, 임박 일수, 시스템 집계 모드, 활성 마스터만 보기, 수동 새로고침).
    - 4대 핵심 KPI 카드 그리드 (진척률 게이지 바, 지연 작업, 마일스톤 경보, 투입 공수).
    - 데이터 품질/구성 진단 패널.
    - 세부 현황 표 3종(공정별/설비별/시스템별 탭 전환) 및 행별 '일정 필터' drill-down 연동(클릭 시 일정 탭 자동 전환 및 필터 적용).
  - `ProjectLogisticsManagement` 첫 번째 서브탭으로 대시보드(`dashboard`) 통합 (키보드 5개 탭 탐색 지원).
  - 합성 결정적 픽스처 기반 단위 테스트 및 SQLite 단일 트랜잭션 통합 테스트 작성.

## [0.38.0] - 2026-09-27

### Added

- Issue #187: Summary·Task·Milestone의 설비·시스템 연결 및 범위 필터 구현 (물류 LG-04).
  - DB 마이그레이션 `0011_task_logistics_links.sql` 추가 (`task_equipment_links`, `task_system_links` 테이블 정의, `scope IN ('self', 'subtree')`, tasks cascade, equipment/systems NO ACTION deferrable 제약 및 인덱스).
  - 작업별 설비/시스템 연결 조회 및 원자적 교체 REST API 구현 (`GET/PUT /api/projects/:publicId/tasks/:taskId/logistics-links`).
  - Summary 작업의 하위 자손 상속(`subtree`) 지원 및 일반 작업/마일스톤의 `subtree` 지정 차단(`400 INVALID_TASK_LOGISTICS_LINKS`), 비활성 마스터 신규 연결 거부(`409 EQUIPMENT_INACTIVE`, `409 SYSTEM_INACTIVE`).
  - 설비/시스템 영구 삭제 시 연결된 태스크 링크 존재 보호(`409 EQUIPMENT_IN_USE`, `409 SYSTEM_IN_USE`).
  - 작업 정보 대화상자(Task Editor)에 4번째 탭 `물류 연결 (logistics)` 추가: 설비/시스템 다중 선택, Summary subtree opt-in, 상속된 연결 및 출처 Summary 표시, 주 담당자(Owner/PI) 메타데이터 표시, 독립 저장 및 If-Match revision 동시성 제어.
  - 일정(Gantt) 화면 고급 필터에 물류 3개 차원(공정, 설비, 시스템) 범위 필터 추가, effective 상속 매칭, 트리 계층 무결성을 위한 context row 보존 및 일치 카운트 정확성 보장.

## [0.37.0] - 2026-09-27

### Added

- Issue #186: 공정·설비·물류시스템 구성 및 담당자 관리 화면 UI 구현 (물류 LG-03).
  - Project Workspace에 `물류 구성` 탭과 공정/설비/물류시스템/제어·조율 관계 관리 화면을 추가하고 기존 Gantt mount/state를 유지한다.
  - 기존 Resource 카탈로그를 설비 Owner/Contributor와 시스템 PI/Developer 역할에 연결하며 readonly/edit-session, stale revision, 반응형·키보드 접근성 계약을 유지한다.
  - Review 보완으로 최신 LG-02 API 계약(`childSystemIds`, DELETE 영구 삭제)과 정렬하고 mutation 후 logistics snapshot 보존 및 401/403 readonly 강등 회귀를 검증한다.

- Issue #185: 설비 담당자 및 시스템 PI·개발자 역할 배정 스키마 및 REST API 구현 (물류 LG-02).
  - 설비 담당자 배정 테이블(`project_equipment_resource_roles`) 및 시스템 역할 배정 테이블(`project_system_resource_roles`) DDL 및 0010 마이그레이션 (`role IN ('owner', 'contributor')`, `role IN ('pi', 'developer')`, `is_primary` 최대 1개 partial unique index, resources 참조 시 `NO ACTION`으로 삭제 방지).
  - 설비 담당자 및 시스템 역할 배정 REST API 엔드포인트 구현 (`PUT /api/projects/:publicId/logistics/equipment/:equipmentId/resource-roles`, `PUT /api/projects/:publicId/logistics/systems/:systemId/resource-roles`).
  - 비활성 리소스 신규 배정 차단(`409 RESOURCE_INACTIVE`) 및 기존 배정 유지 허용 규칙 구현.
  - 설비·시스템 DTO에 `resourceRoles` 필드 확장 및 스냅샷/뮤테이션 응답 연동.
  - Review 보완으로 DELETE 영구 삭제 계약, 참조 중 삭제 차단, system scope/process mapping 불변식, documented wire property(`parentId`, `childSystemIds`) 및 canonical logistics mutation 응답을 정합화한다.

## [0.36.0] - 2026-09-27

### Added

- Issue #184: 물류 도메인 공정·설비·제어시스템 스키마 및 REST API 기반 구현 (물류 LG-01).
  - 공정(`project_processes`), 설비(`project_equipment`), 제어/조율 시스템(`project_logistics_systems`), 공정-시스템 매핑(`project_system_processes`), 설비-제어시스템 매핑(`project_equipment_systems`), 조율-제어 연계(`project_system_links`) DDL 및 0009 마이그레이션.
  - 공정·설비·시스템 CRUD 및 관계 교체 REST API 13개 엔드포인트 구현 (세션·Origin·If-Match 검증, 프로젝트 revision 1회 증가 원자적 처리).
  - 전체 스냅샷 및 태스크/링크 뮤테이션 응답에 `logistics` aggregate 필드 확장.
  - 물류 구성 데이터가 포함된 프로젝트 복사 요청 시 안전한 차단 가드(`409 LOGISTICS_COPY_NOT_SUPPORTED_YET`) 연동.

## [0.35.0] - 2026-09-27

### Added

- Issue #196: Project Workspace의 일정(Schedule) Toolbar에 `[ 전체 | Task | Milestone ]` 빠른 보기 버튼 그룹을 추가한다.
- 사용자는 고급 필터 패널을 열지 않고도 일반 Task 또는 Milestone만 빠르게 중심 조회할 수 있다.
- 빠른 보기 버튼은 기존 #83의 `TaskFilterState.types`와 동일한 Source of Truth를 공유하며, 검색어/기간/리소스 등 다른 필터 조건을 보존한다.
- 버튼 전환은 client-side view state로 동작하여 API 재조회, Project mutation, revision 증가, Gantt remount 없이 즉시 가시성을 갱신한다.
- 390/768/1024/1440px 뷰포트 및 전체화면 모드에서 레이아웃 겹침이 없으며 keyboard Tab 및 ARIA pressed 상태를 지원한다.

## [0.34.1] - 2026-09-26

### Fixed

- Issue #181: Project List 고급 필터의 프로젝트 정보·날짜 조건을 native disclosure로 재배치해 기본 세로 점유를 줄이고, 활성 조건은 접힌 summary에서도 값과 적용 상태를 확인할 수 있게 한다.
- 1024/1440px에서는 조건 그룹 내부를 2열 compact grid로, 390/768px에서는 1열로 배치하며 기존 Quick Search AND semantics, 상태 기본값과 #177의 상태 즉시 변경, 날짜 오류 처리, 조건 수·초기화·no-result와 Escape focus 복귀 계약을 유지한다.
- Project List E2E에 390×844·768×900·1024×900·1440×900의 disclosure keyboard, geometry, screenshot, document overflow 회귀를 추가한다. 구현 전 baseline 실측·캡처는 별도 증거 확보 전까지 NOT TESTED다.

## [0.34.0] - 2026-09-26

### Added

- Issue #177: Project List의 상태 셀과 편집 중 Project Workspace 제목 영역에서 `예정 / 진행 중 / 완료`를 바로 변경할 수 있다.
- Project List는 최신 canonical revision을 읽고 기존 edit session을 재사용하며, 세션이 없으면 편집 비밀번호 인증 후 status-only PATCH를 수행한다.
- Workspace header status 변경은 기존 Gantt 인스턴스와 작업공간 상태를 유지하면서 canonical mutation response를 적용한다.

### Changed

- Project List의 상태 변경 성공 직후 기존 client-side status filter를 다시 평가하여 완료 전환 등으로 필터에서 제외된 행과 결과 건수를 full reload 없이 즉시 갱신한다.
- List와 Workspace는 공용 status mutation client를 통해 strong `If-Match`, status-only payload, 401/403/412 및 canonical status 계약을 공유한다.
- 하위 호환 사용자 workflow 추가이므로 Semantic Versioning 정책에 따라 `0.33.1`에서 `0.34.0`으로 증가한다.

## [0.33.2] - 2026-09-26

### Fixed

- Issue #171: Gantt native 전체화면에서 우측 상단 알림 버튼의 hit area를 예약해 전체 화면/종료 버튼과 겹치지 않도록 하고, 390/768/1024/1440px에서 두 컨트롤의 비중첩 및 독립 클릭을 E2E로 검증한다.

## [0.33.1] - 2026-09-26

### Fixed

- Issue #157: 운영 Compose를 GHCR/prebuilt image 전용 경로로 분리하고 `pull_policy: always`를 적용해 rolling tag의 stale local image 재사용 가능성을 줄인다.
- local/CI source build는 `deploy/compose.build.yml` override에서만 허용하고 registry pull을 비활성화하여 운영 image pull과 build 경로를 명확히 분리한다.
- exact SemVer/verified digest 우선 배포, rolling tag의 명시적 pull/recreate, 실행 image identity 확인, Compose config 출력의 secret 마스킹 절차와 회귀 검증을 문서화한다.

## [0.33.0] - 2026-09-26

### Fixed

- Issue #142: Summary Task와 Task를 시작일 셀 좌측부터 종료일 셀 우측까지 inclusive 범위로 표시하고, Milestone을 Day/Week scale의 실제 날짜 셀 중앙에 정렬한다. 가로 스크롤과 390/768/1024/1440px 회귀 검증을 추가하고 기존 drag/resize/progress/dependency 및 날짜 저장 계약을 유지한다.


## [0.32.0] - 2026-09-24

### Added

- Issue #140: Grid 작업명 셀의 한 번 클릭 인라인 편집을 추가한다. Summary·Task·Milestone의 이름을 기존 권한·revision 계약으로 저장하고 Enter·blur 저장, Escape 취소 및 입력 오류 복구를 지원한다.

## [0.31.0] - 2026-09-24

### Added

- Issue #138: 프로젝트 상태 예정·진행 중·완료의 저장·편집과 목록 다중 필터를 추가한다. 기존 프로젝트는 진행 중으로 이관하고 신규·복사 프로젝트는 예정으로 시작하며 기본 목록에서 완료를 제외한다.

## [0.30.0] - 2026-09-24

### Added

- Issue #141: masterGantt 파비콘과 프로젝트명에 따른 브라우저 title을 제공하고 비종속 화면·오류·프로젝트 이탈 시 기본 title로 복원한다.

## [0.29.0] - 2026-09-24

### Added

- Issue #136: 공통 헤더 브랜드 옆에 package.json의 빌드 버전을 표시하고 좁은 화면에서는 기존 탐색 공간을 유지한다.

## [0.28.0] - 2026-09-24

### Added

- Issue #155: Gantt 전체 화면 전환과 키보드 단축키를 추가하고, 종료 시 focus 복귀와 Task Editor 열기 전 안전한 전체 화면 종료를 지원한다.

## [0.27.10] - 2026-09-24

### Fixed

- Issue #130 Phase 4: Project 목록·일정·리소스 검색 도구줄의 필터 수·초기화·결과 표현과 좁은 화면 배치를 통일하고 부분 날짜 안내와 focus 복귀를 유지한다.

## [0.27.9] - 2026-09-24

### Fixed

- Issue #130 Phase 3: Task Editor의 정보 위계와 반응형 필드 배치를 정리하고 본문 스크롤 중 header·탭·footer 접근을 유지한다.

## [0.27.8] - 2026-09-24

### Fixed

- Issue #130 Phase 2: Project Context와 일정·리소스 탭의 간격·시각 토큰을 정합화하고 정보·더보기 disclosure의 Escape focus 복귀를 지원한다.

## [0.27.7] - 2026-09-24

### Fixed

- Issue #130 Phase 1: Project 목록의 정보 위계·간격·상태 토큰을 정리하고 기존 표·검색·행 메뉴와 좁은 화면 내부 스크롤 계약을 유지한다.

## [0.27.6] - 2026-09-24

### Fixed

- Issue #121: App Shell에 키보드 본문 바로가기와 focus 가능한 main landmark를 제공하고 기존 dialog focus trap을 유지한다.

## [0.27.5] - 2026-09-24

### Fixed

- Issue #119: 리소스 할당·캘린더 반복 입력과 Project 생성의 필드 오류를 입력에 연결하고, 명시적 제출의 오류 요약과 키보드 focus 이동을 제공한다.

## [0.27.4] - 2026-09-24

### Fixed

- Issue #118: 좁은 화면에서 Project 제목·상태·일정 검색 도구줄을 읽고 조작하기 쉽게 배치하고, 필터 panel의 키보드 닫기와 focus 복귀를 유지한다.

## [0.27.3] - 2026-09-24

### Fixed

- Issue #117: 리소스 공수와 이름·코드 메타데이터의 조회 상태를 분리하고, 부분 실패·마지막 성공 결과·최신 메타데이터 라벨·focus를 보존하는 개별 재시도를 제공한다.

## [0.27.2] - 2026-09-24

### Fixed

- Issue #116: 작업 Context Menu 하위 메뉴를 화면 여유 공간에 따라 좌우 flyout 또는 같은 폭 drilldown으로 배치하고, 작은 화면·짧은 높이에서 키보드 탐색과 명령 접근을 유지한다. 열린 하위 메뉴에서 일반 root 명령으로 focus/pointer가 이동하면 child를 닫아 표시 상태와 `aria-expanded`를 일치시킨다.

## [0.27.1] - 2026-09-24

### Fixed

- Issue #115: 작업 캘린더 입력이나 기준 revision이 바뀌면 이전 미리보기를 무효화하고 재계산을 안내한다. 계산 중·실패·완료 상태를 구분하고 초안과 기존 저장·인증 계약을 유지한다.

## [0.27.0] - 2026-09-24

### Added

- Issue #120: 기존 파란색 업무 UI palette를 유지하면서 surface/text/border/action/focus/status 의미를 명시하는 semantic UI token 계층을 추가한다.
- error/warning/info/success 상태와 focus outline을 공통 token으로 정의하고 실제 Chromium computed style에서 텍스트 대비와 focus 가시성을 측정하는 회귀 검증을 추가한다.

### Changed

- Task Editor, Resource Catalog Admin, Project Row Actions, Workspace Feedback의 selected/focus/disabled/error 상태를 공통 semantic token 또는 문서화된 density 예외로 정합화한다.
- focus indicator는 밝은 surface와 3:1 이상, readonly/subtle badge 일반 텍스트는 4.5:1 이상 대비를 유지하도록 실제 렌더링 조합을 검증한다.
- Issue #99가 0.26.0을 선점한 최신 main에 재통합했으므로, 하위 호환 UI enhancement를 다음 MINOR 버전 0.27.0으로 증가한다.


## [0.26.0] - 2026-09-23

### Added

- Issue #99: 유효한 리소스 관리자 세션에서 관리자 비밀번호를 UI/API로 변경하고 SQLite scrypt 자격증명으로 영속화한다.
- 최초 실행 시 `RESOURCE_CATALOG_ADMIN_PASSWORD`를 seed로 사용하며 DB 자격증명이 생성된 뒤에는 런타임 변경값을 우선한다.

### Changed

- 프로젝트 편집 및 리소스 관리 신규 비밀번호 정책을 복잡도 강제 없이 1~12 Unicode 문자로 통일한다.
- 리소스 관리자 비밀번호 변경 시 기존 관리자 세션을 모두 revoke하고 호출자에게 새 세션을 발급한다.
- 기존 장문 Project 비밀번호는 unlock/삭제 재인증에 계속 사용할 수 있도록 호환성을 유지한다.
- 현재 main `0.25.0` 이후 사용자 기능/API 확장이므로 MINOR 버전 `0.26.0`으로 증가한다.

## [0.25.0] - 2026-09-23

### Added

- Issue #84: Project List에 프로젝트명·소유자·설명 Quick Search와 typed 고급 필터를 추가한다.
- 고급 필터는 프로젝트명/소유자/설명 text operator, 소유자 지정 여부, 생성일/최근 변경일의 browser-timezone 날짜 조건을 지원한다.
- 전체 수/일치 수, 검색 결과 0건 전용 상태, 조건별 삭제·전체 초기화, Escape focus 복귀와 responsive 접근성 계약을 추가한다.

### Changed

- Issue #83의 text normalization/operator primitive를 Task/Project filter가 공유하도록 분리하고 Project 전용 predicate는 독립 adapter로 유지한다.
- 검색은 client-side read-only view state이며 Project API/DB/revision과 기존 Row Action 정렬·mutation 계약을 변경하지 않는다.
- 사용자 기능 확장이므로 현재 main `0.23.1` 및 병행 중인 `0.24.0` 후보와 충돌하지 않도록 다음 MINOR 버전 `0.25.0`을 사용한다.

## [0.23.2] - 2026-09-23

### Fixed

- Issue #108: Excel 내보내기 `Gantt` 시트의 주차 헤더에서 ISO week year와 `W` 접두어를 제거하고 주차 번호만 표시한다.
- 월 헤더의 `YYYY-MM` 형식과 기존 ISO week 계산/그룹 경계는 유지하며, 연말·연초 `W53 → W01` 경계를 회귀 테스트로 고정한다.

### Changed

- API/DB 계약 변경 없이 기존 Excel 표시 형식만 수정하므로 Semantic Versioning 정책에 따라 `0.23.1`에서 PATCH 버전 `0.23.2`로 증가한다.


## [0.23.1] - 2026-09-22

### Fixed

- Issue #104: 프로젝트에 Dependency Link가 존재할 때 관계가 없는 Task의 Context Menu mutation까지 전역 비활성화되던 회귀를 수정한다.
- Context Menu/단축키/Task Editor와 서버 Task·Hierarchy·Subtree Delete 검증을 선택 Task 또는 영향 subtree 기준으로 좁혀, unrelated Link는 그대로 보존하면서 unlinked Task의 편집·이동·삭제를 허용한다.
- 관계 endpoint 자체와 관계가 포함된 영향 subtree는 기존 fail-closed 안전 계약을 유지한다.

### Changed

- 하위 호환 UI/서버 권한 판정 버그 수정이므로 Semantic Versioning 정책에 따라 `0.23.0`에서 PATCH 버전 `0.23.1`로 증가한다.

## [0.23.0] - 2026-09-22

### Added

- Issue #83: Project 일정 화면에 Task 통합 텍스트, effective 일정 기간, type/schedule mode, progress/duration, 할당 여부, 특정 Resource/Group ANY·ALL 검색/필터를 추가한다.
- 일치한 하위 Task를 표시할 때 ancestor Summary를 context row로 유지하고 실제 match count와 분리하며, 숨겨진 Task endpoint를 가진 dependency line은 표시하지 않는다.
- Resource 탭에 이름/code, Resource/Group 종류, 활성 상태, 연결 Task 기간 기반 필터를 추가하고 전체 Project workload 집계와 필터된 표시 행을 명확히 구분한다.

### Changed

- 검색/필터는 Project mutation·revision·DB 저장 없이 page-session view state로 동작하고 일정/리소스 탭별 상태를 유지한다.
- 사용자에게 노출되는 검색/필터 기능 확장이므로 Semantic Versioning 정책에 따라 `0.22.0`에서 `0.23.0`으로 증가한다.

## [0.22.0] - 2026-09-22

### Added

- Issue #97: Gantt의 FS/lag=0 작업 관계 생성·삭제를 보호된 Link API와 SQLite transaction에 연결하고 canonical snapshot으로 동일 SVAR instance를 동기화한다.
- Link 생성·삭제 후 dependency graph를 재계산해 Auto Task와 downstream 일정 및 Summary 파생값을 갱신하며, cycle/self/duplicate/Summary endpoint/Manual conflict를 원자적으로 거부한다.
- `POST /api/projects/{publicId}/links`와 `DELETE /api/projects/{publicId}/links/{linkId}`에 edit session, exact Origin, strong If-Match, Project isolation을 적용한다.

### Changed

- 사용자 기능/API 확장이므로 Semantic Versioning 정책에 따라 `0.21.1`에서 `0.22.0`으로 증가한다.

이 프로젝트의 주요 변경은 Semantic Versioning과 [CI/CD 정책](docs/CI_CD.md)에 따라 기록한다.

## [Unreleased]

## [0.21.1] - 2026-09-22

### Changed

- Issue #96: Task Editor의 작업 정보와 Resource allocation 입력을 content-aware grid로 조정해 넓은 화면에서 불필요한 stretching을 줄인다.
- 작업명은 주 입력 폭으로 제한하고 일정은 날짜/기간/확정 종료일에 맞는 비율, 진행률 slider는 최대 폭, Resource 투입률은 날짜보다 좁은 폭을 사용한다.
- 768px 이하에서는 기존 1열 stack으로 전환하며 Task PATCH, revision, dirty/stale/readonly, Assignment 저장 및 Relation 계약은 변경하지 않는다.
- 기존 기능의 호환 UI 밀도 보완이므로 `0.21.0`에서 PATCH 버전 `0.21.1`로 증가한다.

## [0.21.0] - 2026-09-22

### Added

- Issue #76: Project Workspace에 WAI-ARIA 기반 `일정 / 리소스` peer view 탭을 추가하고 두 panel을 mount 상태로 유지해 탭 전환 중 Gantt instance/state가 불필요하게 초기화되지 않도록 한다.

### Changed

- Global Header를 기존 75rem 제한에서 분리한 full-width App Shell로 변경하고 현재 전역 메뉴에 `aria-current`를 제공한다.
- Project Header를 프로젝트명과 편집 상태 중심의 compact context bar로 재구성하고 Description/Owner/Revision은 Info UI로 이동한다.
- 읽기 전용 편집 비밀번호 form은 상시 노출하지 않고 명시적 `편집 잠금 해제` Dialog에서만 입력하도록 변경한다.
- Resource workload를 Gantt 하단 portal에서 독립적인 full-width Resource View로 이동하고 Summary, M/D·M/M·Refresh toolbar, Group → Resource → Task hierarchy를 정돈한다.
- Issue #87의 `docs/UI_UX_GUIDELINES.md`와 UI/UX Agent 계약을 이번 Workspace 구현에 적용한다.
- 사용자 UI의 하위 호환 기능 확장이므로 Semantic Versioning 정책에 따라 `0.20.2`에서 `0.21.0`으로 증가한다.

## [0.20.2] - 2026-09-22

### Fixed

- Issue #80: Task Editor의 관계 표시가 `window.location.pathname` 파싱과 별도 Project GET에 의존하던 회귀를 수정하고, `ProjectWorkspace`가 이미 보유한 동일 canonical `tasks + links + revision` snapshot을 직접 사용하도록 변경한다.
- Grid 더블클릭, Chart 더블클릭, Context Menu → Edit에서 동일한 선행·후행 관계가 표시되고 Editor open만으로 mutation이 발생하지 않도록 Chromium E2E 회귀를 추가한다. 관계 표시 자체는 별도 Project GET에 의존하지 않는다.
- Readonly/Link 포함 일정에서도 Grid·Chart 더블클릭으로 조회용 Editor를 열 수 있고, 관계의 상대 작업명/externalId/type/lag 및 multiple relation 표시를 유지한다.

### Changed

- `0.20.1`이 Issue #77에서 사용되었으므로 하위 호환 회귀 결함 수정인 Issue #80은 다음 PATCH 버전 `0.20.2`를 사용한다.

## [0.20.1] - 2026-09-22

### Fixed

- Issue #77: Task Context Menu를 열 때 첫 번째 항목인 `Add`에 자동 focus가 지정되어 submenu가 즉시 열리던 회귀를 수정한다.
- 최초 focus는 root menu container에 두고, hover 또는 ArrowDown/ArrowUp/Home/End 등 사용자의 명시적 탐색 이후에만 menuitem과 submenu가 활성화되도록 변경한다.
- Grid와 Chart 모두에서 최초 open, close 후 reopen, pointer hover, keyboard navigation을 Playwright 회귀 테스트로 검증한다.

### Changed

- 하위 호환 UI 결함 수정이므로 Semantic Versioning 정책에 따라 `0.20.0`에서 `0.20.1`로 증가한다.

## [0.20.0] - 2026-09-21

### Changed

- Issue #74: Task Editor를 작업 정보·리소스·관계 3개 탭으로 재구성하고 Header/Tab/Footer는 유지한 채 Body만 스크롤하도록 대형 반응형 modal layout을 적용한다.
- WAI-ARIA tab pattern에 맞춰 Arrow Left/Right, Home/End 키보드 탐색과 focus-visible을 제공하고 360/768/1440px에서 horizontal overflow를 방지한다.
- 리소스 할당은 검색·유형·할당됨 필터, 선택 우선 정렬, Resource/Group badge와 row/divider 구조로 정돈하고 기존 Task PATCH와 Assignment PUT 저장 계약은 분리 유지한다.
- 관계 정보는 wide 화면 2열, narrow 화면 1열로 표시하고 관계/할당 건수를 탭과 섹션에서 확인할 수 있게 한다.
- 하위 호환 사용자 UX 확장이므로 Semantic Versioning 정책에 따라 `0.19.0`에서 `0.20.0`으로 증가한다.

## [0.19.1] - 2026-09-21

### Fixed

- Issue #75 정식 release gate에서 좁은 viewport의 행 작업 버튼을 Playwright가 자동 스크롤한 직후 메뉴를 열면서 지연된 `scroll` 이벤트와 경합하던 E2E 불안정성을 수정한다.
- 반응형 메뉴 검증은 작업 trigger를 먼저 `scrollIntoViewIfNeeded()`로 안정화하고 두 animation frame 뒤에 메뉴를 열어 실제 사용자 흐름인 ‘스크롤 완료 후 클릭’을 검증한다.

### Changed

- `v0.19.0` annotated tag의 release run #18은 candidate build/GHCR write 이전 Chromium E2E에서 실패했으므로 tag를 이동·삭제·재사용하지 않는다.
- 실패한 exact version을 덮어쓰지 않는 릴리스 정책에 따라 후속 PATCH 버전 `0.19.1`로 정식 release를 재진행한다.
## [0.19.0] - 2026-09-21

### Changed

- Issue #75: 프로젝트 목록 페이지를 일반 Form 폭과 분리해 최대 100rem의 wide layout으로 확장하고 Header/Table 좌우 기준선을 맞춘다.
- 프로젝트명을 primary navigation으로 유지하면서 행 작업을 `프로젝트 복사`·`링크 복사`·`삭제`가 포함된 accessible overflow menu로 통합한다.
- Header/Row typography, divider, hover/focus-within, Description 우선 열 배분과 반응형 horizontal scroll을 정리한다.
- 기존 링크 복사 fallback과 프로젝트 삭제 재인증/If-Match/오류 처리 계약은 변경하지 않는다.
- 하위 호환 사용자 UX 확장이므로 Semantic Versioning 정책에 따라 `0.18.0`에서 `0.19.0`으로 증가한다.


## [0.18.0] - 2026-09-21

### Added

- Issue #72: 편집 권한이 있는 Grid/Chart 작업의 우클릭 메뉴를 SVAR Willow 기본 작업 흐름에 맞춰 Add, Convert to, Edit, Cut, Copy, Paste, Move, Indent, Outdent, Delete로 확장한다.
- `POST /api/projects/{publicId}/task-commands`를 추가해 생성 위치 지정, 형식 변환, sibling 재정렬, indent/outdent, cut-paste reparent, subtree copy를 서버 권위의 단일 transaction으로 처리한다.
- Canonical hierarchy 동기화는 SVAR 공개 `move-task` action을 사용해 parent/sibling 변경을 반영하며, 구조 변경 중 불필요한 Gantt recovery remount를 방지한다.
- Ctrl/Cmd+X, Ctrl/Cmd+C, Ctrl/Cmd+V와 Delete/Backspace/Ctrl+D 작업 단축키를 추가한다.

### Changed

- 계층 명령 성공 시 전체 canonical snapshot을 반환하고 Project revision을 정확히 1 증가시키며, 기존 Dependency Link가 있는 일정은 기존 정책대로 계층 mutation을 거부한다.
- subtree copy는 리소스 할당을 조용히 누락하지 않도록 할당이 있는 원본을 `TASK_COPY_ASSIGNMENTS_UNSUPPORTED`로 명시적으로 거부한다.
- 하위 호환 사용자 기능/API 확장이므로 Semantic Versioning 정책에 따라 `0.17.0`에서 `0.18.0`으로 증가한다.


## [0.17.0] - 2026-09-19

### Added

- Issue #68: 작업 캘린더 Preview/저장 경로에 기존 `FS/lag=0` Dependency를 포함하는 서버 권위 forward-pass 재계산을 추가한다.
- `changedTasks`에 `CALENDAR` / `DEPENDENCY` / `SUMMARY` 원인과 실제 lower bound를 만든 선행 작업 External ID를 포함한다.
- Calendar 변경 후 Manual 후행 작업이 FS lower bound를 위반하면 `MANUAL_DEPENDENCY_CONFLICT`로 전체 저장을 거부한다.

### Changed

- Dependency Link 존재만으로 반환하던 `CALENDAR_RECALC_UNSUPPORTED` 제한을 제거하고, cycle은 `DEPENDENCY_CYCLE`, 지원 외 구조는 `UNSUPPORTED_SCHEDULE_STRUCTURE`로 구분한다.
- Calendar rule/date, Auto Task, Summary 파생값과 Project revision은 하나의 SQLite transaction에서 저장하며 revision은 정확히 1 증가한다.
- 하위 호환 일정 기능 확장이므로 Semantic Versioning 정책에 따라 `0.16.1`에서 `0.17.0`으로 증가한다.


## [0.16.1] - 2026-09-18

### Fixed

- Issue #67: Docker Compose가 `.env`의 `RESOURCE_CATALOG_ADMIN_PASSWORD`를 app 컨테이너에 전달하지 않던 결함을 수정한다.
- 관리자 비밀번호 누락 시 Compose config 단계에서 fail-fast하고, CI Docker smoke에서 실제 컨테이너 환경 전달·인증 성공/거부·로그 비노출을 검증한다.

### Changed

- 하위 호환 Docker 배포 결함 수정이므로 Semantic Versioning 정책에 따라 `0.16.0`에서 `0.16.1`로 증가한다.

## [0.16.0] - 2026-09-18

### Added

- Issue #57: 프로젝트별 작업 캘린더 관리 기능을 추가한다. 대한민국을 기본 국가로 하고 중국, 베트남, 필리핀, 태국, 멕시코, 미국의 2026년 국가 공휴일 fixture와 출처/version metadata를 저장소에 고정한다.
- 국가 규칙은 프로젝트 전체 또는 기간 범위로 적용할 수 있으며, 조직·개인·프로젝트 휴무일을 별도 CUSTOM 규칙으로 관리한다.
- Scheduling Domain에 명시적 `NON_WORKING` / `WORKING` 날짜 예외를 추가해 중국·베트남의 보충 근무일처럼 주말을 근무일로 전환하는 규칙을 지원한다.
- `GET /api/work-calendars/countries`, `GET/PUT /api/projects/{publicId}/work-calendar`, `POST /api/projects/{publicId}/work-calendar/preview` API와 Preview UI를 추가한다.
- 리소스 공수 계산은 Project + Resource Group + Resource 휴무일을 합성한 Effective Calendar를 사용한다.

### Changed

- 기존 `project_holidays` 데이터는 migration에서 신규 작업 캘린더 모델로 손실 없이 옮기고 호환 VIEW/trigger를 유지한다.
- 신규 프로젝트에는 생성 시점의 대한민국 `FULL_PROJECT` 국가 규칙을 기본 생성하며, 기존 프로젝트에는 migration만으로 국가 규칙을 자동 추가하지 않는다.
- 작업 생성·수정·삭제 및 하위 작업 삭제 재계산은 신규 Project Calendar를 서버 권위 일정 계산에 사용한다.
- 사용자 기능, API와 DB 계약을 하위 호환으로 확장하므로 Semantic Versioning 정책에 따라 `0.15.0`에서 `0.16.0`으로 증가한다.

## [0.15.0] - 2026-09-18

### Added

- Issue #64: Docker/server stdout에 JSON 한 줄 구조화 logger, 실제 `LOG_LEVEL` 필터, 민감 필드 redaction과 안전한 500 진단을 추가한다.
- 검증된 `X-Request-ID` 또는 서버 UUID를 API lifecycle, 오류 body, 응답 header와 서버 로그에서 동일하게 사용하는 request correlation을 추가한다.
- runtime configuration, DB migration, application startup과 readiness 장애/복구 운영 이벤트 및 Nginx↔Docker 추적 문서를 추가한다.

### Changed

- Issue #61의 리소스 관리자 인증 진단을 공통 logger에 연결하고 주요 Project/Task/Resource/Export API를 동일 request lifecycle 체계에 편입한다.
- 하위 호환 운영 관측성 및 request-correlation 기능 추가이므로 Semantic Versioning 정책에 따라 `0.14.1`에서 `0.15.0`으로 증가한다.


## [0.14.1] - 2026-09-18

### Fixed

- Issue #61: 리소스 편집 관리자 인증 실패 원인을 Docker/server stdout의 구조화 로그에서 구분할 수 있도록 진단 로그를 추가한다.
- 비밀번호 미설정·정책 위반·불일치를 `ADMIN_PASSWORD_NOT_CONFIGURED`, `ADMIN_PASSWORD_POLICY_INVALID`, `ADMIN_PASSWORD_MISMATCH`로 구분하면서 외부 API는 기존 `RESOURCE_ADMIN_AUTH_FAILED` 계약을 유지한다.
- 비밀번호, session token, Cookie/Authorization 및 예외 원문이 로그에 노출되지 않도록 회귀 테스트를 추가하고 `requestId` 기반 추적 절차를 문서화한다.

### Changed

- 하위 호환 운영 진단/보안 수정이므로 Semantic Versioning 정책에 따라 `0.14.0`에서 `0.14.1`로 증가한다.

## [0.14.0] - 2026-09-17

### Added

- Issue #56: 작업별 개별 리소스에 계획 투입 시작일·종료일·투입률을 저장하고 프로젝트 근무일 기준 M/D를 계산한다.
- 프로젝트 화면에 `그룹 → 리소스 → 작업` 계층의 리소스 공수 조회를 추가하고 M/D와 설정된 기준의 M/M 전환, 미설정 공수 및 과투입 표시를 제공한다.
- `GET /api/projects/{publicId}/resource-workload` 집계 API와 SQLite `0005_resource_workload.sql` migration을 추가한다.

### Changed

- `RESOURCE_MD_PER_MM`이 유효한 양수일 때만 M/M 환산을 제공하고, 미설정 시 임의 기준을 사용하지 않는다.
- 하위 호환 사용자 workflow와 API/DB 계약 추가이므로 Semantic Versioning 정책에 따라 `0.13.0`에서 `0.14.0`으로 증가한다.

### Fixed

- 공수 조회 영역이 기존 프로젝트 작업면의 Gantt 폭·스크롤 계약을 변경하지 않도록 portal로 격리하고, E2E 레이아웃 검증 경계를 실제 `.project-schedule`로 맞춘다.


## [0.13.0] - 2026-09-16

### Added

- Issue #28: 프로젝트의 Grid와 Gantt Chart를 계층/WBS, 시작·종료일, 근무일 기간, 진행률과 함께 Excel(.xlsx)로 내보내는 기능을 추가한다.
- 내보내기 실행 때마다 작업 관계 포함/제외/취소를 명시적으로 선택하며, 관계 포함 시 Dependencies 시트와 Gantt 관계 화살표를 생성한다.
- canonical snapshot과 strong If-Match를 사용해 동일 revision의 읽기 전용 데이터를 내보내고, 외부 Excel 서비스나 SVAR PRO export 기능에 프로젝트 데이터를 전송하지 않는다.

### Changed

- 사용자 기능 추가에 따라 Semantic Versioning 정책으로 애플리케이션 버전을 0.12.0에서 0.13.0으로 증가한다.


## [0.12.0] - 2026-09-16

### Added

- Issue #19: 프로젝트에 종속되지 않는 글로벌 리소스와 리소스 그룹을 관리하고, Task/Summary/Milestone에 개별 리소스 또는 그룹을 직접 할당·해제할 수 있다.
- 별도 `resource_catalog_admin` 세션, catalog revision, Project revision 기반 동시성 검증과 SQLite `0003_resource_catalog.sql` migration을 추가한다.
- `/resources` 관리 화면과 Task Editor의 리소스/그룹 다중 할당 UI를 추가한다. SVAR PRO Resource API는 사용하지 않는다.

### Changed

- Assignment PUT 성공 응답을 `project`, `tasks`, `links`, `assignments` 전체 canonical aggregate와 strong Project ETag를 반환하는 계약으로 확정한다.
- 사용자 workflow와 API/DB 계약을 하위 호환으로 확장하므로 Semantic Versioning 정책에 따라 `0.11.1`에서 `0.12.0`으로 증가한다.

## [0.11.1] - 2026-09-15

### Changed

- Issue #51: Gantt `주` 표시의 하위 Chart Header를 날짜 범위에서 ISO 8601 Week(`W01`~`W53`)로 변경했다.
- ISO week 계산을 독립 helper로 분리하고 월 경계 및 `W52/W53 → W01` 연말·연초 경계를 단위 테스트로 검증한다.
- Chromium E2E에서 ISO week Header 표시, 날짜 범위 제거, `일 ↔ 주` 반복 전환 시 Gantt/API 인스턴스 유지와 일 모드 주말 강조 회귀를 검증한다.

## [0.11.0] - 2026-09-15

### Added

- Issue #36: Task Editor의 진행률 입력을 0~100%, 1% 단위 Slider로 변경하고 현재 값을 명시적으로 표시한다.
- Task에 여러 줄 Description과 `http://`/`https://` URL을 저장할 수 있으며, 위험한 URL scheme은 클라이언트와 서버에서 거부한다.
- URL이 저장된 Grid 행/Chart 작업은 일반 클릭으로 새 탭에서 링크를 열며 drag/resize/우클릭 동작과 분리한다.
- SQLite migration `0002_task_description_url.sql`을 추가하고 canonical snapshot, 프로젝트 복사, subtree 삭제 응답까지 신규 필드를 보존한다.

### Fixed

- 기존에 저장된 소수 진행률은 다른 필드만 편집할 때 저장을 막지 않도록 호환성을 유지하고, 사용자가 Slider로 변경하는 값부터 1% 정수 단위를 적용한다.
- 프로젝트 복사 시 Description/URL을 원본 복사 transaction 안에서 함께 저장하여 all-or-nothing 계약을 유지한다.

## [0.10.0] - 2026-09-15

### Added

- Issue #34: Task Editor에 현재 작업의 선행/후행 관계를 조회 전용으로 표시한다. 상대 작업명과 externalId, 관계 유형, lag를 함께 보여주며 Editor 기준 revision과 동일한 canonical snapshot만 채택해 stale 관계 혼합을 차단한다. 사용자 기능 추가에 따라 버전을 `0.10.0`으로 갱신한다.


## [0.9.0] - 2026-09-15

### Added

- Issue #35: Gantt Chart 상단에서 기본 일 단위와 주 단위를 즉시 전환할 수 있다. 전환은 동일 SVAR Gantt 인스턴스를 유지하며 일 보기에서만 기존 주말 강조를 표시한다. 사용자 기능 추가에 따라 버전을 `0.9.0`으로 갱신한다.

## [0.8.3] - 2026-09-15

### Fixed

- Issue #37: 프로젝트 직접 진입뿐 아니라 브라우저 history/BFCache 복원에서도 서버의 현재 편집 세션을 다시 확인한다. 재검증 중 작업공간을 inert 처리하고, 만료·잘못된 응답·조회 실패는 fail-closed로 읽기 전용 재진입시켜 stale edit UI를 폐기한다. 정상 edit 재검증은 기존 Gantt 인스턴스를 유지한다.

## [0.8.2] - 2026-09-15

### Fixed

- Issue #40: Task Editor E2E의 스크롤 불변성 검증이 레이아웃 시점마다 달라질 수 있는 전체 scrollable DOM 목록을 비교하지 않도록 변경했다. `window`, 프로젝트 작업공간, SVAR Grid, Chart의 명시적 컨테이너 위치만 비교하고 실제 스크롤에 따른 메뉴 닫힘 검증은 전용 `task-context-menu-scroll.spec.ts`에 유지하여 동일 head 재실행에서도 안정적으로 회귀를 검출한다.

## [0.8.1] - 2026-09-15

### Fixed

- Issue #33: 운영 상단 주요 메뉴에서 `Gantt 데모` 링크를 제거한다. `/gantt-demo` route와 fixture는 SVAR 통합·timezone/hydration E2E 검증 자산으로 유지하고, 헤더 회귀 테스트는 프로젝트 메뉴와 알림 hit-area 및 데모 링크 미노출을 검증한다.
- 저장이 거부된 drag/resize의 canonical 조회가 성공하면 동일 Gantt 인스턴스에 서버 snapshot을 동기화하고, 조회 실패 시에만 강제 reset하여 검증되지 않은 로컬 변경을 폐기한다. 관련 비동기 E2E는 실제 스크롤 상태와 canonical 일정 복구를 기다려 검증한다.


## [0.8.0] - 2026-09-15

### Added

- Issue #27: 기존 프로젝트의 저장 일정·계층·의존관계·휴일을 독립 프로젝트로 원자 복사하고 새 ID·편집 비밀번호를 발급한다. 목록과 상세 작업공간에서 복사 대화상자에 진입할 수 있으며 선택적으로 진척률을 초기화한다.
- Issue #8: production 내부망 HTTP opt-in, 외부 URL 기반 쿠키 정책, Nginx HTTP 예제 및 production HTTP/HTTPS 브라우저·영속성 CI.
- Issue #31: Grid·Chart 작업 우클릭 메뉴에 보호된 작업 삭제를 추가하고, 자손이 있으면 범위를 확인한 뒤 서버가 저장 계층을 재계산하여 하나의 transaction으로 subtree를 삭제한다. 사용자 기능/API 확장에 따라 버전을 `0.7.0`으로 갱신한다.
- PR #23 후속: 작은 화면의 알림 아이콘·상단 navigation 겹침과 인증 오류 진단 코드 누락을 보완하고 관련 UX 계약·회귀 검증을 정리한다. 원격 결과는 후속 PR에 기록한다.
- 공간을 차지하지 않는 5초 Toast와 최대 50건 오류 알림함·미확인 표시·안전한 내용 복사 (#18).
- 목록과 상세 화면의 공용 프로젝트 링크 복사 및 clipboard 거부/미지원 시 수동 복사 (#21). APP_BASE_URL/publicId 기반 직접 접근과 기존 권한을 유지한다.
- Grid 행/Chart 막대 우클릭 및 키보드로 여는 작업 정보 편집기 (#4). 명시적 PATCH 저장, 근무일 기간, 권한/요약 작업 읽기 전용, 실패 시 초안 보존과 Revision 충돌 재검토를 제공한다. 사용법과 검증 범위는 [Task Editor](docs/TASK_EDITOR.md)를 참조한다.

### Fixed

- 모달 top layer 안에서 안내를 확인할 수 있도록 dialog 내 live region을 제공하고, 전역 status 선택자로 발생하던 W05 E2E strict mode 오류를 수정했다. 관련 [UX 계약·CI 실패 분석·보충 테스트 계획](docs/PROJECT_UX.md)을 참조한다.
- 작업 저장 중 Gantt 재마운트를 제거하고 서버 확정 snapshot을 같은 인스턴스에 반영하도록 개선 (#3). 기존 화면 상태 보존 및 중복 mutation 차단 회귀 검증은 해당 PR 결과로 추적.

### Repository layout

- Vitest/Playwright 설정을 `tests/config/`로 이동하고 명시적 config 선택과 root/외부 cwd 테스트 발견 검증을 추가했다 (#13).
- 배포 파일을 `deploy/`로 이동하고 Compose 프로젝트명 명시, CI/Dependabot 참조와 격리 Compose 재생성·영속성 검증을 추가했다 (#12).

### Changed

- annotated `v*` tag ref를 지정한 수동 실행에서도 기존 Semantic Release 검증과 GHCR digest smoke를 동일하게 수행할 수 있도록 release workflow 실행 경로를 보완했다.
- 프로젝트명 하단의 Revision/시간대/휴일/작업/연결·펼침 설정을 제거하고 설정 기능을 헤더 버튼의 별도 창으로 이동했다 (#9).
- 목록의 삭제 버튼을 항상 표시하되 기존 세션과 무관하게 새로 입력한 비밀번호 확인 후 보호 DELETE/If-Match를 호출한다 (#10).
- Grid 행 +의 첫 하위 추가 시 확인 팝업 없이 기존 명시적 요약 전환 옵션을 전송한다 (#11). 마일스톤/계층·집계 검증은 유지한다.
- Grid Header 우클릭 표시 열 선택으로 전환하고 외부 ID를 기본 숨김 처리. 별도 외부 ID 표시/숨기기 버튼 제거.
- Grid/Chart 상단의 ‘작업 추가 또는 삭제’ 패널과 전용 UI 상태 제거. Native Grid `+`와 서버 Task 삭제 API는 유지.
- 새 작업 생성 시 이름·시작일·기간 입력을 제거하고 `새 작업`·오늘·1일 자동 적용(Milestone은 0일 유지). 과거 Summary 전환 확인은 #11로 대체한다.
- 과거 로컬 검증 보류 기록은 `docs/PENDING_TESTS.md`에 보존한다. 이번 다섯 이슈는 사용자 승인에 따라 GitHub Actions로 검증하며, 최종 head의 실제 결과는 PR #23에서 추적한다.

## [0.6.0] - 2026-09-12

### Added

- 편집 권한을 확인하는 Project 삭제와 전체 목록의 표 형태 UI
- SVAR Grid Header/행 `+` 기반 최상위·하위 작업 추가와 명시적 상위 Summary 전환
- 하위 일정 변경에 따른 조상 Summary 일정·진척 집계
- 외부 ID 표시 선택, 오늘/1일 기본값, 주말 음영, 사용자 locale 날짜 표시

### Changed

- 프로젝트 설정을 접고 프로젝트·Grid·Chart Header를 유지하는 내부 세로 스크롤 작업공간

## [0.5.0] - 2026-09-12

### Added

- D02 승인에 따른 전체 Project 목록 API와 홈 목록 화면; 생성 후 복귀·새로고침 시 저장 목록 표시
- 목록은 공개 summary만 반환하고 기존 프로젝트별 편집 인증 유지

### Changed

- 현재 비공개 플랜에서 main/tag 보호 규칙 미강제 위험을 수용하고 GHCR 자동화를 진행하도록 D05 확정
- 최초 원격 push에서 확인한 PAT `workflow` scope 누락을 배포 선행 조건으로 문서화
- PAT 권한 보완 후 실제 main/`v0.4.0` Actions·private GHCR 게시·digest 실행 검증 완료 기록 추가

## [0.4.0] - 2026-09-12

### Added

- main commit마다 검증을 통과한 GHCR `ci-<full SHA>` 테스트 이미지 게시와 registry digest 재다운로드 검증
- 게시 이미지의 Project/Task HTTP 저장·권한·재시작 persistence 검증

### Changed

- Commit 테스트 이미지와 Semantic Version release 이미지의 태그 공간 분리
- BuildKit SBOM/provenance를 유지하고 GitHub 서명 attestation은 지원 플랜에서 명시적으로 활성화

## [0.3.1] - 2026-09-12

### Changed

- D04 운영 결정을 GHCR private, 최소 `packages: read`, 필수 CI, 보호된 `v*` tag와 지정 release 권한으로 확정
- Pull Request는 유지하되 필수 승인 review 수를 0으로 설정
- 과거 노출 credential의 재사용을 사용자 수용 잔여 위험으로 기록하고 원격 차단 사유를 인증 미구성으로 변경

## [0.3.0] - 2026-09-12

### Added

- Project 화면의 좌측 계층 Task Grid와 우측 동기 Gantt Chart 작업공간
- 빈 일정, 생성 직후 양쪽 표시, Desktop geometry와 narrow 내부 scroll Browser 회귀 검증

### Changed

- Project route가 viewport 폭·높이를 사용하고 Project 설정과 Task 관리를 접이식으로 표시

### Fixed

- 빈 Project에서 Gantt가 렌더링되지 않던 문제와 좁은 화면에서 Gantt min-content가 document 전체를 확장하던 문제

## [0.2.0] - 2026-09-12

### Added

- Project별 root Task/Milestone 생성·수정·삭제와 실제 SVAR pointer persistence
- GitHub Actions application/E2E/container CI
- Semantic version tag 기반 GHCR image publish, SBOM/provenance와 registry digest smoke
- SQLite migration/readiness 및 non-root persistent container 기반

### Security

- Project edit session, optimistic concurrency와 transaction 내부 authorization 재검증
- Workflow 최소 권한, immutable Action SHA와 base image digest 정책

## [0.1.0] - 2026-09-11

### Added

- Next.js, SQLite migration/repository, SVAR Core와 Project 생성·직접 Readonly 기반
- Project edit password/session lifecycle
- Working Calendar와 Leaf/Milestone Scheduling Engine 기반
