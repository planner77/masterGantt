# AGENTS.md

## 1. Project Overview

이 Repository는 **SVAR React Gantt 기반의 소규모 Project Gantt Management System**을 개발하기 위한 프로젝트이다.

주요 목적은 다음과 같다.

* Project별 Gantt Chart 작성 및 관리
* Project별 일정 데이터 저장 및 조회
* Project별 Edit Password 기반 편집 권한 제어
* Project Direct Link 제공
* 기존 Excel 일정의 안전한 Import
* Excel 형식 Export
* SVAR React Gantt Core를 활용한 UI 구현
* SVAR PRO 성격의 필요한 기능을 독립 Scheduling Engine으로 구현
* SQLite 기반 단순한 운영
* Docker 기반 배포

본 프로젝트는 Codex Multi-Agent 기반으로 개발한다.

Main Codex Thread가 Manager 역할을 수행하며, 전문 Sub-Agent에게 필요한 작업을 위임한다.

---

# 2. Primary Requirements

## 2.1 Project

사용자는 Project를 생성할 수 있어야 한다.

Project 생성 시 최소 다음 정보를 입력한다.

* Project Name
* Description
* Edit Password

각 Project에는 내부 Database ID와 별도로 외부에서 사용할 수 있는 안정적인 `public_id`를 부여한다.

Project 직접 접근 URL 예:

```text
/projects/{publicId}
```

예:

```text
https://gantt.company.local/projects/01KXXXXXXXXXXXX
```

Project URL에 Password, Session Token 또는 기타 Secret을 포함하면 안 된다.

Project URL로 접근한 경우 기본 상태는 **Readonly**이다.

정상적인 Edit Password 인증 후에만 Edit Mode를 활성화한다.

---

# 3. Project Authorization

D02 승인에 따라 앱에 접속 가능한 모든 사용자는 Project 목록을 조회할 수 있다. 목록에는 공개 summary만 제공하고 password/hash/salt/session 및 내부 DB ID를 노출하지 않는다. 목록 공개는 편집 권한을 부여하지 않으며 기존 Project별 비밀번호와 서버 Mutation 인증을 유지한다. Project 삭제도 edit session·Origin·If-Match를 검증하고 명시적 확인 뒤 종속 데이터를 원자적으로 제거한다. 상세 계약은 `docs/API.md`, `docs/SECURITY.md`를 따른다.

Project별 Edit Password를 사용한다.

Password 원문은 Database 또는 Log에 저장하면 안 된다.

검증된 Password Derivation 방식을 사용한다.

예:

* Node.js `crypto.scrypt`
* 충분한 Random Salt
* Timing-safe comparison

정상적인 Password 인증 후 Edit Session을 생성한다.

Browser에는 가능한 한 다음 정책을 사용하는 Cookie를 우선 검토한다.

* HttpOnly
* SameSite
* Secure: HTTPS 운영 환경에서 적용

Project를 편집할 수 있는 권한은 Frontend UI 상태만으로 판단하면 안 된다.

다음과 같은 Mutation API에서도 Server-side Authorization을 반드시 수행한다.

* Project Update
* Task Create
* Task Update
* Task Delete
* Dependency Create
* Dependency Update
* Dependency Delete
* Import
* 기타 일정 변경 API

관련 상세 정책은 다음 문서를 Source of Truth로 사용한다.

```text
docs/SECURITY.md
```

---

# 4. SVAR React Gantt Policy

Gantt UI에는 **SVAR React Gantt Core**를 사용한다.

공식 자료를 1차 근거로 사용한다.

Official Documentation:

```text
https://docs.svar.dev/react/gantt/
```

Official GitHub:

```text
https://github.com/svar-widgets/react-gantt
```

SVAR Core가 공식적으로 제공하는 기능은 불필요하게 다시 구현하지 않는다.

가능한 한 다음 영역은 SVAR의 공식 API와 Data Provider 패턴을 사용한다.

* Task Visualization
* Task Editing
* Drag & Drop
* Task Hierarchy
* Dependency Visualization
* Timeline
* Grid
* Editor
* Readonly
* 기타 Core 기능

버전, API, Feature 존재 여부가 불명확한 경우 추측하지 말고 공식 문서 또는 공식 Repository를 조사한다.

---

# 5. SVAR PRO-like Feature Policy

프로젝트에서 필요하지만 SVAR PRO에 해당하는 기능이 있을 경우 다음 원칙을 따른다.

SVAR PRO 소스코드, 비공개 구현 또는 내부 알고리즘을 복제하거나 모방하지 않는다.

대신 공개된 Project Scheduling 원리, 일반적인 알고리즘, 공식 자료 및 본 프로젝트 Requirement를 이용하여 **독립적인 Scheduling Engine**을 구현한다.

SVAR는 가능한 한:

```text
Gantt Renderer / Interactive Editor
```

역할로 제한한다.

일정 계산은:

