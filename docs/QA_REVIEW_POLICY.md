## Issue #593 — Trusted QA 원본 이벤트 귀속 및 metadata 재검증 (2026-10-10)

- `workflow_run.pull_requests=[]`를 PR 실행명/제목에서 추측하지 않는다. 원본 `CI`의 PR 이벤트에서 **checkout 전에** 만든 `ci-pr-source-<run_id>-<attempt>` artifact를 기본 브랜치 검증기가 읽기 전용으로 조회한다. Artifact 자체는 PR 측 비신뢰 자료이며 스키마/repository/run ID·attempt/Head SHA·branch/base SHA/test merge SHA와 현재 PR 및 commit→PR GitHub API의 단일 귀속을 교차 확인한다. zip을 실행하거나 PR 코드를 checkout하지 않는다.
- artifact가 없거나 만료·중복되거나 commit→PR 조회가 비어 있거나 여러 PR에 귀속되거나, Head/base/merge/attempt가 바뀌면 **BLOCKED**한다. 이전 성공을 재사용할 때도 동일 **PR + Head + base + test merge + 최신 full run attempt**와 세 Required Aggregate의 완료 성공을 확인한다. 잘못된 canonical title/Refs는 자동 수정·우회하지 않는다.
- `CI` Workflow의 existing required `Build, static checks, and unit tests` / `Chromium end-to-end tests` / `Docker build and runtime smoke test`, full/metadata concurrency, 6-shard E2E, main/GHCR/Finalizer 및 write 권한·Ruleset은 유지한다. `QA Final — Trusted`는 기본 브랜치 SHA의 **운영상 수동 Gate**이며 PR Head Ruleset check가 아니다.
- `automated_qa=PASS`는 정확한 구조·provenance 검사 결과이지 독립 의미/업무 QA·Manager ACCEPT가 아니다. `manager_decision=NOT TESTED`인 동안 `MERGE_READY=BLOCKED`. `AGENT`/protected 변경에는 실제 별도 독립 Reviewer가 필요하며 HIGH는 Manager의 범위별 위험 수용이 필요하다.
- **실증 경계:** #593 자체가 검증기/CI 정책을 변경하므로 `HIGH/AGENT`; 이번 PR은 자기 Trusted PASS로 병합하지 않는다. 별도 독립 QA·Manager 결정 및 main 병합 이후 새로운 비보호 검증 PR을 통해 T1 정상 Trusted PASS/run URL·run_attempt·Head/base/merge·validator SHA 실증을 완료한다. 실증 전 T1/T2는 `NOT TESTED`. 이전 #580 Main CI/Finalizer 성공은 유지한다. #396 canonical 오류/빈 PR 귀속과 #591 원본 CI FAIL을 구별한다.
- 운영: [ISSUE_593 Work Packet](exec-plans/active/ISSUE_593.md)과 [원격 검증](REMOTE_VALIDATION.md) T1~T9를 참조. 원본 run 결론 FAIL은 `FAIL`, 불충분한 출처는 `BLOCKED`, 낡은 PR event는 `SUPERSEDED/N/A`; skipped를 필요한 검증의 PASS로 사용하지 않는다. 실패한 metadata-only는 유효한 full CI 이후 해당 job 재실행으로 복구하며, run/attempt/총 실행 수·runner 비용 비교는 실제 Actions에서 측정한다.

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

# Risk-based QA Final / Merge Review Policy (#565)

적용 대상: masterGantt의 신규 Issue/PR 전체. **이 정책을 담은 PR이 main에 병합된 시점부터 신규 작업에 기본 적용**하고, 이미 진행 중인 Issue에는 Manager가 전환 사실과 위험 분류를 Issue/PR에 명시한 뒤 적용한다. 과거 병합·QA 판정을 소급 변경하거나 기존 BLOCKED를 근거 없이 PASS로 바꾸지 않는다.

## 1. 목적·권한 경계

