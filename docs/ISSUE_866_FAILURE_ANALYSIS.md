## PR #879 B008 — 전체 이력 대조와 취소 샤드 실제 오류 (2026-11-05 KST)

기준 Head `a7cbef53bd0c89f4f3a7a3c3ed5a76ba7cb2266e`, main/base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`. Manager·별도 infra가 원장 전체와 PR #879의 접근 가능한 CI 10회/각 attempt 1을 대조했다. Full 8회와 metadata 2회이며 #3511은 Full이 아닌 metadata 취소다. 실제 job 이름을 기준으로 세 Required aggregate를 아래 순서에 대응시켰다. [정제 원격 증거](evidence/issue-866/pr879-ci-cumulative-20261105.json).

| Run/Attempt · 모드·원본 결론 | Head / base / test-merge | 직접 Job·증상 | Required quality / e2e / docker Job:결론 |
| --- | --- | --- | --- |
| [#3510.1](https://github.com/planner77/masterGantt/actions/runs/41941093006) · FINAL_FULL · FAILURE | `dfc967258f5fa0cc8e188d116cdccd734f49c771` / `8fca83bbc12cf516cd7f22438fa16c6b596d80fb` / `28d4bb5ece15503393808ecbcc5410168264fe02` | 126961958453: non-main base 정책 BLOCKED; 제품 검증 미실행 | 126962207510:FAILURE / 126962207560:FAILURE / 126962207386:FAILURE |
| [#3511.1](https://github.com/planner77/masterGantt/actions/runs/41942375933) · METADATA_ONLY · CANCELLED | `dfc967258f5fa0cc8e188d116cdccd734f49c771` / `NOT AVAILABLE` / `NOT AVAILABLE` | N/A: METADATA_ONLY CANCELLED; changes job 로그404 BlobNotFound, 상세 취소원인 불명; Required3는 파생FAIL | 126966126464:FAILURE / 126966126616:FAILURE / 126966126553:FAILURE |
| [#3512.1](https://github.com/planner77/masterGantt/actions/runs/41942377243) · METADATA_ONLY · FAILURE | `dfc967258f5fa0cc8e188d116cdccd734f49c771` / `364aa3bdfde16fd3ca79add61c35a1cde21f6395` / `019efd0152987b3886287b5a88ac59c0549f7b24` | 126966322719: METADATA_ONLY FULL_FAILED: full_run41941093006.1 failure, 새 제품 오류 아님 | 126966461402:FAILURE / 126966461558:FAILURE / 126966461459:FAILURE |
| [#3513.1](https://github.com/planner77/masterGantt/actions/runs/41943199412) · FINAL_FULL · FAILURE | `20f106f39f90d838193234c5bb0320977fe4af91` / `364aa3bdfde16fd3ca79add61c35a1cde21f6395` / `1645f96490dc08e09efbe082c38b4de4f84213f4` | 126968984659: DOC_SYNC: docs/IMPORT_SCHEMA.md 기록 누락 | 126969223864:FAILURE / 126969223984:FAILURE / 126969223914:FAILURE |
| [#3514.1](https://github.com/planner77/masterGantt/actions/runs/41946308147) · FINAL_FULL · FAILURE | `420781ac039e75adbc4143525a848c5e6bb2ca68` / `364aa3bdfde16fd3ca79add61c35a1cde21f6395` / `765f10ba4696cad4b269741eb57f563d18fdb94a` | 126979392129: 동일 DOC_SYNC canonical section 누락 재발 | 126979630276:FAILURE / 126979630213:FAILURE / 126979630198:FAILURE |
| [#3515.1](https://github.com/planner77/masterGantt/actions/runs/41947822098) · FINAL_FULL · FAILURE | `7e861e458135f6fe35e88394ed376b152420c688` / `364aa3bdfde16fd3ca79add61c35a1cde21f6395` / `0830598ae1250fbfcdec1686046caa3c86a793fb` | 126984569355, 126984569338: TypeScript10건(TS2554=1/TS2339=8/TS2352=1), Vitest migration 기대3건 | 126985342802:FAILURE / 126985343007:FAILURE / 126985342931:FAILURE |
| [#3516.1](https://github.com/planner77/masterGantt/actions/runs/41956539012) · FINAL_FULL · FAILURE | `7bce2814ee96bdb168ad1e7556792183b4f5f8fd` / `364aa3bdfde16fd3ca79add61c35a1cde21f6395` / `6dabd4bce384bb7c56a45981016824eecdb674dd` | 127012793287: DOC_SYNC: docs/SCHEDULING_ENGINE.md 영향 기록 누락 | 127012998149:FAILURE / 127012998121:FAILURE / 127012998128:FAILURE |
| [#3517.1](https://github.com/planner77/masterGantt/actions/runs/41960950080) · FINAL_FULL · FAILURE | `1dfc5d7f5ec0ee0252773ba3900971ec977a2d90` / `364aa3bdfde16fd3ca79add61c35a1cde21f6395` / `2264f3ae06ae6a3461b7b68b60c01d2ef7f8fca3` | 127027137923: TypeScript TS2339 2건: mixed catalog translations optional field 추론 | 127027853794:FAILURE / 127027853908:FAILURE / 127027853727:FAILURE |
| [#3518.1](https://github.com/planner77/masterGantt/actions/runs/41965727570) · FINAL_FULL · FAILURE | `b8a90a709fa126efbad5bff8dcd1acd45449a50c` / `364aa3bdfde16fd3ca79add61c35a1cde21f6395` / `d7cda7b58a284f3e5b200e6bec2a8d17a703460f` | 127043119334: Shard7 populated row 기대<=48px,실제87px; 나머지7 CANCELLED 로그 추가assertion없음 | 127043898809:SUCCESS / 127044095560:FAILURE / 127044497168:SUCCESS |
| [#3519.1](https://github.com/planner77/masterGantt/actions/runs/41970024640) · FINAL_FULL · FAILURE | `a7cbef53bd0c89f4f3a7a3c3ed5a76ba7cb2266e` / `364aa3bdfde16fd3ca79add61c35a1cde21f6395` / `dbe1ffcb15791c997a974c3bf55479298c8495a0` | 127056885009, 127056885015: Shard3 coarse search 기대>=44px,실제20px; CANCELLED Shard7에서도 번역option 실제FAIL | 127057217560:SUCCESS / 127058207828:FAILURE / 127058288034:SUCCESS |

### 원본 증거 보완·정정

- #3511.1 metadata 취소는 changes 로그가 404 BlobNotFound여서 당시 base/test-merge 및 상세 취소 사유는 NOT AVAILABLE이다. 현재 PR 상태에서 추정하지 않는다. #3512.1 metadata Job `126966322719`의 `FULL_FAILED`는 원본 Full `41941093006.1` FAILURE를 참조한 결과이며 새 제품 오류가 아니다.
- 역사적 B004의 TypeScript 9건 표기는 원본 로그 재대조 결과 **10건**(TS2554=1, TS2339=8, TS2352=1)으로 정정한다. 당시 기록은 보존하고 본 정정을 추가한다. Vitest migration 기대 실패는 기존 기록대로3건이다.
- #3519.1 Shard3 Job `127056885009`, step `E2E shard 실행`, `tests/e2e/logistics-table-density.spec.ts:126`: coarse390의 검색 input 예상>=44px / 실제20px. 28 PASS /1 FAIL /1 기존 SKIP /123 NOT RUN. [원본 report](https://github.com/planner77/masterGantt/actions/runs/41970024640/artifacts/13388873732).
- #3519.1 **CANCELLED Shard7 Job `127056885015`에도 실제 FAIL**이 있다. `tests/e2e/i18n-master-data.spec.ts:91`: `#project-business-unit` option 기대 `Assembly Team (I18N-0)` / 실제 `조립팀 A`, 5000ms. 18 PASS /1 실제 FAIL /60 NOT RUN. 취소로 report artifact는 없고 timing artifact `13388499567`과 원본 job 로그가 남는다. 취소를 오류 없음·PASS로 해석하지 않는다.
- #3519 8샤드 계획874건 = 관측138 PASS /2 실제 FAIL /1 기존 SKIP /733 미완료·미실행이다. Shard3만 job FAILURE이고 나머지7개는 CANCELLED다. Shard7 이외6개 취소 로그에는 별도 assertion FAIL이 없었다. Shard7 `cross-screen-regression`3개는 실제 PASS여서 B007의87px 교정은 해당 원본에서 재검증됐지만 전체 샤드 성공은 아니다.
- #3519 Preflight `127055970142`, Policy `127056066511`, TypeScript `127056066467`, ESLint `127056066469`, Vitest `127056066445`(293 files PASS/1 SKIP,3540 tests PASS/3 SKIP), Build `127056884903`, 실제 Docker `127056885005` SUCCESS. Required E2E `127058207828`와 QA Automated `127058312950` FAILURE는 위 직접 오류의 파생이다. GitCommitInfo3000ms 경고는 직접 assertion 실패와 구별한다.

### 선행 PR #878/#870과 누적 원인 매트릭스

- 추가 branch 전체 목록 조회에서 #878 CI3회(#3507/#3508 FAILURE, #3509 SUCCESS) 및 #870 CI8회(#3468~#3475 모두 FAILURE), 각 attempt1을 확인했다. 원본 #870 원장 마지막 기록 뒤 Full #3475.1 / Run `41728256911`, Head `ca58e987fd68261d9e9db97b4e931651350d6e4a`가 더 있어 해당 실패·취소 로그를 추가 대조한다. 기존 원장의7회 요약을 전체8회 원격 목록으로 정정하며 과거 기록은 보존한다.
- #878 FULL-001/002는 아래 기존 원장의 exact Run/Head·샤드 수/영문 native Grid 헤더 교정 코드를 대조했다. 이번 재작업에서 #878 과거 원본 job 로그를 다시 수집한 것은 아니다. #3509.1 Phase A 성공을 Phase B 성공으로 합산하지 않는다.
- #870의 원본 Head `ca58e987fd68261d9e9db97b4e931651350d6e4a`, 원장 blob `cb698e1d8443f23fa35ce610d63f44e2953cbaa6` 전체391행을 읽고 과거7회 실패 출처와 현재 코드를 비교했다. 과거7회 원격 run 로그 자체는 이번에 재수집하지 않았다. 도움말 중복·행87px·transport locale, country422 정보 손실, HTML entity, coarse20px, translations{} 전송, Milestone 공백, Task logistics raw409·process-context catch는 서로 다른 원인이며 #865/#869 전체 구 트리를 재이식하지 않는다.
- 최신 물류20px는 #870 F866-TOUCH-006 / Full #3471.1 Run `41704268626`, Job `126158915804`의 검색 selector 교정이 Phase B 분리에서 누락된 **재발**이다. 번역 payload helper는 현재 이미 이식되어 있다. 물류 fixture의 translation 생략/해제 범위와 실제 DB/helper Unit 검증을 구별한다.

