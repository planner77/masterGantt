# Issue #507 · #574 — 세로 스크롤 진단과 Marker-OFF 통합 검증

Primary Issue: https://github.com/planner77/masterGantt/issues/507
Related Issue: https://github.com/planner77/masterGantt/issues/574
기준 main: `8d6d3ba7a47e6df08c509baad6eedcc2adee1407`; application `0.138.4`; SVAR Core `2.7.3`.
branch: `test/issue-507-574-gantt-acceptance`.
후보 version: `0.138.5` (PATCH). 변경되지 않은 날짜축의 반복 DOM 장식을 줄이는 제품 성능 보완이므로 버전을 올리며 package/lock root 값을 일치시킨다.
risk_level: HIGH; qa_required: true; qa_method: OWNER_MANAGED; manager_decision: NOT TESTED.
risk_reason: 단일 Gantt의 native scrolling·projection·비동기 사용자 의도 및 숨은 선택/clipboard의 교차 회귀를 다룬다.
issue_comment_writer: Manager; issue_comment_allowed_types: PLAN, STATUS, EXCEPTION.
release_required: true; release_authorized: false.

## 범위와 역할

사용자 승인 범위는 두 Issue의 분석·설계·구현·관련 검증·문서·실패 원장·리뷰/충돌 해결 후 **하나의 Ready PR Full CI 시작**이다. CI 모니터링·병합·Main/GHCR·정식 릴리스·Issue 종료는 포함하지 않는다. PR은 Primary #507 하나의 canonical Refs와 Related #574 설명을 사용한다.

- Manager: 요구사항·통합·문서·누적 원장·Issue 댓글·최종 인계.
- `scroll_diagnosis`(frontend): #507 실제 Chromium 계측과 근거 있는 최소 제품 보완, 기존 stability spec 및 전용 테스트 helper. `src/features/gantt/**` 소유.
- `cross_feature_tests`(frontend): 기존 `task-context-menu-hierarchy.spec.ts`, `grid-task-start-reveal.spec.ts`, `project-gantt-inline-name.spec.ts`의 #574 공백 확장.
- `ux_review`(ui_ux): read-only Design Delta와 진단 경계. `coverage_audit`(qa_docs): 구현자와 분리된 read-only AC/테스트/문서 사전 검토.
- `pr_operations`(infra): GitHub 인증·canonical trace·전체 tree API 게시·PR 및 CI 시작 확인. 독자적인 Issue 댓글 권한 없음.

별도 Agent 사전 검토를 인간 GitHub APPROVED 영수증·신뢰된 QA Final·Owner의 HIGH 위험 수용·Manager ACCEPT로 격상하지 않는다. 실제 모델 신원은 독립 검증하지 않는다.

## 분석·설계

Design Delta B: 기존 workspace-first native scroll·단일 instance·최신 사용자 입력 우선 원칙을 구체화한다. #852 수평 탐색과 #860 변환 정합은 배포 완료 기준선이며 #507 부드러움 또는 #574 전체 V1~V8 PASS 증거가 아니다. #573/#693 marker ON은 비차단이다.

1. #507은 동일 Chromium의 300/1000/3000행에서 3~5초 wheel 구간의 native/Core Y, Grid/Chart geometry, React commit, observer 호출/시간·DOM 변경, long task·frame 간격, root/API identity를 측정한다. 최소 SVAR와 제품 통합을 구별하고 계측 자체 비용·가상화·Summary 바 geometry를 고려한다. 원인 증거 없이 CSS·throttle·강제 remount·임의 SVAR 업/다운그레이드를 적용하지 않는다.
2. 제품 보완은 `scale-decoration-observer.ts`가 날짜축 cell 추가/교체·내부 자식 변경과 Week class 변경만 장식 callback으로 전달하도록 제한한다. Grid row 가상화·관련 없는 class 변경은 header 전체 재스캔/DOM 쓰기를 발생시키지 않는다. 초기 장식·cleanup·Day/Week 고유 관찰 옵션은 유지하고 단위·실제 Chromium으로 검사한다.
3. #574는 V1~V8의 기존 원본 assertion을 조사하고 실제 공백만 확장한다. 변환 전 clipboard를 채워 취소 보존·확정 후 무효화를 검사하며, 검색 결과0→해제 이후 최신 명시 Task 선택이 이전 bookmark보다 우선하는지 native 좌표로 검사한다. 일반 inline401의 canonical/readonly·추가쓰기0을 별도 검증한다. canonical 전체 ID·권한·revision과 mock/실제 HTTP·SQLite/Export 경계를 분리한다.
4. 관측 수치·정지 캡처·자동 E2E를 사람의 실제 wheel/trackpad 체감 검증으로 확대하지 않는다. 실행하지 않은 조합·실기기·운영 환경은 NOT TESTED다.

