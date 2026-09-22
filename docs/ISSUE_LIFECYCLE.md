# Manager Issue Lifecycle와 Sub-Agent 자동 배분

적용: Issue #87, 2026-09-22. 공통 진입점은 [AGENTS.md](../AGENTS.md)다. 이 문서는 실행 환경의 Manager가 따르는 위임 규칙이며 GitHub 이벤트를 감시하는 서버나 새로운 Actions workflow가 아니다. 실제 Sub-Agent 생성 도구와 권한이 있는 세션에서만 독립 실행을 주장한다.

기술 계약은 [REMOTE_VALIDATION.md](REMOTE_VALIDATION.md), [CI_CD.md](CI_CD.md), [GITHUB_OPERATIONS.md](GITHUB_OPERATIONS.md)가 우선한다. UI 기준은 [UI_UX_GUIDELINES.md](UI_UX_GUIDELINES.md), 역할 설정은 [AGENT_CONFIGURATION.md](AGENT_CONFIGURATION.md)를 따른다. 이 문서로 기존 CI gate나 승인 경계를 완화하지 않는다.

## 1. 요청 해석과 실행 준비

Manager는 사용자가 Issue 처리를 요청하면 별도의 역할 선택 질문 없이 다음을 수행한다. 조회 가능한 정보는 먼저 조회하며, 사용자 결정이 필요한 실질적인 범위·보안 모호함만 질문한다.

1. 저장소, Issue 본문/댓글, 관련 코드/문서, 진행 중 PR/branch, main SHA, 현재 version/tag와 CI 상태를 조회한다. 과거 대화의 상태를 현재 상태로 간주하지 않는다.
2. 목표, 비범위, 인수 기준, 의존성, 위험, 요청된 마지막 단계를 확정한다. 분석만 요청한 작업을 구현/병합/게시로 확대하지 않는다. 여러 이슈를 순차 진행하라는 요청이면 하나를 완료하기 전 다음 이슈를 변경하지 않는다.
3. `release_required`(정식 릴리스 필요성/범위), `release_authorized`(기본 false인 명시적 게시 승인)와 각각의 근거를 기록한다. 단순 “Issue Lifecycle 전체 진행”만으로 두 값을 true로 간주하지 않는다. 범위가 불명확하면 release_required는 미확정으로 남기고 게시 전에 범위/승인을 확인한다. 사용자가 게시를 제외하거나 PR까지만 요청하면 그 경계에서 멈춘다. 문서/Agent 지침만 변경하고 제품 산출물에 영향이 없으면 정식 release는 N/A로 기록한다. 이 예외로 실제 실행되는 main 임시 GHCR 검증을 생략하지 않는다.
4. 실제 사용 가능한 Agent 실행/파일/명령/브라우저/GitHub/Actions 도구, 모델 접근과 권한을 확인한다. 기존 동시 실행 한도는 6이며 실제 runtime 제한이 더 작으면 작은 값을 따른다. 모든 역할을 상시 실행하지 않는다.
5. 실행 도구가 없으면 `실행 방식: 단일 에이전트 순차 처리`와 미실행 항목을 기록한다. 역할별 검토를 했다는 이유로 독립 Sub-Agent/QA를 실행했다고 하지 않는다. 필수 독립 검토를 확보할 수 없으면 해당 gate는 BLOCKED다.

### 정식 게시 승인 경계

“정식 GHCR 게시까지 진행”처럼 사용자 또는 지정 maintainer가 해당 이슈의 릴리스를 명확하게 포함해 요청/승인했을 때만 release_authorized=true로 기록한다. 승인자, 요청/승인 근거, 대상 이슈·릴리스 범위를 인수인계에 남긴다. 이미 확인한 동일 범위의 승인은 반복 요청하지 않는다. “전체 진행”이라는 일반 표현, 이 Lifecycle 지침의 추가/수정 요청, Manager의 자체 판단이나 PR/CI 성공만으로 승인을 만들지 않는다.