```text
Project Scheduling Domain Engine
```

에서 담당한다.

Scheduling Engine은 가능한 한 SVAR에 종속되지 않도록 설계한다.

---

# 6. Scheduling Engine

Scheduling Engine은 별도 Domain Layer로 관리한다.

권장 위치:

```text
src/domain/scheduling/
```

초기 우선 기능:

1. Working Calendar
2. Weekend 제외
3. Holiday 제외
4. Duration 계산
5. Summary Task 계산
6. FS Dependency
7. Dependency 기반 일정 재계산
8. WBS

향후 단계적으로 검토할 기능:

* SS Dependency
* FF Dependency
* SF Dependency
* Lag
* Lead
* Baseline
* Critical Path
* Total Slack / Free Slack
* Grouping
* Resource Assignment
* Resource Workload
* Resource Calendar
* Rollup
* Split Task

Scheduling Engine은 가능한 한 Pure Domain Logic으로 작성한다.

UI 또는 Database 접근과 일정 계산 로직을 결합하지 않는다.

다음과 같은 Edge Case를 반드시 고려한다.

* Circular Dependency
* Missing Parent
* Missing Dependency Target
* Non-working Date
* Weekend Boundary
* Holiday Boundary
* Summary Recalculation
* Zero-duration Milestone
* Manual Schedule와 Auto Schedule 혼합

관련 상세 내용은 다음 문서를 사용한다.

```text
docs/SCHEDULING_ENGINE.md
docs/PRO_FEATURE_MATRIX.md
```

---

# 7. Database

Database는 우선 **SQLite**를 사용한다.

Prisma는 사용하지 않는다.

SQLite Driver는 `better-sqlite3`를 우선 검토한다.

Database Access 구조는 다음 경계를 유지한다.

```text
Route Handler
    ↓
Service
    ↓
Repository
    ↓
SQLite
```

Route Handler 내부에 SQL과 복잡한 Business Logic을 직접 집중시키지 않는다.

SQL Query에는 Parameter Binding을 사용한다.

필요한 Foreign Key와 Index를 정의한다.

DB Schema 변경은 SQL Migration으로 관리한다.

권장 위치:

```text
db/migrations/
```

실제 SQLite Database 파일은 Git에 저장하지 않는다.

관련 상세 내용:

```text
docs/DB_SCHEMA.md
```

---

# 8. Excel Import Background

기존 Project 일정은 Excel로 관리되고 있다.

원본 Excel에는 DRM이 적용되어 있어 Web Application이 Excel 원본 파일을 직접 읽는 방식을 전제로 하지 않는다.

DRM 해제 또는 우회 기능을 개발하면 안 된다.

Clipboard Copy/Paste 역시 사용 가능함을 전제로 하지 않는다.

본 프로젝트에서는 조직 정책상 허용된 Excel 기능을 이용하여 필요한 일정 데이터를 별도 중간 Format으로 변환하는 방식을 우선한다.

---

# 9. Excel Import Strategy

Import 우선순위는 다음과 같다.

## Primary

```text
Excel
→ VBA
→ 필요한 데이터 추출
→ 데이터 정규화
→ JSON
→ Web Import
```

## Fallback 1

```text
Excel
→ VBA
→ CSV
→ Web Import
```

## Fallback 2

조직 정책상 허용되는 경우:

```text
Excel VBA
→ HTTP API
→ Web Application
```

## Fallback 3

```text
Manual Import Grid
```

DRM 또는 보안 정책으로 VBA 자체가 제한되는 경우 우회하지 않는다.

승인된 다른 방식으로 전환한다.

---

# 10. Excel/VBA POC

VBA 기반 Import 방식을 본격 구현하기 전에 최소 다음을 검증한다.

1. 대상 Excel Workbook에서 VBA 실행 가능한가
2. VBA에서 필요한 Cell 데이터에 접근 가능한가
3. 필요한 Header를 찾을 수 있는가
4. 승인된 위치에 JSON 저장 가능한가
5. 승인된 위치에 CSV 저장 가능한가
6. 한글 데이터가 손상되지 않는가
7. 날짜 데이터가 정상 변환되는가
8. Progress 등의 숫자 값이 정상 변환되는가
9. 생성한 JSON/CSV를 Web Application이 정상적으로 읽을 수 있는가

검증에 실패한 경우 DRM 또는 조직 정책을 우회하지 않는다.

---

# 11. Excel/VBA Export Rules

Excel/VBA Agent는 Excel Column Letter 또는 Column Number에 강하게 의존하는 구현을 피한다.

다음과 같은 방식:

```text
B열 = Task
F열 = Start
G열 = End
```

을 기본 설계로 사용하지 않는다.

가능한 한 Header Name 기반 Mapping을 사용한다.

예:

```text
Activity
Task
업무
        → name

Start
Start Date
시작일
        → start

Finish
End
종료일
        → end
```

불필요한 Column은 무시한다.