## TEST_LIFECYCLE_REVIEW

- EXTEND: `tests/e2e/task-context-menu-hierarchy.spec.ts`의 기존 #860 실제 HTTP/SQLite 변환. 확인/취소·동명 ordinary Task·Core/Grid/Chart0·5폭 Day/Week/fullscreen·Dashboard 동일 ID 보호를 유지하고 clipboard를 보강한다.
- EXTEND: `tests/e2e/grid-task-start-reveal.spec.ts`의 기존 #514/#852 selection/peer/축 탐색에 #574 V3의 filter0→최신 명시 선택 경합을 연결한다.
- EXTEND: `tests/e2e/project-gantt-inline-name.spec.ts`에 일반 inline401의 원본·readonly·후속쓰기0 검증을 추가한다. 기존 Milestone Editor401은 일반 inline의 직접 근거가 아니므로 독립 경계를 유지한다.
- EXTEND/ADD: `tests/e2e/project-gantt-stability.spec.ts`에 native wheel300/1000/3000행을 추가하고 `tests/e2e/helpers/vertical-scroll-diagnostics.ts`를 재사용한다. 기존 #822 밀도 anchor 및 #552 SC-14 readiness가 검사하지 않는 프레임/observer·alignment 진단이다. 별도 E2E spec/샤드 계획 변경 없이 기존 파일의 실행 경계를 확장한다. 새 `tests/features/scale-decoration-observer.test.ts`는 실제 scale 변경 반응·무관한 row mutation 무시·cleanup을 검사한다. 계측은 제품 상시 로그가 아니다.
- KEEP_UNIQUE: `gantt-state-product-integration`, `project-task-delete-context`, `resource-kpi-integration-ui`, `viewport-coordinator`, `inline-name-persistence`, `project-gantt-inline-name`, `milestone-timeline-interchange-http`, 기존 Core/viewport 단위 테스트. 권한·HTTP/SQLite·unknown result·Export·IME 경계가 달라 제목 유사성으로 대체하지 않는다.
- 기존 테스트 삭제·skip·retry/timeout 증가·assertion 완화·8-shard/Required3/Trusted gate 변경 없음. 실행 결과와 미실행은 [단일 누적 원장](../../ISSUE_507_FAILURE_ANALYSIS.md)에 기록한다.

## AC_TEST_COVERAGE

