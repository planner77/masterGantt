# Security

## 1. Security Model

이 문서는 Project별 Edit Password와 browser edit session을 사용하는 초기 보안 정책의 Source of Truth이다. W02에서 DB 격리·parameter binding을, W04에서 생성 bootstrap과 Direct Readonly를 구현했다. W05는 password verification, session consumption·revoke·rotation과 Project metadata 보호 mutation을, W07은 root Task/Milestone 보호 mutation을 구현했다. 자동화·독립 검증 범위와 후속 Link/Import 보안 경계는 [W05 검증 기록](W05_REVIEW.md), [W07 검증 기록](W07_REVIEW.md)에서 구분한다.

핵심 경계는 다음과 같다.

- `/projects/{publicId}` 접근과 Project schedule 조회는 기본 Readonly이다.
- Public Project URL은 편의를 위한 주소일 뿐 secret 또는 access-control boundary가 아니다. URL을 아는 사람은 Project name, description, task, dependency를 읽을 수 있으므로 **기밀성이 보장되지 않는다**.
- Edit Password를 정상 검증해 Project-scoped session을 받은 browser만 변경할 수 있다.
- Frontend의 edit mode, 숨겨진 button, client validation은 authorization 근거가 아니다.
- 모든 Project mutation, import preview/commit, password 변경에서 server가 session과 URL Project의 binding을 재검증한다.
- Project 목록 공개 여부는 별도 결정이다. 전역 인증 없이 목록을 노출하면 direct-link보다 넓은 정보 공개가 되므로 deployment owner 결정 전에는 discovery API를 활성화하지 않는다.

이 모델이 조직의 일정 데이터 기밀성 요구를 만족하지 못하면 공개 Readonly 모델을 유지한 채 UUID를 더 길게 만드는 것으로 해결하지 않는다. Reverse proxy/SSO 또는 별도 read authorization 요구사항을 먼저 추가해야 한다.

## 2. Edit Password 저장과 검증

### 저장 형식

Node.js `node:crypto`의 `scrypt`를 사용한다.

1. Project 생성 또는 password 변경 시 `randomBytes(16)` 이상의 독립 salt를 생성한다.
2. Password를 scrypt로 derivation한다.
3. DB에는 algorithm, salt, derived key, N/r/p/key length만 저장한다.
4. Password 원문, reversible encryption 결과, fast unsalted hash는 저장하지 않는다.

초기 배포 profile 가정은 OWASP의 동등 최소 조합 중 메모리와 CPU를 절충한 `N=2^15, r=8, p=3`, derived key 32 bytes이다. Node `maxmem`은 이 profile이 요구하는 메모리보다 충분히 크게 명시한다. 실제 production image와 memory limit에서 benchmark하고, 정상 검증이 1초 미만이며 동시 unlock이 service를 고갈시키지 않는지 확인한 뒤 parameter를 확정한다. Parameter는 row에 저장해 향후 성공 login 때 상향 rehash할 수 있게 한다.

Password policy의 초기 가정은 다음과 같다.

- 최소 12자, 최대 UTF-8 1024 bytes
- Unicode와 공백을 포함할 수 있으며 server가 trim 또는 Unicode normalization으로 원문을 바꾸지 않음
- 전송은 HTTPS만 사용
- Password를 URL, analytics, telemetry, log context에 넣지 않음

조직 password 정책이 있으면 이 가정보다 우선한다.

W04는 위 저장 profile(`N=32768, r=8, p=3`, key 32 bytes, salt 16 bytes, `maxmem=64 MiB`)과 입력 길이, 동시 scrypt 2개 상한을 구현했다. Project와 최초 session digest는 같은 transaction에 저장하되 비동기 scrypt는 transaction 밖에서 실행한다. Production hardware benchmark와 parameter 승인은 D03/W16 전까지 남아 있다.

### 검증

다음 검증 경계는 W05에서 구현했다.

