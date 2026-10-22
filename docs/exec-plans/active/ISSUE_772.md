# Issue #772 — LOW 선택 E2E의 정식 증거 계약 (2026-10-22)

## Scope, baseline & hard gates

- 기준: #770 신뢰된 base Shadow, #771 Draft advisory/Ready Full, #712 post-merge source 보호. 열린 #713/#711/#752는 감사·진단 참조이며 결과를 소급 성공으로 만들지 않는다. 현재 공식 E2E **8 shards**, 제품 버전 0.129.1, Ruleset #24043042 Strict + Required3 고정.
- 이 변경 자체는 **HIGH / OWNER_MANAGED / qa_required=true**. `LOW_TARGETED_POLICY_ENABLED`는 기본 OFF. 새 플래그/선택 E2E는 Owner 명시 전환, 최소 10개의 서로 다른 실제 LOW 후보 Full 성공 Shadow run과 negative 회귀, 전용 protected 시험 PR 전후 비교가 없으면 운영 ON 금지.
- 작업 수명: ISSUE_CHECK → ANALYSIS → PLAN → CODE → LOCAL_VERIFICATION(가능한 범위) → DOCUMENTATION_SYNC → PR CI START. 이 요청은 PR CI 시작까지만이며 Main/Finalizer/GHCR/이슈 종료·모니터링 없음. 신규 정책 변경 PR은 base 정책 기준 **Full8/8**, 기존 QA Trusted와 Owner 위험 수용이 필요하다.

## Design and evidence contract

- `scripts/ci_low_policy.py`: 이미 설치된 base의 #770 분류기만 사용하며 Run ID+Attempt, 정확 base/head/test-merge 부모, 정책 blob SHA, 전체 binary diff SHA256, test-plan hash, 선정/배제 spec ID·근거와 inventory를 포함한다. **오직** `src/features/projects/project-settings-dialog.tsx` 세션 도움말의 기존 비대화형 `<p>` 한 줄 텍스트만 변경된 때 선택 후보가 가능하다. Work Packet 동반 변경은 검사해 제외한다. 새 파일·rename·test 수정·button aria name·focus·shared/global CSS·routing/Gantt viewport·db/auth/API/CI/QA/lock/test fixture·알 수 없는 관계는 Full8.
- 실행 `TARGETED_POLICY_CANDIDATE`는 PASS가 아니다. 선택 직접/인접/음성 기존 spec **세 개 이상**을 정확 test-merge에서 Playwright Chromium 실제 수행하고 `--retries=0`, workers=1, JSON reporter의 개별 case/status/coverage·skipped0/중복 없는 파일을 검사한다. base 정책 `attest`가 별도 receipt를 작성한다. 무실행/스킵/취소/타임아웃/재실행/이름 변경은 BLOCKED.
- `scripts/ci_low_source.py`: default-main/신뢰된 base 검증기에서 PR source artifact, run attempt, Head/Base/Test-Merge, 모든 샤드·정책 Job topology, 정책 Git blob·원본 compare 및 변경 전후 문구, 선정된 모든 test Git blob, 과거 실패 Full source를 재검증한다. PR 본문 LOW·Work Packet·artifact만으로 허용하지 않는다.
- mode: `FULL_REQUIRED`(기존 Full8, 도입 당시 기본), `TARGETED_POLICY_VERIFIED`(명시적인 비 Full 실행), `DOCS_ONLY_VERIFIED`(기존 검증된 문서 경로), `NOT_RUN`, `UNKNOWN`, `BLOCKED`. 집계 세 Required Check 이름을 유지하되 Chromium check Summary/receipt가 `E2E execution policy PASS`의 실제 의미를 밝힌다. `FULL_E2E_PASS`가 아닌 Targeted를 Full로 오표시하거나 과거 Full 결과를 재사용하지 않는다.
- QA Automated/Trusted, edited metadata-only 소급 재사용, Lifecycle 및 Release source는 위 모드를 분리 검증한다. Main push의 **Full8/8 + Quality/Docker + 임시 candidate GHCR** 및 Owner 승인, 릴리스 Finalizer는 축소하지 않는다.
- 분쟁 시 OFF (Repository variable unset/false) → 기존 PR Full8로 즉시 롤백, 후속 원본 Run·차단 사유 보존. Required Context/Ruleset 수동 변경 없음.

## Remote experiment and measurement

