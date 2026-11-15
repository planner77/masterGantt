# Issue #920 — 하이브리드 PC Ctrl+휠 원장

## F920-001 — 터치 capability가 실제 마우스 입력을44px에 고정

2026-11-15 Owner의 Windows11/Chrome/터치스크린 보유·마우스 조작 UAT 보고다. 실제 운영0.147.0 sourcef45/image index5ac1904의 별도 합성 환경에서 실제 mouse wheel을 비교했다. fine은34→32px, touch-capable은44→44px였다. ctrl/cancelable/trusted=true, buttons0, deltaY120, prevented=true이며 실제 터치0회였다. capability만 끄면32px가 되어 이벤트 미전달/버튼 누름이 아닌 기존 coarse 고정 경로임을 확인했다.

`LOCAL:920-hybrid-red02`의 기대32/실제44 red와 differential 원문을 보존한다. CLI는 Error를 표시하면서 shell exit0이므로 이를 테스트 PASS로 읽지 않는다. 새 Playwright 회귀의 `npm run test:e2e -- tests/e2e/schedule-views.spec.ts --grep '#920' --reporter=list`도 실제 exit1/1FAIL, 기대32/실제44였다. 최초 raw run의 로그는 보존했으나 그 trace/error-context는 다음 raw run에 덮여 원문 복구하지 못했다. 이후 focused02/03 artifact는 실행별 외부 경로로 보존했다. 이 증거 한계를 숨기지 않는다.

원인: pointer/any-pointer coarse를 현재 입력 방식으로 사용해 coarse 상태와 nextDensityLevel=0이 고정됐다. 수정은 실제 Ctrl+wheel을 fine 선택으로, 실제 touch를44px 복원으로 처리한다. 첫 축소는44→34px, 초기44에서 확대는44px 상한을 유지하도록 보완했다. 버튼의 coarse CSS도 실제 row profile을 따른다. full source/환경 지문 미수집 WIP focused03은2PASS/약1.2분 SCOPED이며 최종 clean gate·운영/Windows UAT와 구별한다.

## F920-002 — 진단 CLI bootstrap 경계

최초 wrapper 직접 실행은 executable bit 부재로 exit126이었다. bash로 호출한 최신 CLI는 설치하지 않은 browser1254를 요구해 exit1/BLOCKED했다. 프로젝트에 이미 설치된 Chromium1243 executable을 진단 config에 명시해 성공했고 새 browser/OS 패키지를 설치하지 않았다. 설치된 Next guide의 확장자/일부 추정 경로 검색 실패도 실제 존재 경로로 바로잡았다. 제품 오류나 현재 공식 gate FAIL로 혼동하지 않는다. 개별 정확 시각은 미수집이며 원본 tool 응답과 private bootstrap 요약을 보존한다.

## F920-003 — CDP session 조기 detach로 capability가 원복

최초 hybrid-red에서 touch emulation을 켜자마자 session을 detach해 media가 원복됐다. height44 대기는30초 timeout이었다. 제품44px 실패 재현에 도달한 것으로 표시하지 않는다. 같은 session을 실제 입력 관측까지 유지한 hybrid-red02/differential에서 coarse=true/anyCoarse=true/maxTouchPoints10·실제44→44를 확인했다. 환경은Linux/WSL2 Chromium1243 CDP이며 Windows 실장치가 아니다.

## F920-004 — 신규 fine hit-area 기대에 row border를 누락

WIP focused02는2case 중1PASS/1FAIL, exit1이었다. 새 마우스32px 상태에서 checkbox target>=32 기대/실제31px였고 원래44px 초기 coarse 검사들은 통과했다. row border를 제외한 내부 content box31px를 새 기대에서 빠뜨린 HARNESS 오류다. target의 row 내부 높이/상하 경계와44px touch 조건을 분리해 기존 인접 행 비침범을 보존했다. 첫44px 축소의34px 진입 계약도 확정했다. focused03은 기존 #822와 신규 #920 모두 PASS이며 original focused02 trace/error-context/log는 private 별도 보존한다. timeout/retry/skip·body owner·원본 데이터 assertion 완화0이다.