- **Risk-based QA**는 독립 QA의 필요성을 위험에 비례해 결정하는 *Manager의 운영 정책*이다. GitHub의 required status check를 줄이는 기능이 아니다.
- 현재 GitHub `main-lifecycle-gate` Ruleset은 `required_approving_review_count=0`이며, required aggregate check는 `Build, static checks, and unit tests`, `Chromium end-to-end tests`, `Docker build and runtime smoke test` 세 개다. 실제 리뷰 스레드 해결과 최신 main 정렬은 필수지만, Ruleset의 리뷰 승인 0명을 독립 QA 승인이라고 부르지 않는다. 실행 시 최신 Ruleset 상태를 재확인한다.
- 독립 `qa_docs` 실행은 런타임이 실제 지원할 때만 증명할 수 있다. 별도 실행 ID/실제 검토 결과 없이 동일 Manager의 순차 검토를 독립 QA PASS로 선언하지 않는다.
- **후속 #580**은 독립 Agent 부재 시 `GitHub Actions QA Final — Automated + Manager ACCEPT`를 공식 대체 경로로 만드는 별도 구현이다. #565 자체에는 자동 QA Job·Ruleset·릴리스 경로 변경이 없다. **#580이 실제 구현·검증·병합되기 전에는 자동 QA PASS만으로 HIGH 독립 검토 요건을 대체하지 않는다.** #580이 채택되면 이 문서의 HIGH 대체 절차와 연계 지침을 같은 PR에서 재정합한다.

## 2. 결정 순서와 위험도

PLAN 단계에서 변경 파일·사용자 영향·보안/데이터/운영 영향·기존 회귀 이력·실제 검토 주체를 확인한다. **HIGH 트리거부터 먼저 검사하고, 해당 없으면 MEDIUM, 두 위험도 모두 해당하지 않고 LOW 근거가 분명할 때만 LOW**로 판정한다. 범위가 불명확하면 HIGH(잠정)를 기록하고 자료·시나리오를 확보하여 재분류한다. 단순 변경 줄 수·Issue 번호·문서 파일 여부만으로 LOW가 되지 않는다.

| 위험도 | 객관적 트리거와 예시 | 병합 전 QA 요구 |
| --- | --- | --- |
| **HIGH** | 인증·세션·권한·보안/데이터 노출, DB migration/데이터 손실·영속성, Calendar/Duration/Dependency/Auto Schedule, 원장 의미를 바꾸는 Import/Export, CI/GHCR 권한·required checks·릴리스 보호, 다중 화면 비동기 상태 보존·경쟁/반복 회귀, 기존 안전성 테스트·가드 삭제 또는 약화 | 기본은 정확한 Head의 독립 Reviewer 실제 PASS + Manager ACCEPT. 단, 보호된 CI/보안/QA 계약 파일 미수정 PR은 main의 Trusted QA PASS, HIGH 수동 체크리스트·잔여 위험 명시 수용 및 Manager ACCEPT 경로를 선택할 수 있음; 없으면 BLOCKED |
| **MEDIUM** | 제한된 기능/UX/조회 동작 변경, 호환되는 비보안 API 변경, 하나 이상의 component 연계가 있지만 HIGH 트리거 없는 상태 변화 | 영향 영역 타깃 회귀와 Manager 교차 검토 필수. 복수 ownership 경계·최근 관련 회귀·비자명한 UX 상태 전이인 경우 **독립 QA 요구**를 명시하고 실행 |
| **LOW** | 계약/동작/보안에 영향 없는 docs-only·문구·순수 cosmetic CSS, 기존 안전성 Gate를 변경하지 않는 고립된 테스트/운영 설명 변경 | DOC_SYNC + 최신 PR required checks + review thread 해결 + Manager ACCEPT. 독립 QA 미선택은 사유 포함 `N/A` 가능 |

상충 조건은 높은 위험도가 우선한다. 기존 문제 재발, 테스트 축소, 리뷰 지적·재작업, 설계/권한/파일 범위 확대, PR Head 변경 시 매번 트리거를 다시 평가한다. 단순 CI 실패만으로 HIGH를 자동 선언하지는 않되 같은 원인 반복·안전성 검증 결함·영향 범위 확장은 승격한다. MEDIUM에서 타깃 회귀 증거 부족은 독립 QA 생략 사유가 아니라 **검증 미완료**다.

### MEDIUM의 독립 검토 결정

