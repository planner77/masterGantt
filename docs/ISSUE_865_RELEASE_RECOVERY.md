# Issue #865 — 실패한 v0.141.0 릴리스의 새 PATCH 복구 계획

> 상태: **교정 PR 구현·원격 Full CI 준비**. 정식 Release 승인·게시 **미실행**. 원본 실패 기록과 immutable tag/OCI를 보존한다.

## 1. 확인된 원본 증거 (2026-11-04)

- Issue: https://github.com/planner77/masterGantt/issues/865 — Open; 별도 CI 검증 교정 Issue #874 PR #875는 Main에 병합됨.
- 원본 성공: #865 PR #871 / Main merge `78a48b29f3a6e5ec1a0a9817ffa1976dc4de74aa`; Main Full #3489.1 Run `41776085393` 성공, `ci-78a48b29f3a6e5ec1a0a9817ffa1976dc4de74aa` digest `sha256:a6a2b658f440280eca66a218b83ec5eb8b86c80d657d8082a7cabb794dcce842`.
- 원본 실패: immutable **annotated** `v0.141.0` tag `29e4ced88fe65d9dfe85820572b4f86125f93114`, 원래 SHA `78a48...`; [Release #216](https://github.com/planner77/masterGantt/actions/runs/41779185247) Attempt 1~5 FAILED. 최신 Attempt 5의 candidate Job `126470462213`는 `PR_ORIGIN_RELEASE_SOURCE_UNAVAILABLE:PR_MAIN_BUILDER_OR_INPUT_DRIFT`로 차단, 정식 promotion/handoff는 SKIPPED.
- 신뢰 경계: 원래 Main Run #3489.1에는 `ci-main-build-contract-<run>-<attempt>` artifact가 **없음**(당시 #874 수정 이전). 기존 태그에서 Checkout하는 Release workflow와 검증기 역시 원래 코드라 단순 `rerun failed jobs` 반복으로 새 검증이 적용되지 않음.
- #874 완료된 검증기 교정: [PR #875](https://github.com/planner77/masterGantt/pull/875), Main `8994d615fb5683c2a0d4aac973bf0fd04cf35278`, [Main #3497.1](https://github.com/planner77/masterGantt/actions/runs/41816072647) Required3/E2E8/Docker/임시 GHCR 이미지 성공. 신규 독립 Main builder 증거 `ci-main-build-contract-41816072647-1` 존재. 하지만 이는 **다른 SHA**의 새 증거이며 원본 #865 빌더 영수증으로 사용할 수 없다.
- [Finalizer #1351.1](https://github.com/planner77/masterGantt/actions/runs/41819758691)는 SUCCESS workflow이지만 `DEFERRED`: first-parent backlog의 #865/v0.141.0 실패로 후속 #874 lifecycle이 막힘.

## 2. 선택한 복구 방법과 금지 조건

**A. 동일 Issue #865의 별도 PATCH `0.141.1` — 권고·현재 준비 대상.**

1. 현 Main `8994d615...`를 정확 base로 하여 새 `issue-865-...` 브랜치/PR을 생성한다. `package.json`, `package-lock.json`의 root 3개 version 값을 **0.141.1**로 동기화하고 릴리스 안내, 이 계획, 원장, 회귀 테스트만 갱신한다. #865 사내 LLM 코드, UI/API, DB, dependencies 및 #874 보안 검증기는 수정하지 않는다.
2. **Primary `Refs #865`** PR·브랜치·제목을 고정한다. 새로운 PR의 Head/Test-Merge·Main Merge SHA는 원본 #871·#875와 달라야 한다. 이 차이를 같은 SHA로 재라벨하거나 Docker image의 OCI revision을 교체하지 않는다.
3. 새 정확 Head Full PR CI Required Quality/Chromium8/8/Docker 및 Main-trusted QA, 미해결 리뷰/충돌 0, Owner HIGH/Manager 수용을 확인한다. 제품 버전 외 소스 변화 없음을 diff로 확인하고 기존 LLM/OCI/권한 회귀 테스트를 유지한다.
4. 별도 Owner가 **정확한 `0.141.1` 릴리스와 새 SHA·잔여 위험을 명시 승인하기 전** `release_authorized=false`다. `v0.141.0` 기존 승인 영수증은 `0.141.1`에 전파하지 않는다.
5. 승인 후에만 PATCH PR을 표준 한 줄 한국어 Merge commit으로 Main에 병합, Main Full Quality/E2E8/Docker/GHCR의 실제 SUCCESS 확인 및 Main Run/Attempt별 독립 `ci-main-build-contract-<run>-<attempt>` 검증을 수행한다. 인증된 신규 OCI index digest·builder/attestation/소스·HTTP/HTTPS/SQLite smoke를 그대로 재사용하는 정식 `v0.141.1` Release 경로를 재평가한다.
6. Generic Finalizer `supersede_failed_issue_retries`는 old #865 formal release FAIL을 같은 Issue 신규 **상향 버전**의 Main CI 성공으로만 보완 대상 후보로 삼는다. 중간 #874 Merge의 first-parent 위치는 보존한다. 원본 `v0.141.0` 태그·실패 Run을 이동/삭제/소급 PASS 처리하지 않는다.
7. **위험:** 현 Finalizer는 새 교정 Main CI만 SUCCESS이면 옛 실패를 계획상 supersede할 수 있고, 새 `v0.141.1` 정식 Release SUCCESS 이전에도 중간 #874의 non-release lifecycle이 먼저 실행될 수 있다. 이를 정식 릴리스 성공으로 착각하거나 #865 자동 CLOSE를 확정하지 않는다. 새 Main 시점에 first-parent dry-run/로그를 재조회하고, 불합리한 조기 종료가 확인되면 별도 Fail-closed 보완·Owner 결정을 우선한다.

**B. 과거 태그를 그대로 재시도하는 방법 — 비권고/실행 금지.** 구 Tag code와 Main Run artifact 결손 때문에 교정된 Release 검증이 소급 적용되지 않는다. 변경 없이 반복할수록 실패 기록만 증가한다.

**C. 별도 역사적 신뢰 복구 Workflow — 보류.** 구 Main Run의 누락된 빌더 영수증을 임의 위조/재발행하지 않아야 하며, GitHub CI 원본 로그만으로 cryptographic Main receipt를 대체할 수 없다. 새 장기 운영 코드를 만들고 기존 버전 태그를 수정하기보다 신규 PATCH 경로가 우선이다.

## 3. TEST_LIFECYCLE_REVIEW 및 검증 Gate

- **ADD**: `tests/python/test_ci_image_recovery_865.py` — 실제 Finalizer 구조의 (a) #865 실패 Release → #874 중간 → #865 PATCH 0.141.1 positive; (b) 같은 버전 태그 재사용·Main 미성공·다른 Issue·docs-only 교정 negative; (c) 원본 v0.141.0 Owner 승인이 새 v0.141.1 승인으로 인식되지 않는 negative; (d) package/lock 버전 일치 positive.
- **KEEP_UNIQUE**: `tests/python/test_ci_image_{contract,release,reuse}.py`, `scripts/test-release-debt-audit.py`, `scripts/test-release-debt-recovery.py`, `scripts/test_main_ci_recovery.py`, `scripts/verify-release-version.mjs`, LLM 보안 테스트 및 Full 8-shard/Docker/QA/Ruleset/Owner Gate.
- 배포 전 negative: Main builder receipt 누락·Run/Attempt mismatch, 원본 PR/Main digest·Tree·builder 변경, tag SHA 변경/서명 없는 tag, 현재 버전 외 tag reuse, 후보 GHCR 미발행, 오래된 Full 성공 사용, 다른 Issue의 corrective merge, PATCH 승인 부재 시 **BLOCKED**.
- 제품 운용 실환경 사내 LLM 토큰·DNS·CA·API 호출은 독립 별도 검증(**NOT TESTED**)으로 보존; 이 PATCH 성공이 실운영 배포 승인을 의미하지 않는다.

## 4. 완료/중단 조건

- **GO (새 PR 단계)**: version=0.141.1 root3 일치, 새 PR 원본 단일 Refs #865, 문서별 DOCUMENTATION_SYNC와 AC1..AC9 독립 매핑, 리뷰/충돌 정리, FULL CI 시작. PR CI 결과 확인 전 상태는 NOT TESTED.
- **GO (후속 병합)**: exact-Head Full3/E2E8/Trusted success, Owner 별도 HIGH 위험 수용·merge 지시, 신규 `v0.141.1` 게시에 대한 정확한 버전 승인.
- **GO (종료)**: Main exact SHA/Run/Attempt/GHCR 이미지·영수증·digest, `v0.141.1` immutable annotated tag와 Release Runtime/OCI/Finalizer successful verified, #865 및 #874의 종료/브랜치·GHCR 임시 태그 정리까지 확인.
- **STOP**: 성공하지 않은 Main/Release Run, 원본 태그 변경, 입증되지 않은 Main builder, Runner drift를 신뢰 근거로 가정, 불명확한 owner approval/모호한 GHCR digest, 이전 실패 이력 덮어쓰기. 원본 #216 Attempt 1~5와 실패 원장은 불변.

## 5. 문서·승인 출처

- [#865 Work Packet](exec-plans/active/ISSUE_865.md) / [#865 누적 실패 원장](ISSUE_865_FAILURE_ANALYSIS.md)
- [#874 실패 원장](ISSUE_874_FAILURE_ANALYSIS.md) / [GHCR/CI 운영 계약](CI_CD.md) / [Generic Finalizer](GENERIC_RELEASE_FINALIZER.md) / [QA 정책](QA_REVIEW_POLICY.md)
