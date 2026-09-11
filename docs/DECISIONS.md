# Manager decisions

최초 작성: 2026-09-10. 최종 갱신: 2026-09-12. 각 판단은 사용자 Confirmed 요구와 구현을 위한 Assumption을 구분한다. 이번 결과는 설계 승인 기준선이며 제품 release 승인이 아니다.

| ID | 판단 | 내용 | 근거 / 후속 |
| --- | --- | --- | --- |
| ADR01 | ACCEPT | Main thread가 Root Manager, 파일 소유권별 전문 Agent 위임 | 사용자 명시; 별도 Manager Sub-Agent 없음 |
| ADR02 | ACCEPT | Next.js Node application + Service/Repository + SQLite 단일 instance | [Architecture](ARCHITECTURE.md), [DB](DB_SCHEMA.md); Prisma 금지 |
| ADR03 | ACCEPT | SVAR Core renderer/editor, 독립 Scheduling Domain | [Research](RESEARCH.md), [Matrix](PRO_FEATURE_MATRIX.md) |
| ADR04 | ACCEPT | Date-only, inclusive end, working-day duration; requested/effective start 분리 | [Scheduling](SCHEDULING_ENGINE.md); exact rules는 초기 Assumption |
| ADR05 | ACCEPT | FS/0 leaf endpoints만 초기 지원, Manual 충돌 atomic reject | Summary endpoint와 미래 관계는 명시적 미지원 |
| ADR06 | ACCEPT | Summary 파생 값·WBS 계산, empty summary 없는 최종 snapshot | Summary+자식 생성·재배치는 atomic batch API |
| ADR07 | ACCEPT | Stable UUID public ID; Project-bound hashed edit sessions, scrypt password | [Security](SECURITY.md); cost/TTL는 benchmark·정책으로 조정 |
| ADR08 | ACCEPT | Aggregate revision/If-Match와 whole import transaction | stale preview/write가 기존 일정을 덮어쓰지 못함 |
| ADR09 | ACCEPT | Import v1 self-contained create-only, metadata informational | merge/update/delete는 암묵적 scope에 포함 안 함 |
| ADR10 | ACCEPT | CSV one Task/record + predecessors JSON cell, UTF-8/RFC4180 | Backend/Excel 공동 검토, [Import Schema](IMPORT_SCHEMA.md) |
| ADR11 | ACCEPT | Backend ExcelJS Phase 1 table+hyperlink, Phase 2 cell Gantt | Excel/VBA는 원본 추출 담당, Web XLSX는 Backend |
| ADR12 | ACCEPT | Native builder/runtime 일치, non-root persistent volume, backup rehearsal | [Deployment](DEPLOYMENT.md) |
| ADR13 | REWORK → ACCEPT | DB progress INTEGER와 fractional summary의 충돌을 REAL로 정렬 | Backend 수정·VBA 정렬 후 독립 Planning QA PASS |
| ADR14 | REWORK → ACCEPT | 단일 Task API로 empty-summary 정책 충족 불가: atomic hierarchy batch 보완 | API와 테스트에 create/reparent/delete 최종 snapshot 사례 추가 |
| ADR15 | DEFER | 실제 Excel/VBA POC 결과·운영 공개 범위·운영 host 값 | [REQUIREMENTS](REQUIREMENTS.md)의 D01–D03; 문서 계획은 진행 가능 |
| ADR16 | REJECT | DRM 우회, 유료 PRO 내부 구현 복제, UI-only 권한, silent partial import | 사용자 명시 금지·요구 위반 |
| ADR17 | DEFER | 후속 scheduling/merge import/Project deletion/HTTP VBA | 요구·정책·복구 의미 확정 후 별도 issue |
| ADR18 | ACCEPT | Unicode externalId는 업무 참조, 별도 Task UUID는 CRUD URL | Backend 제안 반영, Excel 원본 ID를 ASCII로 재매핑하지 않음; 독립 Planning QA PASS |
| ADR19 | ACCEPT | Summary mode auto, Preview non-mutating, password 변경 호출자 session rotate | 초기 qa_docs 발견 사항 반영, [QA 기록](BOOTSTRAP_REVIEW.md) |
| ADR20 | ACCEPT | 전체 통합의 최종 독립 Planning QA와 W01 진입 Gate | qa_docs 재시도 PASS, Manager ACCEPT; 문서 sync는 제품 release 승인이 아님 |
| ADR21 | ACCEPT | W02 parent composite FK는 `NO ACTION DEFERRABLE INITIALLY DEFERRED` | 기존 즉시 RESTRICT는 Project cascade와 충돌. 단독 parent 삭제와 cross-project parent는 commit 시 거부하고 전체 aggregate cascade는 허용; Project 삭제 API는 여전히 후속 범위 |
| ADR22 | ACCEPT | W02 migration 파일 로딩 후 ledger 검증·미적용 SQL·ledger 기록을 단일 `BEGIN IMMEDIATE`로 처리 | 수정 checksum, 파일 누락, 이력 중간 누락은 시작 실패. 실행 CLI와 lazy server DB 진입점을 공유하고 DB를 build 시 열지 않음 |
| ADR23 | ACCEPT | W03은 `@svar-ui/react-gantt` 2.7.3 Core만 exact direct dependency로 사용 | MIT와 React `>=18` peer를 확인. transitive data provider를 직접 import하지 않고 PRO·REST·scheduling API를 연결하지 않음 |
| ADR24 | ACCEPT WITH REVALIDATION | Domain inclusive date-only end를 widget의 추론된 exclusive local `Date` end로 단일 Adapter에서 변환 | 공식 REST 예제와 round-trip/timezone unit 근거. 명시적 vendor 보장이 아니므로 실제 pointer drag/resize와 서버 저장을 W07에서 재검증 |
| ADR25 | ACCEPT | W04 생성은 Project+password derived material+최초 edit session digest를 원자 저장하고 Cookie를 발급 | 기존 API/DB/Security 계약을 지킴. scrypt는 transaction 밖에서 비동기 실행; session 검증·unlock/logout/rotation과 mutation authorization는 W05 |
| ADR26 | ACCEPT | D02 결정 전 Project collection GET은 405, 홈은 DB discovery를 수행하지 않으며 direct GET은 항상 Readonly | 개발용 create/direct route 구현은 production 공개 승인이 아님. 실데이터 노출 전 조직의 read/create 경계 결정 |
| ADR27 | ACCEPT | Project public ID는 canonical lowercase UUID v4, 생성 입력은 Zod 4.6.2 strict schema | name만 trim, description/password 원문 보존; unknown field·malformed Unicode·길이/byte 경계 거부 |
| ADR28 | ACCEPT WITH REVALIDATION | W04 create abuse limiter는 forwarded IP를 신뢰하지 않는 process-global 5회/1시간 fail-closed 방식 | D03 전에는 신뢰 가능한 peer가 없음. 정상 caller가 한도를 공유하고 restart 시 초기화되므로 production proxy/persistent limit와 KDF benchmark는 W16에서 재검증 |
| ADR29 | ACCEPT | Playwright는 port 3100, `.next-e2e`, `.data/playwright.sqlite3`로 개발 서버와 분리 | 병렬 개발 서버의 `.next` lock/DB 충돌을 피하고 E2E 자체 server의 `APP_BASE_URL`을 exact origin에 맞춤 |
| ADR30 | ACCEPT | W04 Project Create and Direct Read 완료 | qa_docs 독립 실행·대조 PASS, Manager ACCEPT. W05 session 소비/authorization와 production D02/D03 gate를 완료로 오인하지 않음; [W04 검증](W04_REVIEW.md) |
| ADR31 | ACCEPT | W05는 root `Path=/` 단일 edit Cookie를 유지하고 마지막으로 unlock한 Project 하나만 browser edit 상태로 둠 | 다른 Project의 유효 Cookie로 logout을 호출하면 해당 session을 revoke하거나 Cookie를 지우지 않는다. 다중 Project 동시 edit 요구가 생기면 cookie strategy를 별도 재설계 |
| ADR32 | ACCEPT WITH REVALIDATION | W05 unlock limiter는 untrusted forwarded IP 없이 process-global 50회/15분 + canonical Project별 10회/15분, bounded 1,024 key로 fail closed | process restart와 여러 정상 caller 공유 한계가 있으므로 D03/W16에서 trusted proxy·persistent limiter·KDF benchmark를 재검증 |
| ADR33 | ACCEPT | W05 authorization 증거는 session endpoint만이 아니라 `PATCH /api/projects/{publicId}` 대표 보호 mutation과 route security inventory를 포함 | AUTH07 Task와 AUTH09–10 Import slice는 W07/W12 전까지 BLOCKED/NOT TESTED로 유지하며 W05 전체 AUTH01–12 PASS로 과대 표시하지 않음 |
| ADR34 | ACCEPT | W05 Readonly and Edit Authorization 완료 | 최초 독립 QA finding 3건(lock 후 expiry 판정, 유효 wrong-project session만 Cookie 보존, canonical protected public ID)을 수정하고 Backend/Security·Frontend/Browser QA PASS, Manager ACCEPT; [W05 검증](W05_REVIEW.md) |
| ADR35 | ACCEPT | Playwright 기본 개발 server는 격리 Turbopack·worker 1개를 사용 | Webpack 개발 cache의 transient manifest race와 병렬 spec의 의도한 process-global create limit 공유를 재현했다. 기본 suite는 직렬화하되 동일 revision 동시 PATCH는 spec 내부 병렬 HTTP로 유지하고 production build의 Webpack 설정은 유지 |
| ADR36 | ACCEPT | W06 date-only는 자체 Gregorian ordinal과 `1900-01-01..2199-12-31` 절대 범위를 사용 | ECMAScript Date/instant/timezone 의존을 피하고 API·DB 상한과 정렬. 전체 109,573일 왕복·요일 oracle과 여러 TZ에서 검증 |
| ADR37 | ACCEPT | W06은 exact `Asia/Seoul`/`[6,0]`, 중복 Holiday 거부·nullable name 보존, Task `1..10000`, calendar-only Leaf/Milestone까지만 구현 | Task 저장은 W07, Summary/WBS는 W08, FS·Calendar 변경 Manual aggregate conflict는 W09로 분리 |
| ADR38 | ACCEPT | W06 Working Calendar and Duration 완료 | QA의 SSR-only runtime probe와 nullable Holiday 불일치를 수정하고 raw SSR pending→hydrated browser 계산, Domain 135/135·전체 226/226·Chromium 7/7 PASS; [W06 검증](W06_REVIEW.md) |
| ADR39 | ACCEPT | W07은 root Leaf Task/Milestone CRUD와 Link Repository foundation만 공개 | body32KiB, name1..200, externalId1..128, immutable ID/type/parent/order, root append. Summary/Hierarchy/WBS는 W08, Link Route·incident 삭제·FS는 W09. 기존 hierarchy/Link aggregate는 `UNSUPPORTED_SCHEDULE_STRUCTURE`로 fail closed |
| ADR40 | ACCEPT | W07 Task and Link Persistence 완료 | Project-scoped session/revision `BEGIN IMMEDIATE`, W06 Leaf 계산, canonical snapshot, 직접 SVAR command adapter와 실패 시 확정 snapshot 복원. 전체 291 Vitest와 clean Chromium 8/8 PASS; [W07 검증](W07_REVIEW.md) |
| ADR41 | ACCEPT | Application version SOT는 `package.json`, release authority는 exact annotated `v<version>` tag | package-lock과 strict SemVer를 자동 검사하며 CI가 임의 bump/tag를 만들지 않음; [CI/CD](CI_CD.md) |
| ADR42 | ACCEPT | PR/main 검증과 GHCR publish workflow를 분리하고 release tag에서도 전체 gate 후 publish | PR은 `contents: read`; publish만 job-scoped `GITHUB_TOKEN`의 최소 package/attestation 권한. Action full SHA와 base image digest pin |
| ADR43 | ACCEPT | Stable은 exact/major/minor/latest/commit tag, prerelease는 exact/commit tag만 게시 | Test/deployment는 mutable alias가 아니라 exact version 또는 digest 사용; 초기 platform은 `linux/amd64` |
| ADR44 | ACCEPT / SUPERSEDED IN PART BY ADR49 | W20이 W16의 최소 image/readiness/persistence 기반을 선행하되 production 배포 승인은 분리 | 당시 remote Actions/GHCR는 credential rotation과 D04 전 BLOCKED였다. 이후 D04 결정과 credential 위험 수용 상태는 ADR49가 대체하며, 실제 host CPU/storage/proxy/TLS/backup/restore는 계속 W16 범위 |
| ADR45 | ACCEPT / ATTESTATION CONDITION CLARIFIED BY ADR51 | Release를 repository 단위 직렬화하고 이전 tag보다 큰 SemVer만 허용; SHA candidate digest smoke와, 활성화된 경우 GitHub Attestation 후 rolling alias와 exact를 승격 | 병렬 낮은 version의 alias rollback과 runtime 실패 image의 exact version 선게시를 방지; exact는 완료 표식으로 마지막 생성. Private Attestation plan 조건은 ADR51을 따름 |
| ADR46 | ACCEPT | Container startup과 readiness가 production DB path뿐 아니라 canonical HTTPS `APP_BASE_URL`도 fail-closed 검증 | invalid config는 migration 전 exit 1, readiness는 DB를 열거나 생성하기 전 sanitized 503 |
| ADR47 | ACCEPT | W20 로컬 CI/CD와 Semantic Container Release 기반 완료 | 독립 QA가 309 Vitest·Chromium 8/8·build/static/container를 재검증해 PASS 권고; 원격 Actions/GHCR는 별도 NOT TESTED/BLOCKED, [W20 검증](W20_REVIEW.md) |
| ADR48 | ACCEPT | Project route는 single SVAR Core의 `displayMode="all"` Grid+Chart 작업공간과 viewport 기반 layout을 기본으로 사용 | native Add column은 보호 mutation 계약 때문에 제외하고 기존 form→Task API→canonical snapshot을 유지. supplied hierarchy는 `parent/open` adapter로 표시하며 Summary/reparent 저장은 W08, [W21 검증](W21_REVIEW.md) |
| ADR49 | ACCEPT WITH EXPLICIT RISK / W22 STATUS SUPERSEDES AUTH BLOCK | D04는 GHCR private, consumer 최소 `packages: read`, `main` 필수 CI, PR 필수 승인 0명, `v*` tag update/delete 금지와 지정 maintainer release로 확정 | 사용자는 과거 도구 출력에 노출된 repository credential을 교체하지 않고 재사용하기로 결정했다. 이는 안전 판정이 아닌 잔여 위험 수용이다. 당시 usable 인증이 없었으나 W22에서 admin 인증은 성공했고, ruleset의 plan 제한과 실제 Actions/GHCR 증거는 ADR51/W22 상태로 추적한다 |
| ADR50 | ACCEPT | 성공한 `main` commit마다 immutable `ci-<full SHA>` test image를 게시하고 SemVer release의 `sha-<full SHA>` tag 공간과 분리 | PR/수동 CI는 read-only; main publish는 quality/E2E/container gate 뒤 실행하며 commit/release 모두 registry digest를 다시 pull해 Project/Task authorization과 restart persistence까지 검증 |
| ADR51 | DECISION REQUIRED | Private repository의 branch/tag ruleset과 GitHub Artifact Attestation 지원 Plan | 현재 admin 인증은 성공했지만 ruleset API는 요금제 제한 403. Private ruleset은 Pro/Team/Enterprise, private Artifact Attestation은 Enterprise Cloud가 필요하므로 D05 사용자 선택 전 미강제 상태를 수용했다고 표시하지 않음 |

