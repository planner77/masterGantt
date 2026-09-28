# Gantt SVG/PNG 내보내기

Issue #245의 이미지 내보내기 계약이다. 기존 Excel workbook 계약은 [EXCEL_EXPORT.md](EXCEL_EXPORT.md)를 따른다.

## 사용자 흐름

Project 화면의 `내보내기`에서 Excel, SVG, PNG를 선택한다. Excel은 기존 관계 포함/제외 선택을 유지한다. SVG/PNG는 `프로젝트 전체` 또는 `기간 지정`을 선택한다. 전체 산출물은 canonical WBS의 모든 작업을 펼친 Grid와 전체 Chart를 포함한다. 기간 지정 산출물은 지정한 날짜의 Chart만 포함하며, 작업 행은 검색하거나 걸러내지 않는다. 화면의 scroll, 접기, 선택 상태는 결과에 영향을 주지 않는다.

SVG와 PNG는 같은 서버 SVG를 사용한다. PNG는 브라우저에서 SVG를 `Image`로 읽어 Canvas에 그린 뒤 `image/png` Blob으로 만든다. 외부 변환 서비스나 SVAR PRO export를 호출하지 않는다. 성공·취소·실패 모두 생성한 object URL을 해제한다.

## 요청과 응답

`POST /api/projects/{publicId}/exports/gantt-svg`는 readonly Project canonical snapshot을 사용한다. 실행 직전 `GET /api/projects/{publicId}`로 최신 revision을 읽고, export POST에는 exact `Origin`과 strong `If-Match: "<revision>"`을 보낸다. edit session은 필요하지 않다. 요청 JSON은 8 KiB 이하이고, 알 수 없는 필드를 거부한다.

```json
{"scope":"project","scale":"day","hierarchyDisplay":"expanded"}
```

```json
{"scope":"range","startDate":"2026-09-01","endDate":"2026-09-30","scale":"week","hierarchyDisplay":"expanded"}
```

`scope`은 `project`/`range`, `scale`은 `day`/`week`, `hierarchyDisplay`는 `expanded`만 허용한다. 기간 날짜는 Project의 date-only, inclusive 계약을 따른다. 시작일이 종료일보다 늦거나 Project 일정과 겹치지 않으면 파일을 생성하지 않는다. 기간 지정은 timeline의 수평 경계를 정하며 Bar, Milestone, Link와 scale은 그 경계에서 clip한다.

성공 응답은 `image/svg+xml; charset=utf-8`, `Content-Disposition: attachment`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, 해당 revision의 `ETag`를 포함한다. 기본 파일명은 `mastergantt-{publicId}-r{revision}.svg`이고 기간 지정에는 `-{startDate}-{endDate}`를 확장자 앞에 붙인다. PNG는 같은 basename에 `.png`를 쓴다. Revision이 달라지면 `412 REVISION_MISMATCH`이며 사용자가 다시 실행한다.

## 렌더링과 안전성

서버는 SQLite 읽기 transaction에서 canonical snapshot DTO를 확보한 뒤 transaction 밖에서 결정적 SVG geometry를 생성한다. Grid에는 WBS/작업명, 시작, 기간을 표시한다. Chart에는 Timeline, 비근무일, Summary/Task/Milestone, 진행률, 지원되는 dependency를 표시한다. 현재 지원 관계는 FS/lag 0이다. 동일 snapshot과 요청은 동일한 좌표 및 SVG를 만든다.

사용자 문자열은 XML text로 escape하고 XML에서 허용하지 않는 제어 문자는 치환한다. SVG에는 script, event handler, `foreignObject`, 외부 image/font/CSS/URL 또는 사용자 HTML을 넣지 않는다. URL과 password/session/secret은 SVG hyperlink나 metadata로 내보내지 않는다. 응답 실패에서는 파일을 다운로드하지 않는다.

## 한도와 검증

서버는 Task 5,000개, Link 20,000개, Timeline 3,650일, Task×날짜 1,000,000셀, SVG 한 변 16,384px, SVG 16 MiB, text 32,767 Unicode code point를 상한으로 둔다. 초과는 `422 EXPORT_LIMIT_EXCEEDED`, 지원되지 않는 canonical 구조는 `422 EXPORT_UNSUPPORTED`, 선택 기간과 Project 일정의 미교차는 `422 EXPORT_RANGE_NO_OVERLAP`으로 처리한다. 브라우저는 PNG의 한 변 16,384px 및 총 32,000,000 pixel을 SVG decode 전에 검사하고 초과 시 더 짧은 기간 또는 SVG 내보내기를 안내한다. Canvas는 흰 배경 위에 그린다.

서버 Unit/API 검증은 hierarchy 순서, geometry·clip, XML 안전성, 유효하지 않은 기간, revision/Origin, 크기 제한과 Excel 회귀를 포함한다. Chromium E2E는 Excel/SVG/PNG 선택·다운로드, 이미지 크기/서명, keyboard·focus/Escape, 반응형 header와 기존 Gantt 상태를 검증한다. PR 원격 `quality/e2e/docker` 결과는 해당 head에서 별도로 판정한다.
