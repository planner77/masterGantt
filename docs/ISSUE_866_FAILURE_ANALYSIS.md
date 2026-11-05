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

## PR #879 REWORK-C001 — Full #3522.1 번역된 유형 필터 접근성 이름 계약 (2026-11-05)

### A. 원본 출처와 전 샤드 결과

[Full #3522.1 / Run42003998824](https://github.com/planner77/masterGantt/actions/runs/42003998824), attempt1/pull_request, Head `2844e0f7d78c7268057d89514a2db0239498dcb0`, main/base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `31bce4daaccab57d15f5ccbeb1d8b4fd2b70c7de`(원본 changes Job127166039851)에서 FAIL했다. 실제 Quality127168147571·Docker127169521292 및 Preflight/Policy/ESLint/TypeScript/Unit3658PASS·기존3SKIP/Next build는 SUCCESS다. 직접 FAIL은 Shard8 Job127167485478/step7 E2E shard 실행, `milestone-visibility.spec.ts:121`의legacy native M selection, assertion129 `getByRole(group,Task type).getByRole(checkbox,task).check()` 30000ms timeout이다. 이 앞의native Task+Milestone 선택/app선택Task-only 검사는통과했다.

모든8샤드 원본로그 및 Shard8 report13404716878/timing13403829224를직접회수했다. 전체880계획=269관측PASS+1직접FAIL+기존SKIP1+미완료609다. 취소7샤드에추가✘/locator/expect오류는없지만관측PASS를완료SUCCESS로보지않는다.

| Shard / Job | 원본결론 | 계획 | 관측PASS | 직접FAIL | 기존SKIP | 잔여 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 / 127167486055 | CANCELLED | 129 | 51 | 0 | 0 | 78 INTERRUPTED_OR_NOT_RUN |
| 2 / 127167485306 | CANCELLED | 104 | 15 | 0 | 0 | 89 INTERRUPTED_OR_NOT_RUN |
| 3 / 127167485386 | CANCELLED | 153 | 57 | 0 | 1 | 95 INTERRUPTED_OR_NOT_RUN |
| 4 / 127167485367 | CANCELLED | 94 | 16 | 0 | 0 | 78 INTERRUPTED_OR_NOT_RUN |
| 5 / 127167485511 | CANCELLED | 111 | 29 | 0 | 0 | 82 INTERRUPTED_OR_NOT_RUN |
| 6 / 127167485372 | CANCELLED | 100 | 36 | 0 | 0 | 64 INTERRUPTED_OR_NOT_RUN |
| 7 / 127167485544 | CANCELLED | 79 | 31 | 0 | 0 | 48 INTERRUPTED_OR_NOT_RUN |
| 8 / 127167485478 | FAILURE | 110 | 34 | 1 | 0 | 75 DID_NOT_RUN |

Shard3의SKIP1은기존logistics-table-density:41 before캡처용이다. Shard8의별도오류1건은HTML의 `Testing stopped early after 1 maximum allowed failures.`로같은fail-fast중단안내이며두번째제품FAIL이아니다. RequiredE2E127172325806·AutomatedQA127172368630 FAILURE는직접실패의파생이다. 원본FAILED/취소/미실행은그대로보존한다.

### B. 전체 이력과 metadata 귀속

PR8708회+8783회+87913회=CI24회(Full21/metadata3), 전attempt1을branch목록총량16/6/23과per_page100으로대조했다. 별도FAST21개는모두SKIPPED이며Required근거가아니다. 기존 22회(#3520까지, Full20/metadata2)의 상세는 누적 원장/정제 근거를 사용했고, 이번에는 새 #3522 전8샤드/changes/unit과 #3521 Automated 원문 로그를 직접 수집했다. [전체 실행 목록](evidence/issue-866/ci3522-history-20261105.json), [정제 실패 매트릭스](evidence/issue-866/ci3522-failure-matrix-20261105.json).

#3521.1 Run42003913316은oldHead3fb37d77e6b4e80ee1daedf1642b6cfee1c2913b의edited METADATA_ONLY이며Required3는SUCCESS지만Automated127166090392가 `PR latest Head stale`로BLOCKED/FAIL했다. 현재Head로이동해SUPERSEDED/N/A이며원본FAIL은유지한다. 새제품오류로합산하지않고낡은event를새HeadPASS로재사용하지않는다. #3509/#3520의성공도각원본Head에만유효하다.

### C. 현상 재현과 원인별 보완

수정전동일Head에서 `npx playwright test --config tests/config/playwright.config.ts tests/e2e/milestone-visibility.spec.ts --grep 'legacy native M selection' --workers=1 --retries=0 --max-failures=0`으로같은30.2초timeout을재현했다. 가설우선순위는낡은접근성이름→필터창준비상태→legacy M 선택정리경로였다. 원격/로컬snapshot에는정상필터창의 `작업 유형`/`일반 작업`이있고정리직전선택도정상이어서첫가설을확정했다. 제품코드오류/권한/DB/canonical소실근거는없다. 분류TEST_CONTRACT다.

PhaseC는rawenum task/summary를저장하면서UI는 `t(작업 유형)` 및 `t(일반 작업/요약 작업)`로표시한다. `Task type/task`를UI접근성이름으로고정한소비자가남았다. 별도qa_docs가146spec의영어role/label/placeholder/text를교차대조해같은유형필터5곳/4spec과Resource관리자positiveheading1곳을확인했다.

- `milestone-visibility.spec.ts`, `project-task-quick-view.spec.ts`의두경로, `milestone-timeline-lane.spec.ts`, `milestone-stage-grid.spec.ts`: 정확한ko접근성이름으로교정. rawenum/API값/userTask명/keyboard는변경하지않는다.
- `resource-admin-layout.spec.ts:112`: positive `Global catalog`조회는현재ko의 `전역 카탈로그`로교정한다. `Catalog Revision`부재음성과원래geometry/가로폭단언은유지한다.
- 기존legacy선택회귀를ko/en/vi3언어로확장한다. 두정확checkbox/summary미선택/일반Task선택, native M+Task→Task-only/app선택, fullcanonicalIDs/counts/links·원본project/tasks/links bytes·같은API/DOMinstance·mutation0을확인한다. 수정후직접3사례PASS13.2초다. 이단독green을아래동결확대검증에중복합산하지않는다.

과거FULL-002의native헤더·PhaseC Edit/Workspace와같은현지화표시소비자누락유형이며 B00820px/번역옵션/경합·TS/migration/DOC_SYNC·구870HTTP와직접인과는구별한다. 최신한파일만재실행하지않고기존실패17spec+새5소비자+native i18n·인접메뉴/전송을선정하여한정묶음으로검증한다. 제품·DB/API·의존성/버전·CI/QA/8shard/timeout/retry/skip·기존허용오차는변경하지않는다.

### D. 최종 동결 검증과 게시 경계

최종 source `55c4fbc65ebe9414efa2a608dc3362566a2d5661ef4d1b50465fdb91a2556e97`(code/test/config 등1317파일)는 시작/종료 bytes가 같다. workers1/retries0/max-failures0, A13/B4/C7 각20분·D1 10분 상한의 수동 CLI에서 **25고유spec/155계획=153PASS+기존2SKIP/FAIL0**이다. A66PASS/기존2SKIP+B20PASS+C59PASS+D8PASS이며, 최초 RED와 직접3언어 green·이전 Head 결과는 중복 가산하지 않았다. 기존2SKIP은 `logistics-table-density.spec.ts:41`(#454 before) 및 `master-controls-density.spec.ts:30`(#455 before)의 캡처용이다. #752 Actions 진단workflow의 자동24spec 상한은 변경하지 않았다. [최종 실행·명령·범위·지문 증거](evidence/issue-866/ci3522-local-validation-20261105.json)를 참조한다.

관련9파일 Unit197PASS(2.22초), 원본 Next설정 복구 후 `npx tsc --noEmit --incremental false` PASS, 수정5spec 동일ESLint PASS, 테스트탐색298Unit파일/882브라우저사례·버전0.142.0·CIcache계약·Markdown410파일 연결검사·main버전 docs_gate/AC01~09 구조검사는 PASS다. DOC_SYNC의 구조 성공은 인간QA/업무 의미 검토의 PASS가 아니다. 제품/DB/Unit/공용설정·의존성/빌드/Docker 입력은 시작 Head와 동일해서 전체 Vitest/build/Docker를 로컬 중복 실행하지 않았다. 원본 #3522의3658Unit/기존3SKIP·build/Docker 성공은 원본 Head에만 귀속하며 새 원격 Required 결과로 승계하지 않는다.

자동 `verify:prepr --mode=fast`는 **UNKNOWN94/missing0/BLOCKED**, 실행 중 sourceStable=true다. 수동 선정·실제 실행은 별도 증거이며 자동 매핑 공백을 PASS로 바꾸지 않는다. 최종 `.prepr-reports/ci3522/prepr-publish-final/report.json`/SUMMARY를 보존한다. 로컬 생성물은 현재 worktree의 것만 ignored 보고서에 옮기고 원본 bytes로 복구했으며, 기본 worktree의 사용자 deploy/compose/output 변경은 건드리지 않았다.

별도 qa_docs 정적 기술검토 PASS/남은P1·P2=0, 미해결 리뷰스레드0(기존 물류유형 스레드 resolved/outdated), 최신 main과 충돌없음을 확인했다. 새 Head Required quality/e2e/docker·Trusted QA/독립인간QA/Owner·Manager는 NOT TESTED, MERGE_READY=BLOCKED, HIGH/OWNER_MANAGED/qa_required=true 및 release_authorized=false/#866OPEN을 유지한다. WindowsExcel/운영 backup-restore/실제AT/native125%/최종수동UX·Main/GHCR/Release는 미실행이다.

코드·테스트·문서·원장을 committed clean source로 준비하고 API 전체tree/부모·최신main/expected Head를 대조한 뒤 Ref 한 번으로 게시한다. 기존 PR제목/본문의 실제 Phase A+B+C 범위는 유지하고 상태표시용 metadata-only CI를 추가하지 않는다. 실제 게시 Head/base/test-merge/FullRun·Attempt는 PR #879와 Issue #866 STATUS 댓글에 기록하며, 새 CI 시작 확인 뒤 결과를 모니터링하지 않는다.

## PR #879 REWORK-C002 — Full #3523.1 Issue 오류와 취소 샤드의 Project 근거 표시 (2026-11-05)

### A. 원본 출처·전 실행 이력

[Full #3523.1 / Run42012950520](https://github.com/planner77/masterGantt/actions/runs/42012950520), attempt1/pull_request/FINAL_FULL은 Head `c9a19bff307d5d889a1d353a674d9d5fb7d96da7`, base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `460fc993ff2d9ce6d36ee9d7b56c61f00d278d76`에서 FAILURE다. changes Job127196290738의 원문87행 artifact 업로드(10:42:41.768Z)→192행 checkout(10:42:52.684Z),1590~1592행3SHA와checkout전artifact13407856994/runattempt1·단일commit→PR879·불변merge부모를후행직접대조했다. 초기Manager확인표현은current PR/지난게시근거를과대해석한것이라새[원본출처증명](evidence/issue-866/ci3523-source-proof-20261105.json)으로정정·보강한다. 출처구조PASS는Trusted QA/승인PASS가아니다. Required Quality127198348483/Docker127199924536 SUCCESS, E2E127205496354·Automated127205539951 FAILURE는 아래 직접 실패의 파생이다. 실제 Unit127196660485는3658PASS/기존3SKIP(297filesPASS/1기존SKIP,98.00초), Build127197822093 SUCCESS다. 이것은 원본 Head의 결과이며 새 Head로 승계하지 않는다.

원장 전체·기존 correction/evidence·PR 대화를 읽고 PR #870/#878/#879의 branch 전체 목록을 재조회했다. CI25회=Full22+metadata3, 전attempt1이며 별도FAST22회는 전SKIPPED다. 전체 workflow47개가 branch total_count16/6/25의 첫100개 페이지에 모두 포함된다. 기존24회 상세는 누적 원장/ci3522 정제 근거를 사용하고, 이번에는 새3523 전8shard 원문/Unit 및report2·timing2·timing5를 직접 회수했다. 과거 모든 raw 로그를 다시 내려받았다는 의미는 아니다. [전체 실행 목록](evidence/issue-866/ci3523-history-20261105.json), [정제 원격 매트릭스](evidence/issue-866/ci3523-failure-matrix-20261105.json).

| Shard / Job | 원격결론 | 계획 | 관측PASS | 직접FAIL | 기존SKIP | 잔여 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 / 127197822331 | CANCELLED | 129 | 56 | 0 | 0 | 73 INTERRUPTED_OR_NOT_RUN |
| 2 / 127197822214 | FAILURE | 104 | 30 | 1 | 0 | 73 DID_NOT_RUN |
| 3 / 127197822199 | CANCELLED | 153 | 82 | 0 | 1 | 70 INTERRUPTED_OR_NOT_RUN |
| 4 / 127197822255 | CANCELLED | 94 | 40 | 0 | 0 | 54 INTERRUPTED_OR_NOT_RUN |
| 5 / 127197822412 | CANCELLED | 111 | 33 | 1 | 0 | 77 DID_NOT_RUN |
| 6 / 127197822372 | CANCELLED | 100 | 52 | 0 | 1 | 47 INTERRUPTED_OR_NOT_RUN |
| 7 / 127197822376 | CANCELLED | 79 | 79 | 0 | 0 | 0 NONE_TEST_COMMAND_COMPLETED |
| 8 / 127197822217 | CANCELLED | 112 | 82 | 0 | 0 | 30 INTERRUPTED_OR_NOT_RUN |

전체882계획=454관측PASS+직접FAIL2+기존SKIP2+미완료424다. Shard2/5의150은명시DID_NOT_RUN, 나머지274는중단/미실행을구별하지못한다. Shard7은테스트명령79PASS로끝났지만후속job은CANCELLED이므로jobSUCCESS가아니다. 기존SKIP은logistics-table-density:41/master-controls-density:30의before캡처다. Shard2report의별1error는 `Testing stopped early after 1 maximum allowed failures.` 로같은fail-fast안내다. 취소Shard5report미업로드결손은원문assert/timing failed로보조하며성공으로채우지않는다.

### B. 두 직접 실패와 재현

- Shard2 Job127197822214/step7, `project-issues.spec.ts:7` case/assert158. 잘못된Issue암호의PATCH401뒤영어 `password` 를기대했으나실제는 `Issue 비밀번호를 확인해 주세요.` 다. 5000ms/case9.0초,11:01:38.4864880Z. Issue전용 `projectIssueError` 는code allowlist로 `ISSUE_PASSWORD_INVALID` 를고정안내로변환하며backend raw message를읽지않는다. 정상안전표시에대한TEST_CONTRACT누락이다.
- CANCELLED Shard5 Job127197822412/step7, `issue-736-resource-dashboard.spec.ts:372` #809 chart/assert421. Project부하schedule gateway뒤 `Project 전체 부하 근거` 를기대했으나 `공동 담당 인력 · 개인/Project 전체 참고 · 현재 기간 · 고유 Task 2 · Assignment 2 · 조상 문맥 1…` 만표시됐다. 5000ms/case42.6초,11:02:21.9053422Z. PRODUCT/PRESENTATION의미회귀로확정했다.

최초 grep를 full title 앞에 고정한 좁은 명령은 No tests found/NOT RUN이었다. 원본source에서 다음 교정 명령을 실제 실행해 두 원격 증상을 그대로 재현했다(2FAIL, retries0/max-failures0). `.prepr-reports/ci3523/red-actual.log`에 보존하며 실패를 숨기지 않는다.

```sh
npx playwright test --config tests/config/playwright.config.ts tests/e2e/project-issues.spec.ts tests/e2e/issue-736-resource-dashboard.spec.ts --grep '#838-#840 Issue tab:|#809 차트3유형' --workers=1 --retries=0 --max-failures=0
```

가설 우선순위는 Issue의 오래된 raw오류 UI 기대, Resource descriptor가 기존Project근거 wrapper를 가리는 분기, 비동기 준비 상태였다. 원본·로컬에서 같은 최종문구가5000ms 유지됐고 Project scope HTTP200/target=plan/demandScope=project/Task2·Assignment2 및 선택 밖 Task 포함·선행Load80/140 단언이 확인돼 readiness나 데이터 범위 소실 가설은 지지되지 않았다. trace는 실행하지 않고 읽기 전용으로 파싱했다. 실패 뒤 outside-row/focus는 원본에서 미실행이므로 새실행으로 검증한다.

### C. 설계·구현 및 과거 실패와의 관계

Issue는 API raw code/message/password 및 키보드를 그대로 두고 UI만 정확ko 안내로 교정한다. 같은 열린401오류에서EN→VI→KO의 정확 안내·raw 전체문자열과 불일치·초안/record/revision 보존·추가PATCH0을 검증한다. 정상암호 재시도에서는 같은 If-Match와 revision+1·정확 업무상태 갱신·dialog close를 확인한다. EN 정상 안내에도password가 포함되므로 공통 substring 금지로 정상 문구를 차단하지 않는다. 전체 긴case를3개로 복제하지 않는다.

Resource는 `request.planLabel` 우선분기가 기존 `projection.target===plan && demandScope===project`의wrapper를 건너뛴 제품 결함이다. 표시 전용pure module `project-resource-navigation-label.ts`로 기존 renderer/type을 옮기고, host가 검증된projection에서만 `projectEvidence`를 만든다. 현재locale의Plan inner 설명을 기존 `Project 전체 부하 근거 · {label}` key로 감싼다. `presentation.projectReference`를 권한/범위 근거로 삼지 않으며 기존verified gateway/Task·AssignmentID·subset·lease·revision·조상 문맥은 그대로다. 기존421의원래기대는 유지한다. 집중8Unit은3언어wrapper+inner/owner원문·관리형표시명/날짜·descriptor불변/selected범위wrapper부재와opaque fallback을 검증한다. 브라우저는정확Project/selected범위·Task와Summary문맥·80/140·outsideTask·filter/focus복귀를 보강한다.

별도오류소비자감사는146spec의 UI text matcher 전체와 fixture error.message 연결을 대조했다. 동일한 낡은 raw오류양성은Issue158 한곳이다. API응답의code/message 검증, known-domain 상세·country/year·401/412/STALE 음성은 일괄변경하지 않는다. #3522는role/label/heading 범위의 감사였으며 오류payload를UI에서기대하는연결까지전부완료했다는근거는없었다. 이번감사범위를넓힌다.

#3508 native header/#3522 Task type군과 Issue 오류는 표시소비자누락이라는 공통점이 있으나, Resource는새descriptor가업무범위의구별표시를지운제품회귀로분리한다. B008밀도/번역선택기/stale·TS/migration/DOC_SYNC·구#870HTTP/technicalDelete 이력은 유지한다. 이전25spec에 신규직접2+Resource drill/WBS간접2를 더한29고유spec를선정한다.

### D. 중간 진단과 동결 계획

첫보완 green 시도는Issue1PASS/Resource1FAIL이었다. Resource 원래prefix단언은통과했지만 추가exact logicalVisibleIds가Summary조상을누락했다. 정확scope의Task2/Assignment2와logicaltree의Summary문맥1을구별해기대값을고쳤다. 원래단언을삭제하거나범위를느슨하게하지않는다. 구현Agent가브라우저동작중별도typecheck에서TS6053(정리중인isolated생성types경로)을보고했지만원문로그미회수라source컴파일결함으로확정하지않는다. 이진단을PASS로재사용하지않고마지막root원본설정typecheck로별도판정한다. 해당실행도중 구현Agent가동결해제승인없이E2E만수정했으므로 시작f7a2dd3f5f3259bbe6c396ac42645b9c3a008471c78c44c911193bb9a7f5670c의결과는최종증거에서제외한다. 실패후capture의file stream/zip 오류2개도같은진단에보존하고제품직접실패로추정하지않는다.

최종후보source `eaa90be1bb19d08db2091017caf61e45e4bc52d2bf8ba0f3a45c370f1640d99b`/1319파일로다시동결한다. 수동CLI29spec/5parts(E4+A13+B4+C7+D1), workers1/retries0/max-failures0/각20분상한이다. #752 Actions진단24spec/4parts 정책을바꾸거나workflow를실행하지않는다. 최종전체Vitest/type/lint/build 및동일source교차결과는실행후후행기록하며현재NOT TESTED다. 이전Head·중간실행PASS는최종합계에가산하지않는다.

### E. 별도 오류 원문 경계 관찰 — DEFERRED

qa_docs/backend의읽기전용감사에서 국가캘린더 `serverMessage→t(line)`와 WBS `error.message→t(error)`가서버문자열을사전key로해석할수있음을확인했다. unknown code+message가`저장`이면EN의Save로해석되는반례이며, XSS/권한우회의근거는아니다. 공용safeApiError의전체catalog 포함검사도같은경계가있다. 이관찰은이번CI의두직접실패와인과가없고기존API의국가/연도·field/row detail 및STALE 안내보존을함께설계해야한다. 임의로generic화해기존양성검증을지우거나오류구조를이번두회귀수정에섞지않는다. 코드변경은DEFERRED이며후속안전한code/context allowlist·trusted-key/opaque-detail분리와unknown충돌/known안내/상세보존/locale반응/409복구의별도회귀가필요하다. 전체P1/P2가0이라고주장하지않는다. Owner/Manager승인과MERGE_READY를올리지않는다.

### F. 최종 동결 검증·리뷰·게시 경계

최종 source `eaa90be1bb19d08db2091017caf61e45e4bc52d2bf8ba0f3a45c370f1640d99b`/1319파일의 시작/종료 입력 map이 같다. Next자동생성2파일(next-env.d.ts/tsconfig.json)은지문계산에서시작Head원문으로정규화했고, 종료후실제파일도원본bytes로복구했다. 수동29고유spec/176계획은 **174PASS/기존2SKIP/FAIL0**(E21+A66+B20+C59+D8)이다. E4+A13+B4+C7+D1 각20분, workers1/retries0/max-failures0이며 중간RED/STALE green/이전Head를 중복 가산하지 않았다. 기존SKIP2는 logistics-table-density:41 및 master-controls-density:30의 before캡처다. 구 production-transport는 별도 production HTTP/HTTPS 환경의 검증이며 이번 표시수정으로 인증/전송계약을 바꾸지 않아 기존 원격 Docker/별도환경 경계로 유지했다. 이 로컬 결과는 새 Head Required3를 대체하지 않는다.

전체Vitest3666PASS/기존3SKIP(298filesPASS/1기존SKIP,227.28초/exit0), 수정5JS/TS파일ESLint0errors/기존router경고1, production build/standalone준비/runtime-tools 및 원본Next설정 복구 후typecheck는PASS다. 탐색299Unit파일/882browser, 버전0.142.0/CIcache·Markdown410파일·main동일validator docs_gate/AC01~09 구조도PASS다. DOC_SYNC 구조검사는 의미QA/Owner결정을 대신하지 않는다. 생성물은 현재worktree에서 만든 것만 ignored 보고서로 보존·원본복구했고 기본worktree 사용자deploy/compose/output 변경은건드리지않았다.

자동Pre-PR는 **UNKNOWN94/missing0/BLOCKED/sourceStable=true**를 유지한다. 수동소비자선정/실제실행과자동선정공백은별도이며PASS로바꾸지않는다. 최종보고서/SUMMARY `.prepr-reports/ci3523/prepr-publish-final/`, [정제 명령·범위·지문·결과](evidence/issue-866/ci3523-local-validation-20261105.json)를 참조한다.

직접2회귀보완의 별도Agent기술검토PASS/새P1·P2=0, GitHub미해결리뷰스레드0/충돌없음을 확인했다. **별도오류원문경계P2는 E절의DEFERRED**이며 전역P1/P2가0이라는 주장은하지않는다. 새Head quality/e2e/docker·Trusted·독립인간QA·Owner/Manager는NOT TESTED, HIGH/OWNER_MANAGED/qa_required=true/MERGE_READY BLOCKED/release_authorized=false/#866OPEN을 유지한다. 실제AT/native125%/WindowsExcel/운영 backup-restore/Main/GHCR/Release·병합·Issue종료는 미실행이다.

Committed clean source의 로컬 전체tree/API 전체tree·부모·최신main·expected Head를 게시 전후 대조하고 Ref를 한 번만 갱신한다. 기존 Phase A+B+C PR metadata는 반복 편집하지 않는다. 실제게시 Head/base/test-merge/FullRun·Attempt는 PR #879와 Issue #866 STATUS에 후행기록하며 새Full CI 시작 확인 뒤 모니터링하지 않는다.

[Project 전체 부하 근거 실제 한국어 화면](evidence/issue-866/ci3523-project-load-evidence-ko.png)은로컬working sourceeaa90be1bb19d08db2091017caf61e45e4bc52d2bf8ba0f3a45c370f1640d99b의보완을보여준다. 고유29spec/174PASS와별도로기존차트case를한번더실행해캡처했으며중복합산하지않았다. 보조캡처의첫시도는임시config의상대reporter경로오류로NOT RUN이었고, 해당로컬경로를교정한실제1casePASS를사용했다. 새Head원격CI/독립QA증거가아니다.

## PR #879 REWORK-C003 — Full #3524.1 실제 재시작 준비와 영속성 검증 예산 분리 (2026-11-05)

### A. 전체 이력과 원본 실패

[Full #3524.1 / Run42035505119](https://github.com/planner77/masterGantt/actions/runs/42035505119), attempt1/pull_request/FINAL_FULL은 Head `0323caf8c8b9319cd85606815a47eea2fdee34eb`, base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `25d42c6a38bc85d364f98627897f2d1f430106de`에서 FAILURE다. 누적 원장 전체와 PR #870/#878/#879의 CI26회(Full23+metadata3, 전 attempt1), 별도 FAST23회(SKIPPED), 전체 workflow49개를 대조했다. branch total_count16/6/27은 첫100개 페이지에 모두 포함된다. 과거 모든 raw 로그를 이번에 재다운로드했다는 뜻은 아니다. [전체 목록](evidence/issue-866/ci3524-history-20261105.json), [원격 매트릭스](evidence/issue-866/ci3524-failure-matrix-20261105.json), [원본 출처](evidence/issue-866/ci3524-source-proof-20261105.json)를 참조한다.

changes Job127272491154의 checkout 전 artifact13417139286 업로드13:24:47.385Z(87행)→checkout13:25:05.275Z(217행)→1643~1645행3SHA, artifact 스키마/repository/run/attempt/branch·불변 merge부모·단일commit→PR879를 읽기 전용 대조했다. PR artifact는 비신뢰 자료이며 단독 근거가 아니다. 출처 PASS는 Trusted QA/Owner 승인 PASS가 아니다. Quality127274745365/Docker127276326391 SUCCESS, E2E127277339993/Automated127277395441 FAILURE다. 원본 Unit127272935250은3666PASS/기존3SKIP(298filesPASS/1기존SKIP,59.69초), Build127273965222·실제Docker127273965765 SUCCESS이며 원본 Head에만 귀속한다.

| Shard / Job | 결론 | 계획 | 관측PASS | 직접FAIL | 기존SKIP | 미완료 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 / 127273965490 | CANCELLED | 129 | 40 | 0 | 0 | 89 |
| 2 / 127273965640 | CANCELLED | 104 | 12 | 0 | 0 | 92 |
| 3 / 127273965457 | CANCELLED | 153 | 50 | 0 | 1 | 102 |
| 4 / 127273965314 | CANCELLED | 94 | 9 | 0 | 0 | 85 |
| 5 / 127273965444 | CANCELLED | 111 | 22 | 0 | 0 | 89 |
| 6 / 127273965395 | CANCELLED | 100 | 31 | 0 | 0 | 69 |
| 7 / 127273965580 | FAILURE | 79 | 20 | 1 | 0 | 58 |
| 8 / 127273965753 | CANCELLED | 112 | 12 | 0 | 0 | 100 |

전체882계획=196관측PASS+직접FAIL1+기존SKIP1+미완료684다. Shard7의58은 DID_NOT_RUN, 나머지626은 INTERRUPTED_OR_NOT_RUN이다. 취소7shard의 전체 원문에서 추가 실제 assertion FAIL은 없지만 미완료를 PASS로 바꾸지 않는다. 기존SKIP1은 logistics-table-density:41 before캡처다.

### B. 원인 분석과 기각한 후보

Shard7/Job127273965580/step7 `inline-name-persistence.spec.ts:111`의 #572 실제 SQLite inline 이름 저장은 프로세스 재시작 후 유지된다가13:32:57.2624682Z에 기본 본문30000ms를 초과했다(case30.9초). 초기 공용 fixture 준비19.491초는 별도120초 예산이므로 본문30초에 더하지 않는다. 본문 안의 실제 restart18.87652초=readiness2.99001+전체route warmup15.87786초다. 실제 inline PATCH200/1회·payload·If-Match·revision+1, 재시작 뒤 GET200/동일Task 이름·일정·진척·links 및 Grid/bar 이름은 관측됐다. 마지막 dialog expect는 trace266024.438ms에 시작해 cleanup266041.302ms와 겹치고266084.594ms에 끝나므로 PASS로 간주하지 않는다. 최종 Task Editor 이름/추가PATCH없음은 원본에서 미완료다. SQLite 데이터 소실의 근거는 없다.

가설 우선순위는 불필요한 재시작 경로 준비, cold compile/자원 비용, 최종 Editor 준비 상태였다. pristine 같은 단일case는 로컬1PASS25.4초(비재현), process-only `taskset -c 0,1` 동일명령은1FAIL33.3초/본문30초였다. 이 제약은 통제 진단이며 GitHub CPU/hardware나 동일한 최종 정지점을 재현했다는 주장은 아니다. 첫13→6경로 restart 프로필 후보는 관련 Unit5PASS/연관24PASS/type/lintPASS였지만 동일2CPU 반복3회가34.0/31.1/30.4초로 모두FAIL했다. 실제 필요경로 compile비용이 남고 Editor 이전에도 deadline을 소진해 후보를 기각했다. 수정4파일·원문로그·trace를 ignored 보고서에 보존한 뒤 공용 fixture/route helper/Unit/spec를 시작Head로 복구했다. 원격·로컬 실패와 첫후보FAIL을 숨기지 않는다.

### C. 설계와 구현 결정

Manager와 별도qa_docs가 #572/TASK_EDITOR의 계약을 대조했다. 제품 요구사항은 실제 inline 저장의 same-SQLite 새 프로세스 영속성과 revision/If-Match/Grid/bar/Editor 일치이며, dev compile을 포함한 전체 여정30초의 제품SLO는 없다. 단일spec에 test-scoped 준비 fixture120초를 두어 실제UI생성→inline PATCH1/모든 기존 사전단언→같은SQLite/origin/cookies/page/context의 실제 새 프로세스→기존전체13경로 GET warmup을 수행한다. 같은Task/revision과 살아있는PATCH 관측배열을 기본30초 본문으로 인계해 원래의 postrestart HTTP/data/Grid/bar/Task Editor/PATCH1 단언을 모두 실행한다.

**예산 범위 변경:** 종전 전체 여정30초 제한은 준비120초+재시작 후 검증본문30초로 바뀐다. 기존 공용 초기기동 fixture120초와 teardown 정책은 별도 유지하며 새 전용 준비 예산120초가 추가된다. 전체 실행 wall 상한이150초라는 뜻은 아니다. 숫자30/120/90 유지가 전체 시간 gate 불변을 의미하지 않는다. 준비 중 page action/navigation/API30초·expect5초와 restartstartup90초를 명시하고 실패는 그대로 전파한다. 준비완료 영수증은 전체PASS가 아니다. 기존 모든 단언(정적 expect 호출38개·이름검증 helper 호출8개)·첫case본문·공용fixture/기본13경로/다른process별15경로·PATCH405/TaskContext200회귀는 유지한다. mocks/DBrestore/추가mutation/skip/retry/timer보상/전역timeout 변경은 없다. JSON attachment는 준비/restart/body 시간과 budget을 구분하고 비밀/URL/ID를 포함하지 않는다. 최종 분류는 FIXTURE_OBSERVABILITY(개발서버 재시작 준비와 업무 검증이 한 예산을 공유)이며 제품 결함을 배제하는 전역 주장이 아니다.

### D. 동결 검증과 영향 선정

최종 source `c7484317ed4eb4e66242f7b3c8c7b8ae207e7b186cb98acec58e3d4711392228`/1319파일로 동결했다. 2CPU 단일case3반복은3PASS/3.6분, 본문4.9/6.8/5.4초이며 준비 포함 총시간과 구분한다. 최초비재현PASS·원격FAIL·기각후보FAIL·통제반복은 아래 고유 회귀합계에 가산하지 않는다.

| 변경·이력 | 직접/간접/음성 소비자·선정 |
| --- | --- |
| 실제 inline/restart 준비 예산 | inline-name-persistence 전체2case, project-gantt-inline-name 전체: Enter/Tab/Editor/reload/restart/같은instance·PATCH/revision/원문명 |
| 공용fixture·route warmup 불변 | 기존process/TaskContext/동적PATCH negative와원래13경로 유지, discovery Unit/전체882case 확인 |
| 누적 #870/#878/#879 실패 전체 | C002의29spec(E4+A13+B4+C7+D1) 전체 재실행, i18n/검색/밀도/STALE/공정/물류/Milestone/복사/전송·Resource scope·Issue 오류 |
| 제외 | 앱/src/db/공용설정·Unit/의존성/빌드/Docker 입력 불변을 byte대조; 전체Vitest/build/Docker 로컬중복은 생략. 원본3524 PASS는 새Head PASS로 승계하지 않음 |

수동31고유spec/6parts(F2+E4+A13+B4+C7+D1), workers1/retries0/max-failures0/각20분상한이다. #752 수동Actions의24spec/4parts상한을 변경/실행하지 않는다. 최종 실제 결과는 후행 증거로 기록하며 미완료를 PASS로 채우지 않는다.

### E. 검증·리뷰·게시 후행 기록

동결 source `c7484317ed4eb4e66242f7b3c8c7b8ae207e7b186cb98acec58e3d4711392228`/1319파일 시작/종료 map 동일. 수동31고유spec/192계획=**190PASS/기존2SKIP/FAIL0**(F16+E21+A66+B20+C59+D8), workers1/retries0/max-failures0/6parts각20분. 기존SKIP2는 logistics-table-density:41 및 master-controls-density:30 before캡처다. 2CPU3반복·최초비재현·기각후보·이전Head 결과는 중복 가산하지 않았다.

원본설정복구후 TypeScript·단일spec ESLint·탐색299Unit파일/882browser·버전0.142.0·CIcache·Markdown410파일·main validator DOCSYNC/AC01~09 구조 PASS. 구조 PASS는 의미QA/승인이 아니다. 앱/DB/Unit/공용fixture·의존성/빌드/Docker 입력은 시작Head와 byte동일(1318입력), 전체Vitest/build/Docker 로컬중복은 N/A이며 원본3524의 성공은 새Head로 승계하지 않는다. TEST_PLAN의 기존1,172,715bytes/SHA256 dfccf76797300bdb5ec2fec64931347bbdd87e7784bb0bae4f51dc8ae5ae4367 전체를 보존하고 뒤에 추가했다.

자동Pre-PR **UNKNOWN94/missing0/BLOCKED/sourceStable=true**는 수동회귀와 분리한다. 최종 report/SUMMARY는 `.prepr-reports/ci3524/prepr-publish-final/`, [정제 명령·선정·시간·결과](evidence/issue-866/ci3524-local-validation.json)를 참조한다. Next생성설정2개와 현재테스트출력/이전Issue528캡처2개는 현재worktree에서 생성한 것만 ignored 보고서에 보존 후 시작Head원본으로 복구했다. 기본worktree의 사용자변경은 건드리지 않았다.

별도qa_docs `/root/ci3522_consumer_review`가 기존모든단언(정적expect38·helper호출8)/전체13warmup/실제SQLite재시작·2CPU3회 마지막단언완료·문서 byte보존을 read-only 기술검토하여 직접보완 새P1/P2=0을 확인했다. Agent검토는 독립인간QA/Owner ACCEPT가 아니다. GitHub전체대화·정규리뷰스레드 조회에서 미해결0, 현재base와 충돌없음을 확인하며 게시 직전에 재조회한다. 별도opaque-error P2는 DEFERRED로 보존한다. 새Head Required3/Trusted/Owner/Manager NOT TESTED/MERGE_READY BLOCKED다.

코드/문서/원장/정제근거를 committed clean source로 준비한 뒤 expected Head·최신main·부모와 로컬/API전체tree를 게시전후 대조하고 비강제Ref를 한 번 갱신한다. 실제 새Head/base/testmerge/FullRun·Attempt는 PR #879와 Issue #866 STATUS에 후행기록한다. 시작확인 뒤 새CI 결과를 조회하지 않는다.

후처리의 첫 생성물 복구는 ignored 백업의 Issue528 하위 디렉터리가 없어 FileNotFoundError로 FAIL했다. 브라우저 실패가 아니며 최초로그/결과를 보존하고 부모디렉터리 생성 후 복구 도우미만 재실행했다. 제품/spec는 변경하지 않고 동일 source 및 최종 type/lint를 다시 대조한다.

새Head Required quality/e2e/docker·Trusted·독립인간QA·Owner/Manager NOT TESTED/MERGE_READY BLOCKED, HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false/#866OPEN을 유지한다. C002 E절의 country-calendar/WBS/safeApiError opaque-error 경계P2는 인과가 다른 DEFERRED다. 전역P1/P2=0을 주장하지 않는다. Main/GHCR/Release/실제AT/native125%/WindowsExcel/운영환경은 미실행이다. 한 번의 batch Ref 게시 뒤 새 Full CI Run/Attempt·Head/base/testmerge 시작만 확인하고 모니터링·병합·Issue종료하지 않는다.


## PR #879 C004 — Deferred P2 opaque-error provenance remediation (2026-11-06)

- **Previous evidence:** C002 E documented country-calendar `serverMessage→t(line)`, WBS `error.message→t(error)` and shared `safeApiError` membership in the entire UI catalog. A server-origin `저장` could be rendered as a Save control label in English. This is a P2 misleading-presentation risk, not proof of XSS or authorization bypass.
- **Remediation:** country-calendar model distinguishes opaque upstream error lines from local static messages; keep country/year/field/row details literal via escaped React text. WBS returns fixed code/status messages; `safeApiError` allows the exact approved (code,message) pair and otherwise a known-code/context fallback. Existing 401/412, CAS, Origin, stale draft, file/DB/API contracts unchanged.
- **Test Lifecycle:** ADD country-calendar provenance unit, EXTEND safe-ui-error and WBS transport error tests, KEEP_UNIQUE all existing E2E 8-shard/SQLite/HTTP tests; no skip/retry/timeout expansion. New exact HEAD local TypeScript/Vitest/Chromium/Docker and Full/Trusted QA NOT TESTED on publication. The older #3525.1 and Trusted #1172.1 SUCCESS are preserved historical results only, not inherited by C004.
- **Review/Risk:** HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false; MERGE_READY BLOCKED until new Full/Trusted PASS and Owner review. Operational backup/restore, Windows Excel, native screen reader/125% unverified. No main merge, GHCR formal release, Finalizer or Issue close authorized at this step.

## PR #879 REWORK-C005 — Full #3526.1 상속 속성 조회와 오류 출처 교정 (2026-11-06)

### A. 원격 전체 이력·원본 출처·실제 실패

[Full #3526.1 / Run42100064413](https://github.com/planner77/masterGantt/actions/runs/42100064413), attempt1/pull_request/FINAL_FULL은 Head `8f1335cf96d1de8bb3dc767e72683bb8d0148a05`, base `364aa3bdfde16fd3ca79add61c35a1cde21f6395`, test-merge `e0e77f06469e978c53fb55cc103b7f0b8fa07175`에서 FAILURE다. 원장 전체·선행 correction/evidence·Work Packet·PR 대화와 #870/#878/#879 branch 전량을 대조했다. 전체53workflow=CI28회(Full25+metadata3, 모두 attempt1)+FAST25회(SKIPPED)다. C003의기존26CI 이후 #3525.1과 #3526.1이 추가되었고 기존 Run/Attempt 누락0이다. 과거 raw 로그 전부를 이번에 재다운로드했다는 뜻은 아니다. [전체 이력](evidence/issue-866/ci3526-history.json)을 따른다.

#3525.1/Run42053023686의 Head `e4b267348f27acf4d6059c202f62a867d93a4c69`에서는 Required quality127336677964/e2e127353487051/docker127340151186 SUCCESS였다. 이 원본 성공과 이전 Trusted 성공은 C004 이후 새 Head의 성공으로 승계하지 않는다. C004는 당시 로컬 TypeScript/Vitest/브라우저 미실행을 NOT TESTED로 명시했으며 이번에 기존 음성 테스트의 실패가 실제 드러났다. 기존 FAIL/CANCELLED/SKIPPED 기록을 바꾸지 않는다.

원본 changes Job127500200971의 artifact13449701384 업로드20:05:30.8508225Z(line87)가 checkout20:05:32.1864126Z(line96)보다 앞선다. ZIP SHA256 `47bc64d0dc05d5ca4ba2379a88d501ed0288cb31f93fffb9a3ef0492032b4ace`와 schema/repository/run/attempt/PR/branch·3SHA·GitHub 원본 API·불변 merge 부모·commit→PR 단일879 귀속을 읽기 전용 대조했다. ZIP은 데이터로만 읽었고 실행하지 않았다. PR측 artifact 단독 또는 제목에서 PR을 추정하지 않았다. 출처 교차 확인 PASS는 Trusted QA/Owner 승인 PASS가 아니다. [원본 출처](evidence/issue-866/ci3526-source-proof.json) 참조.

| 종류 / Job | 실제 결과 | 근거·해석 |
| --- | --- | --- |
| Unit / 127500852712 / step6 `Run npm test` | 직접 FAIL | 3667PASS/3FAIL/기존3SKIP, 300files=298PASS/1FAIL/1SKIP,61.06초 |
| Policy127500852727 / ESLint127500852846 / TypeScript127500853118 / Preflight127500664904 | SUCCESS | 원본 Head의 실제 정적 검사만 의미 |
| PR Fast Gate127501708370 | 파생 FAIL | Unit 직접 실패가 선행 gate를 차단 |
| Required quality127501871129 / e2e127501871513 / docker127501871375 | 파생 FAIL | 실제 Build/Chromium/Docker 구현의 직접 실패와 구별 |
| Automated QA127501932268 | 파생 FAIL | 필수 gate 미성공; 독립 의미/인간 QA가 아님 |
| PR Build127501872879 / PR E2E127501872545 / Docker127501874140 | SKIPPED / NOT RUN | E2E matrix 확장 전 placeholder1개이며 8개 shard 성공/실패 수로 계산하지 않음 |

전체23Job=7SUCCESS/6FAILURE/10SKIPPED다. Main/비PR/LOW/metadata placeholder도 포함한 수치이며 실제 Chromium 사례0PASS 또는 Docker smoke PASS라고 해석하지 않는다. [실패 매트릭스](evidence/issue-866/ci3526-failure-matrix.json) 참조.

직접 실패는 `tests/components/safe-ui-error.test.ts`의 `retains caller context for unapproved upstream data` 중 code/message가 각각 `__proto__`, `constructor`, `toString`인3건이다. 예상은 caller context fallback, 실제는 `TypeError: approvedDomainMessages[code]?.includes is not a function`, `src/components/safe-ui-error.ts:23:98`다. 원본 summary20:08:01.574Z와 로컬 기존 테스트의 같은 오류를 대조했다. fixture·제품 데이터·DB 소실이나 권한 우회 증거는 아니다.

### B. 재현·가설·원인 및 같은 계열 감사

Manager는 시작 Head에서 아래 기존 회귀를 먼저 실행하여11PASS/3FAIL(442ms,exit1)을 확인했다. 이후 frontend의 확장 음성 테스트는 safe25건 중13FAIL/12PASS(398ms), WBS 오류군17건 중12FAIL/5PASS(다른7건 필터 제외/NOT RUN,2.79초)였다. 원래3실패는 삭제하지 않았다.

```sh
npx vitest run --config tests/config/vitest.config.ts tests/components/safe-ui-error.test.ts
```

가설은 ① Object.prototype의 상속 속성을 allowlist에서 읽음 ② 명시 allowlist 값의 타입 오류 ③ 실행 환경 차이 순으로 사용자에게 먼저 제시했다. 실제 명시 항목 REVISION_CONFLICT 배열은 정상이고 원격/로컬 모두 같은 실패다. 직접 소유한 키인지 검사하면 원래3음성·다른 prototype 키와 상속 matcher 반례가 모두 정상 fallback이 되며 approved pair/known code 양성은 유지된다. 첫 가설을 확정했고 단순 optional chaining이 상속 속성 또는 값 타입을 인증하지 않음을 확인했다. 분류 PRODUCT/PRESENTATION이다. prototype 오염이 실제 운영에서 발생했다는 주장은 아니다.

같은 오류 표시 생산자/소비자를 별도 qa_docs와 감사해 아래를 구분했다.

| 계약 | 발견·반례·보완 | 이전 이력과 관계 |
| --- | --- | --- |
| safeApiError 승인 메시지 | own-key 확인 전 `.includes` 호출로 예외. `Object.hasOwn` 후 exact code/message 쌍만 승인, known code/context fallback 유지 | #3526 실제3FAIL; C004 신규 회귀 |
| WBS 고정 code 안내 | prototype code에서 객체/함수를 반환. own-key fallback으로 보완, HTTP401/403/409/412 우선순위 유지 | C004 신규 동일 계열; 원본 CI의 추가 직접 실패라고 세지 않음 |
| Import 경고 사전 | `ImportDiagnosticDto.code`와 수신 validator는 string만 확인. valid preview의 prototype warning이 `t(object/function)`으로 들어가 `message.replace` 예외. 실제 수신parser→renderer Unit에서15건 중12FAIL/3PASS(925ms)을 재현한 뒤 own-key fallback | Phase C 신규 계열. 기존 main은 warning.message를 그대로 표시했으므로 기존 main 결함으로 오인하지 않음 |
| 국가 캘린더 오류 출처 | C004의 `serverMessage(body, localFallback)` 전체를 opaque로 저장하여 서버 message가 없는 오류의 로컬 한국어 fallback도 EN/VI에서 번역되지 않음. 실제 resolver→presenter RED4건 중2FAIL/2PASS(824ms) | C004 별도 신규 P2. 기존 두Unit만으로 실제 producer 연결을 검증하지 못했음 |
| Project 생성 오류 사전 | prototype code의 비문자열 렌더 오류. 기존 main에도 있던 own-key 누락을 동일 안전 경계와 기존 브라우저 회귀로 보완 | 별도 발견한 기존 결함이며 C004가 새로 만든 오류와 구분 |

국가 캘린더는 load/login/mutate/import-preview4경로가 공통 resolver를 사용한다. 실제 받은 nonblank 서버 message와 row/field detail은 각 줄의 opaque 출처를 보존하고 앱 fallback만 현재 언어로 번역한다. multiline detail로 줄 수가 변해도 출처 배열을 같은 줄 단위로 확장하며 누락된 provenance는 opaque로 처리한다. 비정상/부재 응답을 임의 `t()` key로 승격하지 않는다. 서버 문자열 `저장`과 국가/연도/field/row 원문, 초안·파일·401/412·요청 수·revision/Origin/CAS를 유지한다. 새 문자열 사전이나 외부 번역 호출은 추가하지 않는다.

### C. Cross-run 매트릭스·선정·실패 보존

| 누적 실패·교정 | 최종 후보에서 재검증할 소비자 |
| --- | --- |
| #870 관리자/물류/공정/밀도·원문오류/technicalDelete, #878 nativeheader/shard count | 이전31spec의 A13/B4/C7/D1 및 전체Vitest의 shard/i18n/date/DTO·SQLite/Calendar/Copy/Template·권한 음성 |
| #879 B001 main base, B002/003/005 DOC_SYNC, B004/006 TS·migration | 현재main/base·base validator의 정규 docs_gate/AC01~09 구조, 원본 Next설정 TypeScript와 전체Vitest |
| #879 B007/008 행87px/검색20px/번역option·stale draft | cross-screen/i18n-master/logistics/catalogdelete/Project 생성·설정·번역·401/412 기존 전체 |
| C001 유형 필터 이름, C002 Issue 오류/Project근거, C003 실제 inline 재시작 | C7/E4/F2의 전체 사례·원래 ID/scope/focus/instance/PATCH/revision/SQLite 재시작 단언 |
| C004/C005 공용 오류/WBS/Import/캘린더·Project 생성 | 직접 Unit 및 실제 renderer, A의 Calendar/create·E의WBS/Resource·D의전송8case, 알려진 code/status·원문/초안·3언어 음성 |

최종 수동 범위는 누적31고유spec(F2/E4/A13/B4/C7/D1)을 유지하며 기존 Calendar/create 파일에 사례를 보강한다. 각 part20분·workers1/retries0/max-failures0, 로컬2part 병행 시 port/SQLite/dist/report를 분리한다. 로컬 병행은 원격8runner 동일 조건 또는 성능 개선 증거가 아니다. #752 Actions 진단workflow의24spec/4parts/권한 정책은 변경/실행하지 않는다. production HTTP/HTTPS transport/Docker 전체는 기존 원격 gate, 실제AT/native125%·WindowsExcel·운영backup/restore는 별도 NOT TESTED다.

Project 생성의 첫 RED 시도는 fixture 비밀번호13자가 기존 최대12자를 넘어 API까지 도달하지 못했다. 잠정 영어 기대도 실제 catalog와 달랐다. `create-red.log`를 보존하며 정확 제품 결함 재현으로 사용하지 않는다. 9자 fixture/정확 문구로 수정한 별도 `create-red-actual.log`에서 실제 prototype 응답 경로를 다시 검증한다. 중간 진단·과거 Head 성공·통제 반복은 최종 고유 사례 수에 가산하지 않는다.

### D. 최종 동결 검증·문서·검토·게시

최종 동결 source `1cdd6edefdd0160dbcd56a290a02fb4c4953bd26c36a596654f1b6499b94d046`/1322입력의 시작/종료 file map이 같다. 제품6파일·테스트7파일을 보완했으며 중간동결3f866... 이후 차이는 WBS E2E 한 파일뿐이다. 마지막source에서 전체quality와31spec를다시검증했으므로 중간·단독·병행 관측을 최종 고유 합계에 중복 가산하지 않는다.

공식 `tests/config/playwright.config.ts`의 순차6parts(E4/B4/C7/D1/A13/F2), 각20분·workers1/retries0/max-failures0로 **31고유파일/194계획=192PASS/기존2SKIP/FAIL0**이다. E21/B20/C59/D8/A68/F16 PASS이며 기존SKIP2는 logistics-table-density:41/master-controls-density:30 before캡처다. 실제 inline SQLite 새프로세스 재시작·PATCH/revision/Grid/bar/Editor 마지막 단언을 포함한다. 과거 #870/#878/#879 실패 전체와 새 오류/간접/음성 소비자를 같은 최종 입력으로 검증했다. skip/허용오차/timeout·Required3/Chromium8·CI정책을 바꾸지 않았다.

최종 전체Vitest **3714PASS/기존3SKIP**, 300filesPASS/기존1fileSKIP(301), 명령43.01초/내부Vitest42.38초다. production build/standalone/runtime-tools50.52초, 원본Next설정의TypeScript35.68초, 변경13파일동일ESLint3.79초·테스트탐색301Unit/884browser·버전0.142.0·CIcache·Markdown연결검사도PASS다. Docker/production HTTP·HTTPS transport는로컬중복하지않고새원격gate와별도환경검증을구별한다. [정제최종명령·source·부분실패·실행결과](evidence/issue-866/ci3526-local-validation.json)를따른다. 로컬명령/Playwright보고서의시간측정범위를분리하며성능개선·10successful-run baseline·Actions runner비용절감을주장하지않는다.

자동 Pre-PR는 **UNKNOWN94/missing0/BLOCKED/sourceStable=true**다. `.prepr-reports/ci3526/prepr-final/report.json`과SUMMARY를보존하고 수동producer/consumer선정·실제회귀와자동매핑공백을구분한다. base364aa...의실제validator docs_gate는정규DOCUMENTATION_SYNC/AC01~09 구조PASS이며의미QA/승인PASS가아니다. GSC1.0.0-candidate/문서기준commit8f1335cf·적용규칙/SC범위·제외근거/예외N/A를Work Packet에기록했다.

원장·TEST_PLAN·REMOTE_VALIDATION·SECURITY·I18N_PHASE_C의시작Head원문prefix를전부보존했다. TEST_PLAN의시작1,174,591bytes/SHA256 `f7494bf01702c68dac359d1ed01651e44e275db3f0bf07c71cd52d2f4747745d` 뒤에만추가했다. 최종생성물복구는현재worktree에서만tracked100개원복/untracked28개ignored보존,비표준Nextdist2개도ignored이동했고next-env/tsconfig실제bytes와최종source지문을재대조했다. 기본worktree의사용자deploy/compose/output변경은건드리지않았다. 잔여로컬초기로딩실패의인과는미확정이고최종순차회귀에서는비재현이다. 최초실패·중단·미실행·무효fixture진단과원본원격FAIL을삭제하지않는다.

현재 GitHub미해결review thread0(기존1건resolved/outdated), mergeable=true/main변경없음을확인했다. 별도 qa_docs `/root/ci3526_review`의최종읽기전용PRE_QA기술검토는소스1322입력·13개소유파일해시·전체회귀로그/수치·문서원문보존을대조하여PASS/이번delta새직접P1·P2=0을확인했다. 인간QA/QA_FINAL/Owner승인과분리한다. 새Head quality/e2e/docker·Trusted·Owner/Manager NOT TESTED/MERGE_READY BLOCKED다. 새 Full CI는한번게시후시작만확인한다.

이번 delta의 source/test와 정규 문서 영향은 Work Packet C005에 연결한다. TEST_PLAN·원장·REMOTE_VALIDATION·SECURITY·I18N_PHASE_C는 원본 bytes를 보존하고 뒤에 추가하며 PLAN/Work Packet의 현재 단계를 C005로 기록한다. 기존 C004 영문/당시 미검증 및 C002의 DEFERRED 기록은 역사로 남긴다. 새보완과 실제 회귀가 확인되기 전 전역 P1/P2=0이나 완료를 주장하지 않는다.

HIGH/OWNER_MANAGED/qa_required=true/release_required=true/release_authorized=false, 새 Head Required3/Trusted·독립 인간 QA·Owner/Manager NOT TESTED/MERGE_READY BLOCKED/#866 OPEN을 유지한다. 별도 Agent 기술검토는 인간 독립 QA 또는 Owner 승인과 다르다. committed clean local tree/API 전체tree·정확 부모·최신main·expected Head를 대조한 한 번의 비강제 Ref 게시 뒤 Full Run/Attempt·Head/base/testmerge의 시작만 확인하고 PR/Issue STATUS에 기록한다. 이후 CI모니터링·병합·Main/GHCR/Release/Finalizer·Issue종료는 수행하지 않는다.

C005 로컬 실행 예외: 최초 병행용 임시 `defineConfig(base, overrides)`가 기존 webServer와 override를 함께 유지하여 첫 E묶음이3121 외 기본3100서버도 기동했다. 나머지 B/C/D/A/F는1~3초의 EADDRINUSE3100으로 브라우저 본문 전 NOT RUN(제품 직접 FAIL 아님)이다. 원본 config/log/report/complete JSON은 ignored `initial-parallel-setup/`에 보존했다. E는 의도한 baseURL3121에서 그대로 실행하고, 나머지는 임시config를 단일 인자의 `defineConfig({...base,...overrides})`로 바꿔 정확히 한 개의 분리서버를 사용한다. 실행중 E의 config/소스는 바꾸지 않았으며 새 묶음과 합쳐 동시에 최대2part로 제한한다. 제품·test 소스지문은교정전후동일하다. 첫실행exit1과본문미실행을최종PASS로덮어쓰지않는다. 해당 예외는 정책·제품·CI workflow 변경이 아니다.

C005 추가 교차 진단: 병행 E의 실제 결과는1PASS/2FAIL/1CANCELLED/17NOT_RUN, B는1PASS/1CANCELLED/18NOT_RUN이다. Playwright JSON의skipped에는중단·미실행도포함되므로기존의의도적SKIP와구분했다. E의 `issue-730-view-composer.spec.ts:221`은 Project 준비 API25개가전부2xx/문서200 뒤 canonical/assigned-targets 재조회가약14.2초pending이고health1503ms도timeout이었다. pageerror/4xx/5xx/재시작근거는없으나자원·컴파일·deadlock의인과는trace만으로확정할수없다. 자기소유coordinator를먼저정지하여다음묶음을막고Playwright에SIGINT를보내trace/report를보존한뒤소유PGID잔존0을확인했다. 타서버/운영DB/소스는건드리지않았다. [로컬정제실행증거](evidence/issue-866/ci3526-local-validation.json)에부분관측과미실행을따로기록한다.

동일 제품·testsource를 수정하지 않고 동일한 E의 임시config와workers1/retries0/max-failures0에서두실패case만단독실행했다. `:221`은31.6초PASS(초기로딩실패비재현), `:299`는원래409원문기대에서동일FAIL, 총1PASS/1FAIL·1.7분이다. 초기로딩의원인확정또는무조건flaky판정은하지않는다. `:299`의actual은 `데이터가 변경되었습니다. 새로고침한 뒤 상세를 다시 열어 주세요. 다시 시도`로C004의고정409안내와일치한다. 같은case후속503/QUERY_UNAVAILABLE도caller가명시한 `조회하지 못했습니다.` fallback 대신서버원문을기대하는잠재TEST_CONTRACT불일치다. 두raw양성기대만현재안전표시계약에교정하고,같은열린오류에서정확EN/VI/KO·원문부재·추가조회0·초안/상태와원래stale잠금/재시도/Task·Assignment원본·응답역전·focus·provenance보호단언을보강한다. 다른146spec literal연결검색과11개WBS관련파일/10개fixture↔matcher대조에서같은raw양성은이두곳이며,정적검색의범위를전역완전감사로확대하지않는다.

이 E2E추가교정으로최초source지문/전체Unit·build성공은역사적중간검증으로보존한다. 새로운최종source를다시동결하고전체Unit/build/type·해당lint/탐색및31spec를기존공식config로각묶음순차실행한다. 병행환경의오류를시간/단언/retry확대나제품변경으로덮지않는다.
