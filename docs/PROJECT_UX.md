# 프로젝트 화면·삭제·하위 작업·알림·링크 복사

## Issue #330 물류 유형 관리자 compact/filter 계약

`/logistics-admin`의 설비 유형/시스템 유형 전환은 동일 높이의 버튼 그룹과 `aria-pressed` 상태를 사용하며 선택 상태가 바뀌어도 layout shift를 만들지 않는다. 목록 상태 필터는 `전체 / 활성 / 비활성` 세 값이며 기본값은 전체다. 필터는 이미 조회한 catalog snapshot에만 적용하고 API 재조회, mutation, catalog revision 증가를 만들지 않으며 설비/시스템 전환 뒤에도 현재 필터를 유지한다.

추가 폼은 유형명/코드/정렬/유형 추가를 content-aware grid로 배치하고 각 grid item/control의 intrinsic width가 인접 control을 침범하지 않게 한다. 가용 폭이 줄면 2열, 이후 1열로 의미 단위 reflow하며 390/768/1024/1440px에서 document-level unintended horizontal overflow를 만들지 않는다. 목록은 header/body 구분과 기존 조작 가능한 action 크기를 유지한 채 row 상하 padding을 줄인다. 필터 결과 0건은 현재 조건에 맞는 empty state로 표시한다.

관리자 로그인/로그아웃/비밀번호 변경, catalog CRUD, 사용 건수, inactive 참조, session/Origin/If-Match/revision/stale 처리 계약은 변경하지 않는다. 이 화면은 SVAR Gantt 내부 UI가 아니므로 SVAR API/PRO 기능을 추가하지 않는다.

## Issue #285 공정 추가 모달 코드 자동 생성

물류 구성 > 공정 관리의 **공정 추가** 모달은 사용자에게 기술 식별자인 공정 코드를 입력받지 않는다. Create mode의 첫 focus는 공정명이며 공정명만 필수로 저장 가능하다. 브라우저 POST payload에는 `code`를 만들거나 포함하지 않고 서버 canonical 응답의 자동 생성 code를 그대로 표시한다.

공정 수정 모달은 기존 code 편집 계약을 유지한다. 기존 공정 row, 검색·표시·Excel/복사/템플릿의 code 소비 계약과 DB의 non-empty/unique invariant도 유지한다. Escape 취소, trigger focus 복원, readonly에서 추가 action 비노출, busy 중 중복 제출 차단은 기존 `WorkspaceDialog` 계약을 그대로 따른다.

## Issue #279 물류 구성 서브탭 overflow 계약

Project Workspace의 물류 구성 하위 탐색은 `KPI 대시보드 / 공정 관리 / 설비 관리 / 물류 시스템 / 제어·조율 관계` 5개 탭을 한 행으로 유지한다. 좁은 viewport에서 폭이 부족하면 tablist 내부의 수평 스크롤을 허용하지만 세로 방향은 scroll container가 되지 않는다. 수평 overflow와 교차축 overflow를 명시적으로 분리하고, active indicator와 focus-visible이 잘리지 않도록 탭 높이를 음수 margin에 의존하지 않는다.

기존 `tablist/tab/tabpanel`, `aria-selected`, `aria-controls`, roving `tabIndex`와 ArrowLeft/ArrowRight/Home/End 키보드 계약을 유지한다. 키보드로 이동한 탭이 수평 viewport 밖에 있으면 해당 탭만 `inline: nearest` 기준으로 보이게 하며, 이 탐색은 API mutation, Project revision 변경 또는 Gantt 재마운트를 만들지 않는다.

반응형 검증 기준은 390/768/1024/1440px이다. 각 폭에서 tablist의 `scrollHeight <= clientHeight`, computed `overflow-y: hidden`, active/focus 탭의 가시성, document-level unintended overflow 부재를 확인한다. 1024/1440px처럼 충분한 폭에서는 불필요한 수평 overflow가 없어야 한다. Linux overlay scrollbar에서 시각적으로 보이지 않는 것만으로 세로 overflow 부재를 판정하지 않고 geometry를 함께 측정한다.


## Issue #269 프로젝트 복사·템플릿 저장 복구

두 대화상자는 열 때 기존 원본의 준비 상태를 해제하고 현재 조회가 성공해야 제출할 수 있다. 조회 실패는 정상 원본으로 취급하지 않으며 다시 시도 버튼을 제공한다. 닫기·다시 열기·새 조회 이후 도착한 이전 응답은 원본·인증·오류 상태를 덮어쓰지 않는다. 새로 연 대화상자의 최초 성공 조회만 기본값을 채우며 복구 조회에서는 이름·담당자·설명·진척률 초기화 등의 일반 초안을 보존한다.

저장 401은 원본 편집 비밀번호 입력을 다시 표시하고 focus를 돌린다. 비밀번호는 요청 완료/실패와 닫기 시 지우며 URL·스토리지에 보관하지 않는다. 412는 이전 원본을 제출 불가능한 상태로 바꾸고 `최신 원본 확인`을 제공한다. 이 동작은 GET으로 요약과 revision을 갱신하며 자동 저장하지 않는다. 사용자가 갱신된 원본을 확인하고 다시 제출해야 새 If-Match를 사용한다. 복사는 제출 전 최신 조회에서도 확인한 revision이 바뀌었으면 POST 없이 같은 확인 흐름으로 돌아간다.

인증 요청부터 최종 mutation 응답까지 중복 제출·닫기·Escape를 차단한다. 읽기 조회 중에는 닫을 수 있으며 취소한 조회의 응답을 무시한다. native WorkspaceDialog의 키보드 경계와 호출 위치 focus 복원, 읽기 전용 진입의 원본 비밀번호 확인을 유지한다. 더보기 메뉴의 전폭 버튼 스타일은 직접 메뉴 항목에만 적용하여 내부 Dialog의 닫기 버튼이 제목 공간을 밀어내지 않도록 한다. 서버 인증·Origin·revision 및 원자 복사/템플릿 계약은 변경하지 않는다.

## Issue #268 리소스 관리자 실패·재조회 복구

리소스/그룹 추가는 성공한 canonical 응답을 확인한 경우에만 해당 이름·코드를 지운다. 실패·중복 요청 방어로 실행하지 않은 경우는 입력을 유지하며 다른 폼·검색·구성원 선택 초안을 초기화하지 않는다. 목록 조회 중·실패와 정상 결과를 구분하고, 최신 목록을 확인하지 못하면 이전 결과임을 표시하며 revision을 사용하는 mutation을 잠근다. 재시도는 GET만 수행하고 저장은 사용자가 명시적으로 다시 실행한다.

401은 관리자 화면을 해제하고 재로그인 경로를 제공하되 일반 초안은 페이지 메모리에 보존한다. 로그인·비밀번호 변경의 민감 입력은 네트워크 실패를 포함한 요청 종료 경로에서 지운다. 412는 초안을 유지한 채 최신 목록을 조회하고 다시 확인한 후 저장하도록 안내하며 자동 mutation 재전송은 하지 않는다. 결과를 확인할 수 없는 mutation도 목록 재확인 전 재저장을 막는다.

새로고침으로 구성원 초안을 조용히 바꾸지 않는다. 선택 그룹이 없어졌으면 해당 저장을 차단하고 새 선택을 요구한다. 서버 구성원과 초안이 다르면 검토할 수 있게 알린다. 성공 안내는 오류와 구분하여 status로 표시한다. 기존 검색/선택 계약과 서버 인증·Origin·revision 검증은 유지한다. 비밀번호 변경은 catalog revision을 소비하지 않는 기존 인증 경로를 따른다. 390px에서는 관리자 action row를 버튼 3개 구조로 유지하고 긴 리소스 이름은 강제 줄바꿈하여 document-level horizontal overflow를 만들지 않는다.

## Issue #282 프로젝트 만들기 Wide / Responsive Form 계약

`/projects/new`는 일반 문서형 화면의 75rem cap 대신 Project List/Workspace와 같은 page-specific wide shell을 사용한다. 사이트 헤더 아래 전역 `clamp(2.25rem, 6vw, 5rem)` 상단 padding을 그대로 적용하지 않고, 생성 작업을 바로 시작할 수 있는 compact top gutter를 사용한다. Heading의 읽기 폭과 form/content의 작업 폭은 분리하며 tab underline, blank form, template selection/form은 같은 좌측 정렬과 가용 폭을 공유한다.

공통 `.project-form` 계약은 변경하지 않는다. Project Create 내부에서만 다음 responsive grid를 적용한다.

- Wide desktop: blank form은 프로젝트명/소유자를 같은 행에 두고 설명을 넓게, 상태/비밀번호를 compact column으로 배치한다. Template instantiate form은 이름/소유자/기준일/비밀번호를 한 행의 content-aware span으로 배치하고 설명과 오류/action은 전체 폭을 사용한다.
- 768~1024px: 두 열 중심으로 reflow하며 blank form의 설명과 template 설명은 전체 폭을 사용한다.
- 704px 이하: logical DOM/tab order를 유지한 한 열 stack으로 전환한다. Submit/action은 좁은 화면에서 가용 폭을 사용한다.
- 320/390/768/1024/1440/1600px에서 document-level horizontal overflow가 없어야 하며, label/error/helper text와 focus-visible이 clipping되지 않아야 한다.

기존 빈 프로젝트/템플릿 생성 API, validation, edit password 보안, draft 보존, tab WAI-ARIA/Arrow/Home/End, template relative schedule 계산과 성공 후 navigation 계약은 변경하지 않는다. Layout 검증은 `tests/e2e/project-create-layout.spec.ts`의 geometry assertion으로 수행하고 기존 생성/초안/템플릿 E2E와 함께 회귀 검증한다.

## Issue #267 물류 대시보드 조회·탭 상태

조건 변경이나 새로고침 중에는 이전 KPI와 작업 이동을 현재 결과처럼 사용하지 않는다. 최신 조건·revision 조회 성공 후에만 결과를 표시하며 실패 시 오류와 재시도를 제공한다. 임박 기간은 1~90 정수만 조회하고 잘못된 입력은 필드에 안내한다. 공정·설비·시스템 세부 현황의 탭 의미와 방향키/Home/End 탐색을 제공한다. 기준일의 서버 timezone 의미와 Gantt 상태 보존은 [대시보드 계약](LOGISTICS_DASHBOARD.md)을 따른다.

## Issue #263 물류 담당자 조회 실패 복구

설비·시스템 담당자 dialog는 리소스 후보 조회 중/실패/성공을 구분한다. 최신 목록 확인 전에는 역할 추가·제거·주 담당자 변경·저장을 잠그고 실패에는 다시 시도를 제공한다. 기존 담당자는 물류 snapshot의 이름·코드를 표시하며 조회 실패를 담당자 0명으로 표현하지 않는다. 창을 연 뒤 Project revision이 바뀌면 충돌을 알리고 취소 후 최신 대상에서 다시 열도록 안내하며, 이전 초안을 새 revision으로 저장하지 않는다. 재시도는 조회만 수행하고 역할 교체 mutation은 명시적 저장에만 실행한다. 권한·Project revision·서버 검증 계약은 변경하지 않는다.

> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


관련 Issue: #9, #10, #11, #18, #21 / PR: [#23](https://github.com/planner77/masterGantt/pull/23)

## 범위와 요구사항 변경

이번 사용자 요청은 위 다섯 이슈의 구현과 원격 CI 실패 분석·수정까지 승인한다. 과거 이슈 본문의 “이슈 등록만 수행” 기록은 이번 구현 요청에 적용하지 않는다. main 병합, GHCR 게시, Semantic Version 릴리스 및 운영 배포는 별도 범위다.

이 문서는 [요구사항](REQUIREMENTS.md), [아키텍처](ARCHITECTURE.md), [API](API.md), [보안](SECURITY.md), [테스트 계획](TEST_PLAN.md)의 해당 UX 변경에 대한 보충 계약이다. 과거 W24의 화면·확인 창 설명은 당시 검증 이력으로 보존하며 아래 변경이 현재 계약이다.

| Issue | 구현 계약 | 보존하는 경계 |
| --- | --- | --- |
| #9 | 프로젝트명 아래 Revision/시간대/휴일/작업/연결 정보와 펼침 설정 패널을 제거한다. 기존 프로젝트 정보·비밀번호 변경·편집 종료 기능은 헤더의 설정 버튼과 별도 모달에 보존한다. | 데이터와 revision은 삭제하지 않는다. 설정 열기·닫기는 Gantt를 재마운트하지 않는다. |
| #10 | 프로젝트 목록에 삭제 버튼을 항상 표시한다. 클릭 시 최신 이름/revision을 조회하고 파괴적 삭제 경고와 비밀번호 입력 창을 표시한다. 기존 편집 세션이 있어도 새로 입력한 비밀번호 확인이 성공해야 DELETE를 전송한다. | 기존 session/Origin/If-Match 서버 검증, rate limit, transaction, cascade와 rollback을 유지한다. |
| #11 | Grid 행 +의 첫 하위 작업은 확인 팝업 없이 추가한다. 일반 leaf 부모에는 기존 `convertParentToSummary: true`를 명시한다. | 마일스톤 부모 금지, 빈 Summary 금지, 근무일 보정, 상위 일정·진척 집계, 중복 mutation 차단을 유지한다. |
| #18 | 정상 결과는 5초 하단 overlay Toast, 오류는 우측 상단 알림함과 복사 가능한 내용으로 제공한다. | 알림 때문에 화면 공간·scroll·focus·Gantt 인스턴스를 변경하지 않는다. 기존 명시적 오류 복구는 유지한다. |
| #21 | 목록 행과 상세 헤더에 동일한 공용 링크 복사 버튼을 제공한다. 읽기 전용에서도 사용한다. | 서버의 `APP_BASE_URL` 검증과 publicId 직접 접근·인증을 유지한다. 복사는 navigation/DB mutation/revision 변경을 수행하지 않는다. |

#18에 있었던 부모 전환 확인 유지 조건은 이번에 함께 승인된 #11로 대체한다. 서버의 명시적 요약 전환 옵션을 제거하거나 모든 요청을 무조건 승인하는 변경은 아니다.

