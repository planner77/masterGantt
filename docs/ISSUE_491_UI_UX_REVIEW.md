# Issue #491 프로젝트 생성·복사·템플릿·입출력 폼 검토

2026-10-07 기준 로컬 구현과 최종 Chromium 8case는 PASS다. 원격 PR `quality/e2e/docker`, 독립 QA 최종 승인, 실제 운영·Windows Excel/VBA/DRM·native 125% 확대·실기기·스크린리더 검증은 NOT TESTED다. PR CI 등록은 전체 회귀 PASS나 Issue 종료를 뜻하지 않는다.

역사적 before/after의 기준 main은 `44b2ee3562cf76a73368a49fa17933ed341ab424`, tree는 `ed88528bdd834442764f50edd687dd43c206d3d0`, before 제품은 `0.94.2`, after 제품은 `0.94.3`이다. 작업 브랜치는 `fix/issue-491-project-transfer-layout`이다. 정식 release는 필요하지만 승인되지 않았다(`release_required=true`, `release_authorized=false`).

## FIX·KEEP·지원 경계

| 표면 | 실제 관측과 판정 | 구현 범위 |
| --- | --- | --- |
| 템플릿 저장 | 마지막 표시 field→footer와 취소/저장 버튼 gap이 5폭 모두 0px였다. after는 각각 12px, 같은 행 top/height 차이는 1px 이하다. FIX | 소비자 전용 form grid·footer flex/wrap/gap. TSX 변경은 module import와 form/footer class뿐 |
| Excel·JSON·이미지 Export | 같은 행 footer gap0px, 390px 세로 버튼 gap0px였다. after는 12px다. FIX | 기존 local CSS module의 action group만 변경; 390px grid stack 유지 |
| JSON Import preview | native Tab region ring `3px + offset3px`가 390/1440px에서 좌우 2px, 390px에서 아래 6.5px 잘렸다. after 두 폭의 clipping owner 침범은 0이다. FIX | body padding8px/scroll-padding8px, table-owned scroll margin8px; 960px table 최소 폭과 body/footer 소유 유지 |
| 빈 프로젝트 생성 | 긴 name/description, validation, pending 비밀번호 비움·중복 POST1회, 방식 탭 Arrow/Home 및 초안 보존, 실제 생성201. KEEP | 제품 변경 없음 |
| 프로젝트 복사 | loading·긴 입력·validation·pending 빠른 Escape2회·500/401/412·readonly, 실제 복사201와 원본 snapshot 불변. KEEP | 제품 변경 없음 |
| 템플릿 목록·선택·생성 | loading/error/empty와 큰 표시 count fixture, native radio/Tab, validation·pending·실제 instantiate navigation·편집 상태·원본 불변(201은 서버 계약값이며 response.status 직접 검증 아님). KEEP | 제품 변경 없음 |
| Export 입력과 choice | 로컬 compact select/date 36px는 경계·padding·native focus를 갖춘 기존 variant다. native radio/checkbox 13px와 연결 label을 유지한다. KEEP | 전역 40px 강제나 native choice restyle 없음 |
| 공수 옵션 | 실제 빈 workload/M/M 미설정, inline 개발 견적·M/D/M/M·기간/필터와 서버 응답을 복제한 큰 표시값 fixture를 구분했다. KEEP | 별도 견적 dialog 없음; 공수 알고리즘/Resource table/domain 변경 없음 |

공용 dialog/busy guard, global CSS, Gantt controller, API·DB·schema·scheduling·auth·revision·Export 수식 안전성·서버 공수 권위는 수정하지 않았다. 설치된 Next `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`의 CSS Modules와 client guide를 먼저 읽고 기존 Light/system font/semantic token을 유지했다. 실제 설치 SVAR React Gantt Core `2.7.3`/store `2.7.2`를 사용하며 PRO 기능을 복제하지 않았다. 공식 자료 URL 참조는 [UI/UX 가이드](UI_UX_GUIDELINES.md)의 SVAR 항목을 따르며 공식 demo의 직접 조작 PASS로 확대하지 않는다.

## 인수 기준과 실행 범위

