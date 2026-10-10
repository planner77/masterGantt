## Issue #598 — Owner 중심 QA 운영 (2026-10-10)

기본 `qa_method=OWNER_MANAGED` (`AUTOMATED_MANAGER`는 호환 alias), `AGENT`는 선택적 독립 검토이다. 보호된 CI/workflow/scripts/package/QA·보안 정책과 HIGH를 포함하여 별도 인간 Reviewer GitHub APPROVED는 필수가 아니다. 대신 최신 PR Head/base에 관한 원본 Quality/E2E/Docker 세 required aggregate PASS, strict main, unresolved review thread 0, docs/AC, 기본 브랜치 trusted read-only validator 및 고위험 수동 점검을 모두 유지한다. `automated_qa=PASS`와 `independent_qa=N/A(Owner-managed, 독립 검토 없음)`은 `manager_decision=ACCEPT`가 아니다. Owner의 명시적 병합 지시는 GitHub 인증 신원·대상 PR/HEAD/base/run/attempt/잔여위험을 확인한 뒤 감사 기록으로 남기며 수동 JSON 영수증은 요구하지 않는다. 변경 검증기 자기 승인, PR 내용/봇 댓글을 이용한 위조 승인, stale run 및 CI 우회는 차단한다. 이 정책 자체의 bootstrap PR은 기존 main validator가 protected를 BLOCKED하는 원장을 유지하며 세 필수 CI 성공·일회성 Owner 전환 승인 전 병합하지 않는다. 메인 임시 GHCR candidate와 finalizer는 동일, 정식 release는 `release_required && release_authorized`만 허용한다. [QA 정책](QA_REVIEW_POLICY.md)을 최신 기준으로 삼으며 아래 #565/#580/#595 이전 필수 인간 reviewer 지침보다 우선한다.

## Issue #595 — QA-only 재실행 시 attempt 원장 검증

현재 실행에 포함되지 않은 required Quality/E2E/Docker Job을 무조건 SKIPPED/FAIL로 간주하거나 과거 임의 CI run의 성공으로 대체해서는 안 된다. GitHub의 같은 CI Run ID에 대한 정확한 attempt별 Job API를 1..latest 순서로 조회하고, Job 이름별 마지막 실행 attempt의 결론만 권위로 인정한다. QA-only rerun이면 앞 attempt의 필수 aggregate PASS를 유지하고, 재실행된 aggregate 실패·취소, 누락된 attempt, 중복 Job 이름은 fail-closed 처리한다. PR Head/base/run/attempt/해당 job source_attempt를 보고서에 남긴다. 실제 독립 QA/Manager 승인 없이 보호 파일의 자동 QA를 PASS 처리하지 않는다.

## Issue #595 — 보호 변경의 독립 검토 증거

보호 대상에 해당하는 릴리스 버전 원장 또는 CI/보안 설정을 변경하는 PR에서는 기존 필수 Quality/E2E/Docker 검증 결과와 독립 QA 승인 결과를 별도로 기록한다. QA를 구현한 사람이 자기 코드를 승인한 결과는 독립 검토로 인정하지 않는다. 정확한 PR Head와 Base, 독립 Reviewer의 현재 Head 승인 기록, 원본 CI Run/Attempt의 성공한 필수 세 Job, 저장소 소유자의 독립 리뷰 이후 Manager 승인 여부를 검증하는 경로를 사용한다. 자료가 없거나 충돌하면 BLOCKED로 판정한다. 새로운 검증기 자체는 별도 독립 검토 및 main 병합 전까지 운영에 적용되지 않았으며, GHCR/tag 릴리스 권한은 변경하지 않는다.

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

# GitHub-first 테스트 및 검증 정책

## Issue #565 위험도 기반 독립 QA와 GitHub Required Validation 분리

