# PR #23 미해결 리뷰 후속

## 확인한 상태

원 PR [#23](https://github.com/planner77/masterGantt/pull/23)은 `7da0a87a11b956343c703d655f9cc077e1ef0e23`로 병합되었고 연결 Issue #9/#10/#11/#18/#21은 닫혔다. PR 본문에 미체크 checkbox는 없다.

- 원 PR [CI #48](https://github.com/planner77/masterGantt/actions/runs/34765966835): quality/E2E/Docker PASS.
- 병합 후 [CI #49](https://github.com/planner77/masterGantt/actions/runs/34781826744): main 품질 gate와 immutable image publish/검증 job PASS. 이번 후속 변경의 증거와는 별개다.
- 후속 PR [#24](https://github.com/planner77/masterGantt/pull/24)은 `820aeba800f48b035e4219f8094a5038593c8eb0`로 병합되었다. 최종 PR head `93b6f9497ac937b46695327ef85fdc08efb76a7c`의 [CI #52](https://github.com/planner77/masterGantt/actions/runs/34784330854)에서 quality/E2E/Docker가 PASS했다.
- 병합 후 [CI #53](https://github.com/planner77/masterGantt/actions/runs/34784810624)은 4개 job이 모두 PASS했고 immutable commit image `ci-820aeba800f48b035e4219f8094a5038593c8eb0` 게시·검증을 완료했다. 이는 아래 새 375px·문서 후속 변경의 검증 증거가 아니다.

## 실제 미완료와 처리 범위

1. [알림 벨과 navigation 겹침](https://github.com/planner77/masterGantt/pull/23#discussion_r4000062621): 390px에서도 각 버튼/링크의 hit area가 독립적으로 접근 가능하도록 보완하고 브라우저 회귀를 작성한다.
2. [인증 오류 진단 코드 누락](https://github.com/planner77/masterGantt/pull/23#discussion_r4000062623): 실제 API `INVALID_CREDENTIALS`를 안전 allowlist에 반영한다. 원문 응답/임의 코드를 허용하지 않으며 unit 및 복사 내용 E2E로 검증한다.
3. 독립 검토에서 API/Architecture/Test Plan의 과거 첫-child 확인창 설명 및 요구사항 매핑이 현재 UX와 불일치함을 확인해 갱신한다. 서버 보안/DB 계약은 변경하지 않는다.

## 검증과 완료 경계

- 로컬 테스트: **NOT TESTED**, 기존 보류 요청 유지. 정적 검토와 diff 점검은 실행 테스트와 구분한다.
- 후속 PR #24 최종 head의 원격 quality/E2E/Docker와 병합 main commit image gate: **PASS**. 위 run/head를 근거로 하며 로컬 미실행 상태와 구분한다.
- 독립 QA / Manager: 정적 검토 ACCEPT. 원 PR #23의 두 리뷰는 PR #24 수정·검증·병합 근거를 연결한 뒤 resolved 처리했다. PR #24의 새 리뷰는 아래 별도 후속 범위다.
- 실제 사내 proxy, Windows clipboard/스크린리더, 최종 사용자 UX: **NOT TESTED**. 대상 환경 접근과 사용자 확인이 필요하며 GitHub Chromium 결과로 대체했다고 주장하지 않는다.
- 별도 Semantic Version release/운영 배포는 이번 리뷰 완료 범위에 포함하지 않는다.

PR #24 자동 review에서 확인한 375px compact header 경계와 Architecture 현재 계약 직접 정합화는 별도 후속 변경이다. 로컬 실행은 계속 보류하며 새 변경 head의 원격 quality/E2E/Docker가 끝날 때까지 **NOT TESTED**다. PR #24의 기존 PASS를 이 후속 변경에 전용하지 않는다.
