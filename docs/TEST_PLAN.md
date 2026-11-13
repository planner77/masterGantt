## Issues #898 / #899 — 실제 휠·조회 시작점 재작업

[Work Packet](exec-plans/active/ISSUE_898.md)의 REUSE_REVIEW/TEST_LIFECYCLE_REVIEW/AC_TEST_COVERAGE를 따른다. 기존 #822 물리 wheel, #889 세 View/5폭/Day·Week, #880 실제 SQLite/HTTP·중복/85행·Editor/keyboard/source 회귀를 확장하고 원본 assertions/timeout/retry/skip을 유지한다. 새 reveal Unit은 날짜/scroll capacity/미측정 typed 결과만 검사하며 실제 UI 정렬을 대신하지 않는다. 원래 #904 최초 실패는 [보존 원장](ISSUE_898_899_FAILURE_ANALYSIS.md), 현재 source의 실패/재시험은 [Primary 원장](ISSUE_898_FAILURE_ANALYSIS.md)에 추가한다.

로컬 fast·영향 Chromium/Unit·Docker/runtime/SQLite·clean exact-source admit를 수행한다. 실제 pointer hit-test·page zoom 독립 측정, sticky 경계와 bar-left≤1px, Editor 닫힘/명시 열기·focus, clicked rowKey·쓰기0/WBS identity를 확인한다. #896 합성 PNG/geometry/flow manifest는 출처·무결성 근거이고 #897 Owner UAT/실제 운영 장치 수용은 별도다. 과거 Required3/E2E8/Trusted/Main/Release는 역사적 증거이며 신규 원격 실행은 N/A다.

# 로컬 테스트 계획과 Test Lifecycle

Owner 2026-11-10 결정에 따라 모든 Issue에서 로컬 검증을 유일한 테스트 gate로 사용한다. PR·GitHub Actions·원격 CI·Trusted QA·Finalizer는 실행하지 않는다. 흐름은 [Issue Lifecycle](ISSUE_LIFECYCLE.md), 환경·CLI·실행 보고·admission은 [LOCAL_PREPR](LOCAL_PREPR.md)이 원본이다. 기존 제품 케이스/경계는 유지하며 과거 전체 테스트 계획은 [보존 기록](history/owner-ci-retired-20261110/TEST_PLAN.md)에 있다. 과거 원격 실행 요구는 현행 gate가 아니다.

## Issue #697 — 변경 영향 기반 로컬 검증과 교차 회귀 선정

PLAN/REWORK마다 실제 Issue AC, 변경 producer→직접/인접/음성 consumer, 기존 fixture·테스트와 [Regression Index](REGRESSION_INDEX.md)·실패 원장을 검색한다. #907의 [원장 계약](ISSUE_LEDGER.md)·validator도 #906/#907/#908 통합 범위에서 실제 검증하고 path/stale·중복/상태·append-only 이력의 오류를 기록한다. 이름이나 Issue 번호만으로 커버리지를 판단하지 않는다. 선택/제외 테스트와 이유, 미커버 경계·UNKNOWN·환경별 미실행을 Work Packet에 기록한다. source/base HEAD·변경 파일·fixture digest를 고정한다.

공통 필수는 Node/npm/package/lock·환경 확인, typecheck/lint, Unit/Integration, production build와 영향 테스트다. 문서 전용도 공통 정적·전체 Unit/Integration·production build를 실행한다. 영향 browser·Docker의 N/A는 해당 영향이 없음을 항목별로 설명한다. 실행 지침·테스트 gate·Docker/게시 도구 변경은 확장 검증 대상이다. `--risk`는 추론 위험을 낮출 수 없으며 UNKNOWN은 HIGH/BLOCKED로 처리한다.

| 위험/조건 | 실제 검사 범위 | 필수로 보존할 음성/회귀 |
| --- | --- | --- |
| LOW UI 문구·격리 스타일 | 공통 검사·실제 Chromium·keyboard/390·768·1024·1440px(해당 시1920px)·geometry·#896 합성 증거 | focus/Tab/Escape·overflow·읽기 전용·원본 상태. 공통 동작 영향이면 MEDIUM/HIGH |
| MEDIUM 제한 기능 | 공통 검사·직접 Unit/Integration·관련 실제 Chromium/API·인접 소비자 | 취소·실패/재조회·권한·경계값·저장/재시작(해당 시) |
| HIGH DB/auth/canonical/공통 Gantt/동시성 | full 관련 Unit/Integration/Chromium + Docker/runtime/API/native SQLite/restart + 해당 복원 가능성 | 401/409/412/422/500·revision race·원자 rollback·기존 관계/UUID·canonical/viewport 보존 |
| Docker/게시/검증 도구·광범위/unknown | 공통 전체 + 도구 양성/음성·실제 Docker/runtime/API/SQLite·영향 소비자 전체 | drift/cancel/env/fixture·missing·tag collision·권한 부족; UNKNOWN 해소 전 BLOCKED |
| 문서 전용 | 공통 정적·전체 Unit/Integration·production build + 링크/서식·정책/템플릿 정합성 | 실행 정책 영향 없음과 이미지 N/A 근거; 테스트·CI 정책 문서는 docs-only로 자동 축소하지 않음 |

