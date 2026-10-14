# Issue #619 — Target Resource KPI R1 Work Packet

## 기준 및 실행 범위

- Issue: https://github.com/planner77/masterGantt/issues/619, 상위 #613, 선행 계약 #614 및 #617 PR #676.
- baseline main: `96c6c74b304f1ccd09f7340f37ebf0b0c393ae3b`; branch: `feat/issue-619-target-resource-kpi`.
- 현재 phase: QA_READY → PR_CI 준비. 요청 종료점은 구현·문서 동기화·사전 검토 및 리뷰 스레드/충돌 해결 후 PR Full CI 시작 확인이다. CI 완료 모니터링·병합·Main CI·GHCR·정식 Release·브랜치 정리·Issue 종료는 수행하지 않는다.
- application version: `0.109.0` → `0.110.0` minor. 하위 호환 typed 분석 기능 추가이며 package/lock 최상위·root 버전만 변경하고 의존성 그래프는 유지한다.
- 실제 담당: `/root/domain` scheduler가 `src/domain/resources/**` 및 관련 domain tests/fixtures, Manager가 문서/version/GitHub 운영, `/root/qa` qa_docs가 read-only 별도 사전 검토를 맡는다. 공유 파일 writer는 1명이다. Issue progress writer는 Manager다.
- 기존 작업 폴더의 미추적 자료는 유지하고 별도 worktree `/home/planner/Dev/masterGantt-issue-619`를 사용한다. 로컬 공유 node_modules는 빠른 검증용이며 공식 CI의 frozen install 근거가 아니다.

## 계약 및 비범위

기존 Resource KPI 계산기와 #617 단일 Target resolver를 재사용한다. 공수 원장은 `(projectPublicId,assignmentId)` 개인 일반 Task Assignment이며 Target/member/공정/WorkArea는 조회 축이다. 같은 축 OR·다른 축 AND, Target/member 조건은 같은 binding 경로, 같은 kind의 type/instance는 같은 member에서 판정한다. Equipment와 System 동시 조건은 같은 binding 안에서 각각 만족해야 한다. 개인 Group/Role/grade는 같은 개인 Assignment에서 판정한다.

Target 소계는 관련 계획 공수로 중첩될 수 있으며 Grand Total은 선택 범위 원시 Assignment 합집합으로 재계산한다. 실적/잔여공수·원가/기여 배분, 대수 곱하기·Target 수 균등분할을 만들지 않는다. T0 진단과 A 분모, Calendar inclusive·null/partial/configured0·M/M 미설정 의미, 전체 Milestone Ready/Blocked를 유지한다. legacy 직접 MCS로 Target을 추론하지 않는다.

ResourcePlan의 R 모집단과 전체 Project load는 Target 필터로 축소하지 않는다. 새 UI/서버 endpoint/DB migration/Plan·Excel 공개는 비범위이며 #618/#620~#622 후속이다. #618의 최소 편집 UI가 완료되지 않은 상태를 제품 종단 수용 PASS로 표시하지 않는다. #617 Main/Release/Finalizer 및 #613 Epic 종료도 이 작업의 범위가 아니다.

## Typed 구현 인계

- 기존 입력: `ResourceKpiInput.logistics?: ResourceKpiLogisticsInput`, `ResourceKpiFilters extends ResourceKpiTargetFilters`. snapshot omission은 이전 KPI 출력 그대로이며 새 축 없이 서버 소비자를 바꾸지 않는다.
- `src/domain/resources/resource-kpi-targets.ts`: canonical Target snapshot 검증·정규화, 같은 binding/member 필터, 단일 resolver 재사용, typed instance/provenance 요약, 입력/경로/fan-out 유한 예산.
- `src/domain/resources/resource-target-kpi.ts`: `calculateResourceTargetKpi`, `projectResourceKpiTargets`, `RESOURCE_TARGET_KPI_DICTIONARY`; node별 raw union totals 및 sourceKinds, projectReference.total 참고와 선택전체 및 서로 다른 미연결/무구역/공통/미매핑 진단.
- 기본 Target 예산: inputRows100000 / lineageEdges250000 / provenancePaths250000 / projectionCells50000. 초과는 `ResourceKpiTargetLimitError`, 상충·잘못된 참조/필터는 `ResourceKpiTargetInputError`; 공개 HTTP error mapping은 후속이다.
- `selectResourceTargetPlanScope(prepared, selection?)`는 capacityResourceIds/selectedAssignments/fullProjectAssignments를 기존 ResourcePlan에 전달하며 Target/task 조건으로 R 및 같은 R의 전체 Project 부하를 줄이지 않는다.

