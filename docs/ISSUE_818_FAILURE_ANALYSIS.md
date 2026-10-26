# Issue #818 — 활성 진행률 핸들 누적 실패 원장

## 원본 및 범위

기준 main `596dd70db8b242f450ab555ed2bcf049a0c14564` / SVAR Core2.7.3 / app0.135.2. [Issue #818](https://github.com/planner77/masterGantt/issues/818)은 [#816 원장 F816-006](ISSUE_816_FAILURE_ANALYSIS.md)의 PRODUCT/AC4 FAIL을 승계한다. 과거 PR817/CI 성공은 raw pointer 오대상 해결 증거가 아니다. 기존 실패 이력은 수정하지 않는다.

## F818-001 — 원본 활성 marker 오대상 (PRODUCT / P1)

- 원본: Summary(ID `00000000-0000-4000-8000-000000000001`) hover → Week child(ID `00000000-0000-4000-8000-000000000002`) 중심 raw 우클릭 → Edit. 기대 `Existing summary child`, 실제 `Stable summary`.
- 원래 조건: 1440×1000/fine/34px/Week, start/end2026-01-05·duration1·progress0. 원본 rect x578/y391/w10/h27·중심583/404.5. locator 자동스크롤 PASS와 별개다.
- #818 실제 RED: 원본 CSS에서 기존 fine case를 raw mouse 우클릭으로 확장한 warm 실행 **15.2s FAIL**, 기대 `Existing summary child` / 실제 `Stable summary`. `/tmp/issue818-red-warm.log`. 최초 cold dev 실행은 navigation 준비비용으로 원래30초 timeout에 도달했으며 아래 환경 기록과 구분한다.
- 초기 GREEN 통제: `.project-gantt-widget .wx-bar { isolation: isolate }` 한 규칙 적용 후 같은 raw pointer case **14.4s PASS** (`/tmp/issue818-green-initial.log`). 위치/크기·top80%·native26px·progress 로직은 바꾸지 않는다. 이 한 사례 성공은 최종 전체 회귀/원격 QA PASS가 아니다.
- 가설 순위: (1) 전역 marker z-index3가 sibling 위로 탈출한다면 bar별 stacking isolation만으로 wrong-target 소멸, (2) 행 정렬 오류라면 동일 ID 중심 ±1px 초과, (3) hover 해제 문제라면 raw 이동 뒤 :hover/visible·hit 관측이 달라져야 한다. 설치 CSS와 실제 RED/GREEN은 (1)을 지지하며 최종 geometry/조작으로 (2)/(3)을 교차 확인한다.
- 기각 이력: native26px 중앙 배치는 좁은 자기 bar body 이동을 progress drag로 가로채므로 사용하지 않는다. inactive visibility 교정은 보존한다.

## F818-002 — isolation 단독 후보의 drag 숫자 가림 (PRODUCT / 후보 회귀)

- 초기 isolation-only 후보는 raw target matrix8을 통과했지만, native Summary 상단 marker grab 후 진행 중 숫자 중앙의 실제 적중이 `activeLabelHit=false`로 **5.8s FAIL** (`/tmp/issue818-grab-first.log`). marker를 잡아 native drag로 진입한 사실과 숫자 feedback 가림을 구분한다.
- 원인: marker 위치/크기는 유지되지만 부모 stacking isolation 때문에 아래 sibling body가 marker 하단 숫자를 덮는다. 기존 #816 기각 중앙배치와 별개의 후보 회귀다.
- 보완: `.wx-bar:has(> .wx-progress-in-drag)` 부모만 실제 drag 소유 중 z-index3으로 올린다. 평상시/hover의 isolation은 그대로이며 native mouseup으로 class 해제 시 우선순위를 되돌린다. progress listener/state나 pointer-events를 바꾸지 않는다.
- 같은 Summary grab 검사 **13.0s PASS** (`/tmp/issue818-grab-second.log`). 최종 두 규칙 source에서 matrix/native/인접 합집합 재검증이 필요하며 초기 isolation-only PASS를 최종 소스 전체 PASS로 전용하지 않는다.

## F818-LOCAL-001 — cold webpack 준비 timeout (ENVIRONMENT / FAIL)

- `/tmp/issue818-red.log`: 최초 raw 재현 실행이 제품 대상 assertion 도달 전에 cold webpack/navigation 비용으로 원래30초 timeout. 같은 테스트/source warm 실행에서 실제 wrong-target assertion FAIL을 별도로 확보했다.
- timeout/retry/skip·제품 assertion을 완화하지 않는다. 준비 실패와 PRODUCT 재현을 각각 보존하고 반복 실행을 고유 case 수에 더하지 않는다.

## F818-LOCAL-002 — 신규 selected 관측 단언 교정 (TEST_CONTRACT / FAIL)

- `/tmp/issue818-grab-expanded.log`: 신규 Summary 선택 관측이 `wx-selected`를 기대해 **9.1s FAIL**했다. 실제 앱 선택 source는 `data-copy-selected=true`이며 기존 제품 계약/동작을 바꿀 근거가 아니다.
- 조치: 신규 단언만 실제 앱 선택 attribute로 교정한다. 기존 단언·제품·skip/retry/timeout을 바꾸지 않으며 최종 source에서 focus/selection·link·native 조작을 재검증한다.

## F818-LOCAL-003 — Summary body 즉시 rect 복구 가정 (TEST_CONTRACT / FAIL)

- `/tmp/issue818-grab-expanded2.log`: 신규 Summary body raw drag+68 뒤 DOM x578→646이 남아 즉시 rect 원복 기대가 **9.2s FAIL**했다. 기존 Summary 일정 PATCH 금지와 Core 로컬 미리보기 상태를 같은 계약으로 가정한 신규 단언이다.
- baseline 비교는 같은 앱 후보에서 두 추가 규칙만 `isolation:auto`/drag z-index auto로 비활성화한 CSS 통제이며, 별도 main checkout의 전체 before/after 수용 검증은 아니다.
- 같은 seed/raw 경로의 baseline 통제(`isolation:auto`, drag 부모 z-index auto)와 후보를 비교했다. 둘 모두 Summary x578→646(+68), y384.5→357(native reveal), width10 유지, PATCH0·canonical 날짜/진척 불변으로 **완전히 동일**했다. 통제2건 각3.6s는 `/tmp/issue818-body-control.log`에 보존하며 제품 회귀 고유 PASS 수로 합산하지 않는다.
- 조치: 신규 body/resize 검사는 progress로 오인되지 않는 native 분기·canonical 저장0·이웃 불변과 baseline 보존으로 정확히 한정한다. 기존 원래 단언은 유지하고 Summary progress drag의 실제 canonical 복구 단언도 유지한다.
- **경계:** 기존 Summary 일정 미리보기↔canonical 표시 불일치를 이번 CSS가 만든 결함이나 해결한 기능으로 주장하지 않는다. Summary 직접 일정 저장 기능·기존 미리보기 정합성 개선은 본 P1 포인터 교정 범위 밖이며 Owner의 전체 UX 수용과 별도다.

## F818-LOCAL-004 — Summary resize 미지원 계약의 신규 가정 (TEST_CONTRACT / FAIL)

- `/tmp/issue818-body-resize-control.log`의 baseline/후보2개 통제는 Summary 오른쪽 edge를 resize로 가정한 새 width+68 단언에서 **2 FAIL**했다. body-control2 PASS와 다른 검사이며 숨기거나 제품 회귀 PASS로 합산하지 않는다.
- 설치 Core2.7.3 `Bars.jsx/getMoveMode`는 Summary/Milestone에서 즉시 빈 move mode를 반환하고 down 경로의 fallback은 move다. Summary의 right edge는 resize를 지원하지 않는다.
- Day baseline/후보 모두 x546→614(+68), width36 불변, PATCH0으로 동일했다. 따라서 기존 Core/제품을 바꾸지 않고 신규 검사를 Summary body/right-edge move 분기·progress 오인 없음·저장0으로 교정한다. 실제 resize는 leaf Task HTTP/SQLite case에서 판정한다.
- 교정 통제 `/tmp/issue818-summary-controls-final.log`에서는 baseline/후보의 body 및 right-edge x+68·width 불변·PATCH0을 각각 **8.6s/8.5s PASS**로 확인했다. 이 통제는 최종 제품 case 수에 합산하지 않는다.
- 원본 CSS SHA256 `1fc822361ef160028987c1cdd2d10c34b153e561d47fd04b8293535d8b48a59e`, 후보 `e4d692ac850bcc6dfdbdc0a923298b1178ffc093455cad34197389c3486af745`; 임시 통제 probe SHA256 `e2034bc41626c4822eac9815ebfa202e1b5b70f8142562871531d1717cbd6752`. 임시 probe는 최종 source에서 제거하고 /tmp 증거만 보존한다.
- Summary 직접 일정 편집/resize 지원을 새로 구현하거나 지원 PASS로 보고하지 않는다. 기존 native 동작 보존과 새 요구의 해석을 Work Packet에 명시한다.

## F818-INFRA-001 — Git CLI push 인증 불가 (ENVIRONMENT / BLOCKED)

- infra가 `git push --dry-run`으로 원격 write 없이 확인: exit128, Invalid username or token. 원격 #818 branch/PR 없음, repository connector push 권한 있음.
- 조치: 구현·검증·문서·사전검토가 끝난 뒤 연결 GitHub blob/tree/commit/ref API로 fast-forward/새 branch 게시. 검증된 local tree와 원격 tree/head 일치를 확인하며 credential/Secret을 파일·댓글에 기록하지 않는다.
- 제품/CI 실패 아님. 게시 전 자동 CI 성공/승인으로 취급하지 않는다.

## 게이트

- `risk_level=HIGH`, `qa_method=AGENT`, `qa_required=true`; local source 및 별도 qa_docs 사전검토와 최종 exact-head 독립 인간 QA/Trusted/Owner를 구분한다.
- 새 PR Required Quality/Chromium8/Docker·Trusted/Owner: NOT TESTED. Manager ACCEPT: NOT TESTED; MERGE_READY: BLOCKED.
- `0.135.3` PATCH 후보 / `release_required=true`, `release_authorized=false`. PR CI 시작 뒤 모니터링·병합/Main/GHCR·Release/Finalizer/Issue 종료는 범위 밖이다.

## 최종 동결 source의 Local Fast Feedback (2026-10-27 KST)

- **환경:** Node22.14.0/npm11.10.0, Next16.4.2/React19.3.0/SVAR Core2.7.3, Playwright1.63.0/실제 Chromium153.0.8010.12, Linux6.6.87.2-microsoft-standard-WSL2 x64, DPR1/localeen-US. DesktopChrome 설정 UA는 Windows이지만 실제 platform은 Linux다. 제품 실행은 소유 webpack Next dev `http://127.0.0.1:3128` + 새 `/tmp/issue818-dev.sqlite3`이며 production artifact 검증이 아니다.
- **동결 지문:** `/tmp/issue818-final-source.sha256`의 CSS+2spec를 실행 전후와 별도 qa_docs가 대조해 모두 일치했다. 원본 실패/초기 후보·통제/최종 성공은 서로 합산하지 않는다.

| 최종 파일 | SHA256 |
| --- | --- |
| `src/features/gantt/gantt-scale-toolbar.css` | `e4d692ac850bcc6dfdbdc0a923298b1178ffc093455cad34197389c3486af745` |
| `tests/e2e/project-summary-bar-visual.spec.ts` | `9f11de1235dd79a92e4475241fdb466e73bfe597a179db36822634b47c8660eb` |
| `tests/e2e/project-task-delete-context.spec.ts` | `467366f63189fc58b9d10efee4e1c26926fa1790d910a0b4e36f1e0b28fda93e` |

| 검증 | 실제 명령/조건 | 결과/근거 |
| --- | --- | --- |
| Summary13 + Hover6 + Projection13 | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3128 npm run test:e2e -- tests/e2e/project-summary-bar-visual.spec.ts tests/e2e/project-task-hover-tooltip.spec.ts tests/e2e/projection-row-alignment.spec.ts --project=chromium --workers=1 --retries=0 --max-failures=0` (고유 /tmp output, JSON/list reporter) | **32 PASS/0 FAIL/0 SKIP**,284961.777ms(4.7m); `/tmp/issue818-final-union.log`, `.json` |
| 실제 HTTP/SQLite 삭제 normal + leaf native 조작 | 같은 실행 옵션의 `tests/e2e/project-task-delete-context.spec.ts`, normal/native 두 사례만 `--grep` 선정 | **2 PASS/0 FAIL/0 SKIP**,58117.778ms; normal25.1s/native31.8s, `/tmp/issue818-final-native.log`, `.json` |
| 고유 합계 | 같은 최종 CSS/test source, 위 두 실행 | **34 PASS**, 반복/통제/초기 실행은 합산하지 않음 |

- matrix8은34/44px×Day/Week×normal/fullscreen이며 각 edit progress0/50/100 및 readonly(progress100)에서 두 인접 원본 관계를 검사했다. [정제 DOM 영수증](evidence/issue-818/local-dom-receipts.json)의 **64 raw target/Editor 표본 모두 정확**, 중심오차 최대0.5px로 strict±1px 유지. nested Summary→leaf·empty Summary bar0·revision/write0·동일 root 및 fullscreen 실제 진입/해제 검사 포함.
- 기존 fine inactive case는 원본 fixture의 **일반 leaf Existing summary child** raw 우클릭을 검증했다. [정제 스크린샷](evidence/issue-818/correct-child-editor.png)은 nested matrix에서 **Summary로 전환한 동명 child의 정확한 Editor**가 열린 장면이다. 화면만으로 원본 leaf 전체 동작·숫자/Tooltip 가독성 PASS를 주장하지 않는다. PNG SHA256 `9ff9b80b6a33d591c77225e42b79f87a2c572c3ac10ec016ed1b93015ee55f59`.
- Summary native progress0/50/100은 upper tip 실제 hit→native drag class→진행 중 숫자의 인접 bar 가림 없음→mouseup canonical 복구·write0, selected/focus·양 link 실제 hit를 검사했다. Summary body/right-edge move는 원본과 같은 preview 및 저장0으로 한정한다. leaf는 body0/50/100·resize와 progress0→20/50→70/100→80의 실제 progress-only PATCH, 날짜/기간·이웃 불변·revision을 검사했다.
- 사용한 소유3128 서버는 종료하고 Next가 생성한 AGENTS.md/next-env.d.ts/tsconfig.json은 baseline bytes로 복원했다. dev 출력은 `/tmp/issue818-next-dev-output`에 보존한다. 운영 DB/서비스·인증정보는 사용하거나 커밋하지 않았다.
- **위 직접34 실행 당시 미실행**(후속 자동 targeted94에서 delete8 등은 검사, 아래 참조): 전체 delete8 중 나머지6·별도 selection/keyboard/vertical-DnD/empty-summary 전수·production build/runtime·로컬 Docker·실제 터치기기/native125%·screen reader·별도 main 전체 before/after. 기존 full E2E와 환경별 gate를 유지하며 이 로컬34로 대체하지 않는다.

## F818-LOCAL-005 — Pre-PR 생성물의 sourceStable 차단 (ENVIRONMENT / BLOCKED)

직접34 선별 검사 후 같은 제품/test3파일 source에서 두 자동 CLI를 순차 실행했다. 영향 선정은 **READY/17files(6unit+11E2E)/UNKNOWN0/missing0**다. 모든 실행 step은 PASS이나 Next가 추적 설정을 생성 변경해 두 전체 보고서는 **BLOCKED/exit1/sourceStable=false**다. 개별 성공으로 최상위 BLOCKED를 덮거나 fingerprint 검사를 완화하지 않는다.

| 모드/실제 명령 | 실행 결과 | 원본 report/지문 |
| --- | --- | --- |
| `npm run verify:prepr -- --mode=fast --base=origin/main --issue=818 --risk=HIGH` | 버전·테스트발견·MD링크·CI cache·로컬QA fixture·의존성·typecheck·lint·전체Unit·production build **10/10 step PASS**. Unit3344 PASS/기존3SKIP(280files PASS/1file SKIP), build/runtime-tools compile PASS. 최상위 BLOCKED | `.prepr-reports/2026-10-26T20-32-25.424Z-3397391-90ebb3a6/{report.json,SUMMARY.md}`; start `03e630ca2c08d608867e1e85f845e0352fa86f6b6516d188f060cfee6c07d881` → end `5a0596288e5a0ada3681dd3af17e0499d360e28e51577c27c22c0ce24b181efc` |
| `npm run verify:prepr -- --mode=targeted --base=origin/main --issue=818 --risk=HIGH` | selectedUnit **85 PASS**, Chromium **94 PASS/0FAIL/0SKIP**(표시14.7m, E2E step837774ms). 최상위 BLOCKED | `.prepr-reports/2026-10-26T20-36-07.702Z-3413562-2ca8acb8/{report.json,SUMMARY.md}`; 같은 start → end `6daea5c7c6de3a58424d9e942a83c9a8d43ced3bd139e3fccd474d0477f8963a` |

- fast는 next-env.d.ts/tsconfig.json에 `.next-prepr` 경로를 추가했다. 생성물을 `/tmp/issue818-prepr-fast-generated`에 보존하고 원본 bytes로 복원한 뒤 targeted를 시작했다. targeted는 AGENTS.md의 Next 생성 heading(`#`→`##`), next-env.d.ts의 isolated dist 타입 경로, tsconfig.json의 isolated include를 생성 변경했다. 생성물은 `/tmp/issue818-prepr-targeted-generated`에 보존 후 세 파일을 baseline bytes로 복원했다. 테스트가 생성한 자체 output은 `/tmp/issue818-final-generated-output`으로 보존했다.
- 최종 CSS+2spec의 세 SHA256은 **모든 실행 전후 일치**한다. 정제한 [실행 요약](evidence/issue-818/local-validation.json)은 실제 command/step/selection·원본 두 지문·BLOCKED와 성공을 함께 보존하며 raw trace/HTML/cookie/실제 DB는 커밋하지 않는다.
- 추가94는 기존 SC-05 response/recovery·markerOFF·responsive toolbar·fullscreen/editor/relation·scale/instance/add/notification·Summary13·delete8 전체·projection13·viewport/wheel을 검사했다. 이전 직접34/전체Unit3344/선정Unit85와 중복이 있으므로 총128 E2E/총3429 Unit처럼 합산하지 않는다. 이전 직접34 절의 delete8 나머지6 및 production build 미실행은 이 후속 실행으로 해소되었고, production **runtime/container artifact**·전체 원격8-shard·별도 selection/verticalDnD 전수·실제기기/native125%/screen reader는 여전히 NOT TESTED다.
- [Issue EXCEPTION 기록](https://github.com/planner77/masterGantt/issues/818#issuecomment-6426960512)에서 fast BLOCKED를 먼저 공개했다. 원본 실패와 새 source 결과를 소급 재분류하지 않는다.

## 사전검토·문서·게시 인계

- 실제 역할: root Manager=범위/문서·원장/버전·통합, frontend=CSS/기존 E2E·실제 실행, ui_ux=설계 read-only·DeltaC, `/root/qa_818` qa_docs=분리된 source/hash·원본/최종JSON·문서·스크린샷 사전검토, infra=원격 운영. qa_docs 사전검토 **PASS**이며 인간 APPROVED·QA_FINAL/Owner ACCEPT가 아니다.
- DOCUMENTATION_SYNC: #818 Packet/원장·정제 DOM/실행 요약/Editor PNG·#816 원장 후속 링크·PROJECT_UX/TEST_PLAN/CHANGELOG/activePLAN·package/lock0.135.3 UPDATED. 나머지 계약별 N/A 근거는 Packet. 최종 metadata/문서 보강은 제품/test3 SHA를 바꾸지 않는다.
- 원격 게시 전 main/태그/기존PR·미해결 thread/충돌을 재조회한다. 기존 #817은 병합 완료·unresolved0, #818은 착수 시 PR/branch0이다. 새 PR의 정확 Head/tree·base·Full Run/Attempt는 게시 후 PR/Issue STATUS에 기록하며, 결과/Job 모니터링·병합/Main/GHCR·Release/종료는 수행하지 않는다.
- Git CLI 인증 실패는 F818-INFRA-001 그대로 유지하고 연결 GitHub Git object API로 게시하되 local/remote tree가 다르면 중단한다. `AGENT`+package version 보호 경로의 최종 독립 인간 QA·Trusted/Owner는 NOT TESTED, manager_decision=NOT TESTED/MERGE_READY=BLOCKED. 정식0.135.3 릴리스는 미승인이다.
