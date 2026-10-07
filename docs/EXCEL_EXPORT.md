# Excel Export

SVG/PNG Gantt 내보내기 계약은 [IMAGE_EXPORT.md](IMAGE_EXPORT.md)를 따른다. 이 문서의 Excel workbook, 관계 포함/제외 및 물류 구성 보고서 옵션은 유지한다.

## Issue #464 — 단계 소속과 같은 스냅샷 보고

초기 #460의 Membership 전체 차단을 보존 출력으로 대체한다. production route는 `ProjectExportSnapshotService`의 하나의 SQLite deferred read transaction과 한 번의 clock 조회에서 canonical Project snapshot, #463 `MilestoneDashboardDto`, 선택적 Resource workload를 가져온다. Project revision과 Catalog revision이 다르면 412로 실패한다. 이 보고용 조회는 Project·Task·Link·Membership·Assignment를 변경하지 않는다.

Milestone 또는 명시/유효 Membership이 있는 snapshot에 Stage DTO가 없으면 전체 export를 실패한다. handler는 `500 CONFIGURATION_ERROR`, 직접 builder는 `EXPORT_UNSUPPORTED`를 반환한다. builder는 Project public ID/revision, 선택 Resource workload의 Catalog revision, 전체 Milestone/ordinary Task ID 집합, canonical Stage Gate 및 기본 전체 범위를 확인한다. 운영 경로는 같은 read transaction에서 현재 Catalog revision도 검증한다. DTO가 없는 기존 무단계 fixture는 기존 시트 구성을 유지한다.

`Tasks`는 기존 열과 선택적 Dependency 열 뒤에 Task ID, 부모 external ID, 요청 시작일, leaf 상태/Baseline, 명시 단계 ID/external ID, 유효 단계 ID/external ID 및 상속 출처 ID/external ID를 추가한다. 유효·상속 값은 파생 표시이며 명시 연결로 평탄화하지 않는다. Summary의 leaf Baseline 열은 공란이다. Membership은 `includeDependencies=false`에서도 항상 출력한다.

새 `Milestone Stages` 시트는 production bundle의 #463 DTO를 그대로 표현한다. 전체 E(M)/P(M)의 Ready·blocked·manual·완료 불일치·구성원 상태·기간합/가중진척합과 위험 Task/날짜, KPI 분자·분모·퍼센트 및 ID 집합을 보존한다. 공수는 서버 기본 전체 F의 raw M/D·M/M, Grand Total, 모든 단계 bucket과 미지정 bucket, 역할별 값·assignment ID·투입률 미설정 ID/수 및 assignment별 상세다. Excel 전용 집계 알고리즘이나 반올림 Ready 판정은 없다. 날짜/검색/Resource 등 현재 Dashboard 화면 조건은 Excel에 전달하지 않는다.

metadata는 Project/Catalog revision, calculatedAt, Asia/Seoul, asOfDate, horizonDays=14, 실제 workload from/to, normalized default filters, MD/M 환산값과 query/environment/unset 출처, 전체 Gate와 F 공수의 계산 범위를 포함한다. null denominator·manual Ready·미설정 M/M는 공란과 안내로 표시하고 0으로 대체하지 않는다. 기존 Resource Effort 시트의 네 자리 반올림/조회 기간은 별도 기존 정책이며 단계 시트의 raw 숫자와 구분한다.

ID 목록은 셀 하나에 이어 붙이거나 자르지 않고 분류·단계·역할·ID별 행으로 출력한다. 단계 시트는 header/metadata/detail을 포함해 50,000행까지 허용한다. 기존 32,767 code point 셀 한도와 Gantt Task/timeline 한도를 유지하며 초과는 전체 `EXPORT_LIMIT_EXCEEDED`다. 새 문자열은 XML escape된 `inlineStr`로 기록하고 `=`, `+`, `-`, `@`, 한글·Unicode·CRLF를 원문 그대로 보존한다. 기존 Logistics/Resource Effort의 apostrophe prefix 정책은 유지한다.

Excel은 보고용 파일이다. 일정·단계 authoritative 재가져오기에는 JSON 1.1을 사용하며 Resource/Logistics가 포함된 전체 운영 백업이라고 안내하지 않는다. 새 Project direct hyperlink는 이번 범위에서 구현하지 않는다. 실제 Windows Excel/VBA/DRM 파일 열기·표시 검증은 NOT TESTED다.

## 1. 상태

Issue #28에서 구현된 프로젝트 Excel 내보내기의 **현재 구현 계약**을 정의한다. 이 문서는 `docs/IMPORT_EXPORT.md`의 과거 Excel Export Phase 1 계획 중 실제 구현과 충돌하는 부분보다 우선한다.

- 최초 구현 버전: `v0.13.0`; 단계 보존 확장: `v0.89.0`
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
- `Milestone Stages`: 같은 스냅샷 Stage DTO가 공급되면 기존 시트 뒤에 append; production route는 항상 공급

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

기존 기본 열은 WBS, 작업명, 외부 ID, 유형, 시작, 종료, 근무일 기간, 진행률, 설명, URL이다. 관계 포함 시 predecessor/successor 관련 열을 추가한 뒤 #464의 보존 열을 append한다. 기존 열 순서와 날짜/계층 해석을 유지한다.

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
- 기존 Logistics 출력의 Excel Formula Injection 방지를 위해 `=`, `+`, `-`, `@`로 시작하는 사용자 텍스트 값은 `'` 접두사를 적용하여 안전하게 이스케이프한다.

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
| Milestone Stages 시트 행 | 50,000 |

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

