# Issue #437 — Historical timing 기반 E2E 샤드 계획 활성화 (PR #540)

## 작업 개요

- Primary Issue: #437 (기 구현 및 종료), 후속 plan 적용 PR: #540
- 대상: `tests/config/e2e-shard-plan.json` (원안은 2026-10-08 optimizer가 생성한 6-way historical median/LPT 계획)
- 2026-10-11 최신 `main` 정렬 이후 원본 계획 JSON의 의미·분배 설정을 변경하지 않고 CI 증거 및 Work Packet을 보완한다.
- 위험도: `HIGH`, 보호 경로 `tests/config/**`에 속하는 CI 실행 설정. 경로 분류·실제 browser shard 실행·새 테스트 선택 및 누락 방지를 검증해야 한다.
- QA 경로: `OWNER_MANAGED` (#598 기본). 독립 Reviewer 검증은 선택이며 미실행 시 `N/A`만 기록하고, 자동 QA/Manager 승인으로 위장하지 않는다.
- 범위 제외: 제품 UI/API/DB, Dockerfile, CI/Release workflow, 실행 권한/Ruleset, timeout/retry/skip, E2E assertion, SemVer 변경 및 자동 병합.
- 릴리스: `release_required=false`, `release_authorized=false`, Owner 병합 승인 전까지 Main CI/GHCR 미진행.

## 원본 실패 및 현재 보완

- 원본 [PR CI #2429.1](https://github.com/planner77/masterGantt/actions/runs/38087419750): Quality aggregate SUCCESS, 실제 Chromium E2E 6개 shard SUCCESS, Docker aggregate SUCCESS(조건 분기로 구현 Docker smoke SKIPPED).
- 실패한 것은 `QA Final — Automated` 단독으로, 기본 브랜치 검증기의 `PR 본문 risk_level의 명시값 필요`가 최초 직접 원인이다. 원본 CI Run 전체 FAILURE를 소급 PASS로 바꾸지 않는다.
- 추가로 현재 검증기에 필요한 `risk_level`, `qa_method`, Issue의 `AC1..AC11` 식별자 및 HEAD 기반 Work Packet/문서 영향/AC 매핑이 과거 PR에는 없었다.
- #437 본문의 기존 11개 acceptance checklist는 문구·체크 상태를 보존하고 식별자만 부여했다. PR 설명에 HIGH/OWNER_MANAGED 및 잔여 위험과 권한 경계를 기록했다.
- JSON plan은 예전 성공 CI 15개 run에서 생성된 파일 단위 median/LPT 계획이다. 최신 테스트 증가·fixture 준비시간으로 예상 소요시간이 달라질 수 있으며 2026-10-08의 개선율 추정은 재측정 전 현재 실측 개선율로 주장하지 않는다.
- 최신 실행의 `Chromium E2E shard 1..6/6` 실제 모두 실행, shard 간 분배/누락, Quality, Docker required aggregate, QA Final 및 신뢰된 main validator 결과를 새 HEAD/Run ID에서 다시 확인한다.

## 테스트 및 수용 전략

- 계획 JSON은 `schemaVersion=1`, `shardCount=6`, 각 shard 1~6의 고유성, 파일 중복 방지 및 현재 spec 목록에 없는 파일 무시/신규 파일 deterministic fallback의 계약을 유지한다.
- 기존 `scripts/e2e-shard-planner.mjs`, Playwright config, E2E timing reporter, optimizer workflow, static Vitest 계약을 변경하지 않는다.
- 테스트 E2E는 `workers=1` 및 explicit serial describe 보존, test/spec별 실행 완결, baseline/test count 검증, 실행 종료 결과를 확인한다.
- 이전 CI는 QA Final 실패였으므로 새 HEAD의 Required aggregate/QA 결과는 검증 완료 전 `NOT TESTED`; 독립 QA 및 Owner 최종 승인도 `NOT TESTED`다.

## DOCUMENTATION_SYNC

- `docs/TEST_PLAN.md`: N/A(기존 Issue #437 Historical timing E2E shard optimizer 검증 절에 reporter, median/LPT, 누락/손상 fallback, threshold, actual shard 검증 기준이 이미 명시됨; 이번 변경은 새 기능이나 테스트 계약 수정이 아닌 계획 JSON 데이터의 활성화와 QA 추적 보완에 한정됨)
- `docs/CI_CD.md`: N/A(기존 E2E plan 선택 및 fallback 운영 계약이 유지되고 CI workflow·required check·runner 설정은 변경하지 않음)
- `DESIGN.md`: N/A(애플리케이션 화면·UX 또는 도메인 설계 계약을 변경하지 않음)
- `docs/GITHUB_OPERATIONS.md`: N/A(CI·QA 기본 운영 정책은 #598의 최신 main 계약을 그대로 사용하며 release/GHCR 승인 흐름을 수정하지 않음)

## AC_TEST_COVERAGE

- AC1: 기존 `tests/config/e2e-timing-reporter.cjs` 및 `e2e-timing` artifact 수집 경로와 CI 15개 성공 run 원장을 확인; 새 실행의 timing artifact 생성 여부는 원격 확인 예정
- AC2: `scripts/e2e-shard-planner.mjs`의 `loadHistory`, `median`, `analyzeHistory` 와 plan `sourceRunIds`·`estimator=median`·`runCount=15`로 대응
- AC3: `scripts/e2e-shard-planner.mjs`의 결정적 `lptPlan`·stableHash와 기존 `tests/scripts` 관련 테스트, 새 HEAD의 policy/unit CI 결과로 확인
- AC4: JSON `metrics.baselineCriticalMs=472578`, `projectedCriticalMs=302614.5`, `improvementRatio=0.3596517400302172`는 과거 계획 시뮬레이션 근거이며 현재 E2E 6-way wall-clock 실증으로 재평가 예정
- AC5: `tests/config/playwright.config.ts`의 `workers=1`와 CI six-way matrix 및 명시적 serial describe 불변; E2E shard 실행 로그로 확인
- AC6: `selectShardFiles`의 현재 spec 파일 목록·기존 plan의 삭제 파일 제외·미배정 신규 파일 stable hash fallback 및 file unique assignment 검증
- AC7: `selectShardFiles`가 JSON 계획 부재/오염/불일치에 null 반환하면 `ci.yml`과 `release-image.yml`이 native `--shard=N/6`로 fallback하는 정적/원격 계약 확인
- AC8: `.github/workflows/ci.yml`, `.github/workflows/release-image.yml`에서 동일 `tests/config/e2e-shard-plan.json` 선택 사용; PR/Main/Release 각 실제 실행 성공은 별도 Run 검증
- AC9: `.github/workflows/e2e-shard-optimizer.yml`의 Step Summary와 계획 메트릭(run count, coverage, imbalance, candidate runner-minutes) 경로 및 실제 optimizer 실행 산출물을 확인
- AC10: `analyzeHistory`의 minRuns/coverage/breach/improvement/cooldown 분기와 optimizer 생성 조건의 기존 정적 테스트; plan PR 생성은 조건 충족 시에만 허용
- AC11: CI #2429.1은 required Quality/E2E6/Docker aggregate 성공이지만 QA Final 실패; 새 HEAD의 전체 Required 3개·신뢰된 QA 검증은 실행이 완료된 뒤에만 PASS 표기

## 잔여 위험 및 병합 전 확인

- 오래된 plan이 현재 증가한 테스트 수와 fixture 비용을 정확히 균형화하는지는 검증 전이며 E2E 소요시간 개선은 보장하지 않는다.
- Plan 고정 목록에 없는 신규 파일이 다른 shard로 배정되는 fallback 로직과 E2E 모든 spec의 실제 실행 여부를 확인한다.
- required aggregate SUCCESS와 개별 E2E 실행 여부·Docker skip 근거를 분리 보고한다.
- 신뢰된 QA가 자동 PASS하더라도 `manager_decision=NOT TESTED`다. Owner의 별도 명시적 병합 허가와 HIGH 잔여 위험 수용 전 병합하지 않는다.
