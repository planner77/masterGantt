# Issue #61 리소스 편집 관리자 인증 진단 로그

## 목적

`POST /api/resource-catalog/admin-sessions`의 인증 실패를 운영자가 서버 로그만으로 구분할 수 있게 하되, 비밀번호·세션 토큰·Cookie·Authorization 같은 인증 비밀정보는 로그에 남기지 않는다.

## 외부 API 계약

인증 비밀번호가 미설정이거나 정책에 맞지 않거나 입력값이 일치하지 않는 경우에도 외부 응답은 기존 보안 계약을 유지한다.

- HTTP `401`
- error code: `RESOURCE_ADMIN_AUTH_FAILED`
- 상세 실패 원인은 응답에 노출하지 않는다.

Origin, 요청 형식, 애플리케이션 설정 오류의 기존 HTTP 상태와 공개 error code도 변경하지 않는다.

## 서버 진단 reason code

| reason_code | 의미 | 일반적인 확인 항목 |
|---|---|---|
| `ADMIN_PASSWORD_NOT_CONFIGURED` | `RESOURCE_CATALOG_ADMIN_PASSWORD`가 없거나 빈 값 | Compose `.env`와 컨테이너 환경변수 전달 여부 |
| `ADMIN_PASSWORD_POLICY_INVALID` | 관리자 비밀번호가 최소 16자 정책을 만족하지 않음 | 실제 값 자체가 아니라 정책 충족 여부만 확인 |
| `ADMIN_PASSWORD_MISMATCH` | 입력 비밀번호와 서버 설정 비밀번호가 다름 | 사용 중인 운영 `.env`/컨테이너 재생성 여부 |
| `INVALID_REQUEST` | JSON/body/content-type/크기 등 요청 형식 문제 | 브라우저/프록시 요청 형식 |
| `ORIGIN_NOT_ALLOWED` | 요청 Origin이 `APP_BASE_URL`과 일치하지 않음 | Windows Nginx 외부 URL과 `APP_BASE_URL` |
| `CONFIGURATION_ERROR` | `APP_BASE_URL`, `ALLOW_INSECURE_HTTP` 등 서버 설정 오류 | 런타임 환경 변수 |
| `UNEXPECTED_ERROR` | 예상하지 못한 내부 예외 | 동일 `requestId` 기준의 주변 서버 상태 |

## 구조화 로그

인증 로그는 한 줄 JSON으로 stdout/stderr에 기록한다. 주요 필드는 다음과 같다.

- `timestamp`
- `level`
- `event`
- `requestId`
- `endpoint`
- `component`
- `result`
- `reason_code`
- `status`
- `configured` (비밀번호 값은 기록하지 않음)
- `policyValid` (정확한 길이는 기록하지 않음)

주요 event는 다음과 같다.

- `resource_catalog_admin_auth_started`
- `resource_catalog_admin_auth_configuration` — 프로세스당 첫 인증 요청에서 1회
- `resource_catalog_admin_auth_succeeded`
- `resource_catalog_admin_auth_failed`
- `resource_catalog_admin_auth_completed`

API error body의 `requestId`와 인증 진단 로그의 `requestId`는 동일하다.

## 금지되는 로그 데이터

다음 값은 인증 진단 로그에 포함하지 않는다.

- 사용자가 입력한 비밀번호
- `RESOURCE_CATALOG_ADMIN_PASSWORD` 원문/부분 문자열
- 비밀번호 hash/digest
- 정확한 비밀번호 길이
- 관리자 session raw token
- `Cookie`, `Set-Cookie`, `Authorization` 헤더 값
- 예외 객체의 원문 message/stack

## Docker 운영 확인

Compose로 실행 중인 경우 저장소 루트에서 다음처럼 확인한다.

```bash
docker compose --env-file .env -f deploy/compose.yml logs --tail 200 app
```

실시간 확인:

```bash
docker compose --env-file .env -f deploy/compose.yml logs -f app
```

컨테이너를 직접 실행한 경우:

```bash
docker logs --tail 200 <container-name>
```

실패 시에는 먼저 `resource_catalog_admin_auth_failed`를 찾고 `reason_code`와 `requestId`를 확인한다. 비밀번호 원문을 로그에 추가하거나 디버깅 목적으로 출력해서는 안 된다.

### 로그 필터 예시

Compose 로그에서 관리자 인증 이벤트만 빠르게 확인하려면 다음처럼 event 이름으로 필터링할 수 있다.

```bash
docker compose --env-file .env -f deploy/compose.yml logs --no-color app \
  | grep 'resource_catalog_admin_auth_'
```

특정 API 오류 응답에서 확인한 `requestId`가 있다면 같은 ID로 서버 로그를 검색해 해당 요청의 시작·실패·완료 이벤트를 연계한다.

```bash
docker compose --env-file .env -f deploy/compose.yml logs --no-color app \
  | grep '<requestId>'
```

## 운영 해석 예

- `ADMIN_PASSWORD_NOT_CONFIGURED`: `.env`에 값이 있어도 기존 컨테이너가 재생성되지 않아 런타임 환경에 반영되지 않았는지 확인한다.
- `ADMIN_PASSWORD_POLICY_INVALID`: 값 자체를 출력하지 말고 최소 16자 정책을 충족하도록 운영 secret을 수정한다.
- `ADMIN_PASSWORD_MISMATCH`: 브라우저 입력값과 현재 컨테이너가 가진 운영 설정이 다른 경우다. 운영 secret 변경 후 컨테이너 재생성 여부를 확인한다.
- `ORIGIN_NOT_ALLOWED`: Nginx로 접속하는 실제 외부 Origin과 `APP_BASE_URL`이 정확히 같은지 확인한다.

## 검증 범위

`tests/server/resources/resource-catalog-admin-auth-diagnostics.test.ts`에서 다음을 자동 검증한다.

- 성공
- 비밀번호 불일치
- 비밀번호 미설정
- 정책 위반
- Origin 거부
- 요청 형식 오류
- 애플리케이션 설정 오류
- 예상하지 못한 예외
- password/Cookie/Authorization/session token 비노출
- 설정 상태 로그 1회 기록
- 기본 `console` JSON 출력

전체 회귀 판정은 저장소 정책에 따라 PR GitHub Actions의 `quality`, `e2e`, `docker` 결과로 수행한다.
