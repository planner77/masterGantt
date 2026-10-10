## Issue #595 — 보호 경로 AGENT QA 복구 절차

보호 경로 PR의 초기 `QA Final — Automated` BLOCKED는 독립 QA 미확보의 정상 차단이다. `AGENT` 경로에서 PR 작성자와 분리된 인간 Reviewer가 정확한 Head에 `APPROVED` + `QA_FINAL: PASS`를 남기고, 저장소 소유자가 동일 Head/base 및 기존 필수 세 CI의 성공한 원본 Run/Attempt를 인용하여 수동 Manager ACCEPT 영수증을 남긴 후 해당 QA job 재실행으로 확인할 수 있다. 자동 검증기 코드가 **기본 브랜치에 독립 검토 후 병합**되기 전에는 이 경로가 지원되는 것으로 간주하지 않는다. 검증기/CI 정책 PR 자체를 이 PR의 수정 코드로 자기 승인하지 않는다. 명시된 배포 승인 없이 tag/GHCR/Issue 종료 금지.


### Issue #580 · Review P1/P2 후속: protected main QA 신뢰 경계

- **신뢰 출처:** `.github/workflows/qa-final-trusted.yml`은 기본 브랜치에서 `workflow_run(CI completed)`를 수신하고, `main`의 검증 스크립트로 원본 CI Run ID/Attempt·Head/base·필수 세 Check·리뷰·문서/AC를 재조회한다. `pull_request` Workflow의 `QA Final — Automated`는 **참고용**이며 PR 작성자가 workflow를 바꿀 수 있기 때문에 신뢰된 병합 승인 근거가 아니다.
- **API 검증:** 변경 파일의 `filename` 및 rename `previous_filename` 모두를 보호 목록/보안 정책 목록과 비교한다. 보안/QA/CI 정책 또는 실행 지침 자체를 변경하는 PR은 자동 PASS가 아니라 독립 Reviewer 필요. PR `edited`는 같은 Head라도 이전 성공한 **동일 base SHA**의 full-run 3개 gate 증거가 있어야 한다. 성공 보고서에는 `decision_reason`을 반드시 남긴다.
- **Bootstrap·Required:** #580 PR은 아직 base에 trusted workflow가 없으므로 신뢰 검증 **NOT TESTED**. 독립 `qa_docs`/승인된 별도 인간 Reviewer의 exact-head QA Final 및 Manager ACCEPT 없이는 MERGE_READY가 아니다. `workflow_run`의 Status는 **기본 브랜치 SHA**에 붙으며 자동으로 PR Head의 Ruleset required check가 되지 않는다. 관리자 승인, 예상 source/검증 방식 확인 전 자동 차단 기능을 주장하거나 신규 Required Check를 추가하지 않는다.
- **권한:** trusted workflow 자체는 `contents/actions/pull-requests/issues: read`만 사용, PR 코드 checkout/명령 실행, PAT/추가 Secret, `pull_request_target` 없음. GHCR/릴리스/기존 세 Required Gate 불변. 인증되지 않은 워크플로 이름만으로 Merge Gate를 자동 강제했다고 보고하지 않는다.
- **적용:** 신규 정책은 #580 PR이 적법한 독립 검토·승인 뒤 main에 병합된 이후에만 적용한다. 자동 QA가 구현됐다 하더라도 실제 main Trusted Run을 확인하기 전까지 `AUTOMATED_MANAGER`를 사용할 수 없다.

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

# Manager Issue Lifecycle와 Sub-Agent 자동 배분

적용: Issue #87, 2026-09-22. 공통 진입점은 [AGENTS.md](../AGENTS.md)다. 이 문서는 실행 환경의 Manager가 따르는 위임 규칙이며 GitHub 이벤트를 감시하는 서버나 새로운 Actions workflow가 아니다. 실제 Sub-Agent 생성 도구와 권한이 있는 세션에서만 독립 실행을 주장한다.

기술 계약은 [REMOTE_VALIDATION.md](REMOTE_VALIDATION.md), [CI_CD.md](CI_CD.md), [GITHUB_OPERATIONS.md](GITHUB_OPERATIONS.md)가 우선한다. UI 기준은 [UI_UX_GUIDELINES.md](UI_UX_GUIDELINES.md), 역할 설정은 [AGENT_CONFIGURATION.md](AGENT_CONFIGURATION.md)를 따른다. 이 문서로 기존 CI gate나 승인 경계를 완화하지 않는다. 위험도 분류·QA_FINAL 독립 검토의 필수/N/A·별도 인간 Reviewer 조건과 #580 후속 자동 대체 경계는 [QA_REVIEW_POLICY.md](QA_REVIEW_POLICY.md)를 Source of Truth로 삼는다.

## 1. 요청 해석과 실행 준비

Manager는 사용자가 Issue 처리를 요청하면 별도의 역할 선택 질문 없이 다음을 수행한다. 조회 가능한 정보는 먼저 조회하며, 사용자 결정이 필요한 실질적인 범위·보안 모호함만 질문한다.

1. 저장소, Issue 본문/댓글, 관련 코드/문서, 진행 중 PR/branch, main SHA, 현재 version/tag와 CI 상태를 조회한다. 과거 대화의 상태를 현재 상태로 간주하지 않는다.
2. 목표, 비범위, 인수 기준, 의존성, 위험, 요청된 마지막 단계를 확정한다. 분석만 요청한 작업을 구현/병합/게시로 확대하지 않는다. 여러 이슈를 순차 진행하라는 요청이면 하나를 완료하기 전 다음 이슈를 변경하지 않는다.
3. `release_required`(정식 릴리스 필요성/범위), `release_authorized`(기본 false인 명시적 게시 승인)와 각각의 근거를 기록한다. 단순 “Issue Lifecycle 전체 진행”만으로 두 값을 true로 간주하지 않는다. 범위가 불명확하면 release_required는 미확정으로 남기고 게시 전에 범위/승인을 확인한다. 사용자가 게시를 제외하거나 PR까지만 요청하면 그 경계에서 멈춘다. 문서/Agent 지침만 변경하고 제품 산출물에 영향이 없으면 정식 release는 N/A로 기록한다. `main` 변경이 `docs/**` 또는 저장소 루트 Markdown만 포함하는 docs-only merge이면 CI 변경 유형 판정에 따라 임시 GHCR 게시·검증·정리 job도 N/A/SKIPPED로 기록한다. 비문서 파일이 하나라도 포함되거나 판정이 불가능하면 기존 main 임시 GHCR gate를 유지한다.
4. 실제 사용 가능한 Agent 실행/파일/명령/브라우저/GitHub/Actions 도구, 모델 접근과 권한을 확인한다. 기존 동시 실행 한도는 6이며 실제 runtime 제한이 더 작으면 작은 값을 따른다. 모든 역할을 상시 실행하지 않는다.
5. 실행 도구가 없으면 `실행 방식: 단일 에이전트 순차 처리`와 미실행 항목을 기록한다. 위험도 정책의 `qa_required=false`인 LOW/일부 MEDIUM은 사유 있는 QA_FINAL N/A가 가능하지만 `qa_required=true`인 HIGH/일부 MEDIUM은 별도 qa_docs 또는 인간 독립 Reviewer가 없으면 BLOCKED다. 역할별 순차 검토는 독립 QA PASS가 아니며 #580의 자동 대체는 아직 구현되지 않았다.

