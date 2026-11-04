# Issue #869 — Project Issue UI 독립 테스트 계획

Source: https://github.com/planner77/masterGantt/issues/869

## 기존 테스트의 재사용

`tests/e2e/project-issues.spec.ts`의 기존 #838~#854 계약(읽기 권한·비밀번호·논리 삭제·상태/완료일·등록 후 Task 복귀, Origin/revision, 미저장 보호)은 유지한다. 통합 PR #870에서 추가했던 #869 레이아웃 geometry/scroll 사례를 기존 spec에 **추가**하되, #866의 브라우저 ko/en/vi 선택 이벤트는 제외하여 별도 이슈에 남긴다.

## 직접·인접·음성 검증

- 실제 100건 fixture, pageSize10/20/50/100, 목록 단일 overflow-y와 문서·상위 패널 세로 overflow0, 실제 wheel 시 상단 필터·하단 pagination 고정, 표 내부 가로 스크롤.
- 신규/수정 dialog 제목/닫기·Issue명 고정, 3열 날짜·사람+상태·비밀번호2열, 내용 8행, 기존 비밀번호 재설정/삭제 확인, 포커스/Tab/Escape, 390/768/1024/1440/1920 폭, coarse, 작은 viewport·125%-상당 뷰.
- 업무 저장/권한/데이터 구조/Issue 날짜/Project 탭과 Gantt instance·Task Editor 관련 Task id/dirty 초안 보존은 기존 테스트 그대로. #866 long EN/VI 실제 사전 렌더·locale 변경 시 재배치는 #866 독립 PR에서 재검증.
- 모든 Source/Tests는 Main-only 기반이므로 이전 #870 combined E2E 일부 PASS를 새 독립 PR의 PASS로 합산하지 않는다. Local/Remote 본 Head 검증은 CI 실행 전 NOT TESTED.
