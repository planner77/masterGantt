# Issue #881 — 누적 실패 원장

- Primary: https://github.com/planner77/masterGantt/issues/881
- Baseline: main `229604522969133d1ccc6de0477e373252670c86` (0.142.0)
- 2026-11-07 초기 단계에는 실제 PR CI 실패가 존재하지 않음. 원격 Run/Attempt/직접 실패는 확인될 때만 추가.
- 미커밋 편집 스크립트 1차 실행에서 DTO 공통 문자열 중복 일치로 로컬 편집 시도 중단됨. Git ref/브랜치에 적용되지 않았으며 unique interface anchor로 보완하고 blob staging 재실행함. CI/제품 결함이 아니다.
- 로컬 런타임은 GitHub network unavailable, 원본 repository/dependencies 없음: TypeScript/Vitest/Playwright/Docker **NOT TESTED**. 외부 CI run이 started/queued인 것과 성공은 별개.
- 남은 위험: DB 0037 old-file backup/reopen, Project Copy/template, edit session 경합, hidden last-screen 및 dirty/pending, KO/EN/VI, browser geometry/focus/native125%, Gantt instance continuity, 운영 reverse proxy. 실제 실패를 파생 실패/정책 차단과 구분하고 정확한 Head/Attempt 단위로 원장에 누적한다.