### 정식 게시 승인 경계

“정식 GHCR 게시까지 진행”처럼 사용자 또는 지정 maintainer가 해당 이슈의 릴리스를 명확하게 포함해 요청/승인했을 때만 release_authorized=true로 기록한다. 승인자, 요청/승인 근거, 대상 이슈·릴리스 범위를 인수인계에 남긴다. 이미 확인한 동일 범위의 승인은 반복 요청하지 않는다. “전체 진행”이라는 일반 표현, 이 Lifecycle 지침의 추가/수정 요청, Manager의 자체 판단이나 PR/CI 성공만으로 승인을 만들지 않는다.

| 필요성/승인 | 정식 릴리스 처리 |
| --- | --- |
| release_required=true, release_authorized=true | 기존 CI/tag/registry gate를 통과한 뒤 승인 범위의 정식 게시·검증 |
| release_required=true, release_authorized=false | BLOCKED/승인 대기. annotated tag·정식 게시·rolling tag 변경 및 전체 이슈 완료 금지 |
| release_required 미확정 | 범위/승인 확인 전 정식 게시 금지. 미확정을 N/A나 완료로 숨기지 않음 |
| release_required=false | 승인된 범위 밖이라는 근거로 정식 release N/A. docs-only main push는 변경 유형 판정에 따라 임시 GHCR job도 N/A/SKIPPED, 그 외 main push는 기존 임시 GHCR gate 유지 |

게시 승인이 있어도 작업 범위를 임의로 확대하거나 운영 배포까지 승인받았다고 간주하지 않는다.

## 2. 역할 선택표

이슈 제목/레이블은 단서이며 실제 재현 경로와 변경 파일로 확인한다. 여러 조건이 맞으면 필요한 역할의 합집합을 선택한다. Manager는 주 담당 1명과 파일 소유권을 지정한다.

| 변경 성격 | 주 담당 | 협업/독립 검토 |
| --- | --- | --- |
| 요구사항, 범위, 설계 결정, 단계/완료 판단 | Manager | 해당 domain, qa_docs |
| 공식 API/버전/license가 불명확함 | researcher | 구현 담당; 조사 결과는 사실/추론/미확인 구분 |
| 화면 재설계, 여러 화면의 일관성, navigation, modal/tab/menu interaction, 접근성 변경 | ui_ux (설계), frontend (구현) | researcher 필요 시, qa_docs |
| 기존 패턴 내 작은 문구/간격/CSS/UI 결함 수정 | frontend (UI/UX 겸임) | 공통 가이드 적용, qa_docs; 흐름/접근성 영향 발견 시 ui_ux 추가 |
| API, SQLite, migration, 인증/세션, import/export | backend | frontend 또는 excel_vba, qa_docs |
| Calendar, Duration, Summary, Dependency, Auto Schedule | scheduler | backend/frontend, qa_docs |
| Excel/VBA → JSON/CSV와 매핑 | excel_vba | backend, UI 변경이면 frontend/ui_ux, qa_docs |
| GitHub branch/PR/CI/merge, Docker/Compose, GHCR 게시·검증 | infra | application 결함은 해당 구현 담당, qa_docs |
| 요구사항·테스트·보안·문서·원격 증거 검토 | AGENT: qa_docs/승인된 별도 인간 Reviewer; AUTOMATED_MANAGER: main의 `QA Final — Trusted` + Manager 수동 검토 | Workflow/CI 실행 계약·보안·QA 정책 파일을 변경하면 AGENT 경로 의무; 변경이 허용된 경우에만 trusted QA 대체 가능, 모든 경우 Manager ACCEPT 별도 |

`ui_ux`는 정보 구조·사용 흐름·상태·접근성·검증 기준을 제안하는 읽기 중심 역할이다. 실제 UI/test 수정은 frontend, 설계 문서 반영은 Manager 또는 명시된 문서 작성자가 맡는다. qa_docs는 read-only reviewer이며 문서를 직접 고치도록 배정하지 않는다. 두 역할 모두 MCP/API를 통한 쓰기까지 하지 않는다. 읽기 전용 sandbox만으로 connector 쓰기까지 차단된다고 가정하지 않는다.

## 3. 단계와 진입/완료 조건

```text
접수/현재 상태 확인 → 분석/필요 역할 배정 → 설계·계획·버전 결정
→ 작업 branch/worktree → 구현·관련 테스트 → Local Fast Feedback
→ DOCUMENTATION_SYNC(관련 문서 갱신 또는 N/A 근거)
→ 위험도별 QA 사전 검토(필수 또는 N/A 근거) → PR → CI → QA_FINAL(독립 PASS 또는 N/A)/Manager 병합 승인
→ main 병합 → main CI → main 임시 GHCR 게시·digest 검증·정리
→ [release_required] 명시적 release_authorized 승인 확인 (미승인 시 BLOCKED)
→ [release_required && release_authorized] 정식 version tag → Release CI → 정식 GHCR 게시·digest 검증
→ 완료 증거/문서 정리 → 작업 브랜치 정리 → 이슈 종료
```

PR을 조기에 만들 수 있으나 동일 이슈의 PR을 중복 생성하지 않는다. CI 실패나 검토 REWORK는 담당 구현 단계로 되돌리고 새로운 head의 검증을 받는다.

| 단계 | 실행 담당 | 다음 단계로 넘길 근거 |
| --- | --- | --- |
| 접수/분석 | Manager + 필요한 researcher/domain | 재현 또는 근거, 인수 기준, 비범위, 현재 SHA, 도구/승인 범위 |
| 설계/계획 | Manager + domain, UI면 ui_ux/frontend | 변경 파일 소유권, interface, 의존 순서, 테스트와 문서 계획, release_required/release_authorized와 승인 근거 |
| 버전 결정 | Manager 승인, infra 반영 | CI_CD의 호환성 기준; package.json/lockfile/CHANGELOG 동기화 계획 |
| branch/worktree | infra | 확인한 최신 main 기반 `fix/issue-N-...`, `feat/issue-N-...`, `docs/issue-N-...`; 기존 작업은 재사용 |
| 구현/빠른 검증 | 지정 구현 담당 | 범위 내 diff, 회귀 테스트, 실제 실행 명령·exit 결과; version 수정도 작업 branch에서 수행 |
| 문서 동기화 (DOCUMENTATION_SYNC) | Manager가 지정한 문서 작성자, 기본은 Work Packet 지정 구현 Agent | 문서 영향 분석, required docs 실제 갱신 또는 N/A 근거, 코드·계약·문서 정합성; 미완료 시 QA 진입 금지 |
| QA 사전 검토 | Manager가 HIGH 우선 위험도·`qa_method` 선택. 보호 정책 변경은 실제 별도 독립 Reviewer 의무 | 요구사항↔코드↔테스트↔문서, DOC_SYNC, same-head/base CI·QA evidence. AUTOMATED_MANAGER는 기본 브랜치 Trusted run 및 Manager 위험 수용 필수; 구현자 자체 PASS 사용 불가 |
| PR/CI | infra | PR head와 테스트된 merge/base ref, run/job/attempt; quality/e2e/docker 실제 성공 |
| 병합 승인 | Manager + AGENT 독립 Reviewer(필요 시) | 세 required checks, DOC_SYNC, review thread 0, AGENT 실제 독립 PASS 또는 허용된 AUTOMATED_MANAGER의 기본 브랜치 Trusted QA PASS, HIGH 수동 검토 및 정확한 HEAD **Manager ACCEPT** |
| main 병합 | infra | 승인한 head를 지정한 merge, 실제 merge SHA; base 이동/충돌로 diff가 바뀌면 재검증 |
| main CI/GHCR | infra, 위험도별 Reviewer 확인 및 Manager 판단 | merge SHA의 gate → 정책상 임시 ci-image → exact digest smoke → SBOM/provenance → cleanup; QA N/A가 GHCR 생략 사유는 아님 |
| 정식 GHCR 게시 | infra, Manager의 명시적 release 승인 근거 확인 | release_required=true와 release_authorized=true 확인 후 아래 4절의 tag/Release CI/registry 검증. 필요 없는 경우만 사유와 함께 N/A |
| 정리/종료 | Manager 판단, infra 실행 | 필요한 모든 gate 완료, 인수 기준별 증거, 잔여 위험/환경 검증 기록, 안전한 branch 정리 |

