# Issue #454 관리자 화면 개선 실행 계획

## Issue Work Packet

- Repository: planner77/masterGantt; Issue [#454](https://github.com/planner77/masterGantt/issues/454).
- Phase: DOCUMENTATION_SYNC. 요청 종료점은 구현·문서 동기화·독립 사전 검토·원격 branch/PR 및 exact head pull_request / ci.yml 등록이다. CI 결과 모니터링은 수행하지 않는다.
- Baseline: `c411634f75b7a69131a095e9cb6b7416060b827e` (선행 #453 PR #477 / CI run `37406441919` 등록), 선행 후보 version `0.90.0`. 작업 branch `fix/issue-454-logistics-table-density`, 후보 PATCH `0.90.1`. 선행 PR 등록 후 누적 후보에서 분기하며 최신 main의 독립 변경 보존 여부를 확인한다.
- release_required=true, release_authorized=false. 병합·main CI/GHCR·tag·정식 release·branch cleanup·Issue 종료는 이번 요청 범위 밖이다. quality/e2e/docker·공식 최종 QA/ACCEPT는 NOT TESTED다.

## 목표·인수 기준

설비·시스템 유형 native 목록의 열 예산·사용 건수 정렬·행 밀도와 이름/비밀번호 dialog action 정렬을 정돈한다. #330 필터/생성, 세션/Origin/strong If-Match/revision, code identity/usage 및 기존 프로젝트 참조는 유지한다. #452 이후 실제 before를 확보하며 과거 분리 CSS 실험값을 앱 baseline으로 사용하지 않는다. 최신 main `56e2e54f88ab9124ec81c52e157161181ed6c337` / `0.86.0`은 선행 후보에 포함되어 있고 준비 시 그대로였다.

- [ ] 설비/시스템 유형 양쪽에서 단일행 fixture의 실제 row height와 내부 padding/action margin을 기록하고 불필요한 24px 공간이 없다.
- [ ] 최장 상태/action label과 긴 한글/영문 표시명·코드에서 column/header/body가 침범하지 않는다.
- [ ] 같은 행 control top/height 차이가 1 CSS px 이내이고 wrap 시 별도 배치 계약을 따른다.
- [ ] 정상/0건/필터결과0/로딩/오류/saving/401/412에서 메시지와 복구 경로가 명확하다.
- [ ] 실제 추가/이름 수정/활성·비활성/필터/비밀번호 변경이 정상 동작한다.
- [ ] 390/768/1024/1440/1920px에서 document overflow는 없고 허용된 내부 scroll로 모든 행 action에 접근한다.
- [ ] 변경 전·후 동일 dataset/viewport screenshot + geometry assertion, keyboard/focus 검증을 포함한다.
- [ ] 관련 문서와 exact PR head CI 증거를 제출한다.

## 소유권·단계·문서

- Manager: 이 Packet·PLAN.md·CHANGELOG.md, 버전/단계/승인, 공식 Issue 댓글(PLAN/STATUS/EXCEPTION).
- ui_ux stage_editor_design: read-only 설계·구현 비교. frontend stage_editor_impl: src/features/logistics/logistics-type-catalog-admin.tsx, logistics-type-catalog-admin.module.css, 전용 관련 E2E/fixture, PROJECT_UX.md, TEST_PLAN.md; production/test/fixture는 전용 범위만 수정하고 shared/global CSS/API/DB/auth/domain 변경은 제외한다.
- infra stage_dashboard_unit_tests: 승인된 branch/version 준비·allowlist commit·게시·PR·CI 등록. read-only 독립 QA stage_exchange_domain_review는 구현자와 분리한다. 실제 기존 실행자에 책임을 재배정하며 새 역할 모델 runtime을 실행했다고 주장하지 않는다.
- 여러 Agent가 같은 파일을 수정하지 않는다. 다른 작성자·원래 #464 branch/raw26·제외 자료를 보존한다. issue_comment_writer=manager; Sub-Agent는 remote 댓글 없이 Result Contract로 반환한다.
- DESIGN.md/UI_UX_GUIDELINES/PROJECT_UX/Next 설치 버전 guide를 따른다. 글로벌 관리자 native table이며 SVAR 내부 재구현이나 새 공통 framework는 필요하지 않다.
- 최초 실제 before와 동일 fixture/viewport after를 390/768/1024/1440/1920px로 검증한다. 실제 row/control top·height·padding·column/header alignment·document/table overflow와 keyboard/focus를 기록한다. 강제 row 높이로 긴 내용이나 control을 자르지 않는다. 기존 소스 검토·분리 CSS 실험을 실제 before로 사용하지 않는다.
- 100% 실제 browser 필수. native125% 가능하면 실행하고 불가 사유와 NOT TESTED를 기록한다. DSF/CSS zoom/viewport로 대체하지 않는다. mock browser와 실제 서버 authorization/운영 검증은 구분한다.
- source/fixture 수정 전 owned Next를 종료하고 generated next-env/tsconfig를 복원한다. freeze 후 관련 최소 LFF만 수행하며 실패/원인/조치/재검증과 재사용 근거를 보존한다. 전체 회귀는 PR CI에 맡긴다.
- Required docs: PROJECT_UX/TEST_PLAN/이 Packet/PLAN/CHANGELOG. 계약 변경 없는 API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/CI_CD/REMOTE_VALIDATION 및 기존 DESIGN 기준 재사용은 N/A 근거로 기록한다.
- DOCUMENTATION_SYNC → 독립 UI/사전 QA → Manager PR_READY → explicit allowlist 게시 → published head/tree/parent/files 독립 동등성 → Refs #454 PR → exact head CI 등록 확인. 등록 사실과 PASS를 혼동하지 않는다.
- 게시 자료는 비밀 제거 PNG/geometry/env explicit allowlist만. 실제 DB/cookie/session/password/raw trace/log/test report는 제외한다.

## 검증·다음 handoff

Branch/version 준비 PASS. 기존 구현 PR 없음(감사 draft #458만 존재), version check PASS, 동일 lock 의존성의 node_modules 실제 디렉터리를 선행 worktree에서 복사했다. source/API/domain 무변경, staged diff0. 독립 설계·실제 before·구현·LFF·검토·게시/등록은 아직 NOT TESTED다. PLAN comment `6008394395`. → read-only 설계 → read-only 설계 → frontend before·구현·관련 LFF·문서 → 독립 검토 순서다.

## 승인 설계

Manager가 read-only ui_ux의 `/tmp/issue454-uiux-design.md`를 승인했다. 초기 최소 table824px는 flexible 표시명 최소240 + 코드160 + 상태88 + 사용 건수104 + 작업232px이며 실제 intrinsic 측정에 따라 조정한다. 사용 건수는 header/body 우측·tabular 정렬, 좁은 폭은 table wrapper만 scroll한다. 기존 공통40px control과 block padding3px로 한 줄 약47px를 목표로 하되 강제 height/clipping으로 맞추지 않는다.

이름/비밀번호 dialog의 동일40px action·8px parent gap·top/height 차이≤1px와 pending 입력/취소 잠금·owned handler guard·반복 Escape/focus 보호의 최소 보강을 승인한다. 공유 dialog/global CSS/API/새 dirty 흐름은 변경하지 않는다. 실제 before/after 두 catalog의 5폭 PNG/geometry 및 dialog의 5폭 geometry·필수 대표 화면·keyboard/state를 확인하며 중복 캡처나 전체 로컬 회귀는 요구하지 않는다. 설계 PASS는 실제 앱 검증 PASS가 아니다.

## 실제 before

- Chromium `75038` / `chea41b0`: before1 PASS(7.1초). 두 catalog·이름/비밀번호 dialog를 5폭에서 캡처한 PNG20/geometry20 확보, source freeze4 drift0, owned Next 종료·generated2 복원/diff0.
- action margin은 이미0이다. 첫 짧은 AGV/agv(시스템 MCS/mcs) 행은 390/768px에서224.96875px,1024px140.96875px,1440/1920px100.96875px였다. 같은 표의 긴 code가 자동 열 배분을 차지하여 짧은 행의 작업 열도 좁아지고 버튼이 세로 배치된 실제 근거다. 긴 값의 행과 구분해 이 짧은 행을 단일행 전후 비교 대상으로 사용하며 과거 분리 CSS77.78px→53.78px를 이번 before로 재사용하지 않는다. 실제 단일행 행의 전후 값은 최종 frontend geometry/TEST_PLAN에 기록한다.

## 오류 복구 설계 보완

frontend가 기존412 처리의 최신 GET 실패/401 원인이 stale 안내로 덮이는 경로를 확인했다. Manager는 성공 GET일 때만 stale 안내를 표시하고 조회 실패·401 안내를 유지하는 owned UI 수정을 승인했다. 열린 이름 dialog의 오류 상태에는 기존 GET을 호출하는 명시 `최신 목록 조회`로 보존한 입력의 수동 복구를 연결한다. 정상 상태의 간단 dialog는 유지하며 API·자동 mutation 재시도·초안 초기화·새 dirty 흐름·공유 primitive는 변경하지 않는다. 복구 action의 keyboard/focus/pending 및 GET401 잠금은 관련 browser 검증 대상이다.

## 키보드 접근성 REWORK

- 첫 after `95915` / `ch17332b`: geometry1 FAIL/13 미실행.768px에서 마지막 row action에 Tab focus가 왔으나 버튼 오른쪽819.890625px가 owner 오른쪽744px 밖이었다.390px table/row 검사는 통과했다.
- 준비 script 경로 결합 오류로 poll 보강 전 동일 case가 `5949` / `ch49c1bb`에서 다시 FAIL한 이력을 보존한다. 수정된5초 poll probe `93072` / `chd2787a`에서도 clipping이 지속되어 단순 스크롤 완료 시점 문제를 배제했다.
- Manager는 owned table wrapper의 focus capture에서 실제 focused row button의 외곽선6px 여유가 owner 내부에 오도록 필요한 가로 offset만 보정하는 제품 접근성 보강을 승인했다. 문서/세로 scroll/공유 primitive/실제 Tab 경로/containment 기준은 유지하며 테스트의 강제 scroll로 접근성 PASS를 대신하지 않는다. owned Next 종료·generated 복원 뒤 source 수정과 관련 재검증을 수행한다.

## REWORK 후 관련 검증

- 제품 focus 보강 후 `55822` / `ch790698`: geometry·추가/이름/활성·두 dialog pending·412/401/network 등11 PASS. 짧은 AGV/MCS 행은 동일5폭에서47px으로 측정했다.
- 빈 목록 case1 FAIL은 GET 응답 뒤 mock catalog만 바꾸어 화면 snapshot이 유지된 harness 설정 순서 오류다. source/fixture 불변·owned Next 종료·generated 복원 뒤 해당 값을 GET 전에 설정하는 test 수정으로 실패1과 미실행 기존2만 이어 검증한다. 앞선11 PASS를 단일 전체 실행 또는 원격 PASS로 보고하지 않는다. 최종 결과/해시는 frontend TEST_PLAN과 Result Contract를 따른다.

- 최종 좁은 재검증 `22413` / `cha4c7c0`:6 PASS(11.1초), 기존 #280/#330 원래 assertion 유지. 앞선11 PASS와 합쳐14 unique/17 PASS 실행을 구분한다. before40 + after35 =75 게시 증거 후보. 짧은 행47px·최소 table824/name240·Tab focus 외곽선6px 접근 및 두 dialog pending5폭 검증 PASS. owned Next 종료·generated2 복원·freeze5 drift0. 관련 최종 type/lint/link/version·문서·manifest는 frontend의 동결 결과를 따른다.

## 최종 fixture 계약 보정

최종 문서 점검에서 긴 설비 code가65자로 승인 설계/API 상한64자보다1자 길었던 fixture 오류를 발견했다. 앞선 동일65자 before/after 비교와 실패 이력은 역사적 stress 결과로 보존한다. Manager는1자 축소 후 baseline source2를 c411 원본 bytes로 임시 복원해 before만 재캡처하고, 검증된 최종 source2를 정확 복원해 after geometry만 재캡처하는 순서를 승인했다. 각 source 수정은 owned Next 종료·generated2 복원 뒤 수행한다. 최종 source2 hash 불변과 유효한64자 동일dataset 비교를 확인하며 숫자의 실제 우측/tabular metric도 JSON에 명시한다. 짧은 code를 대상으로 한 기능·오류·pending 회귀는 영향 분석으로 재사용하고 전체14개를 반복하지 않는다. 최종 측정은 새 frontend 동결 결과를 우선한다.

## 최종 후보

- 유효한64자 동일 fixture 재캡처: before `77830` / `ch20c364`1 PASS(6.6초), after `31896` / `ch48c975`1 PASS(7.4초), 새 실패0. 숫자의 실제 우측/tabular metric PASS. 기존65자 증거75개는 게시하지 않고 별도 raw 이력에 보존한다.
- 최종 source2 백업 byte 일치, owned Next 종료·generated2 복원·freeze5 drift0. typecheck `92350` / `chea0df1`, lint `94261` / `ch410186`, Markdown `ch2f12c8`122파일, version `chd8935b`0.90.1, diff `che0fac8` 모두 PASS. before는 c411의 제품 source2와 준비된 header version0.90.1을 사용하며 application 전체 byte 동등성을 주장하지 않는다.
- 고유 after14개는 유지하고 geometry1회 재검증을 포함한 after PASS 실행은18회(기존17+1)다. 최종 게시 evidence75개와 owned6파일 manifest를 기준으로 독립 UI/사전 QA 후 게시한다. 공식 quality/e2e/docker·최종 QA/ACCEPT는 NOT TESTED다.