| 누적 실패/검토 계약 | 현재 보완 및 같은 후보에서 재검증할 소비자 |
| --- | --- |
| #878 FULL-001 shard count / FULL-002 translated native header | shard planner Unit, Phase A i18n/date Unit, project-workspace-layout 및 language-shell |
| #879 B001 main base / B002·B003 canonical DOC_SYNC / B005 Scheduling DOC_SYNC | main 대상·base validator docs_gate로 정규 DOCUMENTATION_SYNC 현재12문서 및 AC01~09 매핑 |
| #879 B004 TS10·migration3 / B006 optional DTO TS2 | 전체 TypeScript·Vitest로 검색/DTO/SQLite·Calendar/Issue·Copy/Template/Export·권한 음성 |
| #879 B007 master row87 / P2 stale draft | cross-screen/i18n-master-data/resource-catalog-delete/logistics-type-catalog-admin |
| #879 B008 coarse search20 / translated option 누락 | searchField40/44, displayName(locale) label+동명 판정; 기존 직접 E2E 및 실제 선택기 렌더 Unit |
| #870 역사적 관리자/공정/물류/Milestone 실패8파일 | 현재 존재 확인 후 관련15spec 한정 진단. production-transport는 기존 원격 Docker 환경에서 별도 검증 |

### 원장 미기록 #870 Full #3475.1 추가 대조