| 필요성/승인 | 정식 릴리스 처리 |
| --- | --- |
| release_required=true, release_authorized=true | 기존 CI/tag/registry gate를 통과한 뒤 승인 범위의 정식 게시·검증 |
| release_required=true, release_authorized=false | BLOCKED/승인 대기. annotated tag·정식 게시·rolling tag 변경 및 전체 이슈 완료 금지 |
| release_required 미확정 | 범위/승인 확인 전 정식 게시 금지. 미확정을 N/A나 완료로 숨기지 않음 |
| release_required=false | 승인된 범위 밖이라는 근거로 정식 release N/A. 실제 실행되는 main 임시 GHCR gate는 유지 |

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
| 요구사항·테스트·보안·문서·원격 증거 검토 | qa_docs | 작성자와 분리된 reviewer; 최종 판단은 Manager |

`ui_ux`는 정보 구조·사용 흐름·상태·접근성·검증 기준을 제안하는 읽기 중심 역할이다. 실제 UI/test 수정은 frontend, 설계 문서 반영은 Manager 또는 명시된 문서 작성자가 맡는다. qa_docs는 read-only reviewer이며 문서를 직접 고치도록 배정하지 않는다. 두 역할 모두 MCP/API를 통한 쓰기까지 하지 않는다. 읽기 전용 sandbox만으로 connector 쓰기까지 차단된다고 가정하지 않는다.

## 3. 단계와 진입/완료 조건

