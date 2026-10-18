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