위험 분류/QA N/A·Reviewer·Manager 승인 계약은 [QA_REVIEW_POLICY.md](QA_REVIEW_POLICY.md)를 따른다. LOW/일부 MEDIUM은 근거와 영향을 기록하고 독립 검토만 `N/A`가 가능하다. HIGH 및 `qa_required=true` MEDIUM은 실제 별도 qa_docs/인간 Reviewer가 필요한 상태이며 reviewer를 확보하지 못하면 **BLOCKED**다. 자동 리뷰 또는 CI만으로 독립 QA PASS라고 기록하지 않는다(#580 자동 QA 대체는 별도 후속).

GitHub Actions exact-head `quality/e2e/docker` aggregate PASS와 path-based implementation Job SKIPPED를 분리 기록한다. 새 Head에서는 3개 required aggregate 결과를 다시 확인해야 한다. PR의 latest SHA와 run ID/attempt, 문서 동기화, review thread 해결, qa_final(PASS 또는 조건부 N/A) 및 Manager ACCEPT가 서로 다른 증거다. `main-lifecycle-gate` 승인 리뷰 수 0은 내부 Manager 승인 근거가 아니다. 실제 GitHub Settings/Ruleset 변경은 이번 범위에 없다.


## Issue #361 Actions 실행명 원격 검증

PR 단계의 실제 원격 증거는 Actions run의 `display_title`이 Primary Issue, PR 번호와 `run_number.run_attempt`를 포함하는지 확인하는 것이다. 정적 Python contract만으로 GitHub UI에 적용됐다고 판정하지 않는다. 이 PR에서는 새 `run-name`이 적용된 PR CI와 기존 required `quality/e2e/docker` check 이름을 함께 확인한다.

Main CI/Generic Finalizer/GHCR Release의 표시명은 각 trigger가 실제 발생한 뒤에만 원격 PASS로 판정한다. PR 단계에서는 `scripts/verify-issue-lifecycle.py`와 `scripts/verify-ci-run-trace.py`로 event metadata 전달 계약을 검증하며, 병합 전 Main/Finalizer/Release 표시명을 실제 실행 완료로 과대 보고하지 않는다.

## Issue #283 원격 Docker 검증

Issue #283은 Docker/runtime artifact 계약을 변경하므로 동일 PR head에서 `quality`, `e2e`, `docker`를 모두 새로 검증한다. Local Fast Feedback이 제한되거나 Docker 실행이 불가능한 환경의 정적 검토는 원격 PASS를 대체하지 않는다.

PR `docker` 구현 job은 candidate standalone image를 build한 뒤 image policy, 주요 artifact/layer 기록, invalid production config fail-fast, migration/readiness, native SQLite write/restart persistence, transport 및 Compose recreate persistence를 순서대로 검증한다. baseline은 PR 이벤트가 제공한 exact base SHA의 detached worktree에서 build하며 과거 수동 측정값을 재사용하지 않는다. 최소 25% 감소 hard gate는 Issue #283처럼 base가 non-standalone이고 candidate가 standalone으로 전환되는 migration PR에만 적용한다. 이후 일반 PR은 이미 slim한 base 대비 추가 25% 감소를 요구하지 않고 size 비교를 관찰용 summary로만 남긴다.

main 병합 후에는 기존 main gate를 따른다. 즉 merge SHA의 `quality/e2e/docker` 성공 뒤 비문서 변경의 임시 `ci-<full SHA>`를 게시하고 exact digest pull runtime smoke, SBOM/provenance 및 임시 package cleanup을 확인한다. Issue #283의 정식 SemVer/GHCR release는 `release_required=true`이지만 별도 명시적 `release_authorized=true` 근거 없이는 실행하지 않는다.

> **Issue #8 전송 정책:** production 기본값은 HTTPS다. `ALLOW_INSECURE_HTTP=true`와 canonical HTTP `APP_BASE_URL`을 함께 설정한 내부망은 production HTTP도 지원한다. 시작·readiness·공유 URL·모든 인증 경로는 같은 정책을 사용한다. `SESSION_COOKIE_SECURE`는 미사용 예약값이며 제거했다. HTTP에서는 `mastergantt_edit`, HTTPS production에서는 `__Host-mastergantt_edit; Secure`를 사용하고 HttpOnly·SameSite=Strict·Path=/·TTL 및 Domain 미설정을 유지한다. 아래 과거 검증 이력의 HTTPS-only 표현은 당시 기준이다. 현재 운영·전환 절차는 [HTTP_OPERATION](HTTP_OPERATION.md)을 따른다.


관련 Issue: #5

## Issue #120 원격 검증

동일 PR head에서 quality/e2e/docker를 모두 확인한다. E2E는 semantic token의 실제 computed color 대비, visible focus, 390/768/1024/1440 대표 폭과 기존 Task Editor/Row Menu interaction 회귀를 포함한다. main 병합 뒤에는 해당 merge SHA의 main CI와 임시 GHCR exact digest smoke/cleanup을 확인한다. 정식 0.27.0 release는 `release_required=true`이며 별도의 명시적 `release_authorized=true` 근거가 있을 때만 annotated tag와 release-image workflow를 실행한다.

## 목적

코드 변경의 공식 검증 증거를 개발자 로컬 환경이 아니라 GitHub Actions에 우선 둔다. 로컬 실행은 빠른 피드백과 재현에 사용하고, PR merge 가능 여부와 `main` artifact의 유효성은 원격 workflow 결과로 판단한다.

## 1. 검증 계층

| 단계 | 실행 위치 | 기본 범위 | 판정 용도 |
| --- | --- | --- | --- |
| Local Fast Feedback | 개발 환경 | 변경과 직접 관련된 Vitest, 필요 시 typecheck/lint, 재현용 명령 | 구현 중 빠른 피드백. 공식 전체 회귀 PASS를 의미하지 않음 |
| PR Required Validation | GitHub Actions | version check, typecheck, lint, 전체 Vitest, dependency audit, markdown link, production build, Chromium Playwright E2E, Docker build/runtime/SQLite persistence smoke | 코드 변경의 기본 공식 검증 |
| Main Artifact Validation | GitHub Actions + GHCR | 비문서 `main` push: PR 수준 gate + `ci-<full SHA>` publish + exact digest pull + readiness/API/auth/restart persistence + SBOM/provenance. version 유지 merge는 검증 후 삭제하고 version-changing successful candidate는 release까지 보존. docs-only main push는 registry job SKIPPED | runtime/artifact에 영향이 있는 `main` commit registry 경로 검증 |
| Semantic Release Validation | GitHub Actions + GHCR | release workflow의 version/tag gate, annotated tag target SHA의 Main candidate label/digest 검증, candidate runtime smoke, **동일 digest exact SemVer promotion**, post-promotion digest smoke | 배포 가능한 version artifact 검증 |
| Environment-specific Validation | 실제 대상 환경 | Windows Excel/VBA/DRM, reverse proxy/TLS, off-host backup/restore, 최종 수동 UX 등 | GitHub-hosted runner로 대체할 수 없는 항목 |

## 2. 기본 개발 흐름

1. Issue 또는 승인된 작업 범위를 확인한다.
2. `main`에서 작업 branch/worktree를 만든다.
3. 구현 중에는 변경과 직접 관련된 최소 로컬 테스트만 반복한다. 실패 재현을 위해 필요한 경우 범위를 확대한다.
4. 변경을 원격 branch에 push하고 Pull Request를 생성한다.
   Issue 기반 PR 제목에는 `Issue #345`처럼 실제 Issue 번호를 포함한다. CI 실행 제목은 PR 제목을 사용하므로 Actions 목록에서 같은 번호를 확인하고, 실제 검증 대상은 계속 exact head SHA와 run ID로 식별한다. Main push는 commit message, 수동 실행은 ref 이름이 표시되며 workflow `CI`와 required check 계약은 유지한다.
5. PR의 `.github/workflows/ci.yml` 결과를 공식 검증으로 사용한다. `quality`, `e2e`, `docker`가 모두 성공하기 전에는 Manager가 기능을 최종 ACCEPT하지 않는다.
6. 실패하면 GitHub run → job → step → 최초 오류를 근거로 원인을 분석한다. 로컬에서만 다시 PASS한 것은 원격 실패 해결 증거가 아니다.
7. PR이 merge되어 `main`에 반영되면 동일 `quality`/`e2e`/`docker` gate를 수행한다. 변경이 `docs/**` 또는 저장소 루트 Markdown만 포함하는 docs-only이면 `publish-commit-image`는 SKIPPED여야 하고, 비문서 파일이 하나라도 있거나 판정이 불가능하면 기존 registry gate가 실행되어야 한다.
8. `main` 완료 보고에는 대상 commit SHA와 CI 결과를 기록한다. 비문서 main push는 임시 GHCR `ci-<full SHA>` exact digest 검증 및 package 삭제 결과를 기록하고, docs-only main push는 변경 유형 판정 결과와 `publish-commit-image=SKIPPED/N/A`를 기록한다.
9. Release는 별도 Semantic Version workflow와 승인 절차를 따른다.

## 3. 로컬에서 기본적으로 반복하지 않는 항목

다음 항목은 GitHub-hosted runner에서 재현 가능한 한 매 코드 변경마다 로컬 전체 실행을 완료 조건으로 요구하지 않는다.

- 전체 Vitest suite
- 전체 Chromium Playwright E2E
- clean production Docker build
- container migration/readiness smoke
- native `better-sqlite3` write/restart persistence smoke
- production dependency audit
- GHCR publish/pull/digest smoke
- SBOM/provenance 생성 검증

단, 해당 영역 자체를 수정하거나 CI 실패를 재현하는 경우 담당 Agent가 로컬에서 선택적으로 실행할 수 있다. 로컬 검증은 GitHub Actions 검증을 대체하지 않는다.

## 4. GitHub Actions 책임

현재 `.github/workflows/ci.yml`을 다음 책임의 Source of Truth로 사용한다.

### Pull Request

- `contents: read` 기본 권한
- frozen `npm ci`
- release/version manifest 검사
- TypeScript typecheck
- ESLint
- Vitest
- production dependency audit
- Markdown link 검사
- Next.js production build
- Chromium Playwright E2E
- Docker image build와 content policy
- invalid production configuration fail-closed
- migration/readiness
- native SQLite access와 container restart persistence
- relocated Compose config/startup/recreate persistence
- `RESOURCE_CATALOG_ADMIN_PASSWORD` 누락 config fail-fast와 app 컨테이너 환경 전달
- 실제 Resource Catalog 관리자 인증 성공/거부 및 인증 요청 직후/재생성 후 로그의 비밀번호 원문 비노출
- 실패 시 Playwright report artifact

PR에서는 GHCR login/publish 또는 registry write를 수행하지 않는다.

### main push

PR과 동일한 `quality`/`e2e`/`docker` gate를 다시 수행한다. 별도 `classify_main_change` job은 push의 `before..head` 변경 파일을 판정하며, 모든 파일이 `docs/**` 또는 저장소 루트 Markdown이면 docs-only로 본다. 빈 diff, 기준 SHA 판정 불가, 비문서 파일 혼합은 fail-safe로 docs-only가 아니다.

비문서 main push에서만 다음 registry gate를 수행한다. docs-only main push에서는 `publish-commit-image` job 자체가 SKIPPED이며 `packages: write` job을 시작하지 않는다.

- 임시 `ci-<full SHA>` image를 GHCR에 게시
- 기존 동일 commit tag overwrite 거부
- BuildKit SBOM/provenance 생성
- build output의 exact digest를 다시 pull
- image policy/readiness 검증
- native SQLite restart persistence 검증
- Project/Task API persistence 및 authorization denial 검증
- 검증 완료 후 `ci-<full SHA>` package version 삭제

`main`의 로컬 PASS만으로 GHCR artifact를 정상으로 판정하지 않는다.

## 5. Agent 책임

- `frontend`, `backend`, `scheduler`, `excel_vba`: 구현 중 관련 로컬 fast feedback을 수행하고 원격 branch/PR 검증 대상으로 변경을 전달한다.
- `infra`: GitHub Actions run, workflow, runner, permission, cache, Docker/GHCR 문제를 담당한다. CI 실패 시 run/job/step 근거를 확보한다.
- `qa_docs`: 위험도 정책에서 독립 검토가 필수인 경우 구현자와 분리해 로컬/원격 증거를 검토한다. 도구가 없으면 승인된 별도 인간 Reviewer를 배정한다. 독립 QA 미선택은 조건부 N/A, 필수 Reviewer 부재는 BLOCKED, 원격 CI 미실행은 NOT TESTED로 구분한다.
- `Manager`: PR 원격 gate, 위험도별 QA_FINAL(필수 PASS 또는 N/A 근거), DOCUMENTATION_SYNC 및 필요한 환경 검증을 Head와 함께 확인한 뒤 ACCEPT/REWORK/REJECT/DEFER를 결정한다.

## 6. 완료 보고 최소 증거

코드 변경 완료 보고에는 가능한 경우 다음을 포함한다.

```text
Issue / PR:
Head commit SHA:
Local Fast Feedback: PASS | FAIL | NOT TESTED
GitHub quality: PASS | FAIL | BLOCKED | NOT TESTED
GitHub E2E: PASS | FAIL | BLOCKED | NOT TESTED
GitHub Docker smoke: PASS | FAIL | BLOCKED | NOT TESTED
risk_level / qa_required / risk_reason / reviewer / qa_final(PASS|FAIL|BLOCKED|NOT TESTED|N/A+reason):
Manager ACCEPT/REWORK/DEFER와 해당 Head·근거:
Main GHCR digest smoke: PASS | FAIL | BLOCKED | NOT TESTED | N/A
Environment-specific validation: PASS | FAIL | BLOCKED | NOT TESTED | N/A
Remaining risks:
```

GitHub Actions run이 아직 끝나지 않았으면 완료로 과대 표시하지 않는다.

## 7. 예외

GitHub-hosted runner가 접근할 수 없는 사내 시스템, Windows Excel/DRM, 실제 reverse proxy/TLS, 운영 storage/backup/restore, 사람이 판단해야 하는 UX는 로컬/대상 환경 검증으로 남긴다. 이러한 항목을 GitHub Actions에서 성공한 일반 테스트로 대체했다고 주장하지 않는다.

현재 repository에서 branch/ruleset 강제가 지원되지 않거나 활성화되지 않은 경우에도 위 workflow를 운영 규칙으로 적용한다. 보호 설정이 실제로 적용됐다고 가정하지 않는다.

## Repository layout relocation (#12)

현재 배포 경로와 기존 Compose 프로젝트/volume을 유지하는 전환 절차는 [REPOSITORY_STRUCTURE](REPOSITORY_STRUCTURE.md)를 따른다. Docker gate의 `scripts/verify-compose-smoke.sh`는 새 Compose 경로의 config/startup/readiness/restart/강제 recreate SQLite 보존과 함께 `RESOURCE_CATALOG_ADMIN_PASSWORD` 필수 전달 계약을 검증한다. 비밀번호 누락은 container 생성 전 config 단계에서 실패해야 하고, 설정된 값은 app 환경으로 전달되어 실제 관리자 인증의 정상 201/오류 401 동작을 만들어야 한다. 인증 요청 직후의 기존 container 로그와 강제 재생성 이후 로그 양쪽에서 정상/오류 입력 비밀번호 원문이 없어야 한다. 기존 quality/E2E/runtime/registry 권한·검증 gate는 유지하며, 결과는 해당 PR/run/head의 실제 증거로 판정한다.

## Test configuration relocation (#13)

설정은 `tests/config/vitest.config.ts`, `tests/config/playwright.config.ts`에 있다. `npm test`, `npm run test:e2e`는 그대로 사용한다. 직접 실행은 `npx vitest run --config tests/config/vitest.config.ts`, `npx playwright test --config tests/config/playwright.config.ts`로 지정한다. 설정 파일 기준 root/testDir/webServer.cwd를 사용하고 E2E DB `.data/playwright.sqlite3`, `.next-e2e`, `test-results/`는 루트 기준으로 유지한다. CI는 `node scripts/verify-test-discovery.mjs`로 루트/외부 cwd의 동일한 테스트 발견을 확인한 뒤 전체 테스트를 실행한다. 편집기에서 자동 발견되지 않으면 같은 설정 경로를 지정한다. 실제 Windows 편집기 UI 검증은 미실행이며 [배치 문서](REPOSITORY_STRUCTURE.md)를 함께 따른다.

## Issue #87 브랜치 정리 검증과 종료 Gate

Issue #87에서 사용한 고정 cleanup workflow는 Issue #124에서 퇴역했다. 현재 branch cleanup 검증/삭제 계약은 [공통 안전 cleanup 도구](../scripts/safe_branch_cleanup.py)와 [CI_CD.md](CI_CD.md) 9절을 따른다. 아래 표는 당시 PR #88 운영 정리 증거의 역사적 기록이다.

| 계층 | 실행과 필수 증거 |
| --- | --- |
| Local Fast Feedback | `python3 scripts/verify-issue-87-cleanup.py`; 실제 workflow inline 코드를 추출하여 모형 및 로컬 bare Git 검증 |
| PR cleanup validation | 해당 workflow/script 변경 PR에서 `Issue 87 브랜치 정리 안전 조건 검증` job PASS; contents:read, credential 미보존. 기존 quality/e2e/docker도 별도 모두 PASS |
| 실제 post-main cleanup | main push CI의 실제 merge SHA/attempt와 quality/e2e/docker/main GHCR 네 job success 확인 후 고정 branch의 SHA 조건부 삭제, 실제 ref 404와 run summary |

회귀 스크립트는 24개 API 모형 시나리오와 3개 실제 로컬 Git 시나리오를 포함한다. 정상·이미 없음·무관 run, CI/GHCR 미완료/실패/skipped, 저장소/event/path/attempt/SHA 불일치, squash/잘못된 merge parent, 보호/새 commit/다른 열린 PR 참조를 검증한다. Git 검증은 정상 삭제, 전송 전 stale tip, 서버 광고 이후 pre-receive 경합에서 새 tip 보존을 확인한다. 이 테스트와 토큰 인자/trace 비노출 확인은 실제 GitHub 삭제 PASS를 대신하지 않는다.

Manager는 PR #88에 `merge_method=merge`와 최종 expected_head_sha를 사용한다. squash/rebase는 지원하지 않으므로 임의로 ancestry gate를 제거하지 않는다. cleanup의 단일 삭제 refspec은 명시적 SHA lease를 사용하며 별도 GET 뒤 REST 무조건 DELETE로 fallback하지 않는다. 권한 부족·lease 실패·새 commit·누락 gate는 FAIL/BLOCKED로 남기고 강제 삭제하지 않는다.

infra는 main run/merge SHA, GHCR digest·smoke·package 정리, cleanup run과 최종 ref 404를 기록한다. 독립 검토가 이를 확인한 뒤 Manager가 종료를 판단한다. 다른 main run은 no-op이며 이미 없는 branch는 재삭제하지 않는다. 대상 이름을 재사용하지 않고 workflow 퇴역은 증거 보존 후 별도 검토된 운영 변경으로만 수행한다. 이번 완료 기준은 이 한정 절차를 일반 브랜치 자동 삭제나 제품 릴리스 승인으로 확대하지 않는다.

## Issue #76 원격 릴리스 검증

Issue #76의 제품 변경은 PR의 `quality/e2e/docker` PASS만으로 완료하지 않는다. 사용자 요청으로 정식 GHCR 게시가 승인된 범위이므로 아래 원격 증거를 모두 확인한다.

1. 최종 PR head SHA에서 `quality`, Chromium E2E, Docker smoke가 모두 PASS인지 확인한다.
2. PR 병합 후 실제 `main` merge SHA의 CI가 PASS인지 확인한다. `publish-commit-image`가 게시한 임시 `ci-<full SHA>` image의 exact digest pull/smoke와 package version 정리 결과를 같은 run에서 확인한다.
3. `v0.21.0` annotated tag가 실제 merge SHA를 가리키는지 확인한다.
4. `release-image.yml`은 `v0.21.0` ref로 실행하며, helper가 기록한 dispatch 시각 이후 생성되고 `head_branch=v0.21.0`, `head_sha=<merge SHA>`인 성공 run만 이번 정식 릴리스 PASS로 인정한다.
5. helper 재실행 시 tag가 이미 존재하면 동일 target의 성공 release run을 확인한 경우에만 release 단계를 skip하고 cleanup/Issue 종료를 재개할 수 있다. 성공 증거가 없는 기존 tag는 FAIL이다.
6. branch cleanup은 HTTP 404인 branch만 이미 없는 것으로 간주한다. API 401/403/429/5xx, 보호 branch, 열린 PR 참조, tip 변경, SHA lease 실패는 FAIL/BLOCKED이며 Issue를 닫지 않는다.
7. Issue #76 종료 댓글에는 버전, main CI URL, 정식 release run URL, 삭제/보존 branch를 기록한다.

Workflow 파일의 존재나 과거 성공 run은 현재 head의 PASS를 대신하지 않는다. release/tag/GHCR/branch cleanup/Issue 종료는 각 단계의 실제 GitHub 원격 증거로 판정한다.



## Issue #96 원격 릴리스 검증

Issue #96은 Task Editor UI 변경과 함께 사용자가 GHCR 정식 게시를 명시적으로 승인했으므로 아래 증거가 모두 확인되어야 완료다.

1. 최종 PR head에서 quality, Chromium E2E, Docker smoke가 모두 PASS이고 독립 Codex review의 unresolved finding이 없어야 한다.
2. merge 후 실제 `main` merge SHA의 CI가 completed/success여야 하며, 같은 run의 `publish-commit-image`가 임시 `ci-<full SHA>` 게시, exact digest 재다운로드/runtime smoke, SBOM/provenance, 임시 package cleanup을 완료해야 한다.
3. package version `0.21.1`과 annotated `v0.21.1` tag가 정확히 일치하고 tag가 실제 merge SHA를 가리켜야 한다.
4. 새 tag에서 `release-image.yml`은 `v0.21.1` ref로 dispatch하며, helper의 dispatch 시각 이후 생성되고 `head_branch=v0.21.1`, `head_sha=<merge SHA>`, completed/success인 run만 정식 게시 PASS로 인정한다.
5. helper 재실행 시 기존 tag가 같은 target을 가리키고 동일 tag/head SHA의 성공 release run이 있는 경우에만 publish를 반복하지 않고 cleanup/Issue 종료를 재개한다.
6. PR #98은 **merge commit 방식**으로 병합해야 하며 squash/rebase merge는 허용하지 않는다. branch cleanup은 target SHA가 2개 이상의 parent를 가진 merge commit이고 `TARGET_SHA^2 == 작업 branch tip SHA`임을 확인한 뒤, 열린 PR 참조가 없고 현재 tip이 merge target의 ancestor이며 삭제 직전 SHA가 재검증된 경우에만 explicit SHA lease로 수행한다. 새 commit, lease 불일치, API 오류는 FAIL/BLOCKED다.
7. Issue #96 완료 댓글에 version, main CI/임시 GHCR 검증 URL, 정식 release run URL, tag, branch cleanup 결과를 기록한 뒤 completed로 닫는다.

Workflow 파일의 존재나 과거 run은 현재 target SHA의 PASS를 대신하지 않는다. GHCR 게시 성공은 운영 환경 배포 완료를 의미하지 않는다.


## Issue #84 원격 릴리스 검증

Issue #84는 PR #114에서 기능·테스트·Documentation Sync를 완료하고, 사용자가 GHCR 정식 게시까지 명시적으로 요청한 범위다. 완료 판정은 다음 원격 증거를 모두 요구한다.

1. helper는 기능 PR #114의 **exact final head SHA**에 대한 `ci.yml` pull_request run이 completed/success인지 확인하고, 동일 exact head를 검토한 공식 `chatgpt-codex-connector` review node 또는 공식 `chatgpt-codex-connector[bot]`의 `codex-pull-request-review-summary` Completed 증거가 존재하며 unresolved review thread가 0건인지 검증한다. PR CI run의 `pull_requests` 배열은 증거로 요구하지 않는다. 대신 PR API에서 exact head SHA·head branch·head repository·base를 확인하고, 동일 source tuple에 해당하는 PR이 대상 PR 하나뿐인지 확인한다. 그 후 `event=pull_request`의 `ci.yml` run에서 exact head SHA + head branch + head repository + repository를 모두 대조해 대상 PR의 CI 증거로 결속한다.
2. PR #114 merge 뒤 실제 feature merge SHA의 main push CI가 completed/success인지 별도로 확인한다. 이 run 성공은 quality/E2E/Docker뿐 아니라 임시 `ci-<full SHA>` 게시 → exact digest pull/runtime smoke → package version cleanup까지 성공했음을 의미해야 한다.
3. 릴리스 마무리 helper는 자기 `TARGET_SHA`를 만든 merged PR을 확인한 뒤, 해당 PR latest head의 exact SHA·head branch·head repository·base와 source PR uniqueness를 확인한 뒤, 동일 SHA/branch/repository tuple의 `ci.yml` pull_request run이 completed/success인지 검증한다. 또한 그 exact head에 대한 공식 Codex identity exact-match review node 또는 Completed review summary 증거가 존재하고 unresolved review thread가 0건이어야 한다. 직접 main push나 review/CI 우회 병합은 release Gate를 통과할 수 없다.
4. package version `0.25.0`과 annotated `v0.25.0` tag가 정확히 일치하고 tag가 release target main SHA를 가리켜야 한다.
5. 새 tag에서만 `release-image.yml`을 dispatch한다. 실행 시작 전에 tag가 이미 존재한다면 동일 tag/head SHA의 completed/success release run이 있는 경우에만 publish를 반복하지 않고 후속 cleanup/Issue 종료를 재개한다. **기존 tag만 있고 성공 release 증거가 없으면 FAIL**이며 동일 version/tag를 재사용하지 않는다.
6. 작업 branch와 release-finalization branch 삭제 전 현재 remote tip이 해당 merged PR의 recorded head SHA와 동일한지 확인하고, merge commit이 release target의 ancestor인지와 열린 head/base PR 부재를 확인한다. 마지막 삭제는 explicit SHA lease를 사용한다. 새 commit/race/API 오류가 있으면 삭제하지 않고 FAIL/BLOCKED로 남긴다.
7. 정식 release workflow의 exact SemVer image digest 재다운로드/runtime smoke와 stable alias promotion 결과를 실제 run/job 증거로 확인한다.
8. Issue #84 완료 댓글에 기능/릴리스 PR, version, main CI, 정식 release run, tag, branch cleanup 결과를 남긴 뒤 completed로 닫는다.

Workflow 파일 존재나 과거 다른 version의 성공 run은 현재 `v0.25.0` release 성공 증거를 대신하지 않는다. GitHub-hosted 검증은 최종 수동 UX/실제 사내 reverse proxy 등 환경별 검증을 자동으로 완료한 것으로 간주하지 않는다.


## Issue #118 구현 전후 원격 증거

#118의 동일 fixture 구현 전/후 높이·screenshot 증거는 완료된 기능의 **historical evidence**다. 일반 PR에서는 자동 실행하거나 required check로 기다리지 않으며, 재현이 필요한 경우에만 `Issue #118 구현 전후 레이아웃 증거` Workflow를 `workflow_dispatch`로 실행한다.

1. 재현이 필요하면 검토할 ref를 명시해 수동 실행하고 해당 run의 ref/head SHA를 기록한다.
2. 비교 revision은 Before `703a6f08595dea06a918366192df464d7215108e`, After `6386db860af69635cfb0fe626fd1a937905b9a56`로 고정하며 두 revision에 선택한 workflow ref의 동일 harness를 사용한다.
3. viewport는 390×844, 768×844, 1024×844, 1440×844이며 editing/readonly 모두 같은 mock Project/Task 데이터를 사용한다.
4. 390/768의 각 상태에서 Gantt 가시 높이 delta가 양수이고 After의 document horizontal overflow가 없으며 정보 컨트롤이 한 줄이어야 PASS다.
5. `issue-118-before-after-evidence` artifact에 raw metrics, comparison JSON, Markdown 요약, 각 viewport/state의 before/after screenshot이 존재하는지 확인한다.
6. 이 historical evidence는 현재 PR의 일반 `CI` quality/e2e/docker나 main 검증을 대체하지 않으며, 실제 모바일 기기·스크린리더 수동 검증을 완료한 것으로 해석하지 않는다.

## Issue Lifecycle 원격 검증 (#211)

`.github/workflows/issue-lifecycle.yml`의 `verify`는 비파괴 원격 integration 검증 수단이다. 다음을 같은 실행에서 확인한다: Issue/PR identity, same-repository `main` PR, `Refs #N`, PR final head required checks, merge SHA의 main ancestry, manifest/lock version, exact merge SHA의 main `ci.yml` run.

범용 workflow 자체가 main에 병합되기 전에는 실제 `workflow_dispatch verify` 증거를 만들 수 없으므로 PR 단계에서는 `scripts/verify-issue-lifecycle.py`의 contract/scenario test와 일반 PR quality/e2e/docker를 사용한다. 병합 후 대표 merged Issue/PR에 대해 non-destructive verify 실행을 별도 evidence로 확보한 다음 기존 helper migration을 진행한다.


## CI 성능 최적화 원격 검증 (#250)

최적화된 `.github/workflows/ci.yml`은 required check 이름을 변경하지 않는다. 원격 판정 시 다음을 확인한다.

1. `변경 경로 판정` 이후 policy/typecheck/lint/unit/build, E2E shard, Docker smoke가 불필요한 `needs` 직렬화 없이 병렬 시작되는지 확인한다.
2. 코드/E2E 영향 변경에서는 `Chromium E2E shard 1/4`~`4/4`가 모두 실행되고 aggregate `Chromium end-to-end tests`가 shard 결과를 fail-closed로 집계하는지 확인한다.
3. docs-only 변경에서는 heavy implementation job이 SKIPPED여도 기존 세 required aggregate check가 SUCCESS인지 확인한다.
4. `Next.js production build`의 `.next/cache`, TypeScript incremental cache, npm package cache, Docker BuildKit GHA cache restore/save 로그를 확인한다.
5. PR은 `packages: write`를 받지 않으며 main 비문서 push만 기존 임시 GHCR publish/digest smoke/cleanup을 수행한다.
6. 최적화 효과는 변경 전 기준 run #995의 wall-clock(quality 약 1분 36초, Docker 약 3분 30초, E2E 약 18분 45초)과 동일·유사 변경의 새 PR run을 비교한다.

## Generic Release Finalizer 원격 검증 (#350)

PR 단계에서는 `scripts/verify-issue-lifecycle.py`가 trigger/filter, exact mapping, authorization parser, concurrency, legacy workflow 부재를 정적으로 검증한다. 동일 PR head SHA를 재실행한 경우에는 `/commits/{sha}/check-runs`에 이전 실패/cancelled check와 최신 성공 check가 함께 존재할 수 있으므로, required check 이름별 **가장 큰 check-run ID**가 실제 최신 결과인지 확인한다. 오래된 실패가 최신 성공을 덮어쓰거나 오래된 성공이 최신 실패를 가리는 판정은 FAIL이다. 순수 scenario test는 `older failure + newer success → PASS`, `newer failure + older success → fail-closed`를 모두 고정한다.

Migration merge 이후에는 exact main CI 완료 뒤 다음 원격 증거를 확인한다.

- Generic Release Finalizer run이 정확히 1개 생성됨
- 삭제된 Issue별 helper/finalizer run이 새로 생성되지 않음
- no-release merge는 `finalize`만 수행
- release-required merge는 승인 marker가 없으면 BLOCKED
- 승인된 release는 exact `release-image.yml` 및 digest evidence 뒤 finalize
- 근접한 여러 merge의 CI 완료 순서가 뒤집혀도 current main first-parent backlog를 oldest → newest로 처리하며 queue burst에서도 target이 유실되지 않음

실패 후에는 원인을 제거하고 기존 failed run/job 재실행을 우선한다.

## Main 임시 GHCR evidence 원격 검증 (#352)

비문서 main merge에서는 exact SHA의 main CI에서 다음을 서로 분리해 확인한다.

1. required aggregate checks가 SUCCESS.
2. `Main 임시 commit 이미지 게시·검증·정리` job이 실제로 생성되어 SUCCESS.
3. Generic Finalizer가 위 artifact job evidence를 PASS로 읽은 뒤에만 lifecycle mutation을 수행.
4. docs-only merge에서는 artifact job SKIPPED와 lifecycle의 `N/A — docs-only` evidence가 일치.

Optional shard/implementation job의 SKIPPED가 있어도 aggregate required checks가 SUCCESS이면 비문서 main artifact job이 skip propagation으로 누락되지 않아야 한다.

## Release completion Resume 원격 검증 (#446)

PR 단계에서는 `scripts/verify-issue-lifecycle.py`로 다음 정적 계약을 확인한다.

- release publish success 뒤 `release-finalizer-resume.yml/dispatches`를 explicit `workflow_dispatch`한다.
- dispatch input은 exact release target `target_sha`와 source `release_run_id`다.
- explicit Resume은 Actions API에서 exact source run의 `completed/success`, `.github/workflows/release-image.yml`, `head_sha == target_sha`를 확인한 뒤 resolver를 실행한다.
- Resume workflow는 기존 `Publish release image workflow_run.completed` fallback을 유지한다.
- Resume은 triggering tag/manual ref가 아니라 trusted `main`을 checkout한다.
- post-publication handoff는 non-blocking이며 required release validation/promotion gate를 대체하지 않는다.

병합 후에는 Main CI SUCCESS가 Generic Finalizer backlog를 재평가하는지 확인하고, 이미 성공한 release가 pending인 경우 `release_finalize`가 branch cleanup → FINAL marker → Issue close를 수행하는지 실제 Issue/branch 상태로 판정한다. 다음 실제 release부터는 publish 성공 후 explicit Resume run 생성 여부를 별도 원격 evidence로 확인한다.

## exact main CI SHA binding (#354)

Lifecycle의 exact main CI 조회는 repository의 최근 run 목록을 넓게 가져와 client-side에서 추정하지 않는다. GitHub Actions workflow-runs API에 `head_sha=<merge SHA>`를 직접 전달하고, 반환된 run에서도 `head_sha`가 target과 일치하는지 다시 검증한다. 이후 같은 exact run의 latest attempt jobs에서 main 임시 GHCR artifact evidence를 확인한다.

다른 SHA의 성공 run, head_sha binding 없는 최근 run 목록, overall CI success만으로 lifecycle mutation을 허용하지 않는다.


## Issue #508 E2E 샤드 최적화 원격 검증

Issue #508은 제품 required check 자체가 아니라 `.github/workflows/e2e-shard-optimizer.yml`의 운영 경로를 수정하므로 정적 계약과 실제 optimizer run 증거를 구분한다.

- PR 단계에서는 exact head의 `quality`/`e2e`/`docker` SUCCESS로 helper Unit test와 workflow contract regression이 통과했는지 확인한다. 이 결과만으로 scheduled optimizer의 실제 GitHub CLI 조회나 artifact 업로드를 실행했다고 보고하지 않는다.
- optimizer의 실제 원격 실행에서는 `median/LPT 분석` 후 `e2e-shard-proposal.json`이 `e2e-shard-optimizer-proposal` artifact로 생성되고 30일 보존되는지 확인한다. hidden file 업로드 옵션에 의존하는 결과는 PASS 근거로 사용하지 않는다.
- `shouldUpdate=false`이면 `기존 최적화 PR 확인`과 `샤드 계획 자동 PR 생성`이 모두 SKIPPED인 no-op success를 확인한다.
- `shouldUpdate=true`이면 기존 자동 PR 조회 단계가 Bash syntax error 없이 실행되어야 한다. exact title `[Issue #437] ci: E2E 샤드 계획 갱신` PR이 이미 열려 있으면 해당 번호를 반환하고 새 PR을 생성하지 않는다.
- 기존 exact-title PR이 없을 때만 새 `ci/issue-437-e2e-shard-plan-<run id>` branch/PR 생성과 exact branch의 `ci.yml workflow_dispatch` 등록을 확인한다. 자동 merge, required checks/ruleset 완화, shard 수/threshold 변경은 허용하지 않는다.
- 위 `shouldUpdate=true` 분기는 historical timing threshold가 실제 충족된 run에서만 원격 PASS로 판정한다. 조건을 임의로 낮추거나 테스트용 중복 PR을 만들어 증거를 조작하지 않는다.


## Issue #439 setup/cache 성능 원격 검증

| 구분 | 원격 증거 | 판정 |
| --- | --- | --- |
| PR/Main Node setup | build/E2E artifact JSONL + Step Summary | checkout/setup-node/npm cache/npm ci duration과 exact cache hit 분포 |
| PR/Main Playwright | E2E artifact JSONL + E2E timing JSON | OS deps/headless-shell duration, `runnerReadyMs`; browser cache는 Phase 1에서 비활성 |
| Build cache | build JSONL + Step Summary | Next cache restore duration/exact hit; miss에서도 production build 실행 |
| Docker | Docker/Main image JSONL + BuildKit summary | Buildx setup/build-push elapsed; GHA layer cache는 summary/log 보조 근거 |
| Release | static/E2E/candidate setup JSONL | PR/Main과 동일 metric 이름·schema로 비교 |

before/after 개선은 workflow 파일/event/job/metric별로 **서로 다른 successful run ID가 최소 10개** 쌓이기 전에는 확정하지 않는다. successful run artifact만 분석 입력으로 사용하며 matrix shard와 동일 run의 재실행은 record는 늘려도 run 표본 수는 늘리지 않는다. Phase 2 변경 후에도 같은 그룹 키와 metric 정의로 median/p90을 재측정한다.


## Issue #452 Main candidate lifecycle handoff 회귀

- successful non-docs Main CI는 verified `ci-<merge SHA>`를 build/push·exact digest smoke한 뒤 Main job 안에서 삭제하지 않는다.
- Generic `release-finalizer.yml`과 `release-finalizer-resume.yml`은 no-release backlog cleanup을 위해 최소 `packages: write` 권한을 가지며, PR/일반 CI에는 registry write 권한을 추가하지 않는다.
- `release_required=false` finalize는 `scripts/delete-ghcr-package-version-by-tag.mjs ci-<merge SHA>`를 사용해 exact temporary package version만 삭제한다. tag가 없으면 idempotent no-op, 다른 tag와 package version을 공유하면 fail-closed한다.
- release-required candidate는 formal release source이므로 finalize 전 삭제하지 않는다. Release workflow는 container를 재-build하지 않고 candidate exact digest를 재검증·promotion한다.
- 회귀 재현 기준: v0.83.4 Run #133.1은 Main #1852에서 검증한 `ci-e812...`가 version-maintaining cleanup으로 삭제되어 candidate lookup이 실패했다. corrective v0.85.1에서는 Main candidate가 Finalizer까지 존재해야 한다.


## 동일 exact Main SHA 중복 실행 복구 (#520)

같은 merge SHA에 push Main CI가 둘 이상 존재할 때 단순 created_at 최신 run 하나만 선택하지 않는다.

1. exact SHA가 일치하는 run만 후보로 한다.
2. completed/success run 중 변경 유형에 맞는 main artifact gate까지 유효한 run을 찾는다.
3. 조건을 만족하는 후보 중 최신 run을 lifecycle evidence로 사용한다.
4. 후보가 없으면 최신 exact-SHA run URL과 artifact 상태를 진단 근거로 남기고 release/finalize mutation을 금지한다.
5. PR required check의 latest-check-run 정책은 별도이며 이 규칙으로 완화하지 않는다.

회귀 사례: #502 merge SHA의 Main #2083.1은 quality/e2e/docker 및 temporary GHCR exact digest smoke가 모두 SUCCESS였고, 뒤따른 #2084.1은 동일 immutable `ci-<SHA>` overwrite 거부로 artifact job만 실패했다. #520 이후 lifecycle은 #2083.1의 성공 evidence를 재사용하되 #2084.1 FAILURE 자체는 역사적 기록으로 유지한다.

## Issue #487 — Chromium E2E timeout 및 Playwright mirror 복구

PR #488 Run #2089.1 (`37637832069`)에서 Chromium shard 4/6이 25분 job timeout으로 취소됐고 E2E aggregate가 FAIL했다. 보완된 Run #2094.1 (`37671573154`)은 6개 Chromium shard 모두 PASS했으나, 신규 `test-config-layout`의 정규식 이스케이프 오류 1건으로 Vitest FAIL이 발생했고 Docker smoke는 Playwright OS dependency Ubuntu Azure mirror 설치 지연으로 30분 job ceiling에서 취소됐다. PR 본문 edit로 생성된 metadata-only Run #2095.1은 동일 head의 전체 CI PASS 근거가 없으므로 연쇄 실패했다.

최신 main 기반 PR은 현재 schedule popup selector와 bounded poll을 함께 보존한다. CI 및 Release E2E shard timeout은 35분, Docker smoke는 40분이고, OS deps 설치는 6분 제한 및 Azure archive 장애 시 공식 Ubuntu archive로 제한적 재시도 1회를 수행한다. 계측 시작이 생략되면 빈 started_ms를 기록하지 않는다. shard 6개, workers=1, 기존 geometry/focus assertion, error/aggregate fail-closed 및 Docker baseline/runtime/transport/Compose smoke를 생략하지 않는다. 새 exact-head PR CI에서 quality/E2E/Docker required checks의 실제 PASS를 검증해야 한다. Release/GHCR 게시·병합·Issue 종료는 별도 승인 절차다.


### #487 PR CI #2191.1 — Ubuntu 24.04 mirror+file fallback 탐지 회귀

PR head `ec2add4f277dc6fd7bf6f60372c611ff1cd19c8a`의 PR CI [#2191.1](https://github.com/planner77/masterGantt/actions/runs/37781591645)에서 policy/typecheck/lint/unit/build/Docker 및 Chromium shard 1/3/4/6은 PASS했으나 shard 2/5가 Playwright OS deps 360초 제한 후 exit 124로 FAIL했다. 두 shard 로그의 `file:/etc/apt/apt-mirrors.txt Mirrorlist` / `azure.archive.ubuntu.com` 기록은 Ubuntu runner가 deb822 `ubuntu.sources`에서 `mirror+file` 간접 참조를 사용함을 보인다. 기존 fallback은 `sources.list`, `*.sources`, `*.list`만 검사하여 간접 참조 대상 자체를 검사하지 않아 `no Azure mirror fallback available`로 중단됐다.

보완은 동일한 Azure URL 탐지 및 공식 Ubuntu archive 치환 대상으로 `/etc/apt/apt-mirrors.txt`를 포함한다. 기존 Chromium 6-shard, `workers=1`, assertion, E2E timeout 35분, Docker timeout 40분, 각 OS deps 설치 시도 360초 상한과 실패 시 fail-closed, setup metrics guard는 유지한다. 독립된 `tests/scripts/test-config-layout.test.ts` 정적 회귀는 runner mirror list 경로·검사·치환 계약을 확인한다. 새 exact-head PR CI에서 전체 E2E 및 Docker 필수 gate PASS를 확인해야 하며 #2191.1 실패 결과를 성공으로 간주하지 않는다.


### #487 Codex P1 — 공용 Playwright setup 호출자별 timeout 예산

PR #488의 exact head `252216fa6757cd9ecaa40263e16d4dfc46238aa4`에 대한 Codex 재검토에서 P1 지적: OS deps의 360초 timeout + Azure→Ubuntu archive fallback 최대 2회(약 12분 20초)에도 `.github/workflows/ci.yml`의 `publish-commit-image`는 job 30분, `.github/workflows/release-image.yml`의 `container`는 20분이었다. 이 두 main/release job은 GHCR digest pull/build·transport·runtime/persistence 추가 검증이 필수여서 setup 지연 시 검증 전에 강제 취소될 위험이 있다.

보완: Main `publish-commit-image` timeout 50분, Release `container` timeout 40분으로 조정한다. 기존 CI/Release Chromium E2E 35분, Docker smoke 40분, shared action 두 시도 각 360초 제한, 실패 후 최대 1회 retry 및 non-zero fail-closed, required aggregate와 GHCR exact digest/transport/runtime/persistence 검사 내용은 그대로 유지한다. `tests/scripts/test-config-layout.test.ts`에 두 job의 timeout 값 검증을 추가했다. 새 exact-head PR CI는 수정 사항의 PR quality/E2E/Docker를 검증하며, main image/Release 실제 경로는 병합 뒤 main 및 별도 승인 release 증거로 판단한다.

## Issue #487 — 병합 후 Main CI #2203.1 Playwright APT lock 복구

- 기존 [PR #488](https://github.com/planner77/masterGantt/pull/488)은 `08ac7749efc4544dfc125853d9e58ef3a9d56b21`로 병합됐다. 정확한 Main CI [#2203.1](https://github.com/planner77/masterGantt/actions/runs/37793380955)에서 Quality/Docker 및 E2E shard 2~6 PASS, shard 1/6 FAIL, E2E aggregate FAIL, Main 임시 GHCR publish SKIPPED가 확인됐다.
- shard 1/6 로그: 첫 `playwright install-deps chromium` 360초 timeout (exit 124) 뒤 공식 Ubuntu archive로 재시도했으나 `/var/lib/apt/lists/lock`을 이전 `apt-get` PID 2593이 점유해 `Unable to lock directory` / exit 100. 외부 네트워크 불안정 자체와 **프로세스 간 APT 재시도 경합**을 구분한다.
- 후속 수정은 Azure `mirror+file`/legacy source를 첫 설치 전에 공식 Ubuntu archive로 정규화하고, APT network timeout(45초)·retries(1회)로 자식 APT 지연을 제한하며, 실패 시 활성 lists/dpkg 잠금을 `fuser`로 최대 60초 감시하여 해제 확인 후에만 Playwright 1회 retry한다. 잠금이 유지되면 명시적으로 FAIL하고 kill/검증 skip으로 통과시키지 않는다.
- 정적 회귀에서 미러 정규화가 첫 설치보다 앞서 수행되고 lock 감시가 retry보다 앞서는 실행 순서와 fail-closed 경계를 고정한다. 실제 검증은 새로운 후속 PR exact-head required quality/E2E 6 shard/Docker와 병합 뒤 새 merge SHA의 Main CI, 임시 GHCR `ci-<SHA>` image publish/exact digest pull/runtime/transport/persistence/SBOM·provenance, Generic Finalizer 결과로 분리한다.
- 후속 PR 이전 Main #2203.1의 실패 결과는 불변이다. 관련 제품 API/DB/domain/version은 바꾸지 않는다.

## Issue #541 자동 PR 권한 오류 원격 검증

- 원 실행 [E2E 샤드 최적화 #10.1](https://github.com/planner77/masterGantt/actions/runs/37706501705)에서 timing 분석/plan proposal artifact/기존 PR 조회/branch push는 PASS, 자동 PR 생성은 GitHub repository permission restriction으로 FAIL이다. 기존 #508의 shell quoting/artifact 문제와 구별한다.
- PR CI에서는 변경된 workflow에 `gh pr create` 실패 감지, BLOCKED Step Summary, head SHA/수동 PR 복구 링크 및 비정상 exit 조건이 존재하는지 정적 회귀로 확인한다. PR 자동 생성과 수동 복구 안내는 **같은 제목 변수**를 사용하며, Summary에 제목 및 `Refs #437`가 정확히 한 번 포함된 본문 원문을 명시해야 한다. 이 정보가 없는 compare URL만으로는 중복 PR 방지·Issue Lifecycle 추적을 검증하지 못한다.
- 권한 차단 분기의 실제 원격 검증에는 같은 저장소 설정으로 새로운 `shouldUpdate=true` 재균형 후보가 있어야 한다. 기존 PR이 이미 열려있으면 해당 분기가 skip되므로 실제 권한 오류 재현 PASS로 과대 보고하지 않는다.
- 자동 PR 생성이 차단된 상태에서 실제 plan은 브랜치에 보존되고 PR #540을 통해 별도 검증할 수 있다. 추가 token 생성, 저장소 PR 생성 허용 설정 변경, required checks 완화는 권한 있는 maintainer의 명시적 승인 없이는 진행하지 않는다.
- PR #540의 최초 PR CI #2124는 aggregate E2E status가 SUCCESS이지만 Chromium 6-shard job은 SKIPPED다. 이 실행을 계획 변경에 대한 실제 E2E PASS로 사용하지 않는다. `ci.yml`의 E2E 경로 필터에 shard plan JSON과 planner script를 추가하여 새 head의 PR CI에서 실제 6-shard 실행을 요구한다.
- 저장소 설정이 승인 후 변경되었다면 후속 신규 plan 생성 시 PR 생성과 exact head `ci.yml workflow_dispatch`를 확인한다. 생성 실패를 워크플로 성공으로 처리하지 않는다.

### Issue #541 — main 정렬 후 재검증

- 2026-10-09 기준 #542에 최신 main `4f2d8d084c011a33a3fbd633695f97f4b4ec5893`를 병합했다. #463 수평 스크롤 실패는 주간 timeline의 실제 120px scroll buffer가 준비됐는지 확인한 후 기존 정확한 viewport 120px 불변식을 검사하도록 보완했다.
- 새로운 PR CI의 실행 SHA가 갱신된 PR head와 동일한지 반드시 확인한다. 이전 SHA `ca6312ce2c53bb9ad4e11b8e959bcc6963f108a9`의 재실행은 새 변경에 대한 증거가 아니다.


## Issue #577 — Metadata/Full CI 원격 회귀

PR #577에서 M1~M8 검증 시 `[전체 검증]`/ `[메타데이터 검증]` run-name, 이벤트/action, 이벤트 Head/current Head, same-SHA full-run ID, quality/E2E/Docker required check, 실행시간을 함께 기록한다. 현재 Head 변경으로 stale인 메타데이터는 즉시 `SUPERSEDED`여야 하며 20분 polling이 없어야 한다. metadata-only run이 full CI를 취소하면 FAIL. 현재 full-run pending/missing은 NOT TESTED 또는 FAIL이고 자동 PASS가 아니다. metadata-only 실패 뒤 full CI가 성공하면 해당 metadata 실패 Job 재실행으로 재판정하되 본 PR CI 시작 범위에서는 관측·리허설을 별도 기록한다. CI 변경 PR은 E2E/Docker 경로 판정에 포함되므로 실제 PR에서 세 필수 Gate를 모두 확인한다.


### Issue #586 원격 검증 경계

동일 Issue의 각 PR/merge SHA에 대응하는 PR required check, Main CI, GHCR candidate gate, FINAL comment와 branch 404를 개별 연결한다. 선행 FINAL이 존재하거나 Issue가 CLOSED라고 후속 성공·잔여 candidate cleanup을 주장하지 않는다. 사전 검증·로컬 모형 PASS와 실제 GitHub Workflow/GHCR 결과는 구분한다. 본 변경의 운영 복구는 배포 후 별도 실행한다.

## Issue #586 후속 Main CI·Finalizer 원격 검증 (2026-10-11)

과거 PR #588 merge SHA 490c4ab70b0868729c8415f9f613bd45aa84926a / Main CI Run 38094304911 FAIL, candidate GHCR/Finalizer SKIPPED. 동일 SHA의 이전 이력은 불변이다.

교정 PR exact HEAD의 Required Quality/E2E/Docker PASS 및 Owner-managed QA는 새 원격 Run으로 검증한다. scripts/main_ci_run_name.py의 JSON payload helper와 실패 멀티라인 입력 차단을 Python 회귀로 검증하고, 병합 요청에서 한 줄 title + 빈 body + Head lease를 직접 전달한다.

교정 SHA Main CI push SUCCESS, ci-<exact SHA> digest smoke/SBOM/provenance, Generic Finalizer의 SUPERSEDED ATTEMPT 및 실패 SHA/교정 SHA 대응, 두 PR 브랜치 cleanup, final marker와 Issue 상태를 구분하여 확인한다. 기존 #565의 타 tag·공유 GHCR 이미지 삭제·정식 Release는 금지한다.


#### Connector / REST head lease 경계 (Codex P2 후속)

GitHub 연결 도구의 merge_pull_request 입력은 expected_head_sha이며, GitHub REST /pulls/{number}/merge POST는 sha이다. --as-merge-payload의 기본 --merge-api connector는 expected_head_sha를 출력하고 --merge-api rest는 sha를 출력한다. 동일 요청에 두 필드를 섞지 않는다. 각각 body=""와 merge_method=merge, canonical title을 유지하고, 잘못된 대상 값은 거부한다. 해당 양쪽 CLI·helper 회귀를 추가했다.
