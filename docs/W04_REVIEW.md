# W04 Project Create and Direct Read review

검증일: 2026-09-11. 최종 판정은 **독립 QA PASS / Manager ACCEPT**다. 이 판정은 W04 Project 생성·Direct Read 범위이며 전체 제품 release 승인이 아니다.

## Summary

W04는 Project 생성 form과 Direct Readonly 화면, `POST /api/projects`, `GET /api/projects/{publicId}`를 구현했다. 생성은 strict server validation과 abuse 경계를 지난 뒤 password를 scrypt로 derivation하고 Project와 최초 edit session digest를 하나의 SQLite transaction에 저장한다. D02가 미확정이므로 Project collection discovery는 활성화하지 않았다.

W04가 발급한 session을 검증해 edit mode를 여는 기능, unlock/logout/expiry/revoke/password rotation, 보호 mutation authorization은 W05다. 생성 직후 session Cookie가 있어도 direct GET과 UI는 의도적으로 Readonly다.

## Requirement Coverage

| 범위 | 결과 | 증거 |
| --- | --- | --- |
| Project name/description/edit password 입력 | PASS | Client form + strict Zod server contract; name만 trim, description/password 보존 |
| 안정적인 직접 URL | PASS | canonical lowercase UUID v4, bounded collision retry, `Location: /projects/{publicId}` |
| SQLite 저장과 재조회 | PASS | 실제 migration/Repository/Service integration, DB close·reopen 후 snapshot 유지 |
| Password 저장 안전 | PASS (W04 범위) | async scrypt, random salt, derived material만 저장, DB file·response secret scan |
| 최초 session 발급 | PASS (생성 범위) | random 256-bit token, SHA-256 digest DB 저장, 8-hour hardened Cookie, Project+session atomic rollback |
| 기본 Readonly | PASS | 생성 browser·reload·새 Cookie 없는 browser 모두 Readonly; edit control 없음 |
| Project isolation | PASS | Project-scoped task/link/holiday snapshot과 public DTO secret/internal ID 제외 |
| Project 목록 | PASS (차단) | 홈은 DB collection을 호출하지 않고 `GET /api/projects`는 405/`Allow: POST` |
| Edit authorization | NOT TESTED / W05 | 저장 session의 검증·binding·expiry·revoke와 mutation route는 미구현 |

## Architecture and Security Decisions

- HTTP Route는 exact `APP_BASE_URL` Origin, `application/json` UTF-8, identity encoding, 선언·실제 32 KiB 상한을 검사한다.
- 입력 object는 unknown field를 거부한다. `name` 1–200 code points, `description` 0–4,000 code points, `editPassword` 12+ code points/UTF-8 1,024 bytes 이하이며 malformed surrogate를 거부한다.
- scrypt profile은 `N=32768`, `r=8`, `p=3`, key 32 bytes, salt 16 bytes, `maxmem=64 MiB`; process 동시 실행은 2개다. 실제 production resource benchmark는 D03/W16에 남긴다.
- 신뢰할 peer/proxy 설정이 없으므로 forwarded IP를 사용하지 않는다. W04 create limiter는 process-global `unattributed` key로 5회/1시간을 fail closed하게 적용한다. 여러 정상 caller가 한도를 공유하고 restart 시 초기화되는 제약은 production proxy/persistent limiter로 보완해야 한다.
- Production Cookie는 `__Host-mastergantt_edit`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Max-Age=28800`, Domain 없음이다. Local HTTP는 non-prefix name과 Secure 없음으로 분리한다.
- Direct snapshot은 하나의 read transaction 안에서 Project/tasks/links/holidays를 읽고 public DTO만 반환한다. malformed와 absent UUID는 동일한 안전한 404다.

## Verification

환경: Linux x64, Node 22.14.0, npm 11.10.0, Google Chrome for Testing 145.0.7632.6.

| Command | Result |
| --- | --- |
| `npm test` | PASS — 8 files, 55 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — Project UI와 두 API dynamic route 포함 |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE=… npm run test:e2e` | PASS — Chromium 3/3, 기본 3 workers |
| `npm audit --omit=dev` | PASS — production vulnerabilities 0 |
| `git diff --check` | PASS |

