# Issue #866 — 국제화 분리 PR 누적 실패 원장

기준 Main: `364aa3bdfde16fd3ca79add61c35a1cde21f6395` / `v0.141.1`. #866 전용 원장은 이 파일을 사용하며 이전 #870 원본(PR/Run/리뷰/실패)은 https://github.com/planner77/masterGantt/pull/870 와 해당 원본 브랜치 `docs/ISSUE_866_FAILURE_ANALYSIS.md`에서 독립 추적한다. 기존 CI 실패와 구현 중 원인은 덮어쓰거나 성공으로 소급하지 않는다.

## 원본 #870과 새 Phase A의 인과 분리 (2026-11-05)

- 원본 통합 PR #870: Head `ca58e987fd68261d9e9db97b4e931651350d6e4a`, 오래된 기준 `352a43e74c7b34c72d952f67783a53463f8b519d`, 국제화 + 독립 #865 LLM + #869 Issue 레이아웃을 339파일에 혼합. 이전 통합 PR의 원장에는 관리형 이름 저장/기존 스키마/HTTP·Playwright/E2E 원본 실패 사례가 기록되어 있다. 그 실패의 구 코드를 새 Main i18n Phase A의 제품 직접 실패로 섞지 않는다.
- 가장 최근 원본 PR #870의 [Full #3474.1 / Run41723556052](https://github.com/planner77/masterGantt/actions/runs/41723556052)에는 `tests/e2e/issue-726-task-logistics.spec.ts` 공정문맥 HTTP 실패/상세 원인 관측 등 별도의 역사 기록이 있다. 교정 제품 경로는 #869/#865 병합이 반영된 Main에서 재평가해야 하며, 구 PR 339파일을 일괄 덮어쓰지 않는다. 원본 결과를 새 Phase A의 테스트 PASS로 전용하지 않는다.
- 분리 Phase A: 0.141.1 → 0.142.0 candidate, 현재 원격 구현 성공/실패 Run 아직 **NOT TESTED**. 기존 한국어 UI/업무 Gantt·LLM 제품·API·DB/마이그레이션을 변경하지 않고 공통 Locale + UI Header/Navigation + SVAR words/date-only만 추가.
- 새로운 실패가 발생하면 **실제** GitHub Run/Attempt/Job/Step, Head/Base/Test merge, 직접 원인/파생 및 취소·미실행, 교정 코드/테스트/문서·리뷰·충돌 및 재검증을 본 문서에 **추가**한다. 과거 PR #870의 다른 Issue 결함을 신규 Phase A 실패라고 주장하지 않는다.
- 실행 계약: Required Quality/E2E8/Docker, Trusted QA, Owner HIGH/OWNER_MANAGED, 정식 release 승인 별개. 로컬 Checkout/실행 미확인, 신규 PR CI 시작까지만 진행, 결과 모니터링 안 함. Phase B/C까지 Issue #866 OPEN, tag/GHCR 정식 게시 금지.
