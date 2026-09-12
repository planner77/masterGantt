# W24 Project Grid, Protected Delete and Hierarchical Gantt UI

Version `0.6.0`, 2026-09-12. 상태: **LOCAL PASS / Independent QA PASS / Manager ACCEPT**. 원격 이미지 검증은 별도이다.

## Confirmed scope

- Project 목록 표/Grid, 권한 있는 Project의 명시적 확인 후 삭제.
- SVAR Grid Header `+` root 생성, 행 `+` child 생성(사용자 확정).
- 최초 자식 생성 시 Task→Summary 전환 확인과 원자적 저장, 중첩 조상 일정/진척 집계.
- 외부 ID column 선택, 기본 오늘/1일, Chart 주말 음영, locale 날짜 표시.
- 접힌 설정과 고정 Project/Grid/Chart headers 및 내부 세로 scroll.

## Boundaries

Project 삭제는 기존 session/Origin/If-Match 검증과 transaction cascade를 사용한다. 현재 단일 edit cookie 정책은 바꾸지 않는다. 원본 사용자 DB에서 삭제 테스트를 수행하지 않는다. Calendar의 Auto 비근무일 보정은 유지한다. Milestone parent, 마지막 child 단독 삭제, Summary 일정 직접 편집/삭제와 reparent/FS는 이번 범위에서 허용하지 않는다. Summary 이름만 수정하는 API는 허용한다. Project 전체 삭제는 종속 Summary/Task까지 제거한다.

## Verification

- `npm test`: 28 files / 378 tests PASS. 계층 경계·권한·삭제 cascade/rollback·Project 격리 및 저장 데이터 손상 7종 무변경 거부 포함.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run version:check`, Markdown local-link 검사, `git diff --check`: PASS.
- 독립 QA의 Security/Domain 검토: blocker 없음. 저장 Leaf 검증 누락 지적을 반영하고 회귀 테스트를 보강했다.
- Chromium E2E: 전체 **10 PASS (54.0s)**. Native Header/row 추가, 오늘/1일 기본값, 최초 Summary 전환 확인, 저장·reload·Grid/Chart 표시, 실제 pointer 이동/resize·거부 복원·revision 경쟁, 목록·삭제 경고/권한을 검증했다.
- ko-KR/Asia-Seoul 및 en-US/America-New-York 각각 60개 Task에서 locale/date-only, canonical 5근무일, 주말 음영, 외부 ID toggle, Project/Grid/Chart header의 scroll 전후 위치, 상단 정보/설정 가시성과 viewport 내부 높이를 검증했다. Manager가 실제 screenshot도 확인했다.
- 이 환경의 Playwright 실행에는 기존 설치 Chromium 경로를 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`로 지정했다. CI는 workflow에서 설치한 Chromium을 사용하며 원격 결과를 별도 확인한다.
- 사용자 SQLite DB 대신 격리된 `.data/playwright.sqlite3`와 mock snapshot을 사용한다. 실제 사용자 프로젝트를 삭제하지 않는다.

## Findings resolved

SVAR 기본 날짜 열의 내장 형식 우선 문제는 locale 사용자 정의 열로 해결했다. 기간은 SVAR의 elapsed calendar duration이 아닌 canonical snapshot의 근무일 수를 표시한다. 목록의 locale store snapshot은 안정된 문자열로 바꿔 무한 렌더링을 막았다. Native `add-task`는 기본 로컬 저장을 취소하고 입력 dialog와 보호 API, canonical snapshot 경로를 사용한다. Create payload의 `type: task`를 필수화하고 interceptor 준비 후에만 `+`를 노출한다. 최초 부모 전환은 명시 확인을 요구한다. Dialog는 native modal/focus 처리, 설정 패널은 높이 제한을 적용한다. Flex 높이 전달과 Willow wrapper selector를 수정하고 상단 정보를 shrink하지 않도록 하여 실제 남은 공간을 차트에 할당한다.

## Release boundary

소스 버전은 additive 기능 확장에 따라 `0.6.0`이다. 이 문서의 로컬 검증은 GHCR `v0.6.0` exact release 게시를 의미하지 않는다. Main push CI와 immutable commit image 결과는 별도로 확인한다. 기존 `v0.4.0` 이미지는 W24 기능을 포함하지 않는다.

## Sources

SVAR Core [columns](https://docs.svar.dev/react/gantt/api/properties/columns/), [intercept](https://docs.svar.dev/react/gantt/api/methods/intercept/), [highlightTime](https://docs.svar.dev/react/gantt/api/properties/highlighttime/)와 설치 2.7.3 public API/type을 확인했다. PRO 소스에 의존하지 않는다.