- `qa_required=true`: frontend/backend 등 **둘 이상의 작성 영역이 같은 사용자 시나리오에 영향을 주는 경우**, 신규 계약의 해석이 불명확하거나 동일 영역 회귀가 반복된 경우. 단, 다중 화면 비동기 경쟁·원장·보안 영향은 MEDIUM이 아니라 HIGH로 승격한다.
- `qa_required=false`: 영향 영역이 국소적이고 영향받는 계약·수용 기준·타깃 회귀 증거가 명확하며 Manager가 교차 검토할 수 있는 경우. 결정 이유를 Head·파일·테스트와 연결하고 `qa_final=N/A`로 기록한다.
- QA를 요구하기로 한 MEDIUM에서 실제 검토자를 확보하지 못하면 `BLOCKED`이다. 임의로 `qa_required=false`로 되돌리지 않는다.

### Reviewer 독립성·부재 시 대체

`qa_method=AGENT`의 HIGH 또는 `qa_required=true` MEDIUM은 실제 구현/PR 작성자와 **다른 주체**가 AC ↔ diff ↔ tests ↔ docs ↔ 최신 PR CI를 검토한다. `qa_docs` Sub-Agent가 지원되면 해당 Agent, 불가능하면 지정 maintainer가 승인한 **별도 인간 reviewer**를 배정한다. Reviewer 이름/실제 GitHub review 링크 또는 독립 실행 ID, 검토한 Head, Findings와 PASS/REWORK 판정이 필요하다. 인간 Reviewer의 검토는 계정/주체·변경 내용·검토 증거가 식별되어야 하며 단순 `LGTM`이나 사후 Manager 자기 검토를 독립 QA로 분류하지 않는다.

보호된 검증기/Workflow/보안 정책 변경에는 실제 인간/qa_docs reviewer 확보가 불가능하면 `independent_qa=BLOCKED` 및 `MERGE_READY=BLOCKED`를 유지한다. 그 외 HIGH/의무 MEDIUM은 `AUTOMATED_MANAGER`를 선택할 수 있지만 신뢰된 main QA Final 검증이 실제 성공하고, 강화된 Manager 검토·위험 수용 증거가 없으면 동일하게 BLOCKED다. 사용자에게 검토 주체 확보를 요청할 수 있으며, 미결정 동안 다른 안전한 작업은 진행할 수 있다. **#580 전에는 자동 CI가 독립 Reviewer의 판단을 대체하지 않는다.**

## 3. Work Packet / PR / Result Contract 필드

Manager가 PLAN에 기록하고 PR로 인계할 최소 필드는 다음과 같다.

~~~text
risk_level: LOW | MEDIUM | HIGH
risk_reason: 영향 경로·데이터/권한/상태/운영 위험, 선택 근거
risk_triggers: HIGH/MEDIUM/LOW 규칙에 해당하는 사실과 파일
affected_paths: 변경 파일과 주요 영향 경계
qa_required: true | false
qa_review_mode: qa_docs | human | N/A
qa_method: AGENT | AUTOMATED_MANAGER (actual route and reason)
trusted_qa_run: trusted workflow_run ID / source PR CI run ID / head/base / PASS | NOT TESTED | BLOCKED
reviewer: 실제 Agent run ID 또는 다른 인간의 GitHub identity | N/A
qa_evidence: 해당 Head의 독립 검토 결과/링크/지적 처리 | N/A(명시된 사유)
qa_final: PASS | FAIL | BLOCKED | NOT TESTED | N/A(reason)
pr_head_sha: exact commit SHA
ci_evidence: quality/e2e/docker 각 check/run/attempt와 실제 실행·SKIPPED 내역
documentation_sync: PASS | FAIL | BLOCKED | NOT TESTED
manager_decision: ACCEPT | REWORK | REJECT | DEFER | NOT TESTED
manager_evidence: Issue/PR 댓글과 확인한 Head, 승인/잔여 위험
~~~

`qa_final=N/A`는 `qa_required=false`인 LOW 또는 근거 있는 MEDIUM에만 허용한다. 의무인 독립 QA를 도구 문제로 실행하지 못했다면 `N/A`가 아니라 `BLOCKED`다. `N/A`는 실행된 검증의 `PASS`가 아니다.

### QA_FINAL → MERGE_READY 체크리스트

