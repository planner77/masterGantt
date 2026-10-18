# Issue #724 — 누적 로컬 실패·차단 원장

이 기록은 N1 구현 중 실제 Local Fast Feedback을 원인별로 분리한다. PR CI는 아직 시작하지 않았으며 원격 실패나 원격 성공으로 해석하지 않는다. 기준 main은 `3eaa6026923c38f200a463f6985c7cc8f88f9bf0`, 후보 branch는 `feat/issue-724-workspace-navigation`이다. 이전 실패를 재실행 PASS로 삭제하지 않는다. 사전 검토의 REWORK는 실행 FAIL과 구분한다.

| 순서 | 환경/검사 | 최초 결과·원인 | 조치 및 후속 검증 |
| --- | --- | --- | --- |
| L1 | 변경 source ESLint | FAIL — navigation preference 복원 effect의 동기 `setActiveScreen`이 `react-hooks/set-state-in-effect` 위반 | URL/localStorage 외부 상태 복원 callback을 취소 guard가 있는 microtask로 이동. lint 규칙/CI gate 변경 없음. 후속 실행은 아래 최종 원장에 기록 |
| L2 | Chromium webServer 준비 | BLOCKED — 다른 worktree를 가리키는 node_modules symlink를 Turbopack가 filesystem root 외부로 거부. 테스트 본문 실행 전 | 초기29케이스는 별도 Webpack dev 서버3124에서 실행했다. 이후 symlink만 unlink하고 격리 worktree에서 `npm ci --prefer-offline --no-audit`로447개 설치를14초에 완료해 기본 Turbopack/config로 재검증했다. 외부 worktree 의존성 변경 없음. 테스트 skip/retry/timeout 완화 없음 |
| L3 | 실제 Chromium `project-logistics-management.spec.ts:559` | FAIL — 메뉴 selector 이관 과정에서 기존 내부 h2 `물류 구성`까지 `기준정보`로 변경한 테스트 기대 오류. trace DOM은 기존 heading을 유지 | 해당 h2 기대만 기존 값으로 교정. 모달/overflow/focus 단언은 보존. 앞선10개 케이스는 PASS이며 최종 재실행은 별도 기록 |
| L4 | 실제 Chromium `project-workspace-ux.spec.ts` #76 첫 케이스 | FAIL — URL 집합 개수1을 기대했으나 새 screen query의 History replace로5개. 문서 요청1·동일 Gantt/scroll·mutation0 선행 단언은 PASS | pathname과 screen을 제외한 기존 query 불변·문서 요청1 검증으로 탐색 URL 계약을 이관. 실제 재로드/무쓰기/viewport 단언 유지 |
| L5 | 독립 read-only 사전 검토 | REWORK — Logistics 정확 drill/Editor 복귀와 Unified 복귀 fallback이 기존 숨은 master.processes/subtab-unified 또는 숨은 Target 검색 input을 선택 | 정확 screenKey의 visible tab/control/heading으로 fallback. 기존 #624 통합 spec에 원래 trigger 교체·삭제 음성 회귀를 추가하고 관련 source/type/lint 재검증 |
| L6 | 최종 source 기본 Turbopack Chromium `logistics-target-authoring.spec.ts:100` | FAIL — QA가 예측한 line99 helper의 logistics→master.processes 강제 이동으로 Target 상세가 hidden | 의도한 `targets` 목적지로 교정. 나머지 logistics helper 호출은 초기공정 검증 또는 곧바로 명시 subview 선택임을 정적 확인. 원본 trace/로그와 재검증은 구별 |
| L7 | 기본 Turbopack Chromium `task-context-menu-hierarchy.spec.ts:412` #407/#418 | FAIL — 전체 scope가 tab에서 button으로 이동한 뒤 마지막 단언에 `aria-selected=true`가 남음. 실제 button은 정상 `aria-pressed=true` | 마지막 기대를 button 계약 `aria-pressed`로 교정. 선행 canonical 추가/Summary 승격/연속성·동일 API·금지 Milestone409 단언은 유지. 최종 보완 실행에 포함 |
| L8 | focus 음성 회귀 추가 후 Chromium #624 | FAIL — 원래 trigger가 숨은 panel에 있을 때 기본 role locator가 hidden을 제외하여 테스트의 DOM교체 준비 `locator.evaluate`가15초에 실패. 제품 fallback 실행 전 | DOM교체 준비 대상만 hidden 경계를 명시했다. 첫 단독 재실행도 hidden accessible name/locator 준비에서15초에 실패해 같은 L8의 반복으로 기록한다. 숨기기 전 실제 origin node를 확보하는 방식으로 교정하며 실제 클릭·focus·권한·snapshot 검사는 visible/actionable 상태로 유지한다. 같은 #624 기존 케이스를 재검증하며 timeout/retry/skip 변경 없음 |
| L9 | #624 단독 두 번째 보완 실행의 Task Editor 음성 focus 단언 | FAIL — 일정 drill origin 소실 뒤 exact 공정 탭 복귀는 PASS했으나 Task Editor 닫기 후 교체된 동일 ID Task 버튼 focus가5초 안에 복원되지 않음 | L8 준비 오류와 구분하고 실제 focus를 진단했다. 진단2에서 BUTTON#project-tab-dashboard.process, role=tab, visible=true, hidden/inert/disabled=false, screen=dashboard.process, modal0을 확인했다. 기존 설계가 허용한 같은 화면의 보이는 탭 fallback이므로 Task 버튼만 기대한 신규 oracle의 TEST_CONTRACT 오류다. source 추가 변경 없이 허용 control/heading/활성 tab 전체를 명시 검증하며 Task/Assignment control이면 같은 canonical ID를 요구한다. body/숨은 요소/다른 화면은 계속 FAIL이다. Target 복귀 음성은 앞 단계 실패로 이 실행에서 NOT TESTED |
| L10 | 허용 fallback 계약으로 교정한 #624 단독 실행 | FAIL — 일정·Task Editor 복귀의 가시성/같은 화면 검사는 PASS했으나 Target 원본 편집에서 `Target 상세` Dialog를 기대함. 실제 DOM/기존 component는 `Target 수정` composer를 정상 표시 | 새 음성 테스트의 준비 대상을 실제 기존 `Target 수정` editor로 교정하고 취소/원래 Unified 복귀를 검증한다. 상세 조회 Dialog와 원본 composer를 구분하며 source 추가 변경 없음 |

