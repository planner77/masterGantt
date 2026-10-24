# Issue #798 — 로컬 검증·관측 보완 원장

원격 PR CI 이전의 실패·중간 후보를 기록한다. 로컬 결과와 GitHub Full CI/Trusted QA/Manager ACCEPT는 별도이며 이번 승인 범위는 PR CI 시작까지다. 전체 AC·source·관측은 [Work Packet](exec-plans/active/ISSUE_798.md)을 따른다.

## F798-L001 — 신규 Chromium 테스트의 정확 label locator

- 최초 실행: 로컬 Chromium 선택7개는4 PASS / 3 FAIL(4.6분). `issue-730-view-composer.spec.ts`의 신규 `#798 다섯 관점 고급 조건의 5폭 keyboard·focus·활성값과 조회 불변`이21.2초에 FAIL. 교정 후 재검증은 별도 실행 영수증과 함께 확정한다. 원격 CI 실패가 아니다.
- 실제 오류: `getByLabel("작업 상태", { exact: true })`의 element not found. error-context의 accessibility tree에는 `combobox "작업 상태"`와 빠른 조회 조건이 표시된다.
- 판정: wrapping label의 text 검색이 select option 문자열까지 포함하는 신규 테스트 locator의 불일치다. 제품 필드의 접근성 이름·가시 상태를 고칠 근거가 없다. 실패 지점이 특정 locator로 한정되고 AX에서 실제 control을 확인했으므로 광범위한 제품 bisection/계측은 필요하지 않다.
- 보완: select는 `getByRole("combobox", { name: "작업 상태", exact: true })`로 접근성 역할·정확 이름을 직접 검사한다. 이름 정렬도 같은 의미의 locator를 사용한다. 기간 input·기존 업무 단언·5폭/초안/조회 불변·44px/keyboard·터치 에뮬레이션 검증을 유지한다.
- 변경 경계: 제품 세 파일과 before/after source 지문·계산/API/권한 불변. 테스트 timeout·retry/skip·CI/Required gate를 변경하지 않는다. 첫 실패를 retry 성공으로 덮지 않고 교정 후 실행을 별도 기록한다.
- 증거: frontend의 정제 실행 영수증·실패 문구·실행 source 지문을 Work Packet에 연결한다. 원본 trace는 로컬 진단용이며 auth header·cookie를 포함할 수 있어 Git에 게시하지 않는다.

## F798-L002 — 설비 조건 복원 후 닫힌 설정 재진입

- 최초 실행: 같은 선택7개 실행의 `issue-734-equipment-dashboard.spec.ts` 유형 OR·controls/Task association case가22.9초에 FAIL. 신규 #798의 정확 label 오류와 구별한다.
- 실제 경계: AGV 조건을 적용하고 page reload 후 checkbox의 checked/notchecked를 검사한다. 새 고급 설정은 reload 시 기본 닫힘이고 role locator는 숨은 checkbox를 찾지 않는다.
- 근거: 실패 AX에는 닫힌 `필터·조회 구성 (1)`과 외부 `설비 유형: 1개 · AGV`가 표시된다. 적용 조건은 보존돼 있으며 숨은 설정에 대한 기존 테스트의 재진입이 누락됐다.
- 보완: 닫힌 활성 AGV 요약을 먼저 확인하고 `openWbsViewControls`로 사용자가 열 수 있는 경로를 거친 뒤 기존 AGV checked·AMR notchecked·OR 합집합·원본 controls와 업무 연관의 구별 단언을 그대로 실행한다.
- 변경 경계: 테스트 진입만 확장하며 제품의 실제 적용 조건·기본 닫힘·권한·source는 변경하지 않는다. 첫 실행 결과와 교정 후 실행을 분리한다.

## F798-L003 — 리소스 상세 Escape 검사 전에 추가한 helper의 focus 이동

- 최초 실행: 같은 선택7개 실행의 #736 Resource 동적 계층·개인 Plan·Excel·정확 Assignment case에서 상세 Escape 후 원래 표 버튼 focus 단언이 FAIL.
- 원인 경계: 새로 추가한 고급 설정 열기 helper가 기존 상세 내부의 focus를 상단 고급 설정 trigger로 옮겼다. 이어진 기존 nonfocusable 상세 section의 `press("Escape")`는 상세 내부로 focus를 옮기지 못한다. Trace의 `Frame.focus`(고급 trigger)→`Frame.press`(nonfocusable 상세 section, Escape) 순서를 독립 확인했다. 실제 keydown target은 별도 계측하지 않았으므로 이벤트 내부 경로를 직접 관측했다고 주장하지 않는다. 제품 상세 Escape handler는 변경되지 않았다.
- 보완: 원래 편집기 닫기→원본 버튼 focus→상세 Escape→표 상세 trigger focus 순서를 먼저 검사하고, 추가 고급 조건 재진입·개인 필터 값 검사는 그 뒤에 수행한다. 원래 정확한 focus 복귀 단언을 제거하거나 최종 focus 대상을 바꾸지 않는다.
- 검증: 제품 source/전후30쌍·단위16은 그대로이며 교정된 테스트 source에서 선택7개를 다시 실행한다. 첫4 PASS / 3 FAIL과 후속 결과를 합산하지 않는다.

## F798-L004 — 유효한 IDs-only System 저장 설정의 범위 표시

