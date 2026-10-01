# Issue #344 삭제 실패 복구의 확정 상태 보존

상태: 구현·문서 동기화·독립 사전 QA PASS, PR/CI 시작 전달 준비. 사용자 요청은 로컬 최신화 → 구현 → 문서 동기화·독립 사전 QA → PR 생성·CI 시작까지다. CI 완료 모니터링과 병합·main 검증·GHCR·Issue 종료는 이번 범위 밖이다.

## 기준과 결정

- Issue: [#344](https://github.com/planner77/masterGantt/issues/344), OPEN, 착수 시 기존 댓글·동일 Issue PR/branch 없음.
- 최신 main: `6532edd8418772454b96fdeb895b90c5ab7d3d6d`.
- 작업 branch: `fix/issue-344-task-delete-failure-rollback`.
- 버전: `0.58.3 → 0.58.4` PATCH. 삭제 실패 시 이전 성공 삭제가 복원되는 클라이언트 상태 일관성 결함 수정이다.
- `release_required=false`: 이번 승인 범위는 PR/CI 시작까지다. `release_authorized=false`: 정식 게시 승인 없음. 이후 병합을 진행할 경우 version 변경에 따른 Generic Release Finalizer의 release 필요성·승인을 별도로 판단해야 한다.
- tracked 작업 트리는 착수 시 clean이며 기존 untracked `output/playwright/` 증거는 보존한다.

## 요구사항과 비범위

Task C 삭제 성공으로 revision이 증가한 뒤 Summary S의 마지막 child 삭제가 409로 거부되어도 C는 Grid/Chart·서버 GET에서 삭제된 상태를 유지해야 한다. 마지막 child는 보존하며 이미 확정된 revision보다 오래된 snapshot을 다시 적용하지 않는다.

- 실패 복구의 기준은 마지막 서버 확정 canonical snapshot이다. 성공 → 실패를 2회 이상 반복하고 409 뒤 정상 변경·reload에서도 같은 상태를 확인한다.
- Grid와 Chart의 task set, Gantt 인스턴스, tree/collapse/scroll/scale·선택 상태를 일관되게 유지한다.
- 401/409/412/network 실패와 오래된 recovery GET 응답의 적용 여부를 검증한다. 자동 재저장으로 stale 초안을 확정하지 않는다.
- 단건/subtree 삭제와 unrelated Link 보존, `EMPTY_SUMMARY_NOT_ALLOWED`, session/Origin/If-Match 및 서버 transaction/revision 계약은 유지한다.
- 빈 Summary 자동 삭제·일반 Task 자동 전환, 페이지 reload나 Gantt remount를 통한 우회 해결, UI 재설계·새 의존성·서버 정책 확장은 비범위다.

## 소유권과 단계

| 담당 | 소유 범위 | 산출물 |
| --- | --- | --- |
| frontend | Project workspace/Gantt 복구 코드, 관련 frontend Unit·E2E, PROJECT_UX/REQUIREMENTS/TEST_PLAN 및 API 복구 설명 | 실제 원인·수정 전 재현, 최신 canonical/단조 revision 복구, 브라우저 증거 |
| backend | 신규 실제 SQLite DELETE 회귀 테스트, ISSUE_344_SERVER_VALIDATION 문서 | 두 transaction의 분리·성공 삭제 유지·GET/reopen·subtree/Link 근거. 서버 코드는 문제 발견 후 Manager가 범위를 조정할 때만 수정 |
| ui_ux | 읽기 전용 설계·구현 비교 | 실패별 상태·focus·Gantt view 상태 보존 검토 |
| infra | branch/version/package/lockfile/CHANGELOG 및 QA 이후 commit/push/PR/CI | exact head와 CI 시작 증거. CI 완료 모니터링 없음 |
| qa_docs | 읽기 전용 독립 검토 | AC/code/tests/docs·실제 Local Fast Feedback 비교 |
| Manager | 계획·Issue 공식 기록·통합 판정 | 범위·문서 영향·handoff 관리 |

공식 Issue 댓글 작성자는 Manager다. 동일 파일 동시 쓰기와 무단 Agent 재귀 위임은 금지한다. 구현·문서 동기화 → 독립 QA 사전 검토 → PR/CI 시작 순서로 진행한다.

## 검증과 문서 영향

로컬은 변경 관련 Unit/실제 SQLite Integration/targeted Chromium·typecheck/lint를 수행한다. 공식 전체 회귀는 새 PR head의 GitHub `quality/e2e/docker`이며 아직 **NOT TESTED**다.

- Unit: success snapshot 이후 실패에서 이전 성공 상태 유지, revision 단조성, stale snapshot 거부, mutation-local 복구.
- 실제 SQLite: C 삭제 성공 +1 → 마지막 child 409 +0 반복, GET/reopen, subtree와 unrelated Link 보존.
- Chromium: Grid/Chart 삭제 경로, 접힌 Summary, 연속 삭제 성공/실패, 401/412/network·stale GET, 후속 정상 변경, instance·scroll·tree·scale·reload.
- API route/서버 응답 계약이 같으면 API에는 서버 계약 변경 없음과 client 복구 기준을 명시한다. DB_SCHEMA/SCHEDULING_ENGINE/SECURITY는 정책·schema 변경이 없으면 항목별 N/A로 기록한다.
- CI_CD/REMOTE_VALIDATION/배포는 workflow·registry·운영 계약 변경이 없으므로 N/A다. version은 기존 SemVer 절차를 따른다.
- [DESIGN](../../../DESIGN.md), [UI_UX_GUIDELINES](../../UI_UX_GUIDELINES.md), [PROJECT_UX](../../PROJECT_UX.md), [Issue Lifecycle](../../ISSUE_LIFECYCLE.md)와 #31 삭제 계약을 따른다.

## 분석·실행 근거

착수 시 코드에서 lower revision을 무조건 수용하는 `applySnapshot`, cache 옵션이 없는 recovery GET, 실패 후 remount fallback과 SVAR 초기 task props를 조사 대상으로 확인했다. 이는 정적 조사 후보이며 실제 원인으로 단정하지 않는다. 구현 담당의 브라우저/API trace로 원인을 확정한다.

공식 참조: [React state snapshot](https://react.dev/learn/state-as-a-snapshot), [SVAR server integration](https://docs.svar.dev/react/gantt/guides/load-and-save/save-to-backend/), [api.exec](https://docs.svar.dev/react/gantt/api/methods/exec/). 문서 조회와 설치 Core `2.7.3`의 실제 동작 증거를 구분한다.

### 기준 동작 검증

- 최신 main의 실제 Chromium에서 정상적인 성공 삭제 → 마지막 child 409를 두 차례 반복한 검사는 PASS(26.3초)다. 이전 성공 삭제·revision·동일 Gantt 인스턴스를 보존하여 Issue의 원증상을 이 경로에서는 재현하지 못했다.
- 실제 파일 SQLite의 Handler/Service/Repository 검사는 3 files / 23 tests PASS다. 단건·subtree 각각 성공 삭제 → 409를 두 차례 반복하고 401/403/412·unrelated Link·DB 재오픈을 검사했다. 상세 서버 근거는 [서버 검증 기록](../../ISSUE_344_SERVER_VALIDATION.md)을 따른다.
- 오래된 복구 응답·복구 GET 실패·권한 변경은 위 정상 기준 동작과 별개의 fault-injection 검증이다. 해당 경로의 재현 결과와 수정 근거를 구분하며 서버 정책 변경의 근거로 사용하지 않는다.
- 수정 전 실제 Chromium/SQLite fault injection: Task C 성공 삭제 → 마지막 child 409의 recovery GET에 초기 snapshot을 반환하면 Grid의 C 행이 다시 1개가 되어 회귀 검사가 FAIL(8.3초)했다. 이는 오래된 recovery 응답 적용의 결함이며 정상 서버 GET에서 원증상이 재현됐다는 의미는 아니다.
- 추가 화면 상태 검사에서 기존 canonical sync가 삭제된 앞쪽 sibling을 포함해 순서를 비교하면서 불필요한 `move-task`를 실행하는 결함을 확인했다. Unit 수정 전 delete 뒤 불필요 move 2회 FAIL → 살아 있는 sibling만 비교하도록 수정 후 관련 2 files / 12 tests PASS다. Manager가 최종 코드·테스트 통합과 브라우저 실행을 인수했으며 frontend는 관련 문서 작성까지 담당했다.
- 최종 Chromium 삭제 복구 7 tests PASS(2.5분), 기존 pointer 저장·거부·GET 실패·same-revision race 1 test PASS(31.8초). Grid/Chart·이전 성공 삭제·마지막 child·DB revision·동일 widget/API·접힘·가로 scroll·week·reload를 확인했다. 변경 TS lint/typecheck/version check도 PASS이며 초기 조회의 stale 응답 분기 보완 이후 독립 QA에서 다시 확인한다.
- DOCUMENTATION_SYNC: ARCHITECTURE/PROJECT_UX/REQUIREMENTS/API/TEST_PLAN·서버 근거·계획·CHANGELOG 갱신. 독립 QA에서 ARCHITECTURE의 이전 강제 remount 설명을 찾아 same-instance 계약과 공개 SVAR 동기화 자체의 예외 fallback을 구분하도록 보완했다. 서버 계층·API endpoint/보안/DB/도메인 정책은 동일하며 위 N/A 근거를 유지한다. UX read-only 코드·테스트·실제 PNG 비교 PASS. 캡처의 fixture/date/scale이 달라 픽셀 비교 근거로 사용하지 않는다.
- 독립 `qa_docs` 사전 QA PASS: 직접 5 files / 35 tests·최종 typecheck·변경 TS 8개 lint·version check·Markdown 링크 92개·diff 검증을 수행했다. 문서 REWORK 이후 ARCHITECTURE/PROJECT_UX·문서 영향 근거를 재검토했다. pointer Playwright report는 QA가 직접 확인했고 삭제 7개는 Manager의 실제 실행 출력 근거다. 이는 공식 PR CI PASS/최종 코드 ACCEPT가 아니다.
- 별도 미검증: 초기 조회 stale fallback의 브라우저 조작, 서버 commit 후 응답 유실, 세로 scroll·selection·독립 keyboard/focus, 추가 소형 viewport. 서버 계약·CI gate·의존성은 변경하지 않는다. 원격 CI 결과는 PR exact-head에서 별도 판정한다.