### 여섯 가지 재현 가능한 계획

| 사례 | 입력·기준선 | 선정과 실행 계획 | 실패·미실행 처리 |
| --- | --- | --- | --- |
| LOW UI | 격리 화면 문구/스타일의 정확 source/base·합성 fixture | `fast` + `targeted --include=tests/e2e/project-task-editor.spec.ts`, 실제 keyboard/5폭 geometry·manifest; 실제 변경 소비자로 include 보정 | 추론 MEDIUM이면 상향, browser 미실행은 NOT TESTED |
| MEDIUM 기능 | 단일 Task Editor 계약·해당 fixture | `fast` + `targeted`, `tests/features/gantt` 직접 모델과 `tests/e2e/project-task-editor-persistence.spec.ts` 등 실제 존재/단언 확인 | 취소/저장/권한 인접 케이스 제외 금지 |
| HIGH DB/auth/공통 Gantt | migration/session/canonical producer와 데이터 합성 fixture | `fast` + full 관련 Unit/Integration·`ci-like` 또는 근거 있는 관련 Chromium 전체 + `docker`; migration이면 `tests/server/db` 복원/rollback·#912 준비 | 호환 backup 미실증은 NOT TESTED, 파괴적 배포 BLOCKED |
| docs-only | 일반 링크/문구만의 exact diff | fast의 공통 정적·전체 Unit/Integration·build + 링크/정책 정합성, 영향 browser/Docker·이미지 N/A 항목별 근거 | 실행 지침/도구 정책 포함이면 HIGH 계획으로 재분류 |
| 실패 재작업 | 기존 Failure ID·원본 명령/exit/source·수정 commit | 최초 FAIL을 그대로 두고 원인 교정, 같은 최종 source에서 최초 실패+영향 소비자 재실행·admission | 옛 PASS 승계/무조건 retry/skip 금지 |
| unknown | 매핑 없는 신규 producer/fixture/harness | dry-run으로 UNKNOWN 확인, 실제 consumer/fixture·권한/환경 조사 후 매핑 보강, full 관련 검증 | UNKNOWN/누락/임의 exclude는 BLOCKED, Publish 금지 |

위 표는 실제 실행 결과가 아니다. 사용한 정확 경로·케이스·명령/exit/count는 각 Issue 원장에 남긴다. 실행 전 선택 파일이 실재하고 현재 계약을 검사하는지 확인한다. 현재 #906/#908은 제품 UI/API/DB를 변경하지 않으므로 업무 UI 전체의 Chromium/시각 수용은 N/A(reason)로 구분한다. 다만 browser 실행 snapshot 경계 변경의 실제 소비자인 기존 `tests/e2e/gantt-demo.spec.ts`의 네 Chromium 사례는 직접 검증하고, 새 snapshot helper의 입력 일치·정확한 Next 생성 출력·임의 코드/옵션/fixture 변경 거부와 source/env·취소/음성 회귀 및 Docker/runtime 검사는 수행한다. 계획만으로 이 검사를 PASS로 표시하지 않는다.

## Issue #711 — Test Suite Lifecycle (추가 → 검토 → 유지·통합 → 조건부 폐기)

1. 변경 계약과 AC의 양성/음성/보안/migration/race/사용자 흐름을 정한다.
2. 실제 `tests/**/*.test.ts`, `tests/e2e/**/*.spec.ts`, Python·fixture를 시나리오/단언/환경으로 검색한다. 같은 이름은 동일 coverage 증거가 아니다.
3. 같은 위험 경계면 EXTEND, 다른 경계면 ADD/KEEP_UNIQUE로 판단한다. 단위+실제 DB+브라우저의 병존을 중복으로 제거하지 않는다.
4. fixture·독립 DB·시간·비동기·정리·외부 oracle을 검토한다. 구현 코드에서 기대값을 역산하거나 HTTP/SQLite를 mock 성공으로 치환하지 않는다.
5. 아래 TEST_LIFECYCLE_REVIEW를 기존 AC_TEST_COVERAGE와 연결한다. 증거 없이 “중복 없음”을 쓰지 않는다.

