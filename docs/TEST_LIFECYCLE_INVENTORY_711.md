# Issue #711 — 초기 Test Suite Inventory 및 사례 감사

- 출처: [Issue #711](https://github.com/planner77/masterGantt/issues/711), [main 기준 commit 6f9936f](https://github.com/planner77/masterGantt/commit/6f9936f353ad6c735af6ca1c33af1a6a4b8ecf7e), 기준 일시 2026-10-23 KST(원본 commit 2026-10-22T20:29:01Z).
- 원칙: [Test Lifecycle 단일 정책](TEST_PLAN.md#issue-711--test-suite-lifecycle-추가--검토--유지통합--조건부-폐기). 테스트 코드·CI 설정을 이 이슈에서 삭제하거나 완화하지 않는다.
- 인벤토리 생성기: [`scripts/test_lifecycle_inventory.py`](../scripts/test_lifecycle_inventory.py). 이 파일은 읽기 전용 분석 CLI이고 테스트 본문을 실행하지 않는다.

## 2026-10-23 REWORK 보정 — Source/Policy 단계와 실측의 분리

- 최초 이 문서의 **265 Vitest / 137 E2E 파일**은 원본 `6f9936f353ad6c735af6ca1c33af1a6a4b8ecf7e` 기준선이다. 이후 #762 병합에 따른 **Vitest 5파일, E2E 1파일** 순증으로 새 main 정렬 원본에서는 **270 Vitest / 138 E2E 파일**(테스트 케이스 수 아님). 새로운 변경에 대한 실제 `vitest list`/`playwright --list` 출처가 없으면 **수집 케이스 수 UNKNOWN** 유지.
- [PR #781 Full Run #3169.1](https://github.com/planner77/masterGantt/actions/runs/39857347455) Vitest 실제 실행 총계는 기존 Head 한정 **3,182 cases: 3,178 PASS / 1 FAIL / 3 SKIP**; 이 수치는 추가 #762 반영 후 새 PR Head의 수집/실행 케이스 수로 소급되지 않는다.
- 기존 `Policy` 수집기에서 `- run:`, `run: |` 또는 알려지지 않은 검증기를 제외한 것이 [Reviewer P2](https://github.com/planner77/masterGantt/pull/781#discussion_r4353727564)로 밝혀졌다. 신규 수집기는 **조건부 포함 모든 Policy run step 30개**(현재 #711 보완 Workflow 선언 기준, Node setup 계측과 shell 구문 명령 포함)를 필터 없이 수집한다. 이는 **step 선언 수**이며 실제 unittest case/Job 실행 여부 수가 아니다. 미지원/빈 항목 발견 시 0으로 보고하지 않고 fail-closed.
- 관련 Python Parser 테스트는 기존 Policy Job의 신규 명시적 한 단계로 실행하게 구성했다. 전체 CI 결과·코드 리뷰·SQLite 재오픈 실행 PASS는 새 Head PR 검증 전 **NOT TESTED**. 오진·리뷰 내용 및 실증 차이는 [F711-001 누적 실패 원장](ISSUE_711_FAILURE_ANALYSIS.md) 및 [Work Packet](exec-plans/active/ISSUE_711.md)에 남긴다.

## 1. 최초 기준선: 파일과 실행 가능한 케이스를 구별

| 계층 | 기준/발견 방법 | 실제 파일 수(2026-10-23 main) | 수집된 테스트 케이스 수 | 실제 실행 결과 |
| --- | --- | ---: | --- | --- |
| Vitest | `tests/**/*.test.ts`, 기존 `vitest.config.ts`의 탐색 대상 | **265** | **UNKNOWN / 미측정** — 설치된 Vitest `list --json`로 재확인 필요 | **NOT TESTED** |
| Chromium E2E | `tests/e2e/**/*.spec.ts`, `playwright.config.ts`의 testDir | **137** | **UNKNOWN / 미측정** — Playwright `test --list` 결과 필요 | **NOT TESTED** |
| Policy | `.github/workflows/ci.yml` Policy Job, Python `test_*` 선언 및 개별 명령 | **UNKNOWN / 전체 실행 case 수 아님** | **UNKNOWN** — 선언 명령/정적 메서드 수와 실행 case를 혼동 금지 | **NOT TESTED** |

파일 수는 GitHub main의 `tests` 하위 디렉터리·파일 목록을 재귀적으로 조사한 **정적 파일 인벤토리**이며, `test.each`·동적 시나리오·파라미터·브라우저 프로젝트 조합을 세지 않는다. 기존 `scripts/verify-test-discovery.mjs`는 단위 발견/Playwright 목록을 확인하지만 이 기록 작성 시 그 출력과 실제 실행 로그를 직접 입수하지 않았으므로 case 수를 임의 추정하지 않았다. 현재 8-shard는 `tests/config/e2e-shard-plan.json`의 `shardCount=8` 및 `ci.yml`의 Chromium 1/8~8/8과 부합한다. Issue 작성 당시 119개 E2E spec·6-shard는 **2026-10-17 당시 이력**으로 보존한다.

| 계측 항목 | 최초 기록 / 증거 갭 |
| --- | --- |
| Chromium/Vitest 실제 수집 케이스 수 | UNKNOWN — 의존성이 설치된 **같은 checkout**에서 `--mode discover` 수행·결과 보관 필요 |
| Policy 활성 명령/실행 조건 | Job 내부 정적 선언은 스크립트로 수집 가능; 조건부 실행·Python unittest 동적 수집·skip 수는 원격 실행 증거 없어서 UNKNOWN |
| 각 계층 실행 p50/p90, Runner-min, 느린 E2E/Fixture | UNKNOWN — 동일 runner/OS/shard/환경의 완료된 CI Run/Attempt 및 timing artifact 필요 |
| Flaky/Timeout/보안 실패 이력 | UNKNOWN — #704 누적 실패 원장과 #752 진단의 정확한 Head/Run/Attempt 정합 필요 |
| 의미 중복 확정 수, 실제 폐기 수, 개선율 | **의미 중복 확정 0건(판정 보류)**, **이번 삭제 0건**; 개선율 NOT MEASURED |

### 재현 가능한 수집 명령

```bash
# 설치 없이 파일/Policy 정적 선언만: 실제 case 수는 UNKNOWN으로 출력
python3 scripts/test_lifecycle_inventory.py --mode static --output-dir /tmp/mastergantt-711-static

# 같은 SHA에서 npm ci 뒤 실제 Vitest/Playwright *발견만* 수행
python3 scripts/test_lifecycle_inventory.py --mode discover --output-dir /tmp/mastergantt-711-discover

# 인벤토리 검사·Markdown 상대 링크
python3 -m unittest discover -s tests/python -p 'test_test_lifecycle_inventory.py' -v
node scripts/check-markdown-links.mjs
```

실패 시 수집기는 nonzero와 `UNKNOWN/FAIL`을 출력하며 **0 cases/0 duplicates로 대체하지 않는다**. CSV 각 행은 `layer,path,scenario,environment,count_basis`를 분리하고 `summary.json`은 파일·case·정적 Policy 선언을 별도로 보고한다. 출력 디렉터리는 Git 추적 경로가 아닌 임시 위치를 사용한다. 실측 CI evidence 없는 경우 `NOT TESTED`를 유지한다.

## 2. 실제 파일·시나리오 수준 시범 감사

아래는 **파일 내용과 명시적 시나리오를 읽은 정적 감사**로, 의미 중복 자동 판정이나 삭제 승인이 아니다.

| 계약과 원본 파일/실제 테스트 시나리오 | 겹침 및 고유 위험 경계 | 최초 판정 | AC 영향·조치 |
| --- | --- | --- | --- |
| `tests/server/projects/edit-authorization-security.test.ts`(credential 형식·Cookie·KDF/키 한도 등) ↔ `tests/e2e/project-edit-authorization.spec.ts`(W05 브라우저 편집 세션·401/412·동시 쓰기) | 인증 단위 보안 음성과 실제 사용자 세션/SQLite·revision 경합이 서로 다른 위험을 보호 | **KEEP_UNIQUE, 폐기 거절** | 권한/401/412, 패스워드 검증 및 실제 브라우저 흐름의 AC 손실 가능성 때문에 파일·테스트 모두 유지 |
| `tests/e2e/issue-621-resource-target.spec.ts`(공유 Task, exact Assignment·409/412·Target identity) ↔ `tests/e2e/issue-623-resource-mvp.spec.ts`(Target F0 5M/D·복수 mutation·Excel 원본 동일성) | `isolated-application`, `target-project`, `workspace-navigation` 등의 공통 초기화·탐색과 일부 UI assertion이 겹침. 업무/Excel·통합 저장 불변식은 다름 | **PARTIAL_OVERLAP, 부분 통합 후보** | 공통 탐색/seed helper 또는 fixture만 후속 PR에서 별도 측정·리뷰. 고유 저장/수정/Excel·음성 assertion은 유지. 이 PR에 실제 통합·삭제 없음 |
| `tests/server/db/issue-623-target-migration.test.ts`(pre-0025 upgrade, checksum/order, 실패 rollback) ↔ Target 브라우저 E2E | Migration의 기존 레코드 무손실·오류시 ledger 원복은 정상 UI/HTTP 성공으로 검증되지 않음 | **KEEP_UNIQUE, 폐기 거절** | SQLite rollback·데이터 보존 AC와 현재 UI 상태 각각 유지. Mock PASS/신규 버전 테스트로 구 migration 삭제 금지 |
| `tests/e2e/project-list-search-filter.spec.ts`(프로젝트 목록 검색, 반응형 표/삭제) ↔ `tests/e2e/project-search-filter.spec.ts`(Task/Resource 통합 검색·Gantt 인스턴스 불변) | 이름에 search/filter 공유하지만 대상 도메인·observable·상호작용 다름 | **CANDIDATE_ONLY, KEEP_UNIQUE 검토** | 제목만 보고 중복/폐기 확정하지 않는다. 후속 확정 시 assertion·DOM/HTTP/데이터 기준 실증 필수 |
| 향후 변경으로 새로운 취약한 migration 실패, session 권한 누락 AC 발견 | 기존 테스트 검색에서 그 정확한 위험 경계의 음성 케이스 미존재가 확인되는 경우 | **ADD 필요 신규 예시(조건부)** | 테스트 목록 검색 → 구 스키마/음성 oracle→ 기존 파일에 확장 또는 신규 통합 케이스. 이번 이슈는 제품 AC를 신설하거나 테스트를 실행하지 않는다 |
| `scripts/verify-test-discovery.mjs`와 Vitest/Playwright 기능 테스트 | 전자는 파일 탐색 계약·cwd 독립성, 후자는 테스트 본문의 제품 계약 | **KEEP_UNIQUE** | 탐색 스크립트 통과를 전체 회귀 PASS로 대체하지 않음 |

시범감사의 **유지·부분 통합 후보·폐기 거절·조건부 신규 추가** 사례는 증거 수준과 함께 명시했다. 동명 제목은 자동 `CANDIDATE_ONLY`로만 탐지하고, 모든 실제 통합/삭제에는 `old→new` AC/단언 전후 맵, 동일 source PASS, 리뷰·Owner 승인, 복구 커밋이 필요하다.

## 3. 정기 점검/다음 관측 의무

4주 또는 매 릴리스마다 저장소 정확 SHA와 Node/runner/OS·Vitest/Playwright 버전, `--mode discover` CSV/JSON, 정확 완료된 PR/Main Run ID/Attempt·원본 Shard timing artifact, #704 실패 원장 근거를 누적하여 전후 비교한다. `p50/p90/runner-min`, 실제 flaky 재발률, 완전 중복 후보/거절 이유, 통합 후 보존한 AC 비율은 **동일 조건**에서만 산출한다. 현재 측정값 없이 비율·절감 분량을 발표하지 않는다.

- 문서/스크립트 정적 검토: 수행(원격 파일/명령/경로 확인). 실제 검사/본문 수행: **NOT TESTED**.
- CI Required3, Chromium 8/8, 정확 Head/Base의 Trusted QA, 독립 UX·DB 제품 경로, Owner 위험 수용: **NOT TESTED**(PR 생성 후 원격 실증 대상).
- 기존 GitHub Actions 경로 판정/PR Full/Targeted·Main, GHCR/Finalizer, 사전 승인·릴리스: **전혀 변경하지 않음**.