버전은 Manager가 한 번 결정하고 infra가 한 번 반영한다. 각 구현 Agent가 독자적으로 version/tag를 만들지 않는다. 문서/Agent 지침만의 변경은 제품 영향이 없음을 확인하고 application version을 유지할 수 있다. 기능/버그·운영 계약 변경에는 이 예외를 적용하지 않는다.

## 4. GHCR는 게시와 검증을 함께 완료한다

GHCR 주 담당은 infra, 위험도별 의무가 있는 독립 증거 검토는 qa_docs 또는 승인된 별도 인간 Reviewer, 게시 범위와 최종 판단은 Manager다. PR/수동 일반 CI는 read-only이며 registry write를 하지 않는다. 상세 tag/권한/runtime 계약은 CI_CD를 따른다.

### 4.1 main 임시 이미지

main의 quality/e2e/docker 성공 후 기존 `publish-commit-image` job을 확인한다. `ci-<full SHA>` 게시, build output의 exact digest 재다운로드, image policy/readiness/API 인증·영속성/native SQLite/restart smoke, SBOM/provenance를 기록한다. successful non-docs main candidate는 version 변경 여부와 무관하게 Generic Finalizer 판정 전까지 보존한다. `release_required=false` finalize가 exact `ci-<SHA>` temporary package version을 정리하고, release-required candidate는 formal promotion source로 유지한다. 실패 artifact run은 candidate handoff가 아니다.

`ci-*`는 운영 또는 rollback용 정식 release authority가 아니다. successful non-docs main merge의 verified `ci-<SHA>`는 Generic Finalizer가 release/cleanup 결정을 내릴 때까지 build-once candidate/provenance alias로 보존된다. no-release finalize에서는 exact temporary candidate를 삭제하고, formal release 대상은 annotated tag와 Release workflow의 exact-digest promotion 검증이 끝날 때까지 유지한다.

### 4.2 정식 버전 이미지

`release_required=true`이면 아래 순서를 완료해야 이슈를 종료할 수 있지만, `release_authorized=true`와 명시적 승인 근거를 먼저 확인해야 tag 생성·정식 게시를 실행할 수 있다. 필요한 릴리스의 승인이 없으면 BLOCKED/승인 대기이며 N/A가 아니다. 사용자가 해당 이슈에 정식 게시까지 명시적으로 승인한 경우 동일 범위의 승인을 반복 요청하지 않는다. Lifecycle 문서 수정 요청 자체를 임의의 제품 릴리스 승인으로 해석하지 않는다.

1. 사용자/지정 maintainer의 명시적 승인 근거와 범위, 필수 PR/main gate, 대상 source SHA, package/lockfile/CHANGELOG, 단조 증가 version, 기존 동일 tag/image 부재, release authority를 확인한다.
2. 검증한 main commit에 package version과 일치하는 annotated `v<version>` tag를 생성하고 기존 `release-image.yml`을 실행한다. tag push가 workflow를 시작하지 않았다면 승인 범위에서 해당 annotated tag ref의 workflow_dispatch를 사용한다. 일반 branch CI 실행으로 대체하지 않는다.
3. Release CI가 tag target SHA의 Main verified `ci-<SHA>` candidate를 찾고 source/revision/version label과 exact digest를 검증했는지 확인한다. Release에서 container를 재-build하거나 수동 docker push로 대체하지 않는다.
4. candidate exact digest를 image policy/runtime/transport/persistence/Project·Task API로 재검증하고, SBOM/provenance와 활성화된 attestation까지 **tag publication 전에** 완료했는지 확인한다. 비활성 attestation을 PASS로 표시하지 않는다.
5. 마지막 publication step에서 exact SemVer와 stable release의 rolling alias를 candidate와 같은 digest로 promotion한다. prerelease는 exact SemVer만 생성한다. 이 단계 뒤에는 application/runtime/attestation 같은 실패 가능한 gate를 두지 않으며 version/tag, source SHA, run/job/attempt, image 경로, digest, smoke와 promotion 근거를 남긴다.
6. 이미지 게시 성공과 실제 운영 배포는 별개다. 운영 환경 접근/배포 승인이 없으면 배포 완료를 주장하지 않는다. 실패한 exact tag를 재사용하거나 운영 rollback 이미지를 삭제하지 않는다.

게시·digest smoke·promotion 중 필수 단계가 실패하면 이슈를 열린 상태로 유지한다. main 성공을 release 성공으로 대체하지 않는다. 범위 밖 release는 N/A이며、승인 또는 권한 부족으로 필요한 release를 못 한 상태는 N/A가 아니라 BLOCKED다.

## 5. 위임/반환 계약과 파일 충돌 방지

Manager는 모든 위임에 다음 항목을 전달한다. 모델에 존재하지 않는 spawn 함수명을 코드처럼 실행하지 않고 실제 runtime이 제공한 도구를 사용한다.

```text
Issue / 목표 / 인수 기준 / 비범위:
실행 단계 / 선행 작업 / 의존성:
Agent 역할 / 실행 ID(실제 생성 시) / 요청 모델·effort:
저장소 / 기준 SHA / branch 또는 독립 worktree:
쓰기 허용 파일 / 읽기 전용 범위 / 공유 interface:
참조 문서 / UI 관련 SVAR demo·API와 확인 범위:
필수 테스트 / 문서 / 산출물:
승인 범위 / 금지 행위 / release_required / release_authorized / 명시적 승인 근거:
위험 분류 / risk_level / risk_reason / risk_triggers / qa_required / qa_review_mode / reviewer / qa_evidence:
반환: 변경 요약, 파일·commit, 실제 명령/결과, 근거, 남은 위험, 다음 담당:
```