| AC | 실제 증거와 조건 |
| --- | --- |
| 실제 before와 FIX/KEEP/FOLLOW-UP | 7개 지원 표면을 위 표로 분리하고 새 견적 modal/CSV mapping을 구현했다고 주장하지 않는다 |
| 5폭·긴 입력·큰 값·관련 상태 | 390/768/1024/1440/1920px, 높이900px. 모든 상태×모든 표면 교차 실행은 아니다. 상태별 geometry의 정확한 key와 환경은 아래 aggregate에 있다 |
| label/error/간격/overflow | text/date/select/textarea 경계·padding·label 및 aria-describedby 실재, footer gap≥11px·같은 행 top/height≤1px, 마지막 field/footer gap≥11px를 assertion으로 검증한다. native choice는 label/nonzero size/browser appearance로 검증한다 |
| keyboard·pending·초안 | native Tab/ShiftTab focus는 대표390/1440px에서 직접 측정한다. Export 날짜, 템플릿 description, Import region의 viewport·clipping owner를 확인한다. create/template 방식과 radio keyboard, modal Escape/호출자 복원 및 busy 빠른2Escape를 실제 조작한다 |
| 교환/API 의미 | 실제 create/copy/template save201 및 instantiate navigation·편집 상태·원본 불변, preview 성공·commit201, readonly Excel/JSON/SVG/PNG200 다운로드를 검증한다. Copy/template 원본 불변, Import 기존 Task/Link 불변·새 Task1개와 instance/API/scale 유지, CSV415를 확인한다. controlled401/412/500/held request는 실제 성공 API와 구분한다 |
| Gantt 상태 | 실제 Summary scope·optional 외부ID 열·native48px resize·닫힌 중첩 Summary·native 선택·주 scale·scroll120/38·public viewport·instance/API를 준비하고 dialog 취소/템플릿 저장 성공/전체 화면 버튼 왕복에서 동일 state를 비교한다 |

5폭 캡처는 full-page 관찰용도 포함한다. resize 후 viewport 밖에 남은 기존 focus는 keyboard PASS로 세지 않는다. `*-native-focus`는 각 폭에서 실제 ShiftTab/Tab으로 다시 접근하고 화면 안 rect와 ring owner를 검증한다. Source의 프로그램적 오류 focus 복원과 genuine native Tab은 별개다. JSON/PNG는 input 값·password/Cookie/token/session/request body를 기록하지 않고 synthetic fixture의 label/geometry·safe method/path/Origin/If-Match/status/boolean만 사용한다.

### 상태별 기존 정책

- 생성·복사·템플릿 instantiate 성공은 새 publicId navigation이다. 같은 Gantt instance 유지나 사라진 trigger 복원은 N/A다.
- 복사/템플릿 저장 412는 최신 원본 조회와 명시 재제출을 요구하고 같은 열린 dialog의 비민감 초안을 보존한다. 민감 입력은 기존 정책대로 비운다. 처음 name field가 활성이어도 source-ready 제출 버튼이 아직 비활성일 수 있다.
- Import preview는 취소/abort 가능하고 commit은 busy 상태에서 닫기와 빠른2Escape를 막는다. 401/412에서는 파일을 보존하며 preview 동의를 폐기하고 새 검토를 요구한다. 자동 mutation 재시도는 하지 않는다.
- readonly Export는 지원한다. 412는 옵션을 보존하고 명시 재실행한다. 실제 다운로드 성공은 dialog를 닫으므로 각 형식은 trigger를 다시 열어 검증했다.
- inline 공수의 개발 견적은 표시 preset이다. 부분 날짜와 뒤집힌 날짜의 기존 안내 및 서버 합계/표시 subtotal 구분을 유지한다. partial source failure/stale의 전체 회귀와 공수 계산 알고리즘은 이 CSS 변경의 로컬 완료 범위로 확대하지 않았다.

## 실행 이력과 provenance

[실행 이력](../output/playwright/issue-491/review/runs.json)은 8회/45case, 34 PASS/11 FAIL의 원래 수치를 보존한다. 최종 after8 PASS는 앞선 FAIL을 소급 변경하지 않는다.

