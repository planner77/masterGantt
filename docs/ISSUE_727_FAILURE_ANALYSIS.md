# Issue #727 — 누적 실패·검증 경계 원장

새 PR 생성 전의 로컬 구현 원장이다. 원격 PR CI 실패를 관측한 기록은 없으며 이번 요청은 Full CI 시작까지다. 이 원장의 보완·Local PASS를 원격 Quality/E2E/Docker·Trusted QA·Owner ACCEPT로 바꾸지 않는다.

| ID | 관측 사실 | 분류·조치 | 재검증 상태 |
| --- | --- | --- | --- |
| L01 | 기존 gh CLI로 Issue 조회 HTTP401 Bad credentials | 인증 환경. 기존 자격증명을 추출/교체하지 않고 허용된 GitHub connector로 원문/댓글 조회 성공. 일반 git fetch read 성공 | connector read PASS; gh auth는 미변경 |
| L02 | 최초 복사 node_modules의 Next16.3.4가 pinned16.3.8과 불일치 | 환경 준비. 이 worktree의 생성 의존성만 교체하고 Next16.3.8/React19.3.0/better-sqlite3 13.0.3/Playwright1.63.0 및 native SELECT1 확인. 초기 typecheck/개발 서버를 최종 pinned 증거로 사용하지 않음 | pinned typecheck/관련 SQLite·HTTP·Chromium 재실행 PASS |
| L03 | backend 최초9개 중 Template fixture ownerName 누락 TypeError1건 | 테스트 준비. 지원 Template 입력의 필수 ownerName을 실제 계약대로 보완. 최초8 PASS/1 FAIL 보존 | 보완 후 관련 테스트 PASS |
| L04 | frontend 모델 unit의 alias import 준비 오류·Chromium selector 오타·readonly strict selector·오류 표시 중 숨겨진 radio 단언 | 테스트 준비. 실제 source 모듈 경로와 유효 selector·의도된 오류 화면의 초안 보존 기대값으로 교정. 제품 동작 PASS로 해석하지 않음 | 보완 후 관련 테스트 PASS |
| L05 | 성공 등록 뒤 pending 중 비활성 trigger로 focus 복원이 사라짐 | 실제 UI 결함. busy 해제 뒤 연결·가시 trigger에 focus 복원하도록 보완. 새 사용자 입력과 hidden/unmount를 구분 | 5폭을 포함한 combined13/13 PASS |

| L06 | backend55/57: 새 table 예상 목록 누락·pending migration3→4 불일치; 후속57/59: 새 index 예상 누락·legacy role fixture의 boolean isPrimary | 테스트 migration 기대값/fixture.0028의 실제 table/index·pending 순서·numeric 역할 계약을 반영하고 기존 checksum/FK/원본 보존 단언 유지 |5파일60/60 PASS; 강화 후 membership13개 포함 개별 PASS |
| L07 | 인접 backend12파일141/142: logistics-targets-acceptance의 MAX(version)27 기대/실제28 | 테스트 migration 기대값. 신규0028을 정확히 기대하도록 교정; 기존 drift/rollback 검사 유지 | corrective2파일21/21 PASS; 최종 고유16파일191case 개별 PASS |
| L08 | native Chromium fixture의 Project 필수 description 누락·합성 editPassword 길이 오류 | 테스트 준비. API의 실제 create 입력·비밀번호 길이 계약으로 fixture 교정, 제품 gate 유지 | 실제 SQLite·reload/restart·정확 Assignment Editor·dirty와 양수 scroll 보존 PASS |
| L09 | 두 Playwright 호출이 같은 outputDir를 동시에 사용하여 ENOENT·context.close 오류 | 로컬 실행 orchestration. 단일 합성 batch로 직렬 실행; 제품 assertion 실패로 오인하지 않음 | combined13/13 PASS(unexpected0/flaky0/skipped0), 강화된2/2 PASS |