## Issue #75 프로젝트 목록 Wide Table / Row Action 계약

프로젝트 목록은 일반 Form용 `.main-content` 75rem cap을 그대로 사용하지 않는다. 목록 route에만 명시적인 wide modifier를 적용하여 responsive gutter를 유지하면서 최대 100rem까지 사용한다. Project 상세/Gantt와 다른 Form route의 기존 폭 계약은 변경하지 않는다.

목록은 native `table/thead/th/tbody/td` semantics를 유지한다. 프로젝트명은 상세 화면으로 이동하는 primary Link이며, 행 전체를 click target으로 만들지 않는다. Header는 body와 다른 subtle background, divider와 typography로 구분하고 프로젝트명 → owner/description → 날짜 metadata → action 순으로 시각 우선순위를 둔다. Description은 Wide 화면에서 가장 많은 가변 폭을 받으며 작은 화면에서는 table wrapper 내부 horizontal scroll로 접근한다.

행 작업은 항상 보이는 More 버튼 하나에서 제공한다. 메뉴 항목은 다음 순서와 의미를 갖는다.

- `프로젝트 복사`: native Link, 기존 `?copy=1` 진입 계약 유지
- `링크 복사`: native Button, 기존 APP_BASE_URL/clipboard/fallback 계약 유지
- `삭제`: destructive Button, 기존 최신 revision 재조회 → 비밀번호 재인증 → If-Match DELETE 계약 유지

메뉴 trigger에는 프로젝트명을 포함한 accessible name을 사용한다. 열릴 때 첫 항목으로 focus를 이동하고 Arrow/Home/End와 Escape를 지원한다. Escape 및 command 완료 뒤 focus는 More trigger로 복귀한다. 메뉴는 body portal + fixed positioning으로 table overflow에 잘리지 않게 하고 viewport gutter 안으로 보정한다. clipboard fallback dialog가 필요한 경우 dialog가 유지되도록 메뉴 컴포넌트 수명을 보존한다.

검증 기준은 390/768/1024/1440px과 Wide Desktop이며 Desktop에서는 불필요한 document-level horizontal overflow가 없어야 한다. API schema, DB schema, 목록 정렬, Project 권한 모델은 변경하지 않는다.

## 구조와 UI 정책

`WorkspaceNotifications`는 Gantt 복구 key 밖에 위치한다. 프로젝트 workspace는 publicId를 key로 사용하여 다른 프로젝트에 이전 오류를 섞지 않는다. 목록은 별도의 알림 범위를 가진다. 서버 영구 저장, localStorage, push notification 권한은 사용하지 않는다.

`notificationReducer`는 성공/안내/오류를 호출 지점에서 명시적으로 분류한다. 문구 문자열로 심각도를 추정하지 않는다. Toast는 가장 최근 한 건을 표시하며 5초 후 사라진다. 이전 Toast 타이머가 새 Toast를 지우지 않도록 notice ID를 검사한다. 오류는 Toast가 사라지거나 후속 성공이 발생해도 알림함에 남는다.

오류는 최신순 최대 50건이다. 한도를 넘은 이전 항목의 제외 건수를 표시한다. 패널을 열면 표시 중인 항목을 읽음 처리하고 열린 동안 도착한 오류도 읽음으로 처리한다. “읽은 알림 지우기”는 명시적 사용자 동작이다. 이 보관 상한·읽음 시점은 구현 정책이며 사용자가 숫자를 지정한 것으로 표현하지 않는다.

비근무일 시작의 다음 근무일 보정은 성공 Toast의 부가 안내다. 권한/검증/충돌/네트워크/서버/화면 복구 실패는 보관하는 오류다. 412 후 canonical 재조회에 실패하면 성공적으로 재조회했다고 알리지 않는다. 명시적인 실패 복구에서만 기존 Gantt reset 경로를 사용한다.

`WorkspaceDialog`는 native dialog의 top layer를 사용한다. 설정 모달 안에서도 안내가 보이도록 해당 dialog 안에 live region을 둔다. 알림함에는 자체 복사 안내 live region을 사용한다. Escape/닫기 후 원래 버튼으로 `preventScroll` focus를 복귀한다. 전송 중인 파괴적 동작은 중복 제출과 닫기를 차단한다. 좁은 화면과 긴 내용은 최대 viewport 크기 및 내부 스크롤/줄바꿈으로 처리한다.

## 삭제 API 흐름과 오류

```text
목록 삭제 클릭
→ GET /api/projects/{publicId} (표시할 최신 이름과 revision)
→ 경고·비밀번호 모달
→ 사용자 제출
→ POST /api/projects/{publicId}/edit-sessions
→ 204인 경우에만 DELETE /api/projects/{publicId} + If-Match
→ 204 후 목록에서 제거
```

입력한 비밀번호는 전송 시작/실패/취소 시 입력 상태에서 제거한다. 원문을 URL·알림·clipboard·로그에 넣지 않는다. 잘못된 비밀번호, rate limit 또는 인증 오류에서는 DELETE를 호출하지 않는다. 412이면 삭제를 자동 재시도하지 않고 사용자가 최신 정보부터 다시 확인하도록 한다. 네트워크 실패로 삭제 결과가 불명확하면 성공으로 단정하지 않는다. 새 API나 DB migration은 추가하지 않는다. 삭제 UI에서의 재인증 정책이며 서버 DELETE 자체는 기존 edit session 계약을 유지한다.

## 링크 URL과 clipboard 보안

공용 `buildProjectShareUrl`은 신뢰한 배포 설정을 기존 `parseApplicationBaseUrl`로 검사하고 허용한 publicId만 결합한다. 서버 페이지는 완성 URL 또는 null만 client에 전달한다. 요청 Host/forwarded header, `window.location.href`, 이름, query/hash와 비밀값을 URL 생성 입력으로 사용하지 않는다. 잘못되거나 없는 APP_BASE_URL은 임의의 origin으로 대체하지 않는다. 끝 슬래시·스킴·포트·subpath 정책은 기존 설정 검증을 그대로 따른다.

복사는 명시적인 사용자 클릭 뒤 `navigator.clipboard.writeText`가 성공한 경우에만 성공 안내를 낸다. 거부·미지원이면 읽기 전용 URL과 수동 복사 안내, 다시 시도 버튼이 있는 모달을 연다. 앱은 clipboard 읽기 권한을 요청하지 않는다. 알림 복사도 사용자 클릭으로만 실행하며 선택 가능한 읽기 전용 텍스트를 항상 제공한다.

알림에는 코드에 정의된 안전한 메시지, locale 발생 시각, 작업 종류, 프로젝트 publicId 범위만 사용한다. 서버 메타데이터는 허용한 error code 및 UUID 형식 requestId만 포함한다. 서버가 제공하지 않은 코드를 만들어 넣지 않는다. 원문 응답·예외 message·stack·SQL·Password/PAT/Cookie/Session은 표시/복사하지 않는다.

HTTP 사내 주소에서는 브라우저의 secure-context 정책에 따라 자동 clipboard 쓰기를 사용할 수 없을 수 있다. 수동 복사는 이 경우의 정상적인 지원 경로다. localhost는 링크를 여는 장치 자신을 가리키므로 다른 장치에 공유할 배포 주소로 사용할 수 없다. 이 기능은 HTTPS/HTTP 운영 지원, 인터넷 공개, 방화벽·네트워크 접근권한 또는 subpath 배포를 새로 추가하지 않는다.

## 보충 테스트 계획과 추적

[GitHub-first 검증 정책](REMOTE_VALIDATION.md)을 따른다. 기존 로컬 테스트 실행 보류는 유지하고, 이번에 승인된 원격 Actions로 전체 회귀를 수행한다. 문서와 코드 정적 검토를 실행 PASS로 표시하지 않는다.

| 검증 항목 | 실행 가능한 테스트 |
| --- | --- |
| 잘못된 설정·스킴·포트·슬래시·publicId·query/hash/secret 제외 | `tests/server/project-share-url.test.ts` |
| 분류·오류 보관 상한·읽음·타이머 ID·안전한 메타데이터·복사 형식 | `tests/features/workspace-notification-state.test.ts` |
| 실제 Chromium clipboard 쓰기, 목록/상세 일치, 비밀번호 오입력 후 DELETE 0회, 정상 DELETE 1회, 삭제 후 404 | `tests/e2e/project-create-and-read.spec.ts` |
| 서로 다른 두 프로젝트의 실제 링크 구분, rename 이후 링크 유지, 복사 시 mutation/revision 불변, 취소 후 비밀번호 삭제, 같은 세션 새 탭/새 세션 직접 Readonly | `tests/e2e/project-links-persistence.spec.ts` |
| 5초 Toast, 오류 직후 성공에도 오류 보존, 미확인/읽음, Gantt DOM·geometry·scroll, 프로젝트 격리, 390px 화면 | `tests/e2e/project-notifications.spec.ts` |
| Clipboard 거부/미지원·재시도·수동 복사와 키보드/focus | 같은 notification spec. 거부·복구 분기는 mock, 실제 쓰기는 위 persistence spec과 구분 |
| 모달 top layer 안의 오류 안내와 닫은 뒤 알림함 보존 | `tests/e2e/project-modal-feedback.spec.ts` |
| 팝업 없는 첫 하위 추가·지연/연속/중복 추가, 401/412/검증/500/network/canonical 복구 | `tests/e2e/project-gantt-stability.spec.ts` |
| 실제 DB 지속성·부모 집계·편집기 초안·권한·날짜·레이아웃 | 기존 task-persistence, task-editor*, edit-authorization, workspace-layout spec |

새 테스트도 기존 isolated application fixture를 사용한다. 테스트별 서버/SQLite 격리는 유지하고 production 생성 제한 5회/시간을 완화하지 않는다. skip/임의 재시도/timeout 확대를 통과 수단으로 사용하지 않는다.

## 확인한 CI 실패와 조치