1. **Phase 0 — OFF**: 이 보호 코드 PR은 Full8/8 + Trusted QA와 Owner HIGH 위험 수용을 거쳐야 한다. 현재 remote Full/Trusted **NOT TESTED**, 도입 자체로 선택 증거 권한이 생기지 않는다.
2. **Phase 1 — Shadow**: #770 기존 Full 성공만 대상으로 LOW 후보를 분류한다. 최소 **10 distinct** 원본 Full8 성공 Run/Attempt/Head/Base/Test-Merge, 유형별 샘플/부정 분류를 운영 표에 기록한다. 달성 전 상태 `INSUFFICIENT_DATA`. 실패 원장 #711/#752 교차 검토.
3. **Phase 2 — 시험 PR**: 보호 전용 비대화형 문구 변경 PR에서 OFF → Full8, ON → 선택·실제 3+ tests/인접 음성 실행, 동일 코드 위험 class·불변 diff를 비교한다. Main-only 회귀 0건, 누락/거짓 PASS 0건이 필요하다.
4. **Phase 3 — Owner 승인**: Owner가 Run IDs/HEAD/policy sha/문서 링크와 함께 **명시 승인 기록**한 후에만 `LOW_TARGETED_POLICY_ENABLED=true` 설정. MEDIUM/HIGH는 무조건 Full8. Ruleset 변경 필요시 Owner가 기존 세 Required Check/strict/review와 전환 전후 일치 확인·수동 rollback 승인. 본 구현은 **Ruleset을 변경하지 않는다**.
5. 비교 보고: before/after 각 Run wall-clock, 총 E2E Runner-minutes (샤드 Job elapsed 합), Quality/Docker·QA 포함 job 비용, 실패/누락/false PASS, PR 병합 지연 및 rollback Run; 환경·case/spec 분모와 미관측 구분. 성공을 임의 추정하지 않는다.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/ISSUE_LIFECYCLE.md`: UPDATED
- `DESIGN.md`: N/A(UI 구현 및 디자인 지침 불변)
- `docs/API.md`: N/A(외부 계약/API endpoint 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite schema 및 migration 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(SVAR/WBS 스케줄 동작 불변)

## AC_TEST_COVERAGE

- AC1: `tests/python/test_ci_low_policy.py::LowWhitelistTest`에서 정확 비대화형 `<p>`·button label/aria/focus·global/style/shared/DB/auth/CI/QA/Test/unknown FULL 검증; LOW 자기 선언 무권한.
- AC2: `tests/python/test_ci_low_policy.py::TargetedEvidenceTest`에서 실제 reporter success/skip/fail/cancel/retry/coverage 누락·출처 hash 검증; 원격 exact test-merge Chromium/결과는 NOT TESTED.
- AC3: `scripts/qa_final_automated.py`, `scripts/ci_low_source.py`, `scripts/verify-pr-metadata-evidence.py`, `scripts/issue_lifecycle.py`, `.github/workflows/{ci,qa-final-trusted,pr-metadata-reconcile,issue-lifecycle}.yml` 계약; #712/#713 음성 및 Ruleset #24043042 실증 원격 NOT TESTED.
- AC4: flag OFF Full8, Owner flag ON strict targeted mode, 나머지 Full8/Main/Release 불변; `tests/python/test_ci_low_policy.py` 부정 검증과 CI 가드; 실제 시험 NOT TESTED.
- AC5: 정책 변경 PR 자체 신규 exact-Head Full8/Trusted/Owner와 Shadow 서로 다른 10 Runs/ON-OFF 비용 보고 및 rollback Run 대기, INSUFFICIENT_DATA.
- AC6: `AGENTS.md`, `docs/CI_CD.md`, `docs/TEST_PLAN.md`, `docs/REMOTE_VALIDATION.md`, `docs/QA_REVIEW_POLICY.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/GITHUB_OPERATIONS.md` 모드/출처/선정·배제 사유/운영 및 Work Packet 매핑.
- AC7: 기존 Required3/Ruleset strict/review 불변, 필요한 경우 Owner-only 전환 전후/원복 절차를 `docs/GITHUB_OPERATIONS.md` 및 이 Work Packet에 기록; 현재 Ruleset 쓰기 수행하지 않음.

## Risks / release

- source artifacts·GitHub API/rate-limit·test inventory·병합 후 metadata-only 혼선·기존 #713 동작은 모든 경우 **fail closed**. 이전 Full 실패를 새로운 선택 성공이 뒤집지 않는다. 안전한 운영 기본값은 OFF.
- `release_required=false`, `release_authorized=false`, `manager_decision=NOT TESTED`. 앱 version, 정식 tag/이미지, DB, 업무 기능 UI, Finalizer 권한 변경 없음.
