# Issue #819 — 누적 실패·교정 원장

## 범위와 출처

[Issue #819](https://github.com/planner77/masterGantt/issues/819) / [Work Packet](exec-plans/active/ISSUE_819.md). 초기 baseline은 main `596dd70db8b242f450ab555ed2bcf049a0c14564`, 앱0.135.2이며 초기 후보는0.135.3이었다. 재개 시 main49502785가0.135.3을 사용하여 새 후보는0.135.4이며 기존exact0.135.3 게시 승인을 재사용하지 않는다. 새 PR/원격 CI를 열기 전 로컬 실패부터 누적한다. 과거 #807/#809 CI 실패는 각각의 기존 원장에 보존하며 새 #819 Run으로 중복 집계하지 않는다. 직접 실패·파생·준비 오류·취소·미실행과 통제/최종 실행을 구분한다.

## F819-LOCAL-001 — 신규 중앙 정렬 측정에서 glyph ink와 line box 혼합

- 원본 명령: `npm run test:e2e -- tests/e2e/issue-736-resource-dashboard.spec.ts --grep '#807 단일' --project=chromium --workers=1 --retries=0 --max-failures=0 --output=/tmp/issue819-peer-results --reporter=list`.
- `/tmp/issue819-peer.log`: 1 FAIL,10.1s. 기본 현황 버튼의 DOM Range glyph 중심 offset 실제1.5px, 신규 기대≤1px. 기존 row/control top·bottom≤1px 계약과 글꼴 glyph의 실제 잉크 위치를 같은 것으로 취급했다. 이 원본 실행은 PASS로 바꾸지 않는다.
- 분류: 신규 geometry 검사 정의의 `TEST_CONTRACT` 교정과 navigation 내용 정렬 개선. Glyph offset은 계속 수집하되 대칭 line-box inset과 control 높이36±1·same-row top/bottom≤1·겹침0을 직접 검증한다. navigation은 inline-flex center로 명시 정렬한다. 기존 기능·오류/권한·timeout/retry/skip·Required3/8shard는 변경하지 않는다.
- 최종 source production rebuild 및 동일 기존 peer 시나리오/6peer5폭 재실행 전은 NOT TESTED다. 실제 최종 결과·source fingerprint는 이어서 추가한다. 임시 trace/DB/쿠키·원시 민감로그는 Git에 넣지 않는다.

## F819-LOCAL-002 — native select computed line-height 측정 계약

- 같은 #807 peer 명령의 `/tmp/issue819-peer-final.log`: 1 FAIL,8.2s. `Milestone` native select의 신규 line-height 기대20px / 실제 `normal`이었다. 초기에는 host 상속 누락 가설을 세웠으나 frontend가 native appearance 상태에서 CSS20px 및 inline `style.lineHeight="20px"` 통제를 각각 적용해도 computed `normal`이 유지됨을 확인했다. 실제 높이36px/font13px는 정확했다.
- 분류는 `TEST_CONTRACT`다. native picker/appearance를 바꾸지 않고 select만 computed line-height 예외로 명시하며 실제 높이/font·행 정렬/겹침 검증은 유지한다. button/text input20px 기대는 그대로다. 검증 selector가 native control 동작과 다른 것을 강제하지 않게 한다. 별도 qa_docs도 앱/서버를 바꾸지 않은 headless Chromium153.0.8010.12 통제를 직접 실행했다: stylesheet13px/20px+height36의 native SELECT는 inline20px 여부와 무관하게 computed normal/font13/height36, appearance:none SELECT 및 INPUT/BUTTON은20px였다. 따라서 초기 제품 drift 가설은 반증됐으며 native picker를 보존하는 SELECT-only 예외를 수용했다.
- 첫 glyph 측정과 다른 원본 실패이며 이 실행을 소급 PASS하지 않는다. 최종 source 재실행 결과와 통제 근거를 이어서 추가한다.

## 현재 원격 경계

새 exact Head PR quality/e2e/docker·Trusted/Manager, main/GHCR/Release/Finalizer는 NOT TESTED다. 이번 요청은 PR CI 시작 snapshot까지만 수행하며 모니터링·병합·Main/GHCR·정식 게시·Finalizer/Issue 종료는 수행하지 않는다. 추후 원격 Gate 실패가 확인되면 같은 원장에 Run ID/Attempt·Head/base/test merge·Job/Step·직접/파생/취소/미실행과 교정·동결 결과를 추가한다. 로컬 PASS는 공식 전체 CI PASS가 아니다.

## F819-LOCAL-003 — 중첩 Resource Plan 제어의 strict selector 실패

- 원본 `/tmp/issue819-peer-frozen.log`: 기존 #807 단일 peer 시나리오1 FAIL,13.6s. `report.locator('.resource-dashboard-view-controls')`가 estimate의 빈 최상위 제어와 nested Plan 제어2개에 일치해 `toBeHidden` strict mode 위반이었다.
- 분류: `TEST_SELECTOR`. 실제 최상위 영역만 `:scope > .resource-dashboard-view-controls`로 지정하고 nested Plan의 제어/기능·기존 assertion을 보존했다. 동일 최종 시나리오 `/tmp/issue819-peer-verified.log`에서1 PASS,27.8s(test) /30.4s(total).
- 원본001/002/003은 각각 별도 실패로 유지한다. [원본 실행 로그](../output/playwright/issue-819/verification/F819-LOCAL-003.txt)와 [최종 PASS](../output/playwright/issue-819/verification/peer-verified.txt), 제품8/spec2 지문은 [manifest](../output/playwright/issue-819/verification/manifest.json)에 보존했다. 새 exact-head 원격 CI 결과가 아니다.

## F819-PREP-001 — 회귀 실행이 역사적 tracked capture 갱신

- 재개 시 `output/playwright/issue-719/after/resource-{390,768,1024,1440,1920}.{json,png}`와 `resource-help-*.png`15파일이 현재 #819 실행으로 변경돼 있었다. 제품 실패가 아니라 `EVIDENCE_PROVENANCE` 준비 오류다.
- 현재 결과는 #819의 `help-regression`에 별도로 복사했고 #719 tracked 원본은 Git baseline byte로 복구했다. 기존 #525/#736 새 출력 및 중간 `after-default`는 `/tmp/issue819-resumed-artifact-backup`에 보존했다. 기존 역사 증거를 새 성공으로 덮어쓰지 않는다.

## F819-PREP-002 — 로컬 Git write 인증 불가

- 2026-10-27 infra의 `git push --dry-run origin HEAD:refs/heads/fix/issue-819-resource-ui-consistency`가 exit128 / `Invalid username or token`으로 실패했다. `gh auth status`도 기존 인증 invalid였다. 원격 Ref mutation은 없었다.
- 분류: `ENVIRONMENT/AUTH`, local Git 방식A는 BLOCKED다. 인증정보를 추출하거나 새 토큰을 만들지 않고 기존 연결 GitHub 도구의 Git Data API 방식B로 전체 blob/tree/parent 검증 후 신규 Ref1회 게시를 준비한다. 실제 Ref/PR/CI 생성 전은 NOT TESTED다. 인증 오류를 제품/CI FAIL로 세지 않는다.

## F819-INTEGRATION-001 — main #818 문서 충돌과 버전 충돌

- 원래 변경78718cc5를 보존한 뒤 main `495027854c2ab73f7f91d0b6205c86397cff4497` 통합 시 CHANGELOG/PROJECT_UX/TEST_PLAN/PLAN4개가 content conflict였다. 분류: `INTEGRATION`, 실행 CI 실패는 아니다.
- 양쪽 Issue 내용을 순서대로 보존해 merge commit `1a03c4391491a02597b741fe0b467c5d2fce81da`로 해결했다. #818 제품/Gantt 변경은 유지하고 제품8/spec2의 기존 동결 SHA256 모두OK다. main과 #819의0.135.3 충돌을 새 PATCH0.135.4로 해소했으며 manifest/lock 일치 확인.
- 기존0.135.3 Owner 게시 marker를0.135.4로 확대하지 않는다. `release_required=true`, `release_authorized=false`; 이번 PR CI 시작 범위에는 게시 승인이 필요하지 않다. 기존 새 작업용 임시 local branch는 게시하지 않고 원래 #819 branch를 재사용한다.

## F819-PREP-003 — 문서 링크 검사 script 이름 오기

- 통합 후 version/typecheck는 exit0이었으나 뒤의 `node scripts/verify-markdown-links.mjs`는 존재하지 않는 경로여서 `MODULE_NOT_FOUND`로 실패했다. 분류: `COMMAND_SETUP`.
- 실제 `scripts/check-markdown-links.mjs`를 찾아 재실행하여 Markdown354파일 링크 검증 PASS. 검사 생략이나 gate 약화가 아니며 원본 명령 실패는 보존한다.

## 재개 검증·리뷰 및 실행 경계

- 기존 로그 감사에서 제품/test 실행 실패는001~003 총3건이며 기타 build/migrate 준비 실패·취소는 발견하지 못했다. 기존11 E2E PASS + 임시 기본상태 capture1 PASS, Unit46/6files·build/typecheck/lint PASS를 제품8/spec2 동일 지문에 한해 Local Fast Feedback으로 재사용한다. 임시 capture를 제품 회귀12건이라고 세지 않는다.
- 새 main/package0.135.4 통합 후 `npm run version:check`, `npm run typecheck`, `node scripts/check-markdown-links.mjs` PASS. `verify:prepr --mode=targeted --base=origin/main --issue=819 --risk=HIGH --dry-run`은 selection READY15/UNKNOWN0/missing0/sourceStable=true, 실행판정 NOT TESTED다. 해당 dry-run을 실제 테스트 PASS로 쓰지 않는다. 전체 local 회귀/build는 관련 source byte 불변이므로 반복하지 않으며 새main 통합의 전체 검증은 원격 Full에 맡긴다.
- 기본상태12장면(before/default-final)과 필터/advanced가 유지된after30행을 구분한다. 새 도움말3종 전체를 직접 touch/Escape로 각각 검증한 것은 아니며 기존 #719 공통 컴포넌트5폭 keyboard/Escape/복귀 범위와 source 검토를 유지한다. native zoom125%·실기기·screen reader·Windows Excel/DRM·운영proxy는 NOT TESTED다.
- 실제 별도 `/root/resource_design_review`·`/root/resource_qa_review` read-only 사전검토에서 차단 제품 결함 없음. 이는 `OWNER_MANAGED` 최종 독립 QA/Trusted/Owner 승인이나 새 exact-head Required3 PASS가 아니다.
- 원격 인증 검색에서 기존 #819 PR/branch는0개여서 기존 review thread 처리 N/A. 새 PR 생성 시 thread0과 conflict 여부를 다시 조회하고 CI 시작 Run/Attempt/Head/Base/test merge snapshot만 인계한다. 원격 작업 완료를 기다리지 않는다. `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`.

## F819-PREP-004 — API 게시 직전 관측 JSON 작성 오류

- infra가97개 blob SHA와 전체 tree `0461a08feb93ef0c94d7833be6376fb7d2c2fdee`의 로컬 동등을 확인하고 미참조 candidate `b0aafd1c5f47b8bb0ceb9cb5955e2e1126f72f3e`(parent main49502785)을 준비했다. 이 시점 원격 Ref/PR 게시는0회였다.
- `/tmp` 관측 JSON 생성용 Python helper에 JSON `null`을 Python literal로 넣어 `NameError`가 발생했고, 뒤따른 batch verify가 `JSON_INPUT` BLOCKED(exit1)로 중단됐다. 분류: `COMMAND_SETUP`, 제품/인증/출처 오류나 CI FAIL은 아니다. 잘못된 파일은 생성되지 않았으며 인증 API 관측 원본은 도구 store에 보존했다.
- JSON을 `json.loads`로 파싱하도록 명령을 교정한다. 본 원장 갱신 후 새 local Head/tree·manifest로 문서 blob만 다시 준비하고 기존 나머지 blob을 재사용한다. 최신 main/branch부재·before/after·전체tree 검증을 생략하지 않는다. 원격 Ref 이전 오류여서 기존 CI 실패/취소는 생성되지 않았다.
