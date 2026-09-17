# 운영 로깅 및 요청 추적

Issue #64에서 도입한 서버 로그와 요청 상관관계 운영 기준을 정리한다.

## 출력 형식

서버 로그는 Docker가 기본 수집할 수 있도록 `stdout/stderr`에 JSON 한 줄로 출력한다. 공통 필드는 `timestamp`, `level`, `event`, `component`, `environment`이며 요청 처리 로그에는 `requestId`, `method`, `route`, `status`, `durationMs`가 추가된다. 오류·진단 이벤트는 필요할 때 `errorCode` 또는 `reasonCode`를 포함한다.

`LOG_LEVEL`은 `debug`, `info`, `warn`, `error`를 지원한다. 미설정 시 `development`는 `debug`, 그 외 환경은 `info`를 사용한다. 잘못된 값은 안전한 기본값으로 fallback하고 `logging_configuration_invalid` 경고를 한 번 기록한다.

## Request ID

애플리케이션은 각 API 요청에 상관관계 ID를 부여하고 응답의 `X-Request-ID`로 반환한다. 오류 응답의 `error.requestId`와 서버 로그의 `requestId`는 동일한 값을 사용한다.

기본값 `TRUST_PROXY=false`에서는 클라이언트가 보낸 `X-Request-ID`를 신뢰하지 않고 서버 UUID를 생성한다. 신뢰 가능한 reverse proxy가 직접 애플리케이션 앞에 있는 경우에만 `TRUST_PROXY=true`로 설정한다. 이때도 UUID 또는 Nginx `$request_id`의 32자리 hex 형식만 수용한다. `TRUST_PROXY`는 request ID 신뢰 경계일 뿐 Origin, HTTP 허용 여부, Cookie 보안 정책을 완화하지 않는다.

Nginx 예제는 다음 헤더를 전달한다.

```nginx
proxy_set_header X-Request-ID $request_id;
```

Windows Nginx 또는 Linux Nginx 로그에도 `$request_id`를 포함하면 같은 값으로 proxy와 application 로그를 연결할 수 있다. 민감한 query string, Cookie, Authorization 값은 access log에 추가하지 않는다.

## 오류 및 보안

4xx 거부는 `warn`, 5xx는 `error`로 기록한다. 예상하지 못한 서버 오류는 외부 API에는 기존 `INTERNAL_ERROR`와 일반 메시지만 반환한다. 운영 환경 서버 로그에는 오류 타입과 안전한 코드만 남기며 임의 내부 오류 메시지와 stack을 그대로 노출하지 않는다.

공통 logger는 이름에 `password`, `cookie`, `authorization`, `token`, `secret`, `csrf`, `hash`, `digest`, request/response body가 포함된 필드를 `[REDACTED]`로 치환한다. 애플리케이션 코드는 다음 정보를 로그 필드로 전달해서는 안 된다.

- 프로젝트/리소스 관리자 비밀번호와 비밀번호 hash
- edit/admin session token
- Cookie 및 Authorization 전체 값
- CSRF secret
- `.env` 전체 내용
- 요청 body 전체 또는 DB record 전체

Issue #61의 리소스 관리자 인증 진단도 동일 공통 logger를 사용한다. 실패 원인은 `reason_code`로 구분하지만 비밀번호 값과 hash는 기록하지 않는다.

## Health / readiness

정상 health probe는 요청마다 `info` 로그를 남기지 않는다. Readiness는 외부 응답 `{ "status": "ok" }` 또는 `{ "status": "unavailable" }` 계약을 유지하면서 내부적으로 DB 연결, foreign key, migration, application/database configuration 실패를 분류한다.

동일한 readiness 장애가 반복될 때는 반복 로그를 만들지 않고 장애 진입 또는 실패 원인 전환 시 `readiness_unavailable`, 복구 시 `readiness_recovered`를 기록한다.

## Docker 운영

애플리케이션 로그 파일을 컨테이너 내부에 직접 저장하지 않는다. `docker logs <container>` 또는 Compose 로그로 확인하고 Docker logging driver에서 회전 정책을 운영한다. 예를 들어 Docker daemon의 `json-file` driver를 사용하는 환경에서는 운영 정책에 맞춰 `max-size`, `max-file`을 지정한다. 변경 전에는 동일 daemon을 사용하는 다른 컨테이너에 미치는 영향을 검토한다.

장애 조사 순서는 다음을 권장한다.

1. 사용자/프록시에서 `X-Request-ID`를 확보한다.
2. Nginx 로그에서 같은 request ID와 upstream 상태를 확인한다.
3. `docker logs`에서 같은 `requestId`의 `http_request_rejected`, `http_request_unexpected_error`, `http_request_completed` 이벤트를 검색한다.
4. readiness 장애라면 `reasonCode`를 확인해 configuration, DB open/connectivity, foreign key, migration 문제를 분리한다.
5. 인증 장애라면 외부 오류 코드와 내부 `reason_code`를 함께 확인하되 비밀번호 자체는 수집하지 않는다.
