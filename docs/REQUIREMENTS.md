# Requirements baseline

상태: Bootstrap·Planning 초안, 2026-09-10. 최상위 근거는 사용자 지침과 [AGENTS.md](../AGENTS.md)다. 이 문서는 구현 완료를 의미하지 않는다.

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
| R08 | 초기 Calendar, weekend, holiday, duration, summary, FS 재계산, WBS | Scheduling |
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

R05의 Project 생성은 아직 해당 Project/session이 없으므로 선행 edit session을 요구할 수 없다. 생성에 별도의 same-origin·rate-limit 경계를 적용하고 생성 Project의 session만 발급하는 것은 요구 충돌이 아닌 bootstrap 예외다.

## Assumption

아래는 Manager가 변경 가능한 초기 설계로 채택한 가정이다. 기존 데이터가 없는 지금 문서에서 조정 가능하며 사용자 확정 사실로 표시하지 않는다.

| ID | 가정 | 근거 / 변경 영향 |
| --- | --- | --- |
| A01 | Next.js App Router + React + TypeScript, 단일 Node backend | AGENTS 권장 stack; exact versions는 설치 직전 검증 |
| A02 | Public ID는 lowercase UUID v4 | 예시 URL의 특정 ULID 길이는 강제 계약 아님 |
| A03 | 초기 Project Calendar는 Asia/Seoul, 토·일 휴무, 사용자 관리 holiday set | 현재 사용자 환경; 법정 공휴일 자동 추정 안 함 |
| A04 | 날짜는 Gregorian YYYY-MM-DD, end 포함, duration 정수 근무일 | [Scheduling](SCHEDULING_ENGINE.md) 경계 예시; 시각 일정 후속 |
| A05 | `start` 입력과 effective start 분리; Auto 이동은 preview, Manual 충돌은 전체 거부 | 요청값 보존과 일정 재계산의 결정성 |
| A06 | 초기 dependency는 leaf task/milestone의 FS/0만; milestone도 다음 근무일 FS | 다른 type/lag를 버리지 않고 미지원 오류 |
| A07 | Import v1은 기존 Project에 self-contained batch create-only | 기존 데이터 자동 교체·삭제 금지; update merge 별도 설계 |
| A08 | Summary는 자식에서 계산, empty summary 거부; 생성·재배치는 atomic batch | UI/API가 유효 최종 tree를 한 번에 제출 |
| A09 | Project aggregate revision + If-Match로 stale write 거부 | 단일 인스턴스여도 여러 편집자 가능 |
| A10 | SQLite local volume + WAL; remote/network filesystem 사용 전 별도 검증 | [Deployment](DEPLOYMENT.md) |
| A11 | Import/export resource limits는 초기 측정으로 조정, 무제한 입력 금지 | [Import Schema](IMPORT_SCHEMA.md) 초기 제한 |

## Decision Required

이 항목들은 Planning 진행을 막지 않는다. 해당 환경 검증·실배포 전에 담당자가 확인해야 한다.

| ID | 사용자/조직 판단 | 필요한 시점 | 미확정 상태의 처리 |
| --- | --- | --- | --- |
| D01 | 대상 Workbook에서 VBA 실행·셀 읽기·파일 Export가 허용되는지, 승인된 저장 위치 | 실제 VBA POC 전 | UNKNOWN; 실제 파일·정책을 추정하거나 DRM 우회하지 않음 |
| D02 | Project 목록과 읽기/생성 서비스의 공개 범위: 사내 접근 경계 또는 공개 directory | 실데이터 사용·외부 노출 전 | local fixture UI 설계 가능; production discovery는 비활성 |
| D03 | 운영 Host OS/CPU, volume 경로/owner, 도메인/TLS와 backup 보관 위치·정책 | 배포 검증 전 | 문서의 단일 container 후보로 계획, 운영값 생성 안 함 |

유료 License 선택은 계획에 없다. 실제 요구가 생기면 구매 전에 별도 판단한다. Password reset/admin 계정, Project 삭제/복원, merge Import, HTTP VBA 전송은 자동으로 초기 범위에 추가하지 않는다.

## 충돌·누락 분석

- 초기 `.condex/` 경로와 지침 `.codex/`의 불일치는 원격 commit `81725bd`에서 해결되었다. [설정 검증](AGENT_CONFIGURATION.md) 참조.
- `AGENTS.md`가 가리키는 `docs/`는 원래 존재하지 않았다. 상충하는 기존 상세 구현은 없으며 이번 문서가 첫 초안이다.
- Core가 SS/FF/SF link를 표시할 수 있어도 초기 Domain 지원은 FS뿐이다. 이는 범위 차이며 UI에서 미지원 생성 방지를 해야 한다.
- Project List 요구는 유지한다. 인증 없는 전체 목록의 노출 범위는 D02이며, 이를 임의로 공개하거나 List 요구를 삭제하지 않는다.
- 대상 Excel에 안정 ID가 없을 수 있다. 승인된 ID 보존 방법이 확인될 때까지 행 번호를 장기 ID로 확정하지 않는다.
- 사용자가 요청한 이번 결과는 Bootstrap·Planning이다. 실제 application source, migration, Docker image, VBA macro는 후속 구현 산출물이다.