[CI #44](https://github.com/planner77/masterGantt/actions/runs/34762934120), head `e9b23d942a9d168ac439049efac746145feacd7b`: quality와 Docker는 PASS, Chromium은 31건 중 30 PASS/1 FAIL이었다. 실패는 `project-edit-authorization.spec.ts:75`의 전역 `getByRole('status')`가 설정 모달 내 live region과 workspace Toast 둘에 일치한 strict mode 오류다. 비밀번호 또는 저장 API의 실패로 판단하지 않는다.

후속 커밋 `c88f3666e934a0a530213e29f0d272bae6facc37`에서 W05 알림 검증을 `getByTestId('workspace-toast')`로 한정했다. 모달 안내를 제거하거나 접근성 기능을 숨겨 테스트를 통과시키지 않았다. 모달 내부 안내는 별도 테스트로 유지한다.

이 문서를 포함한 최종 head의 원격 quality/E2E/Docker 결과는 PR #23의 검증 댓글에 run/job/head와 함께 기록한다. 과거 PASS 또는 진행 중인 실행을 최종 PASS로 전용하지 않는다. 이번 변경에는 main GHCR digest smoke가 적용되지 않는다.

## 정적 검토 및 환경별 한계

PR #23 병합 이후 남은 두 리뷰의 수정·독립 검토는 [PR23_FOLLOWUP.md](PR23_FOLLOWUP.md)에서 별도로 추적한다. 아래 미실행 환경 항목은 자동화 PASS와 구분하며, 사내 HTTP에서의 수동 clipboard 설명은 비운영 환경 동작에 관한 것이다. 현재 production HTTPS-only 정책을 완화하지 않는다.

보호 API/DB/domain/CI gate 변경 없이 UI와 테스트를 통합했다. 별도 독립 에이전트를 실행했다고 주장하지 않으며 최종 정적 검토와 GitHub 실행 증거를 구분한다. 실제 사내 HTTP reverse proxy, Windows clipboard·스크린리더, 최종 사용자 UX는 NOT TESTED다. 실제 배포 환경의 PASS를 GitHub Chromium 결과만으로 주장하지 않는다.

## 공식 참고

- [SVAR React Gantt Willow 기본 데모](https://docs.svar.dev/react/gantt/samples/#/base/willow): 공개 데모 진입점 확인. 이 환경에서는 JavaScript 데모를 직접 조작한 것으로 보고하지 않는다.
- [SVAR add-task 공개 API](https://docs.svar.dev/react/gantt/api/actions/add-task/): native 추가 이벤트 경계 유지.
- [MDN Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText): Promise 성공 후 안내, secure context·거부 처리.
- [MDN HTMLDialogElement.showModal](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal): 모달 top layer와 외부 콘텐츠의 inert 경계.

## Issue #76 Project Workspace 현재 계약

Issue #76부터 프로젝트 상세 화면은 다음 3단 계층을 현재 UX 계약으로 사용한다.

1. **Global App Shell**: masterGantt brand, 프로젝트/리소스 primary navigation, global utility. 기존 75rem 중앙 cap을 적용하지 않고 viewport 기반 gutter를 사용한다.
2. **Compact Project Context**: 프로젝트명과 읽기 전용/편집 중 상태를 항상 표시한다. Description, Owner, Revision은 Info UI로 progressive disclosure 한다. Share/Export/Settings/Copy는 action hierarchy에 따라 직접 action과 overflow로 구분한다.
3. **Workspace View**: `일정`과 `리소스`를 peer tab으로 제공한다. 일정이 기본 view이며 tab 전환은 mutation/navigation/reload를 발생시키지 않는다.

Readonly 상태의 password form은 작업공간 위에 상시 노출하지 않는다. 사용자가 `편집 잠금 해제`를 실행한 경우에만 Dialog에서 기존 edit-session API를 사용한다. 401/412 fail-closed, Origin/If-Match/revision, BFCache permission recheck 계약은 유지한다.

Resource workload는 더 이상 page 하단 portal로 누적하지 않고 Resource tab의 full-width content로 표시한다. Group → Resource → Task hierarchy, M/D·M/M·Refresh toolbar, 미설정/과투입 상태와 기존 workload API/calculation 계약은 유지한다.

탭 panel은 동일 Project Workspace 안에서 mount 상태를 유지해 일정 → 리소스 → 일정 전환 시 SVAR Gantt instance, tree/column/scale/selection/scroll 상태가 UI 전환만으로 불필요하게 초기화되지 않도록 한다. 세부 공통 기준은 [UI/UX Guidelines](UI_UX_GUIDELINES.md)를 따른다.


## Issue #83 Project Task / Resource 검색 UX

일정 탭 Toolbar는 즉시 통합 검색, 고급 필터 진입, 전체 초기화, match count를 제공한다. 고급 panel은 text/date/number/enum/assignment 타입에 맞는 native control을 사용하고, Resource/Group 선택은 종류 + 이름/code 검색 + 다중 checkbox + ANY/ALL을 사용한다. 필터된 child를 표시하는 ancestor Summary는 context row이며 결과 수에 포함하지 않는다.

Gantt는 canonical tasks/links를 계속 보유하고 SVAR 2.7.3 공개 `filter-tasks` action으로 가시성만 바꾼다. DOM 행 숨김이나 Project mutation을 사용하지 않는다. 필터 해제 시 같은 Gantt instance에서 canonical hierarchy가 복원된다.

리소스 탭은 기존 Group → Resource → Task 구조를 유지한다. 통합 검색은 assigned target의 name/code/description을 사용하고 kind/active/연결 Task effective 기간을 조합한다. workload summary는 전체 Project 집계임을 명시하고 조건에 맞는 표시 행/Task detail만 제한한다.


## Issue #84 Project List 검색/필터 UX

Project List 상단에는 `프로젝트 검색`, 적용 조건 수를 포함한 `필터 N`, `초기화`, 결과 수를 배치한다. Quick Search는 프로젝트명·소유자·설명을 동시에 검색하며 고급 조건과 AND로 결합한다. 고급 panel은 Project명/소유자/설명의 typed text operator, 소유자 지정 여부, 생성일/최근 변경일의 날짜 조건을 제공하고 각 활성 조건을 개별 삭제할 수 있다.

날짜 입력은 native date control을 사용하며 목록 날짜 표시와 동일한 browser timezone calendar date로 비교한다. 잘못된 range는 자동으로 뒤집거나 추정하지 않고 panel에 오류를 표시하며 해당 invalid condition을 결과 predicate에 적용하지 않는다.

검색 결과 수는 `일치 / 전체` 텍스트로 표시한다. 실제 Project가 0개면 기존 `EmptyProjects`를 사용하고, Project는 존재하지만 결과가 0개면 별도의 “조건에 맞는 프로젝트가 없습니다.” 상태와 초기화 action을 제공한다. 검색 상태에서도 Project Link와 Row Action 메뉴를 그대로 사용할 수 있고 삭제 성공한 Project는 즉시 결과에서 제거된다.

필터 panel은 keyboard 접근 가능한 native controls를 사용한다. Escape 또는 닫기 버튼으로 panel을 닫으면 Filter trigger로 focus를 복원한다. 390/768/1024/1440/wide desktop에서 document-level unintended horizontal overflow를 만들지 않는다.

## Issue #138 프로젝트 상태와 목록 필터

프로젝트 상태는 `planned`(예정), `in_progress`(진행 중), `completed`(완료)의 별도 데이터다. Project List는 `상태` 열에 텍스트 badge를 표시하고, 상세 Context에는 프로젝트 상태와 읽기 전용/편집 권한 badge를 구별해 표시한다. 예정은 info, 진행 중은 selected, 완료는 success semantic token을 쓰되 한국어 상태 텍스트를 항상 함께 표시한다. 새 프로젝트의 상태 선택 기본값은 예정이며, 편집 가능한 사용자는 기존 프로젝트 설정에서 상태를 바꾼다. 상태에는 강제 전이 순서가 없다. 읽기 전용 사용자는 canonical 상태만 확인한다.

목록의 기존 고급 필터에는 native checkbox 세 개를 포함한 `프로젝트 상태` fieldset을 둔다. 첫 진입과 초기화는 예정+진행 중을 선택하고 완료를 제외한다. 필터 안내에서 완료 프로젝트를 선택해 표시할 수 있음을 알린다. 세 상태 모두 선택하거나 하나/아무것도 선택하지 않은 경우도 명시적 사용자 조건이다. 상태 선택이 기본 두 값과 다르면 적용 조건 수에서 한 조건으로 세고 초기화 버튼을 표시한다. 아무것도 선택하지 않으면 선택 상태가 없다는 원인을 적은 결과 0건 상태와 초기화 경로를 표시한다. 상태는 기존 Quick Search·이름/소유자/설명·날짜 조건과 AND이며, 목록 전체 수에는 완료 프로젝트도 포함한다. 필터 변경 자체는 API 재조회나 mutation을 하지 않는다. 필터는 현재 List view의 일시적 상태이며 새 진입에서 기본값으로 돌아간다. URL이나 localStorage에 저장하지 않는다.

상태 저장은 기존 프로젝트 metadata PATCH의 `If-Match` revision 및 401/412 경로를 사용하고, 성공 시 canonical snapshot의 상태로 목록·상세를 표시한다. 실패한 초안 상태를 현재 상태처럼 표시하지 않는다. 목록의 좁은 상태 열을 포함한 table은 390/768px에서 table wrapper 안에서만 가로 스크롤하며 문서 자체에는 가로 overflow를 만들지 않는다. 1024/1440px에서도 헤더·행 작업과 상태 텍스트를 함께 볼 수 있어야 한다. `tests/e2e/project-status.spec.ts`와 기존 List E2E의 열 위치 검증을 갱신했다. 로컬 브라우저·테스트 및 전후 화면 실측은 사용자 지시에 따라 **NOT TESTED**이며 PR CI로 판정한다. API/DB migration 계약 문서는 backend 작성 범위다.

## Issue #181 Project List 고급 필터 패널 밀도

Project List의 검색 도구줄 순서와 `필터 N` accessible name은 유지한다. 고급 필터에서 프로젝트 상태는 항상 보이는 compact checkbox row로 유지하고, `프로젝트 정보`와 `날짜`는 native `details/summary` disclosure로 묶는다. 패널을 새로 열 때 해당 그룹에 활성 조건이 있으면 펼친 상태로 시작하고, 활성 조건이 없으면 접힌 상태로 시작한다. 사용자가 활성 그룹을 다시 접더라도 summary에는 적용 조건 수와 프로젝트명·소유자·설명 값 또는 소유자 지정 여부, 날짜 그룹의 연산자·입력 값을 줄바꿈 가능한 텍스트로 표시해 현재 조건을 숨기지 않는다.

프로젝트 정보의 프로젝트명·소유자·설명·소유자 지정 여부는 1024/1440px에서 2열 compact grid, 390/768px에서 1열로 배치한다. 각 조건의 operator/value/삭제 action은 한 행에 가깝게 배치하되 좁은 폭에서는 세로로 안전하게 쌓인다. 생성일·최근 변경일도 같은 compact group을 사용하며 operator가 `전체`이면 날짜 input과 삭제 action을 렌더링하지 않는다. native summary의 keyboard semantics와 공통 focus outline을 사용하고 별도 custom disclosure state나 새 UI framework는 도입하지 않는다.

#84의 Quick Search+고급 조건 AND predicate, browser-timezone 날짜 비교와 invalid range 미적용, 조건 수·전체 초기화·no-result, #138의 예정+진행 중 기본 상태와 상태 checkbox, #177의 Project List 상태 즉시 변경 및 client-side filter 재평가, API 재조회 없음, Escape/닫기 후 Filter trigger focus 복귀를 변경하지 않는다. 공통 `.project-filter-panel`은 일정/리소스 필터가 공유하므로 #181의 배치 규칙은 Project List CSS module에 한정한다. 390×844·768×900·1024×900·1440×900에서 접힌 패널 geometry, document horizontal overflow, summary keyboard/활성 값 표시와 screenshot을 E2E로 검증한다. 구현 전 동일 fixture의 legacy panel 실측·캡처는 별도 baseline 증거가 확보되기 전까지 **NOT TESTED**다.

## Issue #115 작업 캘린더 미리보기 상태

프로젝트 설정의 작업 캘린더 초안은 국가, 적용 범위·기간, 휴무일 이름·날짜·대상·대상 선택, 규칙·휴무일 추가·삭제가 바뀔 때마다 이전 미리보기를 즉시 숨긴다. 입력을 원래 값으로 되돌려도 이전 결과를 자동으로 다시 표시하지 않으며, 사용자가 `미리보기 계산`을 다시 실행해야 한다. 결과는 계산 당시의 프로젝트 publicId, revision, 요청 본문과 일치할 때만 표시한다. 다른 프로젝트·revision의 늦은 성공/오류 응답은 현재 상태나 알림을 덮어쓰지 않는다.

한 개의 간결한 live status가 초기 안내, 재계산 필요, 계산 중, 실패 후 재시도, 완료 요약을 전달한다. 자세한 변경 작업과 휴무일 목록은 이 live region 밖에 둔다. 계산 중에는 초안과 저장·미리보기 버튼을 잠그며, 계산 실패 때는 결과를 숨기고 재시도 방법을 표시한다. 미리보기는 저장 전 필수 단계가 아니다. 저장 성공 시 이전 미리보기를 지우고 기존 canonical 일정 재조회·알림 경로를 사용한다. 저장 응답을 미리보기 결과처럼 표시하지 않는다. 기존 edit session, Origin, If-Match, 401/412 처리와 서버 인가 계약은 그대로 따른다.

자동 Chromium 검증은 `tests/e2e/project-work-calendar-preview.spec.ts`가 실제 KR→US 미리보기·저장 요청, 초안 변경, 실패·재시도, metadata 저장에 따른 revision 변경·editor unmount 뒤 늦은 응답, 390/768/1024/1440px 상태·버튼 접근을 확인한다. Metadata 저장은 기존 설정 창을 닫으므로 같은 editor 인스턴스에서 revision prop만 바뀌는 경로는 브라우저에서 직접 재현하지 않는다. publicId/revision 일치 검사와 요청 토큰 경계는 코드 검토 및 원격 회귀와 함께 판정한다. 스크린리더와 실제 기기 조작은 별도 환경 검증이다.

## Issue #116 작업 Context Menu 하위 메뉴 배치

변경 전 UI/UX 재현 근거는 390×844에서 root x=8..264, `Add` child x=253..421로 오른쪽 31px가 잘리는 상태다. 작업 메뉴의 활성 하위 메뉴는 실제 root와 하위 메뉴 폭을 기준으로 오른쪽 공간이 충분하면 오른쪽, 오른쪽이 부족하고 왼쪽이 충분하면 왼쪽에 표시한다. 양쪽 모두 부족하면 root와 같은 폭의 drilldown으로 전환한다. 390px 화면의 `Add`는 focus만으로 열리지 않으며 클릭·Enter·Space·ArrowRight로 연다. `Back` 또는 ArrowLeft는 부모 메뉴로 돌아가고 Escape는 메뉴 전체를 닫고 원래 작업 행/막대로 focus를 복원한다. 넓은 화면의 hover·focus 진입과 root 최초 focus 및 닫힌 하위 메뉴 상태는 유지한다.

하위 메뉴 trigger는 `aria-expanded`와 열린 메뉴를 가리키는 `aria-controls`를 제공한다. 하위 메뉴는 이름이 있는 `role=menu`이고 비활성 명령은 그대로 비활성으로 남는다. 넓은 화면에서 ArrowLeft는 부모 trigger에 focus를 돌려주고 child를 닫는다. 하위 메뉴가 열린 상태에서 `Edit`·`Cut` 등 일반 root 명령으로 keyboard focus 또는 mouse pointer가 이동하면 열린 child를 즉시 닫고 해당 trigger의 `aria-expanded=false`를 유지한다. 좁은 drilldown에서 활성 명령이 하나도 없으면 `Back`이 focus를 받는다. 짧은 화면에서는 메뉴 높이를 `100dvh - 16px` 이내로 제한하고 내부 스크롤과 고정된 `Back`을 사용하며 Arrow/Home/End 탐색은 문서가 아닌 메뉴 내부를 스크롤한다. Context Menu의 권한·revision·선택 Task endpoint link 제한, #104의 무관한 Task 동작, canonical Gantt instance 유지 계약은 변경하지 않는다. API·DB·스케줄링 문서 변경은 N/A다.

2026-09-24 확인: 설치 버전은 `@svar-ui/react-gantt` 2.7.3이다. [SVAR 공식 ContextMenu 가이드](https://docs.svar.dev/react/gantt/guides/configuration/configuring_context_menu/)는 공개 Core `ContextMenu`의 `options`/`data` 하위 항목과 `resolver`/`filter`를 설명한다. 이 프로젝트의 작업 명령은 앱의 인가·revision·clipboard·canonical 동기화 경계를 포함해 기존 사용자 메뉴를 유지하며 PRO 전용 기능을 복제하지 않는다. UI/UX 조사에서 공식 데모는 1440px hover와 390px 항목 화면 관찰까지만 근거가 있으며 keyboard 동작은 **NOT TESTED**다. 본 변경의 코드·E2E 명세는 작성했다. 로컬 브라우저·자동 검증은 실행하지 않았고, PR 원격 CI 결과는 해당 PR의 head SHA와 run으로 별도 판정한다.


## Issue #117 리소스 공수 조회 상태

Resource tab은 공수 계산 결과와 assigned-targets 이름·코드·설명 정보를 독립적으로 조회·표시한다. 한쪽 API의 실패가 다른 쪽 성공을 숨기지 않는다. 공수 첫 조회 실패 때는 결과가 없음을 명시하고 빈 검색 결과와 구별한다. 메타데이터 첫 조회 실패 때는 공수 응답에 포함된 Group·Resource 기본 이름과 Resource 기본 코드의 검색·표시를 유지한다. Group 코드는 공수 응답에 없어 메타데이터 성공 전에는 검색할 수 없으며 설명 검색도 제한됨을 알린다. 각 상태에는 별도의 오류 안내와 재시도 버튼이 있다. 전역 `새로고침`은 두 조회를 다시 시작하며 어느 한쪽이라도 조회 중이면 중복 요청을 막기 위해 비활성화한다.

성공한 조회를 새로고침하다 실패하면 마지막 성공 결과를 계속 보여 주되, 실패 상태와 마지막 성공 확인 시각을 함께 표시한다. assigned-targets가 독립적으로 최신화되면 검색뿐 아니라 Group·Resource 행의 이름과 코드도 최신 메타데이터를 우선 사용하고 workload snapshot 값은 메타데이터 실패 시 fallback으로만 사용한다. 늦은 이전 요청의 성공·오류는 최신 요청을 덮지 않는다.

개별 재시도 버튼은 요청 중에도 같은 DOM 위치에 유지되고 disabled/aria-busy 상태로 전환하여 keyboard focus를 잃지 않는다. 실패하면 같은 버튼이 다시 활성화되고 성공하면 완료 상태로 전환된다. 재조회·부분 실패는 검색/종류/상태/기간 필터, M/D·M/M 선택, 열린 Group·Resource details, 일정·리소스 tab 상태와 SVAR Gantt instance를 초기화하지 않는다. Resource API·domain·권한 계약은 변경하지 않으며 API/DB/스케줄링 문서 영향은 N/A다.


## Issue #118 Project Context와 일정 도구줄

긴 Project 이름은 제목 영역에서만 한 줄 말줄임으로 표시하고 전체 이름은 제목의 tooltip에서 확인한다. 읽기 전용/편집 중 badge, 정보 버튼, 공유·내보내기·설정 등 action의 문구는 글자 단위로 줄바꿈되지 않고 읽을 수 있는 크기와 위치를 유지한다. 정보 panel은 viewport 폭 안에 두고 긴 설명은 panel 내부에서 스크롤한다.

390/768px 일정 도구줄은 첫째 줄에 검색과 필터 버튼, 둘째 줄에 일치 결과와 조건이 있을 때만 표시하는 초기화 버튼을 둔다. 필터 버튼의 `aria-expanded`와 `aria-controls`는 고급 필터 panel의 열린 상태와 연결된다. 열린 panel에서 Escape를 누르면 닫고 필터 버튼으로 focus를 돌린다. 초기화 후에는 검색 입력으로 focus를 돌린다. 1024/1440px는 기존 넓은 도구줄 구성을 유지한다. 도구줄 조정은 Project Workspace에만 적용하며 SVAR Gantt 내부 scale toolbar는 변경하지 않는다.

검색·필터·정보 panel 조작과 일정↔리소스 tab 이동은 canonical Gantt instance를 재생성하지 않는다. Gantt 내부 표시 단위 선택과 차트 가로 스크롤도 유지한다. 390/768/1024/1440px의 readonly/editing 각 상태에서 Gantt의 상단 위치·높이, 문서 가로 overflow와 버튼 접근성을 E2E로 확인할 명세를 작성했다. 명세의 `search-idle`/`search-reset` 캡처는 새 구현 안의 두 조작 상태이며 구현 전후 비교 자료가 아니다. Gantt 높이 개선을 판단하려면 동일 fixture·viewport·상태의 구현 전 baseline과 변경 후 측정이 별도로 필요하다. 기존 다른 높이·fixture의 수치를 합격 기준으로 대체하지 않는다. 코드·명세는 작성했으나 로컬 브라우저·테스트·빌드 및 실제 전후 수치는 **NOT TESTED**이며 원격 PR CI는 해당 head/run으로 별도 판정한다. Project API·DB·Scheduling 계약 변경은 N/A다.


## Issue #119 반복 입력과 필드 오류 연결

작업 편집의 반복 리소스 투입 입력은 리소스별 fieldset/legend와 고유한 투입 시작·종료·투입률 이름을 제공한다. 투입률 범위와 날짜 순서 오류는 해당 입력의 `aria-invalid`·`aria-describedby` 및 인접 오류로 연결한다. 명시적 `할당 저장`에서 여러 오류가 있으면 요약으로 focus를 옮기고, 요약의 각 항목을 실행하면 해당 리소스 입력으로 이동한다. 필터로 가려진 대상은 오류 항목 실행 시 표시한 뒤 focus한다. 잘못된 초안은 유지하며 할당 PUT을 보내지 않는다. 작업 저장과 할당 저장은 계속 독립 계약이다.

캘린더의 반복 국가 규칙·휴무일은 항목별 fieldset/legend와 순번을 포함한 고유 control 이름을 제공한다. 기간·이름·날짜·대상 선택 오류를 각 입력에 연결하고, 명시적 Preview/Save에서 오류 요약으로 focus를 옮긴다. 잘못된 초안에서도 두 버튼은 누를 수 있으며 클라이언트 검증 후 API 요청 0회로 멈춘다. 타이핑 중 focus를 강제로 옮기지 않는다. 외부 disabled 또는 계산·저장 중에는 기존처럼 버튼과 입력을 잠근다. #115의 live preview status, 초안 무효화, publicId/revision/늦은 응답 방어, 401/412/If-Match 및 canonical 저장·재조회 계약은 유지한다.

Project 생성은 이름·소유자·비밀번호의 오류를 각각 연결하고 명시적 제출 때 복수 오류 요약으로 focus를 옮긴다. 요약 항목은 해당 입력으로 이동하며 잘못된 제출은 API 요청 없이 입력 초안을 보존한다. 서버 거부·비밀번호 처리 경로는 기존 계약을 유지한다. 네 viewport의 keyboard-only E2E 명세는 작성했으나 로컬 브라우저·테스트·빌드는 **NOT TESTED**다. Project/Assignment/Calendar API·DB·Scheduling 계약 문서 변경은 N/A다.

## Issue #121 App Shell 본문 바로가기

App Shell의 header 앞에 `본문으로 바로가기` 링크를 둔다. 키보드 첫 Tab에서만 화면에 나타나며 링크는 같은 페이지의 `#main-content`로 이동한다. `main`은 `tabIndex=-1`인 focus 대상이어서 Enter 뒤 본문으로 focus가 옮겨지고, 본문에 조작 가능한 control이 있으면 다음 Tab이 그 control로 이어진다. 빈 목록·리소스 관리·생성 화면·프로젝트 조회 중/오류/정상 화면에서 같은 main landmark를 사용한다. 조회 중처럼 본문 control이 없는 상태는 main focus까지 확인한다.

Modal dialog가 열려 있을 때는 기존 native focus trap이 우선하며 skip link가 dialog 밖으로 focus를 빼앗지 않는다. Escape로 닫으면 기존 설정 trigger focus 복원도 유지한다. 링크는 390/1440px에서 focus 상태에만 보이고 화면 밖 가로 overflow를 만들지 않는다. 리소스 관리로의 client navigation에서도 main landmark를 유지하며, 스크롤된 페이지에서는 fragment 이동이 main을 다시 화면에 놓는다. 같은 문서의 fragment만 바뀐 `popstate`는 편집 권한 재확인·reload를 시작하지 않는다. 실제 history 복귀와 BFCache `pageshow.persisted`의 fail-closed 재확인은 계속 수행한다. Fragment 이동 자체는 API mutation이나 Gantt 재생성을 수행하지 않는다. 현재 코드는 native anchor 동작을 사용하며 browser별 focus·scroll 결과와 실제 focus 상태 캡처는 원격 Chromium E2E에서 판정한다. API/DB/Scheduling 계약 문서 영향은 N/A다.

## Issue #130 Phase 1 Project List 시각 정합화

Project List는 기존 native table, Project 이름 Link, 행별 More 메뉴와 #84 검색·필터를 유지한다. 페이지 제목과 목록 사이의 간격, 테이블 헤더·행 간격을 compact하게 정렬한다. Project 이름은 기본 텍스트와 강조된 Link, 소유자·최대 두 줄 설명·날짜는 보조 정보, 날짜는 tabular 숫자로 표시한다. 헤더·구분선·hover/focus·More 메뉴는 #120 의미 토큰을 사용한다. 새로운 행 선택 상태나 검색 predicate는 추가하지 않는다.

390px에서는 최소 62rem table을 목록 wrapper 안에서 가로 스크롤하며 문서 자체의 가로 스크롤을 만들지 않는다. More 메뉴는 기존 portal의 viewport 배치, Arrow/Home/End·Escape와 focus 복원을 유지한다. Copy/link/delete, 삭제 auth·If-Match·401/412 및 빈 목록과 검색 결과 0건의 서로 다른 상태는 기존 계약을 따른다.

같은 긴 한국어·영어 Project 이름/설명과 소유자, 3개 이상 행 fixture를 390×844·768×900·1024×900·1440×900·1600×900, browser zoom 100%에서 구현 전후 각각 측정·촬영한다. wrapper/client/scroll 폭, 열 폭·행 높이, 문서 overflow, 메뉴 bounds와 keyboard focus를 비교한다. 현재 E2E는 새 구현 상태의 캡처와 동작 assertion을 준비했으며, 구현 전 baseline과 실제 브라우저 수치·이미지는 아직 확보하지 않았다(**NOT TESTED**). 따라서 새 캡처를 전후 개선 증거로 사용하지 않는다. API/DB/Scheduling 계약 문서 영향은 N/A다.

## Issue #130 Phase 2 Project Workspace 시각 정합화

Project Context는 긴 제목만 한 줄 말줄임으로 제한하고, 읽기 전용·편집 중 badge, 정보, 공유·내보내기·설정/잠금 해제와 더보기는 줄바꿈 없이 접근 가능하게 유지한다. 제목·action 사이의 간격과 일정/리소스 탭 높이를 compact하게 정렬하며 배경·테두리·상태·focus에 #120 의미 토큰을 사용한다. 정보와 더보기 disclosure에서 Escape를 누르면 닫고 해당 summary로 focus를 돌린다. 정보 panel은 긴 설명을 내부 스크롤하고 viewport 안에 둔다.

일정/리소스 탭의 ArrowLeft/ArrowRight/Home/End, `aria-selected`·`aria-controls`·tabpanel 연결과 탭 왕복 시 같은 Gantt instance를 유지한다. 주 단위 선택·chart 가로 스크롤, tree·column·selection은 기존 Gantt 회귀 계약을 따른다. #118 일정 검색 도구줄, #121 skip link, #119 forms와 #117 Resource 조회 상태는 변경하지 않는다. API/session/revision/401/412/If-Match/canonical 경로도 그대로다.

같은 긴 제목·설명 fixture의 읽기 전용/편집 중 상태를 390×844·768×900·1024×900·1440×900·1600×900에서 구현 전후 각각 촬영하고 Context·Gantt top/height, Info/More panel bounds, 문서 overflow를 비교한다. 현재 작성한 E2E의 PNG는 **변경 후 상태**만 기록하며 구현 전 같은 fixture의 baseline과 실제 수치는 아직 **NOT TESTED**다. 조회 중·조회 오류/재시도도 별도 E2E 명세로 기록한다. API/DB/Scheduling 계약 문서 변경은 N/A다.

## Issue #245 Gantt 이미지 내보내기

Project Context에는 compact `내보내기` 진입점 하나를 둔다. 공통 대화상자에서 Excel, SVG, PNG를 선택한다. Excel 형식에서는 기존 관계 포함/제외 선택을 유지한다. SVG/PNG 형식에서는 전체 Project 또는 기간 지정 scope를 표시하며 기간 지정에서만 시작일·종료일을 활성화한다. 전체는 펼친 WBS Grid+Chart, 기간 지정은 모든 작업 행을 유지한 Chart만 생성한다. 상세 API와 한도는 [IMAGE_EXPORT.md](IMAGE_EXPORT.md)를 따른다.

형식·범위와 날짜는 label이 있는 semantic control로 제공한다. 유효하지 않은 기간의 오류는 해당 입력과 연결하며, 작업 중에는 중복 실행을 막는다. Escape/취소와 닫기 후 trigger focus 복원을 유지한다. 390/768/1024/1440px에서 header action overflow가 없고 내보내기 전후 Gantt 선택·스크롤·Editor 초안이 보존되어야 한다. 이 항목의 실제 브라우저 검증은 해당 PR head의 E2E와 별도 수동 확인으로 판정한다.

## Issue #130 Phase 3 Task Editor 시각 정합화

Task Editor의 modal header는 작업 정보 제목과 작업 유형, External ID, 기준 Revision을 구분해 표시하고 닫기 action을 유지한다. 변경 제한·stale·저장 오류·초안 폐기 확인은 탭 위의 별도 notice 영역에 남긴다. Task/Resource/Relation 탭, 작업 입력과 서버 확정 정보, 관계 조회는 기존 semantic grouping을 유지한다. 좁은 화면에서는 작업 필드와 관계를 한 열로, 1024px 이상에서는 작업명/진행률과 선행/후행 관계를 해당 내용 폭에 맞게 나란히 놓는다.

Dialog 자체는 viewport 안에 두고 **본문만 세로 스크롤**한다. Header·탭·취소/저장/최신 정보 다시 불러오기 footer는 본문 스크롤 중에도 접근할 수 있다. Notice가 여러 개 쌓이면 notice 영역 안에서 스크롤해 본문·footer를 밀어내지 않는다. #120 의미 토큰으로 상태·focus·border를 정렬하되 Task Editor의 기존 compact control 높이와 #119 할당 fieldset/개별 오류 연결은 보존한다.

Dirty close/Escape 확인, stale 뒤 명시적 reload, 실패 시 draft 보존, 저장 중 중복 PATCH 방지, 읽기 전용과 Task PATCH·Assignment PUT의 독립 계약 및 Gantt instance·원래 행 focus 복원은 기존 경로를 따른다. Domain validation은 기존 `prepareTaskEditorCommand`에 맡긴다. 동일 fixture의 390×844·768×900·1024×900·1440×900·1600×900 구현 전후 modal/header/body/footer/필드/관계 geometry와 PNG가 비교 대상이다. 현재 E2E는 **변경 후 상태**만 기록하며 구현 전 baseline·실측, 로컬 브라우저·테스트·빌드는 **NOT TESTED**다. API/DB/Scheduling 문서 변경은 N/A다.

## Issue #130 Phase 4 Search / Filter 공통 표현

Project List, 일정, 리소스의 검색 도구줄은 넓은 화면에서 검색→`필터 N`→조건부 `초기화`→일치/전체 결과 순서로 표시한다. 390/768px에서는 검색·필터가 첫째 행, 결과·조건부 초기화가 둘째 행에 놓인다. 초기화 뒤 검색 입력으로 focus를 돌리고 고급 필터에서 Escape를 누르면 패널을 닫아 필터 버튼으로 focus를 복원한다. 표면·텍스트·테두리·focus·상태는 #120 의미 토큰을 사용하며 새 chip이나 필터 프레임워크는 도입하지 않는다.

Project List의 #84 Quick Search+고급 AND, browser timezone 날짜 및 잘못된 날짜 범위 무시 계약은 그대로다. 일정은 #83 client filter와 canonical Gantt instance를 유지하며, 섹션 설명은 정적 맥락만 보여 주고 동적 결과 수는 도구줄에서 한 번만 표시한다. Resource의 종류·활성·Task 기간 native control은 고급 필터 패널로 모으고, M/D·M/M·새로고침은 별도 공수 도구줄에 남긴다. Resource 날짜가 역순이면 기존처럼 두 날짜 사이 범위로 해석한다고 패널 안에서 알린다. 한쪽 날짜만 입력한 경우 '기간 시작일과 종료일을 모두 입력' 안내를 보여 주고 조건을 적용하지 않는다. 이 미완성 초안은 적용 조건 수 `필터 N`에서 제외하되 초기화로 지울 수 있다. 공수/assigned-targets의 조회 중·첫 실패·stale/부분 실패 상태와 결과 0건은 별개로 유지한다. 오류 카드도 #120 상태 토큰을 사용한다. 필터 조작은 API 재조회나 mutation을 하지 않는다.

같은 fixture의 Project List·일정·리소스 도구줄을 390×844·768×900·1024×900·1440×900·1600×900에서 구현 전후 각각 비교할 계획이다. 현재 명세는 **변경 후 상태**의 배치·focus·overflow·API 불변과 PNG만 작성했고 구현 전 같은 fixture의 baseline, 실제 브라우저 수치와 로컬 실행은 **NOT TESTED**다. API/DB/Scheduling 계약 문서 변경은 N/A다.

## Issue #155 Gantt Grid·Chart 전체화면

일정 화면의 Gantt 표시 단위 도구줄에 `전체화면` 버튼을 둔다. 버튼의 제목과 `aria-keyshortcuts`로 `Ctrl/Cmd+Shift+F`를 안내하며 `.project-gantt-frame`에 브라우저 native Fullscreen API를 요청한다. Grid·Chart·표시 단위·Gantt 내부 열/작업 메뉴만 전체화면에 포함하고 App Shell·프로젝트 정보·검색/필터·리소스 화면은 포함하지 않는다. `Escape` 또는 `전체화면 종료`로 원래 작업공간으로 돌아가며 버튼에 focus를 돌린다. 메뉴가 열린 경우 기존 메뉴 Escape 닫힘을 처리하되 브라우저가 동시에 native fullscreen을 끝낼 수 있다. 이 경우에도 focus가 유효하고 버튼 상태가 실제 `document.fullscreenElement`와 일치해야 한다.

입력 상자·inline 편집·대화상자·메뉴 안에서는 shortcut을 실행하지 않는다. 작업 정보 대화상자는 Gantt frame 밖에 있으므로 Grid/Chart의 편집기 진입 두 경로 모두 원래 호출 대상을 기억하고 **자기 Gantt 전체화면이 실제로 종료된 뒤** 대화상자를 연다. 종료가 거부되면 대화상자를 숨긴 채 오류를 안내하고 원래 대상에 focus를 유지한다. Fullscreen 요청/종료 거부·미지원에서는 상태를 성공으로 앞당기지 않으며 CSS 모의 전체화면으로 대체하지 않는다. Readonly에서도 전체화면 조회가 가능하나 서버 편집 권한은 바뀌지 않는다.

전환은 기존 SVAR 인스턴스를 재생성하지 않으며 Grid/Chart split·열 너비/표시 열·일/주 단위·가로/세로 scroll·선택·Summary 펼침 상태와 canonical snapshot을 유지해야 한다. 390/768/1024/1440px에서 실제 viewport 크기와 버튼·Grid·Chart 접근성을 확인한다. 새 E2E 명세와 변경 후 PNG는 작성했으나 로컬 브라우저·테스트·실제 전후 geometry는 사용자 지시에 따라 **NOT TESTED**다. Chromium 원격 CI와 실제 Edge/Chrome·OS의 fullscreen/키보드 동작은 별도 증거로 판정한다. API·DB·Scheduling 계약 및 문서 변경은 N/A다.

[SVAR 공식 Fullscreen guide](https://docs.svar.dev/react/gantt/guides/fullscreen/)는 React Core `Fullscreen` wrapper를 안내한다(확인 2026-09-24). 설치된 Gantt 2.7.3/Core 2.6.1에서 Core JavaScript export와 TypeScript 선언이 일치하지 않고 요청 거부·입력 guard·Task Editor 선행 종료를 이 화면의 계약에 맞게 제어할 수 없어, 이번 범위는 [표준 Fullscreen API](https://fullscreen.spec.whatwg.org/)로 frame만 전환한다. 공식 sample의 실제 브라우저 조작 비교는 수행하지 않았다.

## Issue #171 전체화면 우측 컨트롤 비중첩

Issue #155의 native fullscreen 계약을 유지하면서, 전체화면 내부 알림 버튼은 우측 상단에 고정된 독립 hit area를 갖고 Gantt scale toolbar는 그 영역을 침범하지 않아야 한다. 따라서 `.project-gantt-frame:fullscreen` 상태에서만 toolbar 우측 여유 공간을 예약한다. 일반 화면의 toolbar/알림 배치, Fullscreen API 대상, 단축키, focus 복귀, Gantt instance/state 보존 계약은 변경하지 않는다.

390/768/1024/1440px에서 전체화면 종료 버튼과 알림 버튼의 실제 bounding box가 겹치지 않아야 하며, 알림 버튼으로 알림함을 열고 닫은 뒤에도 같은 Gantt instance를 유지하고 전체화면 종료 버튼을 계속 사용할 수 있어야 한다. API/DB/Scheduling/권한 계약은 변경하지 않는다.

## Issue #136 공통 헤더의 빌드 버전

App Shell 브랜드 바로 옆에 `v<SemVer>`를 보조 텍스트로 표시한다. 값은 서버 컴포넌트가 빌드에 포함된 `package.json.version`에서 직접 읽으며 수동 버전 문자열이나 별도 설정값을 두지 않는다. 버전은 홈 링크 바깥에 있어 `masterGantt 홈` 링크의 이름과 이동 동작을 바꾸지 않는다. 544px 이하에서는 보조 버전을 숨기고 브랜드 이름을 우선하며, 416px 이하에서는 M 마크만 남겨 프로젝트·리소스·물류 관리 navigation과 알림 영역의 공간을 확보한다. 헤더 높이와 본문 작업 공간은 늘리지 않는다.

`tests/e2e/workspace-header-version.spec.ts`에 390px의 M 마크, 480px의 브랜드 이름, 768/1024/1440px의 브랜드와 버전, 각 폭의 헤더 높이·navigation·문서 가로 overflow 및 리소스 이동 후 브랜드 홈 복귀 명세를 작성했다. PNG는 변경 후 화면 자료이며 구현 전후 비교나 실제 브라우저 PASS를 뜻하지 않는다. 로컬 테스트·브라우저·빌드는 사용자 지시에 따라 **NOT TESTED**이고 PR head의 원격 CI는 별도로 판정한다. API·DB·Scheduling·권한 계약은 바뀌지 않는다.

## Issue #141 브라우저 제목과 파비콘

브라우저 탭의 비프로젝트 제목은 정확히 `masterGantt`다. 유효한 프로젝트를 열어 canonical 이름을 확인하면 공백 없이 `masterGantt|{프로젝트명}`으로 표시한다. 직접 URL·새로고침의 서버 초기 HTML 제목은 읽기 전용 snapshot의 확정 이름을 사용한다. 클라이언트가 조회 중일 때는 잠시 기본 제목을 허용하고, 조회 완료·설정 저장·재조회 후에는 확정 snapshot의 이름만 반영한다. 입력 중인 이름, 실패한 저장, 401 뒤의 초안은 제목에 반영하지 않는다. 412로 snapshot이 무효화된 재조회 중, 로딩·404·조회 실패 및 App Router 오류 경계에서는 기본 제목을 사용하고 재조회가 성공하면 새 canonical 이름으로 바꾼다. 다른 프로젝트 또는 비프로젝트 화면으로 이동하면 이전 프로젝트 제목을 남기지 않는다. 서로 다른 publicId가 같은 이름을 써도 이전 화면의 cleanup은 현재 URL의 제목을 덮어쓰지 않는다.

Next App Router의 `src/app/icon.svg`는 사이트 헤더의 파란 M 마크를 공유하는 정적 SVG 파비콘이다. 헤더 브랜드·버전 표시는 변경하지 않는다. `tests/e2e/project-browser-title-favicon.spec.ts`에 favicon 응답, 서버 초기 HTML과 hydration 뒤 제목, 비프로젝트 화면, 직접 진입·새로고침·SPA 목록 경유 전환(동일 이름·서로 다른 publicId 포함), 이름 저장과 실패·401·412·조회 실패의 제목 명세를 작성했다. App Router 오류 경계에는 테스트에서 형태가 잘못된 조회 응답을 주입해 화면 오류·재시도 버튼과 기본 제목 복원을 확인한다. 실제 Chromium 결과와 Edge/Chrome/Firefox/Safari 브라우저 탭에서의 시각 확인, 로컬 test/lint/typecheck/build는 **NOT TESTED**이며 PR head CI와 환경별 수동 검증으로 판정한다. API·DB·Scheduling·권한 계약 변경은 N/A다.

## Issue #140 Gantt Grid 작업명 인라인 편집

편집 가능한 프로젝트의 Grid `작업` 열에서 Summary·Task·Milestone의 이름 텍스트를 한 번 클릭하면 SVAR Core text editor가 열린다. 셀 여백, Summary 펼침 아이콘, 다른 열, Chart와 Context Menu는 이 진입점이 아니다. Grid의 기본 키보드/F2와 이름 더블클릭도 같은 이름 전용 검증·저장 경로를 사용한다. Enter 또는 일반 blur에서 trim한 이름을 보호 Task PATCH로 한 번 저장하고, Escape는 `close-editor({ignore:true})`로 취소한다. 한글 IME 조합 확정 Enter는 저장으로 취급하지 않는다. 빈 값·공백만·well-formed Unicode가 아닌 값·200자 초과는 요청 없이 input을 열어 둔 채 해당 input의 `aria-invalid`/`aria-describedby`와 오류 안내를 제공한다. 숫자처럼 보이는 `001`도 문자열 그대로 저장한다.

저장 중 재입력을 잠그고 서버 성공 후 canonical snapshot을 기존 Gantt 인스턴스에 동기화한다. 실패·401·412·409에서는 기존 이름과 명시적 오류/권한 상태를 유지하며, 서버의 Origin·session·If-Match·revision 검사와 기존 rollback/재조회 경로를 재사용한다. Task Editor의 Summary readonly와 별도 Task/Assignment 저장 계약은 유지한다. 관계 양 끝 Task의 과거 이름 제한은 #258에서 대체하여 linked leaf도 이름 editor를 연다. 편집 가능한 이름 클릭에서는 작업 URL을 열지 않고, readonly 이름처럼 editor가 열리지 않는 행과 Chart bar의 기존 URL 동작은 유지한다. Readonly에서는 inline editor가 없다.

전용 unit/E2E 명세에는 세 유형, 단일 클릭과 F2, Enter/blur/Escape, 오류·중복·IME, 숫자 원문, 401/409/412/네트워크, 링크 무관 작업, 새로고침 영속성, Grid/Chart 인스턴스 및 390/768/1024/1440px overflow를 포함한다. 이 명세와 구현은 정적 검토만 했으며 실제 로컬 test/lint/typecheck/build/브라우저 조작, 구현 전후 화면 수치는 사용자 지시에 따라 **NOT TESTED**다. 공식 SVAR React Gantt Core 2.7.3의 text column, `getTable(true)`와 Table `open-editor`/`close-editor` API 및 설치 EventBus 순서를 확인했다(2026-09-24); 공식 demo의 실제 조작은 미실행이다. API·DB·Scheduling·Security 계약 문서 변경은 서버 계약 불변으로 N/A다.

## Issue #177 Project 상태 빠른 변경

Project List의 상태 열은 표시 전용 badge 대신 현재 상태를 유지하는 compact native select를 제공한다. 각 control은 프로젝트명을 포함한 accessible name을 가지며 키보드만으로 `예정 / 진행 중 / 완료`를 선택할 수 있다. 변경을 시작하면 대상 Project의 canonical snapshot을 다시 읽어 최신 revision/status를 확보하고 current edit session이 있으면 그대로 사용한다. 세션이 없으면 기존 편집 비밀번호 dialog를 열며 취소·잘못된 비밀번호·rate limit에서는 status PATCH를 보내지 않는다. 비밀번호는 component state에서 제출 직후 비우며 URL·로그·persistent storage에 저장하지 않는다.

실제 저장은 기존 `PATCH /api/projects/{publicId}`에 `{ status }`만 보내고 strong `If-Match`를 사용한다. 성공 시 canonical mutation response의 status만 목록 표시 override에 반영하여 페이지 전체 reload 없이 기존 검색/고급 필터 predicate를 즉시 다시 계산한다. 따라서 기본 `예정 + 진행 중` 보기에서 `진행 중 → 완료`는 행과 결과 건수가 즉시 줄고, 완료 필터를 선택하면 같은 canonical 상태로 다시 보인다. 412에서는 최신 Project를 다시 읽어 stale 선택을 폐기하고, 401/403에서는 성공처럼 표시하지 않는다. 동일 행 mutation 중 selector와 행 action은 중복 실행을 막는다.

Project Workspace의 title row는 readonly에서 기존 lifecycle badge를 그대로 표시한다. edit mode에서는 같은 위치가 compact native select가 되며 Project Settings를 열지 않고 직접 status-only PATCH를 수행한다. 성공 canonical snapshot은 기존 React workspace state에 적용하고 `ProjectGantt` reset generation이나 route navigation을 바꾸지 않는다. 412와 일반 실패는 canonical snapshot을 재조회해 status draft를 폐기하고, 401/403은 기존 readonly 권한 상태로 되돌린다. Settings를 이후 열면 같은 canonical status를 선택값으로 사용한다.

SVAR Task field에는 Project status를 추가하지 않으며 Gantt editor/instance lifecycle과 독립된 Project-level metadata control로 유지한다. API/DB schema 및 scheduling 계산은 변경하지 않는다.

## Issue #196 일정 Toolbar Task/Milestone 빠른 보기

Project Workspace의 일정(Schedule) 도구줄에 `[ 전체 | Task | Milestone ]` 버튼 그룹(`role="group" aria-label="작업 유형 빠른 보기"`)을 배치한다.

- 사용자는 고급 필터 패널을 열지 않고도 Toolbar에서 일반 Task 또는 Milestone만 빠르게 중심 조회할 수 있다.
- 버튼 전환은 독립된 별도 필터 상태를 생성하지 않고 기존 #83의 `TaskFilterState.types`를 조작한다.
  - `전체`: `types = []` (유형 제한만 해제하고 검색어, 기간, 리소스 등 다른 조건은 유지)
  - `Task`: `types = ["task"]`
  - `Milestone`: `types = ["milestone"]`
- 고급 필터 패널에서 복합 유형(예: `["task", "milestone"]`)을 선택한 경우, 빠른 보기 버튼 중 특정 버튼이 선택된 것으로 오인되지 않도록 `aria-pressed="false"`(비활성) 상태를 유지한다.
- child match 시 필요한 ancestor Summary는 기존 `filterTasksWithAncestors()` 정책에 따라 context row로 유지되며 match count에는 포함하지 않는다.
- 버튼 전환은 client-side view state로 동작하여 API 재요청, Project mutation, revision 증가, Gantt remount를 유발하지 않으며 SVAR 공개 `filter-tasks` action을 재사용한다.
- 읽기 전용(readonly)에서도 동일하게 사용 가능하며, 390/768/1024/1440px 및 전체화면 모드에서 컨트롤 겹침 없이 키보드 Tab 및 `aria-pressed` 접근성을 보장한다.


## Issue #186 물류 구성 및 담당자 관리 화면 UI (물류 LG-03)

Project Workspace의 탭 목록을 `일정 (schedule)`, `리소스 (resources)`, `물류 구성 (logistics)` 3개 탭으로 확장한다. ArrowLeft/ArrowRight/Home/End 키보드 탐색과 ARIA tab 연결을 제공하고, 탭 전환 시 기존 Gantt 인스턴스와 scroll/scale/tree/column/selection 상태를 유지한다.

물류 구성 탭은 공정 관리, 설비 관리, 물류 시스템, 제어·조율 관계의 4개 서브 탭을 제공한다. 공정 WBS와 Gantt WBS를 구분하고, 설비의 제어 시스템 및 Owner/Contributor, 시스템의 process scope/조율 관계 및 PI/Developer를 기존 Project-local 물류 API와 global Resource 카탈로그에 연결한다.

Readonly에서는 조회만 허용하고 edit session이 유효할 때만 mutation action을 표시한다. 최신 main API 계약에 따라 조율 관계 교체는 `childSystemIds`를 사용하고 DELETE는 영구 삭제 semantics를 따른다. 401/403은 workspace를 readonly로 강등하며, canonical metadata/task/link mutation 응답의 logistics aggregate를 보존한다. 390/768/1024/1440px, Escape 취소, document overflow 및 Gantt mount 보존을 Chromium E2E로 검증한다.

## Issue #187 일정 화면 공정·설비·시스템 범위 필터 (물류 LG-04)

일정(Gantt) 화면의 고급 검색/필터 패널에 물류 도메인 3개 차원의 범위 필터가 추가되었다:

- **필터 차원**:
  - `공정 필터 (processIds)`: 프로젝트에 정의된 공정 목록 다중 선택
  - `설비 필터 (equipmentIds)`: 프로젝트에 등록된 설비 목록 다중 선택
  - `시스템 필터 (systemIds)`: 프로젝트에 등록된 물류 제어/조율 시스템 목록 다중 선택
- **상속을 고려한 Effective 매칭**:
  - 작업의 직접 연결뿐 아니라 상위 Summary의 `subtree` 상속 연결을 종합한 effective 설비/시스템 집합(`buildTaskEffectiveLogisticsMap`)을 계산하여 필터 조건과 대조한다.
  - 공정 필터의 경우, 작업에 effective 연결된 설비의 소속 공정(`equipment.processId`) 및 연결된 시스템의 담당 공정(`system.processIds`)과의 교집합을 판별하여 일치 여부를 결정한다.
- **계층 무결성과 Context Row 보존**:
  - 필터 조건에 일치하는 leaf 작업(Task 또는 Milestone)이 있을 때, 해당 작업의 모든 조상 Summary 작업은 트리 계층 표시를 위해 화면에 컨텍스트 행(context row)으로 보존된다.
  - 도구줄에 표시되는 검색/필터 일치 결과 수(`일치 / 전체`)에는 실제 일치한 작업 수만 집계하며, 계층 유지를 위해 보존된 context Summary는 카운트에서 제외된다.
- **클라이언트 전용 필터링 및 Gantt 인스턴스 보존**:
  - 필터 선택 및 초기화는 서버 mutation이나 API 재조회를 유발하지 않으며, SVAR 공개 `filter-tasks` action을 통해 동일한 Gantt instance에서 렌더링 가시성만 전환한다.
  - 필터 패널의 Escape 닫기 및 필터 버튼으로의 focus 복귀, 390/768/1024/1440px 반응형 레이아웃 규칙을 유지한다.

## Issue #188 공정·설비·시스템·담당자 대시보드 및 일정 연동 (물류 LG-05)

물류 구성(`logistics`) 탭의 첫 번째 기본 서브탭으로 **물류 대시보드(`dashboard`)**가 추가되었다. (서브탭 목록: `대시보드 (dashboard)`, `공정 관리 (processes)`, `설비 관리 (equipment)`, `물류 시스템 (systems)`, `제어·조율 관계 (relations)` 5종)

- **필터 및 옵션 바**:
  - 기준일(`asOfDate`): `YYYY-MM-DD` native date input (기본값 오늘).
  - 임박 기준(`horizonDays`): 1~90일 범위의 숫자 입력 (기본값 14일).
  - 시스템 집계 범위(`systemView`): `직접 연결만 (direct)` vs `조율 범위 포함 (coordination)`.
  - 활성 마스터만 보기(`activeOnly`): 체크박스 토글.
  - 새로고침 버튼: 최신 서버 스냅샷 기반 대시보드 데이터 수동 재조회.
- **4대 핵심 KPI 카드 그리드**:
  - **기간 가중 진척률**: `Σ(duration * progress) / Σ(duration)` (Summary 및 Milestone 제외, taskId 중복 없이 정확히 1번 집계)과 시각적 진행 게이지 바, 총 대상 작업 수 및 총 기간(근무일수) 표시.
  - **미완료 지연 작업**: 기준일 기준 `progress < 100 AND end < asOfDate`인 지연 일반 작업 건수 및 '일정 필터' drill-down 버튼.
  - **마일스톤 경보**: 기준일 이전 미달성된 지연 마일스톤 수 및 `horizonDays` 이내 도래하는 임박 마일스톤 수 경보 뱃지 및 drill-down 버튼.
  - **투입 계획 공수**: 대상 작업들에 배정된 리소스 계획 공수의 총 M/D 및 M/M 환산치, 공수 미배정 일반 작업 건수 표시.
- **데이터 품질 및 구성 진단 패널**:
  - 물류 미연결 일반 작업 수 및 전체 대비 백분율.
  - 주 제어기(Primary Controller) 미매핑 설비 건수.
  - 주 담당자(Primary Owner) 미지정 설비 건수.
  - 주 책임자(Primary PI) 미지정 물류 시스템 건수.
  - 프로젝트 전체 설비 수량(`quantity`) 합계.
- **공정·설비·시스템별 세부 현황 표 및 일정 Drill-down 연동**:
  - 3개 탭(공정별 / 설비별 / 시스템별)으로 세부 breakdown 테이블 전환.
  - 각 행마다 코드, 명칭, 유형, 주 제어기/책임자, 매핑 작업 수, 기간 가중 진척률, 지연 작업 수, 계획 공수(M/D)를 표시.
  - 각 행의 **'일정 필터'** 버튼 클릭 시, Workspace가 `일정 (schedule)` 탭으로 즉시 전환되며 해당 대상의 ID 또는 연계 작업 ID 목록(`taskIds`, `processIds`, `equipmentIds`, `systemIds`)이 일정 화면의 검색/필터 패널에 자동으로 반영되어 관련 작업들만 즉시 필터링 표시된다.
  - 탭 전환 및 drill-down 과정에서도 기존 Gantt 인스턴스 DOM 및 편집/선택 상태가 보존된다.
- **접근성 및 반응형**:
  - `ArrowLeft`/`ArrowRight`/`Home`/`End` 키보드 탐색(5개 서브탭 지원), WAI-ARIA `role="tab"`/`aria-selected`/`aria-controls` 완전 준수.
  - 390px, 768px, 1024px, 1440px viewport에서 가로 스크롤 테이블 및 유연한 카드 그리드 배치로 레이아웃 깨짐을 방지한다.
## Issue #189: 프로젝트 복사·삭제·내보내기 연계 및 물류 기능 통합 검증 (물류 LG-06)

- **프로젝트 복사 모달 (`ProjectCopyButton`)**:
  - 원본 프로젝트의 일정·휴일뿐 아니라 물류 구성(공정 계층, 설비, 시스템, 제어·조율 관계, 리소스 역할, 태스크 물류 연결)과 리소스 배정이 동일 트랜잭션에서 함께 복사된다.
  - 다이얼로그 본문에 작업·연결·휴일 수 외에 `공정 N · 설비 N · 시스템 N` 카운트를 함께 표시하고, "서버에 저장된 최신 일정·물류 구조를 독립 복사하며, 글로벌 리소스 참조는 그대로 유지됩니다." 안내 문구를 제공한다.
  - 비활성 마스터나 비활성 리소스가 포함된 프로젝트 복사 완료 시, 반환된 `warnings` 목록을 하단 토스트 알림(`notify("info", warning)`)으로 사용자에게 안내한다.
  - `진척률 0%로 초기화` 옵션 선택 시 Leaf 작업 및 마일스톤 진척은 0으로 초기화되고 Summary 작업은 계층 규칙에 따라 자동으로 재계산된다.
- **Excel 내보내기 모달 (`ProjectExcelExportButton`)**:
  - 기존 작업 관계 포함/제외 선택에 더하여, "물류 구성 보고서 포함 (공정·설비·시스템·연결 시트)" 체크박스 옵션을 제공한다 (기본 체크).
  - 체크 시 프로젝트에 등록된 물류 데이터가 있을 경우 독립된 `"Logistics"` 시트가 추가되어 공정/설비/시스템/제어·조율/역할/태스크-물류 연결 정보를 포함한다.
  - 보고서에는 "본 시트는 물류 구성 보고용 출력물이며, 전체 프로젝트 무손실 재가져오기(Import) 백업 파일이 아닙니다." 안내를 명시한다.

## Issue #264 새 프로젝트 생성 초안 보존

생성 방식별 폼은 처음 방문할 때 마운트하고 이후 `hidden` panel 안에 유지한다. 빈 프로젝트의 이름·소유자·설명·상태와 템플릿의 선택·검색·이름·소유자·기준일은 같은 페이지에 머무는 동안 각각 보존한다. 숨겨진 폼은 접근성 탐색과 Tab 이동에서 제외한다. 페이지 이탈 이후의 영구 저장은 제공하지 않는다.

생성 요청 중에는 두 방식 탭의 클릭·방향키/Home/End 전환과 중복 제출을 차단한다. 실패 시 비민감 초안과 현재 방식은 유지하며 사용자가 명시적으로 재시도한다. 비밀번호는 storage나 URL에 저장하지 않고 제출 payload 확보 후 폼 메모리에서 지우며, 재시도에는 다시 입력한다. 초기 `?mode=template`과 본문 바로가기 뒤 현재 폼으로 진입하는 동작을 유지하며, 활성 panel의 첫 입력에 focus가 들어오면 tablist의 역방향 탐색도 즉시 복원한다. 템플릿 목록의 오류·선택 UX 개선은 Issue #265에서 별도로 다룬다.

## Issue #195 프로젝트 템플릿 등록·관리 및 템플릿 기반 프로젝트 생성

- **프로젝트 템플릿으로 저장 (`ProjectSaveAsTemplateButton`)**:
  - 프로젝트 상세 화면(Readonly/Edit 공통) 도구줄의 "더보기(More)" 메뉴에 "템플릿으로 저장" 항목을 제공한다.
  - 클릭 시 `WorkspaceDialog` 기반 템플릿 저장 대화상자가 열리며, 원본 프로젝트의 WBS 계층, FS 링크, 캘린더/휴일, 리소스 배정 및 물류 마스터/역할/태스크 연결 정보가 근무일 상대 오프셋(`offsetDays`) 기반의 표준 스냅샷으로 캡처된다.
  - 템플릿 이름(필수, 1~200자)과 설명(선택)을 입력받으며, 확인한 원본 revision과 작업 수가 요약 정보로 표시된다. 현재 DTO와 입력 폼에는 카테고리가 없다.
  - 저장 완료 시 하단 성공 토스트(`notify("info", ...)`)를 띄우고 메뉴 트리거로 focus를 복원한다. 원본 프로젝트 데이터는 변경하지 않으며, 필요한 원본 비밀번호 인증은 기존 unlock 경로로 편집 세션을 발급할 수 있다.

- **템플릿 기반 새 프로젝트 생성 (`/projects/new` 및 `CreateFromTemplateForm`)**:
  - 새 프로젝트 생성 페이지(`/projects/new`) 상단에 "빈 프로젝트 만들기"와 "템플릿에서 만들기" 2개 탭(`NewProjectTabs`)을 제공한다 (`role="tablist"` 및 키보드 화살표 탐색 지원).
  - **템플릿 선택**: 등록된 활성 템플릿 목록을 그리드 카드로 표시하며, 템플릿명/설명 실시간 검색창을 제공한다. 각 카드는 설명, 작업/마일스톤 수와 물류 포함 여부를 표시한다. 동일 그룹의 native radio로 클릭·방향키·Space 선택을 지원한다.
  - **시작일 기준 일정 자동 재계산**: 새 프로젝트명, 시작일(`projectStartDate`, 기본 오늘), 소유자, 비밀번호(필수 1~12자)를 입력받는다. 인스턴스화 시 지정 시작일 기준으로 작업들의 일정이 근무일 캘린더에 맞춰 자동 재배치되고, 스케줄링 엔진(`recalculateFinishStartDependencies` + `recalculateHierarchy`)을 통해 FS 종속성 및 상위 Summary 일정을 재계산한다. 진척률은 0%로 초기화된다.
  - **세션 자동 발급 및 즉시 전환**: 인스턴스화 완료 시 생성된 프로젝트에 대한 편집 세션 쿠키가 즉시 발급되어 사용자가 비밀번호를 다시 입력할 필요 없이 곧바로 새 프로젝트 편집 화면으로 이동한다.
  - **데이터 독립성 및 오류 처리**: 템플릿이 삭제되어도 생성된 프로젝트는 보존되며, 원본 프로젝트가 삭제되어도 템플릿은 보존된다. 성공한 빈 배열만 등록된 템플릿 없음으로 표현한다. HTTP·네트워크·잘못된 응답은 오류와 명시적 목록 재시도로 구분한다.
  - **접근성 및 반응형**: 390px, 768px, 1024px, 1440px viewport에서 카드 그리드가 유연하게 재배치되며 가로 overflow가 발생하지 않는다.

## Issue #265 템플릿 선택·검색·오류 복구

검색에는 보이는 label, 일치 수/전체 수와 초기화를 제공한다. 검색 결과 밖에서도 현재 선택 요약을 유지하며, 선택이 필터로 숨겨졌으면 이를 알린다. 검색만으로 선택이나 생성 초안을 변경하지 않는다. 다른 템플릿을 선택할 때 현재 프로젝트 이름이 이전 자동 제안과 같을 경우에만 새 제안으로 바꾸고, 사용자가 수정하거나 비운 이름은 유지한다.

최신 목록을 확인하기 전에는 선택·제출을 차단하며 오래된 비동기 응답을 무시한다. 필드 오류를 `aria-invalid`/`aria-describedby`로 연결하고 validation 실패 시 오류 입력으로 focus를 옮긴다. 일반 입력 수정은 해당 오류만 해제한다. 서버 실패는 별도 alert로 알리고 초안과 재시도 경로를 유지한다. 기존 공통 form/error 스타일과 semantic token을 사용하며 긴 카드·폼이 390px에서도 문서 가로 overflow를 만들지 않도록 한다. #264의 hidden panel·초안·중복 제출·비밀번호 삭제 계약은 계속 적용한다.

## Issue #200 관계 Context Menu에서 관계 종류(FS/SS/FF/SF)·Lag 설정 및 일정 재계산

- **관계선 컨텍스트 메뉴 (`RelationContextMenu`)**:
  - Gantt Chart 영역에서 관계선 SVG(`[data-link-id]`)를 우클릭(`contextmenu`)하면 마우스 커서 위치에 관계 설정 컨텍스트 메뉴가 열린다.
  - 선행 작업명(`from`)과 후행 작업명(`to`)을 안내 라벨로 명확하게 표시한다.
  - **관계 종류 선택**: `FS` (Finish-to-Start, 종료 후 시작), `SS` (Start-to-Start, 시작 후 시작), `FF` (Finish-to-End, 종료 후 종료), `SF` (Start-to-End, 시작 후 종료) 라디오/셀렉트 선택 제공.
  - **Lag(지연/선행) 입력**: 근무일수 단위의 정수(음수 선행 lead, 양수 지연 lag)를 입력할 수 있는 숫자 입력 필드 제공.
  - **동작 및 검증**:
    - 기존 값과 변경사항이 없을 경우 "저장" 버튼이 자동으로 비활성화(disabled)되어 불필요한 서버 호출을 방지한다.
    - 저장 시 `PATCH /api/projects/{publicId}/links/{linkId}`를 호출하여 원자적 일정 재계산 및 뷰 갱신을 수행한다.
    - "관계 삭제" 버튼 클릭 시 기존 DELETE 호출을 통해 관계를 제거한다.
    - Escape 키를 누르거나 메뉴 외부를 클릭하면 변경을 취소하고 메뉴를 닫는다.
  - **SVAR React Gantt 시각화 연동**:
    - 관계선 데이터 변환기(`projectLinksToSvarLinks`)에서 `FS → e2s`, `SS → s2s`, `FF → e2e`, `SF → s2e`로 실시간 매핑하여 차트 상에 연결점이 정확하게 렌더링된다.





## Issue #201 프로젝트 재진입 시 Gantt Grid 접힘/펼침(Summary open/collapsed) 상태 복원

- 프로젝트 단위로 브라우저 `localStorage`(`mastergantt:summary-toggle:<projectPublicId>`)에 접힌 Summary task ID 목록을 v1 스키마로 저장한다.
- 마우스 및 키보드 `open-task` 액션 발생 시 최신 상태를 저장하고, 동일 브라우저 프로필에서 재진입/새로고침 시 Gantt API 초기화 후 1회 복원한다.
- 다른 프로젝트의 상태는 섞이지 않으며 삭제/변환된 stale Summary ID는 로드 시 필터링 후 정규화된 값으로 storage에 다시 기록한다.
- 새 Summary는 기존 기본 상태를 사용하고, localStorage 접근 실패·용량 초과·malformed JSON은 비파괴적으로 무시한다.
- 서버 DB/API/Project revision에는 영향을 주지 않는 client-side UI preference다.
- Fullscreen/필터/일정↔리소스 전환에서는 현재 살아 있는 Gantt interaction state를 persisted preference보다 우선한다.

## Issue #202 Schedule Item Baseline 저장·편집·Grid 표시

- Baseline은 현재 일정과 독립적인 계획 스냅샷이며 Task/Milestone에 start/duration/end를 저장한다.
- Task Editor의 작업 정보 탭에서 Baseline을 현재 일정으로 복사하거나 수정·삭제할 수 있다. Summary는 descendant leaf에서 파생된 값을 읽기 전용으로 표시한다.
- 모든 descendant leaf에 Baseline이 있는 Summary만 complete Baseline을 가지며, partial Summary는 완전한 Baseline으로 표시하지 않는다.
- Grid에는 `기준 시작`, `기준 종료` optional column을 제공하며 기본은 숨김이다.
- Baseline mutation은 기존 edit-session / If-Match / revision / canonical snapshot 계약을 따른다.
- Project Copy는 Baseline을 보존한다.
- **Chart Baseline bar/toggle은 이번 Issue #202 범위에서 분리하여 Issue #253에서 처리한다.** SVAR PRO Baseline 기능을 사용하지 않고 Core 공개 API/state 기반 Alignment POC를 먼저 통과해야 한다.

## Issue #266 관계 편집 안전성

Relation Editor는 공통 native Dialog를 사용해 배경 조작과 focus 이탈을 차단한다. 공통 Dialog는 Tab/Shift+Tab 경계에서 활성·표시된 control 사이를 순환하며 disabled/hidden/inert 요소를 제외한다. 후보의 Enter/Space 선택, 후보만 닫는 Escape, dirty 종료/관계 전환 확인, 대상이 명시된 삭제 확인과 요청 중 닫기·중복 실행 방어를 제공한다. 명시적 닫기 버튼은 후보 popup이 열려 있어도 popup만 닫고 멈추지 않고 닫기/dirty 확인 흐름으로 진입한다. 관계 생성 성공 시 새 관계 방향·후보·검색·Type·Lag 초안을 기본값으로 되돌린다. 기존 부모의 호출 위치 focus 복원과 Gantt 상태를 유지하며 상세 동작은 [관계 편집 계약](TASK_RELATIONS.md#issue-266-관계-편집-dialog의-키보드초안요청-보호)을 따른다. 공통 Dialog 헤더는 긴 제목을 줄바꿈하고 닫기 버튼의 글자는 한 줄로 유지한다.

## Issue #203 관계선 더블클릭 Relation Editor 및 관련 아이템 검색·추가·삭제

- **진입 경로 및 인터랙션**:
  - Gantt 타임라인의 관계선(`[data-link-id]`) 더블클릭 시 Relation Editor 다이얼로그 모달 오픈.
  - 관계선 우클릭 Relation Context Menu 상단에 "관계 관리... (Relation Editor)" 버튼을 제공하여 키보드/마우스 우클릭 보조 경로 지원.
- **다이얼로그 구조**:
  1. **선택된 관계 설정**:
     - 선행 작업(Predecessor) 및 후행 작업(Successor) 정보(이름, 일정, 기간) 카드 표시.
     - **Anchor(기준 작업) 선택**: "선행 작업을 기준으로 보기" / "후행 작업을 기준으로 보기" 버튼을 통해 기준 작업 전환.
     - 관계 유형(`FS/SS/FF/SF`) 셀렉트 및 Lag(일 단위) 입력 필드.
     - 수정 시 "수정 저장" 활성화, "관계 삭제" 액션 지원.
  2. **기준 작업의 연결된 관계 목록**:
     - Anchor 기준 선행 작업(Incoming) 및 후행 작업(Outgoing) 목록을 카드 리스트로 표시.
     - 각 항목에서 유형/Lag 확인, 선택(현재 편집 대상으로 전환), 삭제 액션 지원.
  3. **새 관계 추가**:
     - 연결 방향 선택: "후행 작업으로 추가 (기준 → 대상)" / "선행 작업으로 추가 (대상 → 기준)".
     - 검색 자동완성: 프로젝트 내 모든 Leaf Task 및 Milestone을 이름/ID로 실시간 검색 (Summary 작업 및 자기 자신, 이미 연결된 중복 관계는 후보에서 자동 제외).
     - 관계 유형 및 Lag 설정 후 "관계 추가"를 통해 단일 화면에서 신규 의존성 생성.
- **접근성 및 상태 보존**:
  - `Escape` 키 닫기 및 모달 내부 Focus Trap 지원.
  - 모달 열기/닫기/추가/수정/삭제 시 Gantt 차트 인스턴스, 스크롤 위치, Summary 접힘 상태가 초기화되지 않고 유지됨.
  - 읽기 전용(`readonly`) 모드에서는 정보 조회만 가능하며 편집/삭제/추가 폼 비활성화.

## Issue #230 프로젝트 목록 필터 입력 컨트롤 너비 및 날짜 범위 From/To 정렬 개선

- 프로젝트명·소유자·설명·소유자 지정 여부의 조건 선택 `select`는 compact한 9.5rem 폭을 사용하고, text input은 14rem의 content-aware 폭을 사용한다.
- 생성일/최근 변경일의 `range` 조건은 From/To date input을 동일한 9.5rem 폭으로 배치하며, 단일 날짜 조건도 같은 date-control 폭을 사용한다.
- 48rem 이하에서는 프로젝트 정보와 날짜 조건 행을 세로 배치하고, From/To는 동일 폭 2열로 유지한다. 28rem 이하에서는 날짜 입력을 1열로 전환한다.
- global filter label 스타일과 충돌하지 않도록 local selector specificity를 확보하며, 공용 `secondary-button`은 `:global(.secondary-button)`으로 선택한다.
- 기존 Project List 필터 predicate, validation/timezone, Escape focus restore, API/DB/revision 계약은 변경하지 않는다.

## Issue #231 프로젝트 화면 '정보'/'더보기' 팝오버 포커스 이탈 시 자동 닫힘

- **외부 인터랙션 및 포커스 이탈 감지**:
  - 헤더 영역의 '정보' 및 '더보기' disclosure를 controlled state(`infoPopoverOpen`, `actionMenuOpen`)로 관리한다.
  - `document` 레벨의 `pointerdown` 및 `focusin` 이벤트 리스너로 클릭 또는 키보드 `Tab` 이동이 trigger + popup 영역 밖으로 벗어나면 자동으로 닫는다.
  - 팝오버 내부의 버튼, 링크, 입력 요소 사이 포커스 이동은 유지하여 내부 조작 가능성을 보장한다.
  - 모달 다이얼로그(`dialog`, `[role="dialog"]`) 내부 상호작용은 outside interaction으로 처리하지 않는다.
- **상호 배타적 오픈 및 접근성**:
  - '정보'와 '더보기'는 동시에 열리지 않으며, 다른 disclosure를 열면 기존 disclosure를 닫는다.
  - 동일 trigger 클릭의 toggle 동작과 `Escape` 닫기/trigger 포커스 복원 동작을 유지한다.
- **회귀 검증**:
  - Playwright E2E에서 외부 pointer 닫힘, Tab/focus 이탈 닫힘, disclosure 상호 배타, 프로젝트 복사 Dialog 내부 조작 예외를 검증한다.

## Issue #232 프로젝트 설정 다이얼로그 정보 구조·탭·반응형 폼 레이아웃 개선

- **전용 와이드 다이얼로그 및 WAI-ARIA 탭 구조**:
  - `WorkspaceDialog`에 `size="wide"`(최대 60rem 폭) 지원을 추가하여 다른 다이얼로그(38rem)에 영향 없이 설정 다이얼로그의 데스크톱 가용 공간 활용.
  - `ProjectSettingsDialog`를 독립 컴포넌트로 분리하고 WAI-ARIA APG 준수 탭 인터페이스(`role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`) 적용.
  - 키보드 `ArrowLeft/ArrowRight` 및 `Home/End` 키를 통한 탭 포커스 이동 지원.
  - 탭 전환 시 각 패널 컴포넌트를 unmount하지 않고 `hidden` 속성으로 제어하여 작업 캘린더 규칙/미리보기, 비밀번호, 설명 등의 초안(draft) 상태 100% 보존.
- **카테고리별 정보 구조(IA) 및 레이아웃**:
  - **기본 정보**: 프로젝트 이름과 상태(compact select)를 2열 그리드로 정렬하고 설명 textarea는 전체 폭으로 배치하여 불필요한 단일 세로 스택을 지양.
  - **작업 캘린더**: 국가 공휴일 규칙 및 휴무일 항목에 2열 그리드와 우측 정렬 액션 행을 적용하여 항목 밀도와 가독성 대폭 향상.
  - **편집·보안**: 비밀번호 변경 폼과 세션 안내 카드 및 편집 모드 종료 액션을 독립 분리하여 안전하고 명확한 세션 관리 지원.
- **반응형 및 안정성 보존**:
  - 390/768px 모바일에서 1열 스택으로 자연스럽게 리플로우되어 가로 overflow 방지.
  - `Escape` 키 닫기 및 닫힘 후 '프로젝트 설정' 트리거 버튼으로의 포커스 복원 보존.
  - Gantt 인스턴스, 트리 접힘 상태, 스크롤 위치 보존 및 API/DB 스키마 불변 유지.

## Issue #233 Project Gantt 정보 밀도

Project Workspace의 일정 화면은 동일 viewport에서 Timeline 가용 면적을 늘리기 위해 다음 기본 geometry를 사용한다.

- 초기 Grid 폭: **480px**
- 작업/외부 ID/시작/기간 column: **180 / 108 / 104 / 56px**
- Day scale cellWidth: **44px**
- Week scale cellWidth: **68px**
- 기간 cell은 canonical working-day duration 숫자만 표시하며 DB/API/Scheduling 의미는 변경하지 않는다.

Grid/Chart resizer와 column resize는 계속 SVAR 공개 API를 사용한다. Day/Week 전환은 현재 mounted Gantt instance와 사용자가 조정한 column 폭을 보존해야 하며, scale 전환 때문에 사용자 resize 상태를 초기값으로 되돌리지 않는다. 390/768/1024/1440px에서 document-level unintended horizontal overflow를 만들지 않고 Gantt 내부 scroll은 기존 계약대로 허용한다.

## Issue #234 리소스 관리 검색 및 그룹 구성원 작업 UX 개선

- **독립 검색 및 상태 관리**:
  - `/resources` 관리 화면에서 리소스 목록, 리소스 그룹 목록, 그룹 구성원 할당 목록 각각에 독립적인 실시간 검색 툴바 추가.
  - 이름(`name`) 및 코드(`code`) 대소문자 무시 substring 일치 지원, 앞뒤 공백 자동 trim, null code 안전 처리.
  - 일치 건수 카운터(`일치 n / 전체 N`, 구성원: `일치 n / 전체 N · 선택 M`)를 통해 검색 결과 현황을 즉시 파악 가능.
  - `Escape` 키 입력 시 검색어 즉시 초기화 지원.
  - 데이터 전체 부재(`등록된 리소스가 없습니다.`)와 검색 결과 부재(`검색 조건과 일치하는 리소스가 없습니다.`) 상태 명확히 분리.
- **그룹 구성원 선택 상태 보존**:
  - 검색어로 일부 리소스가 숨겨지더라도 체크 상태(`selectedMembers`)를 100% 보존.
  - `구성원 저장` 시 검색 필터링 여부와 무관하게 전체 선택된 리소스 ID 목록을 원자적으로 PUT 전송.
- **구성원 액션 푸터 정돈**:
  - `memberFooterActions` 전용 스타일을 적용하여 데스크톱에서 `닫기`(secondary) 좌측, `구성원 저장`(primary) 우측 정렬로 일관되게 배치.
  - 390/768px 모바일에서 자연스러운 flex-wrap 배치로 버튼 겹침 및 가로 overflow 방지.


## Issue #235 Resource 관리 화면

`/resources`는 일반 콘텐츠 페이지보다 높은 정보 밀도가 필요한 관리 workspace다. App Shell header와 첫 heading 사이의 top spacing은 Resource route에 한정해 compact하게 유지하며 다른 페이지의 `.main-content` geometry는 변경하지 않는다.

로그인 후 상단 관리 명령은 `관리자 비밀번호 변경 / 새로고침 / 로그아웃`을 하나의 행으로 그룹화한다. 내부 optimistic concurrency 번호인 `Catalog Revision N`은 화면에 표시하지 않지만 catalog `revision`, `If-Match`, 412 stale reload 계약은 그대로 유지한다.

관리자 비밀번호 변경은 상시 카드가 아니라 `WorkspaceDialog`로 제공한다. Dialog는 Escape/cancel 닫기, trigger focus 복원, 닫을 때 비밀번호 state clear를 보장한다. 비밀번호 정책은 서버와 동일하게 1~12 Unicode code point이며 HTML `maxLength`로 UTF-16 code unit 제한을 추가하지 않는다.

## Issue #260 Project Workspace 필터 영역 밀도와 의미 그룹

일정 Toolbar는 #83/#130/#196의 검색·필터·빠른 보기·Reset·결과 계약을 유지하면서 가용 폭을 우선 활용한다. 1440px 이상은 가능한 한 한 행을 유지하고, 1024px 전후는 최대 두 행의 content-aware grid로 재배치한다. 768px에서는 검색/필터와 빠른 보기/Reset/결과가 불필요하게 전체 폭을 독점하지 않으며, 390px에서만 빠른 보기와 결과 영역을 필요한 만큼 추가 적층한다. Resource Toolbar도 검색+필터와 결과+Reset의 두 의미 행을 사용하고 768px에서 검색 이외 control을 기계적으로 full-width로 만들지 않는다.

Task 고급 필터는 하나의 flat grid 대신 **텍스트 / 일정·수치 / 유형·할당 / 물류** section으로 구분한다. 작업명·설명·External ID의 operator/value, 기간 조건·From·To, 진행률 Min/Max, 기간 Min/Max처럼 함께 해석하는 control은 같은 group에서 읽히도록 배치한다. Resource/Group 대상 picker는 종류·검색·ANY/ALL을 별도 compact grid로 묶고, 공정·설비·시스템 checkbox는 공통 CSS list를 사용해 긴 한국어 이름과 code가 panel 밖으로 밀리지 않게 한다. 기존 inline style은 공통 class로 이동하며 모든 grid child는 intrinsic width로 인한 overlap을 막기 위해 min-width 0 계약을 가진다.

Resource 고급 필터는 종류·상태·Task From/To 계약을 변경하지 않고 1024/768px에서 2열, 390px에서 1열로 reflow한다. 필터 predicate, active count, ancestor Summary context, SVAR `filter-tasks`, canonical Gantt instance, API 재조회 금지, Escape 후 Filter trigger focus 및 Reset 후 search focus는 그대로다. E2E는 390×844·768×900·1024×900·1440×900·1600×900에서 Advanced Panel 열린 상태, 긴 물류 label, direct toolbar child overlap, 모든 input/select의 panel 수평 bounds 및 document-level overflow를 실제 bounding box로 검증한다.

## Issue #261 근무·휴무 날짜 예외

기존 설정 → 작업 캘린더에서 `사용자 날짜 예외`를 편집한다. 항목은 이름·날짜·대상·대상 선택·일 유형을 고유 label과 fieldset으로 묶는다. Resource Group/Resource는 근무일(WORKING)과 휴무일(NON_WORKING)을 선택하고 Project 전체는 휴무일만 제공한다. 근무일 항목을 Project 대상으로 바꾸면 휴무일로 정규화하고 polite 상태로 알린다. 기존 semantic token/system font와 좁은 화면의 한 열 리플로우를 유지한다.

미리보기는 프로젝트 일정 영향과 리소스 날짜 예외 영향을 분리한다. 예외별 `적용됨`/`현재 효과 없음`은 바로 위 계층과 비교한 효과이며 더 구체적인 Resource 예외가 최종 결과를 다시 바꿀 수 있다. 상세에서는 Resource별 상위 상태, 해당 예외 효과, 최종 상태와 적용 출처를 구분한다. 대상 0명인 그룹은 그 사실을 표시하며 NO_EFFECT warning만으로 저장을 차단하지 않는다.

같은 수준의 근무/휴무 충돌은 날짜·대상·규칙·영향 Resource를 식별하는 focus 가능한 오류 요약으로 안내하고 입력으로 이동하는 명령을 제공한다. 동일 초안의 저장은 차단하며 입력 변경 시 충돌과 기존 preview를 무효화한다. PUT 충돌에도 과거 성공 preview를 남기지 않는다. publicId/revision 변경 시 이전 컨텍스트의 충돌 상태를 폐기한다.

저장 후 canonical Calendar와 Project snapshot을 다시 조회하여 서버가 정규화한 날짜 유형을 반영한다. Group/Resource 날짜 예외는 Resource workload만 변경하고 Project Task start/end/duration과 기존 Gantt instance/선택/스크롤을 보존한다. 기존 401/412·초안 보호·늦은 응답 방어 계약은 유지한다. 실제 검증과 잔여 미검증은 [Issue #261 설계·검증 기록](ISSUE_261_RESOURCE_CALENDAR.md)을 따른다.

## Issue #258 — Dependency-aware 편집 결과

Grid 연결 Task의 이름과 Task Editor의 metadata/progress/Baseline 편집을 허용한다. 요청 시작일은 canonical `requestedStart`로 표시하고 적용 start/end는 저장된 값으로 별도 표시한다. 일정 변경은 서버의 전체 graph 계산 결과로 한 번 확정한다. Chart move는 start-only, 왼쪽 resize는 start+근무일 duration, 오른쪽 resize는 duration-only, progress는 progress-only다. inProgress pointer와 내부 canonical 동기화는 mutation을 만들지 않는다.

저장 결과 안내는 요청일→적용일 차이와 변경된 후행 leaf 건수 및 최대 3개 Task 이름/externalId를 표시한다. Manual/리소스 충돌은 초안을 유지하고 원본 canonical 화면을 복구한다. filter-hidden successor도 응답 full snapshot에 포함되며 Gantt instance/filter/scroll/tree/scale/selection 유지 경로를 재사용한다. linked 구조 명령 보호와 readonly/stale/busy 계약은 유지한다. Baseline 복사는 저장된 적용 일정 기준이며 미저장 일정 초안은 먼저 저장하도록 안내한다.


## Issue #300 Grid 작업 행 이동 영속성

Grid에서 행을 놓으면 Context Menu와 같은 보호된 계층 명령으로 parent/sibling order를 저장한다. 드래그 중의 표시 순서는 미확정 상태이며 놓은 이동의 서버 저장이 성공해야 확정된다. 이후 이름·진행률 등 일반 필드를 수정하거나 프로젝트를 다시 열어도 확정된 위치를 유지한다. 저장 중 후속 이름 편집·이동은 잠그고, 실패하거나 revision 충돌이 발생하면 최신 canonical 위치와 오류 안내를 표시한다. 재조회가 성공하면 같은 Gantt/API 인스턴스를 사용한다.

기존 Grid/Chart 배치, Light semantic token, Context Menu·inline 이름 편집·Task Editor 흐름을 재사용하는 interaction 결함 수정이다. 새로운 화면 구조·PRO 기능·Undo/Redo·정렬 정책을 추가하지 않으므로 `DESIGN.md`와 `UI_UX_GUIDELINES.md`의 공통 원칙 변경은 N/A다. 390/768/1024/1440px에서는 기존 내부 Grid scroll과 document overflow 기준을 적용한다. 관련 실제 API 회귀는 `tests/e2e/project-grid-reorder-persistence.spec.ts`에서 DnD→rename→일반 필드 수정→Context Move→reload, 실패/412 복구와 Gantt identity를 검증한다. 로컬 실행 결과와 동일 PR head의 원격 `quality/e2e/docker` 판정은 별도로 기록한다.

## 물류 유형 관리 UX (Issue #280)

전역 navigation의 **물류 관리** → `/logistics-admin`에서 설비 유형과 시스템 유형을 관리한다. 로그인 후 category 전환, 유형 추가, 표시명 수정, 활성/비활성 전환, 사용 건수 확인, 새로고침, 비밀번호 변경, 로그아웃을 제공한다.

Project Workspace의 설비/시스템 추가·수정 select는 active catalog 이름을 표시하고 payload에는 stable code를 저장한다. 기존 row의 현재 type이 inactive이면 해당 값은 `비활성`으로 유지 표시한다. Catalog fetch 실패는 empty state로 처리하지 않으며 저장을 차단하고 재시도를 제공한다.

관리자 비밀번호 변경 dialog는 Escape/닫기/취소 등 모든 닫기 경로에서 새 비밀번호 초안을 즉시 지운다. 서버 logout 요청이 실패하거나 네트워크 오류가 나면 UI는 로컬 관리 화면을 잠그되, 서버 session revoke가 확인되지 않았음을 오류로 명시하여 성공한 logout과 구분한다.


## Issue #289 — 프로젝트 기준정보 UX

`/projects/new` 및 Project 설정의 기본 정보에 사업부·제품·사업장/법인 Select를 추가한다. 세 필드는 선택 사항이며 active catalog만 신규 선택지에 제공한다. catalog 조회 실패는 “선택지 없음”과 구분해 오류/재시도 상태를 표시하고 저장 가능한 정상 빈 목록으로 오인하지 않는다. 기본 필드 validation은 catalog loading 여부와 독립적으로 먼저 제공하며, 유효한 제출은 catalog 확인 전에는 저장하지 않는다.

기존 선택값이 inactive이면 현재값을 “비활성”으로 유지·표시하고 사용자가 다른 active 값 또는 미지정으로 명시적으로 변경할 수 있다. 전역 `/project-master-admin`은 사업부/제품/사업장·법인을 category별로 관리하고 WAI-ARIA tablist/tabpanel, roving tabindex, ArrowLeft/ArrowRight/Home/End 탐색을 제공한다. SVAR Task Editor 내부 모델에는 Project master metadata를 결합하지 않는다.