- [Run41728256911.1](https://github.com/planner77/masterGantt/actions/runs/41728256911), Head `ca58e987fd68261d9e9db97b4e931651350d6e4a`, Base `352a43e74c7b34c72d952f67783a53463f8b519d`, test-merge `66b0e01d46cf2037d5dbc11bcb5d9f1b4905c353`(changes Job `126238598081`). [정제 증거](evidence/issue-866/legacy-pr870-run3475-20261105.json), [전체 관련 PR 실행 목록](evidence/issue-866/related-pr-ci-inventory-20261105.json).
- Shard8 Job `126241764149`: `project-multi-task-copy-paste.spec.ts:212`의 `press("삭제")`가 `Unknown key`로 직접 FAIL했다. 현재 Phase B는 main과 같은 `press("Delete")`를 유지한다. 제품 키보드 핸들러를 수정하지 않고 해당 기존 spec을 최종 진단에 추가한다.
- **CANCELLED Shard6 Job `126241763988`도 실제 FAIL**: `master-controls-density.spec.ts:69` 전체 입력에 기존 padding8px/minHeight40px을 기대했으나 신규 TranslationFields는 설계대로6px 8px/44px이다. 현재 Phase B에도 같은 관측/단언이 남아 있어 번역 입력3개를 별도 정확 oracle로 검사하고 기존 원본 입력40px/8px 단언을 보존한다. Name→번역 trigger→Sort→Save→Deactivate의 추가 Tab 정지점도 기존3Tab 계약과 함께 보강한다. 스타일을 낮추거나 테스트를 제외하지 않는다.
- #3475 전체874 = 관측348 PASS /2 FAIL /1 기존SKIP /523 미완료·미실행. Shard6 44 PASS/1 FAIL/1 SKIP/54 NOT RUN, Shard8 69 PASS/1 FAIL/34 NOT RUN이며 나머지6개 취소 로그에는 추가 assertion FAIL이 없었다. Quality `126242585716`, Docker `126244669558` SUCCESS; E2E `126248279139`, QA `126248323747` FAILURE는 위 오류의 파생이다. 원본 report artifact Shard6 `13276381868`/Shard8 `13276182404`는 별도 보존되며 PR #879 성공 근거로 전용하지 않는다.
- #870 과거 실패 파일 합집합은8개가 아닌 **10개**로 확대한다. 추가된 `master-controls-density`와 `project-multi-task-copy-paste`를 포함해 현재 최종 bounded17spec을 새로 동결한다. 먼저 시작한15spec 진단과 새 최종source 결과를 구별하고 최종 source에서 과거/직접/인접·음성을 재검증한다.

### 보완·로컬 재현 및 최종 source 검증

- 첫15spec 중간 진단은61 PASS /3 FAIL /1기존SKIP,8.9분이다. fail-fast/retries 없이 끝까지 실행해 #454 412→GET200/GET500의 낡은 재저장 기대2건과 Resource Group stale 회귀의 전역alert strict locator 충돌1건을 추가로 확인했다. #454의 원인 alert와 stale-draft alert는 함께 존재하며 저장은 처음 revision과 다르면 계속 차단되는 것이 B002 정책이다. 최신 목록 재조회가 성공해도 오래된 초안을 새 revision으로 재전송하지 않는다. 테스트는 초안·두 원인·PATCH1 보존과 명시 취소/재열기 후 사용자 재입력·정확 If-Match7→8 저장을 검증하도록 교정한다. Resource Group 경고는 해당 번역 편집기 범위에서 검증하며 Next route announcer를 제거하거나 임의 첫 alert로 통과시키지 않는다. 제품의 경합 차단 코드는 변경하지 않는다.
- 원본 `logistics-table-density` after 사례는 수정 전9.7초에서 coarse44px 기대/실제20px로 RED, 실제HTTP/SQLite `i18n-master-data`는 수정 전9.5초에서 영어option 기대/원문 표시로 RED를 재현했다. 선택기 실제 컴포넌트 렌더 회귀도 수정 전 RED를 확인했다. locale/browser/SSR 경계를 구분해 기존 선택기3개 Unit에 실제 render seam 회귀1개만 추가했다.
- option 수정 후 기존 i18n E2E가 새 오류를 더 노출했다. ko5폭은 row47px PASS였지만 en390의 사용 건수 설명이 줄바꿈되어56.5px(기준<=48px)이었다. 기존 사전의 짧은 가시 Projects/Dự án 단위와 전체 title로 교정했다. 이어서 영어 category tabs의 intrinsic min-width로 문서398px(기준<=391px) overflow가 드러나 header/tabs의 min-width:0을 보강했다. 숨김·클리핑·행 높이/문서 폭 단언 완화 없이 기존3언어×5폭·coarse·Escape/focus/401/412 원본 E2E가 최종 단독 PASS했다. 단독 이전-source PASS와 아래 최종 동일-source 통합 결과는 합산하지 않는다.
- 코드/테스트/설정1283파일의 frozen SHA256은 `b0b631baa30f9c6455908a71ae66b0d62f201bc3a7aae682bc472746d075e371`이다. Node22.14.0/npm11.10.0, frozen `npm ci --prefer-offline --no-audit`, Playwright1.63.0의 고정 Chromium 환경이다. 실제 최종 source의 TypeScript PASS, ESLint exit0(기존18 warning/0 error), 전체 Vitest293파일 PASS/1기존SKIP·3541 tests PASS/3기존SKIP(117.09s), production build+runtime-tools PASS. 로컬 결과는 GitHub Required3 성공이 아니다.
- `verify:prepr --mode=fast --base=origin/main --issue=866 --risk=HIGH`는 UNKNOWN37/missing0으로 **BLOCKED**, sourceStable=true였다. 자동 영향 매핑을 추가하거나 우회 PASS하지 않았다. Work Packet에서 실제 producer→consumer를 수동 선정하여 동일 코드 source의 정적·전체Unit/build 및15spec/65계획 E2E를 별도 실행한다. 자동 dry-run은 NOT TESTED다. 최종 브라우저 결과·source 재대조·게시 근거를 아래 추가하며 원본 #3510~#3519의 FAIL/CANCELLED는 불변이다. 새 PR Full CI의 Quality/E2E/Docker·Trusted는 시작 시 NOT TESTED다.
- 최종 후보 코드/테스트/설정1283파일의 SHA256은 `4ffddace573d3504b165c2212fc52f1dc177e045df849ce3709479ce0e75d068`이다. 최종 Vitest3541 PASS/3기존SKIP(84.99초), production build/runtime-tools 및 원본설정 복구 후 TypeScript PASS. 초기15spec source와 최종17spec source를 구분한다. 로컬 캡처 정리 중 경로 quoting/동시 lint ENOENT와 생성 빌드 코드의 전체폴더 lint 탐색은 Work Packet 환경 예외로 보존하고 fresh-checkout 추적 TS/JS1118파일을 같은 ESLint 설정으로 재검증한다. 원격 CI/ESLint 설정을 바꾸지 않는다. 최종 Chromium 결과와 종료 지문을 확인한 뒤 추가한다.
- 위험 HIGH / OWNER_MANAGED / qa_required=true / release_required=true / release_authorized=false. 별도 Agent 사전검토는 독립 인간 QA나 Owner 병합/릴리스 승인이 아니다. manager_decision=NOT TESTED / MERGE_READY=BLOCKED, #866 OPEN. CI 모니터링·병합·Main/GHCR/Release/Finalizer·Issue 종료는 수행하지 않는다.

## PR #879 FULL-B007 — #3518.1 Shard7 populated Project Master row geometry (2026-11-05 KST)

### Original Full Run, primary failure and propagation

- PR #879, Full PR CI #3518.1, Run 41965727570, attempt 1, pull_request.synchronize, completed FAILURE: https://github.com/planner77/masterGantt/actions/runs/41965727570 . Event HEAD b8a90a709fa126efbad5bff8dcd1acd45449a50c; base main 364aa3bdfde16fd3ca79add61c35a1cde21f6395; exact test-merge d7cda7b58a284f3e5b200e6bec2a8d17a703460f (changes Job 127042168947). FAST #278 SKIPPED is non-authoritative.
- FIRST DIRECT FAILURE: Chromium E2E shard 7/8, Job 127043119334, step E2E shard 실행, tests/e2e/cross-screen-regression.spec.ts:28:5 (#457 populated master table), line 36 rowHeightMax toBeLessThanOrEqual(48): expected <=48px, actual 87px. Shard7 had 79 planned tests: 1 PASS (#457 five-width admin shell), 1 FAIL, 77 DID NOT RUN due to preexisting --max-failures=1. Original Playwright report artifact: https://github.com/planner77/masterGantt/actions/runs/41965727570/artifacts/13388050511 .
- Chromium shards 1/2/3/4/5/6/8 CANCELLED: seven job logs inspected; no additional actual test assertion failure found before cancel. Cancelled/NOT RUN is not PASS. Required E2E aggregate Job 127044095560 FAILURE and QA Final Job 127044522985 FAILURE are downstream of E2E failure.
- Exact source SUCCESS: QA Preflight 127042370140, Policy 127042476084, ESLint 127042475981, TypeScript 127042476078, Vitest 127042476008 (293 test files PASS, one SKIP; 3540 tests PASS and 3 SKIP), PR Fast Gate 127043024035, Next Build 127043119217, Required Quality 127043898809, actual Docker Smoke 127043119194 and Required Docker 127044497168. GitCommitInfo 3000ms git-fetch timeout warning is nonblocking because a shell test passed before a deterministic CSS/geometry assertion failed.

### Cumulative cross-run root cause and repair

- Previous primary failures remain: #878 FULL-001 shard count / FULL-002 translated SVAR Grid header (Phase A #3509.1 successful only on its own Head); #879 B001 #3510.1 non-main base; B002/B003 #3513.1/#3514.1 canonical DOC_SYNC; B004 #3515.1 TypeScript9/Vitest migration3; B005 #3516.1 Scheduling DOC_SYNC; B006 #3517.1 resource mixed target DTO TypeScript2. #3518.1 is first observed direct browser layout failure after Policy, TypeScript, Unit, Build, Docker gates succeeded; classification PRODUCT / UI_LAYOUT_GEOMETRY. Historical source statuses remain immutable.
- Mechanism: src/features/project-master/project-master-admin.tsx places the original name input and a new TranslationEditor 40px button inside styles.nameControl. Its CSS module lacked the .nameControl rule. Existing .table input width:100% consumed the name cell, so the button stacked vertically and table row became 87px. Translation storage, API revision/CAS, Gantt and authentication did not cause this error.
- Product patch: CSS .nameControl display:flex, flex-wrap:nowrap, align-items:center, gap:6px, min-width:0; immediate input flex:1 1 0 / width:0 / min-width:0. Keep name cell inside min-width960px table with horizontal scroll at viewport390px, preserve fine40px/coarse44px touch targets and original table vertical padding. Do not impose fixed row height, overflow hidden, hide button or reduce accessibility.
- Adjacent test-contract update: original #457 keyboard steps assumed three Tabs from used name input to Deactivate. New dialog trigger is a genuine keyboard stop: Name -> translation button -> Sort (used Code disabled) -> Save -> Deactivate. EXTEND existing cross-screen-regression spec with first Tab focus and aria-haspopup=dialog for trigger, followed by original three Tabs to Deactivate and unchanged focus-visible, 390/1440 row 40..48px and column geometry assertions. DO NOT relax assertions or remove translation control.
- TEST_LIFECYCLE_REVIEW: EXTEND tests/e2e/cross-screen-regression.spec.ts only; KEEP_UNIQUE tests/e2e/i18n-master-data.spec.ts ko/en/vi across 390/768/1024/1440/1920 and coarse390<=52px, translation save/401/412, project-master and locale/SVAR/SQLite/Copy/Template/HTTP suites. 145 spec files/8 shards unchanged, skip/retry/timeout/fail-fast/Required3/Trusted QA unchanged. This patch is static evidence only; new Head browser/Node/Docker CI results NOT TESTED until new Full run; earlier canceled shards may expose other issues.
- DOCUMENTATION_SYNC: Product CSS, cross-screen E2E, this cumulative ledger, Issue #866 Work Packet, I18N_PHASE_B.md, UI_UX_GUIDELINES.md updated. Original AGENTS.md, TEST_PLAN.md, CI/QA policy, DB, API, Owner/Release contracts untouched. Original #3518.1 FAIL is not retroactively PASS. Owner HIGH/OWNER_MANAGED, qa_required=true/release_required=true/release_authorized=false; #866 OPEN, #878/#879 unmerged, formal GHCR HOLD.

## PR #879 FULL-B006 — #3517.1 Target 카탈로그 선택적 translations 타입 추론 실패 (2026-11-05 KST)

### Source·Run 및 직접 실패

- [PR #879 Full #3517.1 / Run 41960950080, Attempt 1](https://github.com/planner77/masterGantt/actions/runs/41960950080) event=pull_request.synchronize, HEAD `1dfc5d7f5ec0ee0252773ba3900971ec977a2d90`, base/main `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, checkout test-merge `2264f3ae06ae6a3461b7b68b60c01d2ef7f8fca3` (changes Job 127026916036). Run completed FAILURE, Fast Development #277 SKIPPED(non-authoritative).
- **직접 FAIL:** TypeScript Job `127027137923`, step `Run npm run typecheck`, `src/server/resources/resource-dashboard-service-core.ts:805` TS2339 **2건** (컬렉션 label의 `translations` 속성을 구조적으로 접근하나 inferred union의 일부 멤버에는 이 속성이 없음). 실제 `snapshot.targetSnapshot.catalog`는 `ResourceDashboardTargetProjection["catalog"]` 타입이며 각 row에 `translations?`를 허용한다. 그러나 해당 배열과 group/resource UI row를 펼쳐 합칠 때 `const catalog = [...]`가 서로 다른 필수/선택 속성의 유니언을 추론하고 `label?.translations` 안전한 optional field 접근을 막는다. 런타임 DB/서버 번역값 손상이나 누락이 입증된 것은 아님. 분류: **TEST_CONTRACT / TYPESCRIPT_DTO_INFERENCE** (제품 컴파일 계약).
- **이번 회차에서 PASS 확인:** QA Preflight Job `127027033184`, Policy Job `127027137950`, ESLint Job `127027137886` **SUCCESS**. Vitest Job `127027137972` **SUCCESS: 293 files PASS / 1 file SKIP; 3,540 tests PASS / 3 SKIP (총 3,543)**. 이전 #3515.1의 stale migration version/list 및 group search/DTO 타이핑 관련 오류 중 이 테스트 계약의 실제 통과는 현재 소스에서 확인. 본 원본의 정확 source에만 적용한다.
- **파생 FAIL:** PR Fast Gate `127027765444`, Required Quality `127027853794` / E2E `127027853908` / Docker `127027853727`, QA Final `127027883555`. Next Build·Chromium 8-shard 구현·Docker 실제 smoke는 SKIPPED/NOT RUN (개별 성공 아님). changes Job `127026916036` 및 영향 Shadow `127027883531` 성공은 전체 기능 검증 대체 아님.

### 누적 이력·교차 영향·설계 보완

- 동일 Issue 선행 직접 오류: PR #878 FULL-001 테스트 샤드 수, FULL-002 영어 SVAR Grid header (#3509.1은 Phase A 해당 Head 성공); PR #879 B001 #3510.1 non-main base 정책 → Main retarget; B002 #3513.1 / B003 #3514.1 Import schema 문서 영향 기록 → 정규 DOC_SYNC 교정; B004 #3515.1 TS 9건·Vitest migration list 3건 → DTO/filter/migration regression 보완; B005 #3516.1 Scheduling Engine DOC_SYNC 한 문서 누락 → 정확 N/A(reason) 기록. 이번 B006은 **앞선 TypeScript 9건 중 대부분이 해소되어 남은 혼합 카탈로그 추론 2건**이며 새 정책 위반·스케줄 계산 변경이 아님. 모든 과거 Run/Attempt/원인/수정은 별도 불변 기록으로 유지하고 새로운 HEAD의 PASS를 소급하지 않는다.
- **최소 TypeScript 수정:** `renderTargets()`에서 `const catalog`에 `ResourceDashboardTargetProjection["catalog"]` 명시 타입 부여. 기존 `snapshot.targetSnapshot.catalog` / group(선택적 translations) / resource(번역 없음) 각각 동일 원본 행·순서·수량·식별자·`name`·`code`·`active`와 한 번의 Map lookup 유지. 명시적 안전 타입에서 `translations?`만 읽게 하며 unsafe `as any`/임의 캐스팅, 필드 강제 주입, 반대 언어 fallback, 데이터/DB/권한 정책 변경 없음.
- **TEST_LIFECYCLE_REVIEW:** 기존 `tests/server/i18n/managed-display-names.test.ts`의 target projection/catalog 및 group 번역 원본·상태·KPI 불변, `tests/server/resources/resource-dashboard-service.test.ts` 등 서비스·리소스 호출 계약, Resource Dashboard/WBS/Logistics snapshot 소비자와 기존 Vitest 3,540 PASS 사례를 KEEP_UNIQUE. 코드 속성 접근을 안전 DTO 배열로 정확하게 정렬하는 TypeScript-only 보완으로 신규 assertion/새 spec/skip/retry/timeout/8-shard 계획 수정 없음. 새 HEAD에서 **동일 source TypeScript/Unit 및 E2E8/Docker/Trusted 검증은 NOT TESTED**.
- **문서·승인:** `docs/ISSUE_866_FAILURE_ANALYSIS.md` 누적 사건 추가, `docs/exec-plans/active/ISSUE_866.md` 현행 구조적 AC·DOC_SYNC 및 보완 범위, `docs/I18N_PHASE_B.md` Target projection 타입 계약 설명. AGENTS.md, trusted QA/CI gates, DB migration, API DTO/Export·Gantt·LLM/Issue, 제품 버전 및 Release 정책 불변. 위험 HIGH / OWNER_MANAGED / qa_required=true / release_required=true / release_authorized=false. #866 OPEN, PR #878/#879 미병합, Main/GHCR/Finalizer/운영 데이터 불변, Phase C 전체 인수 미완료.

## PR #879 FULL-B005 — #3516.1 일정 설계 문서 DOC_SYNC 누락 (2026-11-05 KST)

- **인증된 원본:** [Full #3516.1 / Run 41956539012.1](https://github.com/planner77/masterGantt/actions/runs/41956539012) event=`pull_request.synchronize`, HEAD `7bce2814ee96bdb168ad1e7556792183b4f5f8fd`, Base main `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, checkout test-merge `6dabd4bce384bb7c56a45981016824eecdb674dd`. Completed FAILURE, FAST_DEVELOPMENT #276 SKIPPED/non-authoritative.
- **직접 실패 1건:** QA Preflight Job `127012793287` step `원본 base SHA의 QA Preflight 실행` 정책 `DOCUMENTATION_SYNC` — `docs/exec-plans/active/ISSUE_866.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — 문서 영향 기록 없음: docs/SCHEDULING_ENGINE.md`, 결과 FAIL=1 / DEFERRED=5, PRIMARY_ISSUE/RISK/QA flags/PATH_POLICY/ISSUE_AC PASS.
- **파생 및 미실행:** PR Fast Gate Job `127012901792`, Required Quality `127012998149`, E2E `127012998121`, Docker `127012998128`, QA Final `127013035027`은 Preflight 선행 실패의 파생 FAIL. TypeScript, Vitest, ESLint, Policy, Next.js build, Chromium 8-shard, Docker smoke는 SKIPPED / NOT TESTED. #3515.1 직접 TypeScript 9건·Vitest 3건을 보완한 새 HEAD의 실제 PASS가 아니며 원본 실패 이력은 보존한다.
- **원인:** 직전 REWORK-B004의 `tests/server/calendars/country-calendar-integration.test.ts` 변경은 migration 0036의 적용 목록/기존 snapshot 보존 회귀만 갱신했지만, 신뢰된 Main `scripts/qa_final_automated.py::docs_required`는 `calendar`를 포함한 변경 경로를 Scheduling Engine 설계 문서 영향 판단 대상으로 정의한다. 해당 문서 `docs/SCHEDULING_ENGINE.md`는 Main/PR 동일 SHA `96ca4156ae976168432cdffe7c2cdc785eb4df41`, 내용과 Working Calendar, dependency, duration, date-only scheduling 알고리즘 모두 불변. 변경 파일 108개에 대한 7개 필수 문서 검토에서 나머지 6개가 UPDATED로 기록되어 있었고 이번 1개만 누락되었다.
- **보완:** `docs/exec-plans/active/ISSUE_866.md`의 신뢰된 정규 `## DOCUMENTATION_SYNC`에 `docs/SCHEDULING_ENGINE.md: N/A(reason)`를 정확히 추가하고, REWORK-B005의 직접·파생 실패, 증거와 영향 범위를 누적 기록한다. 검사기·workflow·Required3/E2E8·retry/timeout·qa 정책/기존 Scheduling Engine 본문/운영 데이터·DB migration은 변경하지 않는다. 출처 불충분한 CI PASS를 주장하지 않는다.
- **TEST_LIFECYCLE_REVIEW:** 신규 구현·테스트 ADD/RETIRE 0; 기존 migration/Calendar/Project Issue/Resource Dashboard/locale filter/Managed Name DB·HTTP/Playwright 145 spec + 8 shards 보존. QA 정책에 따른 최신 HEAD 검증은 다음 PR Full CI에서 다시 필요하다.
- **리뷰/릴리스:** #879 inline P2 thread 1건 RESOLVED, unresolved 0, mergeable=true/main base(검사 시점). #878/#879 미병합, #866 OPEN, HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false, GHCR/Finalizer/Owner 수용 불변. 모니터링 없이 새 PR CI 시작까지만 수행.

## PR #879 FULL-B004 — #3515.1 TypeScript 타입·Locale 그룹 검색·0036 migration 회귀 직접 실패 (2026-11-05 KST)

- 원본 Full [#3515.1 / Run 41947822098.1](https://github.com/planner77/masterGantt/actions/runs/41947822098), event=pull_request.synchronize, HEAD `7e861e458135f6fe35e88394ed376b152420c688`, base main `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, 결과 FAILURE. FAST_DEVELOPMENT은 비권위 SKIPPED. QA Preflight Job 126984447770, Policy Job 126984569406 및 ESLint Job 126984569460은 SUCCESS.
- **직접 FAIL 1 — TypeScript Job 126984569355:** TS2554 1건(`resource-catalog-admin.tsx:607`의 locale 3번째 인자와 `filterGroups` 2개 인자 불일치); TS2339/TS2352 8건(`resource-dashboard-service-core.ts:132,805`와 `managed-display-names.test.ts:148–157`에서 런타임 번역을 내보내는 Dashboard/WBS/Logistics DTO의 `translations` 타입 선언 누락 및 잘못된 단언). 합계 9건.
- **직접 FAIL 2 — Vitest Job 126984569338:** 3536 PASS / 3 FAIL / 3 SKIP (294 Test Files 중 2 FAIL). `project-issues.test.ts:420,497`, `country-calendar-integration.test.ts:215`의 이전 migration 기대 목록은 0035로 끝나나 현재 실제 적용은 신규 `0036_display_name_translations.sql`까지여서 3개 모두 TEST_CONTRACT 불일치. 이어지는 `MAX(version)=35` 단언도 최신 버전 36으로 정정 필요. DB checksum/기존 row/foreign key 검증 실패 증거 없음.
- **파생 실패:** Fast Gate Job 126985233993, Required Quality 126985342802, Required Docker 126985342931, Required E2E 126985343007, QA Final 126985373375; Next Build·Chromium 8-shard 실제 실행·Docker smoke는 SKIPPED / NOT TESTED. 기존 정책·QA에 대한 별도 직접 위반을 주장하지 않는다.
- **보완:** `filterGroups`에 기본 ko를 유지하는 선택 locale 검색 지원과 ko/en/vi 원문·코드·ID 격리 회귀를 추가. 번역이 실제 전달되는 Resource Dashboard/WBS/Logistics DTO에 `translations?` 선언을 보강하고 안전하지 않은 강제 캐스팅 대신 타입 안전 조회. 0032/0033/0034→0036 migration 경로 기대·최신 version 단언만 최신화하며 원래 checksum·실데이터 보존·idempotence·foreign key 음성 검증은 보존한다.
- **TEST_LIFECYCLE_REVIEW:** EXTEND `tests/features/resources/resource-search-filter.test.ts`, `tests/server/projects/project-issues.test.ts`, `tests/server/calendars/country-calendar-integration.test.ts`; KEEP_UNIQUE `tests/server/i18n/managed-display-names.test.ts`의 실제 snapshot 번역/KPI·canonical 이름·revision 불변 검증과 Phase A/B 145 E2E/8 shards, 보안·HTTP·Import·Copy·Template·기존 DB 테스트. ADD/RETIRE/SKIP 0, assertion·Required3·retry/timeout·QA policy 완화 없음.
- **검증 경계/리뷰:** 원본 Run 실패 증거만 수용; 새 수정 HEAD의 TypeScript/Vitest/Playwright/Docker/Trusted는 PR CI 전 NOT TESTED. PR #879의 기존 P2 inline review thread는 수정 답변 후 RESOLVED, 미해결 0, 원본 HEAD는 mergeable=true / main target. #866 OPEN, PR #878/#879 미병합, HIGH OWNER_MANAGED, qa_required=true, release_required=true, release_authorized=false, GHCR/운영 데이터 불변.

## PR #879 FULL-B003 — #3514.1 반복 DOC_SYNC 정책 실패 (2026-11-05 KST)

- Full PR CI #3514.1 [Run 41946308147, Attempt 1](https://github.com/planner77/masterGantt/actions/runs/41946308147), event=pull_request.synchronize; Head 420781ac039e75adbc4143525a848c5e6bb2ca68 / Base main 364aa3bdfde16fd3ca79add61c35a1cde21f6395 / test merge 765f10ba4696cad4b269741eb57f563d18fdb94a (changes Job126979260538 로그). Completed FAILURE. FAST_DEVELOPMENT #274.1 SKIPPED, 비권위.
- 직접 실패: QA Preflight Job126979392129 step4 DOCUMENTATION_SYNC 검사 `문서 영향 기록 없음: docs/IMPORT_SCHEMA.md`; deterministic FAIL=1/DEFERRED=5. PRIMARY_ISSUE/RISK_LEVEL/QA_METHOD/QA_REQUIRED/RELEASE_REQUIRED/RELEASE_AUTHORIZED/PATH_POLICY/ISSUE_AC PASS. 분류 POLICY_CI / DOC_SYNC_CANONICAL_SECTION (이전 #3513.1 직접 오류 재발, 새로운 제품/Import 실패가 아님).
- 파생 실패: PR Fast Gate 126979517319, Required Quality 126979630276 / E2E 126979630213 / Docker 126979630198, QA Final 126979663993. Policy/TypeScript/ESLint/Vitest/Next production build, Chromium8 실제 샤드, Docker 구현 모두 SKIPPED/NOT RUN. changes Job126979260538/Impact Shadow126979664127 SUCCESS는 제품 PASS 아님.
- 누적 원인 매트릭스: PR #878 FULL-001 shard count와 FULL-002 SVAR en-US 헤더(TEST_CONTRACT; #3509.1 Phase A만 PASS); PR #879 FULL-B001 #3510.1 non-main base 차단(교정), FULL-B002 #3513.1와 FULL-B003 #3514.1 동일 문서 영향 기록 불일치(재발). B002의 docs/IMPORT_SCHEMA.md 내용은 정상 추가됐으나 Work Packet에는 정확히 `### DOCUMENTATION_SYNC (REWORK-B002)`로만 표기해 trusted `section(plan,"DOCUMENTATION_SYNC")`가 참조하는 **기존 `## DOCUMENTATION_SYNC`에 포함되지 않았다**. 과거 원본 실패를 소급 성공 처리하지 않는다.
- 전체 diff 101파일 및 trusted docs_required 규칙 대조: Required는 DESIGN.md, docs/TEST_PLAN.md, docs/DB_SCHEMA.md, docs/API.md, docs/IMPORT_EXPORT.md, docs/IMPORT_SCHEMA.md. 해당 문서들은 모두 Main 대비 변경되었으므로 정규 section에 `UPDATED`가 필요. docs/IMPORT_SCHEMA.md 누락뿐 아니라 이전 Phase A N/A인 API/DB_SCHEMA/IMPORT_EXPORT가 남아 있어 다음 차단 가능성이 있었으므로 전부 일괄 교정. 정확 `## AC_TEST_COVERAGE`의 AC01·AC04~06·AC09 구현/미실행 구분도 갱신.
- TEST_LIFECYCLE_REVIEW: ADD/RETIRE 없음, 기존 검증/보안/HTTP/SQLite·Copy/Template·Import/Export·Gantt·145 E2E/8 shards 모두 KEEP_UNIQUE; CI/QA 신뢰 코드·assertion/skip/retry/timeout 불변. 새 원본 Full CI 전 Node/SQLite/Playwright/Docker/Trusted NOT TESTED.
- 리뷰/충돌: Codex P2 logistics type thread r4475215195는 이전 commit 420781ac에서 교정·응답·resolved, 확인 당시 미해결 thread 0건 및 PR mergeable=true. P1 대용량 TEST_PLAN 복구와 ResourceGroup stale revision 교정 유지. #866 OPEN / PR #878/#879 미병합 / HIGH OWNER_MANAGED qa_required=true release_required=true release_authorized=false, GHCR HOLD; 최종 Phase C 및 운영 0036 백업/복구 미검증.
## PR #879 FULL-B002 — #3513.1 QA Preflight 문서 영향 누락 및 물류 유형 편집 P2 (2026-11-05 KST)

### 원본 Run·Job·직접 실패

- [PR #879](https://github.com/planner77/masterGantt/pull/879) Full CI **#3513.1 / [Run 41943199412, Attempt 1](https://github.com/planner77/masterGantt/actions/runs/41943199412)**, pull_request synchronize, HEAD `20f106f39f90d838193234c5bb0320977fe4af91`, base/main `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `1645f96490dc08e09efbe082c38b4de4f84213f4` (changes Job 126968856393 checkout log). Original completed FAILURE, original Fast non-authoritative skipped.
- **직접 FAIL: QA Preflight Job 126968984659, step 4, DOCUMENTATION_SYNC**: `docs/exec-plans/active/ISSUE_866.md: DOCUMENTATION_SYNC / AC_TEST_COVERAGE — 문서 영향 기록 없음: docs/IMPORT_SCHEMA.md`. `FAIL=1, DEFERRED=5`. `PRIMARY_ISSUE, RISK_LEVEL, QA_METHOD, QA_REQUIRED, RELEASE_REQUIRED, RELEASE_AUTHORIZED, PATH_POLICY, ISSUE_AC`는 PASS. PR base=main 정책은 이번에는 PASS이며 #3510.1과 다른 원인이다.
- **파생 FAIL:** PR Fast Gate Job 126969113413 (PREFLIGHT_RESULT=failure), Required Quality 126969223864, Chromium E2E 126969223984, Docker 126969223914, QA Final 126969265352 (required quality 미성공). Policy/TypeScript/ESLint/Vitest/Next build, Chromium8 실제 실행 및 Docker implementation 전부 SKIPPED/NOT RUN. changes 126968856393 및 영향 Shadow 126969265079 SUCCESS는 제품 테스트 성공 근거 아님. 취소 샤드에서 별도 직접 FAIL을 확인하지 못함.
- 원인 분류: **POLICY_CI / DOCUMENTATION_SYNC 기록 누락**. Phase B는 Copy/Template version 6과 일정 JSON/Excel 손실 방어 409를 변경했으나 `docs/IMPORT_SCHEMA.md`의 영향 여부를 Work Packet의 현재 Phase B 문서 표에 명시하지 않았다. 스키마/Import 런타임 자체가 실패했다고 해석하지 않음.

### 리뷰 결함과 보완·검증 경계

- 별도 Code Review **P2**, [discussion r4475215195](https://github.com/planner77/masterGantt/pull/879#discussion_r4475215195): `src/features/logistics/logistics-type-catalog-admin.tsx`의 `saveEdit`는 412로 최신 목록을 갱신한 후에도 기존 번역 draft를 새로운 revision의 If-Match로 재전송할 수 있다. 이전 #3510.1 보완은 `TranslationEditor` 공통 컴포넌트(글로벌 Project Master/Resource Group)에만 적용되어 물류 유형 화면이 빠졌다. 이번 P2는 **실제 E2E 미실행 상태에서 발견된 정적 Code Review 결함**이며 직접 CI 오류는 아님.
- **설계/수정:** `docs/IMPORT_SCHEMA.md`에 schedule JSON 1.0/1.1 스키마 불변, 지원하지 않는 owner 번역 key strict reject, 복제/Template v6 사용, 기존 일정 Export 409 손실 차단 의미를 설명한다. Work Packet `DOCUMENTATION_SYNC`에 UPDATED 경로와 이유를 등록한다. 코드상 Import schema/API/CI 게이트는 변경하지 않는다.
- 물류 유형 편집의 **start revision**을 draft와 함께 보존하고 `catalog.data.revision`과 불일치하면 role=alert와 저장 disabled + submit 방어로 오래된 다국어 전체 replacement PATCH 차단. 취소 후 최신 항목을 재열어야 새 revision을 사용한다. 401 재인증/412 최신 조회·기존 서버 CAS/Origin 인증/권한은 유지한다.
- **TEST_LIFECYCLE_REVIEW:** EXTEND `tests/e2e/logistics-type-catalog-admin.spec.ts` mock HTTP: 최초 If-Match revision4→상대방 vi 변경 후412→최신 revision5 조회→기존 en 초안 보존, 두 번째 저장 차단 및 PATCH1회→명시 취소 후 최신 vi 확인→재저장 If-Match5/PATCH2회, vi 값 보존. KEEP_UNIQUE `tests/e2e/resource-catalog-delete.spec.ts` 공통 editor 동시수정 회귀, Phase A/Phase B Unit/SQLite/HTTP/Copy/Template/Import/Export 및 8-shard 145 spec. 신규 E2E 파일 추가/샤드 이동/timeout·retry·gate 완화 없음.
- **전체 이력 교차:** #878 FULL-001 E2E shard count 계약, FULL-002 SVAR en-US 헤더 계약 → #3509.1 성공은 Phase A Head 범위만; #879 FULL-B001 #3510.1 main 대상 아닌 PR의 Preflight BLOCKED → base main으로 변경되면서 이번 #3513.1에서는 정책 검사 통과; FULL-B002는 `docs/IMPORT_SCHEMA.md` 문서 영향 미기록 신규 원인. 선행 Codex P1 대용량 `TEST_PLAN.md` 유실은 이전 보완 commit 20f106f의 원본 Blob 복원으로 해결했으며 해당 문서는 이번 변경에서 그대로 보존한다. 구 #870/LLM/Issue UI 직접 실패는 독립 Source로 유지.
- **교차 소비자 합집합:** `docs/IMPORT_SCHEMA.md`, `docs/IMPORT_EXPORT.md`, `docs/exec-plans/active/ISSUE_866.md`, `docs/I18N_PHASE_B.md`, `tests/e2e/logistics-type-catalog-admin.spec.ts`, `src/features/logistics/logistics-type-catalog-admin.tsx`, `src/components/translation-fields.tsx`, `tests/e2e/resource-catalog-delete.spec.ts`, 기존 SQLite/HTTP/Copy/Template/Import/Export/Phase A specs. 새로운 Head의 실제 Node/TypeScript/Vitest/E2E8/Docker/Trusted 테스트는 **NOT TESTED**, 실패 Run #3513.1을 소급 PASS로 전환하지 않는다.
- 위험: HIGH / OWNER_MANAGED / qa_required=true / release_required=true / release_authorized=false, Issue #866 OPEN, PR #878/#879 미병합. 최신 Main 및 미해결 review/mergeability 재확인 후 신규 Full CI. 운영 DB 0036 백업·복구와 Phase C 전체 현지화는 남아 있음.

## PR #879 FULL-B001 — #3510.1 QA Preflight의 non-main base 정책 차단 (2026-11-05 KST)

### A. 원본 실행 및 직접·파생 구분

- Primary Issue #866 / PR #879. Full PR CI #3510.1: https://github.com/planner77/masterGantt/actions/runs/41941093006 (Run 41941093006, Attempt 1, pull_request.opened, FAILURE). HEAD dfc967258f5fa0cc8e188d116cdccd734f49c771; 이벤트 Base 8fca83bbc12cf516cd7f22438fa16c6b596d80fb (Phase A PR #878); Checkout test-merge 28d4bb5ece15503393808ecbcc5410168264fe02. 추후 PR base 갱신이 과거 이벤트 출처를 소급 변경하지 않는다.
- **직접 차단:** QA Preflight Job 126961958453 / step 4, 원본 base SHA의 scripts/qa_preflight.py 실행. 정책 코드 71행은 live pull request base.ref == main을 필수로 검사한다. 실제 PR base.ref=feat/issue-866-i18n-phase-a-main이므로 BLOCKED. 원본 출력: 'PR 최신 Head/base 변경·대상 저장소 불일치 (새 full CI 필요)'; deterministic FAIL=0, DEFERRED=0. 출처 API 오류/제품·SQLite 오류라는 증거는 없음. 분류 POLICY_CI / PR_BASE_CONTRACT.
- **파생:** PR Fast Gate Job 126962081626 FAILURE (PREFLIGHT_RESULT=failure, Policy/TypeScript/Lint/Vitest 모두 SKIPPED), Required Quality 126962207510 / E2E 126962207560 / Docker 126962207386 FAILURE 집계, QA Final 126962252068 FAILURE (required quality 미성공). Policy, ESLint, TypeScript, Vitest, Next Build, Chromium 8 shards, 실제 Docker implementation 전부 SKIPPED/NOT RUN. changes 126961782052 및 impact shadow 126962252220 SUCCESS는 구현 PASS 근거 아님.
- 독립 리뷰: Codex top-level comment https://github.com/planner77/masterGantt/pull/879#issuecomment-6646137991 (P1 Test Plan 의도치 않은 5762줄 삭제, P2 오래된 TranslationEditor draft가 최신 revision을 차용해 다른 관리자 vi 변경을 덮을 수 있는 silent lost update). 별도 리뷰 스레드 목록 최초 0건; 두 리뷰 지적은 #3510.1 Preflight의 직접 실패 원인이 아니며 보완 범위로 분리한다.

### B. 전체 실패 이력 교차·설계·보완

- #878의 FULL-001 shard count TEST_CONTRACT, FULL-002 SVAR 영어 header TEST_CONTRACT 원본 기록 불변. 성공한 #878 Full #3509.1 (Run 41930396372)는 Phase A HEAD 8fca83...에만 유효하며 #879 신규 코드의 PASS 근거 아님. 이전 통합 #870의 LLM/Issue UI 및 HTTP failures 역시 별도 source.
- POLICY_CI: scripts/qa_preflight.py, workflows/ci.yml, Required3, Trusted/Owner 정책을 변경하지 않는다. PR #879의 대상만 main으로 전환하여 Phase A+B 합산 diff를 올바른 Main-target Full CI로 검증한다. PR #878/879 병합, GHCR, Issue #866 종료는 여전히 HOLD.
- P1 DOCUMENT_INTEGRITY: 이전 코드 작성 시 대용량 docs/TEST_PLAN.md의 fetch_file content가 빈 문자열로 돌아와 6줄 요약으로 잘못 대체했다. Phase A base의 원본 Blob SHA 990eee5eb1e21cbffcd091b1331dba315d5990ee (829625 UTF-8 chars, 5765 LF 포함 줄수)를 별도 fetch_blob으로 확인하고 Git Tree에 SHA 원본으로 복원. Main 원본이 아니라 Phase A에서 갱신된 문구까지 보존. #711 Test Lifecycle/#697 정책 삭제 방지. Phase B 계획은 Work Packet/원장 및 별도 설계에 문서화한다.
- P2 CONCURRENT_EDIT: TranslationEditor 캐시 초안을 값만 저장하는 방식에서 revision+translations snapshot으로 변경, 처음 열 때의 catalogRevision을 고정한다. Project Master/Resource Group 양쪽에서 revision 전달, 401 재인증과 412 재조회 후에도 draft의 원래 revision 유지. 현재 revision이 다르면 role=alert, save disabled와 클릭 가드, 원본 초안 보존. 사용자는 취소 후 최신 row를 다시 열어 명시적으로 새 번역을 확인한다. 서버 If-Match/권한/Origin/CAS는 변경하지 않음.
- TEST_LIFECYCLE_REVIEW: 기존 tests/e2e/resource-catalog-delete.spec.ts에 다른 관리자 Vietnamese 갱신과 카탈로그 새로고침, 기존 English draft 보존, stale PATCH=0, 안내, 취소/다시 열기, 최신 revision PATCH와 Vietnamese 유지 assertion 추가. KEEP_UNIQUE 원래 145개 spec file/8-shard 계획, #866 Unit/SQLite/HTTP/Gantt, Required3. 추가 spec 파일/샤드 변경 없음.
- 검증 경계: 정적 Git Blob/Tree source 검토만 완료, 새로운 Head의 TypeScript/Vitest/SQLite/HTTP/Playwright/Docker/Trusted 실제 실행은 NOT TESTED. #866 Phase C 및 운영 backup/restore·12 owner 동시쓰기 검증 미완료. HIGH / OWNER_MANAGED / qa_required=true / release_required=true / release_authorized=false; GHCR/merge/issue close 보류.

## Phase B 분리 착수 (2026-11-05) — 원격 실패 미확인

- #878 정확 HEAD `8fca83bbc12cf516cd7f22438fa16c6b596d80fb`의 Full CI #3509.1 성공은 Phase A 범위만 증명한다. Phase B는 별도 Head/트리, 최초 PR CI 전 **NOT TESTED**.
- #870 이전 혼합 PR의 구현과 테스트는 참고 자료이며 그 당시 PASS/FAIL, 도메인/LLM/Issue 변경, 구버전 0.140.0을 Phase B 새 HEAD의 검증으로 승격하지 않는다. 기존 Full-001/002 및 역사적 실패 원문 유지.
- Branch: feat/issue-866-i18n-phase-b-owner-data, base는 #878 Phase A HEAD(최신 Main 364aa3.. 상속), 정확 PR/CI Run은 생성 이후에 기록한다. 신규 E2E shard 7, 145개 spec. 로컬 TypeScript/Vitest/브라우저/DB/Docker 실행: NOT TESTED.
- 현재 미실행/위험: Phase B 신규 원격 Quality/E2E8/Docker/Trusted, 프로젝트 Equipment/System UI 전수, 소유자별 HTTP 세션/경합, DB 백업/복원, Copy/Template6 실환경. release_authorized=false, 병합·게시·이슈 종료 HOLD.

# Issue #866 — 국제화 분리 PR 누적 실패 원장

기준 Main: `364aa3bdfde16fd3ca79add61c35a1cde21f6395` / `v0.141.1`. #866 전용 원장은 이 파일을 사용하며 이전 #870 원본(PR/Run/리뷰/실패)은 https://github.com/planner77/masterGantt/pull/870 와 해당 원본 브랜치 `docs/ISSUE_866_FAILURE_ANALYSIS.md`에서 독립 추적한다. 기존 CI 실패와 구현 중 원인은 덮어쓰거나 성공으로 소급하지 않는다.

## 원본 #870과 새 Phase A의 인과 분리 (2026-11-05)

- 원본 통합 PR #870: Head `ca58e987fd68261d9e9db97b4e931651350d6e4a`, 오래된 기준 `352a43e74c7b34c72d952f67783a53463f8b519d`, 국제화 + 독립 #865 LLM + #869 Issue 레이아웃을 339파일에 혼합. 이전 통합 PR의 원장에는 관리형 이름 저장/기존 스키마/HTTP·Playwright/E2E 원본 실패 사례가 기록되어 있다. 그 실패의 구 코드를 새 Main i18n Phase A의 제품 직접 실패로 섞지 않는다.
- 가장 최근 원본 PR #870의 [Full #3474.1 / Run41723556052](https://github.com/planner77/masterGantt/actions/runs/41723556052)에는 `tests/e2e/issue-726-task-logistics.spec.ts` 공정문맥 HTTP 실패/상세 원인 관측 등 별도의 역사 기록이 있다. 교정 제품 경로는 #869/#865 병합이 반영된 Main에서 재평가해야 하며, 구 PR 339파일을 일괄 덮어쓰지 않는다. 원본 결과를 새 Phase A의 테스트 PASS로 전용하지 않는다.
- 분리 Phase A: 0.141.1 → 0.142.0 candidate, 현재 원격 구현 성공/실패 Run 아직 **NOT TESTED**. 기존 한국어 UI/업무 Gantt·LLM 제품·API·DB/마이그레이션을 변경하지 않고 공통 Locale + UI Header/Navigation + SVAR words/date-only만 추가.
- 새로운 실패가 발생하면 **실제** GitHub Run/Attempt/Job/Step, Head/Base/Test merge, 직접 원인/파생 및 취소·미실행, 교정 코드/테스트/문서·리뷰·충돌 및 재검증을 본 문서에 **추가**한다. 과거 PR #870의 다른 Issue 결함을 신규 Phase A 실패라고 주장하지 않는다.
- 실행 계약: Required Quality/E2E8/Docker, Trusted QA, Owner HIGH/OWNER_MANAGED, 정식 release 승인 별개. 로컬 Checkout/실행 미확인, 신규 PR CI 시작까지만 진행, 결과 모니터링 안 함. Phase B/C까지 Issue #866 OPEN, tag/GHCR 정식 게시 금지.

## PR #878 FULL-001 — #3507.1 새 i18n E2E 샤드 명시 계획의 테스트 계약 실패 (2026-11-05 KST)

### A. 원격 실행 및 실패 집계

- [PR #878](https://github.com/planner77/masterGantt/pull/878), head `ccf39510441a447d3df8f9f85ee3c9b1e22008ce` / base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, branch `feat/issue-866-i18n-phase-a-main`. [Full #3507.1 / Run 41921474942](https://github.com/planner77/masterGantt/actions/runs/41921474942) `pull_request`, Attempt **1**, 결과 **FAILURE**. 원본 changes Job `126894787011`의 checkout·`PR_TEST_MERGE`에서 정확한 test-merge SHA **`5a91fa65c2a097fdc41998477c7aafcfe710d255`**를 별도 확인했다. FAST_DEVELOPMENT #269.1 Run41921474879 SKIPPED는 Required 증거가 아니다.
- **최초 직접 FAIL** = Vitest 단위·통합 Job `126895162188`, step `Run npm test`: `tests/scripts/e2e-shard-planner.test.ts:107:58`의 **`covers all current specs exactly once after #767 eight-shard escalation`**. 예상 파일 수 `[19,18,18,18,17,18,17,18]`, 실제 `[19,18,18,18,18,18,17,18]`. 새 `tests/e2e/issue-866-language-shell.spec.ts`를 `tests/config/e2e-shard-plan.json`의 shard5에 배치한 것은 맞지만, **해당 계획을 검증하는 유지 관리 테스트의 하드코딩된 counts만 과거 값 그대로**였다. 단순 코드를 넘겨서 PASS하거나 비교를 삭제/약화하지 않는다.
- Vitest **3527 PASS / 1 FAIL / 3 SKIPPED** (292 files: 290 PASS/1 FAIL/1 SKIPPED). 신규 `tests/lib/i18n-phase-a.test.ts` 6건은 본 Run에서 **PASS**, `tests/lib/date-display.test.ts` 3건 PASS. Policy, ESLint, TypeScript, QA Preflight, `changes` Job은 각각 SUCCESS; Next production build 및 Chromium8 실제 shards와 Docker 구현은 PR Fast Gate 정책으로 **SKIPPED/NOT RUN**.
- **파생 FAIL** = PR Fast Gate `126895994660` (`UNIT_RESULT=failure`), 세 Required aggregate Quality `126896155327` / E2E `126896155503` / Docker `126896155107` (**확실한 Job 번호는 Actions 원본 job list `126896155107` 참조; 직접 원인 아님**), QA Final Automated `126896209099` (`required quality 미성공`). 필수 E2E/Docker 실행 없음은 **FAIL 원본 아님**, SKIPPED를 PASS로 확대하지 않는다.

### B. 원인, 과거 이력과 교차 비교

- 분류: **TEST_CONTRACT** (신규 E2E 1개 명시 등록과 누적 샤드 count regression test 간 동기화 누락). 런타임 i18n·React/SVAR·SQLite·Docker 결함을 확인한 증거는 없음(전체 build/E2E/Docker는 미실행).
- **원본 혼합 PR #870의 역사적 직접 실패 합집합**은 기존 #866 원장 (원본 브랜치)에 그대로 있으며 원격 #3474.1의 `issue-726-task-logistics.spec.ts` HTTP context error 등은 현재 Phase A 소스에서 재실행되지 않아 **NOT TESTED**. 이번 직접 FAIL은 #870과 별개 `tests/scripts/e2e-shard-planner.test.ts`이며 신규 `issue-866-language-shell.spec.ts`가 계획에 새로 등록될 때만 나타나는 분기.
- 교차 영향 파일 합집합: `tests/scripts/e2e-shard-planner.test.ts`(직접 실패), `tests/config/e2e-shard-plan.json`(명시 Shard5 원본 producer), `tests/e2e/issue-866-language-shell.spec.ts`(신규 consumer), `tests/lib/i18n-phase-a.test.ts`(직접 PASS), 기존 `scripts/e2e-shard-planner.mjs` 및 다른 143개 기존 spec(무변경/원격 shard는 NOT RUN). 원본 E2E/QA 보안과 8 shard / fast gate / timeout / skip 정책 불변.

### C. 보완 및 교차 검증 계획

- **EXTEND** `tests/scripts/e2e-shard-planner.test.ts`의 정확한 8 shard count expectation에서 **Shard5만 17→18**로 변경하고, 기존 20개 역사적 spec 경로→shard 매핑과 함께 **새 `["issue-866-language-shell.spec.ts", 5]` 명시 검증 추가**. 원본 `Set(entries).size === entries.length`, `[...entries].sort() === discovered`, 모든 shard 선택 결과/dedup 및 결손·중복의 fail-closed 테스트는 유지.
- `tests/config/e2e-shard-plan.json`의 **144개 정확 명시 배치**, 8 shard, 이전 143개 스펙/역사적 projectedMs/sourceRunIds·실행 계획 전부 불변. 새 spec의 실제 소요 시간은 여전히 REMOTE_UNMEASURED. i18n 코드/제품 라벨/locale·package version/CI/QA 정책은 수정하지 않음.
- GitHub 커넥터로 원본 Job/Step·테스트 파일·샤드 계획·커밋/정책 검사·Phase A Work Packet을 정적으로 대조(**정적 일치 확인**). 로컬 `npm test`/TypeScript/Playwright/Docker 및 완전 동결된 신규 소스의 원격 Full 결과는 이 교정 작성 시 **NOT TESTED**. 반드시 새 HEAD의 Full PR CI로 정책·Vitest·Quality/E2E8/Docker·Trusted 검증을 다시 수행하며 #3507.1 과거 FAIL은 불변 유지.
- [Work Packet](exec-plans/active/ISSUE_866.md)의 REWORK1 / [Test Plan](TEST_PLAN.md)에서 신규 spec 배치와 명시 count assertion 동기화 근거를 보강. 미해결 리뷰 0, mergeable/현재 Main behind0 검증 후 새 Run ID+Attempt를 별도 감사한다. `HIGH/OWNER_MANAGED/qa_required=true`, `release_required=true/release_authorized=false`, Phase B/C 미완료·Issue OPEN·Main/정식 GHCR 배포 금지.
## PR #878 FULL-002 — #3508.1 영어 SVAR Grid 헤더와 구 E2E 단언 충돌 (2026-11-05 KST)

### A. Run/Attempt/Head/Base와 직접·파생 실패

- [PR #878](https://github.com/planner77/masterGantt/pull/878), branch `feat/issue-866-i18n-phase-a-main`, 정확 HEAD `cd3f0c57953a0bd50a0ac74c0303211e08b20e68`, base/Main `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, changes Job `126906655974` 원본 checkout·`PR_TEST_MERGE` **`6eef294a77b93b30dd0d90184a51b44035a8d014`**. [Full CI #3508.1 / Run 41924914789, Attempt1](https://github.com/planner77/masterGantt/actions/runs/41924914789), completed/**FAILURE**. Non-authoritative FAST #270.1 Run41924914479 SKIPPED는 Required PASS가 아니다.
- **직접 실패** = Chromium E2E Shard **4/8**, Job **`126908178973`**, step `E2E shard 실행`, `tests/e2e/project-workspace-layout.spec.ts:25:9`의 `en-US` 사례, assertion **line 83** `gridHeaders.getByText("외부 ID", { exact:true })`의 `toBeVisible` 실패 (`element(s) not found` / 5000ms). 원본에는 93개 선택 테스트 중 **33 PASS / 1 FAIL / 59 DID NOT RUN**로 PR의 `--max-failures=1` 조기 중단. 같은 spec의 `ko-KR` 사례는 정상 PASS. 이 실패는 작업/기간/날짜/상단 고정의 실패가 아니라 새 사용자 언어에 따라 실제 native Grid **`외부 ID` → `External ID`**가 번역되는데 **구 테스트만 한국어 문자열을 고정 기대**하는 계약 불일치다.
- **제품/계약 근거**: `src/features/gantt/svar-locales.ts`의 `appColumnTerms["외부 ID"]=["External ID","ID bên ngoài"]`, `src/features/gantt/project-gantt.tsx`의 `<Locale words={SVAR_LOCALES[locale]}>`, `tests/e2e/project-workspace-layout.spec.ts`의 두 `test.use({locale: ko-KR / en-US})` 분기가 원본 증거. 동일 spec는 기존 custom Column Menu `getByRole("checkbox",{name:"외부 ID"})`를 사용하며 이 앱 자체 메뉴는 Phase A에서 미번역, **native SVAR Grid 헤더만** 영어가 된다. 제목/에러로부터 임의 데이터 손상·SVAR 구현 버그를 주장하지 않는다.
- **단독 CI 검사 결과** = `Vitest` 3528 PASS / 3 SKIPPED (292파일: 291 PASS/1 SKIPPED), Unit Job `126907009480` **SUCCESS**, TypeScript `126907011273` **SUCCESS**, ESLint `126907009587` **SUCCESS**, 정책 `126907009619` **SUCCESS**, QA Preflight `126906834432` **SUCCESS**, PR Fast Gate `126908041800` **SUCCESS**, 실제 PR Next Build `126908178961` **SUCCESS**, Docker 구현 `126908178690` / Required Docker `126910489168` **SUCCESS**, Required Quality `126909012355` **SUCCESS**. Shard **7/8** `126908179115` SUCCESS; Shard 1/2/3/5/6/8은 `CANCELLED`, 따라서 전체 E2E가 성공한 것이 아니다.
- **파생 실패** = Required E2E aggregate `126916528651` (`RESULT=failure`), QA Final Automated `126916594844` (`required e2e 미성공`). E2E 4의 브라우저 테스트 실패가 원인이며 다른 6개 취소·QA는 독립 제품 결함 근거가 아니다. Shard4 Playwright 시작 직후 git fetch `GitCommitInfo: timeout of 3000ms` 기록은 별도 비차단 정보 메시지이고 33개 테스트가 계속 PASS한 후 정확한 UI 단언에서 실패하여 이번 직접 원인으로 분류하지 않는다.

### B. 이전 실패 전체/교차 영향 종합

- **FULL-001 #3507.1**: 143→144 E2E 명시 배치 변경 시 샤드 수를 고정 단언한 `tests/scripts/e2e-shard-planner.test.ts` 누락으로 TEST_CONTRACT FAIL 1개, 뒤따른 Required3·QA FAIL. 교정 커밋 `cd3f0c57953a0bd50a0ac74c0303211e08b20e68`의 **#3508.1 Vitest 3528 PASS**로 동일 source에서 해당 테스트 계약의 재검증을 확인. 원본 #3507.1 FAIL은 이 결과로 소급 PASS 처리하지 않는다.
- **FULL-002 #3508.1**: 새 SVAR Locale 도입 후 기존 E2E 영어 사례가 한국어 native header를 고정 단언한 문제다. 첫 번째 테스트 누락과 인과적으로 별개며 이전 PR #870의 #726 공정 문맥 HTTP/기준정보 번역/migration 및 원본 실패들을 현재 Phase A의 추가 직접 오류로 끌어오지 않는다.
- **실패·인접 소비자 합집합**: `tests/e2e/project-workspace-layout.spec.ts`의 ko/en 시간대·date-only·컬럼 선택/숨김·Gantt instance/스크롤/고정 헤더, `tests/lib/i18n-phase-a.test.ts`의 SVAR ko/en/vi 단어, `src/features/gantt/svar-locales.ts`과 `project-gantt.tsx` 실제 Locale, `tests/e2e/issue-866-language-shell.spec.ts`의 새 브라우저 저장·선택/바로가기, 기존 8-Shard E2E와 3 Required/Docker. 실행되지 않은 6개 Shard/Phase B/C는 NOT RUN/NOT IMPLEMENTED; 다음 새 Head에서 성공할지 미확정.

### C. 교정·테스트 생명주기 및 감사 경계

- **EXTEND** 기존 `tests/e2e/project-workspace-layout.spec.ts`의 두 표본을 **ko-KR → `외부 ID` / en-US → `External ID`**로 독립 정확 매핑하여 같은 native Grid column의 표시/숨김과 잘못된 언어의 헤더 부재를 검증한다. 기존 custom Column Menu 한국어 label 체크·체크해제, 헤더 고정/설정 modal/Escape·focus, Gantt API/DOM instance 보존, UTC date-only/미국 시간대, 60행 scroll/문서 overflow/JS 오류 모두 단언 그대로 유지. 각 실제 `html lang` 값 확인을 추가.
- **EXTEND** `tests/lib/i18n-phase-a.test.ts`의 static SVAR words 검증에 `["외부 ID"]`의 `ko="외부 ID"`, `en="External ID"`, `vi="ID bên ngoài"` 3언어 매핑 단언을 추가한다. **KEEP_UNIQUE** `tests/config/{playwright,transport}.config.ts` 기본 ko-KR, `tests/config/e2e-shard-plan.json`의 정확 144개 배치, `tests/scripts/e2e-shard-planner.test.ts` 최신 count, `tests/lib/date-display.test.ts` 및 모든 API/DB/LLM/권한/보안/E2E. 단언 삭제/완화·timeout/retry/Shard 갱신 없음.
- **문서 동기화**: `docs/exec-plans/active/ISSUE_866.md` REWORK2, `docs/TEST_PLAN.md`, `docs/I18N_PHASE_A.md`, `docs/REMOTE_VALIDATION.md`, 이 **동일 누적 실패 원장**에 추가. `AGENTS.md`, 제품 Locale·앱 버전 `0.142.0`/CI/QA/Required3/Owner 관리 정책 변경 없음.
- **검증 상태**: GitHub Run/Job/Step 로그 및 source/기존 E2E/사전 코드 교차 확인 완료. 새 코드가 생성된 후 실제 Chromium/TypeScript/Vitest/Next/Docker를 로컬에서 재실행하지 않았으므로 **NOT TESTED**; 새로운 HEAD Full PR CI + Trusted QA의 결과가 나올 때까지 PASS 선언 금지. `release_required=true`, `release_authorized=false`, #866 Phase B/C 미완료, Main merge/GHCR/Issue close 금지. 원본 #3507.1/#3508.1 실패/취소 상태와 실패 원인 기록 유지.


### B008 최종 UI 실행 캡처

같은4ffddace... source의 부분A(66 PASS/기존2 SKIP)에서 실제 저장·3언어×5폭 및 기존 물류밀도 테스트가 만든 대표 화면이다. 캡처만으로 keyboard·CAS·권한 검증을 대체하지 않는다: [영어390px 마스터](evidence/issue-866/pr879-master-en-390.png), [물류 검색·표390px](evidence/issue-866/pr879-logistics-390.png). raw trace와 실제 실행 DB는 게시하지 않는다.


### B008 최종 검증·게시 인계

- 최종 code/test/config1283파일 SHA256 `4ffddace573d3504b165c2212fc52f1dc177e045df849ce3709479ce0e75d068`, 생성물 복구 뒤 종료 비교 변경0개. 같은 source에서 A13파일66PASS/기존2SKIP(5.1분), B2파일6PASS(5.7분), C1파일4PASS(3.2분), D1파일10PASS(4.6분): 중복 없는17파일88계획 = **86 PASS / 0 FAIL / 기존 캡처용2 SKIP**다. 테스트 자체 timeout/retry/skip/원격8샤드 정책 변경은 없다. 서버 재시작 중단12개 관측 PASS 및 이전15spec 결과를 이 합계에 더하지 않는다.
- 최종 전체 Vitest3541PASS/3기존SKIP(84.99초), 원본설정 TypeScript PASS, production build/runtime-tools PASS. 같은 ESLint 설정의 fresh-checkout 추적 JS/TS1118파일은 exit0/기존18warning/0error다. 자동Pre-PR 매핑은 BLOCKED로 남기며 수동 영향선정/실제 진단과 구분한다. 정제 증거 `docs/evidence/issue-866/pr879-local-validation-20261105.json`, 원본 명령·trace는 ignored `.prepr-reports/pr879-final/`에 보존한다.
- 별도 Agent 정적 사전검토 PASS는 인간 독립 QA/Owner ACCEPT가 아니다. HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false, manager_decision=NOT TESTED/MERGE_READY=BLOCKED 유지. 새 Head Quality/E2E/Docker·Trusted 결과는 NOT TESTED이며 CI 시작만 확인한다. Phase C·운영 백업복원·Main/GHCR/Release·Issue 종료는 수행하지 않는다.
- Git CLI의 만료된 인증을 추출·재설정하지 않고 허용된 Git Data API 배치 게시(B)를 사용한다. committed clean local tree와 API 전체 tree/부모를 대조하고, 원격 expected Head·main을 재조회한 뒤 Ref를 한 번만 갱신한다. 실제 candidate Head/새 Full Run·Attempt·base/test-merge 및 캡처 링크는 PR/Primary Issue STATUS 댓글에 후행 기록한다. PR 제목/본문 STATUS 편집으로 metadata CI를 추가하지 않는다.

## Phase C 통합 착수 — A+B Full #3520.1 baseline과 과거 전체 이력 (2026-11-05)

- 시작 exact Head `3fb37d77e6b4e80ee1daedf1642b6cfee1c2913b`, main/base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `69fb50e7f3cb12cc0074a1691c69321399eec427`. [Full #3520.1 / Run41979842028](https://github.com/planner77/masterGantt/actions/runs/41979842028) attempt1은 completed/SUCCESS, Required Quality127088871168/E2E127099090837/Docker127089918011 SUCCESS, Chromium8/8·871PASS/기존3SKIP, Vitest3541PASS/기존3SKIP다. [정제 원본 근거](evidence/issue-866/phasec-baseline-ci3520-20261105.json). Trusted artifact schema/provenance는 이 조회에서 NOT AUDITED이며 자동QA/Owner ACCEPT로 확대하지 않는다.
- 기존21회(#870 Full8·#878 3·#879 10)에 #3520 한 회를 추가한 관련 CI22회, 모두 attempt1. FULL-001/002·B001~008·구#870 직접실패와 fail-fast취소/미실행 원문은 보존한다. 새 Phase C source는 #3520의 PASS를 승계하지 않는다. 기존 실패17spec 합집합에 Phase C 직접·인접·음성 소비자를 추가해 동결 source에서 한정 회귀한다.
- 구#870의 국제화 hunk만 현재 #865/#869 Main 코드에 선택 이식했다. 버전0.142.0·기존12-owner 번역/권한/CAS·Copy/Template·Export손실가드, 관리UI B008 geometry/stale draft·technical Delete key, CI/QA/릴리스 정책을 보존한다. 위험HIGH/OWNER_MANAGED/qa_required=true, release_authorized=false다.

### C-LOCAL-001 — 신규 t 소비자와 과거 mock 계약 불일치

첫 전체 Vitest 진단은 3626PASS/1FAIL/기존3SKIP, `project-master-select-fields.test.ts`의 기존 useI18n mock이 locale만 반환하여 새 label `t()`에서 TypeError를 발생시켰다. 실제 Provider는 t를 제공한다. 테스트 mock을 실제 `translate(locale,key,params)` 계약에 연결하고 기존 세필드 표시명/동명code/원문fallback/ID 단언을 보존했다. 별도 부분검증에서4testsPASS, 최종전체재검증결과는 아래에 별도 기록한다. 실제제품권한/DB/선택값 문제로 분류하지 않는다.

### C-LOCAL-002 — 실제 Gantt 전환 기술검토·브라우저 fixture와 HMR 관측 분리

- 설치SVAR2.7.3 source-map에서 locale→storeConfig→init을 확인했다. 기술 사전검토의 두 P1(분리Milestone filter에 visibleTaskIds만 적용, user column width 초기화로 원래 lease가 무효화되어 복원중단)을 각각 membershipIds 및 native init 전 안정 custom columns의 현재 width/hidden/flexgrow 보존으로 수정했다. publicAPI/원래 lease/단일Coordinator 사용을 reviewer가 재확인했다. 같은 root/API만 확인하는 시험을 실제 상태 보존 시험으로 강화했다.
- 첫 신규 native E2E는 locale전환 **이전** latestTask DOM부재에서FAIL. Trace의 revision41 receipt=SETTLED/coreVisibleIds에latest90포함/deleted5부재를 확인했으며 fixture가 latest를 canonical배열 끝에push하여 virtual DOM화면밖에 배치한 TEST_FIXTURE 문제였다. 실제API의 hierarchy-order처럼 화면내위치에 삽입하고 Core receipt의 최신revision/추가/삭제 단언을 더했다. 기존 DOM/너비/스크롤/선택/DayWeek 단언은 유지했다.
- 개발 중 catalog 변경의 Next Fast Refresh full reload가 native locale 반복 도중 발생해 vi기대/ko관측 FAIL이 한 번 있었다. 해당 initScript는 새문서에서ko를 설정하므로 source변경 중 실행을 최종증거로 사용하지 않는다. 이후 제품/test/config를 동결하고 source지문 전후 비교로 전체선정묶음을 재실행한다. 테스트retry/timeout/skip·언어단언을 완화하지 않는다.
- 첫 draft E2E의 root작성 helper가 ko Edit를 편집으로 추측해 찾지 못한 TEST_CONTRACT도 기록한다. 실제 SVARko는 수정이며 설치사전/브라우저메뉴에 맞춰 helper와 직접소비자를 정확히 동기화했다. 원문 Task이름과 keyboard Delete는 변경하지 않았다.

### C-REVIEW — 동적 설명의 locale 고정 누락 보완

별도 읽기전용 inventory/qa_docs Agent가 완성한국어 문자열을 나중에t에 넣는 경로를 찾아 보완했다. Project상태·Task저장/후행작업 알림은 fixedkey+opaqueparameters/labels/segments, Plan상세/일정이동은 owner표시명·messageKey·period/trail descriptor를 현재locale에서 렌더한다. Chart metric·WBS고급조건·Resource scope/등록알림/role등급·Milestone horizon·ProcessDialog제목·Project날짜검증6종 및catalog누락을 보완했다. 사용자이름/ID/날짜입력·selection/filter/snapshot/알림ID·시각/read/timer를 유지한다. 최종 정적재검토는 P1/P2잔여0, catalog3442의 placeholder/literal key/인자누락0이다. Agent사전검토PASS는 독립인간QA/Owner판정이 아니다.

### C-LOCAL-003 — 실제 locale init의 column 정규화와 membership 복구 중단

첫 source동결 `7b033e04bd3be67da3d711efd5604eb0c70c9180772ed4acde80d8186f5516ab`에서 PartA는70PASS/2FAIL/기존2SKIP(74계획)이다. 직접실패 하나는 신규 native locale case의 en 전환 후 hidden Milestone4 DOM부활이다. locale전revision40/41의 logical/Core/DOM 모두M4부재였고, 전환후receipt generation은멈췄다. 좁은 DEV 계측의 stamp는 epoch1/gesture5/intent6 그대로이나 columns의 hidden=false→undefined 및 projectStart flex width104→1로 달라져 `current()`의 원래strictsource가 queue시작을 거부한 것을 확인했다. 정적 prepareColumns 참조유지 확인만으로 실제init정규화까지 보존된다고 결론낸 초기 가설을 기각한다.

보완은 전역 validSource/Coordinator·사용자의새gesture보호를 변경하지 않는다. 같은 API/projection/capture 및 epoch/gesture/intent/columns외context가정확히같을 때만 초기public set-columns/resize-grid를허용하고, 즉시원래strictlease로돌아가 filter/open/selection/viewport를보호한다. 기존coordinator Unit에 열변경만허용/새gesture·intent·epoch·다른context변경차단11건을추가했다. DEV계측은원인확정후제거했다. 후속 i18n6+workspaceko/en2=8case actualPASS(39.6초), native6locale(Day/Week각en/vi/ko)에서M행부재·열/split/scroll/선택/summary·최신추가/삭제row·instance/write0을검증했다. 최종전체선정묶음은 추가보완뒤다시동결실행한다.

두번째 PartA실패는en-US workspace가프로젝트설정버튼을한국어로기대한TEST_CONTRACT다. 설정/보안/편집탭/저장·비밀번호변경까지같은variant의고정문구를ko/en정확값으로전수동기화하고원래geometry/focus/instance/date단언을유지했다. 별도146spec정적교차는project-transfer-layout-491의공수두곳(999999.99→999,999.99 및50000.00→50,000.00)을추가로확인했다. 수치계산변경이아닌Intl표시계약에맞게기대값만갱신한다. 원래70PASS/2FAIL은새결과로소급변경하지않는다.

추가설계검토에서oldviewportlease취소시에도canonicalmembership는최신이어야함을확인했다. 새controller없이기존membershipfilter effect가locale전환에서도동일queue와API/revision/projection guard로재검사하도록연결하고, 이미정합하면no-op한다. layout capture가무효화한observation도현재semantic source에귀속해확보한다. 이효과가새gesture의과거viewport복원을허용하지는않는다.

### C-LOCAL-004 — 늦은 SVAR 폰트와 Workspace geometry baseline

두번째 동결 `ac9628a45d4aebaaa615bb0f0f13cda20799a0cd1718314c126623fe37ee6178`의 PartA는71PASS/1FAIL/기존2SKIP(74계획)이다. 신규 native locale/빈 검색음성은PASS였고 en-US workspace의Dialog 전후 exact geometry만FAIL했다. Trace에서Roboto요청328574.974/328840.549ms→329415.523완료, baseline329451~329477의search toolbar2줄→329534 screenshot1줄로27.5px감소, Modal표시329759보다앞선재배치를확인했다. localeen/Projectheader/APIinstance/canonicaldata는같아Dialog가underlay를밀어낸제품결함가설은기각한다. SVAR가등록한외부Roboto와bodyfontfallback교체가baseline측정과겹친TEST_READINESS다.

기존spec에 document.fonts.ready 및 기존 waitForGanttReadiness의revision1/scale/day/60canonicalID/실제Core/DOM/geometry전제를확인한뒤원래baseline을측정하도록연결했다. 공용readiness queryobserver는한국어aria-label대신동일검색input의안정HTMLselector를사용해en/vi에서도실제query를관측한다. 기존exact geometry equality·Focus/Instance/date·허용오차·timeout/retry는유지한다. 다른helper소비자와기존Unit/인접Milestone/Resource/Gantt를최종동결 source에서재검증한다.

화면캡처직접검토에서기존PhaseA core사전3개가베트남어에서제품용어Milestone을mốc로바꾼것도확인했다. Timeline미리보기/연결/데모설명세항목만Milestone을보존하도록교정하고관련Unit을추가했다. 다른anchor의일반단어mốc나사용자원문은일괄치환하지않는다. 사전우선순위/기존공통key의다른의미는변경하지않는다. 최종source는새지문을고정하여앞선관측을재사용합산하지않는다.

### C-LOCAL-005 — 비신뢰 500 원문 기대와 테스트 응답 순서

최종 전체선정 C8파일74사례는73PASS/1FAIL(19.4분)이다. project-transfer-layout-491의 템플릿 저장 테스트는 CONTROLLED_UI_ERROR/HTTP500의 임의 message `통제된 검증 오류`를 그대로 기대했지만 safeApiError는 승인된 메시지/코드 외에는 caller context `템플릿을 저장하지 못했습니다.`를 표시한다. 신뢰되지 않은500을 원문노출시키거나 테스트용메시지를제품사전에추가하지 않고 테스트를 이 경계에 맞췄다. 실제status500·정확한contextfallback·원문부재·이름/설명초안 보존을 검증하고 기존pending/401/412/실제201·focus/source보존 단언을 유지했다.

첫 테스트보완은 gate.release 직후status를 동기적으로 읽어 expected500/undefined FAIL(7PASS/1FAIL)을 만들었다. 실제 route handler의 await 재개보다 앞선 TEST_READINESS이며, 오류 화면의 응답처리완료를 await한 뒤status를 검사하도록 순서를 수정했다. 제품·공용fixture·helper는 변경하지 않았다. 최종 동일한 전송파일 전체8사례 PASS이며 이전7PASS/1FAIL을 중복합산하지 않는다. 제품/공용입력과 나머지24spec는1316파일 byte동일성을 확인하여 소비별 최종입력 근거를 남겼다. 전체지문이 처음과같다는 주장은 하지 않는다.

### Phase C 최종 검증·게시 인계 (2026-11-05)

- 최종 게시 code/test/config1317파일 SHA256 `186f48255deb484699c2fc4e0233be11fc798596d4e0e35f9a73d7239d437ca4`. 전체 실행 묶음의 최초 지문은 `10a1794407eb3d2a10ae784c8908c35095153a206d92159df3408dac26ecd811`이며 **전체 지문이 시작과 같다고 주장하지 않는다**. 마지막 차이는 `project-transfer-layout-491.spec.ts` 한 파일의 unknown500 oracle/검증 순서뿐이다. 나머지1316파일(제품·공용fixture/helper/config·Unit·다른24spec)은 바이트가 동일하고, 수정spec은 최종파일 전체8사례를 재실행했다. 다른spec이 이 모듈을 import하지 않는 것도 확인했다. 소비 입력 동일성 지문과 각 실행 명령·source/결과는 [정제 증거](evidence/issue-866/phasec-local-validation-20261105.json)에 보존한다.
- 고유 Chromium25파일158계획 = **156 PASS / 0 FAIL / 기존2 SKIP**. A14파일72PASS/2기존SKIP, B3파일10PASS, C의 변경 없는7파일66PASS와 수정 전송파일8PASS다. 원래 C73PASS/1FAIL 및 중간 전송7PASS/1FAIL은 원장에 보존하고 이 합계에 더하지 않는다. workers1/retries0/max-failures0, 각 묶음20분/수정파일10분 상한을 유지했다.
- 전체 Vitest **3658PASS/기존3SKIP**, 297filesPASS/1기존SKIP(145.67초). 최종 차이는 Unit에서 실행하지 않는 별도E2E assert뿐이고 제품·Unit/공용입력은 동일하다. 수정파일의 typecheck/lint/discovery를 별도 재검증했다. 원본 Next 설정으로 typecheck PASS, production build/runtime-tools PASS. 같은 ESLint설정1124개JS/TS대상0errors/기존18warnings+ignored파일안내1, 마지막수정파일lint PASS. 버전·테스트탐색(298Unit파일/880브라우저사례)·문서링크·CIcache계약·QAfixture11PASS.
- 자동 `verify:prepr --mode=fast`는 UNKNOWN94/missing0으로 **BLOCKED**를 유지한다. 이 보고서의 실행중sourceStable=true는 자동도구의 짧은 실행 구간에 한정하며 전체E2E 지문변경을 숨기는 근거가 아니다. 실제 수동 소비자 매핑·실행·입력동일성 증거와 자동선정PASS를 구별한다. 최종 `.prepr-reports/phasec/prepr-final/report.json` 및 SUMMARY를 별도 보존한다.
- 별도Agent 정적 기술 사전검토 PASS/남은P1·P2=0이며 독립인간QA/OwnerACCEPT가 아니다. 새Head Required3/Trusted·Manager판정은 NOT TESTED, MERGE_READY=BLOCKED, #866OPEN/release_authorized=false. Main/GHCR/Release·운영backup/restore·WindowsExcel·실제AT/native125%·최종수동UX는 미실행이다. Equipment/System 번역입력 omission/clear/stale의 전용브라우저 조합은 별도 미실행이며 공용helper/12-owner HTTP·SQLite/기존CRUD 결과와 구별한다.
- 실제 UI 캡처: [베트남어Gantt](evidence/issue-866/phasec-gantt-vi.png), [베트남어390px관리자](evidence/issue-866/phasec-master-vi-390.png). 캡처는 keyboard/CAS/상태보존 실행증거를 대체하지 않는다. root 기본worktree의 사용자 deploy/compose/output 변경은 건드리지 않았다. 현재worktree의 테스트 생성물만 별도보존 후 원본으로 복구했다.
- CLI write 인증 만료를 우회·재설정하지 않고 허용된 Git Data API의 blob/tree/commit 및 expectedHead3fb37d77e6b4e80ee1daedf1642b6cfee1c2913b lease로 한 번 게시한다. clean committed local tree와 API 전체tree/부모·최신main을 대조한 뒤 Ref를 갱신한다. 실제 candidateHead/base/test-merge/FullRun·Attempt는 PR/PrimaryIssue STATUS 댓글에 후행기록한다. 실제 PhaseC 통합 범위로 PR제목/본문은 한 번 교정하며 상태표시를 위한 반복편집은 하지 않는다.
