# Issue #720 — 화면별 웹 매뉴얼과 영속 변경 동기화 정책

- Primary Issue: [#720](https://github.com/planner77/masterGantt/issues/720)
- 문서 전용 Branch: `docs/issue-720-contextual-web-manual-policy`
- 2026-10-18 main 기준: `package.json=0.116.0` (정확 기준 SHA/향후 main drift는 PR 시 원격 재확인).
- 이번 범위: 신규 이슈 등록 + **AGENTS.md / DESIGN.md / 공통 UI 가이드 / Issue Lifecycle 지침**을 동일 branch에 명시. 실제 상단 아이콘·`/manual` 웹 서비스·페이지 콘텐츠·앱/E2E 변경은 **후속 제품 PR**.
- 실행 주체: Manager가 GitHub connector로 문서 설계/작성. 독립 `ui_ux`/별도 `qa_docs` 실행 없음. 후속 구현 시 ui_ux는 read-only 제안, frontend는 UI/test, 문서 작성은 Manager 또는 지정 구현자, QA는 현행 정책.
- risk_level: LOW
- risk_reason: 본 PR은 Markdown 지침 및 설계 기록만 변경. UI/Runtime·API/DB·CI validator·Ruleset·권한·데이터 계약을 실행 변경하지 않음. 제품 구현 단계는 별도 위험도 재판정.
- qa_method: OWNER_MANAGED
- qa_required: false
- independent_qa: N/A (문서 전용, 별도 독립 QA 수행 안 함)
- manager_decision: NOT TESTED (원격 Trusted QA/PR CI/Owner 최종 병합 결정 전)
- version_decision: keep; product v0.116.0 유지. release_required: false; release_authorized: false.
- 참고: [#715](https://github.com/planner77/masterGantt/issues/715) → [#719](https://github.com/planner77/masterGantt/issues/719) 현장 tooltip 및 밀도 정돈과 분리. [#717](https://github.com/planner77/masterGantt/issues/717) 이름 우선 표기 유지.

## DESIGN DELTA / 정책 수용

- A(공통 설계 방향): 헤더 알림 옆 화면별 웹 매뉴얼 접근, 화면·활성 탭의 매뉴얼 진입, 사용자 작업공간 보호, 상세 절차용 온디맨드 웹 매뉴얼과 #715 필드 인접 상황형 도움말의 구분 → `DESIGN.md`.
- B(구현·검증 세칙): 실제 링크/aria, 동일 origin·새 탭 및 noopener, fullscreen, 반응형, `screenKey → Markdown/anchor` 매핑, 문서 내용 인벤토리, 링크 검사/E2E 및 초도 baseline 전환 → `docs/UI_UX_GUIDELINES.md`.
- 과정/문서 동기화: 전체 사용자-facing 화면/기능의 생성·수정·삭제에 관한 영속 참조 → `AGENTS.md`; DOCUMENTATION_SYNC 및 QA_READY 진입 조건의 화면별 매뉴얼 영향 확인 → `docs/ISSUE_LIFECYCLE.md`.
- 원칙 간 우선순위: 보안/domain/API/revision/canonical snapshot 불변, 현행 디자인·접근성과 SVAR Gantt 보호. `/manual` 새 페이지/컴포넌트는 **아직 존재하지 않음**. 이전 제품의 화면 동작이 바뀌었다고 주장하지 않음.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED — 화면/기능 변경 시 매뉴얼 screenKey/anchor 영향·동일 PR 갱신과 기본선 이전 예외 링크.
- `DESIGN.md`: UPDATED — Global App Shell의 화면별 웹 매뉴얼 공통 UX·설명 계층·동기화 규칙.
- `docs/UI_UX_GUIDELINES.md`: UPDATED — 실제 진입/매뉴얼 내용/상태/링크/접근성/정적 검증/초도 baseline 전환 절차.
- `docs/ISSUE_LIFECYCLE.md`: UPDATED — DOCUMENTATION_SYNC·QA_READY에서 매뉴얼 영향/Gate를 구분.
- `docs/exec-plans/active/ISSUE_720.md`: UPDATED — 이슈 문서 Scope/AC/테스트/미구현 상태.
- `docs/PROJECT_UX.md`: N/A (문서 전용으로 실제 Project 화면·state 계약 변경 없음; 이후 구현 단계에 필수 재검토).
- `docs/TEST_PLAN.md`: N/A (현재 실제 Test 변경 없음; 이후 웹 매뉴얼 구현 PR에서는 선택/교차 회귀 및 테스트 영향 표 필요).
- `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/SECURITY.md`: N/A (사용자 UI/DB/API/권한·세션 변경 없음).
- `docs/QA_REVIEW_POLICY.md`, `docs/CI_CD.md`, `.github/**`: N/A (현행 Trusted QA/Ruleset/CI gate 실행 코드 변경 없음).
- `CHANGELOG.md` / `package.json`: N/A (제품 코드·버전·배포 기능 미변경).

## AC_TEST_COVERAGE

- AC1: [후속 제품 PR / NOT IMPLEMENTED / NOT TESTED] 헤더 알림 옆 매뉴얼 아이콘, 벨/배지/geometry 회귀.
- AC2: [후속 제품 PR / NOT IMPLEMENTED / NOT TESTED] 현재 화면·활성 탭 문맥 링크, 새 탭, 원본 UI state/저장 0.
- AC3: [후속 제품 PR / NOT IMPLEMENTED / NOT TESTED] `/manual`, 화면별 사용자 Markdown 페이지와 기능/권한/상태/오류 정확도.
- AC4: [후속 제품 PR / NOT IMPLEMENTED / NOT TESTED] 실제 기능 변경에 대응하는 매뉴얼 본문 갱신과 screenKey/anchor/link 검증.
- AC5: [문서 PR / SOURCE CHANGED / REMOTE NOT TESTED] 위 4개 영속 지침 및 Lifecycle 문서 동기화 일치.
- AC6: [후속 제품 PR / NOT IMPLEMENTED / NOT TESTED] keyboard/ARIA/390~1920px/fullscreen/readonly/빈 화면·오류.
- AC7: [후속 제품 PR / NOT IMPLEMENTED / NOT TESTED] Playwright/정적 링크/탭·notification/Gantt 회귀.
- 문서 정적 검토: Issue #720 링크, 4개 지정 문서의 내용·cross-link·전환 기준 및 동일 PR 반영 여부를 검토한다. 정적 검토를 Chromium/E2E/원격 CI PASS라고 부르지 않는다.
- 환경별 원격 검증: 현재 문서 PR의 최신 HEAD PR Required Quality/E2E/Docker, default-main Trusted QA, main artifact/finalizer는 수행·판정 이전 `NOT TESTED`. 제품 구현 시 별도 최신 HEAD를 검증한다.

## 후속 구현 순서와 병합 경계

1. #720 구현 시 최신 main과 공통 헤더/알림 Portal·Workspace 탭 목록을 새로 확인하고 사용자 화면 인벤토리 및 매뉴얼 slug/anchor 사전(중복 없는 screenKey 포함)을 작성한다.
2. `/manual` 읽기 화면 + 전역 진입점 + 사용자 Markdown 단일 원본 + 대표 화면별 내용과 index/fallback/fullscreen 설계를 구현한다. 기존 `docs/TARGET_RESOURCE_USER_GUIDE.md`를 포함한 기술 문서와 사용자 매뉴얼의 계약·중복을 검토한다.
3. 모든 기능/화면 변경에 적용할 매뉴얼 diff matrix와 빌드/Playwright 링크·접근성·Gantt 비파괴 검사 추가 후, 실제 매뉴얼 baseline이 제품에 병합될 때 **임시 미구현 인계 예외 종료**를 명시한다.
4. 제품 구현 PR에는 독립된 버전·위험/QA·DOC_SYNC 재판정과 실제 CI/GHCR evidence가 필요하다. **본 문서 PR은 Issue #720를 닫거나 구현 완료·릴리스 승인으로 해석하지 않는다.**