| 실행 | case | PASS/FAIL | 기록된 전체 시간 | 목적/최초 원인 |
| --- | ---: | --- | --- | --- |
| before-run1 | 3 | 2/1 | 52.0s | source-ready 전에 민감 입력을 채워 초기화와 충돌한 oracle |
| before-run2 | 8 | 4/4 | 5.1m | Export 성공 close, preset 필터2 locator, Task fixture progress 누락400, 닫힌 More의 hidden fileinput 진입 |
| before-run3 | 4 | 2/2 | 1.5m | select label의 option 문구와 이미 열린 More를 다시 닫는 helper |
| before-run4 | 2 | 1/1 | 34.9s | headless keyboard Escape가 브라우저 fullscreen 종료를 호출하지 않음 |
| before-final | 8 | 8/0 | 2.4m | 지원 fullscreen 종료 버튼을 포함한 전체 before |
| before-targeted | 4 | 4/0 | 1.3m | gap/region owner 강화를 위한 대상3개와 정규식에 함께 포함된 Gantt1개 |
| after-run1 | 8 | 5/3 | 2.0m | native radio/checkbox에 text-field border/padding assertion을 잘못 적용 |
| after-final | 8 | 8/0 | 2.5m | after-only native choice 분류 정정 후 최종 전체 |

동일하게 유지한 spec SHA256은 `1fb2342eff3fcec3f8b23878d492f6e546c4209f58157905f452537ee42c73f9`이고 helper는 `8d7a5f18dc16b2b210b7d075dcc7349060dd7f9f2363280c9b91cf5e4f0f8e29`다. 강화 before-targeted helper `d89a89406aa74486bd0eca1d928ccab4ce18eab82f8188a899854ed39f2253e8`와 최종 after helper는 byte가 다르다. 변경은 after-only native choice assertion이며 before facts에 이미 있던 `c.type`을 사용한다. 관측 함수와 제품4파일을 바꾸거나 baseline을 재작성하지 않았다. 수정 표면의 before-targeted와 나머지 before-final 관측을 재사용한 이유와 당시 spec/helper SHA를 aggregate와 runs에 그대로 남긴다. 서로 다른8case의 모든 before/after helper가 같았다고 주장하지 않는다.

실제 환경은 Linux host, Node `v22.14.0`, Next `16.3.8`, React `19.3.0`, Playwright `1.63.0`, Chromium `153.0.8010.12`, locale `ko-KR`, timezone `Asia/Seoul`, DPR1/root16px/visualViewport scale1/default100%다. Desktop Chrome preset의 Windows userAgent는 실제 Windows 환경 검증이 아니다. before source323과 after source324의 실제 파일별 SHA는 [source provenance](../output/playwright/issue-491/review/source-provenance.json)에 있다. 신규 CSS module도 `rg --files src` inventory에 포함한다.

## 게시 선택 증거

[선택 manifest](../output/playwright/issue-491/review/selection.json)은 원래 PNG byte/hash와 source 파일을 연결한다. 중복 source inventory를 제거한 [before geometry](../output/playwright/issue-491/review/before-geometry.json)와 [after geometry](../output/playwright/issue-491/review/after-geometry.json)는 5폭 관측과 실제 clipping/footer 수치를 보존한다. [before API/state](../output/playwright/issue-491/review/before-contracts.json)와 [after API/state](../output/playwright/issue-491/review/after-contracts.json)는 실제 성공과 controlled 상태를 구분한다.

| 대표 비교 | before | after |
| --- | --- | --- |
| 템플릿 field/footer,390 | [PNG](../output/playwright/issue-491/review/before-template-save-long-390.png) | [PNG](../output/playwright/issue-491/review/after-template-save-long-390.png) |
| Export 세로 actions,390 | [PNG](../output/playwright/issue-491/review/before-export-image-range-390.png) | [PNG](../output/playwright/issue-491/review/after-export-image-range-390.png) |
| Export 날짜 native focus,1440 | [PNG](../output/playwright/issue-491/review/before-export-date-native-focus-1440.png) | [PNG](../output/playwright/issue-491/review/after-export-date-native-focus-1440.png) |
| Import native ring,390 | [PNG](../output/playwright/issue-491/review/before-import-table-native-focus-390.png) | [PNG](../output/playwright/issue-491/review/after-import-table-native-focus-390.png) |
| Import native ring,1440 | [PNG](../output/playwright/issue-491/review/before-import-table-native-focus-1440.png) | [PNG](../output/playwright/issue-491/review/after-import-table-native-focus-1440.png) |
| 실제 Gantt 상태,1440 | [PNG](../output/playwright/issue-491/review/before-gantt-state-1440.png) | [PNG](../output/playwright/issue-491/review/after-gantt-state-1440.png) |