필요한 데이터만 표준 Import Format으로 정규화한다.

VBA Export 과정에서 문제가 있는 Row를 조용히 누락시키면 안 된다.

오류 또는 Warning 정보를 사용자가 확인할 수 있도록 해야 한다.

---

# 12. Import JSON Contract

Excel/VBA와 Backend Import Service 사이의 공식 Interface Contract는 다음 문서이다.

```text
docs/IMPORT_SCHEMA.md
```

JSON에는 반드시 Schema Version을 포함한다.

예:

```json
{
  "schemaVersion": "1.0",
  "project": {},
  "tasks": []
}
```

Task에는 가능한 한 안정적인 `externalId`를 사용한다.

행 번호와 같은 불안정한 값을 Parent/Dependency 식별자로 사용하지 않는 것을 원칙으로 한다.

예상 주요 Field:

```text
externalId
name
type
start
end
duration
progress
parentExternalId
predecessors
```

Dependency 정보는 가능한 한 다음 요소를 표현할 수 있도록 한다.

```text
target task
dependency type
lag
```

Import Schema를 `excel_vba` Agent 또는 `backend` Agent가 단독으로 임의 변경하면 안 된다.

Schema 변경 절차:

```text
변경 필요 발견
→ 영향 분석
→ Manager 보고
→ Backend + Excel/VBA 검토
→ Manager Decision
→ IMPORT_SCHEMA.md 갱신
→ 양쪽 구현 갱신
→ QA 검증
```

---

# 13. Web Import Workflow

Web Application의 Import 절차는 다음과 같이 한다.

```text
File Select
→ Parsing
→ Schema Validation
→ Preview
→ Mapping 필요 시 Mapping
→ Business Validation
→ Import
→ Result
```

Server에서도 Import 데이터를 반드시 다시 검증한다.

Client Validation만 신뢰하면 안 된다.

가능하면 Import 전체를 Transaction으로 처리한다.

일부 데이터만 저장되고 나머지가 실패하는 Partial Import를 기본 동작으로 만들지 않는다.

Import Validation 예:

* Invalid JSON
* Invalid CSV
* Unsupported schemaVersion
* Missing required field
* Invalid Date
* Duplicate externalId
* Missing Parent
* Invalid Dependency
* Circular Dependency
* Invalid Progress
* Invalid Task Type

---

# 14. Excel Export from Web Application

Web Application → Excel Export는 Excel/VBA Agent가 아닌 **Backend Agent**가 담당한다.

SVAR PRO Excel Export 기능에 의존하지 않는다.

오픈소스 Excel 생성 Library를 사용한다.

우선 ExcelJS를 검토한다.

## Phase 1

표 중심 Workbook을 구현한다.

최소 Sheet:

```text
Project
Tasks
Dependencies
```

Project Sheet에는 다음 정보를 포함한다.

* Project Name
* Description
* Export Date
* Project Direct URL
* Project Direct Hyperlink

Project Link는 다음 기준으로 생성한다.

```text
APP_BASE_URL
+
/projects/
+
project.public_id
```

예:

```text
https://gantt.company.local/projects/01KXXXXXXXX
```

Password 또는 Session 정보는 Excel Link에 포함하지 않는다.

---

# 15. Excel Gantt Export

Excel Export Phase 2에서는 별도의 Gantt Sheet를 생성한다.

초기 구현은 Excel Chart Object보다 날짜별 Cell을 사용하는 방식을 우선 검토한다.

예:

```text
Task        09/01 09/02 09/03 09/04 09/05

Design       ■     ■     ■
Build                    ■     ■
Test                           ■
```

구현 시 고려 항목:

* Date Header
* Week Header
* Month Header
* Task Start/End
* Weekend 표현
* Holiday 표현
* Progress
* Milestone
* Summary
* Page/Print 편의성

Phase 1의 Table Export가 먼저 완료된 뒤 Phase 2를 진행한다.

---

# 16. Docker and Deployment

본 프로젝트는 Docker 기반 배포를 지원한다.

최소 Repository 파일:

```text
Dockerfile
docker-compose.yml
.dockerignore
.env.example
```

SQLite Database 파일은 Container Image 내부에 저장하지 않는다.

Persistent Volume 또는 Host Bind Mount를 사용한다.

SQLite 단계에서는 기본적으로 **Single Application Instance**를 사용한다.

불필요하게 다음을 추가하지 않는다.

* Kubernetes
* Redis
* PostgreSQL
* Message Broker
* 기타 운영 복잡도를 크게 증가시키는 구성

실제 요구가 발생하면 별도로 검토한다.

`better-sqlite3`는 Native Module이므로 다음을 반드시 검증한다.

* Node Runtime
* Base Image
* Build Architecture
* Runtime Architecture
* File Permission
* Volume Permission

Container Restart 이후에도 SQLite 데이터가 유지되어야 한다.

관련 상세 내용:

