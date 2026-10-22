## Issue #752 — 별도 읽기 전용 진단·알림의 역할 (2026-10-22)

기본 REWORK A→G 순서와 Issue별 영속 원장은 유지한다. `.github/workflows/issue-752-diagnostics.yml`은 인증된 original `ci-pr-source-<run>-<attempt>`/Job/현재 PR의 2회 이상 실제 Full 실패만 감지해 **별도 비차단** 댓글·Job Summary로 `DIAGNOSIS_RECOMMENDED`를 권고한다. 취소·metadata-only·집계/QA 파생 실패·미실행은 독립 실패로 합산하지 않는다.

Owner/writer가 수동 `workflow_dispatch` 실행해 exact Head/Base/test-merge/Issue 원장 및 변경 E2E를 인증한 뒤 이전 실패 파일 합집합∪직접 변경 테스트를 최대24 spec·4 parts·`retries=0,max-failures=0,fail-fast=false`로 실행한다. 추가 간접/음성 소비자 누락은 Owner의 원장 보완이 필요하고 상한을 넘으면 자동 범위 축소/Full 재실행 없이 BLOCKED. 테스트 출처·부분 미실행·인증 누락·Artifact 만료를 `NOT RUN/INCOMPLETE_EVIDENCE/BLOCKED`로 명시한다.

