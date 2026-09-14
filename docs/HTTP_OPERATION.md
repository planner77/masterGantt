# 내부망 HTTP 운영 (#8)

## 정책과 범위

`NODE_ENV=production` 및 production build/container를 그대로 사용한다. HTTPS는 기본값이고, 조직의 내부망 정책이 허용하는 경우에만 `ALLOW_INSECURE_HTTP=true`로 HTTP를 명시적으로 허용한다. 인증·권한·Origin·revision 검증을 끄거나 개발 서버로 운영하지 않는다. 기능 지원과 실제 조직의 운영 승인·네트워크 안전성은 별개다.

| 환경 / APP_BASE_URL | ALLOW_INSECURE_HTTP | 결과 |
| --- | --- | --- |
| production / HTTP | 미설정, `false` | 설정 오류, migration 전 시작 중단 |
| production / HTTP | `true` | HTTP 쿠키로 정상 운영 |
| production / HTTPS | 미설정, `false`, `true` | 기존 HTTPS 보안 쿠키 유지 |
| development / HTTP | 미설정 | 기존 개발 동작 유지 |
| 모든 환경 / 모든 URL | 빈 값, `TRUE`, `1`, 공백 등 | 설정 오류 |

`APP_BASE_URL`에는 실제 브라우저 origin(프로토콜·호스트·포트)만 지정한다. 끝 `/`, 경로, query/hash, 사용자정보, 기본 포트의 비정규화 표기는 허용하지 않는다. 프록시 upstream 주소를 외부 origin으로 사용하지 않는다. 하나의 앱을 HTTP와 HTTPS 두 canonical origin으로 동시에 제공하지 않는다.

공유 URL·시작 CLI·readiness·생성/조회/편집 인증의 설정은 공용 URL parser를 따른다. 브라우저/요청 `Host`, `Origin`, `X-Forwarded-*`로 HTTP 허용이나 Secure 속성을 결정하지 않는다. `SESSION_COOKIE_SECURE`는 실제 코드가 읽지 않았던 예약값이므로 예제/Compose에서 제거했다. 이 값을 바꿔 보안을 조절하지 않는다. `TRUST_PROXY`, `LOG_LEVEL`은 기존 미사용 예약 상태다.

## 내부망 HTTP 실행 예제

주소 `192.168.10.20:8080`은 예시다. 현재 운영 중인 Compose 프로젝트명·named volume은 그대로 보존한다. `.env`를 통째로 덮어쓰지 않고 다음 항목을 수정한다.

```dotenv
# 브라우저가 접속하는 HTTP 주소. 내부 컨테이너 주소가 아니다.
APP_BASE_URL=http://192.168.10.20:8080
# 명시적인 소문자 true만 내부망 HTTP를 허용한다.
ALLOW_INSECURE_HTTP=true
# Nginx가 앱으로 전달할 호스트 내부 포트. 외부 8080과 다르다.
HOST_PORT=3000
# 신규 설치 예시. 기존 운영은 실제 프로젝트명/볼륨명을 그대로 사용한다.
COMPOSE_PROJECT_NAME=mastergantt
MASTERGANTT_VOLUME_NAME=mastergantt-data
```

```text
브라우저 HTTP :8080 → Nginx → HTTP 127.0.0.1:3000 → production 컨테이너 :3000
```

Nginx 예제는 [http.conf.example](../deploy/nginx/http.conf.example)에 있다. Linux에서는 기존 `http {}`가 include하는 `/etc/nginx/conf.d/` 등에, Windows에서는 `C:/nginx/conf/nginx.conf`의 기존 `http {}` 안에 포함시킨다. 전체 설정이나 다른 서비스 설정을 덮어쓰지 않는다. 인증서·HTTPS redirect·HSTS를 추가할 필요가 없다.

저장소 루트에서 아래 순서로 적용한다. 기존 DB의 일관된 백업과 프로젝트/volume 일치를 먼저 확인한다.

