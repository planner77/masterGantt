# Issue #719 — 4개 화면 상시 설명 축소와 상황형 도움말

## ISSUE WORK PACKET

- Primary Issue: [#719](https://github.com/planner77/masterGantt/issues/719); 원본 #715 / 문서 PR #716. #716의 성공을 이 제품 구현의 PASS로 사용하지 않는다.
- baseline: main `d2768676aa7a0edff67df9bdeb3e1b49979fd577`. #716 merge `5e622fe3`가 포함된 main, application `0.116.0`에서 시작한다.
- branch: `feat/issue-719-contextual-help`; version_decision=PATCH `0.116.1` (UI 기존 기능 개선, package/lock 동기화).
- 사용자 요청 종료점: 구현, 미해결 리뷰 thread와 충돌 해결, 최신 Head PR CI 시작. CI 모니터링·병합·Main/GHCR·Finalizer·tag/release·Issue 종료는 범위 밖이다.
- release_required: true (제품 UI 산출물 변경). release_authorized: false (정식 게시 승인 없음).
- risk_level: HIGH (여러 화면의 도움말/초안·권한·비동기 상태·Gantt 보존 회귀 영향). qa_required: true. qa_method: OWNER_MANAGED. independent_qa: N/A(Owner-managed). 별도 qa_docs 사전 검토는 최종 CI/Trusted QA/Owner 승인을 대신하지 않는다.
- 실제 역할: Manager=공통 ContextHelp·Milestone·통합·문서/버전·GitHub; ui_ux=읽기 전용 설계; frontend Resource=해당 화면/관련 하위 모드; frontend Logistics/Master=해당 화면; frontend browser=새 명세·동일 fixture 측정; qa_docs=분리된 읽기 전용 사전 검토.
- documentation_owner: Manager. DESIGN Delta B: #715에서 채택한 기존 영속 원칙의 실제 구현이며 새 전역 디자인 원칙을 추가하지 않는다.
- 변경하지 않는 계약: 서버 API/SQLite·Origin/If-Match/session, KPI·Capacity·Target/Milestone 분모, canonical snapshot, Gantt/Editor 상태·marker-OFF, CI/Ruleset·릴리스 권한. 새 SVAR action/PRO 기능 도입 없음.

## 설명 inventory와 노출 결정

| 화면/문구 단위 | 결정 | 근거·항상 유지하는 맥락 |
| --- | --- | --- |
| Milestone 프로젝트 전체·Gantt WBS 미적용 | 유지 | 모집단을 현재 WBS로 오해하지 않도록 직접 표시 |
| Milestone 자동/수동 기준일·snapshot 설명 | 축약 | 평가일·timezone·현재 snapshot/과거 복원 아님 유지 |
| Ready/차단/지연/임박/위험 각 정의 | 도움말 이동 | 지표 제목 인접 도움말, 실제 건수·action·임박 기간 입력 유지 |
| KPI 중첩/합산 불가 | 축약 + 도움말 | `지표 중복 집계 · 건수 합산 불가` 직접 표시 |
| 전체 상태 정렬·소속/선행 기준 | 축약 + 도움말 | 전체 소속·직접 선행 기준 및 공수와 다른 분모 직접 표시 |
| Milestone 공수 기간·환산·숨은 bucket·미설정 수 | 유지 | 표시 행 합계와 전체 공수의 차이를 숨기지 않음 |
| Resource 투입 구간·Grand Total·계획기간 가중 공식 | 도움말 이동 | 기간·환산·선택 범위, 고유 Assignment·비가산·실제 기여/소진 아님 직접 표시 |
| Resource 그룹 개인 분류 | 축약 + 도움말 | Group 직접 담당 Task의 보조 진단 경로 유지 |
| Resource Target 계산·정렬 설명 | 도움말 이동 | 서버 전체 선택 총계, Project 참고, Target/Group 소계 비가산·M/M 미설정 직접 표시 |
| Resource Plan Capacity 모집단 상세 | 축약 + 도움말 | Project 개인 수·유효 근무일1 M/D·비가산·전사 가용 인력 아님 유지 |
| Resource Milestone 계층 펼침12개·페이지 유지 설명 | 도움말 이동 | 접기 action 인접, 현재 집계/페이지·미지정 상태 유지 |
| `/resources` 소개·그룹 구성원·저장 절차 | 도움말 이동 | 별도 관리자 권한·그룹과 개인 할당 별도·draft/최신 목록·삭제 영향 유지 |
| 물류 구성 소개·WBS 구별 | 축약 + 도움말 | `Gantt WBS와 독립` 직접 유지 |
| 물류 공정/설비/시스템/조율 빈 상태 학습문구4개 | 도움말 이동 | 빈 상태와 생성 명령 직접 유지; 공정 선행 조건은 명령 시 지속 role=alert |
| 물류 Dashboard 관련 Milestone 정의 | 축약 + 도움말 | 전체 소속·직접 선행 기준, 물류 Task/진척/M/D 범위 불변 직접 유지 |
| `/logistics-admin` 전역 유형 소개 | 축약 + 도움말 | 전 프로젝트 공통 유형 직접 유지; 내부 관리자 컴포넌트는 오류/권한/상태뿐이므로 변경 N/A |
| 기준정보 범주 선택/추가 방법 | 도움말 이동 | 현재 범주·입력 label·건수/상태·전 프로젝트 공통 유지 |
| 기준정보 사용 중 stable code·행 저장 후 입력 교체 | 유지 | disabled 입력의 이유 aria-describedby, 저장/최신 조회 시 미저장 교체 경고 유지 |
| 모든 화면 loading/empty/readonly/edit/validation/401/412/network/stale/삭제·공유원본 영향 | 유지 | 중요 실패·복구·초안·권한·pending guard를 닫힌 도움말로 숨기지 않음 |

## Interaction / 상태 매트릭스

- 기본: 제목·지표·주요 명령/조건을 우선하고 Help 본문은 DOM 흐름 밖 native popover top layer에 표시한다. 닫힌 도움말 본문은 높이/스크롤 예산을 예약하지 않는다. React portal로 heading/p 내부의 잘못된 block 중첩도 피한다.
- hover/focus에서 열림, click/Enter/Space로 고정/닫기, 바깥 click/touch·Escape로 닫기. Escape는 기존 상위 Dialog/Workspace 명령으로 전파하지 않고 trigger에 preventScroll focus 복귀한다. 포인터가 본문으로 이동해도 읽을 수 있다.
- 긴 KO/EN·작은 viewport: 12px 경계, 최대360px 폭·viewport 제한 높이/본문 scroll. 조상 overflow와 Dialog top layer 경계를 피하며 coarse pointer에서는44px hit area를 사용한다.
- 조회 readonly에서 도움말 접근 가능; 도움말 동작은 mutation/필터·선택·canonical 변경을 만들지 않는다. loading/stale/error는 기존 화면 경고와 명시 복구 action을 유지한다.
- dirty/pending/destructive: 초안·중복 제출·취소/닫기·공유 원본 영향 확인은 기존 구현과 동일. Resource 편집 Dialog의 저장 도움말도 busy/discard 중에는 disabled로 기존 전체 잠금과 Tab 경계를 유지한다. equipment 생성의 공정 없음만 native alert 대신 기존 지속 오류 banner에 표시한다.

## DOCUMENTATION_SYNC

- `DESIGN.md`: N/A(#715 영속 원칙의 구체화이며 새 전역 디자인 정책 없음)
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/LOGISTICS_DOMAIN_DESIGN.md`: UPDATED
- `docs/MILESTONE_STAGE_GATES.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_719.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/SCHEDULING_ENGINE.md`: N/A(표시 설명만 변경하고 일정 계산·Milestone 판정은 불변)
- `docs/API.md`: N/A(HTTP·권한·Origin·If-Match·revision·canonical 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(SQLite·migration·데이터 모델 변경 없음)
- `docs/SECURITY.md`: N/A(session·password·서버 권한 경계 불변)
- `docs/CI_CD.md`: N/A(CI/CD·GHCR·Ruleset·release 권한 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(Required Quality/E2E/Docker 및 Trusted QA 검증 계약 불변)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 Lifecycle 실행이며 정책 변경 없음)

## AC_TEST_COVERAGE

- AC1: inventory 표 및 `tests/e2e/issue-719-contextual-help.spec.ts`의 동일 fixture/5폭 before/after 설명 높이·data top·가시 행 수. 실측 JSON·원본 source는 검증 원장을 따른다.
- AC2: 같은 spec에서 기본 닫힌 도움말과 열림 전후 data top/document width 불변을 검증. 비가산/범위/단위 등 중요한 라벨은 소스 diff·기존 spec과 대조.
- AC3: 같은 spec의 Enter/Space/Escape/focus restore·hover/click·touch/tap/ARIA·popover bounds. 실제 screen reader는 NOT TESTED이며 자동 ARIA 검사와 구별.
- AC4: `resource-error-recovery.spec.ts`, `resource-tabs.spec.ts`, `project-master-admin.spec.ts`, `master-controls-density.spec.ts`, `project-logistics-management.spec.ts`의 인증/validation/draft/401/412/pending/삭제 계약과 새 도움말을 교차 검증.
- AC5: `milestone-dashboard-state.spec.ts`, `milestone-stage-dashboard.spec.ts`, `resource-dashboard-ui.spec.ts`, `issue-621-resource-target.spec.ts`, `issue-622-resource-plan-target.spec.ts`의 집계·drill·readonly·marker-OFF/Gantt state. 서버/도메인 구현은 불변.
- AC6: 새 spec의 390/768/1024/1440/1920px ×6 표시 화면, 긴 KO/EN·touch/keyboard/overflow와 기존 상태 spec. 모든 상태×모든 폭의 직적 또는 실기기/최종 수동 UX PASS를 주장하지 않는다.
- AC7: DOCUMENTATION_SYNC·CHANGELOG/Work Packet 및 #715 DESIGN 규칙의 제품 적용. API/DB/Scheduling/CI는 계약 불변 N/A 사유를 명시.

## 검증 원장 / 현재 상태

- 환경: WSL2 Linux, Node22.14.0/npm11.10.0, Next16.3.8/Playwright1.63.0. 최종 before/after는 동일 실제 lock 의존성·기본 Turbopack·Chromium·fixture·높이900/default100%에서 측정했다. 의존성 install은 별도 `/tmp/mastergantt-719-deps`에서 npm ci 후 전용 worktree에 물리 파일로 구성했으며 기존 사용자 checkout/node_modules는 변경하지 않았다.
- 제품 source는 별도 검증 worktree의 production build와 byte 단위 동일함을 확인했다. 최종 source/test·측정 파일 SHA256은 [manifest](../../../output/playwright/issue-719/sha256-manifest.json)를 참조한다. 원격 commit SHA는 PR/Issue STATUS에 남긴다.
- typecheck PASS, 전체 lint PASS(기존 경고14, 오류0), production build/runtime-tools PASS. dependency offline tree/version/Markdown link/test discovery PASS. 전체 Vitest/로컬 Docker는 실행하지 않았으며 관련 model/client Unit6파일31개 PASS와 원격 전체 회귀를 구별한다.
- 새 Chromium after9 PASS45.2s:6화면×5폭, Enter/Space/Escape·hover/click·touch44px·accessible description·popover 경계·닫힌/열린 작업면·초안 보존·공정 선행 조건·pageerror/hydration0·도움말 mutation0. baseline6 PASS18.4s; after 전용3건 skipped이며 before 성공으로 계산하지 않는다.
- 기존 상태/교차 회귀와 실제 HTTP/SQLite 검증 결과는 아래 실행표에 확정 기록한다. 일부 상태×5폭, 실제 screen reader·실기기/native125%·최종 수동 UX는 NOT TESTED다.
- 분리된 실제 사전 소스 Reviewer `/root/pre_qa`(qa_docs)는3개 접근성 지적의 수정과 계약/중요 경고 보존을 재검토했다. 이는 OWNER_MANAGED의 별도 최종 Trusted QA·Owner ACCEPT 또는 AGENT 인간 승인 영수증이 아니다.
- 원격 quality/e2e/docker/Trusted QA·Owner ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED다. main/GHCR·Finalizer·정식 release·Issue 종료는 실행하지 않는다.

### 실측 결과와 범위

[비교 JSON](../../../output/playwright/issue-719/comparison.json)의30개 viewport 관측값을 따른다. `noteOnlyHeight`는 보이는 note/hint/description class의 p 및 role=note 높이의 합이다. class 없는 상단 소개/KPI 본문·margin과 숨은 설명은 포함하지 않으므로 화면 전체의 설명 높이·절감률로 확대하지 않는다. inventory와 실제 표/주요 데이터 시작점·가시 행 수를 함께 판단한다.

| 1440px 화면 | 표 시작 y before → after(px) | 가시 행 before → after |
| --- | --- | --- |
| Milestone | 918.5 → 918.5 | 0 → 0 |
| Resource | 802.5 → 784.5 | 1 → 1 |
| Resource 관리자 | 467.390625 → 443.390625 | 3 → 3 |
| 물류 구성/KPI | 975.46875 → 948.875 | 0 → 0 |
| 물류 유형 관리자 | 417.40625 → 417.40625 | 3 → 3 |
| 기준정보 관리자 | 675.015625 → 665.40625 | 4 → 4 |

최종30개 관측의 표 시작점은 유지/개선이며 가시 행 증가는768px 기준정보0→1에서만 확인했다. Milestone390px는 최초 KPI y912→894, 표2226→2086.5이며768/1024px 표는 각각1462.5→1417.5/1396.5→1369.5다. 데스크톱 Milestone·물류 유형,1920px Resource 등 변화 없는 범위도 그대로 기록한다. 모든 폭에서 행이 증가하거나 일정 비율이 절감됐다고 주장하지 않는다.

### 로컬 최초 실패와 교정 기록

1. 기존 Git/gh 인증은401/invalid token이었다. 원격 읽기·쓰기에는 실제 사용 가능한 GitHub Connector를 사용한다. API 게시 시 로컬 index tree와 원격 tree가 동일한지 확인한다.
2. 기존 checkout 공유 의존성은 Next16.3.4로 lock16.3.8과 달랐고 symlink를 통한 Turbopack 실행은 out-of-root 오류였다. 최종 증거는 물리 exact-lock 의존성16.3.8로 재검증했다.
3. 초기 Help div가 p 내부에 중첩되어 hydration 오류가 발생했다. React portal로 본문을 흐름 밖에 배치했다.
4. native auto popover의 hover 직후 click light-dismiss 경합으로6화면의 마지막 click assertion이 FAIL했다. manual popover와 명시 outside/다른 도움말/Escape 닫기로 교정했다.
5. 독립 사전 검토의 hover-only Escape→focus 재열림, focus 보유 pointer leave 닫힘, tooltip aria-label의 실제 본문 대체를 수정하고 정확 회귀를 추가했다. ARIA 본문 검사나 pageerror assertion을 완화하지 않았다.
6. 초기 관리자 도움말의 별도32px 행으로 data top+8px, Milestone heading 도움말의 KPI/table 높이 증가가 실측됐다. 기존 heading/actions에 배치해 최종 표가 baseline보다 내려가지 않도록 보완했다.
7. source/version 변경 중 개발 HMR과 out-of-root symlink+webpack 실행에서는 Next Router 초기화 오류가 발생했다. 초기 기존 회귀12PASS/3login timeout/1중단/1skip/48미실행과 milestone pageerror FAIL을 최종 PASS로 소급 바꾸지 않는다. [오류 stack](../../../output/playwright/issue-719/next-dev-pageerrors.json)은 Next hmrRefresh 경로이며, 최종 물리 의존성+기본 Turbopack before6/after9에서는 pageerror0이었다.
8. 전체 lint 최초 실행은 임시 `.next-719-after` 생성 JS까지 검사해483errors/3302warnings로 실패했다. 별도 clean source worktree의 전체 lint는0errors/기존14warnings였다. 생성물/기존 #455/#463 캡처는 제품 diff에서 제외·복원한다.

### Local Pre-PR 영향 선정 경계

`verify:prepr --mode=fast` 및 `--mode=targeted`는 신규 UI10경로의 producer→consumer 등록이 없어 UNKNOWN/BLOCKED이며 테스트를 실행하지 않았다. 작업 중 최초 sourceStable=false도 보존하고 최종 source 고정 뒤 동일 미등록 차단을 다시 기록한다. 검증기를 변경하거나 자동 PASS로 우회하지 않는다. 아래 수동 매핑에 따른 개별 실행과 자동 선정 도구의 BLOCKED를 구별한다.

| 자동 미등록 producer | 직접/인접/음성 검증 |
| --- | --- |
| admin 두 page·project-master TSX/CSS | #7196화면/5폭, project-master-admin/master-controls-density, 권한·입력·오류·revision |
| ContextHelp TSX/CSS | #719 keyboard/hover/touch/본문 ARIA/overflow, profile modal 초안·Escape, 도움말 mutation0 |
| logistics management/dashboard TSX/CSS | #719 물류/선행 조건, project-logistics-management의 Gantt/표/readonly/실제 원문, milestone-stage-dashboard |
| 기존 등록 Resource/Milestone producer | model/client Unit31, Resource error/tabs, Milestone state·동일 Core/native viewport, Target/Plan 실제 원본 조회 |

### 최종 실행표

| 실행 | 결과 | 범위/재사용 경계 |
| --- | --- | --- |
| 관련 model/client Vitest | PASS31개/6파일 | Resource4파일21개 포함; 전체 Vitest 아님 |
| 동일 Turbo baseline | PASS6개/18.4s, after 전용3skip | 동일 fixture·5폭; baseline6과 after9를 혼동하지 않음 |
| 최초 physical Turbo after | PASS9개/45.2s | pageerror/hydration0·기본 도움말 전체 |
| 기존 상태/교차6spec | 최초73PASS/2FAIL/2skip,2.3m | 총77case; #455 첫 Tab 가정, #453 pending 도움말 enabled의 실제 실패 보존 |
| 교정 후 새9+실패2 재검증 | PASS11개/58.8s | 첫 Tab의 도움말 focus/본문 확인 뒤 기존 input focus3px 단언 유지; pending 저장 도움말은 busy/discard에 disabled 적용, 기존 전체 잠금/Tab/Escape 단언 유지 |
| 실제 HTTP/SQLite3case | PASS3개/2.7m | #621 고유 원장/권한412/조회 mutation0, #622 선택80·Project140/정확 편집·Excel·5폭, #463 Editor→KPI/공수/물류/Resource 및 readonly peer. 마지막 저장 도움말 disabled 교정 이전의 동등 읽기 경로 증거 재사용이며 global Catalog pending 회귀는 위 별도 실행 |
| Local Pre-PR 자동 선정 | BLOCKED | 최종 sourceStable=true, UNKNOWN10/missing0. 수동 직접 매핑·개별 검사와 별도 상태 |
| 전체 lint/typecheck/production build | PASS(최종 검증 원장 참조) | lint 기존14warning/0error, 초기 생성물 lint 실패와 구분. 제품 source 해시는 manifest |
| Required Quality/E2E/Docker·Trusted QA·Owner | NOT TESTED | PR CI를 시작하고 모니터링하지 않음; 병합/최종 ACCEPT 없음 |

실행 재사용을 포함한 고유 제품 후보 Chromium87case(기존75+신규9+실제 원장3)의 관련 검증을 확보했다. baseline6은 별도 버전의 비교 관측이며 중복 rerun을 고유 case 수로 더하지 않는다. 구 버전 실패/중단·전체 회귀 미실행은 그대로 보존한다. [검증 원장](../../../output/playwright/issue-719/verification/)와 실측/manifest를 원격 PR에 함께 게시한다.

### 최종 사전 검토/게시 판정

- `DOCUMENTATION_SYNC`: PASS(관련 문서 갱신·N/A 근거·AC mapping·로컬 link 검사·분리된 사전 의미 검토 완료). DESIGN Delta B, 서버/DB/Scheduling/CI 정책 변경 없음.
- 실제 사전 Reviewer `/root/pre_qa`의 코드·문서 의미 검토는 PASS(추가 차단 지적0)이며, 원격 Head/tree 동등성은 Issue STATUS/PR 본문에 기록한다. 최종 production build는 exit0과 동일 제품 source를 확인했다. 이것은 Owner의 최종 병합 승인 또는 AGENT 인간 영수증이 아니다.
- branch는 최신 main `d2768676aa7a0edff67df9bdeb3e1b49979fd577`에서 출발했다. PR 생성 시 살아 있는 base·mergeability·review thread를 재조회하고 Head·CI Run URL/attempt를 기록한다. 요청 종료점은 Full PR CI 시작이며 결과는 NOT TESTED다.

## 2026-10-18 PR #722 / CI #2932.1 접근성 리뷰에 따른 보완

- 원본: [Full PR CI Run 39086924294 attempt 1](https://github.com/planner77/masterGantt/actions/runs/39086924294), Head `d5344bdfa8239c192bccfbe1c84930d02d7763d8`, Base `d2768676aa7a0edff67df9bdeb3e1b49979fd577`, test merge `a248bd383b3abdd51a4270e2e96f27622715c3f2`.
- 원본 Quality/E2E(6/6)/Docker Required aggregates **SUCCESS**. [QA Final job 117559273483](https://github.com/planner77/masterGantt/actions/runs/39086924294/job/117559273483)만 **BLOCKED / failure**, 사유 `미해결 review thread`. 원본 결과를 성공으로 변경하지 않는다.
- [Codex P2 리뷰 스레드](https://github.com/planner77/masterGantt/pull/722#discussion_r4305289690): 팝오버 `overflow:auto`가 작은 화면/확대율/긴 설명을 잘라도 키보드로 스크롤할 경로가 없다. `src/components/ui/context-help.tsx`는 포털 구조/현재 ARIA 설명·hover/click·Escape·focus 복원을 보존하고, 열린 도움말 버튼에서 Arrow/Page/Home/End로 팝오버 내부를 스크롤한다.
- `tests/e2e/issue-719-contextual-help.spec.ts`: 짧은 viewport + 긴 KO/EN을 합성해 실제 overflow를 확인하고 Arrow/Page/Home/End, 열린 상태/trigger focus/Escape 복원을 단언한다. 기존 동일 fixture 다섯 폭/hover/focus/touch, 관리자 초안·비활성화, 대상 대시보드·Gantt/marker-OFF은 인접 회귀 대상이다.
- 전체 이력 및 최신 오류·분류·보완·재검증 범위·미검증: [전용 누적 실패 원장](../../ISSUE_719_FAILURE_ANALYSIS.md). 이 제품 접근성 교정은 AC3·AC6의 증거 추가이며, 원본 before/after 측정과 원본 Run 원장을 덮어쓰지 않는다.
- 수정 후보의 로컬 E2E/typecheck/lint: **NOT TESTED**(이번 GitHub connector 환경에는 소스 checkout·브라우저 실행이 없음). 새로운 exact-Head Full PR CI 결과는 실행 전 **NOT TESTED**이며, QA/Trusted·Owner 최종 ACCEPT와 정식 GHCR 릴리스도 승인받지 않았다.

## 2026-10-18 REWORK #2 — Run #2933.1 누적 진단 / 정확 테스트 전제 보완

- [이슈 전용 실패 누적 원장](../../ISSUE_719_FAILURE_ANALYSIS.md)에 F-001(#2932.1 QA review BLOCKED)과 F-002(#2933.1 신규 keyboard E2E FAILED) 전체 Run/Attempt/Job·원본 trace·재발/신규 원인·교차 테스트 범위를 함께 기록했다. F-001 원본은 덮어쓰지 않았다.
- [Run #2933.1](https://github.com/planner77/masterGantt/actions/runs/39089185087): Quality/Docker SUCCESS, Chromium Shard2 신규 `issue-719-contextual-help.spec.ts:145`에서 `tooltip not found`로 FAIL; 다른 5 shard는 CI fail-fast CANCELLED, QA Final은 `required e2e 미성공` 파생 FAIL. Shard2는 43 PASS/1 FAIL/86 NOT RUN; 미실행을 PASS로 합산하지 않는다.
- 실제 [Playwright trace artifact](https://github.com/planner77/masterGantt/actions/runs/39089185087/artifacts/12121239923) 분석: focus 후 tooltip은 이미 OPEN/aria-expanded=true, 이어지는 Enter 뒤 닫힘. **실제 keyboard scroll 실행 이전의 중복 토글/테스트 상태 전제 오류**다. 기존 제품 Arrow/Page/Home/End 기능 실패라고 단정하지 않고, keyboard scroll 케이스의 중복 Enter만 제거하며 focus-open + 최종 overflow/scroll/Escape 검증을 강화했다. 6화면×5폭 Enter/Space 회귀는 그대로 둔다.
- 이전 F-001 코드 교정과 WCAG 관련 사용자 요구, 공통 ContextHelp·원본 제품 범위/권한·API·DB·Gantt 계약은 변경하지 않았다. 이번 코드 변경은 E2E test contract만이며 `DESIGN.md`/영속 가이드 추가 수정은 N/A(이미 영속화됨).
- 새로운 exact-head Full PR CI 결과는 시작 시점 **NOT TESTED**. `risk_level=HIGH`, `qa_required=true`, `qa_method=OWNER_MANAGED`, `release_required=true`, `release_authorized=false`. 원격 final success/Trusted QA/Owner ACCEPT·병합/Main/GHCR/Finalizer는 본 요청에서 승인되지 않았다.
