# Issue #725 — Target 없는 공정·WorkArea 관리와 직접 문맥

## Work Packet

- Primary Issue: [#725](https://github.com/planner77/masterGantt/issues/725), 상위 [#723](https://github.com/planner77/masterGantt/issues/723).
- lifecycle_phase: PR_READY. 최종 로컬 검증·문서·사전 검토 후 PR CI 시작으로 인계한다.
- baseline: main `7393483c4a15007868fceeaee70fb9e13c8b119a`, application `0.116.1`.
- dependency: #724 [PR #738](https://github.com/planner77/masterGantt/pull/738)의 최신 탐색 shell `23857b6f`로 착수했다. 작업 중 main `ea4194763568432ef98e823bb796b59a5beb317c`에 병합되어 동일 Git Tree를 확인하고 fast-forward로 정렬했다. 제품 bytes 변화0이며 #725 PR은 main을 대상으로 한다.
- working_branch: `feat/issue-725-process-workareas`, 격리 worktree `/home/planner/Dev/masterGantt-issue-725`.
- version_decision: MINOR `0.118.0` (#724 후보 `0.117.0` 다음 하위 호환 기능 확장).
- release_required: true.
- release_authorized: false. 구현·문서 갱신·Local Fast Feedback·PR Full CI 시작까지만 요청받았다. CI 모니터링·병합·main/GHCR·tag·Release·브랜치 정리·Issue 종료는 범위 밖이다.
- risk_level: HIGH.
- risk_reason: DB migration, 다중 참조 영속성·Copy/Template, 글로벌 관리자/Project 편집 권한, canonical 응답과 여러 관리 화면의 상태에 영향.
- qa_required: true.
- qa_method: OWNER_MANAGED.
- independent_qa: N/A(Owner-managed; 사전 Agent 검토와 인간 QA·Owner 승인은 구별).
- manager_decision: NOT TESTED.
- quality/e2e/docker/trusted_qa: NOT TESTED.
- issue_comment_writer: manager.

## 요구사항과 범위

[#725 최종 결정](https://github.com/planner77/masterGantt/issues/725#issuecomment-6245426595), [#723 최종 선택](https://github.com/planner77/masterGantt/issues/723#issuecomment-6245422717), [#728 입력 기준](https://github.com/planner77/masterGantt/issues/728#issuecomment-6245431055)을 이전 OPEN_DECISION보다 우선한다. W1/W2는 확정됐으며 다시 미정으로 분류하지 않는다.

- 공정은 WorkArea0..N개를 가지며 WorkArea의 실제 소유 occurrence는 정확히 하나다. 같은 이름을 ID로 합치거나 기본 구역을 만들지 않는다.
- 설비는 같은 Project 안에서 서로 다른 공정의 WorkArea0..N개에 연결할 수 있다. 주 관리 `processId`와 다중 구역 관계는 독립이며 원본 설비·quantity를 복제하거나 분할하지 않는다.
- Task 공정은 명시적0..N 선택이다. 신규 관계 미도입 `null`과 명시적 `[]`를 구별하며 Equipment/System/WorkArea/조상/Target을 이유로 명시0을 채우지 않는다. 구형 관계는 보존한다.
- Target 없는 독립 공정·WorkArea 관리와 공정 매핑, 설비 다중 구역 편집, Task/Summary 직접 문맥 API 및 canonical 조회, Copy/지원 Template 보존을 구현한다.
- Task Editor의 새 공정 picker는 #726, 공통 해석기·새 집계/API는 #728/#729, 동적 트리는 #730, 전체 교환 기능은 #379가 소유한다. 기존 System 복수 공정/프로젝트 공통 API를 재사용한다.

## 실제 담당과 파일 소유권

| 담당 | 소유 |
| --- | --- |
| Main/Manager | 통합·계획·버전·DESIGN/TEST_PLAN/PLAN/CHANGELOG·Issue 기록·게시 |
| context_backend (backend) | migration0028, 관계 DTO·Repository/Service/HTTP·canonical snapshot 및 SQLite/HTTP tests |
| process_ui (frontend) | 독립 공정 관리 component/CSS와 Project host의 master.processes 연결 |
| equipment_ui (frontend) | 기존 설비 관리 dialog의 다중 WorkArea 선택·상태·원자 저장 |
| copy_template (backend) | Project Copy·Template v4·지원 교환 no-loss와 관련 tests |
| ux_review (ui_ux) | 읽기 전용 interaction 설계·구현 비교 |
| acceptance_tests (worker) | 신규 실제 HTTP/SQLite·Chromium 수용 spec |
| contract_docs (worker) | DB/API·도메인·화면·Copy/Template·교환·사용자 가이드 계약 문서 |

같은 파일의 동시 쓰기를 금지한다. Agent는 commit/push/Issue 댓글을 독자 수행하지 않는다. 실제 실행 지원을 확인한 역할만 기록하며 설정상의 model을 실제 검증된 model로 과대 표시하지 않는다.

## 계약 freeze와 후속 인계

- `equipment_work_areas`: Project/Equipment/Project Process/occurrence/WorkArea typed 관계, 같은 설비·구역 중복 금지. `workAreaLinks:[{processId,workAreaId}]`와 `processCatalogRevision`으로 원자적으로 저장한다. 생략은 보존, `[]`는 전체 연결 해제다.
- canonical `logistics.equipmentWorkAreas`는 `{equipmentId,processId,occurrenceId,workAreaId}`를 제공한다. 빈 배열은 실제0이며 실패/부분 읽기를 빈 성공으로 치환하지 않는다.
- `task_process_contexts` marker와 `task_process_links`/`task_work_area_links`: legacy-null과 explicit-empty 및 `self|subtree` 출처를 보존한다. 직접 WorkArea는 선택 공정·실제 owner와 일치해야 하며 공정을 자동 추가하지 않는다.
- `GET/PUT /api/projects/:publicId/tasks/:taskId/process-context`: 명시 공정/구역 직접 문맥을 제공한다. global catalog revision과 Project revision은 별개다.
- #728/#729는 새 공정 입력을 Equipment/System 구성 관계 또는 구 Target API 공정 분류와 혼합하지 않는다. 기존 Resource/Target KPI 산식과 full Milestone Gate는 변경하지 않는다.

## 변경 영향과 Local Fast Feedback 선정

| Producer / 변경 | 직접 소비자·검증 | 인접·음성 소비자 |
| --- | --- | --- |
| migration·관계 repository | SQLite 실제 FK/중복/Project 격리/업그레이드/재시작 | 삭제·mapping·분류·type 변경 보호, 전체 transaction rollback |
| 설비·Task 직접 context API | HTTP session/Origin/If-Match·catalog stale·0/1/N·canonical 재조회 | System 범위 수정으로 Task 공정 변화0, 기존 Target subset/usage 보호 |
| Copy·Template v4 | typed relation remap·명시0/legacy-null·global ID 보존 | malformed graph 원자 rollback, 일정 JSON/Excel silent-loss 차단 |
| 독립 관리·다중 picker | 실제 Chromium Target0·5폭·keyboard/focus·readonly/dirty/pending/error | 기존 공정 트리/legacy 편집·Target 호환 composer·Gantt 같은 instance |

공식 전체 회귀는 PR의 Required Quality/E2E/Docker가 수행한다. 전체 로컬 Vitest/Playwright/Docker 재실행은 기본 조건으로 삼지 않으며 직접/인접/음성 소비자를 선정한다. 최초 실패·중간 source와 최종 source를 분리하고 실패를 retry로 숨기지 않는다.

## Gantt 표준 적용

- gantt_standard_version: GSC `1.0.0-candidate` / REVIEW_PENDING.
- 읽은 기준 commit: main `7393483c4a15007868fceeaee70fb9e13c8b119a`; GANTT_STATE_CONSISTENCY/CONFORMANCE/ADAPTER_ADR/SYNC_TRACE 및 #724 최신 host 계약.
- 적용: GSC-01/03/06/09/11/12, SC-01/05/11의 canonical·uncertain·같은 instance·관리 화면 왕복과 저장 권한 보호.
- state/write ownership: 기존 서버 snapshot/revision·공통 canonical gateway 유지. 신규 Gantt/viewport writer·강제 remount 없음.
- SC-02/03/06~10/12~14의 DnD/Calendar/축/대량·marker 기능 자체는 수정하지 않으며 공식 전체 CI에서 기존 회귀를 유지한다. 새 기능의5폭 검증은 해당 화면 범위 증거이며 전체 SC PASS가 아니다.
- exception_adr: N/A(기존 writer·규범 예외 없음).

## DOCUMENTATION_SYNC

required_docs와 실제 영향 분석은 다음과 같다. 변경된 코드·계약과 문서의 의미 정합성은 최종 사전 검토로 확인한다.

- `DESIGN.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/DB_SCHEMA.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/TASK_EDITOR.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/ISSUE_27_PROJECT_COPY.md`: UPDATED
- `docs/IMPORT_EXPORT.md`: UPDATED
- `docs/IMPORT_SCHEMA.md`: UPDATED
- `docs/JSON_IMPORT.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Task 복사 경로에 관계 보존을 추가하며 일정 계산 알고리즘은 변경하지 않음)
- `docs/EXCEL_EXPORT.md`: N/A(일정 형식의 신규 관계 누락 차단은 IMPORT_EXPORT와 API에 기록하며 기존 보고서 시트와 산식은 변경하지 않음)

- documentation_owner: Main/Manager + contract_docs.
- #720 영향: 현재 baseline에는 `/manual` 제품 route/registry가 없다. `master.processes`/`master.equipment`의 절차·권한·오류 복구와 기능 anchor를 사용자 가이드에 갱신하고 #720에 인계한다. 구현하지 않은 매뉴얼 제품을 완료로 선언하지 않는다.
- `AGENTS.md`/`docs/ISSUE_LIFECYCLE.md`/`docs/QA_REVIEW_POLICY.md`: N/A(현행 역할·위험·Gate·문서 동기화 정책 재사용).
- `docs/CI_CD.md`/`docs/REMOTE_VALIDATION.md`/`docs/GITHUB_OPERATIONS.md`: N/A(CI/Required/권한·GHCR·릴리스 운영 정책 변경 없음).
- `docs/SECURITY.md`: N/A(기존 관리자/Project 인증·Origin·strong CAS 정책 재사용; 새 endpoint 계약은 API 문서에 기록).
- `docs/SCHEDULING_ENGINE.md`/`docs/VBA_EXPORT.md`/`docs/DEPLOYMENT.md`: N/A(일정 알고리즘·VBA·Docker/배포 계약 변경 없음).

## AC_TEST_COVERAGE

- AC1: Target0 실제 HTTP/SQLite·Chromium 독립 관리; tests/e2e/issue-725-process-workareas.spec.ts.
- AC2: ProcessContextRepository 실제 owner/triple/foreign validation; tests/server/process-catalog/process-context-service.test.ts.
- AC3: Task null/[]/0..N direct canonical 조회와 구성변경불변; process-context-service 및 신규 E2E.
- AC4: 권한/Origin/If-Match/412·사용중/중복/부분실패 rollback; process-context-service 및 edit-authorization-handlers.
- AC5: 신규/업그레이드/reopen·Copy/Template v4·교환거부; database/migration-cli/issue-623-target-migration 및 logistics-template-graph.
- AC6: Chromium5폭/keyboard/focus/empty/loading/error/readonly/dirty/pending/명시갱신; issue-725-process-workareas.spec.ts.
- AC7: 공정과 설비 WorkArea0/1/2 actual 저장·재조회; 신규 E2E와 SQLite service.
- AC8: E10 다중구역 원본1/quantity10 보존; 신규 E2E와 Copy/Template tests.
- AC9: 관계 추가/마지막해제/inactive/중복·foreign/stale·Copy/Template/restart 원자성; 신규 context-service 및 logistics-template-graph.

| AC | 검증 경로와 필수 기대 |
| --- | --- |
| AC1 | Target0 actual HTTP/SQLite·독립 관리 Chromium, Target 행 생성0 |
| AC2 | owner/triple FK·동명이명·System 기존 범위·cross-project/잘못된 owner 거부 |
| AC3 | Task direct null/[]/다중 canonical DTO와 자동유도0·원본ID 보존 |
| AC4 | 실제 HTTP 권한/Origin/CAS/stale/중복·사용중 보호·원자 rollback |
| AC5 | fresh/upgrade/file reopen·Project Copy·Template v4·미지원 교환409 |
| AC6 | Chromium390/768/1024/1440/1920·keyboard/focus·state matrix·명시 갱신 |
| AC7 | 공정/설비 WorkArea0/1/N(N≥2) 실제 생성/저장/재조회 |
| AC8 | Fleet E10 두 구역 연결 뒤 원본설비1/quantity10, 개별 구역 수량을 배치 수량으로 추정하지 않음 |
| AC9 | 추가/해제/마지막해제·inactive/foreign/중복/stale·Copy/Template/restart 보존·오류rollback |
| W1/W2 | 타공정WA 둘 동시연결, Task공정0/1/2 명시저장, System담당A/B의공통Task0, 구성변경으로Task선택불변 |

## 실행 원장과 잔여 경계

- 구현/Local Fast Feedback: PASS. 최종20파일215 Unit/SQLite/HTTP 및 Chromium 통합1case PASS. 문서·사전 검토와 인접2case 결과를 아래에 구분한다.
- GitHub CLI는 HTTP401이므로 연결 GitHub 도구로 요구사항·댓글을 조회했다. 공개 git read로 최신 main/선행 PR을 가져왔으며 credential을 추출·출력하지 않았다.
- 원격 Required/Trusted QA·Owner ACCEPT, main artifact·정식 릴리스·운영/off-host 복원·최종 수동 UX: NOT TESTED.
- 요청 종료점은 PR_CI_STARTED이며 CI 완료 모니터링을 수행하지 않는다.

### 로컬 검증과 사전 검토 중간 결과

- 통합 선정 회귀: 최종 backend freeze의18파일197테스트 PASS, `2026-10-18 16:56:04 KST` 시작/7.53초. process catalog/context·logistics·migration·route inventory·Project/Task Copy·Template·Import parser 및 기존 hierarchy를 포함한다. 전체 Vitest가 아니다.
- 실제 분리된 `context_review` 사전 검토 PASS: freeze26파일의 SHA-256 drift0, 관련6파일100테스트 독립 실행 PASS. W1 두 공정 구역의 같은 E10 Copy/Template·파일 재열기, null/[]·delayed-body·사용중/inactive·Milestone/type·문서 계약을 확인했다. 원격 QA/Owner 승인으로 분류하지 않는다.
- `ux_review` 정적 사전 검토에서 catalog stale 자동채택·동명 owner 식별·조건부 unmount 상태 유실을 발견해 보완했다. 이후 실제 브라우저 mapping 저장 후 focus 복원 실패를 별도 REWORK하며 앞선 정적 PASS를 해당 runtime PASS로 옮기지 않는다.
- Browser 최초 실패 원인 정정: `getByLabel("관리 범주", exact)`는 native select의 중첩 option 텍스트 때문에 맞지 않았고 실제 combobox는 존재했다. 진행 중 HMR도 관측했지만 근본 원인을 cold startup으로 단정하지 않는다. 기본 locator timeout10초·실제 combobox role로 교정했다. 성공 알림을 alert로 찾은 후속 oracle도 실제 status 의미로 교정했다.
- 포트3100은 별도 `/home/planner/Dev/issue-727` 작업 소유여서 종료하지 않았다. 로컬 한정 override config에서 shared mock server만3115와 별도 임시 DB로 이동하며 실제 격리 application의 dynamic port/SQLite/restart와 정식 설정·기존 assertions는 유지한다. 이전 개발 중 DB checksum 불일치는 자신이 생성한 임시 DB의 환경 이력으로 보존한다.
- 원본 실행별 spec/log/trace는 `/tmp/mastergantt-725-e2e-{first,second,third,fourth,fifth}`에 보존했다. 부분 실행·BLOCKED·실제 제품 focus 실패를 분리하며 최신 통과 후 원장을 추가한다.

### 실제 브라우저 REWORK 누적 — focus와 390px 정보 disclosure

- 다섯 번째 run의 mapping 저장 후 focus FAIL은 성공 응답의 최신 Project revision과 로컬 context key가 한동안 달라 호출 버튼이 disabled 되는 경계였다. 검증된 성공 응답의 revision/mappings를 부모 snapshot과 같은 batch로 채택해 보완했고 여섯 번째 run에서 원래 focus assertion이 통과했다. 새 focus 타이머·반복문·viewport writer는 없다.
- 여섯/일곱 번째 run은390px 문서669px로 FAIL했다. 신규 표의 실제 owner는 left12/right378/client366/scroll680으로 정상이며 표 내부 폭을 문서 overflow로 오인하지 않는다. 지역 grid/control 수축 강화만으로 원래 FAIL이 해결되지 않았음을 보존한다.
- 여덟 번째 run은 내부 scroll에 포함된 노드를 제외한 실측으로 닫힌 `details.project-info-popover`의 `.project-info-panel` left330/right688/width358 후보를 확인했다. 아홉 번째 run에서 이 panel의 display:none/rect0에도 문서669px가 남아 단일 원인 확정은 철회했다. 새 표 owner는 정상이며 숨은 일정/resize 수렴 여부를 추가 구분한다. 당시 닫힌 정보 panel에 `display:none`을 시험했으나 후속 인과 탐침으로 기각하고 최종 diff에서 제거했다.
- 아홉 번째 run은 같은5폭에서 정보 열기→panel geometry→Escape→summary focus→닫힌 panel display:none·document overflow와 원래 관리 기능을 함께 재검증한다. 이전6/7/8 FAIL과 원본JSON/trace를 `/tmp/mastergantt-725-e2e-*`에 보존한다.
- WorkArea 사용량은 이번 신규 equipment/Task 관계 외에 기존 Target의 직접 구역 참조도 집계한다. default mapping 구역null·Target만 구역 참조한 실제 SQLite에서 usage1/삭제409/catalog revision불변, Target 삭제 후 usage0/구역 삭제 성공·Fleet quantity10 보존을 확인했다. 관련45테스트 PASS; 단일 계약/API 변경은 없다.


### 390px 원인 정정 — 열한 번째 인과 탐침

아홉/열 번째 run은 닫힌 정보 panel의 display:none/rect0 및 두 animation frame 이후에도 문서669px를 재현했다. 열한 번째 run의 subtree 임시 숨김→원복 진단에서 신규공정 section을 숨기면390px, 관리자영역을 숨기면647px로 바뀌었다. 이 임시 style 진단은 실패 뒤에만 수행하며 제품 수정이나 PASS 증거가 아니다. 신규 표의 absolute `.srOnly` 이름이 static button/owner 밖의 containing block을 사용해 scroll clipping을 벗어나는 경계로 원인을 좁혔다. 표 owner에 position:relative를 부여하는 최소수정으로 검증한다.

정보 panel은 실제 원인이 아니므로 임시로 추가했던 globals.css 닫힘 규칙을 제거한다. 원래 native details의 닫힘/정보열기/Escape/focus 의미는 유지하며 display:none이라는 새 계약을 강제하지 않는다. 표/헤더/RAF 가설과 시행착오를 소급 PASS하거나 원장 삭제하지 않는다. 후속 통합 run에서 원래 document≤viewport+1 및5폭·15표 geometry·기능보존을 그대로 검증한다.

### 열두/열세 번째 실행과 후단 확인

열두 번째 run은 표 owner 위치 기준 수정 뒤 공정/카탈로그5폭·document≤viewport+1·정보 열기/Escape/focus를 통과했다. 이후 설비 dialog의 기존 설비 코드 autoFocus가 native showModal의 닫기 버튼 focus로 덮이는 실제 회귀를 확인했다. 해당 입력에 native autofocus 속성만 추가했으며 공통 Dialog/Task Editor 변경은 없다. 열세 번째 run에서는 설비5폭·15표 geometry와 해당 초기 focus를 통과했다.

열세 번째 run의 저장 후단은 기존 `공유 인스턴스 변경 확인`을 클릭하지 않아 원래 설비 dialog가 남는 테스트 절차 누락이었다. 최초 저장은 usage 조회이며 real PATCH가 아님을 실제 모달로 확인했다. 사용처 확인을 제거하지 않고 명시적으로 확인한 다음 PATCH pending·중복 제출·원자 저장을 검사하도록 테스트를 교정한다. 이후1개/마지막 연결 해제도 같은 기존 확인 단계를 따른다.

Target 기존 업그레이드 소비자 두 파일의 ledger 기대값27→28도 갱신했다. 초기2파일17사례 중16PASS/1FAIL은 재시작 후 max version27의 남은 기대값이었고, 수정 후 동일2파일17PASS를 확인했다. 구버전 전용0027 rollback fixture 자체는 역사적 범위를 유지한다. 최신 backend 통합18파일198테스트는17:09:20KST/5.66초 PASS다.


## 최종 로컬 결과와 PR 인계

- 최종 통합 선정 회귀:20파일215테스트 PASS,17:15:52KST 시작/4.17초. 기존18파일198과 추가 Target/migration2파일17을 함께 같은 명령으로 재실행했다. 전체 Vitest는 아니다.
- 실제 Chromium14회차 통합:1case PASS(41.6초/총57.2초). 실제 HTTP·SQLite의 Target0, 공정/WorkArea관리·명시갱신·매핑, 같은 E10의 타 공정 두 구역/quantity10·원본1,2→1→0 해제·프로세스 재시작, Task legacy-null→2→1→명시0과 readonly, loading/error/retry/dirty/pending·PATCH1, 같은 Gantt를 검증했다.
- 동일 source의390/768/1024/1440/1920px에서 공정4열/카탈로그6열/설비10열15개 populated 표의 header/body·겹침·내부 overflow, dialog/문서 경계와 native keyboard/focus를 확인했다. 정보 disclosure의 기존 열기/Escape/focus를 보존한다. 후속 장치/screen reader/최종 수동 UX의 PASS는 아니다.
- 실제 수정: mapping 성공응답 revision/context의 같은batch 채택, table scroll owner의 position:relative로 absolute 접근성 이름 결속, 설비 코드 native autofocus. 임시 전역CSS 변경·고정 timeout확대·retries·skip·기존 의미 단언 약화는 최종diff에 없다.
- `ux_review` 최종 정적 PASS, `context_review` 독립 사전 코드/계약 검토 PASS. 사전 Agent 검토를 인간 APPROVED·원격 Trusted QA·Owner 승인으로 전용하지 않는다.
- 기존 disclosure/관리탭2case PASS(14.1초). 최종 정적·문서 검사 결과는 아래 원장에 기록한다.
- 원격 PR Required Quality/E2E/Docker·Trusted QA/Owner ACCEPT: NOT TESTED. 이 요청의 완료 범위는 PR Full CI 시작이며 CI 결과 모니터링은 하지 않는다.
- main artifact/GHCR·정식 tag/Release·cleanup/Issue 종료: 요청 범위 밖이며 release_authorized=false.

### 최종 이미지 검토 보완

열네 번째 실제 통합1case 및 기존 disclosure/관리탭2case(14.1초)는 각각 PASS다. 대표390px PNG를 실제 열람한 결과 설비 dialog의 외곽/문서 경계는 맞지만 내부 grid가 긴 선택값/WorkArea 라벨의 intrinsic 최소폭으로 늘어나 오른쪽 내용이 잘렸다. 앞선 외곽 bbox/표 geometry PASS를 dialog 내부 containment PASS로 확대하지 않는다. 설비 폼 전용 class에서 grid minmax(0,1fr)·label/control 최소폭을 제한하고 실제 dialog.scrollWidth≤clientWidth를 모든5폭에 추가해 같은 기능 전체를 재검증한다. 기존 native 초기 focus·dirty·공유 사용처 확인·pending·원자 저장 및 Gantt 보호는 유지한다. 새로운 전역CSS 또는 스크롤 강제이동을 추가하지 않는다.


### 최종15회차 동결 검증과 증거

- 실제 Chromium 통합1case PASS:43.711초/총60.729초. 기존14회차를 재사용하지 않고 설비 폼 수정 후 같은 전체 HTTP/SQLite/재시작 계약을 다시 실행했다.
- 5폭 dialog 내부 `scrollWidth=clientWidth`:390px에서350/350,768/1024/1440/1920px에서606/606. 15개 populated 표와 document=viewport, 원래 keyboard/focus·dirty·공유 사용처 확인·pending·원자 저장·Gantt를 함께 확인했다.
- acceptance_tests와 별도 ux_review가 최종390/1440 PNG를 직접 열람해 긴 WorkArea 줄바꿈과 우측 잘림 해소를 확인했다. context_review의 backend·계약 사전검토 PASS도 유지한다. 최종 source 지문은 아래 증거 JSON에 새로 수록하며 과거26파일 freeze를 재사용하지 않는다.
- [로컬 검증 지문](../../evidence/issue-725/local-validation.json), [15표·5모달 실측](../../evidence/issue-725/geometry.json), [실제 상태 요약](../../evidence/issue-725/acceptance.json), [390px 설비](../../evidence/issue-725/issue-725-equipment-multi-390px.png), [1440px 공정](../../evidence/issue-725/issue-725-process-1440px.png). 실제 운영 DB/원본 trace/민감 로그는 Git에 저장하지 않는다.
- Pre-PR `targeted --dry-run`은 sourceStable=true지만 자동 선택10경로 UNKNOWN/Selection BLOCKED, 실제 테스트 실행은 NOT TESTED다. 이를 PASS로 바꾸거나 선택기/정책을 완화하지 않는다. contract3종·UI4종은 신규 실제 Chromium·context/Template SQLite 검증의 직접 DTO 소비자다. export guard/logistics parser/template graph는 각각 실제 public export409/HTTP 오류·원자 저장/Template4 restore를 통해 검증했다. 자동 direct-import 매핑 한계와 수동 producer→consumer 확인을 구분하며 본 Issue에서 범용 선택기 수정은 하지 않는다.
- 원격 Required3/Trusted QA·Owner ACCEPT는 NOT TESTED. 검증 완료 대기 없이 PR Full CI 시작 snapshot만 Issue STATUS로 인계한다.

최종 정적 검사: typecheck·version0.118.0·변경파일ESLint(오류0/기존gradeText경고1)·test discovery234 Unit files/698 browser tests(루트/외부cwd일치)·Markdown254파일·diff PASS. 문서/AC 구조는 STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING이며 사전 의미 검토와 원격QA/Owner 승인 경계는 유지한다. 최종 검사 중 존재하지 않는 verify-markdown-links 경로를 호출한 명령 오류1회가 있었고 실제 check-markdown-links로 교정해254파일PASS를 확인했다.


## PR #741 — 최신 main 재정렬 및 리뷰 P2 처리 (2026-10-18)

- 이전 Head `6bdae8ff10b475e4ba91dcf8815ee0f45e0407cf`, 확인된 최신 main `c2395b17d864692c2e5e5aa36f55ea36e7197541` (공통 조상 `ea4194763568432ef98e823bb796b59a5beb317c`). #724 Main 복구의 TEST_PLAN/PLAN 독립 변경, #724 누적 실패 원장/Work Packet, #456 실제 fixture/spec를 충돌 없이 보존한다. branch의 제품·문서·테스트 원본을 덮어쓰지 않는다.
- P2-1: 호환/default WorkArea의 비활성 상태가 `mapping.active=false`로 형제 후보 전체에 전파되는 오류. 별도의 `workAreaSelectionActive`는 default WorkArea 활성만 제외하고 Project 공정·occurrence·type/standard·사업부/제품/사업장의 활성 경로를 검증한다. picker는 이 속성과 각 WorkArea 자체 활성 상태를 결합한다.
- P2-2: 복수 Project 공정이 같은 occurrence를 매핑하면 동일 물리 WorkArea에 `processId:workAreaId` 중복 선택이 가능했다. 선택 시 해당 `workAreaId`의 이전 owner를 대체하여 서버의 유일성 계약과 동기화한다.
- 직접 검증 경로: native process-catalog-service SQLite 회귀와 isolated Chromium/E2E 실제 HTTP 저장 및 canonical 검증을 추가했다. 변경 이후 이 실행 환경은 로컬 저장소·node_modules·Chromium이 없고 외부 GitHub DNS가 차단되어 **로컬 새 테스트 NOT TESTED**. 이전 215개/Chromium PASS를 새 Head PASS로 소급하지 않는다. 신규 PR Full Required3·Trusted QA/Owner ACCEPT도 Run 결과 확인 전 NOT TESTED.
- Owner의 요청 범위는 최신 main 정렬·두 리뷰 수정/해결·새 PR CI 시작이며 **완료 모니터링·병합·Main/GHCR·정식 릴리스·Issue 종료는 제외**한다. `release_required=true`, `release_authorized=false`는 유지한다.
