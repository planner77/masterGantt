# W05 Readonly and Edit Authorization review

검증일: 2026-09-11. 최종 판정은 **독립 Backend/Security·Frontend/Browser QA PASS / Manager ACCEPT**다. 이 판정은 W05 Project edit session과 metadata 보호 mutation 범위이며 전체 제품 release 승인이 아니다.

## Summary

W05는 저장된 Project edit password로 unlock하고, Project-bound session의 current/logout/expiry/revoke/auth-version lifecycle을 검증하며, metadata PATCH와 password rotation을 server-side authorization으로 보호한다. Direct snapshot은 Cookie와 무관하게 계속 Readonly이고 UI는 별도 current-session 응답이 유효할 때만 edit control을 표시한다.

대표 보호 mutation은 `PATCH /api/projects/{publicId}`이며 Task/Link/Import route가 아직 없다는 사실을 실제 route export와 security inventory로 검증한다. 따라서 W05의 PASS를 Task CRUD나 Import authorization까지 확대하지 않는다.

## Requirement Coverage

| 범위 | 결과 | 증거 |
| --- | --- | --- |
| Readonly 기본값과 unlock | PASS | Direct GET은 항상 Readonly; correct password만 session 발급; wrong/unknown/corrupt credential은 동일 401과 dummy scrypt |
| Session binding/lifecycle | PASS | Project binding, strict expiry, revoke, auth-version과 credential integrity; current GET 비변경; logout idempotency |
| Server-side mutation authorization | PASS (Project metadata/password) | no-session·wrong-project·expired·revoked·noncanonical persisted ID 거부와 DB/KDF 불변 |
| Revision 동시성 | PASS | strong positive `If-Match`, 428/400/412, 동일 revision 병렬 PATCH는 정확히 200 하나와 412 하나 |
| Password rotation | PASS | 새 KDF는 transaction 밖, final session/revision은 write lock 안; credential/auth-version/revision/revoke/new caller session 원자 저장·rollback |
| Browser workflow | PASS | 잘못된/정상 unlock, metadata 저장·reload, old session/password 무효화, 새 password, logout과 재호출 |
| Route/CORS inventory | PASS (현재 route) | 실제 Route Handler export 대조, live HEAD/OPTIONS 상태 불변과 credential CORS header 부재 |
| Task/Link/Import authorization | BLOCKED / NOT TESTED | Route 자체가 후속 W07/W12 범위 |

## Research Findings

- Node `crypto.scrypt`와 `timingSafeEqual` 계약에 맞춰 지원하는 recorded KDF profile만 처리하고 같은 길이 Buffer를 비교한다. Unknown Project와 손상 record도 공통 capacity를 거치는 dummy scrypt를 수행한다.
- Next.js 16.3.4의 local Route Handler, cookie, dynamic route 문서를 구현 전에 확인했다. Route는 request parsing과 response 변환만 담당하고 authorization/transaction은 Service에 둔다.
- SameSite Cookie만 CSRF 경계로 보지 않고 unsafe route마다 trusted `APP_BASE_URL`과 exact `Origin`을 비교한다. Forwarded client IP는 trusted proxy 결정 전 limiter key로 사용하지 않는다.

## Architecture Decisions

- Browser는 root `Path=/` edit Cookie 하나만 유지하므로 마지막으로 unlock한 Project 하나가 edit 대상이다. 다른 Project의 Cookie는 owner Project까지 유효한 session일 때만 logout에서 보존한다.
- Unlock limiter는 process-global 50회/15분과 canonical Project별 10회/15분, 최대 1,024 Project key의 bounded fail-closed 정책이다. 여러 instance/persistent limiter와 KDF benchmark는 D03/W16에서 재검증한다.
- Current-session GET은 순수 read이고 TTL·Cookie·DB를 갱신하지 않는다. Mutation은 UI permission과 무관하게 write transaction에서 session을 최종 재검증한다.
- Playwright 기본 server는 격리 Turbopack이고 worker 1개다. Process-global create limiter를 spec 사이에서 경쟁시키지 않되 revision race는 spec 내부 병렬 HTTP로 검증한다. Production build는 Webpack 설정을 유지한다.

## Verification

환경: Linux 6.6.87.2 WSL2 x86_64, Node 22.14.0, npm 11.10.0, Google Chrome for Testing 145.0.7632.6.

