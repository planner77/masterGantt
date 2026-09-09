# AGENTS.md

## Project

이 Repository는 SVAR React Gantt 기반의 소규모 Project Gantt Management System이다.

Project별 일정을 작성, 편집, Import, Export 및 조회할 수 있어야 한다.

Project는 직접 접근 가능한 고유 URL을 가진다.

기본 조회 상태는 Readonly이며 Project별 Edit Password 인증에 성공한 경우에만 편집할 수 있다.

## Primary Requirements

* Project 생성 및 관리
* Project별 Gantt
* Project Direct Link
* SVAR React Gantt Core 사용
* Project Edit Password
* 기본 Readonly
* Password 인증 후 Edit Mode
* SQLite
* Prisma 사용 금지
* VBA 기반 Excel Schedule JSON Export/Import
* JSON/CSV Import
* Excel Export
* Excel Project Hyperlink
* Excel Gantt Sheet
* Docker Deployment

## SVAR Policy

SVAR React Gantt는 Gantt UI와 Interactive Editing Layer로 사용한다.

SVAR Core 기능이 있는 경우 독자 구현보다 공식 기능을 우선 사용한다.

SVAR PRO 기능은 PRO 코드나 내부 구현에 의존하지 않는다.

Project에서 필요한 PRO 성격의 기능은 공개된 프로젝트 관리 원리와 프로젝트 요구사항을 기반으로 독립 구현한다.

해당 기능은 가능한 한 SVAR와 분리된 Scheduling Engine에 구현한다.

공식 자료:

https://docs.svar.dev/react/gantt/

https://github.com/svar-widgets/react-gantt

## Architecture

기본 Application 흐름:

UI
→ API
→ Service
→ Repository
→ SQLite

Scheduling은 별도 Domain Layer로 분리한다.

UI
↔ Scheduling Engine
↔ Domain Model
↔ Persistence

Route Handler에서 SQL 또는 복잡한 Business Logic을 직접 구현하지 않는다.

## Scheduling Engine

Scheduling Engine은 SVAR에 종속되지 않는 것을 원칙으로 한다.

대상 기능:

* Working Calendar
* Weekend
* Holiday
* Duration
* Summary Task
* Dependency
* FS
* SS
* FF
* SF
* Lag/Lead
* Auto Scheduling
* WBS
* Baseline
* Critical Path
* Slack
* Grouping
* Resource Scheduling

상세 설계는 다음을 참조한다.

`docs/SCHEDULING_ENGINE.md`

SVAR PRO 기능 대응 현황:

`docs/PRO_FEATURE_MATRIX.md`

## Database

SQLite를 사용한다.

Prisma를 사용하지 않는다.

SQLite Driver는 better-sqlite3를 우선 사용한다.

Project에는 내부 PK와 별도의 외부 Public ID를 둔다.

Public ID는 Project Direct URL에 사용한다.

상세 Schema:

`docs/DB_SCHEMA.md`

## Project Authorization

Project Direct URL에는 Password 또는 Session Secret을 포함하지 않는다.

Project 접근은 기본 Readonly이다.

Edit Password 인증에 성공해야 Mutation이 가능하다.

Password 원문을 저장하거나 로그에 기록하지 않는다.

Task, Link 및 Project Mutation API에서도 Edit Session을 검증한다.

관련 정책:

`docs/SECURITY.md`

## Excel Import

DRM 해제 또는 우회 기능을 구현하지 않는다.

Clipboard Paste를 필수 전제로 하지 않는다.

우선 Import 경로:

1. VBA → JSON
2. VBA → CSV
3. 조직 정책이 허용하면 VBA → HTTP API
4. Manual Import Grid

VBA는 필요한 Column만 추출하도록 한다.

Excel Column Letter 또는 Column Number에 강하게 의존하지 않는다.

Header Mapping을 사용한다.

JSON에는 schemaVersion을 포함한다.

Task 관계 연결에는 가능한 한 externalId를 사용한다.

Import 전에 다음 단계를 수행한다.

Parsing
→ Schema Validation
→ Preview
→ Mapping
→ Business Validation
→ Import

관련 문서:

`docs/IMPORT_EXPORT.md`

`docs/IMPORT_SCHEMA.md`

`docs/VBA_EXPORT.md`

## Excel Export

Excel Export는 SVAR PRO에 의존하지 않는다.

### Phase 1

표 형태 Workbook.

최소 Sheet:

* Project
* Tasks
* Dependencies

Project Direct Link를 Hyperlink로 포함한다.

### Phase 2

Gantt Sheet를 생성한다.

날짜별 Column과 Cell 표현을 이용하여 막대형 Gantt를 우선 구현한다.

Project URL은 다음 기준으로 생성한다.

APP_BASE_URL + /projects/ + project.public_id

## Docker

Docker Deployment를 지원한다.

필수 파일:

* Dockerfile
* docker-compose.yml
* .dockerignore
* .env.example

SQLite Database는 Persistent Volume에 저장한다.

SQLite 사용 단계에서는 Single Application Instance를 기본으로 한다.

배포 관련 상세 내용:

`docs/DEPLOYMENT.md`

## Documentation

AGENTS.md는 상세 Specification이 아니다.

이 파일은 프로젝트의 핵심 원칙과 관련 Source of Truth를 안내하는 Project Map이다.

상세 문서는 다음에 둔다.

### Requirements

`docs/REQUIREMENTS.md`

### Architecture

`docs/ARCHITECTURE.md`

### Database

`docs/DB_SCHEMA.md`

### API

`docs/API.md`

