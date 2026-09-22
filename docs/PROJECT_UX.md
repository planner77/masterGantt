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
