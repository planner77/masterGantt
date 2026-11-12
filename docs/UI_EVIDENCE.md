## #3594.1 보완 — 대용량 Git 지문의 메모리 경계

PR #902 최초 Full에서 기존 #880 흐름의 작업 diff를 동기 버퍼에 담다가 `spawnSync git ENOBUFS`가 발생했다. 화면 단언 실패가 아니라 증거 수집 경계 오류다. 전체 `git diff --binary HEAD` stdout bytes를 순서대로 SHA256에 streaming 반영하며 변경 내용은 공개하지 않는다. `git status --porcelain`도 전체 출력을 쌓지 않고 dirty 여부만 관측한다. Git spawn/종료 실패는 지문 수집 실패로 중단하며 빈 diff 성공으로 대체하지 않는다. 지문 형식과 v2 provenance/원래 dirty 의미는 유지한다. 임시 합성 Git의 대용량 바이너리·작은 diff·staged/unstaged·실패 음성과 기존 #880/#889/#890 브라우저 소비자를 검증한다. 원본 실패·RED/GREEN은 [원장](ISSUE_896_FAILURE_ANALYSIS.md)을 따른다.

# UI 시각 증거 운영 계약 — Issue #896

이 계약은 기존 Playwright 결과의 Stage A advisory 증거를 연결한다. 파일 무결성·수치 비교와 실제 사용자 UI 수용은 별도 판정이다. 제품 화면·버전·권한·API·DB 계약은 보존한다. 현행 운영은 [Issue Lifecycle](ISSUE_LIFECYCLE.md)로 전환하며 PR·원격 CI·Trusted QA·자동 Finalizer는 실행하지 않는다.

## 재사용과 추적

기존 `tests/e2e/helpers/ui-evidence.ts`와 `scripts/ui_evidence.py`를 v2로 확장한다. `scripts/compare-issue-118-layout.mjs`의 viewport/state key와 delta 계산을 기존 #118 CLI와 v2 모드에서 함께 사용한다. #118의 역사적 SHA·좁은 폭 높이 개선 규칙은 기존 CLI에 그대로 남긴다. 별도 Layout comparator·스크린샷 runner·외부 SaaS를 추가하지 않는다.

각 Issue Work Packet의 `UI_EVIDENCE_CONTRACT`가 AC→DESIGN/화면 계약→기존 test/state→측정 수치→수동/미검증의 추적표다. #896 파일럿 표는 [실행 계획](exec-plans/active/ISSUE_896.md)에 있다. #889의 공통 shell/축/Grid split 차이 ≤1px와 #822의 fine34/32/30/28px·coarse44px만 재사용하고, 새 허용오차는 DESIGN 근거와 Owner 검토 없이 늘리지 않는다.

## 수집 형식

기존 테스트의 합성 fixture에서 canonical `ui-evidence-<state>.json`과 PNG를 같은 test output에 쓴다. v2는 다음을 기록한다.

- Issue/AC·source Head·비교 baseline·실제 checkout SHA를 기록한다. 로컬 수집은 PR/run/attempt/test-merge를 만들어 넣지 않으며 non-PR baseline은 동일 checkout 관찰 기준으로 과거 화면 비교를 뜻하지 않는다. 과거 manifest의 원격 필드는 역사적 출처로 보존한다.
- 실제 Playwright test ID/제목/project와 수집 시점 결과 `CAPTURED_BEFORE_TEST_COMPLETION`. 테스트 최종 PASS/FAIL은 실제 로컬 Playwright 실행 보고/exit로 판단한다.
- Chromium/Playwright/OS/release·viewport·locale/document locale·font family·theme·DPR/CSS zoom·timezone·관측 시각. DPR 또는 CSS zoom을 native125% 확대 검증으로 대체하지 않는다. font는 computed family 관측이며 실제 설치 font 파일·fallback 버전 동일성을 인증하지 않는다. 이 환경 차이 가능성이 있으면 별도 확인 전 비교 수용은 BLOCKED다.
- tracked working diff·test/helper SHA256와 dirty 여부. 로컬 dirty capture를 clean exact-commit Preview와 동일하다고 수용하지 않는다. 지문은 재현 보조 자료이며 로컬 metadata를 Owner 승인으로 승격하지 않는다.
- 원본 PNG·별도 `geometry-<state>.json` 및 안전한 `fixture-<state>.json`의 SHA256. embedded geometry와 별도 파일 내용도 일치해야 한다. fixture 지문은 호출자가 제공한 안전한 합성 subset의 동일성만 확인하며 전체 DB·모든 fixture 필드의 동일성을 인증하지 않는다. fixture payload가 없는 선언 전용 수집은 `DECLARATION_ONLY`로 표시하며 비교 baseline으로 사용하지 않는다.
- 실제 완료된 단계만 포함한 flow ID/steps/outcome, DESIGN 측정 참조·expected/actual/tolerance/outcome, 제외 범위/사유와 Owner 수용 `NOT TESTED`.

