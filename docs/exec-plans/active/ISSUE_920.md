# Issue #920 — 터치 지원 PC의 마우스 Ctrl+휠

## 범위와 기준

Owner는 #919의 0.147.0 운영 UAT에서 다른 항목은 문제 없지만 일정표 Grid/Chart 행 높이 조절이 동작하지 않는다고 보고했다. 환경은 Windows 11/Chrome/터치스크린 보유이며 실제 조작은 마우스다. baseline main은 `fc8b0858f467bec0cd0a13a0fd14f1edd752c8a7`, 운영 제품은 `f45f7c0a25960a34970005cae93bd7b55ace2831`, 정식 index는 `sha256:5ac1904dac65ef88c64952b67866a84d078a39dc74bea007f254c7a5a1fa10f8`다.

REUSE_DECISION=EXTEND. #822/#898의 density 상태·단일 Coordinator·capture listener와 기존 실제 입력/geometry 테스트를 확장한다. 별도 zoom/scroll writer, UA/OS 추측, 전역 브라우저 확대 차단을 추가하지 않는다. Manager 단일 writer, risk_level=HIGH(shared Gantt/input/viewport), qa_method=OWNER_MANAGED_LOCAL이다. 이번 구현·검증 요청은 새 source의 정식 tag/rolling 게시·운영 교체 승인으로 자동 해석하지 않는다. PATCH 후보는0.147.1이고 package/lock의 버전만 일치시키며 dependency 변경은 없다.

## 원인과 표시 계약

