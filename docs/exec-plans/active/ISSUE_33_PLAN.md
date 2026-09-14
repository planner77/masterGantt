# Issue #33 실행 계획

기준 main은 `1415ad24718fe679ab9464292263cb6a45f25ed9`, 작업 branch는 `fix/issue-33-remove-gantt-demo-nav`다.

1. **분석 — DONE**: 주요 navigation과 `/gantt-demo` 사용처를 확인했다. 검증 fixture로 사용되는 route는 보존한다.
2. **구현 — DONE**: `WorkspaceShell`에서 `Gantt 데모` 링크를 제거했다. 별도 이벤트/handler는 없어 추가 삭제하지 않았다.
3. **회귀 테스트 — DONE**: 기존 responsive header E2E를 프로젝트 메뉴 1개와 데모 미노출 계약으로 갱신하고 `/gantt-demo` 전용 E2E는 유지했다.
4. **버전·문서 — DONE**: SemVer PATCH `0.8.1`, lockfile 동기화, CHANGELOG/README/Issue 검토 기록을 갱신했다.
5. **원격 검증 — PASS**: 구현 head `10ce5840514f4c5caf7369ff8014d1cbf572654e`의 CI Run #128 (`34905942327`)에서 quality, Chromium E2E, Docker gate가 모두 성공했다. 문서 동기화 이후 최종 PR head에도 동일 gate를 다시 확인한다.
6. **완료 경계**: PR #42 생성과 최종 head CI PASS까지 수행한다. 사용자가 별도로 요청하지 않았으므로 main 병합과 `v0.8.1` 릴리스는 수행하지 않는다.

담당 논리 역할: frontend(헤더/E2E), qa_docs(계약·문서), infra(CI), Manager(통합). 구현 head 기준 상태: **PASS**. 최종 PR head 검증 좌표는 PR 본문에 기록한다.