```sh
# 설정 확인 후 환경 변수를 반영하기 위해 재생성한다. restart만으로 바뀌지 않는다.
docker compose --env-file .env -f deploy/compose.yml config --quiet
docker compose --env-file .env -f deploy/compose.yml up -d --build app
docker compose --env-file .env -f deploy/compose.yml ps
curl -fsS http://127.0.0.1:3000/api/health/ready
# 실제 Nginx 전체 설정을 검사하고, 성공한 경우에만 reload한다.
sudo nginx -t && sudo nginx -s reload
curl -fsS http://192.168.10.20:8080/api/health/ready
```

Windows PowerShell에서는 먼저 `curl.exe -fsS http://127.0.0.1:3000/api/health/ready`로 WSL2 앱에 접근 가능한지 확인한다. WSL localhost 전달이 안 되는 경우 Nginx만 바꿔 해결하려 하지 말고 네트워크 모드·포트 게시·방화벽을 확인한다. Nginx 설치 위치에서 `.\nginx.exe -t` 성공 후 `.\nginx.exe -s reload`를 실행한다. Nginx도 Docker라면 같은 network에서 upstream을 `http://app:3000`으로 하고 앱의 호스트 포트 게시를 제거할 수 있다. 별도 호스트 프록시는 승인된 내부 인터페이스/방화벽을 설계해야 한다.

브라우저에서 프로젝트 생성 → 편집 잠금 해제 → Grid `+` 작업 추가 → 작업 정보 편집 → 새로고침 후 유지 → 편집 모드 종료 후 변경 거부를 확인한다. Health 200만으로 쿠키/편집 검증을 완료했다고 보지 않는다. 공유 링크 복사에 clipboard API를 사용할 수 없는 HTTP 브라우저는 기존 수동 복사 모달을 사용한다.

## 쿠키 및 프로토콜 전환

| 속성 | HTTP production | HTTPS production |
| --- | --- | --- |
| 이름 | `mastergantt_edit` | `__Host-mastergantt_edit` |
| Secure | 없음 | 항상 있음, HTTP 허용 flag가 true여도 유지 |
| 공통 | HttpOnly, SameSite=Strict, Path=/, 기존 TTL, Domain 없음 | 동일 |

발급·조회·로그아웃·비밀번호 변경·프로젝트 삭제는 같은 외부 URL 기반 이름을 사용한다. HTTPS가 HTTP용 쿠키 이름을 fallback 인증하지 않는다. 비밀번호 해시·세션 만료·프로젝트 격리·낙관적 revision 충돌·rate limit은 기존 정책을 유지한다.

HTTP↔HTTPS로 전환할 때는 전환 전에 로그아웃하고, 기존 앱을 중단·재생성하여 **하나의 앱만 같은 SQLite volume을 사용**하게 한다. 주소를 바꾼 뒤 다시 로그인한다. 과거 쿠키를 새 이름으로 복사하거나 Domain/Path를 재작성하지 않는다. HTTP 응답이 기존 Secure 쿠키를 삭제할 수 있다고 가정하지 않는다. 미정리된 쿠키가 있으면 브라우저의 해당 사이트 데이터 정리 절차를 따른다. 이 기능은 기존 DB 세션을 일괄 삭제하거나 TTL을 바꾸지 않으며, 남은 세션은 기존 만료 정책을 따른다.

HTTP에서 비밀번호·세션·일정 데이터는 전송 구간에서 암호화되지 않는다. 내부망·소수 사용자만으로 도청/변조/세션 탈취 위험이 없어지지 않는다. 승인된 네트워크 접근만 허용하고 비밀번호/Cookie/Authorization/body를 로그·보고서에 저장하지 않는다. 쿠키는 **포트별로 격리되지 않으므로** 같은 호스트/IP의 다른 서비스가 있는 경우 이를 고려한다. 전용 도메인/IP가 쿠키 범위를 구분하는 데 도움이 되지만 HTTP 자체를 암호화하지는 않는다.

## 증상별 점검