- DB에 저장한 parameter와 salt로 candidate를 동일하게 derivation한다.
- 기대값과 실제값을 같은 길이의 Buffer로 만들고 `crypto.timingSafeEqual`로 비교한다.
- Project가 없거나 hash record가 손상된 경우에도 unlock response는 일반 `401 INVALID_CREDENTIALS`로 통일한다. 가능한 경우 고정 dummy scrypt를 수행해 큰 timing 차이를 줄인다.
- Rate limit을 비싼 scrypt 계산 전에 검사하고, KDF 동시 실행 수를 제한한다.
- Async `crypto.scrypt`는 DB write transaction 밖에서 수행한다.
- Password 변경은 새 salt/hash 저장, `projects.auth_version` 증가, 모든 기존 session revoke, Project revision 증가를 하나의 transaction으로 처리한다.

## 3. Edit Session

### Token lifecycle

- 성공 unlock마다 `randomBytes(32)`로 최소 256-bit token을 새로 만들고 base64url로 cookie에 저장한다.
- DB에는 token 원문이 아니라 `SHA-256(token)` digest만 저장한다. Password에는 SHA-256을 사용하지 않지만, 충분한 entropy의 random bearer token lookup에는 적합하다.
- Session은 반드시 하나의 internal `project_id`와 발급 당시 `auth_version`에 binding한다.
- URL의 `publicId`가 가리키는 Project, session의 `project_id`, 현재 `auth_version`이 모두 같아야 한다.
- 초기 absolute TTL은 8시간(`28,800`초)으로 가정하며 server-side `expires_at`을 최종 기준으로 삼는다. Cookie `Max-Age`만 신뢰하지 않는다.
- Logout은 DB session을 revoke하고 Cookie를 만료시킨다. 만료/revoke row는 주기적으로 bounded batch 삭제한다.
- Unlock마다 token을 rotate한다. Password 변경은 이전 모든 session revoke와 호출자 새 session 발급을 같은 transaction에서 처리하고 204/새 ETag/Set-Cookie를 반환한다.

W04는 생성 시 32-byte random token을 발급해 browser Cookie에는 base64url 원문을, DB에는 SHA-256 digest·Project ID·`auth_version`·8시간 만료만 저장했다. W05는 실제 요청에서 digest를 조회해 binding/strict expiry(`expires_at > now`)/revoke/auth-version을 판정한다. Current-session GET은 DB와 TTL을 변경하지 않는다. Unlock과 password rotation lifecycle transaction에서는 만료 또는 revoke row를 한 번에 최대 100개만 정리한다.

### Cookie

Production HTTPS의 기본 Cookie 제안:

```text
__Host-mastergantt_edit=<opaque-token>;
Path=/;
HttpOnly;
Secure;
SameSite=Strict;
Max-Age=28800
```

`Domain`은 설정하지 않는다. `__Host-` prefix는 `Secure`와 `Path=/` 조건을 만족할 때만 사용한다. Local HTTP 개발은 별도 비-prefix name을 사용하되 production에서 `Secure` 누락을 허용하지 않는다.

하나의 Cookie는 현재 unlock session 하나를 나타내며 다른 Project mutation에는 사용할 수 없다. 여러 Project를 동시에 edit해야 한다는 명시적 UX 요구가 생기면 cookie name/path 전략 또는 server-side session collection을 재설계한다. Token을 JavaScript, localStorage, sessionStorage에 복사하지 않는다.

다른 Project URL에서 logout을 호출했을 때 Cookie token이 소유 Project 기준으로 credential integrity, binding, revoke, auth-version, strict expiry를 모두 만족하는 경우에는 해당 유효 session과 root Cookie를 보존한다. 단순히 session row가 존재하는 것만으로 보존하지 않으며 expired/revoked/auth-version-invalid/corrupt-owner/unknown token은 대상 Project를 변경하지 않고 Cookie만 만료한다.

