# Issue #27 프로젝트 복사

## 목표
기존 프로젝트의 저장된 일정, 계층, 의존관계, 휴일을 별도의 독립 프로젝트로 복제한다. 원본과 복사본은 이후 서로 영향을 주지 않는다.

## 설계
- API: `POST /api/projects/{sourcePublicId}/copy`
- 보안: exact Origin, 원본 edit session, strong `If-Match` 필수
- 입력: 새 프로젝트명, 설명, 새 편집 비밀번호, 선택적 `resetProgress`
- 생성 rate limit과 기존 password KDF 동시 실행 제한을 재사용한다.
- 비밀번호 hashing은 DB write transaction 밖에서 수행한다.
- `IMMEDIATE` transaction 안에서 원본 session binding/authVersion/expiry와 revision을 재검증한다.
- Project/Task/Link/Holiday/새 edit session을 한 transaction에서 생성한다.
- Project/Task/Link 공개 ID는 새로 발급하고 Task `externalId`는 프로젝트 범위 식별자이므로 유지한다.
- 부모와 Link endpoint는 새 Task 내부 PK로 다시 연결한다.
- 기본은 날짜·기간·진척률 보존이며 `resetProgress=true`이면 leaf/milestone을 0으로 만들고 summary 진척률을 재집계한다.
- 성공 응답은 `201 Created`, `Location`, `ETag: "1"`, 새 프로젝트 edit-session Cookie와 canonical snapshot/counts를 반환한다.

## UI
- 프로젝트 상세 화면의 기존 작업공간 헤더에 `프로젝트 복사` 진입점을 제공한다.
- 프로젝트 목록에도 `프로젝트 복사` 진입점을 제공하며 `?copy=1`로 상세 화면의 동일 복사 대화상자를 연다.
- 복사 UI는 `ProjectReadonlyView`가 제공하는 기존 단일 `WorkspaceNotifications` Provider 내부에서 동작한다. 별도 Provider를 추가하지 않아 toast/알림 컨트롤이 중복 렌더링되지 않는다.
- 복사 대화상자를 열 때마다 최신 canonical snapshot과 현재 edit-session을 서버에서 다시 확인한다.
- 원본 edit session이 없으면 기존 편집 비밀번호 잠금 해제 API를 통해 인증한 뒤 복사를 진행한다.
- 실제 복사 직전 canonical snapshot을 다시 읽어 최신 revision을 `If-Match`에 사용하므로, 다른 편집 직후에도 stale revision을 재사용하지 않는다.
- 새 프로젝트명, 설명, 새 편집 비밀번호/확인, 진척률 초기화 여부를 확인하며 성공한 뒤에만 새 프로젝트로 이동한다.

## Acceptance Criteria
- 원본 Project revision/updated schedule을 변경하지 않는다.
- 새 Project revision은 1이다.
- Task/Link 공개 ID가 원본과 다르다.
- Task externalId, 계층, sibling order, Link 관계, 휴일, 날짜/기간을 보존한다.
- 복사 중 오류가 발생하면 부분 프로젝트를 남기지 않는다.
- stale `If-Match`, 만료/회수 session, 잘못된 Origin, invalid body를 거부한다.
- 진척률 초기화 옵션은 summary를 포함해 일관되게 재집계한다.
- 목록과 상세 화면 양쪽에서 복사 기능에 진입할 수 있다.
- 잠금 해제/프로젝트 수정 후에도 최신 권한·revision을 사용한다.
- 프로젝트 상세의 기존 toast/알림 UI는 한 세트만 렌더링되어 기존 E2E/production transport 계약을 유지한다.

## CI 및 리뷰 보정
- 응답 DTO는 `CopyProjectResponse`를 명시하여 `timezone: "Asia/Seoul"` 및 `[6, 0]` tuple의 리터럴 타입을 보존한다.
- route security inventory에 `POST /api/projects/{publicId}/copy`를 추가하고 exact inventory 테스트 기대값도 함께 갱신한다.
- 공식 API source of truth인 `docs/API.md`에 프로젝트 복사 route, 입력 schema, 인증·precondition, 성공 응답과 오류 mapping을 추가했다.
- Codex P1 리뷰의 알림 Provider 범위와 stale snapshot/revision 문제를 보정했다.
- CI #111에서 별도 복사 Provider 때문에 `workspace-toast`와 알림 세부 버튼이 2개 렌더링되어 Chromium E2E와 Docker production transport 검증이 함께 실패한 원인을 확인했다. 복사 진입점을 기존 작업공간 Provider 내부로 통합하여 중복 렌더링을 제거했다.

## 버전
기준 버전 `0.7.0`에서 하위 호환 신규 기능을 추가하므로 Semantic Versioning MINOR를 증가하여 `0.8.0`으로 관리한다.

## 검증
CI의 version consistency, typecheck, lint, Vitest, production build, Chromium E2E, Docker smoke gate를 그대로 적용한다. 프로젝트 복사 서비스 테스트에서 독립 ID, 계층/Link/Holiday 보존, 원본 revision 불변, 진척률 초기화를 검증한다.


## Issue #464 단계 소속 보존

전체 Project Copy의 임시 no-loss 차단을 명시 FK remap으로 대체한다. 원본의 모든 Task/Summary→Milestone 명시 row를 읽고 전체 Task 생성 후 두 endpoint를 새 Task PK로 연결한다. Summary 상속을 leaf별 명시 row로 확장하지 않는다. 원본 Membership/Link/status/Assignment/revision은 불변이며 FK write 실패는 새 Project·Task·Link·session까지 전체 rollback한다.

`resetProgress=false` 또는 omission은 서버가 보유한 완료 기록과 기존 legacy mixed Dependency를 그대로 보존한다. 현재 작업/선행 상태와 맞지 않는 completed 기록도 자동 재개하지 않고 canonical `completionInconsistent`로 진단한다. 외부 JSON의 신규 완료 입력 검증과 이 신뢰된 서버 Copy 경로는 다르다. `resetProgress=true`는 기존 leaf/M progress0/not_started와 Summary 재집계 정책을 유지하고 Ready를 새 snapshot에서 계산한다. Calendar·Resource·물류·비밀번호·권한·새 세션 계약은 유지한다.

원본 일정의 canonical 검증에는 원본 Link 전체를 함께 전달한다. FS/lag로 유효 시작일이 requestedStart보다 늦어진 정상 일정은 Dependency 재계산을 포함해 비교하므로 진척률 초기화 여부와 관계없이 복사할 수 있다. 기존 일정 validator와 Summary Dependency endpoint 금지 규칙을 유지하며 잘못 저장된 일정은 전체 복사를 거부한다. Template은 저장된 유효 시작일의 상대 offset과 Link를 보관하고 새 Project Calendar에서 다시 계산한다.

관련 검증은 `tests/server/projects/milestone-membership-copy.test.ts`의 새 FK/상속/override·source 불변·reset·legacy·401/412·강제 write 실패 rollback과 기존 전체 Copy 회귀에 포함한다. Local Fast Feedback는 공식 PR quality/e2e/docker 검증을 대체하지 않는다.