| 판정 | 조건 |
| --- | --- |
| ADD / EXTEND | 새 경계 또는 기존 계약의 새로운 입력. 해당 계층 최소 케이스를 추가/확장 |
| KEEP_UNIQUE | 별개 권한·브라우저·DB·revision·환경 경계 보존 |
| PARTIAL_OVERLAP | 준비 helper만 공유하고 독립 assertion 유지 |
| CONSOLIDATE_CANDIDATE / RETIRE_CANDIDATE | 아직 후보. 계약 폐지/동등 대체·old→new 매핑·같은 source 대체 PASS·Owner 승인·rollback이 모두 있어야 통합/폐기 |
| STALE / FLAKY_OR_EXPENSIVE | 승인 계약과 비교·최초 원인/trace 분석 후 교정. 무단 skip/retry/timeout/assertion 완화 금지 |

TEST_LIFECYCLE_REVIEW에는 변경 계약/AC, 기존 검색 경로·케이스·fixture, 판정 이유, 직접/인접/음성 consumer, selected/excluded·현재 source/환경 실행, 미커버 위험, old→new 보존·Owner 승인/rollback을 기록한다. flaky 임시 예외도 Owner·기간·복구·미실행을 명시하며 PASS로 위장하지 않는다.

읽기 전용 인벤토리 `scripts/test_lifecycle_inventory.py`의 static/discover는 발견/선언 수이며 실행 PASS가 아니다. [초기 인벤토리](TEST_LIFECYCLE_INVENTORY_711.md)와 과거 사례는 연구/역사 자료다. 기존 policy/workflow 선언을 조사하더라도 현재 실행할 remote gate로 전환하지 않는다.

## 실행·증거·복구 기준

각 실행은 같은 source fingerprint·fixture/lock·환경을 전후 확인하고 실제 command/exit·시각/count·selected/excluded·artifact를 원장에 연결한다. `fast`는 새 격리 worktree의 표준 `.next` 출력만 소유한다. browser는 clean exact HEAD의 입력 일치 snapshot에서 실행하고 원본 source 불변·snapshot의 엄격한 생성 출력 검증·runner 경로 귀속을 함께 확인한다. 상세 허용 범위와 보고 계약은 [LOCAL_PREPR](LOCAL_PREPR.md)에 있다. 코드 변경은 `fast/targeted/docker` 등의 완전한 결과를 `admit --reports=...`로 결합한다. `admission.publishAllowed` 전에 모든 필요한 검사가 완료돼야 한다. 로컬 훅/보고는 인증된 서버 gate가 아니다.

필수 FAIL/BLOCKED/NOT TESTED·취소·source/base/env drift·fixture 오염·누락/미해결 UNKNOWN은 Push/Publish/Close를 차단한다. Owner 위험 수용은 검사 PASS의 대체가 아니다. source 변경 시 관련 테스트를 재실행하며 원본 실패와 후속 성공을 append-only로 구분한다.

Windows Excel/VBA/DRM, 실제 reverse proxy/TLS, off-host backup/restore·운영 host/최종 수동 UX는 해당 환경에서만 판정한다. 자동 검사나 합성 DB restore는 운영 PASS가 아니다. 파괴적 migration은 #912의 backup/격리 restore·호환 digest 준비가 있어야 한다. Git revert나 이미지 rollback만으로 schema를 되돌렸다고 보고하지 않는다.

## #898/#899 후속 · Playwright 산출물과 source 불변

기존 milestone-dashboard-state(#463), project-summary-bar-visual(#818/#822), project-task-editor-persistence(#258), schedule-views(#880/#889)의 PNG/JSON 출력은 각 testInfo.outputPath 아래에만 생성한다. 기존 committed output/playwright 이미지·geometry와 source를 덮어쓰지 않는다. assertions/fixtures/attachments와 snapshot guard는 유지한다. f4의 개별160PASS 뒤 tracked13/untracked16 산출물 때문에 전체 BLOCKED된 최초 근거는 [F898-014](ISSUE_898_FAILURE_ANALYSIS.md)에 보존한다.


## Issue #917 — nullable 설비 AC 회귀

[Work Packet](exec-plans/active/ISSUE_917.md)의 AC1~8을 기존 logistics/service/handlers/repository/Target·resource/WBS·Copy/Template/Excel 및 기존 editor Chromium seam으로 확장한다. fresh/38→39 upgrade·FK/index/trigger/자식 PK 보존·실패 전체 rollback·restart/격리 backup restore, 공정0 CRUD·생략/null/빈값·비활성/foreign·401/403/409/412 및 strong revision, legacy Target 충돌·WorkArea 독립·등록/root/수량 누락0을 검증한다. UI5폭·3언어·keyboard/focus·dirty/stale/readonly와 nullable transport, 공통 full Unit/Integration/build·Docker/API/SQLite·같은 최종 source admission을 구분 기록한다. 원본 테스트/timeout/retry/skip은 약화하지 않는다. 원격 CI는 현행 정책 N/A이며 실제 실행 결과는 [원장](ISSUE_917_FAILURE_ANALYSIS.md)에 추가한다.
