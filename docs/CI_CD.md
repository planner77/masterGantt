## Issue #595 — QA Final 재실행의 CI Job provenance (P1)

보호 경로 AGENT PR의 원본 CI 세 aggregate가 완료 성공이고 QA 전용 Job만 독립 승인 미확보로 실패한 뒤, 같은 Run ID로 QA만 재실행할 수 있다. `workflow_run`의 latest attempt에 필수 aggregate가 없어도 `/actions/runs/{id}/attempts/{i}/jobs`를 1..최신으로 조회해 실제 마지막으로 실행된 Job 결론을 선택한다. 최신 attempt에 aggregate가 없으면 과거 같은 Run의 성공을 보존하되 다시 실행된 실패/취소 Job을 이전 성공으로 덮지 않는다. 조회 누락·중복은 BLOCKED, source_attempt를 verdict에 남긴다. 기존 required 3개, checkout 신뢰·GitHub Ruleset·릴리스 승인 경계는 불변이다.

## Issue #595 — QA Final AGENT/보호 파일 원본 Run 검증

`package.json`/lockfile, CI·검증기·보안 정책 등 보호 경로는 계속 HIGH 및 독립 검토가 필수다. main의 신뢰된 QA validator가 `AGENT`에서 수동 승인 영수증을 검증하더라도 세 required aggregate 이름 및 Quality/E2E/Docker 실행·결론·동일 SHA 보존 계약은 불변이다. 원본 Run/Attempt의 required job `completed_at` 이전 Manager ACCEPT는 거부하고, 다른 CI run의 PASS를 재사용하지 않는다. 최초 BLOCKED 후 같은 Run의 실패한 QA job만 독립 QA 완료 후 재실행할 수 있으나, 승인 receipt의 head/base/run/attempt 일치 조건을 통과해야 하며 자동으로 릴리스가 승인되지는 않는다.

## Issue #580 — 실제 서버 서비스 경로 및 TypeScript 선언 입력 보호 (2026-10-10)

- 독립 QA 대체 경로의 최소 위험 분류는 실제 프로젝트 배치인 `src/server/projects/**`, `src/server/templates/**`, `src/server/resources/**`를 포함한 **`src/server/**` 전체를 HIGH**로 취급한다. 보안/세션/영속성 관련 파일에 auth/session 명칭이 없어도 MEDIUM/LOW로 낮출 수 없다.
- `docs_required()`는 실제 `src/server/**` 서비스의 API/계약 영향도 분석에 `docs/API.md`를 포함한다. 다중 영역의 DB_SCHEMA/API/SCHEDULING_ENGINE/IMPORT_EXPORT/TEST_PLAN 문서 합집합과 각 문서의 UPDATED 또는 N/A(reason)를 유지한다.
- CI TypeScript 입력 `next-env.d.ts` 및 모든 root `*.d.ts` ambient declaration은 protected path로 분류하며 rename 원본에도 동일한 차단을 적용한다.
- Python 보안 회귀 2개 추가: `test_real_project_services_are_high_and_require_api_docs`, `test_next_env_declaration_is_protected_even_on_rename`; 기존 required Quality/E2E/Docker, 정책·릴리스 보호는 유지.
- #580 자체는 `HIGH/AGENT` Bootstrap 이슈이며 `QA Final — Automated` SKIPPED는 PASS가 아님. 정확한 Head CI, 독립 QA_FINAL, reviewer thread 해결 및 Manager ACCEPT 이전 병합 불가.

## Issue #580 — 리뷰 후속 P1×2/P2×1: QA 대체 경로 보안·API 문서 검증 (2026-10-10)

- `POLICY_FILES` 단일 TOML 지정보다 넓게 모든 `.codex/**` 경로(특히 `.codex/agents/qa-docs.toml`)의 수정/rename을 보호된 QA 정책 변경으로 분류한다. 인수 기준: `qa_method=AUTOMATED_MANAGER`로 자동 승인 금지, 실제 독립 Reviewer 및 Manager 승인 필수. 회귀: `test_agent_instruction_files_always_protected`.
- `src/server/repositories/**`는 실제 password hash/edit session token 등의 영속성·인증 영향으로 HIGH(추가로 `src/server/services/**`, `src/server/auth/**`, `src/server/db/**`, `src/app/api/**`를 보수적으로 HIGH)로 분류하고 MEDIUM 위험도 다운그레이드를 fail-closed 처리한다. 경로에 auth라는 단어가 없어도 위험도를 낮추지 않는다. 회귀: `test_auth_repository_is_high_even_without_security_filename`, `test_auth_repository_medium_risk_downgrade_blocked`.
- 공개 DTO `src/contracts/**` 및 프로젝트 서비스 계약 변경에는 `docs/API.md` 영향 분석을 요구하며 DB repository의 `docs/DB_SCHEMA.md`와 합집합으로 계산한다. `docs_gate()`의 구조적 PASS는 업무·계약의 의미적 검토 및 독립 QA PASS를 대체하지 않는다. 회귀: `test_shared_public_contract_always_requires_api_documentation`.
- 정식 GHCR/Ruleset/기존 3 required checks 변경 없음; 신규 QA Python 테스트는 기존 `policy` Job에서 실행. 이번 #580은 HIGH bootstrap `qa_method=AGENT`이므로 독립 검토, 최신 Head PR CI, 리뷰 스레드 해결, Manager ACCEPT 전 병합 불가.

## Issue #580: Reviewer P1/P2 후속 — CI 실행 설정·위험도·도메인 문서 영향 강화 (2026-10-10)

- `CI_EXECUTION_GLOBS`로 루트 `postcss.config.*`, `tsconfig*.json`, 그 외 `*.config.*` 및 잠금·CI 실행 설정의 수정/rename을 자동 QA 대체 차단 대상으로 분류. 이미 protected인 `.github/**`, `scripts/**`, `deploy/**`에 추가 적용.
- HIGH 최소 위험도에 `src/contracts/import.ts`, `src/server/imports/**`, `src/server/exports/**`, `db/migrations/**`, Calendar/Scheduler/Dependency/Auth/Release 등을 포함. PR 본문 `risk_level=LOW`로 명시해도 파일 경로가 HIGH이면 BLOCKED. 실제 업무·의미 위험은 Manager가 추가 평가하며 자동 검사로 안전성을 확정하지 않는다.
- `docs_required`는 DB→`docs/DB_SCHEMA.md`, API→`docs/API.md`, Scheduling→`docs/SCHEDULING_ENGINE.md`, Import/Export→`docs/IMPORT_SCHEMA.md`, `docs/IMPORT_EXPORT.md`를 영향 영역별 합집합으로 산출. Work Packet에서 UPDATED(실제 diff) 또는 `N/A(reason)` 증거 요구; 구조 검증이 문서 의미적 정합성 PASS를 뜻하지 않음.
- 회귀: config files 수정/rename, HIGH import/export 위험도 위장 부정, 다중 도메인 문서 합집합/누락 BLOCKED. Python QA 단위 테스트는 PR CI Policy Job에서 실행. PR 자체는 기본 브랜치 trusted validator가 없는 Bootstrap이므로 실제 독립 QA 및 Manager ACCEPT 전 병합 금지.

## #580 — 독립 QA F1–F4 보완 및 Source SHA 검증 (2026-10-10)