| L10 | 최종 로컬 증거 정리 중 기존 tracked output까지 임시 보관하여 Markdown 링크 확인이 FAIL | 실행 정리 오류. 전체 tracked output을 즉시 원래 경로에 복원하고 신규 untracked 산출물만 Git 밖으로 분리. 최종 diff에 기존 증거 삭제0 | Markdown255문서 링크·diff 확인 PASS |

## 사전 검토에서 확인한 경계와 보완

- Summary/Milestone의 개인 Assignment는 일반 type=task 개인 배정 인원/공수와 다른 책임 참조다. 목록에서는 모든 기존 사용을 보존하되 counts/filter/source를 분리하고 사용중 해제 보호에는 모두 포함한다.
- 후속 membership GET만으로 실패한 canonical refresh의 stale 쓰기 잠금을 풀지 않는다. host revision과 목록 revision이 일치하고 canonical 확인이 성공해야 새 쓰기를 허용한다.
- Group 필터 후보는 현재50명 page에서만 수집하지 않는다. 서버가 독립 bounded 후보를 제공한다.
- 리스트 page/usage/응답·Template 참조/Copy·global 삭제·미지원 일정 교환에 유한 상한과 오류·rollback을 적용한다.

최종 명령·고유 case 수·최종 source와 별도 사전 검토는 [Work Packet](exec-plans/active/ISSUE_727.md)의 원장에 추가한다. 실패·환경 차단을 제거하거나 기존 실패를 소급 PASS로 재분류하지 않는다.

## 최종 사전 검토 추가 보완

기존 명시 `includeResourceEffort=true` 견적 Excel이 신규 membership-only loss guard에 함께 차단되는 회귀를 발견했다. membership guard만 두 명시 Resource 보고서(legacy 견적 또는 resourceDashboard)를 허용하도록 좁히고 일반 일정 Excel 차단 및 TaskTarget의 기존 guard는 유지한다. 실제 workbook의 기존0.8M/D 상세 XML 동일성과 등록-only 사람 미산입, R=1·plain409·Target+legacy409를 새 native 테스트로 검증한다. 이 보완 전 소스의 성공 결과를 보완 후 원격 PASS로 사용하지 않는다.

저장 응답유실·409/412/5xx/성공 envelope 오류·canonical refresh 실패에는 별도 explicit-refresh latch를 추가했다. 검색/필터를 바꾼 membership GET만으로 쓰기를 다시 열지 않으며 활성 복구 버튼으로 canonical 확인을 성공한 뒤에만 해제한다. canonical 실패 후 비활성 등록 trigger 대신 활성 복구 control로 focus를 전달한다. 최종 강화2개 Chromium 검사(실제 양수 scroll·결과불명/검색잠금/복구 focus)는2/2 PASS다. 기존 #724 exact-screen 테스트도 새 프로젝트 등록 host/별도 전역 관리자 링크로 계약을 갱신한다.

최종 UI primary-button 재사용 뒤 기존5폭5/5 PASS(24.4s)와 최종 screenshot/geometry를 갱신했다. 초기 실패는 위 원장에 보존하며 고유 시나리오를 반복 실행 수로 늘리지 않는다.

마지막 사전 검토의 역할0/1×5폭 조합 미검증을 보완했다. 제품 코드는 그대로 두고 기존 synthetic fixture의 역할0/1/3개를 분산한 동일5폭5/5 PASS(23.3s)를 확인했다. 최종 캡처/geometry 및 해당 테스트의 SHA256만 갱신했으며 과거 최대역할5폭 실행과 구분한다.

## 통합 후 추가 검토·해결 기록 (2026-10-18)

