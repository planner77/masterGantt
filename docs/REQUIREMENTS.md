# Requirements baseline

상태: 요구사항 기준선, 2026-09-14 UX 변경 포함. W01–W07, W20–W22의 구현 상태는 [실행 계획](exec-plans/active/PLAN.md)과 개별 검증 기록을 함께 본다. W22 main/PR/release Actions, commit/release digest의 원격·로컬 smoke와 SBOM/provenance 조회는 PASS했다. D05는 현재 private 요금제의 ruleset 미강제 위험 수용과 GitHub Artifact Attestation 비활성으로 결정됐다. 최상위 근거는 사용자 지침과 [AGENTS.md](../AGENTS.md)다.

Issue #9/#10/#11/#18/#21의 현재 UX·API 사용 경계·보충 테스트 계획은 [PROJECT_UX.md](PROJECT_UX.md)를 따른다. 과거 W24의 권한 기반 삭제 버튼 표시와 부모 전환 확인 창은 아래 R31/R32로 대체한다. 이번 변경의 원격 검증은 PR #23의 최종 head/run 기준이며 과거 Wxx PASS를 전용하지 않는다.

## Confirmed

| ID | 요구사항 | 상세 계약 / 검증 |
| --- | --- | --- |
| R01 | Project 생성: name, description, edit password | [API](API.md), [DB](DB_SCHEMA.md) |
| R02 | 내부 PK와 안정적인 public ID 분리; `/projects/{publicId}` | API, DB |
| R03 | Direct access 기본 Readonly; password 인증 후 Edit | [Security](SECURITY.md) |
| R04 | 검증된 password derivation; 원문 password/secret 저장·로그·URL 금지 | Security |
| R05 | 모든 기존 Project mutation에서 server-side project edit session 검증 | API, Security |
| R06 | SVAR React Gantt Core와 공식 API 우선, 구현 전 현재 공식 자료 확인 | [Research](RESEARCH.md), [기능 Matrix](PRO_FEATURE_MATRIX.md) |
| R07 | PRO 비공개 구현 복제 금지; 독립 Scheduling Domain | [Scheduling](SCHEDULING_ENGINE.md) |
| R08 | 초기 Calendar, weekend, holiday, duration, summary, FS 재계산, WBS | [Scheduling](SCHEDULING_ENGINE.md); Calendar/Leaf Duration은 W06, root 저장 연결은 W07 PASS, 나머지는 W08/W09 |
| R09 | SS/FF/SF, lag/lead, baseline, CPM/slack, grouping/resource, rollup/split는 후속 검토 | 기능 Matrix |
| R10 | SQLite, Prisma 금지, better-sqlite3 우선; Route→Service→Repository→DB | [Architecture](ARCHITECTURE.md), DB |
| R11 | SQL migration, parameter binding, FK와 index, 실제 DB Git 제외 | DB |
| R12 | DRM 우회 금지, 원본 Workbook 직접 웹 업로드·clipboard 가능 가정 금지 | [VBA](VBA_EXPORT.md) |
| R13 | 승인된 Excel/VBA→필요 데이터만→JSON 우선, CSV fallback | VBA, [Import Schema](IMPORT_SCHEMA.md) |
| R14 | 실제 Excel/VBA POC를 전체 Import 구현보다 먼저 수행; PASS/FAIL/BLOCKED/UNKNOWN | VBA |
| R15 | Header name mapping, stable externalId, parent/dependency, 날짜·진척·한글 정규화, 오류 행 보고 | VBA, Import Schema |
| R16 | `schemaVersion`; Backend/Excel 공동 계약, Manager 최종 책임 | Import Schema |
| R17 | Parsing→Validation→Preview→Mapping→Business validation→Import; 서버 재검증과 원자적 저장 | [Import/Export](IMPORT_EXPORT.md), API |
| R18 | Web XLSX export는 Backend, ExcelJS 우선 검토, PRO export 비의존 | Import/Export |
| R19 | Phase 1 Project/Tasks/Dependencies sheet와 APP_BASE_URL 기반 직접 hyperlink | Import/Export |
| R20 | Phase 2 날짜 cell 기반 별도 Gantt sheet; Phase 1 안정화 후 | Import/Export |
| R21 | Dockerfile/compose/.dockerignore/.env.example, 단일 instance, 영속 volume | [Deployment](DEPLOYMENT.md) |
| R22 | Native compatibility, health, permission, restart persistence 검증 | Deployment, [Test Plan](TEST_PLAN.md) |
| R23 | Root Manager 통합, 전문 Agent 필요 시 위임, 소유 파일 분리, 독립 QA | [실행 계획](exec-plans/active/PLAN.md) |
| R24 | 구현별 build/typecheck/tests/security/persistence/docs/QA/Manager review | Test Plan |
| R25 | Project List/Create/Gantt/Unlock/Import/Export UI, 명확한 loading/error 상태 | Architecture, API |
| R26 | 반복 build/typecheck/lint/unit·integration/browser/container 검증을 GitHub Actions로 자동화 | [CI/CD](CI_CD.md), [Test Plan](TEST_PLAN.md) |
| R27 | `package.json` 기준 Semantic Version과 일치하는 Git tag에서만 GHCR image 게시; exact version/digest로 테스트 가능 | CI/CD, [Deployment](DEPLOYMENT.md) |
| R28 | PR read-only, publish 최소 권한, Action SHA/base digest pin, pre-publish candidate, SBOM/provenance와 registry digest smoke 뒤 exact promotion | CI/CD, [Security](SECURITY.md) |
| R29 | Project 화면은 Demo 목록 없이 좌측 계층 Task Grid와 우측 동기 Gantt Chart를 단일 SVAR Core로 표시; 빈 일정과 생성 직후에도 양쪽을 유지하고 Desktop viewport 폭·높이를 활용하며 좁은 화면은 내부 scroll로 접근 | [Architecture](ARCHITECTURE.md), [Test Plan](TEST_PLAN.md) UI03–UI10 |
| R30 | 모든 품질 gate를 통과한 `main` commit은 immutable GHCR `ci-<full SHA>` test image로 게시하고, SemVer release의 `sha-<full SHA>`/exact/rolling tag와 분리; 두 경로 모두 게시 digest를 새로 pull해 image policy, readiness, Project/Task authorization 저장과 restart persistence를 검증 | [CI/CD](CI_CD.md), [Deployment](DEPLOYMENT.md), [Test Plan](TEST_PLAN.md) CI09–CI10 |
| R31 | Project 목록은 표/Grid이며 삭제 버튼은 항상 표시한다. 클릭 뒤 새 비밀번호 검증이 성공한 경우에만 기존 보호 DELETE를 호출한다 (#10). | 기존 유효 세션만으로 입력 절차를 생략하지 않는다. 최신 이름/revision 경고, If-Match·Origin·session과 종속 일정·session 원자 삭제 유지. [UX 계약](PROJECT_UX.md) |
| R32 | SVAR Grid Header `+`는 최상위, 행 `+`는 선택 행의 하위 작업 추가. 이름을 묻지 않고 `새 작업`으로 서버 인증·revision 검증 후 저장한다. 첫 하위 추가의 Summary 전환 확인 팝업도 생략한다 (#11). | 일반 leaf에는 `convertParentToSummary: true` 명시, 마일스톤 금지·서버 원자 검증·상위 집계 유지. [UX 계약](PROJECT_UX.md) |
| R33 | 외부 ID column 표시/숨김 선택, 작업 생성 시 시작일·기간을 묻지 않고 제출 시 오늘·1일 자동 적용, Chart 토/일 구분 | 오늘은 브라우저 local 날짜, Auto 근무일 보정 유지; Milestone은 기존 0일 계약. 후속 검증은 PENDING_TESTS.md |
| R34 | 날짜·시간 표시는 사용자 locale을 따르며 저장 date-only/UTC instant 계약은 변경하지 않음 | locale/TZ 경계 테스트; 날짜 문자열을 UTC instant로 파싱해 전날로 표시하지 않음 |
| R35 | Project 설정은 헤더 버튼으로 여는 별도 modal이다. 프로젝트명 아래 Revision/시간대/휴일/작업/연결 및 펼침 설정을 표시하지 않는다 (#9). | 기존 정보 저장·비밀번호 변경·편집 종료 유지. Project 및 Grid/Chart header와 내부 scroll, 설정 열기/닫기 geometry·인스턴스 검증 |
| R36 | Grid/Chart 상단의 별도 ‘작업 추가 또는 삭제’ 패널 제거; 생성은 native Grid `+` 사용 | 기존 패널의 Task 삭제 UI도 제거, 서버 삭제 API와 Project 목록 삭제는 유지. 후속 검증은 PENDING_TESTS.md |
| R37 | Grid Column Header 우클릭에서 표시할 데이터 열 선택; 외부 ID 기본 숨김, 별도 토글 버튼 제거 | 작업/외부 ID/시작/기간 대상, 마지막 데이터 열은 유지. `+`는 권한 기반 action. 선택은 workspace 내 유지하며 reload 시 기본값 |
| R38 | 정상 작업 추가의 대기·성공 동안 동일 Gantt 인스턴스와 기존 화면 상태 유지; 문서 navigation/전체 loading 및 action 열 너비 변화 방지 | [Issue #3](ISSUE_3_REVIEW.md). 서버 canonical snapshot·중복 요청 차단·명시적 오류 복구 유지; 성공 알림은 focus를 빼앗지 않음 |
| R39 | 정상 안내는 일시적 overlay Toast, 오류는 우측 상단 미확인 표시와 별도 복사 가능한 알림함으로 분리한다 (#18). | 오류는 성공/Toast 타이머로 삭제하지 않음. 공간·scroll·focus·Gantt 유지, locale 시각, 안전한 metadata만 허용. [UX 계약·보충 테스트 계획](PROJECT_UX.md) |
| R40 | 목록 각 행과 상세 헤더에서 Readonly도 프로젝트 링크를 복사할 수 있다 (#21). | 검증한 APP_BASE_URL과 publicId 기반 절대 URL. 이름 변경 후 유지, query/hash/secret 제외, 같은 세션 권한 유지/새 세션 Readonly, mutation 없음 |
| R41 | Clipboard 성공 확인 후에만 성공 안내를 한다. 거부·미지원이면 선택 가능한 읽기 전용 내용과 수동 복사/재시도를 제공한다 (#18/#21). | 클릭 기반 쓰기만 수행하며 앱은 clipboard 읽기 권한을 요청하지 않음. 오류·fallback·키보드·좁은 화면 검증. [UX 계약](PROJECT_UX.md) |

R05의 Project 생성은 아직 해당 Project/session이 없으므로 선행 edit session을 요구할 수 없다. 생성에 별도의 same-origin·rate-limit 경계를 적용하고 생성 Project의 session만 발급하는 것은 요구 충돌이 아닌 bootstrap 예외다.

W24의 하위 추가는 일반 Task→Summary 전환에 `convertParentToSummary: true`를 요구한다. Milestone에는 하위를 추가하지 않으며 빈 Summary를 만들지 않도록 마지막 자식 단독 삭제를 거부한다. Summary 자체의 drag/resize/직접 삭제, reparent와 FS 의존 재계산은 이번 UI 확장의 승인 범위가 아니다. 일반 하위 Leaf 변경은 조상 Summary를 다시 계산한다. #11은 서버 계약을 변경하지 않고 UI 확인 단계를 생략한다.

## Assumption

아래는 Manager가 변경 가능한 초기 설계로 채택한 가정이다. 기존 데이터가 없는 지금 문서에서 조정 가능하며 사용자 확정 사실로 표시하지 않는다.

| ID | 가정 | 근거 / 변경 영향 |
| --- | --- | --- |
| A01 | Next.js App Router + React + TypeScript, 단일 Node backend | AGENTS 권장 stack; exact versions는 설치 직전 검증 |
| A02 | Public ID는 lowercase UUID v4 | 예시 URL의 특정 ULID 길이는 강제 계약 아님 |
| A03 | 초기 Project Calendar는 Asia/Seoul, exact weekend `[6,0]`, 사용자 관리 holiday set | W06 구현·검증; 법정 공휴일 자동 추정 안 함 |
| A04 | 날짜는 Gregorian YYYY-MM-DD `1900-01-01..2199-12-31`, end 포함, 일반 Task duration `1..10000` 근무일 | W06 구현·검증; 시각 일정 후속 |
| A05 | `start` 입력과 effective start 분리; Auto 이동은 preview, Manual 충돌은 전체 거부 | 요청값 보존과 일정 재계산의 결정성 |
| A06 | 초기 dependency는 leaf task/milestone의 FS/0만; milestone도 다음 근무일 FS | 다른 type/lag를 버리지 않고 미지원 오류 |
| A07 | Import v1은 기존 Project에 self-contained batch create-only | 기존 데이터 자동 교체·삭제 금지; update merge 별도 설계 |
| A08 | Summary는 자식에서 계산, empty summary 거부; 생성·재배치는 atomic batch | UI/API가 유효 최종 tree를 한 번에 제출 |
| A09 | Project aggregate revision + If-Match로 stale write 거부 | 단일 인스턴스여도 여러 편집자 가능 |
| A10 | SQLite local volume + WAL; remote/network filesystem 사용 전 별도 검증 | [Deployment](DEPLOYMENT.md) |
| A11 | Import/export resource limits는 초기 측정으로 조정, 무제한 입력 금지 | [Import Schema](IMPORT_SCHEMA.md) 초기 제한 |
| A12 | Version SOT는 `package.json`, release authority는 동일 commit의 annotated `v<version>` tag; build metadata는 사용하지 않음 | 자동 version commit/tag 없이 review 가능한 release 경계 유지 |
| A13 | 초기 GHCR image platform은 `linux/amd64`; arm64는 native runtime 검증 뒤 추가 | 현재 검증 host와 `better-sqlite3` ABI 위험 |
| A14 | Toast 5초·최근 1건, 오류 최신순 최대 50건, 알림함 열기/열린 동안 도착 시 읽음 전환, workspace 메모리에만 보관 | 사용자 확정 숫자가 아닌 구현 UX 정책. 초과 제외 건수 표시·명시적 읽은 항목 삭제. [UX 계약](PROJECT_UX.md) |

## Decision Required

이 항목들은 Planning 진행을 막지 않는다. 해당 환경 검증·실배포 전에 담당자가 확인해야 한다.

| ID | 사용자/조직 판단 | 필요한 시점 | 미확정 상태의 처리 |
| --- | --- | --- | --- |
| D01 | 대상 Workbook에서 VBA 실행·셀 읽기·파일 Export가 허용되는지, 승인된 저장 위치 | 실제 VBA POC 전 | UNKNOWN; 실제 파일·정책을 추정하거나 DRM 우회하지 않음 |
| D02 | 앱 접속 가능한 모든 사용자에게 전체 Project 목록 공개, 편집은 Project별 비밀번호 인증 유지 | 2026-09-12 사용자 승인 | DECIDED; 인터넷 공개·네트워크 접근 경계는 별도 배포 결정 |
| D03 | 운영 Host OS/CPU, volume 경로/owner, 도메인/TLS와 backup 보관 위치·정책 | 배포 검증 전 | 문서의 단일 container 후보로 계획, 운영값 생성 안 함 |
| D04 | GHCR private, downstream consumer 최소 `packages: read`, `main` 필수 CI, PR 필수 승인 0명, `v*` update/delete 금지, 지정 maintainer release | 2026-09-12 사용자 결정 | DECIDED; W22 main/PR와 private GHCR commit/release artifact 원격 PASS. Ruleset 강제 가능 여부는 D05가 대체 |
| D05 | Private repository를 현재 요금제에 유지하고 branch/tag ruleset 미강제 위험을 수용; private GitHub Artifact Attestation은 비활성, BuildKit SBOM/provenance는 필수 | 2026-09-12 사용자 결정 | DECIDED / RISK ACCEPTED; ruleset API 403과 미강제를 숨기지 않으며 지정 maintainer·절차 통제를 유지 |

유료 License 선택은 계획에 없다. 실제 요구가 생기면 구매 전에 별도 판단한다. Password reset/admin 계정, Project 삭제/복원, merge Import, HTTP VBA 전송은 자동으로 초기 범위에 추가하지 않는다.

W23은 D02 승인에 따라 홈과 `GET /api/projects`에서 전체 Project 목록을 제공한다. 목록은 publicId/name/description/createdAt/updatedAt만 포함하며 최신 수정순으로 표시한다. 빈 목록과 조회 실패를 구분하고 생성 후 복귀·새로고침에서도 저장된 목록을 조회한다. 기존 direct-link Readonly와 모든 Mutation의 Project별 edit session 인증은 유지한다. 앱의 인터넷 공개 및 운영 네트워크 접근 경계는 별도 배포 결정이다.

## 충돌·누락 분석

- 초기 `.condex/` 경로와 지침 `.codex/`의 불일치는 원격 commit `81725bd`에서 해결되었다. [설정 검증](AGENT_CONFIGURATION.md) 참조.
- `AGENTS.md`가 가리키는 `docs/`는 원래 존재하지 않았다. 상충하는 기존 상세 구현은 없으며 이번 문서가 첫 초안이다.
- Core가 SS/FF/SF link를 표시할 수 있어도 초기 Domain 지원은 FS뿐이다. 이는 범위 차이며 UI에서 미지원 생성 방지를 해야 한다.
- Project List는 D02 승인 범위에서 앱 접속자 전체에게 제공한다. 목록 공개를 편집 권한 공개로 확대하지 않는다.
- 대상 Excel에 안정 ID가 없을 수 있다. 승인된 ID 보존 방법이 확인될 때까지 행 번호를 장기 ID로 확정하지 않는다.
- W01–W07 application source와 초기 migration, Project edit authorization, pure Calendar/Leaf Scheduling, root Task/Milestone Gantt 저장은 구현되었다. W21은 이 저장 경계를 유지하면서 full-width Grid+Chart 작업공간과 생성 직후 표시 회귀를 보완한다. W20은 CI와 최소 container artifact 기반을 선행하지만 production host/backup/restore를 포함한 W16 전체 배포 승인을 대신하지 않는다. VBA macro, Summary/WBS·FS 재계산, Import/Export도 후속 산출물이다.
- #18의 과거 부모 전환 확인 유지 조건은 함께 승인된 #11로 대체하며, 서버의 명시적 전환·인증·revision 계약은 유지한다.