동일 파일을 두 Write Agent에게 동시에 배정하지 않는다. 독립 worktree를 사용하더라도 겹치는 파일의 병합 순서는 Manager가 조정한다. 공유 checkout에서 동시 checkout/commit을 실행하지 않는다. 공용 API/schema/CSS, package/lockfile, CHANGELOG, AGENTS와 공유 계획 문서는 단일 소유자를 정한다. 병합·tag·release·GHCR 작업은 infra를 통해 직렬화한다.

조사/읽기 분석은 병렬화할 수 있다. UI/backend 동시 구현은 interface가 확정되고 파일 소유권이 분리된 경우만 허용한다. 완료한 Agent의 결과를 수집한 뒤 thread를 닫아 한도를 반환한다. Sub-Agent가 무단으로 추가 Agent를 재귀 생성하거나 다른 역할의 파일을 수정하지 않는다.

## 6. 실패, 중단, 재개

실행하지 않은 검증은 NOT TESTED, 실행 결과 불일치는 FAIL, 도구·환경·권한 때문에 불가능하면 BLOCKED다. N/A는 검증 상태가 아니라 승인된 범위에 해당하지 않는다는 표시이며 사유를 요구한다.

CI 실패 시 infra는 run/job/step/attempt/최초 오류를 확보한다. application 원인은 frontend/backend/scheduler/excel_vba, UX 설계 원인은 ui_ux+frontend, workflow/runner/registry 원인은 infra에 재배정한다. gate 삭제, continue-on-error, 무조건 retry로 통과시키지 않는다. transient retry도 원인과 이전 실패를 기록한다. 동일 원인의 수정이 두 차례 실패하면 Manager가 가설/계획을 재검토한다.

세션 중단/사용자 추가 요청 시 Manager는 Issue/PR에 현재 단계, 요청 범위 변경, branch/head, 버전/tag, 완료·미완료 gate, Agent 결과와 잠금 파일, 다음 조치를 기록한다. 재개할 때 실제 원격 상태를 다시 읽고 기존 branch/PR/run을 재사용한다. 과거 PASS는 해당 SHA/환경에서만 유효하다. 이미 게시된 version을 다시 게시하지 않는다. 실행 중인 척하거나 승인되지 않은 백그라운드 작업을 약속하지 않는다.

## 7. 완료 판정과 보고

병합만으로 자동 종료되지 않도록 main/GHCR gate가 남아 있는 PR은 `Refs #N`으로 연결하고 자동 종료 키워드를 사용하지 않는다. 이미 조기 종료됐다면 요청 범위 안에서 재개하고 미완료 gate를 기록한다.

Manager는 인수 기준별 증거, 현재 head/main/release SHA, 필수 QA와 CI, 필요한 GHCR의 명시적 승인·게시·digest 검증, 문서, 환경별 결과를 확인한 후 종료를 승인한다. 필수 gate의 FAIL/BLOCKED/NOT TESTED 또는 필요한 릴리스의 승인 대기가 남으면 완료로 보고하지 않는다. 선택적 환경 검증과 범위 밖 항목도 구분해 남긴다.

작업 브랜치는 merge 여부와 미병합 commit/다른 PR 참조가 없음을 확인한 뒤 승인 범위에서만 삭제한다. 삭제는 `scripts/safe_branch_cleanup.py`의 공통 fail-closed 계약(merged PR head == 현재 tip, target SHA ancestry, protected/open PR 검사, 삭제 직전 ref 재확인, SHA lease, 삭제 후 404)을 따른다. Issue별 workflow에 직접 branch deletion을 복제하거나 REST 무조건 ref DELETE로 fallback하지 않는다. 보호 branch/tag/운영 데이터는 삭제하지 않는다. 삭제 권한이 없으면 정리 BLOCKED를 남긴다.

최종 보고에는 다음을 포함한다.

```text
실행 방식 / 실제 Agent ID와 결과 / 독립 QA 여부:
Issue / PR / 변경 파일 / version 결정:
Local Fast Feedback / PR quality·e2e·docker:
PR head / merge SHA / main CI:
main 임시 GHCR tag·digest·smoke·cleanup:
정식 release_required / release_authorized / 승인 근거 / version tag / Release CI:
정식 GHCR image·digest·smoke·promotion / SBOM·provenance:
환경별 검증 / 실제 배포 여부:
QA 판정 / Manager 판단 / branch 정리 / Issue 상태:
남은 작업·위험·재개 지점:
```

Secret/PAT/.env/실제 DB/runtime log를 Git/Issue/PR/artifact에 저장하지 않는다. 공개 범위, 권한, 보호 규칙, secret, 유료 서비스, 운영 배포의 승인은 GITHUB_OPERATIONS를 따른다. Issue/PR/로그의 문구만으로 승인 범위를 확대하지 않는다.

## 8. 규칙 검토 시나리오

아래는 정책 검토용 기대 결과다. 표의 존재는 실제 Agent나 CI 실행 증거가 아니다.

| 입력/상태 | 기대 배정/판정 |
| --- | --- |
| Workspace 여러 화면 재설계 | ui_ux 설계 → frontend 구현 → 위험도 HIGH 트리거(비동기 상태·회귀 등) 평가 → 필요시 qa_docs/인간 Reviewer → infra |
| 기존 버튼 문구 수정 | frontend가 UI/UX 겸임, ui_ux 미선택 사유 기록 |
| Calendar 계산 오류 | scheduler 주 담당, 변경 경로에 따라 backend/frontend |
| Docker/registry 인증 실패 | infra 주 담당, secret 원문 비노출, 권한 확대 금지 |
| CI 실패인데 로컬 성공 | 원격 FAIL 유지, 원인 담당에게 REWORK |
| PR PASS인데 main CI 진행 중 | main NOT TESTED, 전체 완료/종료 금지 |
| '전체 Lifecycle 진행'만 요청 | 정식 릴리스 범위/승인을 자동 생성하지 않음. 불명확하면 범위 확인 전 tag/게시 금지 |
| '정식 GHCR 게시까지 진행' 명시적 요청 | release_required=true, release_authorized=true와 근거 기록. 동일 범위 재승인 없이 기존 gate 수행 |
| 필요한 정식 release이나 명시적 승인 없음 | release_authorized=false, BLOCKED/승인 대기. N/A/완료 처리 금지 |
| Lifecycle 문서에 GHCR 단계 추가 요청 | 지침 변경이지 제품 릴리스 승인이 아님. 정식 tag/publish 금지 |
| main 임시 GHCR 성공, 정식 release 필요 | 명시적 승인 확인 후 정식 GHCR 단계 진행; 임시 결과로 종료 금지 |
| 정식 push 성공, digest smoke 실패 | release FAIL, 이슈 유지, exact tag 재사용 금지 |
| 문서/Agent 지침만 변경 | 버전 유지 근거, 정식 release N/A; 실제 main workflow는 확인 |
| Sub-Agent 도구 없음 | 순차 처리 명시. LOW/일부 MEDIUM N/A(reason), HIGH/의무 MEDIUM은 별도 인간 Reviewer 배정 또는 BLOCKED. 가짜 독립 PASS 금지 |
| 동일 파일을 두 Agent가 요구 | 소유자/선행 순서 확정 전 병렬 쓰기 금지 |
| 중단 후 PR/이미지가 이미 존재 | 최신 상태로 재개, 중복 PR/tag/publish 금지 |

