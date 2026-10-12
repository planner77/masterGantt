# Issue #568 — Core Action Trace와 재현 분석

## Work Packet
- repository: planner77/masterGantt
- issue: #568; parent #567; comparison PR #562
- phase: IMPLEMENTING → LOCAL_VALIDATED → DOCUMENTATION_SYNC → PRE_QA → PR_CI
- goal: 실제 Core 2.7.3 fixture와 bounded trace/settle 도구를 구현하고 다섯 실패의 layer·관측·미검증을 구분한다.
- approval: 최신 사용자 요청이 등록-only 경계를 구현·문서·push·PR CI 시작으로 전환한다.
- baseline: main `e1e6e2558481fe01d9f7e57c0148288f77a884de`; branch `test/issue-568-core-action-trace`; isolated clone `/tmp/mastergantt-issue568`
- comparison: PR #562 `afd5ec2899183a2464b64f91d34e9de5d8a8319c`, stacked base #552; app 0.106.1, Core 2.7.3.
- version: main 0.103.1 유지. 새로운 제품 동기화 기능이 아닌 opt-in dev/test 분석 도구와 테스트·문서만 추가한다.
- release_required=false (이 단위 범위), release_authorized=false. main/GHCR/tag/Release/Issue 종료는 요청 밖이다.
- scope: Core/React wrapper fixture, 공통 trace schema, 상태 완료 분류, 두 번의 독립 브라우저 관측, 고정 PR #562 실패 재현 및 다음 adapter 판단 근거.
- non-scope: production Gantt 동작·server/API/DB/auth/domain 변경, PRO/private store 패치, workflow gate·assertion 완화, PR #562 직접 수정.
- ownership: frontend 도구·fixture·관련 tests; Manager 문서; infra branch/setup/push/PR/CI 등록; read-only reproduction 담당 stack 관측; 별도 qa_docs PRE_QA.
- issue_comment_writer=manager; issue_comment_allowed_types=PLAN,STATUS,EXCEPTION; Sub-Agent 원격 댓글 권한 없음.
- required docs: ARCHITECTURE, TEST_PLAN, PROJECT_UX, DECISIONS, 이 계획, active PLAN, 신규 trace 가이드.
- DESIGN/AGENTS: 기존 시각 언어·역할·권한·검증 gate 변경 없음으로 N/A. API/DB/보안/일정 계산/Import/VBA/배포/CI 문서는 계약 불변 여부를 독립 검토한다.
- validation: 변경 unit/typecheck/lint 및 실제 Chromium 두 run; code/docs/정확한 baseline과 fixture source hash를 고정한다. PR quality/e2e/docker는 등록만 확인하며 결과 NOT TESTED.
- stop: CI 실행 등록 확인. CI 모니터링·병합·main/GHCR·release·branch cleanup 제외.

## 요구사항과 증거
추적 스키마, 재현 명령, 판정과 미검증 항목은 [Gantt Sync Trace](../../GANTT_SYNC_TRACE.md)에 기록한다. 공식 API 문서 확인과 실제 설치 Core 측정은 별개 증거다. 테스트 실패를 제품 수정 또는 assertion 완화로 숨기지 않는다.

## PR #575 CI #2285 실패 조사 및 재현 계측 (2026-10-09)

