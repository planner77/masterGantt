# Issue #750 — #623 E2E 분할·원본 정합성 보존

- Primary Issue: [#750](https://github.com/planner77/masterGantt/issues/750). baseline main `d2a82b66`, baseline application `0.130.0` → PATCH 후보 `0.130.1`, branch `test/issue-750-resource-acceptance-split`.
- 범위: 설계·테스트 구현·문서/실패 원장·리뷰/충돌 해결·Ready PR Full CI 시작. CI 모니터링·병합·Main/GHCR·Release·Issue 종료는 범위 밖이다.
- `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`, `release_required=true`, `release_authorized=false`.
- 실제 역할: Manager 문서/실행/통합/원격 운영·PATCH 동기화, frontend `/root/split_tests` #623/#463 E2E 및 공용 picker 보정, qa_docs `/root/review_scope` read-only 설계·후보 검토, ui_ux `/root/popup_bounds_design` read-only fractional clipping 설계. Agent 사전 검토는 Trusted QA·Owner의 병합 승인과 구별한다.

## 설계

기존 집계/Excel 및 6-write 종단 시나리오 사이의 분리를 유지하고 WBS/Target(2), Resource/Assignment(3), Target binding(1), 조회-only 화면 복귀(0)를 각각 독립 실행한다. 매 테스트는 기존 test-scoped 실제 SQLite/HTTP/브라우저 fixture를 새로 생성하며 mutable 상태를 공유하지 않는다. 종단 smoke는 6회 UI 저장과 revision +6을 유지하되 Resource 상세를 한 번 연 뒤 같은 canonical row에서 편집하여 반복 진입을 줄인다. 단계/실패 계측은 기존 attachment와 trace/error context를 보존한다.

기존 7개 → 11개: 집계/Excel 1, 독립 경계 4, 결합 smoke 1, 5폭 geometry 5. 60s 집계·90s smoke·45s geometry 및 focused 기본30s, retry0를 확대하지 않는다. fixture120s와 본문 예산은 별개다. fixture 준비 횟수가 증가하므로 안정성 개선과 비용 절감을 동일시하지 않는다. 현재 CI는 file 기반 8-shard 계획이므로 이 spec 내부 분할을 원격 샤드 분산 개선으로 보고하지 않는다.

## 추가 교정 범위 — 기존 #463 실제 결함

최초 cross14 중 #463가1FAIL했다. 원래 End 즉시 검사를 보존한 진단5회는4PASS/1FAIL, 음성 대조10회는9PASS/1FAIL이었다. 마지막option의 bottom879.5가 list bottom879를0.5px 넘었고, 목록scroll만ceil1 보정하면 bottom878.5/가시성true가 되며 원상복원하면 원래false가 유지됐다. 이는 native scrollIntoView 정수 반올림의 실제 경계 결함이다.

공용 StageFilterPicker.move는 기존scrollIntoView 뒤 현재 option/list rect의 넘침을Math.ceil로 계산해 list.scrollTop만 한 방향으로 동기 보정한다. input focus·선택·popup배치·Gantt/viewport·HTTP/권한 계약은 유지한다. End의기존0허용오차를 보존하고5폭 Home/ArrowDown/ArrowUp 즉시 focus/가시성/index를 보강한다. Design Delta B, DESIGN.md N/A다. 제품 버그 수정이 추가되어 package/lock의PATCH0.130.1로 동기화하고 release_required=true/release_authorized=false로 전환한다. 병합·태그·GHCR 승인을 추론하지 않는다.

## AC_TEST_COVERAGE

- AC1: 기존 단언100% 매핑은 아래 표의 집계/Excel·독립 경계·6-write 결합 smoke·5폭 geometry와 Gantt 보존 항목을 따른다.
- AC2: 같은 source Chromium 정상/역순/분리/cleanup 실행 및 전후비용은 영향 검증·실행 원장과 정제 evidence에 기록하며 원격 Required3는 별도 NOT TESTED다.
- AC3: phase timing attachment의 fixture/seed/body/teardown 및 원본 Target/Assignment GET 직전 단계와 실패 trace/diagnostics로 예산·실패 지점을 구분한다.

모든 경로는 `tests/e2e/issue-623-resource-mvp.spec.ts`의 실제 HTTP/Chromium 검사다. 공용 함수는 실제 UI/저장 경로를 호출하며 mock이나 별도 산식을 도입하지 않는다.

| 기존 계약 | 새 검사/공용 함수 | 보존할 단언 |
| --- | --- | --- |
| F0 집계·Excel | `실제 통합 구성·F0 원시5M/D·UI와 Excel 동일 snapshot` | A5/B5/union5 M/D·0.25 M/M, Task1/Assignment1, 설비15/System3, 상속1/직접2·ACS subset·공유MCS, UI2cells·단위전환, exact UI filters/snapshot→XLSX, 원시Task/Assignment/Resource/Target ID·Y/Z 값·snapshot 불변 |
| WBS 작업명·Target 시작일 PATCH2 | `독립 WBS 변경` + `renameFromWbs`/`changeStartFromTarget` + smoke | 정확 Task·각 저장1·revision+1, Target rawID·Editor 복귀, 변경 name/date |
| Resource 상태·진행률 PATCH2/Assignment PUT1 | `독립 Resource/Assignment` + `changeResourceAndAssignment` + smoke | 상태/35%·allocation80%, Assignment1·exact ID/Task, 각 revision+1 |
| Target binding PUT1 | `독립 Target binding` + `changeTargetBinding` + smoke | ACS-B memberIds exact subset·상속 AMR-A 유지·revision+1 |
| 결합 six-write | `여섯 별도 mutation·양방향 동일원본 복귀` | PATCH4/PUT2의 exact method/path/body·revision+6·일정 이름, Task ID 집합 불변·중복0 |
| 조회-only 왕복 | `독립 화면 복귀` + Golden/geometry | Target Task rawID·Resource Assignment rawID, 쓰기0·snapshot equality·일정 복귀 |
| 저장마다 Gantt 보존 | `mutationSession.assertSaved` + Golden/geometry | 기존 instance 동일·실제 Core element 연결, Task IDs 순서/집합 동일 |
| 390/768/1024/1440/1920px | 기존 geometry 5case 유지 | tree/matrix10·열 경계±1px·action containment·document overflow·390 실제 ArrowRight/focus·조회0 |
| 공용 picker 실제0.5px clip | StageFilterPicker.move·#463 기존5폭·#462 mock/actual | End/Home/Arrow 즉시 focus/active index/전체가시성, 기존0허용오차·Escape복원·조회0·Gantt보존 |

## 영향 검증·비용

- 직접: #623 전체, #621 전체(Assignment·Target/권한·dirty/stale), #624 전체(동일 seed 직접 소비자·네 관점 drill/readonly/focus).
- #730 실패 합집합: #623/#621 외 `milestone-dashboard-state`, `milestone-management-persistence`, `issue-719-contextual-help`, `issue-726-task-logistics`, `project-resource-memberships-persistence`, `project-task-editor-persistence`, `issue-725-process-workareas`의 7개 E2E spec. [원본 원장](../../ISSUE_730_FAILURE_ANALYSIS.md) §23까지의 실제 실패를 유지한다.
- 같은 제품/test/fixture source에서 정상/독립/역순/분리 실행, 의도적 실패 후 cleanup을 확인한다. 정상 실패와 controlled-negative를 구별하며 skip/retry/timeout 완화 금지.
- fixture/seed/body/teardown 합계·명령 wall-clock을 전후 비교한다. 실제 Actions shard wall/runner 비용은 모니터링하지 않으므로 NOT TESTED. 합성 로컬 시간을 원격 절감으로 환산하지 않는다.
- 원본 #3012.1은 fixture `Before Hooks`14.6797s/별도120s, 본문 약59.97s/60s의 예산 소진이다. 취소된 마지막 Target GET을 단일 API60s 장애로 단정하지 않는다.

## TEST_LIFECYCLE_REVIEW

기존 #623/#621/#624 spec·shared fixture·Domain/SQLite/OOXML 수용 검사를 검색했다. #623은 FLAKY_OR_EXPENSIVE/PARTIAL_OVERLAP → EXTEND/경계 분리, 기존 assertion KEEP_UNIQUE. Domain/서버 검사는 브라우저 same-source/revision/복귀 증거를 대체하지 않는다. 새로운 파일별 제품 테스트·정책·worker/shard 변경 없이 기존 spec을 확장한다. #463 실측 결함 교정은 같은 기존case에 End/Home/Arrow 회귀·실패 좌표 보존을 추가하는 EXTEND이며 공용 picker 두 소비자 #462 mock/actual·#463 전체를 교차 선정한다. 실행비용 증가는 실측으로 공개하고 미발행 후보의 rollback은 #623/#463 spec·공용 picker·package/lock PATCH·연결 문서를 함께 되돌리는 범위다. 정식 발행 뒤에는 immutable tag/GHCR를 이동·덮어쓰거나 같은 version을 재사용하지 않고 새 PATCH 교정으로 처리한다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_750.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TARGET_RESOURCE_ACCEPTANCE.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/ISSUE_750_FAILURE_ANALYSIS.md`: UPDATED
- `docs/REQUIREMENTS.md`: N/A(테스트 분할·UI scroll 보정이며 제품 요구 변경 없음)
- `docs/ARCHITECTURE.md`: N/A(테스트 분할·UI scroll 보정이며 구조 변경 없음)
- `docs/API.md`: N/A(테스트 분할·UI scroll 보정이며 API 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(테스트 분할·UI scroll 보정이며 schema 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(테스트 분할·UI scroll 보정이며 산식 변경 없음)
- `docs/SECURITY.md`: N/A(테스트 분할·UI scroll 보정이며 권한 계약 변경 없음)
- `DESIGN.md`: N/A(기존 keyboard 가시성 원칙의 Design Delta B이며 신규 공통 원칙 없음)
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/PROJECT_UX.md`: N/A(기존 picker 가시성 계약의 구체화는 UI_UX_GUIDELINES 한곳에 기록)
- `docs/TASK_EDITOR.md`: N/A(테스트 분할·UI scroll 보정이며 편집 기능 변경 없음)
- `AGENTS.md`: N/A(테스트 분할·UI scroll 보정이며 기존 실행 지침 유지)
- `docs/ISSUE_LIFECYCLE.md`: N/A(테스트 분할·UI scroll 보정이며 승인과 gate 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(테스트 분할·UI scroll 보정이며 Owner 승인 경계 유지)
- `docs/GITHUB_OPERATIONS.md`: N/A(테스트 분할·UI scroll 보정이며 원격 운영 정책 유지)
- `docs/PR_CI_FAILURE_TRIAGE.md`: N/A(테스트 분할·UI scroll 보정이며 기존 원장 정책 적용)
- `docs/LOCAL_PREPR.md`: N/A(테스트 분할·UI scroll 보정이며 기존 검증 도구 유지)
- `docs/IMPORT_SCHEMA.md`: N/A(테스트 분할·UI scroll 보정이며 입력 형식 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(테스트 분할·UI scroll 보정이며 기존 OOXML 검증 유지)
- `docs/DEPLOYMENT.md`: N/A(테스트 분할·UI scroll 보정이며 배포 변경 없음)

## 실행 원장

초기 `npm ci --prefer-offline --no-audit --no-fund`: Node22.14.0/npm11.10.0,446 packages/8s PASS. frontend scoped ESLint·tsc·11case discovery PASS. 1차 동결의 실제 Chromium11PASS/28UnitPASS·비용+65.177%·독립 사전검토는 원장에 보존했다. 이후 #463 제품 보완으로 소스를 다시 동결하여 재실행하며 원격 Required3/Trusted/Manager ACCEPT는 NOT TESTED다. 최신 실행과 review/충돌 결과는 실패 원장과 정제 evidence에 누적한다.


최종 동일-source 로컬 검증은 Unit37·Chromium 고유36(실제 HTTP/SQLite24+mock12) PASS다. 역순4/로컬2part4/교정반복10/화면증거1은 추가19실행이며 cleanup2회는 의도적exit1 뒤 프로세스·DB/dist0/trace보존 PASS다. scoped ESLint/tsc/version/markdown/diff와1110파일 소스 일치를 확인했다. 최종 #623 wall189.006251→349.736872s(+160.730621s/+85.040%, source당1표본)로 비용이 증가했으며 Actions8-shard 비용은 NOT TESTED다. [실행 증거](../../evidence/issue-750/local-validation.json), [최종 비용](../../evidence/issue-750/cost-comparison-final.json), [원시 ID](../../evidence/issue-750/canonical-identity.json), [popup 측정](../../evidence/issue-750/popup-bounds-verification.json), [교정 전](../../evidence/issue-750/popup-before.jpeg)/[후](../../evidence/issue-750/popup-after.jpeg)를 실패 원장과 함께 참조한다. Required3/Trusted/Manager는 원격 완료 전 NOT TESTED를 유지한다.

qa_docs `/root/review_scope` 최종 read-only 사전검토 PASS/미해결P1·P2 0건, ui_ux `/root/popup_bounds_design` 코드/JSON 비교 PASS/지적0이다. 이 사전검토는 Owner 최종 QA·Manager ACCEPT가 아니다. PR 생성 후 최신 review thread/mergeability·CI 시작 Run/Attempt/Head/base/test merge는 Issue STATUS에 기록한다.
