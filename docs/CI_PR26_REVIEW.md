# PR #26 CI 실패 분석 및 수정

## 최초 실패: 편집기 진입 테스트 갱신 누락

[Run #55](https://github.com/planner77/masterGantt/actions/runs/34790707897), head `0adbccff88ddcd17e859c226d7803d410b845e7b`에서 quality/docker는 PASS였지만 E2E 42개 중 12개가 실패했다. 작업 메뉴가 추가되었는데 테스트는 우클릭 즉시 dialog를 기다려 timeout이 발생했다. `461af0ccef377a7ed7ab828d13fe3dffc381e507`에서 실제 메뉴 선택 helper와 기존 mock/SQLite/시간대 테스트를 함께 갱신했다. 테스트 제외, timeout 증가, CI gate 완화는 하지 않았다.

## 후속 실패: 메뉴를 즉시 닫는 지연 scroll 이벤트

[Run #56](https://github.com/planner77/masterGantt/actions/runs/34791343550), head `461af0ccef377a7ed7ab828d13fe3dffc381e507`은 E2E 45개 중 41개 PASS, 4개 FAIL이었다. 이번에는 dialog가 아니라 메뉴가 없어서 실패했다. 마일스톤, readonly/linked 마일스톤, 실제 DB 프로젝트의 시간대별 Chart 접근이 대상이다.

업로드된 `playwright-report` artifact `10328442972`의 trace를 확인했다. 마일스톤 우클릭 전에 Chart의 scrollLeft가 0에서 418로 이동하고, 메뉴가 한 프레임 나타난 후 사라졌다. 이벤트를 처리할 때의 Chart scrollLeft는 계속 418이었다. 메뉴 effect의 document capture `scroll` handler가 실제 위치 변화 여부 없이 모든 scroll 알림에서 메뉴를 닫는 구조였다. 따라서 열기 전에 완료된 scrollIntoView 또는 SVAR 동기화의 지연 알림도 새 메뉴를 닫았다.

수정은 메뉴를 여는 순간 호출 대상과 조상의 scrollLeft/scrollTop을 캡처하고, scroll 알림 시 그 기준보다 실제 위치가 달라졌을 때만 닫도록 한다. 동일 위치의 중복/지연 알림 및 별도 영역의 무관한 알림은 무시한다. 실제 가로/세로/페이지 스크롤, 바깥 클릭, Escape, resize의 닫기 정책은 유지한다. 이벤트를 가로채거나 타이머로 무시하는 구간을 두지 않는다.

## Run #58: 기존 회귀 통과 및 신규 테스트 준비 조건 보정

[Run #58](https://github.com/planner77/masterGantt/actions/runs/34792410090), head `0dd90273235403f6c4b21fb96b117ba222303714`에서 quality/docker가 PASS였고, 앞서 실패한 실제 DB·세 시간대·readonly/linked·milestone을 포함한 기존 E2E 45개가 모두 PASS였다. 추가한 스크롤 전용 테스트 1개만 `scrollLeft > 0` 준비 조건에서 FAIL이었다.

artifact `10327744180`의 trace/화면을 확인하니 1440px viewport에서 9월 23일 마일스톤이 초기 9월 16~24일 표시 범위 안에 있었다. 따라서 스크롤 없이 우클릭할 수 있어 scrollLeft가 0인 것은 정상이며, 테스트 데이터가 이름과 달리 화면 밖 대상을 만들지 못한 것이 원인이다.

초기 작업을 9월 16일에 두고 대상 마일스톤을 10월 16일로 변경했다. 실제 scrollWidth/clientWidth, 초기 scrollLeft, 막대/Chart bounding rectangle로 우클릭 전에 스크롤 가능·화면 밖이라는 조건을 먼저 확인한다. 그 후 실제 우클릭, 지연된 동일 위치 scroll 알림의 무시, 실제 이후 이동 시 닫힘을 검증한다. 기존 `scrollLeft > 0` 및 메뉴/인스턴스/저장 관련 assertion은 제거하지 않는다. 애플리케이션 코드는 이 준비 조건 수정에서 변경하지 않는다.

## 회귀 검증

- `tests/features/gantt/menu-scroll-guard.test.ts`: 중복 알림, 실제 가로 이동, 페이지 세로 이동, 새 메뉴 기준 재설정.
- `tests/e2e/task-context-menu-scroll.spec.ts`: 화면 밖 마일스톤 실제 우클릭, 지연 알림 후 메뉴 유지, 이후 실제 스크롤 시 닫기, 편집기/저장 없음, Gantt API identity 유지.
- 기존 `project-task-editor*.spec.ts`: 메뉴 경유 후 명시적 저장, 실제 SQLite 영속성, 세 시간대, 401/412/검증·네트워크 오류, readonly/linked/summary/milestone.
- CI workflow, retry, timeout 및 기존 assertion을 약화하지 않는다.

커밋 시점의 준비 조건 수정 후 원격 판정은 아직 NOT TESTED이며 [PR #26](https://github.com/planner77/masterGantt/pull/26)의 최종 head SHA/run 결과를 따른다. 이전 실패를 재실행으로 덮어 숨기지 않는다. 로컬 npm 설치와 브라우저 검증은 DNS 제약으로 BLOCKED다. 실제 SVAR 지정 데모와의 시각적 일치/최종 수동 UX는 CI와 별도 NOT TESTED다. 사용 계약은 [TASK_EDITOR](TASK_EDITOR.md)를 따른다.