```text
docs/DEPLOYMENT.md
```

---

# 17. Recommended Technology Stack

기본 권장 기술 스택:

```text
Next.js
React
TypeScript

SVAR React Gantt
@svar-ui/gantt-data-provider

SQLite
better-sqlite3

shadcn/ui
Tailwind CSS

Zod

ExcelJS

Vitest
Playwright

Docker
Docker Compose
```

설치 전에 현재 Version, License, Compatibility를 공식 자료로 확인한다.

Version을 근거 없이 임의 고정하지 않는다.

---

# 18. UI Principles

Project 목록은 표/Grid로 표시한다. SVAR Grid Header `+`는 최상위, 행 `+`는 하위 Task 추가이며 native command를 intercept하여 보호 API와 canonical snapshot 경로를 유지한다. 새 작업 생성 시 이름·시작일·기간은 묻지 않고 `새 작업`·브라우저 오늘·1일을 적용한다(Milestone 0일 유지). 일반 추가는 입력창 없이 저장하며 첫 child 추가의 Summary 전환만 명시 확인한다. 날짜 표시는 사용자 locale을 따르고 date-only 저장을 시간대 변환하지 않는다. 설정 패널은 기본 접고 Project/Grid/Chart headers를 유지한 내부 scroll을 제공한다. 상세 기준은 `docs/REQUIREMENTS.md`, `docs/W24_REVIEW.md`다.

Grid/Chart 상단에 별도 ‘작업 추가 또는 삭제’ 패널을 다시 추가하지 않는다. 작업 추가 진입점은 native Grid `+`이며 서버 Task 삭제 API와 Project 목록 삭제는 유지한다.

Grid 데이터 열 표시는 Column Header 우클릭 메뉴로 선택한다. 외부 ID는 기본 숨김이며 별도 외부 ID 토글 버튼을 두지 않는다. 데이터 열 최소 한 개와 권한 기반 `+` action을 유지하며 표시 설정은 서버 일정 변경과 분리한다.

사용자가 일괄 검증을 위해 테스트 보류를 요청한 경우 실행을 강행하지 않는다. 미실행 항목은 `docs/PENDING_TESTS.md`에 기록하고 과거 PASS와 구분한다. 현재 보류 범위와 재개 여부는 `docs/exec-plans/active/PLAN.md`를 따른다.

UI는 차분하고 전문적인 Project Management Tool 형태로 구성한다.

장식보다 정보 전달, 가독성, 편집 편의성을 우선한다.

주요 화면:

```text
Project List
Project Create
Project Gantt
Edit Unlock
Import Wizard
Export
```

일반 Application UI는 shadcn/ui를 우선 사용한다.

Gantt 관련 기능은 SVAR 공식 UI를 가능한 한 활용한다.

Project Gantt 기본 작업공간은 별도의 Demo 목록 없이 다음 구성을 유지한다.

```text
좌측: 계층 구조 Task Grid
우측: 동일 Task와 세로 스크롤이 동기화된 Gantt Chart
```

Grid와 Chart는 SVAR Core의 단일 Gantt 인스턴스와 공식 `displayMode`,
`columns`, `gridWidth` 및 내장 Resizer를 사용한다. Project 화면은 많은 일정
정보를 볼 수 있도록 Desktop의 가용 Viewport 폭과 높이를 적극 활용하고,
좁은 화면에서도 내부 Scroll 또는 공식 Compact 동작으로 양쪽 내용에 접근할
수 있어야 한다.

SVAR의 로컬 Add/Edit/Delete UI를 사용하더라도 Project Mutation은 기존
Edit Session, `If-Match` Revision, Server-side Scheduling과 Canonical Snapshot
복원 경계를 우회하면 안 된다. 작업 생성 성공 직후 새 Task가 Reload 없이
Grid Row와 Chart Bar 또는 Milestone 양쪽에 표시되는지를 Browser Test로
검증한다.

---

# 19. Multi-Agent Model

Main Codex Thread는 **Manager Agent** 역할을 수행한다.

별도의 Manager Sub-Agent를 기본적으로 생성하지 않는다.

Project Custom Sub-Agent:

```text
researcher
frontend
backend
scheduler
excel_vba
infra
qa_docs
```

권장 모델 정책은 `.codex/config.toml`과 각 `.codex/agents/*.toml`을 Source of Truth로 한다.

현재 기본 정책:

```text
Main / Manager
→ GPT-6 Astra / High

researcher
→ GPT-5.6 Terra / Medium

frontend
→ GPT-5.6 Terra / Medium

backend
→ GPT-5.6 Sol / High

scheduler
→ GPT-6 Astra / High

excel_vba
→ GPT-5.6 Sol / Medium

infra
→ GPT-5.6 Terra / Medium

qa_docs
→ GPT-5.6 Sol / High
```

모델명 또는 Reasoning 옵션은 실제 Codex 환경에서 지원되는 값을 우선한다.