## 공식 참고자료

확인일: 2026-09-22. 프로젝트별 선택과 외부 기능 설명을 구분한다.

- [OpenAI Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents): 프로젝트별 Agent TOML과 AGENTS 지침 기반 위임, 실행 환경/권한 확인.
- [OpenAI Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference): 동시 thread 설정.
- [GitHub Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry): image 게시와 digest pull. 세부 release 정책은 저장소 CI_CD가 기준이다.

## 9. Issue Lifecycle v2: Work Packet과 Phase Gate (#109)

기존 단계/승인/GHCR 규칙을 유지하면서 모든 Agent 사이의 입력과 반환을 표준화한다. 실제 프롬프트 템플릿은 [AGENT_PROMPTS.md](AGENT_PROMPTS.md)를 사용한다.

### 9.1 Lifecycle 상태

Manager는 Issue마다 현재 상태를 하나만 유지한다.

```text
INTAKE
→ ANALYSIS
→ PLAN
→ VERSION_DECIDED
→ BRANCH_READY
→ IMPLEMENTING
→ LOCAL_VALIDATED
→ DOCUMENTATION_SYNC
→ QA_READY
→ PR_OPEN
→ PR_CI
→ QA_FINAL
→ MERGE_READY
→ MERGED
→ MAIN_VALIDATION
→ MAIN_ARTIFACT_VALIDATED
→ [RELEASE_REQUIRED] RELEASE_VALIDATION
→ CLEANUP
→ CLOSED
```

실패 시 `REWORK(<target phase>)`, 권한/환경으로 진행 불가하면 `BLOCKED(<reason>)`를 기록한다. 상태 이름은 진행 보고를 위한 운영 표준이며 별도 GitHub Project automation을 의미하지 않는다.

### 9.2 Issue Work Packet

Manager는 각 위임 전에 최소 다음을 고정한다.

- repository / issue number / issue URL / lifecycle phase
- goal / acceptance criteria / scope / non-scope / dependencies / risks
- default branch / main SHA / working branch / working head / existing PR / CI
- risk_level (LOW/MEDIUM/HIGH), risk_reason/triggers, affected_paths, qa_required, qa_review_mode, reviewer, qa_evidence, manager_decision; 분류/재분류 근거
- current version / version decision과 근거
- release_required / release_authorized / 승인 근거
- primary Agent / collaborators / writable files / read-only files / shared interface
- Local Fast Feedback / required tests / docs / remote CI / 환경별 검증
- predecessor result / expected output / next owner / stop conditions
- Issue Progress Log 후보와 댓글 작성 권한: `issue_log_type`, `issue_comment_writer`, `issue_comment_allowed_types`

`issue_comment_writer` 기본값은 `manager`다. infra가 댓글을 직접 작성하도록 위임할 때만 `issue_comment_writer=infra`를 명시하고, `issue_comment_allowed_types`는 `STATUS`, `EXCEPTION` 또는 두 유형의 조합으로 제한한다. 필드 누락, `manager`, `NONE`은 infra에 대한 쓰기 위임이 아니다. `issue_log_type` 자체도 댓글 작성 권한을 부여하지 않는다.

Agent는 packet과 실제 저장소 상태가 다르면 조용히 보정하지 않고 Manager에게 차이를 반환한다.

### 9.2.1 위험도 기반 QA_FINAL 분기 (#565)

PLAN/Work Packet·PR·REWORK·병합 전 `risk_level`(LOW/MEDIUM/HIGH)과 `risk_reason`/`qa_required`/Reviewer/최신 Head를 기록한다. HIGH는 실제 `qa_docs` 또는 별도 인간 Reviewer 필수이고 없으면 BLOCKED, LOW/일부 MEDIUM만 `QA_FINAL=N/A(reason)` 가능하다. MEDIUM의 복수 ownership 경계/회귀 등 트리거는 독립 검토 의무이며 기존 코드/문서/CI 검사 생략 근거가 아니다. [판정 순서·예외 및 테스트 시나리오](QA_REVIEW_POLICY.md)를 따른다.

이슈 #580의 GitHub Actions 자동 QA 대체 경로는 **#580 bootstrap PR 병합 및 신뢰된 main 실행 검증 전까지 미적용**이다. Ruleset의 승인 리뷰 수 0명을 독립 QA PASS로 간주하지 않으며, 모든 경우 Manager의 Head 연결 ACCEPT가 필요하다.

### 9.3 Phase Gate

| Phase | 필수 완료 조건 | 다음 단계 책임 |
| --- | --- | --- |
| INTAKE/ANALYSIS | 실제 Issue/main/기존 PR·branch 확인, AC/scope/non-scope | Manager |
| PLAN | 역할, 파일 소유권, interface, 테스트/문서 계획 | Manager + domain |
| VERSION_DECIDED | keep/patch/minor/major 결정과 release 판단 | Manager |
| BRANCH_READY | 최신 main 기반 Issue branch/worktree 또는 기존 branch 재사용 | infra |
| IMPLEMENTING | 지정 파일 내 구현/테스트 변경 | Work Packet의 지정 구현 Agent(domain 또는 infrastructure-only 이슈의 infra) |
| LOCAL_VALIDATED | 관련 Local Fast Feedback 실제 결과 | Work Packet 지정 구현 Agent |
| DOCUMENTATION_SYNC | 문서 영향 분석 완료, required docs 갱신 또는 항목별 N/A 근거 기록, 코드·계약·문서 정합성 확인 | Manager가 지정한 문서 작성자; 기본은 Work Packet 지정 구현 Agent |
| QA_READY | DOCUMENTATION_SYNC PASS + 위험도별 qa_required 결정(독립 Reviewer 지정 또는 N/A 근거) + 구현 결과/증거 전달 | Manager/조건부 Reviewer |
| PR_OPEN/PR_CI | 단일 PR, 최신 head의 quality/e2e/docker | infra |
| QA_FINAL/MERGE_READY | HEAD별 `qa_method=AGENT`은 실제 독립 Reviewer PASS, `AUTOMATED_MANAGER`는 main Trusted QA PASS·Manager HIGH 위험 수용, 보호된 정책/Workflow는 무조건 독립 Reviewer PASS; 비의무 검토는 N/A(reason). 모든 경로에 최신 세 CI·DOC_SYNC·리뷰 해결·Manager ACCEPT 필수 | qa_docs 또는 인간 Reviewer(필요 시) + Manager |
| MERGED | 승인 head의 실제 merge SHA | infra |
| MAIN_VALIDATION | merge SHA의 main CI 완료 | infra |
| MAIN_ARTIFACT_VALIDATED | 정책상 ci-<SHA> exact digest smoke/SBOM/provenance/cleanup | infra + 위험도별 Reviewer/Manager |
| RELEASE_VALIDATION | 필요한 경우 명시적 승인 기반 정식 tag/CI/GHCR | Manager + infra |
| CLEANUP | 안전한 branch 정리, docs/evidence 최종 동기화 | infra |
| CLOSED | 모든 필수 AC/gate와 잔여 위험 기록 | Manager |

