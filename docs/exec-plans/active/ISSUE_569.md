# Issue #569 — SVAR 공개 API와 기하 Adapter PoC

## Issue Work Packet

- repository/issue: planner77/masterGantt #569; parent #567; 선행 #568/PR #575.
- goal: Core2.7.3 공개 API adapter 인터페이스와 A/B/C 시간축 확장 PoC·ADR을 제공한다.
- acceptance: 공식/설치 기능 matrix, 실제 A/B/C 성공·실패·비용·risk·rollback, 읽기 전용 Core/native geometry와 공개 scroll/date reveal/finite settle, 기존 #367/#514/#551 회귀 증거, required docs.
- approval: 이번 명시 사용자 요청으로 과거 등록-only 경계를 구현·문서·원격 게시·PR CI 시작으로 전환한다.
- baseline: main `6d31aefd9fec9d6fc390daa79f2a5ef3f02a38ca`; branch `feat/issue-569-readonly-gantt-adapter`; isolated clone `/tmp/mastergantt-issue569`.
- predecessor: PR #575 merged, head `87bdb85d0f76cbee4f3357e3134282f18e63f61d`; 최신 main에 포함. 최초 #568 게시 head와 현재 source를 혼용하지 않는다.
- comparison stack: PR #562 `afd5ec2899183a2464b64f91d34e9de5d8a8319c`, app0.106.1/Core2.7.3. main에는 #549~#553 표시 stack이 없어 비교 evidence를 분리한다.
- current version/decision: 0.103.1 keep. 제품 writer 미교체·미도입의 adapter 계약/진단 PoC이며 사용자 제품 기능·도메인·운영 계약을 바꾸지 않는다.
- release_required=false(이 설계/PoC 단위), release_authorized=false. 정식 게시 승인 없음.
- phase: BRANCH_READY → IMPLEMENTING → LOCAL_VALIDATED → DOCUMENTATION_SYNC → PRE_QA → PR_CI.
- scope: 신규 분리 adapter, dev/test-only fixture, actual Chromium 5폭×Day/Week×A/B/C, 3연속확장·선택/instance/origin·geometry, empty/M-only/fallback, 기존 회귀 비교.
- non-scope: 기존 ProjectGantt writer 교체, Coordinator 도입, #530/#553 회귀 수정, private Store/scrollWidth write/PRO, API/DB/auth/domain, merge/release/Issue close.
- ownership: frontend568 `src/features/gantt/adapter/**`, 신규 diagnostics/route/관련tests 및 evidence/adapter; researcher read-only 공식/설치 계약; repro568 별도 exact-source 기존 회귀; Manager 문서/ADR/version/phase; infra568 branch/setup/commit/publish/PR/CI등록; qa568 독립 read-only PRE_QA.
- blocked files: product project-gantt.tsx와 기존제품tests/workflows, package/lock/CHANGELOG(Manager 승인 전). 공용 #568 helper 변경은 먼저 협의한다.
- validation: pure adapter unit, typecheck/changed lint, real Chromium PoC 및 기존 #367/#514/#551 exact-source targeted. source/trace/artifact SHA와 최초FAIL·미검증·환경한계 보존. exec thenable resolution은 DOM settle이 아니다.
- documentation_owner=Manager; required docs=ARCHITECTURE, DECISIONS, PROJECT_UX, MILESTONE_TIMELINE, TEST_PLAN, 신규 ADR/실행 계획/active PLAN. MILESTONE_TIMELINE은 현재main에 없으므로 #569 adapter 경계만 신규 작성하고 미병합 #549문서의 전체표시계약을 완료로 복제하지 않는다.
- N/A: DESIGN/AGENTS는 시각언어/역할/제품흐름 불변, API/DB/SECURITY/SCHEDULING/Import/VBA/배포/CI는 계약 불변. 구현 결과에서 재확인한다.
- issue_comment_writer=manager; issue_comment_allowed_types=PLAN,STATUS,EXCEPTION. Sub-Agent 원격댓글 금지.
- stop: 단일 PR exact-head CI 등록·시작 확인. CI monitoring/QA_FINAL/Manager 최종ACCEPT/main/GHCR/cleanup 제외; quality/e2e/docker NOT TESTED.

## 실행 기록

BRANCH_READY/setup PASS: frozen npm ci 447 packages10초/exit0, native SQLite3.53.4 in-memory PASS, Chromium1243 기존 설치. 구현·PoC·문서·독립 QA 결과는 후속 기록한다.

## 기존 기능의 고정 source 회귀

main `6d31aefd9fec9d6fc390daa79f2a5ef3f02a38ca`의 #367 우측3회확장1건과 #514 normal/fullscreen/narrow3건을 각각두 번 실행해8/8 PASS(exit0,49.9초)했다. #551은 main 미통합이므로 PR #562 `afd5ec2899183a2464b64f91d34e9de5d8a8319c`의 lane390 Day/Week를 별도 source에서두 번 실행해2/2 PASS(exit0,21.5초)했다. 기존 source/timeout/assertion은 수정하지 않았다. 이 결과를 신규 adapter나 미병합 stack 전체의 PASS로 이관하지 않는다.

