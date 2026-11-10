# masterGantt Agent 실행 지침

## 1. 현행 운영 정책

Owner의 2026-11-10 최종 결정([#905](https://github.com/planner77/masterGantt/issues/905), [#906](https://github.com/planner77/masterGantt/issues/906), [#908](https://github.com/planner77/masterGantt/issues/908))을 적용한다. 모든 Issue는 위험도와 관계없이 로컬에서 검증하고 main에 직접 fast-forward Push한다. **PR 생성, GitHub Actions·원격 CI·Trusted QA·자동 Finalizer 실행은 사용하지 않는다.** 기존 workflow 파일·PR·Run·immutable tag·digest와 실패 이력은 보존한다.

작업 전 [Issue Lifecycle](docs/ISSUE_LIFECYCLE.md)을 읽고, 실제 Issue·현재 main·기존 코드/테스트·실패 원장을 조회한다. 상태·완료 조건은 해당 문서 한 곳에서 정의한다. 문서 변경은 실제 GitHub 관리자 설정 변경이 아니다. 첫 Push 전 #911의 live Ruleset/Actions 전환 증거가 없으면 `BLOCKED`이며 PR이나 `[skip ci]`로 우회하지 않는다.

## 2. 프로젝트와 Source of Truth

SVAR React Gantt Core 기반 소규모 Project 일정 관리 시스템이다. Project 직접 링크·편집 비밀번호·SQLite·Excel Import/Export·독립 Scheduling Engine·Docker 단일 인스턴스를 사용한다.

- 요구사항/구조 변경: [REQUIREMENTS](docs/REQUIREMENTS.md), [ARCHITECTURE](docs/ARCHITECTURE.md).
- API/서버/DB/인증 변경: [API](docs/API.md), [DB_SCHEMA](docs/DB_SCHEMA.md), [SECURITY](docs/SECURITY.md).
- 일정/Calendar/Dependency 변경: [SCHEDULING_ENGINE](docs/SCHEDULING_ENGINE.md). Algorithm 변경에는 Unit Test를 작성한다. SVAR PRO 비공개 구현을 복제하지 않는다.
- Import/Excel/VBA 변경: [IMPORT_SCHEMA](docs/IMPORT_SCHEMA.md), [IMPORT_EXPORT](docs/IMPORT_EXPORT.md), [VBA_EXPORT](docs/VBA_EXPORT.md). DRM 해제·우회 금지.
- UI 배치/시각 언어 변경: [DESIGN](DESIGN.md). 메뉴·탭·모달·keyboard/focus·반응형 변경: [UI_UX_GUIDELINES](docs/UI_UX_GUIDELINES.md)와 해당 화면 UX 문서. 설치 버전 Core/API·공식 SVAR 자료를 확인하고 URL 조회와 실제 조작을 구분한다.
- 테스트 계획·재사용·수명주기: [TEST_PLAN](docs/TEST_PLAN.md). CLI·환경·source admission: [LOCAL_PREPR](docs/LOCAL_PREPR.md).
- 로컬 GHCR 게시/배포/복원: [CI_CD](docs/CI_CD.md), [DEPLOYMENT](docs/DEPLOYMENT.md).
- Issue/Owner 역할·관리자 전환: [GITHUB_OPERATIONS](docs/GITHUB_OPERATIONS.md), 위임 서식: [AGENT_PROMPTS](docs/AGENT_PROMPTS.md).
- 현재 작업: [PLAN](docs/exec-plans/active/PLAN.md). 최신 제품 용어는 DESIGN의 Product Terminology를 따른다.

제품 계약 문서의 과거 PR/CI 실행 결과는 해당 시점의 증거이며 현재 작업 gate가 아니다. 이전 Agent·CI 정책의 전체 원문은 [보존 구역](docs/history/owner-ci-retired-20261110/README.md)에 있다. 신규 작업에서는 이 구역의 실행 지침을 적용하지 않는다.

## 3. 보안·구조 경계

Project direct access 기본 상태는 Readonly다. 비밀번호/session/secret을 URL·로그·DB 원문에 넣지 않는다. UI 상태를 authorization 근거로 쓰지 않고 보호 mutation은 서버 session/Origin/If-Match/revision·transaction 계약을 지킨다. 공개 Project Issue와 GitHub 개발 Issue는 별도 원장이다.

`Route Handler → Service → Repository → SQLite` 경계를 유지하고 better-sqlite3를 사용한다. DB 변경은 migration+DB_SCHEMA, API 변경은 code+API, Scheduling 변경은 code+tests+SCHEDULING_ENGINE, Import 변경은 IMPORT_SCHEMA, VBA 변경은 VBA_EXPORT, Docker 변경은 DEPLOYMENT를 함께 갱신한다. 로컬 검증·게시 계약 변경은 TEST_PLAN/LOCAL_PREPR/CI_CD/GITHUB_OPERATIONS 영향 분석을 수행한다.

저장소는 PUBLIC이다. 실운영 DB·WAL/SHM·백업·사내 주소·고객/영업/생산 원시 자료·실제 화면·토큰·`.env`·민감 로그를 Git/Issue/공개 이미지에 반입하지 않는다. 공개 증거는 합성 fixture와 정제한 결과만 사용한다.

## 4. 구현과 로컬 검증

Manager는 [Work Packet](docs/AGENT_PROMPTS.md)을 작성하고 `REUSE_REVIEW`와 `TEST_LIFECYCLE_REVIEW`를 확정한 뒤 구현을 배정한다. #895의 Owner 재사용 결정이 없고 기존 승인에서도 추론할 수 없으면 구현을 `REUSE_DECISION_REQUIRED/IMPLEMENTATION_BLOCKED`로 남긴다. 같은 범위의 명시적 결정은 재질문하지 않는다.

공통 필수 정적·Unit/Integration·production build와 영향 테스트를 완료한다. UI 영향은 실제 Chromium/keyboard/반응형/geometry·#896 증거 및 필요한 #897 로컬 격리 UAT를 포함한다. HIGH는 테스트·백업/복원 강도를 높이며 동일 direct Push 경로를 따른다. 위험별 선정·N/A 근거와 누락 처리 기준은 TEST_PLAN에 있다.

필수 검사 `FAIL/BLOCKED/NOT TESTED`, source/base/fixture/환경 drift, 미해결 UNKNOWN은 Push·Publish·Close를 차단한다. Owner의 예외 위험 수용도 실행 결과를 PASS로 바꾸지 않는다. `--dry-run`이나 test list는 실제 실행 증거가 아니다. `--mode=admit`는 같은 소스의 로컬 보고서를 결합해 게시 준비를 검사하며 로컬 JSON은 인증된 서버 gate가 아니다.

버전·게시 범위·Owner 승인, live main 동기화, 고유 태그 부재를 확인한다. main force push·immutable tag overwrite 금지. GHCR 게시와 운영 배포는 별개다. 운영 복구는 새 revert/교정 commit, 검증된 이전 digest, 호환 DB snapshot을 사용한다. forward-only migration 이후 이미지 교체만으로 DB가 복원되지 않는다.

## 5. Multi-Agent 역할

Main Thread가 Manager이며 필요한 전문 역할만 위임한다. 동일 파일에 Write Agent를 겹치지 않는다. Agent는 승인된 범위·phase·파일만 수행하고 version/Push/GHCR/Issue close를 독자 결정하지 않는다. 실제 모델/effort·독립 실행 증거를 기록하며 설정 파일만으로 실행 PASS를 주장하지 않는다.

```text
Main / Manager → GPT-6.1 Sol / High
researcher     → GPT-6 Luna / Medium
ui_ux          → GPT-6.1 Terra / Medium
frontend       → GPT-6.1 Terra / Medium
backend        → GPT-6.1 Sol / High
scheduler      → GPT-6.1 Sol / High
excel_vba      → GPT-6 Luna / Medium
infra          → GPT-6.1 Sol / High
qa_docs        → GPT-6.1 Sol / High
```

ui_ux는 read-only 설계·구현 비교, frontend는 UI 구현, backend는 API/SQLite/인증, scheduler는 pure 일정 엔진, excel_vba는 승인된 변환, infra는 로컬 build/push/GHCR/운영 증거, qa_docs는 구현자와 분리된 read-only 검토를 담당한다. Manager가 통합·문서·위험 수용과 Owner 최종 결정을 연결한다. 기본값을 조용히 대체하지 않는다. 복잡한 UI/공통 상태·보안 판단은 GPT-6.1 Sol/High로 작업별 승격하고 근거를 기록한다. 세부 모델 선택 이력은 [AGENT_CONFIGURATION](docs/AGENT_CONFIGURATION.md)에 있다.

독립 검토의 실제 실행/신원과 Owner 수용은 [QA_REVIEW_POLICY](docs/QA_REVIEW_POLICY.md)에 기록한다. 자체 검토나 테스트 성공을 독립 QA·Owner ACCEPT로 표시하지 않는다.

## 6. 보고와 완료

결론을 먼저 짧고 평이하게 보고하되 정확한 SHA·digest·수치·범위·미검증/위험·증거를 보존한다. CI/GHCR 운영 관련 사람이 읽는 제목·설명은 한글, 경로/옵션/API 필드·판정 코드와 외부 원문 로그는 원문을 유지한다. 소스/제품 문서는 기존 문체를 따른다.

Issue 기록은 Manager가 PLAN/STATUS/EXCEPTION/DECISION_REQUIRED/RESUME/FINAL로 남긴다. infra의 STATUS/EXCEPTION 쓰기는 Work Packet에 writer/허용 유형이 명시된 경우에만 위임한다. Sub-Agent는 그 외 GitHub 진행 댓글을 직접 쓰지 않고 Result Contract로 반환한다.

최종 보고는 관련 Issue·source SHA·로컬 명령/결과·실패 원장·문서·Push·GHCR exact digest smoke·배포 여부·복원/환경 미검증·실제 Reviewer·Owner 결정·남은 작업을 구분한다. 모든 요청 gate와 FINAL 기록 전 Issue를 닫지 않는다. 원격 실행은 `N/A(Owner 정책상 미사용)`로 기록한다.

## 7. 파일·실행 경로

[REPOSITORY_STRUCTURE](docs/REPOSITORY_STRUCTURE.md)의 `deploy/docker/Dockerfile`, `deploy/compose.yml`, `deploy/docker/container-entrypoint.sh`를 사용한다. 기존 Compose project·SQLite volume·운영 데이터와 루트 도구 진입점을 유지한다.

테스트 설정은 `tests/config/vitest.config.ts`, `tests/config/playwright.config.ts`다. `npm test`, `npm run test:e2e`를 사용한다. 직접 실행은 `npx vitest run --config tests/config/vitest.config.ts`, `npx playwright test --config tests/config/playwright.config.ts`로 지정한다. 기존 Playwright 설정의 E2E 출력은 실행 root의 `.data/playwright.sqlite3`, `.next-e2e`, `test-results/`다. `verify:prepr`의 browser 모드는 clean exact HEAD source snapshot에서 이 설정을 실행하고 원본 source 불변·엄격한 생성 출력 검증을 수행한다([LOCAL_PREPR](docs/LOCAL_PREPR.md)). 기존 운영 URL/DB/서버를 전달하거나 중지하지 않는다.

production HTTPS 기본값과 명시적 `ALLOW_INSECURE_HTTP=true` 내부망 HTTP는 [HTTP_OPERATION](docs/HTTP_OPERATION.md)을 따른다. HTTP에서도 Origin/session/revision 검증을 유지한다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