### Scheduling Engine

`docs/SCHEDULING_ENGINE.md`

### SVAR PRO Replacement Matrix

`docs/PRO_FEATURE_MATRIX.md`

### Import / Export

`docs/IMPORT_EXPORT.md`

### Import JSON Schema

`docs/IMPORT_SCHEMA.md`

### VBA Export

`docs/VBA_EXPORT.md`

### Security

`docs/SECURITY.md`

### Deployment

`docs/DEPLOYMENT.md`

### Test Plan

`docs/TEST_PLAN.md`

### Architecture Decisions

`docs/DECISIONS.md`

### Research

`docs/RESEARCH.md`

### Current Execution Plan

`docs/exec-plans/active/PLAN.md`

완료된 Plan:

`docs/exec-plans/completed/`

## Multi-Agent Model

Main Codex Thread는 Manager 역할을 수행한다.

Project Custom Agents:

* researcher
* frontend
* backend
* scheduler
* infra
* qa_docs

### Manager

책임:

* Requirements
* Architecture
* Planning
* Task decomposition
* Agent orchestration
* Decision
* Integration
* Final review

Manager는 모든 코드를 직접 작성하려 하지 않는다.

독립적인 작업을 Sub-Agent에게 위임하여 품질 또는 속도가 개선될 경우 적극적으로 활용한다.

### Researcher

책임:

* 공식 문서 조사
* GitHub 조사
* 기술 검증
* 제약사항 확인
* 기술 선택 근거 수집

Researcher는 Architecture를 결정하지 않는다.

### Frontend

책임:

* SVAR
* React
* Next.js UI
* Project UI
* Import UI
* Readonly/Edit UI

### Backend

책임:

* SQLite
* Migration
* Repository
* API
* Authentication
* Import
* Export

### Scheduler

책임:

* Scheduling Domain
* Calendar
* Dependency
* Auto Scheduling
* Critical Path 등

### Infra

책임:

* Docker
* Compose
* Environment
* Persistence
* Deployment

### QA/Docs

책임:

* Requirement Verification
* Test
* Regression
* Security Review
* Documentation Consistency

## Collaboration Rules

읽기 중심 작업은 병렬화하는 것을 권장한다.

여러 Agent가 동일 파일을 동시에 수정하지 않는다.

병렬 Write 작업이 필요한 경우 Manager가 담당 File/Directory를 먼저 분리한다.

Architecture 또는 공용 Interface 변경은 Manager가 조정한다.

DB 변경 시 Migration과 DB_SCHEMA.md를 함께 변경한다.

API 변경 시 API.md를 함께 변경한다.

Scheduling Algorithm 변경 시 SCHEDULING_ENGINE.md를 함께 변경한다.

Import Schema 변경 시 IMPORT_SCHEMA.md와 VBA_EXPORT.md의 호환성을 함께 검토한다.

Docker 변경 시 DEPLOYMENT.md를 함께 변경한다.

## GitHub Workflow

구현 가능한 작업은 가능한 한 GitHub Issue 단위로 관리한다.

Issue에는 다음을 포함한다.

* Goal
* Background
* Scope
* Acceptance Criteria
* Assigned Agent
* Related Documentation

독립 Feature는 Branch 또는 Worktree 사용을 우선한다.

PR에는 다음을 포함한다.

* Summary
* Related Issue
* Changes
* Verification
* Screenshots when UI changed
* Documentation Updated
* Remaining Risks

## Research Rules

불확실하거나 버전 의존적인 기술 사항은 추측하지 않는다.

공식 Documentation 및 공식 Repository를 우선 조사한다.

Research 결과는 근거와 함께 기록한다.

Architecture에 영향을 주는 Research 결과는 Manager가 검토 후 Decision으로 확정한다.

## Questions

다음 경우에는 사용자 확인을 우선한다.

* 유료 License 또는 비용 발생
* 데이터 손실 위험
* 요구사항 충돌
* Architecture가 크게 달라짐
* 사용자 Workflow가 크게 달라짐

그 외 쉽게 변경 가능한 기술적 세부사항은 합리적인 Assumption을 기록하고 진행한다.

## Verification

변경 범위에 적합한 검증을 수행한다.

최소:

* Build
* Type Check
* Relevant Unit Tests
* Integration Tests when needed
* E2E when user workflow changes

Gantt 변경:

* Create
* Update
* Delete
* Drag
* Dependency
* Hierarchy
* Persistence

Authorization 변경:

* Readonly
* Correct Password
* Incorrect Password
* Mutation without Edit Session
* Session Expiration

Scheduling 변경:

* Weekend
* Holiday
* Dependency
* Boundary Dates
* Circular Dependency
* Summary Recalculation

Import 변경:

* Valid JSON
* Invalid JSON
* Unsupported Schema Version
* Invalid Date
* Duplicate externalId
* Missing Parent
* Invalid Dependency

Export 변경:

* Workbook creation
* Required Sheets
* Project Hyperlink
* Date formatting
* Gantt rendering

Docker 변경:

* Image Build
* Container Start
* Health Check
* SQLite Persistence after Restart

## Definition of Done

다음을 모두 만족해야 한다.

* Requirement 충족
* Build 성공
* 관련 Test 성공
* Error Handling
* Security Requirement
* Persistence 검증
* 관련 Documentation 갱신
* Debug Code 제거
* QA Review
* Manager Review

## Final Report

완료 시 다음을 보고한다.

### Completed

### Research Findings

### Verification

### Changed Files

### Documentation Updated

### Decisions

### Remaining

### Risks

### Recommended Next Work
