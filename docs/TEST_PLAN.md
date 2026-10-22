# masterGantt Test Plan

제품 기능·보안·스키마·사용자 경로 검증은 기존 Vitest/Playwright/Policy를 유지한다. 이 문서의 **Test Lifecycle** 절은 Issue [#711](https://github.com/planner77/masterGantt/issues/711)의 회귀 테스트 자산 추가·유지·통합·폐기 판단을 위한 **단일 원본(Source of Truth)**이다. 이 지침은 자동 Skip/테스트 삭제/CI Required 완화를 허가하지 않는다.

## Issue #697 — 변경 영향 기반 로컬 검증과 교차 회귀 선정

[#697](https://github.com/planner77/masterGantt/issues/697)은 *변경에 영향을 받는 기존 테스트를 선택*하는 단계다. AC/사용자 경로, 소스 호출·상태/HTTP·SQLite/DOM 경계, 인접 화면·음성 사례까지 영향 경로를 기록한다. LOW/MEDIUM/HIGH는 변경 위험과 미검증 영역을 함께 판정한다. 빠른 로컬 피드백은 Required3와 독립이다. 구체 Local Pre-PR 재현은 [#699](LOCAL_PREPR.md), 실패·재실행 이력은 [#704](PR_CI_FAILURE_TRIAGE.md), 실제 Gate는 [Issue Lifecycle](ISSUE_LIFECYCLE.md)·[CI/CD](CI_CD.md)를 따른다.

## Issue #711 — Test Suite Lifecycle (추가 → 검토 → 유지·통합 → 조건부 폐기)

### A. 신규 테스트 추가/기존 확장 판단 순서

1. Issue/AC와 실제 동작 계약(positive, negative, boundary, migration, race, 사용자 시나리오)을 명시한다. 변경 영향에 따라 #697의 `AC_TEST_COVERAGE에 직접/교차/음성 위험 경로를 적는다.
2. `기존 테스트 검색: `tests/**/*.test.ts`와 `tests/e2e/**/*.spec.ts`, CI Policy, 기존 Fixture를 **시나리오·단언·환경**으로 검색한다. 이름이나 Issue 번호만으로 존재·중복을 판정하지 않는다.
3. 기존 테스트가 **동일 위험 경계**를 보장하면 기존 케이스를 확장/파라미터화한다. 계약·입력 등가류·권한·DB·실제 브라우저 경계가 다르면 독립 케이스를 추가한다. Issue 전용 spec 생성은 의무가 아니다.
4. 가능한 한 순수 함수 단위 → API/SQLite 통합 → 실제 브라우저 E2E 순서로 검증 비용을 최소화한다. 서로 다른 위험 경계를 막는 단위·통합·E2E의 병존은 중복이 아니다.
5. 테스트의 fixture·독립 DB·시간·비동기 실행·정리 조건, 예상 값의 외부 오라클을 검토한다. 테스트 대상 구현 코드에서 예상 값을 역산하거나 HTTP/SQLite를 mock PASS로 치환하지 않는다.
6. PR/Work Packet에 변경 계약, 기존 테스트 근거, `ADD / EXTEND / KEEP / CONSOLIDATE_CANDIDATE / RETIRE_CANDIDATE`, 계층·실행 증거·미측정 위험을 `TEST_LIFECYCLE_REVIEW` 형식으로 기록한다. 이슈별 기존 `AC_TEST_COVERAGE`를 복제하지 않고 참조한다.

| 판정 | 기준 | 조치 | 긍정 / 금지 사례 |
| --- | --- | --- | --- |
| `ADD` | 신규 AC/유효한 음성·보안·SQLite migration·revision 경계를 다른 테스트가 보호하지 않음 | 해당 계층에 최소 독립 케이스 추가 | 새 스키마 오류 시 원복 검증 추가 / Issue 번호별 의미 없는 spec 생성 금지 |
| `EXTEND` | 기존 테스트의 계약·환경은 같고 경계 입력만 늘어남 | 기존 test.each/fixture에 새 입력과 비퇴화 단언 추가 | 동일 권한 로직의 잘못된 토큰 추가 / 다른 권한 계약을 한 단언으로 축소 금지 |
| `KEEP_UNIQUE` | 별개 위험 경계·환경·사용자 경로 보호 | 유지, 계약 소유자 명시 | password KDF 단위와 브라우저 편집 세션 E2E 병존 / 계층만 다르다고 제거 금지 |
| `DUPLICATE_CANDIDATE` | 입력 동등성·환경·관찰·단언이 모두 같을 **가능성** | AC/fixture/실패 이력 비교 후 Owner 리뷰 | 파일명·제목 유사성은 후보 신호일 뿐 삭제 근거 아님 |
| `PARTIAL_OVERLAP` | 준비 코드·fixture·일부 assertion만 중복 | 독립 assertion 유지, 공통 helper·파라미터화 고려 | Target 공유 fixture 재사용 / HTTP 412와 사용자 UI 상태 동시 삭제 금지 |
| `STALE` | 승인된 현재 제품 계약과 과거 UI/fixture 오라클 충돌 | 계약 승인 확인 후 수정/대체, 구 실패 이력 보존 | UI 명칭 변화에 맞춘 접근성 assertion 수정 / 테스트 삭제로 조용히 통과 금지 |
| `FLAKY_OR_EXPENSIVE` | 비결정성·긴 fixture·Timeout·병렬 영향 | 로그/Trace/Run·Attempt 원인 분석 후 안정화·계층 조정 | 시간 분해·격리 / 무단 skip, retry 증가, timeout만 확대 금지 |
| `RETIRE_CANDIDATE` | 계약 폐지 또는 완전 동등 대체가 근거로 증명됨 | 아래 폐기 Gate를 통과할 때에만 제거 | 같은 소스의 대체 PASS + Owner 승인 / 이전 실패 가리기 금지 |

### B. 중복 검증 기준과 시범 감사

**완전 의미 중복**은 같은 비즈니스 계약·입력 등가류·관찰 대상·assertion·실행환경에서 유효하게 반복한다는 증거가 모두 필요하다. 단위+E2E, mock+실제 DB, 보안 음성/정상 흐름, 이전 migration/새 migration, 동시성/revision 서로 다른 경계는 의미 중복으로 판정하지 않는다. 유사 제목 검색·fixture import 그래프는 `CANDIDATE_ONLY`다.

| 실제 소스(현재 main) | 겹침/차이와 AC 위험 | 초도 판정·권고 |
| --- | --- | --- |
| `tests/server/projects/edit-authorization-security.test.ts` ↔ `tests/e2e/project-edit-authorization.spec.ts` | 전자는 credential 길이·Cookie 서명/폐기·KDF 키 한도 등 순수 보안/서버 계약, 후자는 실제 편집 세션·HTTP401/412·revision 경합과 저장 후 브라우저 경로 | **KEEP_UNIQUE / 폐기 거절**: 서로 다른 보안·브라우저 경계. AC 손실 없이 상호 대체 불가 |
| `tests/e2e/issue-621-resource-target.spec.ts` ↔ `tests/e2e/issue-623-resource-mvp.spec.ts` | 둘 다 `isolated-application`, Target seed, 탐색 helper를 쓰지만 #621은 exact Assignment·공유 Task identity·409/412, #623은 복수 mutation·5M/D·Excel snapshot | **PARTIAL_OVERLAP**: 공통 준비/탐색 helper 재사용만 검토, 각 assertion 유지. 실제 테스트 삭제·통합 미실행 |
| `tests/server/db/issue-623-target-migration.test.ts` ↔ Target UI E2E | 전자는 pre-0025 데이터 보존·중간 실패 rollback·checksum/order 무결성, 후자는 현재 화면/HTTP 경로 | **KEEP_UNIQUE / 폐기 거절**: SQLite migration·실패 rollback 독립. UI 성공이 schema 안전성을 대체하지 못함 |
| 승인될 신규 migration/권한 AC 중 기존 네거티브 부재가 확인되는 경우 | 이전 스키마의 실패 후 rollback, 수정된 session 권한으로 타인 쓰기 거절 등 신규 경계 | **ADD 판단 예시**: 실제 AC·기존 부재를 이슈별로 확인한 뒤 테스트 추가. 본 이슈에서는 제품 테스트를 임의 추가하지 않음 |
| 동명 케이스·정규화 제목·동일 fixture import(인벤토리) | 실행환경·입력·단언 동일성은 자동 탐지 불가능 | **DUPLICATE_CANDIDATE**만 자동 표시. 의미 중복 확정·폐기 결정 없음 |

위 시범 판정은 **소스/시나리오의 정적 검토**다. 동일 Head의 테스트 실행·성공 또는 구체적인 비용 절감률을 증명하지 않는다. 코드는 수정하거나 삭제하지 않는다.

### C. 통합·폐기 안전성 Gate — 모든 조건 필수

1. **계약 근거:** 승인된 요구사항 폐지 또는 대체 테스트 `old ID → new ID`, AC→positive/negative/security/migration/race/브라우저·DB 계층 coverage를 diff 전후 표로 입증한다. 계약 소유자와 경계 누락 여부를 기록한다.
2. **안전한 리팩터링:** 공통 helper/table-driven 활용, 실행 독립성·실패 진단성·shard 균형 유지. 대형 단일 E2E로 합쳐 병렬/원인 분석을 악화시키지 않는다.
3. **정확한 재검증:** *동일 source/tree*에서 대체 단위·통합/E2E를 실행해 실제 PASS, 현재 PR의 Full Required3·Trusted QA·strict main을 원본 Run/Attempt·Head/Base/Test-Merge와 교차 검증한다. 이전 Head PASS/파일 개수/skip은 증거가 아니다.
4. **Review/Owner 승인:** 명시적 책임자·Reviewer 미해결 스레드 0·잔여 위험·HIGH QA gate·Owner 결정을 기록한다. 승인 전에는 삭제/skip/assertion 완화/Required gate 변경 금지.
5. **Rollback:** 단위별 커밋과 old↔new ID/계약 매핑, revert 범위·관측 지표·Main 회귀 발생 시 복구 절차를 남긴다. 실패·flaky 이력과 Issue 링크는 지우지 않는다.

Flaky quarantine은 재현·Issue·Owner·복구 시한·필수 Gate 영향과 명시적 승인이 있는 **임시 예외**만 고려한다. Required 회귀 미실행을 PASS로 바꿀 수 없다. Global retry/timeout/Assertion/Shard/Path 필터·Ruleset 변경은 별도 Issue/승인 대상이다.

### D. 읽기 전용 최초 인벤토리와 반복 실행

최초 기준선: [Issue #711 Inventory](TEST_LIFECYCLE_INVENTORY_711.md). 도구: `scripts/test_lifecycle_inventory.py`. 실행 시 소스 테스트/CI 설정을 수정하지 않는다. Git SHA, Node/Vitest/Playwright 버전, 대상 Run·Attempt·Runner·OS를 보고서 외부 provenance로 기록한다.

```bash
# 의존성 설치 없이 실제 파일 수·policy 선언을 조사한다. case 수는 UNKNOWN.
python3 scripts/test_lifecycle_inventory.py --mode static --output-dir /tmp/issue-711-static

# 기존 npm ci로 의존성이 준비된 checkout에서 수집만 수행(테스트 본문은 실행하지 않음).
python3 scripts/test_lifecycle_inventory.py --mode discover --output-dir /tmp/issue-711-discover

# Parser + 음성 경계 단위 테스트 (원격 Full CI를 대체하지 않음)
python3 -m unittest discover -s tests/python -p 'test_test_lifecycle_inventory.py' -v
node scripts/check-markdown-links.mjs
```

- `inventory.csv`: 계층, 테스트 경로, 발견된 case 제목/Policy 명령, 환경/실행 조건, 수집 근거. `summary.json`/`summary.md`: **파일 수와 수집된 케이스 수를 별도** 집계, 동명 case 후보만 표시. `static` 모드 케이스 수는 `UNKNOWN`이다.
- Vitest 5 `list --json`은 test declaration discovery이며 동적 생성/parameterized 케이스는 실제 `npm test` 실행 총계와 교차 확인한다. Playwright `test --list`는 Chromium case discovery이며 실제 실행/Skip/Shard PASS가 아니다. 수집기 오류나 발견 값 불일치는 비정상 종료하고 **0으로 치환하지 않는다**. Python 정책 `test_*` 메서드 수는 정적 정의 수일 뿐 실행 케이스 수가 아니다.
- Policy job은 현재 `ci.yml`의 선언된 실행 명령·조건을 조사한다. `quality/e2e/docker` aggregate 결과, 경로 선택, Full/Targeted/Docs-Only 증거, 릴리스·Finalizer의 독립 판정은 [CI/CD](CI_CD.md)·[QA 정책](QA_REVIEW_POLICY.md) 원본을 따른다.
- 실행시간 p50/p90·Runner minutes, flaky율/재발·고비용 spec 분류는 같은 runner/OS/소스/샤드·기간의 **실제 성공/실패 Run/Attempt·Trace**로 집계한다. 측정하지 못한 항목은 `UNKNOWN/NOT TESTED`이며 절감률을 임의 산출하지 않는다.

### E. 리뷰 서식과 운영

PR/Work Packet에는 기존 `AC_TEST_COVERAGE`와 링크된 다음 한 표만 추가한다. 신규 필드의 값을 비워 “중복 없음”이라고 단정하지 않는다.

| TEST_LIFECYCLE_REVIEW 필드 | 기록 내용 |
| --- | --- |
| Changed contract / AC | 관련 Issue AC와 positive·negative·security·migration·race / 실제 UX 조건 |
| Existing search | 실제 검색한 테스트 **파일/케이스/공통 fixture**, 수집된 source·version |
| Decision | `ADD/EXTEND/KEEP_UNIQUE/PARTIAL_OVERLAP/CONSOLIDATE_CANDIDATE/RETIRE_CANDIDATE` |
| Evidence | 영향 경로(#697), 전후 테스트 매핑, 정확 SHA의 실제 local/PR Run/Attempt PASS 또는 NOT TESTED |
| Risk / Owner | 잔여 coverage·비용·flaky·rollback, 변경 Reviewer/Owner 승인 및 미해결 여부 |

**주기:** 4주마다 또는 각 릴리스 중 빠른 때에 전체 인벤토리 갱신 → 변경된 계약/파일·케이스 수 및 후보 → 공통 fixture·느린 E2E p50/p90·runner-min·flaky/재발 → 유지/통합/폐기 제안 → Owner 승인. 전후 비교는 동일 수집/Runner·샤드/CI 기준으로 수행한다. 기준 정보나 비용 자료가 없으면 `INSUFFICIENT_DATA`. 판정/유효한 사례·과거 이력은 별도 인벤토리와 Issue/PR에 추적하고 이 문서 정책을 복제하지 않는다.

### F. 현재 CI·릴리스 및 역할 경계

현재 `main`의 정책/설정은 8 Chromium shards와 **세 Required Checks** `Build, static checks, and unit tests`, `Chromium end-to-end tests`, `Docker build and runtime smoke test`이다. Initial #711 설명의 6-shard는 **2026-10-17 역사 기준**이다. PR Fast/Full/Targeted 근거(#659/#771/#772), pre-PR(#699), 영향 선정(#697), 실패 원장(#704), 비용 배분(#437), Issue Lifecycle/Trusted QA·Owner 결재, GHCR/Generic Finalizer는 이 이슈에서 변경하지 않는다.

이 지침 자체는 `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `release_required=false`, `release_authorized=false`. 신규 Head Required3/Trusted/Owner 결과가 없으면 `NOT TESTED`이고 병합·Main·GHCR·Finalizer·Issue 종료는 별도 승인 및 근거가 필요하다.
