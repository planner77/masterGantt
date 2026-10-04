# Excel Export

SVG/PNG Gantt 내보내기 계약은 [IMAGE_EXPORT.md](IMAGE_EXPORT.md)를 따른다. 이 문서의 Excel workbook, 관계 포함/제외 및 물류 구성 보고서 옵션은 유지한다.

## 1. 상태

Issue #28에서 구현된 프로젝트 Excel 내보내기의 **현재 구현 계약**을 정의한다. 이 문서는 `docs/IMPORT_EXPORT.md`의 과거 Excel Export Phase 1 계획 중 실제 구현과 충돌하는 부분보다 우선한다.

- 적용 버전: `v0.13.0`
- API: `POST /api/projects/{publicId}/exports/excel`
- 결과 형식: `.xlsx`
- 생성 위치: Backend Node runtime
- 외부 Excel SaaS, SVAR PRO export API, ExcelJS를 사용하지 않는다.
- Node 표준 `zlib`과 내부 OOXML/ZIP writer로 workbook을 생성한다.

## 2. 사용자 흐름

프로젝트 화면의 **내보내기** 버튼을 눌러 공통 대화상자에서 `Excel (.xlsx)` 형식을 선택하면 작업 관계 처리 방식 및 물류 구성 보고서 포함 여부를 선택한다.

1. `관계 포함`
2. `관계 제외`
3. `물류 구성 보고서 포함` (체크박스, 기본 체크)
4. `취소`

취소는 export 요청을 전송하지 않는다.

내보내기 직전에 최신 Project snapshot을 조회하여 revision을 확보하고, export POST 요청에는 strong `If-Match`를 전달한다. 요청 처리 중 revision이 바뀌면 `412 Precondition Failed`로 실패하며 사용자가 다시 실행해야 한다.

## 3. Request contract

```json
{
  "includeDependencies": true,
  "includeLogistics": true,
  "scope": "project",
  "scale": "day",
  "hierarchyDisplay": "expanded",
  "layout": {
    "columns": [
      { "id": "text", "widthPx": 224 },
      { "id": "projectStart", "widthPx": 128 },
      { "id": "projectDuration", "widthPx": 84 }
    ]
  }
}
```

`includeLogistics`는 선택 필드(boolean)이며 기본값은 false다. true로 지정하고 프로젝트에 물류 데이터가 존재할 경우 `Logistics` 보고용 시트가 추가된다.
`scope`, `scale`, `hierarchyDisplay`는 현재 각각 `project`, `day`, `expanded`만 허용한다. Grid column ID는 `text`, `externalId`, `projectStart`, `projectDuration`만 허용하며 duplicate column은 거부한다.

## 4. Workbook 구조

첫 sheet는 `Gantt`이며 활성 sheet다.