Cookie serializer는 production HTTPS에서 `__Host-mastergantt_edit`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=28800`, Domain 없음으로 검증했다. Local HTTP는 `mastergantt_edit` 이름과 Secure 없음으로 분리한다. Cookie header는 8 KiB·100 pair 상한과 중복/형식 검사를 적용한다. Direct snapshot GET은 Cookie가 있어도 계속 Readonly이고 별도 current-session GET만 edit 표시를 동기화한다.

## 4. Server-side Authorization

각 protected Route Handler는 동일 authorization middleware/service를 거친다.

W05는 이 공통 경계를 Project metadata PATCH와 edit-password PUT에, W07은 Task POST/PATCH/DELETE에 적용했다. W04 create는 preexisting session이 없는 bootstrap 예외다. 후속 Calendar/Link/Import Route는 추가되는 즉시 같은 inventory와 검증 경계를 통과해야 한다.

1. URL `publicId` 형식 검증
2. Cookie 존재 및 최대 길이 검증
3. Token digest 계산
4. Session + Project를 parameter-bound query로 조회
5. revoked/expiry/auth-version/project binding 검증
6. Mutation의 `Origin`과 `If-Match` 검증
7. 검증된 internal `project_id`만 Service/Repository에 전달

Repository query는 항상 검증된 `project_id`를 포함한다. Task/link external ID가 전역 unique라고 가정하지 않는다. Parent와 Link 양 끝은 composite foreign key로도 Project isolation을 강제한다.

보호 대상에는 최소 다음이 포함된다.

- Project metadata, calendar, password 변경
- Task create/update/delete/reorder/reparent
- Dependency create/update/delete
- Import preview와 import commit
- 이후 추가되는 모든 일정 변경 API

Project 생성은 preexisting session이 존재할 수 없는 명시적 예외이다. Same-Origin 검사, payload 제한, password hashing, creation rate limit을 거친다. 성공 시 생성 transaction과 연결된 최초 edit session을 발급한다. Project delete는 초기 범위에 없다.

## 5. CSRF와 Origin 정책

Cookie 인증 mutation은 CSRF 방어를 다음처럼 적용한다.

- GET/HEAD는 상태를 변경하지 않는다.
- POST/PATCH/PUT/DELETE는 `Origin` header를 필수로 받고 `APP_BASE_URL`의 scheme/host/port와 정확히 비교한다.
- Missing, `null`, parse 불가, 복수 Origin, 다른 Origin은 `403 ORIGIN_NOT_ALLOWED`로 거부한다.
- `APP_BASE_URL`은 trusted deployment configuration이며 forwarded Host로 동적으로 만들지 않는다.
- CORS credential access를 기본 비활성화하고 allow-all origin을 사용하지 않는다.
- `SameSite=Strict` Cookie를 defense-in-depth로 사용한다.
- 가능하면 `Sec-Fetch-Site`가 `same-origin` 또는 정책상 허용된 값인지 추가 검증하되 Origin 검사를 대체하지 않는다.

초기 same-origin web UI에는 JavaScript가 읽는 별도 CSRF token을 두지 않는다. 향후 cross-origin client나 외부 API를 허용하면 bearer/API authentication과 CSRF 모델을 새로 결정한다.

Project create와 unlock도 Origin을 검사한다. 이 endpoint들은 기존 Cookie 권한을 소비하지 않더라도 password/hash CPU abuse와 원치 않는 Project 생성을 막아야 한다.

## 6. Rate Limit과 Abuse 방어

외부 Redis를 추가하지 않고 single-instance 전제를 유지한다. Application의 bounded in-memory limiter와 reverse proxy limiter를 함께 사용하는 초기 제안은 다음과 같다.

| Operation | 초기 application limit 가정 | Key |
|---|---|---|
| Project create | 5회/1시간 | W04는 process-global `unattributed`; trusted peer IP 확정 후 세분화 |
| Unlock | 10회/15분 | client IP + Project public ID |
| Unlock global guard | 50회/15분 | client IP |
| Import preview/commit | 각 10회/분 | session + Project |
| Excel export | 10회/분 | client IP + Project |

모든 limit은 burst를 제한하고 `429` 및 가능한 경우 `Retry-After`를 반환한다. 성공 login도 짧은 burst limit에 포함해 공격자가 성공/실패 차이를 이용하기 어렵게 한다. In-memory limiter는 restart 시 상태가 사라지므로 internet-facing deployment의 유일한 방어로 간주하지 않는다.

Next Route의 표준 `Request`만으로 신뢰할 socket peer를 얻지 못하고 proxy 경계도 D03이라 create limiter는 모든 caller를 하나의 process-global key로 묶어 fail closed한다. Unlock도 forwarded header를 사용하지 않고 process-global 50회/15분과 canonical Project별 10회/15분을 함께 적용한다. Project key map은 1,024개로 제한하고 만료 key를 정리하며 capacity 초과는 fail closed한다. 이 process-local limiter는 restart 시 초기화되고 여러 정상 사용자가 global 한도를 공유한다. D03/W16에서 trusted proxy hop과 peer 전달 방식을 확정한 뒤 application key를 세분화하고 proxy의 persistent limit을 함께 적용한다. 잘못된 proxy trust는 rate limit 우회와 log spoofing을 만든다.

추가 resource limit:

- Password 최대 bytes와 KDF concurrency semaphore
- JSON/CSV byte, nesting depth, row/task/link 수
- Task name/description/external ID 문자열 길이
- Hierarchy depth, dependency count, graph/date traversal 상한
- Export 대상 row/date span과 동시 workbook 생성 수
- Request timeout과 slow body read 제한

정확한 수치는 benchmark와 실제 reverse proxy 구성 후 deployment owner가 승인한다.

## 7. Optimistic Concurrency와 원자성

권한이 있다는 사실은 stale write를 허용하지 않는다. Project 생성/unlock/logout 외 mutation은 aggregate revision `If-Match`를 요구한다.

- Revision은 transaction 안에서 compare-and-increment한다.
- 권한/Origin 검증 후에도 DB revision이 달라지면 write하지 않는다.
- Task/link/calendar/import 변경과 Scheduling Engine 결과 저장은 all-or-nothing이다.
- Import preview의 `baseRevision`은 lock이 아니며 commit 때 재검증한다.
- Preview는 authenticated non-mutating POST로 Session과 Origin은 필수지만 If-Match는 요구하지 않는다. DB와 revision을 변경하지 않는다.
- Manual schedule conflict, circular dependency, duplicate ID, DB error가 하나라도 발생하면 전체 rollback한다.

이 정책은 데이터 손상과 lost update를 줄이지만 session 탈취를 막지는 않으므로 Cookie/TLS/XSS 방어가 별도로 필요하다.

## 8. Input, Import, Export 안전

### 일반 입력과 SQL

- Server가 Zod schema와 domain validation을 모두 수행한다.
- JSON unknown field는 기본적으로 거부해 mass assignment를 막는다.
- SQL 값은 모두 parameter binding한다.
- 사용자 제공 sort/filter field는 allowlist mapping 후 사용한다.
- `externalId`는 불투명한 case-sensitive 값으로 다루고 앞뒤 공백을 허용하지 않는다.
- 사용자 문자열을 HTML로 직접 삽입하지 않고 React의 기본 escaping을 유지한다.

### Import

- DRM 원본 Excel을 server가 직접 열거나 DRM 해제/우회를 시도하지 않는다.
- 승인된 VBA가 생성한 JSON/CSV만 다루며 browser validation 결과를 신뢰하지 않는다.
- MIME/확장자만 신뢰하지 않고 실제 JSON/CSV parse 결과를 검증한다.
- JSON `schemaVersion`, required field, date, progress, type, tasks 배열 기반 sibling 순서, parent/dependency, cycle을 검증한다.
- CSV cell을 formula나 code로 평가하지 않는다.
- Unknown schema version, unsupported dependency/lag, 오류 row를 누락하거나 자동 보정하지 않는다.
- Import는 create-only transaction이며 partial result를 저장하지 않는다.
- 원본 import body와 task names를 일반 access log에 기록하지 않고 schema version, byte/row count, 결과 code만 남긴다.

CSV는 공동 검토한 IMPORT_SCHEMA.md 1.0을 따른다. Predecessor JSON array cell, 동일 metadata, UTF-8/RFC4180을 검증하고 row 순서를 sibling order로 보존한다. Planning QA는 통과했으며 실제 parser 구현·실행 검증은 아직 미완료다.

### Excel export

- ExcelJS cell에는 user string을 string value로만 넣고 `formula`, rich value, hyperlink object로 해석하지 않는다.
- `=`, `+`, `-`, `@`로 시작하는 사용자 값도 formula로 만들지 않도록 workbook XML round-trip test를 둔다.
- 외부 hyperlink는 검증한 `APP_BASE_URL`과 Project public UUID로 만든 direct URL 하나만 허용한다.
- Task/description에 들어 있는 URL을 자동 hyperlink로 만들지 않는다.
- Filename은 server 생성 UUID 기반 ASCII allowlist로 만들고 CR/LF와 path separator를 허용하지 않는다.
- Password, hash, session, Cookie, internal DB ID를 workbook metadata/cell/URL에 포함하지 않는다.

## 9. APP_BASE_URL과 URL 안전

W04 Project create handler는 요청을 처리하기 전에 `APP_BASE_URL`을 다음 조건으로 검증하고 실패를 안전한 `500 CONFIGURATION_ERROR`로 반환한다. W16 production startup/readiness에서도 같은 검증을 수행해 잘못된 설정으로 server가 ready가 되지 않게 하는 것은 후속이다.

- 절대 `http:` 또는 `https:` URL
- Production은 `https:` 필수
- username/password, query, fragment 없음
- 필요한 deployment base path 정책을 명시적으로 적용

Project URL은 URL parser로 base와 `/projects/{canonicalUuid}`를 결합한다. Request Host, forwarded Host 또는 사용자 입력으로 export hyperlink를 만들지 않아 host-header injection을 피한다.

## 10. Logging, Error, Secret 처리

반드시 redact하거나 기록하지 않는 값:

- `editPassword`, `newEditPassword`
- `Cookie`, `Set-Cookie`, session token/digest
- password salt/hash/KDF derived key
- 전체 import payload
- 환경변수와 `.env` 내용

Structured log에는 request ID, route template, method, status, duration, Project public ID(운영 분류에 따라 hash 가능), entity counts, 안정 오류 code만 기록한다. Authorization header나 raw URL query를 통째로 남기지 않는다.

Client error는 SQL, stack trace, native module error, filesystem path를 숨긴다. Server log도 secret이 들어갈 수 있는 error object/request body를 그대로 serialize하지 않는다. Incorrect password와 unknown Project의 unlock message를 구분하지 않는다.

## 11. Transport와 Browser 보안

Production은 HTTPS만 사용하고 HTTP는 trusted proxy에서 redirect한다. Proxy TLS termination을 사용할 경우 application이 trusted proxy와 production mode를 정확히 인식해야 `Secure` Cookie를 보장할 수 있다.

권장 header baseline:

```text
Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: 불필요한 capability 비활성화
```

HSTS는 HTTPS 운영과 subdomain 영향 범위를 검토한 deployment owner가 proxy에서 활성화한다. SVAR나 필요한 style/script 자원이 CSP에 요구하는 항목은 공식 배포 asset을 확인해 최소 범위만 추가하며 임의의 wildcard를 넣지 않는다.

## 12. Database와 Backup

- SQLite file, WAL/SHM, backup을 image/Git/public web root에 넣지 않는다.
- Container process user와 backup operator에게 필요한 최소 filesystem permission만 준다.
- SQLite 자체 암호화를 가정하지 않는다. Host/volume/backup access control이 at-rest boundary이다.
- Backup에는 password hash와 session digest가 포함되므로 민감 데이터로 취급하고 접근/보존/폐기 정책을 둔다.
- Restore 후 만료 session 정리를 수행하며, 보안 사고 복구라면 `auth_version` 증가 또는 session table 정리로 모두 revoke한다.
- `PRAGMA foreign_keys=ON`, integrity/foreign-key check, parameter-bound query를 검증한다.

### CI/CD와 image supply chain

- Pull Request Actions는 `contents: read`만 사용하고 registry login, package write, personal token을 제공하지 않는다. `pull_request_target`에서 PR code를 실행하지 않는다.
- GHCR publish job만 job-scoped `GITHUB_TOKEN`과 최소 `packages: write`를 사용한다. Attestation을 생성하는 동일 job에만 `attestations: write`, `id-token: write`를 추가한다.
- 외부 Action은 reviewed full commit SHA, Node base image는 reviewed digest로 고정한다. Dependabot update도 permissions·release notes·runtime smoke를 검토한 뒤 merge한다.
- `.env*`, SQLite/WAL/SHM, backup, log, test artifact, `.git`은 Docker build context와 image layer에서 제외한다.
- Password, token, Cookie, 환경값을 build arg, OCI label, cache key, artifact, workflow summary에 전달하지 않는다.
- Stable과 prerelease tag를 분리하고 test/deployment는 mutable `latest`가 아닌 exact version 또는 digest를 사용한다.
- Release는 repository 단위로 직렬화하고 이전 tag보다 큰 annotated SemVer만 허용한다. Local candidate를 먼저 검증하고 GHCR에는 immutable commit candidate만 쓴 뒤 digest runtime smoke·attestation이 성공해야 rolling alias와 exact version을 승격한다.
- Production runtime configuration은 migration 전에 canonical URL/path를 검사하고 readiness도 DB open 전 fail closed한다.
- Publish한 GHCR digest를 새로 pull하여 readiness와 SQLite runtime을 검증하며 SBOM/provenance를 생성한다. 세부 계약은 [CI_CD.md](CI_CD.md)를 따른다.
- 과거 도구 출력에 노출된 repository credential은 교체가 권고된다. 사용자는 2026-09-12 기존 값 재사용의 잔여 위험을 명시적으로 수용했으며, 이는 안전 판정이나 일반적인 secret rotation 원칙의 완화가 아니다. 값 자체는 다시 읽거나 출력·문서화하지 않는다.

## 13. 주요 Threat와 대응

| Threat | 대응 |
|---|---|
| Password DB 유출 후 offline guessing | project별 random salt, memory-hard scrypt, parameter 저장/상향, password policy |
| Online guessing/KDF DoS | generic error, layered rate limit, KDF concurrency/size limit |
| Session DB 유출 | random bearer token 원문 미저장, digest만 저장, TTL/revoke |
| Session theft | HTTPS, HttpOnly/Secure/SameSite Cookie, CSP/XSS 방어, rotation |
| CSRF | exact Origin, SameSite Strict, credentialed CORS 비활성화 |
| IDOR/cross-project write | session-project binding, 모든 query의 project_id, composite FK |
| Lost update | If-Match aggregate revision과 atomic transaction |
| SQL injection | Repository only, prepared statement, structural allowlist |
| Malicious/oversized import | byte/entity/depth/date 상한, server revalidation, no formula execution, rollback |
| Excel formula/link injection | user value를 text로 강제, hyperlink allowlist, XML/Excel QA |
| Host header poisoning | trusted APP_BASE_URL만 사용 |
| Public data overexposure | direct links가 비밀이 아님을 명시, list route 미확정/비활성화 |
| Malicious PR의 token/package 탈취 | PR read-only, publish workflow 분리, `pull_request_target` 금지, 개인 PAT 미사용 |
| Action/base image 공급망 변조 | full Action SHA와 base digest pin, reviewed automated update, SBOM/provenance |
| Mutable image로 인한 재현 불가 | exact Semantic Version/digest 사용, stable/prerelease alias 정책, tag force-update 제한 |

## 14. Security 검증 목록

아래는 전체 보안 검증 계획이다. W04의 생성 bootstrap, W05의 password/session·Project 보호 mutation에 이어 W07 root Task/Milestone authorization과 현재 Route inventory의 자동화·독립 QA를 **PASS**했다. W02의 cross-project FK와 W07 Project-scoped Task/Link Repository 기반도 PASS다. W20의 로컬 image supply-chain 자동화는 PASS했지만 원격 Actions/GHCR 증거 전에는 remote publish를 PASS로 간주하지 않는다. 외부 Link/Import의 실제 authorization과 운영 access log·proxy/KDF benchmark는 후속이다. [W07 근거 및 한계](W07_REVIEW.md), [W20 근거 및 한계](W20_REVIEW.md), [CI/CD](CI_CD.md)

- 동일 password의 Project 두 개가 서로 다른 salt/hash를 가짐 — W04 PASS
- Password 원문/후보가 DB, response/error/URL/DOM에 없음 — W04 PASS; server log/workbook은 NOT TESTED
- Correct/incorrect/unknown/corrupt credential unlock, dummy KDF와 bounded rate limit — W05 PASS
- Session token DB 원문 부재 — W04 PASS; wrong-project/expired/revoked/auth-version/credential-integrity mismatch 거부와 idempotent logout — W05 PASS
- Production Cookie의 HttpOnly/Secure/SameSite/Path/Domain 속성 — W04 PASS
- Create의 missing/null/cross Origin 거부 — W04 PASS; W05 unlock/logout/metadata/password Origin과 현재 Route/CORS inventory — W05 PASS
- Session 없이 Project metadata/password mutation 거부 — W05 PASS; root Task mutation — W07 PASS; Calendar/Link/Import는 후속
- Public Task UUID와 valid wrong-Project Cookie를 결합해도 Task read/write 불가, parent/link composite FK와 Repository Project scope — W02/W07 PASS
- Metadata/password의 missing·malformed·stale revision과 동시 동일 revision write — W05 PASS; Task의 missing/stale revision, 실제 동시 HTTP write 하나만 성공, create/update/delete fault rollback — W07 PASS; hierarchy/FS/import rollback은 후속
- Import size/depth/count/date traversal 상한
- Export formula/hyperlink/filename injection과 secret scan
- `.env`, SQLite, WAL/SHM, backup의 Git/image 제외
- Dependency audit, Node/native module/runtime compatibility, production security header
- PR read-only token, publish 최소 권한, Action SHA/base digest, stable/prerelease tag, SBOM/provenance, GHCR digest pull smoke

## 15. Decision Required

- Project discovery를 공개, upstream 인증, direct-link only 중 어느 정책으로 운영할지
- Readonly Project 내용에 조직 기밀성이 필요한지; 필요하다면 별도 read authorization 설계
- 조직 password 최소 길이/복잡도/rotation 정책
- Production hardware에서 scrypt profile과 KDF concurrency benchmark 승인
- Session 8시간 TTL과 동시에 여러 Project edit UX 승인
- Trusted proxy hop, application/proxy rate-limit 수치와 persistent limiter 필요 여부
- Backup encryption, 보존 기간, 복구 시 session revoke 운영 절차

D04의 GHCR private·consumer 최소 pull 권한·main/tag ruleset·release authority 정책은 2026-09-12 결정 완료했다. 실제 GitHub 적용과 원격 증거는 usable 인증 구성 후 검증한다.

## 16. 근거 자료

- [Node.js Crypto: scrypt, randomBytes, randomUUID, timingSafeEqual](https://nodejs.org/api/crypto.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [SQLite Foreign Key Support](https://www.sqlite.org/foreignkeys.html)