같은 운영 이미지·합성 fixture에서 실제 Ctrl+wheel의 fine 환경은34→32px, 터치 기능을 켠 환경은44→44px였다. 둘 다 trusted/cancelable/ctrl=true, buttons=0, defaultPrevented=true였다. capability만 끄면 다시32px가 되어 미전달·버튼 눌림·일시 잠금 가설을 배제했다. 기존 any-pointer:coarse는 현재 입력 장치가 아니라 사용 가능한 장치의 합집합이다([W3C](https://www.w3.org/TR/mediaqueries-4/#any-input)).

- 초기 터치 지원 환경은44px를 유지한다. 실제 본문 Ctrl+휠 아래는44→34→32→30→28px로 전환한다. fine 환경의 기존34/32/30/28px는 같다.
- 초기44px에서 휠 위는 최대값을 유지한다. 확대 입력으로 오히려 작아지지 않는다. fine 프로파일의 확대 상한은34px다.
- 실제 본문 touch pointerdown은44px로 복원하고 미완료 wheel RAF를 취소한다. 터치 capability가 그대로인 동안 primary pointer의 중복 변경으로 마우스 선택을 덮지 않는다.
- Resource/설비의 정보·이름 버튼은 실제44px 프로파일에서만44px 최소 높이를 사용한다. fine 행 밖으로 touch CSS hit area가 넘어가지 않는다.
- 기존 body hit-test·입력/헤더/메뉴/dialog 제외·mutation/recovery/버튼 guard·delta threshold·동일 instance/canonical 쓰기0를 유지한다. CSS/클라이언트 상태는 서버 권한 근거가 아니다.

## 테스트 수명주기와 증거

기존 `schedule-views.spec.ts`에 touch-capable Chromium+실제 mouse wheel/실제 CDP touch 전환을 추가했다. 세 View × Grid/Chart ×8입력의48관측으로44 상한·34/32/30/28·역방향·row/button bounds≤1px·44px touch 목표·브라우저 zoom 불변·instance·canonical 쓰기0를 검증한다. 기존 #898 fine 입력 사례와 #822 geometry/제외 범위는 유지한다. #822의 옛 무조건 coarse clamp 기대만 실제 입력별 계약과 연결하고44px 초기 hit-area·인접 행 비침범 검사는 보존한다.

수정 전 새 회귀는 실제44/기대32로 FAIL했다. 최종 계약은 첫 축소에서34px로 진입하도록 보완했으며 기존 실패를 소급 수정하지 않는다. WIP focused03의2개 사례는 PASS(각5.7초/37.5초, 전체약1.2분)이고 원장에 source 지문 미수집 SCOPED로 기록한다. 같은 clean 최종 Head의 공식 gate를 대체하지 않는다. 진단 Next 생성파일/출력은 별도 보존 후 gate 전에 baseline 입력으로 준비했다.

최종 검사는 `fast` + 영향 Unit/Chromium `targeted` + `docker` + 동일 source/base/환경 `admit`다. 현재 최종 gate·main Push·새 게시·운영 교체는 NOT TESTED/NOT PUBLISHED/NOT DEPLOYED이며 실제 결과는 #920 STATUS/FINAL로 연결한다. 이전 source PASS를 승계하지 않는다. Windows 실제 장치, touchpad pinch·pen·AT·Owner 재UAT는 별도 NOT TESTED다. Chromium CDP emulation을 Windows 실장치 PASS로 표시하지 않는다.

## 문서 영향

UPDATED: DESIGN, PROJECT_UX, UI_UX_GUIDELINES, GANTT_STATE_CONSISTENCY, TEST_PLAN, CHANGELOG, PLAN, 이 Packet, #919/#920 원장·Regression Index. #919의 실제 배포 증거도 후속 UAT 출처로 연결한다. API/DB_SCHEMA/SECURITY/SCHEDULING_ENGINE은 서버·저장·계산·권한 변경0으로 N/A. AGENTS/CI_CD/GITHUB_OPERATIONS/LOCAL_PREPR은 기존 계약 적용이며 검증/게시/권한 정책 변경0으로 N/A. 원격 PR/Actions/Trusted/Finalizer는 현행 Owner 정책상 N/A다.

최종 gate의 명시 추가 소비자는 `--include=tests/features/gantt/gantt-density.test.ts`와 `--include=tests/scripts/issue-ledger-verifier.test.ts`다. fast/targeted/docker/admit 및 후속 publisher가 있으면 같은 두 include를 사용한다. 자동 선정의 직접/인접9 Unit·13 Chromium 파일에 위 Unit2개를 더하며 unknown/missing/excluded0 계획이다. 미선정 전체 Chromium을 실행했다고 주장하지 않는다.


## 799 후보의 공식 검증·F920-005 후속

799의 fast9단계/4013PASS·기존3SKIP, Docker10단계와 영향 Unit164는PASS였으나 전체 Chromium은132PASS/1FAIL로 전체FAIL이었다. 첫 Source 준비가5초 안에 끝나지 않은 기존 #880 사례이며 신규 #920/#898/#822는PASS다. 실제 원본/UNKNOWN과 단독 cold/warm 비교·준비 보완을 [F920-005](../../ISSUE_920_FAILURE_ANALYSIS.md)에 보존한다. 사전 missing-Project GET404로 route 준비를 분리한 원래 전체 사례는40.9초PASS지만 새 최종 gate를 대체하지 않는다. 제품 src TypeScript/CSS는799 그대로다.

보완 Source는799의 후속 commit으로 동결하고 새 `issue-920-verified02` checkout에서 frozen npm ci 뒤 전체 같은 source gate를 다시 실행한다. baseline은fc8, include2개와13Chromium/11Unit파일·기존 기준·skip/retry/timeout은 유지한다. 처음 source799의 report/image/preview는 원본 증거로 남기며 새 source PASS/Owner UAT로 자동 전용하지 않는다. 새 정식 게시/운영 승인도 아직 없다.


최종 준비 배치: 테스트 공통 `beforeEach`에서 같은 missing-Project GET404/no Set-Cookie를 확인한다. 이 spec의 각 격리 서버에만 적용하며 shared fixture/config와 원래 테스트 timeout/assertion/retry는 변경0이다. 전체 #880과 신규 #920의 집중46.2초/49.1초·2PASS를 확인했고 다음 source의 공식 gate를 새로 실행한다. 제품 src/의존성/버전은799의 후보와 같다.
