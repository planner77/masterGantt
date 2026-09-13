# CI #36 — 실제 서버 E2E의 상태 격리

## 실패 증거

- 원본 실행: [CI #36](https://github.com/planner77/masterGantt/actions/runs/34757669954), PR #20, head `63cb6f4df0bba010da7bea4d0e1eedbb01f08dc0`, attempt 1.
- Quality PASS: 33개 파일 / 431개 테스트, 타입/lint/build 및 기존 gate 성공. Docker PASS. Chromium E2E는 24개 중 23개 PASS, 1개 FAIL.
- 실패 Job `103724969450`, step `npm run test:e2e`. `project-task-persistence.spec.ts`의 `createProject`에서 `page.waitForURL`이 30초 후 timeout. 작업 이동·저장 검증에 진입하기 전에 실패했다.
- 보존된 Playwright artifact `10317483039`의 trace를 확인했다. Archive SHA-256: `fd0affc4fac1b262c235ca9bc8e32c9c4f2041daa4d475cfd5bb1165fa479aaa`.
- `2026-09-13T12:43:27.082Z`의 `POST /api/projects` 응답은 **429 / RATE_LIMITED / Too many project creation attempts. / Retry-After: 3503**이다. 요청 본문의 비밀번호와 쿠키는 이 문서에 기록하지 않는다.

## 근본 원인

`projectCreateRateLimiter`는 프로세스 메모리의 FixedWindowRateLimiter이며 유효한 생성 시도를 1시간에 5회 허용한다. 생성 handler는 사용자별이 아닌 공통 `unattributed` 키를 사용한다. 기존 suite는 하나의 webServer를 공유하므로 새 browser/context, `workers: 1`, 프로젝트 삭제는 그 서버의 메모리 카운터를 초기화하지 않는다.

CI #36에서는 create/read 1회 + validation recovery 1회 + authorization 두 프로젝트 2회 + 새 Editor persistence 1회가 먼저 수행됐다. 그다음 pointer persistence의 생성 요청이 여섯 번째가 되어 차단됐다. 429는 masterGantt 테스트 서버가 반환한 것이며 GitHub API/계정 시간 제한이나 외부 서비스 제한이 아니다. 새 CI runner는 이전 실행의 카운터를 물려받지 않지만 같은 suite를 그대로 실행하면 다시 누적될 수 있다.

## 수정

`tests/e2e/fixtures/isolated-application.ts`를 실제 서버 테스트의 공통 fixture로 도입한다. 테스트마다 새 Next 프로세스, loopback 포트/APP_BASE_URL, 임시 SQLite와 고유 `.next-e2e-isolated-<uuid>`를 만든다. distDir는 기존 next.config.ts 검증 규칙을 따른다. HTTP를 사용하는 기존 development E2E 설정을 유지하며 production 정책은 변경하지 않는다.

다음 실제 서버 spec은 이 fixture의 test/expect를 import하고 `test.use(isolatedApplicationOptions)`로 baseURL을 지정한다.

- `project-create-and-read.spec.ts`
- `project-edit-authorization.spec.ts`
- `project-task-editor-persistence.spec.ts`
- `project-task-persistence.spec.ts`

readiness와 읽기 전용 GET warmup은 별도 fixture setup 예산(120초, startup/warmup 90초)에 둔다. 기존 테스트 본문의 30초 제한, 기대값, clock, 재시도 수는 변경하지 않는다. setup GET은 생성 요청을 하지 않는다. 각 시나리오 내부에서는 같은 서버/DB를 유지하므로 권한·revision 경합·저장/재조회 검증이 그대로 동작한다. 종료 시 해당 fixture의 프로세스 트리만 종료한 뒤 자신이 만든 임시 DB/output만 삭제한다.

`submitProjectAndExpectCreated`는 생성 버튼 클릭 전에 응답 대기를 등록하고 HTTP 201을 확인한 후 기존 URL 검증으로 이어진다. 실패하면 HTTP 상태, 허용 문자로 제한한 error code, 숫자 Retry-After만 진단한다. 비밀번호/쿠키/전체 응답 body를 출력하거나 자동 재시도하지 않는다.

mock UI와 demo spec의 공유 서버 설정은 유지한다. 운영 rate limit, security handler, DB/API/feature 구현, GitHub workflow와 전체 gate를 완화하지 않는다.

## 회귀 검증

`project-create-isolation.spec.ts`에 독립 테스트 두 개를 추가한다. 각 테스트는 빈 프로젝트 목록에서 시작해 실제 API 생성 5회 성공, 다른 HTTP client의 6번째 생성 429, Retry-After, 생성 목록 5개 유지를 확인한다. 두 번째 테스트도 같은 조건으로 통과해야 이전 테스트의 DB/메모리 상태가 넘어오지 않았다는 증거가 된다. 정상 요청은 실패시키지 않고 보안 제한 자체는 유지하는지 함께 확인한다.

기존 24개 Browser 테스트를 유지하고 두 개를 추가하여 총 26개를 전체 실행한다. 단위/통합 테스트는 기존 431개를 유지한다. 전체 정합성은 새 PR head의 GitHub Actions quality/e2e/docker로 판정한다. 로컬 전체 테스트는 기존 사용자 보류 요청에 따라 **NOT TESTED**다. 수정 커밋 작성 시 새 head의 원격 검증은 **NOT TESTED**이며 PR 댓글에 정확한 SHA/run별 최종 결과를 추가한다. CI #36 원본 실패는 보존한다.

## 외부 서버 / 운영 제약

`PLAYWRIGHT_BASE_URL`을 지정하면 기존처럼 사용자가 관리하는 서버를 사용하며 자동 프로세스/DB 격리는 제공하지 않는다. 기존 실제 API 시나리오는 폐기 가능한 외부 인스턴스에서 선별 실행하고 서버 상태를 사용자가 준비해야 한다. 새 quota/isolation 회귀 두 건은 외부 서버의 생성 한도를 소모하지 않도록 외부 URL 지정 시 mutation 전에 명시적으로 실패한다. 운영 서버에서는 실행하지 않는다.

현재 GitHub Linux의 실제 실행과 Windows 프로세스 정리, 외부 서버 및 수동 사용자 환경 검증을 구분한다. Windows 및 외부 환경은 이번 변경에서 **NOT TESTED**다. 새 CI 서버를 사용하는 것은 운영 서버 재시작 또는 운영 데이터 삭제를 의미하지 않는다. main 병합·GHCR 게시·릴리스·배포는 이 수정 범위 밖이다.

## 참고

- [Task Editor 계약](TASK_EDITOR.md)
- [원격 검증 정책](REMOTE_VALIDATION.md)
- [CI/CD 정책](CI_CD.md)
- [Playwright fixtures](https://playwright.dev/docs/test-fixtures)
- [Playwright fixture timeout](https://playwright.dev/docs/test-timeouts#fixture-timeout)
- [GitHub-hosted runners](https://docs.github.com/en/actions/concepts/runners/github-hosted-runners)
