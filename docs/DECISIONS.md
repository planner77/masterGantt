# Manager decisions

날짜: 2026-09-10. 각 판단은 사용자 Confirmed 요구와 구현을 위한 Assumption을 구분한다. 이번 결과는 설계 승인 기준선이며 제품 release 승인이 아니다.

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

## Integration 원칙

Agent 초안은 바로 완료로 처리하지 않는다. Manager는 공동 계약의 날짜·진척·ID·CSV·오류·revision을 정렬하고 QA가 다시 비교한다. [BOOTSTRAP_REVIEW.md](BOOTSTRAP_REVIEW.md)에 발견 사항, 보완, 최종 판정을 기록한다.

설정 경로 문제는 원격 commit `81725bd`에서 해결되었다. `.codex` 설정 자체는 수정하지 않았고, 지원 model/effort 요청값과 실제 sandbox 검증의 한계를 [AGENT_CONFIGURATION.md](AGENT_CONFIGURATION.md)에 기록했다.

## 구현 시작과 사용자 판단

이번 turn의 산출물은 Bootstrap·Planning이다. 설계 QA를 통과하면 명확한 첫 vertical slice를 시작할 수 있다. 비용·데이터 손실·조직 정책·대규모 Architecture/Workflow 변경이 생기면 해당 작업 전에 판단을 요청한다. 아직 실제 Workbook이나 운영 환경을 시험하지 않았으므로 이를 이유로 다른 독립 기반 작업을 막지 않는다.