L1 이전 최초 typecheck는 PASS였지만 해당 초기 source의 결과이며 최종 후보를 승인하지 않는다. `gradeText` unused warning은 기존 파일의 기존 warning으로 오류0과 구분한다. Python 실행명 부재 같은 도구 호출 교정은 제품 결함으로 분류하지 않는다.

## 최종 동일 source 재검증

최종 보완 대상6개는 동일 source5 PASS와 마지막 #6241 PASS로 모두 통과했다. 마지막 단독 실행은23.0초/전체39.4초 PASS이며 origin 소실3종·full snapshot·writes0·동일 Gantt를 검증했다. 개별 결과·실행 단계·같은 source 재검증 및 미검증은 [Work Packet](exec-plans/active/ISSUE_724.md)과 [Test Plan](TEST_PLAN.md)에 기록한다. 원격 Required Quality/E2E/Docker·Trusted QA·Owner 최종 승인은 NOT TESTED다. 첫 PR CI 이후 실패가 발견되면 Run/Attempt/Head/Base/Test-Merge·실제 실패 test 집합을 이 문서에 누적한다.

기본 Turbopack의 첫 최종 source 선택 실행은14케이스 중12 PASS/2 FAIL로 종료했다. L6/L7은 수정 전 oracle로 실행된 실패이며, 전체 통과로 보고하지 않는다. 앞선 Webpack29케이스는27 PASS/2 FAIL이다. 최종 focus 보완과 oracle 교정 후 해당 영향 범위를 다시 검증한다.

focus 보완 후 선택6케이스는5 PASS/1 FAIL(L8 준비 selector)로 종료했다. Target A/B 실제 생성·동일 원본/ACS subset 및 #407 canonical 추가/동일 instance, 실제 #550 Milestone 추가/readonly, #518/#724 5폭·URL/관리자 경계는 PASS다. #624 단독 첫 재실행은 같은 L8 준비 단계 FAIL이므로 제품 focus 성공으로 해석하지 않는다.

L9 진단1은 앞선 일정 복귀의 특정 공정 tab 기대에서 FAIL했으며 실제 focus attachment가 Task 단계에만 있어 해당 시점의 activeElement는 UNKNOWN으로 남긴다. 진단2는 Task 단계까지 도달하여 위 보이는 같은 화면 tab 증거를 확보했다. UI/UX의 원래 허용 계약은 trigger 소실 시 정확한 화면의 보이는 control/heading/활성 tab fallback이며, 새 음성 테스트만 특정 버튼을 강제한 것이었다. 기존 무쓰기·ID·modal·가시성/권한·snapshot 단언을 삭제하거나 timeout/retry/skip을 바꾸지 않는다.


최종 test-contract 교정은 navigation_review가 읽기 전용으로 재검토해 PASS했다. 기존4관점 수치/ID·Gate·5폭·detail 정상 focus·쓰기0·full snapshot·Gantt instance 단언 삭제0, timeout120초/page15초·skip/retry 변경0을 확인했다. 이전 FAIL/UNKNOWN은 이 최종 PASS로 소급 삭제하지 않는다.
