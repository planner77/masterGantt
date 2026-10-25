# Issue #799 — 로컬 검증·관측 실패 원장

이 원장은 실패를 소급 PASS로 바꾸지 않는다. 제품·도구·환경 실패와 공식 원격 CI를 구분하고, 실제 재검증 source와 결과는 [Work Packet](exec-plans/active/ISSUE_799.md)과 [실측 보고서](ISSUE_799_DASHBOARD_METRICS.md)에 연결한다.

## F799-L001 — 로컬 Chromium 실행 파일 준비

신규 Playwright 설치가 기대하는 Chromium1247이 로컬에 없어 CLI 준비가 실패했다. 설치된1243 실행 파일을 명시한 실제 환경에서 기본 before30을 수집했다. 의존성·CI browser revision·workflow를 바꾸지 않았다. 실제 browser 버전 차이는 로컬 환경 한계이며 pinned 원격 Chromium 증거로 대체하지 않는다. 원문/명령은 frontend 실행 영수증으로 연결한다.

## F799-L002 — seed 완료 전 관측 호출

fixture seed가 완료되기 전에 capture가 실행되어 fixture 파일 ENOENT로 실패했다. 준비 단계의 순서를 바로잡아 seed 성공 뒤 실행했다. 제품 API/데이터나 테스트 assertion을 변경한 해결이 아니다. 기본 before30/30·fault0은 별도 완료 실행이며 최초 실패는 보존한다.

## F799-L003 — 보조 metric 관측의 dev 진입 대기

기본 before30/30 완료 이후 별도 보조 raw/metric 수집은18개 metric PNG를 기록한 뒤1024px의 `편집 중` 진입 대기30초 timeout으로 중단됐다. Next dev의 React mount warning을 함께 관측했으나 경고가 timeout의 확정 원인이라는 증거는 없다. 이 단계는 제품 표시 수정 전이며 기본 before30의 완결성과 구별한다. 미완결 보조 자료는 최종 PASS 집합에 섞지 않는다. 재수집 범위·source·결과는 실제 영수증을 확보한 뒤 아래에 추가한다.

## F799-L004 — 보조 재수집 프로세스 종료

별도 보조 재수집 프로세스가 exit143/SIGTERM으로 중단됐다. 종료 주체·근본 원인은 미확정이다. Manager/infra는 서버·CLI·Node 정리를 실행하지 않았고, 당시3199 개발 서버와 issue799metrics CLI daemon은 살아 있었다. 기본 before30은 별도 완결 자료로 유지한다. 보조 재시도2의 미완결 자료와 failure 영수증은 보존하고 실제 최종 자료·수집 비용과 구분한다. 이후 parent 종료 뒤에도 CLI daemon의 이전 run-code가 계속 PNG를 작성한 관측을 확인했다. 새1440-only 실행 중768 PNG가 생성된 사실은 보조 도구 실행 경합의 증거이며 parent SIGTERM의 원인과는 구분한다. frontend가 자신이 소유한 CLI session만 닫고 새 session에서 범위를 제한해 수집한다.

## F799-L005 — 보조 브라우저 재인증 입력 오류

새 CLI session의 fixture 재인증에서 실제 `editPassword`/204 계약 대신 잘못된 `password`/201 기대를 사용해400으로 실패했다. after 첫 시도는 미완결로 중단·분리하고 기존 입력/상태 계약을 적용한다. 제품 인증/API·세션 정책을 변경한 해결이 아니다. 재인증 세션 발급과 업무 원본 mutation을 구분하고 canonical fingerprint를 다시 확인한다.

## F799-L006 — 선택 E2E의 fixture 서버 공유 오류

선택7개 E2E 첫 실행에 기존 fixture 서버를 `PLAYWRIGHT_BASE_URL`로 전달하여 catalog 준비 중 중복400이 발생했다.7/7 setup FAIL이며 제품 단언에는 도달하지 않았다. 최초 `local-chromium-attempt1.json`을 보존하고 기존 기본 격리 application fixture로 실행한다. assertion·timeout/retry·CI를 완화하지 않는다. 최종 실행의 실제 source·결과와 구분한다.

## F799-L007 — 로컬 GitHub CLI·Git 쓰기 인증