1. 현재 PR Head SHA, main/base 동기화 및 mergeability, 변경 파일·리스크 재분류 결과 확인. Head가 바뀌었으면 이전 required CI와 QA_FINAL 판정은 **모두 stale**다. LOW/MEDIUM은 새 Head의 새로운 위험도/QA 필요성 판정을 요구한다.
2. 같은 최신 Head의 GitHub Actions **세 required aggregate checks가 성공**했는지 확인. 현재 경로 기반으로 무거운 E2E/Docker 구현 Job이 SKIPPED인 경우에는 실제 aggregate 성공과 skip 조건을 함께 기록하고 그 테스트를 **실행 PASS로 주장하지 않는다**. CI 진행 중/실패·일부 check 누락은 MERGE_READY 금지.
3. `DOCUMENTATION_SYNC=PASS`: 영향받는 문서 갱신 또는 문서별 `N/A(reason)`, 코드·계약 일치. 문서가 불필요해도 영향 분석을 생략하지 않는다.
4. 미해결 차단 리뷰·스레드 0, 위험도에 따른 타깃/환경별 검증 증거 확보. 실제 UX/Windows/운영 환경이 필요하면 별도 PASS/BLOCKED/NOT TESTED를 기록하고 수용 여부 판단.
5. `qa_required=true`에서 `qa_method=AGENT`이면 별도 Reviewer exact-Head QA PASS, `AUTOMATED_MANAGER`이면 main에서 검증한 `QA Final — Trusted`의 PR Head/base/run별 자동 QA PASS·강화된 Manager 위험 수용이 필수. 보호된 workflow·검증기·보안 정책 변경 PR은 항상 독립 Reviewer PASS 필요. `qa_required=false`라면 근거 있는 독립 QA `N/A(reason)`를 기록.
6. Manager는 Issue/PR에 Head·위험도·reviewer·qa_final·CI/문서 근거·잔여 위험을 인용해 **명시적 ACCEPT**를 남긴다. GitHub approval review 수 0과 Manager ACCEPT는 별개이며 PR CI 성공만으로 승인되지 않는다.
7. 그 뒤에만 MERGE_READY/Auto-merge를 허용한다. 본 규칙은 GitHub Ruleset에 새 required status check를 추가하는 것은 아니며 **운영 절차의 책임**이다. 관리자 설정 변경은 권한과 명시 승인 및 실효성 검증이 필요하다.

병합 후의 exact merge SHA Main CI, 비문서 `ci-<SHA>` GHCR exact-digest runtime smoke/SBOM/provenance, Generic Finalizer, release_required/release_authorized, 안전한 cleanup, FINAL/Issue close는 기존 지침을 따른다. 위험도에 따른 독립 QA N/A가 이들 Gate의 N/A를 뜻하지 않는다.

## 4. 재현 가능한 판정 시나리오 (정책 기대값; 실제 CI/Agent 실행 증거 아님)