### 9.4 DOCUMENTATION_SYNC Gate

Issue 조치와 Local Fast Feedback이 끝난 뒤 QA에 들어가기 전에 관련 문서를 독립 Gate로 동기화한다.

Manager는 PLAN 단계에서 `required_docs`와 문서 작성자를 지정한다. 기본 작성자는 해당 변경의 지정 구현 Agent(domain 또는 infrastructure-only 이슈의 infra)이며, 여러 영역에 걸친 공용 문서는 Manager가 단일 작성자를 지정한다. `qa_docs`는 read-only reviewer이므로 이 Gate의 문서를 직접 수정하지 않는다.

DOCUMENTATION_SYNC PASS 조건:

- 변경된 기능·API·DB·Scheduling·UI/UX·Excel·배포·CI·보안·운영 계약이 어떤 문서에 영향을 주는지 문서 영향 분석을 수행한다.
- Work Packet의 `required_docs` 각 항목을 실제 변경하거나, 갱신이 불필요하면 항목별로 `N/A`와 근거를 Result Contract·Issue·PR 중 추적 가능한 위치에 기록한다. 실제 갱신 문서는 해당 작업 head에 포함되어야 하지만 N/A 근거만을 위해 불필요한 Git 파일 변경을 만들지 않는다.
- 최소한 관련 요구사항/Architecture/API/DB/Scheduling/UI/Deployment/CI/Test Plan/CHANGELOG 중 영향받는 문서를 현재 코드 및 Issue AC와 일치시킨다.
- 과거 검증 기록이나 완료 시점 문서를 현재 상태로 소급 변조하지 않는다. 새 상태는 현재 문서/Issue/PR에 추가 기록한다.
- Result Contract에 `documentation_impact`, `docs_required`, `docs_updated`, `docs_n_a_with_reason`을 남긴다.
- 문서 링크/참조와 용어·버전·계약이 현재 구현과 모순되지 않는지 확인한다.
- 문서 갱신 이후 구현/계약이 다시 바뀌면 DOCUMENTATION_SYNC PASS는 stale이며 다시 수행한다.

필요 문서가 실제로 하나도 없는 변경도 Gate 자체를 생략하지 않는다. 문서 영향 분석 결과와 `N/A` 근거가 있어야 PASS할 수 있다. DOCUMENTATION_SYNC가 FAIL/BLOCKED/NOT TESTED이면 QA_READY로 전환하지 않는다.

### 9.5 Agent 반환 계약

모든 Agent는 Issue number, lifecycle phase, baseline SHA, 상태(PASS/FAIL/BLOCKED/NOT TESTED), findings/changes, files, commit/head, 실제 테스트/결과, documentation impact와 docs required/updated/N/A 근거, 미검증, 위험, next phase/owner를 반환한다.

구현 Agent가 자신의 구현 범위를 넘어 version/tag/PR/merge/GHCR/Issue close를 독자 실행하지 않는다. infrastructure-only 이슈에서 infra가 구현 Agent여도 Manager의 version/release/merge gate를 넘어서지 않는다. qa_docs/researcher/ui_ux는 read-only이며 쓰기 작업을 직접 수행하지 않는다.

### 9.6 Issue Progress Log 계약

GitHub Issue는 요구사항 Source이자 작업 진행 기록의 기준점이다. Manager는 사람이 Issue만 읽어도 현재 단계, 완료/미완료 사항, 다음 조치, 차단 요인을 파악할 수 있도록 필요한 시점에 댓글을 남긴다. 단, 모든 명령·도구 호출·반복 조회를 기록하지 않는다.

표준 기록 유형:

| 유형 | 기록 시점 | 최소 내용 |
| --- | --- | --- |
| `PLAN` | 분석 후 실행 계획 확정 시 | 현재 phase, 범위/비범위, 단계별 계획, 역할/소유권, **risk_level/qa_required/reviewer**, 검증/문서 계획, version/release 판단 |
| `STATUS` | 주요 phase 전환 또는 의미 있는 진행 완료 시 | 이전→현재 phase, 완료 항목, 현재 head/PR/CI 등 핵심 증거, 다음 조치 |
| `EXCEPTION` | 예상 밖 제약·실패·위험·workaround 발견 시 | 사실, 영향, 원인/가설 구분, 임시 조치, 재작업 대상 phase |
| `DECISION_REQUIRED` | 사용자/maintainer 결정 없이는 진행할 수 없거나 범위가 달라질 때 | 결정 질문, 선택지, 각 영향, 권장 기본안이 있으면 근거, 미결정 시 차단 범위 |
| `RESUME` | 중단/세션 재개/기존 작업 인수 시 | 실제 원격 상태 재조회 결과, 재사용 branch/PR/run, stale evidence, 재개 phase와 남은 작업 |
| `FINAL` | 종료 직전 | AC별 결과, PR/merge/main/GHCR/문서/cleanup 증거, N/A/BLOCKED 구분, 남은 위험 |

기록 원칙:

- 동일 상태를 반복 게시하지 않는다. 새 evidence, phase 변경, 실패/차단, 결정 요청 등 **의미 있는 변화**가 있을 때만 추가한다.
- 짧은 작업은 `PLAN`과 `FINAL`만으로 충분할 수 있다. 장시간/다단계 작업은 주요 gate마다 `STATUS`를 남긴다.
- CI가 진행 중인 동안 polling 결과를 매번 기록하지 않고, 시작/실패/성공처럼 상태 의미가 바뀔 때만 기록한다.
- `PASS | FAIL | BLOCKED | NOT TESTED` 판정과 head SHA/run ID/PR 등 검증 식별자는 실제 evidence에 맞게 적는다.
- Secret, PAT, Password, Token, `.env`, 실제 DB 내용, 민감한 runtime log는 Issue/PR 댓글에 남기지 않는다. 필요한 오류 로그는 secret을 제거한 최소 발췌와 요약만 사용한다.
- Issue 댓글은 현재 사실을 기록하는 곳이지 과거 실패를 삭제하거나 덮어쓰는 곳이 아니다. 수정이 필요하면 새 댓글 또는 명확한 정정으로 추적성을 유지한다.

소유권:

- Manager가 Issue Progress Log의 최종 책임자다.
- frontend/backend/scheduler/excel_vba/infra 등 Sub-Agent는 작업 결과와 함께 `issue_log_type`, `issue_log_summary`, `decision_required`, 관련 evidence를 Result Contract로 반환한다.
- researcher/ui_ux/qa_docs는 read-only 경계를 유지하며 GitHub 원격 상태를 직접 수정하지 않는다.
- infra는 Work Packet에 `issue_comment_writer=infra`가 있고 현재 유형이 `issue_comment_allowed_types`에 포함된 경우에만 branch/PR/CI/GHCR 운영과 직접 관련된 `STATUS`/`EXCEPTION` 댓글을 대신 남길 수 있다. `issue_log_type`만으로는 위임된 것으로 간주하지 않는다.
- infra에 허용할 수 있는 댓글 유형은 `STATUS`/`EXCEPTION`의 부분집합뿐이다. `PLAN`, `DECISION_REQUIRED`, `RESUME`, `FINAL`과 범위/AC/version/release 판단 및 최종 완료 판단은 Manager 소유다.
- 실제 댓글을 남긴 Agent는 Result Contract에 `issue_comment_posted_by`와 `issue_comment_url_or_id`를 반환한다.
- Sub-Agent가 위임 범위 안에서 직접 댓글을 남겼더라도 Manager는 최종 상태와 충돌 여부를 확인하며, 동일 내용을 중복 게시하지 않는다.