설정과 실제 실행 모델이 일치하는지 초기 Bootstrap 과정에서 검증한다.

---

# 20. Manager Responsibilities

Manager는 다음을 담당한다.

* 사용자 요구사항 분석
* Requirement 정리
* Architecture 결정
* 주요 기술 Decision
* Agent Task Decomposition
* Agent Assignment
* Agent 작업 충돌 방지
* Interface Coordination
* Agent 결과 Review
* Rework 판단
* Integration
* QA Result 검토
* Final Decision
* Documentation 최종 일관성

Manager가 모든 구현 코드를 직접 작성하려 하지 않는다.

Sub-Agent를 사용하면 품질 또는 속도가 개선되는 독립 작업은 위임한다.

Manager는 Sub-Agent 결과를 자동 승인하지 않는다.

다음 중 하나로 판단한다.

```text
ACCEPT
REWORK
REJECT
DEFER
```

---

# 21. Researcher Responsibilities

Researcher는 읽기 중심 조사 Agent이다.

주요 책임:

* SVAR 공식 문서 조사
* SVAR GitHub 조사
* Next.js 공식 문서 조사
* SQLite / better-sqlite3 조사
* Excel / VBA 제약 조사
* Docker 관련 조사
* Library Version 조사
* License 조사
* Scheduling Algorithm 조사
* 기술 선택의 근거 수집

Researcher는 Architecture를 임의 결정하지 않는다.

구현 코드를 수정하지 않는 것을 기본 원칙으로 한다.

보고 형식:

```text
Finding
Evidence
Constraints
Options
Recommendation
Unknowns
```

---

# 22. Frontend Responsibilities

Frontend Agent는 다음을 담당한다.

* Next.js UI
* Project List
* Project Create
* Project Gantt
* SVAR Integration
* Gantt Interaction
* Readonly/Edit UI
* Edit Unlock UI
* Import Wizard
* Import Preview
* Validation UI
* Export Trigger
* Error State
* Loading State
* shadcn/ui

Frontend는 Client-side 상태를 Authorization의 최종 근거로 사용하지 않는다.

---

# 23. Backend Responsibilities

Backend Agent는 다음을 담당한다.

* SQLite
* SQL Migration
* Repository Layer
* Service Layer
* API
* Project Public ID
* Password Hash
* Edit Session
* Authorization
* JSON Import
* CSV Import
* Import Transaction
* Excel Workbook Export
* Project Hyperlink
* Server Validation

Web Application → `.xlsx` Export는 Backend Agent의 책임이다.

Excel/VBA Export와 혼동하지 않는다.

---

# 24. Scheduler Responsibilities

Scheduler Agent는 Project Scheduling Domain을 담당한다.

주요 책임:

* Calendar
* Working Day
* Holiday
* Weekend
* Duration
* Dependency
* Auto Scheduling
* Summary
* WBS
* Critical Path
* Slack
* Baseline
* Resource Scheduling

Scheduling Engine은 SVAR와 독립적인 Domain Layer를 유지한다.

복잡한 Scheduling Logic 변경에는 반드시 Unit Test를 작성한다.

---

# 25. Excel/VBA Responsibilities

`excel_vba` Agent는 기존 Excel 일정 데이터를 Web Application이 Import할 수 있는 형태로 변환하는 Excel/VBA Integration을 담당한다.

주요 책임:

* 대상 Workbook/Worksheet 구조 분석
* VBA POC
* Header 탐색
* Header Mapping
* 필요한 Column 추출
* 불필요 Column 제외
* 날짜 정규화
* Progress 정규화
* externalId 처리
* Parent 관계 변환
* Dependency 변환
* JSON 생성
* CSV Fallback 생성
* JSON Escaping
* 한글/Encoding 검증
* File Save
* 오류 및 Warning 처리
* VBA 설치 및 실행 절차 문서화

DRM 해제 또는 우회 기능은 구현하지 않는다.

조직 정책에서 허용된 Excel/VBA 기능만 사용한다.

JSON Output Contract는 반드시 다음을 따른다.

```text
docs/IMPORT_SCHEMA.md
```

VBA 관련 상세 문서:

```text
docs/VBA_EXPORT.md
```

Import Schema를 단독으로 변경하면 안 된다.

---

# 26. Infra Responsibilities

Infra Agent는 다음을 담당한다.

* Dockerfile
* docker-compose.yml
* .dockerignore
* .env.example
* Runtime Environment
* SQLite Persistence
* Volume
* Permission
* Health Check
* `better-sqlite3` Runtime Compatibility
* Deployment
* Backup/Restore 기본 정책
* Deployment Documentation
* GitHub Actions CI
* Main Commit Test Image Publish / Digest Smoke
* Semantic Version Release Gate
* GHCR Image Publish / Digest Smoke
* Action SHA / Base Image Digest Pin
* SBOM / Provenance

