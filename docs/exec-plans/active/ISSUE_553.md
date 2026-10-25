# Issue #553 Work Packet — marker OFF 기준 재통합 (2026-10-25)

repository: planner77/masterGantt
primary_issue: #553
existing_pr: #562
risk_level: HIGH
qa_method: OWNER_MANAGED
qa_required: true
release_required: true
release_authorized: false
manager_decision: NOT TESTED
MERGE_READY: BLOCKED
lifecycle_phase: REWORK → IMPLEMENTATION → DOCUMENTATION_SYNC → PR_CI_STARTED (requested)
main_baseline: 22144ce3844ab50ac0f22a715742c9df82e072e8
old_pr_head: afd5ec2899183a2464b64f91d34e9de5d8a8319c
archive: archive/issue-553-pr562-20261018
candidate_version: 0.133.2 → 0.133.3 PATCH

## ISSUE_AC

| ID | 수용 의미 | 확인 경로 |
| --- | --- | --- |
| AC1 | 조회·OFF·scope/filter/접힘에 프로젝트 revision, 전체 Task/Link/명시·유효 membership, Gate/roll-up 무손실 | #552 marker-OFF E2E 및 #553 canonical fixture/integration |
| AC2 | JSON1.1 전체 교환·UUID/FK 새 매핑·legacy mixed atomic reject | `milestone-timeline-interchange.test.ts`, actual HTTP spec |
| AC3 | Copy/Template/multi-root Copy/Cut, 완료 잠금·외부 소속·rollback | 동일 integration/HTTP; 기존 #464 tests |
| AC4 | Excel full canonical/기존 sheet·Resource opt-in/E/P/F 및 SVG/PNG full expanded WBS/date clip/fail-closed | integration/HTTP + 기존 image/Resource E2E |
| AC5 | 내보내기 대화상자에 화면과 원본 범위 차이 설명, keyboard/5폭·직접 조회/복귀 정책 | `project-gantt-image-export.spec.ts`; #552 5폭 OFF E2E; #574 통합 |
| AC6 | 최종 사용자 가이드/유효 membership/Ready·Completed·해당 날짜 대체 경로/환경별 한계 | `MILESTONE_USER_GUIDE.md`, traceability |
| AC7 | 기존 실패/미실행/Exact-head/독립 QA/Owner/Release 경계 | 단일 `ISSUE_553_FAILURE_ANALYSIS.md`; 현재 Full8 결과 후 별도 판정 |

## DESIGN / 소유권 / 충돌 처리

[DESIGN](../../../DESIGN.md)과 [Presentation Policy](../../MILESTONE_PRESENTATION_POLICY.md) 우선: native Grid/Chart M row·bar 0 / 생산 Timeline lane·marker OFF. Milestone Dashboard·Task 소속·Editor로 사용자 경로를 대체한다. 기존 full canonical JSON1.1/Excel/이미지 Server renderer·Auth/Origin/If-Match/Revision/SQLite/Resource/Logistics/Stage Gate 계산기 불변. SVAR PRO markers·새 날짜 스크롤 writer/새 export schema/API/DB migration은 비범위.

Old PR #562는 marker ON 기반 91-file diff, 최신 main 대비 1398 commits 뒤처져 dirty. **이전 PR/브랜치/리뷰/실패 결과를 버리지 않는다**. 최신 main tree를 기초로 old HEAD와 main HEAD를 함께 부모로 가지는 새 merge commit을 PR head에 fast-forward한다. 새 tree에는 old E2E marker ON/UI/viewport hotfix/old outdated guide/CI artifacts를 억지로 적용하지 않는다. #553 canonical fixture/실제 HTTP+SQLite/integration, Export 안내 및 기존 이미지 E2E 단언·current-user guide·정규 누적 원장만 이관. 선택 영역 충돌시 main 계약 우선; full integration 수용은 #574.

## AC_TEST_COVERAGE / TEST_LIFECYCLE_REVIEW