| 증상 | 확인할 항목 |
| --- | --- |
| production 시작 오류 | ALLOW_INSECURE_HTTP가 정확히 `true`인지, APP_BASE_URL canonical 형식, DATABASE_PATH가 `/data/` 아래인지 확인 |
| 설정을 바꿔도 HTTP 거부 | `.env` 수정 후 `up -d`로 컨테이너 환경을 재생성했는지 확인 |
| 생성/저장 403 | 브라우저 Origin과 APP_BASE_URL scheme/host/port 일치. Origin 헤더를 고정값으로 덮어쓰지 않음 |
| 로그인 이후 readonly/401 | HTTP에서 `mastergantt_edit` 발급/저장/전송, 세션 만료, 원본 Set-Cookie 전달 확인 |
| 브라우저가 HTTPS로 이동 | Nginx redirect, 과거 HSTS, HTTPS-only 조직 정책을 구분. 조직 정책 해제를 완료 조건으로 삼지 않음 |
| Nginx 502 | Nginx 실행 위치에서 upstream health, WSL2 전달/포트/컨테이너 상태 확인 |
| 412 | 최신 revision 재조회. If-Match를 제거하거나 무조건 재시도하지 않음 |

## 검증 계약

새 `tests/server/projects/http-transport.test.ts`는 허용값·거부값, canonical URL, 쿠키 이름·속성·만료, 공유 URL, 시작 검증·readiness 및 HTTP Handler→Service→SQLite의 CRUD/Origin/revision/세션 만료를 검사한다. 기존 HTTPS 및 권한/비밀번호 테스트를 삭제하거나 skip하지 않는다.

`tests/transport/production-transport.spec.ts`와 `tests/config/transport.config.ts`는 기존 개발 E2E와 분리된 **실제 production** 검증이다. `scripts/verify-transport-smoke.sh`가 격리된 두 컨테이너·볼륨과 Nginx를 구성한다. `plain.gantt.test` HTTP는 `isSecureContext=false`, `secure.gantt.test` HTTPS는 임시 테스트 CA를 신뢰 저장소에 등록하여 인증서 검증을 유지한 상태로 실행한다. 일반 HTTP 양성 경로의 쿠키 수동 주입, 인증서 오류 무시, secure-origin 강제 플래그는 금지한다. 잘못된 쿠키 이름을 보내는 명시적 음성 테스트만 별도로 둔다.

검증 범위는 실제 브라우저 프로젝트 생성·작업 추가/정보 편집·재조회·암호 변경·로그아웃, HTTP/HTTPS 쿠키 저장·전송, 다른 Origin/프로젝트/만료 세션 거부, 컨테이너 재시작 후 데이터 보존이다. HTTPS 컨테이너에도 ALLOW_INSECURE_HTTP=true를 지정하여 쿠키가 약화되지 않음을 확인한다. 잘못된 flag/URL/DB 경로는 실제 entrypoint가 exit 1로 거부하고 migration DB를 만들지 않는지 확인한다.

CI의 Docker gate, main 게시 이미지의 exact digest 검사, 릴리스 후보 이미지의 pre-publish 검사에서 실행한다. PR은 registry에 쓰지 않는다. CI 임시 CA·키·볼륨은 정리하며 브라우저 trace에는 인증 정보를 남기지 않는다. 기존 development E2E와 단위 검사·Compose smoke는 별도로 유지된다. 실제 테스트 수/결과는 해당 PR의 최신 head와 Actions run/job을 근거로 기록한다.

실제 조직 Windows/WSL2·프록시·클라이언트 정책·운영 데이터 전환·백업 복원은 이 GitHub Linux 검증으로 대체되지 않는다. 구현 문서가 존재하는 것만으로 해당 환경 PASS라고 하지 않는다. release tag나 실제 운영 배포는 별도 승인이다.

## 공식 근거

- [RFC 6265 Secure/HttpOnly 및 clear text·port 공유](https://httpwg.org/specs/rfc6265.html)
- [Set-Cookie와 __Host 접두사](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [Nginx proxy 모듈](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Playwright configuration](https://playwright.dev/docs/api/class-testconfig)
- [Chromium Linux CA 신뢰 저장소](https://chromium.googlesource.com/chromium/src/+/main/docs/linux/cert_management.md)
