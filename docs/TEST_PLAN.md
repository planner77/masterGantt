


## Project Issue 통합 검증 #838–#840

- ADD: tests/server/projects/project-issues.test.ts — YYYY-MM-DD 실재·완료일 불변식, owner-session 검증, 정확 프로젝트 Task/Resource FK·삭제 보존, 23건 pagination, 전체 완료 분모/문구·상태 검색, SQL persistence, HTTP origin/If-Match/401/403/404/412/no-store.
- EXTEND: tests/features/project-workspace-navigation.test.ts, tests/e2e/project-workspace-tabs-518.spec.ts — schedule/issue/dashboard/master 네 상위 탭과 기존 Gantt instance·keyboard.
- ADD: tests/e2e/project-issues.spec.ts — Issue UI 등록/리소스/Task 검색, 완료일 체크·해제·수정, http(s) 링크 escape, 검색/결과/페이지 크기, 일정 복귀.
- KEEP_UNIQUE: 기존 프로젝트 auth/Task/Gantt와 Resource·Milestone 회귀. 이들은 독립 보안 및 브라우저 관찰 증거이므로 삭제/skip하지 않는다.
- 현행 PR/Main 8 Chromium shards와 Required Quality/E2E/Docker, trusted QA·Owner Managed·Finalizer 게이트는 그대로 적용한다. 로컬 검증이 실행되지 않았다면 NOT EXECUTED, Remote는 인증된 Run/Attempt에 따라 기록한다. [통합 실행](exec-plans/active/ISSUE_838_840.md).