- exact head `4ad246c3616fd8699585ecb06095f4bc931292e8`의 [PR CI #2285.1](https://github.com/planner77/masterGantt/actions/runs/37886327633)은 전체 failure. 6/6 Chromium shard에서 기존 #530 중첩 원래 보기 회귀 1 FAIL, 82 PASS, 1 SKIP이며 E2E aggregate도 FAIL. 다른 shard/quality 판정으로 이를 덮지 않는다.
- 실패 위치: `tests/e2e/resource-kpi-integration-ui.spec.ts:386`. 원래 SVAR public 및 native 좌표 left120을 복귀해야 하지만 left0으로 끝났다. 첫 frame 복귀 left240은 PASS였다. Playwright trace에서 두 번째 peer restore `requestedLeft=120, publicLeft=120, domLeft=120, count=2` 적용 뒤 후발 `scroll-chart(0)` 실행을 확인했다. 위 현상은 예전 #530와 유사하지만 **최초 writer가 메타데이터 코드라고 단정하지 않는다**.
- #568 경계 준수: 0.103.1/제품 동기화 알고리즘 변경 없이, 전체 Project opt-in trace의 `configure()`에서 이전 ring·실행 식별자를 초기화하고, #530 원본 strict E2E를 유지한 채 실패 시 trace/peer/event/canonical generation 진단 artifact를 첨부한다. 기존 assert·timeout·skip/retry 및 CI gate를 완화하지 않는다.
- 다음 정확한 head PR CI에서 새 추적 도구의 수집 동작과 #530 회귀를 별도로 검증한다. #530 반복 실패 시 Writer 경로·source와 #567/#569 adapter 설계를 연결하여 별도 제품 수정이 필요하며 #568 분석 PASS로 제품 버그 해결을 주장하지 않는다.

## 실행 기록
- BRANCH_READY PASS: 최신 main 기반 격리 branch 생성.
- setup PASS: Node 22.14.0/npm 11.10.0, frozen npm ci 447 packages, native SQLite in-memory query, 기존 Playwright Chromium1243 확인.
- 최초 제한 네트워크 설치는 대기 후 종료(exit130), 격리 npm cache와 허용된 registry 접근으로 재시도 exit0. lockfile·제품 데이터 변경 없음.
- LOCAL_VALIDATED PASS(진단 범위): Unit9 PASS, typecheck PASS, ESLint0errors/기존hook warning4. Chromium4 PASS(15.6초):1440 실제 명령/wheel 두 context,390 width0/NO_SCROLL_CAPACITY exact oracle 두 context. 390 제품/wheel PASS 아님.
- [Core summary](../../evidence/issue568/core/summary.json), [manifest](../../evidence/issue568/core/manifest.json), screenshot과 trace를 source manifest00cbfad2f05fcb0671b75dea81c4ce8472d884aacf7c268fd2d99a24f2ce8931에 고정. 처음4회 fixture/증거 IO 실패를 별도 보존.
- next-env.d.ts 자동 변경 원복. version0.103.1/lockfile 유지. 원격 전체 회귀 PASS를 주장하지 않는다.


## 비교 stack의 고정 관측
- 원본 PR #562 Chromium targeted5건을 별도 server/browser run으로 두 번 실행: 각각3 PASS/2 FAIL(exit1). 기존 assertion·retry·timeout·제품 source 변경 없음.
- pending wheel30→0와 Inline Tab 저장 후 Week native text 구값은 두 번 재현됐다. peer120/fullscreen metadata/Milestone390은 이 로컬 환경에서 각각두 번 PASS이며 과거 CI 실패를 대체하지 않는다.
- observer-only clone의 두 run도 각2 FAIL. wheel의 filter→native0→Core0 순서는 반복됐으나 직접 DOM writer callsite/Inline text writer는 미확정이다. 수직 sample이 구버전이고 clock 변경으로 elapsedMs 역행 가능하므로 sequence 기준 수평 관측만 사용한다.
- [curated matrix](../../evidence/issue568/stack/reproduction-matrix.json), [manifest](../../evidence/issue568/stack/manifest.json), [명령 영수증](../../evidence/issue568/stack/command-config-receipts.json). Raw ZIP/network/DB/opaque attachment는 저장소에 넣지 않는다.

보완 원본 검증: Inline keyboard 저장/취소 두 번과 confirmed Task Delete 401/412/network 각각두 번, 총8 PASS/exit0(2.6분). [보완 영수증](../../evidence/issue568/stack/supplemental-validation.json)에 정확한 source와 명령을 남긴다. 이는 Week 뒤 Inline 오류 복구 미도달 분기의 PASS를 대신하지 않는다.

## 문서·게시 gate
- DOCUMENTATION_SYNC PASS: ARCHITECTURE/TEST_PLAN/PROJECT_UX/DECISIONS/active PLAN/이 실행 계획/trace 가이드와 curated 증거 동기화. DESIGN/AGENTS 및 API/DB/security/domain/운영 계약 N/A 근거는 Work Packet·가이드에 명시.
- 문서 링크157개 파일 PASS, diff whitespace PASS. 별도 qa_docs PRE_QA 후 push/PR/CI 등록으로 handoff한다.
- quality/e2e/docker 전체 원격 결과, QA_FINAL/Manager ACCEPT, main/GHCR/release는 NOT TESTED다.