| Command | Result |
| --- | --- |
| `npm test` | PASS — 11 files, 91 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — Next.js 16.3.4 production Webpack build와 W05 dynamic routes |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE=… npm run test:e2e` | PASS — clean default Turbopack, Chromium 4/4, worker 1 |
| `npm audit --omit=dev` | PASS — production vulnerabilities 0 |
| `git diff --check` | PASS |

Vitest는 strict JSON/Origin/If-Match, Cookie parser와 production attributes, KDF profile/dummy/capacity, bounded limiter, session binding/expiry/revoke/auth-version, repository scope, transaction fault rollback, canonical public ID와 route inventory를 포함한다.

Chromium은 W03 Gantt 회귀와 W04 생성/Readonly에 더해 password unlock, no-session/cross-project denial, metadata save/reload, live HEAD/OPTIONS, 동일 revision concurrent PATCH, stale write, password rotation, retained old session 무효화, old/new password와 idempotent logout을 실제 HTTP로 검증한다.

첫 기본 E2E 병렬 실행은 3/4 PASS 후 Project 생성 recovery가 429로 종료되어 FAIL했다. Page snapshot으로 네 spec이 process-global 5회/시간 create limiter를 공유해 마지막 request가 한도를 초과한 것을 확인했다. Browser suite를 worker 1개로 직렬화하고 clean `.next-e2e`에서 기본 명령을 다시 실행해 4/4를 통과했다. 이에 앞서 Webpack 개발 cache에서는 concurrent request 중 transient manifest JSON 오류도 재현되어 기본 E2E server를 Turbopack으로 전환했다. 두 최초 실패를 retry 성공으로 숨기지 않고 원인과 설정 변경을 기록했다.

## Changed Files

- `src/app/api/projects/[publicId]/**`: metadata, unlock/current/logout, password rotation Route Handler
- `src/server/projects/**`, `src/server/repositories/project-repository-core.ts`: authorization orchestration, canonical snapshot, scoped repository와 atomic mutation
- `src/server/security/**`, `src/server/http/request-core.ts`: KDF verification, Cookie parser, limiter, Origin/body/If-Match와 route inventory
- `src/contracts/projects.ts`: public session·metadata 계약
- `src/app/projects/[publicId]/**`, `src/features/projects/**`, `src/app/globals.css`: Readonly/edit synchronization과 unlock/save/rotation/logout UI
- `tests/server/projects/**`, `tests/e2e/**`: W05 security/service/handler/browser evidence
- `playwright.config.ts`: isolated Turbopack·worker 1 기본 E2E

기존 `0001_initial_schema.sql`이 password KDF, `auth_version`, edit session binding/expiry/revoke와 Project revision을 이미 제공하므로 W05 migration은 추가하지 않았다.

## Security Findings

- 최초 독립 QA는 write lock 전에 잡힌 expiry 시각, 단순히 존재하기만 하는 wrong-project session Cookie 보존, protected route의 canonical public ID 누락을 발견했다. 각각 lock 안의 현재 시각·owner session 전체 유효성 검사·DB 조회 전 canonical 검사로 수정했고 deterministic regression test를 추가했다.
- Password/session 원문은 URL, DOM, response body, non-cookie header와 DB에 저장하지 않는다. Opaque session 원문은 의도한 HttpOnly `Set-Cookie`에만 존재한다.
- W04 중 기존 `.env` 자격증명 값 하나가 Sub-Agent의 비공개 도구 출력에 노출된 incident가 있었다. 값은 source/Git/user message에 복사되지 않았고 이 검증에서도 `.env`를 읽거나 사용하지 않았다. 당시 폐기·재발급을 요구했지만 2026-09-12 사용자가 ADR49에서 재사용 위험을 명시적으로 수용했다.

## Independent QA

Backend/Security QA는 세 차례 finding 보완 뒤 targeted 3 files/36 tests와 전체 91 tests, typecheck, lint, diff를 재검증하고 PASS/ACCEPT했다. Frontend/Browser QA는 Readonly fallback, edit control, secret clearing, revision/401/412 처리와 W05 E2E를 대조해 PASS/ACCEPT했다. Manager는 production build, clean 기본 E2E 4/4와 audit 0건을 추가 재현했다. 최종 QA/Docs Agent도 현재 worktree에서 91 tests, typecheck, lint, build, audit, diff, 문서 링크와 비밀 패턴 검사를 독립 재실행해 PASS/ACCEPT했다.

## Documentation Updated

`API.md`, `SECURITY.md`, `ARCHITECTURE.md`, `DB_SCHEMA.md`, `RESEARCH.md`, `DECISIONS.md`, `ISSUE_BREAKDOWN.md`, `REQUIREMENTS.md`, `TEST_PLAN.md`, active `PLAN.md`, `PRO_FEATURE_MATRIX.md`, `README.md`를 W05 실제 구현·검증 상태에 맞췄다.

## Remaining Risks

- Process-local limiter는 single instance 개발 경계다. Production proxy identity, persistent/distributed rate limit과 실제 target의 scrypt 자원 benchmark는 D03/W16까지 NOT TESTED다.
- Task/Link/Calendar/Import route가 아직 없어 해당 mutation authorization, scheduling rollback과 import race는 W06–W12까지 BLOCKED/NOT TESTED다.
- UI의 current-session network failure와 form-level 412 복구는 코드·component 경계를 검토했지만 전용 browser fault interception test는 없다. Keyboard/screen-reader/responsive 수동 검증도 남아 있다.
- Direct URL은 읽기 기밀성을 보장하지 않는다. D02 결정 없이 실데이터 production 노출을 승인하지 않는다.
- 운영 access log redaction, CSP/header baseline, Docker/native target, restart persistence와 backup/restore는 W16까지 NOT TESTED다.

## Recommendation

W05는 ACCEPT하고 다음 독립 기반인 W06 Working Calendar and Duration으로 진행한다. 당시 GitHub push/release 전 credential 교체를 요구했지만 이 조건은 ADR49의 사용자 위험 수용 결정으로 대체됐다. 이후 W22에서 repository admin 인증은 성공했으며, 실제 원격 workflow/GHCR 증거와 plan-dependent ruleset/attestation은 별도 상태로 추적한다.