Playwright `attachments/`의 hash 이름 사본은 원본 manifest가 아니다. canonical sibling 쌍만 검증하고 사본으로 누락된 원본을 대체하지 않는다. 공개 artifact에는 테스트용 합성 자료만 허용한다. 이름/AC 선언으로 민감 데이터가 자동 탐지·비식별화된다고 주장하지 않는다. 실운영 UAT 화면은 승인된 private 위치에 보존한다.

## 실제 파일럿과 제외 조합

| 기존 테스트 | 자동 측정/흐름 | 대표 PNG 범위 | 제외·수동 수용 |
| --- | --- | --- | --- |
| schedule-views #889 공통 작업면·밀도 | 390/768/1024/1440/1920px × Day/Week × 세 View의 기존 좌표 단언, Grid/Chart Ctrl+휠, 일반휠/헤더 제외, 같은 instance·canonical 쓰기0 | 5폭 Day/설비, 1440 Day/WBS·Resource, 1440 Week/WBS, 최종 WBS 흐름; 의도적 CSS 회귀 화면은 별도 명시 | 나머지 조합 PNG 미수집, native125%·실기기·AT·Owner 의도 수용 미실행 |
| i18n #890 rapid locale round trips | KO/VI/EN 왕복·열 현재 언어·숨김 복원·layout/instance/쓰기0 | 1440 KO/EN/VI settled 상태 | 전체 화면×언어×상태의 Cartesian 실행 없음 |
| schedule-views #880 기존 Resource 사례 | Editor Enter/Escape·focus·canonical 데이터/쓰기0 기존 assertions | 기존 1440 Resource 관찰 유지 | 전체 업무 UAT와 운영 데이터 화면 검증 아님 |

실제 실행 범위/시간·오류·산출물은 [누적 원장](ISSUE_896_FAILURE_ANALYSIS.md)에 기록한다. mock-backed locale 테스트는 실제 HTTP/SQLite의 저장 검증으로 격상하지 않는다. readonly/edit/loading/error/stale/Fullscreen의 기존 독립 테스트는 삭제하지 않으며 이번 대표 수집에서 미실행한 조합을 PASS로 표시하지 않는다.

## 검증과 비교 명령

먼저 파일 무결성과 정확 출처를 확인한다. 로컬 실행의 실제 source/baseline 값을 사용하고 PR·test-merge를 요구하거나 원격 API를 호출하지 않는다.

```sh
python3 scripts/ui_evidence.py test-results --require-v2 \
  --source-sha "$SOURCE_SHA" --baseline-sha "$BASELINE_SHA" \
  --summary test-results/UI_EVIDENCE_SUMMARY.md
```

v1은 과거 봉투 무결성 호환만 유지한다. v2 요구 또는 확장 출처 비교에는 v1을 거부한다. 없는 자료는 NOT TESTED/BLOCKED이고 checksum 위반은 FAIL이다. 대표 수집 사례가 없는 경우 NOT TESTED이며 `--allow-empty`를 필요한 시각 검증의 PASS로 사용하지 않는다. 필요한 E2E 실패는 로컬 admission을 차단한다.