## DOCUMENTATION_SYNC
- `AGENTS.md`: N/A(실행 지침과 신뢰 및 승인 정책 변경 없음)
- `DESIGN.md`: N/A(화면 및 공통 시각 언어 변경 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(화면 interaction 및 접근성 변경 없음)
- `docs/PROJECT_UX.md`: N/A(사용자 화면과 Gantt 인스턴스 변경 없음)
- `docs/TASK_EDITOR.md`: N/A(Target 작성 UI는 별도 Issue 618 범위)
- `docs/API.md`: N/A(HTTP endpoint 및 공개 DTO 변경 없이 pure domain typed contract만 확장)
- `docs/DB_SCHEMA.md`: N/A(영속 schema와 migration 및 Assignment 원장 변경 없음)
- `docs/SECURITY.md`: N/A(권한 Origin session revision 및 조회 경계 변경 없음)
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/SCHEDULING_ENGINE.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/LOGISTICS_TARGETS.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/TARGET_RESOURCE_ROLLOUT.md`: UPDATED
- `docs/exec-plans/active/ISSUE_619.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: N/A(기존 물류 영속 모델과 설계 변경 없이 Target 계약 문서의 집계 절 확장)
- `docs/EXCEL_EXPORT.md`: N/A(Excel 공개 및 snapshot selector 연결은 후속 Issue 622)
- `docs/IMPORT_SCHEMA.md`: N/A(Import 형식과 유실 차단 계약 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(외부 교환 형식 및 Copy Template 계약 변경 없음)
- `docs/DEPLOYMENT.md`: N/A(컨테이너와 운영 데이터 배포 변경 없음)
- `docs/CI_CD.md`: N/A(기존 minor version 정책 준수 및 CI 릴리스 정책 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 원격 필수 회귀 유지 및 실행 상태는 본 원장에 기록)
- `docs/GITHUB_OPERATIONS.md`: N/A(GitHub 운영 권한 및 required checks 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(최신 OWNER_MANAGED 정책 준수 및 정책 자체 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(Lifecycle 승인 및 단계별 gate 변경 없음)

## AC_TEST_COVERAGE

신규 golden/property suite는 `tests/domain/resource-target-kpi.test.ts`, 합성 fixture는 `tests/fixtures/resource-target-kpi.ts`다. 기존 `logistics-targets.ts` F0 case ID와 `resource-kpi-integration.ts` #530 기대값을 재사용한다.

- AC1: 기존 resource-kpi 및 resource-kpi-integration fixture의 Target 없는 출력 backward regression.
- AC2: Target·Group·Resource projection 순서별 같은 scope의 raw Task/Assignment 집합과 Grand Total property 검증.
- AC3: 5근무일100% A5/B5/선택전체5, 공동담당7.5, 복수 Group·Target 중첩 소계와 원시합 golden 검증.
- AC4: ACS-only subset·같은 binding/member 긍정/부정, legacy Target 미연결/직접 instance, 공통/WorkArea 없음/legacy 미매핑 및 empty/null/partial/T0/A 검증.
- AC5: Resource Calendar 예외·미설정 M/M·progress 변화의 계획 공수 불변, full Milestone Ready/Blocked 및 Plan R/전체 Project load 보존 회귀.
- AC6: 정확 중복 입력·순열의 결과 동등, 동일 ID 상충 payload 명시 거부, fan-out 예산 초과 오류 및 절삭 결과 부재 검증.
- AC7: typed domain 입력/출력 및 KPI 사전·분모·출처·원시 ID, DOCUMENTATION_SYNC 및 Markdown 링크 검증.

## 위험도 및 QA·릴리스
risk_level: HIGH
risk_reason: 지표 정합성 및 중첩 소계와 같은 binding 개인 필터 분모 보존
qa_required: true
qa_method: OWNER_MANAGED
reviewer: /root/qa (실제 별도 read-only 사전 Agent 검토)
independent_qa: N/A(Owner-managed 운영 경로이며 별도 인간 승인 수행 주장 없음)
manager_decision: NOT TESTED
release_required: true
release_authorized: false

최신 main #598 정책을 적용한다. 사전 Agent 검토는 인간 QA 영수증/Trusted QA/Owner 병합 허가 또는 최종 Manager ACCEPT가 아니다. 필수 최신 Head/base Quality/E2E/Docker·Trusted QA 및 Owner의 HIGH 범위별 잔여 위험 수용 이전 MERGE_READY=BLOCKED다. 신규 버전 준비가 발행 승인은 아니다.

## 검증 원장 및 후속

- Local Fast Feedback: PASS인 실행과 최종 후보 재검증을 구분한다. Manager `npm run version:check`, `node scripts/check-markdown-links.mjs` 211 files, version regression `tests/scripts/verify-release-version.test.ts` 7 tests 및 `git diff --check` PASS. package/lock 세 version 값 이외 dependency graph diff=0.
- 구현 담당 초기 focused 실행: 신규 Target suite35 tests, 기존 KPI/Plan 포함3 files78 tests PASS. 이후 #530 직접 fixture 확장 및 coverage 반례 보강을 포함한 최종 후보 재검증은 아래에 별도 기록한다.
- 별도 qa_docs 기존 회귀: KPI 단위/projection/integration·Plan 단위/budget/periods·F0/F3·실제 native SQLite KPI compatibility/integration,10 files166 tests PASS, exit0. 첫 검증 source `resource-kpi.ts` SHA256 `7b343f3918ee0cfe2903a72e12a1c832b8db0d4679d4575f8ad97cda82229358`; source 불변일 때만 재사용한다.
- 별도 qa_docs 반례: nonfinite coverage/null 양순열, member owner 상충, 같은 member/type/instance 및 Equipment+System binding, linked legacy와 실제 미연결 분리, 역추론 금지, empty A/T0/전체참고/R 및 known0·unset M/M16 cases와 추가 budget 경계4 cases, 총20 cases PASS. 단일 전체 테스트 실행건수로 합산하지 않는다.
- DOCUMENTATION_SYNC: 구조 검사 PASS. main의 `qa_final_automated.docs_gate`로 required docs 합집합과 AC1~AC7 mapping을 실제 검증했다. 별도 qa_docs의 최종 코드/문서 대조에서도 typed 입력/출력·분모·출처와 문서 정합성을 확인했다.
- 사전 검토 보완: nonfinite와 null의 JSON 비교 충돌을 구조 비교로 교정, Target member ID의 전역 owner 상충 거부, 같은 kind instance/type hierarchy 경로 축소, linked Task의 독립 legacy instance 경로 보존 및 node sourceKinds/실제 unlinked 분리, 실제 전체 Project 참고 수치와 같은 R Plan 참고 구분, Target usage의 전체 Task 반복 검색을 인덱스 순회로 교정했다.
- 최종 구현 후보 LFF: `npm run typecheck` PASS, 신규/변경 TS5파일 scoped ESLint0 errors/0 warnings PASS, 신규 Target37 tests 및 기존 KPI/Plan 포함3 files80 tests PASS 이후, unused 의미 보완 회귀1개를 추가한 최종 신규 suite38 tests 및 기존 KPI/Plan 포함3 files81 tests PASS. Typecheck·scoped ESLint0 errors/0 warnings도 보완 뒤 다시 PASS. #530 raw11.5·T1 A7.5/B7.5/전체7.5, F0-Q02 physical10과 coverage2/3의 비가산 의미를 직접 검증했다. 초기35/78 실행과 구분하며 기존166 회귀 및 version7 재사용을 단일 전수 실행으로 표시하지 않는다.
- 첫 사전 QA: tree `d3bb0c6d30694a1f2b50fdb05c65d16c4506795e`의17파일 및 source 동일성·AC1~AC7·문서 의미 PASS. 이후 게시 전 self-review의 unusedTargetIds 의미 보완은 별도 재검토한다. 일반 Task0건만으로 Summary/Milestone 참조를 미사용으로 판정하지 않으며 세 종류 참조가 모두0일 때만 unused다.
- 최초 실패 이력: 초기 focused78건 중1 FAIL은 `structuredClone`이 WorkingCalendar 내부 Symbol 메모 필드를 제거해 입력불변 oracle가 잘못 비교한 테스트 문제였다. JSON 직렬화 기준으로 교정했고 Domain mutation은 발견되지 않았다. 초기 typecheck의 never narrowing/readonly test 배열 오류도 수정 후 PASS다. 실패를 공식 CI 또는 현재 PASS로 소급 변환하지 않는다.
- 게시 인증: 로컬 commit `2ac855e3c745c09b6e01d06f5de25a591519b7d0`의 Git push는 invalid username/token으로 실패했다. 연결된 GitHub Git Data API로 동일 blob/tree를 검증해 게시할 예정이며 토큰/Secret 및 권한 정책을 변경하지 않는다.
- 별도 Agent 최종 사전 검토: unused 보완 뒤 최종 source/tree 결속 확인 대기. 원격 QA_FINAL 및 Manager ACCEPT는 NOT TESTED다.
- GitHub Quality/E2E/Docker 및 Trusted QA: NOT TESTED (이번 요청은 시작 확인까지만).
- 운영 DB·실제 Target 편집/새 분석 UI·Excel·배포 환경: NOT TESTED / 후속 범위.
- 남은 단계: 최종 source/tree 사전 검토 결속 → 최신 main 정렬·단일 PR·리뷰 스레드 확인/처리 → exact Head full CI 시작 확인.

## 2026-10-14 — PR #677 / CI #2728.1 실패 후 REWORK

- 원본 run: `38495077702`, attempt1, head `50c3af487da5254ed56bba58a2130c887ee91aca`, base `96c6c74b304f1ccd09f7340f37ebf0b0c393ae3b`. Quality(정책·Typecheck·Vitest·Lint·Next build)와 Docker Smoke PASS. Chromium E2E required FAIL → QA Final Automated FAIL(독립적인 원인 아님).
- E2E shard4/6: `tests/e2e/milestone-timeline-lane.spec.ts:173`의 #551 대량 Timeline readiness/exact SVAR API identity 확인 5s `expect.poll` timeout. 기존 UI/Gantt E2E이며 #619 변경 파일에 Timeline/UI 구현은 없다. 원인은 readiness 지연/회귀/runner 부하 중 미확정. 성공으로 간주하거나 시간 제한을 임의 상향하지 않는다.
- E2E shard5/6: `tests/e2e/project-resource-calendar-persistence.spec.ts:60`에서 저장 이후 `GET /work-calendar` 중 `apiRequestContext.get: read ECONNRESET`. 직전 PUT 및 canonical GET은 200; 서버 연결 reset의 직접 원인은 로그만으로 미확정. 기존 Calendar E2E이며 #619은 Calendar/UI/API를 변경하지 않았다. 요청 단언 삭제/무조건 재시도 금지.
- PR inline review P2: `resource-kpi-targets.ts`가 F3 resolver validation `TaskTargetResolutionError`를 외부로 그대로 반환하여 명시한 `ResourceKpiTargetInputError` 계약 불일치. F3 error `code`를 KPI 경계에서 typed input error로 변환하고, 예상하지 못한 예외 및 KPI 예산 오류는 그대로 전파한다. invalid scope/whole member/subset/member ownership/subtree/legacy scope 반례 중 resolver 통과 경로에 대한 회귀를 추가했다.
- AC6/AC7 및 DOCUMENTATION_SYNC: 기존 KPI 계산·Target 필터/원시 grain/Calendar/Timeline 외 기능을 변경하지 않고 입력 오류 API의 의미만 구현 계약과 일치시킨다. `docs/RESOURCE_KPI_DASHBOARD.md`의 invalid snapshot typed error 계약은 유지. 새로운 원격 exact-head PR 전체 CI로 E2E 6/6와 required Quality/Docker를 다시 확인해야 한다.
- 원격 재검증 전 `PASS`는 금지: 이 기록은 실패 원인 분류 및 원격 후속 필요성의 증거이고 실제 E2E 안정성/QA 승인 근거가 아니다. HIGH/OWNER_MANAGED, `manager_decision=NOT TESTED`, `release_authorized=false`; 병합·Main/GHCR·Issue 종료 범위 밖.
