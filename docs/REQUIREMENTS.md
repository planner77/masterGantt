# Requirements baseline

상태: 요구사항 기준선, 2026-09-12 갱신. W01–W07, W20과 W21의 로컬 구현 상태는 [실행 계획](exec-plans/active/PLAN.md)과 개별 검증 기록을 함께 본다. D04 정책 결정은 완료됐고 원격 Actions/GHCR는 인증과 실제 Repository 설정 적용 전까지 NOT TESTED/BLOCKED다. 최상위 근거는 사용자 지침과 [AGENTS.md](../AGENTS.md)다.

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

R05의 Project 생성은 아직 해당 Project/session이 없으므로 선행 edit session을 요구할 수 없다. 생성에 별도의 same-origin·rate-limit 경계를 적용하고 생성 Project의 session만 발급하는 것은 요구 충돌이 아닌 bootstrap 예외다.

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

## Decision Required

이 항목들은 Planning 진행을 막지 않는다. 해당 환경 검증·실배포 전에 담당자가 확인해야 한다.

| ID | 사용자/조직 판단 | 필요한 시점 | 미확정 상태의 처리 |
| --- | --- | --- | --- |
| D01 | 대상 Workbook에서 VBA 실행·셀 읽기·파일 Export가 허용되는지, 승인된 저장 위치 | 실제 VBA POC 전 | UNKNOWN; 실제 파일·정책을 추정하거나 DRM 우회하지 않음 |
| D02 | Project 목록과 읽기/생성 서비스의 공개 범위: 사내 접근 경계 또는 공개 directory | 실데이터 사용·외부 노출 전 | local fixture UI 설계 가능; production discovery는 비활성 |
| D03 | 운영 Host OS/CPU, volume 경로/owner, 도메인/TLS와 backup 보관 위치·정책 | 배포 검증 전 | 문서의 단일 container 후보로 계획, 운영값 생성 안 함 |
| D04 | GHCR private, downstream consumer 최소 `packages: read`, `main` 필수 CI, PR 필수 승인 0명, `v*` update/delete 금지, 지정 maintainer release | 2026-09-12 사용자 결정 | DECIDED; 원격 설정 적용·검증은 인증 미구성으로 NOT TESTED/BLOCKED |

유료 License 선택은 계획에 없다. 실제 요구가 생기면 구매 전에 별도 판단한다. Password reset/admin 계정, Project 삭제/복원, merge Import, HTTP VBA 전송은 자동으로 초기 범위에 추가하지 않는다.

W04/W05는 개발용 생성, direct-link Readonly, password unlock과 Project metadata 보호 변경을 구현했지만 D02의 production 노출 결정을 대신하지 않는다. 목록 discovery는 `GET /api/projects`를 `405`로 유지하고 홈도 DB 목록을 조회하지 않는다. Direct read/create를 실데이터에 외부 노출하기 전에는 조직 접근 경계와 Readonly 데이터의 기밀성 요구를 결정해야 한다.

## 충돌·누락 분석

- 초기 `.condex/` 경로와 지침 `.codex/`의 불일치는 원격 commit `81725bd`에서 해결되었다. [설정 검증](AGENT_CONFIGURATION.md) 참조.
- `AGENTS.md`가 가리키는 `docs/`는 원래 존재하지 않았다. 상충하는 기존 상세 구현은 없으며 이번 문서가 첫 초안이다.
- Core가 SS/FF/SF link를 표시할 수 있어도 초기 Domain 지원은 FS뿐이다. 이는 범위 차이며 UI에서 미지원 생성 방지를 해야 한다.
- Project List 요구는 유지한다. 인증 없는 전체 목록의 노출 범위는 D02이며, 이를 임의로 공개하거나 List 요구를 삭제하지 않는다.
- 대상 Excel에 안정 ID가 없을 수 있다. 승인된 ID 보존 방법이 확인될 때까지 행 번호를 장기 ID로 확정하지 않는다.
- W01–W07 application source와 초기 migration, Project edit authorization, pure Calendar/Leaf Scheduling, root Task/Milestone Gantt 저장은 구현되었다. W21은 이 저장 경계를 유지하면서 full-width Grid+Chart 작업공간과 생성 직후 표시 회귀를 보완한다. W20은 CI와 최소 container artifact 기반을 선행하지만 production host/backup/restore를 포함한 W16 전체 배포 승인을 대신하지 않는다. VBA macro, Summary/WBS·FS 재계산, Import/Export도 후속 산출물이다.
