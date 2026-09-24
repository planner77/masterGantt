# 프로젝트 화면·삭제·하위 작업·알림·링크 복사

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

## Issue #115 작업 캘린더 미리보기 상태

프로젝트 설정의 작업 캘린더 초안은 국가, 적용 범위·기간, 휴무일 이름·날짜·대상·대상 선택, 규칙·휴무일 추가·삭제가 바뀔 때마다 이전 미리보기를 즉시 숨긴다. 입력을 원래 값으로 되돌려도 이전 결과를 자동으로 다시 표시하지 않으며, 사용자가 `미리보기 계산`을 다시 실행해야 한다. 결과는 계산 당시의 프로젝트 publicId, revision, 요청 본문과 일치할 때만 표시한다. 다른 프로젝트·revision의 늦은 성공/오류 응답은 현재 상태나 알림을 덮어쓰지 않는다.

한 개의 간결한 live status가 초기 안내, 재계산 필요, 계산 중, 실패 후 재시도, 완료 요약을 전달한다. 자세한 변경 작업과 휴무일 목록은 이 live region 밖에 둔다. 계산 중에는 초안과 저장·미리보기 버튼을 잠그며, 계산 실패 때는 결과를 숨기고 재시도 방법을 표시한다. 미리보기는 저장 전 필수 단계가 아니다. 저장 성공 시 이전 미리보기를 지우고 기존 canonical 일정 재조회·알림 경로를 사용한다. 저장 응답을 미리보기 결과처럼 표시하지 않는다. 기존 edit session, Origin, If-Match, 401/412 처리와 서버 인가 계약은 그대로 따른다.

자동 Chromium 검증은 `tests/e2e/project-work-calendar-preview.spec.ts`가 실제 KR→US 미리보기·저장 요청, 초안 변경, 실패·재시도, metadata 저장에 따른 revision 변경·editor unmount 뒤 늦은 응답, 390/768/1024/1440px 상태·버튼 접근을 확인한다. Metadata 저장은 기존 설정 창을 닫으므로 같은 editor 인스턴스에서 revision prop만 바뀌는 경로는 브라우저에서 직접 재현하지 않는다. publicId/revision 일치 검사와 요청 토큰 경계는 코드 검토 및 원격 회귀와 함께 판정한다. 스크린리더와 실제 기기 조작은 별도 환경 검증이다.

## Issue #116 작업 Context Menu 하위 메뉴 배치

변경 전 UI/UX 재현 근거는 390×844에서 root x=8..264, `Add` child x=253..421로 오른쪽 31px가 잘리는 상태다. 작업 메뉴의 활성 하위 메뉴는 실제 root와 하위 메뉴 폭을 기준으로 오른쪽 공간이 충분하면 오른쪽, 오른쪽이 부족하고 왼쪽이 충분하면 왼쪽에 표시한다. 양쪽 모두 부족하면 root와 같은 폭의 drilldown으로 전환한다. 390px 화면의 `Add`는 focus만으로 열리지 않으며 클릭·Enter·Space·ArrowRight로 연다. `Back` 또는 ArrowLeft는 부모 메뉴로 돌아가고 Escape는 메뉴 전체를 닫고 원래 작업 행/막대로 focus를 복원한다. 넓은 화면의 hover·focus 진입과 root 최초 focus 및 닫힌 하위 메뉴 상태는 유지한다.

하위 메뉴 trigger는 `aria-expanded`와 열린 메뉴를 가리키는 `aria-controls`를 제공한다. 하위 메뉴는 이름이 있는 `role=menu`이고 비활성 명령은 그대로 비활성으로 남는다. 넓은 화면에서 ArrowLeft는 부모 trigger에 focus를 돌려주고 child를 닫는다. 좁은 drilldown에서 활성 명령이 하나도 없으면 `Back`이 focus를 받는다. 짧은 화면에서는 메뉴 높이를 `100dvh - 16px` 이내로 제한하고 내부 스크롤과 고정된 `Back`을 사용하며 Arrow/Home/End 탐색은 문서가 아닌 메뉴 내부를 스크롤한다. Context Menu의 권한·revision·선택 Task endpoint link 제한, #104의 무관한 Task 동작, canonical Gantt instance 유지 계약은 변경하지 않는다. API·DB·스케줄링 문서 변경은 N/A다.