| ID | 관측 사실 | 원인/조치 | 새 source 검증 상태 |
| --- | --- | --- | --- |
| R01 | PR #739 inline P2: 미등록 Resource가 기존 Task 배정/책임 역할에 사용 중일 때 DELETE가 409로 거부됨 | `mutate()`가 membership 존재 확인보다 `inUse()`를 먼저 호출함. 동일 transaction에서 명시 관계가 실제 있을 때만 in-use guard를 적용하고, 미등록 상태 DELETE는 changed=false/프로젝트 revision 불변. 기존 등록 사용자 해제 차단을 보존하도록 회귀 단언 추가 | 정적 경로·test 계약 확인. 통합 후 로컬 DB/Vitest는 NOT TESTED, 원격 새 Full PR CI 예정 |
| R02 | 새 main에 #725 `0028_process_context.sql`이 이미 적용됐으나 #727도 `0028_project_resource_memberships.sql` 사용; `package.json` 버전도 양측0.118.0 | migration 파일 버전 중복은 부팅 `Migration sequence` 검증 실패/기존 0028 checksum 충돌. main 0028 원형 보존, #727 별도 0029로 이동. 기존 migration 관련 테스트6개·신규 #727 테스트 및 DB/API/TEST_PLAN 문서 정렬, #727 후보0.119.0으로 조정 | 정적 인덱스·버전 일치 확인. 기존 0.118 로컬 증거를 통합 tree 검증으로 승격 금지; remote Required3/Trusted 결과 미확인 |
| R03 | #725와 #727이 Copy/Template/Export·Import·Project 탭·문서/테스트 다수를 병행 수정 | main을 기준 tree로 유지하고 #727 고유 변경 및 양쪽의 다른 API/용어/유실 차단 규칙을 함께 병합. 기존 main 코드를 소거하지 않고 충돌 지점마다 내용 보존을 우선 | text-level 병합만 확인. TS/typecheck, 회귀·DB migration 검증은 새 CI에서 확인 필요 |

CI 결과 미관찰 상태를 과거 SUCCESS로 표시하거나 로컬 미실행을 PASS로 표시하지 않는다.


## Issue #727 / PR #739 — 원격 CI 누적 실패 백필 및 REWORK (2026-10-18)

원장 단일 원본: `docs/ISSUE_727_FAILURE_ANALYSIS.md`. 이전 로컬 L01–L10과 정렬/리뷰 R01–R03은 위에 원본 그대로 보존한다. [공통 누적 분석 지침](PR_CI_FAILURE_TRIAGE.md)과 AGENTS.md의 “전체 Run/Attempt 선조회 → 과거 원장 대조 → 실패 합집합·교차 검증 → 변경 묶음 게시”를 따른다. 최초 CI #2958.1을 확인하지 않은 채 최근 #2973.1 오류 두 개만 수정하지 않는다.

### 전체 원격 실행·source provenance

