# Issue #529 UI 공개 근거

합성 공개 fixture만 포함한다. 실제 SQLite DB, runtime log, 다운로드 XLSX, password/session/token은 포함하지 않는다.

- `dialog-{390,768,1024,1440,1920}.png`와 `geometry.json`: mock UI의 긴 현재 조건·접이식 근거·내부 scroll·control containment·native Tab outline. geometry의 4제품 source hash는 대화상자 범위이며 Workspace/Gantt 상태의 hash를 대신하지 않는다. 최종 영향 mock2 PASS는 `/tmp/frontend529-mock7.log`; 고유 mock3 최초 실행은 `/tmp/frontend529-mock1.log`에 별도로 보존했다.
- `peer-control-before.json`: Export 없는 실제 native fixture의 최초 FAIL. `peer-control-rework1/2/4.json`: capture 보완 뒤 late scroll0 및 clamp30 FAIL을 따로 보존한다. historical 파일별 source hash는 당시 미수집으로 NOT TESTED이며 실제 값·시각·instance·generation·이벤트는 그대로다.
- `peer-control-after.json`: 최종 실제 native control PASS. public/DOM left120, 같은 instance/sync generation과 source hash를 포함한다. 최신 로그 `/tmp/frontend529-rework-browser-final.log` control1 PASS/2.2s. 이전 실행 `/tmp/frontend529-peer-control-final.log` 1 PASS/7.5s(총8.3s)는 재작업 전 이력이다.
- `peer-restore-cancel-before-invalid.json`: 최초 취소 PASS 판정의 NOT VALID 이력. Core restore attribute만 검사해 readonly DOM이 사용자30/31을 저장120으로 덮는 오류를 놓쳤다.
- `peer-restore-cancel.json`: REWORK 최종 실제 SQLite fixture의 pending RAF/native wheel/filter 취소 경계. 사용자 public30/DOM31 각각을 대기 작업 전 캡처하여 200+300ms 뒤 그대로인지 확인하고 이후 requested120 이벤트 없음도 검사한다. `/tmp/frontend529-peer-cancel-rework-final.log` 1 PASS/6.8s(총7.6s). 초기 REWORK2회 oracle 동등값 가정 FAIL과 clock fixture FAIL은 별도 보존한다. 자연 layout settle 측정과 구분한다.
- `native-workbook.json`: 실제 Next API current/exact/whole XLSX의 고유 Assignment/count/raw MD/snapshot/context 대조, readonly·양수 scroll·선택·열폭·tree·같은 instance 보존. XLSX 자체는 저장하지 않는다. 최신 `/tmp/frontend529-rework-browser-final.log` Export1 PASS/6.2s. 이전 `/tmp/frontend529-native-final1.log` Export1 PASS/4.4s와 paired control의 생성429 FAIL은 별도 이력이다.

기존 Milestone peer/public viewport control은 `/tmp/frontend529-native4.log`에서 1 PASS/1.9s다. 고유 UI case는 mock3/native3/기존M1이고 반복 실행을 고유 수에 합산하지 않는다. backend API1·Unit147은 별도 backend freeze 근거다. 원격 CI/독립 QA/Windows Excel·DRM은 NOT TESTED다.

Core2.7.3의 공개 exec/resize-chart/scroll-chart는 layout settled/user-origin 표시를 보장하지 않는다. 앱의 guard·timeline 준비·RAF·공개 scroll-chart 1회 복원을 실제 Chromium에서 검증했다. 설치 clamp 구현의 read-only 관찰은 공개 API 계약과 구분한다.

PRE_QA REWORK 후 같은 최종 제품 source의 positive3은 `/tmp/frontend529-rework-browser-final.log` M1/1.8s·Export1/6.2s·control1/2.2s다. 해당 묶음 cancel은 clock 과거 pause fixture로 FAIL하여 cancel만 재실행했다. positive artifact는 실행 당시 spec SHA를 보존하며 마지막 spec 변경은 cancel 두 번째 clock 기준뿐이라 positive body는 그대로 재사용한다. 문서·새 manifest가 이전 freeze와 PRE_QA tree를 대체한다. 독립 QA 재검토/원격 CI는 NOT TESTED다.