- `Gantt`: 좌측 Grid + 우측 일 단위 timeline을 동일 작업 행으로 표현
- `Tasks`: 작업의 구조화된 원본/계산 값
- `Project`: 프로젝트 metadata, revision, timezone, holiday, export 정책
- `Dependencies`: `includeDependencies=true`일 때만 생성
- `Logistics`: `includeLogistics=true`이고 프로젝트에 물류 데이터가 존재할 때 생성 (Issue #189 LG-06)

### Gantt

- parent-first WBS와 sibling order를 보존한다.
- Excel outline은 최대 8개 표시 수준을 사용한다.
- 시작/종료일은 Excel native date serial로 기록한다.
- 기간은 canonical working-day duration 숫자다.
- 진행률은 숫자 percentage다.
- 주말/Project holiday를 timeline에서 구분한다.
- task/summary/milestone을 구분해 표시한다.
- 관계 포함 시 FS/lag 0 link를 DrawingML connector로 표현한다.
- 월 헤더는 `YYYY-MM`을 유지하고, 주차 헤더는 ISO week 계산 결과의 **주차 번호만** 표시한다. 예: `2026-W39` 계산 결과는 `39`로 표시한다.
- 연말/연초 ISO week year 경계는 계산 key로 유지해 같은 ISO week를 동일 그룹으로 병합하며, 표시 label에서만 연도와 `W`를 제거한다.

### Tasks

기본 열은 WBS, 작업명, 외부 ID, 유형, 시작, 종료, 근무일 기간, 진행률, 설명, URL이다. 관계 포함 시 predecessor/successor 관련 열을 추가한다.

### Project

기존 metadata 행(프로젝트명·ID·revision·설명·시간대·작업 수·관계 포함과 선택적 관계 수) 및 휴일 표의 셀 위치는 유지한다. Issue #138의 Project 상태는 마지막 휴일 데이터 다음 행에 `프로젝트 상태`와 한국어 표시명(`예정`/`진행 중`/`완료`)으로 추가한다. 기존 Project는 migration 뒤 `진행 중`, 새 Project/복사본은 기본적으로 `예정`이 기록된다. 시트 dimension은 추가된 행까지 포함한다.

### Dependencies

관계 포함을 선택한 경우에만 relation ID, type, lag, predecessor와 successor의 WBS/name/external ID를 기록한다.

관계 제외를 선택하면 `Dependencies` sheet, 관계 전용 열, Drawing relationship을 생성하지 않는다. 관계를 제외하더라도 schedule을 재계산하지 않는다.

### Logistics

물류 구성 보고서 포함(`includeLogistics=true`)을 선택하고 프로젝트에 물류 데이터가 존재할 때 생성된다.

1. **안내 및 프로젝트/물류 구성 요약**:
   - `본 시트는 물류 구성 보고용 출력물이며, 전체 프로젝트 무손실 재가져오기(Import) 백업 파일이 아닙니다.` 안내 문구.
   - 프로젝트명, 프로젝트 ID, revision, 산출 기준일, 등록 공정 수, 등록 설비 수(총 수량), 등록 시스템 수, 태스크-물류 연결 수.
2. **공정 마스터 (Processes)**: 공정 코드, 공정명, 상위 공정 코드/명, 정렬 순서, 활성 상태, 공정 ID.
3. **설비 마스터 및 제어/역할 (Equipment)**: 설비 코드, 설비명, 유형, 관리 단위, 수량, 소속 공정 코드, 제어 시스템 및 역할, 담당 리소스 및 역할(주담당 표시), 제조사, 모델, 설명, 활성 상태, 설비 ID.
4. **물류 시스템 마스터 (Systems)**: 시스템 코드, 시스템명, 시스템 유형, 계층(Layer), 관리 범위, 담당 공정 목록, 조율 대상 시스템 목록, 담당 리소스 및 역할(주담당 표시), 공급사(Vendor), 설명, 활성 상태, 시스템 ID.
5. **태스크-물류 연결 (Task Logistics Links)**: 태스크 WBS, 태스크 명, 외부 ID, 대상 구분(설비/시스템), 대상 코드, 대상 명, 연결 범위(`self` 직접 연결 / `subtree` 하위 계층 포함 상속), 태스크 ID, 대상 ID.

보안 및 무결성을 위해 다음 원칙을 적용한다:
- 관리 code 및 public ID로 상호 관계를 검증할 수 있게 하고, 직접 연결과 파생 상속 범위를 구분한다.
- 내부 DB PK, password, session token은 일체 포함하지 않는다.
- Excel Formula Injection 방지를 위해 `=`, `+`, `-`, `@`로 시작하는 모든 사용자 텍스트 값은 `'` 접두사를 적용하여 안전하게 이스케이프한다.

## 5. 일정 및 관계 해석

- Task의 canonical `start`, inclusive `end`, working-day `duration`, `requestedStart` 의미를 유지한다.
- 현재 지원 relation contract는 `FS`, `lag=0`이다.
- 지원하지 않는 relation type/lag를 조용히 변환하지 않는다.
- collapsed UI 상태와 무관하게 Project 전체 task snapshot을 내보낸다.

## 6. 보안

Export는 읽기 작업이지만 POST body와 revision을 사용하므로 다음 보호를 적용한다.

- exact Origin 검증
- strong `If-Match` 검증
- Project canonical UUID 검증
- bounded JSON body
- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`
- edit session은 요구하지 않는다.
- Project password/session secret, 내부 DB primary key를 workbook에 포함하지 않는다.
- 사용자 입력은 formula가 아니라 inline string cell로 기록한다.
- macro/ActiveX/OLE/external workbook relationship을 생성하지 않는다.

Route security inventory에서는 `origin-if-match-read`, `mutatesState: false`로 분류한다.

## 7. 한도

현재 server-side 한도는 다음과 같다.

| 항목 | 상한 |
|---|---:|
| Task | 5,000 |
| Dependency | 20,000 |
| Timeline span | 3,650일 |
| Task × timeline cell matrix | 1,000,000 |
| Excel cell text | 32,767 code points |

한도를 초과하면 부분 파일을 만들지 않고 `EXPORT_LIMIT_EXCEEDED`로 실패한다. 지원하지 않는 일정 구조는 `EXPORT_UNSUPPORTED`로 실패한다.

## 8. HTTP response

성공 시 MIME type은 다음과 같다.

```text
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

파일명은 다음 형태다.

```text
mastergantt-{publicId}-r{revision}.xlsx
```

## 9. 검증 상태

PR #55 최종 head `6d30120bbd8b075d7a1b90ed485fddffa3ebc5b7`, GitHub Actions CI Run #252에서 다음 gate가 PASS했다.

- release version consistency
- TypeScript / ESLint
- unit test / dependency audit
- Markdown / shell validation
- production build
- Chromium E2E 전체 suite
- Docker image policy / migration / readiness / SQLite restart persistence
- production HTTP/HTTPS cookie, auth, Origin/revision transport regression
- relocated Compose persistence

Windows Excel 2021과 조직 DRM 환경에서 실제 `.xlsx` 열기 및 DrawingML 렌더링 검증은 GitHub-hosted runner로 대체하지 않으며 별도 Environment-specific Validation 항목으로 유지한다.

## Issue #345: 미산정 Summary 행

빈 Summary와 빈 Summary만 중첩된 행을 WBS/유형/이름/outline 순서대로 유지한다. canonical null 날짜·기간·진척 셀은 공란이며 Excel serial 0 또는 0%/100%로 생성하지 않는다. Gantt timeline은 날짜 있는 행만으로 계산하고 미산정 Summary bar는 그리지 않는다. 전체가 미산정이면 날짜 열 집합은 비어도 작업 행은 남는다. 실제 Task/Milestone의 날짜/기간/진척 검증과 Project direct hyperlink 계약은 유지한다.


## Issue #415 — 역할·개발자 계획 공수 견적

Excel 요청은 선택적으로 `includeResourceEffort: true`를 받을 수 있다. 생략 또는 false이면 기존 workbook 구조는 바뀌지 않는다. true이면 기존 Gantt/Tasks/Project/Dependencies/Logistics 시트 뒤에 다음 두 시트를 append한다.

- `Resource Effort Summary`: Project/Catalog revision, 조회 기간, `RESOURCE_MD_PER_MM`, 전체 및 역할별 M/D·M/M, 공수/역할 미설정 건수, 과투입 Resource 수, DEVELOPER 개인별 계획 공수를 제공한다.
- `Resource Effort Detail`: assignmentId 단위로 Task/WBS/상태/진행률/일정, Resource 식별자·코드·이름·수행 역할·개발자 등급, Group 목록, assignment 기간/투입률, canonical 유효 근무일, M/D·M/M, 지연/공수 설정 상태를 제공한다.

계산 권위는 #414 `resource-workload`와 동일한 서버 서비스다. export handler는 Project snapshot과 workload의 `projectRevision`이 동일한 경우에만 workbook을 생성하고 다르면 412로 실패한다. 여러 Resource Group에 같은 Resource가 속해도 Detail은 `assignmentId` 기준 한 행만 생성하고 Group은 쉼표 목록으로 표시한다. `RESOURCE_MD_PER_MM`이 없으면 M/D는 유지하되 M/M은 `미설정`으로 표시하며 0으로 환산하지 않는다.

모든 사용자 문자열은 기존 formula injection/cell length 보호를 그대로 거치며 내부 DB PK, edit session/password/token은 내보내지 않는다. 실제 Excel 2021/DRM 호환성은 자동 OOXML parser 검증과 별개의 Environment-specific Validation으로 관리한다.
