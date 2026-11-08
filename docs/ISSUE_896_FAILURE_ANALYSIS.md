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
