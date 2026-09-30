# Issue #345 — 빈 Summary WBS 컨테이너

상태: PR_READY — 독립 사전 QA PASS, 원격 CI NOT TESTED. 사용자 요청은 최신 로컬 저장소 → 구현 → 문서 동기화·독립 QA → PR 생성·Issue 번호가 포함된 CI 실행 시작까지다. CI 완료 모니터링·병합·main/GHCR·릴리스·Issue 종료는 범위 밖이다.

## Issue Work Packet

- Issue: [#345](https://github.com/planner77/masterGantt/issues/345), OPEN. Issue 본문의 등록 전용 범위는 이번 사용자의 명시적인 구현 요청으로 대체한다.
- 기준 main: `714bf2fd2c1a290bf2ae1d1541f0e2068bc6b2bb`, `0.58.4`. #344 PR #358은 외부에서 main에 병합되었고 로컬 main을 fast-forward했다. #345 기존 branch/PR 없음.
- 작업 branch: `feat/issue-345-empty-summary`.
- Application version: `0.59.0` MINOR. Summary 일정의 nullable DTO·DB 계약과 기능 추가를 포함하는 0.x 변경이며 단순 UI patch가 아니다. 기존 Leaf 입력 검증은 유지한다.
- `release_required=false`: 현재 승인된 PR/CI 시작 범위에서 정식 release는 N/A다. 병합 후 Generic Release Finalizer의 version 변경 release 요구는 별도다. `release_authorized=false`: 정식 게시 승인 없음.
- Issue 공식 댓글 writer: Manager. Sub-Agent 댓글 허용 유형 없음. 동일 파일 동시 쓰기·무단 Agent 재귀 위임·version/PR 중복 생성 금지.
- 기존 untracked 캐시·화면 증거 7개 경로는 보존하며 이번 stage에서 제외한다.

## 계약과 인수 기준

Summary는 자식 유무와 독립적인 WBS 컨테이너다. 일정이 있는 Task/Milestone 자손이 없으면 `type=summary`, `scheduleMode=auto`, `requestedStart/start/end/duration/progress=null`이다. 직접 자식이 빈 Summary뿐인 경우도 같다. 빈 Summary는 상위 일정·가중 진척·Baseline 집계의 중립 요소이며 WBS/ID/parent/order·직접 Resource/Group·물류 연결은 유지한다. Milestone의 duration 0과 미산정 Summary를 구분한다.

Root·중첩 Summary를 이름·위치만으로 생성한다. 첫 Leaf 추가/마지막 Leaf 삭제·지원되는 이동은 모든 조상의 일정과 진척을 같은 transaction에서 갱신한다. 마지막 child가 사라져도 부모의 타입/ID를 바꾸거나 자동 삭제하지 않는다. populated subtree 삭제는 기존 명시 확인을 유지하며 빈 Summary 단건 삭제는 허용한다.

Issue AC01–16 전체를 구현·검토 범위로 삼는다. DB migration/FK/rollback/reopen, API/revision/auth, hierarchy/Dependency, Baseline/Resource/logistics KPI, nullable 필터·기간, copy/template, JSON/VBA 계약·Excel/SVG/PNG Export, 실제 Core Grid/Chart·행/메뉴·keyboard·390/768/1024/1440px·인스턴스 보존을 검증한다. 공식 원격 전체 회귀 AC16은 CI 시작 시 NOT TESTED이며 로컬 결과로 대체하지 않는다.

### 호환성과 비범위

- 일반 Task/Milestone의 날짜·기간·진척 필수 규칙, Summary Dependency endpoint 금지, 기존 Link 삭제·이동 제약, session/Origin/strong If-Match/Project 격리·revision +1/실패 +0는 유지한다.
- 가짜 날짜·duration·진척을 도메인/API/DB에 저장하지 않는다. PRO 구매/전용 unscheduledTasks·summary 옵션·비공개 구현 복제는 승인 범위 밖이다. Core 2.7.3 실제 최소 fixture 실험 후 public extension point/앱 adapter로 표시한다.
- #299 Chart 수직 DnD 자체, 신규 Baseline 이력, 일반 Leaf 미일정 상태, 부모 자동 Task 전환, 기존 명시적 kind 변환의 Task→Summary 확대는 비범위다. 직접 Summary 생성과 기존 첫 child 생성의 승인된 Task→Summary 전환은 지원한다.
- 현재 Import preview/commit API·화면이 저장소에 없음을 발견했다. 사용자가 Import 계약·검증기·VBA 갱신으로 범위를 확정했고 신규 Import UI/API는 별도 이슈로 분리하도록 답했다. 따라서 이번 Import 검증은 명시적인 Summary/null·기존 입력 호환 계약과 producer/validator까지며 실제 preview/commit PASS를 주장하지 않는다. 이미 동일 Import UI/API 흐름을 다루는 [#30](https://github.com/planner77/masterGantt/issues/30)이 있어 중복 이슈 대신 해당 후속 범위에 연결한다. #30의 별도 제안인 Leaf 날짜 결측·리소스/schema 2.0은 이번 1.0 Summary 계약에 섞지 않는다.

## 소유권과 handoff

| 역할 | 쓰기 소유 범위 | 책임 |
| --- | --- | --- |
| scheduler | src/domain/**, tests/domain/**, SCHEDULING_ENGINE | nullable Summary 모델·Leaf strict guard·빈 집계·Baseline/WBS/Dependency 순수 로직·Unit |
| backend | src/contracts/**, src/server/**, db/migrations/**, tests/server/**·tests/contracts/**, API/DB_SCHEMA/ARCHITECTURE/IMPORT_SCHEMA/DEPLOYMENT·관련 Excel/Image/Import Export·Resource workload·물류 문서 | 모든 canonical 생산 경로, migration·영속성·보안, copy/template/export·집계·Import 계약 |
| frontend | src/features/**, src/lib/**, tests/features/**·tests/e2e/**·tests/fixtures/stateful-project.ts, PROJECT_UX/TASK_EDITOR/UI_UX_GUIDELINES/PRO_FEATURE_MATRIX/TEST_PLAN | Core probe, 생성·표시·정보·검색/필터·nullable 소비, 실제 browser·캡처 |
| ui_ux | 읽기 전용 | 정보 구조·기존 + 의미·null 표시·상태/접근성 설계와 구현 비교 |
| infra | git 운영, package/lock/CHANGELOG, CI workflow·정책 검사, CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS | version·run-name·branch, QA 후 commit/push/PR·exact-head CI 시작 |
| qa_docs | 읽기 전용, DOCUMENTATION_SYNC 이후 | AC/code/tests/docs·migration/security·실제 로컬 증거 독립 비교 |
| Manager | REQUIREMENTS·활성 계획·Issue 공식 기록·공용 interface·통합 | scope/version·충돌 조정·독립 사전 QA·PR 전달 gate |

VBA producer가 존재하면 excel_vba에 분리된 소유권을 후속 배정한다. 다른 Agent의 파일을 변경하지 않고 필요한 interface 수정은 소유자와 Manager에게 반환한다.

실제 VBA 코드는 없어 excel_vba에 `docs/VBA_EXPORT.md`와 `tools/vba/Issue345SummaryJson.bas`의 독립 변환 샘플을 배정했다. 샘플은 null 필드/JSON 문자열 조각 생성이며 전체 Workbook 추출기·UTF-8 writer·Importer가 아니다. 실제 Windows Excel/VBA·DRM 실행은 NOT TESTED로 남긴다.

## 검증·문서 동기화

구현 → 변경 관련 Local Fast Feedback → required docs 갱신/항목별 N/A → 독립 QA → PR·CI 시작 순서다. 기존 #344의 last-child 409 기대는 새로운 정책으로 대체하고 실제 유지되는 거부 조건에서 이전 성공 mutation 보존을 계속 검증한다. 과거 검증 기록의 당시 PASS는 지우지 않는다.

Migration은 이전 파일/checksum을 바꾸지 않고 0018을 추가한다. tasks 재작성 시 원본 ID·전체 컬럼·FK 참조·index를 보존하고 commit 전 foreign_key_check·실패 rollback·FK 설정 복원을 검사한다. SQLite의 FK 설정은 transaction 안에서 변경되지 않으므로 runner에서 재작성 migration에만 명시적인 범위를 둔다.

CI의 `name: CI`와 required check 식별자·권한·trigger·gate는 유지하고 `run-name`에 PR 제목을 포함한다. PR 제목을 `feat: 빈 Summary WBS 컨테이너 지원 (Issue #345)`로 하여 실제 Actions 실행 제목에 Issue 번호를 표시한다. 기존 참조를 바꾸지 않고 표시를 검사한다.

Required docs는 위 역할별 목록과 REQUIREMENTS/실행 계획/CHANGELOG다. 실제 영향이 있는 Resource·물류·Export·템플릿/VBA 문서도 해당 소유자가 동기화한다. SECURITY는 인증/권한 정책 변경 없음, DESIGN은 시각 언어 변경 없음으로 N/A이며 구현이 계약을 바꾸면 다시 판단한다. 실제 Windows Excel/DRM·운영 배포는 별도 환경 검증이다.

공식 참조: [SVAR tasks](https://docs.svar.dev/react/gantt/api/properties/tasks/), [SVAR unscheduledTasks](https://docs.svar.dev/react/gantt/api/properties/unscheduledtasks/), [SQLite Foreign Keys](https://www.sqlite.org/foreignkeys.html), [GitHub run-name](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#run-name). 문서 조회와 실제 Core/DB/Actions 실행 증거를 구분한다.

## Core 실험과 Manager 표시 결정

설치 Core 2.7.3에 날짜 없는 native summary를 전달하면 `Summary tasks must have start and end dates if they have no subtasks` 오류로 Grid가 사라졌다(FAIL). 날짜 없는 custom type은 Grid 행은 유지했으나 NaN 좌표의 bar wrapper를 생성했다(FAIL). 이 최초 실패를 숨기지 않는다.

Manager는 공식 custom task type을 사용하는 renderer 전용 zero-extent adapter를 승인했다. 일정 미산정 canonical Summary만 UI에서 별도 container type으로 표현하고 start=end 좌표를 표시 timeline 범위 안에 둔다. 해당 값은 실제 Summary 일정이 아니며 canonical/DB/API/Import/Export·Project 기간·필터·Grid/Editor/Tooltip·완료 상태·mutation payload에 사용하지 않는다. 실제 일정 있는 Leaf로 범위를 정하고 모두 미산정일 때만 표시 기본 범위를 사용한다. PRO 옵션·private `$skip` 설정·CSS DOM 은폐를 사용하지 않는다. reverse mapping/명령은 canonical DTO의 Summary 검증을 유지한다.

위 adapter의 실제 Chromium 최소 probe 1/1 PASS(5.9초): Grid 행 유지, Core bar wrapper 0개, ErrorBoundary 없음. first/last child·중첩 생성·접기/펼치기·last-child Outdent·같은 행 높이·동일 API 인스턴스/scale·canonical null/reload 영속성의 본 Chromium 검증도 아래와 같이 수행했다. Domain 10 files / 230 tests PASS 및 관련 lint PASS, backend 초기 7 files / 65 tests PASS, 통합 typecheck PASS는 실행 당시 근거이며 최종 변경 뒤 다시 필요한 범위를 확인한다.


## DOCUMENTATION_SYNC 및 독립 QA handoff (2026-10-01)

DOCUMENTATION_SYNC PASS: API/DB/Architecture/Import 계약·Deployment·Excel/Image/Import Export·Resource workload·물류·Scheduling·Project UX/Task Editor/UI_UX/PRO matrix/TEST_PLAN·VBA·CI 운영·REQUIREMENTS·활성 계획·CHANGELOG를 소유권에 따라 갱신했다. SECURITY는 권한/Origin/session 정책 변경 없음, DESIGN은 기존 Light semantic token 시각 언어 유지로 N/A다. 신규 Import UI/API는 사용자 결정에 따라 #30 후속으로 분리했고 순수 1.0 검증기와 VBA null/escaping 샘플의 경계를 명시했다.

Local Fast Feedback:

- Domain scheduling: 10 files / 230 tests PASS.
- Backend 관련: 33 files / 202 tests PASS. 최신 migration/Import 2 files / 34 tests PASS. 실제 file SQLite upgrade/reopen, Link/Assignment/물류 연결/Baseline 보존, 부분 NULL·NULL Leaf 거부, SQL/FK failure rows/schema/ledger rollback 및 FK 복원 검증.
- Frontend 관련 Unit: 5 files / 80 tests PASS.
- Chromium: Core fixture 2 tests PASS; Task Editor 포함 후속 21 tests PASS; #344 recovery 6 + subtree 1 PASS. 최종 실제 persistence 강화 1 test PASS(9.4초, 전체 실행 28.1초). keyboard Enter로 Summary 생성, 즉시 긴 한국어 이름 편집, 390/768/1024/1440px overflow, first/last-child 2회, scale/동일 API instance, 중첩 생성·접기/펼치기·행 높이·Outdent/reload를 확인했다. 겹치는 테스트 실행 횟수를 합산해 고유 테스트 수로 과대 표시하지 않는다.
- 캡처: `output/playwright/issue345-empty-{390,768,1024,1440}.png`, `output/playwright/issue345-nested-1440.png`.
- 최초 Core native/custom FAIL 외에 잘못된 password/readonly fixture assertion FAIL은 fixture 수정으로 구분한다. 빈 프로젝트 직후 이름 편집의 stale column closure는 실제 제품 FAIL이며 최신 ref를 쓰도록 수정 후 최종 브라우저에서 PASS다. 원래 실패를 숨기지 않는다.
- Browser 생성 next-env/tsconfig 변경은 기준 설정으로 복원 후 독립 QA에서 통합 typecheck를 확인한다. E2E 생성 경로 삭제 경합의 TS6053은 실행 환경 오류였으며 통합 PASS로 대체해 주장하지 않는다.

후속 담당: qa_docs가 실제 diff/AC/code/tests/docs를 읽고 독립 사전 QA를 수행한다. 모든 required 원격 CI, main/GHCR, 실제 Windows Excel/VBA/DRM은 NOT TESTED이며 이번 PR·CI 시작 범위에서 완료/ACCEPT·병합·릴리스·Issue 종료로 확대하지 않는다.


독립 UX 최종 비교에서 미산정 Summary의 Editor `scheduleDirty`가 `null`과 빈 입력 문자열을 다르게 비교해 저장 전 경고를 잘못 표시하는 REWORK를 발견했다. frontend가 null 비교 정합화와 빈 Editor 경고 부재의 focused browser assertion을 추가한다. 구현·문서 변경 뒤 DOCUMENTATION_SYNC를 다시 확인한 후 독립 qa_docs를 시작한다. 기존 로컬 증거는 각 실행 범위에 한하며 최종 원격 gate는 계속 NOT TESTED다.


### REWORK 후 최종 사전 QA 대상

frontend 최종 쓰기·browser 실행 종료를 확인했다. scheduleDirty의 canonical null/빈 입력 비교를 정합화했고 Editor 기간/진척 `—`, false warning 부재, Escape 닫기를 실제 persistence 검사에 포함했다. 추가 컬럼 dependency 정리에서 last-child Outdent 후 Core bar가 남는 실제 회귀(FAIL)를 발견하여 canonical map 변경 시 공개 컬럼 동기화 계약을 유지하도록 수정했다. 최신 canonical 날짜/기간 getter와 live editor 자격 ref를 구분하고 source comment로 갱신 의도를 기록했다. 마지막 focused persistence 1 test PASS(7.2초, 실행 19.4초), 관련 Unit 5 files/80 tests PASS, scoped ESLint 0 errors/기존 hook warning 1개다. 앞서 9.4초 결과는 이전 실행 근거이고 이 최종 REWORK의 PASS를 대신하지 않는다.

문서 동기화를 다시 PASS로 확인하고 독립 qa_docs 검토를 요청한다. 생성 Next 설정은 두 파일만 기준 HEAD로 복원하며 기존 캐시/과거 캡처와 scripts/__pycache__는 stage에서 제외한다.


## 독립 사전 QA 및 PR 전달 gate

`/root/qa_345`의 읽기 전용 독립 사전 QA PASS를 확인했다. 검토 대상은 위 기준 HEAD의 이번 미커밋 diff이며 DOCUMENTATION_SYNC·보안·migration·도메인·nullable 생산/소비·UI adapter·실제 browser 소스/기록·5개 캡처를 대조했다. 독립 실행은 핵심 8 files/129 tests + 추가 6 files/60 tests PASS, 통합 typecheck/version check/lifecycle policy/93개 Markdown 링크/diff check PASS, scoped ESLint 0 errors 및 기존 hook warning 2개다. UI/UX Agent도 실제 캡처·테스트 assertion 및 최종 7.2초 persistence 증거를 비교하여 PASS했다. 두 Reviewer는 브라우저를 재실행하지 않았고 구현 Agent의 실제 실행과 독립 비교를 구분한다.

AC12의 별도 서버 프로세스 restart, AC13의 빈 Summary PNG 다운로드, 실제 Windows Excel/VBA/DRM, 보조기술 수동 UX와 원격 quality/e2e/docker는 NOT TESTED다. file SQLite reopen과 SVG→PNG 공통 생산 경로의 정적 정합성만으로 해당 별도 실행 PASS를 주장하지 않는다. 최종 ACCEPT·병합·main artifact·릴리스·cleanup·Issue 종료는 승인하지 않는다.

Manager는 검토된 파일과 이번 캡처 5장만 명시적으로 commit한 뒤 exact commit을 독립 QA 증거에 연결하고 PR·CI 시작으로 전달한다. PR 제목은 승인된 Issue #345 포함 제목을 유지한다. 실제 PR/head/run/표시 제목과 시작 상태는 Issue STATUS와 PR에서 후속 기록하고 CI 완료를 모니터링하지 않는다.