2026-09-24 확인: 설치 버전은 `@svar-ui/react-gantt` 2.7.3이다. [SVAR 공식 ContextMenu 가이드](https://docs.svar.dev/react/gantt/guides/configuration/configuring_context_menu/)는 공개 Core `ContextMenu`의 `options`/`data` 하위 항목과 `resolver`/`filter`를 설명한다. 이 프로젝트의 작업 명령은 앱의 인가·revision·clipboard·canonical 동기화 경계를 포함해 기존 사용자 메뉴를 유지하며 PRO 전용 기능을 복제하지 않는다. UI/UX 조사에서 공식 데모는 1440px hover와 390px 항목 화면 관찰까지만 근거가 있으며 keyboard 동작은 **NOT TESTED**다. 본 변경의 코드·E2E 명세는 작성했다. 로컬 브라우저·자동 검증은 실행하지 않았고, PR 원격 CI 결과는 해당 PR의 head SHA와 run으로 별도 판정한다.

## Issue #117 리소스 공수 조회 상태

Resource tab은 공수 계산 결과와 assigned-targets 이름·코드·설명 정보를 독립적으로 조회·표시한다. 한쪽 API의 실패가 다른 쪽 성공을 숨기지 않는다. 공수 첫 조회 실패 때는 결과가 없음을 명시하고 빈 검색 결과와 구별한다. 메타데이터 첫 조회 실패 때는 공수 응답에 포함된 Group·Resource 기본 이름과 Resource 기본 코드의 검색·표시를 유지한다. Group 코드는 공수 응답에 없어 메타데이터 성공 전에는 검색할 수 없으며 설명 검색도 제한됨을 알린다. 각 상태에는 별도의 오류 안내와 재시도 버튼이 있다. 전역 `새로고침`은 두 조회를 다시 시작하며 어느 한쪽이라도 조회 중이면 중복 요청을 막기 위해 비활성화한다.

성공한 조회를 새로고침하다 실패하면 마지막 성공 결과를 계속 보여 주되, 실패 상태와 마지막 성공 확인 시각을 함께 표시한다. 재시도 중에도 이 결과는 유지한다. 늦은 이전 요청의 성공·오류는 최신 요청을 덮지 않으며 프로젝트 publicId가 바뀌거나 화면이 해제된 뒤의 응답을 현재 프로젝트에 적용하지 않는다. 공수·메타데이터 상태 안내는 각각 `status` 또는 `alert`로 읽을 수 있다.

재조회·부분 실패는 검색/종류/상태/기간 필터, M/D·M/M 선택, 열어 둔 Group·Resource details, 일정·리소스 tab 상태와 SVAR Gantt instance를 초기화하지 않는다. 좁은 화면에서는 상태 카드가 한 열로 쌓이고 긴 안내는 줄바꿈되며 오류 재시도 버튼은 화면 안에서 조작할 수 있어야 한다. Resource API·domain·권한 계약은 변경하지 않는다. API/DB/스케줄링 문서 영향은 N/A다. 코드와 E2E 명세는 작성했으나 로컬 브라우저·테스트·빌드는 **NOT TESTED**다. 이 변경의 원격 CI는 해당 PR의 head SHA와 run으로 별도 판정한다.

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

Modal dialog가 열려 있을 때는 기존 native focus trap이 우선하며 skip link가 dialog 밖으로 focus를 빼앗지 않는다. Escape로 닫으면 기존 설정 trigger focus 복원도 유지한다. 링크는 390/1440px에서 focus 상태에만 보이고 화면 밖 가로 overflow를 만들지 않는다. 리소스 관리로의 client navigation에서도 main landmark를 유지하며, 스크롤된 페이지에서는 fragment 이동이 main을 다시 화면에 놓는다. Fragment 이동 자체는 API mutation이나 Gantt 재생성을 수행하지 않는다. 현재 코드는 native anchor 동작을 사용하며 browser별 focus·scroll 결과와 실제 focus 상태 캡처는 원격 Chromium E2E에서 판정한다. 로컬 브라우저·테스트·빌드는 **NOT TESTED**다. API/DB/Scheduling 계약 문서 영향은 N/A다.