원래 8회 raw 캡처는 기존 `output/playwright/issue-491/<run>`에 남기고 selection 밖 파일은 게시하지 않는다. 원래 stdout/HTML/results/trace는 실행별 `/tmp/issue491-<run>`에 hash와 함께 보존하며 미게시다. 실패·부분 캡처를 덮어쓰거나 삭제하지 않았다. 기존 tracked output1063, source의 승인 범위 밖 bytes, generated `next-env.d.ts`/`tsconfig.json`, 다른 worktree/root 산출물을 보존했다.

## N/A와 미검증

- CSV 웹 mapping/preview/commit은 지원하지 않는다. JSON chooser와 실제 text/csv415를 확인했다. CSV/VBA producer POC를 웹 구현으로 보고하지 않는다.
- 별도 역할/리소스 공수 견적 modal은 없고 inline/Excel 포함 checkbox가 지원 표면이다. 공수 계산 권위·M/D/M/M 기준은 기존 서버 계약이다.
- C header entry는 실제 fullscreen host 밖이며 hit-test도 해당 header를 받지 않았다. fullscreen 안 C modal 직접 진입은 N/A다. 지원 fullscreen 버튼 진입/종료의 상태 보존 PASS와 구분한다. headless keyboard Escape의 브라우저 fullscreen 종료는 원래 FAIL/환경 제한을 보존하고 NOT TESTED로 남긴다.
- API/DB/security/schema/scheduling 및 수식/계산 문서의 계약 수정은 N/A다. [JSON Import](JSON_IMPORT.md), [Excel Export](EXCEL_EXPORT.md), [이미지 Export](IMAGE_EXPORT.md)는 변경한 presentation의 cross-reference만 갱신했다.
- 전체 Vitest/build/Docker와 workbook 수식·공수 domain 알고리즘 회귀는 로컬에서 새로 실행하지 않았다. 소스 변경은 CSS 및 module class wiring뿐이며 공식 전체 회귀는 새 PR head의 GitHub Actions다. Windows Excel/VBA/DRM·native125·실기기·스크린리더·최종 수동 UX·운영은 NOT TESTED다.

Local Fast Feedback의 typecheck/scoped ESLint는 PASS이며 대상 assertion을 삭제하거나 continue-on-error로 우회하지 않았다. 문서 링크 검사는 136개 파일에서 PASS이고 whitespace 검사는 PASS다. 독립 UI/UX의 로컬 비교는 PASS이며 독립 QA와 원격 CI는 별도 판정 전까지 NOT TESTED다.

## 첫 번째 main 통합 후 역사적0.94.4 검증

첫 번째 통합 기준 main은 `d8d0bb3bab5d13ca68a6b319e116dec4ca24d48d`, tree는 `91cb73e2ca089f0b8ac7d3371ab29e33d0f845cf`, 제품 버전은 `0.94.4`다. PR #513/Issue #486의 ResourceCatalogAdmin 변경 및 PROJECT_UX/TEST_PLAN 내용을 보존했다. 제품4/spec/helper byte는 역사적0.94.3 동결본과 같으며 새 기준에서 after-current8case가 2.5m에 PASS했다. source324 중 최신 main의 ResourceCatalogAdmin1 변경을 별도로 기록하며 수정 표면의 역사적 before242 관측을 재사용한다. 이전8run45case(34PASS/11FAIL)는 불변이고 새8PASS를 합하면9run53case(42PASS/11FAIL)다.

새 [geometry242](../output/playwright/issue-491/review-current-0944/geometry.json), [API/state10](../output/playwright/issue-491/review-current-0944/contracts.json), [source provenance](../output/playwright/issue-491/review-current-0944/source-provenance.json), [실행 이력](../output/playwright/issue-491/review-current-0944/run.json), [선택 manifest](../output/playwright/issue-491/review-current-0944/selection.json)를 추가했다. 기존 review63은 역사적 증거로 보존하며 현재 대표PNG10과 전체 geometry/계약 관측을 추가 선택했다. 새 raw242PNG·원래 JSON·고유 /tmp stdout/HTML/results/trace는 보존하며 선택 밖 자료는 게시하지 않는다.

템플릿 instantiate의 원본 safeJSON `actualInstantiationStatus:201`은 literal 서버 계약값이다. response.status 직접 assertion은 없으므로 실제 상태201 검증 PASS로 해석하지 않는다. 실제 새 프로젝트 navigation·편집 상태·원본 snapshot 불변은 직접 검증했다. 기존 JSON/spec/helper를 소급 수정하지 않고 이 한계를 새 provenance/실행 결과에 명시한다. create/copy는 status201 성공 분기와 실제 navigation으로 확인한 간접 근거이며, template-save/import-commit의 직접 response.status 검증과 구분한다.