| CI·이벤트·시각 (UTC) | Run의 출처 (정확한 Head/Base/Test merge) | 실제 최초 FAIL/Jobs | 성공/파생 FAIL/취소·미실행 |
| --- | --- | --- | --- |
| [CI #2958.1](https://github.com/planner77/masterGantt/actions/runs/39110279370) · `pull_request` · 2026-10-18 08:08:09 시작 | head `192b4f6226dd7105624d6c5a6fd0c36fce7bb3c7`; base `ea4194763568432ef98e823bb796b59a5beb317c`; test merge `997882d900d73290079982351624dab60d33a158`; `ci-pr-source-39110279370-1` artifact로 확인 | E2E Chromium shard5 [Job 117625120254](https://github.com/planner77/masterGantt/actions/runs/39110279370/job/117625120254), `project-workspace-tabs-518.spec.ts` FAIL | policy/preflight/typecheck/lint/Unit/Next build, Required Quality 및 Docker SUCCESS. E2E shard5 50 PASS/1 FAIL/33 NOT RUN; shard1/2/3/4/6 CANCELLED (다섯 shard를 PASS로 셈하지 않음). Required E2E FAIL, QA Final required-E2E 파생 FAIL |
| [CI #2973.1](https://github.com/planner77/masterGantt/actions/runs/39127471543) · `pull_request` · 2026-10-18 12:29:12 시작 | head `4ea0d824c426e8378d5de45749660852278a666b`; base `4ce564a8d9ec646ba584a585a610537f14698476`; test merge `2e5311b7c03501fd8e95529b4bb73db5171ea794`; `ci-pr-source-39127471543-1` artifact로 확인 | Unit/Vitest [Job 117675637352](https://github.com/planner77/masterGantt/actions/runs/39127471543/job/117675637352) 2 FAIL / 2,962 total | Vitest 2957 PASS/2 FAIL/3 SKIPPED, 파일233 PASS/2 FAIL/1 SKIPPED; policy/preflight/typecheck/lint SUCCESS. PR Fast Gate FAIL, production build·E2E6·Docker 실제 Job **SKIPPED**. Required Quality/E2E/Docker 모두 파생 FAIL 및 QA Final FAIL. E2E/Docker의 독립 실행 실패 증거 없음 |

원격 Run별 attempt=1. 두 개 Full Run 외 추가 rerun attempt는 확보한 PR 커밋별 workflow 기록에 없었다. 예전 #2958 원본 API의 가변 `pull_requests[].base` 대신 *당시 실행 artifact*의 base 값을 사용한다.

### 실패 파일·원인 유형별 교차 매트릭스

| 실패 ID | 원본 테스트·관찰 | 분류 / 과거 이력과 연결 | 원인 및 조치 |
| --- | --- | --- | --- |
| F727-001 (#2958.1, shard5) | [`tests/e2e/project-workspace-tabs-518.spec.ts:79`](../tests/e2e/project-workspace-tabs-518.spec.ts): `dashboardTab.toBeFocused()` 예상, 실제 inactive (5초). Error Context/Playwright `playwright-report-shard-5` trace 확인: 상위 일정 탭에 focus 뒤 ArrowRight 전 `screen=dashboard.milestones`, 이후 `screen=dashboard.process`로 의도치 않게 전환. 첫 390px 폭에서 실패 | **PRODUCT / FOCUS·상태**. 기존 R03의 #725/#727 host 통합과 L05 focus 복구·L09 E2E 실행 이력을 교차 검토. 이 실패를 flaky/환경이라고 확정하지 않음 | `selectSection`이 현재 활성 dashboard 아래 Milestone 뷰를 버리고 `lastSectionScreens`의 오래된 process 뷰로 바꾸어 focus 상태 손실. 현재 section의 상위 탭 ArrowRight는 activeScreen을 유지하고, 직접 drill/setActiveView 경로의 마지막 subview 참조도 `useEffect`로 동기화. E2E 기존 5폭(390/768/1024/1440/1920)·3px ring·Gantt instance·scroll/읽기 전용 단언 그대로 보존하면서 현재 URL `dashboard.milestones`/하위 탭 selected/dashboard ready를 추가 검증 |
| F727-002 (#2973.1 Unit) | [`tests/server/process-catalog/process-context-service.test.ts:219`](../tests/server/process-catalog/process-context-service.test.ts): schema max version **expected 28 / received 29** | **TEST_CONTRACT**. 기존 L06/L07, R02의 #725 migration 0028 / #727 migration 0029 정렬 후 **다른 테스트**에 남은 구 기대값 | DB migration 파일·checksum과 제품 상태 변경 금지. 테스트에서 최신 0029 이름/version, 직전 0028 process-context를 함께 직접 검증. 기존 old DB 작업 행·WorkArea link·restart/foreign key 보존 assertion 제거·skip 없음 |
| F727-003 (#2973.1 Unit) | [`tests/server/resources/project-resource-memberships.test.ts:171`](../tests/server/resources/project-resource-memberships.test.ts): `expect(...DELETE...).toThrow("책임")` 예상, 실제 아무 예외 없이 완료 | **TEST_CONTRACT**. 기존 R01의 합의된 no-op 수정이 **Milestone role-only/미등록** 테스트에 반영되지 않음 | 미등록·이미 책임참조 존재 Resource의 DELETE를 `changed=false`/revision 불변으로 단언. 같은 리소스를 **명시 등록**한 다음 DELETE는 기존 `409/책임` 차단, 등록 보존 및 revision 불변으로 별도 검증. 제품의 멱등성과 사용중 보호를 동시에 지키며 제품 정책을 오류로 되돌리지 않음 |

- F727-001 원본 [실패 Job](https://github.com/planner77/masterGantt/actions/runs/39110279370/job/117625120254) 로그 및 원본 shard5 artifact에는 error-context.md/trace.zip이 있고, 본 분석에서 artifact를 읽어 실제 화면 전환을 확인했다. 비밀/대용량 Trace/HTML/raw 로그를 Git에 추가하지 않는다. `CI #2958`의 cancel 5개 shard에는 원본 로그상 별도 확정 FAIL은 식별하지 못했으나, **미완료 범위**를 PASS로 승격시키지 않는다.
- F727-002와 F727-003이 나타난 `#2973`은 빠른 Unit Gate가 heavy jobs를 막았으므로 과거 F727-001의 재발 여부는 **UNKNOWN/NOT RUN**이다. 그 뒤 QA Final은 실제 downstream required 실패를 반영한 파생 결과다.
- 기존 L01(gh CLI 인증), L02(Node/Next 의존성), L03 fixture, L04 selector, L05 focus, L06/L07 migration oracle, L08 mock setup, L09 Playwright outputDir 경쟁, L10 tracked evidence 복원과 R01–R03(리뷰·migration·병렬 main 통합)을 원문대로 유지한다. F727-002/003은 R02/R01의 보완 후 인접 테스트 누락이고, F727-001은 #724/host의 새로운 직접 E2E FAIL이며 이전 CI 실패를 삭제/소급 PASS로 수정하지 않는다.

### 누적 검증 대상, 제외·잔여 및 재검증 상태

- **직접 실패 3파일 합집합:** `tests/e2e/project-workspace-tabs-518.spec.ts`, `tests/server/process-catalog/process-context-service.test.ts`, `tests/server/resources/project-resource-memberships.test.ts`.
- **직접/인접·교차:** `tests/e2e/project-workspace-ux.spec.ts`, `tests/e2e/project-resource-memberships-ui.spec.ts`, `tests/e2e/project-resource-memberships-persistence.spec.ts`; `tests/server/db/database.test.ts`, `tests/server/db/issue-623-target-migration.test.ts`, `tests/server/migration-cli.test.ts`, `tests/server/logistics/{logistics-targets-acceptance,task-target-bindings}.test.ts`, `tests/server/process-catalog/process-catalog-service.test.ts`. **음성:** 활성/비활성, 미등록 no-op, 등록/사용 중 409, Project revision rollback, legacy DB→0029, FK, Gantt viewport/keyboard 5폭·focus.
- **실행 환경/결과:** 연결된 작업 환경에서는 전체 checkout/의존성 및 원격 앱 실행 컨테이너에 접근할 수 없어 이번 수정 source의 `npm test`·Playwright·SQLite·Docker는 **NOT TESTED**. 원격 로그와 Trace의 관찰, TypeScript 소스·테스트 diff의 정적 계약 대조만 수행. 새 소스에 대한 새 Full PR CI와 Trusted QA/Owner 승인은 실제 Run 시작/완료 증거 전 **NOT TESTED**다.
- **완화 금지:** assertion 삭제/skip/타임아웃 일괄 증가/CI Gate 우회 없이 원인-원장-회귀 한 묶음으로 보완한다. 수정 내용은 `project-readonly-view.tsx`, `project-workspace-tabs-518.spec.ts`, `process-context-service.test.ts`, `project-resource-memberships.test.ts`와 이 원장/Work Packet에만 반영. 새 PR CI 시작 후 모니터링·병합·Main/GHCR·Release·Issue 종료는 별도 승인/후속 요청 범위다.
