# Issue #618 — Target 구성·WBS 연결 UI F4 Work Packet

## 기준 및 실행 경계

- Issue: https://github.com/planner77/masterGantt/issues/618; 상위 #613; 선행 #615/#616 완료, #617 PR #676 구현 main 반영.
- baseline main: `96c6c74b304f1ccd09f7340f37ebf0b0c393ae3b`; branch: `feat/issue-618-target-composer`.
- application version: `0.109.0` → `0.110.0` minor. Target authoring·WBS 연결·동일 원본 편집 추가; dependency graph 변경 없음.
- 현재 phase: QA_READY → PR_CI 준비. 요청 종료점은 구현·사전 리뷰 보완·리뷰 스레드/최신 main 충돌 해결 후 PR CI 시작 확인이다. CI 모니터링, 병합, main/GHCR/tag, 작업 브랜치 정리, Issue 종료는 후속이다.
- 실제 역할: `/root/target_ux` read-only 설계, `/root/target_ui` UI 구현, Manager 통합·backend usage 확장·테스트·문서·Issue 기록. 별도 `/root/preqa` read-only 사전 검토. 문서 작성자 및 공식 Issue comment writer는 Manager다.
- 파일 소유권: frontend=`src/features/logistics/**`, Target binding child 및 Task Editor; Manager=contracts/service usage, project-readonly-view callback, tests/docs/version. 같은 파일을 동시에 수정하지 않는다.

## 설계 및 상태 계약

이전 화면에는 Target authoring과 Target binding UI가 없다. 기존 물류 Workspace 하위 Target 탭에 검색·목록·상세를 추가하고 `WorkspaceDialog` composer에서 프로젝트 분류 → 명시 process/project_common → optional 해당 WorkArea → Target 이름·코드 → 기존 인스턴스 연결/신규 생성 → 검토·저장을 제공한다. 설비/시스템 종류 catalog와 Project-local instance를 재사용한다. 상세 controls/coordinates·업체·역할은 기존 관리 경로로 연결한다. 공통 관리자 저장은 Project 저장과 별도이며 취소가 이미 저장한 master를 되돌리지 않는다.

Task Editor 물류탭은 직접 Target binding, 읽기 전용 상속 출처, 기존 직접 설비/시스템 연결을 구분한다. 기본 self/whole, Summary만 subtree opt-in, subset은 실제 typed member를 선택하며 Equipment 작업수량은 optional이다. whole 선택은 subset/coverage 입력을 비운다. 상속 합집합을 직접 선택으로 덮지 않는다. 관리 Summary 대상 미지정은 정상이다.

Target 상세는 같은 read snapshot/revision의 usage.relatedTasks를 canonical tasks에 연결한다. 작업명·기간·진척·상태는 기존 Task Editor, Target 구성은 composer가 담당한다. 물류 화면을 유지하며 공통 Editor를 열고 닫는다. 새 Task·새 Gantt·새 viewport writer를 만들지 않는다. Target 상세 usage는 Task별 요청 없이 직접/상속 Target 관련 canonical ID를 한 번에 제공하고 legacy instance에서 Target을 역추론하지 않는다. 별도 공유 원본 수정 영향 확인은 Target 후보 Task를 최대1,000개 binding GET으로 필터링하고 초과/오류는 차단한다.

| 상태 | 동작 |
| --- | --- |
| loading / empty / no-results | 진행·대상 없음·검색 결과 없음과 재시도/다음 행동 구분 |
| readonly / inactive / 미매핑 | 조회 보존, 저장과 신규 연결 제한, inactive 기존 참조 보존, 미매핑 안내 |
| edit / dirty | 독립 초안, 취소·닫기·탐색·재조회에 명시 폐기 확인 |
| pending | 중복 제출·닫기·탐색 잠금, 늦은 응답은 request identity 확인 |
| error / 401 / 412 / stale | 오류와 복구 안내, 초안 보존, 자동 덮어쓰기 금지, 명시 재조회·폐기 |
| 변경 영향 | whole/subset/상속 및 공유 사용처 표시, 구성원 연결 제거와 원본 삭제 구분, 서버 영향 token/revision 재검증 |

390/768/1024/1440/1920px에서 한글·동명이름·내부 overflow, Tab/Enter/Escape·focus 복귀를 확인한다. 기존 system font·파란 Light UI·semantic token·44px 조작 영역을 사용한다. DESIGN Delta=B: 기존 progressive disclosure·상태·공통 dialog 원칙 구체화이므로 DESIGN.md N/A, 화면별 문서를 갱신한다.