Infra Agent는 Docker 또는 배포와 관련 없는 작업에 불필요하게 호출하지 않는다.

PR과 수동 CI workflow에는 write token 또는 registry secret을 제공하지 않는다. 모든 품질 gate를 통과한 `main` push만 immutable `ci-<full SHA>` test image를 게시할 수 있다. Semantic Version release는 `package.json`과 일치하는 annotated tag에서 별도 `sha-<full SHA>` candidate를 사용한다. 두 경로 모두 게시 결과의 exact digest를 다시 pull하여 정책, readiness, Project/Task authorization 저장과 restart persistence를 검사한다. 로컬 image PASS와 실제 원격 Actions/GHCR PASS를 구분한다.

현재 private repository 요금제에서는 branch/tag ruleset을 강제하지 못하는 위험을 사용자가 명시적으로 수용했다. 이는 보호 규칙이 적용됐다는 뜻이 아니며, 지정 maintainer와 문서화된 release 절차가 운영 통제다. Private GitHub Artifact Attestation은 비활성으로 두고 BuildKit SBOM/provenance는 모든 publish에서 필수로 유지한다.

---

# 27. QA / Docs Responsibilities

QA/Docs Agent는 독립 Reviewer 역할을 한다.

구현 Agent의 완료 보고를 그대로 신뢰하지 않는다.

다음을 실제 요구사항, 코드, 테스트 결과와 비교하여 검증한다.

* Functional Requirements
* Project Isolation
* Authorization
* Gantt CRUD
* Scheduling
* Import
* Export
* VBA Compatibility
* SQLite Persistence
* Docker Persistence
* Security
* Regression
* Documentation Consistency

결과 분류:

```text
PASS
FAIL
BLOCKED
NOT TESTED
```

보고 형식:

```text
Summary
Requirement Coverage
Test Results
Failures
Security Findings
Regression Findings
Documentation Findings
Remaining Risks
Recommendation
```

QA/Docs Agent는 Architecture를 독자적으로 변경하지 않는다.

---

# 28. Agent Selection Guidelines

일반적으로 다음 기준을 사용한다.

```text
공식 문서 / 기술 조사
→ researcher

Next.js / React / SVAR / UI
→ frontend

SQLite / API / Auth / Import / Web Excel Export
→ backend

Scheduling Algorithm
→ scheduler

Excel VBA / JSON·CSV Export
→ excel_vba

Docker / Deployment
→ infra

Test / Review / Documentation Consistency
→ qa_docs
```

하나의 Feature가 여러 영역에 걸치는 경우 Manager가 Agent들을 조율한다.

예:

```text
Excel Import

researcher
→ 환경/제약 조사

excel_vba
→ Excel → JSON

backend
→ JSON → DB

frontend
→ Import UI

qa_docs
→ End-to-End 검증

manager
→ 최종 승인
```

---

# 29. Collaboration Rules

읽기 중심 작업은 가능한 한 병렬화한다.

여러 Write Agent가 동일 파일을 동시에 수정하지 않도록 한다.

병렬 Write가 필요하면 Manager가 담당 File 또는 Directory를 먼저 분리한다.

공용 Interface 변경은 Manager가 조정한다.

## Database

DB 변경:

```text
Migration
+
docs/DB_SCHEMA.md
```

를 함께 갱신한다.

## API

API 변경:

```text
Code
+
docs/API.md
```

를 함께 갱신한다.

## Scheduling

Scheduling 변경:

```text
Code
+
Tests
+
docs/SCHEDULING_ENGINE.md
```

를 함께 갱신한다.

## Import Contract

Excel/VBA와 Backend 사이의 Import Contract:

```text
docs/IMPORT_SCHEMA.md
```

양쪽 Agent가 동일 Contract를 준수해야 한다.

## VBA

VBA 변경:

```text
VBA
+
docs/VBA_EXPORT.md
```

를 함께 갱신한다.

## Docker

Docker 변경:

```text
Docker Files
+
docs/DEPLOYMENT.md
+
GitHub Actions / Release 영향이 있으면 docs/CI_CD.md
```

를 함께 갱신한다.

## CI/CD와 Version

Workflow, Semantic Version, Container Registry 변경:

```text
.github/workflows/**
+
자동화 Test / Script
+
docs/CI_CD.md
+
docs/TEST_PLAN.md
+
사용자 절차가 바뀌면 README.md와 CHANGELOG.md
```

를 같은 변경에서 갱신한다.

Release는 다음 불변식을 유지한다.

