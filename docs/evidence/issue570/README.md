# Issue #570 실제 Core 화면 증거

합성 Project fixture의 Chromium metadata projection 시험 화면이다. 실제 사용자 데이터·DB·환경 설정·인증 정보는 포함하지 않는다. 시각 언어/배치 변경은 없으며 스크린샷만으로 keyboard·권한·projection 완료를 판정하지 않는다.

- [390px viewport](metadata-390.png): 캡처 frame 366×466.
- [1440px viewport](metadata-1440.png): 캡처 frame 1392×684.

두 화면은 columns descriptor delta 이후 metadata 5폭×Day/Week 검증에서 캡처했다. 앞선17개 실행의 동일 화면과 PNG가 일치한다. 실행별 테스트 결과·후속 collapse delta·source 경계 및 원격 NOT TESTED는 [Work Packet](../../exec-plans/active/ISSUE_570.md)에 기록한다.

projection receipt의 SETTLED는 Task/Link payload·행 membership/순서·텍스트·수직 정합 범위다. bar X/width·native Link DOM·최종 viewport 기하는 이 화면 또는 receipt의 보장 범위가 아니다.