Vitest는 입력 Unicode/byte 경계, content type/encoding/body limit, exact Origin, rate/KDF capacity, salts/hash/session material, Cookie, transaction rollback, UUID collision, safe errors/404, Project isolation, DB 재개방을 검증한다.

Chromium은 실제 API로 생성→UUID redirect→Readonly metadata→reload, 새 browser context Readonly, collection API 미호출과 실제 405, password URL/DOM 비노출, 11개 astral Unicode 문자의 client code-point 길이 거부, server validation 오류 후 password 초기화·복구, W03 Gantt 회귀를 검증한다. 최초 sandbox 실행의 `listen EPERM`은 실행 환경의 port 권한 때문이었고 권한 있는 기본 병렬 명령으로 3개가 통과했다.

## Changed Files

- `src/app/api/projects/**`, `src/server/projects/**`: Route/contract/service/handler
- `src/server/http/**`, `src/server/security/**`: bounded JSON, safe errors, Origin, scrypt, session, Cookie, limiter
- `src/server/repositories/**`: edit session insert와 기존 Project Repository export
- `src/contracts/projects.ts`: public request/response DTO
- `src/app/projects/**`, `src/features/projects/**`, `src/app/globals.css`: create/direct Readonly UI
- `tests/server/projects/**`, `tests/e2e/project-create-and-read.spec.ts`: unit/integration/browser evidence
- `next.config.ts`, `playwright.config.ts`, `.gitignore`, `eslint.config.mjs`, `tsconfig.json`: 격리 E2E 출력과 type/lint 경계
- `package.json`, `package-lock.json`: Zod 4.6.2 exact dependency

기존 `0001_initial_schema.sql`이 Project password와 edit session column/constraint를 이미 제공하므로 새 migration은 필요하지 않았다.

## Security Findings

- 제출한 password는 response body/error/non-cookie header/DB file/URL/DOM에서 발견되지 않았다. Session 원문은 의도한 HttpOnly `Set-Cookie`에만 존재하고 response body/다른 header/DB에는 없으며 DB에는 digest만 저장된다.
- W04 작업 도중 기존 `.env`의 자격증명 값 하나가 한 Sub-Agent의 비공개 도구 출력에 우발적으로 노출되었다. 값은 source, Git diff, 사용자 메시지에 복사되지 않았고 `.env`는 Git 제외 상태이나, 해당 자격증명은 폐기·재발급해야 한다. 이 검토에서도 `.env`를 다시 읽지 않았다.
- Server access-log redaction, penetration test, CSP/header baseline, production proxy와 scrypt benchmark는 아직 NOT TESTED다.

## Independent QA

qa_docs는 현재 worktree의 구현·테스트·문서를 독립 대조하고 별도 실행으로 Vitest 55/55, typecheck, lint, production build, `git diff --check`를 모두 PASS했다. Manager의 Chromium E2E 3/3과 production audit 0건 증거도 대조했다. 검토 중 홈 discovery 문구, client password Unicode code-point 계산, AUTH11의 정상 `Set-Cookie` 예외, README 환경 변수 설명을 지적했고 Manager가 수정한 결과를 다시 확인했다. 열린 W04 failure나 regression blocker는 없다는 결론이다.

## Remaining Risks

- W04 session은 저장·Cookie 발급까지만 구현했다. 이를 권한으로 소비하기 전 W05의 timing-safe password verify, Project binding, expiry/revoke/auth-version, logout/rotation과 route inventory가 필요하다.
- Direct URL은 읽기 기밀성을 보장하지 않는다. D02 결정 없이 실데이터 production 노출을 승인하지 않는다.
- In-memory global create limiter는 single-process 개발 경계이며 distributed/persistent abuse 방어가 아니다.
- Browser page는 metadata와 empty schedule 상태까지만 표시한다. DB-backed SVAR Gantt CRUD는 W07이다.
- Docker/native target, restart/recreate volume persistence, backup/restore는 W16까지 NOT TESTED다.

## Recommendation

W04는 ACCEPT하고 다음으로 W05 Readonly/Edit Authorization를 진행한다. Production data exposure, credential rotation 확인, W05 authorization 완료 전에는 release로 판정하지 않는다.
