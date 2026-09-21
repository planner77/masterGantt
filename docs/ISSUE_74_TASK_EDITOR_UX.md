# Issue #74 Task Editor UX 구현·검증 기록

상태: 구현 완료 / PR #82 최종 CI 검증 진행  
작업 브랜치: `feat/issue-74-task-editor-ux`  
버전: `0.20.0`

## 구현 범위

- Task Editor를 작업 정보 / 리소스 / 관계의 3개 탭으로 재구성한다.
- Header / Tab / Footer는 고정하고 본문만 스크롤되는 반응형 large modal 구조를 적용한다.
- 리소스 할당 화면은 검색, 유형 필터, 할당됨 필터, 선택 우선 정렬, Resource/Group 구분을 제공한다.
- 관계 화면은 wide viewport에서 선행/후행 2열, narrow viewport에서 1열로 표시한다.
- WAI-ARIA Tabs 패턴과 Arrow Left/Right, Home/End 키보드 탐색을 적용한다.
- Task PATCH와 Assignment PUT 저장 계약, Project revision / If-Match / stale 처리 계약은 변경하지 않는다.

## 버전

기준 main의 `0.19.1`에서 하위 호환 사용자 UX 개선이므로 0.x 정책에 따라 MINOR 증가한 `0.20.0`으로 관리한다.

- `package.json`: 0.20.0
- `package-lock.json`: 0.20.0
- `CHANGELOG.md`: 0.20.0 변경 이력 추가

## 테스트

- Unit: `tests/features/gantt/task-editor-view-model.test.ts`
- E2E: `tests/e2e/project-task-editor.spec.ts`
- 기존 Task Editor / Resource Assignment / Relation / responsive 회귀를 함께 GitHub Actions에서 검증한다.
- 최종 병합은 Build/static/unit, Chromium E2E, Docker runtime smoke가 모두 PASS한 head만 허용한다.

## 최신 main 동기화

2026-09-22 기준 Issue #75 후속 PATCH `0.19.1` merge 이후 최신 `main`을 PR #82에 병합했다.

- Issue #75의 responsive E2E 안정화 수정과 release 기록은 보존한다.
- #74 버전은 `0.20.0`으로 유지한다.
- 동기화 후 PR #82는 `main` 대비 behind 0, mergeable 상태로 확인했다.