Actions > 진단 Run의 **Job Summary** 및 14일 보존된 정제 JSON/Markdown Artifact를 보고 원장에 확정 원인/보완/동결 소스 검증 결과를 사람이 기록한다. Run 댓글은 결정적 PR/Head/실패집합 키로 갱신하고 Artifact 없는 READY를 금지한다. 원시 Trace/민감 로그와 전체 요청 URL을 Git/댓글에 넣지 않는다. 진단 `RESOLVED_CANDIDATE`/READY는 원본 3 Required PASS, Trusted QA, Owner 승인, Main/Release/Finalizer가 아니며 과거 실패를 PASS로 바꾸지 않는다. 자세한 권한/상태/테스트 계약은 [#752 Work Packet](exec-plans/active/ISSUE_752.md).

---

# PR CI 실패 — Issue별 누적 원장과 전체 이력 기반 REWORK

> **공통 운영 지침 / Source of Truth** — PR CI 실패를 **직전 Run만 기준으로 고치는 방식은 허용하지 않는다.** 첫 실패부터 Primary Issue별로 별도 문서에 기록하고, 재실패 시 해당 Issue의 **전체 실패 이력**과 과거 보완·회귀 결과를 종합해 진단한다.
>
> **적용:** `pull_request` Full PR CI, metadata-only 검사, rerun attempt, 기존 Issue의 복수 PR, 실패 후 REWORK/중단·재개. Main/Release CI 실패에는 원본 증거 분리 원칙을 적용하되 PR 실패와 하나의 Run으로 합산하지 않는다. 이 지침은 CI 설정이나 필수 Gate 자체를 변경하지 않는다.

## 1. 파일 소유권과 생성 시점

- 이슈별 정규 경로: **`docs/ISSUE_<N>_FAILURE_ANALYSIS.md`** (대문자 `ISSUE`, Primary Issue 번호). **Issue당 1개 누적 Markdown 원장**을 사용한다. 동일 Issue의 재실행마다 다른 분석 문서를 만들거나 이전 실패 절을 덮어쓰지 않는다.
- **최초 PR CI 실패가 확인되면**, 실제 Run/Job/Attempt를 확인한 뒤 해당 파일을 생성한다. 동일 이슈의 **후속 실패마다 같은 파일의 실행 목록 및 신규 실패 절을 추가**한다. 원장을 최신으로 갱신하고 종합 진단을 끝내기 전에는 다음 보완을 완료·새 CI를 시작했다고 보고하지 않는다.
- 기존 예외를 이전하거나 삭제하지 않는다. [Issue #667의 누적 분석](ISSUE_667_FAILURE_ANALYSIS.md)은 이미 이 규칙을 충족하는 선례다. 과거 `docs/exec-plans/**`, `docs/evidence/**`의 개별 실패 문서는 **출처를 링크**하고 중복·이전 복제로 원장을 분열시키지 않는다. 미작성 과거 실패는 기존 링크를 기반으로 요약·역추적하여 보강한다.
- 필요할 때만 `docs/evidence/issue-<N>/ci-<run>-attempt-<A>.json` 등으로 **실행별 보조 증거**를 둔다. 과거 보조 증거 파일은 변경·재사용하지 않는다. Git에는 정제한 증거·명령·지문만 저장하고, raw 로그/대용량 trace/HTML report·Secret·PAT·개인정보·운영 DB는 저장하지 않는다.
- Issue가 여러 PR로 이어져도 **같은 Issue 원장 하나**에 PR 번호별로 묶어 기록한다. 한 PR이 여러 Issue를 참조하면 PR의 **canonical Primary Issue**에서 원본 원장을 관리하고 다른 Issue에는 출처 링크와 영향만 남긴다. 타 Issue의 실패를 무단으로 본 Issue 실패라고 간주하지 않는다.
- 원본 실패 판정과 그때의 가설·수정·검증 결과는 **불변 이력**으로 보존한다. 분석이 바뀌면 기존 기록을 삭제하거나 PASS로 바꾸지 않고 **날짜·근거가 있는 정정/추가 분석 절**을 붙인다. 원장 기록은 GitHub CI 원본 성공을 대체하지 않는다.

## 2. 첫 실패부터 누적하는 필수 필드

실패 또는 재실패마다 GitHub 원격의 **실제 Run/Job/Artifact**를 확인하여 아래 내용을 채운다. 조회 불가·로그 만료·취소·미실행은 추정하지 않고 `UNKNOWN/BLOCKED/NOT TESTED`와 결손 구간을 적는다.

| 범위 | 필수 증거 |
| --- | --- |
| 귀속 | Primary Issue/URL, 관련 PR/URL, 발생 일시, `workflow`/event, Run URL/ID, attempt 번호, 정확한 `head SHA`, `base SHA`, `test-merge SHA`(확보 시), branch 및 변경 계약 |
| Job | Required `quality`/`e2e`/`docker` **aggregate**와 실제 실행 Job/Shard/Step의 ID·결론을 별도 기록. policy/preflight/metadata, build, Docker, E2E 원인과 **후속 파생 실패** 구별 |
| 최초 실패 | 최초 **실제 오류**의 테스트 파일/케이스/위치, 메시지 핵심, 예상·실제 값, 발생 시각·재현 조건, 로그 및 artifact/trace URL·확보 가능 여부. 단순 최종 aggregate FAILURE만 기록하지 않음 |
| 전체 실행 결과 | `PASS / FAIL / CANCELLED / SKIPPED / NOT RUN / BLOCKED / UNKNOWN`을 각각 명시. **취소된 Shard 로그에도 실제 FAIL이 찍혔으면 보존**; 미실행/취소를 PASS나 0건 성공으로 계산하지 않음 |
| 원인 판단 | `PRODUCT`, `TEST_CONTRACT`, `FIXTURE_OBSERVABILITY`, `INIT_TRANSPORT`, `ENVIRONMENT`, `POLICY_CI`, `UNKNOWN` 중 관찰에 맞게 구분. 검증된 사실/가설/기각 근거 및 공통·신규·재발 여부 |
| 보완·검증 | 변경 파일·commit/fingerprint, **제품 수정 또는 테스트 수정** 근거, 영향 소비자와 선정·제외 파일, 로컬 명령/환경/시간/상태/고유 case 수, 이전 대비 미해결, remote 새 CI의 검증 여부 |
| 인계 | 진행 책임(Manager/infra/domain/Reviewer), 잔여 위험, 추가 조사·재시도 조건, 미해결 리뷰·merge conflict 상태, 다음 Head/Run 계획 및 승인 경계 |

**출처 규칙:** `Run ID`와 `Attempt`를 쌍으로 사용한다. 동일 Run의 rerun은 기존 실패를 덮어쓰는 새 PASS가 아니라 **다른 Attempt**다. PR의 `synchronize`가 만드는 서로 다른 Head도 각각 기록한다. Test merge의 SHA가 Head와 다른 점, 취소로 일부 Job이 이미 완료된 점을 명시한다. GitHub 기록이 현재 접근 불가하면 원장의 과거 출처를 활용하되 **전체 실패 회수가 완료되었다고 단언하지 않는다**.

## 3. PR CI 재실패 시 강제 실행 순서

| 단계 | 책임 | 다음 단계로 넘어갈 근거 |
| --- | --- | --- |
| **A. 원격 이력 재수집** | infra | Issue의 **전체 관련 PR**과 해당 PR의 Full/metadata CI, 모든 실패 Run·Attempt, 취소된 Job·Shard, 기존 수정 후 재실행까지 수집. 최신 main/base/head/test merge·workflow/event를 다시 조회; pagination/권한/보존 기간으로 누락 시 표시 |
| **B. 기존 원장 대조** | Manager | 해당 `ISSUE_<N>_FAILURE_ANALYSIS.md`, 과거 correction/evidence, Issue/PR comments·Work Packet을 **전부 읽고**, GitHub 실제 이력과 대조해 누락 보강. 과거 증상·원인·반례·교정된 파일/계약을 재확인 |
| **C. 전 이력 종합 진단** | Manager + domain/infra | 아래 **Cross-run 실패 매트릭스**를 갱신. 동일 원인의 재발/이전 교정에 따른 회귀/새 원인/파생 실패/환경 문제를 구분; 제품과 fixture 모두 검토. 불확실한 가설은 확정 원인으로 사용 금지 |
| **D. 제한적 확대 재현** | 해당 구현 Agent | 각 과거 실패 파일의 **합집합 + 새 실패 + 변경 영향의 직접·간접·음성 소비자**로 진단 범위를 선정. 로컬은 **fail-fast 없이** 실제 오류를 끝까지 수집하고 원본 source·통제 변형·비재현 PASS를 분리 |
| **E. 원인 유형별 일괄 보완** | domain/infra | 재현·근거에 따른 제품/테스트 계약/fixture/환경/CI 수정. 최초 FAIL만 고치는 순차 땜질 대신 같은 결함을 공유하는 다른 소비자도 함께 처리. assertion 완화·skip·일괄 timeout/retry 증가 금지 |
| **F. 동일 source 교차 검증** | 구현 Agent + Manager | 코드·테스트·fixture 후보 source **동결** 후 직접/과거 전 실패/인접/음성 사례를 재실행. source fingerprint와 실행 명령·환경·결과 기록; 도중 변경 시 결과 stale로 재실행. 필요한 정책·build/Docker 검증 별도 |
| **G. 원장 갱신·PR 제출** | Manager + infra | 실패 이력, 원인·반례·교정, 재검증·미검증·잔여 위험을 **같은 이슈 문서에 저장**. Work Packet·관련 docs 갱신, 리뷰 스레드/충돌 검사 뒤 새 PR CI 실행. **새 Head의 Required 결과는 시작 시점에 NOT TESTED** |

- **재실패 시 A→B→C를 생략할 수 없다.** 이미 파악된 모든 장애의 관계를 확인한 뒤 테스트 집합과 수정 우선순위를 결정한다. 직전 Run에 오류 1건만 보여도 그 파일만 고치는 방식은 허용하지 않는다.
- 원장이 없거나 초기 이력이 불완전하면 새 원장을 만들고 **접근 가능한 전체 이력을 백필**한다. 로그가 만료되었거나 권한이 없을 때는 `INCOMPLETE`와 결손 Run/Attempt를 명시한다. 접근 불가로 원인을 증명할 수 없으면 `UNKNOWN/BLOCKED`이며, **미관측을 성공으로 취급하지 않는다**.
- 한 원인의 수정이 **2회 연속 실패**하거나 다른 오류가 계속 순차 노출되면 Manager는 단일 가설/커버리지/초기화 순서·환경 일치·제품 계약을 다시 검토한다. 총 실패 집합을 수렴시키지 않은 채 무제한 rerun하지 않는다.
- 다른 에이전트/세션에서 같은 Issue를 이어받아도 **새 진단보다 원장 전체 읽기가 먼저**다. 최신 Run을 추가해 누락을 막고 해당 Issue의 기존 branch/PR을 재사용한다.

## 4. 전체 실패 매트릭스와 진단 범위

원장의 모든 **원본 실제 실패 사례**에 대해 다음 표를 유지한다. 이 표가 *직전 실패가 아니라 전체 이력*을 사용했음을 감사할 수 있는 증거다.

| 실패 ID (PR·Run·Attempt·Job) | 이전 실패 파일/계약 | 당시 판정·교정 / 증거 | 최신 재발 또는 다른 소비자 영향 | 현재 후보 source 검증·잔여 위험 |
| --- | --- | --- | --- | --- |
| F-001 · PR #... / Run ... / 1 | 파일·case·expected/actual | 근거가 확인된 분류·commit·링크 | 같은 원인 재발/새 원인/미관측을 구별 | PASS/FAIL/NOT TESTED, 명령·fingerprint |
| F-002 · PR #... / Run ... / 2 | 파일·case·expected/actual | 동일 증상이어도 별도 원인 가능 | 동일 source에서 확인한 소비자/환경 | PASS/FAIL/NOT TESTED, 잔여 원인 |

- 별도 **누적 실패 파일 합집합** 목록에 *최초부터 마지막까지* 모든 실제 실패 테스트 경로를 나열한다. 파일 이름이 같아도 서로 다른 case·setup 경계를 구분한다. 불변 원본의 `CANCELLED/SKIPPED/NOT RUN` 목록은 추가 검증 후보로만 다룬다.
- TEST_PLAN의 [#697 변경 영향 분석·교차 회귀 기준](TEST_PLAN.md#issue-697--변경-영향-기반-로컬-검증과-교차-회귀-선정-2026-10-16)에 따라 직접·간접·음성 경로를 추가한다. 변경 생산자/소비자 매핑 없이 무조건 전체 E2E를 계속 반복하는 것 역시 권장하지 않는다.
- `npm run verify:prepr -- --mode=diagnose --issue=<N> --pr=<P> --failure-log=<local-json> ...`는 [LOCAL_PREPR.md](LOCAL_PREPR.md#3-진단-이력-입력-실제-github-근거를-사용자가-수집)의 **검증 도우미**다. 입력 JSON은 GitHub API 자동 검증값이 아니므로 **사용자가 확인한 원격 Run/Attempt/Head/file**을 사용한다. 해당 모드는 서로 다른 실제 실패가 최소 2회·실존 테스트 최대 12파일 등의 제약이 있다. 제약 밖이거나 다중 PR이면 사유를 적고 수동 분할 진단하되 **전체 원장의 논리적 합집합은 누락 없이 유지**한다.
- Playwright 수동 진단 예시(선정한 **bounded subset**에 한함): `npx playwright test tests/e2e/<관련파일>.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0`. 이는 **로컬 진단 수집용**이며 GitHub PR의 shard 6개/`--max-failures=1`/matrix fail-fast 및 Required Gate를 변경하지 않는다.
- 처음 failure의 재현이 로컬에서 PASS여도 원격 failure는 그대로 기록한다. 통제 변형과 원본 실제 실패를 구분하고, 증거 없는 flaky/CI 환경 원인 확정은 금지한다.

## 5. Issue별 Markdown 원장 시작 템플릿

최초 실패 시 다음 구조를 채운다. **빈 섹션을 PASS로 남기지 않는다**. 과거 원장이 이미 있으면 형식 통일을 이유로 이력·증거를 삭제하지 않고 부족한 필드만 추가한다.

```markdown
# Issue #N / PR #P — 누적 PR CI 실패 분석
Primary Issue: #N | 관련 PR: #P, ... | 갱신일: YYYY-MM-DD
Source of truth: docs/PR_CI_FAILURE_TRIAGE.md

## 1. Run/Attempt 전체 목록
| PR | Run URL/ID·Attempt | event·workflow | Head/Base/Test merge | Required/Shard | 실제 FAIL·취소·미실행 | 원본 증거 |
| --- | --- | --- | --- | --- | --- | --- |
| #P | https://github.com/.../actions/runs/<id> · 1 | pull_request / CI | 각 SHA | ... | FAIL n, CANCELLED n, NOT RUN n | Job URL/artifact |

## 2. 누적 실패 파일 및 Cross-run 매트릭스
| 실패 ID·파일·case | 최초 원본 실패 | 당시 원인/교정 | 최신 source 재검증 | 누락/잔여 위험 |
| --- | --- | --- | --- | --- |

## 3. 개별 실패 사건 (추가 기록)
### F-001 — Run <id>, attempt <A>
- Source/환경/Run·Job·Shard/first actual failure:
- 사실/가설/기각·분류/재현:
- 제품/테스트/환경 수정·commit 및 선택/제외 영향:
- frozen source fingerprint·실행 명령·PASS/FAIL/NOT TESTED:
- 원본 artifact/별도 교정 JSON/미확인/다음 담당:

## 4. 누적 원인·공통 재현 및 보완 계획
- 제품/fixture/transport/환경/정책/UNKNOWN별 현황:
- 전체 실패 파일의 합집합 + 영향 교차·음성 목록:
- 이전 수정의 회귀·새 실패 및 수정 우선순위:

## 5. 같은 최종 source 검증과 다음 PR CI
- Freeze head/fingerprint/환경·실행 결과·잔여 위험:
- DOC_SYNC·QA 사전 검토·미해결 리뷰/충돌:
- 새 PR Head와 Run ID/Attempt: (시작 전 NOT TESTED)
```

## 6. 완료 기준 및 타 지침과의 경계

1. **누적성:** 접근 가능한 해당 Issue의 전체 PR/Run/Attempt가 목록화되고 모든 이전 실제 실패와 새 실패가 Cross-run 매트릭스에 연결된다. 누락·보존 만료·UNKNOWN은 명시되어야 한다.
2. **인과성:** 관측 사실/가설/반례/원인 분류/수정 코드 또는 테스트 계약 변경 이유가 남으며, 실패를 없애기 위한 assertion 완화·skip·timeout 일괄 증가가 없어야 한다.
3. **교차성:** 누적 실패 파일 합집합과 변경 영향의 직접·간접·음성 경로를 **동결된 동일 후보 source**에서 검증하고 미실행 사례 및 비용 범위를 명시한다.
4. **추적성:** 누적 원장, Work Packet, PR/Issue 댓글 및 새 CI Run이 이슈 번호와 Head/Attempt로 상호 연결된다. 문서 갱신을 수반한 PR synchronize는 새 Head의 검증이 필요하다.
5. **승인:** 로컬 PASS·원장 작성은 새 GitHub exact-Head PR Required `quality/e2e/docker`, Trusted QA/Owner, review thread=0, merge 충돌 해결, Main/GHCR/Finalizer를 대신하지 않는다. GitHub 원격 검증 시작 전 결과는 `NOT TESTED`.

**책임 분리:** infra는 원본 전체 이력·Job/Shard/환경·workflow 출처 수집, Manager는 누적 원장 완전성·원인 교차 분석·선정/승인, domain Agent는 제품·테스트/fixture 재현 및 교정, qa_docs/Reviewer는 해당 정책에서 지정된 경우 증거·미검증·문서 정합을 read-only로 검토한다. [Issue Lifecycle](ISSUE_LIFECYCLE.md), [CI/CD](CI_CD.md), [원격 증거](REMOTE_VALIDATION.md), [위험도·테스트 선정](TEST_PLAN.md), [로컬 검증 도구](LOCAL_PREPR.md)와 병행 적용한다.