| 입력 및 관측 | 위험도/QA | 기대 진행 |
| --- | --- | --- |
| Markdown 사용 가이드만 바뀌고 계약·Gate 불변 | LOW / qa_required=false / qa_final=N/A(reason) | DOC_SYNC + 새 Head aggregate required checks 성공 + Manager ACCEPT 시 병합 가능 |
| 라벨/색상만 변경, DOM interaction 불변 | LOW / qa_required=false | 동일; 시각 회귀 영향 분석 기록 |
| 단일 기존 화면의 제한된 필터 동작 변경, 실제 타깃 회귀 있음 | MEDIUM / 근거에 따라 독립 QA N/A 가능 | 영향·타깃 E2E·Manager 교차 검토와 사유 필수 |
| frontend와 backend가 같은 사용자 흐름의 조회 계약을 함께 변경 | MEDIUM / qa_required=true | 별도 Reviewer PASS 필요. 조회 권한·데이터 손실 영향이면 HIGH |
| 여러 화면에 걸친 async viewport 복원 경쟁·반복 회귀 (#530 유형) | HIGH / qa_required=true | 독립 리뷰 PASS 없으면 BLOCKED |
| 인증/세션 보호 또는 migration rollback 변경 | HIGH / qa_required=true | 권한/rollback 회귀 + 별도 QA Reviewer |
| 기간·선후행 자동 배치 알고리즘 변경 | HIGH / qa_required=true | Unit 경계+새 Head 원격 CI+별도 QA Reviewer |
| test-only가 authorization/CI fail-closed 검증을 약화 | HIGH / qa_required=true | 파일 수나 test-only 명목으로 LOW 금지 |
| HIGH인데 Sub-Agent 지원 불가, 승인된 별도 인간 Reviewer 있음 | HIGH / human review | 인간의 실제 분리 검토 증거 후 Manager ACCEPT 가능 |
| HIGH인데 Sub-Agent·별도 인간 Reviewer 모두 불가 | HIGH / BLOCKED | CI PASS여도 MERGE_READY 불가; #580 구현 전 자동 대체 주장 금지 |
| MEDIUM PR의 변경 범위가 재작업 중 보안 인증으로 확대 | HIGH 재분류 / qa_required=true | 종전 MEDIUM N/A 무효; 새 Head CI·QA 필수 |
| CI 실패 Head A → 수정된 Head B | 재분류 후 요구 판정 | Head A QA·CI PASS 재사용 금지; B의 quality/e2e/docker 새 결과 확인 |
| Docs 영향 없음 | 모든 위험도 / DOCUMENTATION_SYNC 필요 | 문서별 N/A(reason)가 있어야 DOC_SYNC PASS |
| #525 / PR #533 (이미 merged), #530 / PR #564 (이미 merged) | **과거 사례** | 구조·변경 파일 기준 재분류는 예시로만 사용, 과거 QA 여부·검증 이력 소급 판정 금지 |

## 5. 운영 적용·경계

- 정책의 Source of Truth: 이 문서. `AGENTS.md`, `ISSUE_LIFECYCLE.md`, `AGENT_PROMPTS.md`, `AGENT_CONFIGURATION.md`, `GITHUB_OPERATIONS.md`, `ISSUE_LIFECYCLE_AUTOMATION.md`, `REMOTE_VALIDATION.md`와 **실제 실행 지침 `.codex/agents/*.toml`** 을 함께 확인한다. 문서가 올바르더라도 Agent의 실제 `developer_instructions`가 상충하면 DOCUMENTATION_SYNC와 최종 QA를 PASS 처리하지 않는다.
- 정책 변경 PR 자체는 **HIGH(병합 승인 계약 변경)**로 취급한다. `qa_docs` 실행이 불가능하면 별도 인간 Reviewer를 배정하고, 확보되지 않은 상태의 PR CI 성공을 최종 QA/병합 승인으로 과대 표시하지 않는다.
- 이번 #565는 app source/API/DB, .github workflow/Ruleset, 제품 version을 변경하지 않는다. application version은 유지하며 정식 GHCR 게시·운영 배포 권한을 생성하지 않는다.
- 후속 #580이 자동 QA를 구현하여 HIGH 대체 경로가 정식 수용되면 이 문서의 인간 Reviewer 필수와 검증/승인 경계를 같은 변경에서 갱신하고, 실제 required checks/Ruleset 적용 범위까지 검증한다.

## 6. Issue #565 병합 이후 F1 보완 범위 (2026-10-10)

PR #583은 merge SHA `1ed682dd062012f3d04c2517110835bf7c28ac13`로 main에 반영되었지만, [실제 독립 QA F1](https://github.com/planner77/masterGantt/issues/565#issuecomment-6083701630)은 당시 `.codex/agents/infra.toml`의 **무조건 qa_docs 전제**가 위험도 정책과 충돌함을 기록했다. 사용자 검토 확인 후 병합됐다는 사실로 이 F1이 기술적으로 해결된 것은 아니다.

후속 수정은 `infra.toml`의 병합 및 main 증거 검토를 `qa_required`로 분기한다. `frontend.toml`과 `ui-ux.toml`의 리뷰 문구도 동일한 조건으로 읽히도록 정합화한다. 이번 변경은 **후속 #580의 GitHub Actions 자동 QA Job을 구현하지 않는다.** 독립 Reviewer 필수인 HIGH/의무 MEDIUM의 승인 조건과 기존 CI/GHCR/권한 Gate를 그대로 유지한다.

회귀 검토의 단위는 `qa_required=false` LOW/일부 MEDIUM의 사유 있는 N/A, `qa_required=true` MEDIUM/HIGH의 실제 `qa_docs` 또는 별도 인간 Reviewer PASS/부재 시 BLOCKED, 새로운 PR Head의 모든 QA/CI 증거 stale 처리, 병합 후 필요 시 Reviewer 또는 Manager의 GHCR 증거 확인이다. 새 PR CI가 PASS하더라도 **독립 QA Final, Manager ACCEPT, 병합 성공은 별도 증거**다.
