# Issue #852 — Gantt 날짜축 확장·Grid 시작점 탐색 회귀 복구

Primary Issue: https://github.com/planner77/masterGantt/issues/852
기준 main: `de36ff9f3192f47f79a67f8fccc617df9bd024dd`, application `0.138.1`, SVAR Core `2.7.3`.
branch: `fix/issue-852-gantt-navigation`; 후보 PATCH `0.138.2`.
risk_level: HIGH; qa_required: true; qa_method: OWNER_MANAGED; manager_decision: NOT TESTED.
release_required: true; release_authorized: false.

승인 범위는 분석·설계·구현·문서·실패 원장·미해결 리뷰/충돌 처리 후 Ready PR Full CI 시작이다. CI 완료 모니터링·병합·Main/GHCR·tag/Release·Issue 종료는 수행하지 않는다. 버전 변경은 정식 게시 승인이 아니다.

## 분석·설계

- #367 반복 미래 날짜 탐색과 #514 Grid 시작일 탐색을 같은 이슈에서 다루되 각각 실제 실패를 재현한다. #571/#666/#667 단일 Viewport Coordinator·Axis Transaction·현재 제품 wiring을 유지한다.
- 일반 Grid 좌클릭은 선택한 날짜 있는 Task의 시작점을 Chart 왼쪽에 배치한다. 이미 왼쪽 한 셀 이내라면 그대로 둔다. Day 36px/Week 68px의 기존 셀 폭을 사용하고 실제 geometry로 허용치를 확인한다. 화면 안 오른쪽에 있다는 이유만으로 정렬을 생략하지 않는다.
- Context Menu `show:false`, modifier/checkbox/keyboard selection, native mirror, Editor locate는 일반 Grid 클릭과 구별한다. canonical start가 null인 항목에 Core의 가짜 날짜를 적용하지 않는다.
- 반복 확장은 Core 실제 end·헤더·native capacity 증가와 X/Y 보존을 확인한다. 요청 end나 `api.exec` 반환을 정착 성공으로 쓰지 않는다. 새 사용자 gesture/명시 reveal이 오래된 확장·복원보다 우선하며 두 번째 scroll writer·DOM 쓰기·remount·private store를 도입하지 않는다.
- 읽은 기준: AGENTS, DESIGN, REQUIREMENTS/ARCHITECTURE/API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/TEST_PLAN/REMOTE_VALIDATION/CI_CD/GITHUB_OPERATIONS/ISSUE_LIFECYCLE/QA_REVIEW_POLICY, PROJECT_UX/UI_UX_GUIDELINES/GANTT_ADAPTER_ADR/GANTT_STATE_CONFORMANCE 및 활성 PLAN. 실제 설치 버전과 공개 API 계약을 대조한다.

## 역할·검증 경계

Manager는 통합·문서·실패 원장·GitHub 인계를 소유한다. 별도 ui_ux는 read-only 설계, frontend는 Gantt 코드·기존 회귀 확장, qa_docs는 분리된 read-only 사전 검토를 담당한다. 초기 PLAN 댓글의 AGENT 표기는 현행 #598 기본 OWNER_MANAGED 정책 확인 후 본 문서에서 정정한다. 독립 에이전트 사전 검토를 인간 GitHub APPROVED 영수증이나 QA_FINAL/Owner ACCEPT로 격상하지 않는다.

현재 PR Required3·8-shard Chromium·default-branch Trusted QA·Owner HIGH 위험 수용은 NOT TESTED다. 실제 운영 기기/사용자 프로젝트, 최종 수동 UX, Windows/스크린리더는 별도 NOT TESTED다.

## TEST_LIFECYCLE_REVIEW

- EXTEND: `tests/e2e/grid-task-start-reveal.spec.ts`의 앞/뒤·화면 내부 오른쪽·near-left 반복 선택, 기존 `tests/e2e/project-gantt-scale.spec.ts`/`viewport-coordinator.spec.ts`의 반복 확장·경합, `tests/features/gantt/timeline-range.test.ts`/`svar-viewport-port.test.ts`와 관련 reveal/axis 단위를 우선 확장한다.
- KEEP_UNIQUE: Context Menu `show:false`, Ctrl/Meta/Shift·keyboard·null start, Editor locate, 사용자 입력 우선권, peer/filter/scale/fullscreen·동일 인스턴스·mutation 0은 각기 다른 소비자 경계다. 단위 성공으로 실제 Core/DOM Chromium을 대체하지 않는다.
- ADD는 기존 seam에 해당 AC가 없는 경우에 한정한다. skip/assertion 약화·retry/timeout 증가·새 중복 E2E 복제로 통과시키지 않는다. 실제 실행 결과와 미실행 범위는 아래와 단일 실패 원장에 기록한다.

## AC_TEST_COVERAGE

