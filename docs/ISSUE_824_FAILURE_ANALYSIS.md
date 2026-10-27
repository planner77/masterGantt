# Issue #824 / PR #835 — 누적 PR CI 실패 분석

Primary Issue: [#824](https://github.com/planner77/masterGantt/issues/824). 관련 PR: [#835](https://github.com/planner77/masterGantt/pull/835), 직접 영향 하위 #826. 갱신일: 2026-10-28. Source of Truth: [PR CI 실패 진단 정책](PR_CI_FAILURE_TRIAGE.md).

최초 Full PR CI는 기존 장문 geometry 소비자의 고정44px 기대값을 갱신하지 못해 FAIL했다. 승인된 fine36/coarse44px 제품 계약은 유지하고 테스트의 양축 oracle과 coarse 실행 범위를 보완한다. 원본 실패를 재실행 PASS로 덮지 않는다. 현재 새 Head의 원격 검증은 NOT TESTED, Manager는 REWORK다.

## 1. Run/Attempt 전체 목록

| 종류 | Run/Attempt·event | source | 실제 결과·증거 |
| --- | --- | --- | --- |
| 원본 Full | [#3342.1 /40521099686](https://github.com/planner77/masterGantt/actions/runs/40521099686), pull_request / CI | Head `c7506bb615dcb53541c07daa48afb2636257cadf`, base `e95cb0911c43173074e663febd1a9a94b8af6910`, test merge `546ba63c4bd9c2a367e3e2a7a5a3eba2818d9e84` | FAILURE. Quality/Docker SUCCESS, E2E FAILURE, 실제 Shard5 FAIL·나머지7 CANCELLED, QA Automated SKIPPED |
| 참고 Fast | [#149.1 /40521099820](https://github.com/planner77/masterGantt/actions/runs/40521099820), pull_request / pr-fast-development.yml | 같은 Head | SKIPPED. 공식 Full/Required PASS나 독립 실패로 합산하지 않음 |
| 기본 브랜치 Trusted | [#990.1 /40522527253](https://github.com/planner77/masterGantt/actions/runs/40522527253), workflow_run | validator `e95cb0911c43173074e663febd1a9a94b8af6910` | FAILURE·파생. 원본 PR CI 자체 미성공. 인간 QA 미확보가 이번 직접 실패의 원인은 아님 |

원본 Full은2026-10-27T14:26:20Z 시작,14:35:11Z 완료됐다. 최초 직접 실패는14:34:06.4398210Z다. branch는 `feat/issue-824-dashboard-consistency`다. 접근 가능한 branch PR 실행은 위 Full/참고Fast2건, metadata0·추가Full0·rerun0이며 Trusted는 별도 기본 브랜치 실행이다.

[원본 정제 원장](evidence/issue-824/ci-40521099686-attempt-1.json), [정밀 계수 보충](evidence/issue-824/ci-40521099686-attempt-1-counts.json)을 함께 사용한다. 원본 JSON SHA256은 `22ea8b75222eb780c19b8f13d3dc42883dbee3eb539f249e167495e4471da050`, 보충은 `603236f84def2b055d8a5eb1e3ddd0d035c4ef6bb08eef7da7ff2a4f951612d5`이며 원본 bytes를 변경하지 않았다.

### Required와 직접 실행 구분

| Job | ID | 원본 결과 |
| --- | ---: | --- |
| Build, static checks, and unit tests |122250697069|SUCCESS|
| Docker build and runtime smoke test |122250986075|SUCCESS|
| Chromium end-to-end tests |122252915321|FAILURE·Shard 실패 파생|
| Docker 실제 구현 |122249836182|SUCCESS|
| Chromium Shard5 / Step7 E2E shard 실행 |122249836530|직접 FAILURE|
| Trusted / Step4 |122253178063|원본 CI 실패에 따른 파생 FAILURE|

Main-only SKIPPED 구현은 필요한 PR 검증의 PASS가 아니다. 원본3aggregate/30개 구현 Job과 source artifact 필드는 정제 JSON에 보존했다. 새 Head에서는 이전 Quality/Docker 성공도 stale이며 전부 재검증한다.

### 전체8샤드 로그 합집합 감사

| Shard | Job ID | 물리 로그 행 | 완료 PASS 관측 | FAIL 관측 | SKIP 관측 | Job 결과 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
|1|122249837358|944|37|0|0|CANCELLED|
|2|122249836305|825|7|0|0|CANCELLED|
|3|122249836715|906|32|0|1|CANCELLED|
|4|122249836325|789|6|0|0|CANCELLED|
|5|122249836530|939|23|1|0|FAILURE|
|6|122249836331|980|31|0|0|CANCELLED|
|7|122249836248|863|23|0|0|CANCELLED|
|8|122249836500|817|11|0|0|CANCELLED|

829계획 = 관측 PASS170 + 직접FAIL1 + 관측조건부SKIP1 + 완료결과미확인657이다.657은 Shard5의 명시적 미실행82와 취소7개 잔여575이며,575의 중단·미시작·미관측 조건부 SKIP는 더 구분할 수 없다. SKIP1은 기존 `logistics-table-density.spec.ts:41`의 before 전용 baseline(`LOGISTICS_CAPTURE != before`)이다. 나머지7샤드 전체 원본 로그에서 추가 실제 FAIL 기록은 없었다. 개별✓행 관측을 취소 Job 전체 성공이나 필요한 미실행 검증 PASS로 격상하지 않는다.

최초 JSON의 넓은 잔여658에는 관측 SKIP1이 포함됐다. 보충 JSON에서 정확히 분리했으며 원본은 그대로 유지했다. 원본 물리 행수와 마지막 빈 레코드 포함 split 결과의1행 차이도 보충에 명시했다.

## 2. 누적 실패 파일 및 Cross-run 매트릭스

원격 실제 실패 파일 합집합은 현재 `tests/e2e/issue-730-view-composer.spec.ts` 한 개다. 구현 중 로컬 F824-001~010은 [로컬 실행 추적](ISSUE_824_VALIDATION.md)의 별도 이력이며 원격 Full 실패 횟수에 더하지 않는다. 이전 #825의 실패/성공도 본 Issue 실패로 재귀속하지 않는다.

| 실패 ID·파일·case | 최초 원본 실패 | 원인/보완 | 최신 동결 source 검증 | 잔여 위험 |
| --- | --- | --- | --- | --- |
| CI824-001 / issue-730-view-composer:424 장문5폭 | Run40521099686.1 / Shard5 / geometry():82, help height≥44 기대·36 실제 | TEST_CONTRACT. 고정44 width/height를 실제pointer/any-pointer에 따른36/44로 동기화, 기존readonly touch 문맥에서도 같은 helper 실행 | 로컬 원본 RED 재현→새 동결 직접2case/실제 helper 음성4관측·typecheck/lint PASS | 새 Head의 Full8/Required3/Trusted NOT TESTED, 인간 QA/Manager 미확보 |

## 3. 개별 실패 사건

### CI824-001 — Full3342.1 / Run40521099686, attempt1

- 원본 case는 `#730 실제 HTTP 긴 이름·동일 열 budget·5폭 내부 스크롤·키보드·읽기 전용 가상 그룹`, equipment root에서390/768/1024/1440/1920×1000px를 반복한다.
- `geometry():82`의 도움말 높이 expected≥44/actual36에서 처음 FAIL했다. 같은 helper의 width83도 포인터와 무관하게44를 강제한다. 유일한 helper caller는424 case의430 루프다.
- #826의 승인 계약은 fine36/coarse·any-coarse44px다. 제품 `.root`/도움말36px는 해당 fine 계약에 맞는다. 개발 선별에서 #798만 갱신·실행하고 장문 helper 소비자를 빠뜨린 검증 범위 누락이다. runner/network 오류로 설명하지 않는다.
- 원격 실패와 같은 소스/실제 isolated HTTP·SQLite에서 로컬 RED를 재현했다. 제품을44px로 되돌리거나 기대값을 전역36으로 낮추지 않고 oracle을 CSS변수와 독립적인 실제 media capability로 결정한다. 양축과 pointer/min을 증거에 기록하고 기존readonly touch390의 동일 helper로44분기를 실행한다.
- 기존 document overflow≤1px·6열 header/body alignment≤1px·표 소유 scroll·narrow overflow·긴 이름·keyboard/focus·readonly 원본 없음/상세tap/cookie0를 모두 유지한다. 기존 #798 touch5root, #736 coarse, #719 touch, native Timeline44는 다른 명시 계약이므로 KEEP한다.
- Trace artifact `12741529586`,3,300,901bytes, SHA256 `676a75a47f0d7d2487c6e1f5dacbb0d3108d31669895d14ef40724e3585239c0`. raw 원본은 task-local untracked에만 저장하며 Git/댓글에는 정제 metadata만 사용한다.
- source artifact `12741532584`의 schema/repository/run/attempt/PR/Head/base/test-merge 필드를 Git 두 부모·동일 tree 및 원본 PR과 대조했다. 이것은 Trusted PASS를 뜻하지 않는다.
- Trusted artifact `12742975751`·Run40522527253.1은 원본 CI 미성공으로 FAIL이며 독립 인간 QA는 NOT TESTED다. 리뷰 제출/미해결 thread0.

## 4. 누적 원인·공통 재현 및 보완 계획

- 실제 원격 원인은 현재 TEST_CONTRACT1건이다. 제품/fixture/transport/환경을 원인으로 확정할 근거는 없다.
- 직접: 원본 장문5폭 case + helper coarse390 readonly 실행. 교차: 기존 #798 다섯 소비자5폭/고급 조건·touch44. 음성: 실제 helper 원문을 사용하는 별도 output 전용 진단에서 fine35/coarse43 양축의 거절·복원 동작을 확인하며 추적 unit 복제는 추가하지 않는다.
- 실패 합집합 전체는 한 spec이며 취소된7샤드는 정확 새 Head의 공식 Full8에서 다시 실행한다. 취소는 임의 skip/부분 Green의 근거가 아니다.
- Manager는 누적 원장/관련 문서·Issue/PR 상태 기록, frontend는 동일 기존 spec의 테스트 계약/실제 재현만, infra는 원본 로그/새 CI 출처, qa_docs는 별도 read-only 계약·증거 재검토를 담당한다. 제품/API/DB·CI·QA·timeout/retry·skip 변경은 없다.

## 5. 같은 최종 source 검증과 다음 PR CI

[REWORK-01 실제 실행 영수증](evidence/issue-824/rework-01.json), [타입/린트 동결 검사](evidence/issue-824/rework-01-verification.json), [실제 DOM 음성 검증](evidence/issue-824/rework-01-negative.json)을 사용한다.

- 새 test SHA256: `7973deafae09bd18bdb37c0f7889295a30d5eb67c50ec7f07f4a956d5a4a2f65`.
- 실제 geometry helper 원문 SHA256: `0ef3767924faaaebcc9ff36aafe9aedbeb246e7d051aa9cc872e336087ab869b`.
- 현재28파일 정규화 지문: `147cf042f44863b60310ef9f3aeb4f6a1277d1ffeffe70247400fa2b7648df08`. 이전28지문과 차이는 위 test1파일뿐이다.
- 원본 source exact 장문1case RED를 로컬 재현했다. 새 source의 장문5폭·readonly coarse helper1case27.7초와 기존 #798 다섯 관점·고급 조건·coarse1case1.9분, 총2case/3.1분 PASS다. 장문은 신규 고유case1이며 #798은 이전20case의 반복이므로 단계별 누적 고유21=실제 HTTP/SQLite4+mock UI17이다. 이 합산은 서로 다른 단계 source를 합친 목록이며 새 Head 전체 회귀 PASS가 아니다.
- 양축 negative는 실제 helper 원문을 output 전용 임시 wrapper가 동적 읽어 fine35px/coarse43px 높이·너비를 주입해 정확히 거절하고 복원했다. 각 축을 fresh context에서 검증해 실제 media·node marker·치수·같은 page/context를 확인했다.4관측/32.1초(전체48.9초) PASS·canonical 불변이며 새 상시 E2E/Unit4case로 합산하지 않는다.
- 첫 수동 negative 시도는 coarse43 probe 시 실제 media가 fine(false/false), min36이 되어 조건 통제 FAIL이었다.43≥36 허용은 제품/단언 오류가 아니다. [최초 관측 정제 근거](evidence/issue-824/rework-01-negative-initial-observation.json)와 원본 log/trace를 보존했다. 최신 fresh-context 음성은 실제 coarse(true/true)·min44 판정 중43 거절을 확인한다. 복원 positive helper의 fullPage 캡처를 포함한 구간 뒤 coarse→fine 관측은 같은 page/context에서 재현됐으나 driver 내부 원인은 UNKNOWN이다. 제품/테스트에 미디어 강제 workaround를 추가하지 않았다.
- coarse helper의 측정 시44×44 검사는 실제 실행됐다. 후속 readonly `.tap`·원본 없음/cookie0는 touch injection 동작 검증이며 캡처 이후까지 CSS media가 계속 coarse라는 주장과 구분한다.
- test 외17제품·package/lock·collector bytes는 그대로라 기존 production build·최종22runtime을 Local Fast Feedback으로만 재사용한다. 이전28파일의 current 동일 주장은 이 변경 후 stale이므로 새 test/doc 지문과 타입/린트 검증을 별도로 결속한다. 새 source20파일 start=end·typecheck/focused lint exit0 PASS이며 Next 생성3파일을 보존/복원한 뒤 타입 검사도 PASS다. 이전 remote Required3·Trusted·QA 판정은 영향과 무관하게 새 Head에서 전부 stale이다.

 새 candidate의 Quality/E2E/Docker/Trusted는 NOT TESTED다. 같은 실패 source의 rerun 대신 교정된 새 Head의 Full8을 시작한다. version0.135.6 후보·정확 버전 게시 승인 marker는 유지하되 Main/GHCR/Release/Issue 종료를 선행하지 않는다.

### 독립 사전 재검토

`/root/qa`의 [REWORK_PRE_QA](evidence/issue-824/pre-qa-rework-01.json)는 PASS/미해결 지적0이다. 실제 포인터 oracle·양축/6열/overflow/scroll/readonly 보존, 새 test/28지문·직접2case·음성4관측·타입/린트 및 제품불변 Local 재사용을 검산했다. 원본 CI FAIL을 변경하지 않으며 새 Head 공식 gate의 승인이 아니다.