* `package.json`과 lockfile의 Strict SemVer가 일치해야 한다.
* Release authority는 이전 유효 Tag보다 큰 annotated `v<version>` Tag다.
* 서로 다른 Version Release도 Repository 단위로 직렬화한다.
* 원격 쓰기 전에 동일 Release 설정의 Local Candidate Runtime을 검증한다.
* GHCR에는 Immutable Commit Candidate를 먼저 게시하고 Digest Smoke와 Attestation 뒤에만 Stable Alias와 Exact Version을 승격한다.
* Exact Version Tag는 성공 완료 표식으로 마지막에 생성하며 Exact/Commit Image를 덮어쓰지 않는다.
* Test와 Deployment는 `latest`가 아니라 Exact Version 또는 Digest를 사용한다.
* `main` commit image는 immutable `ci-<full SHA>`만 사용하고 Stable Alias나 SemVer Exact Tag를 만들지 않는다.
* Commit image와 SemVer release image는 서로 다른 Tag 공간과 Workflow를 유지하며 둘 다 Registry Digest를 새로 Pull해 Runtime을 검증한다.
* PR과 수동 CI는 Readonly다. `main` commit publish와 release publish job에만 job-scoped 최소 Registry 권한을 부여한다.
* Private Repository에서 GitHub Artifact Attestation을 요구하려면 지원 Plan을 먼저 확인한다. 지원하지 않는 Plan에서는 BuildKit SBOM/Provenance를 필수로 유지하고 GitHub Attestation을 성공으로 과대 표시하지 않는다.

---

# 30. Documentation

`AGENTS.md`는 상세 Specification 전체를 담는 문서가 아니다.

이 파일은 핵심 개발 원칙과 Source of Truth를 안내하는 Project Map이다.

상세 내용은 다음 문서를 사용한다.

## Requirements

```text
docs/REQUIREMENTS.md
```

## Architecture

```text
docs/ARCHITECTURE.md
```

## Database

```text
docs/DB_SCHEMA.md
```

## API

```text
docs/API.md
```

## Scheduling Engine

```text
docs/SCHEDULING_ENGINE.md
```

## SVAR PRO Replacement Matrix

```text
docs/PRO_FEATURE_MATRIX.md
```

## Import / Export

```text
docs/IMPORT_EXPORT.md
```

## Import Schema

```text
docs/IMPORT_SCHEMA.md
```

## VBA Export

```text
docs/VBA_EXPORT.md
```

## Security

```text
docs/SECURITY.md
```

## Deployment

```text
docs/DEPLOYMENT.md
```

## CI/CD and Semantic Versioning

```text
docs/CI_CD.md
```

## Testing

```text
docs/TEST_PLAN.md
```

## Architecture Decisions

```text
docs/DECISIONS.md
```

## Research

```text
docs/RESEARCH.md
```

## Current Execution Plan

```text
docs/exec-plans/active/PLAN.md
```

완료된 Plan:

```text
docs/exec-plans/completed/
```

---

# 31. GitHub Workflow

프로젝트는 GitHub로 관리한다.

다음 파일도 Project Source의 일부로 Git 관리한다.

```text
AGENTS.md
.codex/config.toml
.codex/agents/*.toml
docs/**
db/migrations/**
Dockerfile
docker-compose.yml
.dockerignore
.github/workflows/**
.github/dependabot.yml
.env.example
```

Secret 또는 환경별 실제 값은 Git에 저장하지 않는다.

예:

```text
.env
API Key
PAT
Password
Token
SQLite 실제 DB
Runtime Log
```

구현 가능한 업무는 가능한 한 GitHub Issue 단위로 관리한다.

Issue에는 최소 다음을 포함한다.

```text
Goal
Background
Scope
Acceptance Criteria
Assigned Agent
Related Documents
```

독립적인 Feature는 Branch 또는 Worktree 사용을 우선한다.

PR에는 가능한 한 다음을 포함한다.

```text
Summary
Related Issue
Changes
Verification
Screenshots if UI changed
Documentation Updated
Remaining Risks
```

Application version은 `package.json`을 Source of Truth로 하고 `package-lock.json`과 일치시킨다. Version은 Semantic Versioning을 따르며 release tag는 정확히 `v<package version>`이어야 한다. Version을 변경하면 `CHANGELOG.md`도 같은 변경에서 갱신한다.

Pull Request와 `main` push는 GitHub Actions의 build, typecheck, lint, unit/integration, browser E2E와 container smoke를 통과해야 한다. 성공한 `main` push는 사용자·통합 테스트용 immutable `ci-<full SHA>` image를 게시하고 exact digest로 다시 검증한다. Release image는 검증된 Semantic Version tag에서 별도 게시한다. Stable release만 `latest`를 갱신하며 test/deployment는 exact version 또는 digest를 사용한다.

Workflow의 PR·수동 CI job에는 write 권한이나 registry secret을 주지 않는다. `main` commit과 release Publish job만 job-scoped `GITHUB_TOKEN`과 최소 `packages: write`를 사용하고 개인 PAT를 저장하지 않는다. 외부 Action은 full commit SHA, base image는 digest로 고정하고 reviewed dependency update로 갱신한다. 세부 계약은 `docs/CI_CD.md`가 Source of Truth다.

---

# 32. Requirement Classification

새로운 요구사항은 Manager가 다음으로 구분한다.

