# JSON 파일 가져오기와 내보내기

JSON 파일은 기존 Project에 새 Tasks/Links/명시 Milestone 소속을 추가하는 create-only 교환 형식이다. 대상 Project metadata와 Calendar를 덮어쓰지 않는다. `schemaVersion: "1.0"`은 기존 일정 입력을 지원하고 `"1.1"`은 status·description·URL·leaf Baseline·명시 Milestone membership·source metadata를 지원한다. 정확한 필드는 [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md)와 두 machine schema를 따른다.

Project Workspace의 `더보기 → 가져오기 (JSON)`에서 파일을 선택하고 Preview를 수행한다. 유효 edit session이 필요하다. 편집기/다른 mutation 중 진입을 막고 파일/target/revision/permission이 바뀌면 이전 preview를 폐기한다. 오류는 전체 거부이며 일부 행만 저장하지 않는다. Preview의 counts, normalizedTasks, changedTasks, warning과 target Calendar를 확인한 뒤 동일 파일을 commit한다. 빈 파일은 preview counts0/commit 비활성이다. 실패 시 현재 Project Tasks/Links/소속/revision은 보존된다. 412에서는 “최신 일정 조회”로 대상 canonical revision을 갱신하되 파일/dialog을 유지하고 이전 preview를 폐기한다. 조회 실패는 명시적으로 재시도하고 target/permission/cancel 또는 요청 세대가 바뀐 늦은 응답은 적용하지 않는다. 자동 저장 없이 사용자가 다시 Preview/diff를 확인한 뒤 Commit한다.

JSON 내보내기는 Readonly에서도 full Project 범위로 가능하다. 현재 화면/WBS/Dashboard 필터를 적용하지 않는다.1.1의 requestedStart와 authored Baseline start/duration을 제공하며 effective dates/Ready는 import 후 대상 Calendar에서 다시 계산한다. Summary의 일정/진척/status/Baseline은 작성하지 않는다. sourceTaskId/source Calendar는 참고이며 새 UUID가 생성되고 대상 Calendar가 authority다. Resource Assignment/물류/Password/session/Project master는 JSON 교환 범위에 없다. 이 파일은 일정·단계 정보 교환이며 DB 전체 백업이 아니다.

기존 mixed Task/Milestone Link는 JSON Export에 전부 보존한다. 새 Import는 기존 신규 Link 정책에 따라 mixed가 하나라도 있으면 전체를 거부한다. UI에서 이 경계를 먼저 안내하고 데이터를 생략하지 않는다. 빈 Project는 tasks[]/memberships[]로 출력하며 empty commit은 수행하지 않는다. 파일5 MiB/Task5000/Link20000/Task당 incoming100을 넘으면 JSON Export를 전체 거부한다. 현재 서버 일정에 incoming101이 있어도 행/Link를 줄인 파일을 생성하지 않는다.

Producer는 schemaVersion·정보용 project → stable externalId → parentExternalId와 배열 sibling 순서 → Dependency endpoint/type/signed lag → memberships → JSON Schema → server Preview → warning/diff 검토 → Commit 순서로 작성한다. CSV/VBA producer는 기존1.0 POC이며 이번 변경에서 parser나 실제 Excel 환경 검증을 확장하지 않는다. file/UTF-8/BOM/duplicate key/size/transaction 보안 한도는 [IMPORT_SCHEMA.md](IMPORT_SCHEMA.md), HTTP 계약은 [API.md](API.md), 실제 검증은 [TEST_PLAN.md](TEST_PLAN.md)를 따른다.

## Issue #491 preview 배치 검증

검토 dialog의 body8px gutter/scroll padding과 table-owned scroll margin은 native focus ring을 보존한다. 960px 작업/차이 표 최소 폭과 문서 밖이 아닌 table owner의 수평 스크롤, 취소 가능한 preview와 취소 금지 commit의 기존 의미를 유지한다. 대표390/1440 native Tab과 실제 preview 성공·commit201,401/412·파일 보존·기존 Task/Link 불변 증거는 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)를 참조한다. 이 변경은 presentation만이며 JSON1.0/1.1 strict schema·digest·새 UUID·target Calendar/create-only/atomic revision 계약이나 CSV 지원을 확장하지 않는다.

Issue #491의 최신 검증 기준은 main `d8d0bb3bab5d13ca68a6b319e116dec4ca24d48d`/0.94.4이며 제품4/spec/helper byte를 유지한 after-current8case PASS다. 역사적0.94.3 증거와 최신 선택 관측은 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)에서 구분한다. 템플릿 instantiate는 실제 navigation·편집 상태·원본 불변을 확인했으며201은 서버 계약값으로 response.status 직접 검증이 아니다. 공식 원격 CI와 최신 독립 QA는 별도 판정 전까지 NOT TESTED다.

Issue #491의 두 번째 통합 최신 기준은 main `61a5f511d79e1f9429635bb0da35c0c02ee2163c`/0.95.1이다. 기존 #492 HoverTooltip 변경을 보존하고 동일 소비자 제품4/spec/helper로 새8case PASS를 확인했다. 이전0.94.3/0.94.4는 역사적 검증으로 보존하며 총10run61case(50PASS/11원래FAIL)와 최신 관측은 [Issue #491 검토](ISSUE_491_UI_UX_REVIEW.md)를 따른다. create/copy/instantiate201의 간접 근거와 직접 response.status 검증은 구분한다. 공식 CI와 최신 독립 검토는 별도다.
