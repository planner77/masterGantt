# Issue #869 — Project Issue 목록 스크롤·등록창 레이아웃 독립 구현 (2026-11-04)

- Primary: https://github.com/planner77/masterGantt/issues/869
- 출처: 원 통합 PR https://github.com/planner77/masterGantt/pull/870, source Head `ca58e987fd68261d9e9db97b4e931651350d6e4a`; #866 번역과 #865 LLM을 제외한 레이아웃만 재구성한다.
- Base/Main: `352a43e74c7b34c72d952f67783a53463f8b519d`; 독립 후보 버전 `0.140.0` (다른 #865 PR도 같은 Main/version에서 출발하므로 선행 병합 뒤 후속 버전을 재정렬).
- risk_level: MEDIUM; qa_method: OWNER_MANAGED; qa_required: true; release_required: true; release_authorized: false; MERGE_READY: BLOCKED.

## 구현 및 보호 계약

- Main `src/features/projects/project-issue-workspace.tsx`의 기존 API/권한/상태/error/Task·Resource 검색을 보존하고 #869의 UI 구조만 적용. `project-issue-workspace.module.css`의 flex/overflow/형상, `src/app/globals.css`의 `.project-issue-panel` 스크롤 범위만 변경.
- 목록: 데스크톱 100건·10/20/50/100 pageSize, 테이블 내부 세로·가로 스크롤, sticky table th, KPI/검색/요약/footer는 독립 스크롤 밖.
- 편집: dialog header + Issue 명을 고정, 본문만 스크롤, 날짜3/등록자·담당자·상태3/신규 비밀번호·확인2열, 8행 textarea. 완료일/관련 Task 원문 ID/비밀번호·권한·soft delete 계약 유지. 좁은/낮은 화면은 가용 영역을 안전하게 stack/scroll.
- 같은 파일에 섞여 있던 #866 `useI18n`·번역 사전/언어 전환은 **미포함**. 기존 Main의 한국어 라벨과 비밀번호·API 동작을 유지하며 locale-specific 회귀는 #866 전용 PR에서만 추가한다.

## TEST_LIFECYCLE_REVIEW

기존 `tests/e2e/project-issues.spec.ts`의 #838~#854 업무/비밀번호/Task 복귀 테스트는 유지(KEEP_UNIQUE), #870에서 구현된 #869 geometry/scroll suite는 Main-only fixture로 이식(EXTEND). 별도 복제 spec/skip/timeout/retry/8Shard 변경 없음. 신규 테스트가 다른 언어를 토글한다고 가정하지 않도록 i18n 동작을 제거했다. [검증 계획](../../ISSUE_869_TEST_PLAN.md). 실제 로컬 앱·Full CI는 독립 Head 전에 NOT TESTED.

## DOCUMENTATION_SYNC

- `DESIGN.md`: UPDATED
- `docs/TEST_PLAN.md`: N/A(원문 방대한 공통 계획을 덮어쓰지 않고 869 전용 검증 계획에 기존 테스트 lifecycle과 직접 사례를 명시)
- `docs/PROJECT_UX.md`: UPDATED
- `docs/PROJECT_ISSUES_USER_GUIDE.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/ISSUE_869_TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_869.md`: UPDATED
- `docs/API.md`: N/A(DB/API/Origin/If-Match/Project Issue 저장 계약 변경 없음)
- `docs/SECURITY.md`: N/A(비밀번호/복구/삭제/조회 세션/입력 정책 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(기존 DB 컬럼·상태·migration 변경 없음)
- `docs/CI_CD.md`: N/A(공식 CI 및 8Shard/Required/Trusted/Owner 게이트 변경 없음)

## AC_TEST_COVERAGE

- AC1: `tests/e2e/project-issues.spec.ts` 100건·pageSize10/20/50/100 실제 table scroller와 상위 panel/document scroll, wheel·toolbar/footer 위치
- AC2: 기존 #838~#854 Issue 목록/필터·페이지/테이블·Gantt 인스턴스 불변, #867 env filter 별도 회귀 유지
- AC3: 신규 기존 spec에 dialog sticky header/Issue명/본문 스크롤·보안패널/포커스 및 overflow 확인
- AC4: 3열 날짜/등록자·담당자·상태, 2열 신규 비밀번호, 완료일 조건부 필수/readonly와 저장NULL 기존 assertion
- AC5: textarea8행·min11.5rem·Task/Resource 원본 lookup/권한/비밀번호·dirty pending 보존, 삭제·Task 복귀 기존 테스트
- AC6: 390/768/1024/1440/1920, keyboard/Tab/Escape, coarse 및 125%-상당 viewport, EN/VI locale는 독립 #866에서 재실증
- AC7: 기존 E2E 중복 없는 EXTEND와 DESIGN·PROJECT_UX·Issue 가이드·UI_UX_GUIDELINES/REQUIREMENTS·Changelog, CI 시작 전 NOT TESTED

## 진행 경계

- 의존성 없음: #865 LLM·#866 수동번역/Locale/DB를 참조하지 않는 독립 Main baseline. 실제 코딩 변경은 Issue 화면·관련 CSS/scroll/test·문서로 한정.
- 독립 PR의 exact Head Quality/E2E/Docker·Trusted QA/Owner ACCEPT·검토/merge 충돌은 CI 시작 이후 별도 확인해야 하며 이전 PR #870의 PASS를 재사용하지 않는다. 새 CI 실패 시 `docs/ISSUE_869_FAILURE_ANALYSIS.md` 전용 누적 원장 생성.
- 사용자는 분리 후 다음 작업 요청. 요청 범위는 분리·새 PR Full CI 시작이며, 실패 검사 완료 전 merge/Main/GHCR/Release/Issue 종료는 진행하지 않는다.