전후 양쪽의 실제 무결성을 확인한 뒤 기존 비교기 v2 모드를 실행한다. 기준 이미지는 자동 생성·승인·덮어쓰지 않는다. 다음은 계약 형식 예시이며 실제 baseline 승인 기록이 아니다.

```json
{
  "baselineSha": "<실제 기준 source 40자리 SHA>",
  "sourceSha": "<실제 변경 source 40자리 SHA>",
  "measurements": [
    {"name": "dateHeader", "field": "height", "tolerance": 1,
     "designRef": "docs/UI_UX_GUIDELINES.md#issue-889--890--일정-표현과-언어-복원"}
  ]
}
```

```sh
node scripts/compare-issue-118-layout.mjs --ui-evidence \
  before/ui-evidence-view.json after/ui-evidence-view.json \
  approved-contract.json output/playwright/comparison
```

양쪽 Issue/state/viewport·환경/시각·DATA_CAPTURED fixture fingerprint가 같아야 비교 가능하다. baseline 변경·폰트/OS/browser drift·동적 fixture 변경·누락은 BLOCKED, 명시 수치 위반은 FAIL, 일치는 `GEOMETRY_MATCH_NOT_UAT`다. 이는 PNG 픽셀 일치나 DESIGN 전체 적합 판정이 아니다. CSS/헤더/밀도·반올림 경계·drift 음성 unit과 실제 controlled CSS 주입을 구분한다.

## 로컬 인계·수용·비용

canonical Manifest·PNG·Geometry·Fixture와 로컬 보고를 같은 source/fixture·환경에 연결한다. 운영/실데이터·비밀값은 공개하지 않는다. 원본 test 최종 결과, 실제 flow, 무결성, geometry 판정을 따로 읽는다. 의도적 CSS 음성 화면은 통제된 테스트 자료이며 제품 회귀 실패를 숨기는 용도가 아니다. 성공 문자열만으로 UI/UX ACCEPTED를 기록하지 않는다.

#897의 실제 Owner 로컬 UAT·최종 범위 수용은 별도다. source·fixture/image·manifest drift나 REWORK 후 관련 관찰/수용은 다시 확인한다. 기존 PR/CI artifact 전송·Required check·Trusted/Finalizer 지침은 이전 구현 이력이며 신규 경로에서 호출하지 않는다. 과거 실행·오류는 단일 원장과 Git 원본에 보존한다.

수집 시간은 manifest `captureDurationMs`, 파일 크기·검증 시간은 실제 summary로 관찰한다. 로컬 비용·UI 결함 재오픈의 개선은 실제 동등 표본 전 NOT TESTED다. 과거 Actions 측정을 현재 비용 절감 PASS로 쓰지 않는다.

공식 근거: [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)는 동일 렌더링 환경을 요구하고, [Clock](https://playwright.dev/docs/clock)의 setFixedTime은 날짜를 고정하면서 timer를 유지한다. 이번에는 승인 golden이 없어 픽셀 비교를 도입하지 않는다.

## #898/#899 legacy 출력 격리와 관측 경계

기존 #463/#818/#258/#880/#889의 일반 PNG/JSON도 Playwright testInfo.outputPath 아래에 수집한다. canonical ui-evidence sibling 이름과 checksum/실제 flow·geometry 수집은 기존 helper를 유지한다. committed output/playwright의 역사 자료를 새 실행으로 덮지 않는다. f4 최초160개 Chromium 개별 PASS는 tracked/untracked 산출물로 전체 source guard가 BLOCKED였으며 새 source에서 다시 검증한다.

DECLARATION_ONLY 캡처는 실제 fixture payload 비교 baseline으로 쓰지 않는다. dirty capture의 원인을 Next 생성 파일만으로 추정하지 않고 실제 snapshot audit를 대조한다. 허용된 생성 metadata 외 source/output 변화가 있으면 전체 검증은 BLOCKED다. 새 소스 검증·관측 무결성과 실제 Owner UAT는 별도다. [F898-014](ISSUE_898_FAILURE_ANALYSIS.md).