[회귀 summary](../../evidence/issue569/regression/baseline-regression.json), [명령 영수증](../../evidence/issue569/regression/command-config-receipts.json), [manifest](../../evidence/issue569/regression/manifest.json)에 정확한 source와 numeric geometry·viewport 제한을 남긴다.

## 구현·문서 동기화 결과

신규 adapter/개발 전용 fixture와 테스트만 추가했다. 기존 ProjectGantt writer·회귀 테스트·workflow·package/lock은 미변경이다. application 0.103.1 유지와 release N/A 판단을 재확인했다. Next 자동 생성 next-env.d.ts는 baseline으로 복원했다.

Local Fast Feedback: 최종 단일 Unit suite 19 PASS, typecheck PASS, 변경 파일 lint PASS(경고 0), 최종 Chromium matrix 10/10 PASS(30 trial), 직전 clean matrix 10/10 PASS다. 이는 성공/실패 분류 검증이며 전체 후보 지원 PASS가 아니다. 390px Chart 확대 후 Day A/B·Week A/B/C만 3회 확장에 성공했고, C Day는 위치 보존 실패, ≥768px는 첫 확장 후 다음 edge에서 TIMED_OUT으로 잔여 2회 NOT TESTED다. 실험 계약을 채택하되 제품 적용은 DEFER한다.

[Adapter summary](../../evidence/issue569/adapter/summary.json)와 [manifest](../../evidence/issue569/adapter/manifest.json)에 최종 source, 명령, 측정값, 실패 이력과 제외한 mixed-source 실행을 남겼다. 실제 경계 날짜 기하·10년 장거리 성능·다중 scale은 NOT TESTED다.

DOCUMENTATION_SYNC: ADR 및 필수 ARCHITECTURE/DECISIONS/PROJECT_UX/MILESTONE_TIMELINE/TEST_PLAN/active PLAN 갱신. API/DB/auth/domain/CI/배포/시각 언어·Agent 역할 변경 N/A 근거는 구현 후에도 유효하다. 독립 PRE_QA 후 원격 branch/PR과 exact-head CI 시작으로 전달한다. CI 결과·QA_FINAL·main/GHCR·Issue 종료는 요청 범위 밖이며 NOT TESTED다.

## PR #576 리뷰 보완 (2026-10-09)

Codex P2 3건(Scale 불일치, 중복 확장, Empty/Milestone/Future assertion)을 소스·단위/E2E·ADR·TEST_PLAN에 반영한다. 기존 제품 writer 미변경, 버전 0.103.1, 제품 도입 DEFER, 병합/GHCR 제외를 유지한다. 새 PR CI 시작 후 결과는 별도 검증한다.

## PR CI #2293.1 실패·조치 (2026-10-09)

- `quality`/`docker` PASS, Chromium shard2~6 PASS, shard1 FAIL(10건). 공통 원인: synthetic Milestone 기대값은 end=start이지만 실제 `api.serialize()`는 Milestone end를 반환하지 않음.
- 공식 SVAR Milestone의 시점 모델에 맞춰 fixture에서 `end`를 제거하고 E2E에 `endMs=null`을 명시한다. 기존 DOM·태스크·확장 판단은 유지.
- 후속 작업 한계: 새 PR CI 시작까지만. PR 병합, Main CI, GHCR, 정식 제품 도입, Issue 종료는 제외.

## PR #576 CI #2294.1 실패와 신규 검증 (2026-10-09)

- Quality/Docker SUCCESS, Chromium E2E shard 1/2/6 각각 1건 FAIL. shard1: 390 Day Chart-only native capacity 재계측 직후 아직 없음. shard2: #463 optional peer-restore 진단 attribute null 접근. shard6: #530 Playwright Clock `install` 후 `pauseAt(now)` 시간 경합.
- #569의 native geometry readiness와 3-frame settle, #463의 복원 속성 raw 불변+Core/native 좌표 엄격 비교, #530의 clock 목표시간 고정/설치시각 오프셋을 최소 범위 수정한다. 제품 writer/API/DB/릴리스 정책은 변경하지 않는다. 기존 회귀 테스트 2건 수정은 해당 실패가 필수 CI를 차단하여 사용자 재검증 지시 범위에서 필요한 검증 안정화다.
- 새로운 Head의 unit/typecheck/E2E/docker 결과는 CI 확인 전까지 NOT TESTED이다. CI 시작 후 병합·GHCR·Issue 종료는 수행하지 않는다.

## PR #576 반복 CI 실패 종합 REWORK (2026-10-09)

