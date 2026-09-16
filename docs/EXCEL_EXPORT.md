# Excel Export

## 1. 상태

Issue #28에서 구현된 프로젝트 Excel 내보내기의 **현재 구현 계약**을 정의한다. 이 문서는 `docs/IMPORT_EXPORT.md`의 과거 Excel Export Phase 1 계획 중 실제 구현과 충돌하는 부분보다 우선한다.

- 적용 버전: `v0.13.0`
- API: `POST /api/projects/{publicId}/exports/excel`
- 결과 형식: `.xlsx`
- 생성 위치: Backend Node runtime
- 외부 Excel SaaS, SVAR PRO export API, ExcelJS를 사용하지 않는다.
- Node 표준 `zlib`과 내부 OOXML/ZIP writer로 workbook을 생성한다.

## 2. 사용자 흐름

프로젝트 화면의 **Excel 내보내기** 버튼을 누르면 매 실행마다 작업 관계 처리 방식을 선택한다.

1. `관계 포함`
2. `관계 제외`
3. `취소`

취소는 export 요청을 전송하지 않는다.

내보내기 직전에 최신 Project snapshot을 조회하여 revision을 확보하고, export POST 요청에는 strong `If-Match`를 전달한다. 요청 처리 중 revision이 바뀌면 `412 Precondition Failed`로 실패하며 사용자가 다시 실행해야 한다.

## 3. Request contract

```json
{
  "includeDependencies": true,
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

`scope`, `scale`, `hierarchyDisplay`는 현재 각각 `project`, `day`, `expanded`만 허용한다. Grid column ID는 `text`, `externalId`, `projectStart`, `projectDuration`만 허용하며 duplicate column은 거부한다.

## 4. Workbook 구조

첫 sheet는 `Gantt`이며 활성 sheet다.

- `Gantt`: 좌측 Grid + 우측 일 단위 timeline을 동일 작업 행으로 표현
- `Tasks`: 작업의 구조화된 원본/계산 값
- `Project`: 프로젝트 metadata, revision, timezone, holiday, export 정책
- `Dependencies`: `includeDependencies=true`일 때만 생성

### Gantt

- parent-first WBS와 sibling order를 보존한다.
- Excel outline은 최대 8개 표시 수준을 사용한다.
- 시작/종료일은 Excel native date serial로 기록한다.
- 기간은 canonical working-day duration 숫자다.
- 진행률은 숫자 percentage다.
- 주말/Project holiday를 timeline에서 구분한다.
- task/summary/milestone을 구분해 표시한다.
- 관계 포함 시 FS/lag 0 link를 DrawingML connector로 표현한다.

### Tasks

기본 열은 WBS, 작업명, 외부 ID, 유형, 시작, 종료, 근무일 기간, 진행률, 설명, URL이다. 관계 포함 시 predecessor/successor 관련 열을 추가한다.

### Dependencies

관계 포함을 선택한 경우에만 relation ID, type, lag, predecessor와 successor의 WBS/name/external ID를 기록한다.

관계 제외를 선택하면 `Dependencies` sheet, 관계 전용 열, Drawing relationship을 생성하지 않는다. 관계를 제외하더라도 schedule을 재계산하지 않는다.

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