- 독립 검토에서 `systemIds`만 있고 `systemView`가 없는 설정도 현재 validator·parser·storage가 허용하며 backend는 직접 연결 일부로 조회함을 확인했다. 빈 `systemIds: []`도 직접 연결 선택0식이다.
- 첫 제품 후보의 새 외부 문구는 `systemView` 누락만으로 기존 전체 작업 호환으로 표시했다. 기존 SystemControls와 같은 **systemView와 systemIds가 모두 없는 경우만 legacy**라는 판정으로 정합화한다. 전체 호환 조회와 선택된 직접 연결을 혼동하지 않는다.
- 새 공통 `고급 조건 초기화`는 문서화한 관점 기본 범위 복구 계약을 따른다. IDs-only 선택을 해제할 때 기본 direct를 명시하고, 진짜 legacy(both undefined)를 고급 검색/정렬 해제만으로 direct로 변환하지 않는다.
- 범위: 기존 SystemControls의 별도 `시스템 필터 초기화`·API/parser/storage·구형 spec의 의미는 변경하지 않는다. 신규 공통 버튼과 새 외부 범위 문구만 수정한다.
- 회귀: 기존 #735 legacy 저장·펼침·선택 복원 case에 IDs-only·선택0식의 직접 범위 표시와 새 공통 초기화의 default-direct·canonical mutation0을 확장한다. 원래 legacy 복원 단언을 유지한다.
- 첫 제품 후보의 교정 후 선택7/7 PASS는5.0분의 역사적 결과로 보존하며 수정된 제품 source의 PASS로 재사용하지 않는다. 이전 after30도 SUPERSEDED로 보존하고 같은 fixture/DB에서 최종 제품 source의 after30을 다시 수집한다. 최종 source의 영향 선택 회귀와 정적 검증은 별도 실행한다.

## F798-L005 — 고급 초기화 버튼 소멸 시 keyboard focus

- 별도 독립 Chromium read-only context에서 표 이름 찾기 조건만 활성화하고 Escape로 접은 뒤 고급 조건 초기화 버튼에 focus→Enter를 실행했다. 두 RAF 이후 실제 activeElement가 버튼에서 BODY로 바뀌고 reset 버튼은0개가 됐다. 다음 Tab은 도움말로 이동했다. 상단 navigation으로 이동했다고 확대하지 않는다.
- 원인: 새 공통 초기화로 마지막 고급 조건이 사라지면 그 버튼도 unmount되지만 지속 제어로 focus를 복원하지 않았다.
- 보완: 새 공통 고급 초기화에서 항상 존재하는 `필터·조회 구성` trigger로 focus를 복원하고 기존 #730 확장의 Enter 초기화→정확 trigger focus 단언으로 고정한다. 기존 소비자·구성기의 다른 초기화는 변경하지 않는다.
- 두 번째 제품 후보의 after30도 source·사유와 함께 SUPERSEDED로 보존한다. 공통 제어의 남은 경계 검토를 끝낸 뒤 최종 제품 source에서 after30·영향 선택 회귀를 다시 실행한다. 먼저 실행한 후보의 PASS를 최종 source의 PASS로 재사용하지 않는다.

## O798-001 — 모바일 header 중간 후보

최초 after 후보에서 제목→경로→도움말의 세 행을 확인했다. 수집을 안전하게 멈추고 완결 JSON15개와 마지막 미완결 캡처를 [SUPERSEDED 기록](../output/playwright/issue-798/after-intermediate-1/SUPERSEDED.json)으로 보존했다. 제목+도움말 한 행·경로 다음 행으로 CSS를 보완한 최종 source에서30조합을 다시 수집했다. Milestone390의 첫 요약은 before875→중간801→최종769px이며 중간 후보를 최종 PASS 표본에 합산하지 않는다.

## O798-002 — 보조 API 영수증의 실행 환경 오류

[첫 수집 오류](../output/playwright/issue-798/before-supplemental-attempt1-error.txt)는 브라우저 run-code sandbox에서 호스트 파일을 읽으려던 `ReferenceError: require is not defined`다. 호스트에서 읽은 합성 query 입력을 literal로 전달해 재조회하고 기존 before의 snapshot과 일치함을 검증했다. 원래 브라우저 before30 관측과 구별하며 제품 API/DB 실패로 해석하지 않는다. raw ID·전체 Gate 보조 before는 표시 코드 변경 이후 변경되지 않은 backend에서 읽은 자료임을 명시한다.

## O798-003 — 최종 source 재관측의 편집 세션 준비

최종 source 재관측 서버를 재시작한 뒤 합성 fixture 세션을 다시 열 때 수집 준비 코드가 잘못된 요청 key/기대 status를 사용해400을 받았다. 그 상태의 KPI390 준비가 편집 상태 대기30초 timeout으로 실패했으며 최종 표본에 포함하지 않는다. 기존 `UnlockProjectRequest`와 edit-session handler 계약(`editPassword`, 성공204)을 확인해 준비 코드만 수정했다. 실패한 collector/CLI가 끝난 뒤 새 session에서 재수집하며 seed·Task/Assignment·revision mutation은 수행하지 않는다. 실제 세션 값·요청 비밀번호·cookie는 증거에 저장하지 않고 상태400/204와 준비 실패 경계만 남긴다.

## 최종 재검증

[최종 실행 영수증](../output/playwright/issue-798/local-validation.json)과 [Chromium4 원장](../output/playwright/issue-798/local-chromium-source3.json)은 source3에서4/4 PASS·retry0/skip0/flaky0·2.8분을 기록한다. F798-L001~L005의 보완 후 실제5관점 조작·저장된 System legacy/IDs-only0/1·새 초기화·focus와 Resource 원본/Plan/Excel을 검증했다. 같은 제품 지문의 after30·독립 read-only6경계·TypeScript/ESLint·Unit16도 PASS다. 최초 선택4 PASS/3 FAIL·중간 source1 선택7/7 PASS·중간 source2 관측은 각각의 지문과 결과로 보존하며 합산하거나 최종 source의 PASS로 소급하지 않는다. 전체 원격 회귀·QA_FINAL·Manager ACCEPT는 NOT TESTED다.
