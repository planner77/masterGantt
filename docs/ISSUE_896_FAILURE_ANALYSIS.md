# Issue #896 — 누적 검증·실패 원장

Primary Issue: [#896](https://github.com/planner77/masterGantt/issues/896). 갱신일: 2026-11-09. Source of truth: [PR CI 실패 처리](PR_CI_FAILURE_TRIAGE.md). 승인 범위는 PR CI 시작까지이며 결과 모니터링·병합·게시·Issue 종료를 포함하지 않는다.

## 원격 실행·과거 이력 재사용

이번 #896 전용 PR은 최초 작성 시점 미생성이고 신규 원격 실패 0건이다. Run/Attempt·Head/base/test-merge·Required3는 시작 후 등록 증거만 인계하며 결과는 NOT TESTED다. 미관측을 원격 PASS로 세지 않는다.

기준 main `1826b479a80c64ef16efe768b31f75d62170639e`, branch `feat/issue-896-visual-evidence`, version0.145.1. 기존 PR [#900](https://github.com/planner77/masterGantt/pull/900)와 [#901](https://github.com/planner77/masterGantt/pull/901)은 MERGED다. #900의 primary는 #895이므로 원본 실패는 [#895 단일 원장](ISSUE_895_FAILURE_ANALYSIS.md)에 보존한다. #889/#890 제품 이력도 [별도 원장](ISSUE_889_890_FAILURE_ANALYSIS.md)을 유지한다.

| 기존 출처 | #896에 재사용하는 교정 | 이번 범위·제한 |
| --- | --- | --- |
| #900 Full #3576.1, Run42471148020.1 | DOC_SYNC 실제 diff/N/A 분리, source-head 변수명·UAT 숫자 필드·한글 step 리뷰 교정 | 현재 Work Packet을 실제 변경 파일로 다시 검사; #900 리뷰3개 모두 resolved/outdated 조회 |
| #900 Full #3577.1, Run42472111325.1 | Playwright attachments 사본을 canonical manifest로 오인한 오류 | 기존 canonical scanner 보존·회귀 unit 재사용 |
| #900 Full #3578.1, Run42475849089.1 | E2E2/8 35분 취소 이후 whole-spec rebalance | plan/8shard/timeout 변경 없음, 원격 시간 개선을 새 주장으로 재사용하지 않음 |
| #900 Full #3579.1, Run42479544101.1 | W07 30초 누적 테스트 분리 | 해당 제품/fixture 변경 없음, 기존 split와 manifest 정합 유지 |
| #900 Full #3580.1, Run42483080590.1 | SC-03 live manifest 제목 동기화 | 기존 AST 소비자 검증을 bounded unit에 포함 |
| #895 Main #3582.1~3, Run42487828570 | E2E ECONNRESET 및 OCI producer attempt 교정·기존 복구 | Main/PASS/Finalizer를 #896 새 Head로 승계하지 않음; OCI 경로 변경 없음 |
| #901 Full #3587.1, Run42516438448.1 | 원래 PR의 UPDATED를 후속 PR에서 복제한 DOC_SYNC 오류 | 현재 diff별 UPDATED/N/A로 재작성; 실제 CI 결과 조회로 이번 작업 완료를 주장하지 않음 |

## 누적 실패·관측 매트릭스

| ID·분류 | 최초 관측 | 교정/범위 | 최신 검증·잔여 위험 |
| --- | --- | --- | --- |
| L-001 TEST_CONTRACT | helper 변경 뒤 tsc의 geometry 배열 implicit any 2건 | infra가 bounding rect 명시 타입 지정 | typecheck PASS; 로컬 정적 오류이며 원격 실패가 아님 |
| L-002 ENVIRONMENT / GENERATED_SOURCE | 실제 Next dev/격리 서버가 next-env.d.ts·tsconfig.json에 임시 dist 경로 생성 | 실행 종료 뒤 두 파일 diff 확인하고 원본 복원; 제품/설정 변경으로 게시하지 않음 | 브라우저 관측 시 dirty 지문 보존; clean exact-commit 화면으로 과장하지 않음 |
| L-003 POLICY_CI / SELECTION_UNKNOWN | verify:prepr targeted dry-run에서 UNKNOWN5 | .github/workflows/ci.yml, comparator, validator, helper, Python test의 자동 영향 매핑 미등록 | selection BLOCKED 유지; 수동 생산자/소비자 매핑과 개별 bounded 실행 사용 |

신규 실제 Chromium 실패는 현재 보고된 바 없음. 의도적 CSS +4px 음성 주입은 실제 제품 실패가 아니라 회귀 탐지 통제이며 화면·FAIL 측정과 복원 확인을 별도 기록한다. 모든 단계가 끝나기 전에 해당 결과를 PASS로 채우지 않는다.

## 검증 범위·출처·배제

- 직접: Python ui_evidence 양·음성, 기존 #118 비교기 v2/legacy unit, helper/type/lint, #889 공통 shell·밀도와 #890 locale Chromium.
- 간접/음성: 기존 Preview UAT parser, QA Preflight/Final 문서 구조, test-config/shard·SC-03 live manifest 소비자. 기존 #895 원장의 W07·Main OCI 실패 파일은 이번 변경에 직접 영향이 없어 원격 Full8에서 보존하고 별도 로컬 전체 W07/Docker/GHCR를 반복하지 않는다.
- 자동 선택 계획: `.prepr-reports/issue-896-plan/SUMMARY.md` / report.json. dry-run만 실행되어 NOT TESTED이며 selection UNKNOWN5·BLOCKED를 숨기지 않는다. 당시 working fingerprint `9ee3423196e8c4b7c19eb158523bf0478b25f3f5c3bab97b285df1ba6c3733c7`, sourceStable=true는 계획 생성 중 불변만 뜻한다.
- 로컬 환경: WSL2 Linux6.6.87.2, Node22.14.0/npm11.10.0, npm ci 성공(711 packages), Playwright1.63.0, Chromium headless shell1243/153.0.8010.12. Ubuntu hosted runner 동일 환경이 아니다.
- 공개 산출물은 합성 fixture만 사용한다. raw trace·운영 DB·Secret·실제 사용자 화면을 Git/PR/Issue에 게시하지 않는다.

## 로컬 결과와 재사용 판정

구현 단계의 중간 단위 실행과 최종 동결 실행은 구분한다. 기존 source가 같은 테스트 결과만 재사용하고 helper·flow 변경으로 영향을 받은 실제 브라우저 사례를 재실행한다. 문서만 나중에 변경한 경우 제품 소스·테스트 동일성 근거로 browser 결과를 재사용하되 GitHub의 새 exact-Head CI는 별도로 필요하다.

- Python v2/legacy 검사: 중간 27 PASS(0.204초), 위조 PASS·변조·누락·환경/출처 drift·controlled FAIL 관찰 분리 포함. 최종 결과는 아래 추가 기록을 따른다.
- 기존 #118 comparator: unit21 PASS, ESLint PASS, legacy positional CLI 유지.
- 첫 실제 Chromium 두 case: 2 PASS, 총2.4분(#889 약1.1분, #89025.7초). 이후 controlled CSS 추가 및 helper 교정 때문에 새 source의 영향 사례를 다시 실행한다.
- 실제 수집 bytes/capture/검증 시간은 manifest/summary에 기록한다. Actions runner-minutes·전후 artifact 총비용·결함 재오픈 변화는 NOT TESTED다.

## 리뷰·충돌·다음 인계

기존 #900 리뷰3개 모두 resolved/outdated이며 그 교정을 보존한다. 이번 PR의 review thread 상태와 최신 main ancestry/충돌은 게시 직전 확인한다. 읽기 전용 ui_ux 분석과 qa_docs 기술검토는 실제 독립 QA_FINAL 또는 Owner ACCEPT가 아니다.

quality/e2e/docker·Trusted/Owner UI 수용·Manager ACCEPT·Stage B 활성은 NOT TESTED이며 MERGE_READY=BLOCKED다. PR CI 등록 후 모니터링하지 않는다. main/GHCR·Release·브랜치 정리·Issue 종료는 수행하지 않는다.

## 최종 로컬 결과·기술 검토 (2026-11-09)

- 실제 Chromium: 최종 #889 PASS43.7초(전체 실행1.3분), 최종 #890 PASS12.4초(별도 실행17.6초). 첫2/2 PASS 결과를 신규 Head 근거로 중복 합산하지 않는다. 최종 helper로 다시 검증한 고유 pilot2개다.
- canonical v2: schedule10건/1,135,836bytes + locale3건/308,868bytes = 13건/1,444,704bytes. `test-results/` 및 `output/playwright/issue-896-local-i18n/`, 요약 `output/playwright/issue-896-local-{schedule,i18n}-summary.md`. 파일 무결성 exit0, 정상관측12건 + 의도적 CSS FAIL관측1건(4px > 허용1px), 원복 PASS. 관측 FAIL을 UI 수용 PASS로 지우지 않는다.
- 렌더링: Chromium153.0.8010.12/Playwright1.63.0, Asia/Seoul, light, DPR1, CSS zoom1, 고정 브라우저 시각2026-10-14T12:00:00.000Z. 390 PNG는 내부 scroll의 Grid viewport이며 화면 밖 Chart 전체 가시성을 보장하지 않는다. font family·합성 fixture subset만 관측하며 실제 폰트 파일·전체 DB 동일성은 미인증이다.
- 최종 bounded unit: Vitest4파일66 PASS(2.66초: comparator/test-config/shard/prepr), SC-03 state-consistency-manifest14 PASS(2.46초). Python ui27 + Preview UAT9 + QA Preflight12 + QA Final43 = 91 PASS. QA Final의 API 부재 BLOCKED 출력은 해당 음성 unit 기대 결과이며 실제 GitHub QA 실행 결과가 아니다. typecheck/대상 ESLint/diff 공백/Markdown426파일 링크/YAML parse/E2E8 보존 PASS.
- L-001의 명시 geometry 타입 교정 후 최종 typecheck PASS. L-002는 Next 생성 파일 diff 확인 후 `git restore --source=HEAD -- next-env.d.ts tsconfig.json`으로 원복했고 게시 diff에서 제외했다. 로컬 캡처의 dirty 지문은 역사적으로 그대로 보존한다. 마지막 브라우저 이후 코드 차이는 한국어 주석 정리뿐이며 assertion/fixture/실행 코드는 같아 browser 결과를 재사용한다.
- 별도 실제 ui_ux 분석과 qa_docs 읽기 전용 기술 사전 검토 PASS, 독립 QA_FINAL=N/A(OWNER_MANAGED). qa_docs가 직접 Python27/comparator21·문서구조·기존 보안 gate 보존을 확인했다. 원장 Run 오기(Full3577 ID42472111325.1), comparator 일본어 혼입·신규 설명 주석, font/fixture 검증 한계 문구를 교정했다. 미해결 기술 지적0이며 Owner UAT/Manager ACCEPT는 NOT TESTED다.
- 직접·인접 최소 검증을 완료했으므로 로컬 전체 Vitest/Playwright/Docker/GHCR를 반복하지 않는다. 자동 prepr 선택 UNKNOWN5는 계속 BLOCKED이고 개별 명시 검사 PASS와 구분한다. 새 Head의 공식 전체 회귀는 PR CI가 수행한다.


## PR #902 · Full #3594.1 — 최초 원격 실패와 누적 분석 (2026-11-09)

### A–C. 원본 출처와 전체 이력

[CI #3594.1 / Run42526579195 / attempt1](https://github.com/planner77/masterGantt/actions/runs/42526579195), event pull_request/opened, Head `1cc214f85ba2e1c16a65d10d51044829eef5dc98`, base `1826b479a80c64ef16efe768b31f75d62170639e`, test-merge `3dfd3f29732ec5cebe1982dd641c3cc00fabee8e`. 원본 `ci-pr-source-42526579195-1` artifact13635705906의 repository/PR902/run/attempt/head/base/merge를 실제 읽기 전용으로 확인했다. zip을 실행하거나 해당 자료를 코드로 사용하지 않았다. 현재 PR은 OPEN·mergeable=true이고 unresolved thread0이다.

#896 전용 원격 Full은 현재1개 Run/1attempt이며 원본 conclusion FAILURE를 보존한다. 앞의 로컬 L-001~003와 기존 primary #895의 과거 실패는 별개다. 이번 오류는 #895의 attachments 사본 오인과 다른 신규 수집 경계 결함이다.

| 원본 Job | 판정 | 직접/파생 근거 |
| --- | --- | --- |
| QA trust128871420954, 변경 경로128871421245, Preflight128871500341 | PASS | 이전 DOC_SYNC·재사용 구조 충족 |
| Policy128871583168, TypeScript128871583169, ESLint128871583120, Vitest128871583192, Fast128872229075 | PASS | 실제 빠른검사 모두 성공 |
| PR Build128872296578, quality aggregate128872641132 | PASS | required quality 성공 |
| Docker 구현128872296642, docker aggregate128873853763 | PASS | 실제 build/runtime·OCI source 보호 유지 |
| E2E3/8 [Job128872296678](https://github.com/planner77/masterGantt/actions/runs/42526579195/job/128872296678) | FAIL, F-001 직접 | #880 실제 원본 View/Editor/5폭 case에서 helper94의 git diff 수집 ENOBUFS |
| E2E aggregate128876617479, QA Final128876641688 | FAIL, 파생 | 실제 E2E 미성공, 별도 제품 오류로 세지 않음 |
| 나머지7 E2E shard | CANCELLED | fail-fast 취소; 취소 로그 모두 조회, 추가 실제 assertion FAIL 미관측 |
| Main OCI128876643451, non-PR build/E2E/Docker·targeted 경로 | SKIPPED | PR 비대상/조건 미충족; 검증 PASS로 사용하지 않음 |

### 취소를 포함한 전체 E2E 관측

| Shard | Job ID | 선택 수 | 로그상 완료 PASS | FAIL | 기존 SKIP | 미완료·미실행 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1/8 | 128872296664 | 105 | 95 | 0 | 0 | 10 |
| 2/8 | 128872296783 | 105 | 42 | 0 | 0 | 63 |
| 3/8 | 128872296678 | 149 | 130 | 1 | 1 | 17 |
| 4/8 | 128872296722 | 118 | 45 | 0 | 0 | 73 |
| 5/8 | 128872296647 | 92 | 66 | 0 | 0 | 26 |
| 6/8 | 128872296653 | 94 | 66 | 0 | 1 | 27 |
| 7/8 | 128872296648 | 109 | 64 | 0 | 0 | 45 |
| 8/8 | 128872296723 | 123 | 73 | 0 | 0 | 50 |

3/8의 수치는 실제 Playwright 최종 요약이고 나머지는 원본 로그의 완료 표시/선택 수로 계산한 관측이다. 취소된 실행의 미완료와 아직 시작하지 않은 case를 세분할 근거가 없어 함께 표시했다. shard6의 controlled E2E root error-boundary probe 로그는 예정된 음성 동작이며 실제 assertion 실패가 아니다.

### F-001 — 정확 현상·원본 artifact

- 2026-11-08T22:03:05.876Z, `tests/e2e/schedule-views.spec.ts:52:5`의 #880 실제 원본 다중 Resource·설비 View/Editor/5폭·일주·Fullscreen·WBS왕복 쓰기0, 실패 test body18.6초. `Error: spawnSync git ENOBUFS`, `tests/e2e/helpers/ui-evidence.ts:94`의 `sha256(execFileSync("git", ["diff", "--binary", "HEAD"]))`가 최초 실제 오류다. 화면 assertion/HTTP 저장 오류 또는 180초 timeout이 아니다.
- 3/8 Playwright report [artifact13636043489](https://github.com/planner77/masterGantt/actions/runs/42526579195/artifacts/13636043489), 합성 UI [artifact13636163118](https://github.com/planner77/masterGantt/actions/runs/42526579195/artifacts/13636163118). PNG/geometry 일부 생성 뒤 manifest 작성 전에 실패하여 post-step은 canonical0/NOT TESTED를 기록했다. PNG가 있다고 화면 수용이나 manifest 무결성 PASS로 간주하지 않는다.
- 원격 당시 diff 총bytes/변경파일 목록은 보존된 로그에서 확인 불가다. 특정 PNG나 제품 파일을 원인으로 단정하지 않는다. 대용량 Git stdout 처리 경계의 재현과 원인 분리는 아래 D–F 결과로 확정한다.
- 누적 원격 직접 실패 파일 합집합: `tests/e2e/schedule-views.spec.ts`(실제 #880 호출) → `tests/e2e/helpers/ui-evidence.ts`(공유 provenance 수집). 동일 helper 소비자인 #889와 i18n #890도 재검증한다.

### D–F. 재현·설계·최종 source 검증

대용량 실제 임시 Git repo로 최초 호출 경로 RED를 확인하고, 같은 전체 diff bytes의 SHA256를 출력 크기 제한 없이 streaming 처리하는 기존 수집기 보완을 검토한다. raw diff를 로그/manifest에 노출하거나 buffer를 임의 확대하거나 지문 수집을 생략하는 우회는 사용하지 않는다. Git 실패는 빈 SHA256 성공으로 바꾸지 않는다. 구체 명령·RED/GREEN·교차·브라우저 결과는 후속 절에 추가한다.

### G. 인계 경계

사용자는 같은 PR CI 재시작까지 승인했다. Full8/Required3·timeout/retry·Trusted/Owner·권한·OCI/Release/Finalizer 변경 없음. 새 Head 원격 required/Trusted·Owner UI 수용·Manager ACCEPT는 NOT TESTED다. 기존 원본 PASS는 진단과 불변 소비자의 로컬 검증 재사용 근거이며 새 Head 원격 승인으로 승계하지 않는다.


### F-001 D–F 확정 결과 — 버퍼 한도와 streaming 교정

- 재현 명령: `npx vitest run --config tests/config/vitest.config.ts tests/scripts/ui-evidence-provenance.test.ts`. 원본 수집 함수를 동작 변경 없이 seam으로 추출한 RED에서1 FAIL/169ms, 같은 경로 재실행도 ENOBUFS/143ms였다. 실제 원격과 같은 `execFileSync("git", ["diff", "--binary", "HEAD"])` 호출이며 화면·네트워크 없는 임시 실제 Git 저장소다.
- 가설 순위는 실행 전 사용자에게 공유했다. H1=Node sync child stdout 기본 buffer 한도, H2=Git diff driver 자체 오류, H3=특정 파일·권한 문제. 고정 합성 Git에서도 재현되어 H3 반증, 같은 Git의 파일 output은 성공·작은 diff buffered 수집도 성공하여 H2 반증, 1MiB 초과 출력에서 buffered만 실패하므로 H1 확정이다. 원격 당시 구체 변경 파일/총bytes는 미확인으로 유지한다.
- 고정 seed 합성 fixture1,048,576bytes SHA256 `7b4444c4c18eeeb578946008280f3400e1dab51e480c434336d9c70cca5ac5b4`; 실제 Git binary diff1,351,672bytes SHA256 `0658d24a07d9a2a6cdc91eab4eb59799f6e30184617ebe02ccbdbb064d0e05e0`. 파일 출력 oracle과 streaming digest가 일치했고 진단 probe53.72ms였다. 이는 합성 사례1회의 로컬 관측이며 Actions 비용 개선률이 아니다.
- 수정은 기존 `ui-evidence.ts` 안의 `captureWorkingTreeProvenance`를 실제 캡처와 unit이 함께 사용하도록 했다. `spawn`의 stdout chunk를 생성 순서대로 hash하고 close exit0에서만 결과를 반환한다. `git status --porcelain`은 전체 stdout을 보관하지 않고 any-byte dirty를 관측한다. stderr는 원문을 출력하지 않으며 spawn/stream/nonzero 실패를 reject한다. 기존 `git diff --binary HEAD` 범위·v2 schema·Head/base/merge/run 검증은 유지한다.
- 신규 regression5 PASS(구현 Agent1.28초, 별도 qa_docs1.71초): clean·ignored/untracked, staged/unstaged byte oracle, >1MiB binary 전체hash, >1MiB status(4600합성파일), 외부 Git driver nonzero·spawn 실패·비저장소/원문 stderr 비노출. helper+test ESLint/typecheck/diff PASS. 임시 metrics probe의 CJS named import SyntaxError1회는 default import로 교정했고 제품 수정/원격 실패와 구분한다.
- 별도 qa_docs가 원본 Job 로그와 새 unit5 PASS·DOC_SYNC·AC/reuse·Git 실패 경계를 직접 검토해 기술 사전 검토 PASS, 신규 P1/P2 없음. 주석의 tracked diff 범위 명확화 권고를 최종 통합한다. 독립 QA_FINAL=N/A(OWNER_MANAGED), Owner ACCEPT는 NOT TESTED다.
- 기존 Python27/118 comparator21·UI assertions·CI workflow는 변경이 없어 이전 PASS를 로컬 진단 근거로 재사용한다. 새 원격 Head의 quality/e2e/docker·Trusted PASS로 승계하지 않는다. 실제 영향을 받는 helper3소비자(#880/#889/#890) 결과는 아래 최종 인계에 추가한다.


### F-001 최종 인계 — 실제 소비자·증거·재사용

- 실행 명령: `npm run test:e2e -- tests/e2e/schedule-views.spec.ts tests/e2e/i18n.spec.ts --grep '#880 실제 원본 다중|#889 세 View|#890 rapid locale' --max-failures=0 --retries=0 --output output/playwright/issue-896-rework-3594`.
- 실제 Chromium3 PASS/총4.3분: #89017.5초, 원격 실패 #88048.7초, #8892.1분(Playwright 반올림 표기). 각 기존180초 제한·기존 geometry/canonical/readonly/locale assertions 유지. #889는 이전43.7초보다 이번에 길었으며 원인·통제 비용 비교는 미확정이다. streaming 수정의 Actions 속도 개선을 주장하지 않는다.
- 실제 원본 #880의 Editor/5폭·Day/Week·Fullscreen·WBS쓰기0까지 최종 testcase PASS를 확인했다. 기존 Resource capture는 중간 단계이므로 그 manifest의 flow=NOT TESTED를 임의 PASS로 수정하지 않는다.
- v2 검증 명령은 `python3 scripts/ui_evidence.py output/playwright/issue-896-rework-3594 --require-v2 --source-sha 1cc214f85ba2e1c16a65d10d51044829eef5dc98 --baseline-sha 1826b479a80c64ef16efe768b31f75d62170639e --test-merge-sha 1cc214f85ba2e1c16a65d10d51044829eef5dc98 --summary output/playwright/issue-896-rework-3594-summary.md`. 로컬 checkout SHA는 원격 test-merge3dfd3f...와 구분한다.
- canonical14건/1,581,745bytes, 합계capture10,166ms. 구조/bytes·정확 출처 검증 exit0/EVIDENCE_VERIFIED_NOT_UAT, observationStatus FAIL/observedFailures1은 의도적 CSS4px 음성 화면이다. 수집13개 flow PASS·기존 Resource1개 NOT TESTED와 실제3 testcase 최종 PASS를 분리한다. 기록은 HEAD1cc214f8+dirty이며 신규 원격 exact Head PASS가 아니다.
- 이번 helper/New unit 코드 동결 뒤 브라우저를 실행했고 이후 코드 변경은 qa_docs 권고의 tracked 범위 한국어 주석뿐이다. Next 생성 next-env.d.ts/tsconfig.json은 실행 뒤 원본 복원했다. 최종 helper SHA256 `77c4a92b1fb7700fda2fff07458cbbc4e37fb1e2224b1e541fc0b946e4596673`, 신규 unit SHA256 `584e98a128767b694c32e3ac8f8d2c506548d99f4efad5df627ef32f5feb692a`.
- 게시 직전 조회: 원격 PR Head1cc214f8 유지·main1826b479 유지, ancestry/mergeable=true, unresolved threads0. 해결할 새 리뷰 스레드·병합 충돌은 없었다. source 지문/단언이 불변인 기존 Python/비교기 결과는 재사용하고 신규 helper5 unit·3 실제 browser·type/lint를 이번 변경 근거로 한다.
- DOC_SYNC/AC01~06/reuse 구조와 Markdown426파일 링크·diff 검사 후 동일 PR fast-forward commit/push로 새 Full CI를 시작한다. 원본 #3594.1 FAILURE는 보존하며 새 Head required3/Trusted/Owner 수용/Manager ACCEPT는 NOT TESTED다. CI Run/Attempt 등록 정보만 확인하고 상태/결과를 모니터링하지 않는다.

- 최종 주석 정리 뒤 신규 unit5 PASS(2.03초), 대상 ESLint와 typecheck PASS. 문서만 후속 갱신했으며 helper/test 두 파일 지문은 위 값과 동일하다.

## PR #902 · Full #3595.1 — F-002: Chromium shard 8/8 취소·재균형 (2026-11-09)

### A–C. 원격 원본, 전 이력 교차 진단

- [Full #3595.1 / Run 42532136493 / attempt 1](https://github.com/planner77/masterGantt/actions/runs/42532136493), event `pull_request/synchronize`, Head `997841a779dcec97a21a17b4874a5e8bab1da3ac`, base `1826b479a80c64ef16efe768b31f75d62170639e`, test-merge `d6d9e8ef599df3cf9e9dbcf7469097c6c3c92e1a`. [원본 PR source artifact 13636754697](https://github.com/planner77/masterGantt/actions/runs/42532136493/artifacts/13636754697) 존재. 결론은 **CANCELLED**이며 과거 #3594.1 FAILURE를 덮어쓰지 않는다.
- Policy·TypeScript·ESLint·Vitest·Preflight·Fast Gate·PR Build, Required Quality [job128889697564](https://github.com/planner77/masterGantt/actions/runs/42532136493/job/128889697564), Required Docker [job128890558663](https://github.com/planner77/masterGantt/actions/runs/42532136493/job/128890558663) **PASS**. E2E aggregate [job128898141151](https://github.com/planner77/masterGantt/actions/runs/42532136493/job/128898141151) **FAIL**은 `RESULT: cancelled`에 대한 의도된 fail-closed 판정, QA Final [job128898163790](https://github.com/planner77/masterGantt/actions/runs/42532136493/job/128898163790) **FAIL**은 E2E 증거 부재 파생. Main OCI/비활성 metadata·LOW 분기는 SKIPPED이며 승인 PASS가 아니다.
- 직접 원본: [Chromium 8/8 job128889225298](https://github.com/planner77/masterGantt/actions/runs/42532136493/job/128889225298) `Running 123 tests using 1 worker` 후 **121 PASS / 나머지 2 NOT TESTED**. 2026-11-08T23:27:50Z `The operation was canceled.`; 기존 35분 Job 제한에 도달하여 중단됐으며 원본 로그에 assertion FAIL은 확인되지 않는다. 합성 [artifact13639530066](https://github.com/planner77/masterGantt/actions/runs/42532136493/artifacts/13639530066)은 일부 관측만 포함하고 최종 UI/UAT 승인 증거가 아니다.

| Shard / Job ID | 선택 | PASS | 기존 SKIP | 미완료·미실행 | Playwright 시간 | 상태 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1/8 · 128889225338 | 105 | 105 | 0 | 0 | 21.5m | SUCCESS |
| 2/8 · 128889225113 | 105 | 105 | 0 | 0 | 17.8m | SUCCESS |
| 3/8 · 128889225173 | 149 | 148 | 1 | 0 | 21.8m | SUCCESS |
| 4/8 · 128889225152 | 118 | 117 | 1 | 0 | 22.1m | SUCCESS |
| 5/8 · 128889225190 | 92 | 92 | 0 | 0 | 25.1m | SUCCESS |
| 6/8 · 128889225166 | 94 | 93 | 1 | 0 | 32.0m | SUCCESS |
| 7/8 · 128889225288 | 109 | 109 | 0 | 0 | 28.2m | SUCCESS |
| 8/8 · 128889225298 | 123 | 121 | 0 | 2 | 35m 한계 | CANCELLED |
| 합계 | 895 | 890 | 3 | 2 | — | 전체 PASS 아님 |

- **누적 Cross-run F-001:** #3594.1 E2E3/8 `schedule-views.spec.ts` #880의 공유 `ui-evidence.ts` Git stdout `ENOBUFS`는 스트리밍 보완됨. #3595의 동일 E2E3/8 148 PASS/기존 SKIP1로 같은 오류 재발 미관측, 이전 원본 FAIL은 불변.
- **신규 F-002:** #3595.1 E2E8/8 `CI_SHARD_JOB_TIMEOUT`/환경·스케줄 부하, F-001과 다른 원인. 직접 실패 assertion은 미관측이며 마지막 2case는 미완료다. 원본 실패 파일 합집합 `tests/e2e/schedule-views.spec.ts` → `tests/e2e/helpers/ui-evidence.ts`; 신규 위험 범위 shard8 미완료 2case 및 shard6 32m 근접과 해당 전체 file별 스케줄이다. `GitCommitInfo timeout of 3000ms`는 성공 샤드에도 존재한 비차단 정보 경고로 직접 원인과 구분한다.

### D–F. 보완·재사용·검증

- 기존 [이산 샤드 계획](../tests/config/e2e-shard-plan.json)과 `scripts/e2e-shard-planner.mjs select`, `tests/scripts/e2e-shard-planner.test.ts`, #885/#894/#900 역사 배치를 **EXTEND**한다. 실제 #3595 완료 전체 spec 기준으로 (1) `issue-621-resource-target.spec.ts` **8→2**, 6 case, test body156.3s/완료 구간4.88m, (2) `project-settings-layout-490.spec.ts` **8→1**, 6 case, body104.6s/구간4.06m, (3) `project-transfer-layout-491.spec.ts` **6→4**, 8 case, body183.1s/구간6.16m. 모두 spec 전체 단위 이동, 중단된 미완료 case 삭제·skip 불가.
- 수정 전 파일 배치 [17,18,17,21,18,17,19,20], 수정 후 [18,19,17,22,18,16,19,18], **147개 중복·누락 없이 동일 8그룹**. `manualRebalance902`에 신규 source/run/job/선택/완료 및 이동 증거 기록, #885/#894/#900 원본 metadata 불변. 기존 단위 테스트에 최신 배치·#902→#900→#894→#885 역산·과거 source 검증을 추가한다.
- 이전 Playwright 소요에 완료 구간을 단순 이전하면 샤드1/2/4/6 약25.6/22.7/28.3/25.8m 참고치. 이는 통제되지 않은 **shift-only** 계산일 뿐 setup/host/fixture 시간 및 8/8 미완료 2개·분산 변동이 미계측되어 새 Full PASS, 향상률, 비용 절감을 증명하지 않는다.
- `.github/workflows/ci.yml`, 제품 UI/API/DB/버전 및 8-shard/workers1/35m/PR fail-fast/max-failures1/skip/retry/Required3/Trusted/Owner/OCI/Release/Finalizer는 변경하지 않는다. 이전 원격 PASS는 진단 참고일 뿐 새 Head의 공식 PASS가 아니다. 새 Head의 Quality/Chromium8/Docker/Trusted·Owner UI UAT·Manager ACCEPT는 **NOT TESTED**, MERGE_READY=BLOCKED.
- 리뷰 스레드0 및 main ancestry/충돌(현 기준 head997841a7, base1826b479, mergeable=true) 확인. 작업 후 재확인하며 같은 PR branch 단일 commit으로 `synchronize` Full CI를 시작하고 모니터링하지 않는다. 병합/Main/GHCR·이슈 종료는 범위 밖이다.
