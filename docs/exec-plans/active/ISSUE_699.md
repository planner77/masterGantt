# Issue #699 — Local Pre-PR 검증 실행기 Work Packet

- Issue: https://github.com/planner77/masterGantt/issues/699
- Baseline main: `bdaed6bd86612fd168b8ca6b0a40a34966b699d2` (2026-10-16)
- Branch: `ci/issue-699-local-prepr`; version: `0.114.1` 유지 (개발 도구와 문서만 변경)
- Phase: ANALYSIS → PLAN → IMPLEMENTING → LOCAL_VALIDATED(실행 증거 필요) → DOCUMENTATION_SYNC → PR CI
- Owner/roles: Manager 범위·위험·승인 판정, infra 실행기 구현; domain 테스트 영향 매핑; qa_docs read-only는 실제 실행되지 않음
- risk_level: HIGH — 검증/Agent 지침 자체, shared 계약, 데이터/CI source provenance 관리
- qa_method: OWNER_MANAGED, qa_required: true, independent_qa: N/A(Owner-managed; 독립 검토 수행 주장하지 않음), manager_decision: NOT TESTED
- release_required: false, release_authorized: false, Owner 병합 승인: 없음
- Scope: 독립 CLI, Unit 테스트, #697 영향 매핑, 오프라인 실행 증거/진단, docs 및 Agent 연계
- Non-scope: `.github/workflows/ci.yml`, Required Check/6-shard, QA Preflight/Trusted 판정기, product UI/API/DB, #679 Push 억제, main/GHCR/Release 동작

## CI 대 로컬 재현 계약 (ANALYSIS)

| GitHub PR CI (현재 main) | 로컬 재현 | 남는 차이 |
| --- | --- | --- |
| Ubuntu latest / Node 22 / action npm ci --prefer-offline --no-audit | Node 22 확인, 잠금파일·설치 감시, 기존 npm scripts 재사용 | WSL2 Linux/OS/glibc/runner cache와 npm install 일치 불보장; npm ci 파괴적 자동 실행 금지 |
| policy: release version, test discovery, cache, markdown links, Python policy, npm audit | 로컬 안전한 scripts 실행; 네트워크·원격 metadata는 DEFERRED | npm audit의 레지스트리/권한, 기본 브랜치 Trusted API 판정 불가 |
| typecheck/lint/unit/production build | 동일 npm run typecheck/lint/test/build | build는 별도 `.next-prepr` dir, runtime tools 출력 충돌 방지 조건 |
| Playwright 1.63.0 Chromium headless-shell, CI_E2E_FULLY_PARALLEL=true, workers=1, 6 runner/shards | 공식 config, 실제 Chromium, worker1, 이슈 위험 테스트 부분 집합 | 6대 runner resource/scheduling/matrix fail-fast/GitHub artifacts 동일성 불보장 |
| webServer 127.0.0.1:3100, DATABASE_PATH=.data/playwright.sqlite3, NEXT_DIST_DIR=.next-e2e | 기존 자료 및 포트 사용 시 거부, 자기 생성 자원만 정리 | real-app fixture 중 자체 DB/port 사용은 기존 테스트가 관리 |
| Docker Buildx runtime/Compose/transport | Docker 가용 시만 명시적 로컬 build 또는 검사 | GitHub runner Buildx/GHCR/Compose 전체 smoke를 대체하지 않음 |
| QA Preflight, QA Final, Trusted base, 3 Required aggregates | DEFERRED + 이유 명시 | PR metadata/base/test merge/run/attempt, 승인·정확 CI provenance는 GitHub만 판정 |

## 기존 실패 기준선

- #697의 #667/#695 원장상 CI #2811~#2814은 서로 다른 E2E 소비자 실패를 기록했다(영향·분류 상세: `docs/exec-plans/active/ISSUE_697.md`). 2026-10-16 이후 HEAD에 대한 자동 통계로 해석하지 않음.
- First PR CI pass rate, PR당 rerun, runner-minutes, 로컬 false-negative: 비교 가능한 위험도·기간별 완전한 데이터가 확보되지 않아 **NOT TESTED**. 추후 `scripts/analyze-ci-setup-metrics.mjs`와 `scripts/compare-ci-setup-metrics.mjs`, run/attempt 원장을 재사용하며 절감률 예측하지 않는다.