빈 Summary와 빈 Summary만 중첩된 행을 WBS/유형/이름/outline 순서대로 유지한다. canonical null 날짜·기간·진척 셀은 공란이며 Excel serial 0 또는 0%/100%로 생성하지 않는다. Gantt timeline은 날짜 있는 행만으로 계산하고 미산정 Summary bar는 그리지 않는다. 전체가 미산정이면 날짜 열 집합은 비어도 작업 행은 남는다. 실제 Task/Milestone의 날짜/기간/진척 검증은 유지한다. 현재 workbook에 Project direct hyperlink를 생성했다고 주장하지 않는다.


## Issue #415 — 역할·개발자 계획 공수 견적

Excel 요청은 선택적으로 `includeResourceEffort: true`를 받을 수 있다. 생략 또는 false이면 기존 workbook 구조는 바뀌지 않는다. true이면 기존 Gantt/Tasks/Project/Dependencies/Logistics 시트 뒤에 다음 두 시트를 append한다. #464의 Milestone Stages 시트는 그 뒤에 위치한다.

- `Resource Effort Summary`: Project/Catalog revision, 조회 기간, `RESOURCE_MD_PER_MM`, 전체 및 Global Role별 M/D·M/M, 공수/Global Role 미설정 건수, 과투입 Resource 수, DEVELOPER 개인별 계획 공수를 제공한다.
- `Resource Effort Detail`: assignmentId 단위로 Task/WBS/상태/진행률/일정, Resource 식별자·코드·이름·Global Role 집합·개발자 등급, Group 목록, assignment 기간/투입률, canonical 유효 근무일, M/D·M/M, 지연/공수 설정 상태를 제공한다.

계산 권위는 #414 `resource-workload`와 동일한 서버 서비스다. Global Role subtotal은 복수 역할 Resource의 동일 assignment가 여러 분류에 포함될 수 있는 비가산 보기이며, subtotal 합으로 Grand Total을 계산하지 않는다. export handler는 Project snapshot과 workload의 `projectRevision`이 동일한 경우에만 workbook을 생성하고 다르면 412로 실패한다. 여러 Resource Group에 같은 Resource가 속해도 Detail은 `assignmentId` 기준 한 행만 생성하고 Group은 쉼표 목록으로 표시한다. `RESOURCE_MD_PER_MM`이 없으면 M/D는 유지하되 M/M은 `미설정`으로 표시하며 0으로 환산하지 않는다.

모든 사용자 문자열은 기존 formula injection/cell length 보호를 그대로 거치며 내부 DB PK, edit session/password/token은 내보내지 않는다. 실제 Excel 2021/DRM 호환성은 자동 OOXML parser 검증과 별개의 Environment-specific Validation으로 관리한다.

## Issue #464 Local Fast Feedback

`tests/server/projects/project-excel-stage.test.ts`는 실제 native SQLite에서 세 Milestone 병렬→합류, Summary 중첩 상속과 Task override, 개인 Resource와 두 Group, 미설정 투입률을 구성해 같은 read transaction/clock1회·source 불변을 검증한다. Dependency true/false의 Membership·leaf baseline·상태·Unicode 원문, Dashboard raw totals/null/KPI/ID, 1,000개 구성원 ID의 행별 보존과 텍스트/50,000행 초과 거부, readonly HTTP 200/no-store/ETag/filename·403/412/미설정500을 포함한다. 기존 Logistics/Resource Effort/Project status/ISO week 회귀도 실행한다. 최초 실패와 보완 후 결과는 Issue/PR 검증 근거에서 구분한다. Local PASS는 GitHub Actions quality/e2e/docker 또는 실제 Windows Excel 표시 PASS를 대체하지 않는다.

## Issue #491 Export 옵션 presentation

로컬 footer gap12px과390px action stack을 유지하며 Dependency/Logistics/Resource Effort choice는 기존 browser-native control과 연결 label을 사용한다. readonly 실제 Excel200 다운로드/PK 서명 및 이미지·JSON과 구분한 pending/412, local compact36px 입력의 KEEP 근거는 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)를 참조한다. workbook 수식 안전성·서버 공수 권위·M/D/M/M·Origin/If-Match·출력 범위/시트 계약은 변경하지 않았고 실제 Windows Excel/VBA/DRM 및 전체 workbook 회귀를 새 로컬 PASS로 주장하지 않는다.

Issue #491의 최신 검증 기준은 main `d8d0bb3bab5d13ca68a6b319e116dec4ca24d48d`/0.94.4이며 제품4/spec/helper byte를 유지한 after-current8case PASS다. 역사적0.94.3 증거와 최신 선택 관측은 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)에서 구분한다. 템플릿 instantiate는 실제 navigation·편집 상태·원본 불변을 확인했으며201은 서버 계약값으로 response.status 직접 검증이 아니다. 공식 원격 CI와 최신 독립 QA는 별도 판정 전까지 NOT TESTED다.

Issue #491의 두 번째 통합 최신 기준은 main `61a5f511d79e1f9429635bb0da35c0c02ee2163c`/0.95.1이다. 기존 #492 HoverTooltip 변경을 보존하고 동일 소비자 제품4/spec/helper로 새8case PASS를 확인했다. 이전0.94.3/0.94.4는 역사적 검증으로 보존하며 총10run61case(50PASS/11원래FAIL)와 최신 관측은 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)를 따른다. create/copy/instantiate201의 간접 근거와 직접 response.status 검증은 구분한다. 공식 CI와 최신 독립 검토는 별도다.
