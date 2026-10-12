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

## Issue #345: 일정 없는 Summary

프로젝트 전체 Export는 빈 Summary와 빈 Summary만 중첩된 행도 canonical 순서/높이대로 유지한다. Grid의 일정은 —로 표시하고 Chart에는 해당 bar/진척을 그리지 않는다. timeline min/max는 실제 날짜가 있는 행에서만 계산한다. 전체가 미산정이면 renderer의 표시용 기본 범위를 사용하며 이를 Task 일정으로 저장하지 않는다. 기간 지정 Export의 기존 전 행 유지 계약은 같고 실제 Project 일정과 미교차(전체 미산정 포함)는 `EXPORT_RANGE_NO_OVERLAP`이다. PNG는 같은 SVG를 사용하므로 null을 숫자 날짜나 0% bar로 바꾸지 않는다.

## Issue #464 JSON 형식과 단계 출력의 범위 구분

공통 내보내기 대화상자는 Excel·JSON·SVG·PNG를 제공한다. SVG/PNG의 기존 scope/date/scale·Grid와 Chart·이미지 크기·revision·readonly 계약은 유지한다. JSON은 `POST /api/projects/{publicId}/exports/json`에 `{scope:"project"}`만 전송하므로 이미지 날짜 범위와 시간 단위 선택을 표시하지 않는다. 최신 snapshot을 조회한 뒤 그 revision의 `If-Match`로 전체 JSON 1.1을 다운로드한다.

JSON은 전체 schedule-stage 교환용이다. Description·URL·Baseline·Task/Link·명시 Membership을 포함하며 Resource/Logistics 배정은 제외한다. source Task UUID는 참고 metadata이고 Import 대상에서는 새 ID를 생성한다. legacy mixed Dependency가 최신 export snapshot에 존재하면 원형 보존과 현재 외부 Import 전체 거부를 다운로드 전에 설명한다. 확인한 동일 revision만 사용하고 412에는 확인을 폐기한다. 원본 Link를 사용자 모르게 삭제하거나 같은 파일을 재가져올 수 있다고 안내하지 않는다.

Excel에서는 명시·유효 소속 및 상속 출처와 Milestone 요약을 일정 Dependency 선택과 독립 출력한다. Milestone 요약의 기본값은 서버 전체 Project 공수, 오늘 Project timezone 기준, horizon 14일 및 서버 M/M 환산 기준이다. 화면 Dashboard의 S 표시 선택/F 공수 조건/수동 평가일을 전송하지 않으며 해당 차이를 Excel 선택 직후 표시한다. 이 추가 형식은 이미지 Export에 새로운 기간·공수 계산을 도입하지 않는다.

SVG/PNG의 전체 Grid는 기존 고정 `exportLayout`의 작업명 224px·시작일 128px·기간 84px만 출력한다. live Grid의 선택 열·사용자 조절 폭·Milestone 열 전체를 그대로 출력하는 계약이 아니다. 표시 이름/유형/일정 값은 같은 canonical snapshot에서 가져오며 Milestone 소속 상세는 Excel/JSON으로 제공한다. 이 경계를 이미지 형식 선택 직후 안내한다. Dashboard 전용 이미지 exporter와 새로운 image stage column/API는 #464 범위 밖이다.

## Issue #491 이미지 옵션 presentation

SVG/PNG 날짜 범위의 기존 label/control/error 연결과36px compact 입력을 유지하고 footer peers에12px gap을 둔다. 390px action stack,390/1440 native 날짜 Tab ring과 실제 readonly SVG/PNG200 다운로드·서명, pending 빠른2Escape와412 재실행 근거는 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)에 있다. 날짜 범위·서버 XML 안전성·PNG pixel 한도·object URL cleanup·canonical 전체 scope 계약은 변경하지 않았다. C header가 native fullscreen host 밖이므로 fullscreen중 이 dialog 직접 진입은 N/A이며 Gantt fullscreen 버튼 왕복 보존과 구분한다.

Issue #491의 최신 검증 기준은 main `d8d0bb3bab5d13ca68a6b319e116dec4ca24d48d`/0.94.4이며 제품4/spec/helper byte를 유지한 after-current8case PASS다. 역사적0.94.3 증거와 최신 선택 관측은 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)에서 구분한다. 템플릿 instantiate는 실제 navigation·편집 상태·원본 불변을 확인했으며201은 서버 계약값으로 response.status 직접 검증이 아니다. 공식 원격 CI와 최신 독립 QA는 별도 판정 전까지 NOT TESTED다.

Issue #491의 두 번째 통합 최신 기준은 main `61a5f511d79e1f9429635bb0da35c0c02ee2163c`/0.95.1이다. 기존 #492 HoverTooltip 변경을 보존하고 동일 소비자 제품4/spec/helper로 새8case PASS를 확인했다. 이전0.94.3/0.94.4는 역사적 검증으로 보존하며 총10run61case(50PASS/11원래FAIL)와 최신 관측은 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)를 따른다. create/copy/instantiate201의 간접 근거와 직접 response.status 검증은 구분한다. 공식 CI와 최신 독립 검토는 별도다.