공식 SVAR Base/Editor/tasks/exec 문서 및 설치 Core 2.7.3를 참고하되 기존 custom editor/session/revision/canonical gateway를 유지한다. ui_ux의 공식 문서 URL 조회와 실제 demo 조작 증거를 구분하며 demo 조작은 NOT TESTED다. PRO grouping/ResourceLoad, #497/#556/#550~#553, Resource 집계 확장은 비범위다. #572/#573은 관련 Gantt 회귀 테스트로 별도 확인하며 open Issue 상태만으로 기존 회귀 해결을 주장하지 않는다.

## DOCUMENTATION_SYNC

- `docs/API.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(기존 원칙 구체화, 새 전역 디자인 방향 없음)
- `docs/DB_SCHEMA.md`: N/A(기존 F1/F2/F3 영속 모델 재사용, migration/DDL 변경 없음)
- `docs/SECURITY.md`: N/A(기존 public readonly/Project edit session/Origin/strong If-Match 서버 계약 유지)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정 알고리즘/Dependency/Calendar 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(Import 및 unsupported Target binding 포맷 보호 불변)
- `docs/IMPORT_EXPORT.md`: N/A(외부 포맷 변경 없음)
- `docs/CI_CD.md`: N/A(기존 minor version 및 승인/required gate 정책 적용)
- `docs/REMOTE_VALIDATION.md`: N/A(공식 전체 회귀 및 환경별 검증 정책 유지)
- `docs/GITHUB_OPERATIONS.md`: N/A(권한·Ruleset·CI 운영 정책 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A(최신 OWNER_MANAGED 경계 유지)
- `docs/ISSUE_LIFECYCLE.md`: N/A(Lifecycle 정책 변경 없음)
- `AGENTS.md`: N/A(실행 지침 변경 없음)
- `docs/DEPLOYMENT.md`: N/A(운영 배포/컨테이너 변경 없음)

## AC_TEST_COVERAGE

- AC1: `tests/e2e/logistics-target-authoring.spec.ts` 실제 API/Chromium A/B 생성·AMR10+5·ACS A/B·동일 MCS 재사용, Equipment 합15/시스템3/Task 불변 및 reload identity.
- AC2: 같은 E2E의 optional A WorkArea/B 없음·관리자 WorkArea/신규 유효공정 inline 등록·별도 저장/명시 revision 적용·무권한 master 및 Project Target 쓰기401. 기존 F1/F2 negative HTTP에서 타공정 WorkArea/cross-project/atomic rollback.
- AC3: ACS-only subset/multiple Target, 관리 Summary 미지정, Target→동일 Task Editor PATCH1/Task 증가0. 저장된 DTO subset→whole→subset 및 binding ID 보존 재편집 회귀.
- AC4: Summary subtree 적용/저장된 subtree 제거 영향 확인, 상속+legacy union, subset member 제거 차단, 공유 원본 이름의 확인 전 mutation0/확인 후 revision+1/모든 Target 동일값. F3 whole token/coverage/사용중 삭제 rollback Unit/HTTP 병행.
- AC5: 실제 server412의 초안 보존/명시 폐기, 조회 응답역전, readonly, 지연 PUT 중 Escape/중복 차단 및401 초안, inactive 기존 참조 보존 source/HTTP. 모든 오류 종류의 실기기 수동 UX를 자동화 PASS로 확장하지 않는다.
- AC6: 390/768/1024/1440/1920px composer·목록·상세·WBS 연결·관리자 입력, 긴 한글·검색·Tab/Enter/Escape·focus 복귀·문서 overflow·내부 scroll. 수정 후390/1440 캡처. native zoom/실기기/screen reader/최종 수동 UX는 NOT TESTED.
- AC7: Target view 왕복의 revision 증가0/Gantt 동일 instance; 기존 `canonical-projection.spec.ts`/`project-workspace-tabs-518.spec.ts`/물류 관리 및 #572 Tab canonical 저장 선별 회귀. Dependency/Milestone/Resource pure tests93개 병행. #572/#573 전체 이슈 종료나 모든 미검증 상태 해결을 주장하지 않는다.
- AC8: DESIGN Delta B/N/A 및 관련 문서 동기화, Markdown211 files, trusted docs_gate 구조/AC1~AC8 매핑. 구조 PASS를 의미적 QA/Owner 승인으로 해석하지 않는다.

## 위험도·QA·승인

risk_level: HIGH
qa_required: true
qa_method: OWNER_MANAGED
independent_qa: N/A(Owner-managed; 별도 Agent 사전 검토는 최종 Trusted/Owner 승인 대체 아님)
manager_decision: NOT TESTED
release_required: true
release_authorized: false

공통 Editor/공유 인스턴스·상속 영향의 HIGH 위험을 기록한다. PR CI 전체 회귀와 Trusted QA·Owner 명시 결정 전 MERGE_READY=BLOCKED다. version 준비를 정식 게시 승인으로 해석하지 않는다.

## 검증 원장

- Local Fast Feedback: 관련 Vitest 10 files/157 tests + 일정·Milestone·Resource 6 files/93 tests PASS. typecheck/변경 ESLint/version:check/Markdown211 files PASS. 선별 Chromium38개 PASS(3.0m), 보완 후 F4 신규7개 PASS(2.8m), #572 실제 Tab 저장1개 PASS, 최종 label 순서·semantic token 및 Enter/Tab/Escape 5폭 재캡처1개 PASS(17.4s). 중복을 제외한 선별 브라우저 명세41개다.
- DOCUMENTATION_SYNC: 문서 영향/AC 맵 구조·의미 정합성 사전 검토 PASS.
- 별도 Agent 사전 검토: PASS(`/root/preqa`), 확인된 P1/P2 보완. 최종 QA_FINAL·Trusted QA·Owner ACCEPT와 별개.
- PR quality/e2e/docker: NOT TESTED (게시 후 CI 시작 확인까지만 수행, 결과 모니터링 없음).
- main GHCR/digest/임시 정리·정식 Release/tag/promotion: NOT TESTED (요청 범위 밖).
- 운영 환경/실기기/screen reader/최종 수동 UX: NOT TESTED.

## 사전 검토·실패 이력 및 운영 한계

- 실제 분리된 ui_ux/frontend/inline master/qa_docs 실행을 사용했다. 이 실행 설정을 모델/effort 실제 telemetry 검증으로 과대 표시하지 않는다.
- 사전 QA에서 saved binding DTO의 `taskId` 유출400을 실제 strict parser로 재현했다. PUT whitelist를 적용하고 기존 binding 재편집/ID 유지·저장된 subtree 제거 회귀를 추가했다. strict server schema를 완화하지 않았다.
- stale usage, inline 미추가 입력 dirty, Milestone authoring 제외, subtree 적용/해제/제거 확인, 검색/관련 작업, nested Escape, logical focus 복귀, beforeunload 및 실제 semantic token·44px/focus 표시 지적을 보완했다.
- 최초 Turbopack 외부 node_modules symlink 시작 실패는 같은 worktree 내부 hardlink 설치로 해소했다. 실제 관리자 bootstrap fixture의 최대12자 조건 및 implicit select label 테스트 선택자를 수정했다. 초기 keyboard fixture는 아직 loading으로 disabled인 버튼에 focus를 시도해 실패했으며 enabled/focus 확인 후 Enter로 검증했다. 영향 확인 전 checkbox `uncheck()`는 의도적으로 즉시 상태를 바꾸지 않으므로 실제 click→확인→저장 단언으로 교정했다. 실패 실행을 최초부터 PASS였다고 기록하지 않는다.
- Target 상세 relatedTasks는 한 read snapshot이며 Task별 GET이 없다. 공유 원본 instance 영향 확인은 Target 후보 최대1,000개의 binding aggregate를 조회해 subset 제외 인스턴스를 잘못 포함하지 않는다. 한도/오류는 fail-closed다. Target 없는 legacy 직접 사용처 건수 미산출은0 대신 미산정이다.
- 공통 master 등록은 별도 관리자 transaction이다. 신규 local 공정 POST와 mapping PUT도 별도 저장이며 두 번째 실패시 첫 공정이 남음을 안내한다. 이 흐름에서 반환된 exact revision만 명시 적용하고 다른 외부 revision 변경은 계속 stale로 차단한다.
- CI/Ruleset/required check/registry 권한 및 scheduling/Resource/Milestone 원장은 변경하지 않는다. 운영 DB backup/restore·실기기/native zoom/최종 수동 UX·성능 대규모 실증은 NOT TESTED다.

## 최종 로컬 증거와 게시 handoff

[실행 원장](../../../output/playwright/issue-618/validation.json)은 baseline과 제품·테스트 source SHA-256, 실제 실행 수/범위/FAIL 이력 및 원격 NOT TESTED를 분리한다. [390px composer](../../../output/playwright/issue-618/target-390.png), [1440px composer](../../../output/playwright/issue-618/target-1440.png)는 최종 semantic token 및 이름 우선 공정/WorkArea label 적용 후 재캡처다. 고정 UUID isolated 경로가 자동 추가된 next-env.d.ts/tsconfig.json은 복구하여 diff에서 제외했다. 로컬 전체 회귀나 운영 UX PASS를 주장하지 않는다.

최종 PR head/URL, 원본 CI run/attempt 및 리뷰 스레드/mergeability 확인은 Issue STATUS 기록으로 인계한다. CI 시작 확인 후 모니터링하지 않으므로 최종 Quality/E2E/Docker·Trusted QA·Owner/Manager 결정은 NOT TESTED이고 MERGE_READY=BLOCKED다. 작업 branch와 Issue는 유지한다.