```text
Confirmed
Assumption
Decision Required
```

쉽게 변경 가능하고 위험이 낮은 기술 선택은 합리적인 Assumption으로 기록하고 진행한다.

다음 경우에는 사용자 확인을 우선한다.

* 비용 또는 유료 License 발생
* 데이터 손실 가능성
* Security Policy 관련
* Architecture가 크게 변경됨
* 사용자 Workflow가 크게 변경됨
* Requirement 간 충돌
* 조직 정책을 알지 못하면 진행할 수 없음

세부적인 Coding 선택 때문에 불필요하게 개발을 중단하지 않는다.

---

# 33. Verification

모든 변경에는 변경 범위에 적합한 검증을 수행한다.

기본:

```text
Build
Type Check
Relevant Tests
Error Handling
Documentation
```

## Gantt

최소 확인:

* Task Create
* Task Update
* Task Delete
* Drag & Drop
* Hierarchy
* Dependency
* Reload Persistence
* Grid와 Chart 동시 표시 및 동기화
* Task Create 직후 Grid Row와 Chart Bar/Milestone 동시 표시
* Desktop Viewport 폭·높이 활용
* 좁은 화면에서 Grid/Chart 접근과 의도하지 않은 Body Overflow 없음

## Authorization

최소 확인:

* Password 없이 Readonly
* Correct Password → Edit
* Incorrect Password 거부
* Session 없이 Mutation 거부
* Session Expiration

## Scheduling

최소 확인:

* Weekend
* Holiday
* Working Day
* Dependency
* Circular Dependency
* Boundary Date
* Summary Recalculation

## Excel/VBA

최소 확인:

* 대상 Workbook에서 VBA 실행
* Cell 데이터 접근
* Header Mapping
* 필요한 Column 추출
* 불필요 Column 제외
* JSON 생성
* CSV Fallback
* schemaVersion
* externalId
* Parent Mapping
* Dependency Mapping
* Date normalization
* Progress normalization
* 한글/Encoding
* File Save
* 오류 Row 보고

## Import

최소 확인:

* Valid JSON
* Invalid JSON
* Unsupported schemaVersion
* Duplicate externalId
* Invalid Date
* Missing Parent
* Invalid Dependency
* Circular Dependency
* Transaction Rollback

## Excel Export

최소 확인:

* Workbook 생성
* Required Sheets
* Project Information
* Project Hyperlink
* Task Data
* Dependency Data
* Date Formatting
* Phase 2 Gantt Rendering

## Docker

최소 확인:

* Docker Image Build
* Container Start
* Health Check
* SQLite File 생성
* Restart 후 Data Persistence
* File Permission

## CI/CD / Release

최소 확인:

* `package.json`과 `package-lock.json` Version 일치
* Strict Semantic Version과 이전 Tag보다 큰 annotated `v<version>` Tag 일치
* PR/Main CI의 frozen install, Build, Type Check, Lint, Unit/Integration, Browser E2E
* Non-root Docker Build, Migration, Readiness, Native SQLite, Restart Persistence
* PR Job Readonly 권한과 Publish Job 최소 권한
* Action full SHA와 Base Image Digest Pin
* Stable/Prerelease Image Tag 분리
* Pre-publish Candidate Runtime Smoke
* Commit Candidate의 GHCR Digest Pull Smoke 후 Alias/Exact Promotion
* `main` 성공 Commit의 Immutable `ci-<full SHA>` Publish와 Overwrite 거부
* Commit Image의 Exact Digest Pull 후 Project/Task API Authorization·Restart Persistence
* PR/수동 CI의 Registry Write 부재와 Commit/Release Tag 공간 분리
* SBOM과 Provenance
* Private Repository의 GitHub Attestation 지원 Plan과 명시적 Opt-in 상태
* 원격 Actions/GHCR 미실행 상태를 로컬 PASS와 구분

---

# 34. Definition of Done

작업은 단순히 코드가 작성되었다는 이유만으로 완료되지 않는다.

최소 다음을 만족해야 한다.

* Requirement 충족
* Build 성공
* Type Check 성공
* 관련 Test 성공
* Error Handling 구현
* Security Requirement 충족
* Persistence 확인
* 관련 Documentation 갱신
* 불필요한 Debug 코드 제거
* QA Review
* Manager Review

---

# 35. Final Report

Manager는 작업 또는 Milestone 완료 시 다음 형식으로 사용자에게 보고한다.

## Completed

구현 완료 내용.

## Research Findings

조사를 통해 확인한 주요 사실.

## Architecture Decisions

확정된 주요 설계 결정.

## Verification

수행한 테스트와 결과.

## Changed Files

주요 변경 파일.

## Documentation Updated

갱신한 문서.

## Decisions

추가로 확정한 사항.

## Remaining

미구현 사항.

## Risks

알려진 문제와 기술 부채.

## Recommended Next Work

다음 진행 권장 사항.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
