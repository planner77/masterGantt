# Issue #33 실행 계획

기준 main은 `1415ad24718fe679ab9464292263cb6a45f25ed9`, 작업 branch는 `fix/issue-33-remove-gantt-demo-nav`다.

1. **분석** — 주요 navigation과 `/gantt-demo` 사용처를 확인한다. 검증 fixture로 사용되는 route는 보존한다.
2. **구현** — `WorkspaceShell`에서 `Gantt 데모` 링크를 제거한다. 별도 이벤트/handler는 없으므로 추가 삭제는 하지 않는다.
3. **회귀 테스트** — 기존 responsive header E2E를 프로젝트 메뉴 1개와 데모 미노출 계약으로 갱신하고 `/gantt-demo` 전용 E2E는 유지한다.
4. **버전·문서** — SemVer PATCH `0.8.1`, lockfile 동기화, CHANGELOG/README/Issue 검토 기록을 갱신한다.
5. **원격 검증** — PR을 생성하고 최종 head의 GitHub Actions quality/e2e/docker를 모두 통과시킨다. 실패 시 원인을 수정한 새 head를 다시 검증한다.
6. **완료 경계** — PR 생성과 CI PASS까지 수행한다. 사용자가 별도로 요청하지 않았으므로 main 병합과 `v0.8.1` 릴리스는 수행하지 않는다.

담당 논리 역할: frontend(헤더/E2E), qa_docs(계약·문서), infra(CI), Manager(통합). 현재 상태: **NOT TESTED**.
