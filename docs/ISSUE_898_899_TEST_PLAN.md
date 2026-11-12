# Issues #898 / #899 · 로컬 검증과 적용 범위

[Work Packet](exec-plans/active/ISSUE_898.md)의 승인/선정 원본과 [Primary 실패 원장](ISSUE_898_FAILURE_ANALYSIS.md)을 따른다. 기존 [#904 최초 실패](ISSUE_898_899_FAILURE_ANALYSIS.md)는 역사 근거이며 PR/CI 지시를 신규 실행하지 않는다.

## 재사용과 실제 입력 경계

| 기존 파일 | 결정 | 범위 |
| --- | --- | --- |
| schedule-views.spec.ts | EXTEND | 실제 HTTP/SQLite의 Resource/설비 중복 경로, source 역전/실패, 85행 가상화, 정보 버튼 Enter/Escape·End/Home/Arrow 보존. 신규 실제 Grid 선택/reveal·명시 Editor·경쟁·wheel 우선권 |
| project-summary-bar-visual.spec.ts | EXTEND | 기존 #822 실제 Control+mouse.wheel·Summary/native geometry·instance/canonical/write0에 빈 WBS Grid/Chart hit-test 추가 |
| gantt-density.test.ts | EXTEND | 기존 threshold/burst/clamp/coarse와 synthetic(0,0)/trusted 좌표 구별 |
| schedule-view-reveal.test.ts | ADD | 기존 순수 날짜 parser 재사용, Day/Week 좌표·capacity·없는/무효 날짜·미측정 typed 결과 |
| #889 five-width/scale와 #890 i18n·fullscreen 등 | KEEP_UNIQUE | 기존 shell/표시·합성 wheel와 현재 언어·state 보존을 새 physical pointer의 성공과 구별 |

`page.mouse.move`/Control/`page.mouse.wheel` 뒤 browser DPR/innerWidth/visualViewport와 앱 cellHeight/실제 row·Bar geometry를 독립 확인한다. Header/input 등 negative ownership은 브라우저 기본 동작을 앱이 취소하지 않았는지 검사하며 그것만으로 운영 Windows Page Zoom의 동작 자체를 검증했다고 표시하지 않는다.

#899는 Resource/설비의 5폭(390/768/1024/1440/1920)×Day/Week 실제 단일 선택/Chart 시작점과 중복 rowKey·dialog0를 검사한다. 각 조합은 실제 target/max capacity를 측정해 가능한 경우≤1px ALIGNED, 부족한 경우 NO_SCROLL_CAPACITY·clamp·남은 오차를 구별한다. 모든 조합이 정렬 가능한 것으로 가정하지 않는다. #898 physical wheel 대표3View/1440Day의 Grid·Chart별 전체 cycle 및 Equipment Week/fullscreen 대표와 #822 native 실제 입력, 기존 #8895폭/DayWeek synthetic, fullscreen/locale 인접 회귀는 각각 실제 실행 범위를 기록한다. 이들을 전체 View×폭×scale×fullscreen×언어×장치의 Cartesian 실제 입력 PASS로 합치지 않는다. 상세 case/추가 범위는 최종 runner/manifest가 권위다.

## 최종 clean source Gate

고정 baseline `f9a6488d686ae7e4b3228c8a9fe9c33a7fd00185`와 exact clean commit에 동일 direct Node launcher/PATH/환경을 사용한다.

```sh
node scripts/verify-prepr.mjs --mode=fast --base=f9a6488d686ae7e4b3228c8a9fe9c33a7fd00185 --issue=898
node scripts/verify-prepr.mjs --mode=targeted --base=f9a6488d686ae7e4b3228c8a9fe9c33a7fd00185 --issue=898
node scripts/verify-prepr.mjs --mode=docker --base=f9a6488d686ae7e4b3228c8a9fe9c33a7fd00185 --issue=898
node scripts/verify-prepr.mjs --mode=admit --base=f9a6488d686ae7e4b3228c8a9fe9c33a7fd00185 --issue=898
```

실행기는 공통 정적/전체 Unit·Integration/production build, 직접·인접·음성 합집합 Chromium, Docker image policy/runtime/API/SQLite restart를 결속한다. 최종 source/fixture/lock/environment drift·UNKNOWN·필수 누락/실패/취소는 Push/Publish/Close를 차단한다. 보고 뒤 source/문서를 수정하면 관련 결과를 새 exact source에서 재생성한다. 실행 시각/exit/count/artifact는 local report와 Issue에 추가하며 source commit에 소급 기록하지 않는다.

## 시각 증거와 수동 검증

기존 #896 helper의 합성 PNG/geometry/fixture/flow와 v2 manifest 무결성을 실제 source에 연결한다. 대표 screenshot을 실제로 확인하고 automatic PASS를 사람의 DESIGN 수용으로 쓰지 않는다. #897 Owner 격리 UAT, 실제 Chrome/Edge 일반 마우스·trackpad/hybrid·native125%·touch/AT는 별도 NOT TESTED이며 운영 재확인 전 Issue 전체 완료/종료로 표시하지 않는다. 운영 DB/화면·비밀값을 공개하지 않는다.

## 독립 QA 후 추가된 일반 셀 focus 회귀

같은 schedule-views 파일에 `#899 plain Grid cell double-click restores its row with visible and hidden Task names`를 추가한다. 별도 f1 진단에서 먼저 red를 확보하고 보이는/숨긴 작업명×Resource/설비·중복 마지막 row의 실제 날짜 셀 double-click/동일 Editor/Escape·정확 rowKey focus·추가Tabstop없음·canonical/Core/쓰기0를 검사한다. 최초 red와 f1 취소/설치cache drift는 F898-009~012에 보존한다. 최종 actual선정은10Unit/19Chromium이며 기존7/18은 version/lock 동기화 전 계획이다. fast와 targeted는 원본 설치cache를 동시에 변경하지 않도록 순차 실행한다.
