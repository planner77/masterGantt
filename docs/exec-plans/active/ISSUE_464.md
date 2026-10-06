# Issue #464 소속 보존과 Import/Export 통합 실행 계획

## 요청과 기준

최신 사용자 요청에 따라 [Issue #464](https://github.com/planner77/masterGantt/issues/464)의 구현·문서 갱신·독립 사전 검토·원격 게시·PR CI 등록까지 수행한다. Issue 본문의 과거 등록만 요청은 대체되었다. CI 완료 모니터링·병합·main/GHCR·정식 릴리스·브랜치 삭제·Issue 종료는 범위 밖이다. 선행 #460–#463의 공식 원격 회귀·최종 QA는 NOT TESTED다.

- repository/Issue: planner77/masterGantt / #464, Epic #459.
- baseline: #463 원격 head `ca15145b1167b7253841e648d23e59d1a172022a`; main `a9107ab2776829cbb0467a762ab8bf9ce1ce82c4`를 branch 생성 직전 재확인했으며 baseline에 포함돼 있다.
- branch: `feat/issue-464-stage-preservation`; 기존 branch/PR 중복은 fresh 조회에서 없었다.
- 버전 결정: JSON 1.1·Import 저장·소속 보존·Excel 단계 요약 기능의 MINOR `0.89.0`. package/lock은 infra 단독 반영, CHANGELOG는 Manager 작성.
- release_required=true, release_authorized=false. 제품 정식 릴리스는 필요하지만 이번 요청의 실행 범위는 PR CI 등록까지이며 게시 승인은 없다.
- 현재 phase: 최종 문서 동기화와 독립 사전 QA 후 원격 게시 준비. #463 PR #472와 exact head CI run 37382878627 등록을 확인했다. #464 branch/package/lock 0.89.0과 최신 main 운영 변경을 준비했으며, 실제 Copy/Paste 오류 보강 후 관련4개·원본 실제통합2개·기존 Stage Gate1개가 PASS다. 원격 게시·PR CI 등록은 아직 수행하지 않았다.

## 범위와 소유권

backend preservation은 Project Copy·Template·subtree Copy·Cut 경계 및 완료 잠금·원자성, 공유 순수 Copy 영향 계획, projects/project-templates 계약과 관련 테스트를 담당한다. 문서 DB_SCHEMA/MILESTONE_STAGE_GATES/ISSUE_27_PROJECT_COPY/TASK_RELATIONS를 단독 갱신한다. API·TEST_PLAN 영향은 exchange 작성자에게 반환한다.

backend exchange는 JSON 1.0 호환·1.1 validator/schema/examples, bounded UTF-8 parsing, protected preview/commit, JSON Export, Excel Membership 열/단계 요약, 신규 route/security inventory와 관련 테스트를 담당한다. IMPORT_SCHEMA/IMPORT_EXPORT/JSON_IMPORT/API/ARCHITECTURE/SECURITY/REQUIREMENTS/TEST_PLAN을 단독 갱신한다. Excel source/tests/EXCEL_EXPORT는 아래 전담 backend로 이관한다. projects.ts 및 보존 service를 수정하지 않는다.

frontend는 기존 Import/Export UI, workspace 공통 Copy 영향 확인, 관련 UI 모델·E2E·화면/geometry를 담당한다. PROJECT_UX/TASK_EDITOR/UI_UX_GUIDELINES/IMAGE_EXPORT를 단독 갱신하고 TEST_PLAN에는 증거만 반환한다. 기존 Gantt/canonical snapshot·draft·pending·readonly·revision 계약을 유지한다.

Manager는 이 계획/PLAN/CHANGELOG와 interface/version/gate를 소유한다. infra는 branch/package/lock/원격 게시/PR/CI 등록을 담당한다. excel_vba·scheduler·ui_ux·qa_docs는 읽기 전용 검토 역할이다. 실제 동시 한도는 Manager 포함 6이며 독립 작업만 병렬 수행한다. 동일 파일 동시 쓰기·타인 변경 되돌림·재귀 위임·구현 Agent의 Git/version/PR/tag/게시/Issue 종료는 금지한다.

issue_comment_writer=manager, issue_comment_allowed_types=PLAN,STATUS,EXCEPTION,RESUME. Sub-Agent는 직접 댓글을 쓰지 않고 후보를 반환한다.

## 고정하는 보존 원칙

JSON은 기존 strict 1.0을 유지하고 별도 1.1 authoritative 명시 memberships `taskExternalId`/`milestoneExternalId`를 정의한다. Task identity는 새 UUID로 생성하고 모든 parent/Link/Membership을 batch externalId로 resolve한다. sourceTaskId·source Project/revision/exportedAt/calendar는 참고 metadata이며 target 설정을 변경하지 않는다. 파생 effective/Ready/KPI는 authoritative 입력으로 받지 않는다. Resource/Logistics 교환·CSV parser/VBA 변경·DRM 우회는 범위 밖이다.

기존 Project에 create-only append하며 기존 소속을 omission으로 지우지 않는다. 모든 참조·graph·일정·완료 조건·DB collision을 검증한 뒤 session/Origin/If-Match를 transaction 안에서 재확인하고 전체 원자 저장·revision 1회 증가를 보장한다. legacy mixed 외부 JSON은 설명과 함께 전체 거부하고 Link만 삭제하지 않는다. source export는 원래 Link를 보존한다. requestedStart와 dependency 이동 후 effective end를 혼동하지 않는다.

preview는 DB 저장 없이 baseRevision/fileDigest와 counts·소속 projection·warning을 제공한다. commit은 같은 파일/digest/preview revision을 요구하고 이를 권한 근거로 사용하지 않는다. UTF-8 fatal decode·선두 BOM 1개·중복 JSON key·depth64·5MiB·Task5000·Link20000 상한을 검증한다. 빈 Project export를 표현하고 빈 append commit은 설명과 함께 거부한다. 전체 응답은 기존 canonical ProjectSnapshotResponse를 재사용한다.

전체 Copy는 모든 명시 source/target을 새 Task ID로 remap하고 상속을 explicit으로 평탄화하지 않는다. 서버 소유 legacy 완료 기록과 외부 신규 완료 입력은 분리한다. Template은 독립 snapshot의 optional memberships를 보존하며 기존 progress0/not_started 정책을 따른다. source·권한·Calendar·assignment·물류·비밀번호·rollback 계약을 유지한다.

subtree Copy는 정규화 root와 자손 집합 C를 사용한다. 둘 다 C 내부이면 새 FK로 remap한다. 외부 target의 명시 연결 제외와 외부 Summary 상속 변경은 복사 전 정확한 대상/수/새 유효 소속으로 확인받는다. destination의 상속을 반영하고 미확인 값을 미지정으로 추정하지 않는다. 기존 target과 복제 예정 target identity를 구분한다. UI와 서버가 같은 공유 순수 계획을 계산하고 동일 revision의 ack를 요구한다. 완료 단계·Assignment 제한은 ack로 우회하지 않는다. 외부 구성원 제외로 완료 의미가 바뀌는 Completed M 복사는 안전 거부한다. Cut는 identity와 명시 연결을 유지하고 기존 old/new effective 잠금을 적용한다.

Excel Task 시트는 explicit/effective/상속 출처를 구분하고 Dependencies 선택과 독립적으로 소속을 출력한다. 단계 요약은 #463의 동일 typed DTO 계산값과 project/catalog revision을 검증하여 사용한다. full E/P와 scoped F·기준일·범위·환산 값/출처·null·미설정 건수·assignment dedup을 명시한다. SVG/PNG는 현재 선택 Grid 열/label 정합성만 검토하고 새 Dashboard image exporter를 만들지 않는다.

## 검증과 다음 단계

관련 Unit/Integration/HTTP와 실제 SQLite browser 최소 fixture를 수행한다. fixture는 3개 이상 M·병렬→합류·Task DAG·명시/중첩 상속/override·빈 Summary·수동/완료·미지정·개인/그룹 Resource·물류·동일 이름/다른 ID와 별도 legacy mixed 사례를 포함한다. JSON round-trip/forward/null/duplicate/dangling/foreign/mixed/401/412/rollback, Copy/Template remap/reset/source 불변, subtree 경계/ack/잠금/Cut, Excel/ID/revision/Grand Total/Ready를 검증한다. migration/readiness/native SQLite restart·persistence의 관련 증거를 연결한다.

화면은 390/768/1024/1440/1920px에서 표 header/body·모든 표시 control 경계·큰 값/긴 이름·자체 scroll·문서 overflow·focus/keyboard/dialog 복원을 측정한다. 실제 UI evidence와 mock를 구분한다. Windows Excel/VBA/DRM·실기기·스크린리더·운영 환경은 실제 실행이 없으면 NOT TESTED다.

구현 → 관련 Local Fast Feedback → required docs 동기화/N/A 근거 → 독립 ui_ux 비교와 qa_docs 사전 QA → Manager PR_READY → exact allowlist 원격 게시 → 새 head/tree/parents/files 독립 동등성 확인 → Refs #464 PR → exact head pull_request/ci.yml 등록만 확인하고 종료한다. 공식 quality/e2e/docker·최종 QA는 NOT TESTED로 남긴다.

## 현재 원격 상태 주의

착수 fresh 조회에서 PR #470 head가 외부 작업으로 `97c0308f002015cceddb513d7e5d9c8d35e611ab`로 변경됐으나 #471/#472 head는 유지됐다. #461 당시 요청 경계의 증거는 기존055f3fb23f94d6d42261927de8e452e237641529에 유효하다. infra가 새 추가 diff를 읽기 확인하며 임의로 CI 결과를 모니터링하거나 선행 PR을 다시 게시하지 않는다. #464 baseline은 검증한 #463 head다.

## 승인한 공유 interface

`src/domain/milestones/membership-copy-plan.ts`는 preservation 단독 소유의 browser-safe 순수 helper다. `previewMembershipCopy(tasks, links, copyCommand)`는 정규화 root/C·내부 보존/외부 제외 명시 row·전후 유효 소속/상속 출처·requiresAcknowledgement를 반환한다. 참조는 existingMilestoneTaskId와 copiedFromMilestoneTaskId, existingSummaryTaskId와 copiedFromSummaryTaskId를 구분한다. canonical projection 누락·invalid hierarchy는 fail-closed다. copy-only optional boolean `acknowledgedMembershipExclusions`는 명시 제외뿐 아니라 외부 상속/새 destination 소속 변경 확인을 의미하며 파서 normalize에서 보존한다. revision/roots/destination이 바뀌면 UI 확인을 무효화한다. 신규 source DTO/오류와 API 설명은 preservation→exchange handoff한다.

Completed M가 C 안이면 full E·모든 명시 참조 source·incident Dependency의 양 endpoint가 C 내부여야 한다. 후보 E/P를 원본으로 역매핑해 동등성을 확인하고 손실은 COMPLETED_MILESTONE_COPY_BOUNDARY_LOCKED로 거부한다. 완전 보존된 서버 소유 완료 기록만 trusted comparison baseline을 사용할 수 있으며 외부 JSON은 사용하지 않는다. 실제 before/after 구조 잠금은 별도로 항상 적용한다.

Import preview 신규 `src/contracts/project-import.ts`는 schemaVersion/projectPublicId/baseRevision/previewDigest/summary/normalizedTasks/changedTasks/warnings/targetCalendar를 제공한다. previewDigest는 파일 원본 byte+target publicId+baseRevision을 결속한다. commit은 multipart 동일file·X-Import-Preview-Digest·strong If-Match를 검증하고 201 ProjectSnapshotResponse를 반환한다. JSON export는 POST /api/projects/{publicId}/exports/json, 기존 readonly Export의 Origin/If-Match 계약, 전체 JSON1.1이다. 기존 imports URLs는 유지한다. Excel 새 Dashboard query body는 추가하지 않고 서버 기본 full-project F/기준일/horizon14 typed DTO를 사용하며 현재 Dashboard 화면 조건과 차이를 명시한다. 새 Project hyperlink 구현은 이번 범위에서 제외한다.

외부 PR470 리뷰 수정3source·E2E2를 정확히 반영한다. main 테스트3은 이미 baseline에 있다. application version/CHANGELOG/TEST_PLAN 전체를 외부 branch 값으로 덮어쓰지 않으며 관련 검증·문서는 지정 작성자가 동기화한다.

## 실제 구현 배정과 추가 검토

보존 source 단독 경로는 project-copy-service-core/task-hierarchy-service-core/task-hierarchy-contract/project-template-service-core, contracts/projects·project-templates, 신규 domain/milestones/membership-copy-plan이며 기존 contract 테스트 실제 경로는 tests/server/projects/task-hierarchy-contract.test.ts다. 교환 담당은 신규 import contracts/service/handler/parse·JSON export·Excel builder/handler/route·security inventory와 machine-readable schema/examples를 작성한다. 외부 리뷰 tests/e2e/milestone-stage-gates.spec.ts의 초기 보존409 기대도 교환 담당 단독으로 새 성공 계약에 맞게 검증한다. frontend는 외부 reviews의 tests/e2e/project-task-editor.spec.ts 신규2개 회귀를 담당한다.

ui_ux의 확정 interface 비교는 새 blocker0건이며 실제 구현/화면 PASS가 아니다. JSON legacy mixed 사전 안내는 export가 사용하는 최신GET snapshot/revision에 결속한다. Copy 제외 명시 row 수와 영향 작업 수는 별도로 표시하고 Import preview identity 변경 시 동의를 무효화한다.

외부 review5파일 적용은 정/역 git apply check PASS다. Editor는 기존 #462 initialTab·완료Link 잠금을 보존하는 원본hunk 적용이며 나머지4개는 리뷰 head 원본과 byte동일하다. 문서/버전 전체를 덮어쓰지 않았고 다른tracked824개·raw27개 hash불변이다. 관련 제품LFF는 구현 freeze후 수행한다.

추가 소유권: 보존 담당은 tests/server/projects/milestone-stage-service.test.ts의 초기Copy/Template 차단 기대를 실제 보존·잠금 검사로 갱신한다. frontend는 tests/fixtures/stateful-project.ts에 기존 공유 helper로 canonical membership/stageGate projection을 보충하며 누락 client fallback을 추가하지 않는다. 해당 fixture의 원래 권한·mutation·revision 동작은 유지한다.

JSON Export의 빈 Project는 tasks[]/memberships[]로 표현한다. JSON1.0 min1 계약은 유지하고1.1은 빈 export/preview0을 지원한다. 빈 append commit은 명시 오류로 거부하여 저장/revision증가0을 보장한다. JSON export request는 strict {scope:project}다. JSON1.1의 description/URL/leaf baseline을 검증해 지원하며 source baseline start+duration과 target Calendar의 파생 end 차이는 preview/문서에 명시한다. 1.0 status omission은 기존 taskStatusFromProgress/normalization,1.1 명시status는 기존 consistency helper를 사용한다. 외부 신규 Completed M에는 공통 완료 guard를 적용한다.

JSON1.1 최종 shape는 별도 strict machine schema이며 Leaf requestedStart/status/progress/duration 및 optional baseline:{start,duration}|null, Summary scheduleMode:auto/requestedStart:null·predecessors[]·나머지 일정/status/baseline 파생이다. memberships positive 또는 null target은 신규 명시 row/상속 복귀 의미이며 중복 source는 null도 포함해 거부한다. source contentScope:schedule-stage와 projectPublicId/projectRevision/exportedAt/calendar는 참고 metadata다. 1.0 pure validator의 기존 수용 범위는 유지하고 실제 HTTP 신규mixed/완료 저장 guard를 별도로 적용한다. Raw UTF-8 JSON과 정확 file1개 multipart를 같은 원본digest로 지원한다. Excel은 신규 같은SQLite read snapshot service와clock1회로 canonical Project/#463 DTO/optionalResource workload를 조회하여 revision 정합성을 확인한다.

## 구현 중 빠른 검증

보존 관련 최초확장119개 중 unknown/foreignsource가404→새helper409로 바뀐1FAIL(chf179eb)을 확인했다. 서비스 source404 resolve를 helper보다 앞에 복구하고 기존assertion을 유지한 뒤11files151cases PASS(2.06s/chf0e814)를 확보했다. 공유pure20개·Copy20개·Template16개·parse19개 및 기존hierarchy/copy/logistics/template/Stage회귀를 포함한다. Template12개 중 revoked session1FAIL(chcc4b6c)은 실제 기존보안결함으로 ownedvalidSession에 revokedAt/publicId/project binding을 보강하고 만료/authVersion/다른Project/publicId4개 회귀를 추가했다. 최초typecheck의 ownedfixture타입5개와frontend진행중3개 오류는 분류했으며 최종typecheck를 별도로 확인한다. Excel이 아직 구현 중이므로 StageService의 해당case는 교환source완료후갱신·관련재검증하며151PASS를 새Excel교차검증으로 확대하지 않는다.

## Excel·실제 browser 소유권 분리

backend exchange가 아직 쓰지 않은 Excel core/handler/contract/route와 신규 project-export-snapshot-service-core·관련 Excel server tests·EXCEL_EXPORT 문서를 별도 stage_excel_backend에 이관했다. 새 bundle의 snapshot/Stage DTO/optional Resource workload는 같은read transaction/clock1회이며 JSON readservice는 별도canonical snapshot을 사용한다. API/TEST_PLAN 등 공용문서는 기존exchange가 단독 작성하고 Excel근거를 handoff받는다. source미작성 확인뒤 분리하여 동시파일쓰기없다.

실제 SQLite browser는 별도 frontend역할 stage_dashboard_browser_tests가 tests/e2e/milestone-stage-exchange.spec.ts와 after evidence만 작성한다. 기존frontend stage_editor_impl은UI/mock/requeststate/5폭을 소유한다. globalsourcefreeze후 서버를직렬실행한다. 브라우저 legacymixed 직접DBseed는 추가하지 않는다. 원형export/신규Import전체거부·CopyTemplatelegacy/Completed/Cut잠금은nativeSQLiteserver근거와crossreference하고 해당browsercase는NOTTESTED로구분한다. 공유fixture DBpath추측/DB목록scan/실제DB접근은없다.

보존Domain read-only검토는blocker0/PASS이며 최종 source7manifest99c92f8ea9d83ccb98ae99a0702e16dd6870a827d0e89b46ad565478a4dd25c8을확인했다. independent초기4files68PASS 이후추가2files42중1FAIL은기존completed+progress0→in_progress재개정책을오해한신규Oracle였다. 원본snapshotstatus동등assert로보강하고독립2files41PASS(1.57s/chdc5f26), 변경C/error순서와나머지불변source검토를확보했다. 교환JSON/Excel과공식원격CI는NOTTESTED다.

공유 Copy helper는 C 정규화 직후 후보생성 전에 기존 MAX_HIERARCHY_TASKS5000 상한을 확인하도록 보강했다. Server는 기존 budget오류가 먼저이므로 HTTP code/순서는 불변이며 UI에는 TASK_COPY_TASK_LIMIT_EXCEEDED를 안전 안내한다. 4998+C2=5000 허용·ancestor dedup과4999+C2=5001 거부/원본불변을 추가하고 helper23+serverbudget/4042 총25 PASS(ch30c70a/588ms)를 확보했다. 이전sourcefreeze99c92f…는stale이며 새source7 SHA는 a16445c26f7a0033162d4af7a5d4f9d1074fd78134d85685f902313b8cc56a9b, owned16manifest는 dd18f17e099ed768022d963e2e9534916e6b6f339c87af4df6f4b413c1d2ed2f다. 관련unique155사례범위를 확보했으며 단일155개최종실행PASS로표시하지않는다.

교환 최초SQLite/HTTP41개중34PASS7FAIL(chbf2b46)은1개실제sourceCalendar canonical holidays/exceptions 중복복원 결함과6개테스트예상값/필드·테이블·inventory순서 오류로분류한다. sourceCalendar는 exceptions 존재시 해당authority를 사용하고 holidays는구버전fallback으로만사용한다. target Calendar알고리즘은불변이며최종수정후결과를별도로확인한다.

## Import 412 복구 보강

초기 mock 9개 범위는 서로 다른 실행에서 통과했으나 Manager 검토에서 412 이후 File을 유지한 채 최신 snapshot을 조회할 모달 동작이 없음을 확인했다. 이전 preview digest를 폐기하고 명시적인 최신 일정 조회 버튼을 추가한다. ready 화면과 File을 유지하며 AbortSignal 및 target/generation 확인 뒤 canonical snapshot을 적용하고 사용자가 새 미리보기와 저장을 각각 실행한다. 자동 POST나 이전 동의 재사용은 허용하지 않는다. 대상 변경·취소·조회 실패는 늦은 응답 적용을 차단한다. 이 변경으로 이전 Import/geometry 근거는 stale이며 관련 mock 5개를 재검증한다. 나머지 변경 없는 Copy/JSON/Editor 경로 근거는 범위를 명시하여 재사용한다.

변경 후 production/shared fixture 327파일 freeze SHA는 c5e74fd5b8e04b9ac92de6fbb6454652616c1a84001267b225bb324f2575bf9f다. 실제 SQLite browser는 해당 mock 종료 및 generated 파일 복원·source hash 불변 확인 후 직렬 실행한다. 공식 quality/e2e/docker와 최종 원격 QA는 NOT TESTED다.

## 최신 main 통합과 독립 교환 검토

외부 PR #469 병합으로 main은 f8f830d2e8d65a76c718301bad8225532ab8b94a / version0.85.1로 변경됐다. 기존 branch baseline ca15145b1167b7253841e648d23e59d1a172022a와 main 공통 ancestor a9107ab2776829cbb0467a762ab8bf9ce1ce82c4를 기준으로 운영15파일을 원본과 동일하게 통합하고 CHANGELOG/TEST_PLAN의 새 corrective 기록을 기존 #461–464 내용과 함께 보존한다. application version0.89.0과 package/lock 일치를 유지한다. 준비 commit 부모 순서는 [ca15145b1167b7253841e648d23e59d1a172022a,f8f830d2e8d65a76c718301bad8225532ab8b94a]이며 관련 운영 회귀와 문서 동기화를 확인한다. 이 외부 병합이나 CI/GHCR 성공을 Manager의 실행으로 주장하지 않는다.

실제 runtime thread 한도로 원래 infra Agent 재개가 거부되어 기존 stage_dashboard_unit_tests 실행에 Manager가 infra 운영 책임을 재배정했다. 소유권·승인 gate는 유지하며 구현하지 않은 read-only 검토 Agent가 독립 QA를 수행한다.

독립 교환 검토에서 유효 canonical102Task/101Link DAG의 JSON export가 성공하지만1.1 validator의 작업당 predecessor100 상한을 초과함을 재현했다. 상한과 engine을 유지하고101번째 predecessor에서 전체422 EXPORT_LIMIT_EXCEEDED로 거부하도록 최소 보강한다.100개 성공/재검증과101개 파일 미생성·revision/원본 불변 회귀를 확인한 뒤 새 source freeze를 확정한다. 최초 재현의 harness CJS/ESM 로딩 실패와 제품 계약 결함은 별도 기록한다.

## 보강 후 빠른 검증

Import 복구 관련5개와 이미지·다중Copy·pendingCopy412 회귀3개의 순차8개 실행은 PASS(1.1분/chb235f9)다. Import 최초2개/새GET복구·취소/5폭 geometry를 새 source에서 재검증했고 변경 없는6개 경로의 기존 증거를 재사용하여 frontend 관련14개 unique 범위를 확보했다. 단일14개 전체 실행 PASS로 표시하지 않는다. Next 종료/generated2 원본 복원 및327 source hash 불변(chb9c6bf)을 확인했다. 실제 SQLite 통합은 아직 NOT TESTED다.

최신 main의 운영15파일은 전후 ancestor/fresh blob과 다른tracked/source327/raw26 불변을 확인해 통합했다. backend cap 변경은 운영 통합 전에 이미 발생하여 별도 source freeze가 필요하다. lifecycle 정적 검증 PASS(ch a59263), deployment-layout7/7 PASS(ch5dd3a1), version0.89.0 PASS(chb12c87)다. 통합 중 Git index/commit/remote mutation은 없으며 manifest SHA는7f6353577ba3c24f1f7868ee05a9f7f9e7a2382de4d71d658e2f1a770733966b다.

JSON cap 보강 후 관련5파일101/101 PASS(ch5ba256,3.43초), 전체 typecheck PASS(cha55acd), scoped lint PASS(ch437839), Markdown123 PASS(ch403560)를 확인했다. source13 새manifest SHA는fe94c8eaa8a4f58955b80987f8ab1f40dca1204077f3becbba0341fc69c38865다.100개 선행관계 파일은1.1 재검증에 성공하고101개는422/no attachment/no revision 증가·원본 불변을 검증했다. 전체327 freeze SHA4b93a83dc4a91c31e68c1ba71f2d1b3a6d984fb4daf9cc679a3bcc1290f9c6df에서 실제 SQLite 통합2개를 직렬 실행한다. 이 새근거는 변경 전 source freeze를 대체하며 공식 원격 회귀는 NOT TESTED다.

실제 통합 첫3회는 테스트 하니스에서 중단했다. 첫 Resource admin401은 합성14자 값이 기존13~15 길이 금지 정책에 걸린 결과이며 허용23자 테스트값으로 수정했다. 다음 Excel Summary baseline 공란 검사는 self-closing XML cell을 다음 셀과 묶는 parser 오류여서 빈셀/문자/숫자/shared index 정적 샘플을 보강했다. 다음 unlock은201 기대가 현행204 응답과 달라 기존API 계약에 맞게 수정했다. source/security/Excel 계약과 검사 목표는 유지했고 각각 raw 최초 근거를 Git 제외로 보존했다. 일부 실제 단계·JSON/Excel 교환 assertion은 진행했지만 전체2개 통합 PASS로 확대하지 않으며 같은2개 완주 근거를 기다린다. 각 중단 후 Next 종료/generated 원본 복원/327 source 불변을 확인했다.

독립 UI/UX 비교는 frontend 제품 작성자가 아닌 기존 backend 실행에서 수행했으며 작성한 Excel server/docs 승인 범위는 제외했다. frontend15 source hash·40artifact·20geometry 및 PNG12개 직접 비교로 blocker0/PASS를 확보했다.20geometry의120 controls는 document overflow/중첩/containment 오류0이며 고정 action·own scroll·focus를 확인했다. source-onlydomain 교환 최종 검토도 blocker0/PASS이고cap100/1011개독립 실행(ch1c40b6) 및 이전19 pure 영향 재사용을 구분했다. 독립 전체 preQA는 최종 browser/DOCUMENTATION_SYNC/publication freeze 이후 확정한다.

실제4차에서 최초 제품 실패를 확인했다. 정상API 생성45Task/6Milestone의 전체Copy resetProgress:false가409 PERSISTED_SCHEDULE_INVALID로 거부됐다(ch5e4de2,36.7초). 앞선3개 하니스 실패와 구분하며 JSON/Excel·Editor 중간 assertion 도달을 전체PASS로 확대하지 않는다. source Dependency를 읽은 뒤 기존 recalculatePersistedHierarchy의3번째 Links 입력을 누락한 경로를 원인 후보로 확인했고 source Copy/Template owner에게 기존validator/engine/fixture를 유지하는 최소수정과 관련 회귀를 승인했다. Next 종료/generated 복원/327source불변(ch7823f5) 뒤 REWORK하며 이전 Copy source freeze·최종DOCUMENTATION_SYNC/preQA는 새 변경과 실제완주근거를 기다린다.

WholeCopy 정상API 회귀의 최초2/2 FAIL(ch756532)을 보존했다. 기존 helper에 sourceLinks를 전달하는 단일 호출 수정 후Copy23/23 PASS를 확인했다. 추가3파일43개 실행의41PASS/2FAIL(ch1067b0)은 기존SQL Summary→Task 금지endpoint fixture와 Template baseline DTO omission/null oracle여서 검증 목표를 보존하여 수정했다. 기존Copy fixture는 정상3Task DAG로 보정하고 hierarchy/Link/FK/공개UUID/휴일·날짜·원본 검증을 유지했다. 별도 비정상Summary endpoint의 전체거부/partialProject0 회귀도 추가했다. 최종3files44/44 PASS(chcfa0ed,3.85초),type/scopedlint PASS(ch0b0bc0),Markdown123/diff PASS(ch4fb3d7)를 확보했다. helper/engine/다른6source는 불변이며 Template 관련 정상offset/Link/새ID/초기화/source불변도 검증했다.

보존 source7 새manifest SHA는7225cee84607945647ff445267196df09d6bce6608b396ddcf2189321ee80f9c이며 owned17 manifest는b857125ec3b96b2c1f2ba5a8cfd9188138e5fb1b9efe5a3c0a792fd88f5f164b다. source327새freeze f62cfe6a4b3436999bb9fbab6063713341030a0dafcff11d8ea4fe326d514944에서 같은실제2개를 재실행한다. 이전source 및첫4회 이력은 보존하고새수정의PASS로표시하지않는다.

실제5차에서 WholeCopy 두 reset 옵션과Template 생성·적용201/새ID/소속/초기화/source불변까지검증한 뒤Copy메뉴 열기가20초 timeout됐다. 넓은행좌표가설로 namecell정확조작을했으나6차에서도재현됐다. rawtrace에서우클릭전 native/publictop192→Core선택후top201의9px reveal과scrollguard닫힘을확인해제품race로확정했다. 실제source위치는src/features/gantt/project-gantt.tsx다. frontend에 이파일과tests/e2e/task-context-menu-scroll.spec.ts/PROJECT_UX/UI_UX_GUIDELINES4파일단독소유권을추가하고 context선택mirror에만공개select-task show:false를전달하도록승인했다. 일반/keyboard/modifier선택reveal과실제사용자scroll닫힘은유지하며하단미선택virtualrow회귀와같은실제2개를재검증한다. 기존UIsource와관련최종문서/QA는변경범위에맞춰새freeze근거를확정한다. 원격CI와최종QA는NOTTESTED다.

Context 선택 최소수정 후 Unit4 PASS, 기존lint경고4개 유지/오류0, 최종typecheck PASS(chadf1ff),Markdown123 PASS를 확인했다. 변경관련4개 browser는PASS(session85154/ch4bb047,1.4분): 기존 context3.1초·새하단virtualrow5.4초·다중Copy24.1초·pendingCopy9.3초다. native/publictop192 유지·미선택행선택·메뉴/Copy/POST0·Escapefocus·실제scroll닫힘을 검증했다. Next종료/generated2원본복원 및327drift0(ch659bec/ch33ce43) 확인 후같은actual2를실행한다. 새frontendowned21 manifest SHA는c2e97a1fc0561e77c39fbb4e4b99266313233387ed05c1ca941832dc4368d062,context4파일manifest SHA는5378dd5086c2c12b2eaf3b072e26a227bd3b153f4ea95c8dceaf5e60ee1cb0eb다. 기존14coverage와새4run을중복합산하지않으며변경비영향경로/UI40 layout은영향근거를명시해재사용한다. 전체327새freeze는05efed5342aefd0499b2c743e3559c44020538746f3a0125fb212bda15c094b7다.

## Copy 이후 Paste 메뉴 보강

실제 7차에서 Copy는 성공했으나 다음 목적지의 Paste 메뉴가 닫혔다(session21576/ch5f3027, primary62.406초). trace는 우클릭 선택이 Copy 안내를 제거하여 Gantt 높이379→407px, 조상 표 스크롤152→124px로 바뀌고 기존 scroll guard가 메뉴를 닫는 경로를 보여 준다. native/public top192는 유지되어 앞선 reveal 수정과 별도 원인이다. 일반 선택의 안내 정리는 유지하고 context 선택에만 안내 보존을 적용한다. 관련 하단 행 회귀를 Copy→더 아래 목적지→Paste→소속 변경 확인·취소까지 확장하며 source/fixture/실제 spec은 동결한다. 관련4개와 동일 실제2개 완료를 기다리고 첫7회 근거는 제외 경로에 보존한다. 새 source327 freeze SHA는3d8ae3b8d3e97fcd9852c1c1069dffe19ab19b000b315dfd7c3798250d413c9d다. 이전 interaction manifest/최종 문서 판정은 해당 변경 범위에서 stale이며 원격 CI·최종 QA는 NOT TESTED다.

Copy 안내 보존 후 관련4개 브라우저는 PASS(session91415/ch127f06,40.1초)다. Copy→아래 목적지→활성 Paste→소속 변화 확인·취소 POST0 및 native/public top192·표 위치·실제 스크롤 닫힘을 확인했다. Next 종료/생성2파일 복원/327 drift0(chca58b3/chdf50cb), 최종 typecheck·Markdown123 PASS(ch27060d)를 확보했다. frontend owned21 manifest SHA는ed0aa0ef348080207a7284583f3b8d0dbc155dc08422453a9bebce74ca4137c8이며 layout40 증거는 변경 없는 범위에서 재사용한다. 기존 실제 담당 재개가 runtime thread limit로 거부되어 기존 frontend 실행에 같은 원본2개 8차 실행 책임만 재배정했다. source/fixture/spec 쓰기는 허용하지 않으며 결과/성공 화면만 갱신한다. 이 실행은 구현자 Local Fast Feedback이고 독립 QA는 별도 읽기 전용 실행이 담당한다. 최종 실제2개/Stage Gate1개·전체 preQA·원격 게이트는 아직 NOT TESTED다.

## 실제 통합 완주와 게시 준비

같은 원본2개 8차 실행은 모두 PASS(session14704/ch9ccc79 exit0, 전체54.3초; 첫29.1초/둘째5.7초)다. 실제 JSON/Excel/Copy/Template/subtree 확인·취소/완료 경계, readonly native fullscreen·대시보드 왕복·public/DOM left120/top96 보존과 충돌412 이후 File 유지→명시GET1→새 미리보기→수동201 저장을 완주했다. 앞선7회 최초 실패 및 수정 경로는 보존하며 새로운 PASS로 숨기지 않는다. 서버 종료(chd11a76), generated2 원본 복원/gitdiff0·327 drift0·원본 spec5015015 불변(ch7fa29a)을 확인했다. 실제 manifest SHA는c39af1abf42b1150eb219956f29065e23bd693693392408c04aaba8687e1b7ec이며 readonly after PNG1개 SHA는c64f5fbde9476501121d7f85a397bd394e3d51d140620e730f01027ea242b279다. rawtrace/실제DB/log/download는 게시하지 않는다. 현재 게시 후보는 승인138경로이고 Git index/commit/원격 쓰기는 아직 수행하지 않았다.

feedback 변경의 독립 source·회귀·문서·4/4 실행 비교는 PASS/blocker0이며 context 보고서 SHA는d75842cc025fc469357f254b116fba9c988e8af664c9759824a4f44cffc1dec9다. 기존 layout40·PNG12 직접 비교 근거는 변경 없는 범위에서 재사용했다. 실제2개는 구현자 LFF이며 독립 전체 preQA는 기존 Stage Gate1개 및 최종 DOCUMENTATION_SYNC/게시 manifest 확정 뒤 판단한다. 공식 quality/e2e/docker·최종 원격 QA와 main/GHCR는 NOT TESTED다.

기존 Stage Gate 실제1개도 PASS(session91128/chf683c1,12.8초/전체23.6초,exit0)다. 실행한 Next/Playwright PID 종료(ch3c8b42), generated2 원본 복원/327 drift0/해당 spec 불변(ch8d0645)을 확인했다. 프로세스 초기 광역 조회에 포함된 다른 사용자 컨테이너 서비스는 종료하지 않고 이번 실행 PID로만 정리 여부를 확인했다. 최종 TEST_PLAN/DOCUMENTATION_SYNC·게시138파일 manifest와 독립 preQA를 확정한다.

## 2026-10-06 latest main/#463 재정렬 및 corrective

- 기존 PR head: `c5a7bc9e8462128b5f977918b719d38d4d7a89be`; 정렬 기준: main `0fc986cb0cb642bdbedeec30157b27bd522b5a38` + #463 head `703807d600c1499092b0144732669fbe54465ca6`.
- 최신 workflow/lifecycle, #454 물류 유형 변경, #463 production CSS·Summary/Relation Editor·Context Menu opening-scroll 보완을 우선 보존하고 #464 고유 JSON/Excel/Copy/Template 변경만 재적용한다.
- Codex P2는 advisory source calendar/dependency로 source effective schedule을 재구성해 동일 Export 재가져오기의 false `changedTasks`를 제거한다.
- 후보 application version은 `0.92.0`; 새 exact-head PR CI가 공식 원격 재검증 기준이다.

## 2026-10-06 latest main 재정렬 — second alignment

- 이전 head: `1e1397aca8d48780dbc8dcc397f333b3d9bb85ca`.
- latest main: `d748046733ae2006580052a480c984ae1eb1fa2a`; #463 merge와 이후 #455/transport/#463 filter corrective를 포함한다.
- 충돌 파일은 `project-gantt.tsx`, CHANGELOG, MILESTONE_STAGE_GATES, PROJECT_UX, TEST_PLAN, active PLAN으로 한정됐다. #454 중복 산출물/source는 양쪽 blob이 동일함을 확인했다.
- Gantt는 main의 surface-aware opening scroll settle을 보존하고 #464의 context selection `show:false`·Copy feedback 보존만 재적용한다.
- application version은 `0.92.0` 유지. 새 exact-head PR CI가 공식 재검증 기준이다.