## 구현 및 실패 검증 계획

1. CLI의 fast/targeted/ci-like/diagnose/docker 상태 머신, 버전·Lock·source fingerprint, 사용 중 프로세스/파일 보호 구현.
2. #697 직접·교차·음성 영향 후보 선정과 실제 테스트 파일 확인; 불명확한 공통 계약은 BLOCKED, 수동 include/exclude 사유 기록.
3. Run/attempt와 실패 파일 증거 입력을 검증한 진단 모드. `--retries=0 --max-failures=0`은 로컬 집합에만 사용.
4. pure parser/selection/fingerprint/guards Unit + 실패 주입 테스트, 전체 PR CI와 별도 원격 근거.
5. 기존 `AGENTS.md`, `docs/TEST_PLAN.md`, `docs/ISSUE_LIFECYCLE.md`에 사용·판정 연결. 기본 CI workflow·Required Check 불변.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATE
- `docs/TEST_PLAN.md`: UPDATE (#697 단일 원본 연결)
- `docs/ISSUE_LIFECYCLE.md`: UPDATE
- `docs/REMOTE_VALIDATION.md`: UPDATE (로컬↔원격 차이와 증거 범위)
- `docs/exec-plans/active/ISSUE_699.md`: ADDED
- `docs/LOCAL_PREPR.md`: ADDED (설치·옵션·안전/롤백)
- `docs/CI_CD.md`: N/A (workflow/Required/Release 계약 불변)
- `docs/QA_REVIEW_POLICY.md`: N/A (OWNER_MANAGED/Trusted/Owner 승인 불변)
- `DESIGN.md`, `docs/API.md`, `docs/DB_SCHEMA.md`, `docs/DEPLOYMENT.md`: N/A (제품 UI/API/DB/운영 배포 불변)
- `CHANGELOG.md`: N/A (제품 기능/버전 변경 없는 dev tooling)
- `package.json`: UPDATE (CLI alias), `package-lock.json`: N/A (의존성·버전 변경 없음)
- `.github/workflows/ci.yml`: N/A (현재 PR/MAIN 경로 보존)

## AC_TEST_COVERAGE

- AC1: 실제 CI/로컬/전용 runner 차이표와 과거 이슈 기준선; 추가 통계는 NOT TESTED.
- AC2: fast 각 subprocess 실패·exit nonzero 및 정책의 DEFERRED 경로 테스트.
- AC3: git diff/untracked fingerprint, 변경 감지, 운영 port/기존 db/artefact/dirty 작업 보호 음성 테스트.
- AC4: 실제 Chromium 환경·공식 config·출처 분리; 원격 6-shard 동일성은 불가.
- AC5: LOW 문서, MEDIUM 단일 기능, HIGH 공유 Gantt/HTTP 경로 선택·UNKNOWN blocking.
- AC6: 동일 PR의 다른 실패 2회 입력과 진단 한정 1회/0 retries/0 max failures·증거 분류.
- AC7: JSON/Markdown 보고·caseCount 불확실성·status 분리·AGENTS/Lifecycle 연결.
- AC8: `.github/workflows/ci.yml`·3 Required/Trusted/Owner·Main/GHCR 변경 없음, 새 PR Head remote CI 결과 전 NOT TESTED.
- AC9: WSL2 Ubuntu 로컬 설치·사용·실패 처리·롤백, 비교 가능한 실측 없으면 NOT TESTED.

## 위험 및 인계

- 로컬 환경에 `node_modules`, 설치 Chromium, Docker/git/네트워크 권한이 없으면 검증 BLOCKED/NOT TESTED이며 성공으로 보지 않는다.
- 저장소에 생성한 스크립트의 실제 WSL2/Ubuntu·Chromium/SQLite/port·Docker side effect 실행 결과는 원격 CI와 분리해 기록한다.
- 이번 위임은 PR CI **시작까지만**, 병합/Main CI/GHCR/Finalizer는 금지. PR 이후 Owner 수용·Required 결과 확인 필요.
