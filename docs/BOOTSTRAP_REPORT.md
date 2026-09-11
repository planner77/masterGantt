# Initial Bootstrap Report

## Completed

Repository와 7개 Agent 정의를 점검하고 요구사항, Architecture, DB/API/Security, Scheduling, Import 계약, VBA POC, Docker, 테스트 전략, W01–W19 issue 초안과 실행 계획을 작성했다. 이후 W01 Project Foundation으로 Next.js shell, liveness endpoint, test/build 설정을 구현했다. Application migration/VBA macro/Docker image 구현은 아직 남아 있다. 최종 검토 상태는 [QA 기록](BOOTSTRAP_REVIEW.md)을 따른다.

## Research Findings

SVAR Core의 표현·편집과 독립 Scheduling 계산 경계를 확인했다. 공식 Next.js client integration과 Native SQLite의 서버 전용 실행, ExcelJS workbook 생성, Microsoft VBA/date/encoding 제약을 조사했다. 버전의 Repository HEAD·package 배포·실제 설치 여부를 구분하며 설치 호환 검증은 후속이다. [Research와 공식 근거](RESEARCH.md)

## Confirmed Requirements

Project별 Public ID/Direct URL, 기본 Readonly와 서버 Edit Session, SQLite/Prisma 금지, Core 우선과 PRO 비의존, 승인된 VBA→JSON/CSV, 원자적 Import, Web XLSX와 직접 링크, 단일 Docker instance·영속 volume이다. [R01–R25](REQUIREMENTS.md)

## Assumptions

Next.js Node/TypeScript, UUID, Asia/Seoul 토·일 휴무 calendar, date-only/inclusive end, 정수 working-day duration, FS/0, 요청·계산 날짜 분리, create-only Import, aggregate revision을 초기 설계로 채택했다. 세부 가정은 사용자 확정 사실과 분리했다. [Assumptions](REQUIREMENTS.md)

## Decision Required

실제 VBA POC 전에 대상 Workbook의 macro/cell/file export 허용과 저장 위치(D01), 실데이터 노출 전에 목록·read/create 접근 범위(D02), 배포 전에 host/CPU/domain/TLS/volume/backup 정책(D03)을 확인해야 한다. 유료 License 선택은 없다.

## Architecture

React/SVAR client→Node Route→Service→Repository→SQLite. Pure Scheduling Domain은 UI·DB와 독립이다. Service가 권한·revision·transaction을 조정하고 server snapshot을 최종 결과로 반환한다. [Architecture](ARCHITECTURE.md), [DB](DB_SCHEMA.md), [API](API.md), [Security](SECURITY.md)

## Multi-Agent Plan

researcher는 공식 조사, frontend는 UI/SVAR, backend는 DB/API/Auth/Import/XLSX, scheduler는 계산, excel_vba는 원본 추출, infra는 배포, qa_docs는 독립 검증이다. Main이 Manager를 맡고 공용 계약과 파일 소유권을 조정한다. 설정은 그대로 유지했으며 실제 런타임 적용 확인 범위를 명시했다. [설정 검증](AGENT_CONFIGURATION.md)

## Excel/VBA Plan

실제 승인 환경에서 VBA/cell/header/필요 열/날짜/진척/한글/JSON·CSV 저장과 작은 browser parser 읽기를 먼저 POC한다. 전체 Import 구현 뒤 full preview/commit을 추가 검증한다. 행 누락과 DRM 우회는 허용하지 않는다. JSON/CSV는 하나의 1.0 contract로 수렴한다. [VBA POC](VBA_EXPORT.md), [Import Contract](IMPORT_SCHEMA.md)

## Scheduling Plan

Calendar·duration→Task 저장→Summary/WBS atomic hierarchy→FS DAG 재계산 순으로 진행한다. Manual 충돌은 원자 거부, Auto 변경은 이유와 diff를 반환한다. SS/FF/SF·lag/lead·CPM/resource 등은 후속이다. [Scheduling](SCHEDULING_ENGINE.md), [기능 Matrix](PRO_FEATURE_MATRIX.md)

## Docker Plan

한 application container와 `/data` persistent SQLite volume, 일치하는 builder/runtime native platform, non-root 권한, live/ready, migration gate, off-host backup과 isolated restore를 계획했다. 실제 build/restart/restore는 아직 수행하지 않았다. [Deployment](DEPLOYMENT.md)

## GitHub Work Breakdown

Foundation→DB/SVAR→Project/Auth→Calendar/Task→Summary/FS→Excel POC/Contract→Import Service/UI/Exporter→XLSX Phase1→Docker/E2E→Phase2/후속 scheduling이다. POC와 full Import의 선행 조건을 분리했다. W번호는 로컬 issue 초안 식별자이며 실제 GitHub Issues를 생성하지 않았다. [Issue drafts](ISSUE_BREAKDOWN.md), [Execution Plan](exec-plans/active/PLAN.md)

## Verification

TOML parsing, 문서 존재/내부 링크, JSON/CSV 예제 구조·참조, whitespace, staged credential exclusion을 정적 검사했다. qa_docs 초기 검토의 mode/revision/CSV/진척/배포/작업 순서 finding을 보완했다. 초기 계획 시점에는 Application build/typecheck/tests가 NOT TESTED였고, W01에서 typecheck/lint/unit/webpack build와 liveness smoke를 PASS했다. DB/Auth/Gantt/Import/Export/Docker 동작은 아직 NOT TESTED다.

## Risks

실제 Excel/DRM 정책은 UNKNOWN이고 실환경 POC는 BLOCKED다. Native driver ABI·파일 권한·restore, SVAR end adapter, package version 조합, 실제 입력 크기 성능은 구현 때 검증한다. Public Direct URL은 읽기 인증 수단이 아니므로 조직 공개 범위 결정이 필요하다.

## Recommended First Implementation

W01 Foundation 이후 첫 vertical slice는 **Project 생성→SQLite 저장→새 browser Direct Readonly→password unlock→단일 Task 편집→reload 유지**다. Build/typecheck와 권한·격리·영속성 E2E까지 완료 기준으로 삼는다.