착수 시 gh 조회는 HTTP401 Bad credentials로 실패했고, 게시 준비의 `git push --dry-run`도 Invalid username or token으로 실패했다. 실제 remote ref 변경은0이며 공개 fetch는 가능했다. 연결된 GitHub 앱의 인증된 조회·blob/tree/commit/ref/PR 기능으로 동일 tree를 게시하는 경로를 사용한다. 토큰을 출력하거나 신규 PAT·권한 확대를 요청하지 않는다. 최종 게시 동등성과 CI 등록은 별도 영수증으로 확인한다.

## F799-L008 — after 진입 대기와 동시 개발 서버

올바른 재인증 이후에도 manual after의 `편집 중` 진입 대기 timeout이 한 차례 발생했다. 당시 main fixture 개발 서버와 격리 E2E Next 서버가 같은 worktree의 `next-env.d.ts`/`tsconfig.json`을 각각 생성 경로로 갱신하는 현상을 확인했다. timeout·mount warning과의 인과는 확정하지 않는다. 미완결 after를 분리하고 CLI 캡처를 중단한 뒤 격리7case 완료→main 서버 단독 after30/보조6 순서로 직렬 실행한다. 제품·assertion·timeout·CI 정책은 변경하지 않는다.

## F799-L009 — 고정 최소폭 grid 후보 제외

초기128px 최소폭 grid의 미완결 after에서 유효한390px 관측은 공정 표Y1570.39→1617.89(+47.5px), 설비1363.39→1338.39(-25px)였다. 큰 수량의 intrinsic 폭과 기존 표의 가용 높이를 보존하기 위해 해당 후보를 SUPERSEDED로 제외했다. 이 수치는 최종 flex 후보의 개선 증거로 사용하지 않는다.

당시 격리 실행은 #732/#733/#734의3 PASS, #735 1 interrupted,3 NOT RUN에서 구현 담당자가 자신이 소유한 runner에 SIGINT를 보내 정상 정리했다(exit130). `local-chromium-grid-superseded.json`과 `grid-chromium-status.json`을 보존한다. 테스트 skip 정책을 추가한 것이 아니며 최종7case의 성공 수에 합산하지 않는다. 최종 intrinsic flex-wrap·label/value 위계 후보를 별도 지문으로 고정한 뒤7case를 새로 실행한다.

## F799-L010 — 최종 보조6 중2개 진입 대기 미완결

최종 표준 after30/30은 fault0으로 완결했으나 별도1440px 보조6은4 PASS/2 FAIL(PARTIAL)이다. 공정/리소스의 `편집 중` 대기30초 timeout을 보존한다. 보조 목적은 지표 인벤토리와 읽기 보고서 확인이므로 실패2개만 별도 public readonly `data-ready`/report-ready 기준으로 보완하고 실제 권한·수집기 hash·출처를 밝힌다. 원래4/6 보조 실행을 깨끗한6/6 PASS로 바꾸지 않는다.

full raw5의 전후 동등성은 UI 편집 표시와 분리한 정확한 동일 read-only query로 확인한다. readonly 보완 화면의 전역 header geometry를 편집 상태였던 before와 동일 조건 비교라고 주장하지 않는다. 기본30쌍 전후·격리7case·독립 spot-check/DOM stress의 최종 source 검증과 구별한다. 제품/auth·Required gate를 변경한 해결이 아니다.

L010 보완 결과: 실패2개 readonly 인벤토리·4PNG와 독립 exact-query5 full raw의 전후 동등성 PASS, sourceStable·canonical17/fingerprint 동등·업무 mutation0. 원래 after 보조6의4/6 PARTIAL은 유지한다. 표준 before/after30쌍과 최종격리7은 별도 완결 PASS다. 상세 source/명령/경계는 [비교 JSON](../output/playwright/issue-799/comparison.json)과 [readonly 영수증](../output/playwright/issue-799/after/read-only-supplement.json)을 따른다.

## 원격 상태

PR Full CI·Quality/E2E8/Docker·Trusted QA는 아직 NOT TESTED다. 이 로컬 준비/보조 실패를 원격 회귀 결과로 표시하거나 최종 QA/Manager ACCEPT로 사용하지 않는다.

## F799-R001 — 원격 PR Full CI 성공 이후 Trusted Base/Test-Merge 불일치 (2026-10-25)