- **KEEP_UNIQUE:** `tests/integration/milestone-timeline-interchange.test.ts`의 full UUID/FK/parent/Link/Membership·rollback/OOXML+SVG 실제 DB 테스트; `tests/e2e/milestone-timeline-interchange-http.spec.ts`의 실제 HTTP/SQLite/프로세스 재시작은 synthetic `milestone-exchange-state.spec.ts` 및 #552 UI와 위험 경계가 다르므로 별도 유지.
- **EXTEND:** 기존 `tests/e2e/project-gantt-image-export.spec.ts` 실제 SVG/PNG 다운로드에 공통 안내 assertion 추가. 별도 동일 목적 5폭 E2E를 중복 작성하지 않고 #552 `milestone-visibility.spec.ts`의 정확 OFF 5폭·Day/Week 계약을 참조한다.
- **PARTIAL_OVERLAP:** #464 exchange/Resource report 관련 기존 테스트와 #553 full source/실제 HTTP 테스트는 일부 경로만 겹친다. source 비동등으로 승인 없이 통합/삭제 금지.
- **KEEP HISTORICAL / DO NOT IMPORT:** 2026-10-09 old `milestone-timeline-interchange-ui.spec.ts`의 marker ON/cluster/토글 스펙, old `project-gantt.tsx` hotfix, old 0.106.1 사용자 가이드는 운영 OFF와 충돌하여 archive와 old commit에만 보존. 검사 없이 skip/퇴역했다고 기록하지 않는다.
- Search basis: existing `milestone-visibility.spec.ts`, `milestone-wbs-mode.spec.ts`, `milestone-exchange-state.spec.ts`, `milestone-stage-exchange.spec.ts`, `project-gantt-image-export.spec.ts`, `resource-excel-export-ui.spec.ts`, `project-gantt-inline-name.spec.ts`, `task-editor-form-density.spec.ts`. 모든 known test-level 과거 오류는 실패 원장 참조; 최신 Head에 대한 실행은 **NOT TESTED**.
- `npm run typecheck`, `npm test -- tests/integration/milestone-timeline-interchange.test.ts`, `npm run test:e2e -- tests/e2e/milestone-timeline-interchange-http.spec.ts tests/e2e/project-gantt-image-export.spec.ts`, `npm run verify:prepr`은 실행 환경 미제공으로 **NOT EXECUTED**. 원격 Full PR quality + Chromium8 + Docker + Trusted QA가 정규 결과 원천이다. Docker/Windows Excel/DRM/운영 reverse proxy도 NOT TESTED.

## DOCUMENTATION_SYNC & 영향 N/A

- 신규 사용자 [guide](../../MILESTONE_USER_GUIDE.md)·[MT1~MT5 trace](../../MILESTONE_TIMELINE_TRACEABILITY.md)·[누적 실패 원장](../../ISSUE_553_FAILURE_ANALYSIS.md) 및 Changelog/version 갱신. 기존 DESIGN/AGENTS 정책 변경 필요 없음. `MILESTONE_TIMELINE`, `PROJECT_UX`, `REQUIREMENTS`, `TASK_EDITOR`, `TASK_RELATIONS`, `IMPORT_EXPORT`, `EXCEL_EXPORT`, `IMAGE_EXPORT`, `MILESTONE_STAGE_GATES`의 **서버/화면 기본 계약은 unchanged**; 2026-10-15 정책의 marker OFF가 최신 source of truth이며 새 guide에 사용자 동작/차이를 일관되게 명시.
- API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/CI_CD/DEPLOYMENT N/A: 새 route/schema/migration/권한/계산/writer/Runner/배포 정책 없다. old source의 버전/장치별 log·screenshots 무단 복사 없음.
- 요청 종료점: 기존 PR 리뷰 스레드/mergeability 확인 → latest-main 충돌 해결 → 새로운 PR Full CI **등록**. 이후 모니터링/병합/Main/GHCR/정식 Release/Issue 종료 안 함. 독립 qa_docs/PRE_QA 및 Manager 최종 수용은 별도 검증, 이번 실행에서 수행했다고 주장하지 않는다.
