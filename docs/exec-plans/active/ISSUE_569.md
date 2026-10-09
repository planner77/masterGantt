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