| 실행/출처 | 판정 |
| --- | --- |
| [PR #804 Full #3267.1](https://github.com/planner77/masterGantt/actions/runs/40153151893), run `40153151893` attempt1, `pull_request FINAL_FULL`, Head `fcac6248b26dd9976f8c55dc7e8e1cde43bf4b58`, Base `fcd1ae59d268efa1913f4de625a9013cabd1de4a`, Test-Merge `3fca88eaff556e43409754cb07cdb9572104085b` | Preflight Job `121048790702` PASS; Quality `121049643496` PASS; PR E2E shard1~8 및 Required Chromium `121054333826` PASS; Docker `121049673809` PASS. QA Final Automated `121054351658`는 **SKIPPED**, 독립 최종 QA 승인이 아님. |
| [QA Trusted #913.1](https://github.com/planner77/masterGantt/actions/runs/40155011958), run `40155011958` attempt1, created `2026-10-25T02:35:15Z`, `workflow_run`, 검증기 main `37963266793e7c4b1827f64d3d9b19b2d5d252fb` | `QA Final — Trusted` Job `121054417505`, Step4 `원본 PR CI/Head/base 및 차단 리뷰·문서 증거 독립 조회`에서 직접 **FAIL/BLOCKED**, `병합 전 PR base/test-merge가 원본 검증과 다릅니다`, exit1. checkout·검증기 SHA 검사·artifact upload는 PASS. [원본 Job](https://github.com/planner77/masterGantt/actions/runs/40155011958/job/121054417505), [원본 artifact](https://github.com/planner77/masterGantt/actions/runs/40155011958/artifacts/12584501640). |

- **원인 분류 `POLICY_CI / STALE_BASE`**: Issue #506 / PR #803의 main 병합 SHA `37963266793e7c4b1827f64d3d9b19b2d5d252fb`가 기존 Base 이후 반영되어 #799 Full 성공 영수증의 Base/Test-Merge와 현재 open PR이 일치하지 않는다. 원래 #799 제품·Unit·E2E·Docker 실패가 아니며 Trusted의 fail-closed 판단은 보호 정책상 정당하다.
- **충돌·누적 분석**: main 대비 #506 변경15파일 중 #799와 공통6개: `CHANGELOG.md`, `docs/PROJECT_UX.md`, `docs/TEST_PLAN.md`, `docs/exec-plans/active/PLAN.md`, `package.json`, `package-lock.json`. 문서 앞 단락 추가를 모두 유지하고 main-only 제품·테스트·fixture 변경9개를 가져온다. 원래 #799 표시 CSS·기존 다섯 관점 E2E·before/after 이미지/보고서는 지우지 않는다. main #506 후보0.133.1과 겹친 #799 버전을 **0.133.2**로 변경, package+lock root3 version 이외 dependency/SRI 불변. `GIT two-parent merge`로 provenance를 명시한다.
- **검증·인계**: 원격 diff/버전 JSON·Git Blob/Tree 비교는 정적으로 수행하며 로컬에서 GitHub DNS·실행 환경이 없어 Node/Chromium/Docker **NOT RUN**. 초기 로컬 F799-L001~L010, 기존 Full #3267.1 PASS 및 Trusted #913.1 FAIL은 기록을 삭제하지 않는다. 새 정확 Head/Base/Test-Merge 공식 Full CI/Trusted는 별도 출처로 검증하기 전 `NOT TESTED`이며 과거 PASS 재사용 금지.
- **QA/승인**: 기존 검토에서 미해결 PR thread0 확인, push 후 다시 검사. `HIGH/AGENT`이므로 최종 별도 인간 QA_FINAL + Owner HIGH 위험 수용 + Manager ACCEPT 필요. `release_required=true`, `release_authorized=false`, `MERGE_READY=BLOCKED`. 이번 사용자 지시의 종료점은 새 Full PR CI **시작**, 완료 감시·병합/Main/GHCR·Release/Finalizer·Issue 종료는 수행하지 않는다.

## 최신 원격 상태 (상단 '원격 상태'의 초기 역사적 NOT TESTED와 구별)

최초 #799 Full #3267.1은 당시 정확 source에 대해 PASS. Trusted #913.1은 최신 main 불일치로 FAIL/BLOCKED. 새 후보0.133.2의 공식 PR Full/Trusted 결과는 신규 Run 등록·완료 전 `NOT TESTED`다.