이번 재개는 기존 branch/PR을 재사용한다. 작업 baseline은 원격 head `9f0458124198470872c6764cbd5b00dedc75417b`, tree `8f7906d325c53d8ba1c9ee6e52f8a9a7fef8e1c7`이며 최초 main parent는 유지한다. 기존 원격 보완 4개 commit을 보존하고 과거 local freeze는 backup branch에 보관했다. 요청 종료점은 보완 게시 후 새 exact-head PR CI 시작이며 이후 모니터링·병합·릴리스·Issue 종료는 제외한다.

REWORK ownership: infra는 5개 CI run/attempt의 실패 원인 분석, `evidence/issue569/rework/ci-history.json`, 원격 게시를 담당한다. frontend는 `tests/e2e/milestone-dashboard-state.spec.ts`의 #463 viewport/consumed-restore 테스트와 별도 로컬 증거만 수정한다. Manager는 원인·필수 문서·버전 결정을, qa_docs는 read-only 독립 검토를 맡는다. 제품 writer·다른 테스트·workflow·package/lock 수정은 별도 근거 없이 확대하지 않는다. version 0.103.1 유지, release_required=false/release_authorized=false, 제품 adapter 도입 DEFER다.

CI #2291.1은 전체 PASS였다. #2292.1은 getState().tasks를 배열로 가정한 empty 관측 하네스의 null 기대 불일치, #2293.1은 Milestone의 end 부재, #2294.1은 Chart 확대 직후 준비 시점·optional 복원 진단값 null·Clock 과거 이동에서 실패했다. 이 증상들은 기존 보완 후 #2295.1에서 통과했다. 최신 #2295.1의 유일 실패는 검색 후 세로 위치를 96으로 고정한 신규 assertion이며 실제 public/native top은 모두 0, left는 모두 120이었다. 모든 실행의 quality/docker는 PASS, 실패는 E2E이며 setup/network/권한 문제가 아니다. 모든 run은 attempt 1이며 최초 오류를 재실행으로 덮지 않았다.

수정 전 원본 targeted 재현과 filter row/capacity·public/native 이벤트를 대조한다. peer/layout의 120/96 보존과 검색으로 축소된 행의 native clamp는 별도 조건이다. 검색 완료 후 새 사용자 viewport가 오래된 peer 복원으로 덮이지 않는지 exact Core/native·동일 instance로 검증하고 timeout/skip/retry/gate를 완화하지 않는다. 실제 결과와 새 DOCUMENTATION_SYNC/PRE_QA는 아래에 추가한다. 새 head의 quality/e2e/docker 및 QA_FINAL은 모두 NOT TESTED다.


종합 원격 증거는 [CI history](../../evidence/issue569/rework/ci-history.json)에 5개 run/head/attempt와 실패 job/step·수정 commit 연결·원문 로그 hash로 고정한다. 최초 adapter manifest와 별도로 관리하며 최초 source를 현재 head로 오인하지 않는다. 현재 보완은 검색 1행의 capacity 0과 clear 완료를 확인한 뒤 새 사용자 180/128이 충분한 행의 filter/clear에서도 유지되는지 검증한다. layout은 1456px에서 실제 frame 폭 증가, 1440px에서 원폭 복귀를 기다리고 마지막 3개 실제 RAF에서 좌표·marker·instance가 정확히 유지되는지 확인한다. 예전 peer 120/96 복원이 다시 발생하면 실패한다.


REWORK Local Fast Feedback: 원본 baseline targeted 1 FAIL 및 계측 targeted 1 FAIL에서 동일한 검색 후 top96/actual0 불일치를 보존했다. 최종 source의 targeted 독립 3회는 각각 1 PASS, 해당 spec 전체는 6/6 PASS(23.8초), typecheck PASS, 변경 파일 lint PASS(경고 0)다. 마지막 실제 RAF의 public/native 180/128, 동일 instance와 restore marker 불변을 확인했다. next-env.d.ts와 전체 spec이 생성한 기존 output은 baseline으로 복원했다. [로컬 summary](../../evidence/issue569/rework/summary.json) 및 [manifest](../../evidence/issue569/rework/manifest.json)에 원본·최종 source hash와 실제 phase별 관측을 남겼다.

DOCUMENTATION_SYNC REWORK: ADR, TEST_PLAN, PROJECT_UX, active PLAN과 이 실행 계획을 현재 구현·실패 이력에 맞췄다. ARCHITECTURE/MILESTONE_TIMELINE/API/DB/SECURITY/SCHEDULING/CI_CD/REMOTE_VALIDATION/DESIGN/AGENTS는 adapter/제품/서버/워크플로/배포/시각 언어·역할 계약 변경이 없어 N/A다. 최초 문서와 증거는 당시 source의 이력으로 유지한다. 독립 PRE_QA 후 기존 PR #576에 게시하며 새 exact-head quality/e2e/docker·QA_FINAL·Manager 최종 ACCEPT는 NOT TESTED다.
