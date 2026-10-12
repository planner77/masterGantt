# Issue #637 — 구조 삽입 후 Grid·Chart 행 정렬 Work Packet

## 계획과 실행 경계

- Primary Issue: [#637](https://github.com/planner77/masterGantt/issues/637), phase=QA_READY.
- 기준 main: `48b978f8529555f34148ea1f01be0b0c63ca0071`; branch: `fix/issue-637-projection-row-alignment`.
- 목표: #570 insert-before 후 실제 Grid·Chart 중심 Y 불일치와 projection TIMED_OUT의 원인을 원본 artifact로 확인하고 최소 수정한다. membership/payload/queue 완료와 DOM 정렬 완료를 구분한다.
- `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`; 구조 투영·스크롤·focus 회귀 위험. 독립 PRE_QA Reviewer=`qa_docs (/root/f0_pre_qa)`; 최종 Trusted QA·Owner 판정과 구별한다. `manager_decision=NOT TESTED`.
- 기준 main version `0.106.1`; 실제 제품 결함의 새 PATCH `0.106.2` 후보로 package/lock/CHANGELOG 동기화. `release_required=true`, `release_authorized=false`; 기존 v0.106.1 tag/승인 SHA를 이동하거나 재사용하지 않는다.
- 사용자 요청의 종료 지점은 새 PR의 exact Head full CI 시작이다. CI 결과 모니터링·병합·main/GHCR·tag·release·Issue 종료는 수행하지 않는다.
- 주 담당 frontend(`/root/gantt550`): 최소 Gantt 코드·관련 unit/E2E. domain_audit: artifact read-only 원인 분석. ui_ux: DESIGN Delta/공식 SVAR 계약 read-only. Manager: 문서·버전 결정·통합·Issue 기록. infra: package/lock 버전 반영 및 승인된 branch/PR/CI 게시. 여러 Agent는 타인 변경을 되돌리지 않는다.
- `issue_comment_writer=manager`; Agent는 공식 댓글을 작성하지 않는다.
- 비범위: API/DB/권한/스케줄링 알고리즘/CI·Finalizer 정책 변경. Core private write·remount·새 viewport writer·임의 retry/wait·1500ms/5s 확대·±1px 완화·skip/shard/required gate 변경 금지.

## 원본과 검증 계획

- 원본 immutable Release [#165.1](https://github.com/planner77/masterGantt/actions/runs/38221400193), SHA `09bee924032b4126ff794ec7a485542fd72dd7bf`, [artifact 11735576081](https://github.com/planner77/masterGantt/actions/runs/38221400193/artifacts/11735576081). 원본 zip SHA256 `e0924a18493eb16ae756303a52120ff528946dc062637cbb5047b9707eea77a7`; 원본 bytes/민감 trace는 Git 외부 보존, 실행하지 않고 읽기 전용 분석한다.
- 원본 membership5개·queue settled와 rev41 projection TIMED_OUT을 함께 보존한다. Grid 첫 행 y400/h38, Chart y431/h31의 실제 중심 차이27.5px를 오프셋 보정으로 숨기지 않는다.
- Local Fast Feedback: 동일1440×1000/revision40→41/NEW-570/422 fallback 원본 fixture 1회 및 수정 후 독립 반복; 원인 경로의 deterministic 회귀; 삽입·삭제·재부모화·Summary collapse/expand·Day/Week·390/768/1024/1440/1920px·filter/metadata·selection/snapshot mutation0 범위별 검증. 실제 실행 수와 미실행을 아래 결과에 구분한다.
- 원격 Required: exact Head의 Quality/E2E6-shard/Docker 및 protected main Trusted QA. PR CI 시작 전/진행 중은 NOT TESTED이며 local PASS를 원격 PASS로 확대하지 않는다.
- 실제 OS/production/전체 사용자 UX 및 새 formal release 검증: NOT TESTED.

## DOCUMENTATION_SYNC

- `docs/PROJECT_UX.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_637.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `AGENTS.md`: N/A(역할·QA·신뢰 정책 변경 없음)
- `DESIGN.md`: N/A(Design Delta B, 기존 SVAR-native·정확한 feedback·상태 보존 구체화, 새 시각 규칙 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(OWNER_MANAGED/HIGH·Trusted·최종 Owner 판정 계약 유지)
- `docs/CI_CD.md`: N/A(required gates/권한/릴리스 정책 변경 없음, 기존 immutable/new version 절차 적용)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 PR/CI 운영 정책 유지)
- `docs/API.md`: N/A(서버 요청/응답·revision 계약 불변)
- `docs/DB_SCHEMA.md`: N/A(migration/영속 데이터 구조 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(날짜·의존성·일정 알고리즘 변경 없음)
- `docs/SECURITY.md`: N/A(server session/Origin/권한·비밀값 처리 불변)
- `docs/REQUIREMENTS.md`: N/A(기존 정렬·작업 보존 요구사항의 결함 교정)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 scroll/focus/반응형 계약 유지)

## AC_TEST_COVERAGE

- AC1: 원본 artifact/trace의 동일 ID·queue·viewport 중심 Y/독립 pane scroll 상태와 유발 action의 sanitized 근거; 기존 observer의 좌표계 검증.
- AC2: 원본 baseline 및 deterministic 실제 Core 삽입·구조/필터·경합/순서·focus/selection/viewport·snapshot 회귀; 실제 실행 범위는 결과 기록.
- AC3: 원인에 한정한 최소 제품 수정 + 음성 Y 정렬 oracle. timeout/threshold/Required CI·Core public API 경계 불변.
- AC4: 관련 unit/E2E Local Fast Feedback·독립 PRE_QA; PR exact Head full CI 시작. 세 aggregate PASS/Trusted/Owner ACCEPT는 완료 전 NOT TESTED.
- AC5: 상기 문서 영향/CHANGELOG/package-lock 동기화, #570/#571/#574/#633 원본 역사 유지, v0.106.1 immutable·신규 version release_authorized=false.

## 실행 결과

- 원본 read-only 분석 PASS: archive provenance는 embedded gitCommit SHA와 일치, 98건 중97PASS/1FAIL. 관찰 코드·제품 source3개는 원본 SHA와 기준 main 사이 diff0이다.
- 클릭 전 자동 scrollIntoView44852.545~44853.646ms → action snapshot44861.616ms Gridpane28/Core·Chart·Gantt0 → actual click44863.804ms. 마지막50187.423ms에도 Grid28 유지. 공통 HTML scroll1px는 양쪽에 동일하게 적용되어 중심 차이 원인이 아니다.
- `Grid28 - (38/2 - (3 + 31/2)) = 27.5px`. 행·bar간격38px/외부 scale72px/관측 inline 조상 transform 없음. 내부 Milestone rotate는 outerbar 비교와 별개다. 브라우저 내부 scroll28 선택 알고리즘·실제 OS keyboard 동일 재현은 NOT TESTED.
- 원본 unchanged insert-before1회 및 보존된 read-only instrumentation report1case는 Local PASS. 원본 Release FAIL을 소급 변경하지 않는다.
- 최소 수정 결정: 내부 `.wx-table`의4행 overscan min-height784px를 실제viewport632px bounds로 제한하고 넘침을 clip한다. container X auto와 Core Y owner는 유지, CSS3선언 외 observer/제품 TypeScript 변경 없음.
- 대안 검증: container Y clip 단독은 X auto 때문에 computed hidden이며, table overflow:clip 단독도 table자체784px라28px drift를 막지 못한다. table min/max bounds+clip의 temporary browser 실측은 pane632/632·scrollTop28→0 및 재대입28→0 PASS.
- 관련 문서 구조 Gate/AC1~AC5 mapping PASS, local Markdown links189files PASS. 실제 의미·구현 검토와 구별한다.
- 관련 unit97건 PASS. 첫 통합 browser41건은39PASS/2FAIL이며 원본 결과를 보존한다. 두 FAIL은 신규 long-list fixture가 Chart scrollTop0을 정상값으로 잘못 기대한 테스트 오류: 실제 Core/owner300과 Chart300은 정상 동기화이고 Grid0·실제 중심 정렬은 PASS였다. Chart/Core owner 일치로 기대값을 교정하며 제품 CSS는 불변이다.
- 독립 qa_docs의 P2 두 지적(가상화 필수 visible ID vs Grid/Chart 누락 차단·음성 geometry 빈집합 통과 차단)을 신규 테스트에 반영했다. corrected3PASS → 신규 전체13PASS(26.8초) → 마지막 positive row-height assertion 보완 native2PASS(7.2초). 기존 canonical21/viewport7은 같은 제품 CSS에서 PASS 유지하여 distinct browser41건 PASS이며 중복 재실행을 별도 case로 합산하지 않는다.
- 원형 unchanged insert-before의 수정 후 독립3회 반복 PASS(10.0초). 최초 natural Release 실패는 local baseline에서 재현하지 못했으며, 별도로 이름 붙인 deterministic Grid28 주입으로 원본 CSS FAIL→수정 CSS PASS를 입증했다.
- 신규 E2E1440px Day screenshot을 report attachment에 포함한다. 실제 사용자 keyboard가 원본과 정확히 같은28px를 유발하는지는 NOT TESTED이며, short focus/Tab/ArrowDown/scrollIntoView 실행 PASS와 구별한다.
- 최종 typecheck 중 신규 음성 테스트의 DOM Node.remove 타입 오류를 발견하여 parentNode?.removeChild로 동등 동작을 교정했다. 신규 unused binding도 제거했다. 해당 음성1case PASS(6.9초), 최종 typecheck PASS, 신규 test2files ESLint0errors/0warnings. 최초 타입 실패를 보존한다.
- DOCUMENTATION_SYNC: PASS(관련 계약·원본 이력·실행 증거·required7문서 영향 및 AC1~AC5 정합). 독립 PRE_QA의 최종 frozen tree 판정은 PR·Issue 진행 원장에 연결한다. 본 packet freeze 시점의 최종 Trusted/Owner ACCEPT는 NOT TESTED.
- Manager typecheck PASS; eslint src+신규 E2E0errors/기존 warnings9건. 최초 npm lint는 임시 Next 출력 디렉터리까지 순회하여 중단하고 해당 생성물을 제외한 관련 범위로 실행했다. 생성물 정리 후 clean-tree `npm run typecheck` PASS, `npm run lint` PASS(0errors/기존warnings10건, 신규 test2files0warnings). dependency/CI 정책 변경 없음.
- PR Quality/E2E/Docker·Trusted/Owner 최종 판정·main/GHCR/정식 Release: NOT TESTED.

## 로컬 실행 환경과 재현 명령

Next16.3.8 dev server127.0.0.1:3117, 격리 SQLite·NEXT_DIST_DIR `.next-issue637`, 임시 `tests/config/.issue637.playwright.config.ts`로 기존 root 기준 Playwright 설정을 상속했다. 임시 config/spec·build·자동 생성 next-env/tsconfig는 Git에서 제외한다. 로컬 dev 결과는 원격 production build/Docker/전체 E2E PASS가 아니다.

- `npx vitest run --config tests/config/vitest.config.ts tests/features/gantt/projection-settled.test.ts tests/features/gantt/viewport-coordinator.test.ts tests/features/gantt/canonical-projection.test.ts`: 3suite97PASS.
- `npx playwright test --config tests/config/.issue637.playwright.config.ts tests/e2e/canonical-projection.spec.ts tests/e2e/viewport-coordinator.spec.ts tests/e2e/projection-row-alignment.spec.ts`: 최초39PASS/2신규assertionFAIL.
- 같은 임시 config의 `tests/e2e/projection-row-alignment.spec.ts`: 보완한13PASS; 마지막 native owner2case/음성1case는 변경한 assertion/type 정합성을 별도로 재검증한다.
- 같은 임시 config의 `tests/e2e/canonical-projection.spec.ts --grep '#570 actual Core structure insert-before' --repeat-each=3`: 원형 동일 조건3PASS.
- `npm run typecheck`, `npx eslint src tests/e2e/projection-row-alignment.spec.ts --ignore-pattern '.next-issue637/**' --ignore-pattern '**/.issue637-*'`, `node scripts/verify-release-version.mjs`, `node scripts/check-markdown-links.mjs` 및 기존 `qa_final_automated.docs_gate`의 actual diff/AC1~AC5 검산.

보존 report는 Git 외부 `/tmp/issue637-evidence/`의 frontend-baseline, frontend-differential-before, frontend-after, frontend-after-corrected, frontend-final, frontend-final-positive, frontend-final-negative, frontend-original-after-repeat 및 frontend 최종 결과 계약에 구분한다. instrumentation3회 stdout PASS는 report경로가 재사용되어3회 report를 보존하지 못했으며, 보존된 geometry1case만 artifact 근거로 사용한다. 원본 zip·민감 trace는 Git/Issue에 복사하지 않는다.