- AC1: 기존 scale/Coordinator Chromium에서 Day 미래 구간을 3회 연속 확장하고 실제 Core end/native scroll capacity를 확인한다.
- AC2: 같은 기존 Chromium 경로에서 Week 3회와 Task 없는 미래 구간의 실제 날짜·바 좌표를 확인한다.
- AC3: Coordinator/axis 단위 및 Chromium에서 X/Y·selection/tree/columns/split/scale/filter와 동일 인스턴스 보존을 확인한다.
- AC4: grid-task-start-reveal Chromium과 reveal target 단위에서 실제 Task 시작점 X·Chart edge·전후 scrollLeft를 측정한다.
- AC5: 앞/뒤·화면 내부 오른쪽·near-left 재클릭을 기존 reveal 회귀에 확장하고 end/today 오대상 이동을 금지한다.
- AC6: 기존 root/nested·readonly/editable·Day/Week·normal/fullscreen·scope/filter/peer 소비자의 영향 범위와 실제 실행 여부를 구분한다.
- AC7: 기존 Context Menu·modifier/keyboard·Editor locate 및 canonical null start 음성 회귀를 보존한다.
- AC8: Coordinator 단위 및 기존 Chromium의 pending extension/reveal·후속 wheel/filter/peer 입력 우선권을 확인한다.
- AC9: 기존 request 관측과 diff 검토로 Task/Link/Calendar/SQLite/REST revision·session/If-Match/Export 변경 및 탐색 mutation이 없음을 확인한다.
- AC10: 설치 Core2.7.3·기준 SHA·before/after Chromium·관련 단위·실패 원장·문서 동기화를 기록하고 원격 Full Required3/Trusted QA는 CI 시작 후 NOT TESTED로 인계한다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_852.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/ISSUE_852_FAILURE_ANALYSIS.md`: UPDATED
- `docs/evidence/issue-852/manifest.json`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GANTT_ADAPTER_ADR.md`: UPDATED
- `docs/GANTT_STATE_CONFORMANCE.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `DESIGN.md`: N/A(기존 작업면 우선과 시각 언어를 재사용하고 공통 색이나 레이아웃을 변경하지 않음)
- `AGENTS.md`: N/A(기존 역할과 단일 Coordinator 및 권한과 QA 지침을 변경하지 않음)
- `docs/UI_UX_GUIDELINES.md`: N/A(공통 interaction과 접근성 지침을 재사용하고 화면별 시작점 계약만 PROJECT_UX에 반영)
- `docs/API.md`: N/A(날짜축과 선택 탐색은 클라이언트 표시 동작이며 REST 계약을 변경하지 않음)
- `docs/DB_SCHEMA.md`: N/A(SQLite 스키마와 migration 및 저장 데이터를 변경하지 않음)
- `docs/ARCHITECTURE.md`: N/A(기존 단일 Coordinator와 port 및 axis transaction 경계를 유지)
- `docs/SCHEDULING_ENGINE.md`: N/A(일정 계산과 Calendar 및 Dependency 알고리즘을 변경하지 않음)
- `docs/SECURITY.md`: N/A(Origin과 세션 및 If-Match 권한 검증 계약을 변경하지 않음)
- `docs/CI_CD.md`: N/A(기존 PATCH 정책을 적용하며 workflow와 릴리스 검증 절차를 변경하지 않음)
- `docs/REMOTE_VALIDATION.md`: N/A(Required3와 원격 전체 회귀 및 환경별 검증 지침을 그대로 유지)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 Issue와 PR 및 release 권한과 원격 운영 지침을 유지)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 PR CI 시작 인계와 병합 및 완료 gate를 유지)
- `docs/QA_REVIEW_POLICY.md`: N/A(현행 OWNER_MANAGED와 Trusted QA 및 Owner 최종 승인 경계를 유지)
- `docs/PR_CI_FAILURE_TRIAGE.md`: N/A(지침 변경 없이 Issue852 단일 원장에 실제 실패와 미실행을 기록)

## 실행 결과·리뷰·인계

최종 동결 제품4개 파일·E2E/Unit2개 파일에서 관련 Unit4파일194/194 PASS, 기존 Grid Chromium spec23/23 PASS 약1.3분, 연속 입력3case×3회9/9 PASS31.0초, typecheck PASS, 관련 ESLint 오류0/기존 Hook 경고3개, diff check PASS다. 별도 qa_docs `/root/review`의 source·회귀 사전 검토 PASS/미해결 차단 지적0이며 인간 GitHub 승인·QA_FINAL·Owner/Manager ACCEPT와 구별한다. ui_ux/frontend/qa_docs를 실제 분리 실행했고 실행 모델의 runtime 신원은 별도 검증하지 않았다.

[정제 manifest](../../evidence/issue-852/manifest.json)에 기준SHA·도구버전·6개 최종 source SHA256·원본 RED와 최종 Core/native 관측을 남겼다. Day 실제 Task 시작점은 Core/native left20248→20700, bar offset452→0px; Week5192→5644, bar offset452→0px이며 동일 svar-api-1을 유지했다. Day/Week 기본3회 end/capacity 증가, 확장 중 wheel과 최신 Grid 선택 우선권을 확인했다. 스크린샷4개는 **같은 최종 소스의 클릭 전/후**이며 변경 전 소스 화면으로 제시하지 않는다. 원본 변경 전 RED는 별도 before JSON의 해시·수치로 보존한다.

8개 root/nested·readonly/editable·Day/Week·normal/fullscreen 행렬과 기존5폭390/768/1024/1440/1920, Context Menu·modifier/keyboard/null·peer/filter 검증을 기존 spec 안에서 수행했다. 실제 Core/native Chromium과 mock canonical API 증거이며 Task/Link/Calendar 원장 mutation0·revision 유지와 모든 HTTP 요청을 혼동하지 않는다. 실제 운영 프로젝트/HTTP SQLite·Shift+세로 wheel·scrollbar drag/touch 중 동일 경합·최종 수동 UX는 NOT TESTED다.

새 PR 생성 전 최신 main 재조회 결과 기준SHA와 동일하고 충돌0이다. 원격 PR 생성 후 미해결 리뷰 thread·test merge와 CI 시작을 한 번 확인해 Issue STATUS에 인계한다. GitHub Full Quality/E2E8/Docker·Trusted QA/Owner 위험 수용·Manager ACCEPT는 NOT TESTED이며 CI 모니터링·병합·Main/GHCR·정식 게시·Issue 종료는 수행하지 않는다. [단일 실패 원장](../../ISSUE_852_FAILURE_ANALYSIS.md)에 최초·중간 FAIL과 비재현 PASS를 보존했다.
