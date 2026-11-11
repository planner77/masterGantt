# 로컬 회귀 탐색 인덱스

PLAN/REWORK 전에 관련 도메인·증상으로 원본 누적 원장과 실제 테스트를 찾고 현재 source·환경·권한의 호환성을 판단한다. 기계 검증 원본은 [REGRESSION_INDEX.json](REGRESSION_INDEX.json), schema/append-only/출처 계약은 [ISSUE_LEDGER](ISSUE_LEDGER.md)다. 이 Markdown은 탐색용 연결이며 상태를 중복 관리하지 않는다. 최초 기계 등록 범위는 #906/#907/#908의 실제 실패이며 전체 과거 원장의 자동 이관 완료가 아니다. 등록만으로 테스트·게시·운영/복원 PASS가 되지 않는다.

| 도메인/증상 | 원본 실패 ID·근거 | 원인/재발 위험 | 현재 재사용 테스트·검사 | 증거 범위 |
| --- | --- | --- | --- | --- |
| 로컬 source drift/생성물 | [#552 SourceStable](ISSUE_552_FAILURE_ANALYSIS.md) | Next 생성 타입·스크린샷이 검사 중 source를 변경 | [prepr-verifier](../tests/scripts/prepr-verifier.test.ts), verify:prepr sourceStart/sourceEnd | 과거 원본 보존; 새 source는 실제 재실행 필요 |
| SQLite HTTP fixture/재오픈 시간 | [F711-001](ISSUE_711_FAILURE_ANALYSIS.md) | setup과 제품 assertion 예산 혼합; 환경 원인은 UNKNOWN | [wbs-dashboard HTTP](../tests/server/resources/wbs-dashboard-views-http.test.ts), [migration](../tests/server/db/issue-623-target-migration.test.ts) | 과거 실패이며 현재 PASS 아님 |
| case 수/파일 수·발견 누락 | [#711 인벤토리](TEST_LIFECYCLE_INVENTORY_711.md) | 정적 파일 수를 동적 실행 case 수로 오인 | [inventory Python](../tests/python/test_test_lifecycle_inventory.py), [discovery](../scripts/verify-test-discovery.mjs) | 파일/발견/실행·skip을 구별 |
| 문서 영향 누락/Visual source | [#895 F-001/R-002](ISSUE_895_FAILURE_ANALYSIS.md) | 문서 scope 누락·환경변수 이름 불일치 | [Agent 계약](../tests/scripts/agent-qa-contract.test.ts), [UI evidence](../tests/python/test_ui_evidence.py) | 과거 PR/CI는 역사; 새 검증은 로컬 계약 |
| 직접 Push 전 LIVE 설정 미전환 | [F906-001](ISSUE_906_FAILURE_ANALYSIS.md) | PR/Required Check·자동 Actions 활성 | 정확 Ruleset/Actions read-only snapshot과 전환 전후 대조 | BLOCKED; Owner가 필요한 #911 전환 위임, 완료 전 PASS 금지 |
| source/env/fixture·부분 PASS로 게시 | [#908 통합 검증 원장](ISSUE_908_FAILURE_ANALYSIS.md) | source 오염/환경 drift/누락 coverage에 의한 잘못된 게시 허용 위험 | [prepr-verifier](../tests/scripts/prepr-verifier.test.ts), verify:prepr --mode=admit | 신규 음성·회귀는 실행 전 NOT TESTED |

코드 수정 commit·실제 재실행 결과는 원본 Issue 누적 원장과 Git 이력에 연결한다. 실행 후 생긴 증거를 검사한 commit에 소급해 넣지 않는다. final evidence는 Owner Issue 댓글에 exact source/명령/exit/report digest/이미지 digest를 추가할 수 있다. 공개 저장소에는 정제한 합성 근거만 남긴다.

## #906/#907/#908 현재 기계 등록

F906-001(LIVE 전환 전제), F906-002(gh pagination), F906-003(Buildx template), F906-004(Issue 댓글의 skipped Run), F906-005(disabled 응답 assertion), F906-006(browser snapshot 입력) 및 F906-007(합성 OCI exporter probe), F906-008(nullable TypeScript fixture), F906-009(실제 provenance v1 wrapper 호환), F906-010(ORAS 로컬 copy 후조건), F906-011(보존 문서 EOF whitespace)을 [Primary 원장](ISSUE_906_FAILURE_ANALYSIS.md)에 연결했다. 원본과 후속 event를 각각 보존하며 최신 PASS로 첫 실패를 숨기지 않는다. [#907 연결](ISSUE_907_FAILURE_ANALYSIS.md), [#908 연결](ISSUE_908_FAILURE_ANALYSIS.md).

```bash
node scripts/verify-issue-ledger.mjs
```

현재 테스트 경로 누락·중복 Failure ID·잘못된 상태/stage/출처·Git 이전 인덱스 event 및 Markdown prefix 변경을 거부한다. 합성 GHCR/운영/복원 실패 fixture는 검증기의 음성 테스트이며 실제 운영·복원 결과가 아니다.

## 첫 exact candidate 재작업 추가

F906-012의 실제 전체 Unit 실패를 추가하여 현재 기계 등록은 12개다. Head `0671bb72d2ac99cddc31f0ba6ec22e55c8883e76`의 legacy batch/source fingerprint 소비자 불일치이며 [원본](ISSUE_906_FAILURE_ANALYSIS.md)에 정확 source/env/report 지문과 실행 결과를 보존했다. 기존 11개 원본·events를 변경하지 않았다. 교정 후 결과는 실제 실행 시 별도 event로 추가하며 새 source의 전체 Gate 성공을 미리 표시하지 않는다.

## 두 번째 exact candidate 후속 원본

현재 실제 실패는 14개다. F906-012에는 `22ceadb1f7278b3a9a5c4bc4896761d3961c0eb2` 전체 Unit 3903PASS·기존3SKIP를 별도 회복 event로 추가했다. 같은 fast의 production 포장은 F906-013으로 FAIL이며, caller 환경 helper의 WIP 타입 실패·교정은 F906-014다. Unit/집중 타입 PASS를 whole Gate나 게시 성공으로 사용하지 않는다. 이전 원본/Markdown prefix는 그대로 유지한다.

## browser·미게시 메시지 준비 원본 추가

현재 실제 실패는 16개다. F906-013에는 이전 bc44 candidate의 실제 production build/fast 회복을 추가하되 그 뒤 Chromium 준비는 F906-015로 BLOCKED였음을 분리했다. 계획된3UIcase는 NOT TESTED이며3FAIL이 아니다. F906-016은 remote write 전 로컬 미게시 메시지 준비 후조건과 안전 교정이다. 옛 Head를 backup ref로 보존했고 새 Head37a의 전체 Gate는 재검증 전 미완료다.

## F906-015 진단 범위 교정

실패 개수는16개로 유지하고 F906-015에 실제 DIAGNOSTIC_ONLY source의 후속 Chromium4PASS·snapshot/dependency audit PASS를 추가했다. 최초 계획3은 정적 오계수였으며 readonly1+timezone3의 실제4case로 정정한다. 기존 실패 시점의 실행0/root error1·계획3 원문은 삭제하지 않는다. 이 진단 source/controller는 최종 프로젝트 candidate와 다르므로 게시·운영 PASS로 사용하지 않는다.

## Docker 재시작 주소 원본 추가

현재 실제 실패는17개다. F906-017은 exact e9 candidate의 restart 후 동적 주소 변경을 caller가 반영하지 못한 Docker smoke FAIL이다. 동일 image/container 재시작 진단에서 포트 재할당과 새 주소 readiness만 확인했으며 Project/Task·SQLite persistence 교정 PASS는 아직 아니다. 기존 Gate와 원본은 source에 결속해 보존하고 새 source 전체 검증을 다시 수행한다.

## F906-017 실제 guard 테스트 연결

새 실제 `tests/scripts/registry-smoke.test.ts`의5개 양성/음성 case를 F906-017에 연결했다. 독립 qa_docs의 1file/5tests PASS는 WIP 집중 검사이며 Docker/SQLite·새 candidate 전체 Gate PASS가 아니다. 최초 plannedTests는 계획 이력으로 남기고 실제 테스트 경로·case 및 scoped event를 추가했다.

## smoke allowlist 직접 소비자 원본 추가

현재 실제 실패는18개다. F906-018은 a3b2 exact source 전체 Unit의 낡은 정적 CLI literal 위치 단언이며 실제 승인 allowlist 범위 변경은 아니다. core allowlist·CLI wiring과 기존 직접 소비자를 함께 검사하도록 정합화하고 기존 정확 범위/보안 단언·runtime 의무를 유지한다. 파일 수와 nested suite 수, skipped를 구분하고 교정 후 PASS를 미리 기록하지 않는다.

## F906-018 집중 재작업 누적

동일 F906-018 아래 r1/r2의 실제 focused 실패와 r3의65PASS를 각각 누적했다. in-memory positive receipt가 실제 selected unit 소비자 전체를 구성하도록 고쳤으며 기존 layout/allowlist·외부 URL 음성·runtime 의무를 유지한다. WIP 집중 성공은 새 candidate 전체 Gate 성공이 아니다. 실패 개수는18개이며 새 Failure ID를 만들지 않았다.

## 실제 GHCR 게시 원본 추가

현재 실제 실패는19개다. F906-019는 ORAS1.3.6 cp의 잘못된 목적지 인증 옵션 실패와 동일 OCI의 교정 재시도다. 자동 ORAS regression을 주장하지 않고 실제 `cp --help`·인증된404·upload/readback·exact digest Pull/runtime receipt에 연결했다. 앱 source8e29·index8ebd91b4f6b316c3bdc9a221e5a8ee9d50a3fb4fb845c2ebf140e44ac50292d1의 GHCR_DIGEST_VERIFIED를 기록하되 운영 배포/복원·Owner FINAL/종료 및 후속 문서-only 검증과 분리한다. 이전18개·39events prefix는 그대로다.
