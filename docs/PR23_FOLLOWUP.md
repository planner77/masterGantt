# PR #23 미해결 리뷰 후속

## 확인한 상태

원 PR [#23](https://github.com/planner77/masterGantt/pull/23)은 `7da0a87a11b956343c703d655f9cc077e1ef0e23`로 병합되었고 연결 Issue #9/#10/#11/#18/#21은 닫혔다. PR 본문에 미체크 checkbox는 없다.

- 원 PR [CI #48](https://github.com/planner77/masterGantt/actions/runs/34765966835): quality/E2E/Docker PASS.
- 병합 후 [CI #49](https://github.com/planner77/masterGantt/actions/runs/34781826744): main 품질 gate와 immutable image publish/검증 job PASS. 이번 후속 변경의 증거와는 별개다.

## 실제 미완료와 처리 범위

1. [알림 벨과 navigation 겹침](https://github.com/planner77/masterGantt/pull/23#discussion_r4000062621): 390px에서도 각 버튼/링크의 hit area가 독립적으로 접근 가능하도록 보완하고 브라우저 회귀를 작성한다.
2. [인증 오류 진단 코드 누락](https://github.com/planner77/masterGantt/pull/23#discussion_r4000062623): 실제 API `INVALID_CREDENTIALS`를 안전 allowlist에 반영한다. 원문 응답/임의 코드를 허용하지 않으며 unit 및 복사 내용 E2E로 검증한다.
3. 독립 검토에서 API/Architecture/Test Plan의 과거 첫-child 확인창 설명 및 요구사항 매핑이 현재 UX와 불일치함을 확인해 갱신한다. 서버 보안/DB 계약은 변경하지 않는다.

## 검증과 완료 경계

- 로컬 테스트: **NOT TESTED**, 기존 보류 요청 유지. 정적 검토와 diff 점검은 실행 테스트와 구분한다.
- 후속 PR/head/원격 quality/E2E/Docker: **NOT TESTED**, 구현 중. 실제 결과는 후속 PR 및 원 PR 리뷰 답변에 연결한다.
- 독립 QA / Manager: 정적 검토 ACCEPT. 원격 실행 결과는 이 정적 판정과 별개이며 원래 리뷰는 수정 근거와 원격 검증 확인 뒤 처리한다.
- 실제 사내 proxy, Windows clipboard/스크린리더, 최종 사용자 UX: **NOT TESTED**. 대상 환경 접근과 사용자 확인이 필요하며 GitHub Chromium 결과로 대체했다고 주장하지 않는다.
- 별도 Semantic Version release/운영 배포는 이번 리뷰 완료 범위에 포함하지 않는다.