현재 대표 비교는 [템플릿390](../output/playwright/issue-491/review-current-0944/template-save-long-390.png), [템플릿 native1440](../output/playwright/issue-491/review-current-0944/template-save-native-focus-1440.png), [Export390](../output/playwright/issue-491/review-current-0944/export-image-range-390.png), [Export native1440](../output/playwright/issue-491/review-current-0944/export-date-native-focus-1440.png), [Import native390](../output/playwright/issue-491/review-current-0944/import-table-native-focus-390.png), [Import native1440](../output/playwright/issue-491/review-current-0944/import-table-native-focus-1440.png), [Gantt1440](../output/playwright/issue-491/review-current-0944/gantt-state-1440.png)이다. 원래 before PNG와 위 실제 gap/ring 조건을 비교한다. 최신 기준의 독립 QA 및 공식 quality/e2e/docker는 NOT TESTED다.

첫 번째 통합 기준의 문서 링크 검사는 137개 파일에서 PASS다. 앞의136개 PASS는 역사적0.94.3 검사의 수치이며 원래 로그는 별도로 보존한다.

## 두 번째 main 통합 후 최신0.95.1 검증

최신 기준 main은 `61a5f511d79e1f9429635bb0da35c0c02ee2163c`, 제품 버전은 `0.95.1`이다. Issue #492/PR #498의 HoverTooltip Gantt·toolbar CSS·신규 helper3과 관련 테스트·문서를 보존하고 PROJECT_UX/TEST_PLAN/UI_UX_GUIDELINES의492 섹션을 유지했다. C 소비자 제품4/spec/helper byte는 원래 동결본과 같다. 전체 source가 같다고 주장하지 않으며 source325의 최신 파일별 SHA를 별도 기록했다. Gantt mousemove/focusin/scroll 영향 때문에 동일8case를 새 기준에서 다시 실행해 2.5m에8PASS를 확인했다. before 소비자242 관측은 원래 byte/hash로 재사용한다.

원래8run45case(34PASS/11FAIL)와0.94.4 after-current8PASS는 역사적으로 불변이며 최신8PASS를 합한 실제 합계는10run61case(50PASS/11FAIL)다. 최신 [geometry242](../output/playwright/issue-491/review-latest-0951/geometry.json), [API/state10](../output/playwright/issue-491/review-latest-0951/contracts.json), [source provenance](../output/playwright/issue-491/review-latest-0951/source-provenance.json), [실행 이력](../output/playwright/issue-491/review-latest-0951/run.json), [선택 manifest](../output/playwright/issue-491/review-latest-0951/selection.json)를 추가했다. 역사적63+15 파일은 불변 보존하고 최신 PNG10+JSON5를 선택했다. 최신 raw242PNG/원래 JSON과 고유 /tmp stdout/HTML/results/trace는 별도로 보존하며 선택 밖 자료는 게시하지 않는다.

최신 대표는 [템플릿390](../output/playwright/issue-491/review-latest-0951/template-save-long-390.png), [Export390](../output/playwright/issue-491/review-latest-0951/export-image-range-390.png), [Export native1440](../output/playwright/issue-491/review-latest-0951/export-date-native-focus-1440.png), [Import native390](../output/playwright/issue-491/review-latest-0951/import-table-native-focus-390.png), [Import native1440](../output/playwright/issue-491/review-latest-0951/import-table-native-focus-1440.png), [Gantt1440](../output/playwright/issue-491/review-latest-0951/gantt-state-1440.png)다. create/copy/instantiate201은 literal 또는 성공 분기/navigation의 간접 근거이며 직접 response.status assertion과 구분한다. template-save/import-commit과 readonly download는 직접 response 검증을 유지한다. 최신 독립 UIX/QA 및 공식 quality/e2e/docker는 별도 판정 전까지 NOT TESTED다.

두 번째 통합 최신 기준의 문서 링크 검사는 실제 stdout 기준 138개 파일에서 PASS이며 전용 최신 로그를 별도로 보존한다. 앞의136/137 검사는 각각 역사적 기준의 결과다.