## Integration 원칙

Agent 초안은 바로 완료로 처리하지 않는다. Manager는 공동 계약의 날짜·진척·ID·CSV·오류·revision을 정렬하고 QA가 다시 비교한다. [BOOTSTRAP_REVIEW.md](BOOTSTRAP_REVIEW.md)에 발견 사항, 보완, 최종 판정을 기록한다.

설정 경로 문제는 원격 commit `81725bd`에서 해결되었다. `.codex` 설정 자체는 수정하지 않았고, 지원 model/effort 요청값과 실제 sandbox 검증의 한계를 [AGENT_CONFIGURATION.md](AGENT_CONFIGURATION.md)에 기록했다.

## 구현 시작과 사용자 판단

W01–W07 기반과 Project 생성·Direct Readonly·edit authorization·Calendar/Leaf Scheduling·root Task persistence vertical slice를 구현했다. 사용자 요청에 따라 W20 CI/CD와 Semantic Container Release를 W08보다 먼저 진행하고 완료 후 W08 Hierarchy Summary and WBS로 복귀한다. 비용·데이터 손실·조직 정책·대규모 Architecture/Workflow 변경이 생기면 해당 작업 전에 판단을 요청한다. 아직 실제 Workbook이나 운영 환경을 시험하지 않았으므로 이를 이유로 다른 독립 기반 작업을 막지 않는다.