- AC1: #507 실제 vertical-wheel 계측 → 일반·stress native Grid/Chart Y·geometry·root/API identity. Day/Week·fullscreen·readonly/editable·tree 조건과 수동 체감 경계를 구분한다.
- AC2: #507 원인 분리 → callback/action/React/long-task/frame 원본과 통제 비교. 재현된 원인만 최소 보완하고 원본 FAIL을 보존한다.
- AC3: #507 상태·데이터 보호 → instance/selection/tree/columns/scale·mutation0/revision 불변, 기존 fullscreen/density/timeline/tooltip/context/inline/DnD 소비자 유지.
- AC4: #574 V1~V3 → metadata/delete/unknown 결과·peer-wheel·filter0/최신 선택의 기존 assertion 및 새 교차 회귀, 현재 source 실행 결과 매핑.
- AC5: #574 V4~V6 → 변환 확인/취소 mutation0, native/Core/selection/clipboard에서 M 제외·동일 ID Dashboard, 5폭 Day/Week/fullscreen·inline 저장/IME/오류 경계를 원본 assertion과 연결.
- AC6: #574 V7~V8 → Task 없는 미래축3회 확장 및 최신 사용자 의도, M-only/empty·hierarchy·실제 HTTP/SQLite JSON/Excel/SVG/PNG·권한/교환의 보존 테스트와 미검증 범위 추적.
- AC7: 관련 문서와 단일 실패 원장·사전 검토·latest main/리뷰 thread·충돌 및 exact Head/base/test-merge/Run/Attempt 확인 후 Full CI 시작. 원격 Required3/Trusted/Owner·Manager ACCEPT는 결과 미확인 시 NOT TESTED.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_507.md`: UPDATED
- `docs/exec-plans/active/ISSUE_574.md`: UPDATED
- `docs/ISSUE_507_FAILURE_ANALYSIS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GANTT_STATE_CONFORMANCE.md`: UPDATED
- `docs/MILESTONE_TIMELINE_TRACEABILITY.md`: UPDATED
- `docs/WBS_CROSS_FEATURE_ACCEPTANCE.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(기존 단일 작업면·native scroll·최신 의도 보존 원칙을 적용하며 시각 언어 변경 없음)
- `docs/PROJECT_UX.md`: N/A(기존 scroll continuity·marker OFF·변환 확인 및 Dashboard 동일 ID 계약을 검증하며 제품 정책 변경 없음)
- `docs/TASK_EDITOR.md`: N/A(기존 canonical 편집·dirty/권한·focus 계약을 유지하고 Editor 구현 변경 없음)
- `docs/ARCHITECTURE.md`: N/A(기존 단일 Gantt·Coordinator·canonical gateway를 검증하며 구조·저장 계층 변경 없음)
- `docs/REQUIREMENTS.md`: N/A(기존 세로 스크롤 안정성과 Marker-OFF·최신 사용자 의도 보존 요구를 검증하며 제품 범위 변경 없음)
- `docs/API.md`: N/A(기존 mutation/read/strong If-Match 계약을 유지하고 route·입출력 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite schema·migration 변경 없이 기존 HTTP fixture로 검증)
- `docs/SCHEDULING_ENGINE.md`: N/A(기존 Milestone·Task 날짜/기간·집계 알고리즘 변경 없음)
- `docs/SECURITY.md`: N/A(기존 Origin·session·revision·readonly 권한 경계를 유지)
- `docs/IMPORT_EXPORT.md`: N/A(기존 교환·Export 무손실 원본 테스트를 유지하고 형식·동작 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(JSON schema·정규화·ID 계약 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(기존 Excel 생성·다운로드 계약 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 성능·interaction·증거 원칙을 적용하며 공통 규칙 중복 추가 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(workflow·원격 증거·required gate 변경 없이 기존 PR Full CI 시작 절차 사용)
- `docs/CI_CD.md`: N/A(CI·Ruleset·권한·Main/GHCR·Release·Finalizer 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical Primary Issue 및 일괄 API 게시 규칙 적용)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 OWNER_MANAGED·Trusted QA·Owner HIGH 위험 수용 및 최종 승인 조건 유지)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 Work Packet·사전 검토·PR CI 시작 인계 경계를 적용)
- `docs/PR_CI_FAILURE_TRIAGE.md`: N/A(기존 누적 원장 규격을 Primary507에 적용하며 공통 정책 변경 없음)
- `docs/LOCAL_PREPR.md`: N/A(선택기 UNKNOWN의 BLOCKED를 보존하고 수동 매핑·실제 직접 검증을 별도 기록)
- `AGENTS.md`: N/A(실행 지침·QA 정책 변경 없음)

## 실행·판정·인계

실측된 날짜축 callback 비용을 근거로 제품 변경과 PATCH0.138.5/release_required=true를 결정했다. 게시 승인은 없으며 release_authorized=false다. 새 PR Head의 Quality/E2E8/Docker·Trusted QA·Owner 위험 수용·Manager ACCEPT는 NOT TESTED이며 이번 요청 종료점은 CI 시작이다.

### 실제 source와 로컬 결과

- Gantt 제품2파일 fingerprint: `55b4de91c73e2cfa2560a9cdf19b59e4ec15ac61c27faf6e73f56c402b167383`; 개별 byte SHA256과 계측/최소 Core·실행 이력은 [scroll receipt](../../evidence/issue-507/scroll.json).
- 전체 application source/next.config/package/lock fingerprint: `a08e9483a5610b88ae2fc269e722df76599c802eaebac3ab2453fafc1268dbe7`. [Application source map](../../evidence/issue-507/application-source.json)은 현재 게시 tree의 파일 hash를 최종26case의 실제 관련 source와 대조한 자료다.
- #507 최종4/4 PASS: canonical50/300/1000/3000, 43.7/35.6/30.9/46.4초, 총2.6분. Grid/Chart 실제 wheel·Day/Week·fullscreen·선택/열/폭/tree·API/root·mutation0/revision 불변을 확인했다. 일반50은1024px·Resource 복귀·밀도34→32→34, 1000은 readonly/접힘, 300/3000은 editable/펼침이며 300의5폭 layout smoke를 별도로 기록한다. 모든 조건의 전수 곱이 아니다. 기존 밀도·Day/Week header2/2 PASS(5.8/8.0초).
- #574 최종26/26 PASS, FAIL/SKIP/flaky0: mock/native11건58.2초 + 격리 HTTP/SQLite8건5.2분 + 교차 HTTP/SQLite7건3.2분. [실행별 cases·source·결과](../../evidence/issue-507/cross-feature.json), [V1~V8 owner/원본 assertion 매핑](../../GANTT_STATE_CONFORMANCE.md).
- 같은 전체 application fingerprint를 세 묶음에서 확인했다. actual8 실행 중 관련 없는 vertical-scroll helper만 바뀐 broad hash 차이는 보존하고, 실제 import 경계·app/package/config의 관련578파일 불변을 [검증](../../evidence/issue-507/isolated-final-relevant-source.json)했다. Manager가 게시 tree의 모든 관련 파일 hash를 각 before map과 재대조하여 일치함을 확인했다. 서로 다른 mock/실제 DB fixture를 동일 snapshot이라고 주장하지 않는다.
- V3 실제 FILTER_RETURN APPLYING 중 명시 Grid 선택 뒤 과거 복원 SUPERSEDED, 최신 선택 SETTLED; left120→0→2040, native bar offset0px, 같은 API·mutation0. 변환은 원본 clipboard `[동일 ID]`→취소 유지→확정 `[]`, native/Core·app selection0·Dashboard 동일 ID를 확인했다. [정제 assertion receipts](../../evidence/issue-507/assertions/issue-574-zero-result-latest-selection.json).
- Unit: Manager6파일48/48(7.36초), 별도 header/observer3파일15/15. 공통 observer2case를 빼면 **8파일61고유 case PASS**이며 반복 실행을 고유 case로 합산하지 않는다. 실제 native MutationObserver의 독립 QA 추가 검증은 별도다.
- 최종 typecheck PASS; 변경8파일 ESLint 오류0/기존 Hook 경고3; version0.138.5·Markdown links·test discovery285 Unit files/861 browser tests(root/외부 cwd 동일)·diff check PASS. Next의 테스트별 generated type 경로는 baseline으로 정규화했으며 config/workflow 변경 없음.
- Local Pre-PR fast는 신규 helper2개 producer→consumer 등록 UNKNOWN으로 **BLOCKED**. report 경로·실제 수동 매핑·최초 실패·비재현/중간 PASS와 최종 재검증은 [누적 원장](../../ISSUE_507_FAILURE_ANALYSIS.md)에 기록했다. 자동 선택기를 우회해 PASS로 바꾸지 않았으며 CLI 내 전체 Unit/production build는 NOT RUN이다. 직접 검증과 공식 전체 회귀는 구분한다.

### 남은 경계와 인계

물리 wheel/trackpad의 최종 체감·사람의 flicker 판정·실기기/수동 UX는 NOT TESTED다. headless Chromium native scrollbar gutter0으로 thumb drag도 NOT TESTED이며 scrollbar CSS를 바꾸거나 가짜 drag PASS를 만들지 않았다. 측정한 app-owned 날짜축 낭비 제거를 모든 Core/React commit·전체 DOM scan·frame drop/long task 해소로 확대하지 않는다. 운영 source/production storage·Windows Excel/VBA/DRM·proxy/TLS는 이번 로컬 fixture의 대체 검증이 아니다.

분리된 qa_docs 사전 검토 후 전체 tree를 일괄 게시한다. 최신 main·미해결 thread·mergeability·exact Head/base/test-merge와 CI Run/Attempt의 실제 등록은 Issue/PR STATUS에 기록한다. 최종 Quality/E2E8/Docker·Trusted QA·Owner HIGH 위험 수용·Manager ACCEPT, 병합·Main/GHCR·정식 게시·Issue 종료는 이번 인계 후 별도다.

분리된 Reviewer `qa_docs /root/coverage_audit`는 최종 구현·테스트·문서·실제 assertion과 게시 자료를 대조하여 **사전 검토 PASS / 남은 차단 지적0**을 반환했다. 검토한 application fingerprint는 위 `a08e9483...`의 전체 값, Gantt fingerprint는 위 `55b4de91...`의 전체 값이며 manifest SHA256은 `8cce0aa1f55c239767c5ef1a5e33b5940b018ba04fd8e7b1e32359ef6a01ac8a`이다. F507-PREQA-013의 최소 Core 행 높이 지적도 실제34px 재실행으로 교정·검토했다. 이는 `qa_final`·Manager ACCEPT 또는 인간 GitHub APPROVED 영수증이 아니다. lifecycle phase는 PR_READY이며 사용자 요청에 따라 Full PR CI 등록 후 결과 모니터링 없이 인계한다.
