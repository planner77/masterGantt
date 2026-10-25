# Issue #799 — 6관점 요약·지표 시각 계층

## Issue Work Packet

- repository: `planner77/masterGantt`
- issue: [#799](https://github.com/planner77/masterGantt/issues/799)
- lifecycle_phase: PRE_QA / PR_CI_READY
- 승인 범위: 분석·계획·구현·문서 동기화·Ready PR Full CI 시작까지. 결과 모니터링·병합·Main/GHCR·릴리스·Finalizer·브랜치 정리·Issue 종료는 제외한다.
- baseline/main: `fcd1ae59d268efa1913f4de625a9013cabd1de4a` (#798 병합 포함)
- branch/worktree: `feat/issue-799-dashboard-metrics`, `/home/planner/Dev/masterGantt-799`
- current_version: `0.133.0`
- candidate_version: `0.133.1` (기존 표시의 호환 가능한 정돈이므로 PATCH)
- version_decision: PLAN의 잠정 keep에서 제품 변경 버전 정책에 따라 PATCH로 정정. package/lock version3곳만 변경하며 의존성·SRI는 유지한다.
- release_required: true
- release_authorized: false (버전별 정식 게시 승인 없음)
- risk_level: HIGH
- risk_reason: 5개 동적 관점의 공유 요약 CSS 및 Milestone 표시 영향, version-only 보호 경로. API/도메인 계산 변경은 없다.
- qa_required: true
- qa_method: AGENT
- manager_decision: NOT TESTED
- MERGE_READY: BLOCKED
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN,STATUS,EXCEPTION

## 범위와 담당

KPI를 의미별 구획·숫자/단위·상태의 내부 기준으로 삼고, 현재 동적 관점의 기존 공통 요약 영역에만 label/value 위계와 반응형 숫자 읽기를 적용한다. 원본 구성 참고·필터된 작업·전체 Milestone Gate·개인 Assignment/전체 Capacity·Plan의 모집단은 합치지 않는다. 정상0·null·미산정·부분합·미연결·진단의 원래 값과 문구, ContextHelp·원본 drill을 보존한다.

#797/PR #801의 감사는 이전 source의 PARTIAL 관측이므로 현 source의 PASS로 재사용하지 않는다. 완료된 #798의 toolbar·조회 구성은 본 작업의 수정 대상이 아니다. #800의 전 화면 상시 기준선 확대, #517의 실환경 검증, #720의 제품 매뉴얼을 중복 구현하지 않는다.

| 담당 | 소유권 |
| --- | --- |
| Manager | 계획·문서·Issue 기록·범위·통합·최종 게시 인계 |
| ui_ux `/root/metrics_design` | read-only 6관점 인벤토리·설계·Design Delta 검토 |
| frontend `/root/metrics_frontend` | 제품 요약 CSS·기존 테스트 확장·수동 관측 도구·`output/playwright/issue-799/` |
| infra `/root/metrics_publish` | package/lock PATCH·동일 tree 원격 게시·Ready PR·CI 시작 확인; 모니터링 없음 |
| qa_docs | 실제 별도 read-only 코드·테스트·문서·브라우저 근거 사전 검토; 최종 인간 QA와 구분 |

동일 파일 동시 작성과 Sub-Agent의 직접 Issue 댓글은 허용하지 않는다. 기존 workspace의 미추적 자료는 별도 worktree로 보존한다.

실제 before/after 런타임은 모두 version-only PATCH가 적용된0.133.1이다. before 제품 표시 CSS는 baseline main과 같으며, main의0.133.0을 실제 캡처 버전으로 표시하지 않는다. working tree 제품 지문은 캡처별 manifest에 별도로 기록한다.

## 설계와 상태

```text
현재 조회 기간·기준일                     기존 표시 유지
구성 참고 / 프로젝트 참여 참고           기존 모집단 제목 유지
  label: 보조 계층
  value·단위: 주 계층, tabular 숫자
필터된 작업 / 선택 개인 배정              동일 위계, 별도 분모
범위·비가산 안내                          상시 유지
원본·진단·전체 Gate                       기존 disclosure·drill
```

KPI card/quality pane, 기존 Milestone 관리 카드·원본 표와 Resource Plan matrix는 KEEP한다. 5개 동적 소비자와 공통 renderer의 기본 고유 총계 fallback이 공유하는 `.summary`를 사용하므로 새 공통 primitive·카드·폰트·색상 체계는 추가하지 않는다. 완료/지연을 하나의 실패색으로 칠하지 않고 색상 없이도 기존 문구로 상태를 읽을 수 있게 한다. 숫자·단위의 줄바꿈과 긴 상태문을 실제 화면에서 확인하고 고정 높이/clipping으로 밀도를 맞추지 않는다.

| 상태 | 보존 계약 / 검증 경계 |
| --- | --- |
| default / 0 / null / 부분합 | 기존 formatter·단위·미산정·공수 미설정·M/M 환산 기준 안내 유지 |
| readonly | 조회·drill과 원본 편집 권한을 기존 서버/host가 판단 |
| loading / error / stale | 기존 상태 표시와 generation·원본 이동 잠금 유지 |
| dirty / pending / 401 / 412 | 기존 Editor 초안·잠금·명시 복구 유지 |
| 긴 KO/EN / 동명 | 이름 우선·식별 정보 disclosure·표 내부 scroll 유지 |
| filter / root / 일정 복귀 | spec·선택·확장·focus·scroll 및 canonical ID 유지 |

## AC_TEST_COVERAGE

- AC1: 같은 최신 source/Project snapshot의 KPI+5관점 제목·분모·값/단위·상태·행동·표·고급 정보 인벤토리를 작성하고 5폭 before 관측으로 KEEP/FIX/N/A를 판정한다. 실제 결과는 아래 실행 기록과 관측 보고서에 구분한다.
- AC2: 공통 요약 표시만 조정하고 구성/작업/전체 Gate·Resource Plan 분리와 0/null/미산정/부분합의 기존 모델/formatter·DOM 표기 보존을 검증한다. 계산·명칭·값을 바꾸지 않는다.
- AC3: 같은 fixture의 390/768/1024/1440/1920px before/after PNG·geometry로 KPI KEEP, first-data/표 Y·가시 지표·간격·문서 overflow·owner scroll을 대조한다. 상태와 긴 문구는 위험 기반 선택 검증하며 미실행 조합은 NOT TESTED다.
- AC4: 기존 소비자 E2E를 우선 재사용하여 keyboard·accessible name·focus·정확 Task/Assignment/Milestone/설비/System/Resource 원본 이동과 필터 복귀를 검증하고 snapshot·고유 총계·canonical fingerprint·mutation0을 비교한다.
- AC5: 기존 #731~#737·#717·#719·cross-screen의 테스트/fixture를 검색하고 아래 TEST_LIFECYCLE_REVIEW에 EXTEND/KEEP_UNIQUE와 실행 범위를 기록한다. Required3·8shard·QA/Owner gate는 변경하지 않는다.
- AC6: PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN·활성 PLAN·CHANGELOG·본 Work Packet을 갱신하고 Design Delta B의 DESIGN.md N/A 사유를 기록한다. 실제 browser·local·PR exact-head CI·QA/Owner 판정을 분리한다.

## TEST_LIFECYCLE_REVIEW

- 검색: `tests/e2e/issue-732-milestone-dashboard.spec.ts`, `issue-733-process-workarea-dashboard.spec.ts`, `issue-734-equipment-dashboard.spec.ts`, `issue-735-system-dashboard.spec.ts`, `issue-736-resource-dashboard.spec.ts`, `issue-737-target0-acceptance.spec.ts`, `issue-717-*.spec.ts`, `issue-719-contextual-help.spec.ts`, `issue-730-view-composer.spec.ts`, `cross-screen-regression.spec.ts`, 기존 KPI/Resource spec 및 `tests/e2e/helpers/ui-geometry.ts`.
- EXTEND: 기존 공통/소비자 E2E에 변경된 metric typography·wrap·0/null/부분 의미의 직접 검증을 연결한다. 구체 파일·case와 최종 명령은 실행 기록에서 확정한다.
- KEEP_UNIQUE: 공통 renderer의 소비자 미지정 기본 고유 총계 fallback은 인접 표시 경계이며 #730 공통 회귀로 보존한다. 6관점의 정확 원본·Gate·개인 Plan/Excel·snapshot·stale/dirty/권한·이름 우선·상황형 도움말·Gantt/필터 복귀를 담당하는 기존 회귀는 고유 경계로 보존한다.
- ADD: #798의 fixture와 관측 helper를 재사용하는 opt-in #799 before/after 수집·비교 도구. 상시 E2E 중복 파일·샤드 변경은 추가하지 않는다.
- 삭제/폐기/통합: N/A. skip/retry/timeout·Required3·8shard·Trusted QA·Ruleset을 완화하지 않는다. 새로운 로컬 전체 회귀를 공식 검증 대신 반복하지 않는다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_799.md`: UPDATED
- `docs/ISSUE_799_DASHBOARD_METRICS.md`: UPDATED
- `docs/ISSUE_799_FAILURE_ANALYSIS.md`: UPDATED
- `docs/evidence/issue-799/independent-dom-stress.json`: UPDATED
- `docs/evidence/issue-799/independent-browser-spot-check.json`: UPDATED
- `docs/evidence/issue-799/prepr-plan.json`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(Delta B; 기존 flat surface·숫자 위계·모집단 구분 원칙의 구체화이며 신규 공통 원칙을 채택하지 않음)
- `docs/REQUIREMENTS.md`: N/A(기존 화면 표시 정돈으로 업무 요구·계산·공개 기능 범위 불변)
- `docs/ARCHITECTURE.md`: N/A(공유 CSS 표시만 수정하며 계층·데이터 흐름·Gantt 경계 불변)
- `docs/API.md`: N/A(API·DTO·요청·응답·권한·revision 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB·migration·저장 원본 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(Milestone 경로의 표시와 관측 증거만 영향; 일정·Gate·진척·공수 산식 변경 없음)
- `docs/SECURITY.md`: N/A(서버 session·Origin·revision·보호 mutation과 권한 판단 변경 없음)
- `docs/IMPORT_EXPORT.md`: N/A(기존 원본 drill·Plan·Excel 진입 유지; 교환 형식 변경 없음)
- `docs/IMPORT_SCHEMA.md`: N/A(Import와 JSON·CSV 계약 변경 없음)
- `docs/EXCEL_EXPORT.md`: N/A(Excel 산식·selector·출력 형식과 지원 범위 변경 없음)
- `docs/CI_CD.md`: N/A(기존 PATCH 버전 규칙 적용만 수행; workflow·required·release 정책 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(기존 Full8·Required3·Trusted QA와 환경별 검증 계약 유지; 실행 상태는 본 계획과 Issue STATUS에 기록)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 canonical PR·QA 영수증·Owner·릴리스 권한 정책 유지)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 Work Packet·문서·QA·PR CI Gate 적용; 절차 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(독립 Agent 사전 검토와 AGENT 인간 최종 QA 영수증·Owner 승인 경계 유지)

## 실행 증거와 미검증

[누적 로컬 실패 원장](../../ISSUE_799_FAILURE_ANALYSIS.md)에 browser 실행 파일·seed 순서·보조 관측 미완결을 구분해 보존한다.

최종 구현·표준 before/after30쌍 비교·Unit22·격리 Chromium7은 로컬 PASS다. 보조 after6은4완결/2FAIL의 PARTIAL을 유지하고 별도 readonly2 인벤토리와 exact-query5 full raw 동등성 PASS로 보완했다. [최종 실측/상태 표](../../ISSUE_799_DASHBOARD_METRICS.md)에 범위·수치·source를 기록한다. 이전 #798·#797 성공을 신규 후보의 PASS로 전용하지 않는다.

원격 quality/e2e/docker·Trusted QA·QA_FINAL·Manager ACCEPT는 NOT TESTED, MERGE_READY=BLOCKED다. 보호된 version 경로를 포함한 AGENT 모드의 인간 QA/Owner 영수증은 최종 병합 단계의 조건이며 Agent PRE_QA로 대신하지 않는다. 실제 터치 기기·screen reader·native125%·운영 proxy/TLS·Windows Excel/DRM은 별도 NOT TESTED로 남긴다. 사용자 지정 종료점 이후 CI 완료를 모니터링하지 않는다.


## 최종 후보 Local Fast Feedback — 진행 기록

최종 제품 CSS SHA256은 `78a76f5c98a99d4a91cf5994f6a89310c4d9441e7b922d92eb1ed73e0d71eaf5`다. 기존 intrinsic flex-wrap을 유지하고 gap8/16·label13px muted·value18px/600/tabular·숫자 normal wrap을 적용한다. 구현 담당의 [시작 source 지문](../../../output/playwright/issue-799/final-validation-start.json)과 최종 실행 지문을 대조한다.

- [관련 Unit](../../../output/playwright/issue-799/local-unit.json): 기존4파일22case PASS. describe suite9와 파일4를 구분한다. 공수0/unknown/partial/empty formatter는 기존 model Unit 실행 근거이며 모든 상태의 browser PASS를 뜻하지 않는다.
- [선택 Chromium](../../../output/playwright/issue-799/local-chromium.json): 최종7/7 PASS, retry0/skip0/flaky0,300.117초. #732~#736의5관점5폭·keyboard/scroll, Resource 개인 Plan/같은 snapshot Excel/정확 Assignment 복귀·stale/error·readonly/응답 역전/낡은 Excel 폐기를 실제 격리 application에서 실행했다.
- [독립 실제 fixture spot-check](../../evidence/issue-799/independent-browser-spot-check.json): 별도 qa_docs의 최종 source 설비390/1440 지표12개 containment·overflow0·표 owner scroll·도움말 Enter/Escape/focus 복귀와 revision17/fingerprint 동등.
- [독립 DOM stress](../../evidence/issue-799/independent-dom-stress.json): 같은 최종 source390/1440에서20자리수량·긴부분합·산정불가 문구6/6 PASS. 합성 DOM text를 finally 복원한 표시 검사이며 해당20자리의 서버 저장 허용이나 실제 partial 서버 fixture 검증을 주장하지 않는다.
- Playwright 원본 stdout/runtime JSON은 ignored `.prepr-reports/issue799-originals/`에 보존했다. 게시 영수증은 원본 SHA/크기/경로·case결과·source를 남긴 정제 자료다. 제외 grid 후보3PASS와 초기 setup7FAIL을 최종7PASS에 합산하지 않는다.

[비교 JSON](../../../output/playwright/issue-799/comparison.json)은 PASS다. 표준30쌍의 표시값·단위 동등·KPI5 geometry KEEP·동적25쌍의 report snapshot/spec/filter/totals 동등·독립 exact raw5 동등·canonical17/Task4/Assignment1·mutation0·overflow0을 검증했다. 동적25쌍의 첫 요약Y 불변, 표Y1.5~89px 앞당김이며 900px viewport의 전체 표 가시성을 주장하지 않는다. 표준 collector SHA256 `a5e76e69b9b0a27ae9850ef56ca3579823afd21478b9bb8945b6ae68dcabacbe`는 전후 동일하다.

보조 before6은 완결했으나 원래 after6은4/6·2FAIL/PARTIAL이다. 별도 readonly process/resource2 inventory·4PNG와 독립 exact-query5 full raw 응답을 [별도 영수증](../../../output/playwright/issue-799/after/read-only-supplement.json)으로 보완했다. 기본30쌍의 같은 editable 권한 geometry와 readonly 보완을 합쳐 깨끗한 단일6/6 실행으로 표시하지 않는다. 서로 다른 권한의 전역 header geometry는 비교하지 않는다.

최종 typecheck/ESLint·문서·PRE_QA 확정은 아래에 기록한다. 원격 CI/인간 QA_FINAL/Owner·Manager ACCEPT는 NOT TESTED다.


## 최종 문서·계획 검사와 게시 인계

[최종 로컬 영수증](../../../output/playwright/issue-799/local-validation.json)은 생성 파일 복구 뒤 typecheck PASS·선택 ESLint9파일 PASS·Unit22·Chromium7·표준30쌍/독립raw5 동등성을 기록한다. 보조6의 PARTIAL과 readonly2를 동일 영수증에서도 구분한다. 실행 가능한 선택 Unit 명령은 다음과 같으며 Chromium의 정확한7개 file:line 인자는 정제 영수증의 `command` 배열에 보존했다.

```bash
npx tsc --noEmit
npx vitest run --config tests/config/vitest.config.ts tests/features/resources/resource-dashboard-model.test.ts tests/features/resources/resource-wbs-dashboard-model.test.ts tests/features/resources/wbs-view-model.test.ts tests/features/resources/wbs-view-transport.test.ts
python3 tests/manual/issue-799-compare.py
```

[Pre-PR dry-run 영수증](../../evidence/issue-799/prepr-plan.json)은 exit0·overall NOT TESTED·선정 BLOCKED·UNKNOWN5·missing0·실행step0·sourceStable=true다. 자동 선정 매핑에 없는 신규 helper와 수동도구4개를 우회하거나 정책을 수정하지 않았다. 실제 검증과 수동 생산자→소비자 매핑은 다음과 같다.

- `tests/e2e/helpers/dashboard-metrics.ts` → 기존 #732~#736 5폭case5개에서 호출·실행했다. 기존 Plan/Assignment/Excel·readonly/응답 역전의2개 인접·음성 case를 더해 최종7PASS다.
- `tests/manual/issue-799-dashboard-metrics.mjs` → 같은 fixture 표준 before/after30쌍·PNG/geometry·KPI5KEEP·동적25 report 비교.
- `tests/manual/issue-799-metric-details.mjs` → before6·원래 after4/6 PARTIAL을 기록하며 누락을 PASS로 처리하지 않음.
- `tests/manual/issue-799-read-only-supplement.mjs` → 별도 readonly2 inventory·독립 exact-query5 full raw 동등성·sourceStable·canonical mutation0.
- `tests/manual/issue-799-compare.py` → 위 실제 표준/보조 결과의 값·분모·raw5·source·KPI geometry를 직접 assertion으로 대조해 PASS.

원본 Pre-PR report는 ignored `.prepr-reports/issue799-final-plan/`에 있고, dry-run은 실행/공식 회귀 PASS가 아니다. 보고서의 fingerprint는 그 checkpoint의 working tree이며 이후 추가한 문서/정제 영수증을 포함하는 최종 게시 tree SHA와 구분한다. 검증한 제품·테스트 bytes는 그대로다.

서버·CLI는 종료했으며 생성 AGENTS/next-env/tsconfig와 기존 소비자의 추적 PNG/geometry를 복구했다. 런타임 캐시·DB·로그·raw report·임시 `.cli.js`는 게시하지 않는다. 정제 영수증과 #799 증거만 최종 QA/선별 대상으로 삼는다. 최종 독립 PRE_QA 결과·Ready PR Head/base/test merge와 Full run/attempt 등록은 검토 뒤 Issue STATUS에 기록한다. CI 완료 모니터링·병합/Main/GHCR/릴리스·정리·Issue 종료는 수행하지 않는다.


최종 Manager 로컬 구조 검사: `npm run version:check` PASS(0.133.1), `node scripts/check-markdown-links.mjs` PASS(328개 Markdown), `git diff --check` PASS, 기본 main validator의 `docs_gate`는 DOC_SYNC STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING/AC1~AC6 MAPPING_PASS_SEMANTIC_REVIEW_PENDING, risk_floor HIGH다. 당시 후보256파일·임시 CLI파일0·생성 설정 diff0이며 구조 검사와 의미 검토는 별개다. 최종 문서의 의미 검토는 별도 qa_docs PRE_QA 결과를 따른다.


## 독립 PRE_QA와 최종 동결

실제 분리된 `qa_docs /root/metrics_qa`가 현재256파일 후보를 독립 검토해 PRE_QA PASS·미해결 지적0을 반환했다. 제품/테스트7개 지문·Unit22·Chromium7 원본/정제 결과·표준30쌍/동적25 report·exact raw5·독립 readonly/DOM stress·문서/상태 한정·선별256파일과 민감정보 패턴105텍스트파일을 확인했다. 최종 CSS 지문은 위와 같다. KPI의 WBS report가 없는 범위를 분리하도록 한 문서 지적1건은 수정 후 재확인했다.

이 결과는 게시 전 Agent 사전 검토이며 AGENT 보호경로의 실제 별도 인간 QA_FINAL 승인 영수증·Owner HIGH 위험 수용/Manager ACCEPT가 아니다. 해당 최종 승인은 NOT TESTED이고 MERGE_READY=BLOCKED다. Manager는 같은 검증 source/tree의 원격 게시·Ready PR Full CI 시작 인계만 승인하며 병합·정식 릴리스 권한은 부여하지 않는다. 실제 PR Head/base/test merge와 Full run/attempt·시작 상태는 Issue STATUS에 기록한다.