`DECISION_REQUIRED`는 단순 정보 공유가 아니라 실제 의사결정 요청이다. 이미 Issue 본문/댓글 또는 사용자 요청에서 답이 확정된 사항을 다시 묻지 않는다. 결정 없이 안전하게 진행 가능한 범위가 있으면 그 범위는 계속 진행하고, 차단되는 phase만 명시한다. 보안·권한·정식 release 승인처럼 명시적 승인이 필요한 항목은 추측하지 않는다.

### 9.7 REWORK와 재개

- 기존 Issue/branch/PR이 있으면 재사용한다.
- PR head가 바뀌면 이전 head에 연결된 모든 required PR CI(`quality/e2e/docker`)와 QA_FINAL(독립 PASS 또는 N/A) 판정은 변경 영향도와 무관하게 stale이다. 새 head에서 전체 required PR gate 및 위험도/QA 필요성을 재평가하고 해당 QA 절차를 다시 수행한다. Local Fast Feedback만 영향도 기준 재사용을 허용한다.
- 구현·계약 변경이 문서에 영향을 주면 이전 DOCUMENTATION_SYNC PASS도 stale이며 QA 전 문서 Gate를 다시 통과한다.
- 같은 원인 실패를 두 차례 반복하면 Manager가 가설/계획을 재검토한다.
- 중단 후에는 Issue/PR/CI/main을 다시 읽고 현재 상태에서 남은 단계만 실행한다.
- 이미 게시된 immutable version/tag는 재사용/덮어쓰기하지 않는다.
- 완료 상태를 과거 대화만으로 복원하지 않는다. 원격 evidence가 기준이다.

## 9. GitHub Actions / Ruleset 자동화 연결

이 문서의 단계별 책임을 GitHub Actions와 GitHub native protection으로 구현하는 상세 기준은 [ISSUE_LIFECYCLE_AUTOMATION.md](ISSUE_LIFECYCLE_AUTOMATION.md)를 Source of Truth로 사용한다.

핵심 gate는 `READY_FOR_DEVELOPMENT → READY_FOR_PR → READY_FOR_MERGE → READY_FOR_RELEASE → DONE`으로 관리한다. Manager/Agent는 판단·설계·구현을 담당하고, Actions는 반복 가능한 검증과 release/finalization을 담당한다.

병합은 required checks와 review/conversation resolution을 만족한 뒤 GitHub Auto-merge를 우선한다. PR head가 변경되면 이전 required CI와 최종 QA evidence는 stale이다. 신규 Issue별 release-helper workflow 생성은 금지하며 공용 lifecycle workflow로 수렴한다.

## 10. 범용 Lifecycle orchestration (#211)

Gate E의 반복 운영은 `.github/workflows/issue-lifecycle.yml`을 공식 범용 entry point로 사용한다. `verify`는 읽기 전용으로 현재 evidence를 진단하고, `release`는 승인된 formal release만, `finalize`는 exact main evidence 이후 release(필요 시) → safe cleanup → FINAL → close를 수행한다.

workflow가 신뢰하는 식별 입력은 Issue/PR 번호다. PR base/head/relation, required checks, merge SHA, current main ancestry, target version, exact main CI와 release evidence는 GitHub/repository에서 다시 읽는다. `release_required=true`인데 `release_authorized=false`이면 mutation은 BLOCKED다. `expected_version`은 target commit manifest와 일치 여부만 검증한다.

PR merge 책임은 Ruleset/required checks/GitHub Auto-merge에 남기며 범용 workflow는 merge API를 호출하지 않는다. 정식 image 게시를 복제하지 않고 `release-image.yml`을, branch 삭제는 `safe_branch_cleanup.py`를 재사용한다. 자세한 운영 계약은 [ISSUE_LIFECYCLE_AUTOMATION](ISSUE_LIFECYCLE_AUTOMATION.md)을 따른다.


## release / finalize 통합 사용 규칙 (#248)

현재 `finalize` 구현은 `release_required=true`이면 정식 release를 먼저 확보한 뒤 branch cleanup과 Issue close까지 수행한다. 따라서 구현상 정식 release와 finalize를 한 번에 실행할 수 있다. Issue #248은 이 동작을 운영자에게 명시적으로 드러내는 `release_finalize` operation을 추가한다.

Manager는 operation을 다음처럼 선택한다.

- 릴리스 증거만 만들고 Issue를 계속 열어 둘 필요가 있으면 `release`.
- 정식 release가 불필요한 Issue를 종료하면 `finalize` + `release_required=false`.
- 정식 release가 필요하고 명시적 승인까지 확보되어 release부터 종료까지 연속 수행하면 `release_finalize`.
- Issue #248 구현 전 같은 목적이면 기존 `finalize`에 `release_required=true`와 승인 입력을 사용한다.

`release_finalize`를 선택했다고 해서 승인을 자동 추론하지 않는다. 반드시 동일 Issue/버전 범위에 대한 명시적 `release_authorized=true` 근거와 `authorization_note`가 있어야 한다.

## Generic 자동 finalizer 및 실패 재개 규칙

정상 경로는 `.github/workflows/release-finalizer.yml`이다. `CI`의 main push run이 성공하면 generic finalizer가 실행 시점의 current main snapshot에서 first-parent backlog를 계산하고, 각 merge의 exact PR과 canonical `Refs #Issue`를 resolve하여 oldest → newest 순서로 처리한다. `workflow_run` 도착 순서 자체는 release 순서 근거로 사용하지 않는다. Issue/PR/version을 hard-code한 one-shot workflow는 사용하지 않는다.

Release 필요 여부는 merge first parent와 target의 application version 차이로 판정한다. version이 동일하면 `finalize`, version이 변경되면 정식 release 대상이다. 단, release-required라는 사실과 release 승인 여부는 분리한다.

정식 release 승인은 Issue의 trusted maintainer comment에 아래 version-scoped marker로 기록한다.

```text
<!-- mastergantt-release-authorization:v1 {"authorized":true,"expected_version":"0.59.0","note":"사용자가 정식 GHCR 게시를 승인함"} -->
```

현재 개인 소유 저장소에서는 `author_association=OWNER` marker만 신뢰한다. 모든 Issue comment page를 조회한 뒤 최신 trusted marker가 authority이며 자세한 형식/revocation 규칙은 `docs/GENERIC_RELEASE_FINALIZER.md`를 따른다. 승인 부족은 BLOCKED이며 mutation하지 않는다.

실패 재개 원칙:

1. main CI 실패는 finalizer mutation 없이 종료한다.
2. release 승인 부족이면 marker를 기록한 뒤 기존 failed generic finalizer job을 재실행한다.
3. safe branch cleanup이 stacked/open PR dependency 때문에 중단되면 dependency를 최신 main/적절한 base로 정리한 후 기존 run을 재실행한다.
4. release-image 실패는 exact tag를 이동/덮어쓰지 않고 원인을 보완하여 기존 lifecycle evidence를 재개한다.
5. `issue-lifecycle.yml workflow_dispatch`는 generic 자동 경로를 사용할 수 없는 복구 fallback으로만 사용한다.

## Main artifact evidence gate (#352)

Generic/manual lifecycle의 merged target 검증은 PR required checks와 exact main CI success에 더해 **main 임시 GHCR artifact evidence**를 확인한다.

- exact merge first-parent diff가 docs-only가 아니면 `Main 임시 commit 이미지 게시·검증·정리` job의 completed/success가 필수다.
- docs-only이면 registry write는 N/A이며 해당 job의 completed/skipped를 기대한다.
- non-docs에서 job 누락/SKIPPED/FAIL/CANCELLED이면 gate는 `NOT TESTED`로 남고 branch cleanup, FINAL comment, Issue close를 수행하지 않는다.
- FINAL comment는 실제 job evidence를 기록하며 overall main CI success를 artifact PASS로 대체하지 않는다.


## 연속 동일 Issue 보완 merge 수렴

main CI가 실패한 merge는 release/finalize 근거가 아니므로 그대로 게시하거나 종료하지 않는다. 그 merge 직후 같은 Issue를 참조하는 보완 PR이 연속으로 merge된 경우에도 **검증 scope가 동등한 경우에만** 최신 target으로 수렴시킨다.

- 각 merge의 immediate first-parent diff를 동일 docs-only 규칙으로 판정한다. 모두 docs-only이거나 모두 non-docs일 때만 coalesce한다.
- 앞선 merge가 non-docs인데 최신 corrective merge가 docs-only인 경우처럼 scope가 다르면 수렴하지 않는다. 최신 docs-only main CI가 이전 code change의 E2E/Docker/임시 GHCR evidence를 대신할 수 없기 때문이다.
- 다른 Issue merge가 사이에 있어도 수렴하지 않고 기존 oldest → newest 순서를 유지한다.
- 수렴 target은 최신 merge SHA/PR을 사용하지만 release 필요 여부는 첫 시도 이전 version → 최신 version의 전체 span으로 판정한다.
- coalesce된 모든 PR 번호를 cleanup obligation으로 보존한다. formal release가 필요하면 release 성공 후, 필요 없으면 gate PASS 후 각 merged PR branch를 공통 `safe_branch_cleanup.py`로 검증·삭제한다.
- 이전 PR branch가 이미 없으면 safe cleanup의 idempotent 경로로 통과할 수 있지만, 보호/open dependency/tip 변경 등 하나라도 cleanup이 거부되면 FINAL marker와 Issue close를 수행하지 않는다.
- 최신 target의 exact main CI, main artifact gate, latest PR required checks와 version-scoped OWNER release authorization은 그대로 필수다.
- 동일 Issue라는 이유만으로 임의의 과거 merge를 건너뛰거나 다른 Issue의 실패를 우회하지 않는다.

Issue #344의 CI #1370 후속 보완이 이 복구 경로의 첫 적용 사례다.


## 실패 attempt/release의 후속 corrective merge 대체 검증

과거 main merge의 exact CI가 실패했거나, exact main CI는 SUCCESS지만 해당 merge의 **immutable formal release가 completed non-success로 반복 실패**한 경우에도 동일 Issue의 후속 corrective merge가 나중에 존재하고 그 **exact main CI가 SUCCESS**이면 Generic Release Finalizer는 과거 target 자체를 release/finalize하지 않고 후속 corrective target으로 대체할 수 있다. 이때 중간에 다른 Issue merge가 있어도 해당 Issue들은 first-parent 순서를 그대로 유지하며 각각 자신의 exact main CI와 release 조건을 독립적으로 통과해야 한다.

- 후속 corrective target은 과거 target과 같은 Issue를 참조해야 한다.
- corrective target의 validation scope가 과거 target보다 약하면 대체하지 않는다. non-docs 실패는 docs-only corrective CI로 덮을 수 없다.
- corrective exact main CI가 아직 Green이 아니면 과거 실패 target은 그대로 blocker다.
- formal release failure supersession은 version tag가 원래 target SHA를 가리키는 annotated immutable tag이고 exact release-image attempt가 모두 completed non-success인 경우만 허용한다. release가 queued/in_progress이면 DEFERRED하며 supersede하지 않는다.
- 실패한 exact tag는 이동·삭제·덮어쓰기하지 않는다. corrective merge는 현재 main 다음의 새 SemVer를 사용한다.
- superseded target에는 release/finalize mutation을 수행하지 않는다. 해당 PR branch cleanup 의무는 corrective target으로 이관한다.
- 중간 Issue의 release/finalize 순서는 건너뛰거나 재정렬하지 않는다.
- 이 규칙은 실패한 중간 version을 별도 정식 release하지 않고, 검증된 corrective version에서 원 Issue를 마무리하기 위한 것이다.

Issue #344의 failed main-CI attempt 복구와 Issue #331의 immutable `v0.65.1` Release quality 반복 실패 → corrective release 복구가 대표 시나리오다.


## 동일 merge SHA의 Main CI 재실행 evidence (#520)

PR head의 required check는 기존대로 required check 이름별 최신 check-run을 authority로 사용한다. 그러나 merged `main`의 exact SHA는 immutable하므로 동일 SHA에 Main CI가 중복 실행될 수 있다.

- release/finalize는 exact SHA에 대해 **completed/success이면서 해당 run의 main artifact gate까지 유효한 run** 중 최신 것을 사용한다.
- non-docs merge는 `Main 임시 commit 이미지 게시·검증·정리=SUCCESS`, docs-only merge는 동일 job의 `SKIPPED`가 필요하다.
- 성공 evidence가 하나도 없으면 최신 exact-SHA run을 diagnostics로 남기고 mutation은 NOT TESTED/DEFERRED로 유지한다.
- 후속 중복 run 실패 이력은 그대로 보존하며, 이전 성공을 재사용한다는 이유로 failed run을 삭제·재분류하지 않는다.

이 규칙은 동일 SHA의 immutable source에만 적용하며, 새 commit/head의 이전 CI를 재사용하는 규칙이 아니다.


### Issue #586 — 복수 PR/동일 Issue FINAL 회복

개별 병합 PR을 exact merge SHA별로 추적하고 기존 FINAL을 불변으로 보존한다. 다른 SHA에 유효한 역사적 marker가 있다는 이유만으로 새 PR의 FINAL을 거부하지 않으며, 중복·위조 marker, PR/Issue identity와 first-parent 불일치에는 fail-closed한다. 각 target의 required checks, main CI, GHCR 분류·정리 증거는 통합/축약하지 않는다. 최신 후속 PR까지 완료되기 전에는 Issue 종료를 지연하고 FINAL 선행 감사 및 비파괴 cleanup preflight 뒤에만 삭제를 허용한다. 상세는 [GENERIC_RELEASE_FINALIZER.md](GENERIC_RELEASE_FINALIZER.md).