- [독립 QA FAIL/REWORK](https://github.com/planner77/masterGantt/pull/587#issuecomment-6091333221) 후 보완: (F1) `.github/actions/**`, `scripts/**`, `deploy/**`, `tests/config/**` 및 CI 실행 설정 파일의 수정·rename을 AUTO QA에서 차단 (F2) trusted workflow는 event `github.sha`에 고정 checkout하고 실제 checkout `git rev-parse HEAD` 동등성 검사 및 `validator_sha` JSON 원장 기록 (F3) `policy` PR CI에서 Python QA unittest를 **실제로 실행**, LOW/MEDIUM/HIGH 및 HIGH Manager 위험 수용 누락, protected edit, metadata HEAD/base 회귀 보존 (F4) 현재 역할/소유권 표에 AGENT/AUTOMATED_MANAGER 기준 적용.
- bootstrap의 `qa_bootstrap=success`는 Trusted QA를 실행하지 않았다는 의미를 보존하며 자동 QA PASS가 아니다. 신규 Trusted workflow가 main에 반영된 뒤에만 default-branch 검증이 가능하다. 이 Workflow Run은 기본 브랜치에 연결되므로 PR Head Ruleset required check로 자동 강제됐다고 보고하지 않는다. 독립 QA는 해당 검토자의 새 SHA 증거 필수, Manager ACCEPT는 별도.
- SHA 변경 이후 기존 CI #2358.1와 독립 FAIL은 새 SHA의 PASS 근거가 아니다. 정책의 관리자 승인을 임의로 생략하거나 기존 3개 required checks/main/GHCR를 약화하지 않는다.


### Issue #580 · Review P1/P2 후속: protected main QA 신뢰 경계

- **신뢰 출처:** `.github/workflows/qa-final-trusted.yml`은 기본 브랜치에서 `workflow_run(CI completed)`를 수신하고, `main`의 검증 스크립트로 원본 CI Run ID/Attempt·Head/base·필수 세 Check·리뷰·문서/AC를 재조회한다. `pull_request` Workflow의 `QA Final — Automated`는 **참고용**이며 PR 작성자가 workflow를 바꿀 수 있기 때문에 신뢰된 병합 승인 근거가 아니다.
- **API 검증:** 변경 파일의 `filename` 및 rename `previous_filename` 모두를 보호 목록/보안 정책 목록과 비교한다. 보안/QA/CI 정책 또는 실행 지침 자체를 변경하는 PR은 자동 PASS가 아니라 독립 Reviewer 필요. PR `edited`는 같은 Head라도 이전 성공한 **동일 base SHA**의 full-run 3개 gate 증거가 있어야 한다. 성공 보고서에는 `decision_reason`을 반드시 남긴다.
- **Bootstrap·Required:** #580 PR은 아직 base에 trusted workflow가 없으므로 신뢰 검증 **NOT TESTED**. 독립 `qa_docs`/승인된 별도 인간 Reviewer의 exact-head QA Final 및 Manager ACCEPT 없이는 MERGE_READY가 아니다. `workflow_run`의 Status는 **기본 브랜치 SHA**에 붙으며 자동으로 PR Head의 Ruleset required check가 되지 않는다. 관리자 승인, 예상 source/검증 방식 확인 전 자동 차단 기능을 주장하거나 신규 Required Check를 추가하지 않는다.
- **권한:** trusted workflow 자체는 `contents/actions/pull-requests/issues: read`만 사용, PR 코드 checkout/명령 실행, PAT/추가 Secret, `pull_request_target` 없음. GHCR/릴리스/기존 세 Required Gate 불변. 인증되지 않은 워크플로 이름만으로 Merge Gate를 자동 강제했다고 보고하지 않는다.
- **적용:** 신규 정책은 #580 PR이 적법한 독립 검토·승인 뒤 main에 병합된 이후에만 적용한다. 자동 QA가 구현됐다 하더라도 실제 main Trusted Run을 확인하기 전까지 `AUTOMATED_MANAGER`를 사용할 수 없다.

### 2026-10-10 — Issue #580 Bootstrap Gate 실패 보완

- [PR #587 · 최초 CI #2334.1](https://github.com/planner77/masterGantt/actions/runs/37998967929): 기존 Quality, E2E 6/6, Docker 필수 aggregate **PASS**, 신설 `QA Final — Automated`만 최초 검증기 부재에 의한 명시적 `exit 1`으로 FAIL.
- 최초 도입 시 `qa_bootstrap`에서 정확한 PR `base.sha`(신뢰된 main)의 검증기 존재를 확인한다. 없으면 `present=false`, 단계 요약 `QA Final — Automated: NOT TESTED (bootstrap)`, 실제 자동 QA Job은 **SKIPPED**로 남겨 허위 PASS를 방지한다. `qa_bootstrap=success`는 **독립 QA/QA_FINAL PASS가 아니다**.
- 실제 자동 QA Job은 신뢰된 base validator가 존재할 때만 수행한다. 다른 정상 PR에서는 기존 3개 필수 CI와 실증 결과를 재사용하며 각 실패/중단/누락을 FAIL/BLOCKED로 판정한다.
- 이 특별 단계는 최초 정책/Workflow/QA 검증기 변경 PR에만 적용되는 임시 부트스트랩 운영 경계다. #580 최초 PR은 HIGH이므로 별도 독립 reviewer의 실제 결과 및 Head별 Manager ACCEPT 없이는 `MERGE_READY=BLOCKED`. **신설 QA Check의 Ruleset Required 등록은 최초 도입/검증 완료 후 관리자 승인과 실효성 검증 전까지 금지.**
- 메타데이터 편집 검증, 본문 변경, 뒤따르는 Head/base 변동, Ruleset 정책 적용·롤백은 별도 원격 검증이 필요하다. 현재 PR CI 시작은 결과 PASS/Manager 승인/병합이 아니다.

## Issue #580 — Actions QA Final 대체 Gate (2026-10-10)

- `qa_method=AGENT`: 실제 독립 `qa_docs`/별도 인간 Reviewer의 exact-HEAD 검토 증거가 있어야 한다. CI 성공으로 독립 QA PASS를 주장하지 않는다.
- `qa_method=AUTOMATED_MANAGER`: 기본 브랜치의 실제 `QA Final — Trusted` 검증이 PASS하고 PR의 세 필수 CI도 완료된 후에도 Head별 `Manager ACCEPT`와 위험도별 수동/업무 검토를 분리해 기록한다. 독립 QA는 `N/A(대체 경로)`다.
- LOW/MEDIUM/HIGH 및 기존 세 required checks, DOC_SYNC, 미해결 리뷰 해결, latest HEAD, main CI/GHCR/release gate는 유지한다. HIGH는 scope별 수동 검토·잔여 위험 명시적 수용이 필요하다.
- `.github/workflows/ci.yml` / 검증기/보안 정책 자체가 변경되는 PR은 **trusted base validator가 자동 PASS하지 않으며**, 별도 독립 검토와 Manager 승인 필요. 최초 #580 bootstrap PR 역시 자동 PASS를 주장할 수 없다.
- 현재 GitHub Ruleset Required Check에는 이 신규 Job이 자동 추가되지 않는다. 관리자 승인·설정·expected source 검증 전에는 **운영상 수동 Gate**다. GitHub review count=0도 Manager ACCEPT를 강제하지 않는다.
- 관리자 승인 후 Ruleset을 설정하기 전, 최근 PR에서 QA Job 안정적 표시/성공·실패, expected source, path skip, 재검증/롤백을 확인한다. rollback 시 신규 required check만 사전 승인 후 제거하고 기존 세 check는 유지한다.
- `AUTOMATED_MANAGER` 경로의 자동 판정은 문서 구조·AC 맵·review 상태만 검사한다. 의미적 요구사항/UX/보안 적합성은 Manager 수동 확인 사항이다. 결과 계약: `issue/pr/qa_method/risk_level/rule_version/pr_head_sha/base_or_test_merge_sha/workflow_run_id/run_attempt/quality_evidence/e2e_evidence/docker_evidence/documentation_sync/ac_test_coverage/unresolved_review/automated_qa/independent_qa/manager_decision/residual_risks/decision_reason`.
- 계획·PR에는 `qa_method`, `risk_level`, 선택 이유, Head SHA, document impact, 각 AC의 test mapping, 잔여 위험을 필수로 기록한다. Manager ACCEPT 댓글은 승인 주체, 일시, 정확한 SHA, 범위, 미검증/위험수용을 담는다.
- `AGENT` 경로와 `AUTOMATED_MANAGER` 선택은 독립 QA 실제 실행 유무에 기반한다. 차후 Head가 변경되면 기존 CI·QA·Manager ACCEPT 판정은 stale.
- 이 정책은 #580 구현 PR이 병합되기 전에는 현행 #565 독립 QA 요구를 완화하지 않는다.

# CI/CD

## Issue #565 — 위험도 기반 QA는 CI Gate와 별도 운영 계약

[QA_REVIEW_POLICY.md](QA_REVIEW_POLICY.md)의 LOW/MEDIUM/HIGH 정책에 따라 PR `QA_FINAL`에 독립 Reviewer PASS가 필요한지, 명시적인 `N/A(reason)`가 가능한지를 Manager가 판단한다. **독립 QA N/A는 CI Required Check N/A가 아니다.** 각 PR의 최신 Head에 기존 `Build, static checks, and unit tests` / `Chromium end-to-end tests` / `Docker build and runtime smoke test` aggregate 결과를 모두 확인하며 해당 실행에서 세부 shard가 SKIPPED면 실행 PASS로 과대 표시하지 않는다. GitHub Ruleset 승인 리뷰 수 0과 Manager ACCEPT도 서로 다르다.

이슈 #565는 Workflow/Ruleset/Tag/GHCR 동작을 변경하지 않는다. GitHub Actions 기반 자동 QA 대체 Check/대상 Head·필수 검증 강화는 별도 #580에서 설계·검증한다. 정책 문서만 변경한 PR이 실제 Actions 검증을 시작했다는 사실과 결과 PASS는 분리 보고한다.


## Issue #361 CI/CD 실행 인스턴스 추적 표준

GitHub Actions의 workflow 고정 식별자 `name`과 required job/check 이름은 유지하고, Actions 목록에서 사람이 보는 실행 인스턴스 `run-name`만 trace metadata로 확장한다.

- PR CI는 PR 제목, PR 번호, `github.run_number`와 `github.run_attempt`를 표시한다. PR 제목에는 Primary Issue가 `Issue #NNN` 또는 `(#NNN)` 형식으로 포함되어야 한다.
- PR CI의 첫 lightweight gate인 `scripts/verify-ci-run-trace.py`는 PR 본문의 canonical `Refs #NNN` 1개, head branch의 `issue-NNN`, PR 제목의 Issue가 같은 Primary Issue **하나만** 가리키는지 확인한다. `pull_request`의 `edited` 이벤트도 구독하여 title/body 수정 뒤 같은 head SHA라도 다시 검증한다. PR title/body/branch 문자열을 inline shell로 재평가하지 않고 GitHub event JSON을 데이터로 읽는다.
- Dependabot은 Issue 기반 human workflow의 예외다. PR 작성자가 `dependabot[bot]`이고 동일 저장소의 `dependabot/` branch인 경우에만 trusted automation 경로로 통과시키며, 일반 사용자가 이름만 모방한 branch는 예외로 인정하지 않는다.
- Main CI는 `push` 이벤트에 PR payload가 없으므로 merge commit message를 표시명에 포함한다. 저장소의 merge commit은 PR 번호와 head branch, PR 제목을 보존하므로 PR 단계에서 확정한 Primary Issue trace를 계승한다. 비-PR main push는 commit-message fallback으로 표시한다.
- 수동 CI는 선택적 `issue_number` input을 받아 관련 작업이면 `Issue #NNN`을 표시하고, 진단성 실행은 Issue 없이 명시적 fallback 이름을 사용한다.
- `Issue lifecycle`은 기존 `issue_number`, `pr_number`, `operation` input을 직접 표시한다.
- Generic Release Finalizer는 triggering `workflow_run.display_title`을 계승하여 Main CI의 Issue/PR trace를 보존하고 자체 `run_number.run_attempt`를 추가한다.
- 정식 GHCR release를 lifecycle에서 dispatch할 때 `inputs[issue_number]`, `inputs[pr_number]`을 REST `inputs` 객체로 전달한다. tag push 또는 trace input 없는 수동 release는 tag/version 기반 fallback 이름을 사용한다.
- 재실행은 `run_number`가 동일하고 `run_attempt`만 증가하므로 `Run #N.1`, `Run #N.2`로 구분한다.
- Generic Finalizer가 PR required checks를 검증할 때 같은 head SHA의 이전 attempt와 최신 재실행 check-run이 함께 반환될 수 있다. required check 이름별로 GitHub Actions check-run의 **가장 큰 check-run ID** 하나만 최신 결과로 채택한다. 최신 결과가 SUCCESS일 때만 PASS하며, 최신 failure/cancelled/pending을 오래된 성공으로 우회하지 않는다.

이 변경은 observability/운영 metadata만 변경한다. 기존 `CI` workflow name, required check 세 항목, trigger, 권한, exact merge SHA gate, concurrency, release authorization, GHCR digest 검증은 변경하지 않는다.

## Issue #356 CI 실행시간 1차 최적화

2026-09-30 실행시간 분석에서 PR CI의 critical path는 Chromium E2E였고, Docker smoke에는 일반 기능 PR에서 매번 반복할 필요가 없는 관찰용 baseline image build와 transport browser smoke가 포함되어 있었다.

- `docker_smoke` 자체는 기존 `docker` 변경 분류를 유지하여 candidate image build, image policy, production 설정 fail-fast, migration/readiness, SQLite restart persistence, Compose smoke를 계속 수행한다.
- PR의 **baseline image 비교**는 `deploy/docker/**`, `.dockerignore`, `next.config.*`, standalone runtime/image-policy/size 검증 script 또는 CI workflow/action이 바뀔 때만 실행한다. Issue #283의 non-standalone → standalone 25% 감소 hard gate는 이미 완료되었고 후속 baseline 비교는 관찰용이므로, 일반 기능·버전 변경에서 이중 Docker build를 반복하지 않는다.
- PR의 **HTTP/HTTPS transport smoke**는 deploy, transport test/script, security/http server, 인증·Origin/cookie 계약과 연결된 API 또는 CI workflow/action 변경에서만 실행한다. `main` push와 수동 `workflow_dispatch`는 항상 transport smoke를 수행해 release 전 운영 경로 검증을 축소하지 않는다.
- `Issue #118 구현 전후 레이아웃 증거` workflow는 고정 baseline/after revision을 비교하는 완료된 one-time evidence이므로 자동 PR trigger를 제거하고 수동 `workflow_dispatch` 재현만 남긴다.
- Required aggregate check 이름과 fail-closed routing은 변경하지 않는다. 선택 step이 생략되어도 Docker aggregate는 candidate/runtime 필수 검증 결과를 기준으로 판정한다.
- GitHub-hosted runner의 Playwright OS dependency 설치가 Ubuntu mirror 지연으로 늘어나는 경우를 고려해 PR/Main 및 Release Chromium shard timeout은 35분으로 둔다. #487 PR #488 Run #2089.1에서는 정상 진행 중인 shard 4/6이 25분 job 제한으로 취소됐고, #2094.1에서는 6개 E2E shard가 모두 PASS했다. `.github/actions/playwright-setup/action.yml`은 OS dependency 설치 시도마다 6분 제한을 두고 실패 시 Azure Ubuntu 미러가 설정된 환경에서만 공식 Ubuntu archive로 1회 재시도한다. Ubuntu 24.04 runner의 `ubuntu.sources`가 `mirror+file:/etc/apt/apt-mirrors.txt`를 참조하는 경우에는 실제 Azure URL이 들어 있는 `/etc/apt/apt-mirrors.txt`도 검사·치환한다(#487 PR CI #2191.1의 shard 2/5 fallback 탐지 누락 보완). 두 번 모두 실패하면 실패로 판정하며 실행을 우회하지 않는다. Docker smoke job은 build/runtime/transport/Compose를 유지하며 40분을 허용한다. 동일 공용 Playwright setup을 사용하는 Main 임시 GHCR candidate `publish-commit-image`는 image build/push·exact digest pull·transport smoke를 모두 포함하므로 50분, Release `container` 후보 검증은 candidate pull·transport/runtime/persistence 검사에 40분을 허용한다. #487 PR #488 최신 Codex P1 리뷰는 Playwright OS deps 재시도 최악 약 12분 20초를 두 추가 호출자의 budget에 반영하도록 요구했다. 추가 timeout은 required checks와 이미지/digest/security/smoke 검사를 생략하거나 완화하지 않는다. 이는 외부 setup 지연을 흡수하는 안정성 여유이며, 6-way shard와 `workers: 1`, 기존 assertion 및 required aggregate 계약은 유지한다.
- Phase 2는 process/DB 격리를 유지한 prebuilt E2E runtime과 historical timing 기반 shard 균형화를 별도 검증한다. Phase 3는 exact main CI evidence를 release에서 재사용할 수 있는지 별도 검증한다.

## Issue #283 Docker runtime 슬림화 검증

Docker PR gate는 Next.js standalone 전환의 기능 회귀와 실제 image 감소를 함께 검증한다.

- candidate는 기존 `docker/build-push-action` 경로로 build하고 `scripts/verify-image-policy.sh`가 non-root, secret/data 부재와 함께 `server.js`, static asset, compiled startup 도구, migration 존재 및 전체 `src`/`.next/cache`/`tsx` 부재를 검사한다.
- PR에서 `github.event.pull_request.base.sha`를 detached worktree로 준비해 동일 Dockerfile 경로로 baseline image를 별도 build한다.
- **Issue #283의 non-standalone → standalone 전환에 한해서만** `scripts/verify-image-size-reduction.sh`가 `docker image inspect .Size` 기준 최소 25% 감소를 hard gate로 사용한다. 이미 standalone인 base를 대상으로 한 후속 일반 PR에는 추가 25% 감소를 요구하지 않는다.
- 후속 PR에서도 baseline/candidate size 비교는 관찰용 summary로 남기며, 주요 runtime directory footprint 및 상위 layer를 함께 기록한다.
- 기존 invalid production config fail-fast, migration/readiness, `better-sqlite3` native write/restart persistence, HTTP/HTTPS transport, Compose recreate persistence 검증은 삭제하거나 완화하지 않는다.
- main push에서는 baseline 비교를 반복하지 않지만 candidate image의 기존 runtime gate와 임시 GHCR exact-digest 검증/SBOM/provenance/cleanup 계약을 그대로 유지한다.

이 측정은 Docker daemon의 uncompressed image size 기준이며 GHCR compressed transfer size와 동일하지 않다. 크기 목표를 맞추기 위해 보안·runtime smoke 또는 supply-chain gate를 생략하지 않는다.

## Issue #157 Compose pull/build 경로 검증

- 운영 `deploy/compose.yml`은 `build:`가 없는 image-only 구성이고 `pull_policy: always`를 사용한다.
- local/CI source build는 `deploy/compose.build.yml` override에서만 `build:`를 추가하며 `pull_policy: never`를 사용한다.
- `scripts/verify-compose-smoke.sh`는 production Compose config와 build override merged config를 각각 검사한 뒤, build override로 만든 격리 image를 `--pull never --no-build` runtime smoke에 사용한다.
- 기존 named volume persistence, startup migration/readiness, Resource 관리자 인증 및 secret 비노출 검증은 그대로 유지한다.
- 운영 rolling tag 배포는 `--pull always --no-build --force-recreate`를 사용하고, exact SemVer 또는 verified digest를 우선한다.
- `docker compose config` 전체 출력에는 치환된 secret이 포함될 수 있으므로 CI/Issue 증거에는 secret을 기록하지 않는다.

 Commit Test Image와 Semantic Container Release

> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


상태: W20/W22 Semantic Release와 Main Commit Image Automation은 **독립 QA PASS / Manager ACCEPT**다. Main/PR와 `v0.4.0` release Actions, private GHCR publish, commit/release digest의 원격·로컬 smoke 및 SBOM/provenance 조회를 완료했다. D05에 따라 현재 요금제의 branch/tag ruleset 미강제 위험을 수용하고 GitHub Artifact Attestation은 비활성으로 두며 BuildKit SBOM/provenance를 필수로 유지한다.

이 문서는 GitHub Actions, 애플리케이션 버전, GHCR container image의 Source of Truth다. Docker runtime과 운영 persistence는 [DEPLOYMENT.md](DEPLOYMENT.md), 검증 분류는 [TEST_PLAN.md](TEST_PLAN.md), 자격증명 정책은 [SECURITY.md](SECURITY.md)를 함께 따른다.

## 1. 자동화 범위

GitHub Actions로 다음 반복 작업을 대체한다.

- Pull Request와 `main` push: frozen `npm ci`, version manifest 검사, typecheck, lint, 루트/외부 cwd의 테스트 발견 검사, Vitest, production build
- Chromium E2E: Playwright browser/dependency 설치 후 worker 1로 전체 실행
- Container CI: clean Docker build, non-root runtime, migration/readiness, native SQLite, 임시 volume 재시작 persistence smoke
- Dependency audit: production npm dependency 취약점 검사
- Main commit registry smoke: 위 gate를 모두 통과한 **비문서** `main` push만 임시 `ci-<full SHA>`를 GHCR에 게시하고 exact digest를 pull하여 HTTP Project/Task authorization·저장·재시작 persistence를 검증한 뒤 package version 삭제. `docs/**` 또는 저장소 루트 Markdown만 변경된 docs-only main push는 publish job을 SKIPPED
- Semantic release: 승인된 version tag에서 release-configured candidate를 먼저 runtime smoke한 뒤에만 GHCR build/push, SBOM/provenance, registry digest 재다운로드와 smoke test

Actions는 실제 운영 CPU/storage, reverse proxy/TLS, off-host backup/restore, Windows Excel/VBA/DRM 환경과 수동 UX 검증을 대신하지 않는다.

### 필수 테스트 발견 gate (#13)

`.github/workflows/ci.yml`의 `quality` job은 `npm ci` → version → typecheck → lint 다음, `npm test` 전에 `node scripts/verify-test-discovery.mjs`를 실행한다. PR/main/manual CI 모두 같은 순서를 따른다. 이 gate는 단위 테스트 실행이나 Chromium E2E 자체를 대체하지 않는다. Semantic release workflow의 별도 검증 순서는 해당 workflow를 따르며 이 문구가 release에 새 step을 추가했다는 의미는 아니다.

스크립트는 설치된 Vitest와 Playwright CLI를 각각 저장소 루트와 저장소 밖 임시 디렉터리에서 실행하고, 절대 경로로 지정한 `tests/config/vitest.config.ts`와 `tests/config/playwright.config.ts`가 같은 전체 테스트를 발견하는지 확인한다. Vitest 목록은 호출 위치 기준 경로를 정규화·정렬한 뒤 실제 `.test.ts` 파일 목록과 비교하여 누락·추가·중복을 거부한다. Playwright는 전체 목록의 일치와 각 E2E spec 포함 여부, 10개 이상 테스트를 확인한다. 단위 파일 28개 이상은 기존 기준의 최소 안전장치이며, 새 테스트를 제거할 수 있다는 의미가 아니다. 테스트 0개, 설정 로딩 실패, CLI 비정상 종료 또는 발견 범위 불일치는 CI 실패다.

현재 package에는 `type: module`이 없고 Playwright는 `.ts` 설정을 CommonJS로 읽는다. 따라서 이 설정의 저장소 경로는 `resolve(__dirname, "../..")`으로 구한다. Vitest 설정의 `import.meta.url`과 기계적으로 통일하거나, root package 모듈 모드를 바꾸어 오류를 우회하지 않는다. 파일 기반 경로 계산을 유지하면서 실제 CLI로 로딩해야 한다. 타입 검사 PASS만으로 이 gate를 생략하지 않는다. 상세 경로와 편집기 사용은 [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md)를 따른다.

실패 시 해당 head SHA/run/job/최초 오류를 기록하고 설정 또는 검증 로직을 수정한 **새 commit**으로 전체 CI를 실행한다. 실패 gate를 삭제·skip하거나 `passWithNoTests`로 통과시키지 않는다. 추가 코드 변경 없는 재실행은 transient 원인일 때만 별도 근거를 남기며, 과거 실패 기록은 유지한다.

## 2. Semantic Versioning 계약

애플리케이션 버전의 Source of Truth는 root `package.json`의 `version`이다. `package-lock.json`의 top-level과 root package version도 항상 같아야 한다.

지원 형식은 Semantic Versioning 2.0.0의 `MAJOR.MINOR.PATCH`와 optional prerelease다. Container tag 호환성과 하나의 canonical 표현을 위해 build metadata(`+metadata`)는 사용하지 않는다.

- MAJOR: 호환되지 않는 public API, import/export schema 또는 운영 계약 변경
- MINOR: 하위 호환 기능 추가
- PATCH: 하위 호환 버그·보안·문서/운영 수정
- Prerelease: `0.5.0-rc.1`처럼 정식 공개 전 검증 이미지

`0.x`에서도 사용자 workflow나 저장/API 계약을 확장하면 MINOR를 올리고, 기존 계약 내 수정은 PATCH를 올린다. 버전은 낮추거나 재사용하지 않는다. Release workflow는 full Git tag history의 유효한 이전 SemVer를 비교하고 새 version이 모두보다 클 때만 진행한다.

Release authority는 package version과 정확히 일치하는 annotated Git tag `vMAJOR.MINOR.PATCH[-PRERELEASE]`다. CI가 임의로 version commit이나 tag를 만들지 않는다. Tag push 전에 필수 CI 통과와 지정 release authority를 확인하며, GitHub의 필수 승인 review 수는 0명이다. Tag 이동·삭제·동일 version 재발행은 금지한다.

## 3. Container image 계약

기본 image 이름은 GitHub repository 이름을 lowercase로 정규화한 다음 경로다.

```text
ghcr.io/<owner>/<repository>
```

성공한 `main` push 중 docs-only가 아닌 변경의 registry 검증 image는 다음 임시 tag 하나를 게시한다. docs-only는 `before..head`의 모든 변경 파일이 `docs/**` 또는 저장소 루트 Markdown인 경우이며, 빈 diff·기준 판정 불가·비문서 파일 혼합은 docs-only로 보지 않는다.

```text
ci-<40-character-commit>
```

같은 tag가 이미 존재하면 덮어쓰지 않고 실패한다. Exact digest pull/runtime 검증이 끝나면 해당 `ci-<commit>` package version을 삭제한다. Commit workflow는 SemVer exact/major/minor/latest tag를 만들지 않는다. PR과 수동 `workflow_dispatch`는 검증만 수행하고 registry에 로그인하거나 쓰지 않는다.

안정 버전 `v1.4.2`는 다음 tag를 게시한다.

```text
1.4.2
1.4
1
latest
```

Prerelease `v1.5.0-rc.1`은 mutable stable alias를 변경하지 않는다.

```text
1.5.0-rc.1
```

운영과 자동 테스트 입력은 `latest`, major 또는 minor alias를 사용하지 않는다. Commit 테스트는 workflow가 출력한 `ci-<full SHA>`의 exact digest를, release 테스트·배포는 정확한 version 또는 release output digest를 사용한다.

```sh
docker pull ghcr.io/<owner>/<repository>:1.4.2
docker pull ghcr.io/<owner>/<repository>@sha256:<digest>
```

Main commit workflow는 먼저 변경 유형과 application version 변경 여부를 판정한다. quality, Chromium E2E와 local container smoke는 docs-only 여부와 무관하게 실행하며, docs-only가 아닌 경우에만 별도 publish job을 실행한다. `ci-<full SHA>`를 push한 후 tag가 아니라 build output의 digest로 다시 pull하고 image content policy, migration/readiness, Project 생성과 edit session, root Task 저장, unauthorized mutation 거부, container restart 뒤 Project/Task 재조회를 검증한다. **version이 변경되지 않은 main merge와 실패 run의 `ci-*`는 기존처럼 정리**한다. 반면 first-parent 대비 package version이 변경된 merge는 정식 release가 같은 binary/config digest를 재사용할 수 있도록 검증 성공한 `ci-<full SHA>`를 release candidate/provenance alias로 보존한다.

Release workflow의 `Release quality gates`는 PR CI와 달리 Chromium 전체 E2E를 단일 job에서 실행하므로 dependency/browser 설치 시간을 포함해 60분 timeout을 사용한다. 테스트 단계가 모두 성공했더라도 job-level timeout으로 최종 상태가 CANCELLED가 되면 정식 release evidence로 인정하지 않는다.

Release workflow는 전체 application/E2E gate 뒤 **annotated tag가 가리키는 exact commit SHA의 Main verified `ci-<SHA>` candidate를 registry에서 찾고**, candidate의 digest와 OCI `source`/`revision`/`version` label이 tag target/package version과 정확히 일치하는지 검증한다. Release 단계에서는 Docker image를 다시 build하지 않는다. Main에서 이미 검증한 exact digest를 candidate runtime/transport/persistence로 재검증한 뒤 Docker `imagetools create`의 single-source carbon-copy promotion을 사용해 같은 digest를 exact SemVer tag로 승격한다. 승격 전후 digest가 달라지면 실패하며, exact digest runtime smoke와 활성화된 GitHub Attestation이 성공한 뒤에만 stable rolling alias를 같은 digest로 이동한다. Release candidate의 `ci-<SHA>` alias는 exact SemVer와 같은 package version/digest를 공유할 수 있으므로 개별 tag 삭제로 manifest 전체를 손상시키지 않기 위해 provenance alias로 유지한다.

모든 version release는 repository 단위 concurrency group에서 직렬 실행한다. Monotonic SemVer gate와 결합하여 늦게 끝난 낮은 version이 `latest`/major/minor alias를 되돌리는 것을 막는다. Exact version tag가 이미 있으면 overwrite하지 않는다.

초기 publish platform은 `linux/amd64`다. `linux/arm64`는 W16에서 해당 architecture의 `better-sqlite3` build/runtime smoke를 통과한 후 manifest에 추가한다.

## 4. Workflow와 권한

| Workflow | Trigger | 권한 | 역할 |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` 검증 jobs | PR, `main` push, manual | `contents: read` | application·browser·container 회귀 |
| `.github/workflows/ci.yml` commit publish job | 성공한 비문서 `main` push만; docs-only는 SKIPPED | `contents: read`, `packages: write`; docs-only에서는 job 자체가 시작되지 않아 write 권한을 사용하지 않음 | `ci-<full SHA>` publish/digest smoke; 일반 merge는 cleanup, version-changing merge는 verified release candidate로 보존 |
| `.github/workflows/release-image.yml` | strict `v*` tag push 또는 annotated `v*` tag ref의 수동 실행 | candidate 검증은 `packages: read`, promotion/attestation은 `packages: write` 및 optional OIDC | tag target SHA의 Main verified `ci-<SHA>` exact digest 재검증 → exact SemVer/rolling alias로 동일 digest promotion → registry smoke |
| `.github/workflows/ci.yml` branch cleanup policy check | PR, `main` push, manual | `contents: read` | `scripts/verify-safe-branch-cleanup.py`로 완료 Issue helper 재도입과 직접 branch deletion 우회를 차단하고 공통 fail-closed 계약을 회귀 검증 |

- PR과 수동 CI에는 registry credential 또는 write token을 제공하지 않는다.
- `pull_request_target`에서 repository code를 build/test하지 않는다.
- 같은 repository의 GHCR publish는 개인 PAT 대신 job-scoped `GITHUB_TOKEN`을 사용한다.
- GitHub/Docker Actions는 mutable major tag가 아니라 full commit SHA로 고정한다.
- Base image도 digest로 고정하며 Dependabot의 reviewed PR로만 갱신한다.
- Secret은 Docker build arg, OCI label, cache, artifact, log에 전달하지 않는다.
- Commit과 release image는 BuildKit SBOM/provenance를 항상 생성한다. GitHub Artifact Attestation은 private repository에서 Enterprise Cloud가 필요하므로 `ENABLE_GITHUB_ATTESTATIONS=true`인 지원 환경에서만 step을 실행하고, 미지원 상태를 성공 attestation으로 기록하지 않는다. 현재 workflow는 optional step을 같은 publish job에 두어 attestation/OIDC 권한 자체는 flag가 꺼진 run에도 선언된다. 권한까지 조건부로 축소하려면 별도 gated attestation job으로 분리하고 publish/promotion 순서를 다시 검증해야 한다.

공식 근거: [GitHub Docker image publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [GitHub workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations), [Docker test before push](https://docs.docker.com/build/ci/github-actions/test-before-push/), [Docker metadata SemVer tags](https://github.com/docker/metadata-action), [Semantic Versioning 2.0.0](https://semver.org/).

## 5. Release 절차

1. 변경의 호환성에 따라 MAJOR/MINOR/PATCH 또는 prerelease를 결정한다.
2. `package.json`, `package-lock.json`, `CHANGELOG.md`를 같은 commit에서 갱신한다.
3. `npm run version:check`와 전체 CI를 통과시킨다.
4. `main` merge 뒤 동일 commit에 annotated `v<package version>` tag를 만든다.
5. Tag를 원격에 push한다. Release workflow는 annotated tag target SHA와 동일한 Main verified `ci-<SHA>` candidate가 존재하고 source/revision/version/digest 계약을 통과해야만 promotion을 수행한다. 수동 GHCR push나 release 재-build는 하지 않는다.
6. Main candidate digest와 exact SemVer tag digest가 동일한지, exact digest runtime smoke와 활성화한 GitHub Attestation 뒤 stable rolling alias가 같은 digest를 가리키는지 workflow summary에서 확인한다.
7. GHCR package visibility와 consumer `packages: read` 권한을 확인하고 exact version/digest로 테스트한다.

연결된 운영 도구가 `GITHUB_TOKEN`으로 annotated tag를 생성해 tag push가 후속 workflow를 자동 재귀 실행하지 않는 경우에는, 해당 **annotated `v*` tag ref**를 지정해 `workflow_dispatch`로 같은 release workflow를 실행할 수 있다. 이 경로도 package/tag 일치, 이전 SemVer보다 큰 버전, annotated tag 여부와 immutable image 충돌 검사를 우회하지 않는다.

Tag/package 불일치, 이전 tag 이하 version, lightweight tag, 기존 exact image, CI 실패, candidate/publish/promotion 실패 또는 registry digest smoke 실패는 release 실패다. 실패한 exact/commit version을 덮어쓰지 않고 원인을 수정한 다음 새 commit의 PATCH/prerelease version을 사용한다.

### Main commit image 소비 절차

1. `main` push의 quality, E2E, container와 publish job이 모두 성공했는지 확인한다.
2. Workflow summary의 `ci-<full SHA>`와 `sha256:<digest>`가 대상 commit과 일치하는지 확인한다.
3. Private GHCR consumer는 필요한 범위의 `packages: read` credential로 로그인한다.
4. tag를 배포 기준으로 재해석하지 말고 summary의 exact digest를 pull해 격리 volume에서 테스트한다.
5. release가 필요하면 별도 SemVer bump·CHANGELOG·annotated tag 절차를 수행한다. version-changing merge의 verified `ci-<SHA>`는 formal release가 exact digest를 재사용하는 candidate/provenance alias이며, 임의 수동 retag는 하지 않는다.

## 6. Repository 설정 Gate

Workflow 파일만으로 다음 GitHub 설정을 강제할 수 없으므로 Repository owner가 확인한다.

- Actions 사용 허용과 workflow `GITHUB_TOKEN` package write 정책
- `main` branch required checks 및 review 정책
- `v*` tag 생성/삭제/force-update 제한 ruleset과 release 승인자
- GHCR package와 repository 연결
- Package visibility(public/private) 및 다른 repository/runner의 pull 권한
- Artifact/attestation retention과 조직 정책

2026-09-12 D04 정책 결정은 다음과 같다.

- GHCR package는 private으로 유지한다.
- downstream consumer에는 필요한 대상에만 최소 `packages: read`를 부여한다.
- `main`은 필수 CI를 통과해야 하며 Pull Request 흐름은 유지하되 필수 승인 review 수는 0명이다.
- `refs/tags/v*` update/delete/force-update를 금지하고 지정 maintainer만 release authority를 가진다.
- package-repository linkage와 SBOM/provenance/attestation 보존을 활성화하고 최초 publish 뒤 실제 설정을 재검증한다.

사용자 승인 범위의 in-memory helper를 통해 기존 repository credential의 admin 인증이 성공했고 `planner77/masterGantt`가 private임을 확인했다. Credential 평문을 화면·로그·문서·workflow 입력에 출력하거나 별도 파일로 복사하지 않는다. 허용된 helper가 필요 시 값을 process memory로 불러와 HTTPS API 인증에 사용하는 것은 값의 사람/모델 열람·출력과 구분한다. 과거 노출 credential을 계속 사용하는 것은 사용자가 수용한 잔여 위험이며 안전 판정이 아니다.

원격 확인에서 아직 `mastergantt` container package는 존재하지 않았다. Private repository의 ruleset API는 현재 plan에서 403을 반환했다. GitHub 공식 정책상 private branch/tag ruleset은 Pro/Team/Enterprise에서, private Artifact Attestation은 Enterprise Cloud에서 지원된다. D05에서 사용자는 현재 private 요금제를 유지하고 ruleset 미강제 위험을 명시적으로 수용했다. 이는 보호가 적용됐다는 뜻이 아니며 지정 maintainer와 문서화된 절차를 운영 통제로 유지한다. GitHub Attestation은 비활성으로 두고 `ENABLE_GITHUB_ATTESTATIONS`를 설정하지 않으며 BuildKit SBOM/provenance는 항상 유지한다.

## 7. 검증 증거와 상태

로컬에서는 workflow script, version validator, Dockerfile/Compose, image build/runtime/persistence를 검증할 수 있다. Admin 인증 성공은 workflow/artifact PASS가 아니다. Commit image와 SemVer release의 최종 PASS에는 각각 다음 원격 증거가 필요하다.

- Actions run URL, event와 commit; release에는 annotated tag도 포함
- runner/Node/Docker version
- commit `ci-<full SHA>` 또는 release exact tag와 digest
- BuildKit provenance/SBOM 생성 결과와, opt-in한 경우에만 GitHub Attestation 결과
- GHCR digest pull 및 post-publish smoke 결과
- Commit image는 HTTP Project/Task authorization·저장·restart 재조회 결과

원격 실행 전에는 문서와 로컬 검증이 완료되어도 해당 Commit/Release 경로를 `Actions/GHCR NOT TESTED`로 유지한다. 한 경로의 성공을 다른 경로의 증거로 대체하지 않는다.

## 8. 상시 변경 규칙

CI, release, version, Docker image 또는 registry 계약을 바꾸면 같은 변경에서 다음을 함께 갱신한다.

- Workflow/Docker/script와 해당 자동화 테스트
- 이 문서와 `DEPLOYMENT.md`, `TEST_PLAN.md`
- 요구사항 또는 architecture가 바뀌면 `REQUIREMENTS.md`, `ARCHITECTURE.md`, `DECISIONS.md`
- 현재 작업 상태가 바뀌면 `ISSUE_BREAKDOWN.md`, active `PLAN.md`, milestone review
- 사용자 설치·release·image 소비 방식이 바뀌면 `README.md`와 `CHANGELOG.md`

Commit publish 변경은 `ci-<SHA>` overwrite 거부, main-only 조건, upstream gate 의존성, PR/manual read-only, docs-only 판정의 fail-safe 동작, digest pull 및 HTTP persistence smoke를 함께 검토한다. Release publish 변경은 `sha-<SHA>` candidate와 SemVer promotion 불변식을 별도로 검토한다.

Action 또는 base image update PR은 full SHA/digest, release note, permissions 변화, build/runtime smoke를 검토한다. 자동 update PR을 merge했다는 사실만으로 production release를 만들지 않는다.

## Repository layout relocation (#12)

현재 배포 경로와 기존 Compose 프로젝트/volume을 유지하는 전환 절차는 [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md)를 따른다. CI의 Docker build 4개 참조와 Dependabot 경로를 함께 갱신하고 Docker gate에 `scripts/verify-compose-smoke.sh`를 추가했다. 이 smoke는 새 Compose 경로의 config, startup/readiness, restart 및 강제 recreate 후 SQLite 보존뿐 아니라 `RESOURCE_CATALOG_ADMIN_PASSWORD` 누락 시 config fail-fast, app 컨테이너 환경 전달, 실제 관리자 인증 성공/거부, **인증 요청 직후 로그와 재생성 후 로그의 비밀번호 원문 비노출**을 격리된 CI 리소스로 검사한다. 관리자 비밀번호 값 자체는 Actions 출력에 기록하지 않는다. 기존 quality/E2E/runtime/registry 권한·검증 gate는 유지한다. 결과는 해당 PR/run/head의 실제 증거로 판정하며 과거 Wxx 기록을 이번 변경의 PASS로 전용하지 않는다.

## 9. 공통 작업 브랜치 정리 안전성 (#124)

Issue #124부터 작업 브랜치 삭제는 [공통 안전 cleanup 도구](../scripts/safe_branch_cleanup.py)를 기준으로 한다. 완료된 Issue별 일회성 release/cleanup workflow는 완료 증거를 보존한 채 퇴역하며, 새 Issue 전용 workflow에 삭제 코드를 복제하지 않는다.

공통 도구는 `--repo`, merged `--pr`, `--branch`, 검증된 `--target-sha`를 입력받고 기본적으로 검증만 수행한다. 실제 삭제는 `--delete`를 명시한 경우에만 수행한다.

삭제 전 필수 조건은 다음과 같다.

- PR이 실제 merged 상태이고 base가 `main`이며 head repository/branch가 입력과 정확히 일치한다.
- 현재 remote branch tip이 merged PR head SHA와 정확히 같아야 한다.
- GitHub compare 결과에서 merged PR head가 target main/merge SHA의 ancestor여야 한다.
- protected branch와 해당 branch를 head/base로 사용하는 다른 open PR을 거부한다.
- 삭제 직전 Git ref SHA를 다시 읽어 동일 tip인지 확인한다.
- 최종 삭제는 격리된 bare Git 저장소에서 `--force-with-lease=<ref>:<verified-head>`와 단일 delete refspec으로 수행한다.
- REST 무조건 ref DELETE fallback은 금지한다.
- 삭제 후 GitHub ref가 404인지 확인한다. 조건 불일치·권한·네트워크 오류는 FAIL/BLOCKED이며 보존이 기본이다.

`scripts/verify-safe-branch-cleanup.py`는 위 fail-closed 조건과 workflow 정책을 CI quality job에서 검증한다. `.yml`/`.yaml`, `git push -d/--delete`, empty-source refspec(`:branch`, `+:branch`), REST DELETE, YAML folded `run` 우회까지 검사한다.

Issue #87의 고정 cleanup workflow와 전용 verifier는 이 공통 기준의 선행 사례였으며 Issue #124에서 퇴역했다. 당시 실행 증거와 설계 이력은 [ISSUE_87_COMPLETION](ISSUE_87_COMPLETION.md)에 보존한다.

## Issue #76 정식 릴리스 완료 자동화

`issue-76-release-helper.yml`은 Issue #76 정식 릴리스 완료에 사용한 일회성 workflow이며 Issue #124에서 퇴역했다. 아래 내용은 당시 완료 증거와 안전 조건의 역사적 기록이다.

- Trigger: `main` push 중 이 helper 파일이 변경된 경우에만 실행한다. PR/feature branch에서는 실행하지 않는다.
- 권한: `contents: write`, `actions: write`, `issues: write`, `pull-requests: read`만 사용한다.
- 선행 gate: 대상 `main` SHA의 CI가 완료되고 성공해야 하며, 해당 CI에 포함된 임시 `ci-<full SHA>` GHCR 게시·exact digest smoke·임시 package version 정리가 성공해야 한다.
- Release: `package.json`의 `0.21.0`과 annotated `v0.21.0` tag가 정확히 일치해야 한다. helper가 만든 tag는 `release-image.yml`을 해당 tag ref로 dispatch하고, **같은 tag/head SHA이면서 dispatch 시각 이후 생성된 run**만 이번 실행의 증거로 인정한다.
- 복구: tag가 이미 존재할 때는 같은 target SHA의 `release-image.yml` 성공 run이 확인된 경우에만 게시 단계를 반복하지 않고 branch cleanup/Issue 종료를 재개한다. tag만 있고 성공 release 증거가 없으면 실패한 버전을 재사용하지 않고 FAIL 처리한다.
- Cleanup: Issue #76의 고정 작업 브랜치만 대상으로 보호 여부·열린 PR 참조·tip SHA를 재확인하고 SHA lease를 사용해 삭제한다. branch 조회는 HTTP 404만 '이미 없음'으로 처리하고 인증/rate-limit/5xx 등 다른 API 오류는 FAIL한다.
- 완료 계약: release run 성공, branch cleanup 결과와 main CI URL을 Issue #76 댓글에 기록한 뒤에만 Issue를 `completed`로 닫는다. 어느 단계든 실패하면 Issue를 열린 상태로 유지한다.

이 helper는 Issue #76 완료 증거를 보존한 뒤 별도 검토된 운영 변경에서 퇴역한다. 정식 릴리스 승인 경계는 [ISSUE_LIFECYCLE](ISSUE_LIFECYCLE.md)을 따른다.



## Issue #96 정식 릴리스 완료 자동화

`issue-96-release-helper.yml`은 Issue #96의 v0.21.1 GHCR 정식 게시와 Lifecycle 종료에 사용한 일회성 workflow이며 Issue #124에서 퇴역했다. 아래 내용은 당시 완료 증거와 안전 조건의 역사적 기록이다.

- Trigger는 helper 파일이 포함된 `main` push로 한정하며 PR에서는 registry write를 수행하지 않는다.
- 대상 merge SHA의 `ci.yml` push run이 **completed/success**가 될 때까지 polling하고, 명시적 success flag가 없으면 tag 생성이나 release 단계로 진행하지 않는다. 따라서 main 임시 `ci-<SHA>` 게시·exact digest smoke·package cleanup을 포함한 main gate가 선행된다.
- `v0.21.1`은 package version과 대상 SHA가 일치하는 annotated tag여야 한다. 새 tag일 때만 `release-image.yml`을 해당 tag ref로 dispatch하고, 같은 tag/head SHA 및 dispatch 이후 생성된 run의 completed/success만 인정한다.
- 재실행 시 tag가 이미 있으면 같은 tag/head SHA의 기존 성공 release run을 확인하고 게시를 반복하지 않은 채 cleanup/Issue 종료를 재개한다. tag만 있고 성공 release 증거가 없으면 FAIL한다.
- 작업 branch 삭제 전 열린 PR 참조 부재, 현재 tip SHA, tip이 merge target SHA의 ancestor인지, 삭제 직전 ref SHA 불변을 재검증한 뒤 explicit SHA lease로 삭제한다.
- PR #98은 squash/rebase가 아닌 **merge commit 방식**으로 병합한다. cleanup 전에 target SHA가 2개 이상의 parent를 가진 merge commit인지와 `TARGET_SHA^2 == 작업 branch tip SHA`를 검증해 이 전제를 원격 증거로 고정한다.
- 완료 댓글에는 version, main CI URL, 정식 release run URL, tag와 branch cleanup 결과를 남긴 뒤에만 Issue #96을 completed로 닫는다. 중간 실패 시 tag/image overwrite나 gate 우회 없이 Issue를 열린 상태로 유지한다.

이 workflow는 Issue #96 완료 증거 보존 후 별도 검토된 운영 변경에서 퇴역하며, 일반 릴리스 승인으로 확대하지 않는다.


## Issue #84 정식 릴리스 완료 자동화

`issue-84-release-helper.yml`은 Issue #84의 v0.25.0 정식 GHCR 게시와 Lifecycle 종료에 사용한 일회성 workflow이며 Issue #124에서 퇴역했다. 아래 내용은 당시 완료 증거와 안전 조건의 역사적 기록이다.

- Trigger: helper 파일이 포함된 `main` push에서만 실행하며 PR/feature branch에서는 release write를 수행하지 않는다.
- 권한: `contents: write`, `actions: write`, `issues: write`, `pull-requests: read`로 한정한다.
- 선행 Gate: 먼저 기능 PR #114의 **exact final head**에 대한 `ci.yml` pull_request run이 `completed/success`인지, 동일 exact head의 공식 `chatgpt-codex-connector` review node 또는 공식 `chatgpt-codex-connector[bot]`의 `codex-pull-request-review-summary` Completed 증거가 존재하는지, unresolved review thread가 0건인지 확인한다. GitHub Actions REST의 `pull_requests` 배열은 same-repository PR run에서도 비어 있거나 이후 PR 연계 상태에 따라 달라질 수 있으므로 필수 증거로 사용하지 않는다. 대신 PR API에서 exact head SHA·head branch·head repository·base를 확인하고, 같은 source tuple을 가진 PR이 해당 대상 PR 하나뿐임을 검증한다. CI run은 `event=pull_request`인 `ci.yml` 결과 중 exact head SHA + head branch + head repository + repository가 모두 일치하는 latest run을 사용한다. 이어 #114 merge SHA의 main push CI가 `completed/success`인지 확인하여 quality/E2E/Docker와 임시 `ci-<SHA>` GHCR exact-digest smoke 및 package cleanup까지 성공했음을 고정한다. 그 다음 helper는 `TARGET_SHA`를 만든 release-finalization PR을 merge commit 기준으로 식별하고 동일한 exact-head PR CI/공식 Codex identity exact-match review 증거/unresolved-thread Gate를 확인한다. 마지막으로 `TARGET_SHA`의 main push CI도 `completed/success`여야 정식 tag/release로 진행한다.
- Release: package version `0.25.0`과 annotated `v0.25.0`이 정확히 일치하고 tag가 `TARGET_SHA`를 가리켜야 한다. 새 tag를 만든 실행만 `release-image.yml`을 해당 tag ref로 dispatch할 수 있다.
- 실패·재실행 계약: `v0.25.0`이 실행 시작 전에 이미 존재하면 동일 tag/head SHA의 **기존 completed/success release run**이 있을 때만 게시 단계를 재사용한다. 기존 tag만 있고 성공 release 증거가 없으면 실패한 version/tag를 재사용하거나 재게시하지 않고 FAIL한다.
- Branch cleanup: 원격 tip SHA가 merged PR의 recorded head SHA와 일치하고, 해당 merged PR의 merge commit이 `TARGET_SHA`의 ancestor이며, head/base로 열린 PR이 없음을 확인한 뒤 explicit `--force-with-lease=<ref>:<tip SHA>`로 삭제한다. 원격 tip이 merge 이후 변경되면 삭제하지 않는다.
- 완료 증거: 기능 PR #114, 릴리스 마무리 PR, version, feature merge SHA, release target SHA, main CI URL, 정식 release run URL, tag, branch cleanup 결과를 Issue #84에 기록한 뒤에만 `completed`로 닫는다.

이 helper는 Issue #84 완료 증거를 보존하기 위한 한정 자동화이며 일반 release authority나 범용 branch 삭제 권한으로 확대하지 않는다.


## Issue #99 정식 릴리스 완료 자동화 (퇴역)

`.github/workflows/issue-99-release-helper.yml`은 Issue #99의 **v0.26.0 정식 GHCR 게시와 Issue Lifecycle 종료**에 사용한 일회성 운영 workflow이며 Issue #167에서 퇴역했다. 아래 내용은 당시 실행 계약과 완료 증거를 보존하기 위한 역사적 기록이다.

- Trigger는 helper 파일이 포함된 `main` push로 한정하며 PR/feature branch에서는 registry write를 수행하지 않는다.
- 기능 PR #127과 release-validation PR #133은 merge commit 방식으로 병합한다. helper는 #127 merge SHA가 최종 release target의 ancestor인지 확인하고, 최종 target 자체는 #133의 merge commit이며 두 번째 parent가 #133 head와 정확히 일치하는지 검증한다.
- 대상 main SHA의 `ci.yml` push run이 `completed/success`가 된 뒤에만 annotated `v0.26.0` tag를 생성하고 `release-image.yml`을 해당 tag ref로 dispatch한다.
- 동일 tag/head의 기존 성공 release run이 있으면 재사용하며, tag만 있고 성공 release 증거가 없으면 gate를 우회하지 않는다.
- 정식 release 성공 후에만 PR #127의 기능 branch와 PR #133의 release-validation branch를 각각 `scripts/safe_branch_cleanup.py`로 검증·삭제한다. 이전 재통합 branch는 merged-PR-head 조건을 충족하지 않으므로 공통 안전 도구를 우회해 자동 삭제하지 않는다.
- 완료 댓글에는 기능 PR #127, release-validation PR #133, version, release target SHA, main CI, 정식 release run, tag, 두 merged branch cleanup 결과를 기록하고 마지막 단계에서만 Issue #99를 `completed`로 닫는다.

이 helper는 더 이상 존재하거나 실행되지 않으며, 신규 lifecycle 작업은 공통 `ci.yml`, `release-image.yml`, `scripts/safe_branch_cleanup.py`와 현재 Issue Lifecycle 절차를 사용한다.


## Issue #118 Lifecycle 완료 자동화

`.github/workflows/issue-118-release-helper.yml`은 Issue #118의 기능 PR #146 병합 이후 main 검증과 안전한 branch cleanup, 최종 Issue 종료를 직렬화하는 한정 helper다.

- 기능 기준은 PR #146 최종 head `80159c5a5e6a2bfacf8b0c4fad03675801a79ef0`, merge SHA `6386db860af69635cfb0fe626fd1a937905b9a56`, application version `0.27.4`다.
- helper는 자신이 포함된 main commit의 `ci.yml` push run이 `completed/success`가 될 때까지 기다린다. 이 성공에는 quality/E2E/Docker와 main 임시 `ci-<SHA>` GHCR 게시·exact digest smoke·cleanup이 포함된다.
- 기능 branch `fix/issue-118-project-context-toolbar`와 helper finalization branch는 `scripts/safe_branch_cleanup.py`의 merged PR/head SHA/ancestor/open-PR/lease 조건을 모두 통과한 경우에만 삭제한다.
- 기능 PR의 resolved Codex P1, 문서 동기화(`PROJECT_UX`, `TEST_PLAN`, `CHANGELOG`)와 main 검증 증거를 FINAL 댓글에 기록한 뒤 Issue #118을 `completed`로 닫는다.
- 정식 SemVer/GHCR release는 별도 명시적 승인 없이 자동 생성하지 않는다. 이 helper는 main 임시 commit image 검증까지만 완료하며 정식 release authority를 확대하지 않는다.


## Issue #118 구현 전후 레이아웃 증거 Workflow

`.github/workflows/issue-118-before-after-evidence.yml`은 #118 Acceptance Criteria의 동일 조건 구현 전/후 증거를 필요할 때 재현하는 **historical evidence 전용 Workflow**다. #118 구현은 이미 완료되었으므로 일반 PR에서 자동 실행하지 않는다.

- Trigger는 수동 `workflow_dispatch`만 사용한다. 재현 시 검토하려는 ref에서 명시적으로 실행하고 run의 ref/head SHA를 증거에 함께 기록한다.
- 비교 revision은 Before `703a6f08595dea06a918366192df464d7215108e`, After `6386db860af69635cfb0fe626fd1a937905b9a56`(#118 기능 병합 SHA)로 고정한다.
- 두 고정 revision에 선택한 workflow ref의 **동일 측정 harness**를 적용하고 390/768/1024/1440px 모두 높이 844px, editing/readonly 동일 mock fixture로 실행한다.
- PASS 기준: 390px 및 768px의 editing/readonly에서 After의 viewport 내 Gantt 가시 높이가 Before보다 증가하고, 모든 After 조건에서 document horizontal overflow가 없으며 정보 컨트롤이 한 줄을 유지해야 한다.
- 증거: raw geometry JSON, comparison JSON, Markdown 요약, 동일 조건 before/after screenshot을 `issue-118-before-after-evidence` artifact로 90일 보관한다.
- 이 Workflow는 현재 PR의 required check가 아니며 제품 CI `quality/e2e/docker`, main 임시 GHCR 검증, 실제 모바일/스크린리더 검증을 대체하지 않는다.

## Issue Lifecycle 공용 orchestration 원칙

Issue Lifecycle 후반 자동화는 특정 Issue 번호에 종속된 release-helper를 반복 생성하지 않고 [ISSUE_LIFECYCLE_AUTOMATION.md](ISSUE_LIFECYCLE_AUTOMATION.md)의 공용 orchestration/finalization 계약으로 수렴한다.

- `ci.yml`: PR/main 검증과 main temporary GHCR digest smoke의 Source of Truth
- `release-image.yml`: 승인된 annotated SemVer release와 정식 GHCR의 Source of Truth
- `scripts/safe_branch_cleanup.py`: branch cleanup의 fail-closed Source of Truth
- 범용 `issue-lifecycle.yml`: 위 기능을 중복 구현하지 않고 상태 검증, release dispatch, evidence, cleanup, Issue close를 조율하는 목표 workflow

정식 release는 기존 `release_required=true && release_authorized=true` 승인 경계를 유지한다. Lifecycle finalizer는 진행 중/실패/stale required gate에서 Issue를 닫아서는 안 된다.

## 범용 Issue Lifecycle orchestration (#211)

Issue별 hard-coded release helper 대신 `.github/workflows/issue-lifecycle.yml`을 사용한다. workflow는 `verify / release / finalize` operation을 제공하며 release/finalize target을 입력 SHA가 아닌 PR의 exact `merge_commit_sha`에서 도출한다. exact target SHA의 main `ci.yml` success가 없으면 release/finalize하지 않는다.

정식 GHCR publish 로직은 계속 `release-image.yml`만 소유하며 lifecycle workflow에 `packages: write`를 주지 않는다. 승인된 release는 annotated `v<package-version>` tag와 exact release run을 검증하고, 기존 tag는 동일 target의 성공 evidence가 있을 때만 재사용한다. tag conflict/orphan tag는 이동·덮어쓰기하지 않는다.

CI/GitHub orchestration 또는 docs-only 변경은 application version을 유지하고 `release_required=false`로 formal release를 N/A 처리할 수 있다. 이 경우에도 merge 후 main의 temporary `ci-<SHA>` publish/digest smoke/cleanup evidence는 Lifecycle gate로 확인한다.


## Issue #250 CI 실행 시간 최적화

CI 실행 표시 제목은 `run-name`의 `CI 검증 · <PR 제목>` 형식이다. Issue 기반 PR 제목에는 `Issue #345`처럼 실제 Issue 번호를 포함해 Actions 목록에서 대상 업무를 식별한다. Main push는 commit message, 수동 실행은 ref 이름을 대체값으로 사용한다. `run-name`은 표시용이며 Generic Finalizer가 참조하는 workflow `name: CI`, required check 이름·job 식별자, event·permission·quality gate는 변경하지 않는다. [GitHub run-name 공식 문서](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#run-name)를 기준으로 `github` context를 사용한다.

PR/main의 공식 required check 이름은 기존 Ruleset 계약을 유지한다.

- `Build, static checks, and unit tests`
- `Chromium end-to-end tests`
- `Docker build and runtime smoke test`

각 required check는 aggregate gate이며 내부 구현 job을 병렬로 집계한다. `quality` 내부의 policy/typecheck/lint/Vitest/Next.js build는 `changes` 이후 동시에 시작하고, E2E와 Docker smoke도 quality 완료를 기다리지 않는다.

`dorny/paths-filter`는 node/E2E/Docker 영향 경로만 heavy job으로 보낸다. workflow-level `paths`는 required workflow를 Pending 상태로 남길 수 있으므로 사용하지 않는다. docs-only 또는 관련 없는 변경에서도 aggregate required check는 실제 SUCCESS를 반환한다. `workflow_dispatch`는 필터와 무관하게 전체 회귀를 강제한다.

Node 의존성은 `actions/setup-node`의 npm cache를 사용한다. `npm ci`가 `node_modules`를 삭제하므로 `node_modules` 자체를 cache하지 않는다. Next.js production build는 `.next/cache`, TypeScript는 `tsconfig.tsbuildinfo`를 `actions/cache`로 commit 간 재사용한다. Docker BuildKit은 repository 전용 GHA cache scope를 공유한다.

Playwright는 기존 `workers: 1` 격리 계약을 유지하면서 GitHub runner 4개에서 `--shard=1/4..4/4`로 file sharding한다. browser binary cache는 만들지 않고 Chromium headless shell만 설치한다. PR CI 실패 시 shard별 HTML report를 보존한다.

main의 비문서 변경은 세 required aggregate gate가 모두 성공한 뒤 기존 임시 `ci-<SHA>` GHCR 게시/digest 재검증/삭제 흐름을 유지한다. PR은 read-only이며 registry write 권한을 받지 않는다.


## Issue Lifecycle 통합 release/finalize 계약 (#248)

정식 SemVer release가 필요한 Issue의 lifecycle 종료는 기존 release 불변식을 그대로 유지한다. Issue #248에서 `release_finalize` operation을 추가하되, 이는 release 정책을 완화하거나 새로운 publish 경로를 만드는 변경이 아니다.

- 대상은 PR의 exact `merge_commit_sha`.
- exact merge SHA의 main CI가 `completed/success`여야 한다.
- `release_required=true` 및 `release_authorized=true`가 필수다.
- `expected_version`은 target SHA의 `package.json` / lockfile version과 일치해야 한다.
- tag는 annotated `v<version>`이어야 하며 다른 SHA 또는 lightweight tag를 재사용하지 않는다.
- 정식 GHCR publish/검증은 기존 `release-image.yml`이 담당한다.
- 동일 target/tag의 성공 release evidence가 이미 있으면 idempotent하게 재사용한다.
- release 성공 전에 branch cleanup, FINAL, Issue close를 수행하지 않는다.
- lifecycle workflow 자체에는 `packages: write`를 추가하지 않는다.

Issue #248 구현 전에는 기존 `finalize`가 `release_required=true`일 때 동일 release gate를 내부 수행하므로, 정식 release+종료를 한 번에 처리하는 현재 호환 경로로 사용할 수 있다.

## Generic Release Finalizer (#350)

Main CI의 후속 lifecycle mutation은 `.github/workflows/release-finalizer.yml` 하나가 담당한다. `workflow_run.branches: [main]`과 push/success gate로 PR CI 및 수동 CI를 배제한다. exact merge SHA에서 PR/Issue를 자동 resolve하며 application version이 동일하면 finalize, 변경되면 trusted version-scoped release 승인 marker가 있는 경우에만 release_finalize를 수행한다.

Generic finalizer와 `release-image.yml`은 `concurrency.queue: max`로 burst pending run을 보존한다. 단, concurrency의 실행 순서는 semantic version/main history 순서를 보장하지 않으므로 Generic Finalizer가 current main의 first-parent backlog를 oldest → newest로 처리해 release 순서를 확정한다. 상세 계약은 `docs/GENERIC_RELEASE_FINALIZER.md`를 따른다.

## Main 임시 GHCR evidence gate (#352)

비문서 main push의 `publish-commit-image`는 optional implementation job의 SKIPPED 상태가 dependency chain을 통해 전파되어 통째로 SKIPPED되지 않도록 job condition에 `always()`를 사용한다. 단, registry mutation을 허용하는 조건은 다음 direct aggregate 결과를 모두 명시적으로 SUCCESS로 요구한다.

- `changes`
- `quality`
- `e2e`
- `docker`
- `docs_only != true`

따라서 `always()`는 skip propagation만 해제하며 실패/cancelled gate를 우회하지 않는다.

Issue Lifecycle은 exact merge target의 first-parent diff를 CI와 동일한 docs-only 규칙으로 독립 판정한다. 비문서 merge는 exact main CI의 `Main 임시 commit 이미지 게시·검증·정리` job이 completed/success여야 finalize할 수 있다. docs-only merge는 해당 job의 completed/skipped를 정상 N/A evidence로 인정한다. overall main CI success만으로 임시 GHCR publish/digest smoke/cleanup PASS를 주장하지 않는다.

## Issue #435 Workflow 병목 최적화

2026-10-05 실행 이력 기준 PR CI의 임계 경로는 Chromium E2E이고, 정식 Release는 전체 Chromium suite를 단일 runner에서 약 30~40분 실행하는 것이 주 병목이었다. 다음 계약으로 최적화한다.

- PR `pull_request.edited`는 Primary Issue trace validator를 반드시 실행하되 application head SHA가 바뀌지 않는 metadata-only event로 취급하여 node/policy/E2E/Docker 구현 job을 다시 실행하지 않는다. required aggregate quality/E2E/Docker check 이름은 그대로 유지하며 trace 실패는 aggregate도 fail-closed한다.
- PR/Main Chromium E2E는 6 shard와 runner별 `workers=1`을 유지한다. CI에서만 `CI_E2E_FULLY_PARALLEL=true`를 주어 Playwright가 개별 test 기준으로 shard를 분산할 수 있게 하며 explicit serial describe는 계속 직렬이다.
- Release는 static quality와 6-way Chromium E2E shard를 병렬 실행하고 `Release quality gates` aggregate가 모두 성공한 뒤에만 candidate container smoke와 registry publish를 시작한다.
- Generic Release Finalizer는 Release 완료를 polling하며 runner를 점유하지 않는다. Main CI 성공 시 release-required target은 승인/정확한 SHA/version을 검증하고 annotated tag + release workflow dispatch까지만 수행한다.
- `Publish release image`의 publish 성공 뒤에는 `release-finalizer-resume.yml`을 `workflow_dispatch(target_sha, release_run_id)`로 명시적으로 호출한다. 기존 `workflow_run.completed` listener도 fallback으로 유지하며 Resume은 trusted `main` code만 실행한다. Explicit Resume은 source Release가 아직 active일 수 있으므로 exact run ID가 `completed/success`가 되고 workflow path/head SHA가 기대값과 일치할 때까지 기다린 뒤 resolver를 실행한다.
- post-publication lifecycle handoff는 non-blocking이다. handoff 전 candidate/runtime/API/attestation/promotion gate는 모두 완료되어야 하며, handoff 실패 때문에 이미 성공한 immutable GHCR publication을 실패로 뒤집지 않는다.
- Release failure는 immutable tag를 이동/덮어쓰기하지 않고 Issue/branch를 유지한다. 기존 Release run을 재실행해 SUCCESS가 되면 explicit dispatch 또는 completion fallback으로 finalization이 재개된다.
- first-parent oldest→newest, same-Issue corrective convergence, exact main CI/GHCR evidence, explicit release authorization, safe branch cleanup, stable alias serialization은 기존 계약을 유지한다.

변경 전 기준은 PR CI median 14.1분, Main CI 16.2분, Release 41.9분, Finalizer 42.8분이며 대표 PR E2E shard는 7.4/11.7/13.6/5.1분이었다. 변경 후 exact PR/main/release run에서 같은 지표를 다시 기록한다.

### #435 4-shard 실측 보완

최초 test-level 4-shard 실측은 `6.0 / 8.9 / 14.5 / 5.1분`으로 test count는 각 84개로 균등해졌지만 최장 shard가 기존 13.6분보다 길어 임계 경로 개선 기준을 충족하지 못했다. 따라서 workers=1과 test-level 분배를 유지하면서 shard 수를 6으로 조정한다. 이 변경은 required aggregate check 수/이름을 바꾸지 않으며, 최종 선택은 exact PR head의 wall-clock과 shard 편차로 판정한다.

## Issue #437 Historical timing 기반 E2E shard 최적화

#435의 6-shard 구조는 유지하되 test count 균등만으로 발생하는 실행시간 편차를 줄이기 위해 **historical timing → robust estimate → LPT plan** 계층을 추가한다.

- 각 Chromium shard는 `tests/config/e2e-timing-reporter.cjs`로 성공한 test의 file별 duration을 JSON으로 기록한다.
- CI와 Release는 timing JSON을 30일 artifact로 보존한다. timing artifact는 품질 PASS evidence를 대체하지 않고 다음 plan 계산용 관찰 데이터다.
- 일반 PR/Main/Release 실행은 `tests/config/e2e-shard-plan.json`이 현재 6-shard 계약과 일치할 때만 해당 file plan을 사용한다.
- plan이 없거나 JSON이 손상되거나 shard count가 맞지 않으면 기존 Playwright native `--shard=N/6`로 fail-safe fallback한다.
- committed plan에 없는 신규 E2E spec은 deterministic hash로 한 shard에 추가하고 삭제된 spec은 무시하여 stale plan 때문에 test가 누락되지 않게 한다.
- `.github/workflows/e2e-shard-optimizer.yml`은 일반 CI critical path와 분리된 schedule/manual workflow다. 최근 성공한 `main` push CI 최대 20개의 timing artifact를 조회하고 최근 10회 이상이 확보된 뒤 median file duration을 계산한다.
- planner는 LPT(Longest Processing Time first)로 6개 bin의 예상 test time을 균형화한다. 4~8 shard 후보는 관찰용으로 simulation하지만 이 Issue의 자동 PR은 shard count 자체를 바꾸지 않는다.
- 기본 재균형 gate는 최근 5회 중 3회 이상 imbalance ratio(`max/median`) > 1.35, file timing coverage >= 80%, 예상 critical path 개선 >= 15% 또는 >= 2분, 마지막 plan 변경 후 7일 이상이다.
- gate를 충족하면 optimizer가 `ci/issue-437-e2e-shard-plan-<run id>` branch와 `[Issue #437] ci: E2E 샤드 계획 갱신` PR을 생성한다. **자동 병합은 하지 않으며** 기존 required PR CI가 새 plan을 검증한다.
- 과거 artifact는 신뢰할 수 없는 입력으로 취급한다. optimizer는 artifact 안의 명령을 실행하지 않고 duration/file JSON만 파싱하며, 실제 실행 대상은 checkout된 현재 `tests/e2e` 파일 목록과 교차 검증한다.

GitHub Actions artifact는 run 간 결과 보존/다운로드 용도로 사용하고 dependency cache와 혼용하지 않는다. optimizer는 최근 run/artifact 조회와 자동 plan PR 생성 직후 exact branch에 `ci.yml workflow_dispatch`를 명시적으로 시작하므로 `actions: write`, plan PR 생성에 한정한 `contents: write`, `pull-requests: write`를 사용한다. `GITHUB_TOKEN`이 만든 일반 push/PR 이벤트가 후속 workflow를 자동 재귀 실행한다고 가정하지 않으며, regular CI 권한은 확대하지 않는다.

- Issue #508 보완: optimizer의 분석 결과는 hidden file이 아닌 `e2e-shard-proposal.json`으로 기록하고 30일 artifact로 보존한다. 기본 `actions/upload-artifact` hidden-file 제외 정책에 의존하지 않는다.
- 기존 자동 plan PR 조회는 inline Bash quote nesting을 사용하지 않고 `scripts/e2e-shard-optimizer-pr.mjs`가 GitHub CLI 인자를 배열로 전달한다. 검색 결과는 `[Issue #437] ci: E2E 샤드 계획 갱신` exact title만 기존 PR로 인정한다.
- `shouldUpdate=false`이면 기존 PR 조회와 PR 생성은 모두 skip한다. `shouldUpdate=true`일 때 exact-title PR이 있으면 새 PR을 만들지 않고, 없을 때만 기존 자동 PR 생성·명시적 `ci.yml workflow_dispatch` 경로로 진행한다. 6-shard, median/LPT, threshold, cooldown과 자동 merge 금지 계약은 변경하지 않는다.

### Issue #541 자동 PR 권한 차단 및 복구

- `E2E 샤드 최적화 #10.1`(Run ID `37706501705`)에서는 15개 성공 run의 median/LPT 분석과 proposal artifact 업로드, 브랜치 push까지 성공했지만 `gh pr create`가 `GitHub Actions is not permitted to create or approve pull requests`로 차단되었다.
- `permissions: pull-requests: write`는 workflow-scoped token 권한이며, 자동 PR 허용을 위한 repository-level 정책과 별개다. 관리자 승인 없이 Actions 설정이나 Secret 권한을 확대하지 않는다.
- 권한 거부 또는 다른 자동 PR 생성 실패 시 생성된 변경 브랜치를 보존하고 `GITHUB_STEP_SUMMARY`에 BLOCKED 원인, 브랜치 SHA, GitHub compare 기반 수동 PR 생성 링크 및 Settings → Actions → General → Workflow permissions 설정 경로를 남긴다. **수동 복구 시 자동 PR과 정확히 동일한 제목 `[Issue #437] ci: E2E 샤드 계획 갱신` 및 canonical `Refs #437`가 정확히 한 번 포함된 본문을 복사하도록 Summary에 명시한다.** `exit 1`을 유지하여 자동화 실패를 SUCCESS로 위장하지 않는다.
- 자동 PR이 성공했을 때만 exact branch의 `ci.yml workflow_dispatch`를 실행한다. 기존 PR이 있으면 추가 자동 PR을 생성하지 않는다.
- 또한 `tests/config/e2e-shard-plan.json` 또는 `scripts/e2e-shard-planner.mjs` 변경은 Chromium E2E 실행에 직접 영향을 미치므로 `ci.yml`의 `e2e` path filter에 포함한다. PR aggregate E2E 성공이라도 shard job이 `SKIPPED`였다면 새 계획의 런타임 검증을 완료했다고 해석하지 않는다.
- 장애 복구: #10에서 생성된 `ci/issue-437-e2e-shard-plan-37706501705` 브랜치를 별도 [PR #540](https://github.com/planner77/masterGantt/pull/540)으로 복구했다. required CI가 성공하기 전에는 병합하지 않으며 repository 설정 변경은 owner/maintainer의 별도 승인 대상이다.

## Issue #438 Build-once / verified digest promotion

- Container binary는 Main CI의 `publish-commit-image`에서 한 번만 build한다. successful non-docs main candidate는 version 변경 여부와 무관하게 Generic Finalizer까지 보존한다. no-release finalize가 exact temporary candidate를 정리하고, release-required candidate는 formal release에서 재사용한다.
- Main image build는 Dockerfile `VERSION`과 OCI version label에 현재 `package.json.version`을 사용하고 revision label에는 exact main SHA를 기록한다.
- Release prepare는 annotated `v*` tag object 자체를 검사한 뒤 `refs/tags/<tag>^{commit}`으로 `target_sha`를 계산한다. candidate 조회는 `ci-<target_sha>`만 허용한다.
- Release quality/static/E2E gate는 유지하지만 container build action은 release workflow에서 제거한다.
- Candidate는 digest pull 후 source/revision/version label, image policy, HTTP/HTTPS transport, migration/readiness, SQLite restart persistence를 다시 검증한다.
- candidate image policy·transport·migration/readiness·SQLite persistence·Project/Task API와 optional attestation을 **모두 exact tag 생성 전에** 완료한다. 이후 Docker `imagetools create --prefer-index=false` single-source promotion을 마지막 publication step으로 사용하고 metadata descriptor digest가 candidate digest와 동일한지 확인한다.
- 이미 존재하는 exact SemVer tag는 같은 candidate digest일 때만 idempotent retry로 허용하고 다른 digest면 overwrite를 거부한다.
- Stable release는 exact SemVer와 major.minor/major/latest를 **같은 최종 promotion step**에서 동일 candidate digest로 갱신한다. prerelease는 exact SemVer만 생성한다. 최종 publication 뒤에는 application/runtime/attestation과 같은 실패 가능한 gate를 두지 않는다.
- BuildKit SBOM/provenance는 Main candidate digest에서 생성되며 SemVer promotion이 digest를 바꾸지 않으므로 같은 subject digest에 유지된다. optional GitHub Attestation도 candidate digest를 subject로 사용한다.
- Release candidate `ci-<SHA>`와 exact SemVer가 같은 GHCR package version/manifest를 공유할 수 있으므로 release 완료 후 `ci-*` tag만 따로 제거하려고 package version 전체를 삭제하지 않는다. Release candidate alias는 provenance/debugging evidence로 유지한다.

### Issue #439 v0.83.2 release candidate API smoke correction

- GHCR Release Run #131에서 static quality, Release E2E 6/6, candidate digest 확인, transport, image policy, migration/readiness, SQLite persistence는 PASS했지만 Project/Task API smoke가 시작 전에 실패했다.
- 원인은 `release-image.yml`이 실제 candidate container 이름 `mastergantt-release-candidate`를 전달하는 반면 `verify-registry-api-smoke.mjs` allowlist가 이전 `mastergantt-release-smoke`만 허용한 이름 계약 불일치다.
- candidate image/digest 자체의 결함이나 GHCR 장애가 아니므로 검증 gate를 삭제하거나 skip하지 않는다. API smoke allowlist에 candidate 이름을 명시적으로 추가하고 정적 회귀로 workflow 호출 인자와 allowlist를 함께 고정한다.
- 이미 생성된 annotated `v0.83.2` tag는 이동·삭제·덮어쓰기하지 않는다. deterministic release failure는 same-Issue corrective merge와 새 PATCH version으로 supersede하며 Generic Finalizer의 exact main CI/candidate digest/release authorization 검증을 다시 통과한다.

## Issue #439 CI setup/cache 비용 계측

#435/#437/#438 이후 남은 setup 비용을 최적화하기 전에 PR/Main/Release에서 같은 형식으로 계측한다. 이번 단계는 **Phase 1 — Instrument**이며 baseline 10회 전에는 새로운 Playwright browser cache를 활성화하지 않는다.

- 공통 recorder: `scripts/record-ci-setup-metric.mjs`가 `checkout`, `setup-node`, `npm-cache`, `npm-ci`, Playwright OS dependency/headless-shell, Next cache, Docker Buildx/build-push 등의 duration과 cache 상태를 JSONL 및 GitHub Step Summary에 기록한다.
- machine-readable artifact는 30일 보존하며 schema v2 record에 `runId`, `runAttempt`, stable workflow file identity, `job`, `eventName`, `headSha`, `metric`, `durationMs`, `cache`를 포함한다. workflow identity는 `GITHUB_WORKFLOW_REF`의 `.github/workflows/*.yml` 경로를 우선 사용한다.
- `scripts/analyze-ci-setup-metrics.mjs`는 **successful workflow run에서 내려받은 artifact만** 입력으로 사용하고 workflow/event/job/metric별로 분리해 record 수, 서로 다른 successful run ID 수, median, p90, cache 분포를 계산한다. E2E matrix shard나 동일 run의 재실행은 record는 늘릴 수 있지만 baseline run 수는 늘리지 않는다. 기본 최소 표본은 서로 다른 successful run 10회다.
- `./.github/actions/node-setup`은 기존 `setup-node cache:npm`과 같은 목적의 **npm download cache(`~/.npm`)만** 명시적으로 관리해 exact cache hit/miss를 관찰한다. key는 OS/arch/Node version/package-lock hash를 포함하며 restore key도 같은 runtime 범위 안에서만 사용한다.
- `node_modules`는 cache하지 않는다. `npm ci`는 매 job에서 frozen lockfile 기준으로 node_modules를 재구성하며 cache hit은 test PASS evidence가 아니다.
- `./.github/actions/playwright-setup`은 `install-deps chromium`과 `install --only-shell chromium` 비용을 분리 계측한다. Phase 1에서는 `~/.cache/ms-playwright` cache를 **의도적으로 사용하지 않는다**. 10회 이상 baseline 뒤 browser download가 유의미한 비용일 때만 version/OS/arch key 기반 cache를 별도 변경으로 검토한다.
- Next `.next/cache`는 기존 동작을 유지하면서 restore 시간과 exact hit 여부를 기록한다. cache miss는 정상 build로 fallback한다.
- Docker는 기존 `type=gha,scope=mastergantt-docker` 계약을 유지하고 Buildx setup 및 build/push elapsed time을 기록한다. BuildKit 세부 layer cache hit은 build summary/log 증거와 함께 해석하며 cache 결과 자체를 quality gate로 사용하지 않는다.
- E2E timing JSON의 `runnerReadyMs`는 Playwright CLI 실행 시작부터 reporter `onBegin`까지의 시간이다. shared webServer가 필요한 run에서는 webServer startup/readiness와 test discovery가 포함되므로 순수 server boot time으로 과장하지 않는다.
- cache/artifact에는 secret, token, `.env`, `node_modules`, test result PASS 판정 자체를 저장하지 않는다. fork/external PR에서 cache write가 제한되어도 cache miss 경로로 정상 검증한다.

### Phase 2 진입 기준

- PR/Main/Release 각 경로의 workflow/event/job/metric 그룹에서 비교 대상 setup metric의 **서로 다른 successful run ID를 최소 10개** 확보한다. 동일 run ID의 matrix shard/재실행은 추가 baseline run으로 세지 않는다.
- baseline median/p90과 cache hit/miss를 기록한 뒤 후보 최적화의 before/after를 동일 metric 정의로 비교한다.
- wall-clock 개선이 의미 있고 runner-minutes가 증가하지 않거나 합리적 범위일 때만 cache 변경을 채택한다.
- Playwright browser cache, 추가 Next/Docker cache 조정은 이 Phase 1 PR의 범위 밖이며 측정 근거 없이 활성화하지 않는다.

### Release static 실패 시 계측 종료 guard

Release quality의 setup/build duration recorder는 원래 제품·보안 gate의 결과를 보조하는 계측이며 실패 원인을 추가로 만들거나 덮어쓰면 안 된다.

- build 시작 step이 실제 실행되어 `started_ms` output을 만든 경우에만 대응 종료 metric을 기록한다.
- audit/typecheck/lint/test 등 선행 gate 실패로 시작 step이 SKIPPED되면 종료 recorder도 SKIPPED되어야 한다.
- `if: always()`가 필요한 cleanup/artifact 업로드와, 선행 output이 필수인 duration recorder를 구분한다.
- recorder guard는 보안 gate를 완화하지 않는다. `npm audit --omit=dev`의 non-zero는 그대로 Release static quality FAIL이다.
- 회귀 계약은 `tests/scripts/test-config-layout.test.ts`에서 release workflow condition과 취약 transitive dependency 최소 버전을 정적으로 확인한다.


## Issue #483 Release Completion Resume Actions 권한 경계

`release-finalizer-resume.yml`은 successful Release를 finalize한 뒤 동일 실행에서 backlog의 다음 release-required target을 시작할 수 있다. 이 경로는 `issue_lifecycle.py`의 Release workflow dispatch를 재사용하므로 job-scoped `GITHUB_TOKEN`에 `actions: write`가 필요하다.

- `actions: write`: `release-image.yml` workflow_dispatch에만 필요하다.
- `contents: write`: annotated tag 및 lifecycle repository mutation 계약을 유지한다.
- `issues: write`, `packages: write`, `pull-requests: read`: 기존 finalize/cleanup 계약을 유지한다.
- Resume는 trusted `main`만 checkout하며 source Release run의 path/head SHA/conclusion을 검증한 뒤 resolver를 실행한다.
- 권한 누락은 `scripts/verify-issue-lifecycle.py`에서 PR CI 단계에 fail-closed로 검출한다.

### Issue #487 Main CI #2203.1 — APT 잠금 충돌 재발 방지

PR #488 merge SHA `08ac7749efc4544dfc125853d9e58ef3a9d56b21`의 Main CI #2203.1 (run `37793380955`)은 Quality/Docker 및 Chromium shard 2~6이 PASS, shard 1/6은 Playwright OS deps timeout 뒤 이전 `apt-get` (PID 2593)이 `/var/lib/apt/lists/lock`을 유지해 공식 Ubuntu archive 재시도가 lock exit 100으로 실패했다. E2E aggregate가 실패해 Main 임시 GHCR 게시 job은 SKIPPED였다.

공용 `.github/actions/playwright-setup/action.yml`의 안전한 복구는 GitHub Ubuntu runner에 Azure archive URL이 구성된 경우 **첫 설치 시도 전** 해당 URL을 공식 `https://archive.ubuntu.com/ubuntu`로 치환한다(24.04 `/etc/apt/apt-mirrors.txt` 참조 포함). APT HTTP/HTTPS 자체 timeout 45초 및 Acquire retries 1회를 설정해 sudo `apt-get`이 상위 npm timeout 뒤에 불필요하게 살아남는 위험을 줄인다. 각 Playwright 설치 시도 전체의 360초 상한은 유지한다. 최초 시도가 실패하고 retry 가능 경로인 경우 `fuser`로 `/var/lib/apt/lists/lock`, `/var/lib/dpkg/lock-frontend`, `/var/lib/dpkg/lock`의 활성 점유를 최대 60초 확인한 뒤 **잠금이 모두 해제된 때만** 1회 재시도한다. 잠금이 남거나 `fuser`가 없으면 다른 프로세스를 강제 종료하지 않고 fail-closed한다.

CI/Release E2E 6개 shard·workers 1, job timeout, Docker/GHCR exact digest/transport/persistence 검사, metrics 측정 및 버전 정책은 유지한다. 이 보완은 추가 `Refs #487` PR 및 새 merge SHA의 PR/Main CI로 별도 검증하며 기존 실패를 PASS로 대체하지 않는다. 애플리케이션 버전 `0.102.1` 불변, 정식 SemVer tag는 N/A다.


## Issue #577 PR metadata 증거 판정과 동시 실행 개선 (2026-10-09)

- `name: CI`, 기존 세 Required Check 이름, main strict Ruleset, E2E 6 shard, release/finalizer/GHCR 계약을 변경하지 않는다. CI 실행명은 `[전체 검증]` / `[메타데이터 검증]`으로 구분하며 PR/Issue/Run/Attempt 추적을 보존한다.
- `pull_request.edited`는 별도 `ci-pr-<PR>-metadata` concurrency group으로 묶는다. `synchronize`의 `ci-pr-<PR>-full`을 취소하지 않는다. 메타데이터 변경만으로 전체 CI를 재시작하지 않는다.
- metadata-only job은 현재 PR API의 Head/제목/본문/브랜치 canonical trace를 재검증하고 이벤트 Head SHA와 비교한다. 달라진 구 SHA는 `SUPERSEDED`(비권위 N/A)로 즉시 반환한다. 새로운 SHA의 CI를 구 SHA에 귀속하지 않는다.
- 현재 SHA에서는 동일 CI workflow의 가장 최근 판별 가능한 **full** 실행만 평가한다. `completed/success`와 세 required gate의 `success`, metadata job의 `skipped`가 모두 있어야 `VERIFIED`. 더 최근 full CI가 FAILED/CANCELLED이면 `FULL_FAILED`; 진행 중은 `DEFERRED`; 확인 불가는 `MISSING`; trace 오류는 `TRACE_INVALID`. API 실패도 fail-closed.
- 1,200초 busy-wait를 제거하고 단발 조회로 제한한다. 진행 중/없는 full CI는 성공으로 꾸미지 않는다. **제약:** DEFERRED/MISSING의 metadata-only aggregate가 실패한 뒤 full CI가 성공하더라도 자동 재평가는 제공되지 않는다. 정확한 SHA로 전체 CI가 성공했는지 검증한 후 **metadata 실행의 실패 Job 재실행**을 수행한다. 새 코드 Push 없이 의도적 metadata 편집을 반복하지 않는다. 이 경로가 병합을 막으면 승인 하에서 경량 후속 이벤트 기반 재판정 도입을 별도 이슈로 추진한다.
- 서버 API `actions: read`, `pull-requests: read`, `contents: read` 이외 권한을 쓰지 않는다. 검증 스크립트는 적절한 Job Summary에 event/current SHA와 full run ID/상태를 기록한다.
- 변경 전 사례: PR #576 metadata #2296 Head `9f0458124198470872c6764cbd5b00dedc75417b` 실행 2026-10-09T09:50:27Z~10:10:33Z, 약 20분 Runner 사용; full #2297 Head `9d37571cef128c2f9a57c0616244412ca3354972` 성공. 변경 후 성공률/Runner-minutes의 실제 비교는 PR #577 후속 Actions 측정으로만 결정한다. 회귀 시 본 PR revert가 rollback 방안이다.
- 설계 비교: 단일 workflow는 Ruleset·required check ID·token 범위를 유지하면서 짧게 보완 가능하지만 pending 자동 재개가 없다. 별도 metadata workflow 또는 `workflow_run` gate는 main의 신뢰된 코드 실행·workflow 존재 조건·PR/SHA/event/attempt 증거 결합·check name 충돌과 write 권한 위험이 있으므로 이번 범위에서는 도입하지 않는다.

- PR #578 Codex P1 후속: metadata 증거 판정 Job은 다른 Runner와 workspace를 공유하지 않으므로 고정 SHA의 `actions/checkout`을 `persist-credentials: false`로 먼저 수행한다. `scripts/verify-issue-lifecycle.py`가 checkout 선행·인증 미보존 계약을 확인한다.