```text
접수/현재 상태 확인 → 분석/필요 역할 배정 → 설계·계획·버전 결정
→ 작업 branch/worktree → 구현·관련 테스트·문서 → Local Fast Feedback
→ QA 사전 검토 → PR → CI → QA 최종 검토/Manager 병합 승인
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
| 구현/문서/빠른 검증 | 지정 구현 담당 | 범위 내 diff, 회귀 테스트, 실제 실행 명령·exit 결과; version 수정도 작업 branch에서 수행 |
| QA 사전 검토 | qa_docs, UI 설계 비교는 ui_ux | 요구사항↔코드↔테스트↔문서 비교, 실패/미검증 목록; frontend 자체 PASS로 대체 금지 |
| PR/CI | infra | PR head와 테스트된 merge/base ref, run/job/attempt; quality/e2e/docker 실제 성공 |
| 병합 승인 | qa_docs 최종 검토 + Manager | 마지막 수정 이후 head의 필수 CI/검토 PASS, 미해결 차단 사항 없음, 병합 승인 범위 확인 |
| main 병합 | infra | 승인한 head를 지정한 merge, 실제 merge SHA; base 이동/충돌로 diff가 바뀌면 재검증 |
| main CI/GHCR | infra, qa_docs 확인 | merge SHA의 gate → 임시 ci-image → exact digest smoke → SBOM/provenance → cleanup |
| 정식 GHCR 게시 | infra, Manager의 명시적 release 승인 근거 확인 | release_required=true와 release_authorized=true 확인 후 아래 4절의 tag/Release CI/registry 검증. 필요 없는 경우만 사유와 함께 N/A |
| 정리/종료 | Manager 판단, infra 실행 | 필요한 모든 gate 완료, 인수 기준별 증거, 잔여 위험/환경 검증 기록, 안전한 branch 정리 |

버전은 Manager가 한 번 결정하고 infra가 한 번 반영한다. 각 구현 Agent가 독자적으로 version/tag를 만들지 않는다. 문서/Agent 지침만의 변경은 제품 영향이 없음을 확인하고 application version을 유지할 수 있다. 기능/버그·운영 계약 변경에는 이 예외를 적용하지 않는다.

## 4. GHCR는 게시와 검증을 함께 완료한다

GHCR 주 담당은 infra, 독립 증거 검토는 qa_docs, 게시 범위와 최종 판단은 Manager다. PR/수동 일반 CI는 read-only이며 registry write를 하지 않는다. 상세 tag/권한/runtime 계약은 CI_CD를 따른다.

### 4.1 main 임시 이미지

main의 quality/e2e/docker 성공 후 기존 `publish-commit-image` job을 확인한다. `ci-<full SHA>` 게시, build output의 exact digest 재다운로드, image policy/readiness/API 인증·영속성/native SQLite/restart smoke, SBOM/provenance, 임시 package version 정리를 각각 기록한다. 실패해도 workflow의 정리 결과를 확인한다.

임시 `ci-*`는 운영 또는 rollback용 정식 이미지가 아니다. 검증 뒤 삭제되는 임시 게시를 “새 정식 버전 사용 가능”으로 보고하지 않는다.

### 4.2 정식 버전 이미지

`release_required=true`이면 아래 순서를 완료해야 이슈를 종료할 수 있지만, `release_authorized=true`와 명시적 승인 근거를 먼저 확인해야 tag 생성·정식 게시를 실행할 수 있다. 필요한 릴리스의 승인이 없으면 BLOCKED/승인 대기이며 N/A가 아니다. 사용자가 해당 이슈에 정식 게시까지 명시적으로 승인한 경우 동일 범위의 승인을 반복 요청하지 않는다. Lifecycle 문서 수정 요청 자체를 임의의 제품 릴리스 승인으로 해석하지 않는다.

1. 사용자/지정 maintainer의 명시적 승인 근거와 범위, 필수 PR/main gate, 대상 source SHA, package/lockfile/CHANGELOG, 단조 증가 version, 기존 동일 tag/image 부재, release authority를 확인한다.
2. 검증한 main commit에 package version과 일치하는 annotated `v<version>` tag를 생성하고 기존 `release-image.yml`을 실행한다. tag push가 workflow를 시작하지 않았다면 승인 범위에서 해당 annotated tag ref의 workflow_dispatch를 사용한다. 일반 branch CI 실행으로 대체하지 않는다.
3. Release CI와 게시 전 local candidate smoke가 성공한 뒤 workflow가 exact version 이미지를 GHCR에 게시했는지 확인한다. 수동 docker push, quality gate 생략, exact tag 덮어쓰기는 하지 않는다.
4. registry에 게시된 exact digest를 다시 pull한 runtime smoke와 SBOM/provenance를 확인한다. attestation은 활성화된 경우 결과를 확인하고 비활성 상태를 PASS로 표시하지 않는다.
5. stable release만 기존 exact/rolling tag 정책의 promotion 결과를 확인한다. prerelease는 stable alias를 변경하지 않는다. version/tag, source SHA, run/job/attempt, image 경로, digest, smoke와 promotion 근거를 남긴다.
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

작업 브랜치는 merge 여부와 미병합 commit/다른 PR 참조가 없음을 확인한 뒤 승인 범위에서만 삭제한다. 보호 branch/tag/운영 데이터는 삭제하지 않는다. 삭제 권한이 없으면 정리 BLOCKED를 남긴다.

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
| Workspace 여러 화면 재설계 | ui_ux 설계 → frontend 구현 → qa_docs → infra; 필요 시 backend |
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
| Sub-Agent 도구 없음 | 순차 처리 명시, 가짜 실행 ID/독립 QA PASS 금지 |
| 동일 파일을 두 Agent가 요구 | 소유자/선행 순서 확정 전 병렬 쓰기 금지 |
| 중단 후 PR/이미지가 이미 존재 | 최신 상태로 재개, 중복 PR/tag/publish 금지 |

## 공식 참고자료

확인일: 2026-09-22. 프로젝트별 선택과 외부 기능 설명을 구분한다.

- [OpenAI Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents): 프로젝트별 Agent TOML과 AGENTS 지침 기반 위임, 실행 환경/권한 확인.
- [OpenAI Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference): 동시 thread 설정.
- [GitHub Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry): image 게시와 digest pull. 세부 release 정책은 저장소 CI_CD가 기준이다.