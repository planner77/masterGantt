# Issue #909 누적 실패 연결 원장

#912·#909·#911 통합 구현의 단일 append-only Primary는 [Issue #912 원장](ISSUE_912_FAILURE_ANALYSIS.md)이다. 실제 Failure ID는 Primary에 한 번만 등록하고 이 연결 원장에서는 중복 생성하지 않는다. [Work Packet](exec-plans/active/ISSUE_912_909_911.md), [기계 인덱스](REGRESSION_INDEX.json)를 따른다.

기준 `8eaaaaa2b7b9a24e2b4a72e7d81698217da5cf2d` 위 WIP의 scoped 빠른 검증·운영 probe와 새 candidate 전체 Gate/실제 게시·종료를 구분한다. 실제 인증/DB/env/Origin/원시 로그는 공개하지 않는다. 원본 실패·BLOCKED와 후속 교정 결과는 Primary에서 삭제 없이 누적한다.
